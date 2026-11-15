#!/usr/bin/env python3
"""Fetch real 30-year NASA POWER climate data, ISRIC SoilGrids v2.0 topsoil
properties, and ORNL DAAC MODIS MOD13Q1 NDVI spring peaks (if reachable)
for the 3 Field Shift Algerian regions (Setif, Constantine, Tiaret).

Pure Python standard library (zero third-party dependencies).
Saves raw & processed regional outputs under:
  - data/processed/{setif,constantine,tiaret}/indicators.json
  - data/processed/{setif,constantine,tiaret}/soil.json
  - data/inputs/indicators.json  (default active region: Setif / regionA)
"""
from __future__ import annotations

import json
import math
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REGIONS = {
    "regionA": {
        "code": "setif",
        "name": "Sétif High Plateaux",
        "lat": 36.15,   # Farmland perimeter just outside Sétif urban mask
        "lon": 5.38,
        "fallback_soc_g_kg": 10.5,
        "fallback_ph": 7.8,
        "fallback_yield_baseline": 0.44,
        "erosion_risk": 0.48,
    },
    "regionB": {
        "code": "constantine",
        "name": "Constantine / El Khroub Plains",
        "lat": 36.26,   # El Khroub ITGC agricultural station belt
        "lon": 6.68,
        "fallback_soc_g_kg": 14.2,
        "fallback_ph": 7.7,
        "fallback_yield_baseline": 0.66,
        "erosion_risk": 0.28,
    },
    "regionC": {
        "code": "tiaret",
        "name": "Tiaret Western High Plateaux",
        "lat": 35.34,   # Cropland belt outside Tiaret urban mask
        "lon": 1.38,
        "fallback_soc_g_kg": 11.2,
        "fallback_ph": 7.8,
        "fallback_yield_baseline": 0.51,
        "erosion_risk": 0.44,
    },
}


def http_get_json(url: str, timeout: int = 35, retries: int = 2) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "FieldShift-NASASpaceApps/1.0"})
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            last_err = exc
            if attempt + 1 < retries:
                time.sleep(2 ** attempt)
    assert last_err is not None
    raise last_err


def normal_two_sided_p(z: float) -> float:
    return math.erfc(abs(z) / math.sqrt(2.0))


