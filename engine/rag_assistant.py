"""Grounded Multilingual Agronomy Assistant (RAG) for Field Shift.

Supports Arabic (ar), French (fr), and English (en) questions over the reviewed local
agronomy guidance corpus and live engine scores from `engine/scoring.py`.

Environment Configuration (all optional, with safe local defaults):
  - RAG_CORPUS_DIR       : Directory or colon-separated paths of reviewed markdown docs
                           (default: repo root + docs/ + domain/ crop/region tables)
  - RAG_INDEX_PATH       : Path to persisted JSON vector index
                           (default: data/processed/rag_index.json)
  - RAG_EMBEDDING_PROVIDER: 'local_multilingual' (default) | 'gemini' | 'openai'
  - RAG_EMBEDDING_MODEL  : Model name when using external embedding API
  - RAG_LLM_PROVIDER     : 'auto' (default: uses GEMINI_API_KEY / OPENAI_API_KEY if set,
                           otherwise deterministic grounded synthesizer)
   - RAG_TOP_K            : Number of passages to retrieve per query (default: 4)
   - RAG_MIN_SCORE        : Minimum retrieval score threshold before refusal (default: 0.18)
  - GEMINI_API_KEY       : Optional Google Gemini API key (never hardcoded)
  - OPENAI_API_KEY       : Optional OpenAI API key (never hardcoded)
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import re
import unicodedata
import urllib.request
from pathlib import Path
from typing import Any

from engine import scoring

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INDEX_PATH = ROOT / "data" / "processed" / "rag_index.json"

# Reviewed local agronomy guidance documents included in the corpus
DEFAULT_CORPUS_FILES: list[tuple[str, str, Path]] = [
    ("DOC-AGRO-001", "Field Shift Reviewed Agronomy & Scoring Guidance (EN/FR/AR)", ROOT / "docs" / "agronomy_guidance_multilingual.md"),
    ("DOC-FARMER-001", "Farmer's Guide: Choosing Your 3-Year Crop Plan", ROOT / "FARMER_GUIDE.md"),
    ("DOC-REG-001", "Regional Agronomic Rules, Crop Profiles & Data Sources", ROOT / "REGIONAL_CROPS_AND_RULES.md"),
    ("DOC-ML-001", "Agronomy & ML Scoring Guide", ROOT / "AGRONOMY_AND_ML_GUIDE.md"),
    ("DOC-DATA-001", "About the Data — Sources, Methods & Confidence Rules", ROOT / "docs" / "about_data.md"),
    ("DOC-DEC-001", "Agronomic Decision Sheet & Thresholds", ROOT / "docs" / "decision_sheet.md"),
    ("DOC-GLOSS-001", "Glossary of Data & Agronomic Terms", ROOT / "docs" / "glossary_data_terms.md"),
    ("DOC-SENS-001", "Climate Window Sensitivity Analysis", ROOT / "docs" / "sensitivity.md"),
]

# ---------------------------------------------------------------------------
# 1. Language Detection & Arabic / Multilingual Normalization
# ---------------------------------------------------------------------------
_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]")
_ARABIC_DIACRITICS_RE = re.compile(r"[\u064B-\u065F\u0670\u0640]")

_FRENCH_MARKERS = {
    "pourquoi", "comment", "quel", "quelle", "quels", "quelles", "est-ce", "qu'est",
    "dans", "avec", "pour", "sans", "plus", "moins", "entre", "votre", "notre",
    "blé", "ble", "orge", "lentille", "lentilles", "pois", "chiche", "fève", "feve",
    "vesce", "colza", "carthame", "tournesol", "jachère", "jachere", "maïs", "mais",
    "soja", "sorgho", "riz", "arachide", "luzerne", "coton", "millet", "lin", "sésame",
    "pomme", "terre", "oignon", "coriandre", "sainfoin", "lupin",
    "eau", "pluie", "sécheresse", "secheresse", "sol", "azote", "engrais", "rendement",
    "revenu", "risque", "gel", "chaleur", "incendie", "feux", "rotation", "années",
    "annees", "ans", "culture", "cultures", "légumineuse", "legumineuse", "céréale",
    "cereale", "sétif", "setif", "pendjab", "irrig", "pesticide", "bétail", "betail",
}


def normalize_arabic(text: str) -> str:
    """Normalize Arabic script variants for consistent retrieval and matching."""
    text = _ARABIC_DIACRITICS_RE.sub("", text)
    text = re.sub("[إأآٱ]", "ا", text)
    text = text.replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    return text


def detect_language(text: str, explicit_lang: str | None = None) -> str:
    """Detect whether query is Arabic ('ar'), French ('fr'), or English ('en')."""
    s = (text or "").strip()
    if not s:
        return explicit_lang if explicit_lang in ("ar", "fr", "en") else "en"
    # If Arabic characters are present, treat as Arabic
    ar_chars = len(_ARABIC_RE.findall(s))
    if ar_chars >= 1:
        return "ar"
    # Check French markers and accents
    lower = s.lower()
    words = set(re.findall(r"[a-zàâçéèêëîïôûùüÿœæ'-]+", lower))
    en_markers = {"why", "what", "which", "how", "should", "can", "explain", "water", "soil", "profit", "risk", "wheat", "barley", "lentil", "crop", "crops", "years", "period", "score", "scores", "better", "than", "under", "tell", "about"}
    fr_hits = len(words & _FRENCH_MARKERS)
    en_hits = len(words & en_markers)
    has_fr_accents = bool(re.search(r"[éèêàùçœ]", lower))
    if en_hits >= 2 and en_hits > fr_hits:
        return "en"
    if fr_hits >= 2 or (fr_hits >= 1 and has_fr_accents and en_hits == 0):
        return "fr"
    if any(w in words for w in ("pourquoi", "comment", "blé", "orge", "lentille", "engrais", "azote", "sécheresse", "jachère", "quel", "quelle", "quels", "quelles", "peut-on")):
        return "fr"
    if en_hits >= 1:
        return "en"
    if explicit_lang in ("ar", "fr", "en"):
        return explicit_lang
    return "en"


# ---------------------------------------------------------------------------
# 2. Cross-Lingual Concept Lexicon (EN <-> FR <-> AR)
# ---------------------------------------------------------------------------
# Each concept maps to (canonical_tag, [multilingual synonyms in EN, FR, AR])
CONCEPT_LEXICON: list[tuple[str, list[str]]] = [
    ("concept_wheat", ["wheat", "durum", "soft_wheat", "bread wheat", "triticum", "blé", "ble", "blé dur", "blé tendre", "قمح", "القمح", "قمح صلب", "قمح لين"]),
    ("concept_barley", ["barley", "hordeum", "orge", "شعير", "الشعير"]),
    ("concept_lentil", ["lentil", "lentils", "lens culinaris", "lentille", "lentilles", "عدس", "العدس"]),
    ("concept_chickpea", ["chickpea", "chickpeas", "cicer", "garbanzo", "desi gram", "pois chiche", "حمص", "الحمص"]),
    ("concept_faba", ["faba", "fava", "broad bean", "vicia faba", "fève", "feve", "féverole", "فول", "الفول"]),
    ("concept_vetch", ["vetch", "hairy_vetch", "common vetch", "vesce", "بيقيه", "بيقية", "فيتش"]),
    ("concept_canola", ["canola", "rapeseed", "mustard", "brassica", "colza", "moutarde", "كانولا", "خردل", "سلجم"]),
    ("concept_safflower", ["safflower", "carthamus", "carthame", "قرطم", "القرطم", "عصفر"]),
    ("concept_sunflower", ["sunflower", "helianthus", "tournesol", "عباد الشمس", "دوار الشمس"]),
    ("concept_fallow", ["fallow", "rest year", "chem-fallow", "jachère", "jachere", "بور", "اراحه", "إراحة", "تبوير"]),
    ("concept_corn", ["corn", "maize", "zea mays", "maïs", "mais", "ذره", "ذرة", "الذرة"]),
    ("concept_soybean", ["soybean", "soy", "glycine max", "soja", "فول الصويا", "صويا", "الصويا"]),
    ("concept_sorghum", ["sorghum", "milo", "sorgho", "ذره رفيعه", "ذرة رفيعة", "سورغم"]),
    ("concept_rice", ["rice", "paddy", "oryza", "riz", "ارز", "أرز", "الارز", "الأرز"]),
    ("concept_mung", ["mung_bean", "mung", "moong", "haricot mungo", "ماش", "لوبيا خضراء", "مونج"]),
    ("concept_oats", ["oats", "oat", "avena", "avoine", "شوفان", "الشوفان", "خرطال"]),
    ("concept_triticale", ["triticale", "تريتيكال", "تريتيكالي"]),
    ("concept_pea", ["field_pea", "pea", "pisum", "pois", "pois protéagineux", "بازلاء", "البازلاء", "جلبانه", "جلبانة"]),
    ("concept_potato", ["potato", "potatoes", "solanum", "pomme de terre", "بطاطس", "بطاطا", "البطاطا", "البطاطس"]),
    ("concept_sulla", ["sulla", "sainfoin", "hedysarum", "سله", "سلة"]),
    ("concept_lupin", ["lupin", "lupine", "ترمس", "الترمس"]),
    ("concept_onion", ["onion", "garlic", "allium", "oignon", "ail", "بصل", "ثوم", "البصل"]),
    ("concept_coriander", ["coriander", "cilantro", "coriandrum", "coriandre", "كزبره", "كزبرة"]),
    ("concept_alfalfa", ["alfalfa", "lucerne", "medicago", "luzerne", "فصه", "فصة", "برسيم حجازي"]),
    ("concept_cotton", ["cotton", "gossypium", "coton", "قطن", "القطن"]),
    ("concept_millet", ["millet", "proso_millet", "pearl_millet", "bajra", "mil", "دخن", "الدخن", "بجرا"]),
    ("concept_flax", ["flax", "linseed", "lin", "كتان", "الكتان"]),
    ("concept_groundnut", ["groundnut", "peanut", "arachis", "arachide", "فول سوداني", "الفول السوداني"]),
    ("concept_pigeon_pea", ["pigeon_pea", "arhar", "tur", "cajanus", "pois d'angole", "بازلاء هنديه", "لوبيا شجريه"]),
    ("concept_berseem", ["berseem", "clover", "trifolium", "trèfle", "برسيم", "البرسيم"]),
    ("concept_sesame", ["sesame", "sesamum", "sésame", "سمسم", "السمسم"]),
    ("concept_legume", ["legume", "legumes", "pulse", "pulses", "nitrogen_fixing", "fixation", "légumineuse", "legumineuse", "légumineuses", "بقوليات", "البقوليات", "بقولي", "تثبيت النيتروجين"]),
    ("concept_cereal", ["cereal", "cereals", "grain", "monoculture", "céréale", "cereale", "céréales", "حبوب", "الحبوب"]),
    ("concept_oilseed", ["oilseed", "oilseeds", "taproot", "oléagineux", "oleagineux", "زيتيه", "محاصيل زيتية", "جذر وتدي"]),
    ("concept_water", ["water", "water_need", "water_stress", "rainfall", "rain", "drought", "dry", "moisture", "mm", "eau", "pluie", "précipitations", "sécheresse", "secheresse", "hydrique", "ماء", "المياه", "مطر", "امطار", "أمطار", "جفاف", "الجفاف", "اجهاد مائي", "إجهاد مائي"]),
    ("concept_irrigation", ["irrigation", "irrigated", "rainfed", "canal", "tubewell", "groundwater", "irrigué", "irrigue", "pluvial", "ري", "الري", "مسقي", "بعل", "بعلي", "مياه جوفيه"]),
    ("concept_soil", ["soil", "soc", "organic carbon", "ph", "calcareous", "erosion", "residue", "soil_effect", "sol", "carbone organique", "calcaire", "تربه", "تربة", "التربة", "كربون عضوي", "حموضه", "بقايا المحصول"]),
    ("concept_nitrogen_fertilizer", ["nitrogen", "npk", "fertilizer", "urea", "dap", "credit", "25%", "trajectory_3yr", "azote", "engrais", "urée", "نيتروجين", "النيتروجين", "ازوت", "آزوت", "سماد", "اسمدة", "أسمدة", "يوريا"]),
    ("concept_score_engine", ["score", "scores", "ranking", "rank", "criteria", "weights", "adjusted_weights", "monte carlo", "stability", "ml_metrics", "env_match", "ai_confidence", "note", "classement", "pondération", "نقاط", "النقاط", "تقييم", "الترتيب", "معايير", "وزن", "استقرار"]),
    ("concept_profit_yield", ["profit", "income", "gross_income", "yield", "price", "return", "revenue", "dzd", "usd", "inr", "revenu", "rendement", "prix", "rentabilité", "ربح", "الربح", "دخل", "الدخل", "مردود", "المردود", "انتاج", "سعر"]),
    ("concept_risk_climate", ["risk", "hot_days", "frost", "heat", "sirocco", "disease", "blight", "orobanche", "risque", "gel", "chaleur", "maladie", "مخاطر", "المخاطر", "حراره", "حرارة", "صقيع", "امراض", "أمراض", "هالوك"]),
    ("concept_period_years", ["period", "years", "3-year", "2-year", "4-year", "5-year", "rotation_length", "horizon", "cycle", "duration", "double cropping", "seasons", "période", "periode", "durée", "duree", "ans", "années", "فتره", "فترة", "مدة", "مده", "سنوات", "سنتين", "ثلاث سنوات", "اربع سنوات", "أربع سنوات", "خمس سنوات", "دوره", "دورة"]),
    ("concept_region_setif", ["regiona", "setif", "sétif", "algeria", "high plateaux", "tiaret", "constantine", "algérie", "algerie", "سطيف", "الجزائر", "الهضاب العليا", "تيارت"]),
    ("concept_region_kansas", ["regionb", "kansas", "usa", "great plains", "salina", "états-unis", "كانساس", "امريكا", "أمريكا", "السهول الكبرى"]),
    ("concept_region_punjab", ["regionc", "punjab", "india", "ludhiana", "indo-gangetic", "kharif", "rabi", "pendjab", "inde", "بنجاب", "البنجاب", "الهند"]),
    ("concept_fires", ["fire", "fires", "firms", "viirs", "modis", "thermal", "stubble burning", "25 km", "incendie", "feux", "brûlage", "حريق", "حرائق", "الحرائق", "اقمار صناعيه"]),
    ("concept_gaps_limits", ["gap", "gaps", "limitation", "limitations", "confidence", "uncertainty", "soilgrids", "nasa power", "era5", "ndvi", "limite", "limites", "incertitude", "ثغرات", "حدود", "قيود", "ثقه", "دقه"]),
    ("concept_general_plan", ["plant", "planting", "crop", "crops", "rotation", "rotations", "plan", "farm", "farming", "recommend", "recommended", "recommendation", "best", "advice", "explain", "why", "culture", "cultures", "assolement", "planter", "conseil", "recommandation", "expliquer", "زراعه", "زراعة", "ازرع", "أزرع", "محصول", "محاصيل", "خطه", "خطة", "مزرعه", "مزرعة", "نصيحه", "نصيحة", "افضل", "أفضل"]),
]

# Out-of-scope / unreviewed topics that must trigger the refusal path
OUT_OF_SCOPE_PATTERNS: list[tuple[str, list[str]]] = [
    ("chemical_pesticide_prescription", [
        "pesticide", "herbicide", "fungicide", "insecticide", "glyphosate", "roundup",
        "chlorpyrifos", "malathion", "paraquat", "atrazine", "2,4-d", "spray dosage",
        "spray rate", "chemical control", "fongicide", "pulvérisation", "dose de pesticide",
        "مبيد", "مبيدات", "رش كيميائي", "جرعه مبيد", "جرعة مبيد", "مبيد حشري", "مبيد فطري", "مبيد اعشاب",
    ]),
    ("livestock_veterinary", [
        "veterinary", "vaccine", "antibiotic", "cattle surgery", "mastitis", "foot and mouth",
        "sheep worming", "poultry feed", "vétérinaire", "vaccin", "antibiotique", "chirurgie",
        "بيطري", "لقاح", "مضاد حيوي", "علاج الابقار", "علاج الاغنام", "بيطره", "جراحه",
    ]),
    ("machinery_repair", [
        "tractor engine", "gearbox", "hydraulic pump", "injector pump", "alternator",
        "combine harvester repair", "transmission oil", "moteur du tracteur", "boîte de vitesse",
        "محرك الجرار", "علبه التروس", "صيانه الجرار", "اعطال الحصاده",
    ]),
    ("finance_crypto_unrelated", [
        "bitcoin", "ethereum", "crypto", "cryptocurrency", "forex", "stock market",
        "nasdaq", "football", "recipe for cake", "movie", "weather in tokyo",
        "cryptomonnaie", "bourse", "بيتكوين", "عملات رقميه", "عملات مشفرة", "اسهم البورصه", "كره القدم",
    ]),
    ("unreviewed_plantation_crops", [
        "cocoa", "cacao", "coffee plantation", "oil palm", "banana plantation", "rubber tree",
        "pineapple", "tea estate", "avocado orchard", "banane", "palmier à huile", "caféier",
        "كاكاو", "زراعه الموز", "زراعة الموز", "نخيل الزيت", "شجره المطاط", "القهوه", "أفوكادو",
    ]),
]


def detect_concepts(text: str) -> set[str]:
    """Return canonical concept tags matched in `text` across EN, FR, and AR."""
    lower = (text or "").lower()
    norm_ar = normalize_arabic(lower)
    combined = lower + " " + norm_ar
    matched: set[str] = set()
    for tag, terms in CONCEPT_LEXICON:
        for term in terms:
            t_norm = normalize_arabic(term.lower())
            if len(t_norm) <= 3:
                if re.search(rf"(?<![a-z0-9\u0600-\u06FF]){re.escape(t_norm)}(?![a-z0-9\u0600-\u06FF])", combined):
                    matched.add(tag)
                    break
            else:
                if t_norm in combined:
                    matched.add(tag)
                    break
    return matched


def detect_out_of_scope(text: str) -> str | None:
    """Return out-of-scope category name if query asks for unreviewed advice."""
    lower = (text or "").lower()
    norm_ar = normalize_arabic(lower)
    combined = lower + " " + norm_ar
    for category, triggers in OUT_OF_SCOPE_PATTERNS:
        for trig in triggers:
            t_norm = normalize_arabic(trig.lower())
            if len(t_norm) <= 4:
                if re.search(rf"(?<![a-z0-9\u0600-\u06FF]){re.escape(t_norm)}(?![a-z0-9\u0600-\u06FF])", combined):
                    return category
            elif t_norm in combined:
                return category
    return None


def expand_multilingual_query(query: str) -> str:
    """Expand an AR/FR/EN query with canonical English & multilingual concept terms for retrieval."""
    concepts = detect_concepts(query)
    expansion_terms: list[str] = []
    lex_map = dict(CONCEPT_LEXICON)
    for c in sorted(concepts):
        expansion_terms.append(c)
        # Add top English & French canonical terms for each matched concept
        for term in lex_map.get(c, [])[:4]:
            expansion_terms.append(term)
    return f"{query} {' '.join(expansion_terms)}".strip()


# ---------------------------------------------------------------------------
# 3. Document Chunking, Embedding & Persisted Vector Index
# ---------------------------------------------------------------------------
_TOKEN_RE = re.compile(r"[a-z0-9_\u0600-\u06FFàâçéèêëîïôûùüÿœæ]{2,}")
_STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "are", "was", "were", "have",
    "has", "had", "not", "but", "you", "your", "can", "will", "what", "why", "how",
    "when", "where", "which", "who", "into", "over", "per", "all", "any", "our",
    "les", "des", "une", "dans", "pour", "avec", "sur", "par", "plus", "sont", "est",
    "que", "qui", "quoi", "comment", "pourquoi", "votre", "notre", "aux", "ces",
    "من", "في", "على", "الى", "إلى", "عن", "مع", "هذا", "هذه", "التي", "الذي",
    "ما", "ماذا", "لماذا", "كيف", "هل", "او", "أو", "كل", "عند", "بين",
}


def tokenize(text: str) -> list[str]:
    norm = normalize_arabic((text or "").lower())
    tokens = [t for t in _TOKEN_RE.findall(norm) if t not in _STOPWORDS]
    concepts = sorted(detect_concepts(text))
    # Boost concept tokens so cross-lingual queries align strongly with English/multilingual chunks
    return tokens + concepts * 3


def _hash_embed(text: str, dim: int = 192) -> list[float]:
    """Deterministic multilingual concept + token + char-3gram embedding in R^dim (unit L2 norm)."""
    vec = [0.0] * dim
    tokens = tokenize(text)
    for tok in tokens:
        weight = 2.8 if tok.startswith("concept_") else 1.0
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:8], 16)
        idx = h % dim
        sign = 1.0 if (h & (1 << 16)) else -1.0
        vec[idx] += sign * weight
        # Character 3-grams for morphological resilience across AR / FR / EN
        if not tok.startswith("concept_") and len(tok) >= 4:
            for i in range(len(tok) - 2):
                ng = tok[i : i + 3]
                h2 = int(hashlib.md5(ng.encode("utf-8")).hexdigest()[:8], 16)
                vec[h2 % dim] += (0.35 if (h2 & (1 << 15)) else -0.35)
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [round(x / norm, 5) for x in vec]


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    return sum(x * y for x, y in zip(a, b))


def _chunk_markdown(doc_id: str, doc_title: str, path: Path, max_chars: int = 950) -> list[dict[str, Any]]:
    """Split a markdown file into section-level chunks with clean metadata."""
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    chunks: list[dict[str, Any]] = []
    cur_sec = "Overview"
    buf: list[str] = []
    sec_idx = 0

    _NON_AGRO_RE = re.compile(
        r"Current vs\. Target Backend Endpoints|GET /health|placeholders that need a team owner|"
        r"Request Inputs|Key Response Fields & Status Codes|Directory Structure|Git Workflow|"
        r"written specifically for software engineers|Repo Data Audit|Step-by-Step Software Implementation|"
        r"Backend API Specification|Sources Referenced|Frontend State",
        re.IGNORECASE,
    )

    def flush() -> None:
        nonlocal sec_idx, buf
        text = "\n".join(buf).strip()
        buf = []
        if len(text) < 40:
            return
        if _NON_AGRO_RE.search(f"{cur_sec} {text}"):
            return
        # If section is long, split on paragraph boundaries
        paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip() and not _NON_AGRO_RE.search(p)]
        part_buf = ""
        for p in paras:
            if len(part_buf) + len(p) + 2 <= max_chars or not part_buf:
                part_buf = f"{part_buf}\n\n{p}".strip() if part_buf else p
            else:
                sec_idx += 1
                chunks.append({
                    "chunk_id": f"{doc_id}#S{sec_idx}",
                    "doc_id": doc_id,
                    "title": doc_title,
                    "section": cur_sec,
                    "file": str(path.relative_to(ROOT)),
                    "text": part_buf,
                    "concepts": sorted(detect_concepts(f"{cur_sec} {part_buf}")),
                })
                part_buf = p
        if part_buf:
            sec_idx += 1
            chunks.append({
                "chunk_id": f"{doc_id}#S{sec_idx}",
                "doc_id": doc_id,
                "title": doc_title,
                "section": cur_sec,
                "file": str(path.relative_to(ROOT)),
                "text": part_buf,
                "concepts": sorted(detect_concepts(f"{cur_sec} {part_buf}")),
            })

    for ln in lines:
        m = re.match(r"^(#{1,3})\s+(.*)$", ln.strip())
        if m:
            flush()
            cur_sec = re.sub(r"[#*`]", "", m.group(2)).strip()
        else:
            buf.append(ln)
    flush()
    return chunks


def _build_domain_Synthesis_chunks() -> list[dict[str, Any]]:
    """Convert structured domain tables (gaps.json, regions.csv, crops_base.csv, yield.csv) into chunks."""
    chunks: list[dict[str, Any]] = []
    gaps_path = ROOT / "data" / "inputs" / "gaps.json"
    if gaps_path.exists():
        raw_gaps = json.loads(gaps_path.read_text(encoding="utf-8"))
        gaps = raw_gaps.get("gaps", []) if isinstance(raw_gaps, dict) else raw_gaps
        lines = [f"- {g['id']}: {g['text']}" for g in gaps if isinstance(g, dict)]
        chunks.append({
            "chunk_id": "DOC-GAPS-001#S1",
            "doc_id": "DOC-GAPS-001",
            "title": "Scientific Limitations & Scale Disclosures (G1–G12)",
            "section": "Scientific Disclosures G1 to G12",
            "file": "data/inputs/gaps.json",
            "text": "\n".join(lines),
            "concepts": sorted(detect_concepts("\n".join(lines))),
        })

    for reg_id, reg_label in [
        ("regionA", "regionA — Sétif High Plains, Algeria (Deep, Rainfed)"),
        ("regionB", "regionB — Central Kansas Plains, USA (Light, Rainfed)"),
        ("regionC", "regionC — Punjab Plains, India (Light, Irrigated)"),
    ]:
        try:
            reg_data = scoring.load_region(reg_id, ROOT)
            crops = reg_data["crops"]
            rules = reg_data["rules"]
            thresh = reg_data["thresholds"]
            c_lines = [
                f"Region {reg_label}: rotation_length={rules.get('rotation_length')}, "
                f"min_legumes={rules.get('min_legumes')}, max_high_water_crops={rules.get('max_high_water_crops')} "
                f"(threshold >= {rules.get('high_water_need_threshold')}), "
                f"forbid_consecutive_same_family={rules.get('forbid_consecutive_same_family')}, "
                f"rainfall_reference_mm={thresh.get('rainfall_reference_mm')}, "
                f"soc_threshold_g_per_kg={thresh.get('soc_threshold_g_per_kg')}."
            ]
            for cid, c in sorted(crops.items()):
                c_lines.append(
                    f"- {cid} ({c['name']}, family={c['family']}): water_need={c['water_need']}, "
                    f"drought_tolerance={c['drought_tolerance']}, nitrogen_fixing={c['nitrogen_fixing']}, "
                    f"n_impact={c['n_impact']} kg/ha, base_npk={c['base_npk']} kg/ha ({c['fert_name']}), "
                    f"yield={c.get('yield_potential')} q/ha, gross_income={c.get('gross_income_dzd_ha')}, "
                    f"rain_opt={c['rain_opt']} mm. Note: {c['risk_note']} (Source: {c.get('yield_source', 'domain')})"
                )
            text = "\n".join(c_lines)
            chunks.append({
                "chunk_id": f"DOC-DOM-{reg_id}#S1",
                "doc_id": f"DOC-DOM-{reg_id}",
                "title": f"Domain Crop Table & Rules for {reg_label}",
                "section": f"{reg_label} Crops, Yields, Rules & Thresholds",
                "file": f"domain/regions/{reg_id}/yield.csv",
                "text": text,
                "concepts": sorted(detect_concepts(text)),
            })
        except Exception:
            pass
    return chunks


def build_or_load_index(force_rebuild: bool = False) -> dict[str, Any]:
    """Build or load the persisted RAG vector index (`data/processed/rag_index.json`)."""
    index_path = Path(os.getenv("RAG_INDEX_PATH", str(DEFAULT_INDEX_PATH)))
    if not force_rebuild and index_path.exists():
        try:
            data = json.loads(index_path.read_text(encoding="utf-8"))
            if data.get("version") == "1.0" and data.get("chunks"):
                return data
        except Exception:
            pass

    all_chunks: list[dict[str, Any]] = []
    for doc_id, title, path in DEFAULT_CORPUS_FILES:
        all_chunks.extend(_chunk_markdown(doc_id, title, path))
    all_chunks.extend(_build_domain_Synthesis_chunks())

    # Compute IDF across chunks for hybrid lexical + embedding scoring
    df: dict[str, int] = {}
    for ch in all_chunks:
        seen = set(tokenize(f"{ch['title']} {ch['section']} {ch['text']}"))
        for t in seen:
            df[t] = df.get(t, 0) + 1
    n_docs = max(1, len(all_chunks))
    idf = {t: round(math.log((n_docs + 1.0) / (cnt + 0.5)) + 1.0, 4) for t, cnt in df.items()}

    for ch in all_chunks:
        full_txt = f"{ch['title']} — {ch['section']}\n{ch['text']}"
        ch["embedding"] = _hash_embed(full_txt)

    index_obj = {
        "version": "1.0",
        "embedding_provider": os.getenv("RAG_EMBEDDING_PROVIDER", "local_multilingual"),
        "embedding_dim": 192,
        "chunk_count": len(all_chunks),
        "idf": idf,
        "chunks": all_chunks,
    }
    try:
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps(index_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass
    return index_obj


def retrieve_passages(
    query: str,
    region_id: str | None = None,
    top_k: int | None = None,
    index: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Retrieve top-k grounded passages for `query` (supports AR, FR, EN)."""
    idx = index or build_or_load_index()
    k = top_k or int(os.getenv("RAG_TOP_K", "4"))
    expanded = expand_multilingual_query(query)
    q_Concepts = detect_concepts(query)
    q_vec = _hash_embed(expanded)
    q_tokens = set(tokenize(expanded))
    idf = idx.get("idf", {})

    scored: list[dict[str, Any]] = []
    for ch in idx.get("chunks", []):
        cos = max(0.0, _cosine(q_vec, ch.get("embedding", [])))
        ch_concepts = set(ch.get("concepts", []))
        concept_overlap = len(q_Concepts & ch_concepts) / max(1, len(q_Concepts)) if q_Concepts else 0.0

        ch_tokens = set(tokenize(f"{ch['title']} {ch['section']} {ch['text']}"))
        common = q_tokens & ch_tokens
        idf_sum = sum(idf.get(t, 1.0) for t in common)
        q_idf_total = sum(idf.get(t, 1.0) for t in q_tokens) or 1.0
        lex_score = min(1.0, idf_sum / max(3.5, q_idf_total * 0.55))

        # Slight boost when chunk matches active region and core agronomy guides
        reg_boost = 0.08 if (region_id and region_id.lower() in ch["chunk_id"].lower()) else 0.0
        doc_id = str(ch.get("doc_id", ""))
        dom_boost = (
            0.08
            if doc_id.startswith(("DOC-AGRO", "DOC-FARMER", "DOC-REG", "DOC-DOM"))
            else (-0.08 if doc_id.startswith(("DOC-DEC", "DOC-ML")) else 0.0)
        )
        score = round(max(0.05, 0.45 * cos + 0.35 * concept_overlap + 0.20 * lex_score + reg_boost + dom_boost), 4)

        scored.append({
            "chunk_id": ch["chunk_id"],
            "doc_id": ch["doc_id"],
            "title": ch["title"],
            "section": ch["section"],
            "file": ch["file"],
            "text": ch["text"],
            "score": score,
            "concept_hits": sorted(q_Concepts & ch_concepts),
        })

    scored.sort(key=lambda x: (-x["score"], x["chunk_id"]))
    top = scored[:k]
    best_score = top[0]["score"] if top else 0.0
    return {
        "query": query,
        "expanded_query": expanded,
        "detected_concepts": sorted(q_Concepts),
        "best_score": best_score,
        "passages": top,
    }


