// Data hooks with a module-level cache, so switching steps never refetches.
import { useEffect, useState } from 'react';
import { getClimate, getRanking } from '../api/client';
import { REGIONS } from '../data/regions';
import { rainTrend } from '../utils/agronomy';

const climateCache = new Map();   // regionId -> Promise
const rankingCache = new Map();   // JSON(inputs) -> Promise

function loadClimate(id) {
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

/** Climate series + indicators for one region. */
export function useClimate(regionId) {
  return useAsync(() => loadClimate(regionId), regionId);
}

/** Rain trend for every region (used by the map and the region cards). */
export function useRegionTrends() {
  const ids = Object.keys(REGIONS);
  const { data } = useAsync(
    () => Promise.all(ids.map(loadClimate)).then(list =>
      Object.fromEntries(list.map((c, i) => [ids[i], rainTrend(c.annual)]))),
    'all',
  );
  return data || {};
}

/** Ranked rotations for the farmer's inputs. */
export function useRanking(inputs) {
  const key = JSON.stringify(inputs);
  return useAsync(() => {
    if (!rankingCache.has(key)) rankingCache.set(key, getRanking(inputs));
    return rankingCache.get(key);
  }, key);
}
