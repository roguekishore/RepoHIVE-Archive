# Memory Protocol

Project memory lives in three files with three different write modes. Keeping them distinct is what
stops the memory from rotting.

| File | Mode | Holds | Read when |
|------|------|-------|-----------|
| `.kiro/PROJECT_STATE.md` | **rewritten** — stays short | Where the project is *now*: current position, measured numbers, what's done, what's next, open questions | **First, every session** |
| `.kiro/DECISIONS.md` | **append-only**, newest first | Every decision that constrains future work, with its reasoning and consequences | Before proposing anything that reverses or depends on a past choice |
| `.kiro/BRAIN.md` | **append-only**, oldest first | Per-session narrative: what was done, why, outcome, next | When you need history the state file has compressed away |

## What goes where

**PROJECT_STATE** answers "what is true right now." It is a snapshot, not a log. When something is
finished, the in-progress entry is *replaced*, not annotated. When a plan is superseded, the old plan text
is *deleted*, not struck through. Keep it under roughly 150 lines so it can be injected every session
without crowding out the task.

**DECISIONS** answers "why is it like this." One entry per decision: the date, what was decided, the
reasoning, and what it now constrains. Never edit or delete an entry — if a decision is reversed, add a
new entry that says so and references the one it supersedes. This is the file that prevents relitigating
settled questions and prevents accidentally undoing them.

**BRAIN** answers "what happened." Append at the bottom, stamped `YYYY-MM-DD HH:mm`, with
What / Why / Outcome / Next. Never edit or delete past entries, even wrong ones — a corrected entry is a
new entry.

## When to update

After **meaningful work**: files created, edited, or deleted; a decision made; a spec written; a feature
built; scope changed; a verification result obtained.

**Not** after: answering a question, reading code, diagnosing without changing anything, or chat. If
nothing meaningful happened, write nothing and say so in one line. An empty update is correct behaviour.

## How to update

1. **Timestamp.** Run `Get-Date -Format 'yyyy-MM-dd HH:mm'` for the real system date and time. Never
   reuse the conversation's start date.

2. **PROJECT_STATE — rewrite in place.** Update `Last updated`, then revise whichever of these no longer
   describe the present: *Current position*, *Verified state*, *Measured fixture results*, *Done*,
   *In progress*, *Next up*, *Open questions and known risks*. Delete superseded text; do not annotate or
   strike it through. When something finishes, replace its in-progress entry rather than adding a note
   beside it.

3. **DECISIONS — prepend, only if a real decision was made.** A decision is a choice that constrains
   future work. One entry at the top, below the header: date, what was decided, why, what it now
   constrains. If it reverses an earlier decision, say so and name the entry it supersedes. Do not add an
   entry for work that merely executed an existing decision.

4. **BRAIN — append at the bottom.** One entry stamped `YYYY-MM-DD HH:mm` with What / Why / Outcome /
   Next.

5. **New artifacts.** If a new package, app, spec, or experiment folder was created, note it in
   PROJECT_STATE and give its folder a short README describing purpose and status.

6. **Verification honesty.** If the turn changed code, record which gates from `verification.md` were
   actually run and their real results. If a gate was not run, name it and say why rather than implying it
   passed. If a determinism digest moved, **do not silently recapture it** — identify which field changed
   and why, record that in DECISIONS, and update the digest table in `verification.md` in the same change.

Record only what actually happened. Numbers must come from a run performed in this turn or a measurement
already recorded — never estimated and presented as measured. Never write to `docs/positioning/` or
`docs/academic/` as part of a memory update.

## Two ways this runs

- **Automatic:** the `sync-memory-on-stop` hook (`.kiro/hooks/`) fires at the end of every turn. It only
  triggers this protocol — the procedure above is the single source of truth, so the hook stays thin and
  cannot drift from it.
- **Deliberate:** the `memory-sync` skill, for when the user asks to close out a session, log a decision,
  or bring memory up to date on purpose. Same protocol, invoked knowingly.

The hook is a safety net, not a substitute. If you finish substantial work, update memory as part of the
work rather than leaving it to fire afterwards.

## Excluded from context

These folders are **deliberately not agent context**. Do not read them to inform engineering decisions,
and do not treat their framing as describing the project.

| Folder | What it is | Load only when |
|--------|------------|----------------|
| `docs/positioning/` | Vision, competitive analysis, roadmap narrative, performance claims | The user explicitly asks for positioning, pitch, or claim wording |
| `docs/academic/` | Coursework reviews, handouts, diary, research log, paper drafts | The user explicitly asks for that deliverable |

Both contain aspirational and comparative language written for an audience. Reading them as
specifications produces wrong inferences about what the project is and what may be built.

## External vault (optional)

A Basic Memory MCP is bound to the `personal` project (`D:\Vaults\personal-brain`) for durable
cross-project knowledge and per-task narrative. Use it when the user asks for task-record, ADR, or
hand-off workflows; the skills `task-researcher` and `handoff-generator` drive it. It is additive — the
three in-repo files above remain the source of truth for this project's state.
