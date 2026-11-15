// Deterministic client-side mirror of engine/scoring.py (with load_region per-region crops & rules)
// so static builds (Netlify / offline) compute real 3-year rankings, Monte Carlo stability, and custom crops.
import bundle from '../data/realDataBundle.json';
import { REGIONS, PREBUILT_CUSTOM_REGION, toEngineRegionId } from '../data/regions';
import { getRegionalCrops } from '../data/crops';

const K_WATER = 1.5;
const K_SOIL = 1.5;
const clamp = x => Math.max(0, Math.min(1, x));

function buildCropLookup(regionObj, custom = []) {
  const map = {};
  const regCrops = getRegionalCrops(regionObj, []);
  for (const c of regCrops) {
    map[c.id] = {
      id: c.id,
      name: c.name,
      family: c.family,
      water_need: c.waterNeed,
      nitrogen_fixing: c.nitrogenFixing,
      residue_carbon: c.residueCarbon,
      drought_tolerance: c.droughtTolerance,
      profit: c.profit,
      risk_level: c.riskLevel,
      risk_note: c.riskNote,
      depletion: c.depletion,
      n_impact: c.nImpact,
      health_delta: c.healthDelta,
      npk_base: c.npkBase,
      fert_name: c.fertName,
      rain_opt: c.rainOpt,
      ph_opt: c.phOpt,
      frost_tolerant: c.frostTolerant,
      heat_tolerant: c.heatTolerant,
      gross_income_dzd_ha: c.grossIncomeDzd,
    };
  }
  for (const raw of custom) {
    if (!raw?.id) continue;
    const fam = raw.family === 'other' ? 'forage_broadleaf' : (raw.family || 'forage_broadleaf');
    const rainOpt = raw.rain || [350, 600];
    const phOpt = raw.ph || [6.2, 8.2];
    const price = Number(raw.price ?? 10000);
    const yld = Number(raw.yield ?? 12);
    const income = Math.round(price * yld);
    const avgRain = (Number(rainOpt[0]) + Number(rainOpt[1])) / 2;
    const isLeg = fam === 'legume';
    const isFal = fam === 'fallow';

    map[raw.id] = {
      id: raw.id,
      name: raw.name || raw.id,
      family: fam,
      water_need: isFal ? 0.05 : Math.round(Math.min(0.95, Math.max(0.18, avgRain / 950)) * 100) / 100,
      nitrogen_fixing: isLeg ? 1 : 0,
      residue_carbon: isLeg ? 0.45 : (isFal ? 0.25 : 0.62),
      drought_tolerance: Math.round(Math.min(0.95, Math.max(0.25, 1 - Math.max(0, Number(rainOpt[0]) - 250) / 700)) * 100) / 100,
      profit: Math.round(Math.min(0.95, Math.max(0.20, income / 240000)) * 100) / 100,
      risk_level: isFal ? 0.15 : (isLeg ? 0.32 : 0.36),
      risk_note: 'Custom farmer crop (verified for region; confirm variety with local extension).',
      depletion: isFal ? 0 : (isLeg ? 1 : 3),
      n_impact: isLeg ? 22 : (isFal ? 8 : -20),
      health_delta: isLeg ? 15 : (isFal ? 8 : -6),
      npk_base: isLeg ? 100 : (isFal ? 0 : 175),
      fert_name: isLeg ? 'DAP (starter)' : (isFal ? 'None (Moisture & N Reset)' : 'NPK 15:15:15'),
      rain_opt: [Number(rainOpt[0]), Number(rainOpt[1])],
      ph_opt: [Number(phOpt[0]), Number(phOpt[1])],
      frost_tolerant: raw.frost === false ? 0 : 1,
      heat_tolerant: raw.heat === false ? 0 : 1,
      gross_income_dzd_ha: income,
    };
  }
  return map;
}

function adjustWeights(weights, rain, refRain, soc, socThr) {
  const waterStress = clamp((refRain - rain) / refRain);
  const socDeficit = clamp((socThr - soc) / socThr);
  const w = {
    profit: weights.profit,
    water: weights.water * (1 + K_WATER * waterStress),
    soil: weights.soil * (1 + K_SOIL * socDeficit),
    risk: weights.risk,
  };
  const tot = w.profit + w.water + w.soil + w.risk;
  return {
    profit: w.profit / tot,
    water: w.water / tot,
    soil: w.soil / tot,
    risk: w.risk / tot,
  };
}

