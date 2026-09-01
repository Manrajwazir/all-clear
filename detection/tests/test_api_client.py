"""
test_api_client.py — exercises api_client.py against a running dashboard.
Phase 3, Step 3.4.

Run the dashboard first, then from detection/:
    pytest tests/test_api_client.py -v

────────────────────────────────────────────────────────────────────────────
WHY THIS EXISTS

Step 3.4's written test is a live demo: walk in front of the webcam and watch a
card appear. That is the right acceptance test and it is not automatable — it
needs a camera, a person, and a hardhat that is not being worn.

This covers everything in that path EXCEPT the camera: provisioning a real
device, authenticating with the key it returns, submitting a violation,
retrying it safely, learning a site's imagery setting, uploading an image and
confirming it, and getting the right exception class for each kind of failure.

If this passes and the live demo fails, the problem is the camera or the model,
not the API path. That is the point of separating them.
────────────────────────────────────────────────────────────────────────────
"""

import base64
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from api_client import (  # noqa: E402
    AllClearClient,
    AuthError,
    RejectedError,
    new_idempotency_key,
    utc_now_iso,
)

load_dotenv(Path(__file__).parent.parent / ".env")

API_URL = os.getenv("ALLCLEAR_API_URL", "http://localhost:3000")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

TAG = f"zz-test-apiclient-{int(time.time())}"

# A genuine 1x1 JPEG, so S3 stores a real object rather than a zero-byte key
# (which the confirm endpoint correctly treats as "not uploaded").
JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof"
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB"
    "AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="
)


def _server_up() -> bool:
    try:
        requests.head(API_URL, timeout=3)
        return True
    except requests.RequestException:
        return False


pytestmark = pytest.mark.skipif(
    not (SUPABASE_URL and SERVICE_KEY and _server_up()),
    reason=(
        "needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in detection/.env and a "
        "dashboard running at ALLCLEAR_API_URL (npm run dev)"
    ),
)


@pytest.fixture(scope="module")
def env():
    """Throwaway org / site / camera / device fixtures, torn down at the end."""
    from supabase import create_client

    db = create_client(SUPABASE_URL, SERVICE_KEY)
    made = {"org": None, "user": None, "sites": [], "cameras": [], "devices": []}

    def provision(label, site_id, ip):
        """Create a pending device and activate it through the real endpoint."""
        import hashlib
        import secrets

        token = secrets.token_urlsafe(32)
        row = (
            db.table("devices")
            .insert(
                {
                    "organization_id": made["org"],
                    "site_id": site_id,
                    "name": f"{TAG}-{label}",
                    "status": "pending",
                    "provisioning_token_hash": hashlib.sha256(
                        token.encode()
                    ).hexdigest(),
                    "provisioning_token_expires_at": (
                        datetime.now(timezone.utc) + timedelta(hours=48)
                    ).isoformat(),
                }
            )
            .execute()
            .data[0]
        )
        made["devices"].append(row["id"])

        res = requests.post(
            f"{API_URL}/api/v1/devices/provision",
            json={"provisioning_token": token},
            headers={"x-forwarded-for": ip},
            timeout=10,
        )
        assert res.status_code == 200, f"provision {label}: {res.status_code} {res.text}"
        return row["id"], res.json()["api_key"]

    try:
        made["org"] = (
            db.table("organizations")
            .insert({"name": TAG, "slug": TAG})
            .execute()
            .data[0]["id"]
        )

        # sites.pipa_attestation_completed cannot be true without recording who
        # attested and when — CHECK pipa_attestation_complete_requires_metadata.
        attester = str(uuid.uuid4())
        db.table("users").insert(
            {
                "id": attester,
                "organization_id": made["org"],
                "email": f"{TAG}@example.invalid",
                "role": "org_admin",
                "status": "active",
            }
        ).execute()
        made["user"] = attester

        attest = {
            "pipa_attestation_completed": True,
            "pipa_attestation_by": attester,
            "pipa_attestation_at": datetime.now(timezone.utc).isoformat(),
        }
        sites = (
            db.table("sites")
            .insert(
                [
                    {
                        "organization_id": made["org"],
                        "name": f"{TAG}-plain",
                        "timezone": "America/Edmonton",
                        "snapshot_mode": False,
                        **attest,
                    },
                    {
                        "organization_id": made["org"],
                        "name": f"{TAG}-snap",
                        "timezone": "America/Edmonton",
                        "snapshot_mode": True,
                        **attest,
                    },
                ]
            )
            .execute()
            .data
        )
        plain = next(s for s in sites if not s["snapshot_mode"])["id"]
        snap = next(s for s in sites if s["snapshot_mode"])["id"]
        made["sites"] += [plain, snap]

        cams = (
            db.table("cameras")
            .insert(
                [
                    {"organization_id": made["org"], "site_id": plain,
                     "name": f"{TAG}-cam-plain"},
                    {"organization_id": made["org"], "site_id": snap,
                     "name": f"{TAG}-cam-snap"},
                ]
            )
            .execute()
            .data
        )
        cam_plain = next(c for c in cams if c["site_id"] == plain)["id"]
        cam_snap = next(c for c in cams if c["site_id"] == snap)["id"]
        made["cameras"] += [cam_plain, cam_snap]

        dev_plain_id, key_plain = provision("plain", plain, "203.0.113.61")
        dev_snap_id, key_snap = provision("snap", snap, "203.0.113.62")
        dev_dead_id, key_dead = provision("dead", plain, "203.0.113.63")

        yield {
            "db": db,
            "cam_plain": cam_plain,
            "cam_snap": cam_snap,
            "key_plain": key_plain,
            "key_snap": key_snap,
            "key_dead": key_dead,
            "dev_dead_id": dev_dead_id,
        }
    finally:
        if made["devices"]:
            db.table("violations").delete().in_("device_id", made["devices"]).execute()
            db.table("devices").delete().in_("id", made["devices"]).execute()
        if made["cameras"]:
            db.table("cameras").delete().in_("id", made["cameras"]).execute()
        if made["sites"]:
            db.table("sites").delete().in_("id", made["sites"]).execute()
        if made["user"]:
            db.table("users").delete().eq("id", made["user"]).execute()
        if made["org"]:
            db.table("organizations").delete().eq("id", made["org"]).execute()
        db.table("rate_limit_counters").delete().like(
            "bucket", "ip:203.0.113.%"
        ).execute()


