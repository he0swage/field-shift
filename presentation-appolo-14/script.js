/* ============================================================
   Field Shift · presentation
   - slides 1 a 3 : une seule "camera" qui zoome de la Terre
     vers la region, puis vers le telephone du fermier
   - slide 4 : le telephone se transforme en PC
   - slides 5 a 10 : slides classiques
   Clavier : fleche droite / espace = suivant, fleche gauche = retour,
   F = plein ecran, Debut / Fin = premiere / derniere slide.
   ============================================================ */

const TOTAL = 10;           // nombre de slides
const SCENE_STEPS = 4;      // les 4 premieres se jouent dans la scene (zoom, puis telephone -> PC)
const LAST_CAM = 2;         // la camera s'arrete sur les champs (slides 3 et 4)
const ZOOM_MS = 3000;       // duree d'un zoom

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const stage = $("#stage");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. mise a l'echelle de la scene 1600 x 900 ---------- */
function fit() {
  const s = Math.min(innerWidth / 1600, innerHeight / 900);
  stage.style.transform = `scale(${s}) translate(-50%, -50%)`;
}
addEventListener("resize", fit);
fit();

/* ---------- 2. remplir les textes et graphiques depuis data.js ---------- */
const get = (path) => path.split(".").reduce((o, k) => o[k], DATA);
$$("[data-bind]").forEach((el) => {
  const v = get(el.dataset.bind);
  el.textContent = typeof v === "number" && v < 0 ? "−" + Math.abs(v) : v;
});

const svgEl = (tag, attrs) => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
};

// droite de tendance (moindres carres) d'une serie
function trend(values) {
  const n = values.length, mx = (n - 1) / 2, my = values.reduce((a, b) => a + b) / n;
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - mx) * (v - my); den += (i - mx) ** 2; });
  const slope = num / den;
  return [my - slope * mx, my + slope * mx];
}

// petit graphique : ecart de chaque annee par rapport a la moyenne (au-dessus = plus humide)
function sparkline(svg, values) {
  const [, , w, h] = svg.getAttribute("viewBox").split(" ").map(Number);
  const mean = values.reduce((a, b) => a + b) / values.length;
  const dev = values.map((v) => v - mean), top = Math.max(...dev.map(Math.abs));
  const step = w / values.length, bw = step * 0.64, mid = h / 2, k = (h / 2 - 3) / top;
  dev.forEach((d, i) => svg.append(svgEl("rect", {
    x: i * step + (step - bw) / 2, y: d >= 0 ? mid - d * k : mid, width: bw, height: Math.max(1.5, Math.abs(d) * k),
    rx: 1.5, fill: d >= 0 ? "#94b2c4" : "#b5523b"
  })));
  svg.append(svgEl("line", { x1: 0, x2: w, y1: mid, y2: mid, stroke: "#5f5b4e", "stroke-width": 1 }));
}

// grand graphique de la slide "The problem"
function rainChart(svg, values, years) {
  const W = 860, H = 380, L = 64, R = 20, T = 18, B = 44;
  const max = Math.ceil(Math.max(...values) / 100) * 100;
  const x = (i) => L + ((i + 0.5) / values.length) * (W - L - R);
  const y = (v) => H - B - (v / max) * (H - T - B);
  for (let g = 0; g <= max; g += 100) {
    svg.append(svgEl("line", { x1: L, x2: W - R, y1: y(g), y2: y(g), stroke: "#d8c3ae", "stroke-width": 1 }));
    const t = svgEl("text", { x: L - 12, y: y(g) + 6, "text-anchor": "end", "font-size": 17, fill: "#5f5b4e" });
    t.textContent = g; svg.append(t);
  }
  const bw = ((W - L - R) / values.length) * 0.66;
  values.forEach((v, i) => {
    svg.append(svgEl("rect", { x: x(i) - bw / 2, y: y(v), width: bw, height: y(0) - y(v), rx: 4, fill: "#94b2c4" }));
    if (i % 5 === 0) {
      const t = svgEl("text", { x: x(i), y: H - 14, "text-anchor": "middle", "font-size": 17, fill: "#5f5b4e" });
      t.textContent = years[0] + i; svg.append(t);
    }
  });
  const [a, b] = trend(values);
  svg.append(svgEl("line", { x1: x(0), y1: y(a), x2: x(values.length - 1), y2: y(b), stroke: "#b5523b", "stroke-width": 4, "stroke-linecap": "round", "stroke-dasharray": "2 10" }));
  const lab = svgEl("text", { x: x(values.length - 1) + 12, y: y(b) - 16, "text-anchor": "end", "font-size": 20, "font-weight": 700, fill: "#b5523b" });
  lab.textContent = "trend"; svg.append(lab);
}

