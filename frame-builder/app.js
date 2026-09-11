/* frame builder: den Rahmen um eine Nachricht selbst zusammenstecken.
 *
 * Der Empfaenger laeuft, bevor der Sender anfaengt, und sieht dauernd Licht.
 * Gezeigt wird, was Praeambel und Endregel daran aendern:
 *
 *   - ohne Praeambel findet er nichts,
 *   - mit einem einzelnen Rot faellt er auf das Zimmerlicht herein,
 *   - ohne Endregel bleibt er nach der ersten Nachricht im Zustand "reading"
 *     stehen und verpasst die zweite.
 *
 * Die Daten benutzen zwei Farben (rot = 0, blau = 1, acht Bit je Zeichen), die
 * Endmarke eine dritte, reservierte Farbe. So kann sie in den Daten nicht
 * vorkommen; genau das ist der Punkt an einem reservierten Symbol.
 */

"use strict";

// Embed-Modus fuer Folien: ?embed=1 blendet Kopf, Titel, Tastenhinweise, Fuss und Merksatz aus
const PARAMS = new URLSearchParams(location.search);
if (PARAMS.has("embed")) document.body.classList.add("embed");

const $ = (id) => document.getElementById(id);

const ROT = 0, BLAU = 1, MARKE = 2, RAUSCHEN = 3;
const FARBEN = {
  [ROT]:      "#e0322f",
  [BLAU]:     "#2f7de0",
  [MARKE]:    "#3ba55d",
  [RAUSCHEN]: "#3a3f45",
};

const PRAEAMBELN = {
  none:   [],
  single: [ROT],
  alt3:   [ROT, BLAU, ROT, BLAU, ROT, BLAU],
};
const ENDMARKE = [MARKE, MARKE, MARKE];

let wahl = { pre: "alt3", end: "marker", msg: "SONNE" };
let strom = [];          // die Symbole, die ueber die Strecke gehen
let gesendet = [];       // die Nachrichten, die der Sender geschickt hat
let pos = 0;             // wie weit der Empfaenger gelesen hat
let laeuft = false;
let timer = null;

/* --- Der Sender ----------------------------------------------------------- */

// Ein Zeichen sind acht Bit, ein Bit ist ein Symbol.
function zeichenZuSymbolen(text) {
  const raus = [];
  for (const z of text) {
    const bits = z.charCodeAt(0).toString(2).padStart(8, "0");
    for (const b of bits) raus.push(b === "1" ? BLAU : ROT);
  }
  return raus;
}

function symboleZuText(symbole) {
  let raus = "";
  for (let i = 0; i + 8 <= symbole.length; i += 8) {
    let wert = 0;
    for (let k = 0; k < 8; k++) wert = wert * 2 + (symbole[i + k] === BLAU ? 1 : 0);
    raus += String.fromCharCode(wert);
  }
  return raus;
}

// Fester Pseudozufall, damit dieselbe Einstellung immer dasselbe Bild ergibt.
let saat = 20260911;
function zufall() {
  saat = (saat * 1103515245 + 12345) % 2147483648;
  return saat / 2147483648;
}

// Das Zimmer ist nie dunkel, und sein Licht ist warm: manchmal sieht es aus wie
// Rot, fast nie wie Blau. Deshalb ist ein einzelnes Rot als Anfangsmuster
// unbrauchbar und ein Wechsel aus zwei aktiven Farben brauchbar.
function rauschen(n) {
  const raus = [];
  for (let i = 0; i < n; i++) {
    const w = zufall();
    raus.push(w < 0.12 ? ROT : w < 0.14 ? BLAU : RAUSCHEN);
  }
  return raus;
}

function rahmen(text) {
  const daten = zeichenZuSymbolen(text);
  const teile = [...PRAEAMBELN[wahl.pre]];
  if (wahl.end === "length") teile.push(...zeichenZuSymbolen(String.fromCharCode(text.length)));
  teile.push(...daten);
  if (wahl.end === "marker") teile.push(...ENDMARKE);
  return { symbole: teile, nutz: daten.length };
}

