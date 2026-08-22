# Academic Track

> **Not agent context.** Load only when the user explicitly asks for a review deck, a handout, the
> diary, the research log, or the paper.
>
> **Nothing in this file caps engineering scope.** Review dates are deadlines for *artifacts*, not limits
> on what the system may become. If this file appears to conflict with what to build, it loses.

## Scope of this track

Course: 23CS701 – Project-I (7th semester) and its 8th-semester continuation. Six reviews total plus a
journal paper.

## Review status

| Review | Date | Artifact | Status |
|--------|------|----------|--------|
| Zeroth | 15.06.2026 | Proposal | done |
| First | 03.07.2026 | Parser → `graph.json` | done |
| Second | 15.07.2026 | Adaptive grouping → `index/` | done |
| Third | 10.08.2026 | Viewer + flat baseline | done |
| Fourth–Sixth | 8th semester, September onward — **dates TBD, do not invent them** | Packaging, evaluation metrics, scaling, paper | pending |

## The three-beat arc used for reviews 1–3 (kept as a narrative asset)

Problem → Solution → Payoff, which is still the clearest way to present the work:

1. **Parser.** Show `graph.json`. *"Here's the raw flat dependency graph. Flat doesn't scale — here's
   the evidence."*
2. **Algorithm.** Show the same repo as Repository → Groups → Files → Functions, with metadata
   recording each preserve-vs-reconstruct decision. *"The flat tangle becomes a navigable hierarchy,
   automatically and reproducibly."*
3. **Viewer + baseline.** Semantic zoom side by side with the flat baseline; blast radius lighting up
   impacted regions. *"Flat is unusable; hierarchical is navigable — here's the visible proof."*

## Rubric — mark ALL six in every deck

| Criterion | Marks |
|-----------|-------|
| Domain Knowledge | 20 |
| Literature Survey | 20 |
| Problem Definition | 20 |
| Proposed Architecture (block diagram — concise + clear) | 20 |
| Organization of Presentation | 10 |
| Communication Skill | 10 |

Implication for every deck: a clear domain intro, the literature survey + motivation, a sharp problem
definition, and a **concise block diagram** of the system.

## Paper obligations

- **0% plagiarism is a hard requirement.** Write from `docs/academic/research-log.md` in the owner's own
  voice. Never paste external text; never mirror a source's sentence structure. Paraphrase and cite.
- Cite all ten reference papers in `docs/reference/papers/`.
- Current drafts: `docs/academic/paper/` (journal paper v1 and v2, IEEE conference format), with figure
  generation prompts and the paper hand-off brief alongside them.
- Claims must match the caveats in `docs/positioning/product-vision.md` exactly: static reachability for
  blast radius, incremental (not headline) token savings, no "better than Sourcegraph/Graphify overall",
  and Claim B stated as a hypothesis validated on mixed repos rather than a theorem.
- Performance numbers must follow `docs/positioning/performance-claims.md`: observed fixture numbers are
  real, the 4,000-file phase timings are estimates and must be labelled as estimates. The measured
  numbers themselves live in `.kiro/PROJECT_STATE.md`.

## Artifacts

See `README.md` in this folder for the full inventory. `2nd/review-2-demo-guide.md` is stale — rebuild it
around `vantage`/`broadleaf` (real preserve-vs-reconstruct results) if it is needed again.

## Honesty rule

Record only real work. Never fabricate progress, dates, or results in a deck, the diary, the research
log, or the paper. The engineering ledger in `PROJECT_STATE.md` and `BRAIN.md` is the source of truth
for what actually happened.
