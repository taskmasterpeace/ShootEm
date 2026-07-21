// ---------------------------------------------------------------------------
// BALLISTIC FALLOFF (STATUS §1 / W1.4, Robert: "bullets tire; lasers exempt").
// A bullet loses stopping-power with distance flown — full out to 55% of range,
// then a linear taper to FALLOFF_FLOOR at max. Energy weapons don't lose steam.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { FALLOFF_FLOOR, FALLOFF_MIN_FULL, ballisticFalloff, World } from '../src/sim/world';

describe('ballisticFalloff — the taper math', () => {
  it('a long rifle: full out to the knee, then a taper to the floor at max', () => {
    const R = 66; // a real rifle's range; knee = max(36.3, 42) = 42
    expect(ballisticFalloff('bullet', R, 10)).toBe(1);              // point blank
    expect(ballisticFalloff('bullet', R, FALLOFF_MIN_FULL)).toBe(1); // at the knee
    expect(ballisticFalloff('bullet', R, R)).toBeCloseTo(FALLOFF_FLOOR, 5); // floor at max range
    const mid = ballisticFalloff('bullet', R, 56);
    expect(mid).toBeGreaterThan(FALLOFF_FLOOR);
    expect(mid).toBeLessThan(1);
    expect(ballisticFalloff('bullet', R, R * 3)).toBeCloseTo(FALLOFF_FLOOR, 5); // clamps past max
    expect(ballisticFalloff('shell', R, R)).toBeCloseTo(FALLOFF_FLOOR, 5); // shells tire too
  });

  it('close and mid fights never see falloff (full out to the min-full band)', () => {
    // anything inside FALLOFF_MIN_FULL is untouched, whatever the weapon
    expect(ballisticFalloff('bullet', 66, FALLOFF_MIN_FULL - 2)).toBe(1);
    // a short-range weapon (max range inside the min-full band) NEVER tires
    expect(ballisticFalloff('shell', 26, 26)).toBe(1);
    expect(ballisticFalloff('bullet', 40, 40)).toBe(1);
  });

  it('energy weapons are EXEMPT — light does not lose steam', () => {
    for (const t of ['rail', 'beam', 'plasma']) {
      expect(ballisticFalloff(t, 120, 120)).toBe(1);
      expect(ballisticFalloff(t, 120, 300)).toBe(1);
    }
  });
});

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

/** First-hit damage dealt by the shooter's issued rifle to a bare target at
 *  `dist`. Measures ONE hit (loop until hp drops) so weapon spread only delays
 *  the shot, it doesn't change the per-round damage we read. */
function firstHitDamage(dist: number): number {
  const w = new World({ seed: 5, mode: 'tdm', matchMinutes: 10 });
  const shooter = w.addSoldier('S', 'infantry', 0, 'human');
  shooter.pos = { x: 0, y: 0, z: 0 }; shooter.yaw = 0;
  const t = w.addSoldier('T', 'infantry', 1, 'human');
  t.pos = { x: dist, y: 0, z: 0 }; t.armor = 0; t.maxArmor = 0; t.hp = 9999; t.maxHp = 9999;
  const hp0 = t.hp;
  for (let i = 0; i < 400 && t.hp === hp0; i++) {
    w.step(1 / 60, new Map([[shooter.id, cmd({ aimYaw: 0, aimDist: dist, fire: true })]]));
  }
  return hp0 - t.hp;
}

describe('ballistic falloff — wired into the round', () => {
  it('a long shot lands for LESS than a point-blank one (same rifle)', () => {
    // ar606 range is 66, so its full-damage knee is ~36u
    const near = firstHitDamage(8);   // inside the full-damage band
    const far = firstHitDamage(58);   // well past the 55% knee, still in range
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(near);
  });
});
