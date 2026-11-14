export const fmtInt = n => Number(n).toLocaleString('en-US');
export const signed = (n, digits = 0) => `${n > 0 ? '+' : ''}${Number(n).toFixed(digits)}`;
export const sameName = (a = '', b = '') => a.trim().toLowerCase() === b.trim().toLowerCase();
