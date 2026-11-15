// The farmer shares 100 points between 3 priorities. Moving one slider re-distributes the rest
// between the other two (in proportion to their current values), so the total is always 100.
export const PRIO = {
  water: { color: 'var(--series-1)' },
  soil: { color: 'var(--accent)' },
  yield: { color: 'var(--leaf)' },
};
export const KEYS = Object.keys(PRIO);
export const DEFAULT_PRIORITIES = { water: 42, soil: 33, yield: 25 };

export const total = p => KEYS.reduce((s, k) => s + (p[k] || 0), 0);

/** Set one priority; the two others share the remainder proportionally (equally if both are 0). */
export function setPriority(p, key, value) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const [a, b] = KEYS.filter(k => k !== key);
  const rest = 100 - v;
  const pa = p[a] || 0, pb = p[b] || 0;
  const na = pa + pb === 0 ? Math.round(rest / 2) : Math.round((rest * pa) / (pa + pb));
  return { [key]: v, [a]: na, [b]: rest - na };
}

/** Rescale any stored values to exactly 100 (used for old saved data). */
export function balance(p) {
  const sum = total(p);
  if (!sum) return { ...DEFAULT_PRIORITIES };
  const out = {};
  KEYS.forEach(k => { out[k] = Math.round((p[k] / sum) * 100); });
  const top = KEYS.reduce((x, y) => (out[x] >= out[y] ? x : y));
  out[top] += 100 - total(out);
  return out;
}
