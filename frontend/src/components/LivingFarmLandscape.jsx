// LivingFarmLandscape.jsx
// Living animated agricultural landscape for FieldShift hero section.
// Transforms the static farm illustration into a breathing, natural scene:
// - Desaturated morning blue sky (#94b2c4) with soft atmospheric glow.
// - Multi-tier seamless drifting clouds gliding behind mountain ridges.
// - 100% preservation of the original farm illustration's composition, hills, houses, trees, and crops.
// - Organic wind displacement wave moving through the vegetation and canopy.
// - Foreground swaying grasses and drifting golden morning particles.
// - Interactive gentle parallax & full accessibility with prefers-reduced-motion fallback.

import { useCallback, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './LivingFarmLandscape.css';

const W = 1077;
const H = 860;

// Reusable SVG Cloud definitions matching the flat illustrated style
function CloudA({ className = '' }) {
  return (
    <g className={className}>
      <path
        className="ll-cloud-shape"
        d="M 35,60 C 35,32 62,28 78,32 C 92,10 132,8 158,25 C 175,12 210,14 225,35 C 248,35 262,48 260,65 C 258,74 246,78 230,78 L 50,78 C 36,78 35,70 35,60 Z"
      />
      {/* Soft internal contour highlighting morning light */}
      <path
        className="ll-cloud-shape-tint"
        d="M 52,62 C 55,42 78,38 90,44 C 104,24 136,22 155,36 C 170,26 198,28 210,44 C 228,45 240,54 238,66 Z"
        opacity="0.4"
      />
    </g>
  );
}

function CloudB({ className = '' }) {
  return (
    <g className={className}>
      <path
        className="ll-cloud-shape"
        d="M 25,48 C 25,26 48,22 62,26 C 74,8 108,6 128,20 C 142,10 170,12 182,28 C 200,28 212,38 210,52 C 208,59 198,62 185,62 L 40,62 C 28,62 25,56 25,48 Z"
      />
      <path
        className="ll-cloud-shape-tint"
        d="M 38,50 C 40,34 60,30 70,35 C 82,18 108,17 122,28 C 135,20 158,22 168,35 C 182,36 192,44 190,53 Z"
        opacity="0.35"
      />
    </g>
  );
}

function CloudC({ className = '' }) {
  return (
    <g className={className}>
      <path
        className="ll-cloud-shape"
        d="M 20,38 C 20,20 38,18 50,20 C 60,6 88,4 104,15 C 115,7 138,8 148,22 C 162,22 172,30 170,42 C 168,48 160,50 150,50 L 32,50 C 22,50 20,45 20,38 Z"
      />
    </g>
  );
}

// Subtle foreground wheat / wild grass stems that sway in the bottom foreground
function ForegroundGrasses() {
  return (
    <svg className="ll-foreground-layer" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Bottom left foreground grasses */}
      <g className="ll-grass-stalk ll-sway-left" style={{ transformOrigin: '40px 850px' }}>
        <path d="M 40,850 Q 32,790 18,740 Q 14,725 10,715" stroke="#9cad60" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M 18,740 Q 14,730 8,728 M 18,740 Q 22,732 24,726 M 14,725 Q 8,720 4,718 M 14,725 Q 18,718 20,714" stroke="#c49a6c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </g>
      <g className="ll-grass-stalk ll-sway-mid" style={{ transformOrigin: '70px 855px' }}>
        <path d="M 70,855 Q 65,800 52,760 Q 48,745 42,735" stroke="#595f34" strokeWidth="2.8" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d="M 52,760 Q 45,752 40,750 M 52,760 Q 56,750 58,744" stroke="#c49a6c" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <g className="ll-grass-stalk ll-sway-right" style={{ transformOrigin: '95px 858px' }}>
        <path d="M 95,858 Q 98,815 110,775" stroke="#9cad60" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.75" />
      </g>

      {/* Bottom right foreground grasses */}
      <g className="ll-grass-stalk ll-sway-right" style={{ transformOrigin: '1030px 852px' }}>
        <path d="M 1030,852 Q 1022,795 1010,745 Q 1006,730 1000,720" stroke="#9cad60" strokeWidth="3.2" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M 1010,745 Q 1002,738 996,735 M 1010,745 Q 1016,736 1020,732" stroke="#c49a6c" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </g>
      <g className="ll-grass-stalk ll-sway-left" style={{ transformOrigin: '995px 855px' }}>
        <path d="M 995,855 Q 985,810 970,770" stroke="#595f34" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.8" />
      </g>
    </svg>
  );
}

// Floating atmospheric pollen and golden chaff drifting across the valley
const PARTICLES = [
  { id: 1, sx: 20, sy: 420, ex: 820, ey: 360, dur: '16s', delay: '0s', size: 4 },
  { id: 2, sx: 60, sy: 520, ex: 900, ey: 440, dur: '14s', delay: '3.2s', size: 3.5 },
  { id: 3, sx: 10, sy: 380, ex: 780, ey: 310, dur: '18s', delay: '6.5s', size: 4.5 },
  { id: 4, sx: 120, sy: 620, ex: 980, ey: 550, dur: '13s', delay: '1.8s', size: 3 },
  { id: 5, sx: 40, sy: 460, ex: 860, ey: 390, dur: '15s', delay: '8.4s', size: 3.5 },
  { id: 6, sx: 80, sy: 580, ex: 940, ey: 490, dur: '17s', delay: '10.2s', size: 4 },
];

