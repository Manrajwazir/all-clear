import "server-only";

import type { RateLimitConfig, RateLimitResult } from "./rate-limit";
import { checkRateLimit } from "./rate-limit";

/**
 * Rate limiting, layer 2 — the durable Postgres counter.
 * Split out of `rate-limit.ts` on 2026-09-07 (handover plan step B3).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS ITS OWN FILE
 *
 * It is the only part of rate limiting that touches the service-role client,
 * and the service role is device-API-only. Keeping it here makes that a FILE
 * boundary rather than a convention:
 *
 *   lib/rate-limit.ts           layer 1, in-memory, no database. Shared with
 *                               the dashboard and safe to hand to anyone.
 *   lib/rate-limit-durable.ts   layer 2. Reaches the service role, so it
 *                               belongs with /api/v1/ and travels nowhere else.
 *
 * Before the split, `rate-limit.ts` held a dynamic
 * `import("./supabase/service-role")` — the only dynamic import in the
 * codebase. It was written that way so the pilot-request route would not pull
 * in the service-role key at runtime, but a bundler still resolves the path at
 * BUILD time. That single line was the one thing preventing the dashboard from
 * building without the device layer present.
 *
 * `import "server-only"` above is the belt to that braces: importing this from
 * a Client Component is now a build error, not a leaked key in a JS bundle.
 *
 * Layer 1 remains a free pre-filter in front of this. It can only ever
 * undercount relative to layer 2, so a layer-1 rejection is always one layer 2
 * would also have made — which is what makes the short-circuit safe rather
 * than merely fast.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Check the durable Postgres counter.
 *
 * Counts the call it is asked about, so `allowed: false` means THIS request is
 * over the limit — not that the next one would be.
 *
 * FAILS OPEN on a database error, deliberately. A rate limiter is a control on
 * abuse, not a safety-critical path; if Postgres is unreachable the endpoint
 * itself is about to fail anyway, and turning a database blip into a wall of
 * 429s would stop every real device on every site from reporting. Layer 1 is
 * still in front. The failure is logged so it is visible rather than silent.
 */
export async function checkDurableRateLimit(
  bucket: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  // Imported lazily so this module stays importable from contexts that have no
  // service-role key — the pilot-request route uses only layer 1.
  const { createServiceRoleClient } = await import("./supabase/service-role");

  try {
    const { data, error } = await createServiceRoleClient().rpc("check_rate_limit", {
      p_bucket: bucket,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds,
    });

    if (error || !data || data.length === 0) {
      console.error("Durable rate limit check failed, failing open:", error?.message);
      return { allowed: true, remaining: 0, retryAfter: 0 };
    }

    const row = data[0];
    return {
      allowed: row.allowed,
      remaining: 0, // the SQL function does not report a remaining count
      retryAfter: row.allowed ? 0 : Math.max(row.retry_after_seconds, 1),
    };
  } catch (err) {
    console.error("Durable rate limit check threw, failing open:", err);
    return { allowed: true, remaining: 0, retryAfter: 0 };
  }
}

/**
 * Run both layers in the correct order: memory first as a free reject, then
 * Postgres as the authority.
 *
 * Layer 1 only ever sees a subset of the traffic layer 2 sees, so a layer-1
 * rejection is always one layer 2 would also have made. That is what makes the
 * short-circuit safe rather than merely fast.
 */
export async function enforceRateLimit(
  bucket: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const memory = checkRateLimit(bucket, config);
  if (!memory.allowed) return memory;

  return checkDurableRateLimit(bucket, config);
}
