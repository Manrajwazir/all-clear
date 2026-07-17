"use client";

import { useState } from "react";

type FormState = "idle" | "loading" | "success" | "error";

export default function PilotForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value.trim(),
      email: (form.elements.namedItem("email") as HTMLInputElement).value.trim(),
      company: (form.elements.namedItem("company") as HTMLInputElement).value.trim(),
      num_sites: (form.elements.namedItem("num_sites") as HTMLInputElement).value.trim(),
    };

    try {
      const res = await fetch("/api/pilot-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "Something went wrong");
      }

      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (state === "success") {
    return (
      <div className="mt-12 max-w-lg mx-auto text-center">
        <div
          className="rounded-2xl py-12 px-8"
          style={{
            border: "1px solid rgba(0,217,163,0.2)",
            background: "linear-gradient(160deg, rgba(0,217,163,0.05) 0%, rgba(19,21,27,0.95) 40%)",
          }}
        >
          {/* Animated checkmark */}
          <div className="flex items-center justify-center mb-5">
            <span className="relative flex h-10 w-10">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-safe opacity-30" />
              <span className="relative inline-flex items-center justify-center rounded-full h-10 w-10 bg-status-safe/10 border border-status-safe/30">
                <svg className="w-5 h-5 text-status-safe" viewBox="0 0 16 16" fill="none">
                  <path d="M13.25 4.75L6 12 2.75 8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
          </div>
          <h3 className="text-[20px] font-light italic mb-2">Request received</h3>
          <p className="text-[14px] text-text-secondary leading-relaxed">
            We&apos;ll reach out within 24 hours to schedule your 30-minute live demo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto"
    >
      <input
        name="name"
        required
        placeholder="Your name"
        disabled={state === "loading"}
        className="w-full px-4 py-3 bg-surface-card/80 text-[13px] text-text-primary placeholder:text-text-tertiary rounded-xl border border-white/[0.06] focus:border-white/[0.15] focus:outline-none transition-colors disabled:opacity-50"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="you@company.com"
        disabled={state === "loading"}
        className="w-full px-4 py-3 bg-surface-card/80 text-[13px] text-text-primary placeholder:text-text-tertiary rounded-xl border border-white/[0.06] focus:border-white/[0.15] focus:outline-none transition-colors disabled:opacity-50"
      />
      <input
        name="company"
        required
        placeholder="Company name"
        disabled={state === "loading"}
        className="w-full px-4 py-3 bg-surface-card/80 text-[13px] text-text-primary placeholder:text-text-tertiary rounded-xl border border-white/[0.06] focus:border-white/[0.15] focus:outline-none transition-colors disabled:opacity-50"
      />
      <input
        name="num_sites"
        placeholder="Number of sites"
        disabled={state === "loading"}
        className="w-full px-4 py-3 bg-surface-card/80 text-[13px] text-text-primary placeholder:text-text-tertiary rounded-xl border border-white/[0.06] focus:border-white/[0.15] focus:outline-none transition-colors disabled:opacity-50"
      />
      <div className="sm:col-span-2 space-y-3">
        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full py-3 text-[14px] font-medium rounded-full border border-white/20 hover:bg-white/[0.06] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state === "loading" ? (
            <>
              <svg className="animate-spin h-4 w-4 text-text-tertiary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Sending…
            </>
          ) : "Request a pilot"}
        </button>
        {state === "error" && (
          <p className="text-center text-[12px] text-status-critical">{errorMsg}</p>
        )}
      </div>
    </form>
  );
}
