/**
 * Pathfinding.ts
 *
 * VaniaBot commands module exposing `PathStep`, `PathResult`, `findPath`, `findTopKPaths`.
 *
 * @author **Carlos G**
 */

import { MinHeap } from './Minheap.js';
import { NODES, GRAPH, type ResolvedEdge, type Coord } from '../map/Purgatoriomap.js';

export interface PathStep {
  nodeId: string;
  nodeName: string;
  edgeType: string;
  costFromStart: number;
  exposure: number;
}

export interface PathResult {
  steps: PathStep[];
  totalCost: number;
  totalExposure: number;
  chokepoints: string[];
  hotspots: string[];
  found: boolean;
}

function edgeCost(edge: ResolvedEdge): number {
  return edge.travelCost + edge.exposure * edge.travelCost * 0.6;
}

function heuristic(fromId: string, goalCoord: Coord): number {
  const node = NODES[fromId];
  if (!node) return 0;
  return (
    (Math.abs(node.coord.row - goalCoord.row) + Math.abs(node.coord.col - goalCoord.col)) *
    GRAPH.minEdgeCost
  );
}

export function findPath(
  startId: string,
  goalId: string,
  blockedEdges: Set<string> = new Set(),
): PathResult {
  const NOT_FOUND: PathResult = {
    steps: [],
    totalCost: Infinity,
    totalExposure: 0,
    chokepoints: [],
    hotspots: [],
    found: false,
  };

  if (!NODES[startId] || !NODES[goalId]) return NOT_FOUND;

  if (startId === goalId) {
    const n = NODES[startId];
    return {
      steps: [
        {
          nodeId: startId,
          nodeName: n.name,
          edgeType: 'start',
          costFromStart: 0,
          exposure: 0,
        },
      ],
      totalCost: 0,
      totalExposure: 0,
      chokepoints: n.isChokepoint ? [n.name] : [],
      hotspots: n.isHotspot ? [n.name] : [],
      found: true,
    };
  }

  const goalCoord = NODES[goalId].coord;
  const pq = new MinHeap();
  pq.push({ id: startId, g: 0, f: heuristic(startId, goalCoord) });

  const gScore: Record<string, number> = { [startId]: 0 };
  const cameFrom: Record<string, { from: string; edge: ResolvedEdge } | null> = { [startId]: null };
  const visited = new Set<string>();

  while (!pq.isEmpty()) {
    const current = pq.pop();
    if (!current) continue;

    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.id === goalId) {
      return reconstructPath(startId, goalId, gScore, cameFrom);
    }

    for (const edge of GRAPH.adjacency[current.id] ?? []) {
      if (visited.has(edge.to)) continue;
      const key = `${edge.from}→${edge.to}`;
      if (blockedEdges.has(key)) continue;

      const tentG = (gScore[current.id] ?? Infinity) + edgeCost(edge);
      if (tentG < (gScore[edge.to] ?? Infinity)) {
        gScore[edge.to] = tentG;
        cameFrom[edge.to] = { from: current.id, edge };
        pq.push({
          id: edge.to,
          g: tentG,
          f: tentG + heuristic(edge.to, goalCoord),
        });
      }
    }
  }

  return NOT_FOUND;
}

function reconstructPath(
  startId: string,
  goalId: string,
  gScore: Record<string, number>,
  cameFrom: Record<string, { from: string; edge: ResolvedEdge } | null>,
): PathResult {
  const steps: PathStep[] = [];
  let cur = goalId;

  while (cur !== startId) {
    const cf = cameFrom[cur];
    if (!cf) break;
    const node = NODES[cur];
    steps.unshift({
      nodeId: cur,
      nodeName: node.name,
      edgeType: cf.edge.type,
      costFromStart: gScore[cur],
      exposure: cf.edge.exposure,
    });
    cur = cf.from;
  }

  steps.unshift({
    nodeId: startId,
    nodeName: NODES[startId].name,
    edgeType: 'start',
    costFromStart: 0,
    exposure: 0,
  });

  const totalExposure =
    steps.length > 1
      ? steps.slice(1).reduce((s, st) => s + st.exposure, 0) / (steps.length - 1)
      : 0;

  return {
    steps,
    totalCost: gScore[goalId] ?? Infinity,
    totalExposure,
    chokepoints: steps.filter(s => NODES[s.nodeId]?.isChokepoint).map(s => s.nodeName),
    hotspots: steps.filter(s => NODES[s.nodeId]?.isHotspot).map(s => s.nodeName),
    found: true,
  };
}

export function findTopKPaths(startId: string, goalId: string, k = 3): PathResult[] {
  const results: PathResult[] = [];
  const blockedEdges = new Set<string>();
  const seenSigs = new Set<string>();

  for (let attempt = 0; attempt < k * 4 && results.length < k; attempt++) {
    const path = findPath(startId, goalId, blockedEdges);
    if (!path.found) break;

    const sig = path.steps.map(s => s.nodeId).join(',');
    if (!seenSigs.has(sig)) {
      seenSigs.add(sig);
      results.push(path);
    }

    let maxExp = -1,
      blockFrom = '',
      blockTo = '';
    for (let j = 1; j < path.steps.length; j++) {
      if (path.steps[j].exposure > maxExp) {
        maxExp = path.steps[j].exposure;
        blockFrom = path.steps[j - 1].nodeId;
        blockTo = path.steps[j].nodeId;
      }
    }
    if (blockFrom) {
      blockedEdges.add(`${blockFrom}→${blockTo}`);
      blockedEdges.add(`${blockTo}→${blockFrom}`);
    }
  }

  return results;
}
