/* the prefix trap — codesysteme.
 *
 * Der Besucher legt die Codewoerter fuer a, b, c und d selbst fest und
 * tippt ein Wort. Die Demo sendet nur die Bitfolge und zeigt danach
 * ALLE Zerlegungen, die der Empfaenger daraus lesen koennte. Solange
 * ein Codewort am Anfang eines anderen steht, sind es mehrere.
 *
 * Die Demo sagt nicht, wie man es richtig macht. Sie meldet nur den
 * Befund (welches Codewort welches beginnt); den praefixfreien Code
 * baut der Besucher selbst, und die Liste schrumpft dabei auf eins.
 *
 * Startwerte lassen sich in der Adresse setzen, damit eine Folie genau
 * einen Fall zeigt: ?a=0&b=01&c=10&d=11&word=bad
 *
 * Kein Framework, kein Build. */

"use strict";

// Embed-Modus fuer Folien: ?embed=1 blendet Kopf, Titel, Tastenhinweise, Fuss und Merksatz aus (assets/style.css)
const PARAMS = new URLSearchParams(location.search);
if (PARAMS.has("embed")) document.body.classList.add("embed");

const LETTERS = ["a", "b", "c", "d"];
const START = { a: "0", b: "01", c: "10", d: "11" };
const START_WORD = "bad";

const MAX_BITS = 5;      // laenger als fuenf Stellen wird unuebersichtlich
const MAX_LETTERS = 8;   // laengere Woerter lassen die Zahl der Lesarten explodieren
const MAX_SHOWN = 12;    // so viele Lesarten werden gezeigt, der Rest nur gezaehlt
const MAX_FOUND = 400;   // Abbruch der Suche, damit die Seite nie haengt

/* Zustand: je Buchstabe ein Codewort, dazu das getippte Wort. */
const code = {};
let word = "";
const startCode = {};
let startWord = "";

const $ = (id) => document.getElementById(id);
const inputs = {};

/* ---------------------------------------------------------------- Aufbau */

function buildBook() {
  const book = $("book");
  for (const ch of LETTERS) {
    const label = document.createElement("span");
    label.className = "ch";
    label.textContent = ch;

    const eq = document.createElement("span");
    eq.className = "eq";
    eq.textContent = "=";

    const input = document.createElement("input");
    input.type = "text";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.setAttribute("aria-label", "code word for " + ch);
    input.addEventListener("input", () => {
      // nur Nullen und Einsen, hoechstens MAX_BITS Stellen
      const clean = input.value.replace(/[^01]/g, "").slice(0, MAX_BITS);
      if (clean !== input.value) input.value = clean;
      code[ch] = clean;
      render();
    });

    inputs[ch] = input;
    book.append(label, eq, input);
  }
}

/* Der Startzustand: die Vorbelegung, sofern die Adresse nichts anderes
 * sagt. "back to the start" fuehrt genau hierhin zurueck, also auf einer
 * Folie zu dem Fall, den die Folie zeigen soll. */
function setFromParams() {
  for (const ch of LETTERS) {
    const given = (PARAMS.get(ch) || "").replace(/[^01]/g, "").slice(0, MAX_BITS);
    startCode[ch] = given || START[ch];
  }
  const givenWord = (PARAMS.get("word") || "").toLowerCase().replace(/[^a-d]/g, "").slice(0, MAX_LETTERS);
  startWord = givenWord || START_WORD;
}

function toStart() {
  for (const ch of LETTERS) { code[ch] = startCode[ch]; inputs[ch].value = code[ch]; }
  word = startWord;
  $("word").value = word;
  render();
}

/* ------------------------------------------------------- Die eigentliche Frage */

/* Alle Zerlegungen einer Bitfolge in Codewoerter, als Liste von
 * Buchstabenfolgen. Rekursiv: an jeder Stelle jedes Codewort probieren,
 * das dort passt. Ohne Codewoerter oder mit leerem Codewort gibt es
 * nichts zu suchen. */
function allReadings(bits, book) {
  const usable = LETTERS.filter((ch) => book[ch]);
  const found = [];

  function walk(pos, taken) {
    if (found.length >= MAX_FOUND) return;
    if (pos === bits.length) {
      found.push(taken.slice());
      return;
    }
    for (const ch of usable) {
      const cw = book[ch];
      if (bits.startsWith(cw, pos)) {
        taken.push(ch);
        walk(pos + cw.length, taken);
        taken.pop();
      }
    }
  }

  if (usable.length) walk(0, []);
  return found;
}

/* Welches Codewort steht am Anfang welches anderen? Genau das erzeugt
 * die Mehrdeutigkeit, und genau das meldet die Demo. Gleiche Codewoerter
 * sind der Sonderfall davon. */
