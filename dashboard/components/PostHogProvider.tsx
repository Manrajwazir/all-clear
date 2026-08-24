"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;

    if (!key) {
      console.error("PostHog API key is missing");
      return;
    }

    posthog.init(key, {
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
    });
  }, []);

  return children;
}
