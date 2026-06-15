"""End-to-end API tests for the event / coach / club / training ecosystem."""
from __future__ import annotations

from tests.conftest import make_gpx
from tests.test_ecosystem_engines import IOF_XML


def _auth(client, email):
    r = client.post("/api/v1/auth/register",
                    json={"email": email, "password": "supersecret1", "full_name": email.split("@")[0]})
    assert r.status_code in (201, 409), r.text
    if r.status_code == 409:
        r = client.post("/api/v1/auth/login", json={"email": email, "password": "supersecret1"})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, r.json()["user_id"]


def test_event_full_flow(app_client):
    h, _ = _auth(app_client, "organiser@example.com")

    # Create event
    r = app_client.post("/api/v1/events", headers=h,
                        json={"name": "Spring Cup", "discipline": "orienteering"})
    assert r.status_code == 201, r.text
    event_id = r.json()["id"]

    # Upload IOF results
    r = app_client.post(f"/api/v1/events/{event_id}/results", headers=h,
                        files={"file": ("results.xml", IOF_XML, "application/xml")})
    assert r.status_code == 200, r.text
    assert r.json()["competitors"] == 2

    # Bulk GPS upload with filenames matching competitor names
    files = [
        ("files", ("Jane_Smith.gpx", make_gpx(), "application/gpx+xml")),
        ("files", ("Bob_Jones.gpx", make_gpx(start_lat=60.01), "application/gpx+xml")),
    ]
    r = app_client.post(f"/api/v1/events/{event_id}/gps-batch", headers=h, files=files)
    assert r.status_code == 200, r.text
    assert r.json()["matched"] == 2

    # Build event analysis
    r = app_client.post(f"/api/v1/events/{event_id}/analyze", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["stats"]["competitors"] == 2

    # Fetch analysis (leaderboard etc.)
    r = app_client.get(f"/api/v1/events/{event_id}/analysis")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "Men Elite" in data["leaderboards"]
    assert data["leaderboards"]["Men Elite"][0]["position"] == 1

    # Multi-competitor replay
    r = app_client.get(f"/api/v1/events/{event_id}/replay")
    assert r.status_code == 200
    assert len(r.json()["competitors"]) == 2
    assert all("elapsed_s" in c["points"][0] for c in r.json()["competitors"])

    # Event heatmap
    r = app_client.get(f"/api/v1/replay/events/{event_id}/heatmap?mode=density")
    assert r.status_code == 200
    assert r.json()["points"]


def test_training_flow(app_client):
    h, _ = _auth(app_client, "runner@example.com")
    r = app_client.post("/api/v1/training/sessions", headers=h,
                        files={"file": ("run.gpx", make_gpx(), "application/gpx+xml")})
    assert r.status_code == 200, r.text
    assert r.json()["distance_m"] > 0
    assert r.json()["load"] > 0

    r = app_client.get("/api/v1/training/analytics", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "weekly_volume" in data and "race_readiness" in data
    assert 0 <= data["race_readiness"]["readiness"] <= 100

    # Goals
    r = app_client.post("/api/v1/training/goals", headers=h,
                        json={"title": "100km month", "metric": "distance_km", "target_value": 100})
    assert r.status_code == 200
    r = app_client.get("/api/v1/training/goals", headers=h)
    assert r.json()[0]["progress_pct"] >= 0


def test_coach_and_share_flow(app_client):
    coach_h, _ = _auth(app_client, "coach@example.com")
    athlete_h, _ = _auth(app_client, "pupil@example.com")

    # Athlete creates an analyzed race
    r = app_client.post("/api/v1/races", headers=athlete_h, data={"name": "Pupil Race"})
    race_id = r.json()["id"]
    app_client.post(f"/api/v1/races/{race_id}/uploads/gps", headers=athlete_h,
                    files={"file": ("t.gpx", make_gpx(), "application/gpx+xml")})
    app_client.post(f"/api/v1/races/{race_id}/analyze", headers=athlete_h)

    # Get the athlete's id via their profile
    prof = app_client.get("/api/v1/athletes/me", headers=athlete_h).json()
    athlete_id = prof["id"]
    assert athlete_id

    # Coach links the athlete
    r = app_client.post("/api/v1/coach/athletes", headers=coach_h, json={"athlete_id": athlete_id})
    assert r.status_code == 200, r.text
    r = app_client.get("/api/v1/coach/athletes", headers=coach_h)
    assert any(a["athlete_id"] == athlete_id for a in r.json())

    # Coach trends + recommendations
    r = app_client.get(f"/api/v1/coach/athletes/{athlete_id}/trends", headers=coach_h)
    assert r.status_code == 200
    assert "recommendations" in r.json()

    # Coach note
    r = app_client.post("/api/v1/coach/notes", headers=coach_h,
                        json={"athlete_id": athlete_id, "race_id": race_id, "body": "Great run"})
    assert r.status_code == 200

    # Share the race publicly and resolve without auth
    r = app_client.post("/api/v1/share", headers=athlete_h,
                        json={"resource_type": "race", "resource_id": race_id})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    r = app_client.get(f"/api/v1/share/{token}")
    assert r.status_code == 200
    assert r.json()["type"] == "race"
    assert r.json()["analysis"]["metrics"]["distance_m"] > 0


def test_club_flow(app_client):
    h, _ = _auth(app_client, "clubadmin@example.com")
    r = app_client.post("/api/v1/clubs", headers=h, json={"name": "Forest OK", "country": "NO"})
    assert r.status_code == 200, r.text
    club_id = r.json()["id"]

    member_h, _ = _auth(app_client, "member@example.com")
    member_athlete = app_client.get("/api/v1/athletes/me", headers=member_h).json()["id"]
    r = app_client.post(f"/api/v1/clubs/{club_id}/members", headers=h,
                        json={"athlete_id": member_athlete})
    assert r.status_code == 200
    r = app_client.get(f"/api/v1/clubs/{club_id}/analytics")
    assert r.status_code == 200
    assert r.json()["members"] >= 1
