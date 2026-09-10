/**
 * repo-registry.test.ts
 *
 * Unit tests for repo-registry.ts. The module touches the filesystem and reads
 * process.env.REPOHIVE_INDEX_ROOT, so both are mocked here — no real disk
 * access takes place.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dirent } from "node:fs";
import path from "node:path";

// Mock node:fs before importing the module under test so the mock is in place
// when the module is first evaluated.
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  getRegistryRepo,
  indexPresent,
  listRegistryRepos,
  resolveIndexDir,
  type RepoRegistryEntry,
} from "./repo-registry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INDEX_ROOT = "/data/indexes";

/** Minimal Dirent-like object sufficient for the registry's isDirectory() check. */
function fakeDir(name: string): Dirent<string> {
  return {
    name,
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    parentPath: INDEX_ROOT,
    path: INDEX_ROOT,
  } as unknown as Dirent<string>;
}

function goodJobJson(repoId: string, name: string, status = "done"): string {
  return JSON.stringify({ repoId, name, status, stage: null });
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(existsSync).mockReset();
  (readdirSync as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(readFileSync).mockReset();
  delete process.env.REPOHIVE_INDEX_ROOT;
});

// ---------------------------------------------------------------------------
// listRegistryRepos
// ---------------------------------------------------------------------------

describe("listRegistryRepos — fixtures fallback (no env var)", () => {
  it("returns the four checked-in fixture entries", () => {
    const repos = listRegistryRepos();
    expect(repos).toHaveLength(4);
    const ids = repos.map((r) => r.id);
    expect(ids).toContain("jsoup");
    expect(ids).toContain("vantage");
    expect(ids).toContain("broadleaf");
    expect(ids).toContain("sample-java-project");
  });

  it("does not call readdirSync when env var is absent", () => {
    listRegistryRepos();
    expect(readdirSync).not.toHaveBeenCalled();
  });
});

describe("listRegistryRepos — REPOHIVE_INDEX_ROOT set", () => {
  beforeEach(() => {
    process.env.REPOHIVE_INDEX_ROOT = INDEX_ROOT;
  });

  it("returns an empty array when the root directory does not exist", () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(listRegistryRepos()).toEqual([]);
  });

  it("enumerates subdirectories and reads names from job.json", () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([fakeDir("google-guava"), fakeDir("apache-kafka")]);
    vi.mocked(readFileSync).mockImplementation((p) => {
      // Build the expected suffix with path.join: the module under test joins
      // with the platform separator, so a hardcoded "/" suffix never matches on
      // Windows and this mock would fall through to the throw below.
      if (String(p).endsWith(path.join("google-guava", "job.json"))) return goodJobJson("google-guava", "google/guava");
      if (String(p).endsWith(path.join("apache-kafka", "job.json"))) return goodJobJson("apache-kafka", "apache/kafka");
      throw new Error("unexpected path");
    });

    const repos = listRegistryRepos();
    expect(repos).toHaveLength(2);
    expect(repos[0]).toMatchObject({ id: "google-guava", name: "google/guava", dir: "google-guava" });
    expect(repos[1]).toMatchObject({ id: "apache-kafka", name: "apache/kafka", dir: "apache-kafka" });
  });

  it("falls back to the directory name when job.json is missing", () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([fakeDir("mystery-repo")]);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const [repo] = listRegistryRepos();
    expect(repo).toMatchObject({ id: "mystery-repo", name: "mystery-repo", dir: "mystery-repo" });
  });

  it("falls back to the directory name when job.json is malformed JSON", () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([fakeDir("broken-repo")]);
    vi.mocked(readFileSync).mockReturnValue("{ this is not json");

    const [repo] = listRegistryRepos();
    expect(repo).toMatchObject({ id: "broken-repo", name: "broken-repo", dir: "broken-repo" });
  });

  it("falls back to the directory name when job.json is valid JSON but not an object", () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([fakeDir("array-repo")]);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(["not", "an", "object"]));

    const [repo] = listRegistryRepos();
    expect(repo).toMatchObject({ id: "array-repo", name: "array-repo", dir: "array-repo" });
  });

  it("ignores non-directory entries", () => {
    const file = { ...fakeDir("somefile.txt"), isDirectory: () => false } as unknown as Dirent;
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([fakeDir("real-repo"), file]);
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("real-repo", "Real Repo"));

    const repos = listRegistryRepos();
    expect(repos).toHaveLength(1);
    expect(repos[0].id).toBe("real-repo");
  });
});

// ---------------------------------------------------------------------------
// getRegistryRepo
// ---------------------------------------------------------------------------

