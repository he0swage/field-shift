// SAMPLE climate data — placeholder until the NASA POWER API is connected (see src/api/client.js).
// Same shape the API must return:
// {
//   source, sample,
//   annual:  [{ year: 1995, rain: 412 }, ...]   // mm per year, 1995–2024
//   monthly: [12 numbers]                       // mean mm per month, Jan..Dec
//   indicators: { hotDays, frostDays, extremeRainDays, longestDrySpell }   // days per year
// }
// Sétif's trend (−44.1 mm/decade) comes from the team's analysis; Kansas and Punjab values are placeholders.
import { REGIONS } from './regions';

const PARAMS = {
  // trend = mm/decade, sd = year-to-year noise (mm), shape = relative monthly rainfall Jan..Dec
  kansas: { trend: 5.2, sd: 130, hot: 28, frost: 105, extreme: 11, dry: 32, seed: 11,
    shape: [18, 24, 55, 70, 115, 110, 85, 82, 70, 48, 32, 22] },
  setif: { trend: -44.1, sd: 50, hot: 48, frost: 32, extreme: 5, dry: 58, seed: 7,
    shape: [68, 59, 55, 52, 34, 13, 4, 9, 25, 31, 56, 57] },
  punjab: { trend: -12.4, sd: 140, hot: 95, frost: 4, extreme: 12, dry: 110, seed: 23,
    shape: [38, 38, 30, 14, 20, 75, 200, 190, 95, 12, 5, 14] },
};

// Small deterministic PRNG so the sample is stable between reloads
const rng = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export const SAMPLE_CLIMATE = (() => {
  const years = Array.from({ length: 30 }, (_, i) => 1995 + i), xm = 2009.5;
  const out = {};
  for (const [id, p] of Object.entries(PARAMS)) {
    const mean = REGIONS[id].rain, rand = rng(p.seed);
    // Zero-mean, zero-slope noise scaled to sd, so the trend is exactly p.trend
    let noise = years.map(() => rand() + rand() + rand() - 1.5);
    const nm = noise.reduce((a, b) => a + b) / 30;
    const ns = years.reduce((s, y, i) => s + (y - xm) * (noise[i] - nm), 0) / years.reduce((s, y) => s + (y - xm) ** 2, 0);
    noise = noise.map((n, i) => n - nm - ns * (years[i] - xm));
    const nsd = Math.sqrt(noise.reduce((s, n) => s + n * n, 0) / 30);
    const sum = p.shape.reduce((a, b) => a + b, 0);
    out[id] = {
      source: 'Sample data (placeholder until the NASA POWER API is connected)',
      sample: true,
      annual: years.map((y, i) => ({
        year: y,
        rain: Math.round((mean + (p.trend / 10) * (y - xm) + (noise[i] / nsd) * p.sd) * 10) / 10,
      })),
      monthly: p.shape.map(v => Math.round((v / sum) * mean)),
      indicators: { hotDays: p.hot, frostDays: p.frost, extremeRainDays: p.extreme, longestDrySpell: p.dry },
    };
  }
  return out;
})();
