"""
storage.py
----------
Handles saving violation data to two destinations:

1. Supabase (Postgres) — stores metadata (timestamp, class, confidence, camera ID)
2. AWS S3 — stores the snapshot image (the frame where violation was detected)

IMPORTANT:
  - Use SUPABASE_SERVICE_ROLE_KEY here (backend only, bypasses RLS)
  - The dashboard uses SUPABASE_ANON_KEY (respects RLS)
  - Never use the service role key in client/frontend code

Notes:
  - "What happens if S3 is down?" → Violation logged with null snapshot_s3_key.
    Production needs queue + retry. Known gap.
  - "Why service role here?" → Backend is trusted. Service role lets us
    insert without RLS policy complexity during MVP.
"""

import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


# ---------- Supabase ----------
_supabase_client = None
_s3_client = None

"""Create and return a Supabase client using the service role key."""
def get_supabase():
    global _supabase_client
    # Added some error handling get_supabase() created a brand new client on every call which can break under real load
    if _supabase_client is None:
        from supabase import create_client
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        )
    return _supabase_client


# Create one client per process, not per call (avoids connection pool exhaustion)
# Uncomment when Supabase is configured:
# supabase = get_supabase()


# ---------- AWS S3 ----------
def get_s3():
    """
    Create and return a boto3 S3 client with credentials passed explicitly.

    Credentials are read from S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY and handed
    to boto3 directly, rather than letting boto3 discover them itself. That is
    deliberate and it is the fix for the 2026-08-20 live-test failure.

    boto3's default credential chain checks environment variables first, then
    falls back to ~/.aws/credentials. On 2026-08-20 the environment held no
    credentials boto3 recognised, so it silently fell back to that file, found a
    stale key from the old personal AWS account, and every upload failed with
    InvalidAccessKeyId. The fallback is the bug: two credential sources that can
    disagree, with no signal about which one won.

    Passing credentials explicitly means there is exactly one source. If the
    env vars are absent this raises immediately with a clear message instead of
    reaching for a file nobody remembered was there.

    The names are S3_*, not AWS_*, on purpose. See detection/.env.example.
    """
    global _s3_client
    if _s3_client is None:
        import boto3
        missing = [n for n in ("S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET_NAME")
                   if not os.environ.get(n)]
        if missing:
            raise RuntimeError(
                f"S3 is not configured: {', '.join(missing)} not set. "
                "Note the S3_ prefix, not AWS_ — see detection/.env.example."
            )
        _s3_client = boto3.client(
            "s3",
            region_name=os.environ.get("S3_REGION", "ca-central-1"),
            aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        )
    return _s3_client


def upload_snapshot(frame_bytes: bytes, camera_id: str) -> str:
    """
    Upload a violation snapshot to S3.
    Returns the S3 key (not the full URL — the dashboard's signed-URL
    route reconstructs the full URL with temporary auth).

    frame_bytes: JPEG-encoded image bytes (from cv2.imencode)
    camera_id: UUID of the camera
    """
    s3 = get_s3()
    key = f"violations/{camera_id}/{datetime.utcnow().isoformat()}.jpg"
    s3.put_object(
        # No ACL parameter. The bucket is created with Object Ownership set to
        # "Bucket owner enforced", which disables ACLs entirely — passing even
        # ACL='private' against such a bucket raises AccessControlListNotSupported.
        # Privacy comes from Block Public Access plus the bucket policy, not from
        # a per-object ACL. Encryption stays.
        ServerSideEncryption='AES256',
        Bucket=os.environ["S3_BUCKET_NAME"],
        Key=key,
        Body=frame_bytes,
        ContentType="image/jpeg"
    )
    return key


def log_violation(camera_id: str, violation_type: str, confidence: float, snapshot_s3_key: str = None):
    """
    Insert a violation record into Supabase.

    camera_id: UUID of the camera
    violation_type: e.g. 'no_helmet', 'no_vest'
    confidence: model confidence score (0-1)
    snapshot_s3_key: S3 key of the snapshot (optional, None in events-only mode)
    """
    supabase = get_supabase()
    supabase.table("violations").insert({
        "camera_id": camera_id,
        "violation_type": violation_type,
        "confidence": confidence,
        "snapshot_s3_key": snapshot_s3_key,
        "resolution_status": "pending"
    }).execute()
