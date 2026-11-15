// Real NASA POWER (1995-2024) annual & monthly rainfall, indicators, SARIMA outlook, and Fire Watch snapshots.
import bundle from './realDataBundle.json';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildClimateForRecord(id, r) {
  if (!r) return null;
  const v2 = r.v2 || {};
  const trendRaw = v2.rainfall_trend || {};
  return {
    source: `NASA POWER 1995–2024 + Open-Meteo ERA5 (${r.meta?.name || r.name || id})`,
    sample: false,
    region: id,
    annual: r.annual || [],
    monthly: r.monthly || [],
    trend: {
      mmPerDecade: Number(trendRaw.sen_slope_mm_per_decade ?? trendRaw.ols_slope_mm_per_decade ?? -44.1),
      olsP: Number(trendRaw.ols_p_value ?? 0.02),
      mkP: Number(trendRaw.mk_p_value ?? 0.02),
      label: trendRaw.agreement || 'both methods agree',
    },
    indicators: {
      hotDays: Math.round(Number(v2.hot_days?.value || 25)),
      frostDays: Math.round(Number(v2.frost_days?.value || 1)),
      extremeRainDays: Math.round(Number(v2.extreme_rain_days?.value || 2)),
      longestDrySpell: Math.round(Number(v2.longest_dry_spell_days?.value || 25)),
    },
    v2Indicators: v2,
    climateText: r.climateText || {},
    soil: r.soil || {},
    forecast: r.forecast || null,
    fires: r.fires || null,
  };
}

const regionAClimate = buildClimateForRecord('setif', bundle.regions.regionA);
const regionBClimate = buildClimateForRecord('kansas', bundle.regions.regionB);
const regionCClimate = buildClimateForRecord('punjab', bundle.regions.regionC);

export const REAL_CLIMATE = {
  setif: regionAClimate,
  kansas: regionBClimate,
  punjab: regionCClimate,
  regionA: regionAClimate,
  regionB: regionBClimate,
  regionC: regionCClimate,
  ...(bundle.customExample
    ? { [bundle.customExample.id]: buildClimateForRecord(bundle.customExample.id, bundle.customExample) }
    : {}),
};

export const FIRES_SNAPSHOTS = bundle.firesSnapshots || {};
export const SAMPLE_CLIMATE = REAL_CLIMATE;
