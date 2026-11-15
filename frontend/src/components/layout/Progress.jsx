// Journey sidebar: 4 phases, 8 steps (vertical on desktop, compact bar on small screens) + data status.
import { Check } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { JOURNEY, PHASES, useNav } from '../../state/NavContext';
import { DataStatus } from './Header';
import './layout.css';

export default function Progress() {
  const t = useT();
  const { view, go, index, lastJourney } = useNav();
  const current = index >= 0 ? index : JOURNEY.indexOf(lastJourney);
  const pct = ((current + 1) / JOURNEY.length) * 100;

  return (
    <aside className="sidebar">
      <nav aria-label={t('progress.label')}>
        <div className="progress-compact">
          <span>{t('progress.stage', { n: current + 1, total: JOURNEY.length })}</span>
          <b>{t(`step.${JOURNEY[current]}`)}</b>
          <div className="progress-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        </div>
        <ol className="phases">
          {PHASES.map(ph => (
            <li key={ph.id} className="phase">
              <span className="phase-name">{t(`phase.${ph.id}`)}</span>
              <ol className="steps">
                {ph.steps.map(s => {
                  const i = JOURNEY.indexOf(s);
                  const done = i < current;
                  const active = s === view;
                  return (
                    <li key={s}>
                      <button type="button" onClick={() => go(s)} aria-current={active ? 'step' : undefined}
                        className={`${done ? 'done' : ''}${active ? ' active' : ''}`}>
                        <span className="step-marker" aria-hidden="true">{done ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                        <span className="step-label">{t(`step.${s}`)}</span>
                        {done && <span className="sr-only"> ({t('progress.done')})</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </nav>
      <DataStatus />
    </aside>
  );
}
