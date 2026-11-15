// Light / dark switch. Stored per browser; the first visit follows the OS setting
// (applied before React loads by the inline script in index.html, so there is no flash).
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';

const KEY = 'pcra.v1.theme';
const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export default function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useState(current);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* private mode */ }
  }, [theme]);

  const dark = theme === 'dark';
  const label = dark ? t('theme.toLight') : t('theme.toDark');
  return (
    <button type="button" className="tool-btn icon-only theme-btn" aria-pressed={dark} aria-label={label} title={label}
      onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}
