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
  { id: 'power', name: 'NASA POWER', url: 'https://power.larc.nasa.gov/' },
  { id: 'soilgrids', name: 'ISRIC SoilGrids 2.0', url: 'https://soilgrids.org/' },
  { id: 'modis', name: 'MODIS NDVI (MOD13Q1)', url: 'https://doi.org/10.5067/MODIS/MOD13Q1.061' },
  { id: 'era5', name: 'Open-Meteo · ERA5', url: 'https://open-meteo.com/' },
  { id: 'prices', name: 'OAIC / CCLS prices', url: null },
];
