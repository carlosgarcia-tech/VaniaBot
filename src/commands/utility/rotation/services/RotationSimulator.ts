/**
 * RotationSimulator.ts
 *
 * VaniaBot commands module exposing `EnemyRotation`, `ConflictZone`, `ScoredRoute`, `TacticalAnalysis`.
 *
 * @author **Carlos G**
 */

import {
  NODES,
  GRAPH,
  zoneCenter,
  manhattanDistance,
  type ZoneId,
  type CirclePhase,
} from '../map/Purgatoriomap.js';
export type { ZoneId, CirclePhase } from '../map/Purgatoriomap.js';
import { findTopKPaths, type PathResult } from '../pathfinding/Pathfinding.js';

export interface EnemyRotation {
  zone: ZoneId;
  startNodeId: string;
  startNodeName: string;
  probableRoutes: Array<{ path: PathResult; probability: number }>;
  fastestEta: number;
  threatNodes: Set<string>;
}

export interface ConflictZone {
  nodeId: string;
  nodeName: string;
  teamCount: number;
  proximityTeamCount: number;
  risk: number;
}

export interface ScoredRoute {
  path: PathResult;
  score: number;
  label: string;
  riskLevel: 'bajo' | 'medio' | 'alto' | 'muy alto';
  eta: number;
  conflictsOnPath: string[];
  highGroundNodes: string[];
  enemyZonesCrossed: string[];
}

export interface TacticalAnalysis {
  myRoutes: PathResult[];
  enemyRotations: EnemyRotation[];
  conflictZones: ConflictZone[];
  worstChokepoint: string | null;
  safeApproach: string | null;
  circlePhase: CirclePhase;
  phaseAdvice: string;
}

function neighborNodeIds(nodeId: string): string[] {
  return (GRAPH.adjacency[nodeId] ?? []).map(e => e.to);
}

export function simulateEnemyRotations(
  myZone: ZoneId,
  goalNodeId: string,
  phase: CirclePhase,
): EnemyRotation[] {
  const enemyZones: ZoneId[] = (['A', 'B', 'C', 'D'] as ZoneId[]).filter(z => z !== myZone);
  const rotations: EnemyRotation[] = [];

  for (const zone of enemyZones) {
    const startId = zoneCenter(zone);
    const k = phase === 'early' ? 2 : 3;
    const topRoutes = findTopKPaths(startId, goalNodeId, k);

    const probs = [0.5, 0.3, 0.2];
    const probableRoutes = topRoutes.map((path, i) => ({
      path,
      probability: probs[i] ?? 0.1,
    }));

    const threatNodes = new Set<string>();
    for (const { path } of probableRoutes) {
      for (const step of path.steps) {
        threatNodes.add(step.nodeId);
        for (const neighbor of neighborNodeIds(step.nodeId)) {
          threatNodes.add(neighbor);
        }
      }
    }

    const fastestEta = probableRoutes[0]?.path.found
      ? Math.round(probableRoutes[0].path.totalCost)
      : 999;

    rotations.push({
      zone,
      startNodeId: startId,
      startNodeName: NODES[startId]?.name ?? startId,
      probableRoutes,
      fastestEta,
      threatNodes,
    });
  }

  return rotations.sort((a, b) => a.fastestEta - b.fastestEta);
}

export function detectConflictZones(
  myRoutes: PathResult[],
  enemyRotations: EnemyRotation[],
): ConflictZone[] {
  const exactCount: Record<string, number> = {};
  const proximityCount: Record<string, number> = {};

  const addPath = (path: PathResult, weight: number) => {
    for (const step of path.steps) {
      exactCount[step.nodeId] = (exactCount[step.nodeId] ?? 0) + weight;
      for (const neighbor of [step.nodeId, ...neighborNodeIds(step.nodeId)]) {
        proximityCount[neighbor] = (proximityCount[neighbor] ?? 0) + weight;
      }
    }
  };

  for (const route of myRoutes) addPath(route, 1);

  for (const enemy of enemyRotations) {
    for (const { path, probability } of enemy.probableRoutes) {
      addPath(path, probability);
    }
  }

  const allNodeIds = new Set([...Object.keys(exactCount), ...Object.keys(proximityCount)]);

  const result: ConflictZone[] = [];

  for (const nodeId of allNodeIds) {
    const exact = exactCount[nodeId] ?? 0;
    const prox = proximityCount[nodeId] ?? 0;
    if (prox < 1.2) continue;

    const node = NODES[nodeId];
    if (!node) continue;

    const chokePenalty = node.isChokepoint ? 0.25 : 0;
    const hotspotBonus = node.isHotspot ? 0.15 : 0;
    const coverPenalty = 1 - node.cover;
    const degreeBonus = Math.max(0, (4 - (GRAPH.nodeDegree[nodeId] ?? 4)) * 0.05);

    const risk = Math.min(
      1,
      (prox / 4) * 0.5 + chokePenalty + hotspotBonus + coverPenalty * 0.1 + degreeBonus,
    );

    result.push({
      nodeId,
      nodeName: node.name,
      teamCount: Math.round(exact),
      proximityTeamCount: Math.round(prox),
      risk,
    });
  }

  return result.sort((a, b) => b.risk - a.risk);
}

