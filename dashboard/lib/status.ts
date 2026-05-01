import type { Violation } from "./supabase/types";

export type SiteStatus = "safe" | "warning" | "critical";

export interface StatusSnapshot {
  status: SiteStatus;
  word: string;
  activeCount: number;
  todayCount: number;
  lastViolationAt: string | null;
}

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const SAFE_WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Derive the dashboard hero status from the recent violations list.
 * Rules from docs/dashboard-design.md §5.
 */
export function deriveStatus(violations: Violation[]): StatusSnapshot {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todays = violations.filter(
    (v) => new Date(v.detected_at).getTime() >= startOfDay.getTime(),
  );

  const active = violations.filter((v) => {
    const age = now - new Date(v.detected_at).getTime();
    return age < ACTIVE_WINDOW_MS && v.resolution_status === "pending";
  });

  const lastViolation = violations[0]?.detected_at ?? null;
  const lastAgeMs = lastViolation
    ? now - new Date(lastViolation).getTime()
    : Infinity;

  let status: SiteStatus;
  let word: string;

  if (active.length >= 3) {
    status = "critical";
    word = "CRITICAL";
  } else if (active.length >= 1) {
    status = "warning";
    word = "ACTIVE ALERT";
  } else if (lastAgeMs < SAFE_WINDOW_MS) {
    // Just had a violation but it cleared — still calm
    status = "safe";
    word = "ALL CLEAR";
  } else {
    status = "safe";
    word = "ALL CLEAR";
  }

  return {
    status,
    word,
    activeCount: active.length,
    todayCount: todays.length,
    lastViolationAt: lastViolation,
  };
}
