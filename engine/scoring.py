"""Crop rotation recommendation engine v2 + Hybrid ML & Soil State Simulator.

Integrates:
  - Deterministic multi-criteria scoring + rules filter (v2 baseline)
  - CropSense pairwise transition features, environmental match %, and agronomic tags
  - CropSense "rotations/crops to avoid" diagnostics
  - DharaaAI 3-year stateful soil nitrogen/health trajectory & NPK fertilizer calculator
  - Monte Carlo ranking stability runner

Public API:
    recommend(weights, indicators, current_rotation) -> dict
    scenario(weights, indicators, current_rotation, rainfall_pct) -> dict
"""
from __future__ import annotations

import csv
import itertools
import json
import math
import random
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "inputs"

# ---- Weight adjustment rule (visible, tunable) -----------------------------
# water_stress = clamp((rain_ref - rain) / rain_ref, 0, 1)
# soc_deficit  = clamp((soc_threshold - soc) / soc_threshold, 0, 1)
# w_water' = w_water * (1 + K_WATER * water_stress)
# w_soil'  = w_soil  * (1 + K_SOIL  * soc_deficit)
# then all weights are renormalised to sum to 1.
K_WATER = 1.5
K_SOIL = 1.5

CRITERIA = ("profit", "water", "soil", "risk")
MAX_ALTERNATIVES = 3
MIN_ALTERNATIVES = 2

# Enriched metadata defaults (inspired by CropSense crop_metadata.csv & DharaaAI crop-rotation.ts)
DEFAULT_ENRICHED = {
    "wheat":     {"depletion": 3, "n_impact": -30, "health_delta": -10, "npk_base": 220, "fert_name": "NPK 10:26:26", "rain_opt": (350, 750)},
    "barley":    {"depletion": 2, "n_impact": -20, "health_delta": -6,  "npk_base": 170, "fert_name": "NPK 10:26:26", "rain_opt": (280, 650)},
    "maize":     {"depletion": 4, "n_impact": -40, "health_delta": -18, "npk_base": 270, "fert_name": "NPK 20:10:10", "rain_opt": (500, 1100)},
    "chickpea":  {"depletion": 1, "n_impact": +22, "health_delta": +16, "npk_base": 110, "fert_name": "DAP + MOP",    "rain_opt": (300, 650)},
    "lentil":    {"depletion": 1, "n_impact": +20, "health_delta": +15, "npk_base": 100, "fert_name": "DAP + MOP",    "rain_opt": (260, 600)},
    "sunflower": {"depletion": 3, "n_impact": -25, "health_delta": -8,  "npk_base": 180, "fert_name": "NPK 15:15:15", "rain_opt": (350, 750)},
}


# ---- Loading ---------------------------------------------------------------
def load_data(data_dir: Path = DATA_DIR) -> dict:
    with open(data_dir / "crops.csv", newline="") as f:
        crops = {}
        for r in csv.DictReader(f):
            name = r["crop"]
            fallback = DEFAULT_ENRICHED.get(name, {
                "depletion": 4 if float(r["water_need"]) >= 0.7 else (1 if int(r["nitrogen_fixing"]) else 3),
                "n_impact": +20 if int(r["nitrogen_fixing"]) else -30,
                "health_delta": +15 if int(r["nitrogen_fixing"]) else -10,
                "npk_base": 110 if int(r["nitrogen_fixing"]) else 210,
                "fert_name": "DAP + MOP" if int(r["nitrogen_fixing"]) else "NPK 10:26:26",
                "rain_opt": (300, 700),
            })
            extra = {
                "depletion": int(r["soil_depletion_index"]) if r.get("soil_depletion_index") else fallback["depletion"],
                "n_impact": int(r["n_impact_kg_ha"]) if r.get("n_impact_kg_ha") else fallback["n_impact"],
                "health_delta": int(r["soil_health_delta"]) if r.get("soil_health_delta") else fallback["health_delta"],
                "npk_base": int(r["base_npk_kg_ha"]) if r.get("base_npk_kg_ha") else fallback["npk_base"],
                "fert_name": r["fertilizer_name"] if r.get("fertilizer_name") else fallback["fert_name"],
                "rain_opt": (
                    (float(r["optimal_rain_min"]), float(r["optimal_rain_max"]))
                    if r.get("optimal_rain_min") and r.get("optimal_rain_max")
                    else fallback["rain_opt"]
                ),
                "oaic_ccls_price_dzd_q": int(r["oaic_ccls_price_dzd_q"]) if r.get("oaic_ccls_price_dzd_q") else 0,
                "baseline_yield_q_ha": float(r["baseline_yield_q_ha"]) if r.get("baseline_yield_q_ha") else 0.0,
                "gross_income_dzd_ha": int(r["gross_income_dzd_ha"]) if r.get("gross_income_dzd_ha") else 0,
                "ph_opt": (
                    (float(r["optimal_ph_min"]), float(r["optimal_ph_max"]))
                    if r.get("optimal_ph_min") and r.get("optimal_ph_max")
                    else (6.0, 8.2)
                ),
                "frost_tolerant": int(r["frost_tolerant"]) if r.get("frost_tolerant") else 1,
                "heat_tolerant": int(r["heat_tolerant"]) if r.get("heat_tolerant") else 1,
            }
            crops[name] = {
                "family": r["family"],
                "water_need": float(r["water_need"]),
                "nitrogen_fixing": int(r["nitrogen_fixing"]),
                "residue_carbon": float(r["residue_carbon"]),
                "drought_tolerance": float(r["drought_tolerance"]),
                "profit": float(r["profit"]),
                "risk_level": float(r["risk_level"]),
                "risk_note": r["risk_note"],
                **extra,
            }
    rules = json.loads((data_dir / "rules.json").read_text())
    gaps = json.loads((data_dir / "gaps.json").read_text())["gaps"]
    return {"crops": crops, "rules": rules, "gaps": gaps}


