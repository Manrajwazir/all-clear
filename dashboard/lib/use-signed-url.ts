"use client";

import { useEffect, useState } from "react";

/**
 * Hook that takes an S3 URL like:
 *   https://allclear-violations-dev.s3.amazonaws.com/violations/00000.../2026-05-01T....jpg
 *
 * and returns a pre-signed URL via /api/signed-url that the browser can actually load.
 *
 * Returns null while loading, or the original URL if it's not an S3 URL.
 */
export function useSignedUrl(imageUrl: string | null): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setSignedUrl(null);
      return;
    }

    // Extract the S3 key from the full URL
    // URL format: https://{bucket}.s3.amazonaws.com/{key}
    const match = imageUrl.match(/\.s3\.amazonaws\.com\/(.+)$/);
    if (!match) {
      // Not an S3 URL — use as-is (e.g., demo data placeholder)
      setSignedUrl(imageUrl);
      return;
    }

    const key = decodeURIComponent(match[1]);

    fetch(`/api/signed-url?key=${encodeURIComponent(key)}`)
      .then((res) => res.json())
      .then((data) => setSignedUrl(data.url ?? null))
      .catch(() => setSignedUrl(null));
  }, [imageUrl]);

  return signedUrl;
}
