#!/usr/bin/env python3
"""ELFTER SINN – erzeugt die öffentlichen Datendateien der Webseite.

Liest die interne Arbeitsdatei site-data.json und schreibt:
  data/aktuell.json  – aktueller Spieltag, Bilanz, Tabelle, Lage (wird bei jedem Lauf neu erzeugt)
  data/archiv.json   – alle abgeschlossenen Spieltage

Interne Felder (update_log, Prüfsummen-Hinweise, Rekonstruktions-Vermerke, odds_source_policy)
werden NICHT übernommen. Fehlende Werte bleiben null – es wird nichts ergänzt oder geschätzt.

Aufruf:  python3 tools/export_public.py PFAD/zu/site-data.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def g(obj, *keys, default=None):
    for k in keys:
        if not isinstance(obj, dict):
            return default
        obj = obj.get(k)
    return default if obj is None else obj


def market_public(m):
    if not m:
        return None
    return {
        "p1": m.get("implied_prob_1_pct"),
        "px": m.get("implied_prob_x_pct"),
        "p2": m.get("implied_prob_2_pct"),
        "favorite": m.get("market_favorite"),
        "alignment": m.get("market_alignment"),
        "captured_at": m.get("captured_at"),
        "type": m.get("snapshot_type"),
    }


def bet_public(b, vb):
    b = b or {}
    vb = vb or {}
    return {
        "odds": b.get("used_odds"),
        "captured_at": b.get("captured_at"),
        "stake": vb.get("stake_eur"),
        "payout": vb.get("payout_eur"),
        "profit_loss": vb.get("profit_loss_eur"),
    }


def match_public(m, with_detail=True):
    a = m.get("analysis") or {}
    r = m.get("result") or {}
    out = {
        "date": m.get("date"),
        "kickoff": m.get("kickoff"),
        "kickoff_iso": m.get("kickoff_iso"),
        "home": m.get("home"),
        "away": m.get("away"),
        "home_code": m.get("home_code"),
        "away_code": m.get("away_code"),
        "tip": {
            "score": g(m, "tip", "score"),
            "tendency": g(m, "tip", "tendency"),
            "final": bool(g(m, "tip", "final", default=False)),
        },
        "market": market_public(m.get("market")),
        "risk": a.get("risk"),
        "risk_tip": bool(a.get("risk_tip")),
        "short": a.get("short"),
        "result": {
            "score": r.get("score"),
            "tendency": r.get("tendency"),
            "exact_hit": r.get("exact_hit"),
            "tendency_hit": r.get("tendency_hit"),
        },
        "bet": bet_public(m.get("bet_odds"), m.get("virtual_bet")),
    }
    if with_detail:
        out.update({
            "main_arguments": a.get("main_arguments") or [],
            "counter_arguments": a.get("counter_arguments") or [],
            "decisive_factor": a.get("decisive_factor"),
            "why_this_score": a.get("why_this_score"),
            "alternative_score": a.get("alternative_score"),
            "reason_against_market": a.get("reason_against_market"),
        })
    pa = m.get("post_analysis")
    if pa:
        out["post_analysis"] = {"error_class": pa.get("error_class"), "note": pa.get("note")}
    return out


def main(src):
    d = json.loads(Path(src).read_text(encoding="utf-8"))
    meta, ss, cur = d["meta"], d["season_summary"], d["current"]
    teams = d.get("teams") or []

    aktuell = {
        "project": "ELFTER SINN",
        "season": meta.get("season"),
        "updated_at": meta.get("generated_at"),
        "last_completed_matchday": meta.get("last_completed_matchday"),
        "note": meta.get("data_note"),
        "summary": {
            "tendency_accuracy_pct": ss.get("tendency_accuracy_pct"),
            "exact_hits": ss.get("exact_hits"),
            "matches_analyzed": ss.get("matches_analyzed"),
            "stake_total": ss.get("virtual_total_stake_eur"),
            "payout_total": ss.get("virtual_total_payout_eur"),
            "profit_loss": ss.get("virtual_profit_loss_eur"),
            "roi_pct": ss.get("virtual_roi_pct"),
            "incl_backfill": {
                k: g(ss, "virtual_incl_backfill", k)
                for k in ["stake_eur", "payout_eur", "profit_loss_eur", "roi_pct", "backfilled_bets"]
            },
            "pending_backfill": len(g(ss, "virtual_incl_backfill", "pending_backfill", default=[])),
            "per_matchday": ss.get("per_matchday") or [],
            "by_favorite_probability": g(ss, "breakdown", "by_favorite_probability", default={}),
            "draw_tips": g(ss, "breakdown", "draw_tips"),
            "draw_tips_hit": g(ss, "breakdown", "draw_tips_hit"),
            "risk_tips": g(ss, "breakdown", "risk_tips", default={}),
            "kicktipp": {
                "name": ss.get("kicktipp_name"),
                "rank": ss.get("kicktipp_rank"),
                "points": ss.get("kicktipp_points"),
                "leader_points": ss.get("kicktipp_leader_points"),
                "as_of_matchday": ss.get("kicktipp_as_of_matchday"),
                "as_of_date": ss.get("kicktipp_as_of_date"),
            },
        },
        "current": {
            "matchday": cur.get("matchday"),
            "date_range": cur.get("date_range"),
            "matches": [match_public(m) for m in cur.get("matches") or []],
            "table": cur.get("table") or [],
            "table_note": cur.get("table_note"),
            "ticker": cur.get("ticker") or [],
            "weekly_insights": cur.get("weekly_insights") or [],
            "team_analyses": [
                {
                    "team": t.get("team"),
                    "status": t.get("status"),
                    "assessment": t.get("assessment"),
                    "consequence": t.get("consequence_for_tips"),
                    "updated_at": t.get("updated_at"),
                }
                for t in cur.get("team_analyses") or []
            ],
            "news": [
                {k: n.get(k) for k in ["date", "team", "message", "source"]}
                for n in (cur.get("news_log") or [])[-40:]
            ][::-1],
        },
        "teams": [
            {"team": t.get("team"), "code": t.get("code"), "form": t.get("current_form") or [],
             "tip_record": t.get("tip_history")}
            for t in teams
        ],
    }

    archiv = {
        "season": meta.get("season"),
        "updated_at": meta.get("generated_at"),
        "matchdays": [
            {
                "matchday": md.get("matchday"),
                "date_range": md.get("date_range"),
                "matches": [match_public(m, with_detail=False) for m in md.get("matches") or []],
                "learnings": md.get("learnings") or [],
            }
            for md in g(d, "history", "matchdays", default=[])
        ][::-1],
    }

    (ROOT / "data").mkdir(exist_ok=True)
    for name, obj in [("aktuell.json", aktuell), ("archiv.json", archiv)]:
        p = ROOT / "data" / name
        p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{p.relative_to(ROOT)}: {p.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
