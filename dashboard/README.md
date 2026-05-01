# SiteIQ Dashboard

Next.js 15 supervisor dashboard for the SiteIQ MVP. Built per [docs/dashboard-design.md](../docs/dashboard-design.md).

## What's wired up

| Step | Feature                            | File(s)                                          |
| ---- | ---------------------------------- | ------------------------------------------------ |
| 1    | Tailwind v4 + design tokens        | `app/globals.css`                                |
| 1    | Geist + Geist Mono fonts           | `app/layout.tsx`                                 |
| 2    | Supabase SSR client + middleware   | `lib/supabase/*`, `middleware.ts`                |
| 2    | Magic-link login + auth callback   | `app/login/`, `app/auth/callback/route.ts`       |
| 3    | 60px nav rail + bottom tab mobile  | `components/layout/NavRail.tsx`                  |
| 4    | Status hero + breathing animation  | `components/hero/StatusHero.tsx`                 |
| 4    | Live "last violation" timer        | `components/hero/LiveTimer.tsx`                  |
| 5    | Realtime violation feed            | `components/feed/ViolationFeed.tsx`              |
| 5    | Violation cards                    | `components/feed/ViolationCard.tsx`              |
| 6    | Slide-in detail panel + resolve UI | `components/feed/DetailPanel.tsx`                |
| 7    | Hourly bar + by-type donut charts  | `components/charts/ViolationCharts.tsx`          |
| 9    | Demo mode bar + seeded data        | `components/feed/DemoModeBar.tsx`, `lib/demo-data.ts` |

## Local dev

```powershell
cd dashboard

# 1. Install deps (first run only)
npm install

# 2. Configure env
copy .env.local.example .env.local
# Then edit .env.local with your Supabase URL + anon key

# 3. Run
npm run dev
# Open http://localhost:3000 — you'll be redirected to /login
```

## What's deliberately not built (per design doc §11)

- Light mode toggle
- User roles UI / multi-tenant org switcher
- Settings page (placeholder only)
- PDF exports
- Search bar
- Notifications inbox
- Marketing landing page

## Deployment

Targets AWS Amplify. See [PHASE_4_HANDOFF.md](../docs/PHASE_4_HANDOFF.md) for the full post-build checklist.
