// PAGE 1.3 — Define your farming strategy: 3 priorities (always total 100) · usual rotation · allowed crops · custom crop.
import { useId, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { FAMILIES } from '../data/crops';
import { KEYS, PRIO, order, setMain, setSecond } from '../utils/priorities';
import { cropFit, cropProblems } from '../utils/agronomy';
import { rankDynamicCropsForRegion } from '../utils/localEngine';
import { Alert, PageHead, PageNav, RegionStrip } from '../components/ui';
import Icon from '../components/icons';
import AnalysisRunner from '../components/AnalysisRunner';
import './StrategyView.css';

/* ---------- Priorities: two steps, always 100 ---------- */
function Priorities() {
  const t = useT();
  const { state, set } = useFarm();
  const p = state.priorities;
  const { main, second, third } = order(p, state.prioMain, state.prioSecond);
  const rest = 100 - p[main];

  const pickMain = k => set({ prioMain: k, prioSecond: null, priorities: setMain(p, k, Math.max(p[k], 40)) });
  const pickSecond = k => set({ prioSecond: k, priorities: setSecond(p, main, k, p[k]) });

  return (
    <section className="card prio-card" aria-labelledby="prio-title">
      <h3 className="card-title" id="prio-title">{t('prio.title')}</h3>
      <p className="card-sub">{t('prio.subSteps')}</p>

      {/* live stacked bar */}
      <div className="prio-bar" role="img" aria-label={KEYS.map(k => `${t(`prio.${k}`)} ${p[k]}`).join(', ')}>
        {KEYS.map(k => p[k] > 0 && (
          <span key={k} className={`seg ${k}`} style={{ flexGrow: p[k] }}><b className="num">{p[k]}</b></span>
        ))}
      </div>
      <ul className="prio-legend">
        {KEYS.map(k => (
          <li key={k}><span className={`swatch ${k}`} aria-hidden="true" /><span className="stat md"><span className="label">{t(`prio.${k}`)}</span><span className="value">{p[k]}</span></span></li>
        ))}
      </ul>

      {/* Step A */}
      <fieldset className="prio-step">
        <legend><span className="step-no">A</span>{t('prio.stepA')}</legend>
        <div className="seg-control" role="radiogroup" aria-label={t('prio.stepA')}>
          {KEYS.map(k => (
            <button key={k} type="button" role="radio" aria-checked={k === main} className={k === main ? 'on' : ''} onClick={() => pickMain(k)}>
              <Icon name={k} size={18} /> {t(`prio.${k}`)}
            </button>
          ))}
        </div>
        <div className="prio-slider">
          <label htmlFor="prio-main">{t('prio.howMuch', { name: t(`prio.${main}`) })}</label>
          <output htmlFor="prio-main" className="big num">{p[main]}</output>
          <input id="prio-main" type="range" min="34" max="100" step="1" value={p[main]}
            style={{ '--pct': `${((p[main] - 34) / 66) * 100}%`, '--track-fill': PRIO[main].color }}
            onChange={e => set({ prioMain: main, prioSecond: null, priorities: setMain(p, main, +e.target.value) })} />
          <p className="hint">{t('prio.stepAHint', { n: Math.floor(rest / 2) })}</p>
        </div>
      </fieldset>

      {/* Step B */}
      {rest > 0 && (
        <fieldset className="prio-step">
          <legend><span className="step-no">B</span>{t('prio.stepB')}</legend>
          <div className="seg-control two" role="radiogroup" aria-label={t('prio.stepB')}>
            {KEYS.filter(k => k !== main).map(k => (
              <button key={k} type="button" role="radio" aria-checked={k === second} className={k === second ? 'on' : ''} onClick={() => pickSecond(k)}>
                <Icon name={k} size={18} /> {t(`prio.${k}`)}
              </button>
            ))}
          </div>
          <div className="prio-slider">
            <label htmlFor="prio-second">{t('prio.howMuch', { name: t(`prio.${second}`) })}</label>
            <output htmlFor="prio-second" className="big num">{p[second]}</output>
            <input id="prio-second" type="range" min="0" max={Math.min(rest, p[main])} step="1" value={p[second]}
              style={{ '--pct': `${(p[second] / Math.max(1, Math.min(rest, p[main]))) * 100}%`, '--track-fill': PRIO[second].color }}
              onChange={e => set({ prioSecond: second, priorities: setSecond(p, main, second, +e.target.value) })} />
            <p className="hint">{t('prio.stepBHint', { name: t(`prio.${third}`), n: p[third] })}</p>
          </div>
        </fieldset>
      )}
    </section>
  );
}

/* ---------- Usual rotation ---------- */
function UsualRotation() {
  const t = useT();
  const { state, dispatch, crops } = useFarm();
  return (
    <section className="card" aria-labelledby="rot-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <h3 className="card-title" id="rot-title" style={{ margin: 0 }}>{t('rot.title')}</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Period:</span>
          {[2, 3, 4, 5].map(len => (
            <button
              key={len}
              type="button"
              className={`chip ${state.rotation.length === len ? 'on' : ''}`}
              style={{ padding: '3px 8px', fontSize: '0.78rem', minHeight: 'unset' }}
              onClick={() => dispatch({ type: 'setRotationLength', length: len })}
            >
              {len} Yrs
            </button>
          ))}
        </div>
      </div>
      <p className="card-sub">{t('rot.sub')}</p>
      <ol className="rot-years">
        {state.rotation.map((cropId, y) => (
          <li key={y} className="field">
            <label htmlFor={`rot-${y}`}>{t('common.year', { n: y + 1 })}</label>
            <select id={`rot-${y}`} className="select" value={cropId}
              onChange={e => dispatch({ type: 'rotation', year: y, crop: e.target.value })}>
              {FAMILIES.map(f => {
                const list = crops.filter(c => c.family === f);
                return list.length ? (
                  <optgroup key={f} label={t(`family.${f}`)}>
                    {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Allowed crops ---------- */
function AllowedCrops() {
  const t = useT();
  const { state, dispatch, crops, cropById } = useFarm();
  const toast = useToast();
  const problems = cropProblems(state.allowed, cropById);

  const remove = c => {
    const prev = { custom: state.custom, allowed: state.allowed, rotation: state.rotation };
    dispatch({ type: 'removeCustom', id: c.id });
    toast(t('crop.removed', { name: c.name }), () => dispatch({ type: 'set', patch: prev }));
  };

  return (
    <section className="card" aria-labelledby="allowed-title">
      <div className="row">
        <h3 className="card-title" id="allowed-title">{t('crops.title')}</h3>
        <span className="spacer" />
        <span className="muted num" aria-live="polite" style={{ fontSize: 13 }}>{t('crops.count', { n: state.allowed.length })}</span>
      </div>
      <p className="card-sub">{t('crops.rule')}</p>

      {FAMILIES.map(f => {
        const list = crops.filter(c => c.family === f);
        if (!list.length) return null;
        return (
          <fieldset key={f} className="chip-group">
            <legend><Icon name={f} size={14} /> {t(`family.${f}`)}</legend>
            <div className="chips">
              {list.map(c => {
                const on = state.allowed.includes(c.id);
                return (
                  <span key={c.id} className="chip-wrap">
                    <button type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on}
                      onClick={() => dispatch({ type: 'toggleAllowed', id: c.id })}>
                      {on && <Check size={13} strokeWidth={2.5} aria-hidden="true" />}{c.name}
                      {c.custom && <span className="chip-tag">{t('crop.custom')}</span>}
                    </button>
                    {c.custom && (
                      <button type="button" className="chip-x" onClick={() => remove(c)} aria-label={t('crop.remove', { name: c.name })}>
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {problems.length > 0 && (
        <Alert tone="bad" role="alert" title={t('crops.invalid')}>
          <ul>{problems.map(p => <li key={p.key}>{t(p.key, p.vars)}</li>)}</ul>
        </Alert>
      )}
      <CustomCrop />
    </section>
  );
}

/* ---------- Custom crop creator ---------- */
const EMPTY = { name: '', family: 'legume', rMin: 300, rMax: 600, pMin: 6.5, pMax: 8.0, price: 5000, yield: 20, frost: false, heat: false };

function CustomCrop() {
  const t = useT();
  const uid = useId();
  const { region, crops, dispatch } = useFarm();
  const [f, setF] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const upd = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const fit = cropFit(region, f);
  const nameErr = !f.name.trim() ? 'err.name' : crops.some(c => c.name.toLowerCase() === f.name.trim().toLowerCase()) ? 'err.dupName' : null;
  const errors = { ...fit.errors, ...(nameErr ? { name: nameErr } : {}) };
  const show = k => submitted && errors[k];

  const onSubmit = e => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const crop = { ...f, id: `custom-${Date.now()}`, name: f.name.trim(), custom: true };
    dispatch({ type: 'addCustom', crop });
    setResult({ name: crop.name, fit });
    setF(EMPTY);
    setSubmitted(false);
  };

  const field = (k, label, props = {}) => (
    <div className="field">
      <label htmlFor={`${uid}-${k}`}>{label}</label>
      <input id={`${uid}-${k}`} className="input" value={f[k]} onChange={upd(k)} aria-invalid={Boolean(show(k))} {...props} />
    </div>
  );

  return (
    <details className="custom-crop">
      <summary><Plus size={16} aria-hidden="true" /> {t('custom.title')}</summary>
      <form onSubmit={onSubmit} noValidate>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor={`${uid}-name`}>{t('custom.name')}</label>
            <input id={`${uid}-name`} className="input" value={f.name} onChange={upd('name')} placeholder={t('custom.namePh')}
              aria-invalid={Boolean(show('name'))} aria-describedby={show('name') ? `${uid}-name-e` : undefined} />
            {show('name') && <span className="field-error" id={`${uid}-name-e`}>{t(errors.name)}</span>}
          </div>
          <div className="field span-2">
            <label htmlFor={`${uid}-family`}>{t('custom.family')}</label>
            <select id={`${uid}-family`} className="select" value={f.family} onChange={upd('family')}>
              {FAMILIES.map(x => <option key={x} value={x}>{t(`family1.${x}`)}</option>)}
            </select>
          </div>
          {field('rMin', t('custom.rMin'), { type: 'number', inputMode: 'numeric', min: 0, max: 3000, step: 10 })}
          {field('rMax', t('custom.rMax'), { type: 'number', inputMode: 'numeric', min: 0, max: 3000, step: 10 })}
          {show('rain') && <p className="field-error span-2">{t(errors.rain)}</p>}
          {field('pMin', t('custom.pMin'), { type: 'number', inputMode: 'decimal', min: 3, max: 10, step: 0.1 })}
          {field('pMax', t('custom.pMax'), { type: 'number', inputMode: 'decimal', min: 3, max: 10, step: 0.1 })}
          {show('ph') && <p className="field-error span-2">{t(errors.ph)}</p>}
          {field('price', t('custom.price'), { type: 'number', inputMode: 'numeric', min: 0, step: 100 })}
          {field('yield', t('custom.yield'), { type: 'number', inputMode: 'decimal', min: 0, step: 1 })}
          <label className="check"><input type="checkbox" checked={f.frost} onChange={upd('frost')} /> {t('custom.frost')}</label>
          <label className="check"><input type="checkbox" checked={f.heat} onChange={upd('heat')} /> {t('custom.heat')}</label>
        </div>
        <button type="submit" className="btn btn-secondary">{t('custom.add')}</button>
      </form>

      <div aria-live="polite">
        {result && (
          <div className="custom-result">
            <Alert tone="good" title={t('custom.added', { name: result.name })}>{t('custom.addedText')}</Alert>
            <Alert tone={result.fit.level === 'ok' ? 'good' : result.fit.level === 'warn' ? 'warn' : 'bad'}
              title={t(`fit.${result.fit.level}`, { region: t(`region.${region.id}.name`) })}>
              {result.fit.issues.length > 0
                ? <ul>{result.fit.issues.map(i => <li key={i.key}>{t(i.key, i.vars)}</li>)}</ul>
                : t('fit.okText')}
            </Alert>
          </div>
        )}
      </div>
    </details>
  );
}

function DynamicCropRankingSection() {
  const { state } = useFarm();
  const dyn = rankDynamicCropsForRegion({
    region: state.region,
    custom: state.custom,
    priorities: state.priorities,
    scenario: state.scenario,
  });
  const topCrops = (dyn?.crops || []).slice(0, 6);

  return (
    <section className="card" style={{ marginTop: 24, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>📊 Dynamic Crop Suitability Ranking</h3>
          <p className="card-sub" style={{ margin: 0 }}>
            Ranked deterministically against SoilGrids SOC, rainfall envelope, and Sen's slope drying trend.
          </p>
        </div>
        {dyn?.senSlopeDecade != null && (
          <span className="badge badge-warn" style={{ fontWeight: 700 }}>
            Sen's Slope: {dyn.senSlopeDecade > 0 ? '+' : ''}{dyn.senSlopeDecade} mm/decade
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 12 }}>
        {topCrops.map(c => (
          <div key={c.crop_id} className="card" style={{ padding: '10px 12px', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <strong>#{c.rank} {c.name}</strong>
              <span className="badge badge-good" style={{ fontWeight: 700 }}>{c.suitability_pct}% Fit</span>
            </div>
            <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 6 }}>
              Water Need: {c.water_need_pct}% · Drought Tol: {c.drought_tolerance_pct}% · N: {c.n_impact_kg_ha > 0 ? `+${c.n_impact_kg_ha}` : c.n_impact_kg_ha} kg/ha
            </div>
            <p className="hint" style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.35 }}>
              💡 {c.rule_trace}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function StrategyView() {
  const t = useT();
  return (
    <section aria-labelledby="strategy-title">
      <PageHead id="strategy-title" eyebrow={t('eyebrow.setup', { n: 2 })} title={t('strategy.title')} sub={t('strategy.sub')}>
        <RegionStrip />
      </PageHead>

      <div className="strategy-grid">
        <div><Priorities /></div>
        <div><UsualRotation /><AllowedCrops /></div>
      </div>

      <DynamicCropRankingSection />

      <section className="analyse" aria-labelledby="analyse-title">
        <div>
          <h3 className="card-title" id="analyse-title">{t('analyse.title')}</h3>
          <p className="card-sub">{t('analyse.text')}</p>
        </div>
        <AnalysisRunner />
      </section>

      <PageNav back="region" next="climate" />
    </section>
  );
}
