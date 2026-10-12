"""
main.py — All Clear Detection Service Entry Point
-----------------------------------------------
Phase 3: live detection loop + debounce + API submission.

Data flow per frame:
  FrameReader (its own thread)        [the newest frame from the camera, once]
    → PPEDetector.predict()           [YOLO inference on GPU]
    → PPEDetector.find_violations()   [filter for NO-Hardhat etc.]
    → ViolationTracker.should_alert()  [debounce + cooldown]
    → new_idempotency_key()           [minted ONCE, here, per event]
    → client.submit_violation()       [POST /api/v1/violations]
    → client.upload_snapshot()        [PUT direct to S3, snapshot sites only]
    → client.confirm_snapshot()       [server verifies the object exists]
    → send_violation_sms()            [ONLY after a confirmed 201]
    → annotated frame shown in window

WHAT CHANGED IN PHASE 3, AND WHY IT MATTERS

This process no longer holds the Supabase service-role key or the S3 keys. It
holds one device API key, scoped to one device at one site, revocable from the
dashboard. Everything it writes goes through the API, which decides the
organisation from the key rather than believing anything this process claims.

That is the entire point of the step. The old arrangement worked on a laptop
and could not ship: the service-role key bypasses every access rule in the
database, and this code runs on a small computer in an unlocked job-site
trailer.

`storage.py` still exists and still works. It is simply no longer on the
violation path. `tests/test_storage.py` continues to exercise it directly.

Run from the detection/ folder:
    cd detection
    python src/main.py

Controls:
    q — quit
    s — save a snapshot to docs/phase1_snapshot.jpg
"""

import os
import sys
import cv2
import time
import signal
import logging
import threading
from pathlib import Path
from dotenv import load_dotenv

# Add src/ to path so imports work when running from detection/
sys.path.insert(0, str(Path(__file__).parent))

from detector import PPEDetector, VIOLATION_CLASSES
from debounce import ViolationTracker
from camera import (
    CameraConfigError,
    CameraSource,
    FrameReader,
    FrameReaderError,
    configure_capture_logging,
)
from alerts import send_violation_sms
from api_client import (
    AllClearClient,
    AllClearError,
    AuthError,
    RejectedError,
    new_idempotency_key,
)
from event_queue import EventQueue, QueueReplayer

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# --- Config (reads from .env, falls back to defaults) ---
MODEL_PATH    = "models/ppe_v1.pt"
CONFIDENCE    = float(os.getenv("DETECTION_CONFIDENCE_THRESHOLD", 0.6))
DEBOUNCE_F    = int(os.getenv("DEBOUNCE_FRAMES", 5))
COOLDOWN_S    = int(os.getenv("COOLDOWN_SECONDS", 60))
# Which camera to read comes from CAMERA_SOURCE (a webcam number, an rtsp://
# address, or a video file), with CAMERA_USERNAME / CAMERA_PASSWORD for its
# login. See camera.CameraSource. It used to be `CAMERA_INDEX = 0` right here,
# the one setting not read from .env (Labs4 block 1, C2).

# How long the loop waits for a new frame before asking again. It only matters
# when the camera has gone quiet; normally a new frame is already waiting.
FRAME_WAIT_SECONDS = 1.0

# Camera timeouts and the refused wait (plan §4.1, §4.3). Connecting gives up
# after CAMERA_OPEN_TIMEOUT_S; no frame for CAMERA_READ_TIMEOUT_S means the
# stream is lost. A camera that answers but refuses the stream (most likely a
# wrong password) is tried every CAMERA_REFUSED_WAIT_S, so we can't lock it.
CAMERA_OPEN_TIMEOUT_S  = float(os.getenv("CAMERA_OPEN_TIMEOUT_S", 10))
CAMERA_READ_TIMEOUT_S  = float(os.getenv("CAMERA_READ_TIMEOUT_S", 5))
CAMERA_REFUSED_WAIT_S  = float(os.getenv("CAMERA_REFUSED_WAIT_S", 300))

# Which camera this device is watching.
#
# CAMERA_ID STAYS IN CONFIG, and that is a considered position rather than an
# oversight. It is a selector, not a credential: it names which camera row this
# process reports against, it is not secret, and knowing it grants nothing. The
# server independently rejects any camera that is not at this device's own site.
# What left the device in Phase 3 are the SECRETS — the Supabase service-role
# key, the S3 keys.
CAMERA_ID = os.getenv("CAMERA_ID", "00000000-0000-0000-0000-000000000001")

