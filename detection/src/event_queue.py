"""
event_queue.py — the local outage queue.
Phase 3, Step 3.5.

────────────────────────────────────────────────────────────────────────────
THE PROBLEM THIS SOLVES

Construction sites lose internet. Before this module, a violation detected
during an outage was gone — main.py logged "EVENT LOST (no queue yet)" and the
compliance record simply had a hole in it. A record with unexplained gaps is
worse than useless to an auditor, because there is no way to distinguish "the
site was safe" from "the system was not watching".

THE RULE THAT MAKES IT WORK: ENQUEUE BEFORE SENDING.

The event is written to local disk FIRST, and only then is a network call
attempted. Not the other way around. If the process is killed mid-send, if the
link drops, if the API is down — the event is already durable. Sending is a
separate concern from recording.

────────────────────────────────────────────────────────────────────────────
WHY THE REPLAY WORKER CANNOT SEND AN SMS

A supervisor buzzed about a violation from forty minutes ago is noise at best
and alarming at worst — they will walk out to a hazard that is long gone. So
replayed events must never text anyone.

That is not enforced by a flag or a conditional. `QueueReplayer` is simply
never given a way to send an SMS: no Twilio import, no callback parameter,
nothing. The only code that can alert is the first-attempt path in main.py.
A rule you cannot break by forgetting a condition is worth more than a rule
you have to remember.
────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
import sqlite3
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from api_client import AllClearClient, AllClearError, AuthError, RejectedError

logger = logging.getLogger(__name__)

#: Delay before each retry, in seconds, indexed by attempts already made.
#: Capped at the last value — a site that has been offline for an hour should
#: keep trying every five minutes, not every four hours.
BACKOFF_SECONDS = (30, 60, 120, 240, 300)

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key  TEXT    NOT NULL UNIQUE,
    camera_id        TEXT    NOT NULL,
    violation_type   TEXT    NOT NULL,
    confidence       REAL    NOT NULL,
    detected_at      TEXT    NOT NULL,
    -- A PATH on local disk, never the JPEG bytes. Inlining images would make
    -- every queue read carry megabytes and turn replay into a memory problem.
    snapshot_path    TEXT,
    status           TEXT    NOT NULL DEFAULT 'pending',  -- pending|sent|dead
    attempts         INTEGER NOT NULL DEFAULT 0,
    next_attempt_at  REAL    NOT NULL DEFAULT 0,
    last_error       TEXT,
    enqueued_at      REAL    NOT NULL,
    sent_at          REAL,
    violation_id     TEXT
);
CREATE INDEX IF NOT EXISTS events_pending
    ON events (status, next_attempt_at);
"""


@dataclass
class QueuedEvent:
    id: int
    idempotency_key: str
    camera_id: str
    violation_type: str
    confidence: float
    detected_at: str
    snapshot_path: str | None
    attempts: int


class EventQueue:
    """
    A durable local queue of violations awaiting delivery.

    SQLite in WAL mode. WAL matters here specifically: the detection thread
    writes while the replay thread reads, and the default rollback journal has
    them block each other — a stalled write in the detection loop means dropped
    camera frames.
    """

    def __init__(self, db_path: str | Path = "queue.db") -> None:
        self.path = Path(db_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

        # check_same_thread=False plus an explicit lock, rather than a
        # connection per thread. Two threads, short transactions; the lock is
        # simpler to reason about than thread-local connection lifetimes.
        self._conn = sqlite3.connect(
            self.path, check_same_thread=False, timeout=10.0
        )
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()

        with self._lock:
            self._conn.execute("PRAGMA journal_mode=WAL")
            # NORMAL rather than FULL: one fsync per checkpoint instead of one
            # per write. On a device writing a handful of rows a minute the
            # durability difference is a power cut in the same millisecond as
            # an insert; the throughput difference is real.
            self._conn.execute("PRAGMA synchronous=NORMAL")
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    # ── writing ────────────────────────────────────────────────────────────

    def enqueue(
        self,
        *,
        idempotency_key: str,
        camera_id: str,
        violation_type: str,
        confidence: float,
        detected_at: str,
        snapshot_path: str | None = None,
    ) -> int:
        """
        Record the event locally. Call this BEFORE attempting to send.

        The idempotency_key must already exist — it is minted at the moment the
        event is observed, and the same key travels with every retry. That is
        the whole reason a replay is safe: the server collapses every attempt
        into one row. Minting a key per attempt would turn one incident into
        one row per retry.
        """
        with self._lock:
            cur = self._conn.execute(
                """
                INSERT INTO events (idempotency_key, camera_id, violation_type,
                                    confidence, detected_at, snapshot_path,
                                    enqueued_at, next_attempt_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    idempotency_key,
                    camera_id,
                    violation_type,
                    confidence,
                    detected_at,
                    snapshot_path,
                    time.time(),
                ),
            )
            self._conn.commit()
            return int(cur.lastrowid)

    def mark_sent(self, event_id: int, violation_id: str) -> None:
        with self._lock:
            self._conn.execute(
                "UPDATE events SET status='sent', sent_at=?, violation_id=?, "
                "last_error=NULL WHERE id=?",
                (time.time(), violation_id, event_id),
            )
            self._conn.commit()

    def mark_failed(self, event_id: int, error: str) -> None:
        """A transient failure. Schedule the next attempt with backoff."""
        with self._lock:
            row = self._conn.execute(
                "SELECT attempts FROM events WHERE id=?", (event_id,)
            ).fetchone()
            attempts = (row["attempts"] if row else 0) + 1
            delay = BACKOFF_SECONDS[min(attempts - 1, len(BACKOFF_SECONDS) - 1)]
            self._conn.execute(
                "UPDATE events SET attempts=?, next_attempt_at=?, last_error=? "
                "WHERE id=?",
                (attempts, time.time() + delay, error[:500], event_id),
            )
            self._conn.commit()

    def mark_dead(self, event_id: int, reason: str) -> None:
        """
        The server rejected this event on its merits — a camera that is not at
        this site, a payload the schema refuses. Retrying it unchanged would
        fail identically forever, so it stops here.

        The row is KEPT, not deleted. A queue that silently discards its
        failures gives you no way to find out that a device has been
        misconfigured for three weeks.
        """
        with self._lock:
            self._conn.execute(
                "UPDATE events SET status='dead', last_error=? WHERE id=?",
                (reason[:500], event_id),
            )
            self._conn.commit()

    # ── reading ────────────────────────────────────────────────────────────

    def due(self, limit: int = 50) -> list[QueuedEvent]:
        """Pending events whose backoff has elapsed, oldest first."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM events WHERE status='pending' AND next_attempt_at<=? "
                "ORDER BY enqueued_at LIMIT ?",
                (time.time(), limit),
            ).fetchall()
        return [
            QueuedEvent(
                id=r["id"],
                idempotency_key=r["idempotency_key"],
                camera_id=r["camera_id"],
                violation_type=r["violation_type"],
                confidence=r["confidence"],
                detected_at=r["detected_at"],
                snapshot_path=r["snapshot_path"],
                attempts=r["attempts"],
            )
            for r in rows
        ]

    def counts(self) -> dict[str, int]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT status, COUNT(*) AS n FROM events GROUP BY status"
            ).fetchall()
        out = {"pending": 0, "sent": 0, "dead": 0}
        for r in rows:
            out[r["status"]] = r["n"]
        return out

    def close(self) -> None:
        with self._lock:
            self._conn.close()


