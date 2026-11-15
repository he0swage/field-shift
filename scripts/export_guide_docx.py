#!/usr/bin/env python3
"""
Generate a formatted Microsoft Word (.docx) document from the CS Agronomy,
NASA Data & Hybrid ML Rotation Engine Guide using pure Python standard library
(OpenXML / OOXML packaging).
"""

from __future__ import annotations

import html
import os
import re
import zipfile
from datetime import datetime, timezone


def xml_escape(text: str) -> str:
    return html.escape(text, quote=True)


def parse_inline_runs(text: str, default_color: str = "1E293B", default_size: int = 21) -> str:
    """
    Convert markdown inline formatting (**bold**, *italic*, `code`) into WordprocessingML <w:r> elements.
    default_size is in half-points (21 = 10.5pt, 22 = 11pt).
    """
    tokens = re.split(r"(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)", text)
    runs_xml = []
    for tok in tokens:
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**") and len(tok) > 4:
            content = xml_escape(tok[2:-2])
            runs_xml.append(
                f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>'
                f'<w:b/><w:color w:val="{default_color}"/><w:sz w:val="{default_size}"/></w:rPr>'
                f'<w:t xml:space="preserve">{content}</w:t></w:r>'
            )
        elif tok.startswith("`") and tok.endswith("`") and len(tok) > 2:
            content = xml_escape(tok[1:-1])
            runs_xml.append(
                f'<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>'
                f'<w:b/><w:color w:val="0F5132"/><w:shd w:val="clear" w:color="auto" w:fill="E8F5E9"/>'
                f'<w:sz w:val="{max(default_size - 2, 18)}"/></w:rPr>'
                f'<w:t xml:space="preserve">{content}</w:t></w:r>'
            )
        elif tok.startswith("*") and tok.endswith("*") and len(tok) > 2:
            content = xml_escape(tok[1:-1])
            runs_xml.append(
                f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>'
                f'<w:i/><w:color w:val="{default_color}"/><w:sz w:val="{default_size}"/></w:rPr>'
                f'<w:t xml:space="preserve">{content}</w:t></w:r>'
            )
        else:
            content = xml_escape(tok)
            runs_xml.append(
                f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>'
                f'<w:color w:val="{default_color}"/><w:sz w:val="{default_size}"/></w:rPr>'
                f'<w:t xml:space="preserve">{content}</w:t></w:r>'
            )
    return "".join(runs_xml)


def make_heading(text: str, level: int = 1) -> str:
    if level == 1:
        style = "Heading1"
        color = "14532D"
        size = 32  # 16pt
        before, after = 320, 140
        border = (
            '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="14532D"/></w:pBdr>'
        )
    elif level == 2:
        style = "Heading2"
        color = "1E3A2F"
        size = 26  # 13pt
        before, after = 240, 100
        border = ""
    else:
        style = "Heading3"
        color = "0F5132"
        size = 23  # 11.5pt
        before, after = 180, 80
        border = ""

    return (
        f'<w:p><w:pPr><w:pStyle w:val="{style}"/>'
        f'<w:spacing w:before="{before}" w:after="{after}"/>{border}</w:pPr>'
        f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>'
        f'<w:b/><w:color w:val="{color}"/><w:sz w:val="{size}"/></w:rPr>'
        f'<w:t xml:space="preserve">{xml_escape(text)}</w:t></w:r></w:p>'
    )


def make_paragraph(text: str, space_before: int = 80, space_after: int = 120) -> str:
    runs = parse_inline_runs(text, default_color="1E293B", default_size=21)
    return (
        f'<w:p><w:pPr><w:spacing w:before="{space_before}" w:after="{space_after}" '
        f'w:line="276" w:lineRule="auto"/></w:pPr>{runs}</w:p>'
    )


def make_bullet(text: str, level: int = 0) -> str:
    indent_left = 360 * (level + 1)
    bullet_char = "• " if level == 0 else "◦ "
    runs = parse_inline_runs(text, default_color="1E293B", default_size=21)
    return (
        f'<w:p><w:pPr><w:spacing w:before="40" w:after="60" w:line="260" w:lineRule="auto"/>'
        f'<w:ind w:left="{indent_left}" w:hanging="220"/></w:pPr>'
        f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/>'
        f'<w:color w:val="14532D"/><w:sz w:val="21"/></w:rPr>'
        f'<w:t xml:space="preserve">{bullet_char}</w:t></w:r>{runs}</w:p>'
    )


def make_callout(title: str, bullets: list[str], fill_hex: str = "ECFDF5", border_hex: str = "14532D") -> str:
    p_list = []
    # Title paragraph inside callout
    title_runs = parse_inline_runs(f"**{title}**", default_color="14532D", default_size=22)
    p_list.append(
        f'<w:p><w:pPr><w:spacing w:before="140" w:after="60"/>'
        f'<w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="{border_hex}"/>'
        f'<w:top w:val="single" w:sz="6" w:space="6" w:color="CBD5E1"/>'
        f'<w:right w:val="single" w:sz="6" w:space="6" w:color="CBD5E1"/></w:pBdr>'
        f'<w:shd w:val="clear" w:color="auto" w:fill="{fill_hex}"/>'
        f'<w:ind w:left="240" w:right="240"/></w:pPr>{title_runs}</w:p>'
    )
    for idx, b in enumerate(bullets):
        is_last = idx == len(bullets) - 1
        bottom_bdr = (
            f'<w:bottom w:val="single" w:sz="6" w:space="6" w:color="CBD5E1"/>' if is_last else ""
        )
        runs = parse_inline_runs(f"• {b}", default_color="1E293B", default_size=20)
        p_list.append(
            f'<w:p><w:pPr><w:spacing w:before="40" w:after="{120 if is_last else 40}"/>'
            f'<w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="{border_hex}"/>'
            f'<w:right w:val="single" w:sz="6" w:space="6" w:color="CBD5E1"/>{bottom_bdr}</w:pBdr>'
            f'<w:shd w:val="clear" w:color="auto" w:fill="{fill_hex}"/>'
            f'<w:ind w:left="280" w:right="240"/></w:pPr>{runs}</w:p>'
        )
    return "".join(p_list)


def make_code_block(title: str, code: str) -> str:
    """Render a styled monospaced code block box for Word."""
    lines = code.strip("\n").splitlines()
    p_list = [
        f'<w:p><w:pPr><w:spacing w:before="120" w:after="40"/><w:keepNext/>'
        f'<w:pBdr><w:left w:val="single" w:sz="18" w:space="10" w:color="15803D"/></w:pBdr>'
        f'<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>'
        f'<w:ind w:left="180" w:right="180"/></w:pPr>'
        f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/>'
        f'<w:color w:val="0F172A"/><w:sz w:val="19"/></w:rPr>'
        f'<w:t xml:space="preserve">{xml_escape(title)}</w:t></w:r></w:p>'
    ]
    for idx, ln in enumerate(lines):
        is_last = idx == len(lines) - 1
        bottom_bdr = (
            '<w:bottom w:val="single" w:sz="6" w:space="6" w:color="CBD5E1"/>' if is_last else ""
        )
        p_list.append(
            f'<w:p><w:pPr><w:spacing w:before="0" w:after="{100 if is_last else 0}" w:line="220" w:lineRule="auto"/>'
            f'<w:pBdr><w:left w:val="single" w:sz="18" w:space="10" w:color="15803D"/>{bottom_bdr}</w:pBdr>'
            f'<w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>'
            f'<w:ind w:left="180" w:right="180"/></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>'
            f'<w:color w:val="0F172A"/><w:sz w:val="17"/></w:rPr>'
            f'<w:t xml:space="preserve">{xml_escape(ln if ln else " ")}</w:t></w:r></w:p>'
        )
    return "".join(p_list)


