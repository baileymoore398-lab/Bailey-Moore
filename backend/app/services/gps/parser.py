"""GPS track parsers for GPX, TCX, and FIT-as-TCX/CSV inputs.

Returns a normalized list of points: ``[{"lat","lon","ele","t"}]`` where ``t``
is epoch seconds (float). GPX/TCX are parsed from XML; a generic CSV parser is
included for exported data. FIT parsing is supported when the optional
``fitparse`` package is installed, otherwise a clear error is raised.
"""
from __future__ import annotations

import csv
import io
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import List, Optional, TypedDict


class TrackPoint(TypedDict):
    lat: float
    lon: float
    ele: Optional[float]
    t: Optional[float]


def _parse_iso(ts: str) -> Optional[float]:
    if not ts:
        return None
    ts = ts.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(ts)
    except ValueError:
        # Try common GPX/TCX formats.
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z"):
            try:
                dt = datetime.strptime(ts, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _localname(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def parse_gpx(data: bytes) -> List[TrackPoint]:
    points: List[TrackPoint] = []
    root = ET.fromstring(data)
    for el in root.iter():
        if _localname(el.tag) != "trkpt":
            continue
        try:
            lat = float(el.attrib["lat"])
            lon = float(el.attrib["lon"])
        except (KeyError, ValueError):
            continue
        ele: Optional[float] = None
        t: Optional[float] = None
        hr: Optional[int] = None
        for child in el.iter():
            name = _localname(child.tag)
            if name == "ele" and child.text:
                try:
                    ele = float(child.text)
                except ValueError:
                    pass
            elif name == "time" and child.text:
                t = _parse_iso(child.text)
            elif name in ("hr", "heartrate") and child.text:
                try:
                    hr = int(float(child.text))
                except ValueError:
                    pass
        point: TrackPoint = {"lat": lat, "lon": lon, "ele": ele, "t": t}
        if hr is not None:
            point["hr"] = hr
        points.append(point)
    return points


def parse_tcx(data: bytes) -> List[TrackPoint]:
    points: List[TrackPoint] = []
    root = ET.fromstring(data)
    for tp in root.iter():
        if _localname(tp.tag) != "trackpoint":
            continue
        lat = lon = ele = t = None
        for el in tp.iter():
            name = _localname(el.tag)
            if name == "latitudedegrees" and el.text:
                lat = float(el.text)
            elif name == "longitudedegrees" and el.text:
                lon = float(el.text)
            elif name == "altitudemeters" and el.text:
                ele = float(el.text)
            elif name == "time" and el.text:
                t = _parse_iso(el.text)
        if lat is not None and lon is not None:
            points.append({"lat": lat, "lon": lon, "ele": ele, "t": t})
    return points


def parse_csv(data: bytes) -> List[TrackPoint]:
    """Parse a CSV with lat/lon[/ele/time] columns (case-insensitive)."""
    text = data.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    points: List[TrackPoint] = []
    if not reader.fieldnames:
        return points
    cols = {c.lower().strip(): c for c in reader.fieldnames}

    def col(*names):
        for n in names:
            if n in cols:
                return cols[n]
        return None

    lat_c = col("lat", "latitude")
    lon_c = col("lon", "lng", "longitude")
    ele_c = col("ele", "elevation", "altitude", "alt")
    t_c = col("time", "timestamp", "t")
    if not lat_c or not lon_c:
        return points
    for row in reader:
        try:
            lat = float(row[lat_c])
            lon = float(row[lon_c])
        except (TypeError, ValueError):
            continue
        ele = None
        if ele_c and row.get(ele_c):
            try:
                ele = float(row[ele_c])
            except ValueError:
                pass
        t = None
        if t_c and row.get(t_c):
            raw = row[t_c]
            t = _parse_iso(raw)
            if t is None:
                try:
                    t = float(raw)
                except ValueError:
                    t = None
        points.append({"lat": lat, "lon": lon, "ele": ele, "t": t})
    return points


def parse_fit(data: bytes) -> List[TrackPoint]:
    try:
        from fitparse import FitFile  # type: ignore
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise ValueError(
            "FIT parsing requires the 'fitparse' package. Install it or upload "
            "GPX/TCX instead."
        ) from exc
    fit = FitFile(io.BytesIO(data))
    points: List[TrackPoint] = []
    for record in fit.get_messages("record"):
        vals = {d.name: d.value for d in record}
        lat = vals.get("position_lat")
        lon = vals.get("position_long")
        if lat is None or lon is None:
            continue
        # FIT stores position in semicircles.
        lat = lat * (180.0 / 2**31)
        lon = lon * (180.0 / 2**31)
        ele = vals.get("enhanced_altitude") or vals.get("altitude")
        ts = vals.get("timestamp")
        t = ts.replace(tzinfo=timezone.utc).timestamp() if isinstance(ts, datetime) else None
        points.append({"lat": lat, "lon": lon, "ele": ele, "t": t})
    return points


def parse_kml(data: bytes) -> List[TrackPoint]:
    """Parse a KML track: <gx:Track> (timestamped) or a LineString path."""
    root = ET.fromstring(data)
    points: List[TrackPoint] = []

    # gx:Track — paired <when> timestamps and <gx:coord>lon lat ele</gx:coord>.
    for el in root.iter():
        if _localname(el.tag) != "track":
            continue
        whens: List[Optional[float]] = []
        coords: List[tuple] = []
        for child in el:
            cn = _localname(child.tag)
            if cn == "when":
                whens.append(_parse_iso(child.text or ""))
            elif cn == "coord":
                parts = (child.text or "").split()
                if len(parts) >= 2:
                    coords.append(tuple(parts))
        for i, c in enumerate(coords):
            lon, lat = float(c[0]), float(c[1])
            ele = float(c[2]) if len(c) > 2 else None
            t = whens[i] if i < len(whens) else None
            points.append({"lat": lat, "lon": lon, "ele": ele, "t": t})
        if points:
            return points

    # Plain LineString <coordinates>lon,lat,ele lon,lat,ele ...</coordinates>.
    for el in root.iter():
        if _localname(el.tag) != "coordinates" or not el.text:
            continue
        for tok in el.text.replace("\n", " ").split():
            bits = tok.split(",")
            if len(bits) >= 2:
                points.append({
                    "lat": float(bits[1]), "lon": float(bits[0]),
                    "ele": float(bits[2]) if len(bits) > 2 else None, "t": None,
                })
        if points:
            break
    return points


def parse_geojson(data: bytes) -> List[TrackPoint]:
    """Parse GeoJSON: a LineString/MultiLineString path, or a list of points."""
    import json

    obj = json.loads(data.decode("utf-8-sig", errors="replace"))
    points: List[TrackPoint] = []

    def add(coord, props=None):
        if not isinstance(coord, (list, tuple)) or len(coord) < 2:
            return
        lon, lat = float(coord[0]), float(coord[1])
        ele = float(coord[2]) if len(coord) > 2 else None
        t = None
        if props:
            for key in ("time", "timestamp", "t"):
                if key in props:
                    t = _parse_iso(str(props[key])) or None
                    break
        points.append({"lat": lat, "lon": lon, "ele": ele, "t": t})

    def walk(geom, props=None):
        if not isinstance(geom, dict):
            return
        gt = geom.get("type")
        coords = geom.get("coordinates")
        if gt == "LineString" and coords:
            for c in coords:
                add(c, props)
        elif gt in ("MultiLineString", "Polygon") and coords:
            for line in coords:
                for c in line:
                    add(c, props)
        elif gt == "Point" and coords:
            add(coords, props)

    if obj.get("type") == "FeatureCollection":
        for feat in obj.get("features", []):
            walk(feat.get("geometry", {}), feat.get("properties"))
    elif obj.get("type") == "Feature":
        walk(obj.get("geometry", {}), obj.get("properties"))
    elif obj.get("type"):
        walk(obj)
    return points


def parse_track(filename: str, data: bytes) -> List[TrackPoint]:
    """Dispatch to the right parser based on file extension / content sniffing."""
    name = (filename or "").lower()
    if name.endswith(".gpx"):
        return parse_gpx(data)
    if name.endswith(".tcx"):
        return parse_tcx(data)
    if name.endswith(".fit"):
        return parse_fit(data)
    if name.endswith(".kml"):
        return parse_kml(data)
    if name.endswith(".geojson") or name.endswith(".json"):
        return parse_geojson(data)
    if name.endswith(".csv"):
        return parse_csv(data)
    # Content sniffing fallback.
    head = data[:512].lstrip()
    if head.startswith(b"{") or head.startswith(b"["):
        try:
            return parse_geojson(data)
        except Exception:  # noqa: BLE001 — fall through to other sniffers
            pass
    if head.startswith(b"<?xml") or head.startswith(b"<"):
        low = head.lower()
        if b"<gpx" in low:
            return parse_gpx(data)
        if b"trainingcenterdatabase" in low or b"<activities" in low:
            return parse_tcx(data)
        if b"<kml" in low or b"<gx:track" in low:
            return parse_kml(data)
    return parse_csv(data)
