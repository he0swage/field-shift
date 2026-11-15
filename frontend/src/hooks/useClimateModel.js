// Everything the climate views need for the selected region + current what-if scenario.
import { useMemo } from 'react';
import { useFarm } from '../state/FarmContext';
import { useClimate } from './useData';
import { applyScenario, scaleMonthly } from '../utils/agronomy';

export function useClimateModel() {
  const { state } = useFarm();
  const { data, loading } = useClimate(state.region);
  const scenario = state.scenario;
  const model = useMemo(() => {
    if (!data) return null;
    const ind = data.indicators;
    return {
      data,
      trend: data.trend,
      ind,
      sc: applyScenario(ind, data.trend.mean, scenario),
      base: data.monthly,
      monthly: scaleMonthly(data.monthly, scenario.rain),
    };
  }, [data, scenario]);
  return { model, loading, scenario };
}
