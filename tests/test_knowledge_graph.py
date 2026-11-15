"""Tests: JSON-backed agronomy Knowledge Graph (engine/build_graph.py + rag_assistant fusion).

Covers serialization of v2 pipeline outputs into graph nodes/edges, multi-hop
traversal accuracy, and fusion into the advisor context / deterministic answer.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402

from engine import build_graph, rag_assistant  # noqa: E402

GRAPH_PATH = ROOT / "data" / "processed" / "knowledge_graph.json"


@pytest.fixture(scope="module")
def graph():
    return build_graph.build_graph(GRAPH_PATH)


@pytest.fixture(scope="module")
def idx(graph):
    return {n["id"]: n for n in graph["nodes"]}


def _edges(graph, src=None, rel=None, dst=None):
    return [
        e for e in graph["edges"]
        if (src is None or e["src"] == src)
        and (rel is None or e["rel"] == rel)
        and (dst is None or e["dst"] == dst)
    ]


# ---- serialization ----

def test_graph_serialized_to_disk(graph):
    assert GRAPH_PATH.exists()
    doc = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
    assert doc["version"] == "1.0"
    assert doc["node_count"] == len(doc["nodes"]) == graph["node_count"]
    assert doc["edge_count"] == len(doc["edges"]) == graph["edge_count"]
    assert graph["node_count"] > 0 and graph["edge_count"] > 0


def test_region_nodes_from_all_pipeline_regions(idx):
    for code in ("setif", "tiaret", "constantine", "kansas", "punjab"):
        assert f"region:{code}" in idx
    attrs = idx["region:setif"]["attrs"]
    assert attrs["rainfall_mm"] == pytest.approx(509.0)
    assert "rule_trace" in attrs and attrs["rule_trace"]


def test_trend_nodes_carry_v2_statistics(idx):
    t_setif = idx["trend:setif"]["attrs"]
    assert t_setif["slope_mm_per_decade"] == pytest.approx(-44.1)
    assert t_setif["mbb_ci_low_95"] == pytest.approx(-74.1)
    assert t_setif["mbb_ci_high_95"] == pytest.approx(-11.8)
    assert t_setif["statistically_significant_95"] is True
    assert t_setif["window"] == "1995-2024"

    t_tiaret = idx["trend:tiaret"]["attrs"]
    assert t_tiaret["slope_mm_per_decade"] == pytest.approx(-16.8)
    assert t_tiaret["statistically_significant_95"] is False
    assert t_tiaret["mbb_ci_low_95"] == pytest.approx(-95.2)
    assert t_tiaret["mbb_ci_high_95"] == pytest.approx(61.7)


def test_soil_and_drought_nodes(idx):
    soil = idx["soil:setif"]["attrs"]
    assert soil["awc_mm_per_m"] == pytest.approx(140.6)
    assert soil["soc_g_per_kg"] == pytest.approx(12.52)
    assert soil["ph"] == pytest.approx(7.77)
    drought = idx["drought:setif"]["attrs"]
    assert drought["severe_drought_years"] == [2000, 2001, 2024]
    assert drought["drought_frequency_pct"] == pytest.approx(10.0)


def test_core_region_edges(graph):
    assert _edges(graph, "region:setif", "has_climate_trend", "trend:setif")
    assert _edges(graph, "region:setif", "has_soil", "soil:setif")
    assert _edges(graph, "region:setif", "experiences", "drought:setif")
    assert _edges(graph, "region:setif", "documented_by", "data_quality:setif")
    assert _edges(graph, "region:setif", "grows", "crop:wheat")
    assert _edges(graph, "region:tiaret", "agro_zone_peer", "region:setif")


def test_favors_crop_informed_by_rule_logic(graph, idx):
    # Drying-trend drought shift: slope <= -15 and drought tolerance >= 0.75
    favored_by_trend = {e["dst"] for e in _edges(graph, "trend:setif", "favors_crop")}
    assert favored_by_trend, "drying Sétif trend must favor drought-tolerant crops"
    for dst in favored_by_trend:
        assert idx[dst]["attrs"]["drought_tolerance"] >= 0.75
        assert idx[dst]["attrs"]["water_need"] <= 0.5 or idx[dst]["attrs"]["drought_tolerance"] >= 0.75
        assert all(e["attrs"].get("reason") for e in _edges(graph, "trend:setif", "favors_crop", dst))
    # Sétif trend (-44.1) must favor a strongly drought-tolerant crop (>= 85%)
    strongly = [d for d in favored_by_trend if idx[d]["attrs"]["drought_tolerance"] >= 0.85]
    assert strongly
    # SOC-deficit legume boost: n-fixing crop favored below SOC threshold
    favored_by_soil = {e["dst"] for e in _edges(graph, "soil:setif", "favors_crop")}
    assert favored_by_soil
    for dst in favored_by_soil:
        assert idx[dst]["attrs"]["nitrogen_fixing"] is True
    # Rainfall-envelope penalty edges exist where applicable and carry reasons
    stressed = _edges(graph, "region:setif", "stresses_crop")
    for e in stressed:
        assert e["attrs"].get("reason")


def test_crop_nodes_have_resilience_scores(idx):
    attrs = idx["crop:safflower"]["attrs"]
    expected = 0.6 * attrs["drought_tolerance"] + 0.4 * (1 - attrs["water_need"])
    assert attrs["resilience_score"] == pytest.approx(expected)
    for nid, node in idx.items():
        if nid.startswith("crop:"):
            a = node["attrs"]
            assert a["resilience_score"] == pytest.approx(0.6 * a["drought_tolerance"] + 0.4 * (1 - a["water_need"]))


def test_grows_edges_carry_suitability(graph):
    for e in _edges(graph, "region:setif", "grows"):
        assert "suitability_pct" in e["attrs"]
        assert 0.0 <= e["attrs"]["suitability_pct"] <= 100.0


# ---- multi-hop traversal ----

def test_traversal_from_region_reaches_peer_trends_at_hop_2():
    gc = rag_assistant.get_graph_context(["setif"], max_hops=2)
    assert gc["seeds"] == ["region:setif"]
    hop2 = [p for p in gc["paths"] if p["hop"] == 2]
    assert any(p["dst"] == "trend:tiaret" for p in hop2)
    assert any(p["src"] == "region:tiaret" and p["rel"] == "has_climate_trend" for p in hop2)


def test_traversal_crop_entity_reaches_regions_and_trends():
    gc = rag_assistant.get_graph_context(["safflower"], max_hops=2)
    assert gc["seeds"] == ["crop:safflower"]
    reached_regions = {p["src"] for p in gc["paths"] if p["direction"] == "in" and p["rel"] == "grows"}
    assert "region:setif" in reached_regions
    hop2 = [p for p in gc["paths"] if p["hop"] == 2]
    assert any(p["dst"] == "trend:setif" for p in hop2)


def test_traversal_comparison_between_two_regions():
    gc = rag_assistant.get_graph_context(["setif", "tiaret"], max_hops=2)
    assert set(gc["seeds"]) == {"region:setif", "region:tiaret"}
    assert gc["comparison"], "two region seeds must produce a structured comparison"
    comp = gc["comparison"][0]
    assert comp["slope_a_mm_per_decade"] == pytest.approx(-44.1)
    assert comp["slope_b_mm_per_decade"] == pytest.approx(-16.8)
    assert comp["significant_a"] is True
    assert comp["significant_b"] is False
    assert comp["a_label"] and comp["b_label"]


def test_traversal_unknown_entity_is_safe():
    gc = rag_assistant.get_graph_context(["nonexistent_entity_xyz"], max_hops=2)
    assert gc["seeds"] == [] and gc["lines"] == [] and gc["comparison"] == []


def test_alias_resolution_includes_concept_prefix_and_arabic():
    gc = rag_assistant.get_graph_context(["concept_lentil"], max_hops=1)
    assert gc["seeds"] == ["crop:lentil"]
    gc2 = rag_assistant.get_graph_context(["تيارت"], max_hops=1)
    assert gc2["seeds"] == ["region:tiaret"]


# ---- fusion into advisor context ----

def test_compute_engine_context_injects_graph(graph):
    ctx = rag_assistant.compute_engine_context("regionA", graph_entities=["setif", "wheat"])
    gc = ctx["graph_context"]
    assert gc["seeds"] == ["region:setif", "crop:wheat"]
    assert gc["lines"]
    # v2 statistics still present alongside the graph
    assert ctx["v2_statistics"]["statistically_significant_95"] is True


def test_engine_summary_embeds_knowledge_graph(graph):
    ctx = rag_assistant.compute_engine_context("regionA", graph_entities=["setif", "tiaret"])
    summary = rag_assistant._format_engine_summary(ctx)
    kg = summary["knowledge_graph"]
    assert kg["lines"]
    assert kg["comparison"]
    comp = kg["comparison"][0]
    assert comp["slope_a_mm_per_decade"] == pytest.approx(-44.1)


def test_answer_question_weaves_graph_and_rule_trace(monkeypatch, graph):
    monkeypatch.setattr(rag_assistant, "_resolve_groq_api_key", lambda: "")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("RAG_LLM_PROVIDER", "local")
    out = rag_assistant.answer_question(
        "Compare the rainfall trends of Sétif and Tiaret. Which one should worry me more?",
        region="regionA",
        lang="en",
    )
    assert out["refused"] is False
    ans = out["answer"]
    # graph relations + rule_trace woven into the deterministic answer
    assert "knowledge-graph relations" in ans.lower()
    assert "cross-region comparison" in ans.lower()
    assert "rule_trace" in ans.lower()
    # comparison content: both regions with slopes and significance wording
    assert "Sétif" in ans and "Tiaret" in ans
    assert "-44.1" in ans and "-16.8" in ans
    assert "NOT statistically confirmed" in ans
    # engine summary carries the structured graph block
    assert out["engine_summary"]["knowledge_graph"]["lines"]
