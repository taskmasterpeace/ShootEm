// ---------------------------------------------------------------------------
// The building library + dynamic structures: 20 authored templates dealt
// procedurally, doors that E opens, and metal the drill cannot eat.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { BUILDINGS, isLegalStencilChar, mirrorDef, stampBuilding } from '../src/sim/buildings';
import {
  GRID, T_COVER, T_DOOR, T_DOOR_OPEN, T_METAL, T_SLIT, T_WALL, TILE, WORLD,
  blocksShot, isBlocked,
} from '../src/sim/map';
import { Rng } from '../src/sim/rng';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

describe('the building library', () => {
  it('twenty templates, ten of them houses, every stencil legal', () => {
    expect(BUILDINGS.length).toBe(20);
    expect(BUILDINGS.filter((b) => b.kind === 'house').length).toBeGreaterThanOrEqual(10);
    for (const b of BUILDINGS) {
      expect(b.floors).toBe(1); // the second storey is a reserved slot, not a promise
      const w = Math.max(...b.rows.map((r) => r.length));
      expect(w).toBeLessThanOrEqual(12);
      expect(b.rows.length).toBeLessThanOrEqual(8);
      for (const row of b.rows) for (const ch of row) {
        expect(isLegalStencilChar(ch), `${b.id}: illegal char '${ch}'`).toBe(true);
      }
      if (b.kind !== 'ruin') {
        expect(b.rows.some((r) => r.includes('D')), `${b.id} needs a door`).toBe(true);
      }
    }
  });

  it('stampBuilding writes tiles, claims, loot, and the roof rect', () => {
    const grid = new Uint8Array(GRID * GRID);
    const ctx: import('../src/sim/buildings').StampCtx = {
      grid, props: [], pickups: [], houses: [], claims: [], rng: new Rng(1),
    };
    const warehouse = BUILDINGS.find((b) => b.id === 'warehouse')!;
    expect(stampBuilding(ctx, warehouse, 40, 40)).toBe(true);
    const count = (t: number) => grid.reduce((n, v) => n + (v === t ? 1 : 0), 0);
    expect(count(T_METAL)).toBeGreaterThan(10);   // metal shell
    expect(count(T_DOOR)).toBe(2);                // double door, closed
    expect(count(T_SLIT)).toBe(2);                // slit windows
    expect(ctx.claims.length).toBeGreaterThanOrEqual(4); // crate cover claimed
    expect(ctx.pickups.length).toBe(1);           // loot on the floor
    expect(ctx.houses.length).toBe(1);            // the roof rect
    expect(ctx.houses[0].tw).toBe(10);
  });

  it('mirrorDef reverses the stencil for the far side', () => {
    const l = BUILDINGS.find((b) => b.id === 'l_house')!;
    const m = mirrorDef(l);
    const w = Math.max(...l.rows.map((r) => r.length));
    for (let i = 0; i < l.rows.length; i++) {
      expect(m.rows[i]).toBe(l.rows[i].padEnd(w, ' ').split('').reverse().join(''));
    }
  });
});

describe('doors — E is the activation key', () => {
  function doorScene() {
    const w = new World({ seed: 5, mode: 'tdm' });
    const tz = Math.floor(GRID / 2), tx = Math.floor(GRID / 2) + 6;
    // a wall segment with a door in it, clear ground around
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -3; dx <= 3; dx++) w.map.grid[(tz + dz) * GRID + tx + dx] = 0;
    w.map.grid[tz * GRID + tx - 1] = T_WALL;
    w.map.grid[tz * GRID + tx] = T_DOOR;
    w.map.grid[tz * GRID + tx + 1] = T_WALL;
    const doorX = (tx + 0.5) * TILE - WORLD / 2;
    const doorZ = (tz + 0.5) * TILE - WORLD / 2;
    const s = w.addSoldier('Opener', 'infantry', 0, 'human');
    s.pos = { x: doorX - TILE, y: 0, z: doorZ };
    s.yaw = 0; // facing +x, at the door
    return { w, s, tx, tz, doorX, doorZ, idx: tz * GRID + tx };
  }

  it('closed blocks movement and sight; E swings it; open lets both through', () => {
    const { w, s, doorX, doorZ, idx } = doorScene();
    expect(isBlocked(w.map.grid, doorX, doorZ)).toBe(true);
    expect(blocksShot(w.map.grid, doorX, doorZ, 1.4)).toBe(true);
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(w.map.grid[idx]).toBe(T_DOOR_OPEN);
    expect(isBlocked(w.map.grid, doorX, doorZ)).toBe(false);
    expect(blocksShot(w.map.grid, doorX, doorZ, 1.4)).toBe(false);
    // E again: shut it behind you
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(w.map.grid[idx]).toBe(T_DOOR);
  });

  it('door state rides the wire — a puppet sees the same doorway', () => {
    const { w, s, idx } = doorScene();
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(w.map.grid[idx]).toBe(T_DOOR_OPEN);
    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));
    const w2 = new World({ seed: 5, mode: 'tdm' });
    w2.puppet = true;
    w2.map.grid[idx] = T_DOOR; // puppet generated the same closed door
    applySnapshot(w2, snap);
    expect(w2.map.grid[idx]).toBe(T_DOOR_OPEN);
  });
});

describe('the drill vs the world', () => {
  function drillAt(tile: number) {
    const w = new World({ seed: 5, mode: 'tdm' });
    const tun = [...w.vehicles.values()].find((v) => v.kind === 'tunneler' && v.team === 0)!;
    const d = w.addSoldier('D', 'engineer', 0, 'human');
    d.pos = { ...tun.pos };
    w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
    expect(d.vehicleId).toBe(tun.id);
    const tz = Math.floor(GRID / 2) + 8, tx = Math.floor(GRID / 2) + 8;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -4; dx <= 4; dx++) w.map.grid[(tz + dz) * GRID + tx + dx] = 0;
    w.map.grid[tz * GRID + tx] = tile;
    tun.pos = { x: (tx + 2.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 };
    tun.vel = { x: 0, y: 0, z: 0 };
    tun.yaw = Math.PI; // face the target tile
    let sparks = 0;
    for (let i = 0; i < 60 * 6; i++) {
      w.step(1 / 60, new Map([[d.id, cmd({ moveZ: -1 })]]));
      for (const e of w.takeEvents()) if (e.type === 'sparks') sparks++;
    }
    return { after: w.map.grid[tz * GRID + tx], sparks, dug: w.dug.length };
  }

  it('walls, slits, and doors are dinner; METAL just throws sparks', () => {
    const wall = drillAt(T_WALL);
    expect(wall.after).toBe(0);
    expect(wall.dug).toBeGreaterThan(0);
    const slit = drillAt(T_SLIT);
    expect(slit.after).toBe(0);
    const door = drillAt(T_DOOR);
    expect(door.after).toBe(0);
    const metal = drillAt(T_METAL);
    expect(metal.after).toBe(T_METAL);   // not a scratch
    expect(metal.sparks).toBeGreaterThan(3); // but a lot of noise and light
  });
});
