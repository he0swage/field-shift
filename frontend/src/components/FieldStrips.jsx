// Rotation motif: a 3-year rotation drawn as three vertical field strips (Year 1, 2, 3),
// each strip tinted by crop family (greens for legumes/oilseeds/forage, browns for cereals/roots/fallow).
import { useT } from '../i18n/I18nContext';

export default function FieldStrips({ years, size = 'lg', details = false, className = '' }) {
  const t = useT();
  return (
    <ol className={`strips ${size} ${className}`} aria-label={t('rank.timeline')}>
      {years.map((y, i) => (
        <li key={i} className={`strip ${y.family || 'other'}`}>
          <span className="strip-year">{t('common.year', { n: i + 1 })}</span>
          <span className="strip-crop">{y.crop || y.name}</span>
          {y.nCredit && size === 'lg' && <span className="strip-credit">{t('rank.nCredit')} −{y.nCredit}%</span>}
          {details && (
            <dl className="strip-facts">
              <div><dt>{t('rank.soilN')}</dt><dd className="num">{y.soilN} kg/ha</dd></div>
              <div><dt>{t('rank.health')}</dt><dd className="num">{y.health}%</dd></div>
              <div><dt>{t('rank.fert')}</dt><dd className="num">{y.kg} kg/ha</dd></div>
            </dl>
          )}
        </li>
      ))}
    </ol>
  );
}
