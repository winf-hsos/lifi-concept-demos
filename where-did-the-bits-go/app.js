/* where did the bits go? — throughput and limits.
 *
 * A 2 KB photo crosses a framed link as abstract channel symbols. The
 * animation keeps the physical symbol clock, accepted payload and wasted
 * attempts separate: preamble, header and check consume link time without
 * growing the picture; a failed packet consumes a complete attempt and is
 * then sent again.
 *
 * The symbols s0 ... s7 deliberately have shapes, not LiFi colours. Their
 * bit values are one possible convention inside this demonstrator and say
 * nothing about the colour mapping a team chooses for the real device.
 * Packet failure is simulated directly as a probability per complete packet;
 * the demo does not claim a physical bit-error model.
 *
 * Display speed accelerates only the animation. All rates and remaining times
 * are calculated for the real link settings. No framework, no build. */

"use strict";

// Embed mode for slides: keep the experiment, hide browser-only framing.
if (new URLSearchParams(location.search).has("embed")) document.body.classList.add("embed");

const PHOTO_BITS = 2 * 1024 * 8;
const PREAMBLE = 6;
const HEADER = 4;
const CHECK = 4;
const SHAPES = ["○", "△", "□", "◇", "⬟", "✦", "+", "×"];
const QUEUE = 7;

const el = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const params = new URLSearchParams(location.search);
const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;
const paramNumber = (name, fallback) => params.has(name) ? Number(params.get(name)) : fallback;
const state = {
  alphabet: allowed(Number(params.get("alphabet")), [2, 4, 8], 4),
  rate: clamp(paramNumber("rate", 5), 2, 20),
  payload: allowed(Number(params.get("payload")), [16, 32, 64], 32),
  error: clamp(paramNumber("error", 8), 0, 30) / 100,
  speed: allowed(Number(params.get("speed")), [1, 100, 500], 100),
  paused: false,
  done: false,
  packet: 0,
  attempt: 1,
  position: 0,
  acceptedBits: 0,
  sent: 0,
  usefulSymbols: 0,
  overheadSymbols: 0,
  rejectedSymbols: 0,
  currentAttemptUseful: 0,
  currentAttemptOverhead: 0,
  history: [],
  flash: "",
  holdUntil: 0,
};

const bitsPerSymbol = () => Math.log2(state.alphabet);
const payloadSymbolsTotal = () => Math.ceil(PHOTO_BITS / bitsPerSymbol());
const packetCount = () => Math.ceil(payloadSymbolsTotal() / state.payload);
const packetPayloadSymbols = () => Math.min(
  state.payload,
  payloadSymbolsTotal() - state.packet * state.payload,
);
const packetLength = () => PREAMBLE + HEADER + packetPayloadSymbols() + CHECK;
const payloadBitsThisPacket = () => Math.min(
  PHOTO_BITS - state.acceptedBits,
  packetPayloadSymbols() * bitsPerSymbol(),
);

function partAt(position) {
  if (position < PREAMBLE) return "preamble";
  if (position < PREAMBLE + HEADER) return "header";
  if (position < PREAMBLE + HEADER + packetPayloadSymbols()) return "payload";
  return "check";
}

function symbolIndex(part, absolutePosition) {
  if (part === "preamble") return absolutePosition % Math.min(2, state.alphabet);
  if (part === "header") return (state.packet + absolutePosition) % state.alphabet;
  if (part === "check") return (state.packet * 3 + absolutePosition * 5) % state.alphabet;
  // Deterministic pseudo-photo data. It need only exercise the chosen alphabet.
  const x = (state.packet * state.payload + absolutePosition + 1) * 2654435761;
  return (x >>> 16) % state.alphabet;
}

function pushHistory(part, index, failed = false) {
  state.history.push({ part, index, failed });
  if (state.history.length > QUEUE) state.history.shift();
}

function finishAttempt(now) {
  const failed = Math.random() < state.error;
  if (failed) {
    state.rejectedSymbols += state.currentAttemptUseful + state.currentAttemptOverhead;
    state.currentAttemptUseful = 0;
    state.currentAttemptOverhead = 0;
    state.history = state.history.map((item) => ({ ...item, failed: true }));
    state.flash = "failed";
    state.holdUntil = now + 650;
    state.position = 0;
    state.attempt += 1;
    return;
  }

  state.usefulSymbols += state.currentAttemptUseful;
  state.overheadSymbols += state.currentAttemptOverhead;
  state.currentAttemptUseful = 0;
  state.currentAttemptOverhead = 0;
  state.acceptedBits += payloadBitsThisPacket();
  state.flash = "accepted";
  state.holdUntil = now + 260;
  state.packet += 1;
  state.attempt = 1;
  state.position = 0;

  if (state.acceptedBits >= PHOTO_BITS || state.packet >= packetCount()) {
    state.acceptedBits = PHOTO_BITS;
    state.done = true;
    state.paused = true;
  }
}

