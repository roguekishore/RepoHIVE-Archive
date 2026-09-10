import { readdirSync } from "node:fs";

import { NextResponse } from "next/server";

import { readJobFile, type JobRecord } from "@/lib/indexing/job-file";
import { indexRoot, jobFilePath } from "@/lib/indexing/paths";

/**
 * `GET /api/indexing/jobs` — every job record under the index root, newest
 * first, whatever its status.
 *
 * The counterpart to `GET /api/repos`, which deliberately shows only
 * `status:"done"` repos (C2: `done` is the only value the registry may treat as
 * present). That is correct for navigation and useless for observability — a
 * paste that failed, or one still mid-index, leaves no trace on the landing
 * page. This route is the honest view: it enumerates C1's per-repo directories
 * and returns each readable C2 sidecar as-is.
 *
 * Read-only. It never writes, never forks, and never touches `index/`.
 *
 * Three deliberate differences from `GET /api/jobs/{id}`:
 *
 * 1. **An unset `REPOHIVE_INDEX_ROOT` is an empty list and a 200, not a 503.**
 *    The single-job route is the polling half of an ingest flow, where an unset
 *    variable means the request cannot possibly succeed and 503 is the truth.
 *    This route is mounted unconditionally on the landing page, and a box
 *    configured for the checked-in fixtures — the documented default, per the
 *    registry's fixtures fallback — is not broken. Answering 503 there would
 *    paint an error strip across a healthy install.
 * 2. **A failed job does not colour the HTTP status.** The single-job route maps
 *    `error.code` onto 4xx/5xx because it reports on one job. A list containing
 *    one failure is a successful listing; the failures are in the body.
 * 3. **The response is an envelope, not a bare array** (`/api/repos` returns an
 *    array). The list is capped, and a cap that a client cannot detect is worse
 *    than no cap, so `total` and `truncated` have to travel with the rows.
 *
 * Server-only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This data changes under the client between polls; never let it be cached. */
const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Cap on returned rows.
 *
 * Indexes on the demo box are disposable but the directories accumulate, and
 * every row here costs a `readFileSync` plus a JSON parse. 100 newest is well
 * past what any panel displays.
 *
 * The cap is applied *after* sorting, so it drops the oldest jobs. That has one
 * blind spot worth naming: a job stuck in `running` because its child died
 * would eventually be pushed off the end by newer finished ones and stop being
 * reported. Guard rails hold ingest to one job at a time (SPEC item 5), so a
 * non-terminal job is essentially always among the newest few; the alternative
 * — no cap — trades this narrow case for an unbounded response.
 */
/*
 * Not exported: a route module may only export Next's own names. The generated
 * type validator does `Omit<typeof entry, ...known exports...>` and constrains
 * whatever is left to `never`, so any extra *value* export fails `next build`
 * with "Property 'MAX_JOBS' is incompatible with index signature" — while
 * `tsc --noEmit` passes, because the validator for a route is only written
 * during a build. Types are erased from that check, which is why the interface
 * below may be exported and this constant may not.
 */
const MAX_JOBS = 100;

export interface JobsListResponse {
  /** Readable job records, newest `startedAt` first. At most {@link MAX_JOBS}. */
  jobs: JobRecord[];
  /** How many readable records exist under the root, before the cap. */
  total: number;
  /** Whether the cap dropped anything, so a client need not compare lengths. */
  truncated: boolean;
}

/**
 * Sort key for `startedAt`.
 *
 * Parsed rather than compared as a string. `writeJobFile` records
 * `toISOString()`, which is always UTC and would sort correctly lexicographically
 * — but `readJobFile` normalizes a missing or non-string timestamp to `""`, and a
 * hand-edited file could carry an offset like `+05:30`. Parsing keeps both cases
 * from silently mis-ordering. An unparseable timestamp becomes `0`, sorting to
 * the end, where a record with no usable time belongs.
 */
function startedAtMs(job: JobRecord): number {
  const ms = Date.parse(job.startedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Newest first, tie-broken by ascending `repoId`.
 *
 * The tiebreak is not cosmetic. Two jobs can share a `startedAt` to the
 * millisecond, and `readdirSync` order is filesystem-dependent — without it
 * those rows could swap places between two polls two seconds apart, making a
 * static list appear to shuffle.
 */
function byNewestThenId(a: JobRecord, b: JobRecord): number {
  const delta = startedAtMs(b) - startedAtMs(a);
  if (delta !== 0) return delta;
  return a.repoId.localeCompare(b.repoId);
}

/**
 * Enumerate the root and read every sidecar that parses.
 *
 * Mirrors `repo-registry.ts`'s `buildRegistry`: `readdirSync` with
 * `withFileTypes`, directories only, and a throw from the root itself treated as
 * "nothing yet" rather than an error. Both sides read what the ingest child
 * writes and neither calls the other; the shape agreement is C1.
 */
function collectJobs(root: string): JobRecord[] {
  let dirents: import("node:fs").Dirent<string>[];
  try {
    dirents = readdirSync(root, { withFileTypes: true, encoding: "utf8" });
  } catch {
    // The root does not exist yet — container first boot, or a bind mount that
    // has not been populated. Not an error condition for a listing.
    return [];
  }

  const jobs: JobRecord[] = [];
  for (const dirent of dirents) {
    // A repo is a directory (C1). This also excludes `.job.lock`, which is a
    // real file under the root and is not a job.
    if (!dirent.isDirectory()) continue;
    // Dotfiles are bookkeeping, never repoIds — `.work` is a directory the
    // runner stages into, and `isValidRepoId` would reject either name anyway.
    if (dirent.name.startsWith(".")) continue;

    const job = readJobFile(jobFilePath(root, dirent.name));
    // null means missing, unparseable, or half-written. A child may be writing
    // this file right now, so skipping silently is correct — the next poll two
    // seconds later picks it up. Failing the whole request over one torn read
    // would make the panel flicker out whenever a job advances a stage.
    if (job === null) continue;

    jobs.push(job);
  }
  return jobs;
}

export async function GET() {
  const root = indexRoot();
  if (root === null) {
    const empty: JobsListResponse = { jobs: [], total: 0, truncated: false };
    return NextResponse.json(empty, { headers: NO_STORE });
  }

  const all = collectJobs(root).sort(byNewestThenId);
  const body: JobsListResponse = {
    jobs: all.slice(0, MAX_JOBS),
    total: all.length,
    truncated: all.length > MAX_JOBS,
  };
  return NextResponse.json(body, { headers: NO_STORE });
}
