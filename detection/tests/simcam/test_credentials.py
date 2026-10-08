"""
test_credentials.py -- a real login against the simulated camera.

Written 2026-10-08, BEFORE the code (Labs4 block 1, step C2). Intent: a
password with URL-special characters really logs in once CameraSource encodes
it, and when a login fails, the output says why (401, 404) without showing the
password.

The unit tests in tests/test_camera_source.py prove the address is built
right. Only a real RTSP server proves FFmpeg reads it the same way.

Skipped unless SIMCAM=1. The sim's mediamtx.yml has a second user, "special",
whose password is SPECIAL_PASSWORD below.
"""

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

import pytest

from simcam import fault

pytestmark = pytest.mark.skipif(
    os.getenv("SIMCAM") != "1",
    reason="needs the simulated camera: python simcam/fault.py up, then SIMCAM=1",
)

DETECTION = Path(__file__).resolve().parents[2]
SPECIAL_USER, SPECIAL_PASSWORD = "special", "p@ss#w&rd1"   # matches mediamtx.yml

# Opens the camera the way main.py will: CameraSource builds the address,
# configure_capture_logging sets FFmpeg's options, then one OpenCV open.
PROBE = r"""
import os, sys
sys.path.insert(0, "src")
import cv2
from camera import CameraSource, configure_capture_logging
source = CameraSource.from_env(os.environ)
configure_capture_logging(source)
cap = cv2.VideoCapture(source.open_target(), cv2.CAP_FFMPEG,
                       [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 8000])
ok = cap.isOpened() and cap.read()[0]
print("OPENED" if ok else "NOT OPENED", flush=True)
"""


def _probe(**env):
    full = dict(os.environ)
    for name in ("OPENCV_FFMPEG_CAPTURE_OPTIONS", "OPENCV_FFMPEG_LOGLEVEL"):
        full.pop(name, None)
    full.update(env)
    r = subprocess.run([sys.executable, "-c", PROBE], cwd=DETECTION, env=full,
                       capture_output=True, text=True, timeout=60)
    return r.stdout + r.stderr


@pytest.fixture(scope="module", autouse=True)
def camera():
    fault.up()
    fault.ready()


def test_a_password_full_of_special_characters_logs_in():
    out = _probe(CAMERA_SOURCE=fault.URL, CAMERA_USERNAME=SPECIAL_USER,
                 CAMERA_PASSWORD=SPECIAL_PASSWORD)
    assert "OPENED" in out and "NOT OPENED" not in out, out
    for form in (SPECIAL_PASSWORD, quote(SPECIAL_PASSWORD, safe="")):
        assert form not in out, f"password printed as {form!r}"


def test_a_wrong_password_says_why_and_not_what():
    wrong = "wrongPass5182"
    out = _probe(CAMERA_SOURCE=fault.URL, CAMERA_USERNAME=fault.USERNAME,
                 CAMERA_PASSWORD=wrong)
    assert "NOT OPENED" in out
    assert "401" in out, "the cause (401 Unauthorized) must still be visible:\n" + out
    assert wrong not in out and quote(wrong, safe="") not in out


def test_a_wrong_stream_path_says_why():
    out = _probe(CAMERA_SOURCE=fault.URL.replace("cam1", "cam9"),
                 CAMERA_USERNAME=fault.USERNAME, CAMERA_PASSWORD=fault.PASSWORD)
    assert "NOT OPENED" in out
    assert "404" in out, "the cause (404 Not Found) must still be visible:\n" + out
    assert fault.PASSWORD not in out
