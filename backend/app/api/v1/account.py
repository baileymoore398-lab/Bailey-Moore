"""Account management: profile, password reset, and GDPR data export/erasure."""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user, get_or_create_athlete
from app.core.email import send_password_reset_email
from app.core.security import (
    create_reset_token,
    decode_reset_token,
    hash_password,
)
from app.database import get_db
from app.models import (
    Analysis,
    AuditLog,
    Goal,
    PersonalBest,
    Race,
    Subscription,
    TrainingSession,
    User,
)
from app.schemas.schemas import (
    MeResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/account", tags=["account"])


def _plan_for(db: Session, user: User) -> tuple[str, int]:
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).one_or_none()
    if sub:
        return sub.plan, sub.analyses_used
    return "free", 0


@router.get("/me", response_model=MeResponse)
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan, used = _plan_for(db, user)
    return MeResponse(
        id=user.id, email=user.email, full_name=user.full_name, role=user.role,
        plan=plan, analyses_used=used, is_superuser=user.is_superuser,
    )


@router.patch("/profile", response_model=MeResponse)
def update_profile(
    body: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    if body.full_name is not None:
        user.full_name = body.full_name
    athlete = get_or_create_athlete(db, user)
    if body.display_name is not None:
        athlete.display_name = body.display_name
    if body.handle is not None:
        athlete.handle = body.handle
    if body.country is not None:
        athlete.country = body.country
    if body.bio is not None:
        athlete.bio = body.bio
    if body.is_public is not None:
        athlete.is_public = body.is_public
    db.commit()
    plan, used = _plan_for(db, user)
    return MeResponse(
        id=user.id, email=user.email, full_name=user.full_name, role=user.role,
        plan=plan, analyses_used=used, is_superuser=user.is_superuser,
    )


@router.post("/password-reset/request")
def request_password_reset(
    body: PasswordResetRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Issue a password-reset token and email it to the user.

    The token is emailed when an SMTP transport is configured. Without one (dev),
    the token is returned directly so the flow stays testable end-to-end. The
    response is identical whether or not the email exists, to avoid account
    enumeration.
    """
    user = db.query(User).filter(User.email == body.email).one_or_none()
    resp = {"message": "If that email exists, a reset link has been sent."}
    if user is None:
        return resp
    token = create_reset_token(user.id)
    if settings.email_enabled:
        # Send after the response; the email layer swallows its own errors.
        background.add_task(send_password_reset_email, user.email, token)
    elif settings.ENV != "production":
        # No email transport configured — expose the token for local testing.
        resp["reset_token"] = token
    else:
        logger.info("Password reset requested for user %s (no email transport)", user.id)
    return resp


@router.post("/password-reset/confirm")
def confirm_password_reset(body: PasswordResetConfirm, db: Session = Depends(get_db)):
    user_id = decode_reset_token(body.token)
    if not user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset token")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.hashed_password = hash_password(body.new_password)
    db.add(AuditLog(user_id=user.id, action="password_reset", target_type="user", target_id=user.id))
    db.commit()
    return {"message": "Password updated successfully."}


@router.get("/export")
def gdpr_export(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """GDPR Article 20 — export all personal data for the authenticated user."""
    athlete = get_or_create_athlete(db, user)
    races = db.query(Race).filter(Race.owner_id == user.id).all()
    analyses = db.query(Analysis).filter(
        Analysis.race_id.in_([r.id for r in races])
    ).all() if races else []
    sessions = db.query(TrainingSession).filter(TrainingSession.athlete_id == athlete.id).all()
    goals = db.query(Goal).filter(Goal.athlete_id == athlete.id).all()
    pbs = db.query(PersonalBest).filter(PersonalBest.athlete_id == athlete.id).all()
    db.add(AuditLog(user_id=user.id, action="gdpr_export", target_type="user", target_id=user.id))
    db.commit()
    return {
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name,
                 "role": user.role, "created_at": user.created_at.isoformat() if user.created_at else None},
        "athlete": {"display_name": athlete.display_name, "handle": athlete.handle,
                    "country": athlete.country, "bio": athlete.bio},
        "races": [{"id": r.id, "name": r.name, "discipline": r.discipline,
                   "status": r.status, "created_at": r.created_at.isoformat() if r.created_at else None}
                  for r in races],
        "analyses": [{"race_id": a.race_id, "metrics": a.metrics, "scores": a.scores} for a in analyses],
        "training_sessions": [{"id": s.id, "date": s.date.isoformat() if s.date else None,
                               "distance_m": s.distance_m, "load": s.load} for s in sessions],
        "goals": [{"title": g.title, "metric": g.metric, "target_value": g.target_value} for g in goals],
        "personal_bests": [{"category": p.category, "value": p.value, "unit": p.unit} for p in pbs],
    }


@router.delete("/me")
def gdpr_delete(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """GDPR Article 17 — erase the authenticated user and all owned data."""
    from app.models import Athlete

    athlete = db.query(Athlete).filter(Athlete.user_id == user.id).one_or_none()
    if athlete:
        db.query(TrainingSession).filter(TrainingSession.athlete_id == athlete.id).delete()
        db.query(Goal).filter(Goal.athlete_id == athlete.id).delete()
        db.query(PersonalBest).filter(PersonalBest.athlete_id == athlete.id).delete()
    # Races cascade to analyses/controls/etc. via ORM relationships.
    for race in db.query(Race).filter(Race.owner_id == user.id).all():
        db.delete(race)
    db.query(Subscription).filter(Subscription.user_id == user.id).delete()
    if athlete:
        db.delete(athlete)
    user_id = user.id
    db.delete(user)
    db.commit()
    logger.info("GDPR erasure completed for user %s", user_id)
    return {"message": "Account and associated data permanently deleted."}
