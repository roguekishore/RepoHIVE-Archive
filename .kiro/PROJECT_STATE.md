# Project State — RepoHIVE

> **READ THIS FIRST every session.** Live progress ledger. Update it after meaningful work.
> For decision rationale see `PROJECT_PLAN.md`; for canonical operational context see `.kiro/steering/`.

---

## Current position

- **Phase:** Wave B — `parser-identity` — **COMPLETE** (2026-08-09), awaiting owner merge to `main`.
  All seven Wave-B gaps done: **7, 6, 4, 5** (structural qualified names, type-driven param lists,
  scope-aware identity, `$$` escaping + uniqueness gate — done by the parallel-window agent) and
  **2, 8, 19** (source-root-scoped identity + resolution, static-import map-up, collector exclusions).
  Suite: **257 green** (84 core + 173 parser), 0 failing. Determinism holds; new SHA-256 digest
  `f3be011b…` (was `ca6992db…` — id format changed by scoping).
- **Headline result:** `fixtures/broadleaf` — the mature multi-module repo that previously **crashed**
  `group` with `duplicate node identifier` — now **parses (29190 nodes / 14325 edges) and groups
  (502 regions → preserve 38 / reconstruct 464, depth 6)**. Gap 2 (source-root-scoped identity)
  removed the collision; the adaptive preserve branch fires on real multi-module Java.
- **Recently done:** (2026-08-09) Wave B on `parser-identity`:
  - **Gap 2** (Fix 24, 6 commits): `deriveSourceRoot` helper; `class`/`function` ids gain a
    `<sourceRoot>|` scope prefix (empty scope omits it → single-root ids unchanged); scope-aware symbol
    table (`lookupInScope` / `lookupAcrossScopes`); stitcher resolves same-source-root first then
    byte-first cross-root with recorded ambiguity; spec Property 11.
  - **Gap 8** (Fix 10, Option A — owner-approved reduced scope): static-member imports map up to the
    enclosing class. (Nested-type and wildcard imports were already resolving after Wave A + Gap 5 —
    verified by reproduction, so their parts of Fix 10 were correctly skipped.)
  - **Gap 19** (Fix 16): default-on collector exclusions (`.git`/`target`/`build`/`node_modules`/…),
    overridable via `--include-generated` / `--exclude`, skipped-dir count reported.
  - Re-parsed/re-indexed all fixtures: `vantage` 344 edges (was 341), preserve 10 / reconstruct 10;
    `sample-java-project` 6 edges; `broadleaf` as above.
- **Next action:**
  (a) **Owner merges `parser-identity` → `main` (`--no-ff`)** — Wave B milestone (agent must not merge).
  (b) **Recapture `docs/2nd/review-2-demo-guide.md`** if its synthetic Demo A/B repos are affected by the
  new id format — its numbers were NOT auto-updated (per the protocol's "do not silently edit the demo
  guide"); re-run those demos and check before the review.
  (c) Remaining engine waves C/D (`engine-integrity`, `engine-audit`) per `docs/plan/agent-fix-protocol.md`.

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

## Next up

> This section previously listed Review-1 parser tasks completed in July. Corrected 2026-08-08.

### Track A — public repo split (execution kit ready, nothing run)

Plan: `docs/plan/public-repo-replay-plan.md` · Scripts + instructions: `docs/plan/replay/`

- [ ] Commit the pending `.kiro/hooks/*.json` edits.
- [ ] Rename this repo `RepoHIVE` → **`repo-hive-archive`**; make it **private**.
      (Rename must precede creating `repohive` — repo names are case-insensitive for uniqueness.)
- [ ] Create public **`repohive`**, empty. Turn ON *Include private contributions*.
- [ ] `pip install git-filter-repo`, then run `01-setup-staging.ps1` — must pass its acceptance test.
- [ ] Review boundaries with `02-show-batches.ps1`, then replay ~6 commits/day for 12 days.

### Track B — Wave B (`parser-identity`)

Gaps 7, 6, 4, 5, 2, 8, 19 — node identity, resolution, collection. One re-parse at the end.

- [ ] **Gap 2 design pass — BLOCKING.** The only gap with no fix design (`docs/fixes.md` covers 3–22;
      Gap 1 is designed in `docs/fixes-signal-enrichment.md`). Must reuse Wave A's JLS-precedence
      resolver in `stitcher.ts`, and must be designed **together with Gap 5** or Gap 5 needs redoing.
- [ ] Owner decisions needed mid-wave: **Gap 5** separator, **Gap 19** exclusion default.
- [ ] Then: Gap 7 → 6 → 4 → 5 → 2 → 8 → 19, granular commits, one re-parse, recapture numbers.

**Then:** Wave C (`engine-integrity`) → Wave D (`engine-audit`) → Wave E (`phase-3-viewer`).

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

- **2026-08-08** — **Repo split decided: this repo goes private as `repo-hive-archive`; a new public
  `repohive` receives a scrubbed replay.** The university requires a public repo, and 514 KB of the gap/
  fix/audit registers were found **tracked at `.kiro/gaps.md`, `.kiro/fixes.md`,
  `.kiro/edge-case-audit.md`** and pushed publicly — the `.git/info/exclude` entries only ever covered
  the `docs/` copies. Chosen over rewriting this repo's history (which would cost 7 contribution days and
  still could not un-publish what was already out). 69 of 99 commits survive the exclusion filter
  (`.kiro/`, `docs/`, `ui-ideas/`, `AGENTS.md`); replayed over 12 days at ~6/day. Execution kit written to
  `docs/plan/replay/` (3 PowerShell scripts, 2 scrub files, 2 README stages, NOTICE, instructions).
  Decisions: private contributions ON; `components.json` shipped; commit granularity = one commit per
  observable sub-behaviour, each independently green.
