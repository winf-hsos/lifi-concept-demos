/* Uebersichtsseite: Live-Filter ueber das Suchfeld und die Konzept-Labels.
 *
 * Jede Karte traegt ihr Konzept in data-concept; gesucht wird im Text der
 * Karte (Name, Beschreibung, Label). Beide Filter gelten zugleich. Der
 * Zustand steht in der Adresse (?q=...&concept=...), damit ein Link auf eine
 * gefilterte Ansicht funktioniert, etwa von einer Konzeptseite aus. */
(function () {
  "use strict";
  const suche = document.getElementById("search");
  const leiste = document.getElementById("tags");
  const zaehler = document.getElementById("count");
  const leer = document.getElementById("empty");
  const karten = Array.from(document.querySelectorAll("#grid .card"));
  const namen = {};
  leiste.querySelectorAll(".tag").forEach((b) => { namen[b.dataset.concept] = b.textContent; });

  let konzept = "";
  let frage = "";

  function normal(s) {
    return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  karten.forEach((k) => { k.dataset.text = normal(k.textContent); });

  function anwenden() {
    const woerter = normal(frage).split(" ").filter(Boolean);
    let sichtbar = 0;
    karten.forEach((k) => {
      const passtKonzept = !konzept || k.dataset.concept === konzept;
      const passtText = woerter.every((w) => k.dataset.text.includes(w));
      const zeigen = passtKonzept && passtText;
      k.hidden = !zeigen;
      if (zeigen) sichtbar++;
    });
    leiste.querySelectorAll(".tag").forEach((b) => {
      const aktiv = b.dataset.concept === konzept;
      b.classList.toggle("is-active", aktiv);
      b.setAttribute("aria-pressed", aktiv ? "true" : "false");
    });
    karten.forEach((k) => {
      k.querySelector(".tag").classList.toggle("is-active", !!konzept && k.dataset.concept === konzept);
    });
    leer.hidden = sichtbar > 0;
    const was = konzept ? namen[konzept] : "all concepts";
    zaehler.textContent = sichtbar === karten.length
      ? `${sichtbar} demos`
      : `${sichtbar} of ${karten.length} demos, ${was}${woerter.length ? `, matching "${frage.trim()}"` : ""}`;
    const url = new URL(location.href);
    if (frage.trim()) url.searchParams.set("q", frage.trim()); else url.searchParams.delete("q");
    if (konzept) url.searchParams.set("concept", konzept); else url.searchParams.delete("concept");
    history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
  }

  function setzeKonzept(c) {
    konzept = konzept === c ? "" : c;
    anwenden();
  }

  suche.addEventListener("input", () => { frage = suche.value; anwenden(); });
  suche.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { suche.value = ""; frage = ""; anwenden(); }
  });
  leiste.addEventListener("click", (e) => {
    const b = e.target.closest(".tag");
    if (!b) return;
    konzept = b.dataset.concept === "" ? "" : (konzept === b.dataset.concept ? "" : b.dataset.concept);
    anwenden();
  });
  karten.forEach((k) => {
    k.querySelector(".tag").addEventListener("click", (e) => {
      e.preventDefault();
      setzeKonzept(k.dataset.concept);
      leiste.scrollIntoView({ block: "nearest" });
    });
    // Die ganze Karte fuehrt zur Demo, ausser dem Label und den Links selbst.
    k.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      const ziel = k.querySelector("a.name").href;
      if (e.ctrlKey || e.metaKey) window.open(ziel, "_blank"); else location.href = ziel;
    });
  });
  document.getElementById("reset").addEventListener("click", () => {
    suche.value = ""; frage = ""; konzept = ""; anwenden(); suche.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== suche) { e.preventDefault(); suche.focus(); }
  });

  const start = new URL(location.href).searchParams;
  frage = start.get("q") || "";
  suche.value = frage;
  const c = start.get("concept") || "";
  konzept = namen[c] !== undefined ? c : "";
  anwenden();
})();
