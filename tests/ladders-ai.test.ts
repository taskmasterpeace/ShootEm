// ---------------------------------------------------------------------------
// BOTS LEARN LADDERS (Robert: "they don't know how to use ladders, they
// don't know WHEN to use them"). The machinery under test: floor-aware
// pathfinding (a ladder well connects floor 0 ↔ 1), the E-press at the well
// the path calls for, and the WHEN — room-duty guards post UPSTAIRS when
// their chosen house has a loft (the watchtower fantasy), and any route to
// other-floor business descends the same way. The black box referees the
// obvious failure mode: a bot ping-ponging E at the well.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { BUILDINGS, stampBuilding, type StampCtx } from '../src/sim/buildings';
import { F2_FLOOR, F2_VOID, F2_WELL, GRID, T_OPEN, TILE, WORLD, tileAt } from '../src/sim/map';
import { Rng } from '../src/sim/rng';
import type { Soldier } from '../src/sim/types';
import { World } from '../src/sim/world';

const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;
const DT = 1 / 30;

/** CTF world with a WATCHTOWER (two storeys, ladder + well) stamped a few
 *  tiles from team 0's flag stand, and one heavy guard on room duty. */
function towerScene() {
  const w = new World({ seed: 41, mode: 'ctf', matchMinutes: 15 });
  const flag = w.mode.flags![0];
  const ftx = Math.floor((flag.homePos.x + WORLD / 2) / TILE);
  const ftz = Math.floor((flag.homePos.z + WORLD / 2) / TILE);
  // clear ground + sky for the stamp area, then raise the tower 6 tiles east
  const tx = ftx + 6, tz = ftz - 2;
  for (let dz = -2; dz <= 8; dz++)
    for (let dx = -2; dx <= 8; dx++) {
      w.map.grid[(tz + dz) * GRID + (tx + dx)] = T_OPEN;
      w.map.grid2[(tz + dz) * GRID + (tx + dx)] = F2_VOID;
    }
  const tower = BUILDINGS.find((b) => b.id === 'watchtower')!;
  const ctx: StampCtx = {
    grid: w.map.grid, grid2: w.map.grid2, props: [], pickups: [],
    houses: w.map.houses, claims: [], rng: new Rng(7),
  };
  const ok = stampBuilding(ctx, tower, tx, tz, 0);
  expect(ok, 'watchtower failed to stamp').toBe(true);
  const house = w.map.houses.at(-1)!;
  expect(house.floors, 'tower must be two storeys').toBe(2);

  const guard = w.addSoldier('Overwatch', 'heavy', 0, 'bot');
  guard.botLifeSeed = 1; // room duty
  guard.pos = { x: flag.homePos.x - 4, y: 0, z: flag.homePos.z };
  return { w, guard, house };
}

const onUpperFloor = (w: World, s: Soldier) => {
  const t = tileAt(w.map.grid2, s.pos.x, s.pos.z);
  return s.floor === 1 && (t === F2_FLOOR || t === F2_WELL);
};

describe('bots learn ladders', () => {
  it('a room-duty guard CLIMBS to his loft post (and does not ping-pong)', () => {
    const { w, guard } = towerScene();
    let ladderEvents = 0;
    for (let i = 0; i < Math.round(30 / DT) && !onUpperFloor(w, guard); i++) {
      w.step(DT, new Map());
      ladderEvents += w.events.filter((e) => e.type === 'ladder' && e.soldierId === guard.id).length;
      w.events.length = 0;
    }
    expect(onUpperFloor(w, guard), `guard never reached the loft (floor=${guard.floor} pos=${guard.pos.x.toFixed(1)},${guard.pos.z.toFixed(1)})`).toBe(true);
    expect(ladderEvents, 'ladder ping-pong').toBeLessThanOrEqual(2);

    // hold the post: five more seconds upstairs, no stuck incident, no descent
    for (let i = 0; i < Math.round(5 / DT); i++) w.step(DT, new Map());
    expect(guard.floor, 'guard abandoned the loft').toBe(1);
    expect(w.blackbox.incidents.filter((x) => x.kind === 'stuck').length).toBe(0);
  });

  it('a bot upstairs with ground business climbs DOWN', () => {
    const { w, guard, house } = towerScene();
    // start him ON the loft, but with an ordinary ground life (orbit duty)
    guard.botLifeSeed = 0;
    guard.floor = 1;
    guard.pos = { x: house.center.x, y: 4, z: house.center.z };
    for (let i = 0; i < Math.round(30 / DT) && guard.floor === 1; i++) w.step(DT, new Map());
    expect(guard.floor, 'guard is stranded upstairs').toBe(0);
  });
});
