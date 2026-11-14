"""Independent verification of the v2 pipeline outputs.

Recomputes headline values from data/raw/ with code that shares nothing with
analysis/build_indicators.py (no imports from it, no pandas — plain dict/NumPy
implementations), then compares against data/processed/<region>/indicators.json.

Tolerances: the stored values are ROUNDED, so the tolerance for a value stored
with 1 decimal is 0.051 (half a unit of the last digit + slack); p-values use
1e-3. A difference beyond tolerance is a FAIL and must be explained.

Also prints a paper-style hand-check per region (frost days Mar-Apr): the
per-year counts and, for 2024, the exact dates and raw values used.
"""
import json
import math
import sys
from itertools import groupby
from pathlib import Path

import numpy as np
from scipy import stats as scistats

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
REGIONS = ["setif", "constantine", "tiaret"]

HOT, GF_MONTHS = 35.0, [4, 5, 6]
FROST, LF_MONTHS = 0.0, [3, 4]
DRY_MM = 1.0
GS_MONTHS = {10, 11, 12, 1, 2, 3, 4, 5}
RECENT = (2015, 2024)
FULL = (1995, 2024)
SOC_W = {"0-5cm": 5.0, "5-15cm": 10.0, "15-30cm": 15.0}


# ------------------------------------------------------------- raw parsing (dict-based, no pandas)
def load_power(code):
    doc = json.loads((RAW / code / "power_daily.json").read_text(encoding="utf-8"))
    p = doc["properties"]["parameter"]
    rows = []
    for k in sorted(p["PRECTOTCORR"]):
        d = k[:4] + "-" + k[4:6] + "-" + k[6:8]
        pr = p["PRECTOTCORR"][k]
        tmax = p["T2M_MAX"].get(k)
        tmin = p["T2M_MIN"].get(k)
        clean = lambda v: None if (v is None or v <= -999.0) else float(v)
        rows.append((d, clean(pr), clean(tmax), clean(tmin)))
    return rows


def load_soil(code):
    doc = json.loads((RAW / code / "soilgrids.json").read_text(encoding="utf-8"))
    out = {}
    for layer in doc["properties"]["layers"]:
        vals = {d["label"]: d["values"]["mean"] for d in layer["depths"]}
        out[layer["name"]] = vals
    return out


# ------------------------------------------------------------- independent metrics
def annual_sums(rows):
    acc = {}
    for d, pr, _, _ in rows:
        y = int(d[:4])
        if pr is not None:
            acc[y] = acc.get(y, 0.0) + pr
    return {y: round(v, 6) for y, v in sorted(acc.items())}


def days_in_months(rows, months, field, threshold, mode):
    """Mean-per-year count of days whose `field` value crosses threshold inside `months`."""
    per_year = {}
    for d, _, tmax, tmin in rows:
        m = int(d[5:7])
        if m not in months:
            continue
        v = tmax if field == "tmax" else tmin
        if v is None:
            continue
        hit = (v > threshold) if mode == "gt" else (v < threshold)
        if hit:
            per_year[int(d[:4])] = per_year.get(int(d[:4]), 0) + 1
    return {y: per_year.get(y, 0) for y in range(FULL[0], FULL[1] + 1)}


def season_rows(rows, year):
    """Growing season Oct(year-1)..May(year) via explicit date string comparison."""
    lo = f"{year - 1}-10-01"
    hi = f"{year}-05-31"
    return [r for r in rows if lo <= r[0] <= hi]


def longest_spell(rows, year):
    """Longest run of pr < 1.0 inside the season; None (missing) breaks the run.

    Uses groupby on a boolean run-marker list — deliberately different from the
    state machine in build_indicators.longest_dry_spell.
    """
    season = season_rows(rows, year)
    if not any(r[1] is not None for r in season):
        return None
    marks = []
    for _, pr, _, _ in season:
        if pr is None:
            marks.append("break")
        elif pr < DRY_MM:
            marks.append("dry")
        else:
            marks.append("wet")
    best = 0
    for key, grp in groupby(marks):
        if key == "dry":
            best = max(best, len(list(grp)))
    return best


def ols(xs, ys):
    """OLS slope per decade + t-distribution p, computed manually (no linregress)."""
    x = np.asarray(xs, dtype=float)
    y = np.asarray(ys, dtype=float)
    xm, ym = x.mean(), y.mean()
    sxx = ((x - xm) ** 2).sum()
    slope = ((x - xm) * (y - ym)).sum() / sxx
    intercept = ym - slope * xm
    resid = y - (intercept + slope * x)
    n = len(x)
    dof = n - 2
    se = math.sqrt((resid ** 2).sum() / dof / sxx)
    t = slope / se
    p = 2.0 * scistats.t.sf(abs(t), dof)
    return slope * 10.0, p


def mk_sen(xs, ys):
    """Mann-Kendall S + p (normal approx, tie-corrected) + Sen median slope, per decade."""
    n = len(ys)
    s = 0
    slopes = []
    for i in range(n - 1):
        for j in range(i + 1, n):
            d = ys[j] - ys[i]
            s += (d > 0) - (d < 0)
            if xs[j] != xs[i]:
                slopes.append((ys[j] - ys[i]) / (xs[j] - xs[i]))
    ties = {}
    for v in ys:
        ties[v] = ties.get(v, 0) + 1
    tie_term = sum(t * (t - 1) * (2 * t + 5) for t in ties.values() if t > 1)
    var_s = (n * (n - 1) * (2 * n + 5) - tie_term) / 18.0
    if var_s <= 0:
        z = 0.0
    else:
        z = (s - math.copysign(1.0, s)) / math.sqrt(var_s) if s != 0 else 0.0
    p = 2.0 * scistats.norm.sf(abs(z))
    sen = float(np.median(slopes)) if slopes else 0.0
    return s, p, sen * 10.0


