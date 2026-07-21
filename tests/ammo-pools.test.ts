// ---------------------------------------------------------------------------
// §11.3 SEPARATE MAGAZINES BY TYPE — special rounds reload from their OWN
// pools (AMMO_INFO pool sizes; BNR is "expensive, limited"); ball rides the
// classic reserve. An empty pool falls the selector back to ball, loudly.
// Reload initiation, the dry-click datum, and crate resupply all agree with
// the pools. Bots never cycle (ammoType undefined) → the classic path is
// untouched (the threat-measure arena never feels this).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { AMMO_INFO, WEAPONS } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const rifleman = (w: World) => {
  const s = w.addSoldier('S', 'infantry', 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
  return s;
};
const finishReload = (w: World, id: number) => {
  for (let i = 0; i < 60 * (WEAPONS.ar606.reloadTime + 0.2); i++) w.step(1 / 60, new Map([[id, cmd()]]));
};

describe('§11.3 — separate magazines by type', () => {
  it('an AP reload draws the AP POOL; the classic reserve is untouched', () => {
    const w = quiet(); const s = rifleman(w);
    s.ammoType = 'ap';
    s.clip[0] = 0;
    const reserve0 = s.reserve[0];
    w.step(1 / 60, new Map([[s.id, cmd({ reload: true })]]));
    finishReload(w, s.id);
    expect(s.clip[0]).toBe(WEAPONS.ar606.clip);
    expect(s.ammoPools?.ap).toBe(AMMO_INFO.ap.pool! - WEAPONS.ar606.clip);
    expect(s.reserve[0], 'ball reserve untouched').toBe(reserve0);
  });

  it('a DRY pool falls back to ball — loudly — and loads from reserve', () => {
    const w = quiet(); const s = rifleman(w);
    s.ammoType = 'bnr';
    s.ammoPools = { bnr: 0 }; // burned the expensive stuff already
    s.clip[0] = 0;
    const reserve0 = s.reserve[0];
    w.step(1 / 60, new Map([[s.id, cmd({ reload: true })]]));
    finishReload(w, s.id);
    let announced = false;
    for (const e of w.takeEvents()) if (e.type === 'announce' && String(e.text).includes('DRY')) announced = true;
    expect(announced, 'the selector told you').toBe(true);
    expect(s.ammoType, 'back on ball').toBeUndefined();
    expect(s.clip[0]).toBe(WEAPONS.ar606.clip);
    expect(s.reserve[0]).toBe(reserve0 - WEAPONS.ar606.clip);
  });

  it('an empty rifle with NO reserve but a full AP pool still reloads', () => {
    const w = quiet(); const s = rifleman(w);
    s.ammoType = 'ap';
    s.clip[0] = 0; s.reserve[0] = 0; // the classic well is dry
    w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]])); // auto-reload path
    expect(s.reloadUntil, 'the AP pool answers the reload').toBeGreaterThan(0);
    finishReload(w, s.id);
    expect(s.clip[0]).toBe(WEAPONS.ar606.clip);
  });

  it('a truly dry gun — no pool, no reserve — clicks instead', () => {
    const w = quiet(); const s = rifleman(w);
    s.ammoType = 'ap';
    s.ammoPools = { ap: 0 };
    s.clip[0] = 0; s.reserve[0] = 0;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    expect(s.statDry ?? 0, 'the §13 datum fires').toBeGreaterThanOrEqual(1);
    expect(s.reloadUntil).toBe(0);
  });

  it('an ammo crate refills the special pools to full', () => {
    const w = quiet(); const s = rifleman(w);
    s.ammoPools = { ap: 3, inc: 0 };
    for (const pk of w.pickups.values()) {
      if (pk.type === 'ammo') { pk.pos = { ...s.pos }; pk.respawnAt = 0; break; }
    }
    w.step(1 / 60, new Map([[s.id, cmd()]]));
    expect(s.ammoPools.ap).toBe(AMMO_INFO.ap.pool);
    expect(s.ammoPools.inc).toBe(AMMO_INFO.inc.pool);
  });
});
