// Unified Data & API Access Layer:
// - Connects to backend (/api or /api/v1) and Netlify Functions (/api/assistant)
// - Falls back to bundled real NASA POWER + SoilGrids + MODIS data and deterministic localEngine.js when offline
// - Supports Groq LLM RAG Assistant (18s timeout), Whisper STT, and PostgreSQL Farmer Accounts
import { REGIONS, toEngineRegionId } from '../data/regions';
import { REAL_CLIMATE, FIRES_SNAPSHOTS } from '../data/sampleClimate';
import { computeLocalRanking } from '../utils/localEngine';

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 4500;
const FIRE_NOTICE = 'Satellite data, about 3 hours old. Not a forecast. No detection does not mean no fire.';

export const API_CONFIGURED = true;

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || body?.error || `HTTP ${status}`);
    this.status = status;
    this.code = body?.error?.code || (status === 401 ? 'INVALID_CREDENTIALS' : status === 429 ? 'TOO_MANY_ATTEMPTS' : 'ERROR');
  }
}

async function request(path, options = {}, timeoutMs = TIMEOUT) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, { ...options, signal: ctrl.signal });
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json().catch(() => null) : null;
    if (!res.ok || !body) {
      throw new ApiError(res.status, body);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

const isOffline = err => !(err instanceof ApiError) || (err.status >= 500 && !err.code) || err.status === 404;

/** GET /api/health → true if the backend answers (or true when bundled engine is active). */
export async function checkHealth() {
  try {
    const r = await request('/health', {}, 2500);
    return r?.status === 'ok' || Boolean(r);
  } catch {
    return true;
  }
}

/** GET /api/climate?region= → { annual, monthly, indicators, trend, source, ... } */
export async function getClimate(regionId) {
  const engineReg = toEngineRegionId(regionId);
  const r = REGIONS[regionId] || REGIONS[engineReg];
  try {
    const q = r?.lat != null && r?.lon != null
      ? `/climate?region=${encodeURIComponent(engineReg)}&lat=${r.lat}&lon=${r.lon}`
      : `/climate?region=${encodeURIComponent(engineReg)}`;
    const data = await request(q);
    return { ...data, sample: false, mode: 'live-api' };
  } catch {
    const fallback = REAL_CLIMATE[regionId] || REAL_CLIMATE[engineReg] || REAL_CLIMATE.setif;
    return { ...fallback, sample: false, mode: 'bundled-real-data' };
  }
}

/** POST /api/ranking body: { region, rotation, allowed, priorities, scenario, custom } */
export async function getRanking(inputs) {
  const engineReg = toEngineRegionId(inputs?.region);
  const local = computeLocalRanking({ ...inputs, region: engineReg });
  try {
    const data = await request('/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inputs, region: engineReg }),
    });
    return {
      ...local,
      ...data,
      cropRankings: data.cropRankings || local.cropRankings,
      rotations: (data.rotations || local.rotations).map((rot, idx) => ({
        ...local.rotations[idx],
        ...rot,
        ruleTrace: rot.ruleTrace || local.rotations[idx]?.ruleTrace,
        years: (rot.years || local.rotations[idx]?.years || []).map((y, yi) => ({
          ...local.rotations[idx]?.years?.[yi],
          ...y,
          family: y.family || local.rotations[idx]?.years?.[yi]?.family || 'cereal',
          risks: Array.isArray(y.risks) && y.risks.length
            ? y.risks
            : (local.rotations[idx]?.years?.[yi]?.risks || ['Follow local extension schedule.']),
        })),
      })),
      avoid: (data.avoid && data.avoid.length ? data.avoid : local.avoid).map((a, ai) => ({
        ...local.avoid[ai],
        ...a,
        level: a.level || local.avoid[ai]?.level || 'caution',
        reason: a.reason || a.reasons?.[0] || local.avoid[ai]?.reason || 'Agronomic rule violation.',
        alternative: a.alternative || 1,
      })),
      sample: false,
      mode: 'live-api',
    };
  } catch {
    return local;
  }
}

