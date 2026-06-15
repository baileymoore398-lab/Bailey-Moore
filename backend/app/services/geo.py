"""Geospatial math utilities — all real implementations, no external service.

Distances use the haversine formula on the WGS84 mean radius. These are used
across the GPS analysis, route-choice, and map-alignment engines.
"""
from __future__ import annotations

import math
from typing import Sequence, Tuple

EARTH_RADIUS_M = 6_371_008.8  # IUGG mean radius


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points in metres."""
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial compass bearing from point 1 to point 2, in degrees [0, 360)."""
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


def angle_diff_deg(a: float, b: float) -> float:
    """Smallest absolute difference between two bearings, in [0, 180]."""
    d = abs((a - b + 180.0) % 360.0 - 180.0)
    return d


def latlon_to_local_xy(
    lat: float, lon: float, ref_lat: float, ref_lon: float
) -> Tuple[float, float]:
    """Equirectangular projection to local metres around a reference point.

    Accurate for the small areas covered by a single race map.
    """
    x = math.radians(lon - ref_lon) * math.cos(math.radians(ref_lat)) * EARTH_RADIUS_M
    y = math.radians(lat - ref_lat) * EARTH_RADIUS_M
    return x, y


def point_to_segment_dist_m(
    plat: float, plon: float,
    alat: float, alon: float,
    blat: float, blon: float,
) -> float:
    """Distance from point P to segment AB, in metres (local projection)."""
    ax, ay = latlon_to_local_xy(alat, alon, plat, plon)
    bx, by = latlon_to_local_xy(blat, blon, plat, plon)
    # P is the projection origin (0,0).
    abx, aby = bx - ax, by - ay
    seg_len2 = abx * abx + aby * aby
    if seg_len2 == 0:
        return math.hypot(ax, ay)
    t = max(0.0, min(1.0, -(ax * abx + ay * aby) / seg_len2))
    cx, cy = ax + t * abx, ay + t * aby
    return math.hypot(cx, cy)


def polyline_length_m(points: Sequence[Tuple[float, float]]) -> float:
    """Total length of a lat/lon polyline in metres."""
    total = 0.0
    for (lat1, lon1), (lat2, lon2) in zip(points, points[1:]):
        total += haversine_m(lat1, lon1, lat2, lon2)
    return total
