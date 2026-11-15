#!/usr/bin/env python3
"""Field Shift v2 indicator pipeline — OFFLINE.

Reads raw API responses already saved in data/raw/<region>/ (never live APIs)
plus domain/thresholds.json, and writes the PRD v3 section 7 contract files to
data/processed/<region>/:

  climate_yearly.json   per-year: annual rain, growing-season rain, hot days
                        (grain-filling window Apr-Jun), frost days (late-frost
                        window Mar-Apr), extreme rain days, longest dry spell
                        inside the growing season
  climate_monthly.json  12 monthly mean rainfall values + per-year monthly rows
                        keyed (region, year, month)
  indicators.json       every indicator with unit, window, POWER-vs-ERA5
                        crosscheck value, per-indicator confidence, trend with
                        BOTH methods (OLS t-dist + Mann-Kendall/Sen), suggested
                        priorities per PRD 6.2 (save_water / protect_soil /
                        yield_), NDVI fields (low confidence)
  soil.json             SOC g/kg and pH (0-30 cm, depth weights 5:10:15), SOC class
  data_quality.md       missing-data share, gaps, source disagreements, caveats

v1 (fetch_real_data.py) is untouched and remains the reference implementation.

Determinism: outputs contain no wall-clock timestamps unless --stamp is given;
same raw inputs + same thresholds.json produce byte-identical outputs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
DOMAIN = ROOT / "domain" / "thresholds.json"

MISSING_SENTINEL = -999.0  # POWER missing value; ERA5 missing is JSON null

REGIONS = {
    "regionA": {"code": "setif", "name": "Sétif High Plateaux", "lat": 36.15, "lon": 5.38},
    "regionB": {"code": "constantine", "name": "Constantine / El Khroub Plains", "lat": 36.26, "lon": 6.68},
    "regionC": {"code": "tiaret", "name": "Tiaret Western High Plateaux", "lat": 35.34, "lon": 1.38},
}


# ----------------------------------------------------------------- loaders

def load_thresholds(path: Path = DOMAIN) -> dict:
    raw = path.read_bytes()
    # Hash the git-normalized (LF) content so the recorded sha256 is stable across
    # Windows checkout styles (core.autocrlf can hand us CRLF bytes on disk).
    doc = json.loads(raw.decode("utf-8"))
    doc["_sha256"] = hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()[:16]
    return doc


def parse_power(doc: dict) -> pd.DataFrame:
    """POWER daily payload -> DataFrame indexed by date with columns pr, tmax, tmin.

    Values <= -999 are missing -> NaN.
    """
    p = doc["properties"]["parameter"]
    idx = pd.to_datetime(sorted(p["PRECTOTCORR"].keys()), format="%Y%m%d")
    df = pd.DataFrame(index=idx)
    for src_col, out_col in [("PRECTOTCORR", "pr"), ("T2M_MAX", "tmax"), ("T2M_MIN", "tmin")]:
        vals = pd.Series({pd.to_datetime(k, format="%Y%m%d"): v for k, v in p[src_col].items()})
        df[out_col] = vals.reindex(idx).astype(float)
        df.loc[df[out_col] <= MISSING_SENTINEL, out_col] = np.nan
    df.index.name = "date"
    return df


def parse_era5(doc: dict) -> pd.DataFrame:
    """Open-Meteo archive payload -> same schema as parse_power."""
    d = doc["daily"]
    idx = pd.to_datetime(d["time"])
    df = pd.DataFrame(index=idx)
    for src_col, out_col in [("precipitation_sum", "pr"), ("temperature_2m_max", "tmax"), ("temperature_2m_min", "tmin")]:
        df[out_col] = pd.Series(d[src_col], index=idx).astype(float)
    df.index.name = "date"
    return df


# ----------------------------------------------------------------- windows

def month_window(df: pd.DataFrame, year: int, months: list[int]) -> pd.DataFrame:
    """Rows of `df` inside calendar months `months` for the given year (single calendar year)."""
    return df[(df.index.year == year) & (df.index.month.isin(months))]


def growing_season(df: pd.DataFrame, year: int, months: list[int]) -> pd.DataFrame:
    """Season Oct(year-1) .. May(year): months >=10 from year-1, months <=5 from year."""
    lo = df.index.year == year - 1
    hi = df.index.year == year
    return df[(lo & df.index.month.isin([m for m in months if m >= 10]))
              | (hi & df.index.month.isin([m for m in months if m <= 5]))]


def longest_dry_spell(pr: pd.Series, dry_mm: float) -> int:
    """Longest consecutive run of days with rain < dry_mm.

    A missing day (NaN) and a wet day both BREAK the spell — spells are never
    merged across missing days (fixes v1 finding h).
    """
    best = cur = 0
    for v in pr:
        if pd.isna(v):
            cur = 0
        elif v < dry_mm:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return best


# ----------------------------------------------------------------- trend

def ols_trend(years: list[int], values: list[float]) -> tuple[float, float]:
    """OLS slope (per decade) + two-sided p-value (t-distribution, scipy)."""
    res = stats.linregress(np.asarray(years, dtype=float), np.asarray(values, dtype=float))
    return res.slope * 10.0, res.pvalue


def mann_kendall_sens(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """Exact Mann-Kendall S/Z (with tie correction) + Sen's median slope (per decade)."""
    n = len(ys)
    s = 0
    slopes = []
    for i in range(n - 1):
        for j in range(i + 1, n):
            diff = ys[j] - ys[i]
            s += 1 if diff > 0 else (-1 if diff < 0 else 0)
            dx = xs[j] - xs[i]
            if dx != 0:
                slopes.append(diff / dx)
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
    p = math.erfc(abs(z) / math.sqrt(2.0))
    sen = statistics.median(slopes) if slopes else 0.0
    return sen * 10.0, p