# ---------------------------------------------------------------------------
# 4. Real Engine Score Computation & Context Extraction
# ---------------------------------------------------------------------------
_UI_TO_ENGINE_CROP = {
    "durum": "wheat",
    "soft": "soft_wheat",
    "rapeseed": "canola",
}


def _canon_crop(cid: str) -> str:
    c = str(cid or "").strip().lower()
    return _UI_TO_ENGINE_CROP.get(c, c)


_ENGINE_CTX_CACHE: dict[str, dict[str, Any]] = {}

DEFAULT_GRAPH_PATH = ROOT / "data" / "processed" / "knowledge_graph.json"
_GRAPH_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}

_EMPTY_GRAPH = {"version": None, "nodes_by_id": {}, "adj": {}, "radj": {}, "alias": {}}


def load_graph(path: str | Path | None = None) -> dict[str, Any]:
    """Load data/processed/knowledge_graph.json with an adjacency + alias index (mtime-cached)."""
    p = Path(path) if path else DEFAULT_GRAPH_PATH
    try:
        mtime = p.stat().st_mtime
    except OSError:
        return dict(_EMPTY_GRAPH)
    cached = _GRAPH_CACHE.get(str(p))
    if cached and cached[0] == mtime:
        return cached[1]
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return dict(_EMPTY_GRAPH)
    nodes_by_id = {n["id"]: n for n in doc.get("nodes", []) if isinstance(n, dict) and n.get("id")}
    adj: dict[str, list[dict]] = {}
    radj: dict[str, list[dict]] = {}
    alias: dict[str, str] = {}
    for e in doc.get("edges", []):
        if not (isinstance(e, dict) and e.get("src") and e.get("rel") and e.get("dst")):
            continue
        adj.setdefault(e["src"], []).append(e)
        radj.setdefault(e["dst"], []).append(e)
    for nid, n in nodes_by_id.items():
        for a in n.get("aliases") or []:
            alias.setdefault(normalize_arabic(str(a).strip().lower()), nid)
        alias.setdefault(normalize_arabic(nid.lower()), nid)
    g = {"version": doc.get("version"), "nodes_by_id": nodes_by_id, "adj": adj, "radj": radj, "alias": alias}
    _GRAPH_CACHE[str(p)] = (mtime, g)
    return g


