// Round the axis max so 4 ticks land on round numbers (e.g. 0/150/300/450/600).
export function niceMax(v) {
  const raw = v / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(k => k * p).find(s => s >= raw);
  return step * 4;
}

/** Horizontal gridlines + labels for a 0..max y-axis. */
export function YAxis({ m, w, h, max, unit }) {
  const ticks = [0, 1, 2, 3, 4];
  return ticks.map(i => {
    const v = (max / 4) * i;
    const y = m.t + (h - m.t - m.b) * (1 - v / max);
    return (
      <g key={i}>
        <line x1={m.l} x2={w - m.r} y1={y} y2={y} className={i ? 'gridline' : 'baseline'} />
        <text x={m.l - 10} y={y + 5} className="tick" textAnchor="end">{Math.round(v)}{i === 4 ? ` ${unit}` : ''}</text>
      </g>
    );
  });
}
