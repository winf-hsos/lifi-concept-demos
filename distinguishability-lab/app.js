/* distinguishability lab — signal und rauschen.
 *
 * Ein simulierter Kanal: k Sendepegel auf der Helligkeitsskala des
 * Sensors, jede Messung streut um ihren Pegel. Links laeuft der
 * Messstrom (weiss = richtig zugeordnet, rot = im falschen Bereich
 * gelandet), rechts zeigen die Verteilungskurven, wie weit sich die
 * Pegel ueberlappen. Drei Regler, ein Zielkonflikt:
 *   - Fensterlaenge: laenger glaettet (sigma ~ 1/sqrt(Fenster)),
 *     kostet aber Symbolrate (eine Messung je Fenster).
 *   - Symbolzahl k: mehr Bits je Symbol, kleinere Abstaende.
 *   - Signalstaerke: staucht oder streckt den nutzbaren Bereich.
 * Das Rauschen ist simuliert; die echten Zahlen liefert die eigene
 * Strecke. Kein Framework, kein Build. */

"use strict";

// --- Kanalmodell ------------------------------------------------------------
const SCALE = 1024;                 // Helligkeitsskala des Sensors
const FLOOR = 70;                   // Grundpegel (Raumlicht)
const SIGMA_BASE = 260;             // sigma = SIGMA_BASE / sqrt(Fenster in ms)
const HISTORY = 400;                // Fenster fuer die Fehlerquote

const state = {
  k: 4,
  windowMs: 50,
  rangePct: 100,
  results: [],                      // true = richtig erkannt
};

function levels() {
  const top = FLOOR + (SCALE - FLOOR - 40) * (state.rangePct / 100);
  const step = (top - FLOOR) / (state.k - 1);
  return Array.from({ length: state.k }, (_, i) => FLOOR + i * step);
}

function sigma() {
  return SIGMA_BASE / Math.sqrt(state.windowMs);
}

function gaussian() {               // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Eine Uebertragung: zufaelliger Pegel, verrauschte Messung, Zuordnung
 * zum naechstgelegenen Pegel. */
function transmit() {
  const lv = levels();
  const sent = Math.floor(Math.random() * state.k);
  const measured = lv[sent] + gaussian() * sigma();
  let best = 0;
  lv.forEach((level, i) => {
    if (Math.abs(measured - level) < Math.abs(measured - lv[best])) best = i;
  });
  const ok = best === sent;
  state.results.push(ok);
  if (state.results.length > HISTORY) state.results.shift();
  return { measured, ok };
}

// --- Zeichnung --------------------------------------------------------------
const PALETTE = {
  bg: "#000000", white: "#ffffff", grayLight: "#b6bec6",
  gray: "#7d868f", grayDark: "#4a5259", blue: "#009ee3",
  red: "#ff4d6d",
};

const canvas = document.getElementById("lab");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, streamW = 0;
const PAD = 14;

function resize() {
  const ratio = window.devicePixelRatio || 1;
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  streamW = W * 0.74;
  dots.length = 0;
  cursor = PAD;
}
window.addEventListener("resize", resize);

const yOf = (value) => H - PAD - (value / SCALE) * (H - 2 * PAD);

const dots = [];                    // { x, y, ok }
let cursor = PAD;

function drawFrame() {
  const lv = levels();
  const s = sigma();
  ctx.clearRect(0, 0, W, H);

  // Entscheidungsgrenzen (Mitten zwischen den Pegeln), gestrichelt
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = PALETTE.grayDark;
  ctx.lineWidth = 1;
  for (let i = 0; i < lv.length - 1; i++) {
    const y = yOf((lv[i] + lv[i + 1]) / 2);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(streamW, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Sendepegel
  ctx.strokeStyle = PALETTE.gray;
  lv.forEach((level) => {
    const y = yOf(level);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(streamW, y);
    ctx.stroke();
  });

  // Messpunkte
  dots.forEach((d) => {
    ctx.fillStyle = d.ok ? PALETTE.white : PALETTE.red;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.ok ? 2 : 3, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Schreibkopf
  ctx.strokeStyle = PALETTE.grayDark;
  ctx.beginPath();
  ctx.moveTo(cursor, PAD);
  ctx.lineTo(cursor, H - PAD);
  ctx.stroke();

  // Rechts: die Verteilungskurven, Ueberlappung wird sichtbar
  const x0 = streamW + 14;
  const amp = W - x0 - PAD;
  ctx.strokeStyle = PALETTE.blue;
  ctx.lineWidth = 1.5;
  lv.forEach((level) => {
    ctx.beginPath();
    for (let dv = -3.2 * s; dv <= 3.2 * s; dv += Math.max(1, s / 12)) {
      const y = yOf(level + dv);
      const x = x0 + amp * Math.exp(-(dv * dv) / (2 * s * s));
      if (dv === -3.2 * s) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
}

// --- Simulationstakt --------------------------------------------------------
/* Sichtbar laufen immer ~40 Symbole je Sekunde durchs Bild; die ECHTE
 * Rate steht in der Statistik. So bleibt die Anzeige bei jedem Fenster
 * fluessig, ohne die Rechnung zu verfaelschen. */
let last = 0;
function tick(ts) {
  if (ts - last > 25) {
    last = ts;
    const { measured, ok } = transmit();
    cursor += 3;
    if (cursor > streamW - 4) {
      cursor = PAD;
      dots.length = 0;              // neue Bildschirmseite
    }
    dots.push({ x: cursor, y: yOf(measured), ok });
    updateStats();
  }
  drawFrame();
  requestAnimationFrame(tick);
}

// --- Statistik und Bedienung ------------------------------------------------
const el = (id) => document.getElementById(id);

function updateStats() {
  const n = state.results.length;
  const errors = state.results.filter((ok) => !ok).length;
  const rate = 1000 / state.windowMs;
  const bits = Math.log2(state.k);

  const errPct = n ? (100 * errors) / n : 0;
  const errEl = el("st-err");
  errEl.textContent = `${errPct.toFixed(1)} %`;
  errEl.className = "value " + (errPct < 0.5 ? "good" : errPct > 5 ? "bad" : "");

  el("st-rate").textContent = `${rate.toFixed(0)}/s`;
  el("st-bits").textContent = bits;
  el("st-bits-note").textContent = `log2(${state.k})`;
  el("st-tp").textContent = `${(rate * bits).toFixed(0)} bit/s`;
}

function readKnobs() {
  el("rd-win").textContent =
    `${state.windowMs} ms  (scatter ±${sigma().toFixed(0)} counts)`;
  el("rd-range").textContent = `${state.rangePct} % of the scale`;
  document.querySelectorAll("#seg-k button").forEach((b) =>
    b.setAttribute("aria-pressed", Number(b.dataset.k) === state.k));
  state.results.length = 0;         // neue Bedingungen, neue Quote
}

document.querySelectorAll("#seg-k button").forEach((b) =>
  b.addEventListener("click", () => {
    state.k = Number(b.dataset.k);
    readKnobs();
  }));
el("in-win").addEventListener("input", (ev) => {
  state.windowMs = Number(ev.target.value);
  readKnobs();
});
el("in-range").addEventListener("input", (ev) => {
  state.rangePct = Number(ev.target.value);
  readKnobs();
});

resize();
readKnobs();
requestAnimationFrame(tick);
