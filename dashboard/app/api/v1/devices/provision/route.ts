import { NextRequest, NextResponse } from "next/server";

import {
  formatApiKey,
  generateKeyId,
  generateSecret,
  sha256Hex,
} from "@/lib/device-key-format";
import {
  PROVISION_LIMIT,
  enforceRateLimit,
  getClientIp,
  ipBucket,
} from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { provisionDeviceSchema } from "@/lib/validations";

/**
 * POST /api/v1/devices/provision
 * Phase 3, Step 3.1. Design: ADR 0002 (split-token key), ADR 0006 (org stamping).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE ONE ENDPOINT THAT ISSUES CREDENTIALS.
 *
 * Every other /api/v1/ route authenticates with a device API key. This one
 * cannot — it is how a device GETS that key. Its authentication is the
 * one-time provisioning token in the body, and the entire security of the
 * device fleet rests on that token being single-use, short-lived, and
 * unguessable.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * THE FLOW
 *
 *   1. Rate limit, per IP, BEFORE anything else.
 *   2. Parse and validate the body. Nothing but `provisioning_token` survives.
 *   3. Hash the presented token. The plaintext never leaves this function.
 *   4. Mint a fresh key_id + secret locally.
 *   5. ONE call to claim_device() — the claim, the expiry check and the PIPA
 *      attestation gate happen atomically inside Postgres.
 *   6. Map the returned reason to a status code and answer.
 *
 * WHY THE KEY IS MINTED BEFORE THE CLAIM SUCCEEDS
 *
 * claim_device() writes key_id and api_key_hash in the same UPDATE that flips
 * status to 'active', because a device that is active without a key, or has a
 * key without being active, is a broken state that something would eventually
 * have to reconcile. That means the hash must exist before the call. If the
 * claim then fails we simply discard the generated values — they were never
 * stored, never sent, and never existed anywhere but this function's stack.
 *
 * WHY THERE IS NO DEVICE AUTH HERE, AND WHY THAT IS NOT A HOLE
 *
 * The provisioning token IS the credential. It is 32 random bytes, stored only
 * as SHA-256, valid for 48 hours, and destroyed by the claim that consumes it
 * (claim_device nulls both the hash and the expiry). An attacker who cannot
 * guess it gets the same generic 400 as someone whose token expired yesterday.
 */

/** Node runtime is required: this route uses node:crypto via device-key-format. */
export const runtime = "nodejs";

/**
 * ONE body for unknown, already-claimed, expired AND malformed tokens.
 *
 * These are four different situations and the caller is told none of them
 * apart. An attacker probing tokens must not be able to distinguish "this
 * token never existed" from "this token was real but is already spent" — the
 * second answer turns a blind guess into a confirmed hit and tells them to go
 * looking for whoever holds the device.
 *
 * The cost is real and accepted: an operator who pastes a truncated token gets
 * told it is invalid rather than told it is short. Their next action is the
 * same either way — ask an admin for a fresh token.
 */
const GENERIC_TOKEN_ERROR = { error: "Invalid or expired provisioning token." };

