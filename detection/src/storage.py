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

Interview prep:
  - "What happens if S3 is down?" → Violation logged with null image_url.
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
"""Create and return a boto3 S3 client."""
def get_s3():
    global _s3_client
    if _s3_client is None:
        import boto3
        _s3_client = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ca-central-1"))
    return _s3_client

# Uncomment when AWS is configured:
# s3 = get_s3()


def upload_snapshot(frame_bytes: bytes, camera_id: str) -> str:
    """
    Upload a violation snapshot to S3.
    Returns the S3 URL for the uploaded image.

    frame_bytes: JPEG-encoded image bytes (from cv2.imencode)
    camera_id: UUID of the camera
    """
    s3 = get_s3()
    key = f"violations/{camera_id}/{datetime.utcnow().isoformat()}.jpg"
    s3.put_object(
        Bucket=os.environ["S3_BUCKET_NAME"],
        Key=key,
        Body=frame_bytes,
        ContentType="image/jpeg",
        ACL="private" # S3 bucket is private; we generate signed URLs for access
    )
    return f"https://{os.environ['S3_BUCKET_NAME']}.s3.amazonaws.com/{key}"


def log_violation(camera_id: str, violation_type: str, confidence: float, image_url: str = None):
    """
    Insert a violation record into Supabase.

    camera_id: UUID of the camera
    violation_type: e.g. 'no_helmet', 'no_vest'
    confidence: model confidence score (0-1)
    image_url: S3 URL of the snapshot (optional)
    """
    supabase = get_supabase()
    supabase.table("violations").insert({
        "camera_id": camera_id,
        "violation_type": violation_type,
        "confidence": confidence,
        "image_url": image_url,
        "resolution_status": "pending"
    }).execute()