function transmitOne(now) {
  if (state.done) return;
  const part = partAt(state.position);
  const index = symbolIndex(part, state.position);
  pushHistory(part, index);
  state.sent += 1;
  if (part === "payload") state.currentAttemptUseful += 1;
  else state.currentAttemptOverhead += 1;
  state.position += 1;
  if (state.position >= packetLength()) finishAttempt(now);
}

// --- Pictures ---------------------------------------------------------------
const source = el("source");
const received = el("received");
const sourceCtx = source.getContext("2d");
const receivedCtx = received.getContext("2d");
const photo = new Image();
let photoReady = false;

function cover(ctx, image, w, h) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale, sh = h / scale;
  const sx = (image.width - sw) / 2, sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
}

function drawPictures() {
  if (!photoReady) return;
  sourceCtx.clearRect(0, 0, source.width, source.height);
  cover(sourceCtx, photo, source.width, source.height);

  const w = received.width, h = received.height;
  receivedCtx.clearRect(0, 0, w, h);
  receivedCtx.fillStyle = "#111416";
  receivedCtx.fillRect(0, 0, w, h);
  const accepted = state.acceptedBits / PHOTO_BITS;
  const y = Math.floor(h * accepted);
  if (y > 0) {
    receivedCtx.save();
    receivedCtx.beginPath();
    receivedCtx.rect(0, 0, w, y);
    receivedCtx.clip();
    cover(receivedCtx, photo, w, h);
    receivedCtx.restore();
  }

  if (!state.done) {
    const pendingBits = payloadBitsThisPacket();
    const bandH = Math.max(2, h * pendingBits / PHOTO_BITS);
    receivedCtx.fillStyle = state.flash === "failed"
      ? "rgba(255, 77, 109, 0.65)"
      : "rgba(0, 158, 227, 0.28)";
    receivedCtx.fillRect(0, y, w, Math.min(bandH, h - y));
  }
}

photo.onload = () => { photoReady = true; drawPictures(); };
photo.src = "../assets/photos/parrot.png";

// --- Display ----------------------------------------------------------------
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function expectedGoodput() {
  const payload = state.payload;
  const frame = PREAMBLE + HEADER + payload + CHECK;
  return state.rate * bitsPerSymbol() * (payload / frame) * (1 - state.error);
}

function updateButtons(group, value) {
  group.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.value) === value));
  });
}

function renderSettings() {
  updateButtons(el("alphabet"), state.alphabet);
  updateButtons(el("payload"), state.payload);
  updateButtons(el("speed"), state.speed);
  el("in-rate").value = String(state.rate);
  el("in-error").value = String(Math.round(state.error * 100));
  el("rd-alphabet").textContent = `${state.alphabet} symbols · ${bitsPerSymbol()} bit${bitsPerSymbol() === 1 ? "" : "s"}/symbol`;
  el("rd-rate").textContent = `${state.rate} symbols/s`;
  el("rd-payload").textContent = `${state.payload} payload symbols`;
  el("rd-error").textContent = state.error === 0
    ? "0 %: no retries"
    : `${Math.round(state.error * 100)} % must be sent again`;
  el("packet-payload").style.flex = String(state.payload);
  el("payload-count").textContent = `${state.payload} sym`;
}

function renderSymbols() {
  const blanks = Math.max(0, QUEUE - state.history.length);
  const items = Array.from({ length: blanks }, () => null).concat(state.history);
  el("symbols").innerHTML = items.map((item) => {
    if (!item) return '<span class="symbol"><span class="shape">·</span><span class="name">&nbsp;</span></span>';
    const classes = `symbol ${item.part}${item.failed ? " failed" : ""}`;
    return `<span class="${classes}"><span class="shape">${SHAPES[item.index]}</span><span class="name">s${item.index}</span></span>`;
  }).join("");
}

function renderPacket() {
  const packet = el("packet");
  packet.classList.toggle("failed", state.flash === "failed");
  packet.classList.toggle("accepted", state.flash === "accepted" || state.done);

  const currentPart = state.done ? "" : partAt(Math.min(state.position, packetLength() - 1));
  packet.querySelectorAll(".segment").forEach((segment) => {
    segment.classList.toggle("active", segment.dataset.part === currentPart);
  });
  const progress = state.done ? 100 : 100 * state.position / Math.max(1, packetLength());
  el("packet-cursor").style.left = `calc(${progress}% - 1px)`;
  el("packet-label").textContent = state.done
    ? `packet ${packetCount()} of ${packetCount()}`
    : `packet ${state.packet + 1} of ${packetCount()} · attempt ${state.attempt}`;

  const result = el("packet-result");
  if (state.done) result.textContent = "photo complete";
  else if (state.flash === "failed") result.textContent = "check failed · sending again";
  else if (state.flash === "accepted") result.textContent = "check passed · payload accepted";
  else result.textContent = `${currentPart} · ${state.position} / ${packetLength()} symbols`;

  const current = state.history[state.history.length - 1];
  if (state.done) {
    el("current-symbol").innerHTML = '<span class="good">the complete photo arrived</span>';
  } else if (state.flash === "failed") {
    el("current-symbol").innerHTML = '<span class="bad">the whole attempt crossed the link. none of its photo data was accepted.</span>';
  } else if (state.flash === "accepted") {
    el("current-symbol").innerHTML = '<span class="good">the check passed. now the picture grows.</span>';
  } else if (current) {
    const action = current.part === "payload" ? "may grow the photo after the check" : "uses time; the photo does not grow";
    el("current-symbol").innerHTML = `<strong>s${current.index}</strong> · ${current.part} · ${action}`;
  } else {
    el("current-symbol").textContent = "waiting for the first symbol";
  }
}

