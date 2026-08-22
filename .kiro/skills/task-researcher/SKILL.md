---
name: task-researcher
description: Use at the start of a task to populate the Discovery section of a personal vault task-record with real, concretely-referenced facts about the code and data model. Triggers include "research the codebase", "discovery", "trace this flow", or starting a task.
alwaysApply: false
globs:
---

# Task Researcher

Produce the Discovery section of a vault task-record: an accurate, reference-dense map of what the relevant code and data model actually do, so decisions come from facts. Read-only on source code; write only to the `personal` vault.

## Input
A task-record under `D:\Vaults\personal-brain\tasks\` whose `## Intake` states the ask (or a raw area — then ask for the record id/title first).

## Repo architecture

**Do not rely on a copy of the architecture here — it goes stale.** Read the authoritative files:

- `.kiro/steering/architecture.md` — pipeline, packages and their dependency rules, the JSON contract, the viewer's route handlers.
- `.kiro/steering/stack.md` — libraries, versions, and commands.
- `.kiro/PROJECT_STATE.md` — what is built, what is verified, measured fixture numbers.

## Where things live for navigation

- Data model / contract -> `packages/shared/src/*.ts` (the stable seam; start here when a task touches data shape).
- Parse flow (AST extraction, symbol table, stitching, serialization) -> `packages/parser/src/`.
- Grouping algorithm stages -> `packages/core/src/`; its numbered correctness properties are in `.kiro/specs/hierarchical-repository-grouping/`.
- Viewer and its API routes -> `packages/web/src/`.
- Determinism proof -> the determinism harness plus `npm run demo:group-determinism`; tests are `fast-check` property tests.
- Fixtures (ground truth) -> `fixtures/` (`sample-java-project` is the small checked-in one; `vantage` and `broadleaf` are real repos, git-ignored clones).
- Project memory -> `.kiro/PROJECT_STATE.md` (now), `.kiro/DECISIONS.md` (why), `.kiro/BRAIN.md` (history).

Never read `docs/positioning/` or `docs/academic/` for discovery — they are audience-facing narrative, not specifications.

## How to work
1. Read the record's `## Intake`. Search the vault (`search_notes`/`build_context`) for existing `knowledge/`/`decisions/` so you don't re-discover facts.
2. Trace the flow hop by hop with grep/glob/read: entry point -> logic -> storage. Cite exact file paths and symbol names (line numbers where possible).
3. There is no database. Ground data-model claims in the JSON-contract types in `packages/shared` and in real generated artifacts (`graph.json`, `index/`) read-only — never assume shape, verify it against the types or a sample artifact.
4. Note gaps/inconsistencies/risks (these seed Decisions/Complications) but do NOT make decisions.
5. Write the Discovery section back (replace the `## Discovery` section), preserving other sections. Add 2-4 `- [discovery] ... #discovery` observations for load-bearing facts.

## Boundaries
- Read-only on code; only write to the `personal` vault.
- Cite real locations; if unverified, say so rather than inventing.
- Facts over prose.
