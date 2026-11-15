// App shell pieces: professional header (with region switcher, unit toggle, theme toggle, About trigger),
// context banners (irrigation, Less validated, custom coordinates), step menu, step heading & navigation.
import { useEffect, useRef } from 'react';
import { REGIONS } from '../data/regions';
import { useFarm } from '../state/FarmContext';
import { STEPS, useNav } from '../state/NavContext';
import { useToast } from '../state/ToastContext';

export function Header() {
  const { state, set, selectRegion, region } = useFarm();
  const toast = useToast();

  const onRegionChange = e => {
    const nextId = e.target.value;
    if (nextId === state.region) return;
    const prev = state.region;
    selectRegion(nextId);
    const rName = REGIONS[nextId]?.name || 'Custom coordinates';
    toast(`Switched to ${rName}. Default crops loaded.`, () => selectRegion(prev));
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand-group">
          <div className="logo" aria-hidden="true">🌾</div>
          <div>
            <div className="brand-row">
              <h1>Field Shift</h1>
              <span className="version-pill">Global v2</span>
            </div>
            <div className="tagline">Satellite-Driven Multi-Region Crop Rotation &amp; Fire Watch Advisor</div>
          </div>
        </div>

        <div className="header-controls">
          <div className="header-select-wrap">
            <label htmlFor="headerRegionSelect" className="sr-only">Active farming region</label>
            <select
              id="headerRegionSelect"
              className="header-select"
              value={state.region}
              onChange={onRegionChange}
              aria-label="Switch farming region"
            >
              {Object.entries(REGIONS).map(([id, r]) => (
                <option key={id} value={id}>
                  {r.areaName}, {r.country} ({r.role === 'deep' ? 'Deep · Validated' : 'Light · Less validated'})
                </option>
              ))}
              {state.region.startsWith('custom_') && (
                <option value={state.region}>{region.name} (Custom · Data only)</option>
              )}
            </select>
          </div>

          <div className="unit-toggle" role="group" aria-label="Display units">
            <button
              type="button"
              className={state.units === 'metric' ? 'active' : ''}
              aria-pressed={state.units === 'metric'}
              onClick={() => set({ units: 'metric' })}
            >
              Metric <small>mm · °C · ha</small>
            </button>
            <button
              type="button"
              className={state.units === 'imperial' ? 'active' : ''}
              aria-pressed={state.units === 'imperial'}
              onClick={() => set({ units: 'imperial' })}
            >
              US <small>in · °F · ac</small>
            </button>
          </div>

          <div className="unit-toggle" role="group" aria-label="Color theme">
            <button
              type="button"
              className={state.theme !== 'dark' ? 'active' : ''}
              aria-pressed={state.theme !== 'dark'}
              onClick={() => set({ theme: 'light' })}
            >
              ☀️ Light
            </button>
            <button
              type="button"
              className={state.theme === 'dark' ? 'active' : ''}
              aria-pressed={state.theme === 'dark'}
              onClick={() => set({ theme: 'dark' })}
            >
              🌙 Dark
            </button>
          </div>

          <button
            type="button"
            className="header-account-btn"
            onClick={() => set({ accountOpen: true })}
          >
            👨‍🌾 {state.farmerUser ? state.farmerUser.full_name.split(' ')[0] : 'Farmer Account'}
          </button>

          <button
            type="button"
            className="header-about-btn"
            onClick={() => set({ aboutOpen: true })}
          >
            ⓘ About &amp; Credits
          </button>
        </div>
      </div>
    </header>
  );
}

export function ContextBanners() {
  const { region, set } = useFarm();

  return (
    <div className="context-banners" aria-live="polite">
      {region.isIrrigated && (
        <div className="ctx-banner ctx-banner-irrigation" role="status">
          <span className="ctx-badge ctx-badge-irrigated">💧 Irrigated Farming System</span>
          <span className="ctx-text">
            <b>Water stress is based on rainfall. Irrigated farms may differ.</b>
            {' '}In {region.areaName} ({region.country}), canal and tube-well irrigation buffer meteoric dry spells while drawing on groundwater.
          </span>
        </div>
      )}

      {region.role === 'light' && (
        <div className="ctx-banner ctx-banner-light" role="status">
          <span className="ctx-badge ctx-badge-less">Less validated</span>
          <span className="ctx-text">
            <b>{region.name}</b> is a Light scaling region sourced from public datasets ({region.country === 'USA' ? 'USDA NASS' : 'FAOSTAT / ICAR / PAU'}).
            {region.country === 'India' && ' Note: Our engine models one crop per year; two-season (rice–wheat) double cropping is documented in '}
            {region.country === 'India' && (
              <button type="button" className="ctx-inline-btn" onClick={() => set({ aboutOpen: true })}>About &amp; Limits</button>
            )}
          </span>
        </div>
      )}

      {region.role === 'custom' && (
        <div className="ctx-banner ctx-banner-custom" role="alert">
          <span className="ctx-badge ctx-badge-less">Custom Coordinates</span>
          <span className="ctx-text">
            <b>{region.warning || 'Data only: crop values are not adjusted for this place.'}</b>
          </span>
        </div>
      )}
    </div>
  );
}

export function StepMenu() {
  const { step, go } = useNav();
  return (
    <nav className="menu" aria-label="Steps">
      <ol>
        {STEPS.map(({ n, label }) => (
          <li key={n}>
            <button
              type="button"
              className={n < step ? 'done' : ''}
              aria-current={n === step ? 'step' : undefined}
              onClick={() => go(n)}
            >
              <span className="num">{n < step ? '✓' : n}</span>
              <span className="label">{label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Eyebrow + title + lead. Receives keyboard focus when the user changes step. */
export function StepHead({ id, eyebrow, title, badges, children }) {
  const { focusNext } = useNav();
  const ref = useRef(null);
  useEffect(() => {
    if (focusNext.current) {
      ref.current?.focus({ preventScroll: true });
      focusNext.current = false;
    }
  }, [focusNext]);
  return (
    <div className="step-head">
      <div className="eyebrow-row">
        <div className="eyebrow">{eyebrow}</div>
        {badges && <div className="eyebrow-badges">{badges}</div>}
      </div>
      <h2 id={id} ref={ref} tabIndex={-1}>{title}</h2>
      {children && <p className="lead">{children}</p>}
    </div>
  );
}

/** Back / next buttons, always in the same place. */
export function StepNav({ back, next, extra }) {
  const { go } = useNav();
  const btn = (b, cls) => (
    <button type="button" className={`btn ${cls}`} onClick={b.onClick || (() => go(b.to))}>{b.label}</button>
  );
  return (
    <div className="step-nav">
      {back && btn(back, 'btn-secondary')}
      <div className="right">
        {extra}
        {next && btn(next, next.secondary ? 'btn-secondary' : 'btn-primary')}
      </div>
    </div>
  );
}
