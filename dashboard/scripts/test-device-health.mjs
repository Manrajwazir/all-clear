/**
 * test-device-health.mjs — the device liveness classifier.
 *
 * WRITTEN BEFORE THE CODE (project hard rule). The first run must FAIL.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS
 * -----------------------------------
 * `devices.last_seen_at` has been written by the heartbeat route since Phase 3
 * and **nothing has ever read it**. So the system has no idea when a device
 * stops reporting, and neither does anyone else.
 *
 * That is not a monitoring nicety. The compliance record is the product, and a
 * record with no violations in it is ambiguous in the worst possible way: it
 * reads identically whether the site was safe or the camera was unplugged. An
 * auditor cannot tell those apart, and neither can we. Being able to say "this
 * device was reporting continuously across this period" is what makes an empty
 * stretch of record mean something.
 *
 * Classification is pure and lives apart from the query so it can be tested
 * without a database and reused by the dashboard the students build.
 *
 * Run:  node scripts/test-device-health.mjs
 */

import { classifyDevice, summarise } from "../lib/device-health.mjs";

const NOW = new Date("2026-09-15T12:00:00Z");
const ago = (seconds) => new Date(NOW.getTime() - seconds * 1000).toISOString();

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`); }
}
const state = (d) => classifyDevice(d, NOW).state;

console.log("device liveness classifier");
console.log("=".repeat(68));

// ── the heartbeat is every 30s, so thresholds are multiples of it ────────
check("a device that beat 10s ago is online",
  state({ status: "active", last_seen_at: ago(10) }) === "online");
check("a device that beat 29s ago is still online",
  state({ status: "active", last_seen_at: ago(29) }) === "online");
check("one missed beat is 'late', not an outage",
  state({ status: "active", last_seen_at: ago(75) }) === "late");
check("five minutes silent is 'stale'",
  state({ status: "active", last_seen_at: ago(300) }) === "stale");
check("an hour silent is 'offline'",
  state({ status: "active", last_seen_at: ago(3600) }) === "offline");

// ── the cases that are NOT about time ────────────────────────────────────
check("a revoked device is 'revoked', however recently it beat",
  state({ status: "revoked", last_seen_at: ago(5) }) === "revoked");
check("a pending device that has never beaten is 'never_seen'",
  state({ status: "pending", last_seen_at: null }) === "never_seen");
check("an ACTIVE device that has never beaten is also 'never_seen'",
  state({ status: "active", last_seen_at: null }) === "never_seen");

// ── the thing a compliance question actually asks ────────────────────────
check("online and late both count as reporting",
  classifyDevice({ status: "active", last_seen_at: ago(10) }, NOW).reporting === true &&
  classifyDevice({ status: "active", last_seen_at: ago(75) }, NOW).reporting === true);
check("stale and offline do NOT count as reporting",
  classifyDevice({ status: "active", last_seen_at: ago(300) }, NOW).reporting === false &&
  classifyDevice({ status: "active", last_seen_at: ago(3600) }, NOW).reporting === false);
check("a revoked device is not reporting",
  classifyDevice({ status: "revoked", last_seen_at: ago(5) }, NOW).reporting === false);

// ── robustness: this reads a column nothing has validated in years ───────
check("a garbage timestamp does not throw, and is not treated as healthy",
  state({ status: "active", last_seen_at: "not-a-date" }) === "never_seen");
check("a FUTURE last_seen_at is refused rather than read as fresh",
  state({ status: "active", last_seen_at: ago(-600) }) === "never_seen");

// ── the fleet summary ────────────────────────────────────────────────────
const fleet = summarise([
  { status: "active", last_seen_at: ago(5) },
  { status: "active", last_seen_at: ago(5) },
  { status: "active", last_seen_at: ago(4000) },
  { status: "revoked", last_seen_at: ago(5) },
  { status: "pending", last_seen_at: null },
], NOW);
check("summary counts the fleet", fleet.total === 5, JSON.stringify(fleet));
check("summary counts who is reporting", fleet.reporting === 2, JSON.stringify(fleet));
check("summary surfaces the ones needing attention", fleet.needsAttention === 1,
  JSON.stringify(fleet));

console.log("=".repeat(68));
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
