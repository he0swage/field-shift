// Step 2 — usual 3-year rotation, allowed crops, custom crop with regional fit check.
import { useState } from 'react';
import { CROP_PRESETS, FAMILY_LABEL } from '../data/crops';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { cropFit, cropProblems } from '../utils/agronomy';
import { StepHead, StepNav } from '../components/Layout';
import { Alert } from '../components/ui';

const groupByFamily = list => list.reduce((acc, c) => ((acc[c.family] ||= []).push(c), acc), {});

const EMPTY_FORM = { name: '', family: 'legume', rMin: 350, rMax: 600, pMin: 6.2, pMax: 8.2, price: 12000, yield: 12, frost: true, heat: true };

function RotationCard() {
  const { state, dispatch, crops, cropById } = useFarm();
  const groups = groupByFamily(crops);
  const fams = state.rotation.map(id => cropById(id)?.family);
  const hasLegume = fams.includes('legume');
  const cerealRun = fams.some((f, i) => f === 'cereal' && fams[i + 1] === 'cereal');

  return (
    <div className="card">
      <h3>Your usual 3-year rotation</h3>
      <p className="sub">What you normally plant in year 1, year 2 and year 3.</p>
      <div className="timeline">
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'contents' }}>
            {i > 0 && <div className="arrow" aria-hidden="true">→</div>}
            <div>
              <label className="year-badge" htmlFor={`y${i}`}>Year {i + 1}</label>
              <select id={`y${i}`} value={state.rotation[i]} onChange={e => dispatch({ type: 'rotation', year: i, crop: e.target.value })}>
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
        {hasLegume
          ? <Alert tone="ok" icon="✓">Your rotation includes a nitrogen-fixing legume.</Alert>
          : (
            <Alert tone="warn" icon="⚠️">
              <b>No legume in your plan.</b> {cerealRun ? 'Back-to-back cereals deplete soil nitrogen and' : 'Without a legume, crops'} need
              100% synthetic NPK fertilizer. Consider adding chickpea, lentil or vetch.
            </Alert>
          )}
      </div>
    </div>
  );
}

