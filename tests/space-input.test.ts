// ---------------------------------------------------------------------------
// SPACE — TAP JUMP / HOLD DUCK (STATUS §1 / W1.3, Robert: "tap space = jump,
// hold = duck"). resolveSpace is the pure contract: a ground class taps to jump
// and holds to duck; a jetpack/ascended body keeps space as held thrust, so its
// duck stays on C and nothing changes for it.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { SPACE_TAP_MS, resolveSpace } from '../src/client/input';

describe('resolveSpace — tap jump / hold duck (W1.3)', () => {
  it('a ground class: a quick tap jumps, a long hold ducks', () => {
    // a tap: released (not held) with the jump one-shot latched → JUMP
    expect(resolveSpace(false, false, 0, true)).toEqual({ jump: true, crouch: false });
    // held past the tap window → DUCK, no jump
    expect(resolveSpace(false, true, SPACE_TAP_MS + 20, false)).toEqual({ jump: false, crouch: true });
    // still inside the window while held → neither yet (waiting to classify)
    expect(resolveSpace(false, true, 50, false)).toEqual({ jump: false, crouch: false });
  });

  it('holding is a duck WITHOUT an accidental hop (no jump while held)', () => {
    expect(resolveSpace(false, true, SPACE_TAP_MS + 200, false).jump).toBe(false);
  });

  it('jetpack / ascended: space stays held thrust — never a duck', () => {
    // held → jump (thrust) the whole time; a duck never comes off space
    expect(resolveSpace(true, true, 999, false)).toEqual({ jump: true, crouch: false });
    // not held → nothing; the tap one-shot is ignored in held-mode
    expect(resolveSpace(true, false, 0, true)).toEqual({ jump: false, crouch: false });
  });
});
