"""Splits parser: wide and tall layouts, delimiter and cumulative/leg detection."""
from app.services.splits.parser import parse_splits


def _cum(result):
    assert result["competitors"], "expected at least one competitor"
    return [round(s["cumulative_s"]) for s in result["competitors"][0]["splits"]]


def test_tall_control_time_cumulative():
    data = b"Control,Time\n101,1:20\n102,2:45\n103,4:10\n"
    assert _cum(parse_splits("s.csv", data)) == [80, 165, 250]


def test_tall_leg_times():
    # Per-leg times (similar magnitude) accumulate into cumulative splits.
    data = b"Control,Leg\n101,80\n102,85\n103,85\n"
    assert _cum(parse_splits("s.csv", data)) == [80, 165, 250]


def test_tall_split_and_cumulative_columns():
    data = b"Ctrl;Split;Cumulative\n31;1:20;1:20\n32;1:25;2:45\n33;1:25;4:10\n"
    assert _cum(parse_splits("s.csv", data)) == [80, 165, 250]


def test_tall_whitespace_no_header():
    data = b"101 1:20\n102 2:45\n103 4:10\n"
    assert _cum(parse_splits("s.txt", data)) == [80, 165, 250]


def test_wide_winsplits_multi_athlete():
    data = b"Name,101,102,103\nAlex,1:20,2:45,4:10\nSam,1:22,2:50,4:20\n"
    result = parse_splits("r.csv", data)
    assert len(result["competitors"]) == 2
    assert _cum(result) == [80, 165, 250]


def test_wide_two_controls_by_names():
    data = b"Name,101,102\nAlex,1:20,2:45\nSam,1:22,2:50\n"
    result = parse_splits("r.csv", data)
    assert len(result["competitors"]) == 2


def test_seconds_and_json():
    assert _cum(parse_splits("s.csv", b"code,cumulative\n1,80\n2,165\n3,250\n")) == [80, 165, 250]
    js = b'{"competitors":[{"name":"You","splits":[{"code":"101","cumulative":"1:20"},{"code":"102","cumulative":"2:45"}]}]}'
    assert _cum(parse_splits("s.json", js)) == [80, 165]
