# Project State

> **Read first every session.** Live snapshot of what is true right now — not a log.
> Rewrite sections in place; delete superseded text rather than annotating it. Keep this file short.
> Why things are the way they are: `DECISIONS.md`. What happened when: `BRAIN.md`.

Last updated: 2026-08-23 20:50

---

## Current position

The engine is **complete and audited**. All 22 hardening gaps are closed across four waves, and the
viewer finish landed with wave D on branch **`fable-work`**.

The remaining gap is **reach, not capability**: the pipeline can only be driven by `npm run` scripts from
inside this workspace. Four forward paths are scoped — component reuse, packaged CLI, MCP server, hosted
deployment — with scope, blockers, plans and the open decisions in **`.kiro/workstreams.md`**.

**Execution shape (owner, 2026-08-23): all workstreams run in parallel, in separate worktrees.** The
"which path first" question is closed; do not re-propose an ordering. An **academic deadline is live**, and
polishing the existing viewer with a few more components is sufficient for it — *which* components is parked
until the CLI and seam questions settle, so do not start that brainstorm.

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

**Pipeline wall-clock** (2026-08-22, via the `npm run` wrappers, so each carries ~1.5 s of startup):
`parse` vantage **4.7 s** · `parse` broadleaf **68.3 s** · `group` broadleaf **11.3 s**. `group` on vantage
was not timed. **Full pipeline on broadleaf ≈ 80 s; parse dominates group 6:1.** Consequences for hosting
in `.kiro/workstreams.md` Path 4.

**Group provenance is emitted.** Every group node carries `regionId` + `ordinal`; each `regionDecisions`
entry carries `groupIds`. On-disk: `vantage` 55/55, `broadleaf` 1670/1698 (the 28 being
repository-wrapping levels, which correspond to no region by design), **`sample-java-project` 0/8 — its
`index/` is stale and predates Gap 12.** Re-index before demoing the small fixture.

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

Inventoried 2026-08-22 across all 51 `page.tsx` files against the 7 route handlers; endpoint mapping
re-confirmed 2026-08-23. **3 real** (`knowledge-graph` = semantic zoom + blast-radius highlight,
`flat-baseline`, `decision-audit`), **22 redirect** shells, **26 dead** vendored pages whose endpoints 404
because `lib/api/client.ts` aims every vendored fetch at the app itself, where only the 7 handlers live.

This is deliberate and honest: `nav-items.ts` gates the sidebar per R9.1, `zoom-map-adapter.ts` emits
neutral zeros rather than inventing metrics, and **no fabricated or fixture data reaches the running app**.
**The vendored IA is not a backlog** — filling the 26 needs a git-history analyzer, coverage reader and
security scanner. Note **blast radius has no URL and no nav entry**; it is an interaction inside the
Knowledge Graph. Which vendored components *are* reusable: `.kiro/workstreams.md` Path 1.

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

- **Nothing is being built yet, but the CLI requirements spec is now unblocked** (2026-08-23): command surface
  and names final (`index` / `parse` / `group` / `view`, `describe` deferred), release at `0.x`, bundler is
  Vite + `vite-plugin-singlefile`, output `.repohive/`. Only lockstep versioning is unconfirmed.
  **One task must land before parallel worktrees touch it:** the orchestration function's signature.
- **Out of scope for planning, by owner instruction:** the public-repo replay, branch placement, and the
  archive-repo visibility. Still recorded under risks; simply not raised as workstream blockers.

## Next up

All of these run **concurrently in separate worktrees**. Scope, blockers, plans, estimates and the
parallelism map are in **`.kiro/workstreams.md`**; titles only here so the two cannot drift.

- [ ] **Packaged CLI** — requirements spec unblocked; write it before any code. Node test-script fix first.
      Only *orchestration* among the seams is a prerequisite, and the CLI contains it.
- [ ] **Foundation seams** — own worktree, own design spec. **Does not block the CLI.**
- [ ] **Viewer polish** — the academic deliverable. Component choice parked by the owner.
- [ ] **MCP server** — read-only v1 needs no new engine exports and does not depend on the CLI.
- [ ] **Hosted deployment** — needs all four foundation seams.
- [ ] **More real-repo validation** — collides with nothing; the only candidate that could surface a real
      problem, and the cheapest thing that strengthens the paper.
- [ ] **Credibility pass** — re-index the stale `sample-java-project` fixture, fix the landing page zeros,
      drop the two dead controls on the Knowledge Graph page.

**De-conflict before anyone writes orchestration code:** both the CLI and the hosted path need a parse→group
layer, so define the orchestration package's *interface* first (one file of type signatures) and have both
worktrees code against it. Otherwise parallel work produces two incompatible implementations.

**Open owner decisions live in `.kiro/workstreams.md` — 15 of them, grouped by what each blocks.** That is
the authoritative list; this file deliberately does not keep a second copy, because the duplicate drifted
incomplete on 2026-08-23. The one that reorders the rest: **whether an academic deadline is in play**, asked
across two sessions and still unanswered.

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
- **The viewer's landing page reads as measured when it is not.** `web/src/app/page.tsx` swallows failed
  fetches via `Promise.allSettled` and renders `Total Pages 0` / `Fresh Pages 0` / `Stale Pages 0` in metric
  cards. Nothing is fabricated, but zeros in a metric card read as a measurement, and it is the first screen
  in any demo. Two dead controls also sit on the one real page.
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
| `.kiro/gaps.md`, `.kiro/fixes.md`, `.kiro/edge-case-audit.md` | The 22-gap register with evidence, Fix 3–22 designs, edge-case audit |
| `docs/fixes-signal-enrichment.md` | Gap 1 design (Fixes 21–23) |
| `docs/group-naming.md` | Group-naming design. **Tier 1 is shipped**; only Tier 2 remains |
| `docs/plan/replay/` | Public-repo replay kit and `new-work-replay-plan.md` (the remaining 57 commits) |
| `.kiro/GIT_PLAN.md`, `.kiro/GIT_REDATE_PLAN.md`, `.kiro/BRAIN_LOCAL.md` | Untracked local scratch — not context |

Note: `docs/plan/` is git-ignored via `.git/info/exclude`, so nothing placed there is tracked.
