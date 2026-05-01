"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (err) {
      setStatus("error");
      setError(err.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-12">
          <div className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-2">
            SiteIQ
          </div>
          <h1 className="text-[32px] font-semibold tracking-tight leading-[1.2]">
            Operations console
          </h1>
          <p className="text-text-secondary mt-3 text-sm leading-relaxed">
            Sign in with a magic link. We&apos;ll email you a one-time link — no
            password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-[10px] tracking-[0.08em] uppercase text-text-secondary mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "sending" || status === "sent"}
              placeholder="you@company.com"
              className={cn(
                "w-full bg-surface-inset rounded-md px-4 py-3",
                "text-sm text-text-primary placeholder:text-text-tertiary",
                "focus:outline-none focus:ring-1 focus:ring-status-info",
                "disabled:opacity-50 transition-colors",
              )}
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending" || status === "sent"}
            className={cn(
              "w-full rounded-md py-3 text-sm font-medium",
              "bg-text-primary text-surface-base",
              "hover:opacity-90 transition-opacity",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {status === "sending"
              ? "Sending…"
              : status === "sent"
                ? "Check your inbox"
                : "Send magic link"}
          </button>

          {status === "sent" && (
            <p className="text-xs text-status-safe pt-2">
              Link sent to {email}. Open it on this device.
            </p>
          )}
          {status === "error" && error && (
            <p className="text-xs text-status-critical pt-2">{error}</p>
          )}
        </form>
      </div>
    </main>
  );
}
