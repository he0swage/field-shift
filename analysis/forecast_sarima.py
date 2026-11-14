"""Experimental SARIMA rainfall forecast (OPTIONAL layer, clearly labeled).

Trains a SARIMA model on the historical monthly rainfall series (from
data/processed/<region>/climate_monthly.json, itself derived from NASA POWER
daily data) and projects `--horizon` months (default 24) with 95% confidence
intervals.

This is a statistical projection of a noisy, trending series - it is NOT a
prediction and must be labeled as such wherever it is shown. The core pipeline
indicators are completely untouched by this script.

Writes data/processed/<region>/forecast.json. Requires statsmodels.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

try:
    from statsmodels.tsa.statespace.sarimax import SARIMAX
except ImportError:
    print("statsmodels is required for the experimental forecast layer: pip install statsmodels")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
REGIONS = ["setif", "constantine", "tiaret"]
ORDER = (1, 0, 1)
SEASONAL_ORDER = (1, 0, 1, 12)
MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def load_series(code):
    doc = json.loads((PROCESSED / code / "climate_monthly.json").read_text(encoding="utf-8"))
    rows = sorted(doc["rows"], key=lambda r: (r["year"], r["month"]))
    values, base = [], []
    for r in rows:
        if r["rain_mm"] is None:
            continue
        values.append(float(r["rain_mm"]))
        base.append({"year": r["year"], "month": r["month"], "rain_mm": r["rain_mm"]})
    return values, base


def fit_and_forecast(values, horizon):
    model = SARIMAX(np.asarray(values, dtype=float), order=ORDER, seasonal_order=SEASONAL_ORDER,
                    enforce_stationarity=False, enforce_invertibility=False)
    res = model.fit(disp=False)
    pred = res.get_forecast(steps=horizon)
    mean = pred.predicted_mean
    conf = pred.conf_int(alpha=0.05)
    return mean, conf, res


def month_after(year, month):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horizon", type=int, default=24, help="months ahead (12-36; default 24)")
    args = ap.parse_args()
    if not 12 <= args.horizon <= 36:
        raise SystemExit("--horizon must be between 12 and 36 months")

    for code in REGIONS:
        values, base = load_series(code)
        mean, conf, res = fit_and_forecast(values, args.horizon)
        last_y, last_m = base[-1]["year"], base[-1]["month"]
        projection = []
        y, m = last_y, last_m
        for i in range(args.horizon):
            y, m = month_after(y, m)
            projection.append({
                "year": y,
                "month": m,
                "rain_mm_forecast": round(float(mean[i]), 1),
                "lower_95": round(float(conf[i, 0]), 1),
                "upper_95": round(float(conf[i, 1]), 1),
            })
        doc = {
            "region": code,
            "model_type": "experimental_sarima",
            "confidence_status": "model projection, high uncertainty",
            "model_order": {"order": list(ORDER), "seasonal_order": list(SEASONAL_ORDER)},
            "training_window": {"from": f"{base[0]['year']}-{base[0]['month']:02d}",
                                "to": f"{base[-1]['year']}-{base[-1]['month']:02d}",
                                "n_months": len(values)},
            "horizon_months": args.horizon,
            "note": "Statistical projection of monthly rainfall from NASA POWER history. "
                    "Wide intervals on individual months are normal - use the pattern, not exact numbers. "
                    "Core pipeline indicators are unaffected by this file.",
            "aic": round(float(res.aic), 1),
            "historical": base,
            "projection": projection,
        }
        out = PROCESSED / code / "forecast.json"
        out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"[{code}] trained SARIMA{ORDER}x{SEASONAL_ORDER} on {len(values)} months "
              f"(AIC {doc['aic']}), horizon {args.horizon} -> {out.name}")
        first3 = ", ".join(f"{MONTH_NAMES[p['month'] - 1]} {p['year']}: {p['rain_mm_forecast']} "
                           f"({p['lower_95']}-{p['upper_95']})" for p in projection[:3])
        print(f"        first months: {first3}")


if __name__ == "__main__":
    main()
