// Agronomic rules used by the UI: crop-selection validation, custom-crop fit, rain trend, what-if scenario.
// Messages are returned as i18n keys + variables so they can be shown in EN / FR / AR.
import { Stats } from '../api/stats';

/** Problems with the allowed-crop selection (empty array = valid). */
export function cropProblems(allowed, cropById) {
  const fams = allowed.map(id => cropById(id)?.family);
  const p = [];
  if (allowed.length < 3) p.push({ key: 'err.fewCrops', vars: { n: allowed.length } });
  if (!fams.includes('cereal')) p.push({ key: 'err.noCereal' });
  if (!fams.includes('legume')) p.push({ key: 'err.noLegume' });
  return p;
}

/** Custom crop vs region climate & soil. level: ok | warn | bad | invalid */
export function cropFit(region, f) {
  const rmin = +f.rMin, rmax = +f.rMax, pmin = +f.pMin, pmax = +f.pMax;
  const errors = {};
  if (rmin > rmax) errors.rain = 'err.rainOrder';
  if (pmin > pmax) errors.ph = 'err.phOrder';
  if (Object.keys(errors).length) return { level: 'invalid', issues: [], errors };

  const issues = [];
  let level = 'ok';
  if (region.rain < rmin * 0.85 || region.rain > rmax * 1.3) {
    level = 'bad'; issues.push({ key: 'fit.rainFar', vars: { rain: region.rain, min: rmin, max: rmax } });
  } else if (region.rain < rmin) {
    level = 'warn'; issues.push({ key: 'fit.rainBorder', vars: { rain: region.rain, min: rmin } });
  }
  if (pmax < region.ph[0] || pmin > region.ph[1]) {
    level = 'bad'; issues.push({ key: 'fit.ph', vars: { a: region.ph[0], b: region.ph[1], min: pmin, max: pmax } });
  }
  if (!f.frost && region.frost > 20) {
    if (level === 'ok') level = 'warn';
    issues.push({ key: 'fit.frost', vars: { frost: region.frost } });
  }
  return { level, issues, errors };
}

/** OLS + Mann–Kendall trend of a yearly rainfall series. sig: clear | weak | none */
export function rainTrend(annual) {
  const years = annual.map(d => d.year), rains = annual.map(d => d.rain);
  const ols = Stats.ols(years, rains), mk = Stats.mannKendall(rains);
  const mean = Math.round(rains.reduce((a, b) => a + b) / rains.length);
  const n = annual.length;
  const variance = rains.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (n - 1 || 1);
  const stdDev = Math.round(Math.sqrt(variance));

  // Identify acute drought shock years (< 82% of 30-yr mean or >0.85 stdDev below mean)
  const shockThreshold = Math.round(Math.min(mean * 0.82, mean - 0.85 * stdDev));
  const severeThreshold = Math.round(mean * 0.72);
  const shockYears = annual
    .filter(d => d.rain <= shockThreshold)
    .map(d => ({
      year: d.year,
      rain: Math.round(d.rain),
      deficitPct: Math.round(((d.rain - mean) / mean) * 100),
      severity: d.rain <= severeThreshold ? 'severe' : 'moderate',
    }))
    .sort((a, b) => a.rain - b.rain);

  const shockCount = shockYears.length;
  const returnPeriodYrs = shockCount > 0 ? Math.round((n / shockCount) * 10) / 10 : n;
  const recent10 = annual.slice(-10);
  const recentShocks = recent10.filter(d => d.rain <= shockThreshold).length;

  return {
    ...ols,
    decade: ols.slope * 10,
    pOls: ols.p,
    pMk: mk.p,
    mean,
    stdDev,
    shockThreshold,
    severeThreshold,
    shockYears,
    shockCount,
    returnPeriodYrs,
    recentShocks,
    sig: ols.p < 0.05 && mk.p < 0.05 ? 'clear' : ols.p < 0.1 || mk.p < 0.1 ? 'weak' : 'none',
  };
}

/** Simple, transparent what-if model (documented in the methodology section). */
export function applyScenario(indicators, meanRain, { rain, temp }) {
  const r = rain / 100;
  return {
    rain: Math.round(meanRain * (1 + r)),
    hot: Math.max(0, Math.round(indicators.hotDays + 9 * temp)),
    frost: Math.max(0, Math.round(indicators.frostDays - 1.5 * temp)),
    extreme: Math.max(0, Math.round(indicators.extremeRainDays * (1 + r * 0.5) + 0.5 * temp)),
    dry: Math.max(0, Math.round(indicators.longestDrySpell * (1 - r * 0.6) + 3 * temp)),
    et: Math.round(4 * temp), // ≈ +4 % crop water demand (evapotranspiration) per °C
  };
}

export const scaleMonthly = (monthly, rain) => monthly.map(v => Math.round(v * (1 + rain / 100)));