def trend_block(years: list[int], values: list[float]) -> dict:
    ols_slope, ols_p = ols_trend(years, values)
    sen_slope, mk_p = mann_kendall_sens([float(y) for y in years], values)
    agree = ols_p < 0.05 and mk_p < 0.05 and ((ols_slope > 0) == (sen_slope > 0))
    label = "both methods agree" if agree else "no clear trend"
    if ols_p < 0.05 and mk_p < 0.05:
        conf = "high"
    elif ols_p < 0.05 or mk_p < 0.05:
        conf = "medium"
    else:
        conf = "low"
    return {
        "window": f"{years[0]}-{years[-1]}",
        "ols_slope_mm_per_decade": round(ols_slope, 1),
        "ols_p": round(ols_p, 4),
        "sen_slope_mm_per_decade": round(sen_slope, 1),
        "mk_p": round(mk_p, 4),
        "label": label,
        "confidence": conf,
        "unit": "mm/decade",
    }


# ----------------------------------------------------------------- water stress & priorities

def annual_rain(df: pd.DataFrame) -> pd.Series:
    """Annual (calendar-year) rain sums, with the per-year missing-day count kept separate."""
    return df["pr"].groupby(df.index.year).sum(min_count=1)


def water_stress(annual: dict[int, float], ref_window: tuple[int, int], recent_window: tuple[int, int]) -> float:
    ref = statistics.mean(v for y, v in annual.items() if ref_window[0] <= y <= ref_window[1])
    recent = statistics.mean(v for y, v in annual.items() if recent_window[0] <= y <= recent_window[1])
    return max(0.0, 1.0 - recent / ref)


def soc_class(soc_g_kg: float, thr: dict) -> str:
    low, medium_max = 10.0, 20.0
    if soc_g_kg < low:
        return "low"
    if soc_g_kg > medium_max:
        return "high"
    return "medium"


def suggested_priorities(wstress: float, cls: str) -> dict:
    """PRD v3 section 6.2, rescaled to sum 100 with largest-remainder rounding.

    Deterministic: ties in remainder are broken in key order water, soil, yield_.
    """
    water_need = min(1.0, wstress / 0.3)
    soil_need = {"low": 1.0, "medium": 0.5, "high": 0.1}[cls]
    yield_need = max(0.2, 1.0 - max(water_need, soil_need))
    total = water_need + soil_need + yield_need
    exact = {k: v / total * 100.0 for k, v in
             (("save_water", water_need), ("protect_soil", soil_need), ("yield_", yield_need))}
    out = {k: int(math.floor(v)) for k, v in exact.items()}
    remainder = 100 - sum(out.values())
    order = sorted(exact, key=lambda k: (-(exact[k] - math.floor(exact[k])), ["save_water", "protect_soil", "yield_"].index(k)))
    for k in order[:remainder]:
        out[k] += 1
    return out


# ----------------------------------------------------------------- confidence

