# API Plans Comparison & Team Alignment (`Field Shift`)

## 0. Executive Verdict

| Question | Answer | Overlap | Primary Reason |
| :--- | :--- | :---: | :--- |
| **Does teammate's API plan match our app & [AGRONOMY_AND_ML_GUIDE.md](file:///Users/morsistoredz/NasaSpaceApps/AGRONOMY_AND_ML_GUIDE.md)?** | **NO — Major Realignment Needed** | **~20%** | Teammate spec targets **France (`FR-OCC`)** with **`demo` / `null` scores**, **Express + MongoDB**, and **toy JS math**, whereas our codebase already runs **Algeria (`DZ`) live NASA POWER + SoilGrids + MODIS** data, **13 OAIC crops**, **custom crop validation**, and **Python ML + Monte Carlo** scoring. |

---

## 1. Side-by-Side Differences (Core System & Data)

| Dimension | Our App & ML Guide ([server.py](file:///Users/morsistoredz/NasaSpaceApps/server.py) / [scoring.py](file:///Users/morsistoredz/NasaSpaceApps/engine/scoring.py)) | Teammate's Contract (`Field Shift — contrat d'API`) | Status |
| :--- | :--- | :--- | :--- |
| **Country & Regions** | **Algeria (`DZ`)** — 3 live zones: `regionA` (Sétif), `regionB` (Constantine), `regionC` (Tiaret) + dynamic GPS lookup. | **France (`FR`)** only — `FR-OCC` (`"Occitanie — démo"`); returns `400 UNSUPPORTED_COUNTRY` for non-FR. | **Conflict** |
| **Backend Status & Stack** | Starter Python HTTP server already runs (`GET /indicators/{id}`, `POST /recommend`, `POST /validate-crop`) + **FastAPI** blueprint. | States backend is *not implemented yet*; targets **Express (`:3000/api/v1`) + MongoDB**. | **Conflict** |
| **Data & Validation Mode** | **Live satellite & agronomic data:** NASA POWER (1995–2024), ISRIC SoilGrids v2.0 (`0–30 cm`), ORNL MODIS NDVI, FAO 56, ITGC, OAIC/CCLS. | Locked to `assessment.mode: "demo"`, `"Scores fictifs"`, `soil/climate: null`, `validationStatus: unavailable`, `sources: []`. | **Conflict** |
| **Crop Catalog (`GET /crops`)** | **13 calibrated Algerian crops** (`wheat`, `soft_wheat`, `barley`, `oats`, `triticale`, `chickpea`, `lentil`, `faba`, `vetch`, `canola`, `safflower`, `sunflower`, `fallow`) + `DA/q`, yields, NPK, `rain_opt`, `ph_opt`. | Only 2 French demo crops (`ble`, `lentille`) with fake `demoScores: {water, soil, yield}`. No prices, BNF nitrogen, or `ETc`. | **Conflict** |
| **Custom Crops** | Supported via **`POST /validate-crop`** (rainfall, pH, frost, heat, family gate) + `custom_crops` in `POST /recommend`. | Not included anywhere in the contract. | **Missing** |
| **Rotation Rules** | Fixed **3-year cyclic rules** (`rules_algeria.json`: `min_legumes=1`, `forbid_consecutive_same_family=true`, max 1 per crop). | Allows `2–4` arbitrary crops (`2–24` permutations); no legume or botanical family rules in MVP. | **Conflict** |
| **Scoring & ML Formula** | Stress-adjusted weights (`K=1.5`) + CropSense KNN/pairwise transition ML + DharaaAI 3-yr N/NPK + **seeded Monte Carlo stability**. | Toy demo math: average of `demoScores` + `5 pts` per family change + `5 pts` for legume -> cereal, clamped `0–100`. | **Conflict** |
| **Outputs & Economics** | Returns `ml_metrics`, `trajectory_3yr` (N kg/ha, soil health %, NPK dose), `fertilizer_saved_vs_existing_kg_ha`, `gross_income_dzd_ha` (OAIC DA/ha/yr), `rotations_to_avoid`, `ranking_stability_pct`, `gaps` (`G1–G5`). | Returns flat `scores: {water, soil, yield, total}` + `rank` only. No economics, N balance, fertilizer, uncertainty, or avoid list. | **Missing** |
| **Weight Handling** | Accepts any non-negative priority weights and automatically normalizes (`w / sum`). | Strictly enforces `water + soil + yield === 100` integers (`400 VALIDATION_ERROR` otherwise). | **Minor Conflict** |
| **API Prefix & Error Format** | Currently root paths (`/recommend`, `/indicators/regionA`) with simple `{"error": "..."}`. | Versioned `/api/v1` base prefix + structured `{error: {code, message, details}}` envelope + `openapi.yaml`. | **Teammate Spec Cleaner** |

---

## 2. Endpoint-by-Endpoint Route Mapping Matrix

| Teammate Route | Our App / ML Guide Route | Overlap | Alignment Action Required |
| :--- | :--- | :--- | :--- |
| `GET /health` | `GET /health` *(Part 5 FastAPI spec)* | **Match** | Implement in Python FastAPI returning loaded regions & crops counts. |
| `GET /crops?country=FR` | `GET /crops?region=regionA` *(Part 5)* | **Partial** | Switch `country=FR` -> `country=DZ`, remove `demoScores`, return 13 real Algerian crops + optional regional compatibility flags. |
| `POST /rotations/generate` | `POST /recommend` *(live in `server.py`)* | **Major Diff** | Merge under `/api/v1/recommend` (alias `/api/v1/rotations/generate`) using `scoring.recommend()` + `current_rotation` + `custom_crops` + Monte Carlo. |
| `GET /regions?country=FR` | `GET /regions` *(Part 5)* | **Partial** | Switch `FR` -> `DZ`, list `regionA` (Sétif), `regionB` (Constantine), `regionC` (Tiaret) with live summary stats. |
| `GET /regions/{code}/context` | `GET /indicators/{id}` *(live in `server.py`)* | **Partial** | Populate `soil` (`soc`, `ph`) and `climate` (`rainfall_mm`, `hot_days`, `frost_days`, `monthly_rain_mm`, trends) with live data instead of `null`. |
| `POST /rotations/compare` | Built inside `POST /recommend` (`strategies[0]` vs `[1]`) | **Partial** | Keep as thin alias if React needs it; fix Section 5 typo (`habitualCropIds` `["ble","ble","orge"]` vs `["ble","orge","ble"]`). |
| `GET /map/regions` | Map reads `all_indicators.json` directly | **Compatible** | Keep teammate's GeoJSON `FeatureCollection` endpoint filled with live NASA/SoilGrids/MODIS metrics instead of `null`. |
| *(None)* | **`POST /validate-crop`** *(live in `server.py`)* | **Missing in Teammate Spec** | **Add to teammate's contract** — enforces rainfall `>=90%`, pH `±0.3`, frost/heat & family checks for custom crops. |
| *(None)* | **`POST /scenario`** *(Part 5)* | **Missing in Teammate Spec** | **Add to teammate's contract** — rainfall/temperature what-if stress testing (`scoring.scenario()`). |
| *(None)* | **`POST /parcel/indicators`** *(Part 5)* | **Missing in Teammate Spec** | **Add to teammate's contract** — dynamic `{lat, lon}` NASA/SoilGrids/MODIS lookup (`0.1°` cached). |

---

## 3. Exact Edits to Apply to Teammate's File

### 3.1 DELETE (Remove from Teammate's Contract)

| Section in Teammate's File | Exact Content to Delete | Reason |
| :--- | :--- | :--- |
| **Intro** | *"Le backend n'est pas encore implémenté"* | [server.py](file:///Users/morsistoredz/NasaSpaceApps/server.py) and [scoring.py](file:///Users/morsistoredz/NasaSpaceApps/engine/scoring.py) already implement live scoring and crop validation. |
| **Section 2 (`GET /crops`)** | `country=FR`, `"only FR supported"`, `400 UNSUPPORTED_COUNTRY` for Algeria, and `demoScores: {water, soil, yield}` | App targets **Algeria (`DZ`)** with calibrated FAO/ITGC/OAIC crops, not French demo scores. |
| **Section 3 (`POST /rotations/generate`)** | Toy math (`mean(demoScores) + 5 pts per family switch`), `2–4` crop range without legume rules, `"Scores fictifs"` disclaimer | Replaced by rule-filtered 3-year cyclic scoring, ML transition, 3-yr N/NPK simulation, and Monte Carlo stability. |
| **Sections 4 & 6 (`context`, `map`)** | `FR-OCC`, `"Occitanie"`, `soil: null`, `climate: null`, `validationStatus: "unavailable"`, `geometry: null`, `value: null` | Live NASA POWER, ISRIC SoilGrids, and MODIS NDVI telemetry is already collected and verified. |
| **Section 5 (`POST /rotations/compare`)** | Internal typo (`"habitualCropIds": ["ble", "ble", "orge"]` vs `"habitual": ["ble", "orge", "ble"]`) | Inconsistent request vs response example inside teammate's own document. |
| **Cross-cutting (`Express`)** | Instruction to build native JS scoring logic inside Express/MongoDB | Prevents two diverging scoring engines; Python `engine/scoring.py` must stay the single source of truth. |

### 3.2 ADD / UPDATE (Bring Teammate's Contract Up to Our Level)

| Target Endpoint / Section | Additions Required | Exact Fields & Behavior to Document |
| :--- | :--- | :--- |
| **Base & Regions (`GET /regions`)** | Switch to Algeria (`DZ`) benchmark stations | `regionA` (`setif`, `484.5 mm`, SOC `12.52`, pH `7.77`), `regionB` (`constantine`, `524.7 mm`, SOC `17.08`, pH `7.50`), `regionC` (`tiaret`, `405.8 mm`, SOC `12.38`, pH `7.57`). |
| **`GET /crops?region=...`** | Full 13 Algerian crop schema | Include `wheat`, `soft_wheat`, `barley`, `oats`, `triticale`, `chickpea`, `lentil`, `faba`, `vetch`, `canola`, `safflower`, `sunflower`, `fallow` with `oaic_ccls_price_dzd_q`, `gross_income_dzd_ha`, `n_impact_kg_ha`, `base_npk_kg_ha`, `rain_opt`, `ph_opt`, and regional compatibility tag. |
| **NEW: `POST /validate-crop`** | Regional Compatibility Gate | Request: `{region, crop: {family, rain_min, rain_max, ph_min, ph_max, frost_tolerant, heat_tolerant}}`. Response: `{region, compatible, status ("compatible" / "marginal" / "blocked"), blockers, warnings}`. |
| **Upgrade `POST /recommend`** | Real inputs, rules & rich outputs | Accept `region`, `priorities` (auto-normalized), `current_rotation` (3 crops), `allowed_crops`, `custom_crops`, `monte_carlo_runs`. Return `strategies` (`ml_metrics`, `trajectory_3yr`, `fertilizer_saved_vs_existing_kg_ha`, `gross_income_dzd_ha`, `explanation.gaps`), `ranking_stability_pct`, `rotations_to_avoid`. |
| **NEW: `POST /scenario`** | Climate What-If Stress Test | Request: `{region, priorities, current_rotation, rainfall_delta_pct, temp_delta_c}`. Response: `{baseline, scenario, ranking_changed}`. |
| **NEW: `POST /parcel/indicators`** | Arbitrary GPS Coordinate Lookup | Request: `{lat, lon}` within Algeria bounds. Cached at `0.1°`, queries live NASA POWER + SoilGrids + MODIS with `503` stale cache fallback. |

### 3.3 KEEP & ADOPT (From Teammate's Contract Into Our Python Backend)

| Teammate Feature | How We Adopt It in FastAPI | Benefit |
| :--- | :--- | :--- |
| **Versioned `/api/v1` Prefix** | Mount FastAPI router under `/api/v1` (with route aliases `/rotations/generate` & `/regions/{id}/context`). | Prevents breaking UI/mobile integrations during future upgrades. |
| **Standardized Error Envelope** | Return `{error: {code, message, details}}` for `400`, `404`, `422`, `503` responses in FastAPI. | Predictable client-side form error highlighting in React/JS. |
| **GeoJSON `GET /map/regions`** | Implement `FeatureCollection` response populated with live `Point` coordinates and `all_indicators.json` layers (`rainfall`, `soil_soc`, `water_stress`). | Clean Leaflet / Mapbox rendering without placeholder `null`s. |
| **`openapi.yaml` Spec Sync** | Auto-export OpenAPI JSON/YAML from FastAPI Pydantic models (`http://127.0.0.1:8000/openapi.json`). | Teammate's Swagger Editor always matches live Python types automatically. |

---

## 4. Unified Team Action Plan (Zero Rework)

| Step | Owner | Deliverable | Single Source of Truth | Priority |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Alaa & Backend Teammate** | Pick ONE API entry point: run **FastAPI (`/api/v1`)** directly OR make **Express** forward scoring/validation/scenario calls to Python over HTTP. | [scoring.py](file:///Users/morsistoredz/NasaSpaceApps/engine/scoring.py) | **Immediate** |
| **2** | **Teammate** | Update teammate's API Markdown & `openapi.yaml` using Tables **3.1** (`DELETE`) & **3.2** (`ADD/UPDATE`). | [AGRONOMY_AND_ML_GUIDE.md](file:///Users/morsistoredz/NasaSpaceApps/AGRONOMY_AND_ML_GUIDE.md) | **Immediate** |
| **3** | **Mehdi / Backend** | Upgrade starter [server.py](file:///Users/morsistoredz/NasaSpaceApps/server.py) to the **FastAPI + Pydantic v2** blueprint with `/api/v1` prefix & `{error: {code, message, details}}` envelope. | Part 5 of ML Guide | **High** |
| **4** | **Achref / Data** | Add `POST /parcel/indicators` with `0.1°` disk/Redis cache + `503` stale fallback for custom Algeria `{lat, lon}` queries. | [fetch_real_data.py](file:///Users/morsistoredz/NasaSpaceApps/scripts/fetch_real_data.py) | **High** |
| **5** | **Younes / QA** | Run integration tests across `/api/v1/crops`, `/api/v1/validate-crop`, `/api/v1/recommend`, and `/api/v1/scenario` verifying exported `openapi.yaml`. | [test_scoring.py](file:///Users/morsistoredz/NasaSpaceApps/tests/test_scoring.py) | **Before Demo** |
