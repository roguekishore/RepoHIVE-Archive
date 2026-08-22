# Review 2 — Grouping Algorithm Demonstration Guide

**Deliverable:** `group` — `graph.json` → `index/` (the navigable multi-level hierarchy).
**Spec:** `.kiro/specs/hierarchical-repository-grouping/` · **Branch for the engine code:** `phase-2-core`

> Message for this review: *"The flat tangle becomes a navigable hierarchy, automatically and
> reproducibly."* Every command and every block of output below was actually run against this repo

---

## 1. What was built

- `packages/core` — the full grouping pipeline:
  **ingest** (atomic validation) → **weight** (dependency strength from the three signals) →
  **assess** (per-Region cohesion + coupling, optional Newman modularity, normalized to a graded
  `[0,1]` structural-quality score) → **adaptively construct** (preserve well-structured Regions,
  reconstruct poor ones via seeded community detection) → **assemble** (multi-level hierarchy,
  balanced partitioning, content-addressed group IDs) → **serialize** (the five-file `index/`),
  plus **blast-radius** analysis and an **index parser** for round-trip reads.
- The `CommunityDetector` seam — the Reconstruct action depends on an interface, not on Louvain, so
  the contribution is *adaptive construction*, not "adaptive construction using Louvain". Phase 1
  ships `LouvainCommunityDetector` (seeded PRNG + canonical ordering + content-derived relabelling).
- Demo CLIs: `group`, `demo:group-determinism`, `demo:baselines`.
- `fixtures/mixed-quality-graph.json` — a hand-designed graph that exercises the adaptive decision
  in **both** directions (see §4 and the important caveat in §3).
- **79 tests** — each of the 33 correctness properties from `design.md` implemented as exactly one
  `fast-check` property test, plus unit and integration tests. All 16 tasks in
  `.kiro/specs/hierarchical-repository-grouping/tasks.md` are checked off.

## 2. Prerequisites

```bash
npm install
```

```bash
npm run build
```

Verified 2026-07-25: `npm run build` (which is `tsc -b packages/parser packages/core`) completes
with exit code 0 and no output. The demo scripts execute the compiled JavaScript in
`packages/core/dist`, so **build before demoing**.

## 3. Demo A — the real end-to-end pipeline (parse → group)

This proves the parser↔grouping seam: Review 1's output is Review 2's input, unmodified.

```bash
npm run parse -- fixtures/sample-java-project
```

**Actual output (captured 2026-07-25):**

```
RepoHIVE parser — parse
  project : ./fixtures/sample-java-project
  nodes   : 29
  edges   : 5
  output  : ./fixtures/sample-java-project/graph.json
  result  : OK
```

```bash
npm run group -- fixtures/sample-java-project
```

**Actual output (captured 2026-07-25):**

```
RepoHIVE group — adaptive hierarchical grouping
  input    : ./fixtures/sample-java-project/graph.json
  regions  : 4 (preserve 0 / reconstruct 4)
  boundary : 0.5
  nodes    : 38 hierarchy nodes (depth 4)
  edges    : 5 leaf + 8 cross-group
  output   : ./fixtures/sample-java-project/index
  result   : OK
```

29 flat graph nodes became a 38-node hierarchy of depth 4 (Repository → L1 → L2 → Files →
Functions/Classes), and 5 flat edges were preserved verbatim while 8 aggregated cross-group edges
were derived.

### ⚠ Be ready for this question: "why did nothing get preserved?"

**Answer it before a reviewer finds it.** All four Regions scored `0.000` and reconstructed. That is
correct behaviour for this input, and the reason is a *parser* limitation, not an algorithm bug:

- The Phase-1 parser derives edges from Java **`import` declarations** only
  (`methodCallFrequency` and `sharedTypeCount` are documented Phase-1 zeros).
- Java requires **no import between classes in the same package**.
- So real parsed Java has **no intra-package file-to-file edges**. Cohesion is computed from
  intra-Region edges, so every package Region has zero internal edges, hits the documented
  degenerate rule (Req 3.9), scores `0.0`, and falls below the boundary → *reconstruct*.

