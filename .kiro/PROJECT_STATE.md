# Project State

> **Read first every session.** Live snapshot of what is true right now — not a log.
> Rewrite sections in place; delete superseded text rather than annotating it. Keep this file short.
> Why things are the way they are: `DECISIONS.md`. What happened when: `BRAIN.md`.

Last updated: 2026-08-22 22:07

---

## Current position

The engine is **complete and audited**. All 22 hardening gaps are closed across four waves
(A `parser-hardening`, B `parser-identity`, C `engine-integrity`, D `engine-audit`), and the viewer
finish landed with wave D on branch **`fable-work`**.

The remaining gap is **reach, not capability**: the pipeline can only be driven by `npm run` scripts from
inside this workspace.

**Branch:** `fable-work` (cut from `phase-3-viewer`; contains `parser-identity` and `phase-3-viewer` as
ancestors). Awaiting owner review. `main` carries Phase 1, Phase 2 and wave A; waves B–D and the viewer
are unmerged.

## Verified state

Measured 2026-08-22 on Node v20.19.0 / npm 10.8.2.

| Gate | Result |
|------|--------|
| `npm run build` | **clean** |
| Determinism | **holds** — `group` digest identical across 3 runs, matches the recorded value |
| Engine tests | **core 153/153**, **parser 180/181** (one platform-dependent failure on Windows) |
| Other workspaces | `api-client` 50/50, `web` 20/20; `types` 2 suites fail, `ui` 1 flaky — both pre-existing and vendored |
| Root `npm test` | **exits 1.** Not usable as a gate as written |

Two corrections to what was previously recorded here:

1. The earlier "354 green (153 core + 181 parser + 20 web)" figure counted only three workspaces and was
   captured on a Node 21+ machine. The repo has six test workspaces, and three of them do not pass.
2. **The engine test script does not run on Node 20 at all.** `node --test dist/*.test.js` needs Node 21+
   to expand the glob. On Node 20 it errors out rather than running. Verify the engine by listing the test
   files explicitly — see `steering/verification.md` for the exact command and the known-failure list.

## Measured fixture results

| Fixture | Scale | Grouping result |
|---------|-------|-----------------|
| `sample-java-project` | 6 Java files | 29 nodes / 6 edges — the determinism fixture |
| `vantage` | 158-file Spring Boot | 803 nodes / 344 edges → 20 regions, **preserve 10 / reconstruct 10** |
| `broadleaf` | mature multi-module | 29,190 nodes / 14,325 edges → 502 regions, **preserve 38 / reconstruct 464**, depth 6 |

`broadleaf` is the load-bearing evidence: real, large, multi-module Java where the adaptive preserve
branch fires. It previously crashed `group` with `duplicate node identifier` until node identity was
scoped by source root.

## Done

- **Phase 1 — parser** (`packages/shared`, `packages/parser`): Tree-Sitter Java → `graph.json`,
  determinism harness. Merged path complete.
- **Phase 2 — grouping** (`packages/core`): adaptive preserve-vs-reconstruct → five-file `index/` plus
  blast radius; 79 core tests covering all 33 spec correctness properties. Merged to `main` 2026-07-23.
- **Phase 3 — viewer** (`packages/web`, `ui`, `types`, `api-client`): Next.js 15 viewer over `index/`,
  rendering semantic zoom, the flat baseline, and the decision audit. On `fable-work`.
- **Engine hardening waves A–D**: 22 gaps closed. See `DECISIONS.md` for what each wave changed.
- **Agent context restructured** (2026-08-22): steering reduced to five always-on files of system facts
  and protocol; narrative moved to `docs/positioning/`, coursework material to `docs/academic/`, both
  excluded from context; memory split into this file + `DECISIONS.md` + `BRAIN.md`.
- **Agent tooling consolidated** (2026-08-22): four hooks deleted, leaving `sync-memory-on-stop` as the
  only hook and reduced to a thin trigger. Procedures live in steering and in four skills —
  `commit-assist`, `memory-sync`, `task-researcher`, `handoff-generator`.

## In progress

