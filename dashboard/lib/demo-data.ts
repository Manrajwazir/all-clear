import type { ViolationWithCamera } from "./supabase/types";

const DEMO_CAMERA = {
  name: "North Gate · Cam 1",
  sites: { name: "Edmonton Tower" },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TYPES = [
  "no_hardhat",
  "no_safety_vest",
  "no_mask",
  "no_hardhat",
  "no_safety_vest",
] as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const STATUSES = [
  "pending",
  "pending",
  "resolved",
  "resolved",
  "false_positive",
] as const;

/**
 * Generates 8-12 fake violations spread across the last 4 hours.
 * Used by the demo mode bar in the live feed for offline pitch demos.
 */
export function buildDemoViolations(): ViolationWithCamera[] {
  const now = Date.now();
  const out: ViolationWithCamera[] = [];

  // 2 fresh "active" alerts (within last 5 min) — drives the warning state
  out.push(makeOne(now - 90 * 1000, "no_hardhat", "pending", 0.91));
  out.push(makeOne(now - 3 * 60 * 1000, "no_safety_vest", "pending", 0.83));

  // Older, mixed states across last 4 hours
  out.push(makeOne(now - 12 * 60 * 1000, "no_mask", "resolved", 0.74));
  out.push(makeOne(now - 28 * 60 * 1000, "no_hardhat", "resolved", 0.88));
  out.push(makeOne(now - 47 * 60 * 1000, "no_safety_vest", "false_positive", 0.62));
  out.push(makeOne(now - 62 * 60 * 1000, "no_hardhat", "resolved", 0.79));
  out.push(makeOne(now - 95 * 60 * 1000, "no_mask", "resolved", 0.71));
  out.push(makeOne(now - 124 * 60 * 1000, "no_safety_vest", "resolved", 0.85));
  out.push(makeOne(now - 168 * 60 * 1000, "no_hardhat", "resolved", 0.93));
  out.push(makeOne(now - 215 * 60 * 1000, "no_hardhat", "false_positive", 0.66));

  return out;
}

function makeOne(
  ts: number,
  type: (typeof TYPES)[number],
  status: (typeof STATUSES)[number],
  conf: number,
): ViolationWithCamera {
  return {
    id: `demo-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    camera_id: "00000000-0000-0000-0000-000000000001",
    violation_type: type,
    confidence: conf,
    image_url: null,
    detected_at: new Date(ts).toISOString(),
    resolved_at: status !== "pending" ? new Date(ts + 60_000).toISOString() : null,
    resolution_status: status,
    notes: null,
    cameras: DEMO_CAMERA,
  };
}
