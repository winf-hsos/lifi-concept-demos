/* the pixel filter — logik und arithmetik.
 *
 * Ein 128x128-Bild (dieselben drei Motive wie im Photo Digitiser), in
 * Graustufen ein Byte je Pixel, in Farbe drei (r, g, b). Ein Filter ist
 * dieselbe kleine Rechnung auf jedem dieser Bytes:
 *
 *   brighter  new = old + 40          Addition mit Uebertraegen
 *   darker    new = old - 40          Subtraktion
 *   invert    new = 255 - old         Bit fuer Bit ein Nicht
 *   b/w       new = old >= t ? 255:0  ein Vergleich, eine Entscheidung
 *             (in Farbe: erst die Helligkeit aus r, g, b, dann der Vergleich)
 *   blend     new = (old + other) / 2 Addition, dann eine Stelle nach rechts
 *
 * "step" rechnet EIN Pixel und legt die Rechnung offen: die acht Bits,
 * die Uebertraege, das Ergebnis; in Farbe drei Spalten, eine je Kanal.
 * "run" macht den Rest zeilenweise in zwei Sekunden, der Zaehler laeuft
 * auf 16.384 (Farbe: 49.152) und rechnet die Gatter hoch (8 Volladdierer
 * je Addition, etwa 5 Gatter je Volladdierer).
 *
 * Am Rand (255 oder 0) wird immer begrenzt (clamp): erst ein Vergleich,
 * dann die Grenze, wie in jeder Foto-App. Das Rechenfeld zeigt bei hellen
 * Pixeln den neunten Uebertrag und den Vergleich; ein Hinweis nennt, was
 * ein Addierer allein daraus machen wuerde (230 + 40 = 14).
 *
 * Kein Framework, kein Build. */

"use strict";

// Embed-Modus fuer Folien: ?embed=1
if (new URLSearchParams(location.search).has("embed")) document.body.classList.add("embed");

const N = 128;
const TOTAL = N * N;
const PLUS = 40;
const GATES_PER_ADD = 8 * 5;          // 8 Volladdierer, ~5 Gatter je Stueck
const RUN_MS = 2000;
const CH_NAMES = ["red", "green", "blue"];

const FILTERS = [
  { key: "brighter", label: "brighter +40",  rule: "new = old + 40",           op: "add",   unit: "additions",
    hint: "add 40 to every byte" },
  { key: "darker",   label: "darker −40",    rule: "new = old − 40",           op: "sub",   unit: "subtractions",
    hint: "subtract 40 from every byte" },
  { key: "invert",   label: "invert",        rule: "new = 255 − old",          op: "not",   unit: "inversions",
    hint: "255 − old flips every bit: a not-gate per bit, no adder needed" },
  { key: "bw",       label: "black & white", rule: "new = old ≥ t ? 255 : 0",  op: "cmp",   unit: "comparisons",
    hint: "compare every byte with the threshold: at or above → white, below → black" },
  { key: "blend",    label: "blend",         rule: "new = (old + other) ÷ 2",  op: "blend", unit: "additions",
    hint: "add the byte of the second picture, then halve: halving is shifting one place to the right" },
];
const MOTIFS = ["parrot", "sunset", "lighthouse"];

const el = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");
const bits = (v) => v.toString(2).padStart(8, "0");
const lum = (r, g, b) => Math.round(0.299 * r + 0.587 * g + 0.114 * b);

// --- Zustand -----------------------------------------------------------------
const state = {
  motif: "parrot",
  mode: "grey",     // "grey": ein Byte je Pixel, "rgb": drei
  filter: 0,
  clamp: true,
  threshold: 128,
  src: null,        // Uint8Array(TOTAL * 3), immer rgb gespeichert
  other: null,      // das zweite Motiv, fuer blend
  out: null,        // Uint8Array(TOTAL * 3), bisher gerechnete Pixel
  next: 0,          // Index des naechsten Pixels
  running: false,
  last: null,       // Rechnung des zuletzt geschrittenen Pixels
};
const photos = {};  // Motivname -> { rgb: Uint8Array, grey: Uint8Array } (beide 3 Bytes je Pixel)

// --- Motive laden und zu Bytes machen ---------------------------------------
function loadMotif(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = N; c.height = N;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      const rgb = new Uint8Array(TOTAL * 3), grey = new Uint8Array(TOTAL * 3);
      for (let i = 0; i < TOTAL; i++) {
        rgb[3 * i] = d[4 * i]; rgb[3 * i + 1] = d[4 * i + 1]; rgb[3 * i + 2] = d[4 * i + 2];
        const g = lum(d[4 * i], d[4 * i + 1], d[4 * i + 2]);
        grey[3 * i] = grey[3 * i + 1] = grey[3 * i + 2] = g;
      }
      photos[name] = { rgb, grey };
      resolve();
    };
    img.src = `../assets/photos/${name}.png`;
  });
}

