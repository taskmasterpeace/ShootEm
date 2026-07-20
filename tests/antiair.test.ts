// ---------------------------------------------------------------------------
// MANPADS vs aircraft: the anti-air predator/prey loop. The heat-seeker is
// ~8% SLOWER than the Kestrel, so a pilot who holds a straight sprint escapes
// and one who panics gets caught. Flares are the other way out.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';

/** V3: strip the autonomous AA hulls. Every base now fields a Lance that
 *  fires on any aircraft within 120u — correct in a match, and pure noise in
 *  a suite about the MANPADS duel: it shot the test's own flyer down to 7hp
 *  and the failure read as "the sprint didn't work". Isolate the subject. */
function noAutoAA(w: { vehicles: Map<number, { kind: string; alive: boolean }> }) {
  for (const [id, v] of w.vehicles) if (v.kind === 'aatrack') w.vehicles.delete(id);
}
import { EQUIPMENT, SAM_SPEED_RATIO, VEHICLES, WEAPONS } from '../src/sim/data';
import type { PlayerCmd, Soldier, Team, Vehicle } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const run = (w: World, cmds: Map<number, PlayerCmd>, seconds: number) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) w.step(1 / 60, cmds);
};

/** Stage an airborne enemy gunship: a pilot in the driver seat makes it "flying". */
function airborneFlyer(w: World, pos: { x: number; z: number }, team: Team): { fly: Vehicle; pilot: Soldier } {
  const fly = w.spawnVehicle('flyer', team, { x: pos.x, y: 0, z: pos.z });
  const pilot = w.addSoldier('Pilot', 'infantry', team, 'human');
  fly.seats[0] = pilot.id;
  pilot.vehicleId = fly.id;
  pilot.seat = 0;
  fly.yaw = 0; // face +x
  return { fly, pilot };
}

const manpadsShooter = (w: World, pos: { x: number; z: number }): Soldier => {
  const s = w.addSoldier('AA', 'infantry', 0, 'human', { equipment: ['manpads'] });
  s.pos = { x: pos.x, y: 0, z: pos.z };
  return s;
};

