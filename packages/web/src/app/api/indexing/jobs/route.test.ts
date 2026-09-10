/**
 * route.test.ts — GET /api/indexing/jobs
 *
 * Two mocking notes, both forced by the environment rather than chosen:
 *
 * 1. `node:fs` is mocked, following `repo-registry.test.ts`, so no real disk is
 *    touched. `REPOHIVE_INDEX_ROOT` is set per test and restored after.
 * 2. The two `@/lib/indexing/*` specifiers are re-pointed at the *same real
 *    modules* through a relative path. `vitest.config.ts` sets only
 *    `test.include` and configures no alias, so `@/` does not resolve under
 *    vitest at all — every other test in this package imports relatively and so
 *    never hits it. A `vi.mock` factory is consulted before resolution, which is
 *    what makes this work. The real `readJobFile` therefore runs, so C2
 *    validation and the route's enumeration are exercised together rather than
 *    the route being checked against a stub of its own helper.
 */

import path from "node:path";
import type { Dirent } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  renameSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Not stubs — the real modules, reached by a path vitest can resolve.
vi.mock("@/lib/indexing/job-file", () => import("../../../../lib/indexing/job-file"));
vi.mock("@/lib/indexing/paths", () => import("../../../../lib/indexing/paths"));

import { readdirSync, readFileSync } from "node:fs";

import type { JobRecord } from "../../../../lib/indexing/job-file";
import { GET } from "./route";

const INDEX_ROOT = path.join(path.sep, "data", "indexes");
const ORIGINAL_ROOT = process.env.REPOHIVE_INDEX_ROOT;

/** A Dirent stub sufficient for the route's isDirectory() check. */
function dirent(name: string, isDir = true): Dirent<string> {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isSymbolicLink: () => false,
  } as unknown as Dirent<string>;
}

function job(over: Partial<JobRecord> & { repoId: string }): JobRecord {
  return {
    name: over.repoId,
    sourceUrl: `https://github.com/acme/${over.repoId}`,
    status: "done",
    stage: null,
    startedAt: "2026-09-10T12:00:00.000Z",
    finishedAt: null,
    error: null,
    skippedFiles: [],
    counts: { nodes: 0, edges: 0 },
    ...over,
  };
}

/**
 * Wire readdir/readFile from a directory-name map. A `null` value means the
 * job.json is absent; a raw string is written through verbatim, which is how a
 * half-written file is simulated.
 */
function onDisk(entries: Record<string, JobRecord | string | null>): void {
  vi.mocked(readdirSync).mockReturnValue(
    Object.keys(entries).map((n) => dirent(n)) as never,
  );
  // Keyed on the exact path the route builds, so a wrong join fails the test
  // rather than passing through a loose substring match.
  const byPath = new Map<string, JobRecord | string | null>(
    Object.entries(entries).map(([n, v]) => [path.join(INDEX_ROOT, n, "job.json"), v]),
  );
  vi.mocked(readFileSync).mockImplementation(((file: string) => {
    const found = byPath.get(file);
    if (found === undefined || found === null) throw new Error("ENOENT");
    return typeof found === "string" ? found : JSON.stringify(found);
  }) as never);
}

interface Body {
  jobs: JobRecord[];
  total: number;
  truncated: boolean;
}

async function body(): Promise<Body> {
  const res = await GET();
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  return (await res.json()) as Body;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REPOHIVE_INDEX_ROOT = INDEX_ROOT;
});

afterEach(() => {
  if (ORIGINAL_ROOT === undefined) delete process.env.REPOHIVE_INDEX_ROOT;
  else process.env.REPOHIVE_INDEX_ROOT = ORIGINAL_ROOT;
});

