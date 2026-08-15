# FABLE HANDOFF — Finish the RepoHIVE Engine + Viewer

> **You are Fable.** This document is your complete brief. Read it fully before touching code.
> It is self-contained: it does not assume you have any planning docs beyond what is committed on
> this branch. Where richer detail exists on-branch, this doc points you to it — but everything you
> need to finish the project is here.

---

## 0. TL;DR — your mission

The RepoHIVE engine and viewer are ~85% done. Two engine "waves" of hardening gaps remain, plus one
viewer wiring task. **Close all 13 remaining gaps, keep the build and test suite green and
deterministic, then finish the viewer's exact provenance.** Work on branch `fable-work` (cut from
`phase-3-viewer`). Commit granularly. Do not merge into other branches, tag, or force-push.

Remaining work, in order:

1. **Wave C — `engine-integrity`** (7 gaps): 17, 13, 14, 15, 3, 11, 10
2. **Wave D — `engine-audit`** (6 gaps): 9, 20, 22, 21, 18, 12
3. **Viewer finish**: wire Gap 12's real `regionId` into the viewer (replace the current
   package-prefix heuristic), add `NOTICE`, verify end-to-end.

You are **done** when: all 13 gaps are closed; `npm run build` is clean; `npm test` is fully green;
determinism digests are stable and recaptured; the viewer renders with exact provenance; and
`.kiro/PROJECT_STATE.md` + `.kiro/BRAIN.md` are updated honestly.

---

## 1. What you have and what you don't

**You have (committed on this branch):**
- The full engine source: `packages/shared`, `packages/parser`, `packages/core`.
- The vendored viewer: `packages/web`, `packages/ui`, `packages/types`, `packages/api-client`.
- A small committed fixture: `fixtures/sample-java-project/` (6 Java files). This is enough for a
  parse→group→view smoke test.
- **If present** (git-tracked, may or may not be on your clone): `.kiro/gaps.md` (full gap register
  with reproduced evidence), `.kiro/fixes.md` (full fix designs "Fix 3"–"Fix 22"),
  `.kiro/edge-case-audit.md`, `.kiro/specs/*` (the two engine specs — the source of truth for
  requirement numbers like `R3.9`, `Req 4.4`, `Property 24`), `.kiro/steering/*` (product,
  architecture, tech-stack, etc.), `docs/group-naming.md`.

**You do NOT have:**
- The big real-world fixtures `fixtures/vantage` and `fixtures/broadleaf` (gitignored). Do not expect
  them. See §8 for how to verify without them.
- Any external "memory vault", IDE hooks, or `.kiro/settings/`. Ignore any steering that tells you to
  use a "basic-memory MCP" or "personal vault" — that is owner-machine tooling, not yours.
- The original private planning docs (`docs/plan/*`). Their essence is reproduced in this handoff.

**Rule of thumb:** if `.kiro/gaps.md` and `.kiro/fixes.md` are present, treat them as the authoritative
detail for each gap and implement their "Recommended solution" verbatim. If they are absent, the
summaries in §6 and §7 of this document are sufficient to proceed.

---

## 2. The project in brief

RepoHIVE (Repository Hierarchical Indexing & Visualization Engine) turns a large, flat Java dependency
graph into a navigable multi-level hierarchy: `Repository → Groups → Files → Functions`.

**The research contribution:** *adaptive, per-region* hierarchy construction. For each region
(package), the engine measures structural quality (cohesion + coupling) and decides whether to
**preserve** the existing package boundary (well-structured) or **reconstruct** it via dependency-based
community detection (poorly-structured). Every decision, score, and parameter is recorded so the result
is **deterministic, reproducible, and auditable.**

**The pipeline is a stateless file-handoff:**
```
Java repo  →  [parse]  →  graph.json  →  [group]  →  index/*.json  →  [view]  →  browser
```
- **parse** (`packages/parser`): Tree-Sitter per-file ASTs, stitched into one cross-file dependency
  graph → `graph.json`.
- **group** (`packages/core`): ingest → weight → assess → adaptive construct → build hierarchy →
  five files in `index/` (`repository.json`, `hierarchy.json`, `nodes.json`, `edges.json`,
  `metadata.json`), plus blast-radius analysis.
