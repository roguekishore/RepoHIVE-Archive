# RepoHIVE — Fix Designs for the 2026-07-28 Edge-Case Audit

> Production-grade solution designs for every **High** and **Medium** gap found by the audit
> (`docs/gaps.md` Gaps 3–22; the register of all 525 cases examined is `docs/edge-case-audit.md`).
> Gaps 1 and 2 pre-date this audit and are referenced only where a fix depends on or bundles with them.
>
> **This is a design document. No code was changed.** Each fix states the exact files and functions to
> touch, a concrete approach with code sketches, the tests to add, and its determinism / contract /
> viewer impact. Where several approaches exist, the alternatives are given first, then a single
> **Recommended** solution and the **runner-up with the specific reason it lost**.

## How each Recommended solution was chosen

Options are judged on the project's own priorities, in this order:

1. **Preserves determinism** — identical input must still yield byte-identical output; no
   `Math.random`, no wall-clock, no counters in identifiers; all iteration canonically ordered.
2. **Keeps the JSON contract stable / viewer-safe** — `GraphNode` / `DependencyEdge` shape unchanged;
   ids may change *format* but must stay unique, deterministic, opaque strings.
3. **Covers all edge cases with the fewest heuristics** — a total rule beats a pile of special cases.
4. **Lowest implementation + review cost.**
5. **Most future-proof** — multi-language front-ends, incremental re-indexing, Neo4j storage later.

## Testing conventions every fix follows

`node:test` + `fast-check`, test files beside their sources (`packages/*/src/*.test.ts`), 100+ runs per
property (`fc.assert(..., { numRuns: 100 })`), and each property test tagged with the comment form
already used in the repo:

```
// Feature: <spec-name>, Property {number}: {property_text}
```

Where a fix establishes a genuinely new correctness property, the design says so explicitly and the
property should be added to the relevant spec's Correctness Properties section — the specs are the
source of truth, and a fix that invents an untracked invariant defeats the spec-driven process.

## Recommended sequencing

Five bundles. Within a bundle the order matters; bundles B–E are mutually independent and can run in
parallel with A.

| Bundle | Contents | Why bundled | Ships before |
|---|---|---|---|
| **A — Parser identity & resolution** | Gap 7 → Gap 6 → Gap 4 → Gap 5 → Gap 8 → (known Gap 2) → Gap 17 | Every item changes node-id *format* or the edge set, so each one invalidates `graph.json` and every downstream `index/`. Doing them as one ADR + one re-parse avoids re-churning every artifact five times. | Review 3, and before any `broadleaf`-based evaluation |
| **B — Untrusted-input gates** | Gap 13 → Gap 3 (core half) → Gap 14 → Gap 15 → Gap 9 | One validation gate at ingest plus one at config resolution closes all five; Gap 3's core half and Gaps 14/15 are *consequences* of Gap 13's gate existing. | Review 3 |
| **C — Index durability & read-back** | Gap 10 → Gap 11 → Gap 22 | All three touch the `index/` write/read seam and share the "redundant counts are checkable invariants" idea. | Review 3 (the viewer reads this seam) |
| **D — Viewer prerequisites** | Gap 12 | Additive index fields the Phase-3 viewer cannot work without. | **Must precede `packages/web` design** |
| **E — Independent** | Gap 16, Gap 18, Gap 19, Gap 20, Gap 21 | No interdependencies. Gap 16 must land **before or with** the Gap 1 signal work, which would otherwise trigger it on every real repository. | Gap 16 before Gap 1's fix |

### Dependency notes

- **Gap 3 (core half) depends on Gap 13.** Element-shape validation at ingest removes the
  `null`-element `TypeError` at its source, leaving only the boundary `try`/`catch` to add.
- **Gaps 14 and 15 depend on Gap 13.** Both are enforced by the same ingest gate; implementing them
  separately would mean writing the validation walk twice.
- **Gap 20 depends on Gap 9.** New CLI flags must validate through `validateConfig`, or the CLI becomes
  a new way to inject the unvalidated values Gap 9 exists to reject.
- **Gap 18 depends on Gap 9's boundary-domain decision.** `demo-baselines.ts` currently relies on the
  out-of-range boundary `1.000001` being accepted.
- **Gap 12 should follow Bundle A.** Bundle A makes ids longer and more path-coupled, which is exactly
  the condition that makes a separate display label mandatory rather than merely nice.
- **Gap 16 must precede Gap 1's signal enrichment.** The stitcher would otherwise emit all-zero-signal
  edges and every reconstructed region would explode into singletons.
- **Gap 17 belongs with Bundle A** because unifying the comparator changes core ordering — and hence
  content-addressed group ids — for repositories containing supplementary-plane identifiers. Folding it
  into A's single re-index keeps that churn to one event.

## Viewer impact at a glance

`packages/web` does not exist yet (it holds only a `.gitkeep`), so all viewer analysis below reasons
from the JSON contract and the grouping design: a React + React Flow semantic-zoom viewer that reads
`index/*.json` and renders roughly one hierarchy level (~5–20 nodes) at a time, plus a flat-baseline
viewer.

| Gap | Fix | Viewer impact |
|---|---|---|
| 12 | Group labels + Region provenance | **potential-blocker** (this fix *is* the unblock) |
| 4 | Scope-aware node identity | viewer-spec-note-needed (more leaf nodes per file) |
| 5 | Id-separator disambiguation + uniqueness gate | viewer-spec-note-needed (id format) |
| 6 | Type-driven parameter lists | viewer-spec-note-needed (id format) |
| 8 | Nested / wildcard / static resolution | viewer-spec-note-needed (edge counts rise) |
| 16 | Strength-aware degenerate rule | viewer-spec-note-needed (prevents level explosion) |
| 19 | Collector exclusions | viewer-spec-note-needed (node counts drop) |
| 7 | Structural qualified names | viewer-spec-note-needed (region ids change) |
| 17 | Unified canonical order | viewer-spec-note-needed (group ids change for non-ASCII) |
| 3, 9, 10, 11, 13, 14, 15, 18, 20, 21, 22 | — | none |

**The single most important viewer conclusion:** several fixes make node ids longer, path-coupled, or
scope-qualified (Gaps 4, 5, 6, plus known Gap 2). The viewer must therefore **never render a raw node
id**. It needs a display label composed from `packagePath` + simple name for leaves, and — for groups,
which carry neither today — the label and provenance fields added by Gap 12. This is called out on every
affected fix below.

---

# High-severity fixes

## Fix 1 — Gap 13: validate `graph.json` element shapes at the ingest gate

**Severity** High · **Bundle** B (first) · **Depends on** nothing · **Enables** Gap 3 (core half), Gap 14, Gap 15 · **Viewer impact** none

### Gap summary

`readGraphFile` blind-casts `JSON.parse` output to `RawDependencyGraph` (`packages/core/src/orchestrator.ts:154`)
and `ingest` validates only ids, endpoints, and the `definedInFile` invariant
(`packages/core/src/ingestor.ts:17-75`), so wrongly-typed fields flow into the algorithm: a string
`"5"` silently becomes strength 5, a fractional `2.5` is accepted despite the contract saying integer,
and an empty-string id or unknown `kind` passes. Worse, because `compareDependencyEdges` tie-breaks with
numeric subtraction (`canonical.ts:48-54`), string-valued signals produce `NaN` comparisons that leave
parallel edges in **input order** — a reproduced violation of Requirement 7.2, the project's hardest
guarantee.

### Files / functions to change

| File | Change |
|---|---|
| `packages/core/src/ingestor.ts` | New `validateRawGraph` pass, run first inside `ingest` |
| `packages/core/src/errors.ts` | Extend `GroupingError` with `MALFORMED_NODE` / `MALFORMED_EDGE`; extend `describeError` |
| `packages/core/src/canonical.ts` | Make `compareDependencyEdges` NaN-safe |
| `packages/core/src/ingestor.test.ts`, `canonical-and-ids.test.ts` | Tests below |
| `.kiro/specs/hierarchical-repository-grouping/requirements.md` + `design.md` | Add the acceptance criteria and property this establishes (Req 1 gains a field-validity clause) |

### Recommended solution

A single total validation walk at the head of `ingest`, before the existing duplicate/dangling checks so
the atomic-rejection order stays well defined, plus a comparator that cannot tie on differing content.

```ts
// ingestor.ts — runs before duplicate/dangling/definedInFile checks
const KINDS = new Set<GraphNode["kind"]>(["file", "class", "function", "group", "repository"]);

function nonNegInt(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function validateRawGraph(input: RawDependencyGraph): GroupingError | null {
  for (const node of input.nodes) {
    if (node === null || typeof node !== "object") {
      return { code: "MALFORMED_NODE", nodeId: "", detail: "node entry is not an object" };
    }
    if (typeof node.id !== "string" || node.id.length === 0) {
      return { code: "MALFORMED_NODE", nodeId: String(node.id), detail: "id must be a non-empty string" };
    }
    if (!KINDS.has(node.kind)) {
      return { code: "MALFORMED_NODE", nodeId: node.id, detail: `unknown kind "${String(node.kind)}"` };
    }
    if (typeof node.directoryPath !== "string") {
      return { code: "MALFORMED_NODE", nodeId: node.id, detail: "directoryPath must be a string" };
    }
    if (node.packagePath !== undefined && typeof node.packagePath !== "string") {
      return { code: "MALFORMED_NODE", nodeId: node.id, detail: "packagePath must be a string when present" };
    }
    // file nodes must NOT carry definedInFile (contract §GraphNode); class/function are
    // checked by the existing gate further down.
    if (node.kind === "file" && node.definedInFile !== undefined) {
      return { code: "MALFORMED_NODE", nodeId: node.id, detail: "file nodes must omit definedInFile" };
    }
  }
  for (const edge of input.edges) {
    if (edge === null || typeof edge !== "object") {
      return { code: "MALFORMED_EDGE", detail: "edge entry is not an object" };
    }
    if (typeof edge.source !== "string" || typeof edge.target !== "string") {
      return { code: "MALFORMED_EDGE", detail: "source and target must be strings" };
    }
    for (const field of ["importFrequency", "methodCallFrequency", "sharedTypeCount"] as const) {
      if (!nonNegInt(edge[field])) {
        return {
          code: "MALFORMED_EDGE", source: edge.source, target: edge.target,
          detail: `${field} must be a non-negative integer, got ${JSON.stringify(edge[field])}`,
        };
      }
    }
    if (edge.strength !== undefined && !(typeof edge.strength === "number" && Number.isFinite(edge.strength) && edge.strength >= 0)) {
      return { code: "MALFORMED_EDGE", source: edge.source, target: edge.target, detail: "strength must be a finite non-negative number when present" };
    }
  }
  return null;
}
```

And the comparator, made total regardless of what reaches it:

```ts
// canonical.ts — NaN-safe numeric ordering; NaN sorts last and equal to itself,
// so the comparator is a total order even on contract-violating values.
function compareNumbers(a: number, b: number): number {
  const an = Number.isNaN(a), bn = Number.isNaN(b);
  if (an || bn) return an && bn ? 0 : an ? 1 : -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareDependencyEdges(a: EdgeLike, b: EdgeLike): number {
  return (
    compareIds(a.source, b.source) ||
    compareIds(a.target, b.target) ||
    compareNumbers(Number(a.importFrequency), Number(b.importFrequency)) ||
    compareNumbers(Number(a.methodCallFrequency), Number(b.methodCallFrequency)) ||
    compareNumbers(Number(a.sharedTypeCount), Number(b.sharedTypeCount))
  );
}
```

Keeping the comparator fix *even though* validation now rejects such input is deliberate defence in
depth: `compareDependencyEdges` is exported from `packages/core`'s public API and is reachable without
going through `ingest`.

### Alternatives considered

1. **Repair instead of reject** — coerce `"5"` → `5`, clamp negatives, round fractionals. *Lost:* it
   silently rewrites the evidence a research artifact rests on, and it cannot repair ambiguous cases
   (`"abc"`) without inventing data. Contradicts Requirement 1's atomic all-or-nothing posture.
2. **A JSON Schema validator (ajv or similar)** — declarative, less hand-written code. *Lost:* adds a
   runtime dependency to an engine that deliberately uses only Node built-ins plus `graphology`; error
   messages become generic schema paths rather than "which node, which field"; and the schema would
   duplicate the TypeScript types with no mechanism keeping them in sync.
3. **Validate in `packages/shared` as a `validateRawGraph` helper used by *both* the parser's serializer
   and the core's ingest.** Genuinely attractive — it would catch Gap 5's duplicate ids at the point of
   *production* and give every future language front-end one conformance check. *Lost, narrowly:*
   `packages/shared` has deliberately held types only, and making it carry runtime logic is a change to
   the seam's character that deserves its own decision rather than being smuggled in with a bug fix.
4. **Trust the TypeScript types and document that `graph.json` must be produced by the parser.**
   *Lost:* the sanctioned adaptive demo depends on a hand-authored fixture
   (`fixtures/mixed-quality-graph.json`), so untrusted input is not hypothetical — it is the
   demonstration path.

**Recommended: option (1)-as-rejection, i.e. the validation walk above.** It preserves determinism
(pure function of input, no ordering effects), keeps the contract shape untouched while enforcing
invariants the contract *already states*, is total over the input space with no heuristics, and reuses
the existing `Result`/error seam so review cost is low.

**Runner-up: the shared-package validator (option 3).** It lost only because it changes what
`packages/shared` *is*. It is the right long-term home — the recommendation is to implement the walk in
`ingestor.ts` now with no shared-package change, and revisit promoting it to `packages/shared` when the
second language front-end or the parser-side uniqueness gate (Gap 5) lands, at which point two callers
justify the move.

### Tests to add

In `ingestor.test.ts`:
- Example-based: one case per rejected shape — string / fractional / negative / `NaN` / `Infinity` /
  missing / `null` / boolean signal; empty-string and missing `id`; numeric `id`; unknown `kind`;
  missing and non-string `directoryPath`; non-string `packagePath`; `file` node carrying
  `definedInFile`; `null` element in `nodes[]` and in `edges[]`; non-finite/negative `strength`.
  Each asserts the error `code`, the named id/field, and that **no partial model** is returned.
- Property (new): *for any* well-formed graph, validation accepts it and the resulting model's node and
  edge sets equal the input's — i.e. the gate never rejects conforming input. This guards against an
  over-strict validator, which is the main risk of this fix.

In `canonical-and-ids.test.ts`:
- Property (new, and the reason this fix is High): *for any* graph including parallel edges with
  arbitrary signal values, `stableStringify` of the serialized `edges.json` is identical for the graph
  and for a permutation of its edge array. This is the direct regression test for the reproduced
  Requirement 7.2 violation, and it should be added to the spec as a property in its own right
  (the existing Property 25 covers order-independence but is generated only over well-typed graphs,
  which is precisely why the hole survived).

### Determinism impact

**Strictly improves it.** The validation walk is a pure function of the input with no ordering
dependence, and it runs before any model construction. The comparator change *removes* the one
reproduced source of input-order dependence in the core. For all conforming input — everything the
parser produces — output is byte-identical to today: the walk either passes silently or rejects, and the
comparator returns the same ordering it already did whenever all signals are numbers.

### Contract impact

`GraphNode` / `DependencyEdge` shapes are **unchanged**; the fix enforces invariants the contract's own
doc comments already assert ("Unique, non-empty", "Non-negative integer"). `GroupingError` gains two
members — an internal type, not part of the on-disk contract. No `index/*.json` file changes shape,
size, or field set. The specs need a new acceptance criterion under Requirement 1 (field validity) so
the behaviour is spec-backed rather than an unrecorded implementation choice.

### Viewer impact (Phase 3)

(a) No index file changes shape, size, or fields. (b) Node/edge counts and hierarchy depth are unchanged
for conforming input. (c) No id-format change. (d) Cross-group aggregation and label/colouring metadata
untouched. (e) No blocker; if anything it *helps* the viewer, because a malformed graph now fails at
`group` time with a precise message instead of producing an index whose numbers are quietly wrong.
**Classification: none.**

### Engine / ecosystem placement

Engine (`packages/core`). The gate belongs at the ingest seam because that is where untrusted disk input
enters the engine; the CLI stays a thin wrapper that only renders the error.

---

## Fix 2 — Gap 3: stop exceptions escaping the structured-`Result` model

**Severity** High · **Bundle** B (after Fix 1) + a parser half that can ship alone · **Depends on** Gap 13 for the core half · **Viewer impact** none

### Gap summary

