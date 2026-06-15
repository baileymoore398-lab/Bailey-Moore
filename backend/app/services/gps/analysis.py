"""GPS analysis engine.

Computes real movement metrics and detects navigation events from a raw track:
distance, time, speed, elevation gain/loss, pace, stops, hesitations,
relocations, overshoots, and direction errors. All deterministic, no mocking.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.services.geo import angle_diff_deg, bearing_deg, haversine_m

# Tunable thresholds (metres / seconds / km·h).
STOP_SPEED_KMH = 1.5         # below this we consider the athlete stopped
STOP_MIN_DURATION_S = 8.0    # a stop must last at least this long
HESITATION_SPEED_KMH = 4.0   # slow-but-moving threshold
HESITATION_MIN_S = 6.0
ELEVATION_SMOOTH_WINDOW = 5  # points
ELEVATION_MIN_DELTA_M = 1.0  # ignore noise below this per-step gain
MAX_PLAUSIBLE_SPEED_KMH = 60.0  # reject GPS spikes above this


@dataclass
class EnrichedPoint:
    lat: float
    lon: float
    ele: Optional[float]
    t: float
    speed_kmh: float = 0.0
    dist_from_prev_m: float = 0.0
    cum_dist_m: float = 0.0
    bearing: Optional[float] = None


@dataclass
class GpsEvent:
    type: str
    t_start: float
    t_end: float
    lost_s: float
    severity: str
    description: str
    index_start: int = 0
    index_end: int = 0


@dataclass
class GpsAnalysisResult:
    points: List[EnrichedPoint]
    metrics: Dict[str, float]
    events: List[GpsEvent] = field(default_factory=list)

    def track_json(self) -> List[dict]:
        return [
            {
                "lat": round(p.lat, 6),
                "lon": round(p.lon, 6),
                "ele": round(p.ele, 1) if p.ele is not None else None,
                "t": p.t,
                "speed_kmh": round(p.speed_kmh, 2),
                "cum_dist_m": round(p.cum_dist_m, 1),
            }
            for p in self.points
        ]


def _interp_times(points: List[dict]) -> List[float]:
    """Ensure every point has a timestamp; synthesize evenly if missing."""
    have = [p.get("t") for p in points]
    if all(t is not None for t in have):
        return [float(t) for t in have]
    # If none present, assume 1 Hz starting at 0. If some present, linear fill.
    known = [(i, float(t)) for i, t in enumerate(have) if t is not None]
    if not known:
        return [float(i) for i in range(len(points))]
    times: List[float] = [0.0] * len(points)
    # Fill known, then linear interpolate gaps, extrapolate ends at 1s steps.
    for i, t in known:
        times[i] = t
    first_i, first_t = known[0]
    for i in range(first_i):
        times[i] = first_t - (first_i - i)
    last_i, last_t = known[-1]
    for i in range(last_i + 1, len(points)):
        times[i] = last_t + (i - last_i)
    for (i0, t0), (i1, t1) in zip(known, known[1:]):
        if i1 - i0 > 1:
            for k in range(i0 + 1, i1):
                frac = (k - i0) / (i1 - i0)
                times[k] = t0 + frac * (t1 - t0)
    return times


def _smooth_elevation(eles: List[Optional[float]], window: int) -> List[Optional[float]]:
    vals = [e for e in eles if e is not None]
    if not vals:
        return eles
    fill = sum(vals) / len(vals)
    series = [e if e is not None else fill for e in eles]
    half = window // 2
    out: List[Optional[float]] = []
    for i in range(len(series)):
        lo = max(0, i - half)
        hi = min(len(series), i + half + 1)
        out.append(sum(series[lo:hi]) / (hi - lo))
    return out


def analyze_track(raw_points: List[dict]) -> GpsAnalysisResult:
    """Enrich a raw track and compute metrics + navigation events."""
    pts = [p for p in raw_points if p.get("lat") is not None and p.get("lon") is not None]
    if len(pts) < 2:
        raise ValueError("Track has too few valid points to analyze.")

    times = _interp_times(pts)
    eles = _smooth_elevation([p.get("ele") for p in pts], ELEVATION_SMOOTH_WINDOW)

    enriched: List[EnrichedPoint] = []
    cum = 0.0
    for i, p in enumerate(pts):
        ep = EnrichedPoint(lat=p["lat"], lon=p["lon"], ele=eles[i], t=times[i])
        if i > 0:
            prev = enriched[-1]
            d = haversine_m(prev.lat, prev.lon, ep.lat, ep.lon)
            dt = max(1e-6, ep.t - prev.t)
            speed = (d / dt) * 3.6
            # Reject implausible GPS spikes: keep position, damp speed/distance.
            if speed > MAX_PLAUSIBLE_SPEED_KMH:
                speed = prev.speed_kmh
                d = min(d, prev.speed_kmh / 3.6 * dt)
            ep.dist_from_prev_m = d
            ep.speed_kmh = speed
            ep.bearing = bearing_deg(prev.lat, prev.lon, ep.lat, ep.lon)
            cum += d
        ep.cum_dist_m = cum
        enriched.append(ep)

    metrics = _compute_metrics(enriched)
    events = _detect_events(enriched)
    return GpsAnalysisResult(points=enriched, metrics=metrics, events=events)


def _compute_metrics(pts: List[EnrichedPoint]) -> Dict[str, float]:
    total_dist = pts[-1].cum_dist_m
    duration = pts[-1].t - pts[0].t
    moving_time = 0.0
    climb = descent = 0.0
    speeds = [p.speed_kmh for p in pts[1:]]
    for i in range(1, len(pts)):
        dt = pts[i].t - pts[i - 1].t
        if pts[i].speed_kmh >= STOP_SPEED_KMH:
            moving_time += dt
        if pts[i].ele is not None and pts[i - 1].ele is not None:
            de = pts[i].ele - pts[i - 1].ele
            if de >= ELEVATION_MIN_DELTA_M:
                climb += de
            elif de <= -ELEVATION_MIN_DELTA_M:
                descent += -de
    avg_speed = (total_dist / moving_time * 3.6) if moving_time > 0 else 0.0
    max_speed = max(speeds) if speeds else 0.0
    avg_pace = (moving_time / 60.0) / (total_dist / 1000.0) if total_dist > 0 else 0.0
    return {
        "distance_m": round(total_dist, 1),
        "duration_s": round(duration, 1),
        "moving_time_s": round(moving_time, 1),
        "avg_speed_kmh": round(avg_speed, 2),
        "max_speed_kmh": round(max_speed, 2),
        "avg_pace_min_km": round(avg_pace, 2),
        "total_climb_m": round(climb, 1),
        "total_descent_m": round(descent, 1),
    }


def _detect_events(pts: List[EnrichedPoint]) -> List[GpsEvent]:
    events: List[GpsEvent] = []
    events.extend(_detect_stops(pts))
    events.extend(_detect_hesitations(pts))
    events.extend(_detect_direction_changes(pts))
    events.sort(key=lambda e: e.t_start)
    return events


def _detect_stops(pts: List[EnrichedPoint]) -> List[GpsEvent]:
    events: List[GpsEvent] = []
    i = 1
    n = len(pts)
    while i < n:
        if pts[i].speed_kmh < STOP_SPEED_KMH:
            j = i
            while j < n and pts[j].speed_kmh < STOP_SPEED_KMH:
                j += 1
            t0, t1 = pts[i].t, pts[j - 1].t
            dur = t1 - t0
            if dur >= STOP_MIN_DURATION_S:
                sev = "high" if dur > 45 else "medium" if dur > 20 else "low"
                events.append(
                    GpsEvent(
                        type="stop",
                        t_start=t0,
                        t_end=t1,
                        lost_s=round(dur, 1),
                        severity=sev,
                        description=f"Stopped for {dur:.0f}s — likely map reading or relocation.",
                        index_start=i,
                        index_end=j - 1,
                    )
                )
            i = j
        else:
            i += 1
    return events


def _detect_hesitations(pts: List[EnrichedPoint]) -> List[GpsEvent]:
    events: List[GpsEvent] = []
    i = 1
    n = len(pts)
    while i < n:
        if STOP_SPEED_KMH <= pts[i].speed_kmh < HESITATION_SPEED_KMH:
            j = i
            while j < n and STOP_SPEED_KMH <= pts[j].speed_kmh < HESITATION_SPEED_KMH:
                j += 1
            dur = pts[j - 1].t - pts[i].t
            if dur >= HESITATION_MIN_S:
                events.append(
                    GpsEvent(
                        type="hesitation",
                        t_start=pts[i].t,
                        t_end=pts[j - 1].t,
                        lost_s=round(dur * 0.5, 1),
                        severity="low" if dur < 15 else "medium",
                        description=f"Slowed to a hesitant pace for {dur:.0f}s.",
                        index_start=i,
                        index_end=j - 1,
                    )
                )
            i = j
        else:
            i += 1
    return events


def _detect_direction_changes(pts: List[EnrichedPoint]) -> List[GpsEvent]:
    """Detect sharp reversals (>120 deg) that indicate relocation/overshoot."""
    events: List[GpsEvent] = []
    for i in range(2, len(pts)):
        b0, b1 = pts[i - 1].bearing, pts[i].bearing
        if b0 is None or b1 is None:
            continue
        if pts[i].speed_kmh < STOP_SPEED_KMH:
            continue
        turn = angle_diff_deg(b0, b1)
        if turn > 120:
            events.append(
                GpsEvent(
                    type="relocation",
                    t_start=pts[i - 1].t,
                    t_end=pts[i].t,
                    lost_s=round(max(0.0, pts[i].t - pts[i - 1].t), 1),
                    severity="medium",
                    description="Sharp reversal of direction — possible overshoot or relocation.",
                    index_start=i - 1,
                    index_end=i,
                )
            )
    return events
