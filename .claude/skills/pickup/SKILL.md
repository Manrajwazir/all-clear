---
name: pickup
description: Orient at the start of a session - report where the work stands, what is blocked, and what the next action is, without the user having to explain any of it. Use when the user says "where were we", "what's next", "continue", "pick up", or opens a session cold after time away.
---

# Pick up where the last session stopped

The user should never have to explain the state of their own project. Work it
out, then report it.

## Read these, in this order, and stop

1. `D:\all-clear\all-clear-internal\docs\START_HERE.md` — **the "Right now"
   section only.** It is the designed pick-up point and is kept current.
2. `D:\all-clear\all-clear-internal\docs\CMPUT401_HANDOVER_PLAN.md` §9 — the
   authoritative progress table, if the current work is the student handover.
3. `git log --oneline -8` in **both** repos:
   - `D:\all-clear\all-clear` (code, branch `staging`)
   - `D:\all-clear\all-clear-internal` (docs + migrations, branch `main`)
4. `git status --short` in both — uncommitted work is usually where the last
   session stopped mid-thought.

Do not read the whole plan. It is ~1,100 lines and §9 exists so you don't have to.

## Then report, in this shape

- **Where things stand** — two or three lines, not a recap of history.
- **What is blocked, and on whom.** Separate "Manraj has to do this" from
  "Claude can do this now". That distinction is the single most useful thing in
  the report.
- **The next concrete action**, named specifically. Not "continue Stage D" —
  "build the trimmed tree (D2), which needs the GitHub repo to exist first".
- **Anything uncommitted**, and whether it looks finished or mid-edit.

## Check before trusting a document

Docs in this project have drifted before, badly enough that two files once
asserted opposite things about whether RLS existed. If a status claim matters to
what happens next, verify it against the actual code or database rather than
repeating it. Say which you did.

## Do not

- Do not start work. Report, then wait. The user decides what happens next.
- Do not summarise what was already explained in an earlier session. They were
  there.