def load_region(region: str, root_dir: Path | None = None) -> dict:
    """Load region-specific crops (inner join of domain/crops_base.csv and
    domain/regions/<region>/yield.csv), rules, thresholds, and metadata (Section 2.5)."""
    root = root_dir or Path(__file__).resolve().parents[1]
    domain_dir = root / "domain"
    reg_dir = domain_dir / "regions" / region

    if not reg_dir.exists():
        raise ValueError(f"Unknown or unconfigured region: {region}")

    region_meta = {}
    regions_csv = domain_dir / "regions.csv"
    if regions_csv.exists():
        with regions_csv.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("region_id") == region or row.get("code") == region:
                    region_meta = dict(row)
                    break

    base_crops: dict[str, dict] = {}
    with (domain_dir / "crops_base.csv").open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            base_crops[r["crop"]] = r

    crops: dict[str, dict] = {}
    with (reg_dir / "yield.csv").open(newline="", encoding="utf-8") as f:
        for y in csv.DictReader(f):
            cid = y["crop"]
            if cid not in base_crops:
                continue  # inner join: must exist in both crops_base.csv and region yield.csv
            b = base_crops[cid]
            yld_pot = float(y.get("yield_potential") or 0.0)
            price_loc = int(float(y.get("price_local") or 0))
            income_ha = int(float(y.get("gross_income_ha") or round(yld_pot * price_loc)))
            crops[cid] = {
                "name": b.get("name", cid),
                "family": b["family"],
                "water_need": float(b["water_need"]),
                "soil_effect": float(b.get("soil_effect", 0.0)),
                "nitrogen_fixing": int(b["nitrogen_fixing"]),
                "residue_carbon": float(b["residue_carbon"]),
                "drought_tolerance": float(b["drought_tolerance"]),
                "profit": float(b["profit"]),
                "risk_level": float(b["risk_level"]),
                "risk_note": y.get("risk_note_local") or b["risk_note"],
                "depletion": int(b["soil_depletion_index"]),
                "n_impact": int(b["n_impact_kg_ha"]),
                "health_delta": int(b["soil_health_delta"]),
                "npk_base": int(b["base_npk_kg_ha"]),
                "fert_name": b["fertilizer_name"],
                "rain_opt": (float(b["optimal_rain_min"]), float(b["optimal_rain_max"])),
                "ph_opt": (float(b["optimal_ph_min"]), float(b["optimal_ph_max"])),
                "frost_tolerant": int(b["frost_tolerant"]),
                "heat_tolerant": int(b["heat_tolerant"]),
                "oaic_ccls_price_dzd_q": price_loc,
                "baseline_yield_q_ha": yld_pot,
                "yield_potential": yld_pot,
                "gross_income_dzd_ha": income_ha,
                "currency": y.get("currency", "DZD"),
                "source": y.get("source", ""),
            }

    rules = json.loads((reg_dir / "rules.json").read_text(encoding="utf-8"))
    thresholds_path = reg_dir / "thresholds.json"
    thresholds = json.loads(thresholds_path.read_text(encoding="utf-8")) if thresholds_path.exists() else {}
    gaps = json.loads((root / "data" / "inputs" / "gaps.json").read_text(encoding="utf-8"))["gaps"]
    return {
        "region": region,
        "region_meta": region_meta,
        "crops": crops,
        "rules": rules,
        "thresholds": thresholds,
        "gaps": gaps,
    }


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def check_crop_compatibility(crop_spec: dict, indicators: dict) -> dict:
    """Validate whether a candidate/custom crop can be planted in a given region."""
    rain = float(indicators.get("rainfall_mm", 484.5))
    cb = indicators.get("climate_baseline") or {}
    frost_days = float(indicators.get("frost_days", cb.get("frost_days", 0.0)))
    hot_days = float(indicators.get("hot_days", cb.get("hot_days", 0.0)))
    ph_val = float(indicators.get("ph", 7.6))

    rain_opt = crop_spec.get("rain_opt") or (300.0, 700.0)
    ph_opt = crop_spec.get("ph_opt") or (6.0, 8.2)
    r_min = float(crop_spec.get("rain_min", rain_opt[0]))
    r_max = float(crop_spec.get("rain_max", rain_opt[1]))
    ph_min = float(crop_spec.get("ph_min", ph_opt[0]))
    ph_max = float(crop_spec.get("ph_max", ph_opt[1]))
    frost_tolerant = int(crop_spec.get("frost_tolerant", 1))
    heat_tolerant = int(crop_spec.get("heat_tolerant", 1))
    family = str(crop_spec.get("family", "")).strip().lower()

    blockers = []
    warnings = []
    valid_families = {"cereal", "legume", "oilseed", "forage_broadleaf", "vegetable_root", "fallow"}
    if family and family not in valid_families:
        blockers.append(
            f"Unsupported crop family '{family}'. Choose one of: {', '.join(sorted(valid_families))}."
        )
    if rain < r_min * 0.90:
        blockers.append(
            f"Too dry for rainfed cultivation: crop needs >= {r_min:.0f} mm/yr, "
            f"while this region receives {rain:.1f} mm/yr."
        )
    elif rain < r_min:
        warnings.append(
            f"Marginal rainfall ({rain:.1f} mm vs {r_min:.0f} mm min) — plant early on deep moisture-retaining soil."
        )
    if rain > r_max + 200:
        blockers.append(
            f"Excess moisture risk: crop maximum is {r_max:.0f} mm/yr vs {rain:.1f} mm/yr."
        )
    if ph_val < ph_min - 0.3 or ph_val > ph_max + 0.3:
        blockers.append(
            f"Soil pH incompatible: crop needs pH {ph_min:.1f}-{ph_max:.1f}, "
            f"while SoilGrids reports pH {ph_val:.2f}."
        )
    elif ph_val < ph_min or ph_val > ph_max:
        warnings.append(
            f"Near soil pH boundary ({ph_val:.2f} vs {ph_min:.1f}-{ph_max:.1f}) — verify with parcel soil test."
        )
    if frost_tolerant == 0 and frost_days >= 5.0:
        blockers.append(
            f"Frost hazard: frost-sensitive crop cannot survive {frost_days:.1f} frost days/yr (< 0 C) here."
        )
    if heat_tolerant == 0 and hot_days >= 35.0:
        blockers.append(
            f"Heat stress hazard: crop cannot tolerate {hot_days:.1f} days/yr > 35 C in this region."
        )
    return {
        "compatible": len(blockers) == 0,
        "status": "blocked" if blockers else ("marginal" if warnings else "compatible"),
        "blockers": blockers,
        "warnings": warnings,
    }


