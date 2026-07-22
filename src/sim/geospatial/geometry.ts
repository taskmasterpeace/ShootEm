import { inBounds, tileIndex, tileToWorld, worldToTile, type MapGeometry } from '../map-geometry';
import type {
  GeoRoad,
  GeoSliceSource,
  LocalPoint,
  LonLat,
  ProjectedGeoSlice,
} from './types';

const METERS_PER_LATITUDE_DEGREE = 111_320;

function projectUnrotated(point: LonLat, origin: LonLat): LocalPoint {
  const longitudeScale = METERS_PER_LATITUDE_DEGREE * Math.cos(origin.latitude * Math.PI / 180);
  return {
    x: (point.longitude - origin.longitude) * longitudeScale,
    z: (point.latitude - origin.latitude) * METERS_PER_LATITUDE_DEGREE,
  };
}

function rotateToAxis(point: LocalPoint, angle: number): LocalPoint {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x * c + point.z * s,
    z: -point.x * s + point.z * c,
  };
}

export function projectPoint(point: LonLat, origin: LonLat, rotation = 0): LocalPoint {
  return rotateToAxis(projectUnrotated(point, origin), rotation);
}

/** Weighted axial mean: roads have direction but no meaningful forward end. */
export function dominantRoadAngle(roads: readonly GeoRoad[], origin?: LonLat): number {
  const fallback = origin ?? roads[0]?.points[0] ?? { longitude: 0, latitude: 0 };
  let x = 0;
  let y = 0;
  for (const road of roads) {
    for (let index = 1; index < road.points.length; index++) {
      const a = projectUnrotated(road.points[index - 1], fallback);
      const b = projectUnrotated(road.points[index], fallback);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length <= 0) continue;
      const angle = Math.atan2(dz, dx);
      x += Math.cos(angle * 2) * length;
      y += Math.sin(angle * 2) * length;
    }
  }
  return x === 0 && y === 0 ? 0 : Math.atan2(y, x) / 2;
}

export function projectSlice(source: GeoSliceSource, rotation = dominantRoadAngle(source.roads, source.origin)): ProjectedGeoSlice {
  const project = (point: LonLat) => projectPoint(point, source.origin, rotation);
  return {
    source,
    origin: { x: 0, z: 0 },
    rotation,
    roads: source.roads.map((road) => ({ ...road, points: road.points.map(project) })),
    buildings: source.buildings.map((building) => ({ ...building, polygon: building.polygon.map(project) })),
    water: source.water.map((feature) => ({ ...feature, polygon: feature.polygon.map(project) })),
    land: source.land.map((feature) => ({ ...feature, polygon: feature.polygon.map(project) })),
  };
}

function stampDisc(cells: Set<number>, point: LocalPoint, radius: number, geometry: MapGeometry): void {
  const [cx, cz] = worldToTile(geometry, point.x, point.z);
  const tileRadius = Math.ceil(radius / geometry.tile) + 1;
  for (let dz = -tileRadius; dz <= tileRadius; dz++) {
    for (let dx = -tileRadius; dx <= tileRadius; dx++) {
      const tx = cx + dx;
      const tz = cz + dz;
      if (!inBounds(geometry, tx, tz)) continue;
      const center = tileToWorld(geometry, tx, tz);
      if (Math.hypot(center.x - point.x, center.z - point.z) <= radius + 1e-6) {
        cells.add(tileIndex(geometry, tx, tz));
      }
    }
  }
}

export function rasterLine(points: readonly LocalPoint[], width: number, geometry: MapGeometry): Set<number> {
  const cells = new Set<number>();
  if (points.length === 1) stampDisc(cells, points[0], width / 2, geometry);
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(distance / (geometry.tile * 0.5)));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      stampDisc(cells, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, width / 2, geometry);
    }
  }
  return cells;
}

function pointInPolygon(point: LocalPoint, polygon: readonly LocalPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function rasterPolygon(polygon: readonly LocalPoint[], geometry: MapGeometry): Set<number> {
  const cells = new Set<number>();
  if (polygon.length < 3) return cells;
  const minX = Math.min(...polygon.map((point) => point.x));
  const maxX = Math.max(...polygon.map((point) => point.x));
  const minZ = Math.min(...polygon.map((point) => point.z));
  const maxZ = Math.max(...polygon.map((point) => point.z));
  const [minTx, minTz] = worldToTile(geometry, minX, minZ);
  const [maxTx, maxTz] = worldToTile(geometry, maxX, maxZ);
  for (let tz = Math.max(0, minTz - 1); tz <= Math.min(geometry.rows - 1, maxTz + 1); tz++) {
    for (let tx = Math.max(0, minTx - 1); tx <= Math.min(geometry.cols - 1, maxTx + 1); tx++) {
      const center = tileToWorld(geometry, tx, tz);
      if (pointInPolygon(center, polygon)) cells.add(tileIndex(geometry, tx, tz));
    }
  }
  return cells;
}