- **view** (`packages/web` + vendored UI): a read-only Next.js viewer that projects `index/` onto a
  semantic-zoom canvas. No backend, no database.

**The JSON contract is the stable seam.** `GraphNode` and `DependencyEdge` shapes (in
`packages/shared`) do not change. Node IDs may change *format* but must stay unique, deterministic,
opaque strings. Everything downstream treats IDs as opaque.

**Engine vs ecosystem line:** the engine (`shared`/`parser`/`core`) is pure and local. The viewer is a
consumer. **Engine packages must never import a vendored viewer package.**

---

## 3. Current state (what's already done — do NOT redo)

- **Review 1 — parser:** done and merged.
- **Review 2 — grouping algorithm:** done and merged.
- **Wave A (`parser-hardening`, gaps 16 / 1a / 1c):** done and merged. The *preserve* branch now fires
  on real Java (this made the core claim demonstrable). Gap 1b (method-call edges) was deliberately
  **skipped as optional** — do not start it without explicit owner confirmation.
- **Wave B (`parser-identity`, gaps 7 / 6 / 4 / 5 / 2 / 8 / 19):** done. Node identity is now
  source-root-scoped (`class:<sourceRoot>|<FQN>`), `$` is escaped `$$`, collector exclusions are
  default-on. Multi-module repos ingest correctly.
- **Viewer:** substantially built on `phase-3-viewer` — index→canvas adapter, semantic zoom,
  preserve/reconstruct P/R badges, blast-radius highlighting, flat baseline, decision-audit table.
  Recent commits were bug fixes.

Your base branch `phase-3-viewer` already contains Wave A + Wave B + the viewer. The test suite was
last green at **257 tests** (84 core + 173 parser), determinism holding. Confirm this baseline before
you start (see §4).

The **only known viewer shortcut** to fix: group→region provenance is currently a *package-prefix
heuristic* (exact for preserved packages, approximate for reconstructed sub-clusters). Gap 12 (Wave D)
produces the real `regionId`; you will wire it in as the final step.

---

## 4. Build, test, and run — and the one footgun

**THE FOOTGUN:** `npm test` runs `node --test dist/` — it tests **compiled output, not your source.**
If you edit a `.ts` file and run `npm test` without building first, you are testing stale code and a
green result means nothing.

**Always, in this exact order:**
```
npm install                 # first time only
npm run build               # tsc -b packages/parser packages/core   (engine)
npm test                    # runs node --test dist/ in every workspace
```
Never report a green suite you obtained without building first.

**Other real commands:**
```
npm run typecheck                          # same as build
npm run parse -- <projectDir> [outPath]    # regenerate graph.json
npm run group -- <repoOrGraph> [outDir]    # regenerate index/
npm run demo:group-determinism -- <graph.json> [runs]   # repeated-run SHA-256 check
npm run demo:baselines
```

**Viewer (only after engine work is done):**
```
npm run build --workspace @repohive/web
# packages/web/.env.local must contain (local-only, git-ignored):
#   REPOWISE_API_URL=http://localhost:3000
npm run start --workspace @repohive/web    # or: npm run dev --workspace @repohive/web
```
The viewer reads `fixtures/<repo>/index/` from disk. `index/` is gitignored, so regenerate it first
(see §8). **Do not start dev servers from an automated tool that blocks** — run them only when you need
to eyeball the UI.

**First action:** run `npm install && npm run build && npm test` and confirm the baseline is green
(~257 tests). If you see failures you did not cause, **stop and report** rather than working around
them.

---

## 5. Non-negotiable invariants

Any change that violates these is wrong regardless of what it fixes.

1. **Determinism.** No `Math.random`, no `Date`/clock, no counters or enumeration order in identifiers.
   Identical input must produce **byte-identical** output. Every iteration must be canonically ordered.
   New derived values must be pure functions of already-deterministic data.
2. **The JSON contract is the seam.** `GraphNode` / `DependencyEdge` *shapes* do not change. IDs may
   change format but stay unique, deterministic, opaque strings.
3. **Errors are values.** Public entry points return structured `ParseError` / `GroupingError` — they
   do **not** throw across a boundary.
