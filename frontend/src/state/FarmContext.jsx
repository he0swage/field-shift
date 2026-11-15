// The farmer's answers (region, priorities, usual rotation, crops, scenario), persisted in localStorage
// so selections survive navigation and reloads.
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { DEFAULT_REGION, REGIONS } from '../data/regions';
import { BASE_CROPS, DEFAULT_ALLOWED, DEFAULT_ROTATION } from '../data/crops';
import { DEFAULT_PRIORITIES } from '../utils/priorities';
import { storage } from '../utils/storage';

function init() {
  const s = storage.get('farm', {});
  return {
    region: REGIONS[s.region] ? s.region : DEFAULT_REGION,
    rotation: s.rotation?.length === 3 ? s.rotation : DEFAULT_ROTATION,
    allowed: s.allowed ?? DEFAULT_ALLOWED,
    custom: s.custom ?? [],
    priorities: s.priorities ?? DEFAULT_PRIORITIES,
    scenario: s.scenario ?? { rain: -20, temp: 2 },
    analysedKey: s.analysedKey ?? null,
    mapOverlay: s.mapOverlay ?? true,
  };
}

function reducer(s, a) {
  switch (a.type) {
    case 'set':
      return { ...s, ...a.patch };
    case 'rotation': {
      const rotation = [...s.rotation];
      rotation[a.year] = a.crop;
      return { ...s, rotation };
    }
    case 'toggleAllowed':
      return { ...s, allowed: s.allowed.includes(a.id) ? s.allowed.filter(x => x !== a.id) : [...s.allowed, a.id] };
    case 'addCustom':
      return { ...s, custom: [...s.custom, a.crop], allowed: [...s.allowed, a.crop.id] };
    case 'removeCustom':
      return {
        ...s,
        custom: s.custom.filter(c => c.id !== a.id),
        allowed: s.allowed.filter(x => x !== a.id),
        rotation: s.rotation.map(r => (r === a.id ? 'durum' : r)),
      };
    default:
      return s;
  }
}

/** The inputs sent to the ranking engine. */
export const analysisInputs = s => ({
  region: s.region, rotation: s.rotation, allowed: s.allowed,
  priorities: s.priorities, scenario: s.scenario, custom: s.custom,
});

const FarmContext = createContext(null);

export function FarmProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  useEffect(() => storage.set('farm', state), [state]);

  const value = useMemo(() => {
    const crops = [...BASE_CROPS, ...state.custom];
    return {
      state,
      dispatch,
      set: patch => dispatch({ type: 'set', patch }),
      region: { id: state.region, ...REGIONS[state.region] },
      crops,
      cropById: id => crops.find(c => c.id === id),
    };
  }, [state]);

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export const useFarm = () => useContext(FarmContext);
