# Project State

> **Read first every session.** Live snapshot of what is true right now — not a log.
> Rewrite sections in place; delete superseded text rather than annotating it. Keep this file short.
> Why things are the way they are: `DECISIONS.md`. What happened when: `BRAIN.md`.

Last updated: 2026-08-29 22:29

---

## Current position

The engine is **complete and audited**. All 22 hardening gaps are closed across four waves, and the
viewer finish landed with wave D on branch **`fable-work`**.

The remaining gap is **reach, not capability**: the pipeline can only be driven by `npm run` scripts from
inside this workspace. Four forward paths are scoped — component reuse, packaged CLI, MCP server, hosted
deployment — with scope, blockers, plans and the open decisions in **`.kiro/workstreams.md`**.

**Execution shape (owner, 2026-08-23): all workstreams run in parallel, in separate worktrees.** The
"which path first" question is closed; do not re-propose an ordering. An **academic deadline is live**, and
polishing the existing viewer with a few more components is sufficient for it.

**Current focus (owner, 2026-08-29): the viewer is handed to Fable; everything else is on hold.** The brief is
`docs/viewer-handoff.md`. The CLI, seams, MCP and hosted tracks are paused mid-planning — not cancelled, and
their decisions all stand. The viewer-component question that was parked is now **open and delegated**, with
Fable explicitly cleared to build new components rather than only reuse vendored ones.

**Branch:** `fable-work`, treated as the **default**. No merge to `main` will happen. Branch placement of
memory and doc commits, and the git/replay plans, are out of scope for workstream planning.

## Verified state

Measured 2026-08-22 on Node v20.19.0 / npm 10.8.2.

| Gate | Result |
|------|--------|
| `npm run build` | **clean** |
| Determinism | **holds** — `group` digest `f30c7b3d…` identical across 3 runs, matches the recorded value |
| Engine tests | **core 153/153**, **parser 180/181** (the one Windows failure is `source-collector` test 124) |
| Other workspaces | `api-client` 50/50, `web` 20/20; `types` 2 suites fail, `ui` 1 flaky — both pre-existing, vendored |
| Root `npm test` | **exits 1.** Not usable as a gate as written |

Verify the engine by listing its test files explicitly — `steering/verification.md` has the command and
the known-failure list.

## Measured fixture results

| Fixture | Scale | Grouping result |
|---------|-------|-----------------|
| `sample-java-project` | 6 Java files | 29 nodes / 6 edges — the determinism fixture |
| `vantage` | 158-file Spring Boot | 808 nodes / 344 edges → 20 regions, **preserve 10 / reconstruct 10** |
| `broadleaf` | mature multi-module | 29,190 nodes / 14,325 edges → 502 regions, **preserve 38 / reconstruct 464**, depth 6 |

`broadleaf` is the load-bearing evidence: real, large, multi-module Java where the adaptive preserve
branch fires. It previously crashed `group` with `duplicate node identifier` until node identity was
scoped by source root.

**Pipeline wall-clock — re-measured 2026-08-24, three runs each, via the `npm run` wrappers.** The
2026-08-22 figures were wrong by up to 9x and are void; see `DECISIONS.md`.

| Stage | Warm | Note |
|-------|------|------|
| `parse` broadleaf (2985 files) | **8.2 / 6.9 / 7.6 s** | ~2 ms per file of real work |
| `group` broadleaf | **9.0 / 6.7 / 6.5 s** | identical output all 3 runs |
| `parse` vantage (158 files) | **3.5 / 1.2 s** | |
| **full pipeline, broadleaf** | **~14 s warm** | |

**Cold vs warm is the whole story, and both numbers must always be quoted.** `parse` broadleaf is **~50 s on
first access to freshly-written files** and **~6–8 s thereafter** — reproduced on demand 2026-08-24 by copying
the fixture to a new path (51.0 s, then 6.6 s, then 6.2 s, identical output). Root cause is a **~15 ms/file
first-access penalty**, most likely on-access antivirus scanning; warm I/O for all 2985 files is only 0.33 s.
See `DECISIONS.md`. **A user's first `repohive index` after cloning is cold**, so no warm figure may appear in
a README or claim without being labelled warm.

**The cold penalty is fixable and the lever is measured** (2026-08-27): it is per-file read *latency*, so
concurrent reads at ×16 cut it **6.8x** (59.06 s → 8.64 s over 2985 files; ×64 adds nothing). The directory
walk is not implicated at 0.33 s cold. Projected cold `parse` **~51 s → ~15 s**, warm unchanged. **Nothing
implemented** — options and their constraints are in `DECISIONS.md` and `.kiro/workstreams.md`.

