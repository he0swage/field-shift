// App shell pieces: header, step menu, step heading and step navigation.
import { useEffect, useRef } from 'react';
import { STEPS, useNav } from '../state/NavContext';

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo" aria-hidden="true">🌾</div>
        <div>
          <h1>Field Shift</h1>
          <div className="tagline">Precision crop rotation advisor · NASA Space Apps</div>
        </div>
        <div className="status" role="status">
          <span className="dot" aria-hidden="true" />
          <span>Regional data: NASA POWER · ISRIC SoilGrids · MODIS NDVI</span>
        </div>
      </div>
    </header>
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
export function StepHead({ id, eyebrow, title, children }) {
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
      <div className="eyebrow">{eyebrow}</div>
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
