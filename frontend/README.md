# Field Shift — frontend (React + Vite)

## Run it

```bash
cd frontend
npm install        # first time only
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build locally
```

Requires Node 18+.

## Structure

```
frontend/
├── index.html                    Vite entry
├── .env.example                  copy to .env.local to connect the backend
└── src/
    ├── main.jsx                  mounts <App/>
    ├── App.jsx                   providers + header + menu + current step
    ├── api/
    │   ├── client.js             ⬅ the ONLY file that talks to the backend
    │   └── stats.js              OLS + Mann–Kendall trend tests
    ├── data/                     static reference data + SAMPLE data (until the API is live)
    │   ├── regions.js            Sétif, Constantine El Khroub, Tiaret
    │   ├── crops.js
    │   ├── sampleClimate.js
    │   └── sampleRanking.js
    ├── state/
    │   ├── FarmContext.jsx       farmer's answers (persisted in localStorage)
    │   ├── NavContext.jsx        6 steps, synced with #step-N in the URL
    │   └── ToastContext.jsx      feedback messages with Undo
    ├── hooks/
    │   ├── useData.js            useClimate, useRegionTrends, useRanking (cached)
    │   └── useWidth.js           responsive chart width
    ├── utils/                    pure logic: priorities, agronomy rules, formatting, storage
    ├── components/
    │   ├── Layout.jsx            Header, StepMenu, StepHead, StepNav
    │   ├── ui.jsx                Alert, Metric, WeightStack, SampleNotice, Loading
    │   ├── charts/               AnnualLineChart, MonthlyBarsChart (+ charts.css)
    │   └── map/                  RegionMap (+ RegionMap.css)
    ├── steps/                    one component (+ CSS) per step
    │   ├── RegionStep.jsx        1 · region map, indicators, suggested priorities
    │   ├── RotationStep.jsx      2 · usual rotation, allowed crops, custom crop
    │   ├── PrioritiesStep.jsx    3 · water / soil / yield sliders
    │   ├── ReviewStep.jsx        4 · check answers
    │   ├── ClimateStep.jsx       5 · rainfall charts + what-if scenario
    │   └── RankingStep.jsx       6 · recommended rotations, avoid list, compare, PDF
    └── styles/global.css         design tokens (colors, type) + shared components
```

Adding a new part: create `src/steps/MyStep.jsx` (+ `MyStep.css`), register it in
`STEP_COMPONENTS` in `App.jsx` and in `STEPS` in `state/NavContext.jsx`.

## Connecting the API

```bash
cp .env.example .env.local
# then set VITE_API_BASE=https://your-backend/api
```

While `VITE_API_BASE` is empty (or a request fails), the app uses the sample data and
shows a visible "Sample data" / "Sample results" notice.

Region ids: `regionA` Sétif (36.15N, 5.38E), `regionB` Constantine El Khroub
(36.16N, 6.68E), `regionC` Tiaret (35.34N, 1.38E).

### Climate — step 1 map and step 5

```
GET {VITE_API_BASE}/climate?region=regionA&lat=36.15&lon=5.38
```

```json
{
  "source": "NASA POWER 1995-2024",
  "annual":  [{ "year": 1995, "rain": 412 }, { "year": 1996, "rain": 390 }],
  "monthly": [52, 46, 43, 41, 27, 10, 3, 7, 20, 24, 44, 45],
  "indicators": { "hotDays": 62, "frostDays": 5, "extremeRainDays": 6, "longestDrySpell": 65 }
}
```

- `annual`: total rainfall per year, in mm (the rain trends on the map are computed from it)
- `monthly`: average rainfall per month, Jan to Dec, in mm
- `indicators`: average days per year; `longestDrySpell` is in consecutive days

### Ranking — step 6

```
POST {VITE_API_BASE}/ranking
body: { "region": "regionC", "rotation": ["durum","barley","durum"], "allowed": ["durum", "..."],
        "priorities": { "water": 34, "soil": 18, "yield": 48 }, "scenario": { "rain": -20, "temp": 2 } }
```

Must return the same shape as `SAMPLE_RANKING` in `src/data/sampleRanking.js`:

- `monteCarlo`: `{ runs, rank1StaysFirstPct }`
- `usual`: metrics of the farmer's current rotation `{ waterNeed, ndviStability, fertilizer, income, soilNEnd }`
- `rotations[]`: `rank`, `crops` (3 names), `tags` (ids from `TAGS`),
  `scores { final, ml, knn }`, `years[3] { crop, soilN, health, fertilizer, kg, nCredit? }`,
  `waterNeed`, `ndviStability`, `fertilizer`, `fertilizerSaved`, `income`, `risks { cropName: text }`
- `avoid[]`: `{ crops, score, reasons[] }`

## Troubleshooting (Windows)

`npm error enoent spawn ... ENOENT` → the `ComSpec` environment variable is broken.
It must be `C:\Windows\System32\cmd.exe` (System Properties → Environment Variables).
