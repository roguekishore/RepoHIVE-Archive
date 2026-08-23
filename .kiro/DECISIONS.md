# Decisions

Append-only, newest first. One entry per decision that constrains future work: what was decided, why,
and what it now constrains.

**Never edit or delete an entry.** If a decision is reversed, add a new entry that says so and names the
entry it supersedes. This file exists so settled questions are not relitigated and not accidentally
undone.

---

## 2026-08-23 — Steering's tool lists are extensible, not boundaries

**Decided.** The lists in `steering/stack.md` are **not hard boundaries**. New tools and dependencies may be
added when the work genuinely demands it.

**Why.** Owner ruling, given while approving Vite for the CLI artifact: "It is not a strict boundary for the
items specified in the stack. New items can be added if our work demands it." The blanket
"do not reintroduce Vite" line had been read — by me — as a prohibition, when its actual purpose was narrower.

**Constrains.**

1. **Read "not used, do not reintroduce" as "do not swap out a working choice for this without a decision,"
   not as "never introduce anything new."** The genuine constraint it protects is that `packages/web` must
   stay on Next.js, because the vendored packages require it.
2. **Any addition still gets recorded**: a `DECISIONS.md` entry plus the `stack.md` update in the same change.
3. **Licence compatibility with AGPL-3.0-or-later remains a hard rule** and is not relaxed by this.
4. `stack.md` amended in this change to say all of the above, and to narrow the Vite line rather than leave a
   rule that contradicted an approved decision.

## 2026-08-23 — The CLI requirements spec is unblocked: surface, names, version and bundler locked

**Decided.** The four items that blocked the CLI requirements spec are closed.

- **Command surface.** `index` / `parse` / `group` / `view`, one binary dispatching on the first argument.
  `describe` is **deferred** — a good idea, implemented later, not part of the first spec.
- **Command names finalized as those four.** No renaming.
- **Install guidance:** recommend `npm i -g repohive` in the README, giving `repohive index .`; offer
  `npx repohive index .` as the no-install alternative. (`npm repohive index` is not valid syntax and must not
  appear in any documentation.)
- **Version: release at `0.x`.** Taken as **lockstep `0.1.0`** — all four packages share one number and move
  together — since that was the recommendation being agreed to. **Flagged back to the owner for explicit
  confirmation;** if independent versioning was meant instead, this entry needs a successor.
- **Bundler: Vite** with `vite-plugin-singlefile` for the single-file viewer artifact. Verified 2026-08-23:
  version 2.3.3, MIT, one dependency, supports Vite 5–8, and its stated purpose is inlining all JS and CSS.
  `tsup` or esbuild remains the pick for bundling the CLI itself, if that is ever done.

**Constrains.**

1. **These four are now part of the published contract** and sit alongside the `.repohive/` layout, the flag
   names, the `--json` shape and the exit codes. Changing any of them after the first publish is a major
   version and a broken build for anyone scripting against it.
2. **Write the requirements spec before any CLI code** (2026-08-22 constraint 3 still stands), and do the Node
   test-script fix before the extraction (constraint 4).
3. **Define the orchestration function's signature before either the CLI or hosted worktree writes
   orchestration code.** One small file. Both will call it, and two independent versions would be an
   unresolvable merge. This is the one sequencing item left inside a parallel plan.
4. **`repohive index` on a mature repo is ~80 s, not ~20 s** (broadleaf: `parse` 68.3 s + `group` 11.3 s,
   measured 2026-08-22). Do not quote 20 s. The sweep arithmetic that justifies keeping `group` separately
   callable is about avoiding **20 redundant parses**, not about `group` being slow — `group` is the fast half.

## 2026-08-23 — Repo posture: `fable-work` is the default branch, no merge, git plans out of scope

**Decided.** `fable-work` is treated as the default branch. **No merge to `main` will happen.** Branch
placement of memory and doc commits is not a concern for now, and the git/replay plans are outside the scope
of workstream planning.

**Constrains.**

1. **Stop flagging that memory and doc changes "belong on `main`".** `conventions.md` says so, but the owner
   has set that aside; `fable-work` is where work lands. Do not raise it each turn.
2. **Remove the `fable-work` merge review from any next-up list.** It is not pending; it is not happening.
3. **Do not surface the replay or the archive-repo visibility as workstream blockers.** Both stay recorded —
   the archive repo is a live exposure of the gap and fix registers and that fact must not be deleted from
   the record — but neither is to be raised as part of path planning. Owner-owned, deliberately out of scope.
4. Two register items are **deferred pending an explicit owner call**, not resolved: the systematic
   steering-drift audit, and which copy of the duplicated `gaps` / `fixes` / `edge-case-audit` registers wins.
   Do not act on either without being asked. **Nothing may be deleted** in the duplicate-register case.

## 2026-08-23 — CLI distribution: output directory and packaging shape locked

**Decided.**

- **Output directory is `.repohive/`**, with `--out` to override.
- **Packaging shape: publish four packages** — `@repohive/shared`, `@repohive/parser`, `@repohive/core` as
  libraries, plus `repohive` as the CLI — with **the CLI depending on the three rather than bundling them**
  (~15 MB installed, measured). Bundling to ~3 MB is a later optimization.

**Why.** `.repohive/` matches the `.next` / `.turbo` convention, stays out of the way, and is
gitignore-friendly; discoverability comes from printing the absolute path on completion rather than from the
folder being visible. On packaging: the three engine packages must be published as libraries regardless,
because the MCP server and the hosted service import `core` directly and must not shell out to a CLI. Since
bundling does not change what a user types, it can be applied later without a visible change.

**Constrains.**

