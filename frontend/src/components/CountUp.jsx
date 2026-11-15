// Count-up for key numbers: animates from 0 when the number scrolls into view (skipped with reduced motion).
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function CountUp({ value, format = v => Math.round(v).toLocaleString('en-US'), duration = 900 }) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) { setShown(value); return undefined; }
    let raf, start;
    const run = () => {
      const a = from.current;
      const step = now => {
        start ??= now;
        const k = Math.min(1, (now - start) / duration);
        const e = 1 - (1 - k) ** 3;
        setShown(a + (value - a) * e);
        if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
      };
      raf = requestAnimationFrame(step);
    };
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { run(); return () => cancelAnimationFrame(raf); }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, reduced, duration]);

  return <span ref={ref} className="num">{format(shown)}</span>;
}
