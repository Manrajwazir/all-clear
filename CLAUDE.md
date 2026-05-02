# CLAUDE.md

This file provides guidance to Claude when working with this repository.
Always read this file first. It reflects the actual current state of the project.

---

## What This Is

**Cordon Safety** — a SaaS MVP that watches IP cameras on construction sites and detects PPE
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
| Phase 0 — Setup & Reading | ✅ Done | Repo, venv, model verified |
| Phase 0.5 — Python Refresh | ✅ Done | venv, pyproject, logging, dotenv |
| Phase 1 — Live Webcam Detection | ✅ Done | OpenCV + YOLO + bounding boxes |
| Phase 2 — Violation Logger | ✅ Done | Debounce + S3 + Supabase verified end-to-end |
| Phase 3 — SMS Alerts (Twilio) | ✅ Done | SMS fires within 5s of confirmed violation |
| Phase 4 — Supervisor Dashboard | ✅ Done | Next.js 15 + Geist + shadcn + Supabase Realtime + pre-signed S3 URLs |
| Phase 5 — Polish for Demo Day | 🔜 Next | Landing page, RLS, demo mode polish, domain |

---

## Environment — IMPORTANT

### Python
- **Python 3.11** from `C:\Users\manra\AppData\Local\Programs\Python\Python311\`
- **DO NOT** use MSYS2 Python (`C:\msys64\mingw64\bin\python.exe`) — it has no pip
- **venv** is at `D:\SiteIQ\SiteIQ\venv` (root of repo, NOT inside detection/)
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
D:\SiteIQ\SiteIQ\
├── .gitignore
├── BUILD_PATHWAY.md         # full 14-day build plan with architecture rationale
├── CLAUDE.md                # this file — read first
├── README.md                # quick start
│
├── detection/               # Python service — all CV/ML inference runs here
│   ├── pyproject.toml       # deps: ultralytics, opencv, supabase, boto3, twilio
│   ├── .env / .env.example  # secrets (gitignored) / blank template
│   ├── models/
│   │   └── ppe_v1.pt        # YOLOv8s PPE weights, 22MB (gitignored)
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py          # entry point — webcam → YOLO → debounce → S3 → Supabase → SMS
│   │   ├── detector.py      # PPEDetector class wrapping YOLO
│   │   ├── debounce.py      # ViolationTracker (debounce + cooldown)
│   │   ├── storage.py       # Supabase insert + S3 upload
│   │   └── alerts.py        # Twilio SMS + AWS SES digest
│   └── tests/
│       ├── test_storage.py  # validates Supabase + S3
│       └── test_twilio.py   # sends a single test SMS
│
├── dashboard/               # Next.js 15 (App Router, TypeScript, Tailwind v4)
│   ├── app/
│   │   ├── layout.tsx       # root layout with Geist + Geist Mono fonts
│   │   ├── page.tsx         # redirects to /dashboard
│   │   ├── globals.css      # design tokens from dashboard-design.md
│   │   ├── login/           # magic link auth page
│   │   ├── auth/callback/   # Supabase auth callback handler
│   │   ├── api/signed-url/  # generates pre-signed S3 URLs for private images
│   │   └── dashboard/
│   │       ├── layout.tsx   # nav rail shell (60px icon sidebar)
│   │       ├── page.tsx     # main dashboard (hero + feed + charts)
│   │       ├── cameras/     # camera management (stub)
│   │       ├── history/     # violation archive (stub)
│   │       ├── reports/     # reports (stub)
│   │       ├── settings/    # settings (stub)
│   │       └── account/     # user account (stub)
│   ├── components/
│   │   ├── hero/StatusHero.tsx      # hero status word + metrics
│   │   ├── feed/ViolationFeed.tsx   # live feed with Supabase Realtime
│   │   ├── feed/ViolationCard.tsx   # individual violation card
│   │   ├── feed/DetailPanel.tsx     # slide-in detail panel (right side)
│   │   ├── feed/StatusPill.tsx      # Active/Pending/Resolved status pills
│   │   ├── feed/DemoModeBar.tsx     # load demo data button
│   │   ├── charts/ViolationCharts.tsx  # hourly + by-type charts (Recharts)
│   │   └── layout/NavRail.tsx       # icon-only sidebar navigation
│   ├── lib/
│   │   ├── supabase/client.ts       # browser Supabase client
│   │   ├── supabase/server.ts       # server component Supabase client
│   │   ├── supabase/middleware.ts   # auth middleware helper
│   │   ├── supabase/types.ts        # hand-rolled DB types (Violation, Camera, Site)
│   │   ├── status.ts               # deriveStatus() — safe/warning/critical logic
│   │   ├── demo-data.ts            # fake violation generator for demo mode
│   │   ├── use-signed-url.ts       # hook: converts S3 URLs → pre-signed URLs
│   │   └── utils.ts                # cn(), formatTimeSince(), formatViolationType()
│   └── middleware.ts               # auth redirect (unauthenticated → /login)
│
└── docs/
    ├── dashboard-design.md  # design system spec (Five Commandments)
    ├── PHASE_4_HANDOFF.md   # dashboard setup + deploy instructions
    ├── schema.sql           # full Supabase schema (sites, cameras, violations)
    ├── DEEP_DIVE.md         # detailed code walkthrough
    ├── NOTES.md             # learning log
    ├── PROOF.md             # market + regulatory validation
    └── QUESTIONS.md         # open research backlog
```

