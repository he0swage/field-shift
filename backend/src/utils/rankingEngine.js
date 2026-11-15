/**
 * Ranking engine used by POST /api/v1/ranking.
 *
 * Builds every 3-year rotation of distinct allowed crops, scores each one with the team's
 * scoreRotation() (water / soil / yield weighted by the farmer's priorities), applies the climate
 * scenario, and returns the top 4 + rotations to avoid in the shape the frontend renders
 * (same shape as frontend/src/data/sampleRanking.js).
 *
 * Simple, documented assumptions (returned in `assumptions` so the UI and the team can see them):
 *  - soil nitrogen starts at START_SOIL_N kg/ha and changes each year by the crop's n_impact_kg_ha
 *  - soil health starts at START_HEALTH % and changes by half the crop's soil_health_delta
 *  - a crop following a legume needs 30% less fertilizer (N credit)
 *  - dry / hot scenario: rotations with thirsty crops lose points
 */
const { getCropData } = require("./cropStore");
const { scoreRotation } = require("./rotationScorer");

const START_SOIL_N = 80;
const START_HEALTH = 70;
const LEGUME_CREDIT = 0.3;
const TOP_N = 4;
const MC_RUNS = 100;

// Frontend crop ids → data/processed/crops ids
const FRONT_TO_DATA = {
  durum: "wheat",
  soft: "soft_wheat",
  barley: "barley",
  oats: "oats",
  triticale: "triticale",
  chickpea: "chickpea",
  lentil: "lentil",
  faba: "faba",
  vetch: "vetch",
  rapeseed: "canola",
  safflower: "safflower",
  sunflower: "sunflower",
  fallow: "fallow",
};

// Display names identical to the frontend catalogue (so "allowed crop" checks match)
const DISPLAY_NAME = {
  wheat: "Durum wheat",
  soft_wheat: "Soft wheat",
  barley: "Barley",
  oats: "Forage oats",
  triticale: "Triticale",
  chickpea: "Chickpea",
  lentil: "Lentil",
  faba: "Faba bean",
  vetch: "Common vetch",
  canola: "Rapeseed",
  safflower: "Safflower",
  sunflower: "Sunflower",
  fallow: "Worked fallow",
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const avg = (list, key, fallback) => list.reduce((s, c) => s + (c[key] ?? fallback), 0) / list.length;

function loadCrop(frontId) {
  const dataId = FRONT_TO_DATA[frontId] || frontId;
  const data = getCropData(dataId);
  return data ? { ...data, frontId, name: DISPLAY_NAME[data.id] || data.crop } : null;
}

/** Scenario pressure: drier and hotter futures penalise thirsty rotations. */
function scenarioPenalty(crops, scenario = {}) {
  const pressure = Math.max(0, -(scenario.rain || 0)) / 50 + Math.max(0, scenario.temp || 0) / 5;
  return pressure * avg(crops, "water_need", 0.45) * 20;
}

function score(crops, weights, scenario) {
  const s = scoreRotation(crops, weights);
  return { ...s, final: clamp(Math.round(s.scores.weighted - scenarioPenalty(crops, scenario)), 0, 100) };
}

/** Year-by-year detail + summary metrics for one rotation. */
function describe(crops) {
  let soilN = START_SOIL_N, health = START_HEALTH, fertilizer = 0;
  const years = crops.map((c, i) => {
    const prevLegume = i > 0 && crops[i - 1].family === "legume";
    const kg = Math.round((c.base_npk_kg_ha || 0) * (prevLegume ? 1 - LEGUME_CREDIT : 1));
    fertilizer += kg;
    soilN = clamp(soilN + (c.n_impact_kg_ha || 0), 0, 200);
    health = clamp(health + (c.soil_health_delta || 0) / 2, 0, 100);
    return {
      crop: c.name,
      family: c.family,
      soilN: Math.round(soilN),
      health: Math.round(health),
      fertilizer: c.fertilizer_name || "—",
      kg,
      ...(prevLegume ? { nCredit: LEGUME_CREDIT * 100 } : {}),
      risks: String(c.risk_note || "")
        .split(";")
        .map((t) => t.replace(/\(needs local review\)/i, "").trim())
        .filter(Boolean)
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1) + (t.endsWith(".") ? "" : ".")),
    };
  });
  return {
    years,
    waterNeed: Math.round(avg(crops, "water_need", 0.45) * 100),
    ndviStability: Math.round((1 - avg(crops, "risk_level", 0.35)) * 100),
    fertilizer,
    income: Math.round(avg(crops, "gross_income_dzd_ha", 0) / 100) * 100,
  };
}

