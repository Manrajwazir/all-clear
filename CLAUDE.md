# CLAUDE.md



This file provides guidance to Claude when working with this repository.

Always read this file first. It reflects the actual current state of the project.

---

## ⏱ Where the work is right now — read this before anything else

**This file says what is TRUE. It does not say what is NEXT.**

> **What to do next lives in `D:ll-clearll-clear-internal\docs\START_HERE.md`,
> the "Right now" section.** Read that first, every session. It is kept current
> and is the designed pick-up point.

Two repositories, and work spans both:

| Repo | Branch | Holds |
|---|---|---|
| `D:ll-clearll-clear` (this one) | `staging` | the code |
| `D:ll-clearll-clear-internal` | `main` | migrations, docs, plans, sandbox scripts |

`main` on this repo is the **static marketing site** (allclearsafety.ca) and has
no database. `staging` is the real system. Do not confuse them.

**Skills that save the user re-explaining things.** These live at
`~/.claude/skills/` (user level), so they work in every project on this machine,
not just this repo. Each carries an all-clear-specific section that only applies
when working under `D:ll-clear\`:

| Skill | Use it when |
|---|---|
| `pickup` | starting cold — reports where things stand and what is blocked |
| `commit-report` | after any commit — the WHAT / WHY / HOW / WHAT-IF / YOUR-TEST format this project expects |
| `handoff` | ending a session — writes state into the project's own docs and commits |

**Standing rules that are not obvious from the code:**

- **Migrations are applied by Manraj, never by Claude.** Claude writes and
  dry-runs them; a human runs `npx supabase db push`.
- Migrations live in `all-clear-internal/supabase/migrations/`. **This repo's
  `docs/` is gitignored and holds STALE copies of `000`–`004` — do not apply
  them.**
- Never resolve an open question by picking an answer. Record it as undecided.
- Don't mark something complete because a document says so — this project's docs
  have contradicted reality before. Verify, and say which you did.
- **The executable check comes first.** Write the thing that fails before the
  code that makes it pass. Not a style preference — see the section below.

---

## HARD RULE — the executable check is written first

**Write the check that fails. Watch it fail. Then write the code that makes it
pass.**

**Why, in Manraj's words (2026-09-10):** *"if we do tests second we risk testing
what we did technically and not the intention."* That is exactly the failure. A
check written after the code is written by someone who already knows how the code
works, so it walks the paths the code actually takes. It confirms the
implementation. It cannot tell you the implementation solved the wrong problem,
because it was derived from the implementation.

A check written first is derived from the **intent**, because the implementation
does not exist yet to copy from.

This project has already been bitten by the general version of this. Every
structural count matched after the sandbox restore and the security posture was
still wrong — `anon` could still execute `ingest_violation`. The counts were
checking what had been done. Nobody had written down what was supposed to be
true.

### "Test" means executable, not necessarily a test framework

**There is no test framework in this repo** — no vitest, no jest, no playwright,
nothing in `package.json`. Establishing one is deliberately left to the CMPUT 401
students (landmine #7). So the rule is *not* "write a unit test", which would be
impossible today. It is:

> Write the smallest thing that **runs, and fails, for the right reason** —
> before the code.

In this project that has meant:

| Form | Example |
|---|---|
| A script asserting against a live database | `all-clear-internal/sandbox/rls_tests.py` — 17 assertions over the real auth endpoint |
| A script scanning text for banned patterns | `all-clear-internal/scripts/check-copy.py` |
| `npx tsc --noEmit` and `next build` | the check that the trimmed console tree stands alone |
| A curl or node script hitting a route | for API behaviour, before the route exists |

When the students establish a framework, unit tests become the default form. The
rule does not change; only the form does.

### What this looks like in practice

1. State the intent in one sentence, out loud, before writing anything.
2. Write the check. **Run it. It must fail** — and read the failure. A check that
   passes before the code exists is testing nothing, and that happens more often
   than anyone expects.
3. Write the code.
4. Run the check. It passes.
5. Report both runs. "It failed like this, then passed" is the evidence. "Tests
   pass" on its own is not, because it is also what you would say if the check
   never ran.

### The honest limit of this rule

Unlike `check-copy.py`, which is enforced by a hook and cannot be argued with,
**this rule is a discipline.** Nothing mechanically stops code being written
first. It holds only because it is written down here and because step 5 makes
skipping it visible — if there is no failing run to report, it was not followed.

---



## What This Is



**All Clear** â€” a SaaS MVP that watches IP cameras on construction sites and detects PPE

violations (missing hard hats, vests, masks) in real time. When a violation is confirmed:

1. Snapshot saved to AWS S3

2. Row inserted into Supabase Postgres

3. SMS fired to supervisor via Twilio

4. Dashboard shows it live (Supabase Realtime push)



**Target demo day:** May 12, 2026

**Co-founders:** Manraj (backend + cloud + ML co-owner) | Xavion (sales + ML lead post-MVP)

**Program:** Edmonton Unlimited Student Founders: Grow (backed by Alberta Innovates)



---



## Phase Status



| Phase | Status | Description |

|---|---|---|

| Phase 0 â€” Setup & Reading | ✅ Done | Repo, venv, model verified |

| Phase 0.5 â€” Python Refresh | ✅ Done | venv, pyproject, logging, dotenv |

| Phase 1 â€” Live Webcam Detection | ✅ Done | OpenCV + YOLO + bounding boxes |

| Phase 2 â€” Violation Logger | ✅ Done | Debounce + S3 + Supabase verified end-to-end |

| Phase 3 â€” SMS Alerts (Twilio) | ✅ Done | SMS fires within 5s of confirmed violation |

| Phase 4 â€” Supervisor Dashboard | ✅ Done | Next.js 15 + Geist + shadcn + Supabase Realtime + pre-signed S3 URLs â€” deployed on Vercel |

| Phase 5 â€” Polish for Demo Day | ðŸ”œ Next | Landing page, RLS, demo mode polish, domain |



---



## Environment â€” IMPORTANT



### Python

- **Python 3.11** from `C:\Users\manra\AppData\Local\Programs\Python\Python311\`

- **DO NOT** use MSYS2 Python (`C:\msys64\mingw64\bin\python.exe`) â€” it has no pip

- **venv** is at `D:\All Clear\All Clear\venv` (root of repo, NOT inside detection/)

- Activate: `.\venv\Scripts\Activate.ps1`

- Always run detection scripts from `detection/` folder, not repo root



### GPU / CUDA

- Hardware: NVIDIA GeForce RTX 4080 Laptop GPU, CUDA driver 13.1

- PyTorch installed: `torch 2.11.0+cu126` (CUDA 12.6 wheel)

- Verify GPU: `import torch; print(torch.cuda.is_available())`

- If `False`: reinstall with `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126`



### Node

- Node 20 LTS (for Next.js dashboard)

- Dashboard uses Next.js 15, React 19, Tailwind v4



---



## Repository Layout



```

