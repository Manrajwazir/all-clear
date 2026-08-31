/**
 * Device API key format — generation, parsing, hashing.
 * Phase 3, Step 3.0b. Design: ADR 0002 (split-token device API key).
 *
 * DELIBERATELY HAS NO `server-only` IMPORT.
 *
 * Everything here is pure string and crypto work against values it is handed.
 * It reads no environment variable, opens no connection, and touches no
 * secrets store — so it stays unit-testable from a plain Node script, and the
 * key-generation side (provisioning) can use it without dragging in the
 * service role. The part that talks to the database is `device-auth.ts`, and
 * that one is server-only.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE FORMAT
 *
 *     ac_live_<key_id>_<secret>
 *     └──┬───┘ └──┬──┘ └──┬───┘
 *        │        │       └─ 32 random bytes, base64url (43 chars). NEVER
 *        │        │          stored. Only sha256(secret) is kept, and the
 *        │        │          whole key is shown to the operator exactly once.
 *        │        └───────── 8 random bytes, lowercase hex (16 chars). Public,
 *        │                   indexed, safe to log. Identifies WHICH device row
 *        │                   to compare against, in one indexed lookup.
 *        └────────────────── fixed prefix. `live` leaves room for `ac_test_`.
 *
 * Why split at all: without a public half you cannot find the row to compare
 * against without scanning every device and hashing each one — which is
 * circular (you do not know the org until you know the device), unscalable,
 * and a denial-of-service vector. Full reasoning in ADR 0002.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY key_id IS HEX AND NOT base64url
 *
 * This is the one non-obvious constraint in the file. base64url's alphabet
 * includes `_`, and `_` is also the field separator. If both halves were
 * base64url, `ac_live_a_b_c` would be genuinely ambiguous and parsing would
 * depend on guessing.
 *
 * Hex has no `_`. So after the fixed prefix, the FIRST underscore is always
 * the separator, no matter what the secret contains. Parsing is exact rather
 * than best-effort. Do not "simplify" key_id to base64url later.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Fixed prefix on every issued key. `live` leaves room for a future `ac_test_`. */
export const KEY_PREFIX = "ac_live_";

/** key_id is 8 random bytes rendered as lowercase hex. */
const KEY_ID_BYTES = 8;

/** The secret is 32 random bytes — 256 bits, not stretchable and not guessable. */
const SECRET_BYTES = 32;

/** A parsed, well-formed API key. Says nothing about whether it is VALID. */
export interface ParsedApiKey {
  /** Public half. Safe to log, safe to put in a rate-limit bucket. */
  keyId: string;
  /** Secret half. Never log this, never store it, never put it in a bucket. */
  secret: string;
}

/**
 * A fresh public key identifier: 16 lowercase hex characters.
 *
 * 8 bytes is plenty — this is an identifier, not a secret. Its only jobs are
 * to be unique (the `devices.key_id` column also carries a UNIQUE constraint)
 * and to contain no `_`.
 */
export function generateKeyId(): string {
  return randomBytes(KEY_ID_BYTES).toString("hex");
}

/**
 * A fresh 32-byte secret, base64url encoded (43 characters, no padding).
 *
 * base64url rather than hex purely for length: 43 characters instead of 64,
 * for the same 256 bits, in a key an operator may have to copy by hand.
 */
export function generateSecret(): string {
  return randomBytes(SECRET_BYTES).toString("base64url");
}

/**
 * A fresh one-time provisioning token.
 *
 * Same shape and strength as a key secret, but a different thing: it is
 * presented once to claim a device, and the server stores only its SHA-256
 * with a 48-hour expiry. Migration 005 dropped the old plaintext
 * `devices.provisioning_token` column; do not bring it back.
 */
export function generateProvisioningToken(): string {
  return randomBytes(SECRET_BYTES).toString("base64url");
}

/** Assemble the single string handed to the operator exactly once. */
export function formatApiKey(keyId: string, secret: string): string {
  return `${KEY_PREFIX}${keyId}_${secret}`;
}

/**
 * Split a presented key into its two halves.
 *
 * Returns `null` for anything that is not the right shape. A null here means
 * "this cannot be a key we issued" and the caller should answer 401 — but note
 * it must answer with the SAME generic body it uses for a wrong secret. The
 * format itself is public; which keys exist is not.
 *
 * This function does no I/O and makes no claim about validity.
 */
export function parseApiKey(raw: string | null | undefined): ParsedApiKey | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed.startsWith(KEY_PREFIX)) return null;

  const body = trimmed.slice(KEY_PREFIX.length);

  // The first underscore is the separator, guaranteed, because key_id is hex.
  const sep = body.indexOf("_");
  if (sep <= 0) return null;

  const keyId = body.slice(0, sep);
  const secret = body.slice(sep + 1);

  // Shape checks, not strength checks. A key that fails these was not issued
  // by us, so there is nothing to look up.
  if (keyId.length !== KEY_ID_BYTES * 2) return null;
  if (!/^[0-9a-f]+$/.test(keyId)) return null;
  if (secret.length < 32 || secret.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(secret)) return null;

  return { keyId, secret };
}

/**
 * SHA-256 of a UTF-8 string, lowercase hex.
 *
 * The one hashing implementation in the codebase, used for BOTH the API key
 * secret and the provisioning token, on BOTH the write side (provisioning)
 * and the read side (authentication). Two copies of this would eventually
 * become two hashes, and the failure would look like "valid keys stopped
 * working" rather than like a bug.
 *
 * SHA-256 and not bcrypt — see ADR 0002. Key stretching exists to make
 * low-entropy human passwords expensive to guess. A 32-byte random secret is
 * already infeasible to brute-force, bcrypt costs ~100 ms by design on an
 * endpoint that must serve 120 requests a minute, and bcrypt silently
 * truncates its input at 72 bytes.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Constant-time comparison of two SHA-256 hex digests.
 *
 * `===` on a secret-derived value leaks information through how long the
 * comparison takes: it returns on the first differing character, so an
 * attacker can in principle recover a value one character at a time. This
 * compares every byte regardless.
 *
 * `timingSafeEqual` throws when the two buffers differ in length, and a length
 * check written the obvious way would reintroduce the early return. So the
 * length mismatch case does a real comparison against a value of the right
 * length and then returns false, keeping the work constant.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) {
    // Burn an equivalent comparison so the mismatch is not measurably faster,
    // then fail. Comparing bufA to itself is guaranteed length-safe.
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