1. **The `.wasm` files can never be bundled into JavaScript.** Any future bundled CLI must still ship
   `web-tree-sitter.wasm` and `tree-sitter-java.wasm` as real files and locate them via `GrammarOptions` —
   the escape hatch that already exists in `ast-extractor.ts` for exactly this.
2. **`.repohive/` and everything in it is a published contract from the first release.** So are the command
   names, the flag names, the `--json` shape and the exit codes. See the seam entry below: internal seams are
   cheap to change later, this surface is not.
3. **Still open and blocking the CLI requirements spec:** the full four-command shape (only `index` as
   primary is accepted so far), final command names, version policy, and the bundler. Recommendations are
   recorded in `.kiro/workstreams.md`; none is decided.

## 2026-08-23 — The academic deadline is live; all workstreams run in parallel worktrees

**Decided.**

- **An academic deadline is in play.** The viewer is already implemented, so **polishing it with a few more
  relevant components is sufficient** for that deliverable. Which components is a separate conversation,
  deliberately deferred until the CLI and seam questions are settled.
- **Every workstream runs in parallel, in its own worktree** — viewer, CLI, seams, and the rest.

**Why.** Owner's call on both. The parallel decision resolves the sequencing question that had been open
since 2026-08-22: it is no longer "which path first" but "all of them, concurrently."

**Constrains.**

1. **The sequencing question is closed.** Do not re-propose an ordering. The 2026-08-22 "CLI next" entry
   remains correct about the CLI being built; it is simply no longer exclusive.
2. **Do not start the viewer-component brainstorm.** The owner has explicitly parked it. Path 1 of the
   register stays as reference until then.
3. **Orchestration is now contested between worktrees, and that is the live parallelism risk.** Both the CLI
   and the hosted path need a parse→group layer. If each worktree builds its own, the result is two
   incompatible implementations and an unresolvable merge. **Mitigation: define the orchestration package's
   interface first** — one file of type signatures, a couple of hours — so both worktrees code against it
   while the seam worktree supplies the implementation. Do this before either worktree writes orchestration
   code.
4. **Memory files serialize across worktrees.** `DECISIONS.md` is append-only newest-first and
   `PROJECT_STATE.md` is rewritten in place, so parallel agents must land memory one at a time. This is now a
   practical constraint rather than a theoretical one.

## 2026-08-23 — Internal seams are retrofittable; the published CLI surface is not

**Decided (analysis accepted as the basis for sequencing, and it is why seam work does not block the CLI).**
Of the four foundation seams, **only orchestration is a CLI prerequisite**, and the CLI naturally contains it:

| Seam | CLI needs it? |
|------|---------------|
| Orchestration (parse → group in one call) | **Yes** — `repohive index` *is* this layer |
| Source provider (parse a non-directory source) | No — the CLI always has a real directory |
| Storage interface (read/write off the filesystem) | No — the CLI writes to disk |
| Content-addressed snapshot ids | Partly — enables `index` skipping an unchanged parse; essential only for hosting |

**Why retrofitting is safe.** Adding an interface behind an existing function is backwards-compatible when the
default is preserved, and this is already the house pattern: `parseProject(options, deps = defaultDeps())`
and `IndexSerializerDeps` both inject their filesystem dependencies with a real-fs default, leaving existing
callers untouched. The source provider and the storage interface can be added the same way, later, without
breaking the CLI.

**Constrains.**

1. **Do not block the CLI on seam work.** Block it on the artifact layout and the CLI contract instead.
2. **These are expensive-to-change and must be right before the first publish:** the on-disk layout of
   `.repohive/`, command names, flag names, the `--json` output shape, and exit codes. Once anyone writes CI
   around `repohive index --json`, changing them is a major version and a broken build for them.
3. **The seam design still gets a proper spec**, written in the seam worktree, concurrently with CLI work —
   the owner asked for a careful, storage- and source-agnostic analysis, and that is a spec deliverable rather
   than an improvised decision.

## 2026-08-23 — The CLI's shipped viewer is the hierarchical viewer only

**Decided.** The only viewer surface the CLI artifact must carry is the **hierarchical (semantic-zoom)
viewer**. Flat baseline, decision audit and anything else are bonus, admissible only if they do not make the
package heavy.

**Why.** Owner's call on scope. It is also strongly supported by measurement taken the same day:
`packages/ui/src/zoom` is 20 files / 116 KB and its **only** bare-specifier imports are `react` and two
constants from `@repohive/types/health`. The chrome around it (`web/src/components/zoom`, 6 files / 31.5 KB)
adds only `lucide-react` (tree-shakes to a few icons), `next/link` (replaceable with `<a>`) and `sonner`
(droppable). No Next.js, sigma, recharts, d3, elkjs or mermaid — the canvas paints itself.

**Constrains.**

