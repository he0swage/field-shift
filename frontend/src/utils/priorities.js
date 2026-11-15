// The farmer shares 100 points between 3 priorities. Sliders move independently;
// analysis is blocked until the total is exactly 100 ("Balance to 100" fixes it in one click).
export const PRIO = {
  water: { icon: '💧', color: 'var(--water)' },
  soil: { icon: '🌱', color: 'var(--earth)' },
  yield: { icon: '🌾', color: 'var(--gold)' },
};
export const KEYS = Object.keys(PRIO);
export const DEFAULT_PRIORITIES = { water: 42, soil: 33, yield: 25 };

export const total = p => KEYS.reduce((s, k) => s + (p[k] || 0), 0);

/** Rescale to exactly 100 while keeping the proportions the farmer chose. */
export function balance(p) {
  const sum = total(p);
  if (!sum) return { ...DEFAULT_PRIORITIES };
  const out = {};
  KEYS.forEach(k => { out[k] = Math.round((p[k] / sum) * 100); });
  const top = KEYS.reduce((a, b) => (out[a] >= out[b] ? a : b));
  out[top] += 100 - total(out);
  return out;
}
