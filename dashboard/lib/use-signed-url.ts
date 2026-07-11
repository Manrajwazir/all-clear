"use client";

import { useEffect, useState } from "react";

/**
 * Hook that takes a snapshot_s3_key value, which can be either:
 *   - A legacy full S3 URL: https://bucket.s3.amazonaws.com/violations/...jpg
 *     (violations captured before the schema v2 rename)
 *   - A bare S3 key: violations/cam-id/timestamp.jpg
 *     (violations captured after storage.py was updated in Phase 0)
 *
 * In both cases, the hook calls /api/signed-url?key=<key> to get a
 * temporary pre-signed URL the browser can load.
 * Returns null if no snapshot exists (events-only mode).
 */
export function useSignedUrl(snapshotKey: string | null): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshotKey) {
      setSignedUrl(null);
      return;
    }

    // Determine if this is a legacy full URL or a bare key.
    // Legacy format: https://{bucket}.s3.{region}.amazonaws.com/{key}
    //           or:  https://{bucket}.s3.amazonaws.com/{key}
    // New format:    violations/{camera_id}/{timestamp}.jpg
    let key: string;
    const urlMatch = snapshotKey.match(/\.s3(?:\.[^/]+)?\.amazonaws\.com\/(.+)$/);
    if (urlMatch) {
      // Legacy full URL — extract the key portion
      key = decodeURIComponent(urlMatch[1]);
    } else {
      // Already a bare key
      key = snapshotKey;
    }

    fetch(`/api/signed-url?key=${encodeURIComponent(key)}`)
      .then((res) => res.json())
      .then((data) => setSignedUrl(data.url ?? null))
      .catch(() => setSignedUrl(null));
  }, [snapshotKey]);

  return signedUrl;
}