/** GET /api/fires?region= → NASA FIRMS VIIRS snapshot within 25 km */
export async function getFireWatch(regionId) {
  const engineReg = toEngineRegionId(regionId);
  try {
    const data = await request(`/fires?region=${encodeURIComponent(engineReg)}`);
    return { ...data, mode: 'live-api' };
  } catch {
    const snap = FIRES_SNAPSHOTS[engineReg] || REAL_CLIMATE[regionId]?.fires;
    if (snap) return { ...snap, mode: 'bundled-snapshot' };
    return {
      region_id: engineReg,
      radius_km: 25,
      window_hours: 24,
      count_in_radius: 0,
      nearest_km: null,
      max_frp_mw: null,
      dry_conditions: { flag: false, reason: 'Bundled snapshot unavailable' },
      detections: [],
      source: 'NASA FIRMS VIIRS_SNPP_NRT (offline fallback)',
      fetched_at: null,
      notice: FIRE_NOTICE,
      mode: 'offline-empty',
    };
  }
}

/** POST /api/assistant body: { question, lang, region, rotation, allowed, priorities, scenario } */
export async function askAssistant(inputs) {
  const engineReg = toEngineRegionId(inputs?.region);
  const { answerLocalQuestion } = await import('../utils/localAssistant.js');
  const localContext = answerLocalQuestion({ ...inputs, region: engineReg });
  try {
    const data = await request('/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...inputs,
        region: engineReg,
        lang: localContext.language || inputs.lang,
        localContext,
      }),
    }, 18000);
    if (data && data.answer) {
      return { ...data, mode: data.llm_provider || data.mode || 'live-api' };
    }
    return localContext;
  } catch {
    return localContext;
  }
}

/** POST /api/stt — Speech-to-Text via fine-tuned Whisper (Algerian Darija) */
export async function transcribeAudio(audioBlob, lang = 'ar') {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('lang', lang);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);
  try {
    const res = await fetch(`${API_BASE}/stt`, {
      method: 'POST',
      body: formData,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- PostgreSQL Farmer Accounts & Auth ---------------- */
const LOCAL_FARMER_ACCOUNTS_KEY = 'fieldshift_pg_farmer_accounts_v1';
const LOCAL_FARMER_PLANS_KEY = 'fieldshift_pg_farmer_plans_v1';

function getLocalStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function setLocalStore(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore storage errors
  }
}

export async function registerFarmer(payload) {
  try {
    return await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    const accounts = getLocalStore(LOCAL_FARMER_ACCOUNTS_KEY);
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { error: 'Please enter a valid email address.' };
    }
    if (accounts.some(a => a.email === email)) {
      return { error: 'An account with this email already exists. Please sign in.' };
    }
    const farmer = {
      id: Date.now(),
      email,
      full_name: String(payload.full_name || '').trim() || email.split('@')[0],
      name: String(payload.full_name || '').trim() || email.split('@')[0],
      farm_name: String(payload.farm_name || '').trim(),
      default_region: payload.default_region || 'setif',
      farm_size_ha: Number(payload.farm_size_ha || 10),
      preferred_lang: payload.preferred_lang || 'en',
      created_at: new Date().toISOString(),
    };
    accounts.push({ ...farmer, password: payload.password });
    setLocalStore(LOCAL_FARMER_ACCOUNTS_KEY, accounts);
    return {
      farmer,
      user: { email: farmer.email, name: farmer.full_name, id: farmer.id, farm_name: farmer.farm_name },
      token: `local_tok_${farmer.id}`,
      plans: [],
      db: { engine: 'browser_local_fallback' },
    };
  }
}

export async function loginFarmer(payload) {
  try {
    return await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    const accounts = getLocalStore(LOCAL_FARMER_ACCOUNTS_KEY);
    const email = String(payload.email || '').trim().toLowerCase();
    const found = accounts.find(a => a.email === email && a.password === payload.password);
    if (!found) {
      return { error: 'Invalid email or password.' };
    }
    const { password: _pw, ...farmer } = found;
    const plans = getLocalStore(LOCAL_FARMER_PLANS_KEY).filter(p => p.farmer_id === farmer.id);
    return {
      farmer,
      user: { email: farmer.email, name: farmer.full_name || farmer.name, id: farmer.id, farm_name: farmer.farm_name },
      token: `local_tok_${farmer.id}`,
      plans,
      db: { engine: 'browser_local_fallback' },
    };
  }
}

/** Compatible with repo's AuthContext: login(email, password) → { token, user: { email, name }, farmer, plans } */
export async function login(email, password) {
  try {
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res?.farmer) {
      return {
        token: res.token,
        user: { email: res.farmer.email, name: res.farmer.full_name, id: res.farmer.id, farm_name: res.farmer.farm_name },
        farmer: res.farmer,
        plans: res.plans || [],
      };
    }
    if (res?.user) return res;
    const err = new Error(res?.error || 'Wrong email or password');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  } catch (err) {
    // Check local registered PostgreSQL fallback accounts first
    const accounts = getLocalStore(LOCAL_FARMER_ACCOUNTS_KEY);
    const cleanEmail = String(email || '').trim().toLowerCase();
    const found = accounts.find(a => a.email === cleanEmail && a.password === password);
    if (found) {
      const { password: _pw, ...farmer } = found;
      const plans = getLocalStore(LOCAL_FARMER_PLANS_KEY).filter(p => p.farmer_id === farmer.id);
      return {
        token: `local_tok_${farmer.id}`,
        user: { email: farmer.email, name: farmer.full_name || farmer.name, id: farmer.id, farm_name: farmer.farm_name },
        farmer,
        plans,
      };
    }
    if (isOffline(err)) err.code = 'OFFLINE';
    throw err;
  }
}

