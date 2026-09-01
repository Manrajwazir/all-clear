import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

import { authenticateDevice, deviceAuthErrorBody } from "@/lib/device-auth";
import {
  VIOLATION_IP_LIMIT,
  VIOLATION_LIMIT,
  enforceRateLimit,
  getClientIp,
  ipBucket,
  keyBucket,
} from "@/lib/rate-limit";
import { getBucketName, getS3Client } from "@/lib/s3";
import { snapshotKey } from "@/lib/snapshot-key";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { uuidParam } from "@/lib/validations";

/**
 * POST /api/v1/violations/<id>/snapshot
 * Phase 3, Step 3.3b. Design: ADR 0004.
 *
 * The missing half of the presigned-PUT design. Ingestion hands a device a URL
 * to upload to; this is how the row learns the upload actually happened.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE KEY IS NOT WRITTEN AT INSERT TIME
 *
 * The obvious shortcut is to store snapshot_s3_key when the violation row is
 * created, since the key is deterministic and we already know it. That would be
 * wrong in a specific, user-visible way.
 *
 * The upload happens AFTER the row exists, on a job-site link that drops. If
 * the key were written up front, every failed upload would leave a row
 * pointing at an object that does not exist — and the dashboard would render a
 * broken image where a safety incident should be. Worse, nobody could tell the
 * difference between "the image is missing" and "there was never an image",
 * which matters when the record is evidence.
 *
 * So the server records a key only after it has independently confirmed the
 * object is really in the bucket. ADR 0004 puts it as: a failed upload leaves
 * a valid record with a null snapshot key, rather than a lost violation.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * SAFE TO CALL TWICE. A device that uploads, confirms, and loses the response
 * can confirm again and get the same 200. The key is deterministic and the
 * column is not part of the hash, so there is nothing to corrupt.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * ONE answer for "no such violation", "not yours", "tombstoned" and "that is
 * not even a UUID".
 *
 * A device may only ever confirm its own violations, so any distinction here
 * would let one device probe for the existence of another device's records by
 * watching which error came back.
 */
const NOT_FOUND = {
  error: "No such violation for this device.",
  code: "violation_not_found",
} as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // ── 1. Per-IP limit, before authentication ────────────────────────────
    const ip = getClientIp(request);
    const ipLimit = await enforceRateLimit(
      ipBucket("snapshot", ip),
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
    const auth = await authenticateDevice(request);
    if (!auth.ok) {
      return NextResponse.json(deviceAuthErrorBody(auth.reason), {
        status: auth.status,
        headers: NO_STORE,
      });
    }

    // ── 3. Per-key limit, after authentication ────────────────────────────
    const keyLimit = await enforceRateLimit(
      keyBucket("snapshot", auth.device.key_id),
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

    const { id } = await context.params;
    if (!uuidParam.safeParse(id).success) {
      return NextResponse.json(NOT_FOUND, { status: 404, headers: NO_STORE });
    }

    // ── 4. The violation must belong to THIS device ───────────────────────
    //
    // device_id is in the WHERE clause, not compared afterwards. A filter
    // cannot be forgotten the way a follow-up `if` can, and the query simply
    // returns nothing for someone else's row.
    //
    // deleted_at IS NULL because a tombstoned violation must never gain an
    // image reference — tombstoning exists to remove content, and this would
    // put content back (ADR 0003 Amendment 1).
    const supabase = createServiceRoleClient();
    const { data: violation, error: lookupError } = await supabase
      .from("violations")
      .select("id, organization_id, site_id, snapshot_s3_key")
      .eq("id", id)
      .eq("device_id", auth.device.device_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (lookupError) {
      console.error("Snapshot confirm lookup failed:", lookupError.message);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: NO_STORE },
      );
    }
    if (!violation) {
      return NextResponse.json(NOT_FOUND, { status: 404, headers: NO_STORE });
    }

    // ── 5. The site must still accept imagery ─────────────────────────────
    //
    // Checked again here, not just at ingestion. A site can be switched off
    // between the upload and the confirm, and recording an image reference for
    // a site that has since opted out would be exactly the outcome the opt-in
    // exists to prevent. The uploaded object becomes an orphan, which the
    // weekly cleanup collects.
    const { data: site } = await supabase
      .from("sites")
      .select("snapshot_mode")
      .eq("id", violation.site_id)
      .maybeSingle();

    if (!site?.snapshot_mode) {
      return NextResponse.json(
        {
          error:
            "This site does not accept image capture. No image reference was recorded.",
          code: "snapshot_mode_disabled",
        },
        { status: 400, headers: NO_STORE },
      );
    }

    // ── 6. Recompute the key. Never accept one. ───────────────────────────
    //
    // Derived from the STORED row, so it is the same string the presign step
    // produced, arrived at independently. Nothing was passed between the two
    // requests and nothing was held in the meantime.
    const key = snapshotKey(
      violation.organization_id,
      violation.site_id,
      violation.id,
    );

    // Already confirmed. Answer the same way rather than re-checking S3 — a
    // retry after a lost response must be cheap and must not fail.
    if (violation.snapshot_s3_key === key) {
      return NextResponse.json(
        { snapshot_s3_key: key, already_confirmed: true },
        { status: 200, headers: NO_STORE },
      );
    }

    // ── 7. Prove the object exists before recording it ────────────────────
    //
    // The whole point of this endpoint. The server does not take a device's
    // word that an upload happened; it asks S3.
    try {
      const head = await getS3Client().send(
        new HeadObjectCommand({ Bucket: getBucketName(), Key: key }),
      );

      // A zero-byte object is a failed upload that happened to create a key.
      // Treat it as absent rather than recording a reference to nothing.
      if (!head.ContentLength || head.ContentLength === 0) {
        return NextResponse.json(
          {
            error:
              "The uploaded object is empty. Re-upload the image, then confirm again.",
            code: "snapshot_not_uploaded",
          },
          { status: 409, headers: NO_STORE },
        );
      }
    } catch (err: unknown) {
      const name =
        typeof err === "object" && err !== null && "name" in err
          ? String((err as { name: unknown }).name)
          : "";
      const status =
        typeof err === "object" && err !== null && "$metadata" in err
          ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata
              ?.httpStatusCode
          : undefined;

      // Genuinely absent → 409, and snapshot_s3_key stays NULL. The device can
      // upload and confirm again.
      if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
        return NextResponse.json(
          {
            error:
              "No uploaded image found for this violation. Upload to the presigned URL first, then confirm.",
            code: "snapshot_not_uploaded",
          },
          { status: 409, headers: NO_STORE },
        );
      }

      // Anything else — credentials, permissions, a network fault — is OUR
      // problem, and must not be reported as "you did not upload". A device
      // told 409 would retry an upload that already succeeded.
      console.error("Snapshot HEAD failed for %s:", key, err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: NO_STORE },
      );
    }

    // ── 8. Record it ──────────────────────────────────────────────────────
    //
    // snapshot_s3_key is NOT one of the hashed columns, so the migration 005
    // immutability trigger permits this UPDATE and the hash chain is untouched.
    // That separation is deliberate: where an image lives is metadata about the
    // record, not part of the sealed event.
    const { error: updateError } = await supabase
      .from("violations")
      .update({ snapshot_s3_key: key })
      .eq("id", violation.id)
      .eq("device_id", auth.device.device_id);

    if (updateError) {
      console.error("Snapshot key update failed:", updateError.message);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      { snapshot_s3_key: key, already_confirmed: false },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    console.error("Snapshot confirm route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
