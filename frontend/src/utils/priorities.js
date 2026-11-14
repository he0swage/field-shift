// The 3 farm priorities always sum to 100.
export const PRIO = {
  water: { name: 'Save water', color: 'var(--water)' },
  soil: { name: 'Protect soil', color: 'var(--soil)' },
  yield: { name: 'Stable yield', color: 'var(--wheat-bar)' },
};
export const KEYS = Object.keys(PRIO);

export function normalize(p) {
  const sum = KEYS.reduce((s, k) => s + p[k], 0) || 1;
  const out = {};
  KEYS.forEach(k => { out[k] = Math.round(p[k] / sum * 100); });
  const diff = 100 - KEYS.reduce((s, k) => s + out[k], 0);
  out[topKey(out)] += diff;
  return out;
}

/** Regional preset: water stress, soil-carbon gap and NDVI yield baseline, rescaled to 100. */
export function presetFor(region) {
  return normalize({
    water: region.water,
    soil: Math.max(5, 30 - region.soc),
    yield: Math.round(region.ndvi * 100),
  });
}

/** Move one slider; the other two share the remainder proportionally. */
export function setPriority(p, key, value) {
  const others = KEYS.filter(k => k !== key);
  const rest = others.reduce((s, k) => s + p[k], 0);
  const remain = 100 - value;
  const first = Math.round(rest === 0 ? remain / 2 : p[others[0]] / rest * remain);
  return { ...p, [key]: value, [others[0]]: first, [others[1]]: remain - first };
}

export const topKey = p => KEYS.reduce((a, b) => (p[a] >= p[b] ? a : b));

export const PROFILE_TEXT = {
  water: 'Drought-first: favours barley, chickpea and lentil; penalises thirsty crops.',
  soil: 'Soil-builder: favours legumes and vetch; penalises cereal-after-cereal.',
  yield: 'Output-first: favours durum wheat and rapeseed where NDVI history is steady.',
};
