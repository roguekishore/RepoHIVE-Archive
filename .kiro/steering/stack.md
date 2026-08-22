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
| `tree-sitter` + `tree-sitter-java` | — | per-file Java ASTs |
| `graphology` | `0.26.0` | in-memory directed weighted graph |
| `graphology-communities-louvain` | `2.0.2` | community detection behind the `CommunityDetector` interface |
| `graphology-metrics` | `2.4.0` | cohesion / coupling metrics |
| `fast-check` | `4.8.0` | property-based tests (dev) |

Leiden can replace Louvain by adding an implementation behind `CommunityDetector`; callers do not change.

## Viewer dependencies

`next ~15.5.21`, `react ^19`, `react-dom ^19`, Tailwind 4 (`@tailwindcss/postcss`), `swr`, `nuqs`,
`framer-motion`, `recharts`, `shiki`, `cmdk`, `lucide-react`, `sonner`, `next-themes`, `geist`.
Tests: **Vitest**.

**Not used, do not reintroduce:** React Flow (replaced by the vendored canvas, which already lays out
deterministically), Vite (Next.js is required by the vendored packages), MySQL (removed; wrong fit for
graph data).

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

**The engine test command is `node --test dist/*.test.js`. The glob is load-bearing.** `node --test dist/`
resolves to `dist/index.js` on Node 21+ and silently reports one passing test — a green run that proves
nothing. Never shorten it.

`npm run parse` resolves relative paths against `INIT_CWD`. It is a convenience wrapper around the
parser's CLI entry point, not the packaged CLI.

## Storage

JSON files on disk. No database. `graph.json` is ~10–20 MB at 4k files (ids and small integers only, no
source text). Storage sits behind an interface so a graph-native store can be added without touching the
algorithm.
