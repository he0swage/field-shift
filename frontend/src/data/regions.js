// Featured agricultural regions.
// `est` lists fields that are still placeholders until the regional APIs are connected;
// the UI shows them as "estimate". Sétif rainfall (485 mm) comes from the team's NASA POWER run.
export const REGIONS = {
  kansas: {
    name: 'Kansas Wheat Plains', country: 'USA', countryCode: 'us',
    lat: 38.5, lon: -98.0, rain: 720,
    ph: [6.0, 7.8], frost: 60,
    est: ['rain', 'ph', 'frost'],
  },
  setif: {
    name: 'Sétif High Plains', country: 'Algeria', countryCode: 'dz',
    lat: 36.15, lon: 5.38, rain: 485,
    ph: [7.3, 8.4], frost: 34,
    est: ['frost'],
  },
  punjab: {
    name: 'Punjab Plains', country: 'India', countryCode: 'in',
    lat: 30.9, lon: 75.85, rain: 650,
    ph: [7.5, 8.6], frost: 8,
    est: ['rain', 'ph', 'frost'],
  },
};

export const REGION_IDS = Object.keys(REGIONS);
export const DEFAULT_REGION = 'setif';

export const fmtCoord = (lat, lon) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
