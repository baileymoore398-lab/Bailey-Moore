"""Split-times parsers for IOF XML 3.0 ResultList and CSV (WinSplits-style).

Normalized output::

    {
      "controls": ["S", "101", "102", ..., "F"],
      "competitors": [
        {"name": str, "splits": [{"code": str, "time_s": float, "cumulative_s": float}]}
      ]
    }

``time_s`` is the leg time (this control minus previous); ``cumulative_s`` is the
elapsed time from start to this control.
"""
from __future__ import annotations

import csv
import io
import re
import xml.etree.ElementTree as ET
from typing import List, Optional


def _localname(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _parse_clock(value: str) -> Optional[float]:
    """Parse 'mm:ss', 'h:mm:ss', or plain seconds into seconds."""
    if value is None:
        return None
    value = value.strip()
    if not value or value in {"-", "--", "n/a"}:
        return None
    if re.fullmatch(r"\d+(\.\d+)?", value):
        return float(value)
    parts = value.split(":")
    try:
        parts = [float(p) for p in parts]
    except ValueError:
        return None
    sec = 0.0
    for p in parts:
        sec = sec * 60 + p
    return sec


def parse_iof_xml(data: bytes) -> dict:
    root = ET.fromstring(data)
    competitors: List[dict] = []
    control_codes: List[str] = []

    for person_result in root.iter():
        if _localname(person_result.tag) != "personresult":
            continue
        name = "Unknown"
        splits: List[dict] = []
        for el in person_result.iter():
            ln = _localname(el.tag)
            if ln == "family" and el.text:
                name = el.text.strip()
            elif ln == "given" and el.text:
                name = f"{el.text.strip()} {name}".strip()
        # Result -> SplitTime elements (cumulative times to each control).
        prev_cum = 0.0
        for result in person_result.iter():
            if _localname(result.tag) != "result":
                continue
            for st in result.iter():
                if _localname(st.tag) != "splittime":
                    continue
                code = None
                cum = None
                for child in st:
                    cn = _localname(child.tag)
                    if cn == "controlcode" and child.text:
                        code = child.text.strip()
                    elif cn == "time" and child.text:
                        cum = _parse_clock(child.text)
                if code is None:
                    continue
                if code not in control_codes:
                    control_codes.append(code)
                if cum is None:
                    continue
                splits.append(
                    {"code": code, "cumulative_s": cum, "time_s": cum - prev_cum}
                )
                prev_cum = cum
            break
        if splits:
            competitors.append({"name": name, "splits": splits})

    controls = ["S"] + control_codes + ["F"] if control_codes else []
    return {"controls": controls, "competitors": competitors}


def parse_splits_csv(data: bytes) -> dict:
    """Parse a CSV of cumulative or leg splits.

    Supported layouts:
      * Header row with control codes; first column = athlete name; cells are
        cumulative times (mm:ss). This matches typical WinSplits exports.
    """
    text = data.decode("utf-8-sig", errors="replace")
    sample = text[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    rows = [r for r in reader if any(c.strip() for c in r)]
    if len(rows) < 2:
        return {"controls": [], "competitors": []}

    header = rows[0]
    # Control code columns are everything after the name column.
    control_codes = [h.strip() for h in header[1:] if h.strip()]
    competitors: List[dict] = []
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        name = row[0].strip()
        splits: List[dict] = []
        prev_cum = 0.0
        cumulative_mode = True  # assume cumulative; auto-detect below
        raw_vals = [_parse_clock(c) for c in row[1 : 1 + len(control_codes)]]
        # Detect whether values are cumulative (monotonic) or per-leg.
        known = [v for v in raw_vals if v is not None]
        if len(known) >= 2 and not all(
            known[i] <= known[i + 1] + 1 for i in range(len(known) - 1)
        ):
            cumulative_mode = False
        for code, val in zip(control_codes, raw_vals):
            if val is None:
                continue
            if cumulative_mode:
                leg = val - prev_cum
                cum = val
                prev_cum = val
            else:
                leg = val
                prev_cum += val
                cum = prev_cum
            splits.append({"code": code, "time_s": leg, "cumulative_s": cum})
        if splits:
            competitors.append({"name": name, "splits": splits})

    controls = ["S"] + control_codes + ["F"] if control_codes else []
    return {"controls": controls, "competitors": competitors}


def parse_splits(filename: str, data: bytes) -> dict:
    name = (filename or "").lower()
    if name.endswith(".xml"):
        return parse_iof_xml(data)
    if name.endswith(".csv") or name.endswith(".txt"):
        return parse_splits_csv(data)
    head = data[:256].lstrip().lower()
    if head.startswith(b"<?xml") or b"resultlist" in head:
        return parse_iof_xml(data)
    return parse_splits_csv(data)
