"""Stripe billing: checkout, customer portal, webhooks, and plan enforcement.

Designed to run with or without Stripe configured. When ``STRIPE_SECRET_KEY`` is
absent, the endpoints return a clear 503 (so the rest of the platform is
unaffected) rather than crashing. Plan limits are always enforced via the
existing quota dependency regardless of Stripe.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models import Plan, Subscription, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])

# Plan catalogue surfaced to the frontend pricing page.
PLANS = [
    {"id": "free", "name": "Free", "price_month": 0,
     "features": ["5 analyses / month", "Interactive replay", "Basic AI coach"]},
    {"id": "pro", "name": "Pro", "price_month": 9,
     "features": ["Unlimited analyses", "AI coach + video export", "Heatmaps", "Public sharing"]},
    {"id": "team", "name": "Team", "price_month": 29,
     "features": ["Everything in Pro", "Coach dashboard", "Up to 15 athletes", "Team analytics"]},
    {"id": "club", "name": "Club", "price_month": 79,
     "features": ["Everything in Team", "Club dashboard", "Event hosting", "Unlimited members"]},
]

_PRICE_ENV = {
    "pro": "STRIPE_PRICE_PRO",
    "team": "STRIPE_PRICE_TEAM",
    "club": "STRIPE_PRICE_CLUB",
}


class CheckoutRequest(BaseModel):
    plan: str  # pro | team | club
    success_url: str
    cancel_url: str


def _stripe():
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Billing is not configured (STRIPE_SECRET_KEY missing).",
        )
    try:
        import stripe
    except ImportError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "stripe package not installed")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def _get_or_create_sub(db: Session, user: User) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).one_or_none()
    if sub is None:
        sub = Subscription(user_id=user.id, plan=Plan.free.value)
        db.add(sub)
        db.flush()
    return sub


@router.get("/plans")
def list_plans():
    """Public pricing catalogue."""
    return {"plans": PLANS, "billing_enabled": bool(settings.STRIPE_SECRET_KEY)}


@router.get("/subscription")
def my_subscription(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sub = _get_or_create_sub(db, user)
    db.commit()
    return {
        "plan": sub.plan, "status": sub.status,
        "analyses_used": sub.analyses_used, "period": sub.period_label,
        "has_stripe": bool(sub.stripe_customer_id),
    }


@router.post("/checkout")
def create_checkout(
    body: CheckoutRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    if body.plan not in _PRICE_ENV:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown plan")
    stripe = _stripe()
    import os

    price_id = os.environ.get(_PRICE_ENV[body.plan])
    if not price_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            f"Price ID for {body.plan} not configured")
    sub = _get_or_create_sub(db, user)
    if not sub.stripe_customer_id:
        customer = stripe.Customer.create(email=user.email, metadata={"user_id": user.id})
        sub.stripe_customer_id = customer.id
        db.commit()
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=sub.stripe_customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"user_id": user.id, "plan": body.plan},
    )
    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/portal")
def customer_portal(
    return_url: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    stripe = _stripe()
    sub = _get_or_create_sub(db, user)
    if not sub.stripe_customer_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No billing account yet")
    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id, return_url=return_url
    )
    return {"portal_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe subscription lifecycle events."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Billing not configured")
    import stripe

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        if settings.STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
        else:
            import json
            event = json.loads(payload)
    except Exception as exc:  # signature/parse failure
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid webhook: {exc}")

    etype = event["type"] if isinstance(event, dict) else event.type
    data = (event["data"]["object"] if isinstance(event, dict) else event.data.object)
    _apply_webhook(db, etype, data)
    return {"received": True}


def _apply_webhook(db: Session, etype: str, obj: dict) -> None:
    customer_id = obj.get("customer")
    if not customer_id:
        return
    sub = db.query(Subscription).filter(
        Subscription.stripe_customer_id == customer_id
    ).one_or_none()
    if sub is None:
        return
    if etype in ("checkout.session.completed", "customer.subscription.updated",
                 "customer.subscription.created"):
        plan = (obj.get("metadata") or {}).get("plan", "pro")
        sub.plan = plan if plan in {p["id"] for p in PLANS} else "pro"
        sub.status = "active"
        sub.stripe_subscription_id = obj.get("subscription") or obj.get("id")
    elif etype in ("customer.subscription.deleted",):
        sub.plan = Plan.free.value
        sub.status = "canceled"
    db.commit()
