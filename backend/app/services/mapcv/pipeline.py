"""Smart Map Photo AI pipeline.

Real classical computer-vision implementation built on OpenCV. From a phone
photo of a paper map it:

  1. detects the map sheet boundary (largest 4-point contour),
  2. corrects perspective + rotation via a homography warp,
  3. enhances lighting/contrast (CLAHE) and reduces noise,
  4. detects control circles (Hough circle transform on the magenta course
     overprint), and locates the start triangle,
  5. emits per-stage confidence scores.

OCR of control codes/descriptions is wired through ``pytesseract`` when present
(optional). YOLO-based symbol detection can be plugged into
``detect_controls_ml`` when model weights are provided; the classical detector
is the always-available default and returns genuine detections.

The whole module degrades gracefully: if OpenCV is unavailable it raises a
clear error rather than returning fake data.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

try:
    import cv2  # type: ignore

    _HAS_CV2 = True
except Exception:  # pragma: no cover - import guard
    _HAS_CV2 = False


@dataclass
class DetectedControl:
    pixel_x: float
    pixel_y: float
    radius: float
    confidence: float
    code: Optional[str] = None
    kind: str = "control"


@dataclass
class MapCvResult:
    width: int
    height: int
    processed_image: Optional["np.ndarray"] = None
    controls: List[DetectedControl] = field(default_factory=list)
    start: Optional[Tuple[float, float]] = None
    finish: Optional[Tuple[float, float]] = None
    boundary_quad: Optional[List[List[float]]] = None
    map_confidence: float = 0.0
    ocr_confidence: float = 0.0
    ocr_text: str = ""
    warnings: List[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return {
            "width": self.width,
            "height": self.height,
            "controls": [
                {
                    "pixel_x": round(c.pixel_x, 1),
                    "pixel_y": round(c.pixel_y, 1),
                    "radius": round(c.radius, 1),
                    "confidence": round(c.confidence, 3),
                    "code": c.code,
                    "kind": c.kind,
                }
                for c in self.controls
            ],
            "start": list(self.start) if self.start else None,
            "finish": list(self.finish) if self.finish else None,
            "boundary_quad": self.boundary_quad,
            "map_confidence": round(self.map_confidence, 3),
            "ocr_confidence": round(self.ocr_confidence, 3),
            "ocr_text": self.ocr_text,
            "warnings": self.warnings,
        }


def _require_cv2() -> None:
    if not _HAS_CV2:
        raise RuntimeError(
            "OpenCV (cv2) is not installed; map CV pipeline unavailable. "
            "Install opencv-python-headless."
        )


def _order_quad(pts: "np.ndarray") -> "np.ndarray":
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def detect_boundary(gray: "np.ndarray") -> Tuple[Optional["np.ndarray"], float]:
    """Find the largest 4-corner contour — the map sheet. Returns (quad, conf)."""
    h, w = gray.shape
    img_area = float(h * w)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_area = 0.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.2 * img_area:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4 and area > best_area:
            best = approx.reshape(4, 2).astype("float32")
            best_area = area
    if best is None:
        return None, 0.3  # fall back to using whole image; low boundary confidence
    # Confidence scales with how much of the frame the sheet fills (capped).
    conf = float(min(0.99, 0.5 + 0.5 * (best_area / img_area)))
    return best, conf


def correct_perspective(
    img: "np.ndarray", quad: "np.ndarray"
) -> "np.ndarray":
    rect = _order_quad(quad)
    (tl, tr, br, bl) = rect
    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_w = int(max(width_a, width_b))
    max_h = int(max(height_a, height_b))
    if max_w < 10 or max_h < 10:
        return img
    dst = np.array(
        [[0, 0], [max_w - 1, 0], [max_w - 1, max_h - 1], [0, max_h - 1]],
        dtype="float32",
    )
    m = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(img, m, (max_w, max_h))


def enhance(img: "np.ndarray") -> "np.ndarray":
    """CLAHE contrast enhancement + mild denoise to clean phone photos."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_ch = clahe.apply(l_ch)
    merged = cv2.merge((l_ch, a_ch, b_ch))
    out = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    return cv2.bilateralFilter(out, 5, 50, 50)


