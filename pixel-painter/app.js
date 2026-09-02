/* pixel painter — codesysteme.
 *
 * Ein 8x8-Raster, ein Bit je Pixel: Bild und Bytes sind dieselbe
 * Information in zwei Schreibweisen. Die Demo haelt beide Richtungen
 * offen — wer malt, schreibt Bytes; wer die Hexfelder editiert, malt.
 *
 * Dazu die Stoerung: "break a byte" kippt zufaellige Bits EINES Bytes,
 * "flip one bit" genau eines. Der Schaden bleibt rot markiert, bis
 * "repair" den letzten heilen Stand zurueckholt oder von Hand
 * weitergemalt wird. Dass ein Byte-Fehler genau eine Bildzeile trifft,
 * sieht man dabei von selbst; Pruefsummen nimmt die Demo bewusst NICHT
 * vorweg, die gehoeren zu Challenge 3.
 *
 * Bewusst schwarz/weiss und ohne ASCII- oder Farbdeutung: ein Konzept
 * je Demo. Kein Framework, kein Build. */

"use strict";

const SIZE = 8;

/* Vordefinierte Bilder, je acht Bytes. Das Herz ist das Startbild,
 * damit die Byte-Spalte sofort etwas zeigt. */
const PRESETS = [
  { name: "heart",    data: [0x00, 0x66, 0xff, 0xff, 0x7e, 0x3c, 0x18, 0x00] },
  { name: "smiley",   data: [0x3c, 0x42, 0xa5, 0x81, 0xa5, 0x99, 0x42, 0x3c] },
  { name: "invader",  data: [0x18, 0x3c, 0x7e, 0xdb, 0xff, 0x24, 0x5a, 0xa5] },
  { name: "arrow",    data: [0x08, 0x0c, 0xfe, 0xff, 0xfe, 0x0c, 0x08, 0x00] },
  { name: "letter a", data: [0x18, 0x3c, 0x66, 0x66, 0x7e, 0x66, 0x66, 0x00] },
];

const bytes = new Uint8Array(PRESETS[0].data);
let snapshot = null;             // heiler Stand vor der ersten Stoerung
const damaged = new Set();       // Zellindizes (r*8+c) mit Schaden

const el = (id) => document.getElementById(id);
const bit = (r, c) => (bytes[r] >> (7 - c)) & 1;

function setBit(r, c, v) {
  if (v) bytes[r] |= 1 << (7 - c);
  else bytes[r] &= ~(1 << (7 - c));
}

// --- Aufbau -----------------------------------------------------------------
const grid = el("grid");
const cells = [];
for (let r = 0; r < SIZE; r++) {
  for (let c = 0; c < SIZE; c++) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.r = r;
    b.dataset.c = c;
    b.setAttribute("aria-label", `pixel row ${r + 1}, column ${c + 1}`);
    grid.appendChild(b);
    cells.push(b);
  }
}

const rowsEl = el("rows");
const binEls = [], hexEls = [], rowEls = [];
for (let r = 0; r < SIZE; r++) {
  const row = document.createElement("div");
  row.className = "brow";
  const bin = document.createElement("span");
  bin.className = "bin";
  const hex = document.createElement("input");
  hex.className = "hex";
  hex.maxLength = 2;
  hex.spellcheck = false;
  hex.setAttribute("aria-label", `byte ${r + 1} as hex`);
  row.appendChild(bin);
  row.appendChild(hex);
  rowsEl.appendChild(row);
  binEls.push(bin);
  hexEls.push(hex);
  rowEls.push(row);
}

/* Preset-Knoepfe: jedes Bild malt sich als Mini-Vorschau selbst. */
const presetsEl = el("presets");
PRESETS.forEach((preset) => {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", `load preset: ${preset.name}`);
  b.title = preset.name;
  const cv = document.createElement("canvas");
  cv.width = 32;
  cv.height = 32;
  const g = cv.getContext("2d");
  g.fillStyle = "#ffffff";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((preset.data[r] >> (7 - c)) & 1) g.fillRect(c * 4, r * 4, 4, 4);
    }
  }
  b.appendChild(cv);
  b.addEventListener("click", () => {
    touched();
    bytes.set(preset.data);
    render();
  });
  presetsEl.appendChild(b);
});

// --- Anzeige ----------------------------------------------------------------
function render() {
  let on = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = bit(r, c);
      on += v;
      const cell = cells[r * SIZE + c];
      cell.setAttribute("aria-pressed", v ? "true" : "false");
      cell.classList.toggle("hurt", damaged.has(r * SIZE + c));
    }
    const bin = bytes[r].toString(2).padStart(8, "0");
    binEls[r].textContent = bin.slice(0, 4) + " " + bin.slice(4);
    // Das Hexfeld nicht ueberschreiben, waehrend darin getippt wird
    if (document.activeElement !== hexEls[r]) {
      hexEls[r].value = bytes[r].toString(16).padStart(2, "0").toUpperCase();
      hexEls[r].classList.remove("invalid");
    }
    rowEls[r].classList.toggle(
      "hurtrow",
      [...damaged].some((i) => Math.floor(i / SIZE) === r),
    );
  }
  el("st-on").textContent = on;
  el("btn-repair").disabled = snapshot === null;
}

