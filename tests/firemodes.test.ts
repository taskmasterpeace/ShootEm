// ---------------------------------------------------------------------------
// 10.1 FIRE MODES — the missing axis. One property, five trigger disciplines,
// all DPS-NEUTRAL by construction: single/pump fire per PRESS (cadence still
// rof), burst-n spends its whole n/rof cycle up front, double fires both
// barrels and pays 2/rof for the pair. Bots bypass trigger discipline — a
// machine's finger taps perfectly. "Guns that shoot two rounds at a time
// give us a heck of an edge." — Robert
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { FAMILIES } from '../src/sim/arsenal';
import { WEAPONS } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const shooter = (w: World, kind: 'human' | 'bot' = 'human') => {
  const s = w.addSoldier('S', 'infantry', 0, kind);
  s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
  return s;
};

describe('10.1 — fire modes', () => {
  it('the armory carries the axis: single pistols, burst carbines, pump shotguns, THE DOUBLE-BARREL', () => {
    expect(WEAPONS.pistol.fireMode).toBe('single');
    const fam = (k: string) => FAMILIES.find((f) => f.family === k)!.base.fireMode;
    expect(fam('carbine')).toBe('burst2');
    expect(fam('shotgun')).toBe('pump');
    expect(fam('scatter')).toBe('double');
    expect(WEAPONS.ar606.fireMode, 'the issue rifle stays full-auto').toBeUndefined();
  });

  it('SINGLE: a held trigger fires ONCE — each press buys one round', () => {
    const w = quiet(); const s = shooter(w);
    s.weaponIdx = 1; // the P9 sidearm
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    expect(s.clip[1], 'one press, one round').toBe(WEAPONS.pistol.clip - 1);
    // release and press again — the second round
    w.step(1 / 60, new Map([[s.id, cmd()]]));
    for (let i = 0; i < 10; i++) w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    expect(s.clip[1]).toBe(WEAPONS.pistol.clip - 2);
  });

  it('BURST2: one press delivers exactly two rounds, then the cycle gate holds', () => {
    const w = quiet(); const s = shooter(w);
    const carbine = Object.values(WEAPONS).find((d) => d.family === 'carbine')!;
    s.weapons[0] = carbine.id;
    const def = carbine;
    expect(def?.fireMode).toBe('burst2');
    s.clip[0] = def.clip; s.reserve[0] = def.reserve;
    // press once, then HOLD — the runner must deliver round 2 on its own
    w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    expect(s.clip[0], 'two rounds, no more — the edge is spent').toBe(def.clip - 2);
    // DPS-neutral: the pair bought the full 2/rof cycle
    expect(s.nextFireAt).toBeGreaterThanOrEqual((s.burstStartAt ?? 0) + 2 / def.rof - 0.001);
  });

  it('DOUBLE: both barrels on one press, and the pair pays 2/rof', () => {
    const w = quiet(); const s = shooter(w);
    const scatter = Object.values(WEAPONS).find((d) => d.family === 'scatter')!;
    s.weapons[0] = scatter.id;
    const def = scatter;
    expect(def?.fireMode).toBe('double');
    s.clip[0] = def.clip; s.reserve[0] = def.reserve;
    const t0 = w.time;
    w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    expect(s.clip[0], 'both barrels').toBe(def.clip - 2);
    expect(s.nextFireAt, 'the pair pays the pair price').toBeGreaterThanOrEqual(t0 + 2 / def.rof - 0.001);
  });

  it('BOTS bypass trigger discipline — a held single-fire pistol runs at rof', () => {
    const w = quiet(); const b = shooter(w, 'bot');
    b.weaponIdx = 1;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[b.id, cmd({ fire: true })]]));
    expect(WEAPONS.pistol.clip - b.clip[1], 'the machine finger taps at rof').toBeGreaterThanOrEqual(4);
  });
});
