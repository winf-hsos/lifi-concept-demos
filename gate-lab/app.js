/* the gate lab — logik und arithmetik.
 *
 * Die Schaltungen aus Deck 12 zum Anfassen: Schalter am Eingang (echte
 * Buttons), Lampen am Ausgang, dazwischen Gatter und Leitungen, die den
 * Strom zeigen (gelb = 1, grau = 0). Stationen:
 *
 *   gates        ein Gatter, zwei Schalter, Wahrheitstafel mit der
 *                aktuellen Zeile
 *   half-adder   XOR fuer die Summe, AND fuer den Uebertrag
 *   full-adder   nimmt zusaetzlich den Uebertrag von rechts
 *   byte-adder   acht Volladdierer in Reihe, der Uebertrag laeuft durch;
 *                Klick auf einen Block oeffnet ihn als Volladdierer
 *   compare      a >= b als Addition: a + (255 - b) + 1, der neunte
 *                Uebertrag ist die Antwort
 *   flip-flop    zwei ueber Kreuz verbundene NOR-Gatter merken sich ein Bit
 *   register     acht davon, ein Byte, das bleibt, bis "store" kommt
 *   build        Puzzles: die Verdrahtung steht, die Gatter fehlen; per
 *                Drag & Drop (oder Klick) einsetzen, die Wahrheitstafel
 *                prueft live
 *
 * Alles laeuft ueber eine kleine Netzliste: Gatter lesen Netze, schreiben
 * ein Netz; die Simulation iteriert, bis nichts mehr kippt (so kommen die
 * Rueckkopplungen des Flip-Flops zur Ruhe). Die Zeichnung ist SVG, aus
 * derselben Netzliste erzeugt. Vorbelegung ueber die Adresse, etwa
 * ?circuit=byte-adder&a=178&b=40, damit der Pixel Filter hierher
 * verlinken kann.
 *
 * Kein Framework, kein Build. */

"use strict";

const el = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");
const bits = (v, w = 8) => v.toString(2).padStart(w, "0");
const Y = "#ffd23f", G = "#4a5259", W = "#ffffff", GL = "#b6bec6", GR = "#7d868f", BL = "#009ee3", RD = "#ff4d6d", GN = "#4ade80";

const GATES = {
  and:  { label: "and",  fn: (a, b) => a & b,       ins: 2, says: "1 only if both inputs are 1" },
  or:   { label: "or",   fn: (a, b) => a | b,       ins: 2, says: "1 if at least one input is 1" },
  xor:  { label: "xor",  fn: (a, b) => a ^ b,       ins: 2, says: "1 if the inputs differ" },
  not:  { label: "not",  fn: (a) => 1 - a,          ins: 1, says: "flips the one input" },
  nand: { label: "nand", fn: (a, b) => 1 - (a & b), ins: 2, says: "and with a not behind it: 0 only if both are 1" },
  nor:  { label: "nor",  fn: (a, b) => 1 - (a | b), ins: 2, says: "or with a not behind it: 1 only if both are 0" },
};

// --- Simulation --------------------------------------------------------------
/* circuit = { gates: [{id, type, in: [net, net], out: net}] }; inputs = {net: 0|1}.
 * Rueckgabe: alle Netzwerte. Rueckkopplungen konvergieren durch Wiederholen. */
function simulate(circuit, inputs, prev) {
  const nets = Object.assign({}, prev || {}, inputs);
  for (let round = 0; round < 40; round++) {
    let changed = false;
    for (const g of circuit.gates) {
      if (!g.type) continue;                      // leerer Slot im Puzzle
      const a = nets[g.in[0]] ?? 0, b = nets[g.in[1]] ?? 0;
      const v = GATES[g.type].fn(a, b);
      if (nets[g.out] !== v) { nets[g.out] = v; changed = true; }
    }
    if (!changed) break;
  }
  return nets;
}

// --- Zeichnen: Gatter, Leitungen, Anschluesse -------------------------------
/* Ein Gatter ist 56 breit und 40 hoch; Eingaenge links bei y+10 und y+30
 * (NOT: y+20), Ausgang rechts bei y+20. */
