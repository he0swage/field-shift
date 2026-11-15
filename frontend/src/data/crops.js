// Crop catalogue and families (the 6 families of the custom-crop form).
export const FAMILIES = ['legume', 'cereal', 'oilseed', 'forage', 'root', 'fallow'];
export const FAMILY_ICON = { legume: '🥜', cereal: '🌾', oilseed: '🌻', forage: '🌿', root: '🧅', fallow: '🟫' };

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
  { id: 'alfalfa', name: 'Alfalfa', family: 'forage' },
  { id: 'onion', name: 'Onion', family: 'root' },
  { id: 'fallow', name: 'Worked fallow', family: 'fallow' },
];

export const DEFAULT_ALLOWED = ['durum', 'soft', 'barley', 'chickpea', 'lentil', 'vetch', 'rapeseed', 'safflower'];
export const DEFAULT_ROTATION = ['durum', 'barley', 'durum'];
