// PAGE 3.1 — Your top 4 recommended crop rotations.
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useNav } from '../state/NavContext';
import { useAnalysis } from '../state/AnalysisContext';
import { fmtInt } from '../utils/format';
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
              <span aria-hidden="true">🎲</span> {t('top.confidence', { pct: ranking.monteCarlo.rank1StaysFirstPct })}
              <span className="sr-only">({t('top.runs', { n: ranking.monteCarlo.runs })})</span>
            </span>
            <span className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={() => go('compare')}>⚖️ {t('top.compare')}</button>
            <ExportButton label={t('top.print')} />
          </div>

          <section className="card glance" aria-labelledby="glance-title">
            <h3 className="card-title" id="glance-title">{t('top.glance')}</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t('top.rotation')}</th><th scope="col">{t('rank.score')}</th>
                    <th scope="col">💧 {t('rank.water')}</th><th scope="col">🌾 {t('rank.ndvi')}</th>
                    <th scope="col">🧪 {t('rank.fert3')}</th><th scope="col">💰 {t('rank.income')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.rotations.map(r => (
                    <tr key={r.rank} className={r.rank === 1 ? 'is-best-row' : ''}>
                      <th scope="row"><a href={`#rk-${r.rank}`} onClick={e => { e.preventDefault(); document.getElementById(`rk-${r.rank}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                        #{r.rank} {r.crops.join(' → ')}</a></th>
                      <td><b>{r.scores.final}</b></td><td>{r.waterNeed}</td><td>{r.ndviStability}</td>
                      <td>{r.fertilizer} kg/ha</td><td>{fmtInt(r.income)} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rank-list">
            {ranking.rotations.map(r => <RotationCard key={r.rank} r={r} allowedNames={allowedNames} />)}
          </div>
        </>
      )}

      <PageNav back="monthly" next="avoid" />
    </section>
  );
}
