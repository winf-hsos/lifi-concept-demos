/* drift simulator — abtastung und synchronisation.
 *
 * Der Sender legt eine Nachricht Zeichen fuer Zeichen in feste
 * Zeitschlitze. Der Empfaenger tastet in der Mitte jedes Schlitzes ab,
 * glaubt er — denn seine Uhr geht um einen einstellbaren Prozentsatz
 * falsch. Der Versatz waechst mit jedem Symbol, die Abtastpunkte
 * wandern sichtbar aus den Schlitzen, und das Empfangsprotokoll kippt
 * in Zeichensalat: Symbole werden doppelt gelesen oder uebersprungen.
 *
 * Der Schalter fuer die wiederkehrende Marke zeigt den Ausweg: Alle n
 * Symbole opfert der Sender einen Schlitz fuer eine Marke, an der sich
 * der Empfaenger neu ausrichtet. Der Versatz wird zum Saegezahn, die
 * Marke kostet sichtbar Rate. WIE der Empfaenger die Marke im Signal
 * erkennt, bleibt hier ausgeklammert; die Demo zeigt nur, was das
 * Neuausrichten bewirkt.
 *
 * Anzeige als Sweep wie im distinguishability lab: Der Schreibkopf
 * laeuft von links nach rechts, nichts scrollt, am Rand beginnt eine
 * neue Bildschirmseite. Kein Framework, kein Build. */

"use strict";

// --- Modell -----------------------------------------------------------------
const T = 100;                   // ms je Zeitschlitz (Senderuhr, fix)
const MSG = "HELLO WORLD ";      // die Nachricht, endlos wiederholt
const MARKER = "◆";         // Markenzeichen im Schlitz
const HISTORY = 100;             // Lesungen fuer die Fehlerquote
const TRANSCRIPT = 64;           // Laenge der Protokollzeilen

const state = {
  err: 0.02,                     // Uhrenfehler des Empfaengers (Anteil)
  markerEvery: 0,                // 0 = keine Marken
  speed: 0.4,                    // Zeitlupe: Anteil der Echtzeit
  paused: false,
};

/* Schlitze entstehen der Reihe nach und bleiben, wie sie sind; ein
 * spaeter umgestellter Markenabstand aendert Vergangenes nicht. */
const slots = [];                // Zeichen je Schlitz (oder MARKER)
let dataCount = 0;               // wie viele Datenschlitze existieren
let sinceMarker = 0;             // Datenschlitze seit der letzten Marke

function ensureSlots(upto) {
  while (slots.length <= upto) {
    if (state.markerEvery > 0 && sinceMarker >= state.markerEvery) {
      slots.push(MARKER);
      sinceMarker = 0;
    } else {
      slots.push(MSG[dataCount % MSG.length]);
      dataCount += 1;
      sinceMarker += 1;
    }
  }
}

// --- Simulation -------------------------------------------------------------
let simTime = 0;
let sweepStart = 0;              // Beginn der aktuellen Bildschirmseite
let nextTick = 0.5 * T;          // naechster Abtastzeitpunkt des Empfaengers
let expectedSlot = 0;            // welchen Schlitz die Lesung treffen SOLL
const dots = [];                 // { t, offset, ok, sync }  Abtastpunkte
const recv = [];                 // { ch, ok } gelesene Zeichen
const results = [];              // true = richtiger Schlitz getroffen

function step(dtMs) {
  const end = simTime + dtMs;
  ensureSlots(Math.floor(end / T) + 1);
  while (nextTick <= end) {
    const t = nextTick;
    const slot = Math.floor(t / T);
    const ch = slots[slot];
    const offset = (t - (expectedSlot + 0.5) * T) / T;
    if (ch === MARKER) {
      // Neu ausrichten: der naechste Tick sitzt wieder exakt mittig
      dots.push({ t, offset, ok: true, sync: true });
      expectedSlot = slot + 1;
      nextTick = (slot + 1.5) * T;
    } else {
      const ok = slot === expectedSlot;
      dots.push({ t, offset, ok, sync: false });
      recv.push({ ch, ok });
      if (recv.length > TRANSCRIPT) recv.shift();
      results.push(ok);
      if (results.length > HISTORY) results.shift();
      expectedSlot += 1;
      nextTick = t + T * (1 + state.err);
    }
    updateStats();
    renderLines();
  }
  simTime = end;
}

// --- Zeichnung --------------------------------------------------------------
const PALETTE = {
  white: "#ffffff", grayLight: "#b6bec6", gray: "#7d868f",
  grayDark: "#4a5259", blue: "#009ee3", red: "#ff4d6d",
  band: "rgba(255, 255, 255, 0.045)",
  blueBand: "rgba(0, 158, 227, 0.16)",
};

