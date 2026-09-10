# Cloud demo — parallel work phases

Read `SPEC.md` first. This file is the fan-out plan: what can run concurrently,
what must not, and what each agent is told.

The fan-out is wide because the work items touch **disjoint file sets**. That is
the whole basis for parallelism here — not task independence in the abstract, but
no two agents editing the same file. Anything that breaks disjointness collapses
the plan into a merge conflict.

## Read this before spawning anything

**Do not run agents in git worktrees.** The Agent tool offers
`isolation: "worktree"`, and it is the wrong choice here: a fresh worktree has no
`node_modules`, and this tree's install is heavy (`packages/web/node_modules`
alone is 717 MB). The install cost per agent exceeds the conflict risk it
prevents. Use one working tree with disjoint file ownership instead.

**Only one agent may run `next build`.** It writes `.next/`, so concurrent
builds in one tree corrupt each other. `tsc --noEmit` is read-only and safe to
run concurrently. Builds happen in Phase 2 only.

**No agent may trust `npm test`.** Root `npm test` exits 1, and the engine test
script is vacuous or broken depending on Node version. An agent that reports
"tests pass" from it is reporting nothing. Per-package verification commands are
given in each brief below; `steering/verification.md` has the engine command and
the known-failure list.

**Put new indexing code in `lib/indexing/`, not `lib/jobs/`.**
`packages/web/src/lib/jobs/progress.test.ts` already exists as vendored code.
A new `lib/jobs/` module risks colliding with it.

## Phase 0 — DONE (2026-09-10, uncommitted)

Landed before the fan-out because it was the only cross-package **compile-time**
dependency: Agent B's child process calls
`parseProject({ tolerateFileErrors: true })`, which would not typecheck until the
option existed. With it in, Phase 1 goes four-wide.

- `ParseSuccess` located at **`errors.ts:61`** (not `types.ts`).
- Item 1 implemented: `tolerateFileErrors?: boolean` on `ParseOptions`,
  `skippedFiles?: ParseError[]` on `ParseSuccess`, gate bypassed when set.
- Contracts C1–C4 in `SPEC.md` are frozen as written.

**Verified:** `npm run build` clean · parser **185/186** · core **153/153** ·
determinism digest `f30c7b3d…` unchanged over 3 runs.

The one parser failure is the pre-existing Windows `source-collector` test —
**now numbered 129, not 124**, because the 5 new `orchestrator.test.js` tests
sort ahead of it. `steering/verification.md` still says 124; do not treat 129 as
a regression, and do not "fix" it.

## Phase 1 — four agents, concurrent

Spawn all four in one message. File ownership is exclusive; state it in each
brief so no agent wanders.

### Agent A — dynamic registry

Owns `packages/web/src/lib/repohive/repo-registry.ts` and a new test beside it.

Enumerate `REPOHIVE_INDEX_ROOT` with `readdirSync` instead of returning the
hardcoded four-entry `REPO_REGISTRY`; take the display name from `job.json`
(contract C2); `indexPresent` requires `status: "done"`. Fall back to today's
`fixtures/` behaviour when the variable is unset.

Must not touch: `index-loader.ts`, any route handler, `stub-responses.ts`,
`app/page.tsx`. Contract C4 freezes the four exported signatures — that freeze is
what keeps 10 route handlers, the landing page and `stub-responses.ts` working
untouched. Verify with `npm run type-check --workspace @repohive/web`.

### Agent B — ingest, job runner, guard rails

Critical path and the largest item. Give it the strongest model and start it
first.

Owns new files only: `packages/web/src/app/api/index/route.ts`,
`packages/web/src/app/api/jobs/[id]/route.ts`, and a child runner plus job.json
helper under `packages/web/src/lib/indexing/`.

`POST /api/index` validates, writes `job.json` as `queued`, forks a child,
returns the id immediately. `GET /api/jobs/:id` reads `job.json`. The child
fetches the codeload tarball, extracts, runs `parseProject` then
`groupGraphToIndex` into a temp dir and renames into place.

Guard rails are part of this agent's definition of done, not a follow-up:
allowlist `github.com` and validate the `owner/repo` shape, cap tarball bytes and
file count before extracting, one job at a time, and translate `no-java-files` to
a 422.

It reads C1 and C2 as contracts and never imports Agent A's code — the registry
reads what this writes, and they agree through the on-disk format alone. Verify
with `npm run type-check --workspace @repohive/web`.

### Agent C — index parse cache

Owns `packages/web/src/lib/repohive/index-loader.ts`.

In-process cache keyed by directory plus `metadata.json` mtime. Around 30 lines
against a 36 MB re-parse per request. Must not change `loadIndex`'s signature —
10 route handlers and the landing page call it. Verify with
`npm run type-check --workspace @repohive/web`.

### Agent D — container

Owns root-level new files only: `Dockerfile`, `docker-compose.yml`, `Caddyfile`,
`.dockerignore`.

Multi-stage build per `SPEC.md` item 6. `.dockerignore` must exclude `.env*` —
`packages/web/.env.local` exists untracked and Next loads it at build and
runtime, where it would shadow the container environment. Healthcheck hits
`/api/repos`; `/health` and `/metrics` appear in the middleware matcher but no
handler implements them. Target `linux/amd64`.

This agent can write and iterate on the image against current HEAD, since
`next build` already passes. Final validation is Phase 2. It touches no source
file, so it never conflicts with A, B or C.

## Phase 2 — serial integration

One agent, after all four report. This is the only phase that runs `next build`.

Wire the pieces (the landing page and sidebar should surface newly indexed
repos), run `npm run type-check --workspace @repohive/web`, then `next build`,
then `docker build` and a local `docker compose up` smoke test against a small
repo. Fix whatever the seams reveal.

Expect the real defects to surface here rather than in Phase 1 — four agents
coding against a written contract will each have read it slightly differently.

## Phase 3 — on the instance

Deployment order is load-bearing: allocate the Elastic IP, set the Netlify apex A
record, **confirm it resolves**, then `docker compose up`. Caddy's HTTP-01
challenge needs the name resolving before it can obtain a cert, and Let's Encrypt
rate-limits duplicate certificates to five per week.

Then item 7: one `parse` of the broadleaf fixture on the instance to settle the
cold-file question. Implement the concurrency-16 prefetch only if the penalty
shows up on Linux; skip it entirely if the measurement is clean.

## Dependency summary

```
Phase 0  (serial)   locate ParseSuccess → item 1 → freeze C1/C2
                          |
Phase 1  (parallel) ┌─ A registry ──┐
                    ├─ B ingest ────┤   disjoint files, no imports between them
                    ├─ C cache ─────┤
                    └─ D container ─┘
                          |
Phase 2  (serial)   integrate, next build, docker smoke test
                          |
Phase 3  (instance) DNS → compose up → cold-path measurement
```

Only B depends on Phase 0's code. A, C and D depend on Phase 0 only for the
contract freeze, so if you skip the freeze they will diverge.

## What would break this plan

- Two agents editing one file. The disjointness above is the plan; verify it
  holds if you re-scope any item.
- Amending C1 or C2 mid-Phase-1. A and B agree only through those; changing the
  format after they start guarantees a mismatch.
- Any agent running `next build` before Phase 2.
- Splitting Agent B to parallelize it further. Its pieces share the job.json
  writer, so splitting reintroduces a shared file.
