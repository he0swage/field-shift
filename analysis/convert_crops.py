"""Convert domain/crops_algeria.csv (team agronomy table from the shared Drive)
into JSON files for the engine/API: one file per crop plus an index.

Values are converted verbatim - no numbers are changed or invented. All
risk_note entries keep the team's "(needs local review)" flag, and the team
sources column is preserved per crop.

Usage: python analysis/convert_crops.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "domain" / "crops_algeria.csv"
OUT_DIR = ROOT / "data" / "processed" / "crops"

# column -> python type (everything else stays a string)
INT_COLS = {"fao_etc_mm_min", "fao_etc_mm_max", "n_impact_kg_ha", "oaic_ccls_price_dzd_q",
            "baseline_yield_q_ha", "gross_income_dzd_ha", "soil_depletion_index",
            "soil_health_delta", "base_npk_kg_ha", "optimal_rain_min", "optimal_rain_max",
            "nitrogen_fixing", "frost_tolerant"}
FLOAT_COLS = {"water_need", "residue_carbon", "drought_tolerance", "profit", "risk_level",
              "optimal_ph_min", "optimal_ph_max"}


def convert(col, raw):
    raw = raw.strip()
    if col in INT_COLS:
        return int(raw.replace("+", ""))
    if col in FLOAT_COLS:
        return float(raw)
    return raw


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    ids = []
    for row in rows:
        crop = {k: convert(k, v) for k, v in row.items()}
        cid = crop["crop"]
        doc = {
            "id": cid,
            "source_file": "domain/crops_algeria.csv (team shared Drive table, converted verbatim)",
            "review_status": "needs local review (see risk_note and sources per crop)",
            **crop,
        }
        out = OUT_DIR / f"{cid}.json"
        out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        ids.append(cid)
        print(f"  {out.name}: {crop['scientific_name']} ({crop['family']})")

    index = {
        "description": "Algerian cool-season crop/agronomy reference table converted verbatim from "
                       "domain/crops_algeria.csv (originally field_shift_drive_files/data_regional/). "
                       "One JSON per crop plus this index; values are the team's, all pending local review.",
        "source": "domain/crops_algeria.csv",
        "n_crops": len(ids),
        "ids": ids,
    }
    (OUT_DIR / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_DIR / 'index.json'} ({len(ids)} crops)")


if __name__ == "__main__":
    main()
