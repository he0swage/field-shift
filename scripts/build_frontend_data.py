"""Bundle real verified datasets from domain/ and data/ into frontend/src/data/realDataBundle.json."""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engine import scoring

DATA = ROOT / "data"
DOMAIN = ROOT / "domain"
OUT = ROOT / "frontend" / "src" / "data" / "realDataBundle.json"


def _load_json(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    regions_csv_rows = []
    with (DOMAIN / "regions.csv").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            row["lat"] = float(row["lat"])
            row["lon"] = float(row["lon"])
            row["default_crops_list"] = [c.strip() for c in row["default_crops"].split(",") if c.strip()]
            regions_csv_rows.append(row)

    all_ind = _load_json(DATA / "regional" / "all_indicators.json", {})
    rules_global = _load_json(DATA / "inputs" / "rules.json", {})
    gaps = _load_json(DATA / "inputs" / "gaps.json", {"gaps": []})

    crops_idx = _load_json(DATA / "processed" / "crops" / "index.json", {"ids": []})
    crops_list = [
        _load_json(DATA / "processed" / "crops" / f"{cid}.json")
        for cid in crops_idx.get("ids", [])
    ]
    crops_list = [c for c in crops_list if c]

    regions = {}
    fires_snapshots = {}
    for row in regions_csv_rows:
        reg_id = row["region_id"]
        code = row["code"]
        rdir = DATA / "processed" / reg_id
        if not rdir.exists():
            rdir = DATA / "processed" / code

        yearly = _load_json(rdir / "climate_yearly.json", {})
        monthly = _load_json(rdir / "climate_monthly.json", {})
        v2_ind = _load_json(rdir / "indicators.json", {})
        climate_text = _load_json(rdir / "climate_text.json", {})
        soil = _load_json(rdir / "soil.json", {})
        forecast = _load_json(rdir / "forecast.json", {})
        fires = _load_json(rdir / "fires_snapshot.json", {})
        reg_domain = scoring.load_region(reg_id, ROOT)

        fires_snapshots[reg_id] = fires
        regions[reg_id] = {
            "id": reg_id,
            "code": code,
            "meta": row,
            "v1": all_ind.get(reg_id, {}),
            "v2": v2_ind,
            "soil": soil,
            "climateText": climate_text,
            "annual": [
                {"year": r["year"], "rain": r["annual_rain_mm"]}
                for r in yearly.get("rows", [])
                if r.get("annual_rain_mm") is not None
            ],
            "monthly": [round(float(v), 1) for v in monthly.get("monthly_rain_mm", [])],
            "forecast": {
                "modelType": forecast.get("model_type"),
                "confidenceStatus": forecast.get("confidence_status"),
                "trainingWindow": forecast.get("training_window"),
                "note": forecast.get("note"),
                "projection": forecast.get("projection", []),
            } if forecast else None,
            "fires": fires,
            "rules": reg_domain["rules"],
            "thresholds": reg_domain["thresholds"],
            "regionalCrops": reg_domain["crops"],
        }

    # Pre-cached custom coordinates example (Section 2.6: 35.4 N, 1.3 E — Tiaret High Plains)
    cdir = DATA / "processed" / "custom_35.4_1.3"
    custom_example = None
    if cdir.exists():
        c_yearly = _load_json(cdir / "climate_yearly.json", {})
        c_monthly = _load_json(cdir / "climate_monthly.json", {})
        c_v2 = _load_json(cdir / "indicators.json", {})
        c_soil = _load_json(cdir / "soil.json", {})
        c_text = _load_json(cdir / "climate_text.json", {})
        c_fires = _load_json(cdir / "fires_snapshot.json", {})
        custom_example = {
            "id": "custom_35.4_1.3",
            "name": "Custom Point (35.40° N, 1.30° E · Tiaret Plains)",
            "country": "Custom Coordinates",
            "lat": 35.4,
            "lon": 1.3,
            "role": "custom",
            "farming_system": "rainfed",
            "default_crops": ["wheat", "barley", "lentil", "chickpea"],
            "warning": "Data only: crop values are not adjusted for this place.",
            "v1": all_ind.get("tiaret", all_ind.get("regionA", {})),
            "v2": c_v2,
            "soil": c_soil,
            "climateText": c_text,
            "annual": [
                {"year": r["year"], "rain": r["annual_rain_mm"]}
                for r in c_yearly.get("rows", [])
                if r.get("annual_rain_mm") is not None
            ],
            "monthly": [round(float(v), 1) for v in c_monthly.get("monthly_rain_mm", [])],
            "fires": c_fires,
        }

    bundle = {
        "generatedFrom": "NASA POWER (1995-2024) + NASA FIRMS (VIIRS NOAA-21 NRT) + Open-Meteo ERA5 + ISRIC SoilGrids v2.0 + ORNL MODIS MOD13Q1 + USDA NASS / FAOSTAT / ICAR / ITGC",
        "cropsCount": len(crops_list),
        "regionsCsv": regions_csv_rows,
        "regions": regions,
        "firesSnapshots": fires_snapshots,
        "customExample": custom_example,
        "crops": crops_list,
        "rules": rules_global,
        "gaps": gaps.get("gaps", []),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, {len(crops_list)} crops, {len(regions)} regions)")

    # Also build and export the RAG corpus index bundle for static frontend fallback
    from engine import rag_assistant
    rag_idx = rag_assistant.build_or_load_index(force_rebuild=True)
    rag_out = ROOT / "frontend" / "src" / "data" / "ragCorpusBundle.json"
    compact_chunks = [
        {
            "chunk_id": c["chunk_id"],
            "doc_id": c["doc_id"],
            "title": c["title"],
            "section": c["section"],
            "file": c["file"],
            "text": c["text"],
            "concepts": c.get("concepts", []),
        }
        for c in rag_idx.get("chunks", [])
    ]
    rag_out.write_text(
        json.dumps({"version": "1.0", "chunk_count": len(compact_chunks), "chunks": compact_chunks}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {rag_out} ({rag_out.stat().st_size} bytes, {len(compact_chunks)} RAG chunks)")


if __name__ == "__main__":
    main()
