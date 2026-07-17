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
  S_ICE, S_PLATE, generateMap, houseAt, tileAt, type GameMap,
} from '../src/sim/map';
import type { Vec3 } from '../src/sim/types';

const SEED = 4207;
const ids = Object.keys(FRONT_GROUNDS);
const SIZES = ['small', 'standard', 'large'] as const;
const maps = new Map(ids.map((id) => [id, generateFront(id, SEED)!]));
/** every front at every tier — the 30 grounds the laws patrol */
const sized = new Map(ids.flatMap((id) => SIZES.map((s) => [`${id}.${s}`, generateFront(id, SEED, s)!] as const)));

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

describe('the front laws — all ten grounds, all three tiers', () => {
  it('every Scar front has authored ground (no recipe imposters)', () => {
    for (const f of FRONTS) {
      expect(FRONT_GROUNDS[f.id], `${f.name} still deploys onto a random scatter`).toBeTruthy();
    }
    expect(generateFront('no_such_front', SEED)).toBeNull(); // fallback stays honest
  });

  it.each([...sized.keys()])('%s: the rim is sealed — nobody walks off the world', (key) => {
    const m = sized.get(key)!;
    for (let i = 0; i < GRID; i++) {
      expect(frontWalkable(m.grid[i]), `${key} north rim ${i}`).toBe(false);
      expect(frontWalkable(m.grid[(GRID - 1) * GRID + i]), `${key} south rim ${i}`).toBe(false);
      expect(frontWalkable(m.grid[i * GRID]), `${key} west rim ${i}`).toBe(false);
      expect(frontWalkable(m.grid[i * GRID + GRID - 1]), `${key} east rim ${i}`).toBe(false);
    }
  });

  it.each(ids)('%s: same seed, same ground — the Scar can promise a preview', (id) => {
    for (const size of SIZES) {
      const a = generateFront(id, 977, size)!;
      const b = generateFront(id, 977, size)!;
      expect(Buffer.from(a.grid).equals(Buffer.from(b.grid)), `${id}.${size} grid drifted`).toBe(true);
      expect(Buffer.from(a.surface).equals(Buffer.from(b.surface)), `${id}.${size} surface drifted`).toBe(true);
    }
  });

  it.each([...sized.keys()])('%s: READABLE — every objective, pad, drop, and door reachable from BOTH bases', (key) => {
    const m = sized.get(key)!;
    for (const side of [0, 1] as const) {
      const seen = flood(m, m.basePos[side]);
      const check = (p: Vec3, what: string) =>
        expect(reached(seen, p), `${key}: ${what} unreachable from base ${side}`).toBe(true);
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

  it.each([...sized.keys()])('%s: ZERO ORPHANS — no walkable tile the war can never touch', (key) => {
    // stricter than the objective check: authored ground has no excuse for
    // sealed pockets. Every tile a soldier could stand on must be a tile a
    // soldier can WALK to. (This is what caught the depot interiors and the
    // base-wall slivers the object law missed.)
    const m = sized.get(key)!;
    const seen = flood(m, m.basePos[0]);
    const orphans: string[] = [];
    for (let z = 0; z < GRID && orphans.length < 8; z++) {
      for (let x = 0; x < GRID && orphans.length < 8; x++) {
        const i = z * GRID + x;
        if (frontWalkable(m.grid[i]) && !seen[i]) orphans.push(`(${x},${z})`);
      }
    }
    expect(orphans, `${key} sealed pockets at ${orphans.join(' ')}`).toEqual([]);
  });

  it.each([...sized.keys()])('%s: grounded theater — no jump gates, no grav pads', (key) => {
    const m = sized.get(key)!;
    expect(m.gates.length, `${key} grew a teleporter`).toBe(0);
    expect(m.pads.length, `${key} grew a grav pad`).toBe(0);
  });

  it.each([...sized.keys()])('%s: the walls law — every prop-covered tile still blocks', (key) => {
    const m = sized.get(key)!;
    for (const i of m.propCovered) {
      expect([T_WALL, T_COVER].includes(m.grid[i]), `${key} claim ${i} drifted`).toBe(true);
    }
  });

  it.each([...sized.keys()])('%s: NO INVISIBLE WALLS — every prop-covered tile has its prop standing on it', (key) => {
    // a propCovered tile is one the renderer SKIPS (the prop owns the
    // visual). If no prop actually stands within 1.6u, the tile blocks
    // movement while drawing NOTHING — the invisible wall. Machine-checked
    // here so "we still got them dumbass invisible walls" ends as a class.
    const m = sized.get(key)!;
    const orphans: string[] = [];
    for (const i of m.propCovered) {
      const x = (i % GRID + 0.5) * TILE - WORLD / 2;
      const z = (Math.floor(i / GRID) + 0.5) * TILE - WORLD / 2;
      const owned = m.props.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 1.6 + p.scale * 1.2);
      if (!owned) orphans.push(`(${i % GRID},${Math.floor(i / GRID)})`);
    }
    expect(orphans, `${key} invisible walls at tiles ${orphans.slice(0, 6).join(' ')}`).toEqual([]);
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

  // Robert: "there was some trees inside of a house… I couldn't get down the
  // hallways." A house FLOOR is T_OPEN, so every naive open-tile scatter
  // planted oaks in living rooms — and a tree claims T_WALL, so it bricked
  // the corridor it landed in.
  //
  // The honest distinction: a CRATE indoors is furniture — stampBuilding's
  // own 'C' stencil char puts it there (the "indoors has STUFF" rule). The
  // OUTDOOR vocabulary — trees, boulders, wrecks, silos, cranes, stacks —
  // has no business inside a building. That's the law.
  const OUTDOOR_ONLY = ['tree', 'rock', 'wreck', 'silo', 'flare_stack', 'crane', 'memorial'];
  const trespassers = (m: GameMap) =>
    m.props.filter((p) => OUTDOOR_ONLY.includes(p.type) && houseAt(m.houses, p.pos.x, p.pos.z) >= 0);

  it.each([...sized.keys()])('%s: NOTHING GROWS INDOORS — no tree, rock, or wreck inside a building', (key) => {
    const m = sized.get(key)!;
    expect(trespassers(m).map((p) => `${p.type}@${p.pos.x.toFixed(0)},${p.pos.z.toFixed(0)}`),
      `${key} grew outdoor props indoors`).toEqual([]);
  });

  it('nothing grows indoors on the GENERIC maps or the neighborhood either', () => {
    for (const [seed, mode, theme] of [[42, 'tdm', 'savanna'], [7, 'conquest', 'savanna'], [99, 'ctf', 'titan'], [1234, 'koth', 'savanna'], [5150, 'tdm', 'titan'], [777, 'conquest', 'titan']] as const) {
      const bad = trespassers(generateMap(seed, mode, theme));
      expect(bad.length, `${theme}/${mode}/${seed}: ${bad.length} indoors (first: ${bad[0]?.type})`).toBe(0);
    }
    // the safehouse neighborhood is ALL houses — the yard tree lived closest to this bug
    for (const seed of [3, 88, 451, 2024]) {
      const bad = trespassers(generateMap(seed, 'safehouse'));
      expect(bad.length, `neighborhood ${seed}: ${bad.length} indoors (first: ${bad[0]?.type})`).toBe(0);
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

  // ------------------------------------------------------------------
  // 33C population scaling + the city's two ordinances
  // ------------------------------------------------------------------

  it.each(ids)('%s: the tiers SCALE — small ground < standard ground < large ground', (id) => {
    const walkable = (size: (typeof SIZES)[number]) => {
      const m = generateFront(id, SEED, size)!;
      let n = 0;
      for (const t of m.grid) if (frontWalkable(t)) n++;
      return n;
    };
    const small = walkable('small'), standard = walkable('standard'), large = walkable('large');
    expect(small, `${id}: small should be tighter than standard`).toBeLessThan(standard);
    expect(standard, `${id}: standard should be tighter than large`).toBeLessThan(large);
  });

  it.each([...sized.keys()])('%s: EVERY BUILDING IS ENTERABLE — door, then floor', (key) => {
    // Robert's law for the city, enforced on every front: no facades. From
    // each building's recorded front door, the BFS must reach a tile that
    // is strictly INSIDE its footprint (the roof rect's interior band).
    const m = sized.get(key)!;
    const seen = flood(m, m.basePos[0]);
    for (const [i, h] of m.houses.entries()) {
      // sewer trunks and galleries have their entrance alphabet on the
      // footprint EDGE (manholes/grates) — the interior band is what proves
      // you can get IN, not just stand AT the door.
      let inside = false;
      for (let z = h.tz; z < h.tz + h.th && !inside; z++) {
        for (let x = h.tx; x < h.tx + h.tw && !inside; x++) {
          const edge = x === h.tx || z === h.tz || x === h.tx + h.tw - 1 || z === h.tz + h.th - 1;
          if (!edge && seen[z * GRID + x] && frontWalkable(m.grid[z * GRID + x])) inside = true;
        }
      }
      expect(inside, `${key}: building ${i} at (${h.tx},${h.tz}) is a facade — no reachable interior`).toBe(true);
    }
  });

  it('THE SEWER LAW: the city trunks take you off the street and drain to the canal', () => {
    for (const size of SIZES) {
      const m = generateFront('the_city', SEED, size)!;
      // manholes exist on the streets (ladder tiles in the trunk walls)
      let ladders = 0;
      for (const t of m.grid) if (t === 8 /* T_LADDER */) ladders++;
      expect(ladders, `the_city.${size}: no manholes — the sewer has no way in`).toBeGreaterThanOrEqual(4);
      // the trunks are roofed buildings (concealment — you're OFF the map down there)
      const trunks = m.houses.filter((h) => h.th >= 5 && h.tw === 4);
      expect(trunks.length, `the_city.${size}: the sewer mains are gone`).toBeGreaterThanOrEqual(size === 'small' ? 2 : 8);
      // every trunk interior is reachable from base — enter by manhole, walk the dark
      const seen = flood(m, m.basePos[0]);
      for (const t of trunks) {
        const mz = t.tz + Math.floor(t.th / 2);
        // either walkway lane (a cache crate can sit in one)
        const a = mz * GRID + t.tx + 1, b = mz * GRID + t.tx + 2;
        expect(seen[a] || seen[b], `the_city.${size}: sewer trunk at (${t.tx},${t.tz}) is sealed`).toBe(1);
      }
    }
  });

  it('the front@size wire: a World deploys the tier the lobby asked for', async () => {
    // main.ts pushes botsPerTeam through the id suffix; world.ts passes the
    // id through untouched — this proves the whole channel end to end.
    const { World } = await import('../src/sim/world');
    const walkable = (w: { map: GameMap }) => {
      let n = 0;
      for (const t of w.map.grid) if (frontWalkable(t)) n++;
      return n;
    };
    const small = new World({ seed: SEED, mode: 'tdm', frontId: 'the_city@small', botsPerTeam: 0 });
    const large = new World({ seed: SEED, mode: 'tdm', frontId: 'the_city@large', botsPerTeam: 0 });
    expect(walkable(small)).toBeLessThan(walkable(large));
    let ladders = 0;
    for (const t of small.map.grid) if (t === 8 /* T_LADDER */) ladders++;
    expect(ladders, 'the deployed small city lost its manholes').toBeGreaterThanOrEqual(4);
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
