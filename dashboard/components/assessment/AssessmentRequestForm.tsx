"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MailLink } from "@/components/site/Buttons";

const FIELD =
  "min-h-[52px] w-full rounded-soft border border-rule-strong bg-cream-50 px-4 py-3.5 " +
  // 16px keeps iOS Safari from zooming the viewport on focus.
  "text-[16px] text-ink placeholder:text-ink-faint " +
  "focus:border-accent focus:outline-none " +
  "disabled:opacity-60";

const SITE_TYPES = [
  "Heavy industrial",
  "Oil & gas services",
  "Construction site",
  "Industrial yard or laydown",
  "Warehouse or logistics",
  "Other",
];

const CAMERA_STATES = [
  "Yes, IP cameras already installed",
  "Some zones covered, not all",
  "No cameras on site yet",
  "Not sure",
];

type Status = "idle" | "sending" | "sent" | "error";

export default function AssessmentRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // When the form first rendered, so the server can see how long it took to
  // fill. A script that posts instantly is not someone typing.
  const startedAt = useRef(Date.now());

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {};
    form.forEach((value, key) => {
      if (typeof value === "string") payload[key] = value;
    });
    payload.elapsed_ms = String(Date.now() - startedAt.current);

    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError(
          data?.error ??
            "We couldn't send that just now. Please email us directly.",
        );
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      // Network failure. Never pretend this succeeded.
      setError(
        "That didn't send, which may be your connection. Please email us directly.",
      );
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" aria-live="polite">
        <h2 className="label mb-6 text-accent">Request received</h2>
        <p className="text-[19px] font-medium leading-[1.45] tracking-[-0.01em] sm:text-[22px]">
          Thanks. That reached us.
        </p>
        <p className="measure mt-5 text-[16px] leading-[1.7] text-ink-muted sm:text-[17px]">
          We read our own inbox, so this went to both founders rather than a
          queue. Expect a reply within a couple of working days, and it will
          come from a person asking about your cameras.
        </p>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form onSubmit={onSubmit}>
      <h2 id="assessment-form" className="label mb-8 text-accent">
        Assessment request
      </h2>

      <fieldset
        disabled={sending}
        aria-labelledby="assessment-form"
        className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field id="ac-name" label="Name" required>
            <input
              id="ac-name"
              type="text"
              name="name"
              required
              maxLength={120}
              autoComplete="name"
              placeholder="First and last"
              className={FIELD}
            />
          </Field>
          <Field id="ac-company" label="Company" required>
            <input
              id="ac-company"
              type="text"
              name="organization"
              required
              maxLength={160}
              autoComplete="organization"
              placeholder="Operator or contractor"
              className={FIELD}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field id="ac-role" label="Role">
            <input
              id="ac-role"
              type="text"
              name="role"
              maxLength={120}
              autoComplete="organization-title"
              placeholder="e.g. Safety manager"
              className={FIELD}
            />
          </Field>
          <Field id="ac-email" label="Work email" required>
            <input
              id="ac-email"
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.ca"
              className={FIELD}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field id="ac-sitetype" label="Site type">
            <Select id="ac-sitetype" name="site_type" options={SITE_TYPES} />
          </Field>
          <Field id="ac-location" label="Site location">
            <input
              id="ac-location"
              type="text"
              name="location"
              maxLength={160}
              placeholder="City or region"
              className={FIELD}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field id="ac-cameras" label="Existing cameras">
            <Select id="ac-cameras" name="cameras" options={CAMERA_STATES} />
          </Field>
          <Field id="ac-cor" label="COR certified">
            <Select
              id="ac-cor"
              name="cor_status"
              options={["Yes", "In progress", "No", "Not sure"]}
            />
          </Field>
        </div>

        <Field id="ac-message" label="Anything we should know">
          <textarea
            id="ac-message"
            name="message"
            rows={5}
            maxLength={4000}
            placeholder="How many cameras, which zones matter, what an audit asks you for."
            className={cn(FIELD, "resize-y leading-[1.6]")}
          />
        </Field>

        {/* Honeypot. Off-screen rather than display:none, since some bots skip
            hidden inputs. aria-hidden and tabIndex keep it away from people
            using a keyboard or a screen reader. Do not remove without also
            removing the server-side check. */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto">
          <label htmlFor="ac-company-website">
            Company website
            <input
              id="ac-company-website"
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>

        <div className="flex flex-col gap-5 pt-1.5 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center min-[420px]:gap-6">
          <button
            type="submit"
            className="label inline-flex min-h-[54px] w-full items-center justify-center rounded-soft bg-accent px-8 text-cream transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70 min-[420px]:w-auto"
          >
            {sending ? "Sending" : "Send request"}
          </button>
          <span className="inline-flex flex-wrap items-center gap-x-2 text-[14px] text-ink-muted">
            Or email
            <MailLink>hello@allclearsafety.ca</MailLink>
          </span>
        </div>
      </fieldset>

      {/* Announced as soon as it appears. */}
      <div aria-live="polite" className="empty:hidden">
        {status === "error" && error && (
          <p className="mt-6 rounded-soft border-l-2 border-accent bg-cream-50 px-5 py-4 text-[15px] leading-[1.7] text-ink">
            {error}{" "}
            <span className="text-ink-muted">
              Nothing was lost, your answers are still in the form.
            </span>
          </p>
        )}
      </div>
    </form>
  );
}

function Select({
  id,
  name,
  options,
}: {
  id: string;
  name: string;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        defaultValue=""
        className={cn(FIELD, "appearance-none pr-10")}
      >
        <option value="" disabled>
          Select one
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-ink-muted"
      >
        &#9662;
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  required = false,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <label htmlFor={id} className="label text-ink-muted">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-accent">
            *
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
