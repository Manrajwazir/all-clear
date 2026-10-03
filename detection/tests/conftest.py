"""
conftest.py — pytest configuration for the detection service.
Adds detection/src/ to sys.path so test files can import modules
(detector, debounce, etc.) without package-prefix syntax.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Scripts, not tests: importing one RUNS it, and pytest imports every test_*.py
# it finds. test_storage.py inserts into the database detection/.env names,
# with the service-role key; test_twilio.py sends a real SMS;
# test_transport_security.py ends with sys.exit(), which aborts collection.
# Found 2026-10-02 (Labs4 block 1, step C0). They still run by hand, exactly as
# before:  python tests/test_twilio.py
collect_ignore = ["test_storage.py", "test_twilio.py", "test_transport_security.py"]
