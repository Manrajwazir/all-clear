# Phase 4 Handoff — Your Side

The dashboard codebase is complete. Ten steps from `dashboard-design.md §13` are written. Now you finish the parts only you can do: install deps, plug in real keys, verify it runs, deploy.

---

## 1 · Install dependencies

```powershell
cd D:\SiteIQ\SiteIQ\dashboard
npm install
```

Takes 60–120 seconds. Pulls in Next 15, React 19, Tailwind v4, Supabase SSR, Recharts, Motion, Lucide.

If `npm install` warns about peer deps, that's fine — Next 15 + React 19 + the libraries we picked are all compatible.

---

## 2 · Configure environment

```powershell
copy .env.local.example .env.local
```

Open `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the long anon JWT from Supabase → Settings → API>
```

**Important:** anon key only. Never put `SUPABASE_SERVICE_ROLE_KEY` in this file. Service role bypasses RLS and would be exposed to every browser visiting the dashboard.

---

## 3 · Verify Realtime is on

In Supabase SQL editor, confirm this row exists (you ran it in Phase 2 — just double-check):

```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'violations';
```

If that returns nothing, run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE violations;
```

Without this, the live feed will load but won't push new rows.

---

## 4 · First run

```powershell
npm run dev
```

Open `http://localhost:3000`. You should be redirected to `/login`.

1. Enter your email → click **Send magic link**.
2. Open the email. Click the link. It returns to `/auth/callback` and bounces you to `/dashboard`.
3. The hero shows **ALL CLEAR** (or **ACTIVE ALERT** if recent violations exist).
4. Click **Load demo data** to populate the feed with 10 fake violations and verify the visual states.

### What to verify against the Five Commandments

- [ ] Background is near-black, not gray (#0A0B0F)
- [ ] No horizontal gray lines anywhere — sections separated by space, cards by surface luminosity
- [ ] The only colors visible are status states + off-white text
- [ ] Every number (count, time, percent, ID) is in monospace and tabular-aligned
- [ ] Within 5 seconds you can answer "should I be worried?" — the hero word does it

If any commandment fails, that's a build bug — open a fresh chat.

---

## 5 · Run the detection service alongside

In a second terminal:

```powershell
cd D:\SiteIQ\SiteIQ
.\venv\Scripts\Activate.ps1
cd detection
python src/main.py
```

Walk in front of the webcam without a hard hat. Within ~5 seconds you should see:

1. The Python terminal log `ALERT type=no_hardhat …`
2. A new card slide into the dashboard's live feed (no page reload needed)
3. The hero word transition `ALL CLEAR → ACTIVE ALERT` with the breathing animation
4. The hourly chart tick up by 1 in the current hour

If the row appears in Supabase but **not** in the dashboard, Realtime isn't enabled (see step 3).

---

## 6 · Resolution workflow check

1. Click any violation card → detail panel slides in from the right
2. Click **Mark resolved** → panel closes, card's pill flips to **Resolved**
3. Refresh the page → the resolved status persists (stored in Supabase)

---

## 7 · Mobile check

Open Chrome DevTools → device toolbar → iPhone 15 Pro. Verify:

- Nav rail collapses to a bottom tab bar
- Hero stacks cleanly, status word still big
- Detail panel becomes full-screen drawer

---

## 8 · Deploy to AWS Amplify

1. Push the `dashboard/` folder to GitHub (the existing `cordon-safety` repo is fine — Amplify can target a subfolder)
2. Amplify Console → **Host web app** → connect GitHub → select repo + `main` branch
3. **Build settings** → set the app root to `dashboard` (under "Advanced")
4. **Environment variables** → add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as `.env.local`)
5. **Save and deploy** — first build takes ~4 min
6. Once green, open the `*.amplifyapp.com` URL and verify the same magic-link flow works

Custom domain (`dashboard.cordonsafety.app`) can wait until Phase 5.

---

## 9 · Known gaps to fix in Phase 5

These are intentionally out of scope right now — listed so you know they exist, not so you fix them today:

| Gap                                                | Phase   | Why deferred                                 |
| -------------------------------------------------- | ------- | -------------------------------------------- |
| S3 images served as raw URLs (private bucket)      | 4.5 / 5 | Need a `/api/signed-url` route               |
| No camera heartbeat — "active cameras" = registered | 5       | Real heartbeat tracking needs Phase 5+ work  |
| No RLS policies on Supabase tables                  | 5       | Single-tenant MVP; required before pilot     |
| No `/dashboard/history` archive view                | 5       | No data volume yet to justify it             |
| No auth.users → role mapping                        | 5       | Single role for MVP                          |

---

## 10 · If something is broken

The most likely failure modes, ranked:

1. **`Module not found: @supabase/ssr`** → you skipped `npm install`
2. **Login email never arrives** → check Supabase → Authentication → Logs. Likely "email rate limited" or wrong redirect URL. Whitelist `http://localhost:3000/auth/callback` in **Authentication → URL Configuration**
3. **Cards never appear in feed** → Realtime not enabled (step 3) OR your detection service is in `LOCAL LOG ONLY` mode (no Supabase writes happening)
4. **Hero shows "ALL CLEAR" but you have a recent violation** → cooldown logic in `lib/status.ts` only flags `pending` violations within the last 5 min. Older violations correctly stay green.
5. **TypeScript errors in editor on first open** → `npm install` finishes, then `Ctrl+Shift+P` → "TypeScript: Restart TS Server"
