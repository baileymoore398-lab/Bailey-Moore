"""Coach dashboard: athlete management, performance trends, notes, teams."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import (
    Athlete,
    CoachAthlete,
    CoachNote,
    Race,
    Team,
    TeamMembership,
    User,
)
from app.schemas.ecosystem import CoachNoteCreate, LinkAthleteRequest, TeamCreate
from app.services.coaching.analytics import athlete_trends, coaching_recommendations

router = APIRouter(prefix="/coach", tags=["coach"])


def _resolve_athlete(db: Session, athlete_id: Optional[str], handle: Optional[str]) -> Athlete:
    athlete = None
    if athlete_id:
        athlete = db.get(Athlete, athlete_id)
    elif handle:
        athlete = db.query(Athlete).filter(Athlete.handle == handle).one_or_none()
    if athlete is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Athlete not found")
    return athlete


def _coached_athlete_ids(db: Session, coach_user_id: str) -> List[str]:
    links = db.query(CoachAthlete).filter(
        CoachAthlete.coach_user_id == coach_user_id,
        CoachAthlete.status == "active",
    ).all()
    return [link.athlete_id for link in links]


def _gather_races(db: Session, athlete: Athlete) -> List[dict]:
    races = db.query(Race).filter(Race.owner_id == athlete.user_id).all()
    out: List[dict] = []
    for r in races:
        a = r.analysis
        if not a or a.status != "complete":
            continue
        out.append({
            "name": r.name,
            "date": r.created_at.isoformat() if r.created_at else None,
            "scores": a.scores or {},
            "metrics": a.metrics or {},
            "legs": a.legs or [],
            "mistakes": [{"type": m.type, "lost_s": m.lost_s} for m in a.mistakes],
        })
    return out


@router.post("/athletes")
def link_athlete(
    body: LinkAthleteRequest, db: Session = Depends(get_db),
    coach: User = Depends(get_current_user),
):
    athlete = _resolve_athlete(db, body.athlete_id, body.athlete_handle)
    existing = db.query(CoachAthlete).filter(
        CoachAthlete.coach_user_id == coach.id, CoachAthlete.athlete_id == athlete.id
    ).one_or_none()
    if existing:
        existing.status = "active"
    else:
        db.add(CoachAthlete(coach_user_id=coach.id, athlete_id=athlete.id, status="active"))
    if coach.role == "athlete":
        coach.role = "coach"
    db.commit()
    return {"coach_id": coach.id, "athlete_id": athlete.id, "status": "active"}


@router.get("/athletes")
def list_athletes(db: Session = Depends(get_db), coach: User = Depends(get_current_user)):
    ids = _coached_athlete_ids(db, coach.id)
    athletes = db.query(Athlete).filter(Athlete.id.in_(ids)).all() if ids else []
    out = []
    for a in athletes:
        races = _gather_races(db, a)
        avg = (sum(r["scores"].get("overall", 0) for r in races) / len(races)) if races else 0.0
        out.append({
            "athlete_id": a.id, "display_name": a.display_name, "handle": a.handle,
            "races": len(races), "avg_overall": round(avg, 1),
        })
    return out


@router.get("/athletes/{athlete_id}/trends")
def athlete_trend_report(
    athlete_id: str, db: Session = Depends(get_db), coach: User = Depends(get_current_user),
):
    if athlete_id not in _coached_athlete_ids(db, coach.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not coaching this athlete")
    athlete = db.get(Athlete, athlete_id)
    if athlete is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Athlete not found")
    races = _gather_races(db, athlete)
    trends = athlete_trends(races)
    recs = coaching_recommendations(trends)
    return {"athlete_id": athlete_id, "display_name": athlete.display_name, **trends, **recs}


@router.post("/notes")
def create_note(
    body: CoachNoteCreate, db: Session = Depends(get_db),
    coach: User = Depends(get_current_user),
):
    if body.athlete_id not in _coached_athlete_ids(db, coach.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not coaching this athlete")
    note = CoachNote(
        coach_user_id=coach.id, athlete_id=body.athlete_id, race_id=body.race_id,
        body=body.body, visibility=body.visibility,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {"id": note.id, "created_at": note.created_at.isoformat()}


@router.get("/athletes/{athlete_id}/notes")
def list_notes(
    athlete_id: str, db: Session = Depends(get_db), coach: User = Depends(get_current_user),
):
    notes = db.query(CoachNote).filter(
        CoachNote.coach_user_id == coach.id, CoachNote.athlete_id == athlete_id
    ).order_by(CoachNote.created_at.desc()).all()
    return [
        {"id": n.id, "body": n.body, "race_id": n.race_id, "visibility": n.visibility,
         "created_at": n.created_at.isoformat() if n.created_at else None}
        for n in notes
    ]


@router.post("/teams")
def create_team(
    body: TeamCreate, db: Session = Depends(get_db), coach: User = Depends(get_current_user),
):
    team = Team(name=body.name, description=body.description, coach_user_id=coach.id,
                club_id=body.club_id)
    db.add(team)
    db.commit()
    db.refresh(team)
    return {"id": team.id, "name": team.name}


@router.post("/teams/{team_id}/members")
def add_team_member(
    team_id: str, body: LinkAthleteRequest, db: Session = Depends(get_db),
    coach: User = Depends(get_current_user),
):
    team = db.get(Team, team_id)
    if team is None or team.coach_user_id != coach.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    athlete = _resolve_athlete(db, body.athlete_id, body.athlete_handle)
    db.add(TeamMembership(team_id=team_id, athlete_id=athlete.id))
    db.commit()
    return {"team_id": team_id, "athlete_id": athlete.id}


@router.get("/teams")
def list_teams(db: Session = Depends(get_db), coach: User = Depends(get_current_user)):
    teams = db.query(Team).filter(Team.coach_user_id == coach.id).all()
    return [
        {"id": t.id, "name": t.name, "members": len(t.members), "description": t.description}
        for t in teams
    ]
