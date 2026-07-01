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


def _facts(
    metrics: Dict[str, float],
    scores: Dict[str, float],
    events: List[dict],
    legs: List[dict],
) -> dict:
    """Pre-computed, correctly-formatted figures for the LLM to quote verbatim.

    Passing these alongside the raw data — and instructing the model to use only
    numbers it is given — is what keeps the AI report factually accurate instead
    of inventing or mis-deriving values.
    """
    total_lost = sum(e.get("lost_s", 0.0) for e in events)
    worst_leg = None
    if legs:
        wl = max(legs, key=lambda l: l.get("time_loss_s", 0.0) or 0.0)
        if (wl.get("time_loss_s") or 0.0) > 0:
            worst_leg = (
                f"Leg {wl.get('number')} "
                f"({wl.get('from_control')}→{wl.get('to_control')}) "
                f"lost {_fmt_time(wl.get('time_loss_s', 0.0))}"
            )
    return {
        "distance_km": round(metrics.get("distance_m", 0.0) / 1000.0, 2),
        "duration": _fmt_time(metrics.get("duration_s", 0.0)),
        "moving_time": _fmt_time(metrics.get("moving_time_s", 0.0)),
        "climb_m": round(metrics.get("total_climb_m", 0.0)),
        "avg_pace_min_km": metrics.get("avg_pace_min_km"),
        "avg_speed_kmh": metrics.get("avg_speed_kmh"),
        "scores_out_of_100": scores,
        "total_time_lost": _fmt_time(total_lost),
        "significant_mistakes": sum(
            1 for e in events if e.get("lost_s", 0.0) >= 5
        ),
        "worst_leg": worst_leg,
    }


def _as_list(v) -> List[str]:
    """Coerce a model field to a clean list of strings (robust to bad output)."""
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return [str(v).strip()] if str(v).strip() else []


def _as_str(v) -> str:
    if isinstance(v, list):
        return " ".join(str(x) for x in v)
    return str(v).strip() if v is not None else ""


def _fetch_liked_exemplars(limit: int = 2) -> List[str]:
    """Excerpts from past reports that users rated 👍 — the learning signal.

    Feeding these to the model as style references makes future reports mirror
    what real users found useful. Fails safe (returns []) if the DB is
    unreachable, so generation is never blocked by the learning loop.
    """
    try:
        from app.database import SessionLocal
        from app.models import AnalysisFeedback

        db = SessionLocal()
        try:
            rows = (
                db.query(AnalysisFeedback)
                .filter(
                    AnalysisFeedback.rating == "up",
                    AnalysisFeedback.coach_summary.isnot(None),
                )
                .order_by(AnalysisFeedback.created_at.desc())
                .limit(limit)
                .all()
            )
            return [r.coach_summary for r in rows if r.coach_summary]
        finally:
            db.close()
    except Exception:  # noqa: BLE001 — learning is best-effort
        return []


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

    # Longer multi-part overview: one line per performance dimension.
    overview_lines = [summary, ""]
    dim_comment = {
        "navigation": "Navigation ({v:.0f}/100): how cleanly you stayed in contact with the map.",
        "fitness": "Fitness ({v:.0f}/100): your sustainable running speed for the terrain.",
        "execution": "Execution ({v:.0f}/100): how little time you lost to stops and hesitations.",
        "route_choice": "Route choice ({v:.0f}/100): how efficient your chosen lines were.",
    }
    for dim in ("navigation", "route_choice", "execution", "fitness"):
        v = scores.get(dim)
        if v is not None:
            verdict = "strong" if v >= 80 else "solid" if v >= 70 else "a clear area to work on"
            overview_lines.append(
                dim_comment[dim].format(v=v) + f" This was {verdict}."
            )
    overview = "\n".join(overview_lines)

    # Concrete training plan from the two weakest areas.
    training_map = {
        "navigation": [
            "Relocation drills: cover the map for 60s while running, then re-find your exact position.",
            "Contour-only runs (hide everything but contours) to force terrain reading.",
            "Map-memory sprints: memorise one leg, then run it with the map folded away.",
        ],
        "fitness": [
            "2× per week aerobic-threshold runs, 20–30 min at comfortably-hard effort.",
            "Weekly hill reps for terrain-specific leg strength.",
            "One long, easy run each week to build endurance base.",
        ],
        "execution": [
            "Pressure intervals: short technical courses at near race pace.",
            "Control-flow drills: always plan the next leg before reaching the control.",
            "Race-pace runs with a heart-rate cap to stop you over-running into mistakes.",
        ],
        "route_choice": [
            "Armchair route choice: study old maps, pick a line, then compare to the optimal.",
            "Run the same leg by two different routes and time both.",
            "Practise spotting the straightest runnable line under time pressure.",
        ],
    }
    focus_areas = [d for d in ranked[::-1] if scores.get(d, 100) < 78][:2]
    training: List[str] = []
    for area in (focus_areas or [ranked[-1]]):
        training.extend(training_map.get(area, [])[:2])
    if not training:
        training = [
            "Maintain your current training volume and add weekly technical sessions.",
            "Add short pressure-training races to keep execution sharp at speed.",
        ]

    return {
        "summary": summary,
        "overview": overview,
        "strengths": strengths,
        "weaknesses": weaknesses or ["No major weaknesses detected in this race."],
        "mistakes": mistakes or ["No significant mistakes detected."],
        "advice": advice,
        "training": training,
        "focus_areas": [label.get(a, a) for a in focus_areas],
        "generated_by": "rule_based",
    }


