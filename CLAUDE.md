# CLAUDE.md

Guidance for working in this repository. Read this first.

---

## Branch you are on: `main`

`main` is the **public marketing site only** — allclearsafety.ca. Static, no
login, no dashboard, no database, no backend calls, nothing dynamic.

**The product lives on `staging`.** The detection pipeline, the supervisor
dashboard, Supabase, S3 and Twilio are all there, not here. If you are looking
for `detection/`, `app/dashboard/`, `lib/supabase/` or the API routes, switch
branches — they were removed from `main` deliberately, not lost.

**One backend path exists, deliberately.** `app/api/assessment/route.ts`
emails the assessment form to `hello@allclearsafety.ca` via AWS SES. That was
decided on 2026-08-23; before it, this branch had none. It stays the only one.
Anything else that needs to talk to a service is a decision to make first, not
a refactor to slip in.

Do not add a database, an auth layer, or a Supabase client here. The form
endpoint sends mail and stores nothing.

---

## What's here

```
all-clear/
├── CLAUDE.md            # this file
├── README.md
├── amplify.yml          # legacy AWS Amplify config; deploys run on Vercel
└── dashboard/           # the Next.js app (directory name is historical)
    ├── app/
    │   ├── layout.tsx       # Roboto, navy header/footer shell, metadata
    │   ├── globals.css      # surface ladder + ink tokens
    │   ├── page.tsx         # /              Home
    │   ├── how-it-works/    # /how-it-works
    │   ├── about/           # /about
    │   ├── assessment/      # /assessment    the conversion page
    │   ├── contact/         # /contact       general enquiries only
    │   ├── privacy/         # /privacy
    │   └── not-found.tsx    # 404
    ├── components/
    │   ├── site/            # Container, Band (+Card, Eyebrow), Buttons,
    │   │                    # PageHero, SiteHeader, SiteFooter
    │   └── assessment/      # AssessmentRequestForm
    └── lib/utils.ts         # cn() only
```

Vercel's project root points at `dashboard/`, so renaming it means touching
Vercel config.

---

## Running it

```powershell
cd dashboard
npm install
npm run dev      # http://localhost:3000
```

`npm run build` fetches Roboto from Google Fonts, so a clean first build needs
network access.

---

## Design system

The five `.dc.html` mockups in `all-clear-internal/frontend/` were the original
source. **They are now a reference for copy structure only** — the visual
system deliberately diverges from them (see below). Do not "restore" the
mockups' look.

### Surfaces, not rules

Sections are separated by **stepping between surfaces**, not by hairline
dividers. Two adjacent `Band`s must never share a tone, or the seam vanishes.

| Token | Value | Use |
|---|---|---|
| `cream-50` | `#F5EFE4` | cards raised off a cream band |
| `cream` | `#EAE0CF` | base page |
| `cream-200` | `#DED2BC` | alternating band |
| `navy-700` | `#1C2559` | cards raised off a navy band |
| `navy` | `#111844` | inverted band |
| `navy-900` | `#0B1030` | footer, closing CTA |

Hairlines survive **only inside data tables** (`--rule`, `--rule-inverse`),
where they separate rows rather than sections.

### Ink

| Token | Value | Contrast on cream |
|---|---|---|
| `ink` | `#111844` | 12.97:1 |
| `ink-muted` | `#3B4675` | 6.93:1 — body copy |
| `ink-faint` | `#5A6595` | captions only, never body |
| `ink-inverse` | `#EAE0CF` | on navy |
| `ink-inverse-muted` | `#8FA3C4` | on navy, 5.63:1 on `navy-700` |
| `accent` | `#2F49B8` | CTAs, links, eyebrows, stat figures |

The old `slate #4B5694` body colour was replaced because it read washed out —
it passed AA at 5.25:1 but only just, and it was paired with `font-weight:300`.
**Body weight is 400.** Do not reintroduce 300 for running text.

`ink-inverse-muted` was also darkened: the old `#7288AE` fails AA on `navy-700`
(4.01:1).

### One typeface

**Roboto only.** There is no mono face. The recurring small uppercase label is
the `.label` utility (11px / 500 / 0.16em tracking). Figures that need to align
in a column use `.tabular` (`font-variant-numeric: tabular-nums`), not a
typeface switch.

