"use client";

/**
 * Submit a repository for indexing and follow the job to a terminal state.
 *
 * Deliberately **not** built on the existing `use-job.ts` / `lib/api/jobs.ts`
 * pair: those target a different backend with a different record shape (a
 * `pending` status, a `stream_token`), and none of it applies to `job.json`.
 *
 * Plain `useEffect` polling rather than SWR, for three reasons:
 *
 * 1. The app-wide `SWRConfig` sets `dedupingInterval: 60_000`. A 1.5 s
 *    `refreshInterval` under a 60 s dedupe window is at best a question about
 *    SWR's internals and at worst a poll that silently fires four times a
 *    minute. Getting it right would mean overriding the global here anyway.
 * 2. SWR's contract is that a rejected fetcher is an error and the data is
 *    stale. This API inverts that: the most important body it returns — the
 *    failed job — arrives with a 4xx/5xx status. A fetcher that resolves on
 *    those makes `error` permanently null and moves all the interesting logic
 *    into the component regardless.
 * 3. Stopping cleanly on a terminal status and on unmount is the whole
 *    correctness requirement, and it is one `clearTimeout` plus one
 *    `AbortController` here.
 *
 * Polls with a self-scheduling `setTimeout`, not `setInterval`: the next request
 * is only queued once the previous one has settled, so a slow response cannot
 * pile requests up behind it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  errorDetail,
  isTerminal,
  parseAvailability,
  parseJobResponse,
  parseSubmitAccepted,
  type IndexAvailability,
  type JobView,
} from "@/lib/indexing/job-view";

/** How often to ask for the job record. */
const POLL_INTERVAL_MS = 1_800;

/**
 * Consecutive unreadable polls tolerated before the job is abandoned.
 *
 * A dropped request is not evidence the job died — the server is single-threaded
 * through two synchronous stages and a demo box's network is not perfect — so
 * one blip should not throw away a run that is still going. Bounded, so a
 * genuinely gone job does not poll forever.
 */
const MAX_CONSECUTIVE_POLL_FAILURES = 4;

/** Where the flow is, as far as the UI needs to distinguish. */
export type IndexJobPhase =
  | "idle" // nothing submitted yet
  | "submitting" // POST in flight
  | "polling" // accepted; watching job.json
  | "done" // index is on disk and browsable
  | "failed"; // submission refused, or the job ended failed

export interface UseIndexJobResult {
  phase: IndexJobPhase;
  /** The latest job record, once one has been read. */
  job: JobView | null;
  /**
   * A submission-level failure — a refused POST (400/409/503/500) or a job that
   * stopped being readable. A job that ran and *failed* is reported through
   * `job.error` instead, so the two are never conflated.
   */
  submitError: string | null;
  /** `GET /api/index`, read once on mount. Null until it answers. */
  availability: IndexAvailability | null;
  /** True while the form should refuse input: in flight or already running. */
  busy: boolean;
  submit: (url: string) => void;
  reset: () => void;
}

export function useIndexJob(): UseIndexJobResult {
  const [phase, setPhase] = useState<IndexJobPhase>("idle");
  const [job, setJob] = useState<JobView | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<IndexAvailability | null>(null);
  const [repoId, setRepoId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Guards every `setState` reached from an await, so a response landing after
  // unmount is dropped instead of warning.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Availability, once. Purely to disable the form up front with a reason
  // ("not configured", "another repo is indexing") rather than letting someone
  // paste a URL and collect a 503.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/index", {
          signal: controller.signal,
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        const body: unknown = await res.json().catch(() => null);
        if (mounted.current) setAvailability(parseAvailability(body));
      } catch {
        // A failed probe must not disable the form: the POST is the real
        // authority, and it reports its own 503. Leaving this null means
        // "unknown", which the UI treats as permissive.
        if (mounted.current) setAvailability(null);
      }
    })();
    return () => controller.abort();
  }, []);

  const submit = useCallback((url: string) => {
    const trimmed = url.trim();
    if (trimmed === "") return;

    setSubmitError(null);
    setJob(null);
    setRepoId(null);
    setPolling(false);
    setPhase("submitting");

    void (async () => {
      let res: Response;
      let body: unknown;
      try {
        res = await fetch("/api/index", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        body = await res.json().catch(() => null);
      } catch (cause) {
        if (!mounted.current) return;
        setSubmitError(`Could not reach the server: ${cause instanceof Error ? cause.message : String(cause)}`);
        setPhase("failed");
        return;
      }
      if (!mounted.current) return;

      const accepted = res.status === 202 ? parseSubmitAccepted(body) : null;
      if (accepted === null) {
        // 400/409/503/500 all carry `detail`, written for a person to read, so
        // it is shown verbatim rather than mapped to a generic message.
        setSubmitError(errorDetail(body, `The server refused the submission (HTTP ${res.status}).`));
        setPhase("failed");
        return;
      }

      // Both 202 shapes land here — a fresh fork, and "this repository is
      // already being indexed". The next move is the same for either.
      setRepoId(accepted.repoId);
      setPolling(true);
      setPhase("polling");
    })();
  }, []);

  const reset = useCallback(() => {
    setPolling(false);
    setRepoId(null);
    setJob(null);
    setSubmitError(null);
    setPhase("idle");
  }, []);

  // The poll loop. Keyed on the job, so it is created once per submission
  // rather than torn down and rebuilt on every tick.
  useEffect(() => {
    if (!polling || repoId === null) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let failures = 0;

    const stop = () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
    };

    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    const tick = async () => {
      if (stopped) return;
      let res: Response;
      let body: unknown;
      try {
        res = await fetch(`/api/jobs/${encodeURIComponent(repoId)}`, {
          signal: controller.signal,
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        body = await res.json().catch(() => null);
      } catch {
        // An abort lands here too, and `stopped` is already true by then.
        if (stopped) return;
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
          if (mounted.current) {
            setSubmitError("Lost contact with the server while indexing. The job may still be running.");
            setPhase("failed");
          }
          setPolling(false);
          return;
        }
        schedule();
        return;
      }
      if (stopped || !mounted.current) return;

      // The trap: a *failed* job is returned with a status describing why — 422,
      // 413, 502, 500 — and the full record is in the body every time. Checking
      // `res.ok` first would throw away exactly the record that explains the
      // failure. So the body is read first and the status only consulted when
      // the body turns out not to be a job at all.
      const next = parseJobResponse(body);
      if (next === null) {
        if (res.status === 404) {
          // The only status that genuinely means "no such job". `POST /api/index`
          // writes job.json before it forks and before it answers, so this is
          // not a startup race — the record is gone.
          setSubmitError(errorDetail(body, `The server has no record of job '${repoId}'.`));
          setPhase("failed");
          setPolling(false);
          return;
        }
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
          setSubmitError(errorDetail(body, `Could not read the job's progress (HTTP ${res.status}).`));
          setPhase("failed");
          setPolling(false);
          return;
        }
        schedule();
        return;
      }

      failures = 0;
      setJob(next);
      if (isTerminal(next.status)) {
        setPhase(next.status === "done" ? "done" : "failed");
        setPolling(false);
        return;
      }
      schedule();
    };

    void tick();
    return stop;
  }, [polling, repoId]);

  return {
    phase,
    job,
    submitError,
    availability,
    busy: phase === "submitting" || phase === "polling",
    submit,
    reset,
  };
}
