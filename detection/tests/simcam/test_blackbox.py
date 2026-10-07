"""
test_blackbox.py -- block 1's "done when", checked from outside the program.

Written 2026-10-06, BEFORE any of the block 1 code (Labs4 block 1, step C1).
Intent in one sentence: the detection service runs with no screen, reads a
network camera stream, and survives that stream breaking, the way it must on a
site device with nobody watching.

These run main.py itself as a separate program, the way a service manager would,
against the simulated camera in simcam/, and judge it only by its log and its
exit. They know nothing about how the code is built, so they can't be shaped by
it. Plan: all-clear-internal docs/active/labs4_block1_plan.md, sections 4 and 6.

Skipped unless SIMCAM=1, so a plain `pytest` stays offline. To run:

    python simcam/fault.py up
    $env:SIMCAM = "1"; python -m pytest tests/simcam -v

SAFETY. The laptop's detection/.env holds production settings. Every run here
gets DEVICE_API_KEY="" (an empty value beats the file: load_dotenv never
overwrites a variable that exists) AND ALLCLEAR_API_URL pointing at a dead local
port, so even if the key got through, nothing could reach a server. Each run
first waits for main.py's own "LOCAL LOG ONLY" line and stops the program if it
doesn't appear.

THE LOG LINES THESE EXPECT (the contract, from the plan, before the code):

    Headless mode: no window            headless, said once at start
    Camera connected: <source>          each successful open; password shown as ***
    Camera stream lost                  each outage, when noticed
    Camera blind for N s                each outage, when it ends
    Connecting to camera                each open attempt
    refuses the stream                  reachable camera refusing us 3 times running
    STATUS camera=... processed=N       every STATUS_EVERY_S in headless mode
    stopped cleanly                     the last line of a clean stop
"""

import os
import re
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.parse import quote

import pytest

from simcam import fault

pytestmark = pytest.mark.skipif(
    os.getenv("SIMCAM") != "1",
    reason="needs the simulated camera: python simcam/fault.py up, then SIMCAM=1",
)

DETECTION = Path(__file__).resolve().parents[2]
WINDOWS = sys.platform == "win32"

MODEL_LOAD_S = 90        # generous: first CUDA start-up on a cold laptop is slow
READ_TIMEOUT_S = 5


def _env(**overrides) -> dict:
    env = dict(os.environ)
    env.update({
        # Safety first: see the module docstring.
        "DEVICE_API_KEY": "",
        "ALLCLEAR_API_URL": "http://127.0.0.1:9",
        "TWILIO_ACCOUNT_SID": "",
        "TWILIO_AUTH_TOKEN": "",
        # The camera, the block 1 way.
        "CAMERA_SOURCE": fault.URL,
        "CAMERA_USERNAME": fault.USERNAME,
        "CAMERA_PASSWORD": fault.PASSWORD,
        "CAMERA_TRANSPORT": "tcp",
        "CAMERA_OPEN_TIMEOUT_S": "10",
        "CAMERA_READ_TIMEOUT_S": str(READ_TIMEOUT_S),
        "HEADLESS": "true",
        "STATUS_EVERY_S": "2",
        "PYTHONUNBUFFERED": "1",
    })
    env.update(overrides)
    return env


