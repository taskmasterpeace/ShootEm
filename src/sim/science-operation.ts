import { buildingAuthoringLayoutFromMap, deriveBuildingNavigation, type BuildingPortalKind } from './building-navigation';
import type { GeneratedBuilding } from './building-generator';
import type { GameMap } from './map';
import { tileToWorld } from './map-geometry';
import type { Vec3 } from './types';

export type ScienceOperationNodeKind = 'insertion' | 'room' | 'objective' | 'report' | 'response' | 'extraction';

export interface ScienceOperationNode {
  id: string;
  kind: ScienceOperationNodeKind;
  pos: Vec3;
  floor: number;
  roomId?: number;
}

export interface ScienceOperationEdge {
  a: number;
  b: number;
  kind: BuildingPortalKind;
}

export interface SciencePatrolRoute {
  id: string;
  guardIndex: number;
  points: Vec3[];
  roomIds: number[];
}

export interface ScienceOperationMetrics {
  rooms: number;
  edges: number;
  loops: number;
  criticalPoints: number;
  patrols: number;
  reports: number;
}

export interface ScienceOperationGraph {
  seed: number;
  nodes: ScienceOperationNode[];
  roomEdges: ScienceOperationEdge[];
  criticalRoute: Vec3[];
  patrolRoutes: SciencePatrolRoute[];
  reportNodes: ScienceOperationNode[];
  responseRoutes: Vec3[][];
  metrics: ScienceOperationMetrics;
}

export interface GenerateScienceOperationGraphInput {
  seed: number;
  map: GameMap;
  building?: GeneratedBuilding;
  entry: Vec3;
  extraction: Vec3;
  objectives: readonly Vec3[];
  guardPosts: readonly Vec3[];
  reinforcementPosts: readonly Vec3[];
}

const floorFor = (pos: Vec3) => Math.max(0, Math.round(pos.y / 4));
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y) * 2;
const copy = (pos: Vec3): Vec3 => ({ ...pos });

function nearestRoom(roomNodes: ScienceOperationNode[], pos: Vec3): number {
  const floor = floorFor(pos);
  const sameFloor = roomNodes.filter((node) => node.floor === floor);
  const pool = sameFloor.length ? sameFloor : roomNodes;
  return pool.reduce((best, node) => distance(node.pos, pos) < distance(best.pos, pos) ? node : best).roomId!;
}

function adjacency(roomCount: number, edges: ScienceOperationEdge[]): number[][] {
  const result = Array.from({ length: roomCount }, () => [] as number[]);
  for (const edge of edges) {
    result[edge.a].push(edge.b);
    result[edge.b].push(edge.a);
  }
  for (const neighbors of result) neighbors.sort((a, b) => a - b);
  return result;
}

function roomPath(from: number, to: number, neighbors: number[][]): number[] {
  if (from === to) return [from];
  const parent = new Int32Array(neighbors.length).fill(-1);
  const queue = [from];
  parent[from] = from;
  for (let head = 0; head < queue.length && parent[to] < 0; head++) {
    for (const next of neighbors[queue[head]]) {
      if (parent[next] >= 0) continue;
      parent[next] = queue[head];
      queue.push(next);
    }
  }
  if (parent[to] < 0) return [];
  const path = [to];
  while (path[0] !== from) path.unshift(parent[path[0]]);
  return path;
}

function pushUnique(points: Vec3[], point: Vec3): void {
  const prior = points.at(-1);
  if (!prior || distance(prior, point) > 0.01) points.push(copy(point));
}

