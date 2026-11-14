// Schematic map of northern Algeria with the candidate regions and a
// NASA POWER rainfall-trend overlay. Marker positions use real lat/lon.
import { useRef } from 'react';
import { REGIONS } from '../../data/regions';
import { SIG_LABEL, SIG_SHORT } from '../../utils/agronomy';
import './RegionMap.css';

const W = 900, H = 440;
const LON = [-1.0, 8.8], LAT = [37.3, 34.0];
const COAST = [[-1, 35.45], [-0.6, 35.75], [0.1, 35.9], [0.9, 36.2], [1.6, 36.55], [2.4, 36.6], [3.06, 36.78],
  [3.9, 36.9], [4.6, 36.85], [5.08, 36.76], [5.7, 36.82], [6.4, 37.05], [6.9, 36.9], [7.77, 36.92], [8.8, 36.95]];
const CITIES = [['Oran', 35.70, -0.63], ['Algiers', 36.75, 3.06], ['Annaba', 36.90, 7.77]];
const LABEL_SIDE = { regionA: 'left', regionB: 'right', regionC: 'right' }; // keeps neighbours apart

const mx = lon => (lon - LON[0]) / (LON[1] - LON[0]) * W;
const my = lat => (LAT[0] - lat) / (LAT[0] - LAT[1]) * H;

const pts = COAST.map(([lo, la]) => `${mx(lo).toFixed(1)},${my(la).toFixed(1)}`);
const COAST_PATH = `M${pts.join(' L')}`;
const SEA_PATH = `M0,0 L${W},0 ${[...pts].reverse().map(p => `L${p}`).join(' ')} Z`;
const LAND_PATH = `${COAST_PATH} L${W},${H} L0,${H} Z`;

function Band({ from, to, className }) {
  return <rect x="0" y={my(from)} width={W} height={my(to) - my(from)} className={className} clipPath="url(#landClip)" />;
}

export default function RegionMap({ selected, trends, overlay, onOverlay, onSelect }) {
  const refs = useRef({});
  const ids = Object.keys(REGIONS);

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

  return (
    <div className="card map-card">
      <div className="head-row" style={{ marginBottom: 0 }}>
        <div>
          <h3>Candidate regions &amp; rainfall trend</h3>
          <p className="sub" style={{ marginBottom: 0 }}>NASA POWER 1995–2024. A bigger circle means rain is falling faster.</p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={overlay} onChange={e => onOverlay(e.target.checked)} /> Show rainfall-trend overlay
        </label>
      </div>

      <div className="map-wrap" id="regionMap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="radiogroup"
          aria-label="Regions on the map — use arrow keys to move, Enter to choose">
          <defs><clipPath id="landClip"><path d={LAND_PATH} /></clipPath></defs>
          <path d={SEA_PATH} className="sea" />
          <path d={LAND_PATH} className="land" />
          <Band from={36.3} to={34.6} className="band-plateaux" />
          <Band from={34.6} to={33.9} className="band-sahara" />
          <path d={COAST_PATH} className="coast" />
          <text x={mx(1.3)} y={my(37.0)} className="zone sea-label">Mediterranean Sea</text>
          <text x={mx(3.6)} y={my(35.0)} className="zone">High Plateaux</text>
          <text x={mx(4.2)} y={my(34.2)} className="zone">Saharan Atlas</text>

          {CITIES.map(([name, la, lo]) => (
            <g key={name}>
              <circle cx={mx(lo)} cy={my(la)} r="3.5" className="city" />
              <text x={mx(lo) + 8} y={my(la) + 18} className="city-name">{name}</text>
            </g>
          ))}

          {ids.map(id => {
            const r = REGIONS[id], t = trends[id], on = id === selected;
            const x = mx(r.lon), y = my(r.lat);
            const left = LABEL_SIDE[id] === 'left', dx = left ? -20 : 20, anchor = left ? 'end' : 'start';
            return (
              <g key={id} ref={el => { refs.current[id] = el; }}
                className={`marker${on ? ' on' : ''}`} role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
                aria-label={`${r.name}, ${r.rain} mm per year${t ? `, rainfall trend ${t.decade.toFixed(1)} mm per decade, ${SIG_LABEL[t.sig]}` : ''}`}
                onClick={() => onSelect(id)} onKeyDown={e => onKey(e, id)}>
                {overlay && t && (
                  <circle cx={x} cy={y} r={14 + Math.abs(t.decade) * 1.1} className={`trend-ring sig-${t.sig}`} />
                )}
                <circle cx={x} cy={y} r="26" className="hit" />
                <circle cx={x} cy={y} r={on ? 13 : 10} className="dot" />
                <text x={x + dx} y={y + 6} textAnchor={anchor} className="map-name">{r.short}</text>
                {t && (
                  <>
                    <text x={x + dx} y={y + 28} textAnchor={anchor} className="map-detail">{t.decade.toFixed(1)} mm/decade</text>
                    <text x={x + dx} y={y + 46} textAnchor={anchor} className="map-detail sub">{SIG_SHORT[t.sig]}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="map-legend" aria-hidden="true">
        <span className="lg"><i className="lg-dot on" />Selected region</span>
        <span className="lg"><i className="lg-dot" />Other region</span>
        <span className="lg"><i className="lg-ring" />Clear drying trend</span>
        <span className="lg"><i className="lg-ring dashed" />Trend not significant</span>
      </div>
      <p className="map-note">Schematic map of northern Algeria, not to scale. Marker positions use real coordinates.</p>
    </div>
  );
}
