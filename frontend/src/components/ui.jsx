// Small shared building blocks used by every view.
import { useRef } from 'react';
import { useT } from '../i18n/I18nContext';
import { useFocusHeading, useNav } from '../state/NavContext';
import { useFarm } from '../state/FarmContext';
import { fmtCoord } from '../data/regions';

/** View header: eyebrow, h2 (receives focus after navigation), subtitle. */
export function PageHead({ id, eyebrow, title, sub, scrollTo, children }) {
  const ref = useRef(null);
  useFocusHeading(ref, { scrollTo });
  return (
    <header className="page-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 id={id} ref={ref} tabIndex={-1}>{title}</h2>
      {sub && <p className="sub">{sub}</p>}
      {children}
    </header>
  );
}

/** Back / Next row at the bottom of each journey view. */
export function PageNav({ back, next, nextLabel, backLabel, children }) {
  const t = useT();
  const { go } = useNav();
  return (
    <nav className="page-nav" aria-label={t('nav.pager')}>
      {back && (
        <button type="button" className="btn btn-secondary" onClick={() => go(back)}>
          <span className="flip" aria-hidden="true">←</span> {backLabel || t('common.back')}
        </button>
      )}
      {children}
      {next && (
        <button type="button" className="btn btn-primary next" onClick={() => go(next)}>
          {nextLabel || t('common.next')} <span className="flip" aria-hidden="true">→</span>
        </button>
      )}
    </nav>
  );
}

export function AiBadge() {
  const t = useT();
  return <span className="badge badge-ai" title={t('ai.title')}><span aria-hidden="true">✦</span> {t('ai.badge')}</span>;
}

export function Alert({ tone = 'info', icon, title, children, role }) {
  const icons = { info: 'ℹ️', good: '✅', warn: '⚠️', bad: '⛔' };
  return (
    <div className={`alert alert-${tone}`} role={role}>
      <span className="alert-icon" aria-hidden="true">{icon || icons[tone]}</span>
      <div>{title && <strong>{title} </strong>}{children}</div>
    </div>
  );
}

/** Visible notice whenever a view shows placeholder data instead of live API data. */
export function SampleNotice({ data }) {
  const t = useT();
  if (!data?.sample && !data?.fallbackReason) return null;
  return (
    <p className="sample-note">
      <span aria-hidden="true">🧪</span>
      <span>{data.fallbackReason ? t('sample.fallback') : t('sample.note')}</span>
    </p>
  );
}

/** "📍 Sétif High Plains, Algeria · 36.15°N, 5.38°E · 485 mm/yr" */
export function RegionStrip() {
  const t = useT();
  const { region } = useFarm();
  const { go } = useNav();
  return (
    <div className="region-strip">
      <span aria-hidden="true">📍</span>
      <b>{t(`region.${region.id}.name`)}</b>
      <span>{t(`country.${region.countryCode}`)} · {fmtCoord(region.lat, region.lon)}</span>
      <button type="button" className="btn-link" onClick={() => go('region')}>{t('common.change')}</button>
    </div>
  );
}

/** Coloured difference with an arrow; `goal` says which direction is better. */
export function Delta({ value, unit = '', goal = 'higher', digits = 0 }) {
  if (Math.abs(value) < 10 ** -digits / 2) return <span className="delta-flat">± 0{unit}</span>;
  const better = goal === 'lower' ? value < 0 : value > 0;
  const cls = goal === 'none' ? 'delta-flat' : better ? 'delta-good' : 'delta-bad';
  return (
    <span className={cls}>
      <span aria-hidden="true">{value > 0 ? '▲' : '▼'}</span> {value > 0 ? '+' : '−'}{Math.abs(value).toFixed(digits)}{unit}
    </span>
  );
}

export function Loading({ children }) {
  return <div className="row muted" role="status"><span className="spinner" aria-hidden="true" />{children}</div>;
}
