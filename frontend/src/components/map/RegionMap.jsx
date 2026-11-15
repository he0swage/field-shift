// Global & Regional Interactive Map (Sections 2.5 & 3.3):
//   - Opens in Global World View fitting all 3 regions (Algeria, Kansas USA, Punjab India)
//   - Switches to Regional Detail View showing NASA FIRMS fire hotspot markers within 25 km
import { useRef, useState } from 'react';
import { REGIONS } from '../../data/regions';
import { useFarm } from '../../state/FarmContext';
import { useFires } from '../../hooks/useData';
import { SIG_LABEL } from '../../utils/agronomy';
import { fmtCoord, fmtRain, fmtRainTrend } from '../../utils/format';
import './RegionMap.css';

const W = 920, H = 420;
const LON = [-135, 115], LAT = [62, 8];

const mx = lon => ((lon - LON[0]) / (LON[1] - LON[0])) * W;
const my = lat => ((LAT[0] - lat) / (LAT[0] - LAT[1])) * H;

// Simplified continental silhouettes for North America, Europe/North Africa, and South Asia
const CONTINENTS = [
  // North America
  'M 45,45 L 185,42 L 245,95 L 220,165 L 185,225 L 140,260 L 95,215 L 55,140 Z',
  // Europe
  'M 445,48 L 565,42 L 595,95 L 545,135 L 465,138 L 438,102 Z',
  // North & West Africa
  'M 435,152 L 568,150 L 605,235 L 565,345 L 465,340 L 420,235 Z',
  // Middle East & South Asia (India / Pakistan / Indo-Gangetic Plain)
  'M 595,135 L 785,120 L 845,195 L 775,320 L 725,295 L 685,225 L 605,205 Z',
];

