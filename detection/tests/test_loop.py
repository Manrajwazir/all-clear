"""
test_loop.py -- no screen, a clean stop, and an exit code that tells the truth.

Written 2026-10-12, BEFORE the code (Labs4 block 1, step C5). Intent in one
sentence: with no screen the program runs exactly as with one, it stops cleanly
when asked, and when it does stop, its exit code tells a service manager whether
to restart it.

Plan §4.4. What each check protects:
  - headless never calls a window function: on a Jetson with no screen,
    cv2.imshow throws and the program dies (G6).
  - window mode still quits on q: the laptop demo is unchanged.
  - the stop flag ends the loop after the current frame: a service manager's
    stop must not kill a send halfway, or skip the shutdown (G7).
  - a dead reader, replay or heartbeat thread exits 1: otherwise the program
    looks alive and watches nothing, or sits on undelivered events.
  - a thread dying of an error reaches the log, not just the console.
  - D4: the model failing on one frame skips it; 10 in a row exits 1.
  - exit codes: 0 stopped or finished, 1 crashed (restart), 3 key rejected and
    4 bad configuration (don't restart) (G9).

main.py is imported with .env loading switched off, so this process never holds
the laptop's production settings.
"""

import importlib
import http.server
import logging
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest

from camera import Frame

DETECTION = Path(__file__).resolve().parents[1]


@pytest.fixture
def main(monkeypatch):
    """main.py, imported without reading detection/.env, in local-only mode."""
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: False)
    for name in ("DEVICE_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"):
        monkeypatch.setenv(name, "")
    sys.modules.pop("main", None)
    module = importlib.import_module("main")
    yield module
    sys.modules.pop("main", None)


def frame(n):
    return Frame(np.zeros((8, 8, 3), dtype=np.uint8), n, datetime.now(timezone.utc), float(n))


class FakeReader:
    def __init__(self, count, *, ends=True):
        self._left = count
        self._seq = 0
        self._ends = ends
        self.finished = False

    def next_frame(self, timeout):
        if self._left == 0:
            self.finished = self._ends
            self._empty = getattr(self, "_empty", 0) + 1
            if self._empty > 200:
                # Bounded: a loop that never stops must fail the check, not hang it.
                raise AssertionError("the loop never stopped")
            return None
        self._left -= 1
        self._seq += 1
        return frame(self._seq)

    def is_alive(self):
        return True


class FakeResult:
    def __init__(self, on_plot=None):
        self._on_plot = on_plot

    def plot(self):
        if self._on_plot:
            self._on_plot()
        return np.zeros((8, 8, 3), dtype=np.uint8)


class FakeDetector:
    def __init__(self, *, fails=(), violations=(), on_predict=None, on_plot=None):
        self.fails = set(fails)            # which predict calls (from 1) raise
        self.violations = list(violations)
        self.on_predict = on_predict
        self.on_plot = on_plot
        self.predicts = 0
        self.finds = 0

    def predict(self, image, confidence):
        self.predicts += 1
        if self.on_predict:
            self.on_predict(self.predicts)
        if self.predicts in self.fails:
            raise RuntimeError("CUDA error: device-side assert triggered")
        return [FakeResult(self.on_plot)]

    def find_violations(self, result):
        self.finds += 1
        return list(self.violations)


def run(main, reader, detector, *, headless=True, stop=None, watched=None):
    from debounce import ViolationTracker
    return main.detection_loop(
        reader, detector, ViolationTracker(debounce_frames=5, cooldown_seconds=60),
        client=None, queue=None, stop=stop or threading.Event(),
        headless=headless, watched=watched or {},
    )


# ── Headless, and the window ───────────────────────────────────────────────


