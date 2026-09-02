/* distinguishability lab — signal und rauschen.
 *
 * Ein simulierter Kanal als Oszilloskop mit zwei Ebenen:
 *
 *   1. Das ANALOGE Signal laeuft als duenne, rauschende Kurve
 *      kontinuierlich durch. Sein Rauschen ist eine Eigenschaft des
 *      Kanals und haengt NICHT vom Messfenster ab.
 *   2. Das Messfenster liegt als Band auf der Zeitachse (abwechselnd
 *      getoent). Am Ende jedes Bands mittelt der Empfaenger alle
 *      Rohwerte darin zu EINER Messung: dem weissen Balken. Laengere
 *      Fenster machen die Baender breiter und die Messungen ruhiger,
 *      liefern aber weniger davon je Sekunde. Das erkannte Symbol
 *      steht ueber jedem Band und laeuft unter dem Bild als
 *      Empfangsprotokoll mit; Fehler sind rot.
 *
 * Der Besucher sendet selbst (Klick auf die Spur, Zifferntasten,
 * Pfeiltasten); ein Symbolwechsel mitten im Band ergibt ehrlich eine
 * Mischmessung. Der Stoerknopf legt eine abklingende Drift aufs
 * Signal, wie fremdes Licht oder eine Netzstoerung. Leertaste
 * pausiert. Signal kann Licht, Spannung oder Schall sein; die echten
 * Zahlen liefert die eigene Strecke. Kein Framework, kein Build. */

"use strict";

// --- Kanalmodell ------------------------------------------------------------
const SCALE = 1024;              // Signalskala, Einheiten sind willkuerlich
const FLOOR = 70;                // unterster Sendepegel
const TOP = SCALE - 40;          // oberster Sendepegel
const RAW_DT = 5;                // ms zwischen zwei Rohwerten des Kanals
const SIGMA_RAW = 116;           // Streuung eines einzelnen Rohwerts
const HISTORY = 400;             // Messungen fuer die Fehlerquote
const TRANSCRIPT = 60;           // Laenge des Empfangsprotokolls

const SYSTEM_NAMES = { 2: "binary", 4: "base 4", 8: "octal",
                       16: "hexadecimal" };
const DIGITS = "0123456789ABCDEF";

const state = {
  k: 4,
  windowMs: 50,
  speed: 0.35,                   // Zeitlupe: Anteil der Echtzeit
  current: 1,                    // das gerade gesendete Symbol
  paused: false,
  results: [],                   // true = richtig erkannt
  received: [],                  // Empfangsprotokoll { digit, ok }
};

function levels() {
  const step = (TOP - FLOOR) / (state.k - 1);
  return Array.from({ length: state.k }, (_, i) => FLOOR + i * step);
}

function nearest(value) {
  const lv = levels();
  let best = 0;
  lv.forEach((level, i) => {
    if (Math.abs(value - level) < Math.abs(value - lv[best])) best = i;
  });
  return best;
}

