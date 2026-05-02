import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * GET /api/signed-url?key=violations/00000000.../2026-05-01T...jpg
 *
 * Generates a pre-signed S3 URL that expires in 1 hour.
 * The browser can load this URL directly in an <img> tag.
 *
 * Why this exists:
 *   S3 bucket is private (good for PIPA compliance).
 *   The Python backend saves images there. The dashboard needs to display them.
 *   Pre-signed URLs let the browser fetch private objects temporarily without
 *   making the bucket public.
 */

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ca-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME || "cordon-safety-violations-dev";
const EXPIRY = 3600; // 1 hour

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
  }

  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: EXPIRY });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Failed to generate signed URL:", error);
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
