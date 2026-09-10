/**
 * Contract C2 — `job.json`, the sidecar carrying everything `index/` cannot.
 *
 * `repository.json` holds only `repositoryId`, `nodeCount`, `edgeCount` and
 * `hierarchyDepth` — no name, no source URL, no status — which is why this file
 * exists at all.
 *
 * Two properties matter more than the field list:
 *
 * 1. **Every write is atomic** (tmp file + `renameSync`). The registry reads
 *    this file from another process on every request, and `readJobJson` there
 *    treats a parse failure as "not present". A torn read would silently drop a
 *    finished repo out of the sidebar, so the file must only ever be observed
 *    whole. C2 does not require this; concurrent readers do.
 * 2. **`status: "done"` is written last**, after `index/` is in place. That is
 *    the flag the registry gates browsability on, so it must never lead the
 *    thing it advertises.
 *
 * Server-only.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** C2 `status`. `done` is the only value the registry may treat as present. */
export type JobStatus = "queued" | "running" | "done" | "failed";

/** C2 `stage`. `null` while queued and once terminal. */
export type JobStage = "fetch" | "parse" | "group" | null;

/**
 * A tolerated per-file parse failure (C3). Mirrors the parser's `ParseError`
 * structurally rather than importing its type: this file is read back by a
 * separate process from JSON, where the parser's compile-time union is not a
 * guarantee anything upheld.
 */
export interface JobSkippedFile {
  reason: string;
  message: string;
  path?: string;
}

/**
 * C2 `error`. C2 fixes the shape as `{ code, message }` but not the vocabulary;
 * {@link JobErrorCode} is this implementation's set, and the routes map it to
 * status codes.
 */
export interface JobError {
  code: JobErrorCode;
  message: string;
}

/**
 * The failure codes a job can end on.
 *
 * `no-java-files` is deliberately distinct from the rest: a repository with no
 * Java in it is a normal outcome that earns a 422, not a server error (SPEC
 * item 5).
 */
export type JobErrorCode =
  | "no-java-files" // the repo held zero .java files — 422, not a failure
  | "fetch-failed" // codeload returned non-200, or the network broke
  | "repo-not-found" // codeload 404 — no such public repo
  | "too-large" // tripped a byte or file-count cap
  | "parse-failed" // parseProject returned a fatal error
  | "group-failed" // groupGraphToIndex returned an error
  | "internal-error"; // anything unexpected, converted at the child's boundary

/** The full C2 record. */
export interface JobRecord {
  repoId: string;
  /** Display name, `owner/repo`. `repository.json` has none. */
  name: string;
  sourceUrl: string;
  status: JobStatus;
  stage: JobStage;
  startedAt: string;
  finishedAt: string | null;
  error: JobError | null;
  /**
   * The tolerated per-file failures from the C3 parse.
   *
   * Normalized to `[]` on a clean run. C3 makes the parser *omit* the field
   * when nothing was skipped, but C2's example shows `[]`, and a reader of
   * job.json should not have to distinguish "absent" from "none" — so the
   * absent case is materialized here. Truncated to
   * {@link MAX_PERSISTED_SKIPPED_FILES}; see {@link skippedFileCount}.
   */
  skippedFiles: JobSkippedFile[];
  /**
   * How many files were actually skipped, when that exceeds the number listed.
   * Extension beyond C2: a repo can skip thousands of files, and the registry
   * re-reads this file on every request, so the array is capped and the true
   * count kept as a number. Omitted when nothing was truncated.
   */
  skippedFileCount?: number;
  counts: { nodes: number; edges: number };
}

/**
 * Cap on entries persisted in `skippedFiles`. Enough to diagnose a bad repo,
 * bounded enough that job.json stays a cheap read for the registry.
 */
export const MAX_PERSISTED_SKIPPED_FILES = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const STATUSES: ReadonlySet<string> = new Set(["queued", "running", "done", "failed"]);
const STAGES: ReadonlySet<string> = new Set(["fetch", "parse", "group"]);

/**
 * Read and validate a `job.json`.
 *
 * Returns null for a missing, unparseable or structurally wrong file. A
 * half-written file is not an exceptional state — a child process may be
 * writing one right now — so a failure here is a normal "no job", never a
 * throw.
 */
export function readJobFile(file: string): JobRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const { repoId, name, sourceUrl, status } = parsed;
  if (typeof repoId !== "string" || repoId === "") return null;
  if (typeof name !== "string" || typeof sourceUrl !== "string") return null;
  if (typeof status !== "string" || !STATUSES.has(status)) return null;

  const stage = typeof parsed.stage === "string" && STAGES.has(parsed.stage) ? (parsed.stage as JobStage) : null;
  const counts = isRecord(parsed.counts) ? parsed.counts : {};

  const record: JobRecord = {
    repoId,
    name,
    sourceUrl,
    status: status as JobStatus,
    stage,
    startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : "",
    finishedAt: typeof parsed.finishedAt === "string" ? parsed.finishedAt : null,
    error: isRecord(parsed.error) && typeof parsed.error.message === "string"
      ? { code: String(parsed.error.code) as JobErrorCode, message: parsed.error.message }
      : null,
    skippedFiles: Array.isArray(parsed.skippedFiles)
      ? parsed.skippedFiles.filter(isRecord).map((e) => ({
          reason: String(e.reason ?? "unknown"),
          message: String(e.message ?? ""),
          ...(typeof e.path === "string" ? { path: e.path } : {}),
        }))
      : [],
    counts: {
      nodes: typeof counts.nodes === "number" ? counts.nodes : 0,
      edges: typeof counts.edges === "number" ? counts.edges : 0,
    },
  };
  if (typeof parsed.skippedFileCount === "number") {
    record.skippedFileCount = parsed.skippedFileCount;
  }
  return record;
}

/**
 * Write a `job.json` atomically.
 *
 * The temp name carries the pid so two writers cannot share a staging file, and
 * `renameSync` within one directory is atomic on both POSIX and NTFS — a reader
 * sees either the old file or the new one, never a prefix of the new one.
 */
export function writeJobFile(file: string, record: JobRecord): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  renameSync(tmp, file);
}

/**
 * Build the initial `queued` record.
 *
 * Two C2 gaps are resolved here. `stage` is **null**, not `"parse"` as C2's
 * example shows: a queued job has begun no stage, and the example is a field
 * listing rather than a coherent snapshot. `startedAt` is stamped **at enqueue**
 * — C2 carries no `createdAt`, so treating `startedAt` as "when work began"
 * would leave a queued job with no timestamp at all, and a client polling one
 * with nothing to show.
 */
export function queuedJob(args: { repoId: string; name: string; sourceUrl: string; now?: Date }): JobRecord {
  return {
    repoId: args.repoId,
    name: args.name,
    sourceUrl: args.sourceUrl,
    status: "queued",
    stage: null,
    startedAt: (args.now ?? new Date()).toISOString(),
    finishedAt: null,
    error: null,
    skippedFiles: [],
    counts: { nodes: 0, edges: 0 },
  };
}

/** Truncate a skipped-file list to the persisted cap, recording the true size. */
export function capSkippedFiles(all: readonly JobSkippedFile[]): Pick<JobRecord, "skippedFiles" | "skippedFileCount"> {
  if (all.length <= MAX_PERSISTED_SKIPPED_FILES) {
    return { skippedFiles: [...all] };
  }
  return {
    skippedFiles: all.slice(0, MAX_PERSISTED_SKIPPED_FILES),
    skippedFileCount: all.length,
  };
}
