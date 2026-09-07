/* inside a file — Dateien.
 *
 * Eines der drei Fotomotive wird auf 8x8, 16x16 oder 32x32 Pixel verkleinert
 * und als echte 24-Bit-Bitmap kodiert (Dateikopf 14 Bytes, Infokopf 40
 * Bytes, Pixel in Blau-Gruen-Rot, unterste Zeile zuerst, Zeilen auf vier
 * Bytes aufgefuellt). Rechts steht die Datei als Hex-Editor, links das, was
 * ein Bildbetrachter aus genau diesen Bytes macht: Der Dekoder liest den
 * Kopf wirklich (Kennung, Offset, Breite, Hoehe, Farbtiefe) und verhaelt
 * sich wie ein Betrachter, also verweigert er bei kaputtem Kopf und zeigt
 * bei falscher Breite Streifen. Jedes Byte ist editierbar; die Aenderung
 * wirkt sofort auf das Bild.
 *
 * Kein Framework, kein Build. */

"use strict";

const el = (id) => document.getElementById(id);
const hex2 = (v) => v.toString(16).padStart(2, "0");

const FIELDS = [
  [0, 2, "signature", (b) => String.fromCharCode(b[0], b[1]) + (b[0] === 0x42 && b[1] === 0x4d ? " (bitmap)" : " (not a bitmap!)")],
  [2, 6, "file size", (b) => u32(b, 2) + " bytes"],
  [6, 10, "reserved", () => "unused"],
  [10, 14, "pixel data starts at byte", (b) => String(u32(b, 10))],
  [14, 18, "info header size", (b) => u32(b, 14) + " bytes"],
  [18, 22, "width", (b) => i32(b, 18) + " pixels"],
  [22, 26, "height", (b) => i32(b, 22) + " pixels" + (i32(b, 22) < 0 ? " (negative: top row first)" : " (bottom row first)")],
  [26, 28, "colour planes", (b) => String(u16(b, 26))],
  [28, 30, "bits per pixel", (b) => String(u16(b, 28))],
  [30, 34, "compression", (b) => u32(b, 30) === 0 ? "0 (none)" : String(u32(b, 30))],
  [34, 38, "pixel data size", (b) => u32(b, 34) + " bytes"],
  [38, 42, "pixels per metre, x", (b) => String(i32(b, 38))],
  [42, 46, "pixels per metre, y", (b) => String(i32(b, 42))],
  [46, 50, "colours in palette", (b) => u32(b, 46) === 0 ? "0 (no palette)" : String(u32(b, 46))],
  [50, 54, "important colours", (b) => String(u32(b, 50))],
];

function u16(b, i) { return b[i] | (b[i + 1] << 8); }
function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }
function i32(b, i) { return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24); }
function put32(b, i, v) { b[i] = v & 255; b[i + 1] = (v >> 8) & 255; b[i + 2] = (v >> 16) & 255; b[i + 3] = (v >>> 24) & 255; }
function put16(b, i, v) { b[i] = v & 255; b[i + 1] = (v >> 8) & 255; }

// --- Bitmap schreiben ---------------------------------------------------
function encodeBmp(rgba, w, h) {
  const stride = ((w * 3 + 3) >> 2) << 2;
  const dataSize = stride * h;
  const b = new Uint8Array(54 + dataSize);
  b[0] = 0x42; b[1] = 0x4d;
  put32(b, 2, b.length);
  put32(b, 10, 54);
  put32(b, 14, 40);
  put32(b, 18, w);
  put32(b, 22, h);
  put16(b, 26, 1);
  put16(b, 28, 24);
  put32(b, 30, 0);
  put32(b, 34, dataSize);
  put32(b, 38, 3780);            // 96 dpi, wie ein normales Programm es schreibt
  put32(b, 42, 3780);
  for (let y = 0; y < h; y++) {
    const row = 54 + stride * (h - 1 - y);          // unterste Zeile zuerst
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      b[row + x * 3] = rgba[p + 2];                  // blau
      b[row + x * 3 + 1] = rgba[p + 1];              // gruen
      b[row + x * 3 + 2] = rgba[p];                  // rot
    }
  }
  return b;
}

