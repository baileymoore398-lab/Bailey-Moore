"""Stripe billing: checkout, customer portal, webhooks, and plan enforcement.

Designed to run with or without Stripe configured. When ``STRIPE_SECRET_KEY`` is
absent, the endpoints return a clear 503 (so the rest of the platform is
unaffected) rather than crashing. Plan limits are always enforced via the
existing quota dependency regardless of Stripe.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user
from app.core.email import send_membership_confirmation_email
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
    """Public pricing catalogue. billing_enabled is true if either Stripe or
    PayPal is configured; the frontend uses the paypal block to render buttons."""
    # The master switch gates everything: keys can be configured but memberships
    # stay "coming soon" until MEMBERSHIPS_ENABLED is turned on.
    live = settings.memberships_live
    paypal = None
    if live and settings.paypal_configured:
        paypal = {
            "client_id": settings.PAYPAL_CLIENT_ID,
            "env": settings.PAYPAL_ENV,
            # Only tiers with a Plan ID configured are purchasable.
            "plans": {k: v for k, v in settings.paypal_plan_ids.items() if v},
        }
    return {
        "plans": PLANS,
        "billing_enabled": live,
        "paypal": paypal,
    }


class PayPalConfirm(BaseModel):
    subscription_id: str
    plan: str  # pro | team | club


@router.post("/paypal/confirm")
def paypal_confirm(
    body: PayPalConfirm,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Verify an approved PayPal subscription server-side, then upgrade the user.

    The browser can't be trusted, so we look the subscription up via PayPal's
    API, confirm it's ACTIVE/APPROVED, and confirm its plan_id matches the tier
    we configured — preventing a tampered client from claiming a paid plan.
    """
    if not settings.paypal_configured:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "PayPal is not configured."
        )
    if body.plan not in {"pro", "team", "club"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown plan")

    from app.services.billing import paypal

    try:
        details = paypal.get_subscription(body.subscription_id)
    except Exception as exc:  # noqa: BLE001 — network / not found
        logger.exception("PayPal subscription lookup failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Couldn't verify with PayPal: {exc}"
        )

    if details.get("status") not in ("ACTIVE", "APPROVED"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Subscription is not active (status: {details.get('status')}).",
        )
    # The tier MUST have a configured plan ID, and it must match — otherwise a
    # tampered client could claim a plan it didn't pay for.
    expected_plan_id = settings.paypal_plan_ids.get(body.plan)
    if not expected_plan_id or details.get("plan_id") != expected_plan_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Subscription plan does not match tier."
        )
    # Anti-replay: a subscription can only ever belong to one account.
    claimed = (
        db.query(Subscription)
        .filter(
            Subscription.paypal_subscription_id == body.subscription_id,
            Subscription.user_id != user.id,
        )
        .first()
    )
    if claimed is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This subscription is already linked to another account.",
        )

    sub = _get_or_create_sub(db, user)
    sub.plan = body.plan
    sub.status = "active"
    sub.paypal_subscription_id = body.subscription_id
    db.commit()
    # Send the branded "you're a member" email after responding; the email
    # layer swallows its own errors so it never affects the upgrade.
    if settings.email_enabled:
        background.add_task(
            send_membership_confirmation_email, user.email, user.full_name, sub.plan
        )
    return {"plan": sub.plan, "status": "active"}


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
    if not settings.STRIPE_WEBHOOK_SECRET:
        # Never process unverified events in production — a forged event could
        # grant a paid plan. Only allow the unsigned dev shortcut outside prod.
        if settings.ENV == "production":
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Webhook signature verification is not configured.",
            )
        import json

        try:
            event = json.loads(payload)
        except Exception as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid webhook: {exc}")
    else:
        try:
            event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
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
