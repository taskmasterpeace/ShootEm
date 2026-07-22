// ---------------------------------------------------------------------------
// THE SKIRMISH BUILDER — procedural hunt grounds, one biome at a time.
//
// Skirmish maps are small (~62×62) mission grounds: two squad bases, the
// LSW DEN at the heart, and two named support locations drawn from the
// theme's shelf. The mode's rules (tickets, the boss) land later — the
// GROUND carries the fiction now: CP names read "LSW DEN", "RELAY", "BARN".
//
// Deterministic from (theme, seed). Every map answers the six front laws
// (validateDoc patrols it in tests/skirmish.test.ts).
// ---------------------------------------------------------------------------
import {
  GRID, TILE, WORLD, houseAt,
  T_OPEN, T_WALL, T_COVER, T_WATER, T_DEEP,
  S_DIRT, S_GRASS, S_ICE, S_GRIT, S_PLATE, S_WET, S_MUD,
  type GameMap, type PropSpec, type PickupSpawn, type VehiclePad, type House, type TileClaim,
} from './map';
import {
  BUILDINGS, buildingsFor, generateDistrict, generateHouse, stampBuilding,
  type BuildingDef, type StampCtx,
} from './buildings';
import { boxFor } from './fronts';
import { Rng } from './rng';
import { LEGACY_GEOMETRY } from './map-geometry';
import type { Team, ThemeId, Vec3, VehicleKind } from './types';
import type { OperationSiteId } from './operations';
import { dressOperationPads } from './operation-pads';

// ---------------------------------------------------------------------------
// the kit — the fronts' primitives, distilled for one purpose
// ---------------------------------------------------------------------------
const tw = (tx: number, tz: number): Vec3 =>
  ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });
const idx = (tx: number, tz: number) => tz * GRID + tx;
const inb = (t: number) => t >= 0 && t < GRID;

function set(grid: Uint8Array, tx: number, tz: number, t: number) {
  if (inb(tx) && inb(tz)) grid[idx(tx, tz)] = t;
}
function rect(grid: Uint8Array, x0: number, z0: number, x1: number, z1: number, t: number) {
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(grid, x, z, t);
}
function rectSurf(surface: Uint8Array, x0: number, z0: number, x1: number, z1: number, s: number) {
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      if (inb(x) && inb(z)) surface[idx(x, z)] = s;
}
function clearDisc(grid: Uint8Array, cx: number, cz: number, r: number, t = T_OPEN) {
  for (let z = cz - r; z <= cz + r; z++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) set(grid, x, z, t);
}
function ring(grid: Uint8Array, cx: number, cz: number, r: number, t: number, gaps: [number, number][]) {
  const steps = Math.ceil(2 * Math.PI * r * 2);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * 360;
    if (gaps.some(([g0, g1]) => a >= g0 && a <= g1)) continue;
    const rad = (a * Math.PI) / 180;
    set(grid, Math.round(cx + Math.cos(rad) * r), Math.round(cz + Math.sin(rad) * r), t);
  }
}
function claim(grid: Uint8Array, claims: TileClaim[], tx: number, tz: number, t: number) {
  if (!inb(tx) || !inb(tz)) return;
  set(grid, tx, tz, t);
  claims.push({ idx: idx(tx, tz), t });
}
function settle(grid: Uint8Array, claims: TileClaim[]): number[] {
  return [...new Set(claims.filter((c) => grid[c.idx] === c.t).map((c) => c.idx))];
}
function spawnRing(btx: number, btz: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    out.push(tw(btx + Math.round(Math.cos(a) * 3), btz + Math.round(Math.sin(a) * 3)));
  }
  return out;
}
function openOutdoors(grid: Uint8Array, houses: House[], tx: number, tz: number): boolean {
  if (!inb(tx) || !inb(tz) || grid[idx(tx, tz)] !== T_OPEN) return false;
  const w = tw(tx, tz);
  return houseAt(houses, w.x, w.z) < 0;
}
function mudMargins(grid: Uint8Array, surface: Uint8Array) {
  for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) {
    const t = grid[idx(x, z)];
    if (t === T_WATER || t === T_DEEP) continue;
    if ([grid[idx(x + 1, z)], grid[idx(x - 1, z)], grid[idx(x, z + 1)], grid[idx(x, z - 1)]]
      .some((n) => n === T_WATER || n === T_DEEP)) surface[idx(x, z)] = S_MUD;
  }
}

