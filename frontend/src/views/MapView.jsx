// Additional view — Regional Agricultural Climate Map: the 3 featured regions with a rainfall-trend overlay.
import { useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { useI18n } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useNav } from '../state/NavContext';
import { useToast } from '../state/ToastContext';
import { useRegionTrends } from '../hooks/useData';
import { useWidth } from '../hooks/useWidth';
import { REGIONS, REGION_IDS, fmtCoord } from '../data/regions';
import { LAND, BORDERS, GRATICULE } from '../components/globe/world';
import { signed } from '../utils/format';
import { PageHead, SampleNotice } from '../components/ui';
import './MapView.css';

// Trend classes (mm/decade) — diverging: drying (warm) ← stable (gray) → wetter (blue)
const CLASSES = [
  { id: 'strong', test: d => d <= -30, color: '#b5523b' },
  { id: 'dry', test: d => d > -30 && d <= -5, color: '#c49a6c' },
  { id: 'stable', test: d => d > -5 && d < 5, color: '#9a9384' },
  { id: 'wet', test: d => d >= 5, color: '#3a7fae' },
];
const classOf = d => CLASSES.find(c => c.test(d)) || CLASSES[2];

// Schematic agricultural belts (lon/lat boxes) and sea labels
const BELTS = [
  { id: 'plains', box: [-103, 33, -95, 49], label: [-99, 50.5] },
  { id: 'maghreb', box: [-1, 34.3, 9, 36.6], label: [4, 29.5] },
  { id: 'gangetic', box: [72, 24, 88, 31.5], label: [86, 22] },
];
const SEAS = [
  { id: 'med', at: [22, 34.2] }, { id: 'atl', at: [-40, 32] }, { id: 'arab', at: [64, 15] }, { id: 'gulf', at: [-90, 23.5] },
];
const box = ([x0, y0, x1, y1]) => ({ type: 'Polygon', coordinates: [[[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]] });

export default function MapView() {
  const { t, dir } = useI18n();
  const { state, set } = useFarm();
  const { go } = useNav();
  const toast = useToast();
  const trends = useRegionTrends();
  const [ref, w] = useWidth(1100);
  const [open, setOpen] = useState(state.region);
  const overlay = state.mapOverlay;
  const h = Math.round(w * 0.46);

  const { path, proj } = useMemo(() => {
    const p = geoNaturalEarth1().fitExtent([[10, 10], [w - 10, h - 10]], { type: 'MultiPoint', coordinates: [[-124, 2], [112, 60]] });
    return { proj: p, path: geoPath(p) };
  }, [w, h]);

  const choose = id => {
    const prev = state.region;
    set({ region: id });
    toast(t('map.loaded', { region: t(`region.${id}.name`) }), () => set({ region: prev }));
  };

  const trendText = id => {
    const tr = trends[id];
    if (!tr) return '…';
    return `${signed(tr.decade, 1)} mm/${t('unit.decade')} (${t(`mapsig.${tr.sig}`)})`;
  };

  const sel = open && REGIONS[open] ? { id: open, ...REGIONS[open] } : null;

  return (
    <section aria-labelledby="map-title">
      <PageHead id="map-title" eyebrow={t('eyebrow.extra')} title={t('map.title')} sub={t('map.sub')} />
      <SampleNotice data={{ sample: Object.values(trends).some(x => x.sample) }} />

      <div className="map-toolbar">
        <label className="switch">
          <input type="checkbox" role="switch" checked={overlay} onChange={e => set({ mapOverlay: e.target.checked })} />
          <span className="switch-track" aria-hidden="true"><i /></span>
          {t('map.overlay')}
        </label>
        {overlay && (
          <ul className="map-legend" aria-label={t('map.legend')}>
            {CLASSES.map(c => <li key={c.id}><i style={{ background: c.color }} />{t(`map.class.${c.id}`)}</li>)}
          </ul>
        )}
      </div>

      <div className="map-frame" ref={ref} dir="ltr">
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={t('map.aria')}>
          <rect width={w} height={h} className="m-sea" />
          <path d={path(GRATICULE)} className="m-grat" />
          <path d={path(LAND)} className="m-land" />
          <path d={path(BORDERS)} className="m-border" />
          {BELTS.map(b => <path key={b.id} d={path(box(b.box))} className="m-belt" />)}
          {BELTS.map(b => { const [x, y] = proj(b.label); return <text key={b.id} x={x} y={y} className="m-belt-label" textAnchor="middle">{t(`map.belt.${b.id}`)}</text>; })}
          {SEAS.map(s => { const [x, y] = proj(s.at); return <text key={s.id} x={x} y={y} className="m-sea-label" textAnchor="middle">{t(`map.sea.${s.id}`)}</text>; })}
        </svg>

        {REGION_IDS.map(id => {
          const r = REGIONS[id];
          const [x, y] = proj([r.lon, r.lat]);
          const tr = trends[id];
          const cls = overlay && tr ? classOf(tr.decade) : null;
          return (
            <button key={id} type="button" className={`m-marker${open === id ? ' open' : ''}${state.region === id ? ' current' : ''}${tr?.sig === 'clear' ? ' agree' : ''}${x / w > 0.72 ? ' label-left' : ''}`}
              style={{ left: `${(x / w) * 100}%`, top: `${(y / h) * 100}%`, '--mc': cls ? cls.color : 'var(--forest)' }}
              aria-pressed={open === id} aria-label={`${t(`region.${id}.name`)}${overlay ? `, ${trendText(id)}` : ''}`}
              onClick={() => setOpen(open === id ? null : id)}>
              <span className="m-dot" aria-hidden="true" />
              <span className="m-label" aria-hidden="true" dir={dir}>
                <b>{t(`region.${id}.short`)}</b>{overlay && <small dir="ltr">{trendText(id)}</small>}
              </span>
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="m-popup" role="region" aria-live="polite" dir={dir} aria-labelledby="m-pop-title">
          <button type="button" className="m-close" onClick={() => setOpen(null)} aria-label={t('common.close')}>×</button>
          <h3 id="m-pop-title">{t(`region.${sel.id}.name`)}</h3>
          <p className="muted">{t(`country.${sel.countryCode}`)} · <span dir="ltr">{fmtCoord(sel.lat, sel.lon)}</span></p>
          <dl>
            <div><dt>{t('region.rain')}</dt><dd>{sel.est.includes('rain') ? '≈ ' : ''}{sel.rain} mm/{t('unit.yr')}</dd></div>
            <div><dt>{t('map.trend')}</dt><dd dir="ltr">{trendText(sel.id)}</dd></div>
          </dl>
          <p className="m-interp">{t(`region.${sel.id}.climate`)}</p>
          {state.region === sel.id ? (
            <div className="row">
              <span className="badge badge-good">✓ {t('map.current')}</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => go('strategy')}>{t('map.continue')} <span className="flip" aria-hidden="true">→</span></button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => choose(sel.id)}>📍 {t('map.select')}</button>
          )}
        </div>
      )}
      <p className="hint">{t('map.note')}</p>
    </section>
  );
}
