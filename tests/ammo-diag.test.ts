// ---------------------------------------------------------------------------
// §13 AMMO DIAGNOSTICS (STATUS: "teach the blackbox to log it; run BEFORE the
// cut"). The 25% reserve cut is locked but unmeasured — these counters are the
// measure: rounds fired, reloads (manual + auto), truly-dry clicks, and time
// spent on the sidearm. Deterministic, per-match, mortals only.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { ammoReport } from '../src/sim/blackbox';
import { WEAPONS } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const shooter = (w: World) => {
  const s = w.addSoldier('S', 'infantry', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
  return s;
};
const hold = (w: World, id: number, c: PlayerCmd, secs: number) => {
  for (let i = 0; i < secs * 60; i++) w.step(1 / 60, new Map([[id, c]]));
};

describe('§13 — the ammo economy, measured', () => {
  it('every round that leaves the mag is counted, per soldier and per weapon', () => {
    const w = quiet(); const s = shooter(w);
    hold(w, s.id, cmd({ fire: true }), 1); // AR-606 at rof 7.5 → ~7 rounds
    expect(s.statShots ?? 0).toBeGreaterThanOrEqual(5);
    expect(s.statShots).toBe(30 - s.clip[0]); // counter == rounds gone from the mag
    expect(w.ammoShotsByWeapon.get('ar606')).toBe(s.statShots);
  });

  it('reloads count — manual and the auto-reload on an empty mag', () => {
    const w = quiet(); const s = shooter(w);
    s.clip[0] = 5;
    w.step(1 / 60, new Map([[s.id, cmd({ reload: true })]])); // manual
    expect(s.statReloads).toBe(1);
    // finish it, then burn the mag dry with the trigger held → auto-reload
    hold(w, s.id, cmd(), WEAPONS.ar606.reloadTime + 0.1);
    s.clip[0] = 1;
    hold(w, s.id, cmd({ fire: true }), 0.5);
    expect(s.statReloads, 'the empty mag booked the second reload').toBe(2);
  });

  it('a TRULY dry gun clicks — rate-limited, not per-tick', () => {
    const w = quiet(); const s = shooter(w);
    s.clip[0] = 0; s.reserve[0] = 0;
    hold(w, s.id, cmd({ fire: true }), 1.05);
    expect(s.statDry).toBeGreaterThanOrEqual(2); // one per 0.5s, not 60/s
    expect(s.statDry).toBeLessThanOrEqual(3);
  });

  it('sidearm time accumulates only while the sidearm is in hand', () => {
    const w = quiet(); const s = shooter(w);
    hold(w, s.id, cmd(), 0.5);                       // primary: no sidearm time
    expect(s.statSecondaryT ?? 0).toBe(0);
    w.step(1 / 60, new Map([[s.id, cmd({ weaponSlot: 1 })]]));
    hold(w, s.id, cmd(), 1);
    expect(s.statSecondaryT ?? 0).toBeGreaterThan(0.9);
    expect(s.statSecondaryT ?? 0).toBeLessThan(1.2);
  });

  it('ammoReport reads it all back, humans split out', () => {
    const w = quiet(); const s = shooter(w);
    hold(w, s.id, cmd({ fire: true }), 0.5);
    const r = ammoReport(w);
    expect(r).toContain('AMMO');
    expect(r).toContain(`shots ${s.statShots} (humans ${s.statShots})`);
    expect(r).toContain('by weapon: ar606');
  });
});
