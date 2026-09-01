import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { authenticateDevice, deviceAuthErrorBody } from "@/lib/device-auth";
import { getBucketName, getS3Client } from "@/lib/s3";
import {
  SNAPSHOT_CONTENT_TYPE,
  SNAPSHOT_UPLOAD_TTL_SECONDS,
  snapshotKey,
} from "@/lib/snapshot-key";
import {
  VIOLATION_IP_LIMIT,
  VIOLATION_LIMIT,
  enforceRateLimit,
  getClientIp,
  ipBucket,
  keyBucket,
} from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { violationSubmitSchema } from "@/lib/validations";

/**
 * POST /api/v1/violations
 * Phase 3, Step 3.3. ADR 0003 (hash chain), ADR 0005 (DB-first), ADR 0006 (org stamping).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS IS THE ENDPOINT THE PRODUCT EXISTS TO SERVE.
 *
 * Everything else in Phase 3 is scaffolding around this one call: provisioning
 * gives a device the key it authenticates with, the heartbeat proves the key
 * still works, the outage queue makes sure this call eventually happens. This
 * is where a safety incident becomes a record someone can be held to.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * HOW LITTLE THIS FILE DECIDES, AND WHY
 *
 * Read the body of this handler and notice what is missing. It does not build
 * the hash. It does not read the chain tip. It does not check the camera. It
 * does not set received_at. It does not decide the organisation.
 *
 * All of that happens inside `ingest_violation()` (migration 006 §6), in one
 * database round trip, under a lock on the device row. That is not a style
 * preference — it is the only arrangement that makes the hash chain safe.
 *
 * If this file read the chain tip and then inserted, two violations arriving
 * from the same device at the same instant would both read the same tip, both
 * claim to follow it, and the chain would fork into two branches. Serverless
 * functions cannot hold a lock across two statements; Postgres can. So the
 * decisions live where the lock lives.
 *
 * What this file DOES own: rate limiting, authentication, shape validation, and
 * translating database error codes into HTTP status codes.
 *
 * ORDER OF OPERATIONS, AND WHY IT IS THIS ORDER
 *
 *   1. Per-IP rate limit    — before auth. Caps how much work an anonymous
 *                             caller can make us do at all.
 *   2. Authenticate         — yields the ONLY trusted organisation and site.
 *   3. Per-key rate limit    — after auth. Keyed on the public key_id half, so
 *                             applying it earlier would let anyone burn a real
 *                             device's budget using a key_id and a wrong
 *                             secret. See the note in the heartbeat route.
 *   4. Validate the body    — shape only.
 *   5. Ingest               — everything that matters, atomically.
 */

/** Node runtime: device-auth reaches node:crypto. */
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * The database's custom error codes, mapped to HTTP.
 *
 * `ingest_violation()` raises these as PostgreSQL SQLSTATEs — the same
 * mechanism as a built-in error like "unique violation", but with codes we
 * chose. PostgREST passes them through verbatim, so they arrive as
 * `error.code`. Switching on a code rather than matching an error MESSAGE
 * means rewording a message later cannot silently turn a 403 into a 500.
 *
 * The messages here are written for the person reading a device's logs at
 * 6am on a job site, not for a stack trace.
 */
const INGEST_ERRORS: Record<
  string,
  { status: number; code: string; error: string }
> = {
  AC001: {
    status: 403,
    code: "camera_not_at_site",
    error:
      "That camera does not belong to this device's site. A device may only report violations for cameras at its own site.",
  },
  AC002: {
    status: 400,
    code: "snapshot_mode_disabled",
    error:
      "This site has not opted in to image capture, so the snapshot was refused and NO violation was recorded. Resend without snapshot_requested, or have an administrator enable snapshot mode for this site.",
  },
  AC003: {
    status: 403,
    code: "device_not_active",
    error: "This device is not active. Contact your administrator.",
  },
  AC004: {
    status: 400,
    code: "invalid_payload",
    error: "The violation payload was rejected by the database.",
  },
  AC005: {
    status: 400,
    code: "invalid_confidence",
    error: "Confidence must be between 0 and 1.",
  },
  AC006: {
    status: 400,
    code: "detected_at_in_future",
    error: "detected_at cannot be in the future.",
  },
};

