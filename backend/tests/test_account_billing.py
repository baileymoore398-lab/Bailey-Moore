"""Tests for account management, password reset, GDPR, and billing endpoints."""
from __future__ import annotations

from tests.conftest import make_gpx


def _register(client, email):
    r = client.post("/api/v1/auth/register",
                    json={"email": email, "password": "supersecret1", "full_name": "Test User"})
    assert r.status_code in (201, 409)
    if r.status_code == 409:
        r = client.post("/api/v1/auth/login", json={"email": email, "password": "supersecret1"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_me_and_profile_update(app_client):
    h = _register(app_client, "acct@example.com")
    r = app_client.get("/api/v1/account/me", headers=h)
    assert r.status_code == 200
    assert r.json()["email"] == "acct@example.com"
    assert r.json()["plan"] == "free"

    r = app_client.patch("/api/v1/account/profile", headers=h,
                         json={"display_name": "Speedy", "handle": "speedy", "country": "NO"})
    assert r.status_code == 200
    prof = app_client.get("/api/v1/athletes/me", headers=h).json()
    assert prof["display_name"] == "Speedy"
    assert prof["handle"] == "speedy"


def test_password_reset_flow(app_client):
    _register(app_client, "reset@example.com")
    r = app_client.post("/api/v1/account/password-reset/request", json={"email": "reset@example.com"})
    assert r.status_code == 200
    token = r.json().get("reset_token")  # exposed in dev (ENV != production)
    assert token, "reset token should be returned in dev mode"
    r = app_client.post("/api/v1/account/password-reset/confirm",
                        json={"token": token, "new_password": "brandnewpass9"})
    assert r.status_code == 200
    # Old password fails, new one works.
    assert app_client.post("/api/v1/auth/login",
                          json={"email": "reset@example.com", "password": "supersecret1"}).status_code == 401
    assert app_client.post("/api/v1/auth/login",
                          json={"email": "reset@example.com", "password": "brandnewpass9"}).status_code == 200

    # Unknown email returns 200 without enumeration and no token.
    r = app_client.post("/api/v1/account/password-reset/request", json={"email": "nobody@example.com"})
    assert r.status_code == 200


def test_gdpr_export_and_delete(app_client):
    h = _register(app_client, "gdpr@example.com")
    # Create some data.
    r = app_client.post("/api/v1/races", headers=h, data={"name": "My Race"})
    race_id = r.json()["id"]
    app_client.post(f"/api/v1/races/{race_id}/uploads/gps", headers=h,
                    files={"file": ("t.gpx", make_gpx(), "application/gpx+xml")})
    app_client.post(f"/api/v1/races/{race_id}/analyze", headers=h)

    r = app_client.get("/api/v1/account/export", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["email"] == "gdpr@example.com"
    assert len(data["races"]) == 1
    assert len(data["analyses"]) == 1

    # Delete erases the account.
    r = app_client.delete("/api/v1/account/me", headers=h)
    assert r.status_code == 200
    # Token now invalid (user gone).
    assert app_client.get("/api/v1/account/me", headers=h).status_code == 401


def test_billing_plans_and_subscription(app_client):
    h = _register(app_client, "billing@example.com")
    r = app_client.get("/api/v1/billing/plans")
    assert r.status_code == 200
    assert {p["id"] for p in r.json()["plans"]} == {"free", "pro", "team", "club"}
    assert r.json()["billing_enabled"] is False  # no Stripe key in tests

    r = app_client.get("/api/v1/billing/subscription", headers=h)
    assert r.status_code == 200
    assert r.json()["plan"] == "free"

    # Checkout without Stripe configured returns a clear 503, not a crash.
    r = app_client.post("/api/v1/billing/checkout", headers=h,
                        json={"plan": "pro", "success_url": "http://x/ok", "cancel_url": "http://x/no"})
    assert r.status_code == 503