# ---- Indicators and weights -----------------------------------------------
def extract_sen_slope_decade(indicators: dict) -> float:
    """Extract Sen's slope / decadal rainfall drying velocity (mm/decade) from indicators."""
    if "sen_slope_mm_per_decade" in indicators and indicators["sen_slope_mm_per_decade"] is not None:
        return float(indicators["sen_slope_mm_per_decade"])
    cb = indicators.get("climate_baseline") or {}
    if "rainfall_trend_decade_mm" in cb and cb["rainfall_trend_decade_mm"] is not None:
        return float(cb["rainfall_trend_decade_mm"])
    return 0.0


def derive_stress(indicators: dict) -> dict:
    rain, ref = indicators["rainfall_mm"], indicators["rainfall_reference_mm"]
    soc, thr = (indicators["soil_organic_carbon_g_per_kg"],
                indicators["soc_threshold_g_per_kg"])
    sen_slope = extract_sen_slope_decade(indicators)
    drying_velocity_stress = _clamp(max(0.0, -sen_slope) / 60.0)
    return {"water_stress": _clamp((ref - rain) / ref),
            "soc_deficit": _clamp((thr - soc) / thr),
            "sen_slope_mm_per_decade": round(sen_slope, 2),
            "drying_velocity_stress": round(drying_velocity_stress, 4)}


