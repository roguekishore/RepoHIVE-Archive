# Verification Gates

A change is not done until these pass. Run them; do not assume them.

## Gate 1 — build

```
npm run build
```

Must be clean. No new type errors, no suppressed diagnostics.

## Gate 2 — tests

```
npm test
```

**Root `npm test` currently exits 1.** It is not a usable pass/fail gate as-is. Verified 2026-08-22 on
Node v20.19.0 / npm 10.8.2 — measured per workspace:

| Workspace | Result |
|-----------|--------|
| `@repohive/core` | **153 / 153 pass** — but the npm script does not run (see below) |
| `@repohive/parser` | **180 / 181** — one platform-dependent failure (see below); script does not run |
| `@repohive/api-client` | 50 / 50 pass |
| `@repohive/web` | 20 / 20 pass |
| `@repohive/types` | 2 suites fail — pre-existing, vendored |
| `@repohive/ui` | 1041 / 1042 — one flaky failure, identity varies per run |

### The engine test script does not run on Node 20

`node --test dist/*.test.js` relies on Node expanding the glob, which requires **Node 21+**. `cmd.exe`
does not expand it either, so on Node 20 it fails with `Could not find …dist\*.test.js`.

This is the mirror image of an earlier trap: `node --test dist/` *works* on Node 20 but silently resolves
to `dist/index.js` on Node 21+ and reports one passing test. Neither form is correct on both. Until the
script is fixed, verify the engine by listing files explicitly:

```powershell
$files = Get-ChildItem dist -Filter *.test.js | ForEach-Object { "dist/$($_.Name)" }
node --test @files
```

Run that from `packages/core` and `packages/parser`. Expect 153 and 181.

### Known failures — confirm these are the only ones

1. **`parser` → `source-collector.test.ts` → "a path that cannot become a node id is reported and the walk
   continues".** The test asserts POSIX semantics where `\` is a legal filename character. Fails on
   Windows. Platform-dependent, not a regression.
2. **`types` → `__tests__/node-ids.test.ts`** imports `../../../tests/fixtures/node_ids.json`, which does
   not exist in this repo — vendored test infrastructure whose fixture was never vendored with it.
3. **`ui` → render-budget tests** (`dsm-matrix.test.tsx`, `token-drift.test.ts`) fail intermittently and
   not always the same one. Timing-sensitive; vendored.

A change is clean if it does not add to this list. A new failure outside it is yours.

## Gate 3 — determinism

```
npm run demo:group-determinism
```

Output digests must be byte-identical across repeated runs and across shuffled-input runs.

Recorded digests for `fixtures/sample-java-project`:

| Artifact | SHA-256 | Last confirmed |
|----------|---------|----------------|
| `group` | `f30c7b3dfe38c476ada89a1175036cd36e1e623a08efc79345fd79beb3b4b5b3` | 2026-08-22 — 3 runs, identical (4 regions, 38 nodes, depth 4) |
| `parse` | `a603b667abf1d7c903280a5ea661cae7087ecc90b9bafcfa9fbae25e7a6cccbc` | recorded 2026-08-16 |

If a digest moves, it is either a determinism regression or a legitimate output change. **Do not
recapture it silently.** Identify which field changed and why, record the reason in `DECISIONS.md`, then
update the table above in the same change.

## Gate 4 — real-repo smoke

For changes to the parser, the grouping algorithm, or the contract, re-run against a real fixture and
compare against the recorded numbers in `PROJECT_STATE.md`. A large unexplained swing in node, edge, or
region counts is a regression signal even when tests pass.

## Gate 5 — spec properties

The grouping algorithm's correctness properties are numbered in
`.kiro/specs/hierarchical-repository-grouping/`. Property tests cover them via `fast-check`. If a change
touches algorithm behaviour, identify which numbered properties are affected and confirm their tests
still hold — or amend the spec first if the property itself is wrong.

## Cleanup

Delete any temporary files, scratch fixtures, or debug output created while verifying.

## Reporting

State which gates were run and their results. If a gate could not be run, say which one and why, rather
than reporting overall success.
