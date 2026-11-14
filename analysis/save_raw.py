#!/usr/bin/env python3
"""Save raw API responses for the 3 Field Shift regions to data/raw/<region>/ (gitignored).

This is a companion to fetch_real_data.py v1 (which keeps no raw responses).
It changes no indicator logic: it only downloads and stores the exact JSON
payloads the pipeline sources, plus an Open-Meteo (ERA5) cross-check series.

Sources per region:
  - NASA POWER daily 1995-2024 (PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M)
  - ISRIC SoilGrids v2.0 (soc, phh2o; 0-5, 5-15, 15-30 cm) at the primary pixel
  - ORNL DAAC MODIS MOD13Q1: dates list + 2020-2024 spring subsets
  - Open-Meteo archive daily 1995-2024 (precipitation_sum, tmax, tmin) for cross-checking

Note: modis.ornl.gov was measured at ~50 s per request on the team network
(2026-11-14); timeouts here are generous. ORNL requires a current CA bundle:
set SSL_CERT_FILE=<certifi>/cacert.pem if Python rejects the InCommon chain.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"

REGIONS = {
    "setif": {"lat": 36.15, "lon": 5.38},
    "constantine": {"lat": 36.26, "lon": 6.68},
    "tiaret": {"lat": 35.34, "lon": 1.38},
}


def get_json(url: str, timeout: int = 120, retries: int = 3) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "FieldShift-NASASpaceApps/1.0"})
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            last_err = exc
            print(f"    attempt {attempt + 1} failed: {type(exc).__name__}: {str(exc)[:110]}")
            if attempt + 1 < retries:
                time.sleep(5)
    assert last_err is not None
    raise last_err


def save(code: str, name: str, payload: dict) -> None:
    out = RAW / code / name
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"    saved {out.relative_to(ROOT)} ({out.stat().st_size} bytes)")


def fetch_region(code: str, lat: float, lon: float) -> None:
    print(f"[{code}] NASA POWER daily 1995-2024...", flush=True)
    params = urllib.parse.urlencode({
        "parameters": "PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M",
        "community": "AG", "longitude": lon, "latitude": lat,
        "start": "19950101", "end": "20241231", "format": "JSON",
    })
    save(code, "power_daily.json", get_json(f"https://power.larc.nasa.gov/api/temporal/daily/point?{params}"))

    print(f"[{code}] ISRIC SoilGrids...", flush=True)
    soil_params = urllib.parse.urlencode([
        ("lat", lat), ("lon", lon),
        ("property", "soc"), ("property", "phh2o"),
        ("depth", "0-5cm"), ("depth", "5-15cm"), ("depth", "15-30cm"),
        ("value", "mean"),
    ])
    save(code, "soilgrids.json", get_json(f"https://rest.isric.org/soilgrids/v2.0/properties/query?{soil_params}"))

    print(f"[{code}] ORNL MODIS MOD13Q1 dates + subsets 2020-2024...", flush=True)
    try:
        dates = get_json(f"https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude={lat}&longitude={lon}")
        save(code, "modis_dates.json", dates)
        all_dates = [d["modis_date"] for d in dates.get("dates", [])]
        for yr in range(2020, 2025):
            spring = [d for d in all_dates if d.startswith(f"A{yr}") and 65 <= int(d[5:8]) <= 145]
            if not spring:
                continue
            sub_params = urllib.parse.urlencode({
                "latitude": lat, "longitude": lon, "band": "250m_16_days_NDVI",
                "startDate": spring[0], "endDate": spring[-1],
                "kmAboveBelow": 2, "kmLeftRight": 2,
            })
            save(code, f"modis_subset_{yr}.json",
                 get_json(f"https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?{sub_params}"))
    except Exception as exc:
        print(f"    MODIS FAILED for {code}: {type(exc).__name__}: {str(exc)[:140]}")

    print(f"[{code}] Open-Meteo archive (ERA5) daily 1995-2024...", flush=True)
    om_params = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "start_date": "1995-01-01", "end_date": "2024-12-31",
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
        "timezone": "GMT",
    })
    save(code, "openmeteo_daily.json",
         get_json(f"https://archive-api.open-meteo.com/v1/archive?{om_params}"))


def main() -> None:
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"save_raw started {started}", flush=True)
    for code, cfg in REGIONS.items():
        fetch_region(code, cfg["lat"], cfg["lon"])
    print(f"save_raw done at {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}", flush=True)


if __name__ == "__main__":
    main()