def score_single_crop(crop_id: str, crop: dict, weights: dict, indicators: dict) -> dict:
    """Dynamically evaluate a single crop against soil.json, indicators.json, and Sen's slope drying velocity."""
    st = derive_stress(indicators)
    rain = float(indicators.get("rainfall_mm", 484.5))
    soc = float(indicators.get("soil_organic_carbon_g_per_kg", 12.52))
    soc_thr = float(indicators.get("soc_threshold_g_per_kg", 15.0))
    ph_val = float(indicators.get("ph", 7.5))
    sen_decade = st["sen_slope_mm_per_decade"]
    drying_vel = st["drying_velocity_stress"]
    ws = st["water_stress"]

    r_min, r_max = crop.get("rain_opt", (300.0, 650.0))
    p_min, p_max = crop.get("ph_opt", (6.0, 8.2))
    drought_tol = float(crop.get("drought_tolerance", 0.5))
    water_need = float(crop.get("water_need", 0.5))
    n_fix = int(crop.get("nitrogen_fixing", 0))
    res_c = float(crop.get("residue_carbon", 0.4))
    profit_idx = float(crop.get("profit", 0.5))
    risk_lvl = float(crop.get("risk_level", 0.35))

    # Dynamic drought shift: when Sen's slope is negative (drying trend) or rainfall drops,
    # drought-tolerant low-water crops (e.g. Barley, Lentil, Safflower) gain advantage over thirstier varieties (e.g. Wheat).
    drought_pressure = _clamp(0.6 * ws + 0.4 * drying_vel)
    water_fit = (1.0 - water_need) * (1.0 - 0.35 * drought_pressure) + drought_tol * (0.35 * drought_pressure)
    soil_fit = 0.5 * res_c + 0.5 * float(n_fix)
    profit_fit = profit_idx
    risk_fit = (1.0 - risk_lvl) * (1.0 - 0.25 * drought_pressure) + drought_tol * (0.25 * drought_pressure)

    raw_score = (
        weights["water"] * water_fit
        + weights["soil"] * soil_fit
        + weights["profit"] * profit_fit
        + weights["risk"] * risk_fit
    )

    # Confidence score combining rainfall envelope fit, pH fit, and trend resilience
    if r_min <= rain <= r_max:
        rain_conf = 0.94
    else:
        dist = (r_min - rain) if rain < r_min else (rain - r_max)
        rain_conf = max(0.25, math.exp(-(dist / 210.0) ** 2))
    ph_conf = 0.95 if (p_min <= ph_val <= p_max) else max(0.40, 1.0 - 0.35 * min(abs(ph_val - p_min), abs(ph_val - p_max)))
    conf_pct = round(100.0 * _clamp(0.55 * rain_conf + 0.25 * ph_conf + 0.20 * drought_tol), 1)
    suitability_pct = round(100.0 * _clamp(raw_score), 1)

    # Plain-English rule trace for this individual crop
    if sen_decade <= -15.0 and drought_tol >= 0.75:
        trace = (
            f"Prioritized (+drought shift) because Sen's Slope drying velocity ({sen_decade:+.1f} mm/decade) "
            f"and {rain:.0f} mm rainfall favor high drought tolerance ({round(drought_tol*100)}%) and low water need ({round(water_need*100)}%)."
        )
    elif n_fix == 1 and soc < soc_thr:
        trace = (
            f"Boosted because SoilGrids SOC ({soc:.2f} g/kg) is below the {soc_thr:.0f} g/kg threshold; "
            f"biological N fixation ({crop.get('n_impact', 25):+d} kg N/ha) restores fertility."
        )
    elif rain < r_min:
        trace = (
            f"Penalized under current {rain:.0f} mm rainfall (below {r_min:.0f} mm optimal minimum) "
            f"with Sen's Slope {sen_decade:+.1f} mm/decade."
        )
    else:
        trace = (
            f"Matches regional envelope ({rain:.0f} mm vs {r_min:.0f}–{r_max:.0f} mm optimal, SoilGrids pH {ph_val:.2f}) "
            f"with {conf_pct:.0f}% agronomic confidence."
        )

    return {
        "crop_id": crop_id,
        "family": crop.get("family", ""),
        "suitability_score": round(raw_score, 4),
        "suitability_pct": suitability_pct,
        "confidence_pct": conf_pct,
        "water_need_pct": round(water_need * 100),
        "drought_tolerance_pct": round(drought_tol * 100),
        "n_impact_kg_ha": int(crop.get("n_impact", 0)),
        "rule_trace": trace,
    }


def rank_dynamic_crops(crops: dict, weights: dict, indicators: dict) -> list[dict]:
    """Deterministically score and rank all regional crops dynamically against soil, climate, and Sen's slope."""
    w = adjust_weights(weights, indicators)
    scored = [score_single_crop(cid, cspec, w, indicators) for cid, cspec in crops.items()]
    scored.sort(key=lambda x: (-x["suitability_score"], -x["confidence_pct"], x["crop_id"]))
    for idx, item in enumerate(scored, start=1):
        item["rank"] = idx
    return scored


def adjust_weights(weights: dict, indicators: dict) -> dict:
    """Apply the adjustment rule documented at the top of this module."""
    s = derive_stress(indicators)
    adj = dict(weights)
    adj["water"] = weights["water"] * (1 + K_WATER * s["water_stress"])
    adj["soil"] = weights["soil"] * (1 + K_SOIL * s["soc_deficit"])
    total = sum(adj[c] for c in CRITERIA)
    return {c: adj[c] / total for c in CRITERIA}


# ---- Rules and scoring -----------------------------------------------------
def passes_rules(rotation: tuple, crops: dict, rules: dict) -> bool:
    n = rules["rotation_length"]
    if len(rotation) != n:
        return False
    if any(rotation.count(c) > rules["max_occurrences_per_crop"] for c in rotation):
        return False
    pairs = list(zip(rotation, rotation[1:]))
    if rules.get("cyclic"):
        pairs.append((rotation[-1], rotation[0]))
    if rules["forbid_consecutive_same_family"] and any(
            crops[a]["family"] == crops[b]["family"] for a, b in pairs):
        return False
    if sum(crops[c]["nitrogen_fixing"] for c in rotation) < rules["min_legumes"]:
        return False
    high = sum(crops[c]["water_need"] >= rules["high_water_need_threshold"]
               for c in rotation)
    return high <= rules["max_high_water_crops"]


def criterion_scores(rotation: tuple, crops: dict) -> dict:
    """Each criterion in [0, 1], higher is better."""
    n = len(rotation)
    mean = lambda key: sum(crops[c][key] for c in rotation) / n
    return {
        "profit": mean("profit"),
        "water": 1 - mean("water_need"),
        "soil": 0.5 * mean("residue_carbon") + 0.5 * min(1.0, 2 * mean("nitrogen_fixing")),
        "risk": 1 - mean("risk_level"),
    }


