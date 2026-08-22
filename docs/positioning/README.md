# docs/positioning — NOT AGENT CONTEXT

> **Do not load these files as project context. Do not use them to decide what to build.**
>
> This folder holds audience-facing narrative: vision, comparisons to other tools, roadmap framing, and
> performance claims. It is aspirational and rhetorical by design. Read as specification, it produces
> wrong inferences — it will make an agent refuse work as "out of scope," treat honest presentation
> caveats as engineering limits, and describe the project as something it is not.

## What is authoritative instead

| For | Read |
|-----|------|
| What the system is and how it fits together | `.kiro/steering/architecture.md` |
| Libraries, versions, commands | `.kiro/steering/stack.md` |
| Rules that must hold | `.kiro/steering/conventions.md` |
| How to prove a change is good | `.kiro/steering/verification.md` |
| Current status, measured numbers, next actions | `.kiro/PROJECT_STATE.md` |
| Why things are the way they are | `.kiro/DECISIONS.md` |

## Contents

| File | What it is |
|------|------------|
| `product-vision.md` | Problem framing, target users, positioning claims and their caveats |
| `competitive-landscape.md` | Analysis of Graphify and Sourcegraph; where this project does and does not compete |
| `roadmap.md` | Narrative sequencing of possible future work, with the seams each would use |
| `performance-claims.md` | How to state performance honestly; estimate tables vs measured numbers |

## When to load one

Only when the user explicitly asks for that kind of work: writing a pitch, a landing page, a README
positioning section, a comparison, or claim wording. Load the single relevant file, do the writing, and
do not carry its framing into subsequent engineering work.

One thing here is a real engineering constraint and it lives in `conventions.md` too, so it is never
missed: **nothing non-deterministic may decide group membership.**
