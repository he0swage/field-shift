// Climate data hooks with a module-level cache, so switching views never refetches.
import { useEffect, useState } from 'react';
import { getClimate } from '../api/client';
import { REGION_IDS } from '../data/regions';
import { rainTrend } from '../utils/agronomy';

const climateCache = new Map(); // regionId -> Promise

export function loadClimate(id) {
  if (!climateCache.has(id)) climateCache.set(id, getClimate(id));
  return climateCache.get(id);
}

function useAsync(load, key) {
  const [state, setState] = useState({ data: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState(s => ({ data: s.data, loading: true }));
    load().then(data => { if (alive) setState({ data, loading: false }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Climate series + indicators + trend for one region. */
export function useClimate(regionId) {
  return useAsync(() => loadClimate(regionId).then(c => ({ ...c, trend: trendOf(c) })), regionId);
}

const SIG_FROM_LABEL = { 'both methods agree': 'clear', 'no clear trend': 'none' };

/** Trend of the yearly series. When the backend sends the team's official trend
 *  (analysis/build_indicators.py), use it so every page shows the same number. */
function trendOf(c) {
  const local = rainTrend(c.annual);
  const t = c.trend;
  if (!t || t.mmPerDecade == null) return local;
  const slope = t.mmPerDecade / 10;
  const meanYear = c.annual.reduce((s, d) => s + d.year, 0) / c.annual.length;
  return {
    ...local,
    slope,
    intercept: local.mean - slope * meanYear,
    decade: t.mmPerDecade,
    pOls: t.olsP ?? local.pOls,
    pMk: t.mkP ?? local.pMk,
    sig: SIG_FROM_LABEL[t.label] ?? local.sig,
  };
}

/** Rain trend for every region (map overlay). */
export function useRegionTrends() {
  const { data } = useAsync(
    () => Promise.all(REGION_IDS.map(loadClimate)).then(list =>
      Object.fromEntries(list.map((c, i) => [REGION_IDS[i], { ...trendOf(c), sample: c.sample }]))),
    'all',
  );
  return data || {};
}
