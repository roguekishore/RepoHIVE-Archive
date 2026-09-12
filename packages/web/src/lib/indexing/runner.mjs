/**
 * The forked ingest child (SPEC item 3): fetch → parse → group → rename.
 *
 * This runs in its own process for a reason that is structural, not stylistic.
 * Both pipeline stages block the event loop — `groupGraphToIndex`
 * (`core/src/orchestrator.ts:299`) is fully synchronous and the parse extract
 * loop has no `await` — which on a broadleaf-scale repo is ~7 s + ~8 s of
 * frozen loop. In the Next.js process that freezes every other request. More
 * cores do not help; a separate process does. It is also what makes proxy and
 * edge timeouts a non-question: nothing holds a request open.
 *
 * Plain `.mjs`, not TypeScript: `@repohive/web` is `noEmit`, so a `.ts` file
 * here would have no on-disk JS at runtime, and there is no loader in the fork.
 * It requires no WASM configuration — it runs against a normal `node_modules`,
 * so the `require.resolve` calls at `ast-extractor.ts:137` work as-is.
 *
 * Invocation: `node runner.mjs <specPath>`, where the spec is the JSON written
 * by `fork-job.ts`. The initial `job.json` record arrives inside that spec
 * rather than being rebuilt here, so the C2 field set has exactly one authoring
 * site (`job-file.ts`) and this file only ever mutates and re-writes it.
 *
 * The exit code is advisory. `job.json` is the real result — the parent
 * reconciles a child that dies without reaching a terminal status.
 */

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import { parseProject } from "@repohive/parser";
import { groupGraphToIndex, readGraphFile, describeError } from "@repohive/core";

import { fetchAndExtract } from "./tar.mjs";

const specPath = process.argv[2];
if (specPath === undefined) {
  process.stderr.write("runner.mjs: missing spec path argument\n");
  process.exit(2);
}

/**
 * @type {{
 *   repoId: string, owner: string, repo: string, sourceUrl: string,
 *   jobFile: string, repoDir: string, workDir: string,
 *   indexDir: string, stagingDir: string,
 *   limits: { maxDownloadBytes: number, maxExtractedBytes: number,
 *             maxFiles: number, maxFileBytes: number, jobTimeoutMs: number },
 *   job: object
 * }}
 */
const spec = JSON.parse(readFileSync(specPath, "utf8"));

/** The live C2 record. Mutated in place, flushed atomically by `flush`. */
const job = spec.job;

/**
 * Write `job.json` atomically.
 *
 * The registry reads this file from the Next.js process on every request and
 * treats a parse failure as "repo not present", so a torn read would silently
 * drop a finished repo out of the sidebar. tmp + rename within one directory is
 * atomic on both POSIX and NTFS, so a reader sees the old file or the new one.
 */
