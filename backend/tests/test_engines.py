"""Unit tests for the analysis engines — real numeric assertions."""
from __future__ import annotations

import math

import numpy as np

from app.services.geo import bearing_deg, haversine_m
from app.services.gps.analysis import analyze_track
from app.services.gps.parser import parse_track
from app.services.mapcv.alignment import umeyama_similarity
from app.services.report.scoring import compute_scores
from app.services.routechoice.analysis import segment_by_controls
from app.services.splits.analysis import analyze_splits
from app.services.splits.parser import parse_splits
from tests.conftest import make_gpx, make_splits_csv


def test_haversine_known_distance():
    # 1 degree of latitude ~= 111.2 km.
    d = haversine_m(0.0, 0.0, 1.0, 0.0)
    assert 110_500 < d < 111_700


def test_bearing_cardinal():
    assert abs(bearing_deg(0, 0, 1, 0) - 0.0) < 1e-6  # due north
    assert abs(bearing_deg(0, 0, 0, 1) - 90.0) < 1e-6  # due east


def test_gps_parse_and_metrics():
    pts = parse_track("track.gpx", make_gpx())
    assert len(pts) == 240
    result = analyze_track(pts)
    m = result.metrics
    assert m["distance_m"] > 500  # ~210 moving points * 4m
    assert m["duration_s"] == 239.0
    assert m["moving_time_s"] < m["duration_s"]  # stop excluded
    assert m["avg_speed_kmh"] > 0


def test_gps_detects_stop():
    pts = parse_track("track.gpx", make_gpx())
    result = analyze_track(pts)
    stops = [e for e in result.events if e.type == "stop"]
    assert stops, "expected to detect the deliberate mid-run stop"
    assert max(s.lost_s for s in stops) > 20


def test_splits_analysis_ranks_and_loss():
    parsed = parse_splits("splits.csv", make_splits_csv())
    assert parsed["competitors"]
    res = analyze_splits(parsed, athlete_name="Test Athlete")
    assert len(res.legs) == 4
    # On leg 1 Rival One (1:25) is fastest; Test Athlete (1:30) loses 5s.
    leg1 = res.legs[0]
    assert leg1.best_time_s == 85.0
    assert abs(leg1.time_loss_s - 5.0) < 0.01
    assert leg1.rank == 2
    assert res.total_loss_s > 0


def test_route_choice_efficiency():
    pts = parse_track("track.gpx", make_gpx())
    result = analyze_track(pts)
    # Two geolocated controls => one leg with efficiency in (0, 1].
    controls = [
        {"code": "S", "lat": pts[0]["lat"], "lon": pts[0]["lon"]},
        {"code": "F", "lat": pts[-1]["lat"], "lon": pts[-1]["lon"]},
    ]
    legs = segment_by_controls(result.points, controls)
    assert len(legs) == 1
    leg = legs[0]
    assert leg.optimal_distance_m is not None
    assert 0 < leg.efficiency <= 1.0
    assert leg.actual_distance_m >= leg.optimal_distance_m - 1


def test_scoring_bounds():
    scores = compute_scores(
        metrics={"duration_s": 1800, "moving_time_s": 1700, "avg_pace_min_km": 6.0,
                 "distance_m": 5000, "total_climb_m": 100},
        events=[{"type": "stop", "lost_s": 40}],
        legs=[{"time_loss_s": 20}],
        route_legs=[{"efficiency": 0.9}],
        discipline="orienteering",
    )
    for key in ("navigation", "fitness", "execution", "route_choice", "overall"):
        assert 0 <= scores[key] <= 100


def test_umeyama_recovers_transform():
    # Build a known similarity transform and check we recover the mapping.
    src = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=float)
    theta = math.radians(30)
    r = np.array([[math.cos(theta), -math.sin(theta)],
                  [math.sin(theta), math.cos(theta)]])
    dst = (2.0 * (r @ src.T).T) + np.array([5.0, -3.0])
    c, rr, t = umeyama_similarity(src, dst)
    assert abs(c - 2.0) < 1e-6
    recovered = (c * (rr @ src.T).T) + t
    assert np.allclose(recovered, dst, atol=1e-6)


def test_controls_from_splits_placement():
    """Controls are pinned to the GPS position at each split's punch time."""
    import datetime

    from app.services.gps.analysis import analyze_track
    from app.services.pipeline import _controls_from_splits

    t0 = datetime.datetime(2026, 6, 1, 9, 0, tzinfo=datetime.timezone.utc).timestamp()
    pts = []
    lon = 10.0
    for i in range(201):
        lon += 0.0001
        pts.append({"lat": 60.0, "lon": lon, "ele": 100.0, "t": t0 + i})
    g = analyze_track(pts)
    split_data = {"competitors": [{"name": "Me", "splits": [
        {"code": "101", "cumulative_s": 50, "time_s": 50},
        {"code": "102", "cumulative_s": 120, "time_s": 70},
        {"code": "F", "cumulative_s": 200, "time_s": 80},
    ]}]}
    controls = _controls_from_splits(split_data, "Me", g.points)
    assert [c["code"] for c in controls] == ["S", "101", "102", "F"]
    assert controls[1]["kind"] == "control" and controls[3]["kind"] == "finish"
    # Control 101 punched at 50s -> GPS lon at t0+50 (lon advanced 51 steps).
    assert abs(controls[1]["lon"] - (10.0 + 0.0001 * 51)) < 1e-4
