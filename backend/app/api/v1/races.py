"""Race lifecycle endpoints: create, upload map/gps/splits, analyze, fetch."""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.serializers import analysis_to_out, race_to_out
from app.core.deps import enforce_analysis_quota, get_optional_user
from app.core.ratelimit import rate_limit
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
from app.services.splits.parser import parse_splits, parse_winsplits_paste
from app.services.storage.store import get_storage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/races", tags=["races"])

MAX_UPLOAD_BYTES = 60 * 1024 * 1024  # 60 MB


def _get_race_or_404(race_id: str, db: Session) -> Race:
    race = db.get(Race, race_id)
    if race is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Race not found")
    return race


def _authorize_race_write(race: Race, user: Optional[User]) -> None:
    """Only the owner (or an admin) may modify an owned race.

    Anonymous races (no owner — created in the signed-out demo flow) stay open
    so that flow keeps working; reads are intentionally left public so shared
    race links resolve.
    """
    if race.owner_id and (
        user is None
        or (user.id != race.owner_id and not user.is_superuser)
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You don't have access to this race."
        )


def _authorize_race_read(race: Race, user: Optional[User]) -> None:
    """Reads follow the same rule as writes: an owned race is private to its
    owner (or an admin). Anonymous races (signed-out demo uploads) stay public,
    and public sharing goes through tokenized ``/share`` links, not this path.
    """
    _authorize_race_write(race, user)


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
def get_race(
    race_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = _get_race_or_404(race_id, db)
    _authorize_race_read(race, user)
    return race_to_out(race)


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
    _authorize_race_write(race, user)
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
    _authorize_race_write(race, user)
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
    _authorize_race_write(race, user)
    data = await _read_upload(file)
    # Splits are optional and file formats vary wildly — a parse failure must
    # never 500. Treat any error as "couldn't read", and continue without splits.
    try:
        parsed = parse_splits(file.filename or "", data)
    except Exception:  # noqa: BLE001
        logger.exception("Splits parse failed for %s", file.filename)
        parsed = {"controls": [], "competitors": []}
    key = f"splits/{race.id}/{file.filename or 'splits'}"
    get_storage().put(key, data, file.content_type)
    _register_upload(db, race, user, "splits", key, file, len(data))

    # Splits are optional. If we couldn't read any times, keep the raw file but
    # don't fail the upload — the analysis just runs without split-based data.
    if not parsed.get("competitors"):
        db.commit()
        return UploadOut(
            id=race.split_set.id if race.split_set else "unparsed",
            kind="splits",
            filename=file.filename,
            parsed=False,
            detail=(
                "We couldn't read split times from this file, so your analysis "
                "will run without them. Supported: a WinSplits/IOF export, or a "
                "simple CSV of control,time (or control,split,cumulative)."
            ),
        )

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
    db.commit()
    return UploadOut(id=race.split_set.id, kind="splits", filename=file.filename, parsed=True)


class SplitsPasteIn(BaseModel):
    text: str


@router.post("/{race_id}/splits/paste", response_model=UploadOut)
def paste_splits(
    race_id: str,
    body: SplitsPasteIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """Accept split times pasted from a WinSplits Online table (or any delimited
    text). Parses out the athlete's cumulative splits."""
    race = _get_race_or_404(race_id, db)
    _authorize_race_write(race, user)
    text = body.text or ""
    parsed = {"controls": [], "competitors": []}
    try:
        parsed = parse_winsplits_paste(text)
        if not parsed.get("competitors"):
            # Fall back to the generic delimited/JSON/XML parser.
            parsed = parse_splits("pasted.txt", text.encode("utf-8"))
    except Exception:  # noqa: BLE001
        logger.exception("Pasted splits parse failed")

    if not parsed.get("competitors"):
        return UploadOut(
            id="unparsed",
            kind="splits",
            filename="pasted",
            parsed=False,
            detail="Couldn't read split times from the pasted text.",
        )

    key = f"splits/{race.id}/pasted.txt"
    get_storage().put(key, text.encode("utf-8"), "text/plain")
    if race.split_set:
        race.split_set.data = parsed
        race.split_set.original_key = key
        race.split_set.source = "winsplits_paste"
    else:
        race.split_set = SplitSet(
            race_id=race.id, data=parsed, original_key=key, source="winsplits_paste"
        )
    db.commit()
    return UploadOut(id=race.split_set.id, kind="splits", filename="pasted", parsed=True)


@router.post(
    "/{race_id}/analyze",
    response_model=AnalyzeResponse,
    dependencies=[Depends(rate_limit(30, 3600, "analyze"))],
)
def analyze_race(
    race_id: str,
    background: bool = False,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = _get_race_or_404(race_id, db)
    _authorize_race_write(race, user)
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

        try:
            run_analysis_task.delay(race.id)
        except Exception as exc:  # noqa: BLE001 — broker (Redis) unreachable
            logger.warning("Celery dispatch failed (%s); running analysis inline", exc)
            from app.services.pipeline import run_analysis

            analysis = run_analysis(race.id, db)
            return AnalyzeResponse(
                analysis_id=analysis.id, race_id=race.id, status=analysis.status
            )
        return AnalyzeResponse(analysis_id="pending", race_id=race.id, status="processing")

    from app.services.pipeline import run_analysis

    analysis = run_analysis(race.id, db)
    return AnalyzeResponse(analysis_id=analysis.id, race_id=race.id, status=analysis.status)


@router.get("/{race_id}/analysis", response_model=AnalysisOut)
def get_analysis(
    race_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    race = _get_race_or_404(race_id, db)
    _authorize_race_read(race, user)
    if race.analysis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No analysis yet for this race")
    return analysis_to_out(race.analysis, race)
