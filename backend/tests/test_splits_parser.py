"""Splits parser: wide and tall layouts, delimiter and cumulative/leg detection."""
from app.services.splits.parser import (
    _parse_clock,
    parse_splits,
    parse_winsplits_paste,
)


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


def test_winsplits_dot_times():
    # WinSplits uses a dot between minutes and seconds.
    assert _parse_clock("3.58") == 238
    assert _parse_clock("21.55") == 1315
    assert _parse_clock("1:04.56") == 3896
    assert _parse_clock("3.58 (2)") == 238  # trailing position marker ignored


def test_winsplits_paste_two_lines():
    paste = (
        "3\tBailey Moore\t1:22.08\t+17.12\t21.55\t(12)\t2.39\t(3)\t2.28\t(5)\t"
        "6.10\t(3)\t4.41\t(5)\t7.46\t(2)\t7.22\t(2)\t6.37\t(5)\t8.33\t(5)\t"
        "1.51\t(3)\t4.24\t(2)\t4.32\t(5)\t2.42\t(4)\t0.28\t(4)\tBailey Moore\n"
        "Bay of Plenty\t21.55\t(12)\t24.34\t(12)\t27.02\t(12)\t33.12\t(12)\t"
        "37.53\t(10)\t45.39\t(4)\t53.01\t(4)\t59.38\t(4)\t1:08.11\t(4)\t"
        "1:10.02\t(4)\t1:14.26\t(3)\t1:18.58\t(3)\t1:21.40\t(3)\t1:22.08\t(3)\tBay of Plenty"
    )
    result = parse_winsplits_paste(paste)
    splits = result["competitors"][0]["splits"]
    assert len(splits) == 14
    # Cumulative ends at the finish time 1:22:08.
    assert round(splits[-1]["cumulative_s"]) == 4928
    # First few cumulative times match the copied data.
    assert [round(s["cumulative_s"]) for s in splits[:3]] == [1315, 1474, 1622]


def test_winsplits_paste_garbage():
    assert parse_winsplits_paste("just some words, no times")["competitors"] == []
