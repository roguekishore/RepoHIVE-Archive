/**
 * Tests for the client-side reading of the job API.
 *
 * The cases worth pinning here are the ones where the obvious implementation is
 * wrong. Chiefly: `GET /api/jobs/{id}` returns a **failed job with a non-200
 * status** — 422 for `no-java-files`, 413 for `too-large`, 502 for
 * `fetch-failed`, 500 otherwise — with the full record in the body every time.
 * So the parse must be driven by the body's shape and never by `res.ok`, and
 * that is what the first block below fixes in place.
 */

import { describe, expect, it } from "vitest";

import {
  errorDetail,
  failureMessage,
  graphHref,
  isTerminal,
  parseAvailability,
  parseJobResponse,
  parseSubmitAccepted,
  progressMessage,
  skippedSummary,
  skippedTotal,
  stageIndex,
  type JobView,
} from "./job-view";

/** A `done` body as `jobResponse` in the route builds it. */
function doneBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    repoId: "google-guava",
    name: "google/guava",
    sourceUrl: "https://github.com/google/guava",
    status: "done",
    stage: null,
    startedAt: "2026-09-10T10:00:00.000Z",
    finishedAt: "2026-09-10T10:00:15.000Z",
    error: null,
    skippedFiles: [],
    counts: { nodes: 1200, edges: 3400 },
    detail: "Indexed 1200 nodes and 3400 edges.",
    ...overrides,
  };
}

describe("parseJobResponse — a failed job carried by a non-200 status", () => {
  // The trap: `if (!res.ok) throw` would discard precisely this record.
  it.each([
    ["no-java-files at 422", "no-java-files", "No .java files were found in this repository."],
    ["too-large at 413", "too-large", "The repository exceeds the size cap."],
    ["fetch-failed at 502", "fetch-failed", "codeload.github.com answered 500."],
    ["repo-not-found at 422", "repo-not-found", "No such public repository."],
  ])("reads the record for %s", (_label, code, message) => {
    const job = parseJobResponse(
      doneBody({
        status: "failed",
        error: { code, message },
        counts: { nodes: 0, edges: 0 },
        detail: message,
      }),
    );
    expect(job).not.toBeNull();
    expect(job?.status).toBe("failed");
    expect(job?.error).toEqual({ code, message });
    expect(failureMessage(job)).toBe(message);
  });

  it("prefers error.message over the rendered detail", () => {
    const job = parseJobResponse(
      doneBody({
        status: "failed",
        error: { code: "parse-failed", message: "The parser gave up." },
        detail: "a less specific summary",
      }),
    );
    expect(failureMessage(job)).toBe("The parser gave up.");
  });

  it("falls back to detail when a failed job carries no error object", () => {
    const job = parseJobResponse(doneBody({ status: "failed", error: null, detail: "It failed." }));
    expect(job?.error).toBeNull();
    expect(failureMessage(job)).toBe("It failed.");
  });
});

describe("parseJobResponse — bodies that are not job records", () => {
  it.each([
    // 404 and 503 both answer with detail alone; neither is a record.
    ["a detail-only 404 body", { detail: "Unknown job 'nope'." }],
    ["a detail-only 503 body", { detail: "Indexing is not configured on this server." }],
    ["a record with no repoId", { status: "running", name: "x" }],
    ["a record with an unknown status", { repoId: "a", status: "pending" }],
    ["a record with no status", { repoId: "a", name: "a/b" }],
    ["null", null],
    ["an array", [{ repoId: "a", status: "done" }]],
    ["a string", "done"],
    ["an empty repoId", { repoId: "", status: "done" }],
  ])("returns null for %s", (_label, body) => {
    expect(parseJobResponse(body)).toBeNull();
  });
});

