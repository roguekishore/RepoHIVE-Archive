> A running list of known gaps, limitations, and unresolved issues to brainstorm and resolve
> later. Each gap is numbered and titled. This is a thinking/parking doc — not a spec and not a
> commitment; entries here get promoted into the roadmap, a spec, or a task once a decision is made.
> Add new gaps as `Gap N — <title>`. Do not delete resolved gaps; mark them resolved with a link
> to where they were addressed.

---

## Gap 1 — Preserve branch never fires on real Java (import-only dependency signal)

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-27
- **Area:** `packages/parser` (root cause) · `packages/core` (symptom surfaces here)
- **Severity:** High — it currently blocks the project's central research claim from being
  demonstrable on real code.

### The issue in one line
On real parsed Java, every package region is measured as structureless and gets *reconstructed* —
the *preserve* half of the "adaptive preserve-vs-reconstruct" contribution never fires.

### Evidence (measured, not assumed)
- `fixtures/vantage/index/metadata.json` (a real 158-file Spring Boot app, grouped): **all 20
  packages** have `cohesion: 0`, `score: 0`, `action: reconstruct`. Preserve fired **0 times**.
- `fixtures/sample-java-project`: same outcome — all 4 regions score `0.000` and reconstruct.
- The preserve branch *does* work when the signal exists: on the hand-made
  `fixtures/mixed-quality-graph.json` it correctly does 2 preserve / 1 reconstruct. So the mechanism
  is proven; only real-repo input fails to exercise it.

### Root cause
Cohesion is computed from **intra-package edges**. But the parser only builds edges from Java
`import` declarations (`packages/parser/src/stitcher.ts` — `methodCallFrequency` and
`sharedTypeCount` are hardcoded `0`, and `ast-extractor.ts` only emits `import` references). Java
requires **no import between classes in the same package**, so intra-package edges are ~0 *by
construction*. Zero intra-package edges → cohesion 0 → every region hits the degenerate-score rule
(Req 3.9) → falls below the boundary → reconstruct. It is a **measurement blind spot in the input
signal, not a defect in the algorithm**.

### Why it matters
- The core contribution (adaptive, per-region preserve-vs-reconstruct) is currently only
  demonstrable on a synthetic fixture. A sharp reviewer can rightly ask "show me on a real repo."
- **Claim B** ("adaptive beats a single global strategy on mixed-quality repos") is untested on real
  input — right now, on real code, adaptive is indistinguishable from always-reconstruct.

### Why it is NOT fatal (and cost no rework)
- The JSON contract is the seam: the core algorithm consumes edge `strength` regardless of how rich
  the signals are. The algorithm is complete and verified (79 tests / 33 properties) against the
  contract. The fix is **parser-only** — enrich the signal, re-run `group`, no core changes.
- Building the algorithm first also produced the crisp, measured evidence above that motivates and
  scopes the signal work precisely.

### Fix direction (to be detailed when brainstormed)
Enrich the parser's dependency signal so real intra-package structure becomes visible:
- Emit **type-use** edges (field / parameter / return types, `extends` / `implements`, `new X()`) →
  populates `sharedTypeCount`. Likely the lower-effort, higher-yield half.
- Emit **method-call** edges → populates `methodCallFrequency`.
- Resolve **same-package simple names** through the symbol table (the crux — same-package references
  carry no import and no FQN). Touches `ast-extractor.ts`, `symbol-table.ts`, `stitcher.ts`.
- The seam already exists: `RawReferenceKind` in `packages/parser/src/types.ts` already defines
  `"type-use"` and `"method-call"`; nothing currently produces them.

### Scheduling gap (part of this issue)
This work is documented only as a "deferred / sharpen later" caveat (parser spec Phase-1
simplification note; a PROJECT_STATE "Known gaps" line; the Review-2 demo guide; a vault knowledge
note). It is **not** in `.kiro/steering/roadmap.md`'s deferred-items table, owns no review beat, and
has no task in either spec. By the project's own process, that means the single highest-value
remaining engine work is at risk of being forgotten.

### Open questions for the brainstorm
1. **Before or after Review 3?** Review 3 (viewer + flat baseline, 10.08.2026) can arguably ship
   even with all-reconstruct grouping. But if Review 3 should also show the *adaptive* story
   (preserve firing on a real repo), the signal work must land first.
