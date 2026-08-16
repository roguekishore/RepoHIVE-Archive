# Figure generation prompts for "RepoHive Journal Paper v2"

Every figure in the paper is generated from scratch from the prompts below, so
the whole set shares one visual language instead of the mixed styles carried
over from v1.

**How to use this file.** Paste the House Style block first, then the prompt for
the figure you want. Each figure prompt is written to stand alone: it repeats
the essentials of the style so it still works if pasted by itself. Generate at
high resolution (at least 2000 px on the long edge), then place the image in the
paper at the stated column width and keep the caption exactly as given.

**Aspect ratios are not decorative.** The paper is IEEE two-column, so each
figure lives in a 3.45 inch column. The target ratio on each prompt is chosen so
the figure fits without dominating the page. A figure that comes back much
taller than its target should be regenerated rather than scaled down, because
scaling makes the labels unreadable at print size.

| Fig. | Subject | Target ratio | Placed width | Renders at |
|---|---|---|---|---|
| 1 | Problem and transformation | 16:9 | 3.30 in | 1.86 in tall |
| 2 | Pipeline and contract seam | 5:1 | 3.40 in | 0.68 in tall |
| 3 | Six-stage grouping algorithm | 16:9 | 3.40 in | 1.91 in tall |
| 4 | Preserve versus reconstruct decision | 4:5 | 3.15 in | 3.94 in tall |
| 5 | Multi-level hierarchy | 3:2 | 3.40 in | 2.27 in tall |
| 6 | Contract data model | 4:3 | 3.30 in | 2.48 in tall |
| 7 | Blast radius | 16:9 | 3.30 in | 1.86 in tall |
| 8 | Boundary sensitivity | 4:3 | 3.30 in | 2.48 in tall |

Figure 8 is a data plot rather than a diagram, so it has a plotting
specification instead of an image prompt. It must be produced from measured
output, never generated.

---

## House Style (prepend to every figure prompt)

> **House style.** A clean technical diagram for an academic paper. Pure white
> background. No drop shadows, no gradients, no 3D effects, no textures, no
> decorative icons. Flat vector look, as if drawn in a diagramming tool.
>
> Shapes are rounded rectangles with a 6 px corner radius and a 1.5 px solid
> border, except where a prompt asks for a diamond, cylinder, or hexagon.
>
> Color roles, used consistently:
> - Process or structural box: fill #EEEEFB, border #6C5CE7
> - Emphasized box: fill #E4E0FB, border #6C5CE7 at 3 px
> - On-disk artifact: fill #FFFFFF, dashed border #9AA0A6
> - Container or region: fill #FAFAFA, dashed border #C6C9CE
> - Preserve outcome: fill #E8F5E9, border #2E7D32
> - Reconstruct outcome: fill #FDF3DC, border #D9A441
> - Query target: fill #FDE7E9, border #C5303E
> - Impacted item: fill #FFF1DC, border #E08A2E
> - Audit or metadata: fill #F2F2F2, border #7A7A7A
>
> All text is #1A1A1A in a clean sans-serif (Inter, Helvetica, or Arial), at one
> consistent size for box labels and one smaller consistent size for edge
> labels. Never render text smaller than about 2 percent of the image height.
> Do not letterbox: the diagram should fill the canvas with a small even margin.
>
> Arrows are 1.5 px solid #1A1A1A with small filled triangular arrowheads for
> flow, and 1.2 px dashed #7A7A7A for "records" or "reads" relationships. Edge
> labels sit on a small white plate so they stay legible where they cross a line.
>
> Do not draw a title inside the image; the paper supplies the caption. Do not
> add a legend unless the prompt asks for one. Reproduce all label text exactly
> as written, including capitalization and punctuation.

---

## Figure 1: The problem and the transformation

**Purpose.** The opening contrast: an unreadable flat graph on the left, the
navigable hierarchy on the right, with the transformation between them. This is
the figure that has to make the problem obvious in one glance.

**Prompt:**

