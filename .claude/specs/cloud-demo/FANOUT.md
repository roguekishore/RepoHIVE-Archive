# Cloud demo — Phase 1 fan-out briefs

Copy-paste material for a fresh session. Phase 0 is already landed; see
`PHASES.md`. Read `SPEC.md` for the contracts these briefs reference.

## Kickoff — paste this as the first message of the new session

```
Read .claude/specs/cloud-demo/SPEC.md and .claude/specs/cloud-demo/PHASES.md.
Phase 0 is landed and verified. Spawn the four Phase 1 agents from
.claude/specs/cloud-demo/FANOUT.md — all four in a single message so they run
concurrently. Do not use worktree isolation. Do not run `next build`.
```

## Rules that apply to all four agents

Put these in every brief; agents do not see each other's instructions.

1. **No worktree isolation.** A fresh worktree has no `node_modules`, and this
   tree's install is heavy (`packages/web/node_modules` alone is 717 MB). One
   shared tree with disjoint file ownership is the plan.
2. **Do not run `next build`.** It writes shared `.next/`; concurrent builds
   corrupt each other. Phase 2 owns the build. `tsc --noEmit` is read-only and
   safe to run concurrently — that is the per-agent gate.
3. **Do not trust `npm test`.** Root exits 1, and the engine test script is
   vacuous or broken depending on Node version. Reporting "tests pass" from it
   is reporting nothing.
4. **Stay inside your owned files.** If the work seems to require editing a file
   another agent owns, stop and report it rather than editing.
5. **Do not "fix" the known failure.** Parser `source-collector` test 129 fails
   on Windows for a pre-existing path-separator reason. Leave it.

---

## Agent A — dynamic registry

```
Read .claude/specs/cloud-demo/SPEC.md first, especially contracts C1, C2 and C4.

You own exactly one existing file plus one new test beside it:
  packages/web/src/lib/repohive/repo-registry.ts
  packages/web/src/lib/repohive/repo-registry.test.ts   (new)

Task. Today the module returns a hardcoded four-entry REPO_REGISTRY and resolves
`fixtures/<dir>/index` relative to process.cwd(). Rewrite it to enumerate
$REPOHIVE_INDEX_ROOT with readdirSync per contract C1, take each repo's display
name from its job.json per contract C2, and make indexPresent require
`status: "done"` — a queued, running or failed job must never appear as a
browsable repo. When REPOHIVE_INDEX_ROOT is unset, fall back to today's
fixtures/ behaviour so local dev and the four checked-in fixtures keep working.

Contract C4 freezes the four exported signatures: listRegistryRepos,
getRegistryRepo, indexPresent, resolveIndexDir. That freeze is the entire reason
this change is safe — 10 route handlers, app/page.tsx and stub-responses.ts all
reach the registry through them and must not need edits. REPO_REGISTRY itself is
referenced only inside this module, so you are free to restructure it.

Do not touch: index-loader.ts (Agent C owns it), any route handler,
stub-responses.ts, app/page.tsx.

Handle a malformed or missing job.json without throwing — the directory is
written by a concurrent process, so a half-written file is a normal state, not
an exceptional one.

Verify with: npm run type-check --workspace @repohive/web
Report: what you changed, and anything in the spec that turned out wrong.
```

---

## Agent B — ingest, job runner, guard rails

Critical path and the largest item. Spawn it first in the message; consider a
stronger model for it.

```
Read .claude/specs/cloud-demo/SPEC.md first, especially contracts C1, C2 and C3.

You own new files only:
  packages/web/src/app/api/index/route.ts
  packages/web/src/app/api/jobs/[id]/route.ts
  packages/web/src/lib/indexing/*                       (all new)

Use lib/indexing/, NOT lib/jobs/ — packages/web/src/lib/jobs/progress.test.ts
already exists as vendored code and a new lib/jobs/ module risks colliding.

Task. POST /api/index takes a public GitHub URL, validates it, writes job.json
as `queued` per contract C2, forks a child process, and returns the repoId
immediately. GET /api/jobs/:id reads job.json back. The child fetches the
codeload tarball, extracts it, runs parseProject then groupGraphToIndex, and
writes the five-file index/ into a temp directory that it then RENAMES into
place — so a half-written index is never visible to the registry.

Return immediately; do not hold the request for the pipeline. Both stages block
the event loop (groupGraphToIndex is fully synchronous at
packages/core/src/orchestrator.ts:299, and the parse extract loop has no await),
which is why the work must be in a forked child rather than in the handler. It
is also what makes proxy and edge timeouts a non-question.

Pass tolerateFileErrors: true to parseProject (contract C3, already landed) and
record the returned skippedFiles into job.json. Without it, one unreadable or
non-compiling file discards the whole graph.

Guard rails are part of your definition of done, not a follow-up. This endpoint
is public and unauthenticated: allowlist github.com and validate the owner/repo
shape rather than fetching arbitrary URLs (SSRF), cap tarball bytes and file
count before extracting (disk exhaustion), and run one job at a time (CPU
exhaustion, and two people pasting large repos during a demo). Translate the
parser's fatal `no-java-files` error into a clean 422 — a repo with no Java is a
normal outcome, not a server error.

The parser needs no WASM configuration: your child runs against a normal
node_modules, so the require.resolve calls at ast-extractor.ts:137 work as-is.

Do not import Agent A's registry code. The registry reads what you write; you
agree through the on-disk format in C1/C2 alone.

Verify with: npm run type-check --workspace @repohive/web
Report: the exact job.json you produce, and any place C1/C2 was underspecified.
```

