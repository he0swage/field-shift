// The farmer's answers (region, priorities, usual rotation, crops, scenario), persisted in localStorage
// so selections survive navigation and reloads.
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { DEFAULT_REGION, REGIONS } from '../data/regions';
import { BASE_CROPS, DEFAULT_ALLOWED, DEFAULT_ROTATION } from '../data/crops';
import { DEFAULT_PRIORITIES, balance } from '../utils/priorities';
import { storage } from '../utils/storage';

function init() {
  const s = storage.get('farm', {});
  return {
    region: REGIONS[s.region] ? s.region : DEFAULT_REGION,
    rotation: s.rotation?.length >= 2 ? s.rotation : DEFAULT_ROTATION,
    allowed: s.allowed ?? DEFAULT_ALLOWED,
    custom: s.custom ?? [],
    priorities: s.priorities ? balance(s.priorities) : DEFAULT_PRIORITIES,
    prioMain: s.prioMain ?? null,     // step A choice
    prioSecond: s.prioSecond ?? null, // step B choice
    scenario: s.scenario ?? { rain: -20, temp: 2 },
    analysedKey: s.analysedKey ?? null,
    mapOverlay: s.mapOverlay ?? true,
    farmerUser: s.farmerUser ?? null,
    farmerToken: s.farmerToken ?? null,
    savedPlans: s.savedPlans ?? [],
    accountOpen: false,
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
    case 'setRotationLength': {
      const len = Math.max(2, Math.min(5, Number(a.length) || 3));
      const next = [...s.rotation];
      const fallbackPool = ['durum', 'lentil', 'barley', 'safflower', 'chickpea'];
      while (next.length < len) {
        next.push(fallbackPool[next.length % fallbackPool.length]);
      }
      return { ...s, rotation: next.slice(0, len) };
    }
    case 'loadSavedPlan': {
      const p = a.plan || {};
      const mapReg = p.region === 'regionA' ? 'setif' : p.region === 'regionB' ? 'kansas' : p.region === 'regionC' ? 'punjab' : (p.region || s.region);
      return {
        ...s,
        region: REGIONS[mapReg] ? mapReg : s.region,
        rotation: Array.isArray(p.rotation) && p.rotation.length >= 2 ? p.rotation : s.rotation,
        allowed: Array.isArray(p.allowed_crops) && p.allowed_crops.length >= 3 ? p.allowed_crops : s.allowed,
        priorities: p.priorities ? balance(p.priorities) : s.priorities,
        scenario: p.scenario || s.scenario,
      };
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
