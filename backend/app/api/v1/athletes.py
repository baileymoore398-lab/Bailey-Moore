"""Athlete profile and aggregate performance stats."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Analysis, Athlete, Race, User
from app.schemas.schemas import AthleteProfileOut, AthleteStats

router = APIRouter(prefix="/athletes", tags=["athletes"])


def _build_profile(db: Session, user: User) -> AthleteProfileOut:
    athlete = db.query(Athlete).filter(Athlete.user_id == user.id).one_or_none()
    races = db.query(Race).filter(Race.owner_id == user.id).all()
    race_ids = [r.id for r in races]
    analyses = (
        db.query(Analysis).filter(Analysis.race_id.in_(race_ids)).all()
        if race_ids
        else []
    )

    total_dist = total_climb = 0.0
    controls_visited = 0
    overalls = []
    trend = []
    for r in races:
        a = next((x for x in analyses if x.race_id == r.id), None)
        if not a or a.status != "complete":
            continue
        m = a.metrics or {}
        total_dist += m.get("distance_m", 0) / 1000.0
        total_climb += m.get("total_climb_m", 0)
        controls_visited += len([c for c in r.controls])
        scores = a.scores or {}
        if scores.get("overall") is not None:
            overalls.append(scores["overall"])
        trend.append(
            {
                "race": r.name,
                "date": r.created_at.isoformat() if r.created_at else None,
                "overall": scores.get("overall"),
                "navigation": scores.get("navigation"),
                "fitness": scores.get("fitness"),
                "execution": scores.get("execution"),
                "route_choice": scores.get("route_choice"),
            }
        )

    stats = AthleteStats(
        races=len([r for r in races]),
        total_distance_km=round(total_dist, 2),
        total_climb_m=round(total_climb, 0),
        controls_visited=controls_visited,
        avg_overall_score=round(sum(overalls) / len(overalls), 1) if overalls else 0.0,
    )
    return AthleteProfileOut(
        id=athlete.id if athlete else None,
        display_name=athlete.display_name if athlete else (user.full_name or user.email),
        handle=athlete.handle if athlete else None,
        country=athlete.country if athlete else None,
        bio=athlete.bio if athlete else None,
        stats=stats,
        trend=trend,
    )


@router.get("/me", response_model=AthleteProfileOut)
def get_my_profile(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return _build_profile(db, user)


@router.get("/{handle}", response_model=AthleteProfileOut)
def get_public_profile(handle: str, db: Session = Depends(get_db)):
    athlete = db.query(Athlete).filter(Athlete.handle == handle).one_or_none()
    if not athlete or not athlete.is_public:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Athlete not found")
    return _build_profile(db, athlete.user)