describe("parseJobResponse — normalization", () => {
  it("keeps a valid stage and drops an invalid one", () => {
    expect(parseJobResponse(doneBody({ status: "running", stage: "parse" }))?.stage).toBe("parse");
    expect(parseJobResponse(doneBody({ status: "running", stage: "uploading" }))?.stage).toBeNull();
  });

  it("substitutes repoId for a missing display name", () => {
    const job = parseJobResponse({ repoId: "google-guava", status: "queued" });
    expect(job?.name).toBe("google-guava");
  });

  it("defaults absent or non-numeric counts to zero", () => {
    expect(parseJobResponse(doneBody({ counts: undefined }))?.counts).toEqual({ nodes: 0, edges: 0 });
    expect(parseJobResponse(doneBody({ counts: { nodes: "12", edges: null } }))?.counts).toEqual({
      nodes: 0,
      edges: 0,
    });
  });

  it("keeps skipped entries and their optional path", () => {
    const job = parseJobResponse(
      doneBody({
        skippedFiles: [
          { reason: "file-unparseable", message: "syntax error", path: "src/A.java" },
          { reason: "file-unreadable", message: "EACCES" },
          "not an object",
        ],
      }),
    );
    expect(job?.skippedFiles).toEqual([
      { reason: "file-unparseable", message: "syntax error", path: "src/A.java" },
      { reason: "file-unreadable", message: "EACCES" },
    ]);
  });

  it("normalizes a non-array skippedFiles to empty rather than throwing", () => {
    expect(parseJobResponse(doneBody({ skippedFiles: null }))?.skippedFiles).toEqual([]);
  });

  it("carries skippedFileCount only when the server sent one", () => {
    expect(parseJobResponse(doneBody())?.skippedFileCount).toBeUndefined();
    expect(parseJobResponse(doneBody({ skippedFileCount: 4021 }))?.skippedFileCount).toBe(4021);
  });

  it("reports a missing detail as null rather than the empty string", () => {
    expect(parseJobResponse(doneBody({ detail: undefined }))?.detail).toBeNull();
    expect(parseJobResponse(doneBody({ detail: "" }))?.detail).toBeNull();
  });
});

describe("skipped files", () => {
  const base = parseJobResponse(doneBody()) as JobView;

  it("says nothing when nothing was skipped", () => {
    expect(skippedTotal(base)).toBe(0);
    expect(skippedSummary(base)).toBeNull();
    expect(skippedSummary(null)).toBeNull();
  });

  it("prefers skippedFileCount, because the listed array is capped at 100", () => {
    const job: JobView = {
      ...base,
      skippedFiles: new Array(100).fill({ reason: "file-unparseable", message: "x" }),
      skippedFileCount: 4021,
    };
    expect(skippedTotal(job)).toBe(4021);
    expect(skippedSummary(job)).toContain("4021 files");
  });

  it("counts the array when the count is absent", () => {
    const job: JobView = { ...base, skippedFiles: [{ reason: "r", message: "m" }, { reason: "r", message: "m" }] };
    expect(skippedTotal(job)).toBe(2);
    expect(skippedSummary(job)).toBe(
      "2 files could not be parsed and were skipped. The rest of the repository was indexed.",
    );
  });

  it("agrees in the singular", () => {
    const job: JobView = { ...base, skippedFiles: [{ reason: "r", message: "m" }] };
    expect(skippedSummary(job)).toBe(
      "1 file could not be parsed and was skipped. The rest of the repository was indexed.",
    );
  });
});

describe("progressMessage", () => {
  const base = parseJobResponse(doneBody()) as JobView;

  it("names the stage and its position", () => {
    expect(progressMessage({ ...base, status: "running", stage: "fetch" })).toBe(
      "Fetching google/guava — step 1 of 3.",
    );
    expect(progressMessage({ ...base, status: "running", stage: "group" })).toBe(
      "Grouping google/guava — step 3 of 3.",
    );
  });

  it("covers queued, done and failed", () => {
    expect(progressMessage({ ...base, status: "queued", stage: null })).toBe("Queued google/guava.");
    expect(progressMessage(base)).toBe("Finished indexing google/guava: 1200 nodes, 3400 edges.");
    expect(
      progressMessage({ ...base, status: "failed", error: { code: "too-large", message: "Too big." } }),
    ).toBe("Indexing google/guava failed. Too big.");
  });

  it("handles a running job that has not entered a stage", () => {
    expect(progressMessage({ ...base, status: "running", stage: null })).toBe("Indexing google/guava.");
  });

  it("is a pure function of status and stage, so an unchanged poll re-announces nothing", () => {
    // The live region announces on text change. Two polls that returned the same
    // status and stage must therefore produce byte-identical strings — no
    // elapsed time, no counter.
    const a = parseJobResponse(doneBody({ status: "running", stage: "parse", startedAt: "2026-09-10T10:00:00.000Z" }));
    const b = parseJobResponse(doneBody({ status: "running", stage: "parse", startedAt: "2026-09-10T10:00:09.000Z" }));
    expect(progressMessage(a)).toBe(progressMessage(b));
  });

  it("is empty with no job", () => {
    expect(progressMessage(null)).toBe("");
  });
});

