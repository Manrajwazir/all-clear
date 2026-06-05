# All Clear

PPE compliance monitoring for construction sites, powered by computer vision. Detects missing hard hats, vests, and masks in real time via YOLOv8s, logs violations to Supabase with S3 snapshots, and alerts supervisors via SMS.

## Quick Start

### Detection Service (Python)
```powershell
.\venv\Scripts\Activate.ps1
cd detection
python src/main.py
```

### Dashboard (Next.js 15)
```powershell
cd dashboard
npm install
npm run dev    # http://localhost:3000
```

## Architecture

```
Edge Device (Jetson / laptop)        Cloud
┌─────────────────────────┐     ┌──────────────────────┐
│  OpenCV → YOLOv8s       │     │  Supabase (Postgres)  │
│  Debounce + Cooldown    │────▶│  AWS S3 (ca-central-1)│
│  Local retry queue      │     │  Twilio SMS           │
└─────────────────────────┘     └──────────┬───────────┘
                                           │ Realtime
                                    ┌──────▼──────────┐
                                    │  Next.js 15     │
                                    │  Dashboard      │
                                    │  (AWS Amplify)  │
                                    └─────────────────┘
```

## Documentation

| File | Description |
|------|-------------|
| `pilot-build-pathway.md` | Production-ready implementation plan (7 phases) |
| `CLAUDE.md` | LLM agent context file |
| `docs/all_clear_architecture.md` | Full system architecture reference |
| `docs/dashboard-design.md` | Dashboard design system spec |
| `docs/all_clear_pre_pilot_acceptance_checklist.md` | Pre-pilot verification checklist |
| `docs/schema.sql` | Current database schema (v1) |
| `docs/NOTES.md` | Build log, gotchas, and interview prep |
| `docs/PROOF.md` | Market and technology validation evidence |

## License

AGPL-3.0 (Ultralytics framework). Commercial license pending.
