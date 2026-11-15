# Regional Selection, Crop Table & Agronomic Rules (Field Shift — Algeria)

This document defines the scientifically grounded **3 benchmark regions**, **13-crop regional catalog**, and **agronomic rule set** built for Algeria / North Africa dryland cereal–legume–oilseed systems, replacing generic tropical datasets (`CropSense` / `DharaaAI`).

---

## 1. Why These 3 Regions Were Selected (and Why Mitidja Was Replaced)

Following **ITGC (Institut Technique des Grandes Cultures)** station locations, FAOSTAT crop footprints, and ICARDA Mediterranean aridity gradients, we selected three benchmark dryland cereal–legume zones spanning `300–600 mm` rainfall:

| ID | Region (ITGC Benchmark Station) | Coordinates | Annual Rain | Soil Type & Chemistry | Role in Field Shift |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `regionA` | **Sétif High Plateaux** | `36.19°N, 5.41°E` | `300–450 mm` (`380 mm`) | Brown calcareous & clay-loam vertisols (`pH 7.9`, `SOC 9.9 g/kg`) | **Dry Semi-Arid Stress Case:** Frequent winter frost (`< 0 °C`), spring dry spells, traditional cereal-fallow shifting to barley/durum wheat + lentil/chickpea/forage oats. |
| `regionB` | **Constantine / El Khroub Plains** | `36.36°N, 6.61°E` | `450–600 mm` (`530 mm`) | Deep clay vertisols & calcareous rendzinas (`pH 7.7`, `SOC 14.5 g/kg`) | **Sub-Humid Cereal-Pulse Hub:** Replaces coastal horticulture Mitidja. High yield potential for durum wheat + faba bean/lentil + canola under conservation agriculture (*semis direct*). |
| `regionC` | **Tiaret Western Plateaux** | `35.37°N, 1.32°E` | `350–500 mm` (`420 mm`) | Deep clay-loam, vertisols & calcareous slopes (`pH 7.8`, `SOC 10.8 g/kg`) | **Semi-Arid Transition Belt:** Large-scale mechanized cereal zone shifting via CCLS to chickpea/forage/canola to control wild oats (*Avena sterilis*). |

> **Why Mitidja (`600–800+ mm`) was replaced by Constantine:** Agronomic literature shows Mitidja is dominated by **irrigated coastal horticulture, vegetables, and citrus orchards**, not rainfed cereal-legume rotations. **Constantine / El Khroub** is Algeria's flagship sub-humid cereal-legume-oilseed research belt.