2. **Type-use first, or method-call first?** Type-use is probably cheaper and enough to lift cohesion
   above zero; method-call is richer but needs receiver-type inference.
3. **Which repo validates Claim B?** vantage is a small student app full of thin DTO packages and may
   legitimately stay mostly-reconstruct. The `broadleaf` fixture (a mature multi-module framework)
   is a better candidate to actually show preserve firing.
4. **Promotion:** once decided, promote this into the roadmap + PROJECT_STATE "Next up", and stand up
   a `parser-signal-enrichment` spec (or a Phase-1.5 task list) so it becomes trackable work.

---

## Gap 2 — Class/function node identity collides on multi-module repos (FQN assumed globally unique)

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-27
- **Area:** `packages/parser` (root cause: node identity + reference resolution) · `packages/core` (symptom surfaces here as an atomic ingest rejection)
- **Severity:** High — the engine cannot process a real multi-module Java repo at all; `group` aborts before producing any `index/`.

### The issue in one line
Class (and function) node IDs are derived from the fully qualified name alone, which assumes the FQN
is globally unique across the repo — but multi-source-root Java projects legally declare the same FQN
in different modules, producing duplicate node IDs that the grouping ingestor correctly refuses.

### Evidence (measured, not assumed)
- `npm run group -- fixtures/broadleaf` fails with:
  `group: duplicate node identifier: class:org.broadleafcommerce.core.offer.service.OfferServiceTest`.
- Two distinct source files declare that same FQN, confirmed on disk:
  - `fixtures/broadleaf/core/broadleaf-framework/src/test/java/org/broadleafcommerce/core/offer/service/OfferServiceTest.java`
  - `fixtures/broadleaf/integration/src/test/java/org/broadleafcommerce/core/offer/service/OfferServiceTest.java`
- Single-source-root fixtures are unaffected: `fixtures/sample-java-project` and `fixtures/vantage`
  group fine, because within one source root the Java compiler already guarantees FQN uniqueness.

### Root cause
`packages/parser/src/ids.ts` builds a class ID as `class:` + FQN (`packagePath` + `$`-joined nested-type
chain) and a function ID as `func:` + enclosingClassFqn + `#name(params)`. Neither carries any
locator for *which* source root/module the entity lives in. In Java the same FQN can exist in multiple
source roots (separate Maven/Gradle modules, or `src/main` vs `src/test`) because each compiles against
its own classpath. Two distinct files therefore mint the **identical** `class:<FQN>` id and both nodes
are written to `graph.json`. The grouping ingestor then rejects the duplicate atomically — this is
**correct, specified behaviour** (`hierarchical-repository-grouping` design Property 3 / Requirement 1.5:
"ingestion returns an error identifying the duplicated identifier and performs no partial load"). So the
defect is entirely in the **parser's identity model**, not in grouping.

Note the parser *partly* anticipated collisions but only for the wrong half: the symbol table already
resolves duplicate FQN keys with a canonical-first-wins rule (R4.5) for **reference resolution**, yet
node **identity** still emits both colliding nodes. Uniqueness of identity was never enforced.

### Why it matters
- It is a hard stop on real-world input. Multi-module is the norm for the "4,000+ file" repos in the
  problem statement; the engine currently cannot ingest that class of repo at all.
- `fixtures/broadleaf` was specifically earmarked (see Gap 1, open question 3) as the mature
  multi-module repo most likely to demonstrate the *preserve* branch of the adaptive contribution — the
  exact repo we most need is the one that crashes.

### Why it is NOT fatal (and costs no core rework)
- The JSON contract is the seam and the grouping algorithm treats node IDs as **opaque strings** — it
  reads `packagePath` / `directoryPath` / `definedInFile`, never the internal shape of the ID
  (confirmed in `packages/core`). So a longer, disambiguated ID needs **zero** downstream rework; the
  contract's `id` field just has to stay a unique string.
- The fix is **parser-only**: change how IDs are minted (and how references resolve), re-run `parse`
  then `group`. Determinism is preserved as long as the new ID stays a pure function of structural
  inputs (no counters/timestamps), per R3.10–R3.12.

