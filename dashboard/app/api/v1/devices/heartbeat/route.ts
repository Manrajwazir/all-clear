import { NextRequest, NextResponse } from "next/server";

import { authenticateDevice, deviceAuthErrorBody } from "@/lib/device-auth";
import {
  HEARTBEAT_IP_LIMIT,
  HEARTBEAT_LIMIT,
  enforceRateLimit,
  getClientIp,
  ipBucket,
  keyBucket,
} from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { heartbeatSchema } from "@/lib/validations";

/**
 * POST /api/v1/devices/heartbeat
 * Phase 3, Step 3.2.
 *
 * "I am still here." A device calls this every 30 seconds; the endpoint sets
 * devices.last_seen_at and returns. That is the whole feature.
 *
 * It matters more than its size suggests, for two reasons:
 *
 *   1. It is the FIRST route to authenticate with a device API key, so it is
 *      what proves the key issued by /provision is actually usable, and what
 *      proves setting status='revoked' actually turns a device off.
 *   2. It is the highest-frequency route in the product. Every site multiplies
 *      it by every device, forever. Anything wasteful here is wasteful at a
 *      rate of 2,880 calls per device per day.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ WHY THE PER-KEY RATE LIMIT COMES *AFTER* AUTHENTICATION
 *
 * This ordering looks wrong against the general rule "rate limit before the
 * expensive work", and it is deliberate.
 *
 * The per-key bucket is keyed on key_id — the PUBLIC half of an API key, which
 * appears in plaintext in every request. If the per-key limit ran before
 * authentication, anyone could take a real device's key_id, attach any garbage
 * secret, and fire 120 requests a minute at this endpoint. Every one would fail
 * authentication, and every one would still burn the victim's budget. The real
 * device on the real job site would then get 429s and stop reporting. That is a
 * denial of service against a customer, delivered through the control that was
 * supposed to prevent one.
 *
 * So the layers split by what they can safely see:
 *
 *   BEFORE auth  →  per-IP limit. Costs nothing to check, needs no identity,
 *                   and caps how many authentication attempts an attacker can
 *                   make at all. This is the layer the general rule is about.
 *   AFTER auth   →  per-key limit. Only a caller that has PROVEN it holds the
 *                   secret may spend that key's budget.
 *
 * The per-IP ceiling (600/min) is what bounds the database work: at most 600
 * authentication lookups a minute can originate from one address, whether they
 * succeed or not.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Node runtime: device-auth reaches node:crypto for the constant-time compare. */
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(request: NextRequest) {
  try {
    // ── 1. Per-IP limit — before authentication ───────────────────────────
    //
    // 600/min. Generous on purpose: several devices at one site legitimately
    // share a single public address through NAT, so a limit sized for one
    // device would throttle a real customer. This is an abuse ceiling, not an
    // identity.
    const ip = getClientIp(request);
    const ipLimit = await enforceRateLimit(
      ipBucket("heartbeat", ip),
      HEARTBEAT_IP_LIMIT,
    );
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: { ...NO_STORE, "Retry-After": String(ipLimit.retryAfter) },
        },
      );
    }

    // ── 2. Authenticate ───────────────────────────────────────────────────
    //
    // One call covers all of it: header present, key well-formed, key_id known,
    // secret correct (compared in constant time), and status still 'active'.
    // No route does its own device lookup — the status check that makes
    // revocation mean anything lives in there, and a route that skipped it
    // would silently keep serving revoked devices.
    //
    // A database failure THROWS rather than returning a 401, and is caught
    // below as a 500. A 401 would tell a working device its key is bad, and a
    // well-behaved client would stop retrying over what is our outage.
    const auth = await authenticateDevice(request);
    if (!auth.ok) {
      return NextResponse.json(deviceAuthErrorBody(auth.reason), {
        status: auth.status,
        headers: NO_STORE,
      });
    }

    // ── 3. Per-key limit — after authentication ───────────────────────────
    //
    // 120/min against a client that sends one every 30 seconds (2/min). The
    // headroom is for a device restarting into a retry loop, which is the
    // realistic failure this catches — not an attacker, who never gets here.
    const keyLimit = await enforceRateLimit(
      keyBucket("heartbeat", auth.device.key_id),
      HEARTBEAT_LIMIT,
    );
    if (!keyLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: { ...NO_STORE, "Retry-After": String(keyLimit.retryAfter) },
        },
      );
    }

    // ── 4. Body ───────────────────────────────────────────────────────────
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: NO_STORE },
      );
    }

    const parsed = heartbeatSchema.safeParse(raw);
    if (!parsed.success) {
      // Field-level detail is returned here, unlike on /provision. The contrast
      // is intentional: this caller has already proven it holds a valid device
      // key, so there is no anonymous attacker to feed information to, and a
      // device developer debugging a client deserves to know which field is
      // wrong. On /provision the caller is anonymous and gets one flat message.
      return NextResponse.json(
        {
          error: "Invalid heartbeat body",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers: NO_STORE },
      );
    }

    // ── 5. The actual work ────────────────────────────────────────────────
    //
    // last_seen_at is stamped from the SERVER clock, never from anything the
    // device sent. A device with a wrong clock — or one lying about it — must
    // not be able to claim it checked in at a time it did not. Same rule that
    // governs received_at on a violation (ADR 0003).
    //
    // Everything else in the validated body is DISCARDED. cpu_temp,
    // uptime_seconds and model_version have no columns to live in, and
    // inventing a device_health table mid-phase is scope creep. They are still
    // validated so the client contract stays honest and adding the columns
    // later is a migration rather than a client change.
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", auth.device.device_id);

    if (error) {
      console.error("Heartbeat update failed:", error.message);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      { status: "ok" },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    console.error("Heartbeat route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
