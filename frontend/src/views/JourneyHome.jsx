// Journey home: title, short subtitle, primary start button, field-strip motif — then the 4-stage path.
import { ArrowRight, Check } from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { JOURNEY, PHASES, useNav } from '../state/NavContext';
import Contours from '../components/Contours';
import FieldScene from '../components/FieldScene';
import './JourneyHome.css';

export default function JourneyHome() {
  const t = useT();
  const { go, lastJourney } = useNav();
  const reached = JOURNEY.indexOf(lastJourney);
  const started = reached > 0;

  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <Contours />
        <div className="wrap home-hero-grid">
          <div className="home-copy">
            <span className="label">{t('home.kicker')}</span>
            <h1 id="home-title" className="display">{t('home.title')}</h1>
            <p className="home-sub">{t('home.sub')}</p>
            <div className="row home-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => go(started ? lastJourney : 'region')}>
                {started ? t('home.continue') : t('home.start')} <ArrowRight size={18} className="flip" aria-hidden="true" />
              </button>
              <button type="button" className="btn-link" onClick={() => go('about')}>{t('home.how')}</button>
            </div>
          </div>
          <div className="home-visual">
            <FieldScene hint={t('hero.dragHint')} yearLabel={n => t('common.year', { n })} />
          </div>
        </div>
      </section>

      <section className="wrap home-path reveal" aria-labelledby="path-title">
        <span className="label">{t('home.pathKicker')}</span>
        <h2 id="path-title" className="h1">{t('home.pathTitle')}</h2>
        <ol className="path">
          {PHASES.map((ph, i) => {
            const first = JOURNEY.indexOf(ph.steps[0]);
            const last = JOURNEY.indexOf(ph.steps.at(-1));
            const state = reached > last ? 'done' : reached >= first ? 'current' : 'next';
            return (
              <li key={ph.id} className={`path-stop ${state}`}>
                <span className="path-marker" aria-hidden="true">{state === 'done' ? <Check size={16} strokeWidth={2.5} /> : i + 1}</span>
                <div className="path-body">
                  <span className="label">{t(`home.state.${state}`)}</span>
                  <h3>{t(`phase.${ph.id}`)}</h3>
                  <p>{t(`home.desc.${ph.id}`)}</p>
                  <ul className="path-steps">{ph.steps.map(s => <li key={s}>{t(`step.${s}`)}</li>)}</ul>
                  <button type="button" className={state === 'current' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => go(ph.steps[0])}>
                    {t('home.open')} <ArrowRight size={14} className="flip" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
