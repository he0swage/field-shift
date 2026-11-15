import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { TAGS } from '../../data/sampleRanking';
import { sameName } from '../../utils/format';
import { useNav } from '../../state/NavContext';
import FieldStrips from '../FieldStrips';
import Icon from '../icons';
import CountUp from '../CountUp';
import './rotation.css';

function Figures({ r, size = 'lg' }) {
  const t = useT();
  return (
    <dl className={`figures ${size}`}>
      <div className="stat"><dt className="label">{t('rank.water')}</dt><dd className="value"><CountUp value={r.waterNeed} /><small>/100</small></dd></div>
      <div className="stat"><dt className="label">{t('rank.ndvi')}</dt><dd className="value"><CountUp value={r.ndviStability} /><small>/100</small></dd></div>
      <div className="stat"><dt className="label">{t('rank.fert3')}</dt><dd className="value"><CountUp value={r.fertilizer} /><small>kg/ha</small></dd></div>
      <div className="stat"><dt className="label">{t('rank.income')}</dt><dd className="value"><CountUp value={r.income} /><small>DA/ha</small></dd></div>
    </dl>
  );
}

function Risks({ r }) {
  const t = useT();
  const list = r.risks || [];
  if (!list.length) return <p className="risk-clean">{t('rank.riskClean')}</p>;
  return (
    <ul className="risks" aria-label={t('rank.risks')}>
      {list.map(k => (
        <li key={k} className="risk-tag">
          <Icon name="risk" size={14} />
          <span>{t(`risk.${k}`, null, k)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RotationCard({ r, rank = 1, currentRotation = [], allowedCrops = [] }) {
  const t = useT();
  const { go } = useNav();
  const [open, setOpen] = useState(rank === 1);
  const featured = rank === 1;

  if (!featured) {
    return (
      <article className="rot-row">
        <div className="rot-row-head">
          <div className="rank-badge">#{rank}</div>
          <span className="crops-sub">{r.crops.map(c => c.name).join(' → ')}</span>
        </div>
        <Figures r={r} size="sm" />
        <div className="rot-score sm"><span className="label">{t('rank.score')}</span><b className="num"><CountUp value={r.scores.final} /></b></div>
        {r.ruleTrace && (
          <p className="hint" style={{ margin: '6px 0 0', gridColumn: '1 / -1', fontSize: '0.84rem' }}>
            <strong>Why this ranking:</strong> {r.ruleTrace}
          </p>
        )}
        <div className="rot-row-foot"><Risks r={r} /></div>
      </article>
    );
  }

  // Rank 1 — featured full card
  const tags = r.tags || [];
  const missing = useMemo(() => {
    if (!allowedCrops.length) return [];
    return r.crops.filter(c => !allowedCrops.some(a => sameName(a, c.id) || sameName(a, c.name))).map(c => c.name);
  }, [r, allowedCrops]);

  return (
    <article className="rot-card rot-feature" aria-labelledby="rot-1-title">
      <header className="rot-card-head">
        <div>
          <span className="badge rec">{t('rank.topPick')}</span>
          <h3 id="rot-1-title" className="crops-title">{r.crops.map(c => c.name).join(' → ')}</h3>
          <ul className="tags" aria-label="Tags">
            {tags.map(tag => (
              <li key={tag} className="tag">{t(`tag.${tag}`, null, TAGS[tag] || tag)}</li>
            ))}
          </ul>
        </div>
        <div className="rot-score"><span className="label">{t('rank.score')}</span><b className="num"><CountUp value={r.scores.final} /></b><span className="of">/100</span></div>
      </header>

      <FieldStrips years={r.years} size="lg" details />

      <div className="rot-why">
        <h4 className="label">{t('rank.why')}</h4>
        <p>{r.why}</p>
      </div>

      <Figures r={r} />
      {r.fertilizerSaved > 0 && <p className="saves">{t('rank.saves', { kg: r.fertilizerSaved })}</p>}

      {r.ruleTrace && (
        <div className="card" style={{ padding: '10px 14px', margin: '12px 0', background: 'var(--surface-sunken)', borderLeft: '3px solid var(--primary)' }}>
          <span className="label" style={{ display: 'block', fontSize: '0.75rem', marginBottom: 2 }}>Agronomic Rule Trace (Why Rank #1)</span>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.45 }}>{r.ruleTrace}</p>
        </div>
      )}

      {missing.length > 0 && (
        <p className="note-inline">
          <AlertTriangle size={16} aria-hidden="true" /> {t('rank.missing', { crops: missing.join(', ') })}{' '}
          <button type="button" className="btn-link" onClick={() => go('strategy')}>
            {t('rank.openPool')}
          </button>
        </p>
      )}

      <div className="rot-foot">
        <Risks r={r} />
        <button
          type="button"
          className="rot-toggle"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          {open ? t('rank.hideMonthly') : t('rank.showMonthly')}
          <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
        </button>
      </div>

      {open && (
        <div className="monthly-drop">
          <div className="monthly-drop-head">
            <span className="label">{t('rank.monthly')}</span>
            <p className="hint">{t('rank.monthlySub')}</p>
          </div>
          <ol className="monthly-list">
            {r.years.map((y, idx) => (
              <li key={idx} className="monthly-item">
                <span className="monthly-yr">{t('common.year', { n: idx + 1 })} · {y.crop.name}</span>
                <span className="monthly-summary">{y.summary}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