def get_graph_context(
    entities: list[str] | None,
    max_hops: int = 2,
    graph: dict[str, Any] | None = None,
    max_edges: int = 48,
) -> dict[str, Any]:
    """Multi-hop traversal of the agronomy knowledge graph.

    `entities` are free strings (region names, crop ids, concept tags); each is
    resolved through the graph alias index, then the graph is walked up to
    `max_hops` hops in BOTH directions (so a crop entity can still reach its
    regions and their climate trends). Returns plain-English relation lines,
    structured cross-region comparisons, and the raw paths.
    """
    g = graph if graph is not None else load_graph()
    nodes_by_id = g["nodes_by_id"]
    adj, radj, alias = g["adj"], g["radj"], g["alias"]

    seeds: list[str] = []
    for ent in entities or []:
        key = normalize_arabic(str(ent).strip().lower())
        if key.startswith("concept_"):
            key = key[len("concept_"):]
        nid = alias.get(key)
        if nid and nid not in seeds:
            seeds.append(nid)
    if not seeds:
        return {"entities": list(entities or []), "seeds": [], "lines": [], "comparison": [], "paths": []}

    seen_edges: set[tuple[str, str, str]] = set()
    paths: list[dict[str, Any]] = []
    frontier = list(seeds)
    def _edge_priority(e: dict) -> int:
        # Structural relations first; crop fan-out (grows/stresses) last so it
        # cannot starve the hop budget before peer trends are reached.
        return 1 if e["rel"] in ("grows", "stresses") else 0

    for hop in range(1, max(max_hops, 1) + 1):
        nxt: list[str] = []
        frontier.sort(key=lambda nid: nid.startswith("crop:"))
        for nid in frontier:
            if len(paths) >= max_edges:
                break
            if hop > 1 and nid.startswith("crop:") and nid not in seeds:
                continue
            out_edges = sorted(adj.get(nid, []), key=_edge_priority)
            in_edges = sorted(radj.get(nid, []), key=_edge_priority)
            for direction, edge_list in (("out", out_edges), ("in", in_edges)):
                if len(paths) >= max_edges:
                    break
                for e in edge_list:
                    if len(paths) >= max_edges:
                        break
                    eid = (e["src"], e["rel"], e["dst"])
                    if eid in seen_edges:
                        continue
                    seen_edges.add(eid)
                    other = e["dst"] if direction == "out" else e["src"]
                    other_node = nodes_by_id.get(other, {})
                    paths.append({
                        "hop": hop,
                        "direction": direction,
                        "src": e["src"],
                        "rel": e["rel"],
                        "dst": e["dst"],
                        "reason": e.get("attrs", {}).get("reason"),
                        "summary": other_node.get("summary"),
                    })
                    if other not in nxt and other not in seeds:
                        nxt.append(other)
            if len(paths) >= max_edges:
                break
        if len(paths) >= max_edges or hop >= max_hops:
            break
        frontier = nxt

    def _line(p: dict[str, Any]) -> str:
        src = nodes_by_id.get(p["src"], {})
        dst = nodes_by_id.get(p["dst"], {})
        txt = f"{src.get('label', p['src'])} —{p['rel']}→ {dst.get('label', p['dst'])}"
        detail = p.get("reason") or p.get("summary") or dst.get("summary")
        if detail:
            txt += f" ({str(detail)[:220]})"
        return txt

    lines = [_line(p) for p in paths]

    # Structured cross-region comparison when 2+ region entities are present
    comparison: list[dict[str, Any]] = []
    region_seeds = [s for s in seeds if s.startswith("region:")]
    if len(region_seeds) >= 2:
        for i in range(len(region_seeds) - 1):
            ra, rb = region_seeds[i], region_seeds[i + 1]
            na, nb = nodes_by_id.get(ra, {}), nodes_by_id.get(rb, {})
            ta = nodes_by_id.get(f"trend:{ra.split(':', 1)[1]}", {})
            tb = nodes_by_id.get(f"trend:{rb.split(':', 1)[1]}", {})
            sa = (ta.get("attrs") or {}).get("slope_mm_per_decade")
            sb = (tb.get("attrs") or {}).get("slope_mm_per_decade")
            sga = (ta.get("attrs") or {}).get("statistically_significant_95")
            sgb = (tb.get("attrs") or {}).get("statistically_significant_95")
            rain_a = (na.get("attrs") or {}).get("rainfall_mm")
            rain_b = (nb.get("attrs") or {}).get("rainfall_mm")
            awc_a = ((nodes_by_id.get(f"soil:{ra.split(':', 1)[1]}", {}).get("attrs")) or {}).get("awc_mm_per_m")
            awc_b = ((nodes_by_id.get(f"soil:{rb.split(':', 1)[1]}", {}).get("attrs")) or {}).get("awc_mm_per_m")
            comparison.append({
                "a": ra,
                "b": rb,
                "a_label": na.get("label", ra),
                "b_label": nb.get("label", rb),
                "slope_a_mm_per_decade": sa,
                "slope_b_mm_per_decade": sb,
                "significant_a": sga,
                "significant_b": sgb,
                "rainfall_a_mm": rain_a,
                "rainfall_b_mm": rain_b,
                "awc_a_mm_per_m": awc_a,
                "awc_b_mm_per_m": awc_b,
            })

    return {
        "entities": list(entities or []),
        "seeds": seeds,
        "lines": lines,
        "comparison": comparison,
        "paths": paths,
    }


def _collect_graph_entities(question: str, q_concepts: set[str], target_region: str) -> list[str]:
    """Detect graph entities in the user's question (regions by name, crops via concepts)."""
    q_norm = normalize_arabic((question or "").lower())
    q_ascii = "".join(ch for ch in unicodedata.normalize("NFD", q_norm) if unicodedata.category(ch) != "Mn")
    matched_regions: list[str] = []
    for rid, *needles in (
        ("setif", "setif", "سطيف"),
        ("tiaret", "tiaret", "تيارت"),
        ("constantine", "constantine", "قسنطينه"),
        ("kansas", "kansas"),
        ("punjab", "punjab"),
    ):
        if any(n in q_norm or n in q_ascii for n in needles):
            matched_regions.append(rid)
    ents: list[str] = matched_regions[:]
    for c in sorted(q_concepts):
        cid = _CONCEPT_TO_CROP_ID.get(c)
        if cid and cid not in ents:
            ents.append(cid)
    is_comparison = any(
        w in q_norm
        for w in ("compare", " vs ", " versus ", "vs.", "différence", "difference", "better than", "مقارنه", "أفضل من")
    )
    if is_comparison and target_region not in ents:
        ents.append(target_region)
    if not ents:
        ents = [target_region]
    elif target_region not in ents and len(ents) < 4:
        ents.insert(0, target_region)
    return ents[:6]


def _scalar(v: Any) -> float | None:
    """Extract a numeric value from a v2 indicator block ({value, unit, ...}) or a scalar."""
    if isinstance(v, dict):
        v = v.get("value")
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return None


