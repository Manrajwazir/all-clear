"""
test_suite_safety.py -- running the test suite must never touch a real database
or a real phone.

Written 2026-10-02, BEFORE the fix (Labs4 block 1, step C0). Intent in one
sentence: `pytest` in detection/ runs only offline tests unless someone asks for
the live ones by name, and even then it refuses the production project.

Why: three files here are scripts, not tests. pytest imports them to look for
tests, and importing one runs it. test_storage.py then inserts a row into
whatever database detection/.env names, with the service-role key;
test_twilio.py sends a real SMS. Found 2026-10-02, when a plain `pytest` run
reached the insert (it failed on a not-null column, so nothing was written).
Separately, test_api_client.py and test_event_queue.py create organizations,
devices and violations whenever credentials exist and a dashboard answers,
which is any normal working day. Against production those rows could never be
deleted, only tombstoned.

How these checks stay safe themselves: every inner pytest run gets an
environment that points at nothing real. Credentials are empty strings, so the
two scripts stop at their own "missing env vars" check, and every database URL
is a dead port on this machine. An empty string beats detection/.env, because
load_dotenv() never overwrites a variable that already exists.
"""

import hashlib
import http.server
import os
import subprocess
import sys
import threading
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

DETECTION = Path(__file__).resolve().parent.parent

LIVE_SCRIPTS = ("test_storage.py", "test_twilio.py", "test_transport_security.py")

# Everything the live scripts and live tests read to reach a real service.
NEUTRALIZED = {
    "SUPABASE_URL": "",
    "SUPABASE_ANON_KEY": "",
    "SUPABASE_SERVICE_ROLE_KEY": "",
    "S3_ACCESS_KEY_ID": "",
    "S3_SECRET_ACCESS_KEY": "",
    "S3_BUCKET_NAME": "",
    "S3_REGION": "",
    "SES_ACCESS_KEY_ID": "",
    "SES_SECRET_ACCESS_KEY": "",
    "TWILIO_ACCOUNT_SID": "",
    "TWILIO_AUTH_TOKEN": "",
    "TWILIO_FROM_NUMBER": "",
    "TWILIO_TO_NUMBER": "",
    "DEVICE_API_KEY": "",
    "ALLCLEAR_API_URL": "http://127.0.0.1:9",
    "ALLCLEAR_LIVE_TESTS": "",
}

DEAD_DATABASE = "http://127.0.0.1:9"


def _inner_env(**overrides):
    env = dict(os.environ)
    env.update(NEUTRALIZED)
    env.update(overrides)
    return env


def _run_pytest(args, env, junit=None):
    cmd = [sys.executable, "-m", "pytest", "-p", "no:cacheprovider", "-q", *args]
    if junit is not None:
        cmd.append(f"--junitxml={junit}")
    return subprocess.run(
        cmd, cwd=DETECTION, env=env, capture_output=True, text=True, timeout=300
    )


def _outcomes(junit_path):
    """{"module::test": "passed" | "skipped" | "failed"}, plus skip messages."""
    out, reasons = {}, {}
    for case in ET.parse(junit_path).getroot().iter("testcase"):
        module = case.get("classname", "").rsplit(".", 1)[-1]
        name = f"{module}::{case.get('name')}"
        skipped = case.find("skipped")
        if skipped is not None:
            out[name] = "skipped"
            reasons[name] = skipped.get("message", "")
        elif case.find("failure") is not None or case.find("error") is not None:
            out[name] = "failed"
        else:
            out[name] = "passed"
    return out, reasons


class _AnswersHead(http.server.BaseHTTPRequestHandler):
    """Stands in for a running dashboard: answers the 'is it up?' probe."""

    def do_HEAD(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, *args):
        pass


@pytest.fixture
def dashboard_up():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _AnswersHead)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


LIVE_FILES = ["tests/test_api_client.py", "tests/test_event_queue.py"]
# The three tests in test_event_queue.py that need a dashboard. Everything else
# in that file is offline and must keep running.
EVENT_QUEUE_LIVE = {
    "test_an_outage_loses_nothing_and_replay_delivers_it",
    "test_replaying_an_event_the_server_already_has_is_not_a_second_incident",
    "test_an_event_the_server_refuses_is_dropped_not_retried_forever",
}


# ── 1. Collection never imports a live script ──────────────────────────────


