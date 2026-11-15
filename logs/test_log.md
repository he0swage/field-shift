# Test log: hand calculation vs code (LIVE Setif / Algeria data — FOR YOUNES'S REVIEW)

> Inputs are LIVE (NASA POWER 1995-2024 + ISRIC SoilGrids v2.0 0-30cm + ORNL MODIS MOD13Q1 + FAO/ICARDA/ITGC).

## Worked example (Region A: Setif High Plateaux 36.15N, 5.38E)
Rotation: wheat, chickpea, canola. Weights: profit .4, water .2, soil .2, risk .2.
Live Indicators: rain 484.5 mm (20-yr ref 607.8 mm), SoilGrids SOC 12.52 g/kg (threshold 15.0). K_WATER = K_SOIL = 1.5.

1. water_stress = (607.8 - 484.5) / 607.8 = 0.202863; soc_deficit = (15 - 12.52) / 15 = 0.165333
2. w_water = 0.2 * (1 + 1.5 * 0.202863) = 0.260859; w_soil = 0.2 * (1 + 1.5 * 0.165333) = 0.249600
3. Sum = 0.4 + 0.260859 + 0.249600 + 0.2 = 1.110459; normalise each by 1.110459
4. profit = (.68 + .72 + .70) / 3 = 0.700000; water = 1 - (.52 + .35 + .48) / 3 = 0.550000
5. soil = 0.5 * (.72 + .40 + .62) / 3 + 0.5 * min(1, 2 * (1/3)) = 0.290000 + 0.333333 = 0.623333
6. risk = 1 - (.35 + .38 + .40) / 3 = 0.623333
7. TOTAL = (.4*.70 + .260859*.55 + .249600*.623333 + .2*.623333) / 1.110459 = 0.633723

## Side by side (tolerance 1e-05)
| Quantity | Hand | Code | Status |
|---|---|---|---|
| water_stress | 0.202863 | 0.202863 | OK |
| soc_deficit | 0.165333 | 0.165333 | OK |
| w_profit (norm) | 0.360211 | 0.360211 | OK |
| w_water (norm) | 0.234911 | 0.234911 | OK |
| w_soil (norm) | 0.224772 | 0.224772 | OK |
| w_risk (norm) | 0.180106 | 0.180106 | OK |
| profit score | 0.700000 | 0.700000 | OK |
| water score | 0.550000 | 0.550000 | OK |
| soil score | 0.623333 | 0.623333 | OK |
| risk score | 0.623333 | 0.623333 | OK |
| TOTAL | 0.633723 | 0.633723 | OK |

**Result: ALL MATCH**
