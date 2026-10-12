"""
test_reconnect.py -- when the camera goes away, notice, say so once, and come back.

Written 2026-10-10, BEFORE the code (Labs4 block 1, step C4). Intent in one
sentence: when the camera goes away for any reason, the program notices within
seconds, says so once, keeps trying at a sensible pace without hammering a
camera that refuses it, and records exactly how long it was blind.

Plan §4.3. What each group protects:
  - backoff 1, 2, 4, 8, 16, then every 30 s, reset after 60 s of good streaming:
    a short drop costs a second, a long one doesn't flood the log or the camera.
  - release before every reopen: a camera allows only a few viewers, so a
    connection leaked per reconnect would get us refused with nothing wrong.
  - missing at start: after a power cut the Jetson boots before the camera; the
    program must wait for it, not exit (G3, decision D7).
  - refused vs unreachable: many cameras lock the account after repeated failed
    logins, so a camera that answers but refuses us is tried every few minutes,
    not every 30 s. One that doesn't answer at all keeps the normal pace.
  - one "blind for N s" line per outage: that line is the record of not watching.
  - a file that ends is finished, not an outage.
  - an error from the camera is a lost stream, not a dead program.
  - webcams take the same path (decision D1), which also keeps OPEN_ITEMS 17.2:
    a dead or locked webcam is waited on, never spun on.

A fake camera and a fake clock: minutes of backoff run in milliseconds.
"""

import logging
import re

import pytest

import camera
from camera import (
    BACKOFF_S,
    HEALTHY_RESET_S,
    Backoff,
    CameraSource,
    FrameReader,
    FrameReaderError,
)
from tests.camera_fakes import FakeCamera, FakeTime, Opener, img, no_jitter, wait_until

STREAM = CameraSource("stream", "rtsp://192.168.1.50:554/sub")
WEBCAM = CameraSource("webcam", 0)
FILE = CameraSource("file", "clip.mp4")


@pytest.fixture
def make(request):
    """Build a reader on fake time; every reader is stopped when the test ends."""
    readers = []

    def build(source, opener, *, probe=lambda host, port: True, t=None, **kwargs):
        t = t or FakeTime()
        reader = FrameReader(source, open_capture=opener, probe=probe, wait=t.wait,
                             clock=t.clock, rand=no_jitter, **kwargs)
        readers.append((reader, opener))
        return reader.start(), t

    yield build
    for reader, opener in readers:
        if isinstance(opener, Opener):
            opener.wake_all()
        reader.stop()


def lines(caplog, pattern):
    return [r.getMessage() for r in caplog.records if re.search(pattern, r.getMessage())]


# ── The backoff itself ─────────────────────────────────────────────────────


def test_backoff_waits_1_2_4_8_16_then_every_30():
    b = Backoff(rand=no_jitter)
    assert [b.next_wait() for _ in range(8)] == [1, 2, 4, 8, 16, 30, 30, 30]
    assert BACKOFF_S == (1, 2, 4, 8, 16, 30)


def test_backoff_jitter_is_a_few_hundred_milliseconds_either_way():
    waits = [Backoff().next_wait() for _ in range(200)]
    assert all(0.5 <= w <= 1.5 for w in waits), "the first wait must stay about 1 s"
    assert len(set(waits)) > 1, "no randomness: cameras that dropped together retry in lockstep"


def test_backoff_resets_only_after_a_minute_of_good_streaming():
    b = Backoff(rand=no_jitter)
    for _ in range(4):
        b.next_wait()
    b.healthy_for(HEALTHY_RESET_S - 1)
    assert b.next_wait() == 16, "reset too soon: a flapping camera would be hammered at 1 s"
    b.healthy_for(HEALTHY_RESET_S)
    assert b.next_wait() == 1, "never reset: one bad hour would leave every later drop at 30 s"


# ── Lost, released, reopened ───────────────────────────────────────────────