# ── pure helpers ───────────────────────────────────────────────────────────


def test_idempotency_keys_are_unique():
    """Each call must produce a new key — the caller decides when to reuse one."""
    keys = {new_idempotency_key() for _ in range(200)}
    assert len(keys) == 200


def test_timestamp_carries_an_explicit_utc_offset():
    """
    A naive timestamp would be read as UTC and silently shifted by the machine's
    offset. detected_at is a hashed field, so the wrong value seals in forever.
    """
    stamp = utc_now_iso()
    assert stamp.endswith("+00:00")
    assert datetime.fromisoformat(stamp).tzinfo is not None


# ── authentication ─────────────────────────────────────────────────────────


def test_a_provisioned_key_authenticates(env):
    client = AllClearClient(API_URL, env["key_plain"])
    client.verify_key()  # raises on failure
    client.close()


def test_a_garbage_key_raises_AuthError_not_a_generic_failure(env):
    """
    The taxonomy matters more than the rejection. Step 3.5's queue branches on
    it: an AuthError must never be retried, or a decommissioned device hammers
    the API forever from a site nobody is monitoring.
    """
    client = AllClearClient(API_URL, "ac_live_" + "0" * 16 + "_" + "x" * 43)
    with pytest.raises(AuthError):
        client.verify_key()
    client.close()


def test_a_revoked_device_raises_AuthError(env):
    env["db"].table("devices").update({"status": "revoked"}).eq(
        "id", env["dev_dead_id"]
    ).execute()
    client = AllClearClient(API_URL, env["key_dead"])
    with pytest.raises(AuthError):
        client.verify_key()
    client.close()


# ── submission ─────────────────────────────────────────────────────────────


def test_submitting_a_violation_returns_a_sealed_record(env):
    client = AllClearClient(API_URL, env["key_plain"])
    result = client.submit_violation(
        camera_id=env["cam_plain"],
        violation_type="no_hardhat",
        confidence=0.88,
        detected_at=utc_now_iso(),
        idempotency_key=new_idempotency_key(),
    )
    assert not result.duplicate
    assert result.should_alert is True
    assert len(result.event_hash) == 64
    assert result.snapshot_enabled is False
    assert result.snapshot_upload is None
    client.close()


def test_resending_the_same_event_is_a_duplicate_and_does_not_re_alert(env):
    """
    The property the whole idempotency mechanism exists for: a retry after a
    dropped connection must produce one incident, and must not text a
    supervisor a second time about it.
    """
    client = AllClearClient(API_URL, env["key_plain"])
    args = dict(
        camera_id=env["cam_plain"],
        violation_type="no_mask",
        confidence=0.71,
        detected_at=utc_now_iso(),
        idempotency_key=new_idempotency_key(),
    )
    first = client.submit_violation(**args)
    second = client.submit_violation(**args)

    assert first.violation_id == second.violation_id
    assert first.duplicate is False and second.duplicate is True
    assert first.should_alert is True
    assert second.should_alert is False, "a retry must not fire a second SMS"
    client.close()


