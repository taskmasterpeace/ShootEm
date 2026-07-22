// ---------------------------------------------------------------------------
// W5.1 THE SKYLINE IS REAL — aircraft can crash into buildings. At band 1
// (low flight, ~2u) a hull that meets building fabric (walls, slits, doors,
// metal) takes speed-scaled damage and is rebuffed; band 2+ soars the
// sanctuary above the roofline (BAND_ALT clears the rooftops), and the deck
// (band 0) keeps its legacy taxi pass — so the flight/antiair suites, which
// fly bandless, never feel this.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_METAL, T_SLIT, T_WALL, TILE, WORLD, tileAt } from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';
import type { ElevationLevel } from '../src/sim/elevation';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

/** find a building tile with a clear 4-tile westward approach */
function findWallWithApproach(w: World): { x: number; z: number } {
  for (let tz = 6; tz < GRID - 6; tz++) {
    for (let tx = 8; tx < GRID - 6; tx++) {
      const x = tx * TILE - WORLD / 2 + TILE / 2;
      const z = tz * TILE - WORLD / 2 + TILE / 2;
      const t = tileAt(w.map.grid, x, z);
      if (t !== T_WALL && t !== T_SLIT && t !== T_METAL) continue;
      let clear = true;
      for (let k = 1; k <= 4; k++) {
        const tk = tileAt(w.map.grid, x - k * TILE, z);
        if (tk === T_WALL || tk === T_SLIT || tk === T_METAL) { clear = false; break; }
      }
      if (clear) return { x, z };
    }
  }
  throw new Error('no wall with a clear approach on this seed');
}

/** a piloted strikejet aimed dead at the wall from 3.5u out */
function jetAt(w: World, wall: { x: number; z: number }, band: ElevationLevel) {
  const p = w.addSoldier('P', 'infantry', 0, 'human');
  p.alive = true;
  const v = w.spawnVehicle('strikejet', 0, { x: wall.x - 3.5, y: 0, z: wall.z });
  v.alive = true; v.seats[0] = p.id; v.band = band; v.yaw = 0; // nose east, at the wall
  p.vehicleId = v.id; p.seat = 0; p.enteredVehicleAt = w.time - 10;
  return { p, v };
}

describe('W5.1 — the skyline is real', () => {
  it('a band-1 jet flown into a wall takes damage and does not pass', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    for (const veh of w.vehicles.values()) if (veh.kind === 'aatrack') veh.alive = false;
    const wall = findWallWithApproach(w);
    const { p, v } = jetAt(w, wall, 1);
    const hp0 = v.hp;
    let boom = false;
    for (let i = 0; i < 60 * 2; i++) {
      v.band = 1; // the harness pins the band — no climbing out of the test
      w.step(1 / 60, new Map([[p.id, cmd({ moveZ: -1 })]]));
      for (const e of w.takeEvents()) if (e.type === 'explosion') boom = true;
    }
    expect(v.hp, 'the wall bit the hull').toBeLessThan(hp0);
    expect(boom, 'the scrape is loud').toBe(true);
    expect(v.pos.x, 'the hull never ghosted through').toBeLessThan(wall.x);
  });

  it('W5.2: an airborne flyer crossing the border WRAPS to the far side', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    for (const veh of w.vehicles.values()) if (veh.kind === 'aatrack') veh.alive = false;
    const p = w.addSoldier('P', 'infantry', 0, 'human');
    p.alive = true;
    const v = w.spawnVehicle('strikejet', 0, { x: WORLD / 2 - 8, y: 0, z: 0 });
    v.alive = true; v.seats[0] = p.id; v.band = 2; v.yaw = 0; // nose east, at the fence
    p.vehicleId = v.id; p.seat = 0; p.enteredVehicleAt = w.time - 10;
    let wrapped = false;
    for (let i = 0; i < 60 * 3 && !wrapped; i++) {
      v.band = 2;
      w.step(1 / 60, new Map([[p.id, cmd({ moveZ: -1 })]]));
      if (v.pos.x < 0) wrapped = true; // came out the WEST side
    }
    expect(wrapped, 'the attack run re-enters instead of grinding the fence').toBe(true);
    expect(v.alive).toBe(true);
  });

  it('the ground keeps the clamp — a tank at the fence never wraps', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const p = w.addSoldier('P', 'infantry', 0, 'human');
    p.alive = true;
    const v = w.spawnVehicle('tank', 0, { x: WORLD / 2 - 8, y: 0, z: 0 });
    v.alive = true; v.seats[0] = p.id; v.yaw = 0; // nose east, at the fence
    p.vehicleId = v.id; p.seat = 0; p.enteredVehicleAt = w.time - 10;
    for (let i = 0; i < 60 * 2; i++) {
      w.step(1 / 60, new Map([[p.id, cmd({ moveZ: -1 })]]));
    }
    expect(v.pos.x, 'the fence holds the ground war').toBeLessThanOrEqual(WORLD / 2 - 3);
    expect(v.pos.x, 'and it never wrapped').toBeGreaterThan(0);
  });

  it('band 2 soars the sanctuary — the same wall costs nothing', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    for (const veh of w.vehicles.values()) if (veh.kind === 'aatrack') veh.alive = false;
    const wall = findWallWithApproach(w);
    const { p, v } = jetAt(w, wall, 2);
    const hp0 = v.hp;
    for (let i = 0; i < 60 * 2; i++) {
      v.band = 2;
      w.step(1 / 60, new Map([[p.id, cmd({ moveZ: -1 })]]));
    }
    expect(v.hp, 'the roofline is beneath it').toBe(hp0);
    expect(v.pos.x, 'it flew clean over').toBeGreaterThan(wall.x);
  });
});
