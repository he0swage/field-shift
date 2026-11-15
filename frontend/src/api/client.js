// Data access layer — the ONLY place that talks to the backend.
// Set VITE_API_BASE in frontend/.env.local (see .env.example).
// If it is empty or a request fails, sample data is returned with `sample: true`
// so the UI can show a "Sample data" notice.
import { REGIONS } from '../data/regions';
import { BASE_CROPS } from '../data/crops';
import { SAMPLE_CLIMATE } from '../data/sampleClimate';
import { SAMPLE_RANKING } from '../data/sampleRanking';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 8000;

async function request(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(API_BASE + path, { ...options, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** GET /regions  →  { status, total, regions } */
export async function getRegions() {
  if (!API_BASE) return { regions: Object.values(REGIONS), sample: true };
  try {
    const data = await request('/regions');
    return { ...data, sample: false };
  } catch (err) {
    console.warn('Regions API failed:', err);
    return { regions: Object.values(REGIONS), sample: true };
  }
}

/**
 * GET /regions/:id  →  { status, region: { id, name, waterStress, soc, socClass, frostRisk, erosionRisk, suggestedPriorities } }
 */
export async function getRegionIndicators(regionId) {
  if (!API_BASE) {
    const r = REGIONS[regionId] || REGIONS.regionB;
    return {
      region: {
        id: regionId,
        name: r.name,
        waterStress: r.water,
        soc: r.soc,
        socClass: r.soc > 15 ? 'Adequate / High (>15 g/kg · SoilGrids live)' : 'Moderate (12–16 g/kg)',
        frostRisk: r.frost,
        erosionRisk: r.erosion,
      },
      sample: true,
    };
  }
  try {
    const data = await request(`/regions/${encodeURIComponent(regionId)}`);
    return { ...data, sample: false };
  } catch (err) {
    console.warn('Region indicators API failed:', err);
    const r = REGIONS[regionId] || REGIONS.regionB;
    return {
      region: {
        id: regionId,
        name: r.name,
        waterStress: r.water,
        soc: r.soc,
        socClass: r.soc > 15 ? 'Adequate / High (>15 g/kg · SoilGrids live)' : 'Moderate (12–16 g/kg)',
        frostRisk: r.frost,
        erosionRisk: r.erosion,
      },
      sample: true,
    };
  }
}

/** GET /climate?region=&lat=&lon=  →  { annual, monthly, indicators, source } */
export async function getClimate(regionId) {
  if (!API_BASE) return SAMPLE_CLIMATE[regionId];
  const r = REGIONS[regionId];
  try {
    const data = await request(`/climate?region=${encodeURIComponent(regionId)}&lat=${r.lat}&lon=${r.lon}`);
    return { ...data, sample: false };
  } catch (err) {
    console.warn('Climate API failed, using sample data:', err);
    return { ...SAMPLE_CLIMATE[regionId], fallbackReason: 'The climate service did not respond.' };
  }
}

/** POST /ranking  body: { region, rotation, allowed, priorities, scenario }  →  ranking (see sampleRanking.js) */
export async function getRanking(inputs) {
  if (!API_BASE) return SAMPLE_RANKING;
  try {
    const data = await request('/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    return { ...data, sample: false };
  } catch (err) {
    console.warn('Ranking API failed, using sample results:', err);
    return { ...SAMPLE_RANKING, fallbackReason: 'The ranking service did not respond.' };
  }
}

/**
 * GET /crops/:region  →  { status, region, total, crops }
 */
export async function getCrops(region) {
  if (!API_BASE) return { crops: BASE_CROPS, sample: true };
  const path = region ? `/crops/${encodeURIComponent(region.toUpperCase())}` : '/crops';
  try {
    const data = await request(path);
    return { ...data, sample: false };
  } catch (err) {
    console.warn('Crops API failed, using static crop list:', err);
    return { crops: BASE_CROPS, sample: true, fallbackReason: 'The crops service did not respond.' };
  }
}

/**
 * GET /crops/:region/:id  →  { status, crop }
 */
export async function getCropById(region, id) {
  if (!API_BASE) {
    const crop = BASE_CROPS.find(c => c.id === id);
    return crop ? { crop, sample: true } : null;
  }
  try {
    const data = await request(`/crops/${encodeURIComponent(region.toUpperCase())}/${encodeURIComponent(id.toLowerCase())}`);
    return { ...data, sample: false };
  } catch (err) {
    console.warn('Crop lookup failed:', err);
    return null;
  }
}
