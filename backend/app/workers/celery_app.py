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
    # Cap worker processes regardless of how the worker is launched. Without this,
    # Celery defaults to one process PER CPU CORE — on a 48-core host that spawns
    # 48 prefork children, each loading NumPy/OpenCV/SciPy, which OOM-kills the
    # container. The analysis is memory-bound, so a small pool is correct.
    worker_concurrency=settings.CELERY_CONCURRENCY,
    worker_prefetch_multiplier=1,
    # Recycle a child if it grows past this RSS (KB) to bound memory use.
    worker_max_memory_per_child=350_000,
)

# Ensure task modules are imported and registered.
celery_app.autodiscover_tasks(["app.workers"])
from app.workers import tasks  # noqa: E402,F401
