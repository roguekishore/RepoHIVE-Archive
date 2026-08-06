# Project State — RepoHIVE

> **READ THIS FIRST every session.** Live progress ledger. Update it after meaningful work.
> For decision rationale see `PROJECT_PLAN.md`; for canonical operational context see `.kiro/steering/`.

---

## Current position

- **Phase:** Wave A of parser-hardening — **COMPLETE on branch `parser-hardening`** (2026-08-06).
  Closed Gaps 16, 1a, 1c. **The preserve branch now fires on real Java:**
  `vantage` (158-file Spring Boot): 20 regions → **preserve 10 / reconstruct 10** (was 0/20).
  Suite: **204 green** (84 core + 120 parser), 0 failing. Deterministic SHA-256 confirmed.
- **Recently done:** (2026-08-06) Wave A engine gap fixes on `parser-hardening`:
  - **Gap 16** (core): strength-aware degenerate guards in `assessor.ts` + `community.ts`.
    Prevents singleton explosion when intra-region edges carry zero strength.
  - **Gap 1a** (parser): type-use edge extraction — `collectTypeReferences` walk in
    `ast-extractor.ts`; `sharedTypeCount` now populated from field/param/return/extends/implements/new
    type positions. 12 new parser tests.
  - **Gap 1c** (parser): same-package simple-name resolution in `stitcher.ts` via per-file
    import index + JLS-precedence candidate list (single-type import → same package → wildcard).
    6 new stitcher tests.
  - Re-parsed and re-indexed `vantage` (341 edges, up from 128) and `sample-java-project` (6 edges).
  - 11 commits on `parser-hardening`; suite grew from 181 → 204.
- **Next review:** Third Review — **10.08.2026** — deliverable: **viewer** (`view`) + flat baseline.
- **Next action:** Owner to merge `parser-hardening` → `main` (`--no-ff`). Then begin Wave B
  (`parser-identity`) or the Review 3 viewer spec, depending on review priority.

---

## Done

- [x] Master plan written (`.kiro/PROJECT_PLAN.md`).
- [x] Removed nested `.git` repos from both MCP servers (functionality intact).
- [x] Reorganized workspace: `tooling/` (MCP servers), `docs/reference/` (brief + v3 deck),
      `archive/` (resume + old decks). Updated `mcp.json` paths; servers re-enabled.
- [x] Steering docs created: product, architecture, tech-stack, performance-and-scale,
      competitive-landscape, roadmap, review-timeline, git-workflow.
- [x] State ledger, AGENTS.md, doc seeds, root config, folder spine created.
- [x] Existing core spec: Graphify → RepoHIVE rename.
- [x] **Review 1 parser complete** (`packages/shared` + `packages/parser`; Tree-Sitter Java →
      `graph.json`; determinism harness; 102 tests) — per BRAIN 2026-07-01.
- [x] **Basic Memory task-documentation + memory system** set up in `.kiro/` (2026-07-06):
      `steering/task-workflow.md`; skills `task-researcher` + `handoff-generator` (`.kiro/skills/`);
      CLI agents `.kiro/agents/{task-researcher,handoff-generator}.json`; SessionStart hook
      `load-memory-on-start.json`. Backed by the external `personal` vault (`D:\Vaults\personal-brain`).
- [x] **Decision history recorded to the `personal` vault** (2026-07-07): 17 ADRs + 14 knowledge notes
      written via the basic-memory MCP (after binding it to `personal`). A prior session's notes were
      never persisted, so the set was regenerated from PROJECT_PLAN + BRAIN + steering.
- [x] **Review 1 parser re-verified end-to-end** (2026-07-07): `npm run build` clean;
      `npm test --workspace @repohive/parser` → 102/102 passing; `npm run parse` against
      `fixtures/sample-java-project` (29 nodes/5 edges) and `fixtures/vantage` (803 nodes/128 edges);
      `demo:determinism` → identical SHA-256 across 3 runs. Wrote
      `docs/1st/review-1-demo-guide.md` (commands + real captured output) for the Review 1
      demonstration, plus `docs/1st/README.md`.
- [x] **Review 2 / Phase 2 core grouping complete** (`packages/core`): the adaptive
      preserve-vs-reconstruct grouping algorithm → five-file `index/` + blast radius; 79 tests
      (all 33 spec properties), 181 total, deterministic. Built 2026-07-11 → 2026-07-21 on
      `phase-2-core` (one commit per spec task), merged to `main` 2026-07-23. Demo + commit
      guides in `docs/2nd/`.

## In progress

- Wave A (`parser-hardening`) complete — awaiting owner merge to `main`.
- Review 3 (viewer, `packages/web`) not yet started; `review-2` tag pending the review itself.
- Waves B–D (`parser-identity`, `engine-integrity`, `engine-audit`) queued per `docs/plan/execution-plan.md`.

