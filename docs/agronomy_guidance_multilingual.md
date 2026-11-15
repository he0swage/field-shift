# Field Shift Reviewed Agronomy & Scoring Guidance (EN / FR / AR)

Document ID: `DOC-AGRO-001`
Reviewed Sources: ICARDA WANA Cereal-Legume Trials, ITGC Algeria Technical Itineraries, USDA NASS & K-State Extension (Central Kansas), ICAR & PAU Ludhiana (Punjab), FAO-56 Crop Water Requirements, NASA POWER, ISRIC SoilGrids v2.0, ORNL DAAC MODIS MOD13Q1, NASA FIRMS VIIRS.

---

## Section 1: Why a 3-Year Rotation Period & Can Other Periods (2, 4, 5 Years) Be Used?

### 1.1 Why 3 Years is the Default Baseline (`rotation_length: 3`)
In semi-arid Mediterranean rainfed systems (Sétif `regionA`), continental Great Plains rainfed systems (Central Kansas `regionB`), and irrigated Indo-Gangetic plains (Punjab `regionC`), a **3-year rotation horizon (`rotation_length = 3`)** is the shortest cycle that simultaneously satisfies three agronomic rules:
1. **Break cereal monoculture disease carryover** (`forbid_consecutive_same_family: true`): Take-all (*Gaeumannomyces graminis*), *Fusarium* crown rot, and grassy weeds (*Bromus*, *Phalaris minor*, jointed goatgrass) build up when two cereals follow each other.
2. **Respect the 2-year pulse disease break** (`max_occurrences_per_crop: 1`): Large-seeded legumes such as chickpea (*Ascochyta* blight), lentil (*Fusarium* wilt), and faba bean (*Orobanche* broomrape) require at least 2 years between identical pulse crops.
3. **Deliver a three-functional-group sequence**: Cereal (Year 1) → Nitrogen-Fixing Legume (Year 2, providing `-25%` synthetic NPK credit in Year 3) → Broadleaf Oilseed, Forage, or Alternate Cereal (Year 3).

### 1.2 Other Possible Rotation Periods (2-Year, 4-Year, 5-Year & Double-Cropping Seasons)
The Python scoring engine (`engine/scoring.py`) is parameterized by `rules["rotation_length"]` in `domain/regions/<region>/rules.json` and evaluates `itertools.product(sorted(crops), repeat=rules["rotation_length"])`:
- **2-Year Period (`rotation_length = 2`, Cereal–Legume Biculture)**: Common in dryland Wheat–Lentil (Algeria), Corn–Soybean (Kansas), or Wheat–Mung bean. Pros: simple management, 50% legume frequency. Cons: a 1-year break is too short for *Ascochyta* blight in chickpea or *Aphanomyces* root rot in field pea, and leaves no slot for a deep-rooted oilseed taproot (canola, safflower, sunflower).
- **4-Year Period (`rotation_length = 4`, Cereal → Legume → Cereal → Oilseed/Forage)**: Ideal for diversifying weed control and allowing a full 3-year break before repeating sensitive pulses or brassicas (canola, mustard). Requires setting `max_occurrences_per_crop: 1` (with 4 distinct crops) or `2` (allowing wheat twice if separated by a legume and an oilseed).
- **5-Year Ley Rotation (`rotation_length = 5`, Perennial Alfalfa / Sulla Phase)**: Perennial forage legumes (`alfalfa` in Kansas, `sulla` in Sétif) occupy a field for 2 to 3 consecutive years to rebuild deep soil organic carbon (`soc_g_per_kg`) and fix `+30 to +45 kg N/ha/yr`, followed by 2 to 3 years of grain and oilseed cash crops.
- **Sub-Annual Double Cropping (2 Seasons/Year — Kharif + Rabi)**: In irrigated Punjab (`regionC`), farmers grow two crops per year (e.g., Kharif rice or maize in June–October followed by Rabi wheat, chickpea, or mustard in November–April), and sometimes a 65-day summer `mung_bean` catch crop in April–June. As disclosed in `G10`, the current engine models one primary crop per step; double-cropping sequences can be represented by pairing Kharif and Rabi crops across consecutive steps.