def test_a_camera_at_another_site_is_a_RejectedError(env):
    """Not transient. Retrying it unchanged would fail identically."""
    client = AllClearClient(API_URL, env["key_plain"])
    with pytest.raises(RejectedError):
        client.submit_violation(
            camera_id=env["cam_snap"],  # belongs to the other site
            violation_type="no_hardhat",
            confidence=0.9,
            detected_at=utc_now_iso(),
            idempotency_key=new_idempotency_key(),
        )
    client.close()


def test_a_future_timestamp_is_a_RejectedError(env):
    client = AllClearClient(API_URL, env["key_plain"])
    ahead = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    with pytest.raises(RejectedError):
        client.submit_violation(
            camera_id=env["cam_plain"],
            violation_type="no_hardhat",
            confidence=0.9,
            detected_at=ahead,
            idempotency_key=new_idempotency_key(),
        )
    client.close()


# ── snapshot policy ────────────────────────────────────────────────────────


def test_the_client_never_requests_a_snapshot_before_the_server_confirms(env):
    """
    The safety property. A snapshot offered to a site that has not opted in is
    rejected along with the WHOLE violation, so a device that guessed wrong
    would drop every incident rather than just the images. It must never guess.
    """
    client = AllClearClient(API_URL, env["key_plain"], snapshot_mode=True)
    assert client.wants_snapshot() is False, "must not guess before hearing back"

    client.submit_violation(
        camera_id=env["cam_plain"],
        violation_type="no_hardhat",
        confidence=0.8,
        detected_at=utc_now_iso(),
        idempotency_key=new_idempotency_key(),
    )
    assert client.wants_snapshot() is False, "site does not capture imagery"
    client.close()


def test_on_an_opted_in_site_the_client_learns_then_uploads(env):
    client = AllClearClient(API_URL, env["key_snap"], snapshot_mode=True)

    # First submission: the client does not yet know, so it does not ask.
    first = client.submit_violation(
        camera_id=env["cam_snap"],
        violation_type="no_hardhat",
        confidence=0.8,
        detected_at=utc_now_iso(),
        idempotency_key=new_idempotency_key(),
    )
    assert first.snapshot_enabled is True
    assert first.snapshot_upload is None, "did not ask, so must not receive"
    assert client.wants_snapshot() is True, "should have learned from the response"

    # Second submission: now it asks, and can complete the upload.
    second = client.submit_violation(
        camera_id=env["cam_snap"],
        violation_type="no_hardhat",
        confidence=0.8,
        detected_at=utc_now_iso(),
        idempotency_key=new_idempotency_key(),
        snapshot_requested=True,
    )
    assert second.snapshot_upload is not None
    assert second.snapshot_upload.content_type == "image/jpeg"
    assert second.snapshot_upload.expires_in == 300

    client.upload_snapshot(second.snapshot_upload, JPEG)
    client.confirm_snapshot(second.violation_id)

    row = (
        env["db"]
        .table("violations")
        .select("snapshot_s3_key, event_hash")
        .eq("id", second.violation_id)
        .single()
        .execute()
        .data
    )
    assert row["snapshot_s3_key"] is not None
    assert row["snapshot_s3_key"].endswith(f"{second.violation_id}.jpg")
    assert row["event_hash"] == second.event_hash, "the seal must be untouched"

    # Confirming twice must be safe — a lost response is not a failure.
    client.confirm_snapshot(second.violation_id)
    client.close()


def test_confirming_without_uploading_leaves_the_key_null(env):
    """The server never records a reference to an object it has not seen."""
    client = AllClearClient(API_URL, env["key_snap"], snapshot_mode=True)
    result = client.submit_violation(
        camera_id=env["cam_snap"],
        violation_type="no_mask",
        confidence=0.8,
        detected_at=utc_now_iso(),
        idempotency_key=new_idempotency_key(),
        snapshot_requested=True,
    )
    with pytest.raises(RejectedError):
        client.confirm_snapshot(result.violation_id)

    row = (
        env["db"]
        .table("violations")
        .select("snapshot_s3_key")
        .eq("id", result.violation_id)
        .single()
        .execute()
        .data
    )
    assert row["snapshot_s3_key"] is None
    client.close()