def hand_check(rows, code):
    """Print the exact data behind the frost-days value so a human can re-add it."""
    counts = days_in_months(rows, LF_MONTHS, "tmin", FROST, "lt")
    total = sum(counts.values())
    print(f"\n--- HAND-CHECK {code}: frost days, window Mar 1 - Apr 30, Tmin < 0 C ---")
    print("per-year counts (1995..2024):")
    print("  " + " ".join(str(counts[y]) for y in sorted(counts)))
    print(f"  sum = {total}, n years = {len(counts)}, mean = {total / len(counts):.4f}")
    print("dates used in 2024 (the last year):")
    for d, _, tmax, tmin in rows:
        if d.startswith("2024") and int(d[5:7]) in LF_MONTHS and tmin is not None and tmin < FROST:
            print(f"  {d}  Tmin = {tmin} C")


# ------------------------------------------------------------- compare
def compare(code, rows, stored):
    diffs = []
    annual = annual_sums(rows)

    def check(name, computed, stored_key, ndec, tol):
        sv = stored
        for k in stored_key:
            if not isinstance(sv, dict) or k not in sv:
                diffs.append((name, "MISSING IN OUTPUT", None))
                return
            sv = sv[k]
        if sv is None:
            diffs.append((name, "MISSING IN OUTPUT", None))
            return
        d = abs(computed - float(sv))
        ok = d <= tol
        diffs.append((name, round(computed, ndec), float(sv), round(d, 6), "OK" if ok else "FAIL"))
        return d

    # rainfall
    recent = [annual[y] for y in range(RECENT[0], RECENT[1] + 1)]
    full = [annual[y] for y in range(FULL[0], FULL[1] + 1)]
    check("rainfall_mm (2015-2024 mean)", sum(recent) / len(recent), ["rainfall_mm", "value"], 1, 0.051)
    check("rainfall_30yr_mean_mm", sum(full) / len(full), ["rainfall_30yr_mean_mm", "value"], 1, 0.051)
    # hot / frost
    hot = days_in_months(rows, GF_MONTHS, "tmax", HOT, "gt")
    frost = days_in_months(rows, LF_MONTHS, "tmin", FROST, "lt")
    check("hot_days (Apr-Jun >35C)", sum(hot.values()) / len(hot), ["hot_days", "value"], 1, 0.051)
    check("frost_days (Mar-Apr <0C)", sum(frost.values()) / len(frost), ["frost_days", "value"], 1, 0.051)
    # dry spell
    spells = [longest_spell(rows, y) for y in range(FULL[0], FULL[1] + 1)]
    spells = [s for s in spells if s is not None]
    check("longest_dry_spell_days (mean)", sum(spells) / len(spells), ["longest_dry_spell_days", "value"], 1, 0.051)
    # trend
    ys = [annual[y] for y in range(FULL[0], FULL[1] + 1)]
    slope, ols_p = ols(list(range(FULL[0], FULL[1] + 1)), ys)
    s, mk_p, sen = mk_sen([float(y) for y in range(FULL[0], FULL[1] + 1)], ys)
    check("rainfall_trend.ols_slope_mm_per_decade", slope, ["rainfall_trend", "ols_slope_mm_per_decade"], 1, 0.051)
    check("rainfall_trend.ols_p", ols_p, ["rainfall_trend", "ols_p"], 4, 1e-3)
    check("rainfall_trend.sen_slope_mm_per_decade", sen, ["rainfall_trend", "sen_slope_mm_per_decade"], 1, 0.051)
    check("rainfall_trend.mk_p", mk_p, ["rainfall_trend", "mk_p"], 4, 1e-3)
    # soil
    soil = load_soil(code)
    soc_layers = soil["soc"]
    ph_layers = soil["phh2o"]
    soc = sum(SOC_W[k] * soc_layers[k] for k in SOC_W) / 30.0 / 10.0
    ph = sum(SOC_W[k] * ph_layers[k] for k in SOC_W) / 30.0 / 10.0
    check("organic_carbon.g_per_kg", soc, ["organic_carbon", "g_per_kg"], 2, 0.0051)
    check("ph.value", ph, ["ph", "value"], 2, 0.0051)
    print(f"\n[{code}] Mann-Kendall S = {s} (informational; S is not stored in the JSON)")
    return diffs


def main():
    failures = 0
    for code in REGIONS:
        stored = json.loads((PROCESSED / code / "indicators.json").read_text(encoding="utf-8"))
        rows = load_power(code)
        print(f"\n================ {code} ================")
        diffs = compare(code, rows, stored)
        hand_check(rows, code)
        print(f"\n[{code}] comparison:")
        print(f"  {'value':<44} {'independent':>12} {'stored':>10} {'|diff|':>10}  status")
        for name, a, b, d, status in diffs:
            if b == "MISSING IN OUTPUT":
                print(f"  {name:<44} {'-':>12} {'-':>10} {'-':>10}  MISSING")
                failures += 1
                continue
            print(f"  {name:<44} {a:>12} {b:>10} {d:>10}  {status}")
            if status == "FAIL":
                failures += 1
    print(f"\nRESULT: {'PASS' if failures == 0 else f'FAIL ({failures} mismatches)'}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
