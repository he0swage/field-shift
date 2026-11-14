#!/usr/bin/env python3
"""Cross-check NASA POWER against Open-Meteo (ERA5) for the 3 Field Shift regions.

Reads the raw responses saved by save_raw.py (data/raw/<region>/) and computes,
for each source independently:
  - 30-year mean annual rainfall (mm/yr)
  - mean annual hot days (Tmax > 35 C)
  - mean annual frost days (Tmin < 0 C)
  - mean annual longest dry spell (< 1 mm/day), whole calendar year (same
    window as pipeline v1, so the comparison is apples-to-apples)

Writes data/processed/<region>/crosscheck_openmeteo.json (small, committable).
"""
from __future__ import annotations

import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

REGIONS = {
    "setif": {"lat": 36.15, "lon": 5.38},
    "constantine": {"lat": 36.26, "lon": 6.68},
    "tiaret": {"lat": 35.34, "lon": 1.38},
}


def power_stats(doc: dict) -> dict:
    p = doc["properties"]["parameter"]
    prec, tmax, tmin = p["PRECTOTCORR"], p["T2M_MAX"], p["T2M_MIN"]
    rain_by_year: dict[int, float] = {}
    hot: dict[int, int] = {}
    frost: dict[int, int] = {}
    dry: dict[int, int] = {}
    daily: dict[int, list[float]] = {}
    for d in sorted(prec.keys()):
        pr, tx, tn = prec.get(d, -999.0), tmax.get(d, -999.0), tmin.get(d, -999.0)
        if pr <= -900 or tx <= -900 or tn <= -900:
            continue
        yr = int(d[:4])
        rain_by_year[yr] = rain_by_year.get(yr, 0.0) + pr
        daily.setdefault(yr, []).append(pr)
        if tx > 35.0:
            hot[yr] = hot.get(yr, 0) + 1
        if tn < 0.0:
            frost[yr] = frost.get(yr, 0) + 1
    years = sorted(rain_by_year)
    for y in years:
        cur = best = 0
        for pr in daily[y]:
            cur = cur + 1 if pr < 1.0 else 0
            best = max(best, cur)
        dry[y] = best
    return {
        "source": "NASA POWER daily (PRECTOTCORR/T2M_MAX/T2M_MIN)",
        "years_count": len(years),
        "rain_30yr_mean_mm": round(statistics.mean(rain_by_year[y] for y in years), 1),
        "hot_days_mean": round(statistics.mean(hot.get(y, 0) for y in years), 1),
        "frost_days_mean": round(statistics.mean(frost.get(y, 0) for y in years), 1),
        "longest_dry_spell_days_mean": round(statistics.mean(dry[y] for y in years), 1),
    }


def openmeteo_stats(doc: dict) -> dict:
    d = doc["daily"]
    dates, pr_list = d["time"], d["precipitation_sum"]
    tx_list, tn_list = d["temperature_2m_max"], d["temperature_2m_min"]
    rain_by_year: dict[int, float] = {}
    hot: dict[int, int] = {}
    frost: dict[int, int] = {}
    dry: dict[int, int] = {}
    daily: dict[int, list[float]] = {}
    n_missing = 0
    for i, ds in enumerate(dates):
        yr = int(ds[:4])
        pr, tx, tn = pr_list[i], tx_list[i], tn_list[i]
        if pr is None or tx is None or tn is None:
            n_missing += 1
            continue
        rain_by_year[yr] = rain_by_year.get(yr, 0.0) + pr
        daily.setdefault(yr, []).append(pr)
        if tx > 35.0:
            hot[yr] = hot.get(yr, 0) + 1
        if tn < 0.0:
            frost[yr] = frost.get(yr, 0) + 1
    years = sorted(rain_by_year)
    for y in years:
        cur = best = 0
        for pr in daily[y]:
            cur = cur + 1 if pr < 1.0 else 0
            best = max(best, cur)
        dry[y] = best
    return {
        "source": "Open-Meteo archive ERA5 daily (precipitation_sum/t2m_max/t2m_min)",
        "years_count": len(years),
        "days_missing_all_vars": n_missing,
        "rain_30yr_mean_mm": round(statistics.mean(rain_by_year[y] for y in years), 1),
        "hot_days_mean": round(statistics.mean(hot.get(y, 0) for y in years), 1),
        "frost_days_mean": round(statistics.mean(frost.get(y, 0) for y in years), 1),
        "longest_dry_spell_days_mean": round(statistics.mean(dry[y] for y in years), 1),
    }


def main() -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for code in REGIONS:
        power = power_stats(json.loads((RAW / code / "power_daily.json").read_text()))
        om = openmeteo_stats(json.loads((RAW / code / "openmeteo_daily.json").read_text()))
        out = {
            "region": code,
            "generated_at": stamp,
            "note": "Cross-check only; pipeline v1 (fetch_real_data.py) does not consume this file.",
            "power": power,
            "openmeteo": om,
            "delta_rain_mm": round(om["rain_30yr_mean_mm"] - power["rain_30yr_mean_mm"], 1),
            "delta_hot_days": round(om["hot_days_mean"] - power["hot_days_mean"], 1),
            "delta_frost_days": round(om["frost_days_mean"] - power["frost_days_mean"], 1),
        }
        dest = OUT / code / "crosscheck_openmeteo.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(out, indent=2) + "\n")
        print(f"[{code}] POWER {power['rain_30yr_mean_mm']} mm vs ERA5 {om['rain_30yr_mean_mm']} mm "
              f"(delta {out['delta_rain_mm']:+d}); hot {power['hot_days_mean']}/{om['hot_days_mean']}; "
              f"frost {power['frost_days_mean']}/{om['frost_days_mean']}")


if __name__ == "__main__":
    main()