const channels = () => (state.mode === "rgb" ? 3 : 1);

// --- Die Rechnung fuer ein Byte ----------------------------------------------
function computeByte(old, other) {
  const f = FILTERS[state.filter];
  if (f.op === "add") {
    const raw = old + PLUS;
    return { raw, val: raw > 255 ? (state.clamp ? 255 : raw - 256) : raw, over: raw > 255 };
  }
  if (f.op === "sub") {
    const raw = old - PLUS;
    return { raw, val: raw < 0 ? (state.clamp ? 0 : raw + 256) : raw, over: raw < 0 };
  }
  if (f.op === "not") return { raw: 255 - old, val: 255 - old, over: false };
  if (f.op === "cmp") return { raw: old, val: old >= state.threshold ? 255 : 0, over: false };
  const raw = old + other;                 // blend: neun Bits, dann >> 1
  return { raw, val: raw >> 1, over: false };
}

/* Ein Pixel: in Graustufen ein Byte (auf alle drei Kanaele kopiert), in
 * Farbe drei Bytes nacheinander. Schwarz-Weiss in Farbe vergleicht die
 * Helligkeit, nicht die einzelnen Kanaele. */
function computePixel(i) {
  const f = FILTERS[state.filter];
  const s = state.src, o = state.other;
  const res = { index: i, chans: [] };
  if (f.op === "cmp" && state.mode === "rgb") {
    const l = lum(s[3 * i], s[3 * i + 1], s[3 * i + 2]);
    res.lum = l;
    const v = l >= state.threshold ? 255 : 0;
    res.chans.push({ old: l, val: v, raw: l, over: false });
    for (let c = 0; c < 3; c++) state.out[3 * i + c] = v;
    return res;
  }
  const nc = channels();
  for (let c = 0; c < nc; c++) {
    const r = computeByte(s[3 * i + c], o[3 * i + c]);
    res.chans.push({ old: s[3 * i + c], other: o[3 * i + c], ...r });
    if (nc === 1) { state.out[3 * i] = state.out[3 * i + 1] = state.out[3 * i + 2] = r.val; }
    else state.out[3 * i + c] = r.val;
  }
  return res;
}

// --- Zeichnen ----------------------------------------------------------------
function paint(cv, data, upto, mark) {
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(N, N);
  const d = img.data;
  for (let i = 0; i < TOTAL; i++) {
    if (i < upto) {
      d[4 * i] = data[3 * i]; d[4 * i + 1] = data[3 * i + 1]; d[4 * i + 2] = data[3 * i + 2];
    } else {
      d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = 20;   // noch nicht gerechnet: leer, ohne Vorgriff aufs Ergebnis
    }
    d[4 * i + 3] = 255;
  }
  if (mark != null) {                      // das aktuelle Pixel: ein gelbes Kreuz
    const x = mark % N, y = Math.floor(mark / N);
    const dot = (px, py) => {
      if (px < 0 || py < 0 || px >= N || py >= N) return;
      const k = 4 * (py * N + px);
      d[k] = 255; d[k + 1] = 210; d[k + 2] = 63;
    };
    for (let r = 1; r <= 3; r++) { dot(x - r, y); dot(x + r, y); dot(x, y - r); dot(x, y + r); }
  }
  ctx.putImageData(img, 0, 0);
}

function paintAll() {
  const mark = state.last ? state.last.index : null;
  paint(el("cv-src"), state.src, TOTAL, mark);
  paint(el("cv-out"), state.out, state.next, mark);
  el("placeholder").hidden = state.next > 0;
}

// --- Die Rechnung offenlegen -------------------------------------------------
function carriesOf(a, b) {
  // Uebertraege der Addition a + b: out[0] ist der neunte (aus Bit 7), out[8] leer
  let c = 0;
  const out = [];
  for (let i = 0; i < 8; i++) {
    const s = ((a >> i) & 1) + ((b >> i) & 1) + c;
    c = s > 1 ? 1 : 0;
    out.unshift(c);
  }
  out.push(0);
  return out;
}

const cell = (bitStr, dec) => `<td><span class="bits">${bitStr}</span><span class="dec">${dec === "" ? "" : dec}</span></td>`;
const b9 = (v) => " " + bits(v);        // neun Spalten: Platz fuer den neunten Uebertrag