const canvas = document.getElementById("lab");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, streamW = 0;
const PAD = 14;
const PAD_LEFT = 14;
const SLOT_PX = 38;              // Breite eines Zeitschlitzes im Bild
const SB0 = 40, SBH = 56;        // Senderband: oben, Hoehe
const RY = 152;                  // Zeile der Abtastpunkte
const OG0 = 214;                 // Versatzgraph: oben
const OG_SPAN = 1.5;             // Graph zeigt Versatz von -1.5 bis +1.5

function resize() {
  const ratio = window.devicePixelRatio || 1;
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  streamW = W - PAD;
}
window.addEventListener("resize", resize);

const xOf = (t) => PAD_LEFT + (t / T - sweepStart) * SLOT_PX;
const yOffset = (off) => {
  const h = H - PAD - OG0;
  const clamped = Math.max(-OG_SPAN, Math.min(OG_SPAN, off));
  return OG0 + h / 2 - (clamped / OG_SPAN) * (h / 2);
};

/* Der Sweep: Ist der Schreibkopf rechts angekommen, beginnt eine neue
 * Bildschirmseite; nichts scrollt. */
function prune() {
  if (xOf(simTime) > streamW - 4) {
    sweepStart = Math.floor(simTime / T);
    while (dots.length && dots[0].t < sweepStart * T) dots.shift();
  }
}