function renderStats() {
  const raw = state.rate * bitsPerSymbol();
  const good = expectedGoodput();
  const left = PHOTO_BITS - state.acceptedBits;
  el("st-raw").textContent = `${raw.toFixed(raw % 1 ? 1 : 0)} bit/s`;
  el("st-good").textContent = `${good.toFixed(1)} bit/s`;
  el("st-count").textContent = `${fmt(state.sent)} / ${fmt(state.acceptedBits)}`;
  el("st-eta").textContent = state.done ? "0:00" : formatTime(left / good);
  el("photo-progress").textContent = `${fmt(state.acceptedBits)} / ${fmt(PHOTO_BITS)} bits accepted`;

  const accepted = state.usefulSymbols;
  const overhead = state.overheadSymbols;
  const rejected = state.rejectedSymbols;
  const committed = accepted + overhead + rejected;
  const denom = Math.max(1, committed);
  el("bar-useful").style.flexBasis = `${100 * accepted / denom}%`;
  el("bar-overhead").style.flexBasis = `${100 * overhead / denom}%`;
  el("bar-rejected").style.flexBasis = `${100 * rejected / denom}%`;
  el("ledger-total").textContent = `${fmt(committed)} committed symbols`;
  el("key-useful").textContent = fmt(accepted);
  el("key-overhead").textContent = fmt(overhead);
  el("key-rejected").textContent = fmt(rejected);
}

function render() {
  renderSymbols();
  renderPacket();
  renderStats();
  drawPictures();
  el("btn-pause").textContent = state.done ? "complete" : state.paused ? "run" : "pause";
  el("btn-pause").disabled = state.done;
}

// --- Interaction ------------------------------------------------------------
function reset() {
  state.paused = false;
  state.done = false;
  state.packet = 0;
  state.attempt = 1;
  state.position = 0;
  state.acceptedBits = 0;
  state.sent = 0;
  state.usefulSymbols = 0;
  state.overheadSymbols = 0;
  state.rejectedSymbols = 0;
  state.currentAttemptUseful = 0;
  state.currentAttemptOverhead = 0;
  state.history = [];
  state.flash = "";
  state.holdUntil = 0;
  accumulator = 0;
  renderSettings();
  render();
}

function bindChoices(id, key) {
  el(id).querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state[key] = Number(button.dataset.value);
      reset();
    });
  });
}
bindChoices("alphabet", "alphabet");
bindChoices("payload", "payload");
bindChoices("speed", "speed");

el("in-rate").addEventListener("input", (event) => {
  state.rate = Number(event.target.value);
  reset();
});
el("in-error").addEventListener("input", (event) => {
  state.error = Number(event.target.value) / 100;
  reset();
});
el("btn-pause").addEventListener("click", () => {
  if (state.done) return;
  state.paused = !state.paused;
  render();
});
el("btn-reset").addEventListener("click", reset);

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT") return;
  if (event.key === " ") {
    event.preventDefault();
    el("btn-pause").click();
  } else if (event.key.toLowerCase() === "r") {
    reset();
  }
});

// --- Clock ------------------------------------------------------------------
let lastTime = 0;
let accumulator = 0;

function tick(now) {
  if (!lastTime) lastTime = now;
  const dt = Math.min(now - lastTime, 100);
  lastTime = now;

  if (!state.paused && !state.done) {
    if (state.holdUntil && now < state.holdUntil) {
      // Pause briefly at packet verdicts so retries remain visible at 500×.
    } else {
      if (state.holdUntil) {
        state.holdUntil = 0;
        state.flash = "";
      }
      accumulator += dt * state.rate * state.speed / 1000;
      const count = Math.min(250, Math.floor(accumulator));
      accumulator -= count;
      for (let i = 0; i < count && !state.done && !state.holdUntil; i += 1) transmitOne(now);
    }
  }
  render();
  requestAnimationFrame(tick);
}

renderSettings();
render();
requestAnimationFrame(tick);
