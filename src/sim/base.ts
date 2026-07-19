// ---------------------------------------------------------------------------
// THE BASE COMPOUND (Robert: "make the military base actually be like a
// military base… the entire base"). Replaces the old three-sided bunker with
// a walled compound: a perimeter with a gate facing the enemy and a flanking
// postern, a parade ground at the spawn ring (flag stand open to the sky),
// and real buildings stamped inside from the proven stencil stock — a
// barracks, a watchtower with a manned slit ring (bots climb it now), and a
// supply depot. The motor pool stages just outside the gate.
//
// Everything is written in TEAM-0 ABSOLUTE tiles and mirrored for team 1 by
// x → GRID-1-x, so the two compounds are perfectly fair. Buildings are
// stamped FIRST (their one-tile aprons clear interior ground); the perimeter
// wall is drawn LAST so nothing punches a hole in it. The gate lane and the
// spawn ring are re-opened at the end — the reachability contract is that a
// bot spawning on the parade can always path out through the gate.
// ---------------------------------------------------------------------------
import { BUILDINGS, mirrorDef, stampBuilding, type BuildingDef, type StampCtx } from './buildings';
import { GRID, TILE, WORLD, T_COVER, T_DOOR, T_OPEN, T_SLIT, T_WALL } from './map';
import type { Team, Vec3 } from './types';

const bld = (id: string): BuildingDef => BUILDINGS.find((b) => b.id === id)!;
const wUnits = (def: BuildingDef) => Math.max(...def.rows.map((r) => r.length));
const toWorld = (tx: number, tz: number): Vec3 =>
  ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });

// the compound footprint, in tiles OFFSET from the base center (team 0 faces
// +X toward the map's middle; the gate lives on that side)
export const COMPOUND = {
  west: -7, east: 18, north: -11, south: 11, // wall lines, relative to base center
  gateHalf: 1,   // gate opening is 2·half+1 tiles wide on the east wall
  slitEvery: 5,  // every Nth perimeter tile is a firing slit, not solid wall
};

/**
 * Stamp one team's compound around its base center (bx, bz). Reuses the map's
 * building stock; `seq` seeds the pickup medkit/ammo alternation. Returns the
 * clone-bay tile so the caller can drop the reprint pod on the parade.
 */
export function stampBaseCompound(ctx: StampCtx, bx: number, bz: number, side: Team): { cloneBay: Vec3 } {
  const { grid } = ctx;
  // side-aware X: team 0 is authored; team 1 is the vertical-line mirror
  const mx = (x: number) => (side === 0 ? x : GRID - 1 - x);
  const put = (x: number, z: number, v: number) => {
    const tx = mx(x), tz = z;
    if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) return;
    grid[tz * GRID + tx] = v;
  };
  // buildings stamp side-aware: team 1 gets the mirrored def at the mirrored
  // top-left, exactly like placeBuildings mirrors the battle-map stock
  const stamp = (def: BuildingDef, tx: number, tz: number, seq = 0) => {
    if (side === 0) return stampBuilding(ctx, def, tx, tz, seq);
    return stampBuilding(ctx, mirrorDef(def), GRID - 1 - tx - wUnits(def), tz, seq);
  };
  const openLane = (x0: number, x1: number, z0: number, z1: number) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(x, z, T_OPEN);
  };

  // author EVERYTHING in team-0 space (bx0), then let mx() do the ONE mirror
  // for team 1. (The team-1 base center is itself the mirror of team-0's, so
  // normalizing here is what keeps a single transform instead of a double.)
  const bx0 = side === 0 ? bx : GRID - 1 - bx;
  const WX0 = bx0 + COMPOUND.west, WX1 = bx0 + COMPOUND.east;
  const WZ0 = bz + COMPOUND.north, WZ1 = bz + COMPOUND.south;
  const gateZ = bz; // the gate is centered on the base's own row

  // 1) clear the whole interior + a one-tile skirt so nothing from the old
  //    map bleeds through the compound floor
  openLane(WX0 - 1, WX1 + 1, WZ0 - 1, WZ1 + 1);

  // 2) buildings FIRST (aprons clear interior ground, harmless). Positions are
  //    tuned to leave the spawn ring (±3 around the base) and the gate lane
  //    (the base's own row, out to the east wall) clear.
  stamp(bld('barracks_block'), bx0 + 4, bz - 9, side * 4);     // north bunk block
  stamp(bld('watchtower'), bx0 - 2, bz + 4, 2);              // overwatch OVER THE FLAG — nearest house, so room-duty guards climb its slit ring (2 storeys)
  stamp(bld('bunker'), bx0 + 9, bz + 4, 1 + side);           // south-east supply depot

  // 3) the perimeter wall LAST — solid, so no apron ever opened it. Slit
  //    windows punctuate it (defenders shoot out); the gate gaps the east
  //    wall; a postern doors the south wall for a flanking sally.
  const wallCh = (i: number) => (i % COMPOUND.slitEvery === 0 ? T_SLIT : T_WALL);
  for (let z = WZ0; z <= WZ1; z++) {
    put(WX0, z, wallCh(z));                                    // west (back) wall
    if (Math.abs(z - gateZ) > COMPOUND.gateHalf) put(WX1, z, wallCh(z)); // east wall w/ gate gap
  }
  for (let x = WX0; x <= WX1; x++) {
    put(x, WZ0, wallCh(x));                                    // north wall
    put(x, WZ1, x === bx0 - 4 ? T_DOOR : wallCh(x));           // south wall + postern door
  }

  // 4) re-open the gate lane and the spawn ring — the reachability contract.
  //    (A building wall that crept onto the lane would strand every spawn;
  //    re-clearing after the walls guarantees the way out.)
  openLane(bx0 - 3, WX1 - 1, gateZ - 1, gateZ + 1);           // parade → gate lane, 3 tiles tall
  openLane(bx0 - 3, bx0 + 3, bz - 3, bz + 3);                 // the spawn-ring parade

  // 5) the reprint pod claims a parade tile like every prop (armored glass:
  //    stops boots and bullets, not eyes → T_COVER, the invisible-wall law)
  const cloneTx = bx0 - 3, cloneTz = bz + 2;
  put(cloneTx, cloneTz, T_COVER);
  ctx.claims.push({ idx: cloneTz * GRID + mx(cloneTx), t: T_COVER });
  ctx.props.push({ type: 'clone_bay', pos: toWorld(mx(cloneTx), cloneTz), scale: 1, rot: side === 0 ? 0 : Math.PI });

  return { cloneBay: toWorld(mx(cloneTx), cloneTz) };
}