function drawFrame() {
  ctx.clearRect(0, 0, W, H);
  const headX = Math.min(xOf(simTime), streamW);

  // Spurtitel
  ctx.font = "12px Arial";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = PALETTE.gray;
  ctx.fillText("sender: one symbol per time slot", PAD_LEFT, SB0 - 8);
  ctx.fillText("receiver: sampling points (red = wrong slot)", PAD_LEFT, RY - 14);
  ctx.fillText("how far the sampling point is off (in slots)", PAD_LEFT, OG0 - 8);

  // Senderband: Schlitze samt Zeichen, so weit der Kopf gekommen ist
  const lastSlot = Math.floor(simTime / T);
  ctx.font = "16px 'Roboto Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let k = sweepStart; k <= lastSlot; k++) {
    const x0 = xOf(k * T);
    const w = Math.min(SLOT_PX, headX - x0);
    if (w <= 0 || x0 > streamW) continue;
    const marker = slots[k] === MARKER;
    if (marker) {
      ctx.fillStyle = PALETTE.blueBand;
      ctx.fillRect(x0, SB0, w, SBH);
    } else if (k % 2 === 0) {
      ctx.fillStyle = PALETTE.band;
      ctx.fillRect(x0, SB0, w, SBH);
    }
    ctx.strokeStyle = PALETTE.grayDark;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, SB0, Math.min(SLOT_PX, streamW - x0), SBH);
    if ((k + 1) * T <= simTime) {
      ctx.fillStyle = marker ? PALETTE.blue : PALETTE.grayLight;
      ctx.fillText(slots[k], x0 + SLOT_PX / 2, SB0 + SBH / 2);
    }
  }

  // Abtastpunkte: Nadel bis ins Senderband, Punkt auf der Empfaengerzeile
  dots.forEach((d) => {
    const x = xOf(d.t);
    if (x < PAD_LEFT || x > streamW) return;
    const color = d.sync ? PALETTE.blue : (d.ok ? PALETTE.white : PALETTE.red);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, SB0 + SBH);
    ctx.lineTo(x, RY - 5);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, RY, 4, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Versatzgraph: Null- und Halbschlitzlinien, dann der Verlauf
  ctx.strokeStyle = PALETTE.grayDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_LEFT, yOffset(0));
  ctx.lineTo(streamW, yOffset(0));
  ctx.stroke();
  ctx.setLineDash([4, 5]);
  [-0.5, 0.5].forEach((v) => {
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, yOffset(v));
    ctx.lineTo(streamW, yOffset(v));
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.font = "11px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = PALETTE.gray;
  ctx.fillText("+half a slot", PAD_LEFT + 4, yOffset(0.5) - 8);
  ctx.fillText("-half a slot", PAD_LEFT + 4, yOffset(-0.5) + 9);

  ctx.strokeStyle = PALETTE.blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  dots.forEach((d) => {
    const x = xOf(d.t);
    if (x < PAD_LEFT || x > streamW) return;
    const y = yOffset(d.offset);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Schreibkopf
  ctx.strokeStyle = PALETTE.grayDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headX, SB0 - 4);
  ctx.lineTo(headX, H - PAD);
  ctx.stroke();

  if (state.paused) {
    ctx.fillStyle = PALETTE.gray;
    ctx.font = "13px Arial";
    ctx.textAlign = "right";
    ctx.fillText("paused — press space", streamW - 6, SB0 - 8);
  }
  ctx.textAlign = "left";
}

// --- Takt -------------------------------------------------------------------
let lastTs = 0;
function tick(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(ts - lastTs, 100);   // Tab-Wechsel nicht nachholen
  lastTs = ts;
  if (!state.paused) {
    step(dt * state.speed);      // Zeitlupe wirkt nur auf die Anzeige
    prune();
  }
  drawFrame();
  requestAnimationFrame(tick);
}

// --- Anzeige und Bedienung --------------------------------------------------
const el = (id) => document.getElementById(id);

function updateStats() {
  const pct = state.err * 100;
  el("st-clock").textContent =
    (pct > 0 ? "+" : "") + pct.toFixed(2).replace(/\.?0+$/, "") + " %";
  el("st-clock-note").textContent =
    pct === 0 ? "perfectly in step" : pct > 0 ? "runs slow: samples too late"
                                             : "runs fast: samples too early";
  el("st-half").textContent =
    state.err === 0 ? "never" : `${Math.round(0.5 / Math.abs(state.err))} sym`;
  const errCount = results.filter((r) => !r).length;
  const badge = el("st-err");
  badge.textContent = results.length ? `${errCount}` : "–";
  badge.className = "value " + (errCount === 0 ? "good" : "bad");
  el("st-ovh").textContent = state.markerEvery > 0
    ? `${(100 / (state.markerEvery + 1)).toFixed(1).replace(/\.0$/, "")} %`
    : "0 %";
}

function renderLines() {
  // Gesendete Zeile frisch aus den fertigen Schlitzen ziehen, ohne Marken
  const done = Math.floor(simTime / T);
  const sent = [];
  for (let i = Math.max(0, done - TRANSCRIPT * 2); i < done; i++) {
    if (slots[i] && slots[i] !== MARKER) sent.push(slots[i]);
  }
  el("st-sent").textContent = sent.slice(-TRANSCRIPT).join("");
  el("st-recv").innerHTML = recv
    .map((r) => r.ok ? r.ch : `<span class="err">${r.ch}</span>`)
    .join("");
}

function readKnobs() {
  el("rd-err").textContent = state.err === 0
    ? "0 %: both clocks agree"
    : `${(state.err * 100).toFixed(2).replace(/\.?0+$/, "")} % per slot`;
  el("rd-marker").textContent = state.markerEvery > 0
    ? `every ${state.markerEvery} symbols`
    : "off: no resync";
  el("rd-speed").textContent = `${Math.round(state.speed * 100)} % of real time`;
  updateStats();
}

function reset() {
  simTime = 0;
  sweepStart = 0;
  nextTick = 0.5 * T;
  expectedSlot = 0;
  slots.length = 0;
  dataCount = 0;
  sinceMarker = 0;
  dots.length = 0;
  recv.length = 0;
  results.length = 0;
  renderLines();
  updateStats();
}

el("in-err").addEventListener("input", (ev) => {
  state.err = Number(ev.target.value) / 100;
  readKnobs();
});
el("in-marker").addEventListener("input", (ev) => {
  state.markerEvery = Number(ev.target.value);
  readKnobs();
});
el("in-speed").addEventListener("input", (ev) => {
  state.speed = Number(ev.target.value) / 100;
  readKnobs();
});
el("btn-pause").addEventListener("click", () => {
  state.paused = !state.paused;
  el("btn-pause").textContent = state.paused ? "run" : "pause";
});

/* Einzelschritt: haelt an und fuehrt genau eine Abtastung aus. */
function stepOnce() {
  if (!state.paused) {
    state.paused = true;
    el("btn-pause").textContent = "run";
  }
  step(Math.max(nextTick - simTime, 1));
  prune();
}
el("btn-step").addEventListener("click", stepOnce);
el("btn-reset").addEventListener("click", reset);

document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;             // Slider behalten ihre Tasten
  if (tag === "BUTTON") document.activeElement.blur();
  if (ev.key === " ") {
    ev.preventDefault();
    el("btn-pause").click();
  } else if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
    ev.preventDefault();
    const delta = ev.key === "ArrowUp" ? 0.25 : -0.25;
    const next = Math.max(-5, Math.min(5, state.err * 100 + delta));
    state.err = next / 100;
    el("in-err").value = String(next);
    readKnobs();
  } else if (ev.key === "m") {
    stepOnce();
  } else if (ev.key === "r") {
    reset();
  }
});

// --- Start ------------------------------------------------------------------
resize();
readKnobs();
requestAnimationFrame(tick);
