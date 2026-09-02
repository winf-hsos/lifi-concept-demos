/* byte switchboard — number systems live.
 *
 * Ein Byte als acht schaltbare Bits, alle Darstellungen entstehen live:
 * Summenzeile mit den aktiven Stellenwerten, Binaer in Nibbles, Dezimal,
 * Hex, ASCII-Zeichen und das Byte als vier Farben der LiFi-LED (2 Bit je
 * Farbe, Zuordnung wie im Kurs: rot 00, gruen 01, blau 10, gelb 11).
 * Kein Framework, kein Build: eine Datei, lesbar von oben nach unten. */

"use strict";

const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];        // MSB zuerst
const COLOUR_ALPHABET = [
  { bits: "00", name: "red",    css: "var(--red)" },
  { bits: "01", name: "green",  css: "var(--green)" },
  { bits: "10", name: "blue",   css: "var(--blue)" },
  { bits: "11", name: "yellow", css: "var(--yellow)" },
];

let value = 0b01000001;                                // 65, das grosse A

// --- Aufbau der Bit-Spalten -------------------------------------------------
const bitsBox = document.getElementById("bits");
const bitButtons = [];

WEIGHTS.forEach((weight, i) => {
  const exp = 7 - i;
  const col = document.createElement("div");
  col.className = "bitcol";
  col.innerHTML =
    `<div class="power">2<sup>${exp}</sup></div>` +
    `<div class="weight">${weight}</div>`;
  const btn = document.createElement("button");
  btn.className = "bit";
  btn.setAttribute("aria-label", `bit ${exp}, value ${weight}`);
  btn.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    toggleBit(exp);
    dragging = true;
    dragged.clear();
    dragged.add(exp);
  });
  btn.addEventListener("pointerenter", () => {
    if (dragging && !dragged.has(exp)) {   // Ziehen schaltet jede Kachel einmal
      dragged.add(exp);
      toggleBit(exp);
    }
  });
  col.appendChild(btn);
  bitsBox.appendChild(col);
  bitButtons[exp] = btn;
});

let dragging = false;
const dragged = new Set();
window.addEventListener("pointerup", () => { dragging = false; });

// --- Zustand aendern --------------------------------------------------------
function toggleBit(exp) {
  setValue(value ^ (1 << exp));
}

function setValue(next) {
  const changed = value ^ next;
  value = next & 0xff;
  for (let exp = 0; exp < 8; exp++) {
    if (changed & (1 << exp)) flash(bitButtons[exp]);
  }
  render();
}

function flash(btn) {                    // kurzer gelber Blitz auf geaenderten Bits
  btn.classList.remove("flip");
  void btn.offsetWidth;                  // Animation neu starten
  btn.classList.add("flip");
}

// --- Darstellung ------------------------------------------------------------
const el = (id) => document.getElementById(id);

function render() {
  const bin = value.toString(2).padStart(8, "0");

  bin.split("").forEach((bit, i) => {
    const exp = 7 - i;
    const btn = bitButtons[exp];
    btn.textContent = bit;
    btn.setAttribute("aria-pressed", bit === "1" ? "true" : "false");
    btn.parentElement.querySelector(".weight")
       .classList.toggle("on", bit === "1");
  });

  // Summenzeile: nur die aktiven Stellenwerte
  const parts = WEIGHTS.filter((w, i) => bin[i] === "1");
  el("sum").textContent =
    parts.length ? `= ${parts.join(" + ")} = ${value}` : "= 0";

  el("out-bin").innerHTML =
    `${bin.slice(0, 4)}<span class="dim">&thinsp;</span> ${bin.slice(4)}`;
  el("out-dec").textContent = value;
  el("out-hex").textContent = value.toString(16).toUpperCase().padStart(2, "0");

  const printable = value >= 32 && value <= 126;
  el("out-ascii").textContent = printable ? String.fromCharCode(value) : "–";
  el("out-ascii-note").textContent = printable
    ? `character number ${value} in the ascii agreement`
    : "no printable ascii character at this number";

  // Das Byte als vier Farben (2 Bit je Farbe, MSB zuerst)
  const box = el("out-colours");
  box.innerHTML = "";
  for (let i = 0; i < 8; i += 2) {
    const pair = bin.slice(i, i + 2);
    const colour = COLOUR_ALPHABET.find((c) => c.bits === pair);
    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.style.background = colour.css;
    sw.title = `${pair} = ${colour.name}`;
    box.appendChild(sw);
  }
}

// --- Bedienung --------------------------------------------------------------
el("btn-inc").addEventListener("click", () => setValue(value + 1));
el("btn-dec").addEventListener("click", () => setValue(value - 1));
el("btn-rnd").addEventListener("click", () =>
  setValue(Math.floor(Math.random() * 256)));
el("btn-clr").addEventListener("click", () => setValue(0));

window.addEventListener("keydown", (ev) => {
  if (ev.key >= "1" && ev.key <= "8") toggleBit(8 - Number(ev.key));
  else if (ev.key === "ArrowUp") setValue(value + 1);
  else if (ev.key === "ArrowDown") setValue(value - 1);
  else if (ev.key === "r") setValue(Math.floor(Math.random() * 256));
  else if (ev.key === "0") setValue(0);
  else return;
  ev.preventDefault();
});

render();
