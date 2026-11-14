// Yearly rainfall line + dashed OLS trend, with crosshair tooltip.
import { useState } from 'react';
import { useWidth } from '../../hooks/useWidth';
import { niceMax, YAxis } from './scale';
import './charts.css';

const H = 300;
const M = { t: 20, r: 24, b: 36, l: 64 };

export default function AnnualLineChart({ series, trend, label }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);

  const max = niceMax(Math.max(...series.map(d => d.rain)) * 1.05);
  const x0 = series[0].year, x1 = series.at(-1).year;
  const X = yr => M.l + (w - M.l - M.r) * (yr - x0) / (x1 - x0);
  const Y = v => M.t + (H - M.t - M.b) * (1 - v / max);
  const T = yr => trend.intercept + trend.slope * yr;

  const onMove = e => {
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (w / rect.width);
    const yr = Math.min(x1, Math.max(x0, Math.round(x0 + (sx - M.l) / (w - M.l - M.r) * (x1 - x0))));
    setHover(series.find(d => d.year === yr));
  };

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H} role="img" aria-label={label}>
        <YAxis m={M} w={w} h={H} max={max} unit="mm" />
        {series.filter(d => d.year % 5 === 0).map(d => (
          <text key={d.year} x={X(d.year)} y={H - 10} className="tick" textAnchor="middle">{d.year}</text>
        ))}
        <path d={`M${X(x0)},${Y(T(x0))} L${X(x1)},${Y(T(x1))}`} className="trend" />
        <path d={series.map((d, i) => `${i ? 'L' : 'M'}${X(d.year)},${Y(d.rain)}`).join(' ')} className="line s1" />
        <text x={X(x1) - 4} y={Y(T(x1)) - 10} className="direct-label" textAnchor="end">Trend</text>
        {hover && (
          <>
            <line x1={X(hover.year)} x2={X(hover.year)} y1={M.t} y2={H - M.b} className="crosshair" />
            <circle cx={X(hover.year)} cy={Y(hover.rain)} r="5" className="dot s1" />
          </>
        )}
        <rect x={M.l} y={M.t} width={w - M.l - M.r} height={H - M.t - M.b} fill="transparent"
          onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover && (
        <Tip x={X(hover.year)} y={Y(hover.rain)} w={w}>
          <b>{hover.year}</b>
          <div><i className="sw s1" />Rainfall <b>{Math.round(hover.rain)} mm</b></div>
          <div className="muted">Trend {Math.round(T(hover.year))} mm</div>
        </Tip>
      )}
    </div>
  );
}

/** Tooltip positioned above a point, kept inside the chart. */
export function Tip({ x, y, w, children }) {
  const left = Math.min(Math.max(70, x), w - 70);
  return (
    <div className="chart-tip" style={{ left, top: y, transform: 'translate(-50%, calc(-100% - 12px))' }}>
      {children}
    </div>
  );
}
