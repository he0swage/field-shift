"""Build the JSON-backed agronomy Knowledge Graph for Field Shift.

Reads the authoritative v2 pipeline outputs (data/processed/<region>/indicators.json,
soil.json, data_quality.json) plus the domain crop tables, and serializes a directed
graph to data/processed/knowledge_graph.json:

  Nodes:  region / trend / soil / drought / data_quality / crop
  Edges:  region -has_climate_trend-> trend
          region -has_soil-> soil
          region -experiences-> drought
          region -documented_by-> data_quality
          region -grows-> crop            (per-region suitability score)
          trend -favors_crop-> crop       (drying-trend drought-shift logic)
          soil  -favors_crop-> crop       (SOC-deficit N-fixation logic)
          region -stresses_crop-> crop    (rainfall below crop optimum)
          region -agro_zone_peer-> region (same agro zone, for comparisons)

The `favors_crop` / `stresses_crop` logic mirrors the rule branches of
engine/scoring.py::score_single_crop (Sen's slope drought shift, SOC deficit
legume boost, rainfall-envelope penalty) so graph explanations stay consistent
with the engine's plain-English rule_trace.

Run:  python engine/build_graph.py [--out data/processed/knowledge_graph.json]
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import scoring

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
DEFAULT_OUT = PROCESSED / "knowledge_graph.json"

# Multiple committed directories describe the same farm region; the v2 pipeline
# outputs win over the legacy regionX mirrors.
CANONICAL_REGION = {
    "setif": "setif",
    "regionA": "setif",
    "tiaret": "tiaret",
    "constantine": "constantine",
    "regionB": "kansas",
    "kansas": "kansas",
    "regionC": "punjab",
    "punjab": "punjab",
}
CANONICAL_DOMAIN = {
    "setif": "regionA",
    "tiaret": "regionA",
    "constantine": "regionA",
    "kansas": "regionB",
    "punjab": "regionC",
}
AGRO_ZONE_PEERS = (("setif", "tiaret"), ("setif", "constantine"), ("tiaret", "constantine"))

EQUAL_WEIGHTS = {"water": 0.25, "soil": 0.25, "profit": 0.25, "risk": 0.25}


def _scalar(v: Any) -> float | None:
    if isinstance(v, dict):
        v = v.get("value")
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return None


def _read(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _merge_docs(base: dict, override: dict) -> dict:
    """Override wins; one level of nested-dict merging (rainfall_trend, etc.)."""
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            merged = dict(out[k])
            merged.update(v)
            out[k] = merged
        else:
            out[k] = v
    return out


def _trend_from_block(rt: dict) -> dict:
    sen = rt.get("sen_slope_mm_per_decade", rt.get("slope_mm_per_decade"))
    theil = rt.get("theilslopes_slope_per_year")
    slope = float(sen) if sen is not None else (float(theil) * 10.0 if theil is not None else None)
    lo = rt.get("mbb_ci_low_95")
    if lo is None and rt.get("mbb_ci_low_95_per_year") is not None:
        lo = float(rt["mbb_ci_low_95_per_year"]) * 10.0
    hi = rt.get("mbb_ci_high_95")
    if hi is None and rt.get("mbb_ci_high_95_per_year") is not None:
        hi = float(rt["mbb_ci_high_95_per_year"]) * 10.0
    sig = rt.get("statistically_significant_95")
    return {
        "slope_mm_per_decade": round(slope, 2) if slope is not None else None,
        "theilslopes_slope_per_year": theil,
        "mbb_ci_low_95": round(float(lo), 2) if lo is not None else None,
        "mbb_ci_high_95": round(float(hi), 2) if hi is not None else None,
        "statistically_significant_95": None if sig is None else bool(sig),
        "window": rt.get("window"),
        "confidence": rt.get("confidence"),
    }


def _collect_region_docs() -> dict[str, dict]:
    """Merge every data/processed/<dir>/indicators.json into canonical region docs."""
    docs: dict[str, dict] = {}
    legacy: dict[str, dict] = {}
    for d in sorted(PROCESSED.iterdir()):
        if not d.is_dir():
            continue
        ind = _read(d / "indicators.json")
        if not ind:
            continue
        canon = CANONICAL_REGION.get(d.name, d.name if d.name.startswith("custom") else None)
        if canon is None:
            continue
        if d.name in ("setif", "tiaret", "constantine"):
            docs[canon] = ind  # authoritative v2 pipeline output
        else:
            legacy[canon] = ind
    for canon, doc in legacy.items():
        if canon in docs:
            docs[canon] = _merge_docs(doc, docs[canon])
        else:
            docs[canon] = doc
    return docs


def build_graph(out_path: Path | str | None = None) -> dict:
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    node_ids: set[str] = set()

    def add_node(nid: str, ntype: str, label: str, aliases: list[str], summary: str, attrs: dict) -> None:
        if nid in node_ids:
            return
        node_ids.add(nid)
        nodes.append({
            "id": nid,
            "type": ntype,
            "label": label,
            "summary": summary,
            "aliases": aliases,
            "attrs": attrs,
        })

    def add_edge(src: str, rel: str, dst: str, attrs: dict | None = None) -> None:
        edges.append({"src": src, "rel": rel, "dst": dst, "attrs": attrs or {}})

    region_docs = _collect_region_docs()
    soil_docs: dict[str, dict] = {}
    crop_nodes: dict[str, dict] = {}

    for code, ind in sorted(region_docs.items()):
        rid = f"region:{code}"
        label = str(ind.get("label") or code)
        rain = _scalar(ind.get("rainfall_mm"))
        wstress = _scalar(ind.get("water_stress"))
        rt = ind.get("rainfall_trend") if isinstance(ind.get("rainfall_trend"), dict) else {}
        trend = _trend_from_block(rt)

        rule_trace = {
            k: v
            for k, v in (ind.get("rule_trace") or {}).items()
            if isinstance(v, str) and v.strip() and k != "purpose"
        } if isinstance(ind.get("rule_trace"), dict) else {}

        soil_doc = _read(PROCESSED / code / "soil.json")
        if not soil_doc:
            legacy_code = {v: k for k, v in CANONICAL_REGION.items() if v == code and k.startswith("region")}
            for lk in legacy_code:
                soil_doc = _read(PROCESSED / lk / "soil.json")
                if soil_doc:
                    break
        soil_docs[code] = soil_doc
        soc = soil_doc.get("soc_g_per_kg")
        ph = soil_doc.get("ph")
        dq_doc = _read(PROCESSED / code / "data_quality.json")
        cs = dq_doc.get("confidence_summary") or {}

        dq_txt = ""
        if isinstance(cs, dict) and cs:
            dq_txt = "; ".join(f"{k}={v}" for k, v in list(cs.items())[:3])

        region_aliases = [code]
        if code == "setif":
            region_aliases += ["sétif", "regiona", "سطيف"]
        elif code == "tiaret":
            region_aliases += ["regiona", "تيارت"]
        elif code == "constantine":
            region_aliases += ["regiona", "قسنطينه", "قسنطينة"]
        elif code == "kansas":
            region_aliases += ["regionb", "usa", "salina"]
        elif code == "punjab":
            region_aliases += ["regionc", "india", "ludhiana"]

        region_summary = f"{label}: rainfall {rain:.1f} mm/yr" if rain is not None else label
        add_node(
            rid, "region", label, region_aliases, region_summary,
            {
                "rainfall_mm": rain,
                "rainfall_30yr_mean_mm": _scalar(ind.get("rainfall_30yr_mean_mm")),
                "water_stress": wstress,
                "water_stress_5yr": _scalar(ind.get("water_stress_5yr")),
                "ph": _scalar(ind.get("ph")) or ph,
                "data_quality_confidence": dq_txt,
                "rule_trace": rule_trace,
            },
        )

        if trend["slope_mm_per_decade"] is not None:
            tid = f"trend:{code}"
            sig = trend["statistically_significant_95"]
            sig_txt = "significant" if sig else ("not significant" if sig is not None else "significance not tested")
            ci_txt = (
                f", MBB 95% CI [{trend['mbb_ci_low_95']}, {trend['mbb_ci_high_95']}]"
                if trend["mbb_ci_low_95"] is not None else ""
            )
            add_node(
                tid, "trend", f"Rainfall trend — {label}", [code],
                f"{trend['slope_mm_per_decade']:+.1f} mm/decade over {trend.get('window') or 'window'}, {sig_txt}{ci_txt}",
                {
                    **trend,
                    "ols_slope_mm_per_decade": rt.get("ols_slope_mm_per_decade"),
                    "ols_p": rt.get("ols_p"),
                    "mk_p": rt.get("mk_p"),
                    "mbb_note": rt.get("mbb_note"),
                },
            )
            add_edge(rid, "has_climate_trend", tid)

        if soil_doc:
            sid = f"soil:{code}"
            awc = soil_doc.get("awc_mm_per_m")
            add_node(
                sid, "soil", f"Soil profile — {label}", [code],
                f"AWC {awc} mm/m, SOC {soc} g/kg, pH {ph}" if soc is not None else f"pH {ph}",
                {
                    "awc_mm_per_m": awc,
                    "awc_is_estimate": bool(soil_doc.get("awc_is_estimate", False)),
                    "awc_method": soil_doc.get("awc_method"),
                    "soc_g_per_kg": soc,
                    "ph": ph,
                    "soc_class": soil_doc.get("soc_class"),
                    "confidence": soil_doc.get("confidence"),
                },
            )
            add_edge(rid, "has_soil", sid)

        hd = ind.get("historical_drought")
        if isinstance(hd, dict) and hd:
            did = f"drought:{code}"
            severe = list(hd.get("severe_drought_years") or [])
            add_node(
                did, "drought", f"Historical drought — {label}", [code],
                f"{hd.get('drought_frequency_pct')}% drought frequency, {len(severe)} severe years ({', '.join(map(str, severe[:4]))}...)",
                {
                    "window": hd.get("window"),
                    "mean_mm": hd.get("mean_mm"),
                    "std_mm": hd.get("std_mm"),
                    "severe_boundary_mm": hd.get("severe_boundary_mm"),
                    "drought_frequency_pct": hd.get("drought_frequency_pct"),
                    "severe_drought_years": severe,
                    "confidence": hd.get("confidence"),
                },
            )
            add_edge(rid, "experiences", did)

        if dq_doc:
            qid = f"data_quality:{code}"
            add_node(
                qid, "data_quality", f"Data quality — {label}", [code],
                dq_txt or f"run {dq_doc.get('run_stamp')}",
                {
                    "run_stamp": dq_doc.get("run_stamp"),
                    "confidence_summary": cs,
                    "spatial_caveat": dq_doc.get("spatial_caveat"),
                    "source_disagreement": dq_doc.get("source_disagreement"),
                },
            )
            add_edge(rid, "documented_by", qid)

        # ---- crops: suitability + rule_trace-informed favor/stress edges ----
        dom = CANONICAL_DOMAIN.get(code)
        if not dom:
            continue
        reg_data = scoring.load_region(dom, ROOT)
        thresh = reg_data.get("thresholds") or {}
        soc_thr = thresh.get("soc_threshold_g_per_kg")
        rain_ref = thresh.get("rainfall_reference_mm")
        for cid, crop in sorted(reg_data.get("crops", {}).items()):
            cnid = f"crop:{cid}"
            water_need = float(crop.get("water_need", 0.5))
            drought_tol = float(crop.get("drought_tolerance", 0.5))
            n_fix = int(crop.get("nitrogen_fixing", 0) or 0)
            n_impact = int(crop.get("n_impact", 0) or 0)
            r_min, r_max = crop.get("rain_opt", (300.0, 650.0))
            if cnid not in crop_nodes:
                crop_nodes[cnid] = True
                add_node(
                    cnid, "crop", str(crop.get("name") or cid.replace("_", " ").title()),
                    [cid, cid.replace("_", " ")],
                    f"water need {round(water_need*100)}%, drought tolerance {round(drought_tol*100)}%"
                    + (f", N-fixing (+{n_impact} kg N/ha)" if n_fix else ""),
                    {
                        "family": crop.get("family"),
                        "water_need": round(water_need, 3),
                        "drought_tolerance": round(drought_tol, 3),
                        "nitrogen_fixing": bool(n_fix),
                        "n_impact_kg_ha": n_impact,
                        "rain_opt_mm": [r_min, r_max],
                        "resilience_score": round(0.6 * drought_tol + 0.4 * (1.0 - water_need), 3),
                    },
                )
            ind_engine = {
                "rainfall_mm": rain if rain is not None else 484.5,
                "rainfall_reference_mm": rain_ref or 0.0,
                "soil_organic_carbon_g_per_kg": float(soc) if soc is not None else 12.52,
                "soc_threshold_g_per_kg": float(soc_thr) if soc_thr is not None else 15.0,
                "ph": float(ph) if ph is not None else 7.5,
                "rainfall_trend": rt,
            }
            try:
                scored = scoring.score_single_crop(cid, crop, EQUAL_WEIGHTS, ind_engine)
                suitability = scored.get("suitability_pct")
            except Exception:
                suitability = None
            grows_attrs = {}
            if suitability is not None:
                grows_attrs["suitability_pct"] = suitability
            if crop.get("yield_potential") is not None:
                grows_attrs["yield_potential"] = crop.get("yield_potential")
            add_edge(rid, "grows", cnid, grows_attrs)

            # Drying-trend drought shift (rule branch: slope <= -15 & drought_tol >= 0.75)
            slope = trend["slope_mm_per_decade"]
            if slope is not None and slope <= -15.0 and drought_tol >= 0.75:
                add_edge(
                    f"trend:{code}", "favors_crop", cnid,
                    {
                        "reason": (
                            f"Drying trend {slope:+.1f} mm/decade favors drought-tolerant crops: "
                            f"{cid} tolerates {round(drought_tol*100)}% drought with only {round(water_need*100)}% water need."
                        )
                    },
                )
            # SOC-deficit legume boost (rule branch: n_fix & soc below threshold)
            if n_fix and soc is not None and soc_thr is not None and float(soc) < float(soc_thr):
                add_edge(
                    f"soil:{code}", "favors_crop", cnid,
                    {
                        "reason": (
                            f"SOC {float(soc):.2f} g/kg is below the {float(soc_thr):.0f} g/kg threshold; "
                            f"{cid} biologically fixes ~{n_impact:+d} kg N/ha and restores fertility."
                        )
                    },
                )
            # Rainfall-envelope penalty (rule branch: rain below optimum minimum)
            if rain is not None and rain < r_min:
                add_edge(
                    rid, "stresses_crop", cnid,
                    {"reason": f"Rainfall {rain:.0f} mm/yr is below the {r_min:.0f} mm optimal minimum for {cid}."},
                )

    for a, b in AGRO_ZONE_PEERS:
        if f"region:{a}" in node_ids and f"region:{b}" in node_ids:
            add_edge(f"region:{a}", "agro_zone_peer", f"region:{b}")
            add_edge(f"region:{b}", "agro_zone_peer", f"region:{a}")

    graph = {
        "version": "1.0",
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes": nodes,
        "edges": edges,
    }
    out = Path(out_path) if out_path else DEFAULT_OUT
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(graph, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return graph


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Field Shift agronomy knowledge graph")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="output JSON path")
    args = parser.parse_args()
    g = build_graph(args.out)
    print(f"knowledge graph -> {args.out}: {g['node_count']} nodes, {g['edge_count']} edges")


if __name__ == "__main__":
    main()
