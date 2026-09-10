/**
 * Resource caps for the ingest pipeline (SPEC item 5 — guard rails).
 *
 * `POST /api/index` is public and unauthenticated, so every unbounded quantity
 * in the pipeline is a denial-of-service lever. These are the bounds; they are
 * resolved in the parent and handed to the child as JSON, so the caps a job ran
 * under are fixed at fork time and there is one definition of them rather than
 * one per process.
 *
 * Every value is overridable by environment variable for the container, which
 * is the only place that knows how big the bind-mounted disk actually is.
 */

export interface IngestLimits {
  /** Cap on compressed bytes accepted from codeload, before inflation. */
  maxDownloadBytes: number;
  /** Cap on total bytes written to disk during extraction. */
  maxExtractedBytes: number;
  /** Cap on the number of `.java` files extracted. */
  maxFiles: number;
  /** Cap on any single extracted file. Larger files are skipped, not fatal. */
  maxFileBytes: number;
  /** Wall-clock budget for the whole child, after which it is killed. */
  jobTimeoutMs: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * The defaults are sized against the largest repo this pipeline is known to
 * handle: the broadleaf fixture, whose `index/` alone is 36 MB. They leave room
 * for something several times that while still refusing a repo that could fill
 * a demo disk.
 *
 * `jobTimeoutMs` is generous for the same reason — a cold broadleaf-scale parse
 * measures ~57 s, so a 15-minute ceiling catches a hang without cutting off a
 * large repo that is merely slow.
 */
export function resolveLimits(): IngestLimits {
  return {
    maxDownloadBytes: envInt("REPOHIVE_MAX_DOWNLOAD_BYTES", 150 * 1024 * 1024),
    maxExtractedBytes: envInt("REPOHIVE_MAX_EXTRACTED_BYTES", 400 * 1024 * 1024),
    maxFiles: envInt("REPOHIVE_MAX_FILES", 40_000),
    maxFileBytes: envInt("REPOHIVE_MAX_FILE_BYTES", 8 * 1024 * 1024),
    jobTimeoutMs: envInt("REPOHIVE_JOB_TIMEOUT_MS", 15 * 60 * 1000),
  };
}