class Run:
    """main.py as a separate program, with its output collected line by line."""

    def __init__(self, **env_overrides):
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if WINDOWS else 0
        self.started = time.monotonic()
        self.proc = subprocess.Popen(
            [sys.executable, "-u", "src/main.py"],
            cwd=DETECTION, env=_env(**env_overrides),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", creationflags=flags,
        )
        self.lines: list[tuple[float, str]] = []
        self._lock = threading.Lock()
        threading.Thread(target=self._pump, daemon=True).start()

        if not self.wait_for(r"LOCAL LOG ONLY", 60):
            self.kill()
            pytest.fail("main.py did not report LOCAL LOG ONLY; stopped it before it "
                        "could do anything. Output:\n" + self.output()[-2000:])

    def _pump(self):
        for line in self.proc.stdout:
            with self._lock:
                self.lines.append((time.monotonic(), line.rstrip("\n")))

    def output(self) -> str:
        with self._lock:
            return "\n".join(line for _, line in self.lines)

    def wait_for(self, pattern: str, timeout: float, after: float = 0.0):
        """First line matching pattern logged after time `after`, or None."""
        rx = re.compile(pattern)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            with self._lock:
                for t, line in self.lines:
                    if t >= after and rx.search(line):
                        return t, line
            if self.proc.poll() is not None:
                time.sleep(0.5)  # let the last lines arrive
                with self._lock:
                    for t, line in self.lines:
                        if t >= after and rx.search(line):
                            return t, line
                return None
            time.sleep(0.2)
        return None

    def count(self, pattern: str, after: float, before: float) -> int:
        rx = re.compile(pattern)
        with self._lock:
            return sum(1 for t, line in self.lines if after <= t <= before and rx.search(line))

    def stop(self):
        """Ask it to stop the way a person or service manager would."""
        if self.proc.poll() is not None:
            return
        if WINDOWS:
            # Ctrl+C can't be aimed at one process on Windows; Ctrl+Break can,
            # at a process group. main.py must treat it like Ctrl+C.
            self.proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            self.proc.send_signal(signal.SIGTERM)

    def kill(self):
        if self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait(10)


@pytest.fixture(scope="module", autouse=True)
def simulated_camera():
    fault.up()
    fault.ready()
    yield


@pytest.fixture
def camera_healthy():
    """Every check starts from a camera that is up and streaming."""
    try:
        fault.resume()
    except subprocess.CalledProcessError:
        pass  # wasn't paused
    fault.start_camera()
    fault.ready()
    yield


@pytest.fixture
def run(camera_healthy):
    runs = []

    def start(**env):
        r = Run(**env)
        runs.append(r)
        return r

    yield start
    for r in runs:
        r.kill()
    # Leave the camera healthy for whoever runs next.
    try:
        fault.resume()
    except subprocess.CalledProcessError:
        pass
    fault.start_camera()


def _connected(r, timeout=MODEL_LOAD_S, after=0.0):
    hit = r.wait_for(r"Camera connected", timeout, after)
    assert hit, "never logged 'Camera connected'. Output:\n" + r.output()[-3000:]
    return hit


# ── 1. Reads the stream, with no window ────────────────────────────────────


def test_1_reads_a_network_stream_with_no_window(run):
    r = run()
    assert r.wait_for(r"Headless mode: no window", MODEL_LOAD_S), (
        "headless mode never announced itself. Output:\n" + r.output()[-3000:]
    )
    _connected(r)
    status = r.wait_for(r"STATUS .*processed=([1-9]\d+)", 20)
    assert status, "connected but never reported processing frames:\n" + r.output()[-3000:]


# ── 2. A stream that stops, then comes back ────────────────────────────────


def test_2_a_stream_that_ends_is_noticed_and_comes_back(run):
    r = run()
    _connected(r)

    fault.stop_stream()
    broke_at = time.monotonic()
    lost = r.wait_for(r"Camera stream lost", READ_TIMEOUT_S + 10, after=broke_at)
    assert lost, "the stream ended and the program never said so:\n" + r.output()[-3000:]

    fault.start_stream()
    back = r.wait_for(r"Camera blind for \d+", 60, after=lost[0])
    assert back, "the stream came back and the program never reconnected:\n" + r.output()[-3000:]


# ── 3. The hang: connected, nothing arriving ───────────────────────────────