- **2026-08-08** — **README ships in two stages, and `NOTICE` is required.** The relicense (2026-08-04)
  and repowise vendoring (2026-08-05) both happened *after* the grouping algorithm; a single README
  carrying AGPL and repowise from Day 1 would contradict the MIT `LICENSE` beside it and cite packages
  that did not exist. Minimal README (general description only — no commands, layout, or metrics, so it
  does not go stale) lands Day 1 with MIT; the AGPL section plus `NOTICE` land Day 10 with the vendor
  commits. `NOTICE` is a licence obligation once the vendored AGPL packages ship publicly.
- **2026-08-05** — **Commit granularity raised for rollback safety.** Replaces "one commit per gap" with
  **one commit per observable sub-behaviour, each independently green and revertable** (3–7 per gap).
  A commit that does not build and pass is not a rollback point. Build + full suite before every commit;
  tag each wave boundary. Gotcha recorded: `graph.json` / `index/` are untracked, so reverting code does
  **not** restore the artifacts that matched it.
- **2026-08-05** — **Strategy inverted: close every gap before touching the viewer.** All 22 gaps across
  four sequential engine branches — Wave A `parser-hardening` (16, 1a, 1c), Wave B `parser-identity`
  (7, 6, 4, 5, 2, 8, 19), Wave C `engine-integrity` (17, 13, 14, 15, 3, 11, 10), Wave D `engine-audit`
  (9, 20, 22, 21, 18, 12) — then Wave E `phase-3-viewer`. Ordered by UI need then cross-questioning
  defensibility, which moved the determinism cluster (13/17/18) earlier and multi-module identity (Gap 2)
  later. Supersedes the scope/ordering of `docs/phase-1.5/execution-plan.md`.
- **2026-08-05** — **Adopt repowise's UI under AGPL rather than build a viewer.** repowise (AGPL-3.0,
  © 2024–2026 Raghav Chamadiya and contributors) ships a Next.js 15 / React 19 / Tailwind 4 app with a
  canvas semantic-zoom module whose data model is close to a superset of our `index/`. Verified nearly
  standalone (the canvas's only cross-module import is a theme-token helper), computes layout
  client-side (no dependency on their Python backend), and is deterministic (sorts by sibling rank, ties
  by id). **Owner accepted AGPL and explicitly abandoned commercialization**; a hosted instance would
  ship from this same source. Consequences: relicensed MIT → AGPL-3.0-or-later (`19b27bc`, `4f6e823`);
  vendored four packages in full onto `phase-3-viewer` (1031 files, unmerged) and gate visibility via
  `nav-items.ts` rather than prune; Next.js not Vite; UI rationed one new surface per review, and a
  surface goes live only when our own engine produces its data.
- **2026-08-05** — **Viewer requirements spec written** (`.kiro/specs/hierarchical-graph-viewer/`),
  single-pass approval, requirements only. Gap 12 promoted into it as Requirement 3, resolving that
  gap's open question. **Gap 1 design pass** written to `docs/fixes-signal-enrichment.md` (Fixes 21–23)
  after verifying `docs/fixes.md` covers only Gaps 3–22 — a claim previously asserted without checking.
  Tree-Sitter grammar facts verified empirically, catching three traps that would each have produced
  wrong code. **Fixture build-out cancelled** — clone a suitable repo on the day.

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