def _pipeline_processed_dir(region_id: str) -> Path | None:
    """Locate the authoritative v2 pipeline outputs for a region.

    Resolution order: the region id itself, then the `code` mapped in
    domain/regions.csv (regionA -> setif). A directory whose indicators.json
    carries the v2 `rainfall_trend` block (Theil-Sen keys) wins over v1-style
    mirrors, so verified data/processed/setif|tiaret|constantine outputs are
    preferred over legacy regionA/B/C snapshots.
    """
    if not region_id:
        return None
    code = region_id
    regions_csv = ROOT / "domain" / "regions.csv"
    try:
        with regions_csv.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("region_id", "").strip() == region_id:
                    code = row.get("code", "").strip() or region_id
                    break
    except Exception:
        pass
    candidates: list[Path] = []
    for cand in (region_id, code):
        if cand and (ROOT / "data" / "processed" / cand / "indicators.json").exists():
            p = ROOT / "data" / "processed" / cand
            if p not in candidates:
                candidates.append(p)

    def has_v2_trend(p: Path) -> bool:
        try:
            doc = json.loads((p / "indicators.json").read_text(encoding="utf-8"))
        except Exception:
            return False
        block = doc.get("rainfall_trend")
        return isinstance(block, dict) and block.get("theilslopes_slope_per_year") is not None

    for p in candidates:
        if has_v2_trend(p):
            return p
    return candidates[0] if candidates else None


def compute_engine_context(
    region_id: str = "regionA",
    rotation: list[str] | None = None,
    allowed: list[str] | None = None,
    priorities: dict[str, float] | None = None,
    scenario: dict[str, float] | None = None,
    indicators_by_region: dict[str, Any] | None = None,
    graph_entities: list[str] | None = None,
) -> dict[str, Any]:
    """Run the real `engine/scoring.py` `recommend()` function and return structured plan scores."""
    cache_key = json.dumps(
        {
            "r": region_id,
            "rot": rotation,
            "alw": allowed,
            "p": priorities,
            "sc": scenario,
            "g": graph_entities,
        },
        sort_keys=True,
    )
    if indicators_by_region is None and cache_key in _ENGINE_CTX_CACHE:
        return _ENGINE_CTX_CACHE[cache_key]

    domain_reg = region_id if (ROOT / "domain" / "regions" / region_id).exists() else "regionA"
    data = scoring.load_region(domain_reg, ROOT)

    if indicators_by_region is None:
        ind_path = ROOT / "data" / "regional" / "all_indicators.json"
        indicators_by_region = json.loads(ind_path.read_text(encoding="utf-8")) if ind_path.exists() else {}

    ind = dict(indicators_by_region.get(domain_reg) or indicators_by_region.get("regionA") or {})
    # Also merge region thresholds so rainfall_reference_mm and soc_threshold_g_per_kg match domain
    thresh = data.get("thresholds") or {}

    # Prefer our verified v2 pipeline outputs (data/processed/<code>/) over v1 snapshots
    processed_dir = _pipeline_processed_dir(region_id) or _pipeline_processed_dir(domain_reg)
    v2_stats: dict[str, Any] = {}
    v2_label = None
    if processed_dir:
        soil_path = processed_dir / "soil.json"
        v2_ind_path = processed_dir / "indicators.json"
        if v2_ind_path.exists():
            try:
                v2_ind = json.loads(v2_ind_path.read_text(encoding="utf-8"))
            except Exception:
                v2_ind = {}
            for key in ("rainfall_mm", "water_stress", "ph"):
                val = _scalar(v2_ind.get(key))
                if val is not None:
                    ind[key] = val
            if isinstance(v2_ind.get("rainfall_trend"), dict):
                ind["rainfall_trend"] = dict(v2_ind["rainfall_trend"])
            if isinstance(v2_ind.get("label"), str) and v2_ind["label"].strip():
                v2_label = v2_ind["label"].strip()
            hd = v2_ind.get("historical_drought")
            if isinstance(hd, dict) and hd:
                v2_stats["drought"] = {
                    "window": hd.get("window"),
                    "drought_frequency_pct": hd.get("drought_frequency_pct"),
                    "severe_drought_years": list(hd.get("severe_drought_years") or []),
                    "severe_boundary_mm": hd.get("severe_boundary_mm"),
                    "confidence": hd.get("confidence"),
                }
            swc = v2_ind.get("soil_water_capacity")
            if isinstance(swc, dict) and swc.get("awc_mm_per_m") is not None:
                v2_stats["awc"] = {
                    "awc_mm_per_m": float(swc["awc_mm_per_m"]),
                    "awc_is_estimate": bool(swc.get("awc_is_estimate", True)),
                    "method": swc.get("method"),
                    "confidence": swc.get("confidence"),
                }
            rt = v2_ind.get("rule_trace")
            if isinstance(rt, dict):
                v2_stats["rule_trace"] = {
                    k: v
                    for k, v in rt.items()
                    if isinstance(v, str) and v.strip() and k != "purpose"
                }
            dq_path = processed_dir / "data_quality.json"
            if dq_path.exists():
                try:
                    dq = json.loads(dq_path.read_text(encoding="utf-8"))
                    v2_stats["data_quality"] = {
                        "run_stamp": dq.get("run_stamp"),
                        "confidence_summary": dq.get("confidence_summary"),
                        "spatial_caveat": dq.get("spatial_caveat"),
                    }
                except Exception:
                    pass
        v2_stats["pipeline_code"] = processed_dir.name
    else:
        soil_path = ROOT / "data" / "processed" / domain_reg / "soil.json"
    if soil_path.exists():
        soil_d = json.loads(soil_path.read_text(encoding="utf-8"))
        if "soc_g_per_kg" in soil_d:
            ind["soil_organic_carbon_g_per_kg"] = float(soil_d["soc_g_per_kg"])
        if soil_d.get("awc_mm_per_m") is not None and "awc" not in v2_stats:
            v2_stats["awc"] = {
                "awc_mm_per_m": float(soil_d["awc_mm_per_m"]),
                "awc_is_estimate": bool(soil_d.get("awc_is_estimate", True)),
                "method": soil_d.get("awc_method"),
                "confidence": soil_d.get("confidence"),
            }
    v2_stats.update(scoring.extract_trend_stats(ind))
    graph_ctx = get_graph_context(graph_entities) if graph_entities else {}
    if "rainfall_reference_mm" in thresh:
        ind["rainfall_reference_mm"] = float(thresh["rainfall_reference_mm"])
    if "soc_threshold_g_per_kg" in thresh:
        ind["soc_threshold_g_per_kg"] = float(thresh["soc_threshold_g_per_kg"])

    scen = scenario or {"rain": 0, "temp": 0}
    rain_pct = float(scen.get("rain", 0))
    temp_c = float(scen.get("temp", 0))
    eff_rain = float(ind.get("rainfall_mm", 450.0)) * (1.0 + rain_pct / 100.0) * (1.0 - 0.025 * temp_c)
    eff_ind = dict(ind, rainfall_mm=round(eff_rain, 1))

    p = priorities or {"water": 38, "soil": 32, "yield": 30}
    w_water = float(p.get("water", p.get("save_water", 34)))
    w_soil = float(p.get("soil", p.get("protect_soil", 33)))
    w_yield = float(p.get("yield", p.get("profit", 33)))
    tot = max(1.0, w_water + w_soil + w_yield)
    weights = {
        "water": w_water / tot,
        "soil": w_soil / tot,
        "profit": w_yield / (2.0 * tot),
        "risk": w_yield / (2.0 * tot),
    }

    full_crops = dict(data["crops"])
    if allowed:
        canon_allowed = [_canon_crop(c) for c in allowed]
        filtered = {k: v for k, v in full_crops.items() if k in canon_allowed}
        if len(filtered) >= 3:
            data["crops"] = filtered

    default_rots = {
        "regionA": ["wheat", "lentil", "barley"],
        "regionB": ["wheat", "corn", "soybean"],
        "regionC": ["rice", "wheat", "mung_bean"],
    }
    raw_rot = rotation or default_rots.get(domain_reg, ["wheat", "lentil", "barley"])
    cur_rot = [_canon_crop(c) for c in raw_rot]
    for i, cid in enumerate(cur_rot):
        if cid not in data["crops"]:
            if cid in full_crops:
                data["crops"][cid] = full_crops[cid]
            else:
                cur_rot[i] = next(iter(data["crops"]))

    rec = scoring.recommend(weights, eff_ind, cur_rot, data=data, monte_carlo_runs=100)
    existing = rec["strategies"][0]
    best = rec["strategies"][1]
    region_meta = dict(data.get("region_meta", {}) or {})
    if v2_label:
        region_meta["name"] = v2_label
    ctx_out = {
        "region": domain_reg,
        "region_meta": region_meta,
        "rules": data.get("rules", {}),
        "thresholds": thresh,
        "indicators": {
            "rainfall_mm": eff_ind["rainfall_mm"],
            "rainfall_reference_mm": eff_ind["rainfall_reference_mm"],
            "soil_organic_carbon_g_per_kg": eff_ind["soil_organic_carbon_g_per_kg"],
            "soc_threshold_g_per_kg": eff_ind["soc_threshold_g_per_kg"],
        },
        "input_weights": weights,
        "adjusted_weights": rec["adjusted_weights"],
        "stress": rec["stress"],
        "ranking_stability_pct": rec["ranking_stability_pct"],
        "n_candidates": rec["n_candidates"],
        "existing": existing,
        "rank1": best,
        "alternatives": rec["strategies"][1:4],
        "rotations_to_avoid": rec.get("rotations_to_avoid", []),
        "v2_statistics": v2_stats,
        "graph_context": graph_ctx,
    }
    if indicators_by_region is None:
        _ENGINE_CTX_CACHE[cache_key] = ctx_out
    return ctx_out


# ---------------------------------------------------------------------------
# 5. Grounded Multilingual Response Generation (EN / FR / AR) + Refusal Path
# ---------------------------------------------------------------------------
def _build_refusal_response(
    question: str,
    lang: str,
    reason: str,
    engine_ctx: dict[str, Any],
    fallback_passages: list[dict[str, Any]],
) -> dict[str, Any]:
    reg_name = engine_ctx.get("region_meta", {}).get("name") or engine_ctx.get("region", "regionA")
    r1 = engine_ctx["rank1"]
    r1_rot = " → ".join(r1["rotation"])
    r1_score = round(r1["score"], 3)

    if lang == "ar":
        msg = (
            "لا يمكنني الإجابة على هذا السؤال من الأدلة الزراعية المراجعة في قاعدة بيانات Field Shift، "
            "ولن أقوم بالتخمين أو تقديم نصائح غير موثقة.\n\n"
            "**ما تغطيه الأدلة المراجعة لدينا:**\n"
            f"- تقييم الدورات الزراعية (سنتان، 3 سنوات، 4 أو 5 سنوات) لمنطقة **{reg_name}** (أعلى دورة مقترحة حالياً: `{r1_rot}` بنتيجة `score = {r1_score}`).\n"
            "- معايير المحرك (`criteria.water`، `criteria.soil`، `criteria.profit`، `criteria.risk`) وتأثير الإجهاد المائي (`water_stress`) ونقص الكربون العضوي (`soc_deficit`).\n"
            "- مسار النيتروجين والأسمدة لـ 3 سنوات (`trajectory_3yr.total_3yr_npk_kg_ha`) وخصم 25% بعد البقوليات (`legume_credit_applied`).\n"
            "- بيانات الأقمار الصناعية (NASA POWER، SoilGrids، MODIS NDVI، وحرائق NASA FIRMS)."
        )
    elif lang == "fr":
        msg = (
            "Je ne peux pas répondre à cette question à partir des guides agronomiques validés de Field Shift, "
            "et je ne formule aucune recommandation non vérifiée.\n\n"
            "**Ce que couvrent nos documents de référence :**\n"
            f"- La planification et les règles de rotation (cycles de 2, 3, 4 ou 5 ans) pour **{reg_name}** (meilleure rotation actuelle : `{r1_rot}` avec `score = {r1_score}`).\n"
            "- L'explication exacte des scores du moteur (`criteria.water`, `criteria.soil`, `criteria.profit`, `criteria.risk`, `stress.water_stress`, `stress.soc_deficit`).\n"
            "- La trajectoire d'azote et d'engrais sur 3 ans (`trajectory_3yr.total_3yr_npk_kg_ha`) et le crédit légumineuse de `-25%` NPK.\n"
            "- Les indicateurs satellites (NASA POWER, SoilGrids, MODIS NDVI et feux NASA FIRMS)."
        )
    else:
        msg = (
            "I cannot answer this question from Field Shift's reviewed agronomy guidance documents, "
            "and I do not guess or invent unverified crop advice.\n\n"
            "**Relevant guidance available in our reviewed corpus:**\n"
            f"- Crop rotation rules and rotation length options (2, 3, 4, or 5 years) for **{reg_name}** (current Rank 1 plan: `{r1_rot}` with `score = {r1_score}`).\n"
            "- Exact engine score breakdowns (`criteria.water`, `criteria.soil`, `criteria.profit`, `criteria.risk`, `stress.water_stress`, `stress.soc_deficit`).\n"
            "- 3-year soil nitrogen and NPK fertilizer trajectories (`trajectory_3yr.total_3yr_npk_kg_ha`) and the `-25%` post-legume NPK credit.\n"
            "- Satellite climate, SoilGrids SOC/pH, MODIS NDVI, and NASA FIRMS Fire Watch indicators."
        )

    citations = [
        {
            "chunk_id": p["chunk_id"],
            "doc_id": p["doc_id"],
            "title": p["title"],
            "section": p["section"],
            "file": p["file"],
            "score": p["score"],
            "excerpt": p["text"][:240] + ("…" if len(p["text"]) > 240 else ""),
        }
        for p in fallback_passages[:2]
    ]
    return {
        "answer": msg,
        "language": lang,
        "dir": "rtl" if lang == "ar" else "ltr",
        "direction": "rtl" if lang == "ar" else "ltr",
        "refused": True,
        "refusal_reason": reason,
        "citations": citations,
        "sources": citations,
        "engine_summary": _format_engine_summary(engine_ctx),
    }


