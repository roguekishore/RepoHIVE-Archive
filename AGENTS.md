# AGENTS.md

Front door for any AI agent working in this repository.

## What this is

RepoHIVE is a hierarchical codebase indexing engine. It turns a flat dependency graph into a navigable
multi-level hierarchy — Repository → Groups → Files → Functions — by measuring each region's structural
quality and deciding **per region** whether to preserve its existing package boundaries or reconstruct
them via community detection. Every decision is recorded, and the output is deterministic.

Pipeline: `parse` (Java tree → `graph.json`) → `group` (→ `index/*.json`) → `view` (Next.js viewer).

## Read order

| # | File | Why |
|---|------|-----|
| 1 | `.kiro/PROJECT_STATE.md` | Where the project is now, what is verified, what is next |
| 2 | `.kiro/steering/*` | Auto-loaded every session: architecture, stack, conventions, verification, memory |
| 3 | `.kiro/DECISIONS.md` | Why things are the way they are. Read before reversing or building on a past choice |
| 4 | `.kiro/specs/*` | Per-phase specs (requirements → design → tasks); source of truth for numbered requirements and properties |
| 5 | `.kiro/BRAIN.md` | Append-only session history, when you need detail the state file has compressed away |

Steering files are facts and rules only. If one disagrees with the code, the code wins — fix the steering
file in the same change.

## Do not load as context

| Path | Contains | Load only when |
|------|----------|----------------|
| `docs/positioning/` | Vision, competitor comparisons, roadmap narrative, claim wording | The user explicitly asks for positioning or pitch work |
| `docs/academic/` | Coursework reviews, handouts, diary, research log, paper drafts | The user explicitly asks for that specific deliverable |

Both are written for an audience and are aspirational or deadline-bound. Reading them as specifications
produces wrong conclusions about what the project is and what may be built. Each folder has a README
explaining what is authoritative instead.

Large working registers — `.kiro/gaps.md`, `.kiro/fixes.md`, `.kiro/edge-case-audit.md` — are reference,
not context. Open them only when working the specific gap or fix they describe.

## How to work

- **Spec-driven for anything non-trivial:** requirements → design → tasks, each approved before coding.
- **Read before writing.** Never propose changes to code you have not read.
- **Respect the boundaries** in `steering/architecture.md`: engine (`parser`, `core`, `shared`) may not
  import from ecosystem packages.
- **Determinism is not negotiable** for anything that decides group membership. See
  `steering/conventions.md`.
- **Run the gates** in `steering/verification.md` before reporting a change as done. A clean exit code is
  not evidence of success.
- **Update memory** per `steering/memory.md` after meaningful work: rewrite the affected part of
  PROJECT_STATE, prepend to DECISIONS if a decision was made, append to BRAIN.
- **Never run git milestone operations unprompted** — merges to `main`, tags, branch create/delete,
  pushes. Ordinary commits are fine when asked.
- **Say what you did not verify.** Honest gaps are more useful than confident guesses.

## Helpers

| Kind | Name | Use |
|------|------|-----|
| Skill | `commit-assist` | Group uncommitted work into conventional commits and commit on confirmation |
| Skill | `memory-sync` | Bring PROJECT_STATE / DECISIONS / BRAIN up to date on purpose |
| Skill | `task-researcher` | Populate a task record's discovery section with real file and method references |
| Skill | `handoff-generator` | Project a task record onto the delivery hand-off format |
| Hook | `sync-memory-on-stop` | The only hook. Fires at the end of each turn and triggers the memory protocol |
| MCP | filesystem, PDF reader, Word/PPT, Basic Memory (`personal` vault) | Configured in `.kiro/settings/mcp.json`; servers live in `tooling/` (git-ignored) |

Everything invocable is a skill except the one thing that must fire without being asked. Skills hold the
procedure; the hook only triggers it.

## Environment

Windows, PowerShell. Use `;` as a command separator, not `&&`. Never `cd` — pass a working directory.
Never start dev servers or watchers as blocking commands; ask the user to run them.