def total_score(parts: dict, weights: dict) -> float:
    return sum(weights[c] * parts[c] for c in CRITERIA)


# ---- CropSense + DharaaAI Hybrid Extensions --------------------------------
def agronomic_tags(rotation: tuple | list, crops: dict) -> list[dict]:
    """Generate CropSense-style contextual agronomic tags for a 3-year sequence."""
    tags = []
    rot = list(rotation)
    pairs = list(zip(rot, rot[1:])) + [(rot[-1], rot[0])]

    if any(crops[c]["nitrogen_fixing"] == 1 for c in rot):
        tags.append({"label": "🌿 Restores Nitrogen", "kind": "good"})
    if any(crops[a]["depletion"] >= 3 and crops[b]["nitrogen_fixing"] == 1 for a, b in pairs):
        tags.append({"label": "✅ Ideal Rotation (Legume after Feeder)", "kind": "good"})
    if sum(crops[c]["water_need"] for c in rot) / len(rot) <= 0.42:
        tags.append({"label": "💧 Low Water", "kind": "good"})
    if sum(crops[c]["drought_tolerance"] for c in rot) / len(rot) >= 0.72:
        tags.append({"label": "☀️ Drought Tolerant", "kind": "good"})
    if sum(crops[c]["profit"] for c in rot) / len(rot) >= 0.60:
        tags.append({"label": "💰 High Profit", "kind": "good"})
    if any(crops[c]["depletion"] >= 4 for c in rot):
        tags.append({"label": "⚠️ Depletes Soil", "kind": "warn"})
    if any(a == b for a, b in zip(rot, rot[1:])) or len(set(rot)) < len(rot):
        tags.append({"label": "🚫 Monoculture / Repeat Risk", "kind": "bad"})
    elif any(crops[a]["family"] == crops[b]["family"] for a, b in pairs):
        tags.append({"label": "⚠️ Same-Family Carryover", "kind": "warn"})
    return tags


def ml_transition_and_env_scores(rotation: tuple | list, crops: dict,
                                 indicators: dict | None = None) -> dict:
    """Compute CropSense-inspired KNN environmental match % and pairwise RF transition confidence %."""
    rot = list(rotation)
    rain = (indicators or {}).get("rainfall_mm", 484.5)

    # Stage 1: Environmental compatibility (Gaussian envelope match over rainfall & drought tolerance)
    env_scores = []
    for c in rot:
        r_min, r_max = crops[c]["rain_opt"]
        if r_min <= rain <= r_max:
            env_scores.append(0.92)
        else:
            dist = (r_min - rain) if rain < r_min else (rain - r_max)
            env_scores.append(max(0.15, math.exp(-(dist / 220.0) ** 2)))
    env_match_pct = round(100.0 * sum(env_scores) / len(rot), 1)

    # Stage 2: Pairwise transition confidence (engineered features from CropSense pipeline.py)
    pairs = list(zip(rot, rot[1:])) + [(rot[-1], rot[0])]
    pair_probs = []
    for prev_c, cand_c in pairs:
        prev, cand = crops[prev_c], crops[cand_c]
        depletion_delta = (prev["depletion"] - cand["depletion"]) / 4.0
        n_restoration = 1.0 if (prev["depletion"] >= 3 and cand["nitrogen_fixing"] == 1) else 0.0
        family_break = 1.0 if prev["family"] != cand["family"] else -0.8
        same_crop_pen = -1.2 if prev_c == cand_c else 0.0
        logit = (
            0.65 * family_break
            + 0.75 * n_restoration
            + 0.35 * depletion_delta
            + 0.45 * cand["drought_tolerance"]
            + 0.35 * (1.0 - cand["water_need"])
            + same_crop_pen
        )
        prob = 1.0 / (1.0 + math.exp(-logit * 2.0))
        pair_probs.append(prob)

    ai_conf_pct = round(100.0 * sum(pair_probs) / len(pair_probs), 1)
    hybrid_blended_pct = round(0.70 * ai_conf_pct + 0.30 * env_match_pct, 1)
    return {
        "env_match_pct": env_match_pct,
        "ai_confidence_pct": ai_conf_pct,
        "hybrid_score_pct": hybrid_blended_pct,
    }


def simulate_3yr_trajectory(rotation: tuple | list, crops: dict,
                            indicators: dict | None = None) -> dict:
    """DharaaAI-inspired 3-year stateful simulation of soil nitrogen (kg/ha),
    soil health (%), and NPK fertilizer dosage (kg/ha) with legume nitrogen credit."""
    soc = (indicators or {}).get("soil_organic_carbon_g_per_kg", 12.52)
    current_n = round(45.0 + soc * 2.5, 1)  # baseline available N (kg/ha)
    current_health = round(_clamp(0.45 + (soc / 30.0)) * 100.0, 1)

    years_out = []
    total_npk = 0
    prev_was_legume = False

    for yr_idx, crop_name in enumerate(rotation, start=1):
        c = crops[crop_name]
        # Legume credit reduces next crop's synthetic fertilizer requirement by 30%
        dose_mult = 0.70 if prev_was_legume else (0.85 if current_n > 75 else 1.0)
        npk_dose = int(round(c["npk_base"] * dose_mult))
        total_npk += npk_dose

        current_n = round(max(15.0, current_n + c["n_impact"]), 1)
        current_health = round(max(20.0, min(100.0, current_health + c["health_delta"])), 1)

        years_out.append({
            "year": yr_idx,
            "crop": crop_name,
            "projected_nitrogen_kg_ha": current_n,
            "soil_health_pct": current_health,
            "fertilizer": c["fert_name"],
            "npk_dose_kg_ha": npk_dose,
            "legume_credit_applied": prev_was_legume,
        })
        prev_was_legume = bool(c["nitrogen_fixing"] == 1)

    return {
        "years": years_out,
        "final_nitrogen_kg_ha": current_n,
        "final_soil_health_pct": current_health,
        "total_3yr_npk_kg_ha": total_npk,
    }


