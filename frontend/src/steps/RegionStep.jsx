// Step 1 — choose the farm's region (map + cards), see indicators and suggested priorities.
import { REGIONS } from '../data/regions';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { useRegionTrends } from '../hooks/useData';
import { presetFor } from '../utils/priorities';
import { socClass } from '../utils/agronomy';
import { StepHead, StepNav } from '../components/Layout';
import { Metric, WeightStack } from '../components/ui';
import RegionMap from '../components/map/RegionMap';

function RegionCard({ id, r, trend, checked, onSelect }) {
  return (
    <div className="region">
      <input type="radio" name="region" id={`r-${id}`} value={id} checked={checked} onChange={() => onSelect(id)} />
      <label htmlFor={`r-${id}`}>
        <span className="check" aria-hidden="true">✓</span>
        <div className="tag">{r.label}</div>
        <div className="name">{r.name}</div>
        <div className="meta">{r.lat.toFixed(2)}° N, {r.lon.toFixed(2)}° E · NASA POWER</div>
        <div className="rain">{r.rain} <small>mm / year</small></div>
        <dl className="region-facts">
          <div><dt>Rain trend</dt><dd>{trend ? `${trend.decade.toFixed(1)} mm/decade` : '…'}</dd></div>
          <div><dt>Water stress</dt><dd>{r.water}%</dd></div>
          <div><dt><abbr title="Soil organic carbon">SOC</abbr></dt><dd>{r.soc} g/kg</dd></div>
        </dl>
      </label>
    </div>
  );
}

export default function RegionStep() {
  const { state, set, region } = useFarm();
  const toast = useToast();
  const trends = useRegionTrends();
  const preset = presetFor(region);
  const est = k => region.est.includes(k);

  const selectRegion = id => {
    if (id === state.region) return;
    const prev = state.region;
    set({ region: id });
    toast(`Region set to ${REGIONS[id].name}.`, () => set({ region: prev }));
  };

  const applyPreset = () => {
    const prev = state.priorities;
    set({ priorities: preset });
    toast('Priorities updated from your region.', () => set({ priorities: prev }));
  };

  return (
    <section aria-labelledby="t1">
      <StepHead id="t1" eyebrow="Step 1 of 6" title="Where is your farm?">
        Click a region on the map or a card below. We load its climate, soil and vegetation history automatically.
      </StepHead>

      <RegionMap selected={state.region} trends={trends} overlay={state.mapOverlay}
        onOverlay={v => set({ mapOverlay: v })} onSelect={selectRegion} />

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Region</legend>
        <div className="regions">
          {Object.entries(REGIONS).map(([id, r]) => (
            <RegionCard key={id} id={id} r={r} trend={trends[id]} checked={id === state.region} onSelect={selectRegion} />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-2">
        <div className="card">
          <h3>Regional indicators</h3>
          <p className="sub">
            {region.name} · {region.lat.toFixed(2)}° N, {region.lon.toFixed(2)}° E · annual rainfall {region.rain} mm (NASA POWER)
          </p>
          <div className="metrics">
            <Metric icon="💧" label="Water stress" value={`${region.water}%`} pct={region.water} color="var(--water)" estimated={est('water')} />
            <Metric icon="🌱" label={<abbr title="Soil organic carbon">SOC</abbr>} value={`${region.soc} g/kg`}
              note={`${socClass(region.soc)} · SoilGrids`} estimated={est('soc')} />
            <Metric icon="❄️" label="Frost risk" value={`${region.frost}%`} pct={region.frost} color="var(--water)" estimated={est('frost')} />
            <Metric icon="🌀" label="Erosion risk" value={`${region.erosion}%`} pct={region.erosion} color="var(--soil)" estimated={est('erosion')} />
          </div>
        </div>
        <div className="card tinted">
          <h3>Suggested priorities</h3>
          <p className="sub">Calculated from your region&apos;s water stress, soil carbon and yield history. You can change them in step 3.</p>
          <WeightStack priorities={preset} />
          <button type="button" className="btn btn-primary" style={{ marginTop: 24, width: '100%' }} onClick={applyPreset}>
            Use these priorities
          </button>
        </div>
      </div>

      <StepNav next={{ to: 2, label: 'Next: rotation & crops →' }} />
    </section>
  );
}
