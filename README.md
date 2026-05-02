# Cordon Safety

AI-powered construction safety monitoring. Detects PPE violations in real time via YOLO, logs them to Supabase, saves snapshots to S3, and texts the supervisor.

## Quick Start

### Detection Service (Python)
```powershell
.\venv\Scripts\Activate.ps1
cd detection
python src/main.py
```

### Dashboard (Next.js)
```powershell
cd dashboard
npm install
npm run dev    # http://localhost:3000
```

## Documentation

All docs are in `docs/`:
- `BUILD_PATHWAY.md` — full 14-day build plan (root level)
- `CLAUDE.md` — AI agent context file (root level)
- `dashboard-design.md` — design system spec
- `PHASE_4_HANDOFF.md` — dashboard setup instructions
- `schema.sql` — Supabase database schema
- `NOTES.md` — learning log
- `PROOF.md` — market validation evidence
- `QUESTIONS.md` — open research backlog
