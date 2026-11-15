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

## Design

The interface is minimal and professional: one typeface (Inter), 1px hairlines, small radii, no
gradients and no emoji.
- **Icons:** `lucide-react` line icons, mapped in `src/components/icons.jsx`.
- **Layout:** a top bar (navigation, language, theme, account) and a journey sidebar with the 8 steps and the data status. On small screens the sidebar becomes a compact progress bar.
- **Tokens:** all in `src/styles/global.css`, light and dark. The team palette is used for meaning only:
  - olive `#595f34` / `#9cad60` for actions and progress;
  - accent `#c49a6c` for rank 1 and AI insights;
  - blue / red chart pair `#3a7fae` / `#b5523b` (colour-blind safe).
- **Priorities:** moving one slider re-balances the other two in proportion, so the total is always 100 (`setPriority` in `src/utils/priorities.js`).

## Connecting the API

The frontend talks to the team backend (`backend/`, Express on port 5001). All calls go through
`src/api/client.js`, which picks the API address:

| How the site is opened | API used |
|---|---|
| `start.bat` → http://localhost:5001 (the backend serves `frontend/dist`) | same origin `/api/v1` |
| `npm run dev` → :5173, or `npm run preview` → :4173 | `/api/v1`, forwarded to :5001 by the Vite proxy (`vite.config.js`) |
| anything else, e.g. Go Live on :5500 | `VITE_API_BASE` from `.env.production` (`http://localhost:5001/api/v1`), allowed by CORS |

- **Banner:** it pings `/health` and reads "LIVE REGIONAL DATA ACTIVE" only when the backend answers.
- **Login page:** shows "Server online" or "Server offline".
- **Fallbacks:** without the backend, the pages use the sample data and say why.
- **Contract:** documented in `backend/README.md`.

Region ids: `kansas` (38.50N, 98.00W), `setif` (36.15N, 5.38E), `punjab` (30.90N, 75.85E).

## Troubleshooting (Windows)

`npm error enoent spawn ... ENOENT` means the `ComSpec` environment variable is broken.
It must be `C:\Windows\System32\cmd.exe` (System Properties → Environment Variables).
