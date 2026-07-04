"""Third-party integration endpoints — Strava OAuth connect + activity import.

Flow: the frontend asks for a connect URL (state = short-lived signed token for
the current user) → the user approves on Strava → Strava redirects to our
callback → we exchange the code server-side, store the tokens, and bounce the
browser back to the app. Tokens never reach the browser.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user, get_optional_user
from app.core.security import create_state_token, decode_state_token
from app.database import get_db
from app.models import GpsTrack, IntegrationToken, Race, RaceStatus, User
from app.services.integrations import strava

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["integrations"])

_PROVIDER = "strava"
_STATE_PURPOSE = "strava_oauth"


def _configured() -> bool:
    return bool(settings.STRAVA_CLIENT_ID and settings.STRAVA_CLIENT_SECRET)


def _callback_url(request: Request) -> str:
    """Public URL of our OAuth callback, honouring reverse-proxy headers."""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    )
    return f"{proto}://{host}{settings.API_V1_PREFIX}/integrations/strava/callback"


def _token_row(db: Session, user_id: str) -> Optional[IntegrationToken]:
    return (
        db.query(IntegrationToken)
        .filter(
            IntegrationToken.user_id == user_id,
            IntegrationToken.provider == _PROVIDER,
        )
        .one_or_none()
    )


def _fresh_access_token(db: Session, user: User) -> Optional[str]:
    """The user's access token, refreshed if it expires within 5 minutes."""
    row = _token_row(db, user.id)
    if row is None:
        return None
    if row.expires_at and row.expires_at < time.time() + 300 and row.refresh_token:
        try:
            data = strava.refresh_tokens(row.refresh_token)
            row.access_token = data["access_token"]
            row.refresh_token = data.get("refresh_token", row.refresh_token)
            row.expires_at = data.get("expires_at")
            db.commit()
        except Exception:  # noqa: BLE001 — keep the old token; the call may still work
            logger.exception("Strava token refresh failed for user %s", user.id)
    return row.access_token


@router.get("/strava/status")
def strava_status(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """Connection status. Works signed-out too, so the UI can explain that
    signing in unlocks the Strava import instead of hiding it."""
    row = _token_row(db, user.id) if user else None
    return {
        "configured": _configured(),
        "connected": row is not None,
        "athlete_name": row.external_name if row else None,
        "signed_in": user is not None,
    }


@router.get("/strava/connect")
def strava_connect(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Authorize URL for the current user (state carries their identity)."""
    if not _configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Strava is not configured (set STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET).",
        )
    state = create_state_token(user.id, _STATE_PURPOSE)
    return {"url": strava.authorize_url(_callback_url(request), state)}


@router.get("/strava/callback")
def strava_callback(
    state: str = "",
    code: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    """OAuth redirect target. Exchanges the code and stores tokens, then sends
    the browser back to the app."""
    back = f"{settings.FRONTEND_URL}/upload"
    user_id = decode_state_token(state, _STATE_PURPOSE)
    if error or not code or not user_id:
        return RedirectResponse(f"{back}?strava=error")
    try:
        data = strava.exchange_code(code)
    except Exception:  # noqa: BLE001
        logger.exception("Strava code exchange failed")
        return RedirectResponse(f"{back}?strava=error")

    athlete = data.get("athlete") or {}
    name = " ".join(
        p for p in [athlete.get("firstname"), athlete.get("lastname")] if p
    ) or None
    row = _token_row(db, user_id)
    if row is None:
        row = IntegrationToken(user_id=user_id, provider=_PROVIDER, access_token="")
        db.add(row)
    row.access_token = data.get("access_token", "")
    row.refresh_token = data.get("refresh_token")
    row.expires_at = data.get("expires_at")
    row.external_id = str(athlete.get("id")) if athlete.get("id") else None
    row.external_name = name
    db.commit()
    return RedirectResponse(f"{back}?strava=connected")


@router.get("/strava/activities")
def strava_activities(
    page: int = 1,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    token = _fresh_access_token(db, user)
    if token is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Strava is not connected")
    try:
        return {"activities": strava.list_activities(token, page=page)}
    except Exception as exc:  # noqa: BLE001 — network dependent
        logger.exception("Strava activities fetch failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Strava error: {exc}")


@router.post("/strava/import")
def strava_import(
    race_id: str = Body(...),
    activity_id: int = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Import a connected user's activity GPS into a race (server-side token)."""
    token = _fresh_access_token(db, user)
    if token is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Strava is not connected")
    race = db.get(Race, race_id)
    if race is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Race not found")
    if race.owner_id and race.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your race")
    try:
        points = strava.fetch_activity_track(activity_id, token)
    except Exception as exc:  # noqa: BLE001 — network dependent
        logger.exception("Strava import failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Strava import failed: {exc}")
    if len(points) < 2:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No GPS data in that activity (indoor/manual activities have none).",
        )
    if race.gps_track:
        race.gps_track.points = points
        race.gps_track.point_count = len(points)
        race.gps_track.source = "strava"
    else:
        race.gps_track = GpsTrack(
            race_id=race.id,
            points=points,
            point_count=len(points),
            source="strava",
            format="strava",
        )
    if race.status == RaceStatus.created.value:
        race.status = RaceStatus.uploaded.value
    db.commit()
    return {"point_count": len(points), "race_id": race.id}


@router.delete("/strava")
def strava_disconnect(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    row = _token_row(db, user.id)
    if row:
        db.delete(row)
        db.commit()
    return {"disconnected": True}
