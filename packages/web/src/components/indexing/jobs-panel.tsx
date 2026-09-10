"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

import type { JobRecord } from "@/lib/indexing/job-file";

/**
 * Jobs panel — the repos that are mid-index or have failed.
 *
 * The landing page lists repos from the registry, which by C2 shows only
 * `status:"done"`. Everything else is invisible there: a paste that failed
 * leaves no trace after a reload, and one still running looks like nothing
 * happened. This fills exactly that gap, and deliberately nothing more — a
 * `done` job already has a full card upstairs, so rendering it here would
 * duplicate it.
 *
 * It is mounted unconditionally, which drives the whole design: **it renders
 * `null` whenever it has nothing to say**, including before the first response
 * lands and when the request fails. A fixtures-only dev box — the documented
 * default, since the registry falls back to `fixtures/` with no env config —
 * must not grow an empty box or an error strip. `GET /api/indexing/jobs`
 * answers 200 with an empty list rather than 503 for the same reason.
 *
 * `import type` above is erased at compile time, so the server-only
 * `job-file.ts` (and its `node:fs` imports) never reaches the client bundle.
 * Sharing the C2 type beats restating the unions and letting them drift.
 */

/** Poll cadence while work is in flight. Matches the ingest child's pace. */
const POLL_INTERVAL_MS = 2_000;

/**
 * How many consecutive failed polls before giving up.
 *
 * Without a cap, a fetch error either stops the panel for the lifetime of the
 * page — losing the failure report that is its main reason to exist — or retries
 * forever, which is the thing the "stop when settled" rule exists to prevent.
 * A handful of retries covers a restart or a dropped connection and still ends.
 */
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * The `GET /api/indexing/jobs` envelope.
 *
 * Restated rather than imported from the route module: a route file is a server
 * entry point, and pointing a client component's imports at one — even for a
 * type — is a needless edge for the bundler. `total` and `truncated` are part of
 * the contract but unused here; non-terminal jobs are bounded well under the
 * route's cap because ingest runs one at a time.
 */
interface JobsListResponse {
  jobs: JobRecord[];
  total: number;
  truncated: boolean;
}

/** `done` and `failed` are terminal; the rest still move on their own. */
function isPending(job: JobRecord): boolean {
  return job.status === "queued" || job.status === "running";
}

/**
 * The status words shown to the reader.
 *
 * Every row carries this text, so status is never conveyed by colour or icon
 * alone. `stage` is shown exactly as given — no percentage is derived from it,
 * because nothing here measures progress.
 */
function statusLabel(job: JobRecord): string {
  if (job.status === "failed") return "Failed";
  if (job.status === "queued") return "Queued";
  return job.stage !== null ? `Running · ${job.stage}` : "Running";
}

/** One sentence per row, for the live region. */
function announcement(job: JobRecord): string {
  return job.status === "failed" && job.error !== null
    ? `${job.name} failed: ${job.error.message}`
    : `${job.name}: ${statusLabel(job)}`;
}

export function JobsPanel(): React.JSX.Element | null {
  const [jobs, setJobs] = useState<JobRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveErrors = 0;
    const controller = new AbortController();

    async function poll(): Promise<void> {
      let received: JobRecord[] | null = null;
      try {
        const res = await fetch("/api/indexing/jobs", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (res.ok) {
          const body = (await res.json()) as JobsListResponse;
          received = Array.isArray(body.jobs) ? body.jobs : [];
        }
      } catch {
        // Network failure, or the abort from unmount.
      }
      if (cancelled) return;

      if (received === null) {
        consecutiveErrors += 1;
        if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
        return;
      }

      consecutiveErrors = 0;
      setJobs(received);
      if (received.some(isPending)) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  async function dismiss(repoId: string): Promise<void> {
    setJobs((prev) => prev.filter((j) => j.repoId !== repoId));
    await fetch(`/api/jobs/${encodeURIComponent(repoId)}`, { method: "DELETE" });
  }

  // `done` repos are already full cards on the landing page.
  const visible = jobs.filter((job) => job.status !== "done");
  if (visible.length === 0) return null;

  return (
    <section
      aria-label="Indexing jobs"
      className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-default)] p-5"
    >
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
        Indexing
      </p>

      <div role="status" aria-live="polite" className="sr-only">
        {visible.map(announcement).join(". ")}
      </div>

      <ul className="mt-2 space-y-2">
        {visible.map((job) => {
          const failed = job.status === "failed";
          return (
            <li key={job.repoId} className="flex items-baseline gap-2.5 text-sm">
              <span className="mt-0.5 shrink-0 self-start" aria-hidden="true">
                {failed ? (
                  <AlertTriangle className="h-4 w-4 text-[var(--color-error)]" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-warning)]" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-[var(--color-text-primary)]">{job.name}</span>
                <span
                  className={`ml-2 text-xs ${
                    failed ? "text-[var(--color-error)]" : "text-[var(--color-warning)]"
                  }`}
                >
                  {statusLabel(job)}
                </span>
                {failed && job.error !== null && (
                  <span className="mt-0.5 block break-words text-[var(--color-text-secondary)]">
                    {job.error.message}
                  </span>
                )}
              </span>
              {failed && (
                <button
                  onClick={() => void dismiss(job.repoId)}
                  aria-label={`Dismiss ${job.name}`}
                  className="mt-0.5 shrink-0 self-start rounded p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
