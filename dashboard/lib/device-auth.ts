import "server-only";

import { parseApiKey, sha256Hex, timingSafeEqualHex } from "./device-key-format";
import { createServiceRoleClient } from "./supabase/service-role";

/**
 * Device API key authentication.
 * Phase 3, Step 3.0b. Design: ADR 0002. Org stamping: ADR 0006.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ THIS MODULE USES THE SERVICE ROLE AND THEREFORE BYPASSES RLS.
 *
 * It is the one place where correct RLS policies do NOT protect you. The
 * application logic below is the only control. A bug here is cross-tenant
 * data exposure, not an empty result set.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * THIS IS THE ONLY SOURCE OF ORGANISATION CONTEXT FOR A DEVICE REQUEST.
 *
 * Every /api/v1/ route stamps organization_id and site_id from what this
 * function returns, and IGNORES whatever the request body says (ADR 0006). A
 * device that could name its own organisation could file violations against
 * anyone.
 *
 * HOW IT WORKS
 *
 *   1. Pull `Authorization: Bearer ac_live_<key_id>_<secret>`.
 *   2. Parse it. Malformed → 401, generic body.
 *   3. ONE indexed lookup by the public key_id half.
 *   4. ONE constant-time comparison of sha256(secret) against api_key_hash.
 *   5. Only then, check status = 'active'.
 *
 * The order of 4 and 5 is deliberate and is explained at the call site below.
 */

/** What a successful authentication yields. The only trusted org context. */
export interface AuthenticatedDevice {
  device_id: string;
  organization_id: string;
  site_id: string;
  /** Public half of the presented key. Safe to log and to key a rate limit on. */
  key_id: string;
}

/**
 * Why authentication failed.
 *
 * `unauthenticated` deliberately covers three different situations — no
 * header, a malformed key, an unknown key_id, and a wrong secret. The caller
 * must render all of them as the SAME 401 with the SAME body. Telling the two
 * apart would confirm which key_ids exist, which turns a guess into a search.
 *
 * `revoked` is separate and answers 403, because by that point the caller has
 * already proven it holds a real, correct secret for a real device. There is
 * nothing left to leak, and the operator needs to know the device was turned
 * off rather than that its key is wrong.
 */
export type DeviceAuthFailureReason = "unauthenticated" | "revoked";

export type DeviceAuthResult =
  | { ok: true; device: AuthenticatedDevice }
  | { ok: false; reason: DeviceAuthFailureReason; status: 401 | 403 };

/**
 * A real SHA-256 digest of a value nothing will ever present.
 *
 * Used when the key_id lookup finds nothing, so that path still performs a
 * full constant-time comparison instead of returning early. Without it,
 * "no such key_id" answers measurably faster than "wrong secret", and response
 * timing becomes an oracle for which key_ids exist.
 *
 * Computed once at module load, not per request.
 */
const DUMMY_HASH = sha256Hex(
  "all-clear::device-auth::constant-time-placeholder::not-a-real-secret",
);

/**
 * Authenticate a device from a request's Authorization header.
 *
 * Never throws for an auth failure — an unexpected failure is a thrown error,
 * and a rejected caller is a returned result. Callers can therefore branch on
 * `ok` without a try/catch around the normal path.
 */
export async function authenticateDevice(
  request: Request,
): Promise<DeviceAuthResult> {
  const header = request.headers.get("authorization");

  if (!header || !header.startsWith("Bearer ")) {
    return { ok: false, reason: "unauthenticated", status: 401 };
  }

  const parsed = parseApiKey(header.slice("Bearer ".length));
  if (!parsed) {
    // Shape is wrong, so there is nothing to look up. The key FORMAT is
    // public information, so returning early here leaks nothing about which
    // keys exist — unlike the lookup-miss case below.
    return { ok: false, reason: "unauthenticated", status: 401 };
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("devices")
    .select("id, organization_id, site_id, status, api_key_hash")
    .eq("key_id", parsed.keyId)
    .maybeSingle();

  if (error) {
    // A database failure is not an authentication decision. Surface it as a
    // thrown error so the route answers 500 rather than 401 — a 401 here
    // would tell a caller their key is bad when in fact our database is down,
    // and a device would helpfully stop retrying.
    throw new Error(`device-auth lookup failed: ${error.message}`);
  }

  const presentedHash = sha256Hex(parsed.secret);

  // ── The constant-time compare, including for the miss ────────────────────
  //
  // `data` being null means no device has that key_id. We still run a full
  // comparison against DUMMY_HASH so this path costs the same as a real one.
  //
  // Honest scope: this equalises the hashing and comparison work, not the
  // database lookup, where an index miss can still be marginally faster than
  // a hit. It narrows the signal rather than eliminating it. Eliminating it
  // entirely would need a constant-time lookup, which Postgres does not offer
  // and which is not worth building at this threat level.
  const storedHash = data?.api_key_hash ?? DUMMY_HASH;
  const secretMatches = timingSafeEqualHex(presentedHash, storedHash);

  if (!data || !data.api_key_hash || !secretMatches) {
    return { ok: false, reason: "unauthenticated", status: 401 };
  }

  // ── Status is checked AFTER the secret, deliberately ─────────────────────
  //
  // If a revoked device answered 403 before the secret was verified, anyone
  // could enumerate revoked key_ids by watching for 403 instead of 401.
  // Verify first, then report status — by this point the caller has proven it
  // holds the real secret, so a specific answer costs nothing.
  //
  // This check is the entire reason revocation works. Without it, setting
  // status='revoked' changes nothing: the row still exists and the hash still
  // matches. Every endpoint inherits it by calling this function, which is why
  // no route should ever do its own device lookup.
  if (data.status !== "active") {
    return { ok: false, reason: "revoked", status: 403 };
  }

  return {
    ok: true,
    device: {
      device_id: data.id,
      organization_id: data.organization_id,
      site_id: data.site_id,
      key_id: parsed.keyId,
    },
  };
}

/**
 * The body every 401 and 403 from a device route must use.
 *
 * One shared shape so no route accidentally becomes more informative than the
 * others. "Invalid credentials" covers a missing header, a malformed key, an
 * unknown key and a wrong secret alike.
 */
export function deviceAuthErrorBody(reason: DeviceAuthFailureReason): {
  error: string;
} {
  return reason === "revoked"
    ? { error: "This device has been revoked. Contact your administrator." }
    : { error: "Invalid credentials" };
}
