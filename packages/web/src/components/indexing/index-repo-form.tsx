"use client";

/**
 * Paste a public GitHub URL, watch it index, open the result.
 *
 * The client island on an otherwise server-rendered landing page, and the only
 * entry point to the pipeline in the demo. Mountable with no props as
 * `<IndexRepoForm />`.
 *
 * Two things this deliberately does not hide:
 *
 * - **Skipped files.** The tolerant parse (C3) can index a repository while
 *   failing on some of its files. Reporting that as an unqualified "done" would
 *   describe an index the viewer is not actually looking at, so the count is
 *   stated whenever it is non-zero.
 * - **Why a submission was refused.** The API's 400/409/503 bodies carry
 *   `detail` strings written for a person; they are rendered verbatim instead of
 *   being collapsed into "something went wrong".
 *
 * Progress is never conveyed by colour alone: the stage strip is decorative
 * (`aria-hidden`) and the same state is stated in a polite live region beside
 * it.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, FileWarning, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repohive/ui/ui/button";
import { Input } from "@repohive/ui/ui/input";

import { useIndexJob } from "@/lib/hooks/use-index-job";
import {
  JOB_STAGES,
  failureMessage,
  graphHref,
  progressMessage,
  skippedSummary,
  stageIndex,
  type JobView,
} from "@/lib/indexing/job-view";

const INPUT_ID = "index-repo-url";
const HINT_ID = "index-repo-url-hint";

/**
 * The three-segment stage strip.
 *
 * Purely decorative — every state it shows is also stated in the live region
 * next to it — so it is hidden from assistive tech rather than duplicating the
 * announcement.
 */
