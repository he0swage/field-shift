// Journey navigation synced with the URL hash (#/climate). No page reloads; Back/Forward work.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const PHASES = [
  { id: 'setup', steps: ['region', 'strategy'] },
  { id: 'climate', steps: ['climate', 'extreme', 'monthly'] },
  { id: 'recs', steps: ['top', 'avoid'] },
  { id: 'results', steps: ['summary'] },
];
export const JOURNEY = PHASES.flatMap(p => p.steps);
export const EXTRA_VIEWS = ['map', 'compare', 'about'];
const ALL = [...JOURNEY, ...EXTRA_VIEWS];

const readHash = () => {
  const v = window.location.hash.replace(/^#\/?/, '');
  if (v === 'home') return 'region'; // the landing page now lives at the top of the Region page
  return ALL.includes(v) ? v : 'region';
};

const NavContext = createContext(null);

export function NavProvider({ children }) {
  const [view, setView] = useState(readHash);
  const focusNext = useRef(false); // move focus to the new view's heading (not on first load)

  useEffect(() => {
    const onHash = () => { setView(readHash()); focusNext.current = true; };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // go('climate') moves focus to the new view's heading; { top: true } just scrolls to the top.
  const go = useCallback((v, { top = false } = {}) => {
    focusNext.current = !top;
    if (top) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (`#/${v}` !== window.location.hash) window.location.hash = `/${v}`;
    setView(v);
  }, []);

  const lastJourney = useRef('region'); // where "Journey" in the nav bar returns to
  if (JOURNEY.includes(view)) lastJourney.current = view;

  const index = JOURNEY.indexOf(view);
  const value = {
    view, go, focusNext, index, lastJourney: lastJourney.current,
    prev: index > 0 ? JOURNEY[index - 1] : null,
    next: index >= 0 && index < JOURNEY.length - 1 ? JOURNEY[index + 1] : null,
  };
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export const useNav = () => useContext(NavContext);

/** Move focus + scroll to the view heading after a navigation (keyboard & screen-reader friendly). */
export function useFocusHeading(ref, { scrollTo } = {}) {
  const { focusNext } = useNav();
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    const target = (scrollTo && document.getElementById(scrollTo)) || null;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    ref.current?.focus({ preventScroll: true });
  }, [focusNext, ref, scrollTo]);
}
