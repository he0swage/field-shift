// Monthly grouped bars: baseline (series 1) vs scenario (series 2). Bars animate when the scenario changes.
import { useId, useState } from 'react';
import { useWidth } from '../../hooks/useWidth';
import { niceMax, YAxis } from './scale';
import { Tip } from './AnnualLineChart';
import './charts.css';

const H = 340;
const M = { t: 20, r: 16, b: 36, l: 56 };

export default function MonthlyBarsChart({ months, base, scenario, label, labels, fixedWidth }) {
  const [ref, measured] = useWidth();
  const w = fixedWidth || measured;
  const [hover, setHover] = useState(null);
  const clip = useId().replace(/:/g, '');

  const max = niceMax(Math.max(...base, ...scenario) * 1.1);
  const Y = v => M.t + (H - M.t - M.b) * (1 - v / max);
  const slot = (w - M.l - M.r) / months.length;
  const bw = Math.max(4, Math.min(26, (slot - 14) / 2)), gap = 2;
  const cx = i => M.l + slot * i + slot / 2;
  const base0 = Y(0);
  // Rounded rect extended 6px below the baseline, then clipped: rounded top, square bottom on the axis.
  const bar = (x, v, cls) => (
    <rect className={`bar ${cls}`} x={x} y={Y(v)} width={bw} height={Math.max(0, base0 - Y(v)) + 6} rx="4" />
  );

  return (
    <div className="chart" ref={ref} dir="ltr">
      <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H} role="img" aria-label={label}>
        <defs><clipPath id={clip}><rect x="0" y="0" width={w} height={base0} /></clipPath></defs>
        <YAxis m={M} w={w} h={H} max={max} unit="mm" />
        <g clipPath={`url(#${clip})`}>
          {months.map((mo, i) => (
            <g key={mo}>
              {bar(cx(i) - bw - gap / 2, base[i], 's1')}
              {bar(cx(i) + gap / 2, scenario[i], 's2')}
            </g>
          ))}
        </g>
        {months.map((mo, i) => (
          <g key={mo}>
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
          <div><i className="sw s1" />{labels.base} <b>{base[hover]} mm</b></div>
          <div><i className="sw s2" />{labels.scenario} <b>{scenario[hover]} mm</b></div>
          <div className="muted">{scenario[hover] - base[hover] >= 0 ? '+' : '−'}{Math.abs(scenario[hover] - base[hover])} mm</div>
        </Tip>
      )}
    </div>
  );
}
