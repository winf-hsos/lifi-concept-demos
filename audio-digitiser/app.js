/* the audio digitiser — analog und digital.
 *
 * Dieselben zwei Schnitte wie beim Bild, jetzt fuers Ohr. Ein im Code
 * erzeugter "analoger" Klang (48.000 Werte je Sekunde als
 * Stellvertreter fuer stufenlos) wird digitalisiert:
 *
 *   Abtastrate:  wie oft je Sekunde wird gemessen? (48 kHz bis 1 kHz)
 *   Bit-Tiefe:   wie viele Lautstaerkestufen je Messung? (16 bis 1 bit)
 *
 * Das Ergebnis ist zu SEHEN (Treppenkurve ueber der glatten Welle) und
 * zu HOEREN (Web Audio API, im Browser eingebaut, keine Abhaengigkeit).
 * Digitalisiert wird absichtlich naiv per Halten und Runden, ohne die
 * Glaettungsfilter echter Wandler; so hoert man die Schnitte pur,
 * inklusive der Aliasing-Artefakte bei zu grober Abtastung. Genau das
 * steht als ehrlicher Hinweis auch auf der Seite.
 *
 * Die Rechnung darunter ist dieselbe wie beim Bild: Messungen mal Bits
 * gleich Dateigroesse, und auf der Lichtstrecke wird daraus Zeit.
 * Kein Framework, kein Build; der Klang ist prozedural erzeugt. */

"use strict";

const SR = 48000;                  // "analoge" Referenzrate
const DUR = 2.5;                   // Sekunden je Klang
const LEN = SR * DUR;

const RATES = [1000, 2000, 4000, 6000, 8000, 12000, 24000, 48000];
const RATE_HINTS = {
  48000: "dvd and studio standard",
  24000: "plenty for music",
  12000: "old sound cards",
  8000:  "the telephone network",
  6000:  "walkie-talkie territory",
  4000:  "muffled, highs are gone",
  2000:  "underwater",
  1000:  "barely a sound left",
};
const DEPTHS = [
  { bits: 16, hint: "cd and wav standard" },
  { bits: 8,  hint: "telephone, early samplers" },
  { bits: 4,  hint: "early game consoles" },
  { bits: 2,  hint: "four loudness levels" },
  { bits: 1,  hint: "a switch: loud or quiet" },
];
const LINK_BPS = 30;               // mittlere Challenge-Groessenordnung

const state = { rateIdx: 7, depthIdx: 0 };
let motif = "melody";

const el = (id) => document.getElementById(id);

// --- Die Klaenge, prozedural -------------------------------------------------
function envelope(t, dur) {        // kurzer Anschlag, weiches Ausklingen
  const a = Math.min(t / 0.01, 1);
  return a * Math.exp(-3 * t / dur);
}

function makeMelody() {
  const notes = [262, 330, 392, 523];   // c4 e4 g4 c5
  const data = new Float32Array(LEN);
  notes.forEach((f0, n) => {
    // Ganzzahliger Startindex: floor(start*SR + i) wuerde durch
    // Fliesskomma-Rundung einzelne Samples doppelt treffen
    const base = Math.round(n * 0.58 * SR);
    for (let i = 0; i < 0.58 * SR; i++) {
      const t = i / SR;
      const idx = base + i;
      if (idx >= LEN) break;
      let v = 0;
      [1, 0.5, 0.25, 0.12].forEach((amp, h) => {
        v += amp * Math.sin(2 * Math.PI * f0 * (h + 1) * t);
      });
      data[idx] += 0.35 * envelope(t, 0.58) * v;
    }
  });
  return data;
}

function makeBass() {
  const pattern = [110, 110, 165, 110, 131, 131, 98, 110];
  const data = new Float32Array(LEN);
  pattern.forEach((f0, n) => {
    const base = Math.round(n * 0.31 * SR);
    for (let i = 0; i < 0.28 * SR; i++) {
      const t = i / SR;
      const idx = base + i;
      if (idx >= LEN) break;
      let v = 0;
      [1, 0, 0.33, 0, 0.2].forEach((amp, h) => {   // ungerade Obertoene
        if (amp) v += amp * Math.sin(2 * Math.PI * f0 * (h + 1) * t);
      });
      data[idx] += 0.5 * envelope(t, 0.28) * v;
    }
  });
  return data;
}

function makeChirp() {
  const data = new Float32Array(LEN);
  for (let c = 0; c < 4; c++) {
    const base = Math.round(c * 0.62 * SR);
    for (let i = 0; i < 0.45 * SR; i++) {
      const t = i / SR;
      const idx = base + i;
      if (idx >= LEN) break;
      // aufwaerts gezwitschert: 1400 Hz bis 3600 Hz je Ruf
      const phase = 2 * Math.PI * (1400 * t + 1100 * t * t / 0.45);
      data[idx] += 0.45 * envelope(t, 0.45) * Math.sin(phase);
    }
  }
  return data;
}

const SOUNDS = { melody: makeMelody(), bass: makeBass(), chirp: makeChirp() };

// --- Digitalisieren ----------------------------------------------------------
function quantize(v, bits) {
  const levels = (1 << bits) - 1;
  const q = Math.round((v * 0.5 + 0.5) * levels) / levels;
  return q * 2 - 1;
}

function digitise() {
  const src = SOUNDS[motif];
  const rate = RATES[state.rateIdx];
  const bits = DEPTHS[state.depthIdx].bits;
  const hold = SR / rate;                        // alle Raten teilen 48000
  const out = new Float32Array(LEN);
  for (let i = 0; i < LEN; i += hold) {
    const q = quantize(src[i], bits);
    out.fill(q, i, Math.min(i + hold, LEN));     // halten bis zur naechsten
  }
  return out;
}

