/**
 * Minimal streaming tar reader for the ingest child (SPEC item 3).
 *
 * Hand-rolled rather than pulled in as a dependency because this tree has no
 * tar library in `node_modules` and adding one to `@repohive/web` would put it
 * in the Next.js dependency graph for the sake of a script that never runs
 * inside Next. It reads only what a GitHub codeload tarball actually contains.
 *
 * Plain `.mjs`, not TypeScript, because this runs in the forked child against a
 * real `node_modules` with no build step and no loader — the web package is
 * `noEmit`, so a `.ts` file here would have no on-disk JS at runtime. It is
 * therefore outside `tsc --noEmit`'s reach; the contract with the child is the
 * argument shape documented on each export.
 *
 * Two things it deliberately does that a general-purpose extractor would not:
 *
 * 1. **Extracts only `.java` files**, discarding every other member without
 *    touching the disk. The collector includes a file only if it ends `.java`
 *    case-sensitively, so everything else is dead weight — on a large repo the
 *    majority of the bytes. Exclusion *directories* (`target`, `build`, …) are
 *    still extracted, so the collector applies its own policy to the same tree
 *    a real checkout would have given it.
 * 2. **Enforces caps mid-stream** and aborts, rather than validating a finished
 *    download. A cap that only fires after the bytes are on disk is not a cap.
 */

import { createWriteStream, mkdirSync } from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as zlib from "node:zlib";

const BLOCK = 512;

/** Thrown when a resource cap is tripped. Mapped to the `too-large` job code. */
export class LimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "LimitError";
    this.code = "too-large";
  }
}

/** Thrown when the archive is not readable as a tar stream. */
export class ArchiveError extends Error {
  constructor(message) {
    super(message);
    this.name = "ArchiveError";
    this.code = "fetch-failed";
  }
}

