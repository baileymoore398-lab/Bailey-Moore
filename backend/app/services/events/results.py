"""Rich IOF XML 3.0 ResultList parser for event ingestion.

Unlike the lightweight split parser, this extracts the full structure needed for
event leaderboards: class/course, competitor name, finish position, status, total
time, and per-control cumulative + leg splits.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import List, Optional

from app.services.splits.parser import _parse_clock


def _ln(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


@dataclass
class CompetitorResult:
    name: str
    course: str
    position: Optional[int] = None
    status: str = "ok"
    total_time_s: Optional[float] = None
    splits: List[dict] = field(default_factory=list)  # [{code, cumulative_s, time_s}]


@dataclass
class EventResults:
    event_name: Optional[str]
    courses: List[str]
    competitors: List[CompetitorResult]

    def by_course(self) -> dict[str, List[CompetitorResult]]:
        out: dict[str, List[CompetitorResult]] = {}
        for c in self.competitors:
            out.setdefault(c.course, []).append(c)
        return out


def parse_event_results(data: bytes) -> EventResults:
    root = ET.fromstring(data)
    event_name = None
    competitors: List[CompetitorResult] = []
    courses: List[str] = []

    for class_result in root.iter():
        if _ln(class_result.tag) != "classresult":
            continue
        course = "Course"
        for el in class_result:
            if _ln(el.tag) == "class":
                for c in el:
                    if _ln(c.tag) == "name" and c.text:
                        course = c.text.strip()
        if course not in courses:
            courses.append(course)
        for pr in class_result.iter():
            if _ln(pr.tag) != "personresult":
                continue
            comp = _parse_person_result(pr, course)
            if comp:
                competitors.append(comp)

    # Fall back to a flat ResultList without ClassResult wrappers.
    if not competitors:
        for pr in root.iter():
            if _ln(pr.tag) == "personresult":
                comp = _parse_person_result(pr, "Course")
                if comp:
                    competitors.append(comp)
        if competitors:
            courses = ["Course"]

    for el in root.iter():
        if _ln(el.tag) == "event":
            for c in el:
                if _ln(c.tag) == "name" and c.text:
                    event_name = c.text.strip()
            break

    return EventResults(event_name=event_name, courses=courses, competitors=competitors)


def _parse_person_result(pr, course: str) -> Optional[CompetitorResult]:
    family = given = ""
    for el in pr.iter():
        ln = _ln(el.tag)
        if ln == "family" and el.text:
            family = el.text.strip()
        elif ln == "given" and el.text:
            given = el.text.strip()
    name = f"{given} {family}".strip() or "Unknown"

    position = None
    status = "ok"
    total = None
    splits: List[dict] = []
    for result in pr.iter():
        if _ln(result.tag) != "result":
            continue
        for el in result:
            ln = _ln(el.tag)
            if ln == "position" and el.text:
                try:
                    position = int(el.text)
                except ValueError:
                    pass
            elif ln == "status" and el.text:
                status = el.text.strip().lower()
            elif ln == "time" and el.text:
                total = _parse_clock(el.text)
        prev = 0.0
        for st in result.iter():
            if _ln(st.tag) != "splittime":
                continue
            code = cum = None
            for child in st:
                cn = _ln(child.tag)
                if cn == "controlcode" and child.text:
                    code = child.text.strip()
                elif cn == "time" and child.text:
                    cum = _parse_clock(child.text)
            if code is None or cum is None:
                continue
            splits.append({"code": code, "cumulative_s": cum, "time_s": cum - prev})
            prev = cum
        # Add finish leg if total time known.
        if total is not None and splits:
            splits.append({"code": "F", "cumulative_s": total, "time_s": total - prev})
        break

    norm_status = {
        "ok": "ok", "0": "ok", "did not finish": "dnf", "dnf": "dnf",
        "disqualified": "dsq", "dsq": "dsq", "mispunch": "mp", "missingpunch": "mp",
    }.get(status, "ok" if status in ("", "ok") else status)
    return CompetitorResult(
        name=name, course=course, position=position,
        status=norm_status, total_time_s=total, splits=splits,
    )
