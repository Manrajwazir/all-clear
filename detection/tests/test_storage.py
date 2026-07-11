"""
test_storage.py
---------------
Tests Phase 2 plumbing BEFORE running the full detection loop.

Run this from the detection/ folder:
    cd detection
    python tests/test_storage.py

What it tests:
  1. Supabase connection — can we reach the DB?
  2. Insert a dummy violation row — does write work?
  3. Read it back — does read work?
  4. Delete it — cleanup
  5. S3 connection — can we upload a tiny test file?

If all 5 pass, you're ready to run main.py with storage enabled.
"""

import os
import sys
from pathlib import Path

# Make sure we can import from src/
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dotenv import load_dotenv

# Load .env from the detection/ folder
load_dotenv(Path(__file__).parent.parent / ".env")


# ------------------------------------------------------------------ #
# 1. Check that required env vars are present
# ------------------------------------------------------------------ #
print("\n=== TEST 1: Environment Variables ===")

required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "S3_BUCKET_NAME",
    "AWS_REGION",
]

missing = [k for k in required if not os.getenv(k)]
if missing:
    print(f"FAIL — Missing env vars: {missing}")
    print("Fill these in detection/.env and re-run.")
    sys.exit(1)
print("PASS — All required env vars present.")


# ------------------------------------------------------------------ #
# 2. Supabase — insert, read, delete a dummy violation
# ------------------------------------------------------------------ #
print("\n=== TEST 2: Supabase Insert + Read + Delete ===")

try:
    from supabase import create_client
    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )

    DUMMY_CAMERA_ID = "00000000-0000-0000-0000-000000000001"
    DUMMY_VIOLATION = {
        "camera_id":         DUMMY_CAMERA_ID,
        "violation_type":    "no_helmet",
        "confidence":        0.99,
        "snapshot_s3_key":    "violations/00000000-0000-0000-0000-000000000001/test.jpg",
        "resolution_status": "pending",
    }

    # Insert
    insert_resp = sb.table("violations").insert(DUMMY_VIOLATION).execute()
    assert insert_resp.data, "Insert returned no data"
    row_id = insert_resp.data[0]["id"]
    print(f"PASS — Inserted dummy row  id={row_id}")

    # Read back
    read_resp = sb.table("violations").select("*").eq("id", row_id).execute()
    assert read_resp.data, "Read returned no data"
    print(f"PASS — Read back row  type={read_resp.data[0]['violation_type']}")

    # Delete
    sb.table("violations").delete().eq("id", row_id).execute()
    print(f"PASS — Deleted dummy row  id={row_id}")

except Exception as e:
    print(f"FAIL — Supabase error: {e}")
    print("\nCommon causes:")
    print("  - Wrong SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    print("  - You haven't run docs/schema.sql yet")
    print("  - Camera row '00000000-0000-0000-0000-000000000001' doesn't exist in cameras table")
    sys.exit(1)


# ------------------------------------------------------------------ #
# 3. S3 — upload a 1-byte test file
# ------------------------------------------------------------------ #
print("\n=== TEST 3: S3 Upload ===")

try:
    import boto3
    s3 = boto3.client(
        "s3",
        region_name=os.environ.get("AWS_REGION", "ca-central-1")
    )
    test_key = "allclear-test/connection_test.txt"
    s3.put_object(
        Bucket=os.environ["S3_BUCKET_NAME"],
        Key=test_key,
        Body=b"All Clear S3 connection test",
        ContentType="text/plain"
    )
    print(f"PASS — Uploaded test file to s3://{os.environ['S3_BUCKET_NAME']}/{test_key}")

    # Clean up
    s3.delete_object(Bucket=os.environ["S3_BUCKET_NAME"], Key=test_key)
    print("PASS — Cleaned up test file.")

except Exception as e:
    print(f"FAIL — S3 error: {e}")
    print("\nCommon causes:")
    print("  - Wrong AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY")
    print("  - S3_BUCKET_NAME bucket doesn't exist yet")
    print("  - Bucket is in wrong region (should be ca-central-1)")
    sys.exit(1)


# ------------------------------------------------------------------ #
# All passed
# ------------------------------------------------------------------ #
print("\n" + "=" * 50)
print("  ALL TESTS PASSED — Storage is ready.")
print("  You can now run:  python src/main.py")
print("=" * 50 + "\n")
