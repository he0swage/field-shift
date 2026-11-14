# Step 2 report — offline indicator pipeline (v2)

Owner: Achref · 2026-11-14 · branch `achref/step1-pipeline` (local only, not pushed)

## 1. Summary

- Built `analysis/build_indicators.py`: an offline, deterministic v2 pipeline that reads the raw API responses saved in Step 1 (`data/raw/<region>/`) plus `domain/thresholds.json` and writes the full per-region JSON contract — no live API calls, same input → byte-identical output.
- All PRD §7 files now exist for the 3 regions: `climate_yearly.json`, `climate_monthly.json`, `indicators.json`, `soil.json`, `data_quality.md`.
- 45 pytest tests pass (known answers, no −999 in outputs, contract schema, determinism).
- Headline (Sétif / Constantine / Tiaret): rain 2015–2024 = 509.0 / 603.8 / 519.1 mm; water stress = 0.16 / 0.17 / 0.14; hot days (Apr–Jun) = 3.1 / 9.7 / 9.2; frost days (Mar–Apr) = 4.5 / 0.4 / 1.1; priorities = 36-33-31 / 37-33-30 / 32-34-34.
- Rainfall trend: only Sétif shows a statistically significant decline (OLS −46.7, p = 0.046; Sen −44.1, p = 0.009 → "both methods agree", high confidence). Constantine and Tiaret: "no clear trend".

## 2. What was built (files)

| File | Purpose |
|---|---|
| `domain/thresholds.json` | Every threshold/window with `"status": "placeholder - pending Younes"`, plus the confidence rules and a self-recorded sha256 (each output records `thresholds_used.sha256_16`). |
| `domain/regions.csv` | Region ids/codes/labels + the pipeline coordinates (36.15/5.38, 36.26/6.68, 35.34/1.38) with coordinate-conflict flags vs regions.json and the frontend. |
| `analysis/build_indicators.py` | v2 pipeline (offline). v1 `fetch_real_data.py` untouched. |
| `analysis/requirements.txt` | pandas≥2.0, numpy≥1.26, scipy≥1.11, pytest≥8.0. |
| `analysis/tests/` (7 files) | 45 tests. |
| `docs/data_contract.md` | Full key schema + "frontend field → pipeline field" table for Nazim. |
| `analysis/README.md` | One-command reproducibility instructions. |
| `data/processed/<region>/` | The 5 output files per region (small, committed). |

Reproduce with:

```powershell
python analysis\build_indicators.py --stamp "2026-11-14 step2"
python -m pytest analysis\tests -q
```

## 3. Decisions made and who must confirm them

| Decision | Chosen value | Who confirms |
|---|---|---|
| Growing season | Oct(year−1)–May(year) | Younes |
| Grain-filling (hot days) | Apr–Jun, Tmax > 35 °C | Younes |
| Late frost | Mar–Apr, Tmin < 0 °C | Younes |
| Extreme rain day | > 20 mm/day, calendar year | Younes |
| Dry day / dry spell | < 1 mm/day, spells **break** at missing days (never merged — fixes v1 finding h) | Younes |
| SOC classes | low < 10, medium 10–20, high > 20 g/kg (v1 had 10/12/15; frontend 12/16) | Younes |
| Water stress | max(0, 1 − recent/ref), ref = region's own 1995–2014 mean; recent = 2015–2024. v1's 2020–2024 version kept as `water_stress_5yr` | Alaa |
| Priorities | Exactly PRD §6.2; `yield_` keeps the trailing underscore; largest-remainder integer rounding | Alaa (API must use this key) |
| Region naming | codes (`setif`/`constantine`/`tiaret`) in folder paths; PRD says `regionX` | Mehdi |
| Coordinates | pipeline 36.26/6.68 for regionB vs regions.json 36.36/6.61 vs frontend 36.16/6.68 | Younes or Alaa |
| Erosion | Not computed — no source. Frontend's 38/35/44 "%" is a v1 hardcoded guess (0.48/0.28/0.44) | Nazim (remove or source it) |

Nothing blocks on these; all are marked in the outputs.

## 4. Results table — v2 vs v1 vs frontend

