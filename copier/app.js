/* the copier — analog und digital.
 *
 * Eine Kopienwand: Jeder Druck auf "copy" fotokopiert das letzte Bild
 * an der Wand, mitsamt allem Rauschen, das schon drin steckt, plus dem
 * eigenen Rauschen dieser Kopie. Die ganze Historie bleibt sichtbar
 * und schrumpft, damit sie aufs Blatt passt — so sieht man das
 * Original Generation um Generation verschwinden. Es gibt KEINE
 * Obergrenze: Wer will, kopiert, bis nur noch Griess uebrig ist.
 *
 * Ausgangsbild ist eines von drei Fotomotiven (KI-generiert, geteilt
 * mit dem Digitiser als Bruecke zwischen beiden Demos). Die
 * Kopiersorgfalt gibt es bewusst OHNE Technikvokabular in drei Worten
 * (carefully / normally / sloppily); dahinter steckt schlicht die
 * Rauschstaerke je Kopie und Farbkanal.
 *
 * Der Kontrastknopf "and as a file?" haengt EIN blaues Bild an die
 * Wand: die Dateikopie nach derselben Zahl von Kopiervorgaengen,
 * identisch mit dem Original, denn eine digitale Kopie wird bei jedem
 * Schritt aus sauberen Zustaenden neu geboren.
 *
 * Kein Framework, kein Build. */

"use strict";

const SIZE = 128;
const N = SIZE * SIZE * 4;         // RGBA
const NOISE = { careful: 5, normal: 12, sloppy: 28 };
const MOTIFS = ["parrot", "sunset", "lighthouse"];

let quality = "normal";
let motif = "parrot";
let showFile = false;

const el = (id) => document.getElementById(id);

function gaussian() {              // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// --- Fotomotive laden --------------------------------------------------------
const originals = {};              // Name -> Uint8ClampedArray (128x128 RGBA)

function loadMotif(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = SIZE;
      cv.height = SIZE;
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      originals[name] = ctx.getImageData(0, 0, SIZE, SIZE).data;
      resolve();
    };
    img.src = `../assets/photos/${name}.png`;
  });
}

let gens = [];                    // die Bilder an der Wand, Index = Generation

// --- Die Wand ---------------------------------------------------------------
const gallery = el("gallery");

function paint(canvas, data) {
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(SIZE, SIZE);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
}

function addItem(data, label, extraClass) {
  const item = document.createElement("div");
  item.className = "gitem" + (extraClass ? " " + extraClass : "");
  const cv = document.createElement("canvas");
  cv.width = SIZE;
  cv.height = SIZE;
  paint(cv, data);
  const lbl = document.createElement("div");
  lbl.className = "glabel";
  lbl.textContent = label;
  item.appendChild(cv);
  item.appendChild(lbl);
  gallery.appendChild(item);
  return item;
}

/* Je voller die Wand, desto kleiner die Bilder, damit alles draufpasst. */
function fitWall() {
  const n = gallery.children.length;
  const size = n <= 3 ? 220 : n <= 6 ? 160 : n <= 12 ? 120 :
               n <= 24 ? 92 : n <= 48 ? 70 : n <= 96 ? 54 : 40;
  gallery.style.setProperty("--s", size + "px");
}

// --- Aktionen ---------------------------------------------------------------
function renderFileCard() {
  const old = gallery.querySelector(".gitem.file");
  if (old) old.remove();
  if (!showFile) return;
  const copies = gens.length - 1;
  const item = addItem(originals[motif], `file copy ${copies}`, "file");
  item.querySelector("canvas").title =
    "a digital copy is re-read from clean states: identical to the original";
}

function copyOnce() {
  const sigma = NOISE[quality];
  const last = gens[gens.length - 1];
  const next = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i += 4) {
    next[i] = last[i] + gaussian() * sigma;         // Uint8Clamped rundet
    next[i + 1] = last[i + 1] + gaussian() * sigma; // und begrenzt selbst
    next[i + 2] = last[i + 2] + gaussian() * sigma;
    next[i + 3] = 255;
  }
  gens.push(next);
  addItem(next, `copy ${gens.length - 1}`);
  renderFileCard();               // ans Ende ruecken und Zaehler mitziehen
  fitWall();
}

function reset() {
  gens = [originals[motif]];
  showFile = false;
  gallery.innerHTML = "";
  addItem(originals[motif], "original", "first");
  fitWall();
}

el("btn-copy").addEventListener("click", copyOnce);
el("btn-file").addEventListener("click", () => {
  showFile = !showFile;
  renderFileCard();
  fitWall();
});
el("btn-reset").addEventListener("click", reset);

el("seg").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  quality = b.dataset.q;
  el("seg").querySelectorAll("button").forEach((x) =>
    x.setAttribute("aria-pressed", x === b ? "true" : "false"));
});

el("motifs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  motif = b.dataset.m;
  el("motifs").querySelectorAll("button").forEach((x) =>
    x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  reset();
});

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (tag === "BUTTON") document.activeElement.blur();
  if (ev.key === "c") copyOnce();
  else if (ev.key === "f") el("btn-file").click();
  else if (ev.key === "r") reset();
});

// --- Start ------------------------------------------------------------------
Promise.all(MOTIFS.map(loadMotif)).then(reset);
