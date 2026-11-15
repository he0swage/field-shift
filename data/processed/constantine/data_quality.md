# Data quality — constantine

Generated offline by `analysis/build_indicators.py` from `data/raw/constantine/`. Run stamp: 2026-11-15 mbb-trend.

## Missing data (NASA POWER, 1995-2024)

- PRECTOTCORR missing: 0.00% of days
- T2M_MAX missing: 0.00% of days
- T2M_MIN missing: 0.00% of days
- Days with any variable missing: 0 of 10958 (0.00%)
- Open-Meteo (ERA5) days with any variable missing: 0

## Years with missing days

| year | days with any missing value |
|---|---|
| (none) | 0 |

## Source disagreement: POWER vs ERA5 (30-year means, whole calendar year)

Whole-year values are shown for context; the confidence below is applied on the
same-window comparison (rain: 30-yr; hot days: Apr-Jun; frost days: Mar-Apr).

| metric | POWER | ERA5 | relative diff (vs ERA5) | confidence after rule |
|---|---|---|---|---|
| annual rain (mm/yr) | 684.4 | 491.2 | 39.3% | low |
| hot days > 35.0 °C (days/yr) | 52.9 | 43.6 | 20.8% | medium |
| frost days < 0.0 °C (days/yr) | 5.7 | 10.3 | 42.9% | low |

ERA5 is systematically drier and (at Tiaret) much cooler at Tmax; the rainfall-derived
indicators (water_stress, trend, dry spells) inherit this uncertainty.

## Confidence rule (documented in domain/thresholds.json)

- rain / hot days / frost days: POWER vs ERA5 relative difference ≤ 10% → high, ≤ 25% → medium,
  otherwise low; downgraded one level when > 5% of the relevant POWER days are missing.
- This region: rain low, hot days medium, frost days low.
- trend: both p < 0.05 → high; one → medium; none → low.
- soil: at best medium (250 m model estimate).
- NDVI: low (no cropland mask, no pixel QA filter, 5-year window).
- extreme_rain_days and longest_dry_spell: crosscheck not computed (ERA5 wet-day/dry-spell
  statistics are not comparable at grid scale) → low.

## Caveats

- v1 (`fetch_real_data.py`) is untouched; the numbers here supersede its whole-calendar-year
  windows with the seasonal windows in `domain/thresholds.json` (all pending Younes).
- Dry spells are never merged across missing days (v1 merged them).
- OLS p-value uses a t-distribution (scipy); v1 used a normal approximation.
- water_stress reference method (region's own 1995-2014 mean) is pending Alaa/Younes; the
  2020-2024 variant is kept as `water_stress_5yr` for sensitivity.
- K_WATER / K_SOIL are the engine's business and are intentionally not defined here.
- Coordinates are the ones the pipeline actually used (see domain/regions.csv); regions.json
  and the frontend use different coordinates for regionB.
