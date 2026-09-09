/* the noisy sensor — messen und experimentieren.
 *
 * Der Sender schickt ein Symbol (led off oder led on), der Empfaenger liest
 * den Sensor und entscheidet an der kalibrierten Schwelle. Dieselben
 * Ablesungen entscheiden dreimal: einzeln, gemittelt ueber fuenf, gemittelt
 * ueber zehn. Sichtbar wird beides zugleich — weniger Fehlentscheidungen,
 * weniger Tempo. Kein Framework, kein Build. */

"use strict";

const query = new URLSearchParams(location.search);
if (query.has("embed")) document.body.classList.add("embed");

const MIN = 0;             // Achse: Sensorwert des Clear-Kanals, willkuerliche Einheiten
const MAX = 100;
const OFF = 35;            // so kommt "led off" an: Umgebungslicht, nie null
const ON = 65;             // so kommt "led on" an
const THRESHOLD = (OFF + ON) / 2;   // die Schwelle aus der Kalibrierung
const RATE = 20;           // Ablesungen je Sekunde bei 50 ms Integrationszeit
const LANES = [1, 5, 10];  // wie viele Ablesungen eine Entscheidung mittelt
const KEEP = 40;           // so viele Symbole bleiben in der Punktwolke
const BIN = 2;             // Breite einer Saeule der Punktwolke, in Achseneinheiten
const SEED = 44;           // gewaehlt, damit die Einzelmessung ihre Fehler frueh zeigt

const lanesEl = document.getElementById("lanes");
const sentEl = document.getElementById("sent").querySelector("b");
const headOff = document.getElementById("head-off");
const headOn = document.getElementById("head-on");
const headThr = document.getElementById("head-thr");

let sigma = 11;
let state = SEED;
let history = [];          // je Symbol: { symbol, values: [v1, v5, v10] }
let sent = 0;
let wrong = LANES.map(() => 0);

function percent(value) {
  return Math.max(0, Math.min(100, ((value - MIN) / (MAX - MIN)) * 100));
}

/* --- die Spuren aufbauen ------------------------------------------------ */

const lanes = LANES.map((n, index) => {
  const name = document.createElement("div");
  name.className = "lane-name";
  name.innerHTML = n === 1
    ? '<span class="n">1 reading</span><span class="sub">decide right away</span>'
    : '<span class="n">average of ' + n + '</span><span class="sub">' + n + ' readings per symbol</span>';

  const lane = document.createElement("div");
  lane.className = "lane";
  lane.innerHTML = '<div class="region off"></div><div class="region on"></div>'
    + '<div class="centre off"></div><div class="centre on"></div><div class="thrline"></div>';

  const stats = document.createElement("div");
  stats.className = "lane-stats";
  stats.innerHTML = '<div class="wrong"><b>0</b> of 0 wrong</div>'
    + '<div class="sub"><span class="readings">0</span> readings · ' + (RATE / n) + ' sym/s</div>';

  lanesEl.append(name, lane, stats);
  return {
    n,
    index,
    lane,
    wrongEl: stats.querySelector(".wrong"),
    wrongNum: stats.querySelector(".wrong b"),
    readingsEl: stats.querySelector(".readings"),
  };
});

const axisSpacer = document.createElement("div");
axisSpacer.className = "axis-name";
axisSpacer.textContent = "sensor value";
const axis = document.createElement("div");
axis.className = "axis";
[[MIN, "start"], [25, ""], [50, ""], [75, ""], [MAX, "end"]].forEach(([value, cls]) => {
  const tick = document.createElement("span");
  tick.className = cls;
  tick.style.left = percent(value) + "%";
  tick.textContent = String(value);
  axis.appendChild(tick);
});
lanesEl.append(axisSpacer, axis, document.createElement("div"));

/* --- Zufall: deterministisch, damit dieselbe Vorfuehrung reproduzierbar ist */

function random() {
  state = (1664525 * state + 1013904223) >>> 0;
  return state / 4294967296;
}

