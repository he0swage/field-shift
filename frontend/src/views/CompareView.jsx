// Additional view — detailed Usual vs Rank 1 comparison (side by side + nitrogen trajectory).
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { fmtInt } from '../utils/format';
import { FAMILY_ICON } from '../data/crops';
import { PageHead, PageNav, SampleNotice } from '../components/ui';
import CompareTable from '../components/rotation/CompareTable';
import NitrogenChart from '../components/charts/NitrogenChart';
import NeedsAnalysis from '../components/NeedsAnalysis';
import './Results.css';

export function NitrogenCard({ ranking, fixedWidth }) {
  const t = useT();
  const best = ranking.rotations[0];
  return (
    <section className="card" aria-labelledby="n-title">
      <h3 className="card-title" id="n-title"><span aria-hidden="true">🧪</span> {t('n.title')}</h3>
      <p className="card-sub">{t('n.sub')}</p>
      <NitrogenChart years={best.years} usualEnd={ranking.usual?.soilNEnd} fixedWidth={fixedWidth}
        labels={{
          aria: t('n.aria', { a: best.years[0].soilN, b: best.years.at(-1).soilN, u: ranking.usual?.soilNEnd ?? '—' }),
          year: n => t('common.year', { n }), rec: t('n.rec'), usual: t('n.usualShort'), usualLegend: t('n.usual'),
        }} />
    </section>
  );
}

export function useUsual() {
  const { state, cropById } = useFarm();
  return state.rotation.map(id => cropById(id)).map(c => ({ name: c?.name || '?', family: c?.family }));
}

export default function CompareView() {
  const t = useT();
  const { ranking } = useAnalysis();
  const usual = useUsual();

  return (
    <section aria-labelledby="cmp-title">
      <PageHead id="cmp-title" eyebrow={t('eyebrow.extra')} title={t('cmp.title')} sub={t('cmp.sub')} />
      {!ranking ? <NeedsAnalysis /> : (
        <>
          <SampleNotice data={ranking} />
          <div className="vs-grid">
            <article className="vs-card usual">
              <h3>{t('cmp.usualTitle')}</h3>
              <ol className="vs-crops">{usual.map((c, i) => <li key={i}><span>{t('common.year', { n: i + 1 })}</span>{FAMILY_ICON[c.family]} {c.name}</li>)}</ol>
              <dl className="vs-facts">
                <div><dt>💧 {t('cmp.water')}</dt><dd>{ranking.usual?.waterNeed ?? '—'}/100</dd></div>
                <div><dt>🧪 {t('cmp.soilN')}</dt><dd>{ranking.usual?.soilNEnd ?? '—'} kg/ha</dd></div>
                <div><dt>⚗️ {t('cmp.fert')}</dt><dd>{ranking.usual?.fertilizer ?? '—'} kg/ha</dd></div>
                <div><dt>🌾 {t('cmp.stability')}</dt><dd>{ranking.usual?.ndviStability ?? '—'}/100</dd></div>
                <div><dt>💰 {t('cmp.income')}</dt><dd>{ranking.usual ? fmtInt(ranking.usual.income) : '—'} DA/ha</dd></div>
              </dl>
            </article>
            <div className="vs-badge" aria-hidden="true">VS</div>
            <article className="vs-card rec">
              <h3>{t('cmp.recTitle')}</h3>
              <ol className="vs-crops">{ranking.rotations[0].years.map((y, i) => <li key={i}><span>{t('common.year', { n: i + 1 })}</span>{FAMILY_ICON[y.family]} {y.crop}</li>)}</ol>
              <dl className="vs-facts">
                <div><dt>💧 {t('cmp.water')}</dt><dd>{ranking.rotations[0].waterNeed}/100</dd></div>
                <div><dt>🧪 {t('cmp.soilN')}</dt><dd>{ranking.rotations[0].years.at(-1).soilN} kg/ha</dd></div>
                <div><dt>⚗️ {t('cmp.fert')}</dt><dd>{ranking.rotations[0].fertilizer} kg/ha</dd></div>
                <div><dt>🌾 {t('cmp.stability')}</dt><dd>{ranking.rotations[0].ndviStability}/100</dd></div>
                <div><dt>💰 {t('cmp.income')}</dt><dd>{fmtInt(ranking.rotations[0].income)} DA/ha</dd></div>
              </dl>
            </article>
          </div>

          <section className="card" style={{ marginTop: 24 }} aria-labelledby="cmp-table-title">
            <h3 className="card-title" id="cmp-table-title">{t('cmp.tableTitle')}</h3>
            <CompareTable ranking={ranking} usualName={usual.map(c => c.name).join(' → ')} />
            {ranking.sample && <p className="hint">{t('cmp.sampleNote')}</p>}
          </section>
          <div style={{ marginTop: 24 }}><NitrogenCard ranking={ranking} /></div>
        </>
      )}
      <PageNav back="top" backLabel={t('cmp.backRecs')} />
    </section>
  );
}