def test_3_a_hung_stream_is_noticed_within_the_read_timeout(run):
    r = run()
    _connected(r)

    fault.pause()
    hung_at = time.monotonic()
    lost = r.wait_for(r"Camera stream lost", READ_TIMEOUT_S + 10, after=hung_at)
    # OpenCV's own default would wait ~30 s; the read timeout must win.
    assert lost, "a hung stream went unnoticed:\n" + r.output()[-3000:]
    assert lost[0] - hung_at <= READ_TIMEOUT_S + 4, (
        f"noticed after {lost[0] - hung_at:.1f} s; the read timeout is {READ_TIMEOUT_S} s"
    )

    time.sleep(max(0.0, 20 - (time.monotonic() - hung_at)))
    fault.resume()
    back = r.wait_for(r"Camera blind for (\d+)", 60, after=lost[0])
    assert back, "never recovered after the hang:\n" + r.output()[-3000:]
    # Proof the fault really happened: a 20 s hang must show as about 20 s blind.
    blind = int(re.search(r"Camera blind for (\d+)", back[1]).group(1))
    assert blind >= 15, f"reported blind for only {blind} s during a 20 s hang"


# ── 4. No camera at start: wait for it, don't exit ─────────────────────────


def test_4_starts_without_a_camera_and_connects_when_it_appears(run):
    fault.stop_camera()
    r = run()
    time.sleep(25)
    assert r.proc.poll() is None, (
        f"exited (code {r.proc.returncode}) because the camera wasn't there yet; "
        "after a power cut that leaves the site unwatched:\n" + r.output()[-3000:]
    )
    assert not r.count(r"Camera connected", 0, time.monotonic()), "connected to a camera that was off?"

    fault.start_camera()
    _connected(r, timeout=60)


# ── 5. Stops cleanly when asked ────────────────────────────────────────────


def test_5_stops_cleanly_when_asked(run):
    r = run()
    _connected(r)
    r.stop()
    try:
        r.proc.wait(15)
    except subprocess.TimeoutExpired:
        pytest.fail("still running 15 s after being asked to stop:\n" + r.output()[-3000:])
    assert r.wait_for(r"stopped cleanly", 2), "no clean-shutdown line:\n" + r.output()[-3000:]
    assert r.proc.returncode == 0, f"exit code {r.proc.returncode}, expected 0"


# ── 6. Wrong password: don't hammer the camera ─────────────────────────────


def test_6_a_refused_login_backs_off_instead_of_hammering(run):
    wrong = "wrongPass5182"
    r = run(CAMERA_PASSWORD=wrong, CAMERA_REFUSED_WAIT_S="60")
    refused = r.wait_for(r"refuses the stream", MODEL_LOAD_S + 30)
    assert refused, "never reported the camera refusing us:\n" + r.output()[-3000:]
    assert re.search(r"password|path", refused[1], re.I), (
        "the refusal message must point at the likely causes: " + refused[1]
    )

    time.sleep(30)
    attempts = r.count(r"Connecting to camera", refused[0] + 0.5, time.monotonic())
    assert attempts == 0, (
        f"{attempts} more login attempts within 30 s of being refused; a camera "
        "can lock its account after repeated failures"
    )
    out = r.output()
    assert wrong not in out and quote(wrong, safe="") not in out, "the wrong password was logged"


# ── 7. The password never reaches the log ──────────────────────────────────


def test_7_the_camera_password_never_appears_in_the_output(run):
    r = run()
    _connected(r)
    fault.stop_stream()
    r.wait_for(r"Camera stream lost", READ_TIMEOUT_S + 10, after=time.monotonic() - 1)
    fault.start_stream()
    r.wait_for(r"Camera blind for", 60)
    r.stop()
    try:
        r.proc.wait(15)
    except subprocess.TimeoutExpired:
        r.kill()

    out = r.output()
    assert "Camera connected" in out, "never connected, so this checked nothing:\n" + out[-3000:]
    for form in (fault.PASSWORD, quote(fault.PASSWORD, safe="")):
        assert form not in out, f"the camera password appeared in the output as {form!r}"
