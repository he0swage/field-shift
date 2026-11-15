# Product Requirements Document (PRD) & Engineering Work Breakdown

**Project:** NASA Space Apps Challenge — Climate & Vegetation-Smart Crop Rotation Advisor  
**Team:** Alaa (Lead Engineering, Engine & Frontend), Younes (QA, Verification & Agronomic Audit), Achref (Remote Sensing, Climate & Soil Data)  
**Version:** 2.0 (Detailed Track & Tooling Edition)

---

## 1. Product Vision, Problem & Success Metrics

### 1.1 Problem Statement
Rain-fed farmers in semi-arid Mediterranean and North African plains (such as Setif and Tiaret) face:
1. **Shifting rainfall patterns:** Declining total rainfall (`-9` to `-24 mm/decade`), delayed autumn onset, and longer dry spells (`60+ days`).
2. **Thermal stress:** More scorching days (`>35 °C`) during cereal grain filling alongside late spring frost risks (`<0 °C`) during legume flowering.
3. **Soil exhaustion:** Repeated cereal-after-cereal cultivation (`wheat -> barley -> wheat`) depletes soil organic carbon (`SOC < 10 g/kg`), increases nitrogen fertilizer dependency, and worsens pest/disease carry-over.
4. **Data-to-Field Gap:** NASA satellite products (`NASA POWER`, `MODIS/VIIRS NDVI`, `GPM IMERG`) and `ISRIC SoilGrids` hold the exact local evidence needed to adapt, but exist as raw NetCDF/GeoTIFF/JSON APIs unusable by non-technical farmers.

### 1.2 Product Vision
Build an intuitive, multilingual (`العربية` RTL, `FR`, `EN`), offline-capable web advisor that translates NASA climate trends, vegetation greenness (`NDVI`), and `SoilGrids` organic carbon into ranked, agronomically valid 3-year crop rotations—always compared side by side against the farmer's existing rotation in plain farming language.

### 1.3 Success Metrics (KPIs)
- **Usability:** A farmer with zero prior app experience can complete a 3-year rotation check and print their plan in **under 3 minutes**.
- **Mathematical Auditability:** `100%` parity (within `1e-5` tolerance) between independent hand calculations and engine outputs (`logs/test_log.md`).
- **Agronomic Safety:** `0%` of recommended alternatives violate family-break, legume-inclusion, or water-cap rules in `rules.json`.
- **Outdoor Readability & Accessibility:** WCAG AA+ contrast (`>= 4.5:1`, target `7:1` for outdoor phone screens in bright sunlight) and complete Arabic RTL layout mirroring.

---

## 2. Professional Tool Stack by Discipline

