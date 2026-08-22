# Review 3 — Viewer Demonstration Guide

**Deliverable:** `view` — `index/` → an interactive, semantic-zoom viewer (+ flat baseline + decision audit).
**Spec:** `.kiro/specs/hierarchical-graph-viewer/` · **Branch:** `phase-3-viewer`

> Message for this review: *"Flat is unusable; hierarchical is navigable — here's the visible proof."*
> Every command below was run against this repo to verify it works.

---

## 1. What was built

- The viewer is **adopted, not written**: the UI packages of [repowise](https://github.com/repowise-dev/repowise) (AGPL-3.0) are vendored into `packages/{ui,web,api-client,types}`; RepoHIVE relicensed MIT → AGPL-3.0 to match.
- A **read-only projection of `index/`** onto that UI — no backend, no database. One pure adapter (`index/*.json` → the canvas's `ZoomMap`) + one label module, served by Next.js route handlers that read `fixtures/<repo>/index/` from disk.
- Three reachable surfaces (everything else the engine can't feed stays gated in one nav file):
  1. **Knowledge Graph** — the semantic-zoom map (the headline).
  2. **Flat baseline** — the same repo as one unstructured node-link graph (the "before").
  3. **Decision audit** — a read-only table of every preserve/reconstruct decision.
- Determinism preserved: no clock/RNG in the adapter; the same index renders the same picture.

## 2. Prerequisites

```bash
npm install
npm run build                              # engine dist (the viewer reads @repohive/core's index parser)
npm run build --workspace @repohive/web    # next build
```

The viewer needs each repo's `index/` on disk (Review 2's output). If missing, regenerate:

```bash
npm run parse -- fixtures/vantage && npm run group -- fixtures/vantage
```

`packages/web/.env.local` must contain `REPOWISE_API_URL=http://localhost:3000` (local-only, git-ignored) so server-side rendering hits our own handlers.

## 3. Run it

```bash
npm run start --workspace @repohive/web    # or: npm run dev --workspace @repohive/web
```

Open **http://localhost:3000** → sidebar shows the fixture repos (`vantage`, `broadleaf`, `sample-java-project`), each with **Knowledge Graph · Flat baseline · Decision audit**. No backend is running — this is the whole point of the file-handoff design.

## 4. Demo — Knowledge Graph (the headline) ★

Open **vantage → Knowledge Graph**. Talking points, in order:

1. **Semantic zoom.** Scroll to zoom, drag to pan, double-click a card to descend Repository → groups → files. Only ~one level (~5–20 cards) is ever on screen — never all 214 nodes at once.
2. **Real labels, not hashes.** Group cards read the package name (`friend`, `battle`); hover shows the full package. This is derived viewer-side (`g_<hash>` never shown).
3. **Adaptive decision, visible.** Each group card carries a **P** (preserved) or **R** (reconstructed) badge; the legend explains it. Select a card → the detail panel shows *"Preserved · quality 0.84 · confidence 0.34"*, read straight from `metadata.json`. This is Claim B made visible.
4. **Blast radius.** Select a file or group → everything that depends on it lights up **red** across the map, the rest dims, and the selection keeps its own ring. (vantage file reach ≈ 3, group `battle` ≈ 23.) State the honest caveat: this is *static* reachability.
5. **Relations.** Hover/selection draws sibling dependency arrows (weight = file-pair count); a pinned selection keeps them and highlights partners even when panned off-screen.

Then load **broadleaf** (the big one): 4,684 map nodes from 30,889 hierarchy nodes (classes/functions folded to a file-leaf map), still navigable level-by-level.

## 5. Demo — Flat baseline (the "before")

Open **vantage → Flat baseline**: the same index as one unstructured graph — 158 files, 344 dependencies. Then **broadleaf → Flat baseline**: **2,985 files, 13,900 dependencies** — the tangle. Say it plainly: this is RepoHIVE's *own* graph drawn flat, not a competitor's failure. Side-by-side with the map, it *is* the "flat vs navigable" argument.

## 6. Demo — Decision audit (auditable, not asserted)

Open **vantage → Decision audit**: 20 regions, boundary 0.5, with cohesion/coupling/score/confidence and measured-vs-overridden — values shown exactly as recorded. "View on map" jumps to the region's group. This lets a reviewer check the algorithm's reasoning instead of trusting a picture.

## 7. Suggested 5-minute running order

| # | Where | What you say |
|---|-------|--------------|
| 1 | vantage → Knowledge Graph | "Google Maps for code — zoom in, one level at a time." |
| 2 | Select a group | "P/R badge + score — the adaptive decision, read from the index." |
| 3 | Select a file | "Blast radius: what depends on this, lit red across the map." |
| 4 | broadleaf → Flat baseline | "Same engine, drawn flat: ~3k files, ~14k edges. Unusable." |
| 5 | vantage → Decision audit | "Every decision, auditable — not asserted." |

## 8. Gaps / things NOT yet done (flagged, not hidden)

1. **Decision provenance is a heuristic.** Group→region is joined by package prefix (`docs/group-naming.md` §7-a): exact for preserved packages, approximate for reconstruct sub-clusters (they share their region's decision). The exact fix (stamp `regionId` into `nodes.json`, "Fix 6") is deliberately deferred to after the viewer.
2. **Cross-boundary leaf edges not drawn.** Relations are sibling-only by design; a leaf's cross-package dependencies show as group→group edges one level up, and blast radius covers cross-boundary reach. Ancestor-projected leaf edges are a deferred refinement.
3. **Packaging is 8th-sem.** This is demoed via `npm run` + a browser; the CLI/skill/MCP/VS Code wrappers are distribution work, not this review.
4. **`.env.local` is local-only** (git-ignored), so a fresh clone needs the one line in §2 to run.
