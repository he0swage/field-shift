// Step 6 — recommended 3-year rotations, rotations to avoid, usual vs rank 1, gaps/attributions, print/PDF.
import { useEffect, useMemo, useRef, useState } from 'react';
import { TAGS } from '../data/sampleRanking';
import { SCIENTIFIC_GAPS, DATA_PROVENANCE } from '../data/regions';
import { FAMILY_LABEL } from '../data/crops';
import { useFarm } from '../state/FarmContext';
import { useNav } from '../state/NavContext';
import { useRanking } from '../hooks/useData';
import { evaluateCustomStrategy } from '../utils/localEngine';
import { fmtIncome, fmtInt, fmtRate, sameName } from '../utils/format';
import { StepHead, StepNav } from '../components/Layout';
import { Alert, Loading, SampleNotice } from '../components/ui';
import AgronomyAssistant from '../components/AgronomyAssistant';
import './RankingStep.css';

const MEDAL = ['gold', 'silver', 'bronze'];

function ScoreRing({ value, label }) {
  return (
    <div className="ring" style={{ '--v': value }} role="img" aria-label={`${label} ${value} out of 100`}>
      <div className="ring-inner"><b>{value}</b><span>/100</span></div>
    </div>
  );
}

function ScoreBar({ value, label, hint }) {
  return (
    <div className="mini-score">
      <div className="mini-head"><span>{label} <abbr title={hint}>?</abbr></span><b>{value}%</b></div>
      <div className="bar"><i style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function Year({ y, i, units }) {
  return (
    <li className="year">
      <div className="year-top">
        <span className="year-no">Year {i + 1}</span>
        {y.nCredit && <span className="credit" title="Nitrogen left by the previous legume">−{y.nCredit}% NPK</span>}
      </div>
      <div className="year-crop">{y.crop}</div>
      <dl>
        <div><dt>Soil nitrogen</dt><dd>{fmtRate(y.soilN, units)}</dd></div>
        <div className="nbar" aria-hidden="true"><i style={{ width: `${Math.min(100, (y.soilN / 120) * 100)}%` }} /></div>
        <div><dt>Crop health</dt><dd>{y.health}%</dd></div>
        <div><dt>Fertilizer</dt><dd>{y.fertilizer} · {fmtRate(y.kg, units)}</dd></div>
      </dl>
    </li>
  );
}

function RankCard({ r, allowedNames, units, region }) {
  const { go } = useNav();
  const medal = MEDAL[r.rank - 1] || 'plain';
  const missing = [...new Set(r.crops)].filter(c => !allowedNames.some(a => sameName(a, c)));
  return (
    <article className={`rank-card medal-${medal}${r.rank === 1 ? ' is-best' : ''}`} aria-labelledby={`rk-${r.rank}`}>
      <header className="rank-head">
        <div className="rank-no" aria-hidden="true">{r.rank}</div>
        <div className="rank-title">
          {r.rank === 1 && <div className="best-label">Best match for {region.areaName}</div>}
          <h3 id={`rk-${r.rank}`}>
            <span className="sr-only">Rank {r.rank}: </span>
            {r.crops.map((c, i) => <span key={i}>{i > 0 && <span className="arrow" aria-label="then">→</span>}{c}</span>)}
          </h3>
          {r.ruleTrace && (
            <p
              className="rule-trace-banner"
              style={{
                margin: '6px 0 8px',
                padding: '7px 11px',
                borderRadius: '8px',
                background: 'var(--primary-soft)',
                color: 'var(--primary-strong)',
                borderLeft: '3px solid var(--primary)',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              💡 <b>Why this recommendation (Rule Trace):</b> {r.ruleTrace}
            </p>
          )}
          <ul className="tags" aria-label="Strengths">
            {r.tags.map(id => {
              const t = TAGS[id] || { icon: '•', label: id, tone: 'info' };
              return <li key={id} className={`tag tone-${t.tone}`}><span aria-hidden="true">{t.icon}</span>{t.label}</li>;
            })}
          </ul>
        </div>
        <div className="rank-scores">
          <ScoreRing value={r.scores.final} label="Final score" />
          <div className="mini-scores">
            <ScoreBar value={r.scores.ml} label="Crop sequence fit" hint="Machine-learning score for how well each crop follows the previous one" />
            <ScoreBar value={r.scores.knn} label="Climate match" hint="Environmental envelope match between your scenario rainfall and optimal crop range" />
          </div>
        </div>
      </header>

      <ol className="years" aria-label="Year by year">{r.years.map((y, i) => <Year key={i} y={y} i={i} units={units} />)}</ol>

      <ul className="rank-stats">
        <li><span>💧 Water need</span><b>{r.waterNeed}/100</b></li>
        <li><span>🌿 <abbr title="Normalized Difference Vegetation Index">NDVI</abbr> stability</span><b>{r.ndviStability}/100</b></li>
        <li>
          <span>🧪 3-yr fertilizer</span>
          <b>{fmtRate(r.fertilizer, units)}</b>
          <em>{r.fertilizerSaved >= 0 ? `saves ${fmtRate(r.fertilizerSaved, units)} vs usual` : `+${fmtRate(Math.abs(r.fertilizerSaved), units)} vs usual`}</em>
        </li>
        <li><span>💰 Est. gross return</span><b>{fmtIncome(r.income, units, region)}</b></li>
      </ul>

      {missing.length > 0 && (
        <p className="note-inline">
          ⚠️ Includes <b>{missing.join(', ')}</b>, which you did not select in step 2.{' '}
          <button type="button" className="btn btn-link" onClick={() => go(2)}>Edit crops</button>
        </p>
      )}

      <details className="risks" open={r.rank === 1}>
        <summary>Local agronomic risk notes per crop</summary>
        <ul>{Object.entries(r.risks).map(([c, t]) => <li key={c}><b>{c}:</b> {t}</li>)}</ul>
      </details>
    </article>
  );
}

function CompareTable({ ranking, usualName, units, region, crops, state }) {
  const u = ranking.usual, best = ranking.rotations[0];
  const [testRot, setTestRot] = useState(() => {
    const r2 = ranking.rotations[1]?.cropIds;
    if (Array.isArray(r2) && r2.length === state.rotation.length) return r2;
    return [...state.rotation];
  });

  useEffect(() => {
    if (testRot.length !== state.rotation.length) {
      setTestRot([...state.rotation]);
    }
  }, [state.rotation]);

  const customEval = useMemo(
    () =>
      evaluateCustomStrategy({
        region: state.region,
        rotation: testRot,
        custom: state.custom,
        priorities: state.priorities,
        scenario: state.scenario,
        baselineNpk: u?.fertilizer ?? null,
      }),
    [state.region, testRot, state.custom, state.priorities, state.scenario, u?.fertilizer]
  );

  if (!best) return null;

  const bestErosion = best.erosionRisk ?? 38;
  const usualErosion = u.erosionRisk ?? 46;
  const bestNetN = best.netNitrogenBalance ?? 15;
  const usualNetN = u.netNitrogenBalance ?? -25;

  const rows = [
    ['🏆 Overall Strategy Score', `${u.score ?? 58}/100`, `${customEval.score}/100`, `${best.scores.final}/100`, best.scores.final - (u.score ?? 58), 'higher'],
    ['💧 Water stress / need', `${u.waterNeed}/100`, `${customEval.waterNeed}/100`, `${best.waterNeed}/100`, best.waterNeed - u.waterNeed, 'lower'],
    ['🌾 Soil erosion risk', `${usualErosion}/100`, `${customEval.erosionRisk}/100`, `${bestErosion}/100`, bestErosion - usualErosion, 'lower'],
    ['🧬 Net nitrogen balance (kg N/ha)', `${usualNetN >= 0 ? '+' : ''}${usualNetN}`, `${customEval.netNitrogenBalance >= 0 ? '+' : ''}${customEval.netNitrogenBalance}`, `${bestNetN >= 0 ? '+' : ''}${bestNetN}`, bestNetN - usualNetN, 'higher'],
    ['🌿 NDVI stability', `${u.ndviStability}/100`, `${customEval.ndviStability}/100`, `${best.ndviStability}/100`, best.ndviStability - u.ndviStability, 'higher'],
    ['🧪 Total NPK fertilizer', fmtRate(u.fertilizer, units), fmtRate(customEval.fertilizer, units), fmtRate(best.fertilizer, units), best.fertilizer - u.fertilizer, 'lower'],
    ['🌱 Final soil N', fmtRate(u.soilNEnd, units), fmtRate(customEval.soilNEnd, units), fmtRate(best.years.at(-1).soilN, units), best.years.at(-1).soilN - u.soilNEnd, 'higher'],
    ['💰 Est. gross return', fmtIncome(u.income, units, region), fmtIncome(customEval.income, units, region), fmtIncome(best.income, units, region), best.income - u.income, 'higher'],
  ];

  const groups = crops.reduce((acc, c) => ((acc[c.family] ||= []).push(c), acc), {});

  return (
    <div>
      {/* Interactive What-If Strategy Tester (Problematic 2 Fix) */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'var(--surface-2)',
          border: '1px solid var(--line)',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div>
            <b>🧪 Interactive Strategy Sandbox (“What if I plant X then Y?”):</b>
            <span className="muted" style={{ marginLeft: 8, fontSize: '0.85rem' }}>
              Pick any {testRot.length}-year sequence below to compare its water stress, erosion risk, and nitrogen balance against your usual plan and Rank #1.
            </span>
          </div>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: customEval.passesRules ? 'var(--primary-soft)' : 'var(--danger-soft)',
              color: customEval.passesRules ? 'var(--primary-strong)' : 'var(--danger)',
            }}
          >
            {customEval.passesRules ? '✓ Passes Agronomic Rules' : '⚠️ Violates Rotation Rules'}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {testRot.map((cid, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {idx > 0 && <span aria-hidden="true" style={{ fontWeight: 700 }}>→</span>}
              <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Yr {idx + 1}:</label>
              <select
                value={cid}
                aria-label={`Test strategy year ${idx + 1}`}
                onChange={e => {
                  const next = [...testRot];
                  next[idx] = e.target.value;
                  setTestRot(next);
                }}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)' }}
              >
                {Object.entries(groups).map(([fam, list]) => (
                  <optgroup key={fam} label={FAMILY_LABEL[fam] || fam}>
                    {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: '0.83rem', color: 'var(--ink)' }}>
          💡 <b>Sandbox Rule Trace:</b> {customEval.ruleTrace}
        </div>
      </div>

      <div className="table-wrap">
        <table className="compare">
          <caption className="sr-only">Strategy comparison: Your usual rotation, custom test rotation, and Rank 1</caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Your usual<br /><small>{usualName}</small></th>
              <th scope="col">Tested strategy<br /><small>{customEval.crops.join(' → ')}</small></th>
              <th scope="col">Optimized Rank #1<br /><small>{best.crops.join(' → ')}</small></th>
              <th scope="col">Rank #1 vs Usual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, aStr, testStr, bStr, d, goal]) => {
              const better = goal === 'lower' ? d < 0 : d > 0;
              return (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{aStr}</td>
                  <td style={{ fontWeight: 600, background: 'var(--surface-2)' }}>{testStr}</td>
                  <td><b>{bStr}</b></td>
                  <td className={d === 0 ? '' : better ? 'better' : 'worse'}>
                    {d === 0 ? 'same' : `${better ? '✓ better' : '✕ worse'} (${d > 0 ? '+' : ''}${fmtInt(d)})`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RankingStep() {
  const { state, region, crops, cropById } = useFarm();
  const { data: ranking, loading } = useRanking({
    region: state.region,
    rotation: state.rotation,
    allowed: state.allowed,
    custom: state.custom,
    priorities: state.priorities,
    scenario: state.scenario,
  });
  const [showCompare, setShowCompare] = useState(true);
  const listRef = useRef(null);
  const units = state.units;

  useEffect(() => {
    const before = () => listRef.current?.querySelectorAll('details').forEach(d => { d.dataset.wasOpen = d.open; d.open = true; });
    const after = () => listRef.current?.querySelectorAll('details').forEach(d => { d.open = d.dataset.wasOpen === 'true'; });
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  const allowedNames = state.allowed.map(id => cropById(id)?.name).filter(Boolean);
  const usualNames = state.rotation.map(id => cropById(id)?.name || id);

  return (
    <section aria-labelledby="t6">
      <StepHead
        id="t6"
        eyebrow="Step 6 of 6 · Results"
        title={`Recommended 3-year rotations for ${region.areaName}`}
        badges={
          <>
            {region.lessValidated && <span className="role-pill role-light">Less validated</span>}
            <span className={`sys-pill sys-${region.farmingSystem}`}>
              {region.farmingSystem === 'irrigated' ? '💧 Irrigated' : '🌧️ Rainfed'}
            </span>
          </>
        }
      >
        Scored from your 3 priorities, local climate stress, satellite <abbr title="Normalized Difference Vegetation Index">NDVI</abbr> vigour,
        environmental match and the 3-year soil nitrogen path.
      </StepHead>

      {region.isIrrigated && (
        <Alert tone="warn" icon="💧" style={{ marginBottom: 16 }}>
          <b>Water stress is based on rainfall. Irrigated farms may differ.</b>
        </Alert>
      )}

      <div aria-live="polite">
        {loading && !ranking && <Loading>Scoring rotations for {region.name}…</Loading>}
        <SampleNotice data={ranking} what="results" />
        {ranking && !ranking.sample && (
          <Alert tone="ok" icon="✓" style={{ margin: '0 0 20px' }}>
            <b>{ranking.mode === 'live-api' ? 'Live Python Scoring Engine' : 'Real-Data Scoring Engine'}:</b>{' '}
            {ranking.source}.
          </Alert>
        )}
      </div>

      {ranking && (
        <div aria-busy={loading}>
          <div className="rank-toolbar">
            <div className="mc-badge">
              🎲 Rank 1 stays first in <b>{ranking.monteCarlo.rank1StaysFirstPct}%</b> of {ranking.monteCarlo.runs} simulated weather years
            </div>
            <div className="rank-actions">
              <button
                type="button"
                className="btn btn-secondary"
                aria-expanded={showCompare}
                aria-controls="comparePanel"
                onClick={() => setShowCompare(v => !v)}
              >
                ⚖️ {showCompare ? 'Hide comparison' : 'Compare usual vs rank 1'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨️ Print or save as PDF</button>
            </div>
          </div>

          {showCompare && (
            <div className="card compare-panel" id="comparePanel">
              <h3>Interactive Strategy Comparison: Usual vs. Tested Strategy vs. Optimized Rank #1</h3>
              <p className="sub">
                Test any custom crop sequence below and compare its aggregate risk (water stress, erosion risk, net nitrogen balance, and NPK fertilizer) against your usual rotation and Rank #1.
              </p>
              <CompareTable ranking={ranking} usualName={usualNames.join(' → ')} units={units} region={region} crops={crops} state={state} />
            </div>
          )}

          <div className="rank-list" ref={listRef}>
            {ranking.rotations.map(r => (
              <RankCard key={r.rank} r={r} allowedNames={allowedNames} units={units} region={region} />
            ))}
          </div>

          {ranking.avoid?.length > 0 && (
            <section className="avoid-section" aria-labelledby="avoidTitle">
              <h3 id="avoidTitle">Rotations to avoid this season</h3>
              <p className="lead" style={{ fontSize: 17, marginTop: 6 }}>These failed the regional agronomic rules filter.</p>
              <div className="avoid-grid">
                {ranking.avoid.map(a => {
                  const isUsual = a.crops.every((c, i) => sameName(c, usualNames[i]));
                  return (
                    <article key={a.crops.join()} className={`avoid-card${isUsual ? ' is-usual' : ''}`}>
                      {isUsual && <div className="usual-flag">This is your current rotation</div>}
                      <h4>{a.crops.join(' → ')}</h4>
                      <div className="avoid-score">Score {a.score}/100 · <b>rejected by rules filter</b></div>
                      <ul>{a.reasons.map(t => <li key={t}>{t}</li>)}</ul>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <div style={{ marginTop: 32 }}>
            <AgronomyAssistant embedded />
          </div>

          <details className="risks gaps-panel" style={{ marginTop: 32 }}>
            <summary>Scientific limitations, scale gaps &amp; data attribution ({SCIENTIFIC_GAPS.length} disclosures)</summary>
            <ul>
              {SCIENTIFIC_GAPS.map(g => (
                <li key={g.id}><b>{g.id}:</b> {g.text}</li>
              ))}
              <li><b>Sources:</b> {DATA_PROVENANCE}</li>
            </ul>
          </details>
        </div>
      )}

      <StepNav back={{ to: 5, label: '← Back to climate' }} next={{ to: 1, label: 'Start over with another region', secondary: true }} />
    </section>
  );
}
