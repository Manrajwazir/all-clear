/**
 * Validation and formatting for the assessment request form.
 *
 * Hand-rolled rather than pulling in a schema library: seven string fields
 * with length caps is not worth a dependency, and keeping it here means the
 * caps are visible next to the code that trusts them.
 */

/** Hard cap on the whole request body, before parsing. */
export const MAX_BODY_BYTES = 16 * 1024;

/** A bot that fills this hidden field is not a person. */
export const HONEYPOT_FIELD = "company_website";

/** Anything submitted faster than this was not typed by a human. */
export const MIN_FILL_MS = 3000;

type FieldSpec = { label: string; max: number; required?: boolean };

const FIELDS: Record<string, FieldSpec> = {
  name: { label: "Name", max: 120, required: true },
  organization: { label: "Company", max: 160, required: true },
  role: { label: "Role", max: 120 },
  email: { label: "Work email", max: 254, required: true },
  site_type: { label: "Site type", max: 80 },
  location: { label: "Site location", max: 160 },
  cameras: { label: "Existing cameras", max: 80 },
  cor_status: { label: "COR certified", max: 40 },
  message: { label: "Anything we should know", max: 4000 },
};

export type AssessmentRequest = Record<keyof typeof FIELDS, string>;

export type ValidationResult =
  | { ok: true; data: AssessmentRequest }
  | { ok: false; error: string };

/**
 * Control characters have no business in any of these fields. CR and LF in
 * particular are the classic email-header injection vector, and while the
 * SESv2 structured API is not string-concatenated the way raw SMTP is, there
 * is no reason to carry them any further than this function.
 */
function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    // C0 controls and DEL become spaces. CR and LF are the ones that
    // matter; the rest have no business in a form field either.
    out += code < 0x20 || code === 0x7f ? " " : ch;
  }
  return out.trim();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validate(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Malformed request." };
  }
  const input = raw as Record<string, unknown>;

  const data = {} as AssessmentRequest;

  for (const [key, spec] of Object.entries(FIELDS)) {
    const value = clean(input[key]);

    if (spec.required && !value) {
      return { ok: false, error: `${spec.label} is required.` };
    }
    if (value.length > spec.max) {
      return { ok: false, error: `${spec.label} is too long.` };
    }
    data[key as keyof AssessmentRequest] = value;
  }

  if (!EMAIL.test(data.email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }

  return { ok: true, data };
}

/**
 * Plain text only. No HTML body means no markup a submitter could inject
 * into what lands in the inbox.
 */
export function formatEmail(data: AssessmentRequest): {
  subject: string;
  body: string;
} {
  const subject = `Assessment request: ${data.organization || data.name}`;

  const line = (label: string, value: string) =>
    `${label.padEnd(20)}${value || "(not given)"}`;

  const body = [
    "New assessment request from allclearsafety.ca",
    "",
    line("Name", data.name),
    line("Company", data.organization),
    line("Role", data.role),
    line("Work email", data.email),
    line("Site type", data.site_type),
    line("Site location", data.location),
    line("Existing cameras", data.cameras),
    line("COR certified", data.cor_status),
    "",
    "Anything we should know",
    "-----------------------",
    data.message || "(nothing added)",
    "",
    `Received ${new Date().toISOString()}`,
  ].join("\n");

  return { subject, body };
}
