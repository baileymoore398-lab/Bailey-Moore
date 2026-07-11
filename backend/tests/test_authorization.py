"""Authorization: owners-only writes on owned races; anonymous races stay open."""


def _auth(app_client, email):
    r = app_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _make_race(app_client, headers=None):
    r = app_client.post(
        "/api/v1/races",
        data={"name": "R", "discipline": "orienteering"},
        headers=headers or {},
    )
    return r.json()["id"]


def test_owner_can_write_own_race(app_client):
    a = _auth(app_client, "owner_a@x.com")
    race_id = _make_race(app_client, a)
    # Owner can analyze (no data yet → 400, not 403 — proves auth passed).
    r = app_client.post(f"/api/v1/races/{race_id}/analyze", headers=a)
    assert r.status_code == 400


def test_other_user_cannot_write_owned_race(app_client):
    a = _auth(app_client, "owner_b@x.com")
    b = _auth(app_client, "intruder@x.com")
    race_id = _make_race(app_client, a)

    # Stranger cannot paste splits, or analyze someone else's race.
    r = app_client.post(
        f"/api/v1/races/{race_id}/splits/paste",
        json={"text": "Control,Time\n101,1:20\n102,2:45\n"},
        headers=b,
    )
    assert r.status_code == 403
    r = app_client.post(f"/api/v1/races/{race_id}/analyze", headers=b)
    assert r.status_code == 403


def test_anonymous_race_stays_open(app_client):
    # A race with no owner (signed-out demo flow) is still writable.
    race_id = _make_race(app_client)  # no auth → owner_id is None
    r = app_client.post(
        f"/api/v1/races/{race_id}/splits/paste",
        json={"text": "Control,Time\n101,1:20\n102,2:45\n"},
    )
    assert r.status_code == 200


def test_owned_race_read_is_private(app_client):
    # An owned race is private to its owner; strangers/anonymous get 403.
    # (Public sharing goes through tokenized /share links, not this path.)
    a = _auth(app_client, "reader_owner@x.com")
    b = _auth(app_client, "reader_intruder@x.com")
    race_id = _make_race(app_client, a)
    assert app_client.get(f"/api/v1/races/{race_id}").status_code == 403  # anon
    assert app_client.get(f"/api/v1/races/{race_id}", headers=b).status_code == 403
    assert app_client.get(f"/api/v1/races/{race_id}", headers=a).status_code == 200


def test_anonymous_race_read_stays_public(app_client):
    # A race with no owner (signed-out demo flow) stays readable by anyone.
    race_id = _make_race(app_client)
    assert app_client.get(f"/api/v1/races/{race_id}").status_code == 200


def _auth_h(app_client, email):
    r = app_client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_cannot_share_someone_elses_race(app_client):
    owner = _auth_h(app_client, "share_owner@x.com")
    other = _auth_h(app_client, "share_other@x.com")
    race_id = _make_race(app_client, owner)
    r = app_client.post("/api/v1/share", headers=other,
                        json={"resource_type": "race", "resource_id": race_id})
    assert r.status_code == 403


def test_video_generation_requires_owner(app_client):
    owner = _auth_h(app_client, "vid_owner@x.com")
    other = _auth_h(app_client, "vid_other@x.com")
    race_id = _make_race(app_client, owner)
    # Non-owner is rejected before any (expensive) work — 403, not 400.
    r = app_client.post(f"/api/v1/races/{race_id}/video", headers=other,
                        json={"fmt": "square", "duration_s": 6})
    assert r.status_code == 403
