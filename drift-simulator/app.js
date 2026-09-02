/* drift simulator — abtastung und synchronisation.
 *
 * Der Sender legt eine zufaellige Farbfolge Symbol fuer Symbol in feste
 * Zeitschlitze, wie die LED des LiFi-Geraets. Der Empfaenger tastet in
 * der Mitte jedes Schlitzes ab, glaubt er — denn seine Uhr geht um
 * einen einstellbaren Prozentsatz falsch. Der Versatz waechst mit jedem
 * Symbol, die Abtastpunkte wandern sichtbar aus den Schlitzen, und die
 * Empfangszeile kippt gegen die Sendezeile: Farben werden doppelt
 * gelesen oder uebersprungen.
 *
 * Die Farben sind nur unterscheidbare Symbole und tragen KEINE
 * Bedeutung (keine Bit-Zuordnung): Welche Farbe wofuer steht,
 * entscheidet spaeter jedes Team selbst.
 *
 * Der Schalter fuer die wiederkehrende Marke zeigt den Ausweg: Alle n
 * Symbole opfert der Sender einen Schlitz fuer eine Marke, an der sich
 * der Empfaenger neu ausrichtet. Der Versatz springt auf null zurueck,
 * die Marke kostet sichtbar Rate. WIE der Empfaenger die Marke im
 * Signal erkennt, bleibt hier ausgeklammert; die Demo zeigt nur, was
 * das Neuausrichten bewirkt.
 *
 * Anzeige als Sweep wie im distinguishability lab: Der Schreibkopf
 * laeuft von links nach rechts, nichts scrollt, am Rand beginnt eine
 * neue Bildschirmseite. Kein Framework, kein Build. */

"use strict";

// --- Modell -----------------------------------------------------------------
const T = 100;                   // ms je Zeitschlitz (Senderuhr, fix)
const SYMBOL_COLORS =            // vier unterscheidbare Sendefarben
  ["#009ee3", "#ffd23f", "#4ade80", "#b06cf0"];
const MARKER = -1;               // Markenschlitz (kein Datensymbol)
const HISTORY = 100;             // Lesungen fuer die Fehlerquote
const TRANSCRIPT = 48;           // Laenge der Protokollzeilen

const state = {
  err: 0.02,                     // Uhrenfehler des Empfaengers (Anteil)
  markerEvery: 0,                // 0 = keine Marken
  speed: 0.4,                    // Zeitlupe: Anteil der Echtzeit
  paused: false,
};

/* Schlitze entstehen der Reihe nach und bleiben, wie sie sind; ein
 * spaeter umgestellter Markenabstand aendert Vergangenes nicht. */
const slots = [];                // Farbindex je Schlitz (oder MARKER)
let sinceMarker = 0;             // Datenschlitze seit der letzten Marke

function ensureSlots(upto) {
  while (slots.length <= upto) {
    if (state.markerEvery > 0 && sinceMarker >= state.markerEvery) {
      slots.push(MARKER);
      sinceMarker = 0;
    } else {
      slots.push(Math.floor(Math.random() * SYMBOL_COLORS.length));
      sinceMarker += 1;
    }
  }
}

// --- Simulation -------------------------------------------------------------
let simTime = 0;
let sweepStart = 0;              // Beginn der aktuellen Bildschirmseite
let nextTick = 0.5 * T;          // naechster Abtastzeitpunkt des Empfaengers
let expectedSlot = 0;            // welchen Schlitz die Lesung treffen SOLL
let lastOffset = 0;              // aktueller Versatz in Schlitzen
const dots = [];                 // { t, ci, ok, sync }  Abtastpunkte
const recv = [];                 // { ci, ok } gelesene Symbole
const results = [];              // true = richtiger Schlitz getroffen

function step(dtMs) {
  const end = simTime + dtMs;
  ensureSlots(Math.floor(end / T) + 1);
  while (nextTick <= end) {
    const t = nextTick;
    const slot = Math.floor(t / T);
    const ci = slots[slot];
    lastOffset = (t - (expectedSlot + 0.5) * T) / T;
    if (ci === MARKER) {
      // Neu ausrichten: der naechste Tick sitzt wieder exakt mittig
      dots.push({ t, ci, ok: true, sync: true });
      expectedSlot = slot + 1;
      nextTick = (slot + 1.5) * T;
      lastOffset = 0;
    } else {
      const ok = slot === expectedSlot;
      dots.push({ t, ci, ok, sync: false });
      recv.push({ ci, ok });
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
};

const canvas = document.getElementById("lab");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, streamW = 0;
const PAD = 14;
const PAD_LEFT = 14;
const SLOT_PX = 38;              // Breite eines Zeitschlitzes im Bild
const SB0 = 40, SBH = 88;        // Senderband: oben, Hoehe
const RY = 196;                  // Zeile der Abtastpunkte

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
  ctx.fillText("sender: one colour per time slot", PAD_LEFT, SB0 - 8);
  ctx.fillText("receiver: sampling points (red ring = wrong slot)", PAD_LEFT, RY - 16);

  // Senderband: Farbschlitze, so weit der Kopf gekommen ist
  const lastSlot = Math.floor(simTime / T);
  for (let k = sweepStart; k <= lastSlot; k++) {
    const x0 = xOf(k * T);
    const w = Math.min(SLOT_PX, headX - x0);
    if (w <= 0 || x0 > streamW) continue;
    const ci = slots[k];
    if (ci === MARKER) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
      ctx.fillRect(x0, SB0, w, SBH);
      if ((k + 1) * T <= simTime) {
        ctx.fillStyle = PALETTE.white;
        ctx.font = "15px 'Roboto Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("◆", x0 + SLOT_PX / 2, SB0 + SBH / 2);
      }
    } else {
      ctx.fillStyle = SYMBOL_COLORS[ci];
      ctx.fillRect(x0, SB0, w, SBH);
    }
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, SB0, Math.min(SLOT_PX, streamW - x0), SBH);
  }

  // Abtastpunkte: Nadel bis ins Senderband, Punkt in der gelesenen Farbe
  dots.forEach((d) => {
    const x = xOf(d.t);
    if (x < PAD_LEFT || x > streamW) return;
    const fill = d.sync ? PALETTE.white
               : d.ci === MARKER ? PALETTE.grayLight
               : SYMBOL_COLORS[d.ci];
    ctx.strokeStyle = PALETTE.grayLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, SB0 + SBH);
    ctx.lineTo(x, RY - 6);
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, RY, 5, 0, 2 * Math.PI);
    ctx.fill();
    if (!d.ok && !d.sync) {
      ctx.strokeStyle = PALETTE.red;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, RY, 8, 0, 2 * Math.PI);
      ctx.stroke();
    }
  });

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
  const off = el("st-off");
  off.textContent =
    (lastOffset >= 0 ? "+" : "") + lastOffset.toFixed(2) + " slots";
  off.className = "value" + (Math.abs(lastOffset) >= 0.5 ? " bad" : "");
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
    if (slots[i] !== undefined && slots[i] !== MARKER) sent.push(slots[i]);
  }
  el("st-sent").innerHTML = sent.slice(-TRANSCRIPT)
    .map((ci) => `<span class="sym" style="background:${SYMBOL_COLORS[ci]}"></span>`)
    .join("");
  el("st-recv").innerHTML = recv
    .map((r) => `<span class="sym${r.ok ? "" : " err"}" ` +
                `style="background:${SYMBOL_COLORS[r.ci]}"></span>`)
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
  lastOffset = 0;
  slots.length = 0;
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