def test_headless_never_touches_a_window(main, monkeypatch):
    import cv2

    def no_screen(*_args, **_kwargs):
        raise AssertionError("a window function was called with no screen")

    for name in ("imshow", "waitKey", "namedWindow", "destroyAllWindows"):
        monkeypatch.setattr(cv2, name, no_screen)
    detector = FakeDetector(on_plot=lambda: no_screen())   # drawing is wasted work too

    assert run(main, FakeReader(3), detector, headless=True) == "finished"
    assert detector.predicts == 3 and detector.finds == 3, "the model must still see every frame"


def test_window_mode_still_quits_on_q(main, monkeypatch):
    import cv2
    shown = []
    monkeypatch.setattr(cv2, "imshow", lambda *a: shown.append(a[0]))
    monkeypatch.setattr(cv2, "waitKey", lambda _ms: ord("q"))

    assert run(main, FakeReader(5, ends=False), FakeDetector(), headless=False) == "stopped"
    assert len(shown) == 1


def test_headless_is_chosen_by_setting_or_by_having_no_screen(main):
    decide = main.decide_headless
    assert decide({"HEADLESS": "true"}, "win32") is True
    assert decide({"HEADLESS": "false"}, "linux") is False
    assert decide({}, "win32") is False, "the laptop demo keeps its window"
    assert decide({}, "linux") is True, "a Linux box with no screen must not crash on imshow"
    assert decide({"DISPLAY": ":0"}, "linux") is False
    with pytest.raises(ValueError):
        decide({"HEADLESS": "maybe"}, "linux")


# ── Stopping ───────────────────────────────────────────────────────────────


def test_the_stop_flag_ends_the_loop_after_the_frame_in_hand(main):
    stop = threading.Event()
    detector = FakeDetector(on_predict=lambda n: stop.set() if n == 2 else None)

    assert run(main, FakeReader(100, ends=False), detector, stop=stop) == "stopped"
    assert detector.predicts == 2
    assert detector.finds == 2, "the frame being worked on when the stop came must be finished"


def test_a_stop_signal_raises_the_flag_and_a_second_one_forces_the_exit(main):
    stop = threading.Event()
    exits = []
    handler = main.make_stop_handler(stop, force_exit=exits.append)

    handler(2, None)
    assert stop.is_set() and exits == [], "the first signal only asks"
    handler(2, None)
    assert exits == [1], "a second signal means something is stuck: get out now"


# ── Threads that die ───────────────────────────────────────────────────────


@pytest.mark.parametrize("name", ["camera reader", "replay", "heartbeat"])
def test_a_dead_thread_exits_1_so_it_gets_restarted(main, caplog, name):
    caplog.set_level(logging.ERROR)
    with pytest.raises(SystemExit) as ended:
        run(main, FakeReader(100, ends=False), FakeDetector(), watched={name: lambda: False})
    assert ended.value.code == 1
    assert any(name in r.getMessage() and "died" in r.getMessage() for r in caplog.records)


def test_a_thread_dying_of_an_error_reaches_the_log(main, caplog):
    caplog.set_level(logging.ERROR)
    main.install_thread_death_logging()

    def broken():
        raise RuntimeError("replay bug")

    t = threading.Thread(target=broken, name="allclear-replay")
    t.start()
    t.join()

    died = [r for r in caplog.records if "allclear-replay" in r.getMessage()]
    assert died and died[0].exc_info, "the error and its traceback must be in the log"


# ── The model failing (decision D4) ────────────────────────────────────────


def test_one_bad_frame_is_skipped(main, caplog):
    caplog.set_level(logging.ERROR)
    detector = FakeDetector(fails={2})
    assert run(main, FakeReader(5), detector) == "finished"
    assert detector.predicts == 5
    assert any("Model failed" in r.getMessage() for r in caplog.records)


def test_ten_model_failures_in_a_row_exit_1(main):
    detector = FakeDetector(fails=set(range(1, 100)))
    with pytest.raises(SystemExit) as ended:
        run(main, FakeReader(100, ends=False), detector)
    assert ended.value.code == 1
    assert detector.predicts == 10