def test_a_lost_stream_is_released_then_reopened(make):
    cam1 = FakeCamera([img(1), img(2)], then="end")
    cam2 = FakeCamera([img(3)], then="hang")
    opener = Opener(cam1, cam2)
    reader, t = make(STREAM, opener)

    wait_until(lambda: opener.opens >= 2)
    wait_until(lambda: reader.stats["received"] >= 3)

    assert cam1.release_count == 1, "the lost camera must be released"
    assert opener.events[1] == ("open", 0), "reopened before letting go of the old connection"
    assert t.waits[0] == 1, "the first retry after a drop comes after 1 s"


def test_a_missing_camera_at_start_keeps_trying_and_never_gives_up(make):
    answers = iter([False] * 6 + [True] * 100)          # off for six tries, then on
    opener = Opener(FakeCamera([img(1)], then="hang"))
    reader, t = make(STREAM, opener, probe=lambda host, port: next(answers))

    got = reader.next_frame(timeout=3)

    assert got is not None, "the camera appeared and the reader never connected"
    assert reader.is_alive()
    assert t.waits[:6] == [1, 2, 4, 8, 16, 30]


def test_an_unreachable_camera_keeps_the_normal_pace_and_isnt_opened(make, caplog):
    caplog.set_level(logging.INFO)
    probes = []

    def probe(host, port):
        probes.append((host, port))
        return False

    opener = Opener()
    reader, t = make(STREAM, opener, probe=probe)
    wait_until(lambda: len(probes) >= 7)

    assert probes[0] == ("192.168.1.50", 554)
    assert opener.opens == 0, "no point asking for a stream from an address that doesn't answer"
    assert t.waits[:6] == [1, 2, 4, 8, 16, 30]
    assert not lines(caplog, "refuses the stream")
    assert lines(caplog, r"unreachable at 192\.168\.1\.50:554")


# ── Refused: answers, but says no ──────────────────────────────────────────


def test_a_camera_that_refuses_3_times_is_then_tried_every_few_minutes(make, caplog):
    caplog.set_level(logging.INFO)
    opener = Opener()                         # every open fails at once: answered, refused
    reader, t = make(STREAM, opener, refused_wait_s=300)
    wait_until(lambda: opener.opens >= 5)

    assert t.waits[:4] == [1, 2, 300, 300], (
        "after 3 refusals in a row the pace must drop to the refused wait"
    )
    refused = lines(caplog, "refuses the stream")
    assert len(refused) == 1, f"say it once, loudly, not on every try: {refused}"
    assert re.search("password", refused[0], re.I) and re.search("path", refused[0], re.I)


def test_an_open_that_times_out_is_not_a_refusal(make, caplog):
    """The hang: the address answers, but nothing completes. Slow failure = no answer."""
    caplog.set_level(logging.INFO)
    t = FakeTime()
    opener = Opener(on_open=lambda: t.wait(10))        # each open takes the full 10 s
    reader, _ = make(STREAM, opener, t=t, open_timeout_s=10)
    wait_until(lambda: opener.opens >= 5)

    assert not lines(caplog, "refuses the stream")
    backoff_waits = [w for w in t.waits if w != 10]
    assert backoff_waits[:4] == [1, 2, 4, 8]


def test_a_camera_that_streamed_before_gets_more_patience_before_the_refused_wait(make, caplog):
    """A camera restarting its stream software answers 'no such stream' for a while.

    Our settings were right a minute ago, so that isn't a wrong password. Found
    building C4: the plan's 3 strikes would have put a rebooting camera on a
    5-minute wait. 10 strikes after a good stream still protects the account if
    the password really was changed underneath us.
    """
    caplog.set_level(logging.INFO)
    opener = Opener(FakeCamera([img(1)], then="end"))
    reader, t = make(STREAM, opener, refused_wait_s=300)
    wait_until(lambda: opener.opens >= 13)

    refusal_waits = t.waits[:11]
    assert 300 not in refusal_waits[:10], f"gave up on a camera that was fine a moment ago: {t.waits}"
    assert 300 in t.waits, "a camera refusing for minutes must still slow down"
    assert len(lines(caplog, "refuses the stream")) == 1


