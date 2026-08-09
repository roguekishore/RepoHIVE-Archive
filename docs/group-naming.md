# Group naming — problem & solution design (parked)

> **Status:** DEFERRED (documented 2026-08-09 18:06). Parked to prioritize the `phase-3-viewer`
> build. This note captures the problem and the full solution design so it can be resumed with no
> re-derivation. Nothing here is implemented yet.

## The problem

The `group` stage builds the hierarchy by adding **`group` nodes** (`g_<sha1>`, levels 1–2) and one
**`repository` node** (`r_<sha1>`, level 0) on top of the flat `file`/`class`/`function` nodes. These
group nodes are the **regions the viewer navigates** (the preserve/reconstruct results). But in
`index/nodes.json` a group node carries only:

```json
{ "id": "g_002c619ae75eab325655c8af8ac7a42acd1c76f5", "kind": "group", "level": 1 }
```

No name, no package, no provenance — just a content-hash id. So a semantic-zoom viewer would render
the primary navigation targets as `g_002c619…`. (The `g_<hash>` is a SHA-1 of the group's canonical
membership — that is what makes output deterministic; it is not meant to be human-readable.)

Note the pipeline boundary: **`graph.json` (parser output) has NO group nodes** — it is the flat
graph. Groups exist only in `index/` (the `group` stage's output). Naming is therefore an `index/`
concern, not a parser one.

This is the still-open **Gap 12 / Fix 6** ("Group_Nodes carry no label or Region provenance") for the
structural tier, and the deferred **embeddings-for-naming** roadmap item for the semantic tier.

## The one rule: naming is strictly downstream of grouping

Whatever the naming scheme, it **reads the hierarchy and never influences it**. Grouping stays
deterministic and structural; naming is a presentation layer on top. This matches steering
(*"embeddings may be added as a semantic layer for search/naming, never for grouping"*) and preserves
two things: the determinism digest stays stable, and the core contribution (deterministic adaptive
grouping) is untouched — disable naming and the hierarchy is byte-identical.

## Tier 1 — deterministic structural labels (free, demo-grade)

Pure function over a group's membership (data already in `index/`: each leaf's `packagePath`, each
group's `childIds` via `hierarchy.json`):

- **Preserve group** = a kept package → label is the **package name** (`com.example.model`). Already
  recorded per-region in `metadata.json` (`pkg:…`).
- **Reconstruct group** = a Louvain community inside a package → no single package, so derive
  deterministically: longest common package prefix + ordinal (`com.example.tangle · cluster 2`), or
  the hub (highest-degree member file), or a representative filename + count. Ordinal must use the
  core's existing canonical community order (`relabelByContent`) so it stays deterministic.

Deterministic ⇒ safe to bake into `index/` (this is Fix 6: add `label` + provenance to the group
node) **or** derive viewer-side with zero engine change.

## Tier 2 — semantic names ("Authentication", "Order Fulfillment")

Needs to understand what the code does. Input already in `index/`: member file/class/method names
(optionally source). Two options:

- **TF-IDF / keyword extraction** — tokenize camelCase identifiers, rank salient terms across groups,
  top-k → `auth · token · session`. Deterministic, no LLM; can live in the engine.
- **LLM prose** — feed member signatures to an LLM → `"Authentication & Session Management"`.
  Non-deterministic, so it **must not** enter `index/`. Generate it in a separate ecosystem tool and
  write a **sidecar `labels.json` keyed by the `g_<hash>` id** (cached by hash → deterministic replay;
  only re-labels groups whose membership changed). The engine never sees it.

## Where each lives (the boundary)

| Tier | Determinism | Home |
|---|---|---|
| Tier 1 structural | deterministic | inside `index/` (Fix 6) or viewer-side |
| Tier 2 TF-IDF | deterministic | engine step or sidecar |
| Tier 2 LLM prose | non-deterministic | **sidecar `labels.json` keyed by group id — never in `index/` or the determinism digest** |

## Sizing

| Option | Size | Notes |
|---|---|---|
| Tier 1 — viewer-side | **Small (~½ day)** | one label helper + renderer wiring; no engine change |
| Tier 1 — Fix 6 (server-side) | **Medium (~1 day)** | core hierarchy builder attaches label+provenance; tests; re-index; digest bump; spec note |
| Tier 2 — TF-IDF keywords | **Medium (~1–2 days)** | deterministic term extraction + tests |
| Tier 2 — LLM prose | **Medium build + tuning (~1–2 days + API cost)** | sidecar tool, hash-keyed cache; prompt tuning is the time sink |

## Recommendation / resume plan

1. **For the demo:** Tier 1 **viewer-side** — derive labels from group children (preserve → package;
   reconstruct → common-prefix/hub + count). Half a day, no engine risk, makes the semantic-zoom view
   readable. Do this as part of the `phase-3-viewer` work.
2. **Post-demo, canonical:** promote Tier 1 into the engine via **Fix 6 / Gap 12** so labels are
   deterministic and recorded from day one.
3. **Later flourish:** Tier 2 LLM prose as a sidecar keyed by `g_<hash>`. The group-id hash is the
   stable seam, so starting with Tier 1 costs nothing later.

The one thing that would make this genuinely large — and must be avoided — is baking LLM names into
the deterministic `index/`. Kept as a hash-keyed sidecar, even the LLM tier stays a bolt-on.
