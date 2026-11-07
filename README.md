# ELFTER SINN – elftersinn.de

KI-Tipps für die Bundesliga mit offener Bilanz. Statische Webseite, gehostet über GitHub Pages.

## Aufbau

| Pfad | Inhalt | Ändert sich |
|---|---|---|
| `index.html`, `css/`, `js/`, `assets/` | Seitengerüst, Design, Bilder | selten |
| `data/aktuell.json` | aktueller Spieltag, Bilanz, Tabelle, Teamlage, Meldungen | bei jedem Lauf |
| `data/archiv.json` | alle abgeschlossenen Spieltage | sonntags |
| `tools/export_public.py` | erzeugt die beiden JSON-Dateien aus der internen `site-data.json` | – |

Die Seite lädt beim Aufruf die JSON-Dateien und baut sich daraus selbst zusammen.

## Aktualisieren

```bash
python3 tools/export_public.py PFAD/zu/site-data.json
git add data/ && git commit -m "Daten: <Lauf>" && git push
```

Interne Felder (Update-Protokoll, Arbeitsvermerke) werden beim Export nicht übernommen.
Fehlende Werte bleiben `null` und erscheinen auf der Seite als „–“.
