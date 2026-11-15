"""Tests for the step 5 gap patch: AWC pedotransfer, data_quality.json,
historical drought stats, and rule_trace justifications."""
import json
from pathlib import Path

import pytest

from build_indicators import (
    awc_from_texture,
    awc_saxton_rawls,
    build_region,
    drought_stats,
    load_thresholds,
)

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
RAW = ROOT / "data" / "raw"
regions = ["setif", "constantine", "tiaret"]


class TestSaxtonRawlsPtf:
    def test_plausible_bands_for_silt_loam(self):
        # silt loam ~ silt 60%, sand 20%, clay 20%, SOM 2% -> literature AWC ~ 150-220 mm/m
        theta33, theta1500 = awc_saxton_rawls(0.20, 0.20, 2.0)
        assert theta1500 < theta33
        assert 0.05 < theta33 < 0.45
        assert 0.02 < theta1500 < 0.30
        assert 100.0 < (theta33 - theta1500) * 1000.0 < 250.0

    def test_sandy_soil_has_low_awc(self):
        theta33, theta1500 = awc_saxton_rawls(0.90, 0.05, 1.0)
        assert (theta33 - theta1500) * 1000.0 < 120.0  # sandy soils hold little plant-available water

    def test_clay_soil_wilting_point_high(self):
        theta33_clay, theta1500_clay = awc_saxton_rawls(0.10, 0.55, 2.0)
        theta33_sand, theta1500_sand = awc_saxton_rawls(0.90, 0.05, 2.0)
        assert theta1500_clay > theta1500_sand  # clay holds water too tightly for plants

    def test_more_organic_matter_raises_field_capacity(self):
        fc_low_om, _ = awc_saxton_rawls(0.40, 0.25, 1.0)
        fc_high_om, _ = awc_saxton_rawls(0.40, 0.25, 3.0)
        assert fc_high_om >= fc_low_om

    def test_output_volumetric_fraction_bounded(self):
        theta33, theta1500 = awc_saxton_rawls(0.05, 0.60, 2.0)  # heavy clay edge of validity
        assert 0.0 < theta1500 < theta33 < 1.0


def _texture_doc(sand_pct: float, silt_pct: float, clay_pct: float, unit: str = "g/kg") -> dict:
    """percent values -> SoilGrids-style payload (g/kg = percent x 10)."""
    scale = 10.0 if unit == "g/kg" else 1.0
    return {
        "properties": {"layers": [
            {"name": name, "units": unit,
             "depths": [{"label": k, "values": {"mean": val * scale}}
                        for k in ("0-5cm", "5-15cm", "15-30cm")]}
            for name, val in (("sand", sand_pct), ("silt", silt_pct), ("clay", clay_pct))
        ]},
    }


class TestAwcFromTexture:
    def test_missing_file_returns_none(self, tmp_path):
        assert awc_from_texture(tmp_path, 12.52) is None

    def test_g_per_kg_units_weighted(self, tmp_path):
        (tmp_path / "soilgrids_texture.json").write_text(
            json.dumps(_texture_doc(20.0, 60.0, 20.0)), encoding="utf-8")
        awc = awc_from_texture(tmp_path, 12.52)
        assert awc["awc_is_estimate"] is True
        assert "extra caution" not in awc["awc_check"]
        assert awc["organic_matter_pct"] == pytest.approx(12.52 / 10.0 * 1.724, abs=0.01)
        # equal texture in all three layers -> depth weighting is a no-op
        uniform = awc_saxton_rawls(0.20, 0.20, 12.52 / 10.0 * 1.724)
        assert awc["awc_mm_per_m"] == pytest.approx((uniform[0] - uniform[1]) * 1000.0, abs=0.2)

    def test_percent_units_accepted(self, tmp_path):
        (tmp_path / "soilgrids_texture.json").write_text(
            json.dumps(_texture_doc(20.0, 60.0, 20.0, unit="percent")), encoding="utf-8")
        a = awc_from_texture(tmp_path, 12.52)
        (tmp_path / "soilgrids_texture.json").write_text(
            json.dumps(_texture_doc(20.0, 60.0, 20.0)), encoding="utf-8")
        b = awc_from_texture(tmp_path, 12.52)
        assert a["awc_mm_per_m"] == pytest.approx(b["awc_mm_per_m"], abs=0.05)

    def test_texture_sum_check_note(self, tmp_path):
        (tmp_path / "soilgrids_texture.json").write_text(
            json.dumps(_texture_doc(60.0, 30.0, 50.0)),  # sums 140% -> caution note
            encoding="utf-8")
        awc = awc_from_texture(tmp_path, 12.52)
        assert "extra caution" in awc["awc_check"]


