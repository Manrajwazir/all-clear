"""
api_client.py — the detection service's only door to the All Clear API.
Phase 3, Step 3.4.

────────────────────────────────────────────────────────────────────────────
WHY THIS MODULE EXISTS AT ALL

Before this, main.py held the Supabase service-role key and the S3 keys and
wrote to both directly. That works on one laptop and cannot ship: the
service-role key bypasses every access rule in the database, and this process
runs on a small computer in an unlocked job-site trailer. One stolen SD card
would hand over every customer's data.

After this, the device holds exactly one credential — a device API key scoped
to one device, one site, one organisation, revocable from the dashboard by
flipping a single column. It cannot read another site's data. It cannot delete
anything. It cannot even name its own organisation: the server derives that
from the key.

Everything HTTP lives here. main.py should never import `requests`.
────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import requests

logger = logging.getLogger(__name__)


# ── Error taxonomy ─────────────────────────────────────────────────────────
#
# Three kinds, because the right reaction to each is different — and Step 3.5's
# offline queue will branch on exactly this distinction. Collapsing them into
# one exception is how a queue ends up retrying a malformed payload forever.


class AllClearError(Exception):
    """Base class for every failure this module raises."""


class AuthError(AllClearError):
    """
    401 or 403. The key is wrong, or the device has been revoked.

    NEVER RETRY THIS. Retrying a revoked key is how a decommissioned device
    keeps hammering the API from a site nobody is monitoring any more. The
    correct response is to stop and make noise.
    """


class RejectedError(AllClearError):
    """
    A 4xx we caused: malformed payload, a camera that is not at our site, a
    snapshot offered to a site that did not opt in.

    Do not retry the identical request — it will be rejected identically. The
    event should be dropped and logged loudly enough that someone fixes the
    configuration.
    """


class TransientError(AllClearError):
    """
    5xx, 429, a timeout, or a dead network.

    Retry later. This is the only class of failure the offline queue should
    hold on to.
    """


#: 403 response codes that really do mean "this device may not act", as opposed
#: to "this request was wrong". Everything else the API returns with a 403 is a
#: payload or configuration problem — see the note in `_post`.
_AUTH_FAILURE_CODES = frozenset({"device_not_active"})


# ── Result types ───────────────────────────────────────────────────────────


@dataclass
class SnapshotUpload:
    """A one-shot presigned S3 PUT. Valid for `expires_in` seconds."""

    url: str
    content_type: str
    expires_in: int


@dataclass
class SubmitResult:
    violation_id: str
    event_hash: str
    received_at: str
    #: True when the server already had this event. See `should_alert`.
    duplicate: bool
    #: Whether this SITE captures imagery at all — learned, not configured.
    snapshot_enabled: bool
    snapshot_upload: SnapshotUpload | None

    @property
    def should_alert(self) -> bool:
        """
        Whether an SMS should fire for this result.

        Only for a genuinely new record. A duplicate means the server already
        had this event, which means a supervisor was already told about it —
        re-alerting on a retry would turn one incident into several texts and
        teach people to ignore the alerts.
        """
        return not self.duplicate


def new_idempotency_key() -> str:
    """
    Mint the key that makes a retry safe.

    ⚠ CALL THIS ONCE PER EVENT, AT THE MOMENT THE EVENT IS FIRST OBSERVED —
    never inside a retry loop.

    The whole mechanism rests on the same event carrying the same key across
    every attempt. Generating a fresh key on retry produces a second key for
    one incident, the server correctly treats it as a second incident, and the
    duplicate protection silently does nothing. Step 3.5's queue mints this at
    enqueue time for exactly this reason.
    """
    return str(uuid.uuid4())


def utc_now_iso() -> str:
    """
    An RFC 3339 timestamp with an explicit UTC offset.

    Produces `...+00:00`, which the server's validator accepts alongside `...Z`.
    A naive local timestamp would be read as UTC and silently shift the record
    by the machine's timezone offset — and `detected_at` is a hashed field, so
    the wrong value would be sealed in permanently.
    """
    return datetime.now(timezone.utc).isoformat()


# ── The client ─────────────────────────────────────────────────────────────


class AllClearClient:
    """
    Talks to the All Clear device API.

    One instance per process. Thread-safe for the usage here: the heartbeat
    thread and the detection loop each use their own `requests` call, and the
    only shared mutable state is a boolean written by whichever learns first.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        timeout: float = 10.0,
        snapshot_mode: bool = False,
    ) -> None:
        if not base_url:
            raise ValueError("ALLCLEAR_API_URL is not set")
        if not api_key:
            raise ValueError("DEVICE_API_KEY is not set")

        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        #: What the OPERATOR asked for. Necessary but not sufficient.
        self._snapshot_mode_requested = snapshot_mode

        #: What the SERVER has confirmed about this site. None until we have
        #: heard back once. See `wants_snapshot` for why both are needed.
        self._site_snapshot_enabled: bool | None = None

        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "all-clear-detection/1.0",
            }
        )

        self._stop = threading.Event()
        self._heartbeat_thread: threading.Thread | None = None

    # ── internals ──────────────────────────────────────────────────────────

    def _post(self, path: str, json_body: dict | None = None) -> requests.Response:
        url = f"{self.base_url}{path}"
        try:
            response = self._session.post(url, json=json_body, timeout=self.timeout)
        except requests.RequestException as exc:
            # A dead network is transient by definition. It is also the single
            # most likely failure on a construction site.
            raise TransientError(f"{path}: {exc}") from exc

        status = response.status_code

        if status == 401:
            raise AuthError(f"{path}: 401 {self._body_text(response)}")

        if status == 403:
            # ⚠ NOT EVERY 403 IS AN AUTHENTICATION PROBLEM.
            #
            # The API uses 403 for two different situations, and conflating
            # them is a real bug rather than an inelegance:
            #
            #   "this device is switched off"  → stop, and make noise
            #   "that camera is not at your site" → drop this event and fix
            #                                       the configuration
            #
            # The first must never be retried. The second must never be
            # reported as "device revoked", because someone would go looking
            # at the wrong thing entirely — and Step 3.5's queue branches on
            # this distinction to decide what to hold and what to discard.
            #
            # Caught by tests/test_api_client.py, which submits a camera
            # belonging to another site and requires RejectedError.
            code = self._body_code(response)
            if code and code not in _AUTH_FAILURE_CODES:
                raise RejectedError(f"{path}: 403 {self._body_text(response)}")
            # No code at all is the device-auth revocation body, which is a
            # genuine auth failure.
            raise AuthError(f"{path}: 403 {self._body_text(response)}")

        if status == 429 or status >= 500:
            raise TransientError(f"{path}: {status} {self._body_text(response)}")

        if status >= 400:
            raise RejectedError(f"{path}: {status} {self._body_text(response)}")

        return response

    @staticmethod
    def _body_code(response: requests.Response) -> str | None:
        """The API's machine-readable `code`, when there is one."""
        try:
            body = response.json()
        except ValueError:
            return None
        return body.get("code") if isinstance(body, dict) else None

    @staticmethod
    def _body_text(response: requests.Response) -> str:
        try:
            return str(response.json())
        except ValueError:
            return response.text[:200]

    # ── snapshot policy ────────────────────────────────────────────────────

    def wants_snapshot(self) -> bool:
        """
        Whether to ask for an image upload on the NEXT violation.

        Requires BOTH the operator's intent AND server confirmation, and that
        second condition is not belt-and-braces — it prevents total data loss.

        A snapshot offered to a site that has not opted in does not merely lose
        the image: the server rejects the WHOLE submission, so the violation is
        not recorded at all. A device misconfigured with snapshot_mode=true
        against an opted-out site would therefore drop every single incident,
        silently, forever.

        So the client never guesses. It submits without a snapshot until the
        server tells it — in the `snapshot_enabled` field of any response —
        that this site captures imagery. The cost is that the very first
        violation after a restart carries no image. The benefit is that a
        misconfiguration can never cost a safety record.
        """
        return self._snapshot_mode_requested and self._site_snapshot_enabled is True

    # ── endpoints ──────────────────────────────────────────────────────────

    def heartbeat(self, status: str = "online", **metrics) -> None:
        """
        Tell the server this device is alive. Raises on failure.

        Also the cheapest way to verify a key at startup: it is the only
        endpoint that authenticates and changes nothing but a timestamp.
        """
        body: dict = {"status": status}
        for name in ("cpu_temp", "uptime_seconds", "model_version"):
            if name in metrics and metrics[name] is not None:
                body[name] = metrics[name]
        self._post("/api/v1/devices/heartbeat", body)

    def verify_key(self) -> None:
        """
        Fail fast at startup if the key is wrong, revoked, or the API is down.

        Better to refuse to start than to run for six hours looking healthy and
        discover at the first violation that nothing was ever being recorded.
        That is close to what happened on 2026-08-20.
        """
        self.heartbeat(status="online")

    def submit_violation(
        self,
        *,
        camera_id: str,
        violation_type: str,
        confidence: float,
        detected_at: str,
        idempotency_key: str,
        snapshot_requested: bool = False,
    ) -> SubmitResult:
        """
        File a violation.

        Note what is NOT sent: organisation, site, received_at, or any hash.
        The server derives all of them. A device that could name its own
        organisation could file fabricated violations against another company.
        """
        response = self._post(
            "/api/v1/violations",
            {
                "camera_id": camera_id,
                "violation_type": violation_type,
                "confidence": confidence,
                "detected_at": detected_at,
                "idempotency_key": idempotency_key,
                "snapshot_requested": snapshot_requested,
            },
        )
        data = response.json()

        # Learn the site's imagery setting from whatever came back.
        self._site_snapshot_enabled = bool(data.get("snapshot_enabled"))

        upload_raw = data.get("snapshot_upload")
        upload = (
            SnapshotUpload(
                url=upload_raw["url"],
                content_type=upload_raw["content_type"],
                expires_in=int(upload_raw["expires_in"]),
            )
            if upload_raw
            else None
        )

        return SubmitResult(
            violation_id=data["violation_id"],
            event_hash=data["event_hash"],
            received_at=data["received_at"],
            duplicate=bool(data.get("duplicate")),
            snapshot_enabled=self._site_snapshot_enabled,
            snapshot_upload=upload,
        )

    def upload_snapshot(self, upload: SnapshotUpload, jpeg_bytes: bytes) -> None:
        """
        PUT the image straight to S3. The API never sees these bytes.

        The Content-Type must match what the URL was signed for, or S3 rejects
        the request — that binding is deliberate, so the link cannot be reused
        to store something that is not an image.
        """
        try:
            response = requests.put(
                upload.url,
                data=jpeg_bytes,
                headers={"Content-Type": upload.content_type},
                timeout=max(self.timeout, 30.0),  # images are bigger than JSON
            )
        except requests.RequestException as exc:
            raise TransientError(f"snapshot upload: {exc}") from exc

        if not response.ok:
            raise TransientError(
                f"snapshot upload: {response.status_code} {response.text[:200]}"
            )

    def confirm_snapshot(self, violation_id: str) -> None:
        """
        Tell the server the upload finished, so it can verify and record it.

        The server independently checks the object is really in the bucket
        before writing anything, so this is a request to verify rather than an
        assertion to be believed. Safe to call twice.
        """
        self._post(f"/api/v1/violations/{violation_id}/snapshot")

    # ── heartbeat thread ───────────────────────────────────────────────────

    def start_heartbeat(self, interval_seconds: int = 30) -> None:
        """
        Begin sending a heartbeat on a background daemon thread.

        Daemon so it can never keep the process alive after the detection loop
        exits. Failures are logged and swallowed: a missed heartbeat means the
        dashboard shows this device as stale, which is exactly what it should
        show — it is not a reason to stop detecting.
        """
        if self._heartbeat_thread is not None:
            return

        def loop() -> None:
            while not self._stop.wait(interval_seconds):
                try:
                    self.heartbeat()
                except AuthError as exc:
                    # Worth its own branch: this device has been switched off.
                    # Keep detecting locally, but say so loudly.
                    logger.error("Heartbeat rejected — device revoked? %s", exc)
                except AllClearError as exc:
                    logger.warning("Heartbeat failed: %s", exc)

        self._heartbeat_thread = threading.Thread(
            target=loop, name="allclear-heartbeat", daemon=True
        )
        self._heartbeat_thread.start()
        logger.info("Heartbeat thread started (every %ss).", interval_seconds)

    def close(self) -> None:
        """Stop the heartbeat thread and release the HTTP session."""
        self._stop.set()
        if self._heartbeat_thread is not None:
            self._heartbeat_thread.join(timeout=2.0)
            self._heartbeat_thread = None
        self._session.close()
