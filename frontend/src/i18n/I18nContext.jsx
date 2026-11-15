// EN / FR / العربية. Arabic switches the whole document to right-to-left.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STRINGS } from './strings';
import { storage } from '../utils/storage';

export const LANGS = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'fr', label: 'FR', name: 'Français' },
  { id: 'ar', label: 'العربية', name: 'العربية' },
];

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = storage.get('lang');
    return LANGS.some(l => l.id === saved) ? saved : 'en';
  });
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    storage.set('lang', lang);
  }, [lang, dir]);

  /** t('key', { n: 3 }) — falls back to English, then to the key itself. */
  const t = useCallback((key, vars) => {
    let s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, dir, t }), [lang, dir, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
