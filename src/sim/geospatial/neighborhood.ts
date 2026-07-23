import {
  geometryLength,
  inBounds,
  tileIndex,
  tileToWorld,
  type MapGeometry,
} from '../map-geometry';
import { rasterPolygon } from './geometry';
import type { StreetNetwork, StreetSegment } from './street-network';
import type {
  LocalPoint,
  ProjectedGeoBuilding,
  SemanticBlock,
  SemanticBuilding,
  SemanticDistrict,
  SemanticEntrance,
  SemanticLot,
} from './types';

export interface NeighborhoodPlacement {
  buildingId: string;
  blockId: string;
  lotId: string;
  frontageRoadId?: string;
  entrance: SemanticEntrance;
  setback: number;
  yardDepth: number;
  parking: boolean;
}

export interface NeighborhoodLayout {
  blocks: SemanticBlock[];
  lots: SemanticLot[];
  placements: NeighborhoodPlacement[];
  unassignedBuildingIds: string[];
}

export interface FootprintAdjustment {
  buildingId: string;
  scale: number;
  shiftX: number;
  shiftZ: number;
}

export interface FittedBuildings {
  buildings: ProjectedGeoBuilding[];
  adjustments: FootprintAdjustment[];
}

const CARDINALS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

function overlapsCells(
  polygon: readonly LocalPoint[],
  blocked: ReadonlySet<number>,
  geometry: MapGeometry,
): boolean {
  return [...rasterPolygon(polygon, geometry)].some((cell) => blocked.has(cell));
}

/**
 * OSM centreline widths and footprint edges often disagree by one raster cell.
 * Keep the source identity and shape language, but inset/translate the game
 * shell just enough for the authoritative carriageway to remain clear.
 */
export function fitBuildingsToCarriageways(
  buildings: readonly ProjectedGeoBuilding[],
  carriagewayCells: ReadonlySet<number>,
  geometry: MapGeometry,
): FittedBuildings {
  const adjustments: FootprintAdjustment[] = [];
  const fitted = buildings.map((building) => {
    if (!overlapsCells(building.polygon, carriagewayCells, geometry)) {
      return { ...building, polygon: building.polygon.map((point) => ({ ...point })) };
    }
    const center = building.polygon.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), { x: 0, z: 0 });
    center.x /= building.polygon.length;
    center.z /= building.polygon.length;
    const overlap = [...rasterPolygon(building.polygon, geometry)]
      .filter((cell) => carriagewayCells.has(cell));
    const overlapCenter = overlap.reduce((sum, cell) => {
      const point = tileToWorld(geometry, cell % geometry.cols, Math.floor(cell / geometry.cols));
      return { x: sum.x + point.x, z: sum.z + point.z };
    }, { x: 0, z: 0 });
    overlapCenter.x /= Math.max(1, overlap.length);
    overlapCenter.z /= Math.max(1, overlap.length);
    const awayLength = Math.hypot(center.x - overlapCenter.x, center.z - overlapCenter.z);
    const away = awayLength > 1e-6
      ? { x: (center.x - overlapCenter.x) / awayLength, z: (center.z - overlapCenter.z) / awayLength }
      : { x: 0, z: 1 };
    const directions = [away, { x: 0, z: 0 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
    for (const direction of directions) {
      for (const shift of [0, geometry.tile, geometry.tile * 2, geometry.tile * 3]) {
        for (let scale = 0.96; scale >= 0.48; scale -= 0.04) {
          const polygon = building.polygon.map((point) => ({
            x: center.x + (point.x - center.x) * scale + direction.x * shift,
            z: center.z + (point.z - center.z) * scale + direction.z * shift,
          }));
          const cells = rasterPolygon(polygon, geometry);
          if (!cells.size || [...cells].some((cell) => carriagewayCells.has(cell))) continue;
          adjustments.push({
            buildingId: building.id,
            scale: Math.round(scale * 100) / 100,
            shiftX: direction.x * shift,
            shiftZ: direction.z * shift,
          });
          return { ...building, polygon };
        }
      }
    }
    return { ...building, polygon: building.polygon.map((point) => ({ ...point })) };
  });
  return { buildings: fitted, adjustments };
}

