---
name: memory-sync
description: "Bring project memory up to date on purpose: PROJECT_STATE, DECISIONS, BRAIN. Use when the user asks to close out a session, log a decision, record what was done, or says memory is stale. Also use before handing work over."
---

# Memory Sync

Deliberate counterpart to the `sync-memory-on-stop` hook. The hook judges automatically at the end of
every turn; this skill is for when the user asks for it directly.

**The protocol is `.kiro/steering/memory.md`, which is always loaded. Follow it — do not restate it.**
This file covers only what is specific to a deliberate, requested sync.

## Read the interpretation right

The trigger phrasing tells you the scope:

| The user says | Do |
|---------------|-----|
| "update memory", "sync memory", "log this" | Full protocol over the work since memory was last accurate |
| "close out this session", "wrap up" | Full protocol, plus check that `Next up` would let a cold session resume without asking questions |
| "log decision ..." | DECISIONS entry only, unless state visibly drifted too |
| "memory is stale" | Audit first — read all three files against reality before writing anything |

## Deliberate sync differs from the hook in three ways

1. **Widen the window.** The hook sees one turn. When asked directly, cover everything since memory was
   last accurate — check `Last updated` in PROJECT_STATE and the final BRAIN entry against what has
   actually happened since. Multiple turns, or a whole session, may be unrecorded.

2. **Audit, don't just append.** Read PROJECT_STATE fully and challenge every line. Stale entries are
   worse than missing ones because they are read as current. Look specifically for:
   - work listed under *In progress* that has finished
   - *Next up* items already done, or made irrelevant by a decision
   - measured numbers whose underlying artifact has since been regenerated
   - risks that have been resolved, and new ones never written down
   - references to files that were moved or deleted

3. **Verify claims before recording them.** If PROJECT_STATE asserts a gate passes, and the turn touched
   anything that gate covers, run it rather than copying the old result forward. A stale green is the most
   expensive kind of wrong entry in this repo — one has already been found and corrected.

## Report back

State plainly which of the three files changed and which did not, and why. "No DECISIONS entry — the work
executed an existing decision" is a good answer. If you found and corrected a stale or false claim, say so
explicitly and name it; that is the most useful thing a sync can produce.

## Boundaries

- Never write to `docs/positioning/` or `docs/academic/`. `docs/academic/research-log.md` is
  approval-gated and requires the user to ask for it by name.
- Never edit or delete existing DECISIONS or BRAIN entries. Corrections are new entries.
- Never invent a timestamp, a test count, or a result. If something could not be verified, record that it
  could not be verified.