Confirmed on this fixture: `com.example.model` contains two files (`User.java`, `Account.java`) and
zero edges between them; all 5 edges cross package boundaries.

The honest framing for the panel: **the adaptive machinery is complete and verified, but the
signal that would let it see intra-package cohesion is not implemented yet.** Sharpening
`methodCallFrequency` / `sharedTypeCount` in the parser is the unlock (it was always scheduled as a
later refinement — the shape was correct from day one, the richness was deferred). Until then,
demonstrate the *preserve* branch with Demo B, which the review timeline explicitly sanctions.

## 4. Demo B — the core contribution: adaptive preserve vs reconstruct ★

This is the demo that shows the research contribution. It uses
`fixtures/mixed-quality-graph.json`: a hand-designed, contract-conforming graph in the *identical*
schema (`steering/review-timeline.md` names exactly this "safety valve" — the algorithm does not
care where the graph came from). Three packages with deliberately different structural quality.

```bash
npm run group -- fixtures/mixed-quality-graph.json
```

**Actual output (captured 2026-07-25):**

```
RepoHIVE group — adaptive hierarchical grouping
  input    : ./fixtures/mixed-quality-graph.json
  regions  : 3 (preserve 2 / reconstruct 1)
  boundary : 0.5
  nodes    : 29 hierarchy nodes (depth 4)
  edges    : 18 leaf + 10 cross-group
  output   : ./fixtures/mixed-quality-graph/index
  result   : OK
```

Then show the recorded decisions — this is the auditability claim made concrete. Open
`index/metadata.json`, or read them straight out of the policy comparison in Demo C:

| Region | Cohesion | Coupling | Score | Decision | Confidence |
|--------|----------|----------|-------|----------|------------|
| `com.acme.core` | 4.000 | 0.310 | **0.745** | preserve | 0.245 |
| `com.acme.util` | 3.333 | 0.500 | **0.635** | preserve | 0.135 |
| `com.acme.tangle` | 0.500 | 0.864 | **0.235** | reconstruct | 0.265 |

And what actually happened to the groups — the two healthy packages were kept whole, the tangle was
rebuilt into four dependency-derived communities:

```
Level-2 groups (6):
  g_d4c71280b3…  [5]  core/Config.java, core/Engine.java, core/Pipeline.java, core/Registry.java, core/Scheduler.java
  g_0f50d78daa…  [1]  tangle/ExportJob.java
  g_b46d9c22e2…  [1]  tangle/ImportJob.java
  g_15aea1dac7…  [2]  tangle/LegacyBridge.java, tangle/MailerShim.java
  g_dafda988a8…  [2]  tangle/ReportBuilder.java, tangle/RequestHandler.java
  g_fbc685c130…  [3]  util/MathUtil.java, util/StringUtil.java, util/TextFormat.java
```

Talking points:
- `com.acme.core` was **measured as good and left alone** — a single group of 5, its package
  boundary respected. A single global clustering strategy (the Graphify baseline) would have
  re-clustered it regardless.
- `com.acme.tangle` was **measured as poor and rebuilt** into 4 communities.
- `com.acme.util` sits nearest the boundary (confidence 0.135) — exactly the case the sensitivity
  analysis in `design.md` is designed to study. Say this out loud: the boundary is an *empirically
  calibrated, recorded parameter*, not a hidden magic number.
- Group IDs like `g_d4c71280b3…` are SHA-1 hashes of their canonicalized membership, never counters
  or timestamps — that is what makes the output reproducible (Demo D).

## 5. Demo C — the evaluation baselines (why adaptive, not global)

All three policies run the *identical* pipeline and differ only by configuration, so any difference
is attributable to the adaptive policy alone — no special code path exists for the baselines.

```bash
npm run demo:baselines -- fixtures/mixed-quality-graph.json
```

**Actual output (captured 2026-07-25):**

