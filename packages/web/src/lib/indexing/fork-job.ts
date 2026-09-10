/**
 * Forking the ingest child, and the single-job lock that gates it
 * (SPEC item 3 + item 5's "one job at a time").
 *
 * The lock is a **file**, not a module-level boolean. A boolean would be scoped
 * to one Node process, and Next.js is free to run more than one — so the
 * guarantee people actually care about (this box runs one CPU-burning parse at a
 * time) would quietly not hold. The lock lives next to the indexes, is acquired
 * with an exclusive create, and names the pids involved so a crashed child
 * cannot wedge the endpoint permanently.
 *
 * The lock records **two** pids, which matters more than it looks. `ownerPid` is
 * the server process that reserved it and `childPid` is the forked worker; only
 * the child is ever signalled. Recording one pid and killing it on timeout would
 * mean a job hung inside a synchronous stage takes down the web server that
 * forked it.
 *
 * Server-only.
 */

import { fork } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import path from "node:path";

import { indexDir, jobFilePath, repoDir } from "./paths";
import { resolveLimits, type IngestLimits } from "./limits";
import type { JobRecord } from "./job-file";

/**
 * How long a lock may sit with no child pid recorded. The fork follows
 * acquisition within milliseconds, so this only ever catches a server that died
 * between the two.
 */
const RESERVATION_GRACE_MS = 60_000;

/** The lock file, a direct child of the index root. */
function lockPath(root: string): string {
  // Dot-prefixed and a plain file, so the registry's `readdirSync` +
  // `isDirectory()` enumeration never sees it as a repo.
  return path.join(root, ".job.lock");
}

/** Where source trees are extracted. Overridable for a separate scratch disk. */
function workRoot(root: string): string {
  const override = process.env.REPOHIVE_WORK_ROOT;
  if (override !== undefined && override.trim() !== "") return override;
  return path.join(root, ".work");
}

interface LockContents {
  /** The server process that reserved the lock. Never signalled. */
  ownerPid: number;
  /** The forked worker, or null between reservation and fork. */
  childPid: number | null;
  repoId: string;
  acquiredAt: string;
}

function readLock(root: string): LockContents | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(lockPath(root), "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const { ownerPid, childPid, repoId, acquiredAt } = parsed as Record<string, unknown>;
    if (typeof ownerPid !== "number" || typeof repoId !== "string") return null;
    return {
      ownerPid,
      childPid: typeof childPid === "number" ? childPid : null,
      repoId,
      acquiredAt: typeof acquiredAt === "string" ? acquiredAt : "",
    };
  } catch {
    return null;
  }
}