/**
 * No response from this route may be cached anywhere.
 *
 * The success body contains a plaintext API key that is shown exactly once. A
 * caching proxy or a browser disk cache holding onto it would turn a
 * single-use secret into a stored one. Applied to the failures too, so no
 * future edit can produce a cacheable path by accident.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(request: NextRequest) {
  try {
    // ── 1. Rate limit, before any work ────────────────────────────────────
    //
    // First, not last. Provisioning is the most expensive unauthenticated
    // path we have — a JSON parse, a SHA-256, 40 bytes of CSPRNG output and a
    // database round trip, all reachable with no credential at all. Rate
    // limiting after the work would mean an attacker still gets to spend it.
    //
    // 3/min per IP (PROVISION_LIMIT). Provisioning happens once per device,
    // by hand, so this is generous for every legitimate use and hostile to
    // anyone enumerating tokens.
    const ip = getClientIp(request);
    const rl = await enforceRateLimit(ipBucket("provision", ip), PROVISION_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { ...NO_STORE, "Retry-After": String(rl.retryAfter) },
        },
      );
    }

    // ── 2. Body ───────────────────────────────────────────────────────────
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      // Malformed JSON never reached the schema, so answer it the same way as
      // a malformed token rather than describing the parse failure.
      return NextResponse.json(GENERIC_TOKEN_ERROR, {
        status: 400,
        headers: NO_STORE,
      });
    }

    // Zod strips every key except provisioning_token. A body smuggling
    // organization_id, site_id or status has those silently dropped — org and
    // site come back from the database, never from the caller (ADR 0006).
    const parsed = provisionDeviceSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(GENERIC_TOKEN_ERROR, {
        status: 400,
        headers: NO_STORE,
      });
    }

    // ── 3 & 4. Hash the token, mint the key ───────────────────────────────
    //
    // `provisioning_token` and `secret` are the only two plaintext secrets in
    // this function. Neither is logged, neither is stored, and only the second
    // is ever transmitted — once, in the success body.
    const provisioningTokenHash = sha256Hex(parsed.data.provisioning_token);

    const keyId = generateKeyId();
    const secret = generateSecret();
    const apiKeyHash = sha256Hex(secret);

    // ── 5. The atomic claim ───────────────────────────────────────────────
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("claim_device", {
      p_provisioning_token_hash: provisioningTokenHash,
      p_key_id: keyId,
      p_api_key_hash: apiKeyHash,
    });

    if (error) {
      // Includes the vanishingly unlikely devices.key_id unique violation
      // (23505) from a key_id collision — 8 random bytes, so ~1 in 2^64. It is
      // a 500 rather than a retry because a retry loop hiding a real constraint
      // problem is worse than one failed provisioning an operator can repeat.
      console.error("claim_device RPC failed:", error.message);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: NO_STORE },
      );
    }

    // claim_device always RETURN QUERYs exactly one row. Empty means the
    // function was changed underneath us, which is a server fault, not a
    // caller fault.
    const row = data?.[0];
    if (!row) {
      console.error("claim_device returned no row");
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: NO_STORE },
      );
    }

    // ── 6. Map reason → status ────────────────────────────────────────────
    switch (row.reason) {
      case "claimed": {
        // key_id is the PUBLIC half and is safe to log. The secret is not, and
        // does not appear in any log line in this codebase.
        console.log(
          `Device provisioned: device_id=${row.claimed_device_id} key_id=${keyId}`,
        );

        return NextResponse.json(
          {
            api_key: formatApiKey(keyId, secret),
            device_id: row.claimed_device_id,
            organization_id: row.claimed_organization_id,
            site_id: row.claimed_site_id,
            warning:
              "Store this key now. It is shown exactly once and cannot be recovered. Only its hash is kept.",
          },
          { status: 200, headers: NO_STORE },
        );
      }

      case "site_not_attested": {
        // A SPECIFIC answer, unlike the generic 400 above, and deliberately so.
        //
        // Reaching this branch proves the caller presented a valid, unspent,
        // unexpired token — so there is nothing left to leak by being helpful.
        // And the person holding that token cannot fix this themselves or even
        // guess at it: the block is an Alberta PIPA worker-notification
        // attestation that an org admin has to complete against the site. A
        // generic 400 here would send a technician to debug a token that is
        // perfectly fine (open item 1.3).
        return NextResponse.json(
          {
            error:
              "This site has not completed its worker notification attestation. An organisation administrator must complete it before any device can be activated at this site.",
            code: "site_not_attested",
          },
          { status: 403, headers: NO_STORE },
        );
      }

      default: {
        // 'not_found' — unknown, already claimed, or expired. All one answer.
        return NextResponse.json(GENERIC_TOKEN_ERROR, {
          status: 400,
          headers: NO_STORE,
        });
      }
    }
  } catch (err) {
    // Catch-all so an unexpected throw cannot leak a stack trace to a caller.
    // Note what is NOT here: the provisioning token and the minted secret are
    // both local to the try block and neither is included in this log.
    console.error("Provision route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
