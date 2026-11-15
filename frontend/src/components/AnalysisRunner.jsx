// "🔍 Analyse & Rank Rotations" button with its validation, loading and success states.
// Used on the strategy page and in the empty state of the recommendations page.
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { useNav } from '../state/NavContext';
import { useToast } from '../state/ToastContext';
import { cropProblems } from '../utils/agronomy';
import { total } from '../utils/priorities';
import { Alert } from './ui';

const STAGES = ['run.s1', 'run.s2', 'run.s3', 'run.s4'];

/** All blocking problems, as i18n keys. */
export function useInputProblems() {
  const { state, cropById } = useFarm();
  const p = cropProblems(state.allowed, cropById);
  const sum = total(state.priorities);
  if (sum !== 100) p.unshift({ key: 'err.total', vars: { n: sum } });
  return p;
}

export default function AnalysisRunner({ showView = true }) {
  const t = useT();
  const { go } = useNav();
  const toast = useToast();
  const { status, run, stale, ranking } = useAnalysis();
  const problems = useInputProblems();
  const [tried, setTried] = useState(false);
  const [stage, setStage] = useState(0);
  const errRef = useRef(null);
  const loading = status === 'loading';

  // Walk through the modelling stages while the engine runs
  useEffect(() => {
    if (!loading) { setStage(0); return undefined; }
    const id = setInterval(() => setStage(s => Math.min(STAGES.length - 1, s + 1)), 450);
    return () => clearInterval(id);
  }, [loading]);

  const onRun = async () => {
    setTried(true);
    if (problems.length) { setTimeout(() => errRef.current?.focus(), 0); return; }
    await run();
    toast(t('run.toast'));
  };

  return (
    <div className="runner">
      <button type="button" className="btn btn-primary btn-lg" onClick={onRun} disabled={loading} aria-describedby="runner-status">
        {loading ? <span className="spinner" aria-hidden="true" /> : <span aria-hidden="true">🔍</span>}
        {loading ? t('run.loading') : ranking && !stale ? t('run.again') : t('run.button')}
      </button>

      <div id="runner-status" aria-live="polite">
        {tried && problems.length > 0 && !loading && (
          <div ref={errRef} tabIndex={-1} className="runner-msg">
            <Alert tone="bad" title={t('run.blocked')}>
              <ul>{problems.map(p => <li key={p.key}>{t(p.key, p.vars)}</li>)}</ul>
            </Alert>
          </div>
        )}
        {loading && (
          <ol className="run-stages">
            {STAGES.map((k, i) => (
              <li key={k} className={i < stage ? 'done' : i === stage ? 'now' : ''}>
                <span className="run-icon" aria-hidden="true">{i < stage ? '✓' : ''}</span>{t(k)}
              </li>
            ))}
          </ol>
        )}
        {!loading && status === 'done' && ranking && !stale && (
          <div className="runner-msg">
            <Alert tone="good" title={t('run.doneTitle')}>
              {t('run.doneText', { pct: ranking.monteCarlo.rank1StaysFirstPct })}{' '}
              {showView && <button type="button" className="btn-link" onClick={() => go('top')}>{t('run.view')}</button>}
            </Alert>
          </div>
        )}
        {!loading && stale && (
          <div className="runner-msg"><Alert tone="warn">{t('run.stale')}</Alert></div>
        )}
      </div>
    </div>
  );
}
