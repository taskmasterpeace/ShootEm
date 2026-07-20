// ---------------------------------------------------------------------------
// V1 THE ARMOUR LADDER (Robert: "regular vehicles take a little bit too much
// damage, they're a little bit tanky. A couple grenades and you should be able
// to blow up a buggy. One grenade and you should be able to blow up a flying
// thing").
//
// Pinned as a RATIO, not as HP numbers: the ladder is "how many frags does
// this hull eat", which is the thing a player actually feels.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES, WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import type { VehicleKind } from '../src/sim/types';

/** frags to kill: drop grenades on the hull until it dies */
function fragsToKill(kind: VehicleKind): number {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  const v = [...w.vehicles.values()].find((x) => x.kind === kind)
    ?? w.spawnVehicle(kind, 0, { x: 0, y: 0, z: 0 });
  if (!v) return Infinity;
  v.hp = VEHICLES[kind].hp;
  for (let n = 1; n <= 20; n++) {
    w.explode({ x: v.pos.x, y: 0, z: v.pos.z }, WEAPONS.gl, -1, 1);
    if (!v.alive || v.hp <= 0) return n;
  }
  return Infinity;
}

describe('V1 — the armour ladder', () => {
  it('ONE frag kills the aircraft: the sky costs you your armour', () => {
    expect(fragsToKill('flyer'), 'the Kestrel is glass — that is the price of flight').toBe(1);
  });

  it('a COUPLE of frags kill a buggy', () => {
    const n = fragsToKill('buggy');
    expect(n, 'not a bunker').toBeLessThanOrEqual(2);
    expect(n, 'but not tissue paper either').toBeGreaterThan(1);
  });

  it('the light hulls all die fast; the TANK still does not', () => {
    for (const light of ['skiff', 'bike', 'hoverboard'] as const) {
      expect(fragsToKill(light), `${light} is a light hull`).toBeLessThanOrEqual(2);
    }
    expect(fragsToKill('tank'), 'a tank is still a tank — this pass never touched it')
      .toBeGreaterThanOrEqual(6);
  });

  it('nothing on wheels outruns a BULLET any more', () => {
    // projectiles run at 0.35x globally; the fast hulls were literally
    // outpacing the rounds sent at them. Compared against direct-fire bullets
    // only — lobbed ordnance is SUPPOSED to be slower than a moving car,
    // which is exactly why you lead a grenade.
    const bullets = Object.values(WEAPONS).filter((wp) => wp.tracer === 'bullet' && wp.speed > 5);
    const slowestBullet = Math.min(...bullets.map((wp) => wp.speed * 0.35));
    for (const kind of Object.keys(VEHICLES) as VehicleKind[]) {
      // AIRCRAFT ARE EXEMPT BY DESIGN. A jet that couldn't outrun ordnance
      // wouldn't be a jet — outrunning things IS the airframe's whole case,
      // and the answer to it is the SAM ratio below, not a speed cap.
      if (VEHICLES[kind].flies) continue;
      expect(VEHICLES[kind].speed, `${kind} outruns the slowest live bullet`).toBeLessThan(slowestBullet);
    }
  });

  it('THE AIR LADDER: jets outrun everything on the ground, and the sky is glass', () => {
    const air = (['strikejet', 'interceptor', 'bomber', 'flyer'] as const);
    const fastestGround = Math.max(...(Object.keys(VEHICLES) as VehicleKind[])
      .filter((k) => !VEHICLES[k].flies).map((k) => VEHICLES[k].speed));
    // the interceptor is the fastest thing in the game; the bomber is NOT
    expect(VEHICLES.interceptor.speed).toBeGreaterThan(fastestGround);
    expect(VEHICLES.strikejet.speed).toBeGreaterThan(fastestGround);
    expect(VEHICLES.interceptor.speed, 'air-to-air must catch air-to-ground')
      .toBeGreaterThan(VEHICLES.strikejet.speed);
    expect(VEHICLES.bomber.speed, 'the Anvil cannot run — that is why it needs an escort')
      .toBeLessThan(VEHICLES.strikejet.speed);
    // and every airframe is glass: the sky costs you your armour
    for (const k of air) {
      expect(VEHICLES[k].hp, `${k} is too tough for the sky`).toBeLessThan(VEHICLES.tank.hp / 2);
    }
  });

  it('FIXED WING: the jets cannot hover and the helicopters can', () => {
    expect(VEHICLES.strikejet.minAirspeed, 'the Vulture stalls').toBeGreaterThan(0);
    expect(VEHICLES.interceptor.minAirspeed, 'the Falcon stalls').toBeGreaterThan(0);
    expect(VEHICLES.bomber.minAirspeed, 'the Anvil stalls').toBeGreaterThan(0);
    expect(VEHICLES.flyer.minAirspeed, 'the Kestrel is a gunship — it hovers').toBeUndefined();
  });

  it('the SAM still loses a straight drag race to the aircraft it hunts', () => {
    // the predator/prey ratio is DERIVED, never hardcoded — if the flyer's
    // speed ever changes the missile must follow it
    expect(WEAPONS.sam_missile.speed).toBeLessThan(VEHICLES.flyer.speed);
    expect(WEAPONS.sam_missile.speed / VEHICLES.flyer.speed).toBeGreaterThan(0.85);
  });
});