```
RepoHIVE core — construction-policy comparison (Evaluation Design)
  input: ./fixtures/mixed-quality-graph.json

  policy: always-preserve (boundary 0)
    decisions preserve/reconstruct: 3/0
    hierarchy depth: 4
    avg branching factor: 2.86
    cross-group edges: 4
    nodes per level: L0=1 L1=3 L2=3 L3=14 L4=5

  policy: always-reconstruct (boundary 1.000001)
    decisions preserve/reconstruct: 0/3
    hierarchy depth: 4
    avg branching factor: 2.18
    cross-group edges: 11
    nodes per level: L0=1 L1=3 L2=7 L3=14 L4=5

  policy: adaptive (boundary 0.5)
    decisions preserve/reconstruct: 2/1
    hierarchy depth: 4
    avg branching factor: 2.30
    cross-group edges: 10
    nodes per level: L0=1 L1=3 L2=6 L3=14 L4=5
    per-region decisions:
      preserve    score=0.745 confidence=0.245 cohesion=4.000 coupling=0.310 pkg:com.acme.core
      reconstruct score=0.235 confidence=0.265 cohesion=0.500 coupling=0.864 pkg:com.acme.tangle
      preserve    score=0.635 confidence=0.135 cohesion=3.333 coupling=0.500 pkg:com.acme.util
```

Talking point — and **keep it honest**: this shows the three policies produce measurably different
hierarchies (7 vs 3 vs 6 level-2 groups; 11 vs 4 vs 10 cross-group edges), which is what the
evaluation harness needs. It does **not** by itself prove adaptive is *better*; that claim requires
the navigation metrics over real mixed-quality repositories, which is the paper's experiment.
Per `steering/product.md`, Claim B is a hypothesis to prove, not a theorem.

## 6. Demo D — determinism proof

Determinism is the hard requirement from `steering/tech-stack.md`: no `Math.random`, no timestamps,
no counters anywhere that affects output. The check groups the same graph N times and hashes all
five index files together.

```bash
npm run demo:group-determinism -- fixtures/mixed-quality-graph.json 5
```

**Actual output (captured 2026-07-25):**

```
RepoHIVE core — grouping determinism check
  input   : ./fixtures/mixed-quality-graph.json
  runs    : 5
  regions : 3
  nodes   : 29 (depth 4)
  sha-256 : 43b2a1338b34e53bcb20b6035f2937ee5065ea7f6307931e2de675e28ce9796e
  result  : DETERMINISTIC (identical digest across all runs)
```

And on the real parsed fixture (`npm run demo:group-determinism` with no argument):

```
RepoHIVE core — grouping determinism check
  input   : ./fixtures/sample-java-project/graph.json
  runs    : 3
  regions : 4
  nodes   : 38 (depth 4)
  sha-256 : a2403bb02da9083ee59441ab6ea42c306df7430a658441a7d92d43e9c627b252
  result  : DETERMINISTIC (identical digest across all runs)
```

Talking points:
- The digest is regenerable live if a reviewer asks — pass a larger run count.
- Determinism survives *reordered input* too, not just repeated runs: Property 25 permutes the node
  and edge arrays and asserts byte-identical index files (100 generated cases per run).
- Louvain is inherently order- and seed-sensitive; it is made reproducible by a seeded PRNG, feeding
  nodes/edges in identifier-sorted order, and relabelling the resulting communities by a
  content-derived key.

## 7. Demo E — blast radius (Requirement 10)

Blast radius answers "if I change this file, what is impacted?" by reverse dependency traversal.
There is no CLI for it yet (it is a library function consumed by the Review 3 viewer), so demo it
with a one-liner against the compiled module:

```bash
node --input-type=module -e "import {readGraphFile,groupGraph,analyzeBlastRadius} from './packages/core/dist/index.js'; const g=readGraphFile('fixtures/mixed-quality-graph.json'); const r=groupGraph(g.value); const b=analyzeBlastRadius(r.value.hierarchy,'file:src/com/acme/util/TextFormat.java'); console.log('impacted nodes:',b.value.nodes.length,'| impacted groups:',b.value.groupNodes.length); for(const n of b.value.nodes) console.log('  -',n);"
```

