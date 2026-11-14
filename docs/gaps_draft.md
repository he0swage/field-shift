# Gaps draft for gaps.json (Younes owns the final file)

Short, honest entries about data limits, ready to be turned into JSON. Format per entry: `id`, `text` (short, screen-ready), `affects` (indicators), `severity`.

```json
[
  {
    "id": "power_grid_coarse",
    "text": "Weather comes from a satellite model covering ~50 km squares, not a local weather station.",
    "affects": ["rainfall_mm", "hot_days", "frost_days", "water_stress", "rainfall_trend"],
    "severity": "medium"
  },
  {
    "id": "power_wet_bias",
    "text": "NASA POWER shows more rain than a second dataset (ERA5) by 13-43% here; the exact rainfall amount is uncertain.",
    "affects": ["rainfall_mm", "rainfall_30yr_mean_mm", "water_stress"],
    "severity": "medium"
  },
  {
    "id": "reanalysis_not_station",
    "text": "These are model reconstructions of weather, not measurements from a rain gauge in your village.",
    "affects": ["rainfall_mm", "hot_days", "frost_days", "extreme_rain_days"],
    "severity": "medium"
  },
  {
    "id": "no_station_data",
    "text": "No ground-station observations were available for the three regions during the hackathon.",
    "affects": ["all climate indicators"],
    "severity": "medium"
  },
  {
    "id": "soilgrids_model",
    "text": "Soil numbers (organic carbon, pH) are a 250 m computer estimate, not lab measurements of your plot.",
    "affects": ["organic_carbon", "ph"],
    "severity": "low"
  },
  {
    "id": "ndvi_no_mask",
    "text": "The vegetation reading mixes all land around the point (crops, fallow, roads) - no crop mask applied.",
    "affects": ["ndvi"],
    "severity": "medium"
  },
  {
    "id": "ndvi_short_record",
    "text": "Vegetation baseline uses only 5 years of satellite data (2020-2024).",
    "affects": ["ndvi"],
    "severity": "medium"
  },
  {
    "id": "no_erosion_source",
    "text": "Soil erosion cannot be estimated from available data; the old frontend value was a placeholder.",
    "affects": ["erosion (not provided)"],
    "severity": "high"
  },
  {
    "id": "water_stress_definition_open",
    "text": "The water-stress definition (which years count as 'recent') is still being confirmed by the team.",
    "affects": ["water_stress"],
    "severity": "medium"
  }
]
```

Notes for Younes:
- Severity is my suggestion; adjust wording/tone before publishing.
- If the UI wants one "known limits" line per screen, pick `power_grid_coarse` for Climate, `soilgrids_model` for Soil, `ndvi_no_mask` for Vegetation.
