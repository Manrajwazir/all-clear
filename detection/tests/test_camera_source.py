"""
test_camera_source.py -- which camera to read, and the password never shown.

Written 2026-10-08, BEFORE the code (Labs4 block 1, step C2). Intent in one
sentence: the camera is chosen in detection/.env, not by editing Python, and
its password can be used to connect but never appears in anything printed.

Today CAMERA_INDEX = 0 is the one setting in main.py not read from .env
(main.py:80), so pointing the service at an IP camera means editing source.

No camera, no network: these only parse settings. The one subprocess check
(a missing video file stops start-up) runs main.py in local-only mode against a
dead API address, like the simcam checks.
"""

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

import pytest

from camera import CameraConfigError, CameraSource, configure_capture_logging

DETECTION = Path(__file__).resolve().parent.parent
PASSWORD = "p@ss:w/rd#1"            # every character that means something in a URL


def src(**env):
    return CameraSource.from_env(env)


# ── Which camera ──────────────────────────────────────────────────────────


def test_nothing_set_means_the_laptop_webcam_as_today():
    s = src()
    assert s.kind == "webcam" and s.open_target() == 0


def test_empty_means_the_laptop_webcam():
    assert src(CAMERA_SOURCE="").open_target() == 0
    assert src(CAMERA_SOURCE="  ").open_target() == 0


def test_a_number_is_a_webcam():
    s = src(CAMERA_SOURCE="1")
    assert s.kind == "webcam" and s.open_target() == 1


def test_an_rtsp_address_is_a_network_camera():
    s = src(CAMERA_SOURCE="rtsp://192.168.1.50:554/h264Preview_01_sub")
    assert s.kind == "stream"
    assert s.open_target() == "rtsp://192.168.1.50:554/h264Preview_01_sub"
    assert (s.host, s.port) == ("192.168.1.50", 554)


def test_the_rtsp_port_defaults_to_554():
    assert src(CAMERA_SOURCE="rtsp://cam/x").port == 554


def test_an_existing_file_is_a_recording(tmp_path):
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"x")
    s = src(CAMERA_SOURCE=str(clip))
    assert s.kind == "file" and Path(s.open_target()) == clip


def test_a_missing_file_is_a_configuration_error(tmp_path):
    with pytest.raises(CameraConfigError):
        src(CAMERA_SOURCE=str(tmp_path / "nope.mp4"))


def test_an_unsupported_address_is_a_configuration_error():
    with pytest.raises(CameraConfigError):
        src(CAMERA_SOURCE="ftp://cam/x")


# ── The login ─────────────────────────────────────────────────────────────


def test_the_login_is_added_to_the_address_encoded():
    s = src(CAMERA_SOURCE="rtsp://192.168.1.50:554/sub",
            CAMERA_USERNAME="admin", CAMERA_PASSWORD=PASSWORD)
    target = s.open_target()
    parts = urlsplit(target)
    # Each special character encoded, so the address still parses: the host is
    # the camera, not something after a stray '@'.
    assert parts.hostname == "192.168.1.50" and parts.port == 554
    assert unquote(parts.username) == "admin"
    assert unquote(parts.password) == PASSWORD
    assert quote(PASSWORD, safe="") in target


def test_a_login_inside_the_address_is_refused():
    """The password goes in CAMERA_PASSWORD, where the code can keep it out of
    the log; one typed into the address would be printed wherever it is."""
    with pytest.raises(CameraConfigError) as err:
        src(CAMERA_SOURCE="rtsp://admin:hunter2@cam/x")
    assert "hunter2" not in str(err.value)


def test_a_login_for_a_webcam_is_ignored():
    assert src(CAMERA_SOURCE="0", CAMERA_PASSWORD="x").open_target() == 0


# ── Never shown ───────────────────────────────────────────────────────────


@pytest.mark.parametrize("show", [str, repr, lambda s: f"{s}", lambda s: s.display])
def test_the_password_never_appears_in_anything_printable(show):
    s = src(CAMERA_SOURCE="rtsp://192.168.1.50/sub",
            CAMERA_USERNAME="admin", CAMERA_PASSWORD=PASSWORD)
    shown = show(s)
    assert PASSWORD not in shown and quote(PASSWORD, safe="") not in shown
    assert "192.168.1.50" in shown, "the printable form must still say which camera"


def test_the_printable_form_marks_that_a_password_exists():
    s = src(CAMERA_SOURCE="rtsp://cam/x", CAMERA_USERNAME="admin", CAMERA_PASSWORD=PASSWORD)
    assert "admin:***@" in s.display


# ── Transport ─────────────────────────────────────────────────────────────


def test_transport_defaults_to_tcp():
    assert src(CAMERA_SOURCE="rtsp://cam/x").transport == "tcp"


def test_an_unknown_transport_is_a_configuration_error():
    with pytest.raises(CameraConfigError):
        src(CAMERA_SOURCE="rtsp://cam/x", CAMERA_TRANSPORT="carrier-pigeon")


def test_capture_settings_reach_ffmpeg(monkeypatch):
    """OpenCV hands FFmpeg its options through environment variables, read
    when a camera is opened."""
    for name in ("OPENCV_FFMPEG_CAPTURE_OPTIONS", "OPENCV_FFMPEG_LOGLEVEL"):
        monkeypatch.delenv(name, raising=False)
    configure_capture_logging(src(CAMERA_SOURCE="rtsp://cam/x"))
    assert os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] == "rtsp_transport;tcp"
    # FFmpeg's errors (they name the cause: 401, 404) stay; its chatter goes.
    assert os.environ["OPENCV_FFMPEG_LOGLEVEL"] == "16"


# ── Start-up refuses a bad setting ────────────────────────────────────────


def test_main_stops_at_start_up_on_a_bad_camera_setting(tmp_path):
    env = dict(os.environ)
    env.update({
        "DEVICE_API_KEY": "",                       # local-only
        "ALLCLEAR_API_URL": "http://127.0.0.1:9",   # and nowhere to send anyway
        "CAMERA_SOURCE": str(tmp_path / "missing.mp4"),
        "PYTHONUNBUFFERED": "1",
    })
    result = subprocess.run(
        [sys.executable, "src/main.py"], cwd=DETECTION, env=env,
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180,
    )
    out = result.stdout + result.stderr
    assert "LOCAL LOG ONLY" in out, "safety: main.py was not in local-only mode"
    assert result.returncode == 4, (
        f"exit {result.returncode}; a bad camera setting must stop start-up with "
        f"code 4 (bad configuration, do not restart). Output:\n{out[-2000:]}"
    )
    assert "Loading PPE model" not in out, "it should stop before loading the model"
