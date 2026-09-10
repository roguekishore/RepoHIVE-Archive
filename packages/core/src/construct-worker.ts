/**
 * Worker thread for parallelising the Reconstruct_Action.
 *
 * Each message in carries one region's CommunitySubgraph + seed; each message
 * out carries the resulting RegionGroup list. The worker is long-lived — it
 * stays alive for the whole pipeline run so thread-startup cost is paid once
 * per run, not once per region.
 */

import { parentPort } from "node:worker_threads";
import { LouvainCommunityDetector } from "./community.js";
import { compareIds } from "./canonical.js";
import type { NodeId } from "@repohive/shared";
import type { RegionGroup } from "./types.js";

export interface WorkerRequest {
  seq: number;
  regionId: string;
  nodeIds: NodeId[];
  edges: Array<{ source: NodeId; target: NodeId; strength: number }>;
  seed: number;
}

export interface WorkerResponse {
  seq: number;
  regionId: string;
  groups: RegionGroup[];
}

const detector = new LouvainCommunityDetector();

parentPort!.on("message", (req: WorkerRequest) => {
  const assignment = detector.detect({ nodeIds: req.nodeIds, edges: req.edges }, req.seed);

  const membersOf = new Map<number, NodeId[]>();
  for (const fileId of [...req.nodeIds].sort(compareIds)) {
    const community = assignment.communityOf.get(fileId) ?? 0;
    const list = membersOf.get(community);
    if (list) list.push(fileId);
    else membersOf.set(community, [fileId]);
  }

  const groups: RegionGroup[] = [...membersOf.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, fileIds]) => ({ fileIds }));

  const resp: WorkerResponse = { seq: req.seq, regionId: req.regionId, groups };
  parentPort!.postMessage(resp);
});
