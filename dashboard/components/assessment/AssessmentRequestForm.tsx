import { cn } from "@/lib/utils";
import { MailLink } from "@/components/site/Buttons";

/**
 * Presentational only. There is deliberately no <form> element, no action and
 * no submit handler — submission is not wired up yet, and a bare <form> would
 * let a stray Enter keypress GET the page with the visitor's details in the
 * URL. The live path off this page is the mailto beside the button.
 */

const FIELD =
  "min-h-[52px] w-full border border-rule-strong bg-cream-50 px-4 py-3.5 " +
  // 16px keeps iOS Safari from zooming the viewport on focus.
  "text-[16px] text-ink placeholder:text-ink-faint " +
  "focus:border-accent focus:outline-none";

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

export default function AssessmentRequestForm() {
  return (
    <div>
      <h2 id="assessment-form" className="label mb-8 text-accent">
        Assessment request
      </h2>

      <div
        role="group"
        aria-labelledby="assessment-form"
        className="flex flex-col gap-6"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field id="ac-name" label="Name">
            <input
              id="ac-name"
              type="text"
              name="name"
              autoComplete="name"
              placeholder="First and last"
              className={FIELD}
            />
          </Field>
          <Field id="ac-company" label="Company">
            <input
              id="ac-company"
              type="text"
              name="organization"
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
              autoComplete="organization-title"
              placeholder="e.g. Safety manager"
              className={FIELD}
            />
          </Field>
          <Field id="ac-email" label="Work email">
            <input
              id="ac-email"
              type="email"
              name="email"
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
              placeholder="City or region"
              className={FIELD}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field id="ac-cameras" label="Existing cameras">
            <Select
              id="ac-cameras"
              name="cameras"
              options={CAMERA_STATES}
            />
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
            placeholder="How many cameras, which zones matter, what an audit asks you for."
            className={cn(FIELD, "resize-y leading-[1.6]")}
          />
        </Field>

        <div className="flex flex-col gap-5 pt-1.5 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center min-[420px]:gap-6">
          <button
            type="button"
            className="label inline-flex min-h-[54px] w-full items-center justify-center bg-accent px-8 text-cream transition-colors hover:bg-accent-hover min-[420px]:w-auto"
          >
            Send request
          </button>
          <span className="inline-flex flex-wrap items-center gap-x-2 text-[14px] text-ink-muted">
            Or email
            <MailLink>hello@allclearsafety.ca</MailLink>
          </span>
        </div>
      </div>
    </div>
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
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="label text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