describe("GET /api/indexing/jobs", () => {
  it("returns an empty list and 200 when the index root is unset", async () => {
    delete process.env.REPOHIVE_INDEX_ROOT;
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ jobs: [], total: 0, truncated: false });
    // The whole point: a fixtures-only box must not look broken.
    expect(readdirSync).not.toHaveBeenCalled();
  });

  it("returns an empty list when the root does not exist yet", async () => {
    vi.mocked(readdirSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const { jobs, total } = await body();
    expect(jobs).toEqual([]);
    expect(total).toBe(0);
  });

  it("lists jobs of every status, not just done", async () => {
    onDisk({
      a: job({ repoId: "a", status: "done", startedAt: "2026-09-10T10:00:00.000Z" }),
      b: job({
        repoId: "b",
        status: "running",
        stage: "parse",
        startedAt: "2026-09-10T11:00:00.000Z",
      }),
      c: job({
        repoId: "c",
        status: "failed",
        startedAt: "2026-09-10T12:00:00.000Z",
        error: { code: "no-java-files", message: "no .java files" },
      }),
    });
    const { jobs, total, truncated } = await body();
    expect(jobs.map((j) => j.status)).toEqual(["failed", "running", "done"]);
    expect(total).toBe(3);
    expect(truncated).toBe(false);
    expect(jobs[0].error?.message).toBe("no .java files");
    expect(jobs[1].stage).toBe("parse");
  });

  it("sorts newest first and tie-breaks on repoId", async () => {
    const same = "2026-09-10T10:00:00.000Z";
    onDisk({
      zeta: job({ repoId: "zeta", startedAt: same }),
      alpha: job({ repoId: "alpha", startedAt: same }),
      newer: job({ repoId: "newer", startedAt: "2026-09-10T11:00:00.000Z" }),
    });
    const first = (await body()).jobs.map((j) => j.repoId);
    expect(first).toEqual(["newer", "alpha", "zeta"]);

    // The same set in a different readdir order must give the same answer, or
    // rows would swap places between two polls two seconds apart.
    onDisk({
      alpha: job({ repoId: "alpha", startedAt: same }),
      newer: job({ repoId: "newer", startedAt: "2026-09-10T11:00:00.000Z" }),
      zeta: job({ repoId: "zeta", startedAt: same }),
    });
    expect((await body()).jobs.map((j) => j.repoId)).toEqual(first);
  });

  it("skips dotfiles, non-directories, and unreadable or torn job files", async () => {
    onDisk({
      ".work": job({ repoId: "work" }),
      missing: null,
      // A child is mid-write. Normal state, not an error.
      torn: '{"repoId":"torn","name":',
      good: job({ repoId: "good", status: "running", stage: "group" }),
    });
    // `.job.lock` and a stray file are entries under the root but not repos.
    vi.mocked(readdirSync).mockReturnValue([
      dirent(".work"),
      dirent(".job.lock", false),
      dirent("notes.txt", false),
      dirent("missing"),
      dirent("torn"),
      dirent("good"),
    ] as never);

    const { jobs, total } = await body();
    expect(jobs.map((j) => j.repoId)).toEqual(["good"]);
    expect(total).toBe(1);
  });

  it("caps the list at 100 and reports the true total", async () => {
    const entries: Record<string, JobRecord> = {};
    for (let i = 0; i < 105; i += 1) {
      const repoId = `repo-${String(i).padStart(3, "0")}`;
      // Ascending time, so the newest are the ones that must survive the cap.
      entries[repoId] = job({
        repoId,
        startedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      });
    }
    onDisk(entries);
    const { jobs, total, truncated } = await body();
    expect(jobs).toHaveLength(100);
    expect(total).toBe(105);
    expect(truncated).toBe(true);
    expect(jobs[0].repoId).toBe("repo-104");
    expect(jobs.at(-1)?.repoId).toBe("repo-005");
  });

  it("sorts a record with an unusable startedAt to the end", async () => {
    onDisk({
      // readJobFile normalizes a non-string timestamp to "", which Date.parse
      // rejects. It must not sort as newest, and must not crash the comparator.
      broken: { ...job({ repoId: "broken" }), startedAt: 0 } as unknown as JobRecord,
      fine: job({ repoId: "fine", startedAt: "2020-01-01T00:00:00.000Z" }),
    });
    const { jobs } = await body();
    expect(jobs.map((j) => j.repoId)).toEqual(["fine", "broken"]);
    expect(jobs[1].startedAt).toBe("");
  });
});
