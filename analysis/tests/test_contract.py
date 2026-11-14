"""Contract tests: no -999 in outputs, key checks against docs/data_contract.md,
and byte-identical rebuild from the same raw inputs."""
import json
import re
from pathlib import Path

import pytest

from build_indicators import build_region, load_thresholds

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
RAW = ROOT / "data" / "raw"
CONTRACT = ROOT / "docs" / "data_contract.md"

regions = ["setif", "constantine", "tiaret"]


def _walk_no_sentinel(node, path=""):
    if isinstance(node, dict):
        for k, v in node.items():
            _walk_no_sentinel(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _walk_no_sentinel(v, f"{path}[{i}]")
    elif isinstance(node, (int, float)) and not isinstance(node, bool):
        assert node > -900, f"-999 sentinel leaked into output at {path}"


@pytest.mark.parametrize("code", regions)
def test_no_minus999_in_processed_outputs(code):
    if not (PROCESSED / code).exists():
        pytest.skip("data/processed not built yet")
    for f in (PROCESSED / code).glob("*.json"):
        _walk_no_sentinel(json.loads(f.read_text(encoding="utf-8")), f"{code}/{f.name}")


def _contract_schema():
    text = CONTRACT.read_text(encoding="utf-8")
    m = re.search(r"```json\n(\{[^`]*indicators_required_keys[^`]*\})\n```", text, re.DOTALL)
    assert m, "machine-readable schema block missing from docs/data_contract.md"
    return json.loads(m.group(1))


@pytest.mark.parametrize("code", regions)
def test_indicators_schema_matches_contract(code):
    if not (PROCESSED / code / "indicators.json").exists():
        pytest.skip("indicators.json not built yet")
    doc = json.loads((PROCESSED / code / "indicators.json").read_text(encoding="utf-8"))
    required = _contract_schema()["indicators_required_keys"]
    for key in required:
        assert key in doc, f"missing contract key {key}"
    # no undocumented extra top-level keys
    extra = set(doc) - set(required) - {"run_date"}
    assert not extra, f"undocumented top-level keys: {sorted(extra)}"


@pytest.mark.parametrize("code", regions)
def test_climate_files_keys(code):
    if not (PROCESSED / code / "climate_yearly.json").exists():
        pytest.skip("climate_yearly.json not built yet")
    yearly = json.loads((PROCESSED / code / "climate_yearly.json").read_text(encoding="utf-8"))
    assert yearly["region"] == code
    assert yearly["rows"], "climate_yearly rows empty"
    for row in yearly["rows"]:
        assert {"region", "year", "annual_rain_mm", "growing_season_rain_mm",
                "growing_season_partial", "hot_days_grain_filling", "frost_days_late_frost",
                "extreme_rain_days", "longest_dry_spell_growing_season_days",
                "days_missing"} <= set(row)
        assert 1995 <= row["year"] <= 2024
    monthly = json.loads((PROCESSED / code / "climate_monthly.json").read_text(encoding="utf-8"))
    assert len(monthly["monthly_rain_mm"]) == 12
    assert len(monthly["rows"]) == 30 * 12
    for row in monthly["rows"]:
        assert {"region", "year", "month", "rain_mm", "days_missing"} <= set(row)
        assert 1 <= row["month"] <= 12


@pytest.mark.parametrize("code", regions)
def test_suggested_priorities_sum_and_keys(code):
    if not (PROCESSED / code / "indicators.json").exists():
        pytest.skip("indicators.json not built yet")
    doc = json.loads((PROCESSED / code / "indicators.json").read_text(encoding="utf-8"))
    p = doc["suggested_priorities"]
    assert sum(p[k] for k in ("save_water", "protect_soil", "yield_")) == 100
    assert "yield_" in p and "yield" not in p


@pytest.mark.parametrize("code", regions)
def test_same_input_same_output(code, tmp_path):
    if not (RAW / code / "power_daily.json").exists():
        pytest.skip("data/raw not present on this machine")
    thr = load_thresholds()
    out1, out2 = tmp_path / "a", tmp_path / "b"
    build_region(code, RAW / code, out1, thr, stamp="test")
    build_region(code, RAW / code, out2, thr, stamp="test")
    for name in ("climate_yearly.json", "climate_monthly.json", "indicators.json", "soil.json"):
        assert (out1 / name).read_bytes() == (out2 / name).read_bytes(), f"{name} not byte-identical"


def test_thresholds_sha_recorded():
    if not (PROCESSED / "setif" / "indicators.json").exists():
        pytest.skip("indicators.json not built yet")
    doc = json.loads((PROCESSED / "setif" / "indicators.json").read_text(encoding="utf-8"))
    thr = load_thresholds()
    assert doc["thresholds_used"]["sha256_16"] == thr["_sha256"]