Machine-readable config: [regions.json](file:///Users/morsistoredz/NasaSpaceApps/data/regional/regions.json)

---

## 2. Regional Crop Table (`data/regional/crops_algeria.csv`)

Calibrated to **FAO Irrigation & Drainage Paper No. 56 ($ET_c$)**, **ICARDA WANA biological nitrogen fixation trials**, and **ITGC Algeria yield benchmarks**:

| Crop | Botanical Family | FAO $ET_c$ (mm) | Net N (`kg/ha`) | OAIC/CCLS Price (`DA/q`) | Baseline Yield (`q/ha`) | Baseline Gross (`DA/ha`) | Primary Agronomic Role & Risk (`needs local review`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Durum Wheat** (*Triticum durum*) | `cereal` (*Poaceae*) | `350–500` | `-30` | `6,000 DA/q` (OAIC) | `22 q/ha` | `132,000 DA/ha` | Primary staple grain; sensitive to `>35 °C` grain-filling heat & *Fusarium*/rust. |
| **Soft Wheat** (*Triticum aestivum*) | `cereal` (*Poaceae*) | `350–500` | `-28` | `5,000 DA/q` (OAIC) | `24 q/ha` | `120,000 DA/ha` | Milling bread wheat (Exec. Decree 22-56); yellow rust & humid spring lodging risk. |
| **Barley** (*Hordeum vulgare*) | `cereal` (*Poaceae*) | `300–450` | `-20` | `3,400 DA/q` (OAIC) | `18 q/ha` | `61,200 DA/ha` | Hardiest dryland cereal; lodging risk if excess N is applied. |
| **Forage Oats** (*Avena sativa*) | `cereal` (*Poaceae*) | `340–480` | `-18` | `3,400 DA/q` (OAIC) | `19 q/ha` | `64,600 DA/ha` | Key crop-livestock hay crop in Sétif/Tiaret. |
| **Triticale** (*× Triticosecale*) | `cereal` (*Poaceae*) | `350–500` | `-22` | `~3,600 DA/q` (feed est.) | `22 q/ha` | `79,200 DA/ha` | Hardy ITGC dryland feed cereal (`2.4–4.9 t/ha`); cold winter & marginal soil tolerant. |
| **Chickpea** (*Cicer arietinum*) | `legume` (*Fabaceae*) | `350–500` | `+22` | `20,000 DA/q` (CCLS/OAIC) | `10 q/ha` | `200,000 DA/ha` | Deep taproot extracts stored moisture; *Ascochyta* blight risk in wet springs. |
| **Lentil** (*Lens culinaris*) | `legume` (*Fabaceae*) | `350–450` | `+20` | `19,000 DA/q` (CCLS/OAIC) | `9 q/ha` | `171,000 DA/ha` | Escapes terminal heat; modest residual N because high harvest index exports N in grain. |
| **Faba Bean** (*Vicia faba*) | `legume` (*Fabaceae*) | `400–700` | `+32` | `~11,000 DA/q` (local est.) | `15 q/ha` | `165,000 DA/ha` | Highest BNF nitrogen carryover; needs `>=400 mm`; sensitive to *Orobanche* & sirocco. |
| **Common Vetch** (*Vicia sativa*) | `legume` (*Fabaceae*) | `300–450` | `+26` | `~4,500 DA/q DM` (forage est.) | `30 q/ha DM` | `135,000 DA/ha` | ITGC dryland forage legume (usually vetch–oats/triticale hay mix); fixes `+26 kg N/ha`. |
| **Rapeseed / Canola** (*Brassica napus*) | `oilseed` (*Brassicaceae*) | `400–600` | `-22` | `9,000 DA/q` (CCLS) | `18 q/ha` | `162,000 DA/ha` | ITGC strategic break crop; taproot shatters plow pan; pod shattering in dry wind. |
| **Safflower** (*Carthamus tinctorius*) | `oilseed` (*Asteraceae*) | `300–450` | `-18` | `~10,000 DA/q` (oilseed est.) | `12 q/ha` | `120,000 DA/ha` | Deep-rooted drought break crop (`<400 mm`); spiny leaves & niche oilseed contract needed. |
| **Sunflower** (*Helianthus annuus*) | `oilseed` (*Asteraceae*) | `600–1000` | `-26` | `~11,000 DA/q` (incentive est.) | `14 q/ha` | `154,000 DA/ha` | High $ET_c$; best suited to wet Constantine zones or supplemental irrigation. |
| **Worked Fallow** (*Jachère travaillée*) | `fallow` | `0–100` | `+8` | `0 DA/q` | `0 q/ha` | `0 DA/ha` | Semi-arid soil & moisture reset (`+8 kg N/ha` mineralization); `0 DA` year income & bare-soil erosion risk. |

> **Regional Yield Scaling:** Gross revenue (`DA/ha`) scales with each region's rainfall/yield baseline (`Sétif ~0.85x`, `Tiaret ~0.95x`, `Constantine ~1.15x`), while quality bonuses/deductions (*bonifications/réfractions*) apply at CCLS delivery.

Full CSV: [crops_algeria.csv](file:///Users/morsistoredz/NasaSpaceApps/data/regional/crops_algeria.csv)

---

## 3. Regional Agronomic Rules (`data/regional/rules_algeria.json`)

Every rule in [rules_algeria.json](file:///Users/morsistoredz/NasaSpaceApps/data/regional/rules_algeria.json) is derived from **ICARDA** and **ITGC** Mediterranean dryland experiments:

1. **No Repeated Crop (`max_occurrences_per_crop = 1`):** Prevents *Fusarium* crown rot, *Ascochyta* blight spores, and parasitic *Orobanche* (broomrape) accumulation across a 3-year cycle.
2. **No Consecutive Same Botanical Family (`forbid_consecutive_same_family = true`):** Breaks grass weed cycles (wild oats / *Avena sterilis*) and cereal-specific root diseases by separating cereals with broadleaf legumes or oilseeds.
3. **Mandatory Legume Nitrogen Reset (`min_legumes = 1`):** Guarantees biological nitrogen fixation (`+20` to `+32 kg N/ha`) and activates ICARDA's **`-30%` synthetic fertilizer carryover rule** (`post_legume_npk_multiplier = 0.70`) for the following cereal.
4. **High-Water Cap (`max_high_water_crops = 1`, `high_water_need_threshold = 0.65`):** Prevents planting water-demanding break crops (`sunflower` `600–1000 mm`) repeatedly in dry regions (`Sétif`, `Tiaret`).
5. **Deterministic Tie-Breaker (`Alaa's Plan`):** Equal-scoring rotations always prioritize **Legume in Year 1 first**, then **alphabetical order**, guaranteeing 100% reproducible rankings on every run.
6. **Note on 3-Year Cyclic Family Mixing:** Under strict cyclic rules (`Year 3 -> Year 1`), alternating families requires **1 Cereal + 1 Legume + 1 Oilseed Break Crop** (implemented in [mockup.html](file:///Users/morsistoredz/NasaSpaceApps/mockup.html), with an automatic 2-family `Cereal <-> Legume` fallback if the farmer disables all oilseeds).

---

## 4. Sources Referenced
* **FAO Irrigation and Drainage Paper No. 56** (*Crop Evapotranspiration: Guidelines for computing crop water requirements*, $ET_c = ETo \times K_c$): https://www.fao.org/
* **ICARDA WANA Long-Term Cereal–Legume Trials** (Biological Nitrogen Fixation & `30–40%` synthetic N reduction in subsequent cereals): https://www.cgiar.org/
* **ITGC Algeria** (*Institut Technique des Grandes Cultures*, stations at Sétif, El Khroub/Constantine, Tiaret): https://www.itgc.dz/