### 1.3 Résumé en Français (Durée de rotation : 2, 3, 4 ou 5 ans)
Le cycle de **3 ans (`rotation_length = 3`)** est la période minimale pour combiner une céréale, une légumineuse fixatrice d'azote (`nitrogen_fixing = 1`, réduisant l'engrais NPK de `-25%` l'année suivante) et un oléagineux ou fourrage, tout en évitant le retour trop rapide de l'anthracnose du pois chiche (*Ascochyta*) ou de l'orobanche. Le moteur Python (`engine/scoring.py`) accepte d'autres périodes via `rotation_length` dans `rules.json` : **2 ans** (blé–lentille ou maïs–soja), **4 ans** (céréale → légumineuse → céréale → colza/tournesol) ou **5 ans** (avec luzerne `alfalfa` ou sainfoin `sulla`).

### 1.4 ملخص بالعربية (فترة الدورة الزراعية: سنتان، 3 سنوات، 4 أو 5 سنوات)
تُعد **الدورة الثلاثية (3 سنوات `rotation_length = 3`)** الفترة النموذجية لأنها تكسر أمراض الحبوب المتتالية (`forbid_consecutive_same_family`) وتمنح فترة راحة كافية للبقوليات ضد الأمراض الفطرية (مثل لفحة الأسكوكيتا في الحمص والهالوك في الفول)، مع توفير رصيد نيتروجين طبيعي يقلل السماد الكيميائي (`NPK`) بنسبة **25%** للمحصول التالي. يدعم محرك التقييم (`engine/scoring.py`) تغيير طول الدورة (`rotation_length`) إلى **سنتين** (قمح–عدس أو ذرة–صويا)، أو **4 سنوات** (حبوب ← بقوليات ← حبوب ← محاصيل زيتية مثل الكانولا والقرطم)، أو **5 سنوات** للمحاصيل العلفية المعمرة مثل الفصة (`alfalfa`) والسلة (`sulla`).

---

## Section 2: How the Scoring Engine Computes Plan Scores (`engine/scoring.py`)

### 2.1 Four Criterion Scores (`criterion_scores`)
For any candidate rotation $R = (c_1, c_2, \dots, c_n)$ of length $n$, `criterion_scores(rotation, crops)` computes four normalized scores in $[0, 1]$ (displayed as $0\text{–}100\%$ in the UI):
- **`profit` (`criteria.profit`)**: Mean of crop `profit` ratings across the rotation: $\text{mean}(\text{profit})$. Expected gross revenue is computed in `gross_income_dzd_ha` from regional `yield_potential` (q/ha) $\times$ `price_local`.
- **`water` (`criteria.water`)**: Water-saving score: $1 - \text{mean}(\text{water\_need})$. Lower crop `water_need` yields a higher `water` score. UI `waterNeed` is $(1 - \text{criteria.water}) \times 100$.
- **`soil` (`criteria.soil`)**: Soil protection & regeneration score: $0.5 \times \text{mean}(\text{residue\_carbon}) + 0.5 \times \min(1.0, 2 \times \text{mean}(\text{nitrogen\_fixing}))$. Rewards both crop residue carbon return and nitrogen-fixing legumes.
- **`risk` (`criteria.risk`)**: Risk safety score: $1 - \text{mean}(\text{risk\_level})$. Lower crop `risk_level` yields a higher `risk` score.

