/**
 * Adaptive_Hierarchy_Constructor (Requirements 4 and 5): decide preserve vs
 * reconstruct per Primary_Region by comparing its Structural_Quality_Score
 * against the Structural_Quality_Boundary, execute the chosen action, and
 * record complete decision metadata.
 *
 * - Preserve (4.2): score ≥ boundary → the Region's existing package/directory
 *   boundary becomes its single Group_Node (its File nodes stay together).
 * - Reconstruct (4.3): score < boundary → the injected CommunityDetector
 *   rebuilds the Region's groups over its nodes and strength-weighted edges,
 *   seeded for determinism.
 * - User overrides (4.6) replace the automatic decision; both the applied and
 *   the automatic action are recorded (5.6).
 * - Every File node lands in exactly one Region group result (4.5).
 */

import type { NodeId } from "@repohive/shared";
import { compareIds } from "./canonical.js";
import type { CommunityDetector, CommunitySubgraph } from "./community.js";
import { owningFileOf } from "./regions.js";
import type {
  Action,
  ConstructionConfig,
  ConstructionResult,
  RegionAssessment,
  RegionDecision,
  RegionGroup,
  WeightedModel,
} from "./types.js";

/** The pure boundary comparison (Req 4.1–4.3; reused by Property 18 replays). */
export function decideAction(score: number, boundary: number): Action {
  return score >= boundary ? "preserve" : "reconstruct";
}

export function construct(
  model: WeightedModel,
  assessment: RegionAssessment,
  config: ConstructionConfig,
  detector: CommunityDetector
): ConstructionResult {
  const regionGroups = new Map<string, RegionGroup[]>();
  const decisions: RegionDecision[] = [];

  for (const region of assessment.regions) {
    const automaticAction = decideAction(region.score, config.structuralQualityBoundary);
    const override = config.overrides?.get(region.regionId);
    const action = override ?? automaticAction;

    const groups =
      action === "preserve"
        ? [{ fileIds: [...region.nodeIds] }]
        : reconstructRegion(model, region.nodeIds, config.communityDetectionSeed, detector);

    regionGroups.set(region.regionId, groups);
    decisions.push({
      regionId: region.regionId,
      cohesion: region.cohesion,
      coupling: region.coupling,
      ...(region.modularity !== undefined ? { modularity: region.modularity } : {}),
      score: region.score,
      action,
      automaticAction,
      userOverridden: override !== undefined,
      decisionConfidence: Math.abs(region.score - config.structuralQualityBoundary),
    });
  }

  return { regionGroups, decisions };
}

/**
 * Parallel version of construct: dispatches all Reconstruct regions to a
 * worker pool concurrently. Preserve regions are handled synchronously.
 */
export async function constructParallel(
  model: WeightedModel,
  assessment: RegionAssessment,
  config: ConstructionConfig,
): Promise<ConstructionResult> {
  const regionGroups = new Map<string, RegionGroup[]>();
  const decisions: RegionDecision[] = [];

  type RegionEntry = { region: (typeof assessment.regions)[number]; action: Action; automaticAction: Action };
  const toReconstruct: Array<RegionEntry & { subgraph: CommunitySubgraph }> = [];
  const allEntries: Array<RegionEntry> = [];

  for (const region of assessment.regions) {
    const automaticAction = decideAction(region.score, config.structuralQualityBoundary);
    const override = config.overrides?.get(region.regionId);
    const action = override ?? automaticAction;
    allEntries.push({ region, action, automaticAction });

    if (action === "preserve") {
      regionGroups.set(region.regionId, [{ fileIds: [...region.nodeIds] }]);
    } else {
      toReconstruct.push({ region, action, automaticAction, subgraph: buildSubgraph(model, region.nodeIds) });
    }
  }

  if (toReconstruct.length > 0) {
    const { ConstructWorkerPool } = await import("./construct-pool.js");
    const pool = new ConstructWorkerPool();
    try {
      const results = await Promise.all(
        toReconstruct.map(({ region, subgraph }) =>
          pool.dispatch({
            regionId: region.regionId,
            nodeIds: [...region.nodeIds],
            edges: subgraph.edges,
            seed: config.communityDetectionSeed,
          })
        )
      );
      for (let i = 0; i < toReconstruct.length; i++) {
        regionGroups.set(toReconstruct[i]!.region.regionId, results[i]!);
      }
    } finally {
      await pool.shutdown();
    }
  }

  for (const { region, action, automaticAction } of allEntries) {
    const override = config.overrides?.get(region.regionId);
    decisions.push({
      regionId: region.regionId,
      cohesion: region.cohesion,
      coupling: region.coupling,
      ...(region.modularity !== undefined ? { modularity: region.modularity } : {}),
      score: region.score,
      action,
      automaticAction,
      userOverridden: override !== undefined,
      decisionConfidence: Math.abs(region.score - config.structuralQualityBoundary),
    });
  }

  return { regionGroups, decisions };
}

function reconstructRegion(
  model: WeightedModel,
  fileIds: readonly NodeId[],
  seed: number,
  detector: CommunityDetector
): RegionGroup[] {
  const subgraph = buildSubgraph(model, fileIds);
  const assignment = detector.detect(subgraph, seed);

  const membersOf = new Map<number, NodeId[]>();
  for (const fileId of [...fileIds].sort(compareIds)) {
    const community = assignment.communityOf.get(fileId) ?? 0;
    const list = membersOf.get(community);
    if (list) list.push(fileId);
    else membersOf.set(community, [fileId]);
  }

  return [...membersOf.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, members]) => ({ fileIds: members }));
}

function buildSubgraph(model: WeightedModel, fileIds: readonly NodeId[]): CommunitySubgraph {
  const memberSet = new Set(fileIds);
  const edges: CommunitySubgraph["edges"] = [];
  for (const edge of model.weightedEdges) {
    const sourceNode = model.nodesById.get(edge.source);
    const targetNode = model.nodesById.get(edge.target);
    if (!sourceNode || !targetNode) continue;
    const sourceFile = owningFileOf(sourceNode, model.nodesById);
    const targetFile = owningFileOf(targetNode, model.nodesById);
    if (
      sourceFile === null ||
      targetFile === null ||
      sourceFile === targetFile ||
      !memberSet.has(sourceFile) ||
      !memberSet.has(targetFile)
    ) {
      continue;
    }
    edges.push({ source: sourceFile, target: targetFile, strength: edge.strength });
  }
  return { nodeIds: [...fileIds], edges };
}