class TestDroughtStats:
    YEARS = [1995, 1996, 1997, 1998, 1999]

    def test_known_answer_boundary_inclusive(self):
        annual = {1995: 300.0, 1996: 400.0, 1997: 500.0}
        d = drought_stats([1995, 1996, 1997], annual)
        assert d["mean_mm"] == pytest.approx(400.0, abs=0.1)
        assert d["std_mm"] == pytest.approx(100.0, abs=0.1)
        assert d["severe_boundary_mm"] == pytest.approx(300.0, abs=0.1)
        # z(300) = -1.0 exactly -> boundary is inclusive (WMO "severely dry" <= -1)
        assert d["severe_drought_years"] == [1995]
        assert d["drought_frequency_pct"] == pytest.approx(100.0 / 3.0, abs=0.1)

    def test_shock_year_below_boundary(self):
        annual = {1995: 400.0, 1996: 400.0, 1997: 400.0, 1998: 400.0, 1999: 200.0}
        d = drought_stats(self.YEARS, annual)
        assert d["severe_drought_years"] == [1999]
        assert d["drought_frequency_pct"] == pytest.approx(20.0, abs=0.1)
        assert d["n_years"] == 5

    def test_zscores_cover_all_years(self):
        annual = {1995: 300.0, 1996: 400.0, 1997: 500.0}
        d = drought_stats([1995, 1996, 1997], annual)
        assert set(d["zscore_by_year"]) == {"1995", "1996", "1997"}
        assert sum(d["zscore_by_year"].values()) == pytest.approx(0.0, abs=1e-6)  # z-scores are centered

    def test_no_severe_years_when_flat(self):
        annual = {y: 400.0 for y in self.YEARS}
        d = drought_stats(self.YEARS, annual)
        assert d["severe_drought_years"] == []  # std = 0 -> no drought flagged, no crash
        assert d["drought_frequency_pct"] == 0.0

    def test_method_and_confidence_documented(self):
        annual = {y: 400.0 for y in self.YEARS}
        d = drought_stats(self.YEARS, annual)
        assert "z <= -1.0" in d["method"] and "pending Younes" in d["method"]
        assert d["confidence"] == "medium"


def _region_harness(code, tmp_path):
    if not (RAW / code / "power_daily.json").exists():
        pytest.skip("data/raw not present on this machine")
    out = tmp_path / code
    ind = build_region(code, RAW / code, out, load_thresholds(), stamp="test")
    return ind, out


@pytest.mark.parametrize("code", regions)
class TestRegionalGapPatch:
    def test_drought_block_in_indicators(self, code, tmp_path):
        ind, _ = _region_harness(code, tmp_path)
        d = ind["historical_drought"]
        assert 0.0 <= d["drought_frequency_pct"] <= 100.0
        assert isinstance(d["severe_drought_years"], list)
        assert all(1995 <= y <= 2024 for y in d["severe_drought_years"])
        assert set(d["severe_drought_years"]) == {int(y) for y, z in d["zscore_by_year"].items() if z <= -1.0}

    def test_soil_water_capacity_flagged_as_estimate(self, code, tmp_path):
        ind, _ = _region_harness(code, tmp_path)
        swc = ind["soil_water_capacity"]
        if swc["awc_mm_per_m"] is not None:
            assert swc["awc_is_estimate"] is True
            assert 50.0 <= swc["awc_mm_per_m"] <= 300.0  # plausible AWC band for semi-arid soils
        else:
            assert swc["confidence"] == "unavailable"  # texture fetch failed -> no value invented
        soil = json.loads((PROCESSED / code / "soil.json").read_text(encoding="utf-8"))
        if swc["awc_mm_per_m"] is not None:
            assert soil["awc_is_estimate"] is True
            assert soil["awc_mm_per_m"] == swc["awc_mm_per_m"]

    def test_rule_trace_present_and_plain_english(self, code, tmp_path):
        ind, _ = _region_harness(code, tmp_path)
        trace = ind["rule_trace"]
        for key in ("water_stress", "organic_carbon", "rainfall_trend", "hot_days",
                    "frost_days", "extreme_rain_days", "longest_dry_spell_days",
                    "historical_drought", "suggested_priorities", "soil_water_capacity"):
            assert key in trace and isinstance(trace[key], str) and len(trace[key]) > 20
        # the trace must cite the numbers stored in the same file
        assert f"{ind['organic_carbon']['g_per_kg']} g/kg" in trace["organic_carbon"]
        assert str(ind["hot_days"]["value"]) in trace["hot_days"]
        assert str(ind["frost_days"]["value"]) in trace["frost_days"]

    def test_data_quality_json_contract(self, code, tmp_path):
        _, out = _region_harness(code, tmp_path)
        dq = json.loads((out / "data_quality.json").read_text(encoding="utf-8"))
        names = [s["name"] for s in dq["sources"]]
        assert set(names) == {"NASA POWER", "Open-Meteo ERA5 archive",
                              "ISRIC SoilGrids v2.0", "MODIS MOD13Q1 (ORNL DAAC)"}
        for src in dq["sources"]:
            assert src["spatial_resolution"] and src["observation_window"]
        power = next(s for s in dq["sources"] if s["name"] == "NASA POWER")
        assert all(0.0 <= v <= 100.0 for v in power["missing_value_rate_pct"].values())
        caveat = dq["spatial_caveat"].lower()
        assert "statistical confidence" in caveat and "representativeness" in caveat
        assert "0.5 deg" in dq["sources"][0]["spatial_resolution"]
        assert "250 m" in dq["sources"][2]["spatial_resolution"]