1. **Do not static-export the Next.js app for the CLI.** The previously proposed "Stage 2 = `output:
   "export"` of the vendored app" is **withdrawn**. Build a purpose-made single-page artifact instead:
   React + `ZoomCanvas` + the `ZoomMap` inlined. Estimated 300–500 KB as one self-contained `.html`.
2. **Stages 2 and 3 of the viewer plan collapse into one.** The single-file HTML is the target, not a
   later bonus.
3. **Retracts the 18:25 claim that Path 1's subtractive pass is upstream of the CLI's shippable viewer.**
   That held only while the CLI was to ship the whole vendored app. It is not. The 26 dead and 22 redirect
   pages are irrelevant to the CLI, and Path 1 returns to being purely about the demo surface. The
   component-weight advice in Path 1 (a donut costs `recharts`, the DSM is free) still applies to the
   *demo*, not to the CLI.
4. **A bundler for the CLI artifact is an open decision, not an assumption.** `steering/stack.md` lists
   Vite under "not used, do not reintroduce" because Next.js is required by the vendored packages. That rule
   governs the viewer app; a small separate bundler for the CLI artifact is a different thing but is still a
   reintroduction, so it needs an explicit decision. `esbuild` is already present transitively.
5. The three real surfaces in `packages/web` are unaffected. This decision is about what the **CLI ships**,
   not about what the local dev viewer contains.

## 2026-08-23 — Everything ships from the public repo; no private deployment

**Decided.** The engine, the viewer and any hosted instance all ship from the public repo. There will be no
closed-source or private deployment of any part of RepoHIVE.

**Why.** Owner's call. It settles a question the 2026-08-05 vendoring entry had left as an accepted cost.

**Constrains.**

1. **The AGPL §13 pressure is gone as a design constraint.** `PROJECT_STATE` and `.kiro/workstreams.md`
   both carried a blocker to the effect that because `packages/web` imports `@repohive/core` in three
   modules, serving the app pulls the engine inside the network-use obligation, and that
   "open-source the viewer, keep the engine closed" was therefore unavailable. **That option is now
   explicitly not wanted**, so the constraint no longer shapes anything. Stop citing it.
2. **The 2026-08-05 vendoring entry is not superseded** — its reasoning and its accepted cost both stand.
   This entry only resolves the choice that entry left open.
3. **Do not architect a separate engine-only read service for licence reasons.** If one is built it must be
   justified on performance or operational grounds alone. AGPL is no longer an argument for it.
4. Attribution obligations are unchanged: upstream repowise credit stays in `NOTICE`, and the repo stays
   AGPL-3.0-or-later.

## 2026-08-23 — The public-repo replay does not gate development

**Decided.** The replay of history into the public repo is independent of ongoing development and **is not
a blocker for starting any workstream.**

**Why.** Owner's call. The replay is a packaging exercise on a separate track.

**Constrains.**

1. **Supersedes constraint 5 of the 2026-08-22 "CLI next, MCP deferred" entry**, which said the unresolved
   replay conflict gated where new work lands. It no longer does. New work may be committed without first
   draining the replay.
2. **The mechanical hazard is unchanged and still real.** `05-append-new-batches.ps1` asserts an expected
   commit total (currently **57**). New commits on `fable-work` move that number, so whoever next runs the
   replay must **recount rather than trust the recorded 57**, and must not apply on an unexpected number.
   The gate moved from "before development" to "before replaying" — it was not removed.
3. Replay progress stays tracked in `docs/plan/replay/new-work-replay-plan.md`.

## 2026-08-23 — The four forward paths get one tracked register

**Decided.** `.kiro/workstreams.md` is the single authoritative record for the four post-engine paths
(component reuse, packaged CLI, MCP server, hosted deployment): their scope, blockers, prerequisites and
effort estimates. `PROJECT_STATE.md` carries a one-line summary per path and a pointer, not the detail.

**Why.** The same analysis was produced from scratch on 2026-08-22 and again on 2026-08-23, both times in
chat only, and both times lost at session end. It is large, it is mostly stable, and re-deriving it costs a
session each time. It also does not belong in `PROJECT_STATE.md`, which is a snapshot under a length limit,
nor in `DECISIONS.md`, which records choices rather than scope.

Placed in `.kiro/` rather than `docs/plan/` because **`docs/plan/` is git-ignored via
`.git/info/exclude:31`** — a register written there would never be tracked. This matches where the other
tracked working registers live (`.kiro/gaps.md`, `.kiro/fixes.md`, `.kiro/edge-case-audit.md`).

**Constrains.**

1. **Answer path scope and blocker questions from `.kiro/workstreams.md`; update it instead of
   re-analysing.** If it disagrees with the code, the code wins — fix the register in the same change.
2. **Correction carried by that register, to the premise of the 2026-08-22 live-indexing entry.** That entry
   states "`ParseDeps.collector` is the existing injection point" for the source-provider seam. Verified
   2026-08-23: necessary but not sufficient. The parser reaches the filesystem in **three** injectable but
   unwired places — `deps.validator.validate` (runs first, short-circuits), `deps.collector.collect`, and
   `ast-extractor.ts`'s `defaultDeps.readFile` — and `ParseOptions.projectDirectory` is a required
   `string`. Swapping the collector alone will not admit tarballs or in-memory sources. **The decision
   itself is unchanged and not superseded**; only its cost estimate for that one item moves upward.
3. **No sequencing decision was made in this session.** The 2026-08-22 CLI-first decision stands. A
   recommendation to take Path 1 (component reuse) first, on the grounds that it has no prerequisites and a
   judge panel is imminent, was put to the owner and **has not been accepted**. Do not treat it as adopted.
4. **Do not place durable documentation under `docs/plan/`.**

**Also landed as consequences, not decisions** — four documentation claims that disagreed with the code,
corrected per `stack.md`'s own "the code wins" rule: the engine dependency table (native `tree-sitter` →
`web-tree-sitter` 0.26.10 WASM + `tree-sitter-java` 0.23.5); `packages/cli` described as wiring the
pipeline when it holds only `.gitkeep`; the storage seam described as complete when it is write-only; and
`docs/group-naming.md`'s "nothing here is implemented yet" header when Tier 1 has shipped. The engine
test-script claim in `stack.md` was also reconciled with `verification.md` — neither form of the command
works on both Node versions.

## 2026-08-22 — Live indexing of public repos is a product requirement, not an option

**Decided.** The hosted surface must demonstrate **live indexing**: paste a public repo URL, watch it
index, browse the result, with no signup for public repos. Authentication is deferred and added only if
its cost is small relative to the indexing work. A pre-indexed-only deployment is therefore not
sufficient, though pre-warming remains useful as demo insurance.

**Why now.** Wall-clock was measured for the first time (recorded in `PROJECT_STATE.md`): `parse`
broadleaf 68.3 s, `group` broadleaf 11.3 s, `parse` vantage 4.7 s. **A full pipeline run on a mature
multi-module repo is ~80 s**, and broadleaf is the worst case rather than the typical one. That makes
on-demand indexing a watchable operation, so the queue/broker/worker-fleet/polling architecture sketched
earlier in the session is unnecessary — it was designed against a guessed cost, not a measured one.

**Constrains.**
- **The parser must stop requiring a local directory.** `parseProject` walks a filesystem path; it needs a
  source-provider seam yielding `{path, content}` in canonical order. `ParseDeps.collector` is the existing
  injection point. This one change is what admits GitHub tarballs, zip uploads, in-memory tests, monorepo
  subpaths, and eventually unsaved editor buffers for the extension — a shape no directory walker can
  represent.
- **Storage must become an interface** (`get`/`put`/`has`), replacing direct `node:fs` use in `parseIndex`
  and `serializeIndex`.
- **Snapshot ids are content-addressed** over `(repoUrl, commitSha, engineVersion, configDigest)`.
  Determinism makes this sound and is what makes live indexing affordable: a repo is indexed once, ever.
  This is the first point where determinism pays as a product property rather than a correctness one.
- **`groupGraph` must not run on the request thread.** It is synchronous and CPU-bound — 11 s of blocked
  event loop on broadleaf — so the pipeline runs in `worker_threads`. Because it is already a pure
  function, the same worker code later lifts into a separate service unchanged.
- **Progress is a first-class engine output**, carried over SSE. For this product it is the demonstration
  itself: the recorded per-region decision is the differentiator, and progress is the only way to show it
  happening rather than assert it.
- **Fetch by codeload tarball, not `git clone`** — one request, no git binary, no discarded history.
- **The public endpoint needs guard rails before it ships:** size and file-count caps checked via the
  GitHub API before download, per-job timeout, global concurrency cap, per-IP rate limit,
  `https://github.com/owner/repo` validation only (arbitrary git remotes are an SSRF hole), and extraction
  hardened against path traversal and decompression bombs. Mitigating factor: the engine parses source and
  never executes it, and persists no source text.
