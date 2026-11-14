# Field Shift — Step 1 Report (data pipeline bootstrap, run & audit)

Author: Achref (data analysis) · Branch: `achref/step1-pipeline` · Date: 2026-11-14
Pipeline source: team Drive folder (`field_shift_drive_files/scripts/fetch_real_data.py`), copied **byte-identical** (`fc /B`: no differences, 16,776 bytes) to `analysis/fetch_real_data.py` and committed. Nothing in the pipeline logic was changed.

## 1. Summary (5 lines)

Pipeline v1 was brought into `analysis/`, run live for all 3 regions, and reproduced the Drive
run of 2026-11-13 **exactly** for every climate and soil value (POWER, SoilGrids) — and the NDVI
values 0.363 / 0.578 / 0.569 were **recomputed exactly from raw MODIS subsets**.
The single most important finding: **NASA POWER is systematically wetter and hotter than the ERA5
cross-check (rain +12–35%, hot days +22–56%)** — at Constantine POWER says 684 mm/yr where ERA5
says 491 mm/yr, and Tiaret POWER says 575 mm where ERA5 says 402 mm (≈ the documented ~420 mm).
Until this bias is resolved (Step 2: bias-check or source switch), every rainfall-derived
indicator (water_stress, trends, dry spells) must carry a "medium/low confidence" label.

## 2. What I did — commands, environment, APIs, run time

| Item | Detail |
|---|---|
| Branch | `achref/step1-pipeline` created from `main@45f1dbc` |
| Python | **3.12.10** used (PRD says 3.11; only 3.12.10 and 3.14 installed on this machine, no 3.11 available). v1 is stdlib-only, so it runs on 3.12 without changes. |
| PDF/docx reading | Extracted PRD v3 (12 pages, pypdf) and the agronomy guide (docx XML) inside a **temp venv** `C:\Users\ash\AppData\Local\Temp\opencode\pdfenv` (pypdf + certifi). No repo installs. |
| Network | NASA POWER ✔, ISRIC SoilGrids ✔, Open-Meteo ✔ (~0.5–5 s/call). ORNL MODIS: 503/502 proxy errors + Python missing the InCommon CA (peer cert verified genuine, not a MITM). Fixed with `SSL_CERT_FILE=<certifi>/cacert.pem` (env var only) and 180 s timeouts in my helper. ORNL latency measured 50–58 s/call; one full network drop mid-run (503s → DNS failure), recovered by re-running the resumable helper. |
| Pipeline run | `python analysis\fetch_real_data.py` (with `SSL_CERT_FILE` env), run 2 (run 1 hit the fresh-clone crash, see §9/§4): ~5 min, fetched_at `2026-11-14T12:30:22Z`. Log: `logs/run_fetch_2026-11-14.log` (gitignored `*.log`). |
| Raw capture | `python analysis\save_raw.py` — 17 min 03 s (13:10:27Z→13:27:30Z), 21 API calls with pauses/retries. All 3 regions × (POWER, SoilGrids, Open-Meteo, MODIS dates + 5 spring subsets 2020–2024) captured to `data/raw/<region>/` (gitignored). |
| Cross-check | `python analysis\crosscheck_openmeteo.py` → `data/processed/<region>/crosscheck_openmeteo.json` |
| NDVI recompute | Recomputed v1's exact algorithm (per-date 5×5 km mean, max over DOY 65–145 per year, mean 2020–2024, `(peak−0.25)/0.50`) from the raw subsets in a throwaway script — no repo changes. |

## 3. Files created or changed, and branch git log

