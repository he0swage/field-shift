# Field Shift — frontend

Open `index.html` in a browser (no build step).

```
frontend/
├── index.html          single page, 6 steps under one menu
├── css/
│   ├── styles.css      design tokens + shared components (steps 1-4)
│   ├── climate.css     step 5 — climate & rainfall
│   ├── ranking.css     step 6 — best rotations (+ print/PDF layout)
│   └── map.css         step 1 — region map + rainfall-trend overlay
└── js/
    ├── data.js         regions, crops, SAMPLE_CLIMATE, SAMPLE_RANKING
    ├── api.js          data access — connect the backend here
    ├── charts.js       SVG charts (yearly line, monthly bars)
    ├── app.js          steps 1-4 + navigation
    ├── climate.js      step 5
    ├── ranking.js      step 6
    ├── map.js          step 1 map (trends computed from the climate API data)
    └── main.js         boot (loaded last)
```

Until the backend is connected, steps 5 and 6 use fixed sample data and show a
visible "Sample data" / "Sample results" notice.

## Connecting the API

Set `apiBase` in `js/api.js` (or define `window.FIELDSHIFT_CONFIG = { apiBase: '...' }`
before the scripts). If `apiBase` is empty or a request fails, the page falls back to
the sample data and says so.

Region ids: `regionA` Sétif (36.15N, 5.38E), `regionB` Constantine El Khroub
(36.16N, 6.68E), `regionC` Tiaret (35.34N, 1.38E).

### Climate — step 5

```
GET {apiBase}/climate?region=regionA&lat=36.15&lon=5.38
```

```json
{
  "source": "NASA POWER 1995-2024",
  "annual":  [{ "year": 1995, "rain": 412 }, { "year": 1996, "rain": 390 }],
  "monthly": [52, 46, 43, 41, 27, 10, 3, 7, 20, 24, 44, 45],
  "indicators": { "hotDays": 62, "frostDays": 5, "extremeRainDays": 6, "longestDrySpell": 65 }
}
```

- `annual`: total rainfall per year, in mm
- `monthly`: average rainfall per month, Jan to Dec, in mm
- `indicators`: average days per year; `longestDrySpell` is in consecutive days

### Ranking — step 6

```
POST {apiBase}/ranking
body: { "region": "regionC", "rotation": ["durum","barley","durum"], "allowed": ["durum", "..."],
        "priorities": { "water": 34, "soil": 18, "yield": 48 }, "scenario": { "rain": -20, "temp": 2 } }
```

Must return the same shape as `SAMPLE_RANKING` in `js/data.js`:

- `monteCarlo`: `{ runs, rank1StaysFirstPct }`
- `usual`: metrics of the farmer's current rotation `{ waterNeed, ndviStability, fertilizer, income, soilNEnd }`
- `rotations[]`: `rank`, `crops` (3 names), `tags` (ids from `TAGS` in `js/data.js`),
  `scores { final, ml, knn }`, `years[3] { crop, soilN, health, fertilizer, kg, nCredit? }`,
  `waterNeed`, `ndviStability`, `fertilizer`, `fertilizerSaved`, `income`, `risks { cropName: text }`
- `avoid[]`: `{ crops, score, reasons[] }`