export async function POST(request: NextRequest) {
  try {
    // ── 1. Per-IP rate limit ──────────────────────────────────────────────
    // 300/min. Sized for a site NATting several devices behind one address,
    // plus a queue draining after an outage. An abuse ceiling, not expected load.
    const ip = getClientIp(request);
    const ipLimit = await enforceRateLimit(
      ipBucket("violations", ip),
      VIOLATION_IP_LIMIT,
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
    // THE ONLY SOURCE OF ORGANISATION AND SITE. Nothing below reads either
    // from the request body, and the Zod schema does not even have fields for
    // them — a body carrying organization_id has it silently stripped before
    // this handler ever sees it (ADR 0006).
    //
    // A device that could name its own organisation could file fabricated
    // violations against a competitor's site.
    const auth = await authenticateDevice(request);
    if (!auth.ok) {
      return NextResponse.json(deviceAuthErrorBody(auth.reason), {
        status: auth.status,
        headers: NO_STORE,
      });
    }

    // ── 3. Per-key rate limit ─────────────────────────────────────────────
    // 60/min. A real site produces a handful an hour; this catches a device
    // stuck in a retry loop, which is the realistic failure.
    const keyLimit = await enforceRateLimit(
      keyBucket("violations", auth.device.key_id),
      VIOLATION_LIMIT,
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

    // ── 4. Validate the body ──────────────────────────────────────────────
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400, headers: NO_STORE },
      );
    }

    const parsed = violationSubmitSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid violation payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers: NO_STORE },
      );
    }

    const body = parsed.data;

    // ── 5. Ingest ─────────────────────────────────────────────────────────
    //
    // p_device_id comes from the authenticated record. Every other identity
    // field — organisation, site — is derived inside the function from that
    // device_id, so there is no path by which a caller influences them.
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("ingest_violation", {
      p_device_id: auth.device.device_id,
      p_camera_id: body.camera_id,
      p_violation_type: body.violation_type,
      p_confidence: body.confidence,
      p_detected_at: body.detected_at,
      p_idempotency_key: body.idempotency_key,
      p_snapshot_requested: body.snapshot_requested,
    });

    if (error) {
      const mapped = INGEST_ERRORS[error.code ?? ""];
      if (mapped) {
        return NextResponse.json(
          { error: mapped.error, code: mapped.code },
          { status: mapped.status, headers: NO_STORE },
        );
      }

      // 23505 is a unique violation that ingest_violation did NOT recognise as
      // an idempotency retry — which leaves the chain-fork index
      // (violations_device_prev_hash) as the realistic cause. That means two
      // rows tried to claim the same parent, i.e. the lock did not do its job.
      // It is a 500 because it is our fault, and it is logged at this volume
      // because it should never happen and must not pass unnoticed.
      if (error.code === "23505") {
        console.error(
          "CHAIN FORK REJECTED BY INDEX — device %s. Two rows claimed the same parent. Investigate before trusting the chain. %s",
          auth.device.device_id,
          error.message,
        );
      } else {
        console.error("ingest_violation failed:", error.code, error.message);
      }

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: NO_STORE },
      );
    }

    const row = data?.[0];
    if (!row) {
      console.error("ingest_violation returned no row");
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: NO_STORE },
      );
    }

    // ── 6. Presigned upload URL, only when the site opted in ──────────────
    //
    // The API never touches image bytes (ADR 0004). It hands back a URL that
    // authorises exactly one PUT, to exactly one key, for five minutes, and the
    // device uploads straight to S3.
    //
    // Issued on a DUPLICATE too, deliberately. A retry usually means the first
    // attempt failed somewhere, and the upload is the part most likely to have
    // been what failed. The key is deterministic, so re-uploading overwrites
    // the same object rather than creating a second one.
    //
    // A FAILURE HERE MUST NOT FAIL THE REQUEST. The violation is already
    // committed and sealed into the chain; ADR 0005 is database-first for
    // exactly this reason. Losing an image is a degraded record. Turning a
    // recorded violation into a 500 would make the device retry an event that
    // already exists, and would lose the incident if the retry never lands.
    let snapshotUpload: {
      url: string;
      expires_in: number;
      content_type: string;
    } | null = null;

    if (body.snapshot_requested && row.snapshot_enabled) {
      try {
        const key = snapshotKey(row.org_id, row.site, row.violation_id);
        snapshotUpload = {
          url: await getSignedUrl(
            getS3Client(),
            new PutObjectCommand({
              Bucket: getBucketName(),
              Key: key,
              ContentType: SNAPSHOT_CONTENT_TYPE,
            }),
            {
              expiresIn: SNAPSHOT_UPLOAD_TTL_SECONDS,
              // ⚠ WITHOUT THIS LINE, ContentType ABOVE IS DECORATIVE.
              //
              // A SigV4 presigned URL only commits the caller to headers named
              // in SignedHeaders, and that defaults to `host` alone. Setting
              // ContentType on the command without listing it here produces a
              // URL that happily accepts text/html, or anything else, at a path
              // the dashboard will later render as an image. Naming it here is
              // what actually binds the signature to a JPEG upload.
              //
              // Caught by test-snapshot §2, which PUTs the same bytes with the
              // wrong Content-Type and requires S3 to refuse.
              signableHeaders: new Set(["content-type"]),
            },
          ),
          expires_in: SNAPSHOT_UPLOAD_TTL_SECONDS,
          content_type: SNAPSHOT_CONTENT_TYPE,
        };
      } catch (err) {
        console.error(
          "Presign failed for violation %s; the violation stands, the image does not:",
          row.violation_id,
          err,
        );
      }
    }

    // ── 7. Answer ─────────────────────────────────────────────────────────
    //
    // 201 for a row that was created, 200 for one that already existed.
    //
    // The distinction is what makes a retry safe to send and safe to stop
    // retrying. A device whose network dropped mid-request does not know
    // whether we got it; it resends with the same idempotency_key and gets a
    // 200 pointing at the row that already exists. No duplicate incident, and
    // no reason to keep trying.
    //
    // event_hash is returned so a device can log what it filed and an auditor
    // can cross-check a device's own log against the database. It is a
    // fingerprint, not a secret.
    return NextResponse.json(
      {
        violation_id: row.violation_id,
        event_hash: row.hash,
        received_at: row.received,
        duplicate: row.is_duplicate,
        // Whether this site captures imagery at all.
        snapshot_enabled: row.snapshot_enabled,
        // Null unless the device asked for it AND the site opted in. When
        // present: PUT the JPEG to `url` with Content-Type `content_type`,
        // then POST /api/v1/violations/<id>/snapshot to confirm. The row's
        // snapshot_s3_key stays null until that confirm succeeds.
        snapshot_upload: snapshotUpload,
      },
      { status: row.is_duplicate ? 200 : 201, headers: NO_STORE },
    );
  } catch (err) {
    console.error("Violations route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