def test_a_frame_that_arrives_after_a_stall_is_a_hang_not_a_frame(make, caplog):
    """Found building C4, on the simulated camera: when a stream hangs, OpenCV's read
    timeout fires but FFmpeg keeps reading, and frames held up during the hang
    arrive late, in a burst (16 frames, 5 to 10 s old). Passed on, they would be
    looked at as if they were now, and stamped with the wrong time. A read that
    took longer than the read timeout means the stream hung: the reader drops what
    it returned and reconnects.
    """
    caplog.set_level(logging.INFO)
    t = FakeTime()
    stale = img(2)
    cam1 = FakeCamera([img(1), stale, img(3)], then="end",
                      on_read=lambda i: t.wait(6) if i == 1 else None)
    fresh = img(4)
    cam2 = FakeCamera([fresh], then="hang", hang=5)
    opener = Opener(cam1, cam2)
    reader, _ = make(STREAM, opener, t=t, read_timeout_s=5)

    seen = []
    for _ in range(50):
        got = reader.next_frame(timeout=0.1)
        if got is not None:
            seen.append(got.image)
            if got.image is fresh:
                break

    assert any(s is fresh for s in seen), "never reconnected after the stall"
    assert not any(s is stale for s in seen), "a frame that arrived 6 s late was passed on as new"
    assert reader.stats["received"] == 2, "frames read after the stall must not be used"
    assert len(lines(caplog, "Camera stream lost")) == 1


def test_a_slow_first_frame_is_not_a_hang(make, caplog):
    """C4 review, 2026-10-12: the stall rule must not apply to the first read after
    connecting, or a camera slow to send its first frame would never connect."""
    caplog.set_level(logging.INFO)
    t = FakeTime()
    first = img(1)
    cam = FakeCamera([first], then="hang", hang=5, on_read=lambda i: t.wait(6) if i == 0 else None)
    reader, _ = make(STREAM, Opener(cam), t=t, read_timeout_s=5)

    got = reader.next_frame(timeout=2)

    assert got is not None and got.image is first
    assert not lines(caplog, "stalled|stream lost")


def test_the_refusal_message_names_a_busy_camera_too(make, caplog):
    """C4 review: a camera already at its viewer limit says no as fast as a wrong
    password does. The message must not send the installer only to the password."""
    caplog.set_level(logging.INFO)
    opener = Opener()
    reader, t = make(STREAM, opener)
    wait_until(lambda: lines(caplog, "refuses the stream"))
    assert re.search("viewer", lines(caplog, "refuses the stream")[0], re.I)


def test_a_missing_webcam_isnt_blamed_on_teams_alone(make, caplog):
    caplog.set_level(logging.INFO)
    opener = Opener()                                   # webcam 0 never opens
    reader, t = make(WEBCAM, opener)
    wait_until(lambda: opener.opens >= 2)
    hint = lines(caplog, "Webcam 0")[0]
    assert re.search(r"no webcam 0", hint, re.I), hint


# ── The record of being blind ──────────────────────────────────────────────


def test_every_outage_writes_exactly_one_blind_line(make, caplog):
    caplog.set_level(logging.INFO)
    cam1 = FakeCamera([img(1)], then="end")
    cam3 = FakeCamera([img(2)], then="hang", hang=5)
    opener = Opener(cam1, FakeCamera(opened=False), cam3)
    reader, t = make(STREAM, opener)
    wait_until(lambda: reader.stats["received"] >= 2)
    wait_until(lambda: lines(caplog, "Camera blind for"))

    assert len(lines(caplog, "Camera stream lost")) == 1
    blind = lines(caplog, "Camera blind for")
    assert len(blind) == 1, blind
    assert re.search(r"Camera blind for 3 s \(last frame \d\d:\d\d:\d\d, next frame "
                     r"\d\d:\d\d:\d\d\), 2 reconnect attempts", blind[0]), blind[0]