function gateShape(type, x, y, active, label) {
  const stroke = active ? Y : GL;
  const sw = 2;
  let body = "";
  if (type === "and" || type === "nand") {
    body = `<path d="M${x},${y} h28 a20,20 0 0 1 0,40 h-28 z" fill="#0b0d10" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else if (type === "or" || type === "nor" || type === "xor") {
    body = `<path d="M${x + (type === "xor" ? 6 : 0)},${y} q14,20 0,40 q30,0 46,-20 q-16,-20 -46,-20 z" fill="#0b0d10" stroke="${stroke}" stroke-width="${sw}"/>`;
    if (type === "xor") body += `<path d="M${x},${y} q14,20 0,40" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else if (type === "not") {
    body = `<path d="M${x},${y} l40,20 l-40,20 z" fill="#0b0d10" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else {
    body = `<rect x="${x}" y="${y}" width="48" height="40" rx="6" fill="none" stroke="${G}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }
  if (type === "nand" || type === "nor" || type === "not") {
    const bx = type === "not" ? x + 44 : x + 52;
    body += `<circle cx="${bx}" cy="${y + 20}" r="4" fill="#0b0d10" stroke="${stroke}" stroke-width="${sw}"/>`;
  }
  const text = label ?? (type ? GATES[type].label : "?");
  body += `<text x="${x + 22}" y="${y + 24}" text-anchor="middle" font-family="Roboto Mono, monospace" font-size="11" fill="${type ? GL : G}">${text}</text>`;
  return body;
}

function wire(pts, on) {
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
  return `<path d="${d}" fill="none" stroke="${on ? Y : G}" stroke-width="${on ? 2.5 : 1.5}" stroke-linejoin="round"/>`;
}
const dot = (x, y, on) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${on ? Y : G}"/>`;
const lamp = (x, y, on, label) =>
  `<circle cx="${x}" cy="${y}" r="11" fill="${on ? Y : "#0b0d10"}" stroke="${on ? Y : GL}" stroke-width="2"/>` +
  (on ? `<circle cx="${x}" cy="${y}" r="17" fill="${Y}" opacity="0.18"/>` : "") +
  `<text x="${x}" y="${y + 30}" text-anchor="middle" font-family="Roboto Mono, monospace" font-size="12" fill="${GR}">${label}</text>`;
const port = (x, y, on, label) =>
  `<rect x="${x - 14}" y="${y - 11}" width="28" height="22" rx="4" fill="${on ? Y : "#101316"}" stroke="${on ? Y : G}"/>` +
  `<text x="${x}" y="${y + 4}" text-anchor="middle" font-family="Roboto Mono, monospace" font-size="12" fill="${on ? "#000" : GL}">${label}</text>`;

/* Zeichnet eine Schaltung mit Layoutangaben:
 *   gates:   {id, type, x, y, in:[net], out:net, label?}
 *   wires:   {net, pts:[[x,y],...]}         (Farbe nach Netzwert)
 *   dots:    [x, y, net]                     (Verzweigungspunkte)
 *   ports:   {net, x, y, label}              (Eingaenge, Wert sichtbar)
 *   lamps:   {net, x, y, label}              (Ausgaenge)
 *   texts:   {x, y, text, color?, size?, anchor?} */
function drawCircuit(c, nets) {
  const on = (net) => nets[net] === 1;
  let s = `<svg viewBox="0 0 ${c.w} ${c.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.aria || "circuit"}">`;
  for (const w of c.wires) s += wire(w.pts, on(w.net));
  for (const d of c.dots || []) s += dot(d[0], d[1], on(d[2]));
  for (const g of c.gates) s += gateShape(g.type, g.x, g.y, on(g.out), g.label);
  for (const p of c.ports || []) s += port(p.x, p.y, on(p.net), p.label);
  for (const l of c.lamps || []) s += lamp(l.x, l.y, on(l.net), l.label);
  for (const t of c.texts || []) s += `<text x="${t.x}" y="${t.y}" text-anchor="${t.anchor || "start"}" font-family="${t.mono ? "Roboto Mono, monospace" : "Arial, sans-serif"}" font-size="${t.size || 12}" fill="${t.color || GR}">${t.text}</text>`;
  return s + "</svg>";
}

// --- Bausteine der Oberflaeche ----------------------------------------------
function switchButton(label, value, onToggle, small) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "sw" + (small ? " small" : "");
  b.textContent = String(value);
  b.setAttribute("aria-pressed", value ? "true" : "false");
  b.setAttribute("aria-label", label);
  b.title = label;
  b.addEventListener("click", () => onToggle(1 - value));
  return b;
}

function bitRow(label, value, onChange, readout) {
  const row = document.createElement("div"); row.className = "row";
  const rl = document.createElement("span"); rl.className = "rl"; rl.textContent = label; row.appendChild(rl);
  const bitsBox = document.createElement("div"); bitsBox.className = "bits";
  for (let i = 7; i >= 0; i--) {
    const v = (value >> i) & 1;
    bitsBox.appendChild(switchButton(`${label} bit ${i}`, v, (nv) => onChange(nv ? value | (1 << i) : value & ~(1 << i)), true));
  }
  row.appendChild(bitsBox);
  const rv = document.createElement("span"); rv.className = "rv"; rv.textContent = readout ?? `= ${value}`; row.appendChild(rv);
  return row;
}

function truthTable(headersIn, headersOut, rows, current, target) {
  let h = `<table class="truth"><tr>${headersIn.map((x) => `<th>${x}</th>`).join("")}${headersOut.map((x) => `<th>${x}</th>`).join("")}</tr>`;
  rows.forEach((r, i) => {
    const now = current === i ? " class=\"now\"" : "";
    h += `<tr${now}>${r.in.map((v) => `<td class="${v ? "on" : ""}">${v}</td>`).join("")}`;
    h += r.out.map((v, k) => {
      let cls = v ? "on" : "";
      if (target) cls = v === target[i][k] ? "hit" : "miss";
      return `<td class="${cls}">${v}</td>`;
    }).join("") + "</tr>";
  });
  return h + "</table>";
}

// --- Zustand und Adresse -----------------------------------------------------
const q = new URLSearchParams(location.search);
const num = (k, d, max = 255) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.has(k) ? Math.max(0, Math.min(max, Math.floor(v))) : d; };
const state = {
  station: q.get("circuit") || "gates",
  gate: GATES[q.get("gate")] ? q.get("gate") : "and",
  a: num("a", 178), b: num("b", 40), cin: num("c", 0, 1),
  ia: num("a", 1, 1), ib: num("b", 1, 1),           // Bits fuer die Kleinschaltungen
  s: 0, r: 0, ff: { q: 0, qn: 1 },                   // Flip-Flop: Netze bleiben erhalten, Start bei q = 0
  regD: num("a", 178), regQ: num("b", 0),
  puzzle: q.get("puzzle") || "half-adder", slots: {}, chip: null,
};
if (q.get("circuit") === "full-adder" && q.has("a")) { state.ia = num("a", 1, 1); state.ib = num("b", 1, 1); }

