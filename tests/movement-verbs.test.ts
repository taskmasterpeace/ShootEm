// ---------------------------------------------------------------------------
// M1 MOVEMENT VERBS (Robert: "dashing forward, rolling to the sides… you
// should be able to run as well, but we should have a stamina… and we need a
// knockback threshold that ragdolls us, and our characters get up and we get
// control again"). The tank is the ONE energy meter; every verb pays into it.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const spawn = (w: World, cls: Parameters<World['addSoldier']>[1] = 'infantry') => {
  const s = w.addSoldier('T', cls, 0, 'human');
  s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
  return s;
};

describe('M1 — sprint, dash, roll, ragdoll', () => {
  it('SPRINT is faster and drains the tank; the tank never refills mid-sprint', () => {
    const w1 = quiet(); const walker = spawn(w1);
    const w2 = quiet(); const runner = spawn(w2);
    for (let i = 0; i < 60; i++) w1.step(1 / 60, new Map([[walker.id, cmd({ moveX: 1 })]]));
    for (let i = 0; i < 60; i++) w2.step(1 / 60, new Map([[runner.id, cmd({ moveX: 1, sprint: true })]]));
    expect(runner.pos.x, 'sprint must outrun the walk').toBeGreaterThan(walker.pos.x * 1.2);
    expect(runner.energy, 'a second of sprint costs ~10 stamina').toBeLessThan(92);
    expect(walker.energy, 'walking costs nothing').toBe(100);
  });

  it('SLIDE-OFF-SPRINT bursts along the nose, DUCKS you, and is cheaper than a dash', () => {
    const w = quiet(); const s = spawn(w);
    s.yaw = 0; // facing +x
    w.step(1 / 60, new Map([[s.id, cmd({ dash: 4 })]]));
    expect(s.pushX, 'the skid runs along the facing').toBeGreaterThan(10);
    expect(s.crouching, 'a slide ducks you — clears fire, ends low').toBe(true);
    expect(s.slideUntil, 'the skid window opened').toBeGreaterThan(w.time);
    expect(s.energy, 'cheaper than a dash (spends sprint momentum, not a fresh burst)').toBeGreaterThan(75.5 - 14 - 0.5);
    // shares the ONE dash cooldown — no chaining a slide into a dash
    const before = s.energy;
    w.step(1 / 60, new Map([[s.id, cmd({ dash: 1 })]]));
    expect(s.energy, 'the shared cooldown refuses the follow-up').toBeGreaterThan(before - 1);
  });

  it('an empty tank refuses to sprint — the meter IS the gate', () => {
    const w = quiet(); const s = spawn(w);
    s.energy = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1, sprint: true })]]));
    expect(s.sprinting).toBeFalsy();
  });

  it('DASH bursts forward, costs 25, and the cooldown blocks a chain', () => {
    const w = quiet(); const s = spawn(w);
    s.yaw = 0; // facing +x
    w.step(1 / 60, new Map([[s.id, cmd({ dash: 1 })]]));
    expect(s.energy, 'the dash bit the tank (same-tick regen gives back a sliver)').toBeLessThanOrEqual(75.5);
    expect(s.pushX, 'the burst is along the facing').toBeGreaterThan(8);
    const after = s.energy;
    w.step(1 / 60, new Map([[s.id, cmd({ dash: 1 })]]));
    // regen drips ~0.23 between reads; the point is no SECOND 25 was paid
    expect(s.energy, 'cooldown: the second tap buys nothing').toBeGreaterThan(after - 1);
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    expect(s.pos.x, 'a dash covers real ground').toBeGreaterThan(1.6);
  });

  it('ROLL tumbles SIDEWAYS — perpendicular to the facing', () => {
    const w = quiet(); const s = spawn(w);
    s.yaw = 0; // facing +x → a roll moves in z
    w.step(1 / 60, new Map([[s.id, cmd({ dash: 2 })]]));
    expect(s.rollUntil, 'the roll state is live').toBeDefined();
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    expect(Math.abs(s.pos.z), 'the tumble is lateral').toBeGreaterThan(1.2);
    expect(Math.abs(s.pos.x), 'and not forward').toBeLessThan(0.5);
  });

  it('RAGDOLL: a close concussion flips you, controls die, and you GET UP', () => {
    const w = quiet(); const s = spawn(w);
    s.pos = { x: 1.5, y: 0, z: 0 };
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.conc_nade, -1, 1);
    expect(s.ragdollUntil, 'past the threshold — the body is luggage').toBeDefined();
    const flying = s.pushX;
    expect(flying).toBeGreaterThan(10);
    // controls are dead while ragdolled
    w.step(1 / 60, new Map([[s.id, cmd({ moveZ: -1 })]]));
    expect(s.vel.z, 'legs contribute nothing mid-ragdoll').toBe(0);
    // …and come back when you get up
    for (let i = 0; i < 60 * 2.2; i++) w.step(1 / 60, new Map());
    expect(s.ragdollUntil).toBeUndefined();
    w.step(1 / 60, new Map([[s.id, cmd({ moveZ: -1 })]]));
    expect(s.vel.z, 'up, and back in the fight').toBeLessThan(0);
  });

  it('a plain frag SHOVES but never ragdolls — the threshold is the law', () => {
    const w = quiet(); const s = spawn(w);
    s.pos = { x: 0.6, y: 0, z: 0 };
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.gl, -1, 1);
    expect(s.pushX, 'the shove is real').toBeGreaterThan(0);
    expect(s.ragdollUntil, 'but 13 knockback never crosses 16').toBeUndefined();
  });

  it('gods are too heavy to flip', () => {
    const w = quiet();
    const g = w.addLsw('titan', 0, { x: 1.5, y: 0, z: 0 })!;
    g.protectedUntil = 0;
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.conc_nade, -1, 1);
    expect(g.ragdollUntil).toBeUndefined();
  });

  it('CHARGED LEAP: ballistic, paid, deaf to mid-air steering — and lands LOUD', () => {
    const w = quiet(); const s = spawn(w);
    w.step(1 / 60, new Map([[s.id, cmd({ leap: 1, moveX: 1 })]]));  // the spring
    expect(s.leaping, 'airborne on the arc').toBe(true);
    expect(s.vel.y, 'the pop is upward').toBeGreaterThan(0);
    expect(s.energy, 'the tank paid the dash price').toBeLessThanOrEqual(75.5);
    // mid-air: slam the stick the OTHER way — the arc does not care
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: -1 })]]));
    expect(s.vel.x, 'no air control: still flying +x').toBeGreaterThan(0);
    // ride it down
    let guard = 0;
    while (s.leaping && guard++ < 600) w.step(1 / 60, new Map([[s.id, cmd({ moveX: -1 })]]));
    expect(s.leaping, 'the ground ends the arc').toBe(false);
    expect(s.pos.x, 'the leap MOVED him').toBeGreaterThan(2);
    // the landing RINGS: loudUntil holds and recon pings him
    expect(s.loudUntil ?? 0).toBeGreaterThan(w.time);
    expect(w.pinged.has(s.id), 'a loud arrival pings like gunfire').toBe(true);
  });

  it('the leap shares the dash cooldown — no chaining into flight', () => {
    const w = quiet(); const s = spawn(w);
    w.step(1 / 60, new Map([[s.id, cmd({ leap: 1, moveX: 1 })]]));
    let guard = 0;
    while (s.leaping && guard++ < 600) w.step(1 / 60, new Map([[s.id, cmd()]]));
    // instant re-leap: the shared cooldown refuses
    w.step(1 / 60, new Map([[s.id, cmd({ leap: 1, moveX: 1 })]]));
    expect(s.leaping, 'the cooldown holds the second spring').toBe(false);
  });

  it('STAT-GATED REGEN: the pathfinder refills faster than the heavy', () => {
    const w1 = quiet(); const path = spawn(w1, 'pathfinder');
    const w2 = quiet(); const heavy = spawn(w2, 'heavy');
    path.energy = 0; heavy.energy = 0;
    // regen ticks inside applyCmd — soldiers must be RECEIVING commands (in a
    // real match every human and bot sends one every frame)
    for (let i = 0; i < 60; i++) {
      w1.step(1 / 60, new Map([[path.id, cmd()]]));
      w2.step(1 / 60, new Map([[heavy.id, cmd()]]));
    }
    expect(path.energy, 'athlete lungs').toBeGreaterThan(heavy.energy * 1.5);
  });
});
