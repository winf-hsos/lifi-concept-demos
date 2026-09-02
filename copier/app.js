/* the copier — analog und digital.
 *
 * Eine Kopienwand: Jeder Druck auf "copy" fotokopiert das letzte Bild
 * an der Wand, mitsamt allem Rauschen, das schon drin steckt, plus dem
 * eigenen Rauschen dieser Kopie. Die ganze Historie bleibt sichtbar
 * und schrumpft, damit sie aufs Blatt passt — so sieht man das
 * Original Generation um Generation verschwinden.
 *
 * Die Kopiersorgfalt gibt es bewusst OHNE Technikvokabular in drei
 * Worten (carefully / normally / sloppily); dahinter steckt schlicht
 * die Rauschstaerke je Kopie.
 *
 * Der Kontrastknopf "and as a file?" haengt EIN blaues Bild an die
 * Wand: die Dateikopie nach derselben Zahl von Kopiervorgaengen,
 * identisch mit dem Original, denn eine digitale Kopie wird bei jedem
 * Schritt aus sauberen Zustaenden neu geboren. Mehr Digital-Mechanik
 * (Aufloesung, Farbtiefe, Dateigroesse) zeigt der Digitalisierer.
 *
 * Kein Framework, kein Build; das Bild ist prozedural gezeichnet. */

"use strict";

const SIZE = 128;
const N = SIZE * SIZE;
const NOISE = { careful: 5, normal: 12, sloppy: 28 };
const MAX_COPIES = 40;

let quality = "normal";
let showFile = false;

const el = (id) => document.getElementById(id);

function gaussian() {              // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (x) => Math.max(0, Math.min(255, x));

// --- Das Original: eine kleine Nachtszene, prozedural ------------------------
function drawOriginal() {
  const img = new Float64Array(N);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let v = 20 + (y / SIZE) * 55;
      const dm = Math.hypot(x - 92, y - 30);
      if (dm < 16) v = 235;
      else if (dm < 20) v = 235 - (dm - 16) / 4 * 170;
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
let gens = [];                    // die Bilder an der Wand, Index = Generation

// --- Die Wand ---------------------------------------------------------------
const gallery = el("gallery");

function paint(canvas, data) {
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < N; i++) {
    img.data[i * 4] = data[i];
    img.data[i * 4 + 1] = data[i];
    img.data[i * 4 + 2] = data[i];
    img.data[i * 4 + 3] = 255;
  }
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
               n <= 24 ? 92 : 70;
  gallery.style.setProperty("--s", size + "px");
}

// --- Aktionen ---------------------------------------------------------------
function renderFileCard() {
  const old = gallery.querySelector(".gitem.file");
  if (old) old.remove();
  if (!showFile) return;
  const copies = gens.length - 1;
  const item = addItem(orig, `file copy ${copies}`, "file");
  item.querySelector("canvas").title =
    "a digital copy is re-read from clean states: identical to the original";
}

function copyOnce() {
  if (gens.length - 1 >= MAX_COPIES) return;
  const sigma = NOISE[quality];
  const last = gens[gens.length - 1];
  const next = new Float64Array(N);
  for (let i = 0; i < N; i++) next[i] = clamp(last[i] + gaussian() * sigma);
  gens.push(next);
  const copies = gens.length - 1;
  addItem(next, `copy ${copies}`);
  renderFileCard();               // ans Ende ruecken und Zaehler mitziehen
  fitWall();
  el("btn-copy").disabled = copies >= MAX_COPIES;
}

function reset() {
  gens = [orig];
  showFile = false;
  gallery.innerHTML = "";
  addItem(orig, "original", "first");
  fitWall();
  el("btn-copy").disabled = false;
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

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (tag === "BUTTON") document.activeElement.blur();
  if (ev.key === "c") copyOnce();
  else if (ev.key === "f") el("btn-file").click();
  else if (ev.key === "r") reset();
});

// --- Start ------------------------------------------------------------------
reset();
