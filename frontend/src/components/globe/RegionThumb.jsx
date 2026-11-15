// Small orthographic locator map centred on a region (used as the card illustration).
import { useMemo } from 'react';
import { geoOrthographic, geoPath } from 'd3-geo';
import { LAND } from './world';

export default function RegionThumb({ lat, lon }) {
  const { land, dot } = useMemo(() => {
    const proj = geoOrthographic().scale(40).translate([42, 42]).rotate([-lon, -lat + 10]).clipAngle(90);
    return { land: geoPath(proj)(LAND), dot: proj([lon, lat]) };
  }, [lat, lon]);
  return (
    <svg className="thumb" viewBox="0 0 84 84" aria-hidden="true">
      <circle className="t-ocean" cx="42" cy="42" r="40" />
      <path className="t-land" d={land} />
      <circle className="t-ring" cx={dot[0]} cy={dot[1]} r="9" />
      <circle className="t-dot" cx={dot[0]} cy={dot[1]} r="4.5" />
    </svg>
  );
}
