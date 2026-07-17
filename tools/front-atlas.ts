/**
 * The front atlas — renders every §8.2 authored front to a BMP and audits
 * its walkable network. The mapmaker's loupe:
 *
 *   npx tsx tools/front-atlas.ts            # all fronts → tools/atlas/*.bmp
 *   npx tsx tools/front-atlas.ts the_port   # one front, plus an orphan audit
 *
 * Colors: terrain alphabet + surface tints; unreachable-from-base-0 walkable
 * tiles burn RED so an orphaned pocket is impossible to miss.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRONT_GROUNDS, generateFront, frontWalkable } from '../src/sim/fronts';
import {
  GRID, TILE, WORLD,
  T_OPEN, T_WALL, T_COVER, T_WATER, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL, T_LADDER, T_DEEP, T_CLIMB,
  S_GRASS, S_ICE, S_GRIT, S_PLATE, S_WET, S_MUD,
} from '../src/sim/map';
import type { GameMap } from '../src/sim/map';
import type { Vec3 } from '../src/sim/types';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'atlas');
mkdirSync(OUT, { recursive: true });

const SEED = 4207;
const SCALE = 5; // 100 tiles → 500px

const tileOf = (p: Vec3): [number, number] => [
  Math.floor((p.x + WORLD / 2) / TILE),
  Math.floor((p.z + WORLD / 2) / TILE),
];

function flood(m: GameMap, from: Vec3): Uint8Array {
  const seen = new Uint8Array(GRID * GRID);
  const [sx, sz] = tileOf(from);
  const q = [sz * GRID + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % GRID, z = (i / GRID) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      const ni = nz * GRID + nx;
      if (!seen[ni] && frontWalkable(m.grid[ni])) { seen[ni] = 1; q.push(ni); }
    }
  }
  return seen;
}

/** 24-bit uncompressed BMP — zero deps, readable by anything */
function writeBmp(path: string, w: number, h: number, px: Uint8Array) {
  const rowPad = (4 - ((w * 3) % 4)) % 4;
  const dataSize = (w * 3 + rowPad) * h;
  const buf = Buffer.alloc(54 + dataSize);
  buf.write('BM'); buf.writeUInt32LE(54 + dataSize, 2); buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(w, 18); buf.writeInt32LE(-h, 22); // top-down
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(dataSize, 34);
  let o = 54;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      buf[o++] = px[i + 2]; buf[o++] = px[i + 1]; buf[o++] = px[i]; // BGR
    }
    o += rowPad;
  }
  writeFileSync(path, buf);
}

const SURF_TINT: Record<number, [number, number, number]> = {
  [S_GRASS]: [86, 118, 74], [S_ICE]: [188, 208, 216], [S_GRIT]: [122, 108, 88],
  [S_PLATE]: [96, 100, 106], [S_WET]: [70, 96, 104], [S_MUD]: [94, 78, 58],
};

function render(id: string, m: GameMap) {
  const px = new Uint8Array(GRID * SCALE * GRID * SCALE * 3);
  const seen = flood(m, m.basePos[0]);
  const put = (tx: number, tz: number, r: number, g: number, b: number) => {
    for (let dz = 0; dz < SCALE; dz++) for (let dx = 0; dx < SCALE; dx++) {
      const i = ((tz * SCALE + dz) * GRID * SCALE + tx * SCALE + dx) * 3;
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
  };
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    const t = m.grid[z * GRID + x];
    let c: [number, number, number] =
      t === T_WALL ? [40, 38, 34]
      : t === T_METAL ? [70, 74, 84]
      : t === T_COVER ? [140, 120, 70]
      : t === T_SLIT ? [180, 160, 90]
      : t === T_DOOR ? [190, 140, 60]
      : t === T_DOOR_OPEN ? [210, 170, 90]
      : t === T_WATER ? [72, 130, 160]
      : t === T_DEEP ? [30, 62, 96]
      : t === T_LADDER ? [220, 200, 120]
      : t === T_CLIMB ? [160, 92, 48]
      : SURF_TINT[m.surface[z * GRID + x]] ?? [80, 80, 76];
    // an orphan is a walkable tile base 0 can never stand on — burn it red
    if (frontWalkable(t) && !seen[z * GRID + x]) c = [220, 40, 40];
    put(x, z, c[0], c[1], c[2]);
  }
  // objectives: white = CPs, amber = hill, cyan-ish = bases
  const dot = (p: Vec3, r: number, g: number, b: number) => {
    const [tx, tz] = tileOf(p);
    put(tx, tz, r, g, b);
  };
  for (const cp of m.controlPoints) dot(cp.pos, 255, 255, 255);
  dot(m.hillPos, 232, 163, 61);
  dot(m.basePos[0], 61, 189, 232); dot(m.basePos[1], 61, 189, 232);
  writeBmp(join(OUT, `${id}.bmp`), GRID * SCALE, GRID * SCALE, px);

  // the audit: anything the flood can't reach, named
  const misses: string[] = [];
  const reach = (p: Vec3, what: string) => {
    const [tx, tz] = tileOf(p);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx, z = tz + dz;
      if (x >= 0 && z >= 0 && x < GRID && z < GRID && seen[z * GRID + x]) return;
    }
    misses.push(`${what} @ tile(${tx},${tz})`);
  };
  m.pickups.forEach((p) => reach(p.pos, `pickup:${p.type}`));
  m.vehiclePads.forEach((v) => reach(v.pos, `pad:${v.kind}`));
  m.controlPoints.forEach((cp) => reach(cp.pos, `CP:${cp.name}`));
  m.houses.forEach((h, i) => reach(h.door, `door:${i}`));
  m.zombieSpawns.forEach((zp, i) => reach(zp, `mouth:${i}`));
  reach(m.hillPos, 'hill');
  console.log(`${id}: ${misses.length === 0 ? 'all reachable ✓' : 'ORPHANS → ' + misses.join(' · ')}`);
}

const only = process.argv[2];
for (const id of Object.keys(FRONT_GROUNDS)) {
  if (only && id !== only) continue;
  render(id, generateFront(id, SEED)!);
}
console.log(`atlas → ${OUT}`);
