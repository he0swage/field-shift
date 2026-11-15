"""Fetch SoilGrids soil organic carbon for regionX and write soil.json.

ASSUMPTIONS (pending Achref):
  * regionX = Setif plateau, Algeria, point (lat 36.19, lon 5.41).
  * Access approach = public ISRIC REST API (no key needed).
If the API is unreachable, falls back to MOCK values and sets "source": "MOCK".
"""
import json
import urllib.request
from pathlib import Path

LAT, LON = 36.19, 5.41
API = ("https://rest.isric.org/soilgrids/v2.0/properties/query"
       f"?lon={LON}&lat={LAT}&property=soc&property=phh2o"
       "&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean")
# Layer thickness (cm) used to depth-weight the 0-30 cm mean.
THICKNESS = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}
# Mock values in SoilGrids *mapped units*: soc dg/kg, phh2o pH*10.
MOCK = {"soc": {"0-5cm": 130, "5-15cm": 105, "15-30cm": 85},
        "phh2o": {"0-5cm": 78, "5-15cm": 79, "15-30cm": 80}}


def fetch():
    with urllib.request.urlopen(API, timeout=30) as r:
        data = json.load(r)
    out = {}
    for layer in data["properties"]["layers"]:
        out[layer["name"]] = {d["label"]: d["values"]["mean"] for d in layer["depths"]}
    return out


def weighted(layer):
    tot = sum(THICKNESS.values())
    return sum(layer[k] * w for k, w in THICKNESS.items()) / tot


def main():
    try:
        raw, source = fetch(), "SoilGrids v2.0 REST API (live)"
        if any(v is None for l in raw.values() for v in l.values()):
            raise ValueError("null values returned")
    except Exception as exc:  # network blocked, null pixel, etc.
        raw, source = MOCK, f"MOCK (live fetch failed: {exc})"
    soc_dg = weighted(raw["soc"])
    ph10 = weighted(raw["phh2o"])
    result = {
        "region": "regionX", "lat": LAT, "lon": LON, "source": source,
        "depth_cm": "0-30 (thickness-weighted)",
        "raw_mapped_units": {"soc_dg_per_kg": round(soc_dg, 2), "phh2o_ph_x10": round(ph10, 2)},
        "soil_organic_carbon_g_per_kg": round(soc_dg / 10, 2),
        "ph": round(ph10 / 10, 2),
    }
    out = Path(__file__).resolve().parents[1] / "data/processed/regionX/soil.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