function boundsPolygon(cells: readonly number[], geometry: MapGeometry): LocalPoint[] {
  const xs = cells.map((cell) => cell % geometry.cols);
  const zs = cells.map((cell) => Math.floor(cell / geometry.cols));
  const min = tileToWorld(geometry, Math.min(...xs), Math.min(...zs));
  const max = tileToWorld(geometry, Math.max(...xs), Math.max(...zs));
  const half = geometry.tile / 2;
  return [
    { x: min.x - half, z: min.z - half },
    { x: max.x + half, z: min.z - half },
    { x: max.x + half, z: max.z + half },
    { x: min.x - half, z: max.z + half },
  ];
}

function deriveBlocks(network: StreetNetwork, geometry: MapGeometry): {
  blocks: SemanticBlock[];
  blockByCell: Int32Array;
} {
  const blockByCell = new Int32Array(geometryLength(geometry)).fill(-1);
  const blocks: SemanticBlock[] = [];
  for (let start = 0; start < blockByCell.length; start++) {
    if (blockByCell[start] !== -1 || network.carriagewayCells.has(start)) continue;
    const blockIndex = blocks.length;
    const cells = [start];
    blockByCell[start] = blockIndex;
    for (let cursor = 0; cursor < cells.length; cursor++) {
      const cell = cells[cursor];
      const x = cell % geometry.cols;
      const z = Math.floor(cell / geometry.cols);
      for (const [dx, dz] of CARDINALS) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inBounds(geometry, nx, nz)) continue;
        const next = tileIndex(geometry, nx, nz);
        if (blockByCell[next] === -1 && !network.carriagewayCells.has(next)) {
          blockByCell[next] = blockIndex;
          cells.push(next);
        }
      }
    }
    cells.sort((a, b) => a - b);
    blocks.push({
      id: `block:${String(blockIndex).padStart(4, '0')}`,
      polygon: boundsPolygon(cells, geometry),
      cells,
      area: cells.length * geometry.tile * geometry.tile,
      buildingIds: [],
      lotIds: [],
    });
  }
  return { blocks, blockByCell };
}

function buildingBlock(
  cells: readonly number[],
  blockByCell: Int32Array,
): number | undefined {
  const counts = new Map<number, number>();
  for (const cell of cells) {
    const block = blockByCell[cell];
    if (block >= 0) counts.set(block, (counts.get(block) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
}

function pointSegmentDistance(point: LocalPoint, segment: StreetSegment): number {
  const a = segment.points[0];
  const b = segment.points.at(-1)!;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

function nearestSegment(point: LocalPoint, network: StreetNetwork): StreetSegment | undefined {
  return network.segments
    .filter((segment) => segment.kind !== 'path')
    .map((segment) => ({ segment, distance: pointSegmentDistance(point, segment) }))
    .sort((a, b) => a.distance - b.distance || a.segment.id.localeCompare(b.segment.id))[0]?.segment;
}

function accessField(
  buildingCells: ReadonlySet<number>,
  targets: ReadonlySet<number>,
  geometry: MapGeometry,
): { distance: Int32Array; toward: Int32Array } {
  const distance = new Int32Array(geometryLength(geometry)).fill(-1);
  const toward = new Int32Array(geometryLength(geometry)).fill(-2);
  const queue = [...targets].filter((cell) => !buildingCells.has(cell)).sort((a, b) => a - b);
  for (const cell of queue) {
    distance[cell] = 0;
    toward[cell] = -1;
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor];
    const x = cell % geometry.cols;
    const z = Math.floor(cell / geometry.cols);
    for (const [dx, dz] of CARDINALS) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds(geometry, nx, nz)) continue;
      const next = tileIndex(geometry, nx, nz);
      if (distance[next] >= 0 || buildingCells.has(next)) continue;
      distance[next] = distance[cell] + 1;
      toward[next] = cell;
      queue.push(next);
    }
  }
  return { distance, toward };
}

function entranceFor(
  building: ProjectedGeoBuilding,
  footprintCells: ReadonlySet<number>,
  allBuildingCells: ReadonlySet<number>,
  field: ReturnType<typeof accessField>,
  geometry: MapGeometry,
): SemanticEntrance | undefined {
  const candidates: Array<{ outside: number; inside: number; distance: number }> = [];
  for (const inside of footprintCells) {
    const x = inside % geometry.cols;
    const z = Math.floor(inside / geometry.cols);
    for (const [dx, dz] of CARDINALS) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds(geometry, nx, nz)) continue;
      const outside = tileIndex(geometry, nx, nz);
      if (allBuildingCells.has(outside) || field.distance[outside] < 0) continue;
      candidates.push({ outside, inside, distance: field.distance[outside] });
    }
  }
  const chosen = candidates.sort((a, b) => a.distance - b.distance
    || a.outside - b.outside || a.inside - b.inside)[0];
  if (!chosen) return undefined;
  const connector: number[] = [];
  for (let cell = chosen.outside; cell >= 0; cell = field.toward[cell]) connector.push(cell);
  const inside = tileToWorld(geometry, chosen.inside % geometry.cols, Math.floor(chosen.inside / geometry.cols));
  const outside = tileToWorld(geometry, chosen.outside % geometry.cols, Math.floor(chosen.outside / geometry.cols));
  return {
    id: `entrance:${building.id}`,
    buildingId: building.id,
    position: { x: (inside.x + outside.x) / 2, z: (inside.z + outside.z) / 2 },
    facing: Math.atan2(outside.x - inside.x, outside.z - inside.z),
    pedestrianConnector: connector,
    accessKind: 'walkway',
  };
}

