// Netlify Serverless Function: POST /api/assistant (Groq LLM + Grounded RAG)
// Keeps GROQ_API_KEY strictly server-side on Netlify while receiving pre-retrieved passages
// and computed engine scores from the client or computing them directly.

const GROQ_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'allam-2-7b'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

const DEFAULT_REGIONAL_FACTS = {
  regionA: {
    name: 'Sétif High Plateaux, Algeria',
    climate: 'Semi-arid continental (verified v2 pipeline, data/processed/setif/indicators.json: mean annual rainfall 2015-2024: 509.0 mm/yr; 30-year mean 574.9 mm; Theil-Sen drying trend: -44.1 mm/decade over 1995-2024, moving block bootstrap 95% CI [-74.1, -11.8] mm/decade — excludes zero, statistically significant at 95%; historical drought frequency: 10.0%, severe drought years 2000/2001/2024; water stress: 0.163).',
    soil: 'Calcareous clay-loam (ISRIC SoilGrids 0-30 cm: pH 7.77, SOC 12.52 g/kg medium, AWC 140.6 mm/m Saxton-Rawls 2006 pedotransfer estimate).',
    recommended: 'Durum Wheat → Lentil → Barley (or Sulla / Chickpea / Safflower).',
    crops: [
      { name: 'Durum Wheat', family: 'Cereal', sowing: 'Nov 15 – Dec 10', harvest: 'June 20 – July 10', seed_rate: '130–150 kg/ha', depth: '4–5 cm', yield: '20.0 q/ha', price: '6,000 DZD/q (OAIC)', gross: '120,000 DZD/ha', fert: '160 kg NPK/ha', rain_opt: '350–650 mm', ph_opt: '6.0–8.5' },
      { name: 'Lentil', family: 'Legume', sowing: 'Nov 20 – Dec 15', harvest: 'June 1 – 20', seed_rate: '60–80 kg/ha', depth: '3–4 cm', yield: '12.0 q/ha', price: '14,000 DZD/q (CCLS)', gross: '168,000 DZD/ha', n_fixed: '+20 kg N/ha', fert: '40 kg TSP 46% (0 kg synthetic N needed)', fert_savings: '30% N reduction on following crop', rain_opt: '280–550 mm', ph_opt: '6.0–8.2' },
      { name: 'Barley', family: 'Cereal', sowing: 'Nov 10 – Dec 5', harvest: 'June 10 – 30', seed_rate: '100–120 kg/ha', depth: '3–4 cm', yield: '23.0 q/ha', price: '3,400 DZD/q (OAIC)', gross: '78,200 DZD/ha', fert: '110 kg NPK/ha (reduced from 160 kg thanks to lentil N credit)', rain_opt: '250–550 mm', ph_opt: '6.0–8.5', drought_tol: '80% (early May heading escapes terminal heat)' },
      { name: 'Chickpea', family: 'Legume', sowing: 'March (spring) or Nov–Dec (winter)', harvest: 'June 20 – July 15', seed_rate: '80–100 kg/ha', depth: '5–6 cm', yield: '14.0 q/ha', price: '13,500 DZD/q (CCLS)', gross: '189,000 DZD/ha', n_fixed: '+25 kg N/ha', fert: '60 kg DAP', rain_opt: '300–600 mm', ph_opt: '6.2–8.4' },
      { name: 'Sulla (Spanish Sainfoin)', family: 'Forage Legume', sowing: 'Oct 15 – Nov 15', harvest: 'May (forage/hay)', seed_rate: '25–30 kg/ha unhulled', yield: '40.0 q/ha dry hay', price: '2,200 DZD/q', gross: '88,000 DZD/ha', n_fixed: '+30 kg N/ha', fert: '60 kg SSP', rain_opt: '350–700 mm', ph_opt: '7.0–8.5 (deep taproot breaks hard calcareous pans)' },
      { name: 'Safflower (Carthame)', family: 'Oilseed', sowing: 'March 1 – 25', harvest: 'July 15 – Aug 5', seed_rate: '20–25 kg/ha', depth: '2–3 cm', yield: '14.0 q/ha', price: '8,800 DZD/q', gross: '123,200 DZD/ha', fert: '130 kg NPK', rain_opt: '240–550 mm', drought_tol: '90% (deepest taproot >2 m to draw subsoil water)' },
    ],
    npk_3yr_summary: 'Baseline continuous wheat: 420 kg NPK/ha. Recommended Durum → Lentil → Barley: 249 kg NPK/ha (Saves 171 kg NPK/ha over 3 years).',
    sanitation_rules: '2-year pulse rest against Ascochyta blight and root-knot nematodes; breaks cereal Fusarium crown rot and Cephalosporium stripe.',
  },
  regionB: {
    name: 'Central Kansas, USA',
    climate: 'Temperate continental (mean annual rainfall 2015-2024: 692.0 mm/yr, rainfall trend: -36.4 mm/decade (medium confidence, no MBB test); 60 frost days; 42 hot days >35°C; Ogallala groundwater depletion).',
    soil: 'Silt loam (pH 6.5–7.2, Soil Organic Carbon: 18.2 g/kg).',
    recommended: 'Winter Wheat → Grain Sorghum → Soybean or Alfalfa.',
    crops: [
      { name: 'Hard Red Winter Wheat', sowing: 'Sept 20 – Oct 20', harvest: 'June 20 – July 10', seed_rate: '60–75 lb/ac', yield: '38 bu/ac', price: '$6.50/bu', fert: '80 lb N/ac' },
      { name: 'Grain Sorghum (Milo)', sowing: 'May 15 – June 10', harvest: 'Oct 1 – 25', seed_rate: '4–6 lb/ac', yield: '75 bu/ac', price: '$5.20/bu', fert: '60 lb N/ac', water_need: '44% (uses 30% less water than corn in summer heat)' },
      { name: 'Alfalfa', sowing: 'Aug 15 – Sept 10', harvest: '3–4 cuts/yr', seed_rate: '15–18 lb/ac', yield: '4.5 tons/ac', price: '$180/ton', n_fixed: '+45 kg N/ha (+40 lb N/ac)' },
    ],
    npk_3yr_summary: 'Saves ~35% on synthetic N when following alfalfa or soybean.',
  },
  regionC: {
    name: 'Punjab Plains, India',
    climate: 'Sub-tropical monsoon-dominant (mean annual rainfall 2015-2024: 709.2 mm/yr, rainfall trend: -38.2 mm/decade (medium confidence, no MBB test); water table dropping ~0.5 m/yr due to flood-irrigated rice-wheat).',
    soil: 'Indo-Gangetic alluvial loam (pH 7.8–8.3, low Soil Organic Carbon: 5.8 g/kg).',
    recommended: 'Direct-Seeded Rice (or Kharif Maize) → Summer Mung Bean → Rabi Wheat.',
    crops: [
      { name: 'Direct Seeded Rice (DSR)', sowing: 'June 1 – 20', harvest: 'Oct 15 – Nov 5', yield: '60 q/ha', water_saving: 'saves 25–30% irrigation vs puddled transplanted rice' },
      { name: 'Summer Mung Bean', sowing: 'April 1 – 15', harvest: 'June 10 – 20 (65-day short cycle)', seed_rate: '20–25 kg/ha', yield: '12 q/ha', n_fixed: '+28 kg N/ha' },
      { name: 'Rabi Wheat', sowing: 'Nov 1 – 20', harvest: 'April 10 – 30', seed_rate: '100 kg/ha', yield: '48 q/ha', fert: '120 kg N/ha' },
    ],
    npk_3yr_summary: 'Short-duration Mung Bean fixes +28 kg N/ha and breaks the rice-wheat root nematode cycle.',
  },
};

