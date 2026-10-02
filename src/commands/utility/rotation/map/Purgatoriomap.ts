/**
 * Purgatoriomap.ts
 *
 * VaniaBot commands module exposing `Coord`, `MapNode`, `MapEdge`, `ResolvedEdge`.
 *
 * @author **Carlos G**
 */

export type ZoneId = 'A' | 'B' | 'C' | 'D' | 'CENTER';
export type EdgeType = 'road' | 'bridge' | 'zipline' | 'river_crossing';
export type CirclePhase = 'early' | 'mid' | 'late';

export interface Coord {
  row: number;
  col: number;
}

export interface MapNode {
  id: string;
  name: string;
  coord: Coord;
  zone: ZoneId;
  cover: number;
  elevation: number;
  isChokepoint: boolean;
  isHotspot: boolean;
  crossesRiver: boolean;
  aliases: string[];
}

export interface MapEdge {
  from: string;
  to: string;
  type: EdgeType;
  travelCost: number;
  exposure: number;
  crossesRiver: boolean;
  bidirectional: boolean;
}

export interface ResolvedEdge extends MapEdge {}

const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
type ColLetter = (typeof COL_LETTERS)[number];

export const GRID_COLS = 9;
export const GRID_ROWS = 10;

const RIVER_PENALTY = 40;

export function colToIndex(col: string): number {
  return COL_LETTERS.indexOf(col.toUpperCase() as ColLetter);
}
export function indexToCol(idx: number): string {
  return COL_LETTERS[idx] ?? '?';
}
export function coordToString(c: Coord): string {
  return `${c.row},${indexToCol(c.col)}`;
}

export function parseCoord(raw: string): Coord | null {
  const s = raw.toUpperCase().replace(/\s/g, '');
  let row: number, colStr: string;

  const m1 = s.match(/^(\d{1,2})[,]([A-I])$/);
  const m2 = s.match(/^([A-I])[,](\d{1,2})$/);
  const m3 = s.match(/^(\d{1,2})([A-I])$/);
  const m4 = s.match(/^([A-I])(\d{1,2})$/);

  if (m1) {
    row = +m1[1];
    colStr = m1[2];
  } else if (m2) {
    row = +m2[2];
    colStr = m2[1];
  } else if (m3) {
    row = +m3[1];
    colStr = m3[2];
  } else if (m4) {
    row = +m4[2];
    colStr = m4[1];
  } else return null;

  const col = colToIndex(colStr);
  if (col < 0 || row < 1 || row > GRID_ROWS) return null;
  return { row, col };
}

