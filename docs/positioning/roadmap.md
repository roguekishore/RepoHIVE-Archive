# Roadmap — RepoHIVE

> Always-on context. Everything below is **deferred, not forgotten.** Each item has a seam so it plugs
> in without engine rework. Sequencing is the owner's call — don't start a Later item unprompted, and
> don't refuse one on the grounds that it is "out of scope."

## Where the product is

The **engine is the finished part**: parser → `graph.json` → adaptive grouping → `index/`, plus blast
radius, verified deterministic and audited against a gap register. The viewer renders semantic-zoom
navigation, the flat baseline, and the decision audit over real fixtures.

What is missing is not capability, it is **reach**: the engine is driven by `npm run` scripts, so nobody
outside this workspace can use it. That is the honest current gap.

## Now — make the engine reachable and trustworthy

| Item | Why it matters | Seam it uses |
|------|----------------|--------------|
| **Packaged CLI** | The engine already works; without a CLI it cannot leave this repo. Every other surface wraps it. | `packages/cli` over the existing engine entry points |
| **Group naming** | Groups currently read as structural labels; names are what make navigation feel human. Full design in `docs/group-naming.md` (Tier-1 structural → server-side labels → optional semantic sidecar keyed by `g_<hash>`). | Label field on group nodes; naming never affects membership |
| **Viewer surface completion** | A surface goes live only when our own engine produces its data. | Route handlers over `index/` |
| **Real-repo validation** | More mature multi-module repos through the pipeline; the adaptive branch needs varied evidence. | `fixtures/` |

## Next — distribution surfaces (all thin wrappers, zero engine change)

| Item | Seam / how it plugs in |
|------|------------------------|
| **Skill packaging** | `install` drops a SKILL.md into an assistant's config; rides entirely on the CLI + self-describing JSON. Cheapest high-reach surface. |
| **MCP server** | Reads `index/` JSON; exposes query_graph / get_node / get_neighbors / shortest_path / blast_radius. |
| **Incremental / watch mode, parallel parse, caching** | Wrap `parse`; content-hash per file. Performance and UX, not novelty — but it is what makes the tool usable day to day. |
| **VS Code extension** | Wraps the CLI + viewer. Do this last; it is the most surface area for the least new capability. |

## Later — needs a real decision before starting

| Item | What it actually requires | Seam |
|------|---------------------------|------|
| **Semantic layer (embeddings)** | A model choice and an honesty boundary. Search and cluster naming only. **Never grouping** — that would break determinism, which is the whole contribution. | Layer reads the hierarchy; does not write membership |
| **Graph-native storage** | Only pays off well past thousands-of-files, or for a hosted multi-repo service. | Storage interface behind the algorithm |
| **Hosted service** | **Auth is a hard prerequisite.** Today's viewer route handlers are unauthenticated and localhost-only; exposing them as-is would leak indexed source structure. | Service wraps the engine |
| **Telemetry** | Opt-in, anonymous, separate from the engine. | Ecosystem-only |
| **Multi-language parsing** | Each language needs its own resolution rules; Java's explicit imports are the easy case. The parser data model is already general. | New parser per grammar, same contract |
| **Architectural drift detection** | Needs a stable hierarchy first (now true). Compares `index/` over time. | Reads `index/` snapshots |

## How room is protected (the 3 principles)

1. **The JSON contract is the universal seam** — any consumer plugs in through it.
2. **Interfaces over implementations** — new capability is a new implementation behind an existing
   interface (`CommunityDetector`, storage), never a rewrite.
3. **Engine vs ecosystem split** — optional features layer outside the pure local engine.

These three are why the deferred list is safe to defer: none of it requires going back and changing the
algorithm.

## The one rule that does not move

Grouping is decided by **structure only**, deterministically. Every other part of the product is open to
change, growth, or replacement. That one property is the thing worth protecting.
