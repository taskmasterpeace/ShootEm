// ---------------------------------------------------------------------------
// AMMUNITION TYPES (OUTBREAK-SPEC §11): B cycles the loaded round through
// BALL → ARMOR-PIERCING → INCENDIARY. AP threads plate for less soft damage;
// INC is denial — it burns corpses down and mauls the undead, at a cost
// against the merely living. The cycle rides on the sim's PlayerCmd so a
// replay reproduces it exactly.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

function idle(): PlayerCmd {
  return { moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false, use: false, ability: false, reload: false, grenade: false, weaponSlot: -1 };
}

describe('ammo: the B cycle', () => {
  it('walks the full roster ball → AP → INC → TRC → SUB → EXP → BNR → ball', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const man = w.addSoldier('Gunner', 'infantry', 0, 'human');
    expect(man.ammoType).toBeUndefined(); // ball is the absent default
    const tap = () => w.step(1 / 60, new Map([[man.id, { ...idle(), cycleAmmo: true }]]));
    for (const want of ['ap', 'inc', 'trc', 'sub', 'exp', 'bnr'] as const) {
      tap();
      expect(man.ammoType).toBe(want);
    }
    tap();
    expect(man.ammoType).toBeUndefined(); // wraps back to ball
  });

  it('a god does not fumble with ammo boxes — the cycle is inert while ascendant', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const man = w.addSoldier('Titan', 'infantry', 0, 'human');
    man.ascendant = 'firebrand';
    w.step(1 / 60, new Map([[man.id, { ...idle(), cycleAmmo: true }]]));
    expect(man.ammoType).toBeUndefined();
  });
});

describe('ammo: AP threads plate', () => {
  it('an AP round lands damage on flesh through armor; ball does not', () => {
    const shoot = (ammo: 'ap' | undefined) => {
      const w = new World({ seed: 11, mode: 'tdm', matchMinutes: 10 });
      const target = w.addSoldier('Plated', 'heavy', 1, 'bot');
      target.pos = { x: 20, y: 0, z: 0 };
      target.armor = 200; target.maxArmor = 200; // deep plate, so ball is fully soaked
      const hp0 = target.hp;
      // fire an AP-flagged round straight at him via the fire path
      const shooter = w.addSoldier('Shooter', 'infantry', 0, 'human');
      shooter.pos = { x: 0, y: 0, z: 0 };
      shooter.yaw = 0; // aim +x, toward the target
      shooter.ammoType = ammo;
      // pump fire + physics until the round arrives (or we give up)
      for (let i = 0; i < 60 * 3 && target.hp === hp0; i++) {
        w.step(1 / 60, new Map([[shooter.id, { ...idle(), aimYaw: 0, aimDist: 20, fire: true }]]));
        w.takeEvents();
      }
      return hp0 - target.hp;
    };
    const apBled = shoot('ap');
    const ballBled = shoot(undefined);
    expect(apBled).toBeGreaterThan(0);      // AP reached flesh through the plate
    expect(ballBled).toBe(0);               // ball was fully soaked by 200 plate
  });
});

describe('ammo: incendiary is denial', () => {
  it('INC savages the undead (bonus vs a ZedKind)', () => {
    const bleed = (ammo: 'inc' | undefined) => {
      const w = new World({ seed: 5, mode: 'horde', matchMinutes: 10 });
      w.outbreakEnabled = true;
      const zed = w.addZombie('brute', { x: 18, y: 0, z: 0 });
      const hp0 = zed.hp;
      const shooter = w.addSoldier('Torch', 'infantry', 0, 'human');
      shooter.pos = { x: 0, y: 0, z: 0 };
      shooter.yaw = 0;
      shooter.ammoType = ammo;
      for (let i = 0; i < 30 && zed.hp === hp0; i++) {
        w.step(1 / 60, new Map([[shooter.id, { ...idle(), aimYaw: 0, aimDist: 18, fire: true }]]));
        w.takeEvents();
      }
      return hp0 - zed.hp;
    };
    // NOTE: INC is −15% vs living but +60% vs undead — the net swing on a
    // ZedKind is a clear increase over plain ball.
    expect(bleed('inc')).toBeGreaterThan(bleed(undefined));
  });

  it('an INC kill burns the body — a hot corpse booked this frame never rises', () => {
    const w = new World({ seed: 9, mode: 'horde', matchMinutes: 10 });
    w.outbreakEnabled = true;
    const victim = w.addSoldier('Exposed', 'infantry', 1, 'bot');
    victim.pos = { x: 14, y: 0, z: 0 };
    victim.viralLoad = 80;           // hot enough to book on death
    victim.hp = 6; victim.armor = 0; // one INC round finishes him
    const shooter = w.addSoldier('Torch', 'infantry', 0, 'human');
    shooter.pos = { x: 0, y: 0, z: 0 };
    shooter.yaw = 0;
    shooter.ammoType = 'inc';
    for (let i = 0; i < 60 * 2 && victim.alive; i++) {
      w.step(1 / 60, new Map([[shooter.id, { ...idle(), aimYaw: 0, aimDist: 14, fire: true }]]));
      w.takeEvents();
    }
    expect(victim.alive).toBe(false);
    // the body was booked at ≥40 viral, then the same INC round neutralized it
    const live = w.corpses.filter((c) => !c.neutralized);
    expect(live.length).toBe(0);
  });
});

