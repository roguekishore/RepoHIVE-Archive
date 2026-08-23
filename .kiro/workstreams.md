# Forward workstreams — scope, blockers, plans

> **Status:** register only. Recorded 2026-08-23 17:49, updated 18:25. **No path below has been chosen or
> started.** Sequencing is an open owner decision; the recorded decision as of writing is still
> "CLI next, MCP deferred" (`DECISIONS.md`, 2026-08-22).
>
> **Two blockers dissolved 2026-08-23** (see `DECISIONS.md`): the public-repo replay no longer gates
> development, and everything ships from the public repo so **AGPL §13 is not an architectural
> constraint** — both are struck from the sections below.
>
> This file is the single register for the four post-engine paths: what each one is, what genuinely
> blocks it, and what its plan looks like. It exists so the analysis is not re-derived every session.
> **It is not a commitment and not a roadmap.** When a path is chosen, record that in `DECISIONS.md`
> and reflect it in `PROJECT_STATE.md`; keep this file as the scope-and-blocker reference.
>
> Narrative framing, competitive positioning and claim wording live in `docs/positioning/` and are
> deliberately not part of this document.

## Contents

1. [The shared foundation](#1-the-shared-foundation)
2. [Path 1 — vendored component reuse](#path-1--vendored-component-reuse)
3. [Path 2 — packaged CLI](#path-2--packaged-cli)
4. [Path 3 — MCP server](#path-3--mcp-server)
5. [Path 4 — hosted deployment](#path-4--hosted-deployment)
6. [Dependency and parallelism map](#dependency-and-parallelism-map)
7. [Open owner decisions](#open-owner-decisions)
8. [Evidence and confidence](#evidence-and-confidence)

---

## 1. The shared foundation

Three of the four paths converge on the same four missing seams. Path 1 needs none of them.

| Seam | State today | Needed by |
|------|-------------|-----------|
| **Source provider** — parse from something other than a local directory | Injectable, but across three separate points (below) | Path 4; Path 2 indirectly |
| **Storage interface** (`get` / `put` / `has`) | Asymmetric: write path has `IndexSerializerDeps` (`core/src/index-serializer.ts:108`); read path calls `node:fs` directly at `core/src/index-parser.ts:10` and `core/src/orchestrator.ts:7` | Path 4; hosted Path 3 |
| **Pipeline orchestration** (`parse` → `group` in one call) | **Absent.** `parser/src/index.ts` exports only `parseProject`; `core/src/index.ts` exports `groupGraphToIndex`. Neither imports the other; the two stages are joined only by two root npm scripts | Paths 2 and 4 |
| **Content-addressed snapshot ids** over `(repoUrl, commitSha, engineVersion, configDigest)` | Absent | Path 4 |

The last three are already mandated by the 2026-08-22 live-indexing decision. The first needs a
correction to that decision's premise.

### Which seams actually block which path

| Seam | CLI needs it? | Why |
|------|---------------|-----|
| **Orchestration** | **Yes** | `repohive index` *is* this layer |
| Source provider | No | the CLI always has a real directory on a real disk |
| Storage interface | No | the CLI writes to disk |
| Snapshot ids | Partly | enables `index` skipping an unchanged parse; essential only for hosting |

**Seams are safely retrofittable; the published surface is not.** Adding an interface behind an existing
function is backwards-compatible when the default is preserved, and that is already the house pattern —
`parseProject(options, deps = defaultDeps())` and `IndexSerializerDeps` both inject filesystem dependencies
with a real-fs default, leaving existing callers untouched. The source provider and storage interface can be
added the same way, later, without breaking the CLI.

What genuinely cannot be retrofitted: the on-disk layout of `.repohive/`, the command and flag names, the
`--json` output shape, and the exit codes. Once anyone writes CI around `repohive index --json`, changing
those is a major version and a broken build for them. **So the CLI is blocked on nailing its contract, not on
seam work.**

The seam design still gets its own spec, written in the seam worktree concurrently with CLI work — the owner
asked for a storage- and source-agnostic analysis, which is a spec deliverable rather than an improvised
decision.

### Correction: the source-provider seam is three injection points, not one

`DECISIONS.md` (2026-08-22) states "`ParseDeps.collector` is the existing injection point." Verified
2026-08-23: that is necessary but not sufficient. The parser reaches the filesystem in **three** places,
all injectable, none wired together:

1. `deps.validator.validate(options.projectDirectory)` — runs first and short-circuits on a bad path
   (`parser/src/orchestrator.ts`, validation precedes collection).
2. `deps.collector.collect(validated, …)` — the directory walk
   (`SourceFileCollector` at `parser/src/source-collector.ts:137`).
3. `ast-extractor.ts` `defaultDeps.readFile = nodeFs.readFileSync(absolutePath, "utf8")`.

Additionally `ParseOptions.projectDirectory` is a **required `string`** (`parser/src/orchestrator.ts:71`),
and `ParseDeps` has six fields with no partial-override helper — so virtualizing the filesystem today
means a caller reassembles the entire dep set and still supplies a directory string.

**Consequence.** Swapping the collector alone will not admit tarballs, uploads, or in-memory sources. The
seam work is a first-class source-provider abstraction plus a `projectDirectory` that becomes optional,
not a one-line dependency swap. The decision itself (live indexing is required) stands unchanged; only
its cost estimate for this item moves.

### WASM grammar resolution constrains bundled deployment

`parser/src/ast-extractor.ts` `resolveGrammarPaths` locates two prebuilt WASM artifacts via
`createRequire(import.meta.url).resolve("web-tree-sitter")` (taking its sibling `web-tree-sitter.wasm`)
and `require.resolve("tree-sitter-java/tree-sitter-java.wasm")`. This works from `node_modules` and
**breaks under any bundler**, which drops `.wasm` files and rewrites module resolution.

`GrammarOptions { coreWasmPath?, javaWasmPath? }` exists precisely to override this, and its docstring
names "bundled or relocated deployments" as the reason. So this is anticipated, not a design flaw — but
it must be explicitly wired for Lambda, container, or any bundled target. Affects Path 4; affects Path 2
only if the CLI is shipped bundled rather than with dependencies.

---

## Path 1 — vendored component reuse

**Goal.** Add demo-credible viewer surfaces by reusing vendored repowise components, fed by adapters
over data the engine already emits.

**Prerequisites: none.** Touches `packages/web` and `packages/ui` only. No engine change, no seam work.
The only path that can start immediately.

### The governing insight: reuse the component, not the page

Of 51 `page.tsx` files: **3 real**, **22 redirect shells**, **26 dead** (inventory 2026-08-22, endpoint
mapping re-confirmed 2026-08-23). The 26 are dead because they assume subsystems RepoHIVE does not have,
grouped by what each needs:

| Group | Pages | Missing subsystem |
|-------|-------|-------------------|
| A | `commits`, `stats`, `owners`, `owners/[owner]` | git history mining (blame, churn, contributor arrivals) |
| B | `code-health` (8 tabs; 22 of the shells point here) | complexity metrics, test coverage, dead-code reachability, security scan |
| C | `docs`, `docs/coverage` | LLM-generated prose pages + freshness/drift |
| D | `decisions`, `decisions/[id]` | mined ADRs — **see name collision below** |
| E | `symbols/[id]`, `files`, `files/[path]`, `modules/[path]`, and 3 of 4 `architecture` tabs | signatures, LOC, complexity, centrality, request-time source access |
| F | `chat`, `costs`, `refactoring`, `overview`, `settings`, `/settings` | LLM provider, token/cost accounting, generated refactorings |
| G | `workspace`, `co-changes`, `conformance`, `contracts`, `system-map` | multi-repo workspace, service-level nodes, typed transports |
| H | `/` (partially live) | indexing job queue |

The `architecture` page is a partial rather than a total casualty: its `GraphView` tab is genuinely live
via `lib/hooks/use-graph.ts` → `/api/graph/[id]`; only Symbols, Dependencies and Coupling 404.

**Group G is hidden by `stub-responses.ts` `workspaceStub()` returning `is_workspace: false`.** The DSM —
the single most reusable structural visual in the package — lives on `/workspace/conformance` inside that
group. Re-enabling that page would drag in `SystemGraph` (services, typed transports), which the engine
does not produce. The correct move is to import `DsmMatrixView` into a **new repo-scoped page** and build
its `DsmMatrix` directly. Generalise: take the component, leave the page.

### Tier A — adapter only, no engine change

| Component | File | Fed from |
|-----------|------|----------|
| `DsmMatrixView` | `ui/src/workspace/dsm/dsm-matrix.tsx` | `crossGroupEdges` → group×group `{axis, labels, cells}`. Bypass `buildDsm` (it requires `SystemGraph`). Render budget already caps both axes at 60 by degree |
| `CouplingGraph`, `CouplingTable` | `ui/src/coupling/` | `edges[].strength`, ringed by `directoryPath`. Needs only (path, path, strength) |
| `DependencyHeatmap` | `ui/src/dashboard/dependency-heatmap.tsx` | group→group edge counts; sort axis by out-degree in place of `avg_pagerank` |
| `ResponsiveTable<T>` | `ui/src/shared/responsive-table/` | `metadata.regionDecisions`. Generic over `T`; a column definition is the whole job |
| `MetricCard`, `StatGrid`, `StatRibbon` | `ui/src/shared/`, `ui/src/stats/` | `metadata` + `hierarchy` counts. Also fixes the landing page's zeros |
| `HealthScoreRing`, `ScoreBreakdown`, `Sparkline`, `ConfidenceBadge` | `ui/src/dashboard/`, `ui/src/health/`, `ui/src/wiki/` | `score`, `decisionConfidence`. Take bare numbers |
| `LanguageDonut`, `CommitCategoryDonut` | `ui/src/dashboard/`, `ui/src/git/` | any `Record<string, number>` — e.g. the preserve/reconstruct split |
| Quadrant / scatter plots | `ui/src/health/churn-complexity-quadrant.tsx`, `impact-effort-quadrant.tsx` | any two structural metrics per region |
| `MermaidDiagram`, `CodeBlock`, `Markdown`, `TableOfContents` | `ui/src/wiki/`, `ui/src/shared/` | generated strings; fully content-agnostic |
| `present/*` incl. `split-markdown.ts` | `ui/src/present/` | a markdown document → slide deck. Relevant to review panels |
| `elk-layout.ts` | `ui/src/graph/elk-layout.ts` | pure layout functions over node/edge lists |

`packages/ui/COMPONENT_CONTRACTS.md` is the authoritative prop contract. It is stale on package names
(`@repowise-dev/*` where the code uses `@repohive/*`); treat the shapes as current, the names as not.

### Tier B — one small additive engine field

**Per-leaf size (LOC or bytes) on `leafAttributes`** unlocks all three treemaps (`files-treemap`,
`code-health-map`, `ownership-treemap`). Cheapest genuinely-new engine output on the list, and purely
additive to the contract. Centrality is also available — `graphology-metrics` is already a dependency —
which would feed `CentralityLeaderboard`.

### Tier C — do not attempt

`graph-flow` needs five independent datasets, four with no source. `workspace/system-map` needs service
boundary detection. The symbol pages need signatures the parser discards by design.

**Name collision, worth stating plainly:** the vendored `decisions` pages model **mined architecture
decision records** — authored intent with status, author, prose body, lineage, evidence. RepoHIVE's
`regionDecisions` are grouping outcomes with action, score, confidence and `groupIds`. Same word,
unrelated concept. Driving those pages would require fabricating exactly what the adapter convention
forbids. `decision-audit` is already the real surface; use `ResponsiveTable` for anything more.

### The adapter convention is already established — follow it

`web/src/lib/repohive/zoom-map-adapter.ts` (269 lines) is the reference implementation and states its own
rules. Load-bearing points for any new adapter:

- One pure module knows both contracts; the engine never learns the vendored shape and the vendored
  component is not modified.
- Read, never compute. It never derives cohesion, coupling, a score, a decision or a community.
- **Fields the engine does not emit become explicit neutral zeros** (lines 171-176), never plausible
  invented values. This is what makes the demo survive scrutiny.
- Joins use engine-recorded ids (`regionId`), never re-derived path or package-prefix heuristics.
- Presentation policy (label wording, truncation) stays in the viewer, not the engine
  (`zoom-labels.ts:150-153`).
- Canonical ordering is enforced inside the adapter rather than assumed from upstream.

Precedent for extending a vendored type additively rather than forking it: `ZoomNode.decision?:
"preserve" | "reconstruct" | null` at `ui/src/zoom/types.ts:70-77`.

Re-enabling a surface = move its item from `allRepoNavGroups()` to `repoNavGroups()` in
`web/src/components/layout/nav-items.ts`, once its adapter exists (R9.5).

### Plan

1. Confirm `web/src/lib/route-links.test.ts` does not assert redirect targets, then delete the 20 shells
   that forward into dead pages (2 of the 22 land on real surfaces — keep those).
2. One adapter + one page + one nav entry per surface, each a self-contained commit, in this order:
   region-decision table with metric-card header → DSM → coupling ring.
3. Replace the landing page's `Promise.allSettled` zeros with real counts; drop the two dead controls on
   the Knowledge Graph page (Structurizr export, "Open file page").

**Estimate 3–4 days** for three surfaces plus the subtractive pass. Estimate, not measured.

### Component choice has a bundle-weight cost

Measured 2026-08-23: the heavy client libraries are reachable almost entirely from **dead** pages —
`recharts` (12 importers), `d3-hierarchy` (5), `elkjs` (3), `shiki` (1), plus `mermaid` (80 MB in
`node_modules`, no direct import in `ui`/`web` source). Of the live surfaces only the flat baseline pulls
anything notable (`sigma`, confined to `ui/src/graph/sigma/*`); the zoom canvas paints itself.

So when picking Tier A components: **`DsmMatrixView` is a plain CSS table and adds nothing, while a donut
drags in `recharts`** (`LanguageDonut`, `CommitCategoryDonut`) and treemaps pull `d3-hierarchy`. Favour the
table-and-CSS components where weight matters.

> **Retracted 2026-08-23 18:56.** This section previously claimed the subtractive pass was *upstream of the
> CLI's shippable viewer*, on the grounds that the CLI would static-export the vendored app and would
> otherwise ship 19.1 MB and 46 broken screens. **The CLI now ships only the hierarchical viewer**
> (`DECISIONS.md`, same day), so it does not build that app at all and the dead pages are irrelevant to it.
> Path 1 is purely about the demo surface again, and the weight advice above applies to the demo rather than
> to the CLI. Kept visible so the dependency is not re-derived.

---

## Path 2 — packaged CLI

**Goal.** An installable command (`npm i -g …`) that indexes a repository outside this workspace.

**Prerequisite:** pipeline orchestration (foundation item 3), unless the CLI absorbs it.

### It is an extraction, but the packaging is real work

The logic exists. `core/src/group-cli.ts` carries the full flag surface
(`--boundary`, `--seed`, `--max-group-size`, `--min-partition-threshold`, `--weight-cohesion|coupling|modularity`,
`--squash-k`, `--degenerate-score`, `--compute-modularity`, `--preserve`, `--reconstruct`, `--out`,
`--help`), routes every value through `validateConfig`, rejects unknown flags and extra positionals, and
exposes a testable `main(argv, io) → exit code` with 2 for usage and 1 for failure. That part is done and
good.

### Blockers

1. **`packages/cli` contains only `.gitkeep`.** `steering/architecture.md` described it as "wires the
   pipeline" — corrected 2026-08-23.
2. **Nothing is publishable.** Every package is `private: true` at `0.0.0` (`@repohive/web` is `0.3.0`,
   also private). `cli` depends on `parser` and `core`, so those must be published too or bundled in.
   That is a distribution decision, plus a package-name decision, plus version policy.
3. **No orchestration layer**, so `index <dir>` has nowhere to live. If it lands inside `packages/cli`,
   the MCP server ends up importing a package named "cli" — the roadmap's mistaken "CLI is the keystone"
   claim coming true by accident. Give orchestration its own small ecosystem package.
4. **`INIT_CWD` is an npm-script artifact.** Both wrappers resolve relative paths against it
   (`group-cli.ts` `resolveAgainstInvocationDir`, `parse-cli.ts` `invocationCwd`). A real `bin` must use
   `process.cwd()`.
5. **The self-execution guard will not fire under a `bin` shim.** `group-cli.ts` ends with
   `if (process.argv[1]?.endsWith("group-cli.js"))`. A packaged binary needs a shebang and unconditional
   `main`.
6. **`parse-cli.ts` is materially weaker than `group-cli.ts`.** Ad-hoc `args.indexOf("--exclude")`,
   a fragile positional filter, no unknown-flag rejection, and a default target of
   `fixtures/sample-java-project` resolved relative to `dist/` — demo behaviour that must not ship.
7. **No machine-readable output.** Both print hand-rolled prose via `io.log` / `console.log`. Add
   `--json` and treat prose as a rendering of it before anyone depends on the sentences. Exit codes
   should become documented contract (the existing 2/1 split is already consistent).
8. **The engine test script is broken.** `node --test dist/*.test.js` needs Node 21+ to expand the glob
   and errors on Node 20; `node --test dist/` runs on 20 but silently resolves to `dist/index.js` on 21+
   and reports one passing test. Fix first (`DECISIONS.md` 2026-08-22, constraint 4) so the CLI inherits
   a runner that works on both.
9. **Command names `parse` / `group` / `view` are placeholders.**

**Licence note.** Publishing an AGPL-3.0-or-later CLI to npm is unproblematic, and end users who merely
run it take on no obligation. The obligation attaches to conveying modified versions or offering it as a
network service. Not legal advice; if commercial licensing matters, get a qualified opinion.

### Plan

Requirements spec first — the flag surface is owner-reviewable before any code (`DECISIONS.md`
2026-08-22, constraint 3). Then: Node test-script fix → orchestration package → `packages/cli` with both
wrappers moved in and `index` added → `npm pack` dry run → publish.

**Estimate 3–4 days**, above the 2–3 previously recorded, because of items 2 and 3.

### Distribution — measured facts

| What | Size | Ships in the CLI? |
|------|------|-------------------|
| Engine compiled JS (`shared` + `parser` + `core` dist) | **1.2 MB** | yes |
| Engine runtime deps (graphology family + both Tree-Sitter packages) | **13.5 MB** | yes |
| — of which the `.wasm` actually needed | **1.2 MB** | yes |
| Viewer static client assets (all 51 pages) | 19.1 MB | Stage 2 only |
| Viewer `standalone` server output | 90 MB | **no** |
| `node_modules` (dev tree) | 717 MB | no |
| `packages/web/.next` | 1.3 GB | no |

Measured 2026-08-23. Largest `node_modules` entries are all viewer-side: `@next` 142 MB, `next` 133 MB,
`mermaid` 80 MB, `lucide-react` 30 MB, `typescript` 22 MB. **The engine has no weight problem; the viewer
does.** Engine-only CLI ≈ 15 MB installed, ≈ 3 MB if bundled to one file plus the two `.wasm` files.

**`repohive` is available on npm** — `registry.npmjs.org/repohive` returns 404 and a registry search for
"repohive" returns zero results (checked 2026-08-23). So `npx repohive …` is achievable with an unscoped
name. Note `npx` runs rather than installs: the invocation is `npx repohive index .`.

### The viewer has no irreducible server requirement

Verified 2026-08-23. All three real pages are `"use client"` and fetch over HTTP via SWR
(`useZoomMap`, `useGraph` in `web/src/lib/hooks/use-graph.ts`). Every one of the 7 route handlers does
exactly one thing: read `index/` from disk, run a **pure** adapter, return JSON. The server exists only to
run adapters on demand, so moving them from request time to index time removes it entirely.

### The hierarchical viewer needs almost nothing — measured

`packages/ui/src/zoom` is **20 files / 116 KB**, and its only bare-specifier imports are **`react`** and two
constants from **`@repohive/types/health`**. The chrome (`web/src/components/zoom`, 6 files / 31.5 KB) adds
only `lucide-react` (tree-shakes to a few icons), `next/link` (replaceable with `<a>`) and `sonner`
(droppable).

**No Next.js, sigma, recharts, d3, elkjs or mermaid.** The canvas computes its own deterministic layout and
paints itself.

Consequence, and it supersedes the static-export plan below: build a purpose-made single-page artifact —
React + `ZoomCanvas` + the `ZoomMap` inlined — estimated **300–500 KB as one self-contained `.html`**.
`nuqs` (URL state) would be swapped for the plain history API, and `next/link` for `<a>`.

> **Withdrawn 2026-08-23 18:56: static-exporting the vendored app.** The earlier plan was `output: "export"`
> in place of the current `output: "standalone"`, deleting the 7 route handlers from the shipped build
> (under export they would bake *fixture* data via `generateStaticParams`), pointing
> `web/src/lib/api/client.ts` at relative static paths, and having the CLI write those payloads at index
> time. Sound, but unnecessary once the CLI ships only the hierarchical viewer. **Retained because it is
> still the right recipe if a future artifact must carry several vendored surfaces**, and because the
> `client.ts` seam observation holds either way.

### How an npm install produces a command

A `bin` entry in `package.json` is what creates the command:

```json
"bin": { "repohive": "./dist/cli.js" }
```

| User runs | Effect | Invocation afterwards |
|-----------|--------|-----------------------|
| `npm i -g repohive` | global install, shim on PATH | `repohive index .` anywhere |
| `npm i repohive` | local install; shim only in `node_modules/.bin` | `npx repohive index .` |
| `npx repohive index .` | fetch to cache, run, done — no install | that one line |

**`npm repohive index` is not valid** — `npm`'s subcommands are its own and cannot be extended. The valid
long form is `npm exec repohive index .`, which is what `npx` abbreviates. Put `npx repohive index .` in the
README as the try-it-once path.

Subcommands need nothing special: they are the first argument to the same binary, dispatched on, exactly as
`git commit` and `docker build` work. One `bin` entry, four behaviours.

### Command surface — DECIDED 2026-08-23

Names are final: **`index` / `parse` / `group` / `view`**. `describe` is deferred to a later release.
README guidance: `npm i -g repohive` → `repohive index .`, with `npx repohive index .` as the no-install
alternative.

```
repohive index <dir> [--out <dir>] [--json] [<group flags>]
    -> .repohive/graph.json + .repohive/index/ + .repohive/view/
    parse, then group, then write the viewer artifact.
    Skips parse when graph.json is already current for the input.

repohive parse <dir> [--out <dir>] [--include-generated] [--exclude a,b] [--json]
    -> .repohive/graph.json                                    (stage 1 alone)

repohive group <graph.json | dir> [--out <dir>] [--boundary <n>] [--seed <n>]
              [--weight-cohesion <n>] [--weight-coupling <n>] [--weight-modularity <n>]
              [--squash-k <n>] [--degenerate-score <n>] [--compute-modularity]
              [--preserve <regionId>] [--reconstruct <regionId>] [--json]
    -> .repohive/index/                                        (stage 2 alone)
    Every tuning knob lives here. This is the sweep surface, and the whole flag
    set already exists and already routes through validateConfig.

repohive view [dir] [--port <n>] [--no-open]
repohive describe <dir>        # recommended addition: counts, decisions, engine version
repohive --version | --help
```

### Why `group` stays separately invokable — and what a "sweep" is

Restated twice because it was misread twice. **A sweep is not indexing.** It is a research procedure that only
the project itself runs, required by algorithm spec **Req 4.4**: show how the preserve/reconstruct split
responds as `--boundary` varies. That means running `group` ~20 times at 20 boundary values. **The source code
never changes across those runs, so `graph.json` never changes either.**

Measured on broadleaf (2026-08-22): `parse` **68.3 s**, `group` **11.3 s**.

| Scenario | What runs | Cost |
|----------|-----------|------|
| A user indexing once | parse + group | **~80 s.** Users never sweep |
| Sweep, `parse` and `group` separate | parse ×1, group ×20 | 68 + (20 × 11) ≈ **5 min** |
| Sweep, if `index` were the only command | (parse + group) ×20 | 20 × 80 ≈ **26 min** |

The ~21 minutes saved is **20 redundant parses avoided**. `group` is the *fast* half; the argument was never
that `group` is slow. **`repohive index` on a mature repo is ~80 s — do not quote ~20 s.**

Secondary justification: running `parse` alone is what you reach for when a graph looks wrong. The stages are
the research and debugging interface; `index` is the product interface.

Artifact layout — **decided**, default `.repohive/` with `--out` to override:

```
.repohive/
  graph.json    # stage-1 output
  index/        # the 5-file engine contract - stable, documented, what tools read
  view/         # the hierarchical viewer artifact
```

`index/` stays untouched and separate because it is the published contract that MCP, the hosted service and
third-party tooling read. `view/` is a rendering of it and may churn freely.

### Command names — DECIDED 2026-08-23: kept as-is

Finalized as **`index` / `parse` / `group` / `view`**. `describe` deferred. Alternatives considered and
rejected, kept so they are not re-proposed:

| Considered | Rejected because |
|------------|------------------|
| `parse` → `scan`, `extract` | no clearer; `parse` is precise about what it does |
| `group` → `cluster` | actively wrong — it asserts clustering always happens, when the contribution is *deciding* between preserve and reconstruct |
| `group` → `organize`, `structure` | vaguer, and they do not name the output |
| `view` → `open`, `serve` | `view` covers both serving and opening; each alternative covers one |

The decisive argument is cost: these four words appear across the specs and steering in 30-plus places, and
renaming buys a user nothing. `index` as the primary fits — a verb, matching "codebase indexing engine", and
its writing `.repohive/index/` is coherent.

### Packaging — DECIDED 2026-08-23

Publish `@repohive/shared`, `@repohive/parser`, `@repohive/core` as **libraries** (the MCP server and the
hosted service import `core` directly and must not shell out to a CLI), plus `repohive` as the **CLI**, with
the CLI **depending on** the three rather than bundling them — ~15 MB installed, and npx caches it.

Bundling to ~3 MB stays available as a later optimization that changes nothing a user types. **The two
`.wasm` files can never be inlined into JavaScript**, so even a fully bundled CLI ships them as real files
located via `GrammarOptions`.

### Version policy — `0.x` DECIDED 2026-08-23; lockstep assumed, confirmation outstanding

Semver is `MAJOR.MINOR.PATCH`: PATCH is a fix, MINOR is a backwards-compatible addition, MAJOR is a break.
The promise matters because a consumer writing `"repohive": "^1.4.2"` is trusting any `1.x` not to break them
— so renaming a JSON field and shipping it as a MINOR silently breaks every such consumer. While MAJOR is
`0`, that promise is suspended by convention: `0.x` means the shape is still settling.

All packages currently read `0.0.0`, which conventionally means never released.

**Decided: release at `0.x`, i.e. `0.1.0`.** Rather than `1.0.0`, because the JSON contract will still grow —
per-leaf file size for treemaps, an engine-version field, snapshot ids for hosting — and a rename may yet be
wanted once real users have seen it. Go to `1.0.0` when the contract has survived strangers, and mean it.

**Assumed but not explicitly confirmed: lockstep.** All four packages share one version and move together,
which was the recommendation being agreed to. With four packages and one contract at the centre, the precision
of independent versioning is not worth its coordination tooling. **Flagged back to the owner** — if
independent versioning was meant, this needs revisiting before the first publish.

### Bundler — DECIDED 2026-08-23: Vite

Two separate jobs:

- **The single-file viewer: Vite** with **`vite-plugin-singlefile`**. Verified against the npm registry
  2026-08-23: **2.3.3, MIT licence, one dependency (`micromatch`), peer-supports Vite 5–8**, stated purpose
  "inlining all JavaScript and CSS resources". MIT is compatible with AGPL-3.0-or-later. Vite is also the
  default for React SPAs and is moving to Rolldown internally, so the choice inherits that work without a
  later migration.
- **The CLI bundle, if and when bundled: `tsup`** (esbuild wrapper, near-zero config, handles `.d.ts`) or
  esbuild directly.

**This is among the least locking decisions on the list**, which answers the concern that the choice might
become a blocker: the deliverables are a plain `.html` and a plain `.js`, and neither encodes the tool that
produced it. Swapping bundlers later is invisible to users. Reserve the caution for the command names and the
artifact layout, which genuinely cannot change after publishing.

**Steering amended in the same change.** `steering/stack.md` had listed Vite under "not used, do not
reintroduce" — a line aimed at protecting `packages/web`'s dependence on Next.js, which wrongly forbade this.
It now narrows that rule to the viewer app and records that **the tool lists are extensible rather than
boundaries** (owner ruling, 2026-08-23): new tools may be added when the work demands it, with a `DECISIONS`
entry and a `stack.md` update in the same change. `packages/web` stays on Next.js; AGPL licence compatibility
stays a hard rule.

### Viewer staging — scope decided 2026-08-23, sequencing still open

**Scope is settled** (`DECISIONS.md`): the CLI ships the **hierarchical viewer only**. Anything else is a
bonus admitted only if it does not add weight. The former three-stage plan collapses to two:

1. **Stage 1 — no viewer.** `repohive index` emits `index/` plus `--json`. Ships in days; a real tool even
   if everything else slips. *Open: is this an acceptable first publish?*
2. **Stage 2 — the single-file hierarchical viewer.** React + `ZoomCanvas` + inlined `ZoomMap`, one
   self-contained `.html`, ~300–500 KB. Emailable, attachable to a PR, openable from disk. **No Next.js
   runtime, no server, and no dependency on Path 1.**

**Open sub-decision:** which bundler produces that artifact. `steering/stack.md` lists Vite under "not used,
do not reintroduce" — a rule aimed at the viewer app, not at a CLI artifact builder, but reintroducing any
bundler needs a deliberate call. `esbuild` is already present transitively and would do this in roughly one
command.

### Open questions blocking the CLI spec

Command shape · output directory (`.repohive/` vs `repohive-out/`) · publish-four-plus-CLI · whether
Stage 1 is an acceptable first ship · whether `parse` / `group` keep their placeholder names.

---

## Path 3 — MCP server

**Goal.** Expose the index to AI assistants over Model Context Protocol.

**Prerequisites: none for a read-only v1.** Verified 2026-08-23: `core/src/index.ts` already exports
`parseIndex` and `analyzeBlastRadius`. **No new engine exports are required.**

### It does not sit on top of the CLI

An ecosystem package imports `@repohive/core` directly. Building the MCP server on the packaged CLI would
mean spawning a subprocess and parsing its stdout — slower, more fragile, and no benefit. This confirms
the 2026-08-22 finding that nothing was unblocked by sequencing CLI first.

### Blockers

1. **Tool-call timeouts vs. an 80 s pipeline.** Reading an existing index is fast. Indexing broadleaf is
   ~80 s measured, which exceeds typical MCP client tool timeouts. **v1 reads an index the user already
   produced.** Any indexing tool must be fire-and-forget with a separate status tool, which drags in the
   whole Path 4 job model — so keep it out of v1.
2. **Read-path fs coupling** (`index-parser.ts:10`) is *not* a v1 blocker: a local MCP server reading a
   local `index/` is exactly what the current code does. It becomes a blocker only for a hosted MCP.
3. **The tool surface is the actual design work.** Plumbing is trivial; deciding what an agent should be
   able to ask is not.

### Tool surface, ordered by differentiation

`region_decisions` (the recorded preserve/reconstruct action with score and confidence — the thing no
surveyed competitor exposes) · `blast_radius` · `hierarchy_at_level` for level-at-a-time context ·
`find_node`.

**Positioning constraint, already recorded and not to be re-argued:** the code-graph-MCP space is
crowded, so this is distribution rather than differentiation, and no claim may rest on the mere existence
of an MCP server (`DECISIONS.md` 2026-08-22, constraint 2).

**Estimate 2–3 days** for read-only v1.

---

## Path 4 — hosted deployment

**Goal, as already decided (`DECISIONS.md` 2026-08-22).** Paste a public GitHub URL, watch it index,
browse the result, no signup. Pre-indexed-only hosting does not satisfy this.

**Prerequisites: all four foundation seams.**

Everything in that decision entry stands and is not restated here: codeload tarball over `git clone`,
`groupGraph` off the request thread in `worker_threads`, progress as first-class engine output over SSE,
content-addressed snapshot ids, `visibility` on the snapshot from day one, the indexer living outside
`packages/web`, and the full guard-rail list. What follows is only what this session added.

### Serverless indexing: not first

Assessment of the owner's Lambda proposal, against the measured 80 s worst case.

Streaming is **not** the obstacle it first appeared to be. Lambda response streaming works through
Function URLs, and API Gateway supports a `STREAM` response transfer mode for proxy integrations;
Application Load Balancer does not. So SSE from Lambda is achievable. (Per AWS documentation:
[Lambda response streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html),
[API Gateway response transfer mode](https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode.html).
Content rephrased for licence compliance.)

The case against Lambda first is different, and stands on three points:

1. **It is already the anticipated second step.** The recorded design puts the pipeline in
   `worker_threads` and notes the same worker code "later lifts into a separate service unchanged."
   Building Lambda now buys nothing the design does not already allow later.
2. **An always-on process the owner already runs is the simplest implementation** of a watchable 80 s
   operation holding an SSE connection.
3. **WASM packaging bites hardest here.** See the foundation section: `resolveGrammarPaths` resolves two
   `.wasm` files from `node_modules` and breaks under bundling. Solvable via `GrammarOptions`, but it
   means debugging WASM resolution in a cold-start environment instead of shipping the feature.

**Recommendation.** Build on the existing EC2 instance. Move to Lambda when concurrent demand exceeds one
machine — at which point the worker lifts across as designed.

### Storage split

- **RDS** (existing): metadata only — repos, snapshots, jobs, later users and sessions.
- **Object storage (S3):** the five `index/` JSON files, keyed by content-addressed snapshot id.

Do not put index artifacts in RDS; that is the same "wrong fit for graph data" reasoning that removed
MySQL. **On-disk size of `broadleaf/index/` has not been measured** — measure before sizing.

### The viewer swap surface is two files

`web/src/lib/repohive/repo-registry.ts` is by its own docstring the only place a repo id maps to a
directory, and `web/src/lib/repohive/index-loader.ts` is 30 lines and the only fs reader in the viewer.
Both docstrings already anticipate a hosted store replacing them. Route handlers and the `ZoomMap`
contract stay put.

### AGPL is no longer a hosting constraint — struck 2026-08-23

This section previously argued that because `packages/web` imports `@repohive/core` in three modules,
serving the app pulls the engine inside AGPL §13's network-use obligation, and that a separate engine-only
read service was what preserved the option of keeping the engine closed.

**That option is explicitly not wanted.** Everything ships from the public repo (owner, 2026-08-23), so the
engine being inside the served work is intended. Retained here only so the reasoning is not rediscovered
and re-argued.

**Consequence:** if a separate engine-only service is built, it must be justified on performance or
operational grounds alone — for instance keeping an 80 s CPU-bound pipeline off the web tier. Licence
separation is not a reason. Attribution obligations are unchanged (`NOTICE`, AGPL-3.0-or-later).

### Auth, in cost order

Public repos need no account. The seven route handlers are unauthenticated today, so putting something in
front of them is step one of hosting regardless of accounts. Sessions are cheap. **Private repos are the
real cost:** a GitHub App, plus user tokens that must be encrypted at rest and never stored in RDS in
plaintext. `visibility` on the snapshot from day one keeps all of this additive.

### Plan

1. Foundation seams (all four).
2. Engine-only indexing service: HTTP entry, `worker_threads` pipeline, SSE progress. **Guard rails ship
   with the endpoint, not after it.**
3. Viewer swap: `repo-registry` reads RDS, `index-loader` reads object storage.
4. Auth: public first, then accounts, then private repos.

**Estimate**, stage by stage: foundation 2–3 d · service with guard rails 4–5 d · viewer swap 1–2 d ·
public auth 2 d · private repos 4–5 d. Estimates.

---

## Appendix — additional-language support: explored on request, EXPLICITLY NOT PLANNED

Recorded 2026-08-23 because the owner asked for the assessment while stating it is **not** an idea to act on.
**This is not a workstream and not a backlog item.** It is here so the analysis is not redone and so nobody
mistakes it for scope.

**Measured Java-coupling in `parser/src`** (count of Java-specific references per non-test file):

| File | Hits | What they are |
|------|------|---------------|
| `ast-extractor.ts` | 37 | the grammar plus five node-type lookup tables |
| `source-collector.ts` | 19 | mostly the `.java` extension filter |
| `ids.ts` | 10 | almost all doc examples |
| `source-root.ts` | 9 | the package↔directory convention |
| `symbol-table.ts` | 3 | all comments |
| **`stitcher.ts`** | **2** | **both comments** |

The significant row is the last: `stitcher.ts` (18.6 KB) does the hard part — resolving a reference in one
file to a definition in another — and is already essentially language-agnostic. `ast-extractor.ts`
concentrates grammar knowledge into five module-level Sets (`TYPE_DECLARATION_TYPES`,
`FUNCTION_DECLARATION_TYPES`, `TYPED_BY_FIELD`, `TYPE_WRAPPERS`, `TYPE_NAME_NODE_TYPES`). `source-root.ts`
derives the source root purely from package↔directory correspondence with no build-file parsing, which
generalises to any language whose namespace mirrors its folders.

So a new language is approximately: a WASM grammar, five lookup tables, one file extension.

| Tier | Languages | Why |
|------|-----------|-----|
| 1 — closest to drop-in | **Kotlin** (nearest by far), **C#**, **Scala** | declared namespace matching directory, explicit imports, named type + function declarations. `source-root.ts` works unchanged for Kotlin; for C# namespace↔directory is convention not rule, so its full-path fallback fires more often — still total |
| 2 — moderate | **Go**, **Python** | import model differs but stays declarative. Go: packages *are* directories, `struct`/`interface` map onto the existing `class` kind. Python: packages are directories, imports explicit, but almost nothing is type-declared so `sharedTypeCount` and method-call resolution degrade badly; import-level edges still work |
| 3 — looks easy, is not | **TypeScript / JavaScript** | imports are *path-based*, not namespace-based, so `source-root.ts`'s premise does not apply at all. Needs real module resolution: tsconfig path aliases, extension inference, `index.ts` resolution, `node_modules` walking, barrel re-exports. A subsystem, not a table |
| 4 — hard | **C / C++**, **Rust** | preprocessor and header/impl split with build-system-dependent include paths; Rust's module tree is built by following `mod` declarations |

**The contract absorbs Tiers 1 and 2 unchanged** — `packagePath` is already optional and `kind` is already
`file | function | class`. That is real validation of the contract design.

**Caveats:** "not much effort" is still a few days per Tier-1 language to get import edges genuinely right,
and signal *quality* varies with how much type information the language declares (Java near best case,
Python near worst of those listed). There is also **no `LanguageAdapter` interface today** —
`ast-extractor.ts` *is* the Java adapter, with its tables as module-level constants. Extracting them into
injectable configuration would be the seam, if this were ever taken up. It is not.

## Dependency and parallelism map

| Path | Blocked by | Can start now |
|------|-----------|---------------|
| Path 1 — component reuse | nothing | **yes** |
| Foundation seams | nothing | **yes** |
| Path 3 — MCP, read-only v1 | nothing | **yes** |
| Path 2 — CLI, Stage 1 | orchestration | after the foundation, or it owns orchestration |
| Path 2 — CLI, Stage 2 (single-file viewer) | nothing in Path 1 | independently |
| Path 4 — hosted | all four seams | after the foundation |

**Path 1 and Path 2 have no overlap, in files or in dependencies.** An 18:25 entry briefly claimed a one-way
dependency — that the CLI's viewer needed Path 1's subtractive pass first — which held only while the CLI was
to static-export the vendored app. It ships only the hierarchical viewer, so that is withdrawn.

**Decided 2026-08-23: everything runs in parallel worktrees.** Suggested set: `feat/engine-seams` ·
`feat/viewer-polish` · `feat/cli` · `feat/mcp` · `feat/hosted`. File overlap between Path 1, the CLI and MCP
is nil.

**Four things serialize regardless of worktrees:**

1. **Orchestration is contested and must be de-conflicted first — the live risk of going parallel.** Both the
   CLI and the hosted path need a parse→group layer. If each worktree builds its own, the result is two
   incompatible implementations and an unresolvable merge. **Mitigation: define the orchestration package's
   interface first** — one file of type signatures, a couple of hours — so both worktrees code against it
   while the seam worktree supplies the implementation. Do this before either writes orchestration code.
2. **The rest of the foundation must have exactly one owner.** Three streams each inventing a source provider
   and a storage interface produces three incompatible seams.
3. **The Node test-script fix touches the `package.json` files the CLI extraction disturbs.** Sequence it
   first.
4. **Memory files.** `DECISIONS.md` is append-only newest-first and `PROJECT_STATE.md` is rewritten in place,
   so parallel agents must land memory one at a time rather than each syncing independently. Now a practical
   constraint, not a theoretical one.

### The replay no longer gates any of this — resolved 2026-08-23

This section previously held that the replay's asserted 57-commit total gated every worktree. **The owner
has ruled the replay independent of development;** commit freely.

The mechanical hazard moved rather than vanished: `05-append-new-batches.ps1` still asserts an expected
total, so whoever next runs the replay must **recount instead of trusting 57** and must not apply on an
unexpected number.

---

## Open owner decisions

**This is the complete list, and it is the authoritative one.** `PROJECT_STATE.md` points here rather than
carrying a second copy — a parallel list drifted incomplete once already (2026-08-23 18:56).

### Open — nothing blocks the CLI requirements spec any more

1. **Confirm lockstep versioning.** `0.x` is decided; whether all four packages share one number and move
   together was **assumed** from the recommendation being agreed to, not stated. Cheap to confirm, expensive
   to change after the first publish.
2. **Is a first publish with no viewer acceptable?** Stage 1 = `index` + `--json`, ships in days.
   Recommended yes, with the viewer following as a minor version. Does not block the spec.

### The one sequencing item inside a parallel plan

3. **Define the orchestration function's signature before either the CLI or the hosted worktree writes
   orchestration code.** One small file of type signatures. Both will call it; two independent versions would
   be an unresolvable merge. Not a decision so much as a task that must land first.

### Deferred pending an explicit owner call — do not act

6. **The systematic steering-drift audit.** Five documentation claims have been found wrong by accident, all
   the same shape: prose asserting facts that live in `package.json`, `tsconfig.json` or source, with nothing
   reconciling them. Recommended, because these are the files an agent reads first. **Owner will call it.**
7. **Duplicate working registers** — `gaps.md`, `fixes.md`, `edge-case-audit.md` exist in both `.kiro/`
   (tracked) and `docs/` (untracked). Neither diffed nor deleted. **Owner will call it. Delete nothing.**

### Resolved, kept here so they are not reopened

- **Academic deadline is live**, and polishing the existing viewer with a few more components is sufficient
  for it. Which components is **parked** — do not start that brainstorm.
- **All workstreams run in parallel worktrees.** The "which path first" sequencing question is closed; do not
  re-propose an ordering.
- **Seam work does not block the CLI.** Only orchestration is a CLI prerequisite and the CLI contains it;
  source provider, storage interface and snapshot ids are all safely retrofittable behind defaults. What is
  *not* retrofittable is the published surface — `.repohive/` layout, command and flag names, `--json` shape,
  exit codes.
- **Command names final:** `index` / `parse` / `group` / `view`; `describe` deferred. Install guidance is
  `npm i -g repohive` → `repohive index .`, or `npx repohive index .`.
- **Bundler: Vite + `vite-plugin-singlefile`**, and `stack.md`'s tool lists are **extensible, not boundaries**.
- **Version: `0.x`** (lockstep assumed — item 1 above).
- **Output directory `.repohive/`** · **packaging = four packages, CLI depends on the three** · the CLI ships
  the **hierarchical viewer only** · npm name settled (`repohive` is free) · public-only shipping so **AGPL is
  moot** · the replay **does not gate development** · **`fable-work` is default, no merge**, branch placement
  and git plans out of scope · **CLI before MCP**.

---

## Evidence and confidence

**Verified by reading the code, 2026-08-22 to 2026-08-23:** the three parser fs touchpoints and the
required `projectDirectory`; the absent orchestration layer; the asymmetric storage seam with line
references; `core`'s exported surface, hence MCP's independence from the CLI; `packages/cli` containing
only `.gitkeep`; every package being private at `0.0.0`; the WASM resolution mechanism and its
`GrammarOptions` escape hatch; the two-file viewer swap surface; `workspaceStub()` hiding group G; the
page inventory and its endpoint mapping; the adapter convention.

**Measured 2026-08-23 on this machine:** every size in the Path 2 distribution table (directory sums over
`node_modules`, `packages/*/dist`, `packages/web/.next`); which files import `recharts` / `d3-hierarchy` /
`elkjs` / `shiki` / `sigma`; that the three real pages are `"use client"` and fetch via SWR;
`next.config.ts` setting `output: "standalone"`; the complete bare-specifier import set of
`packages/ui/src/zoom` (20 files) and `web/src/components/zoom` (6 files); the per-file Java-coupling counts
in the appendix; that `dist/` is git-ignored at `.gitignore:8` with zero tracked files, so published tarballs
carry compiled output only (`files: ["dist"]`).

**Checked against the npm registry 2026-08-23:** `repohive` is unpublished — `registry.npmjs.org/repohive`
returns 404 and a registry search returns zero results.

**Facts cited from AWS documentation, not tested on the owner's account:** Lambda response streaming and
API Gateway `STREAM` transfer mode.

**Not verified:** availability of the `@repohive` *scope* (only the unscoped name was checked); on-disk size
of `broadleaf/index/`; whether `web/src/lib/route-links.test.ts` asserts redirect targets; runtime
confirmation that each of the 26 dead pages 404s (the mapping is static, from endpoint literals in
`api-client/src/*.ts` against the seven existing route handlers); whether `output: "export"` succeeds on
this app in practice — the analysis is from the config and the page/handler shapes, not from a trial build.

**All effort figures in this document are estimates.** No verification gate was run for this document —
it changes no code.
