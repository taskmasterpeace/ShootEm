// ---------------------------------------------------------------------------
// §8.2 THE FRONT LAWS — ten authored grounds, each held to the same oath:
//   1. READABLE: every objective, pad, door, and supply drop is REACHABLE on
//      foot from both bases (BFS over the walkable alphabet — no maze soup,
//      no orphaned islands, no decoration guns).
//   2. SIGNATURE: the front's defining terrain exists (the river, the keep,
//      the runway...) — a regression here is the map losing its story.
//   3. SEALED: the rim holds; nobody walks off the world.
//   4. HONEST: same seed, same ground — the Scar can promise a preview.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { FRONT_GROUNDS, FRONT_STENCILS, generateFront, frontWalkable } from '../src/sim/fronts';
import { BUILDINGS, stencilConnected } from '../src/sim/buildings';
import { FRONTS } from '../src/client/campaign';
import {
  GRID, TILE, WORLD, T_CLIMB, T_COVER, T_DEEP, T_METAL, T_WALL, T_WATER,
  S_ICE, S_PLATE, generateMap, tileAt, type GameMap,
} from '../src/sim/map';
import type { Vec3 } from '../src/sim/types';

const SEED = 4207;
const ids = Object.keys(FRONT_GROUNDS);
const maps = new Map(ids.map((id) => [id, generateFront(id, SEED)!]));

const tileOf = (p: Vec3): [number, number] => [
  Math.floor((p.x + WORLD / 2) / TILE),
  Math.floor((p.z + WORLD / 2) / TILE),
];

/** flood the walkable network from a point; returns the visited mask */
function flood(map: GameMap, from: Vec3): Uint8Array {
  const seen = new Uint8Array(GRID * GRID);
  const [sx, sz] = tileOf(from);
  const q: number[] = [sz * GRID + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % GRID, z = (i / GRID) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      const ni = nz * GRID + nx;
      if (seen[ni] || !frontWalkable(map.grid[ni])) continue;
      seen[ni] = 1;
      q.push(ni);
    }
  }
  return seen;
}

/** a world position counts as reached if its tile or any neighbor is walked
 *  (objects stand ON ground; pads/doors sit at the network's edge) */
function reached(seen: Uint8Array, p: Vec3): boolean {
  const [tx, tz] = tileOf(p);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const x = tx + dx, z = tz + dz;
    if (x >= 0 && z >= 0 && x < GRID && z < GRID && seen[z * GRID + x]) return true;
  }
  return false;
}

const countTiles = (map: GameMap, t: number) => {
  let n = 0;
  for (const v of map.grid) if (v === t) n++;
  return n;
};
const countSurf = (map: GameMap, s: number) => {
  let n = 0;
  for (const v of map.surface) if (v === s) n++;
  return n;
};
const propCount = (map: GameMap, type: string) => map.props.filter((p) => p.type === type).length;
const padCount = (map: GameMap, kind: string) => map.vehiclePads.filter((v) => v.kind === kind).length;

