# CLAUDE.md

This file provides guidance to Claude when working with this repository.
Always read this file first. It reflects the actual current state of the project.

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
| Phase 0 â€” Setup & Reading | âœ… Done | Repo, venv, model verified |
| Phase 0.5 â€” Python Refresh | âœ… Done | venv, pyproject, logging, dotenv |
| Phase 1 â€” Live Webcam Detection | âœ… Done | OpenCV + YOLO + bounding boxes |
| Phase 2 â€” Violation Logger | âœ… Done | Debounce + S3 + Supabase verified end-to-end |
| Phase 3 â€” SMS Alerts (Twilio) | âœ… Done | SMS fires within 5s of confirmed violation |
| Phase 4 â€” Supervisor Dashboard | âœ… Done | Next.js 15 + Geist + shadcn + Supabase Realtime + pre-signed S3 URLs â€” deployed on Vercel |
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
    â”œâ”€â”€ dashboard-design.md  # design system spec (Five Commandments)
    â”œâ”€â”€ PHASE_4_HANDOFF.md   # dashboard setup + deploy instructions
    â”œâ”€â”€ schema.sql           # full Supabase schema (sites, cameras, violations)
    â”œâ”€â”€ DEEP_DIVE.md         # detailed code walkthrough
    â”œâ”€â”€ NOTES.md             # learning log
    â”œâ”€â”€ PROOF.md             # market + regulatory validation
    â””â”€â”€ QUESTIONS.md         # open research backlog
```

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

- `SUPABASE_SERVICE_ROLE_KEY` only in Python backend â€” bypasses RLS, never in frontend
- `SUPABASE_ANON_KEY` only in Next.js dashboard â€” respects RLS
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
