"""AI coaching engine.

Produces a natural-language coaching report from the structured analysis. Uses
the OpenAI API when ``OPENAI_API_KEY`` is configured, and otherwise falls back
to a fully deterministic rule-based generator so the platform always returns a
real, specific report (never an empty placeholder).
"""
from __future__ import annotations

import json
import logging
from typing import Dict, List

from app.config import settings

logger = logging.getLogger(__name__)


def _fmt_time(seconds: float) -> str:
    seconds = int(round(seconds))
    m, s = divmod(seconds, 60)
    return f"{m}:{s:02d}"


def _rule_based_report(
    metrics: Dict[str, float],
    scores: Dict[str, float],
    events: List[dict],
    legs: List[dict],
    route_legs: List[dict],
) -> dict:
    strengths: List[str] = []
    weaknesses: List[str] = []
    mistakes: List[str] = []
    advice: List[str] = []

    # Strengths / weaknesses from scores.
    ranked = sorted(
        ("navigation", "fitness", "execution", "route_choice"),
        key=lambda k: scores.get(k, 0),
        reverse=True,
    )
    label = {
        "navigation": "navigation",
        "fitness": "physical fitness",
        "execution": "execution under pressure",
        "route_choice": "route choice",
    }
    top = ranked[0]
    if scores.get(top, 0) >= 70:
        strengths.append(
            f"Your strongest area was {label[top]} ({scores[top]:.0f}/100)."
        )
    bottom = ranked[-1]
    if scores.get(bottom, 100) < 70:
        weaknesses.append(
            f"{label[bottom].capitalize()} was your weakest area "
            f"({scores[bottom]:.0f}/100) and is the biggest opportunity to improve."
        )

    # Mistakes — pull the most costly events.
    costly = sorted(events, key=lambda e: e.get("lost_s", 0), reverse=True)[:4]
    for e in costly:
        if e.get("lost_s", 0) < 5:
            continue
        leg_txt = f" near leg {e['leg_number']}" if e.get("leg_number") else ""
        mistakes.append(
            f"{e.get('type', 'event').replace('_', ' ').capitalize()}{leg_txt}: "
            f"lost ~{_fmt_time(e.get('lost_s', 0))} ({e.get('description', '')})"
        )

    # Worst splits leg.
    if legs:
        worst = max(legs, key=lambda l: l.get("time_loss_s", 0))
        if worst.get("time_loss_s", 0) > 10:
            mistakes.append(
                f"Leg {worst['number']} ({worst['from_control']}→{worst['to_control']}) "
                f"cost {_fmt_time(worst['time_loss_s'])} versus the field best."
            )

    # Route efficiency feedback.
    bad_routes = [
        l for l in route_legs
        if l.get("efficiency") is not None and l["efficiency"] < 0.78
    ]
    if bad_routes:
        worst_route = min(bad_routes, key=lambda l: l["efficiency"])
        weaknesses.append(
            f"On leg {worst_route['leg_number']} "
            f"({worst_route['from_control']}→{worst_route['to_control']}) you ran "
            f"{worst_route['extra_distance_m']:.0f} m further than the direct line."
        )

    # Advice.
    if scores.get("navigation", 100) < 70:
        advice.append(
            "Practise map contact: fold your map to the leg in use and tick off "
            "features continuously to avoid the relocations seen in this race."
        )
    if scores.get("execution", 100) < 70:
        advice.append(
            "Reduce stoppage time by reading the next leg while approaching the "
            "control, so you leave each control already on a plan."
        )
    if scores.get("fitness", 100) < 65:
        advice.append(
            "Build aerobic base and terrain-specific running to lift your "
            "sustainable pace."
        )
    if scores.get("route_choice", 100) < 75:
        advice.append(
            "Before committing to a leg, scan for the straightest runnable line "
            "and only deviate for clear time savings."
        )
    if not advice:
        advice.append(
            "Strong, consistent race — maintain volume and add pressure training "
            "to keep execution sharp at speed."
        )
    if not strengths:
        strengths.append("You completed the course and recorded clean tracking data.")

    # Summary paragraph.
    total_lost = sum(e.get("lost_s", 0) for e in events)
    summary = (
        f"You covered {metrics.get('distance_m', 0)/1000:.2f} km in "
        f"{_fmt_time(metrics.get('duration_s', 0))} with "
        f"{metrics.get('total_climb_m', 0):.0f} m of climb. "
        f"Overall performance scored {scores.get('overall', 0):.0f}/100, led by "
        f"{label[top]}. "
    )
    if total_lost > 30:
        summary += (
            f"Around {_fmt_time(total_lost)} was lost to stops, hesitations and "
            f"navigation errors — tightening these is the fastest route to a "
            f"better result."
        )
    else:
        summary += "Execution was clean with little time lost to errors."

    return {
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses or ["No major weaknesses detected in this race."],
        "mistakes": mistakes or ["No significant mistakes detected."],
        "advice": advice,
        "generated_by": "rule_based",
    }


def _openai_report(payload: dict) -> dict | None:
    try:
        from openai import OpenAI
    except ImportError:  # pragma: no cover
        return None
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        system = (
            "You are an elite orienteering and endurance coach. Given structured "
            "race analysis JSON, write a concise, specific, encouraging coaching "
            "report. Respond ONLY with JSON matching: {summary, strengths[], "
            "weaknesses[], mistakes[], advice[]}. Reference concrete legs, times "
            "and distances from the data."
        )
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload)},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
        )
        data = json.loads(resp.choices[0].message.content)
        data["generated_by"] = settings.OPENAI_MODEL
        # Ensure required keys exist.
        for key in ("summary", "strengths", "weaknesses", "mistakes", "advice"):
            data.setdefault(key, [] if key != "summary" else "")
        return data
    except Exception as exc:  # pragma: no cover - network/credentials dependent
        logger.warning("OpenAI coaching failed, falling back to rule-based: %s", exc)
        return None


def generate_coach_report(
    metrics: Dict[str, float],
    scores: Dict[str, float],
    events: List[dict],
    legs: List[dict],
    route_legs: List[dict],
) -> dict:
    payload = {
        "metrics": metrics,
        "scores": scores,
        "events": events,
        "legs": legs,
        "route_legs": route_legs,
    }
    if settings.OPENAI_API_KEY:
        report = _openai_report(payload)
        if report:
            return report
    return _rule_based_report(metrics, scores, events, legs, route_legs)