D:\All Clear\All Clear\

â”œâ”€â”€ .gitignore

â”œâ”€â”€ BUILD_PATHWAY.md         # full 14-day build plan with architecture rationale

â”œâ”€â”€ CLAUDE.md                # this file â€” read first

â”œâ”€â”€ README.md                # quick start

â”‚

â”œâ”€â”€ detection/               # Python service â€” all CV/ML inference runs here

â”‚   â”œâ”€â”€ pyproject.toml       # deps: ultralytics, opencv, supabase, boto3, twilio

â”‚   â”œâ”€â”€ .env / .env.example  # secrets (gitignored) / blank template

â”‚   â”œâ”€â”€ models/

â”‚   â”‚   â””â”€â”€ ppe_v1.pt        # YOLOv8s PPE weights, 22MB (gitignored)

â”‚   â”œâ”€â”€ src/

â”‚   â”‚   â”œâ”€â”€ __init__.py

â”‚   â”‚   â”œâ”€â”€ main.py          # entry point â€” webcam â†’ YOLO â†’ debounce â†’ S3 â†’ Supabase â†’ SMS

â”‚   â”‚   â”œâ”€â”€ detector.py      # PPEDetector class wrapping YOLO

â”‚   â”‚   â”œâ”€â”€ debounce.py      # ViolationTracker (debounce + cooldown)

