// Step 2 — usual 3-year rotation, regionally sourced allowed crops (inner join of crops_base.csv and yield.csv),
// and custom crop builder with automatic regional climate/pH compatibility gate.
import { useState, useMemo } from 'react';
import { CROP_PRESETS, FAMILY_LABEL } from '../data/crops';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { catalogCropFit, cropFit, cropProblems } from '../utils/agronomy';
import { rankDynamicCropsForRegion } from '../utils/localEngine';
import { fmtRain, fmtYield } from '../utils/format';
import { StepHead, StepNav } from '../components/Layout';
import { Alert } from '../components/ui';

const groupByFamily = list => list.reduce((acc, c) => ((acc[c.family] ||= []).push(c), acc), {});

const EMPTY_FORM = { name: '', family: 'legume', rMin: 350, rMax: 650, pMin: 6.0, pMax: 8.2, price: 12000, yield: 14, frost: true, heat: true };

function RotationCard() {
  const { state, dispatch, crops, cropById, region } = useFarm();
  const groups = groupByFamily(crops);
  const fams = state.rotation.map(id => cropById(id)?.family);
  const hasLegume = fams.includes('legume');
  const cerealRun = fams.some((f, i) => f === 'cereal' && fams[i + 1] === 'cereal');

  return (
    <div className="card">
      <div className="card-title-row">
        <h3>Your usual {state.rotation.length}-year rotation</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="period-pills" role="group" aria-label="Rotation period length">
            {[2, 3, 4, 5].map(yr => (
              <button
                key={yr}
                type="button"
                className={`btn btn-sm ${state.rotation.length === yr ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => dispatch({ type: 'setRotationLength', length: yr })}
                title={
                  yr === 2 ? '2-year fast alternating cereal-legume cycle' :
                  yr === 3 ? '3-year standard cereal-legume-diversification cycle (Engine Default)' :
                  yr === 4 ? '4-year extended cycle adding oilseed/break crop' :
                  '5-year soil restoration cycle with multi-year forage legume'
                }
              >
                {yr} Years{yr === 3 ? ' ★' : ''}
              </button>
            ))}
          </div>
          <span className={`sys-pill sys-${region.farmingSystem}`}>
            {region.farmingSystem === 'irrigated' ? '💧 Irrigated' : '🌧️ Rainfed'} · 1 crop / yr model
          </span>
        </div>
      </div>
      <p className="sub">
        Select your planning horizon (<b>2, 3, 4, or 5 years</b>) and what you normally plant each year in <b>{region.name}</b>.
      </p>
      <div className="timeline" style={{ gridTemplateColumns: `repeat(${state.rotation.length * 2 - 1}, auto)` }}>
        {state.rotation.map((_, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {i > 0 && <div className="arrow" aria-hidden="true">→</div>}
            <div>
              <label className="year-badge" htmlFor={`y${i}`}>Year {i + 1}</label>
              <select
                id={`y${i}`}
                value={cropById(state.rotation[i]) ? state.rotation[i] : (crops[0]?.id || 'durum')}
                onChange={e => dispatch({ type: 'rotation', year: i, crop: e.target.value })}
              >
                {Object.entries(groups).map(([fam, list]) => (
                  <optgroup key={fam} label={FAMILY_LABEL[fam] || fam}>
                    {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <div aria-live="polite">
        {hasLegume ? (
          <Alert tone="ok" icon="✓">Your rotation includes a nitrogen-fixing legume break crop.</Alert>
        ) : (
          <Alert tone="warn" icon="⚠️">
            <b>No legume in your plan.</b> {cerealRun ? 'Back-to-back cereals deplete soil nitrogen and' : 'Without a legume, crops'} require
            100% synthetic NPK fertilizer. Consider adding {region.country === 'USA' ? 'soybean' : region.country === 'India' ? 'mung bean or chickpea' : 'chickpea, lentil or vetch'}.
          </Alert>
        )}
      </div>
    </div>
  );
}

function AllowedCropsCard() {
  const { state, set, dispatch, crops, cropById, region } = useFarm();
  const toast = useToast();
  const problems = cropProblems(state.allowed, cropById);
  const units = state.units;

  const dynamicCropRanking = useMemo(
    () =>
      rankDynamicCropsForRegion({
        region: state.region,
        custom: state.custom,
        priorities: state.priorities,
        scenario: state.scenario,
      }),
    [state.region, state.custom, state.priorities, state.scenario]
  );

  const dynamicById = useMemo(() => {
    const m = {};
    for (const item of dynamicCropRanking.crops || []) m[item.crop_id] = item;
    return m;
  }, [dynamicCropRanking]);

  const resetDefaults = () => {
    const prev = state.allowed;
    set({ allowed: [...region.defaultCrops, ...(region.suggestedCrops || []), ...state.custom.map(c => c.id)] });
    toast(`Reset to recommended crops for ${region.areaName}.`, () => set({ allowed: prev }));
  };

  const selectAllSourced = () => {
    const prev = state.allowed;
    set({ allowed: crops.map(c => c.id) });
    toast(`Selected all ${crops.length} sourced crops for ${region.areaName}.`, () => set({ allowed: prev }));
  };

  return (
    <div className="card">
      <div className="head-row" style={{ marginBottom: 8 }}>
        <div>
          <h3>Dynamic Regional Crop Suitability &amp; Confidence ({region.name})</h3>
          <p className="sub" style={{ marginBottom: 0 }}>
            Dynamically scored against <code>soil.json</code> (SOC {dynamicCropRanking.soc.toFixed(2)} g/kg),{' '}
            <code>indicators.json</code> ({dynamicCropRanking.effRain} mm/yr), and Sen’s Slope drying velocity (
            <b>{dynamicCropRanking.senSlopeDecade >= 0 ? '+' : ''}{dynamicCropRanking.senSlopeDecade} mm/decade</b>).
          </p>
        </div>
        <div className="chip-toolbar">
          <button type="button" className="btn btn-sm btn-secondary" onClick={resetDefaults}>
            Reset to recommended mix ({region.defaultCrops.length + (region.suggestedCrops || []).length})
          </button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={selectAllSourced}>
            Select all sourced ({crops.length})
          </button>
        </div>
      </div>

      {/* Problematic 1 Fix: Live Dynamic Crop Suitability & Sen's Slope Shift Banner */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'var(--surface-2)',
          border: '1px solid var(--line)',
          marginBottom: '14px',
          fontSize: '0.86rem',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          🔬 Top Dynamically Ranked Crops for Current Soil + Sen’s Slope Drying Trend ({dynamicCropRanking.senSlopeDecade} mm/decade):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(dynamicCropRanking.crops || []).slice(0, 5).map(cr => (
            <span
              key={cr.crop_id}
              title={cr.rule_trace}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'var(--primary-soft)',
                color: 'var(--primary-strong)',
                border: '1px solid var(--primary)',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            >
              #{cr.rank} {cr.name} · <b>{Math.round(cr.suitability_pct)}%</b> fit ({Math.round(cr.confidence_pct)}% conf)
            </span>
          ))}
        </div>
      </div>

      {Object.entries(groupByFamily(crops)).map(([fam, list]) => (
        <div className="family" role="group" aria-label={FAMILY_LABEL[fam] || fam} key={fam}>
          <h4>{FAMILY_LABEL[fam] || fam}</h4>
          <div className="chips">
            {[...list]
              .sort((a, b) => (dynamicById[b.id]?.suitability_score ?? 0) - (dynamicById[a.id]?.suitability_score ?? 0))
              .map(c => {
              const fit = catalogCropFit(region, c);
              const dyn = dynamicById[c.id];
              const isDefault = region.defaultCrops.includes(c.id);
              const isSuggested = (region.suggestedCrops || []).includes(c.id);
              const yldText = c.yieldQ > 0 ? fmtYield(c.yieldQ, units) : 'Rest year';
              const tip = [
                `${c.name}: ${yldText}`,
                dyn ? `Dynamic Score: ${Math.round(dyn.suitability_pct)}/100 · Confidence: ${Math.round(dyn.confidence_pct)}%` : '',
                dyn?.rule_trace || '',
                c.yieldSource ? `Source: ${c.yieldSource}` : '',
                c.rainOpt ? `Opt rain: ${fmtRain(c.rainOpt[0], units)}–${fmtRain(c.rainOpt[1], units)}` : '',
                ...(fit.issues || []),
              ].filter(Boolean).join(' · ');

              return (
                <div className="chip" key={c.id} title={tip}>
                  <input
                    type="checkbox"
                    id={`c-${c.id}`}
                    checked={state.allowed.includes(c.id)}
                    onChange={() => dispatch({ type: 'toggleAllowed', id: c.id })}
                  />
                  <label htmlFor={`c-${c.id}`}>
                    <span>{c.name}</span>
                    <em className="chip-yield">{yldText}</em>
                    {dyn && (
                      <em className="chip-default" style={{ fontWeight: 700 }}>
                        #{dyn.rank} · {Math.round(dyn.suitability_pct)}% ({Math.round(dyn.confidence_pct)}% conf)
                      </em>
                    )}
                    {isSuggested && <em className="chip-suggested">★ suggested</em>}
                    {fit.level === 'warn' && !region.isIrrigated && <em className="chip-fit warn"> ⚠️</em>}
                    {fit.level === 'bad' && !region.isIrrigated && <em className="chip-fit bad"> ✕</em>}
                    {c.custom && <em> custom</em>}
                  </label>
                  {c.custom && (
                    <button
                      type="button"
                      className="chip-del"
                      aria-label={`Remove ${c.name}`}
                      onClick={() => dispatch({ type: 'removeCustom', id: c.id })}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div aria-live="polite">
        {problems.length ? (
          <Alert tone="warn" icon="⚠️"><b>Almost there:</b> {problems.join(', ')}.</Alert>
        ) : (
          <Alert tone="ok" icon="✓">
            <b>{state.allowed.length} crops selected</b> for {region.name} — includes at least one cereal and one nitrogen-fixing legume.
          </Alert>
        )}
      </div>
    </div>
  );
}

function CustomCropCard() {
  const { dispatch, crops, region } = useFarm();
  const toast = useToast();
  const [f, setF] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState('');
  const fit = cropFit(region, f);
  const upd = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const fillPreset = name => {
    const [family, rMin, rMax, pMin, pMax, price, yld, frost, heat] = CROP_PRESETS[name];
    setF({ name, family, rMin, rMax, pMin, pMax, price, yield: yld, frost, heat });
    setNameError('');
  };

  const submit = e => {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) return setNameError('Enter a crop name.');
    const id = `custom-${name.toLowerCase().replace(/\W+/g, '-')}`;
    if (crops.some(c => c.id === id || c.name.toLowerCase() === name.toLowerCase())) {
      return setNameError(`“${name}” is already in your list.`);
    }
    if (fit.level === 'invalid' || (fit.level === 'bad' && !region.isIrrigated)) return undefined;
    dispatch({
      type: 'addCustom',
      crop: {
        id,
        name,
        family: f.family,
        custom: true,
        rain: [+f.rMin, +f.rMax],
        ph: [+f.pMin, +f.pMax],
        price: +f.price,
        yield: +f.yield,
        yieldQ: +f.yield,
        frost: !!f.frost,
        heat: !!f.heat,
      },
    });
    setF(prev => ({ ...prev, name: '' }));
    toast(`${name} added to your farm and included in Step 6 scoring.`, () => dispatch({ type: 'removeCustom', id }));
    return undefined;
  };

  const fitView = {
    ok: ['ok', '✓', 'Compatible with regional climate & soil pH'],
    warn: ['warn', '⚠️', 'Possible, with agronomic caution'],
    bad: ['danger', '✕', region.isIrrigated ? 'Outside rainfall range (allowed under irrigation)' : 'Not suitable for local rainfall/pH — cannot be added'],
  }[fit.level];

  return (
    <div className="card tinted">
      <h3>Add a custom crop</h3>
      <p className="sub">Checked automatically against the rainfall, frost, heat and soil pH ({region.phScalar}) of {region.name}.</p>
      <div className="presets">
        <span>Quick fill:</span>
        {Object.keys(CROP_PRESETS).map(n => (
          <button type="button" className="preset" key={n} onClick={() => fillPreset(n)}>{n}</button>
        ))}
      </div>

      <form className="form-grid" noValidate onSubmit={submit}>
        <div className="full">
          <label className="field" htmlFor="cName">Crop name</label>
          <input
            id="cName"
            type="text"
            placeholder="e.g. Field Pea"
            autoComplete="off"
            value={f.name}
            aria-invalid={nameError ? 'true' : 'false'}
            aria-describedby={nameError ? 'cNameErr' : undefined}
            onChange={e => { upd('name', e.target.value); setNameError(''); }}
          />
          {nameError && <div id="cNameErr" className="error" role="alert">{nameError}</div>}
        </div>
        <div>
          <label className="field" htmlFor="cFam">Crop family</label>
          <select id="cFam" value={f.family} onChange={e => upd('family', e.target.value)}>
            {Object.entries(FAMILY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <span className="field" id="rainLbl">Rain needed (mm/year)</span>
          <div className="pair" role="group" aria-labelledby="rainLbl">
            <input type="number" aria-label="Minimum rain mm" min="50" max="2000" step="10" value={f.rMin} onChange={e => upd('rMin', e.target.value)} />
            <input type="number" aria-label="Maximum rain mm" min="100" max="2500" step="10" value={f.rMax} onChange={e => upd('rMax', e.target.value)} />
          </div>
          <div className="hint">{region.areaName} gets {region.rain} mm/year</div>
        </div>
        <div>
          <span className="field" id="phLbl">Soil pH range</span>
          <div className="pair" aria-labelledby="phLbl">
            <input type="number" aria-label="Minimum pH" min="4" max="9" step="0.1" value={f.pMin} onChange={e => upd('pMin', e.target.value)} />
            <input type="number" aria-label="Maximum pH" min="4" max="9.5" step="0.1" value={f.pMax} onChange={e => upd('pMax', e.target.value)} />
          </div>
          <div className="hint">{region.areaName} topsoil pH is {region.phScalar}</div>
        </div>
        <div>
          <span className="field" id="econLbl">Price (DA-equiv/q) &amp; expected yield (q/ha)</span>
          <div className="pair" aria-labelledby="econLbl">
            <input type="number" aria-label="Price per quintal" min="500" max="80000" step="500" value={f.price} onChange={e => upd('price', e.target.value)} />
            <input type="number" aria-label="Expected yield quintals per hectare" min="1" max="150" step="1" value={f.yield} onChange={e => upd('yield', e.target.value)} />
          </div>
        </div>
        <div className="full">
          <label className="checkbox">
            <input type="checkbox" checked={f.frost} onChange={e => upd('frost', e.target.checked)} />
            Survives spring frost ({region.frostDays} nights/yr in {region.areaName})
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={f.heat} onChange={e => upd('heat', e.target.checked)} />
            Tolerates grain-filling heat ({region.hotDays} days/yr in {region.areaName})
          </label>
        </div>

        <div className="full" aria-live="polite">
          {fit.level === 'invalid' ? (
            <Alert tone="danger" icon="✕">{fit.msg}</Alert>
          ) : (
            <Alert tone={fitView[0]} icon={fitView[1]}>
              <div>
                <b>{fitView[2]} for {region.name}.</b>
                {fit.issues.length > 0 ? (
                  <ul>{fit.issues.map(x => <li key={x}>{x}</li>)}</ul>
                ) : (
                  <div>Rain and soil pH match local conditions.</div>
                )}
              </div>
            </Alert>
          )}
        </div>

        <div className="full">
          <button type="submit" className="btn btn-primary" disabled={fit.level === 'invalid' || (fit.level === 'bad' && !region.isIrrigated)}>
            + Check &amp; add crop
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RotationStep() {
  const { region } = useFarm();
  return (
    <section aria-labelledby="t2">
      <StepHead
        id="t2"
        eyebrow="Step 2 of 6 · Regional Crop Catalogue"
        title={`Your rotation & crops in ${region.areaName}`}
        badges={
          <>
            {region.lessValidated && <span className="role-pill role-light">Less validated</span>}
            <span className={`sys-pill sys-${region.farmingSystem}`}>
              {region.farmingSystem === 'irrigated' ? '💧 Irrigated' : '🌧️ Rainfed'}
            </span>
          </>
        }
      >
        Tell us what you plant today and which regionally sourced crops you can grow. The engine inner-joins global crop traits
        with {region.country} yield data so only validated crops for {region.areaName} are offered.
      </StepHead>

      <div className="grid">
        <RotationCard />
        <AllowedCropsCard />
        <CustomCropCard />
      </div>

      <StepNav back={{ to: 1, label: '← Back: region' }} next={{ to: 3, label: 'Next: priorities →' }} />
    </section>
  );
}
