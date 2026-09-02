# Ideensammlung: Demonstratoren für die Kurskonzepte

Diskussionsgrundlage, Stand 02.09.2026. Je Konzept die Frage: Was lässt sich durch eigenes Herumspielen besser verstehen als durch Zuhören? Ein Demonstrator lohnt sich dort, wo ein Zusammenhang erst beim Verändern von Parametern fühlbar wird, wo eine Fehlvorstellung aus dem Fragenpool direkt erlebbar widerlegt werden kann, oder wo etwas zu schnell oder zu unsichtbar abläuft, um es live zu zeigen. Nicht jedes Konzept braucht eine Demo; wo Folie und Werkstatt reichen, steht das dabei.

## Leitplanken

- **Ein Konzept, eine Idee, eine Seite.** Kein Demonstrator erklärt; er lässt erleben. Die Erklärung steht auf der Konzeptseite, auf die der Footer verlinkt.
- **Nichts vorwegnehmen, was Teamentscheidung oder Entdeckung ist.** Keine vorgegebene Bit-zu-Farbe-Zuordnung (Entscheidung vom 02.09.2026 beim Byte Switchboard), keine Rahmenformate vor der Normungssitzung, keine Taktstrategie als Rezept vor Sitzung 7.
- **Simulation statt Behauptung, aber ehrlich beschriftet.** Wo Rauschen simuliert wird, steht dabei, dass die echten Zahlen von der eigenen Strecke kommen; die Demo ersetzt keine Messung, sie macht die Struktur des Zusammenhangs sichtbar.
- Technisch gelten die Regeln aus dem README: kein Build, keine Abhängigkeiten, gemeinsames Look & Feel, bedienbar mit Maus, Touch und Tastatur.

## Bestand

**Question Game** (Symbole und Information, live): „Wer ist es?" als Informationsmessgerät. 16 KI-generierte Gesichter, neun Merkmalfragen (Splits bewusst verborgen, das Auszählen ist die Strategiearbeit); nach jeder Antwort rechnet ein Modal in Modulnotation vor: I = H₁ − H₂, samt Erwartungswert der Frage. Rateklicks zählen als Frage. Ergebnis: Fragenzahl, Bits gesamt, Bits je Frage gegen die Halbierungsstrategie.

**The Copier** (Analog und digital, live): eine Kopienwand. Jeder Druck auf "copy" haengt die naechste analoge Generation daneben (die Bilder schrumpfen, damit alles passt), Kopiersorgfalt in drei Worten statt Sigma; der Kontrastknopf "and as a file?" haengt die identische Dateikopie dazu. Ohne Obergrenze; drei Fotomotive (KI-generiert), geteilt mit dem Digitiser. Umgebaut am 03.09.2026 von der Zwei-Ketten-Fassung.

**The Digitiser** (Analog und digital, live): analoges Foto (drei Motive, geteilt mit dem Copier) gegen seine Digitalisierung; Regler fuer Aufloesung (256x256 bis hinunter zu 1 Pixel) und Farbtiefe (1 bit s/w, 8 bit grau, 8/16/24 bit Farbe), darunter die offene Rechnung Pixel x Bits = Dateigroesse plus Uebertragungsdauer bei 30 bit/s ueber die Lichtstrecke.

**The Audio Digitiser** (Analog und digital, live): dieselben zwei Schnitte fuers Ohr. Fuenf Klaenge (Melodie, kleines Bandstueck, Bassfigur und Vogelzwitschern prozedural, dazu eine KI-generierte Sprachaufnahme), Abtastrate 48 kHz bis 1 kHz und Bit-Tiefe 16/12/8/4/2/1 bit; Treppenkurve ueber der glatten Welle, Abspielknoepfe fuer Original und Digitalfassung (Web Audio, keine Abhaengigkeit), Dateigroesse und Lichtstrecken-Dauer live. Bewusst naive Digitalisierung ohne Filter, ehrlich ausgewiesen.

**Byte Switchboard** (Zahlensysteme, live): acht Bits, Stellenwerte, Summenzeile, Binär, Dezimal, Hex, ASCII. Verlinkt von Deck 10, Folie 14.

**Distinguishability Lab** (Signal und Rauschen, live): verrauschter Kanal als Oszilloskop-Sweep, Alphabet und Messfenster als Regler, Störknopf, Zeitlupe, Einzelmessung per Taste, Fehlerquote und Durchsatz live.

**Pixel Painter** (Codesysteme, live): 8x8-Raster mit einem Bit je Pixel, daneben die acht Bytes binaer und als editierbare Hexfelder, beide Richtungen live; "break a byte" und "flip one bit" zeigen den Schaden rot, "repair" holt den heilen Stand zurueck.

**Drift Simulator** (Abtastung und Synchronisation, live): Sender legt eine Farbfolge in Zeitschlitze, die Empfängeruhr geht einstellbar falsch; Abtastpunkte wandern sichtbar, die Statistik zeigt den Versatz und die halbe-Schlitz-Grenze, eine zuschaltbare Sync-Marke richtet neu aus und kostet sichtbar Rate. Farben ohne Bit-Zuordnung (Priming-Regel).