function StageStrip({ job }: { job: JobView | null }): React.JSX.Element {
  const current = stageIndex(job?.stage ?? null);
  const failed = job?.status === "failed";
  const done = job?.status === "done";

  return (
    <ol className="flex items-center gap-1.5" aria-hidden="true">
      {JOB_STAGES.map((stage, i) => {
        const reached = done || (!failed && current > i);
        const active = !done && !failed && current === i;
        const tone = reached
          ? "bg-[var(--color-success)]"
          : active
            ? "bg-[var(--color-accent-primary)]"
            : failed
              ? "bg-[var(--color-error)] opacity-40"
              : "bg-[var(--color-bg-inset)]";
        return (
          <li key={stage} className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-8 rounded-full transition-colors ${tone} ${active ? "animate-pulse" : ""}`}
            />
            <span
              className={`text-caption uppercase tracking-[0.08em] ${
                active || reached
                  ? "text-[var(--color-text-secondary)]"
                  : "text-[var(--color-text-tertiary)]"
              }`}
            >
              {stage}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function IndexRepoForm(): React.JSX.Element {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const { phase, job, submitError, availability, busy, submit, reset } = useIndexJob();

  const trimmed = url.trim();
  // `configured: false` means REPOHIVE_INDEX_ROOT is unset — a property of the
  // deployment, not a race, so it is safe to lock the form on. A null
  // availability (the probe itself failed) is treated as permissive: the POST
  // reports its own 503, and a failed probe must not be what disables the demo.
  const unconfigured = availability?.configured === false;
  // `busy` is a single snapshot from mount and goes stale the moment the other
  // job finishes, so it only warns. The 409 — which carries a written
  // explanation and a Retry-After — stays the authority on refusing.
  const otherJob = !busy && availability?.busy === true ? availability.busyWith : null;
  const canSubmit = trimmed !== "" && !busy && !unconfigured;

  const skipped = skippedSummary(job);

  // One toast per terminal transition. Keyed on the job so React's development
  // double-invocation, and any later re-render, cannot fire it twice.
  const announced = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (job === null || (phase !== "done" && phase !== "failed")) return;
    const key = `${job.repoId}:${job.status}`;
    if (announced.current === key) return;
    announced.current = key;

    if (job.status === "done") {
      toast.success(`Indexed ${job.name}`, {
        description: `${job.counts.nodes} nodes, ${job.counts.edges} edges.`,
      });
      // The landing page renders its repo list on the server from the index
      // root, so the new repo only appears once that render is re-run.
      router.refresh();
    } else if (job.status === "failed") {
      toast.error(`Could not index ${job.name}`, { description: failureMessage(job) });
    }
  }, [job, phase, router]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    submit(trimmed);
  };

  const onIndexAnother = () => {
    announced.current = null;
    setUrl("");
    reset();
  };

  return (
    <section
      className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5"
      aria-labelledby="index-repo-heading"
    >
      <h2
        id="index-repo-heading"
        className="flex items-center gap-2 font-serif text-lg text-[var(--color-text-primary)]"
      >
        <ScanSearch className="h-4 w-4 shrink-0 text-[var(--color-accent-primary)]" />
        Index a repository
      </h2>

      <form onSubmit={onSubmit} className="mt-4">
        <label
          htmlFor={INPUT_ID}
          className="block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Public GitHub repository URL
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id={INPUT_ID}
            // Deliberately `text`, not `url`: native URL validation would block
            // submission before the server could answer, and the server's
            // rejection messages are written for a person to read and are more
            // specific than the browser's.
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://github.com/google/guava"
            aria-describedby={HINT_ID}
            value={url}
            disabled={busy || unconfigured}
            onChange={(e) => setUrl(e.target.value)}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={!canSubmit} className="sm:w-32">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Indexing
              </>
            ) : (
              "Index"
            )}
          </Button>
        </div>
        <p id={HINT_ID} className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          Java repositories only. Parsing and grouping take roughly 15 seconds on a small
          repository, longer on a large one. One repository is indexed at a time.
        </p>
      </form>

      {unconfigured && (
        <p
          className="mt-3 flex items-start gap-2 text-sm text-[var(--color-warning)]"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Indexing is not configured on this server, so new repositories cannot be added. The
          repositories already indexed are still browsable.
        </p>
      )}

      {otherJob !== null && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]" role="status">
          Another repository (<code className="font-mono text-xs">{otherJob}</code>) is being
          indexed right now. This demo runs one job at a time, so a submission may be refused for
          the next few moments.
        </p>
      )}

      {/* Submission-level failure: the POST was refused, or the job stopped
          being readable. Distinct from a job that ran and failed, below. */}
      {submitError !== null && (
        <p
          className="mt-3 flex items-start gap-2 text-sm text-[var(--color-error)]"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </p>
      )}

      {(busy || job !== null) && (
        <div className="mt-4 border-t border-[var(--color-border-default)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <StageStrip job={job} />
            {job !== null && (
              <span className="tabular-nums text-caption text-[var(--color-text-tertiary)]">
                {job.name}
              </span>
            )}
          </div>

          {/* The single polite live region. Its text is derived from status and
              stage only, so a poll that changed nothing re-renders identical
              text and nothing is announced. */}
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-[var(--color-text-secondary)]"
          >
            {phase === "submitting"
              ? "Submitting the repository…"
              : progressMessage(job) || "Waiting for the server…"}
          </p>

          {job?.status === "failed" && (
            <p
              className="mt-2 flex items-start gap-2 text-sm text-[var(--color-error)]"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{failureMessage(job)}</span>
            </p>
          )}

          {/* A partially-parsed repository is a normal outcome here, so the
              count is stated on success as well as on failure. */}
          {skipped !== null && (
            <p className="mt-2 flex items-start gap-2 text-sm text-[var(--color-warning)]">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{skipped}</span>
            </p>
          )}

          {phase === "done" && job !== null && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={graphHref(job.repoId)}>
                  Open {job.name}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {job.counts.nodes} nodes, {job.counts.edges} edges indexed.
              </span>
            </div>
          )}

          {(phase === "done" || phase === "failed") && (
            <div className="mt-3">
              <Button type="button" variant="ghost" size="sm" onClick={onIndexAnother}>
                Index another repository
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
