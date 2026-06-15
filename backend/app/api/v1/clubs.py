"""Club dashboard: members, club-wide analytics, participation, rankings."""
from __future__ import annotations

import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import (
    Athlete,
    Club,
    ClubMembership,
    Race,
    User,
    gen_token,
)
from app.schemas.ecosystem import ClubCreate, ClubMemberAdd

router = APIRouter(prefix="/clubs", tags=["clubs"])


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "club"
    return f"{base}-{gen_token()[:5]}"


def _resolve_athlete(db, athlete_id, handle) -> Athlete:
    athlete = db.get(Athlete, athlete_id) if athlete_id else None
    if not athlete and handle:
        athlete = db.query(Athlete).filter(Athlete.handle == handle).one_or_none()
    if not athlete:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Athlete not found")
    return athlete


@router.post("")
def create_club(body: ClubCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    club = Club(name=body.name, slug=_slugify(body.name), country=body.country,
                owner_user_id=user.id)
    db.add(club)
    if user.role == "athlete":
        user.role = "club_admin"
    db.commit()
    db.refresh(club)
    return {"id": club.id, "name": club.name, "slug": club.slug}


@router.get("")
def list_clubs(db: Session = Depends(get_db)):
    return [
        {"id": c.id, "name": c.name, "slug": c.slug, "members": len(c.memberships)}
        for c in db.query(Club).order_by(Club.created_at.desc()).limit(100).all()
    ]


@router.post("/{club_id}/members")
def add_member(
    club_id: str, body: ClubMemberAdd, db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    club = db.get(Club, club_id)
    if club is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")
    athlete = _resolve_athlete(db, body.athlete_id, body.athlete_handle)
    exists = db.query(ClubMembership).filter(
        ClubMembership.club_id == club_id, ClubMembership.athlete_id == athlete.id
    ).one_or_none()
    if not exists:
        db.add(ClubMembership(club_id=club_id, athlete_id=athlete.id, role=body.role))
    db.commit()
    return {"club_id": club_id, "athlete_id": athlete.id, "role": body.role}


@router.get("/{club_id}/members")
def list_members(club_id: str, db: Session = Depends(get_db)):
    club = db.get(Club, club_id)
    if club is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")
    out = []
    for m in club.memberships:
        a = db.get(Athlete, m.athlete_id)
        out.append({"athlete_id": m.athlete_id, "role": m.role,
                    "display_name": a.display_name if a else None,
                    "handle": a.handle if a else None})
    return out


@router.get("/{club_id}/analytics")
def club_analytics(club_id: str, db: Session = Depends(get_db)):
    club = db.get(Club, club_id)
    if club is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")
    athlete_ids = [m.athlete_id for m in club.memberships]
    athletes = db.query(Athlete).filter(Athlete.id.in_(athlete_ids)).all() if athlete_ids else []

    total_distance = total_climb = 0.0
    total_races = 0
    rankings: List[dict] = []
    event_participation: dict[str, int] = {}

    for a in athletes:
        races = db.query(Race).filter(Race.owner_id == a.user_id).all()
        scores = []
        a_dist = 0.0
        a_races = 0
        for r in races:
            if r.event_id:
                event_participation[r.event_id] = event_participation.get(r.event_id, 0) + 1
            an = r.analysis
            if an and an.status == "complete":
                m = an.metrics or {}
                total_distance += m.get("distance_m", 0) / 1000.0
                a_dist += m.get("distance_m", 0) / 1000.0
                total_climb += m.get("total_climb_m", 0)
                total_races += 1
                a_races += 1
                if (an.scores or {}).get("overall") is not None:
                    scores.append(an.scores["overall"])
        rankings.append({
            "athlete_id": a.id, "display_name": a.display_name,
            "races": a_races, "distance_km": round(a_dist, 1),
            "avg_overall": round(sum(scores) / len(scores), 1) if scores else 0.0,
        })

    rankings.sort(key=lambda x: x["avg_overall"], reverse=True)
    for i, row in enumerate(rankings, start=1):
        row["rank"] = i
    return {
        "club_id": club_id, "name": club.name,
        "members": len(athletes),
        "total_races": total_races,
        "total_distance_km": round(total_distance, 1),
        "total_climb_m": round(total_climb, 0),
        "events_participated": len(event_participation),
        "rankings": rankings,
    }
