import { NextResponse } from "next/server";

import { parseRepoUrl } from "@/lib/indexing/github-url";
import { queuedJob, writeJobFile, type JobRecord } from "@/lib/indexing/job-file";
import { allocateRepoId, ensureIndexRoot, indexRoot, jobFilePath } from "@/lib/indexing/paths";
import { acquireJobLock, currentJob, releaseJobLock, startIngestJob } from "@/lib/indexing/fork-job";

/**
 * `POST /api/index` — submit a public GitHub URL for indexing (SPEC item 3).
 *
 * Validates, writes `job.json` as `queued` (C2), forks the pipeline child, and
 * returns the `repoId` immediately. The request is never held open for the
 * pipeline: both stages block the event loop, so running them here would freeze
 * every other request for ~15 s on a large repo — and returning at once is also
 * what makes proxy and edge timeouts a non-question. Progress is read back from
 * `GET /api/jobs/{repoId}` by polling.
 *
 * The guard rails ship with the endpoint (SPEC item 5), because the endpoint is
 * public and unauthenticated:
 *
 * - **SSRF** — `github.com` is allowlisted and the URL is reduced to an
 *   `owner/repo` pair; the child then fetches a URL built from a hardcoded host
 *   plus those two segments, so a user-supplied URL is never fetched.
 * - **Disk** — byte and file-count caps are enforced mid-stream during
 *   extraction, not after the download lands.
 * - **CPU** — one job at a time, held by a lock file next to the indexes.
 *
 * Body: `{ "url": "https://github.com/<owner>/<repo>" }`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jobLocation(repoId: string): Record<string, string> {
  return { Location: `/api/jobs/${repoId}`, "Cache-Control": "no-store" };
}

export async function POST(request: Request) {
  const root = indexRoot();
  if (root === null) {
    // Unlike the registry, which falls back to the checked-in `fixtures/` so
    // local dev works, there is no safe fallback for *writing* — defaulting to
    // `fixtures/` would let a demo scribble over version-controlled test data.
    return NextResponse.json(
      { detail: "Indexing is not configured on this server (REPOHIVE_INDEX_ROOT is unset)." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Request body must be JSON, as { \"url\": \"https://github.com/<owner>/<repo>\" }." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const submitted = typeof body === "object" && body !== null ? (body as Record<string, unknown>).url : undefined;
  const parsed = parseRepoUrl(submitted);
  if (!parsed.ok) {
    return NextResponse.json(
      { detail: parsed.message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const { owner, repo, name, sourceUrl } = parsed.value;

  try {
    ensureIndexRoot(root);
  } catch (cause) {
    return NextResponse.json(
      { detail: `Index root is not writable: ${String(cause)}` },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const repoId = allocateRepoId(root, owner, repo, sourceUrl);

  // One job at a time. A second submission is refused rather than queued: a
  // queue would need durable state and a supervisor, and for a demo box the
  // honest answer is "someone else is indexing, try shortly".
  const lock = acquireJobLock(root, repoId);
  if (!lock.ok) {
    if (lock.heldBy === repoId) {
      // Re-submitting the repo already being indexed is not an error — hand back
      // the same job so the client just carries on polling.
      return NextResponse.json(
        { repoId, name, sourceUrl, status: "running", detail: "This repository is already being indexed." },
        { status: 202, headers: jobLocation(repoId) },
      );
    }
    return NextResponse.json(
      {
        detail: `Another repository ('${lock.heldBy}') is being indexed right now. This demo runs one job at a time; try again shortly.`,
        busyWith: lock.heldBy,
      },
      { status: 409, headers: { "Cache-Control": "no-store", "Retry-After": "30" } },
    );
  }

  const job: JobRecord = queuedJob({ repoId, name, sourceUrl });
  const jobFile = jobFilePath(root, repoId);

  try {
    // Written before the fork, so a client that polls immediately on the
    // response always finds a job rather than a 404.
    writeJobFile(jobFile, job);
  } catch (cause) {
    releaseJobLock(root, repoId);
    return NextResponse.json(
      { detail: `Could not record the job: ${String(cause)}` },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const started = startIngestJob({ root, repoId, owner, repo, job });
  if (!started.ok) {
    // Record the failure in job.json as well as returning it: the job is
    // already visible to anyone polling, so it must not be left as `queued`
    // forever.
    try {
      writeJobFile(jobFile, {
        ...job,
        status: "failed",
        stage: null,
        finishedAt: new Date().toISOString(),
        error: { code: "internal-error", message: started.message },
      });
    } catch {
      /* the response below still reports it */
    }
    releaseJobLock(root, repoId);
    return NextResponse.json(
      { detail: started.message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ repoId, name, sourceUrl, status: job.status }, { status: 202, headers: jobLocation(repoId) });
}

/** A bare GET reports whether a job is in flight, which is cheap and useful. */
export async function GET() {
  const root = indexRoot();
  if (root === null) {
    return NextResponse.json(
      { configured: false, busy: false, busyWith: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const busyWith = currentJob(root);
  return NextResponse.json(
    { configured: true, busy: busyWith !== null, busyWith },
    { headers: { "Cache-Control": "no-store" } },
  );
}
