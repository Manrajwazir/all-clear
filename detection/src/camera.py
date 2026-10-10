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

ONE THREAD OWNS THE CAMERA (Labs4 block 1, C3, 2026-10-10). FrameReader reads
the camera nonstop on its own thread and keeps one slot holding the newest
frame. The main loop asks it for a frame and gets the newest one it hasn't had
yet, numbered, with the moment it arrived. Why: a network camera doesn't wait.
While YOLO works, its frames queue up, and reading them in order means looking
at the past. Measured against the simulated camera on 2026-10-10: a loop
managing 5 frames a second on a 15 fps stream was 7.9 s behind after 12 s and
still falling (G5). With the reader it stays current. Frames the loop never
gets to are dropped and counted. A recorded file is the exception: it has no
clock, so the reader hands out every frame in order, as before. Tests:
tests/test_frame_reader.py, tests/simcam/test_frame_age.py.

READING A FRAME. OPEN_ITEMS 17.2, fixed 2026-09-26. On an empty frame main.py used to log and
`continue` with no pause. A camera held by another app (Microsoft Teams, in
practice) returns empty frames instantly, so the loop spun at full speed and
wrote one warning per spin. That behaviour now lives inside the reader thread.

Deliberately NOT a reconnect. The reconnect code that used to live in main.py
was removed in ee01e9d because no retry can take a webcam back from Teams. This
only makes failure slow and quiet: pause briefly, and report the problem
periodically instead of continuously.

RTSP cameras will need real reconnect logic (a dropped stream DOES come back).
That is block 1 step C4, inside the reader.

Kept out of main.py so it can be tested without a webcam or the model:
tests/test_camera_read.py.
"""

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

logger = logging.getLogger(__name__)


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
    """Return the camera's next frame, or None after a short pause if there is none.

    The NEXT frame, which is the oldest one waiting, not the newest. This used to
    say grab() "discards anything queued"; measured 2026-10-10, it doesn't: on a
    network stream, a slow loop calling this fell further behind every second
    (tests/simcam/test_frame_age.py). Keeping up is FrameReader's job, which
    calls this nonstop on its own thread.
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


# ── One thread owns the camera ──────────────────────────────────────────────


class FrameReaderError(RuntimeError):
    """The reader thread died. Raised to the main loop instead of None forever."""


@dataclass(frozen=True)
class Frame:
    """One frame, as the reader received it."""

    image: "object"                # the picture, a numpy array
    seq: int                       # 1, 2, 3 ... in arrival order; a gap is skipped frames
    arrived_at: datetime           # UTC. An alert on this frame is detected_at = this (D2)
    arrived_mono: float            # time.monotonic() on arrival, for measuring age


class FrameReader:
    """Reads the camera on its own thread; hands the main loop the newest frame, once.

    From start() on, this is the camera's only owner: nothing else may read or
    release it. OpenCV makes no promise that a capture is safe across threads,
    and a read racing a release can crash inside C++ with no Python error.

    One slot, not a queue. Each frame replaces the last, so however slow the
    main loop is, it gets what the camera sent most recently. And never the same
    frame twice: a loop faster than the camera waits for the next frame rather
    than being handed the last one again, which the debounce would count as a
    second sighting.

    every_frame=True is for a recorded file: the reader waits for each frame to
    be taken before reading the next, so every frame is handed out, in order.
    """

    def __init__(self, cap, *, every_frame: bool = False, sleep=time.sleep):
        self._cap = cap
        self._every_frame = every_frame
        self._sleep = sleep
        self._slot: Frame | None = None
        self._last_seq = 0           # numbers given to frames so far
        self._delivered_seq = 0      # the last number handed to the main loop
        self._delivered = 0
        self._skipped = 0
        self._error: BaseException | None = None
        self._changed = threading.Condition()
        self._stopping = threading.Event()
        self._thread = threading.Thread(target=self._run, name="allclear-camera", daemon=True)

    def start(self) -> "FrameReader":
        self._thread.start()
        return self

    def is_alive(self) -> bool:
        return self._thread.is_alive()

    @property
    def stats(self) -> dict:
        """Frames received from the camera, handed to the loop, and never handed out."""
        with self._changed:
            return {
                "received": self._last_seq,
                "delivered": self._delivered,
                "skipped": self._skipped,
            }

    def next_frame(self, timeout: float) -> Frame | None:
        """The newest frame not yet handed out, waiting up to `timeout` for one.

        None means nothing new arrived in time. Raises FrameReaderError if the
        reader thread has died, so a crash can't pass for a quiet camera.
        """
        deadline = time.monotonic() + timeout
        with self._changed:
            while True:
                slot = self._slot
                if slot is not None and slot.seq > self._delivered_seq:
                    self._skipped += slot.seq - self._delivered_seq - 1
                    self._delivered_seq = slot.seq
                    self._delivered += 1
                    self._changed.notify_all()     # an every_frame reader is waiting on this
                    return slot
                if self._error is not None:
                    raise FrameReaderError("the camera reader thread died") from self._error
                remaining = deadline - time.monotonic()
                if remaining <= 0 or self._stopping.is_set():
                    return None
                self._changed.wait(remaining)

    def stop(self, timeout: float = 5.0) -> None:
        """Ask the thread to finish, and wait for it. It releases the camera itself."""
        self._stopping.set()
        with self._changed:
            self._changed.notify_all()
        if self._thread.is_alive():
            self._thread.join(timeout)
        if self._thread.is_alive():
            # Stuck inside a read (C4 adds the timeout that bounds it). It is a
            # daemon thread, so it can't hold the program open.
            logger.warning("Camera reader still busy after %.0f s; not waiting for it.", timeout)

    def _run(self) -> None:
        empty = 0
        try:
            while not self._stopping.is_set():
                image = read_frame(self._cap, sleep=self._sleep)
                if image is None:
                    empty += 1
                    if should_warn(empty):
                        logger.warning(
                            "No frame from camera (%d in a row). If another app such "
                            "as Teams has the webcam, close it.", empty,
                        )
                    continue
                if empty:
                    logger.info("Camera recovered after %d empty frames.", empty)
                    empty = 0
                arrived_mono = time.monotonic()
                arrived_at = datetime.now(timezone.utc)
                with self._changed:
                    if self._every_frame:
                        while (self._slot is not None
                               and self._slot.seq > self._delivered_seq
                               and not self._stopping.is_set()):
                            self._changed.wait(0.1)
                    self._last_seq += 1
                    self._slot = Frame(image, self._last_seq, arrived_at, arrived_mono)
                    self._changed.notify_all()
        except BaseException as exc:  # noqa: BLE001 - reported to the loop, not swallowed
            logger.exception("Camera reader stopped by an unexpected error")
            with self._changed:
                self._error = exc
                self._changed.notify_all()
        finally:
            self._cap.release()
