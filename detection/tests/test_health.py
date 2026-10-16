"""
test_health.py -- the heartbeat and the log say whether the device is watching, and why not.

Written 2026-10-16, BEFORE the code (Labs4 block 1, step C6). Intent in one
sentence: "online" means the model looked at a camera frame in the last 10 s;
anything else is "degraded" with the reason, and both the heartbeat and the log
say so.

Plan §4.5 and the C6 step; OPEN_ITEMS 17.7, layer 1. What each group protects:
  - judged by the age of the newest frame, not the reader's state: a read that
    hangs forever (a webcam driver has no timeout) leaves the state at
    "streaming" while nothing arrives. Frame age can't be fooled that way.
  - the reason: "degraded" alone doesn't say what to fix. A wrong password needs
    someone to type the right one; an unplugged camera needs a walk to the trailer.
  - a short blip doesn't flip the status: 10 s of grace.
  - before the first frame nothing is being watched, so start-up is "degraded".
  - the camera sending isn't enough: a loop stuck on something else isn't
    watching either, so the model has to have looked.
  - the heartbeat carries all of it. The server accepts the status and drops the
    rest today (plan §4.5), so storing it later is a server change only.
  - in headless, one STATUS line every STATUS_EVERY_S, including while blind,
    and no DETECTED line per frame: the unattended log stays readable (G10, D3).
"""

import json
import logging
import re
import signal
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from api_client import AllClearClient
from camera import HEALTH_GRACE_S, CameraSource, FrameReader, Health
from tests.camera_fakes import FakeCamera, FakeTime, Opener, img, no_jitter, wait_until
from tests.test_loop import DETECTION, FakeDetector, FakeReader, _safe_env, main  # noqa: F401 (main is a fixture)

STREAM = CameraSource("stream", "rtsp://192.168.1.50:554/sub")
NOT_A_REAL_KEY = "ac_dev_test_not_a_real_key"


@pytest.fixture
def make():
    """A reader on fake time; every reader is stopped when the test ends."""
    readers = []

    def build(source, opener, *, probe=lambda host, port: True, t=None, **kwargs):
        t = t or FakeTime()
        reader = FrameReader(source, open_capture=opener, probe=probe, wait=t.wait,
                             clock=t.clock, rand=no_jitter, **kwargs)
        readers.append((reader, opener))
        return reader.start(), t

    yield build
    for reader, opener in readers:
        opener.wake_all()
        reader.stop()


def reason_is(reader, reason):
    return lambda: reader.health().reason == reason


# ── 1. The reader's view: is a camera frame arriving? ──────────────────────


def test_frames_arriving_is_online(make):
    reader, _ = make(STREAM, Opener(FakeCamera([img(1), img(2)], then="hang", hang=30)))
    wait_until(lambda: reader.stats["received"] == 2)
    h = reader.health()
    assert (h.status, h.reason) == ("online", None)


def test_a_read_that_never_returns_is_degraded_though_the_state_says_streaming(make):
    reader, t = make(STREAM, Opener(FakeCamera([img(1)], then="hang", hang=30)))
    wait_until(lambda: reader.stats["received"] == 1)

    t.now += HEALTH_GRACE_S + 1          # time passes; the read is still stuck
    assert reader.state == "streaming", "the trap: the reader's own state still says all is well"
    h = reader.health()
    assert (h.status, h.reason) == ("degraded", "stalled")
    assert h.age_s >= HEALTH_GRACE_S


def test_a_blip_shorter_than_the_grace_stays_online(make):
    reader, t = make(STREAM, Opener(FakeCamera([img(1)], then="hang", hang=30)))
    wait_until(lambda: reader.stats["received"] == 1)
    t.now += HEALTH_GRACE_S - 1
    assert reader.health().status == "online"


def test_still_connecting_for_the_first_time_is_degraded(make):
    gate = threading.Event()
    opener = Opener(FakeCamera([img(1)], then="hang", hang=30), on_open=lambda: gate.wait(5))
    reader, _ = make(STREAM, opener)
    try:
        wait_until(lambda: opener.opens == 1)
        h = reader.health()
        assert (h.status, h.reason) == ("degraded", "connecting"), "nothing is watched yet"
    finally:
        gate.set()


