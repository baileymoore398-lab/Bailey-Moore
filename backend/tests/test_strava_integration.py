"""Strava integration flow with the Strava API fully mocked."""
from unittest.mock import patch

from app.core.security import create_state_token


def _register(app_client, email="strava@x.com"):
    r = app_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Runner"},
    )
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_status_unconfigured(app_client):
    h = _register(app_client, "s1@x.com")
    r = app_client.get("/api/v1/integrations/strava/status", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is False


def test_connect_requires_config(app_client):
    h = _register(app_client, "s2@x.com")
    with patch("app.api.v1.integrations.settings") as mock_settings:
        mock_settings.STRAVA_CLIENT_ID = None
        mock_settings.STRAVA_CLIENT_SECRET = None
        r = app_client.get("/api/v1/integrations/strava/connect", headers=h)
    assert r.status_code == 503


def test_full_flow_mocked(app_client):
    h = _register(app_client, "s3@x.com")
    me = app_client.get("/api/v1/account/me", headers=h).json()

    # --- Callback: exchange code, store tokens ---
    state = create_state_token(me["id"], "strava_oauth")
    exchange = {
        "access_token": "at_1",
        "refresh_token": "rt_1",
        "expires_at": 9999999999,
        "athlete": {"id": 42, "firstname": "Bailey", "lastname": "Moore"},
    }
    with patch("app.api.v1.integrations.strava.exchange_code", return_value=exchange):
        r = app_client.get(
            f"/api/v1/integrations/strava/callback?state={state}&code=abc",
            follow_redirects=False,
        )
    assert r.status_code in (302, 307)
    assert "strava=connected" in r.headers["location"]

    # --- Status now connected ---
    st = app_client.get("/api/v1/integrations/strava/status", headers=h).json()
    assert st["connected"] is True
    assert st["athlete_name"] == "Bailey Moore"

    # --- List activities ---
    acts = [
        {
            "id": 111,
            "name": "Autumn O",
            "sport_type": "Run",
            "start_date": "2026-06-14T10:00:00Z",
            "distance_m": 3200,
            "moving_time_s": 4928,
            "has_gps": True,
        }
    ]
    with patch("app.api.v1.integrations.strava.list_activities", return_value=acts):
        r = app_client.get("/api/v1/integrations/strava/activities", headers=h)
    assert r.status_code == 200
    assert r.json()["activities"][0]["name"] == "Autumn O"

    # --- Import into a race ---
    race = app_client.post(
        "/api/v1/races",
        data={"name": "Strava race", "discipline": "orienteering"},
        headers=h,
    ).json()
    points = [
        {"lat": -38.1 + i * 1e-4, "lon": 176.2 + i * 1e-4, "ele": 100.0, "t": 1770000000 + i * 5}
        for i in range(50)
    ]
    with patch(
        "app.api.v1.integrations.strava.fetch_activity_track", return_value=points
    ):
        r = app_client.post(
            "/api/v1/integrations/strava/import",
            json={"race_id": race["id"], "activity_id": 111},
            headers=h,
        )
    assert r.status_code == 200
    assert r.json()["point_count"] == 50

    # The imported track feeds the normal analysis pipeline.
    r = app_client.post(f"/api/v1/races/{race['id']}/analyze", headers=h)
    assert r.status_code == 200

    # --- Disconnect ---
    r = app_client.delete("/api/v1/integrations/strava", headers=h)
    assert r.status_code == 200
    st = app_client.get("/api/v1/integrations/strava/status", headers=h).json()
    assert st["connected"] is False


def test_import_requires_connection(app_client):
    h = _register(app_client, "s4@x.com")
    r = app_client.post(
        "/api/v1/integrations/strava/import",
        json={"race_id": "nope", "activity_id": 1},
        headers=h,
    )
    assert r.status_code == 400


def test_callback_bad_state_redirects_error(app_client):
    r = app_client.get(
        "/api/v1/integrations/strava/callback?state=garbage&code=abc",
        follow_redirects=False,
    )
    assert r.status_code in (302, 307)
    assert "strava=error" in r.headers["location"]


def test_status_works_signed_out(app_client):
    r = app_client.get("/api/v1/integrations/strava/status")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is False
    assert body["signed_in"] is False
