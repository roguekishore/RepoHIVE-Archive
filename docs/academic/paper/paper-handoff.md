# FABLE HANDOFF — Write the Final RepoHIVE Research Paper (IEEE conference, .docx)

> **You are Fable.** You already built and hardened the RepoHIVE engine and viewer, so you know the
> system. This brief gives you the *context and constraints* for writing the final, publication-ready
> research paper. It deliberately does **not** dictate the paper's section structure or the IEEE
> formatting details. Derive those yourself from the prior draft and from current guidance on the web
> (see §5 and §6). Read this whole brief before writing.

---

## 0. Mission and single deliverable

Write **one Word document** (`.docx`), laid out for an **IEEE conference (two-column)**, that presents
**only the research novelty of the core algorithm**. It must be **at least 9 pages** of content and
read like a human researcher wrote it.

Save it as: `docs/RepoHive Journal Paper v2.docx`

A prior draft is provided as your starting point (source text and a PDF render):
- `docs/RepoHive Journal Paper v1.docx`
- `docs/RepoHive Journal Paper v1.pdf`

v1 is a solid framing/architecture draft written when the grouping layer was still "in active
development." That is no longer true (see §3). v2 is a substantial revision: keep v1's honest, non-hype
voice, but present the completed algorithm and strengthen the parts that carry the contribution.

**You write prose only. You do not gather data or run anything** (see §4).

---

## 1. What the paper is selling (keep these three at the center)

The entire paper should orbit three points. When deciding what to expand or cut, favor whatever serves
these:

1. **Adaptive, per-region preserve-versus-reconstruct construction.** The one novel idea: measure each
   region's structural quality and decide, region by region, whether to keep its existing boundary or
   rebuild it via community detection, instead of applying one global strategy. This is the research
   contribution.
2. **Determinism.** The same repository and configuration always produce byte-identical output.
   Canonical ordering, content-addressed identifiers, seeded community detection, order-independence
   under input permutation and parallel edges.
3. **Reproducibility and auditability.** Every score, decision, and the full resolved configuration are
   recorded, so any result can be reproduced and the decision boundary is an auditable, tunable
   parameter rather than a hidden constant.

Everything else (blast radius, the JSON contract, the abstract consumers) is supporting material, not
the pitch. Do not let it crowd out the three points above.

---

## 2. Absolute scope boundaries (read twice)

This is a **pure academic paper about the core algorithm**.

**IN scope:** the adaptive grouping algorithm and its stages; structural-quality assessment (cohesion,
coupling, optional modularity) and the quality boundary; determinism, reproducibility, and
auditability; community detection behind an interface (Louvain in Phase 1); blast-radius as static
reverse reachability; the stable JSON contract and its three abstract consumers (a human semantic-zoom
viewer, an AI agent doing bounded-context retrieval, a static impact query); evaluation framed strictly
around **code navigation**.

**OUT of scope (do not mention at all):**
- The vendored viewer's implementation, its upstream project name, or its license, and the word
  "vendoring."
- Any git-history replay, repository split, public/private repositories, or licensing logistics.
- Ecosystem/distribution products: packaged CLI, skill, MCP server, editor extension, Neo4j, cloud,
  auth, telemetry. One honest sentence that the stable contract *allows* future consumers to attach is
  fine; describing them as built products is not.
- The internal development process. **Never** write "we found a bug," "we identified a gap," "an audit
  revealed," or anything implying defect-and-repair. State every property in the present tense as a
  *designed* property of the algorithm.

The viewer may appear **only** abstractly, as a consumer of the index. No product detail.

---

## 3. Context: what changed since v1 (frame generically, never as fixes)

v1 reported the parser done and the grouping layer as future work. The engine and its evaluation
surface are now complete. Present the following as the current, designed state of the system. These are
*facts about the work* to help you write accurately; you decide where each belongs in the paper.

1. **The adaptive contribution now works on real Java.** The dependency signal includes type-use
   references (field, parameter, return, `extends`/`implements`, object creation) and same-package name
   resolution, so intra-package structure is visible and the *preserve* branch actually fires on real
   repositories, not only synthetic fixtures. v1's central claim was untested on real code; it now has
   real evidence (which the owner will supply as data, see §4).
2. **Determinism is enforced and measured across the whole pipeline**, not just the parser: one
   canonical byte-order engine-wide, output invariant under input reordering and parallel edges,
   content-addressed identifiers, seeded detection.
3. **Reproducibility from the audit record.** The metadata records the full *resolved* configuration
   (boundary, metric weights, coefficients, cohesion constant, degenerate score, seed, size bounds,
   override map) alongside every region's scores and decisions, so a boundary sweep is a pure
   post-processing exercise and the boundary is an empirically calibrated, auditable parameter.
4. **Configurable without code changes.** Every parameter the evaluation varies is settable from the
   command line, so a sensitivity analysis is reproducible from a documented invocation.
5. **Robust, total input handling.** Ingest validates the input graph atomically (node and edge shapes,
   signal domains, referential integrity, containment-tree well-formedness) and rejects malformed input
   with a structured error instead of producing a partial or non-reproducible result; output is written
   atomically. Frame this as "reproducibility and integrity by construction."
6. **Scale on real multi-module repositories.** Node identity is scoped to compilation source roots, so
   a repository that legally repeats a fully-qualified name across modules is handled correctly, which
   is what lets the system ingest and group a large multi-module framework.
7. **Signal caveat narrows.** v1 said "frequency signals start simple." The shared-type signal is now
   populated from type-use references; **method-call frequency remains a deliberate future refinement**
   (it needs receiver-type inference). Keep this one honest caveat; drop the broader "import-only"
   framing.

