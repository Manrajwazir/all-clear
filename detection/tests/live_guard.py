"""
live_guard.py -- who may run the tests that write to a real database.

test_api_client.py and test_event_queue.py create organizations, devices and
violations in whatever Supabase project detection/.env names. Violations can
never be deleted, only tombstoned, so those tests must never run by accident
and must never run against production at all.

Two rules, checked in this order:

1. The production project is refused, whatever else is set.
2. Otherwise a live test runs only when asked for by name:
   ALLCLEAR_LIVE_TESTS=1. Credentials being present is not asking; they are
   present on any normal working day.

The production project is recognised by a SHA-256 of its reference, not the
reference itself: this repository is public and has never named it.

Written for Labs4 block 1, step C0 (2026-10-02); see tests/test_suite_safety.py.
"""

import hashlib
import os
from urllib.parse import urlparse

FLAG = "ALLCLEAR_LIVE_TESTS"

# sha256 of the production Supabase project reference.
PRODUCTION_FINGERPRINTS = frozenset({
    "de9786cd0d9c3b00e80500888c548e516b0addd7e7706b02cfe6e21d21bb2458",
})


def fingerprint(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def live_block_reason(url=None, flag=None, protected=PRODUCTION_FINGERPRINTS):
    """None if live tests may run; otherwise the reason they may not.

    Reads SUPABASE_URL and ALLCLEAR_LIVE_TESTS from the environment unless
    given, so call it after load_dotenv().
    """
    url = os.getenv("SUPABASE_URL", "") if url is None else url
    flag = os.getenv(FLAG, "") if flag is None else flag

    # Every label of the host, so https://<ref>.supabase.co is caught however
    # the URL is written.
    host = urlparse(url).hostname or ""
    if any(fingerprint(label) in protected for label in host.split(".")):
        return (
            "refused: SUPABASE_URL is the production project, and live tests "
            "write test rows that can never be deleted"
        )
    if flag != "1":
        return (
            f"live test: writes to the database in detection/.env; "
            f"set {FLAG}=1 to run it"
        )
    return None
