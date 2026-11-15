// Half of the globe, peeking above the bottom of the Region hero (static SVG, same muted palette).
import { forwardRef, useMemo } from 'react';
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { LAND } from './world';

const SIZE = 440;

const GlobePeek = forwardRef(function GlobePeek({ lat, lon }, ref) {
  const { land, grat } = useMemo(() => {
    const p = geoOrthographic().scale(SIZE / 2 - 6).translate([SIZE / 2, SIZE / 2]).rotate([-lon, -lat + 10]).clipAngle(90);
    const path = geoPath(p);
    return { land: path(LAND), grat: path(geoGraticule10()) };
  }, [lat, lon]);
  return (
    <svg ref={ref} className="globe-peek-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      <defs>
        <radialGradient id="gp-ocean" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#c3d3da" /><stop offset=".6" stopColor="#94b2c4" /><stop offset="1" stopColor="#6f8d9e" />
        </radialGradient>
      </defs>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 6} fill="url(#gp-ocean)" />
      <path d={grat} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth=".6" />
      <path d={land} fill="#d2c39f" stroke="rgba(120,100,70,.35)" strokeWidth=".5" />
      <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 6} fill="none" stroke="rgba(58,65,50,.12)" />
    </svg>
  );
});

export default GlobePeek;
