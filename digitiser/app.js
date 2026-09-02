/* the digitiser — analog und digital.
 *
 * Links eine "analoge" Szene (prozedural, mit weichen Verlaeufen als
 * Stellvertreter fuer endloses Detail), rechts ihre Digitalisierung.
 * Zwei Entscheidungen, beide mit Preisschild:
 *
 *   Aufloesung:  wie viele Bildpunkte? (256er-Raster bis 8x8)
 *   Farbtiefe:   wie viele Farben je Punkt? 1 bit s/w, 8 bit grau,
 *                8/16/24 bit Farbe.
 *
 * Darunter steht die Rechnung offen ausgeschrieben: Pixel mal Bits je
 * Pixel gleich Dateigroesse, und daneben, wie lange dieses Bild ueber
 * die eigene Lichtstrecke braeuchte (30 bit/s als mittlere Challenge-
 * Groessenordnung). Das verankert Dateigroessen im Projekt.
 *
 * Kein Framework, kein Build; die Szene ist prozedural gezeichnet. */

"use strict";

const FULL = 256;
const RESOLUTIONS = [8, 16, 32, 64, 128, 256];
const DEPTHS = [
  { key: "bw",   label: "b/w",        bits: 1,  desc: "2 colours: black or white" },
  { key: "grey", label: "greyscale",  bits: 8,  desc: "256 shades of grey" },
  { key: "c8",   label: "8-bit",      bits: 8,  desc: "256 colours (3+3+2 bits)" },
  { key: "c16",  label: "16-bit",     bits: 16, desc: "65,536 colours (5+6+5 bits)" },
  { key: "c24",  label: "24-bit",     bits: 24, desc: "16.7 million colours (8+8+8 bits)" },
];
const LINK_BPS = 30;               // mittlere Challenge-Groessenordnung

const state = { resIdx: 2, depthIdx: 4 };
const el = (id) => document.getElementById(id);

// --- Die analoge Szene: ein Sonnenuntergang, prozedural ----------------------
const origCv = el("cv-orig");
function drawScene(ctx) {
  // Himmel
  const sky = ctx.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, "#251942");
  sky.addColorStop(0.55, "#b3452c");
  sky.addColorStop(1, "#f2a541");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FULL, 160);
  // Sonne mit weichem Rand
  const sun = ctx.createRadialGradient(170, 132, 4, 170, 132, 34);
  sun.addColorStop(0, "#ffe89b");
  sun.addColorStop(0.6, "#ffd23f");
  sun.addColorStop(1, "rgba(255, 210, 63, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(120, 82, 100, 100);
  // Meer mit Lichtspur
  const sea = ctx.createLinearGradient(0, 160, 0, FULL);
  sea.addColorStop(0, "#d97c3a");
  sea.addColorStop(0.25, "#5a4a7a");
  sea.addColorStop(1, "#131a33");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 160, FULL, FULL - 160);
  for (let y = 162; y < 220; y += 5) {
    const w = 60 - (y - 162);
    if (w <= 4) break;
    ctx.fillStyle = "rgba(255, 214, 120, " + (0.35 - (y - 162) * 0.005) + ")";
    ctx.fillRect(170 - w / 2, y, w, 2);
  }
  // Huegelsilhouette vorn
  ctx.fillStyle = "#0a0f1e";
  ctx.beginPath();
  ctx.moveTo(0, FULL);
  for (let x = 0; x <= FULL; x++) {
    ctx.lineTo(x, 226 - 14 * Math.sin(x / 34) - 6 * Math.sin(x / 11));
  }
  ctx.lineTo(FULL, FULL);
  ctx.closePath();
  ctx.fill();
}
drawScene(origCv.getContext("2d"));

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
  sctx.drawImage(origCv, 0, 0, res, res);
  const img = sctx.getImageData(0, 0, res, res);
  const d = img.data;
  // Quantisieren: jeden Kanal auf die vereinbarten Stufen runden
  for (let i = 0; i < d.length; i += 4) {
    if (depth.key === "bw") {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = lum >= 118 ? 255 : 0;
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
  if (ev.key >= "1" && ev.key <= "5") {
    seg.querySelectorAll("button")[Number(ev.key) - 1].click();
  } else if (ev.key === "ArrowLeft" && state.resIdx > 0) {
    state.resIdx -= 1;
    el("in-res").value = String(state.resIdx);
    render();
  } else if (ev.key === "ArrowRight" && state.resIdx < 5) {
    state.resIdx += 1;
    el("in-res").value = String(state.resIdx);
    render();
  }
});

// --- Start ------------------------------------------------------------------
render();