# ── API configuration (Phase 3) ────────────────────────────────────────────
ALLCLEAR_API_URL = os.getenv("ALLCLEAR_API_URL", "http://localhost:3000")
DEVICE_API_KEY   = os.getenv("DEVICE_API_KEY", "")

# The operator's intent only. The client will NOT actually request an image
# until the server has confirmed this site captures imagery — see
# AllClearClient.wants_snapshot() for why guessing here would be dangerous.
SNAPSHOT_MODE    = os.getenv("SNAPSHOT_MODE", "false").lower() in ("1", "true", "yes")

HEARTBEAT_SECONDS = int(os.getenv("HEARTBEAT_SECONDS", 30))

# ── Outage queue (Phase 3, Step 3.5) ───────────────────────────────────────
# Paths are relative to detection/, which is where this is run from. Both are
# gitignored — queue.db holds real violation data and the images are real
# imagery of real people.
QUEUE_DB_PATH   = os.getenv("QUEUE_DB_PATH", "queue.db")
QUEUE_IMAGE_DIR = Path(os.getenv("QUEUE_IMAGE_DIR", "queue_images"))
REPLAY_SECONDS  = int(os.getenv("REPLAY_SECONDS", 30))

API_ENABLED = bool(DEVICE_API_KEY)

TWILIO_ENABLED = all([
    os.getenv("TWILIO_ACCOUNT_SID"),
    os.getenv("TWILIO_AUTH_TOKEN"),
    os.getenv("TWILIO_FROM_NUMBER"),
    os.getenv("TWILIO_TO_NUMBER"),
])

if not API_ENABLED:
    logger.warning(
        "DEVICE_API_KEY is not set — running in LOCAL LOG ONLY mode. "
        "Violations print to the terminal and are recorded nowhere. "
        "Provision a device to get a key: see dashboard/scripts/create-device.mjs."
    )
else:
    logger.info("API enabled: violations will be submitted to %s", ALLCLEAR_API_URL)

if not TWILIO_ENABLED:
    logger.warning("Twilio not configured in .env — SMS alerts disabled.")
else:
    logger.info("Twilio enabled: SMS fires only after a confirmed 201.")


# ── Running unattended (Labs4 block 1, C5) ──────────────────────────────────

# The model failing on one frame is skipped; this many in a row means the
# model or the GPU is broken, and the program exits 1 for a fresh start (D4).
MODEL_FAILURES_BEFORE_EXIT = 10


def decide_headless(env, platform) -> bool:
    """No window? HEADLESS=true or false decides. Unset: Linux with no screen is headless.

    A Linux machine has a screen only if DISPLAY or WAYLAND_DISPLAY is set; on
    one without, cv2.imshow throws and the program dies (G6). Windows always
    has a screen, so there it's only ever the setting. An unclear value is a
    bad setting (ValueError), not a guess.
    """
    raw = (env.get("HEADLESS") or "").strip().lower()
    if raw in ("1", "true", "yes"):
        return True
    if raw in ("0", "false", "no"):
        return False
    if raw:
        raise ValueError(f"HEADLESS must be true or false, not {raw!r}")
    return platform.startswith("linux") and not (
        env.get("DISPLAY") or env.get("WAYLAND_DISPLAY"))


def make_stop_handler(stop, force_exit=os._exit):
    """The handler for a stop signal: raise the flag, nothing else.

    No real work in a signal handler: it runs in the middle of whatever the
    program was doing. The loop sees the flag, finishes the frame in hand
    (a send included), and the shutdown runs. A second signal means something
    is stuck: leave at once, with exit code 1.
    """
    def on_signal(_signum, _frame):
        if stop.is_set():
            force_exit(1)
            return
        stop.set()
    return on_signal


def install_stop_signals(stop) -> None:
    """Ctrl+C (SIGINT), a service manager's stop (SIGTERM) and, on Windows,
    Ctrl+Break (SIGBREAK) all mean the same: finish up and stop cleanly (G7)."""
    handler = make_stop_handler(stop)
    for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        sig = getattr(signal, name, None)
        if sig is not None:
            signal.signal(sig, handler)