> [House style]
>
> Target aspect ratio 16:9, landscape. Two panels side by side, separated by a
> horizontal transformation arrow at the vertical center.
>
> **Left panel**, occupying about 40 percent of the width: a container with fill
> #FAFAFA and a dashed #C6C9CE border. Its heading, in the top-left corner
> inside the container, reads "Flat dependency graph". Below the heading, a
> deliberately tangled node-link graph: about fourteen small circles of fill
> #EEEEFB with border #6C5CE7, each 26 px across, scattered without any grid or
> symmetry, connected by roughly twenty-four thin curved #1A1A1A lines that
> cross each other many times. The circles carry no text. The impression must be
> visual overload: no discernible structure, no obvious starting point, edges
> crossing everywhere. Do not make it look neat or radially symmetric.
>
> **Center**: a horizontal arrow pointing right from the left panel to the right
> panel, drawn thicker than the diagram arrows at 3 px. Above it, on a white
> plate, the label "RepoHIVE: parse and group".
>
> **Right panel**, occupying about 45 percent of the width: a container with
> fill #FAFAFA and a dashed #C6C9CE border. Its heading, top-left inside the
> container, reads "Navigable hierarchy". Inside, a clean four-level tree drawn
> top to bottom with straight orthogonal connector lines and generous spacing:
>
> - Level 1, one box centered at the top: "Repository"
> - Level 2, two boxes: "Group A" and "Group B"
> - Level 3, three boxes: "File a1", "File a2" under Group A, and "File b1"
>   under Group B
> - Level 4, three boxes: "fn()" under File a1, "fn()" under File a2, and "fn()"
>   under File b1
>
> All right-panel boxes use fill #EEEEFB with border #6C5CE7. The tree must read
> as calm and orderly, in direct contrast to the tangle on the left. Keep both
> panels the same height and align their tops.

**Caption (Fig. 1):**
`Fig. 1.  The core problem and the RepoHIVE transformation. A flat dependency graph, unreadable at scale, becomes a navigable multi-level hierarchy.`

---

## Figure 2: The pipeline and the contract seam

**Purpose.** Shows that the stages never call each other: they hand off through
JSON artifacts, and consumers read the index without the engine knowing them.
Note that the viewer is named abstractly here. Do not name any UI framework.

**Prompt:**

> [House style]
>
> Target aspect ratio 5:1, a wide horizontal strip. A single left-to-right flow
> along the vertical center, with two consumers branching off to the right.
>
> Far left, a cylinder shape (database-style) with fill #EEEEFB and border
> #6C5CE7, labeled "Java repository". An arrow points right to the first stage.
>
> Then, alternating process boxes and artifact boxes, left to right:
>
> 1. Process box, fill #EEEEFB border #6C5CE7, two lines: "parse" and
>    "(syntax trees, cross-file resolution)"
> 2. Artifact box, white fill and dashed #9AA0A6 border, two lines:
>    "graph.json" and "(flat dependency graph)"
> 3. Process box, fill #EEEEFB border #6C5CE7, two lines: "group" and
>    "(adaptive algorithm)"
> 4. Artifact box, white fill and dashed #9AA0A6 border, two lines: "index/" and
>    "(hierarchy + audit record)"
>
> Solid arrows connect 1 to 2 to 3 to 4 in sequence.
>
> From the "index/" artifact box, draw three dashed #7A7A7A arrows fanning to
> the right, each labeled "reads" on a small white plate, pointing to three
> boxes stacked vertically. All three use fill #EEEEFB and border #6C5CE7:
>
> - "Semantic-zoom viewer"
> - "Bounded-context agent"
> - "Impact query"
>
> Beneath the two artifact boxes only, add a small caption line in #7A7A7A at
> the smaller text size reading "stable contract". Keep the whole strip short in
> height: the three consumer boxes should be compact so the figure stays close
> to a 5:1 ratio.

**Caption (Fig. 2):**
`Fig. 2.  The stateless file-handoff pipeline. Parsing turns a Java repository into a flat dependency graph; grouping turns that into the hierarchical index; consumers read the index directly.`

---

## Figure 3: The six-stage grouping algorithm

**Purpose.** The whole algorithm on one line, including the configuration gate
that runs before any work and the audit record that the quality-bearing stages
write into. Those two elements carry the reproducibility argument.

**Prompt:**

