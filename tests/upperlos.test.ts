// ---------------------------------------------------------------------------
// UPSTAIRS-VS-UPSTAIRS LINE OF SIGHT (sight-plan A3 step 2). The fishbowl fix
// made a second-storey body obey cone+LOS, but that LOS still marched only the
// GROUND grid at y=1.4 — so two soldiers both on an upper floor read the ground
// plan by accident and saw straight through the UPPER walls between them.
// perceivesNow now rides losClearUpper (grid2, the nest band) when both eye and
// target stand on floor 1. blocksShotUpper finally gets called from perception.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { F2_FLOOR, F2_SLIT, F2_WALL, GRID, TILE, WORLD } from '../src/sim/map';
import { perceivesNow } from '../src/sim/perception';
import { World } from '../src/sim/world';

const at = (t: number) => (t + 0.5) * TILE - WORLD / 2; // tile center → world

/** A hand-built loft: a wide strip of upper floor with two enemies BOTH on the
 *  second storey, facing along +x, one upper tile between them we can set to a
 *  wall or a window. The ground beneath is cleared open, so only the UPPER
 *  layer can decide whether they see each other. */
function loft() {
  const w = new World({ seed: 7, mode: 'tdm' });
  const cz = Math.floor(GRID / 2);
  const cx = Math.floor(GRID / 2);
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -6; dx <= 6; dx++) {
      w.map.grid[(cz + dz) * GRID + cx + dx] = 0;          // open ground
      w.map.grid2[(cz + dz) * GRID + cx + dx] = F2_FLOOR;  // walkable upper floor
    }
  const a = w.addSoldier('Up-A', 'infantry', 0, 'human');
  a.pos = { x: at(cx - 3), y: 5.4, z: at(cz) }; a.floor = 1; a.yaw = 0; // eyes east toward B
  const b = w.addSoldier('Up-B', 'infantry', 1, 'human');
  b.pos = { x: at(cx + 3), y: 5.4, z: at(cz) }; b.floor = 1;
  return { w, a, b, midIdx: cz * GRID + cx };
}

const sees = (w: World, eye: { pos: { x: number; z: number } }, tgt: unknown, useUpper: boolean) =>
  perceivesNow(w.map.grid, [eye as never], w.pinged, tgt as never, 65, [], undefined,
    useUpper ? w.map.grid2 : undefined);

describe('sight-plan A3 step 2 — upstairs obeys the UPPER walls', () => {
  it('an upper wall between two upstairs soldiers hides them from each other', () => {
    const { w, a, b, midIdx } = loft();
    w.map.grid2[midIdx] = F2_WALL;
    expect(sees(w, a, b, true)).toBe(false);
  });

  it('a clear upper floor — or an upper window — lets them see', () => {
    const { w, a, b, midIdx } = loft();
    w.map.grid2[midIdx] = F2_FLOOR;                 // nothing between them
    expect(sees(w, a, b, true)).toBe(true);
    w.map.grid2[midIdx] = F2_SLIT;                  // a window passes its firing band
    expect(sees(w, a, b, true)).toBe(true);
  });

  it('the upper-LOS test only engages with grid2 — the ground path is untouched', () => {
    const { w, a, b, midIdx } = loft();
    w.map.grid2[midIdx] = F2_WALL;                  // an upper wall stands…
    expect(sees(w, a, b, false)).toBe(true);        // …but ground LOS is clear, so still seen
  });
});
