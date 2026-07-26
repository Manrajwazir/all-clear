/**
 * In-memory sliding-window rate limiter.
 * Phase 2, Step 2.9
 *
 * Why in-memory instead of Redis?
 *   - Zero external dependencies (no Upstash/Redis bill)
 *   - Sufficient for single-instance Vercel deployments
 *   - If we scale to multiple instances, swap for @upstash/ratelimit
 *
 * How it works:
 *   Each unique key (IP or device key) gets a list of timestamps.
 *   On each request, we prune timestamps older than the window,
 *   then check if the count exceeds the limit.
 *
 * Limitation:
 *   Vercel serverless functions can cold-start, which resets the
 *   in-memory store. This is acceptable for now — it means rate
 *   limits are "best effort" and a cold start gives a clean slate.
 *   Production upgrade path: @upstash/ratelimit with Redis.
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

// ─── Pre-configured rate limiters for specific endpoints ────────────

/** Pilot request form: 3 requests per minute per IP */
export const PILOT_FORM_LIMIT: RateLimitConfig = { limit: 3, windowSeconds: 60 };

/** Device provisioning: 3 requests per minute per IP */
export const PROVISION_LIMIT: RateLimitConfig = { limit: 3, windowSeconds: 60 };

/** Device heartbeat: 120 requests per minute per device key */
export const HEARTBEAT_LIMIT: RateLimitConfig = { limit: 120, windowSeconds: 60 };

/** Violation ingestion: 60 requests per minute per device key */
export const VIOLATION_LIMIT: RateLimitConfig = { limit: 60, windowSeconds: 60 };

/**
 * Extract the client IP from a Next.js request.
 * Checks x-forwarded-for (Vercel/proxy) first, falls back to x-real-ip.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
