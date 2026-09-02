/* the digitiser — analog und digital.
 *
 * Links ein Fotomotiv als "analoges" Original (KI-generiert, geteilt
 * mit dem Copier als Bruecke), rechts seine Digitalisierung.
 * Zwei Entscheidungen, beide mit Preisschild:
 *
 *   Aufloesung:  wie viele Bildpunkte? (256x256 bis hinunter
 *                zu einem einzigen Pixel)
 *   Farbtiefe:   wie viele Farben je Punkt? 1 bit s/w, 2 bit grau
 *                (Game Boy), 8 bit grau, 8/16/24 bit Farbe. Jede Stufe
 *                traegt ihren historischen Ort als Hinweis.
 *
 * Darunter steht die Rechnung offen ausgeschrieben: Pixel mal Bits je
 * Pixel gleich Dateigroesse, und daneben, wie lange dieses Bild ueber
 * die eigene Lichtstrecke braeuchte (30 bit/s als mittlere Challenge-
 * Groessenordnung). Das verankert Dateigroessen im Projekt.
 *
 * Kein Framework, kein Build. */

"use strict";

const FULL = 256;
const RESOLUTIONS = [1, 2, 4, 8, 16, 32, 64, 128, 256];
const DEPTHS = [
  { key: "bw",    label: "b/w",       bits: 1,
    desc: "2 colours — fax machines, e-paper price tags" },
  { key: "grey2", label: "4 greys",   bits: 2,
    desc: "4 shades of grey — the original game boy display" },
  { key: "grey",  label: "greyscale", bits: 8,
    desc: "256 shades of grey — scanners, x-ray images" },
  { key: "c8",    label: "8-bit",     bits: 8,
    desc: "256 colours (3+3+2) — the gif and vga era" },
  { key: "c16",   label: "16-bit",    bits: 16,
    desc: "65,536 colours (5+6+5) — 1990s desktops, gadget displays" },
  { key: "c24",   label: "24-bit",    bits: 24,
    desc: "16.7 million colours (8+8+8) — today's standard" },
];
const LINK_BPS = 30;               // mittlere Challenge-Groessenordnung

const state = { resIdx: 5, depthIdx: 5 };
const el = (id) => document.getElementById(id);

// --- Fotomotive --------------------------------------------------------------
const MOTIFS = ["parrot", "sunset", "lighthouse"];
let motif = "parrot";
const origCv = el("cv-orig");
const photos = {};

function loadMotif(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { photos[name] = img; resolve(); };
    img.src = `../assets/photos/${name}.png`;
  });
}

/* Das Original samt hauchduennem Abtastraster: jede Zelle wird rechts
 * zu EINEM Pixel zusammengefasst. Bei feinen Rastern (Zellen unter
 * 8 px) faellt das Gitter weg, sonst laege es wie ein Schleier
 * ueber dem Bild. */
function drawOriginal() {
  const ctx = origCv.getContext("2d");
  ctx.drawImage(photos[motif], 0, 0, FULL, FULL);
  const res = RESOLUTIONS[state.resIdx];
  const cell = FULL / res;
  if (cell < 8) return;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < res; i++) {
    ctx.moveTo(i * cell + 0.5, 0);
    ctx.lineTo(i * cell + 0.5, FULL);
    ctx.moveTo(0, i * cell + 0.5);
    ctx.lineTo(FULL, i * cell + 0.5);
  }
  ctx.stroke();
}

// --- Digitalisieren ----------------------------------------------------------
const level = (v, bits) => {
  const steps = (1 << bits) - 1;
  return Math.round(Math.round(v / 255 * steps) / steps * 255);
};

function digitise() {
  const res = RESOLUTIONS[state.resIdx];
  const depth = DEPTHS[state.depthIdx];
  // Abtasten: das Original auf res x res Punkte mitteln
  const small = document.createElement("canvas");
  small.width = res;
  small.height = res;
  const sctx = small.getContext("2d");
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(photos[motif], 0, 0, res, res);
  const img = sctx.getImageData(0, 0, res, res);
  const d = img.data;
  // Quantisieren: jeden Kanal auf die vereinbarten Stufen runden
  for (let i = 0; i < d.length; i += 4) {
    if (depth.key === "bw") {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = lum >= 118 ? 255 : 0;
    } else if (depth.key === "grey2") {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const q = Math.round(lum / 255 * 3) * 85;
      d[i] = d[i + 1] = d[i + 2] = q;
    } else if (depth.key === "grey") {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = Math.round(lum);
    } else if (depth.key === "c8") {
      d[i] = level(d[i], 3);
      d[i + 1] = level(d[i + 1], 3);
      d[i + 2] = level(d[i + 2], 2);
    } else if (depth.key === "c16") {
      d[i] = level(d[i], 5);
      d[i + 1] = level(d[i + 1], 6);
      d[i + 2] = level(d[i + 2], 5);
    }
  }
  sctx.putImageData(img, 0, 0);
  // Anzeige: pixelig hochskaliert
  const out = el("cv-dig");
  out.width = res;
  out.height = res;
  out.getContext("2d").drawImage(small, 0, 0);
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
  const res = RESOLUTIONS[state.resIdx];
  const depth = DEPTHS[state.depthIdx];
  const bits = res * res * depth.bits;
  const bytes = bits / 8;
  el("calc-line").textContent =
    `${res} × ${res} pixels × ${depth.bits} bit`;
  el("calc-size").textContent =
    `= ${fmt(bits)} bit = ${fmt(bytes)} bytes` +
    (bytes >= 1024 ? ` ≈ ${(bytes / 1024).toFixed(bytes >= 102400 ? 0 : 1)} KB` : "");
  el("calc-time").textContent =
    `over your light link at ${LINK_BPS} bit/s: about ${fmtTime(bits / LINK_BPS)}`;
  el("rd-res").textContent = `${res} × ${res} = ${fmt(res * res)} pixels`;
  el("rd-depth").textContent = `${depth.bits} bit per pixel: ${depth.desc}`;
}

function render() {
  drawOriginal();
  digitise();
  updateCalc();
}

// --- Bedienung --------------------------------------------------------------
el("in-res").addEventListener("input", (ev) => {
  state.resIdx = Number(ev.target.value);
  render();
});

const seg = el("seg-depth");
DEPTHS.forEach((depth, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ctrl";
  b.textContent = depth.label;
  b.setAttribute("aria-pressed", i === state.depthIdx ? "true" : "false");
  b.addEventListener("click", () => {
    state.depthIdx = i;
    seg.querySelectorAll("button").forEach((x, j) =>
      x.setAttribute("aria-pressed", j === i ? "true" : "false"));
    render();
  });
  seg.appendChild(b);
});

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (ev.key >= "1" && ev.key <= "6") {
    seg.querySelectorAll("button")[Number(ev.key) - 1].click();
  } else if (ev.key === "ArrowLeft" && state.resIdx > 0) {
    state.resIdx -= 1;
    el("in-res").value = String(state.resIdx);
    render();
  } else if (ev.key === "ArrowRight" && state.resIdx < RESOLUTIONS.length - 1) {
    state.resIdx += 1;
    el("in-res").value = String(state.resIdx);
    render();
  }
});

el("motifs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  motif = b.dataset.m;
  el("motifs").querySelectorAll("button").forEach((x) =>
    x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  render();
});

// --- Start ------------------------------------------------------------------
Promise.all(MOTIFS.map(loadMotif)).then(render);