describe("parseSubmitAccepted", () => {
  it("reads the fresh-fork 202", () => {
    expect(
      parseSubmitAccepted({
        repoId: "google-guava",
        name: "google/guava",
        sourceUrl: "https://github.com/google/guava",
        status: "queued",
      }),
    ).toEqual({
      repoId: "google-guava",
      name: "google/guava",
      sourceUrl: "https://github.com/google/guava",
      status: "queued",
      detail: null,
    });
  });

  it("reads the already-indexing 202, which is a notice and not an error", () => {
    const accepted = parseSubmitAccepted({
      repoId: "google-guava",
      name: "google/guava",
      sourceUrl: "https://github.com/google/guava",
      status: "running",
      detail: "This repository is already being indexed.",
    });
    expect(accepted?.status).toBe("running");
    expect(accepted?.detail).toBe("This repository is already being indexed.");
  });

  it("returns null for a body with no repoId", () => {
    expect(parseSubmitAccepted({ detail: "Only github.com URLs are accepted." })).toBeNull();
    expect(parseSubmitAccepted(null)).toBeNull();
  });
});

describe("errorDetail", () => {
  it("returns the route's detail verbatim, because those strings are written for a person", () => {
    expect(
      errorDetail({ detail: "Only github.com URLs are accepted (got 'evil.example')." }, "fallback"),
    ).toBe("Only github.com URLs are accepted (got 'evil.example').");
  });

  it("reads a nested error.message when there is no detail", () => {
    expect(errorDetail({ error: { code: "x", message: "nested" } }, "fallback")).toBe("nested");
  });

  it("falls back for an unusable body", () => {
    expect(errorDetail(null, "fallback")).toBe("fallback");
    expect(errorDetail({}, "fallback")).toBe("fallback");
    expect(errorDetail({ detail: "" }, "fallback")).toBe("fallback");
    expect(errorDetail("<html>502 Bad Gateway</html>", "fallback")).toBe("fallback");
  });
});

describe("parseAvailability", () => {
  it("reads the configured and busy flags", () => {
    expect(parseAvailability({ configured: true, busy: true, busyWith: "apache-commons-lang" })).toEqual({
      configured: true,
      busy: true,
      busyWith: "apache-commons-lang",
    });
  });

  it("treats an unreadable body as unconfigured rather than guessing it is ready", () => {
    expect(parseAvailability(null)).toEqual({ configured: false, busy: false, busyWith: null });
  });

  it("requires literal true, so a truthy string does not read as configured", () => {
    expect(parseAvailability({ configured: "yes", busy: 1 })).toEqual({
      configured: false,
      busy: false,
      busyWith: null,
    });
  });
});

describe("small helpers", () => {
  it("stops polling only on a terminal status", () => {
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("running")).toBe(false);
  });

  it("orders the stages", () => {
    expect(stageIndex("fetch")).toBe(0);
    expect(stageIndex("parse")).toBe(1);
    expect(stageIndex("group")).toBe(2);
    expect(stageIndex(null)).toBe(-1);
  });

  it("points at the viewer route the landing page links to", () => {
    expect(graphHref("google-guava")).toBe("/repos/google-guava/knowledge-graph");
  });
});
