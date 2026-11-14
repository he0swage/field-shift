import pandas as pd
import pytest

from build_indicators import longest_dry_spell, parse_power


def _series(values):
    """values: list of float or None (missing); daily index starting 2000-01-01."""
    idx = pd.date_range("2000-01-01", periods=len(values), freq="D")
    s = pd.Series(values, index=idx, dtype=float)
    return s


class TestLongestDrySpell:
    def test_all_dry(self):
        assert longest_dry_spell(_series([0.0] * 10), 1.0) == 10

    def test_single_wet_break(self):
        assert longest_dry_spell(_series([0.0] * 4 + [5.0] + [0.0] * 6), 1.0) == 6

    def test_missing_day_breaks_spell(self):
        # 3 dry, missing, 3 dry -> spells never merge across missing days (v1 finding h fix)
        assert longest_dry_spell(_series([0.0] * 3 + [None] + [0.0] * 3), 1.0) == 3

    def test_missing_then_dry_run(self):
        # missing days at the start do not create a spell
        assert longest_dry_spell(_series([None, None, 0.0, 0.0, 2.0, 0.0, 0.0]), 1.0) == 2

    def test_threshold_is_strict(self):
        # dry means < 1.0 mm: exactly 1.0 mm is a wet day
        assert longest_dry_spell(_series([0.5, 0.9, 1.0, 0.0, 0.0]), 1.0) == 2

    def test_all_missing(self):
        assert longest_dry_spell(_series([None] * 5), 1.0) == 0


class TestParsePowerMissingSentinel:
    def test_minus999_becomes_nan(self):
        doc = {"properties": {"parameter": {
            "PRECTOTCORR": {"20200101": 0.0, "20200102": -999.0, "20200103": 2.5},
            "T2M_MAX": {"20200101": 10.0, "20200102": -999.0, "20200103": 12.0},
            "T2M_MIN": {"20200101": 0.0, "20200102": -999.0, "20200103": 1.0},
        }}}
        df = parse_power(doc)
        assert df.loc["2020-01-02", "pr"] != df.loc["2020-01-02", "pr"]  # NaN
        assert df.loc["2020-01-03", "pr"] == 2.5
        assert df["pr"].isna().sum() == 1
