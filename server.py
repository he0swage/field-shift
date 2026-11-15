"""Local & API backend server for Field Shift — Crop Rotation Advisor.

Serves:
  - GET  /                           -> React app (dist/index.html) or fallback mockup.html
  - GET  /mockup.html                -> Legacy standalone dashboard
  - GET  /api/health                 -> Server & dataset health metadata
  - GET  /api/regions (/regions)     -> Rows of domain/regions.csv + rich region metadata + gaps
  - GET  /api/crops (/crops)         -> Global & regional crop profiles
  - GET  /api/climate (/climate)     -> Real NASA POWER 1995-2024 climate + ERA5 + SARIMA forecast
  - GET  /api/fires/<region> (/fires/<region>) -> NASA FIRMS satellite fire detections snapshot or live
  - GET  /api/custom-region          -> Cached custom coordinate region (Section 2.6)
  - POST /api/ranking (/ranking)     -> Live Python engine scoring via load_region(region)
  - POST /api/validate-crop          -> Regional compatibility validation for custom crops
  - POST /api/assistant (/assistant) -> Grounded Multilingual Agronomy RAG Assistant (EN/FR/AR)
  - GET  /indicators/<region>        -> Regional indicators JSON
  - POST /recommend                  -> Direct scoring API

Run:
  python3 server.py --port 8000
"""
from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import math
import mimetypes
import os
import subprocess
import tempfile
import urllib.request
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from engine import postgres_accounts, rag_assistant, scoring

ROOT = Path(__file__).resolve().parent
DIST_DIR = ROOT / "dist"
PROCESSED_DIR = ROOT / "data" / "processed"
DOMAIN_DIR = ROOT / "domain"

DEFAULT_WHISPER_MODEL = Path("/Users/morsistoredz/badis_darija_algerian/models/whisper-medium-darija/ggml-model.bin")
DEFAULT_WHISPER_BIN = Path("/Users/morsistoredz/badis_darija_algerian/whisper.cpp/build/bin/whisper-cli")


