"""
debounce.py
-----------
Prevents alert spam via two mechanisms:

1. DEBOUNCING — requires N consecutive frames with the same violation
   before trusting it. Filters single-frame noise (motion blur, partial occlusion).
   
2. COOLDOWN — after firing an alert, mutes that violation type for X seconds.
   Prevents 200 SMSes about the same worker.

They solve different problems:
  - Debounce = frame-level noise filtering
  - Cooldown = event-level deduplication

Interview prep:
  - "Why 5 frames?" → At ~30 FPS that's ~167ms. Short enough to be responsive,
    long enough to filter single-frame noise.
  - "Why 60s cooldown?" → A foreman doesn't need 200 SMSes about the same worker.
    One alert per minute keeps the supervisor sane.
"""

from collections import deque
from time import time
from dataclasses import dataclass, field


@dataclass
class ViolationTracker:
    debounce_frames: int = 5
    cooldown_seconds: int = 60

    # Track recent frames where each violation type appeared
    recent: dict[str, deque] = field(default_factory=lambda: {})
    # Track when we last alerted on each type
    last_alert: dict[str, float] = field(default_factory=lambda: {})

    def should_alert(self, violation_type: str) -> bool:
        now = time()

        # Add to recent frames
        if violation_type not in self.recent:
            self.recent[violation_type] = deque(maxlen=self.debounce_frames)
        self.recent[violation_type].append(now)

        # Need N consecutive frames within last second
        if len(self.recent[violation_type]) < self.debounce_frames:
            return False
        if now - self.recent[violation_type][0] > 1.0:
            return False

        # Cooldown check
        last = self.last_alert.get(violation_type, 0)
        if now - last < self.cooldown_seconds:
            return False

        self.last_alert[violation_type] = now
        return True
