"""Tests: advisor engine consumes verified v2 pipeline outputs (data/processed/).

Covers:
- engine/scoring.py: v2-first Sen's-slope extraction + Theil-Sen/MBB trend stats
- engine/rag_assistant.py: compute_engine_context loading v2 files and
  surfacing MBB CI / significance / drought / AWC / rule_trace
- grounded synthesizer: confirmed vs unconfirmed rainfall-trend wording
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402

from engine import rag_assistant, scoring  # noqa: E402


def _v2_doc(code: str) -> dict:
    return json.loads((ROOT / "data" / "processed" / code / "indicators.json").read_text(encoding="utf-8"))


# ---- scoring.extract_sen_slope_decade: v2-first priority order ----

def test_sen_slope_prefers_v2_rainfall_trend_block():
    ind = {
        "rainfall_trend": {"sen_slope_mm_per_decade": -44.1},
        "sen_slope_mm_per_decade": -1.0,
        "climate_baseline": {"rainfall_trend_decade_mm": -2.0},
    }
    assert scoring.extract_sen_slope_decade(ind) == -44.1


def test_sen_slope_theilslopes_per_year_times_ten():
    ind = {"rainfall_trend": {"theilslopes_slope_per_year": -1.6812}}
    assert scoring.extract_sen_slope_decade(ind) == pytest.approx(-16.812)


def test_sen_slope_slope_mm_per_decade_alias():
    ind = {"rainfall_trend": {"slope_mm_per_decade": -36.4}}
    assert scoring.extract_sen_slope_decade(ind) == -36.4


def test_sen_slope_legacy_v1_fallback_unchanged():
    assert scoring.extract_sen_slope_decade({"climate_baseline": {"rainfall_trend_decade_mm": -44.1}}) == -44.1
    assert scoring.extract_sen_slope_decade({"sen_slope_mm_per_decade": -7.5}) == -7.5
    assert scoring.extract_sen_slope_decade({}) == 0.0


# ---- scoring.extract_trend_stats: MBB CI normalization ----

def test_trend_stats_per_year_ci_converted_to_decade():
    ind = {
        "rainfall_trend": {
            "theilslopes_slope_per_year": -4.4138,
            "mbb_ci_low_95_per_year": -7.4065,
            "mbb_ci_high_95_per_year": -1.1824,
            "statistically_significant_95": True,
            "window": "1995-2024",
        }
    }
    ts = scoring.extract_trend_stats(ind)
    assert ts["sen_slope_mm_per_decade"] == pytest.approx(-44.138, abs=0.01)
    assert ts["mbb_ci_low_95_per_decade"] == pytest.approx(-74.065, abs=0.01)
    assert ts["mbb_ci_high_95_per_decade"] == pytest.approx(-11.824, abs=0.01)
    assert ts["statistically_significant_95"] is True
    assert ts["trend_source"] == "v2_rainfall_trend"


def test_trend_stats_legacy_source_when_v2_absent():
    ts = scoring.extract_trend_stats({"climate_baseline": {"rainfall_trend_decade_mm": -44.1}})
    assert ts["trend_source"] == "legacy_v1"
    assert ts["mbb_ci_low_95_per_decade"] is None
    assert ts["statistically_significant_95"] is False


# ---- rag_assistant.compute_engine_context: real v2 pipeline files ----

def test_engine_context_uses_v2_setif_statistics():
    ctx = rag_assistant.compute_engine_context("regionA")
    ts = ctx["v2_statistics"]
    # Verified values from data/processed/setif/indicators.json
    assert ts["trend_source"] == "v2_rainfall_trend"
    assert ts["trend_window"] == "1995-2024"
    assert ts["sen_slope_mm_per_decade"] == pytest.approx(-44.1)
    assert ts["mbb_ci_low_95_per_decade"] == pytest.approx(-74.1)
    assert ts["mbb_ci_high_95_per_decade"] == pytest.approx(-11.8)
    assert ts["statistically_significant_95"] is True
    # The v2 slope must flow into the scoring stress block
    assert ctx["stress"]["sen_slope_mm_per_decade"] == pytest.approx(-44.1)
    # v2 extras: drought z-scores, AWC, rule trace, data quality
    assert ts["drought"]["severe_drought_years"] == [2000, 2001, 2024]
    assert ts["drought"]["drought_frequency_pct"] == pytest.approx(10.0)
    assert ts["awc"]["awc_mm_per_m"] == pytest.approx(140.6)
    assert "water_stress" in ts["rule_trace"]
    assert ts["data_quality"]["spatial_caveat"]


def test_engine_context_setif_rainfall_from_v2_file():
    ctx = rag_assistant.compute_engine_context("regionA")
    # v2 pipeline rainfall (2015-2024 mean: 509.0 mm), not the v1 snapshot (484.5 mm)
    assert ctx["indicators"]["rainfall_mm"] == pytest.approx(509.0)
    assert ctx["v2_statistics"]["pipeline_code"] == "setif"


def test_engine_context_unconfirmed_tiaret_statistics():
    ctx = rag_assistant.compute_engine_context("tiaret")
    ts = ctx["v2_statistics"]
    assert ts["pipeline_code"] == "tiaret"
    assert ts["trend_source"] == "v2_rainfall_trend"
    assert ts["sen_slope_mm_per_decade"] == pytest.approx(-16.8)
    assert ts["mbb_ci_low_95_per_decade"] == pytest.approx(-95.2)
    assert ts["mbb_ci_high_95_per_decade"] == pytest.approx(61.7)
    assert ts["statistically_significant_95"] is False
    assert len(ts["drought"]["severe_drought_years"]) == 7
    assert ts["awc"]["awc_mm_per_m"] == pytest.approx(140.6)


def test_engine_summary_surfaces_v2_statistics():
    ctx = rag_assistant.compute_engine_context("regionA")
    summary = rag_assistant._format_engine_summary(ctx)
    v2 = summary["v2_statistics"]
    assert v2["rainfall_trend_mm_per_decade"] == pytest.approx(-44.1)
    assert v2["mbb_ci_low_95"] == pytest.approx(-74.1)
    assert v2["mbb_ci_high_95"] == pytest.approx(-11.8)
    assert v2["statistically_significant_95"] is True
    assert v2["drought_frequency_pct"] == pytest.approx(10.0)
    assert v2["severe_drought_years_count"] == 3
    assert v2["awc_mm_per_m"] == pytest.approx(140.6)


# ---- grounded synthesizer: confirmed vs unconfirmed trend wording ----

QUESTION = "Is rainfall declining over the years, and should I change my rotation?"


def test_synthesizer_reports_confirmed_trend_with_ci():
    ctx = rag_assistant.compute_engine_context("regionA")
    ans = rag_assistant._synthesize_grounded_answer(QUESTION, "en", [], ctx)
    assert "statistically confirmed" in ans.lower()
    assert "excludes zero" in ans
    assert "-74.1" in ans and "-11.8" in ans
    assert "-44.1 mm/decade" in ans


def test_synthesizer_flags_unconfirmed_trend_with_ci():
    ctx = rag_assistant.compute_engine_context("tiaret")
    ans = rag_assistant._synthesize_grounded_answer(QUESTION, "en", [], ctx)
    assert "not statistically confirmed" in ans.lower()
    assert "includes zero" in ans
    assert "-95.2" in ans and "61.7" in ans
    assert "-16.8 mm/decade" in ans


def test_synthesizer_french_confirmed_trend():
    ctx = rag_assistant.compute_engine_context("regionA")
    ans = rag_assistant._synthesize_grounded_answer(QUESTION, "fr", [], ctx)
    assert "statistiquement confirmée" in ans
    assert "-44.1 mm/décennie" in ans


# ---- answer_question end-to-end region routing ----

def test_answer_question_routes_tiaret_to_v2_outputs(monkeypatch):
    monkeypatch.setattr(rag_assistant, "_resolve_groq_api_key", lambda: "")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("RAG_LLM_PROVIDER", "local")
    out = rag_assistant.answer_question(
        "What is the rainfall trend in Tiaret and is it significant?",
        region="regionA",
        lang="en",
    )
    assert out["engine_summary"]["v2_statistics"]["pipeline_code"] == "tiaret"
    assert out["engine_summary"]["v2_statistics"]["statistically_significant_95"] is False
    assert out["refused"] is False