function AllowedCropsCard() {
  const { state, dispatch, crops, cropById } = useFarm();
  const problems = cropProblems(state.allowed, cropById);
  return (
    <div className="card">
      <h3>Crops you allow on your farm</h3>
      <p className="sub">Select at least 3 crops, including at least one cereal and one legume.</p>
      {Object.entries(groupByFamily(crops)).map(([fam, list]) => (
        <div className="family" role="group" aria-label={FAMILY_LABEL[fam] || fam} key={fam}>
          <h4>{FAMILY_LABEL[fam] || fam}</h4>
          <div className="chips">
            {list.map(c => (
              <div className="chip" key={c.id}>
                <input type="checkbox" id={`c-${c.id}`} checked={state.allowed.includes(c.id)}
                  onChange={() => dispatch({ type: 'toggleAllowed', id: c.id })} />
                <label htmlFor={`c-${c.id}`}>{c.name}{c.custom && <em> custom</em>}</label>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div aria-live="polite">
        {problems.length
          ? <Alert tone="warn" icon="⚠️"><b>Almost there:</b> {problems.join(', ')}.</Alert>
          : <Alert tone="ok" icon="✓"><b>{state.allowed.length} crops selected</b> — includes a cereal and a legume.</Alert>}
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
    if (fit.level === 'invalid' || fit.level === 'bad') return undefined;
    dispatch({
      type: 'addCustom',
      crop: { id, name, family: f.family, custom: true, rain: [+f.rMin, +f.rMax], ph: [+f.pMin, +f.pMax], price: +f.price, yield: +f.yield },
    });
    setF(prev => ({ ...prev, name: '' }));
    toast(`${name} added to your farm.`, () => dispatch({ type: 'removeCustom', id }));
    return undefined;
  };

  const fitView = {
    ok: ['ok', '✓', 'Good fit'],
    warn: ['warn', '⚠️', 'Possible, with caution'],
    bad: ['danger', '✕', 'Not suitable — cannot be added'],
  }[fit.level];

  return (
    <div className="card tinted">
      <h3>Add a custom crop</h3>
      <p className="sub">Checked automatically against the climate and soil of {region.name}.</p>
      <div className="presets">
        <span>Quick fill:</span>
        {Object.keys(CROP_PRESETS).map(n => <button type="button" className="preset" key={n} onClick={() => fillPreset(n)}>{n}</button>)}
      </div>

      <form className="form-grid" noValidate onSubmit={submit}>
        <div className="full">
          <label className="field" htmlFor="cName">Crop name</label>
          <input id="cName" type="text" placeholder="e.g. Field Pea" autoComplete="off" value={f.name}
            aria-invalid={!!nameError} aria-describedby={nameError ? 'cNameErr' : undefined}
            onChange={e => { upd('name', e.target.value); setNameError(''); }} />
          {nameError && <div className="error" id="cNameErr">{nameError}</div>}
        </div>
        <div className="full">
          <label className="field" htmlFor="cFam">Rotation family</label>
          <select id="cFam" value={f.family} onChange={e => upd('family', e.target.value)}>
            <option value="legume">Legume (fixes nitrogen)</option>
            <option value="cereal">Cereal</option>
            <option value="oilseed">Oilseed</option>
            <option value="other">Vegetable / other</option>
          </select>
        </div>
        <div>
          <span className="field" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Rainfall needed (mm/yr)</span>
          <div className="pair">
            <input type="number" min="0" value={f.rMin} aria-label="Minimum rainfall in mm" aria-invalid={!!fit.errors.rain} onChange={e => upd('rMin', e.target.value)} />
            <input type="number" min="0" value={f.rMax} aria-label="Maximum rainfall in mm" onChange={e => upd('rMax', e.target.value)} />
          </div>
          <div className="hint">Minimum – maximum</div>
        </div>
        <div>
          <span className="field" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Soil pH tolerated</span>
          <div className="pair">
            <input type="number" step="0.1" min="3" max="10" value={f.pMin} aria-label="Minimum soil pH" aria-invalid={!!fit.errors.ph} onChange={e => upd('pMin', e.target.value)} />
            <input type="number" step="0.1" min="3" max="10" value={f.pMax} aria-label="Maximum soil pH" onChange={e => upd('pMax', e.target.value)} />
          </div>
          <div className="hint">Minimum – maximum</div>
        </div>
        <div><label className="field" htmlFor="price">Expected price (DA/q)</label><input id="price" type="number" min="0" value={f.price} onChange={e => upd('price', e.target.value)} /></div>
        <div><label className="field" htmlFor="yld">Expected yield (q/ha)</label><input id="yld" type="number" min="0" value={f.yield} onChange={e => upd('yield', e.target.value)} /></div>
        <label className="checkbox"><input type="checkbox" checked={f.frost} onChange={e => upd('frost', e.target.checked)} /> Frost-hardy (below 0 °C)</label>
        <label className="checkbox"><input type="checkbox" checked={f.heat} onChange={e => upd('heat', e.target.checked)} /> Heat-tolerant (above 35 °C)</label>

        {fit.level === 'invalid' && <div className="full error">{Object.values(fit.errors).join(' ')}</div>}
        <div className="full" aria-live="polite">
          {fitView && (
            <Alert tone={fitView[0]} icon={fitView[1]} style={{ margin: 0 }}>
              <b>{fitView[2]}</b> for {region.name}.
              {fit.issues.length > 0 && <ul>{fit.issues.map(i => <li key={i}>{i}</li>)}</ul>}
            </Alert>
          )}
        </div>
        <div className="full"><button className="btn btn-primary" type="submit" style={{ width: '100%' }}>＋ Add crop to my farm</button></div>
      </form>
    </div>
  );
}

export default function RotationStep() {
  return (
    <section aria-labelledby="t2">
      <StepHead id="t2" eyebrow="Step 2 of 6" title="Your rotation & allowed crops">
        Tell us what you plant today and which crops you are willing to grow.
      </StepHead>
      <div className="grid">
        <RotationCard />
        <div className="grid grid-2">
          <AllowedCropsCard />
          <CustomCropCard />
        </div>
      </div>
      <StepNav back={{ to: 1, label: '← Back' }} next={{ to: 3, label: 'Next: priorities →' }} />
    </section>
  );
}