export function manhattanDistance(a: Coord, b: Coord): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export const NODES: Record<string, MapNode> = {
  marbleworks: {
    id: 'marbleworks',
    name: 'Marbleworks',
    coord: { row: 4, col: 2 },
    zone: 'A',
    cover: 0.8,
    elevation: 0.3,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['marble', 'mw'],
  },
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    coord: { row: 6, col: 0 },
    zone: 'A',
    cover: 0.6,
    elevation: 0.2,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['cantera'],
  },
  golf_course: {
    id: 'golf_course',
    name: 'Golf Course',
    coord: { row: 7, col: 2 },
    zone: 'A',
    cover: 0.4,
    elevation: 0.1,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['golf', 'gc', 'golfcourse'],
  },
  mt_villa: {
    id: 'mt_villa',
    name: 'Mt. Villa',
    coord: { row: 8, col: 1 },
    zone: 'A',
    cover: 0.7,
    elevation: 0.4,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['villa', 'mtvilla'],
  },

  crossroads: {
    id: 'crossroads',
    name: 'Crossroads',
    coord: { row: 2, col: 2 },
    zone: 'B',
    cover: 0.5,
    elevation: 0.2,
    isChokepoint: true,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['cross', 'cr'],
  },
  moathouse: {
    id: 'moathouse',
    name: 'Moathouse',
    coord: { row: 1, col: 5 },
    zone: 'B',
    cover: 0.7,
    elevation: 0.3,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['moat', 'mh'],
  },
  fields_north: {
    id: 'fields_north',
    name: 'Fields Norte',
    coord: { row: 3, col: 6 },
    zone: 'B',
    cover: 0.2,
    elevation: 0.1,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['fn', 'fields norte', 'fieldsnorth'],
  },

  ski_lodge: {
    id: 'ski_lodge',
    name: 'Ski Lodge',
    coord: { row: 4, col: 8 },
    zone: 'C',
    cover: 0.75,
    elevation: 0.5,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['ski', 'lodge'],
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    coord: { row: 6, col: 8 },
    zone: 'C',
    cover: 0.65,
    elevation: 0.2,
    isChokepoint: false,
    isHotspot: true,
    crossesRiver: false,
    aliases: ['forja'],
  },
  campsite: {
    id: 'campsite',
    name: 'Campsite',
    coord: { row: 7, col: 6 },
    zone: 'C',
    cover: 0.5,
    elevation: 0.1,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['camp', 'campamento'],
  },
  fields: {
    id: 'fields',
    name: 'Fields',
    coord: { row: 4, col: 6 },
    zone: 'C',
    cover: 0.2,
    elevation: 0.1,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['field', 'praderas'],
  },

  central: {
    id: 'central',
    name: 'Central',
    coord: { row: 9, col: 3 },
    zone: 'D',
    cover: 0.6,
    elevation: 0.2,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['centro sur'],
  },
  fire_brigade: {
    id: 'fire_brigade',
    name: 'Fire Brigade',
    coord: { row: 9, col: 5 },
    zone: 'D',
    cover: 0.55,
    elevation: 0.1,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['fire', 'fb', 'bomberos', 'brigade'],
  },
  lumber_mill: {
    id: 'lumber_mill',
    name: 'Lumber Mill',
    coord: { row: 9, col: 7 },
    zone: 'D',
    cover: 0.6,
    elevation: 0.1,
    isChokepoint: false,
    isHotspot: false,
    crossesRiver: false,
    aliases: ['lumber', 'lm', 'aserradero'],
  },

  brasilia_north: {
    id: 'brasilia_north',
    name: 'Brasilia Norte',
    coord: { row: 5, col: 4 },
    zone: 'CENTER',
    cover: 0.45,
    elevation: 0.2,
    isChokepoint: false,
    isHotspot: true,
    crossesRiver: false,
    aliases: ['brn', 'brasilia norte', 'brasn'],
  },
  brasilia: {
    id: 'brasilia',
    name: 'Brasilia',
    coord: { row: 6, col: 4 },
    zone: 'CENTER',
    cover: 0.4,
    elevation: 0.2,
    isChokepoint: true,
    isHotspot: true,
    crossesRiver: false,
    aliases: ['bras', 'brasilia centro', 'hub'],
  },
  brasilia_south: {
    id: 'brasilia_south',
    name: 'Brasilia Sur',
    coord: { row: 7, col: 4 },
    zone: 'CENTER',
    cover: 0.4,
    elevation: 0.1,
    isChokepoint: false,
    isHotspot: true,
    crossesRiver: false,
    aliases: ['brs', 'brasilia sur', 'brass'],
  },

  bridge_north: {
    id: 'bridge_north',
    name: 'Puente Norte',
    coord: { row: 3, col: 2 },
    zone: 'A',
    cover: 0.05,
    elevation: 0.0,
    isChokepoint: true,
    isHotspot: false,
    crossesRiver: true,
    aliases: ['puente norte', 'bn'],
  },
  bridge_west: {
    id: 'bridge_west',
    name: 'Puente Oeste',
    coord: { row: 6, col: 3 },
    zone: 'CENTER',
    cover: 0.05,
    elevation: 0.0,
    isChokepoint: true,
    isHotspot: false,
    crossesRiver: true,
    aliases: ['puente oeste', 'bw', 'puente golf'],
  },
  bridge_south: {
    id: 'bridge_south',
    name: 'Puente Sur',
    coord: { row: 8, col: 5 },
    zone: 'CENTER',
    cover: 0.05,
    elevation: 0.0,
    isChokepoint: true,
    isHotspot: false,
    crossesRiver: true,
    aliases: ['puente sur', 'bs', 'puente fire'],
  },
};