â”‚   â”‚   â”œâ”€â”€ storage.py       # Supabase insert + S3 upload

â”‚   â”‚   â””â”€â”€ alerts.py        # Twilio SMS + AWS SES digest

â”‚   â””â”€â”€ tests/

â”‚       â”œâ”€â”€ test_storage.py  # validates Supabase + S3

â”‚       â””â”€â”€ test_twilio.py   # sends a single test SMS

â”‚

â”œâ”€â”€ dashboard/               # Next.js 15 (App Router, TypeScript, Tailwind v4)

â”‚   â”œâ”€â”€ app/

â”‚   â”‚   â”œâ”€â”€ layout.tsx       # root layout with Geist + Geist Mono fonts

â”‚   â”‚   â”œâ”€â”€ page.tsx         # redirects to /dashboard

â”‚   â”‚   â”œâ”€â”€ globals.css      # design tokens from dashboard-design.md

â”‚   â”‚   â”œâ”€â”€ login/           # magic link auth page

â”‚   â”‚   â”œâ”€â”€ auth/callback/   # Supabase auth callback handler

â”‚   â”‚   â”œâ”€â”€ api/signed-url/  # generates pre-signed S3 URLs for private images

â”‚   â”‚   â””â”€â”€ dashboard/

â”‚   â”‚       â”œâ”€â”€ layout.tsx   # nav rail shell (60px icon sidebar)

â”‚   â”‚       â”œâ”€â”€ page.tsx     # main dashboard (hero + feed + charts)

â”‚   â”‚       â”œâ”€â”€ cameras/     # camera management (stub)

â”‚   â”‚       â”œâ”€â”€ history/     # violation archive (stub)

â”‚   â”‚       â”œâ”€â”€ reports/     # reports (stub)

â”‚   â”‚       â”œâ”€â”€ settings/    # settings (stub)

â”‚   â”‚       â””â”€â”€ account/     # user account (stub)

â”‚   â”œâ”€â”€ components/

â”‚   â”‚   â”œâ”€â”€ hero/StatusHero.tsx      # hero status word + metrics

â”‚   â”‚   â”œâ”€â”€ feed/ViolationFeed.tsx   # live feed with Supabase Realtime

â”‚   â”‚   â”œâ”€â”€ feed/ViolationCard.tsx   # individual violation card

â”‚   â”‚   â”œâ”€â”€ feed/DetailPanel.tsx     # slide-in detail panel (right side)

â”‚   â”‚   â”œâ”€â”€ feed/StatusPill.tsx      # Active/Pending/Resolved status pills

â”‚   â”‚   â”œâ”€â”€ feed/DemoModeBar.tsx     # load demo data button

â”‚   â”‚   â”œâ”€â”€ charts/ViolationCharts.tsx  # hourly + by-type charts (Recharts)

â”‚   â”‚   â””â”€â”€ layout/NavRail.tsx       # icon-only sidebar navigation

â”‚   â”œâ”€â”€ lib/

â”‚   â”‚   â”œâ”€â”€ supabase/client.ts       # browser Supabase client

â”‚   â”‚   â”œâ”€â”€ supabase/server.ts       # server component Supabase client

â”‚   â”‚   â”œâ”€â”€ supabase/middleware.ts   # auth middleware helper

â”‚   â”‚   â”œâ”€â”€ supabase/types.ts        # hand-rolled DB types (Violation, Camera, Site)

â”‚   â”‚   â”œâ”€â”€ status.ts               # deriveStatus() â€” safe/warning/critical logic

â”‚   â”‚   â”œâ”€â”€ demo-data.ts            # fake violation generator for demo mode

â”‚   â”‚   â”œâ”€â”€ use-signed-url.ts       # hook: converts S3 URLs â†’ pre-signed URLs

â”‚   â”‚   â””â”€â”€ utils.ts                # cn(), formatTimeSince(), formatViolationType()

â”‚   â””â”€â”€ middleware.ts               # auth redirect (unauthenticated â†’ /login)

â”‚

â””â”€â”€ docs/

    â””â”€â”€ migrations/          # âš  STALE COPIES of 000-004 only. See below.

