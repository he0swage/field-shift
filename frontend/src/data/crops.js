// Crop catalogue, family labels and quick-fill presets for custom crops.
export const BASE_CROPS = [
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
export const FAMILY_LABEL = { cereal: 'Cereals', legume: 'Legumes', oilseed: 'Oilseeds', fallow: 'Fallow', other: 'Other' };

export const CROP_PRESETS = { // family, rainMin, rainMax, pHmin, pHmax, price, yield, frostHardy, heatTolerant
  'Field pea': ['legume', 350, 650, 6.0, 8.0, 9500, 18, true, false],
  'Coriander': ['other', 300, 500, 6.5, 8.0, 25000, 8, false, true],
  'Fenugreek': ['legume', 300, 550, 6.5, 8.2, 22000, 10, false, true],
  'Garlic': ['other', 400, 700, 6.0, 7.8, 15000, 80, true, false],
  'Sorghum': ['cereal', 400, 800, 5.5, 8.5, 4500, 30, false, true],
  'Maize (rainfed)': ['cereal', 500, 900, 5.8, 7.8, 4500, 35, false, false],
  'Rice': ['cereal', 1000, 2000, 5.0, 7.0, 6000, 50, false, true],
};
