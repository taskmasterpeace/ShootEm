// ---------------------------------------------------------------------------
// 10.1 row 178 — BRAND SIGNATURES: each manufacturer carries a firing
// BEHAVIOR, not a stat curve. maklov TRUE ISSUE · kuchler HOT HALF · titan
// CONCUSSIVE · harkov MATCH-GRADE · ceres DEEP POCKETS · kamenel HOT LOADS.
// Core class weapons carry NO brand — bots and the threat-measure arena
// never feel any of this.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { GRID, T_OPEN, TILE, WORLD } from '../src/sim/map';
import type { PlayerCmd, WeaponDef } from '../src/sim/types';
import { World } from '../src/sim/world';

/** carve a clear firing lane along z=0 — seed terrain must not eat the duel */
function carveLane(w: World, toX: number) {
  const tz = Math.floor((0 + WORLD / 2) / TILE);
  for (let x = -4; x <= toX + 4; x += TILE) {
    const tx = Math.floor((x + WORLD / 2) / TILE);
    w.map.grid[tz * GRID + tx] = T_OPEN;
    w.map.grid[(tz - 1) * GRID + tx] = T_OPEN;
    w.map.grid[(tz + 1) * GRID + tx] = T_OPEN;
  }
}

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const armed = (w: World, wid: string) => {
  const s = w.addSoldier('S', 'infantry', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
  s.weapons[0] = wid; s.clip[0] = WEAPONS[wid].clip; s.reserve[0] = 999;
  return s;
};
const byBrand = (family: string, brand: string): WeaponDef => {
  const d = Object.values(WEAPONS).find((x) => x.family === family && x.brand === brand && x.tier === 1);
  if (!d) throw new Error(`no ${brand} ${family}`);
  return d;
};

describe('row 178 — brand signatures', () => {
  it('core class weapons carry NO brand — the arena never feels this', () => {
    expect(WEAPONS.ar606.brand).toBeUndefined();
    expect(WEAPONS.kuchler.brand).toBeUndefined();
    expect(WEAPONS.pistol.brand).toBeUndefined();
  });

  it('kuchler HOT HALF: the back half of the mag runs faster', () => {
    const d = byBrand('rifle', 'kuchler'); // brand rotation: kuchler builds rifles, not smgs
    const w = quiet(); const s = armed(w, d.id);
    s.clip[0] = d.clip; // full: cold
    w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    const coldGap = s.nextFireAt - w.time;
    s.clip[0] = Math.floor(d.clip / 2) - 1; s.nextFireAt = 0; // hot half
    w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    const hotGap = s.nextFireAt - w.time;
    expect(hotGap, 'the hot half cycles faster').toBeLessThan(coldGap * 0.95);
  });

  it('harkov MATCH-GRADE: the round carries — no falloff at max range', () => {
    // the falloff scalar itself is pinned in tests/falloff.test.ts; here the
    // brand gate: a harkov pistol at long range hits as hard as up close
    // rifles reach past the FALLOFF_MIN_FULL 42u knee — pistols never tire
    const hk = byBrand('rifle', 'harkov');
    const mk = byBrand('rifle', 'kuchler'); // rifle brands rotate: no maklov rifle
    expect(hk.brand).toBe('harkov');
    const dmgAt = (d: WeaponDef, dist: number) => {
      const w = quiet(); const s = armed(w, d.id);
      carveLane(w, dist); // the terrain must not eat the duel
      // an INERT witness: a human kind gets no bot brain, so it stands still
      const v = w.addSoldier('V', 'infantry', 1, 'human');
      v.alive = true; v.protectedUntil = 0; v.hp = 1000; v.maxHp = 1000; v.armor = 0;
      v.pos = { x: dist, y: 0, z: 0 };
      s.yaw = 0;
      const hp0 = v.hp;
      for (let i = 0; i < 240 && v.hp === hp0; i++) {
        s.trigHeld = false; s.nextFireAt = 0; s.clip[0] = d.clip;
        w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
      }
      return hp0 - v.hp;
    };
    const near = dmgAt(hk, 6);
    const far = dmgAt(hk, hk.range - 2);
    expect(near, 'the harkov hit landed').toBeGreaterThan(0);
    expect(far, 'match-grade carries the whole way').toBeGreaterThanOrEqual(near);
    const mkFar = dmgAt(mk, mk.range - 2);
    const mkNear = dmgAt(mk, 6);
    expect(mkFar, 'an unbranded-signature round tires past the knee').toBeLessThan(mkNear);
  });

  it('titan CONCUSSIVE: every round shoves — even a def with zero knockback', () => {
    const d = byBrand('pistol', 'titan');
    expect(d.knockback).toBe(0);
    const w = quiet(); const s = armed(w, d.id);
    const v = w.addSoldier('V', 'infantry', 1, 'bot');
    v.alive = true; v.protectedUntil = 0; v.hp = 1000; v.maxHp = 1000;
    v.pos = { x: 8, y: 0, z: 0 };
    s.yaw = 0;
    let pushed = false;
    for (let i = 0; i < 240 && !pushed; i++) {
      s.trigHeld = false; s.nextFireAt = 0; s.clip[0] = d.clip;
      w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
      if (Math.abs(v.pushX) > 0.5) pushed = true;
    }
    expect(pushed, 'the titan round is a small argument').toBe(true);
  });

  it('ceres DEEP POCKETS: an AP reload drains the pool 25% less', () => {
    const ce = byBrand('rifle', 'ceres');
    const w = quiet(); const s = armed(w, ce.id);
    s.ammoType = 'ap'; s.clip[0] = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ reload: true })]]));
    for (let i = 0; i < 60 * 4; i++) w.step(1 / 60, new Map([[s.id, cmd()]]));
    const poolAfter = s.ammoPools!.ap!;
    expect(s.clip[0], 'the mag filled').toBe(ce.clip);
    expect(poolAfter, 'the pool paid 75% of the rounds').toBe(60 - Math.ceil(ce.clip * 0.75));
  });

  it('kamenel HOT LOADS: the round leaves 15% faster', () => {
    const ka = byBrand('sonic', 'kamenel');
    const w = quiet(); const s = armed(w, ka.id);
    s.trigHeld = false; s.yaw = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    const p = [...w.projectiles.values()].find((x) => x.ownerId === s.id)!;
    expect(p, 'a round is in flight').toBeTruthy();
    const spd = Math.hypot(p.vel.x, p.vel.z);
    expect(spd, 'hot loads run over spec').toBeGreaterThan(ka.speed * 1.1);
  });
});
