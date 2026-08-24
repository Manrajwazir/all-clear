# All Clear — marketing site

The public website for [allclearsafety.ca](https://allclearsafety.ca).

All Clear is a workplace-safety compliance system: it reads the security
cameras already on an industrial site, detects missing PPE, and writes each
detection to a timestamped compliance record. In default mode it captures no
imagery at all.

---

## This branch is the website only

`main` is a static marketing site. No login, no dashboard, no database, no
backend calls.

**The product is on `staging`** — the detection pipeline, the supervisor
dashboard, and the Supabase/S3/Twilio integrations all live there.

---

## Pages

| Route | Page |
|---|---|
| `/` | Home |
| `/how-it-works` | The four-stage pipeline, modes, deployment |
| `/about` | Who we are, research and support |
| `/assessment` | The paid risk assessment — the conversion page |
| `/contact` | General enquiries only |
| `/privacy` | Privacy policy |

The assessment form is presentational only — submission is not wired up yet.
The working path is the `hello@allclearsafety.ca` link beside the button.

---

## Running it

```powershell
cd dashboard
npm install
npm run dev      # http://localhost:3000
```

The app lives in `dashboard/` — a historical directory name from when this
branch mirrored `staging`. Vercel's project root points at it.

`npm run build` pulls Roboto from Google Fonts at build time, so a clean first
build needs network access. Nothing else reaches the network at build or run
time.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4. Five
dependencies total; no data layer, no UI kit, no icon package. One typeface
(Roboto) and a six-step cream/navy surface ladder — sections are separated by
a change of surface rather than by dividing rules.

## Deployment

Vercel, connected to `main`. Every route prerenders as static HTML.

## Contributing to the design

Layout and copy come from approved mockups in the private internal repo
(`all-clear-internal/frontend/`). Check those before redesigning a page, and
see `CLAUDE.md` for the design tokens, layout conventions, mobile requirements,
and which claims on the site are deliberate.
