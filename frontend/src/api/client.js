// Data access layer — the ONLY place that talks to the backend.
// Set VITE_API_BASE in frontend/.env.local (see .env.example).
// If it is empty or a request fails, sample data is returned with `sample: true`
// so the UI can show a "Sample data" notice.
import { REGIONS } from '../data/regions';
import { SAMPLE_CLIMATE } from '../data/sampleClimate';
import { SAMPLE_RANKING } from '../data/sampleRanking';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 8000;

/** True when a backend is configured (drives the "LIVE REGIONAL DATA" banner). */
export const IS_LIVE = Boolean(API_BASE);

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