Files (repo, committed or to be committed with this report):
- `analysis/fetch_real_data.py` — unchanged copy (source: `field_shift_drive_files/scripts/`)
- `analysis/requirements.txt`, `analysis/README.md`, `analysis/save_raw.py`, `analysis/crosscheck_openmeteo.py`
- `.gitignore` — now also ignores `venv/`, `.venv/`, `__pycache__/`, `data/raw/`, `*.pkl`, `*.log`, `field_shift_drive_files/`
- `data/processed/{setif,constantine,tiaret}/indicators.json`, `soil.json`, `crosscheck_openmeteo.json`
- `data/inputs/indicators.json`, `data/regional/all_indicators.json` (v1's own output paths)
- `logs/step1_report.md` (this file). `data/raw/**` and `*.log` stay local by design.

Git log (`achref/step1-pipeline`):
```
38a47e0 Add pipeline v1 to analysis/ (copied byte-identical from drive_files), requirements, README, .gitignore
cd6622d Add raw-response saver and Open-Meteo cross-check helpers (not part of v1 logic)
9d052ec Make save_raw.py resumable: skip files already saved in data/raw
28eabfb Merge branch 'main' into achref/step1-pipeline   (pull of he0swage's React+Vite frontend)
f4cdd4d Reorder save_raw (MODIS last, 180s timeout, pauses); extend crosscheck with Sep-May rain and Apr-Jun hot days
<report commit>  Add cleaned 3-region outputs and Step 1 report
```
Not pushed, per instruction.

## 4. How each indicator is computed now

| Indicator | Method (v1 code) | Window | Issue |
|---|---|---|---|
| `rainfall_mm` | mean annual sum of PRECTOTCORR | 2020–2024 (5-yr) | POWER wet bias vs ERA5 (§6) |
| `rainfall_30yr_mean_mm` | same | 1995–2024 | wet bias |
| `water_stress` | `(rain_1995_2014_mean − rain_2020_2024_mean) / rain_1995_2014_mean`, clamped 0–1 (line 201) | 20-yr ref vs 5-yr recent | docs disagree on reference (finding c) |
| `rainfall_trend_decade_mm` | Sen's median slope ×10 | 1995–2024 | — |
| trend p-values | OLS p via **normal approximation** `erfc` (lines 75–90); Mann-Kendall exact + tie correction | 1995–2024 | finding g |
| `hot_days` | mean annual days T2M_MAX > 35 °C | whole calendar year | finding b (not crop season) |
| `frost_days` | mean annual days T2M_MIN < 0 °C | whole calendar year | finding b; frontend unit mismatch (§8) |
| `extreme_rain_days` | mean annual days PRECTOTCORR > 20 mm | whole calendar year | threshold hardcoded (PRD wants thresholds.json) |
| `longest_dry_spell_days` | mean annual longest run of days < 1 mm | whole calendar year | findings b + h (missing days skipped → spells merge across gaps, dominated by Jun–Sep) |
| SOC / pH | SoilGrids v2.0, 3 layers (0–5/5–15/15–30 cm), depth weights 5:10:15, dg/kg ÷10; urban-mask fallback offsets ±0.02° | current SoilGrids snapshot | SOC class thresholds inconsistent across docs (finding d) |
| `yield_baseline` | MOD13Q1 250 m, per-date mean of 5×5 km patch, max per year over DOY 65–145 (spring), mean 2020–2024, normalized `(peak−0.25)/0.50` | 2020–2024 only | finding f (no cropland mask, no QA filter, 5 yr only) |
| `frost_risk` | `min(1, frost_days/40)` (line 343) | — | divisor 40 arbitrary, undocumented |
| `erosion_risk` | hardcoded per region (lines 35, 45, 55) | — | not data-derived at all |
| `suggested_priorities` | `25+28·stress / 22+24·soc_deficit / 20+30·yield_baseline`, rescaled to 100 (lines 335–341) | — | does not follow PRD §6.2 (finding e) |

## 5. Results for the 3 regions (this run, 2026-11-14)

| Value | Sétif (A) | Constantine (B) | Tiaret (C) |
|---|---|---|---|
| rainfall 5-yr (mm/yr) | 484.5 | 524.7 | 405.8 |
| rainfall 30-yr mean | 574.9 | 684.4 | 575.3 |
| reference 20-yr mean (1995–2014) | 607.8 | 724.7 | 603.4 |
| water_stress | 0.2029 | 0.2761 | 0.3275 |
| Sen trend (mm/decade) | −44.1 | −46.4 | −16.8 |
| OLS p / MK p | 0.0367 / 0.0092 | 0.1138 / 0.1435 | 0.5038 / 0.5441 |
| trend verdict | both agree (sig. ↓) | no clear trend | no clear trend |
| hot days /yr | 23.7 | 52.9 | 50.4 |
| frost days /yr | 34.6 | 5.7 | 11.1 |
| extreme rain days /yr | 3.6 | 5.0 | 4.8 |
| longest dry spell (mean, days) | 40.6 | 40.0 | 59.1 |
| SOC g/kg (SoilGrids live) | 12.52 | 17.08 | 12.38 |
| pH (SoilGrids live) | 7.77 | 7.50 | 7.57 |
| NDVI spring peak (mean 2020–24) | 0.431 | 0.539 | 0.535 |
| yield_baseline | 0.363 | 0.578 | 0.569 |
| suggested priorities (W/S/Y) | 34/29/37 | 35/23/42 | 36/27/37 |

All climate/soil values are **identical** to the Drive run of 2026-11-13 (see §7).

## 6. POWER vs Open-Meteo (ERA5) cross-check

30-year means, whole calendar year (same window as v1, apples-to-apples):

| Metric | Sétif POWER / ERA5 | Constantine POWER / ERA5 | Tiaret POWER / ERA5 |
|---|---|---|---|
| Annual rain (mm/yr) | 574.9 / 506.2 (**Δ −68.7**) | 684.4 / 491.2 (**Δ −193.2**) | 575.3 / 401.7 (**Δ −173.6**) |
| Sep–May rain (mm) | 575.7 / 509.5 (−66.2) | 688.5 / 493.9 (−194.6) | 580.7 / 405.8 (−174.9) |
| Hot days (>35 °C) /yr | 23.7 / 15.2 (+8.5) | 52.9 / 43.6 (+9.3) | 50.4 / 25.1 (**+25.3**) |
| Hot days Apr–Jun /yr | 3.1 / 1.9 | 9.7 / 8.0 | 9.2 / 3.3 |
| Frost days (<0 °C) /yr | 34.6 / 24.2 (+10.4) | 5.7 / 10.3 (**−4.6**) | 11.1 / 14.8 (**−3.7**) |
| Longest dry spell (d) | 40.6 / n.a.* | 40.0 / n.a.* | 59.1 / n.a.* |

\* ERA5 gridded precip has different wet-day statistics; dry-spell comparison is shown only in the saved JSON for reference — treat with caution either way.

Reading: POWER is wetter at every region (+12% Sétif, +35% Tiaret relative) and reports more >35 °C days everywhere, but *fewer* frost days at B/C. Tiaret ERA5 (401.7 mm) lands almost exactly on the documented ITGC baseline (~420 mm), and Constantine ERA5 (491 mm) is inside the documented 450–600 band, while POWER's 684 mm is far outside it. This supports finding (a): the pipeline's rainfall (and everything derived from it) is inflated, worst at Tiaret and Constantine.

## 7. Diff versus `drive_files/data_regional/all_indicators.json` (run 2026-11-13)

Identical fields (all 3 regions): rainfall (all three variants), water_stress, hot/frost/extreme/dry-spell days, monthly_rain_mm (all 36 values), trend values and both p-values, SOC, pH, soil sources, erosion_risk. **The climate and soil parts of v1 are fully reproducible.**

Differences (complete list):
| Field | Drive run | This run | Cause |
|---|---|---|---|
| `fetched_at` | 2026-11-13T23:42:49Z | 2026-11-14T12:30:22Z | expected |
| `yield_baseline` (A/B/C) | 0.363 / 0.578 / 0.569 | 0.44 / 0.66 / 0.51 | ORNL timed out at v1's 15/25 s limits on this network → v1 fell back to hardcoded regional baselines. **Recomputing from raw MODIS subsets reproduces the Drive values exactly** (0.363/0.578/0.569; mean peaks 0.431/0.539/0.535), so the Drive NDVI values are genuine. |
| `mean_spring_peak_ndvi` (A/B/C) | 0.431 / 0.539 / 0.534 | None | same timeout fallback |
| `sources.ndvi` | "live" | "Regional baseline (…timed out)" | same |
| `suggested_priorities` | 35/30/35 · 36/24/40 · 35/27/38 | 34/29/37 · 35/23/42 · 36/27/37 | shifted only because yield_baseline fell back |
| `organic_carbon.class` (A/C) | "Moderate (12-16 g/kg)" | "Moderate (12-15 g/kg)" | **the Drive script was edited after the 11-13 run** — the JSON on Drive was NOT produced by the script on Drive (see §9) |

## 8. Frontend vs pipeline (finding j, against the NEW React frontend `frontend/src/data/regions.js`)

| Field | Frontend A | Pipeline A | Frontend B | Pipeline B | Frontend C | Pipeline C | Same units? |
|---|---|---|---|---|---|---|---|
| lat/lon | 36.15/5.38 ✔ | 36.15/5.38 | **36.16/6.68** | **36.26/6.68** | 35.34/1.38 ✔ | 35.34/1.38 | n/a |
| rain | 485 ≈ | 484.5 (5-yr) | **516** | **524.7** | 408 ≈ | 405.8 | mm/yr; but frontend doesn't say which window (5-yr vs 30-yr differs a lot) |
| water | 20 ✔ | 0.2029 → 20 | 28 ✔ | 0.2761 → 28 | 33 ✔ | 0.3275 → 33 | % vs 0–1 ✔ (fixed since v0.1) |
| SOC | 12.52 ✔ | 12.52 | 17.08 ✔ | 17.08 | 12.38 ✔ | 12.38 | g/kg ✔ (fixed) |
| frost | 34 | **34.6 days/yr** | **25** | **5.7 days/yr** | **28** | **11.1 days/yr** | **NO — frontend shows "%"**, pipeline gives days/yr. A looks like truncated days; B matches neither days nor `frost_risk` (14); C equals `frost_risk`·100 (28). Three different meanings. |
| erosion | **38** | **0.48 → 48%** | **35** | **0.28 → 28%** | 44 ✔ | 0.44 | % vs 0–1; A and B are wrong values, C coincidentally right |
| NDVI/yield | **0.44** | **0.363** | **0.49** | **0.578** | **0.47** | **0.569** | frontend still carries the old placeholder values |
| pH | [7.3, 8.4] range | 7.77 scalar | [7.2, 8.2] | 7.50 | [7.2, 8.3] | 7.57 | frontend shows a range, pipeline a single mean — different shape, not a unit issue |

Also: `frontend/src/utils/agronomy.js` still classifies SOC at 12/16 g/kg (pipeline: 10/12/15; see finding d), and the frontend still has no frost/erosion/NDVI refresh path from `data/processed/` (all sample data in JS).

## 9. Findings a–l

| # | Verdict | Evidence |
|---|---|---|
| a | **CONFIRMED** (with a twist) | Sétif 30-yr POWER mean = 574.9 mm/yr vs ~380 mm in REGIONAL_CROPS_AND_RULES.md and regions.json baseline 380 — POWER is +51% vs the doc. But the ERA5 cross-check says 506.2 mm — also above 380. So "POWER too wet" is true, and part of the gap (~120 mm) survives the cross-check; the 380 figure itself may be an older/drier period or station-specific. Do not silently adopt 380 as truth. |
| b | **CONFIRMED** | `fetch_real_data.py:150–166,171–183`: hot/frost/extreme/dry-spell counts iterate every day of the year; no season filter anywhere. The Jun–Sep dry months dominate the dry-spell metric (Tiaret monthly rain Jul 4.4 mm). |
| c | **CONFIRMED** | Script (line 196–201): reference = region's own 1995–2014 mean. Guide (§1.1): "Rain_ref = 400 mm" fixed. regions.json: reference 480/600/520 per region. PRD glossary: "the reference rainfall" (undefined). Three documented definitions + one coded; PRD §6.2's `water_stress/0.3` rule depends on which is chosen. |
| d | **CONFIRMED** | Script: threshold 15 g/kg, classes Low<10 / Low-Mod 10–12 / Mod 12–15 / Adequate>15 (lines 325–332). Guide: only "Low SOC (< 10 g/kg)" stated; the claimed "medium 10–20, high >20" bands are NOT in this copy of the guide. Frontend (`agronomy.js`): Low<12 / Moderate 12–16 / High>16. Four different schemes; the Drive JSON even shows a fifth (12–16 label from the pre-edit script). |
| e | **CONFIRMED** | PRD §6.2: water=min(1,stress/0.3); soil=1/0.5/0.1 by class; yield=max(0.2,1−max(two)); rescale. Script (lines 335–341): `raw_w=25+28·stress; raw_s=22+24·soc_def; raw_y=20+30·yb`. Completely different rule. Also script/frontend use key `yield`; the PRD API contract uses `yield_` in POST /recommend (and the PRD says spelling must match exactly everywhere). |
| f | **CONFIRMED (code), reproduced (values)** | Lines 263–304: 2020–2024 only; no ESA WorldCover cropland mask (guide §2.2 asks for class 40); no MODIS QA/QC band fetched at all — only value-range filter (−2000…10000, ≠−3000) on a 5×5 km patch mean. Nevertheless the produced values 0.363/0.578/0.569 were reproduced exactly from raw subsets, so they are trustworthy *as far as the method goes*; the method itself is the issue (urban/bare pixels can sit inside 5×5 km). |
| g | **CONFIRMED** | `normal_two_sided_p` = `math.erfc(|z|/√2)` (lines 75–76, 90) — a normal approximation of the OLS t-test p-value with n=30 (df=28). Effect is small but real near the 0.05 boundary (Sétif OLS p=0.0367 would shift a bit under a true t-distribution). Step 2 should use scipy (PRD stack). |
| h | **CONFIRMED** | Line 154: any day with any −999 is skipped from all metrics, including dry-spell counting → a dry run before and after a missing day counts as one continuous spell, and short records can shorten a year's max spell. ERA5 series have 0 missing days; POWER has some. |
| i | **CONFIRMED** | v1 writes only `indicators.json` + `soil.json` (+ `data/inputs/`, `data/regional/` copies). No `climate_yearly.json`, no `climate_monthly.json`, no `data_quality.md` (PRD §7 requires all three per region). `confidence` in indicators.json is trend-only string + p-values; no high/medium/low per indicator (PRD §6.4). Monthly rain exists only as a 12-value mean array, not a per-month series. |
| j | **CONFIRMED** | See the full table in §8: region B latitude 36.16 vs 36.26; frost % vs days; erosion A/B wrong; NDVI all three stale; rain B off by 9 mm and window unclear. |
| k | **CONFIRMED** | Only Sétif passes (OLS p 0.0367, MK p 0.0092, same sign, Sen −44.1 mm/decade); Constantine (0.11/0.14) and Tiaret (0.50/0.54) = "no clear trend". The PRD placeholder "9 to 24 mm per decade" is NOT what the data shows (Sétif −44.1 is outside that range) and must not be presented as a finding. Note −44.1 also fails the normal-approx caveat (finding g) — borderline. |
| l | **CONFIRMED (repo is clean today)** | No secrets (`.env.example` blank keys; no `.env` tracked), no tracked file >1 MB (raw 1.2 MB POWER payloads are gitignored), frontend makes zero data API calls (sample data + optional `VITE_API_BASE`), no `.pkl` files. CropSense/DharaaAI: referenced conceptually in the guide (Datasets 4/5, "scaler.pkl + knn_model.pkl" as *descriptions*) and REGIONAL_CROPS_AND_RULES.md explicitly says the Algerian tables *replace* CropSense/DharaaAI data. No code copied from them found in this repo. SYNC_NOTES.md claims `engine/scoring.py`, 8/8 tests and a Monte Carlo exist — **none of that is in this repo** (engine/ empty); treat SYNC_NOTES as describing another workspace. |

**Additional findings (from decision 4):**
- **Fresh-clone crash:** v1 never creates `data/inputs/` or `data/regional/` (only `data/processed/<code>/` is mkdir'ed, line 345–346), so on a clean clone `run_all()` throws `FileNotFoundError` at `fetch_real_data.py:402` **after** writing the per-region files, and `data/regional/all_indicators.json` is never written. Reproduced on run 1; fixed by manually creating the dirs (environment, not code). Fix belongs in Step 2 (add `mkdir(parents=True)` before those writes) — not done now per "don't change logic".
- **Python 3.12 vs PRD 3.11:** used 3.12.10; PRD's stack line says Python 3.11. No functional impact today (stdlib-only), but pin the interpreter version for Step 2 when pandas/numpy/scipy arrive.
- **Drive script ≠ Drive output:** the JSON's SOC label "Moderate (12-16 g/kg)" cannot be produced by the current script (which emits "Moderate (12-15 g/kg)") — the script was edited after the 11-13 run. The 16,776-byte local copy vs the mentioned 16,777-byte Drive original (likely a trailing newline) could not be verified from here; the local copy is self-consistent and byte-copied, so this does not affect any result.

## 10. Open questions for the team

- **Younes:** Which rainfall reference is canonical (region-own 20-yr mean vs fixed 400 mm vs regions.json 480/600/520)? Which SOC class bands are canonical? Is 380 mm for Sétif a station figure we should keep as the "farmer expectation" anchor? Sunflower appears with three different water needs (ETc 600–1000, optimal rain 420–800, rules min 450) — which one rules the engine?
- **Alaa:** The engine reads `water_stress` and SOC — which class boundaries do you want in `thresholds.json`? Confirm K_WATER/K_SOIL = 1.5 and how `soc_deficit` maps to soil stress. Do you want the trend p-values recomputed with scipy t-distribution before you display "both methods agree"?
- **Mehdi:** The API contract needs `climate_yearly.json` / `climate_monthly.json` and a per-indicator confidence enum that don't exist yet — agree the exact schema in Step 2 before you build (PRD §7 keys: region/year/month). Is `POST /recommend` (not `/recommendations`) final?
- **Nazim:** Frontend values that contradict the pipeline (§8) need a decision: do we wire `data/processed/<region>/indicators.json` into `frontend/src/data/regions.js`, or do you keep hardcoded values until the API exists? Frost must switch from "%" to days/year (or we add a real frost_risk definition — current `frost_days/40` is arbitrary).
- **All:** PRD says Younes provides `thresholds.json` (hot/frost/extreme-rain/dry-day/reference-rainfall) — it exists only partially inside `rules_algeria.json` (no extreme-rain >20 mm, no dry-day <1 mm, no reference rainfall). Who owns the missing file?

## 11. Recommended plan for Step 2 (ordered)

1. **Fix the fresh-clone crash + write missing outputs** (0.5 d): `mkdir` before `data/inputs/`, `data/regional/`; emit `climate_yearly.json` + `climate_monthly.json` per region from the already-computed aggregates; add per-indicator confidence (high/medium/low from p-values + missing-day share) and `data_quality.md` (source, missing days, fallback used).
2. **Resolve the rainfall bias** (1 d): decide POWER-vs-ERA5 policy (report both, or use ERA5 as primary with POWER as secondary), and recompute `water_stress`, trends, dry spells under the chosen source; document in `data_quality.md`. This is the biggest credibility item for judges.
3. **Season-aware metrics** (0.5 d): hot days (Apr–Jun or grain-fill window), frost (Mar–Apr), dry spell (Sep–Jun), keep whole-year values alongside for continuity.
4. **SOC class unification** (0.5 d): one scheme from Younes, emitted in indicators.json and mirrored in `domain/thresholds.json`; update `agronomy.js` later (frontend change needs Nazim's OK).
5. **NDVI hardening** (1 d, needs Earthdata): add AppEEARS + WorldCover cropland mask (class 40) and pixel QA; keep ORNL fallback; extend years if API allows. Optional: inter-annual CV for yield stability.
6. **Statistical upgrade** (0.5 d): scipy t-distribution for OLS p; keep Mann-Kendall exact; emit both with the agreement flag.
7. **Suggested priorities to PRD §6.2** (0.5 d): implement the PRD rule behind a flag, compare outputs with the current heuristic side-by-side, let Younes pick.
8. **Contract conformance pass** (0.5 d): rename/alias `yield_`, verify every indicators.json key against the PRD §6.5/§7 contract, and hand Mehdi a schema example per region.

Total ≈ 5 analyst-days; items 1–3 unblock Alaa and Mehdi first.
