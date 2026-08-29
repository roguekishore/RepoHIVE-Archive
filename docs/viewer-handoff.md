# Viewer handoff — what is buildable with the current engine output

> ## Read § 10 first
>
> **§ 10 "Design authority" grants you total latitude over everything visual** — the graph viewer, the
> canvas, node and edge design, layout, the information architecture, the existing surfaces, all of it.
> The bar is an Awwwards-worthy site, designed by you as a senior designer, not a tidy dashboard built to
> this document's taste.
>
> **Sections 2–7 are an inventory of what the data supports, not a specification of what to build.** They
> exist so you do not have to rediscover the engine's output. Everything in them is a suggestion; § 8 and
> § 10 hold the only real constraints.

**Scope:** the viewer. The engine is complete and is not to be changed, except for the one additive field
in § 5. Written 2026-08-27, design authority added 2026-08-29.

**Goal:** a viewer that demonstrates the algorithm well, fed by data the engine already emits. Analysis and
design are both yours.

---

## 1. Run it

```
npm install
npm run build                          # tsc -b packages/parser packages/core
npm run dev --workspace @repohive/web  # port 3000 (long-running; start it yourself)
```

Indexed fixtures already exist under `fixtures/{vantage,broadleaf,sample-java-project}/index/`.
`vantage` (158 files) is the comfortable one to develop against; `broadleaf` (2985 files) is the scale
test. To regenerate: `npm run parse -- fixtures/vantage` then `npm run group -- <graph.json>`.

**Note:** `sample-java-project`'s `index/` is stale and predates region provenance — its group nodes carry
no `regionId`. Re-index it before using it, or use `vantage`.

---

## 2. What the engine emits

Five files per repo in `index/`. Verified against `fixtures/vantage/index/` on 2026-08-27.

### `metadata.json`

Top level: `nodeCount`, `edgeCount`, `hierarchyDepth`, `averageBranchingFactor`, `totalCrossGroupEdges`,
`structuralQualityBoundary`, `cohesionSquashConstant`, `configuration`, `metricWeights`, `perLevel[]`,
`regionDecisions[]`.

**`regionDecisions[]`** — one per region. This is the most valuable array in the artifact:

| Field | Example | Notes |
|-------|---------|-------|
| `regionId` | `pkg:com.backend.springapp` | scheme-prefixed |
| `action` | `preserve` \| `reconstruct` | the decision actually applied |
| `automaticAction` | `preserve` \| `reconstruct` | what the algorithm chose before any override |
| `cohesion` | `0` – `1` | per-region metric |
| `coupling` | `0` – `1` | per-region metric |
| `score` | `0.000` – `0.845` | compared against `structuralQualityBoundary` (0.5) |
| `decisionConfidence` | `0.5` | distance from the boundary |
| `userOverridden` | `false` | `action !== automaticAction` when true |
| `groupIds` | array | the groups this region produced |

vantage has 20 regions, split 10 preserve / 10 reconstruct. broadleaf has 502, split 38 / 464.

**`perLevel[]`** — five rows, each `{ level, groupNodeCount, leafNodeCount, crossGroupEdgeCount,
leafEdgeCount }`. Already shaped like a chart input.

**`configuration`** — `communityDetectionSeed` (42), `structuralQualityBoundary` (0.5),
`hierarchy.maxGroupSize` (20), `hierarchy.minPartitionThreshold` (2), `weightCoefficients`
(import/call/sharedType, all 1), `assessment`, `overrides`.

**`metricWeights`** — `cohesion` 0.4, `coupling` 0.4.

### `nodes.json`

`{ nodes: [...] }`. File / class / function entries carry `id`, `kind`, `level`, `packagePath`,
`directoryPath`, and `definedInFile` for class and function. **Group entries carry `regionId` and
`ordinal`.**

### `hierarchy.json`

`{ repositoryId, nodes: [...] }` — the containment tree. Each node has `id`, `kind`, `level`, `parentId`,
`childIds`.

### `edges.json`

Leaf edges with `importFrequency`, `methodCallFrequency`, `sharedTypeCount` and an optional `strength`,
plus aggregated cross-group edges carrying a `weight`.

