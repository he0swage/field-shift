// Small 3-year soil-nitrogen trajectory: recommended rotation (line) vs usual rotation's end value (marker).
import { useWidth } from '../../hooks/useWidth';
import './charts.css';

const H = 220;
const M = { t: 24, r: 28, b: 36, l: 56 };

export default function NitrogenChart({ years, usualEnd, labels, fixedWidth }) {
  const [ref, measured] = useWidth(520);
  const w = fixedWidth || measured;
  const max = 120;
  const X = i => M.l + ((w - M.l - M.r) * i) / 2;
  const Y = v => M.t + (H - M.t - M.b) * (1 - v / max);
  const d = years.map((y, i) => `${i ? 'L' : 'M'}${X(i)},${Y(y.soilN)}`).join(' ');

  return (
    <div className="chart" ref={ref} dir="ltr">
      <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H} role="img" aria-label={labels.aria}>
        {[0, 40, 80, 120].map(v => (
          <g key={v}>
            <line x1={M.l} x2={w - M.r} y1={Y(v)} y2={Y(v)} className={v ? 'gridline' : 'baseline'} />
            <text x={M.l - 10} y={Y(v) + 5} className="tick" textAnchor="end">{v}</text>
          </g>
        ))}
        <text x={M.l - 10} y={M.t - 10} className="tick" textAnchor="end">kg/ha</text>
        {years.map((y, i) => <text key={i} x={X(i)} y={H - 10} className="tick" textAnchor="middle">{labels.year(i + 1)}</text>)}
        <path d={d} className="line n-rec" />
        {years.map((y, i) => (
          <g key={i}>
            <circle cx={X(i)} cy={Y(y.soilN)} r="6" className="dot n-rec" />
            <text x={X(i)} y={Y(y.soilN) - 12} className="direct-label" textAnchor="middle">{y.soilN}</text>
          </g>
        ))}
        {usualEnd != null && (
          <g>
            <rect x={X(2) - 7} y={Y(usualEnd) - 7} width="14" height="14" rx="2" className="dot n-usual" transform={`rotate(45 ${X(2)} ${Y(usualEnd)})`} />
            <text x={X(2) - 14} y={Y(usualEnd) + 5} className="direct-label" textAnchor="end">{labels.usual} {usualEnd}</text>
          </g>
        )}
      </svg>
      <div className="legend-row">
        <span><i className="sw n-rec-sw" />{labels.rec}</span>
        {usualEnd != null && <span><i className="sw n-usual-sw" />{labels.usualLegend}</span>}
      </div>
    </div>
  );
}
