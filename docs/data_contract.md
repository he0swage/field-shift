# Field Shift data contract (v2 pipeline)

Owner: Achref (data analysis) · Generated from the v2 pipeline (Step 2).
The API and frontend read exactly these files; changes are announced before anyone builds on them (PRD v3 §6.5).

## 1. Files

| File | Written by | Size class | Contents |
|---|---|---|---|
| `data/processed/<region>/climate_yearly.json` | `analysis/build_indicators.py` | small | per-year climate rows |
| `data/processed/<region>/climate_monthly.json` | `analysis/build_indicators.py` | small | monthly means + per-year monthly rows |
| `data/processed/<region>/indicators.json` | `analysis/build_indicators.py` | small | headline indicators for the API/UI |
| `data/processed/<region>/soil.json` | `analysis/build_indicators.py` | small | SoilGrids SOC + pH |
| `data/processed/<region>/data_quality.md` | `analysis/build_indicators.py` | small | missing data, gaps, source disagreements, caveats |
| `data/processed/<region>/climate_text.json` | `analysis/build_indicators.py` | small | **NEW in step 3 — announced 2026-11-14**: one plain-language sentence per indicator for the UI (`en`/`fr`/`ar` keys; `en` filled, `fr`/`ar` empty for now) plus a `_confidence` field per entry. Deterministic templates built from the same numbers as `indicators.json`. |
| `data/processed/regions_summary.json` | `analysis/build_indicators.py` | small | **NEW in step 3 — announced 2026-11-14**: one row per region (`id`, `name`, `lat`, `lon`, `rainfall_trend_mm_per_decade` = Sen slope, `trend_label`, `trend_confidence`) for map markers. |
| `domain/thresholds.json` | Achref, values pending Younes | small | every threshold/window the pipeline and engine share |
| `domain/regions.csv` | Achref | small | region ids, codes, pipeline coordinates + coordinate-conflict flags |

`<region>` ∈ {`setif`, `constantine`, `tiaret`} (PRD says `regionX` naming — **pending Mehdi**: v1/v2 use codes; rename decision needed for `GET /indicators/{region}`).

All values are computed OFFLINE from `data/raw/` (POWER, Open-Meteo/ERA5, SoilGrids, MODIS ORNL raw JSON responses). The demo never calls live APIs (PRD data rule). v1 (`fetch_real_data.py`) stays untouched as the live-fetch reference; its output paths (`data/inputs/`, `data/regional/`) are legacy.

## 2. climate_yearly.json

```json
{ "region": "<code>", "description": "...", "rows": [ ... ] }
```

| Key (per row) | Type | Unit | Window | Source | Notes |
|---|---|---|---|---|---|
| region | string | — | — | — | region code (`setif`/…) — PRD harmonization key |
| year | int | — | — | — | calendar year 1995–2024 |
| annual_rain_mm | float\|null | mm | calendar year | POWER | null if no data that year |
| growing_season_rain_mm | float\|null | mm | Oct(Y−1)–May(Y) | POWER | null when the season start predates the record |
| growing_season_partial | bool | — | — | — | true for the first year (Oct–Dec of Y−1 missing) |
| hot_days_grain_filling | int | days | Apr–Jun of Y | POWER | Tmax > 35 °C (thresholds.json) |
| frost_days_late_frost | int | days | Mar–Apr of Y | POWER | Tmin < 0 °C |
| extreme_rain_days | int | days | calendar year | POWER | daily rain > 20 mm |
| longest_dry_spell_growing_season_days | int | days | inside Oct(Y−1)–May(Y) | POWER | dry = < 1 mm/day; spells **break** at missing days (never merged, fixes v1 finding h) |
| days_missing | int | days | calendar year | POWER | days with any of the 3 variables = −999 |

## 3. climate_monthly.json

| Key | Type | Unit | Window | Notes |
|---|---|---|---|---|
| region | string | — | — | — |
| monthly_rain_mm | float[12] | mm | mean 1995–2024 | index 0 = January |
| rows[].region / year / month | string / int / int | — | — | PRD harmonization keys |
| rows[].rain_mm | float\|null | mm | calendar month | sum of daily rain |
| rows[].days_missing | int | days | calendar month | −999 count |

## 4. indicators.json (read by `GET /indicators/{region}`)

Top-level: `region`, `code`, `label`, `lat`, `lon`, `run_date` (optional stamp), `sources{climate, crosscheck, soil, ndvi}`, `thresholds_used{file, sha256_16}`, then:

