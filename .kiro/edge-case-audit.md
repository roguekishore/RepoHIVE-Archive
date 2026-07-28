# RepoHIVE — Edge-Case Audit Register

> Complete register of every edge case examined in the 2026-07-28 exhaustive audit of the engine
> (`packages/shared`, `packages/parser`, `packages/core`) and both CLI entry points. It records the
> cases that are **handled correctly** and the ones that are **deliberate Phase-1 simplifications**
> alongside the failures, so a reviewer can see the breadth of the analysis rather than only its
> findings.
>
> - Newly found gaps are logged as **Gaps 3–22** in `docs/gaps.md` (Gaps 1 and 2 pre-date this audit).
> - Production-grade fix designs for the High/Medium gaps are in `docs/fixes.md`.
> - **No source code was modified by this audit.** It is an analysis + solution-design pass only.

## How to read an entry

Each entry is classified:

| Marker | Meaning |
|---|---|
| **[gap]** | A real deviation from the specs/correctness properties, or a hole the specs do not cover but reality will hit. |
| [by-design] | A documented Phase-1 simplification or spec-intended behaviour. **Not** a defect. |
| [already-handled] | The code handles it correctly; the entry cites where (file:line and/or the covering test). |

Evidence is labelled by confidence: **REPRODUCED** (a command was run and its output captured),
otherwise reasoned from code with `file:line` references, or explicitly marked **HYPOTHESIS** with the
check needed to confirm.

## Method

1. Read `AGENTS.md`, `.kiro/PROJECT_STATE.md`, the steering docs, `docs/gaps.md`, and both specs
   (`dependency-graph-parser`, `hierarchical-repository-grouping`) in full — requirements, design, and
   the 10 + 33 correctness properties — to establish intended behaviour before looking for deviations.
2. Established a green baseline: `npm run build` clean, **102/102 parser tests + 79/79 core tests
   passing** on Node v26.4.0. Every defect below therefore survives the existing suite, and each
   register section notes the corresponding test-coverage hole where one exists.
3. Enumerated the input space of every exported function and every branch, file by file, across 12
   scope clusters, then classified each case.
4. Reproduced the consequential suspicions against the real built artifacts using throwaway fixtures
   in a scratch directory (never inside the repository), capturing actual output.

## Coverage and honest limitations

**What was covered.** All 20 source modules of `packages/core`, all 14 of `packages/parser`,
`packages/shared`'s contract, both CLI wrappers, the three demo scripts, and the relevant
third-party behaviour (`graphology-communities-louvain`'s handling of zero/negative/NaN edge weights,
`graphology-metrics` modularity, and `tree-sitter-java`'s grammar node shapes for varargs, records,
enum constants and anonymous classes).

**Limitations a reviewer should know:**

- **Two clusters lost their generated register.** The fan-out pass covered 12 clusters; the
  `parser-serialize` and `cross-cutting` clusters were interrupted before writing their register files.
  Both areas were re-examined directly in the lead pass and appear below as
  *"(lead-pass review)"* sections — they are shorter and less granular than the generated sections, so
  serialization/atomic-write and cross-cutting determinism have had **one** careful review rather than
  two.
- **The independent adversarial verification pass did not run.** Findings therefore carry a mix of
  confidence levels. Everything promoted to `docs/gaps.md` as Gaps 3–22 was **re-verified in the lead
  pass**, and the great majority were reproduced end-to-end. Register entries *not* promoted should be
  treated as credible-but-single-reviewer claims: useful leads, not established defects.
- **Platform.** All reproductions ran on Linux (Node v26.4.0). Cases that are inherently
  platform-specific — macOS NFD filename normalization, Windows path semantics, filesystem
  case-insensitivity — are marked HYPOTHESIS with the check needed.
- **Not covered:** performance/scale benchmarking (only algorithmic complexity was noted where it
  stood out), the `fixtures/vantage` and `fixtures/broadleaf` repositories (absent on this machine per
  PROJECT_STATE), and `packages/web` (an empty `.gitkeep` directory — Phase-3 impact was therefore
  reasoned from the JSON contract and the grouping design, as recorded in `docs/fixes.md`).

## Summary

| Area | Cases | [gap] | [by-design] | [already-handled] |
|---|---:|---:|---:|---:|
| parser — node identity | 41 | 13 | 4 | 24 |
| parser — AST extraction | 57 | 12 | 11 | 34 |
| parser — collection & validation | 51 | 10 | 3 | 38 |
| parser — symbol table & stitching | 36 | 8 | 3 | 25 |
| core — ingest & weighting | 44 | 16 | 2 | 26 |
| core — regions & assessment | 51 | 10 | 13 | 28 |
| core — community detection | 33 | 12 | 3 | 18 |
| core — construction & hierarchy | 55 | 12 | 6 | 37 |
| core — index I/O, metadata, blast radius | 63 | 23 | 5 | 35 |
| core — orchestrator & CLI | 46 | 20 | 2 | 24 |
| **Generated-register subtotal** | **477** | **136** | **52** | **289** |
| parser — serialization & orchestration *(lead pass)* | 29 | 3 | 2 | 24 |
| cross-cutting *(lead pass)* | 19 | 6 | 4 | 9 |
| **Total** | **525** | **145** | **58** | **322** |

The 145 `[gap]` entries consolidate into the **20 numbered gaps** (Gaps 3–22) in `docs/gaps.md`; many
register entries are variants or symptoms of one root cause and are folded there rather than being
counted as separate defects. The mapping is in the appendix below.

## Standing positives (verified, not assumed)

Worth recording because they are the properties most at risk in a determinism-first engine, and they
hold:

- **No ambient nondeterminism anywhere in the engine.**
  `grep -rnE 'Math\.random|Date\.now|new Date|hrtime|os\.hostname|process\.pid|performance\.now'`
  over both packages' `src` (excluding tests/demos) returns **no matches** — and none in the tests or
  demo scripts either.
- **No locale-dependent APIs.** `grep -rnE 'toLocale|localeCompare|Intl\.|toLowerCase|toUpperCase'`
  returns **no matches**, so no ordering or comparison can vary with the host locale.
- **No host paths in output.** `process.env` appears only as `INIT_CWD` resolution inside the CLI and
  demo wrappers (`group-cli.ts:19`, `parse-cli.ts:37`, `demo-*.ts`), never in an emitted artifact; node
  ids carry only root-relative POSIX paths.
- **Exactly six `throw` sites exist in the engine**, all located: `ids.ts:52,55,60,65,102` and
  `canonical.ts:100`. Of these, `ids.ts:55`/`:65` are reachable from real input and are the substance of
  Gap 3; `ids.ts:52`/`:102` and `canonical.ts:100` guard internal invariants that the pipeline does not
  violate.
- **Atomic single-file write in the parser** (temp file in the same directory + `rename`, with temp
  cleanup on both failure paths) genuinely delivers R8.4/R8.5/R10.6. The equivalent guarantee is what
  `packages/core`'s five-file index write lacks (Gap 10).

---

## Register

### packages/parser — node identity

> Scope: `ids.ts`, `types.ts` (+ `ids.test.ts`) · parser spec R3.10–R3.12, R9.4  
> **41 cases examined** — 13 gap · 4 by-design · 24 already-handled


#### `packages/parser/src/ids.ts`

- **[gap]** assertRootRelativePosixPath throw escapes the Result error model (backslash in a legal Linux filename)  
  On Linux a filename may legally contain a literal backslash ('We\ird.java'). source-collector toPosixRelative splits on path.sep ('/'), so the backslash survives into relativePath; buildFileId then throws a plain Error. extract() wraps extractFromRoot in try/FINALLY with no catch (ast-extractor.ts:449-471), parseProject has no catch around extractor.extract (orchestrator.ts:166-174), and parse-cli.ts:80 is 'void main()' with no .catch — so the Error surfaces as an unhandled rejection/crash with a stack trace instead of a structured ParseError. Violates the engine rule 'errors are structured Results, no throws es…  
  _Evidence:_ REPRODUCED: mkdir a-backslash/src; printf 'package p;\nclass Weird {}\n' > 'a-backslash/src/We\\ird.java'; node packages/parser/dist/parse-cli.js <dir> <out> -> 'Error: relativePath must use forward-slash separators, not backslashes: src/We\ird.java at assertRootRelativePosixPath (ids.js:50) ... at parseProject (orche…
- **[gap]** Drive-letter regex false positive: Linux file legally named 'C:Drive.java' at project root  
  The guard /^[A-Za-z]:/ (ids.ts:64) is meant to reject Windows absolute paths, but a root-level Linux file or directory whose name starts with '<letter>:' is a perfectly relative path and gets rejected -> same uncaught-throw crash channel as the backslash case. Folded into the throw-escape candidate.  
  _Evidence:_ REPRODUCED: printf ... > 'a2-drive/C:Drive.java'; node packages/parser/dist/parse-cli.js -> 'Error: relativePath must not be an absolute host path with a drive letter: C:Drive.java' (uncaught). Fixture: scratchpad/repro/parser-ids/a2-drive
- **[gap]** '$' in a legal Java identifier conflates with the nested-type separator (class Outer$Inner top-level vs class Inner nested in Outer, same package)  
  Both mint FQN p.Outer$Inner. Within ONE file the second declaration is SILENTLY dropped by the nodesById.has() dedup (ast-extractor.ts:255) — two structurally distinct declared types produce one node, no error (violates R3.3/R3.12). Across TWO files there is no dedup at all (orchestrator.ts:172 just concatenates; serializer has no duplicate-id backstop) so graph.json is emitted with TWO node objects sharing id 'class:p.Outer$Inner' and the CLI reports OK — invalid per R3.12/R7.1; core ingest will reject it. Related to known Gap 2 in downstream symptom (duplicate ids) but the mechanism is NEW: single source root,…  
  _Evidence:_ REPRODUCED: fixture d-dollar (two files) -> out-d-dollar.json contains 'class:p.Outer$Inner' twice with different definedInFile, parser prints 'result: OK'; fixture m-dollar1file (one file) -> only ONE 'class:p.Outer$Inner' node for two declarations, methods of both ('hi','bye') pooled under it. Duplicate output is st…
- [already-handled] Cross-kind id collision (file vs class vs function prefixes)  
  FILE_ID_PREFIX 'file:', CLASS_ID_PREFIX 'class:', FUNCTION_ID_PREFIX 'func:' are distinct literals, so ids of different kinds can never be equal.  
  _Evidence:_ ids.ts:29-33; test 'the three id kinds never collide across kinds' (ids.test.ts:161-178)
- [already-handled] buildFileId documented canonical form  
  file: + relativePath, matches design table exactly.  
  _Evidence:_ ids.ts:79-82; test 'file id matches the documented form' (ids.test.ts:209-214)
- [already-handled] buildFileId('') empty relativePath  
  Rejected by assertRootRelativePosixPath (ids.ts:51-53). Unreachable from the real pipeline: a collected file is always a non-empty descendant path (source-collector.ts:163-171). The rejection is intended (R9.4); the DELIVERY as a raw throw is the subject of the throw-escape gap below.  
  _Evidence:_ ids.ts:51-53; ids.test.ts:199
- [already-handled] Leading-slash (absolute POSIX) relativePath  
  Rejected at ids.ts:59-63; unreachable from the collector, which always produces paths relative to the validated root via path.relative (source-collector.ts:93-98).  
  _Evidence:_ ids.ts:59-63; test ids.test.ts:198-203
- [already-handled] Windows path separators entering an id  
  On Windows, toPosixRelative normalizes path.sep backslashes to '/' before buildFileId ever sees the path (source-collector.ts:93-98), and the ids.ts guard is a second line of defense. The residual hole is Linux filenames that CONTAIN a literal backslash (see throw-escape gap).  
  _Evidence:_ source-collector.ts:97; ids.ts:54-58
- [already-handled] Unusual-but-legal characters in relativePath (spaces, quotes, newlines, '#', '(', '$')  
  Node ids are opaque strings; the hand-written stringifier JSON-escapes via JSON.stringify (canonical.ts:79-81) and sorting is total byte-wise UTF-8 (canonical.ts:38-40). No parsing of ids happens downstream, so embedded separator-like characters in file paths cannot corrupt output or ordering.  
  _Evidence:_ canonical.ts:38-40, 79-81 (reasoned-from-code)
- [already-handled] buildClassFqn / buildClassId with an empty nestedTypeNames chain (throws)  
  Throws by contract (ids.ts:101-103), but every caller structurally guarantees a non-empty chain: walkDeclarations appends the type name before calling buildClassId (ast-extractor.ts:253-254) and the function branch is guarded by typeChain.length > 0 (ast-extractor.ts:276). Unreachable in the pipeline.  
  _Evidence:_ ids.ts:101-103; ast-extractor.ts:253-254, 276-277
- [already-handled] Default package: packagePath === '' vs omitted  
  buildClassFqn('' , chain) yields the chain with no leading dot (ids.ts:105-107); extractor sets packagePath only when non-empty (ast-extractor.ts:262-264, 377-379); serializer omits empty packagePath per R7.3 (serializer.ts:130-132). Consistent '' convention documented in types.ts:56-57.  
  _Evidence:_ test 'default-package class FQN omits the leading dot' (ids.test.ts:230-233); serializer.ts:130-132
- [already-handled] Package-dot vs nesting ambiguity WITHOUT '$' (can 'a.b' package + class C collide with package 'a' + nested chain b,C?)  
  Impossible by construction: nesting is joined with '$' while packages join with '.', and Java identifiers cannot contain '.', so 'a.b.C' (package a.b) vs 'a.b$C' (nested) never collide. The one ambiguity channel left is '$' itself — see the dollar gap.  
  _Evidence:_ ids.ts:36-38, 97-108 (reasoned-from-code)
- [already-handled] '#' or '(' injected into buildFunctionId inputs  
  By construction: enclosingClassFqn comes from buildClassFqn over parsed identifier text and Java identifiers cannot contain '#' or '('; functionName is an identifier. Parameter-type TEXT can contain '(' via type-use annotation arguments (see the annotation-literal hypothesis row) but ids are opaque downstream, so no parsing ambiguity is exploited by any consumer.  
  _Evidence:_ ast-extractor.ts:277-283; ids.ts:140-147 (reasoned-from-code)
- [already-handled] Comma-joined parameter list vs commas inside generic type arguments (can two different overloads mint the same id?)  
  f(Map<String,Integer>) -> 'func:p.K#f(java.util.Map<String,Integer>)' and f(Map<String>, Integer) -> 'func:p.K#f(java.util.Map<String>,Integer)' are distinct: every valid Java type text has balanced angle brackets, so the comma-join is injective over lists of valid type texts (a depth-0 comma split recovers the list uniquely).  
  _Evidence:_ REPRODUCED: fixture k-params, out-k-params.json shows both distinct ids
- [already-handled] Type-use annotation ARGUMENTS containing string literals with ',' '(' ')' inside a parameter type (e.g. List<@X(",)") String>)  
  Hypothesis-level residual: annotation string literals put arbitrary characters into the joined param text. Balanced-token reasoning says two DIFFERENT lists of valid type texts still cannot join to the same string (quotes/brackets are balanced per fragment), so no collision; ids stay deterministic either way. Not reproduced; a fast-check property over annotated types would be the confirming check.  
  _Evidence:_ ids.ts:145; ast-extractor.ts:206-229 (reasoned-from-code, hypothesis for the pathological corner)
- [already-handled] No-argument function: empty parentheses  
  buildFunctionId(fqn, name, []) -> 'func:...#name()'.  
  _Evidence:_ test 'no-argument function id has empty parentheses' (ids.test.ts:242-252)
- [already-handled] Unicode identifiers (BMP and astral plane) in class/method names  
  tree-sitter-java 0.23.5 parses them; ids carry the raw identifier text and are distinct iff byte-distinct, which matches Java's codepoint-wise identifier identity. Canonical sorting is genuinely byte-wise UTF-8 via Buffer.compare (canonical.ts:38-40), not UTF-16 code-unit order, so astral-plane ids (surrogate pairs) sort per R9.2 as specified.  
  _Evidence:_ REPRODUCED: fixture j-unicode -> 'class:p.Ünïcode', 'class:p.𝕏', 'func:p.Ünïcode#日本語メソッド()', 'func:p.𝕏#𝑓()' all emitted, sorted with Ünïcode (C3...) before 𝕏 (F0...)
- [already-handled] Unicode normalization forms (NFC vs NFD of visually identical identifiers)  
  Java compares identifiers by codepoints, so NFC and NFD spellings are DIFFERENT Java identifiers; the id scheme keeps them byte-distinct, which is the correct mirror. No aliasing, no collision.  
  _Evidence:_ reasoned-from-code: ids are verbatim identifier text; JLS 3.8 identifier equality is codepoint-wise
- [already-handled] Case-only distinctions (a.java vs A.java, class foo vs Foo)  
  Byte-wise distinct ids; canonical order is total and case-sensitive. Case-insensitive-filesystem coexistence is a collection-layer impossibility, not an id concern.  
  _Evidence:_ canonical.ts:38-40 (reasoned-from-code)

#### `packages/parser/src/source-collector.ts`

- [already-handled] Non-UTF-8 filename bytes (lone surrogates in the JS string) entering a file id  
  Hypothesis-level caveat, not reproduced: Node decodes invalid filename bytes to lone surrogates; two distinct such names remain distinct JS strings so ids stay distinct, and JSON.stringify emits well-formed escaped \udXXX (ES2019 well-formed stringify). Buffer.from(id,'utf8') maps lone surrogates to U+FFFD so two such ids could TIE in the canonical comparator, but Array.sort is stable so output remains deterministic. Collection-lane concern; noted for completeness.  
  _Evidence:_ canonical.ts:38-40; reasoned-from-code, not reproduced

#### `packages/parser/src/ast-extractor.ts`

- **[gap]** Package declaration containing legal whitespace or comments ('package com . example;', 'package com./*hi*/example;')  
  readPackagePath takes the raw source span of the scoped_identifier and only collapses whitespace runs (normalizeTypeText, ast-extractor.ts:179-199), so packagePath becomes 'com . example' or 'com./*hi*/example' instead of the dotted package name required by R3.7. The polluted string enters every class/function FQN and id built by ids.ts, the emitted packagePath field, symbol-table keys (packagePath + '.' + simpleName), and core's package-region identity — a normally-written 'import com.example.X;' in another file will not resolve against the polluted key (reasoned-from-code consequence), and core treats it as a …  
  _Evidence:_ REPRODUCED: fixture f-pkgws -> node ids/packagePath: class 'class:com . example.W', pkg='com . example'; fixture f2-pkgcomment -> 'class:com./*hi*/example.X', pkg='com./*hi*/example'. Outputs: scratchpad/repro/parser-ids/out-f-pkgws.json, out-f2-pkgcomment.json
- **[gap]** Varargs parameter (spread_parameter): declared type extraction  
  In tree-sitter-java 0.23.5 spread_parameter has no 'type' FIELD, so childForFieldName('type') is null and the code falls back to param.text — the WHOLE parameter text including the variable name — then appends another '...'. Result: 'func:p.K#g(String... s...)'. The parameter NAME enters the id, violating R3.10's 'derived solely from ... declared parameter type list': renaming the variable (a non-structural edit) changes the function's id, and the '... s...' rendering deviates from the documented 'trailing ...' form (ast-extractor.ts:204). Ids remain unique and deterministic, so impact is spec-basis deviation + …  
  _Evidence:_ REPRODUCED: fixture k-params, void g(String... s) -> node id 'func:p.K#g(String... s...)' in out-k-params.json; code path ast-extractor.ts:216-226
- **[gap]** Methods declared in ANONYMOUS class bodies: what enclosing chain do they get?  
  walkDeclarations extends typeChain only at named type declarations and recurses through everything else unchanged (ast-extractor.ts:302-303), so a method inside 'new Runnable() { public void run() {...} }' is attributed to the ENCLOSING named class ('func:p.A#run()'). When the enclosing class declares the same signature — the ubiquitous interface-implementation pattern — the two distinct method declarations mint the SAME id and the nodesById.has() dedup (ast-extractor.ts:284) silently drops one: R3.4 (one node per declared method) and R3.12 violated on very common Java, with no error. Even without collision the …  
  _Evidence:_ REPRODUCED: fixture b-anon (class A implements Runnable with its own run() plus an anonymous Runnable with run()) -> out-b-anon.json contains exactly ONE 'func:p.A#run()' (3 nodes total: file, class:p.A, one function)
- **[gap]** Methods declared in ENUM CONSTANT bodies (constant-specific class bodies)  
  Same mechanism as the anonymous-class case: 'enum E { A { void m(){} }, B { void m(){} }; abstract void m(); }' has three distinct m() declarations, all attributed chain [E] -> single id 'func:p.E#m()' -> two silently dropped. Constant-specific bodies are idiomatic Java; node inventory is silently wrong. Folded with the anonymous-class case into one candidate (unnamed-type-context attribution).  
  _Evidence:_ REPRODUCED: fixture c-enum -> out-c-enum.json contains exactly ONE 'func:p.E#m()' (3 nodes total)
- **[gap]** NAMED type declared inside an anonymous class body ('new Object() { class Deep {} }')  
  Reasoned-from-code, same recursion: Deep gets chain [Enclosing, Deep] -> 'class:p.Enclosing$Deep', misattributed as a direct member nested type (JVM: p.Enclosing$1$Deep) and colliding with any real member type named Deep. Folded into the unnamed-type-context candidate.  
  _Evidence:_ ast-extractor.ts:246-269, 302-303 (reasoned-from-code; direct variant of reproduced b-anon/c-enum)
- **[gap]** LOCAL classes (declared inside method bodies): chain has no method-scope disambiguation  
  A local class L in method m1 of C gets chain [C, L] -> 'class:p.C$L'. Two same-named local classes in SIBLING methods (legal, independent scopes; JVM names C$1L, C$2L) merge into ONE class node, and their methods pool under the merged id ('func:p.C$L#f()', 'func:p.C$L#g()' both present but attributed to one class that is actually two). Same-named local vs member class also merges (reasoned). Distinct declared types -> one node, silently (R3.3/R3.12).  
  _Evidence:_ REPRODUCED: fixture e-local (m1 declares class L {f()}, m2 declares class L {g()}) -> out-e-local.json has ONE 'class:p.C$L' plus both func:p.C$L#f() and #g()
- **[gap]** Record COMPACT canonical constructor: parameter list in the id  
  compact_constructor_declaration has no 'parameters' field, so parameterTypesOf returns [] and the canonical constructor of 'record R(int a)' gets id 'func:p.R#R()' — misrepresenting its declared signature (the record header components). Worse, a record may legally also declare an explicit no-arg delegating constructor 'R() { this(0); }' whose id is ALSO 'func:p.R#R()': two distinct constructor declarations, one node, silently merged (R3.4/R3.12). Fix direction: derive the compact ctor's parameter types from the record header's formal parameters.  
  _Evidence:_ REPRODUCED: fixture g-record (record R(int a) with compact 'R {}' AND explicit 'R() { this(0); }') -> out-g-record.json has exactly ONE 'func:p.R#R()' (3 nodes total); code path ast-extractor.ts:206-210, 279-283
- **[gap]** Annotation type (@interface) element declarations get NO function node  
  annotation_type_declaration is in TYPE_DECLARATION_TYPES (class node emitted) but its members are 'annotation_type_element_declaration' nodes, absent from FUNCTION_DECLARATION_TYPES (ast-extractor.ts:162-166), so '@interface Anno { String value(); int count() default 0; }' yields zero function nodes. Annotation elements are method declarations in JLS/JVM terms; R3.4 arguably covers them. Inventory hole only — no collision, no crash; function nodes carry no Phase-1 edges.  
  _Evidence:_ REPRODUCED: fixture l-annot -> out-l-annot.json has only 'class:p.Anno' + file node, no func: ids
- [by-design] Type-use annotations inside a parameter type enter the id text  
  void ann(java.util.List<@Deprecated String> l) -> 'func:p.K#ann(java.util.List<@Deprecated String>)'. The id records the declared type text verbatim (content-derived scheme); deterministic and unique, arguably part of the declared type. Cosmetic-only deviation from the bare-type examples in the design table.  
  _Evidence:_ REPRODUCED: fixture k-params, out-k-params.json
- [by-design] Whitespace variations inside a declared type ('Map<String , Integer>' vs 'Map<String,Integer>')  
  normalizeTypeText collapses runs to a single space but does not delete spaces, so the two formattings of the same logical signature yield different ids. Under the content-derived scheme this is acceptable: the same unchanged file always re-derives the same id (R3.11 holds); only a reformatting edit changes it. No collision channel (same-signature duplicates cannot coexist in one class).  
  _Evidence:_ REPRODUCED: fixture k-params, 'func:p.K#ws(java.util.Map<String , Integer>)'; ast-extractor.ts:179-181
- [by-design] Whole-file abort when ANY file has a parse error (hasError gate + R10.4 no-output)  
  R10.1/R10.4 specify recording file-unparseable and producing no output when any error was recorded; project brief lists this as specified behavior, not a defect.  
  _Evidence:_ ast-extractor.ts:456-465; orchestrator.ts:186-188; requirements.md R10.1/R10.4
- [already-handled] C-style array dimensions on the variable ('int a[]') vs on the type ('int[] a')  
  The dimensions field is appended to the type text (ast-extractor.ts:219-222), so both render 'int[]' — consistent canonical representation for the same declared type.  
  _Evidence:_ REPRODUCED: fixture k-params, h(int[] a) -> 'func:p.K#h(int[])' and h2(int a[]) -> 'func:p.K#h2(int[])'
- [already-handled] package-info.java  
  Parses cleanly (annotations + package declaration, no type): emits a file node carrying the packagePath, zero class/function nodes. Sensible; no synthetic class name is minted.  
  _Evidence:_ REPRODUCED: fixture i-pkginfo -> 'file:src/package-info.java' with pkg='p', no class node
- [already-handled] module-info.java  
  tree-sitter-java 0.23.5 parses module declarations without error (no hasError abort), so a JPMS project does not poison the run; the module declaration itself gets no class node (it is not a class/interface/enum/record — consistent with R3.3) and packagePath is '' (no package declaration). File id normal.  
  _Evidence:_ REPRODUCED: fixture h-module -> 'file:src/module-info.java' pkg='', class:q.Q from sibling file intact, result OK
- [already-handled] Type declaration with no name node (malformed)  
  Defensive skip-and-recurse branch (ast-extractor.ts:248-251); in practice unreachable because a nameless declaration implies ERROR/MISSING nodes and the hasError gate rejects the file first (ast-extractor.ts:456-465).  
  _Evidence:_ ast-extractor.ts:248-251, 456-465 (reasoned-from-code)
- [already-handled] Constructor and compact-constructor names; generic methods  
  Constructor name = declared simple name via the name field; compact constructors fall back to the enclosing type's simple name (ast-extractor.ts:279-281), correct for records. Generic methods' type parameters do not enter the name; overload identity rests on the param-type list as specified.  
  _Evidence:_ ast-extractor.ts:279-283; reproduced across fixtures g-record, k-params

#### `packages/parser/src/serializer.ts`

