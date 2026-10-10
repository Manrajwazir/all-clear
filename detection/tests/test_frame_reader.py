"""
test_frame_reader.py -- one thread owns the camera; the loop gets the newest frame, once.

Written 2026-10-10, BEFORE the code (Labs4 block 1, step C3). Intent in one
sentence: the main loop always gets the newest frame the camera has sent, never
the same frame twice, never waits forever, and each frame carries the moment it
arrived.

Why each part matters (plan §4.2):
  - newest, not oldest: with a network camera, frames queue up while YOLO works,
    and today's loop takes the oldest. The record ends up describing the past (G5).
  - never twice: a loop faster than the camera would see one frame several
    times, and the debounce would count each pass as a new sighting. Five
    passes over one real frame would file a violation that never happened.
  - never forever: "no new frame" must come back as None, so the loop can carry on.
  - arrival time: decision D2, detected_at is when the frame arrived, not when
    the alert fired.
  - a recording is different: a file has no clock, so nothing in it is late.
    It gives every frame, in order, as it does today.

No camera, no model, no network: a fake camera stands in for cv2.VideoCapture.
The sim check that measures real frame age is tests/simcam/test_frame_age.py.
"""

import logging
import threading
import time
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from camera import EMPTY_FRAME_WAIT_SECONDS, FrameReader, FrameReaderError


def img(n):
    return np.full((4, 4, 3), n % 256, dtype=np.uint8)


class FakeCamera:
    """The three calls the reader makes on a cv2.VideoCapture.

    `frames` arrive in order, each `interval` seconds after the last; None is an
    empty read. After the last one the camera goes quiet: grab() waits a moment
    and reports nothing, like a live camera with no new frame yet. If `explode`
    is given, grab() raises it instead of going quiet.
    """

    def __init__(self, frames=(), interval=0.0, explode=None):
        self._frames = list(frames)
        self._interval = interval
        self._explode = explode
        self._current = None
        self.released_by = None

    def grab(self):
        if not self._frames:
            if self._explode is not None:
                raise self._explode
            time.sleep(0.02)
            self._current = None
            return False
        if self._interval:
            time.sleep(self._interval)
        self._current = self._frames.pop(0)
        return self._current is not None

    def retrieve(self):
        return self._current is not None, self._current

    def release(self):
        self.released_by = threading.current_thread().name


def wait_until(condition, timeout=2.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if condition():
            return
        time.sleep(0.005)
    raise AssertionError("condition not reached in time")


@pytest.fixture
def started():
    """Start readers through this, so a failing test can't leave a thread running."""
    readers = []

    def start(cam, **kwargs):
        reader = FrameReader(cam, **kwargs)
        readers.append(reader)
        return reader.start()

    yield start
    for reader in readers:
        reader.stop()


def test_the_loop_gets_the_newest_frame_not_the_oldest(started):
    images = [img(n) for n in range(1, 6)]
    reader = started(FakeCamera(images))
    wait_until(lambda: reader.stats["received"] == 5)

    got = reader.next_frame(timeout=1)

    assert got is not None
    assert got.image is images[-1], "the loop must get the newest frame, not an old one"
    assert got.seq == 5


def test_no_frame_is_handed_out_twice_however_fast_the_loop_asks(started):
    images = [img(n) for n in range(20)]
    reader = started(FakeCamera(images, interval=0.03))   # a camera at ~30 fps

    seen = []
    end = time.monotonic() + 1.0
    asks = 0
    while time.monotonic() < end:                          # a loop far faster than that
        asks += 1
        got = reader.next_frame(timeout=0.01)
        if got is not None:
            seen.append(got)

    seqs = [g.seq for g in seen]
    assert asks > 3 * len(seen), "the loop wasn't faster than the camera; this proves nothing"
    assert len(seen) >= 10
    assert len(set(seqs)) == len(seqs), f"a frame was handed out twice: {seqs}"
    assert seqs == sorted(seqs), f"frames out of order: {seqs}"
    assert len({id(g.image) for g in seen}) == len(seen)


def test_no_new_frame_returns_nothing_instead_of_waiting_forever(started):
    reader = started(FakeCamera([img(1)]))                 # one frame, then silence
    assert reader.next_frame(timeout=1) is not None

    t0 = time.monotonic()
    assert reader.next_frame(timeout=0.2) is None, "the same frame came back a second time"
    assert time.monotonic() - t0 < 1.0, "asking for a frame must not block past its wait"


def test_each_frame_carries_the_moment_it_arrived_in_utc(started):
    before = datetime.now(timezone.utc)
    reader = started(FakeCamera([img(1)]))
    got = reader.next_frame(timeout=1)
    after = datetime.now(timezone.utc)

    assert got is not None
    assert got.arrived_at.utcoffset() == timedelta(0), "must be UTC, not local time"
    assert before <= got.arrived_at <= after
    # The same shape as api_client.utc_now_iso(), which detected_at used to come from.
    assert got.arrived_at.isoformat().endswith("+00:00")
    assert isinstance(got.arrived_mono, float)


def test_frames_the_loop_never_saw_are_counted(started):
    reader = started(FakeCamera([img(n) for n in range(1, 11)]))
    wait_until(lambda: reader.stats["received"] == 10)

    got = reader.next_frame(timeout=1)

    assert got.seq == 10
    assert reader.stats == {"received": 10, "delivered": 1, "skipped": 9}


def test_a_recording_gives_every_frame_in_order(started):
    images = [img(n) for n in range(1, 21)]
    reader = started(FakeCamera(images), every_frame=True)

    seen = []
    for _ in range(40):                                    # bounded: a broken reader fails, not hangs
        got = reader.next_frame(timeout=0.3)
        if got is None:
            break
        seen.append(got)
        time.sleep(0.005)                                  # a loop slower than decoding

    assert [g.seq for g in seen] == list(range(1, 21))
    assert all(g.image is want for g, want in zip(seen, images))
    assert reader.stats["skipped"] == 0


def test_stopping_releases_the_camera_from_the_reader_thread(started):
    cam = FakeCamera([img(1)])
    reader = started(cam)
    reader.next_frame(timeout=1)

    reader.stop()

    assert not reader.is_alive()
    # The reader is the camera's only owner: it opens nothing here yet (C4), but
    # it is the one that lets go, so a release can never race a read.
    assert cam.released_by == "allclear-camera"


def test_a_reader_that_dies_is_an_error_not_silence(started):
    reader = started(FakeCamera([img(1)], explode=RuntimeError("decoder crashed")))
    assert reader.next_frame(timeout=1) is not None

    # Without this the loop would get None forever and look like a quiet camera.
    with pytest.raises(FrameReaderError):
        reader.next_frame(timeout=1)


def test_a_dead_camera_is_waited_on_not_spun(started, caplog):
    """OPEN_ITEMS 17.2, now inside the reader: fail slowly and quietly."""
    waits = []

    def sleep(seconds):
        waits.append(seconds)
        time.sleep(0.001)

    caplog.set_level(logging.WARNING)
    reader = started(FakeCamera([None] * 60), sleep=sleep)
    wait_until(lambda: len(waits) >= 60)
    reader.stop()

    assert set(waits) == {EMPTY_FRAME_WAIT_SECONDS}, "every empty read must pause"
    assert reader.stats["received"] == 0
    warnings = [r for r in caplog.records if "No frame from camera" in r.getMessage()]
    assert 1 <= len(warnings) <= 3, f"{len(warnings)} warnings for ~60 empty reads"
