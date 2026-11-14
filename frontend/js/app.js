// Field Shift — single-page app logic
'use strict';

/* ------------------------------------------------------------------ *
 * Data
 * `est` lists indicators that are placeholders (not yet from the
 * data pipeline); they are flagged "estimate" in the UI.
 * ------------------------------------------------------------------ */
const REGIONS = {
  regionA: { label: 'Region A', name: 'Sétif High Plateaux', lat: 36.15, lon: 5.38, rain: 485,
    ph: [7.3, 8.4], water: 30, soc: 11.2, frost: 34, erosion: 38, ndvi: 0.44,
    est: ['water', 'soc', 'frost', 'erosion'] },
  regionB: { label: 'Region B', name: 'Constantine El Khroub', lat: 36.16, lon: 6.68, rain: 516,
    ph: [7.2, 8.2], water: 26, soc: 13.6, frost: 25, erosion: 35, ndvi: 0.49,
    est: ['water', 'soc', 'frost', 'erosion'] },
  regionC: { label: 'Region C', name: 'Tiaret Western Plateau', lat: 35.34, lon: 1.38, rain: 408,
    ph: [7.2, 8.3], water: 33, soc: 12.38, frost: 28, erosion: 44, ndvi: 0.47,
    est: [] },
};

const BASE_CROPS = [
  { id: 'durum', name: 'Durum wheat', family: 'cereal' },
  { id: 'soft', name: 'Soft wheat', family: 'cereal' },
  { id: 'barley', name: 'Barley', family: 'cereal' },
  { id: 'oats', name: 'Forage oats', family: 'cereal' },
  { id: 'triticale', name: 'Triticale', family: 'cereal' },
  { id: 'chickpea', name: 'Chickpea', family: 'legume' },
  { id: 'lentil', name: 'Lentil', family: 'legume' },
  { id: 'faba', name: 'Faba bean', family: 'legume' },
  { id: 'vetch', name: 'Common vetch', family: 'legume' },
  { id: 'rapeseed', name: 'Rapeseed', family: 'oilseed' },
  { id: 'safflower', name: 'Safflower', family: 'oilseed' },
  { id: 'sunflower', name: 'Sunflower', family: 'oilseed' },
  { id: 'fallow', name: 'Worked fallow', family: 'fallow' },
];
const FAMILY_LABEL = { cereal: 'Cereals', legume: 'Legumes', oilseed: 'Oilseeds', fallow: 'Fallow', other: 'Other' };

const PRESETS = { // family, rainMin, rainMax, pHmin, pHmax, price, yield, frost, heat
  'Field pea': ['legume', 350, 650, 6.0, 8.0, 9500, 18, true, false],
  'Coriander': ['other', 300, 500, 6.5, 8.0, 25000, 8, false, true],
  'Fenugreek': ['legume', 300, 550, 6.5, 8.2, 22000, 10, false, true],
  'Garlic': ['other', 400, 700, 6.0, 7.8, 15000, 80, true, false],
  'Sorghum': ['cereal', 400, 800, 5.5, 8.5, 4500, 30, false, true],
  'Maize (rainfed)': ['cereal', 500, 900, 5.8, 7.8, 4500, 35, false, false],
  'Rice': ['cereal', 1000, 2000, 5.0, 7.0, 6000, 50, false, true],
};

const PRIO = {
  water: { name: 'Save water', color: 'var(--water)' },
  soil: { name: 'Protect soil', color: 'var(--soil)' },
  yield: { name: 'Stable yield', color: 'var(--wheat-bar)' },
};
const KEYS = Object.keys(PRIO);

/* ------------------------------------------------------------------ *
 * Persistence (per-browser convenience only)
 * ------------------------------------------------------------------ */
