import type { GameMap } from './map';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function byte(hash: number, value: number): number {
  return Math.imul((hash ^ (value & 0xff)) >>> 0, FNV_PRIME) >>> 0;
}

function text(hash: number, value: string): number {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    hash = byte(hash, code);
    hash = byte(hash, code >>> 8);
  }
  return hash;
}

function integer(hash: number, value: number): number {
  const n = value >>> 0;
  hash = byte(hash, n);
  hash = byte(hash, n >>> 8);
  hash = byte(hash, n >>> 16);
  return byte(hash, n >>> 24);
}

function layer(hash: number, values: Uint8Array): number {
  hash = integer(hash, values.length);
  for (const value of values) hash = byte(hash, value);
  return hash;
}

/** Stable 32-bit FNV-1a identity for deterministic client/replay regeneration. */
export function mapIdentity(map: GameMap): string {
  let hash = FNV_OFFSET;
  hash = text(hash, map.theater?.id ?? 'classic');
  hash = integer(hash, map.seed);
  hash = integer(hash, map.geometry.cols);
  hash = integer(hash, map.geometry.rows);
  hash = text(hash, String(map.geometry.tile));
  hash = layer(hash, map.grid);
  hash = layer(hash, map.grid2);
  hash = layer(hash, map.surface);
  return hash.toString(16).padStart(8, '0');
}

export function assertMapIdentity(map: GameMap, expected: string): void {
  const actual = mapIdentity(map);
  if (actual !== expected) throw new Error(`Map identity mismatch: expected ${expected}, regenerated ${actual}.`);
}