4. **No partial output.** A failing stage writes nothing (or leaves the previous artifact intact).
5. **Every emitted edge carries at least one non-zero signal.** The stitcher's reference-kind → signal
   `switch` is total over `RawReferenceKind`. If you add a reference kind, add its signal increment in
   the same commit. (Zero-strength edges reintroduce the singleton-explosion hazard Gap 16 guards.)
6. **Resolution precedence is JLS §7.5:** single-type import → same package → wildcard, in that order.
   There is exactly **one** resolution function in `stitcher.ts` — extend it, never fork it.
7. **Test conventions:** `node:test` + `fast-check`, test files beside sources, **≥100 runs per
   property** (`fc.assert(..., { numRuns: 100 })`), each property tagged:
   ```
   // Feature: <spec-name>, Property {number}: {property_text}
   ```
   If a fix establishes a new correctness property, add it to the relevant spec's Correctness
   Properties section (if `.kiro/specs/` is present) and commit as `kiro(specs):`.

---

## 6. Wave C — `engine-integrity` (gaps 17, 13, 14, 15, 3, 11, 10)

**Goal:** determinism is bulletproof and no input can crash, hang, or silently corrupt a run. Nothing
here changes what *correct* input produces, so Wave B's numbers survive. Do the gaps in this order.

| # | Gap | One-line issue | Fix direction | Main files |
|---|-----|----------------|---------------|-----------|
| 1 | **17** | Parser sorts byte-wise UTF-8; core sorts UTF-16 code units — "canonical order" means two different things. | Adopt **one** byte-wise UTF-8 comparator engine-wide; put it in `packages/shared` and use it on both sides. Add a cross-package property test asserting the two orders agree over non-ASCII ids. | `packages/shared`, `parser/canonical.ts`, `core/canonical.ts` (`compareIds`) |
| 2 | **13** | `graph.json` fields never validated at ingest; string-valued signals make `edges.json` **input-order-dependent** (a real determinism hole). | Validate element shapes at the ingest gate (`id` non-empty string; `kind` in enum; `directoryPath` string; each signal `Number.isInteger` and `≥0`; `strength` finite `≥0`). Make `compareDependencyEdges` **NaN-safe** (compare canonical string renderings, never bare subtraction). Extend `GroupingError` with `MALFORMED_NODE`/`MALFORMED_EDGE`. Reject `null`/non-object array elements here. | `core/orchestrator.ts` (`readGraphFile`), `ingestor.ts`, `canonical.ts`, `weights.ts` |
| 3 | **14** | Contract-legal `group`/`repository` input nodes are silently dropped while their edges stay in `edges.json`. | Narrow accepted input kinds at ingest: reject `group`/`repository`/unknown; require at least one `file` node. Fold into Gap 13's validation. | `core/ingestor.ts` |
| 4 | **15** | Parallel duplicate edges are double-counted, which can flip a preserve decision. | **DECISION (default): reject** parallel duplicate `(source,target)` edges at ingest with a structured error naming the pair — consistent with duplicate-node handling. Also fix the assessor/modularity-projection inconsistency so all metrics see the same graph. | `core/ingestor.ts`, `assessor.ts`, `hierarchy-builder.ts` |
| 5 | **3** | Uncaught exceptions (e.g. a filename with `\`, a `null` array element) escape the Result model and crash the run. | Add an exception boundary at every public entry point (`parseProject`, `groupGraph`, `groupGraphToIndex`, `parseIndex`) converting unexpected throws into a structured `INTERNAL_ERROR`. Make `ids.ts` path guards total (collector normalizes/rejects non-POSIX paths as a recoverable error). Gap 13 already closes the core `null`-element path. | `parser/orchestrator.ts`, `ids.ts`, `source-collector.ts`; `core/orchestrator.ts`, `index-parser.ts`, `community.ts` |
| 6 | **11** | `parseIndex` accepts a containment cycle; `analyzeBlastRadius`'s ancestor climb then loops forever. | Validate the containment tree **globally** on parse: exactly one root (`= repositoryId`), all nodes reachable, acyclic, `child.level === parent.level + 1`, `childIds` sorted + dedup, parent-side membership agrees, `kind` in enum. Give the blast-radius ancestor climb its own `visited` set. | `core/index-parser.ts`, `blast-radius.ts` |
| 7 | **10** | The five-file `index/` write is non-atomic; a mid-set failure leaves a mixed old/new index that `parseIndex` accepts. | Serialize all five payloads in memory → write to a temp sibling dir → promote atomically; on any failure remove the temp dir and leave the previous `index/` intact. Add read-side count invariants (metadata/repository counts vs the parsed hierarchy). | `core/index-serializer.ts`, `index-parser.ts` |

Suggested commit decomposition for the two big ones:
- **Gap 13**: (a) NaN-safe comparator + its property test; then one commit per validated field group
  (node shape, edge shape, signal domain).
- **Gap 10**: (a) in-memory serialization of all five payloads; (b) temp-dir write; (c) atomic promote;
  (d) read-side count invariants — keep the durability change separate from the new assertions.

---

## 7. Wave D — `engine-audit` (gaps 9, 20, 22, 21, 18, 12)

**Goal:** every run is configurable, reproducible from its own audit record, and every group is
nameable. Gap 12 is last because it feeds the viewer.

| # | Gap | One-line issue | Fix direction | Main files |
|---|-----|----------------|---------------|-----------|
| 1 | **9** | A NaN boundary silently forces all-reconstruct **and** writes `null` into `metadata.json`, which the engine's own parser then rejects. Most damaging silent failure in the codebase. | Add `validateConfig(resolved): Result<GroupingConfig>` at the **top** of `groupGraph`, before ingest. Validate: boundary **finite**; `weightCoefficients.*` and metric weights finite `≥0` with at least one `>0`; `cohesionSquashConstant` finite `>0`; `degenerateScore` in `[0,1]`; seed a safe integer. Move the existing hierarchy validation into this early gate. Make `stableStringify` reject non-finite numbers so `null` can never be emitted. **DECISION: the boundary's legal domain is "any finite value" (reject only NaN/±Inf)** — this kills the real defect while preserving the all-reconstruct baseline that uses `1.000001`. | `core/orchestrator.ts` (`resolveConfig`), `canonical.ts` (`stableStringify`), `metadata.ts` |
| 2 | **20** | The `group` CLI takes two positional args and cannot vary any algorithm parameter, so `Req 4.4`'s "sensitivity analysis without code changes" is unmet. | Add minimal, dependency-free flag parsing: `--boundary`, `--seed`, `--max-group-size`, `--min-partition-threshold`, `--weight-cohesion/-coupling/-modularity`, `--squash-k`, `--compute-modularity`, `--preserve <regionId>` / `--reconstruct <regionId>`, `--out`, `--help`. Validate through Gap 9. **Reject unknown flags.** Separately: split "file not found" from "malformed content" in the error taxonomy, and fix the non-`.json` default-output-path derivation. | `core/group-cli.ts`, `parser/parse-cli.ts` |
| 3 | **22** | `metadata.json` omits the params needed to reproduce the hierarchy *shape* (`maxGroupSize`, `minPartitionThreshold`, seed, coefficients, `degenerateScore`, override map). | Add a nested `configuration` object holding the full **resolved** config; keep existing top-level fields for compatibility. Teach `parseIndex` the new (optional) fields. Also correct `metricWeights` to reflect weights *actually applied* (drop modularity when Q was not computed). | `core/metadata.ts`, `core/types.ts`, `index-parser.ts` |
| 4 | **21** | `minPartitionThreshold` is a knob that can never affect any legal config (validation forces it `≤ maxGroupSize`). | **DECISION (default): option (b)** — acknowledge it as an intentional forward-compatibility placeholder; add a short design note in the spec; keep validation as-is. No behavior change. (Do not expand its domain unless the owner asks.) | `core/hierarchy-builder.ts` + spec note |
| 5 | **18** | Determinism demo scripts print `DETERMINISTIC` with `runs=0`, having verified nothing. | Validate `runs` (integer `≥2`, else exit non-zero with usage). Make the assertion positive: require `digests.length === runs` **and** all equal **and** digest is a non-empty string. Apply to both the core and parser demo scripts. | `core/demo-group-determinism.ts`, `parser/demo-determinism.ts` |
| 6 | **12** | Group nodes carry no label or region provenance, so the viewer can only show `g_<hash>`. **Viewer prerequisite.** | Purely additive. Carry the region association through the builder; emit `regionId` (and a deterministic ordinal for reconstructed communities / partition slices) on each group node in `nodes.json`; emit `groupIds` on each `regionDecisions` entry in `metadata.json`. Labels stay display-only and never feed identity. Teach `parseIndex` the new optional fields. | `core/hierarchy-builder.ts`, `index-serializer.ts`, `metadata.ts`, `types.ts`, `index-parser.ts` |

Suggested decomposition:
- **Gap 9**: one validated parameter per commit, then move the hierarchy validation into the gate.
- **Gap 12**: carry region association through the builder (inert) → emit `regionId` → emit the ordinal
  → emit `groupIds` → round-trip coverage. Only the emitting commits change `nodes.json`/`metadata.json`.

After Wave D, **re-index** (`npm run group -- fixtures/sample-java-project`) — these are the final
engine numbers.

---

## 8. Verification without the big fixtures

You do **not** have `vantage` or `broadleaf`. That is fine — most verification is fixture-independent:

- **Primary:** the property/unit suites (`npm test`) use synthetic in-memory graphs and generated
  inputs. They verify determinism, ordering, validation, and the 30+ spec correctness properties.
  This is your main safety net for Waves C and D.
- **Smoke test the pipeline** on the committed fixture:
  ```
  npm run parse -- fixtures/sample-java-project
  npm run group -- fixtures/sample-java-project
  npm run demo:group-determinism -- fixtures/sample-java-project/graph.json 5
  ```
- **To exercise the *preserve* branch on a real repo** (optional, for a richer viewer demo): clone a
  **domain/feature-packaged** single-source-root Java library (e.g. `jsoup`) — its classes collaborate,
  so cohesion is high and preserve fires. Layer-packaged apps (`controller/`/`service/`/`dto/`) stay
  mostly-reconstruct, which is the *correct* answer, not a bug. Point the parser at `<repo>/src/main/java`.
  Clones stay untracked (fixtures are gitignored) — never commit them.

**Determinism gate before every wave boundary:** run the demo determinism check and confirm the SHA-256
is stable across runs. When an ID-format or output-shape change moves the digest legitimately, update
the *recorded* digest in `.kiro/PROJECT_STATE.md` — never relax the property itself.

---

## 9. Viewer finish (after the engine is green)

1. **Wire Gap 12's real provenance.** The viewer currently joins group→region by package prefix
   (approximate for reconstructed sub-clusters). Once Gap 12 emits `regionId` on group nodes and
   `groupIds` on decisions, replace the heuristic in the web adapter/label module with the exact join,
   so every group card shows its true decision (preserve/reconstruct, score, confidence). Keep the
   adapter a **pure function** — no clock, no RNG.
2. **Regenerate `index/`** for whatever repo you demo, set `packages/web/.env.local`
   (`REPOWISE_API_URL=http://localhost:3000`), build the web workspace, and confirm the three surfaces
   render: Knowledge Graph, Flat baseline, Decision audit.
3. **Add a `NOTICE` file at the repo root** if it does not exist. The viewer vendors **repowise**
   (AGPL-3.0, © 2024–2026 Raghav Chamadiya and contributors); the project is AGPL-3.0-or-later. `NOTICE`
   must record, per vendored package: upstream project, URL, vendored commit, original license, original
   copyright holder. Do not modify `LICENSE` or strip any header.
4. **Do not touch the vendored UI internals** beyond the adapter, the label module, and the nav-gating
   file. Engine packages must never import a vendored package.
5. Cross-boundary leaf-edge rendering is a **deferred refinement** — leave it unless everything else is
   done and you have time; note it rather than half-building it.

---

## 10. Git & commit protocol

- **Branch:** do all work on `fable-work` (cut from `phase-3-viewer`). Commit and push to `fable-work`
  freely.
- **Forbidden:** merging into `main`/other branches, creating tags, force-pushing, `git reset --hard`,
  `git clean -fd`, rewriting pushed history, `--amend` on a pushed commit. Those are owner actions.
- **Granularity:** one commit per observable sub-behaviour, each **independently green and
  revertable**. Expect **3–7 commits per gap**. A commit that does not build and pass is not a rollback
  point. Run `npm run build && npm test` before **every** commit.
- **Staging:** explicit paths only. **Never `git add .`** — the tree contains untracked build leftovers
  and possibly git-excluded private files.
- **Do not commit** generated artifacts: `graph.json`, `**/index/`, `dist/`, `node_modules/`,
  `.next/`, `.env.local`. If `.kiro/gaps.md` / `.kiro/fixes.md` / `docs/plan/*` are present, **do not
  add or remove them** — leave their tracking exactly as you found it.
- **Message convention:** `feat|fix|test|refactor|chore(scope):` for engine code, `kiro(scope):` for
  specs/hooks/memory, `docs:` for reviewer-facing docs. Lowercase, imperative, ≤ ~70 chars.
- **Artifact gotcha:** `graph.json` and `index/` are untracked, so reverting a code commit does not
  restore the artifacts that matched it. After reverting anything that changes IDs or the edge set,
  re-parse and re-index before trusting a comparison.

---

## 11. Expected test breakages — handle correctly

Some fixes deliberately change behaviour that current tests pin. When a test fails **because the fix
made the old expectation wrong**, update the assertion to the newly-correct value and say so in your
report. **Do not** weaken/delete the test, and **do not** change the implementation to preserve a stale
assertion.

- Gap 13/14 validation may tighten what ingest accepts — update tests that fed malformed input and
  expected silent success.
- Gap 9 config validation may reject configs that tests previously passed unchecked.
- Gap 12/22 add fields to `nodes.json`/`metadata.json` — round-trip/parse tests must learn them.
- Determinism property: after any legitimate output-shape change the property **still holds**; only the
  recorded digest changes. Update the digest, never relax the property.

The one invariant that must **not** break: every emitted edge carries at least one non-zero signal.

---

## 12. Decisions you may make vs must escalate

**Pre-decided defaults (proceed with these; note if you disagree, don't block):**
- Gap 15 → **reject** parallel duplicate edges at ingest.
- Gap 9 → boundary domain is **any finite value** (reject only NaN/±Inf).
- Gap 21 → **acknowledge as a placeholder** (design note), no behavior change.

**Stop and ask the owner** (record the question, options, and your recommendation, then wait) if:
- a fix appears to require changing the `GraphNode`/`DependencyEdge` **contract shape**;
- a spec requirement contradicts the code you find and you cannot reconcile it;
- a prerequisite you expected has not actually landed;
- closing a gap would force you to break determinism or the engine/ecosystem line;
- you believe one of the pre-decided defaults above is actively wrong for a reason this doc didn't
  anticipate.

Otherwise, keep moving — you are expected to finish autonomously.

---

## 13. Bookkeeping (honest, real)

- After each wave lands, append a terse entry to `.kiro/BRAIN.md` (if present) and update
  `.kiro/PROJECT_STATE.md`: what changed, commit list, test counts before/after, recaptured digest.
- Use a **real** timestamp — run `Get-Date -Format 'yyyy-MM-dd HH:mm'` (or `date '+%Y-%m-%d %H:%M'`)
  and stamp entries with it. Never fabricate progress or dates.
- If `.kiro/` docs are absent on your clone, keep your work log in `FABLE_PROGRESS.md` at the repo root
  instead, in the same spirit.

---

## 14. Out of scope — do not do these

- Do not start Gap 1b (method-call edges) without owner confirmation — it was intentionally skipped.
- Do not refactor opportunistically; touch only the files a fix names.
- Do not modify `LICENSE` or strip license/copyright headers.
- Do not rewrite steering docs or specs beyond adding a genuinely-new correctness property.
- Do not build ecosystem features (packaged CLI, skill, MCP server, VS Code extension, Neo4j, cloud,
  auth, telemetry). Those are deferred and not part of this handoff.

---

## 15. First 30 minutes checklist

1. `git switch -c fable-work` (from `phase-3-viewer`), confirm you're on it.
2. `npm install && npm run build && npm test` → confirm ~257 green. If not, stop and report.
3. Read `.kiro/gaps.md` Gap 17 and `.kiro/fixes.md` Fix 17 **if present**; else use §6 row 1.
4. Reproduce the Gap 17 defect if you can, implement the fix in granular green commits, then proceed
   down Wave C in order, then Wave D, then the viewer finish (§9).
5. Keep `npm run build && npm test` green before every commit.