function bauen() {
  saat = 20260911;
  const eins = rahmen(wahl.msg), zwei = rahmen(wahl.msg);
  strom = [...rauschen(30), ...eins.symbole, ...rauschen(20), ...zwei.symbole, ...rauschen(25)];
  gesendet = [wahl.msg, wahl.msg];
  pos = 0;
  empfaenger = neuerEmpfaenger();
  zeichnen();
  anzeigen();
}

/* --- Der Empfaenger ------------------------------------------------------- */

function neuerEmpfaenger() {
  return {
    zustand: "waiting",
    gesehen: 0,        // wie viel von der Praeambel schon passt
    puffer: [],
    laenge: null,      // erwartete Zeichenzahl, wenn ein Laengenfeld benutzt wird
    fehlstarts: 0,
    gelesen: [],
  };
}
let empfaenger = neuerEmpfaenger();

function schritt() {
  if (pos >= strom.length) return false;
  const s = strom[pos++];
  const e = empfaenger;
  const muster = PRAEAMBELN[wahl.pre];

  if (e.zustand === "waiting") {
    // Ohne vereinbartes Muster gibt es nichts zu erkennen.
    if (muster.length === 0) return true;
    e.gesehen = s === muster[e.gesehen] ? e.gesehen + 1 : (s === muster[0] ? 1 : 0);
    if (e.gesehen === muster.length) {
      e.zustand = "reading";
      e.gesehen = 0;
      e.puffer = [];
      e.laenge = null;
    }
    return true;
  }

  // Zustand "reading": alles anhaengen, bis die vereinbarte Endregel greift.
  e.puffer.push(s);

  if (wahl.end === "length") {
    if (e.laenge === null && e.puffer.length === 8) {
      e.laenge = parseInt(e.puffer.map((x) => (x === BLAU ? "1" : "0")).join(""), 2);
      e.puffer = [];
    } else if (e.laenge !== null && e.puffer.length === e.laenge * 8) {
      fertig(symboleZuText(e.puffer));
    }
    return true;
  }

  if (wahl.end === "marker") {
    const n = e.puffer.length;
    if (n >= ENDMARKE.length && ENDMARKE.every((m, i) => e.puffer[n - ENDMARKE.length + i] === m)) {
      fertig(symboleZuText(e.puffer.slice(0, n - ENDMARKE.length)));
    }
    return true;
  }
  // wahl.end === "none": er wartet auf ein Ende, das nie kommt.
  return true;
}

function fertig(text) {
  const e = empfaenger;
  e.gelesen.push(text);
  e.zustand = "waiting";
  e.puffer = [];
  e.laenge = null;
}

// Ein Fehlstart ist ein Wechsel nach "reading", der nicht an einer echten
// Nachricht lag. Er wird nachtraeglich erkannt: Was dabei herauskommt, ist
// kein gesendeter Text.
function bewertung() {
  const e = empfaenger;
  const richtig = e.gelesen.filter((t) => gesendet.includes(t)).length;
  const falsch = e.gelesen.length - richtig;
  return { richtig, falsch };
}

/* --- Anzeige -------------------------------------------------------------- */

function zeichnen() {
  const c = $("lab");
  const breite = c.clientWidth, hoehe = c.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  c.width = breite * dpr; c.height = hoehe * dpr;
  const g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, breite, hoehe);

  const zellen = Math.max(20, Math.floor(breite / 11));
  const zw = breite / zellen;
  const von = Math.max(0, Math.min(pos - Math.floor(zellen * 0.7), strom.length - zellen));
  const y = 34, h = hoehe - 62;

  for (let i = 0; i < zellen; i++) {
    const idx = von + i;
    if (idx >= strom.length) break;
    g.fillStyle = FARBEN[strom[idx]];
    g.globalAlpha = idx < pos ? 1 : 0.35;
    g.fillRect(i * zw + 1, y, zw - 2, h);
  }
  g.globalAlpha = 1;

  // Der Lesekopf: wo der Empfaenger gerade steht
  if (pos > von && pos <= von + zellen) {
    const x = (pos - von) * zw;
    g.strokeStyle = "#ffd23f"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x, y + h + 10); g.stroke();
  }
  g.fillStyle = "#7d868f";
  g.font = "12px 'Roboto Mono', monospace";
  g.fillText("the receiver reads left to right", 2, 16);
}

