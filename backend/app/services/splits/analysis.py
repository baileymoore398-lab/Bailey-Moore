"""Split analysis engine.

Given parsed splits for a field of competitors, compute for the target athlete:
leg times, per-leg field best, time loss per leg, rank per leg, % behind the
leg leader, and cumulative time loss. Real computation — no placeholders.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class LegSplit:
    number: int
    from_control: str
    to_control: str
    time_s: float
    best_time_s: Optional[float] = None
    time_loss_s: float = 0.0
    rank: Optional[int] = None
    pct_behind: Optional[float] = None
    cumulative_loss_s: float = 0.0


@dataclass
class SplitAnalysisResult:
    legs: List[LegSplit] = field(default_factory=list)
    athlete_name: Optional[str] = None
    total_time_s: float = 0.0
    total_loss_s: float = 0.0
    best_leg: Optional[int] = None
    worst_leg: Optional[int] = None

    def legs_json(self) -> List[dict]:
        return [
            {
                "number": l.number,
                "from_control": l.from_control,
                "to_control": l.to_control,
                "time_s": round(l.time_s, 1),
                "best_time_s": round(l.best_time_s, 1) if l.best_time_s is not None else None,
                "time_loss_s": round(l.time_loss_s, 1),
                "rank": l.rank,
                "pct_behind": round(l.pct_behind, 1) if l.pct_behind is not None else None,
                "cumulative_loss_s": round(l.cumulative_loss_s, 1),
            }
            for l in self.legs
        ]


def _select_athlete(competitors: List[dict], athlete_name: Optional[str]) -> Optional[dict]:
    if not competitors:
        return None
    if athlete_name:
        for c in competitors:
            if c.get("name", "").lower() == athlete_name.lower():
                return c
        for c in competitors:
            if athlete_name.lower() in c.get("name", "").lower():
                return c
    return competitors[0]


def analyze_splits(
    parsed: dict, athlete_name: Optional[str] = None
) -> SplitAnalysisResult:
    competitors = parsed.get("competitors", [])
    target = _select_athlete(competitors, athlete_name)
    if target is None:
        return SplitAnalysisResult()

    target_splits = target["splits"]
    # Build per-control field best across all competitors that have that leg.
    field_best: Dict[str, float] = {}
    field_times: Dict[str, List[float]] = {}
    for comp in competitors:
        for s in comp["splits"]:
            code = s["code"]
            t = s["time_s"]
            if t is None or t <= 0:
                continue
            field_times.setdefault(code, []).append(t)
            if code not in field_best or t < field_best[code]:
                field_best[code] = t

    result = SplitAnalysisResult(athlete_name=target.get("name"))
    cumulative_loss = 0.0
    prev_code = "S"
    for idx, s in enumerate(target_splits, start=1):
        code = s["code"]
        time_s = s["time_s"]
        leg = LegSplit(
            number=idx,
            from_control=prev_code,
            to_control=code,
            time_s=time_s,
        )
        best = field_best.get(code)
        leg.best_time_s = best
        if best is not None and time_s is not None:
            leg.time_loss_s = max(0.0, time_s - best)
            cumulative_loss += leg.time_loss_s
            leg.cumulative_loss_s = cumulative_loss
            if best > 0:
                leg.pct_behind = (time_s - best) / best * 100.0
            # Rank within the field for this leg.
            times = sorted(t for t in field_times.get(code, []) if t > 0)
            if time_s in times:
                leg.rank = times.index(time_s) + 1
        result.legs.append(leg)
        result.total_time_s += time_s or 0.0
        prev_code = code

    result.total_loss_s = cumulative_loss
    losing = [l for l in result.legs if l.time_loss_s is not None]
    if losing:
        result.worst_leg = max(losing, key=lambda l: l.time_loss_s).number
        # Best leg = smallest pct behind (closest to field best).
        ranked = [l for l in result.legs if l.pct_behind is not None]
        if ranked:
            result.best_leg = min(ranked, key=lambda l: l.pct_behind).number
    return result
