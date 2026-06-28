"""Shared test fixtures: a temporary SQLite DB and synthetic race data."""
from __future__ import annotations

import math
import os
import tempfile
from datetime import datetime, timezone

import pytest

# Use an isolated SQLite DB + local storage before importing the app.
_tmpdir = tempfile.mkdtemp(prefix="rf_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"
os.environ["LOCAL_STORAGE_DIR"] = f"{_tmpdir}/storage"
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"
os.environ["ENV"] = "test"
# Force local-disk storage so the suite is hermetic regardless of any ambient
# AWS_* credentials in the environment (CI runners / proxies may inject them).
for _v in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_ENDPOINT"):
    os.environ.pop(_v, None)


@pytest.fixture(scope="session")
def app_client():
    from fastapi.testclient import TestClient

    from app.database import init_db
    from app.main import app

    init_db()
    with TestClient(app) as client:
        yield client


def make_gpx(
    start_lat: float = 60.0,
    start_lon: float = 10.0,
    n: int = 240,
    step_m: float = 4.0,
) -> bytes:
    """Build a realistic GPX: a curving run with a deliberate stop midway."""
    pts = []
    t0 = datetime(2026, 6, 1, 9, 0, 0, tzinfo=timezone.utc).timestamp()
    lat, lon = start_lat, start_lon
    ele = 120.0
    bearing = 45.0
    for i in range(n):
        # Insert a ~30s stop around the middle (no movement).
        stopped = 110 <= i < 140
        if not stopped:
            bearing += math.sin(i / 18.0) * 8.0
            dn = step_m * math.cos(math.radians(bearing))
            de = step_m * math.sin(math.radians(bearing))
            lat += dn / 111_320.0
            lon += de / (111_320.0 * math.cos(math.radians(lat)))
            ele += math.sin(i / 25.0) * 0.6
        t = t0 + i  # 1 Hz
        pts.append((lat, lon, ele, t))

    body = "".join(
        f'<trkpt lat="{la:.6f}" lon="{lo:.6f}">'
        f"<ele>{el:.1f}</ele>"
        f'<time>{datetime.fromtimestamp(tt, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}</time>'
        f"</trkpt>"
        for la, lo, el, tt in pts
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">'
        f"<trk><name>Test</name><trkseg>{body}</trkseg></trk></gpx>"
    ).encode()


def make_splits_csv() -> bytes:
    # name + 4 controls, cumulative mm:ss times for 3 competitors.
    return (
        "Name,101,102,103,F\n"
        "Test Athlete,1:30,3:10,5:40,7:05\n"
        "Rival One,1:25,3:00,5:10,6:40\n"
        "Rival Two,1:40,3:30,6:00,7:30\n"
    ).encode()
