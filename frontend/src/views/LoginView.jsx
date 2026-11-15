// Login page (shown before the app). After signing in, the farmer lands on the landing page (#/home).
import { useId, useState } from 'react';
import { useT } from '../i18n/I18nContext';
import { useAuth } from '../state/AuthContext';
import { LangMenu } from '../components/layout/Header';
import ThemeToggle from '../components/layout/ThemeToggle';
import { Alert } from '../components/ui';
import { HeroArt } from './Landing';
import './LoginView.css';

const DEMO = { email: 'demo@fieldshift.app', password: 'fieldshift2026' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginView() {
  const t = useT();
  const uid = useId();
  const { signIn, continueAsGuest } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const errors = {
    email: !form.email.trim() ? 'auth.err.emailRequired' : !EMAIL_RE.test(form.email.trim()) ? 'auth.err.emailInvalid' : null,
    password: !form.password ? 'auth.err.passwordRequired' : null,
  };
  const upd = k => e => { setForm({ ...form, [k]: k === 'remember' ? e.target.checked : e.target.value }); setError(null); };

  const goHome = () => { window.location.hash = '/home'; window.scrollTo(0, 0); };

  const onSubmit = async e => {
    e.preventDefault();
    setTouched(true);
    if (errors.email || errors.password) {
      document.getElementById(`${uid}-${errors.email ? 'email' : 'password'}`)?.focus();
      return;
    }
    setBusy(true); setError(null);
    try {
      goHome();
      await signIn(form.email.trim(), form.password, form.remember);
    } catch (err) {
      setError(err.code || 'OFFLINE');
      setBusy(false);
    }
  };

  const fieldErr = k => touched && errors[k];

  return (
    <div className="login">
      <aside className="login-art" aria-hidden="true">
        <div className="login-brand">
          <span className="brand-mark">🌾</span>
          <span className="brand-name">Precision Crop <span>Rotation Advisor</span></span>
        </div>
        <div className="login-art-copy">
          <h2>{t('hero.title')}</h2>
          <p>{t('auth.artText')}</p>
        </div>
        <div className="login-art-visual"><HeroArt hint={t('hero.dragHint')} /></div>
        <p className="login-sources">NASA POWER · ISRIC SoilGrids · MODIS NDVI · OAIC / CCLS</p>
      </aside>

      <main className="login-main" id="main">
        <div className="login-tools">
          <LangMenu />
          <ThemeToggle />
        </div>

        <div className="login-card">
          <div className="login-brand mobile-only">
            <span className="brand-mark" aria-hidden="true">🌾</span>
            <span className="brand-name">Precision Crop <span>Rotation Advisor</span></span>
          </div>
          <h1>{t('auth.title')}</h1>
          <p className="login-sub">{t('auth.sub')}</p>

          <div aria-live="assertive">
            {error && (
              <Alert tone="bad" role="alert">{t(`auth.err.${error}`)}</Alert>
            )}
          </div>

          <form onSubmit={onSubmit} noValidate className="login-form">
            <div className="field">
              <label htmlFor={`${uid}-email`}>{t('auth.email')}</label>
              <input id={`${uid}-email`} className="input" type="email" autoComplete="username" inputMode="email"
                value={form.email} onChange={upd('email')} placeholder="name@example.com"
                aria-invalid={Boolean(fieldErr('email'))} aria-describedby={fieldErr('email') ? `${uid}-email-e` : undefined} />
              {fieldErr('email') && <span className="field-error" id={`${uid}-email-e`}>{t(errors.email)}</span>}
            </div>

            <div className="field">
              <label htmlFor={`${uid}-password`}>{t('auth.password')}</label>
              <div className="pw-wrap">
                <input id={`${uid}-password`} className="input" type={show ? 'text' : 'password'} autoComplete="current-password"
                  value={form.password} onChange={upd('password')}
                  aria-invalid={Boolean(fieldErr('password'))} aria-describedby={fieldErr('password') ? `${uid}-pw-e` : undefined} />
                <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)} aria-pressed={show}
                  aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}>
                  {show ? t('auth.hide') : t('auth.show')}
                </button>
              </div>
              {fieldErr('password') && <span className="field-error" id={`${uid}-pw-e`}>{t(errors.password)}</span>}
            </div>

            <label className="check">
              <input type="checkbox" checked={form.remember} onChange={upd('remember')} /> {t('auth.remember')}
            </label>

            <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <div className="login-or"><span>{t('auth.or')}</span></div>
          <button type="button" className="btn btn-secondary login-guest" onClick={() => { goHome(); continueAsGuest(); }}>
            {t('auth.guest')}
          </button>

          <div className="demo-box">
            <div>
              <b>{t('auth.demoTitle')}</b>
              <p className="num" dir="ltr">{DEMO.email} · {DEMO.password}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...form, ...DEMO }); setError(null); }}>
              {t('auth.useDemo')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
