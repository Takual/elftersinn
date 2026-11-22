#!/usr/bin/env python3
"""ELFTER SINN – spiegelt die Schlussquoten der Bundesliga von football-data.co.uk ins Repository.

Quelle: https://www.football-data.co.uk/mmz4281/<Saison>/D1.csv (Saison 2026/27 = 2627).
Übernommen werden nur die Spalten, die für den Nachtrag nach Abschnitt 3a gebraucht werden:
Datum, Anstoß, Teams, Endstand und die Durchschnitts-Schlussquoten AvgCH/AvgCD/AvgCA.
Ergebnis: quoten/schlussquoten_<Saison>.json (wird bei jedem Lauf komplett aus der CSV neu erzeugt;
die CSV ist die Quelle, nichts wird geschätzt oder ergänzt).

Aufruf: python3 tools/fetch_closing.py [Saison]   (Standard: 2627)
"""
import csv
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COLS = ["Date", "Time", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "AvgCH", "AvgCD", "AvgCA"]


def num(v, cast=float):
    try:
        return cast(v) if v not in (None, "") else None
    except ValueError:
        return None


def main(season="2627"):
    url = f"https://www.football-data.co.uk/mmz4281/{season}/D1.csv"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ELFTER SINN data mirror)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode("utf-8-sig", errors="replace")
    rows = []
    for row in csv.DictReader(io.StringIO(text)):
        if not row.get("HomeTeam"):
            continue
        d = datetime.strptime(row["Date"], "%d/%m/%Y" if len(row["Date"]) == 10 else "%d/%m/%y").date()
        rows.append({
            "date": d.isoformat(),
            "time_uk": row.get("Time") or None,
            "home": row["HomeTeam"],
            "away": row["AwayTeam"],
            "fthg": num(row.get("FTHG"), int),
            "ftag": num(row.get("FTAG"), int),
            "avg_closing_1": num(row.get("AvgCH")),
            "avg_closing_x": num(row.get("AvgCD")),
            "avg_closing_2": num(row.get("AvgCA")),
        })
    out = {
        "source": url,
        "columns": "AvgCH/AvgCD/AvgCA = Durchschnitts-Schlussquote über alle Buchmacher (football-data.co.uk)",
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "last_match_date": max((r["date"] for r in rows), default=None),
        "matches": rows,
    }
    p = ROOT / "quoten" / f"schlussquoten_{season}.json"
    p.parent.mkdir(exist_ok=True)
    old = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    if old.get("matches") == rows:
        print(f"Keine neuen Daten (letztes Spiel {out['last_match_date']}).")
        return
    p.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(rows)} Spiele gespeichert, letztes Spiel {out['last_match_date']}.")


if __name__ == "__main__":
    main(*(sys.argv[1:2]))
