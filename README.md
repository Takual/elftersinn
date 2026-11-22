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

## Quoten vor Anpfiff (GitHub Action)

`.github/workflows/quoten.yml` startet Fr/Sa/So stündlich `tools/fetch_odds.py`. Das Skript fragt
kostenlos die anstehenden Spiele bei The Odds API ab und holt nur dann 1X2-Quoten (1 Credit), wenn ein
Spiel in 50–100 Minuten angepfiffen wird. Ergebnis: `quoten/<Datum>.json` mit allen Buchmacherquoten
und dem Durchschnitt je Spiel. Der Quoten-Lauf von Claude liest diese Datei.

Einrichtung: API-Schlüssel als Repository-Secret `ODDS_API_KEY` hinterlegen
(Settings → Secrets and variables → Actions → New repository secret).
