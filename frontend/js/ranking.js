// Field Shift — step 6: recommended 3-year rotations
'use strict';

let ranking = null;
const fmtInt = n => n.toLocaleString('en-US');
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function loadRanking() {
  const panel = $('#rankingBody');
  panel.setAttribute('aria-busy', 'true');
  $('#rankingStatus').innerHTML = `<div class="alert"><span class="ic">⏳</span><div>Scoring rotations for ${region().name}…</div></div>`;
  ranking = await FieldShiftAPI.getRanking({
    region: state.region, rotation: state.rotation, allowed: [...state.allowed],
    priorities: state.priorities, scenario: typeof scenario === 'object' ? scenario : null,
  });
  panel.removeAttribute('aria-busy');
  $('#rankingStatus').innerHTML = ranking.sample
    ? `<div class="alert warn"><span class="ic">ℹ️</span><div><b>Sample results.</b> ${ranking.fallbackReason || ''} These rankings are fixed examples until the ranking engine is connected — they don't yet react to your answers.</div></div>`
    : '';
  renderRanking();
}

/* ---------- small building blocks ---------- */
const tagChip = id => {
  const t = TAGS[id] || { icon: '•', label: id, tone: 'info' };
  return `<li class="tag tone-${t.tone}"><span aria-hidden="true">${t.icon}</span>${t.label}</li>`;
};

const scoreRing = (value, label) => `
  <div class="ring" style="--v:${value}" role="img" aria-label="${label} ${value} out of 100">
    <div class="ring-inner"><b>${value}</b><span>/100</span></div>
  </div>`;

const scoreBar = (value, label, hint) => `
  <div class="mini-score">
    <div class="mini-head"><span>${label} <abbr title="${hint}">?</abbr></span><b>${value}%</b></div>
    <div class="bar"><i style="width:${value}%"></i></div>
  </div>`;

function yearCol(y, i) {
  return `
    <li class="year">
      <div class="year-top"><span class="year-no">Year ${i + 1}</span>${y.nCredit ? `<span class="credit" title="Nitrogen left by the previous legume">−${y.nCredit}% NPK</span>` : ''}</div>
      <div class="year-crop">${y.crop}</div>
      <dl>
        <div><dt>Soil nitrogen</dt><dd>${y.soilN} kg/ha</dd></div>
        <div class="nbar" aria-hidden="true"><i style="width:${Math.min(100, y.soilN / 120 * 100)}%"></i></div>
        <div><dt>Crop health</dt><dd>${y.health}%</dd></div>
        <div><dt>Fertilizer</dt><dd>${y.fertilizer} · ${y.kg} kg/ha</dd></div>
      </dl>
    </li>`;
}

function notAllowedNote(r) {
  const allowedNames = [...state.allowed].map(id => cropById(id)?.name).filter(Boolean);
  const missing = [...new Set(r.crops)].filter(c => !allowedNames.some(a => sameName(a, c)));
  return missing.length
    ? `<p class="note-inline">⚠️ Includes <b>${missing.join(', ')}</b>, which you did not select in step 2. <button class="btn btn-link" data-go="2">Edit crops</button></p>`
    : '';
}

function rankCard(r) {
  const medal = ['gold', 'silver', 'bronze'][r.rank - 1] || 'plain';
  return `
  <article class="rank-card medal-${medal}${r.rank === 1 ? ' is-best' : ''}" aria-labelledby="rk-${r.rank}">
    <header class="rank-head">
      <div class="rank-no" aria-hidden="true">${r.rank}</div>
      <div class="rank-title">
        ${r.rank === 1 ? '<div class="best-label">Best match for your farm</div>' : ''}
        <h3 id="rk-${r.rank}"><span class="sr-only">Rank ${r.rank}: </span>${r.crops.join(' <span class="arrow" aria-label="then">→</span> ')}</h3>
        <ul class="tags" aria-label="Strengths">${r.tags.map(tagChip).join('')}</ul>
      </div>
      <div class="rank-scores">
        ${scoreRing(r.scores.final, 'Final score')}
        <div class="mini-scores">
          ${scoreBar(r.scores.ml, 'Crop sequence fit', 'Machine-learning score for how well each crop follows the previous one')}
          ${scoreBar(r.scores.knn, 'Climate match', 'K-nearest-neighbours similarity between your region and places where this rotation succeeds')}
        </div>
      </div>
    </header>

    <ol class="years" aria-label="Year by year">${r.years.map(yearCol).join('')}</ol>

    <ul class="rank-stats">
      <li><span>💧 Water need</span><b>${r.waterNeed}/100</b></li>
      <li><span>🌿 <abbr title="Normalized Difference Vegetation Index">NDVI</abbr> stability</span><b>${r.ndviStability}/100</b></li>
      <li><span>🧪 3-yr fertilizer</span><b>${r.fertilizer} kg/ha</b><em>saves ${r.fertilizerSaved} kg/ha vs usual</em></li>
      <li><span>💰 Est. gross income</span><b>${fmtInt(r.income)} DA/ha/yr</b></li>
    </ul>

    ${notAllowedNote(r)}

    <details class="risks"${r.rank === 1 ? ' open' : ''}>
      <summary>Risk notes per crop</summary>
      <ul>${Object.entries(r.risks).map(([c, t]) => `<li><b>${c}:</b> ${t}</li>`).join('')}</ul>
    </details>
  </article>`;
}