def _format_engine_summary(ctx: dict[str, Any]) -> dict[str, Any]:
    ex = ctx["existing"]
    r1 = ctx["rank1"]
    r1_summary = {
        "rotation": r1["rotation"],
        "crops": r1["rotation"],
        "score": round(r1["score"], 3),
        "score_100": round(r1["score"] * 100),
        "criteria": {k: round(v, 3) for k, v in r1["criteria"].items()},
        "gross_income_dzd_ha": r1["gross_income_dzd_ha"],
        "ml_metrics": r1["ml_metrics"],
        "total_3yr_npk_kg_ha": r1["trajectory_3yr"]["total_3yr_npk_kg_ha"],
        "fertilizer_saved_vs_existing_kg_ha": r1["fertilizer_saved_vs_existing_kg_ha"],
        "final_nitrogen_kg_ha": r1["trajectory_3yr"]["final_nitrogen_kg_ha"],
        "ranking_stability_pct": ctx["ranking_stability_pct"],
    }
    v2 = ctx.get("v2_statistics") or {}
    drought = v2.get("drought") or {}
    awc = v2.get("awc") or {}
    gc = ctx.get("graph_context") or {}
    return {
        "region": ctx["region"],
        "region_name": ctx.get("region_meta", {}).get("name", ctx["region"]),
        "farming_system": ctx.get("region_meta", {}).get("farming_system", "rainfed"),
        "rotation_length": ctx.get("rules", {}).get("rotation_length", 3),
        "indicators": ctx["indicators"],
        "stress": ctx["stress"],
        "adjusted_weights": {k: round(v, 3) for k, v in ctx["adjusted_weights"].items()},
        "ranking_stability_pct": ctx["ranking_stability_pct"],
        "n_candidates": ctx["n_candidates"],
        "v2_statistics": {
            "trend_source": v2.get("trend_source"),
            "pipeline_code": v2.get("pipeline_code"),
            "rainfall_trend_mm_per_decade": v2.get("sen_slope_mm_per_decade"),
            "trend_window": v2.get("trend_window"),
            "mbb_ci_low_95": v2.get("mbb_ci_low_95_per_decade"),
            "mbb_ci_high_95": v2.get("mbb_ci_high_95_per_decade"),
            "statistically_significant_95": v2.get("statistically_significant_95"),
            "drought_frequency_pct": drought.get("drought_frequency_pct"),
            "severe_drought_years_count": len(drought.get("severe_drought_years") or []),
            "awc_mm_per_m": awc.get("awc_mm_per_m"),
        },
        "knowledge_graph": {
            "lines": list(gc.get("lines") or [])[:8],
            "comparison": list(gc.get("comparison") or [])[:3],
        },
        "existing": {
            "rotation": ex["rotation"],
            "crops": ex["rotation"],
            "passes_rules": ex.get("passes_rules", False),
            "score": round(ex["score"], 3),
            "score_100": round(ex["score"] * 100),
            "criteria": {k: round(v, 3) for k, v in ex["criteria"].items()},
            "gross_income_dzd_ha": ex["gross_income_dzd_ha"],
            "ml_metrics": ex["ml_metrics"],
            "total_3yr_npk_kg_ha": ex["trajectory_3yr"]["total_3yr_npk_kg_ha"],
            "final_nitrogen_kg_ha": ex["trajectory_3yr"]["final_nitrogen_kg_ha"],
        },
        "rank1": r1_summary,
        "top_plan": r1_summary,
    }


_CONCEPT_TO_CROP_ID = {
    "concept_wheat": "wheat",
    "concept_barley": "barley",
    "concept_lentil": "lentil",
    "concept_chickpea": "chickpea",
    "concept_faba": "faba",
    "concept_vetch": "vetch",
    "concept_canola": "canola",
    "concept_safflower": "safflower",
    "concept_sunflower": "sunflower",
    "concept_fallow": "fallow",
    "concept_corn": "corn",
    "concept_soybean": "soybean",
    "concept_sorghum": "sorghum",
    "concept_rice": "rice",
    "concept_mung": "mung_bean",
    "concept_oats": "oats",
    "concept_triticale": "triticale",
    "concept_pea": "field_pea",
    "concept_potato": "potato",
    "concept_sulla": "sulla",
    "concept_lupin": "lupin",
    "concept_onion": "onion",
    "concept_coriander": "coriander",
    "concept_alfalfa": "alfalfa",
    "concept_cotton": "cotton",
    "concept_millet": "pearl_millet",
    "concept_flax": "flax",
    "concept_groundnut": "groundnut",
    "concept_pigeon_pea": "pigeon_pea",
    "concept_berseem": "berseem",
    "concept_sesame": "sesame",
}


def _detect_question_region(q_concepts: list[str], fallback_region: str) -> tuple[str, bool]:
    """Return (effective_region, region_explicitly_in_question)."""
    if "concept_region_kansas" in q_concepts:
        return "regionB", True
    if "concept_region_punjab" in q_concepts:
        return "regionC", True
    if "concept_region_setif" in q_concepts:
        return "regionA", True
    return fallback_region, False


def _load_all_base_crops() -> dict[str, dict[str, Any]]:
    crops_map: dict[str, dict[str, Any]] = {}
    for rid in ("regionA", "regionB", "regionC"):
        try:
            reg_d = scoring.load_region(rid, ROOT)
            for cid, cspec in reg_d.get("crops", {}).items():
                if cid not in crops_map:
                    crops_map[cid] = dict(cspec, sample_region=rid)
        except Exception:
            pass
    return crops_map


CROP_AGRONOMIC_SPECS: dict[str, dict[str, Any]] = {
    "wheat": {
        "sowing": "15 Nov – 10 Dec", "harvest": "20 June – 10 July",
        "seed_rate": "130–150 kg/ha", "depth": "4–5 cm",
        "yield_q": 20.0, "price_dzd": 6000, "gross_dzd": 120000,
        "diseases": "Breaks Fusarium crown rot (Fusarium culmorum) and Cephalosporium stripe",
    },
    "barley": {
        "sowing": "10 Nov – 5 Dec", "harvest": "10 June – 30 June",
        "seed_rate": "100–120 kg/ha", "depth": "3–4 cm",
        "yield_q": 23.0, "price_dzd": 3400, "gross_dzd": 78200,
        "diseases": "Early May heading escapes terminal drought and Sirocco heat",
    },
    "lentil": {
        "sowing": "20 Nov – 15 Dec", "harvest": "1 June – 20 June",
        "seed_rate": "60–80 kg/ha", "depth": "3–4 cm",
        "yield_q": 12.0, "price_dzd": 14000, "gross_dzd": 168000,
        "n_credit": "+20 kg N/ha",
        "diseases": "Requires 2-year rest against Ascochyta rabiei and Orobanche broomrape",
    },
    "chickpea": {
        "sowing": "1 Dec – 15 Jan (winter) / 1–25 March (spring)", "harvest": "20 June – 15 July",
        "seed_rate": "80–100 kg/ha", "depth": "5–6 cm",
        "yield_q": 14.0, "price_dzd": 13500, "gross_dzd": 189000,
        "n_credit": "+25 kg N/ha",
        "diseases": "Winter cultivars resist Ascochyta; deep taproot extracts subsoil water",
    },
    "faba": {
        "sowing": "25 Oct – 25 Nov", "harvest": "20–31 May",
        "seed_rate": "140–180 kg/ha", "depth": "6–8 cm",
        "yield_q": 16.0, "price_dzd": 10500, "gross_dzd": 168000,
        "n_credit": "+35 kg N/ha",
        "diseases": "Monitored for Botrytis chocolate spot; massive nitrogen fixation",
    },
    "safflower": {
        "sowing": "1–25 March", "harvest": "15 July – 5 Aug",
        "seed_rate": "20–25 kg/ha", "depth": "2–3 cm",
        "yield_q": 14.0, "price_dzd": 8800, "gross_dzd": 123200,
        "diseases": "Deep taproot (>2 m) breaks dense calcareous hardpans",
    },
    "sulla": {
        "sowing": "15 Oct – 15 Nov", "harvest": "May (hay / forage)",
        "seed_rate": "25–30 kg/ha", "depth": "1–2 cm",
        "yield_q": 40.0, "price_dzd": 2200, "gross_dzd": 88000,
        "n_credit": "+30 kg N/ha",
        "diseases": "Highly adapted to calcareous soils; regenerates soil organic carbon",
    },
    "alfalfa": {
        "sowing": "15 Sep – 20 Oct or 1 Mar – 10 Apr", "harvest": "3–4 cuts/year",
        "seed_rate": "20–25 kg/ha", "depth": "1–2 cm",
        "yield_q": 65.0, "price_dzd": 2400, "gross_dzd": 156000,
        "n_credit": "+45 kg N/ha",
        "diseases": "Recharges deep soil carbon, breaks nematode cycles",
    },
}

def _build_crop_specific_block(crop_ids: list[str], lang: str, active_region: str) -> str:
    all_crops = _load_all_base_crops()
    try:
        reg_crops = scoring.load_region(active_region, ROOT).get("crops", {})
    except Exception:
        reg_crops = {}

    lines = []
    for cid in crop_ids[:3]:
        c = reg_crops.get(cid) or all_crops.get(cid)
        if not c:
            continue
        spec = CROP_AGRONOMIC_SPECS.get(cid, {})
        r_min, r_max = c.get("rain_opt", (300, 650))
        p_min, p_max = c.get("ph_opt", (6.0, 8.0))
        fam = c.get("family", "crop")
        w_need = round(float(c.get("water_need", 0.5)) * 100)
        drought = round(float(c.get("drought_tolerance", 0.5)) * 100)
        n_imp = int(c.get("n_impact", 0))
        npk_base = int(c.get("npk_base", 100))
        fert = c.get("fert_name", "NPK")
        yld = spec.get("yield_q") or c.get("yield_potential", "N/A")
        price = spec.get("price_dzd") or c.get("oaic_ccls_price_dzd_q", 6000)
        gross = spec.get("gross_dzd") or c.get("gross_income_dzd_ha", 120000)
        sow = spec.get("sowing", "15 Nov – 10 Dec")
        harv = spec.get("harvest", "June")
        seed_r = spec.get("seed_rate", "100–120 kg/ha")
        depth = spec.get("depth", "3–4 cm")
        dis = spec.get("diseases") or c.get("risk_note", "")

        if lang == "ar":
            lines.append(
                f"- **بطاقة المحصول الدقيقة `{cid}` ({fam}):**\n"
                f"  • مواعيد البذر والحصاد: بذر `{sow}`، حصاد `{harv}`.\n"
                f"  • معدل وعمق البذر: `{seed_r}` على عمق `{depth}`.\n"
                f"  • المردود والعائد المالي المرجعي: `{yld} q/ha` بسعر `{price} دج/ق` (العائد: `{gross:,} دج/هكتار`).\n"
                f"  • الماء والتربة: استهلاك مياه `{w_need}%`، تحمل جفاف `{drought}%`، أمطار مثلى `{r_min:.0f}–{r_max:.0f} مم/سنة`، حموضة `pH {p_min:.1f}–{p_max:.1f}`.\n"
                f"  • التسميد والوقاية: أثر النيتروجين `{n_imp:+d} kg N/ha/yr`، سماد أساسي `{npk_base} kg/ha ({fert})`. {dis}"
            )
        elif lang == "fr":
            lines.append(
                f"- **Fiche agronomique détaillée `{cid}` ({fam}) :**\n"
                f"  • Calendrier : semis `{sow}`, récolte `{harv}`.\n"
                f"  • Dose et profondeur : `{seed_r}` à `{depth}` de profondeur.\n"
                f"  • Rendement et revenu : `{yld} q/ha` au prix de `{price} DZD/q` (Revenu brut : `{gross:,} DZD/ha`).\n"
                f"  • Eau et sol : besoin en eau `{w_need}%`, tolérance sécheresse `{drought}%`, pluie `{r_min:.0f}–{r_max:.0f} mm/an`, `pH {p_min:.1f}–{p_max:.1f}`.\n"
                f"  • Fertilisation & santé : bilan azote `{n_imp:+d} kg N/ha/an`, engrais `{npk_base} kg/ha ({fert})`. {dis}"
            )
        else:
            lines.append(
                f"- **Detailed Agronomic Profile `{cid}` ({fam}):**\n"
                f"  • Calendar: sowing `{sow}`, harvest `{harv}`.\n"
                f"  • Seeding rate & depth: `{seed_r}` at `{depth}` depth.\n"
                f"  • Yield & revenue benchmark: `{yld} q/ha` @ `{price} DZD/q` (Gross income: `{gross:,} DZD/ha`).\n"
                f"  • Water & soil: water demand `{w_need}%`, drought tolerance `{drought}%`, rainfall `{r_min:.0f}–{r_max:.0f} mm/yr`, `pH {p_min:.1f}–{p_max:.1f}`.\n"
                f"  • Nutrients & crop safety: soil nitrogen impact `{n_imp:+d} kg N/ha/yr`, base fertilizer `{npk_base} kg/ha ({fert})`. {dis}"
            )
    if not lines:
        return ""
    header = {
        "ar": "**البيانات الحقلية المعتمدة للمحاصيل المطلوبة (`domain/crops_base.csv`):**",
        "fr": "**Données agronomiques certifiées des cultures demandées (`domain/crops_base.csv`) :**",
        "en": "**Certified Agronomic Specifications for Requested Crop(s) (`domain/crops_base.csv`):**",
    }.get(lang, "**Agronomic Data for Requested Crop(s):**")
    return header + "\n" + "\n".join(lines)


