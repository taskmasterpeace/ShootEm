// ---------------------------------------------------------------------------
// #43 THE UPSTAIRS FISHBOWL (sight-plan A3 step 1). The skyline rule lets a
// silhouette against the sky register in your periphery with no cone and no
// LOS — right for a jet or a jump trooper, WRONG for a soldier standing on a
// second storey, who was seen through every wall by the WHOLE enemy team out
// to the vision budget. The fix guards the rule on floor: floor-1 bodies obey
// the normal cone+LOS path; airborne floor-0 bodies still skyline.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_OPEN, T_WALL, TILE, WORLD } from '../src/sim/map';
import { perceivesNow } from '../src/sim/perception';
import { cullSnapshotFor, takeSnapshot } from '../src/sim/snapshot';
import { World } from '../src/sim/world';

const at = (t: number) => (t + 0.5) * TILE - WORLD / 2; // tile center → world

/** Viewer at tile 48 facing +x, an enemy at tile 56, one wall column at 52
 *  square across the sight line — identical staging to visibility.test.ts. */
function staged() {
  const w = new World({ seed: 21, mode: 'tdm' });
  for (let tz = 46; tz <= 54; tz++)
    for (let tx = 36; tx <= 60; tx++) w.map.grid[tz * GRID + tx] = T_OPEN;
  for (let tz = 46; tz <= 54; tz++) w.map.grid[tz * GRID + 52] = T_WALL;
  const me = w.addSoldier('Viewer', 'infantry', 0, 'human');
  me.pos = { x: at(48), y: 0, z: at(50) };
  me.yaw = 0;
  const foe = w.addSoldier('Foe', 'infantry', 1, 'human');
  foe.pos = { x: at(56), y: 0, z: at(50) };
  return { w, me, foe };
}

const onWire = (w: World, viewerId: number, soldierId: number) =>
  cullSnapshotFor(w, takeSnapshot(w, []), viewerId).soldiers.some((s) => s.id === soldierId);

describe('#43 the upstairs fishbowl', () => {
  it('a floor-1 body behind a wall is NOT seen through it (the fishbowl closes)', () => {
    const { w, me, foe } = staged();
    foe.pos.y = 4;      // standing on the second storey…
    foe.floor = 1;      // …and marked upstairs, dead behind the wall column
    expect(onWire(w, me.id, foe.id)).toBe(false);
  });

  it('the skyline rule stands: an airborne floor-0 silhouette still reads', () => {
    const { w, me, foe } = staged();
    foe.pos.y = 4;      // same height, same spot behind the wall…
    foe.floor = 0;      // …but a jump trooper against the sky, not upstairs
    expect(onWire(w, me.id, foe.id)).toBe(true);
  });

  it('perceivesNow: the floor flag alone flips the skyline shortcut', () => {
    const { w, me, foe } = staged();
    foe.pos.y = 4;
    foe.floor = 0;
    expect(perceivesNow(w.map.grid, [me], w.pinged, foe)).toBe(true);  // sky: shines through
    foe.floor = 1;
    expect(perceivesNow(w.map.grid, [me], w.pinged, foe)).toBe(false); // upstairs: wall wins
  });
});