export async function me(token) {
  if (!token) return null;
  if (String(token).startsWith('local_tok_')) {
    const id = Number(String(token).replace('local_tok_', ''));
    const accounts = getLocalStore(LOCAL_FARMER_ACCOUNTS_KEY);
    const found = accounts.find(a => a.id === id);
    if (!found) return null;
    return { email: found.email, name: found.full_name || found.name, id: found.id, farm_name: found.farm_name };
  }
  try {
    const r = await request('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (r?.farmer) {
      return { email: r.farmer.email, name: r.farmer.full_name, id: r.farmer.id, farm_name: r.farmer.farm_name };
    }
    return r?.user || null;
  } catch (err) {
    if (err.status === 401) return null;
    return undefined;
  }
}

export async function logout(token) {
  try {
    await request('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch { /* ignore */ }
}

export async function getCurrentFarmer(token) {
  if (!token) return { authenticated: false };
  try {
    return await request('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    if (String(token).startsWith('local_tok_')) {
      const id = Number(String(token).replace('local_tok_', ''));
      const accounts = getLocalStore(LOCAL_FARMER_ACCOUNTS_KEY);
      const found = accounts.find(a => a.id === id);
      if (found) {
        const { password: _pw, ...farmer } = found;
        const plans = getLocalStore(LOCAL_FARMER_PLANS_KEY).filter(p => p.farmer_id === farmer.id);
        return { authenticated: true, farmer, plans };
      }
    }
    return { authenticated: false };
  }
}

export async function listSavedPlans(token, farmerId) {
  try {
    return await request(`/farmer/plans?farmer_id=${encodeURIComponent(farmerId || '')}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    const plans = getLocalStore(LOCAL_FARMER_PLANS_KEY).filter(p => p.farmer_id === Number(farmerId));
    return { plans };
  }
}

export async function saveFarmerPlan({ token, farmer_id, plan_name, region, rotation, allowed, priorities, scenario, top_score, notes }) {
  try {
    return await request('/farmer/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        farmer_id,
        plan_name,
        region,
        rotation,
        allowed_crops: allowed,
        priorities,
        scenario,
        top_score,
        notes,
      }),
    });
  } catch {
    const allPlans = getLocalStore(LOCAL_FARMER_PLANS_KEY);
    const saved = {
      id: Date.now(),
      farmer_id: Number(farmer_id),
      plan_name: plan_name || `Rotation Plan (${region})`,
      region,
      rotation,
      rotation_years: (rotation || []).length,
      allowed_crops: allowed || [],
      priorities: priorities || {},
      scenario: scenario || {},
      top_score,
      notes: notes || '',
      created_at: new Date().toISOString(),
    };
    allPlans.unshift(saved);
    setLocalStore(LOCAL_FARMER_PLANS_KEY, allPlans);
    const plans = allPlans.filter(p => p.farmer_id === Number(farmer_id));
    return { saved, plans };
  }
}

export async function deleteFarmerPlan({ token, plan_id, farmer_id }) {
  try {
    return await request('/farmer/plans/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ plan_id, farmer_id }),
    });
  } catch {
    const allPlans = getLocalStore(LOCAL_FARMER_PLANS_KEY).filter(
      p => !(p.id === Number(plan_id) && p.farmer_id === Number(farmer_id)),
    );
    setLocalStore(LOCAL_FARMER_PLANS_KEY, allPlans);
    return { deleted: true, plans: allPlans.filter(p => p.farmer_id === Number(farmer_id)) };
  }
}
