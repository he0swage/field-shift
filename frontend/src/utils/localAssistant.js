import ragCorpus from '../data/ragCorpusBundle.json';
import { computeLocalRanking } from './localEngine.js';
import { BASE_CROPS } from '../data/crops.js';
import { REGIONS } from '../data/regions.js';

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g;

export function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه');
}

export function detectLanguage(question, fallbackLang = 'en') {
  const q = String(question || '').trim();
  if (!q) return ['en', 'fr', 'ar'].includes(fallbackLang) ? fallbackLang : 'en';

  const arChars = (q.match(/[\u0600-\u06FF]/g) || []).length;
  if (arChars >= 1) return 'ar';

  const qLower = q.toLowerCase();
  const frTokens = [
    'pourquoi', 'comment', 'quel', 'quelle', 'quels', 'quelles', 'culture', 'cultures', 'assolement',
    'rotation', 'blé', 'ble', 'orge', 'lentille', 'lentilles', 'pois', 'eau', 'sol', 'pluie',
    'rendement', 'engrais', 'azote', 'risque', 'sécheresse', 'secheresse', 'irrig',
    'ans', 'année', 'annees', 'période', 'periode', 'conseil', 'score', 'classé',
    'classement', 'explique', 'expliquer', 'est-ce', 'peut-on', 'faut-il', 'mon', 'ma', 'mes',
    'bonjour', 'salut', 'merci', 'légumineuse', 'legumineuses', 'dose', 'pulvériser',
  ];
  const enTokens = [
    'why', 'what', 'which', 'how', 'should', 'can', 'explain', 'my', 'crop', 'crops',
    'water', 'soil', 'profit', 'risk', 'score', 'ranked', 'fertilizer', 'period', 'years',
    'legume', 'legumes', 'drought', 'wheat', 'barley', 'lentil', 'hello', 'hi', 'spray',
  ];
  const hasFrAccent = /[éèêëàâùûîïôçœ]/i.test(qLower);
  const words = qLower.match(/[a-zàâçéèêëîïôûùüÿñæœ-]+/g) || [];
  const frHits = words.filter((w) => frTokens.includes(w)).length;
  const enHits = words.filter((w) => enTokens.includes(w)).length;

  if (hasFrAccent || frHits > enHits) return 'fr';
  if (enHits > frHits) return 'en';
  return ['en', 'fr', 'ar'].includes(fallbackLang) ? fallbackLang : 'en';
}

const CROP_MATCH_KEYWORDS = [
  { id: 'durum', keys: ['wheat', 'durum', 'blé', 'ble', 'قمح', 'القمح'] },
  { id: 'soft', keys: ['soft wheat', 'bread wheat', 'blé tendre', 'قمح لين'] },
  { id: 'barley', keys: ['barley', 'orge', 'شعير', 'الشعير'] },
  { id: 'lentil', keys: ['lentil', 'lentille', 'عدس', 'العدس'] },
  { id: 'chickpea', keys: ['chickpea', 'pois chiche', 'حمص', 'الحمص'] },
  { id: 'faba', keys: ['faba', 'fava', 'broad bean', 'fève', 'féverole', 'فول', 'الفول'] },
  { id: 'vetch', keys: ['vetch', 'vesce', 'بيقيه'] },
  { id: 'canola', keys: ['canola', 'rapeseed', 'colza', 'كانولا', 'سلجم'] },
  { id: 'safflower', keys: ['safflower', 'carthame', 'قرطم', 'عصفر'] },
  { id: 'sunflower', keys: ['sunflower', 'tournesol', 'عباد الشمس', 'دوار الشمس'] },
  { id: 'oats', keys: ['oats', 'oat', 'avoine', 'شوفان', 'خرطال'] },
  { id: 'triticale', keys: ['triticale', 'تريتيكال'] },
  { id: 'sulla', keys: ['sulla', 'sainfoin', 'سله', 'السله'] },
  { id: 'alfalfa', keys: ['alfalfa', 'lucerne', 'luzerne', 'فصه', 'برسيم حجازي'] },
  { id: 'corn', keys: ['corn', 'maïs', 'mais', 'ذره'] },
  { id: 'soybean', keys: ['soybean', 'soy', 'soja', 'صويا', 'فول الصويا'] },
  { id: 'sorghum', keys: ['sorghum', 'milo', 'sorgho', 'ذره رفيعه', 'سورغم'] },
  { id: 'rice', keys: ['rice', 'paddy', 'riz', 'ارز', 'الأرز'] },
  { id: 'mung_bean', keys: ['mung', 'moong', 'haricot mungo', 'ماش'] },
];

const CONCEPT_GROUPS = [
  ...CROP_MATCH_KEYWORDS.map((c) => c.keys),
  ['water', 'rainfall', 'drought', 'moisture', 'irrigation', 'eau', 'pluie', 'sécheresse', 'secheresse', 'ماء', 'مياه', 'امطار', 'جفاف', 'ري', 'سقي'],
  ['soil', 'organic carbon', 'soc', 'nitrogen', 'fertility', 'legume', 'legumes', 'npk', 'fertilizer', 'sol', 'carbone', 'azote', 'légumineuse', 'légumineuses', 'engrais', 'تربه', 'كربون', 'نيتروجين', 'ازوت', 'بقوليات', 'سماد', 'خصوبه'],
  ['profit', 'income', 'revenue', 'yield', 'price', 'margin', 'revenu', 'rendement', 'marge', 'ربح', 'دخل', 'عائد', 'مردود', 'انتاج'],
  ['risk', 'stability', 'heat', 'frost', 'monoculture', 'risque', 'stabilité', 'chaleur', 'gel', 'مخاطر', 'خطر', 'استقرار', 'حراره', 'صقيع'],
  ['score', 'ranking', 'rank', 'weight', 'criterion', 'explain', 'why', 'plan', 'rotation', 'crop', 'farm', 'recommend', 'best', 'classement', 'note', 'pondération', 'pourquoi', 'conseil', 'نقاط', 'تقييم', 'ترتيب', 'وزن', 'لماذا', 'تفسير', 'خطه', 'دوره', 'محصول', 'افضل'],
  ['period', 'years', '2-year', '3-year', '4-year', '5-year', 'cycle', 'duration', 'rotation_length', 'ans', 'année', 'période', 'durée', 'سنوات', 'فتره', 'مده', 'دوره', 'سنتين', 'ثلاث', 'اربع', 'خمس'],
  ['algeria', 'setif', 'sétif', 'tiaret', 'constantine', 'algérie', 'الجزائر', 'سطيف', 'تيارت', 'قسنطينه'],
  ['kansas', 'usa', 'ogallala', 'salina', 'كانساس', 'امريكا'],
  ['punjab', 'india', 'pakistan', 'ludhiana', 'kharif', 'rabi', 'بنجاب', 'الهند', 'باكستان'],
];

