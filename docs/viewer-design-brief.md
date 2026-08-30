# Viewer design brief — review build, phase 2

Written 2026-08-29, **rewritten 2026-08-30** after reading what was actually built. Branch `fable-work-new`.

Companion documents: `docs/viewer-handoff.md` (§ 2 data shapes, § 3 traps, § 8 constraints, § 10 design
authority — all still valid). `.kiro/BRAIN.md` entry `2026-08-29 22:29` records the first implementation slice
in the builder's own words.

---

## 0. Correcting the record — the first slice was good

An earlier version of this brief claimed the first build had two charting bugs. **Both claims were wrong and
are withdrawn:**

- ~~"the scatter plots raw unbounded cohesion"~~ — **it already plots normalised space** (squashed cohesion ×
  independence), which is exactly where the decision rule is a straight line.
- ~~"the dashed boundary diagonal is wrong"~~ — **it is correct** in that space.

What was actually delivered, and should not be redone: the boundary strip with a real draggable
`<input type=range>` and counterfactual flips computed from recorded scores only · the normalised scatter with
**shape + colour dual encoding** so the distinction is never colour-only · a provenance card rendering recorded
values via `String(v)` with derived rows marked `≈` **and a call-out when the degenerate rule fired** · the
authored-vs-derived **morph** with deterministic layout and a rAF tween honouring `prefers-reduced-motion` ·
an honest landing page · selection and boundary held in the URL via `nuqs` · 19 dead redirect shells culled ·
a `ui/src/repohive/` namespace for our own components.

**The information design is largely right. Data honesty is largely right.** That is why this phase is about
identity, structure, and coverage — not correction.

The builder's own closing assessment: *"the current work is craft-clean but the Awwwards-bar identity (§10) is
genuinely not yet attempted."* That is the honest diagnosis and this document takes it at face value.

---

## 1. The three real gaps

### Gap 1 — one page is carrying five visualisations

Commit `b47289d` put the config panel, boundary strip, scatter, provenance card, morph **and** audit table into
`app/repos/[id]/decision-audit/page.tsx` — now **403 lines**, a single vertical scroll.

That is the main reason the surface reads as dense and unremarkable, and **no amount of restyling fixes it.**
Five dense visualisations in one scroll have no hierarchy between them, and a judge sees a wall rather than an
argument.

**Split it.** Proposed structure — three new surfaces, one existing page divided:

| # | Surface | Status | Holds |
|---|---------|--------|-------|
| 1 | **Overview** | new | verdict header, three-way split, scale numbers, what this repo is. The first fifteen seconds |
| 2 | **Structure map** | exists | zoom canvas, plus radial hierarchy as a second view |
| 3 | **Decisions** | exists, **slimmed** | boundary strip + scatter + audit table + provenance as a drawer |
| 4 | **Before / After** | new | the morph, given its own room |
| 5 | **Adaptivity** | new, cross-repo | vantage vs broadleaf vs jsoup, assessed-only |
| 6 | **Flat baseline** | exists | the unstructured "before" |
| 7 | *Architecture* | optional | DSM, coupling ring, per-level flow |

Six distinct demo beats instead of one overloaded page. The morph in particular is the signature moment and is
currently buried below a scatter.

### Gap 2 — a sentence on the page is false

`decision-audit/page.tsx:242` reads:

> "Every region was measured and its boundary either preserved or reconstructed."

**It was not.** Regions that hit the degenerate rule in `core/src/assessor.ts` — fewer than 2 nodes, or zero
internal edges, or zero intra-region strength — are assigned `degenerateScore = 0.0` **by rule** and
reconstructed by default, without ever being assessed.

Measured:

| | broadleaf | vantage | jsoup (demo fixture) |
|---|---:|---:|---:|
| Total regions | 502 | 20 | 8 |
| **Degenerate** — score 0 by rule | **216 (43%)** | 3 (15%) | **not verified** |
| Genuinely assessed | 286 | 17 | — |
| — preserved | 38 | 10 | 3 (of 8 total) |
| — reconstructed on measurement | 248 | 7 | 5 (of 8 total) |

**`fixtures/jsoup` is git-ignored and absent from this machine, so its degenerate count is unmeasured.**
Re-index it and check before quoting any jsoup split.

Detect them with `score === 0 && cohesion === 0`. There is no explicit flag. On broadleaf, 203 of the 216 also
have `coupling === 1`.

**What needs fixing:** the provenance card already handles the individual case. The page-level framing does not.
`ActionPill` is strictly binary (`action: "preserve" | "reconstruct"`), so every count, pill and category on the
page merges "measured as low quality" with "too small to measure."

Three consequences:

1. **Rewrite that sentence.** It is the one claim on the page a judge could falsify from the data.
2. **Every count becomes three-way.** Degenerate is a first-class outcome rendered as *absent data* —
   desaturated, neutral — never a third opinion.
3. **Degenerate regions never flip as the boundary moves** (they score 0 by rule), so exclude them from the
   counterfactual flip set and say so.

**Told correctly this is the product's strongest argument.** On assessed regions only, vantage preserves
**10 of 17 (59%)** and broadleaf preserves **38 of 286 (13%)**. Same algorithm, same seed, different
repositories, different answers. The misleading version invites "so it just always reconstructs?"; the honest
version answers it. That is Gap 3's Adaptivity surface.

### Gap 3 — the showcase surfaces that do not exist yet

Still open, per the builder's own list: **DSM over groups**, **coupling ring**, **hierarchy-at-scale**,
**per-level flow**, **partition-disagreement metric**, **determinism panel**, and the **Adaptivity
comparison**. Plus the per-leaf size engine field that would unlock treemaps.

