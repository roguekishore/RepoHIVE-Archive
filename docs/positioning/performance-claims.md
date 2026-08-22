# Performance & Scale — RepoHIVE

> Always-on context. The phase timings below are **engineering estimates, not measured benchmarks** —
> label them as estimates anywhere they are repeated until real numbers replace them. The observed
> numbers section is different: those are real.

## Observed (real, from `fixtures/`)

| Fixture | Scale | Result |
|---------|-------|--------|
| `sample-java-project` | tiny | 29 nodes / 6 edges. The determinism fixture. |
| `vantage` | 158-file Spring Boot | 803 nodes / 344 edges → 20 regions, **preserve 10 / reconstruct 10** |
| `broadleaf` | mature multi-module | **29,190 nodes / 14,325 edges** → 502 regions, **preserve 38 / reconstruct 464**, depth 6 |

`broadleaf` is the load-bearing evidence: it is real, large, multi-module Java, and the adaptive
preserve branch fires on it. It previously crashed `group` with `duplicate node identifier` until node
identity was scoped by source root.

## Phase estimates — 4,000-file Java repo (~50k edges)

| Phase | Estimate | Dominated by |
|-------|----------|--------------|
| `parse` | ~30s – 2 min | Disk I/O (reading thousands of files) + cross-file stitching. Parsing itself is negligible (Tree-Sitter is editor-speed). |
| `group` | seconds – ~1 min | Louvain (handles 50k edges easily; runs only on reconstruct regions) + linear ingest/weight/assess/build. |
| `view` | instant per level | Only ~one level (~20 nodes) rendered at a time. The flat baseline is laggy **by design** — that is the comparison being demonstrated. |

**Full pipeline:** likely **2–5 minutes**, mostly in `parse`. A one-time batch job, not a repeated wait.

## Artifact size

- `graph.json`: **~10–20 MB** at 4k files (IDs + small integers only; no source code, no AST detail).
- `group` loads it in well under a second; working set ~100–300 MB RAM — comfortable on a 16 GB laptop.

## Scale tiers

| Repo size | Verdict |
|-----------|---------|
| ≤ 5,000 files | Comfortable on a laptop, minutes at most. **Demonstrated** up to ~29k nodes. |
| 5k–50k files | Works with tuning (stream parse, bump Node heap, consider moving `index/` to a real store). |
| 50k–200k files | Needs real engineering: chunked/parallel parse, on-disk graph store, incremental re-index. |
| Millions | A different architecture (distributed). Not addressed by the current design. |

These tiers describe **where engineering effort is required**, not a ceiling on ambition. Moving up a
tier is a performance project with known levers, not a redesign of the contribution.

## The 5 factors that drive cost

1. **Edge density** (biggest) — cost scales with edges, not file count.
2. **How tangled the repo is** — more reconstruct regions means more community detection.
3. **Language resolution complexity** — Java's explicit imports are tractable; dynamic languages harder.
4. **RAM ceiling** — sets the in-memory graph limit. 16 GB is plenty at thousands of files.
5. **Disk I/O speed** — dominates parse time.

## How to state performance claims

Claim what is demonstrated: **"validated on real multi-module Java up to ~29k nodes / ~14k edges,
deterministic across runs."** Extrapolate to "thousands of files on commodity hardware" as an estimate,
labelled as one. Do not present the estimate table as measured, and do not claim scales that have not
been run.
