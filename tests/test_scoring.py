"""Tests + hand-calculation log for engine/scoring.py on LIVE Setif / Algeria data.

Run:  python3 tests/test_scoring.py      (writes logs/test_log.md)
Also pytest-compatible.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engine import scoring as S  # noqa: E402

W = {"profit": 0.4, "water": 0.2, "soil": 0.2, "risk": 0.2}
IND = json.loads((ROOT / "data" / "inputs" / "indicators.json").read_text())
ROT = ("wheat", "chickpea", "canola")
TOL = 1e-5

# Hand-calculated values on LIVE Setif telemetry (NASA POWER + ISRIC SoilGrids + FAO/ICARDA/ITGC crops).
HAND = [
    ("water_stress", 0.202863, lambda: S.derive_stress(IND)["water_stress"]),
    ("soc_deficit", 0.165333, lambda: S.derive_stress(IND)["soc_deficit"]),
    ("w_profit (norm)", 0.360211, lambda: S.adjust_weights(W, IND)["profit"]),
    ("w_water (norm)", 0.234911, lambda: S.adjust_weights(W, IND)["water"]),
    ("w_soil (norm)", 0.224772, lambda: S.adjust_weights(W, IND)["soil"]),
    ("w_risk (norm)", 0.180106, lambda: S.adjust_weights(W, IND)["risk"]),
    ("profit score", 0.700000, lambda: S.criterion_scores(ROT, CROPS)["profit"]),
    ("water score", 0.550000, lambda: S.criterion_scores(ROT, CROPS)["water"]),
    ("soil score", 0.623333, lambda: S.criterion_scores(ROT, CROPS)["soil"]),
    ("risk score", 0.623333, lambda: S.criterion_scores(ROT, CROPS)["risk"]),
    ("TOTAL", 0.633723, lambda: S._score(ROT, CROPS, S.adjust_weights(W, IND), IND)["score"]),
]
DATA = S.load_data()
CROPS = DATA["crops"]
EXISTING = ["wheat", "barley", "wheat"]


def worked_rows():
    rows = []
    for name, hand, fn in HAND:
        code = fn()
        rows.append((name, hand, code, abs(hand - code) <= TOL))
    return rows


def test_hand_calculation_matches_code():
    assert all(ok for *_, ok in worked_rows())


def test_existing_scored_without_filter():
    r = S.recommend(W, IND, EXISTING)
    ex = r["strategies"][0]
    assert ex["label"] == "existing" and ex["rotation"] == EXISTING
    assert ex["passes_rules"] is False  # repeats wheat, so rules would reject it
    assert ex["score"] > 0


def test_at_least_three_distinct_strategies():
    r = S.recommend(W, IND, EXISTING)
    strategies = r["strategies"]
    assert 3 <= len(strategies) <= 4
    keys = [S.distinct_key(s["rotation"]) for s in strategies]
    assert len(set(keys)) == len(keys)


def test_alternatives_pass_rules_and_are_sorted():
    r = S.recommend(W, IND, EXISTING)
    alts = r["strategies"][1:]
    assert all(S.passes_rules(tuple(a["rotation"]), CROPS, DATA["rules"]) for a in alts)
    assert [a["score"] for a in alts] == sorted((a["score"] for a in alts), reverse=True)


def test_weights_shift_with_stress():
    dry = S.adjust_weights(W, dict(IND, rainfall_mm=250))
    wet = S.adjust_weights(W, dict(IND, rainfall_mm=800))
    assert dry["water"] > wet["water"]
    assert abs(sum(dry.values()) - 1) < 1e-12


def test_explanations_present():
    for s in S.recommend(W, IND, EXISTING)["strategies"]:
        e = s["explanation"]
        assert e["evidence"] and e["benefits"] is not None and e["gaps"] and e["risks"]


def test_scenario_returns_baseline_and_shift():
    sc = S.scenario(W, IND, EXISTING, -30)
    assert abs(sc["rainfall_mm"] - IND["rainfall_mm"] * 0.7) < 1e-6
    assert sc["baseline"]["strategies"] and sc["scenario"]["strategies"]
    assert sc["scenario"]["stress"]["water_stress"] > sc["baseline"]["stress"]["water_stress"]


def test_hybrid_tags_trajectory_fertilizer_and_avoid():
    r = S.recommend(W, IND, EXISTING)
    top_alt = r["strategies"][1]
    assert top_alt["tags"] and any("Nitrogen" in t["label"] for t in top_alt["tags"])
    assert "env_match_pct" in top_alt["ml_metrics"] and "ai_confidence_pct" in top_alt["ml_metrics"]
    assert len(top_alt["trajectory_3yr"]["years"]) == 3
    assert top_alt["fertilizer_saved_vs_existing_kg_ha"] > 0
    assert r["rotations_to_avoid"] and r["rotations_to_avoid"][0]["reasons"]
    assert 0.0 <= r["ranking_stability_pct"] <= 100.0


def test_regional_crop_compatibility_gate():
    coriander = {"family": "oilseed", "rain_min": 280, "rain_max": 550, "ph_min": 6.2, "ph_max": 8.2, "frost_tolerant": 1, "heat_tolerant": 1}
    rice = {"family": "cereal", "rain_min": 1200, "rain_max": 2000, "ph_min": 5.5, "ph_max": 7.0, "frost_tolerant": 0, "heat_tolerant": 1}
    blueberry = {"family": "oilseed", "rain_min": 600, "rain_max": 1200, "ph_min": 4.5, "ph_max": 5.5, "frost_tolerant": 1, "heat_tolerant": 0}
    ok = S.check_crop_compatibility(coriander, IND)
    bad_rice = S.check_crop_compatibility(rice, IND)
    bad_blue = S.check_crop_compatibility(blueberry, IND)
    assert ok["compatible"] is True and ok["status"] == "compatible"
    assert bad_rice["compatible"] is False and any("Too dry" in b or "Frost hazard" in b for b in bad_rice["blockers"])
    assert bad_blue["compatible"] is False and any("Soil pH" in b for b in bad_blue["blockers"])


def test_load_region_inner_join_and_rules():
    reg_a = S.load_region("regionA", ROOT)
    reg_b = S.load_region("regionB", ROOT)
    reg_c = S.load_region("regionC", ROOT)
    assert reg_a["region_meta"]["role"] == "deep" and reg_a["region_meta"]["farming_system"] == "rainfed"
    assert reg_b["region_meta"]["role"] == "light" and reg_b["region_meta"]["country"] == "USA"
    assert reg_c["region_meta"]["role"] == "light" and reg_c["region_meta"]["farming_system"] == "irrigated"
    # Inner join check: regionB offers corn/soybean/sorghum, not rice; regionC offers rice/mung_bean, not sorghum
    assert {"wheat", "corn", "soybean", "sorghum"} <= set(reg_b["crops"].keys())
    assert "rice" not in reg_b["crops"]
    assert {"rice", "wheat", "maize", "mung_bean"} <= set(reg_c["crops"].keys())
    assert "sorghum" not in reg_c["crops"]


def test_fire_watch_snapshots_and_no_secrets():
    import json
    snap_a = json.loads((ROOT / "data" / "processed" / "regionA" / "fires_snapshot.json").read_text())
    snap_b = json.loads((ROOT / "data" / "processed" / "regionB" / "fires_snapshot.json").read_text())
    snap_c = json.loads((ROOT / "data" / "processed" / "regionC" / "fires_snapshot.json").read_text())
    assert snap_a["count"] == 2 and snap_a["nearest_km"] == 8.4 and "Not a forecast" in snap_a["notice"]
    assert snap_b["count"] == 0 and snap_b["detections"] == [] and "Not a forecast" in snap_b["notice"]
    assert snap_c["count"] == 3 and snap_c["nearest_km"] == 6.1 and "Not a forecast" in snap_c["notice"]
    bundle_txt = (ROOT / "frontend" / "src" / "data" / "realDataBundle.json").read_text()
    assert "FIRMS_MAP_KEY" not in bundle_txt


def write_log():
    rows = worked_rows()
    mism = [r for r in rows if not r[3]]
    lines = [
        "# Test log: hand calculation vs code (LIVE Setif / Algeria data — FOR YOUNES'S REVIEW)",
        "",
        "> Inputs are LIVE (NASA POWER 1995-2024 + ISRIC SoilGrids v2.0 0-30cm + ORNL MODIS MOD13Q1 + FAO/ICARDA/ITGC).",
        "",
        "## Worked example (Region A: Setif High Plateaux 36.15N, 5.38E)",
        "Rotation: wheat, chickpea, canola. Weights: profit .4, water .2, soil .2, risk .2.",
        "Live Indicators: rain 484.5 mm (20-yr ref 607.8 mm), SoilGrids SOC 12.52 g/kg (threshold 15.0). K_WATER = K_SOIL = 1.5.",
        "",
        "1. water_stress = (607.8 - 484.5) / 607.8 = 0.202863; soc_deficit = (15 - 12.52) / 15 = 0.165333",
        "2. w_water = 0.2 * (1 + 1.5 * 0.202863) = 0.260859; w_soil = 0.2 * (1 + 1.5 * 0.165333) = 0.249600",
        "3. Sum = 0.4 + 0.260859 + 0.249600 + 0.2 = 1.110459; normalise each by 1.110459",
        "4. profit = (.68 + .72 + .70) / 3 = 0.700000; water = 1 - (.52 + .35 + .48) / 3 = 0.550000",
        "5. soil = 0.5 * (.72 + .40 + .62) / 3 + 0.5 * min(1, 2 * (1/3)) = 0.290000 + 0.333333 = 0.623333",
        "6. risk = 1 - (.35 + .38 + .40) / 3 = 0.623333",
        "7. TOTAL = (.4*.70 + .260859*.55 + .249600*.623333 + .2*.623333) / 1.110459 = 0.633723",
        "",
        f"## Side by side (tolerance {TOL})",
        "| Quantity | Hand | Code | Status |",
        "|---|---|---|---|",
    ]
    for n, h, c, ok in rows:
        lines.append(f"| {n} | {h:.6f} | {c:.6f} | {'OK' if ok else '**MISMATCH**'} |")
    lines += ["", f"**Result: {'ALL MATCH' if not mism else str(len(mism)) + ' MISMATCH(ES), investigate'}**", ""]
    out = ROOT / "logs" / "test_log.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(lines))
    return out


def test_rag_multilingual_en_fr_ar():
    from engine import rag_assistant

    # 1. English end-to-end
    res_en = rag_assistant.answer_question(
        question="Why is my #1 recommended rotation scored highest and can we consider a 2-year or 4-year rotation period?",
        region="regionA",
        rotation=["wheat", "wheat", "barley"],
        allowed=["wheat", "barley", "lentil", "chickpea", "faba_bean", "canola"],
        priorities={"water": 50, "soil": 50, "profit": 50, "risk": 50},
    )
    assert res_en["language"] == "en", f"Expected en, got {res_en['language']}"
    assert res_en["direction"] == "ltr"
    assert res_en["refused"] is False
    assert len(res_en["sources"]) >= 1
    assert "doc_id" in res_en["sources"][0] and "section" in res_en["sources"][0]
    assert str(res_en["engine_summary"]["top_plan"]["score"]) in res_en["answer"]

    # 2. French end-to-end
    res_fr = rag_assistant.answer_question(
        question="Pourquoi mon plan classé premier obtient ce score et peut-on faire une rotation sur 2 ans ou 4 ans ?",
        region="regionA",
        rotation=["wheat", "wheat", "barley"],
        allowed=["wheat", "barley", "lentil", "chickpea", "faba_bean", "canola"],
        priorities={"water": 50, "soil": 50, "profit": 50, "risk": 50},
    )
    assert res_fr["language"] == "fr", f"Expected fr, got {res_fr['language']}"
    assert res_fr["direction"] == "ltr"
    assert res_fr["refused"] is False
    assert len(res_fr["sources"]) >= 1
    assert str(res_fr["engine_summary"]["top_plan"]["score"]) in res_fr["answer"]

    # 3. Arabic end-to-end (with diacritics & Alef variants to test normalization + RTL)
    res_ar = rag_assistant.answer_question(
        question="لِمَاذَا حصلت الخطة الأولى على أعلى نقاط وماذا عن فترة ٣ سنوات أو أربع سنوات؟",
        region="regionA",
        rotation=["wheat", "wheat", "barley"],
        allowed=["wheat", "barley", "lentil", "chickpea", "faba_bean", "canola"],
        priorities={"water": 50, "soil": 50, "profit": 50, "risk": 50},
    )
    assert res_ar["language"] == "ar", f"Expected ar, got {res_ar['language']}"
    assert res_ar["direction"] == "rtl"
    assert res_ar["refused"] is False
    assert len(res_ar["sources"]) >= 1
    assert str(res_ar["engine_summary"]["top_plan"]["score"]) in res_ar["answer"]


def test_rag_refusal_out_of_scope():
    from engine import rag_assistant

    # Out-of-scope chemical pesticide dosage in English, French, and Arabic
    res_en = rag_assistant.answer_question(
        question="What exact dosage of glyphosate herbicide in ml per hectare should I spray?",
        region="regionA",
    )
    assert res_en["refused"] is True
    assert res_en["language"] == "en"

    res_fr = rag_assistant.answer_question(
        question="Quelle dose exacte de pesticide glyphosate ou fongicide dois-je appliquer ?",
        region="regionB",
    )
    assert res_fr["refused"] is True
    assert res_fr["language"] == "fr"

    res_ar = rag_assistant.answer_question(
        question="ما هي جرعة مبيد الغليفوسات الكيميائي التي يجب رشها في الهكتار؟",
        region="regionC",
    )
    assert res_ar["refused"] is True
    assert res_ar["language"] == "ar"
    assert res_ar["direction"] == "rtl"


def test_rag_engine_score_grounding():
    from engine import scoring, rag_assistant

    allowed = ["wheat", "barley", "lentil", "chickpea", "faba_bean", "canola"]
    current_rot = ["wheat", "wheat", "barley"]
    priorities = {"water": 50, "soil": 50, "profit": 50, "risk": 50}

    ctx = rag_assistant.compute_engine_context(
        region_id="regionA",
        rotation=current_rot,
        allowed=allowed,
        priorities=priorities,
    )
    expected_top1 = ctx["rank1"]

    rag_res = rag_assistant.answer_question(
        question="Explain my rank 1 score, water and soil criteria, and 3-year NPK trajectory.",
        region="regionA",
        rotation=current_rot,
        allowed=allowed,
        priorities=priorities,
    )
    assert rag_res["refused"] is False
    top_summary = rag_res["engine_summary"]["top_plan"]
    assert top_summary["score"] == round(expected_top1["score"], 3)
    assert top_summary["crops"] == expected_top1["rotation"]
    assert top_summary["criteria"] == {k: round(v, 3) for k, v in expected_top1["criteria"].items()}
    assert top_summary["total_3yr_npk_kg_ha"] == expected_top1["trajectory_3yr"]["total_3yr_npk_kg_ha"]
    assert f"{expected_top1['score']:.3f}" in rag_res["answer"]
    assert f"{expected_top1['criteria']['water']:.3f}" in rag_res["answer"]
    assert f"{expected_top1['criteria']['soil']:.3f}" in rag_res["answer"]


def test_multi_period_rotation_lengths():
    from engine import scoring

    data = scoring.load_region("regionA")
    crops = data["crops"]
    rules_2yr = dict(data["rules"], rotation_length=2)
    rules_4yr = dict(data["rules"], rotation_length=4)

    assert scoring.passes_rules(["wheat", "lentil"], crops, rules_2yr) is True
    assert scoring.passes_rules(["wheat", "wheat"], crops, rules_2yr) is False
    assert scoring.passes_rules(["wheat", "lentil", "barley", "safflower"], crops, rules_4yr) is True
    assert scoring.passes_rules(["wheat", "lentil", "barley", "canola"], crops, rules_4yr) is False

    # Verify recommend() dynamically generates 2-year and 4-year recommendations when current_rotation length is 2 or 4
    rec_2yr = scoring.recommend(
        weights={"water": 0.25, "soil": 0.25, "profit": 0.25, "risk": 0.25},
        indicators=IND,
        current_rotation=["wheat", "lentil"],
        data=data,
        monte_carlo_runs=20,
    )
    assert len(rec_2yr["strategies"][1]["rotation"]) == 2

    rec_4yr = scoring.recommend(
        weights={"water": 0.25, "soil": 0.25, "profit": 0.25, "risk": 0.25},
        indicators=IND,
        current_rotation=["wheat", "lentil", "barley", "safflower"],
        data=data,
        monte_carlo_runs=20,
    )
    assert len(rec_4yr["strategies"][1]["rotation"]) == 4


def test_rag_question_first_and_region_independence():
    from engine import rag_assistant

    # 1. Asking about Kansas while UI region is regionA (Algeria) must switch context to regionB (Kansas)
    res_kansas = rag_assistant.answer_question(
        question="What are the best drought crops and scores in Western Kansas?",
        region="regionA",
    )
    assert res_kansas["refused"] is False
    assert res_kansas["engine_summary"]["region"] == "regionB"

    # 2. Asking about a specific crop (e.g., safflower & lentil) must answer with those crops' agronomic profiles
    res_crop = rag_assistant.answer_question(
        question="Tell me about safflower and lentil water need and nitrogen fixation.",
        region="regionA",
    )
    assert res_crop["refused"] is False
    assert "safflower" in res_crop["answer"].lower()
    assert "lentil" in res_crop["answer"].lower()
    assert rag_assistant._resolve_groq_api_key().startswith("gsk_")


def test_postgres_farmer_accounts():
    import uuid
    from engine import postgres_accounts

    unique_email = f"farmer_{uuid.uuid4().hex[:8]}@fieldshift.org"
    reg = postgres_accounts.register_farmer(
        full_name="Karim Benali",
        email=unique_email,
        password="securePassword123",
        farm_name="Ferme Sétif",
        default_region="regionA",
        preferred_lang="fr",
        farm_size_ha=25.0,
    )
    assert reg["farmer"]["email"] == unique_email
    assert reg["token"]
    farmer_id = reg["farmer"]["id"]

    # Login verification
    login = postgres_accounts.login_farmer(unique_email, "securePassword123")
    assert login["farmer"]["id"] == farmer_id

    # Save a 4-year farm plan
    saved = postgres_accounts.save_farm_plan(
        farmer_id=farmer_id,
        plan_name="Sétif 4-Year Rotation",
        region="regionA",
        rotation=["wheat", "lentil", "barley", "safflower"],
        allowed_crops=["wheat", "lentil", "barley", "safflower", "chickpea"],
        priorities={"water": 40, "soil": 35, "yield": 25},
        scenario={"rain": -15, "temp": 1.5},
        top_score=82.0,
    )
    assert len(saved["plans"]) == 1
    assert len(saved["plans"][0]["rotation"]) == 4
    plan_id = saved["plans"][0]["id"]

    # Delete saved plan
    remaining = postgres_accounts.delete_farm_plan(farmer_id, plan_id)
    assert len(remaining) == 0


def test_four_judge_problematics_dynamic_crops_and_rule_trace():
    from engine import scoring

    data = scoring.load_region("regionA")
    crops = data["crops"]
    w = {"water": 0.35, "soil": 0.30, "profit": 0.20, "risk": 0.15}

    # Problematic 1: Dynamic crop scoring responds to Sen's Slope drying velocity & rainfall drop
    drier_ind = dict(
        IND,
        rainfall_mm=340.0,
        sen_slope_mm_per_decade=-55.0,
    )
    ranked_crops = scoring.rank_dynamic_crops(crops, w, drier_ind)
    by_id = {c["crop_id"]: c for c in ranked_crops}
    assert "barley" in by_id and "wheat" in by_id
    # Under severe drying velocity (-55 mm/decade) and low rainfall (340 mm), drought-tolerant Barley outranks Wheat
    assert by_id["barley"]["suitability_score"] > by_id["wheat"]["suitability_score"]
    assert by_id["barley"]["confidence_pct"] > 0
    assert "Sen's Slope" in by_id["barley"]["rule_trace"] or "drought" in by_id["barley"]["rule_trace"].lower()

    # Problematic 4: Plain-English rule trace generated on every recommended strategy
    rec = scoring.recommend(w, IND, ["wheat", "barley", "wheat"], data=data, monte_carlo_runs=20)
    assert "crop_rankings" in rec and len(rec["crop_rankings"]) >= 5
    rank1 = rec["strategies"][1]
    assert "rule_trace" in rank1 and rank1["rule_trace"].startswith("Ranked #1 because")
    assert "soil organic carbon" in rank1["rule_trace"]


if __name__ == "__main__":
    failed = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            try:
                fn()
                print("PASS", name)
            except AssertionError:
                failed += 1
                print("FAIL", name)
    print("log:", write_log())
    sys.exit(1 if failed else 0)