describe('ammo: the Phase-3 roster (§11.1)', () => {
  /** Fire `ammo` at a stationary zero-armor target and return the damage dealt.
   *  Targets are HUMAN-kind (no AI) so they hold the firing line. */
  function bleed(ammo: 'exp' | undefined, target: 'flesh' | 'zed') {
    const w = new World({ seed: 7, mode: 'horde', matchMinutes: 10 });
    w.outbreakEnabled = true;
    const shooter = w.addSoldier('Shooter', 'infantry', 0, 'human');
    shooter.pos = { x: 0, y: 0, z: 0 }; shooter.yaw = 0; shooter.ammoType = ammo;
    let t: { hp: number };
    if (target === 'zed') {
      t = w.addZombie('brute', { x: 18, y: 0, z: 0 }); // armor 0, undead
    } else {
      const m = w.addSoldier('Mark', 'infantry', 1, 'human');
      m.pos = { x: 18, y: 0, z: 0 }; m.armor = 0; m.maxArmor = 0; // bare living flesh
      t = m;
    }
    const hp0 = t.hp;
    for (let i = 0; i < 30 && t.hp === hp0; i++) {
      w.step(1 / 60, new Map([[shooter.id, { ...idle(), aimYaw: 0, aimDist: 18, fire: true }]]));
      w.takeEvents();
    }
    return hp0 - t.hp;
  }

  it('EXPANDING maws bare flesh but wilts on the undead', () => {
    // vs an UNARMORED living body, EXP (×1.5) clearly beats plain ball
    expect(bleed('exp', 'flesh')).toBeGreaterThan(bleed(undefined, 'flesh'));
    // vs the dead (armored-or-undead branch, ×0.65), EXP does LESS than ball
    expect(bleed('exp', 'zed')).toBeLessThan(bleed(undefined, 'zed'));
  });

  it('BIO-NEUTRALIZING denies the corpse without fire', () => {
    const w = new World({ seed: 8, mode: 'horde', matchMinutes: 10 });
    w.outbreakEnabled = true;
    const victim = w.addSoldier('Exposed', 'infantry', 1, 'bot');
    victim.pos = { x: 14, y: 0, z: 0 };
    victim.viralLoad = 80; victim.hp = 20; victim.armor = 0;
    const shooter = w.addSoldier('Chem', 'infantry', 0, 'human');
    shooter.pos = { x: 0, y: 0, z: 0 }; shooter.yaw = 0; shooter.ammoType = 'bnr';
    for (let i = 0; i < 60 * 3 && victim.alive; i++) {
      w.step(1 / 60, new Map([[shooter.id, { ...idle(), aimYaw: 0, aimDist: 14, fire: true }]]));
      w.takeEvents();
    }
    expect(victim.alive).toBe(false);
    expect(w.corpses.filter((c) => !c.neutralized).length).toBe(0); // denied, no flame
  });

  it('TRACER marks the struck target', () => {
    const w = new World({ seed: 9, mode: 'tdm', matchMinutes: 10 });
    const shooter = w.addSoldier('Spotter', 'infantry', 0, 'human');
    shooter.pos = { x: 0, y: 0, z: 0 }; shooter.yaw = 0; shooter.ammoType = 'trc';
    const mark = w.addSoldier('Marked', 'infantry', 1, 'human'); // human = holds the line
    mark.pos = { x: 16, y: 0, z: 0 };
    for (let i = 0; i < 40 && !w.tagged.has(mark.id); i++) {
      w.step(1 / 60, new Map([[shooter.id, { ...idle(), aimYaw: 0, aimDist: 16, fire: true }]]));
      w.takeEvents();
    }
    expect(w.tagged.has(mark.id)).toBe(true); // pinned on the enemy screen
  });
});