def _score(rotation, crops, weights, indicators: dict | None = None) -> dict:
    parts = criterion_scores(tuple(rotation), crops)
    gross_income = round(
        sum(crops[c].get("gross_income_dzd_ha", 0) for c in rotation) / max(1, len(rotation))
    )
    return {
        "rotation": list(rotation),
        "criteria": parts,
        "score": total_score(parts, weights),
        "gross_income_dzd_ha": gross_income,
        "tags": agronomic_tags(rotation, crops),
        "ml_metrics": ml_transition_and_env_scores(rotation, crops, indicators),
        "trajectory_3yr": simulate_3yr_trajectory(rotation, crops, indicators),
    }


# ---- Distinctness -----------------------------------------------------------
def distinct_key(rotation) -> frozenset:
    """Two rotations are 'distinct' iff their crop sets differ.
    (Reorderings/cyclic shifts of the same crops are the same strategy.)"""
    return frozenset(rotation)


def select_distinct(ranked: list, existing: list, k: int = MAX_ALTERNATIVES):
    """Pick up to k top-ranked alternatives with pairwise-distinct crop sets,
    all different from the existing rotation's crop set."""
    seen, picked = {distinct_key(existing)}, []
    for r in ranked:
        key = distinct_key(r["rotation"])
        if key not in seen:
            seen.add(key)
            picked.append(r)
            if len(picked) == k:
                break
    return picked


# ---- Explanations (templates only) ----------------------------------------
EVIDENCE_T = ("Rainfall {rain:.0f} mm vs {ref:.0f} mm reference (water stress {ws:.2f}); "
              "soil organic carbon {soc:.2f} g/kg vs {thr:.0f} g/kg threshold (deficit {sd:.2f}).")
COMPARE_T = ("Score {s:.3f} vs existing {e:.3f} ({d:+.3f}). "
             "By criterion (alt - existing): {parts}.")
BENEFIT_T = {
    "nitrogen_fixing": "{crop} fixes nitrogen (legume).",
    "residue_carbon": "{crop} returns high crop residue carbon ({v:.2f}).",
    "drought_tolerance": "{crop} is drought tolerant ({v:.2f}).",
    "profit": "{crop} has strong profit ({v:.2f}).",
    "low_water": "{crop} has low water need ({v:.2f}).",
}


def benefits_for(rotation, crops) -> list:
    out = []
    for c in rotation:
        a = crops[c]
        if a["nitrogen_fixing"]:
            out.append(BENEFIT_T["nitrogen_fixing"].format(crop=c))
        if a["residue_carbon"] >= 0.65:
            out.append(BENEFIT_T["residue_carbon"].format(crop=c, v=a["residue_carbon"]))
        if a["drought_tolerance"] >= 0.70:
            out.append(BENEFIT_T["drought_tolerance"].format(crop=c, v=a["drought_tolerance"]))
        if a["profit"] >= 0.60:
            out.append(BENEFIT_T["profit"].format(crop=c, v=a["profit"]))
        if a["water_need"] <= 0.40:
            out.append(BENEFIT_T["low_water"].format(crop=c, v=a["water_need"]))
    return out


def gaps_risks_for(rotation, crops, gaps) -> dict:
    members = set(rotation)
    g = [f'{x["id"]}: {x["text"]}' for x in gaps
         if x["applies_to"] == "all" or members & set(x["applies_to"])]
    r = [f"{c}: {crops[c]['risk_note']}" for c in dict.fromkeys(rotation)]
    return {"gaps": g, "risks": r}


