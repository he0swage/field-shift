// Step navigation (one menu for all steps), synced with the URL hash (#step-3).
import { createContext, useCallback, useContext, useRef, useState } from 'react';

export const STEPS = [
  { n: 1, label: 'Region' },
  { n: 2, label: 'Rotation & crops' },
  { n: 3, label: 'Priorities' },
  { n: 4, label: 'Review' },
  { n: 5, label: 'Climate & rainfall' },
  { n: 6, label: 'Best rotations' },
];

const readHash = () => {
  const n = Number((window.location.hash.match(/step-(\d)/) || [])[1]);
  return n >= 1 && n <= STEPS.length ? n : 1;
};

const NavContext = createContext(null);

export function NavProvider({ children }) {
  const [step, setStep] = useState(readHash);
  const focusNext = useRef(false); // move focus to the new step's heading (not on first load)

  const go = useCallback(n => {
    setStep(n);
    window.history.replaceState(null, '', `#step-${n}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    focusNext.current = true;
  }, []);

  return <NavContext.Provider value={{ step, go, focusNext }}>{children}</NavContext.Provider>;
}

export const useNav = () => useContext(NavContext);
