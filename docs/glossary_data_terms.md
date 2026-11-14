# Glossary — data terms in farmer-friendly words

Draft for Younes/Aniss to review and shorten as needed. Plain English; a French/Arabic version is a Should.

## NDVI (Normalized Difference Vegetation Index)
A greenness score from satellite pictures. Healthy, dense crops reflect more near-infrared light, which raises the score. Bare soil is around 0.1–0.2; a strong wheat canopy reaches 0.6–0.8. We use the spring peak NDVI near each region only as a rough proxy of how the vegetation has been doing — not a yield measurement.

## Evapotranspiration (ET)
The water a field "breathes out" — evaporation from the soil plus transpiration through the plants. Hot, dry, windy days push it up; when ET is much higher than rainfall, the crop is living on soil water. (Not yet an indicator in our pipeline — a Should.)

## Soil moisture anomaly
How much wetter or drier the soil is right now compared with its usual level for the same date, on the same spot. A strongly negative anomaly for weeks means the drought is real in the root zone, not just in the rain gauge. (Not yet in the pipeline; SMAP satellite data could give it.)

## Frost risk (as we measure it)
Not "it froze this winter", but "how often sub-zero nights fall *after* the crop starts growing". We count nights below 0 °C between 1 March and 30 April — the window when a frost can kill young wheat ears. The whole-winter count is a different, much larger number; don't mix them.

## Water stress (as we compute it)
How much drier recent years were than the region's own long-term average: `1 − (recent rainfall / 1995–2014 average)`. 0 means recent rainfall matches the old average; 0.2 means recent years were 20% drier. It compares a region with itself, so a measurement bias that affects both periods partially cancels.

## Trend confidence
Rainfall changes slowly and noisily, so we run two independent tests (least-squares slope and the rank-based Mann–Kendall test). Only when both agree the decline is real do we label "both methods agree" with high confidence. One test alone can be fooled by a few extreme years.

## 250 m soil estimate
The soil numbers (organic carbon, pH) are not from your field. SoilGrids is a computer model that blends thousands of lab-analyzed soil profiles with satellite data and predicts values everywhere on a 250 m grid. Treat it as regional background: good for comparing regions, not for deciding fertilizer on one plot. That's why its confidence is capped at "medium".

## Reanalysis vs station measurement
A weather station measures real rain at one point — accurate there, but rare here. A **reanalysis** (POWER, ERA5) takes millions of observations from satellites and a global weather model and reconstructs a complete, gap-free record on a ~25–50 km grid. Advantages: every point covered, every day since 1981+. Disadvantage: each grid cell is an average over a huge area — a storm that hit one village can be invisible, and mountains are smoothed out. We cross-check two independent reanalyses (NASA POWER vs ERA5) and show their disagreement as a confidence label.