def generate_rule_trace(entry: dict, existing: dict, crops: dict, indicators: dict, rank_label: str = "Ranked #1") -> str:
    """Generate a single plain-English rule trace sentence explaining WHY the engine chose this rotation."""
    st = derive_stress(indicators)
    soc = float(indicators["soil_organic_carbon_g_per_kg"])
    thr = float(indicators["soc_threshold_g_per_kg"])
    rain = float(indicators["rainfall_mm"])
    sen = st["sen_slope_mm_per_decade"]
    rot = entry["rotation"]
    legumes = [c for c in rot if crops[c]["nitrogen_fixing"] == 1]
    drought_crops = [c for c in rot if crops[c]["drought_tolerance"] >= 0.72]
    water_gain = round((entry["criteria"]["water"] - existing["criteria"]["water"]) * 100)
    npk_saved = existing["trajectory_3yr"]["total_3yr_npk_kg_ha"] - entry["trajectory_3yr"]["total_3yr_npk_kg_ha"]

    reasons = []
    if soc < thr and legumes:
        reasons.append(
            f"soil organic carbon is below threshold ({soc:.2f} vs {thr:.0f} g/kg), so nitrogen-fixing {legumes[0]} replenishes soil fertility"
        )
    elif soc >= thr:
        reasons.append(
            f"soil organic carbon is adequate ({soc:.2f} >= {thr:.0f} g/kg) to buffer against climate volatility"
        )

    if sen <= -15.0 and drought_crops:
        reasons.append(
            f"drought-tolerant {', '.join(dict.fromkeys(drought_crops))} counters the {sen:+.1f} mm/decade Sen's Slope drying velocity (at {rain:.0f} mm/yr rainfall)"
        )
    elif water_gain > 0:
        reasons.append(
            f"it improves water efficiency by +{water_gain} pts over your current rotation"
        )

    if npk_saved > 0:
        reasons.append(f"cuts 3-year synthetic NPK fertilizer by {npk_saved} kg/ha")

    if not reasons:
        reasons.append(f"it balances water conservation ({round(entry['criteria']['water']*100)}/100) and soil health ({round(entry['criteria']['soil']*100)}/100)")

    return f"{rank_label} because " + " and ".join(reasons[:2]) + (f", while it {reasons[2]}." if len(reasons) > 2 else ".")


def explain(entry, existing, crops, gaps, indicators, weights, rank_label: str = "Selected") -> dict:
    st = derive_stress(indicators)
    ev = EVIDENCE_T.format(
        rain=indicators["rainfall_mm"], ref=indicators["rainfall_reference_mm"],
        ws=st["water_stress"], soc=indicators["soil_organic_carbon_g_per_kg"],
        thr=indicators["soc_threshold_g_per_kg"], sd=st["soc_deficit"])
    parts = ", ".join(f"{c} {entry['criteria'][c] - existing['criteria'][c]:+.3f}"
                      for c in CRITERIA)
    cmp_ = COMPARE_T.format(s=entry["score"], e=existing["score"],
                            d=entry["score"] - existing["score"], parts=parts)
    rule_trace = generate_rule_trace(entry, existing, crops, indicators, rank_label=rank_label)
    return {"rule_trace": rule_trace,
            "evidence": [ev, cmp_],
            "benefits": benefits_for(entry["rotation"], crops),
            **gaps_risks_for(entry["rotation"], crops, gaps)}


def build_avoid_list(all_combos: list[tuple], crops: dict, rules: dict,
                     weights: dict, indicators: dict, limit: int = 3) -> list[dict]:
    """Surface sub-optimal / rejected rotations ('Crops/Rotations to Avoid' from CropSense)."""
    avoid = []
    seen = set()
    for p in all_combos:
        if passes_rules(p, crops, rules):
            continue
        key = tuple(p)
        if key in seen:
            continue
        reasons = []
        if len(set(p)) == 1:
            reasons.append("Strict monoculture exhausts soil nitrogen and amplifies root disease")
        elif any(crops[a]["family"] == crops[b]["family"] for a, b in zip(p, p[1:])):
            reasons.append("Back-to-back same crop family multiplies pest & fungal carryover")
        if sum(crops[c]["nitrogen_fixing"] for c in p) < rules["min_legumes"]:
            reasons.append("No nitrogen-fixing legume included; heavy synthetic fertilizer dependency")
        if sum(crops[c]["water_need"] >= rules["high_water_need_threshold"] for c in p) > rules["max_high_water_crops"]:
            reasons.append("Exceeds safe regional water budget (too many high-thirst crops)")
        if reasons:
            sc = _score(p, crops, weights, indicators)
            avoid.append({
                "rotation": list(p),
                "score": round(sc["score"], 3),
                "reasons": reasons,
                "tags": sc["tags"],
            })
            seen.add(key)
        if len(avoid) >= limit:
            break
    return avoid


# ---- Public entry points ----------------------------------------------------
def _rank_candidates(candidates: list, crops: dict, w: dict, indicators: dict) -> list:
    return sorted(
        (_score(p, crops, w, indicators) for p in candidates),
        key=lambda r: (
            -r["score"],
            0 if crops[r["rotation"][0]]["family"] == "legume" else 1,
            r["rotation"],
        ),
    )


def compute_ranking_stability(
    weights: dict,
    indicators: dict,
    candidates: list,
    crops: dict,
    top1_rotation: list,
    runs: int = 100,
) -> float:
    """Seeded Monte Carlo perturbation (+/-15% rainfall) returning % runs where Rank 1 holds."""
    rng = random.Random(42)
    wins = 0
    base_rain = float(indicators["rainfall_mm"])
    for _ in range(runs):
        noisy_ind = dict(indicators, rainfall_mm=base_rain * rng.uniform(0.85, 1.15))
        w_noisy = adjust_weights(weights, noisy_ind)
        best = min(
            (_score(p, crops, w_noisy, noisy_ind) for p in candidates),
            key=lambda r: (
                -r["score"],
                0 if crops[r["rotation"][0]]["family"] == "legume" else 1,
                r["rotation"],
            ),
        )
        if best["rotation"] == top1_rotation:
            wins += 1
    return round(100.0 * wins / max(1, runs), 1)


