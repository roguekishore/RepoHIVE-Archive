import { NextResponse } from "next/server";

import { isValidRepoId } from "@/lib/indexing/github-url";
import { readJobFile, type JobErrorCode, type JobRecord } from "@/lib/indexing/job-file";
import { indexRoot, jobFilePath } from "@/lib/indexing/paths";

/**
 * `GET /api/jobs/{repoId}` — read a job's `job.json` back (SPEC item 3).
 *
 * This is the polling endpoint. `POST /api/index` returns as soon as the child
 * is forked, so this is where a client watches `status` walk
 * `queued → running → done | failed` and `stage` walk `fetch → parse → group`.
 * Polling rather than SSE is deliberate: a held request is the thing that makes
 * proxy and edge timeouts a question.
 *
 * The id is a `repoId`, not a separate job id — C1 gives each repo one directory
 * and C2 puts one `job.json` in it, so a repo and its most recent job are the
 * same address. Re-indexing a repo replaces its job record.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * HTTP status for a terminal failure.
 *
 * A `failed` job is reported with a status code describing *why*, not 200 —
 * `no-java-files` becoming a clean 422 is required by SPEC item 5, and once one
 * failure code maps to a status the rest should be consistent rather than half
 * of them hiding inside a 200 body. The full job record is returned in every
 * case, including these, so a polling client always has `status`, `stage` and
 * `error` available regardless of the code it sees.
 *
 * `repo-not-found` maps to 422 rather than 404 so it cannot be confused with
 * "no such job", which is the other 404 this route can produce.
 */
function statusForError(code: JobErrorCode): number {
  switch (code) {
    case "no-java-files":
      // A repository with no Java in it is a normal outcome, not a server error.
      return 422;
    case "repo-not-found":
      return 422;
    case "too-large":
      return 413;
    case "fetch-failed":
      // Upstream problem: codeload was unreachable or answered with an error.
      return 502;
    case "parse-failed":
    case "group-failed":
    case "internal-error":
      return 500;
    default:
      return 500;
  }
}

/** The response body: the C2 record plus a rendered one-line summary. */
function jobResponse(job: JobRecord): Record<string, unknown> {
  return {
    ...job,
    // Convenience for a UI that wants one string rather than a state machine.
    detail:
      job.error !== null
        ? job.error.message
        : job.status === "done"
          ? `Indexed ${job.counts.nodes} nodes and ${job.counts.edges} edges.`
          : job.stage !== null
            ? `Indexing ${job.name} (${job.stage}).`
            : `Queued ${job.name} for indexing.`,
  };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const root = indexRoot();
  if (root === null) {
    return NextResponse.json(
      { detail: "Indexing is not configured on this server (REPOHIVE_INDEX_ROOT is unset)." },
      { status: 503, headers: NO_STORE },
    );
  }

  // Validate before joining onto the index root, so a traversal or absolute path
  // never reaches the filesystem.
  if (!isValidRepoId(id)) {
    return NextResponse.json({ detail: `Unknown job '${id}'.` }, { status: 404, headers: NO_STORE });
  }

  const job = readJobFile(jobFilePath(root, id));
  if (job === null) {
    return NextResponse.json({ detail: `Unknown job '${id}'.` }, { status: 404, headers: NO_STORE });
  }

  const status = job.status === "failed" && job.error !== null ? statusForError(job.error.code) : 200;
  return NextResponse.json(jobResponse(job), { status, headers: NO_STORE });
}