**A warm parse is ~85% CPU**, so that is the optimization ceiling: warm reads are 0.87 s of a ~6.4 s warm parse,
the remainder being Tree-Sitter parsing, symbol-table build, stitching and serialization. Cold/warm split
independently reproduced by the owner 2026-08-27 (>40 s cold, <7 s warm), agreeing with the measured
51 s / 6.2–6.6 s.

**The parser is not slow and needs no optimization.** The retired claim that "parse dominates group 6:1" was an
artifact of a cold run — do not repeat it, nor that parse is where parallelism would pay. The two stages are
roughly equal warm, parse marginally ahead.

**Group provenance is emitted — in `nodes.json`, not `hierarchy.json`.** Verified 2026-08-29 on `vantage`:
**0 of 55** group nodes in `hierarchy.json` carry `regionId`/`ordinal`; **all 55** group entries in
`nodes.json` do. `hierarchy.json` holds only the tree (`id`, `kind`, `level`, `parentId`, `childIds`). The
`Hierarchy` object returned by `parseIndex()` is an **assembled** view across all five files —
`leafAttributes`, `leafEdges` and `crossGroupEdges` are properties of that object, not keys in any file. Any
consumer told "groups carry `regionId`" will look in the wrong file without this.

Coverage: `vantage` 55/55, `broadleaf` 1670/1698 (the 28 being repository-wrapping levels, which correspond
to no region by design). **`sample-java-project` is current again** — verified 2026-08-29: all 8 group
entries carry `regionId`/`ordinal`. A new untracked demo fixture exists: **`jsoup`** (95 files, 560 leaf
edges, 8 regions, **preserve 3 / reconstruct 5**, `helper` at score 0.478 sitting 0.022 under the boundary
— the ideal slider demo). Clone in `fixtures/jsoup-src/`, both git-ignored.

**`metadata.json` carries more than previously recorded** (read 2026-08-29). Each `regionDecisions[]` entry
has `regionId`, `action`, **`automaticAction`**, **`cohesion`**, **`coupling`**, `score`,
`decisionConfidence`, `userOverridden`, `groupIds`. Top level adds `perLevel[]` (5 rows of level /
groupNodeCount / leafNodeCount / crossGroupEdgeCount / leafEdgeCount), `configuration` (seed 42, boundary
0.5, maxGroupSize 20, minPartitionThreshold 2, coefficients all 1) and `metricWeights` (cohesion 0.4,
coupling 0.4). **Per-region `cohesion` and `coupling` make a decision scatter plottable with no engine
change**, and `score` + boundary make a client-side boundary-sensitivity slider pure arithmetic.

**Distribution weight** (measured 2026-08-23): engine compiled JS **1.2 MB**; engine runtime deps
**13.5 MB**, of which the needed `.wasm` is only **1.2 MB**. Viewer: static client assets **19.1 MB**,
`standalone` server output **90 MB**, `node_modules` **717 MB**, `.next` **1.3 GB**. **The engine is
already light; all the weight is the viewer.** An engine-only CLI is ~15 MB installed, ~3 MB if bundled.
`repohive` is **available on npm** (registry 404 + zero search results, checked 2026-08-23).

**The hierarchical viewer is nearly free-standing.** `packages/ui/src/zoom` (20 files / 116 KB) imports only
`react` plus two constants from `@repohive/types/health`; its chrome (6 files / 31.5 KB) adds only
`lucide-react`, `next/link` and `sonner`. **No Next.js, sigma, recharts, d3, elkjs or mermaid.** So the CLI's
viewer is a purpose-built single-file artifact of ~300–500 KB, not a static export of the vendored app.
Full detail and the withdrawn alternative: `.kiro/workstreams.md` Path 2.

## Viewer surface reality

Rebuilt by Fable 2026-08-29 (first slice of `docs/viewer-handoff.md`). **4 real surfaces**: the landing
page (server-rendered repo index reading real engine numbers from each `index/` on disk, absent fixtures
shown honestly), **Structure map** (`/knowledge-graph` URL unchanged; decision now carried by the card
frame — solid = preserved, dashed = reconstructed — plus wash and badge), **Decisions**
(`/decision-audit`: draggable boundary strip with counterfactual flips over recorded scores, decision
scatter with the boundary drawn exactly in normalised space, per-region provenance card showing the worked
calculation, authored-vs-derived boundary morph, sortable audit table), and `flat-baseline`. New
purpose-built components live in **`ui/src/repohive/`** (outside vendored folders, per NOTICE rule); new
routes: `region-detail?region=…`, and `region-decisions` additionally serves displayName/fileCount/seed.

