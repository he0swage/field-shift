// Additional view — detailed Usual vs Rank 1 comparison (side by side + nitrogen trajectory + Strategy Sandbox).
import { useState } from 'react';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { fmtInt, pct } from '../utils/format';
import { evaluateCustomStrategy } from '../utils/localEngine';
import { FAMILIES } from '../data/crops';
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
  const best = ranking?.rotations?.[0];
  if (!best) return null;
  return (
    <section className="card" aria-labelledby="n-title">
      <h3 className="card-title" id="n-title">{t('n.title')}</h3>
      <p className="card-sub">{t('n.sub')}</p>
      <NitrogenChart years={best.years} usualEnd={ranking.usual?.soilNEnd} fixedWidth={fixedWidth}
        labels={{
          aria: t('n.aria', { a: best.years?.[0]?.soilN ?? 0, b: best.years?.at(-1)?.soilN ?? 0, u: ranking.usual?.soilNEnd ?? '—' }),
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
  const { state, crops } = useFarm();
  const { ranking } = useAnalysis();
  const usual = useUsual();
  const [testRot, setTestRot] = useState(() => (state.rotation?.length ? [...state.rotation] : ['durum', 'lentil', 'barley']));

  const customEval = evaluateCustomStrategy({
    region: state.region,
    rotation: testRot,
    custom: state.custom,
    priorities: state.priorities,
    scenario: state.scenario,
    baselineNpk: ranking?.rotations?.[0]?.fertilizer,
  });

  return (
    <section aria-labelledby="cmp-title">
      <PageHead id="cmp-title" eyebrow={t('eyebrow.extra')} title={t('cmp.title')} sub={t('cmp.sub')} />
      {!ranking ? <NeedsAnalysis /> : (
        <>
          <SampleNotice data={ranking} />

          {/* Problematic #2: Interactive Strategy Sandbox ("What if I plant X then Y?") */}
          <div className="card" style={{ marginBottom: 24, background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <div>
                <strong style={{ fontSize: '1rem' }}>🧪 Strategy Sandbox (“What if I plant X then Y?”)</strong>
                <p className="hint" style={{ margin: '2px 0 0' }}>
                  Test any sequence to compare its aggregate risk (water stress, erosion, nitrogen balance) against your baseline.
                </p>
              </div>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: customEval.passesRules ? 'var(--primary-soft)' : 'var(--danger-soft)',
                  color: customEval.passesRules ? 'var(--primary-strong)' : 'var(--danger)',
                }}
              >
                {customEval.passesRules ? '✓ Passes Agronomic Rules' : '⚠️ Violates Rotation Rules'}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '8px 0 12px' }}>
              {testRot.map((cid, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {idx > 0 && <span aria-hidden="true" style={{ fontWeight: 700 }}>→</span>}
                  <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Yr {idx + 1}:</label>
                  <select
                    className="select"
                    value={cid}
                    aria-label={`Test strategy year ${idx + 1}`}
                    onChange={e => {
                      const next = [...testRot];
                      next[idx] = e.target.value;
                      setTestRot(next);
                    }}
                    style={{ padding: '4px 8px', fontSize: '0.88rem' }}
                  >
                    {FAMILIES.map(f => {
                      const list = crops.filter(c => c.family === f);
                      return list.length ? (
                        <optgroup key={f} label={t(`family.${f}`)}>
                          {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      ) : null;
                    })}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, fontSize: '0.85rem' }}>
              <span><b>Score:</b> {customEval.score}/100</span>
              <span><b>Water Need:</b> {customEval.waterNeed}/100</span>
              <span><b>Erosion Risk:</b> {customEval.erosionRisk}%</span>
              <span><b>Net N Impact:</b> {customEval.netNitrogenBalance > 0 ? `+${customEval.netNitrogenBalance}` : customEval.netNitrogenBalance} kg/ha</span>
              <span><b>3-Yr NPK:</b> {customEval.fertilizer} kg/ha</span>
            </div>
            <p className="hint" style={{ margin: '8px 0 0', fontSize: '0.83rem' }}>
              💡 <b>Sandbox Rule Trace:</b> {customEval.ruleTrace}
            </p>
          </div>

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
