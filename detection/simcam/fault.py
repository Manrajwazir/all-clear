"""
fault.py -- run the simulated camera, and break it on purpose.

    python simcam/fault.py up            start it (makes the counting video first if missing)
    python simcam/fault.py ready         wait until the stream can actually be watched
    python simcam/fault.py stop-stream   FFmpeg stops: the camera's software restarts
    python simcam/fault.py start-stream
    python simcam/fault.py stop-camera   the server goes: power lost, cable pulled
    python simcam/fault.py start-camera
    python simcam/fault.py pause         connection stays open, nothing arrives: the hang
    python simcam/fault.py resume
    python simcam/fault.py down          remove it

Every fault is one command so a test can cause it and then check the detection
service noticed. Test equipment only.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
COMPOSE = ["docker", "compose", "-f", str(HERE / "compose.yaml")]

HOST, PORT, STREAM = "127.0.0.1", 8554, "cam1"
USERNAME, PASSWORD = "viewer", "simcamPass7391"   # matches mediamtx.yml; not a secret
URL = f"rtsp://{HOST}:{PORT}/{STREAM}"            # no credentials: the service adds them


def _compose(*args: str) -> None:
    subprocess.run([*COMPOSE, *args], check=True, capture_output=True, text=True)


def up() -> None:
    if not (HERE / "clips" / "counting.mp4").exists():
        subprocess.run([sys.executable, str(HERE / "make_counting_video.py")], check=True)
    start_camera()


def down() -> None:
    _compose("down")


def stop_stream() -> None:
    _compose("stop", "publisher")


def start_stream() -> None:
    _compose("start", "publisher")


def stop_camera() -> None:
    _compose("stop", "publisher", "rtsp")


def start_camera() -> None:
    # Server first, and wait until it answers, THEN the stream. Started together,
    # FFmpeg can try before the server is on Docker's network ("Failed to
    # resolve hostname rtsp"), give up, and stay down. Seen 2026-10-06.
    _compose("up", "-d", "rtsp")
    _wait_for_server()
    _compose("up", "-d", "--force-recreate", "publisher")


def _wait_for_server(timeout: float = 30.0) -> None:
    import socket

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((HOST, PORT), timeout=1):
                return
        except OSError:
            time.sleep(0.5)
    raise TimeoutError(f"simulated camera server not answering on {HOST}:{PORT}")


def pause() -> None:
    _compose("pause", "rtsp")


def resume() -> None:
    _compose("unpause", "rtsp")


def ready(timeout: float = 60.0) -> None:
    """Block until a frame can really be read from the stream, or raise."""
    os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
    import cv2

    url = f"rtsp://{USERNAME}:{PASSWORD}@{HOST}:{PORT}/{STREAM}"
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG, [
            cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000,
        ])
        ok = cap.isOpened() and cap.read()[0]
        cap.release()
        if ok:
            return
        time.sleep(1)
    raise TimeoutError(f"simulated camera not readable at {URL} after {timeout:.0f} s")


ACTIONS = {
    "up": up, "down": down, "ready": ready,
    "stop-stream": stop_stream, "start-stream": start_stream,
    "stop-camera": stop_camera, "start-camera": start_camera,
    "pause": pause, "resume": resume,
}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ACTIONS:
        sys.exit(f"usage: fault.py {{{'|'.join(ACTIONS)}}}")
    ACTIONS[sys.argv[1]]()
    print(f"simcam: {sys.argv[1]} done")