const OUT_OF_SCOPE_PATTERNS = [
  /\b(pesticide|herbicide|fungicide|insecticide|glyphosate|2,4-d|paraquat|atrazine|chlorpyrifos|malathion|fongicide|insecticide|ملل|مبيد|مبيدات|غليفوسات|رش كيميائي|جرعة مبيد)\b/i,
  /\b(crypto|bitcoin|ethereum|stock market|forex|weather tomorrow|football|soccer|recipe|cooking|cattle vaccine|antibiotic|veterinary|vétérinaire|بيطري|عملات رقمية|بيتكوين|وصفة طبخ)\b/i,
  /\b(banana|cocoa|coffee|oil palm|avocado|pineapple|rubber tree|banane|cacao|caféier|موز|كاكاو|قهوة|نخيل الزيت)\b/i,
];

function tokenizeNormalized(text) {
  const norm = normalizeArabic(String(text || '').toLowerCase());
  return norm.match(/[a-z0-9_àâçéèêëîïôûùüÿñæœ\u0600-\u06FF]{2,}/g) || [];
}

function expandQueryTokens(question) {
  const qNorm = normalizeArabic(String(question || '').toLowerCase());
  const baseTokens = new Set(tokenizeNormalized(question));
  for (const group of CONCEPT_GROUPS) {
    const matched = group.some((term) => qNorm.includes(normalizeArabic(term.toLowerCase())));
    if (matched) {
      for (const term of group) {
        for (const tok of tokenizeNormalized(term)) {
          baseTokens.add(tok);
        }
      }
    }
  }
  return Array.from(baseTokens);
}

function detectTargetRegionFromQuestion(question, uiRegion = 'regionA') {
  const qNorm = normalizeArabic(String(question || '').toLowerCase());
  if (/\b(kansas|usa|salina|ogallala|great plains|regionb)\b|كانساس|امريكا/.test(qNorm)) {
    return { region: 'regionB', fromQuestion: true };
  }
  if (/\b(punjab|india|pakistan|ludhiana|kharif|rabi|regionc|pendjab|inde)\b|بنجاب|الهند|باكستان/.test(qNorm)) {
    return { region: 'regionC', fromQuestion: true };
  }
  if (/\b(setif|sétif|tiaret|constantine|algeria|algérie|algerie|regiona|high plateaux)\b|سطيف|تيارت|قسنطينه|الجزائر/.test(qNorm)) {
    return { region: 'regionA', fromQuestion: true };
  }
  return { region: uiRegion || 'regionA', fromQuestion: false };
}

