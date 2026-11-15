// "Analyse & Rank Rotations": runs the ranking engine once, keeps the result, and flags it as
// out of date when the farmer changes an input afterwards.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getRanking } from '../api/client';
import { analysisInputs, useFarm } from './FarmContext';

const cache = new Map(); // JSON(inputs) -> Promise<ranking>
const load = key => {
  if (!cache.has(key)) cache.set(key, getRanking(JSON.parse(key)));
  return cache.get(key);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const { state, set } = useFarm();
  const key = JSON.stringify(analysisInputs(state));
  const [ranking, setRanking] = useState(null);
  const [status, setStatus] = useState(state.analysedKey ? 'restoring' : 'idle'); // idle | restoring | loading | done

  // Restore the last analysis after a reload
  useEffect(() => {
    if (!state.analysedKey) return;
    load(state.analysedKey).then(r => { setRanking(r); setStatus('done'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useCallback(async () => {
    setStatus('loading');
    // Short minimum duration so the farmer sees each modelling stage
    const [r] = await Promise.all([load(key), wait(1800)]);
    setRanking(r);
    set({ analysedKey: key });
    setStatus('done');
    return r;
  }, [key, set]);

  const value = useMemo(() => ({
    ranking, status, run,
    stale: Boolean(ranking && state.analysedKey && state.analysedKey !== key),
  }), [ranking, status, run, state.analysedKey, key]);

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export const useAnalysis = () => useContext(AnalysisContext);
