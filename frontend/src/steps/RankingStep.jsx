// Step 6 — recommended 3-year rotations, rotations to avoid, usual vs rank 1, print/PDF.
import { useEffect, useRef, useState } from 'react';
import { TAGS } from '../data/sampleRanking';
import { useFarm } from '../state/FarmContext';
import { useNav } from '../state/NavContext';
import { useRanking } from '../hooks/useData';
import { fmtInt, sameName } from '../utils/format';
import { StepHead, StepNav } from '../components/Layout';
import { Loading, SampleNotice } from '../components/ui';
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

function Year({ y, i }) {
  return (
    <li className="year">
      <div className="year-top">
        <span className="year-no">Year {i + 1}</span>
        {y.nCredit && <span className="credit" title="Nitrogen left by the previous legume">−{y.nCredit}% NPK</span>}
      </div>
      <div className="year-crop">{y.crop}</div>
      <dl>
        <div><dt>Soil nitrogen</dt><dd>{y.soilN} kg/ha</dd></div>
        <div className="nbar" aria-hidden="true"><i style={{ width: `${Math.min(100, (y.soilN / 120) * 100)}%` }} /></div>
        <div><dt>Crop health</dt><dd>{y.health}%</dd></div>
        <div><dt>Fertilizer</dt><dd>{y.fertilizer} · {y.kg} kg/ha</dd></div>
      </dl>
    </li>
  );
}

function RankCard({ r, allowedNames }) {
  const { go } = useNav();
  const medal = MEDAL[r.rank - 1] || 'plain';
  const missing = [...new Set(r.crops)].filter(c => !allowedNames.some(a => sameName(a, c)));
  return (
    <article className={`rank-card medal-${medal}${r.rank === 1 ? ' is-best' : ''}`} aria-labelledby={`rk-${r.rank}`}>
      <header className="rank-head">
        <div className="rank-no" aria-hidden="true">{r.rank}</div>
        <div className="rank-title">
          {r.rank === 1 && <div className="best-label">Best match for your farm</div>}
          <h3 id={`rk-${r.rank}`}>
            <span className="sr-only">Rank {r.rank}: </span>
            {r.crops.map((c, i) => <span key={i}>{i > 0 && <span className="arrow" aria-label="then">→</span>}{c}</span>)}
          </h3>
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
            <ScoreBar value={r.scores.knn} label="Climate match" hint="K-nearest-neighbours similarity between your region and places where this rotation succeeds" />
          </div>
        </div>
      </header>

      <ol className="years" aria-label="Year by year">{r.years.map((y, i) => <Year key={i} y={y} i={i} />)}</ol>

      <ul className="rank-stats">
        <li><span>💧 Water need</span><b>{r.waterNeed}/100</b></li>
        <li><span>🌿 <abbr title="Normalized Difference Vegetation Index">NDVI</abbr> stability</span><b>{r.ndviStability}/100</b></li>
        <li><span>🧪 3-yr fertilizer</span><b>{r.fertilizer} kg/ha</b><em>saves {r.fertilizerSaved} kg/ha vs usual</em></li>
        <li><span>💰 Est. gross income</span><b>{fmtInt(r.income)} DA/ha/yr</b></li>
      </ul>

      {missing.length > 0 && (
        <p className="note-inline">
          ⚠️ Includes <b>{missing.join(', ')}</b>, which you did not select in step 2.{' '}
          <button type="button" className="btn btn-link" onClick={() => go(2)}>Edit crops</button>
        </p>
      )}

      <details className="risks" open={r.rank === 1}>
        <summary>Risk notes per crop</summary>
        <ul>{Object.entries(r.risks).map(([c, t]) => <li key={c}><b>{c}:</b> {t}</li>)}</ul>
      </details>
    </article>
  );
}

