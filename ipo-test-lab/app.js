/* the ipo test lab — probleme loesen mit computern.
 *
 * Vier Sensorwerte sind die Eingabe. Eine kleine, veraenderbare Regel
 * klassifiziert sie als Farbe, Dunkelheit oder uneindeutig. Die Ausgabe
 * wird mit der erwarteten Ausgabe verglichen: Eingabe plus Erwartung
 * machen den Kasten testbar. Kein Framework, kein Build. */

"use strict";

// Embed-Modus fuer Folien: ?embed=1 blendet Kopf, Titel, Hinweise, Fuss und Merksatz aus.
const query = new URLSearchParams(location.search);
if (query.has("embed")) document.body.classList.add("embed");

const PRESETS = {
  clear: { r: 203, g: 41, b: 57, c: 310, expected: "red" },
  weak: { r: 72, g: 19, b: 25, c: 104, expected: "red" },
  mixed: { r: 150, g: 135, b: 60, c: 310, expected: "red" },
  dark: { r: 5, g: 4, b: 5, c: 12, expected: "off" },
};

const inputIds = ["r", "g", "b", "c", "min-light", "min-lead"];
const controls = Object.fromEntries(inputIds.map((id) => [id, document.getElementById(id)]));
const values = Object.fromEntries(inputIds.map((id) => [id, document.getElementById(`${id}-value`)]));
const actual = document.getElementById("actual");
const result = document.getElementById("result");
const resultMark = document.getElementById("result-mark");
const resultLabel = document.getElementById("result-label");
const trace = document.getElementById("trace");
const preview = document.getElementById("sensor-preview");
let expected = "red";

function classify(r, g, b, clear, minLight, minLead) {
  if (clear < minLight) return "off";
  const ranked = [["red", r], ["green", g], ["blue", b]]
    .sort((a, b2) => b2[1] - a[1]);
  if (ranked[0][1] - ranked[1][1] < minLead) return "uncertain";
  return ranked[0][0];
}

function selectButtons(attribute, selected) {
  document.querySelectorAll(`[${attribute}]`).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset[attribute.slice(5)] === selected));
  });
}

function render() {
  inputIds.forEach((id) => { values[id].textContent = controls[id].value; });
  const r = Number(controls.r.value);
  const g = Number(controls.g.value);
  const b = Number(controls.b.value);
  const c = Number(controls.c.value);
  const output = classify(
    r, g, b, c,
    Number(controls["min-light"].value),
    Number(controls["min-lead"].value),
  );

  actual.textContent = output;
  actual.className = `actual ${output}`;
  const passes = output === expected;
  result.className = `result ${passes ? "pass" : "fail"}`;
  resultMark.textContent = passes ? "✓" : "×";
  resultLabel.textContent = passes ? "pass" : "fail";
  trace.textContent = `(${r}, ${g}, ${b}, ${c}) → ${output}`;

  const alpha = Math.max(0.08, Math.min(1, c / 320));
  preview.style.background = `rgb(${r} ${g} ${b} / ${alpha})`;
  preview.style.boxShadow = `0 0 34px rgb(${r} ${g} ${b} / ${Math.max(0.12, alpha * 0.65)})`;
}

function setExpected(next) {
  expected = next;
  selectButtons("data-expected", expected);
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  ["r", "g", "b", "c"].forEach((id) => { controls[id].value = preset[id]; });
  setExpected(preset.expected);
  selectButtons("data-preset", name);
  render();
}

inputIds.forEach((id) => controls[id].addEventListener("input", () => {
  document.querySelectorAll("[data-preset]").forEach((button) => button.setAttribute("aria-pressed", "false"));
  render();
}));

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

document.querySelectorAll("[data-expected]").forEach((button) => {
  button.addEventListener("click", () => {
    setExpected(button.dataset.expected);
    render();
  });
});

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  const names = { "1": "clear", "2": "weak", "3": "mixed", "4": "dark" };
  if (names[event.key]) applyPreset(names[event.key]);
});

applyPreset(query.get("preset") || "clear");
