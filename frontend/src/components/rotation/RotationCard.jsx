// Ranked rotations. Rank 1 = large feature card (field strips + 4 key figures + risk notes);
// ranks 2–4 = compact rows. No "AI-generated" badge on cards (one disclosure on About + footer).
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { TAGS } from '../../data/sampleRanking';
import { fmtInt, sameName } from '../../utils/format';
import { useNav } from '../../state/NavContext';
import FieldStrips from '../FieldStrips';
import Icon from '../icons';
import './rotation.css';

function Figures({ r, size = 'lg' }) {
  const t = useT();
  return (
    <dl className={`figures ${size}`}>
      <div className="stat"><dt className="label">{t('rank.water')}</dt><dd className="value">{r.waterNeed}<small>/100</small></dd></div>
      <div className="stat"><dt className="label">{t('rank.ndvi')}</dt><dd className="value">{r.ndviStability}<small>/100</small></dd></div>
      <div className="stat"><dt className="label">{t('rank.fert3')}</dt><dd className="value">{r.fertilizer}<small>kg/ha</small></dd></div>
      <div className="stat"><dt className="label">{t('rank.income')}</dt><dd className="value">{fmtInt(r.income)}<small>DA/ha</small></dd></div>
    </dl>
  );
}

function Risks({ r, open }) {
  const t = useT();
  return (
    <details className="risks" open={open}>
      <summary><ChevronDown size={18} className="chev" aria-hidden="true" /> {t('rank.risks')}</summary>
      <div className="risk-grid">
        {r.years.map((y, i) => (
          <div key={i}>
            <h4>{t('common.year', { n: i + 1 })} · {y.crop}</h4>
            <ul>{y.risks.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function RotationCard({ r, allowedNames = [] }) {
  const t = useT();
  const { go } = useNav();
  const best = r.rank === 1;
  const missing = [...new Set(r.crops)].filter(c => allowedNames.length && !allowedNames.some(a => sameName(a, c)));
  const title = r.crops.join(' → ');

  if (!best) {
    return (
      <article className="rot-row" aria-labelledby={`rk-${r.rank}`}>
        <span className="rank-no" aria-hidden="true">{r.rank}</span>
        <div className="rot-row-main">
          <h3 id={`rk-${r.rank}`}><span className="sr-only">{t('rank.rank', { n: r.rank })}: </span>{title}</h3>
          <FieldStrips years={r.years} size="sm" />
        </div>
        <Figures r={r} size="sm" />
        <div className="rot-score sm"><span className="label">{t('rank.score')}</span><b className="num">{r.scores.final}</b></div>
        <div className="rot-row-foot"><Risks r={r} /></div>
      </article>
    );
  }

  return (
    <article className="rot-feature" aria-labelledby={`rk-${r.rank}`}>
      <header className="rot-feature-head">
        <div>
          <span className="label">{t('rank.best')}</span>
          <h3 id={`rk-${r.rank}`}><span className="sr-only">{t('rank.rank', { n: 1 })}: </span>{title}</h3>
          <ul className="tags" aria-label={t('rank.strengths')}>
            {r.tags.map(id => (
              <li key={id} className={`badge ${TAGS[id]?.tone ? `badge-${TAGS[id].tone}` : ''}`}><Icon name={id} size={14} />{t(`tag.${id}`)}</li>
            ))}
          </ul>
        </div>
        <div className="rot-score"><span className="label">{t('rank.score')}</span><b className="num">{r.scores.final}</b><span className="of">/100</span></div>
      </header>

      <FieldStrips years={r.years} size="lg" details />
      <p className="strip-ferts">
        {r.years.map((y, i) => <span key={i}><b>{t('common.year', { n: i + 1 })}:</b> {y.fertilizer}</span>)}
      </p>

      <Figures r={r} />
      {r.fertilizerSaved > 0 && <p className="saves">{t('rank.saves', { kg: r.fertilizerSaved })}</p>}

      {missing.length > 0 && (
        <p className="note-inline">
          <AlertTriangle size={16} aria-hidden="true" /> {t('rank.missing', { crops: missing.join(', ') })}{' '}
          <button type="button" className="btn-link" onClick={() => go('strategy')}>{t('rank.editCrops')}</button>
        </p>
      )}
      <Risks r={r} open />
    </article>
  );
}