// --- Bitmap lesen, wie ein Betrachter -----------------------------------
function decodeBmp(b) {
  if (b.length < 54) return { error: "file too short for a bitmap header" };
  if (b[0] !== 0x42 || b[1] !== 0x4d) return { error: "the viewer refuses: the first two bytes are not \"BM\", so this is not a bitmap" };
  const offset = u32(b, 10);
  const w = i32(b, 18);
  const hRaw = i32(b, 22);
  const bpp = u16(b, 28);
  const comp = u32(b, 30);
  if (bpp !== 24) return { error: `the viewer refuses: ${bpp} bits per pixel, it only knows 24` };
  if (comp !== 0) return { error: `the viewer refuses: compression ${comp} is unknown` };
  if (w <= 0 || w > 4096) return { error: `the viewer refuses: width ${w} makes no sense` };
  const h = Math.abs(hRaw);
  if (h === 0 || h > 4096) return { error: `the viewer refuses: height ${hRaw} makes no sense` };
  if (offset >= b.length) return { error: `the viewer refuses: pixel data would start at byte ${offset}, beyond the end of the file` };
  const stride = ((w * 3 + 3) >> 2) << 2;
  const topDown = hRaw < 0;
  const img = new Uint8ClampedArray(w * h * 4);
  const map = new Int32Array(w * h);                // Pixel -> erstes Byte
  for (let y = 0; y < h; y++) {
    const fileRow = topDown ? y : h - 1 - y;
    const row = offset + stride * fileRow;
    for (let x = 0; x < w; x++) {
      const i = row + x * 3;
      const p = (y * w + x) * 4;
      map[y * w + x] = i;
      img[p] = i + 2 < b.length ? b[i + 2] : 0;
      img[p + 1] = i + 1 < b.length ? b[i + 1] : 0;
      img[p + 2] = i < b.length ? b[i] : 0;
      img[p + 3] = 255;
    }
  }
  return { w, h, img, map, offset, stride, topDown };
}

// --- Zustand ---------------------------------------------------------------
const state = { motif: "parrot", res: 16, bytes: null, original: null, decoded: null,
                selected: -1, pending: null, textOpen: false };
const photos = {};
// Die Fotos sind fuer Folien auf schwarzem Grund erzeugt und im Ganzen
// dunkel; fuer eine winzige Bitmap wird je Motiv ein heller,
// kontrastreicher Ausschnitt genommen (x, y, Kantenlaenge im 256er-Bild).
const CROP = { parrot: [40, 32, 128], sunset: [80, 48, 128], lighthouse: [0, 40, 128] };
const cv = el("cv");
const ctx = cv.getContext("2d");

function loadMotif(name) {
  return new Promise((resolve) => {
    if (photos[name]) { resolve(photos[name]); return; }
    const im = new Image();
    im.onload = () => { photos[name] = im; resolve(im); };
    im.src = `../assets/photos/${name}.png`;
  });
}

async function buildFile() {
  const im = await loadMotif(state.motif);
  const n = state.res;
  const off = document.createElement("canvas");
  off.width = n; off.height = n;
  const c = off.getContext("2d");
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  const [cx, cy, cs] = CROP[state.motif];
  c.drawImage(im, cx, cy, cs, cs, 0, 0, n, n);
  const rgba = c.getImageData(0, 0, n, n).data;
  state.original = encodeBmp(rgba, n, n);
  state.bytes = new Uint8Array(state.original);
  state.selected = -1;
  state.pending = null;
  renderHex();
  refresh();
}

// --- Hex-Ansicht -----------------------------------------------------------
function byteClass(i) {
  if (i < 14) return "hdr";
  if (i < 54) return "inf";
  return "pix";
}

function fieldAt(i) {
  return FIELDS.find(([a, b]) => i >= a && i < b);
}

function renderHex() {
  const b = state.bytes;
  const host = el("hex");
  host.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (let r = 0; r < b.length; r += 16) {
    const row = document.createElement("div");
    row.className = "row";
    const off = document.createElement("span");
    off.className = "off";
    off.textContent = r.toString(16).padStart(4, "0");
    row.appendChild(off);
    for (let i = r; i < Math.min(r + 16, b.length); i++) {
      const s = document.createElement("span");
      s.className = "b " + byteClass(i) + (fieldAt(i) ? " field" : "");
      s.dataset.i = i;
      s.tabIndex = -1;
      s.textContent = hex2(b[i]);
      row.appendChild(s);
    }
    frag.appendChild(row);
  }
  host.appendChild(frag);
}

