import { describe, expect, it } from 'vitest';
import {
  GRID,
  T_OPEN,
  T_WINDOW_H,
  T_WINDOW_H_BROKEN,
  TILE,
  WORLD,
  blocksShot,
  breakWindowTile,
  isBlocked,
  isWindowTile,
  losClear,
  windowIsBroken,
} from '../src/sim/map';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import { World } from '../src/sim/world';

const toWorld = (tile: number) => (tile + 0.5) * TILE - WORLD / 2;

describe('breakable window glass', () => {
  it('blocks bodies and fire intact, then leaves a body-blocking sill with clear sight', () => {
    const grid = new Uint8Array(GRID * GRID);
    const tx = 50, tz = 50, x = toWorld(tx), z = toWorld(tz);
    grid[tz * GRID + tx] = T_WINDOW_H;
    expect(isWindowTile(T_WINDOW_H)).toBe(true);
    expect(windowIsBroken(T_WINDOW_H)).toBe(false);
    expect(isBlocked(grid, x, z)).toBe(true);
    expect(blocksShot(grid, x, z, 1.4)).toBe(true);
    expect(losClear(grid, { x, y: 1.4, z: z - TILE }, { x, y: 1.4, z: z + TILE })).toBe(false);

    grid[tz * GRID + tx] = breakWindowTile(T_WINDOW_H);
    expect(grid[tz * GRID + tx]).toBe(T_WINDOW_H_BROKEN);
    expect(windowIsBroken(grid[tz * GRID + tx])).toBe(true);
    expect(isBlocked(grid, x, z)).toBe(true);
    expect(blocksShot(grid, x, z, 0.6)).toBe(true);
    expect(blocksShot(grid, x, z, 1.4)).toBe(false);
    expect(losClear(grid, { x, y: 1.4, z: z - TILE }, { x, y: 1.4, z: z + TILE })).toBe(true);
  });

  it('shatters once, emits one deterministic event, and replicates cumulatively', () => {
    const w = new World({ seed: 33, mode: 'tdm' });
    const tx = 50, tz = 50, idx = tz * GRID + tx, x = toWorld(tx), z = toWorld(tz);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) w.map.grid[(tz + dz) * GRID + tx + dx] = T_OPEN;
    w.map.grid[idx] = T_WINDOW_H;
    w.takeEvents();
    expect(w.shatterWindowAt(x, z, 0)).toBe(true);
    expect(w.shatterWindowAt(x, z, 0)).toBe(false);
    expect(w.map.grid[idx]).toBe(T_WINDOW_H_BROKEN);
    expect(w.glassChanges).toEqual([idx]);
    expect(w.takeEvents().filter((event) => event.type === 'glass')).toHaveLength(1);

    const puppet = new World({ seed: 33, mode: 'tdm' });
    puppet.puppet = true;
    puppet.map.grid[idx] = T_WINDOW_H;
    applySnapshot(puppet, JSON.parse(JSON.stringify(takeSnapshot(w, []))));
    expect(puppet.map.grid[idx]).toBe(T_WINDOW_H_BROKEN);
    expect(puppet.glassChanges).toEqual([idx]);
  });

  it('the first damaging projectile breaks and stops; the next passes the opening', () => {
    const w = new World({ seed: 34, mode: 'tdm' });
    const tx = 50, tz = 50, idx = tz * GRID + tx, x = toWorld(tx), z = toWorld(tz);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -3; dx <= 3; dx++) w.map.grid[(tz + dz) * GRID + tx + dx] = T_OPEN;
    w.map.grid[idx] = T_WINDOW_H;
    const projectile = (id: number) => ({
      id, weapon: 'ar606' as const, ownerId: 900, team: 0 as const,
      pos: { x, y: 1.4, z: z - 0.8 }, vel: { x: 0, y: 0, z: 30 },
      bornAt: w.time, ttl: 3, arc: false,
    });
    w.takeEvents();
    w.projectiles.set(9101, projectile(9101));
    w.step(1 / 30, new Map());
    expect(w.projectiles.has(9101)).toBe(false);
    expect(w.map.grid[idx]).toBe(T_WINDOW_H_BROKEN);
    w.projectiles.set(9102, projectile(9102));
    w.step(1 / 30, new Map());
    expect(w.projectiles.has(9102)).toBe(true);
  });
});
