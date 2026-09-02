/* question game — symbole und information.
 *
 * Das Kinderspiel "Wer ist es?" als Informationsmessgeraet: Eines von
 * 16 Gesichtern ist das Geheimnis, also stecken log2(16) = 4 Bit
 * Ungewissheit darin. Jede beantwortete Frage schrumpft die Menge der
 * Kandidaten, und genau dieses Schrumpfen ist die Information:
 * bits = log2(vorher / nachher).
 *
 * Die Ja/Nein-Verteilung der Merkmale wird bewusst NICHT angezeigt:
 * Das Auszaehlen der Gesichter ist die Strategiearbeit, um die es
 * geht. Nach jeder Antwort erklaert ein Modal die Frage im Klartext,
 * die gewonnenen Bits und den Erwartungswert der Frage (die Entropie
 * ihres Splits) — so sieht man, ob eine Frage gut GEPLANT war,
 * unabhaengig davon, ob sie Glueck hatte. Ein Rateklick auf ein
 * Gesicht zaehlt ebenfalls als Frage, meistens die schlechteste
 * (1 gegen den Rest). Mia hat als Einzige rote Haare: Auf alle drei
 * Haarfarbenfragen antwortet sie mit Nein — alles oder nichts.
 *
 * Kein Framework, kein Build. Gesichter: KI-generiert (gpt-image-2). */

"use strict";

// Attribute: [glasses, hat, beard, curly, earrings, bowtie], hair: r/b/g/d
const CHARS = [
  { name: "mia",   a: [1, 1, 0, 1, 0, 0], hair: "r" },
  { name: "omar",  a: [1, 0, 1, 0, 0, 0], hair: "d" },
  { name: "lena",  a: [1, 0, 0, 1, 1, 0], hair: "b" },
  { name: "ravi",  a: [1, 1, 0, 0, 0, 0], hair: "d" },
  { name: "finn",  a: [1, 0, 1, 1, 0, 0], hair: "b" },
  { name: "aisha", a: [1, 1, 0, 0, 1, 0], hair: "d" },
  { name: "jonas", a: [1, 0, 0, 1, 0, 1], hair: "g" },
  { name: "zoe",   a: [1, 0, 0, 0, 0, 0], hair: "d" },
  { name: "ines",  a: [0, 1, 0, 1, 1, 0], hair: "g" },
  { name: "malik", a: [0, 0, 1, 0, 0, 0], hair: "d" },
  { name: "sofia", a: [0, 0, 0, 1, 0, 0], hair: "d" },
  { name: "ben",   a: [0, 1, 0, 0, 0, 1], hair: "d" },
  { name: "karim", a: [0, 0, 1, 1, 0, 0], hair: "d" },
  { name: "yuki",  a: [0, 0, 0, 0, 1, 0], hair: "d" },
  { name: "elif",  a: [0, 1, 0, 1, 0, 0], hair: "d" },
  { name: "noah",  a: [0, 0, 0, 0, 1, 1], hair: "d" },
];

const QUESTIONS = [
  { label: "glasses?",     sentence: "does the person wear glasses?",
    test: (ch) => ch.a[0] === 1 },
  { label: "a hat?",       sentence: "does the person wear a hat?",
    test: (ch) => ch.a[1] === 1 },
  { label: "a beard?",     sentence: "does the person have a beard?",
    test: (ch) => ch.a[2] === 1 },
  { label: "curly hair?",  sentence: "does the person have curly hair?",
    test: (ch) => ch.a[3] === 1 },
  { label: "earrings?",    sentence: "does the person wear earrings?",
    test: (ch) => ch.a[4] === 1 },
  { label: "a bow tie?",   sentence: "does the person wear a bow tie?",
    test: (ch) => ch.a[5] === 1 },
  { label: "grey hair?",   sentence: "does the person have grey hair?",
    test: (ch) => ch.hair === "g" },
  { label: "blonde hair?", sentence: "does the person have blonde hair?",
    test: (ch) => ch.hair === "b" },
  { label: "dark hair?",   sentence: "does the person have dark hair?",
    test: (ch) => ch.hair === "d" },
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
  b.textContent = q.label;
  b.addEventListener("click", () => ask(qi));
  qsEl.appendChild(b);
  return b;
});

// --- Spiellogik -------------------------------------------------------------
function aliveCount() {
  return alive.filter(Boolean).length;
}

/* Erwartungswert einer Ja/Nein-Frage: die Entropie ihres Splits unter
 * den verbliebenen Kandidaten. Halbiert die Frage, ist er 1 Bit;
 * steht die Antwort praktisch fest, geht er gegen 0. */