let digital = null;

// --- Zeichnung: ein 25-ms-Fenster --------------------------------------------
const canvas = el("wave");
const ctx = canvas.getContext("2d");
let W = 0, H = 0;
const WINDOW_S = 0.025;
const WINDOW_AT = { melody: 0.05, bass: 0.02, chirp: 0.06 };

function resize() {
  const ratio = window.devicePixelRatio || 1;
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener("resize", () => { resize(); draw(); });

function draw() {
  ctx.clearRect(0, 0, W, H);
  const start = Math.floor(WINDOW_AT[motif] * SR);
  const n = Math.floor(WINDOW_S * SR);
  const xOf = (i) => (i / n) * W;
  const yOf = (v) => H / 2 - v * (H / 2 - 14);

  ctx.font = "12px Arial";
  ctx.fillStyle = "#7d868f";
  ctx.fillText("one 25 ms window of the sound", 10, 18);

  // Nulllinie
  ctx.strokeStyle = "#4a5259";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // analoge Welle
  const src = SOUNDS[motif];
  ctx.strokeStyle = "#b6bec6";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const y = yOf(src[start + i]);
    if (i === 0) ctx.moveTo(xOf(i), y);
    else ctx.lineTo(xOf(i), y);
  }
  ctx.stroke();

  // digitale Treppe
  ctx.strokeStyle = "#009ee3";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const y = yOf(digital[start + i]);
    if (i === 0) ctx.moveTo(xOf(i), y);
    else ctx.lineTo(xOf(i), y);
  }
  ctx.stroke();

  // Abtastpunkte, wenn sie sich trennen lassen
  const hold = SR / RATES[state.rateIdx];
  if (xOf(hold) >= 5) {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < n; i += hold) {
      ctx.beginPath();
      ctx.arc(xOf(i), yOf(digital[start + i]), 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

// --- Rechnung ---------------------------------------------------------------
const fmt = (n) => n.toLocaleString("en-US");

function fmtTime(seconds) {
  if (seconds < 90) return `${Math.round(seconds)} seconds`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} hours`;
  return `${(seconds / 86400).toFixed(1)} days`;
}

function updateCalc() {
  const rate = RATES[state.rateIdx];
  const bits = DEPTHS[state.depthIdx].bits;
  const total = DUR * rate * bits;
  const bytes = total / 8;
  el("calc-line").textContent =
    `${DUR} s × ${fmt(rate)} samples/s × ${bits} bit`;
  el("calc-size").textContent =
    `= ${fmt(total)} bit = ${fmt(bytes)} bytes` +
    (bytes >= 1024 ? ` ≈ ${(bytes / 1024).toFixed(1)} KB` : "");
  el("calc-time").textContent =
    `over your light link at ${LINK_BPS} bit/s: about ${fmtTime(total / LINK_BPS)}`;
  el("rd-rate").textContent =
    `${fmt(rate)} Hz: ${RATE_HINTS[rate]}`;
  el("rd-depth").textContent =
    `${bits} bit = ${fmt(1 << bits)} levels: ${DEPTHS[state.depthIdx].hint}`;
}

function render() {
  digital = digitise();
  draw();
  updateCalc();
}

// --- Abspielen ---------------------------------------------------------------
let audioCtx = null;
let playing = null;

function play(data) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  stop();
  const buf = audioCtx.createBuffer(1, LEN, SR);
  buf.copyToChannel(data, 0);
  playing = audioCtx.createBufferSource();
  playing.buffer = buf;
  playing.connect(audioCtx.destination);
  playing.start();
}

function stop() {
  if (playing) {
    try { playing.stop(); } catch (e) { /* schon zu Ende */ }
    playing = null;
  }
}

el("btn-orig").addEventListener("click", () => play(SOUNDS[motif]));
el("btn-dig").addEventListener("click", () => play(digital));
el("btn-stop").addEventListener("click", stop);

// --- Bedienung --------------------------------------------------------------
el("in-rate").addEventListener("input", (ev) => {
  state.rateIdx = Number(ev.target.value);
  render();
});

const seg = el("seg-depth");
DEPTHS.forEach((depth, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ctrl";
  b.textContent = `${depth.bits}-bit`;
  b.setAttribute("aria-pressed", i === state.depthIdx ? "true" : "false");
  b.addEventListener("click", () => {
    state.depthIdx = i;
    seg.querySelectorAll("button").forEach((x, j) =>
      x.setAttribute("aria-pressed", j === i ? "true" : "false"));
    render();
  });
  seg.appendChild(b);
});

el("motifs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  motif = b.dataset.m;
  el("motifs").querySelectorAll("button").forEach((x) =>
    x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  stop();
  render();
});

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (tag === "BUTTON") document.activeElement.blur();
  if (ev.key === "o") play(SOUNDS[motif]);
  else if (ev.key === "p") play(digital);
  else if (ev.key === "s") stop();
  else if (ev.key === "ArrowLeft" && state.rateIdx > 0) {
    state.rateIdx -= 1;
    el("in-rate").value = String(state.rateIdx);
    render();
  } else if (ev.key === "ArrowRight" && state.rateIdx < RATES.length - 1) {
    state.rateIdx += 1;
    el("in-rate").value = String(state.rateIdx);
    render();
  }
});

// --- Start ------------------------------------------------------------------
resize();
render();