def test_a_good_frame_resets_the_count(main):
    fails = set(range(1, 10)) | set(range(11, 20))     # 9 bad, 1 good, 9 bad
    assert run(main, FakeReader(19), FakeDetector(fails=fails)) == "finished"


# ── Exit codes, from outside the program ───────────────────────────────────


def _safe_env(tmp_path, **extra):
    env = dict(os.environ)
    env.update({
        "DEVICE_API_KEY": "", "ALLCLEAR_API_URL": "http://127.0.0.1:9",
        "TWILIO_ACCOUNT_SID": "", "TWILIO_AUTH_TOKEN": "", "HEADLESS": "true",
        "QUEUE_DB_PATH": str(tmp_path / "queue.db"),
        "QUEUE_IMAGE_DIR": str(tmp_path / "queue_images"),
        "PYTHONUNBUFFERED": "1",
    })
    env.update(extra)
    return env


def test_a_rejected_device_key_exits_3(tmp_path):
    class Rejects(http.server.BaseHTTPRequestHandler):
        def _no(self):
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": "unknown device key"}')
        do_GET = do_POST = _no

        def log_message(self, *_):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Rejects)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        env = _safe_env(tmp_path, DEVICE_API_KEY="ac_dev_test_not_a_real_key",
                        ALLCLEAR_API_URL=f"http://127.0.0.1:{server.server_port}")
        r = subprocess.run([sys.executable, "src/main.py"], cwd=DETECTION, env=env,
                           capture_output=True, text=True, timeout=120)
    finally:
        server.shutdown()
    out = r.stdout + r.stderr
    assert "REJECTED" in out, out[-2000:]
    assert r.returncode == 3, f"exit {r.returncode}: a rejected key must say 'don't restart'"


def test_a_video_file_that_cant_be_read_exits_4(tmp_path):
    not_a_video = tmp_path / "notes.mp4"
    not_a_video.write_text("this is not a video")
    env = _safe_env(tmp_path, CAMERA_SOURCE=str(not_a_video))
    r = subprocess.run([sys.executable, "src/main.py"], cwd=DETECTION, env=env,
                       capture_output=True, text=True, timeout=180)
    out = r.stdout + r.stderr
    assert "LOCAL LOG ONLY" in out, out[-2000:]
    assert r.returncode == 4, f"exit {r.returncode}; output:\n{out[-2000:]}"


# ── C5 review, 2026-10-13: a bad model file, and an SMS that hangs ─────────


@pytest.mark.parametrize("problem", ["missing", "corrupt"])
def test_a_model_file_that_cant_be_loaded_exits_4(tmp_path, problem):
    """A bad model file can't fix itself: exit 4, don't restart. It used to exit 1,
    which systemd would restart forever."""
    model = tmp_path / "ppe.pt"
    if problem == "corrupt":
        model.write_bytes(b"not a model at all")
    env = _safe_env(tmp_path, MODEL_PATH=str(model))
    r = subprocess.run([sys.executable, "src/main.py"], cwd=DETECTION, env=env,
                       capture_output=True, text=True, timeout=180)
    out = r.stdout + r.stderr
    assert "LOCAL LOG ONLY" in out, out[-2000:]
    assert r.returncode == 4, f"exit {r.returncode}; output:\n{out[-2000:]}"
    assert "model" in out.lower()


def test_the_sms_call_gives_up_instead_of_hanging(monkeypatch):
    """Twilio's client has no timeout by default (checked 2026-10-13). A hung SMS
    would hold the loop, and a clean stop could never finish."""
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: False)
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest_not_a_real_account")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "not_a_real_token")
    sys.modules.pop("alerts", None)
    import alerts
    try:
        client = alerts.get_twilio_client()
        assert client.http_client.timeout is not None, "no timeout: an SMS could hang forever"
        assert client.http_client.timeout <= 15
    finally:
        sys.modules.pop("alerts", None)