const rotationHTML = (crops) =>
  crops.map((c, i) => `<div class="c-${c.toLowerCase()}"><small>Year ${i + 1}</small>${c}</div>`).join("");

function build() {
  const r = DATA.region;
  sparkline($("#spark"), r.rainfall);
  sparkline($("#deskChart"), r.rainfall);
  sparkline($("#miniChart"), r.rainfall);
  rainChart($("#rainChart"), r.rainfall, r.years);

  // sol : argile / sable / limon
  const soil = [["Clay", r.soil.clay, "#c49a6c"], ["Sand", r.soil.sand, "#d9c58b"], ["Silt", r.soil.silt, "#8faf78"]];
  $("#soilBar").innerHTML = soil.map(([, v, c]) => `<i style="width:${v}%;background:${c}"></i>`).join("");
  $("#soilLegend").innerHTML = soil.map(([n, v, c]) => `<span style="--c:${c}">${n} ${v}%</span>`).join("");

  // curseurs de priorites (telephone, PC et slide "Three steps")
  const prio = [["Save water", DATA.priorities.water], ["Protect soil", DATA.priorities.soil], ["Yield", DATA.priorities.yield]];
  $$("[data-sliders]").forEach((el) => {
    el.innerHTML = prio.map(([n, v]) => `<label>${n} <i style="--v:${v}%"></i><b>${v}</b></label>`).join("");
  });

  // PC : classement des rotations + la rotation habituelle
  $("#deskRanks").innerHTML = DATA.ranking.map((r, i) =>
    `<div class="rank${i === 0 ? " first" : ""}"><span>Rank ${i + 1}</span><div class="rot">${rotationHTML(r.rotation)}</div><b>${r.score}<small> / 100</small></b></div>`).join("")
    + `<div class="rank usual"><span>Usual</span><div class="rot">${rotationHTML(DATA.compare.usual.rotation)}</div><b></b></div>`;

  // telephone
  $("#phoneCrops").innerHTML = DATA.phone.crops.map((c) =>
    `<div class="crop"><span>${c.name}</span><div class="track"><i style="--v:${c.water}%"></i></div><small>${c.note}</small></div>`).join("");
  $("#phoneRot").innerHTML = rotationHTML(DATA.phone.best.rotation);
  $("#phoneScore").textContent = DATA.phone.best.score + " / 100";
  $("#stepRot").innerHTML = rotationHTML(DATA.phone.best.rotation);

  // comparaison habituel / rang 1
  const { usual, rank1 } = DATA.compare;
  $("#cmpUsual").innerHTML = `<h3>Your usual</h3><p>${usual.rotation.join(", ")}</p><div class="rot">${rotationHTML(usual.rotation)}</div>`;
  $("#cmpRank1").innerHTML = `<h3>Rank 1</h3><p>${rank1.rotation.join(", ")}</p><div class="rot">${rotationHTML(rank1.rotation)}</div>`;
  $("#cmpBars").innerHTML = [["Water saved", "water"], ["Soil health", "soil"], ["Yield", "yield"]].map(([label, k]) =>
    `<div class="cmp-row"><p>${label}</p><div class="cmp-pair">
       <span><i style="--v:${usual[k]}"></i>${usual[k]}</span>
       <span><i style="--v:${rank1[k]}"></i>${rank1[k]}</span></div></div>`).join("");

  // carte : frontieres et villes
  for (const name in MAP.borders) $("#mapSvg").append(svgEl("path", { d: MAP.borders[name] }));
  for (const [id, key] of [["#placeSetif", "Setif"], ["#placeTiaret", "Tiaret"], ["#placeAlgiers", "Algiers"]]) {
    $(id).style.left = MAP.places[key][0] + "px";
    $(id).style.top = MAP.places[key][1] + "px";
  }

  $("#dots").innerHTML = "<i></i>".repeat(TOTAL);
}
build();

/* ---------- 3. la camera (zoom Terre -> region -> champs) ----------
   Chaque calque a un niveau de zoom "naturel" Z[k] (en logarithme).
   Entre deux calques, un point du calque k (from) arrive sur un point
   du calque k+1 (to) : c'est ce qui garde le zoom continu.            */
