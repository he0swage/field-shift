"""Sensitivity of the headline numbers to the placeholder decisions.

Writes data/processed/sensitivity.json and prints a markdown summary.

Variants:
  a) water-stress recent window: 2010-2024 / 2015-2024 / 2020-2024 (ref 1995-2014)
  b) growing season: Oct-May vs Nov-Jun (season rain + longest dry spell)
  c) hot-day threshold: 33 / 35 / 37 C (Apr-Jun window)
  d) frost window: Feb-Apr vs Mar-Apr (Tmin < 0 C)
  e) data source: POWER vs ERA5 (annual rain, water stress, trend)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_indicators import (
    REGIONS, RAW, PROCESSED, load_thresholds, parse_power, parse_era5,
    annual_rain, water_stress, longest_dry_spell, month_window, growing_season,
    ols_trend, mann_kendall_sens, trend_block,
)

REGIONS_ALL = ["setif", "constantine", "tiaret"]
RESULTS = {}


def region_payload(code):
    raw = RAW / code
    power = parse_power(json.loads((raw / "power_daily.json").read_text(encoding="utf-8")))
    era5 = parse_era5(json.loads((raw / "openmeteo_daily.json").read_text(encoding="utf-8")))
    ap = {int(y): float(v) for y, v in annual_rain(power).items()}
    ae = {int(y): float(v) for y, v in annual_rain(era5).items()}

    out = {}

    # (a) water stress, three recent windows, ref 1995-2014
    for recent in [(2010, 2024), (2015, 2024), (2020, 2024)]:
        out[f"stress_{recent[0]}"] = round(water_stress(ap, (1995, 2014), recent), 4)
    out["stress_2015_era5"] = round(water_stress(ae, (1995, 2014), (2015, 2024)), 4)

    # (b) growing season Oct-May vs Nov-Jun
    for label, months in [("oct_may", [10, 11, 12, 1, 2, 3, 4, 5]), ("nov_jun", [11, 12, 1, 2, 3, 4, 5, 6])]:
        season_rain, spells = [], []
        for y in range(1996, 2025):  # 1996: first year with a complete Oct start
            season = growing_season(power, y, months)
            season_rain.append(float(season["pr"].sum(min_count=1)))
            spells.append(longest_dry_spell(season["pr"], 1.0))
        out[f"season_rain_{label}"] = round(sum(season_rain) / len(season_rain), 1)
        out[f"dry_spell_{label}"] = round(sum(spells) / len(spells), 1)

    # (c) hot thresholds
    for thr in (33.0, 35.0, 37.0):
        gf = power[power.index.year.isin(range(1995, 2025)) & power.index.month.isin([4, 5, 6])]
        out[f"hot_{int(thr)}"] = round(float(((gf["tmax"] > thr) & gf["tmax"].notna()).groupby(gf.index.year).sum().mean()), 1)

    # (d) frost windows Feb-Apr vs Mar-Apr
    for label, months in [("feb_apr", [2, 3, 4]), ("mar_apr", [3, 4])]:
        lf = power[power.index.year.isin(range(1995, 2025)) & power.index.month.isin(months)]
        out[f"frost_{label}"] = round(float(((lf["tmin"] < 0.0) & lf["tmin"].notna()).groupby(lf.index.year).sum().mean()), 1)

    # (e) source: ERA5 annual rain + trend
    out["rain_30yr_era5"] = round(sum(ae[y] for y in range(1995, 2025)) / 30, 1)
    out["rain_2015_era5"] = round(sum(ae[y] for y in range(2015, 2025)) / 10, 1)
    yrs = list(range(1995, 2025))
    out["trend_era5"] = trend_block(yrs, [ae[y] for y in yrs])
    out["trend_power"] = trend_block(yrs, [ap[y] for y in yrs])
    return out


def main():
    for code in REGIONS_ALL:
        RESULTS[code] = region_payload(code)
        r = RESULTS[code]
        print(f"[{code}] stress2010={r['stress_2010']} stress2015={r['stress_2015']} "
              f"stress2020={r['stress_2020']} era5={r['stress_2015_era5']}")
        print(f"        season rain oct-may={r['season_rain_oct_may']} nov-jun={r['season_rain_nov_jun']} "
              f"dry spell {r['dry_spell_oct_may']} / {r['dry_spell_nov_jun']}")
        print(f"        hot 33/35/37 = {r['hot_33']}/{r['hot_35']}/{r['hot_37']}  "
              f"frost feb-apr/mar-apr = {r['frost_feb_apr']}/{r['frost_mar_apr']}")
        tp, te = r["trend_power"], r["trend_era5"]
        print(f"        rain30yr POWER={round(sum(ap[y] for y in range(1995, 2025)) / 30, 1)} "
              f"ERA5={r['rain_30yr_era5']} | trend POWER: {tp['label']} "
              f"({tp['ols_p']}/{tp['mk_p']}) | ERA5: {te['label']} ({te['ols_p']}/{te['mk_p']})")

    doc = {
        "description": "Sensitivity of headline indicators to the placeholder decisions in domain/thresholds.json. Computed by analysis/sensitivity.py.",
        "regions": RESULTS,
    }
    out = PROCESSED / "sensitivity.json"
    out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
