#!/usr/bin/env python3
"""
Generate a formatted Microsoft Word (.docx) document from API_PLANS_DIFF_AND_ALIGNMENT.md
organized entirely in styled Word tables, reusing pure-stdlib OOXML helpers
from export_guide_docx.py.
"""

from __future__ import annotations

import os
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from export_guide_docx import (  # noqa: E402
    make_code_block,
    make_heading,
    make_table,
)


def build_alignment_body() -> str:
    elements: list[str] = []

    # Banner & Title
    elements.append(
        '<w:p><w:pPr><w:spacing w:before="0" w:after="60"/>'
        '<w:shd w:val="clear" w:color="auto" w:fill="14532D"/>'
        '<w:ind w:left="200" w:right="200"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/>'
        '<w:color w:val="A7F3D0"/><w:sz w:val="20"/></w:rPr>'
        '<w:t xml:space="preserve">FIELD SHIFT • TEAM API CONTRACT ALIGNMENT &amp; DIFF</w:t></w:r></w:p>'
    )
    elements.append(
        '<w:p><w:pPr><w:spacing w:before="60" w:after="140"/>'
        '<w:pBdr><w:bottom w:val="single" w:sz="18" w:space="6" w:color="14532D"/></w:pBdr></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/>'
        '<w:color w:val="14532D"/><w:sz w:val="40"/></w:rPr>'
        '<w:t xml:space="preserve">API Plans Comparison &amp; Alignment Report</w:t></w:r></w:p>'
    )

    # Section 0: Verdict Table
    elements.append(make_heading("0. Executive Verdict", level=1))
    elements.append(
        make_table(
            headers=["Question", "Answer", "Overlap", "Primary Reason"],
            col_widths_pct=[24, 18, 12, 46],
            rows=[
                [
                    "**Does teammate's API plan match our app & ML Guide?**",
                    "**NO — Major Realignment Needed**",
                    "**~20%**",
                    "Teammate spec targets **France (`FR-OCC`)** with **`demo` / `null` scores**, **Express + MongoDB**, and **toy JS math**, whereas our codebase already runs **Algeria (`DZ`) live NASA POWER + SoilGrids + MODIS** data, **13 OAIC crops**, **custom crop validation**, and **Python ML + Monte Carlo** scoring.",
                ]
            ],
        )
    )

    # Section 1: Side-by-Side Table
    elements.append(make_heading("1. Side-by-Side Differences (Core System & Data)", level=1))
    elements.append(
        make_table(
            headers=["Dimension", "Our App & ML Guide (`server.py` / `scoring.py`)", "Teammate's Contract (`contrat d'API`)", "Status"],
            col_widths_pct=[18, 34, 34, 14],
            rows=[
                ["**Country & Regions**", "**Algeria (`DZ`)** — 3 live zones: `regionA` (Sétif), `regionB` (Constantine), `regionC` (Tiaret) + dynamic GPS lookup.", "**France (`FR`)** only — `FR-OCC` (`\"Occitanie — démo\"`); returns `400 UNSUPPORTED_COUNTRY` for non-FR.", "**Conflict**"],
                ["**Backend Status & Stack**", "Starter Python server runs (`GET /indicators/{id}`, `POST /recommend`, `POST /validate-crop`) + **FastAPI** blueprint.", "Claims backend is *not implemented yet*; targets **Express (`:3000/api/v1`) + MongoDB**.", "**Conflict**"],
                ["**Data & Validation Mode**", "**Live real data:** NASA POWER (1995–2024), ISRIC SoilGrids v2.0 (`0–30 cm`), ORNL MODIS NDVI, FAO 56, ITGC, OAIC/CCLS.", "Locked to `mode: \"demo\"`, `\"Scores fictifs\"`, `soil/climate: null`, `validationStatus: unavailable`, `sources: []`.", "**Conflict**"],
                ["**Crop Catalog (`GET /crops`)**", "**13 Algerian crops** (`wheat`, `soft_wheat`, `barley`, `oats`, `triticale`, `chickpea`, `lentil`, `faba`, `vetch`, `canola`, `safflower`, `sunflower`, `fallow`) + `DA/q`, yields, NPK, `rain_opt`, `ph_opt`.", "Only 2 French demo crops (`ble`, `lentille`) with fake `demoScores: {water, soil, yield}`. No prices, N balance, or `ETc`.", "**Conflict**"],
                ["**Custom Crops**", "Supported via **`POST /validate-crop`** (rainfall, pH, frost, heat, family gate) + `custom_crops` in `/recommend`.", "Not included anywhere in the contract.", "**Missing**"],
                ["**Rotation Rules**", "Fixed **3-year cyclic rules** (`rules_algeria.json`: `min_legumes=1`, `forbid_consecutive_same_family=true`, max 1 per crop).", "Allows `2–4` arbitrary crops (`2–24` permutations); no legume or family rules in MVP.", "**Conflict**"],
                ["**Scoring & ML Formula**", "Stress-adjusted criteria (`K=1.5`) + CropSense KNN/pairwise ML + DharaaAI 3-yr N/NPK + **seeded Monte Carlo stability**.", "Toy math: average of `demoScores` + `5 pts` per family switch + `5 pts` for legume -> cereal, clamped `0–100`.", "**Conflict**"],
                ["**Outputs & Economics**", "Returns `ml_metrics`, `trajectory_3yr` (N kg/ha, soil health %, NPK), `fertilizer_saved_vs_existing_kg_ha`, `gross_income_dzd_ha` (OAIC DA/ha/yr), `rotations_to_avoid`, `ranking_stability_pct`, `gaps` (`G1–G5`).", "Flat `scores: {water, soil, yield, total}` + `rank` only. No economics, N balance, fertilizer, uncertainty, or avoid list.", "**Missing**"],
                ["**Weight Handling**", "Accepts any non-negative weights and rescales automatically (`w / sum`).", "Strictly enforces `water + soil + yield === 100` integers (`400 VALIDATION_ERROR`).", "**Minor Conflict**"],
                ["**API Prefix & Errors**", "Currently root paths (`/recommend`) with simple `{\"error\": \"...\"}`.", "Versioned `/api/v1` prefix + structured `{error: {code, message, details}}` + `openapi.yaml`.", "**Teammate Cleaner**"],
            ],
        )
    )

    # Section 2: Endpoint-by-Endpoint Matrix
    elements.append(make_heading("2. Endpoint-by-Endpoint Route Mapping Matrix", level=1))
    elements.append(
        make_table(
            headers=["Teammate Route", "Our App / ML Guide Route", "Overlap", "Alignment Action Required"],
            col_widths_pct=[24, 24, 14, 38],
            rows=[
                ["`GET /health`", "`GET /health` *(Part 5)*", "**Match**", "Implement in Python FastAPI returning loaded regions & crops counts."],
                ["`GET /crops?country=FR`", "`GET /crops?region=regionA` *(Part 5)*", "**Partial**", "Switch `FR` -> `DZ`, remove `demoScores`, return 13 Algerian crops + optional regional compatibility flags."],
                ["`POST /rotations/generate`", "`POST /recommend` *(live in `server.py`)*", "**Major Diff**", "Merge under `/api/v1/recommend` (alias `/api/v1/rotations/generate`) using `scoring.recommend()` + `current_rotation` + `custom_crops` + Monte Carlo."],
                ["`GET /regions?country=FR`", "`GET /regions` *(Part 5)*", "**Partial**", "Switch `FR` -> `DZ`, list `regionA` (Sétif), `regionB` (Constantine), `regionC` (Tiaret) with live summary stats."],
                ["`GET /regions/{code}/context`", "`GET /indicators/{id}` *(live in `server.py`)*", "**Partial**", "Populate `soil` (`soc`, `ph`) and `climate` (`rainfall_mm`, `hot_days`, `frost_days`, `monthly_rain_mm`, trends) with live data instead of `null`."],
                ["`POST /rotations/compare`", "Built inside `POST /recommend`", "**Partial**", "Keep as thin alias if React calls it; fix Section 5 typo (`habitualCropIds` `[\"ble\",\"ble\",\"orge\"]` vs `[\"ble\",\"orge\",\"ble\"]`)."],
                ["`GET /map/regions`", "Reads `all_indicators.json` directly", "**Compatible**", "Keep GeoJSON `FeatureCollection` endpoint filled with live NASA/SoilGrids/MODIS metrics instead of `null`."],
                ["*(None)*", "**`POST /validate-crop`** *(live)*", "**Missing**", "**Add to teammate's contract** — checks rainfall `>=90%`, pH `±0.3`, frost/heat & botanical family."],
                ["*(None)*", "**`POST /scenario`** *(Part 5)*", "**Missing**", "**Add to teammate's contract** — rainfall/temp climate stress testing (`scoring.scenario()`)."],
                ["*(None)*", "**`POST /parcel/indicators`** *(Part 5)*", "**Missing**", "**Add to teammate's contract** — dynamic `{lat, lon}` Algeria GPS lookup (`0.1°` cached)."],
            ],
        )
    )

    # Section 3: Exact Edits in Tables
    elements.append(make_heading("3. Exact Edits to Apply to Teammate's File", level=1))

    elements.append(make_heading("3.1 DELETE (Remove from Teammate's Contract)", level=2))
    elements.append(
        make_table(
            headers=["Section in Teammate's File", "Exact Content to Delete", "Why It Conflicts"],
            col_widths_pct=[24, 38, 38],
            rows=[
                ["**Intro**", "*\"Le backend n'est pas encore implémenté\"*", "`server.py` and `engine/scoring.py` already run live scoring & validation."],
                ["**Section 2 (`GET /crops`)**", "`country=FR`, `\"only FR supported\"`, `400 UNSUPPORTED_COUNTRY`, and `demoScores: {water, soil, yield}`", "App targets **Algeria (`DZ`)** with calibrated FAO/ITGC/OAIC crops, not French demo scores."],
                ["**Section 3 (`generate`)**", "Toy math (`mean(demoScores) + 5 pts`), `2–4` unvalidated crops, `\"Scores fictifs\"` disclaimer", "Replaced by 3-year cyclic rules, ML transition, 3-yr N/NPK simulation, and Monte Carlo stability."],
                ["**Sections 4 & 6 (`context`, `map`)**", "`FR-OCC`, `\"Occitanie\"`, `soil: null`, `climate: null`, `validationStatus: \"unavailable\"`, `geometry: null`, `value: null`", "Live NASA POWER, ISRIC SoilGrids, and MODIS NDVI telemetry is already fetched and verified."],
                ["**Section 5 (`compare`)**", "Typo: request sends `[\"ble\",\"ble\",\"orge\"]` vs response `[\"ble\",\"orge\",\"ble\"]`", "Internal request/response contradiction inside teammate's own doc."],
                ["**Cross-cutting (`Express`)**", "Requirement to write scoring formulas in JS inside Express/MongoDB", "Prevents two diverging scoring engines; Python `engine/scoring.py` stays the single source of truth."],
            ],
        )
    )

    elements.append(make_heading("3.2 ADD / UPDATE (Bring Teammate's File Up to Our Level)", level=2))
    elements.append(
        make_table(
            headers=["Target Endpoint / Section", "Additions Required", "Exact Fields & Behavior to Document"],
            col_widths_pct=[24, 28, 48],
            rows=[
                ["**Regions (`GET /regions`)**", "Switch to Algeria (`DZ`) benchmark stations", "`regionA` (`setif`, `484.5 mm`, SOC `12.52`, pH `7.77`), `regionB` (`constantine`, `524.7 mm`, SOC `17.08`, pH `7.50`), `regionC` (`tiaret`, `405.8 mm`, SOC `12.38`, pH `7.57`)."],
                ["**`GET /crops?region=...`**", "Full 13 Algerian crop schema", "`wheat`, `soft_wheat`, `barley`, `oats`, `triticale`, `chickpea`, `lentil`, `faba`, `vetch`, `canola`, `safflower`, `sunflower`, `fallow` + `oaic_ccls_price_dzd_q`, `gross_income_dzd_ha`, `n_impact_kg_ha`, `base_npk_kg_ha`, `rain_opt`, `ph_opt`."],
                ["**NEW: `POST /validate-crop`**", "Regional Compatibility Gate", "Request `{region, crop: {family, rain_min, rain_max, ph_min, ph_max, frost_tolerant, heat_tolerant}}`. Response `{region, compatible, status, blockers, warnings}`."],
                ["**Upgrade `POST /recommend`**", "Real inputs, rules & rich outputs", "Inputs: `region`, `priorities` (auto-normalized), `current_rotation` (3 crops), `allowed_crops`, `custom_crops`, `monte_carlo_runs`. Outputs: `ml_metrics`, `trajectory_3yr`, `fertilizer_saved_vs_existing_kg_ha`, `gross_income_dzd_ha`, `ranking_stability_pct`, `rotations_to_avoid`, `gaps`."],
                ["**NEW: `POST /scenario`**", "Climate What-If Stress Test", "Inputs `{region, priorities, current_rotation, rainfall_delta_pct, temp_delta_c}` -> `{baseline, scenario, ranking_changed}`."],
                ["**NEW: `POST /parcel/indicators`**", "Dynamic Algeria GPS lookup", "Inputs `{lat, lon}` inside Algeria bounds -> cached `0.1°` live NASA POWER + SoilGrids + MODIS fetch (`503` stale cache fallback)."],
            ],
        )
    )

    elements.append(make_heading("3.3 KEEP & ADOPT (From Teammate's Spec Into Our Python Backend)", level=2))
    elements.append(
        make_table(
            headers=["Teammate Feature", "How We Adopt It in FastAPI", "Engineering Benefit"],
            col_widths_pct=[26, 40, 34],
            rows=[
                ["**Versioned `/api/v1` Prefix**", "Mount FastAPI router under `/api/v1` (with `/rotations/generate` & `/regions/{id}/context` aliases).", "Prevents breaking frontend or mobile apps on future changes."],
                ["**Structured Error Envelope**", "Return `{error: {code, message, details}}` for `400`, `404`, `422`, `503` responses.", "Clean inline validation feedback in React/JS UI forms."],
                ["**GeoJSON `GET /map/regions`**", "Serve `FeatureCollection` populated with live `Point` coordinates & `all_indicators.json` layers.", "Direct Leaflet / Mapbox rendering without placeholder `null`s."],
                ["**`openapi.yaml` Contract Sync**", "Export OpenAPI spec directly from FastAPI Pydantic schemas (`/openapi.json`).", "Teammate's Swagger Editor stays 100% synced with Python code."],
            ],
        )
    )

    elements.append(
        make_code_block(
            "Agreed Error Envelope (Adopt in FastAPI from Teammate Spec)",
            """{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Custom crop is incompatible with selected region.",
    "details": [
      { "field": "crop.ph_max", "message": "Crop requires pH <= 5.5 vs Setif SoilGrids pH 7.77" }
    ]
  }
}""",
        )
    )

    # Section 4: Unified Team Action Plan Table
    elements.append(make_heading("4. Unified Team Action Plan (Zero Rework)", level=1))
    elements.append(
        make_table(
            headers=["Step", "Owner", "Actionable Deliverable", "Source of Truth", "Priority"],
            col_widths_pct=[8, 18, 42, 20, 12],
            rows=[
                ["**1**", "**Alaa & Backend Teammate**", "Pick ONE API entry point: run **FastAPI (`/api/v1`)** directly OR keep **Express** strictly as a proxy forwarding agronomic calls to Python.", "`engine/scoring.py`", "**Immediate**"],
                ["**2**", "**Teammate**", "Update teammate's API Markdown & `openapi.yaml` using Tables **3.1 (`DELETE`)** & **3.2 (`ADD/UPDATE`)**.", "`AGRONOMY_AND_ML_GUIDE.md`", "**Immediate**"],
                ["**3**", "**Mehdi / Backend**", "Upgrade starter `server.py` to **FastAPI + Pydantic v2** with `/api/v1` prefix & `{error: {code, message, details}}` envelope.", "Part 5 of ML Guide", "**High**"],
                ["**4**", "**Achref / Data**", "Implement `POST /parcel/indicators` with `0.1°` disk/Redis cache + `503` stale fallback for arbitrary `{lat, lon}` GPS lookups.", "`scripts/fetch_real_data.py`", "**High**"],
                ["**5**", "**Younes / QA**", "Run API integration tests across `/crops`, `/validate-crop`, `/recommend`, and `/scenario`, verifying exported `openapi.yaml`.", "`tests/test_scoring.py`", "**Before Demo**"],
            ],
        )
    )

    elements.append(
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" '
        'w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
    )
    return "".join(elements)


def create_alignment_docx(output_path: Path) -> None:
    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-officedocument.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-officedocument.core-properties+xml"/>
</Types>"""

    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>"""

    doc_rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="21"/>
        <w:szCs w:val="21"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr></w:style>
</w:styles>"""

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    core_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>API Plans Comparison &amp; Alignment Report — Field Shift</dc:title>
  <dc:subject>NASA Space Apps Challenge — Backend API Diff &amp; Alignment</dc:subject>
  <dc:creator>Field Shift Team</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now_iso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now_iso}</dcterms:modified>
</cp:coreProperties>"""

    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{build_alignment_body()}</w:body>'
        '</w:document>'
    )

    os.makedirs(output_path.parent, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", rels_xml)
        zf.writestr("word/_rels/document.xml.rels", doc_rels_xml)
        zf.writestr("word/styles.xml", styles_xml)
        zf.writestr("docProps/core.xml", core_xml)
        zf.writestr("word/document.xml", document_xml)


if __name__ == "__main__":
    out = ROOT_DIR / "API_Plans_Diff_and_Alignment.docx"
    create_alignment_docx(out)
    print(f"Generated {out} ({out.stat().st_size:,} bytes)")