const layers = [$("#layerSpace"), $("#layerRegion"), $("#layerFields")];
const EARTH = { left: 760, top: 40, size: 820 };               // position de la Terre (voir style.css)
const earthTarget = [EARTH.left + MAP.earthTarget[0] * EARTH.size, EARTH.top + MAP.earthTarget[1] * EARTH.size];
const Z = [0, Math.log(19), Math.log(19) + Math.log(60)];
const LINKS = [
  { from: earthTarget, to: [800, 450] },                        // nord de l'Algerie -> centre de la carte
  { from: MAP.places.Setif, to: [800, 450] },                   // Setif -> centre des champs
];
const OFF = [[0, 0], [400, 225], [400, 225]];                   // la carte et les champs depassent de la scene (voir style.css)
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function renderCamera(c) {                                      // c va de 0 (Terre) a 2 (champs)
  const k = Math.max(0, Math.min(Math.floor(c), LINKS.length - 1));
  const p = c - k;
  const z = lerp(Z[k], Z[k + 1], p);
  const { from, to } = LINKS[k];
  const fx = lerp(from[0], to[0], p), fy = lerp(from[1], to[1], p);
  layers.forEach((el, i) => {
    if (i !== k && i !== k + 1) { el.style.visibility = "hidden"; return; }
    const anchor = i === k ? from : to;
    const s = Math.exp(z - Z[i]);
    el.style.visibility = i === k + 1 && p === 0 ? "hidden" : "visible";
    const [ox, oy] = OFF[i];
    el.style.transform = `translate(${fx + ox - (anchor[0] + ox) * s}px, ${fy + oy - (anchor[1] + oy) * s}px) scale(${s})`;
    if (i === k) {
      el.style.opacity = 1;
      el.style.maskImage = el.style.webkitMaskImage = "none";
    } else {
      // le calque suivant apparait d'abord comme une tache aux bords doux, puis remplit l'ecran
      el.style.opacity = smooth(0.34, 0.62, p);
      const f = lerp(34, 1, smooth(0.4, 0.9, p));               // largeur du bord flou, en %
      const band = `transparent, #000 ${f}%, #000 ${100 - f}%, transparent`;
      el.style.maskImage = el.style.webkitMaskImage =
        p >= 0.995 ? "none" : `linear-gradient(90deg, ${band}), linear-gradient(0deg, ${band})`;
      el.style.maskComposite = "intersect";
      el.style.webkitMaskComposite = "source-in";
    }
    // les etiquettes de la carte s'effacent des que l'on repart
    el.style.setProperty("--labels", i === k ? 1 - smooth(0, 0.18, p) : smooth(0.8, 1, p));
  });
}

/* ---------- 4. navigation ---------- */
let current = 0;        // slide affichee
let cam = 0;            // position de la camera
let raf = 0;

function setHud(step) {
  $$(".hud").forEach((h, i) => h.classList.toggle("on", i === step));
  const scene = $("#scene");
  if (scene.dataset.show !== String(step)) scene.dataset.prev = scene.dataset.show;  // sens de la transition telephone <-> PC
  scene.dataset.show = step;                                    // pilote la main, le telephone et le PC (style.css)
}

function animateCamera(target, step) {
  cancelAnimationFrame(raf);
  const start = cam, dist = Math.abs(target - start);
  if (!dist) { setHud(step); return; }                          // slide 3 <-> 4 : la camera ne bouge pas
  if (reduced) { cam = target; renderCamera(cam); setHud(step); return; }
  setHud(-1);                                                   // les textes s'effacent pendant le zoom
  const t0 = performance.now(), dur = ZOOM_MS * Math.min(dist, 1.35);
  const tick = (now) => {
    const t = Math.min(1, Math.max(0, (now - t0) / dur));
    cam = lerp(start, target, ease(t));
    renderCamera(cam);
    if (t < 1) raf = requestAnimationFrame(tick); else setHud(step);
  };
  raf = requestAnimationFrame(tick);
}

/* ---------- 5. slide 4 -> 5 : l'ecran du PC s'agrandit jusqu'a devenir la slide 5 ----------
   L'ecran du PC affiche d'abord une copie de la slide 5 (en fondu), puis il
   s'etire en largeur et en hauteur jusqu'a couvrir exactement la slide.
   A ce moment la copie et la vraie slide 5 sont identiques : on echange.   */
const FADE_MS = 350;        // la copie de la slide 5 apparait dans l'ecran
const GROW_MS = 1200;       // l'ecran grandit (meme duree que .rig.diving dans style.css)
const rig = $(".rig"), desk = $(".desk");
let diveTimers = [];

// copie de la slide 5 placee dans l'ecran du PC
const mirror = document.createElement("div");
mirror.className = "mirror";
const copy = $('.slide[data-slide="4"]').cloneNode(true);
copy.removeAttribute("data-slide");
copy.classList.add("on");
copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
mirror.append(copy);
desk.append(mirror);

// transformation qui etire l'ecran du PC jusqu'a la taille de la slide (1600 x 900)
function diveTransform() {
  const st = stage.getBoundingClientRect(), k = st.width / 1600;
  rig.style.transform = "";
  const r = desk.getBoundingClientRect();
  const x = (r.left - st.left) / k, y = (r.top - st.top) / k;
  const sx = 1600 / (r.width / k), sy = 900 / (r.height / k);
  return `translate(${-x * sx}px, ${-y * sy}px) scale(${sx}, ${sy})`;
}