const STATIONS = [
  ["gates", "gates"], ["half-adder", "half adder"], ["full-adder", "full adder"], ["byte-adder", "byte adder"],
  ["compare", "compare"], ["flip-flop", "flip-flop"], ["register", "register"], ["build", "build it yourself"],
];

function setUrl() {
  const p = new URLSearchParams();
  p.set("circuit", state.station);
  if (state.station === "gates") p.set("gate", state.gate);
  if (["byte-adder", "compare"].includes(state.station)) { p.set("a", state.a); p.set("b", state.b); }
  if (state.station === "build") p.set("puzzle", state.puzzle);
  history.replaceState(null, "", "?" + p.toString());
}

// --- Station: ein Gatter -----------------------------------------------------
function renderGates(stage) {
  const g = GATES[state.gate];
  const pick = document.createElement("div"); pick.className = "palette";
  for (const k of Object.keys(GATES)) {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip";
    b.textContent = GATES[k].label; b.setAttribute("aria-pressed", k === state.gate ? "true" : "false");
    b.addEventListener("click", () => { state.gate = k; render(); });
    pick.appendChild(b);
  }
  stage.appendChild(pick);
  el("hint").textContent = `${g.label}: ${g.says}. flip the switches and watch the current.`;

  const c = { w: 520, h: 130, wires: [], gates: [{ id: "g", type: state.gate, x: 240, y: 45, in: g.ins === 1 ? ["a"] : ["a", "b"], out: "q" }],
              ports: [], lamps: [{ net: "q", x: 420, y: 65, label: "out" }], dots: [] };
  if (g.ins === 1) {
    c.ports.push({ net: "a", x: 100, y: 65, label: "a" });
    c.wires.push({ net: "a", pts: [[114, 65], [240, 65]] });
  } else {
    c.ports.push({ net: "a", x: 100, y: 45, label: "a" }, { net: "b", x: 100, y: 85, label: "b" });
    c.wires.push({ net: "a", pts: [[114, 45], [240, 55]] }, { net: "b", pts: [[114, 85], [240, 75]] });
  }
  c.wires.push({ net: "q", pts: [[state.gate === "not" ? 288 : (state.gate === "and" || state.gate === "xor" || state.gate === "or") ? 296 : 296, 65], [409, 65]] });
  const nets = simulate(c, { a: state.ia, b: state.ib });

  const row = document.createElement("div"); row.className = "row";
  row.appendChild(switchButton("input a", state.ia, (v) => { state.ia = v; render(); }));
  if (g.ins === 2) row.appendChild(switchButton("input b", state.ib, (v) => { state.ib = v; render(); }));
  const rv = document.createElement("span"); rv.className = "rv"; rv.textContent = `→ out = ${nets.q}`; row.appendChild(rv);
  stage.appendChild(row);

  const bench = document.createElement("div"); bench.className = "bench"; bench.innerHTML = drawCircuit(c, nets); stage.appendChild(bench);

  const rows = [], combos = g.ins === 1 ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
  let current = 0;
  combos.forEach((cmb, i) => { rows.push({ in: cmb, out: [g.fn(cmb[0], cmb[1] ?? 0)] }); if (cmb[0] === state.ia && (g.ins === 1 || cmb[1] === state.ib)) current = i; });
  const tt = document.createElement("div"); tt.innerHTML = truthTable(g.ins === 1 ? ["a"] : ["a", "b"], ["out"], rows, current); stage.appendChild(tt);
  note(stage, state.gate === "nand" || state.gate === "nor"
    ? "every other gate can be built from this one alone. that is why chips are full of them."
    : "four rows, and that is the whole gate. everything below is many of these.");
}