> [House style]
>
> Target aspect ratio 16:9, landscape and wide rather than tall. A single
> left-to-right pipeline of six numbered stages across the vertical middle, with
> one gate above the pipeline on the left and one accumulator below it on the
> right.
>
> Far left, an artifact box with white fill and dashed #9AA0A6 border, two
> lines: "graph.json" and "(flat dependency graph)". An arrow points right into
> stage 1.
>
> Above and slightly left of stage 1, a hexagon with fill #FDF3DC and border
> #D9A441, two lines: "0. Validate configuration" and "reject out-of-domain
> parameters". A short arrow points down from the hexagon into stage 1, with the
> label "before any work" beside it on a white plate.
>
> The six pipeline boxes, left to right, each with its numbered title on the
> first line in slightly heavier weight and the remaining lines smaller:
>
> 1. "1. Ingest" / "validate shape, kinds, signals," / "referential integrity"
> 2. "2. Weight" / "strength = a·importFreq +" / "b·callFreq + c·sharedTypes"
> 3. "3. Assess" / "cohesion + coupling" / "(+ optional modularity)" / "score in [0,1]"
> 4. "4. Construct (adaptive)" / "score vs boundary:" / "preserve or reconstruct"
> 5. "5. Assemble" / "bounded branching," / "content-addressed ids," / "cross-group edges"
> 6. "6. Serialize" / "atomic five-file write"
>
> Boxes 1, 2, 3, 5 and 6 use fill #EEEEFB with border #6C5CE7. Box 4 is the
> emphasized box: fill #E4E0FB with a 3 px #6C5CE7 border. Directly beneath box
> 4, outside it, place a small italic label in #6C5CE7 reading "research core".
>
> Below the pipeline, spanning roughly the width of boxes 3 through 5, a wide
> box with fill #F2F2F2 and border #7A7A7A labeled "Audit record (metadata)".
> Draw four dashed #7A7A7A arrows curving down into it, each with a small white
> label plate:
>
> - from box 3, labeled "scores, weights, constants"
> - from box 4, labeled "decisions, confidence, boundary"
> - from box 5, labeled "per-level counts"
> - from the hexagon gate, curving down and across, labeled "resolved configuration"
>
> Then one solid arrow from the audit record box up into box 6.
>
> Far right, an artifact box with white fill and dashed #9AA0A6 border, two
> lines: "index/" and "repository · hierarchy · nodes · edges · metadata", with a
> solid arrow into it from box 6.

**Caption (Fig. 3):**
`Fig. 3.  The six-stage grouping algorithm. Configuration is validated before any work begins, and the quality-bearing stages thread their scores, decisions, and the resolved configuration into the audit record that is serialized alongside the hierarchy.`

---

## Figure 4: The preserve versus reconstruct decision

**Purpose.** The paper's central contribution in one diagram: the per-region
decision, the override path, and the fact that both the applied and the
automatic action are recorded. Keep it compact; v1's version was so tall it
crowded out a page.

**Prompt:**

> [House style]
>
> Target aspect ratio 4:5, portrait but compact. A top-to-bottom decision flow
> with a narrow override branch on the left. Keep the vertical spacing tight so
> the diagram does not become a long thin column.
>
> Top: a stadium shape (fully rounded ends) with fill #EEEEFB and border
> #6C5CE7, labeled "For each region".
>
> Below it, a diamond with fill #EEEEFB and border #6C5CE7, two lines: "User
> override" and "supplied?".
>
> From the diamond's left vertex, an arrow labeled "yes" runs down the left side
> of the canvas to a box with fill #EEEEFB and border #6C5CE7, two lines: "Apply
> user action" and "(record automatic action too)".
>
> From the diamond's bottom vertex, an arrow labeled "no" continues down the
> center to a box with fill #EEEEFB and border #6C5CE7, three lines: "Compute
> structural quality score", "cohesion + coupling", "(+ optional modularity)".
>
> Below that, a second diamond with fill #E4E0FB and a 3 px #6C5CE7 border, one
> line: "score ≥ boundary?". This is the emphasized decision point.
>
> The diamond has two outgoing arrows that split left and right into two
> outcome boxes placed side by side:
>
> - Left outcome, arrow labeled "yes (well-structured)", box with fill #E8F5E9
>   and border #2E7D32, two lines: "PRESERVE" and "keep the existing package
>   boundary"
> - Right outcome, arrow labeled "no (poorly structured)", box with fill #FDF3DC
>   and border #D9A441, three lines: "RECONSTRUCT", "seeded community detection",
>   "over the region's weighted edges"
>
> Both outcome boxes, and the "Apply user action" box on the left, converge with
> arrows into a single box with fill #F2F2F2 and border #7A7A7A, two lines:
> "Group nodes + decision record" and "score · action · automatic action ·
> confidence".
>
> From that box, one arrow points down to a stadium shape with fill #EEEEFB and
> border #6C5CE7, labeled "To hierarchy builder".
>
> Do not draw a loop-back arrow for "more regions"; the "For each region" label
> at the top already carries the iteration, and omitting the loop keeps the
> figure compact.

**Caption (Fig. 4):**
`Fig. 4.  The per-region preserve-versus-reconstruct decision, including the user override path. Both the applied action and the automatically computed action are recorded.`

---

## Figure 5: The multi-level hierarchy

**Purpose.** Shows the shape of the output and the level numbering, and that
class and function members hang under their defining file.