const Store = {
  get(k, fb) { try { const v = localStorage.getItem('fieldshift.v2.' + k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem('fieldshift.v2.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const state = {
  region: Store.get('region', 'regionC'),
  rotation: Store.get('rotation', ['durum', 'barley', 'durum']),
  allowed: new Set(Store.get('allowed', ['durum', 'soft', 'barley', 'chickpea', 'lentil', 'vetch', 'rapeseed', 'safflower'])),
  custom: Store.get('custom', []),
  priorities: Store.get('priorities', null),
};
if (!REGIONS[state.region]) state.region = 'regionC';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const region = () => REGIONS[state.region];
const crops = () => [...BASE_CROPS, ...state.custom];
const cropById = id => crops().find(c => c.id === id);
const save = () => {
  Store.set('region', state.region); Store.set('rotation', state.rotation);
  Store.set('allowed', [...state.allowed]); Store.set('custom', state.custom); Store.set('priorities', state.priorities);
};
const socClass = v => v < 12 ? 'Low (< 12 g/kg)' : v <= 16 ? 'Moderate (12–16 g/kg)' : 'High (> 16 g/kg)';

/* ------------------------------------------------------------------ *
 * Navigation — one menu for all steps
 * ------------------------------------------------------------------ */
let current = 1;
function go(step, { focus = true } = {}) {
  step = Math.min(4, Math.max(1, +step || 1));
  current = step;
  $$('[data-panel]').forEach(p => { p.hidden = +p.dataset.panel !== step; });
  $$('.menu button').forEach(b => {
    const n = +b.dataset.step;
    if (n === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.classList.toggle('done', n < step);
    b.querySelector('.num').textContent = n < step ? '✓' : n;
  });
  if (step === 4) renderSummary();
  history.replaceState(null, '', '#step-' + step);
  if (focus) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const h = $(`[data-panel="${step}"] h2`);
    h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
  }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go], .menu button');
  if (t) go(t.dataset.go || t.dataset.step);
});

/* ------------------------------------------------------------------ *
 * Toast with undo (feedback + user control)
 * ------------------------------------------------------------------ */
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast'), btn = $('#toastUndo');
  $('#toastText').textContent = msg;
  btn.classList.toggle('hidden', !undo);
  btn.onclick = () => { undo(); el.classList.add('hidden'); };
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 6000);
}

/* ------------------------------------------------------------------ *
 * Step 1 — Region
 * ------------------------------------------------------------------ */
function presetFor(r) {
  const water = r.water, soil = Math.max(5, 30 - r.soc), y = Math.round(r.ndvi * 100);
  return normalize({ water, soil, yield: y });
}
function normalize(p) {
  const sum = KEYS.reduce((s, k) => s + p[k], 0) || 1;
  const out = {};
  KEYS.forEach(k => { out[k] = Math.round(p[k] / sum * 100); });
  const diff = 100 - KEYS.reduce((s, k) => s + out[k], 0);
  const top = KEYS.reduce((a, b) => out[a] >= out[b] ? a : b);
  out[top] += diff;
  return out;
}

function renderRegionList() {
  $('#regionList').innerHTML = Object.entries(REGIONS).map(([id, r]) => `
    <div class="region">
      <input type="radio" name="region" id="r-${id}" value="${id}" ${id === state.region ? 'checked' : ''}>
      <label for="r-${id}">
        <span class="check" aria-hidden="true">✓</span>
        <div class="tag">${r.label}</div>
        <div class="name">${r.name}</div>
        <div class="meta">${r.lat.toFixed(2)}° N, ${r.lon.toFixed(2)}° E · NASA POWER</div>
        <div class="rain">${r.rain} <small>mm / year</small></div>
      </label>
    </div>`).join('');
  $$('#regionList input').forEach(i => i.addEventListener('change', () => {
    state.region = i.value; save(); renderRegion(); renderFit();
    toast(`Region set to ${region().name}`);
  }));
}

function metric(icon, label, value, pct, color, note, estimated) {
  return `<div class="metric">
    <div class="k"><span aria-hidden="true">${icon}</span>${label}${estimated ? '<span class="est" title="Placeholder until live data is connected">estimate</span>' : ''}</div>
    <div class="v">${value}</div>
    ${note ? `<div class="note">${note}</div>` : ''}
    ${pct != null ? `<div class="bar" role="img" aria-label="${label} ${pct}%"><i style="width:${pct}%;background:${color}"></i></div>` : ''}
  </div>`;
}

function renderRegion() {
  const r = region(), est = k => r.est.includes(k);
  $('#regionSource').textContent = `${r.name} · ${r.lat.toFixed(2)}° N, ${r.lon.toFixed(2)}° E · annual rainfall ${r.rain} mm (NASA POWER)`;
  $('#metrics').innerHTML =
    metric('💧', 'Water stress', r.water + '%', r.water, 'var(--water)', null, est('water')) +
    metric('🌱', '<abbr title="Soil organic carbon">SOC</abbr>', r.soc + ' g/kg', null, null, socClass(r.soc) + ' · SoilGrids', est('soc')) +
    metric('❄️', 'Frost risk', r.frost + '%', r.frost, 'var(--water)', null, est('frost')) +
    metric('🌀', 'Erosion risk', r.erosion + '%', r.erosion, 'var(--soil)', null, est('erosion'));
  const p = presetFor(r);
  renderStack($('#presetStack'), $('#presetLegend'), p);
  $('#customSub').textContent = `Checked automatically against the climate and soil of ${r.name}.`;
}

