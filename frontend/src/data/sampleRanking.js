// SAMPLE ranking — fixed results until the ranking engine API is connected (see src/api/client.js).
/* ------------------------------------------------------------------ *
 * SAMPLE ranking — fixed results until the ranking engine API is live.
 * Same shape the API must return (see README.md).
 * ------------------------------------------------------------------ */
export const SAMPLE_RANKING = {
  source: 'Sample results (placeholder until the ranking engine is connected)',
  sample: true,
  monteCarlo: { runs: 100, rank1StaysFirstPct: 100 },
  usual: { waterNeed: 55, ndviStability: 61, fertilizer: 577, income: 98400, soilNEnd: 38 },
  rotations: [
    {
      rank: 1, crops: ['Common vetch', 'Barley', 'Rapeseed'],
      tags: ['restoresN', 'afterHeavyFeeder', 'lowWater', 'drought'],
      scores: { final: 78, ml: 89, knn: 92 },
      years: [
        { crop: 'Common vetch', soilN: 102, health: 82, fertilizer: 'DAP (starter)', kg: 77 },
        { crop: 'Barley', soilN: 82, health: 76, fertilizer: 'NPK 10:26:26', kg: 119, nCredit: 30 },
        { crop: 'Rapeseed', soilN: 60, health: 70, fertilizer: 'NPK 15:15:15 + Urea', kg: 162 },
      ],
      waterNeed: 41, ndviStability: 68, fertilizer: 358, fertilizerSaved: 219, income: 110600,
      risks: {
        'Common vetch': 'Key ITGC forage legume — best mixed with oats or triticale to avoid lodging.',
        'Barley': 'Lower OAIC price (3,400 DA/q); lodging risk if nitrogen is excessive.',
        'Rapeseed': 'ITGC strategic break crop (breaks plough pan); pod shattering in dry wind.',
      },
    },
    {
      rank: 2, crops: ['Chickpea', 'Barley', 'Rapeseed'],
      tags: ['restoresN', 'afterHeavyFeeder', 'lowWater', 'drought'],
      scores: { final: 77, ml: 89, knn: 92 },
      years: [
        { crop: 'Chickpea', soilN: 98, health: 81, fertilizer: 'DAP + MOP', kg: 94 },
        { crop: 'Barley', soilN: 78, health: 75, fertilizer: 'NPK 10:26:26', kg: 119, nCredit: 30 },
        { crop: 'Rapeseed', soilN: 56, health: 69, fertilizer: 'NPK 15:15:15 + Urea', kg: 162 },
      ],
      waterNeed: 40, ndviStability: 68, fertilizer: 375, fertilizerSaved: 202, income: 130700,
      risks: {
        'Chickpea': 'Ascochyta blight risk in wet springs; frost-sensitive at flowering.',
        'Barley': 'Lower OAIC price (3,400 DA/q); lodging risk if nitrogen is excessive.',
        'Rapeseed': 'ITGC strategic break crop (breaks plough pan); pod shattering in dry wind.',
      },
    },
    {
      rank: 3, crops: ['Chickpea', 'Barley', 'Safflower'],
      tags: ['restoresN', 'lowWater', 'drought'],
      scores: { final: 77, ml: 84, knn: 92 },
      years: [
        { crop: 'Chickpea', soilN: 98, health: 81, fertilizer: 'DAP + MOP', kg: 94 },
        { crop: 'Barley', soilN: 78, health: 75, fertilizer: 'NPK 10:26:26', kg: 119, nCredit: 30 },
        { crop: 'Safflower', soilN: 60, health: 70, fertilizer: 'NPK 15:15:15', kg: 128 },
      ],
      waterNeed: 37, ndviStability: 66, fertilizer: 341, fertilizerSaved: 236, income: 117700,
      risks: {
        'Chickpea': 'Ascochyta blight risk in wet springs; frost-sensitive at flowering.',
        'Barley': 'Lower OAIC price (3,400 DA/q); lodging risk if nitrogen is excessive.',
        'Safflower': 'Deep-rooted drought oilseed (< 400 mm zones); spiny leaves complicate harvest.',
      },
    },
    {
      rank: 4, crops: ['Chickpea', 'Safflower', 'Soft wheat'],
      tags: ['restoresN', 'afterHeavyFeeder', 'lowWater', 'drought', 'highProfit', 'highN'],
      scores: { final: 77, ml: 89, knn: 92 },
      years: [
        { crop: 'Chickpea', soilN: 98, health: 81, fertilizer: 'DAP + MOP', kg: 94 },
        { crop: 'Safflower', soilN: 80, health: 76, fertilizer: 'NPK 15:15:15', kg: 105, nCredit: 30 },
        { crop: 'Soft wheat', soilN: 52, health: 67, fertilizer: 'NPK 10:26:26 + Urea', kg: 179 },
      ],
      waterNeed: 41, ndviStability: 67, fertilizer: 378, fertilizerSaved: 199, income: 135800,
      risks: {
        'Chickpea': 'Ascochyta blight risk in wet springs; frost-sensitive at flowering.',
        'Safflower': 'Deep-rooted drought oilseed (< 400 mm zones); spiny leaves complicate harvest.',
        'Soft wheat': 'OAIC official price 5,000 DA/q; susceptible to yellow rust and lodging in humid springs.',
      },
    },
  ],
  avoid: [
    { crops: ['Durum wheat', 'Durum wheat', 'Durum wheat'], score: 28,
      reasons: ['Strict cereal monoculture', 'Depletes ~90 kg N/ha over 3 years', 'Multiplies Fusarium and root rot'] },
    { crops: ['Durum wheat', 'Barley', 'Forage oats'], score: 39,
      reasons: ['3 cereals in a row (same Poaceae family)', 'No legume nitrogen recharge', 'High NPK bill'] },
    { crops: ['Faba bean', 'Rapeseed', 'Faba bean'], score: 44,
      reasons: ['High water and frost exposure in a dry scenario', 'Broomrape (Orobanche) build-up'] },
  ],
};

export const TAGS = {
  restoresN: { icon: '🌱', label: 'Restores nitrogen', tone: 'good' },
  afterHeavyFeeder: { icon: '✅', label: 'Ideal after heavy feeder', tone: 'good' },
  lowWater: { icon: '💧', label: 'Low water', tone: 'info' },
  drought: { icon: '☀️', label: 'Drought tolerant', tone: 'info' },
  highProfit: { icon: '💰', label: 'High profit (OAIC/CCLS)', tone: 'gold' },
  highN: { icon: '⚠️', label: 'High N consumer', tone: 'warn' },
};
