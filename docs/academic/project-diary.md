# Project Diary — RepoHIVE (23CS701 – Project-I)

> Reviewer-facing record of **project implementation** progress, organized **by week**.
> Filled from REAL implementation work only — the engine/product (parser, grouping algorithm, viewer,
> blast radius) and the specs that define those deliverables. **Excludes** meta/infrastructure work
> (hooks, steering, the memory vault, PROJECT_STATE/BRAIN upkeep, git setup, naming). No fabricated
> progress. Dates are **week ranges** — fixate the exact start/end dates yourself.

## Team & supervisor

- Team No.: _____
- Members: _____ (Reg. No. _____)
- Supervisor: _____
- Class: IV B.E. CSE | Semester: VII | Academic Year: 2026–2027 (Odd)

## Review dates

| Review | Date |
|--------|------|
| Zeroth | 15.06.2026 |
| First | 03.07.2026 |
| Second | 15.07.2026 |
| Third | 10.08.2026 |

---

## Weekly implementation log

| Week | Dates (start – end) | Implementation work | Supervisor Sign |
|------|---------------------|---------------------|-----------------|
| 1 | _____ – _____ | **Phase-1 Parser (Review 1 deliverable).** Built `packages/shared` (JSON-contract types: `GraphNode`, `DependencyEdge`, `RawDependencyGraph`) and `packages/parser`: Tree-Sitter Java AST extraction of file/class/function nodes, symbol-table construction, cross-file dependency stitching into de-duplicated import edges written to `graph.json`, deterministic content-derived IDs + canonical ordering, a determinism harness (repeated-run SHA-256 check), and a hand-written sample Java fixture. 102 tests passing (property + unit). | |
| 2 | _____ – _____ | **Phase-2 Grouping Algorithm (Review 2 deliverable).** Built `packages/core`: graph ingestion with atomic validation (duplicate IDs, dangling references), signal-derived dependency strengths, Java-package region identification, structural-quality assessment (cohesion/coupling score), seeded Louvain community detection behind a pluggable seam, adaptive per-region preserve-vs-reconstruct construction, balanced hierarchy assembly (Repository → Groups → Files → Functions), five-file `index/` serialization + read-back parser, blast-radius reverse-reachability analysis, and the `group` CLI with determinism/baseline demo scripts. 79 tests covering all 33 spec correctness properties (181 total across workspaces); byte-identical SHA-256 output across repeated and shuffled-input runs. | |
| 3 | _____ – _____ | **Wave A — Parser signal enrichment + core degenerate guard (parser-hardening branch).** Fixed three engine gaps to make the adaptive preserve-vs-reconstruct contribution demonstrable on real Java. (1) Strength-aware degenerate rule in `packages/core`: added total-weight guard in `community.ts` and `intra <= 0` arm in `assessor.ts` to prevent singleton explosion on zero-weight edges. (2) Type-use edge extraction in `packages/parser`: added `collectTypeReferences()` walk over field/parameter/return/extends/implements/new type positions; `sharedTypeCount` now populated. (3) Same-package simple-name resolution in `packages/parser`: per-file import index pre-pass in `stitch()` + JLS-precedence candidate list (single-type import → same package → wildcard). Re-parsed `vantage` (158-file Spring Boot): 341 edges (was 128), **preserve 10 / reconstruct 10** (was 0/20). Suite: 204 tests, 0 failing. Determinism confirmed. | |