Both packages promise errors-as-values, but reachable paths throw. A legal Linux filename containing a
backslash crashes the parser with a raw stack trace — `assertRootRelativePosixPath` throws
(`packages/parser/src/ids.ts:50-69`), `extract` wraps its call in `try`/**`finally`** with no `catch`
(`ast-extractor.ts:449-471`), and `parse-cli.ts:80` is `void main()` with no `.catch`. On the core side,
a `null` element in an untrusted `graph.json` throws a `TypeError` out of `ingest`
(`ingestor.ts:26`). A grep confirms exactly six `throw` sites exist: `ids.ts:52,55,60,65,102` and
`canonical.ts:100`.

### Files / functions to change

| File | Change |
|---|---|
| `packages/parser/src/source-collector.ts` | Reject non-POSIX-representable relative paths at discovery, as a structured error |
| `packages/parser/src/errors.ts` | Add `path-unsupported` reason (and `internal-error`) |
| `packages/parser/src/orchestrator.ts` | Boundary `try`/`catch` around the pipeline → `internal-error` |
| `packages/parser/src/parse-cli.ts` | `main().catch(...)` rendering the structured block and exiting 1 |
| `packages/core/src/orchestrator.ts` | Boundary `try`/`catch` in `groupGraph` / `groupGraphToIndex` / `readGraphFile` → `INTERNAL_ERROR` |
| `packages/core/src/errors.ts` | Add `INTERNAL_ERROR` |
| `packages/core/src/index-parser.ts` | Guard array elements (`typeof entry !== "object" || entry === null`) before field access |
| `packages/core/src/community.ts` | Assert `detect` preconditions and return a degenerate assignment rather than letting graphology throw |

### Recommended solution

Fix the *cause* where the input space is knowable, and add a *backstop* so no future invariant violation
can escape.

**Cause — make the collector the only place that decides path representability.** The guards in `ids.ts`
are correct about what a node id may contain; they are simply in the wrong position to *report*. Move
the decision to discovery, where a file path is still a first-class thing with an error channel:

```ts
// source-collector.ts, inside the entry loop
if (entry.isFile() && entry.name.endsWith(".java")) {
  const relativePath = toPosixRelative(rootAbsolute, entryAbsolute);
  if (!isRepresentablePosixRelative(relativePath)) {
    // Recoverable, named, and continues — parity with file-unreadable (R10.2).
    errors.add(makeError(
      "path-unsupported",
      `Java source file path cannot be represented as a portable node identifier: ${relativePath}`,
      relativePath,
    ));
    continue;
  }
  files.push({ absolutePath: entryAbsolute, relativePath });
}
```

`isRepresentablePosixRelative` holds the same three predicates `assertRootRelativePosixPath` checks
(non-empty, no backslash, no leading `/`, no `<letter>:` prefix). The `ids.ts` guards then stay exactly
as they are — they become genuinely unreachable internal assertions, which is what they were written to
be.

**Backstop — one boundary per public entry point:**

```ts
// core/orchestrator.ts
export function groupGraph(input, partialConfig?, detector = new LouvainCommunityDetector()): Result<GroupingOutput> {
  try {
    return groupGraphUnguarded(input, partialConfig, detector);
  } catch (cause) {
    return err({ code: "INTERNAL_ERROR", detail: cause instanceof Error ? cause.message : String(cause) });
  }
}
```

Same shape in `parseProject`, and `parse-cli.ts` becomes
`main().catch((e) => { console.error(...); process.exitCode = 1; })`.

### Alternatives considered

1. **Only add boundary `try`/`catch`, leave the throws.** *Lost:* it converts a crash into a generic
   `INTERNAL_ERROR` with no path and no per-file recovery — the run still produces nothing, so a single
   oddly-named file still costs the whole repository. It also violates R10.1/R10.2's promise that
   per-file problems are *recoverable*.
2. **Sanitize the path instead of rejecting it** — percent-encode `\` and `:` so any filename becomes
   representable. *Lost:* it silently changes identity for affected files and introduces an encoding
   that must then be decoded for display, for a case rare enough not to justify the permanent
   complexity. Worth revisiting only if real repositories turn out to hit it.
3. **Widen what an id may contain** — allow backslashes, drop the drive-letter guard. *Lost:* the guards
   exist to keep host-specific path material out of ids (R9.4), which is a determinism and portability
   property; loosening them trades a rare crash for a cross-platform correctness hazard.
4. **Convert the `ids.ts` guards to return `Result`.** *Lost:* it pushes `Result` plumbing through
   `buildFileId`/`buildClassId`/`buildFunctionId` and every call site inside the extractor's hot
   recursion, for zero behavioural gain over deciding once at discovery.

**Recommended: cause-plus-backstop as sketched.** It preserves determinism trivially (a pure path
predicate evaluated in canonical order), needs no contract change, is total over the filename space with
one predicate rather than per-call-site handling, is cheap to review, and generalizes: the same
representability check is what a future language front-end will need.

**Runner-up: option 1 (backstop only).** It lost because it degrades a *recoverable per-file* condition
into a *fatal whole-run* one, which is a worse outcome than the bug for any repository with one odd
filename — even though it is a third of the work.

### Tests to add

- `source-collector.test.ts`: injected `readdir` stubs yielding names with a backslash, a leading
  `<letter>:`, an empty name; assert `path-unsupported` is recorded, is *recoverable* (other files still
  collected), and names the path.
- `orchestrator.test.ts` (parser): with a stub extractor that throws, assert `parseProject` returns
  `internal-error` rather than rejecting, and that **nothing was written**.
- `ingestor.test.ts` / `orchestrator.test.ts` (core): `null` element input returns a structured error
  (this becomes Fix 1's territory once shipped, so assert the *code*, not the mechanism); a detector stub
  that throws yields `INTERNAL_ERROR` with no partial output.
- `index-files.test.ts`: `null` element inside each validated array of each of the five files →
  `MALFORMED_FILE` naming the file, never a throw.
- Property (new, both packages): *for any* generated input — including adversarially malformed input —
  the public entry points **return** a `Result` and never throw. This is a genuinely new correctness
  property ("no exception escapes a public entry point") and should be added to both specs; it is
  cheaply expressed as a `fast-check` property wrapping the call in `assert.doesNotThrow`.

### Determinism impact

None on output bytes. Path rejection is a pure predicate applied during a canonically-ordered walk, so
the set of collected files — and therefore the graph — is a deterministic function of the directory
contents. The boundary `catch` only changes behaviour on paths that previously produced *no* output at
all.

### Contract impact

None. No node/edge shape change, no id-format change, no `index/*.json` change. Both error unions gain
members (internal types). The specs should record the new error reasons and the no-throw property.

### Viewer impact (Phase 3)

(a)–(d) all unchanged. (e) No blocker. **Classification: none.** Indirect benefit: a repository that
currently cannot be parsed at all becomes parseable (minus the one unrepresentable file, which is
reported), so the viewer sees a graph where it previously saw nothing.

### Engine / ecosystem placement

Engine for the collector/orchestrator/ingest changes; the `parse-cli` `.catch` is ecosystem (a demo
wrapper) but is required for the engine's guarantee to be *visible*.

---

## Fix 3 — Gap 9: validate the algorithm configuration before any work

**Severity** High · **Bundle** B · **Depends on** nothing · **Blocks** Gap 20 (CLI flags), Gap 18 (demo baselines) · **Viewer impact** none

### Gap summary

`INVALID_CONFIG` validation exists only for the two hierarchy bounds, inside `buildHierarchy` — the
fifth pipeline stage (`packages/core/src/hierarchy-builder.ts:42-60`). `resolveConfig` deep-merges
everything else with no checks (`orchestrator.ts:65-78`), so `structuralQualityBoundary: NaN` is
accepted: `score >= NaN` is always false, **every** region silently reconstructs,
`decisionConfidence` becomes `NaN`, and `stableStringify` writes both the boundary and every confidence
as `null` — producing an `index/` that the engine's own `parseIndex` then rejects (all reproduced).

### Files / functions to change

| File | Change |
|---|---|
| `packages/core/src/orchestrator.ts` | New `validateConfig(resolved)`, called at the top of `groupGraph`; move hierarchy validation into it |
| `packages/core/src/hierarchy-builder.ts` | Keep `validateHierarchyConfig` as the reusable predicate; `buildHierarchy` keeps calling it defensively |
| `packages/core/src/errors.ts` | `INVALID_CONFIG` gains the offending field name and value |
| `packages/core/src/canonical.ts` | `stableStringify` refuses non-finite numbers instead of emitting `null` |
| `packages/core/src/metadata.ts` | Assert finiteness of recorded numbers |
| `packages/core/src/demo-baselines.ts` | Switch the always-reconstruct baseline off the out-of-range boundary (see the domain decision) |

### Recommended solution

One gate, run before ingest, over the *resolved* config:

```ts
// orchestrator.ts
function finitePositive(v: number): boolean { return Number.isFinite(v) && v > 0; }
function finiteNonNeg(v: number): boolean { return Number.isFinite(v) && v >= 0; }

export function validateConfig(c: GroupingConfig): Result<GroupingConfig> {
  const bad = (field: string, value: unknown, detail: string): Result<GroupingConfig> =>
    err({ code: "INVALID_CONFIG", field, detail: `${field}: ${detail} (got ${JSON.stringify(value)})` });

  if (!Number.isFinite(c.structuralQualityBoundary)) {
    return bad("structuralQualityBoundary", c.structuralQualityBoundary, "must be a finite number");
  }
  if (!Number.isSafeInteger(c.communityDetectionSeed)) {
    return bad("communityDetectionSeed", c.communityDetectionSeed, "must be a safe integer");
  }
  for (const [k, v] of Object.entries(c.weightCoefficients)) {
    if (!finiteNonNeg(v)) return bad(`weightCoefficients.${k}`, v, "must be finite and >= 0");
  }
  const w = c.assessment.weights;
  for (const [k, v] of Object.entries(w)) {
    if (v !== undefined && !finiteNonNeg(v)) return bad(`assessment.weights.${k}`, v, "must be finite and >= 0");
  }
  const activeSum = w.cohesion + w.coupling + (c.assessment.computeModularity ? (w.modularity ?? 0) : 0);
  if (!(activeSum > 0)) {
    return bad("assessment.weights", w, "at least one active metric weight must be > 0");
  }
  if (!finitePositive(c.assessment.cohesionSquashConstant)) {
    return bad("assessment.cohesionSquashConstant", c.assessment.cohesionSquashConstant, "must be finite and > 0");
  }
  if (!Number.isFinite(c.assessment.degenerateScore) ||
      c.assessment.degenerateScore < 0 || c.assessment.degenerateScore > 1) {
    return bad("assessment.degenerateScore", c.assessment.degenerateScore, "must be finite and within [0, 1]");
  }
  return validateHierarchyConfig(c.hierarchy) as Result<GroupingConfig>;
}
```

Deliberately **not** bounded to `[0, 1]`: only *finiteness* is required of the boundary. That resolves
the demo tension honestly (see below) while still rejecting the reproduced defect, since `NaN` is the
value that actually breaks the comparison and the metadata.

Second half — make a non-finite number unrepresentable in output, so this class of defect cannot recur
through any other path:

```ts
// canonical.ts — render()
if (typeof value === "number") {
  if (!Number.isFinite(value)) {
    throw new TypeError(`stableStringify: refusing to serialize non-finite number ${String(value)}`);
  }
  return JSON.stringify(value);
}
```

That throw is an internal invariant, reachable only if a stage forgot to validate — and Fix 2's boundary
`catch` converts it into `INTERNAL_ERROR` rather than a crash, which is the correct escalation.

### The boundary-domain decision (the fix's one real judgement call)

`demo-baselines.ts:47` uses boundary `1.000001` to express "always reconstruct", so a naive `[0, 1]`
check would break a Review-2 demo. Three options:

| Option | Verdict |
|---|---|
| Require `[0, 1]` and switch the demo to an all-`reconstruct` **override map** | **Recommended.** The grouping design already names the override map as the sanctioned way to express both baselines (design.md:628), so this removes the *only* reason the boundary needed an extended domain and makes the baselines self-documenting. |
| Require only finiteness (any finite value legal) | Acceptable fallback, and what the sketch above encodes. Simpler, keeps the demo working untouched, but leaves "boundary 5.0" silently meaningful and lets `decisionConfidence` be recorded as e.g. 4.7. |
| Require `[0, 1]` with a documented epsilon margin | Rejected — a magic tolerance to accommodate one demo line is exactly the kind of unexplainable constant the project's honesty rules push against. |

Ship **finiteness-only now** (unblocks nothing else, zero demo churn) and **tighten to `[0, 1]` together
with Gap 18's demo-script fix**, which is where the override-map switch belongs.

### Alternatives considered

1. **Validate inside each consumer** (`assess` checks its own weights, `construct` its own boundary).
   *Lost:* errors then surface mid-pipeline after Louvain has run, and each component needs its own
   `Result` plumbing — more code, later failure, same outcome.
2. **Clamp invalid values to the nearest legal one.** *Lost:* it is precisely today's failure mode
   generalized — a silent wrong answer where the recorded audit trail no longer explains the decisions.
3. **Validate only the boundary** (the one reproduced defect). *Lost:* the audit found the same missing
   gate behind negative coefficients (every strength clamps to 0 → everything preserved at confidence
   0), `k <= 0` (non-monotonic scores), and `degenerateScore: 7` (degenerate regions preserve at any
   boundary). One gate closes all of them for barely more code.
4. **Type-level prevention** (branded types like `UnitInterval`). *Lost:* the values arrive from JSON
   and CLI strings at runtime, so a runtime gate is required regardless; branding adds ceremony without
   removing the check.

**Recommended: the single pre-ingest `validateConfig` gate plus the non-finite serialization guard.**
Determinism-neutral, contract-neutral, total over the configuration space with no heuristics, cheap, and
it is the natural place for Gap 20's CLI flags to validate through.

### Tests to add

- `orchestrator.test.ts`: one case per rejected field — boundary `NaN`/`±Infinity`; seed non-integer /
  `NaN` / unsafe; negative and `NaN` weight coefficients; `Infinity` coefficient; all-zero and negative
  metric weights; `k = 0`, `k < 0`, `k = NaN`; `degenerateScore` outside `[0,1]` and `NaN`; hierarchy
  bounds (moved, so assert they now fail **before** ingest — e.g. via a detector spy that must never be
  called).
- Regression, example-based: the reproduced end-to-end case — `groupGraphToIndex` with boundary `NaN`
  must now return `INVALID_CONFIG` and write **nothing**, replacing today's behaviour of writing an
  index that `parseIndex` rejects.
- Property (new): *for any* valid config and graph, `metadata.json` round-trips through
  `serializeIndex` → `parseIndex` successfully. This strengthens the existing Property 30 from
  "for any Hierarchy" to include the metadata numerics, which is the invariant that actually broke.
- `canonical-and-ids.test.ts`: `stableStringify` throws on `NaN`/`Infinity` at any nesting depth.

### Determinism impact

None on valid runs: validation is a pure predicate over the resolved config and rejects before any
computation, so accepted configurations produce byte-identical output to today. It *removes* a source of
non-reproducible output (a recorded `null` boundary from which the decisions cannot be replayed, which
is Requirement 5.7's whole point).

### Contract impact

No `GraphNode`/`DependencyEdge` change. `index/*.json` shapes unchanged — but `metadata.json` can no
longer contain `null` where a number is specified, which is a *correction* toward the documented shape.
`INVALID_CONFIG` gains a `field` member (internal type). Requirement 3/4/5 should gain explicit domains
for each configurable parameter; today the specs name the parameters without bounding them, which is the
root cause.

### Viewer impact (Phase 3)

(a) `metadata.json` keeps its field set; the only change is that its numbers are guaranteed finite —
which the viewer needs, since it will read `structuralQualityBoundary` and `decisionConfidence` to
visualize the adaptive decision. (b) No count or depth change. (c) No id change. (d) No aggregation
change. (e) No blocker; it *removes* one — a viewer parsing `"decisionConfidence": null` would have had
to special-case it. **Classification: none.**

### Engine / ecosystem placement

Engine (`packages/core`). The demo-script adjustment is ecosystem.

---

## Fix 4 — Gap 10: make the five-file index write atomic

**Severity** High · **Bundle** C (first) · **Depends on** nothing · **Pairs with** Gap 11 (read-side assertions) · **Viewer impact** none

### Gap summary

`serializeIndex` writes the five index files sequentially with `writeFileSync` and returns on the first
failure (`packages/core/src/index-serializer.ts:86-92`), with no staging and no directory cleaning. A
failed re-index therefore leaves files 1..N−1 from the new run and N..5 from the previous one — and
because `parseIndex` never cross-checks `metadata.nodeCount` / `edgeCount` / `hierarchyDepth` against the
parsed hierarchy, the mixture **parses successfully** (reproduced: `repository.json` reporting 40
nodes/depth 5 beside a stale `metadata.json` reporting 38/depth 4, accepted by `parseIndex`).

### Files / functions to change

| File | Change |
|---|---|
| `packages/core/src/index-serializer.ts` | `serializeIndex` stages to a temp directory, then promotes atomically |
| `packages/core/src/index-parser.ts` | Cross-check the redundant counts (shared with Fix 5) |
| `packages/core/src/index-files.test.ts` | Tests below |
| `.kiro/specs/hierarchical-repository-grouping/requirements.md` | Req 9.8 gains a no-partial-output clause; add the property |

### Recommended solution

Mirror the parser's proven pattern (`packages/parser/src/serializer.ts:232-281`), lifted from one file
to a set. Serialize everything in memory, write into a sibling temp directory, then promote with a
directory swap:

```ts
export function serializeIndex(hierarchy: Hierarchy, metadata: Metadata, dir: string): Result<void> {
  // 1. Render every payload BEFORE touching the filesystem: a serialization
  //    failure (e.g. Fix 3's non-finite guard) then writes nothing at all.
  let rendered: Array<[IndexFileName, string]>;
  try {
    const payloads = indexFilePayloads(hierarchy, metadata);
    rendered = INDEX_FILE_NAMES.map((n) => [n, stableStringify(payloads[n])]);
  } catch (cause) {
    return err({ code: "WRITE_FAILED", file: dir, detail: `serialization failed: ${String(cause)}` });
  }

  // 2. Stage into a temp sibling. The name is content-derived (no timestamp, no
  //    counter, no randomness) so determinism and R9-style purity are preserved.
  const stamp = createHash("sha1").update(rendered.map(([, t]) => t).join("\u0000")).digest("hex").slice(0, 16);
  const staging = `${dir}.staging-${stamp}`;
  try {
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    for (const [name, text] of rendered) writeFileSync(join(staging, name), text, "utf8");
  } catch (cause) {
    rmSync(staging, { recursive: true, force: true });
    return err({ code: "WRITE_FAILED", file: staging, detail: String(cause) });
  }

  // 3. Promote. Rename the five staged files over the target only after ALL of
  //    them exist: same-directory-tree renames, so each is atomic and the window
  //    in which the set is mixed is bounded by five metadata operations.
  try {
    mkdirSync(dir, { recursive: true });
    for (const [name] of rendered) renameSync(join(staging, name), join(dir, name));
    rmSync(staging, { recursive: true, force: true });
    return ok(undefined);
  } catch (cause) {
    rmSync(staging, { recursive: true, force: true });
    return err({ code: "WRITE_FAILED", file: dir, detail: `promotion failed: ${String(cause)}` });
  }
}
```

The key property: **every condition that can realistically fail — permissions, ENOSPC, a read-only
member file, serialization — fails during staging, before the target has been touched at all.** The
promotion loop performs only renames within one filesystem, which do not fail for space or content
reasons; a read-only *existing* target is the one residual case, and it is detectable up front.

To close even that, probe writability of each existing target before promoting (an `access(W_OK)` check
per member file), turning the residual case into a staged-phase failure too.

### Alternatives considered

1. **Swap the whole directory** — `rename(dir, dir.old)`, `rename(staging, dir)`, `rm dir.old`. Truly
   atomic for the set. *Lost:* there is a window with **no** `index/` at all, and it destroys any
   foreign files the user kept in that directory; it also fails if `dir` is a mount point or if a
   process holds it open. Per-file promotion after all-staged-writes-succeed gives nearly the same
   guarantee without those failure modes.
2. **Write a single `index.json` instead of five files.** Genuinely atomic, one `rename`, and it would
   make this class of bug impossible. *Lost:* Requirement 9.1 mandates "exactly five files"
   (repository/hierarchy/nodes/edges/metadata), and the split exists so the viewer can lazily fetch only
   what a zoom level needs — a real Phase-3 benefit. Changing it is a spec and viewer-architecture
   decision, not a bug fix.
3. **Keep sequential writes; add a manifest/checksum file** the parser verifies. *Lost:* it detects the
   corruption after the fact instead of preventing it, adds a sixth file (contradicting Req 9.1), and
   still leaves a broken index on disk.
4. **Order the writes so `metadata.json` goes first**, making the most-likely mixture less harmful.
   *Lost:* it only reshuffles which inconsistency you get; nothing is actually guaranteed.
5. **Do nothing in the serializer; rely on Fix 5's read-side count assertions to detect it.** *Lost:*
   detection is not durability — the user is still left with a broken index and a failed run, and
   Req 9.5's round-trip promise stays violable.

**Recommended: stage-then-promote (the sketch above), paired with Fix 5's read-side assertions.** It
preserves determinism (content-derived staging name, no time/counter/randomness; the promoted bytes are
identical to today's), needs no contract change, covers every realistic failure with one mechanism
rather than per-file special cases, is a direct port of a pattern already reviewed and tested in this
repository, and generalizes to a future Neo4j or remote-storage backend where "stage then commit" is the
native idiom.

**Runner-up: the single-file index (option 2).** It lost on contract stability alone — it would be the
better design if the five-file split were still open, and it is worth noting in the Phase-3 viewer spec
that the split is now load-bearing.

### Tests to add

- `index-files.test.ts`, example-based with an injected filesystem (the module currently uses `node:fs`
  directly, so this fix should also **inject `SerializerDeps`** the way the parser's serializer does —
  that is a prerequisite refactor and the reason today's write path is nearly untestable):
  - failure on staging file 1 / 3 / 5 → `WRITE_FAILED`, **no** target files created or modified;
  - failure with a pre-existing index → all five previous files byte-for-byte unchanged (hash them
    before and after);
  - failure during promotion → previous index unchanged, no staging directory left behind;
  - success → exactly five files, no staging directory, byte-identical to today's output;
  - success over an existing index → all five replaced consistently.
- Regression (example-based, from the reproduction): read-only `metadata.json` + a changed
  `maxGroupSize` must now leave the *entire* previous index intact and return `WRITE_FAILED`.
- Property (new): *for any* hierarchy and any single injected write failure at position `k ∈ [1..5]`,
  the target directory's content equals its pre-run content. This is a new correctness property
  ("index writes are all-or-nothing") and belongs in the spec alongside Property 29.

### Determinism impact

Output bytes are unchanged — the same `stableStringify` payloads are written, only via a staging path.
The staging directory name is a SHA-1 of the rendered content, so it contains no timestamp, counter, or
random value, and two runs over identical input stage to the identical path (making a stale staging
directory from a previous failed run safely reusable/removable). Determinism digests over `index/` are
unaffected.

### Contract impact

None. The five file names, shapes, and field sets are untouched; `WRITE_FAILED` gains an optional
`detail`. Requirement 9.8 should be strengthened to state the no-partial-output guarantee explicitly —
right now it only requires naming the file, which is why the implementation stopped short.

### Viewer impact (Phase 3)

(a) No shape/size/field change. (b) No count or depth change. (c) No id change. (d) No aggregation
change. (e) No blocker — and a meaningful *reliability* gain: the viewer can trust that an `index/`
directory it finds on disk is internally consistent, so it does not need defensive cross-checking of
`metadata` against `hierarchy` before rendering. **Classification: none.**

### Engine / ecosystem placement

Engine (`packages/core`).

---

## Fix 5 — Gap 11: validate the containment tree on read, and make the ancestor climb cycle-safe

**Severity** High · **Bundle** C (after Fix 4) · **Depends on** nothing · **Viewer impact** none

### Gap summary

`parseIndex`'s referential-integrity checks are *pairwise* — each `parentId` exists, each child points
back at its listing parent (`packages/core/src/index-parser.ts:70-95`) — and a containment cycle
satisfies both, so a mutually-parented pair parses as a valid `Hierarchy`. `analyzeBlastRadius`'s
containing-groups walk then climbs `parentId` with **no** visited set (`blast-radius.ts:58-67`) and never
terminates (reproduced: `parseIndex` returned ok, `analyzeBlastRadius` was killed by an 8-second
timeout). Requirement 10.7 explicitly promises termination on cyclic input.

### Files / functions to change

| File | Change |
|---|---|
| `packages/core/src/index-parser.ts` | One BFS-from-root validation replacing/augmenting the pairwise walk; validate `kind`; tighten value ranges |
| `packages/core/src/blast-radius.ts` | Visited set on the ancestor climb |
| `packages/core/src/index-files.test.ts`, `blast-radius.test.ts` | Tests below |
| `.kiro/specs/hierarchical-repository-grouping/design.md` | Note that Property 19's tree invariants are checked on *parse*, not only on build |

### Recommended solution

**Read side — one traversal establishes every global tree property at once.** Cycle-freedom,
single-rootedness, reachability, and level monotonicity all fall out of a single BFS, so this is one
cheap pass rather than four checks:

```ts
// index-parser.ts, after the node map is built and pairwise links verified
const roots = [...nodes.values()].filter((n) => n.parentId === null);
if (roots.length !== 1 || roots[0]!.id !== hierarchyDoc.repositoryId) {
  return err({ code: "MALFORMED_FILE", file: "hierarchy.json",
    detail: `expected exactly one root equal to repositoryId, found ${roots.length}` });
}

const seen = new Set<NodeId>([hierarchyDoc.repositoryId]);
const queue: NodeId[] = [hierarchyDoc.repositoryId];
while (queue.length > 0) {
  const node = nodes.get(queue.shift()!)!;
  const childIds = node.childIds;
  for (let i = 0; i < childIds.length; i++) {
    const childId = childIds[i]!;
    if (i > 0 && compareIds(childIds[i - 1]!, childId) >= 0) {
      // Req 7.5 canonical child ordering is a checkable invariant, and this also
      // rejects duplicate ids inside one childIds array.
      return err({ code: "MALFORMED_FILE", file: "hierarchy.json",
        detail: `children of ${node.id} are not strictly ascending at ${childId}` });
    }
    if (seen.has(childId)) {
      return err({ code: "MALFORMED_FILE", file: "hierarchy.json",
        detail: `containment cycle or shared child at ${childId}` });
    }
    const child = nodes.get(childId)!;   // existence already verified pairwise
    if (child.level !== node.level + 1) {
      return err({ code: "MALFORMED_FILE", file: "hierarchy.json",
        detail: `child ${childId} has level ${child.level}, expected ${node.level + 1}` });
    }
    seen.add(childId);
    queue.push(childId);
  }
}
if (seen.size !== nodes.size) {
  return err({ code: "MALFORMED_FILE", file: "hierarchy.json",
    detail: `${nodes.size - seen.size} node(s) are unreachable from the repository root` });
}
```

Because a tree is exactly "every node reached once from a single root", `seen.has(childId)` catches
cycles *and* shared children (a DAG that is not a tree), and the final size comparison catches
disconnected components — including a cycle that is not reachable from the root, which the BFS alone
would miss.

Alongside it, validate `kind` against the enum (currently only checked to be a string,
`index-parser.ts:48`, `:61`) and require `Number.isInteger` for `hierarchyDepth` and `level`, and
non-negative integers for the `perLevel` counts.

**Analyzer side — defence in depth**, because `analyzeBlastRadius` is exported and cannot assume its
`Hierarchy` came from `buildHierarchy`:

```ts
for (const impacted of visited) {
  const climbed = new Set<NodeId>([impacted]);
  let node = hierarchy.nodes.get(impacted);
  while (node && node.parentId !== null) {
    if (climbed.has(node.parentId)) break;   // cyclic containment: stop, do not hang
    climbed.add(node.parentId);
    const parent = hierarchy.nodes.get(node.parentId);
    if (parent?.kind === "group") groupNodes.add(parent.id);
    node = parent;
  }
}
```

`break` rather than an error is the right call here: the analyzer's contract (Req 10.3/10.4) enumerates
only "not found" and "empty id" failures, so inventing a new error code for malformed containment would
exceed the spec — whereas *terminating* is exactly what Req 10.7 demands.

### Alternatives considered

1. **Harden only the analyzer** (visited set), leave `parseIndex` permissive. *Lost:* the malformed
   index still loads and every *other* consumer — `buildMetadata`'s branching factor, the Phase-3
   viewer's tree walk, a future MCP server — inherits the hazard. It fixes one symptom of a validation
   gap.
2. **Harden only the parser**, leave the analyzer trusting. *Lost:* `analyzeBlastRadius` is public API
   over a plain `Hierarchy` value; a caller constructing one by hand (or a future incremental path that
   patches a hierarchy in memory) reintroduces the hang.
3. **Full re-validation on parse** — re-derive the entire hierarchy from `nodes.json` + `edges.json` and
   compare against `hierarchy.json`. Maximum strictness. *Lost:* it effectively re-runs the builder on
   read, duplicating its logic in a second place that will drift, for a guarantee the BFS already gives
   at a fraction of the cost.
4. **Depth-limit the climb** (bail after `hierarchyDepth + 1` steps). *Lost:* a cheap trick that depends
   on a value the same malformed file supplies, and it silently truncates legitimate deep hierarchies if
   `hierarchyDepth` is wrong.

**Recommended: validate on read (BFS) *and* guard the climb.** Determinism-neutral, contract-neutral,
total over the malformed-tree space via one traversal rather than a checklist of special cases, modest
cost, and it makes the `index/` seam genuinely safe for every future consumer — which is the point of
having a seam.

### Tests to add

- `index-files.test.ts`, example-based — each tampered index must yield `MALFORMED_FILE` naming
  `hierarchy.json`, with **no** partial hierarchy returned: self-parent node; two-node mutual parent
  cycle (the reproduced case); a longer cycle; a cycle unreachable from the root; a second `parentId:
  null` node (forest); `repositoryId` naming an absent node; a node listed as a child by two parents;
  duplicate ids inside one `childIds`; unsorted `childIds`; a child whose `level` is not
  `parent.level + 1`; an unreachable component; `kind: "banana"`; fractional or negative
  `hierarchyDepth`/`level`.
- `blast-radius.test.ts` — with a hand-constructed cyclic `Hierarchy` (bypassing `parseIndex`),
  `analyzeBlastRadius` **returns** rather than hanging; assert the result is deterministic across two
  calls. Guard against a regression that reintroduces the hang by asserting completion, not by relying on
  the runner's timeout.
- Property (new): *for any* index file set produced by `serializeIndex`, `parseIndex` accepts it. This is
  the essential companion to the strictness above — the risk of tightening validation is rejecting the
  engine's own valid output, and this property is what makes that impossible to ship.
- Property (existing, extended): Property 33 (blast-radius termination) currently generates hierarchies
  from `buildHierarchy`; extend its arbitrary to include *containment*-cyclic hierarchies, not only
  dependency-edge cycles. The spec's wording ("whose dependency edges contain cycles") is what let the
  containment case slip through and should be broadened.

### Determinism impact

None. Validation is a pure function of the parsed files; the BFS visits nodes in `childIds` order, which
the same pass proves is canonically sorted. The analyzer's added visited set changes results only for
inputs that previously produced no result at all. Valid indexes parse and analyze byte-identically.

### Contract impact

No change to any file's shape or field set. `parseIndex` becomes stricter — it rejects inputs it
previously accepted — which is a behaviour change for *malformed* input only. Every index the engine
itself writes continues to parse (enforced by the new round-trip property). The design should record
that Property 19's invariants are verified on parse as well as on build.

### Viewer impact (Phase 3)

(a)–(d) unchanged. (e) No blocker; a direct benefit — the viewer can walk `parentId`/`childIds` without
its own cycle guard, and a corrupt index fails loudly at load rather than hanging the browser tab (the
same unbounded climb in JavaScript would freeze the UI thread). **Classification: none.**

### Engine / ecosystem placement

Engine (`packages/core`).

---

## Fix 6 — Gap 12: give `Group_Node`s a label and Region provenance (the Phase-3 unblock)

**Severity** High (blocks Review 3) · **Bundle** D · **Depends on** nothing; **should follow Bundle A** · **Viewer impact potential-blocker — this fix is the mitigation**

### Gap summary

Every non-leaf node is emitted as `{id, kind, level}` only (`packages/core/src/index-serializer.ts:47-57`,
`:36-45`), and nothing in the five files maps a `Group_Node` back to the Region it was built from —
`buildHierarchy`'s `level2IdsOfRegion` association is local and discarded
(`hierarchy-builder.ts:96-107`). Verified on the real fixture: group entries are
`{"id":"g_3189baf1dcbe7ef75bc07309f67d7e58e23f2dbc","kind":"group","level":2}`, and a search for any
field linking a group id to a `regionId` returns **nothing**. At Levels 1 and 2 *every* node is a group,
so a semantic-zoom viewer can only draw 40-hex hashes.

### Files / functions to change

| File | Change |
|---|---|
| `packages/core/src/types.ts` | `HierarchyNode` gains optional `regionId`; `RegionDecision` gains `groupIds` |
| `packages/core/src/hierarchy-builder.ts` | Thread the region association onto the group nodes it already computes |
| `packages/core/src/index-serializer.ts` | Emit `regionId` (+ the display fields decided below) in `nodes.json`; emit `groupIds` in the decisions |
| `packages/core/src/index-parser.ts` | Accept and round-trip the new optional fields |
| `packages/core/src/metadata.ts` | Join decisions to their group ids |
| `.kiro/specs/hierarchical-repository-grouping/requirements.md` | New acceptance criteria under Req 9 (group provenance is part of the emitted index) |

### Recommended solution

**Emit provenance in the engine; compose the human string in the viewer** — with the one exception that
the viewer provably cannot derive.

`buildHierarchy` already knows each Level-2 group's region (it iterates
`construction.regionGroups` by `regionId`) and each Level-1 group's region. Carry that onto the node and
emit it:

```ts
// hierarchy-builder.ts — addGroupNode gains the provenance it already has in scope
function addGroupNode(
  nodes: Map<NodeId, HierarchyNode>, id: NodeId, childIds: readonly NodeId[],
  provenance?: { regionId: RegionId; ordinal: number },
): void {
  nodes.set(id, {
    id, kind: "group", level: -1, parentId: null,
    childIds: sortIds(childIds),
    ...(provenance !== undefined ? { regionId: provenance.regionId, ordinal: provenance.ordinal } : {}),
  });
}

// Level-2 loop: ordinal is the group's index within its region's canonical group list,
// so it is a pure function of already-deterministic data — no counter across the run.
for (const [regionId, groups] of construction.regionGroups) {
  let ordinal = 0;
  for (const group of groups) {
    for (const slice of partitionChildren(group.fileIds, maxGroupSize, minPartitionThreshold)) {
      const id = groupIdOf(slice);
      addGroupNode(nodes, id, slice, { regionId, ordinal: ordinal++ });
      level2Ids.push(id);
    }
  }
}
```

`nodes.json` then carries, per group: `regionId` (`"pkg:com.example.service"`) and `ordinal`. The
Repository-wrapping intermediate levels (`hierarchy-builder.ts:121-129`) correspond to no region and
simply omit both — the viewer must handle that, which is why it is called out in the tests.

The **ordinal is the piece the viewer cannot derive**: when a region is reconstructed into three
communities, or split by `maxGroupSize` into slices, the resulting sibling groups share a `regionId` and
differ only by content hash. Without an emitted ordinal the viewer has no stable, meaningful way to
distinguish "`com.example.service` group 1" from "group 2". With `regionId` + `ordinal`, label
composition in the viewer is trivial and needs no engine-side presentation logic:

```
regionId "pkg:com.example.service", ordinal 0, one group in region  → "com.example.service"
regionId "pkg:com.example.service", ordinal 1, three groups         → "com.example.service (2 of 3)"
no regionId (repository wrapper)                                     → "Level 2 · 14 groups"
```

Finally, join the audit record to the tree in both directions by adding `groupIds` to each
`RegionDecision`, so the viewer can go from "this region was *reconstructed* with score 0.31 and
confidence 0.19" to the boxes on screen, which is what makes the adaptive contribution *visible* rather
than merely recorded.

### Alternatives considered

1. **Emit a fully-composed `label` string from the engine.** Simplest for the viewer. *Lost:* it puts
   presentation policy (truncation, "2 of 3" phrasing, localization) inside the engine, on the wrong side
   of the architecture's engine/ecosystem line, and freezes wording into a persisted artifact. It also
   invites the label to drift from the identity it describes.
2. **Emit nothing; have the viewer reconstruct provenance** by intersecting a group's transitive leaf set
   with each region's file list. *Lost:* it is O(groups × files) work in the browser on every load, it
   reimplements region assignment in a second language, and it **cannot** recover the ordinal or
   distinguish sibling communities — the exact case that needs a label most.
3. **Make the group id human-readable** (`g_com.example.service_0` instead of a hash). Tempting: labels
   for free. *Lost decisively on determinism/contract grounds:* Requirement 7.3 mandates identifiers
   derived *solely* from group contents, and Requirement 7.4 uniqueness; a name-based id is neither
   content-addressed nor collision-free (two regions can produce equal name+ordinal after partitioning),
   and it would couple identity to display — the precise mistake Gap 2's fix direction warns against.
4. **Add a sixth `labels.json`.** *Lost:* Requirement 9.1 fixes the set at exactly five files.
5. **Put the mapping only in `metadata.json`** (`regionDecisions[].groupIds`) and not on the nodes.
   *Lost:* the viewer would need a reverse index built at load time for every node render, and
   `nodes.json` is the file it already reads per level — but note this fix does *both*, because the
   decision→groups direction is independently useful for the audit story.

**Recommended: emit `regionId` + `ordinal` on group nodes and `groupIds` on region decisions; compose
the display string in the viewer.** Determinism is preserved because both values are pure functions of
data that is already canonically ordered (no counters across the run, no time, no randomness); the
contract's `GraphNode`/`DependencyEdge` shapes are untouched and the additions are optional fields on
`nodes.json`/`metadata.json`; it covers preserved, reconstructed, partitioned, and
wrapper-level groups with one rule plus a documented omission; it is a small, local change; and it keeps
presentation in the ecosystem where a future VS Code extension or MCP server can render it differently.

**Runner-up: engine-composed `label` (option 1).** It lost only on the engine/ecosystem line — it is
strictly less work for the viewer, and if the project later decides labels belong in the index (e.g. so
an AI agent consuming `index/` gets names without reimplementing composition), it can be added *on top*
of `regionId` + `ordinal` without rework. That is the migration path if the Review-3 build finds
viewer-side composition awkward.

### Tests to add

- `hierarchy-builder.test.ts`: a preserved region's group carries its `regionId` and `ordinal 0`; a
  region reconstructed into three communities yields ordinals `0,1,2` in canonical community order; a
  size-partitioned region yields distinct ordinals per slice; Repository-wrapper groups omit `regionId`.
- `index-files.test.ts`: `regionId`/`ordinal`/`groupIds` survive the `serializeIndex` → `parseIndex`
  round trip; an index written *without* them (older output) still parses, since the fields are optional.
- Property (extended, Property 30): the round-trip must now also preserve group provenance — strengthen
  the existing round-trip property rather than adding a parallel one.
- Property (new): *for any* graph, every group node at Level 1 or Level 2 carries a `regionId` that
  appears in `metadata.regionDecisions`, and the `(regionId, ordinal)` pair is unique across the
  hierarchy. Uniqueness is the property that makes viewer labels unambiguous, so it is the one worth
  stating in the spec.
- Property (new): every `regionDecisions[].groupIds` entry names a node that exists in the hierarchy and
  carries the matching `regionId` — i.e. the two directions of the join agree.

### Determinism impact

**Preserved, and this deserves care because it is the fix most at risk.** `regionId` is a pure function
of the file's `packagePath`/`directoryPath` (`regions.ts:28-32`). `ordinal` is the index within a
region's group list, which is itself derived from canonically-sorted region iteration
(`assessment.regions` is in canonical order and `construct` preserves it) and canonically-sorted
community relabelling (`relabelByContent` numbers communities by ascending minimum member id). It is
therefore **not** a run-global counter and does not depend on input ordering or enumeration order — the
distinction that keeps it inside R7.3's prohibition on counters. Crucially, **`ordinal` is not part of
any identifier**: group ids remain `"g_" + sha1(membership)`, so adding it cannot perturb identity or
group membership. Two runs over identical input produce byte-identical output.

### Contract impact

`GraphNode` / `DependencyEdge` unchanged. `nodes.json` gains two optional fields on group entries and
`metadata.json` gains one optional array per decision — additive, so an existing consumer ignoring them
is unaffected, and `parseIndex` treats them as optional so previously written indexes still load. File
sizes grow marginally (a region id string plus a small integer per group; on the fixture, 9 groups).
`hierarchy.json`, `edges.json`, and `repository.json` are untouched. Requirement 9 needs new acceptance
criteria, since "the index must let a consumer name a group" is currently unstated — which is the root
cause of this gap.

### Viewer impact (Phase 3)

(a) **Yes** — `nodes.json` and `metadata.json` gain optional fields; sizes grow slightly; no field is
removed. (b) No change to node/edge counts or hierarchy depth, so the level-by-level rendering budget and
the "never render all N nodes at once" guarantee are unaffected. (c) No id-format change *here* — but
this fix is precisely what makes Bundle A's longer, scope-qualified ids safe, because it supplies the
display path so the viewer never needs the raw id. (d) It **adds** the metadata the viewer needs for
labels, colouring (by region, by preserve/reconstruct action, by score or confidence), and semantic-zoom
grouping; cross-group edge aggregation itself is unchanged. (e) It **removes** the blocker rather than
introducing one. The residual viewer requirement to specify: wrapper-level groups have no `regionId` and
must fall back to a structural label, and sibling groups sharing a `regionId` must show their ordinal, or
two boxes will read identically. **Classification: potential-blocker (Gap 12 itself) → this fix is the
mitigation.**

One further viewer note that belongs in the Review-3 spec rather than this fix: a `file` node's children
(its classes and methods) are **not** bounded by `maxGroupSize` — `User.java` already has 8 children in
the fixture, and a 100-method class would give one file node 100+ children. Requirement 11.1 constrains
`Group_Node`s only, so this is spec-compliant, but the viewer must paginate or virtualize a file's
members rather than assuming the ~20-node budget holds at the leaf level. Bundle A's Gap 4 fix increases
these counts further (it emits the anonymous- and local-class members that are currently merged away).

### Engine / ecosystem placement

Engine for the emitted provenance (`packages/core`); ecosystem for label composition (`packages/web`).
That split is the substance of the recommendation.

---

## Fix 7 — Gap 5: disambiguate the id separator and add the missing global uniqueness gate

**Severity** High · **Bundle** A · **Depends on** nothing (but ships with Gaps 4, 6, 7, 2) · **Viewer impact** viewer-spec-note-needed

### Gap summary

`buildClassFqn` joins the nested-type chain with `$` (`packages/parser/src/ids.ts:104`), but `$` is a
legal Java identifier character, so a top-level `class Outer$Inner` and a nested `class Inner` inside
`class Outer` mint the identical id. Across two files the parser emits **both** nodes and reports
`result : OK` (reproduced: `class:com.example.Outer$Inner` appears twice in `graph.json`); `group` then
aborts the whole repository with `duplicate node identifier`. Within one file the collision is instead
swallowed by the per-file `nodesById.has()` dedup (`ast-extractor.ts:255`), silently dropping a declared
type. No uniqueness check exists anywhere: `serializer.ts:168-186` builds a node-id `Set` only to sweep
dangling edges.

### Files / functions to change

| File | Change |
|---|---|
| `packages/parser/src/ids.ts` | Escape identifier segments before joining the nested chain |
| `packages/parser/src/serializer.ts` | Global node-id uniqueness gate before emission |
| `packages/parser/src/errors.ts` | Add `duplicate-node-id` reason carrying both defining files |
| `packages/parser/src/orchestrator.ts` | Surface the gate's error through the existing error gate |
| `packages/parser/src/symbol-table.ts` | Key derivation must un-escape consistently (it currently slices the id prefix) |
| `packages/parser/src/ids.test.ts`, `serializer.test.ts` | Tests below |
| `.kiro/specs/dependency-graph-parser/design.md` | Record the encoding; R3.12/R7.1 gain an enforcement point |

### Recommended solution

Two independent moves — the encoding fix prevents the collision, the gate makes any *future* collision
loud instead of silent. Both are needed: the gate alone would turn this into a hard failure, and the
encoding alone would leave R3.12 unenforced against Gap 2 and Gap 4.

**Encoding — escape `$` inside segments, keep `$` as the separator:**

```ts
// ids.ts
const NESTED_TYPE_SEPARATOR = "$";

/**
 * Escape the separator inside an identifier segment so the joined chain is
 * unambiguously decodable: a literal `$` in a Java identifier becomes `$$`,
 * which can never be confused with the single-`$` chain separator.
 */
