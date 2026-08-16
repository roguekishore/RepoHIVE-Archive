# Figure generation prompts for "RepoHive Journal Paper v2"

This file holds self-contained image-generation prompts for the figures in
`RepoHive Journal Paper v2.docx` that could not be carried over from v1. Each
prompt names the exact text in every box, the arrow topology, the color coding,
and the target aspect ratio.

The paper carries a numbered, captioned placeholder at each insertion point, so
the position is unambiguous. Replace the placeholder paragraph with the
generated image and keep the caption as written.

Figures 1, 2, 4, 5, 6 and 7 are reused unchanged from v1 and need no prompt.

---

## Figure 3 (replacement) — The six-stage grouping algorithm

**Why it is being regenerated.** The v1 version of this figure is a single tall
vertical column, roughly 1:2.3 aspect, which renders about 7.9 inches high at
IEEE column width and crowds out a full page. It also predates the
configuration validation gate and the resolved-configuration record, both of
which carry the paper's reproducibility argument, so it no longer shows the
whole algorithm.

**Prompt:**

> A clean, technical flowchart diagram in a horizontal layout, suitable for an
> academic paper. White background, no drop shadows, no gradients. Use thin
> (1.5 px) solid rounded-rectangle boxes with a light lavender fill (#EEEEFB)
> and a medium purple border (#6C5CE7). Arrows are thin solid black with small
> filled arrowheads. All text is dark grey (#1A1A1A) in a clean sans-serif face
> at a consistent size. Target aspect ratio 16:9, wide rather than tall.
>
> Layout: a single left-to-right pipeline of six numbered stages across the
> middle of the canvas, with one gate box above the pipeline on the left and one
> accumulator box below the pipeline on the right.
>
> Far left, a plain rectangle (no fill, dashed grey border) labeled on two
> lines: "graph.json" and "(flat dependency graph)". An arrow points right from
> it into the first stage.
>
> Above and slightly left of stage 1, a hexagon box with a pale amber fill
> (#FDF3DC) and amber border (#D9A441), labeled on two lines: "0. Validate
> configuration" and "reject out-of-domain parameters". A short arrow points
> down from this hexagon into stage 1, and a small label beside that arrow reads
> "before any work".
>
> The six pipeline boxes, left to right, each with a bold first line and smaller
> following lines:
>
> 1. "1. Ingest" / "validate shape, kinds, signals," / "referential integrity"
> 2. "2. Weight" / "strength = a·importFreq +" / "b·callFreq + c·sharedTypes"
> 3. "3. Assess" / "cohesion + coupling" / "(+ optional modularity)" / "→ score in [0,1]"
> 4. "4. Construct (adaptive)" / "score vs boundary →" / "preserve or reconstruct"
> 5. "5. Assemble" / "bounded branching," / "content-addressed ids," / "cross-group edges"
> 6. "6. Serialize" / "atomic five-file write"
>
> Draw box 4 with a thicker border (3 px) and a slightly more saturated fill
> (#E4E0FB) so it reads as the emphasized stage. Place a small italic caption
> directly beneath box 4 that reads "research core".
>
> Below the pipeline, roughly under boxes 4 and 5, a wide rectangle with a pale
> grey fill (#F2F2F2) and solid grey border labeled "Audit record (metadata)".
> Draw three thin dashed grey arrows curving down into it: one from box 3
> labeled "scores, weights, constants", one from box 4 labeled "decisions,
> confidence, boundary", one from box 5 labeled "per-level counts". Draw one
> thin dashed grey arrow from the hexagon gate down and across into the same
> box, labeled "resolved configuration". Then draw one solid arrow from the
> audit record box up into box 6.
>
> Far right, a plain rectangle (no fill, dashed grey border) labeled on two
> lines: "index/" and "repository · hierarchy · nodes · edges · metadata", with
> an arrow into it from box 6.
>
> Do not include a title inside the image. Do not include a legend. Keep all
> label text exactly as written above.

**Caption used in the paper (Fig. 3):**
`Fig. 3.  The six-stage grouping algorithm. Configuration is validated before any work begins, and the quality-bearing stages thread their scores, decisions, and the resolved configuration into the audit record that is serialized alongside the hierarchy.`

---

## Figure 8 — Boundary sensitivity (results placeholder)

**Why there is no prompt.** Figure 8 is a data plot, not a diagram. It must be
produced from measured output, not generated. The paper carries a captioned
placeholder describing exactly what to plot; drop the rendered chart in when the
benchmark data exists.

**What to plot.** X axis: the structural quality boundary, swept across its
range. Y axis (left): a navigation metric, for example mean expansion steps to
locate a file. Optionally a second series on a right axis: the fraction of
regions preserved. Draw one line per evaluation repository. Mark the calibrated
operating boundary with a vertical dashed rule. The point the figure must make
is how sharply navigability responds to where the preserve-versus-reconstruct
line is drawn, and whether a broad plateau exists around the chosen value.

**Caption used in the paper (Fig. 8):**
`Fig. 8.  Sensitivity of navigation cost to the structural quality boundary. Each line is one repository; the dashed vertical rule marks the calibrated operating point. Because every region's score is recorded, the sweep is computed from the audit record without re-running assessment.`