### 2.2 Climate & Soil Stress Weight Adjustment (`derive_stress` & `adjust_weights`)
The engine reads local satellite indicators from `indicators.json` and `thresholds.json`:
- **`water_stress` (`stress.water_stress`)**: $\text{clamp}((\text{rainfall\_reference\_mm} - \text{rainfall\_mm}) / \text{rainfall\_reference\_mm}, 0, 1)$.
- **`soc_deficit` (`stress.soc_deficit`)**: $\text{clamp}((\text{soc\_threshold\_g\_per\_kg} - \text{soil\_organic\_carbon\_g\_per\_kg}) / \text{soc\_threshold\_g\_per\_kg}, 0, 1)$.
- **Dynamic weight amplification (`adjust_weights`)**:
  - $w_{\text{water}}' = w_{\text{water}} \times (1 + K_{\text{WATER}} \times \text{water\_stress})$ with $K_{\text{WATER}} = 1.0$.
  - $w_{\text{soil}}' = w_{\text{soil}} \times (1 + K_{\text{SOIL}} \times \text{soc\_deficit})$ with $K_{\text{SOIL}} = 1.0$.
  - All four weights (`profit`, `water`, `soil`, `risk`) are re-normalized to sum to $1.0$ in `adjusted_weights`, and `score = total_score(criteria, adjusted_weights)`.

### 2.3 Hybrid ML Transition Score, Environmental Match & 3-Year Soil Trajectory
- **`env_match_pct` (`ml_metrics.env_match_pct`, UI "Climate match" / `scores.knn`)**: Checks whether regional `rainfall_mm` falls inside each crop's optimal rainfall envelope `[optimal_rain_min, optimal_rain_max]` (92% inside, Gaussian decay outside).
- **`ai_confidence_pct` (`ml_metrics.ai_confidence_pct`, UI "Crop sequence fit" / `scores.ml`)**: Pairwise transition probability rewarding family breaks (`family_break = +1.0` vs `-0.8` same family), legume nitrogen restoration after heavy feeders (`depletion >= 3` followed by `nitrogen_fixing == 1`), drought tolerance, and low water need.
- **`trajectory_3yr` (`simulate_3yr_trajectory`)**: Tracks year-by-year `projected_nitrogen_kg_ha` (starting from $45 + 2.5 \times \text{SOC}$), `soil_health_pct`, and `npk_dose_kg_ha`. When a crop follows a nitrogen-fixing legume (`legume_credit_applied: true`), its synthetic fertilizer dose `base_npk_kg_ha` is reduced by **25%** (`0.75 * base_npk`), yielding `total_3yr_npk_kg_ha` and `fertilizer_saved_vs_existing_kg_ha`.
- **`ranking_stability_pct` (`compute_ranking_stability`)**: Runs 100 seeded Monte Carlo weather simulations perturbing rainfall by $\pm 15\%$ and reports the percentage of years where Rank 1 stays on top.

---

## Section 3: Scope Boundaries & What This Guidance Does NOT Cover (Refusal Policy)

Field Shift's reviewed agronomy corpus covers **only**:
1. Multi-year crop rotation planning, agronomic rules (`rules.json`), and crop compatibility in `regionA` (Sétif, Algeria), `regionB` (Central Kansas, USA), and `regionC` (Punjab, India).
2. Engine scores (`score`, `criteria`, `adjusted_weights`, `stress`, `ml_metrics`, `trajectory_3yr`, `ranking_stability_pct`) and crop traits in `domain/crops_base.csv` and `domain/regions/*/yield.csv`.
3. Satellite climate, soil, NDVI, and Fire Watch indicators (NASA POWER, ERA5, ISRIC SoilGrids v2.0, MODIS MOD13Q1, NASA FIRMS VIIRS) and scientific disclosures `G1`–`G12`.

**Out-of-Scope Topics (Must Refuse):**
- Synthetic pesticide, herbicide, or fungicide brand prescriptions, spray mixing rates, or chemical pest eradication schedules.
- Livestock veterinary medicine, animal surgery, or feedlot antibiotic dosing.
- Tractor mechanics, combine harvester engine diagnostics, or IoT hardware wiring.
- Financial/cryptocurrency speculation, stock trading, legal land disputes, or non-agricultural topics.
- Tropical plantation crops not in the reviewed database (e.g., cocoa, coffee, oil palm, bananas, rubber).

