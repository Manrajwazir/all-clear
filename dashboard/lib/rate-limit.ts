/**
 * Rate limiting — two layers.
 * Phase 2, Step 2.9. Second layer added Phase 3, Step 3.0b (BUILD_CONTEXT D6).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LAYER 1 — in-memory sliding window (this file, `checkRateLimit`)
 *
 *   A Map of key → request timestamps, in the process. Free, instant, and
 *   NOT A LIMIT: Vercel functions cold-start, which wipes it, and concurrent
 *   instances each keep their own. It can only ever undercount relative to
 *   layer 2, which is exactly what makes it safe as a pre-filter — if it says
 *   no, layer 2 would have said no too, so we can reject without a round trip.
 *
 * LAYER 2 — durable fixed window in Postgres (`checkDurableRateLimit`)
 *
 *   `check_rate_limit()` from migration 006, backed by the
 *   `rate_limit_counters` table. Survives cold starts, shared across every
 *   instance. This is the one that actually holds.
 *
 *   Fixed window, not sliding: at a boundary a caller can burst up to 2x the
 *   limit across two adjacent windows. Accepted deliberately — these limits
 *   stop abuse and runaway retry loops, they do not meter billing, and a fixed
 *   window is one atomic upsert instead of a range scan.
 *
 * Use `enforceRateLimit()` to run both in the right order.
 *
 * Upstash/Redis was considered and rejected 2026-08-28: a new vendor for one
 * counter, and its free tier is tight against 30-second heartbeats from every
 * device. Postgres is already in the request path.
 * ─────────────────────────────────────────────────────────────────────────
 */

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Seconds until the window resets */
  retryAfter: number;
}

// Global store: key → list of request timestamps (ms)
const store = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks from abandoned keys
const CLEANUP_INTERVAL_MS = 60_000; // Every 60 seconds
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, timestamps] of store) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, valid);
    }
  }
}

/**
 * Check and consume a rate limit token for the given key.
 *
 * @param key   Unique identifier (e.g. IP address or device API key hash)
 * @param config  Rate limit configuration
 * @returns       Whether the request is allowed, remaining count, and retry-after
 *
 * Usage:
 *   const result = checkRateLimit(ip, { limit: 3, windowSeconds: 60 });
 *   if (!result.allowed) {
 *     return NextResponse.json(
 *       { error: "Too many requests" },
 *       { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
 *     );
 *   }
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  // Run periodic cleanup
  cleanup(windowMs);

  // Get or create the timestamp list for this key
  const timestamps = store.get(key) ?? [];

  // Prune expired timestamps
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= config.limit) {
    // Rate limit exceeded
    const oldestInWindow = valid[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

    store.set(key, valid);
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  // Allowed — record this request
  valid.push(now);
  store.set(key, valid);

  return {
    allowed: true,
    remaining: config.limit - valid.length,
    retryAfter: 0,
  };
}

// ─── Layer 2: the durable limiter ───────────────────────────────────

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

// ─── Bucket naming ──────────────────────────────────────────────────

/**
 * ⚠ BUCKET NAMING IS A SECURITY DETAIL, NOT A FORMATTING CHOICE.
 *
 * Never build a bucket from an API key SECRET. The secret must not reach any
 * store, any log line, or any database row — and `rate_limit_counters.bucket`
 * is all three. Always use the public `key_id` half, which is what
 * `authenticateDevice()` returns for exactly this purpose.
 */

/** Bucket for a per-device limit. `keyId` is the PUBLIC half — never the secret. */
export function keyBucket(scope: string, keyId: string): string {
  return `key:${keyId}:${scope}`;
}

/** Bucket for a per-IP limit. */
export function ipBucket(scope: string, ip: string): string {
  return `ip:${ip}:${scope}`;
}

// ─── Pre-configured rate limiters for specific endpoints ────────────
//
// EVERY device endpoint needs BOTH a per-key and a per-IP limit.
//
//   Per-key alone is decorative: an attacker rotating invented bearer keys
//   mints a fresh 120/min bucket per key and is never limited at all.
//
//   Per-IP alone is too blunt: several devices on one construction site
//   legitimately share a single address through NAT, so a per-IP limit sized
//   for one device would throttle a real customer. Hence the generous IP
//   numbers below, each with its arithmetic written out.

/** Pilot request form: 3 requests per minute per IP. */
export const PILOT_FORM_LIMIT: RateLimitConfig = { limit: 3, windowSeconds: 60 };

/** Device provisioning: 3 per minute per IP. Provisioning happens once per device, by hand. */
export const PROVISION_LIMIT: RateLimitConfig = { limit: 3, windowSeconds: 60 };

/** Device heartbeat: 120 per minute per device key. The client sends one every 30s. */
export const HEARTBEAT_LIMIT: RateLimitConfig = { limit: 120, windowSeconds: 60 };

/** Violation ingestion: 60 per minute per device key. */
export const VIOLATION_LIMIT: RateLimitConfig = { limit: 60, windowSeconds: 60 };

/**
 * Heartbeat, per IP: 600/min.
 * Sized for a site NATting several devices — 4 devices x 120/min = 480, plus
 * headroom for a queue draining after an outage.
 */
export const HEARTBEAT_IP_LIMIT: RateLimitConfig = { limit: 600, windowSeconds: 60 };

/**
 * Violation ingestion, per IP: 300/min.
 * 4 devices x 60/min = 240, plus headroom. Note a real site will not sustain
 * anything near this: it is an abuse ceiling, not an expected load.
 */
export const VIOLATION_IP_LIMIT: RateLimitConfig = { limit: 300, windowSeconds: 60 };

/**
 * Extract the client IP from a Next.js request.
 * Checks x-forwarded-for (Vercel/proxy) first, falls back to x-real-ip.
 *
 * Note this header is client-controllable in principle. On Vercel the platform
 * overwrites it at the edge, so it is trustworthy in production; behind a
 * different proxy it would need re-checking. The per-IP layer is a blunt abuse
 * ceiling, not an identity — the per-key layer is the one that identifies.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