function buildPairs(rot, cyclic = true) {
  const pairs = [];
  for (let i = 0; i < rot.length - 1; i++) {
    pairs.push([rot[i], rot[i + 1]]);
  }
  if (cyclic && rot.length >= 2) {
    pairs.push([rot[rot.length - 1], rot[0]]);
  }
  return pairs;
}

function passesRules(rot, crops, rules) {
  const targetLen = rules.rotation_length || 3;
  if (rot.length !== targetLen) return false;
  if (rot.some(c => !crops[c])) return false;
  if (new Set(rot).size < rot.length && rules.max_occurrences_per_crop === 1) return false;
  const pairs = buildPairs(rot, Boolean(rules.cyclic));
  if (rules.forbid_consecutive_same_family && pairs.some(([a, b]) => crops[a].family === crops[b].family)) return false;
  if (rot.reduce((s, c) => s + crops[c].nitrogen_fixing, 0) < rules.min_legumes) return false;
  const high = rot.filter(c => crops[c].water_need >= rules.high_water_need_threshold).length;
  return high <= rules.max_high_water_crops;
}

function scoreParts(rot, crops) {
  const mean = k => rot.reduce((s, c) => s + (crops[c]?.[k] ?? 0), 0) / rot.length;
  return {
    profit: mean('profit'),
    water: 1 - mean('water_need'),
    soil: 0.5 * mean('residue_carbon') + 0.5 * Math.min(1, 2 * mean('nitrogen_fixing')),
    risk: 1 - mean('risk_level'),
  };
}

function totalScore(parts, w) {
  return w.profit * parts.profit + w.water * parts.water + w.soil * parts.soil + w.risk * parts.risk;
}

function mlScores(rot, crops, rain) {
  const env = rot.map(cid => {
    const [rMin, rMax] = crops[cid]?.rain_opt || [300, 700];
    if (rain >= rMin && rain <= rMax) return 0.92;
    const dist = rain < rMin ? (rMin - rain) : (rain - rMax);
    return Math.max(0.15, Math.exp(-((dist / 220) ** 2)));
  });
  const envPct = Math.round((env.reduce((a, b) => a + b, 0) / rot.length) * 1000) / 10;

  const pairs = buildPairs(rot, true);
  const probs = pairs.map(([a, b]) => {
    const prev = crops[a], cand = crops[b];
    if (!prev || !cand) return 0.5;
    const depDelta = (prev.depletion - cand.depletion) / 4.0;
    const nRest = prev.depletion >= 3 && cand.nitrogen_fixing === 1 ? 1.0 : 0.0;
    const famBreak = prev.family !== cand.family ? 1.0 : -0.8;
    const samePen = a === b ? -1.2 : 0.0;
    const logit = 0.65 * famBreak + 0.75 * nRest + 0.35 * depDelta + 0.45 * cand.drought_tolerance + 0.35 * (1 - cand.water_need) + samePen;
    return 1.0 / (1.0 + Math.exp(-logit * 2.0));
  });
  const mlPct = Math.round((probs.reduce((a, b) => a + b, 0) / Math.max(1, probs.length)) * 1000) / 10;
  return { envPct, mlPct };
}

function simulate3yr(rot, crops, soc) {
  let currentN = Math.round((45 + soc * 2.5) * 10) / 10;
  let health = Math.round(clamp(0.45 + soc / 30) * 1000) / 10;
  let totalNpk = 0;
  let prevLeg = false;

  const years = rot.map(cid => {
    const c = crops[cid];
    const mult = prevLeg ? 0.70 : (currentN > 75 ? 0.85 : 1.0);
    const kg = Math.round(c.npk_base * mult);
    totalNpk += kg;
    currentN = Math.round(Math.max(15, currentN + c.n_impact) * 10) / 10;
    health = Math.round(Math.max(20, Math.min(100, health + c.health_delta)) * 10) / 10;
    const out = {
      crop: c.name,
      family: c.family,
      soilN: Math.round(currentN),
      health: Math.round(health),
      fertilizer: c.fert_name,
      kg,
      risks: [c.risk_note || 'Follow local extension agronomic schedule.'],
      ...(prevLeg ? { nCredit: 30 } : {}),
    };
    prevLeg = c.nitrogen_fixing === 1;
    return out;
  });
  return { years, totalNpk, soilNEnd: Math.round(currentN) };
}

