// PAGE 1.3 — Define your farming strategy: 3 priorities (left) · usual rotation, allowed crops, custom crop (right).
import { useId, useState } from 'react';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { FAMILIES, FAMILY_ICON } from '../data/crops';
import { KEYS, PRIO, balance, total } from '../utils/priorities';
import { cropFit, cropProblems } from '../utils/agronomy';
import { Alert, PageHead, PageNav, RegionStrip } from '../components/ui';
import AnalysisRunner from '../components/AnalysisRunner';
import './StrategyView.css';

/* ---------- Priorities ---------- */
function Priorities() {
  const t = useT();
  const { state, set } = useFarm();
  const toast = useToast();
  const p = state.priorities;
  const sum = total(p);
  const ok = sum === 100;

  const onBalance = () => {
    const prev = p;
    set({ priorities: balance(p) });
    toast(t('prio.balanced'), () => set({ priorities: prev }));
  };

  return (
    <section className="card" aria-labelledby="prio-title">
      <h3 className="card-title" id="prio-title">{t('prio.title')}</h3>
      <p className="card-sub">{t('prio.sub')}</p>

      <div className="prio-list">
        {KEYS.map(k => (
          <div key={k} className="prio">
            <div className="prio-head">
              <span className="prio-icon" aria-hidden="true">{PRIO[k].icon}</span>
              <div className="prio-text">
                <label htmlFor={`prio-${k}`}>{t(`prio.${k}`)}</label>
                <p id={`prio-${k}-d`}>{t(`prio.${k}.d`)}</p>
              </div>
              <output htmlFor={`prio-${k}`} className="prio-value num">{p[k]}</output>
            </div>
            <input id={`prio-${k}`} type="range" min="0" max="100" step="1" value={p[k]}
              aria-describedby={`prio-${k}-d`}
              style={{ '--pct': `${p[k]}%`, '--track-fill': PRIO[k].color }}
              onChange={e => set({ priorities: { ...p, [k]: +e.target.value } })} />
          </div>
        ))}
      </div>

      <div className={`prio-total${ok ? ' ok' : ' bad'}`}>
        <div className="prio-stack" aria-hidden="true">
          {KEYS.map(k => <i key={k} style={{ width: `${(p[k] / Math.max(100, sum)) * 100}%`, background: PRIO[k].color }} />)}
        </div>
        <div className="row">
          <span className="prio-sum" aria-live="polite">
            {t('prio.total')}: <b className="num">{sum}</b> / 100 {ok ? '✓' : ''}
          </span>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBalance} disabled={ok}>⚖️ {t('prio.balance')}</button>
        </div>
        {!ok && <Alert tone="bad" role="alert">{t('err.total', { n: sum })}</Alert>}
      </div>
    </section>
  );
}

/* ---------- Usual rotation ---------- */
function UsualRotation() {
  const t = useT();
  const { state, dispatch, crops } = useFarm();
  return (
    <section className="card" aria-labelledby="rot-title">
      <h3 className="card-title" id="rot-title">{t('rot.title')}</h3>
      <p className="card-sub">{t('rot.sub')}</p>
      <ol className="rot-years">
        {[0, 1, 2].map(y => (
          <li key={y} className="field">
            <label htmlFor={`rot-${y}`}>{t('common.year', { n: y + 1 })}</label>
            <select id={`rot-${y}`} className="select" value={state.rotation[y]}
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
      <h3 className="card-title" id="allowed-title">{t('crops.title')}</h3>
      <p className="card-sub">{t('crops.rule')}</p>
      <p className="hint" aria-live="polite">{t('crops.count', { n: state.allowed.length })}</p>

      {FAMILIES.map(f => {
        const list = crops.filter(c => c.family === f);
        if (!list.length) return null;
        return (
          <fieldset key={f} className="chip-group">
            <legend><span aria-hidden="true">{FAMILY_ICON[f]}</span> {t(`family.${f}`)}</legend>
            <div className="chips">
              {list.map(c => {
                const on = state.allowed.includes(c.id);
                return (
                  <span key={c.id} className="chip-wrap">
                    <button type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on}
                      onClick={() => dispatch({ type: 'toggleAllowed', id: c.id })}>
                      <span className="chip-check" aria-hidden="true">{on ? '✓' : '+'}</span>{c.name}
                      {c.custom && <span className="chip-tag">{t('crop.custom')}</span>}
                    </button>
                    {c.custom && (
                      <button type="button" className="chip-x" onClick={() => remove(c)} aria-label={t('crop.remove', { name: c.name })}>×</button>
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
  const [result, setResult] = useState(null); // { name, fit }
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
      <summary><span aria-hidden="true">＋</span> {t('custom.title')}</summary>
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
          <label className="check"><input type="checkbox" checked={f.frost} onChange={upd('frost')} /> ❄️ {t('custom.frost')}</label>
          <label className="check"><input type="checkbox" checked={f.heat} onChange={upd('heat')} /> 🔥 {t('custom.heat')}</label>
        </div>
        <button type="submit" className="btn btn-primary">✅ {t('custom.add')}</button>
      </form>

      <div aria-live="polite">
        {result && (
          <div className="custom-result">
            <Alert tone="good" title={t('custom.added', { name: result.name })}>{t('custom.addedText')}</Alert>
            <Alert tone={result.fit.level === 'ok' ? 'good' : result.fit.level === 'warn' ? 'warn' : 'bad'}
              icon={result.fit.level === 'ok' ? '🌱' : undefined}
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

export default function StrategyView() {
  const t = useT();
  return (
    <section aria-labelledby="strategy-title">
      <PageHead id="strategy-title" eyebrow={t('eyebrow.setup', { n: 2 })} title={t('strategy.title')} sub={t('strategy.sub')}>
        <RegionStrip />
      </PageHead>

      <div className="two-col">
        <div><Priorities /></div>
        <div><UsualRotation /><AllowedCrops /></div>
      </div>

      <section className="card analyse-card" aria-labelledby="analyse-title">
        <div className="analyse-copy">
          <h3 className="card-title" id="analyse-title">{t('analyse.title')}</h3>
          <p className="card-sub">{t('analyse.text')}</p>
          <ul className="basis">
            <li>📍 {t('analyse.b1')}</li><li>🌦️ {t('analyse.b2')}</li><li>⛰️ {t('analyse.b3')}</li><li>🎯 {t('analyse.b4')}</li>
          </ul>
        </div>
        <AnalysisRunner />
      </section>

      <PageNav back="region" next="climate" />
    </section>
  );
}
