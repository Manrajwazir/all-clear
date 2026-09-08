---
name: commit-report
description: Explain a change in this project's standing format - WHAT / WHY / HOW IT CONNECTS / WHAT IF SKIPPED / YOUR TEST, technical and plain at once. Use after making any commit, or when the user asks to have a change, migration, or piece of code explained.
---

# Explain a change the way this project expects

This format is a standing request, not a preference to re-confirm. Use it for
every commit and for any substantial explanation.

## The five headings

**WHAT** — what changed, concretely. Files and behaviour, not intentions.

**WHY** — the problem it solves. Name the *failure* it prevents, not the feature
it adds. "Four developers each had to remember one line" beats "improves
consistency".

**HOW IT CONNECTS** — what else in the system this touches, and what now depends
on it. This is where someone learns the architecture rather than the diff.

**WHAT IF SKIPPED** — what would have happened, specifically, if this had not
been done. If the honest answer is "very little", say so; not everything is
load-bearing and pretending otherwise makes the important ones cheaper.

**YOUR TEST** — how *the user* can verify it themselves. A command they can run
or a screen they can look at. Not "I verified it" — something they can do.

Then close with:
- **What's now true** — the state after the change.
- **What's still unprotected** — what this deliberately did *not* fix. Never
  leave this out; it is how scope stays honest.

## Both framings, always

The user is an engineer and wants the technical detail. They also want to
actually understand it. That is one requirement, not two:

> **Keep the technical framing — but explain every technical term the moment it
> appears.** Not a glossary at the end, not a simplified parallel version. The
> real explanation, with the jargon defined inline as it is used.

A term like *dynamic import*, *percent-encoded*, *LATERAL join* or *RLS policy*
gets one clause of plain explanation the first time it appears, then gets used
normally.

## Step-by-step means assuming nothing

When the user has to do something themselves — a console click, a command, a
dashboard setting — give numbered steps that assume no prior knowledge. Name the
menu, the tab, the button. "Settings → Database → Connection string → Session
pooler tab", not "get the connection string".

## Report failures as failures

If tests failed, say so and show the output. If a step was skipped, say which
and why. If something is done and verified, say it plainly without hedging. Do
not describe an unverified thing as verified.

## Then stop

After explaining a commit, **stop and wait.** Do not begin the next piece of
work. "continue" from the user means: push the current commit, then start the
next one.
