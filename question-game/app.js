/* question game — symbole und information.
 *
 * Das Kinderspiel "Wer ist es?" als Informationsmessgeraet: Eines von
 * 16 Gesichtern ist das Geheimnis, also stecken log2(16) = 4 Bit
 * Ungewissheit darin. Jede beantwortete Frage schrumpft die Menge der
 * Kandidaten, und genau dieses Schrumpfen ist die Information:
 * bits = log2(vorher / nachher).
 *
 * Die Merkmale sind absichtlich UNGLEICH verteilt (Brille 8/16, Hut
 * 6/16, Bart 4/16, Locken 8/16, Ohrringe 5/16, Fliege 3/16): Wer die
 * Splits liest und immer nahe der Haelfte fragt, holt ~1 Bit je Frage
 * und ist in 4 Fragen fertig; wer schiefe Fragen stellt, braucht mehr.
 * Ein Rateklick auf ein Gesicht zaehlt ebenfalls als Frage — meistens
 * die schlechteste (Split 1 gegen 15), manchmal ein Glueckstreffer.
 * Beides zeigt die Bit-Rechnung ehrlich an.
 *
 * Kein Framework, kein Build. Gesichter: KI-generiert (gpt-image-2). */

"use strict";

// Attribute: [glasses, hat, beard, curly, earrings, bowtie]
const CHARS = [
  { name: "mia",   a: [1, 1, 0, 1, 0, 0] },
  { name: "omar",  a: [1, 0, 1, 0, 0, 0] },
  { name: "lena",  a: [1, 0, 0, 1, 1, 0] },
  { name: "ravi",  a: [1, 1, 0, 0, 0, 0] },
  { name: "finn",  a: [1, 0, 1, 1, 0, 0] },
  { name: "aisha", a: [1, 1, 0, 0, 1, 0] },
  { name: "jonas", a: [1, 0, 0, 1, 0, 1] },
  { name: "zoe",   a: [1, 0, 0, 0, 0, 0] },
  { name: "ines",  a: [0, 1, 0, 1, 1, 0] },
  { name: "malik", a: [0, 0, 1, 0, 0, 0] },
  { name: "sofia", a: [0, 0, 0, 1, 0, 0] },
  { name: "ben",   a: [0, 1, 0, 0, 0, 1] },
  { name: "karim", a: [0, 0, 1, 1, 0, 0] },
  { name: "yuki",  a: [0, 0, 0, 0, 1, 0] },
  { name: "elif",  a: [0, 1, 0, 1, 0, 0] },
  { name: "noah",  a: [0, 0, 0, 0, 1, 1] },
];

const QUESTIONS = [
  { label: "glasses?" },
  { label: "a hat?" },
  { label: "a beard?" },
  { label: "curly hair?" },
  { label: "earrings?" },
  { label: "a bow tie?" },
];

const N = CHARS.length;
const el = (id) => document.getElementById(id);
const log2 = (x) => Math.log(x) / Math.log(2);

let secret = 0;
let alive = [];
let asked = [];
let questions = 0;
let bitsTotal = 0;
let over = false;

// --- Aufbau -----------------------------------------------------------------
const facesEl = el("faces");
const faceEls = CHARS.map((ch, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "face";
  b.setAttribute("aria-label", `guess ${ch.name}`);
  const img = document.createElement("img");
  img.src = `img/${ch.name}.png`;
  img.alt = "";
  const nm = document.createElement("div");
  nm.className = "fname";
  nm.textContent = ch.name;
  b.appendChild(img);
  b.appendChild(nm);
  b.addEventListener("click", () => guess(i));
  facesEl.appendChild(b);
  return b;
});

const qsEl = el("qs");
const qEls = QUESTIONS.map((q, qi) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ctrl";
  b.innerHTML = `<span>${q.label}</span><span class="split"></span>`;
  b.addEventListener("click", () => ask(qi));
  qsEl.appendChild(b);
  return b;
});

// --- Spiellogik -------------------------------------------------------------
function aliveCount() {
  return alive.filter(Boolean).length;
}

