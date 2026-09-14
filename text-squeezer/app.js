/* the text squeezer — Kompression.
 *
 * Ein Textfeld, und beim Tippen wird gepackt, mit denselben zwei Tricks wie
 * in jedem ZIP, nur nachvollziehbar klein gehalten:
 *
 *   Trick eins, zurueckzeigen (Lempel-Ziv): Wiederholtes wird durch einen
 *   Verweis ersetzt, "so viele Zeichen zurueck, so lang". Das Format ist das
 *   der Folie: eine Marke (ein Symbol mehr im Alphabet), 12 Bit Abstand,
 *   8 Bit Laenge. Geschrieben wird ein Verweis nur, wo er weniger kostet als
 *   die Zeichen, die er ersetzt.
 *
 *   Trick zwei, erst zaehlen (Huffman): die Zeichen, die stehen bleiben, und
 *   die Marke bekommen Codes nach Haeufigkeit, das Haeufige kurz. Die Tabelle
 *   dafuer muss mit in die Datei: je moeglichem Zeichen des festen Codes
 *   5 Bit fuer die Codelaenge.
 *
 * Verglichen wird gegen den kleinsten festen Code fuer das Alphabet dieses
 * Texts (5 verschiedene Zeichen: 3 Bit je Zeichen), wie auf den Folien. So
 * sieht man beides: Ein Text aus lauter gleichen Zeichen schrumpft auf fast
 * nichts, und zufaellige Zeichen werden durch die Buchfuehrung sogar groesser.
 *
 * Kein Framework, kein Build. */

"use strict";

// Embed-Modus fuer Folien: ?embed=1 blendet Kopf, Titel, Tastenhinweise, Fuss und Merksatz aus (assets/style.css)
if (new URLSearchParams(location.search).has("embed")) document.body.classList.add("embed");

const el = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("en-US");

// --- Beispieltexte -----------------------------------------------------------
const PARAGRAPH =
  "the fastest transmission is the one where you have less to send. that sounds like a trick, " +
  "and the first time you pack a text file and it comes back at half the size with every character " +
  "intact, it feels like one. nothing was left out. what happened is that the usual way of writing " +
  "things gives space away: some words come round again and again, some letters turn up constantly " +
  "and others almost never, and after a q there is almost always a u. every one of those " +
  "regularities can be said more briefly, and the text survives it untouched.";

function zufallsBuchstaben(n) {
  // genau 32 verschiedene Zeichen, damit der feste Code 5 Bit hat und die
  // Buchfuehrung des Packers ehrlich sichtbar wird
  const zeichen = "abcdefghijklmnopqrstuvwxyz .,;:!";
  let s = "";
  for (let i = 0; i < n; i++) s += zeichen[Math.floor(Math.random() * zeichen.length)];
  return s;
}

function logfile(n) {
  // fast gleiche Zeilen, nur Zeit und Messwerte wechseln: das Futter fuer Trick eins
  let s = "";
  for (let i = 0; i < n; i++) {
    const t = `14:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`;
    const r = 900 + Math.floor(Math.random() * 200), g = 400 + Math.floor(Math.random() * 200), b = 100 + Math.floor(Math.random() * 200);
    s += `2026-09-14 ${t} sensor read r=${r} g=${g} b=${b} clear=${r + g + b}\n`;
  }
  return s;
}

const PRESETS = {
  sentence: () => "the sun shines and the sun warms and the sun sets",
  same: () => "a".repeat(400),
  english: () => PARAGRAPH,
  log: () => logfile(40),
  random: () => zufallsBuchstaben(400),
  bits: () => "0110".repeat(25) + "1001".repeat(25) + "0110".repeat(25) + "1001".repeat(25),
};

// --- Trick eins: zurueckzeigen -----------------------------------------------
/* Das Format ist das der Folie: Ein Verweis ist eine Marke (ein Symbol mehr im
 * Alphabet, kostet so viel wie ein Zeichen), dann 12 Bit Abstand und 8 Bit
 * Laenge. Ein Verweis wird nur geschrieben, wenn er kuerzer ist als das, was
 * er ersetzt; sonst liesse der Packer die Zeichen stehen. */
const FENSTER = 4096, MIN_LAENGE = 3, MAX_LAENGE = 258;
const BIT_ABSTAND = 12, BIT_LAENGE = 8;

/* Gieriges Suchen: an jeder Stelle die laengste Wiederholung im Fenster
 * davor. Kandidaten kommen aus einer Tabelle der Dreierfolgen, damit auch
 * ein langer Text fluessig bleibt. Ergebnis: Liste aus Zeichen (String) und
 * Verweisen ({zurueck, laenge}). `fest` sind die Bits je Zeichen im festen
 * Code; daraus folgt, ab welcher Laenge ein Verweis sich lohnt. */
