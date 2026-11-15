export const fmtInt = n => Math.round(Number(n)).toLocaleString('en-US');
export const signed = (n, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(Number(n)).toFixed(digits)}`;
export const sameName = (a = '', b = '') => a.trim().toLowerCase() === b.trim().toLowerCase();
export const pct = (from, to) => (from ? Math.round(((to - from) / from) * 100) : 0);