## Next up (Review 1 — Parser)

- [ ] `dependency-graph-parser` spec: requirements → design → tasks.
- [ ] `packages/shared`: JSON-contract types (GraphNode, DependencyEdge, etc.).
- [ ] `packages/parser`: Tree-Sitter Java → stitch → `graph.json`.
- [ ] Pick a small open-source Java repo as `fixtures/sample-java-project`.

## Known gaps / open questions

- **Wave A complete (2026-08-06):** Gaps 16, 1a, 1c closed on `parser-hardening`. Preserve fires
  on real Java. Awaiting owner merge.
- **Wave B (`parser-identity`):** Gaps 7, 6, 4, 5, 2, 8, 19 — node identity, resolution, collection.
  Gap 2 still needs a design pass at the start of Wave B.
- **Wave C (`engine-integrity`):** Gaps 17, 13, 14, 15, 3, 11, 10.
- **Wave D (`engine-audit`):** Gaps 9, 20, 22, 21, 18, 12. Open decisions 1–4 from
  `docs/plan/execution-plan.md` §11 still need owner resolution before respective waves.
- **Gap 1b (method-call edges):** optional, deferred beyond Wave A per the design.
- Final project name **RepoHIVE** locked; command names still TBD (placeholders in use).
- **Git IS initialized** (commits on `main` + `parser-hardening`). The "git not yet initialized"
  line in AGENTS.md/`steering/git-workflow.md` is stale — flagged, not yet fixed.
- Project diary team/date placeholder fields still unfilled — fine for internal use.

---

## Decisions log (most recent first)

- **2026-08-06** — **Wave A closed: `parser-hardening` branch complete.**
  Gaps 16 + 1a + 1c resolved in 11 granular commits, each green and independently revertable.
  Gap 16 (core): strength-aware degenerate guards prevent singleton explosion on zero-weight edges.
  Gap 1a (parser): type-use edge extraction from all declared-type positions → `sharedTypeCount`
  populated; 12 new parser tests; two grammar traps caught during testing (type_list in typeNamesOf,
  spread_parameter not in TYPED_BY_FIELD).
  Gap 1c (parser): same-package simple-name resolution via per-file import index + JLS-precedence
  candidate list → intra-package edges now created; 6 new stitcher tests.
  **Key outcome:** `vantage` (158-file Spring Boot) re-parsed: 341 edges (was 128), 20 regions
  → **preserve 10 / reconstruct 10** (was 0/20). The adaptive preserve-vs-reconstruct contribution
  is demonstrable on real Java. Deterministic SHA-256 confirmed. Suite: 204/0.
  Awaiting owner merge `parser-hardening` → `main` (`--no-ff`).

- **2026-07-23** — **Phase 2 closed: merged `phase-2-core` into `main`** (`--no-ff`, mirroring the
  Review-1 milestone pattern); the `review-2` tag is deferred to the review itself. The engine
  landed as one commit per spec task with tests alongside (2026-07-11 → 2026-07-21): deterministic
  primitives first (canonical order + content-addressed group ids), then ingest gate → dependency
  strengths → region identification → structural-quality assessment → seeded-Louvain community seam
  → adaptive preserve-vs-reconstruct construction → balanced hierarchy assembly → metadata →
  whole-pipeline determinism → five-file `index/` serialize/parse → blast radius → orchestrator +
  `group` CLI + demo scripts. 79 core tests (all 33 spec correctness properties), 181 total across
  workspaces; byte-identical SHA-256 output across repeated and shuffled-input runs.
- **2026-07-11** — Phase-2 implementation started on `phase-2-core` per the
  `hierarchical-repository-grouping` spec, determinism primitives first (every later stage depends
  on canonical ordering and stable ids). Also scoped both packages' test runners to compiled
  `dist/` tests for Node-version compatibility.
- **2026-07-07** — Process correction: **git milestone operations (merge to `main`, tags, phase
  branches) are owner-driven, not agent-driven.** An agent-performed `phase-1-parser` → `main`
  `--no-ff` merge + `review-1` tag + `phase-2-core` branch (all local, never pushed) was fully
  reverted at the owner's request — `main` and `phase-1-parser` restored to their `origin` refs,
  tag and branch deleted, `docs/1st` + memory edits preserved as uncommitted changes. The owner
  had only asked whether the parser features were solid to proceed (answer: yes), not for the merge.
- **2026-07-07** — Re-verified the Review 1 parser end-to-end on request (build, 102 tests, both demo
  scripts, a real third-party repo parse) rather than trusting prior BRAIN entries alone, and produced
  a Review 1 demonstration guide (`docs/1st/review-1-demo-guide.md`) with real captured command output
  for use at the 03.07.2026 review. Surfaced but did not act on: unmerged `phase-1-parser` branch (no
  `main` merge / `review-1` tag yet), a stale "git not initialized" line in steering/STATE, and blank
  project-diary submission placeholders — left for the owner to decide on.
