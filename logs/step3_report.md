# Step 3 report — verification, sensitivity, handoff package

Owner: Achref · 2026-11-14 · branch `achref/step1-pipeline` (local only, not pushed)

## 1. Summary

- Built `analysis/verify_independent.py`: a from-scratch re-implementation (pure dict/NumPy, no pandas, zero shared code with the pipeline) of 11 headline values per region — **all 33 comparisons PASS**, differences only within the stored-value rounding tolerance (≤0.04 on 1-decimal fields, ≤4e-5 on p-values).
- Built `analysis/sensitivity.py` + `docs/sensitivity.md`: quantified how every placeholder decision moves the headline numbers; conclusions that survive (Sétif decline, stress > 0 everywhere) and those that don't (magnitudes, region ranking) are now explicit.
- Wrote `docs/decision_sheet.md` (12 decisions with owner + exact edit location), `docs/handoff_data.md`, `docs/PR_DESCRIPTION.md`, `docs/process_disclosure.md`, `docs/about_data.md` (provider citation terms verified online), `docs/glossary_data_terms.md`, `docs/gaps_draft.md`.
- Added `climate_text.json` (deterministic farmer sentences, en/fr/ar keys, en filled) and `regions_summary.json` to the pipeline outputs — announced as additive changes in `docs/data_contract.md`.
- One command now does everything: `python analysis/run_all.py` → build → sensitivity → verify → tests, prints ALL PASS.

## 2. Verification results

Method: `verify_independent.py` parses the raw JSON with plain loops (no pandas), aggregates with dicts, computes OLS slope/p manually (no `linregress`), MK with a different variance/p path (scipy `norm.sf` vs `erfc`), Sen slope via NumPy median, dry spells via `itertools.groupby`, season slicing via explicit date-string comparison. Tolerance: half a unit of the stored rounding (0.051 for 1-decimal, 0.0051 for 2-decimal values, 1e-3 for p-values).

| Value (per region) | Sétif | Constantine | Tiaret | status |
|---|---|---|---|---|
| rainfall_mm (2015–2024) | diff 0.025 | 0.028 | 0.022 | OK ×3 |
| rainfall_30yr_mean_mm | 0.008 | 0.031 | 0.028 | OK ×3 |
| hot_days (Apr–Jun > 35 °C) | 0.033 | 0.0 | 0.033 | OK ×3 |
| frost_days (Mar–Apr < 0 °C) | 0.033 | 0.0 | 0.0 | OK ×3 |
| longest_dry_spell_days | 0.033 | 0.0 | 0.0 | OK ×3 |
| trend OLS slope / p | 0.031 / 3.8e-5 | 0.008 / 4e-5 | 0.021 / 1.3e-5 | OK ×3 |
| trend Sen slope / MK p | 0.038 / 7e-6 | 0.038 / 2.3e-5 | 0.012 / 2e-5 | OK ×3 |
| SOC g/kg, pH | 0.003 / 0.003 | 0.003 / 0.0 | 0.003 / 0.003 | OK ×3 |

- Every nonzero difference is smaller than the stored rounding step (values are stored with 1–2 decimals) — no genuine discrepancies found, nothing to explain away.
- Hand-check (paper-style, printed by the script for human verification): frost days per region with all 30 per-year counts and the exact 2024 dates + raw Tmin values. Sétif: counts sum 136 over 30 years = 4.5333 → stored 4.5. Constantine: 12/30 = 0.4 exactly. Tiaret: 33/30 = 1.1 exactly. A human can re-add these from the printout alone.
- Informational: Mann-Kendall S = −147 / −83 / −35 (S not stored in the JSON).

## 3. Sensitivity findings (details in `docs/sensitivity.md`)

**Robust (safe to build on):**
- Only Sétif has a statistically significant rainfall decline — confirmed by OLS **and** Mann-Kendall, on POWER **and** ERA5 (ERA5 p = 0.004/0.017).
- No region shows a significant increase.
- Water stress > 0 for every region under every variant (recent decades drier than 1995–2014 by all definitions).
- Sétif is the frostiest region in spring under both window variants; Sétif has the fewest hot days at every threshold.

**NOT robust (do not hardcode in the UI/engine):**
- Water-stress magnitude and region ranking: Tiaret spans **0.01–0.33** depending on window/source; ranking flips. This is Alaa's decision (#1 lever).
- Hot-day counts: threshold 33 vs 37 °C is a ~×2.5 multiplier (Sétif 7.9 → 0.9).
- Frost counts: adding February roughly triples them (Sétif 4.5 → 14.7).
- Absolute rainfall: POWER is 13–43% wetter than ERA5.
- Season window Oct–May vs Nov–Jun: minor (40–60 mm rain, 1–2 spell days) — low stakes.

## 4. Files created (this step)