export const EDGES: MapEdge[] = [
  {
    from: 'marbleworks',
    to: 'quarry',
    type: 'road',
    travelCost: 8,
    exposure: 0.3,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'quarry',
    to: 'golf_course',
    type: 'road',
    travelCost: 6,
    exposure: 0.4,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'golf_course',
    to: 'mt_villa',
    type: 'road',
    travelCost: 5,
    exposure: 0.3,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'marbleworks',
    to: 'golf_course',
    type: 'road',
    travelCost: 7,
    exposure: 0.35,
    crossesRiver: false,
    bidirectional: true,
  },

  {
    from: 'crossroads',
    to: 'moathouse',
    type: 'road',
    travelCost: 9,
    exposure: 0.35,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'crossroads',
    to: 'fields_north',
    type: 'road',
    travelCost: 7,
    exposure: 0.45,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'moathouse',
    to: 'fields_north',
    type: 'road',
    travelCost: 6,
    exposure: 0.4,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'fields_north',
    to: 'fields',
    type: 'road',
    travelCost: 4,
    exposure: 0.5,
    crossesRiver: false,
    bidirectional: true,
  },

  {
    from: 'ski_lodge',
    to: 'forge',
    type: 'road',
    travelCost: 6,
    exposure: 0.3,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'forge',
    to: 'campsite',
    type: 'road',
    travelCost: 5,
    exposure: 0.35,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'fields',
    to: 'ski_lodge',
    type: 'road',
    travelCost: 5,
    exposure: 0.4,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'campsite',
    to: 'fields',
    type: 'road',
    travelCost: 6,
    exposure: 0.45,
    crossesRiver: false,
    bidirectional: true,
  },

  {
    from: 'central',
    to: 'fire_brigade',
    type: 'road',
    travelCost: 6,
    exposure: 0.4,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'fire_brigade',
    to: 'lumber_mill',
    type: 'road',
    travelCost: 6,
    exposure: 0.4,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'central',
    to: 'mt_villa',
    type: 'road',
    travelCost: 5,
    exposure: 0.3,
    crossesRiver: false,
    bidirectional: true,
  },

  {
    from: 'brasilia_north',
    to: 'brasilia',
    type: 'road',
    travelCost: 3,
    exposure: 0.7,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'brasilia',
    to: 'brasilia_south',
    type: 'road',
    travelCost: 3,
    exposure: 0.7,
    crossesRiver: false,
    bidirectional: true,
  },

  {
    from: 'marbleworks',
    to: 'bridge_north',
    type: 'road',
    travelCost: 3,
    exposure: 0.3,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'bridge_north',
    to: 'crossroads',
    type: 'bridge',
    travelCost: 6,
    exposure: 0.9,
    crossesRiver: true,
    bidirectional: true,
  },

  {
    from: 'golf_course',
    to: 'bridge_west',
    type: 'road',
    travelCost: 3,
    exposure: 0.4,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'bridge_west',
    to: 'brasilia',
    type: 'bridge',
    travelCost: 6,
    exposure: 0.95,
    crossesRiver: true,
    bidirectional: true,
  },

  {
    from: 'fire_brigade',
    to: 'bridge_south',
    type: 'road',
    travelCost: 3,
    exposure: 0.4,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'bridge_south',
    to: 'brasilia_south',
    type: 'bridge',
    travelCost: 6,
    exposure: 0.95,
    crossesRiver: true,
    bidirectional: true,
  },

  {
    from: 'marbleworks',
    to: 'crossroads',
    type: 'zipline',
    travelCost: 4,
    exposure: 0.85,
    crossesRiver: false,
    bidirectional: false,
  },
  {
    from: 'marbleworks',
    to: 'brasilia_north',
    type: 'zipline',
    travelCost: 4,
    exposure: 0.85,
    crossesRiver: false,
    bidirectional: false,
  },
  {
    from: 'golf_course',
    to: 'brasilia',
    type: 'zipline',
    travelCost: 3,
    exposure: 0.9,
    crossesRiver: false,
    bidirectional: false,
  },
  {
    from: 'brasilia_south',
    to: 'central',
    type: 'zipline',
    travelCost: 3,
    exposure: 0.85,
    crossesRiver: false,
    bidirectional: false,
  },
  {
    from: 'lumber_mill',
    to: 'forge',
    type: 'zipline',
    travelCost: 4,
    exposure: 0.8,
    crossesRiver: false,
    bidirectional: false,
  },

  {
    from: 'brasilia_north',
    to: 'fields',
    type: 'road',
    travelCost: 5,
    exposure: 0.5,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'brasilia',
    to: 'campsite',
    type: 'road',
    travelCost: 6,
    exposure: 0.5,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'brasilia_south',
    to: 'campsite',
    type: 'road',
    travelCost: 5,
    exposure: 0.5,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'brasilia_south',
    to: 'fire_brigade',
    type: 'road',
    travelCost: 6,
    exposure: 0.55,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'brasilia_north',
    to: 'crossroads',
    type: 'road',
    travelCost: 8,
    exposure: 0.45,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'brasilia',
    to: 'marbleworks',
    type: 'road',
    travelCost: 7,
    exposure: 0.5,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'campsite',
    to: 'lumber_mill',
    type: 'road',
    travelCost: 7,
    exposure: 0.45,
    crossesRiver: false,
    bidirectional: true,
  },
  {
    from: 'fields',
    to: 'moathouse',
    type: 'road',
    travelCost: 6,
    exposure: 0.5,
    crossesRiver: false,
    bidirectional: true,
  },
];

