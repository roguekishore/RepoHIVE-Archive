/**
 * Fixed-size worker pool for parallel Louvain community detection.
 *
 * Workers are long-lived: started once per pool, terminated on `shutdown()`.
 * Tasks are dispatched round-robin and resolved by sequence number.
 */

import { Worker } from "node:worker_threads";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import type { WorkerRequest, WorkerResponse } from "./construct-worker.js";
import type { RegionGroup } from "./types.js";

const WORKER_PATH = fileURLToPath(new URL("./construct-worker.js", import.meta.url));

export class ConstructWorkerPool {
  private readonly workers: Worker[];
  private readonly pending = new Map<number, (groups: RegionGroup[]) => void>();
  private seq = 0;
  private next = 0;

  constructor(concurrency: number = Math.max(1, cpus().length - 1)) {
    this.workers = Array.from({ length: concurrency }, () => {
      const w = new Worker(WORKER_PATH);
      w.on("message", (resp: WorkerResponse) => {
        const resolve = this.pending.get(resp.seq);
        if (resolve) {
          this.pending.delete(resp.seq);
          resolve(resp.groups);
        }
      });
      return w;
    });
  }

  dispatch(req: Omit<WorkerRequest, "seq">): Promise<RegionGroup[]> {
    return new Promise((resolve) => {
      const seq = this.seq++;
      this.pending.set(seq, resolve);
      const worker = this.workers[this.next % this.workers.length]!;
      this.next++;
      worker.postMessage({ ...req, seq } satisfies WorkerRequest);
    });
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