function tagsFor(rot, crops, income) {
  const pairs = buildPairs(rot, true);
  const tags = [];
  if (rot.some(c => crops[c]?.nitrogen_fixing === 1)) tags.push('restoresN');
  if (pairs.some(([a, b]) => crops[a]?.depletion >= 3 && crops[b]?.nitrogen_fixing === 1)) tags.push('afterHeavyFeeder');
  if (rot.reduce((s, c) => s + (crops[c]?.water_need ?? 0), 0) / rot.length <= 0.42) tags.push('lowWater');
  if (rot.reduce((s, c) => s + (crops[c]?.drought_tolerance ?? 0), 0) / rot.length >= 0.72) tags.push('drought');
  if (income >= 130000) tags.push('highProfit');
  if (rot.some(c => crops[c]?.depletion >= 4)) tags.push('highN');
  return tags;
}

function buildRuleTrace({ rot, parts, existingParts, existingNpk, totalNpk, allCrops, soc, socThr, effRain, senSlopeDecade, rankLabel }) {
  const legumes = rot.filter(cid => allCrops[cid]?.nitrogen_fixing === 1).map(cid => allCrops[cid]?.name || cid);
  const droughtCrops = rot.filter(cid => (allCrops[cid]?.drought_tolerance ?? 0) >= 0.72).map(cid => allCrops[cid]?.name || cid);
  const waterGain = Math.round((parts.water - existingParts.water) * 100);
  const npkSaved = existingNpk - totalNpk;
  const reasons = [];

  if (soc < socThr && legumes.length > 0) {
    reasons.push(`soil organic carbon is below threshold (${soc.toFixed(2)} vs ${socThr.toFixed(0)} g/kg), so nitrogen-fixing ${legumes[0]} replenishes soil fertility`);
  } else if (soc >= socThr) {
    reasons.push(`soil organic carbon is adequate (${soc.toFixed(2)} ≥ ${socThr.toFixed(0)} g/kg) to buffer against declining rainfall trends`);
  }

  if (senSlopeDecade <= -15 && droughtCrops.length > 0) {
    const uniqDrought = [...new Set(droughtCrops)].join(', ');
    reasons.push(`drought-tolerant ${uniqDrought} counters the ${senSlopeDecade.toFixed(1)} mm/decade Sen's Slope drying velocity (at ${Math.round(effRain)} mm/yr rainfall)`);
  } else if (waterGain > 0) {
    reasons.push(`it improves water efficiency by +${waterGain} pts over your current rotation`);
  }

  if (npkSaved > 0) {
    reasons.push(`cuts ${rot.length}-year synthetic NPK fertilizer by ${npkSaved} kg/ha`);
  }

  if (!reasons.length) {
    reasons.push(`it balances water conservation (${Math.round(parts.water * 100)}/100) and soil health (${Math.round(parts.soil * 100)}/100)`);
  }

  const head = reasons.slice(0, 2).join(' and ');
  const tail = reasons.length > 2 ? `, while it ${reasons[2]}.` : '.';
  return `${rankLabel} because ${head}${tail}`;
}