def rel_diff_confidence(power: float, era5: float, missing_share: float, unit_max: float | None = None) -> tuple[str, float]:
    """POWER vs ERA5 relative difference: <=10% high, <=25% medium, else low.

    Downgrade one level when missing_share > 5%. Returns (level, rel_diff).
    Relative difference is measured against the ERA5 value.
    """
    rel = abs(power - era5) / abs(era5) if era5 else float("inf")
    if rel <= 0.10:
        level = "high"
    elif rel <= 0.25:
        level = "medium"
    else:
        level = "low"
    if missing_share > 0.05 and level != "low":
        level = {"high": "medium", "medium": "low"}[level]
    return level, round(rel, 4)


# ----------------------------------------------------------------- soil & NDVI

def soil_from_raw(raw_dir: Path, thresholds: dict | None = None) -> dict:
    doc = json.loads((raw_dir / "soilgrids.json").read_text())
    layers = {l["name"]: {d["label"]: d["values"]["mean"] for d in l["depths"]}
              for l in doc["properties"]["layers"]}
    weights = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}
    soc = sum(weights[k] * layers["soc"][k] for k in weights) / 30.0 / 10.0
    ph = sum(weights[k] * layers["phh2o"][k] for k in weights) / 30.0 / 10.0
    soc_class_rule = soc_class_rule_str(thresholds)
    return {
        "source": "ISRIC SoilGrids v2.0 (offline from data/raw)",
        "method": "0-30 cm depth-weighted 5:10:15, dg/kg divided by 10 (pH x10 divided by 10)",
        "soc_g_per_kg": round(soc, 2),
        "soc_class": soc_class(soc, thresholds),
        "ph": round(ph, 2),
        "soc_layers_dg_per_kg": layers["soc"],
        "confidence": "medium",
        "confidence_note": "SoilGrids is a 250 m model estimate; PRD section 6.4: soil is at best medium",
        "soc_class_rule": soc_class_rule,
    }


def soc_class_rule_str(thresholds: dict | None = None) -> str:
    t = (thresholds or {}).get("soc_classes", {"low_max": 10.0, "high_min": 20.0})
    return f"low < {t['low_max']}, medium {t['low_max']}-{t['high_min']}, high > {t['high_min']} g/kg (pending Younes)"


def ndvi_from_raw(raw_dir: Path) -> dict:
    """v1 algorithm, offline: per-date mean of the 5x5 km patch, max per year over
    the spring window (DOY 65-145), mean over 2020-2024, normalize 0.25-0.75 -> [0,1]."""
    dates_path, subsets = raw_dir / "modis_dates.json", []
    if not dates_path.exists():
        return {"available": False, "confidence": "low", "reason": "raw MODIS responses not found"}
    dates = [d["modis_date"] for d in json.loads(dates_path.read_text()).get("dates", [])]
    by_year_max: dict[str, float] = {}
    for yr in range(2020, 2025):
        spring = [d for d in dates if d.startswith(f"A{yr}") and 65 <= int(d[5:8]) <= 145]
        subset_path = raw_dir / f"modis_subset_{yr}.json"
        if not spring or not subset_path.exists():
            continue
        sub = json.loads(subset_path.read_text())
        best = -1.0
        for row in sub.get("subset", []):
            vals = [v * 0.0001 for v in row.get("data", []) if -2000 <= v <= 10000 and v != -3000]
            if vals:
                m = statistics.mean(vals)
                if m > best:
                    best = m
        if best > -1.0:
            by_year_max[str(yr)] = round(best, 3)
    if not by_year_max:
        return {"available": False, "confidence": "low", "reason": "no usable spring subsets"}
    mean_peak = statistics.mean(by_year_max.values())
    yb = max(0.0, min(1.0, (mean_peak - 0.25) / 0.50))
    return {
        "available": True,
        "source": "MODIS MOD13Q1 250 m via ORNL DAAC REST (offline from data/raw)",
        "window": "2020-2024",
        "patch": "5x5 km",
        "mean_spring_peak_ndvi": round(mean_peak, 3),
        "spring_peaks_by_year": by_year_max,
        "yield_baseline": round(yb, 3),
        "normalization": "clamp((mean_spring_peak_ndvi - 0.25) / 0.50, 0, 1)",
        "caveat": "no cropland mask (ESA WorldCover class 40 not applied), no pixel QA filter, 5 years only",
        "confidence": "low",
    }


# ----------------------------------------------------------------- per-region build

