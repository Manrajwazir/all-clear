"""
The device API key must never leave the device over plaintext HTTP.

WRITTEN BEFORE THE CODE (project hard rule, CLAUDE.md). The first run of this
file must FAIL, and the failure is the evidence that the check is real.

WHY THIS AND NOT A UNIT TEST OF SOMETHING ELSE
----------------------------------------------
`AllClearClient` puts the device's API key in an `Authorization: Bearer` header on
every single request — violations, heartbeats, snapshot confirms. That key is
the device's entire identity: it is what lets a caller file violations against
this company's site. `base_url` comes from `ALLCLEAR_API_URL`, an environment
variable set by whoever installs the device, in a trailer, probably in a hurry.

Nothing anywhere validated the scheme. `http://` was accepted silently, and the
bearer token then crosses the site's network in cleartext on every request. On a
construction site that network is frequently shared, frequently wireless, and
not ours.

This is the one item on the security review that was both genuinely real and
genuinely unbuilt.

THE LOOPBACK CARVE-OUT
----------------------
`http://localhost` and `http://127.0.0.1` stay allowed, deliberately. Local
development against `npm run dev` has no TLS, and refusing it would mean either
nobody runs this locally or somebody adds an override flag that then ships. The
carve-out is narrow and explicit: loopback only, never a LAN address, because
"it's just the local network" is exactly the assumption this check exists to
refuse.

Run:  python detection/tests/test_transport_security.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from api_client import AllClearClient  # noqa: E402

KEY = "ac_live_deadbeef_secret"

passed = failed = 0


def check(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print("  PASS  %s" % name)
    else:
        failed += 1
        print("  FAIL  %s %s" % (name, detail))


def rejects(url):
    """True if constructing a client for `url` raises ValueError."""
    try:
        AllClearClient(base_url=url, api_key=KEY)
    except ValueError:
        return True
    except Exception:
        return False
    return False


def accepts(url):
    try:
        AllClearClient(base_url=url, api_key=KEY)
        return True
    except Exception:
        return False


print("transport security -- the API key must not travel in cleartext")
print("=" * 68)

# ── must be refused ───────────────────────────────────────────────────────
check("plain http to a hostname is refused",
      rejects("http://api.allclearsafety.ca"))
check("plain http to a LAN address is refused",
      rejects("http://192.168.1.50:3000"))
check("plain http to a .local host is refused",
      rejects("http://trailer-pi.local:3000"))
# 127.0.0.1 is loopback; 127.1.2.3 is also loopback, but a hostname that merely
# STARTS with the same characters is not. Guards against a startswith() fix.
check("a host that merely starts with 'localhost' is refused",
      rejects("http://localhost.evil.example.com"))
check("a host that merely starts with '127.0.0.1' is refused",
      rejects("http://127.0.0.1.evil.example.com"))
check("a scheme-less url is refused",
      rejects("api.allclearsafety.ca"))
check("a non-http scheme is refused",
      rejects("ftp://api.allclearsafety.ca"))

# ── must still work ───────────────────────────────────────────────────────
check("https is accepted",
      accepts("https://api.allclearsafety.ca"))
check("https with a port and path is accepted",
      accepts("https://api.allclearsafety.ca:8443/base"))
check("http loopback by name is accepted (local dev)",
      accepts("http://localhost:3000"))
check("http loopback by ip is accepted (local dev)",
      accepts("http://127.0.0.1:3000"))
check("https loopback is accepted",
      accepts("https://localhost:3000"))

# ── the pre-existing contract must not regress ────────────────────────────
check("an empty base_url is still refused", rejects(""))

print("=" * 68)
print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
