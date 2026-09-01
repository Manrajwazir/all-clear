/**
 * Where a violation's snapshot lives in S3.
 * Phase 3, Step 3.3b. Design: ADR 0004.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEVICE NEVER CHOOSES THIS. THAT IS THE ENTIRE POINT.
 *
 * An earlier draft of the violation schema accepted `snapshot_s3_key` from the
 * request body. That let a device point its own violation row at ANOTHER
 * organisation's image — the row would then render someone else's snapshot
 * inside this org's dashboard. The field was removed from the schema
 * (see lib/validations.ts) and replaced by a boolean; this function is what
 * replaced it.
 *
 * Because the key is derived from the violation's own identifiers, it is:
 *
 *   deterministic  the presign step and the confirm step compute the same
 *                  string independently, with nothing passed between them and
 *                  nothing stored in the meantime
 *   unguessable-as-a-target  every segment is a server-assigned UUID, so a
 *                  device cannot construct a key belonging to another tenant
 *   self-describing  an object's path states which org and site own it, which
 *                  is what makes bulk retention and PIPA deletion by
 *                  organisation a prefix operation rather than a table scan
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * `violations/<organization_id>/<site_id>/<violation_id>.jpg`
 *
 * All three arguments must come from the stored violation row — never from a
 * request body, and never from anything a device supplied.
 */
export function snapshotKey(
  organizationId: string,
  siteId: string,
  violationId: string,
): string {
  return `violations/${organizationId}/${siteId}/${violationId}.jpg`;
}

/** How long a presigned upload URL is valid, in seconds. */
export const SNAPSHOT_UPLOAD_TTL_SECONDS = 300; // 5 minutes

/**
 * The Content-Type the presigned PUT is signed for.
 *
 * This only binds the upload if the presigner is ALSO told to sign the
 * content-type header — see the `signableHeaders` note where the URL is
 * generated. Setting this constant alone authorises nothing; a SigV4 presigned
 * URL commits the caller only to the headers named in SignedHeaders, which
 * defaults to `host`.
 *
 * With both in place, a device sending a different Content-Type gets a
 * signature mismatch from S3 instead of successfully storing arbitrary content
 * at a path the dashboard will later render as an image.
 */
export const SNAPSHOT_CONTENT_TYPE = "image/jpeg";
