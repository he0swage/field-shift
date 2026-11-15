// The farmer shares 100 points between 3 priorities. Moving one slider re-distributes the rest
// between the other two (in proportion to their current values), so the total is always 100.
export const PRIO = {
  water: { color: 'var(--prio-water)' },
  soil: { color: 'var(--prio-soil)' },
  yield: { color: 'var(--prio-yield)' },
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

/** Step A — the main priority gets `value`; the other two share the rest equally. */
export function setMain(p, main, value) {
  const v = Math.max(34, Math.min(100, Math.round(value)));
  const [a, b] = KEYS.filter(k => k !== main);
  const rest = 100 - v;
  const na = Math.ceil(rest / 2);
  return { [main]: v, [a]: na, [b]: rest - na };
}

/** Step B — the second priority gets `value` (never more than the main one); the last fills the rest. */
export function setSecond(p, main, second, value) {
  const rest = 100 - p[main];
  const v = Math.max(0, Math.min(rest, p[main], Math.round(value)));
  const third = KEYS.find(k => k !== main && k !== second);
  return { [main]: p[main], [second]: v, [third]: rest - v };
}

/** Main / second keys: stored choice, else the largest values. */
export function order(p, mainChoice, secondChoice) {
  const main = KEYS.includes(mainChoice) ? mainChoice : KEYS.reduce((x, y) => (p[x] >= p[y] ? x : y));
  const others = KEYS.filter(k => k !== main);
  const second = others.includes(secondChoice) ? secondChoice : (p[others[0]] >= p[others[1]] ? others[0] : others[1]);
  return { main, second, third: others.find(k => k !== second) };
}
