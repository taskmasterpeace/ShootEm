// ---------------------------------------------------------------------------
// ACCURACY BY MOVEMENT (STATUS §1 / W1.1, Robert: spread varies by
// crouch/still/walk/sprint/airborne). aimSpreadMul bends the weapon's cone by
// stance: still & walking are the NEUTRAL ×1 baseline (so the threat-measure
// balance arena is untouched), crouch braces tighter, sprint & airborne spray.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { aimSpreadMul } from '../src/sim/world';

type Stance = Parameters<typeof aimSpreadMul>[0];
const stance = (over: Partial<Stance> = {}): Stance =>
  ({ crouching: false, sprinting: false, floor: 0, pos: { x: 0, y: 0, z: 0 }, ...over });

describe('aimSpreadMul — the movement cone', () => {
  it('still and walking are the neutral ×1 baseline', () => {
    expect(aimSpreadMul(stance())).toBe(1);
  });

  it('crouching BRACES the cone tighter than neutral', () => {
    expect(aimSpreadMul(stance({ crouching: true }))).toBeLessThan(1);
  });

  it('sprinting sprays wider than neutral', () => {
    expect(aimSpreadMul(stance({ sprinting: true }))).toBeGreaterThan(1);
  });

  it('firing airborne is the loosest of all — looser than a sprint', () => {
    const air = aimSpreadMul(stance({ pos: { x: 0, y: 3, z: 0 }, floor: 0 }));
    expect(air).toBeGreaterThan(aimSpreadMul(stance({ sprinting: true })));
  });

  it('a soldier UPSTAIRS (floor 1, y=4) is grounded, not airborne', () => {
    // the second storey sits at y=4 but you are standing on it — neutral cone
    expect(aimSpreadMul(stance({ pos: { x: 0, y: 4, z: 0 }, floor: 1 }))).toBe(1);
  });

  it('airborne overrides a lingering crouch flag (you are in the air)', () => {
    expect(aimSpreadMul(stance({ crouching: true, pos: { x: 0, y: 3, z: 0 }, floor: 0 }))).toBeGreaterThan(1);
  });
});