## Die Kandidaten, nach Kurskonzepten

### Signal und Rauschen: „Unterscheidbarkeits-Labor"

Zwei (später k) Sendepegel auf einem verrauschten Kanal. Drei Regler: Abstand der Pegel, Messfensterlänge, Zahl der Symbole. Live entstehen die zwei Messwert-Wolken samt Überlappungszone und eine mitlaufende Fehlerquote aus simulierten Übertragungen; wer das Fenster verlängert, sieht die Wolken schmaler werden und die Symbolrate sinken. **Didaktischer Kern:** der zentrale Zielkonflikt des Projekts zum Anfassen, exakt die Struktur von Deck 07 und der d/s-Zeichnung; widerlegt sn-004 („dann eben höchste Integrationszeit") körperlich. Bewährtes Vorbild: Verteilungs-Overlap-Demos aus der Statistiklehre. **Aufwand: mittel. Priorität: hoch** (stärkster Kandidat, weil er das wichtigste Konzept trägt).

### Abtastung und Synchronisation: „Drift-Simulator"

Die animierte Fassung von Deck 09, Folie 7: oben der Sender mit Zeitschlitzen, darunter die Messpunkte des Empfängers, dazwischen zwei Uhren. Regler für Uhrenabweichung (in Prozent) und Symbolrate; man startet die Übertragung und sieht die Messpunkte über Sekunden aus den Schlitzen wandern, bis Zeichensalat entsteht. Ein Schalter „wiederkehrende Marke alle n Symbole" lässt den Fehler als Sägezahn zurückspringen. **Didaktischer Kern:** Drift ist ein Prozess in der Zeit, auf Folien immer nur eingefroren; hier läuft er. Deckt ca-001, ca-002 und die Marker-Mechanik ab. **Aufwand: mittel. Priorität: hoch** (Sitzung 7 steht als Nächstes an).

### Codesysteme: „Pixel-Maler"

Ein 8-mal-8-Raster zum Malen mit einem Bit je Pixel; daneben entstehen live die acht Bytes, binär und hex, und umgekehrt: Wer die Hexwerte edittiert, malt damit. Erweiterungsknopf „ein Byte kaputt": ein zufälliges Byte kippt und das Bild zeigt den Schaden. **Didaktischer Kern:** die Doppelrichtung Bild-zu-Bytes und Bytes-zu-Bild, also cs-008/cs-010 zum Anfassen, und nebenbei die Brücke zum Byte Switchboard. Bewährtes Vorbild: klassische Bitmap-Editoren aus CS-Unplugged-Material. **Aufwand: klein bis mittel. Priorität: hoch.**

### Codesysteme, zweite Idee: „Präfix-Falle"

Der Code, der nicht funktioniert, als Spiel: Der Besucher legt selbst Codewörter für a, b, c fest (Vorbelegung a=0, b=01, c=10), tippt eine Nachricht, und die Demo zeigt **alle** gültigen Lesarten der entstehenden Bitfolge. Wer einen präfixfreien Code baut, sieht die Lesartenliste auf eins schrumpfen. **Didaktischer Kern:** cs-004 erlebbar; die Einsicht „der Empfänger kann die Grenze nicht sehen" entsteht beim eigenen Scheitern. **Aufwand: klein. Priorität: mittel** (Folie 9 von Deck 08 trägt viel davon schon).

### Messen und Experimentieren: „Der verrauschte Sensor"

Ein Knopf „messen" liefert Werte aus einer versteckten Verteilung; jeder Druck malt einen Punkt, allmählich entsteht das Histogramm, Mittelwert und Streuung laufen mit. Ein zweiter Regler „Messungen mitteln (n)" zeigt, wie der Mittelwert ruhig wird, während Einzelwerte weiter springen. **Didaktischer Kern:** me-004 und sn-001, der Unterschied zwischen Einzelwert und Verteilung, vor der ersten echten Messreihe in Sitzung 3. **Aufwand: klein. Priorität: mittel** (das echte Gerät ist hier der bessere Demonstrator, die Demo dient der Vor- und Nachbereitung).

### Analog und digital: „Der Kopierer"

Ein Signal (oder ein kleines Bild) wird über Generationen kopiert. Links die analoge Kette: Jede Kopie addiert Rauschen, nach zehn Generationen ist das Original Matsch. Rechts die digitale Kette mit denselben Störungen, aber Schwellenentscheidung vor jeder Weitergabe: Generation 100 gleicht Generation 1. Ein Regler für die Rauschstärke zeigt auch die Grenze der digitalen Kette: Wird das Rauschen größer als der halbe Abstand, kippen Bits, und der Fehler bleibt dann für immer. **Didaktischer Kern:** ad-008 (Kassette gegen Datei) als Experiment, inklusive der ehrlichen Einschränkung, dass digital nicht magisch ist. Bewährtes Vorbild: generation-loss-Demos. **Aufwand: mittel. Priorität: mittel bis hoch** (starker Aha-Effekt, aber das Material zu Sitzung 4 ist bereits vollständig; die Demo wäre Anreicherung, keine Lücke).

### Symbole und Information: „Das Fragenspiel"

Die Demo denkt sich eines von N Dingen (N einstellbar: 8, 32, 100); der Besucher stellt Ja/Nein-Fragen über Bereichsklicks, ein Zähler läuft mit, und eine zweite Spur zeigt, was die Halbierungsstrategie gebraucht hätte: log2(N), aufgerundet. Umgekehrter Modus: schiefe Fragen zugelassen, und der Erwartungswert-Zähler zeigt, warum Halbieren im Schnitt gewinnt. **Didaktischer Kern:** si-009 und die schiefen Fragen aus Deck 06. **Aufwand: klein bis mittel. Priorität: mittel.**

### Fehler und Redundanz: „Bitkipper-Spielplatz"

Eine gerahmte Nachricht mit wählbarer Absicherung (nichts, Paritätsbit, Prüfsumme, Wiederholung); der Besucher kippt gezielt oder zufällig Bits und sieht, was der Empfänger merkt, was er repariert und was durchrutscht (zwei Kipper bei Parität!). Ein Zähler für den Overhead zeigt den Preis jeder Stufe. **Didaktischer Kern:** Erkennungsgrenzen und Kosten von Redundanz, die Kernfrage der Challenge-3-Konzepte. **Aufwand: mittel. Priorität: hoch, sobald Sitzung 8/9 näher rückt.**

### Durchsatz und Grenzen: „Der Challenge-4-Rechner"

Schieberegler für Farbzahl, Symbolrate, Markenanteil und Fehlerquote (mit Wiederholungs-Strategie); heraus kommt der effektive Durchsatz und live die Übertragungsdauer der 2-KB-Datei. **Didaktischer Kern:** ca-004 und die b-Unterscheidung von Deck 09, Folie 19, als Planungswerkzeug für die eigene Challenge-4-Strategie. **Aufwand: klein. Priorität: mittel** (bewusst neutral halten: rechnet Konsequenzen aus, empfiehlt keine Strategie).

### Kompression: „Nachricht schrumpfen"

Text eintippen; die Demo zeigt die Buchstabenhäufigkeiten, vergibt kurze Codes für Häufiges (vereinfachtes Huffman, als fertiger Baum sichtbar), und vergleicht die Bitlängen: feste Länge gegen häufigkeitsbasiert. **Didaktischer Kern:** die Kompressions-Aussicht aus Deck 06 (halbleere Behälter) konkret. **Aufwand: mittel. Priorität: niedrig bis mittel**, je nachdem, wie viel Raum Kompression im Semester bekommt.

### Verschlüsselung: „Caesar knacken"

Caesar-verschlüsselten Text per Häufigkeitsanalyse brechen: Balkendiagramm der Buchstabenhäufigkeiten neben der Normalverteilung der Sprache, Verschiebung per Regler, der Klartext kippt sichtbar ins Lesbare. **Didaktischer Kern:** Verschlüsselung ist eine Vereinbarung, und schwache Vereinbarungen verraten sich statistisch. Bewährter Klassiker. **Aufwand: klein. Priorität: niedrig** (spätes Konzept, kleiner Semesteranteil).

### Abstraktion und Schichten: „Finde den Fehler im Stapel"

Der Schichtenstapel als klickbares Diagnose-Spiel: Irgendwo steckt ein injizierter Fehler; der Besucher darf an jeder Schnittstelle „messen" (Was kommt hier an?) und soll mit möglichst wenigen Messungen die kaputte Schicht finden. **Didaktischer Kern:** al-006 als Spiel, Fehlereingrenzung entlang von Schnittstellen als Strategie statt als Predigt. **Aufwand: mittel. Priorität: mittel** (charmant, aber die Werkstatt liefert dieselbe Erfahrung am echten Gerät).

### Bewusst ohne Demo

**Problemzerlegung, IPO, Algorithmen und Programme, Protokolle, Information und Träger, Verarbeitung:** Entweder trägt das echte Gerät samt Werkstatt die Erfahrung besser (Zerlegung, Algorithmen, Protokolle: der Rahmen entsteht in der Normungssitzung und gehört nicht vorgebaut), oder das Konzept ist so unmittelbar, dass eine Demo nur dekorieren würde. Das Fragenspiel deckt die informationstheoretische Seite der Problemzerlegung (Halbieren) gleich mit ab.

## Vorschlag für die Reihenfolge

1. **Drift-Simulator** (Sitzung 7 steht bevor, direkter Foliennutzen in Deck 09)
2. **Unterscheidbarkeits-Labor** (trägt das wichtigste Konzept des Projekts, nützlich ab sofort zur Nachbereitung von Sitzung 5)
3. **Pixel-Maler** (kleiner Aufwand, großer Aha, verstärkt Deck 08)
4. Danach nach Semesterfortschritt: Bitkipper-Spielplatz vor Sitzung 8/9, Challenge-4-Rechner vor dem Finale.
