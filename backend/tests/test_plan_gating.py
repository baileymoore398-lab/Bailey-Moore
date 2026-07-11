"""Paid-feature gating: enforced only when memberships are live."""
from unittest.mock import patch

from app.config import settings


def _auth(app_client, email):
    r = app_client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_heatmap_open_while_memberships_off(app_client):
    # While billing isn't live, the Pro gate is a no-op (free/beta unaffected).
    # 404 (race not analyzed) proves we passed the gate rather than 402.
    h = _auth(app_client, "gate_off@x.com")
    r = app_client.get("/api/v1/replay/races/does-not-exist/heatmap", headers=h)
    assert r.status_code == 404


def test_heatmap_requires_pro_when_live(app_client):
    h = _auth(app_client, "gate_on@x.com")
    with patch.object(settings, "MEMBERSHIPS_ENABLED", True), \
         patch.object(settings, "STRIPE_SECRET_KEY", "sk_live_x"):
        # memberships_live is now true and the user is on the free plan → 402.
        r = app_client.get("/api/v1/replay/races/whatever/heatmap", headers=h)
        assert r.status_code == 402
