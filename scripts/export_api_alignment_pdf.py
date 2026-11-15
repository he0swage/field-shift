#!/usr/bin/env python3
"""
Generate a clean, landscape-formatted vector PDF (PDF 1.4, pure Python stdlib)
for API_PLANS_DIFF_AND_ALIGNMENT.md -> API_Plans_Diff_and_Alignment.pdf.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PDF = ROOT / "API_Plans_Diff_and_Alignment.pdf"

PAGE_W = 841.89  # A4 Landscape
PAGE_H = 595.28
MARGIN_X = 36.0
MARGIN_TOP = 38.0
MARGIN_BOT = 36.0
CONTENT_W = PAGE_W - 2 * MARGIN_X


def to_winansi(s: str) -> bytes:
    repl = {
        "→": "->",
        "←": "<-",
        "≥": ">=",
        "≤": "<=",
        "≈": "~",
        "÷": "/",
        "–": "-",
        "—": "-",
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "…": "...",
    }
    for k, v in repl.items():
        s = s.replace(k, v)
    return s.encode("cp1252", "replace")


def pdf_escape(raw: bytes) -> bytes:
    out = bytearray()
    for b in raw:
        if b in (40, 41, 92):  # (, ), \
            out.append(92)
            out.append(b)
        else:
            out.append(b)
    return bytes(out)


def clean_md_text(text: str) -> str:
    # Strip markdown bold/code/links into clean readable plain text
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = text.replace("`", "")
    return text.strip()


def wrap_text(text: str, max_width_pt: float, font_size: float, bold: bool = False, mono: bool = False) -> list[str]:
    avg_char = font_size * (0.60 if mono else (0.58 if bold else 0.55))
    max_chars = max(8, int((max_width_pt * 0.94) / avg_char))
    lines: list[str] = []
    for raw_para in text.splitlines() or [""]:
        words = raw_para.split(" ")
        cur = ""
        for w in words:
            if not cur:
                if len(w) <= max_chars:
                    cur = w
                else:
                    # Break very long tokens cleanly at /, _, or max_chars
                    chunks = [w[i : i + max_chars] for i in range(0, len(w), max_chars)]
                    lines.extend(chunks[:-1])
                    cur = chunks[-1]
            elif len(cur) + 1 + len(w) <= max_chars:
                cur += " " + w
            else:
                lines.append(cur)
                if len(w) <= max_chars:
                    cur = w
                else:
                    chunks = [w[i : i + max_chars] for i in range(0, len(w), max_chars)]
                    lines.extend(chunks[:-1])
                    cur = chunks[-1]
        lines.append(cur)
    return lines or [""]


class PdfBuilder:
    def __init__(self) -> None:
        self.pages: list[list[bytes]] = []
        self.cur: list[bytes] = []
        self.y = PAGE_H - MARGIN_TOP
        self.new_page(first=True)

    def new_page(self, first: bool = False) -> None:
        if not first:
            self.pages.append(self.cur)
        self.cur = []
        self.y = PAGE_H - MARGIN_TOP

    def ensure_space(self, needed: float) -> None:
        if self.y - needed < MARGIN_BOT:
            self.new_page()

    def rect(self, x: float, y_bottom: float, w: float, h: float, fill: tuple[float, float, float] | None = None,
             stroke: tuple[float, float, float] | None = None, lw: float = 0.6) -> None:
        parts = [b"q\n"]
        if fill:
            parts.append(f"{fill[0]:.3f} {fill[1]:.3f} {fill[2]:.3f} rg\n".encode())
        if stroke:
            parts.append(f"{lw:.2f} w {stroke[0]:.3f} {stroke[1]:.3f} {stroke[2]:.3f} RG\n".encode())
        parts.append(f"{x:.2f} {y_bottom:.2f} {w:.2f} {h:.2f} re ".encode())
        if fill and stroke:
            parts.append(b"B\n")
        elif fill:
            parts.append(b"f\n")
        else:
            parts.append(b"S\n")
        parts.append(b"Q\n")
        self.cur.append(b"".join(parts))

    def text_line(self, x: float, y: float, txt: str, font: str = "F1", size: float = 9.0,
                  color: tuple[float, float, float] = (0.06, 0.09, 0.16)) -> None:
        esc = pdf_escape(to_winansi(txt))
        cmd = (
            f"BT /{font} {size:.1f} Tf "
            f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg "
            f"1 0 0 1 {x:.2f} {y:.2f} Tm (".encode()
            + esc
            + b") Tj ET\n"
        )
        self.cur.append(cmd)

    def draw_banner(self, title: str, subtitle: str) -> None:
        self.rect(MARGIN_X, self.y - 46, CONTENT_W, 46, fill=(0.078, 0.325, 0.176))
        self.text_line(MARGIN_X + 14, self.y - 19, title, font="F2", size=14.5, color=(1, 1, 1))
        self.text_line(MARGIN_X + 14, self.y - 36, subtitle, font="F1", size=9.0, color=(0.82, 0.98, 0.88))
        self.y -= 58

    def draw_heading(self, txt: str, level: int = 1) -> None:
        size = 12.5 if level == 1 else 10.5
        need = 26 if level == 1 else 20
        self.ensure_space(need + 30)
        self.y -= (10 if level == 1 else 6)
        self.text_line(MARGIN_X, self.y - size, txt, font="F2", size=size, color=(0.078, 0.325, 0.176))
        if level == 1:
            self.rect(MARGIN_X, self.y - size - 4, CONTENT_W, 1.2, fill=(0.086, 0.639, 0.290))
            self.y -= size + 12
        else:
            self.y -= size + 8

    def draw_table(self, headers: list[str], rows: list[list[str]], pcts: list[float]) -> None:
        col_ws = [CONTENT_W * (p / 100.0) for p in pcts]
        pad_x = 6.0
        pad_y = 5.0
        font_sz = 8.3
        line_h = 11.2

        def measure_row(cells: list[str], bold: bool) -> tuple[list[list[str]], float]:
            wrapped = [wrap_text(c, w - 2 * pad_x, font_sz, bold=bold) for c, w in zip(cells, col_ws)]
            max_lines = max(len(ls) for ls in wrapped)
            return wrapped, max_lines * line_h + 2 * pad_y

        def render_row(wrapped: list[list[str]], row_h: float, fill: tuple[float, float, float],
                       fg: tuple[float, float, float], font: str) -> None:
            x = MARGIN_X
            y_bot = self.y - row_h
            for ls, w in zip(wrapped, col_ws):
                self.rect(x, y_bot, w, row_h, fill=fill, stroke=(0.80, 0.84, 0.88), lw=0.5)
                ty = self.y - pad_y - font_sz
                for ln in ls:
                    self.text_line(x + pad_x, ty, ln, font=font, size=font_sz, color=fg)
                    ty -= line_h
                x += w
            self.y = y_bot

        hdr_wrapped, hdr_h = measure_row(headers, bold=True)
        first_wrapped, first_h = measure_row(rows[0], bold=False) if rows else ([], 0.0)
        self.ensure_space(hdr_h + first_h + 6)
        render_row(hdr_wrapped, hdr_h, fill=(0.078, 0.325, 0.176), fg=(1, 1, 1), font="F2")

        for idx, row in enumerate(rows):
            rw_wrapped, rw_h = measure_row(row, bold=False)
            if self.y - rw_h < MARGIN_BOT:
                self.new_page()
                render_row(hdr_wrapped, hdr_h, fill=(0.078, 0.325, 0.176), fg=(1, 1, 1), font="F2")
            fill = (1, 1, 1) if idx % 2 == 0 else (0.973, 0.980, 0.988)
            render_row(rw_wrapped, rw_h, fill=fill, fg=(0.06, 0.09, 0.16), font="F1")
        self.y -= 10

    def draw_code_box(self, title: str, code: str) -> None:
        lines = code.strip("\n").splitlines()
        line_h = 11.0
        box_h = 20 + len(lines) * line_h + 8
        self.ensure_space(box_h + 6)
        self.rect(MARGIN_X, self.y - box_h, CONTENT_W, box_h, fill=(0.973, 0.980, 0.988), stroke=(0.80, 0.84, 0.88), lw=0.6)
        self.rect(MARGIN_X, self.y - box_h, 4.0, box_h, fill=(0.082, 0.502, 0.239))
        self.text_line(MARGIN_X + 12, self.y - 14, title, font="F2", size=9.0, color=(0.078, 0.325, 0.176))
        cy = self.y - 28
        for ln in lines:
            self.text_line(MARGIN_X + 12, cy, ln, font="F3", size=8.3, color=(0.06, 0.09, 0.16))
            cy -= line_h
        self.y -= box_h + 10

    def finalize(self) -> bytes:
        self.pages.append(self.cur)
        total = len(self.pages)
        # Add footer page numbers cleanly
        for i, cmds in enumerate(self.pages, start=1):
            esc = pdf_escape(to_winansi(f"Field Shift — API Plans Comparison & Team Alignment   |   Page {i} of {total}"))
            footer = (
                b"BT /F1 8.0 Tf 0.45 0.50 0.56 rg "
                + f"1 0 0 1 {MARGIN_X:.2f} 18.00 Tm (".encode()
                + esc
                + b") Tj ET\n"
            )
            cmds.append(footer)

        # Build minimal PDF 1.4 objects
        objects: list[bytes] = []

        def add_obj(body: bytes) -> int:
            objects.append(body)
            return len(objects)

        f1 = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        f2 = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
        f3 = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>")
        res_id = add_obj(f"<< /Font << /F1 {f1} 0 R /F2 {f2} 0 R /F3 {f3} 0 R >> >>".encode())

        page_ids: list[int] = []
        pages_placeholder_idx = len(objects)
        add_obj(b"")  # placeholder for /Pages

        for cmds in self.pages:
            stream = b"".join(cmds)
            c_id = add_obj(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"endstream")
            p_id = add_obj(
                f"<< /Type /Page /Parent {pages_placeholder_idx + 1} 0 R "
                f"/MediaBox [0 0 {PAGE_W:.2f} {PAGE_H:.2f}] "
                f"/Resources {res_id} 0 R /Contents {c_id} 0 R >>".encode()
            )
            page_ids.append(p_id)

        kids = " ".join(f"{pid} 0 R" for pid in page_ids)
        objects[pages_placeholder_idx] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()
        cat_id = add_obj(f"<< /Type /Catalog /Pages {pages_placeholder_idx + 1} 0 R >>".encode())

        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets: list[int] = []
        for idx, body in enumerate(objects, start=1):
            offsets.append(len(out))
            out.extend(f"{idx} 0 obj\n".encode())
            out.extend(body)
            out.extend(b"\nendobj\n")

        xref_pos = len(out)
        out.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
        for off in offsets:
            out.extend(f"{off:010d} 00000 n \n".encode())
        out.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root {cat_id} 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
        )
        return bytes(out)


def parse_markdown_sections(md_text: str):
    lines = md_text.splitlines()
    blocks = []
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if not s or s == "---":
            i += 1
            continue
        hm = re.match(r"^(#{2,3})\s+(.*)$", s)
        if hm:
            blocks.append(("heading", len(hm.group(1)) - 1, clean_md_text(hm.group(2))))
            i += 1
            continue
        if "|" in lines[i] and i + 1 < len(lines) and re.match(r"^\s*\|?[\s:|-]+\|", lines[i + 1]):
            def split_row(r: str) -> list[str]:
                r = r.strip().strip("|")
                return [clean_md_text(c) for c in r.split("|")]
            hdr = split_row(lines[i])
            i += 2
            rows = []
            while i < len(lines) and "|" in lines[i] and lines[i].strip():
                row = split_row(lines[i])
                while len(row) < len(hdr):
                    row.append("")
                rows.append(row[: len(hdr)])
                i += 1
            blocks.append(("table", hdr, rows))
            continue
        if s.startswith("```"):
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            blocks.append(("code", "\n".join(code_lines)))
            continue
        i += 1
    return blocks


def main() -> None:
    md_text = (ROOT / "API_PLANS_DIFF_AND_ALIGNMENT.md").read_text(encoding="utf-8")
    blocks = parse_markdown_sections(md_text)

    pdf = PdfBuilder()
    pdf.draw_banner(
        "Field Shift - API Plans Comparison & Team Alignment",
        "Diff Between Our App / ML Guide (Algeria Live Python) and Teammate's Express/MongoDB Contract",
    )

    widths_by_cols = {
        4: [20, 32, 32, 16],
        3: [24, 34, 42],
        5: [7, 17, 44, 19, 13],
    }

    for b in blocks:
        if b[0] == "heading":
            pdf.draw_heading(b[2], level=b[1])
        elif b[0] == "table":
            hdr, rows = b[1], b[2]
            if hdr == ["Question", "Answer", "Overlap", "Primary Reason"]:
                pcts = [25, 18, 10, 47]
            elif hdr[0] == "Teammate Route":
                pcts = [22, 23, 13, 42]
            else:
                pcts = widths_by_cols.get(len(hdr), [100.0 / len(hdr)] * len(hdr))
            pdf.draw_table(hdr, rows, pcts)
        elif b[0] == "code":
            pdf.draw_code_box("Agreed Target Error Envelope (Adopt in FastAPI from Teammate Spec)", b[1])

    OUT_PDF.write_bytes(pdf.finalize())
    print(f"Generated PDF: {OUT_PDF} ({OUT_PDF.stat().st_size:,} bytes, {len(pdf.pages)} pages)")


if __name__ == "__main__":
    main()
