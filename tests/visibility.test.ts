// ---------------------------------------------------------------------------
// The WINDOW TRUTH + the SEEN_LINGER trail (§19 target persistence).
// "I looked in the open window and the house looked empty" — never again:
// slits pass perception at eye height, and a target that breaks line of
// sight stays on your wire for SEEN_LINGER seconds, no blink-outs.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_OPEN, T_SLIT, T_WALL, TILE, WORLD } from '../src/sim/map';
import { SEEN_LINGER } from '../src/sim/perception';
import { cullSnapshotFor, takeSnapshot } from '../src/sim/snapshot';
import { World } from '../src/sim/world';
import type { PlayerCmd } from '../src/sim/types';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const at = (t: number) => (t + 0.5) * TILE - WORLD / 2; // tile center → world

/** Flat test range: an open strip with one wall column across it at tx=52.
 *  Viewer stands at tile 48, enemy at tile 56 — LOS must cross the wall. */
function staged() {
  const w = new World({ seed: 21, mode: 'tdm' });
  for (let tz = 46; tz <= 54; tz++)
    for (let tx = 44; tx <= 60; tx++) w.map.grid[tz * GRID + tx] = T_OPEN;
  for (let tz = 46; tz <= 54; tz++) w.map.grid[tz * GRID + 52] = T_WALL;
  const me = w.addSoldier('Viewer', 'infantry', 0, 'human');
  me.pos = { x: at(48), y: 0, z: at(50) };
  const foe = w.addSoldier('Foe', 'infantry', 1, 'human');
  foe.pos = { x: at(56), y: 0, z: at(50) };
  return { w, me, foe };
}

const onWire = (w: World, viewerId: number, soldierId: number) =>
  cullSnapshotFor(w, takeSnapshot(w, []), viewerId).soldiers.some((s) => s.id === soldierId);

describe('the window truth', () => {
  it('a wall hides the defender; swapping in a window slit reveals him', () => {
    const { w, me, foe } = staged();
    expect(onWire(w, me.id, foe.id)).toBe(false);           // solid wall: unseen
    w.map.grid[50 * GRID + 52] = T_SLIT;                    // put a window in it
    expect(onWire(w, me.id, foe.id)).toBe(true);            // framed in the glass
  });
});

describe('the seen-linger trail', () => {
  it('breaking line of sight keeps the target on the wire, then drops it', () => {
    const { w, me, foe } = staged();
    w.map.grid[50 * GRID + 52] = T_SLIT;
    w.step(1 / 60, new Map());                              // stamp the trail
    expect(onWire(w, me.id, foe.id)).toBe(true);
    w.map.grid[50 * GRID + 52] = T_WALL;                    // the shutter slams
    w.step(1 / 60, new Map());
    expect(onWire(w, me.id, foe.id)).toBe(true);            // still lingering…
    for (let i = 0; i < Math.ceil((SEEN_LINGER + 0.3) * 60); i++) w.step(1 / 60, new Map());
    expect(onWire(w, me.id, foe.id)).toBe(false);           // …trail gone cold
  });

  it('engaging cloak cuts the trail instantly — cloak is TRUE', () => {
    const { w, me, foe } = staged();
    w.map.grid[50 * GRID + 52] = T_SLIT;
    w.step(1 / 60, new Map());
    expect(onWire(w, me.id, foe.id)).toBe(true);
    foe.cloaked = true;
    expect(onWire(w, me.id, foe.id)).toBe(false);
  });

  it('death cuts the trail: a corpse shows where eyes rest, never through walls', () => {
    const { w, me, foe } = staged();
    w.map.grid[50 * GRID + 52] = T_SLIT;
    w.step(1 / 60, new Map());
    foe.alive = false;
    foe.hp = 0;
    foe.respawnAt = w.time + 60; // stay a corpse for the whole test
    w.step(1 / 60, new Map());                              // trail wiped on death
    // corpse visible through the open window (eyes rest on it)…
    expect(onWire(w, me.id, foe.id)).toBe(true);
    // …but drag it behind the solid wall and it is GONE, no linger for the dead
    w.map.grid[50 * GRID + 52] = T_WALL;
    expect(onWire(w, me.id, foe.id)).toBe(false);
  });
});
