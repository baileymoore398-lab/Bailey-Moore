"""Shared FastAPI dependencies: current user, role checks, quota enforcement."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import decode_token
from app.database import get_db
from app.models import Plan, Subscription, User


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(User, payload["sub"])
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def get_optional_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising.

    Lets the core upload/analyze flow work anonymously in dev while still
    attributing ownership and enforcing quota when a user is authenticated.
    """
    if not authorization:
        return None
    try:
        return get_current_user(authorization, db)
    except HTTPException:
        return None


def require_role(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles and not user.is_superuser:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return checker


def get_or_create_athlete(db: Session, user: User):
    """Return the user's Athlete profile, creating one if missing."""
    from app.models import Athlete

    athlete = db.query(Athlete).filter(Athlete.user_id == user.id).one_or_none()
    if athlete is None:
        athlete = Athlete(
            user_id=user.id,
            display_name=user.full_name or user.email.split("@")[0],
        )
        db.add(athlete)
        db.flush()
    return athlete


def _current_period() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.year}-{now.month:02d}"


def enforce_analysis_quota(user: Optional[User], db: Session) -> None:
    """Enforce the free-plan monthly analysis quota.

    While billing is not configured (no Stripe key — i.e. memberships haven't
    opened), everything is free and unlimited: usage is still counted for
    stats, but nothing is ever blocked. The limit activates automatically the
    day Stripe is enabled. No-op for anonymous/dev.
    """
    if user is None:
        return
    sub = (
        db.query(Subscription).filter(Subscription.user_id == user.id).one_or_none()
    )
    if sub is None:
        sub = Subscription(user_id=user.id, plan=Plan.free.value)
        db.add(sub)
        db.flush()
    period = _current_period()
    if sub.period_label != period:
        sub.period_label = period
        sub.analyses_used = 0
    billing_live = bool(settings.STRIPE_SECRET_KEY)
    if (
        billing_live
        and sub.plan == Plan.free.value
        and sub.analyses_used >= settings.FREE_PLAN_MONTHLY_ANALYSES
    ):
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Free plan monthly analysis limit reached. Upgrade to Pro for unlimited analyses.",
        )
    sub.analyses_used += 1
    db.flush()
