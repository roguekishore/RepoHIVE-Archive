/**
 * RepoHIVE repo registry — maps a stable, URL-safe repo id to the directory
 * that holds its `index/` set and `job.json`.
 *
 * Two modes:
 *   REPOHIVE_INDEX_ROOT set   → enumerate that directory with readdirSync;
 *                               take the display name from job.json (C2);
 *                               indexPresent requires status:"done" (C2).
 *   REPOHIVE_INDEX_ROOT unset → fall back to the four checked-in fixtures so
 *                               local dev keeps working without any env config.
 *
 * This is deliberately the only place that knows a repo id maps to a directory
 * on disk. When a real store is wired in later, only this module and
 * index-loader.ts change — the endpoints and the ZoomMap contract stay put.
 *
 * Server-only: resolveIndexDir and indexPresent touch the filesystem. Do not
 * import this module into client components.
 *
 * Contract C4 freezes the four public signatures; REPO_REGISTRY is internal.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface RepoRegistryEntry {
  /** Stable, human, URL-safe id used in routes and as the RepoResponse id. */
  id: string;
  /** Display name (repository root label / project name in the ZoomMap). */
  name: string;
  /** Directory name under the index root (or `fixtures/`) holding this repo. */
  dir: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Shape we care about from job.json (C2). Other fields are ignored. */
interface JobJson {
  repoId?: unknown;
  name?: unknown;
  status?: unknown;
}

/**
 * Read and parse job.json safely. A missing or malformed file returns null —
 * the directory is written by a concurrent child process, so a half-written
 * file is a normal state, not an exceptional one.
 */
function readJobJson(jobPath: string): JobJson | null {
  try {
    const text = readFileSync(jobPath, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JobJson;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The four checked-in fixtures used when REPOHIVE_INDEX_ROOT is unset.
 * Keeps local dev and CI working without any environment configuration.
 */
const FIXTURE_ENTRIES: readonly RepoRegistryEntry[] = [
  { id: "jsoup",                name: "jsoup",                dir: "jsoup" },
  { id: "vantage",              name: "vantage",              dir: "vantage" },
  { id: "broadleaf",            name: "broadleaf",            dir: "broadleaf" },
  { id: "sample-java-project",  name: "sample-java-project",  dir: "sample-java-project" },
] as const;

/**
 * Build the registry from the current environment.
 *
 * Called on every public-function entry so the env var is re-evaluated each
 * time. In production the Next.js process is long-lived, so this costs at most
 * one readdirSync per request — negligible for demo scale.
 */
function buildRegistry(): readonly RepoRegistryEntry[] {
  const indexRoot = process.env.REPOHIVE_INDEX_ROOT;
  if (!indexRoot) return FIXTURE_ENTRIES;

  let dirents: import("node:fs").Dirent<string>[];
  try {
    dirents = readdirSync(indexRoot, { withFileTypes: true, encoding: "utf8" });
  } catch {
    // Index root does not exist yet (container first boot, etc.). Return empty
    // rather than crashing; routes will get 404s until jobs land.
    return [];
  }

  return dirents
    .filter((d) => d.isDirectory())
    .map((d): RepoRegistryEntry => {
      const dir = d.name;
      const job = readJobJson(path.join(indexRoot, dir, "job.json"));
      const id   = typeof job?.repoId === "string" && job.repoId ? job.repoId : dir;
      const name = typeof job?.name   === "string" && job.name   ? job.name   : dir;
      return { id, name, dir };
    });
}

// ---------------------------------------------------------------------------
// Public API — signatures frozen by contract C4
// ---------------------------------------------------------------------------

/** All registry entries, in enumeration order. */
export function listRegistryRepos(): readonly RepoRegistryEntry[] {
  return buildRegistry();
}

/** The entry for `id`, or `undefined` if the id is not registered. */
export function getRegistryRepo(id: string): RepoRegistryEntry | undefined {
  return buildRegistry().find((r) => r.id === id);
}

/**
 * Whether this repo's index is present and ready to browse.
 *
 * When REPOHIVE_INDEX_ROOT is set the job must carry `status:"done"` — a
 * queued, running or failed job must never appear as a browsable repo (C2).
 * In fixtures fallback mode the status check is skipped (no job.json exists).
 *
 * In both modes the physical metadata.json is checked so a stale registry
 * entry pointing at a missing directory returns false cleanly.
 *
 * Server-only.
 */
export function indexPresent(entry: RepoRegistryEntry): boolean {
  const indexRoot = process.env.REPOHIVE_INDEX_ROOT;
  if (indexRoot) {
    const job = readJobJson(path.join(indexRoot, entry.dir, "job.json"));
    if (job?.status !== "done") return false;
  }
  return existsSync(path.join(resolveIndexDir(entry), "metadata.json"));
}

/**
 * Absolute path to a repo's `index/` directory on disk.
 *
 * When REPOHIVE_INDEX_ROOT is set: `$REPOHIVE_INDEX_ROOT/<dir>/index`.
 * Otherwise: `<workspaceRoot>/fixtures/<dir>/index`, where the workspace root
 * is two levels above process.cwd() (the web package root).
 *
 * Server-only.
 */
export function resolveIndexDir(entry: RepoRegistryEntry): string {
  const indexRoot = process.env.REPOHIVE_INDEX_ROOT;
  if (indexRoot) {
    return path.join(indexRoot, entry.dir, "index");
  }
  const workspaceRoot = path.resolve(process.cwd(), "..", "..");
  return path.join(workspaceRoot, "fixtures", entry.dir, "index");
}