function escapeSegment(name: string): string {
  return name.replace(/\$/g, "$$$$");   // one '$' -> two
}

export function buildClassFqn(packagePath: string, nestedTypeNames: readonly string[]): string {
  if (nestedTypeNames.length === 0) {
    throw new Error("a class FQN requires at least one type name");
  }
  const typeChain = nestedTypeNames.map(escapeSegment).join(NESTED_TYPE_SEPARATOR);
  return packagePath.length === 0 ? typeChain : packagePath + PACKAGE_SEPARATOR + typeChain;
}
```

`class Outer$Inner` (one type) → `class:p.Outer$$Inner`; `Outer.Inner` (nested) → `class:p.Outer$Inner`.
Distinct, and the mapping is injective because `$$` only ever arises from escaping.

**Gate — assert uniqueness across the whole node set, before writing:**

```ts
// serializer.ts, inside buildGraph (or a step before it)
const seen = new Map<NodeId, string>();          // id -> defining file id
for (const node of normalizedNodes) {
  const previous = seen.get(node.id);
  if (previous !== undefined) {
    return { error: makeError(
      "duplicate-node-id",
      `Two distinct declarations produced the same node identifier "${node.id}" ` +
      `(defined in ${previous} and ${node.definedInFile ?? node.id})`,
      node.definedInFile ?? node.id,
    ) };
  }
  seen.set(node.id, node.definedInFile ?? node.id);
}
```

Naming **both** defining files is the point: it is what turns today's misleading
`group: duplicate node identifier` into an actionable parser diagnostic.

### Alternatives considered

1. **Change the separator to a character Java identifiers cannot contain** (`/`, or `.` as the JLS
   canonical name uses). Simplest possible fix — no escaping logic. *Lost, narrowly:* `.` makes nested
   types indistinguishable from package segments (reintroducing exactly Gap 8's nested-import ambiguity
   from the other direction), and `/` makes class ids look like paths, which is actively confusing next to
   `file:` ids that *are* paths. Both also discard the JVM-binary-name resemblance that makes ids legible
   and would help a future bytecode-based or Kotlin/Scala front-end.
2. **Reject `$` in identifiers** as unsupported input. *Lost:* it is legal Java that appears in generated
   and interop code; refusing to index a valid repository is worse than encoding it.
3. **Hash the chain** (`class:p.<sha1 of segments>`). Collision-free and short. *Lost:* it destroys id
   legibility for debugging and for every human-facing surface, and it does not remove the need for the
   uniqueness gate anyway.
4. **Deterministically disambiguate on collision** (append the defining file path to the loser).
   *Lost as the primary fix:* it papers over an ambiguous encoding, and the id of an unchanged type would
   depend on whether an unrelated file elsewhere happens to collide — a nasty stability property. Worth
   considering only as the *gate's* behaviour instead of failing (see the open question in Gap 5).
5. **Gate only, no encoding change** — let the collision be a hard error. *Lost:* a legal repository
   then simply cannot be indexed, and the intra-file silent-drop half of the bug remains.

**Recommended: escape `$` as `$$` plus the global uniqueness gate.** Determinism is preserved (both are
pure functions of structural inputs — no counters, no time, no ordering dependence); the contract is
untouched since ids stay unique deterministic opaque strings; the escaping is total over the identifier
space with a single rule and no heuristics; it is a small, well-tested change; and it stays compatible
with Gap 4's additional scope segments and Gap 2's source-root prefix, both of which introduce more `$`
uses and would otherwise multiply the ambiguity.

**Runner-up: option 1 (change the separator to `/`).** It lost because it trades one ambiguity for
reduced legibility and a `.`-variant that would collide with package separators — but it is materially
simpler, and if review finds the escaping rule fiddly in combination with Gap 4's scope segments, `/` is
the fallback to take.

### Tests to add

- `ids.test.ts`, example-based: `buildClassId("p", ["Outer$Inner"])` ≠ `buildClassId("p", ["Outer","Inner"])`;
  identifiers beginning/ending with `$`; `$` in a package segment; a three-deep chain vs a two-deep chain
  that could otherwise collide; the same collisions on `func:` ids via the enclosing FQN.
- Property (fixing an identified blind spot): the existing distinctness property's identifier generator
  excludes `$`, `<`, `>`, `,` and every separator character (`ids.test.ts:31-46`), which is exactly why
  R3.12 was never violated in testing. **Widen the generator to include separator characters**, then
  assert: *for any* two structurally distinct entities, their ids differ. This is the single most
  valuable test in this fix — the property already exists and is simply generated over a sanitized
  alphabet.
- `serializer.test.ts`: two nodes sharing an id → `duplicate-node-id`, **nothing written**, both defining
  files named; the happy path unchanged (byte-identical output on the existing fixture).
- Regression, example-based end-to-end: the reproduced two-file `Outer$Inner` fixture now yields two
  distinct ids and a successful `group`.

### Determinism impact

Preserved. `escapeSegment` is a pure string function; the uniqueness gate iterates the already-canonically
ordered node list and is order-independent in its verdict (a duplicate is a duplicate regardless of
position — and the *reported* pair is deterministic because emission order is canonical). Output bytes
change **only** for repositories containing `$` in an identifier, where they were previously invalid
anyway.

### Contract impact

`GraphNode`/`DependencyEdge` shapes unchanged. **Node id format changes** for the affected minority of
entities, which the contract explicitly permits (ids are opaque unique strings; `packages/core` reads only
`packagePath`/`directoryPath`/`definedInFile` and never parses an id). Every `graph.json` and `index/`
must be regenerated — which is why this ships inside Bundle A's single re-parse. One caveat worth
recording: `symbol-table.ts` derives its FQN keys by *slicing the id prefix*
(`classKey`, `:67-69`), so the escaped form would leak into symbol keys; the fix must either un-escape
there or (better, and preferred) build symbol keys from the structural inputs directly rather than by
string-slicing an id — which is also what Gap 8's resolution work needs.

### Viewer impact (Phase 3)

(a) No index file changes shape or field set; group ids are content hashes and are unaffected except that
their *inputs* (leaf ids) change, so hashes differ after the re-index. (b) Node counts change slightly —
**upward**, because a previously-dropped colliding type now gets its own node; hierarchy depth is
unaffected. (c) **Yes, node id format changes.** Ids gain `$$` sequences for affected entities. Combined
with Gaps 4 and 6 and known Gap 2, this is the cumulative reason the viewer must render a display label
from `packagePath` + simple name and **never** the raw id. (d) No aggregation or metadata change. (e) No
blocker; the residual requirement is that the viewer's label composition must un-escape `$$` → `$` if it
ever derives a simple name *from an id* — which it should not do, since `nodes.json` carries
`packagePath` on leaves and Fix 6 supplies group provenance. **Classification: viewer-spec-note-needed.**

### Engine / ecosystem placement

Engine (`packages/parser`).

---

## Fix 8 — Gap 4: make the enclosing-scope chain model every naming scope

**Severity** High · **Bundle** A · **Depends on** ships with Fix 7's uniqueness gate · **Viewer impact** viewer-spec-note-needed

### Gap summary

`walkDeclarations` extends the type chain only at *named* type declarations and recurses through
everything else unchanged (`packages/parser/src/ast-extractor.ts:245-304`, notably the unchanged
`typeChain` at `:298`), so members of anonymous classes, enum-constant bodies, and local classes are
attributed to the nearest enclosing *named* type. Reproduced: a `Runnable` body's `run()` yields
`func:com.example.Phantom#neverOnPhantom()` — a method `Phantom` never declares; an enum with two
constant bodies plus an abstract method yields **one** `func:com.example.Op#apply(int,int)` node for
**three** declarations; two same-named local classes in sibling methods collapse into one
`class:com.example.Local$Helper`.