| File | What |
|---|---|
| `analysis/verify_independent.py` | independent verifier + hand-check dumps |
| `analysis/sensitivity.py`, `data/processed/sensitivity.json` | decision-variant table |
| `analysis/run_all.py` | one-command rebuild+verify+tests with PASS/FAIL summary |
| `analysis/make_charts.py`, `analysis/charts/*.png` (10) | climate charts, 1600×900, Okabe-Ito palette, ≤190 KB each |
| `data/processed/<region>/climate_text.json` | deterministic farmer sentences (en filled; fr/ar keys ready) |
| `data/processed/regions_summary.json` | per-region map summary (id, lat/lon, Sen slope, trend label, confidence) |
| `docs/sensitivity.md`, `docs/decision_sheet.md` | robustness table; 12-decision one-pager |
| `docs/about_data.md`, `docs/glossary_data_terms.md` | about-data w/ verified citation lines; farmer glossary |
| `docs/gaps_draft.md` | 9-entry draft for Younes's gaps.json |
| `docs/process_disclosure.md`, `docs/handoff_data.md`, `docs/PR_DESCRIPTION.md` | disclosure (commit-dated), handoff, PR draft |
| `analysis/README.md`, `analysis/requirements.txt` | run_all documented; matplotlib added, versions capped |

## 5. Decisions still pending and owners

(unchanged from step 2, now quantified — see `docs/decision_sheet.md`)
1. **Alaa**: water-stress recent window + source (biggest lever: Tiaret 0.01–0.33); `yield_` key name.
2. **Younes**: all windows/thresholds/SOC bands (hot threshold ×2.5, frost window ×3 levers).
3. **Mehdi**: region ids (`regionX` vs codes) before API wiring.
4. **Younes/Alaa**: regionB coordinate (36.26 vs 36.36 vs 36.16 three-way conflict).
5. **Nazim(+Younes)**: erosion field — no data source exists; frontend value is a placeholder.
6. **Aniss/Younes**: review about-data attributions, glossary, gaps wording, disclosure.

## 6. Test and run results

```
python analysis\run_all.py --stamp "2026-11-14 step3"

===== build: PASS
===== sensitivity: PASS
===== verify: RESULT: PASS        (33/33 OK)
===== tests: 45 passed
================ SUMMARY ================
  build        PASS
  sensitivity  PASS
  verify       PASS
  tests        PASS
ALL PASS
```

Second full run reproduced byte-identical outputs (clean `git status` afterwards).

## 7. Risks and limitations

1. **All thresholds are still placeholders.** The numbers are verified correct *given* the placeholders; the placeholders themselves are agronomic choices awaiting Younes/Alaa. Sensitivity doc shows exactly what each choice moves.
2. **POWER wet bias** (step-1 finding e) is unresolvable with current data; it mostly cancels in water stress but not in absolute rainfall. Confidence labels carry it.
3. **Charts derive from committed processed data**, not raw — they auto-update on rebuild via `make_charts.py`, but the committed PNGs lag if someone edits JSONs without re-running the script (run_all prints a reminder? no — noted here instead; make_charts is not yet inside run_all).
4. **Python 3.12.10 vs PRD's 3.11** — no 3.12-only features used; unpinned environments could drift (versions now capped in requirements.txt).
5. **Provider version numbers**: POWER's exact "Daily 2.x.x" version of our fetches wasn't captured in `data/raw/` (flagged in about_data; next `save_raw.py` run should keep response headers).
6. `climate_text.json` sentences are template-built, but the *templates* are my wording — Younes/Aniss should review tone before the UI shows them.

## 8. Handoff checklist per teammate

- **Younes**: go through `docs/decision_sheet.md` rows 1–6, 9; edit `domain/thresholds.json`; re-run `run_all.py` (must print ALL PASS).
- **Alaa**: decide stress window (`water_stress.recent_window`) + confirm `yield_` key; review PRD 6.2 implementation in `build_indicators.py`.
- **Mehdi**: pick region id scheme; wire `GET /indicators/{region}` to `data/processed/`; expose `confidence`.
- **Nazim**: follow `docs/data_contract.md` §7; use `climate_text.json` + `regions_summary.json`; fix frost/erosion/NDVI/pH presentation.
- **Aniss**: review `docs/about_data.md`, `docs/process_disclosure.md`, `docs/glossary_data_terms.md`, `docs/gaps_draft.md`.

## 9. What I recommend next

1. Younes/Alaa decisions (a 30-minute call kills all of them); then one `run_all.py` regenerates everything — the pipeline is decision-driven by design.
2. Nazim wires the frontend from `climate_text.json` + `indicators.json` per the contract table; drop the hardcoded REGIONS numbers.
3. Open the PR with `docs/PR_DESCRIPTION.md` after the pending decisions land (avoids a second review round).
4. Optional extras (SARIMA layer, SMAP soil moisture, NDVI cropland mask) — only after the main flow works, per the PRD time rules.
