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

RECONNECTING (Labs4 block 1, C4, 2026-10-10). The reader also connects, and
when the stream breaks, reconnects: 1 s, 2 s, 4 s, 8 s, 16 s, then every 30 s,
for as long as it takes. A camera missing at start is just a long first outage;
the program no longer exits for it (G3). A camera that answers but refuses the
stream, most likely a wrong password, is tried only every few minutes, so we
can't lock its account. Each outage ends with one "Camera blind for N s" line,
the local record of not watching. Webcams take the same path (decision D1):
retrying never took a webcam back from Teams (ee01e9d removed the old
reconnect for that reason), but SLOW retries cost nothing, which keeps the
OPEN_ITEMS 17.2 fix: a dead or held camera is waited on, never spun on. Tests:
tests/test_reconnect.py, tests/simcam/test_blackbox.py checks 2, 3, 4 and 6,
tests/simcam/test_reconnect_soak.py.
"""

import logging
import os
import random
import socket
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


# ── Opening the camera ──────────────────────────────────────────────────────


def open_capture(source: CameraSource, open_timeout_s: float, read_timeout_s: float):
    """Open the camera once and return the cv2.VideoCapture, opened or not.

    A stream gets both timeouts. Without them OpenCV waits about 30 s to connect
    and about 30 s for each frame, so a hung stream goes unnoticed for half a
    minute (G4). Webcams and files don't read over the network; the timeouts
    don't apply to them.
    """
    import cv2

    target = source.open_target()
    if source.kind == "stream":
        return cv2.VideoCapture(target, cv2.CAP_FFMPEG, [
            cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, int(open_timeout_s * 1000),
            cv2.CAP_PROP_READ_TIMEOUT_MSEC, int(read_timeout_s * 1000),
        ])
    cap = cv2.VideoCapture(target)
    if source.kind == "webcam":
        # Top frame rate and a one-frame buffer. Some webcam drivers use the
        # buffer setting; FFmpeg rejects it (measured 2026-10-10). Keeping up
        # is the reader's job either way.
        cap.set(cv2.CAP_PROP_FPS, 60)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap


_default_open_capture = open_capture


def reachable(host: str, port: int, timeout: float = 2.0) -> bool:
    """Does anything answer at this address? A plain connection, no login: milliseconds."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


# ── How long to wait before trying again ────────────────────────────────────

BACKOFF_S = (1, 2, 4, 8, 16, 30)
JITTER_S = 0.3
HEALTHY_RESET_S = 60

# A camera that answers but won't give us the stream is most likely refusing the
# password, or being asked for a path it doesn't have. Many cameras lock the
# account after repeated failed logins, so after this many refusals in a row the
# reader slows right down. More patience once the camera has streamed for us:
# our settings were right then, so a refusal is far more likely the camera
# restarting its stream software than a wrong password.
REFUSALS_BEFORE_WAITING = 3
REFUSALS_BEFORE_WAITING_AFTER_STREAMING = 10


class Backoff:
    """1 s, 2 s, 4 s, 8 s, 16 s, then every 30 s; back to 1 s after a minute of good streaming.

    A short drop costs a second. A camera gone for an hour is asked twice a
    minute, not ten times a second. The jitter keeps cameras that dropped
    together (a switch rebooted) from all retrying at the same instant.
    """

    def __init__(self, rand=random.uniform):
        self._rand = rand
        self._waits = 0

    def next_wait(self) -> float:
        base = BACKOFF_S[min(self._waits, len(BACKOFF_S) - 1)]
        self._waits += 1
        return max(0.0, base + self._rand(-JITTER_S, JITTER_S))

    def healthy_for(self, seconds: float) -> None:
        """Called while streaming. A minute of good frames counts as recovered."""
        if seconds >= HEALTHY_RESET_S:
            self._waits = 0


# ── One thread owns the camera ──────────────────────────────────────────────


class FrameReaderError(RuntimeError):
    """The reader thread died. Raised to the main loop instead of None forever."""


@dataclass(frozen=True)
class Frame:
    """One frame, as the reader received it."""

    image: "object"                # the picture, a numpy array
    seq: int                       # 1, 2, 3 ... in arrival order; a gap is skipped frames
    arrived_at: datetime           # UTC. An alert on this frame is detected_at = this (D2)
    arrived_mono: float            # monotonic clock on arrival, for measuring age


def _hms(moment: datetime) -> str:
    return moment.astimezone().strftime("%H:%M:%S")