- **`visibility` goes on the snapshot from day one** even while everything is public, so private-repo auth
  is additive. The real auth cost is private repos (OAuth plus user-token storage), not sessions.
- **The indexer does not live inside `packages/web`.** Reads served from an engine-only service keep the
  AGPL options open, per the 2026-08-05 vendoring entry.

## 2026-08-22 — The packaged CLI is the next workstream; MCP is deferred behind it

**Decided.** `packages/cli` is the next thing built. The MCP server is deferred, not dropped.

**Why.** Owner's call, made against an analysis that had ranked MCP *higher* on strategic value. No reason
was given beyond "for now", so this is recorded as a sequencing choice rather than a reversal of that
analysis. The analysis it was chosen against, which stands and should not be re-argued:

- An MCP server is **distribution, not differentiation**. The code-graph-MCP space is crowded (Ctxo,
  code-impact-mcp, Recon, agentic-codebase, code-review-graph, Sverklo, codebase-memory-mcp), several
  Tree-Sitter based and several shipping blast radius by name.
- MCP **does not depend on the CLI**, contrary to `positioning/roadmap.md`'s claim that the CLI is the
  keystone every other surface wraps. An ecosystem package may import `core` directly, and `parseIndex` and
  `analyzeBlastRadius` are already exported. Nothing was unblocked by choosing CLI first.
- The CLI is largely already written: `core/src/group-cli.ts` carries the flag surface, validation and a
  testable `main(argv) → exit code`, and the parser has its equivalent. It is an extraction.

**Constrains.**

1. **Do not re-propose MCP-first.** The comparison was made and the owner chose. Revisit only if the owner
   asks or the deadline picture changes.
2. **Do not rest any future claim on "we have an MCP server."** The differentiator remains the recorded,
   deterministic per-region preserve/reconstruct decision, which none of the surveyed tools expose.
3. The CLI starts from a **requirements spec**, not code. The flag surface is owner-reviewable first.
4. Sequence the Node test-script fix before the extraction, so the CLI inherits a runner that works on both
   Node 20 and 21+.
5. **The replay conflict is unresolved and gates where this work lands.** New commits on `fable-work` move
   the replay count off the asserted 57. Either drain the replay first or branch the CLI work and freeze
   `fable-work`. Do not start committing to `fable-work` on the assumption this is settled.

---

## 2026-08-22 — Replay classification goes by post-filter paths, never by commit subject

**Decided.** A commit's replay disposition is determined by **which paths it still touches after the path
filter runs**, not by its type prefix or subject wording. Every `docs:` or `kiro(...)` commit assumed to
self-empty must be confirmed empty in a dry run before it is treated as dropped.

**Why.** Classifying 76 commits by subject produced three wrong calls, caught only because
`05-append-new-batches.ps1` asserts an expected total and the dry run reported 59 instead of 56:

- `docs: add Fable handoff brief` writes **`FABLE_HANDOFF.md` at the repo root**, outside `docs/`. The
  filter never touched it and all 360 lines of internal agent brief survived into the batch list.
- `docs: add generation prompts for all eight paper figures` is **not a pure docs commit**. With `docs/`
  stripped it still removes a bogus self-referential `"repohive": "file:"` entry from `package-lock.json`
  and carries three mode-only changes under `packages/ui/scripts/`. Real work behind an academic subject.
  Kept with a rewritten subject; this is the commit that moved the expected count from 56 to 57.
