"""Helpers to serialize ORM objects into API response shapes."""
from __future__ import annotations

from app.models import Analysis, Race
from app.schemas.schemas import AnalysisOut, RaceOut
from app.services.storage.store import get_storage


def race_to_out(race: Race) -> RaceOut:
    return RaceOut(
        id=race.id,
        name=race.name,
        discipline=race.discipline,
        status=race.status,
        meta=race.meta or {},
        has_map=race.map_asset is not None,
        has_gps=race.gps_track is not None,
        has_splits=race.split_set is not None,
        has_analysis=race.analysis is not None
        and race.analysis.status == "complete",
    )


def analysis_to_out(analysis: Analysis, race: Race) -> AnalysisOut:
    controls = [
        {
            "id": c.code,
            "code": c.code,
            "order": c.order,
            "kind": c.kind,
            "lat": c.lat,
            "lon": c.lon,
            "pixel_x": c.pixel_x,
            "pixel_y": c.pixel_y,
            "confidence": c.confidence,
        }
        for c in sorted(race.controls, key=lambda x: x.order)
    ]
    video_url = None
    if analysis.video_key:
        video_url = get_storage().url(analysis.video_key)
    return AnalysisOut(
        id=analysis.id,
        race_id=analysis.race_id,
        status=analysis.status,
        error=analysis.error,
        metrics=analysis.metrics or {},
        scores=analysis.scores or {},
        coach=analysis.coach or {},
        confidence=analysis.confidence or {},
        track=analysis.track or [],
        legs=analysis.legs or [],
        controls=controls,
        mistakes=[
            {
                "type": m.type,
                "leg_number": m.leg_number,
                "t_start": m.t_start,
                "t_end": m.t_end,
                "lost_s": m.lost_s,
                "severity": m.severity,
                "description": m.description,
            }
            for m in analysis.mistakes
        ],
        video_url=video_url,
    )
