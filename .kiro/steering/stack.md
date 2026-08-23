# Stack & Commands

Pinned facts. If something here disagrees with a `package.json`, the `package.json` wins — fix this file.

## Runtime and language

- **TypeScript 5.9.3**, **Node.js** (dev on Node 20/21+), ESM (`"type": "module"`).
- **npm workspaces** monorepo, workspace root `packages/*`.
- Licence: **AGPL-3.0-or-later** (the vendored repowise UI packages are AGPL). Upstream attribution in
  `NOTICE`. Any new dependency must be licence-compatible.

## Engine dependencies

| Package | Version | Role |
|---------|---------|------|
| `web-tree-sitter` | `0.26.10` | Tree-Sitter runtime — **the WASM build, not the native binding** |
| `tree-sitter-java` | `0.23.5` | compiled Java grammar (ships a prebuilt `.wasm`) |
| `graphology` | `0.26.0` | in-memory directed weighted graph |
| `graphology-communities-louvain` | `2.0.2` | community detection behind the `CommunityDetector` interface |
| `graphology-metrics` | `2.4.0` | cohesion / coupling metrics |
| `fast-check` | `4.8.0` | property-based tests (dev) |

Leiden can replace Louvain by adding an implementation behind `CommunityDetector`; callers do not change.

**Do not install the native `tree-sitter` package.** The parser uses `web-tree-sitter` deliberately, to
avoid native-compilation friction across platforms and CI. Both WASM artifacts are resolved from
`node_modules` at runtime by `parser/src/ast-extractor.ts` `resolveGrammarPaths`, which means **any
bundled deployment must pass `GrammarOptions`** (`coreWasmPath` / `javaWasmPath`) — bundlers drop `.wasm`
files and rewrite the module resolution this relies on.

## Viewer dependencies

`next ~15.5.21`, `react ^19`, `react-dom ^19`, Tailwind 4 (`@tailwindcss/postcss`), `swr`, `nuqs`,
`framer-motion`, `recharts`, `shiki`, `cmdk`, `lucide-react`, `sonner`, `next-themes`, `geist`.
Tests: **Vitest**.

**Not used, do not reintroduce *for the viewer app*:** React Flow (replaced by the vendored canvas, which
already lays out deterministically), MySQL (removed; wrong fit for graph data). **Next.js is required for
`packages/web`** — the vendored packages depend on it, so it may not be swapped there.

**Vite is approved for the CLI's single-file viewer artifact** (owner, 2026-08-23), with
`vite-plugin-singlefile` (2.3.3, MIT, supports Vite 5–8) inlining all JS and CSS into one `.html`. This is an
*addition* alongside Next.js, not a replacement for it: `packages/web` stays on Next.js. An earlier blanket
"do not reintroduce Vite" line here was aimed at protecting the viewer app and wrongly forbade this.

## How to read this file

Owner ruling, 2026-08-23: **the lists here are not hard boundaries. New tools and dependencies may be added
when the work genuinely demands it.** What the "not used" list means is "do not swap out a working choice for
this without a decision" — not "never introduce anything new." Record any addition in `DECISIONS.md` and
update this file in the same change. Licence compatibility with AGPL-3.0-or-later remains a hard rule.

## Commands

Run from the repo root.

| Command | Effect |
|---------|--------|
| `npm run build` | `tsc -b packages/parser packages/core` |
| `npm run typecheck` | same targets, no emit |
| `npm test` | `npm run test --workspaces --if-present` |
| `npm run parse -- <dir>` | parse a Java tree → `graph.json` |
| `npm run group -- <args>` | group `graph.json` → `index/` |
| `npm run demo:group-determinism` | repeated-run SHA-256 comparison |
| `npm run demo:baselines` | baseline comparison output |
| `npm run dev --workspace @repohive/web` | viewer on port 3000 (long-running; the user starts this, not the agent) |

**The engine test script in `package.json` is `node --test dist/*.test.js`, and it does not work on both
Node versions.** Neither form does:

- `node --test dist/*.test.js` relies on the shell expanding the glob, which needs **Node 21+**. `cmd.exe`
  does not expand it either, so on Node 20 it fails with `Could not find …dist\*.test.js`.
- `node --test dist/` runs on Node 20 but on Node 21+ silently resolves to `dist/index.js` and reports one
  passing test — a green run that proves nothing.

Until the script is fixed, verify the engine by listing the files explicitly. From `packages/core` and
`packages/parser`:

```powershell
$files = Get-ChildItem dist -Filter *.test.js | ForEach-Object { "dist/$($_.Name)" }
node --test @files
```

`steering/verification.md` carries the expected counts and the known-failure list. **No "green suite"
claim from `npm test` is trustworthy while this stands.**

`npm run parse` resolves relative paths against `INIT_CWD`. It is a convenience wrapper around the
parser's CLI entry point, not the packaged CLI.

## Storage

JSON files on disk. No database. `graph.json` is ~10–20 MB at 4k files (ids and small integers only, no
source text).

**The storage seam is asymmetric, not complete.** The *write* path has one: `IndexSerializerDeps`
(`core/src/index-serializer.ts:108`) injects `mkdirSync` / `writeFileSync` / `renameSync` / `rmSync` /
`existsSync` / `assertWritable` with an fs default, added so write failures were testable. The *read*
path has none — `core/src/index-parser.ts:10` and `core/src/orchestrator.ts:7` import from `node:fs`
directly. So swapping in a graph-native or object store means **mirroring an existing in-repo pattern onto
the read path**, not inventing an abstraction.

Likewise the parser reaches the filesystem in three injectable-but-unwired places (validator, collector,
`ast-extractor`'s `readFile`) and `ParseOptions.projectDirectory` is a required string. Parsing from a
non-directory source is therefore a real seam change. Detail in `.kiro/workstreams.md`.
