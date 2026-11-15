// Step 1 — choose the farm's region (World/Regional map + cards + optional Custom Coordinates),
// see verified indicators, Fire Watch satellite detections, and suggested priorities.
import { useState } from 'react';
import { REGIONS } from '../data/regions';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { useRegionTrends } from '../hooks/useData';
import { presetFor } from '../utils/priorities';
import { socClass } from '../utils/agronomy';
import { fmtCoord, fmtRain, fmtRainTrend, fmtTemp } from '../utils/format';
import { StepHead, StepNav } from '../components/Layout';
import { Alert, Metric, WeightStack } from '../components/ui';
import RegionMap from '../components/map/RegionMap';
import FireWatchCard from '../components/FireWatchCard';

function RegionCard({ id, r, trend, units, checked, onSelect }) {
  return (
    <div className="region">
      <input type="radio" name="region" id={`r-${id}`} value={id} checked={checked} onChange={() => onSelect(id)} />
      <label htmlFor={`r-${id}`}>
        <span className="check" aria-hidden="true">✓</span>
        <div className="region-badges">
          <span className={`role-pill role-${r.role}`}>
            {r.role === 'deep' ? '● Deep · Validated' : '◐ Light · Less validated'}
          </span>
          <span className={`sys-pill sys-${r.farmingSystem}`}>
            {r.farmingSystem === 'irrigated' ? '💧 Irrigated' : '🌧️ Rainfed'}
          </span>
        </div>
        <div className="name">{r.areaName}, {r.country}</div>
        <div className="meta">{fmtCoord(r.lat, r.lon)} · NASA POWER (2015–24)</div>
        <div className="rain">
          {fmtRain(r.rain, units)} <small>/ year</small>
        </div>
        <dl className="region-facts">
          <div><dt>Rain trend</dt><dd>{trend ? fmtRainTrend(trend.decade, units) : '…'}</dd></div>
          <div><dt>Water stress</dt><dd>{r.water10Pct}% {r.isIrrigated ? '(rain)' : ''}</dd></div>
          <div><dt><abbr title="Soil organic carbon">SOC</abbr></dt><dd>{r.soc} g/kg · pH {r.phScalar}</dd></div>
          <div><dt>Default crops</dt><dd>{r.defaultCrops.length} sourced</dd></div>
        </dl>
      </label>
    </div>
  );
}

function CustomCoordPanel() {
  const { state, selectRegion } = useFarm();
  const toast = useToast();
  const [lat, setLat] = useState('35.40');
  const [lon, setLon] = useState('1.30');
  const [loading, setLoading] = useState(false);

  const loadCustom = (la, lo) => {
    setLoading(true);
    setTimeout(() => {
      const id = `custom_${Number(la).toFixed(1)}_${Number(lo).toFixed(1)}`;
      selectRegion(id, { lat: Number(la), lon: Number(lo) });
      setLoading(false);
      toast(`Loaded satellite climate & soil for ${Number(la).toFixed(2)}°, ${Number(lo).toFixed(2)}° (Data only).`);
    }, 220);
  };

  return (
    <details className="card custom-coord-card" open={state.region.startsWith('custom_')}>
      <summary>
        <span>📍 <b>Optional: Test any coordinates</b> (NASA POWER + SoilGrids point lookup)</span>
        <span className="role-pill role-light">Pre-cached demo ready</span>
      </summary>
      <div className="custom-coord-body">
        <p className="sub" style={{ marginBottom: 14 }}>
          Enter flat-farmland coordinates or load our pre-tested example (Tiaret High Plateaux, 35.40° N, 1.30° E).
          Always displays the scope warning: <i>“Data only: crop values are not adjusted for this place.”</i>
        </p>
        <div className="custom-coord-controls">
          <div>
            <label className="field" htmlFor="custLat">Latitude (°N)</label>
            <input id="custLat" type="number" step="0.1" min="-55" max="65" value={lat} onChange={e => setLat(e.target.value)} />
          </div>
          <div>
            <label className="field" htmlFor="custLon">Longitude (°E / −°W)</label>
            <input id="custLon" type="number" step="0.1" min="-160" max="160" value={lon} onChange={e => setLon(e.target.value)} />
          </div>
          <div className="custom-coord-btns">
            <button type="button" className="btn btn-primary" disabled={loading} onClick={() => loadCustom(lat, lon)}>
              {loading ? 'Loading POWER + SoilGrids…' : 'Load coordinates'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setLat('35.40'); setLon('1.30'); loadCustom(35.4, 1.3); }}
            >
              Use pre-cached Tiaret (35.4° N, 1.3° E)
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}