/** Compile tactical meaning from the building's real room/portal graph. */
export function generateScienceOperationGraph(input: GenerateScienceOperationGraphInput): ScienceOperationGraph {
  const source = buildingAuthoringLayoutFromMap(input.map);
  if (!source) throw new Error('science operation graph requires building provenance');
  const navigation = deriveBuildingNavigation(source.layout);
  if (!navigation.rooms.length) throw new Error('science operation graph requires at least one room');

  const roomNodes: ScienceOperationNode[] = navigation.rooms.map((room) => {
    const sum = room.tiles.reduce((acc, tile) => ({ x: acc.x + tile.x, z: acc.z + tile.z }), { x: 0, z: 0 });
    const count = Math.max(1, room.tiles.length);
    const center = tileToWorld(input.map.geometry, source.origin.tx + sum.x / count, source.origin.tz + sum.z / count);
    return {
      id: `room-${room.id}`,
      kind: 'room',
      roomId: room.id,
      floor: room.floor,
      pos: {
        x: center.x,
        y: room.floor * 4,
        z: center.z,
      },
    };
  });

  const seenEdges = new Set<string>();
  const roomEdges: ScienceOperationEdge[] = [];
  for (const portal of navigation.portals) {
    if (portal.kind === 'window' || portal.kind === 'shutter' || portal.rooms.length < 2) continue;
    const [a, b] = [...portal.rooms].sort((left, right) => left - right);
    const key = `${a}:${b}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    roomEdges.push({ a, b, kind: portal.kind });
  }
  roomEdges.sort((left, right) => left.a - right.a || left.b - right.b);
  const neighbors = adjacency(roomNodes.length, roomEdges);

  const objective = input.objectives[0] ?? input.extraction;
  const entryRoom = nearestRoom(roomNodes, input.entry);
  const objectiveRoom = nearestRoom(roomNodes, objective);
  const extractionRoom = nearestRoom(roomNodes, input.extraction);
  const toObjective = roomPath(entryRoom, objectiveRoom, neighbors);
  const toExtraction = roomPath(objectiveRoom, extractionRoom, neighbors);
  const criticalRoute: Vec3[] = [];
  pushUnique(criticalRoute, input.entry);
  for (const id of toObjective) pushUnique(criticalRoute, roomNodes[id].pos);
  pushUnique(criticalRoute, objective);
  for (const id of toExtraction.slice(1)) pushUnique(criticalRoute, roomNodes[id].pos);
  pushUnique(criticalRoute, input.extraction);

  const patrolRoutes = input.guardPosts.map<SciencePatrolRoute>((post, guardIndex) => {
    const start = nearestRoom(roomNodes, post);
    const options = neighbors[start];
    const next = options.length ? options[(input.seed + guardIndex) % options.length] : start;
    const points = [copy(post), copy(roomNodes[next].pos), copy(post)];
    return { id: `patrol-${guardIndex + 1}`, guardIndex, points, roomIds: [start, next, start] };
  });

  const degreeOrder = roomNodes.map((node) => node.roomId!).sort((a, b) => neighbors[b].length - neighbors[a].length || a - b);
  const reportCount = roomNodes.length >= 8 ? 2 : 1;
  const reportNodes = degreeOrder.slice(0, reportCount).map<ScienceOperationNode>((roomId, index) => ({
    id: `report-${index + 1}`,
    kind: 'report',
    roomId,
    floor: roomNodes[roomId].floor,
    pos: copy(roomNodes[roomId].pos),
  }));

  const responseRoutes = input.reinforcementPosts.map((post) => {
    const start = nearestRoom(roomNodes, post);
    const path = roomPath(start, entryRoom, neighbors);
    return [copy(post), ...path.map((id) => copy(roomNodes[id].pos))];
  });

  const nodes: ScienceOperationNode[] = [
    { id: 'insertion', kind: 'insertion', pos: copy(input.entry), floor: floorFor(input.entry), roomId: entryRoom },
    ...roomNodes,
    ...input.objectives.map((pos, index) => ({ id: `objective-${index + 1}`, kind: 'objective' as const, pos: copy(pos), floor: floorFor(pos), roomId: nearestRoom(roomNodes, pos) })),
    ...reportNodes,
    ...input.reinforcementPosts.map((pos, index) => ({ id: `response-${index + 1}`, kind: 'response' as const, pos: copy(pos), floor: floorFor(pos), roomId: nearestRoom(roomNodes, pos) })),
    { id: 'extraction', kind: 'extraction', pos: copy(input.extraction), floor: floorFor(input.extraction), roomId: extractionRoom },
  ];
  const metrics: ScienceOperationMetrics = {
    rooms: roomNodes.length,
    edges: roomEdges.length,
    loops: Math.max(0, roomEdges.length - roomNodes.length + 1),
    criticalPoints: criticalRoute.length,
    patrols: patrolRoutes.length,
    reports: reportNodes.length,
  };
  return { seed: input.seed >>> 0, nodes, roomEdges, criticalRoute, patrolRoutes, reportNodes, responseRoutes, metrics };
}

export function validateScienceOperationGraph(graph: ScienceOperationGraph): string[] {
  const issues: string[] = [];
  for (const kind of ['insertion', 'objective', 'extraction'] as const) {
    if (!graph.nodes.some((node) => node.kind === kind)) issues.push(`missing ${kind} node`);
  }
  if (graph.criticalRoute.length < 3) issues.push('critical route requires insertion, objective, and extraction');
  const finite = (pos: Vec3) => Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z);
  if (!graph.nodes.every((node) => finite(node.pos)) || !graph.criticalRoute.every(finite)) issues.push('graph contains non-finite coordinates');
  const roomIds = graph.nodes.filter((node) => node.kind === 'room' && node.roomId !== undefined).map((node) => node.roomId!);
  if (roomIds.length) {
    const links = new Map<number, number[]>(roomIds.map((id) => [id, []]));
    for (const edge of graph.roomEdges) {
      links.get(edge.a)?.push(edge.b);
      links.get(edge.b)?.push(edge.a);
    }
    const reached = new Set<number>([roomIds[0]]);
    const queue = [roomIds[0]];
    for (let head = 0; head < queue.length; head++) {
      for (const next of links.get(queue[head]) ?? []) if (!reached.has(next)) { reached.add(next); queue.push(next); }
    }
    if (reached.size !== roomIds.length) issues.push('room graph is disconnected');
  }
  for (const route of graph.patrolRoutes) {
    if (route.points.length < 2 || route.points.length > 4) issues.push(`${route.id} must contain two to four points`);
    if (!route.points.length || distance(route.points[0], route.points.at(-1)!) > 0.01) issues.push(`${route.id} must return to its post`);
    if (!route.points.every(finite)) issues.push(`${route.id} contains non-finite coordinates`);
  }
  if (!graph.reportNodes.length || graph.reportNodes.some((node) => node.roomId === undefined)) issues.push('report nodes must belong to rooms');
  if (!graph.responseRoutes.length || graph.responseRoutes.some((route) => route.length < 2 || !route.every(finite))) issues.push('response routes must enter the building');
  return issues;
}