**19 of the 22 redirect shells are deleted** (only repo-root, `/c4`, `/zoom` remain — all landing on the
real canvas); the two dead Knowledge-Graph controls (Structurizr export, Open-file-page link) are gone;
`/api/repos` lists only repos whose index exists on this machine. The 26 dead vendored pages remain
unreachable, not a backlog — filling them needs a git-history analyzer, coverage reader, security scanner.
Blast radius stays an interaction inside the Structure map (no URL, no nav entry).

## Done

- **Phase 1 — parser** (`shared`, `parser`): Tree-Sitter Java → `graph.json` + determinism harness. Merged.
- **Phase 2 — grouping** (`core`): adaptive preserve-vs-reconstruct → five-file `index/` plus blast radius,
  covering all 33 spec correctness properties. Merged to `main` 2026-07-23.
- **Phase 3 — viewer** (`web`, `ui`, `types`, `api-client`): three real surfaces, gated in the nav. On
  `fable-work`.
- **Engine hardening waves A–D**: 22 gaps closed. See `DECISIONS.md`.
- **Group naming Tier 1**: engine provenance + `zoom-labels.ts` label composition. Only Tier 2 remains.
- **Agent context and tooling restructured** (2026-08-22, `17ea705`): five always-on steering files;
  `positioning/` and `academic/` excluded; memory split three ways; one hook plus four skills.
- **Forward-path register written** (2026-08-23, `.kiro/workstreams.md`); four stale doc claims corrected.

## In progress

- **Viewer work handed to Fable** (2026-08-29). Brief: **`docs/viewer-handoff.md`** (363 lines), committed and
  pushed in `da882e3` — **but to this frozen archive repo, not the public one where development now happens**
  (see risks). **First slice implemented same day on `fable-work-new`** (see Viewer surface reality): honest
  landing, Decisions surface (strip + scatter + provenance + morph + table), canvas decision frames, shell
  cull, dead controls dropped. Still open from the brief: DSM / heatmap / coupling-ring reuse surfaces, the
  per-leaf size engine field (treemaps), partition-disagreement metric, determinism panel, and a full visual
  identity pass to the Awwwards bar.
- **Everything else is on hold** mid-planning, by owner instruction: CLI, foundation seams, MCP, hosted. All
  recorded decisions stand; no work is in flight.
- **CLI spec remains unblocked whenever it resumes** (2026-08-23): command surface and names final
  (`index` / `parse` / `group` / `view`, `describe` deferred), release at `0.x`, bundler Vite +
  `vite-plugin-singlefile`, output `.repohive/`. Only lockstep versioning is unconfirmed. **One task must land
  before parallel worktrees touch it:** the orchestration function's signature.
- **Out of scope for planning, by owner instruction:** the public-repo replay, branch placement, and the
  archive-repo visibility. Still recorded under risks; simply not raised as workstream blockers.

## Next up

All of these run **concurrently in separate worktrees**. Scope, blockers, plans, estimates and the
parallelism map are in **`.kiro/workstreams.md`**; titles only here so the two cannot drift.

- [x] **Viewer polish** — **handed to Fable 2026-08-29**, brief in `docs/viewer-handoff.md`. The academic
      deliverable. Fable may build new components, not only reuse vendored ones.
- [ ] **Packaged CLI** — *on hold.* Requirements spec unblocked; write it before any code. Node test-script
      fix first. Only *orchestration* among the seams is a prerequisite, and the CLI contains it.
- [ ] **Foundation seams** — *on hold.* Own worktree, own design spec. **Does not block the CLI.**
- [ ] **MCP server** — read-only v1 needs no new engine exports and does not depend on the CLI.
- [ ] **Hosted deployment** — needs all four foundation seams.
- [ ] **More real-repo validation** — collides with nothing; the only candidate that could surface a real
      problem, and the cheapest thing that strengthens the paper.
- [x] **Credibility pass** — done 2026-08-29: landing zeros replaced with real index reads, both dead
      Knowledge-Graph controls dropped, `sample-java-project` verified current (no re-index needed).

**De-conflict before anyone writes orchestration code:** both the CLI and the hosted path need a parse→group
layer, so define the orchestration package's *interface* first (one file of type signatures) and have both
worktrees code against it. Otherwise parallel work produces two incompatible implementations.

**Open owner decisions live in `.kiro/workstreams.md`, grouped by what each blocks.** That is the
authoritative list; this file deliberately does not keep a second copy, because the duplicate drifted
incomplete on 2026-08-23.

## Open questions and known risks

- **`RepoHIVE-Archive` is still public** — verified 2026-08-22 20:55, 8177 KB. The gap, fix and edge-case
  registers are reachable by anyone. **Owner-owned and deliberately out of scope for workstream planning**
  (2026-08-23), so it is not to be raised as a blocker — but it remains a live exposure and is recorded here
  rather than dropped.
