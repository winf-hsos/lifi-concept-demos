/* the pixel filter — logik und arithmetik.
 *
 * Ein 128x128-Graustufenbild (dieselben drei Motive wie im Photo
 * Digitiser), jedes Pixel ein Byte. Ein Filter ist dieselbe kleine
 * Rechnung auf jedem dieser Bytes:
 *
 *   brighter  new = old + 40          Addition mit Uebertraegen
 *   darker    new = old - 40          Subtraktion
 *   invert    new = 255 - old         Bit fuer Bit ein Nicht
 *   b/w       new = old >= t ? 255:0  ein Vergleich, eine Entscheidung
 *   blend     new = (old + other) / 2 Addition, dann eine Stelle nach rechts
 *
 * "step" rechnet EIN Pixel und legt die Rechnung offen: die acht Bits,
 * die Uebertraege, das Ergebnis. "run" macht den Rest zeilenweise in
 * zwei Sekunden, der Zaehler laeuft auf 16.384 und rechnet die Gatter
 * hoch (8 Volladdierer je Addition, etwa 5 Gatter je Volladdierer).
 *
 * Der Schalter clamp/wrap entscheidet, was am Rand passiert: Bei wrap
 * wirft der Addierer den neunten Uebertrag weg (230 + 40 = 14, fast
 * schwarz), und helle Flaechen bekommen schwarze Sprenkel. Bei clamp
 * kommt vorher ein Vergleich und dann die Grenze. Der Addierer selbst
 * weiss nicht, was 255 bedeutet; das muss man ihm sagen.
 *
 * Kein Framework, kein Build. */

"use strict";

const N = 128;
const TOTAL = N * N;
const PLUS = 40;
const GATES_PER_ADD = 8 * 5;          // 8 Volladdierer, ~5 Gatter je Stueck
const RUN_MS = 2000;

const FILTERS = [
  { key: "brighter", label: "brighter +40", rule: "new = old + 40", op: "add", unit: "additions" },
  { key: "darker",   label: "darker −40",   rule: "new = old − 40", op: "sub", unit: "subtractions" },
  { key: "invert",   label: "invert",       rule: "new = 255 − old", op: "not", unit: "inversions" },
  { key: "bw",       label: "black & white", rule: "new = old ≥ t ? 255 : 0", op: "cmp", unit: "comparisons" },
  { key: "blend",    label: "blend",        rule: "new = (old + other) ÷ 2", op: "blend", unit: "additions" },
];
const MOTIFS = ["parrot", "sunset", "lighthouse"];

const el = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");
const bits = (v) => v.toString(2).padStart(8, "0");
const b9 = (v) => " " + bits(v);   // neun Spalten: Platz fuer den neunten Uebertrag

// --- Zustand -----------------------------------------------------------------
const state = {
  motif: "parrot",
  filter: 0,
  clamp: true,
  threshold: 128,
  src: null,        // Uint8Array(TOTAL), das Graustufenbild
  other: null,      // das zweite Motiv, fuer blend
  out: null,        // Uint8Array(TOTAL), bisher gerechnete Pixel
  next: 0,          // Index des naechsten Pixels
  running: false,
  last: null,       // Rechnung des zuletzt geschrittenen Pixels
};
const grey = {};    // Motivname -> Uint8Array

// --- Motive laden und zu Bytes machen ---------------------------------------
function loadGrey(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = N; c.height = N;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      const g = new Uint8Array(TOTAL);
      for (let i = 0; i < TOTAL; i++) {
        g[i] = Math.round(0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]);
      }
      grey[name] = g;
      resolve();
    };
    img.src = `../assets/photos/${name}.png`;
  });
}

