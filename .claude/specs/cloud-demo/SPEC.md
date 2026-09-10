# Cloud demo — spec

Branch: `cloud-demo`. Status: **Phase 0 landed** (item 1 + contract freeze,
2026-09-10, uncommitted). Items 2–7 not started.

One container on EC2 serving `repohive.dev`, no auth: paste a public GitHub URL,
run parse → group, browse the result in the existing viewer. Indexes live on a
bind-mounted disk and are disposable. **No RDS, no schema** — there is no
database code anywhere in this repo (no driver dependency, no `DATABASE_URL`, no
`.sql` file), and adding one is strictly more work than not.

Non-goals: accounts, private repos, SSE progress, persistence guarantees, the
`packages/cli` extraction, filling any of the 26 dead vendored pages.

## Verified facts this rests on

Checked against source on 2026-09-10, not taken from docs.

- `next build` **passes** (exit 0). Every route is `ƒ` dynamic; only `/icon.png`
  and `/settings` are static — so a CDN in front would cache almost nothing.
  This is why CloudFront was dropped.
- `middleware.ts` is a **pass-through** unless `REPOWISE_PROXY_TARGET` is set.
  Its matcher covers `/health` and `/metrics`, but **no handler implements
  either** — a container healthcheck must not target them.
- The registry rewrite is contained: `REPO_REGISTRY` is referenced **only inside
  `repo-registry.ts`**. All 10 route handlers, `app/page.tsx` and
  `stub-responses.ts` reach it through four functions. Keep those signatures and
  nothing downstream changes.
- WASM needs no special handling **because the pipeline forks**. The child runs
  against a normal `node_modules`, so the `require.resolve` calls at
  `ast-extractor.ts:137` work unmodified. Next only bundles `@repohive/core`
  (for `parseIndex`), which has no WASM. An earlier plan to pass
  `GrammarOptions` is unnecessary.
- The parser **already tolerates per-file failures**: the extract loop
  (`orchestrator.ts:205`) `continue`s past them, and symbol-table build and
  stitching run regardless. Only the gate at `orchestrator.ts:236` throws the
  result away.
- Non-Java files are safe. The collector includes a file only if it ends
  `.java` case-sensitively (so `.JAVA` is excluded by design), skips
  directories, symlinks and everything else silently, and excludes `target`,
  `build`, `out`, `bin`, `node_modules`, `generated` by default. But **zero Java
  files after the walk is a fatal `no-java-files` error** and needs translating
  to a clean 422.
- `broadleaf/index/` is **36 MB** (`nodes.json` 15.2 MB, `hierarchy.json`
  15.1 MB, `edges.json` 7.1 MB). Every route handler re-parses the whole set.
- `repository.json` carries only `nodeCount`, `edgeCount`, `hierarchyDepth`,
  `repositoryId` — **no name, no URL**. Hence a sidecar `job.json`.
- Both pipeline stages block the event loop: `groupGraphToIndex`
  (`core/src/orchestrator.ts:299`) is fully synchronous, and the parse extract
  loop has no await. ~7 s + ~8 s of frozen loop on a broadleaf-scale repo. More
  cores do not fix this; forking does.
- No `.dockerignore` exists. `packages/web/.env.local` exists untracked and
  contains `REPOWISE_API_URL`; Next loads `.env.local` at build *and* runtime.

- `ParseSuccess` is declared at **`packages/parser/src/errors.ts:61`**, not in
  `types.ts` (resolved 2026-09-10; item 1 is landed against it).
- Exactly **three** error reasons reach the collector and are therefore
  tolerable: `path-unsupported` (recorded during collection,
  `orchestrator.ts:190`), `file-unreadable` and `file-unparseable` (recorded
  during extraction, `ast-extractor.ts:890/904/922`). `duplicate-node-id` is
  raised in the **serializer** (`serializer.ts:183`), not the collector, so
  tolerating per-file failures cannot produce a graph with colliding ids that
  would crash `group`.

## Shared contracts — freeze before any parallel work

This project has already been bitten here: `DECISIONS.md:211` records "define
the orchestration function's signature before either worktree writes code,"
because two parallel implementations would otherwise diverge. These four
contracts are what make the fan-out safe.

### C1 — On-disk layout

```
$REPOHIVE_INDEX_ROOT/<repoId>/
  index/       # the five-file set, written by group
  job.json     # everything index/ cannot carry
```

`repoId` = slugified `owner-repo`, collision-suffixed. Owned by items 2 and 3.

### C2 — `job.json`

```jsonc
{
  "repoId": "google-guava",
  "name": "google/guava",         // display name; repository.json has none
  "sourceUrl": "https://github.com/google/guava",
  "status": "queued",             // queued | running | done | failed
  "stage": "parse",               // fetch | parse | group | null
  "startedAt": "ISO",
  "finishedAt": null,
  "error": null,                  // { code, message } when failed
  "skippedFiles": [],             // from the tolerant parse
  "counts": { "nodes": 0, "edges": 0 }
}
```

`status: "done"` is the **only** value the registry may treat as present.

### C3 — `ParseOptions.tolerateFileErrors`

New optional boolean beside the existing `excludedSegments?`. When set, the gate
at `orchestrator.ts:236` is bypassed and the skipped files come back on the
success value. **Default false**, so the fixtures and the 180 parser tests are
unaffected.