- **2026-07-07** — Reworked project-diary handling: the diary is now AUTO-maintained, WEEKLY, and
  IMPLEMENTATION-ONLY (product/engine code + specs only; meta/infrastructure excluded), moving it from
  draft-for-approval to auto — refines ADR-014 (research-log stays the only approval-gated doc).
  Restructured `docs/project-diary.md` into a weekly implementation log (placeholder date ranges for the
  owner to fixate) seeded with Week 1 = Phase-1 parser; rewrote item 6 of both `sync-docs-on-stop` hook
  files. Chose to modify the existing hook rather than add a second Stop hook.
- **2026-07-07** — Bound this workspace's `basic-memory` MCP to the `personal` project via a workspace-level
  `.kiro/settings/mcp.json` override (the user-level config was misbound to `desk365` by a stray arg),
  keeping `desk365` as the global default. Recorded RepoHIVE's full decision history into the external
  `personal` vault — 17 ADRs (`decisions/`) + 14 knowledge notes (`knowledge/`) — via the basic-memory MCP.
  Found a prior session's claimed "28 notes" were never persisted (vault folders empty) and regenerated
  from PROJECT_PLAN + BRAIN + steering.
- **2026-07-07** — Completed the Task-10 de-tracker adaptation: full de-Zoho/DE-Ixxxx pass on the vault
  templates (rewrote task-record/adr/test-matrix/work-item-format; renamed `zoho-handoff.md` →
  `handoff.md`; fixed the `00-index` link; contract `format_version` 1→2). Kept the delivery structure,
  de-branded it; vault + `.kiro/` verified free of zoho/DE-Ixxxx/sprint. Open: optionally simplify the
  agile item_types/phases to a lighter academic set.
- **2026-07-06** — Scope clarification: **RepoHIVE has no "sprint" concept, ever.** Removed all sprint
  references from the Basic Memory vault templates (`task-record.md`: dropped `sprint:` frontmatter,
  "sprint item" → "work item", `[[Epic or Sprint]]` → `[[Parent work item]]`; `work-item-format.md`:
  "Zoho Sprints tree" → "delivery tree"). The `.kiro/` machinery I created never used sprints.
  Remaining Zoho/DE-Ixxxx tracker language in the templates is left pending the Task-10 keep-vs-adapt call.
- **2026-07-06** — Replicated the AI task-documentation + memory system (from a company repo) into
  RepoHIVE's `.kiro/`, adapted to this project: steering `task-workflow.md`, skills
  `task-researcher`/`handoff-generator`, CLI agents (JSON, 7-key shape), and a SessionStart
  `load-memory-on-start` hook over the external Basic Memory `personal` vault. Additive to (not a
  replacement for) PROJECT_STATE/BRAIN/diary/research-log. Vault contract `work-item-format.md` left
  Zoho-flavored pending an owner keep-vs-adapt decision; `.kiro/settings/mcp.json` edit deferred to
  the owner (agent write-blocked).
- **2026-07-04** — Added `commit-assist` hook (userTriggered): proposes convention-based commits on
  confirmation. Chosen over postTaskExecution auto-commit. `log-task-completion` keep/remove: pending.
- **2026-07-04** — Documented commit convention in `git-workflow.md`: product types
  (`feat/fix/test/refactor/chore`) vs `kiro(...)` meta type; commit memory/state files on `main`.
- **2026-07-04** — Logging switched to 24-hour timestamps (`YYYY-MM-DD HH:mm`) across hooks + rules.
- **2026-07-04** — Expanded `sync-docs-on-stop` hook (v2): PROJECT_STATE + BRAIN auto-updated;
  research-log + project-diary are draft-for-approval only (plagiarism-safe, human-owned artifacts).
- **2026-06-22** — Project name finalized: **RepoHIVE** (Repository Hierarchical Indexing &
  Visualization Engine). Replaces the FlowGraph placeholder across all docs. Command names remain TBD.
- **2026-06-22** — Stack finalized: TS/Node, Tree-Sitter, graphology, Louvain/Leiden, React/React
  Flow, JSON storage, npm workspaces. MySQL removed. Neo4j deferred to 8th sem.
- **2026-06-22** — Graphify researched: it's 63K-star prior art with single global Leiden clustering;
  our edge narrowed to adaptive multi-level hierarchy + determinism; Graphify becomes our baseline;
  validated the no-embeddings decision.
- **2026-06-22** — Embeddings deferred to a semantic search/naming layer; never for grouping.
- **2026-06-22** — Cloud/auth not needed for core; telemetry deferred; skill = top distribution lever.
- **2026-06-22** — Path 1 (degree + paper) chosen now; Path 2 (viral) deferred, architecture kept open.
- **2026-06-22** — Workspace reorganized; backbone docs generated.