def _synthesize_grounded_answer(
    question: str,
    lang: str,
    passages: list[dict[str, Any]],
    engine_ctx: dict[str, Any],
) -> str:
    """Synthesize a question-first grounded explanation in `lang` citing retrieved docs and exact engine scores."""
    ex = engine_ctx["existing"]
    r1 = engine_ctx["rank1"]
    ind = engine_ctx["indicators"]
    st = engine_ctx["stress"]
    aw = engine_ctx["adjusted_weights"]
    reg_meta = engine_ctx.get("region_meta", {})
    reg_name = reg_meta.get("name") or engine_ctx["region"]
    farming_sys = reg_meta.get("farming_system", "rainfed")
    rules = engine_ctx.get("rules", {})

    ex_rot = " → ".join(ex["rotation"])
    r1_rot = " → ".join(r1["rotation"])
    ex_sc = round(ex["score"], 3)
    r1_sc = round(r1["score"], 3)
    delta_sc = r1_sc - ex_sc

    c_r1 = r1["criteria"]
    c_ex = ex["criteria"]
    ml_r1 = r1["ml_metrics"]
    traj_r1 = r1["trajectory_3yr"]
    npk_saved = r1["fertilizer_saved_vs_existing_kg_ha"]
    stab = engine_ctx["ranking_stability_pct"]

    q_concepts = detect_concepts(question)
    cite_ids = [f"[{p['doc_id']} · {p['section']}]" for p in passages[:3]]
    cite_str = " ".join(cite_ids)
    top_passage = passages[0] if passages else None
    top_excerpt = ""
    if top_passage:
        cleaned_lines = []
        for line in top_passage["text"].splitlines():
            s = line.strip()
            if not s or s.startswith("#") or re.match(r"^\|[\s:|-]+\|$", s):
                continue
            s = re.sub(r"^\|+|\|+$", "", s).strip()
            s = re.sub(r"\s*\|\s*", " · ", s)
            if s:
                cleaned_lines.append(s)
        raw_txt = " ".join(cleaned_lines)
        top_excerpt = raw_txt[:340] + ("…" if len(raw_txt) > 340 else "")

    asked_crop_ids = [
        _CONCEPT_TO_CROP_ID[c]
        for c in q_concepts
        if c in _CONCEPT_TO_CROP_ID
    ]
    crop_block = _build_crop_specific_block(asked_crop_ids, lang, engine_ctx["region"]) if asked_crop_ids else ""

    q_low = normalize_arabic(question.lower())
    asks_period = "concept_period_years" in q_concepts or any(w in q_low for w in ("2-year", "3-year", "4-year", "5-year", "period", "year", "ans", "années", "سنوات", "سنتين", "اربع", "خمس", "فتره", "مده"))
    asks_fert = "concept_nitrogen_fertilizer" in q_concepts or "concept_legume" in q_concepts
    asks_water = "concept_water" in q_concepts or "concept_irrigation" in q_concepts
    asks_scores = "concept_score_engine" in q_concepts or any(
        w in q_low
        for w in (
            "score", "rank", "why", "pourquoi", "لماذا", "نقاط", "ترتيب",
            "plant", "grow", "recommend", "best", "planter", "cultiver", "أزرع", "ازرع", "نغرس", "أفضل", "افضل",
        )
    )
    asks_trend = any(
        w in q_low
        for w in (
            "trend", "slope", "drying", "drier", "declin", "significant",
            "séch", "assech", "اتجاه", "ميل", "تجفاف", "انخفاض",
        )
    ) or ("concept_water" in q_concepts and any(w in q_low for w in ("ans", "années", "years", "سنوات")))

    # Build the v2 rainfall-trend paragraph (Theil-Sen slope + MBB 95% CI),
    # explicitly distinguishing a statistically confirmed trend from an
    # unconfirmed / noisy one.
    trend_text = ""
    v2 = engine_ctx.get("v2_statistics") or {}
    if v2.get("sen_slope_mm_per_decade") is not None:
        slope = float(v2["sen_slope_mm_per_decade"])
        lo = v2.get("mbb_ci_low_95_per_decade")
        hi = v2.get("mbb_ci_high_95_per_decade")
        sig = v2.get("statistically_significant_95")
        window = v2.get("trend_window") or "the 30-year window"
        has_ci = lo is not None and hi is not None
        ci_txt = f"`[{lo:+.1f}, {hi:+.1f}] mm/decade`" if has_ci else ""
        if sig:
            trend_texts = {
                "en": (
                    "**Rainfall trend — statistically confirmed (Theil-Sen slope + moving block bootstrap):**\n"
                    f"- Theil-Sen slope: `{slope:+.1f} mm/decade` over `{window}`.\n"
                    + (f"- Bootstrap 95% CI: {ci_txt} — excludes zero, so the drying trend is statistically significant at the 95% level (`statistically_significant_95 = true`).\n" if has_ci else "")
                    + "- Implication: treat the decline as real when sizing the rotation — favor drought-tolerant, low-water-need crops."
                ),
                "fr": (
                    "**Tendance pluviométrique — statistiquement confirmée (pente de Theil-Sen + bootstrap par blocs mobiles) :**\n"
                    f"- Pente de Theil-Sen : `{slope:+.1f} mm/décennie` sur `{window}`.\n"
                    + (f"- IC bootstrap 95 % : {ci_txt} — exclut zéro, la tendance à l'assèchement est donc statistiquement significative au seuil de 95 % (`statistically_significant_95 = true`).\n" if has_ci else "")
                    + "- Implication : considérez ce déclin comme réel — privilégiez des cultures tolérantes à la sécheresse et sobres en eau."
                ),
                "ar": (
                    "**اتجاه هطول الأمطار — مؤكد إحصائياً (ميل ثيل-سن + بووتستراب الكتل المتحركة):**\n"
                    f"- ميل ثيل-سن: `{slope:+.1f} مم/عقد` خلال `{window}`.\n"
                    + (f"- فترة الثقة البوتسترابية 95%: {ci_txt} — لا تشمل الصفر، لذا الاتجاه نحو الجفاف مؤكد إحصائياً عند مستوى 95% (`statistically_significant_95 = true`).\n" if has_ci else "")
                    + "- الاستنتاج: عند اختيار الدورة الزراعية عامل هذا الانخفاض كأمر حقيقي وفضّل المحاصيل المتحملة للجفاف قليلة استهلاك المياه."
                ),
            }
        else:
            trend_texts = {
                "en": (
                    "**Rainfall trend — observed but NOT statistically confirmed:**\n"
                    f"- Theil-Sen slope: `{slope:+.1f} mm/decade` over `{window}`"
                    + (f", but the bootstrap 95% CI {ci_txt} includes zero (`statistically_significant_95 = false`)." if has_ci else " (`statistically_significant_95 = false`).")
                    + "\n- Implication: treat this as natural year-to-year variability — do not overhaul the rotation because of it."
                ),
                "fr": (
                    "**Tendance pluviométrique — observée mais NON confirmée statistiquement :**\n"
                    f"- Pente de Theil-Sen : `{slope:+.1f} mm/décennie`"
                    + (f", mais l'IC bootstrap 95 % {ci_txt} inclut zéro (`statistically_significant_95 = false`)." if has_ci else " (`statistically_significant_95 = false`).")
                    + "\n- Implication : traitez cela comme une variabilité naturelle d'une année à l'autre — ne bouleversez pas la rotation pour autant."
                ),
                "ar": (
                    "**اتجاه هطول الأمطار — ملحوظ لكنه غير مؤكد إحصائياً:**\n"
                    f"- ميل ثيل-سن: `{slope:+.1f} مم/عقد`"
                    + (f"، لكن فترة الثقة البوتسترابية 95% {ci_txt} تشمل الصفر (`statistically_significant_95 = false`)." if has_ci else " (`statistically_significant_95 = false`).")
                    + "\n- الاستنتاج: عامله كتباين طبيعي من سنة لأخرى ولا تغيّر دورتك الزراعية بسببه."
                ),
            }
        trend_text = trend_texts.get(lang, trend_texts["en"])

    # Knowledge-graph relations + structured cross-region comparison + rule_trace weaving
    gc = engine_ctx.get("graph_context") or {}
    glines = list(gc.get("lines") or [])[:6]
    comparisons = list(gc.get("comparison") or [])[:3]
    rule_trace = (engine_ctx.get("v2_statistics") or {}).get("rule_trace") or {}
    wanted_rules: list[str] = []
    if asks_water and "water_stress" in rule_trace:
        wanted_rules.append("water_stress")
    if asks_fert and "organic_carbon" in rule_trace:
        wanted_rules.append("organic_carbon")
    if asks_trend and "rainfall_trend" in rule_trace:
        wanted_rules.append("rainfall_trend")
    if (crop_block or asks_scores) and "soil_water_capacity" in rule_trace:
        wanted_rules.append("soil_water_capacity")
    if not wanted_rules:
        wanted_rules = [
            k for k in ("water_stress", "organic_carbon", "soil_water_capacity", "historical_drought")
            if k in rule_trace
        ][:2]

    def _sig_txt(sig: Any, lg: str) -> str:
        if sig is True:
            return {
                "en": "trend statistically confirmed (95% CI)",
                "fr": "tendance confirmée statistiquement (IC 95 %)",
                "ar": "اتجاه مؤكد إحصائياً (فترة ثقة 95%)",
            }[lg]
        if sig is False:
            return {
                "en": "trend NOT statistically confirmed",
                "fr": "tendance NON confirmée statistiquement",
                "ar": "اتجاه غير مؤكد إحصائياً",
            }[lg]
        return {
            "en": "trend significance not tested",
            "fr": "significativité de la tendance non testée",
            "ar": "لم يتم اختبار معنوية الاتجاه",
        }[lg]

    def _cmp_lines(lg: str) -> list[str]:
        out: list[str] = []
        for c in comparisons:
            a, b = c.get("a_label"), c.get("b_label")
            sa, sb = c.get("slope_a_mm_per_decade"), c.get("slope_b_mm_per_decade")
            if sa is None or sb is None:
                continue
            ra, rb = c.get("rainfall_a_mm"), c.get("rainfall_b_mm")
            if lg == "fr":
                rain_txt = f" ; pluviométrie moyenne {ra:.0f} vs {rb:.0f} mm/an" if ra is not None and rb is not None else ""
                out.append(
                    f"- **{a} vs {b} :** tendance Theil-Sen {sa:+.1f} vs {sb:+.1f} mm/décennie — "
                    f"{a} : {_sig_txt(c.get('significant_a'), lg)}, {b} : {_sig_txt(c.get('significant_b'), lg)}{rain_txt}."
                )
            elif lg == "ar":
                rain_txt = f"، متوسط الأمطار {ra:.0f} مقابل {rb:.0f} مم/سنة" if ra is not None and rb is not None else ""
                out.append(
                    f"- **{a} في مواجهة {b}:** ميل ثيل-سن {sa:+.1f} مقابل {sb:+.1f} مم/عقد — "
                    f"{a}: {_sig_txt(c.get('significant_a'), lg)}، {b}: {_sig_txt(c.get('significant_b'), lg)}{rain_txt}."
                )
            else:
                rain_txt = f"; mean rainfall {ra:.0f} vs {rb:.0f} mm/yr" if ra is not None and rb is not None else ""
                out.append(
                    f"- **{a} vs {b}:** Theil-Sen trend {sa:+.1f} vs {sb:+.1f} mm/decade — "
                    f"{a}: {_sig_txt(c.get('significant_a'), lg)}, {b}: {_sig_txt(c.get('significant_b'), lg)}{rain_txt}."
                )
        return out

    _graph_headers = {
        "en": "**Structured knowledge-graph relations (verified pipeline facts):**",
        "fr": "**Relations structurées du graphe de connaissances (faits vérifiés du pipeline) :**",
        "ar": "**علاقات رسم المعرفة المهيكلة (حقائق مدققة من خط المعالجة):**",
    }
    _cmp_headers = {
        "en": "**Cross-region comparison (from the knowledge graph):**",
        "fr": "**Comparaison inter-régions (issue du graphe de connaissances) :**",
        "ar": "**مقارنة بين المناطق (من رسم المعرفة):**",
    }
    _rule_headers = {
        "en": "**Verified rule explanations (rule_trace):**",
        "fr": "**Explications vérifiées des règles (rule_trace) :**",
        "ar": "**الشروح المدققة للقواعد (rule_trace):**",
    }

    def _graph_part(lg: str) -> str:
        if not glines and not comparisons:
            return ""
        lines = [_graph_headers.get(lg, _graph_headers["en"])]
        lines += [f"- {l}" for l in glines]
        cl = _cmp_lines(lg)
        if cl:
            lines.append(_cmp_headers.get(lg, _cmp_headers["en"]))
            lines += [f"- {l}" for l in cl]
        return "\n".join(lines)

    def _rule_part(lg: str) -> str:
        if not wanted_rules:
            return ""
        bullets = [f"- {str(rule_trace[k])[:320]}" for k in wanted_rules if k in rule_trace]
        if not bullets:
            return ""
        return "\n".join([_rule_headers.get(lg, _rule_headers["en"])] + bullets)

    if lang == "ar":
        parts = []
        if crop_block:
            parts.append(crop_block)
        if asks_period:
            parts.append(
                f"**الإجابة المباشرة حول فترة الدورة الزراعية (سنتين، 3، 4، أو 5 سنوات — `rotation_length = {rules.get('rotation_length', 3)}`):**\n"
                "تُعتمد دورة **3 سنوات** كخط أساس لأنها تجمع بين الحبوب والبقوليات المثبتة للنيتروجين والمحاصيل الزيتية/العلفية مع منع تكرار نفس العائلة (`forbid_consecutive_same_family = true`) ومنح فترة راحة سنتين للبقوليات ضد الأمراض الفطرية والهالوك. ومع ذلك، يدعم المحرك (`engine/scoring.py`) والواجهة في الخطوة 2 اختيار:\n"
                "- **دورة سنتين (`2 Years`):** مناوبة سريعة حبوب–بقوليات (مثل `wheat → lentil` في الجزائر، `corn → soybean` في كانساس، أو `rice → mung_bean` في البنجاب).\n"
                "- **دورة 4 سنوات (`4 Years`):** حبوب ← بقوليات ← حبوب ثانوية ← محصول زيتي عميق الجذور (`wheat → lentil → barley → safflower`).\n"
                "- **دورة 5 سنوات (`5 Years`):** إدخال الأعلاف المعمرة مثل الفصة (`alfalfa`) أو السلة (`sulla`) لاستعادة الكربون العضوي [DOC-AGRO-001]."
            )
        if asks_fert:
            parts.append(
                "**البقوليات المثبتة للنيتروجين وتوفير سماد `NPK` (عبر الأقاليم والمحاصيل الـ 35):**\n"
                "- تثبت البقوليات النيتروجين الجوي (`faba +35`, `alfalfa +45`, `hairy_vetch +35`, `berseem +32`, `sulla +30`, `soybean +30`, `mung_bean +28`, `chickpea +25`, `field_pea +24`, `lentil +20 kg N/ha/yr`) وتمنح المحصول التالي خصماً قدره **30%** من جرعة السماد الكيميائي.\n"
                f"- في خطتك الحالية، إجمالي السماد للخطة الأولى هو `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha` (توفير `{npk_saved:+d} kg/ha` مقارنة بدورتك الحالية) مع رصيد نيتروجين نهائي `final_nitrogen_kg_ha = {traj_r1['final_nitrogen_kg_ha']} kg/ha`."
            )
        if asks_water:
            parts.append(
                "**تحمل الجفاف وكفاءة المياه عبر المحاصيل:**\n"
                "- أعلى المحاصيل تحملاً للجفاف وأقلها استهلاكاً للمياه هي: القرطم (`safflower` احتياج مائي `35%`)، الدخن (`pearl_millet 28%` / `proso_millet 30%`)، الكزبرة (`coriander 34%`)، الماش (`mung_bean 36%`)، السلة (`sulla 38%`)، الشعير (`barley 40%`)، العدس (`lentil 40%`)، الذرة الرفيعة (`sorghum 44%`)، والحمص (`chickpea 45%`).\n"
                + ("- **ملاحظة الري (`G9`):** يتم حساب `water_stress` من أمطار NASA POWER؛ وفي المزارع المروية قد يختلف الإجهاد الفعلي." if farming_sys == "irrigated" else "")
        )
        if asks_trend and trend_text:
            parts.append(trend_text)
        gp = _graph_part("ar")
        if gp:
            parts.append(gp)
        rp = _rule_part("ar")
        if rp:
            parts.append(rp)
        if top_excerpt and not asks_scores:
            parts.append(f"**مقتطف موثق من الدليل الزراعي ([{top_passage['doc_id']} · {top_passage['section']}]):**\n> {top_excerpt}")

        score_block = (
            f"**ملخص نقاط المحرك لمنطقة {reg_name} ({'مروية' if farming_sys == 'irrigated' else 'بعلية/مطرية'}):**\n"
            f"- **الترتيب الأول المقترح (`Rank 1`):** `{r1_rot}` حصل على **`score = {r1_sc:.3f}`** (`{round(r1_sc * 100)}/100`) مقابل دورتك `{ex_rot}` (**`score = {ex_sc:.3f}`**، الفرق `{delta_sc:+.3f}`).\n"
            f"- **تفصيل المعايير (`criteria`):** المياه `criteria.water = {c_r1['water']:.3f}`، التربة `criteria.soil = {c_r1['soil']:.3f}`، الربح `criteria.profit = {c_r1['profit']:.3f}` (`gross_income_dzd_ha = {r1['gross_income_dzd_ha']}`)، الأمان من المخاطر `criteria.risk = {c_r1['risk']:.3f}`.\n"
            f"- **الإجهاد والأوزان والسماد:** `water_stress = {st['water_stress']:.3f}`، `soc_deficit = {st['soc_deficit']:.3f}`، `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha`، واستقرار مونت كارلو `ranking_stability_pct = {stab}%`."
        )
        if asks_scores or not parts:
            parts.insert(0, score_block)
        else:
            parts.append(
                f"*مرجع نقاط خطتك الحالية ({reg_name}): `{r1_rot}` حصل على **`score = {r1_sc:.3f}`** مقابل `{ex_rot}` (**`score = {ex_sc:.3f}`**، المياه `criteria.water = {c_r1['water']:.3f}`، التربة `criteria.soil = {c_r1['soil']:.3f}`، السماد `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha`).*"
            )
        parts.append(f"**المصادر المرجعية المعتمدة:** {cite_str}")
        return "\n\n".join(parts)

    if lang == "fr":
        parts = []
        if crop_block:
            parts.append(crop_block)
        if asks_period:
            parts.append(
                f"**Réponse directe sur la durée de rotation (2, 3, 4 ou 5 ans — `rotation_length = {rules.get('rotation_length', 3)}`) :**\n"
                "Le cycle de **3 ans** est la valeur par défaut car il alterne céréale, légumineuse fixatrice d'azote et culture de rupture sans répéter la même famille (`forbid_consecutive_same_family = true`) et assure une coupure sanitaire de 2 ans contre l'anthracnose (*Ascochyta*) et l'orobanche. Le moteur (`engine/scoring.py`) et l'étape 2 prennent aussi en charge :\n"
                "- **2 ans (`2 Years`) :** rotation rapide céréale–légumineuse (`wheat → lentil`, `corn → soybean`, `rice → mung_bean`).\n"
                "- **4 ans (`4 Years`) :** céréale → légumineuse → céréale secondaire → oléagineux à racine pivotante (`wheat → lentil → barley → safflower`).\n"
                "- **5 ans (`5 Years`) :** intégration de fourrages pérennes comme la luzerne (`alfalfa`) ou le sainfoin (`sulla`) pour restaurer le carbone organique du sol [DOC-AGRO-001]."
            )
        if asks_fert:
            parts.append(
                "**Fixation biologique d'azote et économie d'engrais `NPK` :**\n"
                "- Les légumineuses enrichissent le sol en azote (`alfalfa +45`, `faba +35`, `hairy_vetch +35`, `berseem +32`, `sulla +30`, `soybean +30`, `mung_bean +28`, `chickpea +25`, `field_pea +24`, `lentil +20 kg N/ha/an`) et réduisent de **30%** la dose d'engrais synthétique de la culture suivante.\n"
                f"- Sur 3 ans, le plan Rang 1 requiert `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha` (économie de `{npk_saved:+d} kg/ha` vs rotation actuelle) et atteint `final_nitrogen_kg_ha = {traj_r1['final_nitrogen_kg_ha']} kg/ha`."
            )
        if asks_water:
            parts.append(
                "**Cultures les plus sobres en eau et tolérantes à la sécheresse :**\n"
                "- Parmi nos 35 cultures validées, les plus sobres sont : le carthame (`safflower`, besoin en eau `35%`), le mil (`pearl_millet 28%`, `proso_millet 30%`), la coriandre (`34%`), le haricot mungo (`mung_bean 36%`), le sulla (`sulla 38%`), l'orge (`barley 40%`), la lentille (`lentil 40%`), le sorgho (`sorghum 44%`) et le pois chiche (`chickpea 45%`).\n"
                + ("- **Note Irrigation (`G9`) :** Le stress hydrique (`water_stress`) est calculé à partir des pluies NASA POWER ; les exploitations irriguées peuvent différer." if farming_sys == "irrigated" else "")
        )
        if asks_trend and trend_text:
            parts.append(trend_text)
        gp = _graph_part("fr")
        if gp:
            parts.append(gp)
        rp = _rule_part("fr")
        if rp:
            parts.append(rp)
        if top_excerpt and not asks_scores:
            parts.append(f"**Extrait vérifié du guide agronomique ([{top_passage['doc_id']} · {top_passage['section']}]) :**\n> {top_excerpt}")

        score_block = (
            f"**Synthèse des scores du moteur ({reg_name}, système {'irrigué' if farming_sys == 'irrigated' else 'pluvial'}) :**\n"
            f"- **Rotation Rang 1 (`Rank 1`) :** `{r1_rot}` obtient **`score = {r1_sc:.3f}`** (`{round(r1_sc * 100)}/100`) contre **`score = {ex_sc:.3f}`** pour `{ex_rot}` (écart `{delta_sc:+.3f}`).\n"
            f"- **Critères (`criteria`) :** Eau `criteria.water = {c_r1['water']:.3f}`, Sol `criteria.soil = {c_r1['soil']:.3f}`, Profit `criteria.profit = {c_r1['profit']:.3f}` (`gross_income_dzd_ha = {r1['gross_income_dzd_ha']}`), Risque `criteria.risk = {c_r1['risk']:.3f}`.\n"
            f"- **Stress, NPK & Stabilité :** `water_stress = {st['water_stress']:.3f}`, `soc_deficit = {st['soc_deficit']:.3f}`, `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha`, stabilité Monte Carlo `ranking_stability_pct = {stab}%`."
        )
        if asks_scores or not parts:
            parts.insert(0, score_block)
        else:
            parts.append(
                f"*Référence score ({reg_name}) : `{r1_rot}` obtient **`score = {r1_sc:.3f}`** contre `{ex_rot}` (**`score = {ex_sc:.3f}`**, Eau `criteria.water = {c_r1['water']:.3f}`, Sol `criteria.soil = {c_r1['soil']:.3f}`, NPK `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha`).*"
            )
        parts.append(f"**Sources documentaires citées :** {cite_str}")
        return "\n\n".join(parts)

    # Default: English ('en')
    parts = []
    if crop_block:
        parts.append(crop_block)
    if asks_period:
        parts.append(
            f"**Direct Answer: Why 3 Years & Choosing 2, 4, or 5-Year Rotations (`rotation_length = {rules.get('rotation_length', 3)}`):**\n"
            "A **3-year cycle** is the default baseline because it breaks back-to-back cereal root diseases (`forbid_consecutive_same_family = true`), enforces a 2-year phytosanitary rest for pulses (*Ascochyta* blight, *Orobanche*), and combines a primary cereal, a nitrogen-fixing legume, and a break crop. Both Step 2 in the UI and `engine/scoring.py` also support:\n"
            "- **2-Year Cycle (`2 Years`):** Fast cereal–legume alternation (`wheat → lentil` in dryland plateaus, `corn → soybean` in Kansas, or `rice → mung_bean` in Punjab).\n"
            "- **4-Year Cycle (`4 Years`):** Cereal → Pulse → Secondary Cereal → Deep-rooted Oilseed (`wheat → lentil → barley → safflower`) for 3-year *Sclerotinia* and nematode suppression.\n"
            "- **5-Year Cycle (`5 Years`):** Multi-year forage legume leys (`alfalfa` or `sulla`) to rebuild Soil Organic Carbon (`SOC`) on depleted soils [DOC-AGRO-001]."
        )
    if asks_fert:
        parts.append(
            "**Legume Biological Nitrogen Fixation & 3-Year `NPK` Savings:**\n"
            "- Nitrogen-fixing legumes replenish soil mineral nitrogen (`alfalfa +45`, `faba +35`, `hairy_vetch +35`, `berseem +32`, `sulla +30`, `soybean +30`, `mung_bean +28`, `chickpea +25`, `field_pea +24`, `lentil +20 kg N/ha/yr`) and trigger a **30% synthetic NPK discount** on the following crop.\n"
            f"- For your active plan, Rank 1 requires `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha` (saving `{npk_saved:+d} kg/ha` vs your current rotation) and finishes at `final_nitrogen_kg_ha = {traj_r1['final_nitrogen_kg_ha']} kg/ha` and `final_soil_health_pct = {traj_r1['final_soil_health_pct']}%`."
        )
    if asks_water:
        parts.append(
            "**Drought Tolerance & Water Efficiency Across the 35 Validated Crops:**\n"
            "- Lowest water demand and highest drought resilience: Pearl Millet (`water_need 28%`, `drought_tolerance 85%`), Proso Millet (`30%`), Sesame (`30%`), Coriander (`34%`), Safflower (`35%`, `drought_tolerance 90%`), Mung Bean (`36%`), Sulla (`38%`), Barley (`40%`), Lentil (`40%`), Field Pea (`42%`), Grain Sorghum (`44%`), and Chickpea (`45%`).\n"
            + ("- **Irrigation Disclosure (`G9`):** `water_stress` is computed from NASA POWER rainfall; canal and tube-well irrigated farms may experience different field moisture stress." if farming_sys == "irrigated" else "")
        )
    if asks_trend and trend_text:
        parts.append(trend_text)
    gp = _graph_part("en")
    if gp:
        parts.append(gp)
    rp = _rule_part("en")
    if rp:
        parts.append(rp)
    if top_excerpt and not asks_scores:
        parts.append(f"**Grounded Guidance Excerpt ([{top_passage['doc_id']} · {top_passage['section']}]):**\n> {top_excerpt}")

    score_block = (
        f"**Engine Score Reference ({reg_name} — {farming_sys.capitalize()} system):**\n"
        f"- **Rank 1 Recommended Rotation:** `{r1_rot}` achieves **`score = {r1_sc:.3f}`** (`{round(r1_sc * 100)}/100`) compared with `{ex_rot}` at **`score = {ex_sc:.3f}`** (delta `{delta_sc:+.3f}`).\n"
        f"- **Criterion Scores (`criteria`):** Water `criteria.water = {c_r1['water']:.3f}` (vs `{c_ex['water']:.3f}`), Soil `criteria.soil = {c_r1['soil']:.3f}` (vs `{c_ex['soil']:.3f}`), Profit `criteria.profit = {c_r1['profit']:.3f}` (`gross_income_dzd_ha = {r1['gross_income_dzd_ha']}`), Risk safety `criteria.risk = {c_r1['risk']:.3f}`.\n"
        f"- **Climate/Soil Stress & NPK (`stress`, `adjusted_weights`, `trajectory_3yr`):** Rainfall `{ind['rainfall_mm']:.1f} mm` vs `{ind['rainfall_reference_mm']:.1f} mm` (`water_stress = {st['water_stress']:.3f}`), SoilGrids SOC `{ind['soil_organic_carbon_g_per_kg']:.2f} g/kg` (`soc_deficit = {st['soc_deficit']:.3f}`), `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha`, and Monte Carlo stability `ranking_stability_pct = {stab}%`."
    )
    if asks_scores or not parts:
        parts.insert(0, score_block)
    else:
        parts.append(
            f"*Plan score reference ({reg_name}): `{r1_rot}` achieves **`score = {r1_sc:.3f}`** vs `{ex_rot}` at **`score = {ex_sc:.3f}`** (`criteria.water = {c_r1['water']:.3f}`, `criteria.soil = {c_r1['soil']:.3f}`, `total_3yr_npk_kg_ha = {traj_r1['total_3yr_npk_kg_ha']} kg/ha`).*"
        )
    parts.append(f"**Cited Sources:** {cite_str}")
    return "\n\n".join(parts)