/** Parse an octal numeric tar header field, tolerating NUL/space padding. */
function readOctal(block, offset, length) {
  let text = block.subarray(offset, offset + length).toString("latin1");
  const nul = text.indexOf("\0");
  if (nul !== -1) text = text.slice(0, nul);
  text = text.trim();
  if (text === "") return 0;
  const value = Number.parseInt(text, 8);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Read a NUL-terminated string field. */
function readString(block, offset, length) {
  const raw = block.subarray(offset, offset + length);
  const nul = raw.indexOf(0);
  return (nul === -1 ? raw : raw.subarray(0, nul)).toString("utf8");
}

/** True when a 512-byte block is entirely zero — the end-of-archive marker. */
function isZeroBlock(block) {
  for (let i = 0; i < BLOCK; i += 1) {
    if (block[i] !== 0) return false;
  }
  return true;
}

/**
 * Extract the `path=` override from a pax extended header payload.
 * Records are `"<len> <key>=<value>\n"`.
 */
function paxPath(payload) {
  const text = payload.toString("utf8");
  let offset = 0;
  while (offset < text.length) {
    const space = text.indexOf(" ", offset);
    if (space === -1) break;
    const length = Number.parseInt(text.slice(offset, space), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = text.slice(space + 1, offset + length);
    const eq = record.indexOf("=");
    if (eq !== -1 && record.slice(0, eq) === "path") {
      return record.slice(eq + 1).replace(/\n$/, "");
    }
    offset += length;
  }
  return null;
}

/**
 * Strip the single wrapping directory GitHub adds (`<repo>-<sha>/`) and reject
 * anything that could escape the destination.
 *
 * Returns null for a member that must not be written: an absolute path, a `..`
 * segment, a drive-relative Windows path, or one that resolves outside `destDir`
 * after normalization. The final containment check is belt-and-braces over the
 * segment scan — normalization is where extractors usually get this wrong.
 */
function resolveMemberPath(destDir, memberName) {
  const cleaned = memberName.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = cleaned.split("/").filter((s) => s !== "" && s !== ".");
  // Drop the archive's wrapping directory.
  const inner = segments.slice(1);
  if (inner.length === 0) return null;
  if (inner.some((s) => s === "..")) return null;
  // A segment containing ':' would be a drive or ADS reference on Windows.
  if (inner.some((s) => s.includes(":"))) return null;

  const relative = inner.join("/");
  if (path.isAbsolute(relative)) return null;

  const full = path.resolve(destDir, relative);
  const back = path.relative(destDir, full);
  if (back === "" || back.startsWith("..") || path.isAbsolute(back)) return null;
  return full;
}

/**
 * Read `tarStream` and write every `.java` member under `destDir`.
 *
 * @param {import("node:stream").Readable} tarStream Inflated tar bytes.
 * @param {string} destDir Directory to extract into; created if absent.
 * @param {{maxExtractedBytes:number,maxFiles:number,maxFileBytes:number}} limits
 * @returns {Promise<{fileCount:number,totalBytes:number,oversizeSkipped:number}>}
 */
async function readTar(tarStream, destDir, limits) {
  let pending = Buffer.alloc(0);
  /**
   * Set once the end-of-archive marker is seen. From then on the remaining
   * bytes are discarded rather than parsed, and iteration is still carried to
   * the stream's natural end.
   *
   * Returning early instead would call the async iterator's `return()`, which
   * *destroys* the stream — and a destroyed stage makes `pipeline` reject with
   * its own premature-close error, burying the real reason a job failed. So the
   * loop always runs to completion and the result is returned afterwards.
   */
  let finished = false;
  let fileCount = 0;
  let totalBytes = 0;
  let oversizeSkipped = 0;
  let sawZeroBlock = false;

  // Carried from a GNU long-name or pax header onto the entry that follows it.
  let nextNameOverride = null;

  // Non-null while the body of an entry is being consumed.
  // { remaining, padding, target|null, chunks|null, written }
  let active = null;

  const madeDirs = new Set();
  const ensureDir = (dir) => {
    if (madeDirs.has(dir)) return;
    mkdirSync(dir, { recursive: true });
    madeDirs.add(dir);
  };
  ensureDir(destDir);

  const finishEntry = async () => {
    if (active.target !== null && active.chunks !== null) {
      const body = Buffer.concat(active.chunks);
      ensureDir(path.dirname(active.target));
      await pipeline(Readable.from(body), createWriteStream(active.target));
      fileCount += 1;
      totalBytes += body.byteLength;
    } else if (active.kind === "pax" || active.kind === "longname") {
      const payload = Buffer.concat(active.chunks ?? []);
      const name = active.kind === "pax" ? paxPath(payload) : readString(payload, 0, payload.length);
      if (name !== null && name !== "") nextNameOverride = name;
    }
    active = null;
  };

  for await (const chunk of tarStream) {
    // Past the end-of-archive marker the rest is padding and the gzip trailer:
    // keep draining so the stream ends on its own terms, but stop interpreting.
    if (finished) continue;
    pending = pending.length === 0 ? Buffer.from(chunk) : Buffer.concat([pending, chunk]);

    // Drain everything currently buffered before pulling the next chunk.
    for (;;) {
      if (active !== null) {
        if (pending.length === 0) break;
        // Body bytes first, then the padding to the next block boundary.
        if (active.remaining > 0) {
          const take = Math.min(active.remaining, pending.length);
          if (active.chunks !== null) {
            active.chunks.push(pending.subarray(0, take));
          }
          pending = pending.subarray(take);
          active.remaining -= take;
          if (active.remaining > 0) break;
        }
        if (active.padding > 0) {
          const skip = Math.min(active.padding, pending.length);
          pending = pending.subarray(skip);
          active.padding -= skip;
          if (active.padding > 0) break;
        }
        await finishEntry();
        continue;
      }

      if (pending.length < BLOCK) break;
      const header = pending.subarray(0, BLOCK);
      pending = pending.subarray(BLOCK);

      if (isZeroBlock(header)) {
        // Two consecutive zero blocks close the archive; one is tolerated.
        if (sawZeroBlock) {
          finished = true;
          break;
        }
        sawZeroBlock = true;
        continue;
      }
      sawZeroBlock = false;

      const size = readOctal(header, 124, 12);
      const typeflag = String.fromCharCode(header[156] === 0 ? 0x30 : header[156]);
      const padding = size % BLOCK === 0 ? 0 : BLOCK - (size % BLOCK);

      let name = nextNameOverride ?? readString(header, 0, 100);
      const prefix = readString(header, 345, 155);
      if (nextNameOverride === null && prefix !== "") name = `${prefix}/${name}`;

      if (typeflag === "x" || typeflag === "g" || typeflag === "L" || typeflag === "K") {
        // Metadata entry: buffer its payload, then apply it to the next header.
        if (size > 64 * 1024) throw new ArchiveError("tar metadata entry is implausibly large");
        active = {
          kind: typeflag === "x" || typeflag === "g" ? "pax" : "longname",
          remaining: size,
          padding,
          target: null,
          chunks: [],
        };
        continue;
      }

      // A real entry consumes any pending name override.
      nextNameOverride = null;

      const isFile = typeflag === "0" || typeflag === " ";
      const wanted = isFile && name.endsWith(".java");

      let target = null;
      if (wanted) {
        if (size > limits.maxFileBytes) {
          // One implausibly large file is not a reason to fail the repository;
          // it is a file the parser would not have got anything useful from.
          oversizeSkipped += 1;
        } else if (fileCount >= limits.maxFiles) {
          throw new LimitError(
            `Repository contains more than ${limits.maxFiles} Java files, which exceeds this demo's limit.`,
          );
        } else if (totalBytes + size > limits.maxExtractedBytes) {
          throw new LimitError(
            `Extracted Java sources exceed the ${limits.maxExtractedBytes}-byte limit for this demo.`,
          );
        } else {
          target = resolveMemberPath(destDir, name);
        }
      }

      active = {
        kind: "entry",
        remaining: size,
        padding,
        target,
        chunks: target !== null ? [] : null,
      };
    }
  }

  if (active !== null && active.remaining === 0) {
    await finishEntry();
  }
  return { fileCount, totalBytes, oversizeSkipped };
}

/**
 * Fetch a gzipped tarball and extract its `.java` members into `destDir`.
 *
 * The compressed byte cap is enforced against the wire, before inflation, so a
 * zip bomb is refused on the way in rather than after it has been expanded.
 *
 * @param {string} url Absolute https URL, constructed by the caller — never a
 *   URL supplied by a user (see `github-url.ts`).
 * @param {string} destDir
 * @param {{maxDownloadBytes:number,maxExtractedBytes:number,maxFiles:number,maxFileBytes:number}} limits
 * @param {AbortSignal} [signal]
 */
export async function fetchAndExtract(url, destDir, limits, signal) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "repohive-indexer", accept: "application/x-gzip" },
    ...(signal !== undefined ? { signal } : {}),
  });

  if (response.status === 404) {
    const error = new Error("Repository not found, or it is not public.");
    error.code = "repo-not-found";
    throw error;
  }
  if (!response.ok || response.body === null) {
    const error = new Error(`GitHub returned ${response.status} fetching the repository archive.`);
    error.code = "fetch-failed";
    throw error;
  }

  // Refuse on the advertised length when there is one, so an oversized archive
  // costs no bytes at all rather than being cut off partway through.
  const declared = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > limits.maxDownloadBytes) {
    throw new LimitError(
      `Repository archive is ${declared} bytes, over the ${limits.maxDownloadBytes}-byte limit for this demo.`,
    );
  }

  const body = response.body;
  async function* capped() {
    let total = 0;
    let drained = false;
    const reader = body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          drained = true;
          break;
        }
        total += value.byteLength;
        if (total > limits.maxDownloadBytes) {
          throw new LimitError(
            `Repository archive exceeds the ${limits.maxDownloadBytes}-byte download limit for this demo.`,
          );
        }
        yield value;
      }
    } finally {
      // A cap tripped downstream leaves the response body half-read. Without an
      // explicit cancel the socket stays open and its handle keeps the event
      // loop alive, so the child hangs instead of failing — the process has to
      // let go of the connection, not just of the reader.
      if (!drained) {
        try {
          await reader.cancel();
        } catch {
          /* connection already gone */
        }
      }
      try {
        reader.releaseLock();
      } catch {
        /* released by cancel() */
      }
    }
  }

  // A cap tripped inside `readTar` throws while the source is still producing,
  // and `pipeline` then tears down every stage — so the error it rejects with is
  // often its own teardown error ("The operation was aborted") rather than the
  // one that started it. The real cause is captured on the way past and rethrown
  // in preference, because the difference is a job.json reading `too-large`
  // instead of `internal-error`.
  let result;
  let failure;
  try {
    await pipeline(
      Readable.from(capped()),
      zlib.createGunzip(),
      async function (source) {
        try {
          result = await readTar(source, destDir, limits);
        } catch (cause) {
          failure = cause;
          throw cause;
        }
      },
      ...(signal !== undefined ? [{ signal }] : []),
    );
  } catch (cause) {
    throw failure ?? cause;
  }

  if (result === undefined || result.fileCount === 0) {
    // Zero `.java` members is the `no-java-files` condition, reached before the
    // parser ever runs. Reported with the parser's own reason so the route maps
    // it to the same clean 422 either way.
    const error = new Error("This repository contains no Java source files.");
    error.code = "no-java-files";
    throw error;
  }
  return result;
}
