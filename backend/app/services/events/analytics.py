"""Event-wide analytics: leaderboards, leg-by-leg rankings, route comparison.

Operates on parsed :class:`EventResults` (split times for the whole field) plus,
where available, per-competitor GPS analyses for route-choice comparison. All
computation is deterministic.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from app.services.events.results import CompetitorResult, EventResults


def _control_order(competitors: List[CompetitorResult]) -> List[str]:
    """Derive the canonical control sequence for a course from its results."""
    best: List[str] = []
    for c in competitors:
        seq = [s["code"] for s in c.splits]
        if len(seq) > len(best):
            best = seq
    return best


def build_leaderboard(competitors: List[CompetitorResult]) -> List[dict]:
    finishers = [c for c in competitors if c.status == "ok" and c.total_time_s]
    finishers.sort(key=lambda c: c.total_time_s)
    leader = finishers[0].total_time_s if finishers else None
    rows: List[dict] = []
    for i, c in enumerate(finishers, start=1):
        rows.append({
            "position": i,
            "name": c.name,
            "total_time_s": round(c.total_time_s, 1),
            "behind_s": round(c.total_time_s - leader, 1) if leader is not None else 0.0,
            "status": c.status,
        })
    # Append non-finishers at the end.
    for c in competitors:
        if c.status != "ok" or not c.total_time_s:
            rows.append({
                "position": None, "name": c.name,
                "total_time_s": None, "behind_s": None, "status": c.status,
            })
    return rows


def build_leg_rankings(competitors: List[CompetitorResult]) -> List[dict]:
    order = _control_order(competitors)
    legs: List[dict] = []
    prev_code = "S"
    for code in order:
        times: List[tuple[str, float]] = []
        for c in competitors:
            for s in c.splits:
                if s["code"] == code and s["time_s"] and s["time_s"] > 0:
                    times.append((c.name, s["time_s"]))
                    break
        times.sort(key=lambda x: x[1])
        best = times[0][1] if times else None
        rankings = [
            {
                "rank": r,
                "name": name,
                "time_s": round(t, 1),
                "behind_s": round(t - best, 1) if best is not None else 0.0,
            }
            for r, (name, t) in enumerate(times, start=1)
        ]
        legs.append({
            "leg": len(legs) + 1,
            "from_control": prev_code,
            "to_control": code,
            "best_s": round(best, 1) if best is not None else None,
            "rankings": rankings,
        })
        prev_code = code
    return legs


def build_route_comparison(
    competitors: List[CompetitorResult],
    analyses_by_name: Dict[str, dict],
) -> List[dict]:
    """Per-leg distance + efficiency comparison for competitors with GPS."""
    order = _control_order(competitors)
    legs: List[dict] = []
    prev_code = "S"
    for li, code in enumerate(order, start=1):
        comp_rows: List[dict] = []
        for c in competitors:
            analysis = analyses_by_name.get(c.name)
            if not analysis:
                continue
            leg = next(
                (l for l in analysis.get("legs", []) if l.get("number") == li),
                None,
            )
            if leg and leg.get("distance_m"):
                comp_rows.append({
                    "name": c.name,
                    "distance_m": round(leg["distance_m"], 1),
                    "efficiency": leg.get("efficiency"),
                    "time_loss_s": leg.get("time_loss_s"),
                })
        if comp_rows:
            comp_rows.sort(key=lambda r: r["distance_m"])
            legs.append({
                "leg": li,
                "from_control": prev_code,
                "to_control": code,
                "competitors": comp_rows,
            })
        prev_code = code
    return legs


def build_event_analysis(
    results: EventResults,
    analyses_by_name: Optional[Dict[str, dict]] = None,
) -> dict:
    analyses_by_name = analyses_by_name or {}
    by_course = results.by_course()
    leaderboards: Dict[str, list] = {}
    leg_rankings: Dict[str, list] = {}
    route_comparison: Dict[str, list] = {}
    total_finishers = 0
    for course, comps in by_course.items():
        leaderboards[course] = build_leaderboard(comps)
        leg_rankings[course] = build_leg_rankings(comps)
        rc = build_route_comparison(comps, analyses_by_name)
        if rc:
            route_comparison[course] = rc
        total_finishers += sum(1 for c in comps if c.status == "ok" and c.total_time_s)

    stats = {
        "courses": len(by_course),
        "competitors": len(results.competitors),
        "finishers": total_finishers,
        "gps_matched": len(analyses_by_name),
    }
    return {
        "leaderboards": leaderboards,
        "leg_rankings": leg_rankings,
        "route_comparison": route_comparison,
        "stats": stats,
    }