describe('MANPADS vs aircraft', () => {
  it('fires only with an airborne enemy flyer in the cone — otherwise the frag flies', () => {
    expect(EQUIPMENT.manpads.samLauncher).toBe(true);
    const w = new World({ seed: 7, mode: 'tdm' });
    noAutoAA(w);
    const s = manpadsShooter(w, w.map.hillPos);
    expect(s.manpads).toBe(2);

    // no aircraft anywhere: the grenade key falls through to the frag
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimYaw: 0 })]]));
    expect([...w.projectiles.values()].some((p) => p.weapon === 'gl')).toBe(true);
    expect([...w.projectiles.values()].some((p) => p.weapon === 'sam_missile')).toBe(false);
    expect(s.manpads).toBe(2);

    // an EMPTY enemy flyer parked ahead is not airborne — still no lock
    const fly = w.spawnVehicle('flyer', 1, { x: s.pos.x + 30, y: 0, z: s.pos.z });
    run(w, new Map(), 1.5); // grenade cooldown passes
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimYaw: 0 })]]));
    expect([...w.projectiles.values()].some((p) => p.weapon === 'sam_missile')).toBe(false);
    expect(s.manpads).toBe(2);

    // put a pilot aboard: tone, lock, launch
    const pilot = w.addSoldier('P', 'infantry', 1, 'human');
    fly.seats[0] = pilot.id; pilot.vehicleId = fly.id; pilot.seat = 0;
    run(w, new Map(), 1.5);
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimYaw: 0 })]]));
    const sam = [...w.projectiles.values()].find((p) => p.weapon === 'sam_missile');
    expect(sam).toBeDefined();
    expect(sam!.homingVehicleId).toBe(fly.id);
    expect(s.manpads).toBe(1);
  });

  it('the -8% rule: missile speed derives from the Kestrel top speed and always loses a drag race', () => {
    expect(SAM_SPEED_RATIO).toBe(0.92);
    expect(WEAPONS.sam_missile.speed).toBeCloseTo(VEHICLES.flyer.speed * SAM_SPEED_RATIO, 10);
    expect(WEAPONS.sam_missile.speed).toBeLessThan(VEHICLES.flyer.speed);
    // a live launch flies at exactly that speed
    const w = new World({ seed: 7, mode: 'tdm' });
    noAutoAA(w);
    airborneFlyer(w, { x: w.map.hillPos.x + 20, z: w.map.hillPos.z }, 1);
    const s = manpadsShooter(w, w.map.hillPos);
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimYaw: 0 })]]));
    const sam = [...w.projectiles.values()].find((p) => p.weapon === 'sam_missile')!;
    expect(Math.hypot(sam.vel.x, sam.vel.z)).toBeCloseTo(VEHICLES.flyer.speed * SAM_SPEED_RATIO, 6);
  });

  it('a straight sprint outruns the bird: launched dead astern, it never connects', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    noAutoAA(w);
    const z = w.map.hillPos.z;
    const { fly, pilot } = airborneFlyer(w, { x: -80, z }, 1);
    fly.vel = { x: VEHICLES.flyer.speed, y: 0, z: 0 }; // already at full tilt when the tone sounds
    const s = manpadsShooter(w, { x: -90, z });
    const hp = fly.hp;
    const cmds = new Map([
      [s.id, cmd({ grenade: true, aimYaw: 0 })],
      [pilot.id, cmd({ moveZ: -1 })], // firewall the throttle, zero turn
    ]);
    let sawSam = false;
    let minD = Infinity;
    for (let i = 0; i < 60 * 8; i++) {
      w.step(1 / 60, cmds);
      if (i === 0) cmds.set(s.id, cmd({ aimYaw: 0 })); // single press
      const sam = [...w.projectiles.values()].find((p) => p.weapon === 'sam_missile');
      if (sam) {
        sawSam = true;
        minD = Math.min(minD, Math.hypot(fly.pos.x - sam.pos.x, fly.pos.z - sam.pos.z));
      }
    }
    expect(sawSam).toBe(true);
    expect(minD).toBeGreaterThan(4);  // the gap only ever opened
    expect(fly.hp).toBe(hp);          // escape works
    expect([...w.projectiles.values()].some((p) => p.weapon === 'sam_missile')).toBe(false); // ttl expired
  });

  it('a gunship that hovers in place gets caught and hurt', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    noAutoAA(w);
    const { fly } = airborneFlyer(w, { x: w.map.hillPos.x + 40, z: w.map.hillPos.z }, 1);
    const s = manpadsShooter(w, w.map.hillPos);
    const hp = fly.hp;
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimYaw: 0 })]]));
    expect([...w.projectiles.values()].some((p) => p.weapon === 'sam_missile')).toBe(true);
    run(w, new Map(), 4);
    expect(fly.hp).toBeLessThan(hp);
    expect([...w.projectiles.values()].some((p) => p.weapon === 'sam_missile')).toBe(false);
  });

  it('flares seduce the seeker: it detonates on the decoy while the gunship runs', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    noAutoAA(w);
    const { fly, pilot } = airborneFlyer(w, { x: w.map.hillPos.x, z: w.map.hillPos.z }, 1);
    const s = manpadsShooter(w, { x: fly.pos.x - 30, z: fly.pos.z });
    expect(fly.flares).toBe(3);

    // shooter fires; the pilot pops a flare the same instant and runs east
    w.step(1 / 60, new Map([
      [s.id, cmd({ grenade: true, aimYaw: 0 })],
      [pilot.id, cmd({ grenade: true })],
    ]));
    expect(fly.flares).toBe(2);
    const flare = [...w.gadgets.values()].find((g) => g.type === 'flare')!;
    expect(flare).toBeDefined();
    const sam = [...w.projectiles.values()].find((p) => p.weapon === 'sam_missile')!;
    expect(sam.homingVehicleId).toBe(fly.id);

    const cmds = new Map([[pilot.id, cmd({ moveZ: -1 })]]);
    let lastPos = { ...sam.pos };
    for (let i = 0; i < 60 * 4 && w.projectiles.has(sam.id); i++) {
      w.step(1 / 60, cmds);
      const live = w.projectiles.get(sam.id);
      if (live) lastPos = { x: live.pos.x, y: live.pos.y, z: live.pos.z };
    }
    expect(w.projectiles.has(sam.id)).toBe(false);
    // it died on the decoy, not the aircraft
    expect(Math.hypot(lastPos.x - flare.pos.x, lastPos.z - flare.pos.z)).toBeLessThan(4);
    expect(fly.hp).toBe(fly.maxHp);
    expect(fly.alive).toBe(true);
  });
});