function CompareTable({ ranking, usualName }) {
  const u = ranking.usual, best = ranking.rotations[0];
  const rows = [
    ['💧 Water need', u.waterNeed, best.waterNeed, '/100', 'lower'],
    ['🌿 NDVI stability', u.ndviStability, best.ndviStability, '/100', 'higher'],
    ['🧪 3-yr fertilizer', u.fertilizer, best.fertilizer, ' kg/ha', 'lower'],
    ['🌱 Soil N after 3 years', u.soilNEnd, best.years.at(-1).soilN, ' kg/ha', 'higher'],
    ['💰 Est. gross income', u.income, best.income, ' DA/ha/yr', 'higher'],
  ];
  return (
    <>
      <div className="table-wrap">
        <table className="compare">
          <caption className="sr-only">Your usual rotation compared with rank 1</caption>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Your usual<br /><small>{usualName}</small></th>
              <th scope="col">Rank 1<br /><small>{best.crops.join(' → ')}</small></th>
              <th scope="col">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b, unit, goal]) => {
              const d = b - a, better = goal === 'lower' ? d < 0 : d > 0;
              return (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{fmtInt(a)}{unit}</td>
                  <td>{fmtInt(b)}{unit}</td>
                  <td className={d === 0 ? '' : better ? 'better' : 'worse'}>
                    {d === 0 ? 'same' : `${better ? '✓ better' : '✕ worse'} · ${d > 0 ? '+' : ''}${fmtInt(d)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ranking.sample && <p className="hint">Usual-rotation figures are sample values.</p>}
    </>
  );
}

export default function RankingStep() {
  const { state, region, cropById } = useFarm();
  const { data: ranking, loading } = useRanking({
    region: state.region, rotation: state.rotation, allowed: state.allowed,
    priorities: state.priorities, scenario: state.scenario,
  });
  const [showCompare, setShowCompare] = useState(false);
  const listRef = useRef(null);

  // Print/PDF: open every collapsed risk section, then restore
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
      <StepHead id="t6" eyebrow="Step 6 of 6 · Results" title="Recommended 3-year rotations">
        Scored from your 3 priorities, local climate stress, satellite <abbr title="Normalized Difference Vegetation Index">NDVI</abbr> vigour,
        environmental match and the 3-year soil nitrogen path.
      </StepHead>

      <div aria-live="polite">
        {loading && !ranking && <Loading>Scoring rotations for {region.name}…</Loading>}
        <SampleNotice data={ranking} what="results" />
      </div>

      {ranking && (
        <div aria-busy={loading}>
          <div className="rank-toolbar">
            <div className="mc-badge">
              🎲 Rank 1 stays first in <b>{ranking.monteCarlo.rank1StaysFirstPct}%</b> of {ranking.monteCarlo.runs} simulated weather years
            </div>
            <div className="rank-actions">
              <button type="button" className="btn btn-secondary" aria-expanded={showCompare} aria-controls="comparePanel"
                onClick={() => setShowCompare(v => !v)}>
                ⚖️ {showCompare ? 'Hide comparison' : 'Compare usual vs rank 1'}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨️ Print or save as PDF</button>
            </div>
          </div>

          {showCompare && (
            <div className="card compare-panel" id="comparePanel">
              <h3>Your usual rotation vs rank 1</h3>
              <p className="sub">What changes on your farm if you switch to the top recommendation.</p>
              <CompareTable ranking={ranking} usualName={usualNames.join(' → ')} />
            </div>
          )}

          <div className="rank-list" ref={listRef}>
            {ranking.rotations.map(r => <RankCard key={r.rank} r={r} allowedNames={allowedNames} />)}
          </div>

          <section className="avoid-section" aria-labelledby="avoidTitle">
            <h3 id="avoidTitle">Rotations to avoid this season</h3>
            <p className="lead" style={{ fontSize: 17, marginTop: 6 }}>These failed the agronomic rules filter.</p>
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
        </div>
      )}

      <StepNav back={{ to: 5, label: '← Back to climate' }} next={{ to: 1, label: 'Start over with another region', secondary: true }} />
    </section>
  );
}
