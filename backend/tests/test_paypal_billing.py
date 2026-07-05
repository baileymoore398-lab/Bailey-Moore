"""PayPal membership confirm flow with the PayPal API mocked."""
from unittest.mock import patch

from app.config import settings


def _auth(app_client, email="pp@x.com"):
    r = app_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_plans_unconfigured(app_client):
    r = app_client.get("/api/v1/billing/plans")
    assert r.status_code == 200
    body = r.json()
    assert body["billing_enabled"] is False
    assert body["paypal"] is None


def test_confirm_requires_config(app_client):
    h = _auth(app_client, "pp1@x.com")
    r = app_client.post(
        "/api/v1/billing/paypal/confirm",
        json={"subscription_id": "I-XXX", "plan": "pro"},
        headers=h,
    )
    assert r.status_code == 503


def test_confirm_active_subscription_upgrades(app_client):
    h = _auth(app_client, "pp2@x.com")
    active = {"status": "ACTIVE", "plan_id": "P-PRO-123"}
    with patch.object(settings, "PAYPAL_CLIENT_ID", "cid"), \
         patch.object(settings, "PAYPAL_SECRET", "secret"), \
         patch.object(settings, "PAYPAL_PLAN_PRO", "P-PRO-123"), \
         patch("app.services.billing.paypal.get_subscription", return_value=active):
        r = app_client.post(
            "/api/v1/billing/paypal/confirm",
            json={"subscription_id": "I-ACTIVE", "plan": "pro"},
            headers=h,
        )
    assert r.status_code == 200
    assert r.json()["plan"] == "pro"
    # And the plan sticks.
    sub = app_client.get("/api/v1/billing/subscription", headers=h).json()
    assert sub["plan"] == "pro"


def test_confirm_rejects_inactive(app_client):
    h = _auth(app_client, "pp3@x.com")
    inactive = {"status": "APPROVAL_PENDING", "plan_id": "P-PRO-123"}
    with patch.object(settings, "PAYPAL_CLIENT_ID", "cid"), \
         patch.object(settings, "PAYPAL_SECRET", "secret"), \
         patch("app.services.billing.paypal.get_subscription", return_value=inactive):
        r = app_client.post(
            "/api/v1/billing/paypal/confirm",
            json={"subscription_id": "I-PENDING", "plan": "pro"},
            headers=h,
        )
    assert r.status_code == 400


def test_confirm_rejects_plan_mismatch(app_client):
    """A tampered client can't claim a tier its subscription didn't pay for."""
    h = _auth(app_client, "pp4@x.com")
    # Subscription is for the cheap plan, but the client claims 'club'.
    active_wrong = {"status": "ACTIVE", "plan_id": "P-PRO-123"}
    with patch.object(settings, "PAYPAL_CLIENT_ID", "cid"), \
         patch.object(settings, "PAYPAL_SECRET", "secret"), \
         patch.object(settings, "PAYPAL_PLAN_CLUB", "P-CLUB-999"), \
         patch("app.services.billing.paypal.get_subscription", return_value=active_wrong):
        r = app_client.post(
            "/api/v1/billing/paypal/confirm",
            json={"subscription_id": "I-ACTIVE", "plan": "club"},
            headers=h,
        )
    assert r.status_code == 400
