// Field Shift — region map with NASA POWER rainfall-trend overlay (step 1)
// Schematic map of northern Algeria; positions use real lat/lon.
'use strict';

const MAP = {
  w: 900, h: 440,
  lon: [-1.0, 8.8], lat: [37.3, 34.0],
  coast: [[-1, 35.45], [-0.6, 35.75], [0.1, 35.9], [0.9, 36.2], [1.6, 36.55], [2.4, 36.6], [3.06, 36.78],
    [3.9, 36.9], [4.6, 36.85], [5.08, 36.76], [5.7, 36.82], [6.4, 37.05], [6.9, 36.9], [7.77, 36.92], [8.8, 36.95]],
  cities: [['Oran', 35.70, -0.63], ['Algiers', 36.75, 3.06], ['Annaba', 36.90, 7.77]],
  // label side for each region marker, so neighbours don't collide
  side: { regionA: 'left', regionB: 'right', regionC: 'right' },
};
const mx = lon => (lon - MAP.lon[0]) / (MAP.lon[1] - MAP.lon[0]) * MAP.w;
const my = lat => (MAP.lat[0] - lat) / (MAP.lat[0] - MAP.lat[1]) * MAP.h;

let mapOverlay = Store.get('mapOverlay', true);

/* ---------- Trends: computed from the same climate data as step 5 ---------- */
async function initMap() {
  $('#overlayToggle').checked = mapOverlay;
  renderMap();
  await Promise.all(Object.keys(REGIONS).map(async id => {
    climateCache[id] ||= await FieldShiftAPI.getClimate(id);
    const a = climateCache[id].annual;
    const ols = Stats.ols(a.map(d => d.year), a.map(d => d.rain));
    const mk = Stats.mannKendall(a.map(d => d.rain));
    regionTrends[id] = {
      decade: ols.slope * 10,
      sig: ols.p < 0.05 && mk.p < 0.05 ? 'clear' : ols.p < 0.1 || mk.p < 0.1 ? 'weak' : 'none',
    };
    const dd = $(`[data-trend="${id}"]`);
    if (dd) dd.textContent = `${regionTrends[id].decade.toFixed(1)} mm/decade`;
  }));
  renderMap();
}

const SIG_SHORT = { clear: 'clear trend', weak: 'weak trend', none: 'no clear trend' };
const SIG_TEXT = { clear: 'clear trend (MK + OLS agree)', weak: 'weak trend', none: 'no clear trend' };

function renderMap() {
  const svgPts = MAP.coast.map(([lo, la]) => `${mx(lo).toFixed(1)},${my(la).toFixed(1)}`);
  const coastLine = 'M' + svgPts.join(' L');
  const sea = `M0,0 L${MAP.w},0 L${svgPts.at(-1)} ${[...svgPts].reverse().map(p => 'L' + p).join(' ')} Z`;
  const land = `${coastLine} L${MAP.w},${MAP.h} L0,${MAP.h} Z`;
  const band = (lat1, lat2, cls) => `<rect x="0" y="${my(lat1)}" width="${MAP.w}" height="${my(lat2) - my(lat1)}" class="${cls}" clip-path="url(#landClip)"/>`;

  const markers = Object.entries(REGIONS).map(([id, r]) => {
    const x = mx(r.lon), y = my(r.lat), t = regionTrends[id], on = id === state.region;
    const left = MAP.side[id] === 'left', dx = left ? -20 : 20, anchor = left ? 'end' : 'start';
    const ring = mapOverlay && t
      ? `<circle cx="${x}" cy="${y}" r="${(14 + Math.abs(t.decade) * 1.1).toFixed(1)}" class="trend-ring sig-${t.sig}"/>` : '';
    const detail = t
      ? `<text x="${x + dx}" y="${y + 28}" text-anchor="${anchor}" class="map-detail">${t.decade.toFixed(1)} mm/decade</text><text x="${x + dx}" y="${y + 46}" text-anchor="${anchor}" class="map-detail sub">${SIG_SHORT[t.sig]}</text>` : '';
    return `
      <g class="marker${on ? ' on' : ''}" data-region="${id}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}"
         aria-label="${r.name}, ${r.rain} mm per year${t ? `, rainfall trend ${t.decade.toFixed(1)} mm per decade, ${SIG_TEXT[t.sig]}` : ''}">
        ${ring}
        <circle cx="${x}" cy="${y}" r="26" class="hit"/>
        <circle cx="${x}" cy="${y}" r="${on ? 13 : 10}" class="dot"/>
        <text x="${x + dx}" y="${y + 6}" text-anchor="${anchor}" class="map-name">${r.short}</text>
        ${detail}
      </g>`;
  }).join('');

  const cities = MAP.cities.map(([n, la, lo]) => `
    <circle cx="${mx(lo)}" cy="${my(la)}" r="3.5" class="city"/>
    <text x="${mx(lo) + 8}" y="${my(la) + 18}" class="city-name">${n}</text>`).join('');

  $('#regionMap').innerHTML = `
    <svg viewBox="0 0 ${MAP.w} ${MAP.h}" width="100%" role="radiogroup" aria-label="Regions on the map — use arrow keys to move, Enter to choose">
      <defs><clipPath id="landClip"><path d="${land}"/></clipPath></defs>
      <path d="${sea}" class="sea"/>
      <path d="${land}" class="land"/>
      ${band(36.3, 34.6, 'band-plateaux')}
      ${band(34.6, 33.9, 'band-sahara')}
      <path d="${coastLine}" class="coast"/>
      <text x="${mx(1.3)}" y="${my(37.0)}" class="zone sea-label">Mediterranean Sea</text>
      <text x="${mx(3.6)}" y="${my(35.0)}" class="zone">High Plateaux</text>
      <text x="${mx(4.2)}" y="${my(34.2)}" class="zone">Saharan Atlas</text>
      ${cities}
      ${markers}
    </svg>`;

  $$('#regionMap .marker').forEach(g => {
    g.addEventListener('click', () => selectRegion(g.dataset.region));
    g.addEventListener('keydown', e => {
      const ids = Object.keys(REGIONS), i = ids.indexOf(g.dataset.region);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRegion(g.dataset.region); }
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        const next = ids[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : ids.length - 1)) % ids.length];
        selectRegion(next);
        $(`#regionMap [data-region="${next}"]`)?.focus();
      }
    });
  });
}

$('#overlayToggle').addEventListener('change', e => {
  mapOverlay = e.target.checked; Store.set('mapOverlay', mapOverlay); renderMap();
});
