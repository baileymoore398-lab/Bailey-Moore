"""Strava integration — real OAuth2 + Activity Streams API calls.

Exchanges an OAuth authorization code for tokens and pulls an activity's GPS
stream, normalizing it into RouteForge's track-point format so it can feed the
same analysis pipeline as uploaded GPX. Requires ``STRAVA_CLIENT_ID`` /
``STRAVA_CLIENT_SECRET`` to be configured.
"""
from __future__ import annotations

from typing import List

import httpx

from app.config import settings

AUTH_URL = "https://www.strava.com/oauth/authorize"
TOKEN_URL = "https://www.strava.com/oauth/token"
API_BASE = "https://www.strava.com/api/v3"


def authorize_url(redirect_uri: str, state: str = "") -> str:
    if not settings.STRAVA_CLIENT_ID:
        raise RuntimeError("STRAVA_CLIENT_ID not configured")
    params = (
        f"client_id={settings.STRAVA_CLIENT_ID}&response_type=code"
        f"&redirect_uri={redirect_uri}&approval_prompt=auto"
        f"&scope=activity:read_all&state={state}"
    )
    return f"{AUTH_URL}?{params}"


def exchange_code(code: str) -> dict:
    resp = httpx.post(
        TOKEN_URL,
        data={
            "client_id": settings.STRAVA_CLIENT_ID,
            "client_secret": settings.STRAVA_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def refresh_tokens(refresh_token: str) -> dict:
    """Exchange a refresh token for a fresh access token."""
    resp = httpx.post(
        TOKEN_URL,
        data={
            "client_id": settings.STRAVA_CLIENT_ID,
            "client_secret": settings.STRAVA_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def list_activities(access_token: str, page: int = 1, per_page: int = 20) -> List[dict]:
    """Recent activities for the connected athlete, trimmed for the picker."""
    resp = httpx.get(
        f"{API_BASE}/athlete/activities",
        params={"page": page, "per_page": per_page},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    resp.raise_for_status()
    out: List[dict] = []
    for a in resp.json():
        out.append(
            {
                "id": a.get("id"),
                "name": a.get("name"),
                "sport_type": a.get("sport_type") or a.get("type"),
                "start_date": a.get("start_date_local") or a.get("start_date"),
                "distance_m": a.get("distance"),
                "moving_time_s": a.get("moving_time"),
                "has_gps": bool(a.get("start_latlng")),
            }
        )
    return out


def fetch_activity_track(activity_id: int, access_token: str) -> List[dict]:
    """Fetch latlng + altitude + time streams and merge into track points."""
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = httpx.get(
        f"{API_BASE}/activities/{activity_id}/streams",
        params={"keys": "latlng,altitude,time", "key_by_type": "true"},
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    streams = resp.json()
    latlng = streams.get("latlng", {}).get("data", [])
    altitude = streams.get("altitude", {}).get("data", [])
    times = streams.get("time", {}).get("data", [])

    # Strava 'time' stream is seconds offset from activity start.
    start_epoch = 0.0
    act = httpx.get(
        f"{API_BASE}/activities/{activity_id}",
        headers=headers,
        timeout=30,
    ).json()
    from datetime import datetime, timezone

    if act.get("start_date"):
        start_epoch = datetime.fromisoformat(
            act["start_date"].replace("Z", "+00:00")
        ).replace(tzinfo=timezone.utc).timestamp()

    points: List[dict] = []
    for i, (lat, lon) in enumerate(latlng):
        points.append(
            {
                "lat": lat,
                "lon": lon,
                "ele": altitude[i] if i < len(altitude) else None,
                "t": (start_epoch + times[i]) if i < len(times) else None,
            }
        )
    return points