### Files / functions to change

| File | Change |
|---|---|
| `packages/parser/src/ast-extractor.ts` | `walkDeclarations` gains scope segments for unnamed/local scopes |
| `packages/parser/src/ids.ts` | Document the extended chain vocabulary (no signature change) |
| `packages/parser/src/ast-extractor.test.ts` | Tests below (the suite has no anonymous/local/enum-constant coverage today) |
| `.kiro/specs/dependency-graph-parser/requirements.md` | R3.3/R3.4 clarified: which unnamed types get nodes; R3.10 clarified on source-order-derived segments |

### Recommended solution

Push a scope segment whenever a *naming scope* opens, not only when a named type is declared. Each
segment is derived from content, never from a run-global counter:

```ts
// ast-extractor.ts
const ANONYMOUS_BODY_TYPES = new Set(["object_creation_expression"]);

function walkDeclarations(node, typeChain, packagePath, directoryPath, fileId, nodesById): void {
  for (const child of node.namedChildren) {
    if (TYPE_DECLARATION_TYPES.has(child.type)) {
      /* unchanged: push the declared simple name */
    }

    if (child.type === "enum_constant" ) {
      // A constant-specific class body is a scope named by the constant itself.
      const nameNode = child.childForFieldName("name");
      const next = nameNode ? [...typeChain, nameNode.text] : typeChain;
      walkDeclarations(child, next, packagePath, directoryPath, fileId, nodesById);
      continue;
    }

    if (ANONYMOUS_BODY_TYPES.has(child.type) && child.childForFieldName("body") !== null) {
      // Anonymous class: segment = instantiated type + occurrence index among
      // sibling anonymous bodies of the SAME type within this parent, in SOURCE
      // order. Source order is content (R3.11 stability), not filesystem
      // enumeration order (R3.10's prohibition).
      const typeNode = child.childForFieldName("type");
      const base = typeNode ? normalizeTypeText(typeNode.text) : "anon";
      const k = anonymousOccurrenceIndex(node, child, base);   // pure function of the subtree
      walkDeclarations(child, [...typeChain, `${base}#${k}`], packagePath, directoryPath, fileId, nodesById);
      continue;
    }

    if (FUNCTION_DECLARATION_TYPES.has(child.type)) {
      /* emit the function node as today, using the CURRENT chain */
      // ...then recurse with a method-scope segment so local classes are disambiguated:
      const sig = `${functionName}(${parameterTypes.join(",")})`;
      walkDeclarations(child, [...typeChain, sig], packagePath, directoryPath, fileId, nodesById);
      continue;
    }

    walkDeclarations(child, typeChain, packagePath, directoryPath, fileId, nodesById);
  }
}
```

With this, `Local.a()`'s `Helper` becomes `class:p.Local$a()$Helper` and `Local.b()`'s becomes
`class:p.Local$b()$Helper` — distinct, stable, and legible. `Op`'s constant bodies give
`func:p.Op$ADD#apply(int,int)` and `func:p.Op$SUB#apply(int,int)` alongside the abstract
`func:p.Op#apply(int,int)`: three nodes for three declarations, as R3.4 requires.