// --- Halb- und Volladdierer als Netzlisten mit Layout ----------------------
function halfAdderCircuit(types) {
  const t = types || { sum: "xor", carry: "and" };
  return {
    w: 520, h: 210, aria: "half adder",
    ports: [{ net: "a", x: 60, y: 60, label: "a" }, { net: "b", x: 60, y: 140, label: "b" }],
    gates: [{ id: "s", type: t.sum, x: 260, y: 40, in: ["a", "b"], out: "sum" },
            { id: "c", type: t.carry, x: 260, y: 130, in: ["a", "b"], out: "carry" }],
    wires: [{ net: "a", pts: [[74, 60], [150, 60], [150, 50], [260, 50]] }, { net: "a", pts: [[150, 60], [150, 140], [260, 140]] },
            { net: "b", pts: [[74, 140], [190, 140], [190, 70], [260, 70]] }, { net: "b", pts: [[190, 140], [190, 160], [260, 160]] },
            { net: "sum", pts: [[316, 60], [420, 60]] }, { net: "carry", pts: [[316, 150], [420, 150]] }],
    dots: [[150, 60, "a"], [190, 140, "b"]],
    lamps: [{ net: "sum", x: 431, y: 60, label: "sum" }, { net: "carry", x: 431, y: 150, label: "carry" }],
    slots: { sum: "s", carry: "c" },
  };
}

function fullAdderCircuit(types) {
  const t = types || { x1: "xor", x2: "xor", a1: "and", a2: "and", o: "or" };
  return {
    w: 640, h: 290, aria: "full adder",
    ports: [{ net: "a", x: 50, y: 50, label: "a" }, { net: "b", x: 50, y: 110, label: "b" }, { net: "cin", x: 50, y: 255, label: "c in" }],
    gates: [{ id: "x1", type: t.x1, x: 200, y: 40, in: ["a", "b"], out: "s1" },
            { id: "x2", type: t.x2, x: 380, y: 60, in: ["s1", "cin"], out: "sum" },
            { id: "a1", type: t.a1, x: 200, y: 180, in: ["a", "b"], out: "c1" },
            { id: "a2", type: t.a2, x: 380, y: 140, in: ["s1", "cin"], out: "c2" },
            { id: "o", type: t.o, x: 500, y: 165, in: ["c2", "c1"], out: "cout" }],
    wires: [{ net: "a", pts: [[64, 50], [200, 50]] }, { net: "a", pts: [[120, 50], [120, 190], [200, 190]] },
            { net: "b", pts: [[64, 110], [150, 110], [150, 70], [200, 70]] }, { net: "b", pts: [[150, 110], [150, 210], [200, 210]] },
            { net: "s1", pts: [[256, 60], [330, 60], [330, 70], [380, 70]] }, { net: "s1", pts: [[330, 70], [330, 150], [380, 150]] },
            { net: "cin", pts: [[64, 255], [300, 255], [300, 170], [380, 170]] }, { net: "cin", pts: [[300, 170], [300, 90], [380, 90]] },
            { net: "sum", pts: [[436, 80], [560, 80]] },
            { net: "c2", pts: [[436, 160], [470, 160], [470, 175], [500, 175]] },
            { net: "c1", pts: [[256, 200], [470, 200], [470, 195], [500, 195]] },
            { net: "cout", pts: [[556, 185], [580, 185]] }],
    dots: [[120, 50, "a"], [150, 110, "b"], [330, 70, "s1"], [300, 170, "cin"]],
    lamps: [{ net: "sum", x: 571, y: 80, label: "sum" }, { net: "cout", x: 591, y: 185, label: "c out" }],
    slots: { x1: "x1", x2: "x2", a1: "a1", a2: "a2", o: "o" },
  };
}

function renderSmallAdder(stage, kind) {
  const full = kind === "full";
  const c = full ? fullAdderCircuit() : halfAdderCircuit();
  const inputs = full ? { a: state.ia, b: state.ib, cin: state.cin } : { a: state.ia, b: state.ib };
  const nets = simulate(c, inputs);
  el("hint").textContent = full
    ? "a full adder adds three bits: a, b and the carry from the right. two xor for the sum, two and plus an or for the carry."
    : "adding two bits gives two answers: the sum bit is an xor, the carry bit is an and. that is the whole half adder.";
  const row = document.createElement("div"); row.className = "row";
  row.appendChild(switchButton("a", state.ia, (v) => { state.ia = v; render(); }));
  row.appendChild(switchButton("b", state.ib, (v) => { state.ib = v; render(); }));
  if (full) row.appendChild(switchButton("carry in", state.cin, (v) => { state.cin = v; render(); }));
  const total = state.ia + state.ib + (full ? state.cin : 0);
  const rv = document.createElement("span"); rv.className = "rv";
  rv.textContent = `${state.ia} + ${state.ib}${full ? " + " + state.cin : ""} = ${total} = ${bits(total, 2)}₂`; row.appendChild(rv);
  stage.appendChild(row);
  const bench = document.createElement("div"); bench.className = "bench"; bench.innerHTML = drawCircuit(c, nets); stage.appendChild(bench);
  const rows = [], combos = [];
  const n = full ? 8 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i >> (full ? 2 : 1)) & 1, b = (i >> (full ? 1 : 0)) & 1, ci = full ? i & 1 : 0;
    const t = a + b + ci; combos.push([a, b, ci]);
    rows.push({ in: full ? [a, b, ci] : [a, b], out: [t & 1, t >> 1] });
  }
  const current = combos.findIndex((x) => x[0] === state.ia && x[1] === state.ib && (!full || x[2] === state.cin));
  const tt = document.createElement("div"); tt.innerHTML = truthTable(full ? ["a", "b", "c in"] : ["a", "b"], ["sum", full ? "c out" : "carry"], rows, current); stage.appendChild(tt);
  note(stage, full ? "chain eight of these and you add two bytes: see the byte adder." : "it is called half because it cannot take a carry from the right. the full adder can.");
}

