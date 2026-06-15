"""Race replay video renderer.

Renders an animated MP4 of the GPS route for social sharing in TikTok/Reel
(9:16), and YouTube (16:9) formats. Frames are drawn with Pillow (a growing
route polyline, a moving athlete dot, control markers, an intro card with the
athlete name, and a finish summary with key stats), then encoded to H.264 with
FFmpeg via stdin piping.

This is a real renderer: given a track it produces a real, playable file. It
requires the ``ffmpeg`` binary on the host (installed in the backend Docker
image). If FFmpeg is missing, :func:`render_replay_video` raises a clear error.
"""
from __future__ import annotations

import io
import logging
import shutil
import subprocess
from dataclasses import dataclass
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

FORMATS = {
    "tiktok": (1080, 1920),
    "reel": (1080, 1920),
    "youtube": (1920, 1080),
}


@dataclass
class VideoSpec:
    fmt: str = "tiktok"
    fps: int = 30
    duration_s: float = 15.0
    athlete_name: str = "Athlete"
    title: str = "RouteForge Replay"


def _project(track: List[dict], w: int, h: int, pad: float = 0.12):
    lats = [p["lat"] for p in track]
    lons = [p["lon"] for p in track]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    import math

    mid_lat = (min_lat + max_lat) / 2
    # Use simple equirectangular scaling; aspect-correct longitude.
    lon_scale = math.cos(math.radians(mid_lat))
    span_x = max(1e-9, (max_lon - min_lon) * lon_scale)
    span_y = max(1e-9, (max_lat - min_lat))
    data_aspect = span_x / span_y
    pad_w, pad_h = w * pad, h * pad
    draw_w, draw_h = w - 2 * pad_w, h - 2 * pad_h
    if data_aspect > draw_w / draw_h:
        scale = draw_w / span_x
    else:
        scale = draw_h / span_y

    def to_px(lat: float, lon: float) -> Tuple[float, float]:
        x = pad_w + ((lon - min_lon) * lon_scale) * scale
        y = h - (pad_h + (lat - min_lat) * scale)  # invert y for image coords
        # centre
        x += (draw_w - span_x * scale) / 2
        y -= (draw_h - span_y * scale) / 2
        return x, y

    return to_px


def render_replay_video(
    track: List[dict],
    metrics: dict,
    spec: Optional[VideoSpec] = None,
    controls: Optional[List[dict]] = None,
) -> bytes:
    """Render the replay and return raw MP4 bytes."""
    from PIL import Image, ImageDraw

    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg binary not found on host; cannot render video.")
    if len(track) < 2:
        raise ValueError("Track too short to render a video.")

    spec = spec or VideoSpec()
    w, h = FORMATS.get(spec.fmt, FORMATS["tiktok"])
    to_px = _project(track, w, h)
    pts_px = [to_px(p["lat"], p["lon"]) for p in track]

    total_frames = int(spec.fps * spec.duration_s)
    intro_frames = int(spec.fps * 1.5)
    outro_frames = int(spec.fps * 2.0)
    anim_frames = max(1, total_frames - intro_frames - outro_frames)

    bg = (15, 23, 42)
    track_col = (56, 189, 248)
    dot_col = (250, 204, 21)
    ctrl_col = (244, 114, 182)

    proc = subprocess.Popen(
        [
            "ffmpeg", "-y", "-f", "image2pipe", "-vcodec", "mjpeg",
            "-r", str(spec.fps), "-i", "-",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
            "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    assert proc.stdin and proc.stdout

    def emit(img: "Image.Image") -> None:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        proc.stdin.write(buf.getvalue())

    def base_frame() -> Tuple["Image.Image", "ImageDraw.ImageDraw"]:
        img = Image.new("RGB", (w, h), bg)
        return img, ImageDraw.Draw(img)

    def draw_controls(d: "ImageDraw.ImageDraw") -> None:
        if not controls:
            return
        for c in controls:
            if c.get("lat") is None:
                continue
            cx, cy = to_px(c["lat"], c["lon"])
            r = 14
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ctrl_col, width=4)

    # Intro card.
    for _ in range(intro_frames):
        img, d = base_frame()
        d.text((w // 2 - 120, h // 2 - 40), spec.title, fill=(255, 255, 255))
        d.text((w // 2 - 80, h // 2 + 10), spec.athlete_name, fill=track_col)
        emit(img)

    # Animated route growth + moving dot.
    for f in range(anim_frames):
        img, d = base_frame()
        draw_controls(d)
        upto = max(2, int(len(pts_px) * (f + 1) / anim_frames))
        d.line(pts_px[:upto], fill=track_col, width=6, joint="curve")
        cx, cy = pts_px[upto - 1]
        d.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=dot_col)
        emit(img)

    # Outro summary.
    dist_km = metrics.get("distance_m", 0) / 1000.0
    dur = metrics.get("duration_s", 0)
    climb = metrics.get("total_climb_m", 0)
    for _ in range(outro_frames):
        img, d = base_frame()
        draw_controls(d)
        d.line(pts_px, fill=track_col, width=6, joint="curve")
        y = int(h * 0.78)
        d.text((int(w * 0.1), y), f"Distance  {dist_km:.2f} km", fill=(255, 255, 255))
        d.text((int(w * 0.1), y + 40), f"Time      {int(dur//60)}:{int(dur%60):02d}", fill=(255, 255, 255))
        d.text((int(w * 0.1), y + 80), f"Climb     {climb:.0f} m", fill=(255, 255, 255))
        emit(img)

    proc.stdin.close()
    out = proc.stdout.read()
    proc.wait()
    return out