def make_table(headers: list[str], rows: list[list[str]], col_widths_pct: list[int] | None = None) -> str:
    """
    Build a styled Word table with dark green header row, white bold text,
    alternating row shading, and crisp borders.
    Width is 5000 (100% in fiftieths of a percent).
    """
    num_cols = len(headers)
    if not col_widths_pct or len(col_widths_pct) != num_cols:
        col_widths_pct = [int(100 / num_cols)] * num_cols

    tbl_pr = (
        '<w:tblPr>'
        '<w:tblW w:w="5000" w:type="pct"/>'
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>'
        '<w:left w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>'
        '<w:bottom w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>'
        '<w:right w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>'
        '<w:insideH w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        '<w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        '</w:tblBorders>'
        '<w:tblCellMar>'
        '<w:top w:w="100" w:type="dxa"/>'
        '<w:left w:w="140" w:type="dxa"/>'
        '<w:bottom w:w="100" w:type="dxa"/>'
        '<w:right w:w="140" w:type="dxa"/>'
        '</w:tblCellMar>'
        '</w:tblPr>'
    )

    # Header row
    header_cells = []
    for h_text, w_pct in zip(headers, col_widths_pct):
        w_val = w_pct * 50
        header_cells.append(
            f'<w:tc><w:tcPr><w:tcW w:w="{w_val}" w:type="pct"/>'
            f'<w:shd w:val="clear" w:color="auto" w:fill="14532D"/>'
            f'<w:vAlign w:val="center"/></w:tcPr>'
            f'<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/>'
            f'<w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr>'
            f'<w:t xml:space="preserve">{xml_escape(h_text)}</w:t></w:r></w:p></w:tc>'
        )
    header_row_xml = f'<w:tr><w:trPr><w:tblHeader/></w:trPr>{"".join(header_cells)}</w:tr>'

    # Data rows
    body_rows_xml = []
    for r_idx, row in enumerate(rows):
        fill_color = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        cells_xml = []
        for c_idx, (cell_text, w_pct) in enumerate(zip(row, col_widths_pct)):
            w_val = w_pct * 50
            runs = parse_inline_runs(cell_text, default_color="1E293B", default_size=19)
            cells_xml.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{w_val}" w:type="pct"/>'
                f'<w:shd w:val="clear" w:color="auto" w:fill="{fill_color}"/>'
                f'<w:vAlign w:val="top"/></w:tcPr>'
                f'<w:p><w:pPr><w:spacing w:before="50" w:after="50" w:line="240" w:lineRule="auto"/></w:pPr>'
                f'{runs}</w:p></w:tc>'
            )
        body_rows_xml.append(f'<w:tr>{"".join(cells_xml)}</w:tr>')

    return f'<w:tbl>{tbl_pr}{header_row_xml}{"".join(body_rows_xml)}</w:tbl><w:p><w:pPr><w:spacing w:before="40" w:after="80"/></w:pPr></w:p>'