export function scoreRoutes(
  routes: PathResult[],
  conflictZones: ConflictZone[],
  enemyRotations: EnemyRotation[],
  phase: CirclePhase,
): ScoredRoute[] {
  const conflictByNode: Record<string, ConflictZone> = {};
  for (const cz of conflictZones) conflictByNode[cz.nodeId] = cz;

  const fastestEnemy = enemyRotations[0]?.fastestEta ?? 999;

  const enemyThreatNodes = new Set<string>();
  for (const enemy of enemyRotations) {
    for (const n of enemy.threatNodes) enemyThreatNodes.add(n);
  }

  return routes
    .map((path, i): ScoredRoute => {
      if (!path.found) {
        return {
          path,
          score: 0,
          label: `Ruta ${i + 1}`,
          riskLevel: 'muy alto' as const,
          eta: 999,
          conflictsOnPath: [],
          highGroundNodes: [],
          enemyZonesCrossed: [],
        };
      }

      const eta = Math.round(path.totalCost);

      const conflictsOnPath: string[] = [];
      let conflictPenalty = 0;
      for (const step of path.steps) {
        const cz = conflictByNode[step.nodeId];
        if (cz) {
          conflictsOnPath.push(step.nodeName);
          conflictPenalty += cz.risk * 15;
        }
      }

      const exposurePenalty = path.totalExposure * 20;
      const chokePenalty = path.chokepoints.length * 8;

      const enemyZonesCrossed: string[] = [];
      for (const step of path.steps) {
        if (enemyThreatNodes.has(step.nodeId) && NODES[step.nodeId]?.zone !== 'CENTER') {
          const zoneName = `Zona ${NODES[step.nodeId]?.zone}`;
          if (!enemyZonesCrossed.includes(zoneName)) {
            enemyZonesCrossed.push(zoneName);
          }
        }
      }
      const enemyZonePenalty = enemyZonesCrossed.length * 10;

      const etaBonus =
        eta < fastestEnemy ? 20 : eta < fastestEnemy + 5 ? 10 : eta < fastestEnemy + 10 ? 5 : 0;

      const avgCover =
        path.steps.reduce((s, st) => s + (NODES[st.nodeId]?.cover ?? 0.5), 0) / path.steps.length;
      const coverBonus = avgCover * 12;

      const highGroundNodes: string[] = [];
      let elevSum = 0;
      for (const step of path.steps) {
        const elev = NODES[step.nodeId]?.elevation ?? 0;
        elevSum += elev;
        if (elev >= 0.4) highGroundNodes.push(step.nodeName);
      }
      const highGroundBonus = (elevSum / path.steps.length) * 10;

      const phaseBonus =
        phase === 'early' ? etaBonus * 0.5 : phase === 'late' ? coverBonus * 0.3 : 0;

      const score = Math.max(
        0,
        Math.min(
          100,
          78 -
            conflictPenalty -
            exposurePenalty -
            chokePenalty -
            enemyZonePenalty +
            etaBonus +
            coverBonus +
            highGroundBonus +
            phaseBonus,
        ),
      );

      const riskLevel: ScoredRoute['riskLevel'] =
        score >= 65 ? 'bajo' : score >= 45 ? 'medio' : score >= 25 ? 'alto' : 'muy alto';

      return {
        path,
        score,
        label: `Ruta ${i + 1}`,
        riskLevel,
        eta,
        conflictsOnPath,
        highGroundNodes,
        enemyZonesCrossed,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function detectCirclePhase(myStartNodeId: string, goalNodeId: string): CirclePhase {
  const centerCoord = NODES['brasilia']?.coord ?? { row: 6, col: 4 };
  const goalCoord = NODES[goalNodeId]?.coord ?? NODES['brasilia']?.coord ?? { row: 6, col: 4 };
  const dist = manhattanDistance(goalCoord, centerCoord);

  if (dist >= 5) return 'early';
  if (dist >= 2) return 'mid';
  return 'late';
}

export function phaseAdvice(phase: CirclePhase): string {
  const map: Record<CirclePhase, string> = {
    early:
      'Círculo amplio — prioriza velocidad. Aún hay tiempo para posicionarte antes que los enemigos.',
    mid: 'Círculo intermedio — equilibra velocidad y cobertura. Los enemigos ya rotan activamente.',
    late: 'Círculo final — prioriza cobertura y high ground. El posicionamiento vale más que la velocidad.',
  };
  return map[phase];
}

export function runTacticalAnalysis(
  myStartNodeId: string,
  goalNodeId: string,
  myZone: ZoneId,
): TacticalAnalysis {
  const phase = detectCirclePhase(myStartNodeId, goalNodeId);
  const myRoutes = findTopKPaths(myStartNodeId, goalNodeId, 3);
  const enemyRotations = simulateEnemyRotations(myZone, goalNodeId, phase);
  const conflictZones = detectConflictZones(myRoutes, enemyRotations);

  const chokeCounts: Record<string, number> = {};
  for (const r of myRoutes)
    for (const cp of r.chokepoints) {
      chokeCounts[cp] = (chokeCounts[cp] ?? 0) + 1;
    }
  const worstChokepoint = Object.entries(chokeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const conflictIds = new Set(conflictZones.map(c => c.nodeId));
  const bestRoute = myRoutes.find(r => r.found);
  let safeApproach: string | null = null;
  if (bestRoute && bestRoute.steps.length >= 2) {
    const pre = bestRoute.steps
      .slice(0, -1)
      .reverse()
      .find(s => !conflictIds.has(s.nodeId));
    safeApproach = pre?.nodeName ?? null;
  }

  return {
    myRoutes,
    enemyRotations,
    conflictZones,
    worstChokepoint,
    safeApproach,
    circlePhase: phase,
    phaseAdvice: phaseAdvice(phase),
  };
}

export function buildCacheKey(
  startNode: string,
  goalNode: string,
  phase: CirclePhase,
  teamCount: number,
): string {
  return `${startNode}→${goalNode}|phase:${phase}|teams:${teamCount}`;
}