- **[gap]** Serializer emits duplicate node ids without any uniqueness check (R7.1 backstop missing)  
  buildGraph builds a Set of node ids only to sweep dangling edges (serializer.ts:168-186); nodes themselves are emitted as-is, so any upstream id collision across files reaches graph.json and the run reports success. Folded as evidence into the '$'-ambiguity candidate (also the mechanism behind known Gap 2's symptom).  
  _Evidence:_ serializer.ts:163-187; reproduced via fixture d-dollar (duplicate 'class:p.Outer$Inner' in emitted output with exit OK)

#### `packages/parser/src/types.ts`

- [by-design] RawReference.targetName may be an FQN, a simple name, or carry a trailing '.*' (wildcard import)  
  Wildcard imports keep '.*' and deliberately resolve to nothing in Phase 1 (documented at ast-extractor.ts:323-327); RawReferenceKind 'type-use'/'method-call' declared but unpopulated in Phase 1 (types.ts:27-31) — matches the documented simplification that edges are import-only.  
  _Evidence:_ types.ts:27-44; ast-extractor.ts:323-327
- [already-handled] CollectedFile.relativePath contract (POSIX, root-relative) as the only path material entering ids  
  Documented at types.ts:15-24 and matches the collector's production and buildFileId's expectation; the sole enforcement point is the assert in ids.ts, whose failure mode (throw) is the throw-escape gap. types.ts itself is declaration-only — no executable branches to audit.  
  _Evidence:_ types.ts:15-24; source-collector.ts:93-98; ids.ts:50-69

#### `packages/parser/src/ids.test.ts`

- **[gap]** Property-test generator blind spot: identifiers exclude '$', '<', '>', ',' and all separator characters  
  The ident generator (ids.test.ts:31-46) uses only separator-free tokens, so the distinctness properties (R3.12) structurally CANNOT discover the '$'-ambiguity or any comma/generic interaction — the very inputs where distinctness is at risk. Test-coverage hole, folded as supporting evidence into the '$'-ambiguity candidate rather than a separate candidate slot.  
  _Evidence:_ ids.test.ts:29-65 ('safe identifier tokens, no separators' by its own comment)

#### `packages/parser/src/canonical.ts`

- [already-handled] Determinism of output even when duplicate ids are present  
  compareNodes returns 0 for equal ids and Array.prototype.sort is stable (ES2019+), so even the invalid duplicate-id output is byte-identical across runs — R9.1 preserved; the defect is validity (R3.12/R7.1), not determinism.  
  _Evidence:_ REPRODUCED: sha256(out-d-dollar.json) == sha256(out-d-dollar-run2.json) = 065f4130...

### packages/parser — AST extraction

> Scope: `ast-extractor.ts` (+ tests) · parser spec R3, R10.1–R10.2  
> **57 cases examined** — 12 gap · 11 by-design · 34 already-handled


#### `packages/parser/src/ast-extractor.ts`

- **[gap]** record compact constructor: id has empty parameter list and collides with an explicit no-arg constructor overload  
  compact_constructor_declaration has no parameters node, so parameterTypesOf returns [] and the id is func:pkg.R#R() even though the canonical signature is R(<record header types>). A record declaring both a compact constructor and an explicit R() overload (legal Java) produces ONE node for two distinct constructors — the Map dedup silently swallows the second. Violates R3.4's 'exactly one Graph_Node for each ... constructor'.  
  _Evidence:_ reproduced: repro out1.json case compact-ctor-vs-noarg-ctor emits a single func:p.R#R(); mechanism ast-extractor.ts:206-229 (no parameters field), :283-284 dedup
- **[gap]** enum constants with bodies (anonymous subclasses): their methods are attributed to the enum itself, and same-signature methods across constants conflate into one node  
  The walker does not treat enum_constant class_body as a new scope; typeChain stays [Enum]. Reproduced: enum Op { ADD { int apply(..) }, SUB { int apply(..) }; abstract int apply(..); } emits exactly ONE func:p.Op#apply(int,int) for THREE distinct declared methods. Also a constant-body-only method (onlyInA) is claimed as declared by the enum. Extremely common real-Java pattern (RoundingMode/TimeUnit style).  
  _Evidence:_ reproduced: repro out1.json case enum-constant-bodies-same-method, out3.json case enum-body-unique-method-misattributed; mechanism ast-extractor.ts:237-305 (only TYPE_DECLARATION_TYPES extend typeChain), :284 dedup
- **[gap]** @interface elements (e.g. 'String value();') emit no function node  
  annotation_type_element_declaration is not in FUNCTION_DECLARATION_TYPES, so annotation elements — which are abstract method declarations per the JLS — produce no function nodes. Deviates from R3.4's letter ('each method ... declared'); impact is minimal since function nodes carry no edges in Phase 1.  
  _Evidence:_ reproduced: repro out2.json case annotation-type-with-elements (only file + class:p.Anno, no func nodes); ast-extractor.ts:162-166
- **[gap]** varargs parameters: spread_parameter has no 'type' field, so the whole parameter text (modifiers + type + NAME) enters the function id  
  parameterTypesOf falls back to param.text when childForFieldName('type') is null; tree-sitter-java's spread_parameter defines NO fields. 'void o(int... a)' -> id 'func:p.C#o(int... a...)'; 'void log(String fmt, Object... args)' -> 'func:p.L#log(String,Object... args...)'; 'final int... a' -> 'final int... a...'. The parameter NAME and modifiers are not in R3.10's allowed id inputs; renaming a parameter changes the node id. Varargs are ubiquitous in real Java, so essentially every real repo gets malformed function ids.  
  _Evidence:_ reproduced: repro out1.json case c-style-array-dims (func:p.C#o(int... a...)), out2.json case string-varargs, out3.json cases final-varargs, multidim-varargs; AST mechanism proven in dump-ast-out.txt (spread_parameter fieldType=null); ast-extractor.ts:216-217, :223-225
- **[gap]** comments inside a parameter list become phantom parameter 'types' in the function id  
  Comments are named extras in tree-sitter and appear as namedChildren of formal_parameters; parameterTypesOf treats each named child that is not a receiver_parameter as a parameter, and with no type field falls back to its text. 'void m(int a /* width */, int b /* height */)' -> id 'func:p.C#m(int,/* width */,int,/* height */)'. Editing or deleting a comment changes the node id; violates R3.10 (comments are not structural attributes) and corrupts the declared-parameter-type list of R3.4.  
  _Evidence:_ reproduced: repro out1.json case comment-in-param-list; AST mechanism in dump-ast-out.txt (block_comment/line_comment as namedChild of formal_parameters); ast-extractor.ts:211-228
- **[gap]** local classes: two same-named local classes in different methods of one class conflate into a single node (R3.3/R3.12)  
  Local classes get typeChain [Outer, Local] regardless of which method declares them (function declarations do not extend the chain). Reproduced: Outer.m1's Local and Outer.m2's Local both map to class:p.Outer$Local; the Map dedup silently keeps one node, and their methods a()/b() are both attributed to that single class. Real JVM binary names are Outer$1Local / Outer$2Local. Legal Java, silently loses a declared type.  
  _Evidence:_ reproduced: repro out1.json case two-local-classes-same-name; mechanism ast-extractor.ts:253-254 (chain from enclosing TYPES only), :255 dedup
- **[gap]** anonymous classes: no class node is emitted, and their member methods are attributed to the enclosing declared type — conflating with genuinely declared methods  
  object_creation_expression class_body is not a type declaration, so the walker recurses through it with the unchanged typeChain. 'new Runnable(){ public void run(){} }' inside C emits func:p.C#run() — and when C itself also declares run(), the two distinct methods collapse into ONE node. Happens in method bodies and field initializers alike. Anonymous classes are ubiquitous in pre-lambda Java (listeners, Comparators), so real repos hit this constantly. The absence of a class node for the anonymous type itself is defensible under R3.3 (it is an expression, not a type declaration), but attributing its members to t…  
  _Evidence:_ reproduced: repro out1.json case anon-class-method-attribution (one func:p.C#run() for two methods), out2.json case anon-class-in-field-initializer; mechanism ast-extractor.ts:296-304
- **[gap]** named type declared inside an anonymous class body: chain skips the anonymous level  
  'new Runnable(){ class Inside {} }' inside C emits class:p.C$Inside — as if Inside were a direct nested type of C; collides/conflates with a real C.Inside if one exists. Same scope-blind-chain root cause.  
  _Evidence:_ reproduced: repro out3.json case anon-class-nested-named-type
- **[gap]** '$' in Java identifiers vs the '$' nested-chain separator: 'class Outer$Inner {}' and 'class Outer { class Inner {} }' produce the same id  
  Legal (if discouraged) Java. In one file the nested Inner node is silently dropped by the dedup (reproduced: only 2 class nodes for 3 declared types). Same FQN-only-identity root cause as known Gap 2, but this variant fires within a single file and is silently masked rather than rejected at core ingest.  
  _Evidence:_ reproduced: repro out1.json case dollar-identifier-vs-nested; ids.ts:38 NESTED_TYPE_SEPARATOR '$'
- **[gap]** JLS unicode escapes in identifiers ('class \u0043afe {}', valid Java) are rejected as file-unparseable  
  javac pre-processes \uXXXX escapes before lexing (JLS 3.3); tree-sitter-java does not, so a legal-if-obscure file errors and — via R10.4 — aborts the whole run. Vanishingly rare in real code; graceful structured error, no wrong output.  
  _Evidence:_ reproduced: repro out3.json case unicode-escape-in-identifier (file-unparseable)
- **[gap]** package/import scoped identifiers containing whitespace or comments around the dots (legal Java) are recorded as raw source text  
  readPackagePath/collectReferences take scoped_identifier.text with whitespace runs collapsed but dots NOT re-joined from identifier segments. 'package com . example;' -> packagePath 'com . example'; 'package com/* x */.example;' -> 'com/* x */.example'; 'import com . example . Foo;' -> targetName 'com . example . Foo'. Consequences: the spaced package forms a distinct packagePath (region split in core; class FQN 'com . example.Spaced' unresolvable by imports of com.example.Spaced), and the spaced import silently resolves to nothing. Valid-but-eccentric input; deterministic wrong output.  
  _Evidence:_ reproduced: repro out3.json cases package-with-spaces-around-dots, package-with-comment-inside, import-with-spaces-around-dots; ast-extractor.ts:179-181 (normalizeTypeText), :188-199, :332-360
- [by-design] a trivial syntax error in any one file poisons the entire run (no graph.json)  
  Extractor records file-unparseable and continues (R10.1 'MAY continue'); the orchestrator error gate then returns all errors and writes nothing. Whole-run abort on any parse error is specified behavior (R10.4) and listed as a Phase-1 by-design behavior in the project brief.  
  _Evidence:_ ast-extractor.ts:456-465; orchestrator.ts:186-188; requirements.md R10.1/R10.4
- [by-design] top-level statement snippets (not valid Java, e.g. 'int x = 1;') parse error-free and are extracted as a bare file node with no error recorded  
  tree-sitter-java's program rule accepts top-level statements, so hasError stays false and no file-unparseable is recorded even though javac would reject the file. R10.1 conditions the error on content 'the Tree-Sitter Java grammar' cannot process, so this lenient acceptance is within the spec's letter. Deterministic; a stray non-Java-shaped .java file quietly contributes only a file node.  
  _Evidence:_ repro out1.json cases toplevel-statement-snippet, multiple-package-decls; requirements.md R10.1
- [by-design] implicit canonical record constructor / implicit default constructors not emitted  
  R3.4 covers declared methods/constructors; implicit members have no AST declaration. Explicit canonical record ctor IS emitted correctly (func:p.RC#RC(int)).  
  _Evidence:_ repro out2.json case explicit-canonical-record-ctor; requirements.md R3.4
- [by-design] module-info.java  
  Parses without error (grammar supports module_declaration); emits only a file node with packagePath ''. requires/exports directives are not import_declarations so no references are collected — consistent with Phase-1 import-only edges. No crash, no error, no module edges.  
  _Evidence:_ reproduced: repro out2.json case module-info
- [by-design] @interface (annotation type declaration) emits a class node  
  annotation_type_declaration is deliberately included in TYPE_DECLARATION_TYPES ('for completeness') even though R3.3 lists only class/interface/enum/record. Benign, deterministic extension; annotation types are importable so a node improves stitching.  
  _Evidence:_ ast-extractor.ts:146-155; reproduced: repro out2.json case annotation-type-with-elements (class:p.Anno)
- [by-design] static / instance initializer blocks  
  Initializer blocks are not methods/constructors (R3.4) and emit no function node; the walker still recurses into them so local types inside are captured.  
  _Evidence:_ reproduced: repro out2.json case local-class-in-static-init-and-lambda (class:p.K$InInit emitted, no func for the block); requirements.md R3.4
- [by-design] duplicate same-named top-level types / duplicate identical method declarations in one file (invalid Java, parses error-free)  
  Per-file Map dedup keeps the first occurrence; deterministic. design.md explicitly anticipates this: 'identical structural identity means the same entity, so it is created once' (R3.12 note).  
  _Evidence:_ reproduced: repro out2.json cases duplicate-toplevel-types-invalid-java, duplicate-identical-methods-invalid-java; design.md:255
- [by-design] non-UTF-8 bytes (Latin-1) decoded as U+FFFD: in identifiers -> file-unparseable; in comments/strings -> clean extraction  
  readFileSync('utf8') replaces invalid bytes with U+FFFD. U+FFFD is not a legal identifier char, so an affected identifier makes hasError true and the file records file-unparseable — deterministic structured error, and U+FFFD can never reach an id. U+FFFD confined to comments/strings extracts cleanly. Consequence: a valid Latin-1-encoded Java file with non-ASCII identifiers aborts the whole run with a message that does not mention encoding; the spec is silent on encodings, and graceful-deterministic-rejection is a defensible reading of R10.1.  
  _Evidence:_ reproduced: repro out1.json cases replacement-char-identifier (file-unparseable), replacement-char-comment-only (clean); ast-extractor.ts:87 (utf8 read), :456-465
- [by-design] duplicate import declarations (legal, redundant Java) produce two RawReferences  
  References are emitted per declaration in source order; downstream importFrequency counts each resolved reference (R6.2). Whether freq=2 for a redundant import is desired is a stitcher-lane question; extractor side is per-spec.  
  _Evidence:_ reproduced: repro out2.json case duplicate-imports (refs ['a.b.C','a.b.C'])
- [by-design] imports below top level  
  collectReferences scans only root.namedChildren; Java only permits top-level import declarations, so nothing is missed.  
  _Evidence:_ ast-extractor.ts:334-336
- [by-design] fields, annotations-on-members, and other unhandled member kinds  
  field_declaration etc. emit no nodes (contract kinds are file/class/function only); the walker still recurses through them so nested declarations (incl. types in field initializers) are found.  
  _Evidence:_ ast-extractor.ts:302-304; shared contract GraphNode.kind; repro out2.json case anon-class-in-field-initializer
- [already-handled] hasError gate: extractor never silently extracts from a tree containing ERROR/MISSING nodes  
  extract() checks tree.rootNode.hasError BEFORE extractFromRoot and records file-unparseable + returns null; no partial per-file extraction from error trees is possible. Verified empirically: replacement-char-identifier and unicode-escape cases return the error, never partial nodes.  
  _Evidence:_ ast-extractor.ts:449-465; tests ast-extractor.test.ts:275 (records file-unparseable), :295 (continues with remaining files); repro out1.json case replacement-char-identifier
- [already-handled] parser.parse() returning null  
  Defensive branch records file-unparseable and returns null. web-tree-sitter only returns null on cancellation/no-language, unreachable in this setup, but handled.  
  _Evidence:_ ast-extractor.ts:435-447
- [already-handled] unreadable file (read throws)  
  try/catch around deps.readFile records file-unreadable with the relative path and returns null; run continues per R10.2 (then aborts at the orchestrator gate per R10.4).  
  _Evidence:_ ast-extractor.ts:420-433; test ast-extractor.test.ts:260
- [already-handled] type declaration with no name field (malformed)  
  Defensive: skips the unnamed type but recurses into it. In practice unreachable because any tree that could produce it has hasError=true and is rejected first.  
  _Evidence:_ ast-extractor.ts:247-251
- [already-handled] callable declared at file scope (tree-sitter-java permissively parses top-level methods without error)  
  typeChain.length===0 guard skips the function silently (no FQN exists); the rest of the file is still extracted. Reproduced: 'void free() {} class Real {}' parses error-free, emits only class:Real.  
  _Evidence:_ ast-extractor.ts:273-276; repro out1.json case toplevel-method
- [already-handled] multiple package declarations in one file (invalid Java, parses error-free)  
  readPackagePath returns the first package_declaration's name; deterministic. Reproduced: 'package a; package b;' -> packagePath 'a'.  
  _Evidence:_ ast-extractor.ts:188-199; repro out1.json case multiple-package-decls
- [already-handled] record declarations  
  record_declaration is in TYPE_DECLARATION_TYPES; record class nodes emitted.  
  _Evidence:_ ast-extractor.ts:149-155; test ast-extractor.test.ts:114
- [already-handled] enum declarations incl. enum constructors and members after the constant list  
  enum_declaration emits a class node; enum constructors and methods inside enum_body_declarations are reached by generic recursion and attributed to the enum FQN.  
  _Evidence:_ ast-extractor.ts:149-155, :302-304; repro out2.json case enum-constructor (func:p.E#E(int)); test ast-extractor.test.ts:114
- [already-handled] sealed / non-sealed / permits (Java 17)  
  tree-sitter-java 0.23.5 parses sealed hierarchies without error; all three types extracted.  
  _Evidence:_ reproduced: repro out2.json case sealed-interface-permits
- [already-handled] modern Java syntax: switch expressions, record patterns + guards (21), text blocks (15), instanceof patterns (16), var (10), unnamed variable _ (22)  
  All parse cleanly with the pinned grammar (tree-sitter-java 0.23.5); no whole-run poisoning from modern mainstream syntax. (Post-Java-22 preview syntax untested.)  
  _Evidence:_ reproduced: repro out2.json cases switch-expr-record-patterns, text-block, instanceof-pattern-var, unnamed-variable-java22
- [already-handled] interface methods: abstract, default, static, private  
  All four forms are method_declaration and emit function nodes with the interface FQN.  
  _Evidence:_ reproduced: repro out2.json case interface-default-static-private (func:p.I#a()/d()/s()/p())
- [already-handled] abstract and native methods in classes (no body)  
  Bodiless method_declarations emit function nodes normally.  
  _Evidence:_ reproduced: repro out2.json case abstract-and-native-methods
- [already-handled] generic classes/methods, bounded type params, wildcard generic parameter types  
  Type parameters do not enter the class id (name field only). Parameter types render as written with whitespace runs collapsed ('java.util.List<? extends U>'); deterministic. IDs may contain spaces/angle brackets — cosmetic only.  
  _Evidence:_ reproduced: repro out2.json case generic-and-wildcard-params, out3.json case newline-inside-generic-param
- [already-handled] overloads distinguished by declared parameter-type list  
  Non-varargs overloads produce distinct ids per R3.4.  
  _Evidence:_ test ast-extractor.test.ts:158; parameterTypesOf ast-extractor.ts:206-229
- [already-handled] C-style array dimensions on parameter names ('int a[]')  
  The dimensions field is appended to the type text, so m(int a[]) and n(int[] a) both render 'int[]' — correct, they are identical signatures.  
  _Evidence:_ ast-extractor.ts:219-222; reproduced: repro out1.json case c-style-array-dims (func:p.C#m(int[]) == form of n)
- [already-handled] 'int...' vs 'int[]' overload distinction  
  They cannot coexist in one class in Java (same erasure), so distinctness of the rendered forms is moot; no false merging possible. (Rendered varargs text is wrong per the varargs gap, but distinct.)  
  _Evidence:_ repro out1.json case c-style-array-dims
- [already-handled] receiver parameter ('Foo this')  
  receiver_parameter is explicitly skipped; 'void m(C this, int a)' -> func:p.C#m(int).  
  _Evidence:_ ast-extractor.ts:213-215; reproduced: repro out1.json case receiver-parameter
- [already-handled] parameter annotations and 'final' modifier on normal parameters  
  Annotations/modifiers live in the formal_parameter's modifiers, not the type field: '@Deprecated String s, final int a' -> (String,int).  
  _Evidence:_ reproduced: repro out2.json case annotated-and-final-params
- [already-handled] constructors  
  constructor_declaration emits function nodes named after the class, incl. nested-class constructors.  
  _Evidence:_ test ast-extractor.test.ts:177; ast-extractor.ts:162-166
- [already-handled] local class declared inside a lambda body  
  Generic recursion reaches lambda bodies; class:p.K$InLambda emitted (subject to the same conflation caveat as other local classes).  
  _Evidence:_ reproduced: repro out2.json case local-class-in-static-init-and-lambda
- [already-handled] multiple top-level types in one file  
  Each top-level type gets its own class node; all share the file's packagePath/directoryPath/definedInFile.  
  _Evidence:_ test ast-extractor.test.ts:114-137
- [already-handled] empty file / comments-only file / package-declaration-only file (package-info.java)  
  All parse error-free and emit exactly the file node (R3.2); package-info carries its packagePath. No spurious errors, no missing file node.  
  _Evidence:_ reproduced: repro out1.json cases empty-file, comments-only, package-only
- [already-handled] annotated package declaration (package-info.java with @Deprecated or fully-qualified annotations)  
  readPackagePath scans only DIRECT named children of package_declaration for scoped_identifier/identifier, so annotation names (even scoped ones like @javax.annotation.X, which contain a nested scoped_identifier) cannot be mistaken for the package name.  
  _Evidence:_ ast-extractor.ts:188-199; reproduced: repro out1.json cases annotated-package-info, fq-annotated-package-info (pkg 'p.q.r' / 'p.q.s')
- [already-handled] UTF-8 BOM at file start  
  Node's readFileSync(utf8) preserves the BOM; the grammar treats it as ignorable — parse succeeds with no ERROR and the BOM does NOT leak into packagePath or any id. (Lenient relative to javac, which rejects BOMs; acceptance is the safe direction.) A BOM-only file behaves like an empty file.  
  _Evidence:_ reproduced: repro out1.json case utf8-bom (clean 'class:p.BomClass'), out2.json case bom-only-file; fixture verified to start with U+FEFF
- [already-handled] CRLF line endings  
  Parses and extracts identically to LF sources.  
  _Evidence:_ reproduced: repro out1.json case crlf-endings
- [already-handled] Unicode identifiers (class Café) in valid UTF-8  
  Parse and extraction work; non-ASCII flows into ids deterministically (class:p.Café). NFC/NFD variants of visually identical names yield distinct ids — byte-deterministic, so acceptable.  
  _Evidence:_ reproduced: repro out1.json case unicode-identifier
- [already-handled] astral-plane characters (emoji) in comments/strings before declarations: no offset corruption  
  node.text extraction after emoji remains correct in web-tree-sitter 0.26.10; ids clean.  
  _Evidence:_ reproduced: repro out1.json case emoji-before-decl (class:p.AfterEmoji)
- [already-handled] huge files (web-tree-sitter buffer limits)  
  A 10MB / 200,000-method single file parses and extracts 200,002 nodes in ~12s with no error. Multi-hundred-MB or >2GB single files untested (would exhaust WASM heap eventually — hypothesis; unrealistic for hand-written Java).  
  _Evidence:_ reproduced: repro out-huge.json (1.3MB/20k methods, ~1s), out-huge2.json (10MB/200k methods, ~12s, nodes:200002)
- [already-handled] single-segment package / single-segment import (bare identifier instead of scoped_identifier)  
  Both branches match 'identifier' as well as 'scoped_identifier'. 'import Foo;' records targetName 'Foo'.  
  _Evidence:_ ast-extractor.ts:192, :345; reproduced: repro out2.json case single-segment-import
- [already-handled] static imports and static wildcard imports  
  'static' is an anonymous token; name recorded as written ('x.Y.z', 'x.Y.*'). Wildcards keep the trailing .* and intentionally resolve to nothing in Phase 1 (documented).  
  _Evidence:_ ast-extractor.ts:338-357 (doc :319-330); tests ast-extractor.test.ts:224, :238; repro out2.json case single-segment-import
- [already-handled] web-tree-sitter initialization: once per extractor, one extractor per run, WASM paths deterministic  
  Parser.init + Language.load run once in createAstExtractor; the orchestrator creates exactly one extractor per run and extract() is synchronous per file. WASM paths resolve via createRequire (cwd-independent); host-absolute paths are used only for loading and never enter output. Double-running the full 22-case battery produces byte-identical results.  
  _Evidence:_ ast-extractor.ts:403-416, :128-142; orchestrator.ts:162; reproduced: out1.json==out1b.json, out2.json==out2b.json (cmp byte-identical)
- [already-handled] AST discarded after extraction (R3.13)  
  tree.delete() in finally; ExtractionResult is plain data only.  
  _Evidence:_ ast-extractor.ts:449-471
- [already-handled] extract() can throw (not return a Result) if CollectedFile.relativePath violates the POSIX-root-relative contract (buildFileId guard), and the orchestrator has no try/catch around extract  
  Defensive guard by design (R9.4): reachable only via an internal contract violation since the SourceFileCollector normalizes paths. Noted because a future alternate caller (e.g. a CLI passing raw paths) would crash instead of getting a structured error. Confidence: reasoned-from-code.  
  _Evidence:_ ids.ts:50-69; ast-extractor.ts:370 (buildFileId inside extractFromRoot, outside the try); orchestrator.ts:166-174
- [already-handled] R3.12 uniqueness of emitted ids  
  The per-file Map keyed by id guarantees the emitted per-file node set never contains two nodes with one id. The flip side is that structurally DISTINCT declarations mapping to one FQN are silently conflated (see the gap entries); and cross-file duplicate FQNs are not deduped at the orchestrator (known Gap 2 — not re-reported).  
  _Evidence:_ ast-extractor.ts:255, :284; orchestrator.ts:172

#### `packages/parser/src/ast-extractor.test.ts`

- **[gap]** test-coverage holes in ast-extractor.test.ts  
  No tests for: varargs (would have caught the 'int... a...' id bug), comments in parameter lists, enum constants with bodies, local/anonymous classes, record compact constructors, @interface, package-info/module-info, BOM/CRLF/encoding, package declarations with whitespace. The suite covers the happy paths and the two error reasons only.  
  _Evidence:_ ast-extractor.test.ts:95-380 (full read; enumerated tests cover R3.2-R3.9 happy paths, imports, R10.1/R10.2, one property test)

### packages/parser — source collection & input validation

> Scope: `source-collector.ts`, `input-validator.ts` (+ tests) · parser spec R1, R2  
> **51 cases examined** — 10 gap · 3 by-design · 38 already-handled


#### `packages/parser/src/input-validator.ts`

- **[gap]** root directory mode r-- (readable but NOT searchable: no execute bit)  
  The R1.6 probe (opendir + read one entry) succeeds with only the read bit, and collection succeeds via getdents (names + d_type need no x). Every subsequent file read then fails EACCES, so the run aborts with per-file 'file-unreadable' errors blaming individual files, when the real cause is a missing search bit on the root. Structured, no partial output, spec-LETTER compliant (R1.6 defines readable as open+list) - but the diagnosis is misattributed and confusing. Low severity.  
  _Evidence:_ reproduced: chmod 444 root -> validator passes, parse FAILED with 'file-unreadable: A.java' (repro/parser-collect/out/p8-rootnoexec.log); input-validator.ts:154-179
- [already-handled] null / undefined / empty / whitespace-only projectDirectory  
  Rejected up front with exactly one no-path-provided error before any filesystem call (R1.3, R1.2).  
  _Evidence:_ input-validator.ts:89-100; tests 'rejects null|undefined|empty string|whitespace only with no-path-provided' and 'does not touch the filesystem when no path is provided' (input-validator.test.ts:56-85)
- [already-handled] path with leading/trailing whitespace around a real path (not whitespace-only)  
  trim() is used only for the emptiness test; the untrimmed path is resolved. Correct: whitespace-containing names are legal POSIX filenames. A typo like ' /real/path' yields path-not-found that echoes the provided path, so the user can see the stray space.  
  _Evidence:_ input-validator.ts:92,102-103 (providedPath = untrimmed; path.resolve on it)
- [already-handled] missing path (ENOENT)  
  path-not-found with the provided path (R1.4).  
  _Evidence:_ input-validator.ts:109-119; tests 'rejects a missing path with path-not-found' (injected) and 'rejects a real missing path' (real FS)
- [already-handled] ENOTDIR from stat (a path component is a regular file, e.g. /proj/file.txt/sub)  
  Mapped to path-not-found, which is accurate: no such directory exists. Spec does not distinguish this sub-case.  
  _Evidence:_ input-validator.ts:111 (code === 'ENOENT' || code === 'ENOTDIR')
- [already-handled] EACCES/EPERM from stat (unreachable path component)  
  directory-unreadable with provided path (R1.6).  
  _Evidence:_ input-validator.ts:120-130; test 'EACCES from stat surfaces as directory-unreadable'
- [already-handled] exotic stat failures: NUL byte in path (ERR_INVALID_ARG_VALUE), ENAMETOOLONG, ELOOP (cyclic symlink chain as root)  
  All non-ENOENT/EACCES stat failures fall into the generic 'could not be accessed' path-not-found branch: structured single error, no crash. Reproduced for NUL byte.  
  _Evidence:_ reproduced: node validateInput('a\u0000b') -> {ok:false, errors:[{reason:'path-not-found', message:'Project directory path could not be accessed: a\u0000b'}]} (repro/parser-collect/out/p13-nul.log); input-validator.ts:131-138
- [already-handled] path exists but is a regular file  
  path-not-directory (R1.5).  
  _Evidence:_ input-validator.ts:142-150; tests 'rejects a file path with path-not-directory' and 'rejects a real file with path-not-directory'
- [already-handled] path is a FIFO / socket / device node  
  stats.isDirectory() false -> path-not-directory. Same branch as the regular-file case.  
  _Evidence:_ input-validator.ts:142-150 (reasoned-from-code; isDirectory() is false for all non-directory kinds)
- [already-handled] project ROOT itself is a symlink to a directory  
  fs.stat follows the root symlink, so the link is accepted and the target tree is walked (R2.3 only covers entries encountered DURING discovery, not the root). Output is byte-identical to running on the real path because ids derive from relativePath only.  
  _Evidence:_ reproduced: p7-real, p7-link, p7-dots all produced sha256 246015be4e3a...9ecf (repro/parser-collect/out/p7-*.graph.json)
- [already-handled] root is a symlink to a FILE  
  stat follows -> not a directory -> path-not-directory.  
  _Evidence:_ reproduced: p14 'linktofile' -> path-not-directory (run.sh p14-symvariants)
- [already-handled] root is a BROKEN symlink  
  stat ENOENT -> path-not-found.  
  _Evidence:_ reproduced: p14 'broken' -> path-not-found
- [already-handled] trailing slash, '.' , '..' segments in the input path  
  path.resolve normalizes before stat; graph output identical to the canonical form.  
  _Evidence:_ reproduced: p7-dots ('real/../real/') digest equals p7-real digest
- [already-handled] root directory mode --x (searchable but not readable)  
  opendir fails EACCES -> directory-unreadable at validation time (R1.6).  
  _Evidence:_ reproduced: chmod 111 root -> 'directory-unreadable: Project directory cannot be read due to insufficient permissions' (repro/parser-collect/out/p8b-rootnoread.log)
- [already-handled] dir.close() throws after a successful read (readability probe false-negative)  
  close runs in finally; a throw from it is caught by the outer catch and reported as directory-unreadable. Wrong-ish reason in a vanishingly rare case; structured either way.  
  _Evidence:_ input-validator.ts:154-179 (reasoned-from-code); test 'closes the directory handle even when read fails' covers the finally
- [already-handled] TOCTOU: root deleted between stat and opendir  
  opendir ENOENT falls into the generic 'could not be opened' directory-unreadable branch. Reason label is slightly off (not a permission problem) but the failure is structured, single, and fatal as required.  
  _Evidence:_ input-validator.ts:161-178 (reasoned-from-code)
- [already-handled] relative input path resolved against process.cwd (determinism of output)  
  absolutePath varies with cwd but never enters graph.json; ids use relativePath only (R9.4). parse-cli additionally resolves user args against INIT_CWD.  
  _Evidence:_ input-validator.ts:103; ids.ts guard rejects absolute material; parse-cli.ts:37-41; p7 digests identical across three path spellings
- [already-handled] validator ordering guarantee: all validation before any collection  
  stat completes before opendir; orchestrator only calls collect after validate returns ok (R1.2).  
  _Evidence:_ test 'completes stat before opendir (validation before collection, R1.2)'; orchestrator.ts:143-152

#### `packages/parser/src/source-collector.ts`

- **[gap]** directory tree deeper than PATH_MAX (~4096 bytes absolute path)  
  readdir on the too-long absolute path fails ENAMETOOLONG, which is not EACCES/EPERM, so it becomes fatal directory-unreadable with the generic '(it could not be read)' detail, aborting the ENTIRE parse even though valid .java files exist elsewhere in the tree. R2.1 promises discovery 'at any nesting depth'; the OS caps it and the error misdiagnoses the cause. Unrealistic input (git itself struggles beyond PATH_MAX) -> Low.  
  _Evidence:_ reproduced: 400 x 20-char dirs + Good.java at root -> FAILED 'directory-unreadable: Directory cannot be read (it could not be read): .../p10-deep/dddd...' (repro/parser-collect/out/p10-deep.log); source-collector.ts:127-143
- **[gap]** TWO OR MORE unreadable subdirectories: which one is reported  
  walk iterates entries in raw readdir enumeration order and early-returns the FIRST error, so the identity of the reported directory depends on filesystem enumeration order and can differ across runs/hosts. graph.json is unaffected (R9 covers output only) and R2.4 does not pin which directory to name - but error output is non-deterministic, which cuts against the project's determinism ethos. Sorting entries before the walk (or collecting all fatal errors) would fix it. Low.  
  _Evidence:_ source-collector.ts:145,156-159 (entries used in readdir order; return nestedError immediately); sort happens only at :200 after the walk (reasoned-from-code)
- **[gap]** regular file swapped for a FIFO between collect and read  
  HYPOTHESIS, contrived race: readFileSync opens the FIFO O_RDONLY and blocks until a writer appears -> parse hangs instead of erroring. Requires an adversarial concurrent modification; could not be reproduced deterministically. Check needed: swap file for mkfifo mid-run. Low.  
  _Evidence:_ ast-extractor.ts:421-422 uses fs.readFileSync with no O_NONBLOCK/type re-check (reasoned-from-code, unverified timing)
- **[gap]** same logical repo checked out on macOS (NFD-normalizing FS) vs Linux (byte-preserving): unicode filename normalization  
  HYPOTHESIS (no macOS host available): the filesystem itself stores different filename bytes, so relativePath, node ids, and sort order differ across platforms for the same logical project -> graph.json not byte-identical cross-platform. R9.1 defines identical input via file CONTENT bytes only and is silent on filename normalization; the collector performs none. Per-platform determinism is unaffected. Low.  
  _Evidence:_ source-collector.ts:93-98 (no unicode normalization applied); check needed: clone a repo with an NFD-named .java on macOS and diff digests
- **[gap]** filename containing bytes that are not valid UTF-8 (e.g. latin-1 0xE9)  
  Node's readdir decodes names as UTF-8 and substitutes U+FFFD for invalid bytes. The collector then builds absolutePath from the MANGLED string, so the later readFileSync targets a nonexistent name: guaranteed ENOENT -> file-unreadable recorded -> WHOLE RUN aborts (R10.4 gate) blaming a file that is perfectly readable under its real name. Medium: structured but wrong diagnosis, and one legacy-encoded filename anywhere in the repo kills the entire parse.  
  _Evidence:_ reproduced: p2-badutf8 -> FAILED 'file-unreadable: Java source file could not be read: �.java' while ls -b shows \351.java on disk (repro/parser-collect/out/p2-badutf8.log, p2-ls.txt); source-collector.ts:153,167-170
- **[gap]** TWO distinct invalid-byte filenames decoding to the SAME replacement string (0xE9.java and 0xF9.java)  
  Both decode to '�.java', so the collector returns TWO CollectedFile entries with IDENTICAL relativePath (and identical mangled absolutePath) - the canonical-uniqueness invariant that downstream file-id minting relies on is violated by the collector itself. Currently masked because both reads fail (previous entry), but it proves collect() can emit duplicate relativePaths. Folded into the invalid-UTF-8 candidate.  
  _Evidence:_ reproduced: collectSourceFiles on p2b-dupe returned two entries both with relativePath '�.java' (run captured in audit transcript; fixture repro/parser-collect/p2b-dupe)
- **[gap]** filename containing a literal backslash (legal on Linux, e.g. from unpacking a Windows-authored zip)  
  The collector passes 'A\B.java' through as relativePath (it only splits on path.sep='/'), the file parses fine, then buildFileId's assertRootRelativePosixPath THROWS Error('relativePath must use forward-slash separators...'). Nothing catches it: ast-extractor's extract uses try/FINALLY with no catch, the orchestrator has no try around extract, and parse-cli's void main() lets the rejection crash the process with a raw stack trace. Violates the hard rule that errors are structured Results (and R10.5). One such file anywhere kills the whole run unstructured. High (process crash, plausible-if-rare input).  
  _Evidence:_ reproduced: p1-backslash -> uncaught 'Error: relativePath must use forward-slash separators, not backslashes: A\B.java at assertRootRelativePosixPath (ids.js:50) ... at parseProject ... at async main' (repro/parser-collect/out/p1-backslash.log); source-collector.ts:93-98,166; ids.ts:54-58; ast-extractor.ts:449-471 (no…
- **[gap]** root-level filename matching /^[A-Za-z]:/ (e.g. 'X:y.java'; colon legal on Linux)  
  Same crash via ids.ts's drive-letter guard: relativePath 'X:y.java' triggers throw Error('relativePath must not be an absolute host path with a drive letter'). Also triggered by a top-level directory named like 'c:'. Folded into the backslash candidate (same defect: collector emits relativePaths that violate ids invariants; downstream throws instead of returning a structured error).  
  _Evidence:_ reproduced: p1b-colon -> uncaught 'Error: relativePath must not be an absolute host path with a drive letter: X:y.java' (repro/parser-collect/out/p1b-colon.log); ids.ts:64-67
- **[gap]** hidden directories and VCS/build internals: .git/, target/, build/, node_modules/ are fully traversed and their .java files collected  
  R2.1's letter ('every Java_Source_File ... at any nesting depth') is faithfully implemented - there is NO exclusion list. Consequences on real repos: (a) stale/backup .java under .git or build output enters the graph as live code; (b) Maven/Gradle generated sources (target/generated-sources) are indexed alongside handwritten code, and a stale target/ copy of a moved/renamed class re-mints the same FQN -> duplicate node ids -> core ingest rejects the whole index (this consequence DEEPENS known Gap 2); (c) large .git object trees / node_modules are walked sequentially for nothing (scale/wasted work - walk is stric…  
  _Evidence:_ reproduced: p11-gitbuild -> OK with ids file:.git/stash/Old.java and file:target/generated-sources/Gen.java in graph.json (repro/parser-collect/out/p11-gitbuild.graph.json); source-collector.ts:145-177 (no name-based filtering of directories)
- [by-design] file named exactly '.java' (dotfile, empty stem)  
  '.java'.endsWith('.java') is true, so it is collected and becomes node id 'file:.java'. R2.2 says 'a regular file whose name ends with the .java extension' - the letter of the spec includes it. Parses fine if content is valid Java; graph contains a file node with an extension-only name. Cosmetic oddity at most.  
  _Evidence:_ reproduced: p5-dotjava -> OK, node ids include 'file:.java' and 'class:Hidden' (repro/parser-collect/out/p5-dotjava.graph.json)
- [by-design] project whose sources are reachable ONLY through symlinks (Bazel/Nix-style symlink farm, or src -> ../shared-src)  
  All symlinked entries are skipped (R2.3), so such a project yields no-java-files (R2.5) and the parse fails, even though the code is real. Documented, deliberate determinism trade-off - but a real-world friction worth knowing about for monorepo/build-farm layouts.  
  _Evidence:_ source-collector.ts:149-151 + 188-196; spec R2.3/R2.5
- [by-design] no-java-files / directory-unreadable error messages embed absolute host paths  
  R9.4 forbids host paths only in the Graph_Output_File; errors are diagnostics, not output, and R2.4/R1.4 explicitly require the offending path in the error.  
  _Evidence:_ source-collector.ts:140,192; requirements.md R9.4 vs R2.4
- [already-handled] recursive discovery at any depth (normal case)  
  Recursive walk; 300-level-deep tree parses fine. Async recursion suspends frames on the heap, so no native stack overflow at realistic depths.  
  _Evidence:_ reproduced: p10b-deep (300 levels, file at bottom) -> OK, 2 nodes; test 'discovers .java files nested at any depth'
- [already-handled] .JAVA / .Java uppercase extensions  
  Case-sensitive endsWith('.java') per R2.2.  
  _Evidence:_ source-collector.ts:166; test 'excludes non-.java files and .JAVA (case-sensitive)'
- [already-handled] near-miss names: Config.java.bak, readme.txt, 'java' with no dot  
  Excluded without error (R2.3).  
  _Evidence:_ test 'excludes non-.java files and .JAVA (case-sensitive)' covers .bak and .txt; endsWith('.java') is false for 'java'
- [already-handled] directory literally named 'Dir.java'  
  isDirectory() is tested before isFile(), so it is traversed as a directory, never collected as a file; children collected under the 'Dir.java/' prefix. Matches R2.2's 'regular file' requirement.  
  _Evidence:_ reproduced: p3-dirjava -> OK, 4 nodes (Dir.java/Inner.java collected, Dir.java itself not a file node); source-collector.ts:155-161
- [already-handled] non-regular files matching *.java: FIFO, socket, device node  
  isSymbolicLink/isDirectory/isFile all false for FIFO etc. -> falls through and is skipped without error (R2.3 'regular file').  
  _Evidence:_ reproduced: p4-fifo (mkfifo P.java + Good.java) -> OK, only Good.java collected; source-collector.ts:163-176
- [already-handled] symlink to file, symlink to dir, broken symlink, cyclic symlink inside the tree  
  Dirent.isSymbolicLink() (d_type from getdents, never follows) is checked FIRST, so every symlink is skipped regardless of target; broken/cyclic targets are never resolved, preventing cycles (R2.3). lstat-vs-stat semantics are correct because readdir withFileTypes reports the link itself.  
  _Evidence:_ source-collector.ts:149-151,66; tests 'skips symbolic links and does not follow them' (real FS) and 'does not follow symbolic links (injected deps)'
- [already-handled] symlink NAMED like a Java file ('Linked.java') or like a directory  
  Symlink check precedes the extension check, so a .java-named link is skipped, not collected.  
  _Evidence:_ source-collector.ts:145-151 (comment documents the ordering); injected-deps test includes 'Linked.java' symlink
- [already-handled] unreadable subdirectory mid-walk (EACCES/EPERM)  
  Fatal directory-unreadable naming the offending directory (R2.4).  
  _Evidence:_ source-collector.ts:127-143; test 'returns directory-unreadable when a subdirectory cannot be read'
- [already-handled] subdirectory deleted between parent readdir and its own readdir (TOCTOU)  
  readdir ENOENT -> fatal directory-unreadable with generic '(it could not be read)' detail. Structured, no partial output; reason label generic but acceptable.  
  _Evidence:_ source-collector.ts:127-143 (non-EACCES codes take the generic detail branch; reasoned-from-code)
- [already-handled] file deleted between collect and read (TOCTOU at parse time)  
  Downstream readFileSync throws, extract records file-unreadable and continues; the R10.4 gate then returns all errors and writes nothing; prior graph.json left intact.  
  _Evidence:_ ast-extractor.ts:420-433; orchestrator.ts:186-188 (reasoned-from-code)
- [already-handled] empty readable repo / repo with only non-.java files  
  Fatal no-java-files naming the root (R2.5).  
  _Evidence:_ source-collector.ts:188-196; test 'returns no-java-files error for an empty (but readable) project'
- [already-handled] case-only filename differences: A.java vs a.java on a case-sensitive FS  
  Both collected; byte-wise order puts uppercase first (0x41 < 0x61), deterministic. (On case-insensitive filesystems the pair cannot coexist, so no cross-platform divergence from THIS case alone.)  
  _Evidence:_ reproduced: p12-case -> OK, 4 nodes; source-collector.ts:108-110,200
- [already-handled] unicode filenames incl. astral-plane characters: canonical byte-wise ordering  
  compareByteWise sorts by UTF-8 encoding (Buffer.compare), avoiding the UTF-16 code-unit divergence for non-BMP characters (R2.6, R9.5). NFC and NFD spellings of the same character coexist on Linux as distinct files and sort deterministically.  
  _Evidence:_ reproduced: p9-nfcnfd (NFC e-acute + NFD e-acute) -> OK, both collected as distinct nodes; source-collector.ts:100-110
- [already-handled] filename containing a double-quote or a literal newline  
  Collected normally; JSON.stringify escaping in the serializer produces valid JSON (jq parses it); node ids contain the literal newline, byte-wise ordering well-defined.  
  _Evidence:_ reproduced: p6-quotenl -> OK; jq lists ids 'file:A"B.java' and 'file:New\nLine.java' from a valid graph.json
- [already-handled] collected result independent of filesystem enumeration order  
  Byte-wise sort at the end of collection; property test drives natural/reversed/seeded-shuffled enumeration orders to identical sorted results (R2.6, R9.5).  
  _Evidence:_ source-collector.ts:200; property test 'collected result is independent of filesystem enumeration order' (100 runs)
- [already-handled] filesystems reporting d_type DT_UNKNOWN (some XFS/NFS/ReiserFS configurations)  
  Node's fs.readdir withFileTypes internally falls back to lstat for UV_DIRENT_UNKNOWN entries, so isFile/isDirectory/isSymbolicLink remain correct and symlink-skip semantics are preserved (lstat, not stat). Handled by the runtime, not this code; could not exercise on this ext4 host.  
  _Evidence:_ Node internals (lib/internal/fs/utils.js getDirent lstat fallback) - reasoned from runtime source knowledge, confidence: hypothesis for exotic-FS behavior
- [already-handled] readdir throwing a non-Error value or an error without a code  
  errorCode() defensively extracts a string code only when present; anything else takes the generic 'it could not be read' fatal branch.  
  _Evidence:_ source-collector.ts:75-85,133-142
- [already-handled] collector invoked with a nonexistent root (defensive; orchestrator can't normally do this, but TOCTOU root-deleted-after-validate can)  
  First readdir fails ENOENT -> structured fatal directory-unreadable.  
  _Evidence:_ source-collector.ts:127-143; memDeps test throws ENOENT for unknown dirs
- [already-handled] hard links: two directory entries for the same inode  
  Both are regular files and both are collected as distinct files with distinct relativePaths - correct per R2.2 (no inode dedup promised). If the duplicated content declares the same package+class it re-mints the same FQN -> that consequence is exactly known Gap 2 (not re-reported).  
  _Evidence:_ source-collector.ts:163-172 (reasoned-from-code; entries are independent regular files)
- [already-handled] graph.json written INSIDE the project root (default output) being re-collected on a second run  
  graph.json does not end with .java, so a second run does not ingest the first run's output.  
  _Evidence:_ source-collector.ts:166; orchestrator.ts:65,122 (default output name)
- [already-handled] sort comparator allocates two Buffers per comparison (scale)  
  O(n log n) Buffer.from allocations at 100k files is measurable but not a correctness issue; noted for the scalability cluster. Sequential (non-parallel) directory walk is the bigger scale factor, noted under the VCS/build-dirs entry.  
  _Evidence:_ source-collector.ts:108-110,200

### packages/parser — symbol table & stitching

> Scope: `symbol-table.ts`, `stitcher.ts` (+ tests) · parser spec R4, R5, R6  
> **36 cases examined** — 8 gap · 3 by-design · 25 already-handled


#### `packages/parser/src/symbol-table.ts`

- **[gap]** Cross-kind shadow FALSE EDGE: 'import static p.C.m;' when a class named m also exists in package p.C  
  Because the class key wins the collision, a static-member import would resolve to class:p.C.m (a different entity than the imported static member of class p.C) and mint a false edge to the wrong class. Requires a lowercase class name or a package spelled like a class FQN — legal but very unusual Java. Folded into the static-import candidate.  
  _Evidence:_ reasoned-from-code + collision winner reproduced (symbol-table.ts:130-144, stitcher.ts:133-156); full false-edge fixture not built (contrived input)
- [already-handled] Class keyed by FQN packagePath.simpleName (R4.2)  
  classKey strips the 'class:' prefix; the id already encodes the FQN, so the key is exact.  
  _Evidence:_ symbol-table.ts:67-69; test 'keys a class by packagePath.simpleName (R4.2)' (symbol-table.test.ts:177)
- [already-handled] Default-package class keyed by simple name alone (R4.3)  
  The id for a default-package class is 'class:' + simpleName (buildClassFqn omits the package join), so the derived key is the simple name.  
  _Evidence:_ ids.ts:104-107; symbol-table.ts:67-69; test 'keys a default-package class by simple name alone (R4.3)' (symbol-table.test.ts:187)
- [already-handled] Function keyed by enclosingClassFqn.simpleName, parameter list dropped (R4.4)  
  functionKey splits at '#', truncates at '(' — overloads intentionally collide by key.  
  _Evidence:_ symbol-table.ts:79-91; test 'keys a function by enclosingClassFqn.simpleName, ignoring params (R4.4)' (symbol-table.test.ts:194)
- [already-handled] Function overloads collide on one key; canonical-first node retained (R4.5)  
  By design R4.4 keys ignore params, so overloads collide; sorted-first-insert-wins deterministically retains the min-id node. Nothing edge-producing consumes function keys in Phase 1 (static imports that hit them are dropped by R5.2), so which overload wins has no output effect today.  
  _Evidence:_ symbol-table.ts:130-144; test 'overloaded functions collide on key and retain the canonical-first id (R4.5)' (symbol-table.test.ts:209); fc property (symbol-table.test.ts:135)
- [already-handled] Cross-kind key collision: class 'p.C.m' vs function key 'p.C.m' (method m on class p.C)  
  Deterministic: the class node always wins because 'class:' < 'func:' byte-wise, so canonical-first (R4.5) systematically favors class entries over function entries on the same key. Reproduced with dist/symbol-table.js: lookup('p.C.m') -> 'class:p.C.m' when both exist, 'func:p.C#m()' when only the function exists.  
  _Evidence:_ reproduced: node -e over packages/parser/dist/symbol-table.js; symbol-table.ts:130-144
- [already-handled] Class-class key collision between two DISTINCT class node ids  
  Impossible: the class key IS the id minus its prefix, so distinct class ids always yield distinct keys. Same-FQN classes in different source roots mint the SAME id (that is Gap 2, upstream in ids.ts); the symbol table then sees one key mapping to one id and stays deterministic. Deepens Gap 2 only in the sense that the table cannot distinguish the two entities.  
  _Evidence:_ symbol-table.ts:67-69; docs/gaps.md Gap 2
- [already-handled] Duplicate node ids in the input array (multi-source-root scenario)  
  Sorted first-insert-wins over identical ids is order-independent (same key, same value either way); the table stays deterministic. The identity collision itself is known Gap 2 (extractor/ids lane), not re-reported.  
  _Evidence:_ symbol-table.ts:135-144; docs/gaps.md Gap 2
- [already-handled] Malformed function id with no '#' separator  
  functionKey returns null and the node is simply not keyed (defensive; the extractor always emits '#'). Silent drop from the table is the worst case, never a throw.  
  _Evidence:_ symbol-table.ts:81-84, 138-140
- [already-handled] Function id with '#' but no '(' parameter list  
  parenIndex < 0 branch uses the whole tail as the simple name (defensive; extractor ids always contain '()').  
  _Evidence:_ symbol-table.ts:87-89
- [already-handled] file / group / repository kind nodes are never keyed  
  keyFor's default branch returns null for any kind other than class/function (parser never produces group/repository, but the switch is total anyway).  
  _Evidence:_ symbol-table.ts:97-106; test 'file nodes are not keyed' (symbol-table.test.ts:234)
- [already-handled] build([]) and lookup of absent/empty-string keys (R4.7)  
  Empty node set yields an empty map; lookup returns null for any absent key including '' and never throws.  
  _Evidence:_ symbol-table.ts:146-151; test 'lookup returns null for an absent key without throwing (R4.7)' (symbol-table.test.ts:242)
- [already-handled] Build-order independence / deterministic construction (R4.6)  
  Input is copied, sorted with byte-wise UTF-8 comparator, folded first-wins; fc property permutes input orders and asserts identical mappings.  
  _Evidence:_ symbol-table.ts:135-144; canonical.ts:38-48; test 'symbol table is identical regardless of node build order' (symbol-table.test.ts:157)
- [already-handled] Unicode identifiers in keys  
  Keys are byte-exact strings; compareUtf8 gives a total, engine-independent order for non-ASCII ids. A residual mismatch is only possible if the source spells the same name differently at declaration vs import (e.g. \u0041 unicode escapes, which tree-sitter does not decode) — that emission concern lives in the extractor lane; hypothesis, not reproduced.  
  _Evidence:_ canonical.ts:38-40; symbol-table.ts:135

#### `packages/parser/src/stitcher.ts`

- **[gap]** Wildcard import of an IN-PROJECT package (import com.example.util.*) produces zero edges  
  targetName keeps the trailing '.*' (ast-extractor.ts:354) and can never match a symbol key, so ALL dependencies expressed via a wildcard import are silently lost even when the target package and its classes are in the project. R5.4 only authorizes dropping names whose declaring entity is NOT in the project; the spec never mentions wildcards; only a code comment (ast-extractor.ts:324-326) calls the drop 'correct Phase-1 behavior'. Not in docs/gaps.md. Variants folded here: nested-type wildcard 'import p.Outer.*;' and static wildcard 'import static p.C.*;' (also reproduced, zero edges).  
  _Evidence:_ reproduced: UseWildcard.java (imports com.example.util.* and uses Helper+Other) -> 0 edges; StaticWild.java -> 0 edges; stitcher.ts:133-135; ast-extractor.ts:343-356
- **[gap]** Nested-type import (import com.example.Outer.Inner) never resolves: dotted import form vs '$'-joined symbol key  
  The symbol table keys the nested class as 'com.example.Outer$Inner' (from the class id), but the import statement is recorded as written with dots. lookup('com.example.Outer.Inner') misses, the reference is dropped as if external, and the edge is lost — even though the target node IS in the node set and IS keyed in the table. No spec clause or code comment sanctions this; it is a straight resolution miss between two modules that disagree on the name form.  
  _Evidence:_ reproduced: UseNested.java ('import com.example.Outer.Inner;') -> 0 edges while class:com.example.Outer$Inner exists in graph.json; symbol-table.ts:67-69; ids.ts:104; ast-extractor.ts:345-356; stitcher.ts:133-135
- **[gap]** Static member import of an in-project method (import static p.C.m) drops the class dependency entirely  
  targetName 'com.example.Outer.helper' resolves through the FUNCTION key to a function node, then R5.2 drops the candidate edge — and no edge to the enclosing CLASS is created, so a real file->class dependency vanishes. R5.2 only forbids function ENDPOINTS; the design's own principle ('the referencing entity is mapped up to its file/class scope', design.md:291) is applied to the source but not the target. Variant folded here: static import of a FIELD (import static p.C.CONST) never resolves at all because fields are not extracted — same net loss. Also folded: the cross-kind shadow false-edge case (see symbol-tabl…  
  _Evidence:_ reproduced: UseStatic.java ('import static com.example.Outer.helper;' + 'import static com.example.util.Helper.LIMIT;') -> 0 edges; stitcher.ts:144-148; stitcher.test.ts:96 codifies the drop
- **[gap]** Self-import (file imports its own class) mints an intra-file file->own-class edge  
  'package p; import p.A;' inside A.java is legal (redundant) Java. The reference resolves to class:p.A, source file:...A.java != target, so R5.6's same-node guard does not fire and an edge with importFrequency 1 is emitted. This is a degenerate self-dependency of a file on its own declaration — noise, and it feeds core cohesion as a spurious intra-package edge. R5.6's letter permits it (only same-node suppression); the intent arguably does not. The stitcher test at stitcher.test.ts:117-128 explicitly notices this shape and side-steps testing it.  
  _Evidence:_ reproduced: SelfImport.java -> edge file:src/com/example/SelfImport.java -> class:com.example.SelfImport imp=1; stitcher.ts:150-156
- **[gap]** Whitespace (or comments) inside a dotted import name — 'import com . example . Helper ;' — drops the edge  
  Legal Java allows whitespace/comments around '.' in a qualified import. normalizeTypeText (ast-extractor.ts:179-181) collapses whitespace runs to single spaces but does not remove them, so targetName 'com . example . Helper' never matches key 'com.example.Helper' and the reference is silently dropped. Root cause is the extractor's emission (their lane) but the symptom is a resolution miss in this seam; fix could be on either side (strip whitespace in dotted names).  
  _Evidence:_ reproduced: proj2/Spacey.java -> 0 edges; ast-extractor.ts:179-181,346; symbol-table.ts:147-150
- **[gap]** Edge granularity actually minted: ONLY file->class edges; design.md promises 'file<->file or class<->class'  
  Every Phase-1 reference is file-scoped (fromNodeId = file id) and every resolvable key maps to a class node (function hits are dropped), so the emitted edge set is exclusively mixed-granularity file->class — never file->file, never class->class, and never both levels for one import (exactly one edge per R5.1). R5.2's letter (endpoints of kind file-or-class) is honored, but design.md:291 'Edges connect only file<->file or class<->class granularity' is contradicted by the implementation and by the module's own unit test (stitcher.test.ts:78 asserts file->class as correct). Downstream the graph is bipartite-ish (fi…  
  _Evidence:_ reproduced: all 3 edges in repro graph.json are file->class; ast-extractor.ts:352-356; stitcher.ts:133-148; design.md:291
- **[gap]** Resolved non-import reference kinds (type-use / method-call) mint an edge with ALL-ZERO signals  
  The accumulator is created for ANY resolved reference, but only kind==='import' increments a signal, so a future type-use/method-call reference would emit an edge with importFrequency=methodCallFrequency=sharedTypeCount=0 — a zero-information edge the downstream weight calculator maps to zero strength. Latent only: nothing produces these kinds in Phase 1 (ast-extractor emits imports exclusively), but the stitcher property tests already generate them and codify the all-zero edge as legal, so the trap is armed for the Gap-1 signal-enrichment work.  
  _Evidence:_ stitcher.ts:179-207 (accumulator created unconditionally, increment gated on kind at 204); stitcher.test.ts:215-227 generates type-use/method-call kinds
- [by-design] Duplicate identical import statements inflate importFrequency (imp=2 for one dependency)  
  R6.2's letter counts 'each resolved reference exactly once' — two duplicate import declarations ARE two references, so imp=2 is spec-conformant; test stitcher.test.ts:130 codifies 3x collapse to imp=3. Side observation: absent duplicates, valid Java allows at most one import per (file, type), so in Phase 1 importFrequency is effectively binary (always 1) on real code — the weight signal downstream is degenerate. That observation deepens Gap 1 (signal poverty); not re-reported as new.  
  _Evidence:_ reproduced: DupImport.java -> imp=2; requirements.md R6.2; stitcher.ts:202-206
- [by-design] Signals total, finite, non-negative integers; deferred signals present and exactly 0 (R6.1, R6.3-R6.6)  
  methodCallFrequency/sharedTypeCount hardcoded 0 is the documented Phase-1 simplification (requirements.md preamble + R6.3/R6.4). Exactly five keys per edge, no strength.  
  _Evidence:_ stitcher.ts:188-215; stitcher.test.ts:145,285
- [by-design] Illegal-Java import of a default-package class ('import A;') creates an edge  
  Java forbids importing default-package types, but the parser is not a compiler and the spec nowhere requires language-legality validation; if targetName 'A' matches the default-package class key, an edge is minted. Benign — such code does not compile, so it is not realistic input; behavior is deterministic.  
  _Evidence:_ reasoned-from-code: symbol-table.ts:67-69 (default-package key = simple name); stitcher.ts:133-156
- [already-handled] Single-type import of an in-project class resolves to exactly one edge (R5.1)  
  Control fixture: 'import com.example.util.Helper;' -> edge file:src/com/example/Control.java -> class:com.example.util.Helper, importFrequency 1.  
  _Evidence:_ reproduced: node packages/parser/dist/parse-cli.js <scratch>/repro/parser-stitch/proj -> graph.json; stitcher.test.ts:78
- [already-handled] Unresolved external name (java.util.List) dropped with no synthetic node (R5.4)  
  lookup returns null, resolveEndpoints returns null, no edge and no node.  
  _Evidence:_ stitcher.ts:132-135; test 'drops references whose target is not in the project (R5.4)' (stitcher.test.ts:86)
- [already-handled] Reference source node absent from node set (R5.5)  
  Guarded before resolution; also covered by fc property including a ghost fromNodeId.  
  _Evidence:_ stitcher.ts:126-130; stitcher.test.ts:107, 265
- [already-handled] Resolved target id missing from node set (defensive, R5.5)  
  Cannot occur when symbols are built from the same node set, but guarded anyway so no dangling endpoint is emitted; serializer adds a second sweep (R7.6).  
  _Evidence:_ stitcher.ts:137-142
- [already-handled] Function endpoint on either side dropped (R5.2)  
  Both source-kind and target-kind checked. In Phase 1 the source is always a file node (imports are file-scoped, ast-extractor.ts:353), so the source-side check is defensive only.  
  _Evidence:_ stitcher.ts:144-148; stitcher.test.ts:96 and property at 265
- [already-handled] Same-node self-edge suppressed (R5.6)  
  class A importing/resolving to itself yields no edge. Note the file->own-class variant is NOT suppressed (see self-import gap entry).  
  _Evidence:_ stitcher.ts:150-156; stitcher.test.ts:117
- [already-handled] De-duplication by ordered (source, target) pair (R5.3); NUL edge-key separator  
  Accumulator map keyed source+NUL+target; NUL cannot appear in node ids (ids derive from file paths and Java identifiers; filesystems and the Java grammar both exclude NUL), so keys cannot collide.  
  _Evidence:_ stitcher.ts:72,108-110,177-199; stitcher.test.ts:249
- [already-handled] importFrequency overflow past 2^31-1 / R7.4 range enforcement  
  Unreachable in practice (each unit requires a distinct parsed import declaration; billions of references would exhaust memory first). Defensively, the serializer clamps every signal to [0, 2147483647] and zeroes non-finite values before emission.  
  _Evidence:_ stitcher.ts:195-206 (seed 0, +1 increments only); serializer.ts:49,100-112
- [already-handled] Determinism under reordered references / extraction results (R5.7, R6.7)  
  Edge SET and signal values are order-independent (keyed map + commutative increments). The returned ARRAY is in first-seen order — order-dependent — but every consumer path re-sorts canonically before emission (stringifyGraph -> sortGraphCanonically), and the orchestrator feeds files in collector-sorted order anyway. fc properties permute reference order and assert identical sorted edge sets.  
  _Evidence:_ stitcher.ts:177-216; canonical.ts:69-76,160-181; orchestrator.ts:158-180; stitcher.test.ts:320,333
- [already-handled] Empty/weird targetName strings ('', '*', trailing dot, garbage)  
  All fall through lookup->null->drop (R4.7 + R5.4 path). No throw, no edge.  
  _Evidence:_ symbol-table.ts:147-150; stitcher.ts:133-135; symbol-table.test.ts:242
- [already-handled] Empty inputs: stitch(nodes, [], symbols) and stitch([], refs, symbols)  
  Zero references -> empty edge array; empty node set -> every reference fails the source-endpoint guard -> empty edge array. Both trivially deterministic.  
  _Evidence:_ stitcher.ts:170-216
- [already-handled] Import + (future) type-use between the same pair collapse to one edge; only imports count toward importFrequency  
  Single accumulator per ordered pair; kind-gated increment satisfies R5.3 + R6.2 jointly.  
  _Evidence:_ stitcher.ts:185-206

### packages/core — ingest & weighting

> Scope: `ingestor.ts`, `weights.ts`, `types.ts`, `errors.ts` (+ tests) · grouping Req 1, 2  
> **44 cases examined** — 16 gap · 2 by-design · 26 already-handled


#### `packages/core/src/ingestor.ts`

- **[gap]** FILE node WITH definedInFile set (contract says omitted on file nodes)  
  Accepted silently: the definedInFile gate only inspects class/function kinds. Downstream the field is ignored for file nodes (hierarchy-builder.ts:80 guards node.kind !== 'file'), so output is not corrupted, but a contract violation the decisions log claims is 'validated' passes the gate unflagged. Low severity.  
  _Evidence:_ reproduced: repro1-untrusted-input.mjs case 1h => OK; ingestor.ts:50-51
- **[gap]** nodes array containing null / non-object entries  
  null entry: the sort comparator dereferences .id and THROWS TypeError — a raw exception escapes the Result pipeline and crashes the CLI with a stack trace instead of a structured error (violates the errors-as-Results engine rule). A string entry ('bogus') is accepted silently with id undefined. graph.json is untrusted disk input parsed with a bare cast (orchestrator.ts:154), so this is reachable from any hand-made/corrupt file.  
  _Evidence:_ reproduced: repro1 1a THREW TypeError; repro1 1b OK(accepted); repro2-e2e.sh 2a CLI exits 1 with raw TypeError stack from ingestor.js:21
- **[gap]** edges array containing null / non-object entries  
  compareDependencyEdges dereferences .source on the null entry and THROWS TypeError, escaping the Result pipeline.  
  _Evidence:_ reproduced: repro1 1c THREW TypeError: Cannot read properties of null (reading 'source')
- **[gap]** node with missing id (undefined)  
  Accepted: nodesById gets an undefined key, compareIds(undefined, x) returns 0 for everything (unstable canonical position), graphology coerces the key. Two id-less nodes collide as DUPLICATE_NODE with nodeId undefined. Silent acceptance of contract-invalid input.  
  _Evidence:_ reproduced: repro1 1e => OK
- **[gap]** numeric node id (e.g. 5) coexisting with string id "5"  
  Map-based duplicate detection distinguishes number 5 from string "5" (SameValueZero), so DUPLICATE_NODE does not fire; graphology then coerces both keys to "5" and THROWS UsageGraphError('the "5" node already exist') — an unstructured crash from inside ingest. JSON permits numeric ids, so this is reachable from disk.  
  _Evidence:_ reproduced: repro1 1d THREW UsageGraphError
- **[gap]** empty-string node id ""  
  Accepted although the shared contract requires 'Unique, non-empty' ids. Consequence: the node exists in the hierarchy but can never be queried by the Blast_Radius_Analyzer, because analyzeBlastRadius maps "" to EMPTY_NODE_ID (blast-radius.ts:27-29) — an unreachable-by-id node. Low severity.  
  _Evidence:_ reproduced: repro1 1f => OK; blast-radius.ts:27-29 reasoned-from-code
- **[gap]** node with unknown kind ('banana') or parser-reserved kind ('group', 'repository')  
  Accepted (kind only inspected by the class/function definedInFile gate). Downstream, such a node (without a valid definedInFile) joins no Region and is silently DROPPED from the hierarchy and from nodes.json, while edges.json's leafEdges still contain every edge referencing it — the emitted Index_File_Set is internally inconsistent (edge endpoints absent from nodes.json), and blast radius returns NODE_NOT_FOUND for an id the ingestor loaded per Req 1.1. Quirk: an unknown-kind node WITH a valid definedInFile is instead attached as a file child (hierarchy-builder.ts:80-91 accepts any non-file kind), so handling is…  
  _Evidence:_ reproduced: repro2-e2e.sh 2b — nodes.json grep 'mystery'=0, edges.json grep=1, CLI result OK; analyzeBlastRadius(h,'mystery') => NODE_NOT_FOUND (verified); ingestor.ts:50-51; hierarchy-builder.ts:78-92; index-serializer.ts:46-57
- **[gap]** file node missing directoryPath (and no packagePath)  
  Accepted; regions.ts:31 interpolates undefined into the Region id producing 'dir:undefined', which string-collides with a real directory literally named 'undefined'. Reproduced: a missing-directoryPath file and a directoryPath:'undefined' file land in ONE region. Also nodes.json omits the field (undefined-omission), degrading round-trip.  
  _Evidence:_ reproduced: repro1 1i => OK; repro3 3f => regions: dir:undefined (single region for both files); regions.ts:27-32
- **[gap]** non-string directoryPath/packagePath (number, object)  
  Same mechanism as missing directoryPath: template-literal coercion into the Region id, silently. Not separately reproduced (hypothesis for exotic types, same code path as the reproduced undefined case).  
  _Evidence:_ regions.ts:27-32, reasoned-from-code
- **[gap]** edge signal fields with wrong JSON types: string '5', string 'abc', missing field, negative, fractional  
  graph.json is parsed with a bare `JSON.parse(text) as RawDependencyGraph` cast (orchestrator.ts:146-159) and ingest performs NO field-type validation, so malformed signals flow straight to weights: '5'*1=5 is silently accepted as a strength; 'abc'/missing -> NaN -> clamped to 0 silently; importFrequency:-5 with methodCallFrequency:10 nets 5 (only the SUM is clamped, per-signal non-negativity of Req 2.2 is never enforced). A producer bug in any third-party graph.json generator silently corrupts every Dependency_Strength — and thus every cohesion/coupling score and preserve/reconstruct decision — with zero diagnos…  
  _Evidence:_ reproduced: repro1 1j (strength=5 from '5', strength=0 from 'abc'), 1k (net 5 from -5/10; strength 0 from missing field); orchestrator.ts:154; weights.ts:48-54
- **[gap]** graphology mirror (model.graph) built at ingest  
  No production code consumes model.graph (only ingestor.test.ts reads graph.order/size); yet building it is the source of the UsageGraphError throw path (numeric/string id collision) and adds the only ingest code that can throw after validation. Dead weight with crash surface. Folded into the throws gap.  
  _Evidence:_ grep over packages/core/src: no non-test consumer of model.graph; ingestor.ts:79-85
- **[gap]** test coverage of malformed (non-well-typed) input  
  All property arbitraries construct well-typed GraphNode/DependencyEdge objects; no test exercises null entries, wrong-typed fields, unknown kinds, missing ids, or missing directoryPath — the entire untrusted-disk-input space is untested, which is why the throw/silent-acceptance gaps survived.  
  _Evidence:_ test-support/arbitraries.ts:55-192 (only valid shapes + duplicate-id/dangling-edge injections); ingestor.test.ts covers only null/undefined/empty/dup/dangling/definedInFile
- [by-design] duplicate PARALLEL edges with same (source,target) in input  
  Accepted (multigraph); Req 1.4 requires preserving every input edge instance, and Req 8.4 sums underlying leaf edges, so each instance contributing separately to cohesion/cross-group sums is faithful to the input, not double-counting. Canonical full-content comparator gives parallel edges a position-independent order (Req 7.2) — for NUMERIC signals. Property 4 test explicitly asserts per-instance multiset counting.  
  _Evidence:_ canonical.ts:32-55; weights.test.ts Property 4 (countByKey multiset); arbitraries.ts:97-105 generates parallels
- [by-design] Phase-1 by-design behaviors touching this cluster  
  methodCallFrequency=0 and sharedTypeCount=0 from the parser (import-only edges) is documented Phase-1 (weights.ts:9-11 seam note); default coefficients {1,1,1} making strength = importFrequency initially is the documented consequence. NOT re-reporting Gap 1 (preserve never fires on real parser output) — confirmed that hand-made graphs with intra-package edges do preserve (repro2 2b: preserve 1), so the code path is sound; the starvation is the parser signal poverty already logged as Gap 1.  
  _Evidence:_ weights.ts:9-11; docs/gaps.md Gap 1; repro2 2b output 'preserve 1 / reconstruct 0'
- [already-handled] input is null  
  NO_GRAPH returned per R1.6.  
  _Evidence:_ ingestor.ts:18-20; ingestor.test.ts 'null and undefined inputs are rejected with NO_GRAPH (R1.6)'
- [already-handled] input is undefined (absent)  
  NO_GRAPH returned per R1.6.  
  _Evidence:_ ingestor.ts:17-20; same test
- [already-handled] input is a JSON scalar/array/object without nodes+edges arrays (e.g. graph.json contains 5, "x", [1], {})  
  !Array.isArray(input.nodes)||!Array.isArray(input.edges) maps every non-shape input to NO_GRAPH. Structured and deterministic; the error code arguably conflates 'absent' with 'present but malformed' but design maps this to 1.6.  
  _Evidence:_ ingestor.ts:18; reasoned-from-code (JSON.parse of these shapes reaches the guard)
- [already-handled] zero nodes (empty graph), including zero nodes with a non-empty edges array  
  EMPTY_GRAPH per R1.3; checked before dangling per design validation order, so nodes:[] + edges:[garbage] still reports EMPTY_GRAPH.  
  _Evidence:_ ingestor.ts:21-23; ingestor.test.ts 'a zero-node graph is rejected with EMPTY_GRAPH (R1.3)'
- [already-handled] single node, no edges  
  Accepted; becomes a degenerate single-file Region downstream (Req 3.9 rule).  
  _Evidence:_ arbitraries.ts minFiles=1 quantifies over it in Properties 1/4/5/7; assessor.ts:112 degenerate rule
- [already-handled] duplicate node id (including copies with differing content)  
  DUPLICATE_NODE naming the id per R1.5; content of the copies is irrelevant. Detection iterates the sorted list, so the reported id is deterministic under input reordering.  
  _Evidence:_ ingestor.ts:26-31; ingestor.test.ts Property 3
- [already-handled] dangling edge: source missing / target missing  
  Both endpoints validated; DANGLING_EDGE names the missing id (source checked first). Property test flips a boolean to cover both endpoints.  
  _Evidence:_ ingestor.ts:36-43; ingestor.test.ts Property 2 + arbitraries.ts:169-176 (missingAtSource)
- [already-handled] edge with BOTH endpoints missing  
  Reports the source id only; spec R1.2 asks for 'the missing node identifier' (singular), so one id satisfies it.  
  _Evidence:_ ingestor.ts:37-42, reasoned-from-code
- [already-handled] validation order and atomicity (null -> empty -> duplicate -> dangling -> definedInFile; no partial load)  
  Order matches design Graph_Ingestor section; the model (nodes/nodesById/edges/graph) is only constructed after every check passes, so no partial load exists on any error path. definedInFile is a documented extension appended after the design's four checks.  
  _Evidence:_ ingestor.ts:17-87 (model built at line 77+); errors.ts:12-22 documents the extension
- [already-handled] class/function node missing definedInFile  
  INVALID_DEFINED_IN_FILE with detail.  
  _Evidence:_ ingestor.ts:53-59; ingestor.test.ts 'the definedInFile contract invariant is validated at the gate'
- [already-handled] class/function definedInFile referencing a missing node  
  INVALID_DEFINED_IN_FILE naming the missing reference.  
  _Evidence:_ ingestor.ts:60-67; same test (dangling case)
- [already-handled] class/function definedInFile referencing a non-file node (incl. self-reference)  
  INVALID_DEFINED_IN_FILE (owner.kind !== 'file'); a self-referencing class hits the same branch since its own kind is not 'file'.  
  _Evidence:_ ingestor.ts:68-74; same test (non-file case)
- [already-handled] class/function definedInFile = "" (empty string)  
  Treated as a real reference; lookup fails -> INVALID_DEFINED_IN_FILE, unless a node with id "" exists AND is a file (which is itself contract-invalid input, see empty-id gap).  
  _Evidence:_ ingestor.ts:60-67, reasoned-from-code
- [already-handled] self-loop edge (source == target)  
  Accepted (MultiDirectedGraph allowSelfLoops:true). Downstream: excluded from Region cohesion/coupling (assessor.ts:87-93 same-file rule), excluded from reconstruct subgraphs (constructor.ts:97 sourceFile===targetFile), skipped by the Louvain wrapper anyway (community.ts:72-74), retained verbatim in leafEdges (Req 8.1), produces no Cross_Group_Edge (same ancestor chain), blast-radius visited-set terminates. Reproduced end-to-end: self-loop strength 7 correctly excluded from cohesion (0.5 = 1/2).  
  _Evidence:_ reproduced: repro3-misc.mjs case 3e; ingestor.ts:79; assessor.ts:87-93; constructor.ts:94-100; community.ts:72-74
- [already-handled] identical parallel edges (same source, target AND same signal content)  
  Comparator returns 0 but the tied elements are content-identical, so any order serializes identically; no determinism consequence.  
  _Evidence:_ canonical.ts:48-54, reasoned-from-code
- [already-handled] extra unknown fields on nodes/edges  
  Carried through the in-memory model but the serializer projects only contract fields, so they never reach the index files and cannot break byte-determinism of output.  
  _Evidence:_ index-serializer.ts:46-74 (explicit field picks)

#### `packages/core/src/canonical.ts`

- **[gap]** string-typed signals on PARALLEL edges defeat the canonical full-content edge order (Req 7.2)  
  compareDependencyEdges tiebreaks with numeric subtraction; 'a'-'b' = NaN is falsy and falls through the || chain, so two content-DIFFERENT parallel edges compare equal and keep input order. Reordering the input then yields byte-DIFFERENT edges.json — a direct violation of the order-independence hard rule, triggered by the same unvalidated-signal hole.  
  _Evidence:_ reproduced: repro3 3a — identical edges.json? false, leafEdges order follows input order; canonical.ts:48-54

#### `packages/core/src/weights.ts`

- **[gap]** negative weight coefficients  
  Design says 'with non-negative coefficients' but nothing validates WeightCoefficients — no INVALID_CONFIG path exists for them (it exists for hierarchy bounds, hierarchy-builder.ts:42-60). With importCoefficient=-1, the per-edge sum clamp produces non-monotonic strengths: componentwise-larger (5,3,0) scored 0 while (2,3,0) scored 1 — Property 6 inverted.  
  _Evidence:_ reproduced: repro3 3c => monotonic? false; weights.ts:51-53
- **[gap]** NaN / Infinity weight coefficients  
  NaN coefficient makes every w NaN -> every strength clamped to 0 silently: the entire graph loses its coupling signal, all Regions score degenerate/0 and reconstruct, with no error anywhere. Infinity coefficient: freq>0 -> Infinity -> 0; freq=0 -> 0*Inf=NaN -> 0. Same missing-INVALID_CONFIG hole.  
  _Evidence:_ reproduced: repro3 3c NaN case => strengths 0,0 with no error; Infinity case reasoned-from-code weights.ts:48-53
- **[gap]** overflow: a*freq sums to Infinity (e.g. importFrequency 1e308 + methodCallFrequency 1e308)  
  Number.isFinite(w) guard clamps Infinity to 0 — the numerically STRONGEST edge in the graph silently becomes the weakest (wrong-direction failure), inverting cohesion/coupling contributions. A saturating clamp to Number.MAX_VALUE (or a MALFORMED input rejection) would preserve ordering. Only reachable with absurd hand-made magnitudes.  
  _Evidence:_ reproduced: repro3 3b => 1e308-signal edge strength=0 while importFrequency=1 edge strength=1; weights.ts:51-53
- [already-handled] all-zero signals -> strength exactly 0 (Req 2.5)  
  0*a+0*b+0*c = 0, not clamped.  
  _Evidence:_ weights.ts:48-54; weights.test.ts Property 5
- [already-handled] exactly one finite non-negative strength per edge instance (Req 2.1/2.3), incl. parallel edges  
  map over model.edges; multiset per-key counts asserted in the property test.  
  _Evidence:_ weights.ts:33-37; weights.test.ts Property 4
- [already-handled] componentwise monotonicity with default coefficients (Req 2.4)  
  Non-negative coefficients + non-negative signals: linear form is monotonic and the clamp never fires.  
  _Evidence:_ weights.test.ts Property 6
- [already-handled] determinism of weight computation (Req 2.6)  
  Pure arithmetic over canonically ordered edges.  
  _Evidence:_ weights.test.ts Property 7
- [already-handled] input edge already carrying a strength field (contract-legal, parser never emits)  
  Spread-then-assign overwrites: `{...edge, strength: strengthOf(...)}` — a poisoned input strength of 999 with all-zero signals becomes 0. The untouched copy in model.edges is never consumed downstream (hierarchy/serializer use weightedEdges).  
  _Evidence:_ reproduced: repro3 3d => computed strength = 0; weights.ts:33-36; hierarchy-builder.ts:203
- [already-handled] NaN/Infinity SIGNAL values passed via the programmatic API (not expressible in JSON)  
  Clamped to 0 by the same finite guard, satisfying Req 2.3's finite/non-negative postcondition — though silently, and Infinity suffers the wrong-direction inversion above.  
  _Evidence:_ weights.ts:48-54, reasoned-from-code
- [already-handled] computeWeights over an edgeless model  
  map over empty array; weightedEdges = [].  
  _Evidence:_ weights.ts:33-37; arbitraries generate edgeless graphs (maxEdges can be 0-length array)
- [already-handled] coefficient defaults / partial config merging  
  DEFAULT_WEIGHT_COEFFICIENTS = {1,1,1}; resolveConfig's definedEntries prevents an explicitly-undefined partial value from clobbering a default.  
  _Evidence:_ weights.ts:22-26; orchestrator.ts:57-78

#### `packages/core/src/errors.ts`

- [already-handled] GroupingError union vs design table  
  Matches the design's nine codes plus two documented extensions (INVALID_CONFIG, INVALID_DEFINED_IN_FILE) with rationale in the doc comment; describeError is total over the union (exhaustive switch, no default needed under TS).  
  _Evidence:_ errors.ts:12-72; design.md:346-355

#### `packages/core/src/types.ts`

- [already-handled] internal model types vs design Data Models  
  DependencyModel/WeightedModel/RegionScore/Metadata etc. match design shapes; WeightedModel documents strength >= 0 finite; canonical-order invariants documented on nodes/edges fields.  
  _Evidence:_ types.ts:15-29 vs design.md:266-344

### packages/core — regions & structural-quality assessment

> Scope: `regions.ts`, `assessor.ts` (+ tests) · grouping Req 3  
> **51 cases examined** — 10 gap · 13 by-design · 28 already-handled


#### `packages/core/src/regions.ts`

- **[gap]** File node with MISSING directoryPath (hand-made JSON): region id becomes literal 'dir:undefined' and collides with a real directory named 'undefined'  
  TypeScript marks directoryPath required, but JSON input is not schema-checked: ingest() validates only duplicates/dangling/definedInFile, so {id, kind:'file'} passes. `dir:${undefined}` stringifies to 'dir:undefined'; all such files silently merge into one region, and that region id is INDISTINGUISHABLE from a genuine directory literally named 'undefined'. Deterministic but silently wrong region identity on contract-violating input. Fix direction: ingest-side contract check (string directoryPath) or an explicit guard in primaryRegionOfFile.  
  _Evidence:_ REPRODUCED: ingest ok on missing-directoryPath nodes; regions -> [{id:'dir:undefined', files:['file:A.java','file:B.java']}]; primaryRegionOfFile({directoryPath:'undefined'}) also -> 'dir:undefined'. Code: regions.ts:31; ingestor.ts:17-75 (no directoryPath validation)
- **[gap]** group/repository-kind nodes in input: not region members, and every edge touching them is silently invisible to cohesion/coupling/modularity  
  GraphNode.kind union includes 'group'|'repository' (shared contract reused for index output), so such nodes are TYPE-VALID RawDependencyGraph input and pass ingest (definedInFile check only applies to class/function). owningFileOf returns null for them, so the assessor drops their edges without any signal: a package whose files are connected only through a group node scores degenerate/0 despite strength-9 edges. Realistic vector: feeding index nodes.json content back as a graph. Deterministic but silent measurement loss. Cross-lane: ingest could reject kinds outside file/class/function for raw input.  
  _Evidence:_ REPRODUCED: ingest(group-kind node) ok; region pkg:g with 2 files bridged by group:weird -> cohesion 0, coupling 0, degenerate true, score 0. Code: regions.ts:65-73 (owningFileOf -> null), assessor.ts:79-81 (silent continue), ingestor.ts:49-51 (kind check skips group)
- [by-design] Primary_Region precedence: declared package vs directory fallback (most-specific rule)  
  Phase-1 narrows Region identification to Java packages (design.md:24); each File node carries exactly ONE declared packagePath and ONE directoryPath, so 'most-specific boundary containing the node' collapses to a single candidate per source and the precedence rule (design.md:132) is satisfied trivially: pkg wins when declared, else dir.  
  _Evidence:_ regions.ts:27-32; design.md:132; regions.test.ts:49-65
- [by-design] Nested packages (com.x vs com.x.y): file assigned to its own declared package; edges between nested packages count as boundary-crossing  
  Regions form a flat partition; a file in com.x.y belongs only to pkg:com.x.y (its most specific declared boundary). Edges com.x <-> com.x.y are crossing edges, consistent with partition semantics of R3.1/3.2.  
  _Evidence:_ regions.ts:27-32 (single region id per file); assessor.ts:87-97 (intra iff same region id)
- [by-design] Whitespace-only or trailing-space packagePath (' ', 'com.x ') in hand-made input  
  Accepted verbatim as a distinct region ('pkg: '). Garbage-in/garbage-out; parser never emits such values; deterministic; spec silent. Cosmetic.  
  _Evidence:_ regions.ts:28-29 (only undefined/'' filtered); reasoned-from-code
- [by-design] Glossary tie-break ('ties broken by lexicographic Region identifier')  
  Never exercised in Phase 1: each file has exactly one candidate region per precedence level, so no tie can arise. The tie-break clause becomes relevant only when multiple boundary strategies coexist (future ecosystems).  
  _Evidence:_ regions.ts:27-32; design.md:132
- [by-design] Same declared package across different source roots (src/main + src2) with non-colliding node ids -> ONE merged pkg region  
  Package = Region regardless of directory, per Phase-1 strategy. Files from different directory trees with the same declared package share a region. (When ids DO collide across roots, ingest rejects — that is known Gap 2, not re-reported.)  
  _Evidence:_ regions.ts:28-29; design.md:24
- [by-design] Default-package files in different directories -> distinct dir: regions; default-package file next to a packaged file in the same directory -> two regions covering one directory  
  Faithful application of the precedence rule; deterministic; legal-but-unusual Java layouts produce split regions, which is what the rule specifies.  
  _Evidence:_ regions.ts:27-32; design.md:132
- [already-handled] File node with no packagePath and directoryPath '' (repo root) -> region id 'dir:'  
  Falls back to `dir:${''}` = 'dir:', a valid distinct region id; cannot collide with any pkg: id due to namespacing.  
  _Evidence:_ regions.ts:31; covered by test 'a file with no declared package falls back to its directory Region' regions.test.ts:59-62 (reproduced)
- [already-handled] packagePath present but EMPTY STRING in hand-made input (parser omits empty)  
  Explicit `!== ""` guard treats empty-string packagePath as absent -> directory fallback, matching the parser's field-omission semantics. No dedicated unit test for the empty-string arm (arbitraries.ts:66 omits the field instead of emitting ''), but behavior reproduced: primaryRegionOfFile({packagePath:'', directoryPath:'src'}) === 'dir:src'.  
  _Evidence:_ regions.ts:28 `if (file.packagePath !== undefined && file.packagePath !== "")`; reproduced via scratch repro.mjs REPRO 3(a)
- [already-handled] Non-file nodes (class/function) are never region members; membership is File-only  
  assignRegions skips kind !== 'file'; region nodeIds and the cohesion denominator are file counts. Spec-conformant: R3.2 defines ownership over File nodes only.  
  _Evidence:_ regions.ts:40-42; Property 8 test regions.test.ts:10-47 asserts non-file nodes get no Primary_Region
- [already-handled] owningFileOf maps file->itself, class/function->definedInFile  
  Straightforward; validated invariant upstream (INVALID_DEFINED_IN_FILE).  
  _Evidence:_ regions.ts:65-73; test regions.test.ts:67-97; ingestor.ts:49-75
- [already-handled] owningFileOf when definedInFile is missing or references a non-file node (direct component callers bypassing ingest)  
  Defensive null return; assessor then drops the edge deterministically. The pipeline can never reach this state because ingest rejects with INVALID_DEFINED_IN_FILE (all three arms: missing, dangling, non-file owner).  
  _Evidence:_ regions.ts:69-72; ingestor.ts:53-74; assessor.ts:79-81
- [already-handled] Empty region (zero members)  
  Impossible by construction: a region id is only created when its first file member is assigned; members lists are always non-empty. The `nodeIds.length > 0` guard in the assessor is dead-but-defensive.  
  _Evidence:_ regions.ts:45-50; assessor.ts:108
- [already-handled] Region member-list ordering and region iteration order determinism  
  Member lists inherit canonical id order from model.nodes (ingest sorts with compareIds); the members map is re-sorted by region id before return. A direct caller passing an unsorted hand-built DependencyModel would get unsorted members, but ingest is the only model producer in the pipeline (documented assumption at regions.ts:38).  
  _Evidence:_ ingestor.ts:26; regions.ts:38,54; canonical.ts:12-14
- [already-handled] Package/directory name collision between namespaces (package 'x' vs directory 'x')  
  pkg:/dir: prefixes make collision impossible; a directory literally named 'pkg:x' still yields 'dir:pkg:x' != 'pkg:x'.  
  _Evidence:_ regions.ts:12-13,29,31
- [already-handled] Unicode / non-ASCII package or directory names in region ids and their sort order  
  compareIds is raw code-unit comparison (a<b), locale-independent and platform-stable; region ids are JSON-escaped by stableStringify downstream. No localeCompare anywhere in the path.  
  _Evidence:_ canonical.ts:11-14; regions.ts:54

#### `packages/core/src/assessor.ts`

- **[gap]** metricWeights (recorded in RegionAssessment and metadata.json) still includes the modularity weight when computeModularity=true but Q could NOT be computed (edgeless or zero-weight projection)  
  Req 3.7 requires recording 'the per-metric weights USED to compute the Structural_Quality_Score'. activeWeights() checks only the config flag, not whether computePartitionModularity returned undefined — contradicting its own doc comment ('with modularity dropped when NOT COMPUTED', assessor.ts:137). Result: scores are computed with renormalized {cohesion,coupling} only, but metadata claims {cohesion:0.4,coupling:0.4,modularity:0.2}; regionDecisions carry no modularity value, so an auditor replaying score = 0.4*0 + 0.4*1 + 0.2*modNorm cannot reproduce the recorded 0.5. Realistic trigger: any graph whose inter-fil…  
  _Evidence:_ REPRODUCED via repro.mjs REPRO 1: region modularity [undefined], score [0.5], assessment.metricWeights {cohesion:0.4,coupling:0.4,modularity:0.2}, metadata.metricWeights identical through groupGraph. Code: assessor.ts:100,132,137-143 vs 158; orchestrator.ts:117-122
- **[gap]** Weights all zero {0,0(,0)}: renormalization division by zero  
  The totalWeight <= 0 guard prevents 0/0 and returns score 0 — mechanically safe — but the config is accepted silently: every non-degenerate region scores 0, indistinguishable from degenerate, and everything reconstructs with no INVALID_CONFIG. Folded into the AssessmentConfig-validation gap.  
  _Evidence:_ REPRODUCED: weights {0,0} -> score 0, no error. assessor.ts:161-164
- **[gap]** NEGATIVE weights accepted silently  
  Design 3.6 premises 'weights are non-negative and sum to 1.0'; nothing enforces non-negativity. With mixed-sign weights the renormalized combination leaves [0,1] and is clamped, destroying score ordering (ties at 0/1). Reproduced: {cohesion:0.8, coupling:-0.4} -> score 0 for a healthy region that scores 0.667 under defaults. Folded into the AssessmentConfig-validation gap.  
  _Evidence:_ REPRODUCED via repro.mjs REPRO 2; assessor.ts:154-166 (no sign check); design.md:127
- **[gap]** NaN weights accepted silently  
  totalWeight becomes NaN; NaN <= 0 is false so the guard passes; score becomes NaN and clamp01 masks it to 0. Silent worst-case scoring instead of INVALID_CONFIG. Folded into the AssessmentConfig-validation gap.  
  _Evidence:_ REPRODUCED: weights {NaN, 0.4} -> score 0, no error. assessor.ts:161-166,224-229
- **[gap]** cohesionSquashConstant k = 0  
  cohesion_norm becomes cohesion/cohesion = 1 for ANY positive cohesion (binary metric) and 0/0 = NaN for cohesion 0 (masked to 0 by clamp01 after propagating through the weighted sum). Reproduced: healthy region jumps 0.667 -> 1.0; zero-cohesion region drops 0.5 -> 0. Design defines k as the cohesion value mapping to midpoint 0.5 (implies k > 0, default 1.0); no bounds enforced. Folded into the AssessmentConfig-validation gap.  
  _Evidence:_ REPRODUCED via repro.mjs REPRO 2; assessor.ts:151-152; design.md:124
- **[gap]** cohesionSquashConstant k < 0  
  Non-monotonic garbage: cohesion slightly above -k gives huge positive norm (clamped to 1), cohesion exactly -k gives Infinity (clamp01 maps non-finite to 0), cohesion below -k gives negative norm. Reproduced cliff: same region scores 1.0 at k=-0.4 and 0.0 at k=-0.5. Silent — no INVALID_CONFIG. Folded into the AssessmentConfig-validation gap.  
  _Evidence:_ REPRODUCED via repro.mjs REPRO 2 (k=-0.4 -> 1, k=-0.5 -> 0); assessor.ts:151-152,224-229
- **[gap]** degenerateScore outside [0,1] silently clamped  
  clamp01(config.degenerateScore) prevents out-of-range output (good) but accepts e.g. 7 silently -> degenerate regions score 1.0 and PRESERVE at any boundary, inverting the design intent that degenerate = 'treated as poorly-structured'. Also NaN degenerateScore -> 0 silently. Note: AssessmentConfig.degenerateScore is itself an implementation extension (design's AssessmentConfig has no such field; design fixes the documented default 0.0). Folded into the AssessmentConfig-validation gap.  
  _Evidence:_ REPRODUCED: degenerateScore=7 -> singleton score 1.0. assessor.ts:115; design.md:106-110,130
- **[gap]** UMBRELLA: no INVALID_CONFIG validation path exists for AssessmentConfig at all  
  errors.ts wires INVALID_CONFIG only for hierarchy bounds (Req 6.6/6.8, hierarchy-builder.validateHierarchyConfig); resolveConfig deep-merges assessment config with zero validation; assess() checks nothing. The public library API (PartialGroupingConfig via groupGraph) therefore accepts k<=0/NaN, negative/NaN/all-zero weights, and out-of-range degenerateScore, producing deterministic but semantically corrupted scores with no error. Property 9's guarantee ('finite in [0,1]') survives only because clamp01 masks NaN/Infinity to 0. The demo CLI does not expose these knobs, so defaults-only CLI runs are unaffected.  
  _Evidence:_ errors.ts:16-17,34; orchestrator.ts:65-78 (resolveConfig, no validation); assessor.ts:63 (no config check); hierarchy-builder has validateHierarchyConfig (index.ts:26) — asymmetry
- [by-design] Cohesion denominator: FILE count, not total node count including classes/functions  
  Region membership is File-only (R3.2), so 'number of nodes in the Region' (R3.3) = file count. Scale-relative caveat is a documented Phase-1 acceptance.  
  _Evidence:_ assessor.ts:108 (nodeIds.length = file members); design.md:120
- [by-design] SAME-FILE class->class (or file->own-class) edges excluded from cohesion AND from the degenerate-rule internal-edge count  
  Intentional and documented in the module header ('same-file edges carry no inter-file structure signal'), coherent with file-granularity attribution: at file level such an edge is a self-edge, not an edge between two distinct region members. Spec text (R3.3 'edges whose source and target nodes both lie within the Region') is silent on this projection; a literal reading would count them. Real Phase-1 Java can only produce this via a file importing a secondary top-level class defined in itself (legal, rare). Reproduced: a region whose ONLY edge is same-file class->class (strength 10) is degenerate, score 0. Honest…  
  _Evidence:_ REPRODUCED via repro.mjs REPRO 3(d); assessor.ts:88-93 (count and sum only when sourceFile !== targetFile); design.md:120-121 contains no granularity clause
- [by-design] Degenerate predicate uses internal edge COUNT, not strength: a region whose only intra edge has strength 0 is NOT degenerate and scores exactly 0.5 (cohesion 0 -> norm 0; coupling 0 -> complement 1) — preserving at the …  
  R3.9/design.md:130 word the rule as '0 internal edges' (count), which the implementation matches. The 0-strength-edge case only arises when a signal-carrying edge exists but coefficients zero it out (e.g. importCoefficient=0), i.e. deliberate config. Deterministic; noted as a semantic cliff, not a deviation. (Distinct from known Gap 1, which is about intra-package edges being absent, not zero-weighted.)  
  _Evidence:_ REPRODUCED via repro.mjs REPRO 1: zero-strength intra edge -> score 0.5, not degenerate; assessor.ts:90,112
- [by-design] Coupling denominator convention: each intra edge counted ONCE in 'total strength incident to the Region's nodes' (not once per incident member)  
  Spec 3.4 wording is ambiguous (an intra edge is incident to two member nodes; per-node incidence would give cross/(2*intra+cross)). Implementation uses cross/(intra+cross); both are ratios in [0,1]; deterministic; Property 10's independent reference uses the same convention. Definitional choice, flagged for spec clarification only.  
  _Evidence:_ assessor.ts:109; design.md:121; assessor.test.ts:110-112
- [by-design] Score range extremes achievable: exact 0.0 for a non-degenerate region  
  cohesion 0 (zero-strength intra edges) + coupling 1 (all remaining incident strength crossing) -> score exactly 0. Deterministic, in range.  
  _Evidence:_ assessor.ts:152-166; reasoned-from-code
- [by-design] Partition-level Q recorded identically on every region, including degenerate ones  
  Q is a partition-level value recorded per region as a shared secondary signal (never the primary discriminator); degenerate regions carry it too though their score bypasses combineScore. Documented in the module header and design 3.5 (MAY).  
  _Evidence:_ assessor.ts:12-16,100,113,123; design.md:122; test assessor.test.ts:178-224 (hand-computed Q=1/6 matches)
- [by-design] Cohesion scale-relativity (same strength-per-node ratio at different sizes treated equal)  
  Explicit accepted Phase-1 simplification with documented future refinement (density normalization).  
  _Evidence:_ design.md:120; assessor.ts:8-9
- [already-handled] Cross-file class->class edges: visible to cohesion/coupling? (checklist's suspected NEW measurement hole)  
  NOT a hole: every edge endpoint is mapped to its owning file (definedInFile) before region attribution, so class-granularity edges the stitcher emits (parser emits file/class endpoints, stitcher.ts header rule 2) fully count. Reproduced: a region whose only edge is class:c.A->class:c.B (different files) gets cohesion 1, non-degenerate, score 0.75.  
  _Evidence:_ REPRODUCED via repro.mjs REPRO 3(e); assessor.ts:77-78; regions.ts:65-73; packages/parser/src/stitcher.ts:18-25 (edges connect file/class nodes)
- [already-handled] Self-loop edge (source === target) inside a region; single node + self edge  
  A self-loop is necessarily same-region and same-file, so it contributes nothing to intra strength, intra count, crossing, or the modularity projection — no double count, no cohesion>0. Single file with a strength-5 self-loop stays degenerate (nodeCount 1), score = degenerateScore. Parser can never emit self-edges anyway (R5.6). No core unit test exercises self-loops (arbitraries don't generate them), but ingest allows them (allowSelfLoops: true).  
  _Evidence:_ REPRODUCED via repro.mjs REPRO 3(b): {degenerate:true, cohesion:0, score:0}; assessor.ts:87-93,189; ingestor.ts:79
- [already-handled] Degenerate rule arm: region with >=2 files but 0 internal edges (only crossing edges)  
  degenerate = nodeIds.length < 2 || intraCount === 0; edgeless multi-file region gets configured degenerateScore, bypassing combineScore (which would give 0.5).  
  _Evidence:_ assessor.ts:112-116; test 'both degenerate arms of R3.9...' assessor.test.ts:250-288
- [already-handled] Degenerate rule arm: singleton region (<2 nodes)  
  Same predicate; singleton gets degenerateScore even if it has crossing edges.  
  _Evidence:_ assessor.ts:112; assessor.test.ts:279-282
- [already-handled] Coupling denominator zero (isolated region, no incident strength): 0/0 NaN guard  
  coupling = incident > 0 ? cross/incident : 0 — never NaN. (Such a region is degenerate anyway unless it has zero-strength intra edges, in which case coupling 0 is used.)  
  _Evidence:_ assessor.ts:109-110; Property 9 test assessor.test.ts:18-53
- [already-handled] Boundary-crossing edge credited to BOTH endpoint regions at full strength  
  Each crossing edge contributes its strength to the crossing sum of both source and target regions — required so each region's coupling reflects all its boundary traffic.  
  _Evidence:_ assessor.ts:95-96; mirrored in Property 10 reference assessor.test.ts:95-96
- [already-handled] Edge endpoints missing from nodesById (dangling) during metric accumulation  
  Defensive skip; unreachable via pipeline because ingest rejects dangling edges atomically (DANGLING_EDGE).  
  _Evidence:_ assessor.ts:72-76; ingestor.ts:36-43
- [already-handled] Modularity over a zero-total-weight projection (all inter-file strengths 0) -> treated as not-computed, weights renormalized, never NaN  
  Explicit totalWeight <= 0 guard returns undefined; combineScore then drops the modularity input and renormalizes; scores equal the computeModularity:false path. Matches the decisions-log claim. (BUT see the separate metricWeights gap: the RECORDED weights do not reflect the drop.)  
  _Evidence:_ assessor.ts:207-216; test 'modularity over an all-zero-strength projection...' assessor.test.ts:290-321 (score parity asserted)
- [already-handled] Modularity over an EDGELESS projection (no inter-file edges at all, e.g. all imports external)  
  projection.size === 0 -> undefined ('modularity undefined on an edgeless graph'); same renormalization path. Reproduced.  
  _Evidence:_ assessor.ts:203-205; repro.mjs REPRO 1 variant: modularity [undefined]
- [already-handled] Non-finite Q returned by graphology-metrics  
  Number.isFinite(q) gate maps any NaN/Infinity from the library to 'not computed'.  
  _Evidence:_ assessor.ts:218-221
- [already-handled] Negative Q clamping in modularity_norm; Q below -0.5  
  modularity_norm = clamp01((Q+0.5)/1.5); Q < -0.5 is outside Newman Q's theoretical range and float undershoot is clamped. Affine map matches design exactly.  
  _Evidence:_ assessor.ts:159; design.md:126
- [already-handled] computeModularity=true but weights.modularity undefined  
  Q is computed and recorded per region, but excluded from the score (both guards require the weight) and from metricWeights. Consistent semantics (no weight = not used); only cost is wasted computation.  
  _Evidence:_ assessor.ts:139,158
- [already-handled] clamp01 as the NaN/Infinity safety net for scores  
  Non-finite values map to 0, finite values clamp to [0,1]; guarantees Property 9 mechanically for any input. Double-edged: it also masks the config-gap garbage above, converting what should be errors into silent 0s.  
  _Evidence:_ assessor.ts:224-229; Property 9 test assessor.test.ts:18-53
- [already-handled] Raw cohesion/coupling recorded unclamped in RegionScore/metadata — could a non-finite value leak?  
  Via the pipeline: impossible — computeWeights clamps every strength to finite >= 0 (weights.ts:51-53), sums of finitely many finite non-negatives are finite, and coupling has its 0-denominator guard. Only a hand-built WeightedModel with Infinity strength (violating the documented contract, types.ts:27) could put Infinity into recorded raw cohesion, where stableStringify would serialize it as null. Contract-documented; defensive check not required. Confidence: reasoned-from-code.  
  _Evidence:_ weights.ts:40-55; types.ts:26-29; assessor.ts:104-110
- [already-handled] Float summation order / determinism of score (same machine and cross-platform)  
  All accumulation is over canonically ordered collections: ingest sorts edges with a FULL-content comparator (parallel edges get canonical order too, so reordered input cannot change accumulation order), regions iterate sorted, combineScore reduces a fixed-order array. Same-machine bit-equality verified by Property 11. Cross-platform: the score path uses only IEEE-754 +,-,*,/ (no Math transcendentals, no locale, no randomness), which are bit-deterministic across conforming platforms; the modularity path depends on graphology-metrics@2.4.0 internals (pinned exact version), which is the only cross-platform/versioni…  
  _Evidence:_ ingestor.ts:26,35; canonical.ts:32-55; assessor.ts:154-166; Property 11 test assessor.test.ts:128-150; package.json pins graphology-metrics 2.4.0
- [already-handled] Parallel directed edges (A->B and B->A, or duplicate A->B pairs) in metrics and in the modularity projection  
  Metric sums are additive per edge occurrence (order-independent); the undirected projection merges parallel/reciprocal edges by summing weight via hasEdge/updateEdgeAttribute — deterministic because edge iteration order is canonical.  
  _Evidence:_ assessor.ts:87-97,192-201; canonical.ts:32-55
- [already-handled] Graph with ZERO file nodes (e.g. only group-kind nodes): assess returns empty regions  
  No crash, deterministic empty assessment (regions: [], primaryRegionOf empty); full groupGraph also completes (depth 0). Whether an all-non-file graph should be rejected at ingest is a Req-1-lane question; the assessor itself is total. Property 9's 'at least one region' assertion holds only for the arbitraries' file-bearing graphs.  
  _Evidence:_ REPRODUCED: assess -> 0 regions; groupGraph ok, depth=0. assessor.ts:102-127
- [already-handled] Score exactly AT the Structural_Quality_Boundary (tie), and boundary extremes 0.0 / 1.0  
  OUT-OF-LANE consumer check: decideAction uses score >= boundary -> preserve (Req 4.2 conformant, deterministic since scores are deterministic). Boundary 0.0 preserves everything including degenerate 0.0 regions (0 >= 0); boundary 1.0 reconstructs everything reachable (score exactly 1.0 is unreachable for finite cohesion under valid configs — the squash asymptotes below 1 — except via degenerateScore>=1 or garbage-config clamps).  
  _Evidence:_ constructor.ts:31-33,47; assessor.ts:152 (asymptote); repro REPRO 2 shows clamped 1.0 only under invalid k
- [already-handled] Property-test blind spots in the arbitraries (documented for reviewers)  
  arbitraryDependencyGraph never generates: empty-string packagePath PRESENT (field omitted instead), self-loops, group/repository kinds, missing directoryPath, or negative/NaN config values beyond the tested ranges (weights >= 0.01, k >= 0.1). All those corners were therefore probed manually in this audit (see gap entries); the generated space itself is handled correctly by the code.  
  _Evidence:_ test-support/arbitraries.ts:60-91,124; assessor.test.ts:22-27

### packages/core — community detection

> Scope: `community.ts` (+ tests, + `graphology-communities-louvain` source) · grouping Req 4.3, 4.7  
> **33 cases examined** — 12 gap · 3 by-design · 18 already-handled


#### `packages/core/src/community.ts`

- **[gap]** ALL edge strengths 0 (graph.size > 0 but total weight M = 0) -> NaN delta arithmetic in louvain  
  MEDIUM. With M=0, fastDelta/fastDeltaWithOwnCommunity compute 0/0 = NaN (louvain.js:408-442); tieBreaker and 'bestDelta < 0' are false for NaN -> no node ever moves -> EVERY node stays a singleton community. So a region whose internal edges all have strength 0 explodes into one group per file, while the SAME region with those edges absent collapses to ONE community (documented degenerate rule). Zero-strength edges are spec-valid: Req 2.5 MANDATES strength 0 for all-zero-signal edges, and weights.ts:51-53 also clamps negative/NaN/Infinity signal combinations to 0. Reachable end-to-end: reproduced via boundary 0.6…  
  _Evidence:_ community.ts:85 (guard only checks graph.size===0, not total weight); node_modules/graphology-indices/louvain.js:426-442 (division by 2*M with M=0); contrast assessor.ts:215 which guards totalWeight <= 0 for the modularity path; reproduced: repro-detector.mjs case 2 ({a,b,c,d} chain of strength-0 edges -> 4 singletons…
- **[gap]** Edge endpoint not present in nodeIds (documented precondition violated)  
  LOW. graph.addEdge throws graphology NotFoundGraphError ('target node "z" not found') BEFORE the degenerate guards run, escaping the engine's structured-Result error model. Nothing catches it: groupGraph (orchestrator.ts:103-112) and group-cli.ts:54 have no try/catch, so the process dies with a raw stack trace. In-pipeline unreachable today: constructor.ts:94-101 filters edges to memberSet. Risk surface is the exported component API (index.ts exports LouvainCommunityDetector) and the design-advertised injectable-detector seam. Contrast regions.ts:61-63 which explicitly defends against direct component callers.  
  _Evidence:_ reproduced (repro-detector.mjs case 6a: THREW NotFoundGraphError); community.ts:73-82; orchestrator.ts:103-112; group-cli.ts:48-58
- **[gap]** Duplicate ids inside nodeIds  
  LOW (same family as dangling-endpoint). sortIds does not dedupe; graph.addNode throws UsageGraphError ('node already exist'). In-pipeline unreachable: ingest rejects duplicate node ids (ingestor.ts:27-29) and region member lists are built from the deduped node list.  
  _Evidence:_ reproduced (repro-detector.mjs case 6b: THREW UsageGraphError); community.ts:63-66; ingestor.ts:26-31
- **[gap]** Negative edge strength (direct API; CommunitySubgraph docs do not state non-negativity)  
  LOW. Negative weights poison the GLOBAL total M, silently corrupting partitions far from the bad edge: reproduced (a-b:-5, c-d:10) -> even the strength-10 pair c,d is severed into singletons (M drops to 5 making the c->d join delta exactly 0 -> tieBreaker keeps current community). Deterministic but meaningless. In-pipeline unreachable: weights.ts:51-53 clamps any negative/NaN/Infinite combined strength to 0 (which instead routes into the zero-weight gap).  
  _Evidence:_ reproduced (node -e case 'neg strength' -> [[a,0],[b,1],[c,2],[d,3]]); node_modules/graphology-indices/louvain.js:408-424; weights.ts:40-55
- **[gap]** NaN edge strength (direct API)  
  LOW. graphology-utils coerceWeight silently converts NaN (and any non-number) edge weight to 1 (getters.js:7-12), INVENTING dependency strength: reproduced {a,b} with strength NaN -> merged into one community as if strength 1. In-pipeline unreachable (weights.ts clamps NaN to 0 before detect).  
  _Evidence:_ reproduced (node -e case 'NaN strength' -> [[a,0],[b,0]]); node_modules/graphology-utils/getters.js:7-12; weights.ts:51-53
- **[gap]** Infinity edge strength (direct API)  
  LOW. M = Infinity -> Inf/Inf = NaN deltas for the infinite edge's endpoints -> they stay singletons while finite components still cluster. Deterministic garbage. In-pipeline unreachable (weights.ts clamps).  
  _Evidence:_ reproduced (node -e case 'Inf strength' -> [[a,0],[b,1],[c,2],[d,2]])
- **[gap]** Node id '__proto__' passed through detect()  
  LOW. louvain's collect() writes results into a plain object (var o = {}; o[node] = label) - for the key '__proto__' this assignment is a silent no-op, so the node is missing from raw. Then relabelByContent's raw[id] reads Object.prototype (an object, NOT nullish), so the ?? 0 fallback does NOT fire and the object becomes a Map key -> the node is deterministically SEVERED from whatever community louvain actually placed it in. Reproduced: '__proto__' tied to x with strength 10 ends alone in community 0 while x,y,z land in community 1. In-pipeline unreachable: detect() only ever sees file-granularity ids and the pa…  
  _Evidence:_ reproduced (repro-detector.mjs case 7); node_modules/graphology-indices/louvain.js:464-476 (collect writes to plain object); community.ts:109
- **[gap]** relabelByContent with an id missing from raw (raw[id] ?? 0 fallback)  
  LOW. A missing id is merged into RAW label 0 - the detector's arbitrary internal numbering, pre-rebasing - so the unknown node silently joins whichever community the detector happened to number 0. Reproduced: relabelByContent(['a','z'], {a:0}) -> a and z in the same community. Inside detect() raw is total over nodeIds (collect() covers every graph node except the '__proto__' quirk above), so unreachable in-pipeline; hazard is for direct callers of this exported function.  
  _Evidence:_ reproduced (repro-detector.mjs case 8); community.ts:109; index.ts:14
- [by-design] detect() with >= 2 nodes and zero edges  
  Documented Phase-1 rule: no dependency signal to rebuild from -> one community, avoiding singleton explosion. Comment at community.ts:59-62 documents this explicitly.  
  _Evidence:_ community.ts:59-62, 85-86; test community.test.ts:67-77; reproduced (repro-detector.mjs case 2c: {a,b,c,d} no edges -> all community 0)
- [by-design] seededRng seed edge cases: 0, negative, float, > 2^32, NaN  
  seed >>> 0 folds every input to uint32 deterministically: seed 0 works (state advances before use); -1 == 2^32-1; 1.5 == 1; 2^32+7 == 7; NaN == 0. All reproduced. Deterministic in every case, so Req 4.7 holds; collisions between distinct configured seeds (1 vs 1.5) are a documentation nicety at most. No validation that communityDetectionSeed is an integer anywhere in resolveConfig (orchestrator.ts:65-78) - cosmetic.  
  _Evidence:_ community.ts:44-53; reproduced (repro-detector.mjs case 9: identical 3-value sequences for the folded pairs)
- [by-design] Louvain returns every node in its OWN community (singleton explosion) on genuinely structured sparse input  
  When real (positive-weight) structure genuinely lacks communities, singletons are the detector's honest answer; hierarchy-builder handles N singleton groups without violating Req 6.4/11.1 (reproduced in pipeline case E: depth 3, all group nodes non-empty). The GAP is only the zero-total-weight route to this outcome (separate entry).  
  _Evidence:_ reproduced (repro-pipeline.mjs case E builds a valid hierarchy from 4 singleton groups)
- [already-handled] detect() with empty nodeIds ([])  
  graph.size === 0 branch returns an empty communityOf map; no throw. Regions can never be empty in-pipeline (regions.ts builds member lists from actual file nodes).  
  _Evidence:_ community.ts:85-86
- [already-handled] detect() with a single node (nodeIds.length < 2)  
  Guard returns single community 0.  
  _Evidence:_ community.ts:85-86; test 'degenerate subgraphs collapse to a single community' (community.test.ts:67-77)
- [already-handled] Region whose ONLY edge is a self-loop  
  Self-loop skipped at community.ts:70-72 -> graph.size stays 0 -> single-community branch. Reproduced: {a,b} with edge (a,a,5) -> both community 0. Note constructor.ts:94-101 already filters same-file edges, so self-loops cannot even reach detect() from the pipeline.  
  _Evidence:_ community.ts:70-72, 85-86; constructor.ts:94-101; reproduced (repro-detector.mjs case 5)
- [already-handled] Self-loops mixed with real edges  
  Skipped edges simply don't contribute weight; louvain runs on the remaining graph. In-pipeline unreachable (constructor filter).  
  _Evidence:_ community.ts:70-72; constructor.ts:97
- [already-handled] Isolated (degree-0) node inside a subgraph that has other edges (graph.size > 0, louvain runs)  
  graphology-indices louvain handles degree-0 nodes: starts[i] == starts[i+1] -> empty neighbor scan -> bestDelta = 0 -> node stays in its own singleton community. No throw. Reproduced: {a,b,c} + edge(a,b,5) -> {a,b}=0, {c}=1. Semantically reasonable (unconnected file becomes its own group).  
  _Evidence:_ node_modules/graphology-indices/louvain.js:128-176 (starts construction), index.js:147-231 (empty communities map -> no move); reproduced (repro-detector.mjs case 1)
- [already-handled] Mixed zero-strength and positive-strength edges (M > 0)  
  Zero-weight edges contribute nothing; their endpoints behave like isolated nodes and become singletons; positive components cluster normally. Deterministic. Reproduced: (a-b:0, c-d:10) -> {a}=0,{b}=1,{c,d}=2.  
  _Evidence:_ reproduced (repro-detector.mjs case 3)
- [already-handled] Parallel duplicate edges (same source,target twice) accumulate  
  hasEdge -> updateEdgeAttribute sums weights (community.ts:73-79). Addition is commutative and input is canonically sorted first (community.ts:67-69), so accumulation order cannot affect the total. The sort lacks a strength tiebreaker for identical (source,target) pairs, but that is harmless for a commutative fold.  
  _Evidence:_ community.ts:67-79
- [already-handled] Reverse-orientation pair (a,b) and (b,a) folded into one undirected edge  
  graphology UndirectedGraph hasEdge(source,target) is symmetric, so both orientations accumulate into one undirected weight. Intended: undirected community detection over combined bidirectional strength. Reproduced: (p3,p1,5)+(p1,p3,5) produces identical communities to a single (p1,p3,10).  
  _Evidence:_ community.ts:73-82; reproduced (repro-detector.mjs cases 4a == 4b)
- [already-handled] nodeIds.length < 2 combined with graph.size > 0  
  Logically unreachable: a single node's only possible internal edge is a self-loop, which is skipped, so size stays 0. The second disjunct at line 85 is dead-but-defensive.  
  _Evidence:_ community.ts:70-72, 85 (reasoned-from-code)
- [already-handled] relabelByContent: empty community / undefined a[0] in the sort  
  membersOf entries are only created with at least one member (lines 110-115), so communities[i][0] always exists; the non-null assertions at line 118 are safe.  
  _Evidence:_ community.ts:107-118 (reasoned-from-code)
- [already-handled] relabelByContent label re-basing determinism (two communities sharing a min member impossible)  
  Each node id appears in exactly one raw-label bucket, so community minimum members are distinct; compareIds is a total order on distinct strings; members sorted before selection. Deterministic 0..k-1 relabeling.  
  _Evidence:_ community.ts:103-126; test 'relabelByContent numbers communities by ascending minimum member id' (community.test.ts:79-91)
- [already-handled] Louvain returns ALL nodes in one community (no split found)  
  relabelByContent emits a single label 0; constructor emits one RegionGroup - identical shape to preserve. Fine.  
  _Evidence:_ community.ts:103-126; constructor.ts:108-122
- [already-handled] detect() mutating its input  
  sortIds copies nodeIds; [...subgraph.edges] copies before sorting. Caller arrays untouched.  
  _Evidence:_ community.ts:57, 67
- [already-handled] Determinism of the zero-weight (M=0) path across seeds and runs  
  No moves ever occur (NaN deltas), so the rng value is irrelevant to the result; byte-identical output across seeds 7/99999 and repeated runs. The zero-weight GAP is a semantics problem, not a determinism problem.  
  _Evidence:_ reproduced (repro-detector.mjs cases 2b)
- [already-handled] Seed plumbing end-to-end (config -> construct -> detect)  
  communityDetectionSeed flows orchestrator resolveConfig -> construct config -> reconstructRegion -> detect(..., seed) -> seededRng(seed) -> louvain rng option. Same seed for every region (regions differing only by content still get content-relabeled output).  
  _Evidence:_ orchestrator.ts:69, 109; constructor.ts:54, 106; community.ts:89-92

#### `node_modules/graphology-communities-louvain/index.js`

- [already-handled] Does the library consume options.rng everywhere it uses randomness?  
  The ONLY entropy source is createRandomIndex(options.rng) (index.js:98/382), consumed as randomIndex(l) once per outer pass (index.js:136 fastLocalMoves path, index.js:258 traditional path) to pick the traversal start offset. Math.random appears only as the DEFAULT rng (index.js:56) and in pandemonium's unused default export. detect() always passes the seeded rng (community.ts:90). Grep of louvain/index, graphology-indices/louvain, pandemonium/random-index, mnemonist sparse structures shows no Date/performance/Math.random use in the executed path.  
  _Evidence:_ index.js:56, 98, 136, 258; pandemonium/random-index.js:14-25; community.ts:89-92; grep reproduced in session
- [already-handled] Non-rng nondeterminism: object/Map iteration order inside the library  
  (a) graph.forEachNode/forEachEdge iterate graphology's internal Maps in insertion order; community.ts inserts nodes and edges in canonical sorted order (community.ts:57, 63-69), so index construction is deterministic and input-order-independent (covered by the reversed-order test). (b) SparseMap 'communities' iterates its dense array in insertion order = neighbor traversal order = deterministic typed-array layout. (c) zoomOut's for..in over adj objects uses integer-like keys, which ES2015+ mandates iterate in ascending numeric order. (d) tieBreaker EPSILON comparisons are pure float ops - deterministic.  
  _Evidence:_ graphology-indices/louvain.js:128-176 (index build), 238-338 (zoomOut for..in), index.js:71-89 (tieBreaker); community.test.ts:52-65 (reversed input order test)
- [already-handled] graph.size === 0 branch of louvain (each node its own community)  
  detect() never reaches it: community.ts:85 intercepts size 0 first and applies the opposite (single-community) rule. Worth knowing: if the guard were removed, louvain's own empty-graph rule is one community PER node - i.e. the library's degenerate default contradicts the engine's documented rule; the guard is what enforces the spec'd behavior.  
  _Evidence:_ index.js:706-736; community.ts:85-86

#### `packages/core/src/orchestrator.ts`

- **[gap]** Who catches a throwing CommunityDetector (Result-model escape)  
  LOW. groupGraph/groupGraphToIndex (orchestrator.ts:103-112, 128-143) and group-cli.ts:54 wrap nothing in try/catch; construct() calls detector.detect() bare (constructor.ts:106). The built-in detector cannot throw on pipeline-produced input (invariants traced: ingest dedupe, memberSet filter, same-file filter), but the design explicitly advertises substituting detectors ('Any detector ... can be plugged in', design.md community-detection-abstraction section), and any throw crashes with a raw stack instead of a structured GroupingError. No partial index output is written though - serializeIndex runs only after th…  
  _Evidence:_ orchestrator.ts:103-143; constructor.ts:106; group-cli.ts:48-58; design.md 'Community detection abstraction'

#### `packages/core/src/assessor.ts`

- **[gap]** ADJACENT-LANE CONTEXT: zero-strength edges count as intra edges for the degenerate rule, scoring 0.5 (preserve) while a no-edge region scores 0.0 (reconstruct)  
  LOW here / assessor cluster's lane - recorded only because it gates reachability of the zero-weight detector gap. assessor.ts:112 tests intraCount === 0 (edge COUNT, not total strength), so a region whose internal edges all have strength 0 is NOT degenerate: cohesion 0, coupling 0 -> renormalized score exactly 0.5 -> preserve at the default 0.5 boundary. Removing those semantically-empty edges flips the region to score 0.0 -> reconstruct. Reproduced (pipeline cases A: score 0.5/preserve vs B: score 0.0/reconstruct). Deferring to the assessor auditor for ownership.  
  _Evidence:_ assessor.ts:112, 215; reproduced (repro-pipeline.mjs cases A vs B)

#### `packages/core/src/metadata.ts`

- **[gap]** communityDetectionSeed is not recorded in metadata.json  
  LOW (possible overlap with the metadata cluster). types.ts:70 carries the seed in config but metadata.ts and index-serializer.ts never write it (grep: no 'seed' outside types.ts). Req 5.5 mandates recording the boundary and 5.7 only requires DECISION reproducibility, so no clause is violated - but reconstruct GROUP RESULTS depend on the seed, so a run's groups cannot be reproduced from the index alone if a non-default seed was used. Spec hole rather than deviation.  
  _Evidence:_ grep -n seed packages/core/src/metadata.ts types.ts index-serializer.ts -> only types.ts:70; constructor.ts:54 (seed feeds detect)

#### `packages/core/src/community.test.ts`

- **[gap]** Test-coverage holes in community.test.ts  
  LOW (test-coverage). No tests for: zero-total-weight subgraphs (the M=0 NaN path), isolated nodes inside edged subgraphs, parallel/reverse edge accumulation-folding, precondition violations (duplicate ids, dangling endpoints), or exotic ids. The determinism test only covers the well-behaved two-cluster shape.  
  _Evidence:_ community.test.ts:1-163 (read completely; five tests, none touching the above)

### packages/core — adaptive construction & hierarchy build

> Scope: `hierarchy-builder.ts`, `constructor.ts`, `group-id.ts` (+ tests) · grouping Req 4–8, 11  
> **55 cases examined** — 12 gap · 6 by-design · 37 already-handled


#### `packages/core/src/hierarchy-builder.ts`

- **[gap]** minPartitionThreshold has zero behavioral effect (dead config knob)  
  partitionChildren returns unpartitioned when n <= maxGroupSize; since validation enforces minPartitionThreshold <= maxGroupSize, the 'n < minPartitionThreshold' clause at :241 can never be the deciding condition. Behavior still complies with Req 6.7/6.8 (which make the constraint vacuous by construction), but the knob is validated, documented, and unusable — a user tuning it observes no change. Severity Low.  
  _Evidence:_ hierarchy-builder.ts:241 (n <= maxGroupSize || n < minPartitionThreshold) with hierarchy-builder.ts:49-53 enforcing threshold <= maxGroupSize; reasoned-from-code
- **[gap]** Input nodes of kind 'group' or 'repository' (legal GraphNode kinds per shared contract) are silently dropped from the hierarchy; edges referencing them stay in leafEdges/edges.json while the ids are absent from hierarch…  
  Ingest accepts them (no definedInFile gate for these kinds, ingestor.ts:50-51), Req 1.1/1.4 loads them, then buildHierarchy places only file nodes (via regions) and definedInFile members — everything else vanishes with no error. Emitted index is self-inconsistent: edges.json references node ids not in nodes.json; metadata nodeCount (4) != input node count (3) in a surprising direction; CGE contribution for such edges silently skipped via ancestorPath null (:274). Test arbitraries never generate these kinds, so no property test covers this.  
  _Evidence:_ reproduced: repro1-group-kind-drop.mjs -> 'hierarchy contains legacy-group-1? false', 'edge endpoints in edges.json MISSING from nodes.json: [legacy-group-1]'; code path hierarchy-builder.ts:77-92 (only definedInFile members), regions.ts:40-42 (only kind file), hierarchy-builder.ts:273-276 (silent skip)
- **[gap]** Graph with zero file nodes (e.g. only group-kind nodes) -> pipeline succeeds with a single childless repository node, depth 0, all input nodes dropped  
  Variant of the silent-drop gap: ingest requires >=1 node but not >=1 FILE node; repositoryIdOf([]) mints a repo over empty membership. Serializer writes a 1-node index that reflects none of the input. Cannot arise from the parser (it always emits file nodes) — reachable via API/hand-authored graph.json.  
  _Evidence:_ reproduced: repro2-misc.mjs Repro 2 -> 'hierarchy node count: 1 repo childIds: [] depth: 0', pipeline ok: true
- **[gap]** BFS level assignment uses Array.prototype.shift() -> O(n^2) queue on very large hierarchies  
  Correctness unaffected; at the spec's 4k-file scale negligible, but Req 11 targets large repositories and every other stage is O(n log n). Severity Low (perf only).  
  _Evidence:_ hierarchy-builder.ts:189-200; reasoned-from-code
- **[gap]** CGE: edge endpoint not present in the hierarchy (dropped node) silently skipped  
  Folded into the group/repository-kind silent-drop gap: ancestorPath null -> continue, so the group-level representation of that dependency is silently lost while the leaf edge itself is emitted.  
  _Evidence:_ hierarchy-builder.ts:273-276; reproduced in repro1 (crossGroupEdges: [] despite a cross-boundary edge)
- [by-design] CGE: zero-weight edges (all-zero signals) crossing groups emit weight-0 Cross_Group_Edges  
  Req 8.2 mandates representing the relationship at each differing level; 8.4 sums strengths (sum of zeros = 0). Consumers see genuine 0-weight edges.  
  _Evidence:_ reproduced: repro3-class-and-replay.mjs Check C -> 'CGEs: [[2,0],[1,0]]'
- [by-design] Req 6.2 exact shape 'Repo -> L1 -> L2 -> File' vs wrapper levels inserted above L1 when the repository is oversized  
  Req 11.2 explicitly sanctions intermediate Group_Node levels so depth derives from maxGroupSize and file count; module docstring documents the resolution.  
  _Evidence:_ hierarchy-builder.ts:7-17 (docstring), 119-129; requirements.md Req 11.2
- [already-handled] validateHierarchyConfig bounds: maxGroupSize <2 / >50 / non-integer; minPartitionThreshold <2 / >maxGroupSize / non-integer  
  All six violations rejected as INVALID_CONFIG naming the field (Req 6.6, 6.8).  
  _Evidence:_ hierarchy-builder.ts:42-60; test 'validateHierarchyConfig rejects out-of-bounds...' hierarchy-builder.test.ts:216-232
- [already-handled] DEFAULT_HIERARCHY_CONFIG is {maxGroupSize:20, minPartitionThreshold:2} and self-validates  
  _Evidence:_ hierarchy-builder.ts:37-40; hierarchy-builder.test.ts:234-239
- [already-handled] Invalid hierarchy config propagates through groupGraph as INVALID_CONFIG before any work  
  _Evidence:_ hierarchy-builder.ts:67-70, orchestrator.ts:113-116; hierarchy-builder.test.ts:241-249
- [already-handled] WHERE CLASS NODES GO: kind:'class' with definedInFile -> child of its file, present in hierarchy and nodes.json, edges with class endpoints preserved in leafEdges and aggregated into CGEs at group levels  
  childrenOfFile collects any non-file node with definedInFile referencing a file (:78-92); attached at :157-176; ingest guarantees definedInFile validity for class/function (ingestor.ts:49-75). Reproduced: class node parent=file, level 4, class->class cross-package edge produced CGEs at levels 1 and 2 with correct weight.  
  _Evidence:_ reproduced: repro3-class-and-replay.mjs Check B -> 'class com.a.A parent: file:a/A.java level: 4', 'CGE count: 2 [[2,4],[1,4]]'; test Property 20 (hierarchy-builder.test.ts:114) covers class kind
- [already-handled] partitionChildren n = maxGroupSize + 1  
  b=2, sizes differ by at most one, both <= maxGroupSize.  
  _Evidence:_ Property 21b (hierarchy-builder.test.ts:156-187) quantifies maxGroupSize 2..10 over up to 40 ids; math at hierarchy-builder.ts:244-254
- [already-handled] partitionChildren n exact multiple of maxGroupSize  
  remainder 0 -> all slices exactly floor(n/b) = maxGroupSize, still within bound (cascade test: 30 files @ max 5 -> six 5-file slices).  
  _Evidence:_ hierarchy-builder.test.ts:251-295 ('partitioning cascades deterministically...'); design.md 6.7 edge-case paragraph
- [already-handled] partitionChildren maxGroupSize=2 with minPartitionThreshold=2 (minimum legal config), n=3  
  b=2, slices [2,1]; covered by Property 21b's quantification including maxGroupSize=2.  
  _Evidence:_ hierarchy-builder.test.ts:156-187
- [already-handled] Recursion claim: one partitioning pass suffices (ceil(n/b) <= maxGroupSize when b = ceil(n/maxGroupSize))  
  Provable; code never recurses; Property 21b asserts every slice within bound. Design note about recursion applies only to mid-build config change, impossible here.  
  _Evidence:_ hierarchy-builder.ts:244-254; design.md 'Balanced partitioning heuristic' step 4; Property 21b
- [already-handled] Repository node itself exceeding maxGroupSize children (Req 11.1/11.2): wrap loop, termination, uniform depth  
  while-loop wraps ALL repository children each round (b=ceil(n/max) >= 2 wrappers, b < n so terminates); wrapping is uniform so every file stays at equal depth, keeping the index=level alignment the CGE ancestor walk relies on. Property 21a (maxGroupSize 5, up to ~7 regions) exercises the wrap.  
  _Evidence:_ hierarchy-builder.ts:120-129; hierarchy-builder.test.ts:136-153 (Property 21a asserts repository bound)
- [already-handled] L1/L2 shape with 1 region / 1 file / 1 group total: are both levels always materialized?  
  Yes — a single file yields repo -> L1(1 child) -> L2(1 child) -> file, depth 3; depth is 3 + wrapLevels, constant across files, +1 for class/function leaves. Property 19 asserts every file has >= 2 group ancestors.  
  _Evidence:_ hierarchy-builder.ts:96-117 (both levels unconditionally built); hierarchy-builder.test.ts:92-107
- [already-handled] Depth computation includes class/function leaves (deepest Leaf_Node per Req 9.4)  
  BFS from repository assigns level = path index; depth = max level, so member leaves at file+1 count.  
  _Evidence:_ hierarchy-builder.ts:187-200; reproduced Check B: class at level 4
- [already-handled] Map mutated while iterated at :140-156 (nodes.set of leaf children inside for..of over nodes)  
  JS Map iteration visits entries appended during iteration; loop terminates because appended leaves are never kind 'group' (region memberships contain only kind-file ids). Correct today but relies on a subtle invariant — the crafted-collision gap shows what happens when a child id already exists as a group. Fragility note, no current defect via orchestrator.  
  _Evidence:_ hierarchy-builder.ts:140-156; reasoned-from-code
- [already-handled] Defensive branch: file with members but absent from every region (fileNode undefined at :170-175)  
  Unreachable via orchestrator (Primary_Region partition is total over file nodes, Property 8/14); members would still be attached with a dangling parentId if a direct caller bypassed construct — ancestorPath then fails to reach the root and the CGE walk breaks out at the first non-group index, so no crash.  
  _Evidence:_ hierarchy-builder.ts:157-176, 311-323; reasoned-from-code
- [already-handled] kind fallback 'file'/'function' for child ids missing from leafAttributes (direct-caller input)  
  Defensive only; via orchestrator every group child id is an ingested file id and every member id an ingested class/function id.  
  _Evidence:_ hierarchy-builder.ts:149, 163; reasoned-from-code
- [already-handled] Req 8.1 leaf-edge retention: parallel edges, self-loops, zero-strength edges, class/function-endpoint edges all preserved verbatim with direction and strength  
  leafEdges = model.weightedEdges (all input edges, canonically sorted at ingest, strength added by map).  
  _Evidence:_ hierarchy-builder.ts:203; Property 26 (edges-preservation.test.ts:105-144, multiset equality incl. parallel edges); arbitraries deliberately generate self/parallel/function-endpoint edges (arbitraries.ts:97-105)
- [already-handled] CGE: self-loop leaf edge and self-referential group pairs  
  Identical ancestor chains -> every index equal -> skip; a CGE can never connect a group to itself.  
  _Evidence:_ hierarchy-builder.ts:281-283; Property 27 asserts cge.source != cge.target (edges-preservation.test.ts:156)
- [already-handled] CGE: leaves sharing the immediate parent group contribute nothing at that level (Req 8.3); function->function edges across files in the same L2 group produce no CGE (immediate parents are files, not groups)  
  Divergence at the file index hits kind 'file' -> break before any group pair is recorded.  
  _Evidence:_ hierarchy-builder.ts:286-289; edges-preservation.test.ts:239-270; Property 27 independent recomputation
- [already-handled] CGE float accumulation: is the sum canonically ordered (order-dependent float addition)?  
  Yes — aggregation iterates leafEdges = model.weightedEdges, which ingest sorted with compareDependencyEdges (full-content tiebreaker so even parallel-edge ties have canonical order) and computeWeights maps in order. Same input (in any order) -> same addition sequence -> byte-identical output.  
  _Evidence:_ ingestor.ts:35, weights.ts:33-37, hierarchy-builder.ts:271-303; Property 24/25 byte-identical serialization (pipeline-determinism.test.ts:20,47)
- [already-handled] CGE level field: recorded once at first contribution per (source,target) pair  
  The pair identifies two fixed hierarchy nodes, so the level is invariant across contributions; endpoints provably at the same level because path index = level (uniform wrapping).  
  _Evidence:_ hierarchy-builder.ts:294-301; Property 27 asserts source/target level equality and cge.level match (edges-preservation.test.ts:162-163)
- [already-handled] CGE map key: JSON.stringify([source,target]) is delimiter-collision-free; output sorted by (source,target) compareIds  
  _Evidence:_ hierarchy-builder.ts:290, 305-307
- [already-handled] CGE: mixed-depth endpoints (file->function, class->class) align correctly in the lockstep walk  
  Paths start at the root and each step is +1 level, so index i is level i in both chains; comparison over min length visits exactly the shared group levels.  
  _Evidence:_ hierarchy-builder.ts:277-289; reproduced Check B (class->class edge -> CGEs at levels 1 and 2)
- [already-handled] Property tests for my cluster pass on the current build  
  node --test over dist for Properties 19/21/22/23/26/27: fail 0, duration ~1.15s.  
  _Evidence:_ reproduced: node --test --test-name-pattern 'Property (19|21|22|23|26|27)' packages/core/dist/*.test.js -> fail 0

#### `packages/core/src/hierarchy-builder.ts + group-id.ts`

- **[gap]** Crafted leaf id equal to a content-addressed group id ('g_'+40hex is forward-computable from membership) corrupts the tree  
  Leaf id space is unconstrained; an input file named groupIdOf(['file:A']) collides with region com.a's L2 group id. nodes.set dedups: the file node is never created (nodes.has(childId) at :145 sees the group), the colliding id ends up referenced in TWO childIds lists (its own L1 and the other region's L2), file count drops from 3 to 2. Adversarial input only (requires computing sha1 forward, trivial for a crafted graph.json; parser-emitted file ids carry 'file:' prefix, but FQN class ids have no prefix — a Java class literally named g_<40hex> in the default package is syntactically valid). Distinct from known Ga…  
  _Evidence:_ reproduced: repro2-misc.mjs Repro 3 -> 'node kind in hierarchy: group', 'times referenced as a child: 2 (a tree requires exactly 1)', 'file nodes present: [file:A, file:B2] (input had 3 files)'

#### `packages/core/src/hierarchy-builder.ts + constructor.ts`

- **[gap]** Region with empty membership -> partitionChildren([]) returns [[]] -> empty Group_Node minted (Req 6.4 violation); two empty regions would mint the SAME id (duplicate child)  
  Orchestrator-safe (assignRegions only creates regions owning >=1 file), but construct() and buildHierarchy() are exported components and neither guards: preserve on an empty region yields [{fileIds:[]}] (constructor.ts:53), partitionChildren([],...) returns a single empty slice (:241-242), groupIdOf([])=g_sha1('[]') becomes a childless group node. A future Region strategy (module/directory subtrees per spec intro) emitting empty regions would hit this. Severity Low (defensive hole).  
  _Evidence:_ reproduced: repro2-misc.mjs Repro 5 -> 'EMPTY group nodes (violates Req 6.4): [g_97d170e1550eee4afc0af065b78cda302a97674c@L2]'

#### `packages/core/src/constructor.ts`

- **[gap]** structuralQualityBoundary = NaN accepted; decisions silently all-reconstruct; metadata.json records boundary and decisionConfidence as null; recorded-value replay flips decisions  
  No finiteness/range validation anywhere (construct, resolveConfig). score >= NaN is false -> automatic reconstruct everywhere; |score - NaN| = NaN; stableStringify renders NaN as null (JSON.stringify semantics). Violates Req 5.5 (the boundary value used is NOT recorded — null is) and Req 5.7: replaying the recorded values gives decideAction(0.8, null) = 'preserve' (null coerces to 0) vs recorded automaticAction 'reconstruct'. Property 18's test generates boundaries with noNaN:true so this hole is untested. CLI currently passes no boundary, so today it needs an API caller; any future CLI flag parsed with parseFlo…  
  _Evidence:_ reproduced: repro2-misc.mjs Repro 4 -> metadata.json '"structuralQualityBoundary":null', '"decisionConfidence":null'; repro3 Check A -> replayed decideAction(0.8, null) = 'preserve' vs original 'reconstruct'; code constructor.ts:47,66, orchestrator.ts:67, canonical.ts:84-88
- **[gap]** Override map keyed by a region id that does not exist in the assessment is silently ignored (no error, no metadata trace, output byte-identical to no-override run)  
  config.overrides.get(region.regionId) only reads keys for existing regions; a typo'd or stale region id ('pkg:com.A' vs 'pkg:com.a') silently no-ops. Spec 4.6/5.6 don't cover unknown ids (spec hole), but the evaluation methodology (all-preserve/all-reconstruct baseline override maps, design.md Baselines) makes user-supplied region-id maps a first-class workflow — a silent no-op undermines the 'auditable decisions' goal. Severity Medium (degraded quality, silent).  
  _Evidence:_ reproduced: repro2-misc.mjs Repro 7 -> userOverridden false, 'identical to no-override run? true'; constructor.ts:48
- [by-design] Boundary outside [0,1] (e.g. 0 or 1.000001) as a config-only always-preserve / always-reconstruct switch  
  Design Evaluation baselines explicitly reach both baselines through boundary values outside the score range; R4.4 test uses 1.000001.  
  _Evidence:_ design.md 'Baselines'; constructor.test.ts:261-325
- [by-design] Reconstruct on a region with zero internal edges (no signal)  
  Detector receives an edgeless subgraph -> single community 0 (documented Phase-1 behavior avoiding singleton explosion). This is the everyday consequence of known Gap 1 (import-only edges leave intra-package edges ~0) — deepens Gap 1's visible effect but is the specified degenerate handling, not a new defect.  
  _Evidence:_ community.ts:59-66, 85-87; constructor.ts:106
- [already-handled] decideAction boundary comparison: exact tie score == boundary -> preserve (Req 4.2 '>=', Property 12)  
  Exact ties are exercised concretely by degenerate regions (score 0.0) against boundary 0 in the R4.4 example test.  
  _Evidence:_ constructor.ts:32-34; constructor.test.ts:64-86 (Property 12), 261-325 (boundary 0 preserves everywhere)
- [already-handled] Override equal to the automatic action still records userOverridden: true plus both actions  
  _Evidence:_ constructor.ts:49,64-65; Property 13/17 (constructor.test.ts:89-119, 200-228)
- [already-handled] Preserve action group structure: exactly ONE RegionGroup carrying all the region's files (L2 size-partitioning happens later in the builder per Req 6.7)  
  Preserve keeps the region's files together as one group result; the builder may split it into sibling L2 groups purely by size, which Req 6.7 mandates and does not violate Req 4.2 (boundary retention is at region granularity).  
  _Evidence:_ constructor.ts:52-53; constructor.test.ts:306-311 (single group, membership equals region nodeIds)
- [already-handled] reconstructRegion edge projection: cross-region edges, self-file edges, and edges with unknown endpoints excluded; class/function edges attributed to owning files  
  owningFileOf maps members to their defining file so class-level coupling still steers file-level communities; endpoints outside the region's member set are dropped per Req 4.3 (detection over the Region's nodes and edges).  
  _Evidence:_ constructor.ts:84-104; regions.ts:65-73
- [already-handled] Detector returning a partial assignment (node missing from communityOf)  
  '?? 0' defaults unassigned members into community 0 — defensive; LouvainCommunityDetector assigns every node. A hostile injected detector could silently merge nodes, but detectors are trusted engine components.  
  _Evidence:_ constructor.ts:110
- [already-handled] Deterministic group emission from reconstruction: members iterated in compareIds order, communities emitted by ascending content-relabeled label  
  _Evidence:_ constructor.ts:109-121; community.ts relabelByContent:103-126; Property 15 (constructor.test.ts:148-160)
- [already-handled] decisions array order and regionGroups map order follow assessment.regions canonical order  
  _Evidence:_ constructor.ts:45-46 comment + loop; regions.ts:54 sorts region ids; Property 16 completeness (constructor.test.ts:163-197)
- [already-handled] Duplicate regionId in assessment.regions (direct-caller input): regionGroups.set overwrites while decisions duplicates  
  Unreachable via assess() (regions come from a Map). Defensive-only observation; no guard, but no pipeline path produces it.  
  _Evidence:_ constructor.ts:56-57; regions.ts:34-56; reasoned-from-code
- [already-handled] modularity recorded only WHERE computed; field omitted (not null/0) otherwise, survives JSON round-trip  
  _Evidence:_ constructor.ts:61; constructor.test.ts:327-378
- [already-handled] Every file node lands in exactly one group result (Req 4.5), incl. reconstruct path  
  _Evidence:_ Property 14 (constructor.test.ts:122-145) multiset equality over all regions

#### `packages/core/src/group-id.ts`

- **[gap]** groupIdOf([]) is well-defined (sha1 of '[]') — enables the empty-group defect and makes two distinct empty groups share one id  
  Folded into the empty-membership-region gap; group-id itself has no non-empty precondition.  
  _Evidence:_ reproduced: repro2 Repro 5 minted g_97d170e1550eee4afc0af065b78cda302a97674c (= sha1('[]'))
- [by-design] Chained content addressing: L1 group whose single child is an L2 group id, wrapper levels over wrapper ids  
  Each level hashes a different membership string so ids differ unless sha1 has a fixed point on this construction; design explicitly treats hash collisions as a test-surfaced defect, not a runtime concern.  
  _Evidence:_ design.md 'Group_Node identifier scheme'; group-id.ts:1-8 docstring
- [by-design] sha1 collision across distinct memberships  
  Documented: surfaced by tests, not handled at runtime (Req 7.4 note).  
  _Evidence:_ group-id.ts:5-8; design.md 'Group_Node identifier scheme'
- [already-handled] Join-ambiguity: ['a b'] vs ['a','b'] must not collide  
  Membership key is JSON.stringify of the sorted list, not a join; arbitrary in the test deliberately covers ids with spaces/quotes.  
  _Evidence:_ group-id.ts:23-28; canonical-and-ids.test.ts:19-27, Property 22 (:29-55)
- [already-handled] Order-independence and run-stability of groupIdOf/repositoryIdOf  
  _Evidence:_ sortIds before digest (group-id.ts:27); Property 22 permutation assertions
- [already-handled] A group and the repository with identical membership: distinct ids via g_/r_ prefix  
  _Evidence:_ group-id.ts:14-21; canonical-and-ids.test.ts:57-65
- [already-handled] Ids containing lone surrogates: digest injectivity under utf8 encoding  
  Node's well-formed JSON.stringify (ES2019+) escapes lone surrogates as \udXXXX, so the membership key contains no unpaired surrogates and utf8 byte encoding stays injective on distinct key strings. Node v26 in this environment.  
  _Evidence:_ group-id.ts:27-28; reasoned-from-code (well-formed JSON.stringify semantics)

#### `packages/core/src/canonical.ts (used by group-id.ts / hierarchy-builder.ts)`

- **[gap]** compareIds is UTF-16 code-unit order while the parser's canonical order (graph.json) is UTF-8 byte order — the two 'canonical' orders disagree for supplementary-plane vs high-BMP ids  
  compareIds('\uFF61','\u{10000}') = 1 (core sorts the astral char first) but compareUtf8 = -1 (parser sorts U+FF61 first). Every core boundary (childIds ordering, membership hashing, edges.json/nodes.json ordering) uses compareIds; graph.json uses compareUtf8. Core output is internally consistent and deterministic (it re-sorts everything at ingest), so no wrong grouping results — but the engine's 'canonical sorting at every boundary' rule now means two different orders on the two sides of the seam, and any consumer/diff tool assuming one total order across graph.json and index/*.json breaks on non-ASCII ids (Java…  
  _Evidence:_ reproduced: repro2-misc.mjs Repro 6 -> core sort ["\u{10000}","\uFF61"] vs parser sort ["\uFF61","\u{10000}"]; core/src/canonical.ts:12-14 vs parser/src/canonical.ts:38-39

#### `packages/core/src/group-id.ts + regions.ts`

- [already-handled] A Region whose id could equal another group's node id  
  Region ids are pkg:/dir:-namespaced strings used only as map keys (regionGroups/level2IdsOfRegion); they never become hierarchy node ids, so no collision surface with g_/r_ ids exists.  
  _Evidence:_ regions.ts:12-14, 27-32; hierarchy-builder.ts:96-107

#### `packages/core/src/hierarchy-builder.test.ts / constructor.test.ts`

- **[gap]** Coverage hole: arbitraries generate only file/class/function kinds and noNaN boundaries  
  Explains why the group/repository-kind silent drop and the NaN-boundary null-metadata defects survive a green property suite (fail 0 on current build). Folded as evidence into those two gaps rather than a separate candidate.  
  _Evidence:_ test-support/arbitraries.ts:59-107 (kinds), constructor.test.ts:19 (fc.double noNaN:true); test run: 'fail 0'

### packages/core — index serialize/parse, metadata, blast radius

> Scope: `index-serializer.ts`, `index-parser.ts`, `metadata.ts`, `blast-radius.ts` (+ tests) · grouping Req 9, 10, 11.3–11.4  
> **63 cases examined** — 23 gap · 5 by-design · 35 already-handled


#### `packages/core/src/index-serializer.ts`

- **[gap]** Write failure on file N of 5 leaves files 1..N-1 on disk (non-atomic five-file write; no temp+rename, no cleanup on error)  
  serializeIndex writes the five files sequentially with writeFileSync (index-serializer.ts:86-92). A failure on file 3 returns WRITE_FAILED but repository.json and hierarchy.json remain. Violates the engine's cross-cutting no-partial-output rule (design.md:568 'produces no partial output') and contrasts with the parser package's temp+rename atomic write (packages/parser/src/serializer.ts:249-270). Spec 9.8 itself only demands an error, so this is a spec hole plus a cross-cutting-rule deviation.  
  _Evidence:_ REPRODUCED: pre-created <dir>/nodes.json as a directory; serializeIndex -> {code:WRITE_FAILED,file:'nodes.json'}; dir afterwards contains hierarchy.json + repository.json (new partial output). repro: scratchpad/repro/core-index-io/repro.mjs section R1.
- **[gap]** Failed re-index over an existing index directory leaves a MIXED old/new file set that parseIndex accepts (metadata.json is written last, so a failure on file 5 leaves the new hierarchy with the previous run's metadata)  
  The realistic trigger is re-running `npm run group` into the same <project>/index dir (group-cli.ts:34 default) after the code changed, with a write failure (disk full, permission). Because metadata.json carries no repositoryId and parseIndex never cross-checks metadata.nodeCount/edgeCount/hierarchyDepth/perLevel against the parsed hierarchy, the incoherent set parses successfully: stale region decisions and counts are silently attached to the new tree.  
  _Evidence:_ REPRODUCED: serialize graph A; chmod 444 metadata.json; serialize superset graph B into the same dir -> WRITE_FAILED metadata.json; parseIndex -> ok:true with hierarchy.nodes.size=8 (graph B) but metadata.nodeCount=5, metadata.edgeCount=1 (graph A) and stale regionDecisions. repro.mjs section R2.
- **[gap]** WRITE_FAILED payload inconsistency: mkdir failure carries the full directory path, per-file failure carries only the basename  
  Cosmetic: error consumers get 'nodes.json' with no directory context on per-file failures but a full path on mkdir failures. Spec 9.8 only demands identifying the file, so Low.  
  _Evidence:_ index-serializer.ts:84 (file: dir) vs :90 (file: name).
- **[gap]** NaN/Infinity numeric field serializes as JSON null; serializeIndex succeeds but its own output is rejected by parseIndex  
  stableStringify delegates numbers to JSON.stringify (canonical.ts:84-86), which renders non-finite values as 'null'. serializeIndex reports success while emitting an index that violates Property 30 (round-trip 'for any Hierarchy'). Unreachable from the current pipeline (weights.ts:51 clamps strength to finite >= 0; JSON input cannot encode NaN), so this is an exported-API robustness hole: serializeIndex/indexFilePayloads are public (index.ts:29).  
  _Evidence:_ REPRODUCED: set hierarchy.leafEdges[0].strength = NaN; serializeIndex ok:true; edges.json contains '"strength":null'; parseIndex -> MALFORMED_FILE edges.json 'leaf edge missing a required field'. repro.mjs section R8.
- **[gap]** -0 serializes as '0' (JSON.stringify(-0) === '0'): sign information lost across round-trip  
  -0 CAN enter the engine: '-0' is valid JSON and JSON.parse('-0') yields -0, and the ingest path does not normalize signal values. Serialized bytes are deterministic ('0'), so determinism holds; only Object.is-level in-memory round-trip fidelity is lost. Nothing downstream branches on -0. Low/cosmetic.  
  _Evidence:_ REPRODUCED: importFrequency=-0 -> edges.json '"importFrequency":0'; parsed value is +0 (Object.is false). repro.mjs section R9.
- **[gap]** Leaf hierarchy node with no leafAttributes entry serializes without directoryPath  
  indexFilePayloads spreads attributes conditionally (index-serializer.ts:53-55); a leaf missing from leafAttributes yields an entry without the contract-required directoryPath, which parseIndex then silently defaults to '' (see parser entry). Unreachable from the builder, API-misuse only. Folded into the silent-defaulting candidate.  
  _Evidence:_ index-serializer.ts:47-56; index-parser.ts:127.
- [by-design] Pre-existing unrelated files in the target directory are not cleaned before writing  
  Spec 9.1 requires writing exactly the five files, not that the directory contain only them. On full success all five canonical names are overwritten, so a previously complete index is fully replaced. Only the failure path (previous entry) is dangerous.  
  _Evidence:_ index-serializer.ts:82 (mkdirSync recursive, no cleanup); requirements.md Req 9.1.
- [already-handled] mkdir failure (target path occupied by an existing plain file) -> WRITE_FAILED  
  Caught and returned as a Result naming the directory.  
  _Evidence:_ index-serializer.ts:81-85; test 'serializing into a path that is an existing file fails with WRITE_FAILED (R9.8)' (index-files.test.ts:274).
- [already-handled] Per-file write failure (EACCES read-only file, EISDIR name occupied by directory) -> WRITE_FAILED naming the file  
  Each writeFileSync is wrapped; error is a structured Result, no throw escapes.  
  _Evidence:_ index-serializer.ts:86-92; reproduced in repro.mjs R1 (EISDIR) and R2 (EACCES).
- [already-handled] Very large numbers serialize in exponent notation ('1e+21')  
  Valid JSON, accepted by parseIndex (typeof number), exact round-trip, byte-identical across runs since JSON.stringify is deterministic.  
  _Evidence:_ REPRODUCED: structuralQualityBoundary=1e21 -> metadata.json '1e+21'; parse ok; value === 1e21. repro.mjs section R9.
- [already-handled] Float round-trip exactness for finite doubles (scores, strengths, weights)  
  JSON.stringify emits the shortest string that round-trips to the same double (ECMAScript Number::toString); JSON.parse recovers the identical bit pattern. Property 30 test round-trips strengths and decisions.  
  _Evidence:_ canonical.ts:84-86; index-files.test.ts Property 30 (deepEqual on regionDecisions incl. float scores).
- [already-handled] undefined-valued fields (metricWeights.modularity, hypothetical absent strength) omitted by stableStringify  
  Omission semantics match the shared contract; absent modularity is optional on parse. A JS caller passing strength: undefined would produce an edges.json the parser rejects loudly (type guard), and the TS type (DependencyEdge & {strength: number}) prevents it at compile time.  
  _Evidence:_ canonical.ts:95 (filter v !== undefined); index-parser.ts:146 (strength type-checked).
- [already-handled] crossGroupEdges are not defensively sorted by the serializer (leafEdges are)  
  hierarchy-builder emits crossGroupEdges canonically sorted (hierarchy-builder.ts:305-307), so pipeline output is byte-stable. Asymmetry note: an API caller constructing a Hierarchy with a reordered-but-equal crossGroupEdges array gets different bytes; leafEdges by contrast are re-sorted at index-serializer.ts:60.  
  _Evidence:_ index-serializer.ts:60 vs :68; hierarchy-builder.ts:305-307.
- [already-handled] stableStringify throw on unsupported value types (BigInt, function) inside the write loop  
  The stringify call sits inside the per-file try, so the TypeError is caught and surfaced as WRITE_FAILED (slightly miscategorized reason, but no throw escapes). Files written before the failing one remain (see non-atomic entry). Unreachable with typed inputs.  
  _Evidence:_ index-serializer.ts:87-91; canonical.ts:100.

#### `packages/core/src/index-parser.ts`

- **[gap]** null element inside any validated array (hierarchy.json nodes, nodes.json nodes, edges.json leafEdges/crossGroupEdges, metadata regionDecisions, perLevel) -> TypeError THROWN instead of MALFORMED_FILE Result  
  for-of loops access entry.id / entry.source / decision.regionId / level.level directly; property access on null throws, escaping the Result-only error contract ('no throws escaping the pipeline'). Non-null primitives (42, 'str') are handled gracefully because property access on them yields undefined.  
  _Evidence:_ REPRODUCED: hierarchy.json nodes:[null,...] -> parseIndex throws TypeError 'Cannot read properties of null (reading id)'; metadata regionDecisions:[null] -> TypeError reading 'regionId'. index-parser.ts:44-46,111-112,139-141,167-169,222-224,236-238. repro.mjs section R3.
- **[gap]** Parent-side membership NOT checked: node claims parentId=P but P.childIds does not list it -> accepted  
  Only the childIds->parentId direction is verified; the converse (every node with parentId=P appears in P.childIds) is not, although the comment at :68-69 claims links 'agree in both directions'. The node becomes invisible to top-down traversal while still counted in nodeCount and reachable by blast-radius ancestor climb.  
  _Evidence:_ REPRODUCED: added file:orphan/Y.java with parentId=<root> to hierarchy.json+nodes.json without touching root.childIds -> parseIndex ok:true, root childIds do not include it. index-parser.ts:70-95. repro.mjs section R5.
- **[gap]** Containment cycle with mutually consistent links (self-parent node, or A<->B parent cycle) -> accepted; downstream analyzeBlastRadius infinite-loops  
  A node {id:X, parentId:X, childIds:[X]} passes every check: parentId exists, child back-pointer agrees. parseIndex has no cycle/level-monotonicity check. The blast-radius ancestor climb (while parentId !== null) then never terminates.  
  _Evidence:_ REPRODUCED: tampered index parses ok:true; child node process running analyzeBlastRadius on the cycle node killed by 4s timeout (SIGTERM, no output) - infinite loop. index-parser.ts:70-95 (no cycle check); blast-radius.ts:59-66 (unguarded climb). repro.mjs section R4.
- **[gap]** Multiple roots (second node with parentId null) accepted  
  Nothing enforces a single level-0 root or that all nodes are reachable from repositoryId; a forest parses as a valid Hierarchy.  
  _Evidence:_ REPRODUCED: added {id:'g_secondroot', kind:'group', level:0, parentId:null, childIds:[]} to both files -> parseIndex ok:true. repro2.mjs r14.
- **[gap]** Duplicate ids within a childIds array accepted  
  Each occurrence passes the back-pointer check; duplicates then double-count in averageBranchingFactor (metadata.ts:36) and any consumer iterating children. Also: childIds sortedness (Req 7.5 canonical order) is not verified on parse.  
  _Evidence:_ REPRODUCED: parent.childIds=[c, c] -> parseIndex ok:true. index-parser.ts:78-94. repro2.mjs r12.
- **[gap]** kind not validated against the enum: kind:'banana' accepted in hierarchy.json (and in nodes.json)  
  entry.kind is only checked to be a string, then cast (index-parser.ts:48,61). Unknown kinds flow into HierarchyNode['kind']; buildMetadata and blast-radius then treat them as leaves by default.  
  _Evidence:_ REPRODUCED: leaf kind changed to 'banana' in hierarchy.json -> parseIndex ok:true. repro.mjs section R6.
- **[gap]** kind mismatch for the same id between hierarchy.json and nodes.json accepted; leaf attributes silently dropped  
  No cross-file kind consistency check. hierarchy.json says file, nodes.json says group -> parse ok and the node silently loses its leafAttributes (nodes.json kind drives the leafAttributes branch at :122).  
  _Evidence:_ REPRODUCED: nodes.json kind flipped to 'group' for a file node -> parseIndex ok:true, leafAttributes missing for that id. repro.mjs section R6b.
- **[gap]** Leaf node entry missing directoryPath -> silently defaulted to '' instead of MALFORMED_FILE  
  GraphNode.directoryPath is required by the shared contract; spec 9.7 demands an error for a missing required field. The parser fabricates '' (index-parser.ts:127), so a corrupted nodes.json produces a silently wrong Hierarchy instead of failing loudly.  
  _Evidence:_ REPRODUCED: deleted directoryPath from a file entry -> parseIndex ok:true, reconstructed directoryPath === ''. repro.mjs section R7.
- **[gap]** Wrong-typed leaf attribute fields: directoryPath=42 coerced to ''; non-string packagePath/definedInFile silently dropped  
  typeof guards are used for value SELECTION rather than validation (index-parser.ts:126-128): wrong-typed values vanish without error, violating 9.7 fail-loud intent. The existing tampered-field test covers childIds but not these attribute fields.  
  _Evidence:_ REPRODUCED: directoryPath=42 -> parseIndex ok:true, directoryPath === ''. repro.mjs section R7b.
- **[gap]** Edge endpoint KINDS unchecked and numeric ranges unconstrained: leaf edge between two group nodes, cross-group edge between two file nodes, negative importFrequency, fractional methodCallFrequency, negative strength/wei…  
  Only typeof-number is enforced. The parser contract (parser spec R7.4) constrains signals to non-negative integers, and CrossGroupEdge semantics require group endpoints and an integer level; none of this is validated on read-back, so a tampered index yields semantically invalid edges downstream (e.g., negative weights feeding blast radius or viewers).  
  _Evidence:_ REPRODUCED: leaf self-edge on the repository node with importFrequency:-5, methodCallFrequency:0.5, strength:-1 -> ok:true; crossGroupEdge between two file nodes with level:1.5, weight:-3 -> ok:true. index-parser.ts:139-165,167-189. repro2.mjs r13/r15.
- **[gap]** repositoryId not required to exist in the node set: consistent 'ghost:repo' in both files accepted  
  The equality check passes when both files carry the same ghost id; nodes.has(repositoryId) is never asserted, so hierarchy.repositoryId can point at nothing.  
  _Evidence:_ REPRODUCED: repositoryId='ghost:repo' in repository.json+hierarchy.json -> parseIndex ok:true, hierarchy.nodes.has('ghost:repo') === false. repro.mjs section R10b.
- **[gap]** hierarchyDepth accepts non-integer/negative values and is not cross-checked against metadata.hierarchyDepth or the actual tree  
  Node level requires Number.isInteger (index-parser.ts:49) but hierarchyDepth only typeof number (:193): depth 3.7 or -1 round-trips into hierarchy.depth. Also repository.json nodeCount/edgeCount are read but entirely ignored, so inconsistent counts are accepted.  
  _Evidence:_ REPRODUCED: hierarchyDepth=3.7 -> parseIndex ok:true, hierarchy.depth === 3.7. repro.mjs section R10.
- **[gap]** metadata counts (nodeCount, edgeCount, hierarchyDepth, totalCrossGroupEdges, perLevel sums) not cross-checked against the parsed hierarchy  
  Any internally-consistent-looking metadata.json is attached verbatim to the returned Hierarchy. This is the acceptance-side mechanism that makes the stale-metadata mixed set (serializer entry) parse successfully.  
  _Evidence:_ REPRODUCED via R2: metadata.nodeCount=5 attached to an 8-node hierarchy, parse ok:true. index-parser.ts:204-246 (type checks only, no value cross-checks).
- **[gap]** perLevel numeric values unconstrained (fractional level, negative counts accepted)  
  Same typeof-only pattern; folded into the value-range validation hole.  
  _Evidence:_ index-parser.ts:236-246 (typeof number checks only).
- **[gap]** Optional modularity fields (regionDecision.modularity, metricWeights.modularity) unchecked when present  
  A string modularity survives into the returned Metadata. Low.  
  _Evidence:_ index-parser.ts:222-235 (modularity absent from the guard); types.ts:53-57,73-85.
- [by-design] Parallel/duplicate leaf edges accepted  
  The in-memory model is a multigraph (types.ts DependencyModel uses MultiDirectedGraph) and the round-trip must preserve whatever edge multiset the hierarchy holds; a duplicate check would wrongly reject legitimate parallel edges.  
  _Evidence:_ index-parser.ts:139-165 (no dup check); canonical.ts:32-55 (parallel-edge tiebreaker comparator exists on purpose).
- [by-design] Duplicate keys inside a JSON object (e.g. two 'id' fields)  
  JSON.parse last-wins semantics; not detectable without a custom parser and not required by the spec.  
  _Evidence:_ index-parser.ts:32 (standard JSON.parse).
- [already-handled] One or more member files missing -> single MISSING_FILES error naming all of them, no partial Hierarchy  
  All five names filtered through existsSync before any read.  
  _Evidence:_ index-parser.ts:18-21; Property 31 test (index-files.test.ts:210-237) covers every non-empty subset.
- [already-handled] Malformed JSON in any member file -> MALFORMED_FILE naming the file  
  Per-file JSON.parse wrapped in try/catch.  
  _Evidence:_ index-parser.ts:31-35; test 'invalid JSON in metadata.json...' (index-files.test.ts:239).
- [already-handled] File exists but cannot be read (EISDIR, EACCES, TOCTOU deletion between existsSync and readFileSync) -> MALFORMED_FILE 'file could not be read'  
  No throw escapes; a TOCTOU-deleted file is reported as MALFORMED_FILE rather than MISSING_FILES (cosmetic miscategorization).  
  _Evidence:_ index-parser.ts:26-30.
- [already-handled] Top-level document of wrong shape (null, scalar, array) in any of the five files  
  Optional chaining plus Array.isArray/typeof guards reject each: hierarchy.json (:40), nodes.json (:99), edges.json (:135), repository.json (:193), metadata.json (:205-221).  
  _Evidence:_ index-parser.ts:39-42,98-101,134-137,192-195,204-221.
- [already-handled] Duplicate node entry in hierarchy.json  
  Explicit duplicate check before insertion.  
  _Evidence:_ index-parser.ts:56-58.
- [already-handled] Wrong-typed hierarchy.json node fields (id/kind/level non-integer/parentId/childIds incl. non-string elements)  
  Full type guard per entry; childIds elements individually checked.  
  _Evidence:_ index-parser.ts:45-54; tampered test 'Wrong-typed childIds elements' (index-files.test.ts:326-331).
- [already-handled] Unknown parentId, unknown childId, or child whose parentId does not point back at the listing parent  
  Referential integrity loop rejects all three.  
  _Evidence:_ index-parser.ts:70-94.
- [already-handled] nodes.json id-set bijection with hierarchy.json (count mismatch, unknown id, duplicate entry)  
  count equality + unknown-id rejection + duplicate rejection together force exact bijection; the duplicate+omission tamper that defeats a plain count check is covered by a test.  
  _Evidence:_ index-parser.ts:102-121; tampered test 'Duplicate + omitted nodes.json entry' (index-files.test.ts:342-348).
- [already-handled] Ghost edge endpoints (leaf edge or cross-group edge referencing an unknown node id)  
  Both edge kinds check nodes.has(source/target).  
  _Evidence:_ index-parser.ts:150-155,176-182; tampered test 'Ghost leaf-edge endpoint' (index-files.test.ts:334-339).
- [already-handled] repository.json repositoryId type check and cross-file equality with hierarchy.json  
  Mismatch rejected naming repository.json.  
  _Evidence:_ index-parser.ts:192-202.
- [already-handled] metadata.json required scalar/array/object fields type-checked  
  All Metadata top-level fields plus metricWeights.cohesion/coupling checked; wrong-typed metricWeights rejected.  
  _Evidence:_ index-parser.ts:204-221; tampered tests (index-files.test.ts:350-365).
- [already-handled] regionDecision field validation including action/automaticAction enum membership  
  Unlike node kind, the action fields ARE checked against their enum.  
  _Evidence:_ index-parser.ts:222-235.
- [already-handled] UTF-8 BOM at file start -> JSON.parse throws -> MALFORMED_FILE  
  Fail-loud, satisfies 9.7. (The serializer never emits a BOM: canonical.ts guarantees no BOM.)  
  _Evidence:_ index-parser.ts:31-35; canonical.ts:8.

#### `packages/core/src/metadata.ts`

- **[gap]** averageBranchingFactor includes the Repository node while blast-radius excludes 'repository' from group results - inconsistent interpretation of Group_Node vs spec 11.4  
  Req 11.4 says 'average branching factor of the Group_Nodes'; Req 11.1 phrasing ('the Repository node and of every Group_Node') distinguishes the two, and blast-radius.ts:62 treats only kind==='group' as Group_Node. metadata.ts:33 counts kind==='repository' into the branching factor, so for a repo->pkg->files tree the reported factor is (1+N)/2 instead of N. Deterministic, test-encoded (test recomputes with the same inclusive rule), but a literal spec deviation and internally inconsistent with blast-radius. Low.  
  _Evidence:_ metadata.ts:33-38 vs blast-radius.ts:62; requirements.md Req 11.1/11.4; glossary line 38.
- [by-design] Metadata carries no repositoryId  
  Matches the design's Metadata model exactly (design.md:327-343). Side effect: a stale metadata.json from a different run of the same or another repo cannot be detected by id (feeds the mixed-set gap).  
  _Evidence:_ types.ts:146-157; design.md Metadata model.
- [already-handled] averageBranchingFactor division by zero when there are no group/repository nodes  
  Guarded ternary returns 0. In practice unreachable: every built hierarchy has a repository node, so groupNodeTotal >= 1.  
  _Evidence:_ metadata.ts:65; Property 29 test recomputes and matches (index-files.test.ts:104-116).
- [already-handled] Leaf-edge level attribution silently defaults a ghost endpoint's level to 0 (?? 0)  
  Unreachable via validated inputs: builder edges reference hierarchy nodes and parseIndex rejects ghost edges. Note only: buildMetadata is total and would silently misattribute rather than error on an API-misuse hierarchy.  
  _Evidence:_ metadata.ts:45-47.
- [already-handled] perLevel ordering determinism  
  Sorted ascending by level; map insertion order cannot leak into output.  
  _Evidence:_ metadata.ts:53.
- [already-handled] NaN guards on computed statistics  
  All inputs to the division are integer accumulations; the only division is guarded. Counts are increments. No NaN source exists inside buildMetadata.  
  _Evidence:_ metadata.ts:29-51,65.
- [already-handled] Degenerate shapes: single-file repo, levels containing only leaves or only groups  
  statsAt lazily creates per-level rows only for levels that hold nodes/edges; a single-file repo yields level-0 repository + level-1..n path, each counted correctly. Property 29 recomputes per-level counts independently over arbitrary graphs.  
  _Evidence:_ metadata.ts:20-27; index-files.test.ts:118-129.

#### `packages/core/src/blast-radius.ts`

- **[gap]** Ancestor climb has no cycle guard: infinite loop on a parse-accepted parent cycle  
  The dependency-edge BFS is cycle-safe, but the containing-groups climb (while node && node.parentId !== null) trusts the containment tree to be acyclic. parseIndex accepts self-parent/mutual-parent cycles (see parser entry), so a corrupted index hangs the analyzer instead of erroring. Same root cause as the parser cycle-acceptance entry - fix belongs in parseIndex (reject non-tree containment) and/or a visited-set in the climb.  
  _Evidence:_ REPRODUCED: analyzeBlastRadius on tampered self-parent node killed by 4s timeout (SIGTERM). blast-radius.ts:59-66. repro.mjs section R4.
- [by-design] Group or repository node as the query target  
  Spec 10.1 does not restrict target kind. Group ids never appear in pipeline leafEdges, so the result is the target itself (plus its group ancestors for nested groups); cross-group edges are intentionally not traversed (design traverses dependency edges only).  
  _Evidence:_ REPRODUCED: blast(repositoryId) -> nodes=[repoId], groupNodes=[]. repro.mjs section R11; design.md Blast_Radius_Analyzer section.
- [already-handled] Empty, null, undefined node id -> EMPTY_NODE_ID  
  Explicit guard; covered for all three inputs.  
  _Evidence:_ blast-radius.ts:27-29; blast-radius.test.ts:142-149.
- [already-handled] Unknown node id -> NODE_NOT_FOUND naming the id, hierarchy unchanged  
  Checked before any traversal state is built; test asserts node count unchanged.  
  _Evidence:_ blast-radius.ts:30-32; blast-radius.test.ts:151-162.
- [already-handled] Self-loop leaf edge (source === target)  
  The seed node is pre-inserted into visited, so its self-dependents are skipped; terminates.  
  _Evidence:_ blast-radius.ts:45-55.
- [already-handled] Dependency-edge cycles terminate with each node visited once  
  Visited-set BFS; explicit 3-cycle example test plus property test.  
  _Evidence:_ blast-radius.ts:45-55; blast-radius.test.ts:112-140 and Property 33.
- [already-handled] Deterministic, canonically sorted result order across repeated queries  
  Both arrays pass through sortIds; BFS order cannot leak. Property 33 asserts repeat-query identity.  
  _Evidence:_ blast-radius.ts:69-72; blast-radius.test.ts:81-103.
- [already-handled] Edge direction semantics consistent with the parser's contract  
  Parser stitcher sets source = reference.fromNodeId (the importing file), so edge A->B means A depends on B. blast-radius builds reverse adjacency keyed by target, so blast(B) includes dependent A - exactly R10.1's dependent-to-dependency traversal.  
  _Evidence:_ packages/parser/src/stitcher.ts:125 (source = fromNodeId); blast-radius.ts:35-43; Property 32 independent recompute agrees.
- [already-handled] Impacted ids absent from hierarchy.nodes (API-misuse hierarchy with ghost leafEdges endpoints)  
  nodes.get(impacted) undefined -> climb skipped; ghost ids do appear in the returned nodes list. Unreachable via parseIndex (ghost edges rejected) or the builder.  
  _Evidence:_ blast-radius.ts:58-67; index-parser.ts:150-155.
- [already-handled] groupNodes excludes the repository node  
  Only kind === 'group' ancestors are collected, matching the glossary's Repository/Group_Node distinction and the test's independent recompute.  
  _Evidence:_ blast-radius.ts:62; blast-radius.test.ts:37-50.
- [already-handled] Multiple dependency paths to the target -> node included at most once  
  Visited set + Set-based group collection; Property 33 asserts uniqueness.  
  _Evidence:_ blast-radius.ts:45-55,57; blast-radius.test.ts:93-95.
- [already-handled] Node with no incoming dependency edges -> blast radius is only itself (R10.5)  
  Property 32 explicitly asserts this branch when the picked target has no incoming edges.  
  _Evidence:_ blast-radius.test.ts:71-74.

### packages/core — orchestrator & CLI

> Scope: `orchestrator.ts`, `group-cli.ts`, `index.ts`, demo scripts (+ tests) · end-to-end sequencing  
> **46 cases examined** — 20 gap · 2 by-design · 24 already-handled


#### `packages/core/src/group-cli.ts`

- **[gap]** Input directory exists but contains no graph.json  
  readGraphFile returns MALFORMED_FILE{detail:'file could not be read'}; describeError renders it as 'malformed index file .../graph.json: file could not be read'. Two lies in one line: the input graph is not an 'index file', and a missing file is not 'malformed'. The MALFORMED_FILE code is shared with the Index_Parser (errors.ts:66), so describeError's wording is wrong for the graph-input use added by readGraphFile (orchestrator.ts:146-159). Cosmetic but it is the first error a user sees on the single most common misuse.  
  _Evidence:_ Reproduced: `node .../group-cli.js <dir-without-graph.json>` -> 'group: malformed index file .../empty-dir/graph.json: file could not be read', exit=1
- **[gap]** Standalone graph file whose name does not end in .json, no outDir given  
  defaultOutDir = join(graphPath.replace(/\.json$/i, ''), 'index') is a no-op for 'tiny.txt', so the default output dir becomes '<existing file>/index'; mkdirSync fails (ENOTDIR) and the run dies with WRITE_FAILED naming the directory, not explaining the real cause (group-cli.ts:40).  
  _Evidence:_ Reproduced: `group-cli.js tiny.txt` -> 'group: could not write index file: .../tiny.txt/index', exit=1
- **[gap]** Config flags (boundary/seed/weights/maxGroupSize) from the CLI - Req 4.4 'varied across runs without code changes'  
  The CLI accepts exactly two positionals (group-cli.ts:23); no flag parsing exists. The Structural_Quality_Boundary (and seed, metric weights, coefficients, maxGroupSize, computeModularity, overrides) can only be varied through the programmatic API, i.e. by writing code. tasks.md task 15 scopes the CLI as a TEMPORARY demo wrapper with only <input> [outDir], so this is partially by-design - but requirements.md Req 4.4 says the boundary 'can be varied across runs without code changes' and no non-code path (flag, env var, config file) exists anywhere. Worse, a user who tries `npm run group -- graph.json --boundary 0…  
  _Evidence:_ Reproduced: `group-cli.js tiny.json --boundary 0.7` -> 'output: .../--boundary', 'result: OK'; directory '--boundary' created; boundary printed 0.5
- **[gap]** Extra positional arguments beyond input and outDir  
  argv[4+] silently ignored (destructuring at group-cli.ts:23). Folded into the no-flags gap above - the CLI never warns about unrecognized arguments.  
  _Evidence:_ reasoned-from-code group-cli.ts:23 + '--boundary 0.7' repro (the '0.7' was silently dropped)
- **[gap]** Re-running over an existing index dir (stale files / mixed output)  
  All five canonical files are rewritten each run, so a SUCCESSFUL rerun is consistent (foreign junk files are left but the five-name set is fixed). However a FAILED rerun leaves a mixed old/new set - see the orchestrator partial-output gap below. CLI-angle note; primary owner is the index-io cluster.  
  _Evidence:_ Reproduced via config-probe.mjs section 12 (see orchestrator entry)
- [by-design] Relative path resolution vs cwd (INIT_CWD)  
  Relative paths resolve against INIT_CWD ?? process.cwd() so `npm run group` behaves like a plain command from any invocation dir (group-cli.ts:15-21, header comment; tasks.md task 15 mandates exactly this). Residual hypothesis-level oddity: invoking group-cli from inside an unrelated npm script inherits that script's INIT_CWD.  
  _Evidence:_ group-cli.ts:15-21; repro O ran with INIT_CWD set and resolved correctly
- [already-handled] No input argument (or empty-string argument)  
  Prints usage to stderr and exits 2 (group-cli.ts:24-27). Empty string is falsy so it hits the same guard.  
  _Evidence:_ Reproduced: `node packages/core/dist/group-cli.js` -> 'usage: npm run group -- <graph.json | project-dir> [outDir]', exit=2
- [already-handled] Nonexistent input path  
  statSync throws, caught -> 'group: path not found: <abs path>' exit 2 (group-cli.ts:31-45).  
  _Evidence:_ Reproduced: exit=2 with correct message
- [already-handled] Input path is a project directory  
  graph.json appended, default outDir = <dir>/index, matching tasks.md task 15 ('default output directory <graph.json dir>/index/') (group-cli.ts:32-35).  
  _Evidence:_ reasoned-from-code group-cli.ts:32-35 + demo-baselines run over fixtures/sample-java-project succeeded
- [already-handled] Exit-code contract per error class  
  2 = usage / path-not-found (pre-pipeline), 1 = structured pipeline error, 0 = success. Uncaught engine throws also exit 1 but with a stack trace (see the shape-crash gap).  
  _Evidence:_ Reproduced across runs A-J: exit codes 2/2/1/1/0 as coded at group-cli.ts:26,44,51,57
- [already-handled] Error message formatting (structured error vs [object Object])  
  All CLI error paths route through describeError (errors.ts:47-72), an exhaustive switch over GroupingError; never prints [object Object].  
  _Evidence:_ Reproduced: invalid-JSON run prints 'group: malformed index file ...: invalid JSON: SyntaxError: ...', exit=1
- [already-handled] Output directory does not exist  
  serializeIndex mkdirSync(dir, {recursive:true}) creates it (index-serializer.ts:82).  
  _Evidence:_ Reproduced: fresh out-j created with all five files, exit=0
- [already-handled] outDir exists as a file  
  mkdirSync throws, caught -> WRITE_FAILED{file: dir} (index-serializer.ts:81-85); covered by index-files.test.ts:274 'serializing into a path that is an existing file fails with WRITE_FAILED (R9.8)'.  
  _Evidence:_ index-serializer.ts:81-85; index-files.test.ts:274

#### `packages/core/src/orchestrator.ts`

- **[gap]** Valid JSON object with malformed ELEMENTS: null/non-object entries in nodes[] or edges[], nodes missing id  
  readGraphFile blind-casts `JSON.parse(text) as RawDependencyGraph` (orchestrator.ts:154) and ingest dereferences node.id / edge.source without shape validation (ingestor.ts:21-43 in dist; src ingestor.ts:26,37). A null entry anywhere crashes the whole pipeline with an uncaught TypeError - the CLI dies with a raw stack trace, violating the design's 'errors are returned as values, never thrown' rule (design.md:75) and the fail-fast structured-error table (design.md:566-583). Two id-less nodes produce the nonsense structured error DUPLICATE_NODE 'duplicate node identifier: undefined'. The real parser never emits su…  
  _Evidence:_ Reproduced: nodes:[null] -> TypeError 'Cannot read properties of null (reading id)' at ingestor.js:22, stack trace, exit=1; edges:[null] -> TypeError reading 'source'; two id-less nodes -> 'group: duplicate node identifier: undefined'
- **[gap]** resolveConfig: structuralQualityBoundary = NaN  
  No validation. `score >= NaN` is always false (constructor.ts:33), so EVERY region silently reconstructs regardless of score; decisionConfidence = |score - NaN| = NaN; metadata.json is written with "structuralQualityBoundary":null and "decisionConfidence":null (stableStringify -> JSON.stringify(NaN) = 'null'). Violates design.md:583 'no NaN/Infinity propagates into scores or metadata', breaks Req 5.4/5.5 recording, and makes Property 18 (recorded boundary reproduces decisions) impossible - null cannot be re-applied.  
  _Evidence:_ Reproduced (config-probe.mjs 2 + follow-up): decisions flip to reconstruct at scores 0.733/0.675, conf=NaN; written metadata.json contains "structuralQualityBoundary":null and "decisionConfidence":null; groupGraphToIndex returned ok:true
- **[gap]** resolveConfig: boundary < 0 or > 1  
  Accepted silently; decisionConfidence recorded outside [0,1] (e.g. 5.73). No spec clause bounds the boundary explicitly, but the glossary defines it on the [0,1] score scale. NOTE: demo-baselines.ts:47 deliberately uses boundary 1.000001 for the always-reconstruct baseline, so naive [0,1] validation would break the documented Evaluation Design (design.md:627-628 sanctions 'boundary above every score'). The spec hole (validate or document the extended domain) should be resolved deliberately; NaN at minimum must be rejected.  
  _Evidence:_ Reproduced (config-probe.mjs 3): boundary -5 -> all preserve, conf 5.73; boundary 7 -> all reconstruct, conf 6.27; both ok:true
- **[gap]** resolveConfig: negative weightCoefficients  
  Design specifies non-negative coefficients (design.md:96); none validated. importCoefficient=-1 silently clamps every strength to 0 (weights.ts:51-54), making every region cohesion=0/coupling=0 -> score exactly 0.5 -> everything PRESERVED with decisionConfidence 0. Silent whole-run decision flip from a sign typo.  
  _Evidence:_ Reproduced (config-probe.mjs 4): all regions preserve at score=0.500 conf=0
- **[gap]** resolveConfig: all-zero or negative assessment.weights  
  Design requires non-negative weights (design.md:127); combineScore's totalWeight<=0 guard returns score 0 (assessor.ts:161-163), so every region silently reconstructs. No INVALID_CONFIG. Property 9 (score in [0,1]) still holds, but the decisions are silently degenerate.  
  _Evidence:_ Reproduced (config-probe.mjs 5,6): weights {0,0} and {-1,1} -> all regions score 0.000, reconstruct
- **[gap]** resolveConfig: cohesionSquashConstant <= 0 or NaN  
  Design defines k_cohesion as the positive cohesion value mapping to 0.5 (design.md:124); not validated. k=0 -> cohesion_norm 1 for any positive cohesion (scores inflate to 0.9); k=-1 -> norm >1 pre-clamp (scores hit 1.0); k=NaN -> all scores 0 (clamp01(NaN)->0) and metadata records cohesionSquashConstant NaN -> null in JSON.  
  _Evidence:_ Reproduced (config-probe.mjs 7): scores 0.900/1.000/0.000 for k=0/-1/NaN; recordedK echoes the bad value
- **[gap]** resolveConfig: non-integer or NaN communityDetectionSeed  
  Not validated; seededRng coerces via `seed >>> 0` (community.ts:45), so NaN->0 and 1.5->1 silently. Output stays deterministic, but distinct nominal seeds alias to the same PRNG stream (NaN==0, 1.5==1), quietly corrupting any seed-sensitivity comparison. Low severity, fold with config validation.  
  _Evidence:_ Reproduced (config-probe.mjs 8): seed NaN and 1.5 both run ok with identical decisions; community.ts:45
- **[gap]** overrides Map entry for a region id that does not exist  
  constructor.ts:48 only .get()s overrides per existing region; unknown keys are silently ignored - no error, no warning, userOverridden stays false everywhere. A typo'd region id ('pkg:com.acme.coer') silently no-ops, defeating Req 4.6's intent. Spec does not cover unknown-key overrides (hole).  
  _Evidence:_ Reproduced (config-probe.mjs 9): override for 'pkg:no.such.region' -> ok, no decision marked userOverridden
- **[gap]** INVALID_CONFIG (hierarchy maxGroupSize/minPartitionThreshold) validated only AFTER assess+construct ran  
  validateHierarchyConfig runs inside buildHierarchy (hierarchy-builder.ts:67), the 5th stage; groupGraph runs ingest/weights/assess/construct first, so seeded Louvain executes before the config is rejected. Atomicity is preserved (nothing written), so this is a fail-fast/efficiency defect only. resolveConfig would be the right early gate. Low.  
  _Evidence:_ Reproduced (config-probe.mjs 10): spy detector called 2x before INVALID_CONFIG 'maxGroupSize must be an integer between 2 and 50 inclusive, got 1'
- **[gap]** groupGraphToIndex: write failure MID-SET leaves partial/mixed index output  
  serializeIndex writes the five files one-by-one with writeFileSync, no temp-dir/rename staging (index-serializer.ts:86-92). If write N fails, files 1..N-1 are already replaced and files N..5 keep their PREVIOUS content - the out dir holds a silently inconsistent mixed index. Violates design.md:568 ('produces no partial output, leaving any prior state unchanged') and the engine-wide NO-PARTIAL-OUTPUT rule the parser satisfies with an atomic write. Orchestrator-level guarantee broken; primary fix is serializer-side (coordinate with core-index-io cluster) but groupGraphToIndex owns the contract.  
  _Evidence:_ Reproduced (config-probe.mjs 12): pre-created read-only nodes.json -> result WRITE_FAILED{nodes.json}; out dir left with NEW repository.json + NEW hierarchy.json + OLD nodes.json, edges.json/metadata.json absent
- **[gap]** WRITE_FAILED error payload inconsistency  
  mkdir failure reports the full directory path, per-file failure reports the bare filename ('nodes.json') with no directory (index-serializer.ts:84 vs 90). Cosmetic; makes the CLI message ambiguous when several index dirs are in play.  
  _Evidence:_ Reproduced: probe 12 error {code:'WRITE_FAILED', file:'nodes.json'}; run I error carried the full dir path
- **[gap]** DEFAULT_GROUPING_CONFIG / DEFAULT_* objects exported mutable  
  Not frozen; a consumer mutating DEFAULT_GROUPING_CONFIG.structuralQualityBoundary (or DEFAULT_WEIGHT_COEFFICIENTS, DEFAULT_ASSESSMENT_CONFIG.weights) silently changes every subsequent resolveConfig result in-process. Hypothesis-level (needs a hostile consumer); Object.freeze would close it. Low.  
  _Evidence:_ reasoned-from-code orchestrator.ts:39-45,66-77 - resolveConfig re-reads the shared default objects on every call
- **[gap]** Test coverage of groupGraphToIndex/readGraphFile and the task-15 'error-gate' unit test  
  tasks.md task 15 (checked [x]) claims 'Unit tests: error-gate behavior (no partial index/, prior files untouched on failure)'. No such test exists: grep over all *.test.ts finds ZERO references to groupGraphToIndex or readGraphFile; orchestrator.test.ts covers only resolveConfig. The one WRITE_FAILED test (index-files.test.ts:274) covers the mkdir path only. The untested guarantee is in fact broken (partial-output gap above), which is exactly what the missing test would have caught.  
  _Evidence:_ Reproduced: `grep -rn 'groupGraphToIndex|readGraphFile' --include='*.test.ts' packages/core/src` -> no matches; tasks.md:126
- [already-handled] readGraphFile: file unreadable / path is a directory  
  readFileSync throw caught -> MALFORMED_FILE{detail:'file could not be read'} (orchestrator.ts:148-152). Message wording issue noted separately.  
  _Evidence:_ reasoned-from-code orchestrator.ts:148-152; dir-without-graph.json repro exercised this path
- [already-handled] readGraphFile: syntactically invalid JSON  
  JSON.parse throw caught -> MALFORMED_FILE with the SyntaxError detail (orchestrator.ts:153-158); CLI exits 1 with a structured message.  
  _Evidence:_ Reproduced (run A): exit=1, structured message including position info
- [already-handled] readGraphFile: valid JSON that is a scalar/array/null  
  Cast passes through; ingest's guard (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) rejects with NO_GRAPH (ingestor.ts:18-20).  
  _Evidence:_ reasoned-from-code ingestor.ts:18-20
- [already-handled] resolveConfig: explicitly-undefined options must not clobber defaults  
  definedEntries strips undefined values at every nesting level (orchestrator.ts:57-77); covered by both tests in orchestrator.test.ts ('resolveConfig never lets an explicitly-undefined option clobber a default', 'groupGraph output with explicitly-undefined options equals the default-config output').  
  _Evidence:_ orchestrator.ts:57-77; orchestrator.test.ts:30-59
- [already-handled] Hierarchy config bounds themselves (maxGroupSize 2..50, minPartitionThreshold 2..max)  
  validateHierarchyConfig enforces integer + range for both (hierarchy-builder.ts:42-60) per Req 6.6/6.8, returning structured INVALID_CONFIG; errors.ts documents it as a deliberate addition to the design's error table.  
  _Evidence:_ hierarchy-builder.ts:42-60; errors.ts:16-18; probe 10 error message exact
- [already-handled] Stage sequencing ingest -> weight -> assess -> construct -> assemble -> metadata (-> serialize)  
  groupGraph (orchestrator.ts:90-125) matches design Data flow stages 1-6 exactly; metadata is built from hierarchy+assessment+decisions as the design's metadata-accumulator arrows require.  
  _Evidence:_ orchestrator.ts:97-124 vs design.md:55-63
- [already-handled] Do non-Result stages throw? (louvain on degenerate/zero-weight subgraphs)  
  computeWeights/assess/construct/buildMetadata return plain values; the throw risks are Louvain and graphology. LouvainCommunityDetector guards size==0 and <2 nodes (community.ts:85-87); a reconstructed region whose only intra edges carry strength 0 (louvain total weight 0) was tested and does NOT throw. Assessor guards modularity on edgeless/zero-weight projections (assessor.ts:203-216). Remaining throw path is the unvalidated-shape crash recorded separately.  
  _Evidence:_ Reproduced (config-probe.mjs 11): zero-strength intra-edge region reconstructs ok; community.ts:85-87; assessor.ts:203-216
- [already-handled] groupGraphToIndex: no write when any pipeline stage fails  
  serializeIndex is only reached after groupGraph returns ok (orchestrator.ts:134-138), so ingest/config errors write nothing.  
  _Evidence:_ reasoned-from-code orchestrator.ts:134-138; CLI runs A-E produced no out dirs
- [already-handled] groupGraph(null/undefined) and empty graphs  
  Typed to accept null/undefined; ingest returns NO_GRAPH / EMPTY_GRAPH structurally (ingestor.ts:18-23) per Req 1.6/1.3; CLI renders both via describeError.  
  _Evidence:_ ingestor.ts:18-23; ingestor.test.ts covers per its header

#### `packages/core/src/index.ts`

- [already-handled] Public surface: entry scripts not exported; exports match implementation  
  group-cli.ts / demo-*.ts (top-level side effects, process.exit) are not exported from index.ts, so importing @repohive/core cannot trigger them. All orchestrator/config symbols re-exported coherently.  
  _Evidence:_ index.ts:1-45 read in full; no side-effectful module in the export list

#### `packages/core/src/demo-group-determinism.ts`

- **[gap]** runs argument = 0, negative, or non-numeric  
  runs = Number(argv[3] ?? '3') is never validated (demo-group-determinism.ts:26). runs=0/NaN/-3 -> loop never executes -> digests=[] -> [].every(...) is vacuously true -> prints 'sha-256 : undefined' and 'result : DETERMINISTIC (identical digest across all runs)' with exit 0. A Review-2 evidence script that can vacuously claim determinism without running the pipeline once.  
  _Evidence:_ Reproduced (runs K/L/M): all three print 'sha-256 : undefined' + DETERMINISTIC, exit=0
- [already-handled] Does the determinism demo hash all five index files?  
  Yes: one sha256 over name+stableStringify(payload) for every INDEX_FILE_NAMES entry (demo-group-determinism.ts:58-64). It hashes IN-MEMORY payloads rather than on-disk files, but serializeIndex writes exactly stableStringify(payloads[name]) (index-serializer.ts:88), so the bytes are identical by construction.  
  _Evidence:_ demo-group-determinism.ts:58-64; index-serializer.ts:86-92; reproduced run N: stable sha across 3 runs
- [already-handled] Fractional runs (e.g. 2.5)  
  Loop condition i < 2.5 executes 3 iterations; harmless, count printed as given. Edge of the same unvalidated-runs issue; folded there.  
  _Evidence:_ reasoned-from-code demo-group-determinism.ts:46
- [already-handled] Fresh re-parse per run so no in-memory state leaks  
  readGraphFile called inside the loop each run (demo-group-determinism.ts:48-51), commented as such.  
  _Evidence:_ demo-group-determinism.ts:46-53

#### `packages/core/src/demo-baselines.ts`

- **[gap]** always-reconstruct baseline depends on out-of-range boundary being accepted  
  boundary 1.000001 works only because resolveConfig performs no range validation. If boundary validation is added to fix the NaN gap, this demo must switch to the design's alternative ('an all-reconstruct override map', design.md:628) or the validation must document an extended domain. Flagged so the fix does not silently break the Review-2 evaluation aid.  
  _Evidence:_ demo-baselines.ts:47; config-probe.mjs 3 shows out-of-range acceptance is what makes it work
- [by-design] Baseline policies reachable via configuration only (no special code path)  
  Matches design Evaluation Design (design.md:625-631): always-preserve = boundary 0 (score>=0 always, incl. degenerate score 0.0 -> preserve on >=), always-reconstruct = boundary 1.000001 (> any clamped score), adaptive = defaults. All three run the identical pipeline.  
  _Evidence:_ demo-baselines.ts:45-49; reproduced run over fixtures/sample-java-project: 4/0, 0/4, adaptive decisions printed
- [already-handled] Path handling, default fixture, error exits  
  Same INIT_CWD resolution and statSync dir handling as group-cli; missing path -> exit 2; readGraphFile/groupGraph errors -> describeError + exit 1 (demo-baselines.ts:25-40,66-70).  
  _Evidence:_ demo-baselines.ts:25-40; happy-path run reproduced

#### `packages/core/src/orchestrator.test.ts`

- [already-handled] Coverage: resolveConfig undefined-stripping and NaN-free default path  
  Both tests present and meaningful; they assert Number.isFinite on every decision score for the explicit-undefined path. They do NOT cover NaN/invalid VALUES (only undefined), which is the config-validation gap.  
  _Evidence:_ orchestrator.test.ts:30-59

#### `packages/core/src/end-to-end.test.ts`

- [already-handled] Coverage: safety-valve fixture, serialize->parse round trip, blast radius, checked-in parser fixture  
  Exercises groupGraph + serializeIndex + parseIndex + analyzeBlastRadius over a preserve/reconstruct/degenerate mix (Req 4/5/6/9.5/10). Fixture test degrades to skip when fixture absent (findSampleFixture returns null) - acceptable for a checkout-dependent test, though a silent skip can mask a moved fixture.  
  _Evidence:_ end-to-end.test.ts:95-223

#### `packages/core/src/pipeline-determinism.test.ts`

- [already-handled] Coverage: Property 24 (full-build determinism) and Property 25 (order-independence), 100 runs each  
  Both properties asserted over serialized five-file bodies via the same indexFilePayloads+stableStringify projection the serializer uses; matches tasks.md task 12 and design Properties 24/25.  
  _Evidence:_ pipeline-determinism.test.ts:20-67

### packages/parser — serialization & orchestration *(lead-pass review)*

> Scope: `serializer.ts`, `canonical.ts`, `orchestrator.ts`, `parse-cli.ts`, `errors.ts`, `index.ts` ·
> parser spec R7, R8, R9, R10  
> **29 cases examined** — 3 gap · 2 by-design · 24 already-handled
>
> This section is a single-reviewer pass (see Limitations): its generated register was lost.

#### `packages/parser/src/serializer.ts`

- **[gap]** Node-id uniqueness is never asserted before emitting `graph.json`
  `buildGraph` constructs a `Set` of node ids solely to sweep dangling edges (`serializer.ts:168-186`); the nodes themselves are emitted unchecked, so any upstream collision reaches disk and the CLI reports success. R7.1 requires an `id` "unique across the emitted node set" and R3.12 forbids two distinct nodes sharing an id — neither is enforced anywhere in the parser. Promoted as **Gap 5** (with the `$`-separator trigger) and it is also the emission mechanism behind known Gap 2.
  _Evidence:_ REPRODUCED — a two-file fixture emits `class:com.example.Outer$Inner` twice and prints `result : OK`; `group` then aborts with `duplicate node identifier`.
- **[gap]** Fixed temp-file name `${outputPath}.tmp` makes concurrent runs race
  Two `parse` runs targeting one output path write the same temp file and then both `rename` it; the loser's document can be clobbered mid-write or the rename can fail spuriously. Low severity (single-user batch tool, and the failure is loud rather than silent), but a content- or process-scoped suffix removes it.
  _Evidence:_ `serializer.ts:249`. Reasoned from code; not reproduced (requires a deliberate concurrent invocation).
- **[gap]** `parse-cli` invokes `void main()` with no `.catch`
  Any rejection escaping `parseProject` becomes an unhandled rejection and a raw stack trace rather than the CLI's structured error block. This is the outermost half of **Gap 3**, and it is what makes the `ids.ts` throw visible as a crash.
  _Evidence:_ `parse-cli.ts:80`. REPRODUCED via the backslash-filename fixture.
- [already-handled] Atomic write: serialize fully in memory, temp file in the *same* directory, then `rename`
  Guarantees no partial or empty `graph.json`, and a prior valid file is left byte-for-byte intact because the rename never happens on failure (R8.4, R8.5, R10.6).
  _Evidence:_ `serializer.ts:232-281`; serializer tests cover write-failure and rename-failure branches via injected deps.
- [already-handled] Temp-file cleanup on both failure paths — best-effort `unlink` after a failed write and after a failed rename, so no `.tmp` litter is left behind.
  _Evidence:_ `serializer.ts:257`, `:273` (`.catch(() => {})` so cleanup cannot mask the real error).
- [already-handled] Serialization failure precedes any filesystem write, so a stringifier error writes nothing.
  _Evidence:_ `serializer.ts:235-245`.
- [already-handled] Final endpoint sweep drops any edge whose `source`/`target` is not an emitted node id and records a diagnostic (R7.6).
  _Evidence:_ `serializer.ts:171-184`.
- [already-handled] Frequency normalization to a non-negative integer in `[0, 2147483647]` (R7.4): non-finite → 0, negative → 0, fractional → truncated, over-range → clamped.
  _Evidence:_ `normalizeFrequency`, `serializer.ts:100-112`.
- [already-handled] `strength` is projected away on every edge, so it can never be emitted (R7.7).
  _Evidence:_ `normalizeEdge`, `serializer.ts:144-152`.
- [already-handled] Field-omission semantics: `packagePath` omitted when absent **or empty**; `definedInFile` omitted on `file` nodes and preserved on class/function (R7.2, R7.3).
  _Evidence:_ `normalizeNode`, `serializer.ts:124-137`.
- [already-handled] Output-path failure modes surface as `output-unwritable` with a cause description (missing directory, permissions, ENOSPC), and the path is named (R8.4, R10.5).
  _Evidence:_ `describeFailure`, `serializer.ts:203-218`.
- [already-handled] Output path pointing at a directory → `rename` fails → structured error, no partial output.
  _Evidence:_ `serializer.ts:270-281`; same branch as any rename failure.

#### `packages/parser/src/canonical.ts`

- [already-handled] Byte-wise UTF-8 ordering for nodes (by `id`) and edges (by `(source, target)`), per R9.2/R9.3, via `Buffer.compare` rather than JavaScript's UTF-16 `<`.
  _Evidence:_ `compareUtf8` `:38-40`, `compareNodes` `:46-48`, `compareEdges` `:56-59`. (The *core* package uses a different order — that divergence is **Gap 17**, filed under cross-cutting.)
- [already-handled] Fixed canonical key order per object (`id, kind, packagePath?, directoryPath, definedInFile?` / `source, target, importFrequency, methodCallFrequency, sharedTypeCount`), hand-rolled rather than relying on `JSON.stringify` key order (R9.6).
  _Evidence:_ `stringifyNode` `:96-112`, `stringifyEdge` `:127-140`.
- [already-handled] String escaping of ids delegates to `JSON.stringify`, so quotes, backslashes, and control characters in filename-derived ids are escaped and the document stays valid JSON; non-ASCII is emitted as raw UTF-8, which is deterministic.
  _Evidence:_ `quote` `:79-81`.
- [already-handled] Frequency number tokens are plain decimal with no exponent, because `normalizeFrequency` has already guaranteed an integer ≤ 2³¹−1 before `String(value)` runs.
  _Evidence:_ `num` `:115-120` together with `serializer.ts:100-112`.
- [already-handled] UTF-8 without BOM, `\n` line endings, trailing newline (R9.6).
  _Evidence:_ `stringifyGraph` `:160-181`; write uses `"utf8"` (`serializer.ts:66`).
- [already-handled] Zero-node / zero-edge boundary emits `[]` and a well-formed single JSON value (R8.2, R8.3, R9.7).
  _Evidence:_ `stringifyArray` `:143-148`; serializer boundary tests.
- [by-design] The zero-node case is unreachable through the CLI, because a readable project with no `.java` files is a fatal `no-java-files` error (R2.5). The boundary is therefore exercised at the serializer's own API level only.
  _Evidence:_ `source-collector.ts:188-196`.

#### `packages/parser/src/orchestrator.ts`, `errors.ts`, `index.ts`, `parse-cli.ts`

- [already-handled] Error gate: any recorded recoverable error returns all errors and never invokes the serializer, so no partial/empty output and any prior `graph.json` survives untouched (R10.4, R10.6).
  _Evidence:_ `orchestrator.ts:186-188`; orchestrator tests assert the no-write behaviour with injected deps.
- [already-handled] Writing is deferred until every file has been parsed (R10.3) — the serializer is reached only after the extract loop completes.
  _Evidence:_ `orchestrator.ts:158-192`.
- [already-handled] Fatal input errors return exactly one error and do no further work (R1.7, R2.4, R2.5).
  _Evidence:_ `orchestrator.ts:143-155`; `input-validator.ts` returns single-element `err([...])` on every branch.
- [already-handled] Files are handed to extraction in canonical order, so extraction order does not depend on filesystem enumeration (R9.5).
  _Evidence:_ `orchestrator.ts:166` iterating the collector's sorted result.
- [already-handled] Recoverable per-file errors (`file-unreadable`, `file-unparseable`) accumulate and parsing continues (R10.1, R10.2).
  _Evidence:_ `ast-extractor.ts:420-465`, `orchestrator.ts:167-174`.
- [already-handled] Default output path is `<validated project>/graph.json`, derived from the validated absolute path so it does not depend on the process working directory.
  _Evidence:_ `resolveOutputPath`, `orchestrator.ts:115-123`.
- [already-handled] A `graph.json` written inside the parsed project is not `.java`, so a subsequent run ignores it rather than re-ingesting its own output.
  _Evidence:_ `source-collector.ts:166`.
- [already-handled] Relative CLI arguments resolve against `INIT_CWD`, so `npm run parse -- <relpath>` behaves like a plain command despite npm's workspace `cwd` change.
  _Evidence:_ `parse-cli.ts:37-46`.
- [already-handled] Exit codes: `0` on success, `1` on failure, with each error rendered as `reason: message (path)` (R10.5).
  _Evidence:_ `parse-cli.ts:50-77`.
- [by-design] With no argument the CLI targets `fixtures/sample-java-project`, a documented demo convenience of a wrapper explicitly marked temporary.
  _Evidence:_ `parse-cli.ts:12-30`.

### Cross-cutting *(lead-pass review)*

> Scope: `packages/shared/src/contract.ts`, and both packages' determinism/serialization/overflow
> behaviour  
> **19 cases examined** — 6 gap · 4 by-design · 9 already-handled
>
> This section is a single-reviewer pass (see Limitations): its generated register was lost.

#### `packages/shared/src/contract.ts`

- **[gap]** The contract's own stated invariants are enforced at neither seam
  `GraphNode.id` is documented "Unique, non-empty"; the signals are documented "Non-negative integer"; `directoryPath` is required. None is checked when `graph.json` is read (`readGraphFile` blind-casts `JSON.parse` output) nor when it is written (no serializer-side node-id uniqueness check). Promoted as **Gap 13** (read side) and **Gap 5** (write side).
  _Evidence:_ REPRODUCED — ingest accepts an empty-string id, a `2.5` fractional signal, and a `"5"` string signal (which becomes strength 5).
- **[gap]** `NodeKind` spans both the producer's and the consumer's vocabulary
  One union carries `file|class|function` (what the parser emits) and `group|repository` (what grouping produces), so a `group`-kind node is *type-valid* input, passes ingest, and is then silently dropped from the hierarchy while `edges.json` keeps referencing it. Promoted as **Gap 14**.
  _Evidence:_ REPRODUCED — `grp:X` absent from `nodes.json`/`hierarchy.json` but present in `edges.json`.
- [already-handled] Field-omission semantics (omit rather than empty-string/null) are documented in the contract and implemented consistently on the write side by `normalizeNode`.
  _Evidence:_ `contract.ts:30-37`, `serializer.ts:124-137`.
- [by-design] `strength` is optional in the contract and never emitted by the parser, left for the downstream weight calculator — an intentional seam, honoured by `normalizeEdge`.
  _Evidence:_ `contract.ts:74-75`, `serializer.ts:144-152`.

#### Determinism and serialization across packages

- **[gap]** Two different "canonical orders": parser UTF-8 byte order vs core UTF-16 code-unit order. Promoted as **Gap 17**.
  _Evidence:_ REPRODUCED — `compareUtf8(U+FF61, U+10000) = -1` but `compareIds(U+FF61, U+10000) = +1`.
- **[gap]** `stableStringify` renders non-finite numbers as `null`, letting a NaN score/confidence be written as valid-looking JSON that `parseIndex` then rejects. Promoted as **Gap 9**.
  _Evidence:_ REPRODUCED — `stableStringify({v:NaN})` → `{"v":null}`; `stableStringify({v:Infinity})` → `{"v":null}`.
- **[gap]** Non-finite and wrongly-typed values reach `stableStringify` at all, because no stage between config resolution and serialization asserts finiteness. Folded into **Gap 9**.
  _Evidence:_ `canonical.ts:84-86`; `metadata.ts` performs no finiteness checks.
- [already-handled] No ambient nondeterminism: no `Math.random`, `Date.now`, `new Date`, `hrtime`, `os.hostname`, `process.pid`, or `performance.now` anywhere in either package (including tests and demo scripts).
  _Evidence:_ REPRODUCED — the grep returns no matches.
- [already-handled] No locale-dependent comparison or case mapping anywhere (`toLocale*`, `localeCompare`, `Intl.*`, `toLowerCase`, `toUpperCase` all absent), so ordering cannot vary by host locale.
  _Evidence:_ REPRODUCED — the grep returns no matches.
- [already-handled] Community detection is seeded with an explicit deterministic PRNG (mulberry32) fed to Louvain, over canonically sorted nodes and edges, with communities re-labelled by a content-derived key (ascending minimum member id) so labels never depend on the detector's internal numbering.
  _Evidence:_ `community.ts:44-53`, `:57-95`, `relabelByContent` `:103-126`.
- [already-handled] Content-addressed group ids hash a **JSON-encoded** sorted membership list, so no separator character inside a member id can create a collision (`["a b"]` vs `["a","b"]`).
  _Evidence:_ `group-id.ts:23-29`.
- [already-handled] Full-content edge comparator gives parallel edges a canonical order independent of input position — correct for well-typed input; defeated only by non-numeric signals (**Gap 13**).
  _Evidence:_ `canonical.ts:32-55`.
- [already-handled] Frequency overflow is bounded at the write seam: the serializer clamps every signal into `[0, 2147483647]` before emission (R7.4), so no exponent-notation or out-of-range token can appear in `graph.json`.
  _Evidence:_ `serializer.ts:100-112`.
- [by-design] Key-ordering strategies differ between packages — the parser emits a fixed key order, the core sorts keys at every depth. Both are deterministic; the difference is stylistic and affects no consumer.
  _Evidence:_ `parser/canonical.ts:96-140` vs `core/canonical.ts:93-98`.
- [by-design] `-0` serializes as `0` (`JSON.stringify(-0) === "0"`). `-0` can enter via a hand-authored `graph.json`, so `Object.is`-level round-trip fidelity is lost, but the emitted bytes are deterministic and nothing downstream branches on the sign of zero.
  _Evidence:_ REPRODUCED — `stableStringify({v:-0})` → `{"v":0}`.
- [by-design] Large finite numbers serialize in exponent notation (`1e+21`). This is valid JSON and fully deterministic; only reachable with hand-authored extreme signals.
  _Evidence:_ REPRODUCED — `stableStringify({v:1e21})` → `{"v":1e+21}`.
- [already-handled] Strength summation cannot silently produce `NaN`/`Infinity` in scores: `weights.ts` clamps non-finite or negative results to 0 and the assessor's `clamp01` maps non-finite to 0. (The *cost* of that clamp — the strongest edge becoming the weakest — is noted in the ingest register and folded into Gap 9's configuration-validation discussion.)
  _Evidence:_ `weights.ts:48-54`, `assessor.ts:224-229`.
- **[gap]** Unicode normalization is never applied to identifiers or filenames, so two files whose names differ only by NFC/NFD produce two distinct nodes with visually identical ids — a display ambiguity for the future viewer and a cross-platform identity question. Recorded as **Gap 17, open question 3** rather than a separate gap.
  _Evidence:_ No `normalize(` call exists in either package (grep). HYPOTHESIS for the cross-platform half — confirming it needs a macOS host, which was unavailable.
- [already-handled] Prototype-pollution surface via `JSON.parse` is limited: both packages read parsed objects into `Map`s keyed by string and never `Object.assign` untrusted keys onto a shared prototype. A node id of `__proto__` is stored safely in a `Map`, though it does defeat Louvain's plain-object result collection (noted in the community register as Low).
  _Evidence:_ `ingestor.ts:25-31`, `index-parser.ts:43-66`.

---

## Appendix A — Register `[gap]` entries → numbered gaps

The 145 `[gap]` register entries consolidate into 20 numbered gaps. Multiple entries mapping to one
gap are symptoms or variants of a single root cause.

| Gap | Title (abbreviated) | Severity | Consolidates register entries from |
|---|---|---|---|
| 3 | Uncaught throws escape the Result model | High | `ids.ts` (backslash, drive-letter), `ingestor.ts` (null elements), `index-parser.ts` (null array elements), `community.ts` (graphology precondition throws), `parse-cli.ts` (`void main()`) |
| 4 | Scope-blind node identity (anonymous / enum-constant / local classes) | High | `ast-extractor.ts` (anonymous classes, enum-constant bodies, local classes, named type in anonymous body), `ids.ts` (enclosing-chain entries) |
| 5 | `$` identifier vs nested-type separator → duplicate ids | High | `ids.ts` (`$` ambiguity), `ast-extractor.ts` (silent intra-file drop), `serializer.ts` (missing uniqueness backstop) |
| 6 | Function ids embed parameter names and comments | High | `ast-extractor.ts` (varargs, comments in parameter list, record compact constructor), `ids.ts` (varargs, compact constructor) |
| 7 | Qualified names taken as raw source text | Medium | `ast-extractor.ts` (package/import whitespace and comments), `ids.ts` (polluted package in ids) |
| 8 | In-project references dropped (nested / wildcard / static imports) | High | `stitcher.ts` (nested-type, wildcard, static-member, whitespace import; file→class granularity), `symbol-table.ts` (cross-kind shadow) |
| 9 | Unvalidated configuration; NaN boundary → `null` metadata | High | `orchestrator.ts` (boundary NaN/range, coefficients, weights, `k`, seed, late hierarchy validation), `constructor.ts` (NaN boundary), `assessor.ts` (weights, `k`, `degenerateScore`, no `INVALID_CONFIG` path), `index-serializer.ts` (non-finite → `null`) |
| 10 | Non-atomic five-file index write → mixed old/new set | High | `index-serializer.ts` (partial write, mixed set, `WRITE_FAILED` payload), `orchestrator.ts` (`groupGraphToIndex` partial output), `index-parser.ts` (counts not cross-checked) |
| 11 | Containment cycle accepted → blast radius never terminates | High | `index-parser.ts` (cycle, multiple roots, parent-side membership, `kind` unvalidated, duplicate `childIds`, ghost `repositoryId`, missing `directoryPath`, unconstrained ranges), `blast-radius.ts` (no cycle guard on ancestor climb) |
| 12 | Groups carry no label or Region provenance (viewer blocker) | High (Phase 3) | `index-serializer.ts` (group entries lack attributes), `hierarchy-builder.ts` (region→group association discarded), `metadata.ts` (no group mapping); file-level fan-out unbounded |
| 13 | No field-type validation at ingest; string signals break order-independence | High | `ingestor.ts` (signal types, node shapes, missing id, numeric id, empty id, missing `directoryPath`, `file` node with `definedInFile`), `canonical.ts` (NaN tie-break), `orchestrator.ts` (blind cast), `regions.ts` (`dir:undefined`) |
| 14 | `group`/`repository` input nodes silently dropped | Medium | `hierarchy-builder.ts` (silent drop, zero-file graph, cross-group edge skip), `regions.ts` (edges invisible to metrics), `ingestor.ts` (kind accepted) |
| 15 | Parallel duplicate edges double-counted | Medium | `ingestor.ts` (no dedup), `assessor.ts` (double-counted cohesion vs modularity projection folding) |
| 16 | Zero-strength region reconstruct → singleton explosion | Medium | `community.ts` (M = 0 NaN deltas), `assessor.ts` (count-based degenerate rule) |
| 17 | UTF-8 vs UTF-16 canonical order divergence | Medium | `hierarchy-builder.ts`/`canonical.ts` (comparator divergence), cross-cutting (normalization open question) |
| 18 | Determinism demos can report success vacuously | Medium | `demo-group-determinism.ts` (`runs` unvalidated), `demo-baselines.ts` (depends on unvalidated boundary range) |
| 19 | No collector exclusion policy (`.git`, `target`, `build`) | Medium | `source-collector.ts` (build/VCS traversal) |
| 20 | CLI cannot vary any algorithm parameter | Medium | `group-cli.ts` (no flags, extra args ignored, misleading "malformed index file", non-`.json` output path) |
| 21 | `minPartitionThreshold` is a dead knob | Low | `hierarchy-builder.ts` |
| 22 | `metadata.json` omits hierarchy-shape parameters | Low | `metadata.ts` (seed, `maxGroupSize`, coefficients unrecorded; `metricWeights` when Q not computable) |

Register entries **not** promoted are Low-severity, API-misuse-only, performance, or test-coverage
observations — e.g. `Array.prototype.shift()` BFS being O(n²), mutable exported `DEFAULT_*` config
objects, `WRITE_FAILED` payload inconsistency, and the several named test-coverage holes. They remain
here as leads.

## Appendix B — Hypotheses investigated and refuted

Recorded so the same ground is not re-covered. Each was suspected, tested, and found **not** to be a
defect:

| Hypothesis | Outcome |
|---|---|
| A UTF-8 BOM at the start of a `.java` file breaks parsing or mangles the package name | **Refuted (reproduced).** `tree-sitter-java` tolerates the BOM; `class:com.example.Bom` extracted correctly alongside a normal file. |
| `module-info.java` fails to parse, so any modular Java repository aborts entirely | **Refuted (reproduced).** Parses cleanly, yielding a `file` node (`file:module-info.java`) and no spurious errors. |
| CRLF line endings change extraction or ids | **Refuted.** Covered as already-handled in the AST register; offsets are not part of any id. |
| `package-info.java` (annotations, no type declaration) causes an error | **Refuted.** Emits a `file` node only; annotated package declarations handled. |
| Deriving `directoryPath` at the project root produces `"."` rather than `""` | **Refuted.** `directoryPathOf` maps `"."` → `""` (R3.6), verified by the root-file fixture. |
| Self-loop edges in a hand-authored graph corrupt cohesion, community detection, or blast radius | **Refuted.** Excluded from region metrics (`sourceFile === targetFile`), skipped by the detector, and the BFS `visited` set handles them. |
| `averageBranchingFactor` divides by zero for a single-file repository | **Refuted.** Guarded (`groupNodeTotal > 0 ? … : 0`, `metadata.ts:65`). |
| Louvain's modularity projection divides by zero on a zero-weight graph, leaking `NaN` into scores | **Refuted.** Explicitly treated as "not computed", so the modularity weight is dropped and renormalized (`assessor.ts:203-221`). |
| Overloaded functions collide because the symbol table keys ignore parameter types | **Refuted (by design).** Intentional per R4.4/R4.5 with canonical-first resolution; nothing consumes function keys in Phase 1. |
| The `index/` directory retains stale files after a *successful* re-run | **Refuted.** All five canonical files are rewritten every run; only a *failed* run leaves a mixed set (Gap 10). |
| A `graph.json` written inside the parsed project is re-ingested on the next run | **Refuted.** Not a `.java` file, so the collector ignores it. |

## Appendix C — Reproduction fixtures

Every reproduction in this register and in `docs/gaps.md` was run against the built artifacts
(`packages/*/dist`) from the repository root, with all generated inputs and outputs written to a
scratch directory outside the repository. The fixture families were:

| Family | Exercises |
|---|---|
| nested-type / plain import (2 packages, 3 files) | Gap 8 — nested-type import resolves to nothing while a plain import works |
| wildcard + static import | Gap 8 — both produce zero edges |
| anonymous class, with and without a same-named real method | Gap 4 — phantom node and silent merge |
| two same-named local classes in sibling methods | Gap 4 — two declared types collapse to one node |
| top-level `Outer$Inner` + nested `Outer.Inner` | Gap 5 — duplicate ids emitted, `group` aborts |
| varargs / comments in parameter list / record compact constructor / enum-constant bodies | Gap 6, Gap 4 — malformed and colliding function ids |
| `package com . example;` | Gap 7 — corrupted `packagePath` and node ids |
| filename containing a literal backslash | Gap 3 — uncaught `Error`, process crash |
| `module-info.java`, BOM'd source | Appendix B refutations |
| in-memory graphs via the `@repohive/core` API | Gaps 9, 13, 14, 15, 16 — NaN boundary, field coercion, silent drops, order-dependence, singleton explosion |
| hand-built `index/` with a mutual parent cycle | Gap 11 — `parseIndex` accepts, `analyzeBlastRadius` hangs (killed at 8 s) |
| real fixture index (`fixtures/sample-java-project`) | Gap 10 — mixed old/new file set accepted; Gap 12 — group nodes carry no label |
