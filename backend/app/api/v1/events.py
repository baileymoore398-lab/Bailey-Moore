"""Event management: creation, bulk ingestion, event-wide analysis, replay."""
from __future__ import annotations

import re
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_optional_user
from app.database import get_db
from app.models import Event, User, gen_token
from app.schemas.ecosystem import EventCreate, EventEntryOut, EventOut
from app.services.events.ingest import (
    build_event_analysis,
    ingest_gps_batch,
    ingest_results,
    multi_replay_payload,
)

router = APIRouter(prefix="/events", tags=["events"])


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "event"
    return f"{base}-{gen_token()[:6]}"


def _event_out(event: Event) -> EventOut:
    return EventOut(
        id=event.id, name=event.name, slug=event.slug, discipline=event.discipline,
        status=event.status, date=event.date, location=event.location,
        description=event.description, is_public=event.is_public,
        entry_count=len(event.entries),
        matched_gps=sum(1 for e in event.entries if e.matched_gps),
        has_analysis=event.analysis is not None and event.analysis.status == "complete",
    )


MAX_UPLOAD_BYTES = 60 * 1024 * 1024  # 60 MB per file
MAX_BATCH_FILES = 200


def _get_event_or_404(event_id: str, db: Session) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        # Allow lookup by slug too.
        event = db.query(Event).filter(Event.slug == event_id).one_or_none()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return event


def _require_event_organiser(event: Event, user: User) -> None:
    if not (user.is_superuser or event.organiser_user_id == user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the event organiser can do that."
        )


async def _read_capped(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")
    return data


def _authorize_event_read(event: Event, user: Optional[User]) -> None:
    """Draft/private events are visible only to their organiser (or an admin);
    public events are open."""
    if event.is_public:
        return
    if user is not None and (user.is_superuser or event.organiser_user_id == user.id):
        return
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    body: EventCreate, db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    event = Event(
        name=body.name, slug=_slugify(body.name), discipline=body.discipline,
        date=body.date, location=body.location, description=body.description,
        organiser_user_id=user.id, status="draft",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_out(event)


@router.get("", response_model=List[EventOut])
def list_events(db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    q = db.query(Event).order_by(Event.created_at.desc())
    if user:
        q = q.filter((Event.organiser_user_id == user.id) | (Event.is_public.is_(True)))
    else:
        q = q.filter(Event.is_public.is_(True))
    return [_event_out(e) for e in q.limit(100).all()]


@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: str, db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    event = _get_event_or_404(event_id, db)
    _authorize_event_read(event, user)
    return _event_out(event)


@router.get("/{event_id}/entries", response_model=List[EventEntryOut])
def list_entries(event_id: str, course: Optional[str] = None, db: Session = Depends(get_db)):
    event = _get_event_or_404(event_id, db)
    entries = event.entries
    if course:
        entries = [e for e in entries if e.course == course]
    entries = sorted(entries, key=lambda e: (e.course or "", e.position or 9999))
    return [
        EventEntryOut(
            id=e.id, competitor_name=e.competitor_name, course=e.course,
            position=e.position, total_time_s=e.total_time_s, status=e.status,
            matched_gps=e.matched_gps, race_id=e.race_id,
        )
        for e in entries
    ]


@router.post("/{event_id}/results")
async def upload_results(
    event_id: str, file: UploadFile = File(...),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    event = _get_event_or_404(event_id, db)
    _require_event_organiser(event, user)
    data = await _read_capped(file)
    try:
        summary = ingest_results(event, file.filename or "results.xml", data, db)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    return {"event_id": event.id, **summary}


@router.post("/{event_id}/gps-batch")
async def upload_gps_batch(
    event_id: str, files: List[UploadFile] = File(...),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    event = _get_event_or_404(event_id, db)
    _require_event_organiser(event, user)
    if not event.entries:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload results before GPS tracks.")
    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Too many files (max {MAX_BATCH_FILES}).",
        )
    payload = [(f.filename or "track.gpx", await _read_capped(f)) for f in files]
    result = ingest_gps_batch(event, payload, db)
    return {"event_id": event.id, **result}


@router.post("/{event_id}/analyze")
def analyze_event(
    event_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    event = _get_event_or_404(event_id, db)
    _require_event_organiser(event, user)
    try:
        ea = build_event_analysis(event, db)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return {"event_id": event.id, "status": ea.status, "stats": ea.stats}


@router.get("/{event_id}/analysis")
def get_event_analysis(
    event_id: str, course: Optional[str] = None, db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    event = _get_event_or_404(event_id, db)
    _authorize_event_read(event, user)
    if event.analysis is None or event.analysis.status != "complete":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event analysis not available yet")
    ea = event.analysis
    if course:
        return {
            "event_id": event.id, "course": course,
            "leaderboard": ea.leaderboards.get(course, []),
            "leg_rankings": ea.leg_rankings.get(course, []),
            "route_comparison": ea.route_comparison.get(course, []),
            "stats": ea.stats,
        }
    return {
        "event_id": event.id, "name": event.name,
        "leaderboards": ea.leaderboards, "leg_rankings": ea.leg_rankings,
        "route_comparison": ea.route_comparison, "stats": ea.stats,
    }


@router.get("/{event_id}/replay")
def event_replay(
    event_id: str, course: Optional[str] = None, db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    event = _get_event_or_404(event_id, db)
    _authorize_event_read(event, user)
    return multi_replay_payload(event, db, course)
