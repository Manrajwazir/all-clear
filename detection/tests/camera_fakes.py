"""
camera_fakes.py -- stand-ins for a camera and for time, shared by the reader tests.

Not a test file (no test_ prefix): pytest doesn't collect it, the tests import it.
"""

import threading
import time

import numpy as np


def img(n):
    return np.full((4, 4, 3), n % 256, dtype=np.uint8)


class FakeCamera:
    """The calls the reader makes on a cv2.VideoCapture: isOpened, read, release.

    `frames` arrive in order, each `interval` seconds after the last; None is a
    failed read. After the last one:
      then="end"   reads fail at once (a stream that ended, or the end of a file)
      then="hang"  read blocks for `hang` seconds, then fails (the read timeout)
    If `explode` is given, the read after the last frame raises it instead.
    `opened=False` is a camera that didn't open at all. `on_read(i)` is called
    before frame i (from 0) is returned: a test can make one read slow there.
    """

    def __init__(self, frames=(), interval=0.0, *, opened=True, then="end",
                 hang=0.3, explode=None, on_read=None):
        self._frames = list(frames)
        self._interval = interval
        self._opened = opened
        self._then = then
        self._hang = hang
        self._explode = explode
        self._on_read = on_read
        self._reads = 0
        self._wake = threading.Event()
        self.released_by = None
        self.release_count = 0

    def isOpened(self):
        return self._opened

    def read(self):
        if self._frames:
            if self._interval:
                time.sleep(self._interval)
            frame = self._frames.pop(0)
            if self._on_read:
                self._on_read(self._reads)
            self._reads += 1
            return frame is not None, frame
        if self._explode is not None:
            raise self._explode
        if self._then == "hang":
            self._wake.wait(self._hang)
        return False, None

    def release(self):
        self.released_by = threading.current_thread().name
        self.release_count += 1
        self._wake.set()

    def wake(self):
        """End a hang early, so a test's teardown doesn't sit through it."""
        self._wake.set()


class Opener:
    """Hands out the given cameras one per open; after that, cameras that won't open.

    Records every open in `events`, alongside the releases of the cameras it
    handed out, so a test can check a camera was let go before the next open.
    """

    def __init__(self, *cams, on_open=None):
        self._cams = list(cams)
        self._on_open = on_open
        self.opens = 0
        self.events = []
        self.handed_out = []

    def __call__(self):
        self.opens += 1
        if self._on_open:
            self._on_open()
        unreleased = [c for c in self.handed_out if c.release_count == 0]
        self.events.append(("open", len(unreleased)))
        cam = self._cams.pop(0) if self._cams else FakeCamera(opened=False)
        self.handed_out.append(cam)
        return cam

    def wake_all(self):
        for cam in self.handed_out:
            cam.wake()


class FakeTime:
    """A clock that only moves when the reader waits, so minutes of backoff take milliseconds."""

    def __init__(self):
        self.now = 1000.0
        self.waits = []

    def clock(self):
        return self.now

    def wait(self, seconds):
        self.waits.append(seconds)
        self.now += seconds
        time.sleep(0.001)          # let other threads run
        return False


def no_jitter(_low, _high):
    return 0.0


def wait_until(condition, timeout=3.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if condition():
            return
        time.sleep(0.005)
    raise AssertionError("condition not reached in time")
