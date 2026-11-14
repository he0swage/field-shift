# Sensitivity of the headline numbers (auto-generated)

Source: `analysis/sensitivity.py` → `data/processed/sensitivity.json` · 2026-11-14 · all thresholds are the placeholders in `domain/thresholds.json`.

Values are per region (Sétif / Constantine / Tiaret).

## (a) Water stress — recent window (reference 1995–2014)

| Recent window | Sétif | Constantine | Tiaret |
|---|---|---|---|
| 2010–2024 | 0.107 | 0.105 | 0.025 |
| 2015–2024 (current primary) | 0.163 | 0.167 | 0.140 |
| 2020–2024 (v1's variant) | 0.203 | 0.276 | 0.328 |
| ERA5 rainfall instead of POWER (2015–2024) | 0.272 | 0.185 | 0.012 |

**Robust**: every region shows stress > 0 in every variant (recent decades are drier than 1995–2014 by all definitions).
**Not robust**: the magnitude (Tiaret spans 0.01–0.33!) and the ranking of the three regions (Tiaret last under POWER 2015–2024, last by far under ERA5, and highest under POWER 2020–2024). The window/source choice changes the headline more than anything else — Alaa's decision matters.

## (b) Growing season Oct–May vs Nov–Jun

| | Sétif | Constantine | Tiaret |
|---|---|---|---|
| Season rain Oct–May / Nov–Jun (mm) | 463.8 / 419.1 | 576.0 / 517.6 | 518.0 / 479.4 |
| Longest dry spell Oct–May / Nov–Jun (days) | 23.2 / 22.7 | 22.3 / 21.8 | 32.4 / 30.7 |

**Robust**: conclusions (Tiaret has the longest spells; season rain is 10–15% of annual) barely move.
**Not robust**: exact values shift ~40–60 mm rain / 1–2 spell days. Low stakes.

## (c) Hot-day threshold (Apr–Jun, days/yr)

| Threshold | Sétif | Constantine | Tiaret |
|---|---|---|---|
| 33 °C | 7.9 | 15.3 | 15.7 |
| 35 °C (current) | 3.1 | 9.7 | 9.2 |
| 37 °C | 0.9 | 5.7 | 4.2 |

**Robust**: ranking (Sétif fewest hot days), and the order of magnitude (roughly doubling from 37→33 °C).
**Not robust**: the exact counts (2.5× between 33 and 37 °C). Younes's threshold choice is a direct multiplier on the UI number.

## (d) Frost window Feb–Apr vs Mar–Apr

| Window | Sétif | Constantine | Tiaret |
|---|---|---|---|
| Feb–Apr | 14.7 | 2.6 | 4.6 |
| Mar–Apr (current) | 4.5 | 0.4 | 1.1 |

**Robust**: ranking (Sétif clearly the frostiest) and the qualitative "Constantine is almost frost-free in spring".
**Not robust**: magnitude — Feb roughly triples the count. Only Mar–Apr represents *late* frost hitting grain filling; Feb–Apr is a broader "cold season" reading.

## (e) POWER vs ERA5 as the rainfall source

| | Sétif | Constantine | Tiaret |
|---|---|---|---|
| Annual rain 1995–2024 | 574.9 / 506.2 | 684.4 / 491.2 | 575.3 / 401.7 |
| Trend label | both methods agree / both methods agree | no clear trend / no clear trend | no clear trend / no clear trend |
| Trend p-values (OLS/MK) | 0.046, 0.009 / 0.004, 0.017 | 0.125, 0.144 / 0.110, 0.101 | 0.509, 0.544 / 0.573, 0.617 |

**Robust**: only Sétif has a statistically significant rainfall decline — in **both** sources, under **both** tests. No region shows a significant increase.
**Not robust**: absolute rainfall (POWER is 13–43% wetter) and the water-stress ranking (above).
