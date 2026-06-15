"""Third-party integration endpoints (Strava import)."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import GpsTrack, Race, RaceStatus
from app.services.integrations import strava

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/strava/authorize-url")
def strava_authorize_url(redirect_uri: str, state: str = ""):
    if not settings.STRAVA_CLIENT_ID:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Strava not configured")
    return {"url": strava.authorize_url(redirect_uri, state)}


@router.post("/strava/import")
def strava_import(
    race_id: str = Body(...),
    activity_id: int = Body(...),
    access_token: str = Body(...),
    db: Session = Depends(get_db),
):
    race = db.get(Race, race_id)
    if race is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Race not found")
    try:
        points = strava.fetch_activity_track(activity_id, access_token)
    except Exception as exc:  # pragma: no cover - network dependent
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Strava import failed: {exc}")
    if len(points) < 2:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No GPS data in activity")
    if race.gps_track:
        race.gps_track.points = points
        race.gps_track.point_count = len(points)
        race.gps_track.source = "strava"
    else:
        race.gps_track = GpsTrack(
            race_id=race.id, points=points, point_count=len(points),
            source="strava", format="strava",
        )
    if race.status == RaceStatus.created.value:
        race.status = RaceStatus.uploaded.value
    db.commit()
    return {"point_count": len(points), "race_id": race.id}