def test_nothing_answering_says_unreachable(make):
    reader, _ = make(STREAM, Opener(), probe=lambda host, port: False)
    wait_until(reason_is(reader, "unreachable"))
    assert reader.health().status == "degraded"


def test_answering_but_refusing_says_refused(make):
    # The address takes a connection, and the open fails at once: most likely the login.
    reader, _ = make(STREAM, Opener())
    wait_until(reason_is(reader, "refused"))


def test_answering_too_slowly_to_open_says_no_answer(make):
    t = FakeTime()
    slow = Opener(on_open=lambda: setattr(t, "now", t.now + 10))   # each open takes 10 s
    reader, _ = make(STREAM, slow, t=t, open_timeout_s=10)
    wait_until(reason_is(reader, "no_answer"))


def test_opening_but_sending_nothing_says_no_frames(make):
    reader, _ = make(STREAM, Opener(*[FakeCamera([]) for _ in range(200)]))
    wait_until(reason_is(reader, "no_frames"))


def test_a_lost_stream_says_why_and_is_online_again_when_it_comes_back(make):
    back = threading.Event()
    probes = {"n": 0}

    def probe(_host, _port):
        probes["n"] += 1
        return probes["n"] == 1 or back.is_set()      # answers once, then not until `back`

    first = FakeCamera([img(1), img(2)])              # streams, then the stream ends
    second = FakeCamera([img(3)], then="hang", hang=30)
    reader, _ = make(STREAM, Opener(first, second), probe=probe)

    # Backoff waits move the fake clock past the grace: blind, and why.
    wait_until(reason_is(reader, "unreachable"))
    assert reader.health().status == "degraded"

    back.set()
    wait_until(lambda: reader.health().status == "online")
    assert reader.health().reason is None


# ── 2. The device's view: is the model looking? (main.Watching) ────────────


class Clock:
    def __init__(self, now=100.0):
        self.now = now

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class StubReader:
    def __init__(self, health):
        self.current = health

    def health(self, grace_s=HEALTH_GRACE_S):
        return self.current


def test_while_the_model_loads_the_device_is_starting(main):
    w = main.Watching(clock=Clock())
    assert w.heartbeat_fields() == {"status": "degraded", "reason": "starting", "blind_seconds": 0}


def test_online_sends_only_the_status(main):
    w = main.Watching(clock=Clock())
    w.attach(StubReader(Health("online", None, 0.1)))
    w.processed()
    assert w.heartbeat_fields() == {"status": "online"}


def test_a_blind_camera_gives_its_own_reason(main):
    w = main.Watching(clock=Clock())
    w.attach(StubReader(Health("degraded", "refused", 312.4)))
    assert w.heartbeat_fields() == {"status": "degraded", "reason": "refused", "blind_seconds": 312}


def test_the_camera_sending_is_not_enough_the_model_must_be_looking(main):
    clock = Clock()
    w = main.Watching(clock=clock)
    w.attach(StubReader(Health("online", None, 0.1)))
    w.processed()
    assert w.health().status == "online"

    clock.advance(HEALTH_GRACE_S + 5)     # frames still arriving; the loop is stuck elsewhere
    h = w.health()
    assert (h.status, h.reason) == ("degraded", "not_processing")
    assert w.heartbeat_fields()["blind_seconds"] == HEALTH_GRACE_S + 5


# ── 3. The heartbeat carries it to the server ──────────────────────────────


@pytest.fixture
def fake_api():
    """A local stand-in for the All Clear API that accepts everything and keeps
    each heartbeat body. Nothing here can reach a real server."""
    bodies = []

    class Accepts(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            if self.path.endswith("/devices/heartbeat"):
                bodies.append(body)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok": true}')

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Accepts)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}", bodies
    server.shutdown()


