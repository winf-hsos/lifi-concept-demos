/* the photo digitiser — analog und digital.
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
 * Wer ein Pixel des digitalen Bildes ueberfaehrt, sieht seinen Wert im
 * gewaehlten System: die Bits, nach Kanaelen gruppiert, und daneben die
 * Zahlen. Die Zelle wird auf beiden Bildern umrandet, damit man sieht,
 * welcher Fleck des Originals zu diesem einen Wert geworden ist.
 *
 * Kein Framework, kein Build. */

"use strict";

// Embed-Modus fuer Folien: ?embed=1 blendet Kopf, Titel, Tastenhinweise, Fuss und Merksatz aus (assets/style.css)
if (new URLSearchParams(location.search).has("embed")) document.body.classList.add("embed");

const FULL = 256;
const RESOLUTIONS = [1, 2, 4, 8, 16, 32, 64, 128, 256];
const DEPTHS = [
  { key: "bw",    label: "b/w",       bits: 1,
    desc: "2 colours — fax machines, e-paper price tags" },
  { key: "grey2", label: "4 greys",   bits: 2,
    desc: "4 shades of grey — the original game boy display" },
  { key: "c4",    label: "4-bit",     bits: 4,
    desc: "16 colours — the ega palette, early windows" },
  { key: "grey",  label: "greyscale", bits: 8,
    desc: "256 shades of grey — scanners, x-ray images" },
  { key: "c8",    label: "8-bit",     bits: 8,
    desc: "256 colours (3+3+2) — the gif and vga era" },
  { key: "c16",   label: "16-bit",    bits: 16,
    desc: "65,536 colours (5+6+5) — 1990s desktops, gadget displays" },
  { key: "c24",   label: "24-bit",    bits: 24,
    desc: "16.7 million colours (8+8+8) — today's standard" },
];
// Die sechzehn Farben der EGA-Palette: acht Grundfarben, jede einmal dunkel
// und einmal hell. Bei 4 bit wird jeder Punkt der naechstliegenden zugeordnet.
const EGA = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170],
  [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255],
  [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];

function naechsteEga(r, g, b) {
  let best = EGA[0], bestAbstand = Infinity;
  for (const farbe of EGA) {
    const abstand = (r - farbe[0]) ** 2 + (g - farbe[1]) ** 2 + (b - farbe[2]) ** 2;
    if (abstand < bestAbstand) { bestAbstand = abstand; best = farbe; }
  }
  return best;
}

const LINK_BPS = 30;               // mittlere Challenge-Groessenordnung

const state = { resIdx: 5, depthIdx: 6 };
const el = (id) => document.getElementById(id);

/* Startfall aus der Adresse: ?picture=parrot&res=16&depth=c24
 * So zeigt eine Folie genau den einen Fall, um den es dort geht. */
const query = new URLSearchParams(location.search);
const wunschRes = RESOLUTIONS.indexOf(Number(query.get("res")));
if (wunschRes >= 0) state.resIdx = wunschRes;
const wunschDepth = DEPTHS.findIndex((d) => d.key === query.get("depth"));
if (wunschDepth >= 0) state.depthIdx = wunschDepth;

// --- Fotomotive --------------------------------------------------------------
const MOTIFS = ["parrot", "sunset", "lighthouse"];
let motif = MOTIFS.includes(query.get("picture")) ? query.get("picture") : "parrot";
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

let digital = null;   // die quantisierten Pixel des aktuellen Bildes (ImageData)

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
    } else if (depth.key === "c4") {
      const nah = naechsteEga(d[i], d[i + 1], d[i + 2]);
      d[i] = nah[0]; d[i + 1] = nah[1]; d[i + 2] = nah[2];
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
  digital = img;
  // Anzeige: pixelig hochskaliert
  const out = el("cv-dig");
  out.width = res;
  out.height = res;
  out.getContext("2d").drawImage(small, 0, 0);
}

// --- Der Wert eines Pixels ---------------------------------------------------
/* Ein Pixel steht im Speicher als Bits, und wie viele und welche, sagt das
 * gewaehlte System. Die Funktion liefert die Kanaele als [name, wert, bits],
 * aus denen der Anzeigetext gebaut wird; dieselbe Rundung wie in digitise(). */
