# docs/academic — NOT AGENT CONTEXT

> **Do not load these files as project context. Do not use them to decide what to build.**
>
> This folder holds coursework and publication deliverables: review handouts, demo guides, the diary,
> the research log, and the paper drafts. They are written for examiners and reviewers, organised around
> submission deadlines. Read as specification, they make an agent treat the project as a fixed-scope
> academic exercise and cap engineering work at whatever the next deadline needs.

## What is authoritative instead

`.kiro/steering/` for how the system works and what rules hold, `.kiro/PROJECT_STATE.md` for current
status, `.kiro/DECISIONS.md` for why. See `.kiro/steering/memory.md`.

## Contents

| Path | What it is |
|------|------------|
| `ACADEMIC_TRACK.md` | The obligations themselves: review status, rubric, paper requirements. Start here if the user asks for academic work. |
| `0th/` … `3rd/` | Per-review handouts and demo guides |
| `review-1-kickoff.md` | Historical kickoff brief |
| `research-log.md` | Research decisions and results that feed the paper. **Approval-gated — never write to it without explicit approval.** |
| `project-diary.md` | Reviewer-facing weekly implementation log. Date ranges are owner-fixated placeholders; never invent calendar dates. |
| `paper/` | Journal paper drafts, figure prompts, figure data, paper hand-off |

The reference papers stay at `docs/reference/papers/` since they are shared source material.

## When to load

Only when the user explicitly asks for a deck, a handout, the diary, the research log, or the paper.
Load `ACADEMIC_TRACK.md` first for the obligations, then the specific artifact.

Any claim written here must match what `.kiro/PROJECT_STATE.md` records as actually measured. Estimates
must be labelled as estimates. Never fabricate progress, dates, or results.

`2nd/review-2-demo-guide.md` is **stale** — it predates the parser hardening work and references a
synthetic fixture that no longer exists.
