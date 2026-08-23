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

Do not add a backend dependency to this branch. If something on the marketing
site needs to talk to a service, that is a decision to make first, not a
refactor to slip in.

---

## What's here

```
all-clear/
├── CLAUDE.md            # this file
├── README.md
├── amplify.yml          # legacy AWS Amplify config; deploys run on Vercel
└── dashboard/           # the Next.js app (directory name is historical)
    ├── app/
    │   ├── layout.tsx       # Roboto + Roboto Mono, header/footer shell, metadata
    │   ├── globals.css      # cream/navy design tokens
    │   ├── page.tsx         # /            Home
    │   ├── about/           # /about
    │   ├── contact/         # /contact     pilot request form
    │   ├── how-it-works/    # /how-it-works
    │   ├── privacy/         # /privacy
    │   └── not-found.tsx    # 404
    ├── components/
    │   ├── site/            # Container, Rail, Buttons, Hairline, PageHero,
    │   │                    # SiteHeader (mobile menu), SiteFooter
    │   └── contact/         # PilotRequestForm
    └── lib/utils.ts         # cn() only
```

The `dashboard/` directory name is a leftover from when this branch mirrored
`staging`. Vercel's project root points at it, so renaming it means touching
Vercel config.

---

## Running it

```powershell
cd dashboard
npm install
npm run dev      # http://localhost:3000
```

`npm run build` fetches Roboto from Google Fonts at build time, so the first
build on a clean checkout needs network access.

---

## Design system

Ported from approved mockups in the private repo at
`all-clear-internal/frontend/` (`Home.dc.html`, `About.dc.html`,
`Contact.dc.html`, `How It Works.dc.html`, `Privacy Policy.dc.html`).
**Those files are the source of truth for layout and copy.** Check them before
redesigning anything here.

| Token | Value | Use |
|---|---|---|
| `cream` | `#EAE0CF` | page background |
| `navy` | `#111844` | body text, inverted bands, solid buttons |
| `slate` | `#4B5694` | secondary text, mono labels on cream |
| `slate-light` | `#7288AE` | secondary text on navy |
| `cream-wash` | `rgba(255,255,255,0.34)` | record/table card fills |
| `rule` / `rule-strong` / `rule-soft` | navy at 18% / 28% / 14% | hairlines on cream |
| `rule-inverse*` | cream at 28% / 22% / 18% | hairlines on navy |

Type is Roboto (300/400/500/700) with Roboto Mono (400/500) for labels, field
names and anything numeric. The `.label-mono` utility is the recurring
11px uppercase tracked mono label.

Layout conventions:

- `Container` — 1120px measure, `clamp(20px,5vw,48px)` gutters. Everything uses it.
- `RailSection` — the `200px | 1fr` numbered-rail pattern. Stacks below `lg`.
- `Band` — a full-bleed section; `inverse` makes it navy.
- `HairlineGrid` / `HairlineCell` — 1px-gap grid where the gaps read as rules.

**Breakpoint note:** the mockups switch at 900px; this port uses Tailwind's `lg`
(1024px) so the rail never gets squeezed. Multi-column blocks stack to one
column there, and their dividing borders move from `border-r` to `border-b`.

---

## Mobile is the primary case

Supervisors read this outdoors, one-handed, in gloves. Non-negotiables:

- Tap targets ≥ 44px. Nav rows are 56px, buttons 52–54px.
- Form inputs at **16px** — anything smaller makes iOS Safari zoom on focus.
- CTAs go full-width below 420px.
- Nothing may scroll horizontally at 320px.

---

## The contact form is not wired up

`components/contact/PilotRequestForm.tsx` is **presentational only**. No
submission backend has been chosen yet.

It deliberately has no `<form>` element, no `action` and no submit handler — a
bare `<form>` would let an Enter keypress GET the page with the visitor's
details in the URL. The working path off that page is the
`hello@allclearsafety.ca` mailto beside the button.

If you wire up submission, that is the change to make — do not add a handler
that silently discards input.

---

## Claims on the site

Copy came from approved mockups and was tightened, not rewritten. Do not add
performance numbers, accuracy figures or pricing without checking first:

- Alerts are described as **"under a minute"**, not "under 5 seconds".
- **No detection accuracy or FPS figures appear anywhere.** Don't add any.
- **Pricing is not published.** The page says "Quoted per site, after a short
  call." The mockup's `publishPricing` flag defaults to false; the $500/month
  figure is deliberately not on the site.
- The compliance record on the home page carries "Illustrative example. Not a
  real record." Keep that caption with it.
- The privacy policy carries two visible `[Placeholder — …]` notes and a
  last-updated date. Both are intentional; the legal language is still pending.
