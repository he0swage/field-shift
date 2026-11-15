// Data access layer — the ONLY place that talks to the backend (backend/src/server.js).
// VITE_API_BASE is set in frontend/.env.development / .env.production (default http://localhost:5001/api/v1).
// When the backend is not running, or has no data for a region, sample data is returned with
// `sample: true` and a `fallbackReason` so the UI can say so.
import { REGIONS } from '../data/regions';
import { SAMPLE_CLIMATE } from '../data/sampleClimate';
import { SAMPLE_RANKING } from '../data/sampleRanking';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 6000;

/** True when a backend URL is configured. Use checkHealth() to know if it actually answers. */
export const API_CONFIGURED = Boolean(API_BASE);

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `HTTP ${status}`);
    this.status = status;
    this.code = body?.error?.code;
  }
}

async function request(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(API_BASE + path, { ...options, signal: ctrl.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, body);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** 'offline' = backend unreachable · 'noData' = backend has nothing for this region yet */
const reasonOf = err => (err instanceof ApiError && err.status === 404 ? 'noData' : 'offline');

/** GET /health → true if the backend answers. */
export async function checkHealth() {
  if (!API_BASE) return false;
  try {
    const r = await request('/health');
    return r?.status === 'ok';
  } catch {
    return false;
  }
}

/** GET /climate?region=  →  { annual, monthly, indicators, source, ... } */
export async function getClimate(regionId) {
  if (!API_BASE) return SAMPLE_CLIMATE[regionId];
  const r = REGIONS[regionId];
  try {
    const data = await request(`/climate?region=${encodeURIComponent(regionId)}&lat=${r.lat}&lon=${r.lon}`);
    return { ...data, sample: false };
  } catch (err) {
    if (reasonOf(err) === 'offline') console.warn('Climate API unreachable, using sample data:', err.message);
    return { ...SAMPLE_CLIMATE[regionId], fallbackReason: reasonOf(err) };
  }
}

/** POST /ranking  body: { region, rotation, allowed, priorities, scenario, custom }  →  ranking (see sampleRanking.js) */
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
    console.warn('Ranking API failed, using sample results:', err.message);
    return { ...SAMPLE_RANKING, fallbackReason: err instanceof ApiError ? 'error' : 'offline' };
  }
}

/* ---------------- Auth (POST /auth/login, GET /auth/me, POST /auth/logout) ---------------- */

/** → { token, user: { email, name } }. Throws Error with .code: INVALID_CREDENTIALS | TOO_MANY_ATTEMPTS | OFFLINE */
export async function login(email, password) {
  if (!API_BASE) { const e = new Error('No API configured'); e.code = 'OFFLINE'; throw e; }
  try {
    return await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    if (!(err instanceof ApiError)) err.code = 'OFFLINE';
    throw err;
  }
}

/** → user, null when the session is invalid, undefined when the backend can't be reached. */
export async function me(token) {
  try {
    const r = await request('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    return r.user;
  } catch (err) {
    return err instanceof ApiError && err.status === 401 ? null : undefined;
  }
}

export async function logout(token) {
  try { await request('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch { /* already gone */ }
}