def ols_trend(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """Return (slope, approximate two-sided p-value) via Student-t / normal approx."""
    n = len(xs)
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    slope = sxy / sxx if sxx else 0.0
    intercept = my - slope * mx
    rss = sum((y - (intercept + slope * x)) ** 2 for x, y in zip(xs, ys))
    se_slope = math.sqrt((rss / max(1, n - 2)) / sxx) if sxx and n > 2 else 1e9
    t_stat = slope / se_slope if se_slope > 0 else 0.0
    return slope, normal_two_sided_p(t_stat)


def mann_kendall_sens(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """Exact Mann-Kendall + Sen's median slope in pure Python."""
    n = len(ys)
    s = 0
    slopes = []
    for i in range(n - 1):
        for j in range(i + 1, n):
            diff = ys[j] - ys[i]
            if diff > 0:
                s += 1
            elif diff < 0:
                s -= 1
            dx = xs[j] - xs[i]
            if dx != 0:
                slopes.append(diff / dx)
    # Tie adjustment for variance of S
    counts: dict[float, int] = {}
    for y in ys:
        counts[y] = counts.get(y, 0) + 1
    tie_term = sum(t * (t - 1) * (2 * t + 5) for t in counts.values() if t > 1)
    var_s = (n * (n - 1) * (2 * n + 5) - tie_term) / 18.0
    if var_s <= 0:
        z = 0.0
    elif s > 0:
        z = (s - 1.0) / math.sqrt(var_s)
    elif s < 0:
        z = (s + 1.0) / math.sqrt(var_s)
    else:
        z = 0.0
    sen_slope = statistics.median(slopes) if slopes else 0.0
    return sen_slope, normal_two_sided_p(z)


def fetch_nasa_power(lat: float, lon: float, start: str = "19950101", end: str = "20241231") -> dict:
    params = urllib.parse.urlencode({
        "parameters": "PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M",
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": start,
        "end": end,
        "format": "JSON",
    })
    url = f"https://power.larc.nasa.gov/api/temporal/daily/point?{params}"
    payload = http_get_json(url, timeout=45, retries=3)
    p = payload["properties"]["parameter"]
    prec = p["PRECTOTCORR"]
    tmax = p["T2M_MAX"]
    tmin = p["T2M_MIN"]

    by_year_rain: dict[int, float] = {}
    by_year_hot: dict[int, int] = {}
    by_year_frost: dict[int, int] = {}
    by_year_ext: dict[int, int] = {}
    by_year_daily_rain: dict[int, list[float]] = {}
    by_year_month_rain: dict[tuple[int, int], float] = {}

    for date_str in sorted(prec.keys()):
        pr = prec.get(date_str, -999.0)
        tx = tmax.get(date_str, -999.0)
        tn = tmin.get(date_str, -999.0)
        if pr <= -900 or tx <= -900 or tn <= -900:
            continue
        yr = int(date_str[:4])
        mo = int(date_str[4:6])
        by_year_rain[yr] = by_year_rain.get(yr, 0.0) + pr
        by_year_month_rain[(yr, mo)] = by_year_month_rain.get((yr, mo), 0.0) + pr
        by_year_daily_rain.setdefault(yr, []).append(pr)
        if tx > 35.0:
            by_year_hot[yr] = by_year_hot.get(yr, 0) + 1
        if tn < 0.0:
            by_year_frost[yr] = by_year_frost.get(yr, 0) + 1
        if pr > 20.0:
            by_year_ext[yr] = by_year_ext.get(yr, 0) + 1

    years = sorted(by_year_rain.keys())
    annual_rains = [by_year_rain[y] for y in years]

    # Longest dry spell (< 1 mm/day) averaged over 30 years
    dry_spells = []
    for y in years:
        cur = 0
        best = 0
        for pr in by_year_daily_rain[y]:
            if pr < 1.0:
                cur += 1
                if cur > best:
                    best = cur
            else:
                cur = 0
        dry_spells.append(best)

    monthly_means = []
    for mo in range(1, 13):
        vals = [by_year_month_rain.get((y, mo), 0.0) for y in years]
        monthly_means.append(round(statistics.mean(vals), 1))

    # Trend tests
    ols_slope, ols_p = ols_trend([float(y) for y in years], annual_rains)
    sen_slope, mk_p = mann_kendall_sens([float(y) for y in years], annual_rains)
    agree = (ols_p < 0.05) and (mk_p < 0.05) and ((ols_slope > 0) == (sen_slope > 0))

    # 20-year reference (1995-2014) vs recent 10-year (2015-2024) & recent 5-year (2020-2024)
    ref_years = [y for y in years if y <= 2014]
    recent_5 = [y for y in years if y >= 2020]
    rain_ref_20yr = statistics.mean(by_year_rain[y] for y in ref_years)
    rain_recent_5yr = statistics.mean(by_year_rain[y] for y in recent_5)
    rain_30yr = statistics.mean(annual_rains)
    water_stress = max(0.0, min(1.0, (rain_ref_20yr - rain_recent_5yr) / rain_ref_20yr))

    return {
        "source": "NASA POWER API (daily 1995-2024, PRECTOTCORR/T2M_MAX/T2M_MIN)",
        "years_count": len(years),
        "rainfall_mm": round(rain_recent_5yr, 1),
        "rainfall_30yr_mean_mm": round(rain_30yr, 1),
        "rainfall_reference_mm": round(rain_ref_20yr, 1),
        "water_stress": round(water_stress, 4),
        "rainfall_trend_decade_mm": round(sen_slope * 10.0, 1),
        "ols_slope_decade_mm": round(ols_slope * 10.0, 1),
        "ols_p": round(ols_p, 4),
        "mk_p": round(mk_p, 4),
        "trend_confidence": "both methods agree" if agree else "no clear trend",
        "hot_days": round(statistics.mean(by_year_hot.get(y, 0) for y in years), 1),
        "frost_days": round(statistics.mean(by_year_frost.get(y, 0) for y in years), 1),
        "extreme_rain_days": round(statistics.mean(by_year_ext.get(y, 0) for y in years), 1),
        "longest_dry_spell_days": round(statistics.mean(dry_spells), 1),
        "monthly_rain_mm": monthly_means,
    }


def fetch_soilgrids(lat: float, lon: float, fallback_soc: float, fallback_ph: float) -> dict:
    # Probe farmland pixel, falling back slightly off-pixel if masked as urban
    offsets = [(0.0, 0.0), (0.02, 0.02), (-0.02, -0.02)]
    weights = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}
    last_err: Exception | None = None
    for dlat, dlon in offsets:
        params = [
            ("lat", round(lat + dlat, 4)),
            ("lon", round(lon + dlon, 4)),
            ("property", "soc"),
            ("property", "phh2o"),
            ("depth", "0-5cm"),
            ("depth", "5-15cm"),
            ("depth", "15-30cm"),
            ("value", "mean"),
        ]
        url = f"https://rest.isric.org/soilgrids/v2.0/properties/query?{urllib.parse.urlencode(params)}"
        try:
            data = http_get_json(url, timeout=20, retries=2)
            layers = {l["name"]: {d["label"]: d["values"]["mean"] for d in l["depths"]} for l in data["properties"]["layers"]}
            if any(layers["soc"].get(k) is None or layers["phh2o"].get(k) is None for k in weights):
                last_err = ValueError("Pixel masked (null topsoil value)")
                continue
            soc_g_kg = sum(weights[k] * layers["soc"][k] for k in weights) / 30.0 / 10.0
            ph = sum(weights[k] * layers["phh2o"][k] for k in weights) / 30.0 / 10.0
            return {
                "source": "ISRIC SoilGrids v2.0 live (0-30cm depth-weighted 5:10:15)",
                "soc_g_per_kg": round(soc_g_kg, 2),
                "ph": round(ph, 2),
                "soc_layers_dg_per_kg": layers["soc"],
            }
        except Exception as exc:
            last_err = exc
    return {
        "source": f"ITGC regional reference baseline (ISRIC SoilGrids unavailable: {last_err})",
        "soc_g_per_kg": fallback_soc,
        "ph": fallback_ph,
    }


def fetch_ornl_modis_ndvi(lat: float, lon: float, fallback_yb: float) -> dict:
    """Fetch ORNL DAAC MODIS MOD13Q1 NDVI for spring peaks (2020-2024), chunked per year (<=10 dates max per call)."""
    try:
        dates_url = f"https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude={lat}&longitude={lon}"
        dates_json = http_get_json(dates_url, timeout=15, retries=2)
        all_dates = [d["modis_date"] for d in dates_json.get("dates", [])]
        by_year_max: dict[str, float] = {}
        for yr in range(2020, 2025):
            yr_spring = [
                d for d in all_dates
                if d.startswith(f"A{yr}") and 65 <= int(d[5:8]) <= 145
            ]
            if not yr_spring:
                continue
            sub_url = (
                f"https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?"
                f"latitude={lat}&longitude={lon}&band=250m_16_days_NDVI"
                f"&startDate={yr_spring[0]}&endDate={yr_spring[-1]}&kmAboveBelow=2&kmLeftRight=2"
            )
            sub = http_get_json(sub_url, timeout=25, retries=2)
            for row in sub.get("subset", []):
                vals = [v * 0.0001 for v in row.get("data", []) if -2000 <= v <= 10000 and v != -3000]
                if vals:
                    cur = statistics.mean(vals)
                    if cur > by_year_max.get(str(yr), -1.0):
                        by_year_max[str(yr)] = cur
        if not by_year_max:
            raise ValueError("Empty NDVI pixel arrays")
        mean_peak = statistics.mean(by_year_max.values())
        yb = max(0.0, min(1.0, (mean_peak - 0.25) / 0.50))
        return {
            "source": "ORNL DAAC MODIS MOD13Q1 live (250m spring peak 2020-2024, 5x5km patch)",
            "mean_spring_peak_ndvi": round(mean_peak, 3),
            "spring_peaks_by_year": {k: round(v, 3) for k, v in by_year_max.items()},
            "yield_baseline": round(yb, 3),
        }
    except Exception as exc:
        return {
            "source": f"Regional baseline (ORNL MODIS REST unavailable: {exc})",
            "mean_spring_peak_ndvi": None,
            "yield_baseline": fallback_yb,
        }


def run_all() -> dict:
    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    results = {}
    for reg_key, cfg in REGIONS.items():
        code = cfg["code"]
        print(f"[{reg_key} / {code}] Fetching NASA POWER 1995-2024...", flush=True)
        climate = fetch_nasa_power(cfg["lat"], cfg["lon"])
        print(f"   -> rainfall_recent={climate['rainfall_mm']} mm, ref={climate['rainfall_reference_mm']} mm, stress={climate['water_stress']}", flush=True)

        print(f"[{reg_key} / {code}] Fetching ISRIC SoilGrids...", flush=True)
        soil = fetch_soilgrids(cfg["lat"], cfg["lon"], cfg["fallback_soc_g_kg"], cfg["fallback_ph"])
        print(f"   -> soc={soil['soc_g_per_kg']} g/kg, ph={soil['ph']} ({soil['source']})", flush=True)

        print(f"[{reg_key} / {code}] Fetching ORNL MODIS MOD13Q1 NDVI...", flush=True)
        ndvi = fetch_ornl_modis_ndvi(cfg["lat"], cfg["lon"], cfg["fallback_yield_baseline"])
        print(f"   -> yield_baseline={ndvi['yield_baseline']} ({ndvi['source']})", flush=True)

        soc_val = soil["soc_g_per_kg"]
        soc_thr = 15.0
        soc_def = max(0.0, min(1.0, (soc_thr - soc_val) / soc_thr))
        soc_class = (
            "Low (<10 g/kg)" if soc_val < 10
            else "Low-Moderate (10-12 g/kg)" if soc_val < 12
            else "Moderate (12-15 g/kg)" if soc_val < 15
            else "Adequate / High (>15 g/kg)"
        )

        # Suggested priorities derived directly from normalized stress + baseline
        raw_w = 25 + 28 * climate["water_stress"]
        raw_s = 22 + 24 * soc_def
        raw_y = 20 + 30 * ndvi["yield_baseline"]
        raw_sum = raw_w + raw_s + raw_y
        sw = round(100 * raw_w / raw_sum)
        ss = round(100 * raw_s / raw_sum)
        sy = 100 - sw - ss

        frost_risk = round(min(1.0, climate["frost_days"] / 40.0), 2)

        out_dir = ROOT / "data" / "processed" / code
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "soil.json").write_text(json.dumps({
            "region": code,
            "lat": cfg["lat"],
            "lon": cfg["lon"],
            "fetched_at": fetched_at,
            **soil,
        }, indent=2) + "\n")

        ind_doc = {
            "region": reg_key,
            "code": code,
            "label": f"{cfg['name']} ({cfg['lat']}°N, {cfg['lon']}°E)",
            "fetched_at": fetched_at,
            "sources": {
                "climate": climate["source"],
                "soil": soil["source"],
                "ndvi": ndvi["source"],
            },
            "rainfall_mm": climate["rainfall_mm"],
            "rainfall_30yr_mean_mm": climate["rainfall_30yr_mean_mm"],
            "rainfall_reference_mm": climate["rainfall_reference_mm"],
            "soil_organic_carbon_g_per_kg": soc_val,
            "soc_threshold_g_per_kg": soc_thr,
            "ph": soil["ph"],
            "water_stress": climate["water_stress"],
            "frost_risk": frost_risk,
            "organic_carbon": {
                "g_per_kg": soc_val,
                "class": soc_class,
                "deficit_score": round(soc_def, 3),
            },
            "erosion_risk": cfg["erosion_risk"],
            "yield_baseline": ndvi["yield_baseline"],
            "mean_spring_peak_ndvi": ndvi["mean_spring_peak_ndvi"],
            "suggested_priorities": {"save_water": sw, "protect_soil": ss, "yield": sy},
            "confidence": {
                "indicators": climate["trend_confidence"],
                "ols_p": climate["ols_p"],
                "mk_p": climate["mk_p"],
            },
            "climate_baseline": {
                "rainfall_mm": climate["rainfall_mm"],
                "rainfall_30yr_mean_mm": climate["rainfall_30yr_mean_mm"],
                "rainfall_trend_decade_mm": climate["rainfall_trend_decade_mm"],
                "hot_days": climate["hot_days"],
                "frost_days": climate["frost_days"],
                "extreme_rain_days": climate["extreme_rain_days"],
                "longest_dry_spell_days": climate["longest_dry_spell_days"],
                "monthly_rain_mm": climate["monthly_rain_mm"],
            },
        }
        (out_dir / "indicators.json").write_text(json.dumps(ind_doc, indent=2) + "\n")
        results[reg_key] = ind_doc

    # Write Setif (regionA) as primary data/inputs/indicators.json
    (ROOT / "data" / "inputs" / "indicators.json").write_text(
        json.dumps(results["regionA"], indent=2) + "\n"
    )
    (ROOT / "data" / "regional" / "all_indicators.json").write_text(
        json.dumps(results, indent=2) + "\n"
    )
    return results


if __name__ == "__main__":
    run_all()

