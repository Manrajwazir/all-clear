"""
test_debounce.py — unit tests for ViolationTracker.

Tests cover:
  - Debounce: must see N frames before triggering
  - Cooldown: no second alert until cooldown expires
  - Independence: different violation types track separately
"""

from debounce import ViolationTracker


def test_alert_fires_only_after_debounce_frames():
    tracker = ViolationTracker(debounce_frames=3, cooldown_seconds=60)

    # Frame 1 and 2: not enough — no alert yet
    assert tracker.should_alert("no_hardhat") is False
    assert tracker.should_alert("no_hardhat") is False
    # Frame 3: threshold met — alert fires
    assert tracker.should_alert("no_hardhat") is True


def test_cooldown_blocks_immediate_repeat():
    tracker = ViolationTracker(debounce_frames=3, cooldown_seconds=60)

    # Trigger the first alert
    for _ in range(3):
        tracker.should_alert("no_hardhat")

    # Immediately after, cooldown should block the next one
    assert tracker.should_alert("no_hardhat") is False


def test_different_violation_types_are_tracked_independently():
    tracker = ViolationTracker(debounce_frames=3, cooldown_seconds=60)

    # Trigger an alert for no_hardhat
    for _ in range(3):
        tracker.should_alert("no_hardhat")

    # no_vest has its own counter — starts at 0, should not alert yet
    assert tracker.should_alert("no_vest") is False


def test_single_frame_never_alerts():
    tracker = ViolationTracker(debounce_frames=5, cooldown_seconds=60)
    assert tracker.should_alert("no_hardhat") is False


def test_alert_does_not_fire_before_threshold():
    tracker = ViolationTracker(debounce_frames=4, cooldown_seconds=60)

    results = [tracker.should_alert("no_hardhat") for _ in range(3)]
    # First 3 of 4 required frames — none should alert
    assert all(r is False for r in results)