function expectedBits(yes, total) {
  const p = yes / total;
  if (p <= 0 || p >= 1) return 0;
  return -(p * log2(p) + (1 - p) * log2(1 - p));
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

// --- Modal ------------------------------------------------------------------
/* Beide Rechnungen beziehen sich auf den AKTUELLEN Rest der Kandidaten,
 * nicht auf die 16 vom Start, und folgen der Schreibweise des Moduls:
 * I = H1 - H2 mit H = log2(Kandidaten). Weil das H2 dieser Frage das H1
 * der naechsten ist, addieren sich die Bits als Teleskopsumme am Ende
 * exakt zu log2(16) = 4. */
function showModal(sentence, answer, bits, expected, before, after, yes) {
  const no = before - yes;
  el("mod-q").textContent = sentence;
  el("mod-a").textContent = answer ? "yes" : "no";
  el("modal").querySelector(".modal-card").className =
    "modal-card " + (answer ? "yes" : "no");
  // Schreibweise wie im Modul: I = H1 - H2 (Unsicherheit vorher/nachher)
  const h1 = log2(before);
  const h2 = log2(after);
  el("mod-bits").textContent = `${bits.toFixed(2)} bits`;
  el("mod-bits-calc").textContent =
    `H₁ = log₂(${before}) = ${h1.toFixed(2)} · ` +
    `H₂ = log₂(${after}) = ${h2.toFixed(2)} · ` +
    `I = H₁ − H₂ = ${bits.toFixed(2)}`;
  el("mod-exp").textContent = `${expected.toFixed(2)} bits`;
  const eh2 = h1 - expected;
  el("mod-exp-calc").textContent = (yes === 0 || no === 0)
    ? `all ${before} would answer the same way — H₂ = H₁, so E[I] = 0`
    : `${yes} would say yes, ${no} no · ` +
      `E[H₂] = ${yes}/${before}·log₂(${yes}) + ` +
      `${no}/${before}·log₂(${no}) = ${eh2.toFixed(2)} · ` +
      `E[I] = H₁ − E[H₂] = ${expected.toFixed(2)}`;
  el("modal").classList.add("show");
}

function hideModal() {
  el("modal").classList.remove("show");
}
el("modal").addEventListener("click", hideModal);

// --- Fragen und Raten -------------------------------------------------------
function ask(qi) {
  if (over || asked[qi]) return;
  const before = aliveCount();
  const yes = CHARS.filter((ch, i) => alive[i] && QUESTIONS[qi].test(ch)).length;
  const expected = expectedBits(yes, before);
  const answer = QUESTIONS[qi].test(CHARS[secret]);
  alive = alive.map((a, i) => a && QUESTIONS[qi].test(CHARS[i]) === answer);
  asked[qi] = true;
  const { after, bits } = bookkeep(before);
  addLog(`${QUESTIONS[qi].label} <b>${answer ? "yes" : "no"}</b> — ` +
         `${before} &rarr; ${after} · ` +
         `<span class="bits">${bits.toFixed(2)} bits</span>`);
  showModal(QUESTIONS[qi].sentence, answer, bits, expected, before, after, yes);
  finishIfDone();
  render();
}

function guess(i) {
  if (over || !alive[i]) return;
  const before = aliveCount();
  const expected = expectedBits(1, before);
  const answer = i === secret;
  if (answer) {
    alive = alive.map((_, j) => j === secret);
  } else {
    alive[i] = false;
  }
  const { after, bits } = bookkeep(before);
  addLog(`is it ${CHARS[i].name}? <b>${answer ? "yes!" : "no"}</b> — ` +
         `${before} &rarr; ${after} · ` +
         `<span class="bits">${bits.toFixed(2)} bits</span>`);
  showModal(`is the person ${CHARS[i].name}?`, answer, bits, expected,
            before, after, 1);
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
  qEls.forEach((b, qi) => { b.disabled = over || asked[qi]; });
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
  hideModal();
  faceEls.forEach((b) => b.classList.remove("secret"));
  render();
}

el("btn-new").addEventListener("click", newGame);

document.addEventListener("keydown", (ev) => {
  if (el("modal").classList.contains("show")) {
    hideModal();
    return;
  }
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (ev.key >= "1" && ev.key <= "9") ask(Number(ev.key) - 1);
  else if (ev.key === "n") newGame();
});

// --- Start ------------------------------------------------------------------
newGame();