// --- Byte-Addierer und Vergleicher, blockweise -----------------------------
function byteBlocks(a, b, cin, invertB) {
  // acht Volladdierer von rechts (Bit 0) nach links; Rueckgabe je Bit
  const cols = [];
  let carry = cin;
  for (let i = 0; i < 8; i++) {
    const ai = (a >> i) & 1, bi0 = (b >> i) & 1, bi = invertB ? 1 - bi0 : bi0;
    const t = ai + bi + carry;
    cols.push({ i, ai, bi0, bi, cin: carry, sum: t & 1, cout: t >> 1 });
    carry = t >> 1;
  }
  return { cols, cout: carry };
}

function drawBlocks(res, invertB, onBox) {
  const W = 860, boxW = 72, gap = 26, x0 = 60, top = invertB ? 130 : 90;
  let s = `<svg viewBox="0 0 ${W} ${top + 170}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="byte adder">`;
  for (let k = 0; k < 8; k++) {
    const col = res.cols[7 - k];                      // links Bit 7
    const x = x0 + k * (boxW + gap);
    // Eingaenge von oben
    s += wire([[x + 22, 20], [x + 22, top]], col.ai) + `<text x="${x + 22}" y="14" text-anchor="middle" font-size="11" font-family="Roboto Mono, monospace" fill="${col.ai ? Y : GR}">a=${col.ai}</text>`;
    if (invertB) {
      s += wire([[x + 50, 20], [x + 50, 60]], col.bi0) + `<text x="${x + 50}" y="14" text-anchor="middle" font-size="11" font-family="Roboto Mono, monospace" fill="${col.bi0 ? Y : GR}">b=${col.bi0}</text>`;
      s += `<g transform="translate(${x + 30},60) scale(0.72)">${gateShape("not", 0, 0, col.bi, "not")}</g>`;
      s += wire([[x + 50, 92], [x + 50, top]], col.bi);
    } else {
      s += wire([[x + 50, 20], [x + 50, top]], col.bi) + `<text x="${x + 50}" y="14" text-anchor="middle" font-size="11" font-family="Roboto Mono, monospace" fill="${col.bi ? Y : GR}">b=${col.bi}</text>`;
    }
    // der Block
    s += `<g class="fa" data-i="${col.i}" style="cursor:pointer"><rect x="${x}" y="${top}" width="${boxW}" height="54" rx="7" fill="#0b0d10" stroke="${col.sum || col.cout ? GL : G}" stroke-width="1.5"/>` +
         `<text x="${x + boxW / 2}" y="${top + 24}" text-anchor="middle" font-size="12" font-family="Roboto Mono, monospace" fill="${GL}">full adder</text>` +
         `<text x="${x + boxW / 2}" y="${top + 42}" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" fill="${G}">bit ${col.i} · open</text></g>`;
    // Uebertrag nach links (zum naechsten Block) bzw. hinaus
    const cx = x - gap / 2;
    s += wire([[x, top + 27], [x - gap, top + 27]], col.cout);
    s += `<text x="${cx}" y="${top + 20}" text-anchor="middle" font-size="10" font-family="Roboto Mono, monospace" fill="${col.cout ? Y : G}">${col.cout}</text>`;
    // Summe nach unten
    s += wire([[x + 36, top + 54], [x + 36, top + 95]], col.sum);
    s += lamp(x + 36, top + 108, col.sum, `s${col.i}`);
  }
  // Uebertrag hinein rechts, hinaus links
  const xr = x0 + 8 * (boxW + gap) - gap;
  s += wire([[xr + gap, top + 27], [xr, top + 27]], res.cols[0].cin) + `<text x="${xr + gap + 4}" y="${top + 31}" font-size="11" font-family="Roboto Mono, monospace" fill="${res.cols[0].cin ? Y : GR}">c in = ${res.cols[0].cin}</text>`;
  s += lamp(x0 - gap + 2, top + 27, res.cout, invertB ? "a ≥ b" : "9th bit");
  s += "</svg>";
  const bench = document.createElement("div"); bench.className = "bench"; bench.innerHTML = s;
  bench.querySelectorAll("g.fa").forEach((g) => g.addEventListener("click", () => onBox(Number(g.dataset.i))));
  return bench;
}