class QueueReplayer:
    """
    Drains the queue in the background.

    ⚠ HAS NO WAY TO SEND AN SMS, AND MUST NOT ACQUIRE ONE.

    See the module docstring. A replayed violation is historical: the record
    belongs in the database and on the dashboard, but nobody should be paged
    about a hazard from forty minutes ago. Enforced by omission rather than by
    a condition someone can forget to write.
    """

    def __init__(
        self,
        queue: EventQueue,
        client: AllClearClient,
        *,
        tick_seconds: int = 30,
    ) -> None:
        self.queue = queue
        self.client = client
        self.tick_seconds = tick_seconds
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def drain_once(self) -> tuple[int, int]:
        """
        One pass over everything currently due. Returns (sent, still_pending).

        Public and synchronous so tests can drive replay deterministically
        instead of sleeping and hoping.
        """
        sent = failed = 0
        for event in self.queue.due():
            if self._send(event):
                sent += 1
            else:
                failed += 1
        return sent, failed

    def _send(self, event: QueuedEvent) -> bool:
        try:
            result = self.client.submit_violation(
                camera_id=event.camera_id,
                violation_type=event.violation_type,
                confidence=event.confidence,
                detected_at=event.detected_at,
                idempotency_key=event.idempotency_key,
                snapshot_requested=bool(event.snapshot_path)
                and self.client.wants_snapshot(),
            )
        except AuthError as exc:
            # Not retryable and not the event's fault. Leave it pending with a
            # backoff so it survives a key rotation, but say so loudly — this
            # usually means the device was revoked.
            logger.error("Replay blocked, device rejected: %s", exc)
            self.queue.mark_failed(event.id, f"auth: {exc}")
            return False
        except RejectedError as exc:
            logger.error(
                "Replay giving up on event %s — the server refuses it: %s",
                event.idempotency_key,
                exc,
            )
            self.queue.mark_dead(event.id, str(exc))
            self._discard_image(event)
            return False
        except AllClearError as exc:
            logger.info("Replay deferred (attempt %s): %s", event.attempts + 1, exc)
            self.queue.mark_failed(event.id, str(exc))
            return False

        # A duplicate is a SUCCESS from the queue's point of view: the server
        # already holds this event, which is exactly the outcome we wanted.
        # It happens when a send succeeded but the response never arrived.
        if event.snapshot_path and result.snapshot_upload:
            self._upload_image(event, result)

        self.queue.mark_sent(event.id, result.violation_id)
        self._discard_image(event)
        logger.info(
            "Replayed %s → violation=%s%s",
            event.violation_type,
            result.violation_id,
            " (already had it)" if result.duplicate else "",
        )
        return True

    def _upload_image(self, event: QueuedEvent, result) -> None:
        try:
            data = Path(event.snapshot_path).read_bytes()
        except OSError as exc:
            logger.warning("Queued image missing for %s: %s", event.idempotency_key, exc)
            return
        try:
            self.client.upload_snapshot(result.snapshot_upload, data)
            self.client.confirm_snapshot(result.violation_id)
        except AllClearError as exc:
            # The violation is recorded; only the image failed. Do not fail the
            # event over it — that would resend an event the server already has.
            logger.warning("Replayed image upload failed: %s", exc)

    @staticmethod
    def _discard_image(event: QueuedEvent) -> None:
        if not event.snapshot_path:
            return
        try:
            Path(event.snapshot_path).unlink(missing_ok=True)
        except OSError:
            pass

    def start(self) -> None:
        if self._thread is not None:
            return

        def loop() -> None:
            while not self._stop.wait(self.tick_seconds):
                try:
                    sent, failed = self.drain_once()
                    if sent or failed:
                        logger.info("Queue drain: %s sent, %s still waiting", sent, failed)
                except Exception:  # noqa: BLE001 - a replay bug must not kill the thread
                    logger.exception("Replay pass failed")

        self._thread = threading.Thread(target=loop, name="allclear-replay", daemon=True)
        self._thread.start()
        logger.info("Queue replay thread started (every %ss).", self.tick_seconds)

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
