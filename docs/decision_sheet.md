# Decision sheet — placeholders that need a team owner

One page, plain language. "Current" = the placeholder value the pipeline uses today (from `domain/thresholds.json`). "Impact" comes from `docs/sensitivity.md` (auto-computed, see that file for all numbers).

| # | Decision | Current placeholder | What changes if different (impact) | Who decides | Where to edit |
|---|---|---|---|---|---|
| 1 | Growing season window | Oct(prev yr)–May | Nov–Jun moves season rain by 40–60 mm, dry spells by 1–2 days. Low stakes. | Younes | `domain/thresholds.json` → `growing_season.months` |
| 2 | Grain-filling (hot) window & threshold | Apr–Jun, Tmax > 35 °C | Threshold 33→37 °C multiplies the hot-day count by ~2.5 (Sétif 7.9→0.9). Window Feb–Apr vs Mar–Apr triples the frost count. UI number changes directly. | Younes | `hot` (value), `gf_months`; `frost` (value), `lf_months` |
| 3 | Late-frost window | Mar–Apr, Tmin < 0 °C | see row 2 | Younes | `frost`, `lf_months` |
| 4 | Extreme-rain day | > 20 mm/day | Not in the sensitivity grid yet; v1 had no equivalent. Any cutoff 15–25 mm changes the count roughly proportionally. | Younes | `extreme` |
| 5 | Dry day / dry spell | < 1 mm/day, spells break at missing days | Count-like: mild. The never-merge rule is a correctness fix — don't revert it. | Younes | `dry` |
| 6 | SOC class bands | low < 10, medium 10–20, high > 20 g/kg | v1 used 10/12/15, frontend 12/16. Changes which region lands in which class → changes `protect_soil` priority (1 / 0.5 / 0.1). Today all three regions are "medium". | Younes | `soc_classes.low_max`, `high_min` |
| 7 | Water-stress recent window | 2015–2024 (ref = region's own 1995–2014) | **Biggest lever.** Tiaret: 0.03 (2010–24) vs 0.14 (2015–24) vs 0.33 (2020–24). v1's 2020–2024 kept as `water_stress_5yr`. | Alaa | `water_stress.recent_window` (and re-run) |
| 8 | Water-stress rainfall source | POWER | ERA5 gives Sétif 0.27 but Tiaret 0.01 — ranking of regions flips. POWER is wetter by 13–43%. | Alaa | new key needed in thresholds.json (source choice) |
| 9 | Region coordinates | 36.15/5.38, 36.26/6.68, 35.34/1.38 | regionB is 36.26 (pipeline) vs 36.36 (regions.json) vs 36.16 (frontend). 0.1° ≈ 11 km; climate at these latitudes barely changes at 11 km, but the map pin will be visibly different. | Younes or Alaa | `domain/regions.csv` + `frontend/src/data/regions.js` (Nazim applies) |
| 10 | Region ids | codes `setif` / `constantine` / `tiaret` | PRD §7 says `regionX`. Folder names, API path and `region` key all follow. Decide before Mehdi wires the API. | Mehdi | `domain/regions.csv` (+ rename folders) |
| 11 | Erosion indicator | none — no data source | Frontend shows 38/35/44 "%" from v1 hardcoded guesses (0.48/0.28/0.44). Either find a real source (RUSLE needs more inputs) or remove the field from the UI. | Nazim (+ Younes if sourced) | frontend (remove) or add `erosion` to thresholds + pipeline |
| 12 | `yield_` key name | `yield_` with trailing underscore | API contract (PRD §7). Renaming breaks every consumer. If you want `yield` without underscore, decide NOW, before Alaa's engine and Nazim's UI. | Alaa + Mehdi | `analysis/build_indicators.py` (`suggested_priorities`) + `docs/data_contract.md` |

Rule after any change: edit `domain/thresholds.json` (or `regions.csv`), then run
`python analysis\run_all.py` — it rebuilds everything, re-verifies independently, runs the tests, prints PASS/FAIL. Nothing else to update by hand.
