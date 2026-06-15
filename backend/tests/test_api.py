"""End-to-end API tests covering the full upload -> analyze -> fetch flow."""
from __future__ import annotations

from tests.conftest import make_gpx, make_splits_csv


def test_health(app_client):
    r = app_client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_full_race_flow(app_client):
    # 1. create race
    r = app_client.post("/api/v1/races", data={"name": "Forest Cup", "discipline": "orienteering"})
    assert r.status_code == 201, r.text
    race_id = r.json()["id"]

    # 2. upload GPS
    r = app_client.post(
        f"/api/v1/races/{race_id}/uploads/gps",
        files={"file": ("track.gpx", make_gpx(), "application/gpx+xml")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["point_count"] == 240

    # 3. upload splits
    r = app_client.post(
        f"/api/v1/races/{race_id}/uploads/splits",
        files={"file": ("splits.csv", make_splits_csv(), "text/csv")},
    )
    assert r.status_code == 200, r.text

    # 4. analyze (synchronous)
    r = app_client.post(f"/api/v1/races/{race_id}/analyze")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "complete"

    # 5. fetch analysis
    r = app_client.get(f"/api/v1/races/{race_id}/analysis")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["metrics"]["distance_m"] > 0
    assert set(data["scores"]) >= {"navigation", "fitness", "execution", "route_choice", "overall"}
    assert data["track"], "expected enriched track points"
    assert data["legs"], "expected per-leg analysis from splits"
    assert data["coach"]["summary"]
    # The deliberate stop should surface as a mistake.
    assert any(m["type"] == "stop" for m in data["mistakes"])


def test_analyze_requires_data(app_client):
    r = app_client.post("/api/v1/races", data={"name": "Empty"})
    race_id = r.json()["id"]
    r = app_client.post(f"/api/v1/races/{race_id}/analyze")
    assert r.status_code == 400


def test_auth_register_login(app_client):
    r = app_client.post(
        "/api/v1/auth/register",
        json={"email": "athlete@example.com", "password": "supersecret1", "full_name": "Athlete X"},
    )
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    r = app_client.get("/api/v1/athletes/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Athlete X"
