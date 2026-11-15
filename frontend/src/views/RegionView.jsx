// Region page (start of the journey). Top: title, description and the 3-year plan (field strips).
// Bottom of the hero: a search bar (acts as a button) with half of the globe peeking beside it —
// hovering or clicking it scrolls to "Current regions" while the globe glides into its final place.
// Below: "Current regions" — region cards + the interactive globe.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, Search } from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { useFocusHeading } from '../state/NavContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { REGIONS, REGION_IDS, fmtCoord } from '../data/regions';
import { PageNav } from '../components/ui';
import Contours from '../components/Contours';
import FieldScene from '../components/FieldScene';
import CountUp from '../components/CountUp';
import Globe from '../components/globe/Globe';
import GlobePeek from '../components/globe/GlobePeek';
import '../components/globe/Globe.css';
import './RegionView.css';

const GLOBE_REGIONS = REGION_IDS.map(id => ({ id, ...REGIONS[id] }));
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

export default function RegionView() {
  const t = useT();
  const { state, set, cropById } = useFarm();
  const { ranking, stale } = useAnalysis();
  const reduced = useReducedMotion();
  const [focusTick, setFocusTick] = useState(0);
  const [flying, setFlying] = useState(false);
  const cardRefs = useRef({});
  const titleRef = useRef(null);
  const peekRef = useRef(null);
  const sectionRef = useRef(null);
  const hoverTimer = useRef(null);
  useFocusHeading(titleRef);

  const choose = useCallback(id => {
    set({ region: id });
    setFocusTick(n => n + 1);
  }, [set]);

  // Radiogroup keyboard pattern: arrows move + select
  const onKey = (e, i) => {
    if (e.key === ' ') e.preventDefault();
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const id = REGION_IDS[(i + d + REGION_IDS.length) % REGION_IDS.length];
    choose(id);
    cardRefs.current[id]?.focus();
  };

  /* Search bar → scroll to "Current regions"; the peeking globe glides into the real globe's place. */
  const goToRegions = useCallback(() => {
    const section = sectionRef.current;
    if (!section || flying) return;
    const target = section.querySelector('.globe canvas');
    const peek = peekRef.current;
    if (reduced || !target || !peek) {
      section.scrollIntoView({ behavior: 'auto', block: 'start' });
      section.querySelector('h2')?.focus({ preventScroll: true });
      return;
    }
    const from = peek.getBoundingClientRect();
    const ghost = peek.cloneNode(true);
    ghost.classList.add('globe-ghost');
    Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.appendChild(ghost);
    setFlying(true);
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const t0 = performance.now(), DUR = 1100;
    const step = now => {
      const k = Math.min(1, (now - t0) / DUR), e = ease(k);
      const to = target.getBoundingClientRect();
      ghost.style.left = `${from.left + (to.left - from.left) * e}px`;
      ghost.style.top = `${from.top + (to.top - from.top) * e}px`;
      ghost.style.width = `${from.width + (to.width - from.width) * e}px`;
      ghost.style.height = `${from.height + (to.height - from.height) * e}px`;
      if (k < 1) requestAnimationFrame(step);
      else {
        ghost.remove();
        setFlying(false);
        section.querySelector('h2')?.focus({ preventScroll: true });
      }
    };
    requestAnimationFrame(step);
  }, [flying, reduced]);

  const onHover = () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(goToRegions, 250); };
  const offHover = () => clearTimeout(hoverTimer.current);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // The 3-year plan: rank 1 once the analysis has run, otherwise the farmer's usual rotation
  const usePlan = ranking && !stale;
  const planYears = usePlan
    ? ranking.rotations[0].years.map(y => ({ crop: y.crop, family: y.family }))
    : state.rotation.map(id => ({ crop: cropById(id)?.name, family: cropById(id)?.family }));

  const labelFor = useCallback(r => t(`region.${r.id}.name`), [t]);
  const selected = { id: state.region, ...REGIONS[state.region] };

  return (
    <>
      <section className="region-hero" aria-labelledby="region-hero-title">
        <Contours />
        <div className="wrap region-hero-grid">
          <div className="region-hero-copy">
            <span className="label">{t('eyebrow.setup', { n: 1 })}</span>
            <h1 id="region-hero-title" ref={titleRef} tabIndex={-1} className="display">{t('home.title')}</h1>
            <p className="region-hero-sub">{t('home.sub')}</p>
          </div>
          <figure className="plan">
            <figcaption className="plan-caption">
              <span className="label">{t('plan.kicker')}</span>
              <span className="plan-title">{usePlan ? t('plan.recommended') : t('plan.usual')}</span>
            </figcaption>
            <div className="plan-scene">
              <FieldScene hint={t('hero.dragHint')} yearLabel={n => t('common.year', { n })} years={planYears} />
            </div>
          </figure>
        </div>

        <div className="wrap region-hero-bottom">
          <button type="button" className="region-search" onMouseEnter={onHover} onMouseLeave={offHover} onFocus={offHover}
            onClick={() => { offHover(); goToRegions(); }} aria-describedby="region-search-hint">
            <Search size={22} aria-hidden="true" />
            <span className="region-search-text">{t('regionSearch.placeholder')}</span>
            <ArrowDown size={20} aria-hidden="true" className="region-search-go" />
          </button>
          <span id="region-search-hint" className="sr-only">{t('regionSearch.hint')}</span>
          <div className={`globe-peek${flying ? ' flying' : ''}`} aria-hidden="true">
            <GlobePeek ref={peekRef} lat={selected.lat} lon={selected.lon} />
          </div>
        </div>
      </section>

      <section ref={sectionRef} id="current-regions" className={`wrap current-regions${flying ? ' globe-arriving' : ''}`} aria-labelledby="region-title">
        <header className="page-head">
          <span className="eyebrow">{t('eyebrow.setup', { n: 1 })}</span>
          <h2 id="region-title" tabIndex={-1}>{t('regionSearch.title')}</h2>
          <p className="sub">{t('region.sub')}</p>
        </header>

        <div className="region-layout">
          <div className="region-list" role="radiogroup" aria-label={t('region.listLabel')}>
            {GLOBE_REGIONS.map((r, i) => {
              const on = r.id === state.region;
              return (
                <div key={r.id} ref={el => { cardRefs.current[r.id] = el; }}
                  className={`region-card${on ? ' selected' : ''}`} role="radio" aria-checked={on}
                  tabIndex={on ? 0 : -1} onClick={() => choose(r.id)} onKeyDown={e => onKey(e, i)}
                  onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') choose(r.id); }}>
                  <div className="rc-top">
                    <div>
                      <h3>{t(`region.${r.id}.name`)}</h3>
                      <p className="rc-country">{t(`country.${r.countryCode}`)}</p>
                    </div>
                    <span className="rc-check" aria-hidden="true">{on && <Check size={16} strokeWidth={2.5} />}</span>
                  </div>
                  <div className="stat md">
                    <span className="label">{t('region.rain')}</span>
                    <span className="value">{r.est.includes('rain') ? '≈' : ''}<CountUp value={r.rain} /><small>mm/{t('unit.yr')}</small></span>
                  </div>
                </div>
              );
            })}
            <p className="hint">{t('region.more')}</p>
          </div>

          <div className="globe-panel">
            <Globe regions={GLOBE_REGIONS} selectedId={state.region} focusTick={focusTick} onSelect={choose} labelFor={labelFor}>
              <div className="globe-info" aria-live="polite" key={selected.id}>
                <span className="label">{t(`country.${selected.countryCode}`)}</span>
                <h3>{t(`region.${selected.id}.name`)}</h3>
                <p className="gi-coords num" dir="ltr">{fmtCoord(selected.lat, selected.lon)}</p>
                <p className="gi-climate">{t(`region.${selected.id}.climate`)}</p>
                {selected.est.includes('rain') && <p className="gi-est">{t('region.estNote')}</p>}
              </div>
            </Globe>
          </div>
        </div>

        <PageNav next="strategy" />
      </section>
    </>
  );
}
