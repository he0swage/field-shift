# Data handoff — Achref → the team

What exists, how to run it, what each person must do next, and what is still open. Reports: `logs/step1_report.md`, `logs/step2_report.md`, `logs/step3_report.md`.

## What exists (all on branch `achref/step1-pipeline`, local)

| Piece | Where | State |
|---|---|---|
| Pipeline v1 (reference, untouched) | `analysis/fetch_real_data.py` | byte-identical copy of the Drive file |
| Raw API responses (gitignored) | `data/raw/<region>/` | saved 2026-11-13/14; `analysis/save_raw.py` refetches |
| Pipeline v2 (offline, deterministic) | `analysis/build_indicators.py` | verified independently, 45 tests pass |
| Outputs per region | `data/processed/<region>/` (indicators, climate_yearly/monthly, soil, climate_text, data_quality) | committed, small |
| Map summary | `data/processed/regions_summary.json` | committed |
| Sensitivity table | `data/processed/sensitivity.json` + `docs/sensitivity.md` | committed |
| Contract + mapping | `docs/data_contract.md` (frontend field table §7) | committed |
| Decision sheet | `docs/decision_sheet.md` | committed |
| About-data + glossary + gaps draft | `docs/about_data.md`, `docs/glossary_data_terms.md`, `docs/gaps_draft.md` | drafts |
| Charts | `analysis/charts/*.png` (10 files, <1 MB total) | committed |
| Disclosure | `docs/process_disclosure.md`, PR draft `docs/PR_DESCRIPTION.md` | drafts |

## How to run (one command)

```powershell
python -m pip install -r analysis\requirements.txt
python analysis\run_all.py            # build -> sensitivity -> independent verify -> tests, PASS/FAIL
python analysis\make_charts.py        # regenerate charts after a data/threshold change
```

Any threshold change = edit `domain/thresholds.json`, re-run `run_all.py`. It must print ALL PASS.

## Per teammate

- **Younes (agronomy)**: confirm the 12 rows of `docs/decision_sheet.md` — windows/thresholds are placeholders (`domain/thresholds.json`). Sensitivity shows the hot threshold is a ×2.5 lever and the frost window ×3. Also review `glossary_data_terms.md`.
- **Alaa (engine)**: pick the water-stress recent window (2015–2024 primary vs 2020–2024 `water_stress_5yr`; Tiaret ranges 0.03–0.33) and confirm the priorities key `yield_` + that values sum to 100. Consume `indicators.json`; respect each field's `confidence`.
- **Mehdi (API)**: serve `data/processed/<region>/indicators.json` at `GET /indicators/{region}`; decide region codes vs `regionX` (PRD §7) before wiring; expose `confidence` fields.
- **Nazim (frontend)**: `docs/data_contract.md` §7 has the field-by-field mapping. Broken items: frost unit ("%" vs days), erosion (no source — remove or find one), NDVI semantics, pH range vs scalar, stale rain. Use `climate_text.json` for sentences and `regions_summary.json` for map markers.
- **Aniss (comms/review)**: check `docs/about_data.md` attribution lines against the deliverable's needs and `process_disclosure.md` for accuracy.

## Open decisions (blockers for wiring, not for the pipeline)

1. Water-stress window + source (Alaa) — biggest lever, see `docs/sensitivity.md` (a)/(e).
2. All thresholds/windows (Younes).
3. Region ids + coordinates (Mehdi / Younes-Alaa) — coordinate B has a 3-way conflict.
4. Erosion field (Nazim + Younes).
5. SOC class bands — currently 10/20, all three regions "medium" either way.