```

### âš  `docs/` is gitignored and mostly does not exist (corrected 2026-09-07)

This section used to list `dashboard-design.md`, `PHASE_4_HANDOFF.md`,
`schema.sql`, `DEEP_DIVE.md`, `NOTES.md`, `PROOF.md` and `QUESTIONS.md`.
**None of them are here.** `.gitignore` line 20 is `/docs`, so nothing in this
folder is tracked by any repository — which is how those files were lost.

`docs/migrations/` still holds copies of `000`-`004`. They are **stale and must
not be applied**: `005`, `006` and `007` are missing entirely, and the live
schema has moved well past them.

**The real home for all of it is the `all-clear-internal` repository:**

| What you want | Where it actually is |
|---|---|
| Migrations | `all-clear-internal/supabase/migrations/` (timestamped; applied with `npx supabase db push`) |
| Reproducible schema | `all-clear-internal/migrations/baseline/baseline_public.sql` |
| Verification suites | `all-clear-internal/migrations/` |
| Design system | `all-clear-internal/docs/dashboard-design.md` |
| Everything else | `all-clear-internal/docs/` |



---



## Running Everything



### Detection Service

```powershell

.\venv\Scripts\Activate.ps1

cd detection

python src/main.py

```

Quit: click the OpenCV camera window â†’ press `q` or `ESC` (or Ctrl+C in terminal).



### Dashboard

```powershell

cd dashboard

npm run dev    # http://localhost:3000

```

Login: enter email â†’ click magic link in inbox â†’ redirected to /dashboard.



### Both Together (the real demo)

1. Terminal 1: run `python src/main.py` (detection)

2. Terminal 2: run `npm run dev` (dashboard)

3. Walk in front of webcam without hardhat

4. Watch: terminal logs â†’ S3 upload â†’ Supabase row â†’ SMS on phone â†’ card appears live in dashboard



---



## Detection Pipeline



```

OpenCV webcam frame

  â†’ PPEDetector.predict()           [YOLO inference, GPU]

  â†’ PPEDetector.find_violations()   [filter: NO-Hardhat, NO-Safety Vest, NO-Mask]

  â†’ ViolationTracker.should_alert() [debounce 5 frames + 60s cooldown]

  â†’ cv2.imencode()                  [encode frame to JPEG bytes]

  â†’ upload_snapshot()               [S3: violations/{camera_id}/{timestamp}.jpg]

  â†’ log_violation()                 [Supabase: insert into violations table]

  â†’ send_violation_sms()            [Twilio: SMS to supervisor]

```



## Dashboard Pipeline



```

Supabase Realtime subscription (WebSocket)

  â†’ INSERT on violations table detected

  â†’ fetchOne(id) â€” re-fetch with camera join

  â†’ prepend to violations[] state

  â†’ deriveStatus() recalculates hero word (safe/warning/critical)

  â†’ ViolationCard renders with pre-signed S3 image URL

  â†’ click card â†’ DetailPanel slides in from right

  â†’ "Mark resolved" â†’ UPDATE violations SET resolution_status = 'resolved'