---

## Running Everything

### Detection Service
```powershell
.\venv\Scripts\Activate.ps1
cd detection
python src/main.py
```
Quit: click the OpenCV camera window → press `q` or `ESC` (or Ctrl+C in terminal).

### Dashboard
```powershell
cd dashboard
npm run dev    # http://localhost:3000
```
Login: enter email → click magic link in inbox → redirected to /dashboard.

### Both Together (the real demo)
1. Terminal 1: run `python src/main.py` (detection)
2. Terminal 2: run `npm run dev` (dashboard)
3. Walk in front of webcam without hardhat
4. Watch: terminal logs → S3 upload → Supabase row → SMS on phone → card appears live in dashboard

---

## Detection Pipeline

```
OpenCV webcam frame
  → PPEDetector.predict()           [YOLO inference, GPU]
  → PPEDetector.find_violations()   [filter: NO-Hardhat, NO-Safety Vest, NO-Mask]
  → ViolationTracker.should_alert() [debounce 5 frames + 60s cooldown]
  → cv2.imencode()                  [encode frame to JPEG bytes]
  → upload_snapshot()               [S3: violations/{camera_id}/{timestamp}.jpg]
  → log_violation()                 [Supabase: insert into violations table]
  → send_violation_sms()            [Twilio: SMS to supervisor]
```

## Dashboard Pipeline

```
Supabase Realtime subscription (WebSocket)
  → INSERT on violations table detected
  → fetchOne(id) — re-fetch with camera join
  → prepend to violations[] state
  → deriveStatus() recalculates hero word (safe/warning/critical)
  → ViolationCard renders with pre-signed S3 image URL
  → click card → DetailPanel slides in from right
  → "Mark resolved" → UPDATE violations SET resolution_status = 'resolved'
```

---

## Key Design Decisions

- `SUPABASE_SERVICE_ROLE_KEY` only in Python backend — bypasses RLS, never in frontend
- `SUPABASE_ANON_KEY` only in Next.js dashboard — respects RLS
- S3 bucket is **private** — `/api/signed-url` route generates 1-hour pre-signed URLs
- Debounce (5 frames ≈ 167ms at 30 FPS) = frame-level noise filter
- Cooldown (60s) = event-level dedup (prevents SMS spam)
- Dashboard design follows `docs/dashboard-design.md` (Five Commandments)
- StatusPill shows "Active" (amber) for pending violations < 5min, "Pending" (blue) for older ones
- 404s for `LayoutGroupContext.mjs.map` and `com.chrome.devtools.json` are harmless dev-mode noise

---

## Database Schema (Supabase)

Three tables: `sites` → `cameras` → `violations`

Seed data (matches `CAMERA_ID` in `main.py`):
- Site UUID: `aaaaaaaa-0000-0000-0000-000000000001` (Cordon Safety MVP Site, Edmonton AB)
- Camera UUID: `00000000-0000-0000-0000-000000000001` (Webcam Dev Camera)

`violations.resolution_status`: `pending` | `resolved` | `false_positive`

Realtime enabled: `alter publication supabase_realtime add table violations;`

Full schema in `docs/schema.sql`.

---

## Environment Variables

### detection/.env (Python backend)
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (backend only)
AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER
DETECTION_CONFIDENCE_THRESHOLD, DEBOUNCE_FRAMES, COOLDOWN_SECONDS
```

### dashboard/.env.local (Next.js)
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (browser-safe)
AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME (server-side only, for /api/signed-url)
```

---

## Known Gaps (Fix Before Customer #1)

| Gap | Fix |
|---|---|
| No RLS on Supabase tables | Add row-level security policies |
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