class FrameReader:
    """Owns the camera on its own thread: connects, reads, reconnects. Hands the
    main loop the newest frame, once.

    Only this thread ever opens, reads or releases the camera. OpenCV makes no
    promise that a capture is safe across threads, and a read racing a release
    can crash inside C++ with no Python error.

    READING (C3). One slot, not a queue: each frame replaces the last, so however
    slow the main loop is, it gets what the camera sent most recently. Never the
    same frame twice: a loop faster than the camera waits for the next frame
    rather than being handed the last one again, which the debounce would count
    as a second sighting. A recorded file is the exception: every frame is
    handed out, in order, because a file has no clock and nothing in it is late.

    RECONNECTING (C4, plan §4.3). Any failed read, or no frame within the read
    timeout, means the stream is lost: release the camera, wait, connect again.
    The wait follows Backoff, except for a camera that answers but refuses the
    stream (most likely a wrong password), which is tried every refused_wait_s
    so it can't be driven into locking the account. A camera missing at start
    is just a long first outage: the program never exits for it. Each outage
    ends with one line saying how long the program was blind.

    An error raised by the camera itself counts as a lost stream and is logged
    in full. Any other error is a bug in the reader: the thread dies, and the
    main loop gets FrameReaderError instead of silence.
    """

    def __init__(self, source: CameraSource, *, open_capture=None, probe=None,
                 open_timeout_s: float = 10.0, read_timeout_s: float = 5.0,
                 refused_wait_s: float = 300.0, wait=None, clock=time.monotonic,
                 rand=random.uniform):
        self._source = source
        self._open = open_capture or (
            lambda: _default_open_capture(source, open_timeout_s, read_timeout_s))
        self._probe = probe or reachable
        self._open_timeout_s = open_timeout_s
        self._read_timeout_s = read_timeout_s
        self._refused_wait_s = refused_wait_s
        self._clock = clock
        self._backoff = Backoff(rand)
        self._every_frame = source.kind == "file"

        self._changed = threading.Condition()
        self._stopping = threading.Event()
        self._wait = wait or self._stopping.wait
        self._thread = threading.Thread(target=self._run, name="allclear-camera", daemon=True)

        # Shared with the main loop; touched only under self._changed.
        self._slot: Frame | None = None
        self._last_seq = 0
        self._delivered_seq = 0
        self._delivered = 0
        self._skipped = 0
        self._state = "connecting"
        self._error: BaseException | None = None
        self._unreadable = False

        # The reader thread's own bookkeeping.
        self._cap = None
        self._ever_streamed = False
        self._refusals = 0
        self._announced_refused = False
        self._failure = ""
        self._last_frame: Frame | None = None
        # The outage in progress: when it began and how many tries it has taken.
        # The program starts blind, so start-up is the first one.
        self._outage = {"since": clock(), "startup": True, "attempts": 0}

    # ── what the main loop calls ────────────────────────────────────────────

    def start(self) -> "FrameReader":
        self._thread.start()
        return self

    def is_alive(self) -> bool:
        return self._thread.is_alive()

    @property
    def state(self) -> str:
        """connecting, streaming, reconnecting, refused or finished."""
        with self._changed:
            return self._state

    @property
    def finished(self) -> bool:
        """A recorded file has ended. A live camera is never finished."""
        return self.state == "finished"

    @property
    def unreadable(self) -> bool:
        """A recorded file that couldn't be opened at all: a setting to fix, not an outage."""
        with self._changed:
            return self._unreadable

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

        None means nothing new arrived in time, or a file has finished. Raises
        FrameReaderError if the reader thread has died, so a crash can't pass
        for a quiet camera.
        """
        deadline = time.monotonic() + timeout
        with self._changed:
            while True:
                slot = self._slot
                if slot is not None and slot.seq > self._delivered_seq:
                    self._skipped += slot.seq - self._delivered_seq - 1
                    self._delivered_seq = slot.seq
                    self._delivered += 1
                    self._changed.notify_all()     # a file's reader waits on this
                    return slot
                if self._error is not None:
                    raise FrameReaderError("the camera reader thread died") from self._error
                if self._state == "finished":
                    return None
                remaining = deadline - time.monotonic()
                if remaining <= 0 or self._stopping.is_set():
                    return None
                self._changed.wait(remaining)

    def stop(self, timeout: float | None = None) -> None:
        """Ask the thread to finish, and wait for it. It releases the camera itself."""
        self._stopping.set()
        with self._changed:
            self._changed.notify_all()
        # Long enough for a connection attempt in progress to give up.
        timeout = self._open_timeout_s + 2 if timeout is None else timeout
        if self._thread.is_alive():
            self._thread.join(timeout)
        if self._thread.is_alive():
            # Stuck inside a camera call. A daemon thread can't hold the program open.
            logger.warning("Camera reader still busy after %.0f s; not waiting for it.", timeout)

    # ── the reader thread ───────────────────────────────────────────────────

    def _run(self) -> None:
        try:
            self._watch()
        except BaseException as exc:  # noqa: BLE001 - reported to the loop, not swallowed
            logger.exception("Camera reader stopped by an unexpected error")
            with self._changed:
                self._error = exc
                self._changed.notify_all()
        finally:
            self._release()
            if self._outage is not None and not self.finished:
                self._log_blind(still_blind=True)

    def _watch(self) -> None:
        first = True
        while not self._stopping.is_set():
            if not first:
                self._wait(self._next_wait())
                if self._stopping.is_set():
                    return
            first = False

            cap = self._connect()
            if cap is None:
                if self._source.kind == "file":
                    logger.error("Video file could not be opened: %s", self._source.display)
                    with self._changed:
                        self._unreadable = True
                    self._outage = None
                    self._set_state("finished")
                    return
                continue

            self._cap = cap
            ended = self._stream(cap)
            self._release()
            if ended == "finished":
                self._outage = None
                self._set_state("finished")
                return

    def _set_state(self, state: str) -> None:
        with self._changed:
            self._state = state
            self._changed.notify_all()

    def _connect(self):
        """One attempt to open the camera. The camera, or None and self._failure says why."""
        src = self._source
        self._failure = ""
        if self._outage is not None:
            self._outage["attempts"] += 1
        logger.info("Connecting to camera %s", src.display)

        if src.kind == "stream" and not self._probe(src.host, src.port):
            self._failure = "unreachable"
            self._refusals = 0
            return None

        started = self._clock()
        cap = None
        try:
            cap = self._open()
            if cap is not None and cap.isOpened():
                logger.info("Camera connected: %s", src.display)
                self._refusals = 0
                self._announced_refused = False
                return cap
        except Exception:  # noqa: BLE001 - the camera failing, not the reader
            logger.exception("Opening camera %s raised an error", src.display)
        if cap is not None:
            self._release_quietly(cap)

        # It answered (the address took a connection) and said no quickly: that
        # is a refusal, most likely the login. A slow failure is no answer at all.
        if src.kind == "stream" and self._clock() - started < self._open_timeout_s / 2:
            self._failure = "refused"
            self._refusals += 1
        else:
            self._failure = "did not open"
            self._refusals = 0
        return None

    def _stream(self, cap) -> str:
        """Read until the stream stops. Returns "finished", "lost", "no frames" or "stopped"."""
        connected_at = self._clock()
        frames_this_connection = 0
        while not self._stopping.is_set():
            asked = self._clock()
            try:
                ok, image = cap.read()
            except Exception:  # noqa: BLE001 - the camera failing, not the reader
                logger.exception("Reading camera %s raised an error", self._source.display)
                ok, image = False, None

            # A frame that took longer than the read timeout to come means the
            # stream hung. OpenCV's timeout doesn't reliably end the read: on
            # the simulated camera FFmpeg kept going, and frames held up during
            # the hang then arrived 5 to 10 s late, in a burst (2026-10-10).
            # Looked at as if they were now, they'd be stamped with the wrong
            # time. So drop what came back, and reconnect. Not for a file: its
            # reader waits on the loop between frames, and a file can't hang.
            # The first read after connecting is exempt: some cameras are slow to
            # send their first frame, and that's a start, not a hang (C4 review).
            stalled = self._clock() - asked
            if (ok and self._source.kind != "file" and frames_this_connection > 0
                    and stalled > self._read_timeout_s):
                logger.warning("Camera stream stalled for %.0f s; dropping what it sent late",
                               stalled)
                ok, image = False, None

            if not ok or image is None:
                if self._stopping.is_set():
                    return "stopped"
                if self._source.kind == "file":
                    logger.info("Video file finished: %s", self._source.display)
                    return "finished"
                if frames_this_connection == 0:
                    self._failure = "no frames"
                    return "no frames"
                self._lost()
                return "lost"

            frames_this_connection += 1
            now = self._clock()
            frame_arrived_at = datetime.now(timezone.utc)
            if self._outage is not None:
                self._log_blind(next_frame_at=frame_arrived_at, now=now)
                self._outage = None
            self._ever_streamed = True
            self._backoff.healthy_for(now - connected_at)
            self._publish(image, frame_arrived_at, now)
        return "stopped"

    def _publish(self, image, arrived_at: datetime, arrived_mono: float) -> None:
        with self._changed:
            if self._every_frame:
                # A file: wait until the loop has taken the last frame.
                while (self._slot is not None
                       and self._slot.seq > self._delivered_seq
                       and not self._stopping.is_set()):
                    self._changed.wait(0.1)
            self._last_seq += 1
            self._slot = Frame(image, self._last_seq, arrived_at, arrived_mono)
            self._last_frame = self._slot
            self._state = "streaming"
            self._changed.notify_all()

    def _lost(self) -> None:
        last = self._last_frame
        self._outage = {"since": last.arrived_mono, "startup": False, "attempts": 0,
                        "last": last.arrived_at}
        self._set_state("reconnecting")
        logger.warning("Camera stream lost (last frame %s); reconnecting", _hms(last.arrived_at))

    def _next_wait(self) -> float:
        """How long until the next try, and one line saying why."""
        src = self._source
        where = f"{src.host}:{src.port}" if src.kind == "stream" else src.display
        limit = (REFUSALS_BEFORE_WAITING_AFTER_STREAMING if self._ever_streamed
                 else REFUSALS_BEFORE_WAITING)

        if self._failure == "refused" and self._refusals >= limit:
            seconds = self._refused_wait_s
            self._set_state("refused")
            if not self._announced_refused:
                self._announced_refused = True
                logger.error(
                    "Camera at %s answers but refuses the stream: check CAMERA_PASSWORD, "
                    "the stream path in CAMERA_SOURCE, and whether the camera already has "
                    "as many viewers as it allows (a recorder may be holding them). Trying "
                    "again every %.0f s, so a wrong password can't lock the camera's "
                    "account.", where, seconds)
            else:
                logger.info("Still refused by the camera; next try in %.0f s", seconds)
            return seconds

        seconds = self._backoff.next_wait()
        if self._state != "connecting":
            self._set_state("reconnecting")
        if src.kind == "webcam" and self._failure in ("no frames", "did not open"):
            logger.warning(
                "Webcam %s not delivering frames; retrying in %.0f s. If another app "
                "(Teams, Zoom) has the camera, close it; or there is no webcam %s.",
                src.location, seconds, src.location)
        elif self._failure == "unreachable":
            logger.warning("Camera unreachable at %s; retrying in %.0f s", where, seconds)
        elif self._failure == "refused":
            logger.warning("Camera at %s answered but didn't give the stream; retrying in %.0f s",
                           where, seconds)
        elif self._failure in ("no frames", "did not open"):
            logger.warning("Camera %s %s; retrying in %.0f s", src.display,
                           "gave no frames" if self._failure == "no frames" else "did not open",
                           seconds)
        else:
            logger.info("Reconnecting in %.0f s", seconds)
        self._failure = ""
        return seconds

    def _log_blind(self, *, next_frame_at: datetime | None = None, now: float | None = None,
                   still_blind: bool = False) -> None:
        """The one line that records an outage: how long, from when, how many tries."""
        outage = self._outage
        if outage is None:
            return
        attempts = outage["attempts"]
        if outage["startup"]:
            if attempts <= 1 and not still_blind:
                return              # connected on the first try: not an outage
            what = "connection attempt"
            began = "since start-up"
        else:
            what = "reconnect attempt"
            began = f"last frame {_hms(outage['last'])}"
        seconds = (self._clock() if now is None else now) - outage["since"]
        ended = "still blind at shutdown" if still_blind else f"next frame {_hms(next_frame_at)}"
        logger.warning("Camera blind for %.0f s (%s, %s), %d %s%s",
                       seconds, began, ended, attempts, what, "" if attempts == 1 else "s")

    def _release(self) -> None:
        if self._cap is not None:
            cap, self._cap = self._cap, None
            self._release_quietly(cap)

    def _release_quietly(self, cap) -> None:
        try:
            cap.release()
        except Exception:  # noqa: BLE001 - the camera failing, not the reader
            logger.exception("Releasing camera %s raised an error", self._source.display)