// ---------------------------------------------------------------------------
// the skirmish draft
// ---------------------------------------------------------------------------
interface SkirmishDraft {
  grid: Uint8Array; grid2: Uint8Array; surface: Uint8Array;
  props: PropSpec[]; claims: TileClaim[]; pickups: PickupSpawn[];
  houses: House[]; vehiclePads: VehiclePad[]; rng: Rng;
}

const byId = (id: string): BuildingDef => {
  const def = BUILDINGS.find((b) => b.id === id);
  if (!def) throw new Error(`skirmish wants unknown building '${id}'`);
  return def;
};

function draft(seed: number, fill: number, surf: number): SkirmishDraft {
  const grid = new Uint8Array(GRID * GRID).fill(fill);
  const surface = new Uint8Array(GRID * GRID).fill(surf);
  return { grid, grid2: new Uint8Array(GRID * GRID), surface, props: [], claims: [], pickups: [], houses: [], vehiclePads: [], rng: new Rng(seed) };
}
const ctxOf = (d: SkirmishDraft): StampCtx =>
  ({ grid: d.grid, grid2: d.grid2, props: d.props, pickups: d.pickups, houses: d.houses, claims: d.claims, rng: d.rng });

/** a squad base: a pocket compound with light kit — bike, buggy, ambulance. */
function squadBase(d: SkirmishDraft, side: Team, btx: number, btz: number) {
  const { grid, claims, props } = d;
  clearDisc(grid, btx, btz, 5);
  const open = side === 0 ? 1 : -1;
  for (let i = -4; i <= 4; i++) {
    set(grid, btx - open * 5, btz + i, T_WALL);
    if (Math.abs(i) > 2) set(grid, btx + open * 5, btz + i, T_WALL);
    set(grid, btx + i, btz - 5, i % 3 === 0 ? T_OPEN : T_WALL);
    set(grid, btx + i, btz + 5, i % 3 === 0 ? T_OPEN : T_WALL);
  }
  props.push({ type: 'bunker', pos: tw(btx - open * 3, btz), scale: 1, rot: side === 0 ? 0 : Math.PI });
  claim(grid, claims, btx, btz + 3, T_COVER);
  props.push({ type: 'clone_bay', pos: tw(btx, btz + 3), scale: 1, rot: side === 0 ? 0 : Math.PI });
  const pool: VehicleKind[] = ['bike', 'buggy', 'ambulance'];
  pool.forEach((kind, i) => {
    const px = btx + open * 7, pz = btz + (i - 1) * 4;
    clearDisc(grid, px, pz, 2);
    d.vehiclePads.push({ kind, team: side, pos: tw(px, pz) });
  });
}

/** CP name a building plays on the HUD — the fiction the mode will read */
const CP_NAME: Record<string, string> = {
  relay_station: 'RELAY', watchtower: 'TOWER', kennel: 'KENNEL', barn: 'BARN',
  dome_hab: 'DOME', pump_station: 'PUMP', ore_silo: 'SILO', deck_cabin: 'CABIN',
  containment_lab: 'THE LAB', mine_barracks: 'BARRACKS', ice_hut: 'HUT',
};

// ---------------------------------------------------------------------------
// THE BUILDER
// ---------------------------------------------------------------------------
export interface SkirmishOperationProfile {
  site: OperationSiteId;
  objectiveLabels: string[];
  vehicles: Array<{ id: string; kind: VehicleKind }>;
}

