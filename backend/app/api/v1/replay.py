"""Advanced replay data: per-race heatmaps (speed / error / density)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_plan
from app.database import get_db
from app.models import Event, Race
from app.services.events.ingest import multi_replay_payload
from app.services.replay.heatmap import build_heatmap, mistake_points_from_analysis

router = APIRouter(prefix="/replay", tags=["replay"])

_MODES = {"density", "speed", "error"}


@router.get(
    "/races/{race_id}/heatmap",
    dependencies=[Depends(require_plan("pro"))],  # heatmaps are a Pro feature (once billing is live)
)
def race_heatmap(race_id: str, mode: str = "density", db: Session = Depends(get_db)):
    if mode not in _MODES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"mode must be one of {_MODES}")
    race = db.get(Race, race_id)
    if not race or not race.analysis or not race.analysis.track:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Race not analyzed")
    track = race.analysis.track
    if mode == "error":
        mistakes = [
            {"type": m.type, "lost_s": m.lost_s, "t_start": m.t_start, "t_end": m.t_end}
            for m in race.analysis.mistakes
        ]
        mp = mistake_points_from_analysis(track, mistakes)
        return build_heatmap([], mode="error", mistakes=mp)
    return build_heatmap([track], mode=mode)


@router.get(
    "/events/{event_id}/heatmap",
    dependencies=[Depends(require_plan("pro"))],
)
def event_heatmap(event_id: str, mode: str = "density", db: Session = Depends(get_db)):
    """Aggregate heatmap across all GPS-matched competitors in an event."""
    if mode not in {"density", "speed"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "event heatmap supports density/speed")
    event = db.get(Event, event_id)
    if event is None:
        event = db.query(Event).filter(Event.slug == event_id).one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    payload = multi_replay_payload(event, db)
    tracks = [
        [{"lat": p["lat"], "lon": p["lon"], "speed_kmh": p["speed_kmh"]} for p in c["points"]]
        for c in payload["competitors"]
    ]
    if not tracks:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No GPS-matched competitors")
    return build_heatmap(tracks, mode=mode)
