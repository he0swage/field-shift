# Precision Crop Rotation Advisor — frontend (React + Vite)

## Run it

```bash
cd frontend
npm install        # first time only
npm run dev        # http://localhost:5173  (live reload — recommended)
npm run build      # production build in dist/
npm run preview    # serve the build locally
```

Requires Node 18+.

**VS Code "Go Live" shows a blank page on `frontend/index.html`**: that file is the
Vite source entry, and browsers can't run `.jsx` directly. Use `npm run dev`, or run
`npm run build` and click Go Live. The repo's `.vscode/settings.json` points Live
Server at `frontend/dist`.

## User journey

| Stage | View (`#/…`) | Page |
|---|---|---|
| 1 · Your farm | `region` | 1.1 Landing hero + 1.2 region cards and interactive 3D globe |
| | `strategy` | 1.3 Priorities (100 points), usual rotation, allowed crops, custom crop, **Analyse & Rank** |
| 2 · Climate | `climate` | 2.1 What-if sliders, rainfall trend, longest dry spell, yearly chart |
| | `extreme` | 2.2 Hot days, frost days, extreme rain |
| | `monthly` | 2.3 Monthly rainfall chart, trend confidence, evapotranspiration |
| 3 · Recommendations | `top` | 3.1 Top 4 rotations (needs the analysis) |
| | `avoid` | 3.2 Rotations & crops to avoid |
| 4 · Results | `summary` | 4.1 Full strategy + PDF report |
| Additional | `map`, `compare` | Regional climate map · Usual vs Rank 1 |

Languages: EN / FR / العربية. Arabic switches the whole layout to right-to-left.
Strings are in `src/i18n/strings.js`.

## Structure

```
frontend/src/
├── App.jsx                 providers + header + progress + current view + footer + print report
├── i18n/                   I18nContext (lang, dir, t()) + strings.js (en, fr, ar)
├── api/client.js           ⬅ the ONLY file that talks to the backend (IS_LIVE flag)
├── api/stats.js            OLS + Mann–Kendall trend tests
├── data/                   regions (Kansas, Sétif, Punjab), crops, SAMPLE climate + ranking
├── state/                  FarmContext (answers, localStorage) · NavContext (#/view)
│                           AnalysisContext (run / result / stale) · ToastContext (Undo)
├── hooks/                  useData (climate cache), useClimateModel, useWidth, useReducedMotion
├── utils/                  agronomy rules, priorities, insights text, format, storage
├── components/
│   ├── layout/             Header + data banner, Progress, Footer (+ Developer Information)
│   ├── globe/              Globe (canvas 3D Earth), RegionThumb, world.js (bundled geometry)
│   ├── climate/            ScenarioControls, IndicatorCard
│   ├── charts/             AnnualLineChart, MonthlyBarsChart, NitrogenChart
│   ├── rotation/           RotationCard, CompareTable
│   └── AnalysisRunner, NeedsAnalysis, ExportButton, ui.jsx
├── views/                  one component (+ CSS) per page, plus Report.jsx (print / PDF only)
└── styles/global.css       design tokens (palette, type) + shared components
```

## Palette

| Token | Hex | Use |
|---|---|---|
| `--forest-900` / `--forest` | `#0d2a1f` / `#1d5a40` | brand, header, primary buttons |
| `--leaf` | `#5c9a5f` | natural-green accents |
| `--bg` / `--surface` | `#f7f3ea` / `#fffdf8` | warm off-white background and cards |
| `--earth` | `#7a4b2a` | soil |
| `--gold` | `#d6a23a` | accents, rank 1 |
| `--series-1` / `--series-2` | `#1d669a` / `#c2562b` | chart baseline / scenario (colour-blind safe) |

Every text colour meets WCAG AA on its background.

## Connecting the API

```bash
cp .env.example .env.local
# then set VITE_API_BASE=https://your-backend/api
```

While `VITE_API_BASE` is empty, or when a request fails, the app uses the sample data.
The banner then reads "SAMPLE DATA MODE" instead of "LIVE REGIONAL DATA ACTIVE", and
each page shows a "Sample data" notice.

Region ids: `kansas` (38.50N, 98.00W), `setif` (36.15N, 5.38E), `punjab` (30.90N, 75.85E).
Kansas and Punjab rainfall, soil pH and frost values are estimates until the APIs are live.

### Climate

`GET {VITE_API_BASE}/climate?region=setif&lat=36.15&lon=5.38` returns:

```json
{
  "source": "NASA POWER 1995-2024",
  "annual":  [{ "year": 1995, "rain": 412 }],
  "monthly": [52, 46, 43, 41, 27, 10, 3, 7, 20, 24, 44, 45],
  "indicators": { "hotDays": 48, "frostDays": 32, "extremeRainDays": 5, "longestDrySpell": 58 }
}
```

### Ranking

`POST {VITE_API_BASE}/ranking` with body
`{ region, rotation[3], allowed[], custom[], priorities { water, soil, yield }, scenario { rain, temp } }`.

It must return the same shape as `SAMPLE_RANKING` in `src/data/sampleRanking.js`:

- `monteCarlo { runs, rank1StaysFirstPct }`
- `usual { waterNeed, ndviStability, fertilizer, income, soilNEnd }`
- `rotations[4]`, each with:
  - `rank`, `crops[3]`, `tags[]`, `scores { final, ml, knn }`
  - `years[3]`, each `{ crop, family, soilN, health, fertilizer, kg, nCredit?, risks[] }`
  - `waterNeed`, `ndviStability`, `fertilizer`, `fertilizerSaved`, `income`
- `avoid[]`, each with:
  - `crops`, `score`, `level` (`high` or `caution`), `reason`
  - optional: `climate`, `soil`, `water`, `disease`, `alternative` (rank number)

## Troubleshooting (Windows)

`npm error enoent spawn ... ENOENT` means the `ComSpec` environment variable is broken.
It must be `C:\Windows\System32\cmd.exe` (System Properties → Environment Variables).
