"""PayPal REST API helpers — OAuth token + subscription lookup.

Used to verify, server-side, that a subscription a user approved in the browser
is genuinely ACTIVE before we upgrade their plan (so the plan can't be spoofed
from the client). Requires PAYPAL_CLIENT_ID / PAYPAL_SECRET.
"""
from __future__ import annotations

import base64

import httpx

from app.config import settings


def _basic_auth() -> str:
    creds = f"{settings.PAYPAL_CLIENT_ID}:{settings.PAYPAL_SECRET}".encode()
    return "Basic " + base64.b64encode(creds).decode()


def get_access_token() -> str:
    resp = httpx.post(
        f"{settings.paypal_api_base}/v1/oauth2/token",
        headers={
            "Authorization": _basic_auth(),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_subscription(subscription_id: str) -> dict:
    """Fetch a subscription's details (status, plan_id, subscriber…)."""
    token = get_access_token()
    resp = httpx.get(
        f"{settings.paypal_api_base}/v1/billing/subscriptions/{subscription_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def cancel_subscription(subscription_id: str, reason: str = "User requested") -> None:
    token = get_access_token()
    httpx.post(
        f"{settings.paypal_api_base}/v1/billing/subscriptions/{subscription_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": reason},
        timeout=30,
    )