function clashes(book) {
  const out = [];
  for (const x of LETTERS) {
    for (const y of LETTERS) {
      if (x === y || !book[x] || !book[y]) continue;
      if (book[x] === book[y]) {
        if (x < y) out.push({ a: x, b: y, same: true });
      } else if (book[y].startsWith(book[x])) {
        out.push({ a: x, b: y, same: false });
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------------- Anzeige */

function render() {
  const missing = LETTERS.filter((ch) => !code[ch]);
  const used = [...new Set(word.split(""))];
  const bits = word.split("").map((ch) => code[ch] || "").join("");

  // die gesendete Bitfolge, ohne jede Gruppierung: so kommt sie an
  $("sent").textContent = bits || "—";
  const missingUsed = used.filter((ch) => !code[ch]);
  $("sentnote").textContent = missingUsed.length
    ? "no code word for " + missingUsed.join(", ") + " — nothing is sent for it"
    : bits
      ? bits.length + " bits on the wire, with no gaps"
      : "type a word made of a, b, c and d";

  const conflicts = clashes(code);
  const clashing = new Set();
  for (const c of conflicts) { clashing.add(c.a); clashing.add(c.b); }
  for (const ch of LETTERS) inputs[ch].classList.toggle("clash", clashing.has(ch));

  const readings = bits ? allReadings(bits, code) : [];
  showVerdict(readings, bits);
  showReadings(readings, bits);
  showWhy(conflicts, readings, missing);
}

function showVerdict(readings, bits) {
  const el = $("verdict");
  if (!bits) { el.textContent = ""; el.className = "verdict"; return; }
  const n = readings.length;
  const capped = n >= MAX_FOUND;
  if (n === 1) {
    el.className = "verdict unique";
    el.innerHTML = '<span class="mark">&check;</span>one reading. the receiver cannot get it wrong.';
  } else if (n === 0) {
    el.className = "verdict";
    el.innerHTML = '<span class="mark">&times;</span>no reading at all. these bits are not a word in your code.';
  } else {
    el.className = "verdict";
    el.innerHTML = '<span class="mark">&times;</span>' + (capped ? "more than " + MAX_FOUND : n) +
      " readings. the receiver has to pick one.";
  }
}

function showReadings(readings, bits) {
  const box = $("readings");
  box.textContent = "";
  const shown = readings.slice(0, MAX_SHOWN);

  for (const letters of shown) {
    const row = document.createElement("div");
    row.className = "reading" + (readings.length === 1 ? " only" : "");

    const bitsEl = document.createElement("span");
    bitsEl.className = "bits";
    letters.forEach((ch, i) => {
      const chunk = document.createElement("span");
      chunk.className = "chunk" + (i % 2 ? " alt" : "");
      chunk.textContent = code[ch];
      bitsEl.append(chunk);
      if (i < letters.length - 1) {
        const gap = document.createElement("span");
        gap.className = "chunk alt";
        gap.textContent = " ";
        bitsEl.append(gap);
      }
    });

    const wordEl = document.createElement("span");
    wordEl.className = "word";
    wordEl.textContent = letters.join(" ");

    row.append(bitsEl, wordEl);
    box.append(row);
  }

  const rest = readings.length - shown.length;
  $("more").textContent = rest > 0 ? "and " + rest + " more" : "";
  void bits;
}

function showWhy(conflicts, readings, missing) {
  const el = $("why");
  el.textContent = "";
  if (missing.length === LETTERS.length) return;

  const parts = [];
  if (conflicts.length) {
    const list = conflicts.map((c) => c.same
      ? "<li><span class=\"bad\">" + c.a + " and " + c.b + " share the same code word " + code[c.a] + "</span></li>"
      : "<li><span class=\"bad\">" + code[c.a] + " (" + c.a + ") starts " + code[c.b] + " (" + c.b + ")</span></li>");
    parts.push("<div>where the trouble comes from:</div><ul>" + list.join("") + "</ul>");
  } else if (readings.length === 1) {
    parts.push("<div>no code word starts another one. that is all it takes.</div>");
  }
  if (missing.length) {
    parts.push("<div>no code word yet for: " + missing.join(", ") + "</div>");
  }
  el.innerHTML = parts.join("");
}

/* ---------------------------------------------------------------- Bedienung */

$("word").addEventListener("input", (e) => {
  const clean = e.target.value.toLowerCase().replace(/[^a-d]/g, "").slice(0, MAX_LETTERS);
  if (clean !== e.target.value) e.target.value = clean;
  word = clean;
  render();
});

$("btn-reset").addEventListener("click", toStart);

buildBook();
setFromParams();
toStart();