def install_thread_death_logging() -> None:
    """A thread dying of an uncaught error goes in the log, traceback and all.

    Python's default only prints it to the console. The main loop then notices
    the thread is gone and exits 1; this makes sure the reason is on record.
    """
    def log_thread_death(args):
        if issubclass(args.exc_type, SystemExit):
            return
        name = args.thread.name if args.thread is not None else "unknown"
        logger.critical("Thread %s died of an unexpected error", name,
                        exc_info=(args.exc_type, args.exc_value, args.exc_traceback))
    threading.excepthook = log_thread_death


def run_detection():
    # Stop signals and thread deaths first, so even start-up can be stopped
    # cleanly and nothing dies unrecorded.
    stop = threading.Event()
    install_stop_signals(stop)
    install_thread_death_logging()

    # ── Which camera, checked before anything else ────────────────────────
    #
    # A bad camera setting can't fix itself, so it stops start-up at once,
    # before the network or the model, with exit code 4: "bad configuration,
    # do not restart". Restarting would only fail the same way again.
    try:
        source = CameraSource.from_env(os.environ)
    except CameraConfigError as exc:
        logger.error("Camera setting rejected: %s", exc)
        raise SystemExit(4)
    configure_capture_logging(source)

    try:
        headless = decide_headless(os.environ, sys.platform)
    except ValueError as exc:
        logger.error("Setting rejected: %s", exc)
        raise SystemExit(4)
    if headless:
        logger.info("Headless mode: no window, no drawing, no keyboard.")

    # ── Verify the device key BEFORE loading the model or opening the camera ──
    #
    # Fail fast, deliberately. On 2026-08-20 this service ran for a full session
    # looking healthy while every write was failing — the SMS alerts still fired,
    # so it looked like it was working, and nothing was being recorded. Refusing
    # to start is far better than that.
    client = None
    queue = None
    replayer = None

    if API_ENABLED:
        client = AllClearClient(
            base_url=ALLCLEAR_API_URL,
            api_key=DEVICE_API_KEY,
            snapshot_mode=SNAPSHOT_MODE,
        )

        # The queue opens BEFORE the key check, so that a device which cannot
        # reach the API still has somewhere to put events. A site whose link is
        # down at boot is the exact situation this exists for.
        queue = EventQueue(QUEUE_DB_PATH)
        QUEUE_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        backlog = queue.counts()
        if backlog["pending"]:
            logger.info(
                "Queue has %s event(s) waiting from a previous run.", backlog["pending"]
            )
        if backlog["dead"]:
            logger.warning(
                "Queue has %s event(s) the server permanently refused — "
                "inspect %s, this usually means a misconfiguration.",
                backlog["dead"],
                QUEUE_DB_PATH,
            )

        try:
            logger.info("Verifying device key against %s ...", ALLCLEAR_API_URL)
            client.verify_key()
            logger.info("Device key accepted.")
        except AuthError as exc:
            # A rejected key is fatal: nothing this device queues will ever be
            # accepted, so queueing would just fill a disk with events that can
            # never be delivered.
            logger.error(
                "Device key REJECTED — this device is unknown or revoked. %s", exc
            )
            queue.close()
            # Exit 3: don't restart. A rejected key is rejected again forever;
            # someone has to provision a new one.
            return 3
        except AllClearError as exc:
            # Unreachable is NOT fatal any more. This is the outage case, and
            # the whole point of the queue is to keep watching through it.
            logger.warning(
                "Cannot reach the All Clear API at %s — %s. "
                "Detection continues; events will queue and replay automatically.",
                ALLCLEAR_API_URL,
                exc,
            )

        client.start_heartbeat(HEARTBEAT_SECONDS)
        replayer = QueueReplayer(queue, client, tick_seconds=REPLAY_SECONDS)
        replayer.start()

    logger.info("Loading PPE model...")
    detector = PPEDetector(model_path=MODEL_PATH)

    # One tracker per process — tracks debounce + cooldown state
    tracker = ViolationTracker(
        debounce_frames=DEBOUNCE_F,
        cooldown_seconds=COOLDOWN_S
    )

    print("\n" + "=" * 62)
    print("  All Clear — Live PPE Detection + Violation Logger")
    print(f"  Monitoring: {', '.join(sorted(VIOLATION_CLASSES))}")
    print(f"  Debounce: {DEBOUNCE_F} frames | Cooldown: {COOLDOWN_S}s")
    # Both on one line on purpose: CAMERA_ID says which camera row violations
    # are filed against, CAMERA_SOURCE where the video really comes from, and
    # nothing can check they match. A copied .env with the wrong pair files
    # camera B's violations as camera A's; here, at least, it is visible.
    print(f"  Camera:       {source.display}  ->  CAMERA_ID {CAMERA_ID}")
    mode = f"API → {ALLCLEAR_API_URL}" if API_ENABLED else "LOCAL LOG ONLY"
    print(f"  Storage mode: {mode}")
    snap = "requested (pending site confirmation)" if SNAPSHOT_MODE else "off"
    print(f"  Snapshots:    {snap}")
    sms_mode = "ON (after 201 only)" if TWILIO_ENABLED else "OFF (fill Twilio keys in .env)"
    print(f"  SMS alerts:   {sms_mode}")
    if queue is not None:
        c = queue.counts()
        print(f"  Outage queue: {QUEUE_DB_PATH}  ({c['pending']} pending, {c['dead']} dead)")
    if headless:
        print("  Headless:     no window. Stop with Ctrl+C, or the service manager")
    else:
        print("  Press  q or ESC  to quit  |  s  to save a snapshot")
        print("  NOTE: click the camera window first, THEN press q")
    print("=" * 62 + "\n")

    # The camera belongs to the reader thread: it connects, reads, and
    # reconnects when the stream breaks. The loop never touches the camera, it
    # only receives frames. A camera that isn't there yet is not a reason to
    # exit (G3): after a power cut the device boots before the camera does.
    # A recorded file gives every frame in order, then finishes.
    reader = FrameReader(
        source,
        open_timeout_s=CAMERA_OPEN_TIMEOUT_S,
        read_timeout_s=CAMERA_READ_TIMEOUT_S,
        refused_wait_s=CAMERA_REFUSED_WAIT_S,
    ).start()

    # Every thread the program depends on, and how to tell it is still running.
    # If one dies the loop exits 1, so the service manager starts a fresh
    # program: a half-dead one looks alive and watches nothing (plan §4.4).
    watched = {"camera reader": lambda: reader.is_alive() or reader.finished}
    if replayer is not None:
        watched["replay"] = replayer.is_alive
    if client is not None:
        watched["heartbeat"] = client.heartbeat_alive

    try:
        detection_loop(
            reader, detector, tracker, client, queue,
            stop=stop, headless=headless, watched=watched,
        )
    finally:
        # Runs however the loop ended, a crash included: let go of the camera,
        # stop the threads, say what's still queued.
        reader.stop()          # the reader releases the camera, on its own thread
        if not headless:
            cv2.destroyAllWindows()
        if replayer is not None:
            replayer.stop()
        if client is not None:
            # Stops the heartbeat thread, so the dashboard sees this device go
            # stale rather than showing it as alive after the process is gone.
            client.close()
        if queue is not None:
            left = queue.counts()
            if left["pending"]:
                # Said plainly on the way out. These are real violations that have
                # not reached the server; they will go on the next start.
                logger.warning(
                    "%s event(s) still queued — they will replay next start.",
                    left["pending"],
                )
            queue.close()

    if reader.unreadable:
        logger.error("Stopped: the video file in CAMERA_SOURCE can't be read.")
        return 4
    logger.info("Detection loop stopped cleanly.")
    return 0


