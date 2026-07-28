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

# RepoHIVE — Open Gaps Register



> **Gaps 3–22 were logged by the 2026-07-28 exhaustive edge-case audit** of `packages/shared`,
> `packages/parser`, `packages/core`, and both CLI entry points. Every gap below carries a
> *reproduced* command with captured output unless its Evidence line says otherwise. The complete
> register of all 477 edge cases examined — including the ~289 that are already handled correctly
> and the ~52 that are deliberate Phase-1 simplifications — is in `docs/edge-case-audit.md`.
> Production-grade fix designs for the High/Medium gaps, with a single Recommended solution each,
> are in `docs/fixes.md`. Gaps 1 and 2 above are unaffected; where a gap below shares a *symptom*
> with them but has an independent root cause, it says so explicitly.

---

## Gap 3 — Uncaught exceptions escape the structured-Result error model and crash the run

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/parser` (`ids.ts`, `ast-extractor.ts`, `orchestrator.ts`) · `packages/core` (`ingestor.ts`, `index-parser.ts`, `community.ts`)
- **Severity:** High — a legal input filename or one malformed array element kills the process with a
  raw stack trace instead of returning a `ParseError` / `GroupingError`.

### The issue in one line
Both packages promise "errors are returned as values, never thrown across boundaries", but several
reachable code paths throw plain `Error`/`TypeError` that nothing catches, so the CLI dies with a
Node stack trace and no structured diagnostic.

### Evidence (measured, not assumed)
- **Reproduced (parser).** A file named `We\ird.java` — a legal Linux filename — crashes the run:
  ```
  Error: relativePath must use forward-slash separators, not backslashes: We\ird.java
      at assertRootRelativePosixPath (packages/parser/dist/ids.js:50:15)
      at buildFileId (.../ids.js:68:5)
      at extractFromRoot (.../ast-extractor.js:287:20)
      at parseProject (.../orchestrator.js:103:38)
  ```
  `assertRootRelativePosixPath` (`packages/parser/src/ids.ts:50-69`) throws; `extract` wraps
  `extractFromRoot` in `try`/**`finally`** with **no `catch`** (`ast-extractor.ts:449-471`), so the
  throw passes straight through the orchestrator. The same channel fires for a root-level file or
  directory named `C:something` (drive-letter guard, `ids.ts:64`).
- **Reproduced (core).** A `null` element inside `nodes[]` of an untrusted `graph.json`:
  `ingest({nodes:[{...}, null], edges:[]})` → `TypeError: Cannot read properties of null (reading 'id')`
  from the sort comparator (`ingestor.ts:26`). Same for a `null` element in `edges[]`
  (`compareDependencyEdges` dereferences `.source`).
- **Reasoned from code.** `index-parser.ts` iterates validated arrays with `for…of` and accesses
  `entry.id` / `decision.regionId` directly, so a `null` array element throws instead of returning
  `MALFORMED_FILE`. `community.ts:64-82` calls `graph.addNode`/`addEdge`, which throw graphology
  errors on precondition violations; `construct` calls `detector.detect()` bare
  (`constructor.ts:106`) and neither `groupGraph` nor `group-cli.ts:54` has a `try`/`catch`.

### Root cause
The "errors as values" rule is enforced by convention, not by a boundary. There is no
exception-to-`Result` adapter at any public entry point (`parseProject`, `groupGraph`,
`groupGraphToIndex`, `parseIndex`), and the invariant-assertion helpers in `ids.ts` were written as
`throw` because their callers were assumed to only ever pass collector-produced paths — an assumption
the collector does not honor for filenames containing `\` or a leading `<letter>:`.

### Why it matters
- It is a hard stop on a realistic repository: one oddly-named file (common when a Windows-authored
  zip is unpacked on Linux) yields zero output and an unreadable stack trace rather than R10.5's
  "message identifying the nature of the failure and the file involved".
- It defeats the no-partial-output guarantee's *reporting* half: the user cannot tell whether the run
  failed before or after writing.
- `graph.json` and `index/*.json` are untrusted disk inputs; a crash on malformed content is the
  weakest possible failure mode for a tool that will later be wrapped by an MCP server and a viewer.

### Why it is NOT fatal (and costs no contract rework)
The JSON contract is untouched: this is purely an error-handling change. Both packages already have
complete `Result` types and error taxonomies (`ParseError`, `GroupingError`), so the fix is to route
existing throw sites into existing error codes — no new output fields, no ID changes, no viewer impact.

### Fix direction
Two layers: (1) make `ids.ts`'s path guards *total* by having the collector reject or normalize
non-POSIX relative paths and returning a recoverable `file-unreadable`/new `path-unsupported` error
instead of throwing; (2) wrap each public entry point in a boundary `try`/`catch` that converts an
unexpected exception into a structured error (`INTERNAL_ERROR{detail}`), so no exception can ever
escape even if a future invariant is violated. Add element-shape validation at ingest (see Gap 13),
which removes the `null`-element throw at its source.

### Edge cases covered
Filename with `\`; filename/dir matching `^[A-Za-z]:`; `null`/non-object element in `nodes[]` or
`edges[]`; `null` element in any `index/*.json` array; duplicate or dangling ids handed directly to
`CommunityDetector.detect`; a third-party detector that throws.

### Open questions
1. Should a non-POSIX-representable filename be a *fatal* error (fail the run, name the file) or a
   *recoverable* per-file skip? Skipping silently loses code; failing matches R10.4's atomic posture.
2. Does `INTERNAL_ERROR` belong in the spec's `GroupingError` / `ParseErrorReason` unions, or should
   every reachable throw instead be provably eliminated (stricter, more review cost)?

---

## Gap 4 — Node identity is scope-blind: anonymous, enum-constant and local-class members collapse into the enclosing type

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/parser/src/ast-extractor.ts` (`walkDeclarations`) · `packages/parser/src/ids.ts`
- **Severity:** High — silently emits *phantom* nodes that do not exist in the source and silently
  *merges* structurally distinct declarations, on everyday idiomatic Java.

### The issue in one line
`walkDeclarations` extends the enclosing-type chain only at *named* type declarations and recurses
through everything else unchanged, so members of anonymous classes, enum-constant bodies, and local
classes are attributed to the nearest enclosing *named* type — inventing methods that class never
declared and conflating declarations that are distinct in the JLS.

### Evidence (measured, not assumed)
All reproduced with `node packages/parser/dist/parse-cli.js <fixture> <out.json>`:
- **Phantom node.** `class Phantom { Runnable r = new Runnable() { public void neverOnPhantom() {} }; }`
  → emits `func:com.example.Phantom#neverOnPhantom()`. `Phantom` declares no such method.
- **Silent merge (anonymous).** `class Anon { public void run() {} Runnable r = new Runnable(){ public void run(){} }; }`
  → **3 nodes total**, exactly one `func:com.example.Anon#run()` for **two** distinct declarations.
- **Silent merge (enum constants).** `enum Op { ADD { int apply(int,int){…} }, SUB { int apply(int,int){…} }; abstract int apply(int,int); }`
  → exactly one `func:com.example.Op#apply(int,int)` for **three** declared methods.
- **Silent merge (local classes).** `class Local { void a(){ class Helper{ void x(){} } } void b(){ class Helper{ void y(){} } } }`
  → one `class:com.example.Local$Helper`, with both `#x()` and `#y()` pooled under it (7 nodes; the
  JVM would name these `Local$1Helper` / `Local$2Helper`).
- Mechanism at `ast-extractor.ts:245-304`: `TYPE_DECLARATION_TYPES` gates chain extension
  (`:246`, `:253`); function declarations recurse with the **unchanged** `typeChain` (`:298`); the
  `nodesById.has(id)` guard (`:255`, `:284`) makes the merge silent.

### Root cause
The type chain models *declared named types only*, but Java's naming scope is created by any class
body — including the unnamed bodies of anonymous classes and enum constants — and by method bodies
for local classes. Because the chain is the sole input to `buildClassFqn`/`buildFunctionId`, two
declarations in different scopes produce one identifier, and a declaration inside an unnamed scope
inherits an FQN that asserts membership of a type it does not belong to.

### Why it matters
- **The node inventory is wrong on ordinary code.** Anonymous `Runnable`/`Comparator`/listener bodies
  and enum-constant bodies are idiomatic Java; every occurrence either fabricates a member on the
  enclosing class or deletes a real declaration, with no diagnostic.
- It violates R3.3 ("exactly one Graph_Node for **each** class … declaration"), R3.4 ("exactly one …
  for **each** method"), and R3.12 (no two distinct nodes share an id — here enforced by *dropping*
  one of the two, which is the other side of the same violation).
- Function nodes are hierarchy leaves, so `nodes.json` under-reports a file's members and the future
  viewer will show a method on the wrong owner.

### Why it is NOT fatal (and costs no core rework)
Function/class nodes carry no edges in Phase 1 (edges are file→class only, see Gap 8), so the *edge*
set and every grouping decision are unaffected today; the damage is confined to the node inventory.
The fix is parser-only and the contract is unchanged — ids stay opaque unique strings.

### Fix direction
Make the chain model *every* naming scope, using a deterministic, content-derived (never
counter-based) discriminator so determinism survives:
- Anonymous class body → push a segment derived from the instantiated type plus a **canonical
  occurrence key that is a pure function of position within the parent's canonical child ordering**
  (e.g. `$anon:Runnable#k` where `k` is the index among *sibling anonymous bodies of the same type*
  in source order — source order is content, not enumeration order, so it is reproducible).
- Enum constant body → push the constant's name (it *is* a name): `Op$ADD`.
- Local class → push the declaring method's signature segment: `Local$a()$Helper`.
- Named type inside an unnamed body → inherits the unnamed segment, so it can no longer masquerade as
  a direct member type.
Then add the global id-uniqueness assertion this gap and Gap 5 both need (see Gap 5).

### Edge cases covered
Anonymous class with/without a same-named method on the enclosing type; nested anonymous classes;
enum constant bodies (including a constant-body-only method); two same-named local classes in sibling
methods; a local class shadowing a member type of the same name; a named type declared inside an
anonymous body; anonymous class inside a static initializer or field initializer.

### Open questions
1. Should anonymous classes get a `class` node at all? The JLS says they are classes; the spec's R3.3
   enumerates "class, interface, enum, or record" declarations, which arguably excludes them. Emitting
   them is more faithful but inflates the node count and the viewer's file-level fan-out.
2. Is a source-order-derived occurrence index acceptable under R3.10's "no … enumeration order" rule?
   (It is *source* order, i.e. content — but the spec wording deserves a clarifying amendment.)
3. Should this bundle with Gap 6 (both are `ids.ts`/`ast-extractor.ts` identity work)?

---

## Gap 5 — `$` in a legal Java identifier collides with the nested-type separator, emitting duplicate node ids that abort `group`

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/parser/src/ids.ts` (`buildClassFqn`) · `packages/parser/src/serializer.ts` (missing uniqueness backstop)
- **Severity:** High — the parser writes a contract-violating `graph.json` (duplicate ids) and reports
  success; `group` then refuses the whole repository.

### The issue in one line
`buildClassFqn` joins the nested-type chain with `$`, but `$` is a legal Java identifier character, so
a top-level `class Outer$Inner` and a nested `class Inner` inside `class Outer` mint the identical id
`class:p.Outer$Inner`.

### Evidence (measured, not assumed)
- **Reproduced.** Two files in one package — `Nest.java` (`class Outer { static class Inner {} }`) and
  `Flat.java` (`class Outer$Inner {}`) — produce a `graph.json` containing
  `class:com.example.Outer$Inner` **twice** (5 nodes, verified duplicate id), and the parser exits
  `result : OK`.
- Feeding that graph to `group` aborts the entire run:
  `group: duplicate node identifier: class:com.example.Outer$Inner`.
- Within a **single** file the collision is silently swallowed instead: `nodesById.has(classId)`
  (`ast-extractor.ts:255`) keeps the first and drops the second declared type, no diagnostic.
- `ids.ts:104` performs the join (`nestedTypeNames.join("$")`). `serializer.ts:168-186` builds a
  `Set` of node ids **only** to sweep dangling edges — node ids themselves are emitted unchecked, so
  there is no R7.1/R3.12 uniqueness backstop anywhere in the parser.

### Root cause
The ID scheme borrows the JVM binary-name convention (`Outer$Inner`) without borrowing its escaping
discipline; the separator is drawn from the same character set as the names it separates, so the
encoding is ambiguous. Compounding it, uniqueness is asserted only *per file* (a fresh `nodesById`
map per extraction), never across the run, even though R3.12 is a whole-graph invariant.

### Why it matters
- `$` in identifiers is legal and appears in real code: generated sources, Scala/Kotlin/Groovy
  interop shims, and obfuscated or decompiled Java routinely use it.
- The failure mode is maximally unhelpful: the *parser* declares success, and the *grouper* — which is
  behaving exactly per Requirement 1.5 — takes the blame for an upstream defect.
- **This shares Gap 2's symptom (duplicate `class:` ids aborting ingest) but has an independent root
  cause and would NOT be fixed by Gap 2's source-root scoping**: both colliding types here live in the
  same source root, same package, same directory. Gap 2 scopes identity *across* roots; this gap is
  about the *encoding within* a root.

### Why it is NOT fatal (and costs no core rework)
The grouping side is already correct — rejecting duplicates atomically is specified behaviour. The fix
is parser-only, and the contract only requires ids to be unique deterministic opaque strings, so a
changed separator or an escaped encoding needs zero downstream rework.

### Fix direction
Two independent, complementary moves:
1. **Disambiguate the encoding.** Either escape `$` in identifier segments before joining (e.g.
   `$` → `$$`, so `Outer$Inner` as one name becomes `Outer$$Inner`), or switch the nested separator to
   a character Java identifiers cannot contain (`/` or `.`), keeping it a pure function of structure.
2. **Add the missing global uniqueness gate.** Assert id-uniqueness across the whole node set before
   serialization; a collision becomes a structured `ParseError` naming both defining files, so the
   parser never again emits a contract-violating graph or blames the grouper.

### Edge cases covered
Top-level `A$B` vs nested `A.B` in the same package, across two files (duplicate emitted) and within
one file (silent drop); identifiers beginning or ending with `$`; `$` in a package segment; a nested
chain three deep colliding with a two-deep chain; the same collision on `func:` ids via the enclosing
FQN; interaction with Gap 4's scope segments (which introduce more `$` uses).

### Open questions
1. Escape-`$` vs change-the-separator: escaping keeps ids visually close to JVM binary names (good for
   humans and for a future bytecode-based index); changing the separator is simpler but makes ids look
   less like Java. Which do we want as the long-term identity encoding?
2. Should the global uniqueness gate be fatal or should it deterministically disambiguate (append the
   defining file) and record the collision in a diagnostics section?
3. Sequencing with Gap 2: both change `class:`/`func:` id shape, so they should land in one ADR and
   one re-parse to avoid churning every downstream artifact twice.

---

## Gap 6 — Function ids embed parameter *names* and *comments*, not just declared types

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/parser/src/ast-extractor.ts` (`parameterTypesOf`) · `packages/parser/src/ids.ts` (`buildFunctionId`)
- **Severity:** High — node identity changes under a pure parameter rename or a comment edit,
  breaking R3.10/R3.11 stability and producing malformed identifiers.

### The issue in one line
`parameterTypesOf` falls back to the whole parameter's source text whenever the Tree-Sitter node has
no `type` field, so varargs parameters contribute `int... a...` (name included, `...` doubled) and
comments inside a parameter list are treated as additional parameter "types".

### Evidence (measured, not assumed)
Reproduced on one fixture (`Sig.java`), emitted ids verbatim:
```
func:com.example.Sig#varargs(int... a...)                       ← parameter NAME "a" in the id
func:com.example.Sig#log(String,Object... args...)              ← parameter NAME "args" in the id
func:com.example.Sig#commented(int,/* width */,int,/* height */) ← comments as phantom parameters
func:com.example.Sig#arr(int[])                                  ← correct, for contrast
func:com.example.Rec#Rec()                                       ← record compact ctor: empty list
```
- Mechanism: `tree-sitter-java`'s `spread_parameter` declares **no** `type` field, so
  `childForFieldName("type")` returns `null` and `ast-extractor.ts:216-217` falls back to
  `param.text` (the entire `int... a`), then `:223-225` appends another `...`.
- Comments are *named extras* in Tree-Sitter and therefore appear in `parameters.namedChildren`;
  `:212-227` treats every named child that is not a `receiver_parameter` as a parameter.
- `compact_constructor_declaration` has no `parameters` node, so `parameterTypesOf` returns `[]`
  (`:207-210`): `record Rec(int a)`'s canonical constructor is identified as `Rec()`, which collides
  with a legally co-declared explicit no-arg constructor.

### Root cause
`parameterTypesOf` treats "no `type` field" as "use the raw text", conflating a grammar detail with a
semantic fallback, and does not filter `namedChildren` down to actual parameter node types. The
identifier therefore admits material that is not a declared parameter type — exactly what R3.10
forbids.

### Why it matters
- **Identity is unstable under refactors that change nothing structural.** Renaming a varargs
  parameter or editing a comment inside a parameter list changes the node id, so every consumer
  (hierarchy membership, group content hashes, blast-radius answers, and later incremental
  re-indexing and Neo4j keys) sees a *different entity*. R3.11 promises the opposite.
- Overload distinction — the stated purpose of putting the parameter list in the id (R3.4) — is
  actively broken for the record compact-constructor case, where two distinct constructors collide.
- The ids are also user-visible in a debugging context and plainly malformed.

### Why it is NOT fatal (and costs no core rework)
Function nodes carry no edges in Phase 1, so grouping decisions and cross-group aggregation are
untouched; the blast radius of the bug is the node inventory plus id churn. Contract-wise, ids remain
opaque unique strings, so the fix is parser-only.

### Fix direction
Rewrite `parameterTypesOf` to be *type-driven rather than text-driven*:
- Iterate only `formal_parameter` / `spread_parameter` / `receiver_parameter` node types; ignore every
  other named child (comments, annotations at the list level).
- For `spread_parameter`, read its declared `type` child explicitly (it exists as a *child*, just not
  as a named *field*) and render exactly one `...` suffix; never include the declarator name.
- Normalize each type to a canonical form (strip annotations, collapse generic-argument whitespace)
  so formatting differences cannot change an id.
- For `compact_constructor_declaration`, synthesize the parameter list from the record header
  components so the canonical constructor's id reflects its real signature.

### Edge cases covered
`int... a`; `String fmt, Object... args`; `final int... a`; annotated parameter (`@NonNull String s`);
comments before/between/after parameters; generic parameter types with commas
(`Map<String,Integer>` vs two params `A, B`); array vs varargs (`int[]` vs `int...`); receiver
parameter (`this`); record compact vs explicit constructor; no-arg method.

### Open questions
1. How far should type normalization go — erase generics (`Map` not `Map<String,Integer>`, matching
   JVM erasure and making ids robust to type-argument edits), or preserve them (more precise overload
   distinction)? Erasure cannot distinguish two overloads that differ only in type arguments, but
   those are illegal in Java anyway, which argues for erasure.
2. Should the fix be bundled with Gap 4 and Gap 5 into a single "parser node-identity hardening"
   spec, given all three change id shape and all three want the same global uniqueness gate?

---

## Gap 7 — Qualified names are captured as raw source text, so legal whitespace or comments corrupt `packagePath` and silently drop edges

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/parser/src/ast-extractor.ts` (`readPackagePath`, `collectReferences`, `normalizeTypeText`)
- **Severity:** Medium — legal but unusual formatting yields a corrupted `packagePath` that propagates
  into every node id *and* into the core's Region identity, splitting one logical package into two.