export const ZONE_NODES: Record<ZoneId, string[]> = {
  A: ['marbleworks', 'quarry', 'golf_course', 'mt_villa'],
  B: ['crossroads', 'moathouse', 'fields_north'],
  C: ['ski_lodge', 'forge', 'campsite', 'fields'],
  D: ['central', 'fire_brigade', 'lumber_mill'],
  CENTER: ['brasilia_north', 'brasilia', 'brasilia_south'],
};

export interface PrecomputedGraph {
  adjacency: Record<string, ResolvedEdge[]>;
  /** Grado de cada nodo (número de conexiones) — usado para detectar chokepoints */
  nodeDegree: Record<string, number>;
  /** Costo mínimo de arista en el grafo — para heurística admisible A* */
  minEdgeCost: number;
  /** Alias lookup */
  aliasMap: Record<string, string>;
}

export function buildGraph(): PrecomputedGraph {
  const adjacency: Record<string, ResolvedEdge[]> = {};
  const nodeDegree: Record<string, number> = {};

  for (const id of Object.keys(NODES)) {
    adjacency[id] = [];
    nodeDegree[id] = 0;
  }

  let minEdgeCost = Infinity;

  for (const edge of EDGES) {
    const effectiveCost =
      edge.crossesRiver && edge.type === 'river_crossing'
        ? edge.travelCost + RIVER_PENALTY
        : edge.travelCost;

    const cost = effectiveCost + edge.exposure * effectiveCost * 0.6;
    if (cost < minEdgeCost) minEdgeCost = cost;

    adjacency[edge.from]?.push({ ...edge, travelCost: effectiveCost });
    nodeDegree[edge.from] = (nodeDegree[edge.from] ?? 0) + 1;

    if (edge.bidirectional) {
      adjacency[edge.to]?.push({
        ...edge,
        from: edge.to,
        to: edge.from,
        travelCost: effectiveCost,
      });
      nodeDegree[edge.to] = (nodeDegree[edge.to] ?? 0) + 1;
    }
  }

  const aliasMap: Record<string, string> = {};
  for (const [id, node] of Object.entries(NODES)) {
    aliasMap[id] = id;
    aliasMap[node.name.toLowerCase()] = id;
    for (const alias of node.aliases) aliasMap[alias.toLowerCase()] = id;
  }

  for (const [id, degree] of Object.entries(nodeDegree)) {
    if (degree <= 2 && NODES[id]) {
      NODES[id].isChokepoint = true;
    }
  }

  return { adjacency, nodeDegree, minEdgeCost, aliasMap };
}

export const GRAPH = buildGraph();

export function resolveNodeId(input: string): string | null {
  return GRAPH.aliasMap[input.toLowerCase().trim()] ?? null;
}

export function nearestNode(coord: Coord): MapNode {
  let best = Object.values(NODES)[0];
  let bestDist = Infinity;
  for (const node of Object.values(NODES)) {
    const d = manhattanDistance(coord, node.coord);
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

export function zoneCenter(zone: ZoneId): string {
  const ids = ZONE_NODES[zone];
  let best = ids[0];
  let bestSum = Infinity;
  for (const id of ids) {
    const sum = ids.reduce((s, o) => s + manhattanDistance(NODES[id].coord, NODES[o].coord), 0);
    if (sum < bestSum) {
      bestSum = sum;
      best = id;
    }
  }
  return best;
}
