// Field Shift — data access layer.
// ------------------------------------------------------------------
// TEAM: to connect the real backend, set `apiBase` below (or define
// window.FIELDSHIFT_CONFIG before this script). Each endpoint must
// return the JSON shape documented in js/data.js (SAMPLE_CLIMATE).
//
//   GET {apiBase}/climate?region=regionA&lat=36.15&lon=5.38
//
// If apiBase is empty, or the request fails, the app falls back to
// the sample data and tells the user so.
// ------------------------------------------------------------------
'use strict';

const FIELDSHIFT_CONFIG = Object.assign({
  apiBase: '',          // e.g. 'https://api.fieldshift.example/v1'
  timeoutMs: 8000,
}, window.FIELDSHIFT_CONFIG || {});

const FieldShiftAPI = {
  async getClimate(regionId) {
    const r = REGIONS[regionId];
    if (FIELDSHIFT_CONFIG.apiBase) {
      try {
        const url = `${FIELDSHIFT_CONFIG.apiBase}/climate?region=${encodeURIComponent(regionId)}&lat=${r.lat}&lon=${r.lon}`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), FIELDSHIFT_CONFIG.timeoutMs);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        return { ...data, sample: false };
      } catch (err) {
        console.warn('Climate API failed, using sample data:', err);
        return { ...SAMPLE_CLIMATE[regionId], fallbackReason: 'The climate service did not respond.' };
      }
    }
    return SAMPLE_CLIMATE[regionId];
  },
};

/* ------------------------------------------------------------------ *
 * Statistics used on the climate step
 * ------------------------------------------------------------------ */
const Stats = {
  // Ordinary least squares slope + two-sided p-value (normal approximation)
  ols(xs, ys) {
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    const slope = sxy / sxx, intercept = my - slope * mx;
    const r = sxy / Math.sqrt(sxx * syy);
    const t = r * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
    return { slope, intercept, p: 2 * (1 - Stats.phi(Math.abs(t))) };
  },
  // Mann–Kendall trend test p-value (no ties correction)
  mannKendall(ys) {
    const n = ys.length; let s = 0;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) s += Math.sign(ys[j] - ys[i]);
    const v = n * (n - 1) * (2 * n + 5) / 18;
    const z = s > 0 ? (s - 1) / Math.sqrt(v) : s < 0 ? (s + 1) / Math.sqrt(v) : 0;
    return { s, p: 2 * (1 - Stats.phi(Math.abs(z))) };
  },
  phi(z) { // standard normal CDF
    const t = 1 / (1 + 0.2316419 * z);
    const d = 0.3989423 * Math.exp(-z * z / 2);
    return 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  },
};
