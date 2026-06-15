"""Heatmap aggregation for advanced replay (speed / error / route-density).

Bins track points (optionally from many athletes) onto a uniform lat/lon grid
and aggregates a weight per cell, producing GeoJSON-ish points the frontend can
render as a heat layer. Real spatial binning — no placeholder data.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple


def _grid_key(lat: float, lon: float, cell_deg: float) -> Tuple[int, int]:
    return (round(lat / cell_deg), round(lon / cell_deg))


def build_heatmap(
    tracks: List[List[dict]],
    mode: str = "density",
    mistakes: Optional[List[dict]] = None,
    cell_m: float = 12.0,
) -> dict:
    """Aggregate one or more tracks into heat cells.

    mode:
      * ``density``  — visit frequency (route heatmap)
      * ``speed``    — average speed per cell (speed heatmap)
      * ``error``    — time lost near mistakes per cell (error heatmap)
    """
    # Convert metres to degrees latitude (~111.32 km per degree).
    cell_deg = cell_m / 111_320.0
    cells: Dict[Tuple[int, int], dict] = {}

    if mode == "error":
        # Weight cells around each mistake's track location by lost seconds.
        for m in mistakes or []:
            for p in m.get("points", []):
                key = _grid_key(p["lat"], p["lon"], cell_deg)
                cell = cells.setdefault(key, {"lat": 0.0, "lon": 0.0, "n": 0, "w": 0.0})
                cell["lat"] += p["lat"]
                cell["lon"] += p["lon"]
                cell["n"] += 1
                cell["w"] += m.get("lost_s", 0.0)
    else:
        for track in tracks:
            for p in track:
                key = _grid_key(p["lat"], p["lon"], cell_deg)
                cell = cells.setdefault(key, {"lat": 0.0, "lon": 0.0, "n": 0, "w": 0.0})
                cell["lat"] += p["lat"]
                cell["lon"] += p["lon"]
                cell["n"] += 1
                if mode == "speed":
                    cell["w"] += p.get("speed_kmh", 0.0)
                else:  # density
                    cell["w"] += 1.0

    points: List[dict] = []
    max_w = 0.0
    for cell in cells.values():
        n = cell["n"] or 1
        weight = cell["w"] / n if mode == "speed" else cell["w"]
        max_w = max(max_w, weight)
        points.append({
            "lat": round(cell["lat"] / n, 6),
            "lon": round(cell["lon"] / n, 6),
            "weight": round(weight, 3),
            "count": cell["n"],
        })
    # Normalize weights to [0, 1] for rendering intensity.
    if max_w > 0:
        for pt in points:
            pt["intensity"] = round(pt["weight"] / max_w, 3)
    return {"mode": mode, "cell_m": cell_m, "max_weight": round(max_w, 3), "points": points}


def mistake_points_from_analysis(track: List[dict], mistakes: List[dict]) -> List[dict]:
    """Attach the track coordinates spanned by each mistake (by timestamp)."""
    out: List[dict] = []
    for m in mistakes:
        t0, t1 = m.get("t_start"), m.get("t_end")
        pts = [
            {"lat": p["lat"], "lon": p["lon"]}
            for p in track
            if t0 is not None and t1 is not None and t0 <= p["t"] <= t1
        ]
        if pts:
            out.append({"lost_s": m.get("lost_s", 0.0), "type": m.get("type"), "points": pts})
    return out