Do not add a second family.

### Corners and motion

Every box carries `rounded-soft` (3px, `--radius-soft`) — cards, buttons,
form fields, data panels. Small on purpose: enough to soften the edge without
reading as a rounded consumer UI. Data panels that hold an edge-to-edge
hairline grid also need `overflow-hidden`, or the inner grid squares off the
corner.

Sections fade in on scroll via `ScrollReveal`, mounted once in the layout.
It observes `[data-reveal]`, which `Band` emits by default.

**The hidden state is scoped to `.js-reveal`, a class the component adds to
`<html>` only after it mounts.** Keep it that way. If the hidden state were
unconditional, a failed JS chunk would leave the whole page invisible; scoping
it means no script simply means no animation.

Pass `reveal={false}` on any band that is above the fold, or that contains a
`position: sticky` child — the reveal's `translateY` would become that child's
containing block. The privacy contents rail is the live example.

### Layout

- `Container` — 1440px measure, `clamp(20px,5vw,64px)` gutters.
- `.measure` — caps running text at 68ch. Structure spans the full grid; prose
  never does.
- `Band` — full-bleed section, takes `tone` and `size`; `bleed` skips the
  container.
- `Card` — raised panel, one surface step lighter than its band.
- `Eyebrow` — accent-coloured section label.
- **No section numbering.** The old `01 / The gap` rail pattern is gone and
  should not come back — it was what made the site read as slides.

---

## Mobile is the primary case

Supervisors read this outdoors, one-handed, in gloves.

- Tap targets ≥ 44px. Nav rows 56px, buttons 52–54px.
- Form inputs at **16px** — smaller makes iOS Safari zoom on focus.
- CTAs full-width below 420px.
- Nothing scrolls horizontally at 320px.

---

## The assessment form

`components/assessment/AssessmentRequestForm.tsx` posts to
`app/api/assessment/route.ts`, which sends a plain-text email via SES.

Env vars are listed in `dashboard/.env.local.example`. All of them also need
setting in the Vercel project, or the endpoint returns a 500 and tells the
submitter to email instead.

**The SES vars are `SES_*`, not `AWS_*`, deliberately.** Vercel functions run
on Lambda, which presets `AWS_REGION` to the function's own region and
`AWS_ACCESS_KEY_ID` to placeholder credentials that grant nothing. A client
reading those names would silently build against the wrong region and fail
with a 502 that looks like a credentials problem. The route passes region and
credentials to `SESv2Client` explicitly, and falls back to the default
credential chain only when `SES_ACCESS_KEY_ID` is unset, so local `aws
configure` profiles still work.

**SES setup this depends on.** `ASSESSMENT_FROM_EMAIL` must be a verified SES
identity. While the account is in the SES sandbox the recipient must be
verified too, which is fine because it is our own address. The `allclear-app`
IAM user is scoped to S3 only, so `ses:SendEmail` needs adding to its policy or
a separate principal creating.

### The protections, and why each is there

The risk here is not data theft; there is nothing stored to steal. It is the
sending reputation of `allclearsafety.ca` — the same domain company email and
every grant application run on — plus `hello@` staying usable.

| Layer | Where | Note |
|---|---|---|
| Honeypot field | form + route | Off-screen, `aria-hidden`, `tabIndex={-1}`. Removing it from either side without the other silently disables the check. |
| Minimum fill time | form + route | A speed bump, not a control: the client supplies the number. |
| Per-IP rate limit | `lib/rate-limit.ts` | 3 per 10 minutes, Upstash. **Fails open on purpose** — losing a real enquiry is worse than letting spam through, and the honeypot still applies. |
| Body size cap | route | Checked before parsing. |
| Field validation | `lib/assessment-request.ts` | Length caps per field; everything downstream trusts the result. |
| Control-character stripping | `lib/assessment-request.ts` | CR/LF are the email-header injection vector. |
| Plain-text email only | route | No HTML part means no markup a submitter can inject into the inbox. |

Hardcode the envelope. `FromEmailAddress` and `ToAddresses` come from env, never
from the request. `ReplyToAddresses` uses the submitted address only after
validation has stripped control characters.