def test_stopping_mid_outage_still_writes_the_blind_line(make, caplog):
    caplog.set_level(logging.INFO)
    opener = Opener(FakeCamera([img(1)], then="end"))
    reader, t = make(STREAM, opener)
    wait_until(lambda: opener.opens >= 3)

    reader.stop()

    blind = lines(caplog, "Camera blind for")
    assert len(blind) == 1 and "still blind at shutdown" in blind[0], blind


# ── Other kinds of source, and errors ──────────────────────────────────────


def test_a_file_that_ends_is_finished_not_an_outage(make, caplog):
    caplog.set_level(logging.INFO)
    opener = Opener(FakeCamera([img(1), img(2)], then="end"))
    reader, t = make(FILE, opener)

    seen = [reader.next_frame(timeout=1), reader.next_frame(timeout=1)]
    wait_until(lambda: not reader.is_alive())

    assert all(seen)
    assert reader.finished and reader.state == "finished"
    assert reader.next_frame(timeout=0.1) is None
    assert opener.opens == 1, "the end of a file is not a reason to reopen it"
    assert not lines(caplog, "stream lost|blind for")


def test_an_error_from_the_camera_is_a_lost_stream_not_a_crash(make, caplog):
    caplog.set_level(logging.INFO)
    cam1 = FakeCamera([img(1)], explode=RuntimeError("decoder crashed"))
    opener = Opener(cam1, FakeCamera([img(2)], then="hang"))
    reader, t = make(STREAM, opener)

    wait_until(lambda: reader.stats["received"] >= 2)

    assert reader.is_alive()
    assert any(r.exc_info for r in caplog.records), "the camera's error must be logged in full"
    assert cam1.release_count == 1


def test_an_error_in_the_reader_itself_still_reaches_the_loop(caplog):
    """Anything that isn't the camera failing is a bug: the thread dies loudly (C3, C5)."""
    def broken_wait(_seconds):
        raise RuntimeError("bug in the reader")

    reader = FrameReader(STREAM, open_capture=Opener(FakeCamera(opened=False)),
                         probe=lambda h, p: True, wait=broken_wait, rand=no_jitter).start()
    try:
        with pytest.raises(FrameReaderError):
            reader.next_frame(timeout=2)
    finally:
        reader.stop()


def test_a_webcam_another_app_holds_is_waited_on_not_spun(make, caplog):
    """OPEN_ITEMS 17.2 and decision D1: Teams holds the webcam; it opens, but gives nothing."""
    caplog.set_level(logging.INFO)
    held = [FakeCamera([None], then="end") for _ in range(8)]
    opener = Opener(*held)
    reader, t = make(WEBCAM, opener)
    wait_until(lambda: opener.opens >= 8)

    assert t.waits[:6] == [1, 2, 4, 8, 16, 30], "a dead webcam must slow down, not spin"
    hints = lines(caplog, "Teams")
    assert hints, "the log must say the likely cause"
    assert len(caplog.records) <= 4 * opener.opens, "a few lines per attempt, not a flood"


def test_the_state_says_what_the_camera_is_doing(make):
    opener = Opener(FakeCamera([img(1)], then="hang", hang=5))
    reader, t = make(STREAM, opener)
    reader.next_frame(timeout=2)
    assert reader.state == "streaming"


# ── The timeouts reach OpenCV ──────────────────────────────────────────────


def test_the_open_and_read_timeouts_are_passed_to_opencv(monkeypatch):
    calls = []

    class Recorder:
        def __init__(self, *args):
            calls.append(args)

        def set(self, *args):
            return True

    import cv2
    monkeypatch.setattr(cv2, "VideoCapture", Recorder)
    camera.open_capture(STREAM, open_timeout_s=10, read_timeout_s=5)

    target, backend, params = calls[0]
    assert backend == cv2.CAP_FFMPEG
    assert params == [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000]
