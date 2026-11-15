// Number, string & Metric/US-Imperial unit helpers.
export const fmtInt = n => Math.round(Number(n) || 0).toLocaleString('en-US');
export const signed = (n, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(Number(n)).toFixed(digits)}`;
export const sameName = (a = '', b = '') =>
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
export const pct = (from, to) => (from ? Math.round(((to - from) / from) * 100) : 0);

/** Format latitude and longitude with N/S and E/W hemispheres. */
export function fmtCoord(lat, lon, digits = 2) {
  const la = Number(lat);
  const lo = Number(lon);
  const ns = la >= 0 ? 'N' : 'S';
  const ew = lo >= 0 ? 'E' : 'W';
  return `${Math.abs(la).toFixed(digits)}° ${ns}, ${Math.abs(lo).toFixed(digits)}° ${ew}`;
}

/** Rainfall value + unit (mm vs inches). */
export function fmtRain(mm, units = 'metric', digits) {
  const v = Number(mm) || 0;
  if (units === 'imperial') {
    const inches = v / 25.4;
    return `${inches.toFixed(digits ?? 1)} in`;
  }
  return `${digits != null ? v.toFixed(digits) : Math.round(v)} mm`;
}

/** Convert rainfall scalar only (for charts/tables). */
export function convRain(mm, units = 'metric') {
  const v = Number(mm) || 0;
  return units === 'imperial' ? Math.round((v / 25.4) * 10) / 10 : Math.round(v * 10) / 10;
}

export function rainUnit(units = 'metric') {
  return units === 'imperial' ? 'in' : 'mm';
}

/** Rainfall trend per decade. */
export function fmtRainTrend(mmDecade, units = 'metric') {
  const v = Number(mmDecade) || 0;
  if (units === 'imperial') {
    return `${signed(v / 25.4, 2)} in/decade`;
  }
  return `${signed(v, 1)} mm/decade`;
}

/** Temperature threshold (e.g. 35 °C -> 95 °F, 0 °C -> 32 °F). */
export function fmtTemp(c, units = 'metric', digits = 0) {
  const v = Number(c) || 0;
  if (units === 'imperial') {
    return `${(v * 1.8 + 32).toFixed(digits)} °F`;
  }
  return `${v.toFixed(digits)} °C`;
}

/** Temperature change delta (+2.0 °C -> +3.6 °F). */
export function fmtTempDelta(dc, units = 'metric') {
  const v = Number(dc) || 0;
  if (units === 'imperial') {
    return `${signed(v * 1.8, 1)} °F`;
  }
  return `${signed(v, 1)} °C`;
}

/** Fertilizer / Soil N per area (kg/ha vs lb/ac). */
export function fmtRate(kgHa, units = 'metric') {
  const v = Number(kgHa) || 0;
  if (units === 'imperial') {
    return `${fmtInt(Math.round(v * 0.892179))} lb/ac`;
  }
  return `${fmtInt(Math.round(v))} kg/ha`;
}

/** Yield potential (q/ha vs bu/ac or cwt/ac). */
export function fmtYield(qHa, units = 'metric') {
  const v = Number(qHa) || 0;
  if (units === 'imperial') {
    const lbAc = Math.round(v * 89.2179);
    return `${fmtInt(lbAc)} lb/ac`;
  }
  return `${v.toFixed(1)} q/ha`;
}

/** Distance (km vs miles). */
export function fmtDist(km, units = 'metric') {
  const v = Number(km) || 0;
  if (units === 'imperial') {
    return `${(v * 0.621371).toFixed(1)} mi`;
  }
  return `${v.toFixed(1)} km`;
}

/** Income per area. */
export function fmtIncome(valDzdEquiv, units = 'metric', region = null) {
  const v = Number(valDzdEquiv) || 0;
  if (region?.country === 'USA' || units === 'imperial') {
    const usdAc = Math.round(v / (135 * 2.471));
    return `$${fmtInt(usdAc)} /ac/yr`;
  }
  if (region?.country === 'India') {
    const inrHa = Math.round(v * 0.62);
    return `₹${fmtInt(inrHa)} /ha/yr`;
  }
  return `${fmtInt(v)} DA/ha/yr`;
}
