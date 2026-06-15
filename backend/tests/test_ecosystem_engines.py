"""Unit tests for the ecosystem analytics engines."""
from __future__ import annotations

from datetime import date, timedelta

from app.services.coaching.analytics import athlete_trends, coaching_recommendations
from app.services.events.analytics import (
    build_event_analysis,
    build_leaderboard,
    build_leg_rankings,
)
from app.services.events.matching import match_filename_to_competitors, match_many
from app.services.events.results import parse_event_results
from app.services.replay.heatmap import build_heatmap
from app.services.training.analytics import (
    acute_chronic_load,
    race_readiness,
    session_load,
    weekly_volume,
)

IOF_XML = b"""<?xml version="1.0"?>
<ResultList xmlns="http://www.orienteering.org/datastandard/3.0">
  <Event><Name>Spring Cup</Name></Event>
  <ClassResult>
    <Class><Name>Men Elite</Name></Class>
    <PersonResult>
      <Person><Name><Given>Jane</Given><Family>Smith</Family></Name></Person>
      <Result>
        <Time>605</Time><Position>1</Position><Status>OK</Status>
        <SplitTime><ControlCode>101</ControlCode><Time>90</Time></SplitTime>
        <SplitTime><ControlCode>102</ControlCode><Time>190</Time></SplitTime>
        <SplitTime><ControlCode>103</ControlCode><Time>340</Time></SplitTime>
      </Result>
    </PersonResult>
    <PersonResult>
      <Person><Name><Given>Bob</Given><Family>Jones</Family></Name></Person>
      <Result>
        <Time>640</Time><Position>2</Position><Status>OK</Status>
        <SplitTime><ControlCode>101</ControlCode><Time>95</Time></SplitTime>
        <SplitTime><ControlCode>102</ControlCode><Time>205</Time></SplitTime>
        <SplitTime><ControlCode>103</ControlCode><Time>360</Time></SplitTime>
      </Result>
    </PersonResult>
  </ClassResult>
</ResultList>"""


def test_parse_iof_results():
    res = parse_event_results(IOF_XML)
    assert res.event_name == "Spring Cup"
    assert res.courses == ["Men Elite"]
    assert len(res.competitors) == 2
    jane = next(c for c in res.competitors if "Jane" in c.name)
    assert jane.position == 1
    assert jane.total_time_s == 605
    # splits: 101,102,103 + finish leg
    assert [s["code"] for s in jane.splits] == ["101", "102", "103", "F"]
    assert jane.splits[0]["time_s"] == 90


def test_leaderboard_and_leg_rankings():
    res = parse_event_results(IOF_XML)
    comps = res.competitors
    lb = build_leaderboard(comps)
    assert lb[0]["name"].startswith("Jane")
    assert lb[0]["position"] == 1
    assert lb[1]["behind_s"] == 35.0  # 640 - 605
    legs = build_leg_rankings(comps)
    # First leg (S->101): Jane 90s fastest.
    assert legs[0]["best_s"] == 90.0
    assert legs[0]["rankings"][0]["name"].startswith("Jane")
    assert legs[0]["rankings"][1]["behind_s"] == 5.0


def test_event_analysis_aggregate():
    res = parse_event_results(IOF_XML)
    agg = build_event_analysis(res, analyses_by_name={})
    assert agg["stats"]["competitors"] == 2
    assert agg["stats"]["finishers"] == 2
    assert "Men Elite" in agg["leaderboards"]


def test_competitor_matching():
    names = ["Jane Smith", "Bob Jones"]
    m = match_filename_to_competitors("Jane_Smith_MenElite.gpx", names)
    assert m and m.name == "Jane Smith" and m.score >= 0.9
    # Greedy one-to-one
    assignment = match_many(["bob-jones.gpx", "jane_smith.gpx"], names)
    assert assignment["bob-jones.gpx"].name == "Bob Jones"
    assert assignment["jane_smith.gpx"].name == "Jane Smith"


def test_training_load_and_volume():
    load = session_load(duration_s=3600, avg_hr=150, avg_speed_kmh=12)
    assert load > 0
    today = date.today()
    sessions = [
        {"date": today - timedelta(days=d), "distance_m": 8000, "duration_s": 2700,
         "moving_time_s": 2600, "climb_m": 120, "avg_speed_kmh": 11, "avg_hr": 150,
         "load": session_load(2700, 150, 11)}
        for d in range(0, 21, 2)
    ]
    wv = weekly_volume(sessions)
    assert wv and all("distance_km" in w for w in wv)
    acwr = acute_chronic_load(sessions, ref=today)
    assert acwr["zone"] in {"optimal", "caution", "high_risk", "detraining"}
    readiness = race_readiness(sessions, nav_scores=[75, 80])
    assert 0 <= readiness["readiness"] <= 100


def test_coaching_trends_and_recs():
    races = [
        {"name": "R1", "date": "2026-01-01", "scores": {"overall": 80, "navigation": 85,
         "fitness": 70, "execution": 75, "route_choice": 78},
         "legs": [{"number": 1, "efficiency": 0.9, "time_loss_s": 5}], "mistakes": []},
        {"name": "R2", "date": "2026-02-01", "scores": {"overall": 70, "navigation": 65,
         "fitness": 70, "execution": 72, "route_choice": 70},
         "legs": [{"number": 1, "efficiency": 0.75, "time_loss_s": 40}],
         "mistakes": [{"type": "relocation", "lost_s": 30}]},
    ]
    trends = athlete_trends(races)
    assert len(trends["series"]) == 2
    assert trends["summary"]["navigation_slope"] < 0  # declined 85 -> 65
    recs = coaching_recommendations(trends)
    assert recs["recommendations"]
    assert "navigation" in recs["focus_areas"]


def test_heatmap_binning():
    track = [{"lat": 60.0 + i * 1e-4, "lon": 10.0, "speed_kmh": 10 + i} for i in range(20)]
    hm = build_heatmap([track], mode="speed")
    assert hm["mode"] == "speed"
    assert hm["points"]
    assert all(0 <= p["intensity"] <= 1 for p in hm["points"])
