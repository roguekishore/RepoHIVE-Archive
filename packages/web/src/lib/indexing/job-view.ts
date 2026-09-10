/**
 * Client-side view of a job record — the pure half of the indexing UI.
 *
 * Everything here is a total function over `unknown`, because the input is an
 * HTTP body rather than a value this process constructed. Two properties of the
 * API make that necessary rather than merely defensive:
 *
 * 1. **A failed job arrives with a non-200 status and a full body.**
 *    `GET /api/jobs/{id}` maps a terminal failure onto 422 / 413 / 502 / 500 to
 *    describe *why*, and returns the whole record in every one of those cases.
 *    So the status code cannot decide whether there is a job to read — only the
 *    body can.
 * 2. **Some responses are not job records at all.** A 404 (no such job) and a
 *    503 (indexing unconfigured) carry only `{ detail }`. Telling those apart
 *    from a record is a question about shape, so `parseJobResponse` answers it
 *    and returns null for the rest.
 *
 * The types below mirror the server's C2 record structurally instead of
 * importing it from `job-file.ts`. That module is server-only — it imports
 * `node:fs` at the top — and, more to the point, a compile-time union on the
 * writing side is no guarantee about bytes that crossed a network. The server's
 * own reader makes the same argument about reading JSON written by another
 * process; this is that argument one hop further out.
 *
 * No React, no fetch, no DOM, so this is the part of the feature the web
 * package's node-environment vitest can actually cover.
 */

/** C2 `status`. `done` is the only value that means the index is browsable. */
export type JobStatusView = "queued" | "running" | "done" | "failed";

/** C2 `stage`. Null while queued and once terminal. */
export type JobStageView = "fetch" | "parse" | "group" | null;

/** The pipeline's stages, in the order a job walks them. */
export const JOB_STAGES = ["fetch", "parse", "group"] as const;

/** Human labels for the progress line. */
export const STAGE_LABELS: Readonly<Record<"fetch" | "parse" | "group", string>> = {
  fetch: "Fetching",
  parse: "Parsing",
  group: "Grouping",
};

/** A tolerated per-file parse failure (C3), as it survives JSON. */
export interface SkippedFileView {
  reason: string;
  message: string;
  path?: string;
}

/** A job record as a client should read it. */
export interface JobView {
  repoId: string;
  name: string;
  sourceUrl: string;
  status: JobStatusView;
  stage: JobStageView;
  error: { code: string; message: string } | null;
  skippedFiles: SkippedFileView[];
  /** Present only when `skippedFiles` was truncated; then it is the true total. */
  skippedFileCount?: number;
  counts: { nodes: number; edges: number };
  /** The server's rendered one-line summary. Null when the body carried none. */
  detail: string | null;
}

/** What `POST /api/index` returns on either flavour of 202. */
export interface SubmitAccepted {
  repoId: string;
  name: string;
  sourceUrl: string;
  status: JobStatusView;
  /** Set on the "already being indexed" 202 — a notice, not an error. */
  detail: string | null;
}

/** What `GET /api/index` reports about the server's ability to take a job. */
export interface IndexAvailability {
  configured: boolean;
  busy: boolean;
  busyWith: string | null;
}

