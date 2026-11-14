// Monthly grouped bars: baseline (series 1) vs scenario (series 2).
import { useState } from 'react';
import { useWidth } from '../../hooks/useWidth';
import { niceMax, YAxis } from './scale';
import { Tip } from './AnnualLineChart';
import './charts.css';

const H = 320;
const M = { t: 20, r: 16, b: 36, l: 56 };

function Bar({ x, v, bw, Y, cls }) {
  const y = Y(v), base = Y(0), h = Math.max(0, base - y), r = Math.min(4, h / 2);
  // rounded top, square bottom anchored to the baseline
  return <path className={`bar ${cls}`}
    d={`M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${base} Z`} />;
}

export default function MonthlyBarsChart({ months, base, scenario, label }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);

  const max = niceMax(Math.max(...base, ...scenario) * 1.1);
  const Y = v => M.t + (H - M.t - M.b) * (1 - v / max);
  const slot = (w - M.l - M.r) / months.length;
  const bw = Math.min(26, (slot - 14) / 2), gap = 2;
  const cx = i => M.l + slot * i + slot / 2;

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H} role="img" aria-label={label}>
        <YAxis m={M} w={w} h={H} max={max} unit="mm" />
        {months.map((mo, i) => (
          <g key={mo}>
            <Bar x={cx(i) - bw - gap / 2} v={base[i]} bw={bw} Y={Y} cls="s1" />
            <Bar x={cx(i) + gap / 2} v={scenario[i]} bw={bw} Y={Y} cls="s2" />
            <text x={cx(i)} y={H - 10} className="tick" textAnchor="middle">{mo}</text>
            <rect x={M.l + slot * i} y={M.t} width={slot} height={H - M.t - M.b}
              className={`hit${hover === i ? ' on' : ''}`}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>
      {hover != null && (
        <Tip x={cx(hover)} y={Y(Math.max(base[hover], scenario[hover]))} w={w}>
          <b>{months[hover]}</b>
          <div><i className="sw s1" />Baseline <b>{base[hover]} mm</b></div>
          <div><i className="sw s2" />Scenario <b>{scenario[hover]} mm</b></div>
          <div className="muted">{scenario[hover] - base[hover] >= 0 ? '+' : ''}{scenario[hover] - base[hover]} mm</div>
        </Tip>
      )}
    </div>
  );
}
