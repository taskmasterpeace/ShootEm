// ---------------------------------------------------------------------------
// OUTBREAK-SPEC §11.2 — the weapon's TACTICAL FINGERPRINT. NOISE is a real sim
// distance (the muzzle report's reach) that both wakes sprinters and feeds the
// HUD's NSE bar, so the two can never drift. PEN / FIRE / CORPSE trace to real
// behaviours. The neutral service rifle must carry EXACTLY the old flat radius
// so every seeded outbreak match is byte-identical for the standard gun.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS, weaponNoiseRadius, weaponProfile } from '../src/sim/data';
import { World } from '../src/sim/world';

describe('weapon noise radius (§11.2)', () => {
  it('a service rifle carries EXACTLY the old flat 18u (neutral-preserving)', () => {
    expect(weaponNoiseRadius(WEAPONS.ar606)).toBe(18);
  });

  it('report reach is ordered loud → quiet by the muzzle', () => {
    const cannon = weaponNoiseRadius(WEAPONS.tank_cannon);
    const rifle = weaponNoiseRadius(WEAPONS.ar606);
    const smg = weaponNoiseRadius(WEAPONS.kuchler);
    const pistol = weaponNoiseRadius(WEAPONS.pistol);
    const plasma = weaponNoiseRadius(WEAPONS.plasma);
    expect(cannon).toBeGreaterThan(rifle);
    expect(rifle).toBeGreaterThan(smg);
    expect(smg).toBeGreaterThan(pistol);
    expect(pistol).toBeGreaterThan(plasma); // energy hums quieter than a bang
  });

  it('subsonic is the quiet round; a tracer announces itself', () => {
    const plain = weaponNoiseRadius(WEAPONS.ar606);
    expect(weaponNoiseRadius(WEAPONS.ar606, 'sub')).toBeLessThan(plain * 0.5);
    expect(weaponNoiseRadius(WEAPONS.ar606, 'trc')).toBeGreaterThan(plain);
  });

  it('never negative, never runaway (clamped)', () => {
    for (const id of Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]) {
      const r = weaponNoiseRadius(WEAPONS[id]);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(34);
    }
  });
});

describe('weapon profile bars (§11.2)', () => {
  it('penetration reads the round: a railgun punches, a rifle is average', () => {
    expect(weaponProfile(WEAPONS.rg2).pen).toBe(3);
    expect(weaponProfile(WEAPONS.ar606, 'ball').pen).toBe(1);
    // AP ammo lifts the same rifle to the top of the pen scale
    expect(weaponProfile(WEAPONS.ar606, 'ap').pen).toBe(3);
    // expanding rounds mushroom — they give up penetration
    expect(weaponProfile(WEAPONS.ar606, 'exp').pen).toBe(0);
  });

  it('the flamethrower is maximum fire + corpse denial; a rifle is neither', () => {
    const flame = weaponProfile(WEAPONS.flamer);
    expect(flame.fire).toBe(3);
    expect(flame.corpse).toBe(3); // fire is the corpse-denial mechanic (§17)
    expect(weaponProfile(WEAPONS.ar606, 'ball').fire).toBe(0);
    // INCENDIARY rounds turn any rifle into a corpse-burner
    expect(weaponProfile(WEAPONS.ar606, 'inc').fire).toBe(3);
    expect(weaponProfile(WEAPONS.ar606, 'inc').corpse).toBe(3);
  });

  it('the NSE bar IS the wake radius, bucketed (rifle 18u → bar 2, matches ball)', () => {
    expect(weaponProfile(WEAPONS.ar606, 'ball').noise).toBe(2);
    expect(weaponProfile(WEAPONS.plasma).noise).toBe(0);       // energy hums
    expect(weaponProfile(WEAPONS.tank_cannon).noise).toBe(3);  // a cannon booms
    expect(weaponProfile(WEAPONS.ar606, 'sub').noise).toBe(0); // silenced
  });

  it('every bar stays inside 0..3 across the whole armoury', () => {
    for (const id of Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]) {
      const p = weaponProfile(WEAPONS[id]);
      for (const v of [p.pen, p.noise, p.fire, p.corpse]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('gunfire noise wakes a sprinter by the WEAPON (§11.2 wiring)', () => {
  // a dormant sprinter parked at 22u: a cannon's report (30u) reaches it, a
  // pistol's (12u) does not — the same radii the HUD bar reads.
  const runFiring = (weaponId: keyof typeof WEAPONS): boolean => {
    const w = new World({ seed: 42, mode: 'horde' });
    w.outbreakEnabled = true;
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    a.weapons[0] = weaponId; a.weaponIdx = 0;
    const far = { x: 22, y: 0, z: 0 };
    const sprinter = w.addZombie('sprinter', far);
    expect(sprinter.dormant).toBe(true);
    let woke = false;
    for (let i = 0; i < 40 && !woke; i++) {
      a.nextFireAt = w.time + 0.3; // keep the trigger "just pulled" this frame
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) if (e.type === 'sprinter_wake' && e.soldierId === sprinter.id) woke = true;
    }
    return woke;
  };

  it('a cannon report wakes it; a pistol report does not', () => {
    expect(runFiring('tank_cannon'), 'the cannon carried to 22u').toBe(true);
    expect(runFiring('pistol'), 'the pistol stayed under 22u').toBe(false);
  });
});