| Indicator | Region | v2 (new) | v1 (Drive run) | Frontend (regions.js) |
|---|---|---|---|---|
| Annual rain (mm/yr) | setif | **509.0** (2015–2024) | 574.9 (1995–2024) | 485 |
| | constantine | **603.8** (2015–2024) | 684.4 (1995–2024) | 516 |
| | tiaret | **519.1** (2015–2024) | 575.3 (1995–2024) | 408 |
| Water stress (0–1) | setif | **0.1625** (ref 1995–2014 vs 2015–2024); 5-yr variant 0.2029 | 0.2029 (= v2's 5-yr variant) | 0.20 |
| | constantine | **0.1668**; 5-yr 0.2761 | 0.2761 | 0.28 |
| | tiaret | **0.1397**; 5-yr 0.3275 | 0.3275 | 0.33 |
| Hot days (days/yr) | setif | **3.1** (Apr–Jun) | 23.7 (whole year) | — |
| | constantine | **9.7** (Apr–Jun) | 52.9 (whole year) | — |
| | tiaret | **9.2** (Apr–Jun) | 50.4 (whole year) | — |
| Frost days (days/yr) | setif | **4.5** (Mar–Apr) | 34.6 (whole year) | 34 "%" |
| | constantine | **0.4** (Mar–Apr) | 5.7 (whole year) | 25 "%" |
| | tiaret | **1.1** (Mar–Apr) | 11.1 (whole year) | 28 "%" |
| Extreme rain days | all | **3.6 / 5.0 / 4.8** (>20 mm) | not computed | — |
| Longest dry spell (days) | all | **23.5 / 22.7 / 32.2** (in season) | not computed | — |
| SOC (g/kg) | all | 12.52 / 17.08 / 12.38 | same | same |
| pH | all | 7.77 / 7.50 / 7.57 | same | ranges 7.3–8.4 etc. |
| NDVI yield baseline | all | 0.363 / 0.578 / 0.569 (recomputed, matches Drive) | same | 0.44 / 0.49 / 0.47 (different semantics) |
| Priorities (save/soil/yield) | setif | **36 / 33 / 31** | not computed | — |
| | constantine | **37 / 33 / 30** | not computed | — |
| | tiaret | **32 / 34 / 34** | not computed | — |

Plain-language explanations of the big changes:

- **Hot days 23.7 → 3.1**: v1 counted every day above 35 °C in the whole calendar year (including July–August summer heat). v2 counts only the grain-filling window Apr–Jun, which is what actually damages wheat. Both numbers are "true"; they answer different questions. Same for frost (34.6 → 4.5: only Mar–Apr matters; the rest of the winter frosts don't hit the crop at that stage).
- **Water stress 0.2029 → 0.1625 (Sétif)**: the window. v1 compared 2020–2024 against 1995–2014; v2's primary is 2015–2024 (10 years, less noisy). The v1 number is preserved as `water_stress_5yr`. Note the 5-yr numbers are much higher everywhere — the last 5 years were the driest of the record.
- **Rain 574.9 → 509.0 (Sétif)**: window again (30-yr mean vs 2015–2024 mean) plus the known POWER wet bias — the ERA5 cross-check is 506.2 (30-yr) / 405.5 (2015–2024) and the ERA5 values sit inside the ITGC ranges while POWER's Constantine/Tiaret values sit above them (Step-1 finding e). Absolute rainfall carries medium/low confidence; water stress is safer because a steady bias largely cancels in the ratio.
- **Frost "%" in the frontend is broken**: regionA 34 = v1's whole-year frost days mislabeled as %, regionB 25 and regionC 28 don't match any pipeline quantity. Needs Nazim's decision (see `docs/data_contract.md` §7).
- **Tiaret priorities changed ranking** (v2: soil 34 > water 32 > yield 34 — an exact three-way tie broken deterministically): with the seasonal windows and 2015–2024 stress, Tiaret is nearly balanced; the engine must not assume water always ranks first.

## 5. Confidence table (rule: ≤10% → high, ≤25% → medium, else low; −1 level if >5% days missing)

| Indicator | Sétif | Constantine | Tiaret | Note |
|---|---|---|---|---|
| rainfall (30-yr rel. diff vs ERA5) | 13.6% → medium | 39.3% → low | 43.2% → low | POWER wet bias documented in each `data_quality.md` |
| hot days (Apr–Jun diff) | 62.5% → low | 21.6% → medium | 175% → low | |
| frost days (Mar–Apr diff) | 45.5% → low | 41% → low | 22% → medium | frost counts are small, so % diffs are large; treat as weak signal |
| trend | high (both methods agree) | low ("no clear trend") | low ("no clear trend") | |
| soil | medium | medium | medium | 250 m model estimate, PRD §6.4 |
| NDVI / extreme rain / dry spell | low | low | low | NDVI: no cropland mask, no pixel QA, 5×5 km patch, 5 years; extreme/dry-spell crosschecks not comparable at ERA5 grid scale |
| water stress | pending Alaa | pending Alaa | pending Alaa | formula choice + reference method |
| Missing data | 0% | 0% | 0% | no missing-day downgrade triggered |

## 6. Trend results (rain, 1995–2024, mm/decade)

| Region | OLS slope | OLS p | Sen slope | MK p | Label | Confidence |
|---|---|---|---|---|---|---|
| Sétif | −46.7 | 0.0459 | −44.1 | 0.0092 | **both methods agree** | high |
| Constantine | −47.3 | 0.125 | −46.4 | 0.1435 | no clear trend | low |
| Tiaret | −21.0 | 0.509 | −16.8 | 0.544 | no clear trend | low |

Sétif is drying by ≈45 mm per decade (≈8% of its recent mean) and both independent methods agree. Constantine has a similar point estimate but not significant. v1 used only OLS with a normal approximation; v2 uses scipy's t-distribution plus a Mann-Kendall test with tie correction and Sen's slope.

## 7. Test results

```
analysis\tests  45 passed in 89.92s (0:01:29)
```

Coverage: dry spells (missing days break spells, strict <1 mm threshold), hot/frost/extreme counts and window slicing, OLS/MK/Sen known-answer series (monotonic, alternating, all-ties), SOC/pH depth-weight conversion and class bands, PRD 6.2 priorities (sum to 100 across a grid, exact known answers, deterministic, `yield_` key), −999 sentinel absent from all outputs, indicators/climate schemas match `docs/data_contract.md` (including no undocumented keys), and byte-identical rebuild from the same raw inputs.

## 8. Known limitations

1. **POWER's wet bias is real and documented** (Step-1 finding e): ERA5/ITGC say Sétif ≈500 mm, Constantine ≈490, Tiaret ≈400–520; POWER 30-yr means run 13–43% higher. Confidence labels carry this; the engine should not consume raw POWER rainfall without the confidence field.
2. **Water stress pending Alaa** — the 2015–2024 vs 2020–2024 choice changes the headline by 0.04–0.19 (Tiaret worst case).
3. **NDVI is low-confidence**: no cropland mask, no pixel QA filter, 5×5 km patch, only 5 years, and the yield baseline (0.25–0.75 normalization) is a linear proxy, not a calibrated yield.
4. **No erosion indicator** — the frontend value is a hardcoded v1 guess with no source.
5. **Frontend Coordinate B differs** (36.16 vs 36.26 vs 36.36) — three-way conflict, unconfirmed.
6. **Python version**: PRD says 3.11; machine runs 3.12.10 (noted in step-1 report; v2 uses no 3.12-only features).
7. Dry spells "low" confidence partly because the ERA5 cross-check for spells wasn't meaningful at grid scale (documented, not silently skipped).
8. `data/raw/` is gitignored — a fresh clone must run `analysis/save_raw.py` once (internet, ~10–30 min) before `build_indicators.py` works; tests skip gracefully when raw data is absent.

## 9. Handoff notes

- **Alaa (engine)**: consume `indicators.json`. Water stress key: use `water_stress` (2015–2024) unless you confirm 2020–2024; `water_stress_5yr` is the sensitivity twin. Priorities: key is exactly `yield_` (trailing underscore, per the API contract) and the three values always sum to 100. Rule in PRD §6.2, implemented in `suggested_priorities()`.
- **Mehdi (API)**: serve `data/processed/<region>/indicators.json` at `GET /indicators/{region}`. Decide the region naming (codes vs `regionX`, PRD §7) before wiring. Every numeric field has a sibling `confidence`; expose it.
- **Nazim (frontend)**: mapping table is `docs/data_contract.md` §7. Do not edit the frontend in this step. Points needing you: frost unit (days vs "%"), erosion (no source — remove or find one), NDVI semantics (`yield_baseline` ≠ the old raw-ish NDVI), pH range vs scalar, rain window (2015–2024, not "just a number"). REGIONS moved to `frontend/src/data/regions.js` in the React migration.
- **Younes**: confirm every threshold in `domain/thresholds.json` (all marked pending) — especially the windows, since they move headline numbers a lot (hot days 23.7→3.1 style changes). SOC class bands are 10/20 (v1 had 10/12/15; frontend 12/16) — one consistent band, please.

## 10. Recommended step 3

1. Younes/Alaa confirm the pending values; regenerate; diff is mechanical (thresholds.json drives everything).
2. Chart data/images for the Climate screen (monthly rainfall bars, yearly trend line with both slopes) — engine + charts are the remaining Must work before H24/H34.
3. Nazim wires the frontend to the JSON files per `docs/data_contract.md` §7; drop `est` flags in favor of `confidence`.
4. Handoff note + PR to main.
5. Optional (only if main flow works): ARIMA forecast layer, SMAP soil moisture, NDVI with cropland mask.
