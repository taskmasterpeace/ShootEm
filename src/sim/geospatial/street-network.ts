import { inBounds, tileIndex, type MapGeometry } from '../map-geometry';
import { rasterLine } from './geometry';
import type { LocalPoint, ProjectedGeoRoad } from './types';

export type StreetSegmentKind = 'carriageway' | 'service' | 'driveway' | 'path';

export interface StreetConnector {
  id: string;
  point: LocalPoint;
  roadIds: string[];
}

export interface StreetSegment {
  id: string;
  roadId: string;
  from: string;
  to: string;
  kind: StreetSegmentKind;
  width: number;
  points: LocalPoint[];
  cells: number[];
}

export interface StreetNetwork {
  connectors: StreetConnector[];
  segments: StreetSegment[];
  carriagewayCells: Set<number>;
  sidewalkCells: Set<number>;
  pedestrianCells: Set<number>;
  vehicleComponents: number[][];
  pedestrianComponents: number[][];
}

interface SourceSegment {
  road: ProjectedGeoRoad;
  order: number;
  a: LocalPoint;
  b: LocalPoint;
  splits: Array<{ t: number; point: LocalPoint }>;
}

const BASE_WIDTHS: Record<string, number> = {
  motorway: 18,
  trunk: 15,
  primary: 12,
  secondary: 10,
  tertiary: 8,
  residential: 6,
  unclassified: 6,
  living_street: 6,
  service: 3.5,
  track: 3,
  path: 2.5,
  footway: 2.5,
  cycleway: 3,
};

export function resolveRoadWidth(
  road: ProjectedGeoRoad,
  profileWidths: Readonly<Record<string, number>> = BASE_WIDTHS,
): number {
  if (road.width && road.width > 0) return road.width;
  if (road.lanes && road.lanes > 0) return road.lanes * 3.4;
  return profileWidths[road.roadClass] ?? BASE_WIDTHS[road.roadClass] ?? 3;
}

function grade(road: ProjectedGeoRoad): string {
  if (road.bridge) return 'bridge';
  if (road.tunnel) return 'tunnel';
  return 'ground';
}

function kindOf(road: ProjectedGeoRoad): StreetSegmentKind {
  if (/^(path|footway|pedestrian|steps|cycleway|bridleway)$/.test(road.roadClass)) return 'path';
  if (road.service === 'driveway') return 'driveway';
  if (road.roadClass === 'service') return 'service';
  return 'carriageway';
}

function cross(a: LocalPoint, b: LocalPoint): number {
  return a.x * b.z - a.z * b.x;
}

function intersection(
  a: LocalPoint,
  b: LocalPoint,
  c: LocalPoint,
  d: LocalPoint,
): { point: LocalPoint; ta: number; tb: number } | undefined {
  const r = { x: b.x - a.x, z: b.z - a.z };
  const s = { x: d.x - c.x, z: d.z - c.z };
  const denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-8) return undefined;
  const offset = { x: c.x - a.x, z: c.z - a.z };
  const ta = cross(offset, s) / denominator;
  const tb = cross(offset, r) / denominator;
  if (ta < -1e-8 || ta > 1 + 1e-8 || tb < -1e-8 || tb > 1 + 1e-8) return undefined;
  return {
    point: { x: a.x + r.x * ta, z: a.z + r.z * ta },
    ta: Math.max(0, Math.min(1, ta)),
    tb: Math.max(0, Math.min(1, tb)),
  };
}

function components(cells: ReadonlySet<number>, geometry: MapGeometry): number[][] {
  const remaining = new Set(cells);
  const result: number[][] = [];
  while (remaining.size) {
    const start = remaining.values().next().value as number;
    remaining.delete(start);
    const component = [start];
    for (let cursor = 0; cursor < component.length; cursor++) {
      const index = component[cursor];
      const x = index % geometry.cols;
      const z = Math.floor(index / geometry.cols);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inBounds(geometry, nx, nz)) continue;
        const next = tileIndex(geometry, nx, nz);
        if (remaining.delete(next)) component.push(next);
      }
    }
    result.push(component.sort((a, b) => a - b));
  }
  return result.sort((a, b) => b.length - a.length || a[0] - b[0]);
}