function sharedEntranceFor(
  building: ProjectedGeoBuilding,
  targets: ReadonlySet<number>,
  geometry: MapGeometry,
): SemanticEntrance | undefined {
  if (!targets.size) return undefined;
  const center = building.polygon.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), { x: 0, z: 0 });
  center.x /= building.polygon.length;
  center.z /= building.polygon.length;
  const target = [...targets].map((cell) => {
    const point = tileToWorld(geometry, cell % geometry.cols, Math.floor(cell / geometry.cols));
    return { cell, point, distance: Math.hypot(point.x - center.x, point.z - center.z) };
  }).sort((a, b) => a.distance - b.distance || a.cell - b.cell)[0];
  return {
    id: `entrance:${building.id}:shared`,
    buildingId: building.id,
    position: { x: target.point.x, z: target.point.z },
    facing: Math.atan2(target.point.x - center.x, target.point.z - center.z),
    pedestrianConnector: [target.cell],
    accessKind: 'shared',
  };
}

export function deriveNeighborhood(
  buildings: readonly ProjectedGeoBuilding[],
  network: StreetNetwork,
  geometry: MapGeometry,
  accessTargets?: ReadonlySet<number>,
): NeighborhoodLayout {
  const { blocks, blockByCell } = deriveBlocks(network, geometry);
  const footprintById = new Map<string, Set<number>>();
  const allBuildingCells = new Set<number>();
  for (const building of buildings) {
    const cells = rasterPolygon(building.polygon, geometry);
    footprintById.set(building.id, cells);
    for (const cell of cells) allBuildingCells.add(cell);
  }
  const targets = accessTargets?.size
    ? accessTargets
    : network.pedestrianCells.size
      ? network.pedestrianCells
      : network.carriagewayCells;
  const field = accessField(allBuildingCells, targets, geometry);
  const assigned = new Map<string, number>();
  const unassignedBuildingIds: string[] = [];
  for (const building of [...buildings].sort((a, b) => a.id.localeCompare(b.id))) {
    const blockIndex = buildingBlock([...(footprintById.get(building.id) ?? [])], blockByCell);
    if (blockIndex === undefined) {
      unassignedBuildingIds.push(building.id);
      continue;
    }
    assigned.set(building.id, blockIndex);
    blocks[blockIndex].buildingIds.push(building.id);
  }

  const lots: SemanticLot[] = [];
  const lotByBuilding = new Map<string, SemanticLot>();
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    if (!block.buildingIds.length) continue;
    const owner = new Int32Array(geometryLength(geometry)).fill(-1);
    const queue: number[] = [];
    const buildingIds = [...block.buildingIds].sort();
    for (let ownerIndex = 0; ownerIndex < buildingIds.length; ownerIndex++) {
      const footprint = footprintById.get(buildingIds[ownerIndex]) ?? new Set<number>();
      const seeds = [...footprint].filter((cell) => blockByCell[cell] === blockIndex).sort((a, b) => a - b);
      const fallback = block.cells[Math.floor(block.cells.length * ((ownerIndex + 1) / (buildingIds.length + 1)))];
      for (const cell of seeds.length ? seeds : [fallback]) {
        if (owner[cell] !== -1) continue;
        owner[cell] = ownerIndex;
        queue.push(cell);
      }
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const cell = queue[cursor];
      const x = cell % geometry.cols;
      const z = Math.floor(cell / geometry.cols);
      for (const [dx, dz] of CARDINALS) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inBounds(geometry, nx, nz)) continue;
        const next = tileIndex(geometry, nx, nz);
        if (blockByCell[next] !== blockIndex || owner[next] !== -1) continue;
        owner[next] = owner[cell];
        queue.push(next);
      }
    }
    for (let ownerIndex = 0; ownerIndex < buildingIds.length; ownerIndex++) {
      const buildingId = buildingIds[ownerIndex];
      const cells = block.cells.filter((cell) => owner[cell] === ownerIndex);
      const lot: SemanticLot = {
        id: `lot:${buildingId}`,
        blockId: block.id,
        polygon: boundsPolygon(cells, geometry),
        cells,
        buildingIds: [buildingId],
        frontage: [],
        setback: 0,
        yardDepth: Math.sqrt(cells.length) * geometry.tile,
        parking: cells.length > (footprintById.get(buildingId)?.size ?? 0) * 2,
      };
      lots.push(lot);
      lotByBuilding.set(buildingId, lot);
      block.lotIds.push(lot.id);
    }
  }

  const byId = new Map(buildings.map((building) => [building.id, building]));
  const placements: NeighborhoodPlacement[] = [];
  for (const [buildingId, blockIndex] of [...assigned].sort((a, b) => a[0].localeCompare(b[0]))) {
    const building = byId.get(buildingId)!;
    const footprint = footprintById.get(buildingId)!;
    const entrance = entranceFor(building, footprint, allBuildingCells, field, geometry)
      ?? sharedEntranceFor(building, targets, geometry);
    const lot = lotByBuilding.get(buildingId);
    if (!entrance || !lot) {
      unassignedBuildingIds.push(buildingId);
      continue;
    }
    const frontageSegment = nearestSegment(entrance.position, network);
    const tangent = { x: Math.cos(entrance.facing), z: -Math.sin(entrance.facing) };
    lot.frontageRoadId = frontageSegment?.roadId;
    lot.frontage = [
      { x: entrance.position.x - tangent.x * geometry.tile, z: entrance.position.z - tangent.z * geometry.tile },
      { x: entrance.position.x + tangent.x * geometry.tile, z: entrance.position.z + tangent.z * geometry.tile },
    ];
    lot.setback = Math.max(0, (entrance.pedestrianConnector.length - 1) * geometry.tile);
    placements.push({
      buildingId,
      blockId: blocks[blockIndex].id,
      lotId: lot.id,
      frontageRoadId: frontageSegment?.roadId,
      entrance,
      setback: lot.setback,
      yardDepth: lot.yardDepth,
      parking: lot.parking,
    });
  }
  return {
    blocks,
    lots: lots.sort((a, b) => a.id.localeCompare(b.id)),
    placements,
    unassignedBuildingIds: [...new Set(unassignedBuildingIds)].sort(),
  };
}

export function auditEntranceConnectivity(
  district: Pick<SemanticDistrict, 'buildings'>,
  pedestrianCells: ReadonlySet<number>,
  geometry: MapGeometry,
): string[] {
  return district.buildings.flatMap((building) => {
    const valid = building.entrances.some((entrance) => {
      const route = entrance.pedestrianConnector;
      if (!route.length || !pedestrianCells.has(route.at(-1)!)) return false;
      return route.every((cell, index) => cell >= 0 && cell < geometryLength(geometry)
        && (index === 0 || Math.abs(cell % geometry.cols - route[index - 1] % geometry.cols)
          + Math.abs(Math.floor(cell / geometry.cols) - Math.floor(route[index - 1] / geometry.cols)) === 1));
    });
    return valid ? [] : [building.id];
  }).sort();
}

export function auditBuildingRoadOverlap(
  buildings: readonly Pick<SemanticBuilding, 'id' | 'footprint'>[],
  carriagewayCells: ReadonlySet<number>,
  geometry: MapGeometry,
): string[] {
  return buildings.flatMap((building) =>
    [...rasterPolygon(building.footprint, geometry)].some((cell) => carriagewayCells.has(cell))
      ? [building.id]
      : []).sort();
}
