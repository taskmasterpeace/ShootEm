// ---------------------------------------------------------------------------
// SECONDARY FIRE (right mouse) — four personalities, one button:
// AR-606 under-barrel flame burp · GL-40 skitter (a charge on legs) ·
// RG-2 tag dart (pin the runner) · Kamenel plasma overcharge (6 cells, 1 orb).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_OPEN, TILE, WORLD } from '../src/sim/map';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import type { PlayerCmd, Projectile } from '../src/sim/types';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const at = (t: number) => (t + 0.5) * TILE - WORLD / 2;

/** Flat open strip so nothing ambient interferes with the shots. */
function staged(primary: string) {
  const w = new World({ seed: 21, mode: 'tdm' });
  for (let tz = 46; tz <= 54; tz++)
    for (let tx = 44; tx <= 60; tx++) w.map.grid[tz * GRID + tx] = T_OPEN;
  const s = w.addSoldier('Shooter', 'infantry', 0, 'human', { primary });
  s.pos = { x: at(48), y: 0, z: at(50) };
  s.yaw = 0; // facing +x, down the strip
  return { w, s };
}

describe('AR-606 under-barrel flame burp', () => {
  it('one press spends one canister and spews a real burst of flame', () => {
    const { w, s } = staged('ar606');
    expect(s.altAmmo).toBe(3);
    // hold right mouse for a second: the burst fires once (cooldown gates it)
    const cmds = new Map([[s.id, cmd({ altFire: true, aimYaw: 0 })]]);
    let flames = 0;
    for (let i = 0; i < 60; i++) {
      w.step(1 / 60, cmds);
      flames += [...w.projectiles.values()].filter((p) => p.weapon === 'flamer' && p.bornAt >= w.time - 1 / 60).length;
    }
    expect(s.altAmmo).toBe(2);        // one canister, not three
    expect(flames).toBeGreaterThan(8); // a burp, not a single puff
  });

  it('an empty under-barrel refuses politely', () => {
    const { w, s } = staged('ar606');
    s.altAmmo = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ altFire: true })]]));
    expect(s.altBurstUntil).toBe(0);
  });
});

describe('GL-40 skitter', () => {
  it('launches a charge on legs that runs the target down and detonates', () => {
    const { w, s } = staged('gl');
    const foe = w.addSoldier('Foe', 'infantry', 1, 'human');
    foe.pos = { x: at(53), y: 0, z: at(50) };
    const hp0 = foe.hp;
    w.step(1 / 60, new Map([[s.id, cmd({ altFire: true, aimYaw: 0 })]]));
    expect([...w.gadgets.values()].some((g) => g.type === 'skitter')).toBe(true);
    expect(s.altAmmo).toBe(1);
    for (let i = 0; i < 180; i++) w.step(1 / 60, new Map()); // 3 seconds of scurrying
    expect([...w.gadgets.values()].some((g) => g.type === 'skitter')).toBe(false); // it arrived
    expect(foe.hp).toBeLessThan(hp0); // and said hello
  });

  it('is shootable: gunfire pops it clean, no blast', () => {
    const { w, s } = staged('gl');
    w.step(1 / 60, new Map([[s.id, cmd({ altFire: true, aimYaw: 0 })]]));
    const skitter = [...w.gadgets.values()].find((g) => g.type === 'skitter')!;
    skitter.hp = 5;
    const p: Projectile = {
      id: 9999, weapon: 'ar606', ownerId: -1, team: 1,
      pos: { x: skitter.pos.x - 0.1, y: 1.4, z: skitter.pos.z },
      vel: { x: 1, y: 0, z: 0 }, bornAt: w.time, ttl: 2, arc: false,
    };
    w.projectiles.set(p.id, p);
    w.step(1 / 60, new Map());
    expect([...w.gadgets.values()].some((g) => g.type === 'skitter')).toBe(false);
  });
});

describe('RG-2 tag dart', () => {
  it('pins the victim on the enemy wire for five seconds, then burns out', () => {
    const { w, s } = staged('rg2');
    const foe = w.addSoldier('Foe', 'infantry', 1, 'human');
    foe.pos = { x: at(53), y: 0, z: at(50) };
    w.step(1 / 60, new Map([[s.id, cmd({ altFire: true, aimYaw: 0 })]]));
    expect(s.altAmmo).toBe(3);
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map()); // dart flies, pin sets
    expect(w.pinged.has(foe.id)).toBe(true);
    for (let i = 0; i < Math.ceil(5.5 * 60); i++) w.step(1 / 60, new Map());
    expect(w.pinged.has(foe.id)).toBe(false); // the dart burned out
  });
});

describe('Kamenel plasma overcharge', () => {
  it('dumps six cells into one big orb — and refuses on a thin clip', () => {
    const { w, s } = staged('plasma');
    const clip0 = s.clip[0];
    w.step(1 / 60, new Map([[s.id, cmd({ altFire: true, aimYaw: 0 })]]));
    expect(s.clip[0]).toBe(clip0 - (WEAPONS.plasma.alt!.cells ?? 6));
    expect([...w.projectiles.values()].some((p) => p.weapon === 'plasma_orb')).toBe(true);
    // thin clip: not enough cells, the orb refuses
    s.clip[0] = 3;
    s.nextAltAt = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ altFire: true, aimYaw: 0 })]]));
    expect(s.clip[0]).toBe(3);
  });
});
