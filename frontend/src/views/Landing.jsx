// PAGE 1.1 — Landing: value proposition + "Start Your Journey" (opens the region page).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/I18nContext';
import { useNav } from '../state/NavContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './Landing.css';

const ORBIT = 'M20 150 A300 70 0 1 1 620 150 A300 70 0 1 1 20 150';
const BARS = [10, 14, 8, 16, 6, 12, 9];

const GROUND = 'M0 300 C140 250 260 270 380 300 S600 330 640 290';
const GRASS_LIFE = 6000; // ms: grow, stay, fade

export function HeroArt({ hint }) {
  // Illustrated smart-farm landscape with small looping animations (orbiting satellite, pulsing sun,
  // rainfall bars, self-drawing NDVI / soil-N lines, scanning plot, floating cards).
  // Interactive: drag the cloud — it rains under it and grass grows where the rain lands, then fades.
  const reduced = useReducedMotion();
  const svgRef = useRef(null);
  const groundRef = useRef(null);
  const ground = useRef([]); // y of the field edge for each x (sampled once)
  const [cloud, setCloud] = useState({ x: 300, y: 92 });
  const cloudRef = useRef(cloud);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const [grass, setGrass] = useState([]);

  useEffect(() => {
    const p = groundRef.current, len = p.getTotalLength(), ys = [];
    for (let l = 0; l <= len; l += 2) { const pt = p.getPointAtLength(l); ys[Math.round(pt.x)] = pt.y; }
    for (let x = 0; x <= 640; x++) if (ys[x] == null) ys[x] = ys[x - 1] ?? 300;
    ground.current = ys;
  }, []);
  const groundAt = x => ground.current[Math.round(Math.max(0, Math.min(640, x)))] ?? 300;

  const toSvg = e => {
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
  };

  const onDown = useCallback(e => {
    e.preventDefault();
    const start = toSvg(e), from = cloudRef.current;
    const off = { x: start.x - from.x, y: start.y - from.y };
    setDragging(true); setTouched(true);
    const move = ev => {
      const p = toSvg(ev);
      const next = { x: Math.max(50, Math.min(590, p.x - off.x)), y: Math.max(40, Math.min(210, p.y - off.y)) };
      cloudRef.current = next; setCloud(next);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, []);

  // While it rains, grass sprouts under the cloud
  useEffect(() => {
    if (!dragging) return undefined;
    const id = setInterval(() => {
      const now = Date.now(), x = cloudRef.current.x + (Math.random() * 60 - 30);
      setGrass(g => [...g.filter(b => now - b.born < GRASS_LIFE).slice(-80),
        { id: `${now}-${Math.random()}`, x, y: groundAt(x) + 4 + Math.random() * 10, s: 0.8 + Math.random() * 0.6, born: now }]);
    }, 140);
    return () => clearInterval(id);
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remove faded grass
  useEffect(() => {
    if (!grass.length) return undefined;
    const id = setTimeout(() => setGrass(g => g.filter(b => Date.now() - b.born < GRASS_LIFE)), 1000);
    return () => clearTimeout(id);
  }, [grass]);

  return (
    <svg ref={svgRef} className="hero-art" viewBox="0 0 640 520" aria-hidden="true" direction="ltr">
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

        {/* sun with a slow pulsing halo */}
        <circle className="a-halo" cx="500" cy="120" r="86" fill="var(--accent-light)" opacity=".14" />
        <circle className="a-sun" cx="500" cy="120" r="54" fill="var(--accent-light)" opacity=".92" />

        {/* orbit + satellite travelling along it */}
        <path d={ORBIT} fill="none" stroke="rgba(255,255,255,.22)" strokeDasharray="4 8" />
        <g transform={reduced ? 'translate(118 112)' : undefined}>
          <g transform="rotate(-12)">
            <rect x="-9" y="-6" width="18" height="12" rx="2" fill="#f9f5e9" />
            <rect x="-34" y="-4" width="20" height="8" fill="#94b2c4" /><rect x="14" y="-4" width="20" height="8" fill="#94b2c4" />
            <circle className="a-blink" cx="0" cy="0" r="2.5" fill="#b5523b" />
          </g>
          {!reduced && <animateMotion dur="18s" repeatCount="indefinite" path={ORBIT} />}
        </g>

        {/* fields */}
        <path d="M0 300 C140 250 260 270 380 300 S600 330 640 290 V520 H0Z" fill="url(#f1)" />
        <path d="M0 360 C120 330 250 350 330 380 S520 420 640 380 V520 H0Z" fill="url(#f2)" />
        <path d="M0 360 C120 330 250 350 330 380 S520 420 640 380 V520 H0Z" fill="url(#rows)" />
        <path d="M0 430 C160 400 300 420 420 450 S580 480 640 460 V520 H0Z" fill="url(#f3)" />
        <path d="M0 300 C140 250 260 270 380 300 S600 330 640 290 V520 H0Z" fill="url(#rows)" opacity=".6" />
        <path ref={groundRef} d={GROUND} fill="none" stroke="none" />

        {/* grass that grows where the rain falls, then fades */}
        {grass.map(g => (
          <g key={g.id} transform={`translate(${g.x} ${g.y}) scale(${g.s})`}>
            <g className="a-grass">
              <path d="M0 0 Q-3 -10 -7 -15" /><path d="M0 0 Q0 -12 1 -21" /><path d="M0 0 Q3 -9 8 -14" />
            </g>
          </g>
        ))}

        {/* scanned plot: grid + sweeping scan line */}
        <g stroke="rgba(255,255,255,.35)" strokeWidth="1">
          <path className="a-plot" d="M200 330 L300 300 L420 330 L320 368Z" fill="rgba(230,203,166,.16)" />
          <path d="M250 315 L370 349 M233 340 L353 374 M275 309 L373 357" />
        </g>
        <path className="a-scan" d="M210 328 L310 299" stroke="rgba(255,252,243,.85)" strokeWidth="3" strokeLinecap="round" />

        {/* data cards */}
        <g className="chip-a">
          <rect x="34" y="200" width="150" height="58" rx="14" fill="rgba(255,252,243,.95)" />
          <text x="50" y="224" fontSize="12" fontWeight="700" fill="#6b6658">NDVI</text>
          <path className="a-draw" pathLength="100" d="M50 244 L70 238 L90 241 L110 230 L130 234 L150 222 L168 226" fill="none" stroke="#7f9a45" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle className="a-blink" cx="168" cy="226" r="3.5" fill="#7f9a45" />
        </g>
        <g className="chip-b">
          <rect x="452" y="214" width="156" height="58" rx="14" fill="rgba(255,252,243,.95)" />
          <text x="468" y="238" fontSize="12" fontWeight="700" fill="#6b6658">Rainfall</text>
          {BARS.map((h, i) => (
            <rect key={i} className="a-bar" style={{ animationDelay: `${i * 0.18}s` }}
              x={468 + i * 18} y={262 - h} width="10" height={h} rx="2" fill="#3a7fae" />
          ))}
        </g>
        <g className="chip-c">
          <rect x="250" y="440" width="170" height="52" rx="14" fill="rgba(58,65,50,.88)" />
          <text x="268" y="462" fontSize="12" fontWeight="700" fill="var(--accent-light)">Soil N · 3-year path</text>
          <path className="a-draw slow" pathLength="100" d="M268 478 L320 474 L360 480 L400 470" fill="none" stroke="#cdd9a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* draggable rain cloud */}
        <g transform={`translate(${cloud.x} ${cloud.y})`}>
          {dragging && (
            <g className="rain" style={{ '--fall': `${Math.max(20, groundAt(cloud.x) - cloud.y - 18)}px` }}>
              {[-28, -14, 0, 14, 28].map((dx, i) => (
                <line key={dx} className="a-drop" style={{ animationDelay: `${i * 0.12}s` }}
                  x1={dx} y1="18" x2={dx - 3} y2="30" stroke="#94b2c4" strokeWidth="3" strokeLinecap="round" />
              ))}
            </g>
          )}
          <g className={`cloud${dragging ? ' dragging' : ''}`} onPointerDown={onDown}>
            <g className="cloud-body" fill="#f9f5e9">
              <ellipse cx="0" cy="0" rx="40" ry="19" /><ellipse cx="28" cy="-12" rx="28" ry="21" />
              <ellipse cx="-30" cy="6" rx="23" ry="13" /><ellipse cx="-6" cy="-14" rx="20" ry="16" />
            </g>
          </g>
          {!touched && (
            <g className="drag-hint" transform="translate(0 46)">
              <rect x="-96" y="-14" width="192" height="28" rx="14" fill="rgba(58,65,50,.88)" />
              <text x="0" y="5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#f9f5e9">{hint}</text>
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}

export default function Landing() {
  const t = useT();
  const { go } = useNav();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title">{t('hero.title')}</h1>
          <p className="hero-text">{t('hero.text')}</p>
          <ul className="hero-points">
            <li>{t('hero.p1')}</li>
            <li>{t('hero.p2')}</li>
            <li>{t('hero.p3')}</li>
          </ul>
        </div>
        <div className="hero-visual"><HeroArt hint={t('hero.dragHint')} /></div>
      </div>
      <div className="wrap">
        <div className="hero-cta">
          <div>
            <p className="hero-cta-title">{t('hero.title')}</p>
            <p className="hero-cta-text">{t('hero.ctaText')}</p>
          </div>
          <button type="button" className="btn btn-gold btn-lg" onClick={() => go('region')}>
            {t('hero.cta')} <span className="flip" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