| Track | Category | Recommended Professional Tools | Why Use It in This Project |
| :--- | :--- | :--- | :--- |
| **1. UI/UX Design** | Wireframing & Design System | **Figma** (+ Auto Layout & Variables) | Industry standard for designing all 5 screens, testing LTR (`EN`/`FR`) vs RTL (`العربية`) mirroring, and exporting clean SVG assets. |
| | UX Reference & Inspiration | **Mobbin** | Browse real-world mobile dashboard, slider, and comparison-table patterns so the app feels like a commercial product. |
| | Outdoor Color & Contrast | **Realtime Colors** + **WhoCanUse** + **Stark** | Verify earthy agricultural palettes (`#1B4332`, `#2D6A4F`, `#D97706`) remain legible outdoors on low-brightness phone screens. |
| | Iconography | **Phosphor Icons** or **Lucide Icons** | Consistent, high-legibility icons for water drops, soil, wheat, thermometer, and print actions. |
| **2. Frontend** | Framework & Build | **React 19 + TypeScript + Vite** *(or single-file HTML/JS in `mockup.html` for zero-build portability)* | Type-safe component state across the 5 screens with instant HMR. |
| | Styling & UI Primitives | **Tailwind CSS** (logical properties `ms-*`, `me-*`) + **shadcn/ui** (**Radix UI**) | Logical CSS properties flip automatically between `ltr` and `rtl`; Radix provides accessible sliders and tooltips. |
| | Internationalization (i18n) | **i18next** + **react-i18next** | Manages `en.json`, `fr.json`, and `ar.json` dictionaries and toggles `<html dir="rtl" lang="ar">`. |
| | Interactive Mapping | **MapLibre GL JS** or **Leaflet** + **GeoJSON** | Renders candidate regions (`regionA`, `regionB`, `regionC`) and toggles the `mm/decade` choropleth rainfall-trend overlay. |
| | Climate Charts | **Recharts** or **Chart.js** | Renders the 12-month baseline vs. scenario rainfall shift bar chart and historical trend lines. |
| | Offline & Print | **Workbox (PWA)** + **CSS `@media print`** | Lets farmers open the app in fields with weak mobile coverage and print 1-page PDF recommendations. |
| **3. Backend** | API Server & Validation | **FastAPI** + **Pydantic v2** + **Uvicorn** *(prototyped in stdlib `server.py`)* | Auto-generates OpenAPI/Swagger docs (`/docs`) and validates `GET /indicators/{region}` and `POST /recommend`. |
| | Caching & Storage | **SQLite** (or **Redis**) + static JSON cache | Caches pre-processed NASA & SoilGrids regional indicators so API responses return in `< 20 ms`. |
| | Deployment & Hosting | **Netlify** (Frontend + Serverless Functions) or **Docker + Cloud Run / Render** | Atomic deploys, automatic HTTPS, and preview URLs for every commit. |
| **4. Data Analysis & Geo** | NASA Climate & Vegetation | **NASA POWER API** + **NASA AppEEARS / Google Earth Engine** (`MODIS MOD13Q1 NDVI`) | Official NASA agro-climatology and vegetation greenness time series (2000–present). |
| | Soil Data | **ISRIC SoilGrids v2.0 REST / WCS API** (`scripts/fetch_soilgrids.py`) | `250 m` resolution soil organic carbon (`soc` in `dg/kg`) and `phh2o` across `0-5`, `5-15`, and `15-30 cm` layers. |
| | Geospatial Processing | **Python**, **Pandas**, **NumPy**, **xarray**, **rioxarray**, **GeoPandas**, **Rasterio** | Slices regional bounding boxes, aggregates multi-decade rasters, and computes depth-weighted soil averages. |
| | Trend & Confidence Statistics | **SciPy (`scipy.stats.linregress`, `theilslopes`)** + **pyMannKendall** | Compares parametric (OLS) vs. non-parametric (Mann-Kendall / Sen's slope) trends to output `"both methods agree"` or `"no clear trend"`. |
| **5. Scoring Engine** | Core Algorithm & Rules | **Python 3.11+** (`itertools`, `dataclasses`, `NumPy`) in `engine/scoring.py` | Pure, deterministic functions for candidate generation, rule filtering, stress-adjusted weighting, and template rendering. |
| | Ranking Stability (Confidence) | **NumPy Monte Carlo Runner** (`N = 500` runs) | Perturbs weights and indicator noise (`±10%`) across 500 runs to compute the exact percentage of runs where Rank 1 stays first (`87%`). |
| **6. QA & DevOps** | Automated & Property Testing | **pytest** + **Hypothesis** (`tests/test_scoring.py`) | Verifies hand-calculated examples (`logs/test_log.md`) and fuzz-tests rule invariants. |
| | End-to-End UI Testing | **Playwright** | Automates browser checks for all 5 screens, validation guards, Arabic RTL layout, and PDF print view. |
| | Code Quality & CI | **Ruff** + **mypy** + **GitHub Actions** | Runs `pytest` and static checks automatically on every push. |

---

## 3. Detailed Work Breakdown Structure (Tasks by Track)

### Track 1: UI/UX Design & Farmer Experience
- **TASK-UI-01:** Sunlight-safe high-contrast palette (`#1B4332`, `#2D6A4F`, `#D97706`), `16px+` typography, and `44x44px` touch targets (Figma, Stark, Phosphor Icons).
- **TASK-UI-02:** 5-screen wireframes & component library in both LTR (`EN`/`FR`) and RTL (`العربية`) (Figma Auto Layout, Mobbin).
- **TASK-UI-03:** Plain-language 1-sentence farmer microcopy, `NDVI` / `evapotranspiration` glossary tooltips, and `Placeholder` / `AI-generated` disclosure badges (`FARMER_GUIDE.md`).

### Track 2: Frontend Engineering (`mockup.html`)
- **TASK-FE-01:** App shell, 5-tab navigation router, and `EN`/`FR`/`AR` (`dir="rtl"`) live switcher.
- **TASK-FE-02:** Screen 1 (`Setup`) region dropdown, 3 priority sliders, **"Suggest for my region"** button (rescaled to `100`), 3-year usual rotation selects, and allowed-crop validation guard (`"Add at least one legume and one cereal"`).
- **TASK-FE-03:** Screen 2 (`Climate Changes`) 5 climate cards, 12-month rainfall shift bar chart, confidence badges, and live `-20%` rain / `+2 °C` temp scenario sliders.
- **TASK-FE-04:** Screen 3 (`Rotation Ranking`) strategy cards, `0–100` score badges, per-crop risk notes, `87%` ranking stability badge, and **"Print or save as PDF"** button (`@media print`).
- **TASK-FE-05:** Screen 4 (`Usual vs Rank 1`) side-by-side comparison table across Water Need, Soil Effect, Yield Potential, and Income (`$/ha`).
- **TASK-FE-06:** Screen 5 (`Region Map`) interactive regional markers and toggleable `mm/decade` rainfall-trend overlay.

### Track 3: Backend & API Engineering (`server.py`)
- **TASK-BE-01:** `GET /indicators/{region}` endpoint returning `water_stress`, `frost_risk`, `organic_carbon`, `erosion_risk`, `suggested_priorities`, and `confidence`.
- **TASK-BE-02:** `POST /recommend` endpoint connecting frontend payloads (`region`, `priorities`, `current_rotation`, `allowed_crops`) to `engine/scoring.py`.
- **TASK-BE-03:** Static & cloud deployment configuration (`netlify.toml`, `dist/index.html`, `.gitignore`).

### Track 4: Data Analysis, Remote Sensing & Geospatial Pipeline (Achref)
- **TASK-DA-01:** ISRIC SoilGrids v2.0 fetcher (`scripts/fetch_soilgrids.py`), `0-30 cm` thickness-weighted mean (`5:10:15`), `dg/kg -> g/kg` conversion (`data/processed/regionX/soil.json`, `CONVERSION_NOTE.md`).
- **TASK-DA-02:** NASA POWER 30-year daily agro-climatology extraction for rainfall trends, hot days (`>35 °C`), frost days (`<0 °C`), extreme rain (`>20 mm`), and longest dry spell.
- **TASK-DA-03:** Dual trend-confidence statistical test (OLS linear regression vs. Mann-Kendall + Sen's slope) producing `"both methods agree"` or `"no clear trend"`.
- **TASK-DA-04:** MODIS `MOD13Q1 NDVI` growing-season greenness aggregation for regional `yield_baseline`.

### Track 5: Recommendation & Scoring Engine v2 (`engine/scoring.py`) (Alaa)
- **TASK-EN-01:** Stress derivation & visible weight adjustment (`K_WATER = 1.5`, `K_SOIL = 1.5`) with renormalisation.
- **TASK-EN-02:** Combinatorial candidate generation and agronomic rules filter (`rules.json`).
- **TASK-EN-03:** Unfiltered scoring of `current_rotation` + crop-set distinctness (`frozenset`) guaranteeing `>= 3` strategies.
- **TASK-EN-04:** Deterministic template explanations (`evidence`, `benefits`, `gaps`, `risks`) and `scenario()` rainfall perturbation runner.

### Track 6: QA, Verification & Coordination (Younes)
- **TASK-QA-01:** Independent hand-calculated worked example (`logs/test_log.md`, `11/11` quantities match within `1e-5`).
- **TASK-QA-02:** Automated unit test suite (`tests/test_scoring.py`, 7 tests passing).
- **TASK-QA-03:** Daily sync agenda, task board, and delivery checkpoints (`SYNC_NOTES.md`).
