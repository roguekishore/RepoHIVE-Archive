# BRAIN — RepoHIVE Persistent Memory Log

> **What this is.** An append-only memory of the project: every meaningful session, decision,
> correction, and outcome, in time order. It is the project's long-term history so context is never
> lost between sessions or after context resets.
>
> **Rules for maintaining it:**
> - **Append, never delete.** New entries go at the BOTTOM. Past entries are history — do not edit or
>   remove them, even if a decision is later reversed (instead, add a new entry recording the reversal).
> - Each entry: date, what happened, why, and any decision/outcome. Keep entries terse.
> - Record only REAL events (work done, decisions made, feedback received) — never speculation.
> - **Timestamps must be the real system date+time in 24-hour format** — run
>   `Get-Date -Format 'yyyy-MM-dd HH:mm'` first and stamp each entry with the full `YYYY-MM-DD HH:mm`.
>   NOT the conversation's start date. A single conversation can span many real days/times; always verify.
> - This complements, not replaces: `PROJECT_STATE.md` = current snapshot; `DECISIONS.md` =
>   decisions + rationale; `BRAIN.md` = the running history of how we got here.
>
> **Read order for an agent:** PROJECT_STATE (now) → steering/ (durable context) → BRAIN (history,
> when deeper context is needed).

---

> ## Reading note added 2026-08-22
>
> **This is a historical log. Do not read it as a description of the project.**
>
> Entries before 2026-08-22 were written while the project's context was organised around coursework
> reviews and submission deadlines, and they carry that framing: semester language, review numbering,
> paper obligations, and scope statements that treated distribution work as deliberately out of scope.
> They also reference files that no longer exist (`PROJECT_PLAN.md`, `steering/product.md`,
> `steering/roadmap.md`, `steering/review-timeline.md`, `steering/git-workflow.md`) and stack facts that
> have since changed (React Flow, Vite, a five-package layout).
>
> Those entries are preserved unedited because this log is append-only and because the record of what
> was actually done is accurate. For what is currently true, read `PROJECT_STATE.md`. For what currently
> constrains work, read `.kiro/steering/` and `DECISIONS.md`. Those win over anything below.

---

## How to add an entry (template)

```
### YYYY-MM-DD — <short title>
- **What:** what happened this session.
- **Why:** the reasoning / trigger.
- **Decision/Outcome:** what was decided or produced.
- **Next:** what this sets up (optional).
```

---

## History

> **Date-accuracy note (added 2026-07-01):** entries below originally dated "2026-06-22" were written
> across a multi-day conversation that began 2026-06-22; the real dates of later entries drifted up to
> ~2026-07-01. Dates are approximate for that early span. Going forward, every entry uses the verified
> system date.

### 2026-06-22 — Project setup and planning
- **What:** Long planning conversation; set up the entire project backbone from the existing docs
  (project brief, Zeroth Review deck v3, core grouping spec).
- **Why:** Establish durable context so minimal daily time is spent re-explaining; enable AI-driven,
  spec-driven development across 6 reviews + a paper.
- **Decision/Outcome:**
  - Stack: TypeScript/Node, Tree-Sitter, graphology, Louvain/Leiden, React+React Flow, JSON storage,
    npm workspaces. MySQL removed; Neo4j deferred to 8th sem.
  - Core contribution: adaptive per-region preserve-vs-reconstruct hierarchy, deterministic.
  - Embeddings deferred (search/naming only, never grouping). Cloud/auth not needed for core.
  - Graphify researched (63k-star prior art, single global Leiden, no embeddings) → it's our baseline
    and validates the no-embeddings call. Edge narrowed to: adaptive multi-level hierarchy + determinism.
  - Path 1 (degree + paper) chosen; Path 2 (viral) deferred, architecture kept open. Skill = top
    distribution lever later.
  - Generated: 8 steering docs, PROJECT_PLAN (index+decisions), PROJECT_STATE (ledger), AGENTS.md,
    research-log + project-diary seeds, root config, packages spine.
  - Workspace reorganized: tooling/ (MCP servers), docs/reference/, archive/. Nested .git repos
    removed from the MCP servers. mcp.json paths updated.
  - Optimization pass: PROJECT_PLAN slimmed from a steering-duplicate into an index + decision log
    (single source of truth = steering).
- **Next:** Review 1 (Parser, due 03.07.2026).

### 2026-06-22 — Name finalized: RepoHIVE
- **What:** Brand name chosen and applied across all docs/files (was placeholder "FlowGraph").
- **Why:** Needed a final, distinct identity that avoids collision with Graphify.
- **Decision/Outcome:** **RepoHIVE** = Repository Hierarchical Indexing & Visualization Engine. Command
  names (`parse`/`group`/`view`) remain placeholders. npm name `repohive`; demo references updated.

### 2026-06-22 — Zeroth Review handout produced
- **What:** Created a one-page jury handout (md → docx → pdf via Word MCP).
- **Why:** Give the panel a crisp, professional grasp of the project.
- **Decision/Outcome:** Formal register, sections Problem→Objective→Technical Approach→Contribution→
  Outcomes→Phase-I Plan. An "Existing Systems/Gap" variant was tried then reverted per request.

