"""
test_twilio.py
--------------
Sends a single test SMS to verify Twilio is configured correctly.
Run this BEFORE running main.py to confirm SMS works.

Run from the detection/ folder:
    cd detection
    python tests/test_twilio.py
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

print("\n=== Twilio SMS Test ===")

required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "TWILIO_TO_NUMBER"]
missing = [k for k in required if not os.getenv(k)]
if missing:
    print(f"FAIL — Missing env vars: {missing}")
    print("Fill these in detection/.env and re-run.")
    sys.exit(1)

print("ENV VARS: OK")

try:
    from twilio.rest import Client
    client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])

    message = client.messages.create(
        body="[All Clear] Test alert — Twilio is connected.",
        from_=os.environ["TWILIO_FROM_NUMBER"],
        to=os.environ["TWILIO_TO_NUMBER"]
    )
    print(f"SMS SENT: SID = {message.sid}")
    print(f"To: {os.environ['TWILIO_TO_NUMBER']}")
    print("\nCheck your phone. You should have a text within 5 seconds.")
    print("\nALL TESTS PASSED — Twilio is ready. Run:  python src/main.py")

except Exception as e:
    print(f"FAIL — {e}")
    print("\nCommon causes:")
    print("  - Wrong TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN")
    print("  - TWILIO_TO_NUMBER is not verified (trial accounts can only text verified numbers)")
    print("  - TWILIO_FROM_NUMBER is not your Twilio number")
    sys.exit(1)
