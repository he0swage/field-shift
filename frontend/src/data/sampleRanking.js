/* ------------------------------------------------------------------ *
 * SAMPLE ranking — design placeholders until the ranking engine
 * (Rules + KNN + Random Forest + 3-year soil-N simulation) is connected.
 * Rank 1 uses the exact example values of the design brief.
 * Same shape the API must return (see README.md).
 * ------------------------------------------------------------------ */
export const SAMPLE_RANKING = {
  source: 'Sample results (placeholder until the ranking engine is connected)',
  sample: true,
  monteCarlo: { runs: 100, rank1StaysFirstPct: 87 },
  usual: { waterNeed: 55, ndviStability: 61, fertilizer: 577, income: 98400, soilNEnd: 38 },
  rotations: [
    {
      rank: 1, crops: ['Chickpea', 'Barley', 'Rapeseed'],
      tags: ['restoresN', 'afterHeavyFeeder', 'lowWater', 'drought'],
      scores: { final: 78, ml: 89, knn: 92 },
      years: [
        { crop: 'Chickpea', family: 'legume', soilN: 98, health: 81, fertilizer: 'DAP + MOP', kg: 94,
          risks: ['Ascochyta blight risk in wet springs.', 'Frost-sensitive at flowering.'] },
        { crop: 'Barley', family: 'cereal', soilN: 78, health: 75, fertilizer: 'NPK 10:26:26', kg: 119, nCredit: 30,
          risks: ['Lower OAIC price (3,400 DA/q).', 'Lodging risk if nitrogen application is excessive.'] },
        { crop: 'Rapeseed', family: 'oilseed', soilN: 56, health: 69, fertilizer: 'NPK 15:15:15 + Urea', kg: 162,
          risks: ['ITGC strategic break crop.', 'Helps break the plow pan.', 'Pod shattering risk in dry wind.'] },
      ],
      waterNeed: 40, ndviStability: 68, fertilizer: 375, fertilizerSaved: 202, income: 116900,
    },
    {
      rank: 2, crops: ['Common vetch', 'Barley', 'Rapeseed'],
      tags: ['restoresN', 'afterHeavyFeeder', 'lowWater', 'drought'],
      scores: { final: 77, ml: 89, knn: 92 },
      years: [
        { crop: 'Common vetch', family: 'legume', soilN: 102, health: 82, fertilizer: 'DAP (starter)', kg: 77,
          risks: ['Key ITGC forage legume — best mixed with oats or triticale to avoid lodging.'] },
        { crop: 'Barley', family: 'cereal', soilN: 82, health: 76, fertilizer: 'NPK 10:26:26', kg: 119, nCredit: 30,
          risks: ['Lower OAIC price (3,400 DA/q).', 'Lodging risk if nitrogen application is excessive.'] },
        { crop: 'Rapeseed', family: 'oilseed', soilN: 60, health: 70, fertilizer: 'NPK 15:15:15 + Urea', kg: 162,
          risks: ['ITGC strategic break crop.', 'Pod shattering risk in dry wind.'] },
      ],
      waterNeed: 41, ndviStability: 68, fertilizer: 358, fertilizerSaved: 219, income: 110600,
    },
    {
      rank: 3, crops: ['Chickpea', 'Barley', 'Safflower'],
      tags: ['restoresN', 'lowWater', 'drought'],
      scores: { final: 77, ml: 84, knn: 92 },
      years: [
        { crop: 'Chickpea', family: 'legume', soilN: 98, health: 81, fertilizer: 'DAP + MOP', kg: 94,
          risks: ['Ascochyta blight risk in wet springs.', 'Frost-sensitive at flowering.'] },
        { crop: 'Barley', family: 'cereal', soilN: 78, health: 75, fertilizer: 'NPK 10:26:26', kg: 119, nCredit: 30,
          risks: ['Lower OAIC price (3,400 DA/q).', 'Lodging risk if nitrogen application is excessive.'] },
        { crop: 'Safflower', family: 'oilseed', soilN: 60, health: 70, fertilizer: 'NPK 15:15:15', kg: 128,
          risks: ['Deep-rooted drought oilseed (< 400 mm zones).', 'Spiny leaves complicate harvest.'] },
      ],
      waterNeed: 37, ndviStability: 66, fertilizer: 341, fertilizerSaved: 236, income: 117700,
    },
    {
      rank: 4, crops: ['Chickpea', 'Safflower', 'Soft wheat'],
      tags: ['restoresN', 'lowWater', 'highProfit', 'highN'],
      scores: { final: 76, ml: 89, knn: 92 },
      years: [
        { crop: 'Chickpea', family: 'legume', soilN: 98, health: 81, fertilizer: 'DAP + MOP', kg: 94,
          risks: ['Ascochyta blight risk in wet springs.', 'Frost-sensitive at flowering.'] },
        { crop: 'Safflower', family: 'oilseed', soilN: 80, health: 76, fertilizer: 'NPK 15:15:15', kg: 105, nCredit: 30,
          risks: ['Deep-rooted drought oilseed (< 400 mm zones).', 'Spiny leaves complicate harvest.'] },
        { crop: 'Soft wheat', family: 'cereal', soilN: 52, health: 67, fertilizer: 'NPK 10:26:26 + Urea', kg: 179,
          risks: ['OAIC official price 5,000 DA/q.', 'Susceptible to yellow rust and lodging in humid springs.'] },
      ],
      waterNeed: 41, ndviStability: 67, fertilizer: 378, fertilizerSaved: 199, income: 135800,
    },
  ],
  // Rotations rejected by the agronomic rules filter, grouped by type of problem.
  avoid: [
    {
      crops: ['Durum wheat', 'Durum wheat', 'Durum wheat'], score: 28, level: 'high',
      reason: 'Strict cereal monoculture.',
      soil: 'Depletes about 90 kg N/ha over 3 years.',
      disease: 'Multiplies Fusarium and root rot.',
      alternative: 1,
    },
    {
      crops: ['Durum wheat', 'Barley', 'Forage oats'], score: 39, level: 'caution',
      reason: '3 cereals in a row (same Poaceae family).',
      soil: 'No legume nitrogen recharge — high NPK bill.',
      alternative: 1,
    },
    {
      crops: ['Faba bean', 'Rapeseed', 'Faba bean'], score: 44, level: 'caution',
      reason: 'Two thirsty crops in a dry scenario.',
      climate: 'High frost exposure.',
      water: 'High water demand in a dry scenario.',
      disease: 'Broomrape (Orobanche) build-up.',
      alternative: 2,
    },
  ],
};

export const TAGS = {
  restoresN: { tone: 'good' },
  afterHeavyFeeder: { tone: 'good' },
  lowWater: { tone: 'water' },
  drought: { tone: 'water' },
  highProfit: { tone: 'ai' },
  highN: { tone: 'warn' },
};
