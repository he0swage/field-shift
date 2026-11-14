// Candidate regions. `est` lists indicators that are still placeholders (flagged "estimate" in the UI).
export const REGIONS = {
  regionA: { label: 'Region A', short: 'Sétif', name: 'Sétif High Plateaux', lat: 36.15, lon: 5.38, rain: 485,
    ph: [7.3, 8.4], water: 20, soc: 12.52, frost: 34, erosion: 38, ndvi: 0.44,
    est: ['frost', 'erosion'] },
  regionB: { label: 'Region B', short: 'Constantine', name: 'Constantine El Khroub', lat: 36.16, lon: 6.68, rain: 516,
    ph: [7.2, 8.2], water: 28, soc: 17.08, frost: 25, erosion: 35, ndvi: 0.49,
    est: ['frost', 'erosion'] },
  regionC: { label: 'Region C', short: 'Tiaret', name: 'Tiaret Western Plateau', lat: 35.34, lon: 1.38, rain: 408,
    ph: [7.2, 8.3], water: 33, soc: 12.38, frost: 28, erosion: 44, ndvi: 0.47,
    est: [] },
};