function gaussian() {            // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Stoersignal: schnell ansteigende, wabernd abklingende Drift. */
const disturbance = { amp: 0, sign: 1, startedAt: 0 };

function disturb() {
  disturbance.amp = 140 + Math.random() * 160;
  disturbance.sign = Math.random() < 0.5 ? -1 : 1;
  disturbance.startedAt = simTime;
}

function disturbanceOffset() {
  if (!disturbance.amp) return 0;
  const t = (simTime - disturbance.startedAt) / 1000;
  if (t > 6) { disturbance.amp = 0; return 0; }
  const envelope = Math.min(t / 0.4, 1) * Math.exp(-t / 2.2);
  const wobble = 1 + 0.25 * Math.sin(t * 5.3);
  return disturbance.sign * disturbance.amp * envelope * wobble;
}

// --- Simulation -------------------------------------------------------------
/* Die Simulationszeit laeuft in Echtzeit; alle RAW_DT ms entsteht ein
 * Rohwert, an jeder Fenstergrenze eine Messung. */
let simTime = 0;
let sweepStart = 0;              // Beginn der aktuellen Bildschirmseite
const raws = [];                 // { t, v }   rohes Analogsignal
const marks = [];                // { t0, t1, avg, digit, ok }  Messungen
let win = null;                  // laufendes Fenster { t0, sum, n, tally }

function newWindow(t0) {
  win = { t0, sum: 0, n: 0, tally: new Array(16).fill(0) };
}

/* Der naechste faellige Rohwert lebt UEBER die Frames hinweg: Bei starker
 * Zeitlupe schreitet ein einzelner Frame weniger als RAW_DT voran, und
 * eine Schleife, die jedes Mal bei simTime neu ansetzt, kaeme nie an. */
let nextRawAt = RAW_DT;

function step(dtMs) {
  const end = simTime + dtMs;
  while (nextRawAt <= end) {
    const t = nextRawAt;
    nextRawAt += RAW_DT;
    simTime = t;
    const v = levels()[state.current] + gaussian() * SIGMA_RAW
            + disturbanceOffset();
    raws.push({ t, v });
    win.sum += v;
    win.n += 1;
    win.tally[state.current] += 1;

    if (t >= win.t0 + state.windowMs && win.n > 0) {
      const avg = win.sum / win.n;
      const digit = nearest(avg);
      const sent = win.tally.indexOf(Math.max(...win.tally));
      const ok = digit === sent;
      marks.push({ t0: win.t0, t1: t, avg, digit, ok });
      state.results.push(ok);
      if (state.results.length > HISTORY) state.results.shift();
      state.received.push({ digit, ok });
      if (state.received.length > TRANSCRIPT) state.received.shift();
      newWindow(t);
      updateStats();
      renderTranscript();
    }
  }
  simTime = end;
}

// --- Zeichnung --------------------------------------------------------------
const PALETTE = {
  white: "#ffffff", grayLight: "#b6bec6", gray: "#7d868f",
  grayDark: "#4a5259", blue: "#009ee3", red: "#ff4d6d",
  band: "rgba(255, 255, 255, 0.045)",
};

const canvas = document.getElementById("lab");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, streamW = 0;
const PAD = 14;
const PAD_TOP = 30;              // Platz fuer die Symbolzeile
const PAD_LEFT = 44;             // Platz fuer die Spur-Beschriftung
const PX_PER_MS = 0.35;          // Zeitachse: Band = Fensterlaenge

function resize() {
  const ratio = window.devicePixelRatio || 1;
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  streamW = W - PAD;
}
window.addEventListener("resize", resize);

const yOf = (value) =>
  H - PAD - (value / SCALE) * (H - PAD - PAD_TOP);
const xOf = (t) => PAD_LEFT + (t - sweepStart) * PX_PER_MS;

/* Der Sweep: Ist der Schreibkopf rechts angekommen, beginnt eine neue
 * Bildschirmseite; die alte Kurve verschwindet, nichts scrollt. */
function prune() {
  if (xOf(simTime) > streamW - 4) {
    sweepStart = simTime;
    raws.length = 0;
    marks.length = 0;
  }
}

function drawFrame() {
  const lv = levels();
  ctx.clearRect(0, 0, W, H);

  // Fensterbaender, abwechselnd getoent; das laufende Band zuletzt
  const alle = marks.concat([{ t0: win.t0, t1: simTime, laufend: true }]);
  alle.forEach((m, idx) => {
    if (idx % 2 === 0 || m.laufend) {
      const x0 = Math.max(PAD_LEFT, xOf(m.t0));
      const x1 = Math.min(streamW, xOf(m.t1));
      if (x1 > x0) {
        ctx.fillStyle = PALETTE.band;
        ctx.fillRect(x0, PAD_TOP, x1 - x0, H - PAD - PAD_TOP);
      }
    }
  });

  // Entscheidungsgrenzen, gestrichelt
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

  // Das analoge Signal: duenne, rauschende Kurve
  if (raws.length > 1) {
    ctx.strokeStyle = PALETTE.gray;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let begonnen = false;
    raws.forEach((r) => {
      const x = xOf(r.t);
      if (x < PAD_LEFT) return;
      const y = yOf(r.v);
      if (!begonnen) { ctx.moveTo(x, y); begonnen = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Die Messungen: ein Balken je Band auf Hoehe des Mittelwerts,
  // darueber das erkannte Symbol
  ctx.font = "12px 'Roboto Mono', monospace";
  marks.forEach((m) => {
    const x0 = Math.max(PAD_LEFT, xOf(m.t0));
    const x1 = Math.min(streamW, xOf(m.t1));
    if (x1 <= x0) return;
    const y = yOf(m.avg);
    ctx.strokeStyle = m.ok ? PALETTE.white : PALETTE.red;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    if (x1 - x0 >= 13) {
      ctx.fillStyle = m.ok ? PALETTE.grayLight : PALETTE.red;
      ctx.fillText(DIGITS[m.digit], (x0 + x1) / 2 - 4, PAD_TOP - 12);
    }
  });

  // Schreibkopf
  const kopf = xOf(simTime);
  ctx.strokeStyle = PALETTE.grayDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(kopf, PAD_TOP);
  ctx.lineTo(kopf, H - PAD);
  ctx.stroke();

  if (disturbance.amp) {
    ctx.fillStyle = PALETTE.red;
    ctx.font = "13px Arial";
    ctx.fillText("disturbance active", PAD_LEFT + 8, PAD_TOP + 12);
  } else if (state.paused) {
    ctx.fillStyle = PALETTE.gray;
    ctx.font = "14px Arial";
    ctx.fillText("paused — press space", PAD_LEFT + 8, PAD_TOP + 12);
  }
}

// --- Takt -------------------------------------------------------------------
let lastTs = 0;
function tick(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(ts - lastTs, 100);   // Tab-Wechsel nicht nachholen
  lastTs = ts;
  if (!state.paused) {
    step(dt * state.speed);      // Zeitlupe wirkt nur auf die Anzeige
    prune();
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
  el("st-bits").textContent = bits.toFixed(2).replace(/\.?0+$/, "");
  el("st-bits-note").textContent = `log2(${state.k})`;
  el("st-tp").textContent = `${(rate * bits).toFixed(0)} bit/s`;
}

function renderTranscript() {
  el("st-recv").innerHTML = state.received
    .map((r) => r.ok ? DIGITS[r.digit]
                     : `<span class="err">${DIGITS[r.digit]}</span>`)
    .join("");
}

function readKnobs() {
  if (state.current >= state.k) state.current = state.k - 1;
  const name = SYSTEM_NAMES[state.k] || `base ${state.k}`;
  el("rd-k").textContent =
    `${state.k} symbols (${name}): 0 to ${DIGITS[state.k - 1]}`;
  el("rd-win").textContent =
    `${state.windowMs} ms: averages ` +
    `${Math.round(state.windowMs / RAW_DT)} raw readings`;
  el("rd-speed").textContent =
    `${Math.round(state.speed * 100)} % of real time`;
  el("st-sending").textContent = DIGITS[state.current];
  state.results.length = 0;        // neue Bedingungen, neue Quote
  newWindow(simTime);
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

el("in-k").addEventListener("input", (ev) => {
  state.k = Number(ev.target.value);
  readKnobs();
});
el("in-win").addEventListener("input", (ev) => {
  state.windowMs = Number(ev.target.value);
  readKnobs();
});
el("in-speed").addEventListener("input", (ev) => {
  state.speed = Number(ev.target.value) / 100;
  readKnobs();
});
el("btn-pause").addEventListener("click", () => {
  state.paused = !state.paused;
  el("btn-pause").textContent = state.paused ? "run" : "pause";
});

/* Einzelschritt: haelt an und fuehrt genau ein Messfenster aus, vom
 * Fensteranfang bis zur fertigen Messung. Gut zum Vorfuehren. */
function stepOnce() {
  if (!state.paused) {
    state.paused = true;
    el("btn-pause").textContent = "run";
  }
  const bis = win.t0 + state.windowMs - simTime;
  step(Math.max(bis, RAW_DT));
  prune();
}
el("btn-step").addEventListener("click", stepOnce);
el("btn-disturb").addEventListener("click", disturb);

window.addEventListener("keydown", (ev) => {
  // Auf Buttons und Reglern gelten deren eigene Tastenbelegungen
  if (["BUTTON", "INPUT"].includes(ev.target.tagName)) return;
  const digit = DIGITS.indexOf(ev.key.toUpperCase());
  if (ev.key === " ") {
    state.paused = !state.paused;
    el("btn-pause").textContent = state.paused ? "run" : "pause";
  } else if (ev.key === "d") {
    disturb();
  } else if (ev.key === "m") {
    stepOnce();
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
newWindow(0);
readKnobs();
requestAnimationFrame(tick);