function tagsFor(crops, d) {
  const tags = [];
  if (crops.some((c) => c.family === "legume")) tags.push("restoresN");
  if (crops.some((c, i) => i > 0 && c.family === "legume" && crops[i - 1].family === "cereal")) tags.push("afterHeavyFeeder");
  if (d.waterNeed <= 42) tags.push("lowWater");
  if (avg(crops, "drought_tolerance", 0.6) >= 0.7) tags.push("drought");
  if (d.income >= 140000) tags.push("highProfit");
  if (crops.some((c) => (c.n_impact_kg_ha || 0) <= -28)) tags.push("highN");
  return tags;
}

/** Rule check used for the "avoid" list. */
function problems(crops) {
  const out = {};
  const sameCrop = crops.every((c) => c.id === crops[0].id);
  const sameFamily = crops.some((c, i) => i > 0 && c.family === crops[i - 1].family);
  if (sameCrop) out.reason = "Same crop every year (monoculture).";
  else if (sameFamily) out.reason = "Two crops of the same family in a row.";
  if (!crops.some((c) => c.family === "legume")) out.soil = "No legume to recharge soil nitrogen — higher fertilizer bill.";
  if (crops.some((c, i) => i > 0 && (c.water_need || 0) > 0.5 && (crops[i - 1].water_need || 0) > 0.5)) {
    out.water = "Two thirsty crops in a row.";
  }
  if (sameCrop || sameFamily) out.disease = "Repeating a family builds up soil-borne diseases and pests.";
  return out;
}

/** Small deterministic PRNG so Monte-Carlo results are stable for the same inputs. */
function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function permutations3(list) {
  const out = [];
  for (const a of list) for (const b of list) for (const c of list) {
    if (a !== b && b !== c && a !== c) out.push([a, b, c]);
  }
  return out;
}