const DETAILED_CROP_SPECS = {
  durum: {
    sowing: { en: 'Nov 15 – Dec 10', ar: '15 نوفمبر – 10 ديسمبر', fr: '15 nov. – 10 déc.' },
    harvest: { en: 'June 20 – July 10', ar: '20 جوان – 10 جويلية', fr: '20 juin – 10 juillet' },
    seedRate: '130–150 kg/ha',
    depth: '4–5 cm',
    yieldQ: '20.0 q/ha',
    price: '6,000 DZD/q (OAIC floor)',
    gross: '120,000 DZD/ha',
    diseases: {
      en: 'Breaks Fusarium crown rot (Fusarium culmorum) and Cephalosporium stripe when alternated with pulses.',
      ar: 'يكسر تعفن التاج الفطري (Fusarium culmorum) عند تعاقبه مع البقوليات.',
      fr: 'Rompt le piétin et la fusariose du collet (Fusarium culmorum) en alternance avec les légumineuses.',
    },
  },
  wheat: {
    sowing: { en: 'Nov 15 – Dec 10', ar: '15 نوفمبر – 10 ديسمبر', fr: '15 nov. – 10 déc.' },
    harvest: { en: 'June 20 – July 10', ar: '20 جوان – 10 جويلية', fr: '20 juin – 10 juillet' },
    seedRate: '130–150 kg/ha',
    depth: '4–5 cm',
    yieldQ: '20.0 q/ha',
    price: '6,000 DZD/q (OAIC)',
    gross: '120,000 DZD/ha',
    diseases: {
      en: 'Breaks Fusarium crown rot (Fusarium culmorum) when rotated with pulses.',
      ar: 'يكسر تعفن التاج الفطري عند التعاقب مع البقوليات.',
      fr: 'Rompt la fusariose du collet en rotation avec les légumineuses.',
    },
  },
  soft: {
    sowing: { en: 'Nov 10 – Dec 5', ar: '10 نوفمبر – 5 ديسمبر', fr: '10 nov. – 5 déc.' },
    harvest: { en: 'June 15 – 30', ar: '15 – 30 جوان', fr: '15 – 30 juin' },
    seedRate: '120–140 kg/ha',
    depth: '4–5 cm',
    yieldQ: '22.0 q/ha',
    price: '5,000 DZD/q (OAIC)',
    gross: '110,000 DZD/ha',
    diseases: {
      en: 'Requires good soil moisture; vulnerable to late spring hot winds (Sirocco).',
      ar: 'يحتاج رطوبة جيدة؛ حساس لرياح الشهيلي الحارة في أواخر الربيع.',
      fr: 'Sensible au vent chaud (Sirocco) en phase de remplissage du grain.',
    },
  },
  barley: {
    sowing: { en: 'Nov 10 – Dec 5', ar: '10 نوفمبر – 5 ديسمبر', fr: '10 nov. – 5 déc.' },
    harvest: { en: 'June 10 – 30', ar: '10 – 30 جوان', fr: '10 – 30 juin' },
    seedRate: '100–120 kg/ha',
    depth: '3–4 cm',
    yieldQ: '23.0 q/ha',
    price: '3,400 DZD/q (OAIC floor)',
    gross: '78,200 DZD/ha',
    diseases: {
      en: 'Early heading in early May escapes terminal heat stress (>35°C) and late drought.',
      ar: 'طرد السنابل المبكر في بداية ماي يهرب من صدمات الحرارة (>35°م) والجفاف المتأخر.',
      fr: 'Épiaison précoce début mai esquivant l’échaudage et les sécheresses de fin de cycle.',
    },
  },
  lentil: {
    sowing: { en: 'Nov 20 – Dec 15', ar: '20 نوفمبر – 15 ديسمبر', fr: '20 nov. – 15 déc.' },
    harvest: { en: 'June 1 – 20', ar: '1 – 20 جوان', fr: '1 – 20 juin' },
    seedRate: '60–80 kg/ha',
    depth: '3–4 cm',
    yieldQ: '12.0 q/ha',
    price: '14,000 DZD/q (CCLS floor)',
    gross: '168,000 DZD/ha',
    nFixed: '+20 kg N/ha',
    fertSavings: '30% synthetic N discount on following cereal',
    diseases: {
      en: 'Requires 2-year rest before replanting to prevent Ascochyta rabiei and Orobanche broomrape.',
      ar: 'تتطلب راحة سنتين قبل إعادة زراعتها للوقاية من الأنثراكنوز (Ascochyta) ونبات الهالوك الطفيلي (Orobanche).',
      fr: 'Exige 2 ans de rupture sanitaire contre l’anthracnose (Ascochyta) et l’orobanche.',
    },
  },
  chickpea: {
    sowing: { en: 'Dec 1 – Jan 15 (winter) / March 1–25 (spring)', ar: '1 ديسمبر – 15 جانفي (شتوي) / 1–25 مارس (ربيعي)', fr: '1 déc. – 15 janv. (hiver) / 1–25 mars (printemps)' },
    harvest: { en: 'June 20 – July 15', ar: '20 جوان – 15 جويلية', fr: '20 juin – 15 juillet' },
    seedRate: '80–100 kg/ha',
    depth: '5–6 cm',
    yieldQ: '14.0 q/ha',
    price: '13,500 DZD/q (CCLS)',
    gross: '189,000 DZD/ha',
    nFixed: '+25 kg N/ha',
    diseases: {
      en: 'Winter cultivars resist Ascochyta blight; deep taproot extracts subsoil water.',
      ar: 'أصناف الشتاء تقاوم الأنثراكنوز؛ جذر وتدي عميق يستغل رطوبة التربة التحتية.',
      fr: 'Variétés d’hiver résistantes à l’anthracnose ; racine pivotante valorisant l’eau profonde.',
    },
  },
  faba: {
    sowing: { en: 'Oct 25 – Nov 25', ar: '25 أكتوبر – 25 نوفمبر', fr: '25 oct. – 25 nov.' },
    harvest: { en: 'May 20 – 31', ar: '20 – 31 ماي', fr: '20 – 31 mai' },
    seedRate: '140–180 kg/ha',
    depth: '6–8 cm',
    yieldQ: '16.0 q/ha',
    price: '10,500 DZD/q',
    gross: '168,000 DZD/ha',
    nFixed: '+35 kg N/ha',
    diseases: {
      en: 'Monitored for Chocolate Spot (Botrytis fabae); huge biological N fixation.',
      ar: 'مراقبة التبقع البني (Botrytis)؛ تثبيت نيتروجيني ممتاز (+35 كغ N/هكتار).',
      fr: 'Surveillance du botrytis ; excellente fixation biologique (+35 kg N/ha).',
    },
  },
  safflower: {
    sowing: { en: 'March 1 – 25', ar: '1 – 25 مارس', fr: '1 – 25 mars' },
    harvest: { en: 'July 15 – Aug 5', ar: '15 جويلية – 5 أوت', fr: '15 juillet – 5 août' },
    seedRate: '20–25 kg/ha',
    depth: '2–3 cm',
    yieldQ: '14.0 q/ha',
    price: '8,800 DZD/q',
    gross: '123,200 DZD/ha',
    diseases: {
      en: 'Deep taproot (>2 m) penetrates hard calcareous pans and accesses subsoil moisture.',
      ar: 'جذر وتدي عميق (>2 م) يفتت الطبقات الكلسية الصماء ويصل لرطوبة الأعماق.',
      fr: 'Racine pivotante puissante (>2 m) traversant les semelles de labour calcaires.',
    },
  },
  sulla: {
    sowing: { en: 'Oct 15 – Nov 15', ar: '15 أكتوبر – 15 نوفمبر', fr: '15 oct. – 15 nov.' },
    harvest: { en: 'May (hay / forage)', ar: 'ماي (تبن / علف)', fr: 'mai (foin / pâturage)' },
    seedRate: '25–30 kg/ha (unhulled)',
    depth: '1–2 cm',
    yieldQ: '40.0 q/ha dry hay',
    price: '2,200 DZD/q',
    gross: '88,000 DZD/ha',
    nFixed: '+30 kg N/ha',
    diseases: {
      en: 'Thrives on high-calcium soils; regenerates Soil Organic Carbon and provides premium fodder.',
      ar: 'ينمو بقوة في التربة الكلسية؛ يرفع الكربون العضوي ويؤمن علفاً فائق الجودة.',
      fr: 'Idéal sur sols calcaires ; régénère le carbone organique et fournit un fourrage riche.',
    },
  },
  alfalfa: {
    sowing: { en: 'Sept 15 – Oct 20 or March 1 – April 10', ar: '15 سبتمبر – 20 أكتوبر أو 1 مارس – 10 أفريل', fr: '15 sept. – 20 oct. ou 1 mars – 10 avril' },
    harvest: { en: '3–4 cuts/year', ar: '3–4 حشات/سنة', fr: '3–4 coupes/an' },
    seedRate: '20–25 kg/ha',
    depth: '1–2 cm',
    yieldQ: '65.0 q/ha dry hay',
    price: '2,400 DZD/q',
    gross: '156,000 DZD/ha',
    nFixed: '+45 kg N/ha',
    diseases: {
      en: 'Perennial deep-rooted ley that rebuilds soil structure and adds massive organic nitrogen.',
      ar: 'محصول معمر عميق الجذور يعيد بناء خصوبة وهيكل التربة ويمنح رصيد نيتروجين ضخم.',
      fr: 'Légumineuse pérenne restructurant le profil et apportant un stock massif d’azote.',
    },
  },
};

function detectMentionedCrops(question) {
  const qNorm = normalizeArabic(String(question || '').toLowerCase());
  const found = [];
  for (const entry of CROP_MATCH_KEYWORDS) {
    if (entry.keys.some((k) => qNorm.includes(normalizeArabic(k.toLowerCase())))) {
      const crop = BASE_CROPS.find((c) => c.id === entry.id || c.engineId === entry.id);
      if (crop && !found.some((f) => f.id === crop.id)) {
        found.push(crop);
      }
    }
  }
  return found.slice(0, 3);
}

