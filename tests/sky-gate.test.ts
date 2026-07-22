// ---------------------------------------------------------------------------
// THE MOUNTAIN WALL (mountain warfare) — "helicopters can't fly over mountains,
// but jets can" (Robert). A Sky-height massif is a wall to any airframe that
// can't cruise ABOVE it: a rotorcraft (band ceiling 2) never clears it; a jet
// clears only while cruising band 3 (the clouds over the peaks).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, TILE, WORLD, T_OPEN, tileAt, SKY_LEVEL } from '../src/sim/map';
import { tileIndex } from '../src/sim/map-geometry';
import type { PlayerCmd, VehicleKind } from '../src/sim/types';
import type { ElevationLevel } from '../src/sim/elevation';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

/** an open tile with a clear 5-tile westward approach, and a peak stamped on it */
function peakWithApproach(w: World): { x: number; z: number; tx: number; tz: number } {
  for (let tz = 10; tz < GRID - 10; tz++) {
    for (let tx = 12; tx < GRID - 10; tx++) {
      const x = tx * TILE - WORLD / 2 + TILE / 2;
      const z = tz * TILE - WORLD / 2 + TILE / 2;
      if (tileAt(w.map.grid, x, z) !== T_OPEN) continue;
      let clear = true;
      for (let k = 1; k <= 5; k++) if (tileAt(w.map.grid, x - k * TILE, z) !== T_OPEN) { clear = false; break; }
      if (clear) return { x, z, tx, tz };
    }
  }
  throw new Error('no open approach on this seed');
}

function stampPeak(w: World, at: { tx: number; tz: number }) {
  const h = new Uint8Array(w.map.geometry.cols * w.map.geometry.rows);
  h[tileIndex(w.map.geometry, at.tx, at.tz)] = SKY_LEVEL; // a Sky mountain, dead ahead
  w.map.height = h;
}

function fly(w: World, kind: VehicleKind, band: ElevationLevel, at: { x: number; z: number }) {
  const p = w.addSoldier('P', 'infantry', 0, 'human');
  p.alive = true;
  const v = w.spawnVehicle(kind, 0, { x: at.x - 4, y: 0, z: at.z });
  v.alive = true; v.seats[0] = p.id; v.band = band; v.yaw = 0; // nose east, at the peak
  p.vehicleId = v.id; p.seat = 0; p.enteredVehicleAt = w.time - 10; v.spoolUntil = 0;
  return { p, v };
}

function driveEast(w: World, p: { id: number }, v: { band?: ElevationLevel }, band: ElevationLevel) {
  for (let i = 0; i < 60 * 2; i++) { v.band = band; w.step(1 / 60, new Map([[p.id, cmd({ moveZ: -1 })]])); }
}

describe('the mountain wall — rotorcraft Sky-gate', () => {
  it('a HELICOPTER cannot fly over a Sky mountain (it must route around)', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    for (const veh of w.vehicles.values()) if (veh.kind === 'aatrack') veh.alive = false;
    const at = peakWithApproach(w);
    stampPeak(w, at);
    const { p, v } = fly(w, 'attackheli', 2, at); // band 2 = the rotor ceiling
    driveEast(w, p, v, 2);
    expect(v.pos.x, 'the heli pressed toward the peak').toBeGreaterThan(at.x - 3.5);
    expect(v.pos.x, '…but the ridge walled it').toBeLessThan(at.x);
  });

  it('a JET cruising band 3 CLEARS the same Sky mountain', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    for (const veh of w.vehicles.values()) if (veh.kind === 'aatrack') veh.alive = false;
    const at = peakWithApproach(w);
    stampPeak(w, at);
    const { p, v } = fly(w, 'strikejet', 3, at);
    driveEast(w, p, v, 3);
    expect(v.pos.x, 'the jet cruised over the peak').toBeGreaterThan(at.x + TILE);
  });

  it('a jet BELOW band 3 is walled too — you must climb to cross', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    for (const veh of w.vehicles.values()) if (veh.kind === 'aatrack') veh.alive = false;
    const at = peakWithApproach(w);
    stampPeak(w, at);
    const { p, v } = fly(w, 'strikejet', 2, at); // band 2 — not over the peaks yet
    driveEast(w, p, v, 2);
    expect(v.pos.x, 'a low jet cannot ghost through the ridge').toBeLessThan(at.x);
  });
});

// a homing missile that loses sight of its prey behind a Sky ridge drops the
// lock — "break missile lock behind a ridge" (the pilot-AI dogfight tie-in)
function lockScenario(stamp: boolean, id: number) {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  const at = peakWithApproach(w);
  if (stamp) stampPeak(w, at); // the ridge sits between the missile and the jet
  const jet = w.spawnVehicle('interceptor', 1, { x: at.x + 8, y: 0, z: at.z });
  jet.alive = true; jet.band = 1; // low — below the 16u peak, ducked behind it
  const pilot = w.addSoldier('P', 'infantry', 1, 'human');
  jet.seats[0] = pilot.id; pilot.vehicleId = jet.id; pilot.seat = 0; pilot.alive = true;
  const p = w.launch({
    id, weapon: 'sam_missile', ownerId: -1, team: 0,
    pos: { x: at.x - 8, y: 3, z: at.z }, vel: { x: 30, y: 0, z: 0 },
    bornAt: 0, ttl: 8, arc: false, airScaled: true, elevationWeapon: 'manpads',
    homingVehicleId: jet.id,
  } as never);
  return { w, p, jet };
}

describe('break missile lock behind a ridge', () => {
  it('a Sky ridge between the seeker and its prey BREAKS the lock', () => {
    const { w, p } = lockScenario(true, 900500);
    expect(p.homingVehicleId).toBeDefined();
    w.step(1 / 60, new Map());
    expect(p.homingVehicleId, 'the ridge blinded the seeker').toBeUndefined();
  });

  it('with a CLEAR line the lock holds (control)', () => {
    const { w, p, jet } = lockScenario(false, 900501);
    w.step(1 / 60, new Map());
    expect(p.homingVehicleId, 'clear sky keeps the lock').toBe(jet.id);
  });
});