- `chore: remove academic reference` edits the **archive** `README.md`, a different document from the
  public repo's independently injected README.

**Constrains.**

1. Root-level internal files must be named individually in `--invert-paths`; a directory filter will not
   catch them. `FABLE_HANDOFF.md` is now listed alongside `.kiro`, `docs`, `ui-ideas`, `AGENTS.md`.
2. **Archive `README.md` commits never replay.** The public README is a separate minimal document; the
   archive's is the original. Replaying archive README edits either conflicts or drags archive prose
   across. The deacademization pass will keep generating such commits — exclude each one.
3. A commit whose subject must be scrubbed but whose surviving content is real gets **retitled**, not
   dropped. Dropping it would silently lose the code.
4. `05-append-new-batches.ps1` asserts the expected total, and that assertion is the safety net. If it
   reports anything other than the planned figure, reconcile before applying.

**Also fixed the hole that hid this.** Step 6b's message pattern lacked `academic`, which is how a commit
titled "remove academic reference" passed both acceptance tests. Added, with `FABLE_HANDOFF`,
`paper figure`, `figure prompt`, `journal paper`, `handoff brief`. Deliberately phrases, not bare words:
the vendored UI calls a surface a "paper wash", so `\bpaper\b` would fail the build on legitimate code.

## 2026-08-22 — Skills hold procedure; hooks only trigger. One hook survives

**Decided.** Anything an agent can be *asked* to do is a **skill**. A **hook** exists only for what must
fire without being asked. `sync-memory-on-stop` is the only hook; `log-task-completion`,
`track-new-artifacts`, `load-memory-on-start` and `commit-assist.kiro.hook` are deleted.

A hook may not contain a procedure. It judges whether to act and delegates to the protocol in steering.
`sync-memory-on-stop` went from 4 KB to 0.8 KB on this rule.

**Why.** The deleted hooks were redundant or broken. `log-task-completion` and `track-new-artifacts` did
subsets of what the Stop hook already does. `load-memory-on-start` hardcoded a machine-specific `bm.exe`
path. `commit-assist.kiro.hook` duplicated the `commit-assist` skill verbatim.

The thin-trigger rule matters more than the deletions. The Stop hook had carried a ~2,000-character prompt
restating rules that already live in `steering/memory.md` — two copies of the same protocol, one of them
buried in JSON where nobody reviews it. Duplicated instructions drift, and the copy that drifts unseen is
the one that executes.

**Constrains.**
- New agent capability goes in `.kiro/skills/<name>/SKILL.md`, not into a hook.
- A new hook needs a reason it cannot be invoked, not merely a reason it is convenient.
- Hook prompts stay thin and point at steering. Procedure detail belongs in steering or a skill, never
  copied into a hook.
- The detail removed from the hook now lives in `steering/memory.md` under 'How to update' — that is the
  single source of truth, and the hook's correctness depends on it staying complete.

**Added.** `memory-sync` skill as the deliberate counterpart to the hook. It does not restate the protocol;
it covers what a requested sync does differently from an automatic one: widen the window past a single
turn, audit existing entries rather than only appending, and re-run a gate rather than copying an old
result forward.

## 2026-08-22 — `npm test` is not a valid green gate until the engine runner is version-independent

**Found while verifying the context restructure.** Root `npm test` exits 1, and the engine packages'
tests do not run at all on this machine.

`node --test dist/*.test.js` depends on **Node 21+** expanding the glob; `cmd.exe` does not expand it
either, so on Node 20 it fails with `Could not find …dist\*.test.js` and runs nothing. The form it
replaced, `node --test dist/`, runs on Node 20 but on Node 21+ resolves to `dist/index.js` and reports one
passing test. **Neither form is correct on both versions**, so every historical "green before commit"
claim depended on which Node the machine happened to have.

**Measured 2026-08-22, Node v20.19.0 / npm 10.8.2,** with test files listed explicitly: core **153/153**,
parser **180/181**. Other workspaces: `api-client` 50/50, `web` 20/20, `types` 2 suites failing, `ui`
1041/1042 with a flaky failure whose identity varies between runs. Determinism verified independently and
the `group` digest matches the recorded value.

