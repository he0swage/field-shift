// Small reusable UI building blocks.
import { KEYS, PRIO } from '../utils/priorities';

export function Alert({ tone = '', icon, children, style }) {
  return (
    <div className={`alert ${tone}`} style={style}>
      {icon && <span className="ic" aria-hidden="true">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

/** Sample-data notice shown until the backend is connected. */
export function SampleNotice({ data, what = 'data' }) {
  if (!data?.sample) return null;
  return (
    <Alert tone="warn" icon="ℹ️" style={{ margin: '0 0 20px' }}>
      <b>Sample {what}.</b> {data.fallbackReason} These values are placeholders until the team API is connected.
    </Alert>
  );
}

export function Loading({ children }) {
  return <Alert icon="⏳" style={{ margin: '0 0 20px' }}>{children}</Alert>;
}

export function Metric({ icon, label, value, pct, color, note, estimated }) {
  return (
    <div className="metric">
      <div className="k">
        <span aria-hidden="true">{icon}</span>{label}
        {estimated && <span className="est" title="Placeholder until live data is connected">estimate</span>}
      </div>
      <div className="v">{value}</div>
      {note && <div className="note">{note}</div>}
      {pct != null && (
        <div className="bar" role="img" aria-label={`${typeof label === 'string' ? label : ''} ${pct}%`}>
          <i style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

/** Stacked bar + legend for the 3 priority weights. */
export function WeightStack({ priorities, height }) {
  return (
    <>
      <div className="stack" aria-hidden="true" style={height ? { height } : undefined}>
        {KEYS.map(k => <div key={k} style={{ width: `${priorities[k]}%`, background: PRIO[k].color }} />)}
      </div>
      <div className="legend">
        {KEYS.map(k => (
          <span key={k}><i style={{ background: PRIO[k].color }} />{PRIO[k].name}<b>{priorities[k]}%</b></span>
        ))}
      </div>
    </>
  );
}
