import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: `${process.env.S3_BUCKET_NAME || "all-clear-bucket"}.s3.ca-central-1.amazonaws.com`,
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
              `img-src 'self' data: https://${process.env.S3_BUCKET_NAME || "all-clear-bucket"}.s3.ca-central-1.amazonaws.com`,
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