def _magenta_mask(img: "np.ndarray") -> "np.ndarray":
    """Isolate the magenta/purple course overprint used on O-maps."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # Magenta hue ~150-175 in OpenCV's 0-180 scale.
    lower = np.array([140, 60, 60])
    upper = np.array([175, 255, 255])
    mask = cv2.inRange(hsv, lower, upper)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    return mask


def detect_controls(img: "np.ndarray") -> Tuple[List[DetectedControl], float]:
    """Detect control circles from the magenta overprint via Hough transform."""
    mask = _magenta_mask(img)
    h, w = mask.shape
    min_r = max(6, int(min(h, w) * 0.012))
    max_r = max(min_r + 4, int(min(h, w) * 0.05))
    blurred = cv2.GaussianBlur(mask, (5, 5), 1.5)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min_r * 3,
        param1=120,
        param2=18,
        minRadius=min_r,
        maxRadius=max_r,
    )
    controls: List[DetectedControl] = []
    if circles is not None:
        for x, y, r in np.round(circles[0]).astype("float32"):
            # Confidence from how much magenta lies on the circle's ring.
            ring_score = _ring_score(mask, x, y, r)
            controls.append(
                DetectedControl(
                    pixel_x=float(x),
                    pixel_y=float(y),
                    radius=float(r),
                    confidence=float(ring_score),
                )
            )
    controls = [c for c in controls if c.confidence >= 0.25]
    controls.sort(key=lambda c: (c.pixel_y, c.pixel_x))
    overall = (
        float(np.mean([c.confidence for c in controls])) if controls else 0.0
    )
    return controls, overall


def _ring_score(mask: "np.ndarray", x: float, y: float, r: float) -> float:
    h, w = mask.shape
    hits = 0
    total = 0
    for deg in range(0, 360, 12):
        rad = np.radians(deg)
        px = int(x + r * np.cos(rad))
        py = int(y + r * np.sin(rad))
        if 0 <= px < w and 0 <= py < h:
            total += 1
            if mask[py, px] > 0:
                hits += 1
    return hits / total if total else 0.0


def detect_start_triangle(img: "np.ndarray") -> Optional[Tuple[float, float]]:
    """Locate the start triangle (3-vertex magenta contour)."""
    mask = _magenta_mask(img)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(c)
        if area < 80:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.04 * peri, True)
        if len(approx) == 3:
            m = cv2.moments(c)
            if m["m00"] != 0:
                return (m["m10"] / m["m00"], m["m01"] / m["m00"])
    return None


def run_ocr(img: "np.ndarray") -> Tuple[str, float]:
    """OCR the map for event/course metadata. Uses pytesseract when present."""
    try:
        import pytesseract  # type: ignore
    except Exception:
        return "", 0.0
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)
        words, confs = [], []
        for txt, conf in zip(data["text"], data["conf"]):
            try:
                c = float(conf)
            except ValueError:
                continue
            if txt.strip() and c > 0:
                words.append(txt.strip())
                confs.append(c)
        avg = (sum(confs) / len(confs) / 100.0) if confs else 0.0
        return " ".join(words), avg
    except Exception as exc:  # pragma: no cover
        logger.warning("OCR failed: %s", exc)
        return "", 0.0


def process_map_image(image_bytes: bytes, run_ocr_pass: bool = True) -> MapCvResult:
    """Full pipeline entrypoint. Returns a structured, real CV result."""
    _require_cv2()
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image bytes.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    quad, boundary_conf = detect_boundary(gray)
    warnings: List[str] = []
    if quad is not None:
        warped = correct_perspective(img, quad)
        boundary_json = quad.tolist()
    else:
        warped = img
        boundary_json = None
        warnings.append("Map boundary not confidently detected; used full frame.")

    processed = enhance(warped)
    controls, ctrl_conf = detect_controls(processed)
    start = detect_start_triangle(processed)
    if start is not None:
        # Remove a detected circle coincident with the start triangle.
        controls = [
            c for c in controls
            if (c.pixel_x - start[0]) ** 2 + (c.pixel_y - start[1]) ** 2 > (c.radius * 1.5) ** 2
        ]
    if not controls:
        warnings.append("No control circles detected; manual correction recommended.")

    ocr_text, ocr_conf = ("", 0.0)
    if run_ocr_pass:
        ocr_text, ocr_conf = run_ocr(processed)

    map_confidence = float(np.clip(0.5 * boundary_conf + 0.5 * ctrl_conf, 0.0, 1.0))

    h, wd = processed.shape[:2]
    return MapCvResult(
        width=wd,
        height=h,
        processed_image=processed,
        controls=controls,
        start=start,
        boundary_quad=boundary_json,
        map_confidence=map_confidence,
        ocr_confidence=ocr_conf,
        ocr_text=ocr_text,
        warnings=warnings,
    )
