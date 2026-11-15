// One ranked 3-year rotation: header (rank, sequence, score), year columns, key metrics, risk notes.
import { AlertTriangle, ArrowRight, ChevronDown } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { TAGS } from '../../data/sampleRanking';
import { fmtInt, sameName } from '../../utils/format';
import { useNav } from '../../state/NavContext';
import { AiBadge } from '../ui';
import Icon from '../icons';
import './rotation.css';

function Bar({ value, max = 100, tone }) {
  return <span className={`mini-bar ${tone}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></span>;
}

function YearBlock({ y, i }) {
  const t = useT();
  return (
    <li className="year">
      <div className="year-top">
        <span className="year-no">{t('common.year', { n: i + 1 })}</span>
        {y.nCredit && <span className="badge badge-good" title={t('rank.nCreditHint')}>{t('rank.nCredit')} −{y.nCredit}%</span>}
      </div>
      <div className="year-crop"><Icon name={y.family} size={16} /> {y.crop}</div>
      <dl className="year-facts">
        <div><dt>{t('rank.soilN')}</dt><dd className="num">{y.soilN} <small>kg/ha</small></dd><Bar value={y.soilN} max={120} tone="n" /></div>
        <div><dt>{t('rank.health')}</dt><dd className="num">{y.health}<small>%</small></dd><Bar value={y.health} tone="h" /></div>
        <div><dt>{t('rank.fert')}</dt><dd>{y.fertilizer} <small className="num">· {y.kg} kg/ha</small></dd></div>
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
    <article className={`rot-card${best ? ' is-best' : ''}`} aria-labelledby={`rk-${r.rank}`}>
      <header className="rot-head">
        <span className="rank-no" aria-hidden="true">{r.rank}</span>
        <div className="rot-title">
          {best && <span className="best-label">{t('rank.best')}</span>}
          <h3 id={`rk-${r.rank}`}>
            <span className="sr-only">{t('rank.rank', { n: r.rank })}: </span>
            {r.crops.map((c, i) => (
              <span key={i}>{i > 0 && <ArrowRight size={14} className="seq-arrow flip" aria-label={t('common.then')} />}{c}</span>
            ))}
          </h3>
          <ul className="tags" aria-label={t('rank.strengths')}>
            {r.tags.map(id => (
              <li key={id} className={`badge ${TAGS[id]?.tone ? `badge-${TAGS[id].tone}` : ''}`}><Icon name={id} size={13} />{t(`tag.${id}`)}</li>
            ))}
            <li><AiBadge /></li>
          </ul>
        </div>
        <div className="rot-score" aria-label={`${t('rank.score')}: ${r.scores.final}/100`}>
          <b className="num">{r.scores.final}</b><span>{t('rank.score')}</span>
        </div>
      </header>

      <ol className="timeline" aria-label={t('rank.timeline')}>
        {r.years.map((y, i) => <YearBlock key={i} y={y} i={i} />)}
      </ol>

      <dl className="rot-metrics">
        <div><dt><Icon name="water" size={14} /> {t('rank.water')}</dt><dd className="num">{r.waterNeed}<small>/100</small></dd></div>
        <div><dt><Icon name="stability" size={14} /> {t('rank.ndvi')}</dt><dd className="num">{r.ndviStability}<small>/100</small></dd></div>
        <div><dt><Icon name="fertilizer" size={14} /> {t('rank.fert3')}</dt><dd className="num">{r.fertilizer} <small>kg/ha</small></dd></div>
        <div><dt><Icon name="income" size={14} /> {t('rank.income')}</dt><dd className="num">{fmtInt(r.income)} <small>DA/ha/{t('unit.yr')}</small></dd></div>
      </dl>
      {r.fertilizerSaved > 0 && <p className="saves">{t('rank.saves', { kg: r.fertilizerSaved })}</p>}

      {missing.length > 0 && (
        <p className="note-inline">
          <AlertTriangle size={14} aria-hidden="true" /> {t('rank.missing', { crops: missing.join(', ') })}{' '}
          <button type="button" className="btn-link" onClick={() => go('strategy')}>{t('rank.editCrops')}</button>
        </p>
      )}

      <details className="risks" open={best}>
        <summary><ChevronDown size={16} className="chev" aria-hidden="true" /> {t('rank.risks')}</summary>
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
