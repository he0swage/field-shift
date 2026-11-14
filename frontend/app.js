// Field Shift — shared data + helpers for all pages

const REGIONS = {
  regionA: { name: 'Mitidja Coastal Plain', lat: 36.58, lon: 2.95, rain: 620, ph: [7.0, 8.0], water: 18, soc: 16.4, socClass: 'High (>16 g/kg)', frost: 6, erosion: 22, ndvi: 0.61 },
  regionB: { name: 'Sétif High Plains', lat: 36.19, lon: 5.41, rain: 395, ph: [7.4, 8.4], water: 41, soc: 10.9, socClass: 'Low (<12 g/kg)', frost: 34, erosion: 38, ndvi: 0.42 },
  regionC: { name: 'Tiaret Western Plateaux', lat: 35.34, lon: 1.38, rain: 405.8, ph: [7.2, 8.3], water: 33, soc: 12.38, socClass: 'Moderate (12–16 g/kg)', frost: 28, erosion: 44, ndvi: 0.47 },
  regionD: { name: 'Djelfa Steppe Margin', lat: 34.67, lon: 3.26, rain: 290, ph: [7.8, 8.6], water: 62, soc: 7.1, socClass: 'Very low (<8 g/kg)', frost: 31, erosion: 57, ndvi: 0.29 },
};

const CROPS = [
  { id: 'durum', name: 'Durum Wheat', family: 'cereal' },
  { id: 'soft', name: 'Soft Wheat', family: 'cereal' },
  { id: 'barley', name: 'Barley', family: 'cereal' },
  { id: 'oats', name: 'Forage Oats', family: 'cereal' },
  { id: 'triticale', name: 'Triticale', family: 'cereal' },
  { id: 'chickpea', name: 'Chickpea', family: 'legume' },
  { id: 'lentil', name: 'Lentil', family: 'legume' },
  { id: 'faba', name: 'Faba Bean', family: 'legume' },
  { id: 'vetch', name: 'Common Vetch', family: 'legume' },
  { id: 'rapeseed', name: 'Rapeseed', family: 'oilseed' },
  { id: 'safflower', name: 'Safflower', family: 'oilseed' },
  { id: 'sunflower', name: 'Sunflower', family: 'oilseed' },
  { id: 'fallow', name: 'Worked Fallow', family: 'fallow' },
];

const Store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('fieldshift.' + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('fieldshift.' + key, JSON.stringify(value)); } catch {}
  },
};

function currentRegion() {
  const id = Store.get('region', 'regionC');
  return { id, ...REGIONS[id] };
}

// Builds the sidebar on every page; `active` = step number (1-5)
function renderSidebar(active) {
  const steps = [
    ['page1.html', 'Setup'],
    ['page2.html', 'Your rotation'],
    ['page3.html', 'Priorities'],
    ['#', 'Rotation ranking'],
    ['#', 'Region map'],
  ];
  const el = document.getElementById('sidebar');
  el.innerHTML = `
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">🌾</div>
      <div><small>NASA Space Apps</small><h1>Field Shift</h1></div>
    </div>
    <nav aria-label="Steps"><ol class="stepper">
      ${steps.map(([href, label], i) => {
        const n = i + 1;
        const cls = n === active ? 'active' : n < active ? 'done' : '';
        return `<li><a class="${cls}" href="${href}"${n === active ? ' aria-current="step"' : ''}>
          <span class="num">${n < active ? '✓' : n}</span><span class="label-long">${label}</span></a></li>`;
      }).join('')}
    </ol></nav>
    <div class="data-card">
      <div class="live">Live regional data</div>
      NASA POWER (1995–2024) · ISRIC SoilGrids v2.0 (0–30 cm) · MODIS MOD13Q1 NDVI · OAIC/CCLS prices.
      <div style="margin-top:8px;opacity:.75">Hybrid rules + KNN + RF · 3-yr soil simulator</div>
    </div>`;

  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.lang button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    document.documentElement.dir = b.dataset.lang === 'ar' ? 'rtl' : 'ltr';
    Store.set('lang', b.dataset.lang);
  }));
}