function avoidCard(a) {
  const usualNames = state.rotation.map(id => cropById(id)?.name || '');
  const isUsual = a.crops.every((c, i) => sameName(c, usualNames[i] || ''));
  return `
  <article class="avoid-card${isUsual ? ' is-usual' : ''}">
    ${isUsual ? '<div class="usual-flag">This is your current rotation</div>' : ''}
    <h4>${a.crops.join(' → ')}</h4>
    <div class="avoid-score">Score ${a.score}/100 · <b>rejected by rules filter</b></div>
    <ul>${a.reasons.map(t => `<li>${t}</li>`).join('')}</ul>
  </article>`;
}

function compareTable() {
  const u = ranking.usual, best = ranking.rotations[0];
  const usualName = state.rotation.map(id => cropById(id)?.name || id).join(' → ');
  const rows = [
    ['💧 Water need', u.waterNeed, best.waterNeed, '/100', 'lower'],
    ['🌿 NDVI stability', u.ndviStability, best.ndviStability, '/100', 'higher'],
    ['🧪 3-yr fertilizer', u.fertilizer, best.fertilizer, ' kg/ha', 'lower'],
    ['🌱 Soil N after 3 years', u.soilNEnd, best.years.at(-1).soilN, ' kg/ha', 'higher'],
    ['💰 Est. gross income', u.income, best.income, ' DA/ha/yr', 'higher'],
  ];
  return `
    <div class="table-wrap"><table class="compare">
      <caption class="sr-only">Your usual rotation compared with rank 1</caption>
      <thead><tr><th scope="col"></th><th scope="col">Your usual<br><small>${usualName}</small></th><th scope="col">Rank 1<br><small>${best.crops.join(' → ')}</small></th><th scope="col">Difference</th></tr></thead>
      <tbody>${rows.map(([k, a, b, unit, goal]) => {
        const d = b - a, better = goal === 'lower' ? d < 0 : d > 0;
        return `<tr><th scope="row">${k}</th><td>${fmtInt(a)}${unit}</td><td>${fmtInt(b)}${unit}</td>
          <td class="${d === 0 ? '' : better ? 'better' : 'worse'}">${d === 0 ? 'same' : `${better ? '✓ better' : '✕ worse'} · ${d > 0 ? '+' : ''}${fmtInt(d)}`}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
    ${ranking.sample ? '<p class="hint">Usual-rotation figures are sample values.</p>' : ''}`;
}

function renderRanking() {
  if (!ranking) return;
  const mc = ranking.monteCarlo;
  $('#mcBadge').innerHTML = `🎲 Rank 1 stays first in <b>${mc.rank1StaysFirstPct}%</b> of ${mc.runs} simulated weather years`;
  $('#rankList').innerHTML = ranking.rotations.map(rankCard).join('');
  $('#avoidList').innerHTML = ranking.avoid.map(avoidCard).join('');
  $('#compareBody').innerHTML = compareTable();
}

$('#compareBtn').addEventListener('click', e => {
  const box = $('#comparePanel'), open = box.hidden;
  box.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', open);
  e.currentTarget.querySelector('span').textContent = open ? 'Hide comparison' : 'Compare usual vs rank 1';
  if (open) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('#printBtn').addEventListener('click', () => window.print());
// Open every collapsed section so the PDF contains all details
window.addEventListener('beforeprint', () => $$('#rankList details').forEach(d => { d.dataset.wasOpen = d.open; d.open = true; }));
window.addEventListener('afterprint', () => $$('#rankList details').forEach(d => { d.open = d.dataset.wasOpen === 'true'; }));
