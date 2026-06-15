"""GPS ↔ map alignment engine.

Estimates the 2D similarity transform (rotation, uniform scale, translation)
that maps map-image pixel coordinates to geographic coordinates, by matching
the detected control sequence to anchor points sampled along the GPS track.

The transform is solved in closed form with the Umeyama least-squares method,
which is the standard, robust solution for rigid/similarity point-set
registration. The fit residual yields an honest alignment confidence; when it
is low the orchestrator flags the race for manual correction (per spec 3.5).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

from app.services.geo import EARTH_RADIUS_M
from app.services.gps.analysis import EnrichedPoint


@dataclass
class AlignmentResult:
    confidence: float
    controls_geo: List[dict]  # [{order, code, lat, lon, pixel_x, pixel_y, confidence}]
    rmse_m: Optional[float] = None
    method: str = "umeyama_similarity"


def umeyama_similarity(src: np.ndarray, dst: np.ndarray) -> Tuple[float, np.ndarray, np.ndarray]:
    """Estimate scale c, rotation R (2x2), translation t mapping src->dst.

    Returns (c, R, t) such that dst ≈ c * R @ src + t in a least-squares sense.
    """
    n = src.shape[0]
    mu_src = src.mean(axis=0)
    mu_dst = dst.mean(axis=0)
    src_c = src - mu_src
    dst_c = dst - mu_dst
    cov = (dst_c.T @ src_c) / n
    u, d, vt = np.linalg.svd(cov)
    s = np.eye(2)
    if np.linalg.det(u) * np.linalg.det(vt) < 0:
        s[1, 1] = -1
    r = u @ s @ vt
    var_src = (src_c ** 2).sum() / n
    c = (np.trace(np.diag(d) @ s) / var_src) if var_src > 0 else 1.0
    t = mu_dst - c * r @ mu_src
    return c, r, t


def _geo_to_xy(lat: float, lon: float, ref_lat: float, ref_lon: float) -> Tuple[float, float]:
    x = np.radians(lon - ref_lon) * np.cos(np.radians(ref_lat)) * EARTH_RADIUS_M
    y = np.radians(lat - ref_lat) * EARTH_RADIUS_M
    return x, y


def _xy_to_geo(x: float, y: float, ref_lat: float, ref_lon: float) -> Tuple[float, float]:
    lat = ref_lat + np.degrees(y / EARTH_RADIUS_M)
    lon = ref_lon + np.degrees(x / (EARTH_RADIUS_M * np.cos(np.radians(ref_lat))))
    return lat, lon


def _sample_anchor_points(pts: List[EnrichedPoint], k: int) -> np.ndarray:
    """Pick k anchor points evenly spaced by cumulative distance along the track.

    Control visits are approximately evenly distributed in distance, so equal-
    distance sampling gives a robust first-pass correspondence for the fit.
    """
    total = pts[-1].cum_dist_m
    targets = np.linspace(0, total, k)
    anchors = []
    j = 0
    for tgt in targets:
        while j < len(pts) - 1 and pts[j].cum_dist_m < tgt:
            j += 1
        anchors.append((pts[j].lat, pts[j].lon))
    return np.array(anchors)


def align_controls_to_gps(
    controls_px: List[dict],
    track: List[EnrichedPoint],
    start_px: Optional[Tuple[float, float]] = None,
) -> AlignmentResult:
    """Align detected pixel controls to geo space using the GPS track.

    ``controls_px`` items need ``pixel_x``/``pixel_y`` and may carry ``code``.
    Returns geo-located controls plus an alignment confidence in [0, 1].
    """
    if len(track) < 2 or len(controls_px) < 2:
        return AlignmentResult(confidence=0.0, controls_geo=[], rmse_m=None)

    ref_lat, ref_lon = track[0].lat, track[0].lon

    # Order controls along a nearest-neighbour chain from the start triangle so
    # their sequence approximates the visiting order.
    ordered = _order_controls(controls_px, start_px)

    k = len(ordered)
    anchors_geo = _sample_anchor_points(track, k)
    dst = np.array([_geo_to_xy(la, lo, ref_lat, ref_lon) for la, lo in anchors_geo])
    src = np.array([[c["pixel_x"], c["pixel_y"]] for c in ordered], dtype=float)

    c, r, t = umeyama_similarity(src, dst)
    mapped = (c * (r @ src.T).T) + t
    residuals = np.linalg.norm(mapped - dst, axis=1)
    rmse = float(np.sqrt((residuals ** 2).mean()))

    # Confidence: small RMSE relative to course extent => high confidence.
    extent = float(np.linalg.norm(dst.max(axis=0) - dst.min(axis=0))) or 1.0
    confidence = float(np.clip(1.0 - (rmse / (0.25 * extent)), 0.0, 0.99))

    controls_geo: List[dict] = []
    for i, ctrl in enumerate(ordered):
        x, y = mapped[i]
        lat, lon = _xy_to_geo(x, y, ref_lat, ref_lon)
        kind = "start" if i == 0 else "finish" if i == len(ordered) - 1 else "control"
        controls_geo.append(
            {
                "order": i,
                "code": ctrl.get("code") or ("S" if i == 0 else "F" if i == len(ordered) - 1 else str(i)),
                "kind": kind,
                "pixel_x": ctrl["pixel_x"],
                "pixel_y": ctrl["pixel_y"],
                "lat": round(float(lat), 6),
                "lon": round(float(lon), 6),
                "confidence": round(confidence, 3),
            }
        )

    return AlignmentResult(
        confidence=confidence, controls_geo=controls_geo, rmse_m=round(rmse, 1)
    )


def _order_controls(
    controls_px: List[dict], start_px: Optional[Tuple[float, float]]
) -> List[dict]:
    remaining = list(controls_px)
    ordered: List[dict] = []
    if start_px is not None:
        ordered.append({"pixel_x": start_px[0], "pixel_y": start_px[1], "code": "S", "kind": "start"})
        cur = np.array(start_px)
    else:
        # Start from the top-left-most control as a deterministic seed.
        seed = min(remaining, key=lambda c: c["pixel_x"] + c["pixel_y"])
        remaining.remove(seed)
        ordered.append(seed)
        cur = np.array([seed["pixel_x"], seed["pixel_y"]])
    while remaining:
        nxt = min(
            remaining,
            key=lambda c: (c["pixel_x"] - cur[0]) ** 2 + (c["pixel_y"] - cur[1]) ** 2,
        )
        remaining.remove(nxt)
        ordered.append(nxt)
        cur = np.array([nxt["pixel_x"], nxt["pixel_y"]])
    return ordered