- **Owner review of `fable-work`** (engine waves C/D + viewer finish). No merge decision yet.
- **Public repo split / replay** — this repo is the intended archive; a scrubbed replay builds the public
  `RepoHIVE`. **Batches 1–69 are replayed and pushed:** public `main` = 75 commits, in sync with origin,
  with feature branches and dated `--no-ff` merges for the parser, grouping, viewer-vendoring and
  signal-enrichment segments. Remaining work is planned but not executed — 56 of the 76 candidate commits
  on `fable-work`, in three segments (`feat/parser-identity` 13, `feat/viewer` 8,
  `feat/engine-hardening` 35). Plan: `docs/plan/replay/new-work-replay-plan.md`.
- **Unmerged branches:** `parser-identity` and the `fable-work` line. Merges, tags, and branch operations
  are owner-driven.
- **The context restructure is uncommitted** — 47 changed paths on `fable-work`: steering rebuild, memory
  split, `docs/positioning/` and `docs/academic/` moves, hook deletions, and the new
  `.kiro/skills/memory-sync/`. Documentation and agent config only; no code touched. Needs its own commit
  grouping and a replay pass afterwards.

## Next up

Candidate order, not a commitment.

- [ ] Owner review and merge decision for `fable-work`.
- [ ] **Group naming** — move Tier-1 structural labels server-side per `docs/group-naming.md`. The viewer
      currently derives labels client-side; putting them in `index/` makes them auditable and reusable.
- [ ] **Packaged CLI** (`packages/cli`) — the blocker for every other distribution surface.
- [ ] **More real-repo validation** — the adaptive branch has two real data points; more mature
      multi-module repos would strengthen it.

## Open questions and known risks

- **`RepoHIVE-Archive` is still public** — verified against the GitHub API 2026-08-22 20:55, 8177 KB.
  `.kiro/gaps.md`, `.kiro/fixes.md` and `.kiro/edge-case-audit.md` remain reachable by anyone. Closing
  this is the entire purpose of the repo split and it is still open. Owner action: Settings → Danger Zone
  → change visibility.
- **The engine test script is broken on Node 20 and silently vacuous on Node 21+.** `node --test
  dist/*.test.js` needs Node 21+ to expand the glob; on Node 20 it errors out without running anything.
  The earlier bare `dist/` form runs on Node 20 but resolves to `dist/index.js` on Node 21+ and reports
  one passing test. Neither form is correct on both versions. Needs a version-independent runner: an
  explicit file list, a glob library, or moving the engine packages onto the same runner the other
  workspaces use. **Until then no "green suite" claim from `npm test` should be trusted.**
- **Three pre-existing test failures**, none in the engine's own logic: a Windows-vs-POSIX filename
  assumption in `parser/source-collector.test.ts`, a vendored `types` test importing
  `tests/fixtures/node_ids.json` which was never vendored, and flaky timing-sensitive render-budget tests
  in `ui`. Enumerated with reproduction detail in `steering/verification.md`.
- **Index write is not fully atomic.** The promotion phase is five same-directory renames; a failure
  between them can leave a mixture. Inherent to the design (a full directory swap was rejected for its
  no-index window). Realistic failures now occur during staging, before the target is touched.
- **Viewer route handlers are unauthenticated** and intended for localhost only. They expose indexed
  source structure. Authentication is a blocking prerequisite for any non-local deployment.
- **Gap 1b (method-call edges)** — deferred by design, not closed. `methodCallFrequency` is not fully
  populated from real call sites.
- **Command names** `parse` / `group` / `view` are still placeholders.
- `docs/academic/2nd/review-2-demo-guide.md` is stale — it predates wave A and references a removed
  synthetic fixture.

## Reference registers

Large working documents, not context. Load only when working the specific gap or fix they describe.

| File | Contents |
|------|----------|
| `.kiro/gaps.md` | The 22-gap register with reproduced evidence |
| `.kiro/fixes.md` | Fix designs (Fix 3 – Fix 22) |
| `.kiro/edge-case-audit.md` | Edge-case audit |
| `docs/fixes-signal-enrichment.md` | Gap 1 design (Fixes 21–23) |
| `docs/group-naming.md` | Deferred group-naming design |
| `.kiro/GIT_PLAN.md`, `.kiro/GIT_REDATE_PLAN.md`, `.kiro/BRAIN_LOCAL.md` | Untracked local scratch — not part of the repo, not context |
| `docs/plan/replay/` | Public-repo replay kit: staging + replay scripts, filter inputs, `batches.txt`, and `new-work-replay-plan.md` (the remaining 56 commits) |