- **The engine test script works on neither Node version.** The glob form needs Node 21+; the bare `dist/`
  form is silently vacuous on 21+. **No "green suite" claim from `npm test` is trustworthy** until fixed.
  Exact commands in `steering/verification.md`.
- **Three pre-existing test failures**, none in engine logic: a Windows-vs-POSIX filename assumption in
  `parser/source-collector.test.ts`, a vendored `types` test importing a fixture never vendored with it,
  and flaky render-budget tests in `ui`.
- **Duplicate working registers.** `gaps.md`, `fixes.md`, `edge-case-audit.md` exist in **both** `.kiro/`
  (tracked) and `docs/` (untracked) as of 2026-08-23. `.kiro/` is authoritative; the `docs/` copies have
  not been diffed or removed. Do not edit either until resolved.
- **Index write is not fully atomic** — five same-directory renames, so a mid-promotion failure leaves a
  mixture. Inherent to the design; a directory swap was rejected for its no-index window.
- **Viewer route handlers are unauthenticated** and intended for localhost only. Authentication remains a
  blocking prerequisite for any non-local deployment. The AGPL §13 concern that used to sit beside it is
  **resolved, not outstanding** — everything ships from the public repo (owner, 2026-08-23), so the engine
  being inside the served work is intended. Do not cite AGPL as an architectural constraint.
- **Gap 1b (method-call edges)** — deferred by design, not closed. `methodCallFrequency` is not fully
  populated from real call sites.
- **The preserve/reconstruct split moves with parser signal, not only with repository quality.** Cohesion is
  raw strength-per-node, squash `k` is 1.0, coefficients are all 1, boundary 0.5 — so enriching the parser
  or raising a coefficient pushes regions toward preserve with no repository changing. Recorded instance:
  `vantage` went 0/20 → 10/10 preserve when edges went 128 → 341 in wave A. Calibration rests on two real
  fixtures, which is the argument for real-repo validation early.
- **Resolved 2026-08-29: the landing page zeros and the two dead controls.** The landing now reads real
  numbers from each `index/` server-side and shows absent fixtures as absent; the Structurizr export and
  Open-file-page link are deleted. Kept one release so the fix is not re-reported as a defect.
- **The code-graph-MCP space is crowded**, so an MCP server is distribution, not differentiation. Survey in
  the 2026-08-22 CLI-before-MCP entry in `DECISIONS.md`.
- **Command names** `parse` / `group` / `view` are still placeholders.
- **Steering drift is systemic, not incidental.** Five doc claims have now been found wrong by accident, all
  the same shape: hand-written prose asserting facts that live in `package.json`, `tsconfig.json` or source,
  with nothing checking them — and these are the files an agent reads first, so a stale claim misdirects
  rather than merely misinforms. A mechanical audit of every steering claim was offered 2026-08-23 and is
  **not yet accepted**. Assume more drift exists until it runs.
- **Two excluded-folder docs are stale and were deliberately not touched** (memory updates must not write to
  `positioning/` or `academic/`): `positioning/roadmap.md`'s "Now" entry still lists shipped group naming as
  pending, and `academic/2nd/review-2-demo-guide.md` predates wave A and cites a removed synthetic fixture.

## Reference registers

Large working documents, not context. Load only when working the specific gap or fix they describe.

| File | Contents |
|------|----------|
| `.kiro/workstreams.md` | The four forward paths: scope, blockers, plans, dependency map, open decisions |
| `docs/viewer-handoff.md` | **Fable's brief.** Index-file shapes, 12 zero-change surfaces, new-component ideas, constraints |
| `.kiro/gaps.md`, `.kiro/fixes.md`, `.kiro/edge-case-audit.md` | The 22-gap register with evidence, Fix 3–22 designs, edge-case audit |
| `docs/fixes-signal-enrichment.md` | Gap 1 design (Fixes 21–23) |
| `docs/group-naming.md` | Group-naming design. **Tier 1 is shipped**; only Tier 2 remains |
| `docs/plan/replay/` | Public-repo replay kit and `new-work-replay-plan.md`. 39 of 57 replayed; batches 109–126 plus the closing merge remain. Public `main` still 98 because `feat/engine-hardening` (18 commits, Aug 23) is pushed but unmerged; it reaches 135 when day 4 lands |
| `docs/plan/private-knowledge-repo-plan.md` | Hand-off brief: how `.kiro/` travels to the public repo as a separate **private** repo mounted at `.kiro/`, plus the Kiro→Claude Code port inventory. Not executed |
| `.kiro/GIT_PLAN.md`, `.kiro/GIT_REDATE_PLAN.md`, `.kiro/BRAIN_LOCAL.md` | Untracked local scratch — not context |

Note: `docs/plan/` is git-ignored via `.git/info/exclude`, so nothing placed there is tracked.