For a judge demo the highest-value additions are **Adaptivity** (§ 4.2) and **hierarchy-at-scale** (§ 4.3).

---

## 2. Visual identity — the part never attempted

Establish this first, then build. "Make it good" already failed once.

### Palette

**Dark-first.** The current cream/olive ground reads accidental. A structural-analysis tool wants a dark,
low-chroma field so the *data* carries the only saturated colour on screen.

| Role | Guidance |
|------|----------|
| Ground | near-black, slightly cool. Not pure `#000` |
| Surface | one or two steps up, separated by value rather than borders |
| **Preserve** | one confident, affirmative hue — "the author was right" |
| **Reconstruct** | clearly distinct and **not a warning colour.** It currently uses `--color-warning`, which frames the engine's most common decision as a problem. Reconstruction is a success |
| **Degenerate** | desaturated neutral. Must read as missing data |
| Text | exactly three steps: primary, secondary, tertiary |

Dual encoding is already in place (filled circle / hollow diamond) — **keep it and extend it to three states.**

### Typography

One family plus a mono for ids, scores and paths. **Tabular numerals wherever numbers align** — scores and
counts in proportional digits look broken in a table. A real scale of five or six steps with deliberate jumps.
Long identifiers (`g_002c619ae75eab…`, `pkg:com.backend.springapp.store`) **middle-elide**; the distinguishing
characters are at the end.

### Density

502 regions, 29,190 nodes, 14,325 edges on broadleaf. Aggregate before plotting — a 502-point strip is a
*binned distribution*, not 502 marks. Scale axes to the data rather than to `[0,1]` for tidiness. Jitter or bin
where points collide. State a render budget and show a visible note when a view truncates. Offer "marginal
decisions near the boundary" as a first-class view, not only "all".

### Motion

Motion explains state change; it never decorates. The morph is the one animation that must be genuinely
beautiful. Everything else is a 150 ms ease. `prefers-reduced-motion` is already honoured — keep that.

### Chrome

The sidebar wordmark and footer still say **`repowise`**, including "Help us improve Repowise". Page titles were
already corrected to RepoHIVE in `7497d87`; the chrome was not. Attribution belongs in `NOTICE`, which is where
the AGPL obligation is satisfied — not in the running UI.

---

## 3. Surfaces to build

### 3.1 Overview — new, and it is the first fifteen seconds

Verdict header with the three-way split, scale numbers (files, nodes, edges, regions, depth), and one plain
sentence on what the engine decided and why. The landing page is already honest about absent fixtures; this is
the per-repo equivalent.

### 3.2 Adaptivity — new, the strongest single argument

Two or three fixtures side by side, **assessed regions only**: vantage 59% preserve, broadleaf 13% preserve.
Same algorithm, same configuration, same seed. This is the most direct evidence that the engine adapts rather
than always doing one thing, and nothing in the build shows it.

Cross-repo, so it cannot be a repo-scoped route. Data: each fixture's `metadata.json`.

### 3.3 Hierarchy at scale — new

29,190 nodes, depth 6, 502 regions in one legible image. Radial icicle or sunburst coloured by decision state.
Judges respond to seeing scale handled. Data: `hierarchy.json` tree plus `perLevel[]` for the level bands.

### 3.4 Before / After — existing morph, promoted

Give the morph its own surface with room to breathe, a region picker, and a legend that explains what the two
partitions mean. It is the one view that explains the project without words.

### 3.5 Decisions — slimmed

Boundary strip, scatter, audit table, provenance as a drawer rather than a stacked panel. Three-way categories
throughout. The corrected description sentence.

### 3.6 Supporting, if time allows

DSM over groups from `crossGroupEdges`, reordered to reveal block structure · edge-bundling coupling ring ·
per-level flow from `perLevel[]` (5 rows, chart-ready) · determinism panel showing content-addressed group ids ·
group purity, showing which authored packages contributed members to each reconstructed group.

---

## 4. Non-negotiable

Unchanged from `docs/viewer-handoff.md` § 8. Restated because Gap 2 shows how a true-sounding sentence breached
the first one:

1. **Never display a number the engine did not record, and never present a rule-assigned value as a
   measurement.** If a design needs a metric absent from `index/`, request an additive engine field rather than
   deriving it client-side. The only sanctioned client arithmetic is the engine's own recorded formula and the
   boundary comparison.
2. **Deterministic layout** — seeded, stable, ties broken on id, so screenshots and paper figures reproduce.
3. **Accessibility is part of the bar.** Three states never colour-only; keyboard navigable; real focus states.
4. **Engine packages (`parser`, `core`, `shared`) are not modified.** New shared components go in
   `packages/ui/src/repohive/`, surface-specific ones in `packages/web/src/components/<surface>/`. Never inside
   vendored folders.

---

## 5. Test and fixture reality

From the first slice, so it is not rediscovered:

- **web 27/27 green.** `route-links` guard pins the surviving stub set `{c4, zoom}`; the breadcrumb test tracks
  the "Structure map" label.
- **ui:** 13 new model tests green. **37 pre-existing failures** in vendored `c4` / `docs-tree` / `theme` suites
  are unchanged — verified identical with changes stashed. The ui `gates` script fails on two **pre-existing**
  vendored hits (`refactoring/plan-before.tsx` hex-in-comment, `plan-rows.tsx` HTML-entity false positive). Not
  introduced, not to be fixed here.
- **`fixtures/jsoup` and `fixtures/jsoup-src` are git-ignored and absent from this machine.** 95 files,
  8 regions, preserve 3 / reconstruct 5, with `helper` at 0.478 — 0.022 under the boundary, which is the slider
  demonstration. **Re-index before demoing**, and measure its degenerate count.
- `fixtures/sample-java-project` has a stale `index/` predating region provenance.
