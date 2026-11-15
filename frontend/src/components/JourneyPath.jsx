// "From your field to a three-year plan": the 4 stages of the journey, with where the farmer is now.
import { ArrowRight, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useT } from '../i18n/I18nContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { JOURNEY, PHASES, useNav } from '../state/NavContext';
import './JourneyPath.css';

export default function JourneyPath({ onStart }) {
  const t = useT();
  const { go, lastJourney } = useNav();
  const reduced = useReducedMotion();
  const reached = JOURNEY.indexOf(lastJourney);

  return (
    <section className="wrap home-path" aria-labelledby="path-title">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 22 }}
        whileInView={reduced ? false : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="label">{t('home.pathKicker')}</span>
        <h2 id="path-title" className="h1">{t('home.pathTitle')}</h2>
      </motion.div>
      <ol className="path">
        {PHASES.map((ph, i) => {
          const first = JOURNEY.indexOf(ph.steps[0]);
          const last = JOURNEY.indexOf(ph.steps.at(-1));
          const state = reached > last ? 'done' : reached >= first ? 'current' : 'next';
          const open = () => (ph.id === 'setup' && onStart ? onStart() : go(ph.steps[0]));
          return (
            <motion.li
              key={ph.id}
              className={`path-stop ${state}`}
              initial={reduced ? false : { opacity: 0, y: 28 }}
              whileInView={reduced ? false : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="path-marker"
                aria-hidden="true"
                initial={reduced ? false : { scale: 0.7, opacity: 0 }}
                whileInView={reduced ? false : { scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.1 + i * 0.12 }}
              >
                {state === 'done' ? <Check size={16} strokeWidth={2.5} /> : i + 1}
              </motion.span>
              <div className="path-body">
                <span className="label">{t(`home.state.${state}`)}</span>
                <h3>{t(`phase.${ph.id}`)}</h3>
                <p>{t(`home.desc.${ph.id}`)}</p>
                <ul className="path-steps">{ph.steps.map(s => <li key={s}>{t(`step.${s}`)}</li>)}</ul>
                <button type="button" className={state === 'current' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={open}>
                  {t('home.open')} <ArrowRight size={14} className="flip" aria-hidden="true" />
                </button>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
