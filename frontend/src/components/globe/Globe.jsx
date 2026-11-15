// Interactive 3D Earth (orthographic projection on canvas).
// - rotates continuously (speed adjustable, pause/play; off by default with reduced motion)
// - drag to rotate, wheel / buttons to zoom, arrow keys when focused
// - hover a marker to see its name, click it to select the region
// - selecting a region flies + zooms to it and highlights it with a glowing marker and label
import { useEffect, useRef, useState } from 'react';
import { geoDistance, geoOrthographic, geoPath } from 'd3-geo';
import { BORDERS, GRATICULE, LAND, SPHERE } from './world';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useT } from '../../i18n/I18nContext';
import { Pause, Play } from 'lucide-react';
import './Globe.css';

const BASE_SPEED = 6; // degrees per second at 1×
const SPEEDS = [0.5, 1, 2, 4];
const ZOOM_MIN = 0.8, ZOOM_MAX = 2.8, FOCUS_ZOOM = 1.9;
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const clampLat = v => Math.max(-75, Math.min(75, v));

export default function Globe({ regions, selectedId, focusTick, onSelect, labelFor, children }) {
  const t = useT();
  const reduced = useReducedMotion();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const popupRef = useRef(null);   // details card attached to the marker
  const lineRef = useRef(null);    // thin leader line from the card to the marker
  const [size, setSize] = useState(520);
  const [playing, setPlaying] = useState(!reduced);
  const speedIdx = 1;
  const [hovered, setHovered] = useState(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Mutable animation state (kept out of React renders for 60 fps)
  const s = useRef({
    rot: [-(regions.find(r => r.id === selectedId)?.lon ?? 0) + 50, -22], zoom: 1,
    playing: !reduced, speed: BASE_SPEED, dragging: false, flight: null, hovered: null, selectedId, labels: {},
  });
  s.current.playing = playing;
  s.current.speed = BASE_SPEED * SPEEDS[speedIdx];
  s.current.selectedId = selectedId;
  s.current.hovered = hovered;
  s.current.labels = Object.fromEntries(regions.map(r => [r.id, labelFor(r)]));

  // Responsive square canvas
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize(Math.max(260, Math.min(640, Math.round(e.contentRect.width)))));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Fly to the selected region whenever the farmer picks one
  useEffect(() => {
    if (!focusTick) return;
    const r = regions.find(x => x.id === selectedId);
    if (!r) return;
    const st = s.current;
    const from = [...st.rot];
    const to = [-r.lon, clampLat(-r.lat + 8)];
    to[0] = from[0] + ((((to[0] - from[0]) % 360) + 540) % 360) - 180; // shortest way round
    st.flight = { from, to, z0: st.zoom, z1: FOCUS_ZOOM, t0: performance.now(), dur: reduced ? 1 : 1400 };
    setPlaying(false);
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr; canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const proj = geoOrthographic().clipAngle(90).precision(0.4);
    const path = geoPath(proj, ctx);
    let raf, last = performance.now();

    const draw = now => {
      const st = s.current;
      const c = size / 2, R = size * 0.4 * st.zoom;
      proj.translate([c, c]).scale(R).rotate(st.rot);
      ctx.clearRect(0, 0, size, size);

      // atmosphere glow
      const glow = ctx.createRadialGradient(c, c, R * 0.95, c, c, R * 1.16);
      glow.addColorStop(0, 'rgba(196, 210, 214, .35)');
      glow.addColorStop(1, 'rgba(196, 210, 214, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(c, c, R * 1.16, 0, 2 * Math.PI); ctx.fill();

      // ocean
      const ocean = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R);
      ocean.addColorStop(0, '#c3d3da'); ocean.addColorStop(0.6, '#94b2c4'); ocean.addColorStop(1, '#6f8d9e');
      ctx.beginPath(); path(SPHERE); ctx.fillStyle = ocean; ctx.fill();

      // graticule
      ctx.beginPath(); path(GRATICULE); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 0.6; ctx.stroke();

      // land + borders
      const land = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
      land.addColorStop(0, '#e2d7bd'); land.addColorStop(0.5, '#d2c39f'); land.addColorStop(1, '#bfae88');
      ctx.beginPath(); path(LAND); ctx.fillStyle = land; ctx.fill();
      ctx.beginPath(); path(BORDERS); ctx.strokeStyle = 'rgba(120, 100, 70, .35)'; ctx.lineWidth = 0.5; ctx.stroke();

      // 3D shading: highlight top-left, shadow on the rim
      const shade = ctx.createRadialGradient(c - R * 0.4, c - R * 0.45, R * 0.05, c, c, R);
      shade.addColorStop(0, 'rgba(255,255,255,.25)');
      shade.addColorStop(0.6, 'rgba(255,255,255,0)');
      shade.addColorStop(1, 'rgba(40,35,20,.28)');
      ctx.beginPath(); path(SPHERE); ctx.fillStyle = shade; ctx.fill();

      // markers
      const centre = [-st.rot[0], -st.rot[1]];
      const pulse = (Math.sin(now / 380) + 1) / 2;
      let selXY = null;
      regions.forEach(r => {
        if (geoDistance([r.lon, r.lat], centre) > Math.PI / 2 - 0.05) return; // far side
        if (r.id === st.selectedId) selXY = proj([r.lon, r.lat]);
        const [x, y] = proj([r.lon, r.lat]);
        const sel = r.id === st.selectedId, hov = r.id === st.hovered;
        if (sel) {
          ctx.beginPath(); ctx.arc(x, y, 14 + pulse * 14, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(79, 85, 48, ${0.4 - pulse * 0.35})`; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(x, y, sel ? 9 : hov ? 8 : 6, 0, 2 * Math.PI);
        ctx.fillStyle = sel ? '#4f5530' : '#fffdf7'; ctx.fill();
        ctx.lineWidth = sel ? 3 : 2.5; ctx.strokeStyle = sel ? '#fffdf7' : '#4f5530'; ctx.stroke();
        if (hov && !sel) label(ctx, x, y, st.labels[r.id], false, size);
      });

      // leader line: details card → selected marker
      const line = lineRef.current, pop = popupRef.current;
      if (line && pop) {
        if (selXY) {
          const ox = canvas.offsetLeft, oy = canvas.offsetTop;
          const ax = pop.offsetLeft + pop.offsetWidth, ay = pop.offsetTop + pop.offsetHeight - 24;
          const rtl = getComputedStyle(pop).direction === 'rtl';
          line.setAttribute('x1', rtl ? pop.offsetLeft : ax); line.setAttribute('y1', ay);
          line.setAttribute('x2', ox + selXY[0]); line.setAttribute('y2', oy + selXY[1]);
          line.style.display = '';
        } else line.style.display = 'none';
      }
    };

    const frame = now => {
      const st = s.current;
      const dt = Math.min(0.064, (now - last) / 1000); last = now;
      if (st.flight) {
        const f = st.flight, k = Math.min(1, (now - f.t0) / f.dur), e = ease(k);
        st.rot = [f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + (f.to[1] - f.from[1]) * e];
        st.zoom = f.z0 + (f.z1 - f.z0) * e;
        if (k === 1) st.flight = null;
      } else if (st.playing && !st.dragging) {
        st.rot = [st.rot[0] + st.speed * dt, st.rot[1]];
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // --- pointer interaction ---
    const markerAt = (px, py) => {
      const st = s.current;
      const centre = [-st.rot[0], -st.rot[1]];
      let best = null, bestD = 22;
      regions.forEach(r => {
        if (geoDistance([r.lon, r.lat], centre) > Math.PI / 2 - 0.05) return;
        const [x, y] = proj([r.lon, r.lat]);
        const d = Math.hypot(x - px, y - py);
        if (d < bestD) { best = r.id; bestD = d; }
      });
      return best;
    };
    const local = e => { const b = canvas.getBoundingClientRect(); return [(e.clientX - b.left) * (size / b.width), (e.clientY - b.top) * (size / b.height)]; };
    let start = null, moved = 0;
    const down = e => {
      canvas.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, rot: [...s.current.rot] }; moved = 0;
      s.current.dragging = true; s.current.flight = null;
    };
    const move = e => {
      if (start) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        moved = Math.max(moved, Math.hypot(dx, dy));
        const k = 0.28 / s.current.zoom;
        s.current.rot = [start.rot[0] + dx * k, clampLat(start.rot[1] - dy * k)];
      } else {
        const id = markerAt(...local(e));
        if (id !== s.current.hovered) setHovered(id);
        canvas.style.cursor = id ? 'pointer' : 'grab';
      }
    };
    const up = e => {
      if (start && moved < 5) { const id = markerAt(...local(e)); if (id) onSelectRef.current(id); }
      start = null; s.current.dragging = false;
    };
    const wheel = e => {
      e.preventDefault();
      s.current.flight = null;
      s.current.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.current.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => setHovered(null));
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [size, regions]);

  const zoomBy = f => { s.current.flight = null; s.current.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.current.zoom * f)); };
  const onKey = e => {
    const st = s.current, step = 8 / st.zoom;
    const keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (keys[e.key]) { e.preventDefault(); st.flight = null; st.rot = [st.rot[0] + keys[e.key][0], clampLat(st.rot[1] + keys[e.key][1])]; }
    if (e.key === '+' || e.key === '=') zoomBy(1.15);
    if (e.key === '-') zoomBy(1 / 1.15);
  };
  const selected = regions.find(r => r.id === selectedId);

  return (
    <div className="globe">
      <div className="globe-stage" ref={wrapRef}>
        <canvas ref={canvasRef} style={{ width: size, height: size }} tabIndex={0} onKeyDown={onKey}
          role="img" aria-label={t('globe.aria', { region: selected ? labelFor(selected) : '' })} />
        {children && <div className="globe-popup" ref={popupRef}>{children}</div>}
        <svg className="globe-lines" aria-hidden="true"><line ref={lineRef} /></svg>
        <button type="button" className="globe-pause" onClick={() => setPlaying(p => !p)} aria-pressed={!playing}>
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {playing ? t('globe.pause') : t('globe.play')}
        </button>
      </div>
      <p className="globe-hint">{t('globe.hint')}</p>
    </div>
  );
}

/** Name pill next to a marker, kept inside the canvas. */
function label(ctx, x, y, text, strong, size) {
  ctx.font = `${strong ? 700 : 600} 14px Poppins, system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 22, h = 30;
  let lx = x + 16, ly = y - h - 8;
  if (lx + w > size - 6) lx = x - 16 - w;
  if (ly < 6) ly = y + 14;
  ctx.beginPath(); ctx.roundRect(lx, ly, w, h, 15);
  ctx.fillStyle = strong ? 'rgba(58, 65, 50, .92)' : 'rgba(255, 252, 243, .95)'; ctx.fill();
  ctx.fillStyle = strong ? '#fff' : '#3a4132';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + 11, ly + h / 2 + 1);
}
