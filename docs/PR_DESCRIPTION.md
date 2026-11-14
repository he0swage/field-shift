# PR description draft — `achref/step1-pipeline` → `main`

## What this branch adds

A complete, verified, offline data pipeline for the Field Shift indicators:

1. **Step 1 — audit**: v1 pipeline imported byte-identical from the team Drive, run, and audited (9 findings, see `logs/step1_report.md`); v1 logic unchanged.
2. **Step 2 — pipeline v2**: `analysis/build_indicators.py` builds the full PRD §7 contract offline from `data/raw/` (NASA POWER, ERA5 via Open-Meteo, ISRIC SoilGrids, MODIS MOD13Q1):
   - per region: `indicators.json`, `climate_yearly.json`, `climate_monthly.json`, `soil.json`, `climate_text.json`, `data_quality.md`
   - shared: `regions_summary.json`, `sensitivity.json`
   - config: `domain/thresholds.json` (all values flagged pending Younes), `domain/regions.csv`
   - OLS + Mann-Kendall/Sen trends, per-indicator confidence vs ERA5 cross-check, PRD 6.2 priorities (`yield_` key, sums to 100)
3. **Step 3 — verification & handoff**: independent recomputation of 33 values (separate code, PASS), sensitivity table, decision sheet, data contract, glossary, about-data, gaps draft, 10 charts, one-command `run_all.py`.

## How to test

```powershell
python -m pip install -r analysis\requirements.txt
python analysis\run_all.py        # prints build/sensitivity/verify/tests PASS/FAIL -> ALL PASS
python analysis\make_charts.py    # regenerates the 10 charts
```

Expected: `verify` prints 33 OK rows (differences only within stored-rounding tolerance), tests `45 passed`, summary `ALL PASS`.

## Size / hygiene

- Tracked files are small (largest: 190 KB chart PNG). `data/raw/` and the Drive folder are gitignored; no secrets tracked; no file >1 MB.

## What is pending (not blocked by this PR)

- Threshold/window/coordinate confirmations by Younes and Alaa (all flagged `pending` in the outputs and in `docs/decision_sheet.md`).
- Region ids (`regionX` vs codes) for Mehdi; frontend wiring per `docs/data_contract.md` §7 for Nazim (frontend untouched in this branch).

## Merge notes

- Do not squash away the small-step history; the commit dates are quoted in `docs/process_disclosure.md`.
- v1 `analysis/fetch_real_data.py` must remain untouched (reference only).
