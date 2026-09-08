---
name: handoff
description: Write the current state into the project's own documents so the next session can pick up cold, then commit. Use when the user says "log this", "we'll pick it up tomorrow", "I'm going to compact", or ends a working session.
---

# Log the state so the next session needs no explanation

The goal: someone (or some session) opening this project tomorrow with no memory
reads two files and knows exactly where things are. If they have to ask, this
skill did not work.

## Where state lives — do not invent a new file

| What | Where |
|---|---|
| **What to do next, in order** | `all-clear-internal/docs/START_HERE.md` → "Right now" section |
| **Detail of the current project** | its own plan doc, e.g. `docs/CMPUT401_HANDOVER_PLAN.md` §9 |
| **Decisions and open questions** | `docs/OPEN_ITEMS.md` |
| **Findings from live testing** | `docs/KNOWN_ISSUES.md` |
| **Architectural decisions** | `docs/decisions/` (ADRs — these win over everything else) |

Adding a new status file creates drift, which this project has been bitten by
before. Update the existing one.

## What to write

1. **Progress table** — what is done, what is next, dated. States, not prose.
2. **What is blocked, and on whom.** Split "Manraj must do this" from "Claude
   can do this now" — it is the most-used part of the log.
3. **Decisions waiting on a human.** If a question is open, record it as open.
   **Never resolve an open question by picking an answer.**
4. **Live environment facts** a cold session cannot infer: project refs, which
   pooler host, where credential files live, what the apply command is.
5. **Anything learned the hard way.** Bugs whose cause was non-obvious, tools
   that behave surprisingly. These are the highest-value lines in the whole log
   — they are what stops the next person losing the same afternoon.

## Accuracy rules

- Do not mark something complete because a document says so. Verify against the
  code or the database, and say which you did.
- Correct stale claims **visibly** — strike through and date them rather than
  quietly overwriting. Someone may have acted on the old text.
- Record what was *not* done alongside what was.

## Then commit

Commit message in this project's style: a plain-language first line saying what
changed and why it mattered, then the reasoning. Explain the *problem*, not just
the diff — these messages are read later as the real record.

End every message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: <this session's URL>
```

Push only if the user asked. Report what was committed and what remains
uncommitted.
