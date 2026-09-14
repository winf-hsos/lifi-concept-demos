/* the scrambler — Verschluesselung mit XOR.
 *
 * Zwei Betriebsarten:
 *
 *   Text: Nachricht und Schluessel eintippen. Jedes Byte der Nachricht wird
 *   mit dem Schluesselbyte darunter per XOR verrechnet (der Schluessel wird
 *   wiederholt). Drei Zeilen zeigen Klartext, Schluessel und das Gesendete;
 *   "decrypt" rechnet mit demselben Schluessel zurueck. Bei einem Schluessel
 *   von einem Byte probiert "try all 256 keys" jeden moeglichen Wert durch und
 *   behaelt den, dessen Ergebnis wie Text aussieht.
 *
 *   Bild: der Papagei (256 x 256, roh 196.608 Byte) mit einem Schluessel von
 *   1, 3 oder 4 Byte, wiederholt, oder mit einem zufaelligen Schluessel so lang
 *   wie das Bild, einmal benutzt. Man sieht, was ein kurzer Schluessel verraet:
 *   gleiche Bytes an gleicher Schluesselstelle ergeben gleiche Bytes, der
 *   Umriss bleibt. Bei einem Byte findet "try all 256 keys" den Schluessel
 *   ueber die Glattheit: Ein Bild hat aehnliche Nachbarn, Rauschen nicht.
 *
 * Adresse: ?mode=text|picture, ?key=<text> (Textmodus), ?k=1|3|4|otp
 * (Bildmodus), ?embed=1 fuer Folien. Kein Framework, kein Build. */

"use strict";

if (new URLSearchParams(location.search).has("embed")) document.body.classList.add("embed");

const el = (id) => document.getElementById(id);
const hex = (b) => b.toString(16).padStart(2, "0");
const enc = new TextEncoder();
const printable = (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "·");
const params = new URLSearchParams(location.search);

// --- Betriebsart ---------------------------------------------------------------
let mode = params.get("mode") === "picture" ? "picture" : "text";

function setMode(m) {
  mode = m;
  document.querySelectorAll(".modes .ctrl").forEach((b) => {
    const aktiv = b.dataset.mode === m;
    b.classList.toggle("is-active", aktiv);
    b.setAttribute("aria-pressed", aktiv ? "true" : "false");
  });
  el("mode-text").hidden = m !== "text";
  el("mode-picture").hidden = m !== "picture";
  if (m === "picture") bildZeichnen();
}
document.querySelectorAll(".modes .ctrl").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

// --- Textmodus -------------------------------------------------------------------
const PRESETS = {
  noon: ["meet at noon", "lifi"],
  one: ["the neighbouring team can read every symbol you send.", "k"],
  zero: ["nothing flips, and you do not notice.", ""],
  long: ["meet at noon", "x9!Qm2#tZp4w"],
};

let brute = null;   // laufender Durchlauf (Textmodus)

function schluesselBytes(text) {
  const k = enc.encode(text);
  return k.length ? k : new Uint8Array([0]);
}

function xor(bytes, key) {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
  return out;
}

function zeile(id, bytes, chars) {
  el(id).innerHTML = Array.from(bytes, (b) => `<span class="b">${hex(b)}</span>`).join("");
  if (chars) el(chars).textContent = Array.from(bytes, printable).join("");
}

/* Wie sehr ein Byte-Array nach Text aussieht: Anteil der Buchstaben, Ziffern,
 * Leerzeichen und ueblichen Satzzeichen. Der richtige Schluessel gewinnt klar. */
function textwert(bytes) {
  let gut = 0;
  for (const b of bytes) {
    if ((b >= 97 && b <= 122) || b === 32) gut += 1;
    else if ((b >= 65 && b <= 90) || (b >= 48 && b <= 57) || ".,;:!?'-\n".includes(String.fromCharCode(b))) gut += 0.8;
  }
  return bytes.length ? gut / bytes.length : 0;
}

