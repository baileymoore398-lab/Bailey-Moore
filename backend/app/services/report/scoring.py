"""Performance scoring (0-100) derived from real analysis metrics.

Four sub-scores plus an overall. Each is computed from concrete quantities:

* navigation  — penalised by mistakes and time lost relative to total time
* fitness     — from moving ratio and pace relative to a discipline baseline
* execution   — from stoppage time and hesitation count
* route_choice— from average leg efficiency (actual vs optimal distance)
"""
from __future__ import annotations

from typing import Dict, List

# Reference clean paces (min/km) used to anchor the fitness score per discipline.
DISCIPLINE_BASELINE_PACE = {
    "orienteering": 6.0,
    "mtbo": 3.0,
    "rogaining": 7.5,
    "adventure": 7.0,
    "trail": 5.5,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def compute_scores(
    metrics: Dict[str, float],
    events: List[dict],
    legs: List[dict],
    route_legs: List[dict],
    discipline: str = "orienteering",
) -> Dict[str, float]:
    duration = max(1.0, metrics.get("duration_s", 1.0))
    moving = metrics.get("moving_time_s", duration)

    # --- Navigation: time lost to mistakes vs total race time. ---
    lost = sum(e.get("lost_s", 0.0) for e in events)
    # Also include split time-loss signal if available.
    split_loss = sum(l.get("time_loss_s", 0.0) for l in legs) if legs else 0.0
    nav_loss_ratio = (lost + 0.5 * split_loss) / duration
    navigation = _clamp(100.0 - nav_loss_ratio * 180.0)

    # --- Execution: stoppage + hesitation density. ---
    stop_time = sum(e.get("lost_s", 0.0) for e in events if e.get("type") == "stop")
    hesitations = sum(1 for e in events if e.get("type") == "hesitation")
    stop_ratio = stop_time / duration
    execution = _clamp(100.0 - stop_ratio * 220.0 - hesitations * 3.0)

    # --- Fitness: pace vs baseline + moving ratio. ---
    baseline = DISCIPLINE_BASELINE_PACE.get(discipline, 6.0)
    pace = metrics.get("avg_pace_min_km", baseline)
    if pace <= 0:
        pace = baseline
    pace_score = _clamp(100.0 * (baseline / pace))
    moving_ratio = moving / duration
    fitness = _clamp(0.6 * pace_score + 0.4 * (moving_ratio * 100.0))

    # --- Route choice: average leg efficiency. ---
    effs = [l["efficiency"] for l in route_legs if l.get("efficiency") is not None]
    if effs:
        route_choice = _clamp((sum(effs) / len(effs)) * 100.0)
    else:
        # Fall back to navigation as a proxy when no control geometry exists.
        route_choice = navigation

    overall = _clamp(
        0.35 * navigation
        + 0.2 * fitness
        + 0.2 * execution
        + 0.25 * route_choice
    )
    return {
        "navigation": round(navigation, 1),
        "fitness": round(fitness, 1),
        "execution": round(execution, 1),
        "route_choice": round(route_choice, 1),
        "overall": round(overall, 1),
    }