/* Jede Handaenderung macht den aktuellen Stand zum neuen Original. */
function touched() {
  snapshot = null;
  damaged.clear();
}

// --- Malen ------------------------------------------------------------------
let painting = false;
let paintVal = 1;

function applyCell(cell, v) {
  setBit(Number(cell.dataset.r), Number(cell.dataset.c), v);
  render();
}

grid.addEventListener("mousedown", (ev) => {
  const cell = ev.target.closest("button");
  if (!cell) return;
  touched();
  paintVal = bit(Number(cell.dataset.r), Number(cell.dataset.c)) ? 0 : 1;
  painting = true;
  applyCell(cell, paintVal);
});
grid.addEventListener("mouseover", (ev) => {
  if (!painting) return;
  const cell = ev.target.closest("button");
  if (cell) applyCell(cell, paintVal);
});
document.addEventListener("mouseup", () => { painting = false; });

// Fingermalerei: unter dem bewegten Finger die Zelle suchen
grid.addEventListener("touchstart", (ev) => {
  const cell = ev.target.closest("button");
  if (!cell) return;
  ev.preventDefault();
  touched();
  paintVal = bit(Number(cell.dataset.r), Number(cell.dataset.c)) ? 0 : 1;
  painting = true;
  applyCell(cell, paintVal);
});
grid.addEventListener("touchmove", (ev) => {
  if (!painting) return;
  ev.preventDefault();
  const t = ev.touches[0];
  const cell = document.elementFromPoint(t.clientX, t.clientY);
  if (cell && cell.closest && cell.closest(".pixel-grid") && cell.tagName === "BUTTON") {
    applyCell(cell, paintVal);
  }
});
document.addEventListener("touchend", () => { painting = false; });

// Tastatur: Klick ohne Maus (Leertaste/Enter) toggelt die Zelle
grid.addEventListener("click", (ev) => {
  if (ev.detail !== 0) return;   // echte Mausklicks laufen ueber mousedown
  const cell = ev.target.closest("button");
  if (!cell) return;
  touched();
  const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
  setBit(r, c, bit(r, c) ? 0 : 1);
  render();
});

// Pfeiltasten bewegen den Fokus durchs Raster
grid.addEventListener("keydown", (ev) => {
  const cell = ev.target.closest("button");
  if (!cell) return;
  let r = Number(cell.dataset.r), c = Number(cell.dataset.c);
  if (ev.key === "ArrowLeft") c -= 1;
  else if (ev.key === "ArrowRight") c += 1;
  else if (ev.key === "ArrowUp") r -= 1;
  else if (ev.key === "ArrowDown") r += 1;
  else return;
  ev.preventDefault();
  if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) cells[r * SIZE + c].focus();
});

// --- Hex-Richtung -----------------------------------------------------------
hexEls.forEach((hex, r) => {
  hex.addEventListener("input", () => {
    const v = hex.value.trim();
    if (/^[0-9a-fA-F]{2}$/.test(v)) {
      touched();
      bytes[r] = parseInt(v, 16);
      hex.classList.remove("invalid");
      render();
    } else {
      hex.classList.toggle("invalid", v.length === 2);
    }
  });
  hex.addEventListener("blur", () => render());
  hex.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") hex.blur();
  });
});

// --- Stoerung und Reparatur -------------------------------------------------
function markRow(r, before) {
  for (let c = 0; c < SIZE; c++) {
    if (((before ^ bytes[r]) >> (7 - c)) & 1) damaged.add(r * SIZE + c);
  }
}

function breakByte() {
  if (snapshot === null) snapshot = bytes.slice();
  const r = Math.floor(Math.random() * SIZE);
  const before = bytes[r];
  bytes[r] ^= 1 + Math.floor(Math.random() * 255);
  markRow(r, before);
  render();
}

function flipBit() {
  if (snapshot === null) snapshot = bytes.slice();
  const r = Math.floor(Math.random() * SIZE);
  const before = bytes[r];
  bytes[r] ^= 1 << Math.floor(Math.random() * SIZE);
  markRow(r, before);
  render();
}

function repair() {
  if (snapshot === null) return;
  bytes.set(snapshot);
  snapshot = null;
  damaged.clear();
  render();
}

function invert() {
  touched();
  for (let r = 0; r < SIZE; r++) bytes[r] ^= 0xff;
  render();
}

function clearAll() {
  touched();
  bytes.fill(0);
  render();
}

el("btn-break").addEventListener("click", breakByte);
el("btn-bit").addEventListener("click", flipBit);
el("btn-repair").addEventListener("click", repair);
el("btn-invert").addEventListener("click", invert);
el("btn-clear").addEventListener("click", clearAll);

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;             // Hexfelder behalten ihre Tasten
  if (ev.key === "b") breakByte();
  else if (ev.key === "f") flipBit();
  else if (ev.key === "r") repair();
  else if (ev.key === "i") invert();
});

// --- Start ------------------------------------------------------------------
render();