def _resolve_groq_api_key() -> str:
    """Resolve Groq API key from GROQ_API_KEY env var or local gitignored aPI / .env file."""
    env_key = os.getenv("GROQ_API_KEY", "").strip()
    if env_key:
        return env_key
    for candidate in (ROOT / "aPI", ROOT / ".env"):
        if candidate.is_file():
            try:
                raw = candidate.read_text(encoding="utf-8").strip()
                for line in raw.splitlines():
                    ln = line.strip()
                    if ln.startswith("GROQ_API_KEY="):
                        val = ln.split("=", 1)[1].strip().strip('"').strip("'")
                        if val.startswith("gsk_"):
                            return val
                    elif ln.startswith("gsk_"):
                        return ln
            except Exception:
                pass
    return ""


def _try_external_llm(
    question: str,
    lang: str,
    passages: list[dict[str, Any]],
    engine_ctx: dict[str, Any],
) -> tuple[str | None, str | None]:
    """Call Groq LLM (llama-3.3-70b-versatile / llama-3.1-8b-instant) or Gemini with strict RAG + Engine grounding.
    Returns (answer_text, provider_label) or (None, None)."""
    provider = os.getenv("RAG_LLM_PROVIDER", "auto").strip().lower()
    if provider == "local":
        return None, None

    lang_name = {"ar": "Arabic", "fr": "French", "en": "English"}.get(lang, "English")
    ctx_summary = json.dumps(_format_engine_summary(engine_ctx), ensure_ascii=False, indent=2)

    q_concepts = detect_concepts(question)
    asked_crop_ids = [_CONCEPT_TO_CROP_ID[c] for c in q_concepts if c in _CONCEPT_TO_CROP_ID]
    crop_block = _build_crop_specific_block(asked_crop_ids, lang, engine_ctx["region"]) if asked_crop_ids else ""

    docs_txt = "\n\n".join(
        f"[{p['doc_id']} | {p['title']} — {p['section']} ({p['file']})]:\n{p['text']}"
        for p in passages
    )

    system_msg = (
        f"You are Field Shift's trusted, friendly Agronomy Advisor speaking directly to a farmer. Respond strictly in {lang_name}.\n"
        "COMMUNICATION & ADVISORY GUIDELINES FOR FARMERS:\n"
        "1. Use simple, warm, respectful, and highly practical language that any farmer can understand immediately.\n"
        "2. Structure every answer clearly with concise bullet points and recognizable emojis (🌾, 💧, 🌱, 💰, 💡, ⚠️):\n"
        "   - 🎯 Direct Recommendation (1-2 clear, actionable sentences answering the farmer's question right away)\n"
        "   - 🌾 Recommended Crops & Sequences (bold crop names with clear, practical reasons)\n"
        "   - 💧 Water & Drought Resilience (explain how these crops save water, cope with low rainfall, or escape summer heat)\n"
        "   - 🌱 Soil & Fertilizer Savings (explain in plain terms that legumes naturally pull nitrogen from the air into the soil, saving ~30% on synthetic NPK fertilizer costs)\n"
        "   - 💡 Practical Farm Tip (a useful tip on sowing depth, weed breaking, or frost protection)\n"
        "3. DO NOT use developer citation codes like '[DOC-ML-001 · Section 2]', software engineering terms, database names, or API tables.\n"
        "4. If referring to sources, simply say 'According to regional agronomy trials' or 'Based on regional soil and climate data'.\n"
        "5. Always quote the key engine score numbers naturally (e.g., 'Score: 66/100', 'Saves ~120 kg NPK/ha').\n"
        "6. Never invent unverified crop advice, chemical pesticide dosages, or unmodeled crops.\n"
        "7. When discussing rainfall trends, use the `v2_statistics` block: if `statistically_significant_95` is true, "
        "state the Theil-Sen slope (mm/decade) AND the bootstrap 95% CI and call the drying trend statistically confirmed; "
        "if it is false, explicitly say the observed slope is NOT statistically confirmed (the 95% CI includes zero) "
        "and should be treated as year-to-year variability, not a proven trend.\n"
        "8. When explaining WHY, use the `knowledge_graph` relations and the `rule_trace` plain-English explanations: "
        "weave the structured relations (e.g., a region's climate trend favoring drought-tolerant crops, or low SOC "
        "favoring nitrogen-fixing legumes) and the exact rule_trace sentences into your answer in natural language, "
        "never as raw node ids.\n"
    )
    gc = engine_ctx.get("graph_context") or {}
    graph_txt = ""
    if gc.get("lines"):
        graph_txt = (
            "KNOWLEDGE GRAPH RELATIONS (verified pipeline facts):\n"
            + "\n".join(f"- {ln}" for ln in gc["lines"][:8])
        )
        if gc.get("comparison"):
            graph_txt += (
                "\n\nCROSS-REGION COMPARISON (structured):\n"
                + json.dumps(gc["comparison"][:3], ensure_ascii=False)
            )
        graph_txt += "\n\n"

    user_msg = (
        f"FARMER QUESTION ({lang_name}): {question}\n\n"
        + (f"REQUESTED CROP CATALOG PROFILES:\n{crop_block}\n\n" if crop_block else "")
        + f"COMPUTED ENGINE SCORES (Active Context: {engine_ctx.get('region')}):\n{ctx_summary}\n\n"
        + graph_txt
        + f"RETRIEVED GUIDANCE PASSAGES:\n{docs_txt}"
    )

    # 1. Try Groq API first (ultra-fast openai/gpt-oss-120b, qwen/qwen3.8-27b, openai/gpt-oss-20b, allam-2-7b)
    groq_key = _resolve_groq_api_key()
    if groq_key and provider in ("auto", "groq"):
        groq_models = [
            os.getenv("RAG_GROQ_MODEL", "openai/gpt-oss-120b"),
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-20b",
            "allam-2-7b",
        ]
        for g_model in groq_models:
            try:
                payload = json.dumps({
                    "model": g_model,
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 750,
                }).encode("utf-8")
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {groq_key}",
                        "User-Agent": "FieldShift-Agronomy-Assistant/1.0",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    out = json.loads(resp.read().decode("utf-8"))
                    cand = out.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if cand and len(cand.strip()) > 20:
                        ans = cand.strip()
                        # Ensure exact top_plan score and water/soil criteria are referenced when the user asks about scores
                        q_low = question.lower()
                        if any(w in q_low for w in ("score", "rank", "criteria", "نقاط", "ترتيب")) and f"{engine_ctx['rank1']['score']:.3f}" not in ans:
                            r1 = engine_ctx["rank1"]
                            ans += (
                                f"\n\n*Engine Verification (`{engine_ctx['region']}`): Rank #1 `{' → '.join(r1['rotation'])}` "
                                f"`score = {r1['score']:.3f}` (`criteria.water = {r1['criteria']['water']:.3f}`, "
                                f"`criteria.soil = {r1['criteria']['soil']:.3f}`, "
                                f"`total_3yr_npk_kg_ha = {r1['trajectory_3yr']['total_3yr_npk_kg_ha']} kg/ha`).*"
                            )
                        return ans, f"groq:{g_model}"
            except Exception:
                continue

    # 2. Fallback to Gemini if GEMINI_API_KEY is configured
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key and provider in ("auto", "gemini"):
        try:
            model = os.getenv("RAG_GEMINI_MODEL", "gemini-2.5-flash")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
            payload = json.dumps({"contents": [{"parts": [{"text": system_msg + "\n\n" + user_msg}]}]}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=8) as resp:
                out = json.loads(resp.read().decode("utf-8"))
                cand = out.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
                if cand and len(cand.strip()) > 20:
                    return cand.strip(), f"gemini:{model}"
        except Exception:
            pass

    return None, None


