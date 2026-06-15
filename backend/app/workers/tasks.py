"""Celery tasks. Each task opens its own DB session."""
from __future__ import annotations

import logging

from app.database import SessionLocal
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="routeforge.run_analysis", bind=True, max_retries=2)
def run_analysis_task(self, race_id: str) -> dict:
    from app.services.pipeline import run_analysis

    db = SessionLocal()
    try:
        analysis = run_analysis(race_id, db)
        return {"race_id": race_id, "analysis_id": analysis.id, "status": analysis.status}
    except Exception as exc:  # pragma: no cover
        logger.exception("run_analysis_task failed")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


@celery_app.task(name="routeforge.render_video")
def render_video_task(race_id: str, fmt: str = "tiktok", duration_s: float = 15.0) -> dict:
    from app.models import Race
    from app.services.storage.store import get_storage
    from app.services.video.render import VideoSpec, render_replay_video

    db = SessionLocal()
    try:
        race = db.get(Race, race_id)
        if race is None or race.analysis is None:
            return {"error": "race not analyzed"}
        controls = [
            {"lat": c.lat, "lon": c.lon, "code": c.code}
            for c in race.controls if c.lat is not None
        ]
        spec = VideoSpec(fmt=fmt, duration_s=duration_s, title=race.name)
        mp4 = render_replay_video(race.analysis.track, race.analysis.metrics, spec, controls)
        key = f"videos/{race.id}/{fmt}.mp4"
        get_storage().put(key, mp4, "video/mp4")
        race.analysis.video_key = key
        db.commit()
        return {"race_id": race_id, "video_key": key, "bytes": len(mp4)}
    finally:
        db.close()
