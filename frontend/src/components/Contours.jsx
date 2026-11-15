// Faint topographic contour lines — background texture for hero areas only.
import { useMemo } from 'react';

function loop(cx, cy, r, wobble, seed) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 2) * 0.4);
    pts.push(`${(cx + Math.cos(a) * r * k).toFixed(1)},${(cy + Math.sin(a) * r * 0.62 * k).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}

export default function Contours({ className = '' }) {
  const paths = useMemo(() => {
    const out = [];
    [[820, 120, 1.3], [180, 420, 2.1]].forEach(([cx, cy, seed]) => {
      for (let i = 1; i <= 9; i++) out.push(loop(cx, cy, i * 46, 0.08 + i * 0.006, seed));
    });
    return out;
  }, []);
  return (
    <svg className={`contours ${className}`} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