### The issue in one line
`readPackagePath` and `collectReferences` take the `scoped_identifier`'s raw source span and only
collapse whitespace *runs* to single spaces, so `package com . example;` becomes the package
`"com . example"` rather than `com.example`.

### Evidence (measured, not assumed)
- **Reproduced.** `package com . example;` + `public class Ws {}` produces:
  ```json
  {"id":"class:com . example.Ws","kind":"class","packagePath":"com . example","directoryPath":"","definedInFile":"file:Ws.java"}
  {"id":"file:Ws.java","kind":"file","packagePath":"com . example","directoryPath":""}
  ```
- Mechanism: `normalizeTypeText` (`ast-extractor.ts:179-181`) is `replace(/\s+/g, " ").trim()` — it
  *collapses* whitespace but never *removes* it, and dots are never re-joined from the identifier
  segments (`readPackagePath` `:188-199`, `collectReferences` `:344-350`).
- The import side of the same defect drops edges: `import com . example . Helper;` yields
  `targetName "com . example . Helper"`, which cannot match symbol key `com.example.Helper`, so the
  reference is silently discarded (reproduced by the audit's stitcher pass; same code path).
- Comments are also preserved verbatim: `package com./*x*/example;` → `packagePath "com./*x*/example"`.

### Root cause
Qualified names are reconstructed by *text extraction* instead of by *structural traversal*. A
`scoped_identifier` is a tree of `identifier` children; joining those children with `.` is exact,
whereas reading the span reproduces whatever trivia the author wrote.

### Why it matters
- Violates R3.7, which requires recording the declared package "as its dotted package name".
- It leaks past the parser into the algorithm: `primaryRegionOfFile` (`packages/core/src/regions.ts:28-32`)
  keys Regions as `pkg:${packagePath}`, so files in the *same* Java package split into
  `pkg:com.example` and `pkg:com . example` — two Regions, each smaller and more likely to be
  degenerate, directly perturbing the preserve-vs-reconstruct decision the project is built to study.
- The corrupted string also enters every class/function id in the file, so identity is
  formatting-dependent (same family as Gap 6).

### Why it is NOT fatal (and costs no core rework)
Rare formatting; no crash, no wrong output on conventionally formatted code, and the contract shape is
unchanged. Parser-only fix.

### Fix direction
Build qualified names structurally: walk the `scoped_identifier`'s `identifier` descendants in source
order and join with a literal `"."`; apply the same routine to package declarations, import names, and
(later) type references, so one helper guarantees dotted-name canonicality everywhere. Keep
`normalizeTypeText` for *type* text only, where interior spacing is meaningful to render.

### Edge cases covered
`package com . example;`; `package com./*c*/example;`; multi-line package declaration; annotated
package declaration in `package-info.java`; `import com . example . Foo;`; wildcard with spaces
(`import com . example . *;`); single-segment package; default package (no declaration).

### Open questions
1. Should a whitespace-bearing qualified name additionally be *normalized on read* in `packages/core`
   as a defensive measure (so a stale `graph.json` still groups sanely), or is parser-side
   canonicalization plus a re-parse sufficient? (Contract purity argues for parser-only.)
2. Is it worth a property test asserting "packagePath matches `/^[\w$]+(\.[\w$]+)*$/` or is empty"
   as a serializer-level contract invariant?

---

## Gap 8 — In-project references the symbol table cannot express are silently dropped: nested-type, wildcard and static-member imports

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/parser/src/symbol-table.ts` · `packages/parser/src/stitcher.ts` · `packages/parser/src/ast-extractor.ts`
- **Severity:** High — genuine, resolvable, in-project dependencies are discarded, so the dependency
  graph is systematically incomplete on ordinary Java.

### The issue in one line
Three common import forms name targets that exist in the graph but can never match a symbol-table
key, so the stitcher drops them exactly as if the target were outside the project.

### Evidence (measured, not assumed)
All reproduced with the parser CLI; edge counts are from the emitted `graph.json`:
- **Nested-type import → 0 edges.** `import com.example.Outer.Inner;` produces **no** edge even though
  `class:com.example.Outer$Inner` **is** in the node set. A plain `import com.example.Outer;` in a
  sibling file *does* produce its edge (1 edge total for the fixture), isolating the cause.
  The symbol table keys the nested class from its id, i.e. `com.example.Outer$Inner`
  (`symbol-table.ts:67-69` + `ids.ts:104`), while the import is recorded dotted as written
  (`ast-extractor.ts:344-356`); `lookup` misses (`stitcher.ts:133-135`).
- **Wildcard import → 0 edges.** `import com.example.*;` with an in-project `Helper` used in the file:
  the recorded `targetName` keeps its `.*` suffix (`ast-extractor.ts:354`), which matches no key.
- **Static-member import → 0 edges.** `import static com.example.Helper.help;` resolves through the
  *function* key to a `function` node, which `resolveEndpoints` then discards under the R5.2
  no-function-endpoint rule (`stitcher.ts:144-148`) — and **no edge to the enclosing class `Helper` is
  created instead**, so a real file→class dependency vanishes.

### Root cause
Resolution is a single exact-match lookup against one flat FQN→node map. It has no
form-normalization (dotted vs `$` binary name), no expansion strategy (wildcards), and no
"map the resolved target up to an edge-legal granularity" step — although the design states exactly
that principle for the *source* side ("the referencing entity is mapped up to its file/class scope",
parser design.md:291) and never applies it to the target.

### Why it matters
- Nested types (builders, `Entry`-style members, nested DTOs), wildcard imports (pervasive in older
  and enterprise codebases), and static imports of constants/helpers are all everyday Java. Each
  occurrence silently deletes a true edge, so cohesion, coupling, blast radius, and every
  preserve-vs-reconstruct decision are computed on an under-connected graph.
- **This deepens Gap 1's symptom (too few edges → cohesion 0 → always reconstruct) but is a distinct
  root cause and needs a distinct fix.** Gap 1 is about reference *kinds never collected*
  (type-use, method-call, same-package refs carry no import at all). This gap is about references that
  **are** collected and **do** have an in-project target, and are lost in *resolution*. Fixing Gap 1
  alone would leave these three forms broken; fixing this alone would not make the preserve branch fire.

### Why it is NOT fatal (and costs no core rework)
Additive: it only ever *adds* edges that should have existed. The contract is unchanged (still
`(source, target)` + three signals), the algorithm consumes `strength` regardless, and determinism is
preserved as long as each new resolution rule is a pure, canonically-ordered function of the node set.

### Fix direction
- **Nested types:** on a lookup miss, deterministically retry the dotted name with trailing segments
  progressively re-joined as `$` (`p.A.B.C` → `p.A.B$C` → `p.A$B$C`), taking the first hit; or index
  each nested class under *both* its dotted and its `$` key at build time (cheaper, no retry loop).
- **Wildcards:** expand `p.*` to every symbol-table class whose key is `p.<simpleName>` with no
  further dot, in canonical order, minting one edge per resolved class; alternatively treat the
  wildcard as a package-level reference. Either way, specify it — the current drop is documented only
  in a code comment (`ast-extractor.ts:324-326`), and R5.4 authorizes dropping only names whose
  declaring entity is *not* in the project.
- **Static members:** when resolution lands on a `function` node, map it up to its enclosing `class`
  node (recoverable from the id prefix before `#`, or from `definedInFile`) rather than dropping the
  candidate; R5.2 forbids function *endpoints*, not the dependency itself. Also extract static *field*
  imports, which currently resolve to nothing because fields are not extracted at all.

### Edge cases covered
`import p.Outer.Inner;`; deeply nested (`p.A.B.C`); `import p.*;` where `p` is in-project vs external;
`import p.Outer.*;` (nested wildcard); `import static p.C.m;` (method) and `import static p.C.CONST;`
(field); `import static p.C.*;`; a static import whose member name is also a legal class name in a
package spelled like an FQN (cross-kind shadowing — the class key wins and would mint a *false* edge
to the wrong entity); self-import of one's own class (currently mints a redundant intra-file
file→own-class edge, since the same-node guard cannot fire).

