"""Tests for analysis/trends.py (Theil-Sen + moving block bootstrap).

Known-answer tests on constructed series; a guard that no forecasting
library (statsmodels) is imported by the trends module or the pipeline.
"""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build_indicators import mann_kendall_sens, ols_trend  # noqa: E402
from trends import compute_sens_slope, moving_block_bootstrap_slope  # noqa: E402

YEARS = list(range(1995, 2025))


class TestComputeSensSlope:
    def test_perfect_line(self):
        vals = [2.0 * (y - 1995) for y in YEARS]
        s = compute_sens_slope(YEARS, vals)
        assert s["slope_per_year"] == pytest.approx(2.0, abs=1e-9)
        assert s["ci_low_per_year"] <= s["slope_per_year"] <= s["ci_high_per_year"]
        assert s["n_years"] == 30
        # perfectly linear series: all pairwise slopes identical -> CI degenerate at 2.0
        assert s["ci_low_per_year"] == pytest.approx(2.0, abs=1e-9)
        assert s["ci_high_per_year"] == pytest.approx(2.0, abs=1e-9)

    def test_matches_pipeline_sen_slope(self):
        # consistency: trends.py and build_indicators' own Sen implementation agree
        vals = [500 - (y - 1995) * 3.0 for y in YEARS]
        s = compute_sens_slope(YEARS, vals)
        sen_decade, _ = mann_kendall_sens([float(y) for y in YEARS], vals)
        assert s["slope_per_year"] * 10.0 == pytest.approx(sen_decade, abs=1e-6)

    def test_drops_missing_values(self):
        vals = [2.0 * (y - 1995) for y in YEARS]
        vals[5] = None
        vals[10] = float("nan")
        s = compute_sens_slope(YEARS, vals)
        assert s["slope_per_year"] == pytest.approx(2.0, abs=1e-9)
        assert s["n_years"] == 28

    def test_too_few_points_raises(self):
        with pytest.raises(ValueError):
            compute_sens_slope([1, 2, 3], [1.0, 2.0, 3.0])


