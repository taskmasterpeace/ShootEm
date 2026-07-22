import { geometryLength, tileToWorld, type MapGeometry } from '../map-geometry';
import type { GeoElevationGrid, LonLat } from './types';

export interface TerrainCompilation {
  height: Uint8Array;
  ramp: Uint8Array;
  smoothedMeters: number[];
  thresholds: {
    base: number;
    middle: number;
    high: number;
  };
}

const METERS_PER_LATITUDE_DEGREE = 111_320;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function sampleElevationGrid(grid: GeoElevationGrid, point: LonLat): number {
  if (grid.values.length !== grid.cols * grid.rows) {
    throw new Error(`elevation grid has ${grid.values.length} values; expected ${grid.cols * grid.rows}`);
  }
  const [west, south, east, north] = grid.bbox;
  const gx = clamp((point.longitude - west) / (east - west) * (grid.cols - 1), 0, grid.cols - 1);
  const gy = clamp((point.latitude - south) / (north - south) * (grid.rows - 1), 0, grid.rows - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(grid.cols - 1, x0 + 1);
  const y1 = Math.min(grid.rows - 1, y0 + 1);
  const tx = gx - x0;
  const ty = gy - y0;
  const at = (x: number, y: number) => grid.values[y * grid.cols + x];
  const southValue = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const northValue = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return southValue * (1 - ty) + northValue * ty;
}

function medianSmooth(samples: readonly number[], geometry: MapGeometry): number[] {
  const output = new Array<number>(samples.length);
  for (let z = 0; z < geometry.rows; z++) {
    for (let x = 0; x < geometry.cols; x++) {
      const neighbors: number[] = [];
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx >= 0 && nz >= 0 && nx < geometry.cols && nz < geometry.rows) {
            neighbors.push(samples[nz * geometry.cols + nx]);
          }
        }
      }
      neighbors.sort((a, b) => a - b);
      output[z * geometry.cols + x] = neighbors[Math.floor(neighbors.length / 2)];
    }
  }
  return output;
}

function quantile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function removeSmallIslands(height: Uint8Array, geometry: MapGeometry, minimumSize = 4): void {
  const visited = new Uint8Array(height.length);
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
  for (let start = 0; start < height.length; start++) {
    if (visited[start]) continue;
    const level = height[start];
    const component: number[] = [];
    const queue = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      component.push(index);
      const x = index % geometry.cols;
      const z = Math.floor(index / geometry.cols);
      for (const [dx, dz] of offsets) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= geometry.cols || nz >= geometry.rows) continue;
        const neighbor = nz * geometry.cols + nx;
        if (!visited[neighbor] && height[neighbor] === level) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    if (component.length >= minimumSize) continue;

    const componentSet = new Set(component);
    const votes = [0, 0, 0];
    for (const index of component) {
      const x = index % geometry.cols;
      const z = Math.floor(index / geometry.cols);
      for (const [dx, dz] of offsets) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= geometry.cols || nz >= geometry.rows) continue;
        const neighbor = nz * geometry.cols + nx;
        if (!componentSet.has(neighbor)) votes[height[neighbor]]++;
      }
    }
    const replacement = votes.indexOf(Math.max(...votes));
    for (const index of component) height[index] = replacement;
  }
}

export function markRoadRamps(
  height: Uint8Array,
  roadCells: ReadonlySet<number>,
  geometry: MapGeometry,
): Uint8Array {
  const ramp = new Uint8Array(height.length);
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
  for (const index of roadCells) {
    if (index < 0 || index >= height.length) continue;
    const x = index % geometry.cols;
    const z = Math.floor(index / geometry.cols);
    for (const [dx, dz] of offsets) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= geometry.cols || nz >= geometry.rows) continue;
      const neighbor = nz * geometry.cols + nx;
      if (Math.abs(height[index] - height[neighbor]) !== 1) continue;
      ramp[index] = 1;
      if (roadCells.has(neighbor)) ramp[neighbor] = 1;
    }
  }
  return ramp;
}

export function compileTerrainSamples(
  samples: readonly number[],
  geometry: MapGeometry,
  roadCells: ReadonlySet<number> = new Set(),
): TerrainCompilation {
  const expected = geometryLength(geometry);
  if (samples.length !== expected) {
    throw new Error(`terrain has ${samples.length} samples; expected ${expected}`);
  }
  if (samples.some((value) => !Number.isFinite(value))) {
    throw new Error('terrain samples must all be finite');
  }

  const smoothedMeters = medianSmooth(samples, geometry);
  const base = Math.min(...smoothedMeters);
  const relief = smoothedMeters.map((value) => value - base);
  const middle = Math.max(2, quantile(relief, 0.4));
  const high = Math.max(middle + 2, quantile(relief, 0.78));
  const totalRelief = Math.max(...smoothedMeters) - base;
  const maxBand = totalRelief < 2 ? 0 : totalRelief < 6 ? 1 : 2;
  const height = Uint8Array.from(relief, (value) => {
    const band = value >= high ? 2 : value >= middle ? 1 : 0;
    return Math.min(maxBand, band);
  });
  removeSmallIslands(height, geometry);

  return {
    height,
    ramp: markRoadRamps(height, roadCells, geometry),
    smoothedMeters,
    thresholds: { base, middle, high },
  };
}

function localToLonLat(point: { x: number; z: number }, origin: LonLat, rotation: number): LonLat {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const rawX = point.x * c - point.z * s;
  const rawZ = point.x * s + point.z * c;
  const longitudeScale = METERS_PER_LATITUDE_DEGREE * Math.cos(origin.latitude * Math.PI / 180);
  return {
    longitude: origin.longitude + rawX / longitudeScale,
    latitude: origin.latitude + rawZ / METERS_PER_LATITUDE_DEGREE,
  };
}

export function compileTerrain(
  elevation: GeoElevationGrid,
  geometry: MapGeometry,
  origin: LonLat,
  rotation: number,
  roadCells: ReadonlySet<number> = new Set(),
): TerrainCompilation {
  const samples = Array.from({ length: geometryLength(geometry) }, (_, index) => {
    const x = index % geometry.cols;
    const z = Math.floor(index / geometry.cols);
    return sampleElevationGrid(elevation, localToLonLat(tileToWorld(geometry, x, z), origin, rotation));
  });
  return compileTerrainSamples(samples, geometry, roadCells);
}