export default function RegionMap({ selected, trends, overlay, onOverlay, onSelect }) {
  const { state, region } = useFarm();
  const { data: fires } = useFires(selected);
  const [viewMode, setViewMode] = useState('world'); // 'world' | 'regional'
  const refs = useRef({});
  const ids = Object.keys(REGIONS);
  const units = state.units;

  const onKey = (e, id) => {
    const i = ids.indexOf(id);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); }
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (fwd || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = ids[(i + (fwd ? 1 : ids.length - 1)) % ids.length];
      refs.current[next]?.focus();
      onSelect(next);
    }
  };

  // Regional detail projection (~0.8 deg window around active region)
  const rLat = region.lat, rLon = region.lon;
  const rx = lon => W / 2 + ((lon - rLon) / 0.9) * (W * 0.72);
  const ry = lat => H / 2 - ((lat - rLat) / 0.6) * (H * 0.72);

  return (
    <div className="card map-card">
      <div className="head-row" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">NASA POWER (~50 km grid) · NASA FIRMS (VIIRS 375 m)</div>
          <h3>Global Scaling Regions &amp; Satellite Fire Watch Map</h3>
          <p className="sub" style={{ marginBottom: 0 }}>
            Same pipeline across 3 farming systems: rainfed Algeria (Deep), rainfed US Great Plains (Light), and irrigated Indo-Gangetic Plain (Light).
          </p>
        </div>
        <div className="map-toolbar">
          <div className="unit-toggle map-view-toggle" role="group" aria-label="Map view mode">
            <button type="button" className={viewMode === 'world' ? 'active' : ''} onClick={() => setViewMode('world')}>
              🌍 World View
            </button>
            <button type="button" className={viewMode === 'regional' ? 'active' : ''} onClick={() => setViewMode('regional')}>
              🔍 25 km Fire Watch Zoom
            </button>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={overlay} onChange={e => onOverlay(e.target.checked)} />
            <span>Rainfall-trend rings</span>
          </label>
        </div>
      </div>

      <div className="map-wrap" id="regionMap">
        {viewMode === 'world' ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="radiogroup"
            aria-label="Global regions on the map — use arrow keys to move, Enter to choose"
          >
            <rect x="0" y="0" width={W} height={H} className="sea" />

            {/* Latitude / Longitude graticule lines */}
            {[20, 35, 50].map(lat => (
              <g key={`lat-${lat}`}>
                <line x1={0} y1={my(lat)} x2={W} y2={my(lat)} className="graticule" />
                <text x={12} y={my(lat) - 6} className="graticule-label">{lat}° N</text>
              </g>
            ))}
            {[-100, -50, 0, 50, 80].map(lon => (
              <g key={`lon-${lon}`}>
                <line x1={mx(lon)} y1={0} x2={mx(lon)} y2={H} className="graticule" />
                <text x={mx(lon) + 6} y={H - 10} className="graticule-label">
                  {lon === 0 ? '0°' : lon > 0 ? `${lon}° E` : `${Math.abs(lon)}° W`}
                </text>
              </g>
            ))}

            {/* Continental landmasses */}
            {CONTINENTS.map((d, i) => <path key={i} d={d} className="land" />)}

            <text x={mx(-98)} y={my(48)} className="zone">North America</text>
            <text x={mx(8)} y={my(26)} className="zone">North Africa · Mediterranean</text>
            <text x={mx(76)} y={my(22)} className="zone">Indo-Gangetic Plain</text>

            {ids.map(id => {
              const r = REGIONS[id], t = trends[id], on = id === selected;
              const x = mx(r.lon), y = my(r.lat);
              const fireCount = r.fires?.count || 0;
              return (
                <g
                  key={id}
                  ref={el => { refs.current[id] = el; }}
                  className={`marker${on ? ' on' : ''}`}
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  aria-label={`${r.name} (${r.role === 'deep' ? 'Deep validated' : 'Less validated'}), ${fmtRain(r.rain, units)} per year${t ? `, rainfall trend ${fmtRainTrend(t.decade, units)}, ${SIG_LABEL[t.sig]}` : ''}`}
                  onClick={() => onSelect(id)}
                  onKeyDown={e => onKey(e, id)}
                >
                  {overlay && t && (
                    <circle cx={x} cy={y} r={16 + Math.abs(t.decade) * 0.65} className={`trend-ring sig-${t.sig}`} />
                  )}
                  <circle cx={x} cy={y} r="28" className="hit" />
                  <circle cx={x} cy={y} r={on ? 12 : 9} className={`dot role-${r.role}`} />
                  {fireCount > 0 && (
                    <g transform={`translate(${x + 11}, ${y - 13})`}>
                      <circle r="9" className="fire-dot-bg" />
                      <text textAnchor="middle" dy="3.5" className="fire-dot-txt">{fireCount}</text>
                    </g>
                  )}
                  <text x={x} y={y - 20} textAnchor="middle" className="map-name">
                    {r.areaName}, {r.country}
                  </text>
                  <text x={x} y={y + 26} textAnchor="middle" className="map-detail">
                    {r.role === 'deep' ? '● Deep' : '◐ Less validated'} · {r.farmingSystem} · {fmtRain(r.rain, units)}/yr
                  </text>
                  {t && (
                    <text x={x} y={y + 43} textAnchor="middle" className="map-detail sub">
                      {fmtRainTrend(t.decade, units)}
                    </text>
                  )}
                </g>
              );
            })}

            {state.region.startsWith('custom_') && (
              <g className="marker on" transform={`translate(${mx(region.lon)}, ${my(region.lat)})`}>
                <circle r="11" className="dot role-custom" />
                <text y="-16" textAnchor="middle" className="map-name">{region.short}</text>
              </g>
            )}
          </svg>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            aria-label={`25 km Fire Watch regional zoom around ${region.name}`}
          >
            <rect x="0" y="0" width={W} height={H} className="land" />
            {/* 25 km radius circle */}
            <circle cx={W / 2} cy={H / 2} r={135} className="radius-25km" />
            <circle cx={W / 2} cy={H / 2} r={68} className="radius-12km" />
            <text x={W / 2 + 142} y={H / 2 - 6} className="graticule-label">25 km FIRMS search radius</text>
            <text x={20} y={32} className="zone">
              {region.name} · {fmtCoord(region.lat, region.lon)} · {region.agroZone}
            </text>

            {/* Farm center marker */}
            <g transform={`translate(${W / 2}, ${H / 2})`}>
              <circle r="11" className="dot" style={{ fill: 'var(--primary)' }} />
              <text y="26" textAnchor="middle" className="map-name">{region.areaName} Center</text>
            </g>

            {/* Fire Watch detection pins */}
            {(fires?.detections || []).map((d, idx) => {
              const fx = d.lon != null ? rx(d.lon) : W / 2 + (idx + 1) * 45;
              const fy = d.lat != null ? ry(d.lat) : H / 2 - (idx + 1) * 35;
              return (
                <g key={idx} transform={`translate(${fx}, ${fy})`} className="fire-pin">
                  <circle r="14" className="fire-pulse" />
                  <circle r="8" className="fire-dot-bg" />
                  <text y="-14" textAnchor="middle" className="map-detail">
                    🔥 {d.km} km · {d.date} ({d.time} UTC)
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="map-legend" aria-hidden="true">
        <span className="lg"><i className="lg-dot on" />Selected region</span>
        <span className="lg"><i className="lg-dot" />Candidate region</span>
        <span className="lg"><i className="lg-fire" />NASA FIRMS fire count (last 2 days, 25 km)</span>
        <span className="lg"><i className="lg-ring" />Decadal rainfall trend ring</span>
      </div>
      <p className="map-note">
        NASA POWER grid cells (~50 km) represent flat regional farmland. Switch to “25 km Fire Watch Zoom” to inspect satellite thermal anomalies around the active region.
      </p>
    </div>
  );
}
