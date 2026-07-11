"""Account management: profile, password reset, and GDPR data export/erasure."""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user, get_or_create_athlete
from app.core.email import send_password_changed_email, send_password_reset_email
from app.core.ratelimit import rate_limit
from app.core.security import (
    create_reset_token,
    decode_reset_token,
    hash_password,
)
from app.database import get_db
from app.models import (
    Analysis,
    AnalysisFeedback,
    AuditLog,
    Club,
    ClubMembership,
    CoachAthlete,
    CoachNote,
    Event,
    Goal,
    IntegrationToken,
    PersonalBest,
    Race,
    ShareLink,
    Subscription,
    Team,
    TeamMembership,
    TrainingSession,
    Upload,
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


@router.post(
    "/password-reset/request",
    dependencies=[Depends(rate_limit(5, 3600, "pwreset"))],
)
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
def confirm_password_reset(
    body: PasswordResetConfirm,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user_id = decode_reset_token(body.token)
    if not user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset token")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.hashed_password = hash_password(body.new_password)
    db.add(AuditLog(user_id=user.id, action="password_reset", target_type="user", target_id=user.id))
    db.commit()
    # Confirm the change by email (security best practice). Sent after the
    # response; the email layer swallows its own errors.
    if settings.email_enabled:
        background.add_task(send_password_changed_email, user.email, user.full_name)
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
    feedback = db.query(AnalysisFeedback).filter(AnalysisFeedback.user_id == user.id).all()
    integrations = db.query(IntegrationToken).filter(IntegrationToken.user_id == user.id).all()
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).one_or_none()
    coach_links = db.query(CoachAthlete).filter(
        (CoachAthlete.coach_user_id == user.id) | (CoachAthlete.athlete_id == athlete.id)
    ).all()
    notes = db.query(CoachNote).filter(CoachNote.coach_user_id == user.id).all()
    club_memberships = db.query(ClubMembership).filter(ClubMembership.athlete_id == athlete.id).all()
    share_links = db.query(ShareLink).filter(ShareLink.created_by == user.id).all()
    audit = db.query(AuditLog).filter(AuditLog.user_id == user.id).all()
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
        "subscription": ({"plan": sub.plan, "status": sub.status,
                          "paypal_subscription_id": sub.paypal_subscription_id} if sub else None),
        "connected_accounts": [{"provider": t.provider, "connected_at":
                                t.created_at.isoformat() if t.created_at else None}
                               for t in integrations],
        "analysis_feedback": [{"analysis_id": f.analysis_id, "rating": f.rating,
                               "comment": f.comment} for f in feedback],
        "coach_links": [{"coach_user_id": c.coach_user_id, "athlete_id": c.athlete_id,
                         "status": c.status} for c in coach_links],
        "coach_notes": [{"athlete_id": n.athlete_id, "race_id": n.race_id, "body": n.body} for n in notes],
        "club_memberships": [{"club_id": m.club_id, "role": m.role} for m in club_memberships],
        "share_links": [{"token": s.token, "resource_type": s.resource_type,
                         "resource_id": s.resource_id} for s in share_links],
        "audit_log": [{"action": a.action, "at": a.created_at.isoformat() if a.created_at else None}
                      for a in audit],
    }


@router.delete("/me")
def gdpr_delete(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """GDPR Article 17 — erase the authenticated user and all owned data."""
    from app.models import Athlete

    athlete = db.query(Athlete).filter(Athlete.user_id == user.id).one_or_none()
    # Connected-account OAuth tokens (e.g. Strava) — most important to purge.
    db.query(IntegrationToken).filter(IntegrationToken.user_id == user.id).delete()
    # Feedback, coaching relationships and notes, share links, subscription.
    db.query(AnalysisFeedback).filter(AnalysisFeedback.user_id == user.id).delete()
    db.query(CoachNote).filter(CoachNote.coach_user_id == user.id).delete()
    db.query(ShareLink).filter(ShareLink.created_by == user.id).delete()
    db.query(Subscription).filter(Subscription.user_id == user.id).delete()
    if athlete:
        db.query(TrainingSession).filter(TrainingSession.athlete_id == athlete.id).delete()
        db.query(Goal).filter(Goal.athlete_id == athlete.id).delete()
        db.query(PersonalBest).filter(PersonalBest.athlete_id == athlete.id).delete()
        db.query(CoachAthlete).filter(CoachAthlete.athlete_id == athlete.id).delete()
        db.query(ClubMembership).filter(ClubMembership.athlete_id == athlete.id).delete()
        db.query(TeamMembership).filter(TeamMembership.athlete_id == athlete.id).delete()
    db.query(CoachAthlete).filter(CoachAthlete.coach_user_id == user.id).delete()
    db.query(Upload).filter(Upload.user_id == user.id).delete()
    # Teams this user coaches are removed (with their memberships).
    for team in db.query(Team).filter(Team.coach_user_id == user.id).all():
        db.query(TeamMembership).filter(TeamMembership.team_id == team.id).delete()
        db.delete(team)
    # Events and clubs this user organises/owns are deleted with their data.
    for event in db.query(Event).filter(Event.organiser_user_id == user.id).all():
        db.delete(event)
    for club in db.query(Club).filter(Club.owner_user_id == user.id).all():
        db.query(ClubMembership).filter(ClubMembership.club_id == club.id).delete()
        db.delete(club)
    # Races cascade to analyses/controls/etc. via ORM relationships.
    for race in db.query(Race).filter(Race.owner_id == user.id).all():
        db.delete(race)
    if athlete:
        db.delete(athlete)
    # Audit logs are retained (legal/security record) but unlinked from the user.
    db.query(AuditLog).filter(AuditLog.user_id == user.id).update(
        {AuditLog.user_id: None}, synchronize_session=False
    )
    user_id = user.id
    db.delete(user)
    db.commit()
    logger.info("GDPR erasure completed for user %s", user_id)
    return {"message": "Account and associated data permanently deleted."}