function zurueckzeigen(text, fest) {
  const bitVerweis = fest + BIT_ABSTAND + BIT_LAENGE;
  const lohntAb = Math.max(MIN_LAENGE, Math.floor(bitVerweis / fest) + 1);
  const tokens = [];
  const stellen = new Map();
  let i = 0;
  while (i < text.length) {
    let besteLaenge = 0, besterAbstand = 0;
    if (i + MIN_LAENGE <= text.length) {
      const schluessel = text.substr(i, MIN_LAENGE);
      const kandidaten = stellen.get(schluessel);
      if (kandidaten) {
        // die juengsten Kandidaten zuerst, hoechstens 64 pruefen
        for (let k = kandidaten.length - 1, n = 0; k >= 0 && n < 64; k--, n++) {
          const start = kandidaten[k];
          if (i - start > FENSTER) break;
          let laenge = 0;
          while (laenge < MAX_LAENGE && i + laenge < text.length && text[start + laenge] === text[i + laenge]) laenge++;
          if (laenge > besteLaenge) { besteLaenge = laenge; besterAbstand = i - start; }
        }
      }
    }
    // ein Verweis muss sich lohnen: mehr sparen, als er kostet
    const schritt = besteLaenge >= lohntAb ? besteLaenge : 1;
    if (besteLaenge >= lohntAb) tokens.push({ zurueck: besterAbstand, laenge: besteLaenge });
    else tokens.push(text[i]);
    for (let j = 0; j < schritt; j++) {
      const p = i + j;
      if (p + MIN_LAENGE <= text.length) {
        const s = text.substr(p, MIN_LAENGE);
        if (!stellen.has(s)) stellen.set(s, []);
        stellen.get(s).push(p);
      }
    }
    i += schritt;
  }
  return tokens;
}

// --- Trick zwei: erst zaehlen ------------------------------------------------
/* Huffman: immer die zwei seltensten zusammenfassen. Liefert je Zeichen die
 * Codelaenge und den Code (nur zum Zeigen; fuer die Bitzahl reicht die Laenge). */