export default function RegionStep() {
  const { state, set, selectRegion, region } = useFarm();
  const toast = useToast();
  const trends = useRegionTrends();
  const preset = presetFor(region);
  const conf = region.confidence || {};
  const units = state.units;

  const onChooseRegion = id => {
    if (id === state.region) return;
    const prev = state.region;
    selectRegion(id);
    toast(`Region set to ${REGIONS[id].name}. Default crops selected.`, () => selectRegion(prev));
  };

  const applyPreset = () => {
    const prev = state.priorities;
    set({ priorities: preset });
    toast('Priorities updated from your region.', () => set({ priorities: prev }));
  };

  return (
    <section aria-labelledby="t1">
      <StepHead
        id="t1"
        eyebrow="Step 1 of 6 · Global Multi-Region Pipeline"
        title="Where is your farm?"
        badges={
          <>
            <span className={`role-pill role-${region.role}`}>
              {region.role === 'deep' ? '● Deep Region (Validated)' : region.role === 'light' ? '◐ Less validated (Light Region)' : '📍 Custom Coordinates'}
            </span>
            <span className={`sys-pill sys-${region.farmingSystem}`}>
              {region.farmingSystem === 'irrigated' ? '💧 Irrigated System' : '🌧️ Rainfed System'}
            </span>
          </>
        }
      >
        Select one of the three benchmark regions on the map or cards below. Choosing a region loads its NASA POWER climate,
        ISRIC SoilGrids profile, NASA FIRMS Fire Watch snapshot, and regionally sourced default crops.
      </StepHead>

      <RegionMap
        selected={state.region}
        trends={trends}
        overlay={state.mapOverlay}
        onOverlay={v => set({ mapOverlay: v })}
        onSelect={onChooseRegion}
      />

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Region</legend>
        <div className="regions">
          {Object.entries(REGIONS).map(([id, r]) => (
            <RegionCard
              key={id}
              id={id}
              r={r}
              trend={trends[id]}
              units={units}
              checked={id === state.region}
              onSelect={onChooseRegion}
            />
          ))}
        </div>
      </fieldset>

      <CustomCoordPanel />

      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="card-title-row">
            <h3>Regional indicators — {region.name}</h3>
            {region.lessValidated && <span className="role-pill role-light">Less validated</span>}
          </div>
          <p className="sub">
            {fmtCoord(region.lat, region.lon)} · 2015–24 rain {fmtRain(region.rain10yr, units, 1)}/yr
            {' '}(ERA5 cross-check: {fmtRain(region.era5Rain, units, 1)}/yr · pH {region.phScalar} · {region.soilTexture})
          </p>

          {region.isIrrigated && (
            <Alert tone="warn" icon="💧" style={{ marginBottom: 16, marginTop: 0 }}>
              <b>Water stress is based on rainfall. Irrigated farms may differ.</b>
              {' '}({region.areaName} relies on canal and tube-well irrigation outside the monsoon window.)
            </Alert>
          )}

          <div className="metrics">
            <Metric
              icon="💧"
              label="Rainfall water stress"
              value={`${region.water10Pct}%`}
              pct={region.water10Pct}
              color="var(--water)"
              note={`2015–24 vs 30-yr ref (5-yr: ${region.water5yrPct}%)${region.isIrrigated ? ' · Rainfall-only metric' : ''}`}
              confidence={conf.rain || 'medium'}
            />
            <Metric
              icon="🌱"
              label={<abbr title="Soil organic carbon">SOC</abbr>}
              value={`${region.soc} g/kg`}
              note={`${socClass(region.soc)} · pH ${region.phScalar} · ISRIC SoilGrids`}
              confidence={conf.soil}
            />
            <Metric
              icon="❄️"
              label={`Frost (${region.frostWindow})`}
              value={`${region.frostDays} nights/yr`}
              note={`Nights < ${fmtTemp(region.thresholds?.frost_night_c ?? 0, units)} · POWER + ERA5`}
              confidence={conf.frost}
            />
            <Metric
              icon="☀️"
              label={`Heat stress (${region.hotWindow})`}
              value={`${region.hotDays} days/yr`}
              note={`Days > ${fmtTemp(region.hotThresholdC, units)} · MODIS NDVI ${region.ndvi}`}
              confidence={conf.hot}
            />
          </div>
          {region.soilNote && (
            <Alert tone="ok" icon="🌱" style={{ marginTop: 16 }}>
              <b>Local soil note:</b> {region.soilNote}
            </Alert>
          )}
        </div>

        <div className="card tinted">
          <h3>Suggested priorities</h3>
          <p className="sub">Computed from regional water stress and SoilGrids organic carbon class. Adjustable in step 3.</p>
          <WeightStack priorities={preset} />
          <button type="button" className="btn btn-primary" style={{ marginTop: 24, width: '100%' }} onClick={applyPreset}>
            Use these priorities
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <FireWatchCard regionId={state.region} />
      </div>

      <StepNav next={{ to: 2, label: 'Next: rotation & crops →' }} />
    </section>
  );
}
