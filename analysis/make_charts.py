"""Charts for the Climate screen. 1600x900 PNG, Okabe-Ito colorblind-safe palette.

Reads the committed pipeline outputs (data/processed/), not raw data, so the
charts always match the published JSON. Written to analysis/charts/ (gitignored
sizes are checked by run_all; keep each PNG under ~300 KB).
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "analysis" / "charts"
REGIONS = [("setif", "Sétif High Plateaux", "#0072B2"),
           ("constantine", "Constantine / El Khroub", "#E69F00"),
           ("tiaret", "Tiaret Western Plateaux", "#009E73")]
SOURCE = "Data: NASA POWER daily 1995-2024; cross-checked with ERA5 (Open-Meteo). Field Shift pipeline."


def style(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.3)
    ax.tick_params(labelsize=13)


def load(code):
    yearly = json.loads((ROOT / "data" / "processed" / code / "climate_yearly.json").read_text(encoding="utf-8"))
    monthly = json.loads((ROOT / "data" / "processed" / code / "climate_monthly.json").read_text(encoding="utf-8"))
    ind = json.loads((ROOT / "data" / "processed" / code / "indicators.json").read_text(encoding="utf-8"))
    return yearly["rows"], monthly["monthly_rain_mm"], ind


def rain_chart(code, name, rows, ind):
    years = [r["year"] for r in rows]
    rain = [r["annual_rain_mm"] for r in rows]
    t = ind["rainfall_trend"]
    fig, ax = plt.subplots(figsize=(16, 9), dpi=100)
    ax.bar(years, rain, color="#0072B2", alpha=0.55, label="Annual rainfall (mm)")
    # Sen slope line through the median of the series
    xs = np.array(years, dtype=float)
    slope, inter = np.polyfit(xs, np.array(rain, dtype=float), 1)  # visual fit for the line placement
    sen = t["sen_slope_mm_per_decade"] / 10.0  # mm/yr
    center = float(np.median(np.array(rain, dtype=float) - sen * (xs - xs.mean())))
    ax.plot(years, sen * (xs - xs.mean()) + center, color="#D55E00", lw=3,
            label=f"Sen slope: {t['sen_slope_mm_per_decade']} mm/decade")
    label = ("Rainfall is declining" if t["label"] == "both methods agree"
             else "No clear rainfall trend")
    ax.set_title(f"{name}: {label} "
                 f"({'both trend tests agree' if t['label'] == 'both methods agree' else 'trend not statistically confirmed'})",
                 fontsize=18)
    ax.set_xlabel("Year", fontsize=14)
    ax.set_ylabel("Rainfall (mm per year)", fontsize=14)
    ax.text(0.99, 0.01, SOURCE, transform=ax.transAxes, ha="right", va="bottom", fontsize=10, alpha=0.7)
    ax.legend(fontsize=13, loc="lower left")
    style(ax)
    fig.tight_layout()
    fig.savefig(OUT / f"{code}_annual_rain.png")
    plt.close(fig)


def monthly_chart(code, name, monthly):
    labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    fig, ax = plt.subplots(figsize=(16, 9), dpi=100)
    ax.bar(range(12), monthly, color="#56B4E9", edgecolor="#0072B2")
    ax.set_xticks(range(12), labels)
    ax.set_title(f"{name}: average monthly rainfall, 1995-2024 (rain concentrated Oct-May)", fontsize=18)
    ax.set_xlabel("Month", fontsize=14)
    ax.set_ylabel("Rainfall (mm per month, 30-yr mean)", fontsize=14)
    ax.text(0.99, 0.01, SOURCE, transform=ax.transAxes, ha="right", va="bottom", fontsize=10, alpha=0.7)
    style(ax)
    fig.tight_layout()
    fig.savefig(OUT / f"{code}_monthly_rain.png")
    plt.close(fig)


def frosthot_chart(code, name, rows):
    years = [r["year"] for r in rows]
    hot = [r["hot_days_grain_filling"] for r in rows]
    frost = [r["frost_days_late_frost"] for r in rows]
    fig, ax = plt.subplots(figsize=(16, 9), dpi=100)
    ax.plot(years, hot, color="#D55E00", lw=2.5, marker="o", ms=4, label="Hot days, Apr-Jun (>35 °C)")
    ax.plot(years, frost, color="#0072B2", lw=2.5, marker="s", ms=4, label="Frost nights, Mar-Apr (<0 °C)")
    ax.set_title(f"{name}: stress days in the sensitive crop windows, 1995-2024", fontsize=18)
    ax.set_xlabel("Year", fontsize=14)
    ax.set_ylabel("Days per year", fontsize=14)
    ax.text(0.99, 0.01, SOURCE, transform=ax.transAxes, ha="right", va="bottom", fontsize=10, alpha=0.7)
    ax.legend(fontsize=13)
    style(ax)
    fig.tight_layout()
    fig.savefig(OUT / f"{code}_hot_frost.png")
    plt.close(fig)


def comparison_chart():
    fig, ax = plt.subplots(figsize=(16, 9), dpi=100)
    for code, name, color in REGIONS:
        rows, _, ind = load(code)
        years = [r["year"] for r in rows]
        rain = np.array([r["annual_rain_mm"] for r in rows], dtype=float)
        ax.plot(years, rain, color=color, lw=2.2, label=f"{name} (Sen: {ind['rainfall_trend']['sen_slope_mm_per_decade']} mm/decade)")
    ax.set_title("Only Sétif shows a statistically confirmed rainfall decline (both trend tests, both data sources)",
                 fontsize=17)
    ax.set_xlabel("Year", fontsize=14)
    ax.set_ylabel("Annual rainfall (mm)", fontsize=14)
    ax.text(0.99, 0.01, SOURCE, transform=ax.transAxes, ha="right", va="bottom", fontsize=10, alpha=0.7)
    ax.legend(fontsize=12)
    style(ax)
    fig.tight_layout()
    fig.savefig(OUT / "comparison_annual_rain.png")
    plt.close(fig)


def main():
    OUT.mkdir(exist_ok=True)
    for code, name, _ in REGIONS:
        rows, monthly, ind = load(code)
        rain_chart(code, name, rows, ind)
        monthly_chart(code, name, monthly)
        frosthot_chart(code, name, rows)
        print(f"[{code}] 3 charts written")
    comparison_chart()
    print("[comparison] written")
    for f in sorted(OUT.glob("*.png")):
        print(f"  {f.name}: {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