```



---



## Key Design Decisions



- `SUPABASE_SERVICE_ROLE_KEY` lives in the **Next.js server**, not the Python service
  *(changed in Phase 3, corrected here 2026-09-07)*. It bypasses RLS, so exactly one
  module creates a client with it: `dashboard/lib/supabase/service-role.ts`, guarded by
  `import "server-only"` so importing it into a browser component is a **build error**
  rather than a leaked key. Reachable only from `lib/device-auth.ts`, the four
  `/api/v1/` routes, and layer 2 of `lib/rate-limit.ts`.
  A device authenticates with its own API key, not a Supabase session, so there is no
  RLS identity to attach and RLS cannot be the control for those routes.
  **This was a net reduction in exposure:** the key used to sit on every field device.
  It is still declared in `detection/.env` because `storage.py` and its tests read it,
  but `main.py` no longer imports `storage.py` — the violation path goes through
  `api_client.py` with a device key. `detection/.env.example` says it plainly:
  a real deployed device should not have it set.

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the browser â€” respects RLS

- S3 bucket is **private** â€” `/api/signed-url` route generates 1-hour pre-signed URLs

- Debounce (5 frames â‰ˆ 167ms at 30 FPS) = frame-level noise filter

- Cooldown (60s) = event-level dedup (prevents SMS spam)

- Dashboard design follows `docs/dashboard-design.md` (Five Commandments)

- StatusPill shows "Active" (amber) for pending violations < 5min, "Pending" (blue) for older ones

- 404s for `LayoutGroupContext.mjs.map` and `com.chrome.devtools.json` are harmless dev-mode noise



---



## Database Schema (Supabase)



Three tables: `sites` â†’ `cameras` â†’ `violations`



Seed data (matches `CAMERA_ID` in `main.py`):

- Site UUID: `aaaaaaaa-0000-0000-0000-000000000001` (All Clear MVP Site, Edmonton AB)

- Camera UUID: `00000000-0000-0000-0000-000000000001` (Webcam Dev Camera)



`violations.resolution_status`: `pending` | `resolved` | `false_positive`



Realtime enabled: `alter publication supabase_realtime add table violations;`



Full schema: `all-clear-internal/migrations/baseline/baseline_public.sql` — a
`pg_dump --schema-only` of the live database, verified against the migrations with
zero drift (2026-09-06). `docs/schema.sql` no longer exists; see the note under the
repository layout above.



---



## Environment Variables



### detection/.env (Python backend)

```

SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (backend only)

S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME

SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY

TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER

DETECTION_CONFIDENCE_THRESHOLD, DEBOUNCE_FRAMES, COOLDOWN_SECONDS

```



### dashboard/.env.local (Next.js)

```

NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (browser-safe)

S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME (server-side only, for /api/signed-url)

```

**Never name an S3 or SES variable `AWS_*`.** Both services get their own prefix,
and it is not a style preference — it is load-bearing in two places.

On Vercel, functions run on AWS Lambda, and the Lambda runtime *presets*
`AWS_REGION` to the function's own region and `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` to execution-role placeholders that grant nothing. They
are always present, so they beat any `||` fallback in code: a client built from
`AWS_*` points at the wrong region with useless credentials and fails at request
time, not deploy time. Several `AWS_*` names are outright reserved and cannot be
set in the Vercel dashboard at all.

In the Python service, boto3's default credential chain reads `AWS_*` and then
falls back to `~/.aws/credentials`. On 2026-08-20 that fallback silently found a
deleted key from the old personal AWS account and every S3 upload failed while
the SMS alert still fired. `storage.py` and `alerts.py` now pass credentials
explicitly from `S3_*` / `SES_*`, so there is exactly one credential source and
a missing variable raises immediately instead of reaching for a stale file.

The canonical list for each service is its `.env.example`. A variable the code
reads and the example omits is the defect that broke signed URLs; add both in
the same commit.



---



## Known Gaps (Fix Before Customer #1)



| Gap | Fix |

|---|---|

| ~~No RLS on Supabase tables~~ | ✅ **Wrong — corrected 2026-09-07.** RLS has been live since migrations `002`/`002b`: an unauthenticated anon-key request returns HTTP 200 with **zero rows** on all eight tenant tables. What is genuinely open is that it has never been tested *adversarially* — the database holds one organization, so cross-tenant isolation is unproven. Tracked as step C4 in `all-clear-internal/docs/CMPUT401_HANDOVER_PLAN.md` |

| Single hardcoded CAMERA_ID | Multi-tenant camera management |

| No multi-recipient SMS | Add to settings page |

| AGPL-3.0 (Ultralytics) | Email `licensing@ultralytics.com` |

| Worker consent / PIPA | Required before ANY pilot |

| No retry queue (S3/Twilio down) | Add queue + retry |

| Stub pages (cameras, history, reports, settings) | Build in Phase 5 |



---



## Model Details



- **Source:** VoxDroid/Construction-Site-Safety-PPE-Detection (MIT license for weights)

- **Architecture:** YOLOv8s, 200 epochs

- **Dataset:** Roboflow Construction Site Safety (2,801 images, 10 classes)

- **Metrics:** Precision 0.927, Recall 0.774, mAP@50 84.1%

- **Violation classes:** NO-Hardhat, NO-Safety Vest, NO-Mask