### Open questions
1. Wildcard expansion inflates `importFrequency` fan-out — one statement becomes N edges. Is that the
   right semantics, or should a wildcard contribute a *single* weaker signal? This affects Claim B's
   cohesion numbers, so it should be decided before re-running the evaluation.
2. Do we index nested classes under both keys (simple, doubles table size) or retry on miss (no extra
   memory, adds a bounded loop)? Both are deterministic.
3. Should this bundle with Gap 1 into one `parser-signal-enrichment` spec? They touch the same three
   files and both must land before `broadleaf` yields a meaningful adaptive demo.

---

## Gap 9 — Algorithm configuration is unvalidated: a NaN boundary silently forces all-reconstruct and writes `null` into `metadata.json`, which the engine's own parser then rejects

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/orchestrator.ts` (`resolveConfig`) · `packages/core/src/constructor.ts` · `packages/core/src/assessor.ts` · `packages/core/src/weights.ts`
- **Severity:** High — silently inverts every preserve-vs-reconstruct decision (the project's central
  contribution) and emits an `index/` that fails its own round-trip guarantee, with no error anywhere.

### The issue in one line
`INVALID_CONFIG` validation exists only for the two hierarchy bounds; the boundary, metric weights,
weight coefficients, squash constant, degenerate score, and seed are accepted unchecked, so
non-finite or out-of-domain values corrupt the decisions and the audit record instead of being rejected.

### Evidence (measured, not assumed)
- **Reproduced** with `structuralQualityBoundary: NaN` on a 3-file graph:
  ```
  groupGraph ok: true
  actions: reconstruct,reconstruct            ← every region, regardless of score
  write ok: true
  metadata.json boundary field: null | confidence: null
  round-trip parseIndex ok: false {"code":"MALFORMED_FILE","file":"metadata.json","detail":"missing a required field"}
  ```
  Chain: `score >= NaN` is always `false` (`constructor.ts:33`) → automatic `reconstruct` everywhere;
  `decisionConfidence = Math.abs(score - NaN) = NaN` (`constructor.ts:66`); `stableStringify` delegates
  numbers to `JSON.stringify`, which renders non-finite values as `null` (`canonical.ts:84-86`,
  confirmed: `stableStringify({v:NaN})` → `{"v":null}`); `parseIndex` then requires
  `typeof … === "number"` and rejects (`index-parser.ts:206-231`).
- `resolveConfig` (`orchestrator.ts:65-78`) performs deep merging and **no** validation.
  `validateHierarchyConfig` (`hierarchy-builder.ts:42-60`) is the only validator in the package, and it
  runs inside `buildHierarchy` — the *fifth* stage, after seeded Louvain has already executed.
- Adjacent unvalidated knobs confirmed by the audit's assessor/orchestrator passes (reasoned from code,
  several reproduced there): negative `importCoefficient` clamps every strength to 0 (`weights.ts:51-54`)
  → all regions score exactly 0.5 → everything *preserved* with confidence 0; all-zero or negative
  metric weights make every region score 0 → everything reconstructed; `cohesionSquashConstant` of 0
  makes `cohesion_norm` binary (`cohesion/cohesion = 1`), and a negative k is non-monotonic (the same
  region scores 1.0 at k=-0.4 and 0.0 at k=-0.5); `degenerateScore: 7` is clamped to 1.0 so degenerate
  regions *preserve* at any boundary, inverting the documented intent; a non-integer or NaN seed is
  silently coerced by `seed >>> 0` (`community.ts:45`), so NaN aliases to seed 0 and 1.5 to 1.

### Root cause
The design treats these as "externally configurable parameters" (Req 3.6/3.7, 4.4) but never assigns
them a validated domain, and the implementation mirrors that: only the two knobs whose bounds the
requirements state numerically (Req 6.6, 6.8) got a validator. Everything else relies on
`clamp01`/finiteness guards *deep inside* the metric code, which convert bad configuration into
*plausible-looking wrong answers* rather than errors.

### Why it matters
- The preserve-vs-reconstruct decision **is** the research contribution. A configuration typo that
  silently flips every decision — while `metadata.json` records `null` for the very parameter whose
  sensitivity the paper analyzes — is the most damaging possible failure for the evaluation.
- It breaks Req 5.5 (record the boundary *used*), Req 5.7 (replaying recorded values reproduces the
  decisions — impossible from `null`), and Req 9.5 / Property 30 (round-trip fidelity), since
  `serializeIndex` reports success on output `parseIndex` refuses.
- Validation is *late* even where it exists, so an invalid hierarchy config still pays for a full
  assess + seeded-Louvain construct pass before failing.

### Why it is NOT fatal (and costs no core rework)
No contract change and no algorithm change: this is a gate added at `resolveConfig`, plus moving the
existing hierarchy validation earlier. Every downstream artifact keeps its shape; valid runs produce
byte-identical output to today.

### Fix direction
Add one `validateConfig(resolved): Result<GroupingConfig>` executed at the *top* of `groupGraph`,
before ingest, extending `INVALID_CONFIG` with the offending field and value:
- `structuralQualityBoundary`: finite; domain decided per the open question below.
- `weightCoefficients.*`, `assessment.weights.*`: finite and ≥ 0, with at least one weight > 0.
- `cohesionSquashConstant`: finite and > 0.
- `degenerateScore`: finite and within `[0, 1]`.
- `communityDetectionSeed`: a safe integer.
- Move `validateHierarchyConfig` into the same gate so all config errors are reported before any work.
Additionally make non-finite numbers unrepresentable in output: have `stableStringify` reject (or the
metadata builder assert) rather than silently emitting `null`, so this class of defect can never again
produce a self-rejecting index.

### Edge cases covered
Boundary NaN / ±Infinity / negative / > 1 / exactly 0 / exactly 1 / exactly equal to a score (tie →
preserve, per Property 12); negative and NaN weight coefficients; Infinity coefficient (`0 * Inf` → NaN
→ clamped 0); all-zero metric weights (renormalization divide-by-zero, currently guarded to score 0);
mixed-sign weights; `k = 0`, `k < 0`, `k = NaN`; `degenerateScore` outside `[0,1]` and NaN;
non-integer / NaN / negative / `> 2^32` seed; `maxGroupSize`/`minPartitionThreshold` out of bounds
(already handled, but late).

### Open questions
1. **What is the boundary's legal domain?** `demo-baselines.ts:47` deliberately uses `1.000001` to
   express the always-reconstruct baseline, so a naive `[0, 1]` check would break the Review-2 demo.
   Either allow a documented margin (e.g. `[-ε, 1+ε]` or any finite value) or switch the baseline to
   the design's sanctioned alternative — an all-`reconstruct` override map (design.md:628). The latter
   is cleaner and removes the only reason the boundary needs an extended domain.
2. Should out-of-domain configuration be a hard error, or a warning recorded in `metadata.json` so
   sensitivity sweeps can deliberately explore extreme values? (Hard error is more defensible for a
   determinism-first engine; sweeps can stay inside the legal domain.)
3. Unknown-key **overrides** are silently ignored today (`constructor.ts:48` only reads keys for
   existing regions), so a typo'd region id no-ops with no metadata trace — should the same gate reject
   override keys that match no Region?

---

## Gap 10 — The five-file `Index_File_Set` write is non-atomic: a mid-set failure leaves a mixed old/new index that `parseIndex` accepts as valid

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/index-serializer.ts` (`serializeIndex`) · `packages/core/src/index-parser.ts` (acceptance side)
- **Severity:** High — a failed re-index silently produces a *coherent-looking but internally
  contradictory* index that downstream consumers load without complaint.

