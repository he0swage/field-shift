# analysis/ — Field Shift data pipeline (Achref)

Turns NASA POWER, ISRIC SoilGrids and MODIS NDVI data into small cleaned JSON
indicator files for the engine, API and frontend.

## Files

| File | What it is |
|---|---|
| `fetch_real_data.py` | Pipeline v1, copied **unchanged** from the team Drive folder (`field_shift_drive_files/scripts/fetch_real_data.py`, 2026-11-14, 16,776 bytes, byte-identical `fc /B` check). Standard library only. |
| `save_raw.py` | Helper (new): saves raw API responses to gitignored `data/raw/<region>/`. Not part of v1. |
| `crosscheck_openmeteo.py` | Helper (new): ERA5-based rainfall / hot-day / frost-day cross-check via Open-Meteo archive API. Not part of v1. |
| `requirements.txt` | Nothing needed today (stdlib-only); pandas/numpy/scipy planned for Step 2. |

## How to run

```powershell
# from the repo root; Python 3.11+ (developed on 3.12), no dependencies to install
python analysis\fetch_real_data.py
```

Outputs (written by v1, paths are fixed inside the script):

- `data/processed/setif/indicators.json`, `soil.json`
- `data/processed/constantine/indicators.json`, `soil.json`
- `data/processed/tiaret/indicators.json`, `soil.json`
- `data/inputs/indicators.json` (copy of Sétif)
- `data/regional/all_indicators.json` (all three regions)

Run time: ~3–8 min (network bound; ~15 live API calls). Retries built in;
SoilGrids may return 503 and fall back to hardcoded ITGC baselines; ORNL MODIS
falls back to regional baselines on failure.

Raw responses (not saved by v1; run before or after, needs internet):

```powershell
python analysis\save_raw.py      # -> data/raw/<region>/*.json  (gitignored)
python analysis\crosscheck_openmeteo.py   # -> data/processed/<region>/crosscheck_openmeteo.json
```

## Known path notes (reported, not changed in Step 1)

- PRD v3 §7 says `data/processed/regionX/`; v1 writes `data/processed/<setif|constantine|tiaret>/`.
- PRD v3 §7 lists `climate_yearly.json`, `climate_monthly.json`, `data_quality.md`
  per region — v1 writes neither (Step 2).
- Do **not** commit anything from `data/raw/` or from `field_shift_drive_files/`.
