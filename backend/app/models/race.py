"""Race, map, GPS track, splits, and control models."""
from __future__ import annotations

import enum
from typing import List, Optional

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class RaceStatus(str, enum.Enum):
    created = "created"
    uploaded = "uploaded"
    processing = "processing"
    analyzed = "analyzed"
    failed = "failed"


class Race(Base, TimestampMixin):
    __tablename__ = "races"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    owner_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"))
    event_id: Mapped[Optional[str]] = mapped_column(ForeignKey("events.id"))
    name: Mapped[str] = mapped_column(String(255), default="Untitled race")
    discipline: Mapped[str] = mapped_column(String(32), default="orienteering")
    status: Mapped[str] = mapped_column(String(32), default=RaceStatus.created.value)
    # Free-form course metadata extracted from the map (event name, course, scale...)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)

    owner: Mapped[Optional["User"]] = relationship(back_populates="races")  # noqa: F821
    map_asset: Mapped[Optional["MapAsset"]] = relationship(
        back_populates="race", uselist=False, cascade="all, delete-orphan"
    )
    gps_track: Mapped[Optional["GpsTrack"]] = relationship(
        back_populates="race", uselist=False, cascade="all, delete-orphan"
    )
    split_set: Mapped[Optional["SplitSet"]] = relationship(
        back_populates="race", uselist=False, cascade="all, delete-orphan"
    )
    controls: Mapped[List["Control"]] = relationship(
        back_populates="race", cascade="all, delete-orphan", order_by="Control.order"
    )
    analysis: Mapped[Optional["Analysis"]] = relationship(  # noqa: F821
        back_populates="race", uselist=False, cascade="all, delete-orphan"
    )


class MapAsset(Base, TimestampMixin):
    __tablename__ = "map_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    race_id: Mapped[str] = mapped_column(ForeignKey("races.id"))
    original_key: Mapped[str] = mapped_column(String(512))  # storage key of upload
    processed_key: Mapped[Optional[str]] = mapped_column(String(512))  # corrected image
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    scale: Mapped[Optional[int]] = mapped_column(Integer)  # e.g. 10000 for 1:10000
    # CV output: detection confidences, georeference, ocr text, etc.
    cv_result: Mapped[dict] = mapped_column(JSON, default=dict)
    map_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    ocr_confidence: Mapped[float] = mapped_column(Float, default=0.0)

    race: Mapped["Race"] = relationship(back_populates="map_asset")


class GpsTrack(Base, TimestampMixin):
    __tablename__ = "gps_tracks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    race_id: Mapped[str] = mapped_column(ForeignKey("races.id"))
    source: Mapped[str] = mapped_column(String(32), default="upload")  # upload/strava/garmin
    original_key: Mapped[Optional[str]] = mapped_column(String(512))
    format: Mapped[str] = mapped_column(String(16), default="gpx")
    # Decoded points: [{lat, lon, ele, t}] stored as JSON for portability.
    points: Mapped[list] = mapped_column(JSON, default=list)
    point_count: Mapped[int] = mapped_column(Integer, default=0)

    race: Mapped["Race"] = relationship(back_populates="gps_track")


class SplitSet(Base, TimestampMixin):
    __tablename__ = "split_sets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    race_id: Mapped[str] = mapped_column(ForeignKey("races.id"))
    source: Mapped[str] = mapped_column(String(32), default="csv")  # csv/iof_xml/winsplits
    original_key: Mapped[Optional[str]] = mapped_column(String(512))
    # Per-control athlete splits plus optional field bests:
    # {"splits": [{control, code, time_s, cumulative_s}], "field_best": {code: time_s}}
    data: Mapped[dict] = mapped_column(JSON, default=dict)

    race: Mapped["Race"] = relationship(back_populates="split_set")


class Control(Base, TimestampMixin):
    __tablename__ = "controls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    race_id: Mapped[str] = mapped_column(ForeignKey("races.id"))
    code: Mapped[str] = mapped_column(String(16))  # printed control code, e.g. "101"
    order: Mapped[int] = mapped_column(Integer)  # 0 = start, n = finish
    kind: Mapped[str] = mapped_column(String(16), default="control")  # start/control/finish
    # Position in image pixels (from CV) and in geo coords (after alignment).
    pixel_x: Mapped[Optional[float]] = mapped_column(Float)
    pixel_y: Mapped[Optional[float]] = mapped_column(Float)
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lon: Mapped[Optional[float]] = mapped_column(Float)
    description: Mapped[Optional[str]] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    race: Mapped["Race"] = relationship(back_populates="controls")
