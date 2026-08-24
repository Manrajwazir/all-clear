import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-IP rate limiting for the assessment form.
 *
 * Upstash rather than an in-memory counter because Vercel functions are
 * stateless: separate instances would each keep their own count, which means
 * an in-memory limit stops one slow bot and nothing else.
 */

const configured =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const limiter = configured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      // Three submissions per ten minutes. A real enquiry is one, maybe two
      // if they mistype an address. Anything past that is not a customer.
      limiter: Ratelimit.slidingWindow(3, "10 m"),
      prefix: "allclear:assessment",
      analytics: false,
    })
  : null;

export type LimitOutcome = {
  allowed: boolean;
  /** True when the limiter could not be consulted at all. */
  degraded: boolean;
};

/**
 * Fails OPEN, deliberately.
 *
 * If Upstash is unreachable or unconfigured, a real prospect filling in the
 * form still gets through. Losing a genuine enquiry is a worse outcome than
 * letting a burst of spam past, and the honeypot and timing checks still
 * apply either way. The tradeoff is recorded here so it is a decision rather
 * than an accident.
 */
export async function checkRateLimit(ip: string): Promise<LimitOutcome> {
  if (!limiter) return { allowed: true, degraded: true };

  try {
    const { success } = await limiter.limit(ip);
    return { allowed: success, degraded: false };
  } catch {
    return { allowed: true, degraded: true };
  }
}

/**
 * Vercel sets x-forwarded-for; the client address is the first entry. Falling
 * back to a constant means an unknown source shares one bucket, which is the
 * conservative direction.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