function zaehlenUndCodieren(zeichen) {
  const haeufig = new Map();
  for (const z of zeichen) haeufig.set(z, (haeufig.get(z) || 0) + 1);
  const eintraege = [...haeufig.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (eintraege.length === 0) return { eintraege: [], laengen: new Map(), codes: new Map() };
  if (eintraege.length === 1) {
    // ein einziges Zeichen braucht trotzdem ein Bit, sonst steht nichts in der Datei
    return { eintraege, laengen: new Map([[eintraege[0][0], 1]]), codes: new Map([[eintraege[0][0], "0"]]) };
  }
  let knoten = eintraege.map(([z, n]) => ({ n, z }));
  while (knoten.length > 1) {
    knoten.sort((a, b) => a.n - b.n);
    const a = knoten.shift(), b = knoten.shift();
    knoten.push({ n: a.n + b.n, l: a, r: b });
  }
  const laengen = new Map(), codes = new Map();
  (function ablesen(k, code) {
    if (k.z !== undefined) { laengen.set(k.z, code.length); codes.set(k.z, code); return; }
    ablesen(k.l, code + "0");
    ablesen(k.r, code + "1");
  })(knoten[0], "");
  return { eintraege, laengen, codes };
}

// --- Rechnung ---------------------------------------------------------------
const BIT_CODELAENGE = 5;

const MARKE = "\u0000";   // das eine Symbol mehr im Alphabet: "jetzt kommt ein Verweis"

function rechnen(text) {
  const alphabet = new Set(text).size;
  const fest = Math.max(1, Math.ceil(Math.log2(Math.max(alphabet, 1))));   // Bit je Zeichen im festen Code
  const bitFest = text.length * fest;

  const tokens = zurueckzeigen(text, fest);
  const literale = tokens.filter((t) => typeof t === "string");
  const verweise = tokens.length - literale.length;
  const bitEins = literale.length * fest + verweise * (fest + BIT_ABSTAND + BIT_LAENGE);

  // Trick zwei zaehlt die Zeichen, die stehen bleiben, und die Marke mit;
  // die Tabelle schickt je moeglichem Zeichen des festen Codes eine Codelaenge
  const symbole = literale.concat(Array(verweise).fill(MARKE));
  const huff = zaehlenUndCodieren(symbole);
  let bitCodes = 0;
  for (const z of symbole) bitCodes += huff.laengen.get(z);
  const bitTabelle = (1 << fest) * BIT_CODELAENGE;
  const bitBeide = bitCodes + verweise * (BIT_ABSTAND + BIT_LAENGE) + bitTabelle;

  return { alphabet, fest, bitFest, bitEins, bitBeide, tokens, literale, verweise, huff, bitTabelle };
}

// --- Anzeige ----------------------------------------------------------------
function balken(r, text) {
  const zeilen = [
    ["fixed code", `${r.alphabet} different characters, ${r.fest} bit each (as a file: ${fmt(text.length)} bytes)`, r.bitFest, "fest"],
    ["after trick one", `${r.literale.length} characters stay, ${r.verweise} pointers of ${r.fest + BIT_ABSTAND + BIT_LAENGE} bit`, r.bitEins, "one"],
    ["after both tricks", `plus a code table of ${fmt(r.bitTabelle)} bits`, r.bitBeide, "two"],
  ];
  el("bars").innerHTML = zeilen.map(([name, sub, bits, art]) => {
    const anteil = r.bitFest ? bits / r.bitFest : 0;
    const grow = art !== "fest" && anteil > 1;
    const pct = r.bitFest ? `${Math.round(anteil * 100)} %` : "";
    return `<div class="blabel">${name}<small>${sub}</small></div>` +
           `<div class="track"><div class="fill ${grow ? "grow" : art}" style="width:${Math.min(100, anteil * 100)}%"></div></div>` +
           `<div class="bval">${fmt(bits)} bit${art === "fest" ? "" : ` <span class="pct${grow ? " grow" : ""}">${pct}</span>`}</div>`;
  }).join("");
}

function urteil(r, text) {
  const v = el("verdict");
  if (!text.length) { v.textContent = "type or paste something above."; return; }
  const anteil = r.bitBeide / r.bitFest;
  if (r.alphabet === 1) v.textContent = "one character over and over: a few pointers say it all. this is as small as it gets.";
  else if (anteil > 1 && text.length < 200) v.textContent = "too short: the code table alone costs more than this text can save. the file grows.";
  else if (anteil > 1) v.textContent = "nothing repeats and nothing stands out: the pointers and the code table cost more than they save. the file grows.";
  else if (anteil > 0.85) v.textContent = "a little air, not much: short texts and near-random ones barely pay for the bookkeeping.";
  else if (anteil > 0.5) v.textContent = `${Math.round((1 - anteil) * 100)} % saved, and every character still comes back exactly as it was.`;
  else v.textContent = `${Math.round((1 - anteil) * 100)} % saved: this text is mostly air.`;
}

function tokensZeigen(r) {
  const teile = [];
  let gezeigt = 0;
  for (const t of r.tokens) {
    if (gezeigt > 1500) { teile.push('<span class="ptr" style="color:var(--gray);border-color:var(--gray-dark)">…</span>'); break; }
    if (typeof t === "string") { teile.push(t.replace(/&/g, "&amp;").replace(/</g, "&lt;")); gezeigt += 1; }
    else { teile.push(`<span class="ptr">(${t.zurueck} back, ${t.laenge} long)</span>`); gezeigt += t.laenge; }
  }
  el("tokens").innerHTML = teile.join("") || '<span style="color:var(--gray)">nothing yet</span>';
}

function codesZeigen(r) {
  const zeilen = r.huff.eintraege.slice(0, 10).map(([z, n]) => {
    const sym = z === " " ? "␣" : z === "\n" ? "⏎" : z === MARKE ? "pointer" : z;
    return `<tr><td class="sym">${sym.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td><td>${fmt(n)}</td><td class="code">${r.huff.codes.get(z)}</td><td>${r.huff.laengen.get(z)} bit</td></tr>`;
  });
  const rest = r.huff.eintraege.length - 10;
  if (rest > 0) zeilen.push(`<tr class="more"><td colspan="4">and ${rest} more, all with longer codes</td></tr>`);
  el("codes").innerHTML = zeilen.length
    ? `<tr><th>character</th><th>count</th><th>code</th><th>length</th></tr>${zeilen.join("")}`
    : "";
}

function render() {
  const text = el("in-text").value;
  const r = rechnen(text);
  balken(r, text);
  urteil(r, text);
  tokensZeigen(r);
  codesZeigen(r);
}

// --- Bedienung --------------------------------------------------------------
el("in-text").addEventListener("input", render);

const presets = el("presets");
presets.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  el("in-text").value = PRESETS[b.dataset.p]();
  presets.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  render();
});

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT") return;
  const knoepfe = presets.querySelectorAll("button");
  if (ev.key >= "1" && ev.key <= String(knoepfe.length)) knoepfe[Number(ev.key) - 1].click();
});

// --- Start ------------------------------------------------------------------
/* Startfall aus der Adresse: ?preset=random, damit eine Folie genau den
 * einen Fall zeigt, um den es dort geht. */
const wunsch = new URLSearchParams(location.search).get("preset");
const start = presets.querySelector(`button[data-p="${PRESETS[wunsch] ? wunsch : "sentence"}"]`);
start.click();