export function rankDynamicCropsForRegion({
  region = 'regionA',
  custom = [],
  priorities = { water: 34, soil: 33, yield: 33 },
  scenario = { rain: 0, temp: 0 },
}) {
  const engineReg = toEngineRegionId(region);
  const regionObj = REGIONS[region] || REGIONS[engineReg] || (region.startsWith('custom_') ? PREBUILT_CUSTOM_REGION : null) || REGIONS.regionA;
  const regRec = bundle.regions[engineReg] || bundle.regions[region] || bundle.regions.regionA;
  const v1 = regRec.v1 || {};
  const v2 = regRec.v2 || {};
  const baseRain = Number(v1.rainfall_mm ?? regionObj.rain10yr);
  const rainRef = Number(v1.rainfall_reference_mm ?? regionObj.rain30yr);
  const soc = Number(v1.soil_organic_carbon_g_per_kg ?? regionObj.soc);
  const socThr = Number(v1.soc_threshold_g_per_kg ?? regionObj.socThreshold ?? 15.0);
  const phVal = Number(regionObj.phScalar ?? 7.5);
  const baseSenSlope = Number(v2.rainfall_trend?.sen_slope_mm_per_decade ?? v1.climate_baseline?.rainfall_trend_decade_mm ?? 0);
  // Scenario rainfall slider also amplifies effective drying velocity
  const senSlopeDecade = baseSenSlope + Number(scenario.rain || 0) * 1.1;

  const effRain = baseRain * (1 + Number(scenario.rain || 0) / 100) * (1 - 0.025 * Number(scenario.temp || 0));
  const totP = Math.max(1, Number(priorities.water || 0) + Number(priorities.soil || 0) + Number(priorities.yield || 0));
  const baseW = {
    water: Number(priorities.water) / totP,
    soil: Number(priorities.soil) / totP,
    profit: Number(priorities.yield) / (2 * totP),
    risk: Number(priorities.yield) / (2 * totP),
  };
  const w = adjustWeights(baseW, effRain, rainRef, soc, socThr);
  const waterStress = clamp((rainRef - effRain) / rainRef);
  const dryingVelocityStress = clamp(Math.max(0, -senSlopeDecade) / 60);
  const droughtPressure = clamp(0.6 * waterStress + 0.4 * dryingVelocityStress);

  const allCrops = buildCropLookup(regionObj, custom);
  const list = Object.values(allCrops).map(c => {
    const [rMin, rMax] = c.rain_opt || [300, 650];
    const [pMin, pMax] = c.ph_opt || [6.0, 8.2];
    const waterFit = (1 - c.water_need) * (1 - 0.35 * droughtPressure) + c.drought_tolerance * (0.35 * droughtPressure);
    const soilFit = 0.5 * c.residue_carbon + 0.5 * c.nitrogen_fixing;
    const profitFit = c.profit;
    const riskFit = (1 - c.risk_level) * (1 - 0.25 * droughtPressure) + c.drought_tolerance * (0.25 * droughtPressure);
    const rawScore = w.water * waterFit + w.soil * soilFit + w.profit * profitFit + w.risk * riskFit;

    let rainConf = 0.94;
    if (effRain < rMin || effRain > rMax) {
      const dist = effRain < rMin ? (rMin - effRain) : (effRain - rMax);
      rainConf = Math.max(0.25, Math.exp(-((dist / 210) ** 2)));
    }
    const phConf = (phVal >= pMin && phVal <= pMax) ? 0.95 : Math.max(0.40, 1 - 0.35 * Math.min(Math.abs(phVal - pMin), Math.abs(phVal - pMax)));
    const confidencePct = Math.round(clamp(0.55 * rainConf + 0.25 * phConf + 0.20 * c.drought_tolerance) * 1000) / 10;
    const suitabilityPct = Math.round(clamp(rawScore) * 1000) / 10;

    let ruleTrace = '';
    if (senSlopeDecade <= -15 && c.drought_tolerance >= 0.75) {
      ruleTrace = `Prioritized (+drought shift) because Sen's Slope drying velocity (${senSlopeDecade >= 0 ? '+' : ''}${senSlopeDecade.toFixed(1)} mm/decade) and ${Math.round(effRain)} mm rainfall favor high drought tolerance (${Math.round(c.drought_tolerance * 100)}%) and low water need (${Math.round(c.water_need * 100)}%).`;
    } else if (c.nitrogen_fixing === 1 && soc < socThr) {
      ruleTrace = `Boosted because SoilGrids SOC (${soc.toFixed(2)} g/kg) is below the ${socThr.toFixed(0)} g/kg threshold; biological N fixation (${c.n_impact >= 0 ? '+' : ''}${c.n_impact} kg N/ha) restores fertility.`;
    } else if (effRain < rMin) {
      ruleTrace = `Penalized under ${Math.round(effRain)} mm rainfall (below ${rMin} mm optimal minimum) with Sen's Slope ${senSlopeDecade.toFixed(1)} mm/decade.`;
    } else {
      ruleTrace = `Matches regional envelope (${Math.round(effRain)} mm vs ${rMin}–${rMax} mm optimal, SoilGrids pH ${phVal.toFixed(2)}) with ${Math.round(confidencePct)}% agronomic confidence.`;
    }

    return {
      crop_id: c.id,
      name: c.name,
      family: c.family,
      suitability_score: Number(rawScore.toFixed(4)),
      suitability_pct: suitabilityPct,
      confidence_pct: confidencePct,
      water_need_pct: Math.round(c.water_need * 100),
      drought_tolerance_pct: Math.round(c.drought_tolerance * 100),
      n_impact_kg_ha: c.n_impact,
      rule_trace: ruleTrace,
    };
  });

  list.sort((a, b) => b.suitability_score - a.suitability_score || b.confidence_pct - a.confidence_pct || a.name.localeCompare(b.name));
  list.forEach((item, idx) => { item.rank = idx + 1; });
  return {
    senSlopeDecade: Number(senSlopeDecade.toFixed(1)),
    effRain: Math.round(effRain),
    soc,
    socThr,
    droughtPressurePct: Math.round(droughtPressure * 100),
    crops: list,
  };
}