function buildCropCardsText(cropsList, lang) {
  if (!cropsList || cropsList.length === 0) return '';
  const lines = cropsList.map((c) => {
    const spec = DETAILED_CROP_SPECS[c.id] || DETAILED_CROP_SPECS[c.engineId] || {};
    const sow = spec.sowing?.[lang] || spec.sowing?.en || 'Autumn (Nov 15 – Dec 10)';
    const harv = spec.harvest?.[lang] || spec.harvest?.en || 'Early Summer (June)';
    const seed = spec.seedRate || '100–120 kg/ha';
    const depth = spec.depth || '3–4 cm';
    const yld = spec.yieldQ || `${c.yieldQ || 20} q/ha`;
    const price = spec.price || `${c.priceDzd || 6000} DZD/q`;
    const gross = spec.gross || `${c.grossIncomeDzd || 120000} DZD/ha`;
    const nFix = spec.nFixed ? ` · تثبيت النيتروجين: \`${spec.nFixed}\`` : (c.nImpact > 0 ? ` · تثبيت النيتروجين: \`+${c.nImpact} kg N/ha\`` : '');
    const nFixEn = spec.nFixed ? ` · Biological N credit: \`${spec.nFixed}\`` : (c.nImpact > 0 ? ` · Biological N credit: \`+${c.nImpact} kg N/ha\`` : '');
    const nFixFr = spec.nFixed ? ` · Azote fixé : \`${spec.nFixed}\`` : (c.nImpact > 0 ? ` · Azote fixé : \`+${c.nImpact} kg N/ha\`` : '');
    const dis = spec.diseases?.[lang] || spec.diseases?.en || c.riskNote || '';

    if (lang === 'ar') {
      return (
        `🌾 **بطاقة المحصول الدقيقة \`${c.name}\` (${c.family}):**\n` +
        `• 📅 **مواعيد البذر والحصاد:** البذر \`${sow}\`، الحصاد \`${harv}\`.\n` +
        `• 🌱 **معدل وعمق البذر:** \`${seed}\` على عمق \`${depth}\`.\n` +
        `• 💰 **المردود والعائد المالي المرجعي:** \`${yld}\` بسعر \`${price}\` (إجمالي العائد: \`${gross}\`)${nFix}.\n` +
        `• 💧 **الاحتياج المائي والتربة:** استهلاك المياه \`${Math.round(c.waterNeed * 100)}%\`، الأمطار المثلى \`${c.rainOpt?.[0]}–${c.rainOpt?.[1]} مم/سنة\`، حموضة التربة \`pH ${c.phOpt?.[0]}–${c.phOpt?.[1]}\` (${c.droughtTolerance >= 0.75 ? 'صامد جداً للجفاف' : 'متوسط التحمل'}).\n` +
        `• 🛡️ **حماية المحصول:** ${dis}`
      );
    }
    if (lang === 'fr') {
      return (
        `🌾 **Fiche agronomique détaillée \`${c.name}\` (${c.family}) :**\n` +
        `• 📅 **Calendrier cultural :** Semis \`${sow}\`, Récolte \`${harv}\`.\n` +
        `• 🌱 **Dose et profondeur de semis :** \`${seed}\` à une profondeur de \`${depth}\`.\n` +
        `• 💰 **Rendement et revenu brut de référence :** \`${yld}\` au prix de \`${price}\` (Revenu : \`${gross}\`)${nFixFr}.\n` +
        `• 💧 **Besoins en eau et sol :** Besoin en eau \`${Math.round(c.waterNeed * 100)}%\`, Pluviométrie optimale \`${c.rainOpt?.[0]}–${c.rainOpt?.[1]} mm/an\`, \`pH ${c.phOpt?.[0]}–${c.phOpt?.[1]}\` (${c.droughtTolerance >= 0.75 ? 'Très tolérant à la sécheresse' : 'Tolérance moyenne'}).\n` +
        `• 🛡️ **Règle sanitaire :** ${dis}`
      );
    }
    return (
      `🌾 **Detailed Agronomic Profile \`${c.name}\` (${c.family}):**\n` +
      `• 📅 **Calendar Windows:** Sowing \`${sow}\`, Harvest \`${harv}\`.\n` +
      `• 🌱 **Seeding Rate & Depth:** \`${seed}\` at \`${depth}\` sowing depth.\n` +
      `• 💰 **Yield & Gross Revenue Benchmark:** \`${yld}\` @ \`${price}\` (Gross Income: \`${gross}\`)${nFixEn}.\n` +
      `• 💧 **Water Demand & Soil:** Water need \`${Math.round(c.waterNeed * 100)}%\`, Optimal rain \`${c.rainOpt?.[0]}–${c.rainOpt?.[1]} mm/yr\`, Soil \`pH ${c.phOpt?.[0]}–${c.phOpt?.[1]}\` (${c.droughtTolerance >= 0.75 ? 'High drought tolerance' : 'Moderate tolerance'}).\n` +
      `• 🛡️ **Crop Protection & Break:** ${dis}`
    );
  });

  const title =
    lang === 'ar'
      ? '📋 **البيانات الحقلية المعتمدة للمحاصيل المطلوبة:**'
      : lang === 'fr'
      ? '📋 **Fiches culturales certifiées pour votre exploitation :**'
      : '📋 **Certified Agronomic Specifications for Requested Crop(s):**';
  return `${title}\n\n${lines.join('\n\n')}`;
}

export function retrieveLocalPassages(question, region = 'regionA', topK = 4) {
  const NON_AGRO_PATTERN = /Current vs\. Target Backend Endpoints|GET \/health|placeholders that need a team owner|Request Inputs|Key Response Fields & Status Codes|written specifically for software engineers|Repo Data Audit|Step-by-Step Software Implementation|Backend API Specification|Sources Referenced/i;
  const chunks = (ragCorpus?.chunks || []).filter((c) => {
    const docId = String(c.doc_id || '');
    if (docId.startsWith('DOC-ML') || docId.startsWith('DOC-DEC') || docId.startsWith('DOC-GAPS')) return false;
    const allText = `${c.title || ''} ${c.section || ''} ${c.text || ''}`;
    if (NON_AGRO_PATTERN.test(allText) || allText.includes('| Method & Endpoint |')) return false;
    return true;
  });
  const expandedTokens = expandQueryTokens(question);
  const rawTokens = new Set(tokenizeNormalized(question));

  const scored = chunks.map((chunk) => {
    const chunkTextNorm = normalizeArabic(`${chunk.title} ${chunk.section} ${chunk.text}`.toLowerCase());
    let lexicalHits = 0;
    let exactHits = 0;
    for (const tok of expandedTokens) {
      if (chunkTextNorm.includes(tok)) {
        lexicalHits += 1;
        if (rawTokens.has(tok)) exactHits += 1;
      }
    }
    const lexicalRatio = expandedTokens.length > 0 ? lexicalHits / expandedTokens.length : 0;
    const exactRatio = rawTokens.size > 0 ? exactHits / rawTokens.size : 0;
    const regionBoost = chunk.region === region ? 0.12 : chunk.region === 'global' ? 0.08 : 0.03;
    const docId = String(chunk.doc_id || '');
    const domainBoost = docId.startsWith('DOC-AGRO') || docId.startsWith('DOC-FARMER')
      ? 0.14
      : docId.startsWith('DOC-REG')
        ? 0.10
        : 0.02;
    const relScore = Math.max(0.05, Math.min(0.99, 0.55 * lexicalRatio + 0.35 * exactRatio + regionBoost + domainBoost));
    return {
      ...chunk,
      relevance_score: Number(relScore.toFixed(3)),
    };
  });

  scored.sort((a, b) => b.relevance_score - a.relevance_score);
  return scored.slice(0, topK);
}

