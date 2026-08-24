"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_API_KEY!, {
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
    });
  }, []);

  return children;
}