function explain(p) {
  const f = FILTERS[state.filter];
  const nc = p.chans.length;
  const rgb = state.mode === "rgb";
  let html = `<div class="head">pixel ${fmt(p.index)} of ${fmt(TOTAL)} (row ${Math.floor(p.index / N)}, column ${p.index % N})` +
             (rgb && nc === 3 ? ", three bytes, three calculations" : "") + `</div>`;
  const rows = [];                         // [label, cls, [cellHtml je Kanal]]
  const add = (lab, cls, cells) => rows.push({ lab, cls, cells });
  const notes = [];

  if (f.op === "cmp" && rgb) {
    const s = state.src, i = p.index;
    add("red", "", [cell(b9(s[3 * i]), s[3 * i])]);
    add("green", "", [cell(b9(s[3 * i + 1]), s[3 * i + 1])]);
    add("blue", "", [cell(b9(s[3 * i + 2]), s[3 * i + 2])]);
    add("brightness", "result", [cell(b9(p.lum), p.lum)]);
    add("threshold", "", [cell(b9(state.threshold), state.threshold)]);
    add("= new", "result", [cell(b9(p.chans[0].val), p.chans[0].val)]);
    notes.push(`<div class="note">brightness ≈ 0.3·red + 0.6·green + 0.1·blue = ${p.lum}. ${p.lum} ≥ ${state.threshold}? ${p.lum >= state.threshold ? "yes → 255 (white)" : "no → 0 (black)"}. one comparison, the same decision your receiver makes in challenge 1.</div>`);
  } else if (f.op === "add" || f.op === "blend") {
    const opLab = f.op === "add" ? "+ 40" : "+ other";
    add("old", "", p.chans.map((c) => cell(b9(c.old), c.old)));
    add(opLab, "", p.chans.map((c) => cell(b9(f.op === "add" ? PLUS : c.other), f.op === "add" ? PLUS : c.other)));
    add("carries", "", p.chans.map((c) => {
      const b = f.op === "add" ? PLUS : c.other;
      const str = carriesOf(c.old, b).map((k, i) => k ? `<span class="carry ${i === 0 && c.over && !state.clamp ? "dropped" : ""}">1</span>` : " ").join("");
      return cell(str, "");
    }));
    if (f.op === "add") {
      const anyOver = p.chans.some((c) => c.over);
      add(anyOver && state.clamp ? "= sum" : "= new", "result", p.chans.map((c) =>
        c.over ? cell(`<span class="${state.clamp ? "carry" : "dropped"}">1</span>${bits(c.raw - 256)}`, state.clamp ? c.raw : c.val)
               : cell(b9(c.val), c.val)));
      const overs = p.chans.filter((c) => c.over);
      if (overs.length && !state.clamp) {
        notes.push(`<div class="note warn">${overs.map((c) => `${c.old} + ${PLUS} = ${c.raw}`).join(", ")}: nine bits. the adder drops the ninth carry${overs.length > 1 ? " each time" : ""}, ${overs.map((c) => c.val).join(" and ")} ${overs.length > 1 ? "are" : "is"} left. bright turns dark.</div>`);
      } else if (overs.length) {
        add("> 255?", "result", p.chans.map((c) => cell(c.over ? " yes → 255" : " no", "")));
        notes.push(`<div class="note ok">a comparison and a decision before the byte is stored: that is what keeps bright bright.</div>`);
      } else {
        notes.push(`<div class="note">eight bits in, eight bits out. no overflow this time.</div>`);
      }
    } else {
      add("= sum", "result", p.chans.map((c) => cell(`${c.raw > 255 ? "1" : " "}${bits(c.raw & 255)}`, c.raw)));
      add("÷ 2", "result", p.chans.map((c) => cell(b9(c.val), c.val)));
      notes.push(`<div class="note">halving is shifting every bit one place to the right; the lowest bit falls off.</div>`);
    }
  } else if (f.op === "sub") {
    add("old", "", p.chans.map((c) => cell(b9(c.old), c.old)));
    add("− 40", "", p.chans.map(() => cell(b9(PLUS), PLUS)));
    add("= new", "result", p.chans.map((c) => cell(b9(c.val), c.val)));
    const overs = p.chans.filter((c) => c.over);
    if (overs.length && !state.clamp) {
      notes.push(`<div class="note warn">${overs.map((c) => `${c.old} − ${PLUS} = ${c.raw}`).join(", ")}: below zero. the bits wrap around to ${overs.map((c) => c.val).join(" and ")}. dark turns bright.</div>`);
    } else if (overs.length) {
      notes.push(`<div class="note ok">${overs.map((c) => c.raw).join(", ")} &lt; 0? yes → 0. compare first, then cap.</div>`);
    } else {
      notes.push(`<div class="note">subtracting is adding the negative; the same adder does it.</div>`);
    }
  } else if (f.op === "not") {
    add("old", "", p.chans.map((c) => cell(b9(c.old), c.old)));
    add("= 255 − old", "result", p.chans.map((c) => cell(b9(c.val), c.val)));
    notes.push(`<div class="note">every bit flipped: ${nc * 8} not-gates, no adder needed.</div>`);
  } else if (f.op === "cmp") {
    add("old", "", p.chans.map((c) => cell(b9(c.old), c.old)));
    add("threshold", "", p.chans.map(() => cell(b9(state.threshold), state.threshold)));
    add("= new", "result", p.chans.map((c) => cell(b9(c.val), c.val)));
    const c = p.chans[0];
    notes.push(`<div class="note">${c.old} ≥ ${state.threshold}? ${c.old >= state.threshold ? "yes → 255 (white)" : "no → 0 (black)"}. the same decision your receiver makes in challenge 1.</div>`);
  }

  let table = "<table>";
  if (rgb && nc === 3) {
    table += `<tr><th></th>${CH_NAMES.map((n, i) => `<th class="ch-${"rgb"[i]}">${n}</th>`).join("")}</tr>`;
  }
  for (const r of rows) table += `<tr class="${r.cls}"><td class="lab">${r.lab}</td>${r.cells.join("")}</tr>`;
  table += "</table>";
  // Die Schaltung, die gerade arbeitet, im Gate Lab mit genau diesen Werten
  const c0 = p.chans[0];
  const lab = (query, text) => `<div class="note">see the circuit at work: <a href="../gate-lab/?${query}" target="_blank" rel="noopener">${text}</a></div>`;
  if (f.op === "add") notes.push(lab(`circuit=byte-adder&a=${c0.old}&b=${PLUS}`, `the byte adder with ${c0.old} + ${PLUS}`));
  else if (f.op === "blend") notes.push(lab(`circuit=byte-adder&a=${c0.old}&b=${c0.other}`, `the byte adder with ${c0.old} + ${c0.other}`));
  else if (f.op === "not") notes.push(lab(`circuit=gates&gate=not&a=${c0.old & 1}`, "the not-gate"));
  else if (f.op === "cmp") notes.push(lab(`circuit=compare&a=${rgb ? p.lum : c0.old}&b=${state.threshold}`, `the comparator with ${rgb ? p.lum : c0.old} ≥ ${state.threshold}`));
  else if (f.op === "sub") notes.push(lab(`circuit=compare&a=${c0.old}&b=${PLUS}`, `the comparator: is ${c0.old} ≥ ${PLUS}?`));
  el("work").innerHTML = html + table + notes.join("");
}

