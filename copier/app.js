/* the copier — analog und digital.
 *
 * Dasselbe Bild laeuft durch zwei Kopierketten, und BEIDE bekommen bei
 * jeder Kopie dasselbe Rauschen auf jeden Pixel:
 *
 *   analog:  kopiert die Werte, wie sie sind. Das Rauschen addiert
 *            sich Generation um Generation, das Bild wird Matsch.
 *   digital: vor jeder Weitergabe wird jeder Pixel auf die naechste
 *            der vier vereinbarten Stufen gerundet (Schwellen-
 *            entscheidung). Kleines Rauschen wird dadurch VOLLSTAENDIG
 *            geheilt: Generation 100 gleicht Generation 1.
 *
 * Die Ehrlichkeit steckt in zwei Details. Erstens kostet die
 * Digitalisierung einmalig etwas: Schon Generation 0 der digitalen
 * Kette ist auf 4 Stufen gerundet und damit groeber als das Original.
 * Zweitens ist digital nicht magisch: Uebersteigt das Rauschen etwa
 * die halbe Stufenluecke, kippen Pixel auf die falsche Stufe, und
 * dieser Fehler bleibt dann fuer immer, denn die naechste Entscheidung
 * bestaetigt ihn. Genau die Grenze zeigt der Regler.
 *
 * Kein Framework, kein Build; das Bild ist prozedural gezeichnet. */

"use strict";

const SIZE = 128;
const N = SIZE * SIZE;
const LEVELS = [0, 85, 170, 255];
const GAP = 85;

const state = { sigma: 8 };
let generation = 0;

const el = (id) => document.getElementById(id);

function gaussian() {              // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (x) => Math.max(0, Math.min(255, x));

function quantize(x) {
  return LEVELS[Math.round(clamp(x) / GAP)];
}

// --- Das Original: eine kleine Nachtszene, prozedural ------------------------
function drawOriginal() {
  const img = new Float64Array(N);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Himmel: sanfter Verlauf; quantisiert ergibt er ehrliches Banding
      let v = 20 + (y / SIZE) * 55;
      // Mond: heller Kreis mit weichem Rand
      const dm = Math.hypot(x - 92, y - 30);
      if (dm < 16) v = 235;
      else if (dm < 20) v = 235 - (dm - 16) / 4 * 170;
      // Huegel: hinten hell, vorne dunkel, damit alle vier Stufen leben
      const h1 = 78 + 12 * Math.sin(x / 14) + 5 * Math.sin(x / 5);
      const h2 = 98 + 10 * Math.sin(x / 9 + 2);
      if (y > h1) v = 150;
      if (y > h2) v = 60;
      img[y * SIZE + x] = v;
    }
  }
  return img;
}

const orig = drawOriginal();
let analog = null;
let digital = null;
let digitalStart = null;                  // Generation 0 der digitalen Kette

// --- Kopieren ---------------------------------------------------------------
function copyOnce() {
  for (let i = 0; i < N; i++) {
    const noise = gaussian() * state.sigma;
    analog[i] = clamp(analog[i] + noise);
    digital[i] = quantize(digital[i] + noise);
  }
  generation += 1;
  render();
}

function copyMany(n) {
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < N; i++) {
      const noise = gaussian() * state.sigma;
      analog[i] = clamp(analog[i] + noise);
      digital[i] = quantize(digital[i] + noise);
    }
  }
  generation += n;
  render();
}

function reset() {
  analog = Float64Array.from(orig);
  digitalStart = Float64Array.from(orig, quantize);
  digital = Float64Array.from(digitalStart);
  generation = 0;
  render();
}

// --- Anzeige ----------------------------------------------------------------
function paint(canvasId, data) {
  const ctx = el(canvasId).getContext("2d");
  const img = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < N; i++) {
    const v = data[i];
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function render() {
  paint("cv-orig", orig);
  paint("cv-analog", analog);
  paint("cv-digital", digital);

  let sq = 0;
  for (let i = 0; i < N; i++) sq += (analog[i] - orig[i]) ** 2;
  const rms = Math.sqrt(sq / N);
  el("rd-analog").innerHTML =
    `drift: <span class="${rms > 20 ? "bad" : ""}">rms ${rms.toFixed(1)}</span>`;

  let flipped = 0;
  for (let i = 0; i < N; i++) if (digital[i] !== digitalStart[i]) flipped += 1;
  const pct = (flipped / N) * 100;
  el("rd-digital").innerHTML =
    `flipped pixels: <span class="${flipped ? "bad" : "good"}">` +
    `${pct.toFixed(pct && pct < 0.1 ? 2 : 1)} %</span>`;

  el("st-gen").textContent = generation;
  el("st-noise").textContent = state.sigma;
  const margin = el("st-margin");
  // Kippgefahr je Kopie: Abstand der Schwelle in Sigma-Einheiten
  const z = (GAP / 2) / state.sigma;
  margin.textContent = z >= 4 ? "yes" : z >= 3 ? "barely" : "no";
  margin.className = "value" + (z < 3 ? " bad" : "");
  el("rd-noise").textContent =
    `σ = ${state.sigma} · errors start near half the gap (≈ 42)`;
}

// --- Bedienung --------------------------------------------------------------
el("in-noise").addEventListener("input", (ev) => {
  state.sigma = Number(ev.target.value);
  render();
});
el("btn-copy").addEventListener("click", copyOnce);
el("btn-copy10").addEventListener("click", () => copyMany(10));
el("btn-copy100").addEventListener("click", () => copyMany(100));
el("btn-reset").addEventListener("click", reset);

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (ev.key === "c") copyOnce();
  else if (ev.key === "x") copyMany(10);
  else if (ev.key === "r") reset();
});

// --- Start ------------------------------------------------------------------
reset();