export function generateSkirmishMap(theme: ThemeId, seed: number, profile?: SkirmishOperationProfile): GameMap {
  const box = boxFor('small'); // 62×62 — the squad-scale pocket
  const carved = theme === 'asteroid';
  const baseSurf = theme === 'savanna' ? S_GRASS : theme === 'titan' ? S_GRIT : theme === 'starship' ? S_PLATE
    : theme === 'europa' ? S_WET : theme === 'triton' ? S_ICE : S_DIRT;
  const d = draft(seed, carved ? T_WALL : T_OPEN, baseSurf);
  const { grid, surface, props, claims } = d;
  const ctx = ctxOf(d);
  const midZ = Math.floor((box.z0 + box.z1) / 2);
  const midX = Math.floor((box.x0 + box.x1) / 2);
  const C = 50; // the den's home — the center of every hunt

  if (carved) rect(grid, box.x0, box.z0, box.x1, box.z1, T_OPEN); // the pocket

  // THE LSW DEN: dead center in its own fenced yard — the place the hunt
  // names. Slit guards, a pen, one heavy door.
  clearDisc(grid, C, C, 9);
  stampBuilding(ctx, byId('lsw_den'), C - 4, C - 3, 0);
  ring(grid, C, C, 8, T_COVER, [[30, 60], [120, 150], [210, 240], [300, 330]]);

  // TWO SUPPORT LOCATIONS from the theme's shelf — the pack first, grown
  // stock to fill. North and south of the den, mirrored for fairness.
  const shelf = buildingsFor(theme).filter((b) =>
    b.id !== 'lsw_den' && CP_NAME[b.id] && b.kind !== 'ruin');
  const supports: { def: BuildingDef; tx: number; tz: number }[] = [];
  const supportIds = new Set<string>();
  for (const [sx, sz] of [[C, C - 18], [C, C + 15]] as const) {
    const pick = shelf[d.rng.int(0, shelf.length - 1)];
    const def = supportIds.has(pick.id) && shelf.length > 1
      ? shelf[(shelf.indexOf(pick) + 1) % shelf.length]
      : pick;
    supportIds.add(def.id);
    const w = Math.max(...def.rows.map((r) => r.length));
    const h = def.rows.length;
    stampBuilding(ctx, def, sx - Math.floor(w / 2), sz - Math.floor(h / 2), 2 + supports.length * 2);
    supports.push({ def, tx: sx, tz: sz });
  }

  // ---- the biome grammar ---------------------------------------------------
  if (theme === 'savanna') {
    // farmstead country: fields, kopjes, acacia — the den is the ranch at war
    rectSurf(surface, box.x0 + 6, box.z0 + 6, C - 14, midZ - 4, S_DIRT);
    rectSurf(surface, C + 13, midZ + 4, box.x1 - 6, box.z1 - 6, S_DIRT);
    stampBuilding(ctx, byId('barn'), box.x0 + 6, box.z0 + 5, 8);
    stampBuilding(ctx, generateHouse(d.rng, 'bungalow'), box.x1 - 17, box.z0 + 6, 10);
    for (let i = 0; i < 7; i++) { // kopjes + acacia
      const tx = d.rng.int(box.x0 + 4, box.x1 - 4), tz = d.rng.int(box.z0 + 4, box.z1 - 4);
      if (!openOutdoors(grid, d.houses, tx, tz) || Math.hypot(tx - C, tz - C) < 14 || Math.abs(tz - midZ) < 7) continue;
      if (d.rng.next() < 0.5) {
        claim(grid, claims, tx, tz, T_WALL);
        props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(1.0, 1.7), rot: d.rng.range(0, Math.PI * 2) });
      } else {
        claim(grid, claims, tx, tz, T_WALL);
        props.push({ type: 'tree', pos: tw(tx, tz), scale: d.rng.range(0.8, 1.3), rot: d.rng.range(0, Math.PI * 2) });
      }
    }
  } else if (theme === 'titan') {
    // colony row along the methane track; derelicts where the road bent
    rectSurf(surface, box.x0 + 4, midZ - 1, box.x1 - 4, midZ + 1, S_MUD);
    stampBuilding(ctx, generateHouse(d.rng, 'hall_house'), box.x0 + 5, box.z0 + 8, 8);
    stampBuilding(ctx, generateDistrict(d.rng, 'storefront'), box.x1 - 16, box.z1 - 14, 10);
    for (const [px, pz, r] of [[C - 16, C + 12, 2], [C + 14, C - 14, 3]] as const) {
      clearDisc(grid, px, pz, r + 1);
      for (let z = pz - r; z <= pz + r; z++) for (let x = px - r; x <= px + r; x++) {
        const d2 = (x - px) ** 2 + (z - pz) ** 2;
        if (d2 <= r * r) set(grid, x, z, d2 <= (r - 1) * (r - 1) ? T_DEEP : T_WATER);
      }
    }
    for (const [wx, wz, rot] of [[C - 10, midZ, 1.2], [C + 12, midZ + 1, 4.4]] as const) {
      claim(grid, claims, wx, wz, T_COVER);
      props.push({ type: 'wreck', pos: tw(wx, wz), scale: 1, rot });
    }
  } else if (theme === 'starship') {
    // the deck: corridor runs around a cargo bay, cabins off the lanes
    for (const z of [box.z0 + 10, box.z1 - 10]) {
      for (let x = box.x0 + 4; x <= box.x1 - 4; x++) {
        if (x === midX - 2 || x === midX + 1 || x === C - 12 || x === C + 11) continue;
        set(grid, x, z, T_WALL);
      }
    }
    rect(grid, C - 12, midZ - 3, C + 11, midZ + 3, T_OPEN); // the cargo lane
    for (const [cx2, cz2] of [[C - 8, midZ - 1], [C - 6, midZ + 2], [C + 6, midZ - 2], [C + 8, midZ + 1]] as const) {
      claim(grid, claims, cx2, cz2, T_COVER);
      props.push({ type: 'crate', pos: tw(cx2, cz2), scale: 1, rot: d.rng.range(0, Math.PI) });
    }
    stampBuilding(ctx, byId('deck_cabin'), box.x0 + 4, box.z0 + 4, 8);
    stampBuilding(ctx, byId('deck_cabin'), box.x1 - 10, box.z1 - 9, 10);
  } else if (theme === 'europa') {
    // the dome field: habitats on wet ground, one deep channel south
    rect(grid, box.x0 + 4, box.z1 - 9, box.x1 - 4, box.z1 - 6, T_WATER);
    rect(grid, box.x0 + 4, box.z1 - 8, box.x1 - 4, box.z1 - 7, T_DEEP);
    for (const bx2 of [C - 8, C + 8]) rect(grid, bx2, box.z1 - 9, bx2 + 1, box.z1 - 6, T_OPEN); // crossing decks
    stampBuilding(ctx, byId('dome_hab'), box.x0 + 5, box.z0 + 5, 8);
    stampBuilding(ctx, byId('dome_hab'), box.x1 - 12, box.z0 + 6, 10);
    stampBuilding(ctx, generateDistrict(d.rng, 'market'), box.x0 + 8, box.z1 - 22, 12);
    for (const [px, pz, r] of [[C - 14, C - 10, 2], [C + 13, C + 11, 2]] as const) {
      for (let z = pz - r; z <= pz + r; z++) for (let x = px - r; x <= px + r; x++)
        if ((x - px) ** 2 + (z - pz) ** 2 <= r * r) set(grid, x, z, T_WATER);
    }
  } else if (theme === 'triton') {
    // the station heart and the drifting ridges; one lead cracks the south
    const lead = (pts: [number, number][]) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
        for (let s = 0; s <= steps; s++) {
          const x = Math.round(x0 + ((x1 - x0) * s) / steps);
          const z = Math.round(z0 + ((z1 - z0) * s) / steps);
          set(grid, x, z, T_DEEP);
          set(grid, x + 1, z, T_WATER);
          set(grid, x, z + 1, T_WATER);
        }
      }
    };
    lead([[box.x0 + 8, box.z1 - 14], [C - 6, box.z1 - 18], [C + 10, box.z1 - 12]]);
    stampBuilding(ctx, byId('ice_hut'), box.x0 + 5, box.z0 + 5, 8);
    stampBuilding(ctx, byId('ice_hut'), box.x1 - 11, box.z0 + 7, 10);
    for (let i = 0; i < 8; i++) { // pressure ridges
      const tx = d.rng.int(box.x0 + 4, box.x1 - 4), tz = d.rng.int(box.z0 + 4, box.z1 - 4);
      if (!openOutdoors(grid, d.houses, tx, tz) || Math.hypot(tx - C, tz - C) < 13 || Math.abs(tz - midZ) < 7) continue;
      claim(grid, claims, tx, tz, T_WALL);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(0.9, 1.5), rot: d.rng.range(0, Math.PI * 2) });
    }
  } else {
    // asteroid: the pocket is carved — galleries north and south, drill scars
    rect(grid, box.x0 + 3, midZ - 2, box.x1 - 3, midZ + 2, T_OPEN); // the main drift
    rect(grid, C - 10, box.z0 + 2, C - 7, midZ - 2, T_OPEN);       // north raise
    rect(grid, C + 6, midZ + 2, C + 9, box.z1 - 3, T_OPEN);        // south winze
    rectSurf(surface, box.x0 + 3, midZ - 2, box.x1 - 3, midZ + 2, S_GRIT);
    stampBuilding(ctx, byId('mine_barracks'), C - 16, box.z0 + 4, 8);
    stampBuilding(ctx, byId('ore_silo'), C + 7, box.z1 - 9, 10);
    for (let i = 0; i < 6; i++) { // drill rubble
      const tx = d.rng.int(box.x0 + 3, box.x1 - 3), tz = d.rng.int(midZ - 6, midZ + 6);
      if (!openOutdoors(grid, d.houses, tx, tz) || Math.hypot(tx - C, tz - C) < 12) continue;
      claim(grid, claims, tx, tz, T_COVER);
      props.push({ type: 'rock', pos: tw(tx, tz), scale: d.rng.range(0.7, 1.0), rot: d.rng.range(0, Math.PI * 2) });
    }
  }

  // bases at the pocket's gates
  const btx = [box.x0 + 8, box.x1 - 7] as const;
  if (carved) { clearDisc(grid, btx[0], midZ, 7); clearDisc(grid, btx[1], midZ, 7); }
  squadBase(d, 0, btx[0], midZ);
  squadBase(d, 1, btx[1], midZ);

  // midfield supply, mirrored — every hunt eats
  const spots: [number, number, PickupSpawn['type']][] = [
    [C - 12, C - 8, 'medkit'], [C + 12, C + 8, 'ammo'], [C, C - 12, 'energy'],
  ];
  for (const [px, pz, type] of spots) {
    clearDisc(grid, px, pz, 1);
    d.pickups.push({ type, pos: tw(px, pz) });
  }

  // the quarantine mouths ring the pocket (never on the ship — no zeds there)
  const zombieSpawns: Vec3[] = [];
  if (theme !== 'starship') {
    const r = Math.min(box.x1 - box.x0, box.z1 - box.z0) / 2 - 5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tx = Math.round((box.x0 + box.x1) / 2 + Math.cos(a) * r);
      const tz = Math.round((box.z0 + box.z1) / 2 + Math.sin(a) * r);
      clearDisc(grid, tx, tz, 1);
      zombieSpawns.push(tw(tx, tz));
    }
  }

  mudMargins(grid, surface);
  // the world edge is solid, sealed ground
  for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) grid[idx(x, z)] = T_WALL;
  }

  const cpFor = (s: { def: BuildingDef; tx: number; tz: number }) =>
    ({ name: CP_NAME[s.def.id] ?? 'SITE', pos: tw(s.tx, s.tz) });
  const map: GameMap = {
    seed, theme, geometry: { ...LEGACY_GEOMETRY }, grid, grid2: d.grid2, surface,
    basePos: [tw(btx[0], midZ), tw(btx[1], midZ)],
    spawns: [spawnRing(btx[0], midZ), spawnRing(btx[1], midZ)],
    flagPos: [tw(btx[0], midZ), tw(btx[1], midZ)],
    hillPos: tw(C, C),
    controlPoints: [{ name: 'LSW DEN', pos: tw(C, C + 2) }, ...supports.map(cpFor)],
    vehiclePads: d.vehiclePads, pickups: d.pickups, props, zombieSpawns,
    houses: d.houses, gates: [], pads: [], propCovered: settle(grid, claims),
  };
  if (!profile) return map;

  const objectivePositions = [tw(C, C + 2), ...supports.map((s) => tw(s.tx, s.tz))];
  map.controlPoints = profile.objectiveLabels.map((name, i) => ({
    name: name.toUpperCase(),
    pos: { ...objectivePositions[i % objectivePositions.length] },
  }));
  dressOperationPads(map, profile.vehicles);
  return map;
}
