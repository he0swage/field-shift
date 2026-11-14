# About the data — sources, limits, attribution

Draft for review (Aniss/Younes). Citation lines below were checked against each provider's current terms on 2026-11-14 (links included); where we could not verify something, it is marked.

## NASA POWER (daily weather)

- **What it is**: NASA Langley's "Prediction Of Worldwide Energy Resources" — satellite-derived, gridded meteorology; our source for daily rain (PRECTOTCORR), Tmax (T2M_MAX), Tmin (T2M_MIN), 1995–2024.
- **Resolution**: the underlying MERRA-2/SWCCCC grid is ~0.5° × 0.625° (≈50 km); POWER interpolates to the requested point, which does **not** add real detail. Daily meteorology available from 1981.
- **Known limits (observed here)**: systematically wetter than ERA5 by 13–43% over 1995–2024 in our three regions; ERA5 values sit inside the ITGC ranges, POWER's Constantine/Tiaret values sit above them. A gridded product, not a station measurement.
- **Attribution (verified at https://power.larc.nasa.gov/docs/referencing/)**: include both:
  - *Reference*: "The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division."
  - *Data reference*: "The data was obtained from the POWER Project's Daily 2.x.x version on 2026-11-13." (adjust version/date to the actual fetch)
  - License: CC BY 4.0, no other restrictions (verified via registry.opendata.aws/nasa-power). POWER also requests a notification for published uses (larc-power-project@mail.nasa.gov) — flagged for Aniss if we publish.

## ISRIC SoilGrids (SOC, pH)

- **What it is**: machine-learning global soil property maps from ~230,000 profile observations; our source for soil organic carbon and pH (0–30 cm).
- **Resolution**: 250 m model estimate with quantified uncertainty (we do not yet pull the uncertainty layers). It is a prediction, not a lab measurement of our plots.
- **Attribution (verified at https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html)**: license CC BY 4.0; cite as: Poggio, L., de Sousa, L. M., Batjes, N. H., Heuvelink, G. B. M., Kempen, B., Ribeiro, E., and Rossiter, D.: *SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty*, SOIL, 7, 217–240, 2021. https://doi.org/10.1005/soil-7-217-2021 (DOI as printed in the FAQ).

## MODIS NDVI (MOD13Q1 via ORNL DAAC subsetting)

- **What it is**: Terra MODIS 16-day vegetation indices at 250 m; we use NDVI spring peaks (DOY 65–145, 2020–2024) from the ORNL DAAC MODIS subsetting service around each region point.
- **Known limits (observed here)**: no cropland mask (the 5×5 km patch mixes field crops, roads, fallow), no per-pixel QA filtering in our pipeline, only 5 years, and the yield baseline (0.25–0.75 normalization) is a linear proxy — hence "low" confidence.
- **Attribution (verified via https://lpdaac.usgs.gov/news/lp-daac-releases-modis-version-61-vegetation-indices-data-products/ and earthdata.nasa.gov)**: Didan, K., 2021, MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061 [dataset], NASA Land Processes DAAC, https://doi.org/10.5067/MODIS/MOD13Q1.061. Accessed 2026-11-13. LP DAAC data has no restrictions on use (EOSDIS Data Use and Citation Guidance). Our access went through the ORNL DAAC subsetting tool — cite the product DOI above and mention the ORNL DAAC service by name.

## Open-Meteo / ERA5 (cross-check weather)

- **What it is**: Open-Meteo's free Historical Weather API serving ECMWF's ERA5 reanalysis; we use daily precipitation, Tmax, Tmin 1995–2024 as an **independent cross-check** of POWER (shown as `crosscheck_value` in every indicator, and as the basis of the confidence labels).
- **Resolution**: ERA5 is ~25–31 km reanalysis grid; Open-Meteo statistically down-scales to the requested point. Non-commercial use only for the free API tier — our one-off data save qualifies (verified terms at https://open-meteo.com/en/terms).
- **Attribution (verified at https://open-meteo.com/en/licence)**: license CC BY 4.0. Required form next to displayed data: link "Weather data by Open-Meteo.com" (https://open-meteo.com/). Open-Meteo also encourages a citation in research work.

## Standing attribution lines (ready to paste)

- "Weather: NASA POWER (NASA Langley Research Center), and cross-checked against ERA5 via Open-Meteo.com."
- "Soil: SoilGrids 2.0 © ISRIC, CC BY 4.0 (Poggio et al. 2021)."
- "Vegetation: MODIS/Terra NDVI (MOD13Q1 V061), NASA LP DAAC, DOI 10.5067/MODIS/MOD13Q1.061."
- Each line should carry the access date used at fetch time (2026-11-13 in `data/raw/`).

## What we could not verify

- The exact POWER "Daily 2.x.x" version number of our fetches (the raw responses' header block was not kept in `data/raw/`); fill in the version from the response headers next time `analysis/save_raw.py` runs.
- Whether thehackathon's final deliverable needs the POWER "publication notification" email — Aniss decides.
