"""
camera.py -- reading a frame without turning a dead camera into a hot loop.

OPEN_ITEMS 17.2, fixed 2026-09-26. On an empty frame main.py used to log and
`continue` with no pause. A camera held by another app (Microsoft Teams, in
practice) returns empty frames instantly, so the loop spun at full speed and
wrote one warning per spin.

Deliberately NOT a reconnect. The reconnect code that used to live in main.py
was removed in ee01e9d because no retry can take a webcam back from Teams. This
only makes failure slow and quiet: pause briefly, and report the problem
periodically instead of continuously.

RTSP cameras will need real reconnect logic (a dropped stream DOES come back).
That is the RTSP bench blocker, and belongs with it, not here.

Kept out of main.py so it can be tested without a webcam or the model:
tests/test_camera_read.py.
"""

import time

# One tenth of a second. Long enough that a dead camera costs nothing, short
# enough that a camera that recovers is picked up again almost at once.
EMPTY_FRAME_WAIT_SECONDS = 0.1

# At 0.1 s per attempt, one warning every 50 failures is one every ~5 seconds.
WARN_EVERY = 50


def read_frame(cap, sleep=time.sleep):
    """Return the freshest frame, or None after a short pause if there is none.

    grab() then retrieve() rather than read(): grab discards anything queued, so
    when inference is slower than the camera we process the newest frame, not a
    stale one.
    """
    cap.grab()
    ret, frame = cap.retrieve()
    if not ret or frame is None:
        sleep(EMPTY_FRAME_WAIT_SECONDS)
        return None
    return frame


def should_warn(consecutive_failures):
    """Report the first empty frame at once, then every WARN_EVERY after it."""
    return consecutive_failures == 1 or consecutive_failures % WARN_EVERY == 0
