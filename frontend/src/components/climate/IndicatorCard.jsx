// Baseline → scenario indicator with difference arrow. `goal` = which direction is better for the farm.
import { useT } from '../../i18n/I18nContext';
import { ArrowRight } from 'lucide-react';
import { Delta } from '../ui';
import Icon from '../icons';
import './climate.css';

export default function IndicatorCard({ icon, title, base, scen, unit, goal = 'lower', extra, children, tone }) {
  const t = useT();
  return (
    <article className={`indicator${tone ? ` tone-${tone}` : ''}`}>
      <header className="ind-head">
        <span className="ind-icon"><Icon name={icon} size={18} /></span>
        <h3>{title}</h3>
      </header>
      <dl className="ind-values">
        <div><dt>{t('ind.baseline')}</dt><dd className="num">{base}<small> {unit}</small></dd></div>
        <div className="ind-arrow" aria-hidden="true"><ArrowRight size={16} className="flip" /></div>
        <div><dt>{t('ind.scenario')}</dt><dd className="num scen-val">{scen}<small> {unit}</small></dd></div>
      </dl>
      <p className="ind-diff">{t('ind.diff')}: <Delta value={scen - base} unit={` ${unit}`} goal={goal} /></p>
      {extra}
      {children && <p className="ind-explain">{children}</p>}
    </article>
  );
}
