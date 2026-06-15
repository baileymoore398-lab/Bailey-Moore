"""Seed script: creates a demo user + a fully analyzed sample race.

Run with ``python -m app.seed`` (after the DB is migrated/created). Useful for
local development and for populating a demo environment.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from app.core.security import hash_password
from app.database import SessionLocal, init_db
from app.models import Athlete, GpsTrack, Plan, Race, RaceStatus, Subscription, User


def _synthetic_track(n: int = 220) -> list[dict]:
    pts = []
    lat, lon, ele, bearing = 60.0, 10.0, 130.0, 40.0
    t0 = datetime(2026, 6, 1, 9, 0, tzinfo=timezone.utc).timestamp()
    for i in range(n):
        stopped = 100 <= i < 125
        if not stopped:
            bearing += math.sin(i / 15.0) * 9
            lat += (4 * math.cos(math.radians(bearing))) / 111_320.0
            lon += (4 * math.sin(math.radians(bearing))) / (111_320.0 * math.cos(math.radians(lat)))
            ele += math.sin(i / 20.0) * 0.7
        pts.append({"lat": lat, "lon": lon, "ele": ele, "t": t0 + i})
    return pts


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "demo@routeforge.app").first():
            print("Demo data already present.")
            return
        user = User(
            email="demo@routeforge.app",
            hashed_password=hash_password("demodemo1"),
            full_name="Demo Athlete",
            role="athlete",
        )
        db.add(user)
        db.flush()
        db.add(Athlete(user_id=user.id, display_name="Demo Athlete", handle="demo"))
        db.add(Subscription(user_id=user.id, plan=Plan.pro.value))

        race = Race(
            owner_id=user.id, name="Spring Forest Sprint",
            discipline="orienteering", status=RaceStatus.uploaded.value,
        )
        db.add(race)
        db.flush()
        pts = _synthetic_track()
        db.add(GpsTrack(race_id=race.id, points=pts, point_count=len(pts), format="gpx"))
        db.commit()

        from app.services.pipeline import run_analysis

        run_analysis(race.id, db)
        print(f"Seeded demo user (demo@routeforge.app / demodemo1) and analyzed race {race.id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
