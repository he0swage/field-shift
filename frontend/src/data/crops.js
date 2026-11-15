// Crop catalogue and families (compatible with both repo UI views and deterministic localEngine.js).
import bundle from './realDataBundle.json';

export const FAMILIES = ['legume', 'cereal', 'oilseed', 'forage', 'root', 'fallow'];

const UI_META = {
  wheat: { uiId: 'durum', name: 'Durum wheat', uiFamily: 'cereal' },
  soft_wheat: { uiId: 'soft', name: 'Soft wheat', uiFamily: 'cereal' },
  barley: { uiId: 'barley', name: 'Barley', uiFamily: 'cereal' },
  oats: { uiId: 'oats', name: 'Forage oats', uiFamily: 'cereal' },
  triticale: { uiId: 'triticale', name: 'Triticale', uiFamily: 'cereal' },
  chickpea: { uiId: 'chickpea', name: 'Chickpea', uiFamily: 'legume' },
  lentil: { uiId: 'lentil', name: 'Lentil', uiFamily: 'legume' },
  faba: { uiId: 'faba', name: 'Faba bean', uiFamily: 'legume' },
  vetch: { uiId: 'vetch', name: 'Common vetch', uiFamily: 'legume' },
  canola: { uiId: 'rapeseed', name: 'Rapeseed', uiFamily: 'oilseed' },
  safflower: { uiId: 'safflower', name: 'Safflower', uiFamily: 'oilseed' },
  sunflower: { uiId: 'sunflower', name: 'Sunflower', uiFamily: 'oilseed' },
  alfalfa: { uiId: 'alfalfa', name: 'Alfalfa', uiFamily: 'forage' },
  sulla: { uiId: 'sulla', name: 'Sulla (Spanish Sainfoin)', uiFamily: 'forage' },
  onion: { uiId: 'onion', name: 'Onion', uiFamily: 'root' },
  potato: { uiId: 'potato', name: 'Potato', uiFamily: 'root' },
  fallow: { uiId: 'fallow', name: 'Worked fallow', uiFamily: 'fallow' },
  corn: { uiId: 'corn', name: 'Corn (Grain Maize)', uiFamily: 'cereal' },
  soybean: { uiId: 'soybean', name: 'Soybean', uiFamily: 'legume' },
  sorghum: { uiId: 'sorghum', name: 'Grain Sorghum', uiFamily: 'cereal' },
  rice: { uiId: 'rice', name: 'Paddy Rice', uiFamily: 'cereal' },
  maize: { uiId: 'maize', name: 'Maize', uiFamily: 'cereal' },
  mung_bean: { uiId: 'mung_bean', name: 'Mung Bean', uiFamily: 'legume' },
};

function mapFamilyToUi(rawFam, engineId) {
  if (UI_META[engineId]?.uiFamily) return UI_META[engineId].uiFamily;
  if (FAMILIES.includes(rawFam)) return rawFam;
  if (rawFam === 'vegetable_root') return 'root';
  if (rawFam === 'forage_broadleaf') return 'forage';
  return 'forage';
}

export const ENGINE_TO_UI_ID = Object.fromEntries(
  Object.entries(UI_META).map(([engineId, m]) => [engineId, m.uiId]),
);
export const UI_TO_ENGINE_ID = Object.fromEntries(
  Object.entries(UI_META).map(([engineId, m]) => [m.uiId, engineId]),
);

const bundleByEngineId = Object.fromEntries((bundle.crops || []).map(c => [c.id, c]));

const PRIMARY_UI_IDS = [
  'durum', 'soft', 'barley', 'oats', 'triticale',
  'chickpea', 'lentil', 'faba', 'vetch',
  'rapeseed', 'safflower', 'sunflower',
  'alfalfa', 'sulla', 'onion', 'fallow',
  'corn', 'soybean', 'sorghum', 'rice', 'mung_bean',
];