**Prompt:**

> [House style]
>
> Target aspect ratio 3:2, landscape. A clean four-level tree drawn top to
> bottom with straight orthogonal connector lines and even horizontal spacing.
> Use one color per level so the tiers read at a glance.
>
> - **Level 0**, one box centered at the top: fill #6C5CE7 with white text,
>   border #4A3FBF, labeled "Repository (level 0)".
> - **Level 1**, two boxes: fill #DDE3F7 with border #4A6FBF, both labeled
>   "Level 1 group".
> - **Level 2**, three boxes: fill #DDE3F7 with border #4A6FBF, all labeled
>   "Level 2 group". The first Level 1 group has two Level 2 children; the
>   second Level 1 group has one.
> - **Level 3**, four boxes: fill #E8F5E9 with border #2E7D32, all labeled
>   "File.java". The first Level 2 group has two file children; the other two
>   Level 2 groups have one each.
> - **Level 4**, three boxes: fill #FFF1DC with border #E08A2E, all labeled
>   "method()". The first file has two method children, the third file has one,
>   and the remaining files have none.
>
> Down the left edge of the canvas, outside the tree, add four small right-
> aligned tier labels in #7A7A7A at the smaller text size, each vertically
> aligned with its row: "groups", "groups", "files", "members". Do not label the
> repository row.
>
> Keep the tree horizontally balanced and avoid crossing connectors.

**Caption (Fig. 5):**
`Fig. 5.  The multi-level hierarchy: repository, level 1 groups, level 2 groups, files, and the functions defined in each file.`

---

## Figure 6: The contract data model

**Purpose.** The stable seam. Note this must include the region provenance
fields on the hierarchy node and the decision, and the resolved configuration on
the audit record, all of which the v1 diagram predates. Watch for the "many"
multiplicity label; the v1 version rendered it as "manv".

**Prompt:**

> [House style]
>
> Target aspect ratio 4:3, landscape. A UML-style class diagram with five
> entity boxes in two columns. Each entity box is a rectangle with fill #EEEEFB
> and border #6C5CE7, divided by a horizontal rule into a bold title band at the
> top and a left-aligned field list below. Field lines are at the smaller text
> size. Do not draw an empty method compartment.
>
> **Left column, top to bottom, two boxes:**
>
> Box titled "GraphNode", fields:
> `+ string id` / `+ NodeKind kind` / `+ string packagePath` /
> `+ string directoryPath` / `+ string definedInFile`
>
> Box titled "DependencyEdge", fields:
> `+ string source` / `+ string target` / `+ number importFrequency` /
> `+ number methodCallFrequency` / `+ number sharedTypeCount` /
> `+ number strength`
>
> Connect GraphNode down to DependencyEdge with a solid line, arrowhead at the
> DependencyEdge end, labeled "participates in" on a white plate, with a small
> "1" at the GraphNode end and "many" at the DependencyEdge end. Spell "many" in
> full.
>
> **Right column, top to bottom, three boxes:**
>
> Box titled "HierarchyNode", fields:
> `+ string id` / `+ NodeKind kind` / `+ int level` / `+ string parentId` /
> `+ string[] childIds` / `+ string regionId` / `+ int ordinal`
>
> Box titled "RegionDecision", fields:
> `+ string regionId` / `+ number cohesion` / `+ number coupling` /
> `+ number score` / `+ Action action` / `+ Action automaticAction` /
> `+ boolean userOverridden` / `+ number decisionConfidence` /
> `+ string[] groupIds`
>
> Box titled "RunConfiguration", fields:
> `+ number structuralQualityBoundary` / `+ MetricWeights metricWeights` /
> `+ number cohesionSquashConstant` / `+ number degenerateScore` /
> `+ number communityDetectionSeed` / `+ int maxGroupSize` /
> `+ Map overrides`
>
> Give the HierarchyNode box a self-referential loop on its right side, drawn as
> a rounded arrow leaving and re-entering the same box, labeled "contains", with
> "1" at the source end and "many" at the target end.
>
> Draw a solid line from RegionDecision to HierarchyNode with an arrowhead at
> the HierarchyNode end, labeled "names its groups".
>
> Draw a solid line from RunConfiguration to RegionDecision with an arrowhead at
> the RegionDecision end, labeled "reproduces".
>
> Finally, in the empty area at the upper left, place a small note box with fill
> #FDF3DC and border #D9A441 containing the single line "The stable contract:
> one shape, many consumers". Connect it to the GraphNode box with a dashed
> #7A7A7A line and no arrowhead.

