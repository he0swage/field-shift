// Field Shift — static reference data + SAMPLE climate data.
// The SAMPLE_CLIMATE block is placeholder data, used only until the team API
// is connected in js/api.js. Replace it or set FIELDSHIFT_CONFIG.apiBase.
'use strict';

/* `est` lists indicators that are placeholders (flagged "estimate" in the UI). */
const REGIONS = {
  regionA: { label: 'Region A', name: 'Sétif High Plateaux', lat: 36.15, lon: 5.38, rain: 485,
    ph: [7.3, 8.4], water: 30, soc: 11.2, frost: 34, erosion: 38, ndvi: 0.44,
    est: ['water', 'soc', 'frost', 'erosion'] },
  regionB: { label: 'Region B', name: 'Constantine El Khroub', lat: 36.16, lon: 6.68, rain: 516,
    ph: [7.2, 8.2], water: 26, soc: 13.6, frost: 25, erosion: 35, ndvi: 0.49,
    est: ['water', 'soc', 'frost', 'erosion'] },
  regionC: { label: 'Region C', name: 'Tiaret Western Plateau', lat: 35.34, lon: 1.38, rain: 408,
    ph: [7.2, 8.3], water: 33, soc: 12.38, frost: 28, erosion: 44, ndvi: 0.47,
    est: [] },
};

const BASE_CROPS = [
  { id: 'durum', name: 'Durum wheat', family: 'cereal' },
  { id: 'soft', name: 'Soft wheat', family: 'cereal' },
  { id: 'barley', name: 'Barley', family: 'cereal' },
  { id: 'oats', name: 'Forage oats', family: 'cereal' },
  { id: 'triticale', name: 'Triticale', family: 'cereal' },
  { id: 'chickpea', name: 'Chickpea', family: 'legume' },
  { id: 'lentil', name: 'Lentil', family: 'legume' },
  { id: 'faba', name: 'Faba bean', family: 'legume' },
  { id: 'vetch', name: 'Common vetch', family: 'legume' },
  { id: 'rapeseed', name: 'Rapeseed', family: 'oilseed' },
  { id: 'safflower', name: 'Safflower', family: 'oilseed' },
  { id: 'sunflower', name: 'Sunflower', family: 'oilseed' },
  { id: 'fallow', name: 'Worked fallow', family: 'fallow' },
];
const FAMILY_LABEL = { cereal: 'Cereals', legume: 'Legumes', oilseed: 'Oilseeds', fallow: 'Fallow', other: 'Other' };

const CROP_PRESETS = { // family, rainMin, rainMax, pHmin, pHmax, price, yield, frostHardy, heatTolerant
  'Field pea': ['legume', 350, 650, 6.0, 8.0, 9500, 18, true, false],
  'Coriander': ['other', 300, 500, 6.5, 8.0, 25000, 8, false, true],
  'Fenugreek': ['legume', 300, 550, 6.5, 8.2, 22000, 10, false, true],
  'Garlic': ['other', 400, 700, 6.0, 7.8, 15000, 80, true, false],
  'Sorghum': ['cereal', 400, 800, 5.5, 8.5, 4500, 30, false, true],
  'Maize (rainfed)': ['cereal', 500, 900, 5.8, 7.8, 4500, 35, false, false],
  'Rice': ['cereal', 1000, 2000, 5.0, 7.0, 6000, 50, false, true],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ------------------------------------------------------------------ *
 * SAMPLE climate data — same shape the API must return:
 * {
 *   source: string, sample: boolean,
 *   annual:  [{ year: 1995, rain: 412 }, ...]          // mm per year
 *   monthly: [12 numbers]                              // mean mm per month
 *   indicators: { hotDays, frostDays, extremeRainDays, longestDrySpell }
 * }
 * ------------------------------------------------------------------ */
const SAMPLE_CLIMATE = (() => {
  // Semi-arid Mediterranean monthly profile (share of annual rain)
  const shape = [68, 59, 55, 52, 34, 13, 4, 9, 25, 31, 56, 57];
  const shapeSum = shape.reduce((a, b) => a + b, 0);
  const params = {
    regionA: { trend: -9.5, hot: 48, frost: 32, extreme: 5, dry: 58, seed: 7 },
    regionB: { trend: -7.2, hot: 41, frost: 24, extreme: 7, dry: 52, seed: 13 },
    regionC: { trend: -16.8, hot: 62, frost: 5, extreme: 6, dry: 65, seed: 21 },
  };
  // Small deterministic PRNG so the sample is stable between reloads
  const rng = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = {};
  for (const [id, p] of Object.entries(params)) {
    const mean = REGIONS[id].rain, rand = rng(p.seed), annual = [];
    for (let y = 1995; y <= 2024; y++) {
      const trend = p.trend / 10 * (y - 2009.5);
      const noise = (rand() + rand() + rand() - 1.5) * 0.45 * mean * 0.5;
      annual.push({ year: y, rain: Math.max(120, Math.round(mean + trend + noise)) });
    }
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