def build_document_body() -> str:
    elements = []

    # Title Banner Block
    elements.append(
        '<w:p><w:pPr><w:spacing w:before="0" w:after="60"/>'
        '<w:shd w:val="clear" w:color="auto" w:fill="14532D"/>'
        '<w:ind w:left="200" w:right="200"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/>'
        '<w:color w:val="A7F3D0"/><w:sz w:val="20"/></w:rPr>'
        '<w:t xml:space="preserve">NASA SPACE APPS CHALLENGE • CROP ROTATION ADVISOR TECHNICAL MANUAL</w:t></w:r></w:p>'
    )
    elements.append(
        '<w:p><w:pPr><w:spacing w:before="60" w:after="80"/>'
        '<w:shd w:val="clear" w:color="auto" w:fill="14532D"/>'
        '<w:ind w:left="200" w:right="200"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/>'
        '<w:color w:val="FFFFFF"/><w:sz w:val="38"/></w:rPr>'
        '<w:t xml:space="preserve">The Computer Scientist\'s Guide to Agronomy, NASA Data &amp; Hybrid ML Rotation Engines</w:t></w:r></w:p>'
    )
    elements.append(
        '<w:p><w:pPr><w:spacing w:before="0" w:after="240"/>'
        '<w:shd w:val="clear" w:color="auto" w:fill="14532D"/>'
        '<w:ind w:left="200" w:right="200"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'
        '<w:color w:val="E2E8F0"/><w:sz w:val="21"/></w:rPr>'
        '<w:t xml:space="preserve">Prepared for Alaa (Engine &amp; UI), Younes (QA &amp; Verification), and Achref (Satellite &amp; Soil Pipelines)</w:t></w:r></w:p>'
    )

    elements.append(
        make_paragraph(
            "This reference manual translates agricultural and satellite remote-sensing concepts into **Computer Science and Systems Engineering mental models**, audits why the cloned repo datasets (`CropSense` and `DharaaAI`) **do not match Algeria/North Africa**, lists the **5 regional datasets to collect** with exact APIs and code usage, and documents the **5-Stage Hybrid Rules + ML + State-Space Simulation** pipeline aligned with **Field Shift (NASA Space Apps 2026)**."
        )
    )

    # =========================================================================
    # REPO DATA AUDIT
    # =========================================================================
    elements.append(make_heading("Repo Data Audit: Do CropSense & DharaaAI Match Your Region?", level=1))
    elements.append(
        make_callout(
            "Verified Audit Result: NO — Cloned Repo Datasets Are Built for Indian / Tropical Agriculture",
            [
                "**Crops Mismatch (`CropSense`):** `Crop_recommendation.csv` (2,200 rows) has 22 crops (`rice`, `jute`, `coconut`, `coffee`, `papaya`, `mango`, `pigeonpeas`, `mungbean`). **It has ZERO wheat and ZERO barley**—your core Algerian/Mediterranean cereals.",
                "**Climate & Soil Mismatch:** `CropSense` median temp is `25.6 °C` (up to `43.7 °C`), median humidity `80.5%`, and median `pH 6.43` (acidic). Algerian semi-arid cereal belts (Setif, Tiaret) have cool winters (`frost_days < 0 °C`), dry springs, and alkaline calcareous soils (`pH 7.5–8.2`).",
                "**Input Mismatch:** `CropSense` requires lab-measured field `N, P, K (kg/ha)`. **NASA POWER and ISRIC SoilGrids do NOT provide field NPK in kg/ha.** Never feed SoilGrids/POWER into `CropSense`'s `.pkl` models.",
                "**ML & License Caveat:** `CropSense`'s Random Forest (`F1 = 0.92`) was trained on 484 crop pairs **labelled by hand-written rules**—so `0.92` is rule-mimicry, not real-world accuracy. Never load external `.pkl` files, and never claim `0.92` as AI accuracy. Reuse only the **column concepts**, **tag logic**, and **3-year trajectory UI**.",
            ],
            fill_hex="FEF2F2",
            border_hex="B91C1C",
        )
    )
    elements.append(
        make_callout(
            "Core ML & Uncertainty Terms Explained for Computer Scientists",
            [
                "**What is F1 (`0.92`)?** The **F1-score** (`0.0` to `1.0`) is the harmonic mean of **Precision** (*out of everything predicted positive, how many were right?*) and **Recall** (*out of all true positives, how many did we catch?*): `F1 = 2 * (Precision * Recall) / (Precision + Recall)`. Because `CropSense` generated its 484 labels using a rule script—not real harvests—`F1 = 0.92` only means the Random Forest learned to imitate that rule script, NOT real-world yield accuracy.",
                "**What is Monte Carlo Uncertainty (`ranking_stability_pct`)?** Instead of scoring once with fixed `rainfall = 380 mm`, **Monte Carlo simulation** runs the engine **100 to 500 times**, adding random weather fluctuation (`±10–15%` rainfall) in every run and counting how often **Rank 1 stays #1** (e.g., `87% of runs`). Like chaos-testing a load balancer under noisy traffic!",
            ],
        )
    )

    # =========================================================================
    # PART 1
    # =========================================================================
    elements.append(make_heading("Part 1: Agronomy & Satellite Glossary for Computer Scientists", level=1))
    elements.append(
        make_callout(
            "The Core Systems Analogy: A Farm Plot is a Stateful Server",
            [
                "**Soil Nitrogen (`N`) & Organic Carbon (`SOC`)** = The server's **UPS Battery & Disk Write Cache**.",
                "**Rainfall & Soil Moisture minus Evapotranspiration (`ET`)** = The **Power & Cooling Budget**.",
                "**Soil-Borne Pests, Fungi & Parasitic Weeds** = **Family-Specific Malware** that persists across reboots if you run the same OS (`Botanical Family`) twice in a row.",
                "**A 3-Year Crop Rotation (`Y1 -> Y2 -> Y3`)** = A **3-Year Cron Job Schedule** that balances high-revenue GPU workloads (`Heavy Feeders`) with battery-recharging background jobs (`Legumes`) and cache-defragmenting jobs (`Break Crops / Oilseeds`).",
            ],
        )
    )

    # Section 1.1
    elements.append(make_heading("1.1 Satellite & Climate Terms (NASA Earth Observation Data)", level=2))
    elements.append(
        make_table(
            headers=["Term", "Plain Agronomy Definition", "Computer Science / Systems Analogy", "Range & Units"],
            col_widths_pct=[20, 36, 28, 16],
            rows=[
                [
                    "**NDVI** (*Normalized Difference Vegetation Index*)",
                    "Satellite measure of how green and dense plant leaves are, computed from Near-Infrared (`NIR`) and Red light: `NDVI = (NIR - Red) / (NIR + Red)`. Healthy chlorophyll absorbs `Red` for photosynthesis and reflects `NIR`.",
                    "**External Telemetry / CPU Throughput Utilization.** High spring peak `NDVI` means crops in that 250m pixel grew vigorously; high year-to-year variance (`CV`) signals unstable yields.",
                    "`-1.0` to `+1.0` (`< 0.2` bare soil; `0.3–0.5` sparse crop; `0.6–0.85` dense crop)",
                ],
                [
                    "**Evapotranspiration (`ET0` / `ETc`)**",
                    "Simply put: **total water leaving the field into the air each day**. It adds **Evaporation (`E`)** (water drying straight out of warm soil, like a puddle in the sun) + **Transpiration (`T`)** (water plants drink via roots and breathe out through leaves to cool down). **`ET0`** = daily water loss of standard short green grass in that weather; **`ETc`** = your crop's need (`ETc = ET0 × Kc`), e.g. sunflower drinks far more than barley.",
                    "**System Power Draw / Bank Withdrawals.** Think of **Rainfall** as deposits into the soil bank account and **`ETc`** as daily withdrawals. Even if `380 mm` falls, high `ET` drains moisture before roots can use it.",
                    "`mm/day` or `mm/season` (`300–450` barley, `350–500` wheat, `600–1000` sunflower)",
                ],
                [
                    "**Water Stress Index (`s`)**",
                    "Relative rainfall deficit below the regional reference requirement (`Rain_ref = 400 mm`): `s = clamp((Rain_ref - Rain) / Rain_ref, 0, 1)`.",
                    "**Memory / Resource Pressure (`0%` = plenty of RAM, `100%` = OOM throttling).** As `s` rises, the engine shifts weight from yield to water efficiency and stability.",
                    "`0.0` (no stress) to `1.0` (severe drought)",
                ],
                [
                    "**Hot Days (`> 35 °C`)**",
                    "Annual count of days where daily max temperature (`T2M_MAX`) exceeds `35 °C`. During spring **grain filling** (when wheat kernels fill with starch), `> 35 °C` denatures enzymes and shrivels grain.",
                    "**Thermal Throttling during a critical disk write operation.**",
                    "`days/year`",
                ],
                [
                    "**Frost Days (`< 0 °C`)**",
                    "Annual count of days where daily min temperature (`T2M_MIN`) drops below `0 °C`. Late spring radiation frost kills flowers on winter legumes (chickpea, lentil, faba bean).",
                    "**Sudden voltage brownout during service initialization.**",
                    "`days/year`",
                ],
                [
                    "**Longest Dry Spell & `PRECTOTCORR`**",
                    "Maximum consecutive days with `< 1 mm` of rain (`PRECTOTCORR < 1.0`). **`PRECTOTCORR`** is the standard variable name from **NASA POWER** (*Prediction Of Worldwide Energy Resources*), representing **bias-corrected total daily precipitation** in millimeters (`mm/day`).",
                    "**Longest network outage window** the crop's root buffer must survive without rain packets arriving.",
                    "`consecutive days` (`PRECTOTCORR` in `mm/day`)",
                ],
                [
                    "**Mann-Kendall & Sen's Slope (`Trend Confidence`)**",
                    "Two statistical trend tests on 30-year climate series: Ordinary Least Squares (`OLS`, parametric line fit) vs. Mann-Kendall / Sen's Slope (non-parametric rank test robust to outliers). When both show `p < 0.05` with the same sign, the UI reports `both methods agree`; otherwise `no clear trend`.",
                    "**Consensus check between two independent anomaly detectors** before paging on-call.",
                    "`mm/decade` + confidence badge",
                ],
            ],
        )
    )

    # Section 1.2
    elements.append(make_heading("1.2 Soil Chemistry & Nutrient Terms (ISRIC SoilGrids & DharaaAI)", level=2))
    elements.append(
        make_table(
            headers=["Term", "Plain Agronomy Definition", "Computer Science / Systems Analogy", "Range & Units"],
            col_widths_pct=[20, 36, 28, 16],
            rows=[
                [
                    "**SOC** (*Soil Organic Carbon*)",
                    "Carbon stored in decaying roots, crop stubble, and humus in the top `0–30 cm` of soil. Acts like a sponge that holds rainwater and feeds soil microbes.",
                    "**L2 Disk Cache + UPS Battery Capacity.** Low `SOC` (`< 10 g/kg`) means heavy rain runs off the surface instead of infiltrating into the root zone.",
                    "`g/kg` (`SoilGrids` returns `dg/kg`, so divide by `10`; `10 g/kg = 1%` SOC)",
                ],
                [
                    "**SOM** (*Soil Organic Matter*)",
                    "Total organic matter weight in soil. Related to `SOC` by the van Bemmelen factor: `SOM ≈ 1.724 × SOC`.",
                    "**Total allocated container size** vs. raw payload (`SOC`). Never mix `SOC` and `SOM` without applying the `1.724` factor.",
                    "`%` or `g/kg`",
                ],
                [
                    "**250 m Soil Estimate**",
                    "A modelled spatial average for a `250 m × 250 m` grid cell from global ML (`SoilGrids`), **not** a physical lab measurement of one farmer's plot.",
                    "**Cluster-level telemetry average**, not a single-container probe. Always disclose this limitation in `gaps.json`.",
                    "`250 m` pixel",
                ],
                [
                    "**N, P, K** (*Nitrogen, Phosphorus, Potassium*)",
                    "The 3 primary macro-nutrients: **N** builds leaf chlorophyll and grain protein; **P** powers root growth, ATP energy, and flowering; **K** regulates stomatal water balance and stalk strength.",
                    "**CPU (`N`), Disk I/O (`P`), and Network Bandwidth (`K`).** By *Liebig's Law of the Minimum*, whichever resource hits zero first caps total system throughput.",
                    "`kg/ha` (or `mg/kg` / `ppm`)",
                ],
                [
                    "**Commercial Fertilizers (`Urea`, `DAP`, `MOP`, `NPK 10:26:26`)**",
                    "Synthetic nutrient bags: **Urea** (`46% N`), **DAP** (Diammonium Phosphate, `18% N, 46% P2O5`), **MOP** (Muriate of Potash, `60% K2O`), **NPK 10:26:26** (balanced basal fertilizer).",
                    "**Paid on-demand Cloud Burst credits.** Expensive in cash and carbon footprint; planting a legume pre-charges `N` so the farmer buys `-30%` less synthetic fertilizer next year.",
                    "`kg/ha` applied per season",
                ],
                [
                    "**Soil `pH` (`phh2o`)**",
                    "Logarithmic measure of soil acidity (`< 6.0`), neutrality (`6.5–7.5`), or alkalinity (`> 7.8`, common in North African limestone/calcareous soils). High `pH` chemically locks up Phosphorus and iron.",
                    "**File permission / protocol mismatch:** the nutrient (`P`) is physically on disk, but roots cannot read it outside `pH 6.0–7.8`.",
                    "`3.0–10.0` (`SoilGrids` reports `pH × 10`, so `79 = pH 7.9`)",
                ],
            ],
        )
    )

    # Section 1.3
    elements.append(make_heading("1.3 Crop Families & Rotation Mechanics (CropSense & Agronomy)", level=2))
    elements.append(
        make_table(
            headers=["Term", "Plain Agronomy Definition", "Computer Science / Systems Analogy", "Examples"],
            col_widths_pct=[20, 38, 26, 16],
            rows=[
                [
                    "**Botanical Family (`family`)**",
                    "Taxonomic group of crops that share root architecture, nutrient demands, and susceptibility to the same soil fungi, nematodes, and weeds.",
                    "**OS Kernel / Runtime Family.** Running two workloads from the same family back-to-back lets family-specific malware multiply exponentially.",
                    "`cereal` (*Poaceae*), `legume` (*Fabaceae*), `oilseed` (*Brassicaceae* / *Asteraceae*)",
                ],
                [
                    "**Cereals (Grains)**",
                    "Grass-family crops grown for starch grain and livestock straw. Deliver reliable calories and high **residue carbon** (stubble), but deplete soil Nitrogen.",
                    "**Steady production worker nodes** that drain battery (`N`) but write durable recovery logs (`residue_carbon`).",
                    "Durum wheat (`wheat`), barley, oats, maize, rice",
                ],
                [
                    "**Legumes (Pulses)**",
                    "Pod-bearing crops whose roots form symbiotic nodules with *Rhizobium* bacteria, fixing atmospheric Nitrogen gas (`N2`) into plant-available ammonium (`+20` to `+40 kg N/ha`).",
                    "**Solar charger + garbage collector** that recharges the soil `N` battery for the next cereal crop.",
                    "Chickpea, lentil, faba bean (`faba`), field pea, soybean",
                ],
                [
                    "**Oilseeds (Break Crops)**",
                    "Broadleaf crops pressed for cooking/industrial oil. Their deep taproots break compacted hardpan layers (`plow pan`) and starve cereal-specific root fungi.",
                    "**Disk defragmenter & cache sanitizer** inserted between cereal runs.",
                    "Rapeseed (`canola`), sunflower",
                ],
                [
                    "**Heavy Feeders (`soil_depletion_index >= 4`)**",
                    "High-biomass crops that extract large quantities of Nitrogen (`-35` to `-50 kg N/ha`), Phosphorus, and water in a single season.",
                    "**Heavy GPU training job**—high revenue, but drains the battery. Never schedule two back-to-back without a legume recharge.",
                    "Durum wheat, maize, cotton, rice, potato",
                ],
                [
                    "**Monoculture**",
                    "Planting the exact same crop (or continuous cereal-after-cereal) year after year on the same plot.",
                    "**Infinite loop with a memory leak.** Yield decays every cycle while chemical fertilizer and fungicide costs spiral upward.",
                    "`Wheat -> Wheat -> Wheat` or `Wheat -> Barley -> Oats`",
                ],
                [
                    "**Lodging, Shattering, Fusarium, Ascochyta, Broomrape**",
                    "Field failure modes: **Lodging** = tall stems falling flat in wind/rain (`oats`); **Shattering** = dry seed pods bursting open before harvest (`canola`); **Fusarium / Ascochyta** = fungal blights in wet springs; **Broomrape (*Orobanche*)** = root-parasitic weed attacking legumes and sunflower.",
                    "**Documented runtime exceptions** surfaced in each crop's `risk_note` and in the `Crops to Avoid` warning panel.",
                    "Surfaced in Screen 3 (`Rotation Ranking`) & Screen 4 (`Comparison`)",
                ],
            ],
        )
    )

    # =========================================================================
    # PART 2
    # =========================================================================
    elements.append(make_heading("Part 2: Complete Data Collection Checklist (5 Production Datasets)", level=1))
    elements.append(
        make_paragraph(
            "To transition from labelled mock inputs to a competition-winning production dataset for Algerian/Mediterranean agricultural regions (**Setif High Plains**, **Mitidja Coastal Plain**, **Tiaret Semi-Arid Cereal Belt**), collect the following **5 datasets**:"
        )
    )

    elements.append(
        make_table(
            headers=["Dataset #", "Source / API", "Target File in Repo", "Role in Hybrid Engine v3"],
            col_widths_pct=[14, 30, 26, 30],
            rows=[
                [
                    "**Dataset 1**",
                    "NASA POWER Agro-Climatology Daily API (`30 years: 1995–2024`)",
                    "`data/inputs/indicators.json`",
                    "Drives Water Stress (`s`), Climate Trend charts, Frost/Heat risk alerts, and Monte Carlo rainfall perturbation.",
                ],
                [
                    "**Dataset 2**",
                    "NASA MODIS `MOD13Q1` / VIIRS `250 m` 16-Day `NDVI` (via AppEEARS / GEE)",
                    "`data/inputs/indicators.json` (`yield_baseline`)",
                    "Calibrates regional biomass productivity (`yield_baseline`) and historical yield stability (`CV`).",
                ],
                [
                    "**Dataset 3**",
                    "ISRIC SoilGrids v2.0 REST API (`0–30 cm` depth-weighted)",
                    "`data/processed/{region}/soil.json`",
                    "Provides baseline `soc_g_kg`, `ph`, and starting soil Nitrogen (`kg/ha`) for the 3-year state simulator.",
                ],
                [
                    "**Dataset 4**",
                    "`CropSense` Historical Field Records (`2,200 rows` + FAO EcoCrop envelopes)",
                    "`CropSense/data/Crop_recommendation.csv`",
                    "Trains the KNN Environmental Suitability matcher (`knn_env_match_pct`) across `(N, P, K, temp, humidity, pH, rain)`.",
                ],
                [
                    "**Dataset 5**",
                    "Unified Agronomic Crop Catalog (`v2` + `CropSense` + `DharaaAI`)",
                    "`data/inputs/crops.csv`",
                    "Supplies `soil_depletion_index`, `nitrogen_impact_kg_ha`, `base_npk_kg_ha`, water/drought scores, and `risk_note`.",
                ],
            ],
        )
    )

    elements.append(make_heading("2.1 Dataset 1 — NASA POWER Agro-Climatology (Climate Changes & Water Stress)", level=2))
    elements.append(
        make_bullet(
            "**Endpoint (Free, No API Key Required):** `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M,EVPTRNS&community=AG&longitude=5.41&latitude=36.19&start=19950101&end=20241231&format=JSON`"
        )
    )
    elements.append(
        make_bullet(
            "**CS Data Gotcha:** Missing days are encoded as **`-999`**. Always filter `val != -999` before aggregating, or averages will corrupt."
        )
    )
    elements.append(make_bullet("**How we process & use each field in code (Achref's pipeline -> `indicators.json`):**"))
    elements.append(make_bullet("`PRECTOTCORR` (`mm/day`): Sum per year -> 30-yr `rainfall_mm`; bin by month -> `monthly_rain_mm` (12-bar chart); compute `water_stress = clamp((rain_ref - rain_recent) / rain_ref, 0, 1)` to scale the Water weight `(1 + K_WATER * water_stress)`.", level=1))
    elements.append(
        make_bullet(
            "`rainfall_trend_decade_mm`: Linear OLS slope (`mm/yr × 10`) paired with Mann-Kendall/Sen's slope (`p < 0.05` consensus check -> `\"both methods agree\"` vs `\"no clear trend\"`).",
            level=1,
        )
    )
    elements.append(make_bullet("`T2M_MAX > 35 °C` -> `hot_days` (wheat grain-filling heat alert); `T2M_MIN < 0 °C` -> `frost_days` (legume flower frost alert).", level=1))
    elements.append(make_bullet("`PRECTOTCORR > 20 mm` -> `extreme_rain_days`; max consecutive `< 1 mm` -> `longest_dry_spell_days`.", level=1))

    elements.append(make_heading("2.2 Dataset 2 — NASA MODIS / VIIRS Vegetation Index (Yield Baseline)", level=2))
    elements.append(
        make_bullet(
            "**Where to fetch:** NASA AppEEARS (`https://appeears.earthdatacloud.nasa.gov/`) or Google Earth Engine collection `MODIS/061/MOD13Q1` (`250 m` spatial resolution, 16-day composite `NDVI`)."
        )
    )
    elements.append(
        make_bullet(
            "**CS Data Gotchas:** Raw MODIS `NDVI` integers are scaled by **`10000`** (`5400` = `0.54`). You **must mask pixels** with **ESA WorldCover 10m (`class 40 = Cropland`)** so urban and forest pixels do not skew farm `NDVI`."
        )
    )
    elements.append(
        make_bullet(
            "**How we use it in code:** Extract spring peak `NDVI` (`March–May` for Mediterranean winter crops), normalize `0.25–0.75 -> [0.0, 1.0]` as `yield_baseline` in `indicators.json`, and compute Coefficient of Variation (`CV = std / mean`) as historical biomass instability."
        )
    )

    elements.append(make_heading("2.3 Dataset 3 — ISRIC SoilGrids v2.0 (Topsoil 0–30 cm Carbon, pH & Nitrogen)", level=2))
    elements.append(
        make_bullet(
            "**Script already built in repo:** `scripts/fetch_soilgrids.py` queries `https://rest.isric.org/soilgrids/v2.0/properties/query` and outputs `data/processed/regionX/soil.json`."
        )
    )
    elements.append(
        make_bullet(
            "**Depth-Weighted Formula (`0–30 cm` topsoil):** Combines `0–5 cm`, `5–15 cm`, and `15–30 cm` with thickness weights `5 : 10 : 15` (`total = 30 cm`) and divides `dg/kg` by `10` to get `g/kg`: `SOC_0_30 (g/kg) = ((5 × L_0_5 + 10 × L_5_15 + 15 × L_15_30) / 30) / 10`."
        )
    )
    elements.append(
        make_bullet(
            "**How we use it in code:** Maps `soc_g_kg` to `soil_stress` (`low < 10 g/kg -> 1.0`, `medium 10–20 -> 0.5`, `high > 20 -> 0.0`), scaling the Soil weight `(1 + K_SOIL * soil_stress)` and initializing `Soil Health %` in the 3-year trajectory simulator."
        )
    )

    elements.append(make_heading("2.4 Dataset 4 — Regional Crop Table & Agronomic Rules (FAOSTAT + FAO EcoCrop)", level=2))
    elements.append(
        make_bullet(
            "**Where to source for Algeria / Mediterranean (instead of `CropSense`'s 22 Indian crops):** (1) **FAOSTAT** (`fao.org/faostat`) for top regional cereals (`durum wheat`, `barley`, `oats`) and legumes (`chickpea`, `lentil`, `faba bean`); (2) **FAO EcoCrop** for optimal rainfall, temperature, and `pH` envelopes; (3) **ITGC Algeria / ICARDA extension sheets** for `rules.json` and `risk_note` strings."
        )
    )
    elements.append(
        make_bullet(
            "**How we use it in code:** `rules.json` filters `n^3` combinations (`64 -> 24` legal rotations) in Stage 1 and builds the `'Rotations & Crops to Avoid'` panel. `crops.csv` drives `water`, `soil`, and `yield` marks, contextual tags, and 3-year NPK fertilizer simulation."
        )
    )

    elements.append(make_heading("2.5 Dataset 5 — Data Limitations & Honesty Metadata (gaps.json)", level=2))
    elements.append(
        make_bullet(
            "**What it is & how we use it:** Authored with `Nazim` & `Achref` to document spatial/model gaps (e.g., `250 m SoilGrids cell is a regional average, not a field lab NPK test`, `NASA POWER 0.5° grid smooths micro-valleys`). Every `E5` explanation pulls directly from `gaps.json`—zero hardcoded free text."
        )
    )

    # =========================================================================
    # PART 3
    # =========================================================================
    elements.append(make_heading("Part 3: Upgrading the Engine from Pure Rules to Hybrid AI/ML", level=1))
    elements.append(
        make_callout(
            "Why Hybrid AI Beats Pure Rules or Pure Black-Box ML in Agriculture",
            [
                "**Pure Rule Engines** are transparent and safe, but cannot model continuous climate-soil distance or pairwise multi-feature interactions.",
                "**Pure Black-Box ML** (without agronomic guardrails) frequently recommends illegal rotations—such as scheduling two heavy-feeding cereals back-to-back because both match the current year's rainfall.",
                "**The Gold-Standard Hybrid Architecture** (used in industrial decision-support systems like DSSAT, APSIM, and CropSense) combines **Hard Agronomic Constraints (Stage 1)** + **KNN Environmental Similarity (Stage 2)** + **Random Forest Pairwise Transition Scoring (Stage 3)** + **Stateful Soil & Fertilizer Simulation (Stage 4)** + **Monte Carlo Climate Stability (Stage 5)**.",
            ],
        )
    )

    elements.append(make_heading("3.1 The 5-Stage Hybrid Engine Pipeline Architecture", level=2))
    elements.append(
        make_table(
            headers=["Stage", "Module / Function in scoring.py", "Inputs", "Algorithm / Mathematical Logic", "Outputs to UI"],
            col_widths_pct=[11, 23, 20, 28, 18],
            rows=[
                [
                    "**Stage 1**",
                    "**Hard Agronomic Constraint Solver** (`passes_hard_rules` & `build_avoid_list`)",
                    "Candidate 3-yr sequence `(c1, c2, c3)`, `rules.json`, previous crop",
                    "Rejects monocultures, consecutive same-family transitions (`c1.family == c2.family`), missing legumes (`min_legumes_in_3yr = 1`), and back-to-back heavy feeders.",
                    "Valid candidate pool + **🚫 Rotations & Crops to Avoid** list with reasons",
                ],
                [
                    "**Stage 2**",
                    "**KNN Environmental Suitability** (`ml_transition_and_env_scores`)",
                    "Regional `rainfall_mm`, `soc_g_kg`, `ph`, crop niche envelope",
                    "Computes normalized feature-space similarity (matching `CropSense`'s `scaler.pkl` + `knn_model.pkl` distance metric) between field conditions and crop requirements.",
                    "`knn_env_match_pct` (`0–100%`) mini-stat bar on each card",
                ],
                [
                    "**Stage 3**",
                    "**Pairwise ML Transition Ranker** (`ml_transition_and_env_scores` & `agronomic_tags`)",
                    "Cyclic pairs `(Y1->Y2, Y2->Y3, Y3->Y1)`",
                    "Evaluates `CropSense` engineered transition features: `depletion_delta = prev.depletion - next.depletion`, `nitrogen_restoration = (prev.depletion >= 3 and next.n_fixer == 1)`, water/drought harmony, and family diversity.",
                    "`ml_transition_pct` (`0–100%`) + contextual tags (`🌿 Restores Nitrogen`, `✅ Ideal after Heavy Feeder`)",
                ],
                [
                    "**Stage 4**",
                    "**3-Year Soil & NPK State Simulator** (`simulate_3yr_trajectory`)",
                    "Starting `N` (`kg/ha`), `SOC`, sequence `(c1, c2, c3)`",
                    "Steps forward `Year 1 -> Year 2 -> Year 3` (`DharaaAI` state equation): updates `N_t = clamp(N_{t-1} + delta_N, 15, 220)`, `Health_t`, and cuts next year's synthetic `NPK` dose by `-30%` after a legume.",
                    "`trajectory_3yr` strip (`N kg/ha`, `Health %`, `NPK kg/ha`) + `fertilizer_saved_vs_existing_kg_ha`",
                ],
                [
                    "**Stage 5**",
                    "**Stress-Adaptive Multi-Objective Scorer & Monte Carlo** (`score_plan` & `recommend`)",
                    "User sliders `(w_y, w_w, w_s)`, Water Stress `s`, `N=100` climate runs",
                    "Shifts weights under water stress (`s`), scores Yield/Water/Soil+Profit (`TOTAL = 0.598371` baseline verified), and perturbs rainfall `±15%` to measure how often Rank 1 stays #1.",
                    "`final_score_pct`, `ranking_stability_pct`, and `Usual vs. Rank 1` comparison table",
                ],
            ],
        )
    )

    elements.append(make_heading("3.2 How the 4 Merged Repo Additions Work in Code & UI", level=2))
    elements.append(
        make_bullet(
            "**Addition 1 — Contextual Agronomic Badges & Split ML Scores (`CropSense`):** Every crop step in a rotation displays dynamic tags (`🌿 Restores Nitrogen`, `✅ Ideal after Heavy Feeder`, `💧 Low Water`, `☀️ Drought Tolerant`, `💰 High Profit`, `⚠️ Depletes Soil`, `🚫 Monoculture`), and each rank card shows 3 progress bars: **Final Score %**, **ML Transition Confidence %**, and **KNN Env Match %**."
        )
    )
    elements.append(
        make_bullet(
            "**Addition 2 — 3-Year Soil Nitrogen, Health & NPK Trajectory (`DharaaAI`):** Each ranked card includes a 3-column `Year 1 -> Year 2 -> Year 3` state projection showing exact soil Nitrogen (`kg/ha`), Soil Health (`%`), and synthetic NPK dosage (`kg/ha`), highlighting `-30%` legume carryover credits."
        )
    )
    elements.append(
        make_bullet(
            "**Addition 3 — Synthetic Fertilizer Savings in Usual vs. Rank 1 (`DharaaAI` FastAPI):** Screen 4 (`Usual vs. Rank 1`) compares cumulative 3-year synthetic fertilizer requirements (`Urea + DAP + MOP kg/ha`) between the farmer's current rotation and Rank 1, showing exact `kg/ha` saved."
        )
    )
    elements.append(
        make_bullet(
            "**Addition 4 — '🚫 Rotations & Crops to Avoid This Season' Warning Panel (`CropSense` + `DharaaAI`):** Screen 3 (`Rotation Ranking`) includes a dedicated red alert panel listing rejected multi-year plans (e.g., continuous cereals, missing legumes) and specific single crops to avoid immediately after the farmer's Year-3 crop."
        )
    )

    # =========================================================================
    # PART 4
    # =========================================================================
    elements.append(make_heading("Part 4: APIs Needed, Best CS Tools & Code Examples", level=1))
    elements.append(
        make_heading("4.1 External APIs Overview (Role, Data Returned & Gotchas)", level=2)
    )
    elements.append(
        make_table(
            headers=["API / Platform", "Role in Field Shift", "Variables Requested", "What It Adds to Repo", "Critical Gotchas"],
            col_widths_pct=[19, 19, 20, 21, 21],
            rows=[
                [
                    "**1. NASA POWER REST API** (`power.larc.nasa.gov`)",
                    "30-year daily weather & climate trends (`1995–2024`)",
                    "`PRECTOTCORR`, `T2M_MAX`, `T2M_MIN`, `RH2M`, `EVPTRNS`",
                    "`rainfall_mm`, `water_stress`, `monthly_rain_mm`, `hot_days`, `frost_days`, `longest_dry_spell_days`, Mann-Kendall trends",
                    "Missing days = **`-999`** (must filter!). `0.5°` grid (~55 km) smooths valleys. Free, no API key.",
                ],
                [
                    "**2. NASA AppEEARS** or **Google Earth Engine (`MOD13Q1`)**",
                    "Satellite vegetation vigour / yield baseline (`250 m`, 16-day `NDVI`)",
                    "`_250m_16_days_NDVI`, QA band + **ESA WorldCover `class 40`**",
                    "`yield_baseline` (`0–1` normalized spring peak `NDVI`) + yield `CV`",
                    "Raw MODIS `NDVI` is scaled by **`10000`** (`5400 = 0.54`). Mask non-cropland (`class 40`)!",
                ],
                [
                    "**3. ISRIC SoilGrids v2.0** (`rest.isric.org`)",
                    "Topsoil chemistry (`0–30 cm` depth-weighted)",
                    "`soc`, `phh2o`, `nitrogen`, `clay` (`0-5`, `5-15`, `15-30 cm`)",
                    "`soil.json` -> `soc_g_kg`, `soil_stress`, `ph`, starting `Soil Health %`",
                    "Divide `soc` & `phh2o` by **`10`**. Often returns `503` (use retry + JSON cache). `250 m` estimate, not field NPK.",
                ],
                [
                    "**4. Open-Meteo Forecast** *(Optional)* (`api.open-meteo.com`)",
                    "Live 7–16 day forecast & daily `ET0`",
                    "`precipitation_sum`, `et0_fao_evapotranspiration`, `soil_moisture`",
                    "Real-time seasonal alert panel alongside 30-yr climatology",
                    "Short-range forecast only; keep NASA POWER for 30-year climate trends.",
                ],
                [
                    "**5. Local Static Tables** (`crops_algeria.csv`, `rules_algeria.json`)",
                    "FAO Paper 56, ICARDA BNF, ITGC rules, OAIC/CCLS `DA/q`",
                    "Agronomic bounds, `ETc`, NPK doses, Algerian prices",
                    "`crops`, `rules`, `gaps`, `regions` (0 ms offline-safe)",
                    "Verify OAIC/CCLS campaign floor prices each season (`needs local review`).",
                ],
            ],
        )
    )

    elements.append(make_heading("4.2 Best Python & CS Libraries to Use", level=2))
    elements.append(
        make_table(
            headers=["Layer", "Best Tool / Package", "Why Use It in Field Shift"],
            col_widths_pct=[22, 30, 48],
            rows=[
                ["**Satellite `NDVI`**", "`earthengine-api` (`ee`) + `geemap` *(or `earthaccess` + `rioxarray`)*", "Computes WorldCover-masked spring peak `NDVI` in ~15 lines in the cloud without downloading 40 GB of HDF files."],
                ["**HTTP & Retries**", "`httpx` *(or `requests` + `urllib3.Retry`)*", "Clean timeouts, exponential backoff on SoilGrids `503` errors, and disk caching in `data/processed/`."],
                ["**Climate Stats**", "`pandas`, `numpy`, `scipy.stats`, `pymannkendall`", "`pymannkendall.original_test(series)` computes Mann-Kendall + Sen's slope in 1 line to compare with OLS."],
                ["**Hybrid ML**", "`scikit-learn` (`StandardScaler`, `KNeighborsClassifier`)", "Trains cleanly from CSV in memory—avoid loading untrusted `.pkl` files."],
                ["**Backend & QA**", "`FastAPI` + `pydantic` + `pytest`", "Typed `/recommend` JSON API for Mehdi + automated hand-calc verification via `pytest`."],
            ],
        )
    )

    elements.append(make_heading("4.3 Copy-Paste Python Examples", level=2))
    elements.append(
        make_code_block(
            "Example 1: NASA POWER 30-Year Fetch, -999 Cleaning & Mann-Kendall Consensus (Achref)",
            """import numpy as np, pandas as pd, pymannkendall as mk, requests
from scipy.stats import linregress

def fetch_nasa_power(lat: float, lon: float, start="19950101", end="20241231") -> dict:
    url = "https://power.larc.nasa.gov/api/temporal/daily/point"
    params = {"parameters": "PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M", "community": "AG",
              "longitude": lon, "latitude": lat, "start": start, "end": end, "format": "JSON"}
    raw = requests.get(url, params=params, timeout=30).json()["properties"]["parameter"]
    df = pd.DataFrame(raw).replace(-999.0, np.nan).dropna()
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df["year"] = df.index.year
    annual_rain = df.groupby("year")["PRECTOTCORR"].sum()
    ols = linregress(annual_rain.index.to_numpy(), annual_rain.to_numpy())
    mk_res = mk.original_test(annual_rain.to_numpy())
    agree = (ols.pvalue < 0.05) and (mk_res.p < 0.05) and (np.sign(ols.slope) == np.sign(mk_res.slope))
    rain_ref = float(annual_rain.iloc[:-5].mean())
    water_stress = float(np.clip((rain_ref - annual_rain.iloc[-5:].mean()) / rain_ref, 0.0, 1.0))
    return {"rainfall_mm": round(float(annual_rain.mean()), 1), "water_stress": round(water_stress, 3),
            "trend_decade_mm": round(float(mk_res.slope * 10), 1),
            "trend_confidence": "both methods agree" if agree else "no clear trend"}""",
        )
    )
    elements.append(
        make_code_block(
            "Example 2: MODIS MOD13Q1 Spring Peak NDVI Masked to Cropland (Google Earth Engine)",
            """import ee

def fetch_cropland_ndvi(lat: float, lon: float) -> float:
    ee.Initialize()
    aoi = ee.Geometry.Point([lon, lat]).buffer(15000)
    cropland = ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").eq(40)
    modis = ee.ImageCollection("MODIS/061/MOD13Q1").filterBounds(aoi).select("NDVI")
    spring_peak = modis.filterDate("2020-03-01", "2024-05-31").max().multiply(0.0001).updateMask(cropland)
    mean_ndvi = spring_peak.reduceRegion(ee.Reducer.mean(), aoi, 250, maxPixels=1e7).get("NDVI").getInfo()
    return round(max(0.0, min(1.0, (float(mean_ndvi) - 0.25) / 0.50)), 3)  # yield_baseline""",
        )
    )
    elements.append(
        make_code_block(
            "Example 3: FastAPI /recommend + Seeded 500-Run Monte Carlo Stability (Mehdi & Alaa)",
            """import random
from fastapi import FastAPI
from pydantic import BaseModel
from engine import scoring

app = FastAPI(title="Field Shift API")

class Req(BaseModel):
    priorities: dict[str, float]
    indicators: dict
    current_rotation: list[str]
    runs: int = 500

@app.post("/recommend")
def recommend(req: Req):
    base = scoring.recommend(req.priorities, req.indicators, req.current_rotation)
    top1 = base["strategies"][1]["rotation"]
    rng = random.Random(42)
    wins = 0
    for _ in range(req.runs):
        noisy = dict(req.indicators, rainfall_mm=req.indicators["rainfall_mm"] * rng.uniform(0.85, 1.15))
        if scoring.recommend(req.priorities, noisy, req.current_rotation)["strategies"][1]["rotation"] == top1:
            wins += 1
    base["ranking_stability_pct"] = round(100.0 * wins / req.runs, 1)
    return base""",
        )
    )

    elements.append(make_heading("Part 5: Backend REST APIs We Must Create (Field Shift API Blueprint)", level=1))
    elements.append(
        make_paragraph(
            "Right now, `server.py` implements 3 starter routes (`GET /indicators/{region}`, `POST /recommend`, `POST /validate-crop`) using Python stdlib `ThreadingHTTPServer`, while the static web UI runs in browser JS. To turn **Field Shift** into a production multi-user backend (supporting mobile apps, custom GPS coordinates, saved rotations, and PDF reports), build the **8 FastAPI + Pydantic v2 endpoints** below."
        )
    )
    elements.append(make_heading("5.1 Current vs. Target Backend Endpoints", level=2))
    elements.append(
        make_table(
            headers=["Endpoint", "Status", "Role & Behavior", "Inputs", "Response & Status Codes"],
            col_widths_pct=[18, 15, 25, 20, 22],
            rows=[
                ["**`GET /health`**", "To Create", "Liveness probe; verifies dataset load & cache readiness.", "None", "`200 OK`: `{status, version, regions_loaded, crops_loaded}`"],
                ["**`GET /regions`**", "To Create", "Lists benchmark Algerian regions (`regionA` Sétif, `regionB` Constantine, `regionC` Tiaret) dynamically.", "None", "`200 OK`: region list with coordinates, rain, SOC, pH"],
                ["**`GET /indicators/{id}`**", "Implemented -> Harden", "Returns cached NASA POWER climate, SoilGrids `0–30 cm`, MODIS `yield_baseline`, and trend confidence.", "Path: `region_id`", "`200 OK` telemetry JSON; `404` if unknown"],
                ["**`POST /parcel/indicators`**", "To Create (Priority)", "Dynamic GPS lookup via NASA POWER + SoilGrids + MODIS for *any* coordinate in Algeria (`0.1°` cache).", "`{lat, lon}`", "`200 OK` parcel telemetry; `422` out-of-bounds; `503` timeout"],
                ["**`GET /crops`**", "To Create", "Serves all 13 calibrated Algerian crops (`OAIC/CCLS` `DA/q`, FAO `ETc`, NPK) + custom crops.", "Query: `?region=...`", "`200 OK`: crop catalog + compatibility flags"],
                ["**`POST /validate-crop`**", "Implemented -> Harden", "Regional Compatibility Gate: checks rainfall `>=90%` min, pH `±0.3`, frost days, heat days, family.", "`{region, crop}`", "`200 OK`: `{compatible, status, blockers, warnings}`"],
                ["**`POST /recommend`**", "Implemented -> Harden", "Hybrid ranking + stress-adjusted weights + 3-yr NPK savings + seeded Monte Carlo stability + avoid list.", "`{region, priorities, current_rotation, custom_crops}`", "`200 OK` full ranked plan; `400` if custom crop blocked"],
                ["**`POST /scenario`**", "To Create", "Climate What-If Stress Test comparing baseline vs. drought (`-20%` rain) & warming (`+2°C`) shifts.", "`{region, priorities, current_rotation, rainfall_delta_pct}`", "`200 OK`: `{baseline, scenario, ranking_changed}`"],
                ["**`POST /plans` & `GET /reports/*.pdf`**", "To Create (Phase 2)", "Persists chosen 3-year plans & custom crops in Postgres/SQLite (replacing `localStorage`) + exports bilingual FR/AR PDFs.", "`{farm_id, region, chosen_rotation}`", "`201 Created` (`POST`), `200 OK` (`GET`), `404` missing"],
            ],
        )
    )
    elements.append(make_heading("5.2 Engineering Rules for the Backend API", level=2))
    for item in [
        "**Strict Pydantic v2 Validation:** Reject negative rainfall, `pH < 3.5` or `> 9.5`, `len(current_rotation) != 3`, or coordinates outside Algeria (`lat 18.9–37.2`, `lon -8.7–12.0`) with HTTP `422`.",
        "**CORS & Auth Readiness:** Configure `CORSMiddleware` for `https://field-shift-crop-advisor.netlify.app` and `http://127.0.0.1:*` so frontend/mobile clients work cleanly.",
        "**Cache-First GPS Telemetry:** Round `{lat, lon}` to `0.1°` (~11 km), cache NASA POWER / SoilGrids responses (`7–30 days`), and serve stale cache if ISRIC returns `503`.",
        "**Reproducibility & Guardrails:** Cap `monte_carlo_runs <= 1000` and keep `random.Random(42)` + legume-first tie-breaking deterministic.",
    ]:
        elements.append(make_bullet(item))
    elements.append(make_heading("5.3 FastAPI Production Router Starter (`api/main.py`)", level=2))
    elements.append(
        make_code_block(
            "FastAPI Router Blueprint Connecting /health, /regions, /crops, /validate-crop & /scenario",
            """from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
import json
from engine import scoring

app = FastAPI(title="Field Shift Crop Rotation API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
INDICATORS = json.loads(Path("data/regional/all_indicators.json").read_text(encoding="utf-8"))

@app.get("/health")
def health():
    return {"status": "ok", "regions": len(INDICATORS), "crops": len(scoring.load_data()["crops"])}

@app.get("/regions")
def list_regions():
    return [{"id": k, "label": v["label"], "rainfall_mm": v["rainfall_mm"], "ph": v["ph"]} for k, v in INDICATORS.items()]

@app.get("/crops")
def list_crops(region: str | None = None):
    crops = scoring.load_data()["crops"]
    ind = INDICATORS.get(region) if region else None
    return [{"id": n, **c, **({"compatibility": scoring.check_crop_compatibility(c, ind)} if ind else {})} for n, c in crops.items()]

class ValidateReq(BaseModel):
    region: str = "regionA"
    crop: dict

@app.post("/validate-crop")
def validate_crop(req: ValidateReq):
    ind = INDICATORS.get(req.region)
    if not ind:
        raise HTTPException(status_code=404, detail="Unknown region")
    return {"region": req.region, **scoring.check_crop_compatibility(req.crop, ind)}""",
        )
    )

    # Section Properties (Page setup: A4/Letter with 0.75-inch margins)
    sect_pr = (
        '<w:sectPr>'
        '<w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" '
        'w:header="720" w:footer="720" w:gutter="0"/>'
        '</w:sectPr>'
    )
    elements.append(sect_pr)
    return "".join(elements)


def create_docx(output_path: str) -> None:
    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
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
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
  </w:style>
</w:styles>"""

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    core_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>The Computer Scientist's Guide to Agronomy, NASA Data &amp; Hybrid ML Rotation Engines</dc:title>
  <dc:subject>NASA Space Apps Challenge — Crop Rotation Advisor Technical Guide</dc:subject>
  <dc:creator>Alaa, Younes &amp; Achref</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now_iso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now_iso}</dcterms:modified>
</cp:coreProperties>"""

    body_xml = build_document_body()
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{body_xml}</w:body>'
        '</w:document>'
    )

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", rels_xml)
        zf.writestr("word/_rels/document.xml.rels", doc_rels_xml)
        zf.writestr("word/styles.xml", styles_xml)
        zf.writestr("docProps/core.xml", core_xml)
        zf.writestr("word/document.xml", document_xml)


if __name__ == "__main__":
    out_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "CS_Agronomy_and_ML_Guide.docx",
    )
    create_docx(out_file)
    print(f"Successfully generated Word document: {out_file} ({os.path.getsize(out_file):,} bytes)")
