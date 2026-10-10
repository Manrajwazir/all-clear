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

import time
from datetime import datetime, timedelta, timezone

import pytest

from camera import CameraSource, FrameReader
from tests.camera_fakes import FakeCamera, Opener, img, wait_until

STREAM = CameraSource("stream", "rtsp://cam.local/sub")
FILE = CameraSource("file", "clip.mp4")


def live(frames, **kwargs):
    """A live camera: these frames, then nothing new for a while (it doesn't end)."""
    return FakeCamera(frames, then="hang", hang=2, **kwargs)


@pytest.fixture
def started():
    """Start readers through this, so a failing test can't leave a thread running."""
    readers = []

    def start(cam, source=STREAM):
        opener = Opener(cam)
        reader = FrameReader(source, open_capture=opener, probe=lambda host, port: True)
        readers.append((reader, opener))
        return reader.start()

    yield start
    for reader, opener in readers:
        opener.wake_all()
        reader.stop()


def test_the_loop_gets_the_newest_frame_not_the_oldest(started):
    images = [img(n) for n in range(1, 6)]
    reader = started(live(images))
    wait_until(lambda: reader.stats["received"] == 5)

    got = reader.next_frame(timeout=1)

    assert got is not None
    assert got.image is images[-1], "the loop must get the newest frame, not an old one"
    assert got.seq == 5


def test_no_frame_is_handed_out_twice_however_fast_the_loop_asks(started):
    images = [img(n) for n in range(20)]
    reader = started(live(images, interval=0.03))         # a camera at ~30 fps

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
    reader = started(live([img(1)]))                       # one frame, then silence
    assert reader.next_frame(timeout=1) is not None

    t0 = time.monotonic()
    assert reader.next_frame(timeout=0.2) is None, "the same frame came back a second time"
    assert time.monotonic() - t0 < 1.0, "asking for a frame must not block past its wait"


def test_each_frame_carries_the_moment_it_arrived_in_utc(started):
    before = datetime.now(timezone.utc)
    reader = started(live([img(1)]))
    got = reader.next_frame(timeout=1)
    after = datetime.now(timezone.utc)

    assert got is not None
    assert got.arrived_at.utcoffset() == timedelta(0), "must be UTC, not local time"
    assert before <= got.arrived_at <= after
    # The same shape as api_client.utc_now_iso(), which detected_at used to come from.
    assert got.arrived_at.isoformat().endswith("+00:00")
    assert isinstance(got.arrived_mono, float)


def test_frames_the_loop_never_saw_are_counted(started):
    reader = started(live([img(n) for n in range(1, 11)]))
    wait_until(lambda: reader.stats["received"] == 10)

    got = reader.next_frame(timeout=1)

    assert got.seq == 10
    assert reader.stats == {"received": 10, "delivered": 1, "skipped": 9}


def test_a_recording_gives_every_frame_in_order(started):
    images = [img(n) for n in range(1, 21)]
    reader = started(FakeCamera(images, then="end"), source=FILE)

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
    cam = live([img(1)])
    reader = started(cam)
    reader.next_frame(timeout=1)

    reader.stop()

    assert not reader.is_alive()
    # The reader is the camera's only owner: it opens it, reads it, and lets
    # it go, all on its own thread, so a release can never race a read.
    assert cam.released_by == "allclear-camera"


# Moved to test_reconnect.py in C4, where their meaning changed (plan §4.3):
#   "a reader that dies is an error, not silence": an error FROM THE CAMERA is now
#     a lost stream and a reconnect; only a bug in the reader itself kills it,
#     and that still reaches the loop as FrameReaderError.
#   "a dead camera is waited on, not spun" (OPEN_ITEMS 17.2): now the backoff
#     does the waiting, 1 s up to 30 s, instead of a fixed 0.1 s pause.
