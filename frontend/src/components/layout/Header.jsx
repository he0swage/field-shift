// Navigation bar (logo, links, language selector) + data status banner.
import { useI18n, LANGS } from '../../i18n/I18nContext';
import { useNav, JOURNEY } from '../../state/NavContext';
import { IS_LIVE } from '../../api/client';
import './layout.css';

const SOURCES = ['NASA POWER 1995–2024', 'ISRIC SoilGrids', 'MODIS NDVI', 'OAIC / CCLS Prices'];

export function DataBanner() {
  const { t } = useI18n();
  return (
    <div className={`data-banner${IS_LIVE ? ' live' : ''}`}>
      <div className="wrap data-banner-row">
        <span className="data-status">
          <span className="pulse-dot" aria-hidden="true" />
          {IS_LIVE ? t('banner.live') : t('banner.sample')}
        </span>
        <ul className="sources" aria-label={t('banner.sources')}>
          {SOURCES.map(s => <li key={s}>{s}</li>)}
        </ul>
      </div>
    </div>
  );
}

export default function Header() {
  const { t, lang, setLang } = useI18n();
  const { view, go, lastJourney } = useNav();
  const inJourney = JOURNEY.includes(view);

  const link = (id, label, current) => (
    <li>
      <button type="button" className="nav-link" aria-current={current ? 'page' : undefined} onClick={() => go(id)}>
        {label}
      </button>
    </li>
  );

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <a className="brand" href="#/home" onClick={e => { e.preventDefault(); go('home', { top: true }); }}>
          <span className="brand-mark" aria-hidden="true">🌾</span>
          <span className="brand-name">Precision Crop <span>Rotation Advisor</span></span>
        </a>

        <nav className="top-nav" aria-label={t('nav.main')}>
          <ul>
            {link(lastJourney, t('nav.journey'), inJourney)}
            {link('map', t('nav.map'), view === 'map')}
            {link('compare', t('nav.compare'), view === 'compare')}
            <li>
              <button type="button" className="nav-link" onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}>
                {t('nav.about')}
              </button>
            </li>
          </ul>
        </nav>

        <div className="lang" role="group" aria-label={t('nav.language')}>
          {LANGS.map(l => (
            <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} title={l.name} onClick={() => setLang(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <DataBanner />
    </header>
  );
}
