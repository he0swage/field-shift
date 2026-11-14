// Field Shift — step 5: climate & rainfall
'use strict';

/* ------------------------------------------------------------------ *
 * Step 5 — Climate & rainfall on your land
 * ------------------------------------------------------------------ */
const scenario = Store.get('scenario', { rain: -20, temp: 2 });
const climateCache = {};
let climate = null;

async function loadClimate() {
  const id = state.region;
  $('#climateRegion').textContent = `${region().name} · ${region().lat.toFixed(2)}° N, ${region().lon.toFixed(2)}° E`;
  if (!climateCache[id]) {
    $('#climateBody').setAttribute('aria-busy', 'true');
    $('#climateStatus').innerHTML = `<div class="alert"><span class="ic">⏳</span><div>Loading 30 years of rainfall for ${region().name}…</div></div>`;
    climateCache[id] = await FieldShiftAPI.getClimate(id);
  }
  climate = climateCache[id];
  $('#climateBody').removeAttribute('aria-busy');
  $('#climateStatus').innerHTML = climate.sample
    ? `<div class="alert warn"><span class="ic">ℹ️</span><div><b>Sample data.</b> ${climate.fallbackReason || ''} These charts use placeholder values until the NASA POWER feed is connected.</div></div>`
    : '';
  renderClimate();
}

function trendBadge(pOls, pMk) {
  if (pOls < 0.05 && pMk < 0.05) return '<span class="badge sig">● Clear trend · both tests agree</span>';
  if (pOls < 0.1 || pMk < 0.1) return '<span class="badge weak">◐ Weak trend</span>';
  return '<span class="badge none">○ No clear trend</span>';
}