describe('the front laws — all ten grounds', () => {
  it('every Scar front has authored ground (no recipe imposters)', () => {
    for (const f of FRONTS) {
      expect(FRONT_GROUNDS[f.id], `${f.name} still deploys onto a random scatter`).toBeTruthy();
    }
    expect(generateFront('no_such_front', SEED)).toBeNull(); // fallback stays honest
  });

  it.each(ids)('%s: the rim is sealed — nobody walks off the world', (id) => {
    const m = maps.get(id)!;
    for (let i = 0; i < GRID; i++) {
      expect(frontWalkable(m.grid[i]), `${id} north rim ${i}`).toBe(false);
      expect(frontWalkable(m.grid[(GRID - 1) * GRID + i]), `${id} south rim ${i}`).toBe(false);
      expect(frontWalkable(m.grid[i * GRID]), `${id} west rim ${i}`).toBe(false);
      expect(frontWalkable(m.grid[i * GRID + GRID - 1]), `${id} east rim ${i}`).toBe(false);
    }
  });

  it.each(ids)('%s: same seed, same ground — the Scar can promise a preview', (id) => {
    const a = generateFront(id, 977)!;
    const b = generateFront(id, 977)!;
    expect(Buffer.from(a.grid).equals(Buffer.from(b.grid))).toBe(true);
    expect(Buffer.from(a.surface).equals(Buffer.from(b.surface))).toBe(true);
  });

  it.each(ids)('%s: READABLE — every objective, pad, drop, and door reachable from BOTH bases', (id) => {
    const m = maps.get(id)!;
    for (const side of [0, 1] as const) {
      const seen = flood(m, m.basePos[side]);
      const check = (p: Vec3, what: string) =>
        expect(reached(seen, p), `${id}: ${what} unreachable from base ${side}`).toBe(true);
      check(m.basePos[1 - side], 'the enemy base');
      check(m.hillPos, 'the hill');
      m.flagPos.forEach((f, i) => check(f, `flag ${i}`));
      m.controlPoints.forEach((cp) => check(cp.pos, `CP ${cp.name}`));
      m.vehiclePads.forEach((v) => check(v.pos, `${v.kind} pad`));
      m.pickups.forEach((p) => check(p.pos, `${p.type} drop`));
      m.houses.forEach((h, i) => check(h.door, `house ${i} door`));
      m.zombieSpawns.forEach((z, i) => check(z, `quarantine mouth ${i}`));
      for (const sp of m.spawns[side]) check(sp, 'own spawn ring');
    }
  });

  it.each(ids)('%s: ZERO ORPHANS — no walkable tile the war can never touch', (id) => {
    // stricter than the objective check: authored ground has no excuse for
    // sealed pockets. Every tile a soldier could stand on must be a tile a
    // soldier can WALK to. (This is what caught the depot interiors and the
    // base-wall slivers the object law missed.)
    const m = maps.get(id)!;
    const seen = flood(m, m.basePos[0]);
    const orphans: string[] = [];
    for (let z = 0; z < GRID && orphans.length < 8; z++) {
      for (let x = 0; x < GRID && orphans.length < 8; x++) {
        const i = z * GRID + x;
        if (frontWalkable(m.grid[i]) && !seen[i]) orphans.push(`(${x},${z})`);
      }
    }
    expect(orphans, `${id} sealed pockets at ${orphans.join(' ')}`).toEqual([]);
  });

  it.each(ids)('%s: grounded theater — no jump gates, no grav pads', (id) => {
    const m = maps.get(id)!;
    expect(m.gates.length, `${id} grew a teleporter`).toBe(0);
    expect(m.pads.length, `${id} grew a grav pad`).toBe(0);
  });

  it.each(ids)('%s: the walls law — every prop-covered tile still blocks', (id) => {
    const m = maps.get(id)!;
    for (const i of m.propCovered) {
      expect([T_WALL, T_COVER].includes(m.grid[i]), `${id} claim ${i} drifted`).toBe(true);
    }
  });

  it.each(ids)('%s: NO INVISIBLE WALLS — every prop-covered tile has its prop standing on it', (id) => {
    // a propCovered tile is one the renderer SKIPS (the prop owns the
    // visual). If no prop actually stands within 1.6u, the tile blocks
    // movement while drawing NOTHING — the invisible wall. Machine-checked
    // here so "we still got them dumbass invisible walls" ends as a class.
    const m = maps.get(id)!;
    const orphans: string[] = [];
    for (const i of m.propCovered) {
      const x = (i % GRID + 0.5) * TILE - WORLD / 2;
      const z = (Math.floor(i / GRID) + 0.5) * TILE - WORLD / 2;
      const owned = m.props.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 1.6 + p.scale * 1.2);
      if (!owned) orphans.push(`(${i % GRID},${Math.floor(i / GRID)})`);
    }
    expect(orphans, `${id} invisible walls at tiles ${orphans.slice(0, 6).join(' ')}`).toEqual([]);
  });

  it('no invisible walls on the GENERIC maps either — every theme, every mode family', () => {
    for (const [seed, mode, theme] of [[42, 'tdm', 'savanna'], [7, 'conquest', 'starship'], [99, 'ctf', 'europa'], [1234, 'koth', 'triton'], [5150, 'tdm', 'asteroid'], [31, 'conquest', 'titan']] as const) {
      const m = generateMap(seed, mode, theme);
      const bad: number[] = [];
      for (const i of m.propCovered) {
        const x = (i % GRID + 0.5) * TILE - WORLD / 2;
        const z = (Math.floor(i / GRID) + 0.5) * TILE - WORLD / 2;
        if (!m.props.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 1.6 + p.scale * 1.2)) bad.push(i);
      }
      expect(bad.length, `${theme}/${mode}/${seed}: ${bad.length} invisible walls, first at tile ${bad[0]}`).toBe(0);
    }
  });

  it('every authored stencil answers the connectivity law — front stock AND base stock', () => {
    // the depot shipped for weeks with a floor tile sealed behind its own
    // crate because only GROWN buildings were held to stencilConnected.
    // Now the whole library answers: every room serves an entrance.
    for (const def of [...BUILDINGS, ...FRONT_STENCILS]) {
      expect(stencilConnected(def), `${def.id} has a sealed room`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// signatures — the terrain that IS the front. Lose one, lose the story.
// ---------------------------------------------------------------------------
describe('the signatures', () => {
  it('BRIDGE DELTA: a deep river, two hard spans, one wet ford, a dead convoy', () => {
    const m = maps.get('bridge_delta')!;
    expect(countTiles(m, T_DEEP)).toBeGreaterThan(300);           // the river is real
    expect(tileAt(m.grid, m.hillPos.x, m.hillPos.z)).not.toBe(T_DEEP); // the span carries you
    // the ford: shallow the whole width — wheels can take it
    for (let x = 46; x <= 53; x++) expect(m.grid[79 * GRID + x], `ford x${x}`).toBe(T_WATER);
    expect(propCount(m, 'wreck')).toBeGreaterThanOrEqual(2);      // the stalled convoy
    expect(padCount(m, 'boat')).toBe(2);
    expect(padCount(m, 'tank')).toBeGreaterThanOrEqual(2);        // armor country
    expect(m.controlPoints.map((c) => c.name)).toEqual(['SPAN', 'RAIL', 'FORD']);
  });

  it('FORT RAVEN: trench rings, four bunkers, and a two-storey keep on the hill', () => {
    const m = maps.get('fort_raven')!;
    expect(countTiles(m, T_COVER)).toBeGreaterThan(80);           // the trench works
    expect(countTiles(m, T_METAL)).toBeGreaterThan(20);           // bunkers + keep armor
    expect(m.houses.length).toBeGreaterThanOrEqual(6);            // keep + 4 bunkers + posts
    let upper = 0;
    for (const v of m.grid2) if (v !== 0) upper++;
    expect(upper, 'the keep lost its second storey').toBeGreaterThan(10);
    expect(padCount(m, 'tunneler')).toBe(2);                      // the siege doctrine
    const [hx, hz] = [m.hillPos.x, m.hillPos.z];
    expect(Math.hypot(hx, hz), 'KOTH is the keep itself').toBeLessThan(6);
  });

  it('EASTERN PLAINS: five hedgerows, farm silos, and a lane of burned hulls', () => {
    const m = maps.get('eastern_plains')!;
    // counted mid-span only — the base pockets legitimately clear the flanks
    for (const z of [20, 35, 50, 65, 80]) {
      let hedge = 0;
      for (let x = 20; x <= 79; x++) if (m.grid[z * GRID + x] === T_WALL) hedge++;
      expect(hedge, `hedgerow z${z} thinned out`).toBeGreaterThan(40);
    }
    expect(propCount(m, 'silo')).toBe(6);
    expect(propCount(m, 'wreck')).toBe(5);                        // no-man's lane
    expect(padCount(m, 'tank')).toBe(4);                          // tank country doubles up
  });

  it('THE CITY: districts with roofs, a plaza, a canal with two footbridges', () => {
    const m = maps.get('the_city')!;
    expect(m.houses.length).toBeGreaterThanOrEqual(10);
    expect(countTiles(m, T_DEEP)).toBeGreaterThan(120);           // the canal
    // both footbridges stand
    for (const bx of [28, 70]) {
      for (let z = 88; z <= 92; z++) expect(frontWalkable(m.grid[z * GRID + bx]), `bridge x${bx} z${z}`).toBe(true);
    }
    expect(propCount(m, 'wreck')).toBeGreaterThanOrEqual(4);      // dead intersections
    let upper = 0;
    for (const v of m.grid2) if (v !== 0) upper++;
    expect(upper, 'the city lost its second storeys').toBeGreaterThan(10);
  });

  it('HIGHLAND PASS: carved rock, one road, a climb saddle, air doctrine', () => {
    const m = maps.get('highland_pass')!;
    const open = m.grid.filter((t) => frontWalkable(t)).length;
    expect(open / (GRID * GRID), 'the pass should be mostly mountain').toBeLessThan(0.4);
    expect(countTiles(m, T_CLIMB)).toBeGreaterThanOrEqual(10);    // the saddle
    expect(padCount(m, 'flyer')).toBe(2);
    expect(padCount(m, 'transport')).toBe(2);
    expect(padCount(m, 'emplacement')).toBe(2);                   // the overlook guns
  });

  it('BLACKSITE: sea ice, open leads, a lab compound, the antenna farm', () => {
    const m = maps.get('blacksite')!;
    expect(countSurf(m, S_ICE) / (GRID * GRID)).toBeGreaterThan(0.5);
    expect(countTiles(m, T_DEEP)).toBeGreaterThan(30);            // the leads
    expect(m.houses.length).toBeGreaterThanOrEqual(5);            // labs + posts
    expect(propCount(m, 'flare_stack')).toBe(6);                  // the antenna masts
    expect(m.theme).toBe('triton');                               // whiteout weather menu
  });

  it('REFINERY: ten tanks, four flares, two pipe racks, the control room', () => {
    const m = maps.get('refinery')!;
    expect(propCount(m, 'silo')).toBe(10);
    expect(propCount(m, 'flare_stack')).toBe(4);
    for (const z of [24, 76]) {
      let rack = 0;
      for (let x = 18; x <= 81; x++) if (m.grid[z * GRID + x] === T_COVER) rack++;
      expect(rack, `pipe rack z${z}`).toBeGreaterThan(50);
    }
    expect(countTiles(m, T_METAL)).toBeGreaterThan(10);           // the control room
    expect(m.pickups.some((p) => p.type === 'flamer')).toBe(true); // fire doctrine
  });

  it('THE PORT: a deep channel, the moored ship, container lanes, two cranes a side', () => {
    const m = maps.get('the_port')!;
    expect(countTiles(m, T_DEEP)).toBeGreaterThan(300);           // the harbor
    expect(countTiles(m, T_CLIMB)).toBeGreaterThan(60);           // container yards + deck cargo
    expect(countTiles(m, T_METAL)).toBeGreaterThan(30);           // the hull
    expect(propCount(m, 'crane')).toBe(4);
    expect(padCount(m, 'boat')).toBe(2);
    // the deck is plate and the hill — boarding her is the fight
    expect(m.surface[46 * GRID + 49]).toBe(S_PLATE);
  });

  it('AIRBASE: the runway is huge, open, and everyone must cross it', () => {
    const m = maps.get('airbase')!;
    let runway = 0;
    for (let z = 46; z <= 53; z++) for (let x = 8; x <= 91; x++) {
      if (m.surface[z * GRID + x] === S_PLATE && frontWalkable(m.grid[z * GRID + x])) runway++;
    }
    expect(runway, 'the runway must stay open plate').toBeGreaterThan(550);
    expect(m.houses.length).toBeGreaterThanOrEqual(5);            // 3 hangars + tower + shack
    expect(propCount(m, 'silo')).toBe(3);                         // the fuel farm
    expect(padCount(m, 'flyer')).toBe(4);                         // everything that flies
    expect(padCount(m, 'emplacement')).toBe(2);                   // the SAM ring
  });

  it('THE MINE: terraced climb rings, two roofed galleries, the headframe', () => {
    const m = maps.get('the_mine')!;
    expect(countTiles(m, T_CLIMB)).toBeGreaterThan(150);          // three terrace rings
    // the galleries: two long roofed corridors, doors at both ends
    const galleries = m.houses.filter((h) => h.tw >= 18);
    expect(galleries.length, 'the mine lost a gallery').toBe(2);
    expect(countTiles(m, T_METAL)).toBeGreaterThan(80);           // gallery + bunker armor
    expect(propCount(m, 'crane')).toBe(1);                        // the headframe
    expect(padCount(m, 'tunneler')).toBe(2);                      // the breacher's front
  });
});
