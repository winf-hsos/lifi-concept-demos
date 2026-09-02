# LiFi Concept Demos

Kleine interaktive Anwendungen, die je ein Konzept aus dem LiFi-Projekt (Modul „Digitalisierung und Programmierung", Hochschule Osnabrück) veranschaulichen. Jede Anwendung ist unter einer eigenen URL erreichbar; die Übersichtsseite (`index.html`) listet alle, sortiert nach den Konzepten des Kurses.

Live: <https://winf-hsos.github.io/lifi-concept-demos/>

## Struktur

```
index.html            Übersichtsseite, sortiert nach Konzepten
assets/style.css      gemeinsames Look & Feel (Designwerte des LiFi-Projekts)
byte-switchboard/     ein Ordner je Demonstrator: index.html + app.js
```

## Regeln für Demonstratoren

- **Ein Konzept je Demonstrator.** Die App zeigt genau eine Idee und lädt zum Spielen ein; alles Erklärende steht auf der zugehörigen Konzeptseite der Kurs-Website, auf die der Footer verlinkt.
- **Kein Build, keine Abhängigkeiten.** Reines HTML, CSS und JavaScript, je Demonstrator ein Ordner mit `index.html` und `app.js`. Erlaubte externe Quelle ist nur Google Fonts (Roboto Mono).
- **Look & Feel aus `assets/style.css`.** Schwarzer Grund, die acht Kursfarben als CSS-Variablen (Farbe ist Bedeutung: Blau verweist, Gelb merkt an, Rot ist der sparsame Hingucker), Arial für Text, Roboto Mono für alles Zählbare, durchgehende Kleinschreibung wie auf den Folien. Demo-spezifisches CSS bleibt in der jeweiligen `index.html`.
- **Bedienbar mit Maus, Touch und Tastatur.** Interaktive Elemente sind echte Buttons mit `aria`-Attributen, keine Canvas-Flächen.
- **Rahmen einhalten:** Kopfzeile mit Projektbezug und Link `all demos`, Footer mit Link zur Konzeptseite der Kurs-Website und zurück zur Übersicht.
- **Neue Demos** bekommen einen Ordner, eine Karte auf der Übersichtsseite unter ihrem Konzept, und werden von den Folien des zugehörigen Inputs verlinkt.

## Herkunft

Der Byte Switchboard ist die überarbeitete Fassung des gleichnamigen Demonstrators aus [computer-science-demonstrators](https://github.com/winf-hsos/computer-science-demonstrators), dort als Vite/TypeScript/Konva-Canvas-App gebaut. Die Neufassung hier ist abhängigkeitsfrei, barrierefrei bedienbar und im Look & Feel des LiFi-Projekts.
