// Top bar: brand · navigation · language · theme · account. Data status lives in the sidebar.
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe2, LogOut } from 'lucide-react';
import { useI18n, LANGS } from '../../i18n/I18nContext';
import { useNav, JOURNEY } from '../../state/NavContext';
import { checkHealth } from '../../api/client';
import { useAuth } from '../../state/AuthContext';
import ThemeToggle from './ThemeToggle';
import './layout.css';


/** Asks the backend /health every 30 s. */
export function useApiLive() {
  const [live, setLive] = useState(null); // null = checking
  useEffect(() => {
    let alive = true;
    const ping = () => checkHealth().then(ok => { if (alive) setLive(ok); });
    ping();
    const id = setInterval(ping, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return live;
}

/** One thin, quiet strip: live / sample status (the data sources are listed on the About page). */
export function DataStatus() {
  const { t } = useI18n();
  const live = useApiLive();
  return (
    <div className={`data-strip${live ? ' live' : ''}`}>
      <div className="wrap data-strip-row">
        <span className="data-status"><span className="status-dot" aria-hidden="true" />{live ? t('banner.liveShort') : t('banner.sampleShort')}</span>
      </div>
    </div>
  );
}

/** Brand mark: a simple leaf/field glyph (no emoji). */
export function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20c0-8 5-14 16-16-1 10-7 16-16 16z" /><path d="M4 20 13 11" />
      </svg>
    </span>
  );
}

/** Language menu (English / Français / العربية). */
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
      <button type="button" className="tool-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`${t('nav.language')}: ${current.name}`} onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}>
        <Globe2 size={16} aria-hidden="true" />
        <span lang={current.id}>{current.label}</span>
        <ChevronDown size={14} aria-hidden="true" className="caret" />
      </button>
      {open && (
        <ul className="menu-list" role="menu" aria-label={t('nav.language')}>
          {LANGS.map((l, i) => (
            <li key={l.id} role="none">
              <button type="button" role="menuitemradio" aria-checked={l.id === lang} lang={l.id}
                ref={el => { items.current[i] = el; }} onClick={() => choose(l.id)} onKeyDown={e => onKey(e, i)}>
                <span>{l.name}</span>{l.id === lang && <Check size={15} aria-hidden="true" />}
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
    return <button type="button" className="tool-btn" onClick={signOut}>{t('auth.signIn')}</button>;
  }
  const initials = (user.name || user.email).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="user-menu">
      <span className="avatar" title={`${user.name} · ${user.email}`} aria-hidden="true">{initials}</span>
      <button type="button" className="tool-btn icon-only" onClick={signOut} aria-label={`${t('auth.logout')} (${user.name})`} title={t('auth.logout')}>
        <LogOut size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Header() {
  const { t } = useI18n();
  const { view, go } = useNav();
  const inJourney = JOURNEY.includes(view);

  const link = (id, label, current, extra = '') => (
    <li>
      <button type="button" className={`nav-link${extra}`} aria-current={current ? 'page' : undefined} onClick={() => go(id)}>
        {label}
      </button>
    </li>
  );

  return (
    <>
    {/* the bar sits ~3 cm (113 px) below the top of the page, then sticks to the top on scroll */}
    <div className="topbar-offset" aria-hidden="true" />
    <header className="topbar">
      <div className="topbar-row">
      <a className="brand" href="#/region" onClick={e => { e.preventDefault(); go('region', { top: true }); }}>
        <Logo />
        <span className="brand-name">Crop Rotation Advisor</span>
      </a>

      <nav className="top-nav" aria-label={t('nav.main')}>
        <ul>
          {link('region', t('nav.journey'), inJourney, ' journey')}
          {link('compare', t('nav.compare'), view === 'compare')}
          {link('about', t('nav.about'), view === 'about')}
        </ul>
      </nav>

      <div className="header-tools">
        <LangMenu />
        <ThemeToggle />
        <UserMenu />
      </div>
      </div>
    </header>
    </>
  );
}
