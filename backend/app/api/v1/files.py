"""Serve files from local storage (dev mode) and handle video generation."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.v1.races import _authorize_race_write
from app.core.deps import get_optional_user, require_plan
from app.core.ratelimit import rate_limit
from app.database import get_db
from app.models import Race, User
from app.schemas.schemas import VideoRequest
from app.services.storage.store import LocalStorage, get_storage

router = APIRouter(tags=["files"])

_CONTENT_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "mp4": "video/mp4", "gpx": "application/gpx+xml",
}


@router.get("/files/{key:path}")
def serve_file(key: str):
    storage = get_storage()
    if not isinstance(storage, LocalStorage):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Direct file serving disabled with S3")
    try:
        data = storage.get(key)
    except FileNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    ext = key.rsplit(".", 1)[-1].lower()
    return Response(content=data, media_type=_CONTENT_TYPES.get(ext, "application/octet-stream"))


@router.post(
    "/races/{race_id}/video",
    dependencies=[
        Depends(rate_limit(10, 3600, "video")),
        Depends(require_plan("pro")),  # video export is a Pro feature (once billing is live)
    ],
)
def generate_video(
    race_id: str,
    body: VideoRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = db.get(Race, race_id)
    if race is None or race.analysis is None or not race.analysis.track:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Race must be analyzed first")
    # Rendering is expensive — only the race owner (or an admin) may trigger it.
    _authorize_race_write(race, user)
    from app.services.video.render import VideoSpec, render_replay_video

    controls = [
        {"lat": c.lat, "lon": c.lon, "code": c.code}
        for c in race.controls
        if c.lat is not None
    ]
    spec = VideoSpec(
        fmt=body.fmt,
        duration_s=body.duration_s,
        athlete_name=(race.owner.full_name if race.owner else "Athlete") or "Athlete",
        title=race.name,
    )
    try:
        mp4 = render_replay_video(race.analysis.track, race.analysis.metrics, spec, controls)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    key = f"videos/{race.id}/{body.fmt}.mp4"
    get_storage().put(key, mp4, "video/mp4")
    race.analysis.video_key = key
    db.commit()
    return {"video_url": get_storage().url(key), "fmt": body.fmt, "bytes": len(mp4)}
