// Region page (start of the journey), in this order:
// 1. title, description, the 3-year plan and an arrow button that scrolls to "Current regions"
// 2. "Current regions" — region cards + the interactive globe
// 3. "From your field to a three-year plan" — the 4 stages
import { useCallback, useRef, useState } from 'react';
import { ArrowDown, Check } from 'lucide-react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { useFocusHeading } from '../state/NavContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { REGIONS, REGION_IDS, fmtCoord } from '../data/regions';
import { PageNav } from '../components/ui';
import Contours from '../components/Contours';
import LivingFarmLandscape from '../components/LivingFarmLandscape';
import CountUp from '../components/CountUp';
import Globe from '../components/globe/Globe';
import JourneyPath from '../components/JourneyPath';
import '../components/globe/Globe.css';
import './RegionView.css';

const GLOBE_REGIONS = REGION_IDS.map(id => ({ id, ...REGIONS[id] }));

export default function RegionView() {
  const t = useT();
  const { state, set, cropById } = useFarm();
  const { ranking, stale } = useAnalysis();
  const reduced = useReducedMotion();
  const [focusTick, setFocusTick] = useState(0);
  const cardRefs = useRef({});
  const titleRef = useRef(null);
  const sectionRef = useRef(null);
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

  // Arrow button → smooth scroll to "Current regions" (instant with reduced motion), focus its heading
  const goToRegions = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => section.querySelector('h2')?.focus({ preventScroll: true }), reduced ? 0 : 600);
  }, [reduced]);

  // The 3-year plan: rank 1 once the analysis has run, otherwise the farmer's usual rotation
  const usePlan = ranking && !stale;
  const planYears = usePlan
    ? ranking.rotations[0].years.map(y => ({ crop: y.crop, family: y.family }))
    : state.rotation.map(id => ({ crop: cropById(id)?.name, family: cropById(id)?.family }));

  const labelFor = useCallback(r => t(`region.${r.id}.name`), [t]);
  const selected = { id: state.region, ...REGIONS[state.region] };

  // Scroll animations: scroll progress + subtle hero parallax
  const { scrollY, scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });
  const heroCopyY = useTransform(scrollY, [0, 400], [0, -22]);
  const heroPlanY = useTransform(scrollY, [0, 400], [0, -12]);

  return (
    <>
      {/* 1. Reading scroll progress bar along top edge */}
      {!reduced && <motion.div className="landing-scroll-progress" style={{ scaleX }} aria-hidden="true" />}

      <section className="region-hero" aria-labelledby="region-hero-title">
        <Contours />
        <div className="wrap region-hero-grid">
          <motion.div
            className="region-hero-copy"
            style={reduced ? {} : { y: heroCopyY }}
            initial={reduced ? false : { opacity: 0, y: 22 }}
            animate={reduced ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="label">{t('eyebrow.setup', { n: 1 })}</span>
            <h1 id="region-hero-title" ref={titleRef} tabIndex={-1} className="display">{t('home.title')}</h1>
            <p className="region-hero-sub">{t('home.sub')}</p>
          </motion.div>
          <motion.figure
            className="plan"
            style={reduced ? {} : { y: heroPlanY }}
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 20 }}
            animate={reduced ? false : { opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <figcaption className="plan-caption">
              <span className="label">{t('plan.kicker')}</span>
              <span className="plan-title">{usePlan ? t('plan.recommended') : t('plan.usual')}</span>
            </figcaption>
            <div className="plan-scene">
              <LivingFarmLandscape years={planYears} />
            </div>
          </motion.figure>
        </div>

        <div className="wrap region-hero-bottom">
          <button type="button" className="hero-arrow" onClick={goToRegions}>
            <span>{t('regionSearch.cta')}</span>
            <span className="hero-arrow-circle" aria-hidden="true"><ArrowDown size={26} /></span>
          </button>
        </div>
      </section>

      <section ref={sectionRef} id="current-regions" className="wrap current-regions" aria-labelledby="region-title">
        <motion.header
          className="page-head"
          initial={reduced ? false : { opacity: 0, y: 26 }}
          whileInView={reduced ? false : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="eyebrow">{t('eyebrow.setup', { n: 1 })}</span>
          <h2 id="region-title" tabIndex={-1}>{t('regionSearch.title')}</h2>
          <p className="sub">{t('region.sub')}</p>
        </motion.header>

        <div className="region-layout">
          <div className="region-list" role="radiogroup" aria-label={t('region.listLabel')}>
            {GLOBE_REGIONS.map((r, i) => {
              const on = r.id === state.region;
              return (
                <motion.div
                  key={r.id}
                  ref={el => { cardRefs.current[r.id] = el; }}
                  className={`region-card${on ? ' selected' : ''}`}
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => choose(r.id)}
                  onKeyDown={e => onKey(e, i)}
                  onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') choose(r.id); }}
                  initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
                  whileInView={reduced ? false : { opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={reduced ? undefined : { y: -3, transition: { duration: 0.2 } }}
                >
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
                </motion.div>
              );
            })}
            <p className="hint">{t('region.more')}</p>
          </div>

          <motion.div
            className="globe-panel"
            initial={reduced ? false : { opacity: 0, scale: 0.95, y: 30 }}
            whileInView={reduced ? false : { opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Globe regions={GLOBE_REGIONS} selectedId={state.region} focusTick={focusTick} onSelect={choose} labelFor={labelFor}>
              <div className="globe-info" aria-live="polite" key={selected.id}>
                <span className="label">{t(`country.${selected.countryCode}`)}</span>
                <h3>{t(`region.${selected.id}.name`)}</h3>
                <p className="gi-coords num" dir="ltr">{fmtCoord(selected.lat, selected.lon)}</p>
                <p className="gi-climate">{t(`region.${selected.id}.climate`)}</p>
                {selected.est.includes('rain') && <p className="gi-est">{t('region.estNote')}</p>}
              </div>
            </Globe>
          </motion.div>
        </div>

      </section>

      <JourneyPath onStart={goToRegions} />

      <div className="wrap region-pagenav"><PageNav next="strategy" /></div>
    </>
  );
}