function updateCounter() {
  const f = FILTERS[state.filter];
  const perPixel = (f.op === "cmp" && state.mode === "rgb") ? 1 : channels();
  const n = state.next * perPixel, all = TOTAL * perPixel;
  el("cnt-ops").textContent = `${f.unit}: ${fmt(n)} of ${fmt(all)}`;
  const gates = f.op === "not" ? n * 8 : f.op === "blend" ? n * (GATES_PER_ADD + 8) : n * GATES_PER_ADD;
  el("cnt-gates").textContent = n === 0 ? "" : `≈ ${fmt(gates)} gate switches so far` +
    (state.next === TOTAL ? " · a modern chip does this in well under a millisecond" : "");
  el("lbl-out").textContent = state.next === 0 ? "after (nothing computed yet)"
    : state.next === TOTAL ? `after: all ${fmt(TOTAL)} pixels done` : "after (computing…)";
}

// --- Schritt und Lauf --------------------------------------------------------
function stepOne() {
  if (state.next >= TOTAL) return;
  state.last = computePixel(state.next);
  state.next += 1;
}

function doStep() {
  if (state.running || state.next >= TOTAL) return;
  stepOne();
  explain(state.last);
  paintAll();
  updateCounter();
}

function doRun() {
  if (state.running || state.next >= TOTAL) return;
  state.running = true;
  const startIdx = state.next, t0 = performance.now();
  // setTimeout statt requestAnimationFrame: laeuft auch in Hintergrund-Tabs
  // und in Test-Browsern ohne Bildschirm gleich weiter
  const tick = () => {
    const frac = Math.min(1, (performance.now() - t0) / RUN_MS);
    const target = startIdx + Math.floor((TOTAL - startIdx) * frac);
    while (state.next < target) stepOne();
    paintAll();
    updateCounter();
    if (state.next < TOTAL) { setTimeout(tick, 16); return; }
    state.running = false;
    explain(state.last);
    const f = FILTERS[state.filter];
    el("work").innerHTML += `<div class="note">…and ${fmt(TOTAL)} times the same thing. that is the whole filter.</div>`;
  };
  setTimeout(tick, 0);
}

