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

// ---------------------------------------------------------------------------
// A3 STEP 4 — the CROSS-FLOOR SLANT. One end upstairs, one on the ground:
// the upstairs half of the line marches the UPPER walls, the ground half the
// GROUND walls (split at the midpoint). Ground clutter near the perch is seen
// OVER (the roof-peek); a wall near the ground body still covers him; an
// interior room keeps its own walls (the floor-plan giveaway is dead).
// ---------------------------------------------------------------------------
describe('sight-plan A3 step 4 — the cross-floor slant', () => {
  /** eye UPSTAIRS at cx-3 (floor 1), target on the GROUND at cx+3 */
  function slant() {
    const { w, a, b } = loft();
    const cz = Math.floor(GRID / 2), cx = Math.floor(GRID / 2);
    b.pos = { x: at(cx + 3), y: 0, z: at(cz) }; b.floor = 0; // grounded target
    return { w, a, b, cz, cx };
  }
  const T_WALL_ = 1; // ground wall tile value (T_WALL)

  it('clear slant: the upstairs eye sees the ground body', () => {
    const { w, a, b } = slant();
    expect(sees(w, a, b, true)).toBe(true);
  });

  it('ROOF-PEEK: ground clutter near the PERCH is seen over', () => {
    const { w, a, b, cz, cx } = slant();
    w.map.grid[cz * GRID + cx - 2] = T_WALL_; // ground wall in the EYE half
    expect(sees(w, a, b, true)).toBe(true);   // peeked over from above
  });

  it('a ground wall near the TARGET still covers him', () => {
    const { w, a, b, cz, cx } = slant();
    w.map.grid[cz * GRID + cx + 2] = T_WALL_; // ground wall in the TARGET half
    expect(sees(w, a, b, true)).toBe(false);
  });

  it('your own UPPER wall still blinds the perch', () => {
    const { w, a, b, cz, cx } = slant();
    w.map.grid2[cz * GRID + cx - 2] = F2_WALL; // upper wall in the EYE half
    expect(sees(w, a, b, true)).toBe(false);
  });

  it('the slant is END-anchored, not viewer-anchored — the same walls rule both looks', () => {
    const { w, a, b, cz, cx } = slant();
    // swap roles: the GROUND man is now the eye looking up at the perch.
    // The LINE is the same line — a full-height ground wall near the GROUND
    // end blocks (the slant is still low there, whoever is looking)…
    b.yaw = Math.PI; // b (ground) faces WEST (−x) toward the perch at cx−3
    w.map.grid[cz * GRID + cx + 2] = T_WALL_; // ground clutter near the ground END
    expect(sees(w, b, a, true)).toBe(false);
    // …and ground clutter near the UPPER end is under the slant — seen over
    // from below exactly as it was peeked over from above.
    w.map.grid[cz * GRID + cx + 2] = 0;
    w.map.grid[cz * GRID + cx - 2] = T_WALL_; // ground clutter near the perch
    expect(sees(w, b, a, true)).toBe(true);
    // the perch's own UPPER wall hides the upstairs body from below too
    w.map.grid2[cz * GRID + cx - 2] = F2_WALL;
    expect(sees(w, b, a, true)).toBe(false);
  });
});