function buildCropEntry(engineId) {
  const c = bundleByEngineId[engineId] || {};
  const meta = UI_META[engineId] || { uiId: engineId, name: c.crop || engineId };
  const family = mapFamilyToUi(c.family || 'cereal', engineId);
  return {
    id: meta.uiId,
    engineId,
    name: meta.name,
    scientificName: c.scientific_name || '',
    family,
    waterNeed: Number(c.water_need ?? (family === 'fallow' ? 0.05 : 0.45)),
    soilEffect: Number(c.soil_effect ?? 0),
    nitrogenFixing: Number(c.nitrogen_fixing ?? (family === 'legume' || engineId === 'alfalfa' || engineId === 'sulla' ? 1 : 0)),
    nImpact: Number(c.n_impact_kg_ha ?? (family === 'legume' ? 25 : -25)),
    residueCarbon: Number(c.residue_carbon ?? 0.45),
    droughtTolerance: Number(c.drought_tolerance ?? 0.65),
    profit: Number(c.profit ?? 0.55),
    priceDzd: Number(c.oaic_ccls_price_dzd_q ?? 6000),
    yieldQ: Number(c.baseline_yield_q_ha ?? 20),
    grossIncomeDzd: Number(c.gross_income_dzd_ha ?? 120000),
    riskLevel: Number(c.risk_level ?? 0.3),
    depletion: Number(c.soil_depletion_index ?? (family === 'legume' ? 1 : 3)),
    healthDelta: Number(c.soil_health_delta ?? (family === 'legume' ? 14 : -8)),
    npkBase: Number(c.base_npk_kg_ha ?? (family === 'legume' ? 105 : 190)),
    fertName: c.fertilizer_name || (family === 'legume' ? 'DAP + MOP' : 'NPK 10:26:26'),
    rainOpt: [Number(c.optimal_rain_min ?? 300), Number(c.optimal_rain_max ?? 650)],
    phOpt: [Number(c.optimal_ph_min ?? 6.2), Number(c.optimal_ph_max ?? 8.2)],
    frostTolerant: Number(c.frost_tolerant ?? 1),
    heatTolerant: Number(c.heat_tolerant ?? 1),
    riskNote: c.risk_note || 'Follow certified regional seed and sowing window recommendations.',
    sources: c.sources || {},
  };
}

export const BASE_CROPS = PRIMARY_UI_IDS.map(uiId => {
  const engineId = UI_TO_ENGINE_ID[uiId] || uiId;
  return buildCropEntry(engineId);
});

// Attach non-enumerable key lookups on BASE_CROPS so BASE_CROPS[id] and BASE_CROPS.map() both work
for (const cropObj of BASE_CROPS) {
  Object.defineProperty(BASE_CROPS, cropObj.id, { value: cropObj, enumerable: false, configurable: true });
  if (cropObj.engineId && cropObj.engineId !== cropObj.id) {
    Object.defineProperty(BASE_CROPS, cropObj.engineId, { value: cropObj, enumerable: false, configurable: true });
  }
}

export const DEFAULT_ALLOWED = ['durum', 'soft', 'barley', 'chickpea', 'lentil', 'vetch', 'rapeseed', 'safflower'];
export const DEFAULT_ROTATION = ['durum', 'lentil', 'barley'];

export function getRegionalCrops(regionObj, customCrops = []) {
  const regMap = regionObj?.regionalCrops || bundle.regions.regionA.regionalCrops || {};
  const sourced = [];
  for (const base of BASE_CROPS) {
    const rSpec = regMap[base.engineId] || regMap[base.id];
    if (!rSpec && Object.keys(regMap).length > 0 && !['alfalfa', 'sulla', 'onion'].includes(base.id)) continue;
    sourced.push({
      ...base,
      yieldQ: Number(rSpec?.yield_potential ?? base.yieldQ),
      priceDzd: Number(rSpec?.oaic_ccls_price_dzd_q ?? base.priceDzd),
      grossIncomeDzd: Number(rSpec?.gross_income_dzd_ha ?? base.grossIncomeDzd),
      riskNote: rSpec?.risk_note || base.riskNote,
      yieldSource: rSpec?.source || base.sources?.yield || '',
      currency: rSpec?.currency || regionObj?.currency || 'DZD',
    });
  }
  return [...sourced, ...customCrops];
}

export const CROP_PRESETS = {
  'Field pea': ['legume', 350, 650, 6.0, 8.0, 9500, 18, true, false],
  'Cowpea': ['legume', 350, 850, 5.5, 8.2, 11000, 14, false, true],
  'Coriander': ['forage', 300, 550, 6.5, 8.2, 25000, 8, false, true],
  'Fenugreek': ['legume', 300, 600, 6.2, 8.3, 22000, 11, true, true],
  'Pearl Millet (Bajra)': ['cereal', 250, 650, 5.5, 8.5, 3800, 24, false, true],
  'Pigeon Pea (Arhar)': ['legume', 450, 950, 5.8, 8.2, 9200, 13, false, true],
  'Winter Rye': ['cereal', 300, 750, 5.2, 8.0, 4200, 28, true, false],
};
