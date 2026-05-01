# CLAUDE.md

This file provides guidance to Claude when working with this repository.
Always read this file first. It reflects the actual current state of the project.

---

## What This Is

**SiteIQ** — a SaaS MVP that watches IP cameras on construction sites and detects PPE
violations (missing hard hats, vests, masks) in real time. When a violation is confirmed:
1. Snapshot saved to AWS S3
2. Row inserted into Supabase Postgres
3. SMS fired to supervisor via Twilio

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
| Phase 4 — Supervisor Dashboard | 🔜 Next | Next.js 15 + shadcn + Supabase Realtime |
| Phase 5 — Polish for Demo Day | ⬜ | Landing page, demo mode, domain |

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
- Node 20 LTS (already installed, for Next.js dashboard)

---

## Repository Layout

```
D:\SiteIQ\SiteIQ\
├── .gitignore              # covers .env, venv, __pycache__, models/*.pt
├── BUILD_PATHWAY.md        # full 14-day build plan with architecture rationale
├── CLAUDE.md               # this file — read first
├── NOTES.md                # learning log (YOLO notes, model metrics)
├── PROOF.md                # market + regulatory validation log
├── QUESTIONS.md            # research backlog
│
├── detection/              # Python service (all CV/ML runs here)
│   ├── pyproject.toml      # deps: ultralytics, opencv, supabase, boto3, twilio
│   ├── .env                # real secrets — gitignored
│   ├── .env.example        # blank template — safe to commit
│   ├── models/
│   │   └── ppe_v1.pt       # YOLOv8s PPE weights, 22MB — gitignored
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py         # entry point — run from detection/ folder
│   │   ├── detector.py     # PPEDetector class wrapping YOLO
│   │   ├── debounce.py     # ViolationTracker (debounce + cooldown)
│   │   ├── storage.py      # Supabase insert + S3 upload
│   │   └── alerts.py       # Twilio SMS + AWS SES digest
│   └── tests/
│       ├── test_storage.py # validates Supabase + S3 before running main.py
│       └── test_twilio.py  # sends a single test SMS to verify Twilio keys
│
├── dashboard/              # Next.js 15 app — NOT YET SCAFFOLDED
│   ├── package.json        # empty placeholder
│   ├── app/
│   ├── components/
│   └── lib/
│
└── docs/
    ├── schema.sql          # full Supabase schema — run in SQL Editor
    ├── architecture.md
    └── api.md
```

---

## Running the Detection Service

```powershell
# From repo root
.\venv\Scripts\Activate.ps1

cd detection

# Test storage (Supabase + S3) — run before main.py if credentials changed
python tests/test_storage.py

# Test Twilio — run before main.py if Twilio credentials changed
python tests/test_twilio.py

# Full detection loop
python src/main.py

# Quit the detection window: click the OpenCV window to focus it, then press q or ESC
# Ctrl+C in terminal also works
```

---

## Detection Pipeline (What main.py Does)

```
OpenCV webcam frame
  → PPEDetector.predict()           [YOLO inference, GPU]
  → PPEDetector.find_violations()   [filter: NO-Hardhat, NO-Safety Vest, NO-Mask]
  → ViolationTracker.should_alert() [debounce 5 frames + 60s cooldown]
  → cv2.imencode()                  [encode frame to JPEG bytes]
  → upload_snapshot()               [S3: violations/{camera_id}/{timestamp}.jpg]
  → log_violation()                 [Supabase: insert into violations table]
  → send_violation_sms()            [Twilio: SMS to supervisor]
  → results[0].plot()               [annotated frame in OpenCV window]
```

**Graceful fallback:** if `.env` is missing Supabase/AWS keys, runs in "local log only" mode (prints to terminal, no DB/S3/SMS). Safe to run at any time.

---

## Key Design Decisions

