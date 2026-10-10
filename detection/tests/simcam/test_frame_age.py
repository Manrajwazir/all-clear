"""
test_frame_age.py -- how old is the frame the loop is looking at? Measured, not argued.

Written 2026-10-10, BEFORE the code (Labs4 block 1, step C3, plan §6 check 4).
Intent in one sentence: a loop slower than the camera still looks at what is
happening now, not at a backlog that grows every second.

The simulated camera plays the counting video: 15 frames a second, each with its
own frame number painted on it. A loop that sleeps 0.2 s per frame stands in for
slow inference (5 frames a second). For every frame the loop gets, the test
reads its number and works out how far behind real time it is:

    behind = (seconds since the first frame we got) - (frames since then) / 15

If the loop keeps up, that stays near zero. If frames are queueing, it climbs by
about two thirds of a second every second.

Two checks, and the first one is a control:
  1. The old way of reading (grab then retrieve on the loop's own thread, as
     main.py did before C3) MUST be seen falling behind. That is the G5 claim, and it is also proof the measurement
     can see lag at all. If this one stops failing to keep up, the second check
     passing would mean nothing (CLAUDE.md: a check reporting good news may not
     be running).
  2. The FrameReader keeps the loop within half a second of now, once running.

Found when this first ran, 2026-10-10: the very first frame after connecting is
about 0.8 s older than the ones after it. The loop asked the instant the reader
started and got the frame that had been waiting since the connection opened;
from the next frame on it was current. A one-time offset is not the G5 backlog,
which grows, so check 2 measures from the first second on and prints the
start-up offset instead of hiding it. The same offset will follow every
reconnect (C4).

Skipped unless SIMCAM=1.
"""

import os
import time

import cv2
import pytest

import camera
from camera import CameraSource, configure_capture_logging
from simcam import fault
from simcam.counting import read_index
from simcam.make_counting_video import FPS

pytestmark = pytest.mark.skipif(
    os.getenv("SIMCAM") != "1",
    reason="needs the simulated camera: python simcam/fault.py up, then SIMCAM=1",
)

SLOW_LOOP_S = 0.2     # 5 frames a second: slower than the camera's 15
RUN_S = 12


@pytest.fixture(scope="module", autouse=True)
def simulated_camera():
    fault.up()
    fault.ready()


@pytest.fixture(scope="module")
def period():
    """Frames in one loop of the video, to undo the wrap back to frame 0."""
    clip = cv2.VideoCapture(str(fault.HERE / "clips" / "counting.mp4"))
    frames = int(clip.get(cv2.CAP_PROP_FRAME_COUNT))
    clip.release()
    assert frames > 0
    return frames


def sim_source():
    source = CameraSource.from_env({
        "CAMERA_SOURCE": fault.URL,
        "CAMERA_USERNAME": fault.USERNAME,
        "CAMERA_PASSWORD": fault.PASSWORD,
    })
    configure_capture_logging(source)
    return source


def open_sim():
    source = sim_source()
    cap = cv2.VideoCapture(source.open_target(), cv2.CAP_FFMPEG, [
        cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000,
    ])
    assert cap.isOpened(), "could not open the simulated camera"
    return cap


def seconds_behind(samples, period):
    """For each (time we got it, frame number): how far behind the first one it is."""
    t0, n0 = samples[0]
    behind, offset, last = [], 0, n0
    for t, n in samples:
        if n < last - period // 2:          # the video looped back to frame 0
            offset += period
        last = n
        behind.append((t - t0) - (n + offset - n0) / FPS)
    return behind


def report(name, behind):
    marks = [f"{behind[i]:+.2f}" for i in range(0, len(behind), max(1, len(behind) // 8))]
    print(f"\n{name}: {len(behind)} frames, seconds behind over time: {' '.join(marks)}"
          f"  (last {behind[-1]:+.2f}, spread {max(behind) - min(behind):.2f})")


def test_todays_read_falls_behind_a_camera_faster_than_the_loop(period):
    cap = open_sim()
    # Exactly as main.py has always opened it: a one-frame buffer requested.
    accepted = cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    print(f"\nCAP_PROP_BUFFERSIZE=1 accepted by FFmpeg's backend: {accepted}")
    samples = []
    end = time.monotonic() + RUN_S
    try:
        while time.monotonic() < end:
            cap.grab()                      # the old way: the NEXT frame, the oldest
            ok, frame = cap.retrieve()
            if not ok or frame is None:
                continue
            samples.append((time.monotonic(), read_index(frame)))
            time.sleep(SLOW_LOOP_S)
    finally:
        cap.release()

    behind = seconds_behind(samples, period)
    report("today, grab() then retrieve()", behind)
    assert len(samples) >= RUN_S * 3
    assert behind[-1] > 3.0, (
        "today's read did NOT fall behind. Either the G5 claim is wrong (grab() "
        "really does skip to the newest frame) or this measurement can't see lag. "
        "Either way, the reader check below proves nothing until this is understood."
    )


def test_the_reader_keeps_a_slow_loop_looking_at_now(period):
    reader = camera.FrameReader(sim_source()).start()
    samples = []
    # The reader connects by itself (about 4 s, waiting for a keyframe): the
    # measured window starts at the first frame, not before it.
    assert reader.next_frame(timeout=20) is not None, "the reader never connected"
    end = time.monotonic() + RUN_S
    try:
        while time.monotonic() < end:
            got = reader.next_frame(timeout=1.0)
            if got is None:
                continue
            samples.append((time.monotonic(), read_index(got.image)))
            time.sleep(SLOW_LOOP_S)
        stats = reader.stats
    finally:
        reader.stop()

    behind = seconds_behind(samples, period)
    report("FrameReader", behind)
    assert len(samples) >= RUN_S * 3
    settled = behind[int(1 / SLOW_LOOP_S):]           # from the first second on
    print(f"start-up offset: the first frame was {behind[0] - min(settled):.2f} s "
          f"older than the steady state")
    assert max(settled) - min(settled) < 0.5, "the loop drifted behind the camera"
    assert stats["skipped"] > 0, "the camera was faster than the loop, so frames must be skipped"
