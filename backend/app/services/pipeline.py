"""End-to-end analysis orchestrator.

Given a race (with its uploaded map / GPS / splits), runs every engine and
persists a complete :class:`Analysis`. This is the single function that the
synchronous API path and the Celery worker both call, so behaviour is identical
regardless of execution mode.

Pipeline stages:
    1. parse + analyse GPS track            (always, if a track exists)
    2. process map photo (CV) + OCR         (if a map exists)
    3. align controls to GPS                (if CV found controls)
    4. parse + analyse split times          (if splits exist)
    5. route-choice analysis                (if controls are geolocated)
    6. performance scoring
    7. AI coach report
    8. persist Analysis + child rows
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models import (
    Analysis,
    AnalysisStatus,
    Control,
    Mistake,
    Race,
    RaceStatus,
    RouteSegment,
)
from app.services.coach.engine import generate_coach_report
from app.services.gps.analysis import GpsAnalysisResult, analyze_track
from app.services.report.scoring import compute_scores
from app.services.routechoice.analysis import segment_by_controls
from app.services.splits.analysis import _select_athlete, analyze_splits
from app.services.storage.store import get_storage


def _controls_from_splits(split_data: dict, athlete_name, track) -> list[dict]:
    """Place controls accurately using split times + the GPS track.

    Each control was punched at ``race_start + cumulative_time``; we pin it to the
    GPS point recorded closest to that moment. This is the reliable way to locate
    controls (it doesn't depend on the rough map-photo alignment), as long as the
    GPS track carries timestamps and the splits belong to this run.
    """
    competitors = (split_data or {}).get("competitors", [])
    target = _select_athlete(competitors, athlete_name)
    if not target or not track or track[0].t is None:
        return []
    start_t = track[0].t
    splits = [s for s in target["splits"] if s.get("cumulative_s") is not None]
    if not splits:
        return []
    controls: list[dict] = [{
        "order": 0, "code": "S", "kind": "start",
        "lat": round(track[0].lat, 6), "lon": round(track[0].lon, 6), "confidence": 0.9,
    }]
    n = len(splits)
    for i, s in enumerate(splits, start=1):
        target_t = start_t + s["cumulative_s"]
        pt = min(track, key=lambda p: abs((p.t if p.t is not None else start_t) - target_t))
        kind = "finish" if (str(s["code"]).upper() == "F" or i == n) else "control"
        controls.append({
            "order": i, "code": str(s["code"]), "kind": kind,
            "lat": round(pt.lat, 6), "lon": round(pt.lon, 6), "confidence": 0.85,
        })
    return controls

logger = logging.getLogger(__name__)


def _run_map_cv(race: Race, db: Session) -> tuple[list[dict], Optional[tuple], float, float]:
    """Run the CV pipeline on the stored map. Returns (controls_px, start, map_conf, ocr_conf)."""
    if not race.map_asset:
        return [], None, 0.0, 0.0
    try:
        from app.services.mapcv.pipeline import process_map_image

        raw = get_storage().get(race.map_asset.original_key)
        result = process_map_image(raw)
        controls_px = [
            {"pixel_x": c.pixel_x, "pixel_y": c.pixel_y, "confidence": c.confidence}
            for c in result.controls
        ]
        # Persist CV output + processed image.
        race.map_asset.cv_result = result.to_json()
        race.map_asset.width = result.width
        race.map_asset.height = result.height
        race.map_asset.map_confidence = result.map_confidence
        race.map_asset.ocr_confidence = result.ocr_confidence
        if result.processed_image is not None:
            try:
                import cv2  # type: ignore

                ok, buf = cv2.imencode(".jpg", result.processed_image)
                if ok:
                    key = f"maps/{race.id}/processed.jpg"
                    get_storage().put(key, buf.tobytes(), "image/jpeg")
                    race.map_asset.processed_key = key
            except Exception:  # pragma: no cover
                pass
        return controls_px, result.start, result.map_confidence, result.ocr_confidence
    except Exception as exc:
        logger.warning("Map CV stage failed for race %s: %s", race.id, exc)
        return [], None, 0.0, 0.0


def run_analysis(race_id: str, db: Session) -> Analysis:
    race = db.get(Race, race_id)
    if race is None:
        raise ValueError(f"Race {race_id} not found")

    analysis = race.analysis or Analysis(race_id=race.id)
    analysis.status = AnalysisStatus.running.value
    analysis.error = None
    if analysis.id is None or race.analysis is None:
        db.add(analysis)
    race.status = RaceStatus.processing.value
    db.flush()

    try:
        # --- 1. GPS ---
        gps: Optional[GpsAnalysisResult] = None
        if race.gps_track and race.gps_track.points:
            gps = analyze_track(race.gps_track.points)

        athlete_name = (race.owner.full_name if race.owner else None)

        # --- 2/3. Controls ---
        controls_geo: list[dict] = []
        map_conf = ocr_conf = align_conf = 0.0
        # (a) Preferred: place controls from split times matched to GPS timestamps
        #     (accurate; independent of the rough map-photo alignment).
        if race.split_set and race.split_set.data and gps is not None:
            controls_geo = _controls_from_splits(
                race.split_set.data, athlete_name, gps.points
            )
            if controls_geo:
                align_conf = 0.85
        # Always run the CV pass for the corrected/enhanced map image + OCR.
        controls_px, start_px, map_conf, ocr_conf = _run_map_cv(race, db)
        # (b) Fallback: estimate control positions from the map photo alignment
        #     (only when we couldn't derive them from splits).
        if not controls_geo and controls_px and gps is not None:
            from app.services.mapcv.alignment import align_controls_to_gps

            align = align_controls_to_gps(controls_px, gps.points, start_px)
            controls_geo = align.controls_geo
            align_conf = align.confidence
        if controls_geo:
            _persist_controls(race, controls_geo, db)

        # --- 4. Splits ---
        split_result = None
        split_legs_json: list[dict] = []
        if race.split_set and race.split_set.data:
            split_result = analyze_splits(race.split_set.data, athlete_name)
            split_legs_json = split_result.legs_json()

        # --- 5. Route choice ---
        route_legs_json: list[dict] = []
        if gps is not None:
            route_legs = segment_by_controls(gps.points, controls_geo)
            route_legs_json = [r.to_json() for r in route_legs]
            _persist_segments(analysis, route_legs, split_legs_json, db)

        # --- assemble metrics / events ---
        metrics = gps.metrics if gps else {}
        events_json = _events_json(gps, controls_geo) if gps else []
        _attach_leg_numbers_to_events(events_json, route_legs_json if gps else [])

        # --- 6. Scores ---
        scores = compute_scores(
            metrics,
            events_json,
            split_legs_json,
            route_legs_json,
            discipline=race.discipline,
        )

        # --- 7. Coach ---
        coach = generate_coach_report(
            metrics, scores, events_json, split_legs_json, route_legs_json
        )

        # --- merge per-leg view (splits ∪ route choice) ---
        merged_legs = _merge_legs(split_legs_json, route_legs_json, events_json)

        # --- 8. persist ---
        analysis.metrics = metrics
        analysis.scores = scores
        analysis.coach = coach
        analysis.confidence = {
            "map": round(map_conf, 3),
            "ocr": round(ocr_conf, 3),
            "gps_alignment": round(align_conf, 3),
        }
        analysis.track = gps.track_json() if gps else []
        analysis.legs = merged_legs
        analysis.status = AnalysisStatus.complete.value
        _persist_mistakes(analysis, events_json, db)

        race.status = RaceStatus.analyzed.value
        db.commit()
        db.refresh(analysis)
        return analysis
    except Exception as exc:
        logger.exception("Analysis failed for race %s", race_id)
        analysis.status = AnalysisStatus.failed.value
        analysis.error = str(exc)
        race.status = RaceStatus.failed.value
        db.commit()
        raise


def _events_json(gps: GpsAnalysisResult, controls_geo: list[dict]) -> list[dict]:
    return [
        {
            "type": e.type,
            "leg_number": None,
            "t_start": e.t_start,
            "t_end": e.t_end,
            "lost_s": e.lost_s,
            "severity": e.severity,
            "description": e.description,
            "index_start": e.index_start,
            "index_end": e.index_end,
        }
        for e in gps.events
    ]


def _attach_leg_numbers_to_events(events: list[dict], legs: list[dict]) -> None:
    """Attach a leg number to each event by splitting the race into equal-time
    legs across the available leg count (a robust approximation when precise
    control-visit indices are unavailable). Leaves None when no legs exist."""
    n_legs = len(legs)
    if not events or n_legs == 0:
        return
    t0 = min(e["t_start"] for e in events)
    t1 = max(e["t_end"] for e in events)
    span = max(1e-6, t1 - t0)
    for e in events:
        frac = (e["t_start"] - t0) / span
        e["leg_number"] = min(n_legs, max(1, int(frac * n_legs) + 1))


def _merge_legs(split_legs: list[dict], route_legs: list[dict], events: list[dict]) -> list[dict]:
    """Combine split timing legs with route-choice geometry into one list."""
    by_num: dict[int, dict] = {}
    for l in split_legs:
        by_num[l["number"]] = {
            "number": l["number"],
            "from_control": l["from_control"],
            "to_control": l["to_control"],
            "time_s": l["time_s"],
            "best_time_s": l["best_time_s"],
            "time_loss_s": l["time_loss_s"],
            "rank": l["rank"],
            "pct_behind": l["pct_behind"],
            "cumulative_loss_s": l.get("cumulative_loss_s"),
            "distance_m": None,
            "efficiency": None,
            "mistakes": [],
        }
    for r in route_legs:
        n = r["leg_number"]
        entry = by_num.setdefault(
            n,
            {
                "number": n,
                "from_control": r["from_control"],
                "to_control": r["to_control"],
                "time_s": None,
                "best_time_s": None,
                "time_loss_s": 0.0,
                "rank": None,
                "pct_behind": None,
                "cumulative_loss_s": None,
                "mistakes": [],
            },
        )
        entry["distance_m"] = r["actual_distance_m"]
        entry["optimal_distance_m"] = r.get("optimal_distance_m")
        entry["efficiency"] = r.get("efficiency")
        entry["verdict"] = r.get("verdict")
    return [by_num[k] for k in sorted(by_num)]


def _persist_controls(race: Race, controls_geo: list[dict], db: Session) -> None:
    for c in list(race.controls):
        db.delete(c)
    for c in controls_geo:
        db.add(
            Control(
                race_id=race.id,
                code=str(c.get("code", c["order"])),
                order=c["order"],
                kind=c.get("kind", "control"),
                pixel_x=c.get("pixel_x"),
                pixel_y=c.get("pixel_y"),
                lat=c.get("lat"),
                lon=c.get("lon"),
                confidence=c.get("confidence", 0.0),
            )
        )


def _persist_segments(analysis, route_legs, split_legs_json, db: Session) -> None:
    split_by_num = {l["number"]: l for l in split_legs_json}
    for seg in list(getattr(analysis, "segments", []) or []):
        db.delete(seg)
    for r in route_legs:
        sp = split_by_num.get(r.leg_number, {})
        db.add(
            RouteSegment(
                analysis=analysis,
                leg_number=r.leg_number,
                from_control=r.from_control,
                to_control=r.to_control,
                time_s=sp.get("time_s") or 0.0,
                best_time_s=sp.get("best_time_s"),
                time_loss_s=sp.get("time_loss_s") or 0.0,
                rank=sp.get("rank"),
                pct_behind=sp.get("pct_behind"),
                distance_m=r.actual_distance_m,
                optimal_distance_m=r.optimal_distance_m,
                climb_m=r.climb_m,
            )
        )


def _persist_mistakes(analysis, events_json: list[dict], db: Session) -> None:
    for m in list(getattr(analysis, "mistakes", []) or []):
        db.delete(m)
    for e in events_json:
        db.add(
            Mistake(
                analysis=analysis,
                type=e["type"],
                leg_number=e.get("leg_number"),
                t_start=e["t_start"],
                t_end=e["t_end"],
                lost_s=e["lost_s"],
                severity=e["severity"],
                description=e["description"],
            )
        )