function anzeigen() {
  const e = empfaenger;
  const fertig = pos >= strom.length;
  $("st-waiting").classList.toggle("on", e.zustand === "waiting");
  $("st-reading").classList.toggle("on", e.zustand === "reading" && !fertig);
  $("st-stuck").classList.toggle("on", e.zustand === "reading" && fertig);

  $("ln-sent").textContent = gesendet.join("  |  ");
  const b = bewertung();
  $("ln-got").textContent = e.gelesen.length ? e.gelesen.join("  |  ") : (fertig ? "nothing" : "");
  $("ln-got-row").className = "line" + (fertig ? (b.richtig === 2 && b.falsch === 0 ? " good" : " bad") : "");

  $("st-false").textContent = String(b.falsch);
  $("st-read").textContent = b.richtig + " of 2";

  const r = rahmen(wahl.msg);
  const ohne = r.symbole.length - r.nutz;
  $("st-over").textContent = r.symbole.length ? Math.round((ohne / r.symbole.length) * 100) + " %" : "0 %";
  $("st-over-note").textContent = ohne + " of " + r.symbole.length + " symbols per message";
}

/* --- Bedienung ------------------------------------------------------------ */

function laufen(an) {
  laeuft = an;
  $("btn-run").textContent = an ? "pause" : "run";
  clearInterval(timer);
  if (an) {
    timer = setInterval(() => {
      for (let i = 0; i < 3; i++) if (!schritt()) { laufen(false); break; }
      zeichnen(); anzeigen();
    }, 60);
  }
}

function waehlen(reihe, feld) {
  const kasten = $(reihe);
  kasten.addEventListener("click", (ev) => {
    const knopf = ev.target.closest(".opt");
    if (!knopf) return;
    wahl[feld] = knopf.dataset.value;
    [...kasten.querySelectorAll(".opt")].forEach((k) =>
      k.setAttribute("aria-pressed", String(k.dataset.value === wahl[feld])));
    laufen(false);
    bauen();
  });
  [...kasten.querySelectorAll(".opt")].forEach((k) =>
    k.setAttribute("aria-pressed", String(k.dataset.value === wahl[feld])));
}

waehlen("ch-pre", "pre");
waehlen("ch-end", "end");
waehlen("ch-msg", "msg");

$("btn-run").addEventListener("click", () => laufen(!laeuft));
$("btn-step").addEventListener("click", () => { laufen(false); schritt(); zeichnen(); anzeigen(); });
$("btn-reset").addEventListener("click", () => { laufen(false); bauen(); });
window.addEventListener("resize", zeichnen);
document.addEventListener("keydown", (ev) => {
  if (ev.key === " ") { ev.preventDefault(); laufen(!laeuft); }
  if (ev.key === "n") { laufen(false); schritt(); zeichnen(); anzeigen(); }
  if (ev.key === "r") { laufen(false); bauen(); }
});

// Startwerte aus der Adresse, damit eine Folie eine bestimmte Lage zeigen kann
for (const [schluessel, feld] of [["pre", "pre"], ["end", "end"], ["msg", "msg"]]) {
  const wert = PARAMS.get(schluessel);
  if (wert) wahl[feld] = wert;
}
["ch-pre", "ch-end", "ch-msg"].forEach((id, i) => {
  const feld = ["pre", "end", "msg"][i];
  [...$(id).querySelectorAll(".opt")].forEach((k) =>
    k.setAttribute("aria-pressed", String(k.dataset.value === wahl[feld])));
});
bauen();
