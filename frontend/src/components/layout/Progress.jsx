// Stepper: the 4 stages of the journey. Sub-steps appear only inside the active stage.
// Completed steps get a check; the current step is filled.
import { Check } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { JOURNEY, PHASES, useNav } from '../../state/NavContext';
import './layout.css';

export default function Progress() {
  const t = useT();
  const { view, go, index } = useNav();

  return (
    <nav className="stepper" aria-label={t('progress.label')}>
      <ol className="wrap stages">
        {PHASES.map((ph, pi) => {
          const first = JOURNEY.indexOf(ph.steps[0]);
          const last = JOURNEY.indexOf(ph.steps.at(-1));
          const active = index >= first && index <= last;
          const done = index > last;
          return (
            <li key={ph.id} className={`stage${active ? ' active' : ''}${done ? ' done' : ''}`}>
              <button type="button" className="stage-btn" onClick={() => go(ph.steps[0])} aria-current={active ? 'step' : undefined}>
                <span className="stage-marker" aria-hidden="true">{done ? <Check size={14} strokeWidth={2.5} /> : pi + 1}</span>
                <span className="stage-name">{t(`phase.${ph.id}`)}</span>
                {done && <span className="sr-only"> ({t('progress.done')})</span>}
              </button>
              {active && ph.steps.length > 1 && (
                <ol className="substeps">
                  {ph.steps.map(s => {
                    const i = JOURNEY.indexOf(s);
                    return (
                      <li key={s}>
                        <button type="button" onClick={() => go(s)} aria-current={s === view ? 'page' : undefined}
                          className={i < index ? 'done' : s === view ? 'current' : ''}>
                          <span className="sub-dot" aria-hidden="true">{i < index && <Check size={10} strokeWidth={3} />}</span>
                          {t(`step.${s}`)}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
