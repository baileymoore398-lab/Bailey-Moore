"""Training analytics: session upload, volume, trends, readiness, goals, PBs."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_or_create_athlete
from app.database import get_db
from app.models import Goal, Race, TrainingSession, User
from app.schemas.ecosystem import GoalCreate, TrainingSessionOut
from app.services.gps.analysis import analyze_track
from app.services.gps.parser import parse_track
from app.services.storage.store import get_storage
from app.services.training.analytics import (
    acute_chronic_load,
    compute_personal_bests,
    monthly_volume,
    race_readiness,
    session_load,
    speed_hr_trends,
    weekly_volume,
)

router = APIRouter(prefix="/training", tags=["training"])


def _hr_stats(points: List[dict]):
    hrs = [p["hr"] for p in points if p.get("hr")]
    if not hrs:
        return None, None
    return sum(hrs) / len(hrs), max(hrs)


def _sessions_as_dicts(sessions: List[TrainingSession]) -> List[dict]:
    return [
        {
            "date": s.date, "distance_m": s.distance_m, "duration_s": s.duration_s,
            "moving_time_s": s.moving_time_s, "climb_m": s.climb_m,
            "avg_speed_kmh": s.avg_speed_kmh, "avg_hr": s.avg_hr, "load": s.load,
        }
        for s in sessions
    ]


@router.post("/sessions", response_model=TrainingSessionOut)
async def upload_session(
    file: UploadFile = File(...), sport: str = "run",
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    athlete = get_or_create_athlete(db, user)
    data = await file.read()
    try:
        points = parse_track(file.filename or "", data)
        result = analyze_track(points)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    m = result.metrics
    avg_hr, max_hr = _hr_stats(points)
    sess_date = date.today()
    if points and points[0].get("t"):
        sess_date = datetime.fromtimestamp(points[0]["t"], tz=timezone.utc).date()
    key = f"training/{athlete.id}/{file.filename or 'session.gpx'}"
    get_storage().put(key, data, file.content_type)

    sess = TrainingSession(
        athlete_id=athlete.id, user_id=user.id, date=sess_date, sport=sport,
        track_key=key, distance_m=m["distance_m"], duration_s=m["duration_s"],
        moving_time_s=m["moving_time_s"], climb_m=m["total_climb_m"],
        avg_speed_kmh=m["avg_speed_kmh"], avg_hr=avg_hr, max_hr=max_hr,
        load=session_load(m["moving_time_s"], avg_hr, m["avg_speed_kmh"]),
        metrics=m,
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return sess


@router.get("/sessions", response_model=List[TrainingSessionOut])
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    athlete = get_or_create_athlete(db, user)
    sessions = db.query(TrainingSession).filter(
        TrainingSession.athlete_id == athlete.id
    ).order_by(TrainingSession.date.desc()).all()
    return sessions


@router.get("/analytics")
def training_analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    athlete = get_or_create_athlete(db, user)
    sessions = db.query(TrainingSession).filter(
        TrainingSession.athlete_id == athlete.id
    ).all()
    sdicts = _sessions_as_dicts(sessions)

    # Recent navigation scores from races for readiness.
    races = db.query(Race).filter(Race.owner_id == user.id).all()
    nav_scores = [
        r.analysis.scores.get("navigation")
        for r in races
        if r.analysis and r.analysis.status == "complete" and r.analysis.scores.get("navigation") is not None
    ]
    return {
        "weekly_volume": weekly_volume(sdicts),
        "monthly_volume": monthly_volume(sdicts),
        "speed_hr_trends": speed_hr_trends(sdicts),
        "training_load": acute_chronic_load(sdicts),
        "race_readiness": race_readiness(sdicts, nav_scores),
        "personal_bests": compute_personal_bests(sdicts),
        "session_count": len(sessions),
    }


@router.post("/goals")
def create_goal(body: GoalCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    athlete = get_or_create_athlete(db, user)
    goal = Goal(
        athlete_id=athlete.id, title=body.title, metric=body.metric,
        target_value=body.target_value, period=body.period, due_date=body.due_date,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return {"id": goal.id, "title": goal.title}


@router.get("/goals")
def list_goals(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    athlete = get_or_create_athlete(db, user)
    goals = db.query(Goal).filter(Goal.athlete_id == athlete.id).all()
    # Auto-progress distance/session goals from training sessions.
    sessions = db.query(TrainingSession).filter(TrainingSession.athlete_id == athlete.id).all()
    total_km = sum(s.distance_m for s in sessions) / 1000.0
    out = []
    for g in goals:
        current = g.current_value
        if g.metric == "distance_km":
            current = round(total_km, 1)
        elif g.metric == "sessions":
            current = len(sessions)
        pct = round(min(100.0, (current / g.target_value * 100.0)), 1) if g.target_value else 0.0
        out.append({
            "id": g.id, "title": g.title, "metric": g.metric,
            "target_value": g.target_value, "current_value": current,
            "progress_pct": pct, "period": g.period,
            "due_date": g.due_date.isoformat() if g.due_date else None,
            "status": "complete" if pct >= 100 else g.status,
        })
    return out