export function evaluateCustomStrategy({
  region = 'regionA',
  rotation = ['durum', 'lentil', 'barley'],
  custom = [],
  priorities = { water: 34, soil: 33, yield: 33 },
  scenario = { rain: 0, temp: 0 },
  baselineNpk = null,
}) {
  const engineReg = toEngineRegionId(region);
  const regionObj = REGIONS[region] || REGIONS[engineReg] || (region.startsWith('custom_') ? PREBUILT_CUSTOM_REGION : null) || REGIONS.regionA;
  const regRec = bundle.regions[engineReg] || bundle.regions[region] || bundle.regions.regionA;
  const v1 = regRec.v1 || {};
  const v2 = regRec.v2 || {};
  const baseRain = Number(v1.rainfall_mm ?? regionObj.rain10yr);
  const rainRef = Number(v1.rainfall_reference_mm ?? regionObj.rain30yr);
  const soc = Number(v1.soil_organic_carbon_g_per_kg ?? regionObj.soc);
  const socThr = Number(v1.soc_threshold_g_per_kg ?? regionObj.socThreshold ?? 15.0);
  const senSlopeDecade = Number(v2.rainfall_trend?.sen_slope_mm_per_decade ?? v1.climate_baseline?.rainfall_trend_decade_mm ?? 0) + Number(scenario.rain || 0) * 1.1;
  const effRain = baseRain * (1 + Number(scenario.rain || 0) / 100) * (1 - 0.025 * Number(scenario.temp || 0));

  const totP = Math.max(1, Number(priorities.water || 0) + Number(priorities.soil || 0) + Number(priorities.yield || 0));
  const baseW = {
    water: Number(priorities.water) / totP,
    soil: Number(priorities.soil) / totP,
    profit: Number(priorities.yield) / (2 * totP),
    risk: Number(priorities.yield) / (2 * totP),
  };
  const w = adjustWeights(baseW, effRain, rainRef, soc, socThr);
  const allCrops = buildCropLookup(regionObj, custom);
  const cleanRot = rotation.map(id => (allCrops[id] ? id : Object.keys(allCrops)[0]));
  const parts = scoreParts(cleanRot, allCrops);
  const score = totalScore(parts, w);
  const { envPct, mlPct } = mlScores(cleanRot, allCrops, effRain);
  const sim = simulate3yr(cleanRot, allCrops, soc);
  const income = Math.round(cleanRot.reduce((s, cid) => s + (allCrops[cid]?.gross_income_dzd_ha || 0), 0) / cleanRot.length);

  // Aggregate risk metrics: water stress exposure, erosion risk (1 - residue_carbon), and net nitrogen balance
  const meanResidue = cleanRot.reduce((s, cid) => s + (allCrops[cid]?.residue_carbon ?? 0.4), 0) / cleanRot.length;
  const erosionRiskPct = Math.round(clamp(1 - meanResidue) * 100);
  const netNitrogenKgHa = cleanRot.reduce((s, cid) => s + (allCrops[cid]?.n_impact ?? 0), 0);
  const waterNeedPct = Math.round((1 - parts.water) * 100);
  const aggregateRiskPct = Math.round((0.45 * waterNeedPct + 0.30 * erosionRiskPct + 0.25 * Math.round((1 - parts.risk) * 100)));

  const rules = { ...(regionObj.rules || bundle.rules), rotation_length: cleanRot.length };
  const ruleTrace = buildRuleTrace({
    rot: cleanRot,
    parts,
    existingParts: parts,
    existingNpk: baselineNpk ?? sim.totalNpk,
    totalNpk: sim.totalNpk,
    allCrops,
    soc,
    socThr,
    effRain,
    senSlopeDecade,
    rankLabel: 'Custom strategy',
  });

  return {
    crops: cleanRot.map(cid => allCrops[cid]?.name || cid),
    cropIds: cleanRot,
    passesRules: passesRules(cleanRot, allCrops, rules),
    score: Math.round(score * 100),
    envMatch: Math.round(envPct),
    sequenceFit: Math.round(mlPct),
    waterNeed: waterNeedPct,
    erosionRisk: erosionRiskPct,
    netNitrogenBalance: netNitrogenKgHa,
    aggregateRisk: aggregateRiskPct,
    ndviStability: Math.round((0.45 * parts.risk + 0.55 * (envPct / 100)) * 100),
    fertilizer: sim.totalNpk,
    soilNEnd: sim.soilNEnd,
    income,
    ruleTrace,
  };
}

