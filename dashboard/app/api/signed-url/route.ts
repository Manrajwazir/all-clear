import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { signedUrlSchema } from "@/lib/validations";

/**
 * GET /api/signed-url?key=violations/cam-id/timestamp.jpg
 *
 * Generates a pre-signed S3 URL that expires in 1 hour.
 * The browser can load this URL directly in an <img> tag.
 *
 * Security (Phase 2, Step 2.3):
 *   1. Auth check — must be logged in (401)
 *   2. Input validation — key must start with "violations/" and not contain ".." (400)
 *   3. Tenant isolation — key must belong to a violation in the user's org via RLS (403)
 *   4. Audit logging — every image view is logged to audit_log (Step 0.7)
 *
 * The key insight: we use the Supabase anon client (which respects RLS) to
 * look up the violation. If the violation belongs to another org, RLS hides
 * it → 0 rows → 403. No manual org_id comparison needed — the database
 * enforces isolation for us.
 */

const s3 = new S3Client({
  region: process.env.S3_REGION || "ca-central-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const EXPIRY = 3600; // 1 hour

export async function GET(request: NextRequest) {
  // ── 1. Auth check ─────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ── 2. Input validation (Zod — Step 2.7) ───────────────────────────
  const rawKey = request.nextUrl.searchParams.get("key");

  const parsed = signedUrlSchema.safeParse({ key: rawKey });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid key", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const key = parsed.data.key;

  // ── 3. Tenant isolation via RLS ───────────────────────────────────
  // Look up the violation that owns this S3 key.
  // The Supabase client uses the anon key → RLS is enforced → if the
  // violation belongs to another org, this query returns 0 rows.
  // This also handles both legacy full-URL keys and new bare-key format.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: violation } = await (supabase.from("violations") as any)
    .select("id")
    .or(`snapshot_s3_key.eq.${key},snapshot_s3_key.ilike.%${key}`)
    .limit(1)
    .maybeSingle() as { data: { id: string } | null };

  if (!violation) {
    return NextResponse.json(
      { error: "Forbidden — image not found or access denied" },
      { status: 403 }
    );
  }

  // ── 4. Generate signed URL ────────────────────────────────────────
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: EXPIRY });

    // ── 5. Audit log (Step 0.7 — PIPA compliance) ─────────────────
    // Log the image view before returning the URL.
    // Fire-and-forget so the user isn't delayed by the audit write.
    // If the audit insert fails, the image still loads but a warning is logged.
    //
    // NOTE: The type assertion on .insert() works around a mismatch between
    // our hand-rolled Database type and the Supabase client's internal
    // InsertBuilder expectations. This will be resolved when we auto-generate
    // types via `supabase gen types typescript` in Phase 5.
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: userData } = await (supabase.from("users") as any)
          .select("organization_id")
          .eq("id", user.id)
          .single() as { data: { organization_id: string } | null };

        if (!userData) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: auditError } = await (supabase.from("audit_log") as any)
          .insert({
            organization_id: userData.organization_id,
            user_id: user.id,
            action: "viewed_violation_image",
            target_type: "violation_snapshot",
            target_id: violation.id,
            metadata: { s3_key: key },
          });

        if (auditError) {
          console.warn("Audit log insert failed:", auditError.message);
        }
      } catch (err) {
        console.warn("Audit log error:", err);
      }
    })();

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to generate signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate URL" },
      { status: 500 }
    );
  }
}

