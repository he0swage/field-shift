// Global farm answers (region, rotation, crops, priorities, scenario), persisted locally.
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { REGIONS } from '../data/regions';
import { BASE_CROPS } from '../data/crops';
import { presetFor } from '../utils/priorities';
import { storage } from '../utils/storage';

const DEFAULT_ALLOWED = ['durum', 'soft', 'barley', 'chickpea', 'lentil', 'vetch', 'rapeseed', 'safflower'];

function init() {
  const saved = storage.get('farm', {});
  const region = REGIONS[saved.region] ? saved.region : 'regionC';
  return {
    region,
    rotation: saved.rotation?.length === 3 ? saved.rotation : ['durum', 'barley', 'durum'],
    allowed: saved.allowed ?? DEFAULT_ALLOWED,
    custom: saved.custom ?? [],
    priorities: saved.priorities ?? presetFor(REGIONS[region]),
    scenario: saved.scenario ?? { rain: -20, temp: 2 },
    mapOverlay: saved.mapOverlay ?? true,
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