**Three pre-existing failures**, none in engine logic: `parser/source-collector.test.ts` asserts POSIX
filename semantics where `\` is a legal filename character and so fails on Windows;
`types/__tests__/node-ids.test.ts` imports `tests/fixtures/node_ids.json`, a fixture never vendored with
the repowise packages; `ui` render-budget tests are timing-sensitive and fail intermittently.

**Decided.** Do not treat `npm test` as a pass/fail gate until the engine runner works regardless of Node
version — via an explicit file list, a glob library, or moving the engine packages onto the runner the
other workspaces already use. Until then, verify the engine with an explicit file list and compare against
the known-failure list in `steering/verification.md`. A change is clean if it does not add to that list.

**Constrains.** No claim that the suite is green may be made from a root `npm test` run. The previously
recorded "354 green" figure is superseded: it covered three of six test workspaces and was captured on a
different Node version.

## 2026-08-22 — Public replay: branch topology, and internal vocabulary stripped at the filter

**Decided.** Three things about how work reaches the public `RepoHIVE`.

*Topology.* Batches 1–52 stay linear on `main`; every segment after that is replayed onto a real feature
branch and integrated with a dated `--no-ff` merge. Branch names drop the `phase-N` numbering
(`feat/parser`, `feat/grouping-engine`, `feat/viewer-packages`, `feat/signal-enrichment`) because that
numbering maps one-to-one onto the coursework review schedule.

*Content.* Internal vocabulary is stripped from commit **messages** at the staging filter, via literal
`old==>new` pairs in `scrub-messages.txt` — not at replay time and not by regex. Full-subject literals
are individually reviewable, and a prior finding that non-ASCII literals fail *silently* in
`filter-repo` argues against clever patterns. What gets stripped: `(gap N)` suffixes, spec-clause ids
(`R3.7`), wave letters, `Phase D`/`Phase E`, agent names, and `@repowise-dev`. `repowise` itself stays in
`NOTICE`, where it is a required AGPL attribution rather than a leak.

*Timing.* One segment per calendar day. Commit timestamps are spread evenly across a 24-slot day table,
so two replay runs sharing one date would interleave — a branch commit at 09:14 stamped before the `main`
commit at 23:15 that its branch forks from, i.e. a child older than its parent. `-StartSlot` exists to
carve non-overlapping windows when a date genuinely must carry two runs.

**Why.** Full branch topology was chosen over staying linear despite the extra moving parts, and despite
GitHub counting contributions only from commits reachable from the default branch — which makes every
feature branch's squares conditional on its merge actually landing. The window to retrofit was still open
cheaply (one commit pushed beyond the fork point), and the archive genuinely had those branches, so the
topology is honest rather than decorative.

**Constrains.** Every replay branch **must** be merged or its commits score nothing and the day looks
empty; a missed merge is run late, never skipped. New segments follow the `feat/*` naming. Any future
internal vocabulary must be added to `scrub-messages.txt` before staging is rebuilt, and the acceptance
grep extended to catch it. The `.kiro/` and `docs/` path filter is load-bearing for dropping memory and
coursework commits — anything that must not ship but lives outside those two trees (`NOTICE` was one)
needs explicit exclusion from the batch list.

**Not done, deliberately.** Batch 69's message carries `Wave A` and is already pushed. Rewriting
published history for one opaque phrase was judged not worth it.

## 2026-08-22 — Agent context split from narrative; memory split into three files

**Decided.** `.kiro/steering/` now carries only system facts and protocol: `architecture.md`, `stack.md`,
`conventions.md`, `verification.md`, `memory.md`. All audience-facing narrative moved to
`docs/positioning/` and all coursework/publication material to `docs/academic/`, both marked
not-agent-context with an explicit banner. Memory split into three files with three write modes:
`PROJECT_STATE.md` (rewritten, short), `DECISIONS.md` (append-only, this file), `BRAIN.md` (append-only
history). `PROJECT_PLAN.md` retired — its index role moved to `AGENTS.md`, its rationale into this file.

**Why.** The always-on context was organised around positioning and submission deadlines rather than the
system. That was not cosmetic: it actively suppressed work. Steering told agents "do NOT build these
early" for CLI packaging, MCP, and multi-language; that demos should stay as `npm run` scripts because
packaging belonged to a later term; that scale beyond thousands of files was out of scope. Presentation
honesty rules ("do not claim millions") were being read as engineering ceilings. Steering was also
factually stale — it described a five-package layout with React Flow and Vite, when the repo has eight
packages and a Next.js 15 / React 19 viewer.

**Constrains.** Steering is for facts that hold regardless of task. Vision, comparisons, roadmap framing,
and claim wording go to `docs/positioning/`. Deadline-bound deliverables go to `docs/academic/`. Neither
folder may be loaded to decide what to build. Anything added to steering must be verifiable against the
code.

**Also corrected in the same pass:** the dangling reference to `steering/git-workflow.md` (a file that did
not exist; the commit convention now lives in `conventions.md` and the assistant in
`.kiro/skills/commit-assist/`), and the stale "git is not yet initialized" claim in `AGENTS.md`.

## 2026-08-16 — Engine waves C and D closed, plus the viewer finish

**Decided/outcome.** Waves C (`engine-integrity`: gaps 17, 13, 14, 15, 3, 11, 10) and D (`engine-audit`:
gaps 9, 20, 22, 21, 18, 12) completed on `fable-work`, closing all 22 gaps. Suite 354 green
(153 core + 181 parser + 20 web). Determinism holds. Digests recaptured for
`fixtures/sample-java-project`: group `f30c7b3d…` (was `f3be011b…`), parse `a603b667…` (unchanged).

**Why the group digest moved legitimately.** `metadata.json` gained Gap 22's `configuration` block and
`nodes.json` gained Gap 12's `regionId` / `ordinal`. Additive contract changes, not a determinism
regression.

**Viewer finish.** The group→region **package-prefix heuristic was removed.** Gap 12's `regionId` /
`ordinal` on group nodes and `groupIds` on each decision now drive the decision badge, the summary, the
audit table cross-link, and the group label. Verified against the committed fixture at both boundary
extremes: 0.5 → every group an exact `reconstruct`; 0 → exact `preserve`. `NOTICE` added.

**Two facts worth carrying forward.**
1. `npm test` was **silently vacuous on Node 21+** — `node --test dist/` resolved to `dist/index.js` and
   reported one passing test. Every "green before commit" gate before this fix was unreliable. On Node 20
   the old form worked, which is why it went unnoticed. The command must keep the `dist/*.test.js` glob.
2. The index write's **promotion phase is five same-directory renames**; a failure between them can still
   leave a mixture. Inherent to the design (a full directory swap was rejected for its no-index window).
   Every realistic failure now happens during staging, before the target is touched.

**Constrains.** Consumers join groups to decisions through `regionId` / `ordinal` / `groupIds`. No path or
package-prefix heuristic may be reintroduced for that purpose.

## 2026-08-09 — Wave B closed; then pivot to the viewer before the remaining engine gaps

**Decided.** Wave B (`parser-identity`: gaps 7, 6, 4, 5, 2, 8, 19) complete. Then, rather than continuing
straight into waves C and D, build the viewer first for a visible end-to-end result.

**Why the pivot is safe.** The JSON contract is the stable seam, so later engine fixes change the
*numbers* in `index/`, never its *shape*. Viewer work does not need rework afterwards.

**What Wave B changed.** Gap 2: `deriveSourceRoot`; `class`/`function` ids gained a `<sourceRoot>|` scope
prefix (empty scope omits it, so single-root ids are unchanged); scope-aware symbol table
(`lookupInScope` / `lookupAcrossScopes`); the stitcher resolves same-source-root first, then byte-first
cross-root with recorded ambiguity. Gap 8 reduced in scope with owner approval to static-member imports
mapping up to the enclosing class — nested-type and wildcard imports were verified already resolving, so
the rest of that fix was correctly skipped. Gap 19: default-on collector exclusions
(`.git`/`target`/`build`/`node_modules`/…) overridable via `--include-generated` / `--exclude`.

**Headline result.** `fixtures/broadleaf`, which previously **crashed** `group` with
`duplicate node identifier`, now parses (29,190 nodes / 14,325 edges) and groups (502 regions →
preserve 38 / reconstruct 464, depth 6). Source-root-scoped identity removed the collision, and the
adaptive preserve branch fires on real multi-module Java.

**Constrains.** Group naming deferred with its design captured in `docs/group-naming.md`; the viewer
derives Tier-1 structural labels client-side in the meantime. The viewer must render labels from
`packagePath` + simple name, **never the raw scoped id**.

## 2026-08-08 — Repo split: this repo becomes the private archive, a scrubbed replay builds the public one

**Decided.** Rename this repo to `repo-hive-archive` and make it private; create a new public `repohive`
and populate it by replaying scrubbed commits (~6/day over 12 days). 69 of 99 commits survive the
exclusion filter (`.kiro/`, `docs/`, `ui-ideas/`, `AGENTS.md`). Execution kit at `docs/plan/replay/`.

**Why.** A public repo was required, and 514 KB of the gap/fix/audit registers were found **tracked** at
`.kiro/gaps.md`, `.kiro/fixes.md`, `.kiro/edge-case-audit.md` and already pushed publicly — the
`.git/info/exclude` entries only ever covered the `docs/` copies. Chosen over rewriting this repo's
history, which would have cost contribution history and still could not un-publish what was already out.

**Constrains.** Those three registers remain tracked here intentionally; this repo is the private side.
Commit granularity for the replay is one commit per observable sub-behaviour, each independently green.

## 2026-08-08 — README ships in two stages, and `NOTICE` is required

**Decided.** A minimal README (general description only, no commands or metrics, so it cannot go stale)
lands first under MIT; the AGPL section plus `NOTICE` land with the vendored packages.

**Why.** The relicense and the repowise vendoring both happened *after* the grouping algorithm. A single
README carrying AGPL from day one would contradict the MIT `LICENSE` beside it and cite packages that did
not yet exist. `NOTICE` is a licence obligation once the vendored AGPL packages ship publicly.

## 2026-08-06 — Wave A closed: signal enrichment made the adaptive branch fire on real Java

**Outcome.** Gaps 16, 1a, 1c resolved in 11 granular commits. Gap 16 (core): strength-aware degenerate
guards prevent singleton explosion on zero-weight edges. Gap 1a (parser): type-use edge extraction from
all declared-type positions, so `sharedTypeCount` is populated. Gap 1c (parser): same-package simple-name
resolution via a per-file import index plus a JLS §7.5-precedence candidate list, so intra-package edges
are created.

**Key result.** `vantage` (158-file Spring Boot) re-parsed to 341 edges (was 128), 20 regions →
**preserve 10 / reconstruct 10** (was 0/20). Before this, the preserve branch never fired on real Java —
the contribution was not demonstrable.

**Grammar traps caught while testing** (each would have produced wrong code): `type_list` needed handling
in `typeNamesOf`; `spread_parameter` was missing from `TYPED_BY_FIELD`. Tree-Sitter grammar assumptions
must be verified empirically, not assumed.

## 2026-08-05 — Commit granularity is a rollback guarantee

**Decided.** One commit per **observable sub-behaviour**, each independently building and passing (3–7
per gap). Replaces "one commit per gap".

**Why.** A commit that does not build and pass is not a rollback point.

**Constrains.** Build plus full suite before every commit. Gotcha recorded because it bit us:
`graph.json` and `index/` are git-ignored, so reverting code does **not** restore the artifacts that
matched it.

## 2026-08-05 — Close every engine gap before building the viewer

**Decided.** All 22 gaps across four sequential branches — A `parser-hardening` (16, 1a, 1c),
B `parser-identity` (7, 6, 4, 5, 2, 8, 19), C `engine-integrity` (17, 13, 14, 15, 3, 11, 10),
D `engine-audit` (9, 20, 22, 21, 18, 12) — then the viewer.

**Why the order.** Sequenced by UI need first, then by how hard each gap would be to defend under
questioning. That moved the determinism cluster (13/17/18) earlier and multi-module identity (Gap 2)
later. Supersedes the scope and ordering of `docs/phase-1.5/execution-plan.md`.

*Partially superseded 2026-08-09: the viewer was brought forward after Wave B.*

## 2026-08-05 — Adopt repowise's UI under AGPL instead of building a viewer

**Decided.** Vendor four repowise packages (AGPL-3.0, © 2024–2026 Raghav Chamadiya and contributors) in
full rather than build a viewer from scratch. Relicensed the repo MIT → AGPL-3.0-or-later
(`19b27bc`, `4f6e823`).

**Why.** repowise ships a Next.js 15 / React 19 / Tailwind 4 app whose canvas semantic-zoom module has a
data model close to a superset of our `index/`. Verified before adopting: nearly standalone (the canvas's
only cross-module import is a theme-token helper), computes layout client-side with no dependency on
their Python backend, and is deterministic (sorts by sibling rank, ties by id).

**Cost accepted knowingly.** AGPL constrains how a closed hosted product could ever be built; a hosted
instance would have to ship from this same source. Commercial licensing flexibility was given up
deliberately.

**Constrains.** Next.js, not Vite. React Flow dropped. Vendored packages stay whole with visibility gated
via `nav-items.ts` rather than pruned, to avoid import breakage. Upstream attribution in `NOTICE`. A
viewer surface goes live only when our own engine produces its data.

## 2026-08-05 — Viewer requirements spec; Gap 12 promoted into it

**Decided.** `.kiro/specs/hierarchical-graph-viewer/` written, requirements only, single-pass approval.
Gap 12 became Requirement 3, which resolved that gap's open question. Gap 1's design went to
`docs/fixes-signal-enrichment.md` (Fixes 21–23) after verifying that `docs/fixes.md` covers only gaps
3–22 — a claim that had previously been asserted without checking. Planned fixture build-out cancelled in
favour of cloning a suitable repo when needed.

## 2026-07-23 — Phase 2 merged to `main`

**Outcome.** `phase-2-core` merged `--no-ff`. The engine landed as one commit per spec task with tests
alongside (2026-07-11 → 2026-07-21): deterministic primitives first (canonical order,
content-addressed group ids), then ingest gate → dependency strengths → region identification →
structural-quality assessment → seeded-Louvain community seam → adaptive preserve-vs-reconstruct
construction → balanced hierarchy assembly → metadata → whole-pipeline determinism → five-file `index/`
serialize/parse → blast radius → orchestrator + `group` CLI + demo scripts. 79 core tests covering all 33
spec correctness properties, 181 total; byte-identical SHA-256 across repeated and shuffled-input runs.

## 2026-07-11 — Determinism primitives are built first, always

**Decided.** Phase-2 implementation began with canonical ordering and stable ids before any algorithm
stage. Both engine packages' test runners scoped to compiled `dist/` tests for Node-version compatibility.

**Why.** Every later stage depends on canonical ordering and stable ids. Retrofitting determinism means
rewriting everything built on top of it.

## 2026-07-07 — Git milestone operations are owner-driven, not agent-driven

**Decided.** Merges to `main`, tags, and branch creation/deletion are the owner's to run.

**Why.** An agent performed a `phase-1-parser` → `main` `--no-ff` merge plus a tag and a new branch (all
local, never pushed) and it was fully reverted at the owner's request. The owner had only asked whether
the parser features were solid enough to proceed, not for the merge.

**Constrains.** Ordinary commits are fine when asked. Milestone operations are never run unprompted.

## 2026-07-04 through 2026-07-07 — Memory and logging conventions

- Commit convention documented: product types (`feat/fix/test/refactor/chore`) versus a `kiro(...)` meta
  type; memory and state files belong on `main`.
- Logging switched to 24-hour timestamps (`YYYY-MM-DD HH:mm`) across hooks and rules, read from the real
  system clock rather than the conversation's start date.
- `commit-assist` added as a user-triggered helper, chosen over automatic post-task commits.
- A Basic Memory MCP was bound to the `personal` vault via a workspace-level `.kiro/settings/mcp.json`
  override (the user-level config was misbound by a stray argument). A prior session's claimed notes were
  found never to have been persisted and were regenerated — **verify writes landed, do not trust a
  previous claim that they did.**

## Foundational decisions (2026-06-22)

1. **TypeScript/Node, not a JVM stack** — packaging drives everything. npx/CLI/MCP/editor distribution is
   the goal; a Spring Boot service cannot be packaged as an easy CLI. Node also matches the viewer and the
   JS graph ecosystem.

2. **Tree-Sitter, Java first** — Tree-Sitter only emits per-file ASTs; our parser stitches them into a
   cross-file graph. Java's explicit imports make static resolution tractable. Other languages are a
   per-grammar cost against the same data model.

3. **JSON files, no database** — the data is small (~10–20 MB at 4k files) and the pipeline is stateless
   file-handoff. MySQL removed as a wrong fit for graph data. A graph-native store remains available
   behind the storage interface.

4. **Structural grouping, not embeddings** — embedding-based grouping is model-dependent,
   irreproducible, and unexplainable, and it is circular to the central claim. Structure is verifiable
   and deterministic. Independently validated: Graphify also clusters by topology with no embeddings.
   Embeddings remain available for search and naming, never for membership.

5. **Adaptive per-region grouping is the novelty** — existing tools apply one global clustering strategy.
   Real repos are mixed-quality, so well-structured regions are preserved and messy ones reconstructed.

6. **Engine versus ecosystem split** — the local engine must be correct; CLI packaging, skill, MCP,
   editor extension, hosted service, auth, and telemetry are wrappers. The JSON contract is the seam that
   keeps those doors open with zero engine rework.

7. **Graphify is prior art and the comparison baseline, not a dependency** — the project name had to
   avoid collision with it. It is ahead on packaging; this project is ahead on the algorithm.

8. **Spec-driven, one phase at a time** — requirements → design → tasks, each approved before coding.

9. **Name finalized: RepoHIVE** (Repository Hierarchical Indexing & Visualization Engine), replacing the
   FlowGraph placeholder. Command names `parse`/`group`/`view` remain placeholders.