function splitOf(qi) {
  let yes = 0, total = 0;
  alive.forEach((a, i) => {
    if (!a) return;
    total += 1;
    yes += CHARS[i].a[qi];
  });
  return { yes, no: total - yes };
}

function addLog(html) {
  const div = document.createElement("div");
  div.className = "entry";
  div.innerHTML = html;
  el("log").prepend(div);
}

function bookkeep(before) {
  const after = aliveCount();
  const bits = log2(before / after);
  bitsTotal += bits;
  questions += 1;
  return { after, bits };
}

function ask(qi) {
  if (over || asked[qi]) return;
  const before = aliveCount();
  const answer = CHARS[secret].a[qi] === 1;
  alive = alive.map((a, i) => a && (CHARS[i].a[qi] === 1) === answer);
  asked[qi] = true;
  const { after, bits } = bookkeep(before);
  addLog(`${QUESTIONS[qi].label} <b>${answer ? "yes" : "no"}</b> — ` +
         `${before} &rarr; ${after} · ` +
         `<span class="bits">${bits.toFixed(2)} bits</span>`);
  finishIfDone();
  render();
}

function guess(i) {
  if (over || !alive[i]) return;
  const before = aliveCount();
  if (i === secret) {
    alive = alive.map((_, j) => j === secret);
    const { bits } = bookkeep(before);
    addLog(`guess: ${CHARS[i].name}? <b>yes!</b> — ${before} &rarr; 1 · ` +
           `<span class="bits">${bits.toFixed(2)} bits</span>` +
           (before > 2 ? ' <span class="weak">(lucky)</span>' : ""));
  } else {
    alive[i] = false;
    const { after, bits } = bookkeep(before);
    addLog(`guess: ${CHARS[i].name}? <b>no</b> — ${before} &rarr; ${after} · ` +
           `<span class="bits">${bits.toFixed(2)} bits</span>` +
           (before > 2 ? ' <span class="weak">(a 1-vs-rest question)</span>' : ""));
  }
  finishIfDone();
  render();
}

function finishIfDone() {
  if (aliveCount() !== 1) return;
  over = true;
  const found = CHARS[alive.indexOf(true)].name;
  faceEls[alive.indexOf(true)].classList.add("secret");
  el("res-head").textContent = `found: ${found}`;
  const bpq = bitsTotal / questions;
  el("res-nums").innerHTML =
    `${questions} questions · ${bitsTotal.toFixed(2)} bits total · ` +
    `${bpq.toFixed(2)} bits per question<br>` +
    (questions <= 4
      ? "that is the halving strategy at work."
      : `the halving strategy finds anyone in 4 questions (4 &times; 1.00 bits).`);
  el("result").classList.add("show");
}

// --- Anzeige ----------------------------------------------------------------
function render() {
  faceEls.forEach((b, i) => b.classList.toggle("out", !alive[i]));
  qEls.forEach((b, qi) => {
    const { yes, no } = splitOf(qi);
    b.querySelector(".split").textContent = `${yes} / ${no}`;
    b.disabled = over || asked[qi] || yes === 0 || no === 0;
  });
  el("st-left").textContent = aliveCount();
  el("st-q").textContent = questions;
  el("st-bits").textContent = bitsTotal.toFixed(2);
  el("bits-fill").style.width = `${Math.min(100, (bitsTotal / 4) * 100)}%`;
  el("st-bpq").textContent =
    questions ? (bitsTotal / questions).toFixed(2) : "–";
}

function newGame() {
  secret = Math.floor(Math.random() * N);
  alive = new Array(N).fill(true);
  asked = QUESTIONS.map(() => false);
  questions = 0;
  bitsTotal = 0;
  over = false;
  el("log").innerHTML = "";
  el("result").classList.remove("show");
  faceEls.forEach((b) => b.classList.remove("secret"));
  render();
}

el("btn-new").addEventListener("click", newGame);

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (ev.key >= "1" && ev.key <= "6") ask(Number(ev.key) - 1);
  else if (ev.key === "n") newGame();
});

// --- Start ------------------------------------------------------------------
newGame();