### C4 — Registry signatures are frozen

`listRegistryRepos`, `getRegistryRepo`, `indexPresent`, `resolveIndexDir` keep
their current signatures. `index-loader.ts` is not modified by item 2.

## Work items

**1. Tolerant parse mode** (`packages/parser`) — **DONE, verified.** Per C3.
`tolerateFileErrors?: boolean` on `ParseOptions`; `skippedFiles?: ParseError[]`
on `ParseSuccess`; the gate at `orchestrator.ts` bypassed when set. Five tests
added to `orchestrator.test.ts`.

Two deliberate decisions inside it, both test-pinned: a run in which **no file
survived still fails** (an empty node set is `no-java-files` by another route,
and writing an empty graph would move the failure into `group`, where it reads
as a corrupt index rather than an unparseable repository); and `skippedFiles`
is **absent rather than an empty array** on a clean run.

**2. Dynamic registry** (`repo-registry.ts`) — enumerate `REPOHIVE_INDEX_ROOT`
with `readdirSync` instead of returning the hardcoded four entries; take the
display name from `job.json`; `indexPresent` requires `status: "done"`.
**Fall back to today's `fixtures/` behaviour when the variable is unset** so
local dev and the checked-in fixtures keep working.

**3. Ingest + job runner** — `POST /api/index` validates, writes `job.json` as
`queued`, forks a child, returns the id immediately. `GET /api/jobs/:id` reads
`job.json`. The child fetches the codeload tarball, extracts, runs
`parseProject` then `groupGraphToIndex` into a temp dir and **renames into
place**, so a half-written index is never visible to the registry. Polling, not
SSE — a held request is what makes proxy and edge timeouts a question, and
returning immediately removes it.

**4. Index parse cache** (`index-loader.ts`) — in-process cache keyed by
directory + `metadata.json` mtime. Re-parsing 36 MB per request is the largest
felt-latency item in a demo; roughly 30 lines.

**5. Guard rails — ship with the endpoint, not after.** Allowlist `github.com`
and validate the `owner/repo` shape rather than fetching arbitrary URLs; cap
tarball bytes and file count before extracting; one job at a time. Translate
`no-java-files` to 422. **Not a separate task — part of item 3's definition of
done**, or the endpoint ships without them.

**6. Container.** Multi-stage: `tsc -b packages/parser packages/core`, then
`next build`, then an image holding the standalone output, the engine `dist`,
and a `node_modules` for the forked child. Compose runs Caddy + app.
`.dockerignore` must exclude `.env*`. Healthcheck hits `/api/repos`
(**not** `/health`).

**7. Cold-path measurement** — one `parse` of the broadleaf fixture on the
instance. If Linux shows the ~15 ms/file penalty, implement the measured
prefetch: a concurrency-16 read into a `Map` between collect and extract, with
`readFile: (p) => map.get(p)`. Projected cold 51 s → ~15 s; warm unchanged. The
extractor interface, the extract loop and processing order all stay as they are,
which is what keeps determinism structural rather than something to test for.
**Skip entirely if the measurement comes back clean.**

## Deployment

Elastic IP, then a Netlify DNS apex A record at it plus a `www` CNAME. Netlify
is DNS only — it cannot host this app: serverless functions give no persistent
volume for `/data/indexes`, no forked child outliving a request, and a timeout
ceiling against a pipeline measuring ~14 s warm / ~57 s cold.

TLS terminates on the box via Caddy — two lines of Caddyfile gets an
auto-renewing Let's Encrypt cert and correct `X-Forwarded-*`. Port 3000 stays
bound to localhost; only 80 and 443 open.

**Order matters.** Set the A record and confirm it resolves *before*
`docker compose up`. Caddy's HTTP-01 challenge needs the name resolving to get a
cert, and Let's Encrypt rate-limits duplicate certificates to five per week.
Persist `caddy_data` as a named volume or a restart loop can burn that quota.

Build on **x86_64, not ARM**: `next build` pulls arch-specific
`@tailwindcss/oxide`, `lightningcss` and `@unrs/resolver` binaries, and this
tree only has the win32-x64 variants, so a cross-arch build resolves them for
the first time inside Docker. The parser itself is arch-neutral (it loads
`tree-sitter-java.wasm`, never the native `prebuilds/`).

## Accepted risks

- A public unauthenticated endpoint that fetches user-supplied URLs and burns
  CPU is abusable. The guard rails reduce this; they do not remove it.
- The 26 dead vendored pages stay reachable in the nav-gated app; clicking one
  errors. Demo polish, not a blocker.
- `next build` passed on Windows x86 but has **not** run inside `linux/amd64`
  Docker.
- Root `npm test` exits 1 and the engine test script is broken on both Node
  versions, so no green-suite claim from it is trustworthy. Verify engine tests
  by listing test files explicitly — `steering/verification.md` has the command
  and the known-failure list. **Note that doc says `source-collector` test 124;
  it is now 129**, because item 1's five new `orchestrator.test.js` tests sort
  ahead of it. Same test, same known Windows path-separator cause.

## Open decisions — defaults picked, override if wanted

Polling over SSE · `owner-repo` id scheme with collision suffix · keeping the
fixtures fallback rather than replacing it outright.