function cell(i) { return el("hex").querySelector(`.b[data-i="${i}"]`); }

function updateCell(i) {
  const s = cell(i);
  if (!s) return;
  s.textContent = hex2(state.bytes[i]);
  s.classList.toggle("edited", state.bytes[i] !== state.original[i]);
}

function markPadding() {
  const d = state.decoded;
  el("hex").querySelectorAll(".b.pad").forEach((s) => s.classList.remove("pad"));
  if (!d || d.error) return;
  const used = d.w * 3;
  if (used === d.stride) return;
  for (let row = 0; row < d.h; row++) {
    for (let i = d.offset + row * d.stride + used; i < d.offset + (row + 1) * d.stride; i++) {
      const s = cell(i);
      if (s) s.classList.add("pad");
    }
  }
}

// --- Bild ------------------------------------------------------------------
function refresh() {
  state.decoded = decodeBmp(state.bytes);
  const d = state.decoded;
  const refuse = el("refuse");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (d.error) {
    refuse.textContent = d.error;
    refuse.hidden = false;
  } else {
    refuse.hidden = true;
    const off = document.createElement("canvas");
    off.width = d.w; off.height = d.h;
    off.getContext("2d").putImageData(new ImageData(d.img, d.w, d.h), 0, 0);
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
    drawPixelOutline();
  }
  markPadding();
  const b = state.bytes;
  const pixBytes = b.length - 54;
  el("stats").textContent = `${b.length} bytes = 14 file header + 40 info header + ${pixBytes} pixel data` +
    (d.error ? "" : ` (${d.w} × ${d.h} pixels × 3 bytes)`);
  if (state.textOpen) renderText();
}

function drawPixelOutline() {
  const d = state.decoded;
  if (!d || d.error || state.selected < d.offset) return;
  const p = pixelOfByte(state.selected);
  if (p < 0) return;
  const x = p % d.w, y = Math.floor(p / d.w);
  const sx = cv.width / d.w, sy = cv.height / d.h;
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = 2;
  ctx.strokeRect(x * sx + 1, y * sy + 1, sx - 2, sy - 2);
}

function pixelOfByte(i) {
  const d = state.decoded;
  if (!d || d.error) return -1;
  for (let p = 0; p < d.map.length; p++) {
    if (i >= d.map[p] && i < d.map[p] + 3) return p;
  }
  return -1;
}

// --- Auswahl und Hervorhebung ---------------------------------------------
function highlightPixel(p) {
  el("hex").querySelectorAll(".b.hl").forEach((s) => s.classList.remove("hl"));
  const d = state.decoded;
  if (p < 0 || !d || d.error) return;
  const i0 = d.map[p];
  for (let k = 0; k < 3; k++) { const s = cell(i0 + k); if (s) s.classList.add("hl"); }
  const s = cell(i0);
  if (s) s.scrollIntoView({ block: "nearest" });
  const b = state.bytes;
  const x = p % d.w, y = Math.floor(p / d.w);
  el("pixinfo").textContent = `pixel (${x}, ${y}) = bytes ${i0}–${i0 + 2}: blue ${hex2(b[i0] || 0)}, green ${hex2(b[i0 + 1] || 0)}, red ${hex2(b[i0 + 2] || 0)}`;
}

function select(i) {
  if (state.selected >= 0) { const s = cell(state.selected); if (s) s.classList.remove("sel"); }
  state.selected = i;
  state.pending = null;
  const s = cell(i);
  if (s) { s.classList.add("sel"); s.scrollIntoView({ block: "nearest" }); }
  describe(i);
  const p = pixelOfByte(i);
  highlightPixel(p);
  refresh();
}

