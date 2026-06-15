"""Training analytics: volume, trends, training load, readiness, and PBs.

Operates on :class:`TrainingSession` rows (built from uploaded tracks) plus race
analyses. Computes weekly/monthly aggregates, rolling trends, an acute:chronic
training-load ratio, and a race-readiness score.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional


def _iso_week(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def _month(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def session_load(duration_s: float, avg_hr: Optional[float], avg_speed_kmh: float) -> float:
    """Training Impulse (TRIMP)-style load.

    Uses HR when available (duration_min * HR-fraction), else falls back to a
    duration×intensity estimate from speed so every session gets a real load.
    """
    minutes = duration_s / 60.0
    if avg_hr and avg_hr > 0:
        # Fraction of a nominal 190 bpm max, scaled.
        frac = max(0.3, min(1.0, avg_hr / 190.0))
        return round(minutes * frac * 1.5, 1)
    intensity = max(0.4, min(1.4, avg_speed_kmh / 10.0))
    return round(minutes * intensity, 1)


def weekly_volume(sessions: List[dict]) -> List[dict]:
    buckets: Dict[str, dict] = defaultdict(
        lambda: {"distance_km": 0.0, "duration_h": 0.0, "climb_m": 0.0, "load": 0.0, "sessions": 0}
    )
    for s in sessions:
        if not s.get("date"):
            continue
        wk = _iso_week(s["date"])
        b = buckets[wk]
        b["distance_km"] += s["distance_m"] / 1000.0
        b["duration_h"] += s["duration_s"] / 3600.0
        b["climb_m"] += s["climb_m"]
        b["load"] += s["load"]
        b["sessions"] += 1
    return [
        {"week": wk, **{k: round(v, 2) for k, v in vals.items()}}
        for wk, vals in sorted(buckets.items())
    ]


def monthly_volume(sessions: List[dict]) -> List[dict]:
    buckets: Dict[str, dict] = defaultdict(
        lambda: {"distance_km": 0.0, "duration_h": 0.0, "climb_m": 0.0, "load": 0.0, "sessions": 0}
    )
    for s in sessions:
        if not s.get("date"):
            continue
        mo = _month(s["date"])
        b = buckets[mo]
        b["distance_km"] += s["distance_m"] / 1000.0
        b["duration_h"] += s["duration_s"] / 3600.0
        b["climb_m"] += s["climb_m"]
        b["load"] += s["load"]
        b["sessions"] += 1
    return [
        {"month": mo, **{k: round(v, 2) for k, v in vals.items()}}
        for mo, vals in sorted(buckets.items())
    ]


def speed_hr_trends(sessions: List[dict]) -> List[dict]:
    out = []
    for s in sorted(sessions, key=lambda x: x.get("date") or date.min):
        out.append({
            "date": s["date"].isoformat() if s.get("date") else None,
            "avg_speed_kmh": round(s.get("avg_speed_kmh", 0.0), 2),
            "avg_hr": s.get("avg_hr"),
            "distance_km": round(s["distance_m"] / 1000.0, 2),
        })
    return out


def acute_chronic_load(sessions: List[dict], ref: Optional[date] = None) -> dict:
    """Acute (7d) vs chronic (28d) load ratio — a standard overtraining proxy."""
    ref = ref or date.today()
    acute = sum(
        s["load"] for s in sessions
        if s.get("date") and ref - timedelta(days=7) <= s["date"] <= ref
    )
    chronic_total = sum(
        s["load"] for s in sessions
        if s.get("date") and ref - timedelta(days=28) <= s["date"] <= ref
    )
    chronic = chronic_total / 4.0  # weekly-equivalent average
    ratio = (acute / chronic) if chronic > 0 else 0.0
    if ratio == 0:
        zone = "no_data"
    elif ratio < 0.8:
        zone = "detraining"
    elif ratio <= 1.3:
        zone = "optimal"
    elif ratio <= 1.5:
        zone = "caution"
    else:
        zone = "high_risk"
    return {
        "acute_load": round(acute, 1),
        "chronic_load": round(chronic, 1),
        "acwr": round(ratio, 2),
        "zone": zone,
    }


def race_readiness(sessions: List[dict], nav_scores: List[float]) -> dict:
    """Composite 0-100 readiness from load balance, volume, and navigation form."""
    acwr = acute_chronic_load(sessions)
    # Load-balance component: best when ACWR is in the optimal band.
    r = acwr["acwr"]
    if r == 0:
        load_score = 40.0
    elif 0.8 <= r <= 1.3:
        load_score = 100.0
    elif r < 0.8:
        load_score = max(40.0, 100.0 - (0.8 - r) * 120.0)
    else:
        load_score = max(20.0, 100.0 - (r - 1.3) * 120.0)
    # Recent volume component (sessions in last 28 days, target ~12).
    recent = [s for s in sessions if s.get("date") and s["date"] >= date.today() - timedelta(days=28)]
    volume_score = min(100.0, len(recent) / 12.0 * 100.0)
    # Navigation form from recent race scores.
    nav_score = sum(nav_scores) / len(nav_scores) if nav_scores else 60.0
    readiness = round(0.4 * load_score + 0.3 * volume_score + 0.3 * nav_score, 1)
    return {
        "readiness": readiness,
        "load_score": round(load_score, 1),
        "volume_score": round(volume_score, 1),
        "navigation_score": round(nav_score, 1),
        "acwr": acwr,
    }


def compute_personal_bests(sessions: List[dict]) -> List[dict]:
    """Derive simple PBs from sessions: longest run, fastest avg pace, biggest climb."""
    pbs: List[dict] = []
    if not sessions:
        return pbs
    longest = max(sessions, key=lambda s: s["distance_m"])
    pbs.append({"category": "longest_run", "value": round(longest["distance_m"] / 1000.0, 2),
                "unit": "km", "date": longest["date"].isoformat() if longest.get("date") else None})
    moving = [s for s in sessions if s.get("avg_speed_kmh", 0) > 0]
    if moving:
        fastest = max(moving, key=lambda s: s["avg_speed_kmh"])
        pbs.append({"category": "fastest_avg_speed", "value": round(fastest["avg_speed_kmh"], 2),
                    "unit": "km/h", "date": fastest["date"].isoformat() if fastest.get("date") else None})
    biggest_climb = max(sessions, key=lambda s: s["climb_m"])
    pbs.append({"category": "biggest_climb", "value": round(biggest_climb["climb_m"], 0),
                "unit": "m", "date": biggest_climb["date"].isoformat() if biggest_climb.get("date") else None})
    return pbs