function gauss() {
  const u1 = Math.max(random(), 1e-9);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/* --- ein Symbol senden, empfangen, entscheiden -------------------------- */

function send() {
  const symbol = random() < 0.5 ? "on" : "off";
  const centre = symbol === "on" ? ON : OFF;
  // zehn Ablesungen; jede Spur benutzt davon so viele, wie sie mittelt
  const readings = [];
  for (let i = 0; i < 10; i += 1) readings.push(centre + gauss() * sigma);

  const values = LANES.map((n) => {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += readings[i];
    return sum / n;
  });

  values.forEach((value, index) => {
    const decision = value > THRESHOLD ? "on" : "off";
    if (decision !== symbol) wrong[index] += 1;
  });

  sent += 1;
  history.push({ symbol, values });
  if (history.length > KEEP) history = history.slice(-KEEP);
  sentEl.textContent = symbol === "on" ? "led on" : "led off";
}

/* --- Anzeige ------------------------------------------------------------ */

function renderScene() {
  lanes.forEach(({ lane }) => {
    lane.querySelector(".region.off").style.width = percent(THRESHOLD) + "%";
    lane.querySelector(".region.on").style.width = (100 - percent(THRESHOLD)) + "%";
    lane.querySelector(".centre.off").style.left = percent(OFF) + "%";
    lane.querySelector(".centre.on").style.left = percent(ON) + "%";
    lane.querySelector(".thrline").style.left = percent(THRESHOLD) + "%";
  });
  headOff.style.left = percent(OFF) + "%";
  headOn.style.left = percent(ON) + "%";
  headThr.style.left = percent(THRESHOLD) + "%";
}

function render() {
  lanes.forEach(({ n, index, lane, wrongEl, wrongNum, readingsEl }) => {
    lane.querySelectorAll(".dot").forEach((dot) => dot.remove());
    // erst zaehlen, wie hoch die hoechste Saeule wird, dann die Zeilenhoehe
    // so waehlen, dass auch sie noch in die Spur passt
    const heights = new Map();
    history.forEach((entry) => {
      const bin = Math.round(entry.values[index] / BIN);
      heights.set(bin, (heights.get(bin) || 0) + 1);
    });
    const tallest = Math.max(1, ...heights.values());
    const step = Math.min(9, (lane.clientHeight - 16) / tallest);

    const stacks = new Map();
    history.forEach((entry, position) => {
      const value = entry.values[index];
      const bin = Math.round(value / BIN);
      const row = stacks.get(bin) || 0;
      stacks.set(bin, row + 1);

      const dot = document.createElement("span");
      const decision = value > THRESHOLD ? "on" : "off";
      const isWrong = decision !== entry.symbol;
      dot.className = "dot" + (isWrong ? " wrong" : "") + (position === history.length - 1 ? " current" : "");
      dot.style.left = percent(value) + "%";
      dot.style.bottom = (8 + row * step) + "px";
      dot.title = value.toFixed(1) + " · sent " + entry.symbol + ", read " + decision;
      lane.appendChild(dot);
    });

    wrongNum.textContent = String(wrong[index]);
    wrongEl.lastChild.textContent = " of " + sent + " wrong";
    wrongEl.classList.toggle("some", wrong[index] > 0);
    readingsEl.textContent = String(sent * n);
  });
}

function reset() {
  state = SEED;
  history = [];
  sent = 0;
  wrong = LANES.map(() => 0);
  sentEl.textContent = "—";
  render();
}

function setNoise(value, button) {
  sigma = value;
  document.querySelectorAll(".noise").forEach((other) => {
    other.setAttribute("aria-pressed", String(other === button));
  });
  reset();
}

/* --- Bedienung ---------------------------------------------------------- */

document.getElementById("send").addEventListener("click", () => { send(); render(); });
document.getElementById("burst").addEventListener("click", () => {
  for (let i = 0; i < 25; i += 1) send();
  render();
});
document.getElementById("reset").addEventListener("click", reset);
document.querySelectorAll(".noise").forEach((button) => {
  button.addEventListener("click", () => setNoise(Number(button.dataset.sigma), button));
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === " " || key === "s") {
    event.preventDefault();
    send();
    render();
  } else if (key === "b") {
    for (let i = 0; i < 25; i += 1) send();
    render();
  } else if (key === "r") {
    reset();
  } else if (key === "1" || key === "2" || key === "3") {
    const button = document.querySelectorAll(".noise")[Number(key) - 1];
    setNoise(Number(button.dataset.sigma), button);
  }
});

// Startfall aus der Adresse, damit eine Folie genau einen Fall zeigt
const wanted = document.querySelector('.noise[data-name="' + (query.get("noise") || "") + '"]');
if (wanted) setNoise(Number(wanted.dataset.sigma), wanted);

renderScene();
render();

if (query.has("preview")) {
  for (let i = 0; i < 30; i += 1) send();
  render();
}
