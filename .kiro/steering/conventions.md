# Conventions & Hard Rules

Rules that hold regardless of task. Breaking one is a defect, not a style choice.

## Determinism

Identical input must produce **byte-identical** output.

- No `Math.random`. No timestamps, wall-clock reads, or global counters in ids or output.
- No dependence on filesystem iteration order, `Object.keys` order, or `Set`/`Map` insertion order for
  anything that reaches an artifact.
- Community detection runs **seeded**, over **canonically-sorted** nodes and edges.
- Group ids are content-addressed.
- Ties break on a stable key (id), never on arrival order.

Anything that decides group membership must be deterministic and explainable from structure alone.
Non-deterministic inputs (model output, embeddings, heuristics with hidden state) may inform labels,
search, or summaries — never membership.

## The JSON contract

Additive changes are safe. Renaming or removing a field, or changing its meaning, is a breaking change
that needs an explicit decision recorded in `DECISIONS.md`.

Consumers join groups to decisions via `regionId` / `ordinal` / `groupIds`. Never reconstruct that
relationship from paths or package prefixes.

## Package boundaries

Engine (`parser`, `core`, `shared`) must not import from ecosystem packages (`cli`, `web`, `ui`,
`api-client`). Check this before adding an import.

## Code

- Match the surrounding file's existing style, naming, and error-handling patterns before introducing
  anything new.
- Prefer explicit over clever. These artifacts get audited.
- No em dashes in generated code comments or commit messages.

## Commits

`type(scope): summary` — lowercase, imperative, no trailing period, under ~70 characters.

- Code under `packages/`: `feat` · `fix` · `test` · `refactor` · `perf` · `chore`
- Specs, steering, hooks, agents, skills, memory files: `kiro(scope):`
- Documentation only: `docs:`

**Granularity:** one commit per observable sub-behaviour, each independently building and passing. A
commit that does not build is not a rollback point.

Project-memory and docs changes belong on `main`. If the current branch is a feature branch and the only
changes are memory/doc files, say so rather than committing them there.

## Git operations

Ordinary commits are fine when asked. **Milestone operations are owner-driven and must never be run
unprompted:** merges to `main`, tags, branch creation or deletion, pushes, rebases, force-push,
`reset --hard`, `--no-verify`. Stage explicit paths; never `git add .`.

## Honesty in records

- Record only work that actually happened. Never fabricate progress, results, dates, or test counts.
- Label estimates as estimates. Report measured numbers only when they were measured in this session or
  are cited from a recorded measurement.
- "The command exited 0" is not evidence a task succeeded. Verify the actual output.
- If something could not be verified, say so explicitly.

## Timestamps

Before writing any date or time into a memory file, run:

```
Get-Date -Format 'yyyy-MM-dd HH:mm'
```

Use that real value. Never reuse the conversation's start date — sessions span multiple days.

## Shell

Windows. The shell does not accept `&&` as a separator; use `;`. Never `cd` — pass a working directory
instead. Never start long-running processes (dev servers, watchers) as blocking commands.