| Key | Type | Unit | Window | Confidence | Notes |
|---|---|---|---|---|---|
| rainfall_mm | {value, unit, window, crosscheck_value, confidence} | mm/yr | 2015–2024 mean | high/medium/low | crosscheck_value = ERA5 mean for the same window |
| rainfall_30yr_mean_mm | same shape | mm/yr | 1995–2024 | high/medium/low | crosscheck = ERA5 30-yr mean |
| water_stress | {value, window, confidence, note} | 0–1 | ref 1995–2014 vs 2015–2024 | **pending Alaa** | max(0, 1 − recent/reference); PRD glossary formula; reference method pending (step-1 finding c) |
| water_stress_5yr | same shape | 0–1 | ref 1995–2014 vs 2020–2024 | sensitivity only | v1's variant kept for comparison |
| rainfall_trend | {ols_slope_mm_per_decade, ols_p, sen_slope_mm_per_decade, mk_p, label, confidence, window, unit, theilslopes_slope_per_year, theilslopes_intercept, analytical_ci_low_per_year, analytical_ci_high_per_year, mbb_ci_low_95, mbb_ci_high_95, mbb_ci_low_95_per_year, mbb_ci_high_95_per_year, statistically_significant_95, mbb_block_size, mbb_n_boot, mbb_seed, mbb_note} | mm/decade (per-year twins with `_per_year` suffix) | 1995–2024 | high/medium/low | OLS = scipy t-dist; MK = exact with tie correction; label "both methods agree" only if both p<0.05 and same sign, else "no clear trend". **NEW in step 4 - announced 2026-11-15**: Theil-Sen slope via scipy `theilslopes` with its analytical CI, plus moving block bootstrap 95% CI (`mbb_*`, overlapping 3-year blocks, n_boot 2000, seed 42, deterministic) that preserves short-term autocorrelation — `statistically_significant_95` = 0 excluded from the MBB interval. The MBB interval is wider than the analytical one when rainfall is autocorrelated; report both. |
| soil_water_capacity | {awc_mm_per_m, field_capacity_vol_pct, wilting_point_vol_pct, awc_is_estimate=true, depth, method, unit, confidence, confidence_note} | mm of plant-available water per m soil | 0-30 cm (static SoilGrids snapshot) | low | **NEW in step 5 - announced 2026-11-15**: Saxton & Rawls (2006) Soil Sci Soc Am J 70:1569-1578 Table 1 Eqs 1-2 pedotransfer from ISRIC SoilGrids sand/silt/clay + SOC (OM = SOC x 1.724), depth-weighted 5:10:15. It IS an estimate (`awc_is_estimate`), not a lab measurement. If `soilgrids_texture.json` is absent the block carries `awc_mm_per_m: null` / `confidence: "unavailable"` - no value is invented. Mirrored in soil.json. |
| historical_drought | {method, window, n_years, mean_mm, std_mm, severe_boundary_mm, drought_frequency_pct, severe_drought_years, zscore_by_year, confidence, confidence_note} | % and years | 1995-2024 | medium | **NEW in step 5 - announced 2026-11-15**: SPI-like annual rainfall z-score; severe drought year = z <= -1.0 (WMO SPI "severely dry" boundary, pending Younes). `drought_frequency_pct` = share of severe years, `severe_drought_years` = the historical shock years, `zscore_by_year` = per-year z. Distribution-based, not a fitted SPI; single source (POWER). |
| rule_trace | {purpose, water_stress, organic_carbon, soil_water_capacity, rainfall_trend, hot_days, frost_days, extreme_rain_days, longest_dry_spell_days, historical_drought, suggested_priorities, ph, ndvi} | plain-English strings | - | - | **NEW in step 5 - announced 2026-11-15**: brief justification strings for every flagged level/priority, each citing the exact rule and the numbers already stored in indicators.json. Deterministic; no new numbers. |
| data_quality.json (new file) | {region, generated_by, run_stamp, sources[4] (NASA POWER, Open-Meteo ERA5, ISRIC SoilGrids, MODIS MOD13Q1 - each with role, spatial_resolution, observation_window, missing_value_rate_pct), source_disagreement, confidence_summary, spatial_caveat} | - | per dataset | - | **NEW in step 5 - announced 2026-11-15**: machine-readable provenance contract. The `spatial_caveat` explicitly separates statistical confidence (e.g. MBB trend CI at one cell) from grid-cell representativeness (~55 km POWER cell vs ~11 km ERA5 vs 250 m SoilGrids/MODIS pixel; none represents a field). |
| hot_days | metric shape | days/yr | Apr–Jun (grain filling), mean 1995–2024 | high/medium/low | crosscheck = ERA5 same window |
| frost_days | metric shape | days/yr | Mar–Apr (late frost), mean 1995–2024 | high/medium/low | **unit differs from frontend "%"** (see §7) |
| extreme_rain_days | metric shape | days/yr | calendar year, mean 1995–2024 | low | crosscheck not computed (ERA5 grid wet-day stats not comparable) |
| longest_dry_spell_days | metric shape | days | inside growing season, mean 1995–2024 | low | never merged across missing days |
| organic_carbon | {g_per_kg, class, unit, confidence} | g/kg | SoilGrids snapshot | at best medium | class ∈ {low <10, medium 10–20, high >20} (pending Younes) |
| ph | {value, unit, confidence} | pH | 0–30 cm, weights 5:10:15 | at best medium | SoilGrids phh2o ÷ 10 |
| ndvi | {available, source, window, patch, mean_spring_peak_ndvi, spring_peaks_by_year, yield_baseline, normalization, caveat, confidence} | NDVI / 0–1 | 2020–2024 spring peaks (DOY 65–145) | **low** | no cropland mask, no pixel QA, 5×5 km patch, 5 years; yield_baseline = clamp((peak−0.25)/0.50, 0, 1); no reliable CV |
| suggested_priorities | {save_water, protect_soil, yield_, rule, basis{water_stress_used, soc_class}} | points, sum 100 | — | rule = PRD §6.2 | water=min(1, stress/0.3); soil=1/0.5/0.1 by SOC class; yield=max(0.2, 1−max(two)); largest-remainder integer rounding, deterministic; **`yield_` has the trailing underscore per API contract** |