export function computeLocalRanking({
  region = 'regionA',
  rotation = ['durum', 'barley', 'durum'],
  allowed = [],
  custom = [],
  priorities = { water: 34, soil: 33, yield: 33 },
  scenario = { rain: 0, temp: 0 },
}) {
  const engineReg = toEngineRegionId(region);
  const regionObj = REGIONS[region] || REGIONS[engineReg] || (region.startsWith('custom_') ? PREBUILT_CUSTOM_REGION : null) || REGIONS.regionA;
  const regRec = bundle.regions[engineReg] || bundle.regions[region] || bundle.regions.regionA;
  const v1 = regRec.v1 || {};
  const baseRain = Number(v1.rainfall_mm ?? regionObj.rain10yr);
  const rainRef = Number(v1.rainfall_reference_mm ?? regionObj.rain30yr);
  const soc = Number(v1.soil_organic_carbon_g_per_kg ?? regionObj.soc);
  const socThr = Number(v1.soc_threshold_g_per_kg ?? regionObj.socThreshold ?? 15.0);

  const effRain = baseRain * (1 + Number(scenario.rain || 0) / 100) * (1 - 0.025 * Number(scenario.temp || 0));
  const totP = Math.max(1, Number(priorities.water || 0) + Number(priorities.soil || 0) + Number(priorities.yield || 0));
  const baseW = {
    water: Number(priorities.water) / totP,
    soil: Number(priorities.soil) / totP,
    profit: Number(priorities.yield) / (2 * totP),
    risk: Number(priorities.yield) / (2 * totP),
  };
  const w = adjustWeights(baseW, effRain, rainRef, soc, socThr);

  const allCrops = buildCropLookup(regionObj, custom);
  const validAllowed = allowed.filter(id => allCrops[id]);
  const allowedIds = (validAllowed.length >= 3 ? validAllowed : Object.keys(allCrops)).sort();

  const baseRules = regionObj.rules || bundle.rules;
  const targetLen = Math.max(2, Math.min(5, (Array.isArray(rotation) && rotation.length) ? rotation.length : (baseRules.rotation_length || 3)));
  const rules = { ...baseRules, rotation_length: targetLen };

  // For 4-year and 5-year rotations, cap candidate pool to top 10 crops by yield+drought+water efficiency
  // so combinatorial expansion stays instantaneous in the browser while preserving all user-selected rotation crops.
  let poolIds = allowedIds;
  if (targetLen >= 4 && allowedIds.length > 10) {
    const mustKeep = new Set(Array.isArray(rotation) ? rotation : []);
    const rankedPool = [...allowedIds].sort((idA, idB) => {
      const ca = allCrops[idA] || {};
      const cb = allCrops[idB] || {};
      const sa = (ca.yieldIndex || 0) + (ca.droughtTolerance || 0) - 0.5 * (ca.waterUse || 0);
      const sb = (cb.yieldIndex || 0) + (cb.droughtTolerance || 0) - 0.5 * (cb.waterUse || 0);
      return sb - sa;
    });
    const filtered = rankedPool.filter((id) => mustKeep.has(id));
    for (const id of rankedPool) {
      if (filtered.length >= (targetLen === 4 ? 10 : 7)) break;
      if (!mustKeep.has(id)) filtered.push(id);
    }
    poolIds = filtered;
  }

  const combos = [];
  function buildCombos(prefix) {
    if (prefix.length === targetLen) {
      combos.push(prefix);
      return;
    }
    for (const cId of poolIds) {
      buildCombos([...prefix, cId]);
    }
  }
  buildCombos([]);

  const evalRot = (rot, weightsObj, rainVal) => {
    const parts = scoreParts(rot, allCrops);
    const score = totalScore(parts, weightsObj);
    const { envPct, mlPct } = mlScores(rot, allCrops, rainVal);
    const income = Math.round(rot.reduce((s, cid) => s + (allCrops[cid].gross_income_dzd_ha || 0), 0) / rot.length);
    return { rot, parts, score, envPct, mlPct, income };
  };

  let candidates = combos.filter(r => passesRules(r, allCrops, rules));
  if (candidates.length < 3) {
    // Relax max_high_water_crops if user only selected 3 crops (e.g. rice/wheat/maize + mung_bean)
    const relaxedRules = { ...rules, max_high_water_crops: 2 };
    candidates = combos.filter(r => passesRules(r, allCrops, relaxedRules));
  }

  const ranked = candidates
    .map(r => evalRot(r, w, effRain))
    .sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      const xl = allCrops[x.rot[0]].family === 'legume' ? 0 : 1;
      const yl = allCrops[y.rot[0]].family === 'legume' ? 0 : 1;
      if (xl !== yl) return xl - yl;
      return x.rot.join(',').localeCompare(y.rot.join(','));
    });

  const existingRot = rotation.map(id => (allCrops[id] ? id : allowedIds[0]));
  const existingKey = [...existingRot].sort().join('|');
  const seen = new Set([existingKey]);
  const picked = [];
  for (const item of ranked) {
    const key = [...item.rot].sort().join('|');
    if (!seen.has(key)) {
      seen.add(key);
      picked.push(item);
      if (picked.length === 4) break;
    }
  }
  if (picked.length < 4) {
    for (const item of ranked) {
      if (item.rot.join(',') !== existingRot.join(',') && !picked.includes(item)) {
        picked.push(item);
        if (picked.length === 4) break;
      }
    }
  }

  const existingEval = evalRot(existingRot, w, effRain);
  const existingSim = simulate3yr(existingRot, allCrops, soc);

  // Monte Carlo (100 seeded runs +/-15% rainfall)
  let seed = 42;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let wins = 0;
  const top1Key = picked[0]?.rot.join(',');
  for (let i = 0; i < 100; i++) {
    const noisyRain = effRain * (0.85 + 0.30 * rng());
    const wn = adjustWeights(baseW, noisyRain, rainRef, soc, socThr);
    let bestRot = null;
    let bestSc = -1;
    for (const r of candidates) {
      if (picked.length >= 3 && [...r].sort().join('|') === existingKey && ranked[0]?.rot.join(',') !== top1Key) continue;
      const sc = totalScore(scoreParts(r, allCrops), wn);
      const isBetter =
        sc > bestSc + 1e-12 ||
        (Math.abs(sc - bestSc) <= 1e-12 &&
          bestRot &&
          ((allCrops[r[0]].family === 'legume' ? 0 : 1) < (allCrops[bestRot[0]].family === 'legume' ? 0 : 1) ||
            ((allCrops[r[0]].family === 'legume') === (allCrops[bestRot[0]].family === 'legume') &&
              r.join(',').localeCompare(bestRot.join(',')) < 0)));
      if (!bestRot || isBetter) { bestSc = sc; bestRot = r; }
    }
    if (bestRot && bestRot.join(',') === top1Key) wins++;
  }

  const v2 = regRec.v2 || {};
  const senSlopeDecade = Number(v2.rainfall_trend?.sen_slope_mm_per_decade ?? v1.climate_baseline?.rainfall_trend_decade_mm ?? 0) + Number(scenario.rain || 0) * 1.1;

  const rotations = picked.map((item, idx) => {
    const sim = simulate3yr(item.rot, allCrops, soc);
    const risks = {};
    for (const cid of new Set(item.rot)) risks[allCrops[cid].name] = allCrops[cid].risk_note;
    const ruleTrace = buildRuleTrace({
      rot: item.rot,
      parts: item.parts,
      existingParts: existingEval.parts,
      existingNpk: existingSim.totalNpk,
      totalNpk: sim.totalNpk,
      allCrops,
      soc,
      socThr,
      effRain,
      senSlopeDecade,
      rankLabel: `Ranked #${idx + 1}`,
    });
    const meanRes = item.rot.reduce((s, cid) => s + (allCrops[cid]?.residue_carbon ?? 0.4), 0) / item.rot.length;
    const erosionRisk = Math.round(clamp(1 - meanRes) * 100);
    const netNitrogen = item.rot.reduce((s, cid) => s + (allCrops[cid]?.n_impact ?? 0), 0);
    return {
      rank: idx + 1,
      crops: item.rot.map(cid => allCrops[cid].name),
      cropIds: item.rot,
      ruleTrace,
      tags: tagsFor(item.rot, allCrops, item.income),
      scores: {
        final: Math.round(item.score * 100),
        ml: Math.round(item.mlPct),
        knn: Math.round(item.envPct),
      },
      criteria: {
        water: Math.round(item.parts.water * 100),
        soil: Math.round(item.parts.soil * 100),
        profit: Math.round(item.parts.profit * 100),
        risk: Math.round(item.parts.risk * 100),
      },
      years: sim.years,
      waterNeed: Math.round((1 - item.parts.water) * 100),
      erosionRisk,
      netNitrogenBalance: netNitrogen,
      ndviStability: Math.round((0.45 * item.parts.risk + 0.55 * (item.envPct / 100)) * 100),
      fertilizer: sim.totalNpk,
      fertilizerSaved: existingSim.totalNpk - sim.totalNpk,
      income: item.income,
      risks,
    };
  });

  const avoid = [];
  const tryPushAvoid = r => {
    if (avoid.length >= 3 || passesRules(r, allCrops, rules)) return;
    const reasons = [];
    if (new Set(r).size === 1) reasons.push('Strict monoculture exhausts soil nitrogen and amplifies root disease');
    else if (buildPairs(r, false).some(([a, b]) => allCrops[a]?.family === allCrops[b]?.family)) {
      reasons.push('Back-to-back same crop family multiplies pest & fungal carryover');
    }
    if (r.reduce((s, c) => s + (allCrops[c]?.nitrogen_fixing ?? 0), 0) < rules.min_legumes) {
      reasons.push('No nitrogen-fixing legume included; heavy synthetic fertilizer dependency');
    }
    if (r.filter(c => (allCrops[c]?.water_need ?? 0) >= rules.high_water_need_threshold).length > rules.max_high_water_crops) {
      reasons.push('Exceeds safe regional water budget (too many high-thirst crops)');
    }
    if (reasons.length) {
      const isMono = new Set(r).size === 1;
      avoid.push({
        crops: r.map(cid => allCrops[cid]?.name || cid),
        score: Math.round(evalRot(r, w, effRain).score * 100),
        level: isMono ? 'high' : 'caution',
        reason: reasons[0],
        soil: r.reduce((s, c) => s + (allCrops[c]?.nitrogen_fixing ?? 0), 0) < rules.min_legumes
          ? 'No legume nitrogen recharge — high synthetic NPK dependency.'
          : undefined,
        disease: isMono || buildPairs(r, false).some(([a, b]) => allCrops[a]?.family === allCrops[b]?.family)
          ? 'Multiplies root rot, Fusarium, and host-specific pests.'
          : undefined,
        water: r.filter(c => (allCrops[c]?.water_need ?? 0) >= rules.high_water_need_threshold).length > rules.max_high_water_crops
          ? 'Exceeds safe regional rainfall water budget.'
          : undefined,
        alternative: 1,
        reasons,
      });
    }
  };
  if (!passesRules(existingRot, allCrops, rules)) tryPushAvoid(existingRot);
  for (const r of combos) {
    if (r.join(',') !== existingRot.join(',')) tryPushAvoid(r);
    if (avoid.length >= 3) break;
  }

  const waterStress = Number(clamp((rainRef - effRain) / rainRef).toFixed(3));
  const socDeficit = Number(clamp((socThr - soc) / socThr).toFixed(3));
  const dryingVelocityStress = Number(clamp(Math.max(0, -senSlopeDecade) / 60).toFixed(3));
  const usualMeanRes = existingRot.reduce((s, cid) => s + (allCrops[cid]?.residue_carbon ?? 0.4), 0) / existingRot.length;
  const usualErosionRisk = Math.round(clamp(1 - usualMeanRes) * 100);
  const usualNetN = existingRot.reduce((s, cid) => s + (allCrops[cid]?.n_impact ?? 0), 0);
  const dynCrops = rankDynamicCropsForRegion({ region, custom, priorities, scenario });

  return {
    source: `Bundled Real Data + Local Scoring Engine · ${regionObj.name} (NASA POWER + SoilGrids + MODIS + Monte Carlo)`,
    sample: false,
    mode: 'local-engine',
    region,
    role: regionObj.role,
    farmingSystem: regionObj.farmingSystem,
    stress: {
      water_stress: waterStress,
      soc_deficit: socDeficit,
      sen_slope_mm_per_decade: Number(senSlopeDecade.toFixed(1)),
      drying_velocity_stress: dryingVelocityStress,
    },
    adjustedWeights: {
      water: Number(w.water.toFixed(3)),
      soil: Number(w.soil.toFixed(3)),
      profit: Number(w.profit.toFixed(3)),
      risk: Number(w.risk.toFixed(3)),
    },
    monteCarlo: { runs: 100, rank1StaysFirstPct: wins },
    cropRankings: dynCrops.crops,
    usual: {
      crops: existingRot.map(cid => allCrops[cid]?.name || cid),
      score: Math.round(existingEval.score * 100),
      criteria: {
        water: Math.round(existingEval.parts.water * 100),
        soil: Math.round(existingEval.parts.soil * 100),
        profit: Math.round(existingEval.parts.profit * 100),
        risk: Math.round(existingEval.parts.risk * 100),
      },
      waterNeed: Math.round((1 - existingEval.parts.water) * 100),
      erosionRisk: usualErosionRisk,
      netNitrogenBalance: usualNetN,
      ndviStability: Math.round((0.45 * existingEval.parts.risk + 0.55 * (existingEval.envPct / 100)) * 100),
      fertilizer: existingSim.totalNpk,
      income: existingEval.income,
      soilNEnd: existingSim.soilNEnd,
    },
    rotations,
    avoid,
  };
}
