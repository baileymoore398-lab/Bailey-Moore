"""Event ingestion orchestration.

* ``ingest_results`` — parse an IOF XML results file into EventEntry rows.
* ``ingest_gps_batch`` — create a race + analysis per uploaded track and match
  each to a competitor result.
* ``build_event_analysis`` — assemble and persist the event-wide aggregate.
* ``multi_replay_payload`` — synchronized multi-competitor replay data.
"""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import (
    Event,
    EventAnalysis,
    EventEntry,
    GpsTrack,
    Race,
    RaceStatus,
)
from app.services.events.analytics import build_event_analysis as _build_aggregate
from app.services.events.matching import match_filename_to_competitors
from app.services.events.results import EventResults, parse_event_results
from app.services.gps.parser import parse_track
from app.services.pipeline import run_analysis
from app.services.storage.store import get_storage


def ingest_results(event: Event, filename: str, data: bytes, db: Session) -> dict:
    results = parse_event_results(data)
    if not results.competitors:
        raise ValueError("No competitor results parsed from file.")

    key = f"events/{event.id}/results/{filename or 'results.xml'}"
    get_storage().put(key, data, "application/xml")
    event.results_key = key
    if results.event_name and event.name in (None, "", "Untitled event"):
        event.name = results.event_name

    # Reset existing result-only entries (keep ones already matched to GPS).
    for e in list(event.entries):
        if not e.matched_gps:
            db.delete(e)
    db.flush()

    for c in results.competitors:
        db.add(EventEntry(
            event_id=event.id,
            competitor_name=c.name,
            course=c.course,
            position=c.position,
            total_time_s=c.total_time_s,
            status=c.status,
        ))
    event.status = "processing"
    db.commit()
    return {
        "competitors": len(results.competitors),
        "courses": results.courses,
        "event_name": results.event_name,
    }


def _load_results(event: Event) -> Optional[EventResults]:
    if not event.results_key:
        return None
    try:
        data = get_storage().get(event.results_key)
    except FileNotFoundError:
        return None
    return parse_event_results(data)


def ingest_gps_batch(
    event: Event, files: List[tuple[str, bytes]], db: Session
) -> dict:
    """Create a race + analysis per uploaded GPS file and match to a competitor."""
    competitor_names = [e.competitor_name for e in event.entries if e.competitor_name]
    matched, unmatched = 0, 0
    details: List[dict] = []

    for filename, data in files:
        try:
            points = parse_track(filename, data)
        except ValueError:
            details.append({"file": filename, "status": "unreadable"})
            continue
        if len(points) < 2:
            details.append({"file": filename, "status": "empty"})
            continue

        race = Race(
            name=filename, discipline=event.discipline,
            event_id=event.id, status=RaceStatus.uploaded.value,
        )
        db.add(race)
        db.flush()
        race.gps_track = GpsTrack(
            race_id=race.id, points=points, point_count=len(points), format="gpx"
        )
        db.flush()

        cand = match_filename_to_competitors(filename, competitor_names)
        entry = None
        if cand:
            entry = next(
                (e for e in event.entries
                 if e.competitor_name == cand.name and not e.matched_gps),
                None,
            )
        try:
            run_analysis(race.id, db)
        except Exception:  # analysis failure shouldn't abort the batch
            pass

        if entry:
            entry.race_id = race.id
            entry.matched_gps = True
            matched += 1
            details.append({"file": filename, "status": "matched",
                            "competitor": cand.name, "confidence": cand.score})
        else:
            unmatched += 1
            details.append({"file": filename, "status": "unmatched"})
    db.commit()
    return {"matched": matched, "unmatched": unmatched, "files": details}


def build_event_analysis(event: Event, db: Session) -> EventAnalysis:
    results = _load_results(event)
    if results is None:
        raise ValueError("Event has no results file to analyze.")

    # Gather GPS analyses for matched competitors, keyed by competitor name.
    analyses_by_name: dict[str, dict] = {}
    for entry in event.entries:
        if entry.matched_gps and entry.race_id and entry.competitor_name:
            race = db.get(Race, entry.race_id)
            if race and race.analysis and race.analysis.status == "complete":
                analyses_by_name[entry.competitor_name] = {
                    "legs": race.analysis.legs or [],
                    "metrics": race.analysis.metrics or {},
                }

    aggregate = _build_aggregate(results, analyses_by_name)
    ea = event.analysis or EventAnalysis(event_id=event.id)
    ea.status = "complete"
    ea.leaderboards = aggregate["leaderboards"]
    ea.leg_rankings = aggregate["leg_rankings"]
    ea.route_comparison = aggregate["route_comparison"]
    ea.stats = aggregate["stats"]
    if ea.id is None and event.analysis is None:
        db.add(ea)
        event.analysis = ea
    event.status = "published"
    db.commit()
    db.refresh(ea)
    return ea


def multi_replay_payload(event: Event, db: Session, course: Optional[str] = None) -> dict:
    """Synchronized tracks for all GPS-matched competitors (for multi-replay)."""
    tracks: List[dict] = []
    t_min = None
    for entry in event.entries:
        if course and entry.course != course:
            continue
        if not (entry.matched_gps and entry.race_id):
            continue
        race = db.get(Race, entry.race_id)
        if not (race and race.analysis and race.analysis.track):
            continue
        pts = race.analysis.track
        start_t = pts[0]["t"] if pts else 0
        if t_min is None or start_t < t_min:
            t_min = start_t
        tracks.append({
            "name": entry.competitor_name,
            "course": entry.course,
            "position": entry.position,
            "color": _color_for(len(tracks)),
            # normalize to elapsed seconds so competitors replay in sync from gun
            "points": [
                {"lat": p["lat"], "lon": p["lon"], "speed_kmh": p.get("speed_kmh", 0),
                 "elapsed_s": round(p["t"] - start_t, 1)}
                for p in pts
            ],
            "metrics": race.analysis.metrics,
        })
    return {"event_id": event.id, "course": course, "competitors": tracks}


_PALETTE = ["#38bdf8", "#f472b6", "#a3e635", "#fbbf24", "#c084fc",
            "#fb7185", "#34d399", "#60a5fa", "#f59e0b", "#e879f9"]


def _color_for(i: int) -> str:
    return _PALETTE[i % len(_PALETTE)]
