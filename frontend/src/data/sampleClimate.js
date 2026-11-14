// SAMPLE climate data — placeholder until the NASA POWER API is connected (see src/api/client.js).
import { REGIONS } from './regions';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ------------------------------------------------------------------ *
 * SAMPLE climate data — same shape the API must return:
 * {
 *   source: string, sample: boolean,
 *   annual:  [{ year: 1995, rain: 412 }, ...]          // mm per year
 *   monthly: [12 numbers]                              // mean mm per month
 *   indicators: { hotDays, frostDays, extremeRainDays, longestDrySpell }
 * }
 * ------------------------------------------------------------------ */
export const SAMPLE_CLIMATE = (() => {
  // Semi-arid Mediterranean monthly profile (share of annual rain)
  const shape = [68, 59, 55, 52, 34, 13, 4, 9, 25, 31, 56, 57];
  const shapeSum = shape.reduce((a, b) => a + b, 0);
  // trend = mm/decade (from the team's NASA POWER analysis), sd = year-to-year noise in mm
  const params = {
    regionA: { trend: -44.1, sd: 50, hot: 48, frost: 32, extreme: 5, dry: 58, seed: 7 },
    regionB: { trend: -46.4, sd: 150, hot: 41, frost: 24, extreme: 7, dry: 52, seed: 13 },
    regionC: { trend: -16.8, sd: 90, hot: 62, frost: 5, extreme: 6, dry: 65, seed: 21 },
  };
  // Small deterministic PRNG so the sample is stable between reloads
  const rng = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const years = Array.from({ length: 30 }, (_, i) => 1995 + i), xm = 2009.5;
  const out = {};
  for (const [id, p] of Object.entries(params)) {
    const mean = REGIONS[id].rain, rand = rng(p.seed);
    // Noise with zero mean and zero slope, scaled to sd, so the trend is exactly p.trend
    let noise = years.map(() => rand() + rand() + rand() - 1.5);
    const nm = noise.reduce((a, b) => a + b) / 30;
    const ns = years.reduce((s, y, i) => s + (y - xm) * (noise[i] - nm), 0) / years.reduce((s, y) => s + (y - xm) ** 2, 0);
    noise = noise.map((n, i) => n - nm - ns * (years[i] - xm));
    const nsd = Math.sqrt(noise.reduce((s, n) => s + n * n, 0) / 30);
    const annual = years.map((y, i) => ({ year: y, rain: Math.round((mean + p.trend / 10 * (y - xm) + noise[i] / nsd * p.sd) * 10) / 10 }));
    out[id] = {
      source: 'Sample data (placeholder until NASA POWER API is connected)',
      sample: true,
      annual,
      monthly: shape.map(v => Math.round(v / shapeSum * mean)),
      indicators: { hotDays: p.hot, frostDays: p.frost, extremeRainDays: p.extreme, longestDrySpell: p.dry },
    };
  }
  return out;
})();