const bin = (v, bits) => v.toString(2).padStart(bits, "0");
const stufe = (v, bits) => Math.round(v / 255 * ((1 << bits) - 1));

function pixelWert(r, g, b) {
  const depth = DEPTHS[state.depthIdx];
  const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  switch (depth.key) {
    case "bw":    return [["", r === 255 ? 1 : 0, 1]];
    case "grey2": return [["grey", Math.round(lum / 255 * 3), 2]];
    case "c4":    return [["colour no.", EGA.findIndex((f) => f[0] === r && f[1] === g && f[2] === b), 4]];
    case "grey":  return [["grey", lum, 8]];
    case "c8":    return [["r", stufe(r, 3), 3], ["g", stufe(g, 3), 3], ["b", stufe(b, 2), 2]];
    case "c16":   return [["r", stufe(r, 5), 5], ["g", stufe(g, 6), 6], ["b", stufe(b, 5), 5]];
    default:      return [["r", r, 8], ["g", g, 8], ["b", b, 8]];
  }
}

function zeigePixel(x, y) {
  const res = RESOLUTIONS[state.resIdx];
  const out = el("rd-pixel");
  const zellen = [el("cell-orig"), el("cell-dig")];
  if (x === null || !digital) {
    out.innerHTML = `<span class="dim">hover a pixel to see its ${DEPTHS[state.depthIdx].bits} bits</span>`;
    zellen.forEach((z) => z.classList.remove("on"));
    return;
  }
  const i = (y * res + x) * 4;
  const d = digital.data;
  const kanaele = pixelWert(d[i], d[i + 1], d[i + 2]);
  const bits = kanaele.map(([, v, n]) => bin(v, n)).join(" ");
  const zahlen = kanaele.map(([name, v]) => (name ? `${name} ${v}` : `${v}`)).join(", ");
  out.innerHTML = `<span class="dim">pixel (${x}, ${y}):</span> <span class="bits">${bits}</span><br>` +
                  `<span class="dim">= ${zahlen}</span>`;
  // Rahmen ueber der Zelle, auf beiden Bildern; die Groesse kommt aus der
  // dargestellten Breite des Canvas, nicht aus seinen Pixeln
  zellen.forEach((z) => {
    const cv = z.previousElementSibling;
    const groesse = cv.getBoundingClientRect().width / res;
    z.style.width = z.style.height = `${groesse}px`;
    z.style.left = `${x * groesse}px`;
    z.style.top = `${y * groesse}px`;
    z.classList.add("on");
  });
}

function pixelUnter(ev, id) {
  const cv = el(id);
  const rect = cv.getBoundingClientRect();
  const res = RESOLUTIONS[state.resIdx];
  const x = Math.floor((ev.clientX - rect.left) / rect.width * res);
  const y = Math.floor((ev.clientY - rect.top) / rect.height * res);
  if (x < 0 || y < 0 || x >= res || y >= res) return null;
  return [x, y];
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
  zeigePixel(null);
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
  if (ev.key >= "1" && ev.key <= "7") {
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

for (const id of ["cv-dig", "cv-orig"]) {
  el(id).addEventListener("pointermove", (ev) => {
    const p = pixelUnter(ev, id);
    p ? zeigePixel(p[0], p[1]) : zeigePixel(null);
  });
  el(id).addEventListener("pointerleave", () => zeigePixel(null));
}

el("motifs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  motif = b.dataset.m;
  el("motifs").querySelectorAll("button").forEach((x) =>
    x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  render();
});

// --- Start ------------------------------------------------------------------
function bedienelementeSetzen() {
  el("in-res").value = String(state.resIdx);
  const knoepfe = el("seg-depth").querySelectorAll("button");
  knoepfe.forEach((b, i) => b.setAttribute("aria-pressed", i === state.depthIdx ? "true" : "false"));
  el("motifs").querySelectorAll("button").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.m === motif ? "true" : "false"));
}

Promise.all(MOTIFS.map(loadMotif)).then(() => { bedienelementeSetzen(); render(); });
