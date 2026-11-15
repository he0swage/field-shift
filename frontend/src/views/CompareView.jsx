// Additional view — detailed Usual vs Rank 1 comparison (side by side + nitrogen trajectory).
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { fmtInt, pct } from '../utils/format';
import Icon from '../components/icons';
import { PageHead, PageNav, SampleNotice } from '../components/ui';
import { compareRows } from '../components/rotation/CompareTable';
import FieldStrips from '../components/FieldStrips';
import CountUp from '../components/CountUp';
import NitrogenChart from '../components/charts/NitrogenChart';
import NeedsAnalysis from '../components/NeedsAnalysis';
import './Results.css';

export function NitrogenCard({ ranking, fixedWidth }) {
  const t = useT();
  const best = ranking.rotations[0];
  return (
    <section className="card" aria-labelledby="n-title">
      <h3 className="card-title" id="n-title">{t('n.title')}</h3>
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
            <div className="vs-col">
              <span className="label">{t('cmp.usualTitle')}</span>
              <FieldStrips years={usual.map(c => ({ crop: c.name, family: c.family }))} size="sm" />
            </div>
            <div className="vs-col rec">
              <span className="label">{t('cmp.recTitle')}</span>
              <FieldStrips years={ranking.rotations[0].years} size="sm" />
            </div>
          </div>

          {!ranking.usual ? <p className="hint">{t('cmp.noUsual')}</p> : (
            <ol className="vs-rows">
              {compareRows(ranking).map(row => {
                const d = row.b - row.a, better = row.goal === 'lower' ? d < 0 : d > 0, p = pct(row.a, row.b);
                const tone = d === 0 ? 'same' : better ? 'better' : 'worse';
                return (
                  <li key={row.id} className={`vs-row ${tone}`}>
                    <span className="vs-metric"><Icon name={row.icon} size={18} /> {t(`cmp.${row.id}`)}</span>
                    <span className="vs-val num">{fmtInt(row.a)}<small>{row.unit}</small></span>
                    <span className="vs-val rec num">{fmtInt(row.b)}<small>{row.unit}</small></span>
                    <span className="vs-diff num" dir="ltr">
                      {d === 0 ? '±0' : <>{d > 0 ? '+' : '−'}<CountUp value={Math.abs(d)} /></>}
                      <small>{d === 0 ? t('cmp.same') : row.a === 0 ? (better ? t('cmp.betterWord') : t('cmp.worseWord')) : `${better ? t('cmp.better') : t('cmp.worse')} ${Math.abs(p)}%`}</small>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {ranking.sample && <p className="hint">{t('cmp.sampleNote')}</p>}
          <div className="section"><NitrogenCard ranking={ranking} /></div>
        </>
      )}
      <PageNav back="top" backLabel={t('cmp.backRecs')} />
    </section>
  );
}