export function buildStreetNetwork(
  roads: readonly ProjectedGeoRoad[],
  geometry: MapGeometry,
  profileWidths: Readonly<Record<string, number>> = BASE_WIDTHS,
): StreetNetwork {
  const sourceSegments: SourceSegment[] = [];
  for (const road of [...roads].sort((a, b) => a.id.localeCompare(b.id))) {
    for (let index = 1; index < road.points.length; index++) {
      const a = road.points[index - 1];
      const b = road.points[index];
      if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-6) continue;
      sourceSegments.push({
        road,
        order: index - 1,
        a,
        b,
        splits: [{ t: 0, point: a }, { t: 1, point: b }],
      });
    }
  }

  for (let left = 0; left < sourceSegments.length; left++) {
    for (let right = left + 1; right < sourceSegments.length; right++) {
      const a = sourceSegments[left];
      const b = sourceSegments[right];
      if (a.road.id === b.road.id || grade(a.road) !== grade(b.road)) continue;
      const hit = intersection(a.a, a.b, b.a, b.b);
      if (!hit) continue;
      a.splits.push({ t: hit.ta, point: hit.point });
      b.splits.push({ t: hit.tb, point: hit.point });
    }
  }

  const connectors: Array<StreetConnector & { grade: string }> = [];
  const snapDistance = geometry.tile * 0.5;
  const connectorFor = (point: LocalPoint, road: ProjectedGeoRoad): StreetConnector => {
    let connector = connectors.find((candidate) => candidate.grade === grade(road)
      && Math.hypot(candidate.point.x - point.x, candidate.point.z - point.z) <= snapDistance);
    if (!connector) {
      connector = {
        id: `connector:${String(connectors.length).padStart(4, '0')}`,
        point: { ...point },
        roadIds: [],
        grade: grade(road),
      };
      connectors.push(connector);
    }
    if (!connector.roadIds.includes(road.id)) connector.roadIds.push(road.id);
    return connector;
  };

  const segments: StreetSegment[] = [];
  const carriagewayCells = new Set<number>();
  const sidewalkCells = new Set<number>();
  const pathCells = new Set<number>();
  for (const source of sourceSegments) {
    const unique = source.splits
      .sort((a, b) => a.t - b.t)
      .filter((split, index, values) => index === 0 || Math.abs(split.t - values[index - 1].t) > 1e-6);
    const width = resolveRoadWidth(source.road, profileWidths);
    const kind = kindOf(source.road);
    for (let index = 1; index < unique.length; index++) {
      const from = connectorFor(unique[index - 1].point, source.road);
      const to = connectorFor(unique[index].point, source.road);
      if (from.id === to.id) continue;
      const points = [{ ...from.point }, { ...to.point }];
      // A sub-tile real-world footpath still needs one authoritative walkable
      // tile in the game grid.
      const cells = rasterLine(points, Math.max(width, geometry.tile), geometry);
      const segment: StreetSegment = {
        id: `segment:${source.road.id}:${source.order}:${index - 1}`,
        roadId: source.road.id,
        from: from.id,
        to: to.id,
        kind,
        width,
        points,
        cells: [...cells].sort((a, b) => a - b),
      };
      segments.push(segment);
      if (kind === 'path') {
        for (const cell of cells) pathCells.add(cell);
      } else {
        for (const cell of cells) carriagewayCells.add(cell);
        const hasSidewalk = kind === 'carriageway'
          && source.road.sidewalk !== 'no'
          && !/^(motorway|trunk)$/.test(source.road.roadClass);
        if (hasSidewalk) {
          const outer = rasterLine(points, width + geometry.tile * 2, geometry);
          for (const cell of outer) if (!cells.has(cell)) sidewalkCells.add(cell);
        }
      }
    }
  }

  for (const connector of connectors) connector.roadIds.sort();
  for (const cell of carriagewayCells) sidewalkCells.delete(cell);
  const pedestrianCells = new Set(sidewalkCells);
  for (const cell of pathCells) pedestrianCells.add(cell);
  return {
    connectors: connectors.map(({ grade: _grade, ...connector }) => connector),
    segments,
    carriagewayCells,
    sidewalkCells,
    pedestrianCells,
    vehicleComponents: components(carriagewayCells, geometry),
    pedestrianComponents: components(pedestrianCells, geometry),
  };
}