// --- Die Rechnung fuer ein Pixel ---------------------------------------------
function compute(old, other) {
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

// --- Zeichnen ----------------------------------------------------------------
function paint(cv, data, mark) {
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(N, N);
  const d = img.data;
  for (let i = 0; i < TOTAL; i++) {
    const v = data[i];
    d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = v;
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

function paintOut() {
  // noch nicht gerechnete Pixel: das Original, stark abgedunkelt
  const show = new Uint8Array(TOTAL);
  for (let i = 0; i < TOTAL; i++) show[i] = i < state.next ? state.out[i] : state.src[i] >> 2;
  paint(el("cv-out"), show, state.last ? state.last.index : null);
  paint(el("cv-src"), state.src, state.last ? state.last.index : null);
}

// --- Die Rechnung offenlegen -------------------------------------------------
function row(lab, bitStr, dec, cls) {
  return `<div class="row ${cls || ""}"><span class="lab">${lab}</span><span class="bits">${bitStr}</span><span class="dec">${dec}</span></div>`;
}

function carriesOf(a, b) {
  // Uebertraege der Addition a + b, als String ueber neun Stellen (links der neunte)
  let c = 0;
  const out = [];
  for (let i = 0; i < 8; i++) {
    const s = ((a >> i) & 1) + ((b >> i) & 1) + c;
    c = s > 1 ? 1 : 0;
    out.unshift(c);
  }
  return out;                          // out[0] = Uebertrag aus Bit 7 (der neunte)
}

function explain(p) {
  const f = FILTERS[state.filter];
  const w = el("work");
  const old = p.old;
  let html = `<div class="head">pixel ${fmt(p.index)} of ${fmt(TOTAL)} (row ${Math.floor(p.index / N)}, column ${p.index % N})</div>`;
  if (f.op === "add" || f.op === "blend") {
    const b = f.op === "add" ? PLUS : p.other;
    const carries = carriesOf(old, b);
    const carryStr = carries.map((c, i) => c ? (i === 0 ? `<span class="carry ${p.over ? "dropped" : ""}">1</span>` : `<span class="carry">1</span>`) : " ").join("");
    html += row("old", b9(old), old);
    html += row(f.op === "add" ? "+ 40" : "+ other", b9(b), b);
    html += row("carries", carryStr, "");
    if (f.op === "add") {
      if (p.over && !state.clamp) {
        html += row("= new", `<span class="dropped">1</span>${bits(p.val)}`, p.val, "result");
        html += `<div class="note warn">${old} + ${PLUS} = ${p.raw}: nine bits. the adder drops the ninth carry, ${p.val} is left. almost black.</div>`;
      } else if (p.over) {
        html += row("= sum", `1${bits(p.raw - 256)}`, p.raw, "result");
        html += `<div class="note ok">${p.raw} &gt; 255? yes → 255. a comparison and a decision, before the number is stored.</div>`;
      } else {
        html += row("= new", b9(p.val), p.val, "result");
        html += `<div class="note">eight bits in, eight bits out. no overflow this time.</div>`;
      }
    } else {
      html += row("= sum", `${p.raw > 255 ? "1" : " "}${bits(p.raw & 255)}`, p.raw, "result");
      html += row("÷ 2", b9(p.val), p.val, "result");
      html += `<div class="note">halving is shifting every bit one place to the right.</div>`;
    }
  } else if (f.op === "sub") {
    html += row("old", b9(old), old);
    html += row("− 40", b9(PLUS), PLUS);
    if (p.over && !state.clamp) {
      html += row("= new", b9(p.val), p.val, "result");
      html += `<div class="note warn">${old} − ${PLUS} = ${p.raw}: below zero. the bits wrap around to ${p.val}. almost white.</div>`;
    } else if (p.over) {
      html += row("= new", b9(0), 0, "result");
      html += `<div class="note ok">${p.raw} &lt; 0? yes → 0. compare first, then cap.</div>`;
    } else {
      html += row("= new", b9(p.val), p.val, "result");
      html += `<div class="note">subtracting is adding the negative; the adder does that too.</div>`;
    }
  } else if (f.op === "not") {
    html += row("old", b9(old), old);
    html += row("255", b9(255), 255);
    html += row("= new", b9(p.val), p.val, "result");
    html += `<div class="note">255 − old flips every bit: eight not-gates, no adder needed.</div>`;
  } else if (f.op === "cmp") {
    html += row("old", b9(old), old);
    html += row("t", b9(state.threshold), state.threshold);
    html += row("= new", b9(p.val), p.val, "result");
    html += `<div class="note">${old} ≥ ${state.threshold}? ${old >= state.threshold ? "yes → 255 (white)" : "no → 0 (black)"}. the same decision your receiver makes in challenge 1.</div>`;
  }
  w.innerHTML = html;
}

function updateCounter() {
  const f = FILTERS[state.filter];
  const n = state.next;
  el("cnt-ops").textContent = `${f.unit}: ${fmt(n)} of ${fmt(TOTAL)}`;
  const gates = f.op === "not" ? n * 8 : f.op === "cmp" ? n * GATES_PER_ADD : f.op === "blend" ? n * (GATES_PER_ADD + 8) : n * GATES_PER_ADD;
  el("cnt-gates").textContent = n === 0 ? "" : `≈ ${fmt(gates)} gate switches so far` +
    (n === TOTAL ? " · a modern chip does this in well under a millisecond" : "");
  el("lbl-out").textContent = n === 0 ? "after (nothing computed yet)" : n === TOTAL ? "after: all 16,384 done" : "after (computing…)";
}

// --- Schritt und Lauf --------------------------------------------------------
function stepOne() {
  if (state.next >= TOTAL) return;
  const i = state.next;
  const old = state.src[i], other = state.other[i];
  const r = compute(old, other);
  state.out[i] = r.val;
  state.next = i + 1;
  state.last = { index: i, old, other, ...r };
}

function doStep() {
  if (state.running) return;
  stepOne();
  explain(state.last);
  paintOut();
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
    paintOut();
    updateCounter();
    if (state.next < TOTAL) { setTimeout(tick, 16); return; }
    state.running = false;
    explain(state.last);
    const f = FILTERS[state.filter];
    el("work").innerHTML += `<div class="note">…and ${fmt(TOTAL)} times the same thing. that is the whole filter.</div>`;
    if (f.op === "add" && !state.clamp) {
      el("work").innerHTML += `<div class="note warn">see the black speckles in the bright areas? every one is a dropped ninth carry.</div>`;
    }
  };
  setTimeout(tick, 0);
}

function reset() {
  state.src = grey[state.motif];
  state.other = grey[MOTIFS[(MOTIFS.indexOf(state.motif) + 1) % MOTIFS.length]];
  state.out = new Uint8Array(TOTAL);
  state.next = 0;
  state.last = null;
  state.running = false;
  const f = FILTERS[state.filter];
  el("rule").innerHTML = f.op === "cmp"
    ? `new = old ≥ <span class="dim">${state.threshold}</span> ? 255 : 0`
    : f.rule + (f.op === "add" || f.op === "sub" ? ` <span class="dim">· ${state.clamp ? "clamp at the edge" : "wrap at the edge"}</span>` : "");
  el("threshold").classList.toggle("show", f.op === "cmp");
  el("work").innerHTML = `<div class="idle">press "step" to compute one pixel and see the arithmetic. press "run" for all the rest.</div>`;
  paintOut();
  updateCounter();
}

// --- Bedienung ---------------------------------------------------------------
const filt = el("filters");
FILTERS.forEach((f, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "ctrl"; b.textContent = f.label;
  b.setAttribute("aria-pressed", i === state.filter ? "true" : "false");
  b.addEventListener("click", () => {
    state.filter = i;
    filt.querySelectorAll("button").forEach((x, j) => x.setAttribute("aria-pressed", j === i ? "true" : "false"));
    reset();
  });
  filt.appendChild(b);
});

el("motifs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  state.motif = b.dataset.m;
  el("motifs").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  reset();
});

el("bt-step").addEventListener("click", doStep);
el("bt-run").addEventListener("click", doRun);
el("bt-reset").addEventListener("click", reset);
el("bt-clamp").addEventListener("click", () => { state.clamp = true; setMode(); });
el("bt-wrap").addEventListener("click", () => { state.clamp = false; setMode(); });
function setMode() {
  el("bt-clamp").setAttribute("aria-pressed", state.clamp ? "true" : "false");
  el("bt-wrap").setAttribute("aria-pressed", state.clamp ? "false" : "true");
  reset();
}
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
  else if (ev.key >= "1" && ev.key <= "5") filt.querySelectorAll("button")[Number(ev.key) - 1].click();
});

// --- Start -------------------------------------------------------------------
Promise.all(MOTIFS.map(loadGrey)).then(reset);
