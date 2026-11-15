// Hero motif: three field strips (Year 1, 2, 3). Interactive: drag the cloud — it rains under it,
// and grass grows on the strip it waters, stays a few seconds, then fades.
import { useCallback, useEffect, useRef, useState } from 'react';
import './FieldScene.css';

const W = 640, H = 480;
const TOP = 210;                        // top edge of the strips (the "ground")
const STRIPS = [
  { x: 36, family: 'legume' },
  { x: 232, family: 'cereal' },
  { x: 428, family: 'oilseed' },
];
const SW = 176;                         // strip width
const GRASS_LIFE = 6000;

const onStrip = x => STRIPS.some(s => x >= s.x + 6 && x <= s.x + SW - 6);

export default function FieldScene({ hint, yearLabel }) {
  const svgRef = useRef(null);
  const [cloud, setCloud] = useState({ x: 320, y: 96 });
  const cloudRef = useRef(cloud);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const [grass, setGrass] = useState([]);

  const toSvg = e => {
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
  };

  const onDown = useCallback(e => {
    e.preventDefault();
    const start = toSvg(e), from = cloudRef.current;
    const off = { x: start.x - from.x, y: start.y - from.y };
    setDragging(true); setTouched(true);
    const move = ev => {
      const p = toSvg(ev);
      const next = { x: Math.max(60, Math.min(W - 60, p.x - off.x)), y: Math.max(48, Math.min(TOP - 70, p.y - off.y)) };
      cloudRef.current = next; setCloud(next);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, []);

  // While it rains, grass sprouts on the strip below the cloud
  useEffect(() => {
    if (!dragging) return undefined;
    const id = setInterval(() => {
      const now = Date.now(), x = cloudRef.current.x + (Math.random() * 56 - 28);
      if (!onStrip(x)) return;
      setGrass(g => [...g.filter(b => now - b.born < GRASS_LIFE).slice(-90),
        { id: `${now}-${Math.random()}`, x, y: TOP + 2 + Math.random() * 6, s: 0.8 + Math.random() * 0.6, born: now }]);
    }, 130);
    return () => clearInterval(id);
  }, [dragging]);

  useEffect(() => {
    if (!grass.length) return undefined;
    const id = setTimeout(() => setGrass(g => g.filter(b => Date.now() - b.born < GRASS_LIFE)), 1000);
    return () => clearTimeout(id);
  }, [grass]);

  return (
    <svg ref={svgRef} className="field-scene" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" direction="ltr">
      <defs>
        <pattern id="fs-rows" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="2" fill="rgba(255,255,255,.12)" />
        </pattern>
      </defs>

      <circle className="fs-sun" cx={W - 92} cy="74" r="30" />

      {STRIPS.map((s, i) => (
        <g key={s.x}>
          <rect className={`fs-strip ${s.family}`} x={s.x} y={TOP} width={SW} height={H - TOP - 16} rx="14" />
          <rect x={s.x} y={TOP} width={SW} height={H - TOP - 16} rx="14" fill="url(#fs-rows)" />
          <text className={`fs-label ${s.family}`} x={s.x + 16} y={H - 40}>{yearLabel(i + 1)}</text>
        </g>
      ))}

      {grass.map(g => (
        <g key={g.id} transform={`translate(${g.x} ${g.y}) scale(${g.s})`}>
          <g className="fs-grass"><path d="M0 0 Q-3 -10 -7 -15" /><path d="M0 0 Q0 -12 1 -21" /><path d="M0 0 Q3 -9 8 -14" /></g>
        </g>
      ))}

      <g transform={`translate(${cloud.x} ${cloud.y})`}>
        {dragging && (
          <g style={{ '--fall': `${Math.max(20, TOP - cloud.y - 22)}px` }}>
            {[-28, -14, 0, 14, 28].map((dx, i) => (
              <line key={dx} className="fs-drop" style={{ animationDelay: `${i * 0.12}s` }}
                x1={dx} y1="20" x2={dx - 3} y2="32" strokeWidth="3" strokeLinecap="round" />
            ))}
          </g>
        )}
        <g className={`fs-cloud${dragging ? ' dragging' : ''}`} onPointerDown={onDown}>
          <ellipse cx="0" cy="0" rx="42" ry="20" /><ellipse cx="28" cy="-13" rx="28" ry="21" />
          <ellipse cx="-31" cy="6" rx="24" ry="13" /><ellipse cx="-6" cy="-15" rx="21" ry="17" />
        </g>
        {!touched && (
          <g className="fs-hint" transform="translate(0 50)">
            <rect x="-104" y="-15" width="208" height="30" rx="15" />
            <text x="0" y="5" textAnchor="middle">{hint}</text>
          </g>
        )}
      </g>
    </svg>
  );
}