**Actual output (captured 2026-07-25):**

```
impacted nodes: 9 | impacted groups: 7
  - file:src/com/acme/tangle/ExportJob.java
  - file:src/com/acme/tangle/ImportJob.java
  - file:src/com/acme/tangle/LegacyBridge.java
  - file:src/com/acme/tangle/MailerShim.java
  - file:src/com/acme/tangle/ReportBuilder.java
  - file:src/com/acme/tangle/RequestHandler.java
  - file:src/com/acme/util/MathUtil.java
  - file:src/com/acme/util/StringUtil.java
  - file:src/com/acme/util/TextFormat.java
```

The error paths are worth showing too — swap the node id in that command for a nonexistent one and
it returns `NODE_NOT_FOUND`; pass an empty string and it returns `EMPTY_NODE_ID` (both verified
2026-07-25). Errors are returned as values, never thrown, so every failure path is type-checked.

Talking points:
- Changing one utility file transitively impacts 9 nodes across 7 hierarchy groups — including
  files that never import it directly (they reach it through `StringUtil`/`MathUtil`).
- Traversal is cycle-safe (visited set) and deterministic (sorted output).
- State the honest caveat from `steering/product.md` unprompted: this is **static** reachability. It
  misses dynamic dependencies — reflection, dependency injection, string-based lookups — which are
  common in Java/Spring, so it can under-count.

## 8. Demo F — the `index/` output shape

Show that the five-file contract is real and self-describing.

```bash
ls fixtures/sample-java-project/index/
```

```
edges.json  hierarchy.json  metadata.json  nodes.json  repository.json
```

`repository.json` — the entry point:

```json
{
  "edgeCount": 13,
  "hierarchyDepth": 4,
  "nodeCount": 38,
  "repositoryId": "r_2b61aa37473a405df6a7dcaf0ea81898eac15a19"
}
```

`hierarchy.json` — containment only (a viewer walks this to expand one level at a time). The root,
then one file node with its members underneath it:

```json
{
  "childIds": [
    "g_82057fc1c11b118af8473d6abe12e4aff2d73ec8",
    "g_8b2f32d63f126c05159250355dae83701d684e2e",
    "g_dd7862f9352d948048804618fbb52e5a44c4e372",
    "g_e47031c83e0539fe8ff77ebba6b2ae457df6bdd8"
  ],
  "id": "r_2b61aa37473a405df6a7dcaf0ea81898eac15a19",
  "kind": "repository",
  "level": 0,
  "parentId": null
}
```

```json
{
  "childIds": [
    "class:com.example.Bootstrap",
    "func:com.example.Bootstrap#main(String[])"
  ],
  "id": "file:Bootstrap.java",
  "kind": "file",
  "level": 3,
  "parentId": "g_f6b314c09dca5e17c7fd8df5dc3b1908b84ec39b"
}
```

That second node *is* the "Files → Functions" bottom of the hierarchy: `Bootstrap.java` owns its
declared class and its `main` method, and its `parentId` is a content-addressed group.

`metadata.json` — the audit record that makes every decision reproducible: the boundary, the
per-metric weights, the cohesion squash constant, one entry per Region (cohesion, coupling, score,
action, automatic action, override flag, decision confidence), plus the scalability statistics
(per-level node/edge counts, total cross-group edges, average branching factor).

Talking point for the scalability claim (Requirement 11): `metadata.json`'s `perLevel` block is the
quantitative evidence for Review 3's "flat is unusable, hierarchical is navigable" argument — a
viewer renders one level (`L1=3`, `L2=6`) instead of all 29 nodes at once.

## 9. Demo G — the test suite

```bash
npm run test --workspace @repohive/core
```

**Actual result (captured 2026-07-25):** `79 tests, 79 pass, 0 fail`, across 14 test files:

- **All 33 correctness properties** from `design.md`, one `fast-check` property test each
  (100 generated cases per property; 30 for the filesystem round-trip properties), tagged
  `// Feature: hierarchical-repository-grouping, Property {n}: …` for traceability.
