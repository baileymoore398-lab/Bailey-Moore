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


def _split_series(values: List[Optional[float]], codes: List[str]) -> List[dict]:
    """Turn a row of clock values into split dicts, auto-detecting cumulative
    vs per-leg by monotonicity."""
    known = [v for v in values if v is not None]
    cumulative = True
    if len(known) >= 2 and not all(
        known[i] <= known[i + 1] + 1 for i in range(len(known) - 1)
    ):
        cumulative = False
    splits: List[dict] = []
    prev = 0.0
    for code, val in zip(codes, values):
        if val is None:
            continue
        if cumulative:
            leg, cum, prev = val - prev, val, val
        else:
            leg, prev = val, prev + val
            cum = prev
        splits.append({"code": code, "time_s": leg, "cumulative_s": cum})
    return splits


def _parse_wide_splits(rows: List[List[str]]) -> dict:
    """One row per athlete: [name, c1, c2, ...] with time cells (WinSplits)."""
    header = rows[0]
    control_codes = [h.strip() for h in header[1:] if h.strip()]
    if not control_codes:
        return {"controls": [], "competitors": []}
    competitors: List[dict] = []
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        vals = [_parse_clock(c) for c in row[1 : 1 + len(control_codes)]]
        splits = _split_series(vals, control_codes)
        if splits:
            competitors.append({"name": row[0].strip(), "splits": splits})
    controls = ["S"] + control_codes + ["F"] if control_codes else []
    return {"controls": controls, "competitors": competitors}


_LABEL_COL0 = {"control", "code", "ctrl", "cp", "punch", "no", "number", "#", "leg", "split"}


def _parse_tall_splits(rows: List[List[str]]) -> dict:
    """One row per control (your own splits): [code, time] or
    [code, split, cumulative]. Auto-detects the time column and cumulative/leg."""
    data_rows = rows
    # Drop a header row if the first row has no parseable time, or a label col0.
    first_is_time = any(_parse_clock(c) is not None for c in rows[0][1:])
    if not first_is_time or rows[0][0].strip().lower() in _LABEL_COL0:
        data_rows = rows[1:]
    if len(data_rows) < 2:
        return {"controls": [], "competitors": []}

    ncol = max((len(r) for r in data_rows), default=0)
    # Score each column (>=1) by how many rows parse as a clock value.
    counts = {
        ci: sum(1 for r in data_rows if ci < len(r) and _parse_clock(r[ci]) is not None)
        for ci in range(1, ncol)
    }
    time_cols = [ci for ci, n in counts.items() if n >= 2]
    if not time_cols:
        return {"controls": [], "competitors": []}

    def _colvals(ci: int) -> List[float]:
        return [v for v in (_parse_clock(r[ci]) for r in data_rows if ci < len(r)) if v is not None]

    def _monotonic(vals: List[float]) -> bool:
        return len(vals) >= 2 and all(vals[i] <= vals[i + 1] + 1 for i in range(len(vals) - 1))

    if len(time_cols) >= 2:
        # Split + Cumulative present → the cumulative column is the monotonic
        # one with the largest values.
        mono = [(ci, _colvals(ci)) for ci in time_cols if _monotonic(_colvals(ci))]
        if mono:
            chosen, is_cum = max(mono, key=lambda t: max(t[1]))[0], True
        else:
            chosen, is_cum = max(time_cols, key=lambda c: counts[c]), False
    else:
        # Single time column: cumulative values clearly accumulate (the last is
        # much larger than the first); similar-magnitude values are per-leg.
        chosen = time_cols[0]
        vals = _colvals(chosen)
        is_cum = _monotonic(vals) and vals[-1] >= vals[0] * 1.8

    codes: List[str] = []
    splits: List[dict] = []
    prev = 0.0
    for r in data_rows:
        if chosen >= len(r):
            continue
        v = _parse_clock(r[chosen])
        if v is None:
            continue
        code = r[0].strip() if r and r[0].strip() else str(len(splits) + 1)
        if is_cum:
            leg, cum, prev = v - prev, v, v
        else:
            leg, prev = v, prev + v
            cum = prev
        codes.append(code)
        splits.append({"code": code, "time_s": leg, "cumulative_s": cum})

    if not splits:
        return {"controls": [], "competitors": []}
    return {"controls": ["S"] + codes + ["F"], "competitors": [{"name": "You", "splits": splits}]}