---

## Agent C — index parse cache

```
Read .claude/specs/cloud-demo/SPEC.md first.

You own exactly one file:
  packages/web/src/lib/repohive/index-loader.ts

Task. Every one of the 10 route handlers calls parseIndex, which reads and
parses the whole five-file index set on every request. broadleaf/index/ is 36 MB
(nodes.json 15.2 MB, hierarchy.json 15.1 MB, edges.json 7.1 MB), so page-to-page
navigation currently re-parses all of it each time. Add an in-process cache
keyed by directory path plus metadata.json mtime, so a re-indexed repo
invalidates naturally. Roughly 30 lines.

Do not change loadIndex's signature — 10 route handlers and app/page.tsx call
it. Do not add a dependency; a Map is enough.

Bound the cache. Indexes are tens of MB each and a demo may hold several repos;
an unbounded Map is a slow memory leak. Cap the number of resident entries and
evict the least recently used.

Verify with: npm run type-check --workspace @repohive/web
Report: the cache key, the eviction policy, and the bound you chose.
```

---

## Agent D — container

```
Read .claude/specs/cloud-demo/SPEC.md first, especially item 6 and Deployment.

You own new root-level files only:
  Dockerfile
  docker-compose.yml
  Caddyfile
  .dockerignore

Task. Multi-stage Dockerfile: `tsc -b packages/parser packages/core`, then
`next build`, then a runtime image holding the Next standalone output, the
engine dist output, and a node_modules the forked child process can use.
docker-compose.yml runs two services — Caddy publishing 80 and 443, and the app
on 3000 exposed to Caddy only, never published. Caddyfile is two lines: the
repohive.dev + www.repohive.dev site block and `reverse_proxy app:3000`.

Specifics that are easy to get wrong:
- Healthcheck must hit /api/repos. NOT /health or /metrics — those appear in
  middleware.ts's matcher but no route handler implements either, so they 404
  and the container would be permanently unhealthy.
- .dockerignore must exclude .env* — packages/web/.env.local exists untracked
  and contains REPOWISE_API_URL, and Next loads .env.local at build AND runtime
  where it would silently shadow the container environment. Also exclude .next,
  node_modules, .git and fixtures/ to keep the build context small and stop host
  artifacts leaking in.
- Leave REPOWISE_PROXY_TARGET unset. middleware.ts rewrites all of /api/* to it
  when set, which would break every real endpoint.
- caddy_data must be a NAMED VOLUME. Let's Encrypt rate-limits duplicate
  certificates to five per week, so a container that loses its cert store and
  re-requests on every restart can lock the demo out of issuing.
- Target linux/amd64. next build pulls arch-specific @tailwindcss/oxide,
  lightningcss and @unrs/resolver binaries, and this tree only has win32-x64
  variants.
- The app needs one env var: REPOHIVE_INDEX_ROOT=/data/indexes, with a bind
  mount behind it.

You may run `docker build` — it runs next build inside the image, isolated from
the host's .next/. Do not run `next build` on the host.

You touch no source file, so you cannot conflict with the other agents. Build
against current HEAD; `next build` is known to pass (verified, exit 0).

Verify with: docker build, and report whether it succeeded on linux/amd64.
Report: the final image size and anything in the spec's item 6 that was wrong.
```

---

## After all four report — Phase 2

One agent, or do it yourself. This is the only phase that runs `next build`.

Wire the pieces so newly indexed repos surface on the landing page and sidebar,
then in order: `npm run type-check --workspace @repohive/web`, `next build`,
`docker build`, and a local `docker compose up` smoke test that posts a small
Java repo through `POST /api/index` and browses the result.

Expect the real defects here rather than in Phase 1 — four agents coding against
a written contract will each have read it slightly differently. The likeliest
mismatch is job.json: Agent A consumes what Agent B produces, and they never
share code.
