// One ranked 3-year rotation: score, connected year timeline, summary metrics, risk notes.
import { useT } from '../../i18n/I18nContext';
import { TAGS } from '../../data/sampleRanking';
import { FAMILY_ICON } from '../../data/crops';
import { fmtInt, sameName } from '../../utils/format';
import { useNav } from '../../state/NavContext';
import { AiBadge } from '../ui';
import './rotation.css';

function ScoreRing({ value, label }) {
  return (
    <div className="ring" style={{ '--v': value }} role="img" aria-label={`${label}: ${value}/100`}>
      <div className="ring-inner"><b>{value}</b><span>/100</span></div>
    </div>
  );
}

function YearBlock({ y, i }) {
  const t = useT();
  return (
    <li className="year">
      <div className="year-top">
        <span className="year-no">{t('common.year', { n: i + 1 })}</span>
        {y.nCredit && <span className="credit" title={t('rank.nCreditHint')}>{t('rank.nCredit')} −{y.nCredit}%</span>}
      </div>
      <div className="year-crop"><span aria-hidden="true">{FAMILY_ICON[y.family] || '🌱'}</span> {y.crop}</div>
      <dl className="year-facts">
        <div>
          <dt><span aria-hidden="true">🧪</span> {t('rank.soilN')}</dt><dd className="num">{y.soilN} kg/ha</dd>
          <div className="mini-bar n" aria-hidden="true"><i style={{ width: `${Math.min(100, (y.soilN / 120) * 100)}%` }} /></div>
        </div>
        <div>
          <dt><span aria-hidden="true">🌿</span> {t('rank.health')}</dt><dd className="num">{y.health}%</dd>
          <div className="mini-bar h" aria-hidden="true"><i style={{ width: `${y.health}%` }} /></div>
        </div>
        <div>
          <dt><span aria-hidden="true">⚗️</span> {t('rank.fert')}</dt><dd>{y.fertilizer} <span className="num">({y.kg} kg/ha)</span></dd>
        </div>
      </dl>
    </li>
  );
}

export default function RotationCard({ r, allowedNames = [] }) {
  const t = useT();
  const { go } = useNav();
  const best = r.rank === 1;
  const missing = [...new Set(r.crops)].filter(c => allowedNames.length && !allowedNames.some(a => sameName(a, c)));

  return (
    <article className={`rot-card rank-${r.rank}${best ? ' is-best' : ''}`} aria-labelledby={`rk-${r.rank}`}>
      {best && <div className="best-ribbon"><span aria-hidden="true">🏆</span> {t('rank.best')}</div>}
      <header className="rot-head">
        <div className="rank-no" aria-hidden="true">#{r.rank}</div>
        <div className="rot-title">
          <h3 id={`rk-${r.rank}`}>
            <span className="sr-only">{t('rank.rank', { n: r.rank })}: </span>
            {r.crops.map((c, i) => (
              <span key={i}>{i > 0 && <span className="arrow flip" aria-label={t('common.then')}> → </span>}{c}</span>
            ))}
          </h3>
          <ul className="tags" aria-label={t('rank.strengths')}>
            {r.tags.map(id => {
              const tag = TAGS[id] || { icon: '•', tone: '' };
              return <li key={id} className={`badge ${tag.tone ? `badge-${tag.tone}` : ''}`}><span aria-hidden="true">{tag.icon}</span>{t(`tag.${id}`)}</li>;
            })}
            <li><AiBadge /></li>
          </ul>
        </div>
        <div className="rot-scores">
          <ScoreRing value={r.scores.final} label={t('rank.score')} />
          <div className="rot-score-label">{t('rank.score')}</div>
        </div>
      </header>

      <ol className="timeline" aria-label={t('rank.timeline')}>
        {r.years.map((y, i) => <YearBlock key={i} y={y} i={i} />)}
      </ol>

      <ul className="rot-metrics">
        <li><span className="m-icon" aria-hidden="true">💧</span><span>{t('rank.water')}</span><b className="num">{r.waterNeed}/100</b></li>
        <li><span className="m-icon" aria-hidden="true">🌾</span><span>{t('rank.ndvi')}</span><b className="num">{r.ndviStability}/100</b></li>
        <li><span className="m-icon" aria-hidden="true">🧪</span><span>{t('rank.fert3')}</span><b className="num">{r.fertilizer} kg/ha</b></li>
        <li><span className="m-icon" aria-hidden="true">💰</span><span>{t('rank.income')}</span><b className="num">{fmtInt(r.income)} DA/ha/{t('unit.yr')}</b></li>
      </ul>
      {r.fertilizerSaved > 0 && <p className="saves"><span aria-hidden="true">♻️</span> {t('rank.saves', { kg: r.fertilizerSaved })}</p>}

      {missing.length > 0 && (
        <p className="note-inline">
          ⚠️ {t('rank.missing', { crops: missing.join(', ') })}{' '}
          <button type="button" className="btn-link" onClick={() => go('strategy')}>{t('rank.editCrops')}</button>
        </p>
      )}

      <details className="risks" open={best}>
        <summary>{t('rank.risks')}</summary>
        <div className="risk-grid">
          {r.years.map((y, i) => (
            <div key={i}>
              <h4>{t('common.year', { n: i + 1 })} · {y.crop}</h4>
              <ul>{y.risks.map(x => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}
