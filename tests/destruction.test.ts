// ---------------------------------------------------------------------------
// DESTRUCTION — the shared mechanic (tile-state, not physics). The laws:
//   TIERED    — soft cover breaks under real splash; STRUCTURAL masonry
//               breaches only under HEAVY (120mm-class) fire; METAL and the
//               map rim never break.
//   MONOTONIC — a breach is walkable rubble: destruction only ever OPENS
//               paths, so the fronts' reachability law survives any sequence.
//   ONE SEAM  — damage arrives through the same explode() every shell uses;
//               sight and movement change purely by the tile's new type.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import {
  GRID, RUBBLE_H, T_COVER, T_METAL, T_OPEN, T_RUBBLE, T_WALL, TILE, WORLD,
  blocksShot, isBlocked, losClear,
} from '../src/sim/map';
import { World } from '../src/sim/world';

/** put a tile of the given type at grid (tx,tz) and return its world center */
function plant(w: World, tx: number, tz: number, t: number) {
  w.map.grid[tz * GRID + tx] = t;
  return { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 };
}

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

describe('the tiered ladder', () => {
  it('a tank shell breaches a structural wall to RUBBLE', () => {
    const w = quiet();
    const pos = plant(w, 40, 40, T_WALL);
    // 120mm is heavy (damage >= 100); three shells clear the 300hp ledger
    // (more would start grinding the RUBBLE toward open ground — the ladder)
    for (let i = 0; i < 3; i++) w.explode(pos, WEAPONS.tank_cannon, -1, 1);
    expect(w.map.grid[40 * GRID + 40], 'the wall never breached').toBe(T_RUBBLE);
    expect(w.breached.length, 'the breach must replicate').toBeGreaterThan(0);
    expect(w.takeEvents().some((e) => e.type === 'wallbreak'), 'no wallbreak event').toBe(true);
  });

  it('grenades NEVER breach structure — masonry shrugs off small arms', () => {
    const w = quiet();
    const pos = plant(w, 40, 40, T_WALL);
    for (let i = 0; i < 40; i++) w.explode(pos, WEAPONS.gl, -1, 1); // 40 grenades
    expect(w.map.grid[40 * GRID + 40], 'a grenade cracked a structural wall').toBe(T_WALL);
  });

  it('soft cover breaks under ordinary splash', () => {
    const w = quiet();
    const pos = plant(w, 40, 40, T_COVER);
    for (let i = 0; i < 3; i++) w.explode(pos, WEAPONS.gl, -1, 1);
    expect(w.map.grid[40 * GRID + 40], 'the crate survived three grenades').toBe(T_RUBBLE);
  });

  it('METAL and the map rim never break', () => {
    const w = quiet();
    const mpos = plant(w, 40, 40, T_METAL);
    for (let i = 0; i < 10; i++) w.explode(mpos, WEAPONS.tank_cannon, -1, 1);
    expect(w.map.grid[40 * GRID + 40], 'metal broke').toBe(T_METAL);
    w.damageWall(0, 40, 99999, true); // the rim
    expect(w.map.grid[40 * GRID + 0], 'the rim broke').not.toBe(T_RUBBLE);
  });

  it('sustained heavy fire grinds rubble AWAY — the full ladder ends at open ground', () => {
    const w = quiet();
    const pos = plant(w, 40, 40, T_WALL);
    for (let i = 0; i < 12; i++) w.explode(pos, WEAPONS.tank_cannon, -1, 1);
    expect(w.map.grid[40 * GRID + 40], 'the ladder stopped short of GONE').toBe(T_OPEN);
  });
});

describe('the monotonic law', () => {
  it('rubble is walkable — a breach OPENS a path that was closed', () => {
    const w = quiet();
    plant(w, 40, 40, T_WALL);
    expect(isBlocked(w.map.grid, (40 + 0.5) * TILE - WORLD / 2, (40 + 0.5) * TILE - WORLD / 2)).toBe(true);
    w.damageWall(40, 40, 99999, true);
    expect(w.map.grid[40 * GRID + 40]).toBe(T_RUBBLE);
    expect(isBlocked(w.map.grid, (40 + 0.5) * TILE - WORLD / 2, (40 + 0.5) * TILE - WORLD / 2),
      'rubble must be walkable — destruction only opens').toBe(false);
  });

  it('rubble slows the boots that cross it', () => {
    const w = quiet();
    const s = w.addSoldier('R', 'infantry', 0, 'human');
    s.pos = { x: 0, y: 0, z: 0 }; s.alive = true;
    // clear ground sprint for one second
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, { moveX: 1, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false, use: false, ability: false, reload: false, grenade: false, weaponSlot: -1 }]]));
    const clearDist = s.pos.x;
    // now sprint the same second across a rubble field
    s.pos = { x: 0, y: 0, z: 0 }; s.vel = { x: 0, y: 0, z: 0 };
    const ctx = Math.floor((0 + WORLD / 2) / TILE), ctz = Math.floor((0 + WORLD / 2) / TILE);
    for (let dx = -1; dx <= 14; dx++) w.map.grid[ctz * GRID + (ctx + dx)] = T_RUBBLE;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, { moveX: 1, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false, use: false, ability: false, reload: false, grenade: false, weaponSlot: -1 }]]));
    expect(s.pos.x, 'rubble did not slow the crossing').toBeLessThan(clearDist * 0.8);
  });
});

describe('the one seam — sight', () => {
  it('eyes see OVER a breach; shins do not', () => {
    const w = quiet();
    plant(w, 40, 40, T_WALL);
    const x = (40 + 0.5) * TILE - WORLD / 2, z = (40 + 0.5) * TILE - WORLD / 2;
    expect(blocksShot(w.map.grid, x, z, 1.4), 'the intact wall must block eyes').toBe(true);
    w.damageWall(40, 40, 99999, true);
    expect(blocksShot(w.map.grid, x, z, 1.4), 'eyes must clear the pile').toBe(false);
    expect(blocksShot(w.map.grid, x, z, RUBBLE_H - 0.2), 'the pile must still stop shins').toBe(true);
    // and the full LOS line across the breach is clear at eye height
    expect(losClear(w.map.grid, { x: x - TILE * 2, y: 1.4, z }, { x: x + TILE * 2, y: 1.4, z })).toBe(true);
  });
});
