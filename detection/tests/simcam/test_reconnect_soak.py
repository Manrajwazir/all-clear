"""
test_reconnect_soak.py -- 200 reconnects, and the program's memory doesn't grow.

Written 2026-10-10, BEFORE the code (Labs4 block 1, step C4). Intent in one
sentence: connecting to the camera and letting go of it, over and over, leaves
nothing behind.

Why: on a site the reader may reconnect thousands of times over months. If each
connection leaked an FFmpeg handle or a decoder's buffers, the device would run
out of memory after days, long after any short test passed. The unit tests
check release() is called; only real connections show whether it frees
everything.

Slow on purpose: each connection waits for the camera's next keyframe, about 4 s
with the simulated camera (measured 2026-10-10), so 200 take about 15 minutes.
Skipped unless SIMCAM=1 and SIMCAM_SOAK=1.
"""

import gc
import os
import time

import psutil
import pytest

import camera
from camera import CameraSource, configure_capture_logging
from simcam import fault

pytestmark = pytest.mark.skipif(
    os.getenv("SIMCAM") != "1" or os.getenv("SIMCAM_SOAK") != "1",
    reason="slow (about 15 min): python simcam/fault.py up, then SIMCAM=1 SIMCAM_SOAK=1",
)

WARM_UP = 10          # the first connections load codecs and grow caches; not a leak
RECONNECTS = 200
ALLOWED_GROWTH_MB = 30


@pytest.fixture(scope="module", autouse=True)
def simulated_camera():
    fault.up()
    fault.ready()


def test_200_reconnects_leave_nothing_behind():
    source = CameraSource.from_env({
        "CAMERA_SOURCE": fault.URL,
        "CAMERA_USERNAME": fault.USERNAME,
        "CAMERA_PASSWORD": fault.PASSWORD,
    })
    configure_capture_logging(source)
    me = psutil.Process()

    def connect_read_release():
        cap = camera.open_capture(source, open_timeout_s=10, read_timeout_s=5)
        try:
            assert cap.isOpened(), "the simulated camera didn't open"
            ok, _ = cap.read()
            assert ok, "connected but no frame"
        finally:
            cap.release()

    for _ in range(WARM_UP):
        connect_read_release()
    gc.collect()
    before = me.memory_info().rss
    started = time.monotonic()

    samples = []
    for n in range(1, RECONNECTS + 1):
        connect_read_release()
        if n % 50 == 0:
            gc.collect()
            samples.append((n, (me.memory_info().rss - before) / 1e6))

    growth = samples[-1][1]
    print(f"\n{RECONNECTS} reconnects in {time.monotonic() - started:.0f} s; memory growth "
          + ", ".join(f"after {n}: {mb:+.1f} MB" for n, mb in samples))
    assert growth < ALLOWED_GROWTH_MB, (
        f"memory grew {growth:.1f} MB over {RECONNECTS} reconnects: something isn't released"
    )
