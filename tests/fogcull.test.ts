// ---------------------------------------------------------------------------
// #45 VEHICLE FOG + the shared eyesSeePoint primitive. Enemy hulls (like enemy
// corpses, #44) carry no per-tick seen-trail, so the culler — and now the
// renderer's local-play cull — test them LIVE against friendly eyes: a hull
// behind a wall is off your wire, the same hull in the open is on it. This
// locks the primitive that the multiplayer path and local rendering now share,
// so they can never drift apart.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_OPEN, T_WALL, TILE, WORLD } from '../src/sim/map';
import { eyesSeePoint } from '../src/sim/perception';
import { cullSnapshotFor, takeSnapshot } from '../src/sim/snapshot';
import { World } from '../src/sim/world';

const at = (t: number) => (t + 0.5) * TILE - WORLD / 2; // tile center → world

/** Viewer at tile 48, one wall column at 52 across the sight line — the same
 *  staging visibility.test.ts uses, so the fog rule is proven on known ground. */
function staged() {
  const w = new World({ seed: 21, mode: 'tdm' });
  for (let tz = 46; tz <= 54; tz++)
    for (let tx = 36; tx <= 60; tx++) w.map.grid[tz * GRID + tx] = T_OPEN;
  for (let tz = 46; tz <= 54; tz++) w.map.grid[tz * GRID + 52] = T_WALL;
  const me = w.addSoldier('Viewer', 'infantry', 0, 'human');
  me.pos = { x: at(48), y: 0, z: at(50) };
  me.yaw = 0;
  return { w, me };
}

const vehOnWire = (w: World, viewerId: number, vehId: number) =>
  cullSnapshotFor(w, takeSnapshot(w, []), viewerId).vehicles.some((v) => v.id === vehId);

describe('#45 enemy vehicles obey the fog', () => {
  it('a hull behind a wall is off the wire; the same hull in the open is on it', () => {
    const { w, me } = staged();
    const tank = w.spawnVehicle('tank', 1, { x: at(56), y: 0, z: at(50) }); // behind the wall
    expect(vehOnWire(w, me.id, tank.id)).toBe(false);
    tank.pos = { x: at(50), y: 0, z: at(50) };                              // roll into the open
    expect(vehOnWire(w, me.id, tank.id)).toBe(true);
  });

  it('your own vehicles always show, wall or no wall', () => {
    const { w, me } = staged();
    const mine = w.spawnVehicle('tank', 0, { x: at(56), y: 0, z: at(50) }); // friendly, behind the wall
    expect(vehOnWire(w, me.id, mine.id)).toBe(true);
  });
});

describe('eyesSeePoint — the shared corpse/vehicle primitive', () => {
  it('true only where a friendly eye holds line of sight, in range', () => {
    const { w, me } = staged();
    expect(eyesSeePoint(w.map.grid, [me], at(50), at(50), 65)).toBe(true);  // open + close
    expect(eyesSeePoint(w.map.grid, [me], at(56), at(50), 65)).toBe(false); // wall between
    expect(eyesSeePoint(w.map.grid, [me], at(40), at(50), 2)).toBe(false);  // clear line, but out of range
  });
});