function renderByte(stage, compare) {
  const res = byteBlocks(state.a, state.b, compare ? 1 : 0, compare);
  el("hint").textContent = compare
    ? "how does a machine compare? by subtracting: a + (255 − b) + 1 is a − b in eight bits, and the ninth bit says whether a ≥ b. the not-gates flip b, the extra carry-in is the + 1."
    : "eight full adders in a row. each one gets two bits and the carry from the right, and hands its own carry to the left. click a block to open it.";
  stage.appendChild(bitRow("a", state.a, (v) => { state.a = v; render(); }));
  stage.appendChild(bitRow("b", state.b, (v) => { state.b = v; render(); }));
  const sum = res.cols.reduce((acc, c) => acc | (c.sum << c.i), 0);
  const rv = document.createElement("div"); rv.className = "row";
  rv.innerHTML = compare
    ? `<span class="rv" style="min-width:0">${state.a} ≥ ${state.b}? <span style="color:${res.cout ? "#4ade80" : "#ff4d6d"}">${res.cout ? "yes" : "no"}</span> &nbsp;·&nbsp; a + (255 − b) + 1 = ${state.a + (255 - state.b) + 1} = ${res.cout ? "1" : "0"} ${bits(sum)}₂</span>`
    : `<span class="rv" style="min-width:0">${state.a} + ${state.b} = ${state.a + state.b} &nbsp;→&nbsp; ${res.cout ? "1" : " "}${bits(sum)}₂${res.cout ? ` &nbsp;<span style="color:#ff4d6d">nine bits: the ninth carry does not fit into a byte</span>` : ""}</span>`;
  stage.appendChild(rv);
  stage.appendChild(drawBlocks(res, compare, (i) => {
    const col = res.cols[i];
    state.ia = col.ai; state.ib = col.bi; state.cin = col.cin; state.station = "full-adder"; render();
  }));
  note(stage, compare
    ? "the same adder that adds pixels also decides. the pixel filter uses this before it clamps at 255."
    : "the pixel filter does exactly this 16,384 times per picture. with ≈ 5 gates per full adder, that is 40 gate switches per addition.");
}

// --- Flip-Flop ---------------------------------------------------------------
function flipFlopCircuit() {
  return {
    w: 560, h: 220, aria: "sr flip-flop from two nor gates",
    // SR-Latch aus NOR: reset am Gatter, das q liefert; set am Gatter, das not q liefert
    ports: [{ net: "r", x: 60, y: 50, label: "reset" }, { net: "s", x: 60, y: 170, label: "set" }],
    gates: [{ id: "n1", type: "nor", x: 260, y: 30, in: ["r", "qn"], out: "q" },
            { id: "n2", type: "nor", x: 260, y: 150, in: ["q", "s"], out: "qn" }],
    wires: [{ net: "r", pts: [[74, 50], [260, 40]] }, { net: "s", pts: [[74, 170], [260, 180]] },
            { net: "q", pts: [[318, 50], [430, 50]] }, { net: "q", pts: [[360, 50], [360, 100], [220, 130], [220, 160], [260, 160]] },
            { net: "qn", pts: [[318, 170], [430, 170]] }, { net: "qn", pts: [[360, 170], [360, 120], [220, 90], [220, 60], [260, 60]] }],
    dots: [[360, 50, "q"], [360, 170, "qn"]],
    lamps: [{ net: "q", x: 441, y: 50, label: "q (the bit)" }, { net: "qn", x: 441, y: 170, label: "not q" }],
  };
}

function renderFlipFlop(stage) {
  const c = flipFlopCircuit();
  state.ff = simulate(c, { s: state.s, r: state.r }, state.ff);
  el("hint").textContent = "two nor gates, each feeding the other. press set, let go: q stays 1. press reset, let go: q stays 0. the circuit remembers.";
  const row = document.createElement("div"); row.className = "row";
  row.appendChild(switchButton("reset", state.r, (v) => { state.r = v; render(); }));
  row.appendChild(switchButton("set", state.s, (v) => { state.s = v; render(); }));
  const rv = document.createElement("span"); rv.className = "rv";
  rv.textContent = state.s && state.r ? "set and reset at once: not allowed" : state.s ? "set → q = 1" : state.r ? "reset → q = 0" : `both off → q holds ${state.ff.q ?? 0}`;
  row.appendChild(rv);
  stage.appendChild(row);
  const bench = document.createElement("div"); bench.className = "bench"; bench.innerHTML = drawCircuit(c, state.ff); stage.appendChild(bench);
  note(stage, "no clock, no memory chip: the bit lives in the loop between the two gates, as long as the power stays on. this is one bit of ram. see the register for eight of them.");
}