describe("getRegistryRepo", () => {
  it("returns the matching entry in fixtures fallback mode", () => {
    const entry = getRegistryRepo("jsoup");
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("jsoup");
  });

  it("returns undefined for an unknown id", () => {
    expect(getRegistryRepo("does-not-exist")).toBeUndefined();
  });

  it("returns the matching entry when REPOHIVE_INDEX_ROOT is set", () => {
    process.env.REPOHIVE_INDEX_ROOT = INDEX_ROOT;
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([fakeDir("google-guava")]);
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("google-guava", "google/guava"));

    const entry = getRegistryRepo("google-guava");
    expect(entry?.name).toBe("google/guava");
  });

  it("returns undefined for an id not in the enumerated root", () => {
    process.env.REPOHIVE_INDEX_ROOT = INDEX_ROOT;
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([fakeDir("google-guava")]);
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("google-guava", "google/guava"));

    expect(getRegistryRepo("jsoup")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// indexPresent
// ---------------------------------------------------------------------------

describe("indexPresent — fixtures fallback (no env var)", () => {
  const fixtureEntry: RepoRegistryEntry = { id: "jsoup", name: "jsoup", dir: "jsoup" };

  it("returns true when metadata.json exists on disk", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(indexPresent(fixtureEntry)).toBe(true);
  });

  it("returns false when metadata.json is absent", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(indexPresent(fixtureEntry)).toBe(false);
  });

  it("does not read job.json in fixtures mode", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    indexPresent(fixtureEntry);
    // readFileSync is only used for job.json; it must not be called in fallback mode
    expect(readFileSync).not.toHaveBeenCalled();
  });
});

describe("indexPresent — REPOHIVE_INDEX_ROOT set", () => {
  const entry: RepoRegistryEntry = { id: "google-guava", name: "google/guava", dir: "google-guava" };

  beforeEach(() => {
    process.env.REPOHIVE_INDEX_ROOT = INDEX_ROOT;
  });

  it("returns false when job.json is missing", () => {
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error("ENOENT"); });
    expect(indexPresent(entry)).toBe(false);
  });

  it("returns false when status is 'queued'", () => {
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("google-guava", "google/guava", "queued"));
    expect(indexPresent(entry)).toBe(false);
  });

  it("returns false when status is 'running'", () => {
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("google-guava", "google/guava", "running"));
    expect(indexPresent(entry)).toBe(false);
  });

  it("returns false when status is 'failed'", () => {
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("google-guava", "google/guava", "failed"));
    expect(indexPresent(entry)).toBe(false);
  });

  it("returns false when status is 'done' but metadata.json is absent", () => {
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("google-guava", "google/guava", "done"));
    vi.mocked(existsSync).mockReturnValue(false);
    expect(indexPresent(entry)).toBe(false);
  });

  it("returns true when status is 'done' and metadata.json exists", () => {
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("google-guava", "google/guava", "done"));
    vi.mocked(existsSync).mockReturnValue(true);
    expect(indexPresent(entry)).toBe(true);
  });

  it("reads job.json from the correct path", () => {
    vi.mocked(readFileSync).mockReturnValue(goodJobJson("google-guava", "google/guava", "queued"));
    indexPresent(entry);
    const expectedJobPath = path.join(INDEX_ROOT, "google-guava", "job.json");
    expect(readFileSync).toHaveBeenCalledWith(expectedJobPath, "utf8");
  });
});

// ---------------------------------------------------------------------------
// resolveIndexDir
// ---------------------------------------------------------------------------

describe("resolveIndexDir", () => {
  const entry: RepoRegistryEntry = { id: "jsoup", name: "jsoup", dir: "jsoup" };

  it("uses fixtures layout when REPOHIVE_INDEX_ROOT is unset", () => {
    const result = resolveIndexDir(entry);
    // Should end with fixtures/jsoup/index, using the cwd-relative workspace root
    expect(result).toMatch(/fixtures[/\\]jsoup[/\\]index$/);
  });

  it("uses REPOHIVE_INDEX_ROOT when set", () => {
    process.env.REPOHIVE_INDEX_ROOT = INDEX_ROOT;
    const result = resolveIndexDir(entry);
    expect(result).toBe(path.join(INDEX_ROOT, "jsoup", "index"));
  });

  it("handles a different dir value correctly under the index root", () => {
    process.env.REPOHIVE_INDEX_ROOT = "/mnt/data";
    const custom: RepoRegistryEntry = { id: "foo-bar", name: "foo/bar", dir: "foo-bar" };
    expect(resolveIndexDir(custom)).toBe(path.join("/mnt/data", "foo-bar", "index"));
  });
});