function stopDive() {
  diveTimers.forEach(clearTimeout);
  diveTimers = [];
  rig.classList.remove("diving");
  rig.style.transform = "";
  desk.classList.remove("mirror-on", "snap");
  $("#scene").classList.remove("dive");
  $$(".slide").forEach((s) => s.classList.remove("from-pc"));
}

function diveIn() {                                             // slide 4 -> 5
  const slide = $('.slide[data-slide="4"]'), scene = $("#scene");
  const t = diveTransform();
  scene.classList.add("dive");                                  // le texte de la slide 4 s'efface
  desk.classList.add("mirror-on");                              // l'ecran affiche la slide 5
  diveTimers.push(setTimeout(() => {
    rig.classList.add("diving");                                // l'ecran s'etire jusqu'aux bords
    rig.style.transform = t;
  }, FADE_MS));
  diveTimers.push(setTimeout(() => {
    slide.classList.add("from-pc", "on");                       // echange invisible avec la vraie slide 5
    scene.classList.add("off");
    diveTimers.push(setTimeout(() => {                          // la scene est cachee : on remet le PC en place
      rig.classList.remove("diving");
      rig.style.transform = "";
      desk.classList.add("snap");
      desk.classList.remove("mirror-on");
      scene.classList.remove("dive");
      slide.classList.remove("from-pc");
      void desk.offsetWidth;
      desk.classList.remove("snap");
    }, 100));
  }, FADE_MS + GROW_MS + 30));
}

function diveOut() {                                            // slide 5 -> 4
  const slide = $('.slide[data-slide="4"]'), scene = $("#scene");
  desk.classList.add("snap", "mirror-on");
  rig.style.transform = diveTransform();                        // on repart de l'ecran etire
  scene.classList.add("dive");
  scene.classList.remove("off");
  slide.classList.add("from-pc");
  slide.classList.remove("on");
  void rig.offsetWidth;
  desk.classList.remove("snap");
  rig.classList.add("diving");                                  // l'ecran retrecit jusqu'au PC
  rig.style.transform = "";
  diveTimers.push(setTimeout(() => desk.classList.remove("mirror-on"), GROW_MS));
  diveTimers.push(setTimeout(() => {
    rig.classList.remove("diving");
    scene.classList.remove("dive");                             // le texte de la slide 4 revient
    slide.classList.remove("from-pc");
  }, GROW_MS + FADE_MS));
}

function go(n, instant = false) {
  n = Math.max(0, Math.min(TOTAL - 1, n));
  stopDive();
  const dive = !instant && !reduced && $("#scene").dataset.show === "3"
    && ((current === 3 && n === 4) || (current === 4 && n === 3));
  if (dive) {
    if (n === 4) diveIn(); else diveOut();
    current = n;
    $$("#dots i").forEach((d, i) => d.classList.toggle("on", i === n));
    $("#count").textContent = `${n + 1} / ${TOTAL}`;
    $(".nav").classList.remove("light");
    history.replaceState(null, "", "#" + (n + 1));
    return;
  }
  const inScene = n < SCENE_STEPS;
  $("#scene").classList.toggle("off", !inScene);
  $$(".slide[data-slide]").forEach((s) => s.classList.toggle("on", +s.dataset.slide === n));
  if (inScene) {
    const target = Math.min(n, LAST_CAM);
    if (instant || current >= SCENE_STEPS) { cancelAnimationFrame(raf); cam = target; renderCamera(cam); setHud(n); }
    else animateCamera(target, n);
  }
  current = n;
  $$("#dots i").forEach((d, i) => d.classList.toggle("on", i === n));
  $("#count").textContent = `${n + 1} / ${TOTAL}`;
  $(".nav").classList.toggle("light", n === 0 || n === 7);
  history.replaceState(null, "", "#" + (n + 1));
  if (n > 0) $("#hint").classList.add("off");
}

addEventListener("keydown", (e) => {
  if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(current + 1); }
  else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(current - 1); }
  else if (e.key === "Home") go(0);
  else if (e.key === "End") go(TOTAL - 1);
  else if (e.key.toLowerCase() === "f") {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen();
  }
});

// clic : moitie droite = suivant, quart gauche = retour
stage.addEventListener("click", (e) => {
  const r = stage.getBoundingClientRect();
  go(current + ((e.clientX - r.left) / r.width < 0.25 ? -1 : 1));
});

// glisser du doigt (tablette, telephone)
let touchX = null;
addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
  touchX = null;
}, { passive: true });

// ouvrir directement une slide avec index.html#4
go((parseInt(location.hash.slice(1), 10) || 1) - 1, true);