/** Overwrite the lock atomically, to add the child pid after forking. */
function writeLock(root: string, contents: LockContents): void {
  const tmp = `${lockPath(root)}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(contents), "utf8");
  renameSync(tmp, lockPath(root));
}

/** Whether a pid is still running. Used to detect an abandoned lock. */
function pidAlive(pid: number): boolean {
  try {
    // Signal 0 performs the permission/existence check without delivering
    // anything. Works on Windows too.
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    // EPERM means the process exists but belongs to another user — still alive.
    return (cause as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * A lock is stale when the work it represents cannot still be running.
 *
 * With a child recorded: the child is gone, or it has run past the job timeout —
 * which is the only way to recover from a worker wedged inside a synchronous
 * stage, where no in-child timer could fire. Only the child is ever signalled.
 *
 * Without one: the reserving server died before it managed to fork.
 */
function lockIsStale(lock: LockContents, limits: IngestLimits): boolean {
  const age = Date.now() - Date.parse(lock.acquiredAt);
  const aged = (budget: number): boolean => Number.isFinite(age) && age > budget;

  if (lock.childPid === null) {
    return !pidAlive(lock.ownerPid) || aged(RESERVATION_GRACE_MS);
  }
  if (!pidAlive(lock.childPid)) return true;
  if (aged(limits.jobTimeoutMs)) {
    try {
      process.kill(lock.childPid, "SIGKILL");
    } catch {
      /* already gone, or not ours to kill */
    }
    return true;
  }
  return false;
}

export type AcquireResult =
  | { ok: true }
  /** Another job holds the lock; `repoId` names it so the caller can say so. */
  | { ok: false; heldBy: string };

/**
 * Take the single-job lock, reclaiming it if the holder is dead or timed out.
 *
 * `openSync(..., "wx")` fails when the file exists, and that check-and-create is
 * atomic in the kernel — so two processes racing here cannot both win, which a
 * read-then-write would allow.
 */
export function acquireJobLock(root: string, repoId: string): AcquireResult {
  const limits = resolveLimits();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      mkdirSync(root, { recursive: true });
      const fd = openSync(lockPath(root), "wx");
      try {
        const contents: LockContents = {
          ownerPid: process.pid,
          childPid: null,
          repoId,
          acquiredAt: new Date().toISOString(),
        };
        writeSync(fd, JSON.stringify(contents));
      } finally {
        closeSync(fd);
      }
      return { ok: true };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "EEXIST") throw cause;
      const held = readLock(root);
      // An unparseable lock file is treated as stale: it can only have come from
      // a writer that died mid-write, and refusing forever would be worse.
      if (held === null || lockIsStale(held, limits)) {
        forceReleaseJobLock(root);
        continue;
      }
      return { ok: false, heldBy: held.repoId };
    }
  }
  const held = readLock(root);
  return held === null ? { ok: true } : { ok: false, heldBy: held.repoId };
}

/** Record the forked child on the lock this process holds. */
function attachChildToLock(root: string, repoId: string, childPid: number): void {
  const held = readLock(root);
  if (held === null || held.ownerPid !== process.pid || held.repoId !== repoId) return;
  writeLock(root, { ...held, childPid });
}

/** Drop the lock unconditionally. Used on the reclaim path. */
function forceReleaseJobLock(root: string): void {
  try {
    unlinkSync(lockPath(root));
  } catch {
    /* not held */
  }
}

/**
 * Drop the lock, but only if this process still owns it.
 *
 * The ownership check is what stops a late `exit` handler from deleting a lock
 * that another process has already reclaimed and is actively using.
 */
export function releaseJobLock(root: string, repoId?: string): void {
  const held = readLock(root);
  if (held !== null && held.ownerPid !== process.pid) return;
  if (held !== null && repoId !== undefined && held.repoId !== repoId) return;
  forceReleaseJobLock(root);
}

/** The in-flight job, or null. Read by `POST` to answer a duplicate submission. */
export function currentJob(root: string): string | null {
  const held = readLock(root);
  if (held === null) return null;
  if (lockIsStale(held, resolveLimits())) {
    forceReleaseJobLock(root);
    return null;
  }
  return held.repoId;
}

/**
 * Locate `runner.mjs` on disk.
 *
 * The runner is not imported by anything — it is spawned by path — so Next's
 * dependency tracing cannot see it, and `output: "standalone"` will not copy it.
 * The container build must place it and set `REPOHIVE_RUNNER_PATH`, or copy the
 * `src/lib/indexing` directory alongside the server. The candidate list covers
 * `next dev` / `next start` from the package root and from the repo root.
 */
function resolveRunnerPath(): string | null {
  const override = process.env.REPOHIVE_RUNNER_PATH;
  if (override !== undefined && override.trim() !== "") {
    return existsSync(override) ? override : null;
  }
  const relative = path.join("src", "lib", "indexing", "runner.mjs");
  const candidates = [
    path.join(process.cwd(), relative),
    path.join(process.cwd(), "packages", "web", relative),
    path.join(process.cwd(), "..", "..", relative),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

export type StartResult =
  | { ok: true; pid: number }
  | { ok: false; message: string };

/**
 * Write the child's spec and fork it.
 *
 * The initial C2 record travels **inside** the spec rather than being rebuilt in
 * the child, so `job-file.ts` stays the only place that authors the C2 field set
 * and the child only ever mutates what it was handed.
 *
 * The caller must already hold the lock; it is released here on a failed fork
 * and by the `exit` handler once the child finishes.
 */
export function startIngestJob(args: {
  root: string;
  repoId: string;
  owner: string;
  repo: string;
  job: JobRecord;
}): StartResult {
  const { root, repoId, owner, repo, job } = args;

  const runner = resolveRunnerPath();
  if (runner === null) {
    return { ok: false, message: "Indexing runner not found on disk. Set REPOHIVE_RUNNER_PATH." };
  }

  const workDir = path.join(workRoot(root), repoId);
  const specPath = path.join(workDir, "spec.json");
  const spec = {
    repoId,
    owner,
    repo,
    sourceUrl: job.sourceUrl,
    jobFile: jobFilePath(root, repoId),
    repoDir: repoDir(root, repoId),
    workDir,
    indexDir: indexDir(root, repoId),
    // Sibling of `index/`, so the promoting rename is same-directory and
    // therefore atomic — a staging path on another filesystem would fail EXDEV.
    stagingDir: `${indexDir(root, repoId)}.staging-${process.pid}`,
    limits: resolveLimits(),
    job,
  };

  try {
    rmSync(workDir, { recursive: true, force: true });
    mkdirSync(workDir, { recursive: true });
    writeFileSync(specPath, JSON.stringify(spec), "utf8");
  } catch (cause) {
    return { ok: false, message: `Could not prepare the job working directory: ${String(cause)}` };
  }

  try {
    const child = fork(runner, [specPath], {
      // stderr is inherited so a crash lands in the container log; the child
      // never speaks over IPC — job.json is the whole protocol, which is what
      // lets a job outlive a parent restart.
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      env: process.env,
    });
    child.on("exit", () => releaseJobLock(root, repoId));
    child.on("error", () => releaseJobLock(root, repoId));
    if (child.pid !== undefined) {
      attachChildToLock(root, repoId, child.pid);
    }
    // Do not hold the server's event loop open on this child.
    child.unref();
    if (child.channel !== undefined && child.channel !== null) {
      child.channel.unref();
    }
    return { ok: true, pid: child.pid ?? -1 };
  } catch (cause) {
    releaseJobLock(root, repoId);
    return { ok: false, message: `Could not start the indexing job: ${String(cause)}` };
  }
}
