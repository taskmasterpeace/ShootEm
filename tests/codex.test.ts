// ---------------------------------------------------------------------------
// V6 THE CODEX — the master sheet's numbers must be the GAME's numbers.
//
// The Codex restates two of world.ts's rules so it can do arithmetic on them:
// what a shot does to a hull, and how many of those a hull survives. A
// restatement is a copy, and copies rot. These tests drive the REAL
// World.damageVehicle and assert the Codex predicted it — so if anyone edits
// the damage model, this suite fails instead of the sheet quietly lying.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  FRAG, HULL_SHARE, effectiveHp, hitsToKill, soldierDamagePerShot,
  sustainedDps, vehicleDamagePerShot,
} from '../src/client/codex';
import { CLASSES, VEHICLES, WEAPONS } from '../src/sim/data';
import { SYSTEM_IDS, type VehicleKind, type WeaponId } from '../src/sim/types';
import { World } from '../src/sim/world';

/** Kill a hull with the real sim and count the hits it took. */
function realHitsToKill(kind: VehicleKind, dmg: number, seed: number): number {
  const w = new World({ seed, mode: 'tdm' });
  const v = w.spawnVehicle(kind, 0, { x: 0, y: 0, z: 0 });
  let n = 0;
  while (v.alive && n < 400) { n++; w.damageVehicle(v, dmg, -1, 'gl'); }
  return n;
}

describe('V6 — the Codex tells the truth', () => {
  it('THE HULL SHARE is the one world.ts actually applies', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const v = w.spawnVehicle('buggy', 0, { x: 0, y: 0, z: 0 });
    const before = v.hp;
    w.damageVehicle(v, 100, -1, 'gl');
    expect(before - v.hp).toBeCloseTo(100 * HULL_SHARE, 6);
  });

  it('SHOTS TO KILL: the Codex predicts what the sim does, across the ladder', () => {
    const frag = vehicleDamagePerShot(WEAPONS[FRAG]);
    for (const kind of ['buggy', 'flyer', 'bike', 'skiff', 'apc', 'tank'] as VehicleKind[]) {
      const codex = hitsToKill(VEHICLES[kind], frag);
      // the sim's answer is a distribution (a random subsystem eats each 35%),
      // so compare against its spread, not one roll
      const real = [3, 11, 29, 47, 88].map((s) => realHitsToKill(kind, frag, s));
      const lo = Math.min(...real), hi = Math.max(...real);
      expect(codex, `${kind}: codex ${codex}, sim ${lo}-${hi}`).toBeGreaterThanOrEqual(lo - 1);
      expect(codex, `${kind}: codex ${codex}, sim ${lo}-${hi}`).toBeLessThanOrEqual(hi + 1);
    }
  });

  it('it is REPRODUCIBLE — the same hull reads the same twice', () => {
    const frag = vehicleDamagePerShot(WEAPONS[FRAG]);
    expect(hitsToKill(VEHICLES.buggy, frag)).toBe(hitsToKill(VEHICLES.buggy, frag));
  });

  it("EFFECTIVE HP counts the hull and all five systems, at the sim's own values", () => {
    const w = new World({ seed: 9, mode: 'tdm' });
    const v = w.spawnVehicle('tank', 0, { x: 0, y: 0, z: 0 });
    const sysTotal = SYSTEM_IDS.reduce((a, id) => a + v.systems[id], 0);
    expect(effectiveHp(VEHICLES.tank)).toBe(v.hp + sysTotal);
  });

  it('A SPLASH WEAPON resolves as splash, never also as a direct hit', () => {
    // world.ts: `if (def.splash > 0) explode(...) else damageVehicle(damage)`,
    // and explode hands a hull (splashDamage + damage*0.5) at zero range.
    const gl = WEAPONS.gl;
    expect(vehicleDamagePerShot(gl)).toBeCloseTo(gl.splashDamage + gl.damage * 0.5, 6);
    const ar = WEAPONS.ar606;
    expect(ar.splash).toBe(0);
    expect(vehicleDamagePerShot(ar)).toBeCloseTo(ar.damage * Math.max(1, ar.pellets), 6);
  });

  it('A SHOTGUN is counted by the pellet, not by the trigger pull', () => {
    const sg = Object.values(WEAPONS).find((d) => d.pellets > 1 && d.splash === 0);
    expect(sg, 'no multi-pellet weapon to check').toBeTruthy();
    expect(soldierDamagePerShot(sg!)).toBeCloseTo(sg!.damage * sg!.pellets, 6);
  });

  it('SUSTAINED DPS pays for the reload; burst does not', () => {
    const r = WEAPONS.ar606;
    const per = soldierDamagePerShot(r);
    const sustained = sustainedDps(r, per);
    expect(sustained).toBeLessThan(per * r.rof);            // the reload is real
    const cycle = r.clip / r.rof + r.reloadTime;
    expect(sustained).toBeCloseTo((r.clip * per) / cycle, 6);
  });

  it("ROBERT'S LAW holds: a couple of grenades kill a buggy, one kills a flyer", () => {
    const frag = vehicleDamagePerShot(WEAPONS[FRAG]);
    expect(hitsToKill(VEHICLES.buggy, frag), 'a buggy should die to a couple of grenades')
      .toBeLessThanOrEqual(3);
    expect(hitsToKill(VEHICLES.flyer, frag), 'one grenade should take a flyer down')
      .toBeLessThanOrEqual(2);
    expect(hitsToKill(VEHICLES.tank, frag), 'a tank must NOT be grenade food')
      .toBeGreaterThan(6);
  });

  it('THE SHEET IS COMPLETE: every vehicle, weapon and class produces real figures', () => {
    for (const kind of Object.keys(VEHICLES) as VehicleKind[]) {
      const d = VEHICLES[kind];
      expect(effectiveHp(d), kind).toBeGreaterThan(0);
      expect(hitsToKill(d, vehicleDamagePerShot(WEAPONS[FRAG])), kind).toBeGreaterThan(0);
      if (d.weapon) expect(WEAPONS[d.weapon], `${kind} names a weapon that does not exist`).toBeTruthy();
    }
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const d = WEAPONS[id];
      expect(Number.isFinite(sustainedDps(d, soldierDamagePerShot(d))), id).toBe(true);
      expect(d.name.length, `${id} has no name to print`).toBeGreaterThan(0);
    }
    for (const c of Object.values(CLASSES)) {
      expect(WEAPONS[c.primary], `${c.id}: primary missing`).toBeTruthy();
      expect(WEAPONS[c.secondary], `${c.id}: sidearm missing`).toBeTruthy();
    }
  });
});