def build_region(code: str, raw_dir: Path, out_dir: Path, thr: dict, stamp: str | None = None) -> dict:
    power = parse_power(json.loads((raw_dir / "power_daily.json").read_text()))
    era5 = parse_era5(json.loads((raw_dir / "openmeteo_daily.json").read_text()))
    t = {
        "hot": thr["hot_day_max_temp_c"]["value"],
        "frost": thr["frost_day_min_temp_c"]["value"],
        "extreme": thr["extreme_rain_day_mm"]["value"],
        "dry": thr["dry_day_mm"]["value"],
        "gs_months": thr["growing_season"]["months"],
        "gf_months": thr["grain_filling_window"]["months"],
        "lf_months": thr["late_frost_window"]["months"],
        "trend_p": thr["trend"]["p_cutoff"],
    }

    missing = {c: float(power[c].isna().mean()) for c in ("pr", "tmax", "tmin")}
    days_missing = power[["pr", "tmax", "tmin"]].isna().any(axis=1)

    # ---- climate_yearly rows
    years = sorted(power.index.year.unique())
    yearly = []
    for y in years:
        cal = power[power.index.year == y]
        gs = growing_season(power, y, t["gs_months"])
        gf = month_window(power, y, t["gf_months"])
        lf = month_window(power, y, t["lf_months"])
        data_start = power.index.min()
        gs_partial = pd.Timestamp(f"{y - 1}-10-01") < data_start
        yearly.append({
            "region": code,
            "year": int(y),
            "annual_rain_mm": round(float(cal["pr"].sum(min_count=1)), 1) if cal["pr"].notna().any() else None,
            "growing_season_rain_mm": round(float(gs["pr"].sum(min_count=1)), 1) if gs["pr"].notna().any() else None,
            "growing_season_partial": gs_partial,
            "hot_days_grain_filling": int(((gf["tmax"] > t["hot"]) & gf["tmax"].notna()).sum()),
            "frost_days_late_frost": int(((lf["tmin"] < t["frost"]) & lf["tmin"].notna()).sum()),
            "extreme_rain_days": int(((cal["pr"] > t["extreme"]) & cal["pr"].notna()).sum()),
            "longest_dry_spell_growing_season_days": int(longest_dry_spell(gs["pr"], t["dry"])),
            "days_missing": int(cal[["pr", "tmax", "tmin"]].isna().any(axis=1).sum()),
        })

    # ---- climate_monthly
    pr_s = power["pr"]
    month_sums = pr_s.groupby([pr_s.index.year, pr_s.index.month]).sum(min_count=1)
    monthly_means = [round(float(month_sums.xs(m, level=1).mean()), 1) for m in range(1, 13)]
    monthly_rows = []
    for y in years:
        for m in range(1, 13):
            cell = power[(power.index.year == y) & (power.index.month == m)]["pr"]
            monthly_rows.append({
                "region": code, "year": int(y), "month": m,
                "rain_mm": round(float(cell.sum(min_count=1)), 1) if cell.notna().any() else None,
                "days_missing": int(cell.isna().sum()),
            })

    # ---- ERA5 30-year means for cross-check
    # whole calendar year (same window as v1): used for the overall climate-bias table
    annual_e = {int(y): float(v) for y, v in era5["pr"].groupby(era5.index.year).sum(min_count=1).items()}
    era5_rain = statistics.mean(annual_e.values())
    era5_hot_30yr = float(((era5["tmax"] > t["hot"]) & era5["tmax"].notna()).groupby(era5.index.year).sum().mean())
    era5_frost_30yr = float(((era5["tmin"] < t["frost"]) & era5["tmin"].notna()).groupby(era5.index.year).sum().mean())
    # same-window (grain-filling / late-frost): used for crosscheck_value and confidence
    era5_hot = float(((era5.index.month.isin(t["gf_months"])) & (era5["tmax"] > t["hot"]) & era5["tmax"].notna()).groupby(era5.index.year).sum().mean())
    era5_frost = float(((era5.index.month.isin(t["lf_months"])) & (era5["tmin"] < t["frost"]) & era5["tmin"].notna()).groupby(era5.index.year).sum().mean())

    # ---- POWER 30-year means (whole year) for the same apples-to-apples comparison
    annual = {int(y): float(v) for y, v in annual_rain(power).items()}
    power_rain_30yr = statistics.mean(annual.values())
    power_hot_30yr = float(((power["tmax"] > t["hot"]) & power["tmax"].notna()).groupby(power.index.year).sum().mean())
    power_frost_30yr = float(((power["tmin"] < t["frost"]) & power["tmin"].notna()).groupby(power.index.year).sum().mean())

    # ---- headline indicators
    ref_window = (1995, 2014)
    recent = thr["water_stress"]["recent_window_years"]
    recent5 = thr["water_stress"]["recent_5yr_sensitivity_window_years"]
    ws = water_stress(annual, ref_window, tuple(recent))
    ws5 = water_stress(annual, ref_window, tuple(recent5))
    rainfall_recent = statistics.mean(annual[y] for y in annual if recent[0] <= y <= recent[1])

    conf_rain, rel_rain = rel_diff_confidence(power_rain_30yr, era5_rain, missing["pr"])
    era5_rain_recent = statistics.mean(v for y, v in annual_e.items() if recent[0] <= y <= recent[1])
    power_hot_season = float(((power.index.month.isin(t["gf_months"])) & (power["tmax"] > t["hot"]) & power["tmax"].notna()).groupby(power.index.year).sum().mean())
    power_frost_season = float(((power.index.month.isin(t["lf_months"])) & (power["tmin"] < t["frost"]) & power["tmin"].notna()).groupby(power.index.year).sum().mean())
    conf_hot, rel_hot = rel_diff_confidence(power_hot_season, era5_hot, missing["tmax"])
    conf_frost, rel_frost = rel_diff_confidence(power_frost_season, era5_frost, missing["tmin"])

    trend = trend_block([y for y in years if y in annual], [annual[y] for y in years if y in annual])

    soil = soil_from_raw(raw_dir, thr)
    cls = soc_class(soil["soc_g_per_kg"], thr)
    ndvi = ndvi_from_raw(raw_dir)
    prio = suggested_priorities(ws, cls)

    def metric(value, unit, window, crosscheck, conf):
        return {"value": value, "unit": unit, "window": window,
                "crosscheck_value": crosscheck, "confidence": conf}

    indicators = {
        "region": code,
        "code": thr.get("_code", code),
        "label": f"{REGIONS_NAME[code]}",
        "lat": REGIONS_LAT[code],
        "lon": REGIONS_LON[code],
        "sources": {
            "climate": "NASA POWER daily 1995-2024 PRECTOTCORR/T2M_MAX/T2M_MIN (offline from data/raw)",
            "crosscheck": "Open-Meteo ERA5 archive daily 1995-2024 (offline from data/raw)",
            "soil": soil["source"],
            "ndvi": ndvi.get("source", "not available"),
        },
        "thresholds_used": {"file": "domain/thresholds.json", "sha256_16": thr["_sha256"]},
        "rainfall_mm": metric(round(rainfall_recent, 1), "mm/yr", f"{recent[0]}-{recent[1]}", round(era5_rain_recent, 1), conf_rain),
        "rainfall_30yr_mean_mm": metric(round(power_rain_30yr, 1), "mm/yr", "1995-2024", round(era5_rain, 1), conf_rain),
        "water_stress": {"value": round(ws, 4), "window": f"ref {ref_window[0]}-{ref_window[1]} vs {recent[0]}-{recent[1]}",
                         "confidence": "pending Alaa", "note": thr["water_stress"]["status"]},
        "water_stress_5yr": {"value": round(ws5, 4), "window": f"ref {ref_window[0]}-{ref_window[1]} vs {recent5[0]}-{recent5[1]}",
                             "confidence": "sensitivity check only", "note": "v1's 2020-2024 version kept for comparison"},
        "rainfall_trend": trend,
        "hot_days": metric(round(float(((power.index.month.isin(t['gf_months'])) & (power['tmax'] > t['hot']) & power['tmax'].notna()).groupby(power.index.year).sum().mean()), 1),
                           "days/yr", f"grain-filling window months {t['gf_months']}, mean 1995-2024", round(era5_hot, 1), conf_hot),
        "frost_days": metric(round(float(((power.index.month.isin(t['lf_months'])) & (power['tmin'] < t['frost']) & power['tmin'].notna()).groupby(power.index.year).sum().mean()), 1),
                             "days/yr", f"late-frost window months {t['lf_months']}, mean 1995-2024", round(era5_frost, 1), conf_frost),
        "extreme_rain_days": metric(round(float(((power['pr'] > t['extreme']) & power['pr'].notna()).groupby(power.index.year).sum().mean()), 1),
                                    "days/yr", "calendar year, mean 1995-2024", None, "low"),
        "longest_dry_spell_days": metric(round(float(statistics.mean(r["longest_dry_spell_growing_season_days"]
                                            for r in yearly if r["growing_season_rain_mm"] is not None)), 1),
                                         "days", f"growing season months {t['gs_months']}, mean 1995-2024", None, "low"),
        "organic_carbon": {"g_per_kg": soil["soc_g_per_kg"], "class": cls, "unit": "g/kg, 0-30 cm depth-weighted 5:10:15",
                           "confidence": soil["confidence"]},
        "ph": {"value": soil["ph"], "unit": "pH (H2O), 0-30 cm depth-weighted 5:10:15", "confidence": soil["confidence"]},
        "ndvi": ndvi,
        "suggested_priorities": {**prio, "rule": "PRD v3 section 6.2", "basis": {"water_stress_used": round(ws, 4), "soc_class": cls}},
    }
    if stamp:
        indicators["run_date"] = stamp

    # ---- write outputs
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "climate_yearly.json").write_text(json.dumps({
        "region": code,
        "description": "Per agricultural metric per year. growing_season = Oct(year-1)..May(year) per thresholds.json; "
                       "growing_season_rain_mm and longest_dry_spell are null when the season start predates the data "
                       "(growing_season_partial=true); hot_days uses the grain-filling window; frost_days the late-frost "
                       "window; annual_rain_mm and extreme_rain_days use the calendar year.",
        "rows": yearly,
    }, indent=2) + "\n", encoding="utf-8")

    (out_dir / "climate_monthly.json").write_text(json.dumps({
        "region": code,
        "description": "monthly_rain_mm = mean over 1995-2024 of the calendar-month sum (Jan..Dec). rows = per-year "
                       "monthly sums keyed (region, year, month) per PRD section 7 harmonization rule.",
        "monthly_rain_mm": monthly_means,
        "rows": monthly_rows,
    }, indent=2) + "\n", encoding="utf-8")

    (out_dir / "indicators.json").write_text(json.dumps(indicators, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    (out_dir / "climate_text.json").write_text(json.dumps(climate_text(indicators, t), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    (out_dir / "soil.json").write_text(json.dumps({
        "region": code, "lat": REGIONS_LAT[code], "lon": REGIONS_LON[code], **soil,
        "soc_class_rule": "low < 10, medium 10-20, high > 20 g/kg (domain/thresholds.json, pending Younes)",
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    write_data_quality(code, out_dir, power, era5, missing, yearly, annual, annual_e,
                       power_rain_30yr, era5_rain, power_hot_30yr, era5_hot_30yr, power_frost_30yr, era5_frost_30yr,
                       conf_rain, conf_hot, conf_frost, rel_rain, rel_hot, rel_frost, t, thr, stamp)
    return indicators


REGIONS_NAME = {cfg["code"]: cfg["name"] for cfg in REGIONS.values()}
REGIONS_LAT = {cfg["code"]: cfg["lat"] for cfg in REGIONS.values()}
REGIONS_LON = {cfg["code"]: cfg["lon"] for cfg in REGIONS.values()}


def write_data_quality(code, out_dir, power, era5, missing, yearly, annual, annual_e,
                       power_rain, era5_rain, power_hot, era5_hot, power_frost, era5_frost,
                       conf_rain, conf_hot, conf_frost, rel_rain, rel_hot, rel_frost, t, thr, stamp) -> None:
    missing_days_total = int(power[["pr", "tmax", "tmin"]].isna().any(axis=1).sum())
    era5_missing = int(era5[["pr", "tmax", "tmin"]].isna().any(axis=1).sum())
    gap_rows = [f"| {r['year']} | {r['days_missing']} |" for r in yearly if r["days_missing"] > 0]
    lines = [
        f"# Data quality — {code}",
        "",
        f"Generated offline by `analysis/build_indicators.py` from `data/raw/{code}/`."
        + (f" Run stamp: {stamp}." if stamp else ""),
        "",
        "## Missing data (NASA POWER, 1995-2024)",
        "",
        f"- PRECTOTCORR missing: {missing['pr'] * 100:.2f}% of days",
        f"- T2M_MAX missing: {missing['tmax'] * 100:.2f}% of days",
        f"- T2M_MIN missing: {missing['tmin'] * 100:.2f}% of days",
        f"- Days with any variable missing: {missing_days_total} of {len(power)} ({missing_days_total / len(power) * 100:.2f}%)",
        f"- Open-Meteo (ERA5) days with any variable missing: {era5_missing}",
        "",
        "## Years with missing days",
        "",
        "| year | days with any missing value |",
        "|---|---|",
        *(gap_rows if gap_rows else ["| (none) | 0 |"]),
        "",
        "## Source disagreement: POWER vs ERA5 (30-year means, whole calendar year)",
        "",
        "Whole-year values are shown for context; the confidence below is applied on the",
        "same-window comparison (rain: 30-yr; hot days: Apr-Jun; frost days: Mar-Apr).",
        "",
        "| metric | POWER | ERA5 | relative diff (vs ERA5) | confidence after rule |",
        "|---|---|---|---|---|",
        f"| annual rain (mm/yr) | {power_rain:.1f} | {era5_rain:.1f} | {rel_rain * 100:.1f}% | {conf_rain} |",
        f"| hot days > {t['hot']} °C (days/yr) | {power_hot:.1f} | {era5_hot:.1f} | {rel_hot * 100:.1f}% | {conf_hot} |",
        f"| frost days < {t['frost']} °C (days/yr) | {power_frost:.1f} | {era5_frost:.1f} | {rel_frost * 100:.1f}% | {conf_frost} |",
        "",
        "ERA5 is systematically drier and (at Tiaret) much cooler at Tmax; the rainfall-derived",
        "indicators (water_stress, trend, dry spells) inherit this uncertainty.",
        "",
        "## Confidence rule (documented in domain/thresholds.json)",
        "",
        "- rain / hot days / frost days: POWER vs ERA5 relative difference ≤ 10% → high, ≤ 25% → medium,",
        "  otherwise low; downgraded one level when > 5% of the relevant POWER days are missing.",
        f"- This region: rain {conf_rain}, hot days {conf_hot}, frost days {conf_frost}.",
        "- trend: both p < 0.05 → high; one → medium; none → low.",
        "- soil: at best medium (250 m model estimate).",
        "- NDVI: low (no cropland mask, no pixel QA filter, 5-year window).",
        "- extreme_rain_days and longest_dry_spell: crosscheck not computed (ERA5 wet-day/dry-spell",
        "  statistics are not comparable at grid scale) → low.",
        "",
        "## Caveats",
        "",
        "- v1 (`fetch_real_data.py`) is untouched; the numbers here supersede its whole-calendar-year",
        "  windows with the seasonal windows in `domain/thresholds.json` (all pending Younes).",
        "- Dry spells are never merged across missing days (v1 merged them).",
        "- OLS p-value uses a t-distribution (scipy); v1 used a normal approximation.",
        "- water_stress reference method (region's own 1995-2014 mean) is pending Alaa/Younes; the",
        "  2020-2024 variant is kept as `water_stress_5yr` for sensitivity.",
        "- K_WATER / K_SOIL are the engine's business and are intentionally not defined here.",
        "- Coordinates are the ones the pipeline actually used (see domain/regions.csv); regions.json",
        "  and the frontend use different coordinates for regionB.",
        "",
    ]
    (out_dir / "data_quality.md").write_text("\n".join(lines), encoding="utf-8")


# ----------------------------------------------------------------- entry point

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--stamp", default=None, help="optional run date string stored in outputs (default: none)")
    ap.add_argument("--regions", default="setif,constantine,tiaret", help="comma-separated region codes")
    args = ap.parse_args()

    thr = load_thresholds()
    built = []
    for code in args.regions.split(","):
        reg = next((cfg for cfg in REGIONS.values() if cfg["code"] == code), None)
        if reg is None:
            raise SystemExit(f"unknown region code: {code}")
        raw_dir = RAW / code
        out_dir = PROCESSED / code
        print(f"[{code}] building from {raw_dir} ...", flush=True)
        ind = build_region(code, raw_dir, out_dir, thr, args.stamp)
        built.append(ind)
        p = ind["suggested_priorities"]
        print(f"   rain={ind['rainfall_mm']['value']} stress={ind['water_stress']['value']} "
              f"hot={ind['hot_days']['value']} frost={ind['frost_days']['value']} "
              f"priorities={p['save_water']}/{p['protect_soil']}/{p['yield_']}", flush=True)

    # regions summary for the map (Nazim): one small file, marker colors/labels
    summary = {
        "description": "One row per region for the map view. Written by analysis/build_indicators.py.",
        "note": "region ids/coordinates come from domain/regions.csv (see docs/decision_sheet.md #9/#10).",
        "regions": [{
            "id": ind["region"],
            "name": ind["label"],
            "lat": ind["lat"],
            "lon": ind["lon"],
            "rainfall_trend_mm_per_decade": ind["rainfall_trend"]["sen_slope_mm_per_decade"],
            "trend_label": ind["rainfall_trend"]["label"],
            "trend_confidence": ind["rainfall_trend"]["confidence"],
        } for ind in built],
    }
    (PROCESSED / "regions_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {PROCESSED / 'regions_summary.json'}")


# legacy lookup tables used by build_region (kept simple, sourced from REGIONS)
REGIONS_NAME = {cfg["code"]: cfg["name"] for cfg in REGIONS.values()}
REGIONS_LAT = {cfg["code"]: cfg["lat"] for cfg in REGIONS.values()}
REGIONS_LON = {cfg["code"]: cfg["lon"] for cfg in REGIONS.values()}


# ----------------------------------------------------------------- plain-language text (deterministic templates)

_CONF_PHRASE = {
    "high": "Data sources agree well, so this number is fairly reliable.",
    "medium": "Data sources agree only roughly, so treat this as a good estimate.",
    "low": "Data sources disagree or data is limited, so treat this as a rough indication only.",
    "pending Alaa": "Definition is still being confirmed by the team.",
}


def climate_text(ind: dict, t: dict) -> dict:
    """One short English sentence per indicator, built deterministically from the numbers.

    en/fr/ar keys exist for every entry; only en is filled in this step (fr/ar = Should).
    """
    def with_conf(en: str, conf: str | None) -> dict:
        phrase = _CONF_PHRASE.get(conf, "") if conf else ""
        return {"en": (en + " " + phrase).strip(), "fr": "", "ar": "", "_confidence": conf}

    rain = ind["rainfall_mm"]
    trend = ind["rainfall_trend"]
    hot = ind["hot_days"]
    frost = ind["frost_days"]
    ext = ind["extreme_rain_days"]
    spell = ind["longest_dry_spell_days"]
    stress = ind["water_stress"]
    soc = ind["organic_carbon"]
    ph = ind["ph"]
    ndvi = ind["ndvi"]

    trend_sentence = (
        f"Rainfall has declined by about {abs(trend['sen_slope_mm_per_decade']):.0f} mm per decade over 1995-2024 "
        f"(two independent trend tests agree)." if trend["label"] == "both methods agree"
        else "Rainfall shows no clear long-term trend over 1995-2024.")

    text = {
        "rainfall": with_conf(
            f"The region received about {rain['value']} mm of rain per year on average over "
            f"{rain['window'].split(', mean')[0]}.", rain["confidence"]),
        "rainfall_trend": with_conf(trend_sentence, trend["confidence"]),
        "water_stress": with_conf(
            f"Recent years ({stress['window'].split(' vs ')[1]}) were about "
            f"{stress['value'] * 100:.0f}% drier than the 1995-2014 average of the same region.",
            "pending Alaa"),
        "hot_days": with_conf(
            f"During grain filling (April to June), the crop endures about {hot['value']} hot days "
            f"(above {t['hot']} degrees C) per year.", hot["confidence"]),
        "frost_days": with_conf(
            f"Spring frost (March to April) still reaches the crop on about {frost['value']} nights per year.",
            frost["confidence"]),
        "extreme_rain_days": with_conf(
            f"Expect about {ext['value']} days per year with intense rain over {t['extreme']} mm.",
            ext["confidence"]),
        "longest_dry_spell_days": with_conf(
            f"The longest stretch without effective rain within the growing season lasts about "
            f"{spell['value']} days on average.", spell["confidence"]),
        "soil": with_conf(
            f"Soil organic matter is {soc['class']} ({soc['g_per_kg']} g/kg in the top 30 cm), "
            f"pH around {ph['value']}. SoilGrids is a model estimate, not a lab measurement.",
            soc["confidence"]),
        "ndvi": with_conf(
            f"Satellite greenness (NDVI) from the nearby 5x5 km pixel averaged over 2020-2024 suggests a "
            f"yield baseline of {ndvi['yield_baseline']} (0-1 scale). This is a rough proxy: no crop mask, "
            f"no pixel quality filter, only 5 years.", "low"),
    }

    # source-disagreement sentence, always present, wording depends on the confidence rule
    r30 = ind["rainfall_30yr_mean_mm"]
    if rain["confidence"] == "low":
        text["rainfall_source_disagreement"] = with_conf(
            f"Careful: two independent rainfall datasets disagree here (NASA POWER says "
            f"{r30['value']} mm/yr over 1995-2024, ERA5 says {r30['crosscheck_value']} mm/yr), so the exact "
            f"amount is uncertain even though the drought pattern is consistent.", "low")
    else:
        text["rainfall_source_disagreement"] = with_conf(
            f"NASA POWER and ERA5 differ by under 25 percent on rainfall over 1995-2024 "
            f"({r30['value']} vs {r30['crosscheck_value']} mm/yr).", rain["confidence"])
    return text

if __name__ == "__main__":
    main()
