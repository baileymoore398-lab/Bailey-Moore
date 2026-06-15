"""Route-choice analysis engine.

Segments an enriched GPS track by the control sequence and, for each leg,
measures the actual route against the straight-line ("optimal baseline") route:
distance difference, route efficiency, climb, and a quality verdict. When
controls have no geo positions (e.g. low map-alignment confidence) the engine
degrades gracefully and reports only the GPS-derived leg metrics.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from app.services.geo import haversine_m
from app.services.gps.analysis import EnrichedPoint


@dataclass
class LegRoute:
    leg_number: int
    from_control: str
    to_control: str
    actual_distance_m: float
    optimal_distance_m: Optional[float]
    extra_distance_m: Optional[float]
    efficiency: Optional[float]  # optimal / actual, 1.0 == perfect straight line
    climb_m: float
    index_start: int
    index_end: int
    verdict: str

    def to_json(self) -> dict:
        return {
            "leg_number": self.leg_number,
            "from_control": self.from_control,
            "to_control": self.to_control,
            "actual_distance_m": round(self.actual_distance_m, 1),
            "optimal_distance_m": round(self.optimal_distance_m, 1)
            if self.optimal_distance_m is not None
            else None,
            "extra_distance_m": round(self.extra_distance_m, 1)
            if self.extra_distance_m is not None
            else None,
            "efficiency": round(self.efficiency, 3) if self.efficiency is not None else None,
            "climb_m": round(self.climb_m, 1),
            "verdict": self.verdict,
        }


def _nearest_point_index(
    pts: List[EnrichedPoint], lat: float, lon: float, start: int = 0
) -> int:
    best_i = start
    best_d = float("inf")
    for i in range(start, len(pts)):
        d = haversine_m(pts[i].lat, pts[i].lon, lat, lon)
        if d < best_d:
            best_d = d
            best_i = i
    return best_i


def _verdict(efficiency: Optional[float]) -> str:
    if efficiency is None:
        return "No control positions — route quality not assessed."
    if efficiency >= 0.92:
        return "Excellent — near-direct execution with minimal extra distance."
    if efficiency >= 0.82:
        return "Good — small detours, generally efficient route choice."
    if efficiency >= 0.7:
        return "Fair — noticeable extra distance; a tighter line was available."
    return "Costly — significant extra distance suggests a route-choice or execution error."


def segment_by_controls(
    pts: List[EnrichedPoint], controls: List[dict]
) -> List[LegRoute]:
    """Split the track at the nearest GPS point to each control in order."""
    geo_controls = [c for c in controls if c.get("lat") is not None and c.get("lon") is not None]
    legs: List[LegRoute] = []

    if len(geo_controls) >= 2:
        # Find anchor indices for each control along the track (monotonic).
        anchors: List[int] = []
        cursor = 0
        for c in geo_controls:
            idx = _nearest_point_index(pts, c["lat"], c["lon"], cursor)
            anchors.append(idx)
            cursor = idx
        for n in range(1, len(geo_controls)):
            i0, i1 = anchors[n - 1], anchors[n]
            if i1 <= i0:
                i1 = min(len(pts) - 1, i0 + 1)
            actual = pts[i1].cum_dist_m - pts[i0].cum_dist_m
            optimal = haversine_m(
                geo_controls[n - 1]["lat"], geo_controls[n - 1]["lon"],
                geo_controls[n]["lat"], geo_controls[n]["lon"],
            )
            climb = 0.0
            for k in range(i0 + 1, i1 + 1):
                if pts[k].ele is not None and pts[k - 1].ele is not None:
                    de = pts[k].ele - pts[k - 1].ele
                    if de > 0:
                        climb += de
            efficiency = (optimal / actual) if actual > 0 else None
            extra = (actual - optimal) if optimal is not None else None
            legs.append(
                LegRoute(
                    leg_number=n,
                    from_control=str(geo_controls[n - 1].get("code", n - 1)),
                    to_control=str(geo_controls[n].get("code", n)),
                    actual_distance_m=actual,
                    optimal_distance_m=optimal,
                    extra_distance_m=extra,
                    efficiency=efficiency,
                    climb_m=climb,
                    index_start=i0,
                    index_end=i1,
                    verdict=_verdict(efficiency),
                )
            )
        return legs

    # No geo controls: return a single whole-track segment with GPS metrics only.
    if pts:
        legs.append(
            LegRoute(
                leg_number=1,
                from_control="S",
                to_control="F",
                actual_distance_m=pts[-1].cum_dist_m,
                optimal_distance_m=None,
                extra_distance_m=None,
                efficiency=None,
                climb_m=0.0,
                index_start=0,
                index_end=len(pts) - 1,
                verdict=_verdict(None),
            )
        )
    return legs
