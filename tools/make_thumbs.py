# -*- coding: utf-8 -*-
"""Erzeugt aus jeder preview.png (1200x630, der Open-Graph-Screenshot einer Demo)
ein thumb.png fuer die Karte auf der Uebersichtsseite: Kopfzeile und Titel oben
abgeschnitten, damit die Karte die Sache selbst zeigt, auf 600 Pixel Breite
verkleinert. Schreibt nur, wenn sich der Inhalt aendert.

Aufruf im Repo-Stamm: python tools/make_thumbs.py
"""
import io, os, sys
from pathlib import Path
from PIL import Image

STAMM = Path(__file__).resolve().parent.parent
OBEN = 140           # Kopfzeile und h1 der Demo
BREITE = 600


def thumb(preview: Path) -> bytes:
    im = Image.open(preview).convert("RGB")
    w, h = im.size
    im = im.crop((0, OBEN, w, h))
    im = im.resize((BREITE, round(im.height * BREITE / w)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def main() -> int:
    geschrieben = 0
    for preview in sorted(STAMM.glob("*/preview.png")):
        ziel = preview.with_name("thumb.png")
        neu = thumb(preview)
        if ziel.exists() and ziel.read_bytes() == neu:
            continue
        ziel.write_bytes(neu)
        geschrieben += 1
        print(f"{ziel.relative_to(STAMM)}  {len(neu) // 1024} KB")
    print(f"{geschrieben} Vorschaubild(er) geschrieben")
    return 0


if __name__ == "__main__":
    sys.exit(main())
