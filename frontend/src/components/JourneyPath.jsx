// "From your field to a three-year plan": the 4 stages of the journey, with where the farmer is now.
import { ArrowRight, Check } from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { JOURNEY, PHASES, useNav } from '../state/NavContext';
import './JourneyPath.css';

export default function JourneyPath({ onStart }) {
  const t = useT();
  const { go, lastJourney } = useNav();
  const reached = JOURNEY.indexOf(lastJourney);

  return (
    <section className="wrap home-path reveal" aria-labelledby="path-title">
      <span className="label">{t('home.pathKicker')}</span>
      <h2 id="path-title" className="h1">{t('home.pathTitle')}</h2>
      <ol className="path">
        {PHASES.map((ph, i) => {
          const first = JOURNEY.indexOf(ph.steps[0]);
          const last = JOURNEY.indexOf(ph.steps.at(-1));
          const state = reached > last ? 'done' : reached >= first ? 'current' : 'next';
          const open = () => (ph.id === 'setup' && onStart ? onStart() : go(ph.steps[0]));
          return (
            <li key={ph.id} className={`path-stop ${state}`}>
              <span className="path-marker" aria-hidden="true">{state === 'done' ? <Check size={16} strokeWidth={2.5} /> : i + 1}</span>
              <div className="path-body">
                <span className="label">{t(`home.state.${state}`)}</span>
                <h3>{t(`phase.${ph.id}`)}</h3>
                <p>{t(`home.desc.${ph.id}`)}</p>
                <ul className="path-steps">{ph.steps.map(s => <li key={s}>{t(`step.${s}`)}</li>)}</ul>
                <button type="button" className={state === 'current' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={open}>
                  {t('home.open')} <ArrowRight size={14} className="flip" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