**Whether anonymous classes themselves get a `class` node** is the one policy call. Recommendation:
**yes**, emit one, because R3.3's "each class … declaration" is most defensibly read as including them
and because omitting the node while emitting its *methods* leaves those methods parented to nothing
coherent. It does increase the node count (see viewer impact).

### Alternatives considered

1. **JVM-style numeric suffixes** (`Local$1Helper`, `Outer$1`) matching `javac` exactly. Familiar, and
   ideal for a future bytecode front-end. *Lost:* `javac`'s numbering is assigned in compilation order
   across the whole class, so replicating it faithfully requires modelling that order; a *local* counter
   that merely looks like javac's would be misleading, and any run-global counter is what R3.10 forbids.
2. **Skip unnamed scopes entirely — do not emit their members.** Simple, and removes the phantom nodes.
   *Lost:* it silently deletes real declarations (a listener's `onEvent` is real code a developer
   navigates to), trading one wrong inventory for another, and it still leaves local classes merged.
3. **Emit members with a `synthetic: true` marker instead of fixing the chain.** *Lost:* it changes the
   contract (a new `GraphNode` field) to describe a problem rather than fix it, and the collision between
   two constant bodies' `apply` remains.
4. **Use source byte offsets in the segment** (`Local$1234$Helper`). Trivially unique and deterministic.
   *Lost:* ids then change whenever anything above the declaration is edited — a severe R3.11 stability
   regression, and the ids become unreadable.

**Recommended: content-derived scope segments as sketched.** Determinism holds because every segment is a
function of the syntax tree's own content and source order (no counters across files, no time, no
enumeration order); the contract is untouched; one rule — "a scope opens, push a segment" — covers
anonymous bodies, enum constants, local classes, and named types inside unnamed bodies without
per-case heuristics; cost is a contained rewrite of one recursive function; and it generalizes to any
language with nested scopes, which matters for the multi-language ambition.

**Runner-up: option 2 (skip unnamed scopes).** It lost because it under-reports real code, but it is the
honest fallback if emitting anonymous-class nodes proves to inflate the graph unacceptably on large
repositories — a measurement worth taking during implementation.

### Tests to add

- `ast-extractor.test.ts`, example-based (none of these are covered today): anonymous class with and
  without a same-named method on the enclosing type; two anonymous bodies of the same interface in one
  method; nested anonymous classes; enum with constant bodies plus an abstract method; two same-named
  local classes in sibling methods; a local class shadowing a member type of the same name; a named type
  declared inside an anonymous body; anonymous class in a field initializer and in a static initializer.
  Each asserts the exact id set — the count *and* the shape.
- Property (new): *for any* generated Java-like declaration tree, the number of emitted `class` +
  `function` nodes equals the number of declarations in the tree. This is the invariant that was
  violated (R3.3/R3.4 as a counting property) and it is what a merge silently breaks; it belongs in the
  spec's Correctness Properties.
- Property (strengthened): with Fix 7's widened identifier generator, assert distinct declarations →
  distinct ids across scope kinds, not just across packages.
- Regression: the four reproduced fixtures (phantom, anonymous merge, enum constants, local classes).

### Determinism impact

Preserved, and this is the fix where it needs the most scrutiny. Every segment derives from the parsed
tree: declared names, the instantiated type's text, a function's own signature, and an occurrence index
computed *within one parent node's children in source order*. None depends on filesystem enumeration
order, wall-clock, randomness, or a counter that spans files or runs — so re-parsing an unchanged file
yields identical ids (R3.11) and two runs are byte-identical. The one honest caveat: the occurrence index
means adding a *second* anonymous `Runnable` earlier in the same method changes the later one's index, so
ids are stable under unrelated edits but not under insertion of a sibling anonymous class of the same
type. That is inherent to identifying unnamed things positionally and is strictly better than today's
collision; it should be recorded in the design as a known stability boundary. R3.10's wording ("SHALL NOT
derive … from sequential counters") needs a clarifying amendment to distinguish a *source-position-derived
occurrence index* from a *run counter*.

### Contract impact

Shapes unchanged. **Node ids change** for members of unnamed scopes and local classes, and the node
**count increases** (previously-merged declarations become distinct; anonymous-class nodes are new).
Ships inside Bundle A's single re-parse. No `index/*.json` field-set change.

### Viewer impact (Phase 3)

(a) No shape/field change, but `nodes.json` grows — more leaf nodes. (b) **Yes, node counts increase**;
hierarchy depth is unchanged (the new nodes are children of `file` nodes). This matters concretely: it
worsens the unbounded file-level fan-out noted in Fix 6 — a file with several anonymous classes gains
their members as additional children of the file node. The viewer must paginate/virtualize a file's
members, and that requirement is now firmer. (c) **Yes, id format changes** (segments like
`Local$a()$Helper`, `Op$ADD`) — reinforcing the display-label requirement. (d) No aggregation change
(function/class nodes carry no edges in Phase 1). (e) Not a blocker, provided the viewer paginates
leaf-level children and renders labels rather than ids. A secondary note: `Op$ADD#apply(int,int)` needs
sensible label composition — the viewer should show `apply(int, int)` with `Op.ADD` as its owner path.
**Classification: viewer-spec-note-needed.**

### Engine / ecosystem placement

Engine (`packages/parser`).

---

## Fix 9 — Gap 6: derive function-id parameter lists from declared types only

**Severity** High · **Bundle** A · **Depends on** nothing; ships with Fixes 7, 8 · **Viewer impact** viewer-spec-note-needed

### Gap summary

`parameterTypesOf` falls back to the whole parameter's source text whenever the Tree-Sitter node lacks a
`type` field (`packages/parser/src/ast-extractor.ts:216-217`), and treats every non-receiver named child
of the parameter list as a parameter (`:212-227`). Reproduced ids:
`func:com.example.Sig#varargs(int... a...)` (the parameter **name** `a` and a doubled `...`),
`func:com.example.Sig#commented(int,/* width */,int,/* height */)` (comments as phantom parameters), and
`func:com.example.Rec#Rec()` for `record Rec(int a)`'s compact constructor (empty list, colliding with a
legal explicit no-arg constructor). R3.10 requires ids derived *solely* from structural attributes — a
parameter name and a comment are neither.

### Files / functions to change

| File | Change |
|---|---|
| `packages/parser/src/ast-extractor.ts` | Rewrite `parameterTypesOf`; add record-header handling for compact constructors |
| `packages/parser/src/ast-extractor.test.ts` | Tests below |
| `.kiro/specs/dependency-graph-parser/design.md` | Document the parameter-type normalization rule |

### Recommended solution

Make the function type-driven rather than text-driven, and normalize each type canonically:

```ts
const PARAMETER_TYPES = new Set(["formal_parameter", "spread_parameter"]);

function declaredTypeText(param: Node): string {
  // spread_parameter has no `type` FIELD in tree-sitter-java 0.23.x, but it does
  // have a type CHILD; find it structurally instead of falling back to raw text.
  const field = param.childForFieldName("type");
  if (field !== null) return normalizeTypeText(field.text);
  const typeChild = param.namedChildren.find((c) => c.type.endsWith("_type") || c.type === "type_identifier");
  return typeChild !== undefined ? normalizeTypeText(typeChild.text) : "";
}

function parameterTypesOf(declaration: Node): string[] {
  const parameters = declaration.childForFieldName("parameters");
  if (parameters === null) {
    // Record compact constructor: its signature IS the record header.
    return recordHeaderTypesOf(declaration) ?? [];
  }
  const types: string[] = [];
  for (const param of parameters.namedChildren) {
    if (!PARAMETER_TYPES.has(param.type)) continue;      // skips comments, annotations, receiver
    let text = declaredTypeText(param);
    const dims = param.childForFieldName("dimensions");
    if (dims !== null) text += normalizeTypeText(dims.text);
    if (param.type === "spread_parameter") text += "...";  // exactly once
    types.push(text);
  }
  return types;
}
```

`recordHeaderTypesOf` walks up to the enclosing `record_declaration` and reads its component types, so
`record Rec(int a)`'s canonical constructor becomes `func:p.Rec#Rec(int)` — distinct from an explicit
`Rec()`.

Results: `varargs(int...)`, `log(String,Object...)`, `commented(int,int)`, `arr(int[])`, `Rec(int)`.

**Also normalize away formatting and annotations** inside a type, so `Map<String,Integer>` and
`Map<String, Integer>` produce one id: strip parameter-level annotations and remove whitespace *inside*
generic argument lists. Whether to go further and erase generics entirely is the open question below.

### Alternatives considered

1. **Erase generics** (`Map` rather than `Map<String,Integer>`), matching JVM erasure. Shorter ids,
   immune to type-argument edits, and it matches what the JVM considers the signature. *Lost as the
   default, narrowly:* it is the more future-proof choice for a bytecode front-end, but it loses
   information a reader of the id wants, and it is a bigger behavioural change than this fix needs.
   Recorded as the open question, because two overloads differing only in type arguments are illegal
   Java, so erasure is *safe* for uniqueness.
2. **Keep raw source text but strip the declarator name with a regex.** Minimal diff. *Lost:* regexing
   Java parameter syntax is exactly the heuristic pile the priorities warn against — annotations,
   generics with nested commas, arrays-after-name (`int a[]`), and varargs all need special cases.
3. **Use the Tree-Sitter node's byte range as the parameter's identity.** Unique and cheap. *Lost:*
   destroys R3.11 stability (any edit above shifts offsets) and makes ids unreadable.
4. **Drop the parameter list from function ids entirely** and disambiguate overloads by an index. *Lost:*
   R3.4 explicitly requires overloads to be distinguished by "declared parameter type list", and an index
   would be positional — unstable and counter-like.

**Recommended: the type-driven rewrite above, keeping generic arguments but normalizing whitespace and
annotations.** Determinism is preserved (pure function of the declaration subtree, no positional or
temporal input); the contract is untouched; a single structural rule replaces a text fallback and covers
varargs, comments, annotations, arrays, receivers, and compact constructors; cost is one contained
function plus a helper; and it removes the formatting-sensitivity that made ids unstable under
non-structural edits.

**Runner-up: generic erasure (option 1).** It lost only on information preservation, and it is the
recommended follow-up if a bytecode or multi-language front-end is ever built — at which point erased
signatures become the natural common denominator.

### Tests to add

- `ast-extractor.test.ts`, example-based (no varargs, comment, or record-constructor coverage exists
  today — the reason this shipped): `int... a`; `String fmt, Object... args`; `final int... a`;
  `@NonNull String s`; comments before/between/after parameters; `Map<String,Integer>` vs
  `Map<String, Integer>` producing the **same** id; two params `A, B` vs one param `Pair<A,B>` producing
  **different** ids; `int[] a` vs `int... a`; `int a[]` (C-style array-after-name); receiver parameter
  `this`; record compact vs explicit no-arg constructor; generic method with a type parameter.
