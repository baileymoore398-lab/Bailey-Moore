"""Race lifecycle endpoints: create, upload map/gps/splits, analyze, fetch."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.serializers import analysis_to_out, race_to_out
from app.core.deps import enforce_analysis_quota, get_optional_user
from app.database import get_db
from app.models import (
    GpsTrack,
    MapAsset,
    Race,
    RaceStatus,
    SplitSet,
    Upload,
    User,
)
from app.schemas.schemas import AnalysisOut, AnalyzeResponse, RaceOut, UploadOut
from app.services.gps.parser import parse_track
from app.services.splits.parser import parse_splits
from app.services.storage.store import get_storage

router = APIRouter(prefix="/races", tags=["races"])

MAX_UPLOAD_BYTES = 60 * 1024 * 1024  # 60 MB


def _get_race_or_404(race_id: str, db: Session) -> Race:
    race = db.get(Race, race_id)
    if race is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Race not found")
    return race


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    return data


@router.post("", response_model=RaceOut, status_code=status.HTTP_201_CREATED)
def create_race(
    name: Optional[str] = Form(default=None),
    discipline: str = Form(default="orienteering"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = Race(
        name=name or "Untitled race",
        discipline=discipline,
        owner_id=user.id if user else None,
        status=RaceStatus.created.value,
    )
    db.add(race)
    db.commit()
    db.refresh(race)
    return race_to_out(race)


@router.get("", response_model=List[RaceOut])
def list_races(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
    limit: int = 50,
):
    q = db.query(Race).order_by(Race.created_at.desc())
    if user:
        q = q.filter(Race.owner_id == user.id)
    return [race_to_out(r) for r in q.limit(limit).all()]


@router.get("/{race_id}", response_model=RaceOut)
def get_race(race_id: str, db: Session = Depends(get_db)):
    return race_to_out(_get_race_or_404(race_id, db))


def _register_upload(db, race, user, kind, key, file, size):
    db.add(
        Upload(
            race_id=race.id,
            user_id=user.id if user else None,
            kind=kind,
            storage_key=key,
            filename=file.filename,
            content_type=file.content_type,
            size_bytes=size,
        )
    )


@router.post("/{race_id}/uploads/map", response_model=UploadOut)
async def upload_map(
    race_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = _get_race_or_404(race_id, db)
    data = await _read_upload(file)
    key = f"maps/{race.id}/{file.filename or 'map'}"
    get_storage().put(key, data, file.content_type)
    if race.map_asset:
        race.map_asset.original_key = key
    else:
        race.map_asset = MapAsset(race_id=race.id, original_key=key)
    _register_upload(db, race, user, "map", key, file, len(data))
    if race.status == RaceStatus.created.value:
        race.status = RaceStatus.uploaded.value
    db.commit()
    return UploadOut(id=race.map_asset.id, kind="map", filename=file.filename, url=get_storage().url(key))


@router.post("/{race_id}/uploads/gps", response_model=UploadOut)
async def upload_gps(
    race_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = _get_race_or_404(race_id, db)
    data = await _read_upload(file)
    try:
        points = parse_track(file.filename or "", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    if len(points) < 2:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No GPS points found in file")
    key = f"gps/{race.id}/{file.filename or 'track'}"
    get_storage().put(key, data, file.content_type)
    fmt = (file.filename or "gpx").rsplit(".", 1)[-1].lower()
    if race.gps_track:
        race.gps_track.points = points
        race.gps_track.point_count = len(points)
        race.gps_track.original_key = key
        race.gps_track.format = fmt
    else:
        race.gps_track = GpsTrack(
            race_id=race.id, points=points, point_count=len(points),
            original_key=key, format=fmt,
        )
    _register_upload(db, race, user, "gps", key, file, len(data))
    if race.status == RaceStatus.created.value:
        race.status = RaceStatus.uploaded.value
    db.commit()
    return UploadOut(id=race.gps_track.id, kind="gps", filename=file.filename, point_count=len(points))


@router.post("/{race_id}/uploads/splits", response_model=UploadOut)
async def upload_splits(
    race_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = _get_race_or_404(race_id, db)
    data = await _read_upload(file)
    parsed = parse_splits(file.filename or "", data)
    if not parsed.get("competitors"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No splits parsed from file")
    key = f"splits/{race.id}/{file.filename or 'splits'}"
    get_storage().put(key, data, file.content_type)
    _fn = (file.filename or "").lower()
    source = (
        "iof_xml" if _fn.endswith(".xml")
        else "json" if _fn.endswith(".json")
        else "csv"
    )
    if race.split_set:
        race.split_set.data = parsed
        race.split_set.original_key = key
        race.split_set.source = source
    else:
        race.split_set = SplitSet(race_id=race.id, data=parsed, original_key=key, source=source)
    _register_upload(db, race, user, "splits", key, file, len(data))
    db.commit()
    return UploadOut(id=race.split_set.id, kind="splits", filename=file.filename)


@router.post("/{race_id}/analyze", response_model=AnalyzeResponse)
def analyze_race(
    race_id: str,
    background: bool = False,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = _get_race_or_404(race_id, db)
    if not race.gps_track and not race.split_set:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Upload at least a GPS track or split times before analyzing.",
        )
    enforce_analysis_quota(user, db)
    db.commit()

    if background:
        # Dispatch to Celery (runs eagerly in dev). Returns immediately.
        from app.workers.tasks import run_analysis_task

        run_analysis_task.delay(race.id)
        return AnalyzeResponse(analysis_id="pending", race_id=race.id, status="processing")

    from app.services.pipeline import run_analysis

    analysis = run_analysis(race.id, db)
    return AnalyzeResponse(analysis_id=analysis.id, race_id=race.id, status=analysis.status)


@router.get("/{race_id}/analysis", response_model=AnalysisOut)
def get_analysis(race_id: str, db: Session = Depends(get_db)):
    race = _get_race_or_404(race_id, db)
    if race.analysis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No analysis yet for this race")
    return analysis_to_out(race.analysis, race)