function describe(i) {
  const b = state.bytes;
  const f = fieldAt(i);
  const info = el("info");
  if (f) {
    const [a, z, name, fmt] = f;
    info.innerHTML = `byte ${i}: <span class="k">${name}</span> (bytes ${a}–${z - 1}) = ${fmt(b)}`;
  } else if (i >= 54) {
    const p = pixelOfByte(i);
    const d = state.decoded;
    if (p >= 0 && d && !d.error) {
      const ch = ["blue", "green", "red"][i - d.map[p]];
      info.innerHTML = `byte ${i}: <span class="k">${ch}</span> of pixel (${p % d.w}, ${Math.floor(p / d.w)}) = ${b[i]}`;
    } else {
      info.innerHTML = `byte ${i}: padding or unused = ${b[i]}`;
    }
  } else {
    info.textContent = `byte ${i} = ${b[i]}`;
  }
}

function setByte(i, v) {
  state.bytes[i] = v & 255;
  updateCell(i);
  refresh();
  describe(i);
  const p = pixelOfByte(i);
  highlightPixel(p);
}

// --- Text-Ansicht ------------------------------------------------------------
function renderText() {
  const b = state.bytes;
  let s = "";
  for (let i = 0; i < b.length; i++) {
    const v = b[i];
    s += (v >= 32 && v < 127) ? String.fromCharCode(v) : (v >= 160 ? String.fromCharCode(v) : "·");
  }
  el("textview").textContent = "the same bytes, read as characters:\n" + s;
}

// --- Ereignisse ------------------------------------------------------------
el("hex").addEventListener("click", (ev) => {
  const s = ev.target.closest(".b");
  if (!s) return;
  select(Number(s.dataset.i));
  el("hex").focus();
});
el("hex").addEventListener("mouseover", (ev) => {
  const s = ev.target.closest(".b");
  if (s) describe(Number(s.dataset.i));
});
el("hex").addEventListener("keydown", (ev) => {
  const i = state.selected;
  if (i < 0) return;
  const n = state.bytes.length;
  const k = ev.key;
  if (k === "ArrowRight") { select(Math.min(n - 1, i + 1)); ev.preventDefault(); return; }
  if (k === "ArrowLeft") { select(Math.max(0, i - 1)); ev.preventDefault(); return; }
  if (k === "ArrowDown") { select(Math.min(n - 1, i + 16)); ev.preventDefault(); return; }
  if (k === "ArrowUp") { select(Math.max(0, i - 16)); ev.preventDefault(); return; }
  if (k === "+" || k === "=") { setByte(i, state.bytes[i] + 1); ev.preventDefault(); return; }
  if (k === "-") { setByte(i, state.bytes[i] - 1); ev.preventDefault(); return; }
  if (/^[0-9a-fA-F]$/.test(k)) {
    const d = parseInt(k, 16);
    if (state.pending === null) {
      state.pending = d;
      setByte(i, d);                       // erste Ziffer: Wert wird 0x0d
    } else {
      setByte(i, (state.pending << 4) | d); // zweite Ziffer: fertig, weiter
      state.pending = null;
      select(Math.min(n - 1, i + 1));
    }
    ev.preventDefault();
  }
});

function pixelAt(ev) {
  const d = state.decoded;
  if (!d || d.error) return -1;
  const r = cv.getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left) / r.width * d.w);
  const y = Math.floor((ev.clientY - r.top) / r.height * d.h);
  if (x < 0 || y < 0 || x >= d.w || y >= d.h) return -1;
  return y * d.w + x;
}
cv.addEventListener("mousemove", (ev) => { const p = pixelAt(ev); if (p >= 0) highlightPixel(p); });
cv.addEventListener("click", (ev) => {
  const p = pixelAt(ev);
  if (p < 0) return;
  select(state.decoded.map[p]);
  el("hex").focus();
});

el("motifs").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn) return;
  state.motif = btn.dataset.m;
  el("motifs").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  buildFile();
});
el("seg-res").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn) return;
  state.res = Number(btn.dataset.r);
  el("seg-res").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  buildFile();
});
el("btn-reset").addEventListener("click", () => {
  state.bytes = new Uint8Array(state.original);
  renderHex();
  state.selected = -1;
  refresh();
  el("info").textContent = "file restored";
});
el("btn-text").addEventListener("click", () => {
  state.textOpen = !state.textOpen;
  el("btn-text").setAttribute("aria-pressed", String(state.textOpen));
  el("textview").hidden = !state.textOpen;
  if (state.textOpen) renderText();
});

buildFile();