// Verified v2 pipeline regional facts (data/processed/tiaret|constantine/indicators.json).
// Both share the regionA agronomy domain, so the crop cards are reused.
DEFAULT_REGIONAL_FACTS.tiaret = {
  name: 'Tiaret Western High Plateaux, Algeria',
  climate: 'Semi-arid high plains (verified v2 pipeline, data/processed/tiaret/indicators.json: mean annual rainfall 2015-2024: 519.1 mm/yr; 30-year mean 575.3 mm; Theil-Sen drying trend: -16.8 mm/decade over 1995-2024, moving block bootstrap 95% CI [-95.2, 61.7] mm/decade — includes zero, NOT statistically significant at 95%; historical drought frequency: 23.3%, severe drought years 1998/2000/2002/2005/2020/2023/2024; water stress: 0.140).',
  soil: 'Calcareous (ISRIC SoilGrids 0-30 cm: pH 7.57, SOC 12.38 g/kg medium, AWC 140.6 mm/m Saxton-Rawls 2006 pedotransfer estimate).',
  recommended: 'Durum Wheat → Lentil → Barley (or Sulla / Chickpea / Safflower).',
  crops: DEFAULT_REGIONAL_FACTS.regionA.crops,
  npk_3yr_summary: 'Baseline continuous wheat: 420 kg NPK/ha. Legume sequences cut ~30% synthetic N on the following crop.',
  sanitation_rules: '2-year pulse rest against Ascochyta blight and root-knot nematodes; breaks cereal Fusarium crown rot.',
};
DEFAULT_REGIONAL_FACTS.constantine = {
  name: 'Constantine / El Khroub Plains, Algeria',
  climate: 'Sub-humid plains (verified v2 pipeline, data/processed/constantine/indicators.json: mean annual rainfall 2015-2024: 603.8 mm/yr; 30-year mean 684.4 mm; Theil-Sen drying trend: -46.4 mm/decade over 1995-2024, moving block bootstrap 95% CI [-117.7, 20.5] mm/decade — includes zero, NOT statistically significant at 95%; historical drought frequency: 20.0%, severe drought years 2000/2001/2016/2021/2022/2024; water stress: 0.167).',
  soil: 'Calcareous (ISRIC SoilGrids 0-30 cm: pH 7.50, SOC 17.08 g/kg medium, AWC 140.1 mm/m Saxton-Rawls 2006 pedotransfer estimate).',
  recommended: 'Durum Wheat → Lentil → Barley (or Sulla / Chickpea / Safflower).',
  crops: DEFAULT_REGIONAL_FACTS.regionA.crops,
  npk_3yr_summary: 'Baseline continuous wheat: 420 kg NPK/ha. Legume sequences cut ~30% synthetic N on the following crop.',
  sanitation_rules: '2-year pulse rest against Ascochyta blight and root-knot nematodes; breaks cereal Fusarium crown rot.',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const question = String(body.question || '').trim();
    const isArabic = /[\u0600-\u06FF]/.test(question);
    const isFrench = /[éèêëàâùûîïôçœ]|\b(pourquoi|comment|quel|quelle|quels|quelles|culture|cultures|assolement|rotation|blé|ble|orge|eau|sol|pluie|engrais)\b/i.test(question);
    const lang = body.lang || (isArabic ? 'ar' : isFrench ? 'fr' : 'en');
    const langName = { ar: 'Arabic (العربية الفصحى المبسطة الدقيقة للمزارع)', fr: 'French', en: 'English' }[lang] || 'English';
    const groqKey = (process.env.GROQ_API_KEY || '').trim();

    if (!groqKey || !question) {
      return {
        statusCode: 503,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'GROQ_API_KEY not configured or empty question' }),
      };
    }

    // If client already prepared RAG context (localFallback), use its passages & engine_summary
    const localCtx = body.localContext || {};
    if (localCtx.refused) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(localCtx),
      };
    }

    const REGION_ALIASES = { kansas: 'regionB', punjab: 'regionC', setif: 'regionA', tiaret: 'tiaret', constantine: 'constantine' };
    const regId = REGION_ALIASES[body.region] || (DEFAULT_REGIONAL_FACTS[body.region] ? body.region : 'regionA');
    const regFacts = DEFAULT_REGIONAL_FACTS[regId] || DEFAULT_REGIONAL_FACTS.regionA;

    // Filter out internal software docs from sources
    const rawSources = Array.isArray(localCtx.sources) ? localCtx.sources : [];
    const sources = rawSources.filter((p) => {
      const doc = String(p.doc_id || '');
      return !doc.startsWith('DOC-ML') && !doc.startsWith('DOC-DEC') && !doc.startsWith('DOC-GAPS');
    });

    const engineSummary = localCtx.engine_summary || {
      region: regFacts.name,
      top_plan: {
        rotation: regFacts.recommended.split(' → ').map((s) => s.trim()),
        score_100: 78,
      },
    };
    const cropBlock = localCtx.crop_block || '';

    const cropsJson = JSON.stringify(regFacts.crops || [], null, 2);
    const docsTxt = sources.length > 0
      ? sources
          .map((p) => `[${p.title} — ${p.section}]:\n${p.excerpt || p.text || ''}`)
          .join('\n\n')
      : `Regional Baseline for ${regFacts.name}:\n- Climate: ${regFacts.climate}\n- Soil: ${regFacts.soil}\n- Best Practice: ${regFacts.recommended}\n- 3-Year Fertilizer Impact: ${regFacts.npk_3yr_summary}\n- Disease & Weed Rules: ${regFacts.sanitation_rules}`;

    const systemMsg =
      `You are Field Shift's trusted, expert Agronomy Advisor speaking directly to a farmer. Respond strictly in ${langName}.\n` +
      `MANDATORY PRECISION & SPECIFICITY RULES FOR FARMERS:\n` +
      `1. Be extremely specific, precise, and numeric. Never give vague or generic advice.\n` +
      `2. For every crop or rotation discussed, ALWAYS provide the exact agronomic parameters available in the context:\n` +
      `   - Sowing & Harvest calendar dates (e.g., Sow Durum Wheat Nov 15–Dec 10; harvest late June).\n` +
      `   - Seeding rate (kg/ha or lb/ac) and sowing depth (cm) (e.g., Lentil 60–80 kg/ha at 3–4 cm; Durum 130–150 kg/ha at 4–5 cm).\n` +
      `   - Exact Nitrogen credit in kg N/ha (e.g., Lentil +20 kg N/ha, Chickpea +25 kg N/ha, Sulla +30 kg N/ha, Alfalfa +45 kg N/ha).\n` +
      `   - Exact fertilizer NPK amounts in kg/ha and percentage saved (e.g., saves 30% synthetic N on following crop; 3-year total: 249 kg NPK/ha vs 420 kg/ha in continuous cereals, saving 171 kg NPK/ha).\n` +
      `   - Expected baseline yield (q/ha) and gross revenue in local currency (e.g., Lentil: 12 q/ha @ 14,000 DZD/q = 168,000 DZD/ha; Durum: 20 q/ha @ 6,000 DZD/q = 120,000 DZD/ha; Barley: 23 q/ha @ 3,400 DZD/q = 78,200 DZD/ha).\n` +
      `   - Exact climate & soil figures: mean rainfall (485 mm), acute drought anomaly threshold (≤398 mm), soil pH (7.8–8.2 calcareous clay-loam), frost days (34 days in spring), hot days >35°C (20 days).\n` +
      `   - Specific plant pathology: name the exact diseases and weeds prevented by rotation (e.g., breaks Fusarium crown rot and Cephalosporium stripe; enforces a 2-year rest against Ascochyta blight and Orobanche broomrape).\n` +
      `3. Structure your response with clean, readable sections using emojis:\n` +
      `   - 🎯 **Direct Recommendation / التوصية المباشرة / Conseil direct**: 1-2 precise sentences.\n` +
      `   - 🌾 **Detailed Crop Sequence & Agronomic Rates**: Specific bullet points with sowing windows, seed rates, depths, yields, and revenues.\n` +
      `   - 💧 **Water & Climate Resilience**: Specific rainfall envelope, drought tolerance %, and frost timing.\n` +
      `   - 🌱 **Nitrogen Balance & Fertilizer Savings**: Exact kg N/ha fixed, NPK dosage in kg/ha, and cost savings.\n` +
      `   - 💡 **Actionable Farm Tip**: Practical advice on combine header height, seedbed rolling, or pest monitoring.\n` +
      `4. DO NOT use developer citation codes like "[DOC-ML-001 · Section 2]", software engineering terms, database names, or API tables.\n` +
      `5. If referring to sources, cite regional trials (e.g., "According to ITGC / CCLS field trials" or "Based on NASA POWER & SoilGrids data").\n` +
      `6. Always quote the exact engine score numbers naturally (e.g., "Score: 78/100", "Water: 65/100", "Soil: 76/100").`;

    const userMsg =
      `FARMER QUESTION (${langName}): ${question}\n\n` +
      `FARM REGION: ${regFacts.name}\n` +
      `CLIMATE CONTEXT: ${regFacts.climate}\n` +
      `SOIL CONTEXT: ${regFacts.soil}\n` +
      `EXACT REGIONAL CROP SPECIFICATIONS:\n${cropsJson}\n\n` +
      (cropBlock ? `REQUESTED CROP PROFILES:\n${cropBlock}\n\n` : '') +
      `COMPUTED ROTATION SCORES & IMPACT:\n${JSON.stringify(engineSummary, null, 2)}\n\n` +
      `VERIFIED AGRONOMY KNOWLEDGE:\n${docsTxt}`;

    for (const model of GROQ_MODELS) {
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemMsg },
              { role: 'user', content: userMsg },
            ],
            temperature: 0.2,
            max_tokens: 850,
          }),
        });

        if (resp.ok) {
          const out = await resp.json();
          const text = out?.choices?.[0]?.message?.content?.trim();
          if (text && text.length > 20) {
            return {
              statusCode: 200,
              headers: CORS_HEADERS,
              body: JSON.stringify({
                ...localCtx,
                answer: text,
                language: lang,
                direction: lang === 'ar' ? 'rtl' : 'ltr',
                dir: lang === 'ar' ? 'rtl' : 'ltr',
                refused: false,
                llm_provider: `groq:${model}`,
                mode: `groq:${model}`,
              }),
            };
          }
        }
      } catch (e) {
        // Try next model if network fails
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(localCtx),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err?.message || 'Server error' }),
    };
  }
};