function flush() {
  mkdirSync(path.dirname(spec.jobFile), { recursive: true });
  const tmp = `${spec.jobFile}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  renameSync(tmp, spec.jobFile);
}

function setStage(stage) {
  job.status = "running";
  job.stage = stage;
  flush();
}

function fail(code, message) {
  job.status = "failed";
  job.stage = null;
  job.finishedAt = new Date().toISOString();
  job.error = { code, message };
  flush();
}

function quietRemove(target) {
  try {
    rmSync(target, { recursive: true, force: true });
  } catch {
    /* best effort — a leftover work directory is not worth failing a job for */
  }
}

/** Cap mirrored from `job-file.ts`; job.json is re-read on every request. */
const MAX_PERSISTED_SKIPPED_FILES = 100;

function recordSkipped(skipped) {
  const all = Array.isArray(skipped) ? skipped : [];
  if (all.length > MAX_PERSISTED_SKIPPED_FILES) {
    job.skippedFiles = all.slice(0, MAX_PERSISTED_SKIPPED_FILES);
    job.skippedFileCount = all.length;
  } else {
    // Normalized to [] on a clean run: C3 makes the parser omit the field when
    // nothing was skipped, but C2's example shows [] and a reader should not
    // have to tell "absent" from "none".
    job.skippedFiles = all;
  }
}

/**
 * Promote the staged index into place with a rename, so a half-written index is
 * never visible to the registry.
 *
 * `serializeIndex` already writes the five files all-or-nothing into whatever
 * directory it is given; this is the second half of the guarantee — that
 * directory is a staging name until the whole set is complete, and only then
 * does it become `index/`.
 *
 * Re-indexing needs three renames rather than one: a directory rename onto a
 * non-empty target fails on both POSIX (ENOTEMPTY) and Windows. The window in
 * which `index/` is absent is one metadata operation wide, and `job.json` still
 * says `running` throughout it, so the registry is not advertising the repo
 * anyway.
 */
function promoteIndex() {
  const retired = `${spec.indexDir}.retired-${process.pid}`;
  let hadPrevious = false;
  try {
    renameSync(spec.indexDir, retired);
    hadPrevious = true;
  } catch {
    /* no previous index — the common case */
  }
  try {
    renameSync(spec.stagingDir, spec.indexDir);
  } catch (cause) {
    // Put the old index back rather than leaving the repo with none.
    if (hadPrevious) {
      try {
        renameSync(retired, spec.indexDir);
      } catch {
        /* nothing further can be done here */
      }
    }
    throw cause;
  }
  if (hadPrevious) quietRemove(retired);
}

async function run() {
  const srcDir = path.join(spec.workDir, "src");
  const graphPath = path.join(spec.workDir, "graph.json");

  mkdirSync(spec.workDir, { recursive: true });
  // A staging directory left by a killed predecessor would otherwise be
  // promoted with stale contents.
  quietRemove(spec.stagingDir);

  // --- fetch -------------------------------------------------------------
  setStage("fetch");
  // Built from a hardcoded host plus the validated owner/repo pair — never from
  // the URL the user submitted. `HEAD` resolves to the default branch, so no
  // GitHub API call and no main-vs-master guess is needed.
  const tarUrl = `https://codeload.github.com/${spec.owner}/${spec.repo}/tar.gz/HEAD`;
  await fetchAndExtract(tarUrl, srcDir, spec.limits);

  // --- parse -------------------------------------------------------------
  setStage("parse");
  const parsed = await parseProject({
    projectDirectory: srcDir,
    outputPath: graphPath,
    // Contract C3. Without it a single unreadable or non-compiling file
    // discards the whole graph — the wrong trade for an arbitrary repository,
    // where one bad file is expected and a lost graph is not.
    tolerateFileErrors: true,
  });

  if (!parsed.ok) {
    const first = parsed.errors[0];
    const reason = first?.reason ?? "internal-error";
    // A repo with no Java in it is a normal outcome, not a server error; the
    // route turns this code into a clean 422.
    const code = reason === "no-java-files" ? "no-java-files" : "parse-failed";
    const detail = parsed.errors
      .slice(0, 5)
      .map((e) => (e.path !== undefined ? `${e.reason} (${e.path}): ${e.message}` : `${e.reason}: ${e.message}`))
      .join("; ");
    fail(code, detail === "" ? `Parse failed: ${reason}` : detail);
    return;
  }

  recordSkipped(parsed.value.skippedFiles);
  flush();

  // --- group -------------------------------------------------------------
  setStage("group");
  const graph = readGraphFile(graphPath);
  if (!graph.ok) {
    fail("group-failed", `Could not read the parsed graph: ${describeError(graph.error)}`);
    return;
  }

  const grouped = await groupGraphToIndex(graph.value, spec.stagingDir);
  if (!grouped.ok) {
    fail("group-failed", describeError(grouped.error));
    return;
  }

  promoteIndex();

  // --- done --------------------------------------------------------------
  const hierarchy = grouped.value.hierarchy;
  job.counts = {
    // The hierarchy's own counts, matching repository.json, so a client reading
    // both files never sees two different node counts for one repo.
    nodes: hierarchy.nodes.size,
    edges: hierarchy.leafEdges.length + hierarchy.crossGroupEdges.length,
  };
  job.stage = null;
  job.finishedAt = new Date().toISOString();
  job.error = null;
  // Written last, after index/ is in place: `status: "done"` is the flag the
  // registry gates browsability on, so it must never lead the thing it
  // advertises.
  job.status = "done";
  flush();
}

try {
  await run();
  quietRemove(spec.workDir);
  process.exit(job.status === "done" ? 0 : 1);
} catch (cause) {
  const code = typeof cause?.code === "string" && cause.code !== "" ? cause.code : "internal-error";
  const known = new Set(["no-java-files", "fetch-failed", "repo-not-found", "too-large", "parse-failed", "group-failed"]);
  fail(
    known.has(code) ? code : "internal-error",
    cause instanceof Error ? cause.message : String(cause),
  );
  quietRemove(spec.workDir);
  quietRemove(spec.stagingDir);
  process.exit(1);
}
