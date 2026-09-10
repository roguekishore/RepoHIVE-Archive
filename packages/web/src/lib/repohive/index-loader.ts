/**
 * Index_Loader (spec R4) — the single component of the viewer that reads the
 * filesystem.
 *
 * It parses an Index_Directory using the grouping package's own parser
 * (`@repohive/core` `parseIndex`), so the viewer and the engine agree on
 * exactly what constitutes a valid index (R4.2). On failure it returns the
 * parser's own error (Result), which the route handler turns into a clear HTTP
 * response carrying the reason and the file involved (R4.3/R4.4).
 *
 * Server-only: this module reads from disk. Import it only from Route Handlers
 * or other server code, never from a client component.
 */

import { parseIndex, describeError } from "@repohive/core";
import type { Hierarchy, Metadata, Result } from "@repohive/core";
import { statSync } from "node:fs";
import { join } from "node:path";

export type LoadedIndex = { hierarchy: Hierarchy; metadata: Metadata };

// ---------------------------------------------------------------------------
// In-process LRU cache — keyed by `dir::mtimeMs` of metadata.json.
// A re-indexed repo changes metadata.json's mtime, which changes the key and
// naturally invalidates the cached entry. Cap at CACHE_MAX entries so that a
// demo serving several large repos (each ~36 MB in memory) does not grow
// without bound.
// ---------------------------------------------------------------------------

const CACHE_MAX = 5;

/** Ordered map used as an LRU store: oldest entry first, newest entry last. */
const cache = new Map<string, Result<LoadedIndex>>();

function cacheGet(key: string): Result<LoadedIndex> | undefined {
  const entry = cache.get(key);
  if (entry === undefined) return undefined;
  // Promote to most-recently-used by moving to the tail.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key: string, value: Result<LoadedIndex>): void {
  if (cache.has(key)) cache.delete(key);
  if (cache.size >= CACHE_MAX) {
    // Evict least-recently-used (head of the insertion-ordered map).
    const lruKey = cache.keys().next().value;
    if (lruKey !== undefined) cache.delete(lruKey);
  }
  cache.set(key, value);
}

/** Read + parse the five-file Index_File_Set at `dir`. */
export function loadIndex(dir: string): Result<LoadedIndex> {
  // Use mtime=0 when metadata.json is absent; parseIndex will return
  // MISSING_FILES. Once the file exists its real mtime produces a different
  // key, so a freshly-written index is never served from the error entry.
  let mtime = 0;
  try {
    mtime = statSync(join(dir, "metadata.json")).mtimeMs;
  } catch {
    // file not present yet — fall through
  }

  const key = `${dir}::${mtime}`;
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;

  const result = parseIndex(dir);
  cacheSet(key, result);
  return result;
}

export { describeError };
export type { Hierarchy, Metadata };
