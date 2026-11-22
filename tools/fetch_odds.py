#!/usr/bin/env python3
"""ELFTER SINN – holt 1X2-Quoten für Bundesliga-Spiele kurz vor Anpfiff (The Odds API).

Läuft als GitHub Action (.github/workflows/quoten.yml). Ablauf:
  1. Kostenloser Abruf der anstehenden Spiele (/events, verbraucht keine Credits).
  2. Nur wenn ein Spiel in 50–100 Minuten angepfiffen wird: ein Quotenabruf
     (/odds, markets=h2h, regions=eu → 1 Credit).
  3. Speichert je Spiel alle Buchmacherquoten plus den Durchschnitt in
     quoten/<Datum>.json (Liste von Snapshots, wird nur ergänzt, nie überschrieben).

Der API-Schlüssel kommt ausschließlich aus der Umgebungsvariablen ODDS_API_KEY
(GitHub-Secret). Er wird nie gespeichert oder ausgegeben.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://api.the-odds-api.com/v4/sports/soccer_germany_bundesliga"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "quoten"
BERLIN = ZoneInfo("Europe/Berlin")
WINDOW_MIN, WINDOW_MAX = 50, 100  # Minuten vor Anpfiff


def get(path, **params):
    params["apiKey"] = os.environ["ODDS_API_KEY"]
    url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as r:
        remaining = r.headers.get("x-requests-remaining")
        return json.load(r), remaining


def parse(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def main():
    if not os.environ.get("ODDS_API_KEY"):
        sys.exit("ODDS_API_KEY fehlt (GitHub-Secret anlegen).")
    now = datetime.now(timezone.utc)
    events, _ = get("events")
    due = [e for e in events
           if WINDOW_MIN <= (parse(e["commence_time"]) - now).total_seconds() / 60 <= WINDOW_MAX]
    if not due:
        print("Kein Spiel im Fenster 50–100 Min. vor Anpfiff – kein Quotenabruf.")
        return
    odds, remaining = get("odds", regions="eu", markets="h2h", oddsFormat="decimal",
                          eventIds=",".join(e["id"] for e in due))
    captured = datetime.now(timezone.utc)
    snaps = []
    for ev in odds:
        ko = parse(ev["commence_time"])
        home, away = ev["home_team"], ev["away_team"]
        books = {}
        for b in ev.get("bookmakers", []):
            for m in b.get("markets", []):
                if m.get("key") != "h2h":
                    continue
                p = {o["name"]: o["price"] for o in m.get("outcomes", [])}
                if home in p and away in p and "Draw" in p:
                    books[b["key"]] = {"odds_1": p[home], "odds_x": p["Draw"], "odds_2": p[away],
                                       "last_update": m.get("last_update")}
        avg = None
        if books:
            n = len(books)
            avg = {k: round(sum(v[k] for v in books.values()) / n, 2) for k in ("odds_1", "odds_x", "odds_2")}
        snaps.append({
            "event_id": ev["id"],
            "home_team": home,
            "away_team": away,
            "kickoff": ko.astimezone(BERLIN).isoformat(),
            "captured_at": captured.astimezone(BERLIN).isoformat(timespec="seconds"),
            "minutes_before_kickoff": round((ko - captured).total_seconds() / 60),
            "source": "The Odds API (regions=eu, h2h)",
            "bookmaker_count": len(books),
            "average": avg,
            "bookmakers": books,
        })
    OUT.mkdir(exist_ok=True)
    f = OUT / f"{captured.astimezone(BERLIN).date().isoformat()}.json"
    data = json.loads(f.read_text(encoding="utf-8")) if f.exists() else []
    data.extend(snaps)
    f.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    for s in snaps:
        print(f"{s['home_team']} – {s['away_team']}: Ø {s['average']} ({s['bookmaker_count']} Buchmacher, "
              f"{s['minutes_before_kickoff']} Min. vor Anpfiff)")
    print(f"Verbleibende Credits: {remaining}")


if __name__ == "__main__":
    main()
