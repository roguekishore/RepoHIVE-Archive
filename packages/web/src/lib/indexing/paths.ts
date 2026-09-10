/**
 * Contract C1 — the on-disk layout, and the only module that knows it.
 *
 * ```
 * $REPOHIVE_INDEX_ROOT/<repoId>/
 *   index/       # the five-file set, written by group
 *   job.json     # everything index/ cannot carry
 * ```
 *
 * `repo-registry.ts` derives the same paths independently, by agreement through
 * C1 rather than through a shared import — the registry reads what the ingest
 * side writes and the two never call each other.
 *
 * Server-only.
 */

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { readJobFile } from "./job-file";
import { isValidRepoId, slugifyRepoId } from "./github-url";

/**
 * The configured index root, or null when `REPOHIVE_INDEX_ROOT` is unset.
 *
 * Ingest requires it: unlike the registry — which falls back to the checked-in
 * `fixtures/` so local dev keeps working — there is no sane fallback for
 * *writing*, and defaulting to `fixtures/` would let a demo scribble over
 * version-controlled test data. An unset variable is a 503, not a guess.
 */
export function indexRoot(): string | null {
  const root = process.env.REPOHIVE_INDEX_ROOT;
  return root !== undefined && root.trim() !== "" ? root : null;
}

/** `$REPOHIVE_INDEX_ROOT/<repoId>` — the per-repo directory of C1. */
export function repoDir(root: string, repoId: string): string {
  return path.join(root, repoId);
}

/** `$REPOHIVE_INDEX_ROOT/<repoId>/job.json` — the C2 sidecar. */
export function jobFilePath(root: string, repoId: string): string {
  return path.join(root, repoId, "job.json");
}

/** `$REPOHIVE_INDEX_ROOT/<repoId>/index` — the five-file set written by group. */
export function indexDir(root: string, repoId: string): string {
  return path.join(root, repoId, "index");
}

/** Create the index root if absent. First boot in a container hits this. */
export function ensureIndexRoot(root: string): void {
  mkdirSync(root, { recursive: true });
}

/**
 * Resolve a repoId for `sourceUrl`, applying C1's collision suffix.
 *
 * C1 says "slugified `owner-repo`, collision-suffixed" without saying what
 * counts as a collision. Re-submitting a repo that is already indexed is the
 * common case in a demo, and minting `google-guava-2` for it would accumulate
 * duplicate rows in the sidebar for one repository. So the rule here is:
 *
 * - base id free            → use it
 * - taken by *this* repo    → reuse it, re-indexing in place
 * - taken by another repo   → `-2`, `-3`, … until free
 *
 * Two different repos can slugify to one id (`a/b-c` and `a-b/c` both give
 * `a-b-c`), which is what the suffix exists for.
 */
export function allocateRepoId(root: string, owner: string, repo: string, sourceUrl: string): string {
  const base = slugifyRepoId(owner, repo);

  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (!isValidRepoId(candidate)) break;

    if (!existsSync(repoDir(root, candidate))) {
      return candidate;
    }
    // Occupied — reuse it only if it already holds this same repository.
    const existing = readJobFile(jobFilePath(root, candidate));
    if (existing?.sourceUrl === sourceUrl) {
      return candidate;
    }
  }

  // Pathological: 100 distinct repos colliding on one slug. Fall back to a
  // time-suffixed id rather than failing the request.
  return `${base}-${Date.now().toString(36)}`;
}