### 2026-06-22 — Review 1 parser requirements drafted
- **What:** Created `.kiro/specs/dependency-graph-parser/requirements.md` (10 requirements, EARS style,
  matching the core spec's rigor). Also created `REVIEW1_KICKOFF.md` (spec-creation instructions).
- **Why:** Review 1 deliverable is the parser (Java repo → graph.json).
- **Decision/Outcome:** Reviewed and confirmed faithful to plan — scoped to parser only, ASTs transient,
  frequency signals start simple (shape correct day one), deterministic, contract-conforming.
- **Next:** design.md → tasks.md for the parser (pending approval to proceed).

### 2026-07-01 — Documented untracked UI experiments + fixed date drift
- **What:** Found 6 undocumented UI explorations in `ui-ideas/` (demoapp, landing1 "Aeon", landing2,
  landing4, portal, prisma) built during prior UI sessions but never recorded. Added `ui-ideas/README.md`
  inventorying them. Also discovered BRAIN/STATE date entries were stamped with the conversation's start
  date (2026-06-22) instead of the real date (system date is 2026-07-01).
- **Why:** User flagged that built work wasn't being tracked and that timestamps were wrong because the
  same conversation continues across multiple real days.
- **Decision/Outcome:**
  - `ui-ideas/` declared experimental scratch space (NOT product; not wired into the engine). Only
    `demoapp/` is RepoHIVE-themed; others are layout/animation references (some unrelated themes).
  - Added a standing rule (AGENTS.md + BRAIN.md): always run `Get-Date` for the real date before
    stamping; always document newly created artifacts in PROJECT_STATE + a folder README.
  - Did NOT rewrite past entries (append-only); added a date-accuracy note instead.
- **Next:** Decide later which UI idea (if any) becomes the basis for `packages/web`.

### 2026-07-01 — Reviewer/Explainer agent created (self-contained)
- **What:** Created the `reviewer-explainer` custom agent (`.kiro/agents/reviewer-explainer.md`) — a
  read-and-explain agent that translates specs/product phases into plain language for the owner. Folded
  the explanation knowledge (analogies, jargon translations, honest-framing rules, owner context, 7-step
  spec-readout structure) directly into the agent and deleted the standalone `reviewer-guide.md`.
- **Why:** Owner wanted the human-level explanation knowledge to survive chat loss, and preferred one
  self-contained agent file over an agent + a loose md the agent merely points at.
- **Decision/Outcome:** Agent reads PROJECT_STATE → steering → BRAIN → the target spec, then explains.
  Knowledge now lives inside the agent; nothing dangling. Invoke it whenever a spec/phase needs a plain
  explanation or an honest "does this match the plan" check.

### 2026-07-01 — Parser implemented end-to-end (Review 1 deliverable)
- **What:** Completed the `dependency-graph-parser` spec (`design.md` + `tasks.md`) and executed all 16
  tasks. Built `packages/shared` (JSON-contract types: GraphNode, DependencyEdge, RawDependencyGraph)
  and `packages/parser` — the full pipeline: input validation → recursive `.java` collection →
  Tree-Sitter (web-tree-sitter + tree-sitter-java WASM) AST extraction of file/class/function nodes →
  symbol-table construction → cross-file stitching into de-duplicated directed import edges + the three
  frequency signals (importFrequency counted; methodCall/sharedType at Phase-1 zero) → canonical
  stable-stringify serialization → atomic write → `parseProject` orchestrator with an error gate (no
  partial output). Content-derived IDs + canonical ordering give determinism.
- **Why:** Review 1 (03.07.2026) deliverable is the parser producing `graph.json`.
- **Decision/Outcome:**
  - 102/102 tests pass (fast-check property tests for determinism, contract conformance, edge
    uniqueness, no self/function edges, symbol collision determinism; plus example/unit tests).
  - Added `fixtures/sample-java-project/` (hand-written, multi-package, nested/inner types, overloads,
    cross-file imports) → 29 nodes / 5 edges; checked in so the determinism digest is stable.
  - Added `verifyDeterminism` harness + `npm run demo:determinism` (parses N times, asserts identical
    SHA-256 — got `51bfd2f3…`).
  - Added a single-command demo wrapper `npm run parse -- <dir>` (root script → parser `parse-cli.ts`,
    resolves relative paths against `INIT_CWD`). **This wrapper is temporary demo convenience — must be
    reverted/replaced when the packaged CLI lands in 8th sem (per architecture engine-vs-ecosystem line).**
  - Git still not initialized; generated `graph.json` must stay git-ignored (to verify before first commit).
- **Next:** Review 1 demo prep; initialize git (phase-1-parser branch, `review-1` tag).

### 2026-07-01 — Automated documentation hooks created
- **What:** Created three Kiro hooks in `.kiro/hooks/`: (1) `sync-docs-on-stop` (agentStop → update
  PROJECT_STATE + append BRAIN after meaningful work); (2) `track-new-artifacts` (fileCreated for
  ts/tsx/js/package.json/md → ensure new packages/experiments get a folder README + STATE note);
  (3) `log-task-completion` (postTaskExecution → record spec-task completion).
- **Why:** Manual documentation discipline was failing — parser files and the 6 ui-ideas experiments
  appeared without PROJECT_STATE/BRAIN being updated. Hooks automate it via IDE events.
- **Decision/Outcome:** Documentation now fires automatically on turn-end, file-creation, and
  task-completion. Caveat: agentStop runs a follow-up doc pass each session; hooks ask an agent (judge
  "was this meaningful?"), so quality depends on prompt-following — more reliable than memory, not infallible.
- **Next:** Reconcile PROJECT_STATE with parser build files already present (`packages/parser/src/`).

### 2026-07-04 — Expanded sync-docs hook to cover diary + research log
- **What:** Updated `.kiro/hooks/sync-docs-on-stop.kiro.hook` (v1 → v2) with explicit instructions for
  all four docs.
- **Why:** The hooks only touched PROJECT_STATE + BRAIN; diary and research-log were untracked.
- **Decision/Outcome:** PROJECT_STATE + BRAIN remain AUTO-updated. research-log and project-diary are
  now DRAFT-FOR-APPROVAL only (never silently written): research-log drafted in the owner's own voice +
  paraphrased (0%-plagiarism protection); diary drafted at most once per real work day with a
  duplicate-row check and no backfilling empty days. Rationale: these two are academic, human-owned,
  plagiarism-sensitive artifacts.
- **Next:** Pending — reconcile git branches (parser work still uncommitted on main vs phase-1-parser).

### 2026-07-04 11:45 — Switched logging to 24-hour timestamps
- **What:** Updated `sync-docs-on-stop` and `log-task-completion` hooks, plus the BRAIN and AGENTS
  rules, to stamp entries with real date+time in 24-hour format via `Get-Date -Format 'yyyy-MM-dd HH:mm'`.
- **Why:** Owner wants time-of-day logging (24-hour) on entries going forward, not just the date.
- **Decision/Outcome:** BRAIN entries now carry full `YYYY-MM-DD HH:mm` timestamps; STATE decision-log
  and diary rows may use date alone. Prior entries left unchanged (append-only).
- **Next:** Pending git branch reconciliation (parser work uncommitted across main/phase-1-parser).

### 2026-07-04 12:23 — Documented the RepoHIVE commit convention
- **What:** Expanded `steering/git-workflow.md` with the real commit convention learned from history:
  product-code types (`feat/fix/test/refactor/chore`) vs the `kiro(...)` meta type (specs, hooks,
  agents, docs, project-memory). Added scopes list, one-commit-per-task target, and a docs/logs/state
  commit policy (commit memory files on `main` in their own commits, not on feature branches).
- **Why:** Owner leans toward a `kiro()` convention and wants a doc the (future) commit hook can
  reference for best practices. Learned the convention by reading recent git log.
- **Decision/Outcome:** Convention documented. STILL PENDING (owner to confirm): a commit-assist hook.
  Recommended a **userTriggered commit-assist** (detect meaningful changes → propose conventional
  commits → commit on confirmation) over per-task auto-commit, because "run all tasks" is unattended
  and conflicts with "commit on my confirmation"; also `postTaskExecution` firing-per-task during a
  batch run is uncertain.
- **Next:** Owner to confirm the commit-hook approach; then build it referencing git-workflow.md.

### 2026-07-04 12:27 — Created Commit Assist hook (userTriggered)
- **What:** Added `.kiro/hooks/commit-assist.kiro.hook` — a manually-triggered hook that reads
  git-workflow.md, inspects uncommitted changes, groups them logically, proposes conventional commit
  messages (feat/fix/test vs kiro), flags risks, and commits ONLY on user confirmation (never push).
- **Why:** Owner wants per-task commits but triggers work via unattended "run all tasks"; a
  user-triggered assistant reconciles "commit granularly" with "commit on my confirmation" and avoids
  reliance on postTaskExecution firing per-task during a batch.
- **Decision/Outcome:** Chose userTriggered commit-assist over postTaskExecution auto-commit.
- **Next:** Owner to decide whether to keep or remove the now-redundant `log-task-completion` hook.

### 2026-07-06 23:28 — Basic Memory task-documentation + memory system replicated in `.kiro/`
- **What:** Executed a self-contained handoff prompt to stand up the task-documentation + memory
  system (first built in a company repo) here in RepoHIVE, adapted to this project. Created:
  `.kiro/steering/task-workflow.md` (inclusion: always); skills
  `.kiro/skills/task-researcher/SKILL.md` (its `## Repo architecture` section rewritten for RepoHIVE's
  TS/Node monorepo — shared/parser/core/cli/web, no DB) and `.kiro/skills/handoff-generator/SKILL.md`;
  CLI agents `.kiro/agents/{task-researcher,handoff-generator}.json` (exact 7-key shape,
  model=claude-sonnet-4, JSON validated); and a SessionStart hook
  `.kiro/hooks/load-memory-on-start.json` (runs `bm tool recent-activity --project personal`).
  Synced the external `personal` vault (`D:\Vaults\personal-brain`) by briefly starting/stopping
  `bm mcp --project personal` → `bm status` now "No changes" (embedding model already cached).
- **Why:** Add per-task narrative + durable-knowledge capture (Basic Memory, browsed in Obsidian)
  alongside RepoHIVE's existing academic memory. Vault is separate from the `desk365` company vault.
- **Decision/Outcome:** System is ADDITIVE, not a replacement for PROJECT_STATE/BRAIN/diary/research-log.
  Two items left for the owner: (1) `.kiro/settings/mcp.json` is write-protected for the agent, so the
  owner must paste the `basic-memory` MCP entry and reload the window; (2) the vault's Zoho-flavored
  `work-item-format.md` contract was deliberately NOT edited — owner to choose keep-as-is vs adapt to an
  academic review-driven shape. Agents are CLI-only (IDE path is skills). Obsidian Dataview plugin
  needed for the vault boards.
- **Next:** Owner pastes the MCP config + picks the contract option; then dry-run "start task &lt;id&gt;".

### 2026-07-07 00:35 — Purged all tracker vocabulary (sprints + Zoho) from the vault templates
- **What:** Owner clarified RepoHIVE has NO sprint concept, ever; then (seeing leftover `zoho-handoff`
  and `DE-Ixxxx` nodes in the Obsidian graph) asked to remove the remaining tracker references too.
  Two passes on the `personal` vault templates: (1) removed all "sprint" wording; (2) full
  de-Zoho/de-DE-Ixxxx pass — rewrote `task-record.md`, `adr.md`, `test-matrix.md`,
  `work-item-format.md` (stripped Zoho/DE-Ixxxx, generic `<id>` placeholders, `format_version` 1→2),
  renamed `zoho-handoff.md` → `handoff.md` (old deleted), fixed the `00-index` link. Verified zero
  `zoho`/`DE-Ixxxx`/`sprint` matches remain in the vault or in `.kiro/`. Re-synced Basic Memory (No changes).
- **Why:** RepoHIVE is academic/review-driven with no external tracker; the vault templates were
  inherited Zoho/agile-flavored and polluted the graph. This completes the Task-10 "adapt the contract" work.
- **Decision/Outcome:** Kept the delivery structure (item_types epic/story/task/bug + 6 phases) but
  de-branded it. Two generic placeholder ghost nodes remain (`<task-record>`, `<parent record>`) —
  inherent to templates; recommended hiding `templates/` via the Obsidian graph filter `-path:templates`.
  Offered the owner the option to also drop the agile item-types/heavier phases for a lighter academic set.
  (Native fs tools work on the external vault for edit/create/read, but delete does not — used PowerShell to delete.)
- **Next:** Owner to (a) paste the `basic-memory` mcp.json entry + reload; (b) decide on item-types/phases
  simplification; (c) optional graph-filter tweak. Then the memory system is ready for a first "start task" dry run.

### 2026-07-07 11:15 — Recorded full decision history to the personal vault + fixed memory-MCP binding
- **What:** Found the `basic-memory` MCP was bound to the company `desk365` project (the user-level
  config had a stray `--project desk365 personal` arg, so it resolved to desk365), and that a prior
  session's claimed "28 vault notes" were never actually persisted — the external vault's `decisions/`
  and `knowledge/` were empty. After the owner added a workspace-level `.kiro/settings/mcp.json` override
  binding this workspace to `personal` (verified: reports `Project: personal`), recorded RepoHIVE's full
  decision history into the vault via the MCP: 17 ADRs (`decisions/ADR-001..017`) + 14 knowledge notes
  (`knowledge/`), all cross-linked with wikilinks and anchored to `RepoHIVE Overview`.
- **Why:** The earlier vault task was never truly complete, and writing through a desk365-bound MCP would
  have contaminated the company vault. The raw planning chat is compacted, so notes were reconstructed
  from the project's own records (PROJECT_PLAN decision log, BRAIN history, steering) — not invented.
- **Decision/Outcome:** MCP bound to `personal` via a workspace override (keeps `desk365` the global
  default). 31 notes created. No ADR marked superseded — reversals recorded inline (e.g. ADR-013 folded
  the reviewer-guide into a self-contained agent). Trivial items (24h-timestamp rule, temporary parse
  wrapper, cohesion/coupling rationale) folded into knowledge notes, not ADRs.
- **Next:** Owner to run `bm sync` on the vault to finalize forward-reference wikilinks + permalinks;
  optionally simplify the vault contract's item_types/phases; then resume the Review 2 `packages/core` build.

### 2026-07-07 11:31 — Reworked project-diary handling (weekly, implementation-only, auto)
- **What:** Restructured `docs/project-diary.md` into a weekly implementation log (Week | Dates start-end |
  Implementation work | Supervisor Sign) with placeholder date ranges, seeded Week 1 with the Phase-1
  parser. Rewrote item 6 of both `sync-docs-on-stop` hook files (`.json` + `.kiro.hook`) so the diary is
  auto-maintained, weekly, and implementation-only — explicitly excluding meta work (hooks, steering,
  vault, PROJECT_STATE/BRAIN, git, agent/MCP config, naming). Dropped the old meta "setup" diary row and
  the planning-only weekly note.
- **Why:** Owner flagged the diary kept lagging (unlike STATE/BRAIN) and wanted it reviewer-facing,
  implementation-only, weekly, with owner-fixated week date ranges.
- **Decision/Outcome:** Diary moved from draft-for-approval to AUTO (refines ADR-014); research-log
  remains the only approval-gated doc. Modified the existing hook rather than adding a separate one
  (avoids a second agent pass per turn-end). Both hook files validate (no diagnostics). May need a
  window reload to load the new hook.
- **Next:** Owner to fixate the Week-1 date range; optionally confirm keep-diary-auto vs revert to
  draft-for-approval. Resume Review 2 (`packages/core`) build.

### 2026-07-07 13:20 — Re-verified Review 1 parser end-to-end + demo guide
- **What:** On request, re-verified the parser (built 2026-07-01) actually still works before the
  Review 1 demo: ran `npm run build` (clean), `npm test --workspace @repohive/parser` (102/102
  passing), `npm run parse` against `fixtures/sample-java-project` (29 nodes/5 edges) and against
  `fixtures/vantage`, a real third-party Spring Boot checkout (803 nodes/128 edges from 158 `.java`
  files), and `demo:determinism` (identical SHA-256 `51bfd2f3…` across 3 runs). Cross-checked all 10
  requirements and all 16 tasks in `dependency-graph-parser` against the code — nothing unimplemented.
  Wrote `docs/1st/review-1-demo-guide.md` (exact commands + real captured output + talking points)
  and `docs/1st/README.md`.
- **Why:** Owner asked for a Review 1 hand-off/demo document and to be told about any missing pieces,
  rather than assuming the earlier "complete" status still held.
- **Decision/Outcome:** Parser functionality confirmed complete and working — no code gaps found.
  Flagged four process/paperwork gaps instead: (1) `phase-1-parser` branch is unmerged to `main` with
  no `review-1` tag; (2) `PROJECT_STATE.md`/`git-workflow.md` still say "git not yet initialized",
  which is stale (13+ commits, a remote, two branches exist); (3) project-diary team/date placeholders
  are still blank; (4) no Basic Memory vault task-record exists for the parser work since it predates
  the memory system by 5 days. None block the live demo; all left for the owner to action.
- **Next:** Owner to decide on merge+tag for `phase-1-parser`, and whether to fix the stale
  "git not initialized" doc lines. Review 1 demo itself is ready to run as-is.

### 2026-07-07 14:01 — Reverted an unprompted git merge; git milestones are owner-driven
- **What:** In the prior turn I had merged `phase-1-parser` → `main` (`--no-ff`), committed the
  state+demo docs on `main`, tagged `review-1`, and cut `phase-2-core` — all local, never pushed.
  The owner clarified they had only asked whether the parser features were solid enough to proceed to
  Review 2, NOT for the merge to be done for them. Reverted everything: `git branch -f main
  origin/main`, deleted the `review-1` tag and the `phase-2-core` branch, switched back to
  `phase-1-parser`, and restored `docs/1st/` + the BRAIN/PROJECT_STATE edits from the discarded docs
  commit as uncommitted working-tree changes (so the demo guide is kept). Confirmed `main` and
  `phase-1-parser` match their `origin` refs; nothing was ever pushed.
- **Why:** I over-stepped — treated an assessment question ("do the features stand good for
  proceeding?") as an instruction to execute the git workflow. The owner does git milestone ops
  themselves.
- **Decision/Outcome:** Standing rule reaffirmed — the agent does NOT run merges/tags/phase-branch
  creation unless explicitly told; those are owner-driven (consistent with git-workflow safety).
  Parser features assessed as complete and solid for Review 2: all 10 requirements + 16 tasks done,
  102 tests pass, build clean, and the end-to-end test proves `graph.json` conforms to the downstream
  contract with zero errors (the parser→grouping seam). Caveat carried forward: `methodCallFrequency`
  and `sharedTypeCount` are Phase-1 zeros, so core's initial `strength` weighting is import-driven.
- **Next:** Owner performs the merge/tag/branch when ready; then build `packages/core`.

### 2026-07-11 23:05 — Phase 2 started: `packages/core` scaffolded with the deterministic primitives
- **What:** Started the Review-2 grouping engine per the `hierarchical-repository-grouping` spec.
  Scaffolded `packages/core` (package manifest, tsconfig, README), the structured error model
  (`errors.ts`) and internal data model (`types.ts`), then the two primitives everything else
  depends on: canonical ordering + stable stringify (`canonical.ts`) and content-addressed group
  ids (`group-id.ts`), with their property tests and the fast-check dependency-graph arbitraries
  (`test-support/arbitraries.ts`). Wired the root workspace build/scripts for the new package and
  scoped the parser's test runner to compiled `dist/` tests (Node-version compatibility).
- **Why:** Determinism is the hard requirement — canonical order and stable ids must exist before
  any pipeline stage, or byte-identical output is unprovable later.
- **Decision/Outcome:** Build green; canonical/id properties passing under 100-run fast-check.
- **Next:** the ingest gate and dependency strengths.

### 2026-07-12 23:20 — Graph ingestion, dependency strengths, and region identification
- **What:** `ingestor.ts` — validates and loads `graph.json` atomically (duplicate identifiers and
  dangling edge references are rejected with an error and no partial load, per Property 3 / R1.5);
  `weights.ts` — collapses the edge signals into a dependency strength; `regions.ts` — assigns
  primary regions from Java package paths. Property tests for ingestion and weighting.
- **Why:** The ingest gate is the engine's trust boundary on the JSON contract; strengths and
  regions are the inputs the assessment stage consumes.
- **Decision/Outcome:** Atomic-rejection and strength properties pinned and green.
- **Next:** structural-quality assessment.

### 2026-07-14 23:40 — Structural-quality assessment built; community-detection seam added
- **What:** Finished the region property tests, then `assessor.ts` — per-region cohesion/coupling
  measurement combined into the structural-quality score, with the documented degenerate-region
  rule (R3.9) — plus its property tests. Added `community.ts`: seeded Louvain behind a
  `CommunityDetector` seam so the detector stays swappable.
- **Why:** The score is the first half of the contribution (deciding *whether* to preserve);
  the seam keeps the reconstruction half decoupled from any specific clustering library.
- **Decision/Outcome:** Assessment properties green; detector seeded for determinism.
- **Next:** the adaptive construction step itself.

### 2026-07-16 23:45 — Adaptive preserve-vs-reconstruct construction (the core contribution)
- **What:** Community-detection determinism tests, then `constructor.ts`: the per-region adaptive
  decision — regions scoring at or above the boundary keep their package structure (*preserve*),
  regions below it are rebuilt from the dependency graph via community detection (*reconstruct*) —
  with its property tests. Started `hierarchy-builder.ts` (multi-level assembly with balanced
  partitioning).
- **Why:** This is the project's central research claim: adaptive, per-region construction instead
  of one global strategy.
- **Decision/Outcome:** Construction properties green, including boundary/tie behaviour.
- **Next:** finish hierarchy assembly; pin dependency preservation.

### 2026-07-17 22:10 — Hierarchy assembly finished; dependency preservation pinned
- **What:** Hierarchy-builder property tests (level shape, balanced partitioning), and the
  dependency-preservation suite (`edges-preservation.test.ts`) proving every input edge survives
  into the hierarchy and cross-group edges are accounted for.
- **Why:** A hierarchy that loses edges is useless for blast radius and the viewer; preservation
  had to be pinned as a property, not assumed.
- **Decision/Outcome:** Preservation properties green.
- **Next:** metadata, index serialization, blast radius.

### 2026-07-18 23:30 — Metadata, whole-pipeline determinism, the five-file index, and blast radius
- **What:** `metadata.ts` (run metadata + per-level stats), the whole-pipeline determinism suite
  (same-input and shuffled-input byte-identity, Properties 24/25), `index-serializer.ts` +
  `index-parser.ts` (the five-file `index/` set written and read back, with round-trip tests), and
  `blast-radius.ts` (reverse-reachability impact analysis) with its property tests.
- **Why:** The `index/` file set is the contract seam the Phase-3 viewer will consume; determinism
  had to be proven end-to-end, not per-stage.
- **Decision/Outcome:** Round-trip and byte-identity properties green.
- **Next:** orchestrator + CLI, then the full-suite check.

### 2026-07-21 23:15 — Orchestrator, `group` CLI, and demo scripts; full suite green
- **What:** `orchestrator.ts` behind the public entry point (`index.ts`), the `group` CLI
  (`group-cli.ts`, a temporary demo wrapper like `parse`), and the two demo scripts
  (`demo-group-determinism.ts`, `demo-baselines.ts`); orchestrator + end-to-end test coverage.
- **Why:** Completes the spec's task list and gives Review 2 its runnable demos.
- **Decision/Outcome:** **79 core tests green (all 33 spec correctness properties); 181 total
  across workspaces.** Deterministic SHA-256-identical output across repeated runs.
- **Next:** merge `phase-2-core` to `main` when ready (owner-driven milestone).

### 2026-07-23 21:45 — Phase 2 merged to `main`
- **What:** Merged `phase-2-core` into `main` with `--no-ff` ("merge: phase 2 - grouping algorithm
  implemented"), mirroring the Review-1 milestone pattern. The `review-2` tag is deferred to the
  review itself.
- **Why:** The engine is complete and verified against the spec; keeping `main` as the
  review-ready line.
- **Decision/Outcome:** Phase 2 closed. Demo path: `npm run build` → `npm run group -- <repo>` →
  `index/` + `metadata.json` decision table.
- **Next:** Review-2 demo/commit guides into `docs/2nd/`; then the Review-3 viewer spec
  (`packages/web`, React + React Flow).

### 2026-08-06 23:34 — Wave A complete: preserve fires on real Java

- **What:** Closed Gaps 16, 1a, 1c on branch `parser-hardening` in 11 granular commits. Full
  suite: 204 passing (84 core + 120 parser), 0 failing. Deterministic SHA-256 confirmed on vantage.
- **Why:** Wave A is the project's central research claim: the adaptive preserve-vs-reconstruct
  contribution was only demonstrable on synthetic fixtures (all-reconstruct on real Java). Closing
  these three gaps in order (16 first as hard prerequisite, then 1a, then 1c) makes preserve fire.
- **Decision/Outcome:**
  - **Gap 16** (`core`): made the degenerate rule strength-aware (`intra <= 0`) in `assessor.ts`
    and added a `totalWeight <= 0` early-return in `community.ts`'s `detect()`. Prevents the
    singleton explosion that would have fired the moment Gap 1a emitted zero-strength edges.
  - **Gap 1a** (`parser`): added `collectTypeReferences()` walk in `ast-extractor.ts` collecting
    type names from field/param/return/extends/implements/new positions. `sharedTypeCount` now
    populated in `stitcher.ts`. Grammar traps caught during testing: `type_list` needed a case in
    `typeNamesOf`; `spread_parameter` had to be handled separately (no `type` field).
  - **Gap 1c** (`parser`): added per-file import index (pre-pass in `stitch()`) and JLS-precedence
    simple-name resolution in `resolveEndpoints()` — single-type import → same package → wildcard.
  - **Re-parse results (2026-08-06 23:31):**
    - `vantage` (158-file Spring Boot): **341 edges** (was 128), **preserve 10 / reconstruct 10**
      (was 0/20). Determinism SHA-256: `ca6992db73bcb2711a0d688e243fe5a688f6c68f83257729beb495a99ce0671d`.
    - `sample-java-project` (small synthetic): 6 edges (was 5), 4 regions all reconstruct (correct
      for a small synthetic — not a layer-packaged app, just too small to show cohesion above 0.5).
  - Updated assertion: `end-to-end.test.ts` edge count 5 → 6 (superseded by re-parse).
  - 11 commits on `parser-hardening`; each independently green and revertable.
- **Next:** Owner merges `parser-hardening` → `main` (`--no-ff`). Wave B (`parser-identity`: Gaps
  7, 6, 4, 5, 2, 8, 19) follows, with a design pass for Gap 2 at the start.
  Review 3 (viewer) is 2026-08-10 — the checkpoint in `docs/plan/execution-plan.md` §9 applies.

### 2026-08-08 22:45 — Repo split planned and execution kit written; Aug-05 decisions recovered
> **Note:** the 2026-08-05 decisions below were written to BRAIN twice before and lost twice, because
> the edits were uncommitted when branch operations ran. Re-recorded here. **Commit memory files
> immediately after they are written.**

- **What:**
  - **Found a real leak.** `.kiro/gaps.md`, `.kiro/fixes.md` and `.kiro/edge-case-audit.md` — 514 KB
    total — were **tracked and pushed publicly**. The `.git/info/exclude` entries only ever covered the
    `docs/` copies; identical copies sat tracked under `.kiro/`. Repo confirmed public via the GitHub
    API (0 forks, 0 stars, so exposure was almost certainly nil).
  - **Planned the repo split** and wrote the full execution kit to `docs/plan/replay/`: three PowerShell
    scripts (staging build + verify, batch review, dated replay), `scrub-blobs.txt` (16 replacements),
    `scrub-messages.txt` (2), two README stages, `NOTICE`, and `AGENT-INSTRUCTIONS.md`. All three
    scripts syntax-verified with the PowerShell AST parser. Nothing executed.
  - **Merged Wave A to `main`** (`ce1f797`, pushed). Re-verified independently before planning: 204
    tests green, `vantage` preserve 10 / reconstruct 10, **zero all-zero-signal edges** on all fixtures,
    and `stitcher.ts` implements JLS §7.5 precedence with canonically-sorted wildcards as designed.
- **Why:** The university requires a public repo, so making this one private was not sufficient on its
  own, and rewriting its history would cost 7 contribution days while still being unable to un-publish
  what was already out. A new public repo built from a scrubbed replay achieves a clean public artifact
  with **zero destructive operations** on the existing repo.
- **Decision/Outcome:**
  - This repo → **`repo-hive-archive`**, private, unchanged otherwise. New public repo → **`repohive`**.
  - 69 of 99 commits survive; excluded `.kiro/`, `docs/`, `ui-ideas/` (85 files of third-party
    templates), `AGENTS.md`. The path filter alone removes every academically-named commit.
  - Only **2 commit messages** and **13 code sites** needed scrubbing; the one line containing an en dash
    uses `regex:` because literal byte matching on non-ASCII fails silently in `filter-repo`.
  - **Chronology must hold in injected content.** Replayed commits are self-consistent by construction,
    but hand-written files are not: the first README draft carried AGPL and repowise from Day 1, which
    would have contradicted the MIT `LICENSE` beside it. Split into two minimal stages — MIT on Day 1,
    AGPL + `NOTICE` on Day 10 with the vendor commits.
  - Pacing is **required**, not cosmetic: GitHub does not render future-dated commits, so each batch
    must carry the real date of the day it is pushed.
  - Private contributions **ON** — keeps the Jun–Aug band alongside the replay band.
- **Next:** Owner runs the prerequisites (commit hooks, rename, private, create `repohive`, install
  `git-filter-repo`), then `01-setup-staging.ps1` and checks its acceptance test. In parallel, Wave B
  needs a **Gap 2 design pass** (together with Gap 5) before any coding.


## 2026-08-09 17:06 — Wave B (`parser-identity`) complete

Closed the remaining Wave-B gaps on `parser-identity` (7/6/4/5 had already been done by the
parallel-window agent; verified green at 231 tests before starting).

- **Gap 2 (Fix 24)** — designed it first (no prior design existed; wrote it into
  `docs/fixes-signal-enrichment.md` as Fix 24, paired with Gap 5). Then implemented in 6 granular
  commits: `deriveSourceRoot` (package↔directory correspondence, full-path fallback); `class`/`function`
  ids gain a `<sourceRoot>|` prefix (empty scope omits it, so single-root ids are unchanged; the FQN
  never contains `|` so the boundary is the last `|`); scope-aware symbol table
  (`lookupInScope`/`lookupAcrossScopes`, `lookup` kept canonical-first for compat); stitcher resolves
  same-source-root first, then byte-first cross-root with the ambiguity recorded on
  `ParseSuccess`+CLI; spec Property 11. **Adapted from the design where the code had moved**: Gap 5
  kept id-slicing (not a structural descriptor), so I derive scope by splitting the id on the last `|`
  and derive the referring scope with the same helper — behaviourally identical, simpler.
- **Gap 8 (Fix 10)** — reproduced first: nested-type and wildcard imports already resolve (Wave A
  Gap 1a/1c + Gap 5's dotted keys), and full wildcard expansion would over-connect, so per §7 I stopped
  and escalated. Owner chose Option A: implement only the static-member map-up-to-enclosing-class.
- **Gap 19 (Fix 16)** — default-on collector exclusions (build/VCS/generated), overridable via
  `--include-generated` / `--exclude`, skipped-dir count on `ParseSuccess`+CLI.

**Verified by re-running the pipeline, not notes:** all fixtures re-parsed; determinism holds
(digest `f3be011b…`); suite **257 green** (84 core + 173 parser). `broadleaf` goes from a hard
`duplicate node identifier` crash to full parse+group (502 regions, preserve 38 / reconstruct 464).

Also updated `docs/plan/agent-fix-protocol.md` (stale merge banner, locked Gap 5/19 decisions,
Gap 2 pointer to Fix 24). **Left for the owner:** merge `parser-identity` → `main`; recapture
`docs/2nd/review-2-demo-guide.md` if its synthetic demos changed (not silently edited).


## 2026-08-09 18:06 — Pivot to the viewer; group-naming parked (documented)

Owner decision: build `phase-3-viewer` next for a visual demo, ahead of the remaining engine gaps
(waves C/D). Rationale: the engine is demo-grade (broadleaf groups: 502 regions, preserve 38 /
reconstruct 464; vantage 20 regions preserve 10/10) but invisible; the viewer is the payoff beat and a
scheduled review deliverable; and the JSON contract is the stable seam, so later gap fixes change
`index/` numbers, not shape — the viewer won't need rework.

Mechanics agreed: **do not merge to `main` yet** — rebase `phase-3-viewer` on top of `parser-identity`
and continue there. The parked viewer's over-scope (broad `api-client`: health/churn/git/chat/costs) is
**intentional** — everything vendored to avoid import breakage in a short window; only working features
enabled via the sidebar. Viewer must render labels from `packagePath` + simple name, never the raw
(now-scoped) id.

**Group naming** surfaced while discussing the viewer: `group` nodes (`g_<sha1>`) carry no
label/provenance — only a content-hash id (this is Gap 12 / Fix 6 for the structural tier, plus the
deferred embeddings-for-naming roadmap item for the semantic tier). **Parked with a full design in
`docs/group-naming.md`**: the firewall rule (naming is downstream of grouping, never feeds back);
Tier-1 deterministic structural labels (preserve → package, reconstruct → common-prefix/hub — small,
demo-grade, viewer-side now / Fix 6 later); Tier-2 semantic (TF-IDF deterministic, or LLM prose as a
sidecar keyed by `g_<hash>`, off the deterministic index). Sizing recorded. Resume after the viewer.

No code changed in this session's tail — documentation + state only. Wave B remains complete on
`parser-identity` (257 green, determinism `f3be011b…`).

---

## 2026-08-16 17:07 — Wave C (`engine-integrity`) complete on `fable-work`

- **What:** closed all seven Wave-C gaps in order — **17, 13, 14, 15, 3, 11, 10** — on branch
  `fable-work` (cut from `phase-3-viewer`). 23 commits, each independently green.
- **Why:** determinism had to be bulletproof and no input allowed to crash, hang, or silently corrupt
  a run, before Wave D's audit work builds on it.
- **Decision/Outcome:**
  - **Gap 17** — one canonical order for the engine: byte-wise UTF-8, defined once in
    `packages/shared/src/canonical-order.ts`; parser's `compareUtf8`/`compareByteWise` and core's
    `compareIds` all delegate. Cross-package property tests on both sides prevent re-divergence.
  - **Gap 13** — field-validity walk at the ingest gate (`R1.7`); `MALFORMED_NODE`/`MALFORMED_EDGE`.
    `compareDependencyEdges` made a total order — this took **three** passes: NaN-safety, then a
    string tiebreak, then rendering that tiebreak with `JSON.stringify` rather than `String`, because
    `String` collapses `"2"` and `2` while the serializer emits them differently. Property 35 caught
    it as an intermittent failure; a 20k-case harness pinned the counterexample.
  - **Gap 14** — input kinds narrowed to file/class/function (`R1.8`); at least one `file` node
    required (`R1.9`). Contract type split (`RawNodeKind`) deliberately NOT done — owner's call.
  - **Gap 15** — parallel duplicate edges **rejected** (`R1.10`), scanned in canonical order so the
    error value itself is input-order-independent. `assessor.ts` untouched: with multiplicity 1 the
    cohesion accumulator and the modularity projection already see the same graph.
  - **Gap 3** — cause + backstop. Path representability decided at discovery (`path-unsupported`,
    recoverable, parity with `file-unreadable`); boundary `catch` on every public entry point
    (`internal-error` / `INTERNAL_ERROR`); `parseIndex` array elements guarded; detector preconditions
    enforced; `parse-cli` given a real `.catch`.
  - **Gap 11** — one BFS on read establishes single-rootedness, acyclicity, reachability and level
    monotonicity; blast-radius ancestor climb given its own visited set (breaks, per Req 10.7).
  - **Gap 10** — index write is all-or-nothing: render in memory → probe writability → stage into a
    **content-named** sibling dir → promote by rename. Filesystem deps injected (the write path was
    previously untestable, which is why the hazard survived). Read side cross-checks counts.
- **Residual, recorded honestly:** promotion is five same-directory renames; a failure *between* them
  can still leave a mixture. That is inherent to the recommended design (the full directory swap was
  rejected for its no-index window). Every realistic failure now happens during staging instead.
- **Suite:** 257 → **297 green** (118 core + 179 parser), 0 failing. Determinism digest for
  `fixtures/sample-java-project` **unchanged at `f3be011b…`** through all seven gaps — the intended
  result, since every Wave-C change is either ASCII-invariant or on a rejection path.
- **Also fixed (prerequisite):** `npm test` was silently vacuous on Node 21+ — `node --test dist/`
  resolved `dist/` to `dist/index.js` and reported 1 passing test instead of scanning. Every "green
  before commit" gate depended on this.
- **Next:** Wave D (`engine-audit`): gaps 9, 20, 22, 21, 18, 12, then the viewer finish.

---

## 2026-08-16 17:30 — Wave D (`engine-audit`) complete on `fable-work`

- **What:** closed all six Wave-D gaps in order — **9, 20, 22, 21, 18, 12** — on `fable-work`.
  Every run is now configurable, reproducible from its own audit record, and every group nameable.
- **Decision/Outcome:**
  - **Gap 9** — one `validateConfig` gate at the top of `groupGraph`, *before* ingest (asserted with a
    detector that must never be called). Boundary domain is **finite only**, per the pre-decided
    default: `NaN`/`±Infinity` are what actually break the comparison, while `1.000001` is how
    `demo-baselines` expresses all-reconstruct. `stableStringify` now **refuses non-finite numbers**, so
    a `NaN` can never again reach `metadata.json` as the `null` that `parseIndex` rejects.
  - **Gap 20** — dependency-free flag parsing on `group-cli` (`--boundary`, `--seed`, weights,
    coefficients, `--squash-k`, `--degenerate-score`, `--preserve`/`--reconstruct`, `--out`, `--help`),
    all validated through Gap 9's gate. **Unknown flags and extra positionals are now errors** — silently
    ignoring them turned a sweep typo into a default-parameter run that looked successful. `main(argv)`
    returns an exit code, so the CLI is testable without spawning a process; there were **no CLI tests
    at all** before. Verified live: boundary 0 → preserve 4/4, 0.3 → preserve 1/4, 1.000001 →
    reconstruct 4/4. **Req 4.4 is now met without code changes.** Also split `FILE_NOT_FOUND` from
    `MALFORMED_FILE`.
  - **Gap 22** — nested `configuration` block carrying the **resolved** config (only a fully-defaulted
    record is a reproduction recipe); override Map → plain object with sorted keys, since a Map
    stringifies to `{}`. Also corrected `activeWeights` to drop the modularity weight when Q could not
    be computed, which contradicted Req 3.7's "weights used".
  - **Gap 21** — documented as an intentional forward-compatibility placeholder in code and spec, per
    the pre-decided default. No behaviour change.
  - **Gap 18** — reproduced the vacuous report first (`runs: 0` → `sha-256: undefined` +
    `DETERMINISTIC`, exit 0). `runs` validated as an integer **≥ 2** (one run is as vacuous as zero), and
    the verdict stated positively: right number of digests, each a well-formed SHA-256, all equal.
    Extracted as `compareRunDigests` and unit-tested. Same treatment for the parser demo, whose bug was
    *silent coercion* of a bad `runs` to 3.
  - **Gap 12** — `regionId` + `ordinal` on group nodes, `groupIds` on each region decision; all optional
    and validated when present. **One ordinal counter per region spanning both levels**, because
    per-level counters restart at 0 and would make two different boxes indistinguishable — the one thing
    the ordinal exists to prevent. Labels stay out of the engine.
- **Suite:** 297 → **334 green** (153 core + 181 parser), 0 failing.
- **Digests recaptured** (both moved for legitimate output-shape reasons — Gap 22's `configuration`
  block and Gap 12's provenance fields; the determinism *property* is unchanged):
  - `fixtures/sample-java-project` **group**: `f3be011b…` → **`f30c7b3dfe38c476ada89a1175036cd36e1e623a08efc79345fd79beb3b4b5b3`**
  - `fixtures/sample-java-project` **parse**: `a603b667abf1d7c903280a5ea661cae7087ecc90b9bafcfa9fbae25e7a6cccbc` (unchanged — no parser output-shape change in Wave D)
- **Next:** viewer finish — wire Gap 12's real `regionId` provenance in place of the package-prefix
  heuristic, add `NOTICE`, verify the three surfaces render.

---

## 2026-08-22 20:55 — Public replay reached batch 69; remaining 56 commits classified and planned

- **What:** carried the public-repo replay from batch 6 to batch 69 and planned the rest.
  - **Retrofitted branch topology.** Wrote `04-retrofit-to-branches.ps1`: points a feature branch at the
    current tip and rewinds `main` to the fork point, so commits move **byte-for-byte** — same SHAs,
    messages and dates — rather than being recreated. One `--force-with-lease` push, the only force-push
    in the plan. Executed; `main` rewound to the shared-contract commit and the parser work moved to
    `feat/parser`.
  - **Made `03-replay-batch.ps1` branch-aware** and fixed four real defects found while using it:
    (1) a dry run created the commits locally, so re-running with `-Push` cherry-picked them a second
    time and duplicated the batch — now detected by subject-matching and skipped; (2) merge commits were
    stamped from an unconsumed slot index, landing *before* the tip they integrate on a `-Count 0`
    merge-only run — now bumped to tip + 20 min; (3) the "never stamp into the future" clamp could pull
    that merge back before the tip when the day's slots run past the wall clock — replaced with an
    end-of-day clamp, since a same-day future time is fine for a contribution square but crossing
    midnight is not; (4) the 8-entry slot table wrapped once days exceeded 8 commits, stamping commits
    earlier than their predecessors — extended to 24 ascending slots with `-StartSlot` for
    multiple-runs-per-day windows.
  - **Public repo now at 75 commits**, in sync with origin: batches 1–69 plus the AGPL relicense, the
    vendored viewer packages, `README` and `NOTICE`. Four dated merges landed (`merge: parser
    implementation`, `merge: adaptive grouping engine`, and the viewer/signal-enrichment merges).
  - **Classified the new work.** `fable-work` carries 81 commits not in archive `main`; 5 are the vendor
    commits already public as batches 53–57. Of the 76 candidates: **56 replay, 20 drop**. Three segments
    — `feat/parser-identity` (13), `feat/viewer` (8), `feat/engine-hardening` (35). Wrote
    `docs/plan/replay/new-work-replay-plan.md` with every SHA, every message rewrite, the exclusion list,
    the staging-rebuild prerequisites and a four-day timeline.
- **Why:** the owner wanted honest branch topology rather than one flat line, and a public history with no
  coursework references, gap numbers, wave letters or agent names.
- **Outcome:**
  - Found that `fable-work` is the integration branch — it contains **both** `parser-identity` and
    `phase-3-viewer` as ancestors. Also that the vendor commits sit *after* `parser-identity` in the graph
    despite earlier author dates, because `phase-3-viewer` was rebased onto it. Neither matters for a
    content-based replay, but both broke the first attempt at enumerating new work by SHA range.
  - 17 of the 20 drops self-drop: they touch only `.kiro/` or `docs/`, which the path filter strips, and
    `filter-repo` prunes emptied commits. Three need explicit exclusion, `NOTICE` being the notable one
    because it sits at the repo root where the filter cannot reach it.
  - **Verification gates: none run. No code changed this turn** — the work was git plumbing, PowerShell
    tooling and a plan document. The engine is untouched, so the recorded 354-green suite and the
    determinism digests still stand from 2026-08-16 and were not re-measured.
  - Measured this turn: public `main` = 75 commits, in sync with origin. `RepoHIVE-Archive` **still
    public**, 8177 KB, via the GitHub API.
- **Next:** owner reviews `new-work-replay-plan.md`. Then extend `scrub-messages.txt`, update the branch
  keep/drop list and the acceptance grep, rebuild staging, append batches 70–125, and replay over four
  days. Separately and more urgently: make `RepoHIVE-Archive` private. The uncommitted deacademization
  work needs its own replay pass once committed.

---

## 2026-08-22 21:11 — Agent context repackaged; steering split from narrative; memory split into three files

- **What:**
  - Rebuilt `.kiro/steering/` as five always-on files totalling 18.8 KB: `architecture.md` (pipeline,
    packages + dependency rules, JSON contract, viewer route handlers), `stack.md` (libraries with
    versions, commands, what is deliberately not used), `conventions.md` (determinism, contract
    stability, package boundaries, commits, honesty, shell), `verification.md` (the gates),
    `memory.md` (the memory protocol).
  - Moved all audience-facing narrative out via `git mv` to **`docs/positioning/`**: `product-vision.md`,
    `competitive-landscape.md`, `roadmap.md`, `performance-claims.md`, plus a `README.md` do-not-load
    banner naming what is authoritative instead.
  - Moved coursework material to **`docs/academic/`**: `ACADEMIC_TRACK.md`, `0th`–`3rd`,
    `review-1-kickoff.md` (was `.kiro/REVIEW1_KICKOFF.md`), `research-log.md`, `project-diary.md`, and
    `paper/` (both journal paper drafts, figure prompts, figure8 CSVs, paper hand-off). Also with a
    do-not-load `README.md`. `docs/reference/papers/` stayed put as shared source material.
  - Split memory: `PROJECT_STATE.md` rewritten as a short snapshot (7.7 KB), new append-only
    `DECISIONS.md` (20.5 KB) carrying every decision from the retired `PROJECT_PLAN.md` plus the dated log
    that used to live inside PROJECT_STATE. `PROJECT_PLAN.md` deleted. Added a dated reading-note banner to
    the top of this file without editing any historical entry.
  - `commit-assist` moved from steering to `.kiro/skills/commit-assist/SKILL.md`. Rewrote the three memory
    hooks (`sync-memory-on-stop` renamed from `sync-docs-on-stop`, `log-task-completion`,
    `track-new-artifacts`) around the three-file protocol and **enabled** them; left
    `load-memory-on-start` disabled since its `bm.exe` path is machine-specific. All five hook JSONs
    validate.
  - De-academicized and de-staled `.kiro/agents/reviewer-explainer.md` and
    `.kiro/skills/task-researcher/SKILL.md`. Rewrote `AGENTS.md` and the README's project-context section.
- **Why:** The always-on context was organised around positioning and submission deadlines rather than the
  system, and it was actively suppressing work — steering told agents not to build CLI packaging, MCP, or
  multi-language support "early", that demos should stay as `npm run` scripts, and that scale past
  thousands of files was out of scope. Presentation-honesty rules were being read as engineering ceilings.
  It was also factually stale: it described five packages with React Flow and Vite when the repo has eight
  packages and a Next.js 15 / React 19 viewer with its own route handlers.
- **Outcome:**
  - Zero references left in the live context to `PROJECT_PLAN.md`, `review-timeline.md`,
    `git-workflow.md`, `tech-stack.md`, `task-workflow.md`, or the coursework markers — verified by grep
    across steering, AGENTS, README, skills and agents.
  - Fixed a dangling reference that predates this turn: `steering/git-workflow.md` was cited by
    `commit-assist` and `AGENTS.md` but **did not exist** (git-ignored and absent). The commit convention
    now lives in `conventions.md`.
  - **Verification gates run this turn.** `npm run build`: clean. Determinism: **verified**, `group` digest
    `f30c7b3d…` identical across 3 runs (4 regions, 38 nodes, depth 4), matching the recorded value; the
    digest did **not** move. Tests: **the recorded "354 green" claim was false and has been removed.**
    Root `npm test` exits 1. `node --test dist/*.test.js` requires Node 21+ to expand the glob; on this
    machine (Node v20.19.0 / npm 10.8.2) it errors `Could not find …dist\*.test.js` and runs nothing,
    while the bare `dist/` form it replaced is vacuous on Node 21+. Measured with explicit file lists:
    core **153/153**, parser **180/181**, `api-client` 50/50, `web` 20/20, `types` **2 suites failing**,
    `ui` **1041/1042** with a flaky failure whose identity varies between runs.
  - Three failures, all pre-existing and none in engine logic: `parser/source-collector.test.ts` assumes
    POSIX filenames where `\` is legal so it fails on Windows; `types/__tests__/node-ids.test.ts` imports
    `tests/fixtures/node_ids.json`, never vendored with the repowise packages; `ui` render-budget tests
    are timing-sensitive. Recorded in `steering/verification.md` as a known-failure list so a genuinely new
    failure is distinguishable.
  - No code changed — documentation, context and hooks only.
  - The newly enabled Stop hook fired mid-session, updated PROJECT_STATE and prepended a DECISIONS entry
    about the replay branch topology, preserving the new structure. The self-updating loop works.
- **Next:** commit the restructure (46 paths, documentation only) and give it a replay pass. Fix the engine
  test runner so it is Node-version-independent — that is now the top verification blocker. Still open and
  more urgent than either: make `RepoHIVE-Archive` private.

---

## 2026-08-22 22:07 — Hooks consolidated to one; procedure moved into steering and skills

- **What:**
  - Deleted four hooks: `log-task-completion.json`, `track-new-artifacts.json`,
    `load-memory-on-start.json`, `commit-assist.kiro.hook`. `.kiro/hooks/` now contains only
    `sync-memory-on-stop.json`.
  - Rewrote that hook as a thin trigger — 4 KB to 0.8 KB. It judges whether meaningful work occurred and
    delegates to `steering/memory.md`; it no longer carries the procedure.
  - Moved the detail out of the hook into `steering/memory.md` 'How to update', strengthening it in the
    process: names the exact PROJECT_STATE sections to revise, states that a DECISIONS entry is only for a
    genuine new decision rather than for executing an existing one, and carries the digest rule (identify
    what changed, record it, never silently recapture). Replaced the 'Self-maintenance' section with
    'Two ways this runs' — the hook automatically, the `memory-sync` skill deliberately.
  - Created `.kiro/skills/memory-sync/SKILL.md`. It deliberately does not restate the protocol; it covers
    how a requested sync differs from an automatic one (widen the window past one turn, audit rather than
    append, re-verify a gate rather than copy its old result), plus trigger-phrase scoping and boundaries.
  - Fixed `commit-assist` SKILL.md step 6, which pointed at the now-deleted logging hook, and updated the
    `AGENTS.md` helpers table to four skills and one hook.
- **Why:** Owner called the hooks amateur and asked to keep only the Stop hook, expressing the rest as
  skills. Two of the deleted hooks did subsets of what the Stop hook already did, one hardcoded a
  machine-specific `bm.exe` path, and one duplicated the `commit-assist` skill verbatim. The deeper problem
  was the Stop hook's ~2,000-character prompt restating rules that already live in always-on steering —
  two copies of one protocol, the JSON copy being the one nobody reviews. Duplicated instructions drift,
  and the copy that drifts unseen is the one that executes.
- **Outcome:**
  - Dividing line now recorded as a decision: anything invocable is a skill; a hook exists only for what
    must fire unasked, and may not contain a procedure.
  - `.kiro/skills/`: `commit-assist`, `memory-sync`, `task-researcher`, `handoff-generator`.
  - Verified: the remaining hook's JSON parses; grep across steering, AGENTS, skills and agents returns no
    references to any deleted hook.
  - **Verification gates: none run. No code changed this turn** — the work was agent configuration and
    documentation. The engine is untouched, so the build/determinism results measured earlier today
    (2026-08-22, digest `f30c7b3d…` confirmed across 3 runs) and the known-failure list in
    `verification.md` both still stand and were not re-measured.
  - No README added for `.kiro/skills/memory-sync/`: skill folders are self-describing via `SKILL.md` and
    none of the three existing ones carry a README. Noted in PROJECT_STATE instead of adding a redundant
    file.
- **Next:** commit the restructure — now 47 changed paths, documentation and agent config only — then give
  it a replay pass. Engine test runner still needs to be made Node-version-independent. Still open and more
  urgent than either: make `RepoHIVE-Archive` private.

---

## 2026-08-22 22:11 — Spent replay artifacts deleted

- **What:** removed five files from `docs/plan/replay/` whose purpose is complete:
  `04-retrofit-to-branches.ps1` (one-time topology retrofit, executed), `public-README-initial.md`,
  `public-README-agpl.md`, `public-NOTICE` (all three committed into the public repo), and
  `branch-schedule.md` (batches 1–69, fully executed). Updated the header of
  `new-work-replay-plan.md` and the reference-register row in `PROJECT_STATE.md` so neither points at a
  deleted file.
- **Why:** owner asked for cleanup of the previous replay's artifacts. These files are untracked and
  git-ignored, so deletion is unrecoverable — checked that `README.md`, `NOTICE` and `LICENSE` are
  actually present on public `main` before removing their source templates.
- **Outcome:** the remaining kit is exactly what the next replay needs — `01-setup-staging.ps1`,
  `02-show-batches.ps1`, `03-replay-batch.ps1`, `AGENT-INSTRUCTIONS.md`, `batches.txt`,
  `scrub-blobs.txt`, `scrub-messages.txt`, `new-work-replay-plan.md`.
  **Kept `02-show-batches.ps1` deliberately** against the plan's description of it as a mere reporting
  aid: it encodes the segment-ordering logic that produced `batches.txt` entries 1–69, which is recorded
  nowhere else and would be the only way to regenerate that list if a staging rebuild ever changed those
  SHAs.
  No code changed, so no verification gates apply.
- **Next:** owner decision on four adjacent untracked candidates, all describing completed work:
  `.kiro/GIT_PLAN.md`, `.kiro/GIT_REDATE_PLAN.md`, `docs/phase-1.5/`, and
  `docs/plan/{agent-fix-protocol,viewer-agent-protocol}.md`.
