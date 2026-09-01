"""
test_event_queue.py — the outage queue.
Phase 3, Step 3.5.

The first half is pure: no network, no database, no dashboard. It runs
anywhere and covers the mechanics that decide whether an incident survives an
outage.

The second half needs a running dashboard and simulates an actual outage by
pointing the client at a dead port, then repointing it and draining.

    pytest tests/test_event_queue.py -v
"""

import base64
import os
import sqlite3
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from api_client import AllClearClient, new_idempotency_key, utc_now_iso  # noqa: E402
from event_queue import BACKOFF_SECONDS, EventQueue, QueueReplayer  # noqa: E402

load_dotenv(Path(__file__).parent.parent / ".env")

API_URL = os.getenv("ALLCLEAR_API_URL", "http://localhost:3000")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

#: RFC 6335 discard port. Nothing listens; a connect fails immediately, which
#: is a faithful stand-in for a site whose link has dropped.
DEAD_URL = "http://127.0.0.1:9"


def _sample(**over):
    base = dict(
        idempotency_key=new_idempotency_key(),
        camera_id=str(uuid.uuid4()),
        violation_type="no_hardhat",
        confidence=0.83,
        detected_at=utc_now_iso(),
    )
    base.update(over)
    return base


# ══════════════════════════════════════════════════════════════════════════
# Pure mechanics — always run
# ══════════════════════════════════════════════════════════════════════════


def test_the_queue_opens_in_wal_mode(tmp_path):
    """
    Not a detail. The detection thread writes while the replay thread reads,
    and the default rollback journal makes them block each other — a stalled
    write inside the detection loop means dropped camera frames.
    """
    q = EventQueue(tmp_path / "q.db")
    mode = sqlite3.connect(tmp_path / "q.db").execute(
        "PRAGMA journal_mode"
    ).fetchone()[0]
    q.close()
    assert mode.lower() == "wal"


def test_an_enqueued_event_is_immediately_due(tmp_path):
    q = EventQueue(tmp_path / "q.db")
    q.enqueue(**_sample())
    assert q.counts()["pending"] == 1
    assert len(q.due()) == 1, "a fresh event must be sent now, not after a delay"
    q.close()


def test_marking_sent_removes_it_from_the_work_list(tmp_path):
    q = EventQueue(tmp_path / "q.db")
    eid = q.enqueue(**_sample())
    q.mark_sent(eid, str(uuid.uuid4()))
    assert q.counts() == {"pending": 0, "sent": 1, "dead": 0}
    assert q.due() == []
    q.close()


def test_a_failure_schedules_a_retry_instead_of_dropping_the_event(tmp_path):
    q = EventQueue(tmp_path / "q.db")
    eid = q.enqueue(**_sample())
    q.mark_failed(eid, "connection refused")

    assert q.counts()["pending"] == 1, "still ours to deliver"
    assert q.due() == [], "but not yet — the backoff has not elapsed"
    q.close()


def test_the_backoff_lengthens_and_then_caps(tmp_path):
    """
    30s, 60s, 120s, 240s, then every 5 minutes forever. It must CAP: a site
    that has been offline an hour should keep trying every five minutes, not
    drift out to hours between attempts and deliver yesterday's violations
    tomorrow.
    """
    q = EventQueue(tmp_path / "q.db")
    eid = q.enqueue(**_sample())

    seen = []
    for _ in range(7):
        before = time.time()
        q.mark_failed(eid, "still down")
        row = q._conn.execute(
            "SELECT next_attempt_at FROM events WHERE id=?", (eid,)
        ).fetchone()
        seen.append(round(row["next_attempt_at"] - before))

    assert seen[:5] == list(BACKOFF_SECONDS), seen
    assert seen[5] == BACKOFF_SECONDS[-1], "must cap, not keep growing"
    assert seen[6] == BACKOFF_SECONDS[-1]
    q.close()


def test_a_rejected_event_is_marked_dead_but_kept(tmp_path):
    """
    Kept, not deleted. A queue that silently discards what the server refused
    gives nobody a way to discover that a device has been misconfigured for
    three weeks.
    """
    q = EventQueue(tmp_path / "q.db")
    eid = q.enqueue(**_sample())
    q.mark_dead(eid, "camera not at this site")

    assert q.counts() == {"pending": 0, "sent": 0, "dead": 1}
    assert q.due() == [], "never retried"

    row = q._conn.execute("SELECT last_error FROM events WHERE id=?", (eid,)).fetchone()
    assert "camera" in row["last_error"], "the reason must survive for diagnosis"
    q.close()


