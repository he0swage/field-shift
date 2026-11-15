// Team shown on the About page. Roles are taken from docs/data_contract.md and docs/about_data.md.
// To add a photo: put the image in frontend/public/team/ and set photo: 'team/<file>.jpg'.
export const TEAM = [
  { name: 'Nazim', roleKey: 'team.role.frontend', photo: null },
  { name: 'Mehdi Denbri', roleKey: 'team.role.backend', photo: null },
  { name: 'Achref', roleKey: 'team.role.data', photo: null },
  { name: 'Alaa', roleKey: 'team.role.engine', photo: null },
  { name: 'Younes', roleKey: 'team.role.agronomy', photo: null },
  { name: 'Aniss', roleKey: 'team.role.sources', photo: null },
];

export const DATA_SOURCES = [
  { id: 'power', name: 'NASA POWER 1995–2024', url: 'https://power.larc.nasa.gov/' },
  { id: 'soilgrids', name: 'ISRIC SoilGrids', url: 'https://soilgrids.org/' },
  { id: 'modis', name: 'MODIS NDVI', url: 'https://doi.org/10.5067/MODIS/MOD13Q1.061' },
  { id: 'openmeteo', name: 'Open-Meteo', url: 'https://open-meteo.com/' },
  { id: 'era5', name: 'ERA5', url: 'https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5' },
  { id: 'prices', name: 'OAIC / CCLS prices', url: null },
];