// --- Register ----------------------------------------------------------------
function renderRegister(stage) {
  el("hint").textContent = "eight flip-flops side by side hold one byte. set the input switches, press store: the lamps take the byte and keep it, whatever you do to the switches afterwards.";
  stage.appendChild(bitRow("input d", state.regD, (v) => { state.regD = v; render(); }));
  const row = document.createElement("div"); row.className = "row";
  const b = document.createElement("button"); b.type = "button"; b.className = "ctrl"; b.textContent = "store";
  b.addEventListener("click", () => { state.regQ = state.regD; render(); });
  row.appendChild(b);
  const rv = document.createElement("span"); rv.className = "rv"; rv.textContent = state.regD === state.regQ ? "stored byte matches the input" : "input changed, register still holds the old byte"; row.appendChild(rv);
  stage.appendChild(row);
  const W = 860, boxW = 72, gap = 26, x0 = 60;
  let s = `<svg viewBox="0 0 ${W} 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="8-bit register">`;
  for (let k = 0; k < 8; k++) {
    const i = 7 - k, x = x0 + k * (boxW + gap), d = (state.regD >> i) & 1, qv = (state.regQ >> i) & 1;
    s += wire([[x + 36, 20], [x + 36, 60]], d) + `<text x="${x + 36}" y="14" text-anchor="middle" font-size="11" font-family="Roboto Mono, monospace" fill="${d ? Y : GR}">d${i}=${d}</text>`;
    s += `<rect x="${x}" y="60" width="${boxW}" height="54" rx="7" fill="#0b0d10" stroke="${qv ? GL : G}" stroke-width="1.5"/>` +
         `<text x="${x + boxW / 2}" y="84" text-anchor="middle" font-size="12" font-family="Roboto Mono, monospace" fill="${GL}">flip-flop</text>` +
         `<text x="${x + boxW / 2}" y="102" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" fill="${G}">bit ${i}</text>`;
    s += wire([[x + 36, 114], [x + 36, 145]], qv) + lamp(x + 36, 158, qv, `q${i}`);
  }
  s += `<text x="${x0 + 8 * (boxW + gap) - gap + 4}" y="92" font-size="11" font-family="Roboto Mono, monospace" fill="${GR}">store →</text>`;
  s += "</svg>";
  const bench = document.createElement("div"); bench.className = "bench"; bench.innerHTML = s; stage.appendChild(bench);
  const rv2 = document.createElement("div"); rv2.className = "row";
  rv2.innerHTML = `<span class="rv" style="min-width:0">register holds ${bits(state.regQ)}₂ = ${state.regQ}</span>`;
  stage.appendChild(rv2);
  note(stage, "a cpu has a few dozen of these; your pixel's byte sits in one while it is being added to. the store signal is what a clock provides, tick after tick.");
}

// --- Baustation: Puzzles -----------------------------------------------------
const PUZZLES = {
  "half-adder": { label: "half adder", make: halfAdderCircuit, ins: ["a", "b"], outs: ["sum", "carry"],
    target: (a, b) => [(a + b) & 1, (a + b) >> 1],
    slots: [["sum", "gate for the sum"], ["carry", "gate for the carry"]] },
  "full-adder": { label: "full adder", make: fullAdderCircuit, ins: ["a", "b", "cin"], outs: ["sum", "cout"],
    target: (a, b, c) => [(a + b + c) & 1, (a + b + c) >> 1],
    slots: [["x1", "slot 1 (a, b)"], ["a1", "slot 2 (a, b)"], ["x2", "slot 3 (s1, c in)"], ["a2", "slot 4 (s1, c in)"], ["o", "slot 5 (carries)"]] },
};

