// Extremes: one horizontal bar pair per indicator — baseline (light) vs scenario (strong), same hue.
import { useWidth } from '../../hooks/useWidth';
import './charts.css';

const ROW = 64, M = { t: 8, r: 64, b: 8, l: 170 };

export default function ExtremeBars({ rows, labels }) {
  const [ref, w] = useWidth(700);
  const max = Math.max(1, ...rows.flatMap(r => [r.base, r.scen])) * 1.1;
  const H = M.t + rows.length * ROW + M.b;
  const X = v => M.l + ((w - M.l - M.r) * v) / max;
  return (
    <div className="chart" ref={ref} dir="ltr">
      <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H} role="img" aria-label={labels.aria}>
        {rows.map((r, i) => {
          const y = M.t + i * ROW;
          return (
            <g key={r.id}>
              <text x={0} y={y + 30} className="row-label">{r.label}</text>
              <rect x={M.l} y={y + 10} width={Math.max(2, X(r.base) - M.l)} height="18" rx="4" className="bar s1" />
              <text x={X(r.base) + 8} y={y + 24} className="tick">{r.base}</text>
              <rect x={M.l} y={y + 32} width={Math.max(2, X(r.scen) - M.l)} height="18" rx="4" className="bar s2" />
              <text x={X(r.scen) + 8} y={y + 46} className="tick strong">{r.scen}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
