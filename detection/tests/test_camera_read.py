"""
test_camera_read.py -- a dead or locked camera must not become a hot loop.

Written 2026-09-26, BEFORE the fix (OPEN_ITEMS 17.2). Intent in one sentence:
when the camera returns no frame, the loop waits before trying again, and does
not log a warning on every attempt.

Why it matters: on an empty frame main.py used to log and `continue` with no
pause. A camera held by another app (Microsoft Teams, in practice) returns
empty frames instantly, so the loop spins at full speed and writes one warning
per spin. The reconnect code that used to cover this was removed on purpose in
ee01e9d, because no retry can take a webcam back from Teams. The ask here is
smaller: fail slowly and quietly, not fail again.

No camera, no model: a fake capture object stands in for cv2.VideoCapture, and
a fake sleep records what the loop would have waited.
"""

import numpy as np
import pytest

from camera import read_frame, should_warn, EMPTY_FRAME_WAIT_SECONDS


class FakeCapture:
    """Mimics the two cv2.VideoCapture calls the loop makes."""

    def __init__(self, frames):
        self._frames = list(frames)   # each item: an ndarray, or None for "empty"

    def grab(self):
        return bool(self._frames) and self._frames[0] is not None

    def retrieve(self):
        f = self._frames.pop(0) if self._frames else None
        return (f is not None), f


def test_empty_frame_waits_before_returning():
    waits = []
    frame = read_frame(FakeCapture([None]), sleep=waits.append)
    assert frame is None
    assert waits == [EMPTY_FRAME_WAIT_SECONDS], "an empty frame must pause the loop"
    assert EMPTY_FRAME_WAIT_SECONDS > 0


def test_good_frame_returns_without_waiting():
    waits = []
    img = np.zeros((4, 4, 3), dtype=np.uint8)
    frame = read_frame(FakeCapture([img]), sleep=waits.append)
    assert frame is img
    assert waits == [], "a healthy camera must never be slowed down"


def test_dead_camera_is_bounded_not_spinning():
    """A camera that never delivers: 100 reads must cost 100 waits, not 0."""
    waits = []
    cap = FakeCapture([None] * 100)
    for _ in range(100):
        read_frame(cap, sleep=waits.append)
    assert len(waits) == 100
    assert sum(waits) == pytest.approx(100 * EMPTY_FRAME_WAIT_SECONDS)


def test_warning_is_not_logged_on_every_failure():
    """First failure is reported at once; after that, periodically."""
    logged = [n for n in range(1, 1001) if should_warn(n)]
    assert logged[0] == 1, "the first empty frame must be reported immediately"
    assert len(logged) <= 25, f"{len(logged)} warnings for 1000 empty frames is a flood"
    assert len(logged) >= 2, "a camera that stays dead must keep being reported"