---

## 4. Data: use placeholders, do not fabricate, do not run anything

The owner will benchmark the system independently (clone repositories, run the pipeline, capture the
numbers) and insert the real data. **Your job is the writing, not the measurement.**

- **Do not run** `parse`, `group`, the determinism demo, or any benchmark. Do not read `metadata.json`
  or `graph.json` to lift numbers.
- **Do not invent any number.** No node counts, edge counts, region counts, preserve/reconstruct
  splits, depths, digests, timings, or test totals.
- Where a concrete figure belongs, insert a **clearly-marked placeholder** the owner can find and fill,
  for example: `[[DATA: preserve/reconstruct split on <repo>]]`, `[[DATA: SHA-256 digest, N runs]]`,
  `[[DATA: nodes / edges / regions / depth for <repo>]]`.
- **Design the results section around empty tables and figures** the owner drops values into. Give each
  table a full caption, column headers, and one placeholder row so the shape is unambiguous. Do the same
  for any results figure (a captioned placeholder with a note on what it will plot).
- Write the surrounding prose so it reads correctly once numbers are inserted, but never assert a
  specific result you do not have. Keep performance statements as *estimates*, clearly labeled, unless
  the owner marks a placeholder as measured.
- On Claim B (adaptive beats single-global on mixed repos): keep it a **hypothesis** with
  graceful-degradation framing. Write the comparison as a table the owner can populate; do not claim
  comparative superiority in the prose. The mechanism (both preserve and reconstruct fire on real
  repositories) is what the paper asserts; the comparative win is stated as the evaluation in progress.

---

## 5. Structure: derive it, do not guess it

Do not invent an IEEE structure from memory (that is how papers end up with the wrong sections). Instead:

- Use v1's organization as a reasonable starting point and adapt it to the completed work and the three
  selling points in §1.
- **Consult current guidance on the web** for the expected structure and section conventions of an IEEE
  conference paper, and follow it. Search for the IEEE conference paper template and typical section
  layout; prefer official IEEE sources. Reconcile that guidance with v1 rather than copying either
  blindly.
- The rubric this work is assessed against rewards a clear domain introduction, a literature survey with
  motivation, a sharp problem definition, and a concise, clear architecture/block diagram. Make sure the
  paper covers those well; keep v1's related-work coverage (it is real and correctly cited).

---

## 6. IEEE conference formatting: follow the real spec

Produce a Word document that matches the conventional IEEE conference two-column look. **If any
formatting detail is unclear, look it up on the web** (the IEEE conference template and author kit) and
follow it rather than approximating. At minimum the document needs a title block and abstract that span
the page top, a two-column body, an "Abstract" lead-in and an "Index Terms" line, numbered sections,
numbered figures and tables with IEEE-style captions (figure caption below, table caption above), and
IEEE numbered references in citation order. Confirm the final document paginates to **9 pages or more**
in this layout.

---

## 7. Voice and style (strict)

- **No em dashes anywhere.** Do not use the em dash character, and do not fake one with a spaced hyphen
  or a double hyphen. Restructure with commas, colons, parentheses, or two sentences. Scan the finished
  document and remove every one. This is a hard requirement.
- Write like a careful human: varied sentence length, plain connective tissue, no filler, no breathless
  adjectives, mostly prose (reserve lists for genuinely enumerable items).
- Keep v1's honest posture: open caveats, no headline multipliers ("71x", "orders of magnitude"), no
  claim to beat mature commercial platforms overall.
- Present tense for designed properties; past tense only for things actually measured (which, for you,
  live behind placeholders).
- American spelling, IEEE numeric citations `[n]`.

---

## 8. Figures

v1 embeds Figures 1 through 7 (problem-versus-transformation, the pipeline, the six-stage algorithm, the
preserve-versus-reconstruct decision, the four-level hierarchy, the contract data model, blast radius).
Reuse them where they still fit; revise a caption or note a needed change where a figure is stale.

If a needed diagram cannot come from v1, do **not** hand-draw a weak one. Instead write a high-quality,
self-contained image-generation prompt (layout, labels, arrows, color coding, and the exact text in each
box) and collect all such prompts in `docs/paper-figure-prompts.md`, one per figure. Put a numbered,
captioned placeholder at the intended spot in the paper so the insertion point is unambiguous.

---

## 9. Final checklist

- [ ] Saved as `docs/RepoHive Journal Paper v2.docx`.
- [ ] Two-column IEEE conference layout (verified against a current IEEE spec found on the web);
      paginates to **9 pages or more**.
- [ ] The three selling points (adaptive preserve-vs-reconstruct, determinism, reproducibility) are
      central and prominent.
- [ ] **Zero em dashes** anywhere.
- [ ] Only the core-algorithm research; **no** vendoring, replay, licensing, or product/ecosystem
      detail; the viewer appears only as an abstract consumer.
- [ ] **No** defect-and-repair language; every hardening property stated as designed behavior.
- [ ] **No invented numbers.** Every concrete figure is a clearly-marked placeholder; results tables and
      figures are shaped and captioned for the owner to fill.
- [ ] Claim B kept as a hypothesis; no comparative-superiority claim in prose.
- [ ] Structure and formatting derived from v1 plus current IEEE guidance on the web, not from memory.
- [ ] Figure-generation prompts (if any) written to `docs/paper-figure-prompts.md` with matching
      numbered placeholders in the paper.
- [ ] Honest caveats retained and updated (Claim B status, static blast radius, scale-relative cohesion,
      the narrowed signal caveat, single language and scale tier, bounded token-saving claims).

You know the system. Write the paper a sharp program-committee reviewer would accept: narrow, precise,
reproducible, and honest.