def _transcribe_audio_payload(body: dict) -> dict:
    audio_raw = body.get("audio") or body.get("file") or ""
    if not audio_raw:
        return {
            "text": "",
            "status": "error",
            "message": "No audio data provided in 'audio' or 'file' key",
        }

    # Handle data URL or raw base64
    if "," in audio_raw:
        audio_raw = audio_raw.split(",", 1)[1]

    try:
        audio_bytes = base64.b64decode(audio_raw)
    except Exception as e:
        return {"text": "", "status": "error", "message": f"Base64 decode failed: {e}"}

    lang = str(body.get("lang") or "ar").strip()
    prompt = str(body.get("prompt") or "هدرة بالدارجة الجزائرية، مخلطة بالعربية والفرنسية: مرحبا، c'est bon، le projet، كيفاش، واش راك، نورمال، une réunion.").strip()

    # Strategy 1: Check whisper.cpp HTTP server (if running)
    whisper_api_url = os.getenv("WHISPER_API_URL", "http://127.0.0.1:8080/inference").strip()
    try:
        boundary = "----WebKitFormBoundarySTT"
        body_parts = [
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\nContent-Type: audio/wav\r\n\r\n".encode(),
            audio_bytes,
            f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson".encode(),
            f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\n{lang}".encode(),
            f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"prompt\"\r\n\r\n{prompt}".encode(),
            f"\r\n--{boundary}--\r\n".encode(),
        ]
        req_data = b"".join(body_parts)
        req = urllib.request.Request(
            whisper_api_url,
            data=req_data,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {
                "text": data.get("text", "").strip(),
                "status": "ok",
                "source": "whisper-medium-darija (HTTP)",
            }
    except Exception:
        pass

    # Strategy 2: Direct CLI execution with whisper-cli + ffmpeg
    model_path = Path(os.getenv("WHISPER_MODEL_PATH", str(DEFAULT_WHISPER_MODEL)))
    bin_path = Path(os.getenv("WHISPER_BIN_PATH", str(DEFAULT_WHISPER_BIN)))

    if not model_path.exists() or not bin_path.exists():
        return {
            "text": "",
            "status": "error",
            "message": f"Whisper model ({model_path.name}) or whisper-cli binary not found.",
        }

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as in_f:
        in_f.write(audio_bytes)
        in_path = in_f.name

    wav_path = in_path + ".wav"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", in_path, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        cmd = [
            str(bin_path),
            "-m", str(model_path),
            "-f", wav_path,
            "-l", lang,
            "-nt",
            "-ng",
            "--prompt", prompt,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        output_lines = [
            line.strip() for line in res.stdout.splitlines()
            if line.strip() and not line.startswith("whisper_")
            and not line.startswith("system_info:")
            and not line.startswith("main:")
            and not line.startswith("read_audio_data:")
        ]
        transcription = " ".join(output_lines).strip()
        return {
            "text": transcription,
            "status": "ok",
            "source": "whisper-medium-darija (CLI)",
        }
    except Exception as exc:
        return {"text": "", "status": "error", "message": str(exc)}
    finally:
        for p in (in_path, wav_path):
            if os.path.exists(p):
                try:
                    os.unlink(p)
                except Exception:
                    pass


def _load_dotenv() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()

INDICATORS_BY_REGION = json.loads(
    (ROOT / "data" / "regional" / "all_indicators.json").read_text(encoding="utf-8")
)


def _load_regions_csv() -> dict[str, dict]:
    out: dict[str, dict] = {}
    csv_path = DOMAIN_DIR / "regions.csv"
    if not csv_path.exists():
        return out
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row["region_id"].strip()
            row["lat"] = float(row["lat"])
            row["lon"] = float(row["lon"])
            row["default_crops_list"] = [c.strip() for c in row["default_crops"].split(",") if c.strip()]
            out[rid] = row
    return out


REGIONS_CSV = _load_regions_csv()

REGION_CODE_MAP = {
    "regionA": "regionA",
    "setif": "regionA",
    "regionB": "regionB",
    "kansas": "regionB",
    "constantine": "constantine",
    "regionC": "regionC",
    "punjab": "regionC",
    "tiaret": "tiaret",
    "custom_35.4_1.3": "custom_35.4_1.3",
}
REGION_ID_MAP = {
    "regionA": "regionA",
    "setif": "regionA",
    "regionB": "regionB",
    "kansas": "regionB",
    "regionC": "regionC",
    "punjab": "regionC",
    "custom_35.4_1.3": "custom_35.4_1.3",
}

CROP_ID_ALIASES = {
    "durum": "wheat",
    "soft": "soft_wheat",
    "rapeseed": "canola",
    "oat": "oats",
    "mung bean": "mung_bean",
    "mungbean": "mung_bean",
}
CROP_DISPLAY_NAMES = {
    "wheat": "Wheat",
    "soft_wheat": "Soft wheat",
    "barley": "Barley",
    "oats": "Forage oats",
    "triticale": "Triticale",
    "chickpea": "Chickpea",
    "lentil": "Lentil",
    "faba": "Faba bean",
    "vetch": "Common vetch",
    "canola": "Canola / Mustard",
    "safflower": "Safflower",
    "sunflower": "Sunflower",
    "fallow": "Worked fallow",
    "corn": "Corn (Grain Maize)",
    "soybean": "Soybean",
    "sorghum": "Grain Sorghum",
    "rice": "Paddy Rice",
    "maize": "Maize (Kharif)",
    "mung_bean": "Mung Bean",
}

FIRE_NOTICE = "Satellite data, about 3 hours old. Not a forecast. No detection does not mean no fire."


def _read_json(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _canon_crop_id(crop_id: str) -> str:
    c = str(crop_id).strip()
    return CROP_ID_ALIASES.get(c, c)


def _crop_name(crop_id: str, custom_names: dict[str, str] | None = None) -> str:
    if custom_names and crop_id in custom_names:
        return custom_names[crop_id]
    return CROP_DISPLAY_NAMES.get(crop_id, crop_id.replace("_", " ").title())


def _validate_and_resolve_region(region_param: str | None) -> tuple[str, str] | None:
    """Validate region against domain/regions.csv (or custom_lat_lon). Return None if invalid."""
    if not region_param:
        return ("regionA", "regionA")
    raw = str(region_param).strip()
    if raw in REGION_ID_MAP:
        return (REGION_ID_MAP[raw], REGION_CODE_MAP[raw])
    if raw.startswith("custom_"):
        return (raw, raw)
    return None


# ---------------------------------------------------------------------------
# Section 3.3: Fire Watch Haversine + NASA FIRMS Area CSV helper
# ---------------------------------------------------------------------------
def km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p = math.pi / 180.0
    a = (
        math.sin((lat2 - lat1) * p / 2.0) ** 2
        + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2.0) ** 2
    )
    return 12742.0 * math.asin(math.sqrt(max(0.0, min(1.0, a))))


def fires_near(
    lat: float,
    lon: float,
    radius_km: float = 25.0,
    days: int = 2,
    source: str = "VIIRS_NOAA21_NRT",
    map_key: str | None = None,
) -> list[dict]:
    key = map_key or os.getenv("FIRMS_MAP_KEY", "").strip()
    if not key:
        raise RuntimeError("FIRMS_MAP_KEY is not configured")
    days_clamped = max(1, min(5, int(days)))
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(0.1, math.cos(lat * math.pi / 180.0)))
    box = f"{lon - dlon:.4f},{lat - dlat:.4f},{lon + dlon:.4f},{lat + dlat:.4f}"
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{box}/{days_clamped}"
    req = urllib.request.Request(url, headers={"User-Agent": "FieldShift-NASASpaceApps/2.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        text = resp.read().decode("utf-8", errors="replace")
    rows = csv.DictReader(io.StringIO(text))
    out = []
    for r in rows:
        if "latitude" not in r or "longitude" not in r:
            continue
        rlat = float(r["latitude"])
        rlon = float(r["longitude"])
        d = km(lat, lon, rlat, rlon)
        if d <= radius_km:
            out.append({
                "km": round(d, 1),
                "date": r.get("acq_date", ""),
                "time": r.get("acq_time", ""),
                "lat": round(rlat, 4),
                "lon": round(rlon, 4),
                "frp_mw": float(r["frp"]) if r.get("frp") else None,
                "confidence": r.get("confidence", "nominal"),
            })
    return sorted(out, key=lambda x: x["km"])


def _build_fires_payload(
    reg_id: str,
    reg_code: str,
    radius_km: float = 25.0,
    days: int = 2,
    live: bool = False,
) -> dict:
    snap_path = PROCESSED_DIR / reg_code / "fires_snapshot.json"
    if not snap_path.exists():
        snap_path = PROCESSED_DIR / "regionA" / "fires_snapshot.json"
    snap = _read_json(snap_path, {})

    meta = REGIONS_CSV.get(reg_id, {})
    lat = float(meta.get("lat", 36.2))
    lon = float(meta.get("lon", 5.4))

    if live and os.getenv("FIRMS_MAP_KEY", "").strip():
        detections = fires_near(lat, lon, radius_km=radius_km, days=days)
        return {
            "region": reg_id,
            "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "VIIRS_NOAA21_NRT",
            "mode": "live-firms",
            "radius_km": radius_km,
            "days": days,
            "count": len(detections),
            "nearest_km": detections[0]["km"] if detections else None,
            "detections": detections,
            "dry_conditions": snap.get("dry_conditions"),
            "notice": FIRE_NOTICE,
        }

    # Filter snapshot detections by requested radius_km if different from 25
    dets = [
        d for d in snap.get("detections", [])
        if float(d.get("km", 0)) <= radius_km
    ]
    return {
        "region": reg_id,
        "fetched_at": snap.get("fetched_at", "2026-11-14T09:30:00Z"),
        "source": snap.get("source", "VIIRS_NOAA21_NRT"),
        "mode": "saved-snapshot",
        "radius_km": radius_km,
        "days": days,
        "count": len(dets),
        "nearest_km": dets[0]["km"] if dets else None,
        "detections": dets,
        "dry_conditions": snap.get("dry_conditions"),
        "notice": FIRE_NOTICE,
    }


def _build_climate_payload(reg_id: str, reg_code: str) -> dict:
    rdir = PROCESSED_DIR / reg_code
    if not rdir.exists():
        rdir = PROCESSED_DIR / "regionA"
    yearly = _read_json(rdir / "climate_yearly.json", {})
    monthly = _read_json(rdir / "climate_monthly.json", {})
    v2_ind = _read_json(rdir / "indicators.json", {})
    climate_text = _read_json(rdir / "climate_text.json", {})
    soil = _read_json(rdir / "soil.json", {})
    forecast = _read_json(rdir / "forecast.json", {})
    fires = _read_json(rdir / "fires_snapshot.json", {})

    annual = [
        {"year": row["year"], "rain": row["annual_rain_mm"]}
        for row in yearly.get("rows", [])
        if row.get("annual_rain_mm") is not None
    ]
    monthly_means = [round(v, 1) for v in monthly.get("monthly_rain_mm", [])]

    return {
        "source": yearly.get("source") or "NASA POWER 1995-2024 (offline verified + ERA5 cross-check)",
        "sample": False,
        "region": reg_id,
        "code": reg_code,
        "annual": annual,
        "monthly": monthly_means,
        "indicators": {
            "hotDays": round(float(v2_ind.get("hot_days", {}).get("value", 0))),
            "frostDays": round(float(v2_ind.get("frost_days", {}).get("value", 0))),
            "extremeRainDays": round(float(v2_ind.get("extreme_rain_days", {}).get("value", 0))),
            "longestDrySpell": round(float(v2_ind.get("longest_dry_spell_days", {}).get("value", 0))),
        },
        "v2Indicators": v2_ind,
        "climateText": climate_text,
        "soil": soil,
        "fires": fires,
        "forecast": {
            "modelType": forecast.get("model_type"),
            "confidenceStatus": forecast.get("confidence_status"),
            "note": forecast.get("note"),
            "projection": forecast.get("projection", []),
        } if forecast else None,
    }


def _to_engine_custom_spec(custom_spec: dict) -> dict:
    family = str(custom_spec.get("family", "other")).strip().lower()
    if family == "other":
        family = "forage_broadleaf"
    rain_arr = custom_spec.get("rain") or [custom_spec.get("rain_min", 350), custom_spec.get("rain_max", 600)]
    ph_arr = custom_spec.get("ph") or [custom_spec.get("ph_min", 6.2), custom_spec.get("ph_max", 8.2)]
    r_min, r_max = float(rain_arr[0]), float(rain_arr[1])
    p_min, p_max = float(ph_arr[0]), float(ph_arr[1])
    price = float(custom_spec.get("price", custom_spec.get("oaic_ccls_price_dzd_q", 10000)))
    yld = float(custom_spec.get("yield", custom_spec.get("baseline_yield_q_ha", 12)))
    income = int(round(price * yld))
    avg_rain = (r_min + r_max) / 2.0
    is_leg = family == "legume"
    is_fal = family == "fallow"

    return {
        "family": family,
        "water_need": 0.05 if is_fal else round(min(0.95, max(0.18, avg_rain / 950.0)), 2),
        "nitrogen_fixing": 1 if is_leg else int(custom_spec.get("nitrogen_fixing", 0)),
        "residue_carbon": 0.45 if is_leg else (0.25 if is_fal else 0.62),
        "drought_tolerance": round(min(0.95, max(0.25, 1.0 - max(0.0, r_min - 250.0) / 700.0)), 2),
        "profit": round(min(0.95, max(0.20, income / 240000.0)), 2),
        "risk_level": 0.15 if is_fal else (0.32 if is_leg else 0.36),
        "risk_note": str(custom_spec.get("risk_note", "Custom farmer crop (verified for region; confirm variety with local extension).")),
        "depletion": 0 if is_fal else (1 if is_leg else 3),
        "n_impact": 22 if is_leg else (8 if is_fal else -20),
        "health_delta": 15 if is_leg else (8 if is_fal else -6),
        "npk_base": 100 if is_leg else (0 if is_fal else 175),
        "fert_name": "DAP (starter)" if is_leg else ("None (Moisture & N Reset)" if is_fal else "NPK 15:15:15"),
        "rain_opt": (r_min, r_max),
        "ph_opt": (p_min, p_max),
        "rain_min": r_min,
        "rain_max": r_max,
        "ph_min": p_min,
        "ph_max": p_max,
        "frost_tolerant": int(bool(custom_spec.get("frost", custom_spec.get("frost_tolerant", 1)))),
        "heat_tolerant": int(bool(custom_spec.get("heat", custom_spec.get("heat_tolerant", 1)))),
        "oaic_ccls_price_dzd_q": int(round(price)),
        "baseline_yield_q_ha": yld,
        "gross_income_dzd_ha": income,
    }


def _react_tags_for(strategy: dict, crops_db: dict) -> list[str]:
    rot = strategy["rotation"]
    pairs = list(zip(rot, rot[1:])) + [(rot[-1], rot[0])]
    tags: list[str] = []
    if any(crops_db[c]["nitrogen_fixing"] == 1 for c in rot):
        tags.append("restoresN")
    if any(crops_db[a]["depletion"] >= 3 and crops_db[b]["nitrogen_fixing"] == 1 for a, b in pairs):
        tags.append("afterHeavyFeeder")
    if sum(crops_db[c]["water_need"] for c in rot) / len(rot) <= 0.42:
        tags.append("lowWater")
    if sum(crops_db[c]["drought_tolerance"] for c in rot) / len(rot) >= 0.72:
        tags.append("drought")
    if strategy.get("gross_income_dzd_ha", 0) >= 130000:
        tags.append("highProfit")
    if any(crops_db[c]["depletion"] >= 4 for c in rot):
        tags.append("highN")
    return tags


def _strategy_to_react_card(
    rank_idx: int,
    strategy: dict,
    crops_db: dict,
    existing_npk: int,
    custom_names: dict[str, str],
) -> dict:
    years = []
    traj = strategy["trajectory_3yr"]["years"]
    for yr in traj:
        cid = yr["crop"]
        prev_was_leg = bool(yr.get("legume_credit_applied"))
        years.append({
            "crop": _crop_name(cid, custom_names),
            "soilN": round(yr["projected_nitrogen_kg_ha"]),
            "health": round(yr["soil_health_pct"]),
            "fertilizer": yr["fertilizer"],
            "kg": yr["npk_dose_kg_ha"],
            **({"nCredit": 30} if prev_was_leg else {}),
        })

    water_need = round((1.0 - strategy["criteria"]["water"]) * 100)
    ndvi_stab = round((0.45 * strategy["criteria"]["risk"] + 0.55 * (strategy["ml_metrics"]["env_match_pct"] / 100.0)) * 100)
    total_npk = strategy["trajectory_3yr"]["total_3yr_npk_kg_ha"]

    risks = {}
    for cid in dict.fromkeys(strategy["rotation"]):
        risks[_crop_name(cid, custom_names)] = crops_db[cid]["risk_note"]

    return {
        "rank": rank_idx,
        "crops": [_crop_name(cid, custom_names) for cid in strategy["rotation"]],
        "cropIds": strategy["rotation"],
        "ruleTrace": strategy.get("rule_trace") or strategy.get("explanation", {}).get("rule_trace", ""),
        "explanation": strategy.get("explanation", {}),
        "tags": _react_tags_for(strategy, crops_db),
        "scores": {
            "final": round(strategy["score"] * 100),
            "ml": round(strategy["ml_metrics"]["ai_confidence_pct"]),
            "knn": round(strategy["ml_metrics"]["env_match_pct"]),
        },
        "criteria": {
            "water": round(strategy["criteria"]["water"] * 100),
            "soil": round(strategy["criteria"]["soil"] * 100),
            "profit": round(strategy["criteria"]["profit"] * 100),
            "risk": round(strategy["criteria"]["risk"] * 100),
        },
        "years": years,
        "waterNeed": water_need,
        "ndviStability": ndvi_stab,
        "fertilizer": total_npk,
        "fertilizerSaved": existing_npk - total_npk,
        "income": strategy.get("gross_income_dzd_ha", 0),
        "risks": risks,
    }


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        serve_dir = DIST_DIR if DIST_DIR.exists() else ROOT
        super().__init__(*args, directory=str(serve_dir), **kwargs)

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, payload: dict | list, status: int = 200) -> None:
        raw = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(raw)

    def _send_file(self, path: Path) -> None:
        data = path.read_bytes()
        ctype, _ = mimetypes.guess_type(str(path))
        self.send_response(200)
        self.send_header("Content-Type", ctype or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path in ("/api/health", "/health"):
            return self._send_json({
                "status": "ok",
                "engine": "Field Shift Multi-Region Python Scoring + Monte Carlo + Fire Watch",
                "regions": list(REGIONS_CSV.keys()),
                "distBuilt": (DIST_DIR / "index.html").exists(),
                "firmsKeyConfigured": bool(os.getenv("FIRMS_MAP_KEY", "").strip()),
            })

        if path in ("/api/regions", "/regions"):
            gaps = _read_json(ROOT / "data" / "inputs" / "gaps.json", {})
            regions_out = {}
            rows_out = []
            for reg_id, meta in REGIONS_CSV.items():
                v1 = INDICATORS_BY_REGION.get(reg_id, {})
                v2 = _read_json(PROCESSED_DIR / reg_id / "indicators.json", {})
                ct = _read_json(PROCESSED_DIR / reg_id / "climate_text.json", {})
                soil = _read_json(PROCESSED_DIR / reg_id / "soil.json", {})
                fires = _read_json(PROCESSED_DIR / reg_id / "fires_snapshot.json", {})
                reg_domain = scoring.load_region(reg_id, ROOT)
                rows_out.append({
                    "region_id": reg_id,
                    "name": meta["name"],
                    "country": meta["country"],
                    "lat": meta["lat"],
                    "lon": meta["lon"],
                    "role": meta["role"],
                    "farming_system": meta["farming_system"],
                    "default_crops": meta["default_crops_list"],
                    "currency": meta.get("currency", "DZD"),
                    "currency_symbol": meta.get("currency_symbol", "DA"),
                })
                regions_out[reg_id] = {
                    "id": reg_id,
                    "code": meta["code"],
                    "meta": meta,
                    "v1": v1,
                    "v2": v2,
                    "soil": soil,
                    "climateText": ct,
                    "fires": fires,
                    "sourcedCrops": list(reg_domain["crops"].keys()),
                }
            return self._send_json({
                "rows": rows_out,
                "regions": regions_out,
                "gaps": gaps.get("gaps", []),
            })

        if path in ("/api/crops", "/crops"):
            region_q = (qs.get("region") or [None])[0]
            if region_q:
                resolved = _validate_and_resolve_region(region_q)
                if not resolved:
                    return self._send_json({"error": f"Unknown region id: {region_q}"}, status=404)
                reg_id, _ = resolved
                if (DOMAIN_DIR / "regions" / reg_id).exists():
                    reg_data = scoring.load_region(reg_id, ROOT)
                    return self._send_json({
                        "region": reg_id,
                        "source": f"domain/crops_base.csv + domain/regions/{reg_id}/yield.csv",
                        "n_crops": len(reg_data["crops"]),
                        "crops": reg_data["crops"],
                    })
            idx = _read_json(PROCESSED_DIR / "crops" / "index.json", {"ids": []})
            crops = [_read_json(PROCESSED_DIR / "crops" / f"{cid}.json") for cid in idx.get("ids", [])]
            return self._send_json({
                "source": idx.get("source"),
                "n_crops": len([c for c in crops if c]),
                "crops": [c for c in crops if c],
            })

        if path in ("/api/climate", "/climate"):
            region_param = (qs.get("region") or ["regionA"])[0]
            resolved = _validate_and_resolve_region(region_param)
            if not resolved:
                return self._send_json({"error": f"Unknown region id: {region_param}"}, status=404)
            reg_id, reg_code = resolved
            return self._send_json(_build_climate_payload(reg_id, reg_code))

        if path.startswith("/api/fires/") or path.startswith("/fires/"):
            raw_region = path.split("/fires/", 1)[1].strip("/")
            resolved = _validate_and_resolve_region(raw_region)
            if not resolved:
                return self._send_json({"error": f"Unknown region id: {raw_region}"}, status=404)
            if (qs.get("simulate_error") or ["0"])[0] == "1":
                return self._send_json(
                    {"error": "Fire data is not available right now. Try again later.", "notice": FIRE_NOTICE},
                    status=503,
                )
            reg_id, reg_code = resolved
            radius_km = float((qs.get("radius_km") or ["25"])[0])
            days = int((qs.get("days") or ["2"])[0])
            live = (qs.get("live") or ["0"])[0] == "1"
            try:
                payload = _build_fires_payload(reg_id, reg_code, radius_km=radius_km, days=days, live=live)
                return self._send_json(payload)
            except Exception:
                return self._send_json(
                    {"error": "Fire data is not available right now. Try again later.", "notice": FIRE_NOTICE},
                    status=503,
                )

        if path in ("/api/custom-region", "/custom-region"):
            lat = round(float((qs.get("lat") or ["35.4"])[0]), 2)
            lon = round(float((qs.get("lon") or ["1.3"])[0]), 2)
            cid = f"custom_{lat}_{lon}"
            cdir = PROCESSED_DIR / cid
            if not cdir.exists():
                cdir = PROCESSED_DIR / "custom_35.4_1.3"
            clim = _build_climate_payload(cid, cdir.name)
            return self._send_json({
                "id": cid,
                "name": f"Custom Point ({lat:.2f}°, {lon:.2f}°)",
                "lat": lat,
                "lon": lon,
                "role": "custom",
                "farming_system": "rainfed",
                "warning": "Data only: crop values are not adjusted for this place.",
                "climate": clim,
            })

        if path.startswith("/api/indicators/") or path.startswith("/indicators/"):
            raw_region = path.split("/indicators/", 1)[1].strip("/")
            resolved = _validate_and_resolve_region(raw_region)
            if not resolved:
                return self._send_json({"error": f"Unknown region id: {raw_region}"}, status=404)
            reg_id, _ = resolved
            ind = INDICATORS_BY_REGION.get(reg_id, INDICATORS_BY_REGION["regionA"])
            return self._send_json(ind)

        if path in ("/api/auth/me", "/auth/me"):
            token = (qs.get("token") or [None])[0] or self.headers.get("Authorization", "").replace("Bearer ", "").strip()
            fid = postgres_accounts.verify_token(token)
            if not fid:
                return self._send_json({"authenticated": False, "db": postgres_accounts.db_status()})
            farmer = postgres_accounts.get_farmer_by_id(fid)
            plans = postgres_accounts.list_farmer_plans(fid)
            return self._send_json({
                "authenticated": True,
                "farmer": farmer,
                "plans": plans,
                "db": postgres_accounts.db_status(),
            })

        if path == "/mockup.html" and (ROOT / "mockup.html").exists():
            return self._send_file(ROOT / "mockup.html")

        if path.startswith("/data/") and (ROOT / path.lstrip("/")).is_file():
            return self._send_file(ROOT / path.lstrip("/"))

        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")

        if path in ("/api/auth/register", "/auth/register"):
            try:
                out = postgres_accounts.register_farmer(
                    email=str(body.get("email", "")),
                    full_name=str(body.get("full_name", "")),
                    password=str(body.get("password", "")),
                    farm_name=str(body.get("farm_name", "")),
                    default_region=str(body.get("default_region", "regionA")),
                    farm_size_ha=float(body.get("farm_size_ha") or 10.0),
                    preferred_lang=str(body.get("preferred_lang", "en")),
                )
                return self._send_json(out)
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=400)

        if path in ("/api/auth/login", "/auth/login"):
            try:
                out = postgres_accounts.login_farmer(
                    email=str(body.get("email", "")),
                    password=str(body.get("password", "")),
                )
                return self._send_json(out)
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, status=401)

        if path in ("/api/plans/save", "/plans/save"):
            token = str(body.get("token") or self.headers.get("Authorization", "").replace("Bearer ", "")).strip()
            fid = postgres_accounts.verify_token(token)
            if not fid:
                return self._send_json({"error": "Authentication required to save a farm plan."}, status=401)
            out = postgres_accounts.save_farm_plan(
                farmer_id=fid,
                plan_name=str(body.get("plan_name", "")),
                region=str(body.get("region", "regionA")),
                rotation=list(body.get("rotation") or ["durum", "lentil", "barley"]),
                allowed_crops=list(body.get("allowed") or []),
                priorities=dict(body.get("priorities") or {}),
                scenario=dict(body.get("scenario") or {}),
                top_score=body.get("top_score"),
                notes=str(body.get("notes", "")),
            )
            return self._send_json(out)

        if path in ("/api/plans/delete", "/plans/delete"):
            token = str(body.get("token") or self.headers.get("Authorization", "").replace("Bearer ", "")).strip()
            fid = postgres_accounts.verify_token(token)
            if not fid:
                return self._send_json({"error": "Authentication required."}, status=401)
            plans = postgres_accounts.delete_farm_plan(fid, int(body.get("plan_id", 0)))
            return self._send_json({"plans": plans})

        region_param = body.get("region", "regionA")
        resolved = _validate_and_resolve_region(region_param) or ("regionA", "regionA")
        reg_id, reg_code = resolved
        ind = dict(INDICATORS_BY_REGION.get(reg_id, INDICATORS_BY_REGION["regionA"]))

        if path in ("/api/validate-crop", "/validate-crop"):
            raw_crop = body.get("crop", body)
            crop_spec = _to_engine_custom_spec(raw_crop) if ("rain" in raw_crop or "ph" in raw_crop) else raw_crop
            return self._send_json({
                "region": reg_id,
                "code": reg_code,
                **scoring.check_crop_compatibility(crop_spec, ind),
            })

        if path in ("/api/ranking", "/ranking"):
            p = body.get("priorities") or {"water": 34, "soil": 33, "yield": 33}
            tot = max(1.0, float(p.get("water", 33)) + float(p.get("soil", 33)) + float(p.get("yield", 34)))
            weights = {
                "water": float(p.get("water", 33)) / tot,
                "soil": float(p.get("soil", 33)) / tot,
                "profit": float(p.get("yield", 34)) / (2.0 * tot),
                "risk": float(p.get("yield", 34)) / (2.0 * tot),
            }

            scen = body.get("scenario") or {"rain": 0, "temp": 0}
            rain_pct = float(scen.get("rain", 0))
            temp_c = float(scen.get("temp", 0))
            eff_rain = float(ind["rainfall_mm"]) * (1.0 + rain_pct / 100.0) * (1.0 - 0.025 * temp_c)
            cb = dict(ind.get("climate_baseline") or {})
            cb["hot_days"] = float(cb.get("hot_days", 25)) + 9.0 * temp_c
            cb["frost_days"] = max(0.0, float(cb.get("frost_days", 10)) - 1.5 * temp_c)
            eff_ind = dict(ind, rainfall_mm=round(eff_rain, 1), climate_baseline=cb)

            # Section 2.5: Load crops and rules per region via load_region(reg_id)
            domain_reg = reg_id if (DOMAIN_DIR / "regions" / reg_id).exists() else "regionA"
            data = scoring.load_region(domain_reg, ROOT)
            custom_names: dict[str, str] = {}

            custom_payload = body.get("custom") or []
            if isinstance(custom_payload, dict):
                custom_iter = [{"id": cid, **spec} for cid, spec in custom_payload.items()]
            else:
                custom_iter = list(custom_payload)

            for raw_c in custom_iter:
                cid = str(raw_c.get("id", "")).strip()
                if not cid:
                    continue
                spec = _to_engine_custom_spec(raw_c)
                compat = scoring.check_crop_compatibility(spec, eff_ind)
                if compat["compatible"]:
                    data["crops"][cid] = spec
                    custom_names[cid] = str(raw_c.get("name") or _crop_name(cid))

            full_regional_crops = dict(data["crops"])
            allowed_raw = body.get("allowed") or []
            allowed = [_canon_crop_id(c) for c in allowed_raw]
            if allowed:
                filtered = {k: v for k, v in data["crops"].items() if k in allowed}
                if len(filtered) >= 3:
                    data["crops"] = filtered

            rot_raw = body.get("rotation") or ["wheat", "barley", "wheat"]
            current_rot = [_canon_crop_id(c) for c in rot_raw]
            for i, cid in enumerate(current_rot):
                if cid not in data["crops"]:
                    if cid in full_regional_crops:
                        data["crops"][cid] = full_regional_crops[cid]
                    else:
                        current_rot[i] = next(iter(data["crops"]))

            result = scoring.recommend(weights, eff_ind, current_rot, data=data, monte_carlo_runs=100)
            existing = result["strategies"][0]
            alts = result["strategies"][1:]
            existing_npk = existing["trajectory_3yr"]["total_3yr_npk_kg_ha"]

            usual_out = {
                "crops": [_crop_name(cid, custom_names) for cid in existing["rotation"]],
                "score": round(existing["score"] * 100),
                "ruleTrace": existing.get("rule_trace", ""),
                "criteria": {
                    "water": round(existing["criteria"]["water"] * 100),
                    "soil": round(existing["criteria"]["soil"] * 100),
                    "profit": round(existing["criteria"]["profit"] * 100),
                    "risk": round(existing["criteria"]["risk"] * 100),
                },
                "waterNeed": round((1.0 - existing["criteria"]["water"]) * 100),
                "ndviStability": round((0.45 * existing["criteria"]["risk"] + 0.55 * (existing["ml_metrics"]["env_match_pct"] / 100.0)) * 100),
                "fertilizer": existing_npk,
                "income": existing.get("gross_income_dzd_ha", 0),
                "soilNEnd": round(existing["trajectory_3yr"]["final_nitrogen_kg_ha"]),
            }
            rotations_out = [
                _strategy_to_react_card(i + 1, strat, data["crops"], existing_npk, custom_names)
                for i, strat in enumerate(alts)
            ]
            avoid_out = [
                {
                    "crops": [_crop_name(cid, custom_names) for cid in a["rotation"]],
                    "score": round(a["score"] * 100),
                    "reasons": a["reasons"],
                }
                for a in result.get("rotations_to_avoid", [])
            ]
            crop_rankings_out = [
                {
                    **cr,
                    "name": _crop_name(cr["crop_id"], custom_names),
                }
                for cr in result.get("crop_rankings", [])
            ]

            return self._send_json({
                "source": f"Field Shift Python Engine · {data.get('region_meta', {}).get('name', reg_id)} (NASA POWER + SoilGrids + MODIS + Monte Carlo 100 runs)",
                "sample": False,
                "region": reg_id,
                "role": data.get("region_meta", {}).get("role", "deep"),
                "farmingSystem": data.get("region_meta", {}).get("farming_system", "rainfed"),
                "monteCarlo": {
                    "runs": 100,
                    "rank1StaysFirstPct": round(result["ranking_stability_pct"]),
                },
                "usual": usual_out,
                "rotations": rotations_out,
                "cropRankings": crop_rankings_out,
                "avoid": avoid_out,
                "nCandidates": result["n_candidates"],
                "stress": result["stress"],
                "adjustedWeights": result["adjusted_weights"],
            })

        if path in ("/api/recommend", "/recommend"):
            p = body.get("priorities", {"save_water": 42, "protect_soil": 33, "yield": 25})
            tot = max(1.0, float(p.get("save_water", 33) + p.get("protect_soil", 33) + p.get("yield", 34)))
            weights = {
                "water": float(p.get("save_water", 33)) / tot,
                "soil": float(p.get("protect_soil", 33)) / tot,
                "profit": float(p.get("yield", 34)) / (2 * tot),
                "risk": float(p.get("yield", 34)) / (2 * tot),
            }
            domain_reg = reg_id if (DOMAIN_DIR / "regions" / reg_id).exists() else "regionA"
            data = scoring.load_region(domain_reg, ROOT)
            for custom_id, custom_spec in (body.get("custom_crops") or {}).items():
                compat = scoring.check_crop_compatibility(custom_spec, ind)
                if not compat["compatible"]:
                    return self._send_json({
                        "error": f"Custom crop '{custom_id}' is incompatible with {reg_id}",
                        "compatibility": compat,
                    }, status=400)
                data["crops"][custom_id] = _to_engine_custom_spec(custom_spec)

            allowed = [_canon_crop_id(c) for c in (body.get("allowed_crops") or [])]
            if allowed:
                data["crops"] = {k: v for k, v in data["crops"].items() if k in allowed}

            current_rot = [
                c if c in data["crops"] else next(iter(data["crops"]))
                for c in (_canon_crop_id(x) for x in body.get("current_rotation", ["wheat", "barley", "wheat"]))
            ]
            result = scoring.recommend(weights, ind, current_rot, data=data)
            return self._send_json(result)

        if path in ("/api/assistant", "/assistant"):
            question = str(body.get("question", "")).strip()
            lang = body.get("lang")
            out = rag_assistant.answer_question(
                question=question,
                region=reg_id,
                rotation=body.get("rotation"),
                allowed=body.get("allowed"),
                priorities=body.get("priorities"),
                scenario=body.get("scenario"),
                lang=lang if lang in ("en", "fr", "ar") else None,
            )
            out["whisperConfigured"] = bool(os.getenv("WHISPER_MODEL_PATH") or os.getenv("WHISPER_API_URL"))
            return self._send_json(out)

        if path in ("/api/stt", "/stt"):
            if body.get("audio") or body.get("file"):
                stt_result = _transcribe_audio_payload(body)
                return self._send_json(stt_result)

            whisper_model_path = os.getenv("WHISPER_MODEL_PATH", str(DEFAULT_WHISPER_MODEL)).strip()
            whisper_api_url = os.getenv("WHISPER_API_URL", "").strip()
            configured = bool(Path(whisper_model_path).exists() or whisper_api_url)
            return self._send_json({
                "whisperConfigured": configured,
                "modelPath": whisper_model_path if Path(whisper_model_path).exists() else None,
                "apiUrl": whisper_api_url or None,
                "status": "ready" if configured else "awaiting_finetuned_whisper_model",
                "message": (
                    "Fine-tuned Whisper STT (Algerian Darija) endpoint is live & ready."
                    if configured
                    else "Whisper model not found."
                ),
                "text": body.get("fallbackText", ""),
            })

        return self._send_json({"error": "Not found"}, status=404)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    httpd = ThreadingHTTPServer((args.host, args.port), AppHandler)
    print(f"Serving Field Shift at http://{args.host}:{args.port}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
