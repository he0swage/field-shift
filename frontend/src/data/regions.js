// Featured agricultural regions + full NASA POWER, ERA5, SoilGrids, MODIS & FIRMS domain bundle.
import bundle from './realDataBundle.json';

const ENGINE_TO_UI = {
  wheat: 'durum',
  soft_wheat: 'soft',
  canola: 'rapeseed',
};

const toUiId = id => ENGINE_TO_UI[id] || id;

export const UI_REGION_TO_ENGINE = {
  setif: 'regionA',
  kansas: 'regionB',
  punjab: 'regionC',
  regionA: 'regionA',
  regionB: 'regionB',
  regionC: 'regionC',
};

export const ENGINE_REGION_TO_UI = {
  regionA: 'setif',
  regionB: 'kansas',
  regionC: 'punjab',
  setif: 'setif',
  kansas: 'kansas',
  punjab: 'punjab',
};

export function toEngineRegionId(id) {
  return UI_REGION_TO_ENGINE[id] || 'regionA';
}

const SUGGESTED = {
  regionA: ['field_pea', 'potato', 'sulla', 'lupin', 'onion', 'coriander'],
  regionB: ['field_pea', 'hairy_vetch', 'alfalfa', 'cotton', 'proso_millet', 'flax'],
  regionC: ['pearl_millet', 'groundnut', 'pigeon_pea', 'berseem', 'potato', 'cotton', 'sesame', 'barley'],
};

const SHORT_NAMES = {
  regionA: 'Sétif, Algeria',
  regionB: 'Central Kansas, USA',
  regionC: 'Punjab, India',
  'custom_35.4_1.3': 'Tiaret (35.4°N, 1.3°E)',
};

const LABELS = {
  regionA: 'Region A · Deep',
  regionB: 'Region B · Light',
  regionC: 'Region C · Light',
  'custom_35.4_1.3': 'Custom Point · Data Only',
};

const PH_RANGES = {
  regionA: [7.3, 8.4],
  regionB: [6.0, 7.8],
  regionC: [7.5, 8.6],
  'custom_35.4_1.3': [7.2, 8.3],
};

export function buildRegionFromRecord(regId, rec, uiOverrides = {}) {
  const meta = rec.meta || {
    region_id: regId,
    name: rec.name || rec.v2?.label || regId,
    country: rec.country || 'Custom',
    lat: rec.lat ?? rec.v2?.lat ?? 35.4,
    lon: rec.lon ?? rec.v2?.lon ?? 1.3,
    role: rec.role || 'custom',
    farming_system: rec.farming_system || 'rainfed',
    default_crops_list: rec.default_crops || ['wheat', 'barley', 'lentil', 'chickpea'],
    currency: 'DZD',
    currency_symbol: 'DA',
    agro_zone: 'Custom coordinates (NASA POWER ~50 km grid cell)',
  };
  const v1 = rec.v1 || {};
  const v2 = rec.v2 || {};
  const soil = rec.soil || {};
  const rain10 = Number(v2.rainfall_mm?.value ?? v1.rainfall_mm ?? 485);
  const rain30 = Number(v2.rainfall_30yr_mean_mm?.value ?? rain10);
  const rain5 = Number(v1.rainfall_mm ?? rain10);
  const rainRef = Number(v1.rainfall_reference_mm ?? rain30);
  const ws10Pct = Math.round(Number(v2.water_stress?.value ?? 0.2) * 1000) / 10;
  const ws5Pct = Math.round(Number(v2.water_stress_5yr?.value ?? ws10Pct / 100) * 1000) / 10;

  const defaultCropsEngine = meta.default_crops_list || ['wheat', 'barley', 'lentil', 'chickpea'];
  const defaultCropsUi = defaultCropsEngine.map(toUiId);
  const regionalCrops = rec.regionalCrops || bundle.regions.regionA.regionalCrops || {};
  const sourcedCropsUi = Object.keys(regionalCrops).map(toUiId);

  const defaultRotation = [
    defaultCropsUi[0] || 'durum',
    defaultCropsUi[2] || defaultCropsUi[1] || 'lentil',
    defaultCropsUi[1] || defaultCropsUi[3] || 'barley',
  ];

  return {
    id: uiOverrides.uiId || regId,
    engineId: regId,
    code: rec.code || regId,
    label: LABELS[regId] || `Custom · ${meta.country}`,
    short: SHORT_NAMES[regId] || meta.name,
    name: uiOverrides.name || `${meta.name}`,
    areaName: meta.name,
    country: uiOverrides.country || meta.country,
    countryCode: uiOverrides.countryCode || 'dz',
    role: meta.role,
    lessValidated: meta.role === 'light' || meta.role === 'custom',
    farmingSystem: meta.farming_system,
    isIrrigated: meta.farming_system === 'irrigated',
    agroZone: meta.agro_zone || '',
    currency: meta.currency || 'DZD',
    currencySymbol: meta.currency_symbol || 'DA',
    defaultCrops: defaultCropsUi,
    sourcedCrops: sourcedCropsUi,
    suggestedCrops: (SUGGESTED[regId] || []).map(toUiId).filter(id => sourcedCropsUi.includes(id)),
    defaultRotation,
    regionalCrops,
    rules: rec.rules || bundle.rules,
    thresholds: rec.thresholds || {},
    warning: rec.warning || null,
    lat: uiOverrides.lat ?? Number(meta.lat),
    lon: uiOverrides.lon ?? Number(meta.lon),
    rain: uiOverrides.rain ?? Math.round(rain10),
    rain10yr: rain10,
    rain30yr: rain30,
    rain5yr: rain5,
    rainRef,
    era5Rain: Number(v2.rainfall_mm?.crosscheck_value ?? rain10),
    era5Rain30yr: Number(v2.rainfall_30yr_mean_mm?.crosscheck_value ?? rain30),
    ph: uiOverrides.ph || PH_RANGES[regId] || [6.0, 8.2],
    phScalar: Number(soil.ph ?? 7.5),
    soilTexture: soil.texture_class || 'Loam',
    soilNote: soil.note || '',
    water: Math.round(ws10Pct),
    water10Pct: ws10Pct,
    water5yrPct: ws5Pct,
    soc: Number(soil.soc_g_per_kg ?? 12.0),
    socClass: soil.soc_class || 'moderate',
    socThreshold: Number(v1.soc_threshold_g_per_kg ?? 15.0),
    frost: uiOverrides.frost ?? Math.round(Number(v2.frost_days?.value ?? 1.0)),
    frostDays: Number(v2.frost_days?.value ?? 1.0),
    frostWindow: v2.frost_days?.window || 'Spring',
    frostBaseline: Number(v1.climate_baseline?.frost_days ?? v2.frost_days?.value ?? 1.0),
    hotDays: Number(v2.hot_days?.value ?? 20.0),
    hotThresholdC: Number(v2.hot_days?.threshold_c ?? 35.0),
    hotWindow: v2.hot_days?.window || 'Summer',
    hotBaseline: Number(v1.climate_baseline?.hot_days ?? v2.hot_days?.value ?? 20.0),
    extremeRainDays: Number(v2.extreme_rain_days?.value ?? 1.0),
    extremeRainThresholdMm: Number(v2.extreme_rain_days?.threshold_mm ?? 20.0),
    longestDrySpell: Number(v2.longest_dry_spell_days?.value ?? 25.0),
    ndvi: Number(v2.ndvi?.yield_baseline ?? 0.5),
    ndviRaw: Number(v2.ndvi?.mean_spring_peak_ndvi ?? 0.45),
    suggestedPriorities: {
      water: v2.suggested_priorities?.save_water ?? 38,
      soil: v2.suggested_priorities?.protect_soil ?? 32,
      yield: v2.suggested_priorities?.yield_ ?? 30,
    },
    confidence: {
      rain: v2.rainfall_mm?.confidence || 'high',
      trend: v2.rainfall_trend?.confidence || 'medium',
      hot: v2.hot_days?.confidence || 'high',
      frost: v2.frost_days?.confidence || 'high',
      soil: soil.confidence || 'high',
      ndvi: v2.ndvi?.confidence || 'low',
    },
    climateText: rec.climateText || {},
    trendSummary: v2.rainfall_trend || {},
    fires: rec.fires || null,
    gaps: bundle.gaps,
    est: uiOverrides.est || [],
  };
}

