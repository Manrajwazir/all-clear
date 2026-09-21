import type { NextConfig } from "next";

// S3_BUCKET_NAME is read at BUILD time, not request time — Next.js inlines both
// uses below into the compiled config. Changing the variable in Vercel without
// redeploying leaves the old bucket baked into the CSP, and images 404 behind a
// Content-Security-Policy error rather than an S3 error. Redeploy after changing it.
//
// The fallback is the dev bucket on purpose: if the variable is missing, images
// fail closed against a bucket that holds no production data, rather than
// against a plausible-looking name that does not exist at all.

const nextConfig: NextConfig = {
  images: {
    // DISABLED ON PURPOSE. Nothing in this app imports `next/image`, so the
    // optimizer is pure attack surface with no benefit.
    //
    // /_next/image exists in EVERY Next deployment whether or not the app uses
    // the component, and it is an endpoint that fetches and decodes
    // attacker-supplied image bytes on the server. In September 2026 it carried
    // an unauthenticated RCE with no platform qualifier, and we were inside the
    // vulnerable range for three days believing we were not.
    //
    // Patching fixed that bug. This removes the category: the next optimizer
    // advisory is not our problem, because the endpoint does nothing.
    //
    // If anyone later adds `next/image`, remove this line AND re-read the
    // remotePatterns below -- `owasp-verify.py` A05 will switch from asserting
    // this to warning that the assumption changed.
    unoptimized: true,

    // Retained, though inert while `unoptimized` is true, because it is the
    // record of which host imagery may come from and is the correct setting the
    // moment the optimizer is ever turned back on. Pinned to one bucket, never
    // a wildcard.
    remotePatterns: [
      {
        protocol: "https",
        hostname: `${process.env.S3_BUCKET_NAME || "allclear-violations-dev"}.s3.ca-central-1.amazonaws.com`,
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — dashboard cannot be embedded in iframes
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing — browsers must respect Content-Type
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Disable legacy XSS filter — CSP is the modern replacement
          { key: "X-XSS-Protection", value: "0" },
          // Control what info is sent in the Referer header
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Force HTTPS for 1 year (including subdomains)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Explicitly disable camera/microphone/geolocation in the browser.
          // All capture happens on the Jetson edge device, not in the browser.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content Security Policy — restrict what can load in the browser
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: https://${process.env.S3_BUCKET_NAME || "allclear-violations-dev"}.s3.ca-central-1.amazonaws.com`,
              `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
              "font-src 'self' https://fonts.gstatic.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