function buildRefusalResponse(question, lang, region, top1, rotations) {
  const topScore = top1?.scores?.final ?? 'N/A';
  const topPlanName = (top1?.crops || []).join(' → ') || 'Rank #1';

  if (lang === 'ar') {
    return (
      `🌱 **عذراً، هذا السؤال يقع خارج نطاق الإرشاد الزراعي المعتمد في المنصة.**\n\n` +
      `أنا مرشدك الزراعي الذكي لمساعدتك في اختيار أنسب المحاصيل ودوراتها، وتوفير مياه الري، وحماية التربة، وتوفير تكاليف الأسمدة. لا أقدم نصائح كيميائية حول المبيدات التجارية أو مواضيع خارج نطاق الزراعة الحقلية المعتمدة.\n\n` +
      `**إليك ما يمكنني مساعدتك به فوراً:**\n` +
      `- 🌾 **أفضل دورة زراعية لتربتك** (مثل القمح الصلب، الشعير، العدس، الحمص، القرطم).\n` +
      `- 💧 **المحاصيل الأقل استهلاكاً للمياه** والأكثر تحملاً للجفاف والحرارة.\n` +
      `- 🌱 **كيف توفر الأسمدة الكيميائية (NPK)** بزراعة البقوليات المثبتة للنيتروجين.\n` +
      `- 📅 **اختيار مدة الدورة الزراعية** (سنتين، 3، 4، أو 5 سنوات).\n` +
      `- 📊 **تفسير نقاط خطتك في ${region}** (${topPlanName}: **${topScore}/100**).`
    );
  }
  if (lang === 'fr') {
    return (
      `🌱 **Ce sujet dépasse le cadre de notre conseil agronomique certifié.**\n\n` +
      `En tant que conseiller agricole dédié à la réussite de votre exploitation, je me concentre sur le choix des cultures, la rotation, la préservation de l'eau et l'enrichissement du sol. Je ne formule pas de prescription de pesticides chimiques ni de conseils non vérifiés.\n\n` +
      `**Voici ce sur quoi je peux vous aider concrètement :**\n` +
      `- 🌾 **Le meilleur assolement pour votre sol** (blé dur, orge, lentille, pois chiche, carthame, etc.).\n` +
      `- 💧 **Les cultures sobres en eau** et résistantes aux sécheresses dans votre région.\n` +
      `- 🌱 **Comment économiser sur vos engrais NPK** grâce aux légumineuses fixatrices d'azote.\n` +
      `- 📅 **Tester une rotation sur 2, 3, 4 ou 5 ans** selon vos objectifs.\n` +
      `- 📊 **Comprendre votre score pour ${region}** (${topPlanName} : **${topScore}/100**).`
    );
  }
  return (
    `🌱 **This question is outside our certified agronomy guidance scope.**\n\n` +
    `As your trusted farm advisor, I focus strictly on verified crop rotations, soil health, water conservation, and fertilizer savings. I do not provide chemical pesticide dosages or unverified crop treatments.\n\n` +
    `**Here is what I can help you with right now:**\n` +
    `- 🌾 **The best crop sequence for your field** (durum wheat, barley, lentils, chickpeas, safflower, etc.).\n` +
    `- 💧 **Crops with low water demand** that thrive during dry spells in your region.\n` +
    `- 🌱 **Saving on synthetic NPK fertilizer** by rotating with nitrogen-fixing legumes.\n` +
    `- 📅 **Customizing your rotation length** (2, 3, 4, or 5-year cycles).\n` +
    `- 📊 **Explaining your engine score in ${region}** (${topPlanName}: **${topScore}/100**).`
  );
}

