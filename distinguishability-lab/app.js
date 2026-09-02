/* distinguishability lab — signal und rauschen.
 *
 * Ein simulierter Kanal als kleines Oszilloskop: Der Besucher SENDET
 * selbst ein Symbol (Klick auf die Spur, Zifferntasten, Pfeiltasten),
 * und der Messstrom zeigt als geglaettete Kurve, wie die verrauschten
 * Messungen um den gesendeten Pegel entstehen. Rutscht eine Messung
 * ueber eine Entscheidungsgrenze, markiert sie ein roter Punkt: Der
 * Empfaenger haette das falsche Symbol verstanden. Rechts zeigen die
 * Verteilungskurven die Ueberlappung der Pegel.
 *
 * Drei Regler, ein Zielkonflikt: Fensterlaenge glaettet (sigma ~
 * 1/sqrt(Fenster)) und kostet Rate; mehr Symbole tragen mehr Bits und
 * schrumpfen die Abstaende; die Signalstaerke streckt oder staucht den
 * nutzbaren Bereich. Leertaste pausiert. Das Rauschen ist simuliert;
 * die echten Zahlen liefert die eigene Strecke. Kein Framework, kein
 * Build. */

"use strict";

// --- Kanalmodell ------------------------------------------------------------
const SCALE = 1024;                 // Helligkeitsskala des Sensors
const FLOOR = 70;                   // Grundpegel (Raumlicht)
const SIGMA_BASE = 260;             // sigma = SIGMA_BASE / sqrt(Fenster in ms)
const HISTORY = 400;                // Fenster fuer die Fehlerquote

const SYSTEM_NAMES = { 2: "binary", 4: "base 4", 8: "octal",
                       16: "hexadecimal" };
const DIGITS = "0123456789ABCDEF";