const STATUSES: ReadonlySet<string> = new Set(["queued", "running", "done", "failed"]);
const STAGES: ReadonlySet<string> = new Set(JOB_STAGES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Read a `GET /api/jobs/{id}` body as a job record, whatever status carried it.
 *
 * Returns null when the body is not one — a `{ detail }`-only error body, a
 * non-object, or a record missing the two fields that identify one. Callers pair
 * a null with {@link errorDetail} to get something to show.
 */
export function parseJobResponse(body: unknown): JobView | null {
  if (!isRecord(body)) return null;

  const repoId = asNonEmptyString(body.repoId);
  const status =
    typeof body.status === "string" && STATUSES.has(body.status) ? (body.status as JobStatusView) : null;
  // These two together are the discriminator: an error body has neither, and a
  // record is useless without both.
  if (repoId === null || status === null) return null;

  const counts = isRecord(body.counts) ? body.counts : {};
  const view: JobView = {
    repoId,
    name: typeof body.name === "string" && body.name !== "" ? body.name : repoId,
    sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : "",
    status,
    stage: typeof body.stage === "string" && STAGES.has(body.stage) ? (body.stage as JobStageView) : null,
    error:
      isRecord(body.error) && typeof body.error.message === "string"
        ? { code: String(body.error.code ?? "unknown"), message: body.error.message }
        : null,
    skippedFiles: Array.isArray(body.skippedFiles)
      ? body.skippedFiles.filter(isRecord).map((entry) => ({
          reason: String(entry.reason ?? "unknown"),
          message: String(entry.message ?? ""),
          ...(typeof entry.path === "string" ? { path: entry.path } : {}),
        }))
      : [],
    counts: { nodes: asCount(counts.nodes), edges: asCount(counts.edges) },
    detail: asNonEmptyString(body.detail),
  };
  if (typeof body.skippedFileCount === "number" && Number.isFinite(body.skippedFileCount)) {
    view.skippedFileCount = body.skippedFileCount;
  }
  return view;
}

/**
 * Read a `POST /api/index` acceptance. Null when the body is not one.
 *
 * Both 202 shapes land here: the fresh `queued` fork, and the "this repository
 * is already being indexed" `running` reply. They are deliberately not
 * distinguished, because the client's next move is the same either way — start
 * polling.
 */
export function parseSubmitAccepted(body: unknown): SubmitAccepted | null {
  if (!isRecord(body)) return null;
  const repoId = asNonEmptyString(body.repoId);
  if (repoId === null) return null;
  return {
    repoId,
    name: typeof body.name === "string" && body.name !== "" ? body.name : repoId,
    sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : "",
    status:
      typeof body.status === "string" && STATUSES.has(body.status) ? (body.status as JobStatusView) : "queued",
    detail: asNonEmptyString(body.detail),
  };
}

/**
 * Pull the message out of an error body.
 *
 * Every failing route writes `detail`, and those strings are written for a
 * person to read ("Only github.com URLs are accepted…"), so they are shown
 * verbatim rather than replaced by a generic line.
 */
export function errorDetail(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    const detail = asNonEmptyString(body.detail);
    if (detail !== null) return detail;
    if (isRecord(body.error)) {
      const message = asNonEmptyString(body.error.message);
      if (message !== null) return message;
    }
  }
  return fallback;
}

/** Read `GET /api/index`. An unreadable body is reported as unconfigured. */
export function parseAvailability(body: unknown): IndexAvailability {
  if (!isRecord(body)) return { configured: false, busy: false, busyWith: null };
  return {
    configured: body.configured === true,
    busy: body.busy === true,
    busyWith: asNonEmptyString(body.busyWith),
  };
}

/** Whether a status is one polling should stop on. */
export function isTerminal(status: JobStatusView): boolean {
  return status === "done" || status === "failed";
}

/** Position of a stage in {@link JOB_STAGES}; -1 for null. */
export function stageIndex(stage: JobStageView): number {
  return stage === null ? -1 : JOB_STAGES.indexOf(stage);
}

/**
 * The line announced in the live region.
 *
 * Derived from `status` and `stage` alone, never from a clock, so a poll that
 * changed nothing produces identical text and a screen reader stays quiet
 * between the handful of transitions that actually happen.
 */
export function progressMessage(job: JobView | null): string {
  if (job === null) return "";
  if (job.status === "queued") return `Queued ${job.name}.`;
  if (job.status === "running") {
    if (job.stage === null) return `Indexing ${job.name}.`;
    return `${STAGE_LABELS[job.stage]} ${job.name} — step ${stageIndex(job.stage) + 1} of ${JOB_STAGES.length}.`;
  }
  if (job.status === "done") {
    return `Finished indexing ${job.name}: ${job.counts.nodes} nodes, ${job.counts.edges} edges.`;
  }
  return `Indexing ${job.name} failed. ${failureMessage(job)}`;
}

/** The best available explanation of a failure. */
export function failureMessage(job: JobView | null): string {
  if (job === null) return "";
  if (job.error !== null && job.error.message !== "") return job.error.message;
  return job.detail ?? "The job failed without reporting a reason.";
}

/** How many files the parse skipped: the true total, listed or not. */
export function skippedTotal(job: JobView | null): number {
  if (job === null) return 0;
  return job.skippedFileCount ?? job.skippedFiles.length;
}

/**
 * A sentence about skipped files, or null when none were.
 *
 * Surfaced rather than hidden: a partially-parsed repository is a normal outcome
 * of the tolerant parse, and an index built from 900 of 1000 files described as
 * simply "done" would misrepresent what is on screen.
 */
export function skippedSummary(job: JobView | null): string | null {
  const total = skippedTotal(job);
  if (total <= 0) return null;
  const noun = total === 1 ? "file" : "files";
  const verb = total === 1 ? "was" : "were";
  return `${total} ${noun} could not be parsed and ${verb} skipped. The rest of the repository was indexed.`;
}

/** Where a finished index is browsable. */
export function graphHref(repoId: string): string {
  return `/repos/${repoId}/knowledge-graph`;
}