- `SUPABASE_SERVICE_ROLE_KEY` only in Python backend — bypasses RLS, never in frontend
- `SUPABASE_ANON_KEY` only in Next.js dashboard — respects RLS
- S3 bucket is **private** — dashboard will use pre-signed URLs (Phase 4)
- Debounce (5 frames ≈ 167ms at 30 FPS) = frame-level noise filter
- Cooldown (60s) = event-level dedup (prevents SMS spam)
- One Supabase client per process — not per call (avoids connection pool exhaustion)
- YOLO model loaded once per process, moved to CUDA: `model.to('cuda')`

---

## Database Schema (Supabase)

Three tables: `sites` → `cameras` → `violations`

Seed data already inserted (matches `CAMERA_ID` in `main.py`):
- Site UUID: `aaaaaaaa-0000-0000-0000-000000000001` (SiteIQ MVP Site, Edmonton AB)
- Camera UUID: `00000000-0000-0000-0000-000000000001` (Webcam Dev Camera)

`violations.resolution_status`: `pending` | `resolved` | `false_positive`

Realtime enabled: `alter publication supabase_realtime add table violations;`

Full schema in `docs/schema.sql`.

---

## Environment Variables

All in `detection/.env` (gitignored). Template in `detection/.env.example`.

```
SUPABASE_URL=                        # https://xxxx.supabase.co
SUPABASE_ANON_KEY=                   # for dashboard only
SUPABASE_SERVICE_ROLE_KEY=           # for Python backend only

AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=siteiq-violations-dev

TWILIO_ACCOUNT_SID=                  # starts with AC
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+18147916276      # Twilio trial number
TWILIO_TO_NUMBER=                    # Manraj's phone

DETECTION_CONFIDENCE_THRESHOLD=0.6
DEBOUNCE_FRAMES=5
COOLDOWN_SECONDS=60
```

---

## Phase 4 — Dashboard (Next.js) — What Needs to Be Built

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase JS + Recharts

**Bootstrap commands (run from dashboard/ folder):**
```powershell
cd dashboard
npx create-next-app@latest . --typescript --tailwind --app --no-git
npx shadcn@latest init
npx shadcn@latest add button card table dialog input form badge
```

**Pages to build:**
- `/login` — Supabase magic link auth
- `/dashboard` — live violation feed + stats
- `/dashboard/violations/[id]` — single violation detail with photo
- `/dashboard/cameras` — camera management (Phase 4+)
- `/dashboard/settings` — alert recipient config

**Supabase client for dashboard** (`dashboard/lib/supabase.ts`):
```typescript
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // anon key only, never service role
);
```

**Deployment:** AWS Amplify (not Vercel) — matches PatrolPrep architecture, stronger Alberta enterprise resume.

---

## Known Security Gaps (Acceptable for MVP, Fix Before Customer #1)

| Gap | Fix |
|---|---|
| No RLS on Supabase tables | Add row-level security policies before production |
| S3 image URLs are permanent (no expiry) | Generate pre-signed URLs with expiry in dashboard |
| Single hardcoded CAMERA_ID | Multi-tenant camera management in Phase 4+ |
| No multi-recipient SMS routing | Add to settings page in Phase 5 |
| AGPL-3.0 (Ultralytics) | Email `licensing@ultralytics.com` in Phase 4-5 |
| Worker consent / PIPA (Alberta) | Required before ANY pilot deployment |
| No retry queue (S3/Twilio down) | Add queue + retry in Phase 5 |

---

## Model Details

- **Source:** VoxDroid/Construction-Site-Safety-PPE-Detection (MIT license for weights)
- **Architecture:** YOLOv8s, 200 epochs
- **Dataset:** Roboflow Construction Site Safety (2,801 images, 10 classes)
- **Reported metrics:** Precision 0.927, Recall 0.774, mAP@50 84.1%
- **10 classes:** Hardhat, Mask, NO-Hardhat, NO-Mask, NO-Safety Vest, Person, Safety Cone, Safety Vest, machinery, vehicle
- **Violation classes we alert on:** NO-Hardhat, NO-Safety Vest, NO-Mask