def test_the_same_event_cannot_be_enqueued_twice(tmp_path):
    """The UNIQUE constraint on idempotency_key is the local half of the
    duplicate protection the server enforces remotely."""
    q = EventQueue(tmp_path / "q.db")
    ev = _sample()
    q.enqueue(**ev)
    with pytest.raises(sqlite3.IntegrityError):
        q.enqueue(**ev)
    q.close()


def test_events_survive_the_process_dying(tmp_path):
    """The entire premise: durable before the network is ever touched."""
    db = tmp_path / "q.db"
    q1 = EventQueue(db)
    ev = _sample()
    q1.enqueue(**ev)
    q1.close()  # simulate the process being killed

    q2 = EventQueue(db)
    due = q2.due()
    assert len(due) == 1
    assert due[0].idempotency_key == ev["idempotency_key"]
    q2.close()


def test_events_come_back_oldest_first(tmp_path):
    q = EventQueue(tmp_path / "q.db")
    keys = []
    for _ in range(3):
        ev = _sample()
        keys.append(ev["idempotency_key"])
        q.enqueue(**ev)
        time.sleep(0.01)
    assert [e.idempotency_key for e in q.due()] == keys
    q.close()


def test_the_replayer_has_no_way_to_send_an_sms():
    """
    A structural guarantee, asserted structurally.

    Replayed events must never text anyone — a supervisor paged about a hazard
    from forty minutes ago will walk out to nothing. Rather than trusting a
    conditional that someone could later invert, the replay path simply has no
    access to Twilio or to alerts.py. This test fails if anyone gives it some.

    Parses the IMPORTS rather than grepping the text: the first version of this
    matched its own explanatory comment and failed on prose.
    """
    import ast
    import inspect

    source = (Path(__file__).parent.parent / "src" / "event_queue.py").read_text()

    imported: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            for a in node.names:
                imported.add(a.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imported.add(node.module.split(".")[0])
            for a in node.names:
                imported.add(a.name)

    for forbidden in ("twilio", "alerts", "send_violation_sms", "send_daily_digest"):
        assert forbidden not in imported, (
            f"event_queue.py imports {forbidden!r} — replayed events must never alert"
        )

    # Nor may one be injected: no constructor parameter can carry a callback in.
    params = set(inspect.signature(QueueReplayer.__init__).parameters)
    assert params == {"self", "queue", "client", "tick_seconds"}, (
        f"QueueReplayer gained a parameter: {params}. If it is an alert hook, "
        "replayed events can now text people."
    )


# ══════════════════════════════════════════════════════════════════════════
# Outage integration — needs a running dashboard
# ══════════════════════════════════════════════════════════════════════════


def _server_up() -> bool:
    try:
        requests.head(API_URL, timeout=3)
        return True
    except requests.RequestException:
        return False


needs_server = pytest.mark.skipif(
    not (SUPABASE_URL and SERVICE_KEY and _server_up()),
    reason="needs detection/.env credentials and a dashboard at ALLCLEAR_API_URL",
)


@pytest.fixture(scope="module")
def live():
    from supabase import create_client

    db = create_client(SUPABASE_URL, SERVICE_KEY)
    tag = f"zz-test-queue-{int(time.time())}"
    made = {"org": None, "user": None, "site": None, "camera": None, "device": None}

    try:
        made["org"] = (
            db.table("organizations").insert({"name": tag, "slug": tag})
            .execute().data[0]["id"]
        )
        made["user"] = str(uuid.uuid4())
        db.table("users").insert({
            "id": made["user"], "organization_id": made["org"],
            "email": f"{tag}@example.invalid", "role": "org_admin", "status": "active",
        }).execute()
        made["site"] = (
            db.table("sites").insert({
                "organization_id": made["org"], "name": f"{tag}-site",
                "timezone": "America/Edmonton", "snapshot_mode": False,
                "pipa_attestation_completed": True,
                "pipa_attestation_by": made["user"],
                "pipa_attestation_at": datetime.now(timezone.utc).isoformat(),
            }).execute().data[0]["id"]
        )
        made["camera"] = (
            db.table("cameras").insert({
                "organization_id": made["org"], "site_id": made["site"],
                "name": f"{tag}-cam",
            }).execute().data[0]["id"]
        )

        import hashlib
        import secrets

        token = secrets.token_urlsafe(32)
        made["device"] = (
            db.table("devices").insert({
                "organization_id": made["org"], "site_id": made["site"],
                "name": f"{tag}-device", "status": "pending",
                "provisioning_token_hash": hashlib.sha256(token.encode()).hexdigest(),
                "provisioning_token_expires_at":
                    (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat(),
            }).execute().data[0]["id"]
        )
        res = requests.post(
            f"{API_URL}/api/v1/devices/provision",
            json={"provisioning_token": token},
            headers={"x-forwarded-for": "203.0.113.71"},
            timeout=10,
        )
        assert res.status_code == 200, f"provision: {res.status_code} {res.text}"

        yield {"db": db, "api_key": res.json()["api_key"], "camera": made["camera"],
               "device": made["device"]}
    finally:
        if made["device"]:
            db.table("violations").delete().eq("device_id", made["device"]).execute()
            db.table("devices").delete().eq("id", made["device"]).execute()
        if made["camera"]:
            db.table("cameras").delete().eq("id", made["camera"]).execute()
        if made["site"]:
            db.table("sites").delete().eq("id", made["site"]).execute()
        if made["user"]:
            db.table("users").delete().eq("id", made["user"]).execute()
        if made["org"]:
            db.table("organizations").delete().eq("id", made["org"]).execute()
        db.table("rate_limit_counters").delete().like(
            "bucket", "ip:203.0.113.%"
        ).execute()


@needs_server
def test_an_outage_loses_nothing_and_replay_delivers_it(live, tmp_path):
    """
    The whole feature, end to end.

    Offline: the event is enqueued and the send fails. Back online: the replay
    thread delivers it. The violation reaches the database with the SAME
    idempotency key it was given when it was first observed.
    """
    q = EventQueue(tmp_path / "q.db")

    # ── the link is down ───────────────────────────────────────────────
    offline = AllClearClient(DEAD_URL, live["api_key"], timeout=2.0)
    ev = _sample(camera_id=live["camera"])
    eid = q.enqueue(**ev)

    from api_client import AllClearError

    with pytest.raises(AllClearError):
        offline.submit_violation(
            camera_id=ev["camera_id"], violation_type=ev["violation_type"],
            confidence=ev["confidence"], detected_at=ev["detected_at"],
            idempotency_key=ev["idempotency_key"],
        )
    q.mark_failed(eid, "connection refused")

    assert q.counts()["pending"] == 1, "the event survived the outage"
    rows = (
        live["db"].table("violations").select("id")
        .eq("idempotency_key", ev["idempotency_key"]).execute().data
    )
    assert rows == [], "and nothing reached the server"

    # ── the link comes back ────────────────────────────────────────────
    # Reach past the backoff rather than sleeping 30 seconds for it.
    q._conn.execute("UPDATE events SET next_attempt_at=0 WHERE id=?", (eid,))
    q._conn.commit()

    online = AllClearClient(API_URL, live["api_key"])
    sent, failed = QueueReplayer(q, online).drain_once()

    assert (sent, failed) == (1, 0)
    assert q.counts() == {"pending": 0, "sent": 1, "dead": 0}

    rows = (
        live["db"].table("violations")
        .select("id, idempotency_key, violation_type")
        .eq("idempotency_key", ev["idempotency_key"]).execute().data
    )
    assert len(rows) == 1, "exactly one row, carrying the original key"
    assert rows[0]["violation_type"] == "no_hardhat"

    q.close()
    online.close()
    offline.close()


@needs_server
def test_replaying_an_event_the_server_already_has_is_not_a_second_incident(live, tmp_path):
    """
    The case that makes retrying safe: the send succeeded but the RESPONSE was
    lost, so the device still thinks it failed. Replay must reconcile to one
    row, and must count as delivered rather than retrying forever.
    """
    q = EventQueue(tmp_path / "q.db")
    client = AllClearClient(API_URL, live["api_key"])
    ev = _sample(camera_id=live["camera"])

    # Delivered once, but imagine the reply never came back.
    client.submit_violation(
        camera_id=ev["camera_id"], violation_type=ev["violation_type"],
        confidence=ev["confidence"], detected_at=ev["detected_at"],
        idempotency_key=ev["idempotency_key"],
    )
    q.enqueue(**ev)

    sent, failed = QueueReplayer(q, client).drain_once()
    assert (sent, failed) == (1, 0), "a duplicate is a success, not a failure"
    assert q.counts()["pending"] == 0

    rows = (
        live["db"].table("violations").select("id")
        .eq("idempotency_key", ev["idempotency_key"]).execute().data
    )
    assert len(rows) == 1, "one incident, not two"

    q.close()
    client.close()


@needs_server
def test_an_event_the_server_refuses_is_dropped_not_retried_forever(live, tmp_path):
    """A camera at another site can never become valid. It must not occupy the
    queue for the rest of the device's life."""
    q = EventQueue(tmp_path / "q.db")
    client = AllClearClient(API_URL, live["api_key"])

    ev = _sample(camera_id=str(uuid.uuid4()))  # a camera that is not ours
    q.enqueue(**ev)

    sent, failed = QueueReplayer(q, client).drain_once()
    assert (sent, failed) == (0, 1)
    assert q.counts() == {"pending": 0, "sent": 0, "dead": 1}
    assert q.due() == [], "never retried"

    q.close()
    client.close()