def parse_splits_csv(data: bytes) -> dict:
    """Parse split times from a delimited file (CSV/TSV/TXT/SPL).

    Handles two common layouts, auto-detected:
      * Wide — one row per athlete, columns are control codes (WinSplits export).
      * Tall — one row per control (your own splits): [code, time] or
        [code, split, cumulative]. Times may be mm:ss, h:mm:ss, or seconds, and
        may be cumulative or per-leg (detected automatically).
    """
    text = data.decode("utf-8-sig", errors="replace")
    sample = text[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    rows = [r for r in reader if any(c.strip() for c in r)]
    # Whitespace-delimited fallback (e.g. "101  1:20" per line).
    if rows and max(len(r) for r in rows) == 1:
        rows = [ln.split() for ln in text.splitlines() if ln.strip()]
    if len(rows) < 2:
        return {"controls": [], "competitors": []}

    # Layout detection. A WIDE file (one row per athlete) has several split
    # times in a single row, and/or its first column holds athlete names. A TALL
    # file (your own splits) has 1-2 times per row and control codes in column 0.
    def _row_times(r: List[str]) -> int:
        return sum(1 for c in r[1:] if _parse_clock(c) is not None)

    def _name_like(cell: str) -> bool:
        c = cell.strip()
        return bool(re.search(r"[A-Za-z]", c)) and _parse_clock(c) is None and c.lower() not in _LABEL_COL0

    body = rows[1:]
    max_times_per_row = max(_row_times(r) for r in rows)
    names_in_col0 = sum(1 for r in body if r and _name_like(r[0]))
    looks_wide = max_times_per_row >= 3 or (
        max_times_per_row >= 2 and names_in_col0 >= max(1, len(body) // 2)
    )
    if looks_wide:
        wide = _parse_wide_splits(rows)
        if wide["competitors"]:
            return wide
    return _parse_tall_splits(rows)


def parse_splits_json(data: bytes) -> dict:
    """Parse a flexible JSON splits export.

    Accepts either the normalized shape ({controls, competitors:[{name,splits}]})
    or a simple list of {name, splits:[{code, time|cumulative}]} objects.
    """
    import json

    obj = json.loads(data.decode("utf-8-sig", errors="replace"))
    if isinstance(obj, dict) and "competitors" in obj:
        # Already close to normalized — pass through, filling any gaps.
        competitors = []
        codes: List[str] = []
        for c in obj.get("competitors", []):
            splits = []
            prev = 0.0
            for s in c.get("splits", []):
                code = str(s.get("code") or s.get("control") or "")
                cum = _parse_clock(str(s.get("cumulative_s", s.get("cumulative", ""))))
                leg = _parse_clock(str(s.get("time_s", s.get("time", ""))))
                if cum is None and leg is not None:
                    cum = prev + leg
                if leg is None and cum is not None:
                    leg = cum - prev
                if cum is None:
                    continue
                if code and code not in codes:
                    codes.append(code)
                splits.append({"code": code, "time_s": leg or 0.0, "cumulative_s": cum})
                prev = cum
            if splits:
                competitors.append({"name": c.get("name", "Unknown"), "splits": splits})
        controls = obj.get("controls") or (["S"] + codes + ["F"] if codes else [])
        return {"controls": controls, "competitors": competitors}
    return {"controls": [], "competitors": []}


_EMPTY = {"controls": [], "competitors": []}


def parse_splits(filename: str, data: bytes) -> dict:
    """Parse split times from any supported format.

    Never raises: an unrecognised or malformed file yields an empty result so
    the (optional) splits upload can degrade gracefully instead of erroring.
    """
    name = (filename or "").lower()
    try:
        if name.endswith(".xml"):
            return parse_iof_xml(data)
        if name.endswith(".json"):
            return parse_splits_json(data)
        # WinSplits / SportIdent / generic delimited exports (comma, tab or
        # semicolon — the CSV reader sniffs the delimiter).
        if name.endswith((".csv", ".txt", ".tsv", ".spl")):
            return parse_splits_csv(data)
        head = data[:256].lstrip().lower()
        if head.startswith(b"{") or head.startswith(b"["):
            return parse_splits_json(data)
        if head.startswith(b"<?xml") or b"resultlist" in head:
            return parse_iof_xml(data)
        return parse_splits_csv(data)
    except Exception:  # noqa: BLE001 — malformed file → empty, not a crash
        return dict(_EMPTY)