- Ingestion validation and atomicity, weighting totality/monotonicity/determinism, Region
  partitioning, score range and the degenerate rule, the preserve/reconstruct decision and override
  provenance, hierarchy shape and sizing, dependency preservation and cross-group aggregation,
  whole-pipeline determinism and order-independence, index round-trip and malformed-input rejection,
  blast-radius reachability and cycle termination.
- Non-vacuous checks worth mentioning if asked how the tests are trustworthy: community detection is
  asserted directly against a two-dense-cluster fixture (a detector that returned one community, or
  all singletons, would fail); cross-group edges are pinned by a hand-computed example, not only by
  a recompute; Requirement 5.7 replay is verified through a JSON round-trip, not in memory.

And the parser suite still passes unchanged, proving the seam did not regress:

```bash
npm run test --workspace @repohive/parser
```

**Actual result:** `102 tests, 102 pass, 0 fail`. Repo total: **181 tests green.**

## 10. Suggested 6-minute running order

| # | Command | What you say |
|---|---------|--------------|
| 1 | `npm run parse -- fixtures/sample-java-project` | "Review 1's flat graph — 29 nodes, 5 edges." |
| 2 | `npm run group -- fixtures/sample-java-project` | "Same graph, now a depth-4 hierarchy. Real end-to-end seam." |
| 3 | `npm run group -- fixtures/mixed-quality-graph.json` | "2 preserved, 1 reconstructed — the contribution." Show the decision table. |
| 4 | `npm run demo:baselines -- fixtures/mixed-quality-graph.json` | "Three policies, one pipeline, config only. Measurably different hierarchies." |
| 5 | `npm run demo:group-determinism -- fixtures/mixed-quality-graph.json 5` | "Identical SHA-256 across 5 runs — reproducible by construction." |
| 6 | `npm run test --workspace @repohive/core` | "79 tests, all 33 spec properties." |

Keep Demo E (blast radius) and Demo F (`index/` shape) in reserve for questions.

---

## 11. Gaps / things NOT yet done (flagged, not hidden)

The algorithm implementation is complete against the spec — all 11 requirements, all 16 tasks, all 33
properties. These items are outstanding and should be stated rather than discovered:

1. **The preserve branch cannot fire on real parsed Java yet.** As explained in §3, the parser's
   import-only signal means intra-package cohesion is always 0, so every real Region is degenerate
   and reconstructs. The algorithm is correct and verified; the *input signal* is the gap.
   Unlock: implement `methodCallFrequency` and `sharedTypeCount` in `packages/parser`. This is the
   single highest-value next engineering step, and it is a **parser** change, not a core change.
2. **No real-repository grouping run captured.** `fixtures/vantage/` (the 158-file Spring Boot
   checkout used in Review 1) is git-ignored and absent on this machine, so there is no
   `group`-on-a-real-repo number in this guide. Re-clone it and run
   `npm run parse -- fixtures/vantage && npm run group -- fixtures/vantage` for scale evidence.
   Expect all-reconstruct until item 1 lands.
3. **No navigation-metric evaluation yet.** Demo C shows the baselines *differ*; it does not show
   adaptive is *better*. The comparative navigation metrics (expansion steps, branching balance,
   cross-group coupling per level) over mixed-quality repositories are the paper's experiment and
   are not built.
4. **Modularity is off by default.** The optional Newman-Q secondary signal is implemented and
   tested but `computeModularity` defaults to `false`, so `metricWeights` in `metadata.json` shows
   only cohesion and coupling (renormalized). This is deliberate — modularity is circular with the
   reconstruct objective — but say so if a reviewer asks why it is missing from the output.
5. **`npm run group` is a temporary demo wrapper**, exactly like `npm run parse`. The packaged CLI
   is 8th-semester distribution work (`steering/architecture.md` engine-vs-ecosystem line).


None of these block demonstrating the grouping algorithm — items 2–4 are follow-on work, and item 1
is a known, documented, scheduled parser refinement whose absence you can explain confidently.