### Fix direction (recommended; to be ratified in an ADR)
Scope identity — and resolution — by **source root**, deriving the source root purely from the
language's package↔directory correspondence (strip the package-as-directories + filename off the file
path), so no `pom.xml` / `build.gradle` parsing is needed and every build system (Maven, Gradle, Bazel,
flat) is handled uniformly.

- **Identity:** `class:<sourceRoot>|<FQN>`; the same source-root prefix must propagate into
  **function** IDs too (otherwise `OfferServiceTest#setUp()` still collides across the two files).
- **Degenerate fallback:** when a file's package does not match its directory tail (legal but unusual)
  and the source root cannot be cleanly derived, fall back to the **full file path** as the scope —
  which can never collide, since a path is globally unique. This fallback is what makes the scheme
  *total* / all-edge-cases-covered.
- **Resolution (the second half):** once IDs are unique, one FQN can map to N nodes, so the symbol table
  (`symbol-table.ts`) must become **source-root-scoped**: resolve a reference within the referring
  file's own source root first (matches Java classpath semantics), then fall back across roots by FQN —
  a single match links a genuine cross-module edge; multiple matches pick deterministically
  (byte-first source root) **and record the ambiguity in `metadata.json`** (auditable, consistent with
  the project's honest-caveats posture). Touches `symbol-table.ts` and `stitcher.ts`.
- **Display concern:** disambiguated IDs get long/ugly — keep display separate from identity so the
  viewer renders the human label from `packagePath` + simple name, not the raw ID.

Options considered and why source-root wins: FQN-only (status quo) collides; full-file-path scope is
bulletproof but less refactor-stable and doesn't give resolution scope for free; Maven/Gradle-module
scope is semantically ideal but drags in the build model (out of scope, and its own edge cases across
build systems). Source-root scope is derivable from a language invariant, is simultaneously the correct
resolution boundary, generalizes to future languages, and reduces to the path-uniqueness invariant in
the fallback — so it covers every case without heuristics on the build tooling.

### Edge cases the recommended scheme must cover
- Same FQN across two modules → different source roots → distinct IDs.
- Same FQN in `src/main` + `src/test` of one module → different source roots → distinct.
- Default package (no `package` declaration) → source root = file's own directory.
- Package not matching directory → full-file-path fallback.
- Generated/duplicated sources (`target/generated-sources`, symlinks) → distinct scope, no crash
  (optionally exclude generated dirs at collection time — separate collector policy).
- Multiple package-private top-level classes in one file → distinct simple names, same root → distinct.
- Nested/inner types → already `$`-joined; unaffected.

### Scheduling gap (part of this issue)
Like Gap 1, this is parser work with no home yet: it is not in `.kiro/steering/roadmap.md`'s
deferred-items table, owns no review beat, and has no task in either spec. It is also a prerequisite for
using `broadleaf` to validate the adaptive/preserve story called out in Gap 1.

### Open questions for the brainstorm
1. **Bundle with Gap 1?** Both are parser-signal/parser-model work on the same files
   (`ast-extractor.ts`, `symbol-table.ts`, `stitcher.ts`). A single `parser-signal-enrichment` /
   `parser-hardening` spec (or Phase-1.5 task list) could carry identity scoping *and* type-use/
   method-call edges together, since both are needed before `broadleaf` yields a meaningful adaptive demo.
2. **Cross-root resolution policy:** deterministic-pick + recorded ambiguity (recommended) vs
   over-approximate to all candidates (inflates edges) vs require a module graph (out of scope now).
3. **Minimal crash-fix vs full design:** a smaller stopgap (detect the collision in the parser and fail
   early with both file paths, or scope IDs by full file path only) unblocks ingestion fast; the full
   source-root design is the future-proof endpoint. Decide whether to ship the stopgap first.
4. **Promotion:** once decided, log an ADR (source-root-scoped identity + scoped resolution + full-path
   fallback + recorded cross-root ambiguity), update the `dependency-graph-parser` spec
   (node-identity + resolution requirements), add a synthetic two-source-root fixture for property
   tests alongside `broadleaf`, and add it to the roadmap + PROJECT_STATE "Next up".

---