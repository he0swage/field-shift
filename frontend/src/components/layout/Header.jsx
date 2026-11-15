// Navigation bar (logo, links, language selector) + data status banner.
import { useEffect, useRef, useState } from 'react';
import { useI18n, LANGS } from '../../i18n/I18nContext';
import { useNav, JOURNEY } from '../../state/NavContext';
import { checkHealth } from '../../api/client';
import { useAuth } from '../../state/AuthContext';
import ThemeToggle from './ThemeToggle';
import './layout.css';

const SOURCES = ['NASA POWER 1995–2024', 'ISRIC SoilGrids', 'MODIS NDVI', 'OAIC / CCLS Prices'];

/** Asks the backend /health every 30 s; the banner says LIVE only when it really answers. */
function useApiLive() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let alive = true;
    const ping = () => checkHealth().then(ok => { if (alive) setLive(ok); });
    ping();
    const id = setInterval(ping, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return live;
}

export function DataBanner() {
  const { t } = useI18n();
  const IS_LIVE = useApiLive();
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

/** Language button: opens a small menu (English / Français / العربية). */
export function LangMenu() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const items = useRef([]);
  const current = LANGS.find(l => l.id === lang);

  useEffect(() => {
    if (!open) return undefined;
    items.current[LANGS.findIndex(l => l.id === lang)]?.focus();
    const away = e => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, lang]);

  const onKey = (e, i) => {
    if (e.key === 'Escape') { setOpen(false); wrap.current?.querySelector('button')?.focus(); }
    const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); items.current[(i + d + LANGS.length) % LANGS.length]?.focus(); }
  };
  const choose = id => { setLang(id); setOpen(false); wrap.current?.querySelector('button')?.focus(); };

  return (
    <div className="lang-menu" ref={wrap}>
      <button type="button" className="lang-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`${t('nav.language')}: ${current.name}`} onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <span lang={current.id}>{current.label}</span>
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="lang-list" role="menu" aria-label={t('nav.language')}>
          {LANGS.map((l, i) => (
            <li key={l.id} role="none">
              <button type="button" role="menuitemradio" aria-checked={l.id === lang} lang={l.id}
                ref={el => { items.current[i] = el; }} onClick={() => choose(l.id)} onKeyDown={e => onKey(e, i)}>
                <span>{l.name}</span>{l.id === lang && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Signed-in user + log out (guests get a "Sign in" button). */
function UserMenu() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  if (!user) return null;
  if (user.guest) {
    return <button type="button" className="user-btn" onClick={signOut}>{t('auth.signIn')}</button>;
  }
  const initials = (user.name || user.email).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="user-menu">
      <span className="avatar" aria-hidden="true" title={user.email}>{initials}</span>
      <button type="button" className="user-btn" onClick={signOut} title={user.email}>
        <span className="sr-only">{user.name} — </span>{t('auth.logout')}
      </button>
    </div>
  );
}

export default function Header() {
  const { t } = useI18n();
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
      <div className="header-row">
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

        <div className="header-tools">
          <LangMenu />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <DataBanner />
    </header>
  );
}
