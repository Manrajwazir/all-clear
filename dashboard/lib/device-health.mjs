/**
 * device-health.mjs — turn `devices.last_seen_at` into an answer.
 *
 * `last_seen_at` has been written by the heartbeat route since Phase 3 and
 * nothing has ever read it. This is the reader.
 *
 * WHY IT IS A COMPLIANCE CONCERN AND NOT A MONITORING ONE
 * ------------------------------------------------------
 * The product is the record. A stretch of record containing no violations is
 * ambiguous in the worst way: it looks the same whether the site was safe or
 * the camera was unplugged. An auditor cannot tell those apart. Neither could
 * we, until now. Device liveness is what disambiguates them, so "was this
 * device reporting?" is a question about evidence, not about uptime.
 *
 * WHY .mjs AND NOT .ts
 * -------------------
 * Deliberate. The admin scripts are plain ESM run straight by node with no
 * build step, and the dashboard is TypeScript. Plain ESM with JSDoc types is
 * importable by both. Next.js compiles it fine; `tsc --noEmit` does not check
 * it, so the tests are what hold it, which is what the suite above is for.
 *
 * THRESHOLDS
 * ----------
 * The device beats every 30s (`HEARTBEAT_SECONDS`, detection/src/main.py:193).
 * The bands are multiples of that, so each one means a specific number of
 * missed beats rather than a round-sounding number of minutes:
 *
 *   online     < 30s     the last beat arrived as scheduled
 *   late       < 150s    up to four missed beats. Wifi on a site is not good;
 *                        this band exists so ordinary jitter is not an alarm
 *   stale      < 1800s   sustained silence. Something is wrong
 *   offline    older     gone
 *
 * `late` and `online` both count as `reporting`, because a compliance question
 * asks whether the record is trustworthy for that period, and a single missed
 * beat does not make it untrustworthy.
 */

export const HEARTBEAT_SECONDS = 30;
export const LATE_AFTER_SECONDS = HEARTBEAT_SECONDS * 5; // 150
export const STALE_AFTER_SECONDS = 60 * 30; // 1800

/**
 * @param {{status?: string, last_seen_at?: string|null}} device
 * @param {Date} [now]
 * @returns {{state: string, reporting: boolean, secondsSince: number|null, needsAttention: boolean}}
 */
export function classifyDevice(device, now = new Date()) {
  const status = device?.status ?? "unknown";

  // Status wins over time. A revoked device that beat five seconds ago is not
  // healthy, it is a device that has not noticed yet.
  if (status !== "active" && status !== "pending") {
    return { state: status === "revoked" ? "revoked" : status, reporting: false, secondsSince: null, needsAttention: false };
  }

  const raw = device?.last_seen_at;
  const seen = raw ? new Date(raw) : null;

  // This column has been written for months and read by nothing, so it has
  // never been validated by anything downstream. Treat an unparseable or
  // future value as "no evidence", never as fresh -- the failure mode to avoid
  // is a broken clock reading as a healthy device.
  if (!seen || Number.isNaN(seen.getTime()) || seen.getTime() > now.getTime()) {
    return { state: "never_seen", reporting: false, secondsSince: null, needsAttention: status === "active" };
  }

  const secondsSince = Math.floor((now.getTime() - seen.getTime()) / 1000);

  let state;
  if (secondsSince < HEARTBEAT_SECONDS) state = "online";
  else if (secondsSince < LATE_AFTER_SECONDS) state = "late";
  else if (secondsSince < STALE_AFTER_SECONDS) state = "stale";
  else state = "offline";

  const reporting = state === "online" || state === "late";
  return { state, reporting, secondsSince, needsAttention: status === "active" && !reporting };
}

/**
 * Fleet roll-up. `needsAttention` counts only ACTIVE devices that are not
 * reporting -- a device you revoked on purpose is not a problem, and counting
 * it as one is how a dashboard becomes something people stop looking at.
 *
 * @param {Array<{status?: string, last_seen_at?: string|null}>} devices
 * @param {Date} [now]
 */
export function summarise(devices, now = new Date()) {
  const byState = {};
  let reporting = 0;
  let needsAttention = 0;

  for (const d of devices ?? []) {
    const c = classifyDevice(d, now);
    byState[c.state] = (byState[c.state] ?? 0) + 1;
    if (c.reporting) reporting++;
    if (c.needsAttention) needsAttention++;
  }

  return { total: (devices ?? []).length, reporting, needsAttention, byState };
}
