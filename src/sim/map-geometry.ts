import type { Vec3 } from './types';

/** Serializable dimensions for one tile map. X is columns; Z is rows. */
export interface MapGeometry {
  cols: number;
  rows: number;
  tile: number;
}

/** Compatibility geometry for every map that shipped before vehicle theaters. */
export const LEGACY_GEOMETRY: Readonly<MapGeometry> = Object.freeze({ cols: 100, rows: 100, tile: 3 });

export const geometryLength = (geometry: MapGeometry) => geometry.cols * geometry.rows;
export const worldWidth = (geometry: MapGeometry) => geometry.cols * geometry.tile;
export const worldDepth = (geometry: MapGeometry) => geometry.rows * geometry.tile;
export const halfWidth = (geometry: MapGeometry) => worldWidth(geometry) / 2;
export const halfDepth = (geometry: MapGeometry) => worldDepth(geometry) / 2;
export const tileIndex = (geometry: MapGeometry, tx: number, tz: number) => tz * geometry.cols + tx;

export const inBounds = (geometry: MapGeometry, tx: number, tz: number) =>
  tx >= 0 && tz >= 0 && tx < geometry.cols && tz < geometry.rows;

export const worldToTile = (geometry: MapGeometry, x: number, z: number): [number, number] => [
  Math.floor((x + halfWidth(geometry)) / geometry.tile),
  Math.floor((z + halfDepth(geometry)) / geometry.tile),
];

export const tileToWorld = (geometry: MapGeometry, tx: number, tz: number): Vec3 => ({
  x: (tx + 0.5) * geometry.tile - halfWidth(geometry),
  y: 0,
  z: (tz + 0.5) * geometry.tile - halfDepth(geometry),
});

export const allocateLayer = (geometry: MapGeometry, fill = 0) =>
  new Uint8Array(geometryLength(geometry)).fill(fill);

export function validateGeometry(geometry: MapGeometry, ...layers: Uint8Array[]): MapGeometry {
  if (!Number.isInteger(geometry.cols) || geometry.cols < 16) {
    throw new Error(`map geometry cols must be an integer >= 16; got ${geometry.cols}`);
  }
  if (!Number.isInteger(geometry.rows) || geometry.rows < 16) {
    throw new Error(`map geometry rows must be an integer >= 16; got ${geometry.rows}`);
  }
  if (!Number.isFinite(geometry.tile) || geometry.tile <= 0) {
    throw new Error(`map geometry tile must be positive; got ${geometry.tile}`);
  }
  const expected = geometryLength(geometry);
  for (const layer of layers) {
    if (layer.length !== expected) throw new Error(`map layer length ${layer.length}; expected ${expected}`);
  }
  return geometry;
}

export function clampWorld(geometry: MapGeometry, pos: Vec3, margin = 0): Vec3 {
  return {
    ...pos,
    x: Math.max(-halfWidth(geometry) + margin, Math.min(halfWidth(geometry) - margin, pos.x)),
    z: Math.max(-halfDepth(geometry) + margin, Math.min(halfDepth(geometry) - margin, pos.z)),
  };
}

export function wrapWorld(geometry: MapGeometry, pos: Vec3, margin = 0): Vec3 {
  const xEdge = halfWidth(geometry) - margin;
  const zEdge = halfDepth(geometry) - margin;
  return {
    ...pos,
    x: pos.x > xEdge ? -xEdge : pos.x < -xEdge ? xEdge : pos.x,
    z: pos.z > zEdge ? -zEdge : pos.z < -zEdge ? zEdge : pos.z,
  };
}