def answer_question(
    question: str,
    region: str = "regionA",
    rotation: list[str] | None = None,
    allowed: list[str] | None = None,
    priorities: dict[str, float] | None = None,
    scenario: dict[str, float] | None = None,
    lang: str | None = None,
    engine_context: dict[str, Any] | None = None,
    index: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """End-to-end grounded RAG assistant entry point."""
    q_clean = (question or "").strip()
    detected_lang = detect_language(q_clean, explicit_lang=lang)
    q_concepts = detect_concepts(q_clean)
    target_region, region_from_q = _detect_question_region(q_concepts, region)
    # Name-level routing to our v2 pipeline regions (Tiaret / Constantine share
    # the regionA agronomy domain but have their own data/processed outputs).
    q_norm = normalize_arabic(q_clean.lower())
    if "tiaret" in q_norm or "تيارت" in q_norm:
        target_region = "tiaret"
    elif "constantine" in q_norm or "قسنطينه" in q_norm or "قسنطينة" in q_norm:
        target_region = "constantine"
    graph_entities = _collect_graph_entities(q_clean, q_concepts, target_region)
    ctx = engine_context or compute_engine_context(
        region_id=target_region,
        rotation=None if (region_from_q and target_region != region) else rotation,
        allowed=None if (region_from_q and target_region != region) else allowed,
        priorities=priorities,
        scenario=scenario,
        graph_entities=graph_entities,
    )
    if engine_context is not None:
        ctx = dict(engine_context)
        if graph_entities:
            ctx["graph_context"] = get_graph_context(graph_entities)

    retrieval = retrieve_passages(q_clean, region_id=ctx["region"], index=index)
    passages = retrieval["passages"]
    min_score = float(os.getenv("RAG_MIN_SCORE", "0.14"))

    # Check out-of-scope refusal triggers or insufficient retrieval evidence
    oos_reason = detect_out_of_scope(q_clean)
    if oos_reason:
        return _build_refusal_response(q_clean, detected_lang, f"out_of_scope:{oos_reason}", ctx, passages)

    if not q_clean or (retrieval["best_score"] < min_score and not retrieval["detected_concepts"]):
        return _build_refusal_response(q_clean, detected_lang, "insufficient_evidence", ctx, passages)

    llm_answer, llm_provider = _try_external_llm(q_clean, detected_lang, passages, ctx)
    final_answer = llm_answer or _synthesize_grounded_answer(q_clean, detected_lang, passages, ctx)

    citations = [
        {
            "chunk_id": p["chunk_id"],
            "doc_id": p["doc_id"],
            "title": p["title"],
            "section": p["section"],
            "file": p["file"],
            "score": p["score"],
            "relevance_score": p["score"],
            "excerpt": p["text"][:260] + ("…" if len(p["text"]) > 260 else ""),
        }
        for p in passages
    ]

    return {
        "answer": final_answer,
        "language": detected_lang,
        "dir": "rtl" if detected_lang == "ar" else "ltr",
        "direction": "rtl" if detected_lang == "ar" else "ltr",
        "refused": False,
        "refusal_reason": None,
        "llm_provider": llm_provider or "deterministic-rag",
        "mode": llm_provider or "live-api",
        "citations": citations,
        "sources": citations,
        "engine_summary": _format_engine_summary(ctx),
        "retrieval_meta": {
            "best_score": retrieval["best_score"],
            "detected_concepts": retrieval["detected_concepts"],
            "embedding_provider": os.getenv("RAG_EMBEDDING_PROVIDER", "local_multilingual"),
            "llm_provider": llm_provider or "deterministic-rag",
        },
    }
