# analysis/ — Field Shift data pipeline (Achref)

Turns NASA POWER, ISRIC SoilGrids and MODIS NDVI data into small cleaned JSON
indicator files for the engine, API and frontend.

## Files

| File | What it is |
|---|---|
| `fetch_real_data.py` | Pipeline v1, copied **unchanged** from the team Drive folder (`field_shift_drive_files/scripts/fetch_real_data.py`, 2026-11-14, 16,776 bytes, byte-identical `fc /B` check). Standard library only. Kept as the live-fetch reference; **do not edit it**. |
| `save_raw.py` | Helper (new): saves raw API responses to gitignored `data/raw/<region>/`. Not part of v1. |
| `crosscheck_openmeteo.py` | Helper (new): ERA5-based rainfall / hot-day / frost-day cross-check via Open-Meteo archive API. Not part of v1. |
| `build_indicators.py` | Pipeline v2 (Step 2): offline — reads `data/raw/` + `domain/thresholds.json`, never calls live APIs, and writes the full per-region JSON contract to `data/processed/<region>/`. |
| `tests/` | pytest suite: known-answer tests (dry spells, hot/frost counts, OLS/Mann-Kendall/Sen, SOC-pH conversion, PRD 6.2 priorities), no -999 sentinel in outputs, schema checks against `docs/data_contract.md`, byte-identical rebuild determinism. |
| `requirements.txt` | pandas>=2.0, numpy>=1.26, scipy>=1.11, pytest>=8.0 (v1 `fetch_real_data.py` still needs nothing). |

## How to run

### v2 offline pipeline (recommended)

```powershell
# from the repo root, Python 3.11+ (developed on 3.12)
python -m pip install -r analysis\requirements.txt

# 1. one-time: save raw API responses (needs internet, ~10-30 min)
python analysis\save_raw.py

# 2. every rebuild: offline, deterministic, seconds
python analysis\build_indicators.py --stamp "2026-11-14 step2"

# 3. run the test suite
python -m pytest analysis\tests -q
```

v2 reads only `data/raw/<region>/` (gitignored) and `domain/thresholds.json`, and
writes to `data/processed/<region>/`:

- `climate_yearly.json` — per-year rows (annual + growing-season rain, hot/frost/extreme
  days, longest dry spell, missing-day counts)
- `climate_monthly.json` — 12 monthly mean rain values + per-year monthly rows
- `indicators.json` — headline indicators with units, windows, crosscheck values,
  per-indicator confidence, both trend methods, PRD 6.2 priorities, NDVI fields
- `soil.json` — SOC g/kg + pH (0–30 cm, depth weights 5:10:15), SOC class
- `data_quality.md` — missing data, gaps, POWER vs ERA5 disagreements, confidence rule, caveats

Thresholds and confidence rules live in `domain/thresholds.json`; region ids/coordinates
in `domain/regions.csv`. The full key schema is documented in `docs/data_contract.md`.
Same raw input → byte-identical output (enforced by a test).

Run time: seconds once `data/raw/` exists. `--regions setif` limits the run;
`--stamp` records a label in `data_quality.md` (not in the numeric outputs, so reruns
with different stamps are still numerically identical).

## Known path notes (reported, not changed in Step 1)

- PRD v3 §7 says `data/processed/regionX/`; v1 writes `data/processed/<setif|constantine|tiaret>/`.
- PRD v3 §7 lists `climate_yearly.json`, `climate_monthly.json`, `data_quality.md`
  per region — v1 writes neither (Step 2).
- Do **not** commit anything from `data/raw/` or from `field_shift_drive_files/`.