- Property (new, and the one that matters): *for any* declaration, the function id contains no parameter
  *name* and no comment text — expressible as "renaming a parameter, or adding/removing a comment inside
  the parameter list, does not change the id". That is R3.11 stability stated as a metamorphic property
  and it should be added to the spec.
- Property (strengthened): distinct overloads → distinct ids, generated over parameter lists that include
  generics, arrays, and varargs (the current generator excludes `<`, `>`, `,`).
- Regression: the reproduced `Sig.java` / `Rec.java` id set.

### Determinism impact

Preserved and *improved*. The new derivation is a pure function of the declaration's syntax subtree with
no positional, temporal, or ordering input. It strictly increases stability: ids no longer change when a
parameter is renamed, a comment is edited, or generic-argument spacing changes — each of which changes an
id today, which is the R3.11 violation at the heart of this gap.

### Contract impact

Shapes unchanged. **Function id format changes** (for varargs, commented, and record-constructor cases),
so Bundle A's re-parse covers it. Node counts change marginally: the record compact/explicit constructor
collision resolves into two nodes. No `index/*.json` field-set change.

### Viewer impact (Phase 3)

(a) No shape/field change; `nodes.json` ids differ for affected functions. (b) Negligible count change
(one extra node per record with both constructor forms); depth unchanged. (c) **Yes, id format changes** —
though *toward* legibility (`varargs(int...)` instead of `varargs(int... a...)`). Same display-label
conclusion as Fixes 7 and 8. (d) No aggregation change. (e) No blocker. Positive note: cleaner signatures
make a decent viewer label almost free — the substring after `#` is a presentable method signature, which
is worth recording in the Review-3 spec as the intended leaf-label source for function nodes (alongside
`packagePath` for classes). **Classification: viewer-spec-note-needed.**

### Engine / ecosystem placement

Engine (`packages/parser`).

---

## Fix 10 — Gap 8: resolve nested-type, wildcard and static-member imports

**Severity** High · **Bundle** A (after Fixes 7–9) · **Depends on** Fix 7's symbol-key derivation change · **Bundles naturally with known Gap 1** · **Viewer impact** viewer-spec-note-needed

### Gap summary

Three common import forms name targets that exist in the graph but can never match a symbol-table key,
so the stitcher drops them as if they were external. Reproduced, all yielding **zero** edges:
`import com.example.Outer.Inner;` (the table keys nested classes as `com.example.Outer$Inner`
— `symbol-table.ts:67-69` + `ids.ts:104` — while the import is recorded dotted,
`ast-extractor.ts:344-356`); `import com.example.*;` (the `.*` suffix matches nothing,
`ast-extractor.ts:354`); and `import static com.example.Helper.help;` (resolves to a `function` node,
which `resolveEndpoints` then discards under R5.2 without substituting the enclosing class,
`stitcher.ts:144-148`).

### Files / functions to change

| File | Change |
|---|---|
| `packages/parser/src/symbol-table.ts` | Build keys from structural inputs; index nested types under both dotted and `$` forms; expose a package-member lookup |
| `packages/parser/src/stitcher.ts` | Map a resolved `function` target up to its enclosing class; expand wildcards |
| `packages/parser/src/ast-extractor.ts` | Emit the import's static/wildcard nature explicitly rather than encoding it in the name string |
| `packages/parser/src/types.ts` | `RawReference` gains the import form |
| `packages/parser/src/{symbol-table,stitcher}.test.ts` | Tests below |
| `.kiro/specs/dependency-graph-parser/requirements.md` | R5 gains explicit semantics for these three forms |

### Recommended solution

Stop encoding structure in strings, and give the symbol table the two lookups resolution actually needs.

**1. Carry the import's form as data**, instead of appending `.*` to a name:

```ts
// types.ts
export interface RawReference {
  fromNodeId: NodeId;
  targetName: string;                                  // dotted, as written, no suffix
  kind: RawReferenceKind;
  importForm?: "single" | "wildcard" | "static" | "static-wildcard";
}
```

**2. Build symbol keys structurally and index nested types under both name forms.** The table currently
derives keys by slicing an id (`classKey`, `symbol-table.ts:67-69`), which is what couples it to the `$`
encoding. Building from `packagePath` + the type chain lets one class be reachable by both the JLS dotted
name (`p.Outer.Inner`) and the binary name (`p.Outer$Inner`):

```ts
// symbol-table.ts — for each class node, register both forms (canonical-first wins, R4.5)
register(`${packagePath}.${chain.join(".")}`, node.id);   // p.Outer.Inner  (import form)
register(`${packagePath}.${chain.join("$")}`, node.id);   // p.Outer$Inner  (binary form)
// plus a package index for wildcard expansion:
membersOfPackage.get(packagePath)!.push(node.id);         // canonical order maintained
```

**3. Resolve each form explicitly in the stitcher:**

```ts
function resolveTargets(ref: RawReference, symbols: SymbolTable): NodeId[] {
  switch (ref.importForm ?? "single") {
    case "wildcard":
      // p.* -> every class declared directly in package p, canonical order.
      return symbols.membersOfPackage(ref.targetName);
    case "static":
    case "static-wildcard": {
      // p.C.m -> the CLASS C, not the member: strip the trailing member segment.
      const cls = ref.targetName.slice(0, ref.targetName.lastIndexOf("."));
      const hit = symbols.lookup(cls);
      return hit !== null ? [hit] : [];
    }
    default: {
      const hit = symbols.lookup(ref.targetName);
      return hit !== null ? [hit] : [];
    }
  }
}
```

Then in `resolveEndpoints`, when a resolved target *is* a `function` node (a legitimately resolvable
static member), map it up to its enclosing class rather than dropping the candidate — R5.2 forbids
function *endpoints*, not the dependency:

```ts
const targetNode = nodesById.get(target)!;
const effectiveTarget = targetNode.kind === "function"
  ? enclosingClassIdOf(targetNode, nodesById)   // via definedInFile + the id's pre-'#' FQN
  : target;
if (effectiveTarget === null) return null;
```

For a **static wildcard** (`import static p.C.*;`) the class-scope target is exactly right, so both
static forms share one path.

### Alternatives considered

1. **Retry on miss** — on a failed dotted lookup, progressively re-join trailing segments as `$`
   (`p.A.B.C` → `p.A.B$C` → `p.A$B$C`) and take the first hit. No extra memory. *Lost, narrowly:* it is a
   bounded loop and works, but it makes resolution order-of-attempt-sensitive to reason about and needs
   its own determinism argument, whereas dual-indexing is a static, obviously-total mapping. Dual
   indexing also serves Gap 1's future type-use resolution for free.
2. **Treat a wildcard as a single package-level reference** rather than expanding to N class edges.
   Cheaper and arguably a truer representation of the developer's intent. *Lost:* there is no
   package-level node in the contract, so it would require inventing one — a contract change with
   downstream consequences for regions and the hierarchy.
3. **Expand a wildcard only to classes actually referenced in the file.** Most accurate — it would give
   the real dependency set. *Lost for now:* it requires the type-use extraction that Gap 1 owns, so it
   cannot land independently. **This is the natural successor** once Gap 1 lands, and the design should
   say so.
4. **Leave static imports dropped and document it.** *Lost:* static imports of project constants and
   helpers are ordinary Java, and the design's own principle already says the referencing entity is
   "mapped up to its file/class scope" — applying the same rule to the target is consistent, not novel.
5. **Resolve nested imports by rewriting the import string to binary form in the extractor.** *Lost:* it
   puts name-mangling knowledge in the extractor and breaks as soon as Gap 4 adds new segment kinds; the
   symbol table is the right owner of name forms.

**Recommended: carry the import form as data, dual-index nested types, expand wildcards over a package
index, and map function targets up to their class.** Determinism is preserved because every lookup is a
pure function of a canonically-built table and wildcard expansion emits targets in canonical id order;
the contract is untouched (only more edges, same shape); one explicit rule per import form replaces a
single string-match with no heuristics; and it is precisely the machinery Gap 1's type-use and
method-call resolution will need, so it is the most future-proof of the options.

**Runner-up: retry-on-miss for nested types (option 1).** It lost on clarity rather than correctness —
worth taking if measurement shows the dual index materially inflates memory on a 4,000-file repository.

### Tests to add

- `symbol-table.test.ts`: a nested class is resolvable by both `p.Outer.Inner` and `p.Outer$Inner`;
  `membersOfPackage("p")` returns only classes declared directly in `p`, in canonical order, and excludes
  nested types and sub-package classes; the R4.5 canonical-first rule still holds for each key form; a
  cross-kind key clash (a class named like a static member) resolves deterministically and — per the
  audit's stitcher finding — must **not** mint an edge to the wrong entity.
- `stitcher.test.ts`: nested-type import yields exactly one edge to the nested class; wildcard over an
  in-project package yields one edge per member class and nothing for an external package; static method
  import yields one edge to the enclosing class; static *field* import likewise; static wildcard likewise;
  self-import of one's own class yields **no** edge (the redundant intra-file case the audit flagged);
  whitespace-bearing import resolves once Fix 11 lands.
- Property (existing, extended): Property 4 (referential integrity — no function endpoints, no
  self-edges, no dangling) must continue to hold with the new mapping-up behaviour; this is the property
  most at risk from the `effectiveTarget` substitution, since mapping up could in principle produce a
  self-edge (a file importing a static member of a class it declares) — the existing self-edge guard must
  run *after* substitution, and a test must pin that ordering.
- Property (new): *for any* reference set, the edge count is monotonically non-decreasing versus the
  pre-fix resolver — i.e. the fix only ever adds edges. Cheap to express and it documents the intent.

### Determinism impact

Preserved. The table is built by iterating nodes in canonical id order with first-insert-wins (R4.5,
R4.6), so both key forms and the package index are reproducible. Wildcard expansion iterates the package
index in canonical id order, so the resulting edge set — and each edge's accumulated `importFrequency` —
is independent of reference processing order (R5.7, R6.7). The `effectiveTarget` substitution is a pure
function of the node set.

### Contract impact

Shapes unchanged; `strength` still never emitted. **Edge counts increase** — materially, since wildcard
expansion turns one statement into N edges and previously-dropped nested/static imports now resolve.
`importFrequency` values change for affected pairs. `RawReference` is an internal type, not part of the
contract. This is the fix most likely to move the *research numbers* (cohesion, coupling, and hence
preserve-vs-reconstruct decisions), which is exactly its purpose — and the reason it must land before any
`broadleaf`-based evaluation rather than after.

### Viewer impact (Phase 3)

(a) No shape or field change; `edges.json` grows. (b) **Node counts unchanged; edge counts increase**,
and consequently `Cross_Group_Edge` counts and weights increase — the viewer's per-level edge rendering
budget is affected more than its node budget. Wildcard expansion is the main contributor and can produce
a visually dense level; the viewer will likely need edge-weight thresholding or bundling at high zoom
levels, which is worth specifying now. (c) No id-format change from this fix. (d) **Yes — cross-group
edge aggregation changes** (more underlying leaf edges per aggregated pair, so higher weights), and
region cohesion/coupling in `metadata.json` shift, which affects any colouring keyed to score or action.
(e) Not a blocker, but the density point above is a real Review-3 design input: a level that was
comfortably renderable with import-only edges may not be once wildcards expand.
**Classification: viewer-spec-note-needed.**

### Engine / ecosystem placement

Engine (`packages/parser`).

---

# Medium-severity fixes

## Fix 11 — Gap 7: build qualified names structurally, not from source text

**Severity** Medium · **Bundle** A (first, because it feeds ids) · **Viewer impact** viewer-spec-note-needed

### Gap summary

`readPackagePath` and `collectReferences` read a `scoped_identifier`'s raw source span and only collapse
whitespace *runs* (`normalizeTypeText`, `packages/parser/src/ast-extractor.ts:179-181`), so
`package com . example;` yields `packagePath "com . example"` and ids like
`class:com . example.Ws` (reproduced). The same defect drops edges on the import side
(`import com . example . Helper;` never matches key `com.example.Helper`), and it leaks into
`packages/core`, where `primaryRegionOfFile` keys regions as `pkg:${packagePath}`
(`regions.ts:28-32`) — so one Java package splits into `pkg:com.example` and `pkg:com . example`,
perturbing the preserve-vs-reconstruct decision.

### Files / functions to change