**Never let a submission fail silently.** A send failure must surface an error
and the mailto. Someone describing their site's compliance gaps deserves to know
the message did not arrive.

CAPTCHA was considered and skipped — it costs conversion, and honeypot plus rate
limiting is enough at this traffic level. Cloudflare Turnstile is the escalation
if spam actually gets through.

## Claims on the site — check these before editing copy

Copy is derived from the internal repo's ADRs and GTM strategy. Several rules
exist because customer-facing material previously got them wrong.

**Naming.** The registered entity is **2819394 Alberta Corp.**; the "All Clear"
trade name is not filed yet. Use "All Clear" as the brand in all headings and
body copy, and "2819394 Alberta Corp., operating as All Clear" only where the
legal entity is required — the footer copyright line, the contact page's legal
card, and the privacy policy. **"All Clear Inc." does not exist.** It was on the
site until 2026-08-23 and was wrong.

**Hardware.** Say "runs on your existing cameras," never "no new hardware."
ADR 0009 names that second claim as false — the edge device is always new
hardware on site, and one unit covers roughly 6–8 cameras. The site states this
plainly on `/how-it-works` and `/assessment`.

**Commercial model.** The entry point is a **paid, fixed-fee safety risk
assessment**, not a free pilot. ADR 0009 explicitly rejects "free pilot
converting to paid" as the default entry point. The approved three-sentence
public pricing description is on `/assessment`; use it verbatim. Do not publish
the ~$900/unit figure — ADR 0010 keeps that as a verbal answer when pressed.

**Do not list what the assessment delivers.** ADR 0009 states plainly that "the
entry engagement needs a defined deliverable and a defined duration before it
can be sold," and that work is not done. A "what you get" section listing named
deliverables was written and then removed on 2026-08-23 for exactly this
reason: it made specific public promises about a product whose scope nobody has
signed off. Say it produces a documented compliance baseline, which is approved
language, and stop there until the deliverable is actually defined.

**WCB / COR / PIR.** This is the differentiating wedge and it belongs on the
front page. Only these figures are cleared for public use:

- PIR pays **up to 20%** off the industry rate, gated on holding a COR *and* on
  injury-reduction performance — never on documentation alone.
- WCB-Alberta paid **~$106.5M** to **over 10,000** COR holders in a year.

**Never publish the ±40% experience-rating swing as a general claim.** It only
applies above ~$200,000 in three-year premiums. Internal docs flag this as
precisely the error a CFO recomputes and catches, which then discounts every
other claim.

**Tamper-evidence.** Hash-chaining is described as **in development** through
the Labs4 placement, because it is. ADR 0003 also bounds it: the chain detects
*modification*, not deletion. Do not promote it to a shipped capability.

**Detection scope.** Hard hat, hi-vis vest, and mask. Events carry a
**confidence score**.

**Other standing rules.** No detection accuracy or FPS figures anywhere. No
published price list. The compliance record on the home page keeps its
"Illustrative example. Not a real record." caption. The privacy policy carries
two visible `[Placeholder — …]` notes and a last-updated date; both intentional.

**ICP.** Heavy industrial, oil & gas, and construction. A field disqualification
specifically removed "manufacturing" as a segment label — do not reintroduce it.

**Prevention is not the headline.** Discovery validated that the automated
documentation is the value and prevention is secondary. Lead with the record.

**The homepage H1 is the company tagline** from the pitch deck's slide 1:
"Proof your worksite was safe, before anyone asks for it." The eyebrow above it
states the category outright, and the subhead says what the system does in
plain mechanism terms. This ordering is deliberate — an earlier version led
with "Most operators run safe sites. Few can prove it.", which is a problem
statement and left a cold visitor never learning what the product is. That line
now heads the WCB/COR section instead, which is where it belongs.

Note the deck's slide 3 tagline ("Detect it. Document it. Prevent the next
one.") is flagged in the discovery log as having drifted prevention-first. Do
not adopt it.

**No em-dashes in user-visible copy.** Use a colon, a comma, or a full stop.
This covers page titles and meta descriptions too. Source comments are exempt.