### The issue in one line
`serializeIndex` writes the five files sequentially with `writeFileSync` and returns on the first
failure, so files already written are the new run's while the rest are the previous run's — and
`parseIndex` never cross-checks them, so the mixture parses successfully.

### Evidence (measured, not assumed)
**Reproduced.** Index the fixture, make `metadata.json` read-only, then re-index the same graph with a
different `maxGroupSize` (so the hierarchy genuinely changes):
```
run 1 (maxGroupSize 20): ok
  old metadata: nodeCount=38 depth=4 regions=4
run 2 (maxGroupSize 2) result: {"code":"WRITE_FAILED","file":"metadata.json"}
  files present after failed run: 5/5
  repository.json (NEW):  nodeCount=40 depth=5
  metadata.json  (STALE): nodeCount=38 depth=4
  parseIndex on mixed set: *** ACCEPTS incoherent index ***
```
- Write loop: `index-serializer.ts:86-92` — no staging, no temp+rename, no rollback, and
  `mkdirSync(dir, {recursive:true})` never cleans the directory.
- Acceptance side: `parseIndex` cross-checks only `nodes.json` length against `hierarchy.json`
  (`index-parser.ts:102-108`) and `repository.json`'s `repositoryId` against `hierarchy.json`
  (`:196-202`). `metadata.nodeCount` / `edgeCount` / `hierarchyDepth`, and `repository.json`'s own
  `nodeCount`/`edgeCount`, are read but **never** compared to the parsed hierarchy (`:204-246`).
- `metadata.json` is written **last** (`INDEX_FILE_NAMES` order, `:15-21`), which makes
  "new hierarchy + previous run's decisions and boundary" the single most likely mixed state.

### Root cause
The parser got an atomic write (serialize fully in memory → temp file in the same directory →
`fs.rename`, `packages/parser/src/serializer.ts:249-281`) because R8.4/R8.5/R10.6 demanded it
explicitly. The grouping spec's Req 9.8 asks only for "an error message identifying the file that
could not be written", so the implementation stopped there — even though the design states the
cross-cutting rule that a failing stage "produces no partial output" (grouping design.md:568). The
acceptance side then has no defence because none of the redundant counts are treated as checkable
invariants.

### Why it matters
- The realistic trigger is routine: re-running `npm run group` into the default `<project>/index`
  directory (`group-cli.ts:33-34`) after a code or config change, with any write failure (disk full,
  read-only file, permissions, interrupted run).
- The result is worse than a crash: a viewer, an AI agent, or the paper's evaluation scripts read a
  hierarchy whose recorded boundary, per-region decisions, confidences, and scalability statistics
  describe a **different hierarchy**. Every number in `metadata.json` — the audit record the research
  claim rests on — can silently belong to a previous run.
- It also violates the engine-wide guarantee the parser upholds, so the two halves of the pipeline give
  different durability promises for the same class of failure.

### Why it is NOT fatal (and costs no contract rework)
File *shapes* are unchanged; only the write mechanism and a few read-side assertions change. Successful
runs produce byte-identical output, so no consumer, artifact, or determinism digest is affected.

### Fix direction
Mirror the parser's proven approach, extended to a set:
1. Serialize all five payloads to strings **in memory** first (already effectively done by
   `indexFilePayloads`), so a serialization error writes nothing.
2. Write them into a temp sibling directory (`index.tmp-<content-digest>`), then promote atomically —
   `rename` the temp directory over the target after removing the old one, or write then `rename` each
   file individually only after *all* temp writes succeeded. On any failure, remove the temp directory
   and leave the previous `index/` byte-for-byte intact.
3. Add the cheap read-side invariants that would have caught it: assert `metadata.nodeCount`,
   `edgeCount`, `hierarchyDepth`, `totalCrossGroupEdges` and the `perLevel` sums against the parsed
   hierarchy, and `repository.json`'s counts too — a stale-metadata mixture then fails loudly.

### Edge cases covered
Failure on file 1 / 3 / 5 of 5; failure with no pre-existing index (partial fresh set left behind);
failure over an existing index (mixed set); `mkdir` failure; output path exists as a file; read-only
target file; foreign files already in the index directory; two concurrent `group` runs targeting one
directory; successful re-index over an index with *more* files than the new run produces.

### Open questions
1. Directory-level `rename` is atomic on POSIX but needs the old directory moved aside first (a brief
   window with no `index/`), whereas per-file promotion after all-temp-writes-succeed has a tiny
   non-atomic window but never leaves the directory absent. Which durability trade-off do we want?
2. Should `group` **clean** unknown files from the index directory on success (guaranteeing the
   directory *is* the index) or leave foreign files alone (safer for a user-chosen output path)?
3. Should the read-side count assertions be errors (`MALFORMED_FILE`) or warnings, given that a
   hand-authored index for testing may legitimately carry approximate metadata?

---

