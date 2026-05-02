# Cordon Safety Dashboard — Design System & Build Spec

> **Audience:** AI coding agents (Claude Code, Antigravity, Copilot) building the Cordon Safety supervisor dashboard. Also: humans who need to make design decisions.
>
> **Authority:** This document is the source of truth for visual design, component patterns, and aesthetic direction. If a request conflicts with this doc, follow this doc and flag the conflict.
>
> **Last updated:** April 30, 2026

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [The Five Commandments](#2-the-five-commandments)
3. [Design Tokens](#3-design-tokens)
4. [Typography System](#4-typography-system)
5. [Color System & Status Semantics](#5-color-system--status-semantics)
6. [Layout Architecture](#6-layout-architecture)
7. [The Hero — Status Word & Live Status](#7-the-hero--status-word--live-status)
8. [Component Patterns](#8-component-patterns)
9. [Motion & Animation Rules](#9-motion--animation-rules)
10. [Tech Stack & Library Choices](#10-tech-stack--library-choices)
11. [What NOT to Build](#11-what-not-to-build)
12. [Reference Implementations](#12-reference-implementations)
13. [Build Order for Phase 4](#13-build-order-for-phase-4)

---

## 1. Design Philosophy

Cordon Safety watches a real workplace where real people could get hurt. The dashboard must communicate this seriousness instantly. It is **not** a generic B2B SaaS app. It is a **mission-critical operations console**.

### The aesthetic direction: Industrial Precision

Think **Bloomberg Terminal × Linear × Air Traffic Control Console**. Confident, professional, no decoration that doesn't earn its place. Every pixel says "this software is in production at a real construction site."

**Three words that define every design decision:**
- **Precise** — exact alignment, monospace numerics, no fuzzy edges
- **Calm** — high signal, low noise; color used sparingly so it MEANS something
- **Cinematic** — bold negative space, dramatic typography hierarchy, atmospheric darkness

### The user reality

The dashboard is opened by:
- **A site supervisor** at 7am for a 5-second glance, then again throughout the day for triage
- **A safety manager** weekly for trend review and COR audit prep
- **An executive** monthly for risk reporting

This is a **glance tool with depth on demand**, not a place where someone spends 8 hours a day. Optimize for **immediate clarity in 5 seconds**, not for long sessions.

---

## 2. The Five Commandments

These are non-negotiable. If a design decision violates one of these, it's wrong.

1. **Dark-first, not dark-toggled.** All design decisions assume a near-black background. Light mode is a future concern (Phase 5+).
2. **No gray dividers.** Hierarchy is created through luminosity (surface elevation) and negative space, never through gray border lines between sections.
3. **Color = status, never decoration.** If a UI element is colored, it must communicate operational state. No "brand" colors splashed for vibe.
4. **Monospace for all numerics.** Every timestamp, count, percentage, confidence score uses a monospace font. Tabular alignment is mandatory.
5. **Five seconds to answer "should I be worried?"** The hero of the dashboard answers this question without scrolling, without interpretation. If a supervisor needs more than 5 seconds to know the day's status, the design has failed.

---

## 3. Design Tokens

These are CSS custom properties to define in `globals.css` and reference everywhere.

```css
:root {
  /* === SURFACES (luminosity-based hierarchy, no borders) === */
  --surface-base:     #0A0B0F;  /* page background */
  --surface-card:     #13151B;  /* card background */
  --surface-elevated: #1A1D26;  /* hover state, modal */
  --surface-inset:    #08090C;  /* input fields, sunken */

  /* === TEXT === */
  --text-primary:     #F4F5F7;  /* headlines, key data */
  --text-secondary:   #9CA3AF;  /* labels, metadata */
  --text-tertiary:    #5B6172;  /* placeholder, disabled */
  --text-on-status:   #0A0B0F;  /* text on color-filled status badges */

  /* === STATUS COLORS (use sparingly, semantically) === */
  --status-safe:      #00D9A3;  /* green — all clear */
  --status-warning:   #FFB020;  /* amber — active alert */
  --status-critical:  #FF4747;  /* red — escalation needed */
  --status-resolved:  #3D8C7D;  /* muted teal — past, complete */
  --status-info:      #4AA3FF;  /* blue — neutral data, charts */

  /* === STATUS BACKGROUNDS (10% opacity for fills) === */
  --status-safe-bg:     rgba(0, 217, 163, 0.1);
  --status-warning-bg:  rgba(255, 176, 32, 0.1);
  --status-critical-bg: rgba(255, 71, 71, 0.1);

  /* === SPACING (8px base) === */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;

  /* === RADIUS === */
  --radius-sm: 4px;   /* badges, tags */
  --radius-md: 8px;   /* buttons, inputs */
  --radius-lg: 12px;  /* cards */
  --radius-xl: 16px;  /* hero panels */

  /* === ELEVATION (shadows for depth, not borders) === */
  --shadow-card:     0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-modal:    0 24px 64px rgba(0, 0, 0, 0.7);
  --shadow-glow-safe:    0 0 32px rgba(0, 217, 163, 0.15);
  --shadow-glow-warning: 0 0 32px rgba(255, 176, 32, 0.2);
  --shadow-glow-critical: 0 0 48px rgba(255, 71, 71, 0.3);

  /* === MOTION === */
  --duration-instant: 100ms;
  --duration-fast:    180ms;
  --duration-normal:  280ms;
  --duration-slow:    480ms;
  --ease-out:         cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:      cubic-bezier(0.65, 0, 0.35, 1);
}
```

**Tailwind v4 integration:** in `globals.css`, after `@import "tailwindcss"`, add `@theme inline { --color-surface-base: var(--surface-base); ... }` so utilities like `bg-surface-base` work.

---

## 4. Typography System

### Font choices

- **Display + Body:** [Geist](https://vercel.com/font) (free, via `next/font/google` as `Geist`)
- **Numerics + Code:** [Geist Mono](https://vercel.com/font) (free, via `next/font/google` as `Geist_Mono`)

These pair perfectly because they share design DNA. Do not introduce a third font. **Specifically forbidden: Inter, Roboto, Arial, system-ui defaults** — these are the "AI slop" fonts of 2026 and instantly read as generic.

### Type scale

| Token          | Size | Line height | Weight | Use                                                    |
| -------------- | ---- | ----------- | ------ | ------------------------------------------------------ |
| `text-status`  | 96px | 1           | 600    | The hero status word (ALL CLEAR / ACTIVE ALERT)        |
| `text-display` | 56px | 1.1         | 600    | Page-level numbers (today's count)                     |
| `text-h1`      | 32px | 1.2         | 600    | Section headers                                        |
| `text-h2`      | 24px | 1.3         | 600    | Card titles                                            |
| `text-h3`      | 18px | 1.4         | 500    | Sub-headers                                            |
| `text-body`    | 14px | 1.5         | 400    | Default body                                           |
| `text-meta`    | 12px | 1.4         | 400    | Labels, timestamps, metadata                           |
| `text-micro`   | 10px | 1.2         | 500    | Status badges, tags (UPPERCASE, letter-spacing 0.08em) |

### Typography rules

- **All numerics use Geist Mono** with `font-variant-numeric: tabular-nums`. This means counts, timestamps, confidence scores, percentages, durations, IDs.
- **Letter spacing:** display sizes (32px+) use `-0.02em` (tighter); micro/meta sizes use `+0.01em` to `+0.08em` (wider for legibility).
- **Never more than 3 type sizes visible on screen at once** in the same area. Use scale to create hierarchy, not for variety.
- **Status word breathes:** the hero `text-status` value should pulse at 0.96–1.0 opacity over 2.4s when status is `warning` or `critical`. Never animate when `safe`.

---

## 5. Color System & Status Semantics

### The semantic mapping

Every visible color must map to a state. Color is a UI affordance, not decoration.

| State        | When                                            | Color token         | Visual treatment                                   |
| ------------ | ----------------------------------------------- | ------------------- | -------------------------------------------------- |
| **Safe**     | No active violations in last 60s                | `--status-safe`     | Hero word green, subtle glow                       |
| **Warning**  | 1+ active violations, < 5 min old               | `--status-warning`  | Hero word amber, breathing animation               |
| **Critical** | 3+ active violations OR critical violation type | `--status-critical` | Hero word red, faster breathing, slight glow pulse |
| **Resolved** | Past violation, marked complete                 | `--status-resolved` | Muted teal text, checkmark icon                    |
| **Info**     | Counts, charts, neutral data                    | `--status-info`     | Used in chart strokes, info badges                 |

### The 80/20 rule for color

- **80% of the screen** is `--surface-*` (dark backgrounds) and `--text-*` (off-white text)
- **20% of the screen** is status color, and only where it earns its place

If you find yourself adding a 3rd or 4th color "for variety," delete it. The dashboard's drama comes from **negative space + selective color**, not from a colorful palette.

### Status backgrounds

When showing a status pill or filled badge, use the `*-bg` variants (10% opacity). Example:

```tsx
<span className="bg-status-warning-bg text-status-warning px-2 py-1 rounded-sm text-micro">
  ACTIVE
</span>
```

This creates a colored chip that's visible without screaming.

---

## 6. Layout Architecture

### The desktop layout (1280px+)

```
┌────┬────────────────────────────────────────┬─────────────┐
│    │                                        │             │
│ N  │  HERO                                  │  DETAIL     │
│ A  │  (status word, today's metrics)        │  PANEL      │
│ V  │                                        │             │
│    │  ───────────────────────────────────   │  (slides in │
│ 60 │                                        │   from right│
│ px │  LIVE FEED                             │   when a    │
│    │  (recent violations as cards)          │   violation │
│ ic │                                        │   is        │
│ on │  ───────────────────────────────────   │   clicked)  │
│ s  │                                        │             │
│    │  CHARTS                                │   ~400px    │
│    │  (today by hour, by camera)            │             │
│    │                                        │             │
└────┴────────────────────────────────────────┴─────────────┘
```

### The rules

- **No top header bar.** The thin nav rail is the global navigation. Saves vertical space and feels modern.
- **Left nav rail is 60px wide, icon-only.** Tooltip on hover for label. Never expand to a sidebar.
- **Main content is single column** with sections separated by generous vertical space (`space-12` minimum), not by horizontal lines.
- **Detail panel slides in from right** as a 400px wide overlay panel when a violation is clicked. It does NOT replace the page content — main content stays visible to the left. No modals.
- **Mobile (<768px):** stack vertically. Nav rail becomes a bottom tab bar. Detail panel becomes a full-screen drawer that slides up.

### What lives in the nav rail

Six icons, top to bottom:
1. Live (current view) — `Activity` icon from lucide
2. History — `Clock` icon
3. Cameras — `Video` icon
4. Reports — `FileText` icon
5. Settings — `Settings` icon (bottom)
6. User avatar (very bottom)

A 1px subtle indicator shows the active route. No background fills, no border between rail and content.

---

## 7. The Hero — Status Word & Live Status

This is the single most important component. If this looks bad, the whole dashboard fails. If this looks great, the rest of the dashboard inherits credibility.

### Visual spec

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                                                      │
│                  ALL CLEAR                           │  ← 96px, Geist 600
│                                                      │     status color
│                                                      │     (breathes if not safe)
│                                                      │
│  LAST VIOLATION       ACTIVE CAMERAS   TODAY         │  ← 12px label, secondary text
│  ──────────────       ──────────────   ─────         │
│  2h 47m               4 / 4            12            │  ← 56px, Geist Mono 600
│                                                      │     primary text
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Behavior

- The status word transitions between states with a 480ms fade + scale (1.0 → 0.95 → 1.0). Never snap.
- When status is `warning` or `critical`, the word pulses opacity 0.96 → 1.0 → 0.96 over 2.4s, infinite. Use `animate-pulse-status` custom keyframe.
- "Last violation" updates every second client-side (no server round-trip). Format as `2h 47m`, `12m 04s`, `47s`. Use `date-fns` formatDistance or roll your own.
- The three sub-metrics use Geist Mono with tabular-nums.
- Numbers update with a subtle slide animation when they change (Framer Motion `<motion.span>` with `key` based on the value).

### Code shape (reference, not literal)

```tsx
<section className="px-12 py-16">
  <h1 className={cn(
    "text-status font-display tracking-tight transition-all duration-slow",
    status === 'safe' && "text-status-safe",
    status === 'warning' && "text-status-warning animate-pulse-status",
    status === 'critical' && "text-status-critical animate-pulse-status-fast"
  )}>
    {statusWord}
  </h1>
  
  <div className="mt-12 grid grid-cols-3 gap-8 max-w-2xl">
    <Metric label="LAST VIOLATION" value={timeSinceLast} />
    <Metric label="ACTIVE CAMERAS" value={`${activeCameras} / ${totalCameras}`} />
    <Metric label="TODAY" value={todayCount} />
  </div>
</section>
```

---

## 8. Component Patterns

### Cards

```tsx
<div className="bg-surface-card rounded-lg p-6 shadow-card">
  {/* No border. Card is defined by its surface luminosity vs base. */}
</div>
```

**Hover state:** background lifts to `--surface-elevated`, transition 180ms ease-out. No transform, no scale, no shadow change. Just a luminosity shift.

### Violation Card (the live feed item)

```
┌──────────────────────────────────────────────┐
│ [photo thumb]  NO HARDHAT          14:32:08  │  ← thumb 64×64, label uppercase 12px,
│  64×64         Camera 1 · Site A   2m ago    │     timestamp Geist Mono
│  rounded                                     │
│                                              │
│                          [● ACTIVE]    [→]   │  ← status pill, action arrow
└──────────────────────────────────────────────┘
```

- Photo is `--radius-md`, with 1px inner border in `--surface-elevated` (subtle definition without a line)
- Click anywhere on the card opens the detail panel
- Active violations have left edge accent: 3px `--status-warning` bar inset 8px from left, 8px from top/bottom

### Status Pills

```tsx
<span className="bg-status-warning-bg text-status-warning px-2 py-0.5 rounded-sm text-micro tracking-wider uppercase font-medium">
  Active
</span>
```

A small dot can prefix: `●` rendered in the same color, slightly larger than the text.

### Buttons

Three variants only:
- **Primary action:** `bg-text-primary text-surface-base` (inverted — white button on dark bg). Use sparingly, max one per screen.
- **Secondary:** `bg-surface-elevated text-text-primary`. Default for most actions.
- **Ghost:** transparent bg, `text-text-secondary`, hover background to `--surface-card`.

Never use status colors for button backgrounds. Reserve those for status display.

### Tables

- No vertical lines.
- No alternating row backgrounds (no zebra striping).
- 1px horizontal divider between rows in `--surface-elevated` color (very subtle).
- Header row: `text-meta` uppercase, `text-secondary` color, `tracking-wider`.
- Data cells: tabular-nums Geist Mono for numerics; Geist for text.

### Charts

Use Recharts but **strip every default style**:
- No grid lines (or very subtle dotted in `--surface-elevated`)
- No axis lines
- Tick labels in `text-meta` size, `text-tertiary` color
- Line strokes 1.5px in `--status-info`
- Bar fills in `--status-warning` for violations, `--status-resolved` for resolved
- Tooltip in `--surface-elevated` background, no border, `--shadow-elevated`

### Inputs

```tsx
<input className="bg-surface-inset rounded-md px-4 py-2 text-body text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-status-info" />
```

Sunken (darker than card surface), no border, focus uses a 1px ring not a thick border.

---

## 9. Motion & Animation Rules

Motion is used **only when it adds meaning**. Animation for its own sake is junk food.

### Allowed animations

| Animation                            | When                                | Duration            | Easing      |
| ------------------------------------ | ----------------------------------- | ------------------- | ----------- |
| Status word fade+scale on transition | Status changes safe→warning etc.    | 480ms               | ease-out    |
| Status word breathing pulse          | Status is warning or critical       | 2400ms infinite     | ease-in-out |
| Number tick on metric change         | Today's count, last violation timer | 280ms               | ease-out    |
| Detail panel slide in from right     | Violation card clicked              | 280ms               | ease-out    |
| Card hover luminosity shift          | Mouse over card                     | 180ms               | ease-out    |
| Toast notification slide+fade        | Backend event (new violation)       | 280ms in, 180ms out | ease-out    |
| Skeleton placeholder shimmer         | Loading state                       | 1500ms infinite     | linear      |

### Forbidden animations

- Anything that bounces
- Page transitions on route change
- Scroll-triggered reveals
- Decorative hover effects (rotations, color flashes)
- Spinners (use skeleton placeholders instead)
- Confetti or celebrations
- Parallax

### Implementation

Use Framer Motion (`motion/react` in v12+) for React-side animations. Use CSS `animation` keyframes for pure decorative pulses. Never use both for the same element.

```css
@keyframes pulse-status {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.96; }
}
.animate-pulse-status {
  animation: pulse-status 2.4s ease-in-out infinite;
}
```

---

## 10. Tech Stack & Library Choices

Locked in. Do not deviate without explicit approval.

| Layer           | Choice                                                      | Notes                                                             |
| --------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Framework       | Next.js 15 App Router                                       | Server components by default, client components only where needed |
| Styling         | Tailwind CSS v4                                             | CSS-first config in `globals.css`, no `tailwind.config.js`        |
| Components      | shadcn/ui                                                   | **Behavior only — restyle every component to match this doc**     |
| Icons           | lucide-react                                                | Consistent, free, tree-shakeable                                  |
| Fonts           | Geist + Geist Mono                                          | Via `next/font/google`                                            |
| Motion          | motion/react (Framer Motion v12)                            | Sparingly, per Section 9                                          |
| Charts          | Recharts                                                    | Heavily restyled per Section 8                                    |
| Auth            | Supabase Auth (magic links)                                 | No passwords for MVP                                              |
| Realtime        | Supabase Realtime                                           | Already proven on GridSync                                        |
| Deployment      | AWS Amplify                                                 | Matches PatrolPrep architecture                                   |
| State           | React Server Components + small `useState` for client state | No Zustand/Redux for MVP                                          |
| Date formatting | date-fns                                                    | Lighter than moment, tree-shakeable                               |
| Class merging   | `clsx` + `tailwind-merge` (via `cn()` utility)              | Standard shadcn pattern                                           |

### What gets installed

```bash
npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir
cd dashboard
npx shadcn@latest init
npx shadcn@latest add button card dialog badge separator scroll-area sheet
npm install @supabase/supabase-js @supabase/ssr
npm install motion lucide-react date-fns recharts
npm install clsx tailwind-merge
```

`sheet` from shadcn is what we use for the detail panel slide-in.

---

## 11. What NOT to Build

If a request comes in for any of these, push back. Explicitly out of scope for Phase 4 / Demo Day MVP:

- Light mode toggle (Phase 5+)
- User roles/permissions UI (single role, RLS handles it)
- Settings page beyond a single hardcoded view
- Multi-tenant org switcher
- Multi-site dashboard (single site for MVP)
- Custom violation rule builder
- PDF export for COR audits (Phase 5+)
- Mobile native app (responsive web only)
- Notifications inbox UI (alerts go to SMS/email, not in-app)
- Onboarding tour / tooltips
- Marketing landing page (separate Phase 5 task)
- Search bar (no data volume yet to justify it)
- User avatar uploads
- Themes / customization
- Anything with the word "AI assistant" in the UI (we ARE the AI; no chat bot inside our own product)

---

## 12. Reference Implementations

When in doubt about a specific UI choice, look at how these products handle it:

| Reference                                                                                                | What to learn from it                                              |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Linear.app](https://linear.app)                                                                         | Restraint, monochromatic palette, command palette pattern, density |
| [Vercel Dashboard](https://vercel.com/dashboard)                                                         | Dark surface elevation, monospace data, chart styling              |
| [Raycast](https://raycast.com)                                                                           | Keyboard-first feel, premium typography, micro-interactions        |
| [Bloomberg Terminal screenshots](https://www.google.com/search?q=bloomberg+terminal+screenshot&tbm=isch) | Dense data done right, mono numerics, status color usage           |
| [Datadog dashboards](https://www.datadoghq.com/dashboards/)                                              | Operational console aesthetic, alert hierarchy                     |

When the AI agent is unsure how to render something, the answer is almost always: **"how would Linear or Vercel do it?"** Then do that, but with our specific status palette.

---

## 13. Build Order for Phase 4

**Estimated total: 4-6 hours with AI assistance, your i9 + 4080, Cursor + Copilot.**

### Step 1: Project setup (30 min)
- `create-next-app` with the flags above
- Install all dependencies from Section 10
- Set up `globals.css` with all design tokens from Section 3
- Configure Geist + Geist Mono via `next/font/google` in `app/layout.tsx`
- Add the `cn()` utility in `lib/utils.ts`

### Step 2: Auth + Supabase setup (30 min)
- Set up Supabase client wrappers (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
- Add env vars to `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Build a single `/login` page with magic link
- Set up RLS-aware middleware to redirect unauthenticated users

### Step 3: The shell (45 min)
- `app/dashboard/layout.tsx` with the nav rail (60px icon-only, 6 lucide icons)
- Hardcode active route highlight
- No content yet, just the chrome
- Verify on mobile (nav becomes bottom tab bar)

### Step 4: The Hero (60 min)
- Build `<StatusHero />` component
- Server component fetches violation count + last violation time from Supabase
- Client subcomponent for the breathing animation + live timer
- Three metrics below in a 3-col grid
- This is the most important component. Spend the time. Get it right.

### Step 5: The live feed (60 min)
- Build `<ViolationFeed />` component (client component, "use client")
- Initial fetch of last 50 violations
- Subscribe to Supabase Realtime, prepend new violations as they arrive
- Each violation renders as a `<ViolationCard />` per Section 8

### Step 6: The detail panel (45 min)
- Use shadcn `<Sheet />` component, restyled to match design tokens
- Slides in from right, 400px wide on desktop
- Shows full image (S3 signed URL), metadata, resolve buttons
- Resolved/false-positive workflow updates Supabase

### Step 7: Charts (45 min)
- One bar chart: violations by hour for today
- One donut: violations by type for last 7 days
- Use Recharts, strip every default style per Section 8
- Wrap in `<ChartCard />` component for consistent padding

### Step 8: Polish pass (30 min)
- Verify all numerics use Geist Mono with tabular-nums
- Verify no gray dividers anywhere
- Verify status word breathes when warning/critical
- Verify detail panel slide is smooth (280ms ease-out)
- Run through the dashboard in different states (no violations, 1 active, 5 active)

### Step 9: Demo mode (30 min)
- A button somewhere that loads pre-seeded fake violations
- Critical for Demo Day when you can't run the webcam live in front of an audience
- Pre-seed 8-12 violations across the last 4 hours so the dashboard looks "lived in"

### Step 10: Deploy to Amplify (30 min)
- Push to GitHub
- Connect Amplify to the `dashboard/` folder
- Add env vars in Amplify console
- Verify production build works
- Custom domain setup (deferred to Phase 5 if time tight)

---

## Final Notes for AI Agents

1. **Read this entire doc before writing any UI code.** Skimming will produce generic output. The specifics are the design.
2. **When in doubt, restraint wins.** Remove an element rather than add one.
3. **No comments like `// Beautiful animation`** in the code. The design speaks for itself.
4. **Check every component against The Five Commandments (Section 2)** before considering it done.
5. **If you generated something that looks like a generic Bootstrap admin template, delete it and start over.** That's the failure mode we're avoiding.

---

**Document version:** 1.0  
**Owners:** Manraj Singh Wazir (architecture), Xavion Dean (post-MVP product input)  
**Status:** Approved for Phase 4 build