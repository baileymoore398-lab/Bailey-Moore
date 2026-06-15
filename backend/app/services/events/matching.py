"""Automatic competitor matching: link an uploaded GPS file to a result entry.

Matches by normalized name tokens found in the filename (e.g.
``Jane_Smith_Course3.gpx`` → competitor "Jane Smith"). Uses Jaccard token
overlap with a configurable threshold and returns the best candidate plus a
confidence score so ambiguous matches can be surfaced for manual confirmation.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Sequence


def normalize_tokens(text: str) -> set[str]:
    text = re.sub(r"[\W_]+", " ", text.lower())
    # Drop common non-name tokens.
    stop = {"gpx", "fit", "tcx", "track", "course", "final", "result", "gps"}
    return {t for t in text.split() if t and t not in stop and not t.isdigit()}


@dataclass
class MatchCandidate:
    name: str
    score: float


def match_filename_to_competitors(
    filename: str, competitor_names: Sequence[str], threshold: float = 0.34
) -> Optional[MatchCandidate]:
    file_tokens = normalize_tokens(filename)
    if not file_tokens:
        return None
    best: Optional[MatchCandidate] = None
    for name in competitor_names:
        name_tokens = normalize_tokens(name)
        if not name_tokens:
            continue
        inter = file_tokens & name_tokens
        union = file_tokens | name_tokens
        score = len(inter) / len(union) if union else 0.0
        # Boost when every name token is present in the filename.
        if name_tokens and name_tokens <= file_tokens:
            score = max(score, 0.9)
        if best is None or score > best.score:
            best = MatchCandidate(name=name, score=round(score, 3))
    if best and best.score >= threshold:
        return best
    return None


def match_many(
    filenames: List[str], competitor_names: Sequence[str]
) -> dict[str, Optional[MatchCandidate]]:
    """Greedy one-to-one assignment: each competitor matched at most once."""
    remaining = list(competitor_names)
    result: dict[str, Optional[MatchCandidate]] = {}
    # Sort filenames by their best available score, assign greedily.
    scored = []
    for fn in filenames:
        cand = match_filename_to_competitors(fn, remaining)
        scored.append((fn, cand))
    scored.sort(key=lambda x: (x[1].score if x[1] else 0.0), reverse=True)
    for fn, _ in scored:
        cand = match_filename_to_competitors(fn, remaining)
        result[fn] = cand
        if cand:
            remaining = [n for n in remaining if n != cand.name]
    return result