const state = {
  k: 4,
  windowMs: 50,
  rangePct: 100,
  current: 1,                       // das gerade gesendete Symbol
  paused: false,
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

/* Eine Messung des gerade gesendeten Symbols, Zuordnung zum
 * naechstgelegenen Pegel. */
function measure() {
  const lv = levels();
  const measured = lv[state.current] + gaussian() * sigma();
  let best = 0;
  lv.forEach((level, i) => {
    if (Math.abs(measured - level) < Math.abs(measured - lv[best])) best = i;
  });
  const ok = best === state.current;
  state.results.push(ok);
  if (state.results.length > HISTORY) state.results.shift();
  return { measured, ok };
}

// --- Zeichnung --------------------------------------------------------------
const PALETTE = {
  white: "#ffffff", grayLight: "#b6bec6", gray: "#7d868f",
  grayDark: "#4a5259", blue: "#009ee3", red: "#ff4d6d",
};

const canvas = document.getElementById("lab");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, streamW = 0;
const PAD = 14;
const PAD_LEFT = 44;                // Platz fuer die Spur-Beschriftung

function resize() {
  const ratio = window.devicePixelRatio || 1;
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  streamW = W * 0.74;
  samples.length = 0;
  cursor = PAD_LEFT;
}
window.addEventListener("resize", resize);

const yOf = (value) => H - PAD - (value / SCALE) * (H - 2 * PAD);

const samples = [];                 // { x, y, ok }
let cursor = PAD_LEFT;

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
    ctx.moveTo(PAD_LEFT, y);
    ctx.lineTo(streamW, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Sendepegel samt Symbolnummer links; das gesendete Symbol in Blau
  ctx.font = "13px 'Roboto Mono', monospace";
  ctx.textBaseline = "middle";
  lv.forEach((level, i) => {
    const y = yOf(level);
    const active = i === state.current;
    ctx.strokeStyle = active ? PALETTE.blue : PALETTE.gray;
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, y);
    ctx.lineTo(streamW, y);
    ctx.stroke();
    ctx.fillStyle = active ? PALETTE.blue : PALETTE.gray;
    ctx.fillText(DIGITS[i], 16, y);
  });

  // Messkurve: geglaettete Linie durch die Messpunkte (Oszilloskop-Optik)
  if (samples.length > 1) {
    ctx.strokeStyle = PALETTE.grayLight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(samples[0].x, samples[0].y);
    for (let i = 1; i < samples.length - 1; i++) {
      const mx = (samples[i].x + samples[i + 1].x) / 2;
      const my = (samples[i].y + samples[i + 1].y) / 2;
      ctx.quadraticCurveTo(samples[i].x, samples[i].y, mx, my);
    }
    ctx.stroke();
  }

  // Fehlmessungen als rote Punkte auf der Kurve
  ctx.fillStyle = PALETTE.red;
  samples.forEach((p) => {
    if (!p.ok) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  });

  // Schreibkopf
  ctx.strokeStyle = PALETTE.grayDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cursor, PAD);
  ctx.lineTo(cursor, H - PAD);
  ctx.stroke();

  // Rechts: die Verteilungskurven, Ueberlappung wird sichtbar
  const x0 = streamW + 14;
  const amp = W - x0 - PAD;
  ctx.lineWidth = 1.5;
  lv.forEach((level, i) => {
    ctx.strokeStyle = i === state.current ? PALETTE.blue : PALETTE.grayDark;
    ctx.beginPath();
    for (let dv = -3.2 * s; dv <= 3.2 * s; dv += Math.max(1, s / 12)) {
      const y = yOf(level + dv);
      const x = x0 + amp * Math.exp(-(dv * dv) / (2 * s * s));
      if (dv === -3.2 * s) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  if (state.paused) {
    ctx.fillStyle = PALETTE.gray;
    ctx.font = "14px Arial";
    ctx.fillText("paused — press space", PAD_LEFT + 8, PAD + 12);
  }
}

// --- Simulationstakt --------------------------------------------------------
/* Sichtbar laufen immer ~40 Messungen je Sekunde durchs Bild; die ECHTE
 * Rate steht in der Statistik. So bleibt die Anzeige bei jedem Fenster
 * fluessig, ohne die Rechnung zu verfaelschen. */
let last = 0;
function tick(ts) {
  if (!state.paused && ts - last > 25) {
    last = ts;
    const { measured, ok } = measure();
    cursor += 3;
    if (cursor > streamW - 4) {
      cursor = PAD_LEFT;
      samples.length = 0;           // neue Bildschirmseite
    }
    samples.push({ x: cursor, y: yOf(measured), ok });
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
  if (state.current >= state.k) state.current = state.k - 1;
  el("rd-k").textContent =
    `${SYSTEM_NAMES[state.k]}: symbols 0 to ${DIGITS[state.k - 1]}`;
  el("rd-win").textContent =
    `${state.windowMs} ms  (scatter ±${sigma().toFixed(0)} counts)`;
  el("rd-range").textContent = `${state.rangePct} % of the scale`;
  el("st-sending").textContent = DIGITS[state.current];
  document.querySelectorAll("#seg-k button").forEach((b) =>
    b.setAttribute("aria-pressed", Number(b.dataset.k) === state.k));
  state.results.length = 0;         // neue Bedingungen, neue Quote
}

function selectSymbol(i) {
  if (i >= 0 && i < state.k) {
    state.current = i;
    el("st-sending").textContent = DIGITS[state.current];
    state.results.length = 0;
  }
}

// Klick oder Tipp auf die Spur waehlt den naechstgelegenen Pegel
canvas.addEventListener("pointerdown", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const y = ev.clientY - rect.top;
  const lv = levels();
  let best = 0;
  lv.forEach((level, i) => {
    if (Math.abs(y - yOf(level)) < Math.abs(y - yOf(lv[best]))) best = i;
  });
  selectSymbol(best);
});

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
el("btn-pause").addEventListener("click", () => {
  state.paused = !state.paused;
  el("btn-pause").textContent = state.paused ? "run" : "pause";
});

window.addEventListener("keydown", (ev) => {
  // Auf Buttons und Reglern gelten deren eigene Tastenbelegungen
  if (["BUTTON", "INPUT"].includes(ev.target.tagName)) return;
  const digit = DIGITS.indexOf(ev.key.toUpperCase());
  if (ev.key === " ") {
    state.paused = !state.paused;
    el("btn-pause").textContent = state.paused ? "run" : "pause";
  } else if (digit >= 0 && digit < state.k) {
    selectSymbol(digit);
  } else if (ev.key === "ArrowUp") {
    selectSymbol(state.current + 1);
  } else if (ev.key === "ArrowDown") {
    selectSymbol(state.current - 1);
  } else {
    return;
  }
  ev.preventDefault();
});

resize();
readKnobs();
requestAnimationFrame(tick);