def test_the_heartbeat_sends_what_health_says_each_time(fake_api):
    url, bodies = fake_api
    said = iter([{"status": "degraded", "reason": "unreachable", "blind_seconds": 40}]
                + [{"status": "online"}] * 1000)
    client = AllClearClient(url, NOT_A_REAL_KEY)
    client.start_heartbeat(0.05, health=lambda: next(said))
    try:
        wait_until(lambda: len(bodies) >= 2)
    finally:
        client.close()
    assert bodies[0] == {"status": "degraded", "reason": "unreachable", "blind_seconds": 40}
    assert bodies[1] == {"status": "online"}


def test_a_health_check_that_breaks_says_error_not_online(fake_api, caplog):
    url, bodies = fake_api
    caplog.set_level(logging.ERROR)

    def broken():
        raise RuntimeError("a bug in the health check")

    client = AllClearClient(url, NOT_A_REAL_KEY)
    client.start_heartbeat(0.05, health=broken)
    try:
        wait_until(lambda: len(bodies) >= 2)
        assert client.heartbeat_alive(), "a broken check must not kill the heartbeat"
    finally:
        client.close()
    assert bodies[0] == {"status": "error"}
    assert any("health" in r.getMessage().lower() and r.exc_info for r in caplog.records)


def test_the_key_check_at_start_does_not_claim_to_be_watching(fake_api):
    url, bodies = fake_api
    client = AllClearClient(url, NOT_A_REAL_KEY)
    try:
        client.verify_key()
    finally:
        client.close()
    assert bodies == [{"status": "degraded", "reason": "starting"}]


# ── 4. The log, unattended: STATUS lines, quieter DETECTED ─────────────────


class Reader(FakeReader):
    """test_loop's fake camera, with the health and counts the STATUS line reads."""

    def __init__(self, count, *, health=Health("online", None, 0.1), **kwargs):
        super().__init__(count, **kwargs)
        self._health = health

    def health(self, grace_s=HEALTH_GRACE_S):
        return self._health

    @property
    def stats(self):
        return {"received": self._seq, "delivered": self._seq, "skipped": 0}


class BlindReader(Reader):
    """No frames at all: each wait for one takes a second, and after `polls` it ends."""

    def __init__(self, clock, polls, health):
        super().__init__(0, health=health)
        self._clock = clock
        self._polls = polls

    def next_frame(self, timeout):
        self._clock.advance(1.0)
        self._polls -= 1
        self.finished = self._polls <= 0
        return None


def loop(main, reader, detector, *, headless, clock, every=2):
    from debounce import ViolationTracker
    watching = main.Watching(clock=clock)
    watching.attach(reader)
    return main.detection_loop(
        reader, detector, ViolationTracker(debounce_frames=5, cooldown_seconds=60),
        client=None, queue=None, stop=threading.Event(), headless=headless, watched={},
        watching=watching, status_every_s=every, clock=clock,
    )


def status_lines(caplog):
    return [r.getMessage() for r in caplog.records if r.getMessage().startswith("STATUS ")]


def test_headless_says_status_every_status_every_s(main, caplog):
    caplog.set_level(logging.INFO)
    clock = Clock()
    detector = FakeDetector(on_predict=lambda n: clock.advance(0.5))   # each frame takes 0.5 s

    assert loop(main, Reader(20), detector, headless=True, clock=clock) == "finished"

    lines = status_lines(caplog)
    assert len(lines) >= 4, lines
    for line in lines:
        assert "camera=online" in line and "reason=" not in line, line
        assert re.search(r"\bprocessed=4\b", line), line      # 2 s at 2 frames a second
        assert re.search(r"\bfps=2\.0\b", line), line


def test_the_status_line_keeps_coming_while_the_camera_is_blind(main, caplog):
    caplog.set_level(logging.INFO)
    clock = Clock()
    blind = BlindReader(clock, polls=12, health=Health("degraded", "unreachable", 42.0))

    assert loop(main, blind, FakeDetector(), headless=True, clock=clock) == "finished"

    lines = status_lines(caplog)
    assert len(lines) >= 4, lines
    for line in lines:
        assert "camera=degraded reason=unreachable" in line, line
        assert re.search(r"\bprocessed=0\b", line) and re.search(r"\bblind_s=42\b", line), line


