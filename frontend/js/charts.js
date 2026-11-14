// Field Shift — lightweight SVG charts (no library).
// Colors come from CSS tokens (--series-1 / --series-2), validated for
// colour-blind separation in light and dark mode.
'use strict';

const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  // Round axis max so 4 ticks land on round numbers (e.g. 0/150/300/450/600)
  const niceMax = v => { const raw = v / 4, p = 10 ** Math.floor(Math.log10(raw)); const step = [1, 2, 2.5, 5, 10].map(k => k * p).find(st => st >= raw); return step * 4; };

  function frame(container, height) {
    container.innerHTML = '';
    container.classList.add('chart');
    const w = Math.max(260, container.clientWidth || 800);
    const svg = el('svg', { viewBox: `0 0 ${w} ${height}`, width: '100%', height, role: 'img' }, container);
    const tip = document.createElement('div');
    tip.className = 'chart-tip'; tip.hidden = true;
    container.appendChild(tip);
    return { svg, tip, w };
  }
  function showTip(tip, container, x, y, html) {
    tip.innerHTML = html; tip.hidden = false;
    const cw = container.clientWidth, tw = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(0, x - tw / 2), cw - tw) + 'px';
    tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + 'px';
  }
  function yAxis(svg, m, w, h, max, unit) {
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = max / ticks * i, y = m.t + (h - m.t - m.b) * (1 - v / max);
      el('line', { x1: m.l, x2: w - m.r, y1: y, y2: y, class: i ? 'gridline' : 'baseline' }, svg);
      el('text', { x: m.l - 10, y: y + 5, class: 'tick', 'text-anchor': 'end' }, svg).textContent = Math.round(v) + (i === ticks ? ' ' + unit : '');
    }
  }

  /* Annual rainfall line + OLS trend line, with crosshair tooltip */
  function annualLine(container, series, trend, label) {
    const H = 300, m = { t: 20, r: 24, b: 36, l: 64 };
    const { svg, tip, w } = frame(container, H);
    svg.setAttribute('aria-label', label);
    const ys = series.map(d => d.rain), max = niceMax(Math.max(...ys) * 1.05);
    const x0 = series[0].year, x1 = series[series.length - 1].year;
    const X = yr => m.l + (w - m.l - m.r) * (yr - x0) / (x1 - x0);
    const Y = v => m.t + (H - m.t - m.b) * (1 - v / max);
    yAxis(svg, m, w, H, max, 'mm');
    series.forEach(d => { if (d.year % 5 === 0) el('text', { x: X(d.year), y: H - 10, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = d.year; });

    el('path', { d: `M${X(x0)},${Y(trend.intercept + trend.slope * x0)} L${X(x1)},${Y(trend.intercept + trend.slope * x1)}`, class: 'trend' }, svg);
    el('path', { d: series.map((d, i) => `${i ? 'L' : 'M'}${X(d.year)},${Y(d.rain)}`).join(' '), class: 'line s1' }, svg);
    const endY = Y(trend.intercept + trend.slope * x1);
    el('text', { x: X(x1) - 4, y: endY - 10, class: 'direct-label', 'text-anchor': 'end' }, svg).textContent = 'Trend';

    const cross = el('line', { y1: m.t, y2: H - m.b, class: 'crosshair', visibility: 'hidden' }, svg);
    const dot = el('circle', { r: 5, class: 'dot s1', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: m.l, y: m.t, width: w - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    const move = e => {
      const rect = svg.getBoundingClientRect(), sx = (e.clientX - rect.left) * (w / rect.width);
      const yr = Math.round(x0 + (sx - m.l) / (w - m.l - m.r) * (x1 - x0));
      const d = series.find(s => s.year === Math.min(x1, Math.max(x0, yr)));
      cross.setAttribute('x1', X(d.year)); cross.setAttribute('x2', X(d.year)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', X(d.year)); dot.setAttribute('cy', Y(d.rain)); dot.setAttribute('visibility', 'visible');
      const tr = Math.round(trend.intercept + trend.slope * d.year);
      showTip(tip, container, X(d.year) * rect.width / w, Y(d.rain) * rect.height / H,
        `<b>${d.year}</b><div><i class="sw s1"></i>Rainfall <b>${d.rain} mm</b></div><div class="muted">Trend ${tr} mm</div>`);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); });
  }

  /* Monthly grouped bars: baseline vs scenario */
  function monthlyBars(container, months, base, scen, label) {
    const H = 320, m = { t: 20, r: 16, b: 36, l: 56 };
    const { svg, tip, w } = frame(container, H);
    svg.setAttribute('aria-label', label);
    const max = niceMax(Math.max(...base, ...scen) * 1.1);
    const Y = v => m.t + (H - m.t - m.b) * (1 - v / max);
    yAxis(svg, m, w, H, max, 'mm');
    const slot = (w - m.l - m.r) / months.length, bw = Math.min(26, (slot - 14) / 2), gap = 2;
    const bar = (x, v, cls) => {
      const y = Y(v), h = Math.max(0, Y(0) - y), r = Math.min(4, h / 2);
      // rounded top, square bottom anchored to baseline
      el('path', { d: `M${x},${Y(0)} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${Y(0)} Z`, class: 'bar ' + cls }, svg);
    };
    months.forEach((mo, i) => {
      const cx = m.l + slot * i + slot / 2;
      bar(cx - bw - gap / 2, base[i], 's1');
      bar(cx + gap / 2, scen[i], 's2');
      el('text', { x: cx, y: H - 10, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = mo;
      const hit = el('rect', { x: m.l + slot * i, y: m.t, width: slot, height: H - m.t - m.b, class: 'hit' }, svg);
      hit.addEventListener('pointerenter', () => {
        const rect = svg.getBoundingClientRect(), d = scen[i] - base[i];
        hit.classList.add('on');
        showTip(tip, container, cx * rect.width / w, Y(Math.max(base[i], scen[i])) * rect.height / H,
          `<b>${mo}</b><div><i class="sw s1"></i>Baseline <b>${base[i]} mm</b></div><div><i class="sw s2"></i>Scenario <b>${scen[i]} mm</b></div><div class="muted">${d >= 0 ? '+' : ''}${d} mm</div>`);
      });
      hit.addEventListener('pointerleave', () => { hit.classList.remove('on'); tip.hidden = true; });
    });
  }

  return { annualLine, monthlyBars };
})();