function renderStack(stackEl, legendEl, p) {
  stackEl.innerHTML = KEYS.map(k => `<div style="width:${p[k]}%;background:${PRIO[k].color}"></div>`).join('');
  legendEl.innerHTML = KEYS.map(k => `<span><i style="background:${PRIO[k].color}"></i>${PRIO[k].name}<b>${p[k]}%</b></span>`).join('');
}

$('#applyPreset').addEventListener('click', () => {
  const prev = state.priorities;
  state.priorities = presetFor(region()); save(); renderPriorities();
  toast('Priorities updated from your region.', () => { state.priorities = prev; save(); renderPriorities(); });
});

/* ------------------------------------------------------------------ *
 * Step 2 — Rotation & crops
 * ------------------------------------------------------------------ */
function renderRotation() {
  ['y1', 'y2', 'y3'].forEach((id, i) => {
    const s = $('#' + id);
    s.innerHTML = Object.entries(groupByFamily(crops())).map(([fam, list]) =>
      `<optgroup label="${FAMILY_LABEL[fam] || fam}">${list.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</optgroup>`).join('');
    if (!cropById(state.rotation[i])) state.rotation[i] = 'durum';
    s.value = state.rotation[i];
    s.onchange = () => { state.rotation[i] = s.value; save(); checkRotation(); };
  });
  checkRotation();
}
function groupByFamily(list) {
  return list.reduce((acc, c) => ((acc[c.family] ||= []).push(c), acc), {});
}
function checkRotation() {
  const fams = state.rotation.map(id => cropById(id)?.family);
  const hasLegume = fams.includes('legume');
  const cerealRun = fams.some((f, i) => f === 'cereal' && fams[i + 1] === 'cereal');
  $('#rotationMsg').innerHTML = hasLegume
    ? `<div class="alert ok"><span class="ic">✓</span><div>Your rotation includes a nitrogen-fixing legume.</div></div>`
    : `<div class="alert warn"><span class="ic">⚠️</span><div><b>No legume in your plan.</b> ${cerealRun ? 'Back-to-back cereals deplete soil nitrogen and' : 'Without a legume, crops'} need 100% synthetic NPK fertilizer. Consider adding chickpea, lentil or vetch.</div></div>`;
}

function renderCrops() {
  $('#cropGroups').innerHTML = Object.entries(groupByFamily(crops())).map(([fam, list]) => `
    <div class="family" role="group" aria-label="${FAMILY_LABEL[fam] || fam}">
      <h4>${FAMILY_LABEL[fam] || fam}</h4>
      <div class="chips">${list.map(c => `
        <div class="chip">
          <input type="checkbox" id="c-${c.id}" value="${c.id}" ${state.allowed.has(c.id) ? 'checked' : ''}>
          <label for="c-${c.id}">${c.name}${c.custom ? ' <em>custom</em>' : ''}</label>
        </div>`).join('')}
      </div>
    </div>`).join('');
  $$('#cropGroups input').forEach(i => i.addEventListener('change', () => {
    i.checked ? state.allowed.add(i.value) : state.allowed.delete(i.value);
    save(); validateCrops();
  }));
  validateCrops();
}
function cropProblems() {
  const fams = [...state.allowed].map(id => cropById(id)?.family);
  const p = [];
  if (state.allowed.size < 3) p.push(`select at least 3 crops (you have ${state.allowed.size})`);
  if (!fams.includes('cereal')) p.push('add at least one cereal');
  if (!fams.includes('legume')) p.push('add at least one legume');
  return p;
}
function validateCrops() {
  const p = cropProblems();
  $('#cropMsg').innerHTML = p.length
    ? `<div class="alert warn"><span class="ic">⚠️</span><div><b>Almost there:</b> ${p.join(', ')}.</div></div>`
    : `<div class="alert ok"><span class="ic">✓</span><div><b>${state.allowed.size} crops selected</b> — includes a cereal and a legume.</div></div>`;
}

// Custom crop form
const F = { name: $('#cName'), fam: $('#cFam'), rMin: $('#rMin'), rMax: $('#rMax'), pMin: $('#pMin'), pMax: $('#pMax'),
  price: $('#price'), yld: $('#yld'), frost: $('#frost'), heat: $('#heat') };

$('#presets').innerHTML = '<span>Quick fill:</span>' +
  Object.keys(PRESETS).map(n => `<button type="button" class="preset">${n}</button>`).join('');