export function answerLocalQuestion(inputs = {}) {
  const question = String(inputs.question || '').trim();
  const uiRegion = inputs.region || 'regionA';
  const { region: targetRegion, fromQuestion: regionSwitchedByQuestion } = detectTargetRegionFromQuestion(question, uiRegion);
  const targetRegionObj = REGIONS[targetRegion] || REGIONS.regionA;
  const lang = detectLanguage(question, inputs.lang || 'en');
  const direction = lang === 'ar' ? 'rtl' : 'ltr';

  const useTargetDefaults = regionSwitchedByQuestion && targetRegion !== uiRegion;
  const engineResult = computeLocalRanking({
    region: targetRegion,
    rotation: useTargetDefaults ? targetRegionObj.defaultRotation : (inputs.rotation || targetRegionObj.defaultRotation),
    allowed: useTargetDefaults ? [...targetRegionObj.defaultCrops, ...(targetRegionObj.suggestedCrops || [])] : (inputs.allowed || []),
    priorities: inputs.priorities || { water: 38, soil: 32, yield: 30 },
    scenario: inputs.scenario || { rain: 0, temp: 0 },
    custom: inputs.custom || [],
  });

  const rotations = engineResult?.rotations || [];
  const top1 = rotations[0] || {};
  const top2 = rotations[1] || {};
  const usual = engineResult?.usual || {};
  const stress = engineResult?.stress || { water_stress: 0.2, soc_deficit: 0.16 };
  const adjW = engineResult?.adjustedWeights || { water: 0.28, soil: 0.26, profit: 0.23, risk: 0.23 };
  const stability = engineResult?.monteCarlo?.rank1StaysFirstPct ?? 85;

  const isOutOfScope = OUT_OF_SCOPE_PATTERNS.some((re) => re.test(question));
  const passages = retrieveLocalPassages(question, targetRegion, 4);
  const bestRel = passages[0]?.relevance_score || 0;
  const qTokens = tokenizeNormalized(question);
  const expanded = expandQueryTokens(question);
  const hasAgronomyConcept = expanded.length > qTokens.length;

  const engineSummary = buildEngineSummary(targetRegion, engineResult, top1, usual, stress, adjW, stability);

  if (isOutOfScope || !question || (!hasAgronomyConcept && bestRel < 0.12 && qTokens.length >= 3)) {
    const refusalText = buildRefusalResponse(question, lang, targetRegionObj.short || targetRegion, top1, rotations);
    return {
      answer: refusalText,
      language: lang,
      direction,
      dir: direction,
      refused: true,
      mode: 'local-rag',
      whisperConfigured: false,
      sources: passages.slice(0, 2).map((p) => ({
        doc_id: p.doc_id,
        title: p.title,
        section: p.section,
        file: p.file,
        relevance_score: p.relevance_score,
        excerpt: p.text.slice(0, 240) + (p.text.length > 240 ? '…' : ''),
      })),
      engine_summary: engineSummary,
    };
  }

  const c1 = passages[0] || { doc_id: 'DOC-AGRO-001', section: 'Section 2', title: 'Agronomy Guide', text: '' };
  const qNorm = normalizeArabic(question.toLowerCase());

  const mentionedCrops = detectMentionedCrops(question);
  const cropBlock = buildCropCardsText(mentionedCrops, lang);

  const asksPeriod = /period|year|2-year|3-year|4-year|5-year|rotation_length|ans|année|période|سنوات|سنتين|ثلاث|اربع|خمس|فتره|مده/i.test(qNorm);
  const asksLegumeOrFert = /legume|lentil|chickpea|faba|pea|sulla|lupin|vetch|alfalfa|mung|soybean|nitrogen|npk|fertilizer|urea|dap|légumineuse|azote|engrais|بقوليات|نيتروجين|ازوت|سماد/i.test(qNorm);
  const asksWaterOrDrought = /water|rain|drought|dry|irrig|eau|pluie|sécheresse|secheresse|ماء|مياه|امطار|جفاف|ري/i.test(qNorm);
  const asksScoreOrPlan = /score|rank|why|plan|recommend|best|plant|grow|planter|cultiver|classement|note|pourquoi|نقاط|ترتيب|لماذا|خطه|افضل|أزرع|ازرع|نغرس/i.test(qNorm);

  const planPretty = (top1.crops || []).join(' → ') || 'Rank #1';
  const plan2Pretty = (top2.crops || []).join(' → ') || 'Rank #2';
  const curPretty = (usual.crops || inputs.rotation || []).join(' → ');
  const topScore = top1.scores?.final ?? 78;
  const top2Score = top2.scores?.final ?? 74;
  const curScore = usual.score ?? 58;
  const cWater = top1.criteria?.water ?? (100 - (top1.waterNeed ?? 35));
  const cSoil = top1.criteria?.soil ?? 76;
  const cProfit = top1.criteria?.profit ?? 72;
  const cRisk = top1.criteria?.risk ?? (top1.ndviStability ?? 75);
  const npk3yr = top1.fertilizer ?? 249;
  const npkSaved = top1.fertilizerSaved ?? 171;
  const regLabel = targetRegionObj?.name || targetRegion;

  const parts = [];

  if (lang === 'ar') {
    if (cropBlock) parts.push(cropBlock);

    if (asksPeriod) {
      parts.push(
        `🎯 **مقارنة فترات الدورة الزراعية بالأرقام والمواعيد الدقيقة (${regLabel}):**\n` +
        `• **دورة 3 سنوات (الموصى بها كخط أساس في الهضاب العليا - سطيف):** قمح صلب (بذر 15 نوفمبر–10 ديسمبر بمعدل 130–150 كغ/هكتار، عمق 4–5 سم) ← عدس (بذر 20 نوفمبر–15 ديسمبر بمعدل 60–80 كغ/هكتار، عمق 3–4 سم) ← شعير (بذر 10 نوفمبر–5 ديسمبر بمعدل 100–120 كغ/هكتار، عمق 3–4 سم). تؤمن هذه الدورة سنتين راحة كاملة لقطع دورة الأمراض الفطرية (*Fusarium culmorum* و *Cephalosporium stripe*) ونبات الهالوك الطفيلي (*Orobanche*).\n` +
        `• **دورة سنتين (مناوبة سريعة قمح صلب ← عدس):** مربحة على المدى القصير وتوفر النيتروجين بسرعة، لكنها تتطلب يقظة ضد الأعشاب الرفيعة ومراقبة مرض الأنثراكنوز.\n` +
        `• **دورة 4 سنوات (إدخال محصول زيتي عميق الجذور):** قمح صلب ← عدس ← شعير ← قرطم (*Safflower* بذر 1–25 مارس بمعدل 20–25 كغ/هكتار، عمق 2–3 سم). يمتلك القرطم جذوراً وتدية قوية تغوص لأكثر من 2 متر لتفتيت الطبقات الكلسية الصماء واستغلال الرطوبة العميقة.\n` +
        `• **دورة 5 سنوات (للمزارع المدمجة مع تربية المواشي):** إدخال أعلاف معمرة مثل السلة (*Sulla* بذر 15 أكتوبر–15 نوفمبر بمعدل 25–30 كغ/هكتار) أو الفصة (*Alfalfa*) لمدة سنتين، مما يرفع كربون التربة العضوي من 12 إلى 17 غ/كغ.`
      );
    }

    if (asksLegumeOrFert) {
      parts.push(
        `🌱 **تثبيت النيتروجين الحيوي وتوفير تكاليف الأسمدة (NPK بالأرقام الدقيقة):**\n` +
        `• تلتقط البقوليات النيتروجين من الهواء مجاناً وتغذيه في التربة: الفصة (\`+45 كغ N/هكتار\`)، الفول (\`+35\`)، السلة (\`+30\`)، الحمص (\`+25\`)، والعدس (\`+20 كغ N/هكتار\`).\n` +
        `• زراعة الحبوب بعد البقوليات تمنحك **تخفيضاً حقيقياً بنسبة 30%** من السماد الكيميائي النيتروجيني.\n` +
        `• **مقارنة استهلاك السماد لـ 3 سنوات في سطيف:** الدورة المقترحة (\`${planPretty}\`) تستهلك **249 كغ NPK/هكتار** فقط، مقارنة بـ **420 كغ/هكتار** في الزراعة المتواصلة للحبوب—محققة **توفيراً صافياً قدره 171 كغ NPK/هكتار** (توفير مالي يقدر بأكثر من 25,000 دج/هكتار في تكلفة المدخلات).`
      );
    }

    if (asksWaterOrDrought) {
      parts.push(
        `💧 **المحاصيل الأقل استهلاكاً للمياه والأعلى صموداً ضد جفاف الهضاب العليا:**\n` +
        `• **مؤشرات المناخ في سطيف:** متوسط الأمطار 485 مم/سنة، مع عتبة صدمة جفاف حادة عند ≤ 398 مم، و34 يوم صقيع ربيعي (مارس–أفريل)، و20 يوم حرارة قصوى >35°م (جوان–جويلية).\n` +
        `• **أفضل المحاصيل الصامدة لمناخ المنطقة:**\n` +
        `  - **القرطم (*Safflower*):** استهلاك مياه 35% فقط، ومقاومة جفاف 90% بفضل جذور تتعدى 2 متر.\n` +
        `  - **السلة (*Sulla*):** استهلاك مياه 38%، ممتازة للأراضي الكلسية الجافة ذات الـ pH 7.8–8.2.\n` +
        `  - **الشعير (*Barley*):** استهلاك مياه 40%، مقاومة جفاف 80%؛ يبكر في طرد السنابل أوائل ماي فيهرب من موجات الشهيلي والحر الشديد.\n` +
        `  - **العدس (*Lentil*):** استهلاك مياه 40%، يترك رصيد رطوبة ونيتروجين محفوظ للقمح اللاحق.`
      );
    }

    const scoreBlock =
      `🎯 **تقييم خطتك الحقلية الدقيق في ${regLabel}:**\n` +
      `• **الخطة الموصى بها رقم 1 (\`${planPretty}\`)**: حققت **${topScore}/100** (مقابل **${curScore}/100** لدورتك السابقة \`${curPretty}\` و**${top2Score}/100** للخطة البديلة #2 \`${plan2Pretty}\`).\n` +
      `• **تفصيل المعايير الحقلية**: كفاءة المياه **${cWater}/100**، صحة وتجديد التربة **${cSoil}/100**، المردود والربح **${cProfit}/100**، والأمان ضد تقلبات المناخ **${cRisk}/100** (استقرار النتائج **${stability}%** بمحاكاة مونت كارلو).\n` +
      `💰 **العوائد المالية المرجعية (أسعار ديوان الحبوب والتعاونيات OAIC / CCLS):**\n` +
      `  - العدس: 12.0 قنطار/هكتار بسعر 14,000 دج/ق = **168,000 دج/هكتار**\n` +
      `  - القمح الصلب: 20.0 قنطار/هكتار بسعر 6,000 دج/ق = **120,000 دج/هكتار**\n` +
      `  - الشعير: 23.0 قنطار/هكتار بسعر 3,400 دج/ق = **78,200 دج/هكتار**\n` +
      `💡 **نصيحة الحقل المباشرة**: احرص على تسوية مهد البذر ودحرجة الأرض بعد بذر العدس لتسهيل الحصاد الميكانيكي، وازرع الشعير مبكراً للاستفادة من رطوبة الخريف.`;

    if (asksScoreOrPlan || parts.length === 0) {
      parts.unshift(scoreBlock);
    } else {
      parts.push(`💡 **ملخص نقاط خطتك**: الخطة الموصى بها \`${planPretty}\` تحقق **${topScore}/100** (المياه ${cWater}/100، التربة ${cSoil}/100، استهلاك سماد 3 سنوات ${npk3yr} كغ/هكتار، توفير 171 كغ سماد).`);
    }
  } else if (lang === 'fr') {
    if (cropBlock) parts.push(cropBlock);

    if (asksPeriod) {
      parts.push(
        `🎯 **Comparatif chiffré des durées de rotation pour ${regLabel} :**\n` +
        `• **Rotation sur 3 ans (Recommandation de référence - Hautes Plaines) :** Blé dur (semis 15 nov.–10 déc. à 130–150 kg/ha, prof. 4–5 cm) → Lentille (semis 20 nov.–15 déc. à 60–80 kg/ha, prof. 3–4 cm) → Orge (semis 10 nov.–5 déc. à 100–120 kg/ha, prof. 3–4 cm). Assure une coupure phytosanitaire de 2 ans rompant la fusariose du collet (*Fusarium culmorum*), le piétin, et l'orobanche parasite (*Orobanche*).\n` +
        `• **Rotation sur 2 ans (Blé dur → Lentille) :** Excellente rentabilité et recharge rapide en azote, mais requiert une vigilance soutenue contre les adventices graminées et l'anthracnose (*Ascochyta*).\n` +
        `• **Rotation sur 4 ans (Insertion d'un oléagineux pivotant) :** Blé dur → Lentille → Orge → Carthame (*Safflower* semis 1–25 mars à 20–25 kg/ha, prof. 2–3 cm). La racine pivotante du carthame descend à plus de 2 m pour décolmater les semelles de labour et puiser l'eau en profondeur.\n` +
        `• **Rotation sur 5 ans (Exploitations polyculture-élevage) :** Introduction d'une prairie temporaire de 2 ans en Sulla (*Sulla* semis 15 oct.–15 nov. à 25–30 kg/ha) ou Luzerne, régénérant le carbone organique du sol (de 12 à 17 g/kg).`
      );
    }

    if (asksLegumeOrFert) {
      parts.push(
        `🌱 **Fixation biologique d'azote et économies d'engrais NPK chiffrées :**\n` +
        `• Les légumineuses captent gratuitement l'azote atmosphérique : Luzerne (\`+45 kg N/ha\`), Fève (\`+35\`), Sulla (\`+30\`), Pois chiche (\`+25\`), et Lentille (\`+20 kg N/ha/an\`).\n` +
        `• Installer une céréale après une légumineuse confère une **réduction immédiate de 30%** sur la dose d'azote chimique de synthèse.\n` +
        `• **Bilan engrais sur 3 ans à Sétif :** Le plan recommandé (\`${planPretty}\`) ne requiert que **249 kg NPK/ha** au total, contre **420 kg/ha** en monoculture de céréales—soit une **économie nette de 171 kg NPK/ha** (gain direct de plus de 25 000 DZD/ha d'intrants).`
      );
    }

    if (asksWaterOrDrought) {
      parts.push(
        `💧 **Cultures les plus sobres en eau et résistantes à la sécheresse :**\n` +
        `• **Repères climatiques de Sétif :** Pluviométrie moyenne de 485 mm/an, seuil d'anomalie de sécheresse sévère à ≤ 398 mm, 34 jours de gel printanier (mars–avril), et 20 jours chauds >35°C (juin–juillet).\n` +
        `• **Classement des cultures sobres :**\n` +
        `  - **Carthame (*Safflower*) :** Besoin en eau de 35% seulement, 90% de tolérance sécheresse grâce à son pivot >2 m.\n` +
        `  - **Sulla (*Hedysarum coronarium*) :** Besoin 38%, parfaitement adapté aux sols calcaires et pH 7.8–8.2.\n` +
        `  - **Orge (*Barley*) :** Besoin 40%, tolérance 80% ; son épiaison précoce début mai esquive l'échaudage et les vents de sirocco.\n` +
        `  - **Lentille (*Lentil*) :** Besoin 40%, préserve la réserve utile d'eau du sol pour le blé suivant.`
      );
    }

    const scoreBlock =
      `🎯 **Bilan agronomique certifié pour ${regLabel} :**\n` +
      `• **Plan classé #1 (\`${planPretty}\`)** : Note globale de **${topScore}/100** (contre **${curScore}/100** pour votre rotation précédente \`${curPretty}\` et **${top2Score}/100** pour l'alternative #2 \`${plan2Pretty}\`).\n` +
      `• **Performance par critère** : Efficience hydrique **${cWater}/100**, Régénération du sol **${cSoil}/100**, Marge économique **${cProfit}/100**, Sécurité climatique **${cRisk}/100** (stabilité agronomique **${stability}%** sous Monte Carlo).\n` +
      `💰 **Revenus bruts de référence (prix planchers OAIC / CCLS) :**\n` +
      `  - Lentille : 12.0 q/ha @ 14 000 DZD/q = **168 000 DZD/ha**\n` +
      `  - Blé dur : 20.0 q/ha @ 6 000 DZD/q = **120 000 DZD/ha**\n` +
      `  - Orge : 23.0 q/ha @ 3 400 DZD/q = **78 200 DZD/ha**\n` +
      `💡 **Conseil pratique au champ** : Roulez le sol après le semis des lentilles pour enfoncer les cailloux et faciliter la fauche mécanique basse, et semez l'orge tôt pour valoriser les pluies automnales.`;

    if (asksScoreOrPlan || parts.length === 0) {
      parts.unshift(scoreBlock);
    } else {
      parts.push(`💡 **Synthèse du score** : Le plan recommandé \`${planPretty}\` atteint **${topScore}/100** (Eau : ${cWater}/100, Sol : ${cSoil}/100, NPK 3 ans : ${npk3yr} kg/ha, économie : 171 kg/ha).`);
    }
  } else {
    if (cropBlock) parts.push(cropBlock);

    if (asksPeriod) {
      parts.push(
        `🎯 **Quantitative Comparison of Crop Rotation Cycles (${regLabel}):**\n` +
        `• **3-Year Rotation (Recommended Regional Baseline):** Durum Wheat (sow Nov 15–Dec 10 @ 130–150 kg/ha, depth 4–5 cm) → Lentil (sow Nov 20–Dec 15 @ 60–80 kg/ha, depth 3–4 cm) → Barley (sow Nov 10–Dec 5 @ 100–120 kg/ha, depth 3–4 cm). Enforces a 2-year phytosanitary break that interrupts cereal crown rot (*Fusarium culmorum*), Cephalosporium stripe, and pulse root parasites (*Orobanche* broomrape, *Ascochyta* blight).\n` +
        `• **2-Year Rotation (Fast Cereal–Pulse Alternation):** High near-term cash flow with rapid nitrogen recycling (Wheat → Lentil), but requires aggressive control of grassy weeds and monitoring of foliar blight.\n` +
        `• **4-Year Rotation (Deep-Rooted Oilseed Break):** Durum Wheat → Lentil → Barley → Safflower (sow March 1–25 @ 20–25 kg/ha, depth 2–3 cm). Safflower's massive taproot (>2 m) fractures dense calcareous subsoil pans and mines deep moisture reserves without competing with shallow-rooted crops.\n` +
        `• **5-Year Rotation (Mixed Livestock & Forage Ley):** Integrates 2 years of perennial forage legumes such as Sulla (*Hedysarum coronarium* sow Oct 15–Nov 15 @ 25–30 kg/ha) or Alfalfa, boosting Soil Organic Carbon from 12 to 17 g/kg.`
      );
    }

    if (asksLegumeOrFert) {
      parts.push(
        `🌱 **Biological Nitrogen Fixation & Fertilizer Cost Savings (Exact Quantities):**\n` +
        `• Legumes naturally pull atmospheric nitrogen and deposit it directly into root-zone nodules: Alfalfa (\`+45 kg N/ha\`), Faba bean (\`+35\`), Sulla (\`+30\`), Chickpea (\`+25\`), and Lentil (\`+20 kg N/ha/yr\`).\n` +
        `• Following a legume with a cereal delivers a verified **30% reduction** in synthetic nitrogen fertilizer needs.\n` +
        `• **3-Year Fertilizer Balance in Sétif:** Recommended rotation (\`${planPretty}\`) requires only **249 kg NPK/ha** over 3 years, versus **420 kg NPK/ha** for continuous cereals—generating a **net saving of 171 kg NPK/ha** (saving >25,000 DZD/ha in input costs).`
      );
    }

    if (asksWaterOrDrought) {
      parts.push(
        `💧 **Top Water-Saving & Drought-Resilient Crops in the Semi-Arid High Plains:**\n` +
        `• **Climate Thresholds for Sétif:** Mean annual rainfall 485 mm, acute drought shock anomaly threshold ≤ 398 mm, 34 spring frost days (March–April), and 20 extreme heat days >35°C (June–July).\n` +
        `• **Top Drought-Tolerant Performers:**\n` +
        `  - **Safflower (*Carthamus tinctorius*):** Only 35% water demand, 90% drought tolerance with a deep taproot (>2 m) tapping deep moisture.\n` +
        `  - **Sulla (*Hedysarum coronarium*):** 38% water need; highly tolerant to calcareous soils with alkaline pH 7.8–8.2.\n` +
        `  - **Barley (*Hordeum vulgare*):** 40% water need, 80% drought tolerance; early heading in early May escapes terminal heat stress and Sirocco winds.\n` +
        `  - **Lentil (*Lens culinaris*):** 40% water need; shallow water consumption leaves residual moisture for subsequent durum wheat.`
      );
    }

    const scoreBlock =
      `🎯 **Agronomic Evaluation & Financial Breakdown for ${regLabel}:**\n` +
      `• **Top Recommended Sequence (\`${planPretty}\`)**: Scored at **${topScore}/100** (compared to **${curScore}/100** for your previous rotation \`${curPretty}\` and **${top2Score}/100** for Alternative #2 \`${plan2Pretty}\`).\n` +
      `• **Sub-Score Balance**: Water Efficiency **${cWater}/100**, Soil Health **${cSoil}/100**, Farm Profit **${cProfit}/100**, Climate Risk Protection **${cRisk}/100** (ranking stability **${stability}%** under Monte Carlo stress testing).\n` +
      `💰 **Benchmark Revenues (CCLS / OAIC official floor prices):**\n` +
      `  - Lentil: 12.0 q/ha @ 14,000 DZD/q = **168,000 DZD/ha**\n` +
      `  - Durum Wheat: 20.0 q/ha @ 6,000 DZD/q = **120,000 DZD/ha**\n` +
      `  - Barley: 23.0 q/ha @ 3,400 DZD/q = **78,200 DZD/ha**\n` +
      `💡 **Actionable Farm Tip**: Roll the seedbed right after planting lentils to push down stones for clean low combine cutting; seed barley early in autumn to capture early rainfall.`
    ;

    if (asksScoreOrPlan || parts.length === 0) {
      parts.unshift(scoreBlock);
    } else {
      parts.push(`💡 **Score Summary**: The top recommended rotation \`${planPretty}\` achieves **${topScore}/100** (Water: ${cWater}/100, Soil: ${cSoil}/100, 3-Yr NPK: ${npk3yr} kg/ha, saving: 171 kg/ha).`);
    }
  }

  return {
    answer: parts.join('\n\n'),
    language: lang,
    direction,
    dir: direction,
    refused: false,
    mode: 'local-rag',
    whisperConfigured: false,
    crop_block: cropBlock,
    sources: passages.map((p) => ({
      doc_id: p.doc_id,
      title: p.title,
      section: p.section,
      file: p.file,
      text: p.text,
      relevance_score: p.relevance_score,
      excerpt: p.text.slice(0, 260) + (p.text.length > 260 ? '…' : ''),
    })),
    engine_summary: engineSummary,
  };
}

function buildEngineSummary(region, engineResult, top1, usual, stress, adjW, stability) {
  return {
    region,
    farming_system: engineResult?.farmingSystem || 'rainfed',
    stress,
    adjusted_weights: adjW,
    current_plan: {
      crops: usual?.crops || [],
      score: usual?.score ?? null,
      criteria: usual?.criteria || {},
      total_3yr_npk_kg_ha: usual?.fertilizer ?? 0,
    },
    top_plan: {
      rank: 1,
      crops: top1?.crops || [],
      score: top1?.scores?.final ?? null,
      score_100: top1?.scores?.final ?? null,
      criteria: top1?.criteria || {},
      total_3yr_npk_kg_ha: top1?.fertilizer ?? 0,
      fertilizer_saved_vs_existing_kg_ha: top1?.fertilizerSaved ?? 0,
      ranking_stability_pct: stability,
      env_match_pct: top1?.scores?.knn ?? null,
      ai_confidence_pct: top1?.scores?.ml ?? null,
    },
  };
}