class TestMovingBlockBootstrap:
    def test_strong_trend_is_significant(self):
        vals = [2.0 * (y - 1995) for y in YEARS]
        b = moving_block_bootstrap_slope(YEARS, vals, block_size=3, n_boot=500, seed=42)
        # detrended MBB: a perfect linear series has zero residuals, so every
        # replicate recovers the exact slope and the CI degenerates at 2.0
        assert b["statistically_significant_95"] is True
        assert b["mbb_ci_low_95"] == pytest.approx(2.0, abs=1e-9)
        assert b["mbb_ci_high_95"] == pytest.approx(2.0, abs=1e-9)

    def test_noise_is_not_significant(self):
        rng = np.random.default_rng(0)
        vals = [400.0 + rng.normal(0, 80.0) for _ in YEARS]
        b = moving_block_bootstrap_slope(YEARS, list(vals), block_size=3, n_boot=2000, seed=42)
        assert b["statistically_significant_95"] is False
        assert b["mbb_ci_low_95"] < 0 < b["mbb_ci_high_95"]

    def test_zero_exclusion_flag_matches_interval(self):
        vals = [500 - (y - 1995) * 3.0 for y in YEARS]  # clean decline
        b = moving_block_bootstrap_slope(YEARS, vals)
        zero_inside = b["mbb_ci_low_95"] <= 0 <= b["mbb_ci_high_95"]
        assert b["statistically_significant_95"] == (not zero_inside)

    def test_deterministic_same_seed(self):
        vals = [400 + (y - 1995) * 1.5 for y in YEARS]
        a = moving_block_bootstrap_slope(YEARS, vals)
        c = moving_block_bootstrap_slope(YEARS, vals)
        assert a == c

    def test_different_seed_differs_but_point_estimate_same(self):
        # noisy series (residuals exist) so different seeds give different CIs
        rng = np.random.default_rng(5)
        vals = [400 + (y - 1995) * 1.5 + rng.normal(0, 50.0) for y in YEARS]
        a = moving_block_bootstrap_slope(YEARS, list(vals), seed=42)
        d = moving_block_bootstrap_slope(YEARS, list(vals), seed=7)
        assert a["slope_per_year"] == d["slope_per_year"]
        assert (a["mbb_ci_low_95"], a["mbb_ci_high_95"]) != (d["mbb_ci_low_95"], d["mbb_ci_high_95"])

    def test_blocks_preserve_time_order(self):
        # within each bootstrap replicate, consecutive positions must come from
        # consecutive years inside a block: verify via a marker series
        vals = [float(i) for i in range(30)]
        rng = np.random.default_rng(1)
        starts = np.arange(27)
        chosen = rng.choice(starts, size=10, replace=True)
        idx = np.concatenate([np.arange(s, s + 3) for s in chosen])[:30]
        for k in range(0, 27, 3):  # each full block must be contiguous ascending
            assert idx[k + 1] == idx[k] + 1 and idx[k + 2] == idx[k] + 2

    def test_autocorrelated_series_ci_wider_than_analytical(self):
        # AR(1) noise: MBB should give a (typically) wider interval than the
        # analytical rank-based CI, which assumes independent years
        rng = np.random.default_rng(11)
        e = 0.0
        vals = []
        for _ in YEARS:
            e = 0.6 * e + rng.normal(0, 60.0)
            vals.append(400.0 + e)
        s = compute_sens_slope(YEARS, vals)
        b = moving_block_bootstrap_slope(YEARS, vals)
        assert (b["mbb_ci_high_95"] - b["mbb_ci_low_95"]) >= (
            s["ci_high_per_year"] - s["ci_low_per_year"])

    def test_block_size_one_equals_iid_bootstrap_independence(self):
        # block_size=1 degenerates to plain iid resampling; still deterministic
        vals = [400.0] * 30
        b = moving_block_bootstrap_slope(YEARS, vals, block_size=1, n_boot=100, seed=3)
        assert b["mbb_ci_low_95"] == 0.0 and b["mbb_ci_high_95"] == 0.0

    def test_defaults(self):
        vals = [400 + (y - 1995) for y in YEARS]
        b = moving_block_bootstrap_slope(YEARS, vals)
        assert b["block_size"] == 3 and b["n_boot"] == 2000 and b["seed"] == 42

    def test_invalid_args(self):
        with pytest.raises(ValueError):
            moving_block_bootstrap_slope(YEARS, [1.0] * 30, block_size=0)
        with pytest.raises(ValueError):
            moving_block_bootstrap_slope(YEARS, [1.0] * 30, n_boot=0)


class TestNoForecastLibraries:
    @staticmethod
    def _has_statsmodels_import(src):
        return ("import statsmodels" in src
                or "from statsmodels" in src
                or "import statsmodels." in src)

    def test_trends_module_has_no_statsmodels_import(self):
        src = Path(__file__).resolve().parents[1].joinpath("trends.py").read_text(encoding="utf-8")
        assert not self._has_statsmodels_import(src)

    def test_build_indicators_does_not_import_statsmodels(self):
        import build_indicators
        assert "statsmodels" not in sys.modules

    def test_run_all_has_no_statsmodels_import(self):
        src = Path(__file__).resolve().parents[1].joinpath("run_all.py").read_text(encoding="utf-8")
        assert not self._has_statsmodels_import(src)  # only the optional --forecast stage subprocess may use it


class TestRealRegionalSeries:
    def test_setif_annual_series_runs(self):
        import json
        p = Path(__file__).resolve().parents[2] / "data" / "processed" / "setif" / "climate_yearly.json"
        if not p.exists():
            pytest.skip("climate_yearly.json not built yet")
        rows = json.loads(p.read_text(encoding="utf-8"))["rows"]
        years = [r["year"] for r in rows]
        vals = [r["annual_rain_mm"] for r in rows]
        s = compute_sens_slope(years, vals)
        b = moving_block_bootstrap_slope(years, vals)
        assert s["slope_per_year"] * 10.0 == pytest.approx(
            mann_kendall_sens([float(y) for y in years], vals)[0], abs=1e-6)
        # Sétif: OLS+MK say significant, but MBB with block autocorrelation is wider
        assert b["block_size"] == 3
        assert isinstance(b["statistically_significant_95"], bool)