$$('.preset').forEach(b => b.addEventListener('click', () => {
  const [fam, rmin, rmax, pmin, pmax, price, yld, frost, heat] = PRESETS[b.textContent];
  Object.assign(F.name, { value: b.textContent }); F.fam.value = fam;
  F.rMin.value = rmin; F.rMax.value = rmax; F.pMin.value = pmin; F.pMax.value = pmax;
  F.price.value = price; F.yld.value = yld; F.frost.checked = frost; F.heat.checked = heat;
  clearErrors(); renderFit();
}));

function rangeErrors() {
  const e = [];
  if (+F.rMin.value > +F.rMax.value) e.push(['rMin', 'Minimum rainfall must be lower than maximum.']);
  if (+F.pMin.value > +F.pMax.value) e.push(['pMin', 'Minimum pH must be lower than maximum.']);
  return e;
}
function clearErrors() {
  $$('#customForm [aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
  $('#cNameErr').classList.add('hidden'); $('#rangeErr').classList.add('hidden');
}
function renderFit() {
  const r = region(), issues = [];
  const rmin = +F.rMin.value, rmax = +F.rMax.value, pmin = +F.pMin.value, pmax = +F.pMax.value;
  let level = 'ok';
  const errs = rangeErrors();
  const re = $('#rangeErr');
  $$('#rMin, #pMin').forEach(i => i.removeAttribute('aria-invalid'));
  if (errs.length) {
    errs.forEach(([id]) => F[id].setAttribute('aria-invalid', 'true'));
    re.textContent = errs.map(e => e[1]).join(' '); re.classList.remove('hidden');
    $('#fit').innerHTML = ''; return 'invalid';
  }
  re.classList.add('hidden');
  if (r.rain < rmin * 0.85 || r.rain > rmax * 1.3) { level = 'bad'; issues.push(`Rainfall here is ${r.rain} mm, far outside ${rmin}–${rmax} mm.`); }
  else if (r.rain < rmin) { level = 'warn'; issues.push(`Borderline rainfall (${r.rain} mm vs ${rmin} mm minimum) — sow early on deep, moisture-holding soil.`); }
  if (pmax < r.ph[0] || pmin > r.ph[1]) { level = 'bad'; issues.push(`Soil pH here is ${r.ph[0]}–${r.ph[1]}, outside the crop's ${pmin}–${pmax}.`); }
  if (!F.frost.checked && r.frost > 20) { if (level === 'ok') level = 'warn'; issues.push(`Frost risk is ${r.frost}% and this crop is not frost-hardy.`); }
  const cls = { ok: 'ok', warn: 'warn', bad: 'danger' }[level];
  const ic = { ok: '✓', warn: '⚠️', bad: '✕' }[level];
  const title = { ok: 'Good fit', warn: 'Possible, with caution', bad: 'Not suitable — cannot be added' }[level];
  $('#fit').innerHTML = `<div class="alert ${cls}" style="margin:0"><span class="ic">${ic}</span><div><b>${title}</b> for ${r.name}.
    ${issues.length ? `<ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}</div></div>`;
  return level;
}
$('#customForm').addEventListener('input', renderFit);
$('#customForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = F.name.value.trim();
  if (!name) {
    F.name.setAttribute('aria-invalid', 'true'); $('#cNameErr').textContent = 'Enter a crop name.';
    $('#cNameErr').classList.remove('hidden'); F.name.focus(); return;
  }
  const id = 'custom-' + name.toLowerCase().replace(/\W+/g, '-');
  if (crops().some(c => c.id === id || c.name.toLowerCase() === name.toLowerCase())) {
    F.name.setAttribute('aria-invalid', 'true'); $('#cNameErr').textContent = `“${name}” is already in your list.`;
    $('#cNameErr').classList.remove('hidden'); F.name.focus(); return;
  }
  const level = renderFit();
  if (level === 'invalid' || level === 'bad') return;
  clearErrors();
  state.custom.push({ id, name, family: F.fam.value, custom: true,
    rain: [+F.rMin.value, +F.rMax.value], ph: [+F.pMin.value, +F.pMax.value], price: +F.price.value, yield: +F.yld.value });
  state.allowed.add(id); save(); renderCrops(); renderRotation();
  F.name.value = '';
  toast(`${name} added to your farm.`, () => {
    state.custom = state.custom.filter(c => c.id !== id); state.allowed.delete(id);
    state.rotation = state.rotation.map(r => r === id ? 'durum' : r);
    save(); renderCrops(); renderRotation();
  });
});

/* ------------------------------------------------------------------ *
 * Step 3 — Priorities (always sum to 100)
 * ------------------------------------------------------------------ */
if (!state.priorities) state.priorities = presetFor(region());

function setPriority(key, value) {
  const p = state.priorities, others = KEYS.filter(k => k !== key);
  const rest = others.reduce((s, k) => s + p[k], 0), remain = 100 - value;
  const next = { [key]: value };
  others.forEach(k => { next[k] = rest === 0 ? remain / others.length : p[k] / rest * remain; });
  // keep the dragged value exact; round the others
  const a = Math.round(next[others[0]]);
  state.priorities = { ...next, [others[0]]: a, [others[1]]: 100 - value - a };
}
function renderPriorities() {
  const p = state.priorities;
  KEYS.forEach(k => { $('#' + k).value = p[k]; $('#' + k + 'V').textContent = p[k]; $('#' + k).setAttribute('aria-valuetext', p[k] + ' out of 100'); });
  renderStack($('#stack'), $('#legend'), p);
  const top = KEYS.reduce((a, b) => p[a] >= p[b] ? a : b);
  const msg = {
    water: 'Drought-first: favours barley, chickpea and lentil; penalises thirsty crops.',
    soil: 'Soil-builder: favours legumes and vetch; penalises cereal-after-cereal.',
    yield: 'Output-first: favours durum wheat and rapeseed where NDVI history is steady.',
  }[top];
  $('#profile').innerHTML = `<span class="ic">🧭</span><div><b>Your profile: ${PRIO[top].name}</b><br>${msg}</div>`;
}
KEYS.forEach(k => $('#' + k).addEventListener('input', e => { setPriority(k, +e.target.value); save(); renderPriorities(); }));
$('#balance').addEventListener('click', () => {
  const prev = state.priorities; state.priorities = { water: 33, soil: 33, yield: 34 }; save(); renderPriorities();
  toast('Weights set to equal.', () => { state.priorities = prev; save(); renderPriorities(); });
});
$('#regionPreset').addEventListener('click', () => {
  const prev = state.priorities; state.priorities = presetFor(region()); save(); renderPriorities();
  toast(`Preset for ${region().name} applied.`, () => { state.priorities = prev; save(); renderPriorities(); });
});

/* ------------------------------------------------------------------ *
 * Step 4 — Review
 * ------------------------------------------------------------------ */
function renderSummary() {
  const r = region(), p = state.priorities;
  const names = ids => ids.map(id => cropById(id)?.name || id);
  $('#summary').innerHTML = `
    <div class="card"><div class="head"><h3>Region</h3><button class="btn btn-link" data-go="1">Edit<span class="sr-only"> region</span></button></div>
      <dl><dt>Area</dt><dd>${r.label} — ${r.name}</dd>
      <dt>Location</dt><dd>${r.lat.toFixed(2)}° N, ${r.lon.toFixed(2)}° E</dd>
      <dt>Annual rainfall</dt><dd>${r.rain} mm (NASA POWER)</dd></dl></div>
    <div class="card"><div class="head"><h3>Rotation &amp; crops</h3><button class="btn btn-link" data-go="2">Edit<span class="sr-only"> rotation and crops</span></button></div>
      <dl><dt>Current rotation</dt><dd>${names(state.rotation).join(' → ')}</dd>
      <dt>Allowed crops (${state.allowed.size})</dt><dd>${names([...state.allowed]).join(', ')}</dd></dl></div>
    <div class="card"><div class="head"><h3>Priorities</h3><button class="btn btn-link" data-go="3">Edit<span class="sr-only"> priorities</span></button></div>
      <dl>${KEYS.map(k => `<dt>${PRIO[k].name}</dt><dd>${p[k]} / 100</dd>`).join('')}</dl></div>`;
  $('#reviewMsg').innerHTML = '';
}
$('#analyse').addEventListener('click', () => {
  const problems = cropProblems();
  $('#reviewMsg').innerHTML = problems.length
    ? `<div class="alert warn"><span class="ic">⚠️</span><div><b>Fix before analysing:</b> ${problems.join(', ')}. <button class="btn btn-link" data-go="2">Go to step 2</button></div></div>`
    : `<div class="alert ok"><span class="ic">✓</span><div><b>Your inputs are complete.</b> The ranking engine is not connected yet — your answers are saved in this browser.</div></div>`;
});

/* ------------------------------------------------------------------ *
 * Init
 * ------------------------------------------------------------------ */
renderRegionList(); renderRegion(); renderRotation(); renderCrops(); renderFit(); renderPriorities();
go((location.hash.match(/step-(\d)/) || [])[1] || 1, { focus: false });
