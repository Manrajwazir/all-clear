"""
camera.py -- which camera to read, and reading a frame from it.

WHICH CAMERA (Labs4 block 1, C2, 2026-10-08). CameraSource reads CAMERA_SOURCE
from detection/.env: a webcam number, an rtsp:// address, or a video file. It
used to be `CAMERA_INDEX = 0` in main.py, the one setting not read from .env, so
pointing at an IP camera meant editing Python. The camera's login comes from
CAMERA_USERNAME and CAMERA_PASSWORD, never from inside the address, so the
password can be used to connect without ever being printed: every printable
form of a CameraSource shows it as ***. Tests: tests/test_camera_source.py,
tests/simcam/test_credentials.py.

READING A FRAME. OPEN_ITEMS 17.2, fixed 2026-09-26. On an empty frame main.py used to log and
`continue` with no pause. A camera held by another app (Microsoft Teams, in
practice) returns empty frames instantly, so the loop spun at full speed and
wrote one warning per spin.

Deliberately NOT a reconnect. The reconnect code that used to live in main.py
was removed in ee01e9d because no retry can take a webcam back from Teams. This
only makes failure slow and quiet: pause briefly, and report the problem
periodically instead of continuously.

RTSP cameras will need real reconnect logic (a dropped stream DOES come back).
That is the RTSP bench blocker, and belongs with it, not here.

Kept out of main.py so it can be tested without a webcam or the model:
tests/test_camera_read.py.
"""

import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit


class CameraConfigError(ValueError):
    """CAMERA_SOURCE and friends can't be used as given. Start-up stops (exit 4).

    Messages never contain a password.
    """


# Address schemes a camera can be given as, with their standard ports.
STREAM_SCHEMES = {"rtsp": 554, "rtsps": 322}
TRANSPORTS = ("tcp", "udp")


@dataclass(frozen=True)
class CameraSource:
    """Where frames come from: a webcam, a network stream, or a video file.

    `location` never holds a password: for a stream it is the address exactly
    as configured, without a login, and the login is added only by
    open_target(), at the moment of connecting.
    """

    kind: str                      # "webcam" | "stream" | "file"
    location: int | str            # webcam index, stream address, or file path
    username: str = ""
    password: str = field(default="", repr=False)
    transport: str = "tcp"

    @classmethod
    def from_env(cls, env) -> "CameraSource":
        raw = (env.get("CAMERA_SOURCE") or "").strip()
        transport = (env.get("CAMERA_TRANSPORT") or "tcp").strip().lower()
        if transport not in TRANSPORTS:
            raise CameraConfigError(
                f"CAMERA_TRANSPORT must be one of {', '.join(TRANSPORTS)}, not {transport!r}"
            )

        if raw == "":
            return cls("webcam", 0, transport=transport)
        if raw.isdigit():
            return cls("webcam", int(raw), transport=transport)

        if "://" in raw:
            parts = urlsplit(raw)
            scheme = parts.scheme.lower()
            if scheme not in STREAM_SCHEMES:
                raise CameraConfigError(
                    f"CAMERA_SOURCE must be a webcam number, an rtsp:// or rtsps:// "
                    f"address, or a video file; got a {scheme}:// address"
                )
            if "@" in parts.netloc:
                # Not echoed back: the whole point is that it may hold a password.
                raise CameraConfigError(
                    "CAMERA_SOURCE contains a login. Put the camera's username and "
                    "password in CAMERA_USERNAME and CAMERA_PASSWORD instead, where "
                    "they are kept out of the log"
                )
            if not parts.hostname:
                raise CameraConfigError(f"CAMERA_SOURCE has no camera address: {raw}")
            return cls(
                "stream", raw,
                username=env.get("CAMERA_USERNAME") or "",
                password=env.get("CAMERA_PASSWORD") or "",
                transport=transport,
            )

        path = Path(raw).expanduser()
        if not path.is_file():
            raise CameraConfigError(f"CAMERA_SOURCE video file not found: {path}")
        return cls("file", str(path.resolve()), transport=transport)

    # ── where it is ─────────────────────────────────────────────────────────

    @property
    def host(self) -> str | None:
        return urlsplit(self.location).hostname if self.kind == "stream" else None

    @property
    def port(self) -> int | None:
        if self.kind != "stream":
            return None
        parts = urlsplit(self.location)
        return parts.port or STREAM_SCHEMES[parts.scheme.lower()]

    # ── connecting, and showing ─────────────────────────────────────────────

    def open_target(self) -> int | str:
        """What to hand cv2.VideoCapture. The ONLY place a password is used.

        Never log the result. Every character of the login is percent-encoded
        (quote with safe=""), so '@', ':', '/' and '#' in a password can't be
        mistaken for parts of the address.
        """
        if self.kind != "stream" or not (self.username or self.password):
            return self.location
        parts = urlsplit(self.location)
        login = quote(self.username, safe="")
        if self.password:
            login += ":" + quote(self.password, safe="")
        return urlunsplit(parts._replace(netloc=f"{login}@{parts.netloc}"))

    @property
    def display(self) -> str:
        """Safe to print anywhere: the password, if any, is ***."""
        if self.kind == "webcam":
            return f"webcam {self.location}"
        if self.kind == "file" or not (self.username or self.password):
            return str(self.location)
        parts = urlsplit(self.location)
        login = self.username + (":***" if self.password else "")
        return urlunsplit(parts._replace(netloc=f"{login}@{parts.netloc}"))

    def __str__(self) -> str:
        return self.display

    def __repr__(self) -> str:
        return f"CameraSource({self.display!r}, transport={self.transport!r})"


def configure_capture_logging(source: CameraSource) -> None:
    """Set how OpenCV's FFmpeg reads streams. Call before the first open.

    OpenCV passes FFmpeg its options through environment variables, read when a
    camera is opened:
      - transport: TCP by default. Over UDP, lost packets become smeared grey
        frames, and the model would see them as real images.
      - FFmpeg's log level 16 (errors): its error lines name the cause, "401
        Unauthorized" for a wrong password, "404 Not Found" for a wrong stream
        path, and contain no address (checked against the simulated camera
        2026-10-08). Its warnings and chatter go.
    OpenCV's own warnings (stream timeouts) are turned down to errors too; the
    service reports outages itself, in its own words.
    """
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = f"rtsp_transport;{source.transport}"
    os.environ["OPENCV_FFMPEG_LOGLEVEL"] = "16"
    import cv2

    cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)


# ── Reading a frame ─────────────────────────────────────────────────────────

# One tenth of a second. Long enough that a dead camera costs nothing, short
# enough that a camera that recovers is picked up again almost at once.
EMPTY_FRAME_WAIT_SECONDS = 0.1

# At 0.1 s per attempt, one warning every 50 failures is one every ~5 seconds.
WARN_EVERY = 50


def read_frame(cap, sleep=time.sleep):
    """Return the freshest frame, or None after a short pause if there is none.

    grab() then retrieve() rather than read(): grab discards anything queued, so
    when inference is slower than the camera we process the newest frame, not a
    stale one.
    """
    cap.grab()
    ret, frame = cap.retrieve()
    if not ret or frame is None:
        sleep(EMPTY_FRAME_WAIT_SECONDS)
        return None
    return frame


def should_warn(consecutive_failures):
    """Report the first empty frame at once, then every WARN_EVERY after it."""
    return consecutive_failures == 1 or consecutive_failures % WARN_EVERY == 0