def test_collecting_the_suite_never_runs_a_live_script():
    result = _run_pytest(["--collect-only"], _inner_env())
    listing = result.stdout + result.stderr
    assert result.returncode == 0, (
        "collecting the suite must succeed without running anything; it exited "
        f"{result.returncode}:\n{listing[-2000:]}"
    )
    for script in LIVE_SCRIPTS:
        assert script not in listing, f"{script} was collected, so it was imported, so it ran"


# ── 2. Live tests run only when asked for by name ──────────────────────────


def test_live_tests_are_skipped_unless_asked_for(dashboard_up, tmp_path):
    junit = tmp_path / "r.xml"
    _run_pytest(
        LIVE_FILES,
        _inner_env(
            SUPABASE_URL=DEAD_DATABASE,
            SUPABASE_SERVICE_ROLE_KEY="not-a-real-key",
            ALLCLEAR_API_URL=dashboard_up,
        ),
        junit,
    )
    outcomes, reasons = _outcomes(junit)
    live = [n for n in outcomes if _is_live(n)]
    assert live, "found no live tests at all, so this check checked nothing"
    for name in live:
        assert outcomes[name] == "skipped", (
            f"{name} {outcomes[name]} with credentials present and a dashboard up, "
            "but without ALLCLEAR_LIVE_TESTS=1: it would have written to the database"
        )
        assert "ALLCLEAR_LIVE_TESTS" in reasons[name], reasons[name]
    offline = [n for n in outcomes if not _is_live(n)]
    assert len(offline) == len(_EVENT_QUEUE_OFFLINE), (
        f"expected {len(_EVENT_QUEUE_OFFLINE)} offline queue tests, found {offline}"
    )
    assert all(outcomes[n] == "passed" for n in offline), (
        "the offline queue tests must still run and pass"
    )


def test_live_tests_do_run_when_asked_for(dashboard_up, tmp_path):
    """Break-it-on-purpose for check 2: a guard that skips everything forever
    would pass check 2 too. With the flag and a non-production database, the
    live tests must actually run (here they fail, against a dead database on
    this machine; running is what is being checked)."""
    junit = tmp_path / "r.xml"
    _run_pytest(
        LIVE_FILES,
        _inner_env(
            SUPABASE_URL=DEAD_DATABASE,
            SUPABASE_SERVICE_ROLE_KEY="not-a-real-key",
            ALLCLEAR_API_URL=dashboard_up,
            ALLCLEAR_LIVE_TESTS="1",
        ),
        junit,
    )
    outcomes, _ = _outcomes(junit)
    live = [n for n in outcomes if _is_live(n)]
    assert live, "found no live tests at all, so this check checked nothing"
    for name in live:
        assert outcomes[name] != "skipped", f"{name} was skipped although asked for"


def _is_live(name):
    """Every test in test_api_client.py needs a dashboard; in
    test_event_queue.py only three do."""
    module, test = name.split("::")
    return module == "test_api_client" or (
        module == "test_event_queue" and test in EVENT_QUEUE_LIVE
    )


_EVENT_QUEUE_OFFLINE = {
    "test_the_queue_opens_in_wal_mode",
    "test_an_enqueued_event_is_immediately_due",
    "test_marking_sent_removes_it_from_the_work_list",
    "test_a_failure_schedules_a_retry_instead_of_dropping_the_event",
    "test_the_backoff_lengthens_and_then_caps",
    "test_a_rejected_event_is_marked_dead_but_kept",
    "test_the_same_event_cannot_be_enqueued_twice",
    "test_events_survive_the_process_dying",
    "test_events_come_back_oldest_first",
    "test_the_replayer_has_no_way_to_send_an_sms",
}


# ── 3. Production is refused even when asked for ───────────────────────────


def test_production_is_refused_even_with_the_flag():
    from tests.live_guard import live_block_reason

    fake_production = {hashlib.sha256(b"fakeprodref").hexdigest()}
    reason = live_block_reason(
        url="https://fakeprodref.supabase.co", flag="1", protected=fake_production
    )
    assert reason is not None and "production" in reason

    assert live_block_reason(
        url="https://someotherref.supabase.co", flag="1", protected=fake_production
    ) is None, "a non-production project with the flag must be allowed"


def test_the_production_fingerprint_is_a_fingerprint_not_a_name():
    """The repository is public and has never named the production project, so
    the guard stores only a SHA-256 of its reference."""
    from tests.live_guard import PRODUCTION_FINGERPRINTS

    assert PRODUCTION_FINGERPRINTS, "no production fingerprint: production is unguarded"
    for fp in PRODUCTION_FINGERPRINTS:
        assert len(fp) == 64 and all(c in "0123456789abcdef" for c in fp)