Confidence rule (also in `domain/thresholds.json` → `confidence_rules` and each region's `data_quality.md`):
rain/hot/frost: POWER vs ERA5 relative diff ≤ 10% → high, ≤ 25% → medium, else low; downgrade one level if > 5% of relevant POWER days are missing. trend: both p<0.05 high, one medium, none low. soil: at best medium. NDVI/extreme/dry-spell: low.

## 5. soil.json

`region`, `lat`, `lon`, `soc_g_per_kg` (g/kg, 0–30 cm, weights 5:10:15, dg/kg ÷ 10), `soc_class`, `ph`, `soc_layers_dg_per_kg` ({0-5cm, 5-15cm, 15-30cm}), `source`, `method`, `confidence` ("medium"), `soc_class_rule`.

## 6. Machine-readable schema (used by the pytest key checks)

```json
{"indicators_required_keys": ["region", "code", "label", "lat", "lon", "sources", "thresholds_used", "rainfall_mm", "rainfall_30yr_mean_mm", "water_stress", "water_stress_5yr", "rainfall_trend", "hot_days", "frost_days", "extreme_rain_days", "longest_dry_spell_days", "organic_carbon", "ph", "soil_water_capacity", "ndvi", "historical_drought", "rule_trace", "suggested_priorities"]}
```

## 7. Frontend field → pipeline field (for Nazim — do NOT edit the frontend yet)

The REGIONS object now lives in `frontend/src/data/regions.js` (the old `frontend/js/app.js:9-19` was deleted in the React migration).

| Frontend field (regions.js) | Pipeline field (indicators.json) | Unit conversion needed | Current status |
|---|---|---|---|
| `rain` (485/516/408) | `rainfall_mm.value` (509.0/603.8/519.1) | none (both mm/yr) — but frontend doesn't state the window; pipeline = 2015–2024 mean | stale, B off by ~88 |
| `water` (20/28/33, %) | `water_stress.value` (0.1625/0.1668/0.1397) | ×100 | frontend = v1's 2020–2024 stress; pipeline primary is 2015–2024 (**pending Alaa**). With 5-yr variant they would match (0.2029/0.2761/0.3275) |
| `soc` (12.52/17.08/12.38) | `organic_carbon.g_per_kg` | none | **matches** |
| `frost` (34/25/28, "%") | `frost_days.value` (4.5/0.4/1.1) or v1 34.6/5.7/11.1 days/yr | **unit mismatch**: frontend shows "%" with three inconsistent meanings; pipeline gives days/yr in a Mar–Apr window. Decide the UI presentation (e.g. "≈4 frost nights in Mar–Apr") | broken |
| `erosion` (38/35/44, %) | — none — | pipeline has no erosion indicator (v1 hardcoded 0.48/0.28/0.44); needs a real source or removal | missing |
| `ndvi` (0.44/0.49/0.47) | `ndvi.yield_baseline` (0.363/0.578/0.569) | none (both normalized 0–1) — but semantics differ: frontend shows raw-ish NDVI, pipeline yield_baseline | stale |
| `ph` ([7.3,8.4] etc., range) | `ph.value` (7.77/7.50/7.57 scalar) | range vs scalar — pick one (suggest range from regions.json + scalar mean in tooltip) | shape mismatch |
| `lat`/`lon` | `domain/regions.csv` (36.15/5.38, 36.26/6.68, 35.34/1.38) | none | B conflicts: frontend 36.16, regions.json 36.36 |
| `est` array | per-indicator `confidence` | replace `est` flags with confidence levels | mapping needed |

## 8. Pending decisions (who must confirm)

| Decision | Owner |
|---|---|
| All thresholds/windows in thresholds.json (hot/frost/extreme/dry windows and cutoffs, agricultural year) | Younes |
| Water-stress reference + recent window (2015–2024 vs 2020–2024) and the value the engine consumes | Alaa |
| SOC class bands (10/20 vs v1's 10/12/15 vs frontend 12/16) | Younes |
| `region` naming: codes (`setif`) vs `regionX` per PRD §7; folder and endpoint path names | Mehdi |
| Frontend data wiring + frost/erosion/NDVI presentation | Nazim |
| K_WATER / K_SOIL stress constants | Alaa (engine; deliberately absent here) |
