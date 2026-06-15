"""Coaching analytics: athlete performance trends + AI recommendations.

Aggregates an athlete's race analyses into trend series (route efficiency,
time-loss, navigation errors, scores over time) and generates concrete coaching
recommendations from those trends.
"""
from __future__ import annotations

from typing import Dict, List


def athlete_trends(races: List[dict]) -> dict:
    """Build trend series from a list of analysed races.

    Each ``races`` item: {name, date, scores, metrics, legs, mistakes}.
    """
    series: List[dict] = []
    for r in sorted(races, key=lambda x: x.get("date") or ""):
        scores = r.get("scores", {})
        legs = r.get("legs", [])
        mistakes = r.get("mistakes", [])
        effs = [l["efficiency"] for l in legs if l.get("efficiency") is not None]
        route_eff = round(sum(effs) / len(effs) * 100, 1) if effs else None
        time_loss = round(sum(l.get("time_loss_s", 0) or 0 for l in legs), 1)
        nav_errors = len([m for m in mistakes if m.get("type") in
                          ("relocation", "map_contact_loss", "direction_error")])
        series.append({
            "race": r.get("name"),
            "date": r.get("date"),
            "overall": scores.get("overall"),
            "navigation": scores.get("navigation"),
            "fitness": scores.get("fitness"),
            "execution": scores.get("execution"),
            "route_choice": scores.get("route_choice"),
            "route_efficiency_pct": route_eff,
            "time_loss_s": time_loss,
            "nav_errors": nav_errors,
        })
    return {"series": series, "summary": _trend_summary(series)}


def _slope(values: List[float]) -> float:
    """Least-squares slope of a series (per step); robust to short series."""
    pts = [(i, v) for i, v in enumerate(values) if v is not None]
    n = len(pts)
    if n < 2:
        return 0.0
    sx = sum(i for i, _ in pts)
    sy = sum(v for _, v in pts)
    sxx = sum(i * i for i, _ in pts)
    sxy = sum(i * v for i, v in pts)
    denom = n * sxx - sx * sx
    return (n * sxy - sx * sy) / denom if denom else 0.0


def _trend_summary(series: List[dict]) -> dict:
    def col(key):
        return [s[key] for s in series]
    return {
        "navigation_slope": round(_slope(col("navigation")), 2),
        "route_efficiency_slope": round(_slope(col("route_efficiency_pct")), 2),
        "time_loss_slope": round(_slope(col("time_loss_s")), 2),
        "nav_errors_slope": round(_slope([float(x) if x is not None else None
                                          for x in col("nav_errors")]), 2),
        "races": len(series),
    }


def coaching_recommendations(trends: dict) -> Dict[str, List[str]]:
    summary = trends.get("summary", {})
    series = trends.get("series", [])
    recs: List[str] = []
    focus: List[str] = []

    if summary.get("races", 0) < 2:
        return {
            "recommendations": ["Log at least two analysed races to unlock trend-based coaching."],
            "focus_areas": [],
        }

    if summary.get("navigation_slope", 0) < -1.0:
        recs.append("Navigation scores are trending down — prioritise simplification and "
                    "map-contact drills before the next race.")
        focus.append("navigation")
    elif summary.get("navigation_slope", 0) > 1.0:
        recs.append("Navigation is improving steadily — keep reinforcing your current "
                    "map-reading routine.")

    if summary.get("route_efficiency_slope", 0) < -1.0:
        recs.append("Route efficiency is declining; review longer legs and practise "
                    "choosing the straightest runnable line.")
        focus.append("route_choice")

    if summary.get("time_loss_slope", 0) > 5.0:
        recs.append("Cumulative time loss is rising race-on-race — add pressure training "
                    "to keep execution clean at speed.")
        focus.append("execution")

    if summary.get("nav_errors_slope", 0) > 0.5:
        recs.append("Navigation errors per race are increasing — slow down at control "
                    "approaches and confirm features before committing.")
        focus.append("navigation")

    # Identify the single weakest recent dimension.
    if series:
        last = series[-1]
        dims = {k: last.get(k) for k in ("navigation", "fitness", "execution", "route_choice")}
        dims = {k: v for k, v in dims.items() if v is not None}
        if dims:
            weakest = min(dims, key=dims.get)
            if dims[weakest] < 70:
                recs.append(f"Most recent race shows {weakest.replace('_', ' ')} as the weakest "
                            f"area ({dims[weakest]:.0f}/100) — make it this block's priority.")
                focus.append(weakest)

    if not recs:
        recs.append("Performance is stable and balanced — maintain training and target "
                    "marginal gains in your strongest discipline.")
    return {"recommendations": recs, "focus_areas": sorted(set(focus))}
