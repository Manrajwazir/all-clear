/**
 * Input validation schemas using Zod.
 * Phase 2, Step 2.7
 *
 * Every API route validates its input at the boundary before any business
 * logic runs. This prevents:
 *   - Path traversal (../../../etc/passwd in S3 keys)
 *   - Type coercion bugs (string where number expected)
 *   - Oversized uploads that exhaust memory
 *   - Invalid enum values that bypass business logic
 *
 * On validation failure, routes return 400 with the Zod error messages.
 * These are safe to return — they describe the schema, not your internals.
 */

import { z } from "zod";

/**
 * An identifier Postgres will store in a `uuid` column.
 *
 * ⚠ USE THIS, NOT `z.string().uuid()`. The difference is not cosmetic.
 *
 * Zod 4's `.uuid()` validates the RFC 9562 VERSION AND VARIANT BITS — the
 * nibble that says "this is a v4 random UUID" must be 1-8. Postgres's `uuid`
 * type checks no such thing: it accepts any 8-4-4-4-12 hex string, stores it,
 * and indexes it.
 *
 * So `.uuid()` made this API stricter than its own database. Seeded rows like
 * `00000000-0000-0000-0000-000000000001` and
 * `aaaaaaaa-0000-0000-0000-000000000001` live happily in Postgres and were
 * rejected at the boundary with "Invalid input" — a real camera, present in the
 * table, that no device could file a violation against.
 *
 * Found 2026-08-31 by the first live camera run, not by any test suite: every
 * fixture used `randomUUID()`, which always produces a well-formed v4. The bug
 * could only appear against hand-written placeholder IDs, which is exactly what
 * production seed data is made of.
 *
 * `z.guid()` is Zod 4's RFC-agnostic form and matches what Postgres accepts.
 * The validation boundary should never be narrower than the storage layer:
 * anything the database can hold must be referenceable.
 */
export const dbUuid = (message = "Invalid ID format") => z.guid(message);

// ─── Signed URL Route ───────────────────────────────────────────────

export const signedUrlSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .max(500, "Key too long")
    .startsWith("violations/", "Key must start with violations/")
    .regex(/^[a-zA-Z0-9\-_/.:]+$/, "Invalid characters in key")
    .refine((key) => !key.includes(".."), "Path traversal not allowed"),
});

// ─── Violation Ingestion (Phase 3) ──────────────────────────────────

/** How far ahead of the server clock a device's detected_at may be. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Tightened by the 2026-08-28 Phase 3 audit. Three changes, each closing
 * something that was open:
 *
 *   1. `snapshot_s3_key` is GONE, replaced by `snapshot_requested: boolean`.
 *      Accepting a client-supplied S3 key let a device point its violation row
 *      at ANOTHER ORGANISATION'S image — the row would then render someone
 *      else's snapshot in this org's dashboard. The server derives the key
 *      itself, deterministically, and only after the object is confirmed to
 *      exist (plan step 3.3b). A device says whether it HAS an image; it never
 *      says where the image lives.
 *
 *   2. `idempotency_key` is REQUIRED, not optional. Postgres treats NULLs as
 *      distinct, so a NULL key deduplicates nothing — an optional field here
 *      is an invitation to silently skip the entire retry-safety mechanism.
 *      The Python client mints one at enqueue time, which is what makes a
 *      replay safe.
 *
 *   3. `detected_at` is bounded in the future. A detection cannot have
 *      happened later than now; that claim is a broken clock or a forgery. A
 *      detection in the PAST stays allowed with no bound at all, because that
 *      is exactly what the offline queue replays after an outage.
 *
 * NOT strict on unknown keys, deliberately. Zod's default strips them, so a
 * body smuggling `organization_id` or `site_id` has those values silently
 * dropped rather than 400'd — which is ADR 0006's required behaviour
 * ("ignored", not "rejected"). Org and site are stamped from the authenticated
 * device record and from nowhere else.
 */
export const violationSubmitSchema = z.object({
  violation_type: z.enum([
    "no_hardhat",
    "no_safety_vest",
    "no_mask",
    // Open item 2.3: the model is only run for three classes today. These two
    // stay in the enum pending the class experiment (open item 2.2), and there
    // is no CHECK constraint on the column — this enum is the only gate on
    // what violation_type can ever contain.
    "no_gloves",
    "no_goggles",
  ]),
  confidence: z.number().min(0).max(1),
  detected_at: z
    // offset: true so both `...Z` and `...+00:00` parse. Python's
    // datetime.isoformat() produces the second form, and rejecting it would
    // break the detection client in a way that looks like a server bug.
    .string()
    .datetime({ offset: true })
    .refine(
      (value) => Date.parse(value) <= Date.now() + MAX_CLOCK_SKEW_MS,
      "detected_at cannot be more than 5 minutes in the future",
    ),
  camera_id: dbUuid("camera_id must be a UUID"),
  /**
   * Whether this device is holding an image for this event. NOT a key, NOT a
   * path — the server decides where an image lives. Defaults false, which is
   * the normal operating mode (ADR 0001: All Clear is a sensor, not a camera).
   */
  snapshot_requested: z.boolean().default(false),
  idempotency_key: dbUuid("Idempotency key must be a UUID"),
});

// ─── Device Provisioning (Phase 3) ──────────────────────────────────

export const provisionDeviceSchema = z.object({
  provisioning_token: z
    .string()
    .min(32, "Token too short")
    .max(128, "Token too long")
    // base64url alphabet — what generateProvisioningToken() produces. Anything
    // else was not issued by us, so there is nothing to look up.
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid token format"),
});

// ─── Device Heartbeat (Phase 3) ─────────────────────────────────────

/**
 * NOTE: everything except `status` is validated and then DISCARDED.
 *
 * There are no columns for cpu_temp, uptime_seconds or model_version, and
 * inventing a device_health table mid-phase is scope creep. The endpoint
 * updates `devices.last_seen_at` and nothing else. Validating fields we drop
 * is still worth doing — it keeps the client contract honest and means adding
 * the columns later is a migration, not a client change — but do not read this
 * schema as evidence that the data is stored anywhere.
 */
export const heartbeatSchema = z.object({
  status: z.enum(["online", "degraded", "error"]),
  cpu_temp: z.number().optional(),
  uptime_seconds: z.number().int().nonnegative().optional(),
  model_version: z.string().max(50).optional(),
});

// ─── Violation Resolution (Dashboard) ───────────────────────────────

export const resolveViolationSchema = z.object({
  resolution_status: z.enum(["resolved", "false_positive"]),
  notes: z.string().max(1000).optional(),
});

// ─── UUID parameter validation ──────────────────────────────────────

export const uuidParam = dbUuid("Invalid ID format");