## Gap 11 — `parseIndex` accepts a containment cycle and `analyzeBlastRadius` then never terminates

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/index-parser.ts` (validation) · `packages/core/src/blast-radius.ts` (ancestor climb)
- **Severity:** High — a corrupted or hand-edited `index/` hangs the analyzer in an infinite loop
  instead of returning an error, directly contradicting Req 10.7.

### The issue in one line
`parseIndex`'s referential-integrity checks are *pairwise* and a containment cycle is pairwise
consistent, so a cycle parses as a valid `Hierarchy`; `analyzeBlastRadius`'s containing-groups walk
then climbs `parentId` forever.

### Evidence (measured, not assumed)
**Reproduced.** A hand-built index whose `hierarchy.json` contains a mutually-parented group pair
(`g_A.parentId = g_B`, `g_A.childIds = [g_B]`, `g_B.parentId = g_A`, `g_B.childIds = [g_A]`, plus a
childless `r_root`):
```
parseIndex accepts containment cycle: true
calling analyzeBlastRadius('g_A') ...
[terminated by `timeout 8` — exit code 124, never returned]
```
- Why it validates: `index-parser.ts:70-95` asserts each `parentId` exists and each child's
  `parentId` points back at the listing parent. A 2-cycle satisfies both, as does a self-parent node
  (`{id:X, parentId:X, childIds:[X]}`). There is no cycle check, no level-monotonicity check
  (`child.level === parent.level + 1`), and no assertion that all nodes are reachable from
  `repositoryId`.
- Why it hangs: the dependency-edge BFS *is* cycle-safe via a `visited` set
  (`blast-radius.ts:45-55`), but the separate ancestor climb — `while (node && node.parentId !== null)`
  (`:58-67`) — has **no** visited set and trusts the containment tree to be acyclic.
- Adjacent acceptance holes found in the same pass (reasoned from code): a second node with
  `parentId: null` (multiple roots / forest) is accepted; `kind` is only checked to be a string, so
  `"banana"` passes and is cast (`:48`, `:61`); the parent-side of membership is unverified (a node may
  claim `parentId: P` while `P.childIds` omits it, making it invisible to top-down traversal despite the
  code comment claiming links "agree in both directions"); duplicate ids inside a `childIds` array are
  accepted and double-count in `averageBranchingFactor`; a leaf entry missing `directoryPath` is
  silently defaulted to `""` (`:127`) rather than failing per Req 9.7.

### Root cause
Two independent omissions that compose into a hang: the parser validates *local* link consistency but
never the *global* tree property it is reconstructing (single-rooted, acyclic, fully reachable), and
the analyzer's second traversal was written without the cycle guard its first traversal has — because
both were reasoned about under the assumption that a `Hierarchy` value always came from
`buildHierarchy`, where acyclicity is structural.

### Why it matters
- `index/*.json` is untrusted disk input by design (Req 9.5's whole point is that it round-trips), and
  Req 10.7 explicitly promises termination on cyclic input. An unbounded loop is the one failure mode a
  batch tool must never have — the process must be killed externally.
- The same trust assumption will be inherited by every future consumer: the Phase-3 viewer, an MCP
  server, and the Neo4j loader would each hang or mis-render on the same input.
- Property 19 (single-rooted, acyclic tree) is asserted only for builder output, never on parse, so the
  test suite cannot catch it.

### Why it is NOT fatal (and costs no contract rework)
Nothing changes in the file shapes or the happy path; this is added validation plus a visited set.
Well-formed indexes parse and analyze exactly as today.

### Fix direction
- **Parser:** after building the node map, validate the *global* tree once —
  exactly one node with `parentId: null`, it equals `repositoryId`, `repositoryId` exists in the node
  set, every node is reachable from it, child levels are `parent.level + 1`, `childIds` have no
  duplicates and are canonically sorted (Req 7.5 is a checkable invariant on read), and the
  parent-side of membership agrees. A single BFS from the root gives cycle-freedom, reachability, and
  level monotonicity together, in linear time. Validate `kind` against the enum.
- **Analyzer:** give the ancestor climb its own `visited` set and bail out (or return
  `MALFORMED_FILE`/`NODE_NOT_FOUND`-class error) on revisit — defence in depth, so a future
  hand-constructed `Hierarchy` can never hang it regardless of how it was obtained.

### Edge cases covered
Self-parent node; two-node parent cycle; longer cycles; cycle not reachable from the root; multiple
roots / forest; `repositoryId` naming a node absent from the set (a consistent "ghost" id in both files
is accepted today); `kind: "banana"`; kind disagreeing between `hierarchy.json` and `nodes.json`;
duplicate ids in `childIds`; unsorted `childIds`; negative or fractional `level` / `hierarchyDepth`;
leaf entry missing `directoryPath`; blast-radius query targeting a group node, a function node, and a
node with no incoming edges.

### Open questions
1. Should the analyzer *also* be hardened, or is parser-side validation sufficient? (Both, in my view:
   `analyzeBlastRadius` is exported and accepts any `Hierarchy` value, so it cannot assume provenance.)
2. Req 9.7 says an error must name the affected file — for a *cross-file* inconsistency (e.g. a cycle
   spanning entries, or a metadata/hierarchy count mismatch), which file is "affected"? The spec needs
   a rule; `hierarchy.json` as the structural authority is the natural answer.
3. How strict should read-back validation be overall? Full re-validation makes `parseIndex` a
   near-duplicate of the builder's invariants — worth it for an untrusted seam, but it is real review
   cost and must not diverge from the builder over time (shared invariant helpers would prevent drift).

---

## Gap 12 — `Group_Node`s carry no label or Region provenance, so the Phase-3 viewer cannot name, group, or colour anything above the file level

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/index-serializer.ts` (`indexFilePayloads`) · `packages/core/src/hierarchy-builder.ts` · `packages/core/src/metadata.ts`
- **Severity:** High for Review 3 — a viewer blocker: the semantic-zoom viewer's primary visual
  elements would be unlabelled 40-hex hashes.

### The issue in one line
Every non-leaf node is emitted as `{id, kind, level}` only, and nothing anywhere in the five index
files maps a `Group_Node` back to the Region (package) it was built from — so a viewer has no
human-readable name, and no package/region attribute to colour or filter by, for any group.

### Evidence (measured, not assumed)
**Reproduced** on `fixtures/sample-java-project` (`node packages/core/dist/group-cli.js … <out>`), read
back from the emitted files:
```
group/repo entries in nodes.json (first 3):
  {"id":"g_3189baf1dcbe7ef75bc07309f67d7e58e23f2dbc","kind":"group","level":2}
  {"id":"g_4cb63adbb082c44d58270e5586612e7b9428cbda","kind":"group","level":2}
  {"id":"g_82057fc1c11b118af8473d6abe12e4aff2d73ec8","kind":"group","level":1}
total group/repo: 9 | leaf: 29
metadata regionDecisions regionIds: pkg:com.example, pkg:com.example.app, pkg:com.example.model, pkg:com.example.service
any field anywhere linking a group id to a regionId? NO
```
- `nodes.json` enriches an entry only from `hierarchy.leafAttributes`, which holds *input* graph nodes
  (`index-serializer.ts:47-57`); group ids are absent from it, so `packagePath`/`directoryPath` are
  omitted for every group.
- `hierarchy.json` carries only `{id, kind, level, parentId, childIds}` (`:36-45`).
- `metadata.json` records `regionDecisions` keyed by `regionId` (`pkg:com.example`, …), but
  `buildHierarchy` discards the region→group association: `level2IdsOfRegion` is local
  (`hierarchy-builder.ts:96-107`) and the emitted Level-1 group is a content hash of its Level-2
  children, retaining no region key.
- Related fan-out finding from the same run: a `file` node's children (its classes and methods) are
  **not** size-bounded — `User.java` already has 8, and `maxGroupSize` is applied only to
  `Group_Node`s. Req 11.1 speaks of Group_Nodes, so this is spec-compliant, but it breaks the viewer's
  "never render more than ~20 at once" property at the file level for any large class.

### Root cause
The index format was specified from the *algorithm's* point of view — Req 9 enumerates what must be
*written* (nodes, edges, decisions, counts) — and no requirement states that a group must be
*identifiable to a human*. Content-addressed ids (Req 7.3) then deliberately strip provenance, which is
correct for identity and unhelpful for display, and nothing was added to carry display data alongside.

### Why it matters
- Review 3's deliverable is a semantic-zoom viewer rendering roughly one hierarchy level at a time.
  At Level 1 and Level 2 *every* node is a group, so with today's index the viewer can only draw
  `g_3189baf1…` boxes. There is no fallback: the label cannot be derived, because the mapping does not
  exist in the data.
- Colouring/filtering by package, showing "this group came from `com.example.service` and was
  *reconstructed* with score 0.31", and the whole audit story that makes the adaptive contribution
  *visible* all require the same missing link.
- Gap 2's fix direction already warns that disambiguated ids get long and ugly and that "the viewer
  renders the human label from `packagePath` + simple name, not the raw ID" — that guidance works for
  *leaves* (which do carry `packagePath`) and silently fails for *groups*.

### Why it is NOT fatal (and does not disturb the algorithm)
Purely additive to the output: new fields on existing nodes, or one new mapping section. No identity
change, no hierarchy-shape change, no determinism impact (all added values are pure functions of
already-deterministic data), and no change to how any decision is computed.

### Fix direction
Carry provenance and display data through the builder into the index, as pure derived data:
- Add `regionId` to each Level-1 group (and propagate it to its Level-2 descendants) by keeping the
  association `buildHierarchy` already computes internally, emitting it in `nodes.json`.
- Add a deterministic `label` (and optionally `labelDetail`) per group: for a preserved region, the
  package's last segment or the full `packagePath`; for a reconstructed region, the package plus a
  content-derived community index (`com.example.service #2`); for a size-partitioned slice, a
  deterministic ordinal suffix. Labels are display-only and must never feed identity.
- Add `groupIds` (or `level1GroupId`) to each `regionDecisions` entry so the audit record and the tree
  are joinable in both directions.
- Consider bounding file-level fan-out too (see the open question), or document that the viewer must
  paginate a file's members.

### Edge cases covered
A preserved region → one group; a reconstructed region → several communities needing distinct labels; a
region split by `maxGroupSize` partitioning → sibling slices needing distinct labels; intermediate
Repository-wrapping levels that correspond to *no* region (label must degrade gracefully); a
default-package region (`dir:` prefix rather than `pkg:`); two regions whose last package segment is
identical (`a.util` vs `b.util` → labels must stay distinguishable); a file node with many members.

### Open questions
1. **Do labels belong in the engine or the viewer?** Deriving `label` in `packages/core` puts a
   presentation concern in the engine; emitting only `regionId` keeps the engine pure and lets the
   viewer compose the label. The second is cleaner on the engine/ecosystem line — but the
   *reconstructed-community* and *partition-slice* cases need a deterministic ordinal the viewer cannot
   derive on its own, so at minimum that ordinal must be emitted.
2. Should file-level fan-out be bounded by `maxGroupSize` too (introducing intra-file grouping levels
   and changing hierarchy depth), or is viewer-side pagination the right answer? This is the one part
   of the fix that could change node counts and depth, so it needs an explicit decision.
3. Should this be promoted into the Review-3 `packages/web` spec as a *prerequisite* index-format
   change, so the viewer is never built against an index that cannot label its own groups?

---

## Gap 13 — `graph.json` field types are never validated at ingest: malformed signals are silently coerced, and string signals on parallel edges make output input-order-dependent

- **Status:** Open — to be brainstormed.
- **Issue class:** correctness + **determinism** (the project's one hard requirement).
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/orchestrator.ts` (`readGraphFile`) · `packages/core/src/ingestor.ts` · `packages/core/src/canonical.ts` (`compareDependencyEdges`) · `packages/core/src/weights.ts`
- **Severity:** High — a wrongly-typed signal in an untrusted `graph.json` makes `edges.json`
  depend on input ordering, breaking Requirement 7.2 outright.

### The issue in one line
`readGraphFile` blind-casts `JSON.parse` output to `RawDependencyGraph` and `ingest` validates only
ids/endpoints/`definedInFile`, so wrongly-typed fields flow into the algorithm — and because
`compareDependencyEdges` tie-breaks with numeric subtraction, string-valued signals produce `NaN`
comparisons that leave parallel edges in *input order*.

### Evidence (measured, not assumed)
- **Reproduced — determinism violation.** Two parallel edges between the same pair with signals
  `"a"` and `"b"`; grouping the same graph with the two edges in each order yields **different**
  `edges.json` bytes:
  ```
  forward order digest-equal to reversed order: false
  forward:  leafEdges[0].importFrequency = "a"
  reversed: leafEdges[0].importFrequency = "b"
  ```
  Mechanism: `compareDependencyEdges` (`canonical.ts:48-54`) falls through
  `a.importFrequency - b.importFrequency`; `"a" - "b"` is `NaN`, which is falsy, so the `||` chain
  returns 0 and `Array.prototype.sort`'s stability preserves input position. This defeats the very
  full-content comparator that was added (per the 2026-07-25 decisions log, item 2) to guarantee
  order-independence for parallel edges.
- **Reproduced — silent coercion at ingest** (`ingest` returns `ok` in every case; `strength` is what
  `computeWeights` then produced):
  | `importFrequency` | ingest | resulting `strength` |
  |---|---|---|
  | `"5"` (string) | ok | **5** — silently coerced and used |
  | `"abc"` | ok | 0 |
  | `-7` | ok | 0 |
  | `2.5` | ok | **2.5** — fractional, contract says integer |
  | missing / `null` / `Infinity` | ok | 0 |
- **Reproduced — node-shape holes:** `kind: "banana"` accepted; empty-string `id` accepted (the shared
  contract requires "unique, **non-empty**"); a `file` node missing `directoryPath` yields Region id
  `dir:undefined` (`regions.ts:31` interpolates `undefined`), which string-collides with a real
  directory named `undefined`.
- `readGraphFile`: `JSON.parse(text) as RawDependencyGraph` (`orchestrator.ts:154`) — a pure cast, no
  runtime check. `ingest` inspects only `Array.isArray`, id duplication, endpoint existence, and the
  `definedInFile` invariant (`ingestor.ts:17-75`).

### Root cause
The TypeScript type `RawDependencyGraph` is treated as a validated contract, but it is only a
*compile-time* assertion; at the disk seam it is a lie. The ingest gate was designed around the three
*structural* defects the spec enumerates (Req 1.2, 1.3, 1.5) and no requirement asks for field-type
validation, so the graph's own contract invariants — non-empty id, `kind` in the enum, signals are
finite non-negative integers, `directoryPath` present — are enforced nowhere on the read side. The
determinism hole then follows mechanically from arithmetic comparison of non-numbers.

### Why it matters
- **`graph.json` is the engine's stable seam and an untrusted file.** It is hand-authored today
  (`fixtures/mixed-quality-graph.json` is the sanctioned synthetic fixture the adaptive demo depends
  on), and will be produced by future language front-ends and consumed after manual edits. Nothing
  guarantees a producer honors the contract.
- Determinism is the project's headline property and the basis of its reproducibility claim; a
  demonstrable input-ordering dependence — however exotic the trigger — is the finding that most
  directly threatens it. The parser cannot emit such a graph today, which is precisely why the hole
  survived a green 33-property suite.
- Silent coercion is worse than rejection for research integrity: `"5"` becoming strength 5 means a
  malformed file *appears* to work while the audit trail records numbers nobody can reproduce.

### Why it is NOT fatal (and costs no contract rework)
The contract *shape* is already correct — this adds enforcement of invariants the contract already
states. Conforming graphs (everything the parser produces) validate and produce byte-identical output.
Ingest already returns structured errors, so the fix reuses the existing seam.

### Fix direction
- **Validate the element shapes at the ingest gate**, extending `GroupingError` with a
  `MALFORMED_NODE` / `MALFORMED_EDGE` (or reusing `MALFORMED_FILE` with a detail) that names the
  offending id and field: `id` a non-empty string; `kind` in the enum; `directoryPath` a string;
  `packagePath` a string when present; each signal `Number.isInteger` and `>= 0`; `strength` finite and
  `>= 0` when present. Run it before the duplicate/dangling checks so the atomic-rejection order stays
  well-defined, and reject `null`/non-object elements here (which also closes Gap 3's core throw path).
- **Make the comparator total regardless of input**: compare signals with a NaN-safe numeric
  comparator (or compare their canonical string renderings) so two content-different parallel edges can
  never tie. Even after validation this is worth doing as defence in depth, since the comparator is
  also reachable through the library API.
- Decide the policy for **parallel duplicate edges** at the same time (Gap 15) — validation is the
  natural place to reject or fold them.

### Edge cases covered
Signals as string / fractional / negative / `NaN` / `Infinity` / missing / `null` / boolean;
`strength` pre-populated on input (contract-legal, currently overwritten); empty-string and missing
`id`; numeric `id` (`5`) coexisting with `"5"` — Map-keyed duplicate detection distinguishes them but
graphology coerces both to `"5"` and throws; unknown and reserved `kind`; missing/non-string
`directoryPath` and `packagePath`; `file` node carrying `definedInFile` (contract says omitted;
currently accepted unflagged); `__proto__` as a node id; parallel edges with identical vs differing
content.

### Open questions
1. Reject or **repair**? Rejecting a fractional/negative signal is the honest choice for an engine whose
   output is evidence; repairing (clamping) keeps a slightly-off producer working. Rejection is
   consistent with Req 1's atomic posture.
2. Should validation live in `packages/core`'s ingest, or in a shared `validateRawGraph` helper in
   `packages/shared` that the **parser's serializer also runs** before writing (catching Gap 5's
   duplicate ids and any future producer's mistakes at the point of production)? A shared validator is
   more future-proof for multi-language front-ends but puts logic in the contract package, which has
   deliberately held types only.
3. Does the fractional-signal case interact with Gap 1's planned richer signals (could a future
   `methodCallFrequency` legitimately be fractional, e.g. a normalized frequency)? If so the contract's
   "non-negative integer" wording needs revisiting *before* validation hard-codes it.

---

## Gap 14 — Contract-legal `group`/`repository` nodes are silently dropped from the hierarchy while `edges.json` keeps referencing them

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/hierarchy-builder.ts` · `packages/core/src/regions.ts` (`owningFileOf`) · `packages/core/src/ingestor.ts`
- **Severity:** Medium — produces a self-inconsistent `index/` that the engine's own `parseIndex` would
  reject, with no error at write time.

### The issue in one line
`NodeKind` legally includes `group` and `repository`, so such nodes pass ingest, but the builder only
places `file` nodes (via Regions) and their `definedInFile` members — everything else vanishes from
`hierarchy.json`/`nodes.json` while its edges remain in `edges.json`.

### Evidence (measured, not assumed)
**Reproduced.** Input of two files plus one `{id:"grp:X", kind:"group", directoryPath:"x"}` node and an
edge `file:A → grp:X`:
```
groupGraph ok: true
'grp:X' in hierarchy.json/nodes.json: false / false | referenced by edges.json: true
=> self-inconsistent index: true
```
- `ingest` applies the `definedInFile` gate only to `class`/`function` kinds
  (`ingestor.ts:50-51`), so a `group` node is accepted and loaded per Req 1.1/1.4.
- `assignRegions` iterates only `kind === "file"` (`regions.ts:39-41`) and `owningFileOf` returns
  `null` for a `group` node (`:65-72`), so its edges are invisible to cohesion, coupling, and
  modularity as well.
- `buildHierarchy` creates leaf entries only for group children and `definedInFile` members
  (`hierarchy-builder.ts:139-176`), while `leafEdges = model.weightedEdges` keeps **every** input edge
  (`:203`), so `edges.json` references an id no other file contains. `parseIndex` explicitly rejects
  that (`index-parser.ts:150-156`), so `group` writes an index its own parser refuses.
- Degenerate variant: a graph with **zero** `file` nodes succeeds and emits a single childless
  repository node (`repositoryIdOf([])` is well-defined), reflecting none of the input.

### Root cause
`packages/shared`'s `NodeKind` is a single union serving both the parser's *input* vocabulary
(`file|class|function`) and the grouping algorithm's *output* vocabulary (`group|repository`). Nothing
narrows it at the ingest seam, so kinds that are meaningless as *input* are structurally valid, and
every later stage silently filters them out rather than rejecting them.

### Why it matters
- The parser never emits these kinds, so this is unreachable from the real pipeline today — but the
  contract permits it, an index file could be fed back in as a graph, and future producers (multi-language
  front-ends, an incremental re-indexer that round-trips its own output) plausibly would.
- The failure is silent and its symptom appears far away: `edges.json` gains a dangling reference and
  Req 8.1 ("retain **every** dependency edge between its original Leaf_Node endpoints") is technically
  satisfied while the endpoints no longer exist as nodes.

### Why it is NOT fatal (and costs no contract rework)
Unreachable from the parser; the shape of every file is unchanged; conforming input behaves identically.
The fix is a validation narrowing plus (optionally) a Req 1 clarification.

### Fix direction
Narrow the accepted input kinds at the ingest gate — reject `group`/`repository` (and unknown kinds)
with a structured error naming the id — folding it into Gap 13's element-shape validation, which
already needs to check `kind`. Separately, require at least one `file` node so the zero-file case cannot
silently produce a one-node index. Optionally split the shared type into `RawNodeKind`
(`file|class|function`) and `HierarchyNodeKind` (adds `group|repository`) so the *type system* enforces
the seam — a contract-package change that stays type-only and breaks no on-disk shape.

### Edge cases covered
`group` / `repository` / unknown kind in input; a graph with zero `file` nodes; edges touching a
dropped node (the group-level representation is also silently lost — `ancestorPath` returns `null` and
`aggregateCrossGroupEdges` skips it); a `class` node whose `definedInFile` names a valid file (kept) vs
a dropped node.

### Open questions
1. Reject, or accept-and-place? A `group`-kind input node *could* be interpreted as a pre-existing
   grouping hint (relevant to a future incremental mode). Rejecting now is simpler and reversible;
   accepting requires specifying its semantics.
2. Should `packages/shared` split the kind union (type-level enforcement, touches the contract file) or
   should the narrowing live only in `ingest` (contract untouched)? The split is more future-proof and
   still changes no serialized bytes.

---

## Gap 15 — Parallel duplicate edges are accepted and double-counted, inflating cohesion and flipping the preserve decision

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/ingestor.ts` · `packages/core/src/assessor.ts` · `packages/core/src/hierarchy-builder.ts` (`aggregateCrossGroupEdges`)
- **Severity:** Medium — silently doubles a structural-quality input, and the score drives the
  project's central decision.

### The issue in one line
Ingest loads two edges with the same `(source, target)` as two distinct edges, and the assessor sums
their strengths independently, so a duplicated edge inflates the region's Cohesion.

### Evidence (measured, not assumed)
**Reproduced.** A 3-file graph where the edge `file:a/A.java → file:a/B.java` (`importFrequency: 3`)
appears **twice**:
```
ingest ok: true | edges loaded: 2
p.a cohesion (single edge would be 1.5): 3
```
- `ingest` uses a `MultiDirectedGraph` and performs no `(source,target)` de-duplication
  (`ingestor.ts:79-85`); Req 1.4 in fact *requires* preserving the input edge set exactly.
- `assess` accumulates per edge (`assessor.ts:71-98`), so both copies contribute; the same doubling
  flows into `coupling`, into the modularity projection (which *does* fold parallel edges by
  accumulating weight — `:192-201`, an inconsistency in itself), into `reconstructRegion`'s subgraph
  (`constructor.ts:86-104`), and into `Cross_Group_Edge` weights (`hierarchy-builder.ts:290-302`).
- Doubling cohesion moves the score: with default weights a region at cohesion 1.5 scores
  `0.4·(1.5/2.5)/0.8 + 0.4·1/0.8 = 0.80`, at cohesion 3 it scores `0.4·(3/4)/0.8 + 0.5 = 0.875` — enough
  to cross a boundary calibrated between them.

### Root cause
The parser guarantees at most one edge per ordered pair (R5.3), so the algorithm was built assuming a
simple graph, but the *contract* does not state that invariant and ingest deliberately preserves the
input edge multiset (Req 1.4). Nobody owns the "collapse parallel edges" step: the parser does it for
its own output, and the core assumes it was done.

### Why it matters
- Hand-authored graphs are load-bearing here: `fixtures/mixed-quality-graph.json` is the sanctioned
  synthetic fixture that demonstrates the adaptive decision, and a duplicated line in such a file would
  silently change the demo's scores.
- It is a wrong-answer-not-crash failure in the one number the research claim rests on, and there is no
  diagnostic.
- The modularity projection folding parallel edges while cohesion does not means the two metrics
  disagree about the same graph.

### Why it is NOT fatal (and costs no contract rework)
Unreachable from parser output; conforming input is unaffected. The contract's `edges` array shape does
not change under either fix.

### Fix direction
Decide and document one policy, then enforce it in one place:
- **Preferred:** reject parallel duplicates at the ingest gate (with a structured error naming the
  pair), consistent with how duplicate *node* ids are treated and with the contract's implied
  simple-graph model — and add the invariant to the contract's documentation so producers know.
- **Alternative:** fold them deterministically at ingest by summing the three signals into one edge,
  which is lenient and matches the modularity projection's existing behaviour, but silently rewrites the
  input and would contradict Req 1.4's "no additions and no removals".
Either way, fix the assessor/projection inconsistency so all metrics see the same graph.

### Edge cases covered
Two identical edges; two edges with same endpoints but different signals (also the Gap 13 determinism
trigger); a self-loop duplicated; parallel edges in opposite directions (`A→B` and `B→A`, legitimately
distinct); parallel edges crossing a region boundary (double-counted coupling and doubled
`Cross_Group_Edge` weight).

### Open questions
1. Reject vs fold — and does folding conflict with Req 1.4 badly enough to need a spec amendment?
2. Should the contract be amended to state "at most one edge per ordered `(source, target)` pair" as an
   invariant producers must honor? That makes the parser's R5.3 a contract-level guarantee rather than a
   parser-local one, which helps every future front-end.

---

## Gap 16 — A reconstructed region whose intra-region edges all carry zero strength explodes into one singleton group per file

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/community.ts` (`LouvainCommunityDetector`) · `packages/core/src/assessor.ts` (degenerate rule)
- **Severity:** Medium — degenerate hierarchy shape (viewer-relevant), and a live hazard for the
  planned Gap 1 signal work.

### The issue in one line
Louvain's modularity deltas are `0/0 = NaN` when the subgraph's total edge weight is zero, so no node
ever moves and every file becomes its own community — while the assessor's degenerate rule does not
catch the case because it tests intra-edge *count*, not total *strength*.

### Evidence (measured, not assumed)
**Reproduced.** Six files in one package, five intra-region edges all with every signal `0` (hence
`strength 0`), boundary `0.6` to force reconstruction:
```
action: reconstruct  score: 0.5  | level-2 groups for 6 files: 6 | sizes: 1,1,1,1,1,1
=> singleton explosion: true
```
- The region is **not** degenerate: `assessor.ts:112` tests `intraCount === 0` (edge count), and five
  edges exist, so the region is scored normally — cohesion 0, coupling 0 → score 0.5 — rather than
  receiving the documented degenerate score.
- `detect` builds the graph, finds `graph.size = 5 > 0` and `nodeIds.length ≥ 2`, so it skips both
  degenerate guards (`community.ts:85-87`) and runs Louvain with total weight `M = 0`; the delta
  arithmetic yields `NaN`, and `NaN < 0` / tie-break comparisons are false, so no node relocates.
- Result: one community per node → one Level-2 `Group_Node` per file.

### Root cause
Two guards that each look sufficient leave a gap between them: the assessor's degenerate test is
count-based while the metric it protects is strength-based, and the detector's degenerate test is
`graph.size`-based rather than total-weight-based. A subgraph with edges but no *weight* satisfies both
"has structure" tests while carrying no signal for either algorithm to use.

### Why it matters
- **It is the natural failure mode of the Gap 1 fix.** The stitcher creates an accumulator for *any*
  resolved reference but increments a signal only for `kind === "import"` (`stitcher.ts:186-206`), so
  the moment type-use or method-call references start being collected, they will mint edges with all
  three signals at `0` — exactly this input, on real repositories, in the region-heavy reconstruct path
  Gap 1 says is universal today.
- A singleton-per-file Level 2 defeats the hierarchy's purpose and the viewer's semantic-zoom premise:
  expanding a group reveals one file, and the Level-2 node count equals the file count.
- Zero-weight edges also make a region score exactly 0.5, which sits on the default boundary (0.5) —
  the tie goes to *preserve*, so the same input flips between preserve and a singleton explosion under a
  tiny boundary change.

### Why it is NOT fatal (and costs no contract rework)
Not reachable from today's parser (every emitted edge has `importFrequency ≥ 1`). Output shapes are
unchanged; the fix is a guard plus a documented rule.

### Fix direction
- Make both degenerate tests **strength-aware**: treat a region whose total intra-region strength is 0
  as degenerate (Req 3.9's documented rule), and have `detect` return a single community when the
  subgraph's total weight is 0, matching its existing "no dependency signal to rebuild from" rationale
  for the edgeless case (`community.ts:59-62`).
- Fix the root cause upstream too: when the Gap 1 signal work lands, ensure no edge is ever emitted with
  all three signals at zero (either omit it or give the reference kind its own non-zero count).
- Consider whether a strength-0 edge should be rejected or dropped at ingest as carrying no information.

### Edge cases covered
All intra-region strengths 0 with ≥ 2 files; a single zero-strength edge among non-zero ones (fine);
mixed zero and non-zero within one region; region with exactly 2 nodes and one zero-strength edge; a
region whose only intra edge is a self-loop (skipped by `detect`, so `graph.size = 0` → single
community, already handled); score landing exactly on the boundary.

### Open questions
1. Should a zero-strength edge exist at all? Rejecting it at ingest (Gap 13's validation) is the
   cleanest prevention, but a future signal design might legitimately want a "reference exists,
   weight 0" edge for provenance.
2. Should the degenerate rule key on total strength, on intra-edge count, or on *both* (either
   condition triggering)? Both-as-OR is safest and matches the requirement's "fewer than two nodes **or**
   zero internal edges" spirit.
3. Louvain's `NaN`-delta behaviour is a property of the third-party detector. Should
   `LouvainCommunityDetector` assert its own preconditions (total weight > 0, all weights finite and
   non-negative) so any future detector swap inherits the guard?

---

## Gap 17 — The parser and the core disagree on canonical order: UTF-8 byte order vs UTF-16 code-unit order

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/parser/src/canonical.ts` (`compareUtf8`) · `packages/core/src/canonical.ts` (`compareIds`)
- **Severity:** Medium — the engine's two halves order the same identifiers differently, so
  "canonical order" is not one order; each half is internally deterministic.

### The issue in one line
The parser compares ids byte-wise over UTF-8 (`Buffer.compare`), while the core compares them with
JavaScript's `<`/`>` (UTF-16 code units), and the two disagree for supplementary-plane characters.

### Evidence (measured, not assumed)
**Reproduced** with `U+FF61` (halfwidth ideographic full stop, BMP) and `U+10000` (supplementary plane):
```
compareUtf8(U+FF61, U+10000) = -1  (parser: FF61 first)
compareIds (U+FF61, U+10000) = +1  (core:   10000 first)
DIVERGENT: true
```
- Parser: `compareUtf8` (`packages/parser/src/canonical.ts:38-40`) and the collector's
  `compareByteWise` (`source-collector.ts:108-110`) — deliberately byte-wise per R9.2/R9.3, whose
  wording mandates "compared byte-wise lexicographically over the UTF-8 identifier string".
- Core: `compareIds` (`packages/core/src/canonical.ts:12-14`) is `a < b ? -1 : …`, i.e. UTF-16 order,
  and it is used at *every* core ordering boundary — `sortIds`/`sortByIds` (children ordering,
  Req 7.5), `partitionChildren`'s slicing, group membership hashing input, `nodes.json`/`edges.json`
  emission order, and blast-radius result ordering.
- Reachability: Java identifiers may legally contain supplementary-plane characters, and filenames
  certainly may — both flow into node ids.

### Root cause
R9.2/R9.3 pin the encoding for the *parser* only. The grouping spec says "sorted by node identifier"
(design determinism strategy) and Req 7.5 says "ascending child node identifier" without specifying an
encoding, so the core's implementation picked the idiomatic JavaScript comparison. Nothing cross-checks
the two, and no test compares them.

### Why it matters
- Determinism itself is **not** broken: each package is self-consistent, so repeated runs are
  byte-identical (verified by the existing determinism harnesses). But "canonical order" is a
  cross-cutting engine concept in the steering docs, and having two definitions is a latent hazard:
  any future code that merges, diffs, or streams the two artifacts together (an incremental re-indexer,
  a Neo4j loader, a viewer that binary-searches a sorted array from a different file) would be subtly
  wrong for non-ASCII repositories.
- Group membership hashing consumes `sortIds` output, so for a repository with supplementary-plane ids
  the *group ids themselves* differ from what a byte-wise implementation would produce — harmless today,
  but it means the two orders are baked into content-addressed identity.

### Why it is NOT fatal (and costs no contract rework)
No current artifact is wrong and no determinism digest changes for ASCII-only repositories (which all
current fixtures are). Unifying the comparator changes output bytes *only* for repositories containing
supplementary-plane identifiers.

### Fix direction
Pick one canonical order for the whole engine — byte-wise UTF-8, matching the parser and the explicit
requirement wording — and share a single comparator. Cleanest placement is a small canonical-ordering
utility in `packages/shared` (it is the seam both sides already depend on) so parser and core cannot
drift again; failing that, mirror `compareUtf8` into `packages/core` and replace `compareIds`. Add a
cross-package property test asserting the two orders agree over generated non-ASCII ids, so drift is
caught mechanically.

### Edge cases covered
Supplementary-plane vs high-BMP ids; unpaired surrogates in an id; ASCII-only (orders agree — hence the
existing suites pass); ids differing only by combining marks; identical-prefix ids of different lengths;
NFC vs NFD forms of the same visual name (distinct byte sequences under either comparator — see
Gap 12's display concerns and the open question below).

### Open questions
1. Should the shared comparator live in `packages/shared`? That package has deliberately held *types
   only*; adding a function changes its character (but avoids duplicated, drift-prone logic).
2. Byte-wise UTF-8 is stricter but slower than `<`/`>` (Buffer allocation per comparison). At 4,000+
   files sorted repeatedly this is measurable — is a cached-key sort (Schwartzian transform) worth it?
3. Unicode **normalization** is a separate, related decision: two files whose names differ only by
   NFC/NFD produce two distinct nodes with visually identical ids. Should the engine normalize
   identifiers on the way in (changing ids, affecting Gap 2's identity work) or record the ambiguity?

---

## Gap 18 — Determinism demo scripts can report success vacuously

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/demo-group-determinism.ts` · `packages/parser/src/demo-determinism.ts` (same pattern)
- **Severity:** Medium — an evidence-integrity defect in a Review demonstration aid, not an engine
  defect.

### The issue in one line
The `runs` argument is never validated, so `runs = 0` (or a non-numeric value) skips the loop entirely
and the vacuous `[].every(...)` makes the script print `DETERMINISTIC` with an `undefined` digest and
exit 0.

### Evidence (measured, not assumed)
**Reproduced:** `node packages/core/dist/demo-group-determinism.js <graph.json> 0`
```
  runs    : 0
  regions : 0
  nodes   : 0 (depth 0)
  sha-256 : undefined
  result  : DETERMINISTIC (identical digest across all runs)
```
- `runs = Number(argv[3] ?? "3")` with no validation (`demo-group-determinism.ts:26`); `NaN` and
  negative values behave the same way (loop body never executes, `digests` stays empty,
  `every` on an empty array is `true`).

### Root cause
The success criterion is "all digests are equal" rather than "we collected at least N ≥ 2 digests and
they are equal" — an empty set trivially satisfies the former.

### Why it matters
These scripts exist specifically to *demonstrate* the determinism claim at a review, and the guides in
`docs/1st/` and `docs/2nd/` present their output as evidence. A script that can print
`DETERMINISTIC` while having verified nothing is the wrong tool to point a sceptical examiner at, even
though the underlying property is genuinely true (the real harnesses in the test suites do verify it).

### Why it is NOT fatal (and touches no engine code)
Ecosystem-side demo tooling only: no engine behaviour, no contract, no output artifact. The determinism
property itself is verified by `verify-determinism.ts` and the property suites.

### Fix direction
Validate `runs` (integer ≥ 2, else exit non-zero with a usage message) and make the assertion positive:
require `digests.length === runs` **and** all equal **and** the digest be a non-empty string; print the
digest and the run count together. Apply the same to the parser's demo script.

### Edge cases covered
`runs` = 0, 1, negative, fractional, non-numeric, absent (defaults to 3); a graph that fails to
load (should exit non-zero, not report determinism).

### Open questions
1. Should the demo scripts share one hardened harness with the test-suite's `verifyDeterminism` helper,
   so there is a single implementation of "prove determinism"?

---

## Gap 19 — The source collector has no exclusion policy: `.git/`, `target/`, `build/`, `node_modules/` are fully traversed

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/parser/src/source-collector.ts`
- **Severity:** Medium — generated and vendored `.java` files enter the graph as live code, inflating
  the node set and manufacturing duplicate identities.

### The issue in one line
The collector faithfully implements R2.1 ("every Java source file at any nesting depth") with no
exclusion list, so build output, VCS internals, and vendored dependencies are parsed as first-class
source.

### Evidence (measured, not assumed)
- Reasoned from code, unambiguous: `collect`'s walk (`source-collector.ts:126-180`) filters only on
  `isSymbolicLink` / `isDirectory` / `isFile` and the `.java` suffix. There is no name-based or
  path-based exclusion anywhere in the parser.
- Consequences on a real Maven/Gradle repository: `target/generated-sources/**` and
  `build/generated/**` contain machine-generated `.java` (annotation processors, JAXB, protobuf, Lombok
  delombok output) that declare the **same** FQNs as, or near-duplicates of, hand-written sources; a
  `.git` working tree may hold checked-out or backup `.java`; `node_modules` in a polyglot repository may
  vendor Java samples.
- This is a *contributing cause* of known Gap 2's duplicate-FQN aborts (generated sources are one of the
  cited triggers there), but it is a distinct concern: even with Gap 2's source-root-scoped identity
  making the ids unique, generated files would still be parsed, counted, grouped, and shown as if they
  were authored code.

### Root cause
R2.1/R2.2 specify inclusion purely syntactically (`.java`, regular file) and no requirement mentions
exclusion, so "is this file source code?" was never modelled. Build-output layout is a build-system
convention, deliberately out of scope per Gap 2's reasoning, which is why nothing captures it.

### Why it matters
- Node counts, region sizes, cohesion, and every scalability statistic in `metadata.json` are computed
  over files a developer does not consider part of the codebase, so the navigation claims are measured
  against an inflated denominator.
- Parsing generated trees is also the dominant *cost* on large repositories (they are frequently larger
  than the hand-written source), affecting the performance evidence.
- It is silent: nothing in the output distinguishes a generated file from an authored one.

### Why it is NOT fatal (and costs no contract rework)
Determinism is unaffected (exclusions are a pure function of paths), the contract is unchanged, and a
smaller node set only *improves* every downstream stage. Parser-only, and the current behaviour is
literally spec-conformant, so this is a *policy* addition rather than a bug fix.

### Fix direction
Add a documented, deterministic default exclusion list applied by path segment — `.git`, `target`,
`build`, `out`, `bin`, `node_modules`, `.gradle`, `.mvn`, `generated-sources`, `generated` — with a
CLI/API override so nothing is silently unexcludable, and **record the effective exclusion list plus the
excluded-file count in the output** so the measurement is auditable (consistent with the project's
honest-caveats posture). Keep it a pure path predicate so ordering and determinism are untouched.

### Edge cases covered
A legitimate package literally named `build` or `out` (why the list must be overridable and matched on
directory segments, not substrings); a project whose real sources live under `target/` (unusual but
legal); nested `node_modules`; `.git` as a *file* (worktrees/submodules); case variations (`Build/`) on
case-insensitive filesystems; a hidden directory holding real sources; interaction with symlinked
generated directories (already skipped, since symlinks are never followed).

### Open questions
1. Should exclusions be *default-on* (better results, surprises a user whose sources live somewhere
   unusual) or *opt-in* (spec-faithful, but nobody will remember to enable it)? Default-on with a
   recorded, overridable list is my recommendation.
2. Should excluded-but-present generated sources be parsed into a *separate marked* set (so blast radius
   can still answer questions about generated code) rather than dropped entirely?
3. Does this belong in the parser (engine) or in the CLI wrapper (ecosystem)? The predicate affects the
   graph, so it is engine — but the *default list* is arguably ecosystem policy.

---

## Gap 20 — The CLI cannot vary any algorithm parameter, so Req 4.4's "without code changes" is unmet

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/group-cli.ts` · `packages/parser/src/parse-cli.ts`
- **Severity:** Medium — the sensitivity analysis the research design depends on cannot be run from the
  command line; it requires writing code.

### The issue in one line
`group-cli` accepts exactly two positional arguments and has no flag parsing, so the
`Structural_Quality_Boundary` — and the seed, metric weights, coefficients, `maxGroupSize`, and
override map — can only be varied through the programmatic API.

### Evidence (measured, not assumed)
- Reasoned from code: `const [, , inputArg, outArg] = process.argv` (`group-cli.ts:23`) is the entire
  argument surface; `groupGraphToIndex(graph.value, outDir)` (`:54`) passes **no** config, so every run
  uses `DEFAULT_GROUPING_CONFIG`. Extra positional arguments are silently ignored.
- Req 4.4 requires the boundary to be "an externally configurable parameter that can be varied across
  runs **without code changes**, so that a sensitivity analysis … can be performed". Today a sweep means
  editing or writing a script (as `demo-baselines.ts` does).
- Adjacent CLI robustness issues found in the same pass (reasoned from code): a missing `graph.json` in
  an input directory is reported as `malformed index file …: file could not be read` — the input is
  neither an *index* file nor *malformed*, because `MALFORMED_FILE` is reused for "not found"
  (`orchestrator.ts:151`, rendered by `describeError`); a standalone graph file not ending in `.json`
  makes the default output directory `<existing file>/index`, so `mkdirSync` fails with `ENOTDIR` and
  reports `WRITE_FAILED` naming a directory rather than explaining the cause (`group-cli.ts:40`).

### Root cause
Both CLIs are explicitly labelled temporary demo wrappers (`group-cli.ts:1-8`,
`parse-cli.ts:12-16`) with the packaged CLI deferred to the 8th-semester ecosystem work, so argument
parsing was never built. The requirement, however, sits in the *algorithm* spec and is therefore in
Phase-1 scope regardless of which wrapper exposes it.

### Why it matters
- The boundary's sensitivity analysis is the core of the research defence (grouping design.md's
  Evaluation Design), and "recorded in metadata so its sensitivity can be analyzed" presumes the sweep
  is easy to run. Requiring a code edit per boundary value makes the sweep laborious and, worse, means
  the swept runs are not reproducible from a command line in the paper's method section.
- The confusing error messages are the first thing a reviewer or new user hits.

### Why it is NOT fatal (and touches no engine code)
The engine already supports every parameter through `PartialGroupingConfig`; this is wiring plus
argument parsing in the wrapper. No contract, determinism, or output change.

### Fix direction
Add minimal, dependency-free flag parsing to `group-cli` for the parameters the specs call externally
configurable — `--boundary`, `--seed`, `--max-group-size`, `--min-partition-threshold`,
`--weight-cohesion/--weight-coupling/--weight-modularity`, `--squash-k`, `--compute-modularity`,
`--preserve <regionId>` / `--reconstruct <regionId>` (override map), `--out` — validate them through
Gap 9's `validateConfig`, reject unknown flags rather than ignoring them, and add a `--help`.
Separately, split "file not found" from "malformed content" in the error taxonomy so the CLI can say
which happened, and fix the non-`.json` default-output-path derivation.

### Edge cases covered
No arguments; extra positional arguments; unknown flags; a flag with a missing or non-numeric value;
input directory without `graph.json`; input file not ending in `.json`; output directory that does not
exist (created) vs exists as a file; relative paths resolved against `INIT_CWD` under
`npm run --workspace`; conflicting `--preserve`/`--reconstruct` for one region.

### Open questions
1. Is this engine or ecosystem work? The *capability* is required by Req 4.4 (engine spec), while the
   *CLI* is explicitly ecosystem. Minimal flags in the demo wrapper now, superseded by the packaged CLI
   later, seems the honest reading — but it should be an explicit decision, and it needs a home in the
   roadmap either way.
2. Should a config **file** (`repohive.config.json`, recorded verbatim in `metadata.json`) be preferred
   over flags for reproducibility of a sweep?

---

## Gap 21 — `minPartitionThreshold` is a configuration knob with no possible effect

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/hierarchy-builder.ts` (`partitionChildren`)
- **Severity:** Low — dead configuration surface; no wrong output.

### The issue in one line
`partitionChildren` skips partitioning when `n <= maxGroupSize || n < minPartitionThreshold`, and
because validation enforces `minPartitionThreshold <= maxGroupSize`, the second clause can never be the
deciding condition.

### Evidence (measured, not assumed)
Reasoned from code, and provable: `partitionChildren` returns the unpartitioned slice when
`n <= maxGroupSize` (`hierarchy-builder.ts:241-243`). `validateHierarchyConfig` guarantees
`2 <= minPartitionThreshold <= maxGroupSize` (`:49-58`). So if `n < minPartitionThreshold` then
`n < maxGroupSize`, meaning the first clause already returned — the `n < minPartitionThreshold` test is
unreachable as a deciding condition for every legal configuration.

### Root cause
Req 6.8 ("apply partitioning only to Group_Nodes whose child count is ≥ the configured minimum
partition threshold, and the threshold SHALL be an integer between 2 and maxGroupSize inclusive")
combines a behavioural rule with a bound that makes the rule vacuous: partitioning is *already*
only applied above `maxGroupSize`, which is `>=` the threshold by definition.

### Why it matters
Only as clarity and spec fidelity: the implementation faithfully encodes a requirement that cannot
bite, so the knob appears in `HierarchyConfig`, is validated, and is documented as meaningful while
having no observable effect. Anyone tuning it — or reviewing the sizing logic against Req 6.7/6.8 —
will be misled. Property 21's "groups below the threshold are left unpartitioned" clause is
vacuously true.

### Why it is NOT fatal
No incorrect output is possible; every legal configuration behaves exactly as `maxGroupSize` alone
dictates, which is what Req 6.7 and 11.1 actually require.

### Fix direction
A specification decision rather than a code fix. Either (a) give the threshold real semantics — allow
`minPartitionThreshold > maxGroupSize` so it can genuinely suppress partitioning of moderately
oversized groups (changes hierarchy shape and needs a requirements amendment), or (b) acknowledge it as
intentionally vacuous, note it in the design as a forward-compatibility placeholder, and keep the
validation as-is. Option (b) is honest and free; option (a) needs a use case first.

### Edge cases covered
`minPartitionThreshold == maxGroupSize`; `== 2` (the default); `n` exactly `maxGroupSize`;
`n == maxGroupSize + 1`; out-of-bounds values (already rejected).

### Open questions
1. Is there a real navigation reason to leave a moderately oversized group unpartitioned? If not,
   option (b) and a design note is the right close-out.
2. Should `metadata.json` record the effective sizing parameters (it currently records the boundary,
   weights, and `k_cohesion`, but **not** `maxGroupSize`, `minPartitionThreshold`, or the community
   seed) so the hierarchy shape is reproducible from the audit record alone? That is a small, separate
   gap in the audit trail worth folding into this decision.

---

## Gap 22 — `metadata.json` omits the parameters needed to reproduce the hierarchy shape

- **Status:** Open — to be brainstormed.
- **Logged:** 2026-07-28
- **Area:** `packages/core/src/metadata.ts` · `packages/core/src/types.ts` (`Metadata`)
- **Severity:** Low — incomplete audit record; no wrong output.

### The issue in one line
The metadata records the boundary, metric weights, and `k_cohesion`, but not `maxGroupSize`,
`minPartitionThreshold`, `communityDetectionSeed`, the weight coefficients, or the `degenerateScore` —
so a run's *hierarchy shape* cannot be reproduced from its own audit record.

### Evidence (measured, not assumed)
Reasoned from code: `buildMetadata` (`metadata.ts:55-66`) writes exactly
`structuralQualityBoundary`, `metricWeights`, `cohesionSquashConstant`, `regionDecisions`, and the
derived counts. `MetadataInputs` (`:11-16`) accepts nothing else, and `GroupingConfig` carries
`communityDetectionSeed`, `weightCoefficients`, `hierarchy.maxGroupSize`,
`hierarchy.minPartitionThreshold`, and `assessment.degenerateScore`, none of which reach the output
(confirmed: no `seed`/`maxGroupSize` key appears outside `types.ts`).

### Root cause
Req 5 enumerates what must be recorded in terms of the *decision* (scores, actions, confidence,
boundary, weights), and Req 9.4 adds counts and depth. Nothing requires recording the parameters that
govern *assembly*, so they were not plumbed through — even though Req 7.1's determinism guarantee is
stated "with identical configuration", making the configuration part of what must be known to verify it.

### Why it matters
- Req 5.7's replay guarantee covers the preserve/reconstruct decisions, which the recorded boundary and
  scores do reproduce. But the *hierarchy* — group memberships, depth, branching — additionally depends
  on `maxGroupSize` and the community seed, so two runs with identical recorded metadata can produce
  different trees. For a project whose central claim is reproducibility, the audit record should be
  sufficient on its own.
- It also blocks a cheap, useful check: comparing two `index/` directories and attributing a difference
  to a parameter change.

### Why it is NOT fatal (and is nearly free to fix)
Purely additive output fields; no identity, ordering, or decision change. Determinism is unaffected
(the values are already deterministic configuration). The only consumer impact is that `parseIndex`'s
metadata validation should learn the new fields (optional, so old indexes still parse).

### Fix direction
Extend `Metadata` (and `MetadataInputs`) with the full effective configuration — a nested
`configuration` object holding the resolved boundary, weight coefficients, assessment config
(including `degenerateScore`), hierarchy config, and the community seed — populated from the resolved
config in `groupGraph`. Emitting the *resolved* config (not the partial input) is what makes it a
reproduction recipe. Keep the existing top-level fields for backward compatibility.

### Edge cases covered
A run using all defaults; a run with a partial config; overrides present (already recorded per-region
via `userOverridden`, but the *override map itself* is not recorded — include it); modularity enabled
vs disabled (`metricWeights` currently keeps the modularity weight even when Q could not be computed,
contradicting Req 3.7's "weights **used**" — worth fixing in the same change); an index written by an
older version lacking the new fields (must still parse).

### Open questions
1. Should the whole resolved config be embedded, or a content hash of it plus the fields the specs name
   explicitly? Embedding is more useful and only a few dozen bytes.
2. Should `metricWeights` be corrected to reflect weights *actually applied* (dropping modularity when Q
   was not computable)? That is arguably a Req 3.7 compliance fix in its own right; it changes the
   recorded value for `computeModularity: true` runs on edgeless/zero-weight projections.
