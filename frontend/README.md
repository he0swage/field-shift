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

The frontend talks to the team backend (`backend/`, Express on port 5001):

```bash
cd backend && npm install && npm run dev      # terminal 1 → http://localhost:5001
cd frontend && npm run dev                    # terminal 2 → http://localhost:5173
```

- **API URL:** `VITE_API_BASE` is set in `.env.development` (for `npm run dev`) and in `.env.production` (for `npm run build`, Go Live and preview). Both point to `http://localhost:5001/api/v1`. For a deployment, change `.env.production` to the deployed backend URL, and add the frontend URL to `FRONTEND_ORIGINS` in `backend/.env` (CORS).
- **Banner:** it pings `/health` every 30 s. It reads "LIVE REGIONAL DATA ACTIVE" only when the backend answers; otherwise it reads "SAMPLE DATA MODE".
- **Fallbacks:** when the backend is not running, or has no data for a region (Kansas and Punjab today), each page uses the sample data and says why.
- **Contract:** the routes, request bodies and responses are documented in `backend/README.md`. All requests go through `src/api/client.js`.

Region ids: `kansas` (38.50N, 98.00W), `setif` (36.15N, 5.38E), `punjab` (30.90N, 75.85E).

## Troubleshooting (Windows)

`npm error enoent spawn ... ENOENT` means the `ComSpec` environment variable is broken.
It must be `C:\Windows\System32\cmd.exe` (System Properties → Environment Variables).
