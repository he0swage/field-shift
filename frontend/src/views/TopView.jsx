// PAGE 3.1 — Your top 4 recommended crop rotations.
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useNav } from '../state/NavContext';
import { useAnalysis } from '../state/AnalysisContext';
import { Scale, Shuffle } from 'lucide-react';
import { Alert, PageHead, PageNav, RegionStrip, SampleNotice } from '../components/ui';
import RotationCard from '../components/rotation/RotationCard';
import NeedsAnalysis from '../components/NeedsAnalysis';
import AnalysisRunner from '../components/AnalysisRunner';
import ExportButton from '../components/ExportButton';
import './Results.css';

export default function TopView() {
  const t = useT();
  const { go } = useNav();
  const { state, cropById } = useFarm();
  const { ranking, stale } = useAnalysis();
  const allowedNames = state.allowed.map(id => cropById(id)?.name).filter(Boolean);

  return (
    <section aria-labelledby="top-title">
      <PageHead id="top-title" eyebrow={t('eyebrow.recs', { n: 1 })} title={t('top.title')} sub={t('top.sub')}>
        <RegionStrip />
      </PageHead>

      {!ranking ? <NeedsAnalysis /> : (
        <>
          <SampleNotice data={ranking} />
          {stale && (
            <div className="card stale-card">
              <Alert tone="warn">{t('run.stale')}</Alert>
              <div style={{ maxWidth: 420, marginTop: 14 }}><AnalysisRunner showView={false} /></div>
            </div>
          )}

          <div className="results-toolbar">
            <span className="badge badge-good badge-lg confidence-badge">
              <Shuffle size={14} aria-hidden="true" /> {t('top.confidence', { pct: ranking.monteCarlo.rank1StaysFirstPct })}
              <span className="sr-only">({t('top.runs', { n: ranking.monteCarlo.runs })})</span>
            </span>
            <span className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={() => go('compare')}><Scale size={16} aria-hidden="true" /> {t('top.compare')}</button>
            <ExportButton label={t('top.print')} />
          </div>

          {ranking.ignoredCrops?.length > 0 && (
            <Alert tone="info">{t('top.ignored', { crops: ranking.ignoredCrops.map(id => cropById(id)?.name || id).join(', ') })}</Alert>
          )}

          <RotationCard r={ranking.rotations[0]} allowedNames={allowedNames} />
          <h3 className="section-title rank-rows-title">{t('top.others')}</h3>
          <div className="rank-rows">
            {ranking.rotations.slice(1).map(r => <RotationCard key={r.rank} r={r} allowedNames={allowedNames} />)}
          </div>

          {ranking.assumptions?.length > 0 && (
            <details className="card assumptions">
              <summary>{t('top.assumptions')}</summary>
              <p className="hint">{ranking.source}</p>
              <ul>{ranking.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
            </details>
          )}
        </>
      )}

      <PageNav back="monthly" next="avoid" />
    </section>
  );
}
