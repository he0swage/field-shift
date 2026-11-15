// Journey progress indicator: 4 phases, 8 stages. Active stage is highlighted, completed ones ticked.
import { useT } from '../../i18n/I18nContext';
import { JOURNEY, PHASES, useNav } from '../../state/NavContext';
import './layout.css';

export default function Progress() {
  const t = useT();
  const { view, go, index } = useNav();
  if (index < 0) return null;
  const pct = ((index + 1) / JOURNEY.length) * 100;

  return (
    <nav className="progress" aria-label={t('progress.label')}>
      <div className="wrap">
        <p className="progress-mobile">
          {t('progress.stage', { n: index + 1, total: JOURNEY.length })} · <b>{t(`step.${view}`)}</b>
        </p>
        <ol className="phases">
          {PHASES.map((ph, pi) => {
            const active = ph.steps.includes(view);
            const done = JOURNEY.indexOf(ph.steps.at(-1)) < index;
            return (
              <li key={ph.id} className={`phase${active ? ' active' : ''}${done ? ' done' : ''}`}>
                <span className="phase-name"><span className="phase-num" aria-hidden="true">{done ? '✓' : pi + 1}</span>{t(`phase.${ph.id}`)}</span>
                <ol className="phase-steps">
                  {ph.steps.map(s => {
                    const i = JOURNEY.indexOf(s);
                    return (
                      <li key={s}>
                        <button type="button" onClick={() => go(s)} aria-current={s === view ? 'step' : undefined}
                          className={i < index ? 'done' : ''}>
                          <span className="step-dot" aria-hidden="true" />
                          <span className="step-label">{t(`step.${s}`)}</span>
                          {i < index && <span className="sr-only"> ({t('progress.done')})</span>}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>
        <div className="progress-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      </div>
    </nav>
  );
}