### `repository.json`

`repositoryId`, `nodeCount`, `edgeCount`, `hierarchyDepth`.

---

## 3. Two things that will cost you an hour if nobody says them

**`regionId` and `ordinal` live in `nodes.json`, not `hierarchy.json`.** Verified: 0 of 55 group nodes in
vantage's `hierarchy.json` carry them; all 55 group entries in `nodes.json` do. The `Hierarchy` object
returned by `@repohive/core`'s `parseIndex()` is an **assembled** view across all five files and is richer
than any single file on disk — `leafAttributes`, `leafEdges` and `crossGroupEdges` are properties of that
object, not keys in `hierarchy.json`.

**Never invent a value the engine does not emit.** When a vendored component wants a field we have no
source for, pass an explicit neutral zero and let it read as absent. `web/src/lib/repohive/zoom-map-adapter.ts`
is the reference implementation (see its lines around the `hotspot_count: 0` block and the comment "No
engine data for these"). Fabricated-looking metrics are the one thing that will not survive a reviewer
poking at the demo.

---

## 4. Buildable now, zero engine change

Ordered by value, not by effort.

| # | Surface | Component to reuse | Fed by |
|---|---------|--------------------|--------|
| 1 | **Decision scatter** — cohesion vs coupling, one dot per region, colour by action, the 0.5 boundary drawn as a line | `ui/src/health/impact-effort-quadrant.tsx` or `churn-complexity-quadrant.tsx`, relabelled | `cohesion`, `coupling`, `action`, `structuralQualityBoundary` |
| 2 | Region decision table, sortable | `ui/src/shared/responsive-table/` — generic over `T` | every `regionDecisions` field |
| 3 | DSM grid over groups | `ui/src/workspace/dsm/dsm-matrix.tsx` (`DsmMatrixView`) | crossGroupEdges |
| 4 | Coupling ring (hierarchical edge bundling) | `ui/src/coupling/coupling-graph.tsx` + `coupling-table.tsx` | edges + `directoryPath` |
| 5 | Group→group dependency heatmap | `ui/src/dashboard/dependency-heatmap.tsx` | crossGroupEdges |
| 6 | Header metric tiles | `ui/src/shared/metric-card.tsx`, `stat-grid.tsx`, `ui/src/stats/stat-ribbon.tsx` | metadata totals |
| 7 | Preserve/reconstruct donut | `ui/src/dashboard/language-donut.tsx` — takes `Record<string, number>` | action counts |
| 8 | Score and confidence dials | `ui/src/dashboard/health-score-ring.tsx`, `ui/src/health/score-breakdown.tsx`, `ui/src/wiki/confidence-badge.tsx` | `score`, `decisionConfidence` |
| 9 | Nodes and edges per hierarchy level | `ui/src/health/trend-chart.tsx` or any bar chart | `perLevel[]` |
| 10 | Hierarchy as a Mermaid diagram | `ui/src/wiki/mermaid-diagram.tsx` — takes a string | hierarchy tree |
| 11 | Configuration panel — seed, boundary, weights, coefficients | `ResponsiveTable` or plain markup | `configuration`, `metricWeights` |
| 12 | Override audit — where `action !== automaticAction` | `ResponsiveTable` + a badge | `userOverridden`, `automaticAction` |

**Start with #1.** `cohesion` and `coupling` are recorded per region, so every region can be plotted
against the boundary that decided its fate, with preserve and reconstruct visibly separating. That is the
project's actual contribution rendered in one chart, and nothing in the viewer shows it today.

**#9 and #11 are nearly free** — `perLevel[]` and `configuration` are already shaped for display.

### Where the code goes

- **Adapter** — a new pure module in `packages/web/src/lib/repohive/`, one per surface, engine types in
  and vendored types out. No fs, no network, no clock, no randomness. Sort everything canonically.
- **Route handler** — `packages/web/src/app/api/...`, following the existing pattern:
  `getRegistryRepo` → `resolveIndexDir` → `loadIndex` → adapter → `NextResponse.json`.
- **Page** — `packages/web/src/app/repos/[id]/<surface>/page.tsx`.
- **Navigation** — move the item into `repoNavGroups()` in
  `packages/web/src/components/layout/nav-items.ts`. That function is the single gate on which surfaces are
  reachable; `allRepoNavGroups()` beside it holds the full vendored menu and is referenced by nothing.

`packages/ui/COMPONENT_CONTRACTS.md` documents the prop shapes for the vendored components. It is stale on
package names (`@repowise-dev/*` where the live code uses `@repohive/*`) — trust the shapes, not the names.

---

## 5. Needs one additive engine field

**Per-leaf size — LOC or byte count on file nodes.** Unlocks all three treemaps
(`ui/src/files/files-treemap.tsx`, `ui/src/health/code-health-map.tsx`,
`ui/src/git/ownership-treemap.tsx`), which need an area per leaf. Purely additive to the JSON contract, so
it breaks nothing. Coordinate before adding it.

Centrality (PageRank / betweenness) is also computable from the existing edges — `graphology-metrics` is
already a dependency — which would feed `ui/src/graph/centrality-leaderboard.tsx`.

---

## 6. Do not attempt

| Surface | Why |
|---------|-----|
| `ui/src/graph/graph-flow.tsx` | needs five separate datasets; four have no source |
| `ui/src/workspace/system-map/*` | needs service-level nodes and typed transports |
| Symbol pages | need signatures, docstrings and complexity the parser deliberately discards |
| The vendored `decisions` pages | those model **mined architecture decision records** — authored intent with status, author and prose. Same word, unrelated concept to our region decisions. Filling them means inventing data. `decision-audit` is already the real surface |
| Anything under `/workspace` | `workspaceStub()` returns `is_workspace: false`, which is what hides the cross-repo surfaces. Take components out of that folder if useful, but do not revive the pages |

**General rule: take the component, not the page.** The most reusable structural visual in the vendored
set is the DSM, and it sits on `/workspace/conformance` inside a group that cannot be fed. Importing
`DsmMatrixView` into a new repo-scoped page needs no engine change; reviving that page needs a
`SystemGraph` we do not produce.

---

## 7. Current viewer state, for orientation

51 `page.tsx` files: **3 real** (`knowledge-graph` — the semantic-zoom canvas, `flat-baseline`,
`decision-audit`), **22 redirect shells**, **26 dead** vendored pages whose endpoints 404. Only 7 route
handlers exist. The sidebar is gated to the three real surfaces, so nothing broken is reachable and no
fabricated data reaches the running app.

20 of the 22 redirect shells forward into dead pages and can be deleted; check
`packages/web/src/lib/route-links.test.ts` first in case it asserts their targets.

Two known cosmetic defects worth fixing while you are in there: `packages/web/src/app/page.tsx` swallows
failed fetches and renders `Total Pages 0` / `Fresh Pages 0` / `Stale Pages 0` in metric cards, which reads
as measured when it is not; and two dead controls sit on the Knowledge Graph page (a Structurizr export and
an "Open file page" link).

---

## 8. Constraints that are not negotiable

1. **Determinism.** Identical input produces byte-identical output. No `Math.random`, no clock, no
   dependence on `Object.keys` or `Set` iteration order for anything that reaches an artifact. Adapters
   sort canonically and tie-break on id.
2. **Engine packages (`parser`, `core`, `shared`) may not import from `web`, `ui`, `api-client` or `cli`.**
   The dependency runs one way.
3. **The JSON contract is additive-only.** Adding a field is safe; renaming, removing or redefining one is
   a breaking change needing a recorded decision.
4. **Join groups to decisions through `regionId` / `ordinal` / `groupIds`.** Never reconstruct that
   relationship from paths or package prefixes — that heuristic existed once and was removed for being
   wrong exactly where the adaptive behaviour matters most.
5. **Route handlers are unauthenticated and localhost-only.** Fine for local development; binding them to
   a non-loopback interface needs authentication first.
6. **Licence is AGPL-3.0-or-later.** Any new dependency must be compatible. The vendored `repowise`
   packages are AGPL and their attribution lives in `NOTICE`.

---

## 9. Build new components — the vendored set is a floor, not a ceiling

Sections 4 and 6 are about what can be *reused*. That is the cheap path, not the best one. **The vendored
components were built for a different product, and none of them was designed to show an adaptive
preserve-vs-reconstruct decision — because no other tool makes one.** So the surfaces that would demonstrate
this project best do not exist yet in this repo. Build them.

You have full latitude here. If a purpose-built component shows the algorithm better than a repurposed
vendored chart, build the purpose-built one. Improving the viewer itself is in scope.

### Where new components go

Keep ours separate from vendored code:

- **Shared, reusable** → a new `packages/ui/src/repohive/` namespace. Do not add our components inside
  vendored folders (`ui/src/workspace/`, `ui/src/health/`, …); that muddles what came from upstream and what
  is ours, which matters for the `NOTICE` attribution.
- **Surface-specific** → `packages/web/src/components/<surface>/`, which is the existing pattern
  (`web/src/components/zoom/` holds the chrome around the vendored canvas).
- **Extending a vendored type** is fine and already precedented: `ZoomNode.decision?: "preserve" |
  "reconstruct" | null` in `ui/src/zoom/types.ts` is an additive RepoHIVE field that upstream ignores. Add
  fields, do not fork types.

Everything in section 8 still applies — determinism, canonical ordering, no invented values.

### Ideas worth building, roughly by demonstrative value

These all run on recorded data. None needs an engine change.

**1. Before/after boundary morph.** For one reconstructed region, draw the *same* file set twice: once
partitioned by authored `packagePath`, once by the groups the engine produced. Side by side, or a toggle, or
an animated transition. This is the single most direct demonstration of the contribution — "here is what the
author wrote, here is what the dependencies say" — and nothing vendored comes close. Data: group membership
from `groupIds` plus each member file's `packagePath`.

**2. Boundary sensitivity slider.** The decision rule is `score >= structuralQualityBoundary`. Both the
per-region `score` and the boundary are recorded, so **dragging a boundary slider from 0 to 1 and watching
regions flip preserve ↔ reconstruct is pure client-side arithmetic** — no re-run, no engine call. It makes
the sensitivity analysis interactive instead of a table in a paper.

> **Honest limit, and state it in the UI.** A counterfactual boundary tells you *which regions would flip*.
> It cannot show the resulting hierarchy, because the groups a reconstructed region produces come from
> community detection that would have to actually run. Show the flip set; do not imply a recomputed tree.

**3. Decision provenance card.** For one region, show the worked calculation rather than the verdict:
`cohesion`, `coupling`, the `metricWeights` (0.4 / 0.4), the `cohesionSquashConstant`, the resulting `score`,
the `structuralQualityBoundary` it was compared against, `decisionConfidence`, and whether
`action` diverged from `automaticAction`. The claim is that every decision is explainable from structure
alone — this is the component that proves it instead of asserting it.

**4. Confidence strip.** All regions on one axis ordered by `score`, boundary marked, dot size by region
size. Marginal decisions cluster visibly around the line. Showing where the algorithm was *not* confident is
more persuasive to a reviewer than showing only where it was.

**5. Group composition / purity.** For each reconstructed group, which packages did its members come from?
A group drawing files from four different packages is the evidence that the authored structure was
misleading. Stacked bars, or a small sankey from packages to groups.

**6. Partition disagreement metric.** Per region, quantify how far the reconstruction moved from the
authored packages — a partition-distance number computed in the adapter, shown alongside the decision. Turns
"we regrouped it" into "we regrouped it *this much*".

**7. Determinism panel.** Group ids are content-addressed (`g_<sha1>` over canonical membership). Surfacing
that, and that re-running yields byte-identical output, makes the determinism claim tangible.

### Two framing notes

**Do not oversell.** These surfaces are convincing because every number is read from the index rather than
computed in the browser. The moment a component derives a metric the engine did not record, it stops being
evidence. If something needs a value we do not emit, ask for the engine field — several are cheap and
additive — rather than deriving it client-side.

**The differentiator is the recorded per-region decision.** Community detection, dependency graphs and
semantic zoom all exist elsewhere. Deciding *per region* whether the author's boundaries were already good,
recording why, and doing it deterministically is the part that does not. Weight the work toward surfaces that
show that, over surfaces that show a graph.

---

## 10. Design authority — read this before anything above

**Everything visual in this repo is yours to change. Without exception.**

That includes the graph viewer itself, the zoom canvas, node shapes, edge rendering, the layout algorithm,
typography, colour, spacing, motion, iconography, the information architecture, the navigation, the page
shells, and the three existing "real" surfaces. If you want to rewrite the canvas from scratch, rewrite it.
If node cards should not be cards, make them something else. If the whole visual language should change,
change it.

**Nothing in the vendored set is a design decision.** Those components were adopted to get engine data onto a
screen quickly — that is all. They came from a different product with different requirements and they carry
its aesthetic, not ours. Treat sections 4 and 6 above as *an inventory of what exists*, not a specification
of what to build. Where a vendored component is genuinely good, keep it. Where it is merely present, replace
it.

**Work as a senior product designer, not an implementer taking orders.** You have more design judgement than
this brief does. If the information architecture is wrong, restructure it. If a surface listed above is a bad
idea, say so and propose a better one. If something that would make the product obviously stronger is missing
from every list here, build that instead. Push back on anything in this document.

**The bar is an Awwwards-worthy site.** Not "a tidy developer dashboard" — genuine craft: a distinctive visual
identity, considered motion, deliberate typography, real attention to detail at every state. Aim for something
a designer would stop and look at.

### What that means for *this* product specifically

Design opportunities that are particular to what the engine does, offered as starting points rather than
requirements:

- **The preserve / reconstruct distinction deserves its own visual language.** It is the entire contribution.
  Two colours and a badge is the obvious answer and almost certainly not the best one. This is the identity
  of the product and it is currently unexpressed.
- **Density is the hard problem.** 2985 files, 502 regions, 14,325 edges in the large fixture. Anything that
  looks good at 20 nodes and collapses at 3000 is not a solution. The existing level-at-a-time semantic zoom
  is one answer to this; there are better ones.
- **The before/after boundary morph is the signature moment** (section 9, idea 1). Showing the authored
  package structure dissolving into the dependency-derived grouping is the one animation that explains the
  whole project without words. It deserves to be beautiful.
- **The boundary slider is an interactive centrepiece** (section 9, idea 2). Live, responsive, physical.
- **Progressive disclosure over dashboards.** This is a tool for understanding structure, not for monitoring
  metrics. Grids of stat cards are the lazy pattern and mostly the wrong one here.
- **Empty, loading, error and truncated states.** A large repo will hit rendering limits; a small one will
  look sparse. These states are where craft actually shows, and where the current viewer is weakest.

### The four things that survive full design latitude

Design freedom is total. These are not aesthetic constraints — they are correctness and legal ones.

1. **Never display a number the engine did not record.** Full latitude over *how* data is shown; none over
   *whether* it is real. If a design needs a metric we do not emit, either request an additive engine field or
   render the absence honestly. Inventing plausible-looking values is the one failure that would discredit the
   work. See the neutral-zero rule in section 3.
2. **Keep layout deterministic.** Identical input should produce an identical picture — sort by a stable key
   and tie-break on node id, as the current canvas does. This is not about restricting your layout choices; any
   algorithm is fine as long as it is seeded and stable. It is what makes screenshots, demos and paper figures
   reproducible, and the engine's determinism claim is undermined by a viewer that renders differently each
   load.
3. **Accessibility is part of the bar, not a tax on it.** Keyboard navigability, focus states, sufficient
   contrast, and meaningful semantics for anything conveyed by colour alone — the preserve/reconstruct
   distinction especially must not be colour-only. Awwwards evaluates usability, and this is a tool people
   will stare at for long sessions.
4. **Attribution survives whatever remains.** The repo is AGPL-3.0-or-later and the vendored `repowise`
   packages are credited in `NOTICE`. Replace as much vendored code as you like; keep the attribution accurate
   for what is still there.

Everything else — every component, every pixel, every interaction — is a design decision, and it is yours.
