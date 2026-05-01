# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SiteIQ is a SaaS MVP that watches IP cameras on construction sites and detects PPE violations (missing hard hats, vests) in real time. Violations are logged to Postgres, snapshots uploaded to S3, and SMS alerts sent to the site supervisor. Target demo: May 12, 2026.

Two co-founders: Manraj (backend + cloud + ML co-owner) and Xavion (sales + ML lead post-MVP).

## Repository layout

```
detection/          # Python service — all CV/ML inference runs here
  src/
    main.py         # entry point; run from detection/ folder
    detector.py     # PPEDetector class wrapping YOLO
    debounce.py     # ViolationTracker (debounce + cooldown)
    storage.py      # Supabase insert + S3 upload
    alerts.py       # Twilio SMS + AWS SES digest
  models/           # YOLO weights (gitignored) — ppe_v1.pt lives here
  .env.example      # template for required env vars

dashboard/          # Next.js 15 (App Router) — not yet scaffolded fully
docs/               # architecture.md and api.md stubs
```

## Development commands

### Detection service (Python)

```powershell
# Activate venv (Windows)
cd detection
python -m venv venv          # first time only
venv\Scripts\activate

# Install dependencies (editable)
pip install -e ".[dev]"

# Run the detection entry point (from detection/ folder)
python src/main.py

# Run a standalone alert test
python src/alerts.py

# Lint
ruff check src/

# Run tests
pytest
```

All scripts must be run from `detection/` so that relative paths like `"models/ppe_v1.pt"` resolve correctly.

### Dashboard (Next.js — not yet scaffolded)

```powershell
cd dashboard
npm install
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

Bootstrap when ready:
```powershell
npx create-next-app@latest . --typescript --tailwind --app
npx shadcn-ui@latest init
```

## Architecture

The detection loop is the core: OpenCV captures frames → `PPEDetector.predict()` runs YOLO inference on CUDA → `PPEDetector.find_violations()` filters for negative classes (`NO-Hardhat`, `NO-Safety Vest`, `NO-Mask`) → `ViolationTracker.should_alert()` applies debounce + cooldown → on true, `upload_snapshot()` writes JPEG to S3 and `log_violation()` inserts a row into Supabase → `send_violation_sms()` fires Twilio SMS.

The dashboard subscribes to Supabase Realtime (Postgres logical replication over WebSocket) to get push updates without polling. Supervisors can mark violations as `resolved` or `false_positive`.

**Key design decisions:**
- `SUPABASE_SERVICE_ROLE_KEY` is used only in the Python backend (bypasses RLS). The dashboard uses `SUPABASE_ANON_KEY` only.
- S3 bucket is private — generate pre-signed URLs for dashboard image viewing.
- Debounce (5 frames ≈ 167ms at 30 FPS) and cooldown (60s) are separate: debounce filters frame noise, cooldown prevents alert fatigue.
- YOLO model is loaded once per process and reused (`model.to('cuda')` required for RTX 4080 speed).

## Environment variables

Copy `detection/.env.example` to `detection/.env` and fill in values. Never commit `.env`. Required keys:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (backend), `SUPABASE_ANON_KEY` (frontend only)
- `AWS_REGION` (default `ca-central-1`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_TO_NUMBER`
- `DETECTION_CONFIDENCE_THRESHOLD` (default 0.6), `DEBOUNCE_FRAMES` (default 5), `COOLDOWN_SECONDS` (default 60)

## Database schema (Supabase)

Three tables: `sites` → `cameras` → `violations`. The `violations` table is the product core. Enable Realtime on it:

```sql
alter publication supabase_realtime add table violations;
```

`violations.resolution_status` is one of: `pending`, `resolved`, `false_positive`.

## Known gaps (acceptable for MVP)

- No retry queue if S3 or Twilio is down — logs the error and continues.
- RLS not yet configured on Supabase — required before any production deployment.
- Single alert recipient hardcoded in env — no multi-recipient routing.
- AGPL-3.0 issue with Ultralytics YOLO — must resolve before customer #1 (email `licensing@ultralytics.com`).
- Worker consent / PIPA compliance required before any pilot deployment in Alberta.
