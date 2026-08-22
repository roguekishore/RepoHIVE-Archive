# Architecture

System shape as built. Facts only.

## Pipeline

Three stateless stages that hand off through files on disk.

```
Java repo  →  [parse]  →  graph.json  →  [group]  →  index/*.json  →  [view]  →  browser
```

| Stage | Input | Output | Process model |
|-------|-------|--------|---------------|
| `parse` | a Java source tree | `graph.json` | batch; reads files, writes one file, exits |
| `group` | `graph.json` | `index/` (5 files) | batch; reads one file, writes five, exits |
| `view` | `index/` | HTTP + browser | long-running Next.js server |

`parse` internals: Tree-Sitter produces a per-file AST; the AST is held one file at a time and
discarded. Our stitcher resolves cross-file references and emits the graph. **ASTs are never persisted**
— `graph.json` is the artifact.

`group` internals: ingest → dependency strengths → region identification → structural-quality
assessment → adaptive preserve-vs-reconstruct construction → hierarchy assembly → metadata.

`index/` contents: `repository.json`, `hierarchy.json`, `nodes.json`, `edges.json`, `metadata.json`.

`graph.json` and `index/` are **git-ignored generated artifacts**. Reverting code does not restore the
artifacts that matched it; re-run the pipeline.

## The JSON contract (stable seam)

The parser writes it; every other component reads it. Adding fields is safe; changing or removing them
is a breaking change.

```typescript
interface GraphNode { id; kind: "file"|"function"|"class"; packagePath?; directoryPath; definedInFile?; }
interface DependencyEdge { source; target; importFrequency; methodCallFrequency; sharedTypeCount; strength?; }
```

Group nodes additionally carry `regionId` and `ordinal`; each recorded decision carries `groupIds`.
Join a group to the decision that produced it through those fields — **never re-derive the association
from a path or package-prefix heuristic** (that heuristic existed once and was removed).

Node identity is scoped by source root: `class`/`function` ids carry a `<sourceRoot>|` prefix, omitted
when the scope is empty so single-root ids are unchanged. This is what makes multi-module repos work.

## Packages

```
packages/
  shared/       JSON-contract types (the stable seam)
  types/        shared TS types for the viewer/API surface
  parser/       Tree-Sitter Java → graph.json
  core/         grouping algorithm + blast radius
  cli/          wires the pipeline
  api-client/   framework-free client for the REST surface
  ui/           shared UI components
  web/          Next.js 15 viewer + its route handlers
```

`shared` and `types` are leaf dependencies. `parser` and `core` depend only on `shared`. Nothing in
`parser` or `core` may import from `web`, `ui`, `api-client`, or `cli`.

## Viewer surface

`packages/web` serves its own Next.js route handlers over the pre-computed `index/`:

```
/api/workspace
/api/repos
/api/repos/[id]
/api/graph/[id]
/api/graph/[id]/blast-radius
/api/graph/[id]/region-decisions
/api/graph/[id]/zoom-map
```

These routes are **unauthenticated and intended for localhost only.** They expose indexed source
structure. Any change that binds them to a non-loopback interface, or any deployment beyond a developer's
own machine, requires authentication first — treat that as a blocking prerequisite, not a follow-up.

Rendering is level-at-a-time semantic zoom (~20 nodes) plus a flat baseline view for comparison. Layout
is computed client-side and is deterministic (sorts by sibling rank, ties broken by id).

## Engine / ecosystem boundary

- **Engine:** `parser`, `core`, `shared` — the parse/group/blast-radius logic.
- **Ecosystem:** `cli`, `web`, `ui`, `api-client`, and any future skill / MCP server / editor extension.

Ecosystem code may depend on engine code. **Engine code may never depend on ecosystem code.** Every
change belongs clearly on one side of this line.

## Repository root

`.kiro/` lives at the workspace root, so `D:\PROJECTS\GRAPH` is the project root.

```
.kiro/          steering, specs, memory (PROJECT_STATE / DECISIONS / BRAIN), hooks, skills, agents
packages/       see above
docs/           engineering docs and plans; positioning/ and academic/ are excluded from context
fixtures/       sample-java-project, vantage, broadleaf (git-ignored clones)
repowise/       vendored AGPL upstream UI packages (attribution in NOTICE)
tooling/        MCP servers (git-ignored)
archive/        scrap (git-ignored)
```