**Caption (Fig. 6):**
`Fig. 6.  The contract data model. The node and edge types are the parser's output, the hierarchy node is the grouping layer's output, and the audit record carries the scores, decisions, and resolved configuration.`

---

## Figure 7: Blast radius as reverse reachability

**Purpose.** Shows that a query returns the transitive dependents of a target
plus the groups containing them, and that impact crosses group boundaries.

**Prompt:**

> [House style]
>
> Target aspect ratio 16:9, landscape. Three group containers holding file
> boxes, with dependency arrows pointing from dependent to dependency, and one
> query callout.
>
> Draw three containers, each with fill #FAFAFA and a dashed #C6C9CE border, and
> a small heading in the top-left corner inside the container. Arrange them so
> Group A is upper right, Group B is left of center, and Group C is lower right.
>
> - Container "Group A" holds two boxes stacked vertically:
>   - "User.java", the query target: fill #FDE7E9, border #C5303E at 2.5 px
>   - "UserService.java", impacted: fill #FFF1DC, border #E08A2E
> - Container "Group B" holds one box: "Account.java", impacted: fill #FFF1DC,
>   border #E08A2E
> - Container "Group C" holds one box: "Main.java", impacted: fill #FFF1DC,
>   border #E08A2E
>
> Dependency arrows, each solid with an arrowhead at the target end and the
> label "depends on" on a white plate:
>
> - from "UserService.java" up to "User.java"
> - from "Account.java" across to "User.java"
> - from "Main.java" up to "UserService.java"
>
> In the empty space at center-left, a callout box with fill #EEEEFB and border
> #6C5CE7, two lines: "Query: blast radius of" and "User.java". Draw a dashed
> #7A7A7A arrow from this callout to "User.java".
>
> Add a compact legend in the lower-left corner, drawn as three small color
> swatches with labels at the smaller text size: a #FDE7E9 swatch with border
> #C5303E labeled "target", a #FFF1DC swatch with border #E08A2E labeled
> "impacted", and a #FAFAFA swatch with a dashed #C6C9CE border labeled
> "containing group". This is the one figure that gets a legend, because the
> color coding carries the result.

**Caption (Fig. 7):**
`Fig. 7.  Blast radius as reverse reachability. The target and all its transitive dependents are returned, along with the groups that contain them.`

---

## Figure 8: Boundary sensitivity (plot, not generated)

**Purpose.** The empirical core of the calibration argument: how sharply
navigability responds to where the preserve-versus-reconstruct line is drawn.

**Do not generate this image.** It is a data plot and must be produced from
measured output. Generating it would fabricate a result.

**Plotting specification:**

- X axis: the structural quality boundary, swept across its range, labeled
  "Structural quality boundary".
- Y axis, left: a navigation metric, for example mean expansion steps to locate
  a file, labeled with the metric name and its unit.
- Y axis, right (optional second series): fraction of regions preserved,
  0 to 1.
- One line per evaluation repository, distinguished by both color and marker
  shape so the plot survives grayscale printing. Label each line directly at its
  right end rather than using a separate legend box, if space allows.
- A vertical dashed rule at the calibrated operating boundary, annotated
  "calibrated operating point".
- Match the paper's typography: sans-serif labels, no chart junk, no background
  fill, no gridline heavier than a light grey hairline.
- Render at the same width as the other figures, 3.30 in placed, target ratio
  4:3.

The point the figure must make is whether a broad plateau exists around the
chosen boundary, meaning the operating point is not delicate, or whether the
transition is sharp, meaning the boundary must be chosen and reported with care.

**Caption (Fig. 8):**
`Fig. 8.  Sensitivity of navigation cost to the structural quality boundary. Each line is one repository; the dashed vertical rule marks the calibrated operating point. Because every region's score is recorded, the sweep is computed from the audit record without re-running assessment.`

---

## Checklist before dropping figures into the paper

- [ ] All eight figures generated with the same House Style block, so fills,
      borders, arrowheads, and type sizes match across the set.
- [ ] Every label reproduced exactly as specified. Check Figure 6 for "many",
      which a generator is prone to render as "manv".
- [ ] No figure names a UI framework, a product, or a language binding beyond
      what the prompt specifies. Figure 2 says "Semantic-zoom viewer", never a
      framework name.
- [ ] Each figure fits its target ratio. Regenerate rather than scale down
      anything that comes back much taller, since scaling makes labels
      unreadable at print size.
- [ ] Text legible at the placed width. Print one page at 100 percent and read
      the smallest label before committing to the set.
- [ ] Captions kept exactly as given, positioned below each figure, numbered in
      order of first mention.
