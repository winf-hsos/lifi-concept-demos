/* the noisy sensor — messen und experimentieren.
 *
 * Eine deterministische simulierte Sensorverteilung macht den Unterschied
 * zwischen Einzelwert, Messreihe und gemittelten Ablesungen sichtbar.
 * Kein Framework, kein Build. */

"use strict";

const query = new URLSearchParams(location.search);
if (query.has("embed")) document.body.classList.add("embed");

const plot = document.getElementById("plot");
const empty = document.getElementById("empty");
const meanLine = document.getElementById("mean-line");
const meanLabel = document.getElementById("mean-label");
const histogram = document.getElementById("histogram");
const countEl = document.getElementById("count");
const currentEl = document.getElementById("current");
const meanEl = document.getElementById("mean");
const rangeEl = document.getElementById("range");
const measureButton = document.getElementById("measure");
const resetButton = document.getElementById("reset");

const MIN = 170;
const MAX = 230;
const BINS = 16;
let state = 0x1a2b3c4d;
let averageN = 1;
let outputs = [];

for (let i = 0; i < BINS; i += 1) {
  const bin = document.createElement("div");
  bin.className = "bin";
  histogram.appendChild(bin);
}

function random() {
  state = (1664525 * state + 1013904223) >>> 0;
  return state / 4294967296;
}

function rawReading() {
  const u1 = Math.max(random(), 1e-9);
  const u2 = random();
  const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return 201 + normal * 8.5;
}

function measurement() {
  let sum = 0;
  for (let i = 0; i < averageN; i += 1) sum += rawReading();
  return Math.round((sum / averageN) * 10) / 10;
}

function percent(value) {
  return Math.max(0, Math.min(100, ((value - MIN) / (MAX - MIN)) * 100));
}

function render() {
  plot.querySelectorAll(".point").forEach((point) => point.remove());
  empty.style.display = outputs.length ? "none" : "grid";

  outputs.forEach((value, index) => {
    const point = document.createElement("span");
    point.className = `point ${index === outputs.length - 1 ? "current" : "old"}`;
    point.style.left = `${percent(value)}%`;
    point.style.top = `${38 + (index % 6) * 18}px`;
    point.title = value.toFixed(1);
    plot.appendChild(point);
  });

  const counts = Array(BINS).fill(0);
  outputs.forEach((value) => {
    const index = Math.max(0, Math.min(BINS - 1, Math.floor(((value - MIN) / (MAX - MIN)) * BINS)));
    counts[index] += 1;
  });
  const maxCount = Math.max(1, ...counts);
  [...histogram.children].forEach((bin, index) => {
    bin.style.height = `${(counts[index] / maxCount) * 100}%`;
    bin.style.background = counts[index] ? "var(--gray-light)" : "var(--gray-dark)";
  });

  countEl.textContent = String(outputs.length);
  currentEl.textContent = outputs.length ? outputs.at(-1).toFixed(1) : "—";
  if (!outputs.length) {
    meanEl.textContent = "—";
    rangeEl.textContent = "—";
    meanLine.style.display = "none";
    meanLabel.style.display = "none";
    return;
  }

  const mean = outputs.reduce((sum, value) => sum + value, 0) / outputs.length;
  meanEl.textContent = mean.toFixed(1);
  rangeEl.textContent = `${Math.min(...outputs).toFixed(1)} … ${Math.max(...outputs).toFixed(1)}`;
  meanLine.style.left = `${percent(mean)}%`;
  meanLabel.style.left = `${percent(mean)}%`;
  meanLine.style.display = "block";
  meanLabel.style.display = "block";
}

function measure() {
  outputs.push(measurement());
  if (outputs.length > 48) outputs = outputs.slice(-48);
  render();
}

function reset() {
  state = 0x1a2b3c4d;
  outputs = [];
  render();
}

function setAverage(n) {
  averageN = n;
  document.querySelectorAll(".average").forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.n) === averageN));
  });
  reset();
}

measureButton.addEventListener("click", measure);
resetButton.addEventListener("click", reset);
document.querySelectorAll(".average").forEach((button) => {
  button.addEventListener("click", () => setAverage(Number(button.dataset.n)));
});

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (event.key === " " || event.key.toLowerCase() === "m") {
    event.preventDefault();
    measure();
  } else if (event.key.toLowerCase() === "r") {
    reset();
  } else if (event.key === "1") {
    setAverage(1);
  } else if (event.key === "5") {
    setAverage(5);
  } else if (event.key === "0") {
    setAverage(10);
  }
});

render();

if (new URLSearchParams(window.location.search).has("preview")) {
  for (let i = 0; i < 18; i += 1) measure();
}
