// PAGE 1.1 — Landing: value proposition + "Start Your Journey" (opens the region page).
import { useT } from '../i18n/I18nContext';
import { useNav } from '../state/NavContext';
import './Landing.css';

function HeroArt() {
  // Illustrated smart-farm landscape: rolling fields, crop rows, satellite orbit and data overlays.
  return (
    <svg className="hero-art" viewBox="0 0 640 520" aria-hidden="true" direction="ltr">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a5132" /><stop offset="1" stopColor="#66733f" />
        </linearGradient>
        <linearGradient id="f1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c2cf8a" /><stop offset="1" stopColor="#9cad60" /></linearGradient>
        <linearGradient id="f2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dcc191" /><stop offset="1" stopColor="#b0875a" /></linearGradient>
        <linearGradient id="f3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c49a6c" /><stop offset="1" stopColor="#8a6440" /></linearGradient>
        <clipPath id="frame"><rect x="0" y="0" width="640" height="520" rx="32" /></clipPath>
        <pattern id="rows" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
          <rect width="14" height="14" fill="transparent" /><rect width="14" height="3" fill="rgba(255,255,255,.18)" />
        </pattern>
      </defs>
      <g clipPath="url(#frame)">
        <rect width="640" height="520" fill="url(#sky)" />
        <circle cx="500" cy="120" r="54" fill="var(--accent-light)" opacity=".9" />
        <circle cx="500" cy="120" r="86" fill="var(--accent-light)" opacity=".12" />
        {/* orbit + satellite */}
        <ellipse cx="320" cy="150" rx="300" ry="70" fill="none" stroke="rgba(255,255,255,.22)" strokeDasharray="4 8" />
        <g transform="translate(118 112) rotate(-12)">
          <rect x="-9" y="-6" width="18" height="12" rx="2" fill="#f9f5e9" />
          <rect x="-34" y="-4" width="20" height="8" fill="#94b2c4" /><rect x="14" y="-4" width="20" height="8" fill="#94b2c4" />
        </g>
        <path d="M118 120 L250 330" stroke="rgba(230,203,166,.45)" strokeDasharray="3 6" />
        {/* fields */}
        <path d="M0 300 C140 250 260 270 380 300 S600 330 640 290 V520 H0Z" fill="url(#f1)" />
        <path d="M0 360 C120 330 250 350 330 380 S520 420 640 380 V520 H0Z" fill="url(#f2)" />
        <path d="M0 360 C120 330 250 350 330 380 S520 420 640 380 V520 H0Z" fill="url(#rows)" />
        <path d="M0 430 C160 400 300 420 420 450 S580 480 640 460 V520 H0Z" fill="url(#f3)" />
        <path d="M0 300 C140 250 260 270 380 300 S600 330 640 290 V520 H0Z" fill="url(#rows)" opacity=".6" />
        {/* scan grid over the field */}
        <g stroke="rgba(255,255,255,.35)" strokeWidth="1">
          <path d="M200 330 L300 300 L420 330 L320 368Z" fill="rgba(230,203,166,.16)" />
          <path d="M250 315 L370 349 M233 340 L353 374 M275 309 L373 357" />
        </g>
        {/* data overlays */}
        <g className="chip-a">
          <rect x="34" y="200" width="150" height="58" rx="14" fill="rgba(255,252,243,.95)" />
          <text x="50" y="224" fontSize="12" fontWeight="700" fill="#6b6658">NDVI</text>
          <path d="M50 244 L70 238 L90 241 L110 230 L130 234 L150 222 L168 226" fill="none" stroke="#7f9a45" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <g className="chip-b">
          <rect x="452" y="214" width="156" height="58" rx="14" fill="rgba(255,252,243,.95)" />
          <text x="468" y="238" fontSize="12" fontWeight="700" fill="#6b6658">Rainfall</text>
          {[0, 1, 2, 3, 4, 5, 6].map(i => <rect key={i} x={468 + i * 18} y={262 - [10, 14, 8, 16, 6, 12, 9][i]} width="10" height={[10, 14, 8, 16, 6, 12, 9][i]} rx="2" fill="#3a7fae" />)}
        </g>
        <g className="chip-c">
          <rect x="250" y="440" width="170" height="52" rx="14" fill="rgba(58,65,50,.88)" />
          <text x="268" y="462" fontSize="12" fontWeight="700" fill="var(--accent-light)">Soil N · 3-year path</text>
          <path d="M268 478 L320 474 L360 480 L400 470" fill="none" stroke="#cdd9a3" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

export default function Landing() {
  const t = useT();
  const { go } = useNav();
  const start = () => go('region');
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <span className="hero-eyebrow">{t('hero.eyebrow')}</span>
          <h1 id="hero-title">{t('hero.title')}</h1>
          <p className="hero-text">{t('hero.text')}</p>
          <ul className="hero-points">
            <li><span aria-hidden="true">🛰️</span>{t('hero.p1')}</li>
            <li><span aria-hidden="true">🧪</span>{t('hero.p2')}</li>
            <li><span aria-hidden="true">🤖</span>{t('hero.p3')}</li>
          </ul>
        </div>
        <div className="hero-visual"><HeroArt /></div>
      </div>
      <div className="wrap">
        <div className="hero-cta">
          <div>
            <p className="hero-cta-title">{t('hero.title')}</p>
            <p className="hero-cta-text">{t('hero.ctaText')}</p>
          </div>
          <button type="button" className="btn btn-gold btn-lg" onClick={start}>
            {t('hero.cta')} <span className="flip" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