function rank({ rotation = [], allowed = [], priorities, scenario, custom = [] }) {
  const weights = priorities || { water: 34, soil: 33, yield: 33 };

  const known = [], ignored = [];
  for (const id of [...new Set(allowed)]) {
    const crop = loadCrop(id);
    if (crop) known.push(crop); else ignored.push(id);
  }
  // custom crops are not in the team table yet
  custom.forEach((c) => { if (!ignored.includes(c.id)) ignored.push(c.id); });

  if (known.length < 3) {
    const err = new Error("At least 3 allowed crops with agronomic data are required.");
    err.status = 400; err.code = "NOT_ENOUGH_CROPS"; err.details = { ignored };
    throw err;
  }

  // Score every order, then keep only the best order of each crop set (so the top 4 are 4 different choices)
  const bestBySet = new Map();
  for (const crops of permutations3(known)) {
    const scored = { crops, ...score(crops, weights, scenario) };
    const key = crops.map((c) => c.id).sort().join();
    if (!bestBySet.has(key) || scored.final > bestBySet.get(key).final) bestBySet.set(key, scored);
  }
  const candidates = [...bestBySet.values()].sort((a, b) => b.final - a.final);
  const evaluated = bestBySet.size * 6;

  // Farmer's usual rotation (repeats allowed)
  const usualCrops = rotation.map(loadCrop);
  const usualKnown = usualCrops.every(Boolean);
  const usualDesc = usualKnown ? describe(usualCrops) : null;

  const top = candidates.slice(0, TOP_N).map((c, i) => {
    const d = describe(c.crops);
    return {
      rank: i + 1,
      crops: c.crops.map((x) => x.name),
      tags: tagsFor(c.crops, d),
      scores: { final: c.final, water: c.scores.water, soil: c.scores.soil, yield: c.scores.yield },
      ...d,
      fertilizerSaved: usualDesc ? usualDesc.fertilizer - d.fertilizer : 0,
    };
  });

  // Monte-Carlo: jitter priorities and scenario; how often does rank 1 stay first among the top 20?
  const pool = candidates.slice(0, 20);
  const seed = JSON.stringify({ allowed, weights, scenario }).split("").reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 2147483647, 7);
  const rand = rng(seed);
  let stays = 0;
  for (let run = 0; run < MC_RUNS; run++) {
    const w = {
      water: Math.max(0, weights.water + (rand() - 0.5) * 30),
      soil: Math.max(0, weights.soil + (rand() - 0.5) * 30),
      yield: Math.max(0, weights.yield + (rand() - 0.5) * 30),
    };
    const sc = { rain: (scenario?.rain || 0) + (rand() - 0.5) * 20, temp: (scenario?.temp || 0) + (rand() - 0.5) * 1 };
    const best = pool.reduce((b, c) => {
      const f = score(c.crops, w, sc).final;
      return f > b.f ? { c, f } : b;
    }, { c: null, f: -1 });
    if (best.c === pool[0]) stays++;
  }

  // Rotations to avoid: the farmer's usual rotation if it breaks rules, then common rule-breaking patterns
  const avoidPool = [];
  if (usualKnown) avoidPool.push(usualCrops);
  const cereals = known.filter((c) => c.family === "cereal");
  if (cereals[0]) avoidPool.push([cereals[0], cereals[0], cereals[0]]);
  if (cereals.length >= 3) avoidPool.push(cereals.slice(0, 3));
  const thirsty = [...known].sort((a, b) => (b.water_need || 0) - (a.water_need || 0));
  if (thirsty.length >= 2) avoidPool.push([thirsty[0], thirsty[1], thirsty[0]]);

  const seen = new Set();
  const avoid = avoidPool
    .map((crops) => ({ crops, p: problems(crops), s: score(crops, weights, scenario).final }))
    .filter(({ crops, p }) => {
      const key = crops.map((c) => c.id).join();
      if (seen.has(key) || !p.reason && !p.water) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map(({ crops, p, s }) => ({
      crops: crops.map((c) => c.name),
      score: s,
      level: s < 40 || p.reason?.startsWith("Same crop") ? "high" : "caution",
      reason: p.reason || "Water-hungry sequence for this climate.",
      ...(p.soil ? { soil: p.soil } : {}),
      ...(p.water ? { water: p.water } : {}),
      ...(p.disease ? { disease: p.disease } : {}),
      alternative: 1,
    }));

  return {
    source: "Field Shift ranking engine (rules + weighted scoring on the team crop table)",
    sample: false,
    monteCarlo: { runs: MC_RUNS, rank1StaysFirstPct: Math.round((stays / MC_RUNS) * 100) },
    usual: usualDesc
      ? { waterNeed: usualDesc.waterNeed, ndviStability: usualDesc.ndviStability, fertilizer: usualDesc.fertilizer, income: usualDesc.income, soilNEnd: usualDesc.years.at(-1).soilN }
      : null,
    rotations: top,
    avoid,
    ignoredCrops: ignored,
    candidatesEvaluated: evaluated,
    assumptions: [
      `Soil nitrogen starts at ${START_SOIL_N} kg/ha and changes by each crop's n_impact_kg_ha.`,
      `Soil health starts at ${START_HEALTH}% and changes by half of each crop's soil_health_delta.`,
      `A crop after a legume needs ${LEGUME_CREDIT * 100}% less fertilizer.`,
      "NDVI stability is estimated as 100 × (1 − average crop risk level) until MODIS data is wired in.",
      "Dry or hot scenarios lower the score of water-hungry rotations.",
    ],
  };
}

module.exports = { rank, FRONT_TO_DATA, DISPLAY_NAME };
