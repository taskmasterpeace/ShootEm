// ---------------------------------------------------------------------------
// HOME DOORS (Robert: "what if doors automatically open… if that's your
// base?") — doors inside a base zone serve their team: swing open when an
// owner walks up, shut once the doorway clears. Enemies still knock the old
// ways. And no door ever slams through a body standing in it.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_DOOR, T_DOOR_OPEN, T_OPEN, TILE, WORLD } from '../src/sim/map';
import { World } from '../src/sim/world';

const DT = 1 / 30;
const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;

/** A door 12u from team 0's base, open ground around it. */
function doorScene() {
  const w = new World({ seed: 61, mode: 'tdm', matchMinutes: 15 });
  const b = w.map.basePos[0];
  const tx = Math.floor((b.x + 12 + WORLD / 2) / TILE);
  const tz = Math.floor((b.z + WORLD / 2) / TILE);
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) w.map.grid[(tz + dz) * GRID + (tx + dx)] = T_OPEN;
  const idx = tz * GRID + tx;
  w.map.grid[idx] = T_DOOR;
  w.refreshHomeDoors();
  return { w, idx, dx: toWorld(tx), dz: toWorld(tz) };
}

const run = (w: World, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) w.step(DT, new Map());
};

describe('home doors', () => {
  it('opens for the home team, closes behind them', () => {
    const { w, idx, dx, dz } = doorScene();
    const s = w.addSoldier('Owner', 'infantry', 0, 'bot');
    s.dummy = true;
    s.pos = { x: dx - 2, y: 0, z: dz };
    run(w, 0.5);
    expect(w.map.grid[idx], 'door should open for its own team').toBe(T_DOOR_OPEN);

    s.pos = { x: dx - 8, y: 0, z: dz }; // walked away
    run(w, 0.5);
    expect(w.map.grid[idx], 'door should close once the doorway clears').toBe(T_DOOR);
  });

  it('stays shut for the enemy', () => {
    const { w, idx, dx, dz } = doorScene();
    const e = w.addSoldier('Raider', 'infantry', 1, 'bot');
    e.dummy = true;
    e.pos = { x: dx - 2, y: 0, z: dz };
    run(w, 0.7);
    expect(w.map.grid[idx], 'enemy proximity must not open a home door').toBe(T_DOOR);
  });

  it('never slams through a body standing in the doorway', () => {
    const { w, idx, dx, dz } = doorScene();
    w.map.grid[idx] = T_DOOR_OPEN; // an enemy E-opened it and stands in it
    const e = w.addSoldier('Squatter', 'infantry', 1, 'bot');
    e.dummy = true;
    e.pos = { x: dx, y: 0, z: dz };
    run(w, 0.7);
    expect(w.map.grid[idx], 'door closed through a standing body').toBe(T_DOOR_OPEN);

    e.pos = { x: dx - 8, y: 0, z: dz }; // squatter leaves — NOW it shuts
    run(w, 0.5);
    expect(w.map.grid[idx]).toBe(T_DOOR);
  });
});
