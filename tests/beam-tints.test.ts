// ---------------------------------------------------------------------------
// THE BEAM SEVEN — one readable hue per beam god, no purple ever. A wall of
// energy fire has to read as MANY weapons, not one mint smear. Eclipse is the
// no-purple solve for the Lightdrinker: it doesn't get a hue, it gets a dark
// occluding core (verified live in the harness) sheathed in corona pale.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPON_TINTS } from '../src/client/renderer';

// the house purple test, shared with ascendants.test.ts: blue-dominant with
// green suppressed and red not far behind reads purple.
const isPurple = (hex: number) => {
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  return b > 120 && g < b - 40 && r > b - 60;
};

const BEAM_SEVEN = ['lsw_reactor', 'lsw_crimson', 'lsw_magnetar', 'lsw_pulse', 'lsw_frostbite', 'lsw_mirage', 'lsw_eclipse'];

describe('beam tints', () => {
  it('the beam seven each have a distinct tint', () => {
    const tints = BEAM_SEVEN.map((w) => WEAPON_TINTS[w]);
    for (const w of BEAM_SEVEN) expect(WEAPON_TINTS[w], `${w} has no tint`).toBeGreaterThan(0);
    expect(new Set(tints).size, 'two beam gods share a hue').toBe(BEAM_SEVEN.length);
  });

  it('no weapon tint is purple (house law)', () => {
    for (const [w, hex] of Object.entries(WEAPON_TINTS)) {
      expect(isPurple(hex), `${w} tint reads purple`).toBe(false);
    }
  });

  it('every weapon tint is distinct — no two weapons share a color', () => {
    const vals = Object.values(WEAPON_TINTS);
    expect(new Set(vals).size, 'a weapon tint is duplicated').toBe(vals.length);
  });

  it('Eclipse is corona-pale (its dark core is drawn in makeProjectile, verified live)', () => {
    expect(WEAPON_TINTS.lsw_eclipse).toBe(0xfff0d0);
  });
});