function textRechnen() {
  if (brute) { cancelAnimationFrame(brute); brute = null; }
  const text = el("in-text").value;
  const keyText = el("in-key").value;
  const bytes = enc.encode(text);
  const key = schluesselBytes(keyText);
  const rep = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) rep[i] = key[i % key.length];
  const sent = xor(bytes, key);
  zeile("row-plain", bytes);
  zeile("row-key", rep);
  zeile("row-sent", sent, "chars-sent");
  el("row-back-wrap").hidden = true;
  el("tries").hidden = true;
  const v = el("verdict");
  v.className = "verdict";
  if (!bytes.length) { v.textContent = "type a message."; }
  else if (key.every((b) => b === 0)) { v.className = "verdict warn"; v.textContent = "a key of zeros flips nothing: the sent bytes are the plain bytes. you are sending a postcard."; }
  else if (key.length === 1) { v.textContent = `one-byte key ${hex(key[0])}: ${bytes.length} bytes scrambled. only 256 keys like this exist. press the second button.`; }
  else if (key.length >= bytes.length) { v.className = "verdict ok"; v.textContent = `the key is as long as the message and repeats nowhere. used once, this is the one-time pad: nothing to guess, nothing to see.`; }
  else { v.textContent = `${bytes.length} bytes scrambled with a ${key.length}-byte key, repeated ${Math.ceil(bytes.length / key.length)} times. same length as before, not one byte readable.`; }
  el("btn-brute").disabled = key.length !== 1 || key[0] === 0 || !bytes.length;
  el("brute-hint").hidden = key.length === 1 && key[0] !== 0;
  return { bytes, key, sent };
}

el("btn-decrypt").addEventListener("click", () => {
  const { key, sent } = textRechnen();
  const back = xor(sent, key);
  zeile("row-back", back, "chars-back");
  el("row-back-wrap").hidden = false;
  const v = el("verdict");
  v.className = "verdict ok";
  v.textContent = "the same key, the same xor: the bits the key flipped, it flips back. nothing else was ever touched.";
});

el("btn-brute").addEventListener("click", () => {
  const { sent } = textRechnen();
  const box = el("tries");
  box.hidden = false;
  let k = 0, best = { score: -1, k: 0, text: "" };
  const schritt = () => {
    for (let n = 0; n < 6 && k < 256; n++, k++) {
      const back = xor(sent, [k]);
      const s = textwert(back);
      const t = Array.from(back, printable).join("");
      if (s > best.score) best = { score: s, k, text: t };
      box.innerHTML = `try ${String(k + 1).padStart(3)} of 256   key <span class="k">${hex(k)}</span>   ${t.slice(0, 80)}`;
    }
    if (k < 256) { brute = requestAnimationFrame(schritt); return; }
    brute = null;
    box.innerHTML = `256 tries.   key <span class="k">${hex(best.k)}</span> reads as text:\n<span class="found">${best.text}</span>`;
    const v = el("verdict");
    v.className = "verdict";
    v.textContent = `found in a blink. looking like noise is not the same as being noise: one byte of key has 256 values, and a program tries them all.`;
  };
  brute = requestAnimationFrame(schritt);
});

el("in-text").addEventListener("input", textRechnen);
el("in-key").addEventListener("input", textRechnen);
document.querySelectorAll("#presets .ctrl").forEach((b) => b.addEventListener("click", () => {
  const [t, k] = PRESETS[b.dataset.p];
  el("in-text").value = t; el("in-key").value = k; textRechnen();
}));
document.addEventListener("keydown", (e) => {
  if (mode !== "text" || e.target.matches("textarea, input")) return;
  const namen = ["noon", "one", "zero", "long"];
  const i = Number(e.key) - 1;
  if (i >= 0 && i < namen.length) { const [t, k] = PRESETS[namen[i]]; el("in-text").value = t; el("in-key").value = k; textRechnen(); }
});

// --- Bildmodus -------------------------------------------------------------------
const FIX = { 1: [0xa7], 3: [0x5a, 0xc3, 0x96], 4: [0x5a, 0xc3, 0x96, 0x2f] };
let kart = params.get("k") && (FIX[params.get("k")] || params.get("k") === "otp") ? params.get("k") : "3";
let roh = null;          // die 196.608 Bytes des Papageis (RGB)
let otp = null;          // der zufaellige Schluessel, so lang wie das Bild
let bruteBild = null;

function zufallsSchluessel() {
  otp = new Uint8Array(256 * 256 * 3);
  // getRandomValues fuellt hoechstens 65.536 Byte je Aufruf, deshalb in Stuecken
  for (let i = 0; i < otp.length; i += 65536) crypto.getRandomValues(otp.subarray(i, Math.min(i + 65536, otp.length)));
}

function bildLaden() {
  const img = new Image();
  img.onload = () => {
    const cv = el("cv-plain"), ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, 256, 256);
    const data = ctx.getImageData(0, 0, 256, 256).data;
    roh = new Uint8Array(256 * 256 * 3);
    for (let p = 0, q = 0; p < data.length; p += 4, q += 3) { roh[q] = data[p]; roh[q + 1] = data[p + 1]; roh[q + 2] = data[p + 2]; }
    zufallsSchluessel();
    if (mode === "picture") bildZeichnen();
  };
  img.src = "../assets/photos/parrot.png";
}