def detection_loop(reader, detector, tracker, client, queue, *, stop, headless, watched):
    """Frames in, violations out, until asked to stop. Returns "stopped" or "finished".

    Kept apart from run_detection() so it can be run with a fake camera and a
    fake model (tests/test_loop.py). The alert path inside it, from "6. For
    each violation" down, was moved here in C5 without changing a line.

    Raises SystemExit(1) if a thread it depends on dies, or the model fails on
    MODEL_FAILURES_BEFORE_EXIT frames in a row: a fresh start is the fix for
    both, and exit code 1 asks the service manager for one.
    """
    fps = 0.0
    frame_count = 0
    fps_start = time.time()
    model_failures = 0     # in a row; reset by the first frame the model gets through

    while not stop.is_set():
        for name, alive in watched.items():
            if not alive():
                logger.critical(
                    "The %s thread died; exiting so the service manager restarts it.", name)
                raise SystemExit(1)

        # The newest frame not yet seen, or None if nothing new arrived within
        # the wait. Outages are the reader's business: it reconnects, and logs
        # each one once.
        try:
            received = reader.next_frame(timeout=FRAME_WAIT_SECONDS)
        except FrameReaderError:
            logger.critical(
                "The camera reader thread died; exiting so the service manager restarts it.")
            raise SystemExit(1)
        if received is None:
            if reader.finished:
                return "finished"   # a recorded file has ended
            if not headless and _quit_pressed(cv2.waitKey(1) & 0xFF):
                return "stopped"    # q still works while the camera is down
            continue
        frame = received.image

        # 1-2. YOLO, then keep the violation classes. One frame the model can't
        # handle is skipped; ten in a row means the model or GPU is broken, and
        # skipping forever would look like a safe site (decision D4).
        try:
            results = detector.predict(frame, confidence=CONFIDENCE)
            violations = detector.find_violations(results[0])
        except Exception:  # noqa: BLE001 - counted, logged, and capped below
            model_failures += 1
            logger.exception("Model failed on a frame (%d in a row); skipping it.",
                             model_failures)
            if model_failures >= MODEL_FAILURES_BEFORE_EXIT:
                logger.critical(
                    "Model failed on %d frames in a row; exiting so the service "
                    "manager restarts it.", model_failures)
                raise SystemExit(1)
            continue
        model_failures = 0

        # 3-5. Boxes, frame rate and status bar: only for a window to show.
        # Headless, nobody would see them.
        if not headless:
            annotated = results[0].plot()

            frame_count += 1
            if frame_count % 30 == 0:
                fps = 30 / (time.time() - fps_start)
                fps_start = time.time()

            num_violations = len(violations)
            label = f"FPS: {fps:.1f}  |  Active violations: {num_violations}"
            color = (0, 0, 220) if num_violations > 0 else (0, 180, 0)
            cv2.putText(annotated, label, (10, 32),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.85, color, 2, cv2.LINE_AA)

        # 6. For each violation — check debounce, then save + alert
        for v in violations:
            v_type = v["violation_type"]
            conf   = v["confidence"]

            logger.info(f"DETECTED   type={v_type}  conf={conf:.2f}")

            if tracker.should_alert(v_type):
                logger.info(f"ALERT      type={v_type} — debounce passed, firing pipeline")

                if not API_ENABLED:
                    logger.info(
                        f"[LOCAL] Would submit: type={v_type} conf={conf:.2f} "
                        f"camera={CAMERA_ID}"
                    )
                    continue

                # ── Mint the idempotency key HERE, once, for this event ──────
                #
                # Not inside a retry, not inside the client. This one value is
                # what lets the same incident be sent twice without becoming two
                # incidents, and it only works if every attempt carries the same
                # key. Step 3.5 will move this to enqueue time for the same
                # reason.
                idem = new_idempotency_key()
                # When the camera's frame arrived, not when the alert fired
                # (decision D2): the frame that passed the debounce, the same
                # one whose confidence is stored. UTC, same format as before.
                # It goes into the hash chain, so it should say when it happened.
                detected_at = received.arrived_at.isoformat()

                # Encode only if an image could actually be used. On a default
                # site nothing wants the bytes, and JPEG-encoding every
                # violation frame for nobody is pure waste.
                jpeg_bytes = None
                snapshot_path = None
                if client.wants_snapshot():
                    ok, buffer = cv2.imencode(".jpg", frame)
                    if ok:
                        jpeg_bytes = buffer.tobytes()
                        # Written to disk and referenced by PATH. The queue row
                        # never carries image bytes — a queue holding megabytes
                        # per event turns a long outage into a disk and memory
                        # problem on a machine that has little of either.
                        snapshot_path = str(QUEUE_IMAGE_DIR / f"{idem}.jpg")
                        Path(snapshot_path).write_bytes(jpeg_bytes)
                    else:
                        logger.warning("JPEG encode failed — submitting without an image")

                # ── ENQUEUE FIRST. This is the whole design. ─────────────────
                #
                # The event becomes durable on local disk BEFORE any network
                # call. If the link is down, if the API is broken, if this
                # process is killed one line from now — the violation survives
                # and the replay thread will deliver it.
                #
                # Doing it the other way round, sending first and queueing on
                # failure, loses everything that happens between the send and
                # the failure being handled.
                event_id = queue.enqueue(
                    idempotency_key=idem,
                    camera_id=CAMERA_ID,
                    violation_type=v_type,
                    confidence=conf,
                    detected_at=detected_at,
                    snapshot_path=snapshot_path,
                )

                try:
                    result = client.submit_violation(
                        camera_id=CAMERA_ID,
                        violation_type=v_type,
                        confidence=conf,
                        detected_at=detected_at,
                        idempotency_key=idem,
                        snapshot_requested=jpeg_bytes is not None,
                    )
                except AuthError as exc:
                    # Left pending with a backoff rather than killed: a device
                    # revoked by mistake, or a key rotated mid-shift, should not
                    # cost the violations detected in between.
                    logger.error("Submission REJECTED — device revoked? %s", exc)
                    queue.mark_failed(event_id, f"auth: {exc}")
                    continue
                except RejectedError as exc:
                    # The server refuses this event on its merits. Retrying it
                    # unchanged fails identically forever, so it is marked dead
                    # — but KEPT, so a misconfiguration is discoverable instead
                    # of silently eating every violation.
                    logger.error("Submission refused (fix configuration): %s", exc)
                    queue.mark_dead(event_id, str(exc))
                    if snapshot_path:
                        Path(snapshot_path).unlink(missing_ok=True)
                    continue
                except AllClearError as exc:
                    # The outage case. Nothing is lost — it is already on disk.
                    logger.warning(
                        "Offline; event queued for replay (%s pending): %s",
                        queue.counts()["pending"],
                        exc,
                    )
                    continue

                logger.info(
                    "API OK — violation=%s %s hash=%s...",
                    result.violation_id,
                    "DUPLICATE" if result.duplicate else "created",
                    result.event_hash[:12],
                )

                # ── Snapshot, if the server issued an upload URL ─────────────
                #
                # A failed image upload must never invalidate the violation.
                # The record already exists and is sealed into the hash chain;
                # a missing image is a degraded record, not a lost one.
                if result.snapshot_upload and jpeg_bytes:
                    try:
                        client.upload_snapshot(result.snapshot_upload, jpeg_bytes)
                        client.confirm_snapshot(result.violation_id)
                        logger.info("Snapshot uploaded and confirmed.")
                    except AllClearError as exc:
                        logger.warning(
                            "Snapshot failed for %s (the violation stands): %s",
                            result.violation_id,
                            exc,
                        )

                # Delivered. Mark it and drop the local image copy.
                queue.mark_sent(event_id, result.violation_id)
                if snapshot_path:
                    Path(snapshot_path).unlink(missing_ok=True)

                # ── SMS, and ONLY after a confirmed new record ───────────────
                #
                # This inverts the 2026-08-20 behaviour, where the SMS fired
                # whether or not the write succeeded — a supervisor could be
                # texted about an incident that existed nowhere. Every alert is
                # now backed by a row.
                #
                # A duplicate sends nothing: the server already had the event,
                # so a supervisor was already told, and re-texting on a retry
                # would teach people to ignore the alerts.
                #
                # This is the INTERIM arrangement. Whether alerting should move
                # server-side is still open (KNOWN_ISSUES finding 3) and is not
                # decided here.
                if TWILIO_ENABLED and result.should_alert:
                    send_violation_sms(
                        violation_type=v_type,
                        camera_name="Webcam Dev Camera",
                        snapshot_key=result.violation_id,
                    )

        if headless:
            continue
        cv2.imshow("All Clear — Detection", annotated)

        # waitKey(1) — minimal delay, GPU inference controls actual FPS now
        key = cv2.waitKey(1) & 0xFF
        if _quit_pressed(key):
            logger.info("Quit key pressed.")
            return "stopped"
        elif key == ord('s'):
            snapshot_path = Path("../docs/phase1_snapshot.jpg")
            snapshot_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(snapshot_path), annotated)
            logger.info(f"Snapshot saved → {snapshot_path.resolve()}")

    logger.info("Stop requested; the frame in hand is finished. Shutting down.")
    return "stopped"


def _quit_pressed(key):
    return key == ord('q') or key == 27  # 27 = ESC


if __name__ == "__main__":
    sys.exit(run_detection())