function reset() {
  const pick = (name) => photos[name][state.mode === "rgb" ? "rgb" : "grey"];
  state.src = pick(state.motif);
  state.other = pick(MOTIFS[(MOTIFS.indexOf(state.motif) + 1) % MOTIFS.length]);
  state.out = new Uint8Array(TOTAL * 3);
  state.next = 0;
  state.last = null;
  state.running = false;
  const f = FILTERS[state.filter];
  const edgy = f.op === "add" || f.op === "sub";
  el("rule").innerHTML = f.op === "cmp" ? `new = old ≥ ${state.threshold} ? 255 : 0` : f.rule;
  el("rule-hint").textContent = f.hint + (state.mode === "rgb" && f.op !== "cmp" ? ", for red, green and blue separately" : "");
  el("threshold").classList.toggle("show", f.op === "cmp");
  el("edge-hint").textContent = !edgy ? "" : "if a result leaves 0…255, the filter compares first and caps it there (clamp), like your photo app. an adder alone would drop the ninth bit: 230 + 40 would become 14.";
  el("lbl-src").textContent = `before: ${fmt(TOTAL)} pixels × ${channels()} byte${channels() > 1 ? "s" : ""}`;
  el("motifs").classList.toggle("grey", state.mode === "grey");
  el("work").innerHTML = `<div class="idle"><b>step</b> computes one pixel and shows the arithmetic: its byte${channels() > 1 ? "s" : ""}, bit by bit, with the carries.<br><b>run</b> lets the machine do all the others, row by row, in about two seconds.</div>`;
  paintAll();
  updateCounter();
}

// --- Bedienung ---------------------------------------------------------------
function pressed(container, chosen) {
  container.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === chosen ? "true" : "false"));
}

const filt = el("filters");
FILTERS.forEach((f, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ctrl"; b.textContent = f.label;
  b.setAttribute("aria-pressed", i === state.filter ? "true" : "false");
  b.addEventListener("click", () => { state.filter = i; pressed(filt, b); reset(); });
  filt.appendChild(b);
});

el("motifs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  state.motif = b.dataset.m; pressed(el("motifs"), b); reset();
});
el("modes").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  state.mode = b.dataset.mode; pressed(el("modes"), b); reset();
});
el("bt-step").addEventListener("click", doStep);
el("bt-run").addEventListener("click", doRun);
el("bt-reset").addEventListener("click", reset);
el("in-thr").addEventListener("input", (ev) => {
  state.threshold = Number(ev.target.value);
  el("rd-thr").textContent = String(state.threshold);
  reset();
});

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (ev.key === "s") doStep();
  else if (ev.key === "r") doRun();
  else if (ev.key === "0") reset();
  else if (ev.key === "c") el("modes").querySelectorAll("button")[state.mode === "grey" ? 1 : 0].click();
  else if (ev.key >= "1" && ev.key <= "5") filt.querySelectorAll("button")[Number(ev.key) - 1].click();
});

// --- Vorbelegung ueber die Adresse ------------------------------------------
// ?picture=parrot|sunset|lighthouse  ?mode=grey|rgb  ?filter=brighter|darker|invert|bw|blend
// ?threshold=0..255  (dazu ?embed=1 fuer die Folie: dann ohne Einstellzeile)
function applyParams() {
  const q = new URLSearchParams(location.search);
  if (MOTIFS.includes(q.get("picture"))) state.motif = q.get("picture");
  if (["grey", "rgb"].includes(q.get("mode"))) state.mode = q.get("mode");
  const fi = FILTERS.findIndex((f) => f.key === q.get("filter"));
  if (fi >= 0) state.filter = fi;
  const t = Number(q.get("threshold"));
  if (q.has("threshold") && Number.isFinite(t)) { state.threshold = Math.max(0, Math.min(255, Math.floor(t))); el("in-thr").value = String(state.threshold); el("rd-thr").textContent = String(state.threshold); }
  el("motifs").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.m === state.motif ? "true" : "false"));
  el("modes").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === state.mode ? "true" : "false"));
  filt.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", i === state.filter ? "true" : "false"));
}

// --- Start -------------------------------------------------------------------
Promise.all(MOTIFS.map(loadMotif)).then(() => { applyParams(); reset(); });
