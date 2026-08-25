import { NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  HONEYPOT_FIELD,
  MAX_BODY_BYTES,
  MIN_FILL_MS,
  formatEmail,
  validate,
} from "@/lib/assessment-request";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
// Nothing here is cacheable and the whole point is the side effect.
export const dynamic = "force-dynamic";

const FROM = process.env.ASSESSMENT_FROM_EMAIL;
const TO = process.env.ASSESSMENT_TO_EMAIL;

// Deliberately not AWS_REGION / AWS_ACCESS_KEY_ID. Vercel functions run on
// Lambda, which presets those names to the function's own region and to
// placeholder credentials that grant nothing. Reading them would silently win
// over any default and point this client at the wrong region, so the SES
// config gets its own namespace and is passed to the client explicitly.
const REGION = process.env.SES_REGION || "ca-central-1";
const ACCESS_KEY_ID = process.env.SES_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.SES_SECRET_ACCESS_KEY;

const ses = new SESv2Client({
  region: REGION,
  // Falling through to the default credential chain keeps `aws configure`
  // and SSO profiles working for local development.
  credentials:
    ACCESS_KEY_ID && SECRET_ACCESS_KEY
      ? { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY }
      : undefined,
});

/** Same shape for every failure the submitter is allowed to see. */
function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  // 1. Size. Reject before parsing so a huge body is never held in memory.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return fail("That message is too long to send.", 413);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return fail("That message is too long to send.", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail("Malformed request.", 400);
  }

  const body = payload as Record<string, unknown>;

  // 2. Honeypot. A hidden field only an automated filler would populate.
  //    Answer 200 so a bot cannot tell it was caught and retry differently.
  if (typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD]) {
    return NextResponse.json({ ok: true });
  }

  // 3. Fill time. A speed bump rather than a control, since the client
  //    supplies it, but it costs nothing and stops naive scripted posts.
  const elapsed = Number(body.elapsed_ms);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_FILL_MS) {
    return NextResponse.json({ ok: true });
  }

  // 4. Rate limit per IP.
  const { allowed } = await checkRateLimit(clientIp(request.headers));
  if (!allowed) {
    return fail(
      "That's a few requests in a short window. Try again shortly, or email us directly.",
      429,
    );
  }

  // 5. Validate and clean. Everything downstream trusts this result.
  const result = validate(body);
  if (!result.ok) return fail(result.error, 400);

  if (!FROM || !TO) {
    // Misconfiguration, not the submitter's problem. Say so plainly rather
    // than accepting the request and dropping it.
    const missing = [
      !FROM && "ASSESSMENT_FROM_EMAIL",
      !TO && "ASSESSMENT_TO_EMAIL",
    ].filter(Boolean);
    console.error(`Assessment form: not configured. Missing ${missing.join(", ")}`);
    return fail(
      "We couldn't send that just now. Please email hello@allclearsafety.ca.",
      500,
    );
  }

  const { subject, body: text } = formatEmail(result.data);

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: [TO] },
        // Bounce and complaint notices go here rather than to the From
        // address, which SES would use by default. FROM is a send-only label
        // with no mailbox behind it, so a notice sent there would be lost and
        // a failed delivery would look like a success.
        FeedbackForwardingEmailAddress: TO,
        // Set from the validated address so a reply goes to the prospect.
        // validate() has already stripped CR/LF, so this cannot carry a
        // second header into the message.
        ReplyToAddresses: [result.data.email],
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            // Text only. No HTML part means no markup a submitter could
            // inject into what lands in the inbox.
            Body: { Text: { Data: text, Charset: "UTF-8" } },
          },
        },
      }),
    );
  } catch (error) {
    // The SDK's failure for absent credentials is a generic "could not load
    // credentials from any providers", which does not say whether the value
    // is missing, misspelled, or simply not deployed yet. Say which.
    if ((error as { name?: string })?.name === "CredentialsProviderError") {
      const unset = [
        !ACCESS_KEY_ID && "SES_ACCESS_KEY_ID",
        !SECRET_ACCESS_KEY && "SES_SECRET_ACCESS_KEY",
      ].filter(Boolean);
      console.error(
        unset.length > 0
          ? `Assessment form: no AWS credentials. ${unset.join(" and ")} ` +
              `not set in this environment. Note the SES_ prefix, not AWS_. ` +
              `If they are set in Vercel, the running deployment predates ` +
              `them: redeploy.`
          : `Assessment form: no AWS credentials, though SES_ACCESS_KEY_ID ` +
              `and SES_SECRET_ACCESS_KEY are both set. Check for a blank ` +
              `value or whitespace.`,
      );
      return fail(
        "We couldn't send that just now. Please email hello@allclearsafety.ca.",
        500,
      );
    }
    console.error("Assessment form: SES send failed", error);
    return fail(
      "We couldn't send that just now. Please email hello@allclearsafety.ca.",
      502,
    );
  }

  return NextResponse.json({ ok: true });
}
