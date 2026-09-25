"""
test_debounce_fps.py -- does the debounce fire at the frame rates an edge device runs at?

Written 2026-09-24, before any fix. The sub-4 cases are EXPECTED TO FAIL and are
marked xfail(strict=True); run with --runxfail to see them fail. The failure is
the point. debounce.py:48 rejects any window of N sightings that spans more
than 1.0 s, and at f frames per second five sightings span 4/f seconds. On the
laptop (~30 FPS) this never shows. On a loaded edge device it is silent data loss:
a worker stands there without a hard hat and nothing is ever recorded.

Why the existing test_debounce.py cannot see this: it calls should_alert()
back to back against the real clock, so every "frame" lands within microseconds
of the last. Frame rate never enters into it.

The fake clock: debounce.py does `from time import time`, so the name to patch
is debounce.time, not time.time.
"""

import pytest

import debounce
from debounce import ViolationTracker

SECONDS = 5          # simulated footage per case; far longer than the debounce needs
DEBOUNCE_FRAMES = 5  # the production default, main.py:77


def alerts_fired(monkeypatch, fps, detected=lambda i: True, seconds=SECONDS):
    """Feed `seconds` of frames at `fps`; `detected(i)` says whether frame i sees it."""
    clock = {"t": 1000.0}
    monkeypatch.setattr(debounce, "time", lambda: clock["t"])
    tracker = ViolationTracker(debounce_frames=DEBOUNCE_FRAMES, cooldown_seconds=60)

    fired = 0
    for i in range(int(fps * seconds)):
        clock["t"] = 1000.0 + i / fps
        if detected(i) and tracker.should_alert("no_hardhat"):
            fired += 1
    return fired


# ── The question asked: every frame detected, at realistic frame rates ─────────
# 2 and 3 FPS are marked xfail(strict=True): the suite stays green while the defect
# stands, and turns red the day someone fixes it without updating this test.
# To SEE them fail (the talk demo):  pytest --runxfail tests/test_debounce_fps.py

KNOWN_FLOOR = pytest.mark.xfail(
    strict=True,
    reason=("Known defect: debounce.py:48 rejects any 5-sighting window over 1.0 s, so below "
    "4 sightings/s it never fires. all-clear-internal OPEN_ITEMS 17.1. Fix deferred "
    "to Labs4 Objective 2. strict=True: this turns red the day it is fixed."),
)

@pytest.mark.parametrize("fps", [
    pytest.param(2, marks=KNOWN_FLOOR),
    pytest.param(3, marks=KNOWN_FLOOR),
    4, 5, 10, 30,
])
def test_a_persistent_violation_alerts_at(monkeypatch, fps):
    assert alerts_fired(monkeypatch, fps) >= 1, (
        f"a violation present in EVERY frame for {SECONDS}s never alerted at {fps} FPS"
    )


# ── The boundary: is exactly 4 FPS in or out? ──────────────────────────────────
# debounce.py:48 is `if now - oldest > 1.0: return False`, a strict greater-than.
# At exactly 4 FPS five sightings span exactly 1.0 s, which is NOT > 1.0, so it
# fires. Just under 4 it never does. This test pins today's behaviour; it is
# expected to PASS.

def test_boundary_exactly_4_fps_fires_just_under_does_not(monkeypatch):
    assert alerts_fired(monkeypatch, 4) >= 1
    assert alerts_fired(monkeypatch, 3.99) == 0


# ── "Consecutive" is not what the code checks ──────────────────────────────────
# debounce.py:45 says "N consecutive frames". The deque only records frames that
# HAD a detection, so gaps are invisible to it. Seen on every other frame at
# 10 FPS still alerts. Expected to PASS -- it documents the real behaviour.

def test_consecutive_frames_are_not_required(monkeypatch):
    assert alerts_fired(monkeypatch, 10, detected=lambda i: i % 2 == 0) >= 1


# ── What actually matters on site: frame rate TIMES hit rate ────────────────────
# The floor applies to sightings per second, not frames per second. At 10 FPS a
# model that catches the violation in one frame out of three is 3.3 sightings a
# second, under the floor. Same defect, so the same xfail.

@KNOWN_FLOOR
def test_intermittent_detection_at_10_fps_still_alerts(monkeypatch):
    assert alerts_fired(monkeypatch, 10, detected=lambda i: i % 3 == 0) >= 1, (
        "seen in 1 of every 3 frames at 10 FPS (3.3 sightings/s): never alerted"
    )