function renderClimate() {
  if (!climate) return;
  const r = scenario.rain / 100, dT = scenario.temp;
  $('#rainV').textContent = (scenario.rain > 0 ? '+' : '') + scenario.rain + '%';
  $('#tempV').textContent = (dT > 0 ? '+' : '') + dT.toFixed(1) + ' °C';
  $('#rainS').value = scenario.rain; $('#tempS').value = dT;
  $('#rainS').setAttribute('aria-valuetext', `${scenario.rain} percent rainfall change`);
  $('#tempS').setAttribute('aria-valuetext', `${dT} degrees warmer`);

  // History statistics
  const years = climate.annual.map(d => d.year), rains = climate.annual.map(d => d.rain);
  const ols = Stats.ols(years, rains), mk = Stats.mannKendall(rains);
  const mean = Math.round(rains.reduce((a, b) => a + b) / rains.length);

  // Simple what-if model (transparent rules, shown to the user)
  const et = 4 * dT;                                        // +4 % crop water demand per °C
  const ind = climate.indicators;
  const scen = {
    rain: Math.round(mean * (1 + r)),
    hot: Math.round(ind.hotDays + 9 * dT),
    frost: Math.max(0, Math.round(ind.frostDays - 1.5 * dT)),
    extreme: Math.max(0, Math.round(ind.extremeRainDays * (1 + r * 0.5) + 0.5 * dT)),
    dry: Math.round(ind.longestDrySpell * (1 - r * 0.6) + 3 * dT),
  };
  const delta = (now, base, unit) => {
    const d = now - base;
    return d === 0 ? '<span class="delta">no change</span>' : `<span class="delta">${d > 0 ? '▲ +' : '▼ '}${d}${unit} vs today</span>`;
  };

  $('#climateCards').innerHTML = [
    ['🌧️', 'Yearly rainfall', `${scen.rain} mm`, delta(scen.rain, mean, ' mm'),
      `${ols.slope * 10 >= 0 ? '+' : ''}${(ols.slope * 10).toFixed(1)} mm per decade since ${years[0]}. ${ols.slope < 0 ? 'Less rain means low-thirst crops are safer.' : 'Rain is stable or rising.'}`,
      trendBadge(ols.p, mk.p)],
    ['☀️', 'Hot days (> 35 °C)', `${scen.hot} days/yr`, delta(scen.hot, ind.hotDays, ' days'), 'Heat during grain filling can shrivel late cereal harvests.'],
    ['❄️', 'Frost days (< 0 °C)', `${scen.frost} days/yr`, delta(scen.frost, ind.frostDays, ' days'), 'Spring frost can damage early flowers on peas, lentils and faba beans.'],
    ['⛈️', 'Heavy rain (> 20 mm/day)', `${scen.extreme} days/yr`, delta(scen.extreme, ind.extremeRainDays, ' days'), 'Downpours wash away bare topsoil if no stubble or cover remains.'],
    ['🏜️', 'Longest dry spell', `${scen.dry} days`, delta(scen.dry, ind.longestDrySpell, ' days'), 'Long dry gaps favour deep-rooted or early-maturing crops.'],
    ['💨', 'Crop water demand', `${et >= 0 ? '+' : ''}${et}%`, '<span class="delta">evapotranspiration</span>', 'Warmer air pulls more water out of plants and topsoil.'],
  ].map(([ic, k, v, d, note, badge]) => `
    <div class="metric">
      <div class="k"><span aria-hidden="true">${ic}</span>${k}</div>
      <div class="v">${v}</div>${d}
      ${badge ? `<div style="margin-top:8px">${badge}</div>` : ''}
      <div class="note" style="margin-top:8px">${note}</div>
    </div>`).join('');

  // Charts
  Charts.annualLine($('#annualChart'), climate.annual, ols,
    `Yearly rainfall ${years[0]}–${years.at(-1)}, average ${mean} mm, trend ${(ols.slope * 10).toFixed(1)} mm per decade`);
  $('#annualCaption').innerHTML = `Average <b>${mean} mm/yr</b> · trend <b>${(ols.slope * 10).toFixed(1)} mm/decade</b> · OLS p = ${ols.p.toFixed(3)}, Mann–Kendall p = ${mk.p.toFixed(3)}`;

  const base = climate.monthly, sc = base.map(v => Math.round(v * (1 + r)));
  Charts.monthlyBars($('#monthlyChart'), MONTHS, base, sc,
    `Monthly rainfall, baseline versus scenario ${scenario.rain}% rain and +${dT} °C`);
  $('#monthlyTable').innerHTML = `<table><thead><tr><th scope="col">Month</th><th scope="col">Baseline (mm)</th><th scope="col">Scenario (mm)</th><th scope="col">Change</th></tr></thead><tbody>
    ${MONTHS.map((m, i) => `<tr><th scope="row">${m}</th><td>${base[i]}</td><td>${sc[i]}</td><td>${sc[i] - base[i] >= 0 ? '+' : ''}${sc[i] - base[i]}</td></tr>`).join('')}
    </tbody></table>`;

  // Plain-language reading of the monthly chart
  const wet = MONTHS.filter((_, i) => sc[i] >= 40);
  const sowing = sc[9] + sc[10]; // Oct + Nov
  $('#monthlyInsight').innerHTML = `<span class="ic">🧭</span><div>In this scenario, <b>${wet.length} months</b> get 40 mm or more (${wet.join(', ') || 'none'}). Autumn sowing rain (Oct + Nov) is <b>${sowing} mm</b>${sowing < 70 ? ' — sow on stored moisture and prefer early, drought-tolerant varieties.' : ', enough for normal autumn sowing.'}</div>`;
}

$('#rainS').addEventListener('input', e => { scenario.rain = +e.target.value; Store.set('scenario', scenario); renderClimate(); });
$('#tempS').addEventListener('input', e => { scenario.temp = +e.target.value; Store.set('scenario', scenario); renderClimate(); });
$('#resetScenario').addEventListener('click', () => {
  const prev = { ...scenario };
  Object.assign(scenario, { rain: 0, temp: 0 }); Store.set('scenario', scenario); renderClimate();
  toast('Scenario reset to today’s climate.', () => { Object.assign(scenario, prev); Store.set('scenario', scenario); renderClimate(); });
});
$('#tableToggle').addEventListener('click', e => {
  const t = $('#monthlyTable'), show = t.hidden;
  t.hidden = !show; e.currentTarget.setAttribute('aria-expanded', show);
  e.currentTarget.textContent = show ? 'Hide table' : 'Show as table';
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (current === 5) renderClimate(); }, 150); });

