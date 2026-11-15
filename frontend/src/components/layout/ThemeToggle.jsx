// Light / dark switch. The choice is stored per browser; the first visit follows the OS setting
// (applied before React loads by the inline script in index.html, so there is no flash).
import { useEffect, useState } from 'react';
import { useT } from '../../i18n/I18nContext';

const KEY = 'pcra.v1.theme';
const current = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

export default function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useState(current);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* private mode */ }
  }, [theme]);

  const dark = theme === 'dark';
  return (
    <button type="button" className="theme-btn" aria-pressed={dark}
      aria-label={dark ? t('theme.toLight') : t('theme.toDark')} title={dark ? t('theme.toLight') : t('theme.toDark')}
      onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        </svg>
      )}
      <span className="theme-label">{dark ? t('theme.light') : t('theme.dark')}</span>
    </button>
  );
}
