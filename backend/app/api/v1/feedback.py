"""AI coach feedback: collect thumbs up/down + comments, and (admin-only) review.

Feedback is public to submit (so anyone viewing an analysis can rate it) but the
aggregated results are visible only to configured admins.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_optional_user, require_role
from app.database import get_db
from app.models import Analysis, AnalysisFeedback, Race, User

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    analysis_id: Optional[str] = None
    rating: str = Field(pattern="^(up|down)$")
    comment: Optional[str] = Field(default=None, max_length=2000)


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """Record a thumbs up/down (and optional comment) on an AI coach report."""
    coach_generated_by = None
    coach_summary = None
    scores: dict = {}
    discipline = None

    if body.analysis_id:
        analysis = db.get(Analysis, body.analysis_id)
        if analysis is not None:
            coach = analysis.coach or {}
            coach_generated_by = coach.get("generated_by")
            coach_summary = coach.get("overview") or coach.get("summary")
            scores = analysis.scores or {}
            race = db.get(Race, analysis.race_id)
            discipline = getattr(race, "discipline", None)

    fb = AnalysisFeedback(
        analysis_id=body.analysis_id,
        race_id=None,
        user_id=user.id if user else None,
        rating=body.rating,
        comment=(body.comment or "").strip() or None,
        coach_generated_by=coach_generated_by,
        coach_summary=coach_summary,
        discipline=discipline,
        scores=scores,
    )
    db.add(fb)
    db.commit()
    return {"ok": True}


@router.get("/summary", dependencies=[Depends(require_role("admin"))])
def feedback_summary(db: Session = Depends(get_db)):
    """Aggregate feedback stats — admin only."""
    up = db.query(func.count(AnalysisFeedback.id)).filter(AnalysisFeedback.rating == "up").scalar() or 0
    down = db.query(func.count(AnalysisFeedback.id)).filter(AnalysisFeedback.rating == "down").scalar() or 0
    total = up + down
    return {
        "total": total,
        "up": up,
        "down": down,
        "satisfaction_pct": round(up / total * 100, 1) if total else None,
    }


@router.get("", dependencies=[Depends(require_role("admin"))])
def list_feedback(db: Session = Depends(get_db), limit: int = 100):
    """Recent feedback with details — admin only."""
    rows = (
        db.query(AnalysisFeedback)
        .order_by(AnalysisFeedback.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
    return [
        {
            "id": r.id,
            "analysis_id": r.analysis_id,
            "rating": r.rating,
            "comment": r.comment,
            "coach_generated_by": r.coach_generated_by,
            "discipline": r.discipline,
            "overall": (r.scores or {}).get("overall"),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