def recommend(weights: dict, indicators: dict, current_rotation: list,
              data: dict | None = None, monte_carlo_runs: int = 100) -> dict:
    data = data or load_data()
    crops, base_rules, gaps = data["crops"], data["rules"], data["gaps"]
    unknown = [c for c in current_rotation if c not in crops]
    if unknown:
        raise ValueError(f"Unknown crops in current_rotation: {unknown}")

    target_len = len(current_rotation) if 2 <= len(current_rotation) <= 5 else int(base_rules.get("rotation_length", 3))
    rules = dict(base_rules, rotation_length=target_len)

    w = adjust_weights(weights, indicators)
    # For 4-year or 5-year rotations, bound candidate pool so itertools.product stays fast (<50ms)
    pool_keys = sorted(crops)
    if target_len >= 4 and len(pool_keys) > 9:
        must_keep = set(current_rotation)
        ranked_keys = sorted(
            pool_keys,
            key=lambda k: -(crops[k].get("profit", 0.5) + (1.0 - crops[k].get("water_need", 0.5)) + 0.5 * crops[k].get("nitrogen_fixing", 0))
        )
        max_pool = 9 if target_len == 4 else 6
        selected = [k for k in ranked_keys if k in must_keep]
        for k in ranked_keys:
            if len(selected) >= max_pool:
                break
            if k not in must_keep:
                selected.append(k)
        pool_keys = sorted(selected)

    all_combos = list(itertools.product(pool_keys, repeat=rules["rotation_length"]))
    candidates = [p for p in all_combos if passes_rules(p, crops, rules)]
    ranked = _rank_candidates(candidates, crops, w, indicators)

    existing = _score(current_rotation, crops, w, indicators)  # never rule-filtered
    existing["passes_rules"] = passes_rules(tuple(current_rotation), crops, rules)
    alts = select_distinct(ranked, current_rotation)

    notes = []
    if len(alts) < MIN_ALTERNATIVES:
        # Fallback: relax distinctness to exact sequence so >=3 strategies exist.
        taken = {tuple(a["rotation"]) for a in alts} | {tuple(current_rotation)}
        for r in ranked:
            if tuple(r["rotation"]) not in taken:
                alts.append(r)
                taken.add(tuple(r["rotation"]))
                if len(alts) >= MIN_ALTERNATIVES:
                    break
        notes.append("Distinctness relaxed to sequence-level: too few crop-set-distinct options.")
    if len(alts) < MIN_ALTERNATIVES:
        raise RuntimeError("Fewer than 3 distinct strategies could be produced.")

    existing_npk = existing["trajectory_3yr"]["total_3yr_npk_kg_ha"]
    strategies = [dict(existing, label="existing")] + [dict(a, label="alternative") for a in alts]
    for idx, s in enumerate(strategies):
        r_lbl = "Current rotation" if idx == 0 else f"Ranked #{idx}"
        s["explanation"] = explain(s, existing, crops, gaps, indicators, w, rank_label=r_lbl)
        s["rule_trace"] = s["explanation"]["rule_trace"]
        s["fertilizer_saved_vs_existing_kg_ha"] = (
            existing_npk - s["trajectory_3yr"]["total_3yr_npk_kg_ha"]
        )

    stability_pct = compute_ranking_stability(
        weights, indicators, candidates, crops, alts[0]["rotation"], runs=monte_carlo_runs
    )
    avoid_list = build_avoid_list(all_combos, crops, rules, w, indicators)
    crop_rankings = rank_dynamic_crops(crops, weights, indicators)
    return {
        "region": indicators.get("region"),
        "adjusted_weights": w,
        "stress": derive_stress(indicators),
        "ranking_stability_pct": stability_pct,
        "n_candidates": len(candidates),
        "crop_rankings": crop_rankings,
        "strategies": strategies,
        "rotations_to_avoid": avoid_list,
        "notes": notes,
    }


def scenario(weights: dict, indicators: dict, current_rotation: list,
             rainfall_pct: float, data: dict | None = None) -> dict:
    """Re-rank with rainfall changed by rainfall_pct percent (e.g. -20 or +10)."""
    data = data or load_data()
    shifted = dict(indicators, rainfall_mm=indicators["rainfall_mm"] * (1 + rainfall_pct / 100))
    base = recommend(weights, indicators, current_rotation, data)
    scen = recommend(weights, shifted, current_rotation, data)
    base_rank = [s["rotation"] for s in base["strategies"]]
    return {"rainfall_pct": rainfall_pct, "rainfall_mm": shifted["rainfall_mm"],
            "baseline": base, "scenario": scen,
            "ranking_changed": base_rank != [s["rotation"] for s in scen["strategies"]]}


if __name__ == "__main__":
    req = json.loads((DATA_DIR / "request.json").read_text())
    ind = json.loads((DATA_DIR / "indicators.json").read_text())
    print(json.dumps(recommend(req["weights"], ind, req["current_rotation"]), indent=2))