`packages/parser/src/ast-extractor.ts` — a shared `dottedNameOf(node)` helper used by
`readPackagePath` and `collectReferences` (and, later, by Gap 1's type-use extraction);
`ast-extractor.test.ts`; and a note in the parser design that R3.7's "dotted package name" is produced
structurally.

### Recommended solution

Join the identifier descendants rather than reading the span:

```ts
/** Exact dotted name of a scoped_identifier / identifier, ignoring whitespace and comments. */
function dottedNameOf(node: Node): string {
  if (node.type === "identifier") return node.text;
  const segments: string[] = [];
  const walk = (n: Node): void => {
    for (const child of n.namedChildren) {
      if (child.type === "identifier") segments.push(child.text);
      else if (child.type === "scoped_identifier") walk(child);
      // comments and any other named extras are ignored by construction
    }
  };
  walk(node);
  return segments.join(".");
}
```

`normalizeTypeText` stays for *type* text, where interior spacing is meaningful to render.

### Alternatives considered

1. **Strip all whitespace from the span** (`text.replace(/\s+/g, "")`). One-line fix. *Lost:* it does not
   remove comments (`com./*x*/example` survives), so it fixes the common case and leaves the general one —
   the definition of a heuristic.
2. **Normalize defensively in `packages/core`** as well, so a stale `graph.json` still groups sanely.
   *Lost as the primary fix:* it puts Java naming knowledge in the algorithm package and treats the
   contract as unreliable rather than fixing the producer. (Worth *considering* as belt-and-braces if the
   region-splitting symptom is judged severe enough.)
3. **Reject whitespace-bearing qualified names as unparseable.** *Lost:* it is legal Java; refusing it is
   a regression in coverage.

**Recommended: `dottedNameOf`.** Determinism-neutral (pure tree traversal), contract-shape-neutral, total
over the formatting space with one rule, tiny, and reusable by Gap 1's and Gap 8's resolution work.

**Runner-up: option 1 (strip whitespace).** Lost because comments remain — but it is a legitimate stopgap
if this must ship separately from Bundle A.

### Tests to add

`package com . example;`, `package com./*c*/example;`, a multi-line package declaration, an annotated
`package-info.java` declaration, `import com . example . Foo;`, `import com . example . *;`, a
single-segment package, and the default package. Plus a property worth stating in the spec: *for any*
declared package, the emitted `packagePath` matches `/^[\p{L}\p{N}_$]+(\.[\p{L}\p{N}_$]+)*$/u` or is
absent — a serializer-level contract invariant that would have caught this immediately.

### Determinism impact

None; a pure function of the tree. Output changes only for files whose qualified names contain trivia,
where the current output is wrong.

### Contract impact

Shapes unchanged. `packagePath` values and therefore class/function **ids change** for affected files —
Bundle A's re-parse. Note the downstream consequence: `regionId`s change too, so `metadata.json`'s
`regionDecisions` keys change for affected packages.

### Viewer impact (Phase 3)

(a)–(b) no shape or count change. (c) Ids change for affected files only. (d) Region ids change, which
affects Fix 6's group provenance and any region-keyed colouring — worth noting because a viewer caching
region ids across re-indexes would see them move. (e) No blocker; it *improves* label quality, since a
corrupted `packagePath` would otherwise be displayed verbatim.
**Classification: viewer-spec-note-needed.**

### Engine / ecosystem placement

Engine (`packages/parser`).

---

## Fix 12 — Gap 14: reject `group`/`repository` kinds (and zero-file graphs) at ingest

**Severity** Medium · **Bundle** B (with Fix 1) · **Depends on** Gap 13's validation gate · **Viewer impact** none

### Gap summary

`NodeKind` legally includes `group` and `repository`, so such nodes pass ingest (the `definedInFile` gate
inspects only class/function kinds, `packages/core/src/ingestor.ts:50-51`), are then silently dropped by
the builder — which places only `file` nodes and their `definedInFile` members — while
`leafEdges = model.weightedEdges` keeps every input edge (`hierarchy-builder.ts:203`). Reproduced: `grp:X`
absent from `hierarchy.json`/`nodes.json` but still referenced by `edges.json`, i.e. `group` writes an
index its own `parseIndex` rejects. A graph with **zero** `file` nodes likewise succeeds, emitting a
single childless repository node.

### Files / functions to change

`packages/core/src/ingestor.ts` (fold into Fix 1's `validateRawGraph`); `packages/core/src/errors.ts`;
optionally `packages/shared/src/contract.ts` for the type split; `ingestor.test.ts`.

### Recommended solution

Two clauses inside Fix 1's existing walk — no separate pass:

```ts
const RAW_KINDS = new Set(["file", "class", "function"]);   // what a producer may emit
if (!RAW_KINDS.has(node.kind)) {
  return { code: "MALFORMED_NODE", nodeId: node.id,
           detail: `kind "${node.kind}" is not valid input (only file/class/function)` };
}
// ...after the walk:
if (!input.nodes.some((n) => n.kind === "file")) {
  return { code: "EMPTY_GRAPH", detail: "graph contains no file nodes" };
}
```

Optionally — and preferably, as a follow-up — split the shared union so the *type system* enforces the
seam:

```ts
// contract.ts
export type RawNodeKind = "file" | "class" | "function";        // parser output
export type NodeKind = RawNodeKind | "group" | "repository";    // hierarchy output
export interface GraphNode { kind: RawNodeKind; /* ... */ }
```

This is type-only and changes no serialized bytes, but it *is* a contract-file edit and should be an
explicit decision rather than a side effect.

### Alternatives considered

1. **Accept and place them** — interpret a `group`-kind input node as a pre-existing grouping hint.
   *Lost:* it has no specified semantics, and inventing one now pre-empts a real future feature
   (incremental re-indexing) that deserves its own design.
2. **Keep accepting them but exclude their edges from `leafEdges`** so the index stays self-consistent.
   *Lost:* it silently discards input edges, violating Req 8.1's "retain every dependency edge", and hides
   the producer's mistake instead of reporting it.
3. **Validate on the write side instead** — have `serializeIndex` check that every `edges.json` endpoint
   exists in `nodes.json`. *Lost as the primary fix* (it detects rather than prevents, and the input is
   already wrong by then) — but it is a cheap invariant worth adding anyway, and it pairs well with
   Fix 4.

**Recommended: reject at ingest via Fix 1's gate, with the shared-type split as a follow-up decision.**
Determinism- and contract-shape-neutral, one clause, and it makes the failure loud at the seam where the
bad input arrives.

**Runner-up: option 3 (write-side endpoint check).** It lost because prevention beats detection, but it
should be implemented *as well* — it is three lines and it guards against any future stage dropping a
node.

### Tests to add

`group`/`repository`/unknown kind → rejected, naming the id; a graph with only class nodes (no files) →
`EMPTY_GRAPH`; a conforming graph still ingests unchanged (the anti-over-strictness property from Fix 1
covers this).

### Determinism / contract / viewer impact

Determinism: none. Contract: `GraphNode`/`DependencyEdge` bytes unchanged; the optional type split is
compile-time only. Viewer: **none** — no index file changes shape, size, fields, counts, or depth; the
only behavioural difference is that a self-inconsistent index can no longer be produced, which the viewer
benefits from.

### Engine / ecosystem placement

Engine (`packages/core`, plus an optional type-only change in `packages/shared`).

---

## Fix 13 — Gap 15: decide and enforce one policy for parallel duplicate edges

**Severity** Medium · **Bundle** B (with Fix 1) · **Depends on** Gap 13's gate · **Viewer impact** none

### Gap summary

Ingest loads two edges sharing a `(source, target)` pair as two distinct edges (a `MultiDirectedGraph`,
`packages/core/src/ingestor.ts:79-85`) and the assessor sums their strengths independently
(`assessor.ts:71-98`), so a duplicated edge inflates Cohesion — reproduced: cohesion `3` where a single
edge gives `1.5`, enough to cross a boundary calibrated between them. The modularity projection
meanwhile *does* fold parallel edges by accumulating weight (`assessor.ts:192-201`), so the two metrics
disagree about the same graph.

### Files / functions to change

`packages/core/src/ingestor.ts` (Fix 1's gate); `packages/core/src/assessor.ts` (remove the
fold/no-fold inconsistency); `ingestor.test.ts`, `assessor.test.ts`; and the contract documentation if the
invariant is promoted (below).

### Recommended solution

**Reject** parallel duplicates at the gate, mirroring how duplicate *node* ids are treated:

```ts
const pairs = new Set<string>();
for (const edge of input.edges) {
  const key = `${edge.source} ${edge.target}`;
  if (pairs.has(key)) {
    return { code: "DUPLICATE_EDGE", source: edge.source, target: edge.target,
             detail: "at most one edge per ordered (source, target) pair" };
  }
  pairs.add(key);
}
```

and **document the invariant in the contract**, so it becomes a producer obligation rather than a
parser-local guarantee (the parser already satisfies it via R5.3). That is the change that makes every
future language front-end correct by construction.

### Alternatives considered

1. **Fold deterministically at ingest** — sum the three signals into one edge. Lenient, and it matches the
   modularity projection's existing behaviour. *Lost:* it contradicts Requirement 1.4's "no additions and
   no removals" and silently rewrites input, so a hand-authored fixture would report different numbers
   than it contains. It would need a spec amendment either way, and rejection needs none.
2. **Leave ingest permissive; make the assessor fold.** *Lost:* it fixes cohesion but leaves
   `Cross_Group_Edge` weights, `reconstructRegion`'s subgraph, and `edges.json` double-counted — a partial
   fix that is harder to reason about than either extreme.
3. **Do nothing** (parser output is always simple). *Lost:* the sanctioned adaptive demo
   (`fixtures/mixed-quality-graph.json`) is hand-authored, so this is the demonstration path, not a
   hypothetical.

**Recommended: reject at the gate + document the contract invariant.** Determinism-neutral, no shape
change, one rule, tiny, and it pushes the guarantee to the seam where it belongs.

**Runner-up: fold at ingest (option 1).** It lost on Req 1.4 fidelity. If the owner prefers leniency, the
fold must be paired with a requirements amendment *and* the assessor/projection inconsistency still has to
be resolved — strictly more work than rejecting.

### Tests to add

Two identical edges → `DUPLICATE_EDGE`; same endpoints with differing signals → rejected (this is also
Fix 1's determinism trigger, so the two tests reinforce each other); opposite directions `A→B` and `B→A`
→ **accepted** (legitimately distinct); a duplicated self-loop → rejected; a duplicated boundary-crossing
edge → rejected. Plus: assert the modularity projection and the cohesion accumulator now see the same
graph, which is the inconsistency this fix closes.

### Determinism / contract / viewer impact

Determinism: none (a pure set membership test over canonically sorted edges). Contract: no shape change;
the *documentation* gains an invariant. Viewer: **none** — conforming input produces identical counts,
weights, and depth.

### Engine / ecosystem placement

Engine (`packages/core`), with a documentation change in `packages/shared`.

---

## Fix 14 — Gap 16: make the degenerate rule strength-aware

**Severity** Medium · **Bundle** E · **Must land before** Gap 1's signal enrichment · **Viewer impact** viewer-spec-note-needed

### Gap summary

A region whose intra-region edges all carry strength 0 is not treated as degenerate — `assessor.ts:112`
tests intra-edge *count* (`intraCount === 0`), not total *strength* — so it is scored normally
(cohesion 0, coupling 0 → score 0.5) and, if reconstructed, handed to Louvain with total weight `M = 0`.
The delta arithmetic then yields `NaN`, no node ever relocates, and every file becomes its own community.
Reproduced: six files, five zero-strength edges, boundary 0.6 → **six** Level-2 groups of size 1.

This is the natural failure mode of Gap 1's fix: the stitcher creates an accumulator for *any* resolved
reference but increments a signal only for `kind === "import"` (`stitcher.ts:186-206`), so newly collected
type-use and method-call references would mint all-zero-signal edges on real repositories.

### Files / functions to change

`packages/core/src/assessor.ts` (strength-aware degenerate test);
`packages/core/src/community.ts` (total-weight guard in `detect`);
`packages/parser/src/stitcher.ts` (never emit an all-zero-signal edge — with Gap 1);
`assessor.test.ts`, `community.test.ts`.

### Recommended solution

Guard at both levels, because each is independently reachable through the public API:

```ts
// assessor.ts — Req 3.9's documented degenerate rule, keyed on signal not just topology
const degenerate = nodeIds.length < 2 || intraCount === 0 || intra <= 0;

// community.ts — mirror the existing "no dependency signal to rebuild from" rationale
let totalWeight = 0;
graph.forEachEdge((_e, attrs) => { totalWeight += (attrs.weight as number) ?? 0; });
if (graph.size === 0 || nodeIds.length < 2 || totalWeight <= 0) {
  return { communityOf: new Map(nodeIds.map((id) => [id, 0])) };
}
```

The detector guard is the one that prevents the explosion; the assessor guard is what makes the region's
*score* honest (0.0 degenerate rather than a misleading 0.5). Upstream, the real prevention is to not emit
signal-free edges at all, which belongs with Gap 1's work.

### Alternatives considered

1. **Detector guard only.** *Lost:* the region still scores 0.5, which sits exactly on the default
   boundary 0.5 — so the same input flips between preserve and reconstruct under a trivial boundary
   change, and the recorded score misrepresents a structureless region as average.
2. **Assessor guard only.** *Lost:* `detect` is exported and a caller (or a user-supplied `preserve`
   override followed by a manual detector call) can still reach the `M = 0` path.
3. **Reject zero-strength edges at ingest.** Cleanest prevention. *Lost as the primary fix:* a future
   signal design might legitimately want a "reference exists, weight 0" edge for provenance, so
   hard-rejecting now over-constrains the contract. Worth revisiting with Gap 1.
4. **Patch Louvain / swap the detector.** *Lost:* the `NaN`-delta behaviour is upstream third-party
   behaviour; guarding our precondition is cheaper and detector-agnostic, which the `CommunityDetector`
   abstraction exists to preserve.

**Recommended: guard in both the assessor and the detector, and prevent signal-free edges upstream with
Gap 1.** Determinism-neutral (both are pure predicates over already-deterministic values), contract-
neutral, closes every route with two small conditions, and it inoculates the codebase against the
regression Gap 1 would otherwise introduce.

### Tests to add

- `assessor.test.ts`: a region with ≥2 files and intra edges all of strength 0 is `degenerate` with the
  documented degenerate score; a mix of zero and non-zero intra strengths is **not** degenerate.
- `community.test.ts` (a stated coverage hole today): zero-total-weight subgraph → one community;
  isolated nodes inside an edged subgraph; parallel/reverse edge weight folding; a subgraph whose only
  edge is a self-loop.
- Property (extended, Property 9): score-in-range already holds; add that a region with no intra-region
  *strength* receives exactly the degenerate score — the requirement (3.9) says "zero internal edges", so
  the spec wording should be broadened to "no internal dependency strength", which is the substance of this
  fix.
- Regression: the reproduced six-file fixture yields **one** group, not six.

### Determinism impact

None — both guards are pure functions of already-deterministic inputs, and the degenerate path is the
existing documented one. Output changes only for regions that currently produce the degenerate explosion.

### Contract impact

No shape change. Region `score` values change for affected regions (0.5 → the degenerate score), so
`metadata.json` numbers and possibly preserve/reconstruct **actions** change — a correction, and one to
call out in the change log because it moves recorded research numbers.

### Viewer impact (Phase 3)

(a) No shape change. (b) **Yes — and favourably**: it prevents a Level-2 node count equal to the file
count, which is precisely the "never render all N nodes at once" property the viewer depends on. Depth may
decrease for affected regions. (c) No id change (group ids differ because memberships differ). (d)
Cross-group edge counts drop substantially for affected regions (singleton groups maximize cross-group
edges). (e) It *removes* a latent blocker — a repository hitting this today would present the viewer with
a flat level of hundreds of singleton groups. **Classification: viewer-spec-note-needed.**

### Engine / ecosystem placement

Engine (`packages/core`, plus `packages/parser` for the upstream prevention).

---

## Fix 15 — Gap 17: unify canonical order across the two packages

**Severity** Medium · **Bundle** A (so the re-index happens once) · **Viewer impact** viewer-spec-note-needed

### Gap summary

The parser orders ids byte-wise over UTF-8 (`compareUtf8`, `packages/parser/src/canonical.ts:38-40`,
mandated by R9.2/R9.3) while the core uses JavaScript's `<`/`>` (UTF-16 code units, `compareIds`,
`packages/core/src/canonical.ts:12-14`). Reproduced: `compareUtf8(U+FF61, U+10000) = -1` but
`compareIds(U+FF61, U+10000) = +1`. Each package is internally deterministic, so nothing is *wrong* today
— but "canonical order" is a cross-cutting engine concept with two definitions, and `compareIds` feeds
`sortIds`, which feeds `partitionChildren` slicing and content-addressed group-id membership.

### Files / functions to change

`packages/core/src/canonical.ts` (replace `compareIds`'s implementation); ideally a shared
`compareCanonical` in `packages/shared`; `canonical-and-ids.test.ts` plus a new cross-package test.

### Recommended solution

Adopt **byte-wise UTF-8 everywhere** — it matches the parser and is the only order any requirement states
explicitly — and cache the encoding so the extra cost is paid once per id rather than per comparison:

```ts
// core/canonical.ts
const utf8 = new Map<string, Buffer>();
function bytesOf(s: string): Buffer {
  let b = utf8.get(s);
  if (b === undefined) { b = Buffer.from(s, "utf8"); utf8.set(s, b); }
  return b;
}
export function compareIds(a: string, b: string): number {
  return a === b ? 0 : Buffer.compare(bytesOf(a), bytesOf(b));
}
```

For hot paths that sort large arrays repeatedly, a Schwartzian transform (decorate with the buffer, sort,
undecorate) avoids the map entirely; the cache above is the simpler starting point and keeps the
comparator's signature unchanged, so no call site moves.

### Alternatives considered

1. **Adopt UTF-16 order everywhere** (change the parser instead). Cheaper — no Buffer work in the hot
   path. *Lost:* R9.2/R9.3 explicitly mandate byte-wise UTF-8 for the parser, so this would require a
   requirements change to a stated, tested guarantee, and byte order is the encoding-independent choice a
   future non-JavaScript consumer (Neo4j loader, Rust front-end) would naturally use.
2. **Leave both as they are and document the divergence.** *Lost:* it is a latent trap for exactly the
   integrations the architecture plans (incremental re-index, Neo4j, a viewer binary-searching a sorted
   array), and the cost of unifying now is one function.
3. **Normalize ids to ASCII** so the orders coincide. *Lost:* it mangles legitimate non-ASCII identifiers
   and filenames, changing identity to avoid a comparison question.

**Recommended: byte-wise UTF-8 in both packages, ideally via one shared comparator.** Determinism is
preserved (byte order is total and encoding-independent); the contract shape is untouched; one definition
replaces two with no special cases; the change is small; and it is the most portable choice for future
consumers.

**Runner-up: option 1 (UTF-16 everywhere).** It lost because it contradicts an explicit, tested
requirement and is the less portable order — despite being the faster one.

### Tests to add

- A **cross-package** property test (new, and the mechanism that prevents future drift): *for any*
  generated identifier pair including supplementary-plane characters, the parser's and the core's
  comparators agree in sign. This is the test whose absence let the divergence exist.
- Unit cases: `U+FF61` vs `U+10000`; unpaired surrogates; combining marks; identical prefixes of differing
  length; ASCII-only pairs (must be unaffected).
- Assert that on the existing ASCII fixtures the determinism digests are **unchanged**, which bounds the
  blast radius of this fix.

### Determinism impact

Preserved. Output bytes change **only** for repositories containing supplementary-plane identifiers, where
child ordering, partition slicing, and therefore content-addressed group ids shift. All current fixtures
are ASCII, so their digests are unaffected — worth verifying explicitly as part of the fix, since a
changed digest on `fixtures/sample-java-project` would indicate an unintended behaviour change.

### Contract impact

No shape change. For non-ASCII repositories, `childIds` order and group ids change — hence bundling with
Bundle A's single re-index. `packages/shared` gaining a comparator function would be a change to that
package's types-only character and should be an explicit decision (the same decision Fix 1's runner-up
raises; if both land, the shared package gets one small runtime module for canonical ordering + validation).

### Viewer impact (Phase 3)

(a) No shape/field change. (b) No count or depth change. (c) Group ids change for non-ASCII repositories
(they are content hashes over ordered membership). (d) Sibling ordering changes, so any viewer layout
seeded from child order shifts — deterministically. (e) No blocker.
**Classification: viewer-spec-note-needed.**

### Engine / ecosystem placement

Engine (both packages; possibly `packages/shared`).

---

## Fix 16 — Gap 19: give the collector a documented, overridable exclusion policy

**Severity** Medium · **Bundle** E · **Viewer impact** viewer-spec-note-needed

### Gap summary

`collect`'s walk filters only on entry type and the `.java` suffix
(`packages/parser/src/source-collector.ts:126-180`) — there is no exclusion list — so `.git/`, `target/`,
`build/`, and `node_modules/` are fully traversed and their `.java` files enter the graph as live code.
On a real Maven/Gradle repository this means machine-generated sources (annotation processors, protobuf,
JAXB) are indexed as authored code, inflating every count and, per known Gap 2, manufacturing duplicate
FQNs.

### Files / functions to change

`packages/parser/src/source-collector.ts` (path-segment predicate + options);
`packages/parser/src/orchestrator.ts` (thread the option, record the outcome);
`packages/parser/src/parse-cli.ts` (`--include-generated` / `--exclude` flags);
`source-collector.test.ts`; and R2 in the parser requirements, since today's behaviour is
spec-conformant and the *policy* is the change.

### Recommended solution

A pure path-segment predicate with a documented default list, an override, and an auditable record of
what it did:

```ts
export const DEFAULT_EXCLUDED_SEGMENTS: readonly string[] = [
  ".git", ".hg", ".svn", "node_modules", "target", "build", "out", "bin",
  ".gradle", ".mvn", ".idea", "generated-sources", "generated",
];

function isExcluded(relativePath: string, excluded: ReadonlySet<string>): boolean {
  // Segment-exact matching, never substring: a package named "building" is safe.
  return relativePath.split("/").some((segment) => excluded.has(segment));
}
```

Applied at directory level during the walk (so an excluded subtree is not descended at all — the cost
saving as well as the correctness fix), with the effective list and the excluded-file count returned in
`ParseSuccess` and printed by the CLI, consistent with the project's honest-caveats posture.

### Alternatives considered

1. **Opt-in exclusions (default off).** Spec-faithful — R2.1 says "every Java source file". *Lost:* the
   default is what every real run uses, and nobody will remember the flag; the measured node counts and
   scale claims would keep including generated code.
2. **Respect `.gitignore`.** Elegant — the repository already declares what is not source. *Lost:* it
   needs a gitignore parser (pattern syntax, nesting, negations) and couples the engine to Git; it also
   misses `target/` in repositories that do not ignore it and would make output depend on VCS metadata,
   which is a determinism smell.
3. **Detect generated files by content** (`@Generated`, "DO NOT EDIT" headers). Precise per file.
   *Lost:* requires parsing everything first (no cost saving), and the markers are inconsistent in
   practice — a heuristic pile.
4. **Parse them but mark them** with a `generated: true` node field. *Lost:* it changes the contract, and
   the duplicate-FQN and cost problems remain.

**Recommended: default-on segment exclusions, overridable, with the effective list and counts recorded.**
Determinism is preserved (a pure function of relative paths, applied inside the canonically ordered walk);
no contract change; one segment-exact rule with no content heuristics; small; and the list generalizes per
ecosystem as multi-language support arrives.

**Runner-up: `.gitignore`-driven (option 2).** It lost on dependency weight and on making output depend on
VCS state, but it is the more *accurate* answer for a repository whose layout is unusual — a candidate
follow-up once the default list proves insufficient.

### Tests to add

Injected `readdir` trees covering: `.java` under `target/`, `build/`, `.git/`, `node_modules/`, and
`target/generated-sources/` (all excluded); a legitimate package directory named `build` or `out`
(excluded by default — and the test documents that, which is why the override exists); a nested
`node_modules`; case variants (`Build/` — not excluded, since matching is case-sensitive like R2.2);
an override that re-includes `target`; assertion that an excluded directory is **not descended** (the
stub records which directories were read).

### Determinism impact

None — the predicate is a pure function of the relative path and does not depend on enumeration order.
Excluding files changes the graph, of course, but identically on every run.

### Contract impact

No shape change. **Node and edge counts drop** (often substantially) on repositories with build output.
`ParseSuccess` gains fields (internal type). R2 needs an acceptance criterion for the exclusion policy so
the behaviour is spec-backed.

### Viewer impact (Phase 3)

(a) No shape/field change; files shrink. (b) **Yes — node/edge counts drop and hierarchy depth may
decrease**, which strictly helps the level-rendering budget. (c) No id change. (d) Region membership and
cross-group aggregation change (fewer files per region), so `metadata.json` scores shift. (e) No blocker;
a clear improvement, since the viewer would otherwise present generated code as first-class navigable
source. **Classification: viewer-spec-note-needed.**

### Engine / ecosystem placement

Engine for the predicate; the *default list* is arguably ecosystem policy but belongs with the engine so
every consumer inherits it. CLI flags are ecosystem.

---

## Fix 17 — Gap 20: expose the algorithm parameters on the CLI

**Severity** Medium · **Bundle** E · **Depends on** Fix 3 (`validateConfig`) · **Viewer impact** none

### Gap summary

`group-cli` accepts exactly two positionals and has no flag parsing
(`packages/core/src/group-cli.ts:23`), passing no config to `groupGraphToIndex` (`:54`), so every run uses
`DEFAULT_GROUPING_CONFIG`. Requirement 4.4 requires the `Structural_Quality_Boundary` to be "varied across
runs **without code changes**" for sensitivity analysis — today that requires writing code. Two adjacent
defects: a missing `graph.json` is reported as `malformed index file …: file could not be read` (neither
an index file nor malformed — `MALFORMED_FILE` is reused for "not found", `orchestrator.ts:151`), and a
non-`.json` input path makes the default output `<existing file>/index`, failing with `ENOTDIR` reported
as `WRITE_FAILED` on a directory (`group-cli.ts:40`).

### Files / functions to change

`packages/core/src/group-cli.ts` (flag parsing, `--help`, unknown-flag rejection);
`packages/core/src/errors.ts` (split `FILE_NOT_FOUND` from `MALFORMED_FILE`);
`packages/core/src/orchestrator.ts` (`readGraphFile` returns the new code);
a new `group-cli.test.ts` (none exists).

### Recommended solution

Minimal dependency-free parsing for exactly the parameters the specs call externally configurable, all
validated through Fix 3's `validateConfig` so the CLI cannot become a new injection route for the values
Gap 9 rejects:

```
npm run group -- <graph.json | project-dir> [outDir]
  --boundary <n>            --seed <int>
  --max-group-size <int>    --min-partition-threshold <int>
  --weight-cohesion <n>     --weight-coupling <n>     --weight-modularity <n>
  --squash-k <n>            --compute-modularity
  --preserve <regionId>     --reconstruct <regionId>   (repeatable → override map)
  --help
```

Unknown flags are an error (today extra positionals are silently ignored), and every numeric value goes
through `Number.isFinite` before reaching `validateConfig`, so a typo yields a usage error rather than a
`NaN` config. Also split the error codes so "not found" and "malformed" are distinguishable, and fix the
default-output derivation for non-`.json` inputs.

### Alternatives considered

1. **A config file** (`repohive.config.json`, recorded verbatim in `metadata.json`). Better for
   reproducing a sweep and self-documenting. *Lost as the primary answer:* a sweep over 20 boundary values
   wants a flag, not 20 files; and Gap 22 already records the effective config in metadata, which delivers
   the reproducibility benefit without the file. Worth adding *later* for the many-parameter case.
2. **Wait for the 8th-semester packaged CLI.** *Lost:* Req 4.4 is in the *algorithm* spec, so the
   capability is Phase-1 scope regardless of which wrapper exposes it, and the sensitivity analysis is
   needed for the paper now.
3. **Add a dependency** (`commander`, `yargs`). *Lost:* the engine deliberately uses only Node built-ins
   plus `graphology`; ~40 lines of parsing is cheaper than the dependency and its supply-chain surface.
4. **Environment variables.** *Lost:* invisible in shell history, so a sweep is not self-documenting —
   the opposite of what an auditable experiment needs.

**Recommended: minimal built-in flag parsing validated through `validateConfig`, plus the two error-message
fixes.** Determinism-neutral, contract-neutral, no new dependency, and it is the smallest change that
actually satisfies Req 4.4.

**Runner-up: the config file (option 1).** It lost on sweep ergonomics but is the better fit once the
parameter count grows; the two compose (flags override a file).

### Tests to add

A new `group-cli.test.ts` exercising `main` as a function with an injected argv: no args → usage, exit 2;
unknown flag → error; `--boundary` with a non-numeric or missing value → error; each flag reaching the
resolved config; repeated `--preserve`/`--reconstruct` building the override map; conflicting
preserve+reconstruct for one region → error; input directory without `graph.json` → the *new*
"not found" code; input file not ending in `.json` → a sensible output path; relative paths resolved
against `INIT_CWD`.

### Determinism / contract / viewer impact

Determinism: none (the CLI only selects a config; identical flags give identical output). Contract: no
file-shape change; `GroupingError` gains a member. Viewer: **none** — though note that a boundary sweep
now produces multiple `index/` directories with genuinely different hierarchies, which is exactly what the
Review-3 comparison view would want to visualize.

### Engine / ecosystem placement

Ecosystem (`group-cli.ts` is an explicitly temporary demo wrapper), with a small engine change for the
error-code split. Worth an explicit owner decision, since the *capability* is mandated by an engine
requirement while the *surface* is ecosystem.

---

## Fix 18 — Gap 18: make the determinism demos assert something

**Severity** Medium · **Bundle** E · **Depends on** Fix 3's boundary-domain decision · **Viewer impact** none

### Gap summary

`runs = Number(argv[3] ?? "3")` is never validated
(`packages/core/src/demo-group-determinism.ts:26`), so `runs = 0` skips the loop and the vacuous
`[].every(...)` prints `result : DETERMINISTIC (identical digest across all runs)` with
`sha-256 : undefined` and exit 0 (reproduced). The parser's demo script shares the pattern. These scripts
are pointed at during reviews as evidence.

### Recommended solution

Validate the input and make the assertion positive rather than absence-of-counterexample:

```ts
const runs = Number(process.argv[3] ?? "3");
if (!Number.isInteger(runs) || runs < 2) {
  console.error("usage: demo:group-determinism <graph.json> [runs>=2]");
  process.exit(2);
}
// ...after collecting digests:
const ok = digests.length === runs && digests.every((d) => d.length === 64 && d === digests[0]);
console.log(`  result   : ${ok ? `DETERMINISTIC (${runs} runs, identical digest)` : "NON-DETERMINISTIC"}`);
process.exitCode = ok ? 0 : 1;
```

Requiring `runs >= 2` is the substantive part: one run cannot demonstrate determinism, so accepting
`runs = 1` was as vacuous as `runs = 0`. Also fold in Fix 3's decision — if the boundary domain tightens
to `[0, 1]`, `demo-baselines.ts` must switch its always-reconstruct baseline to the design's sanctioned
all-`reconstruct` override map (grouping design.md:628), which is clearer evidence anyway.

### Alternatives considered

1. **Leave the scripts; rely on the property suites** (which do verify determinism properly). *Lost:* the
   demo guides in `docs/1st/` and `docs/2nd/` present these scripts' output as review evidence, so a
   script that can print a false pass is a real integrity problem even though the property is true.
2. **Delete the demo scripts** and demo via `npm test`. *Lost:* a focused, legible digest comparison is
   far better review theatre than a 181-test log, and the scripts are cheap to fix.
3. **Share one harness with the test suite's `verifyDeterminism`.** Attractive — one implementation of
   "prove determinism". *Recommended as a follow-up*, but it means the demo depends on test-support code,
   so it is a small structural decision rather than a drop-in.

**Recommended: validate `runs >= 2` and assert positively, in both demo scripts.** Trivially
determinism- and contract-neutral, and it makes the review evidence trustworthy.

**Runner-up: the shared harness (option 3).** It lost only on scope — it is the right end state.

### Tests to add

These are scripts rather than library code, so the honest answer is to make them *testable*: extract the
digest-comparison into an exported `compareRunDigests(digests, expectedRuns)` helper and unit-test it
(`runs = 0`, `1`, `n` identical, `n` with one differing, a short/invalid digest). Testing the printed
output is not worth the harness.

### Determinism / contract / viewer impact

None on all three — no engine code, no output artifact, no index change.

### Engine / ecosystem placement

Ecosystem (demo tooling).

---

# Low-severity fixes

These are recorded for completeness; neither produces a wrong output, and both are primarily
specification decisions.

## Fix 19 — Gap 21: resolve `minPartitionThreshold`'s vacuity

`partitionChildren` skips partitioning when `n <= maxGroupSize || n < minPartitionThreshold`
(`packages/core/src/hierarchy-builder.ts:241-243`), and since validation enforces
`minPartitionThreshold <= maxGroupSize` (`:49-58`), the second clause can never decide anything —
provable, not empirical.

**Recommended: option (b) — document it as intentionally vacuous** in the design (a
forward-compatibility placeholder), keep the validation, and note that Property 21's "groups below the
threshold are left unpartitioned" clause is vacuously satisfied. This is free and honest. The alternative
— allowing `minPartitionThreshold > maxGroupSize` so the knob can genuinely suppress partitioning of
moderately oversized groups — changes hierarchy shape, needs a requirements amendment, and has no
identified use case; it **lost** for exactly that reason (a config knob should not gain semantics before
someone needs them). Revisit only if a navigation argument for leaving oversized groups intact emerges.

Determinism, contract, and viewer impact: **none** under the recommendation (documentation only).

## Fix 20 — Gap 22: record the effective configuration in `metadata.json`

`buildMetadata` writes the boundary, metric weights, `k_cohesion`, decisions, and counts
(`packages/core/src/metadata.ts:55-66`), but not `maxGroupSize`, `minPartitionThreshold`,
`communityDetectionSeed`, the weight coefficients, or `degenerateScore` — so a run's *hierarchy shape*
cannot be reproduced from its own audit record, even though Req 7.1's determinism guarantee is stated
"with identical configuration".

**Recommended: embed the whole resolved configuration** as a nested `configuration` object populated from
`resolveConfig`'s output in `groupGraph`, keeping the existing top-level fields for compatibility and
adding the override map. Emitting the *resolved* (not partial) config is what makes it a reproduction
recipe. The alternative — a content **hash** of the config plus only the spec-named fields — is smaller but
useless for actually reproducing a run without the original invocation, so it **lost** on the one purpose
the field has. Fold in the related Req 3.7 correction while here: `activeWeights` currently keeps the
modularity weight whenever `computeModularity` is true, even if Q could not be computed (edgeless or
zero-weight projection), contradicting both Req 3.7's "weights **used**" and its own doc comment
(`assessor.ts:137-143`).

Determinism: none (all values are already-deterministic configuration). Contract: `metadata.json` gains an
additive optional object; `parseIndex` must accept indexes written without it. Viewer impact: **none** for
rendering, though a comparison view could use it to label two indexes by what differed between them.

---

# Appendix — what this audit did *not* design

Stated so the boundaries of this document are clear:

- **Known Gaps 1 and 2** keep their existing fix directions in `docs/gaps.md`. Bundle A is sequenced so
  they land in the same re-parse; in particular Gap 2's source-root-scoped identity composes with Fix 7's
  escaping (the source-root prefix is another segment, escaped by the same rule) and with Fix 10's
  resolution changes (the symbol table becomes source-root-scoped *and* dual-indexed).
- **Performance work.** The audit noted algorithmic observations in passing — `Array.prototype.shift()`
  BFS queues in `hierarchy-builder.ts` and `blast-radius.ts` are O(n²), and Fix 15's Buffer comparisons add
  per-comparison cost — but no benchmarking was performed and no performance fix is designed here. The
  scale evidence PROJECT_STATE calls for (a `vantage`/`broadleaf` run) is the right place to decide whether
  any of it matters.
- **Test-coverage gaps as such.** Several are named in `docs/edge-case-audit.md` (the `ids.test.ts`
  identifier generator excluding separator characters; no `groupGraphToIndex`/`readGraphFile` tests despite
  spec task 15 claiming an error-gate unit test; `community.test.ts` covering only well-behaved
  two-cluster subgraphs; arbitraries generating only well-typed nodes and `noNaN` boundaries). Each is
  addressed by the "Tests to add" section of the fix that owns the corresponding defect, rather than as a
  standalone testing initiative.
- **`packages/web`.** No viewer code is designed here. The viewer-impact sections above are inputs to the
  Review-3 spec; the three that most need to reach it are Fix 6 (group labels and provenance are a
  prerequisite, not a nice-to-have), the display-label conclusion shared by Fixes 7–9 (never render a raw
  node id), and the leaf-level fan-out note (a `file` node's children are not bounded by `maxGroupSize`,
  so members must be paginated or virtualized).
