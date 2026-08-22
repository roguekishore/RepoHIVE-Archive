# Competitive Landscape — RepoHIVE

> Always-on context. Be honest and precise here — this is what survives a sharp reviewer, a sharp
> engineer, and a sharp user.

## Graphify (the key prior art)

- ~63K GitHub stars, YC-backed, PyPI package `graphifyy`. NOT sleepy or obscure.
- Pipeline: Tree-Sitter ASTs → NetworkX graph → **single global Leiden clustering** → exports
  `graph.json` + interactive HTML + a report. SHA256 cache for incremental re-runs.
- Already has: **MCP server** (query_graph/get_node/get_neighbors/shortest_path), **Neo4j export**,
  incremental/watch mode, git hooks, and a **skill** that installs across 10+ AI assistants.
- **Clusters by graph topology with NO embeddings** — independent validation that our structural-first
  approach is sound. *(Content rephrased from Graphify's README for licensing compliance;
  source: github.com/safishamsi/graphify.)*

## Our narrow, defensible edge vs Graphify

1. **Multi-level ADAPTIVE hierarchy** vs their single global clustering. Their flat pile of communities
   IS the "single global strategy" we identify as the gap.
2. **True navigable multi-level hierarchy** (semantic zoom) vs their flat-ish HTML graph.
3. **Determinism + auditability** as first-class outputs — every region decision, score, and parameter
   is recorded and joinable back to the groups it produced.

## Table stakes (NOT novelty — do not imply otherwise)

Tree-Sitter parsing, the dependency graph, MCP server, Neo4j export, incremental indexing, watch mode.
Graphify already has all of these. Our innovation budget is spent on the **algorithm and the hierarchy**.

Note the asymmetry honestly: they are ahead on **packaging and distribution**, we are ahead on the
**grouping algorithm**. Closing our packaging gap is catch-up work, not innovation — but it is still
work that has to happen for anyone to use this.

## Sourcegraph

Broad code search/intelligence at enterprise scale (large teams, years of work). We will NOT be "better
overall." We can be better in our **one narrow slice**: deterministic adaptive hierarchical navigation.
Never conflate "better at our slice" with "better tool."

## Naming

The project name is **RepoHIVE** (Repository Hierarchical Indexing & Visualization Engine) — chosen to
be distinct from **Graphify** (taken, popular, quasi-branded).

## Distribution reality

The **skill** is how Graphify spread. It is the highest-ROI, lowest-effort distribution path (a markdown
instruction file over the CLI). Worth building on its merits — it makes the tool reachable from every
assistant a developer already uses.

But be clear-eyed about cause and effect: **reach is distribution + timing + luck, not algorithm
quality.** A better algorithm does not produce adoption on its own. Don't let "make it spread" become a
reason to change the engine; the engine's job is to be correct.
