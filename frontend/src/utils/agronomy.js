// Agronomic rules used by the UI (crop validation, custom-crop fit, trends, scenario).
import { Stats } from '../api/stats';

export const socClass = v => (v < 12 ? 'Low (< 12 g/kg)' : v <= 16 ? 'Moderate (12–16 g/kg)' : 'High (> 16 g/kg)');

/** Problems with the allowed-crop selection (empty array = valid). */
export function cropProblems(allowed, cropById) {
  const fams = allowed.map(id => cropById(id)?.family);
  const p = [];
  if (allowed.length < 3) p.push(`select at least 3 crops (you have ${allowed.length})`);
  if (!fams.includes('cereal')) p.push('add at least one cereal');
  if (!fams.includes('legume')) p.push('add at least one legume');
  return p;
}

/** Custom crop vs region climate & soil. level: ok | warn | bad | invalid */
export function cropFit(region, f) {
  const rmin = +f.rMin, rmax = +f.rMax, pmin = +f.pMin, pmax = +f.pMax;
  const errors = {};
  if (rmin > rmax) errors.rain = 'Minimum rainfall must be lower than maximum.';
  if (pmin > pmax) errors.ph = 'Minimum pH must be lower than maximum.';
  if (Object.keys(errors).length) return { level: 'invalid', issues: [], errors };

  const issues = [];
  let level = 'ok';
  if (region.rain < rmin * 0.85 || region.rain > rmax * 1.3) {
    level = 'bad'; issues.push(`Rainfall here is ${region.rain} mm, far outside ${rmin}–${rmax} mm.`);
  } else if (region.rain < rmin) {
    level = 'warn'; issues.push(`Borderline rainfall (${region.rain} mm vs ${rmin} mm minimum) — sow early on deep, moisture-holding soil.`);
  }
  if (pmax < region.ph[0] || pmin > region.ph[1]) {
    level = 'bad'; issues.push(`Soil pH here is ${region.ph[0]}–${region.ph[1]}, outside the crop's ${pmin}–${pmax}.`);
  }
  if (!f.frost && region.frost > 20) {
    if (level === 'ok') level = 'warn';
    issues.push(`Frost risk is ${region.frost}% and this crop is not frost-hardy.`);
  }
  return { level, issues, errors };
}

/** OLS + Mann–Kendall trend of a yearly rainfall series. */
export function rainTrend(annual) {
  const years = annual.map(d => d.year), rains = annual.map(d => d.rain);
  const ols = Stats.ols(years, rains), mk = Stats.mannKendall(rains);
  return {
    ...ols,
    decade: ols.slope * 10,
    pOls: ols.p,
    pMk: mk.p,
    mean: Math.round(rains.reduce((a, b) => a + b) / rains.length),
    sig: ols.p < 0.05 && mk.p < 0.05 ? 'clear' : ols.p < 0.1 || mk.p < 0.1 ? 'weak' : 'none',
  };
}
export const SIG_LABEL = { clear: 'clear trend (MK + OLS agree)', weak: 'weak trend', none: 'no clear trend' };
export const SIG_SHORT = { clear: 'clear trend', weak: 'weak trend', none: 'no clear trend' };

/** Simple, transparent what-if model shown on the climate step. */
export function applyScenario(indicators, meanRain, { rain, temp }) {
  const r = rain / 100;
  return {
    rain: Math.round(meanRain * (1 + r)),
    hot: Math.round(indicators.hotDays + 9 * temp),
    frost: Math.max(0, Math.round(indicators.frostDays - 1.5 * temp)),
    extreme: Math.max(0, Math.round(indicators.extremeRainDays * (1 + r * 0.5) + 0.5 * temp)),
    dry: Math.round(indicators.longestDrySpell * (1 - r * 0.6) + 3 * temp),
    waterDemand: 4 * temp, // +4 % evapotranspiration per °C
  };
}