const setifObj = buildRegionFromRecord('regionA', bundle.regions.regionA, {
  uiId: 'setif',
  name: 'Sétif High Plains',
  country: 'Algeria',
  countryCode: 'dz',
  lat: 36.15,
  lon: 5.38,
  rain: 485,
  ph: [7.3, 8.4],
  frost: 34,
  est: ['frost'],
});

const kansasObj = buildRegionFromRecord('regionB', bundle.regions.regionB, {
  uiId: 'kansas',
  name: 'Kansas Wheat Plains',
  country: 'USA',
  countryCode: 'us',
  lat: 38.5,
  lon: -98.0,
  rain: 720,
  ph: [6.0, 7.8],
  frost: 60,
  est: ['rain', 'ph', 'frost'],
});

const punjabObj = buildRegionFromRecord('regionC', bundle.regions.regionC, {
  uiId: 'punjab',
  name: 'Punjab Plains',
  country: 'India',
  countryCode: 'in',
  lat: 30.9,
  lon: 75.85,
  rain: 650,
  ph: [7.5, 8.6],
  frost: 8,
  est: ['rain', 'ph', 'frost'],
});

export const REGIONS = {
  kansas: kansasObj,
  setif: setifObj,
  punjab: punjabObj,
};

// Non-enumerable engine aliases so Object.keys(REGIONS) stays ['kansas', 'setif', 'punjab'] for Globe/RegionView
Object.defineProperties(REGIONS, {
  regionA: { value: setifObj, enumerable: false },
  regionB: { value: kansasObj, enumerable: false },
  regionC: { value: punjabObj, enumerable: false },
});

export const REGION_IDS = ['kansas', 'setif', 'punjab'];
export const DEFAULT_REGION = 'setif';

export const PREBUILT_CUSTOM_REGION = bundle.customExample
  ? buildRegionFromRecord(bundle.customExample.id, bundle.customExample)
  : null;

export const REGIONS_CSV_ROWS = bundle.regionsCsv || [];
export const SCIENTIFIC_GAPS = bundle.gaps;
export const DATA_PROVENANCE = bundle.generatedFrom;

export const fmtCoord = (lat, lon) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
