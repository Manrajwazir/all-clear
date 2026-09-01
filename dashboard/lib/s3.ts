import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

/**
 * The shared S3 client for device-facing routes.
 * Phase 3, Step 3.3b.
 *
 * `server-only` because these are durable AWS credentials. If this module were
 * ever imported into a Client Component the build fails, which is the point —
 * the failure happens at build time rather than by shipping keys in a bundle.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ S3_*, NEVER AWS_*. This is load-bearing, not a style preference.
 *
 * Vercel functions run on AWS Lambda, and the Lambda runtime PRESETS
 * AWS_REGION to the function's own region and AWS_ACCESS_KEY_ID /
 * AWS_SECRET_ACCESS_KEY to the execution role's placeholders. Those grant no
 * access to our bucket, and because they are always present they beat any
 * `||` fallback written here. A client built from AWS_* on Vercel points at
 * the wrong region with credentials that cannot read anything — and fails at
 * request time, not deploy time.
 *
 * Several AWS_* names are also outright reserved and cannot be set in the
 * Vercel dashboard at all. Giving S3 its own namespace sidesteps the category.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `app/api/signed-url/route.ts` still constructs its own client. It predates
 * this module and works; it is left alone rather than refactored inside a
 * feature commit. New code should import from here.
 */

let cached: S3Client | null = null;

export function getS3Client(): S3Client {
  if (cached) return cached;

  const missing: string[] = [];
  if (!process.env.S3_REGION) missing.push("S3_REGION");
  if (!process.env.S3_ACCESS_KEY_ID) missing.push("S3_ACCESS_KEY_ID");
  if (!process.env.S3_SECRET_ACCESS_KEY) missing.push("S3_SECRET_ACCESS_KEY");
  if (!process.env.S3_BUCKET_NAME) missing.push("S3_BUCKET_NAME");

  if (missing.length > 0) {
    // Fail loudly and by name. The alternative — a client built from undefined
    // credentials — fails deep inside the SDK with an error that reads like a
    // network problem.
    throw new Error(
      `S3 client cannot be created: missing ${missing.join(", ")}. ` +
        `Set them in dashboard/.env.local and in Vercel. Never name them AWS_*.`,
    );
  }

  cached = new S3Client({
    region: process.env.S3_REGION!,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return cached;
}

export function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error("S3_BUCKET_NAME is not set");
  return bucket;
}