export default function LivingFarmLandscape({ years = [], className = '' }) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  // Subtle interactive parallax on mouse movement
  const onMouseMove = useCallback((e) => {
    if (reducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: nx * 6, y: ny * 4 });
  }, [reducedMotion]);

  const onMouseLeave = useCallback(() => {
    setParallax({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      className={`living-landscape ${className}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      role="img"
      aria-label="Living animated landscape of rolling farm fields, hills, and drifting morning clouds"
    >
      {/* 1. Morning Sky Background Gradient */}
      <div className="ll-sky-bg" />

      {/* 2. Morning Atmosphere & Breathing Soft Light Shimmer */}
      {!reducedMotion && <div className="ll-atmosphere" />}
      {!reducedMotion && <div className="ll-sunbeam" />}

      {/* 3. Multi-tier Drifting Clouds Layer (drifts continuously behind mountains) */}
      <div
        className="ll-clouds-layer"
        style={{
          transform: !reducedMotion ? `translate3d(${parallax.x * 0.4}px, ${parallax.y * 0.4}px, 0)` : 'none'
        }}
      >
        {/* Tier 1: Distant high altitude clouds */}
        <div className="ll-cloud-track ll-cloud-tier-1">
          <svg viewBox="0 0 2154 380" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            {/* Set 1 */}
            <g transform="translate(60, 25) scale(0.65)"><CloudC /></g>
            <g transform="translate(420, 15) scale(0.7)"><CloudB /></g>
            <g transform="translate(780, 30) scale(0.62)"><CloudC /></g>
            {/* Set 2 (seamless duplicate spaced at W = 1077) */}
            <g transform="translate(1137, 25) scale(0.65)"><CloudC /></g>
            <g transform="translate(1497, 15) scale(0.7)"><CloudB /></g>
            <g transform="translate(1857, 30) scale(0.62)"><CloudC /></g>
          </svg>
        </div>

        {/* Tier 2: Mid-sky billowy cumulus */}
        <div className="ll-cloud-track ll-cloud-tier-2">
          <svg viewBox="0 0 2154 380" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            {/* Set 1 */}
            <g transform="translate(140, 60) scale(0.85)"><CloudA /></g>
            <g transform="translate(620, 75) scale(0.8)"><CloudB /></g>
            <g transform="translate(940, 50) scale(0.9)"><CloudA /></g>
            {/* Set 2 (seamless duplicate spaced at W = 1077) */}
            <g transform="translate(1217, 60) scale(0.85)"><CloudA /></g>
            <g transform="translate(1697, 75) scale(0.8)"><CloudB /></g>
            <g transform="translate(2017, 50) scale(0.9)"><CloudA /></g>
          </svg>
        </div>

        {/* Tier 3: Lower morning clouds gliding gracefully just above ridges */}
        <div className="ll-cloud-track ll-cloud-tier-3">
          <svg viewBox="0 0 2154 380" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            {/* Set 1 */}
            <g transform="translate(20, 135) scale(1.05)"><CloudB /></g>
            <g transform="translate(480, 150) scale(1.15)"><CloudA /></g>
            <g transform="translate(860, 140) scale(1.0)"><CloudC /></g>
            {/* Set 2 (seamless duplicate spaced at W = 1077) */}
            <g transform="translate(1097, 135) scale(1.05)"><CloudB /></g>
            <g transform="translate(1557, 150) scale(1.15)"><CloudA /></g>
            <g transform="translate(1937, 140) scale(1.0)"><CloudC /></g>
          </svg>
        </div>
      </div>

      {/* 4. Landscape Artwork Layer: 100% preservation of original illustration */}
      <div
        className="ll-landscape-layer"
        style={{
          transform: !reducedMotion ? `translate3d(${parallax.x * 0.15}px, ${parallax.y * 0.15}px, 0)` : 'none'
        }}
      >
        {/*
          SVG Defs for organic wind breeze displacement filter.
          The filter subtly ripples and sways tree leaves, canopies, and field crops.
        */}
        <svg className="ll-canvas" width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter id="farm-wind-breeze" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.007 0.014"
                numOctaves="2"
                seed="7"
                result="windNoise"
              >
                {!reducedMotion && (
                  <animate
                    attributeName="baseFrequency"
                    dur="12s"
                    values="0.007 0.014; 0.010 0.020; 0.007 0.014"
                    repeatCount="indefinite"
                  />
                )}
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="windNoise"
                scale={reducedMotion ? 0 : 2.8}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>

        {/* Transparent landscape cutout placed in front of drifting clouds */}
        <div className="ll-landscape-wind">
          <img
            src={`${import.meta.env.BASE_URL}farm-landscape-cutout.png`}
            onError={(e) => {
              // Graceful fallback to base illustration if cutout is unavailable
              e.currentTarget.src = `${import.meta.env.BASE_URL}farm-landscape.jpg`;
            }}
            alt="Farm landscape with green and golden terraces and houses"
            className="ll-landscape-img"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>

      {/* 5. Foreground Swaying Grasses & Stalks (adds tactile depth) */}
      {!reducedMotion && <ForegroundGrasses />}

      {/* 6. Floating Golden Chaff / Pollen Particles */}
      {!reducedMotion && (
        <div className="ll-particles-layer">
          {PARTICLES.map((p) => (
            <span
              key={p.id}
              className="ll-particle"
              style={{
                '--p-start-x': `${p.sx}px`,
                '--p-start-y': `${p.sy}px`,
                '--p-end-x': `${p.ex}px`,
                '--p-end-y': `${p.ey}px`,
                '--p-dur': p.dur,
                '--p-delay': p.delay,
                width: `${p.size}px`,
                height: `${p.size}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* 7. Subtle Crop Rotation Year Indicators (if years passed) */}
      {years && years.length > 0 && (
        <div className="ll-badge-overlay" aria-label="Rotation plan years">
          <span className="ll-badge-dot" />
          {years.map((y, i) => (
            <span key={i} className="ll-badge-pill">
              Y{i + 1}: {y.crop || y.name || y.family}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