function bytesAufCanvas(bytes, cv) {
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(256, 256);
  for (let p = 0, q = 0; q < bytes.length; p += 4, q += 3) { img.data[p] = bytes[q]; img.data[p + 1] = bytes[q + 1]; img.data[p + 2] = bytes[q + 2]; img.data[p + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}

function aktuellerSchluessel() {
  return kart === "otp" ? otp : new Uint8Array(FIX[kart]);
}

function bildZeichnen() {
  if (!roh) return;
  if (bruteBild) { cancelAnimationFrame(bruteBild); bruteBild = null; }
  document.querySelectorAll("#mode-picture [data-k]").forEach((b) => b.classList.toggle("is-active", b.dataset.k === kart));
  const key = aktuellerSchluessel();
  const sent = xor(roh, key);
  bytesAufCanvas(sent, el("cv-sent"));
  const kl = el("keyline");
  if (kart === "otp") kl.textContent = `key: ${Array.from(otp.slice(0, 12), hex).join(" ")} … 196,608 random bytes, none of them repeated`;
  else kl.textContent = `key: ${Array.from(key, hex).join(" ")}, repeated ${Math.ceil(roh.length / key.length).toLocaleString("en-US")} times`;
  const v = el("verdict-pic");
  v.className = "verdict";
  if (kart === "1") v.textContent = "one byte of key: every byte flipped the same way. the picture is fully there, and 256 tries find the key anyway.";
  else if (kart === "3") v.textContent = "three bytes, in step with the three colour values: equal bytes give equal bytes. the colours are wrong, the parrot is not.";
  else if (kart === "4") v.textContent = "four bytes run against the three-byte beat of the pixels: stripes, and the parrot still shows through.";
  else { v.className = "verdict ok"; v.textContent = "a random key as long as the picture, used once: noise, provably. and the key is as big as the picture and has to travel too."; }
  el("btn-brute-pic").disabled = kart !== "1";
  el("btn-newkey").hidden = kart !== "otp";
  el("brute-pic-hint").hidden = kart === "1";
}

/* Glattheit: mittlerer Abstand zu rechtem Nachbarn, je Farbwert. Klein bei einem
 * Bild, gross bei Rauschen. Aus jeder vierten Zeile, das reicht. */
function rauheit(bytes) {
  let s = 0, n = 0;
  for (let y = 0; y < 256; y += 4) {
    const z = y * 768;
    for (let i = z; i < z + 768 - 3; i++) { s += Math.abs(bytes[i] - bytes[i + 3]); n++; }
  }
  return s / n;
}

el("btn-brute-pic").addEventListener("click", () => {
  if (!roh) return;
  const sent = xor(roh, new Uint8Array(FIX[1]));
  let k = 0, best = { r: Infinity, k: 0 };
  const t0 = performance.now();
  const v = el("verdict-pic");
  const schritt = () => {
    for (let n = 0; n < 4 && k < 256; n++, k++) {
      const back = xor(sent, [k]);
      const r = rauheit(back);
      if (r < best.r) best = { r, k };
      if (n === 3 || k === 255) bytesAufCanvas(back, el("cv-sent"));
    }
    v.className = "verdict";
    v.textContent = `try ${k} of 256, key ${hex(k - 1)} …`;
    if (k < 256) { bruteBild = requestAnimationFrame(schritt); return; }
    bruteBild = null;
    bytesAufCanvas(xor(sent, [best.k]), el("cv-sent"));
    const ms = Math.round(performance.now() - t0);
    v.className = "verdict ok";
    v.textContent = `key ${hex(best.k)} gives the smoothest picture of all 256. found in ${(ms / 1000).toFixed(1)} s, most of it spent drawing.`;
  };
  bruteBild = requestAnimationFrame(schritt);
});
el("btn-newkey").addEventListener("click", () => { zufallsSchluessel(); bildZeichnen(); });
document.querySelectorAll("#mode-picture [data-k]").forEach((b) => b.addEventListener("click", () => { kart = b.dataset.k; bildZeichnen(); }));

// --- Start -----------------------------------------------------------------------
{
  const [t, k] = PRESETS.noon;
  el("in-text").value = t;
  el("in-key").value = params.has("key") ? params.get("key") : k;
  textRechnen();
  bildLaden();
  setMode(mode);
}