def test_with_a_window_there_is_no_status_line(main, caplog, monkeypatch):
    import cv2
    monkeypatch.setattr(cv2, "imshow", lambda *a: None)
    monkeypatch.setattr(cv2, "waitKey", lambda _ms: -1)
    caplog.set_level(logging.INFO)
    clock = Clock()
    detector = FakeDetector(on_predict=lambda n: clock.advance(0.5))

    loop(main, Reader(20), detector, headless=False, clock=clock)
    assert status_lines(caplog) == [], "the window shows this already; the laptop demo is unchanged"


@pytest.mark.parametrize("headless, level", [(True, logging.DEBUG), (False, logging.INFO)])
def test_detected_is_debug_headless_and_info_with_a_window(main, caplog, monkeypatch, headless, level):
    import cv2
    monkeypatch.setattr(cv2, "imshow", lambda *a: None)
    monkeypatch.setattr(cv2, "waitKey", lambda _ms: -1)
    caplog.set_level(logging.DEBUG)
    detector = FakeDetector(violations=[{"violation_type": "NO-Hardhat", "confidence": 0.91}])

    loop(main, Reader(3), detector, headless=headless, clock=Clock())
    detected = [r for r in caplog.records if r.getMessage().startswith("DETECTED")]
    assert len(detected) == 3
    assert {r.levelno for r in detected} == {level}


def test_log_level_is_a_setting_and_a_wrong_one_doesnt_stop_the_device(main):
    decide = main.decide_log_level
    assert decide(None) == (logging.INFO, None)
    assert decide("") == (logging.INFO, None)
    assert decide("debug") == (logging.DEBUG, None)
    level, problem = decide("loud")
    assert level == logging.INFO, "a log setting is not a reason to stop watching"
    assert problem and "loud" in problem


# ── 5. From outside the program ────────────────────────────────────────────


def test_from_outside_the_server_hears_why_the_camera_is_blind(tmp_path, fake_api):
    """main.py itself, with a camera address nothing answers at, reporting to the
    local fake API. Only that fake server is ever addressed (asserted below)."""
    url, bodies = fake_api
    env = _safe_env(tmp_path, DEVICE_API_KEY=NOT_A_REAL_KEY, ALLCLEAR_API_URL=url,
                    CAMERA_SOURCE="rtsp://127.0.0.1:9/nothing-here",
                    HEARTBEAT_SECONDS="1", STATUS_EVERY_S="2")
    windows = sys.platform == "win32"
    proc = subprocess.Popen(
        [sys.executable, "-u", "src/main.py"], cwd=DETECTION, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8",
        errors="replace", creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if windows else 0,
    )
    out = []
    threading.Thread(target=lambda: out.extend(proc.stdout), daemon=True).start()

    def heard():
        text = "".join(out)
        return (any(b.get("reason") == "unreachable" for b in bodies)
                and re.search(r"STATUS camera=degraded reason=unreachable", text))

    try:
        deadline = time.monotonic() + 180       # includes loading the model
        while time.monotonic() < deadline and proc.poll() is None and not heard():
            time.sleep(0.5)
    finally:
        if proc.poll() is None:
            proc.send_signal(signal.CTRL_BREAK_EVENT if windows else signal.SIGINT)
            try:
                proc.wait(60)
            except subprocess.TimeoutExpired:
                proc.kill()
    text = "".join(out)

    assert f"API → {url}" in text, "must report only to the local fake server:\n" + text[-2000:]
    assert bodies, "no heartbeat reached the server:\n" + text[-2000:]
    assert bodies[0] == {"status": "degraded", "reason": "starting"}, bodies[:3]
    blind = [b for b in bodies if b.get("reason") == "unreachable"]
    assert blind and blind[-1]["status"] == "degraded", bodies[-5:]
    assert not [b for b in bodies if b["status"] == "online"], \
        "the camera never connected, so 'online' would be a lie"
    assert re.search(r"STATUS camera=degraded reason=unreachable", text), text[-2000:]