function renderBuild(stage) {
  const pz = PUZZLES[state.puzzle];
  const pick = document.createElement("div"); pick.className = "palette";
  for (const k of Object.keys(PUZZLES)) {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip";
    b.textContent = "build a " + PUZZLES[k].label; b.setAttribute("aria-pressed", k === state.puzzle ? "true" : "false");
    b.addEventListener("click", () => { state.puzzle = k; state.slots = {}; state.chip = null; render(); });
    pick.appendChild(b);
  }
  stage.appendChild(pick);
  el("hint").textContent = "the wires are laid, the gates are missing. drag a gate from the shelf onto a slot (or click gate, then slot). the truth table on the right tells you when the circuit is right.";

  // Regal
  const shelf = document.createElement("div"); shelf.className = "palette";
  for (const k of Object.keys(GATES)) {
    if (k === "not") continue;
    const ch = document.createElement("button"); ch.type = "button"; ch.className = "chip"; ch.textContent = GATES[k].label;
    ch.draggable = true; ch.setAttribute("aria-pressed", state.chip === k ? "true" : "false");
    ch.addEventListener("dragstart", (ev) => { ev.dataTransfer.setData("text/plain", k); state.chip = k; });
    ch.addEventListener("click", () => { state.chip = state.chip === k ? null : k; render(); });
    shelf.appendChild(ch);
  }
  stage.appendChild(shelf);
  const sh = document.createElement("div"); sh.className = "slot-hint"; sh.textContent = state.chip ? `${GATES[state.chip].label} picked up: now click a slot` : "the shelf: drag or click"; stage.appendChild(sh);

  // Schaltung mit den eingesetzten Gattern
  const types = {}; for (const [slot] of pz.slots) types[slot] = state.slots[slot] || null;
  const c = pz.make(types);
  const inputs = {}; pz.ins.forEach((n, i) => { inputs[n] = [state.ia, state.ib, state.cin][i]; });
  const nets = simulate(c, inputs);
  const row = document.createElement("div"); row.className = "row";
  row.appendChild(switchButton("a", state.ia, (v) => { state.ia = v; render(); }));
  row.appendChild(switchButton("b", state.ib, (v) => { state.ib = v; render(); }));
  if (pz.ins.length === 3) row.appendChild(switchButton("carry in", state.cin, (v) => { state.cin = v; render(); }));
  stage.appendChild(row);
  const bench = document.createElement("div"); bench.className = "bench"; bench.innerHTML = drawCircuit(c, nets); stage.appendChild(bench);

  // Slots als Ablageflaechen
  const slots = document.createElement("div"); slots.className = "palette";
  for (const [slot, label] of pz.slots) {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip";
    b.textContent = `${label}: ${state.slots[slot] ? GATES[state.slots[slot]].label : "empty"}`;
    b.style.borderStyle = state.slots[slot] ? "solid" : "dashed";
    const place = (k) => { state.slots[slot] = k; state.chip = null; render(); };
    b.addEventListener("dragover", (ev) => { ev.preventDefault(); b.style.borderColor = BL; });
    b.addEventListener("dragleave", () => { b.style.borderColor = ""; });
    b.addEventListener("drop", (ev) => { ev.preventDefault(); place(ev.dataTransfer.getData("text/plain")); });
    b.addEventListener("click", () => { if (state.chip) place(state.chip); else if (state.slots[slot]) { delete state.slots[slot]; render(); } });
    slots.appendChild(b);
  }
  stage.appendChild(slots);

  // Wahrheitstafel: Ist gegen Soll
  const rows = [], target = [], n = 1 << pz.ins.length;
  let allOk = true, filled = pz.slots.every(([s]) => state.slots[s]);
  for (let i = 0; i < n; i++) {
    const vals = pz.ins.map((_, k) => (i >> (pz.ins.length - 1 - k)) & 1);
    const inp = {}; pz.ins.forEach((nm, k) => { inp[nm] = vals[k]; });
    const r = simulate(c, inp);
    const out = pz.outs.map((o) => filled ? (r[o] ?? 0) : "·");
    const tg = pz.target(...vals);
    rows.push({ in: vals, out }); target.push(tg);
    if (!filled || out.some((v, k) => v !== tg[k])) allOk = false;
  }
  const cur = rows.findIndex((r) => r.in.every((v, k) => v === [state.ia, state.ib, state.cin][k]));
  const tt = document.createElement("div"); tt.innerHTML = truthTable(pz.ins.map((x) => x === "cin" ? "c in" : x), pz.outs.map((x) => x === "cout" ? "c out" : x), rows, cur, filled ? target : null); stage.appendChild(tt);
  const v = document.createElement("div"); v.className = "verdict" + (allOk ? " ok" : "");
  v.textContent = allOk ? `that is a working ${pz.label}. every row matches.` : filled ? "not yet: the red cells are wrong. swap a gate." : "fill every slot to check the table.";
  stage.appendChild(v);
  note(stage, "there is more than one right answer for some slots. a circuit is right when its table is right, not when it looks like the textbook.");
}

// --- Rahmen ------------------------------------------------------------------
function note(stage, text) {
  const n = document.createElement("div"); n.className = "note"; n.innerHTML = text; stage.appendChild(n);
}

function render() {
  const st = el("stations"); st.innerHTML = "";
  for (const [key, label] of STATIONS) {
    const b = document.createElement("button"); b.type = "button"; b.className = "ctrl"; b.textContent = label;
    b.setAttribute("aria-pressed", key === state.station ? "true" : "false");
    b.addEventListener("click", () => { state.station = key; render(); });
    st.appendChild(b);
  }
  const stage = el("stage"); stage.innerHTML = "";
  ({ "gates": () => renderGates(stage), "half-adder": () => renderSmallAdder(stage, "half"), "full-adder": () => renderSmallAdder(stage, "full"),
     "byte-adder": () => renderByte(stage, false), "compare": () => renderByte(stage, true), "flip-flop": () => renderFlipFlop(stage),
     "register": () => renderRegister(stage), "build": () => renderBuild(stage) }[state.station] || (() => renderGates(stage)))();
  setUrl();
}

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (ev.key >= "1" && ev.key <= "8") { state.station = STATIONS[Number(ev.key) - 1][0]; render(); }
});

render();
