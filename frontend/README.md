# Field Shift — frontend

Open `index.html` in a browser (no build step).

```
frontend/
├── index.html        single page, 5 steps under one menu
├── css/styles.css    design tokens + components
└── js/
    ├── data.js       regions, crops, SAMPLE_CLIMATE (placeholder)
    ├── api.js        data access — connect the backend here
    ├── charts.js     SVG charts (yearly line, monthly bars)
    └── app.js        UI logic
```

## Connecting the climate API

Set `apiBase` in `js/api.js` (or define `window.FIELDSHIFT_CONFIG = { apiBase: '...' }`
before the scripts). The app calls:

```
GET {apiBase}/climate?region=regionA&lat=36.15&lon=5.38
```

Expected JSON:

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

If `apiBase` is empty or the request fails, the page shows the sample data
with a visible "Sample data" notice.

Region ids: `regionA` Sétif (36.15N, 5.38E), `regionB` Constantine El Khroub
(36.16N, 6.68E), `regionC` Tiaret (35.34N, 1.38E).
