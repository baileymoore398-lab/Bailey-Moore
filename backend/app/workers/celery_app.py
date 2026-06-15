"""Celery application for async processing (analysis + video render).

In development ``CELERY_TASK_ALWAYS_EAGER`` makes tasks run inline so no broker
is required; in production the worker connects to Redis.
"""
from __future__ import annotations

from celery import Celery

from app.config import settings

celery_app = Celery(
    "routeforge",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
)
celery_app.conf.update(
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_max_tasks_per_child=50,
)

# Ensure task modules are imported and registered.
celery_app.autodiscover_tasks(["app.workers"])
from app.workers import tasks  # noqa: E402,F401