def _openai_report(payload: dict) -> dict | None:
    try:
        from openai import OpenAI
    except ImportError:  # pragma: no cover
        return None
    try:
        # No SDK retries and a short timeout: a quota/auth error (429
        # insufficient_quota) never succeeds on retry, so fail over to the
        # rule-based report instantly instead of stalling the analysis ~3s.
        client = OpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0, timeout=20.0)
        system = (
            "You are an elite orienteering and endurance coach writing a factual, "
            "specific, encouraging race report.\n\n"
            "ACCURACY RULES (critical):\n"
            "1. Use ONLY numbers that appear in the provided JSON (the 'facts', "
            "'metrics', 'scores', 'legs', 'events' and 'route_legs' fields).\n"
            "2. NEVER invent, guess, estimate, extrapolate or re-calculate any "
            "number. When you cite a figure, copy it exactly from the data, "
            "including its units.\n"
            "3. If a fact is not present in the data, do not state it. Do not "
            "claim ranks, positions, weather, heart rate or anything not given.\n"
            "4. The 'facts' object contains pre-formatted correct values — prefer "
            "quoting those verbatim (e.g. distance_km, duration, climb_m, "
            "total_time_lost, worst_leg). Scores are out of 100. Times are m:ss.\n"
            "5. Do not contradict the scores: only call an area a strength if its "
            "score is high, or a weakness if its score is low.\n\n"
            "Respond ONLY with a JSON object matching exactly: {summary, "
            "overview, strengths[], weaknesses[], mistakes[], advice[], "
            "training[], focus_areas[]}. 'summary' is 2-3 sentences. 'overview' "
            "is a fuller 3-5 sentence narrative covering navigation, fitness, "
            "execution and route choice. 'training' is 3-5 concrete drills to "
            "improve the weakest areas. 'focus_areas' names the 1-2 lowest-scoring "
            "priorities. Be specific and reference the real legs, times and "
            "distances from the data."
        )
        messages = [{"role": "system", "content": system}]
        # Learning loop: steer style toward reports that real users rated highly.
        exemplars = _fetch_liked_exemplars()
        if exemplars:
            ex = "\n\n".join(f"• {e}" for e in exemplars)
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "Below are excerpts from past reports that users rated "
                        "highly. Match their specificity, tone and structure. Do "
                        "NOT reuse their numbers — use only this race's data:\n"
                        f"{ex}"
                    ),
                }
            )
        messages.append({"role": "user", "content": json.dumps(payload)})
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.0,  # deterministic + factual, no creative drift
            seed=7,
        )
        content = resp.choices[0].message.content
        if not content:
            return None
        raw = json.loads(content)
        # Normalise types so malformed output can't corrupt the report.
        data = {
            "summary": _as_str(raw.get("summary")),
            "overview": _as_str(raw.get("overview")) or _as_str(raw.get("summary")),
            "strengths": _as_list(raw.get("strengths")),
            "weaknesses": _as_list(raw.get("weaknesses")),
            "mistakes": _as_list(raw.get("mistakes")),
            "advice": _as_list(raw.get("advice")),
            "training": _as_list(raw.get("training")),
            "focus_areas": _as_list(raw.get("focus_areas")),
            "generated_by": settings.OPENAI_MODEL,
        }
        # A usable report must at least have a summary; otherwise fall back.
        if not data["summary"]:
            return None
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
        "facts": _facts(metrics, scores, events, legs),
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
