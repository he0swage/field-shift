## 1. Verdict in one table

| Area | Status | What it means |
|---|---|---|
| regionA (Setif, Algeria) climate and soil | Real data, with caveats | Built from NASA POWER, ERA5 cross-check, SoilGrids and MODIS. The raw files are not in the repo, so nobody can re-run it. |
| regionB (Kansas) and regionC (Punjab) climate, soil, NDVI, forecast | Hand-written estimates | Written by scripts/setup_multiregion_domain.py (yearly rain is a constant list, monthly rain is a typed array). Not fetched from NASA POWER or SoilGrids. |
| Fire Watch snapshots (all 3 regions) | Sample data | All three files carry the same hard-coded fetched_at of 2026-11-14T09:30:00Z. No live FIRMS call produced them. |
| Crop yields (regionA, B, C) | Mostly sourced, one year or one average | Named sources (ITGC, USDA NASS, PAU, ICAR) but typed in by hand, no file or link per number. |
| Crop prices and gross income | Unit and currency problem | See section 3. Kansas income looks too high and the currency column is misleading. |
| Crop traits (crops_base.csv, 19 crops) | Global defaults | One value per crop for every region (water need, N impact, rain range). Not adjusted per climate. |

## 2. Data we have and where each item is used

| Data (file) | What it contains | Used in |
|---|---|---|
| domain/regions.csv | 3 regions: id, name, lat, lon, role (deep or light), farming system, default crops, currency | build_frontend_data.py, then realDataBundle.json, then region cards, header selector, banners |
| domain/crops_base.csv | 19 crops: family, water need, soil effect, drought tolerance, N fixing, profit score, risk, optimal rain and pH | engine/scoring.py load_region() joins it with each region yield file; frontend localEngine.js scoring |
| domain/regions/regionX/yield.csv | Yield (q/ha), local price, gross income, local risk note, source | load_region(); crop chips, Review step, income figures in rankings |
| domain/regions/regionX/rules.json | Rotation rules: 3 years, no same family twice in a row, minimum 1 legume, max 1 high-water crop, no repeats | engine passes_rules; localEngine.js passesRules (decides which rotations are allowed) |
| domain/regions/regionX/thresholds.json | Hot day, frost night, extreme rain, dry day, SOC threshold, reference rainfall | Water-stress calculation in scoring.py; climate indicators |
| data/processed/regionX/indicators.json | Rainfall, 30-year mean, trend, water stress, hot, frost and extreme-rain days, longest dry spell, pH, NDVI, suggested priorities | Step 1 region facts, Climate step, scoring, priority presets |
| data/processed/regionX/climate_yearly.json | Annual rainfall 1995-2024 | Annual line chart (Climate step), trend |
| data/processed/regionX/climate_monthly.json | Monthly rainfall averages | Monthly bar chart |
| data/processed/regionX/climate_text.json | Plain-language explanations (EN, FR, AR) | Climate step text cards |
| data/processed/regionX/soil.json | SOC, pH, texture, confidence | Soil card, soil score in the engine |
| data/processed/regionX/forecast.json | SARIMA seasonal outlook (experimental) | Climate step outlook card |
| data/processed/regionX/fires_snapshot.json | Fire detections within 25 km, dry-conditions block | Fire Watch card, banner, 25 km map view |
| data/processed/regionX/crosscheck_openmeteo.json | Open-Meteo ERA5 comparison (regionA only) | Not read by server, engine or frontend; its result is already baked into indicators.json confidence labels |
| data/inputs/gaps.json | 12 honest limitations (G1 to G12) | About modal, Review step warnings |
| data/inputs/rules.json, indicators.json, crops.csv, request.json | Original Algeria-only inputs | Not read by server.py, engine or frontend (only scripts use it); engine.py at repo root was not checked |
| data/processed/crops/*.json (19 files) | Per-crop cards with sources | Not read by server, engine or frontend; only generated and referenced by scripts |
| data/processed/sensitivity.json, regions_summary.json | Sensitivity test and old region summary | Not read by server, engine or frontend; only referenced by setup and fetch scripts |
| frontend/src/data/realDataBundle.json | Everything above merged into one file | The Netlify site (it has no server, so it reads only this bundle) |

## 3. What is not accurate

| # | Problem | Evidence | Impact | Fix |
|---|---|---|---|---|
| A1 | Income values are in DZD-equivalent but the column says USD or INR | yield.csv has currency=USD for Kansas; engine keys are named gross_income_dzd_ha; format.js converts at about 135 DZD per USD; RotationStep label says "DA-equiv/q" | Users and teammates read the wrong currency; hard to audit | Store price in local currency and convert in one place, or rename the column to dzd_equiv |
| A2 | Kansas income looks too high | Wheat: 31.6 q/ha x 5200 = 164,320. At 135 DZD/USD that is about 1,217 USD/ha, about 493 USD/acre. USDA yield of 47 bu/ac at roughly 6 USD/bu (my estimate) gives about 280 USD/acre | Kansas wheat, corn and soybean look more profitable than they are | Re-enter prices as USD per bushel from USDA NASS, convert to per hectare |
| A3 | Fixed profit tag threshold | server.py tags highProfit at gross income >= 130000 (a DZD number) | The tag means different things in USD and INR regions | Use a threshold per region, or compare within the region |
| A4 | Reference rainfall disagrees with indicators (regionA) | thresholds.json 402 mm; indicators 509 mm (2015-2024); 30-year mean 574.9; ERA5 405.5; realDataBundle also shows 607.8 for another entry | Water stress can be computed against the wrong baseline | Pick one rule (30-year mean of the same source) and apply it to all regions |
| A5 | Soil confidence too high for B and C | soil.json says "high"; the project rule (G1, PRD) says soil from SoilGrids is at best medium | Overstates trust | Set to medium, or fetch real SoilGrids values |
| A6 | B and C indicators carry confidence "high" without a cross-check | No crosscheck_openmeteo.json exists for regionB or regionC | Confidence is asserted, not measured | Run the same POWER vs ERA5 check and label from the result |
| A7 | regionA hot-day and frost-day confidence is low | data_quality.md: POWER vs ERA5 differs by 67.9% (hot days) and 47.8% (frost days) | Heat and frost counts are weak numbers | Show as range, or use a station dataset |
| A8 | NDVI is weak | Source note: no cropland mask, no QA filter, 5 years, confidence low | NDVI-based yield baseline is rough | Apply ESA WorldCover cropland mask and QA filter, use 10+ years |
| A9 | Kansas hot days per year may be too high | indicators show 34.2 days above 35 C; not verified against a station | Heat risk for corn may be overstated | Verify against NOAA Salina station |
| A10 | Rainfall is not water stress for irrigated land | Already disclosed (G9) | Punjab water-stress card can mislead | Keep the banner; add groundwater or canal data later |
| A11 | One crop per year only | Already disclosed (G10) | Punjab rice-wheat double cropping is not modelled | Keep the disclosure; add seasons as a later feature |

## 4. What is missing

| # | Missing item | Why it matters | Priority |
|---|---|---|---|
| M1 | data/raw folder (POWER, ERA5, SoilGrids, MODIS downloads) | indicators say "offline from data/raw" but the folder is not in the repo, so regionA cannot be reproduced | High |
| M2 | Real fetched climate and soil for regionB and regionC | These are the "light" regions; today they are typed values | High |
| M3 | Live or recent FIRMS fire data | All fire snapshots are samples with the same timestamp. A FIRMS_MAP_KEY and a refresh script are needed | High |
| M4 | Production cost per crop (seed, fertilizer, labour, irrigation, diesel) | "Gross income" is shown, but a farmer needs profit after cost | High |
| M5 | Planting and harvest calendar per crop and region | Needed for frost and heat windows and for sensible rotations | Medium |
| M6 | French and Arabic text for regionA | climate_text.json for regionA has empty fr and ar; B and C have them | Medium |
| M7 | organic_carbon and sources blocks in B and C indicators.json | regionA has them; B and C do not, so the structure differs | Medium |
| M8 | Price history and volatility | A single price per crop; no range or trend | Medium |
| M9 | Soil texture, N, P, K and water holding for regionA | Only SOC and pH exist for regionA | Medium |
| M10 | Regional fertilizer and N-fixation values | n_impact_kg_ha is one global number per crop | Medium |
| M11 | Second Algerian point (Tiaret, Constantine) in the app | The data exists in data/processed but regionA is the only one wired in | Low |
| M12 | Pending definitions | water stress definition (pending Alaa), SOC class threshold (pending Younes) | Medium |
| M13 | Clean-up of legacy folders | setif, tiaret, constantine, regionX, domain/crops_algeria.csv, data/regional duplicate the new structure | Low |

## 5. Suggested extra crops for farmers

All numbers below must be sourced before they go in yield.csv. Those columns are left for the team.

| Region | Crop | Role in rotation | Why it fits | To source |
|---|---|---|---|---|
| regionA Setif | Field pea | Legume | Cool-season, fixes nitrogen, fits cereal rotations | ITGC yield and price |
| regionA Setif | Potato | Cash root crop | Setif is a known potato area; high income but needs water | Yield, cost, irrigation need |
| regionA Setif | Sulla (Hedysarum) | Forage legume | Mediterranean forage legume, good for livestock farms | ICARDA data |
| regionA Setif | Lupin | Legume | Tolerates poor soil; protein crop | Local trials |
| regionA Setif | Onion or garlic | Vegetable | Common irrigated option on the plateau | Price, water use |
| regionA Setif | Coriander | Low-water cash crop | Short cycle, low input | Yield and price |
| regionB Kansas | Cover crops (cereal rye, hairy vetch, crimson clover) | Soil cover | Hold moisture, add N (vetch, clover), reduce erosion | K-State Extension |
| regionB Kansas | Alfalfa | Perennial forage | Deep roots, strong in dry years; breaks the 3-year cycle, needs a rule exception | Yield and price |
| regionB Kansas | Cotton (south) | Cash crop | Suitable in warmer parts of the state | USDA NASS |
| regionB Kansas | Proso millet | Low-water summer crop | Short season, drought tolerant | K-State data |
| regionB Kansas | Field pea | Legume | Cool-season legume before sorghum | Yield, price |
| regionB Kansas | Flax | Oilseed | Fits the winter wheat region | USDA NASS |
| regionC Punjab | Pearl millet (bajra) | Cereal | Very low water need, strong against heat | ICAR yield, MSP |
| regionC Punjab | Groundnut | Legume oilseed | Fixes N, suited to light soils | PAU data |
| regionC Punjab | Pigeon pea | Legume | Deep roots; long season | ICAR-IIPR |
| regionC Punjab | Berseem (clover) | Fodder legume | Winter forage legume that adds N | PAU |
| regionC Punjab | Potato | Cash crop | Important Punjab winter crop | PAU, cost |
| regionC Punjab | Cotton | Cash crop | Grown in southwest Punjab | CACP |
| regionC Punjab | Sesame | Low-water oilseed | Short summer crop | ICAR |
| regionC Punjab | Barley | Cereal | Uses less water than wheat | PAU |
| regionC Punjab | Direct-seeded rice (practice) | Water saving | Cuts irrigation versus puddled rice | PAU trials |

## 6. Suggested fixes and additions

| Priority | Action | Owner (suggested) | Effort |
|---|---|---|---|
| 1 | Fix the currency and unit problem (A1, A2, A3): one price unit, one conversion point | Alaa and Achref | 2 to 3 h |
| 2 | Replace hand-written regionB and regionC climate and soil with real NASA POWER and SoilGrids pulls, and keep the raw files in the repo | Achref | 2 h per region |
| 3 | Set a FIRMS_MAP_KEY and add a script that refreshes fires_snapshot.json; show the real fetched_at | Achref | 1 h |
| 4 | Align reference rainfall rule and the three confidence labels (A4, A5, A6) | Achref | 1 h |
| 5 | Add production cost per crop so the app shows profit, not only gross income | Alaa | 3 h |
| 6 | Add the suggested crops from section 5, 4 to 6 per region, with sourced yields | Alaa | 2 h per region |
| 7 | Add planting calendar and use it for frost and heat windows | Alaa and Achref | 4 h |
| 8 | Fill French and Arabic text for regionA | Team | 1 h |
| 9 | Add a "data last updated" line and a source link on each region card | Frontend | 1 h |
| 10 | Remove legacy folders and duplicate files; keep one structure | Team | 30 min |
| 11 | Add a unit test that checks every yield.csv row: price times yield equals income, and currency matches regions.csv | Team | 30 min |
| 12 | Later: seasons (two crops per year), groundwater for Punjab, local soil test upload | Team | Future |
