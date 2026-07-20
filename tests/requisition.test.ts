// §8.1a Requisition — what happens to the truck when YOU die.
// You signed the hull out of the motor pool; the manifest doesn't care that
// you got shot. These tests are the law: pads don't reprint checked-out hulls,
// teammates recover them, enemies hotwire them, and command writes off the
// ones somebody drowned in the moat.
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import type { PlayerCmd, Vehicle } from '../src/sim/types';
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

const homeDist = (v: Vehicle) => Math.hypot(v.pos.x - v.padPos.x, v.pos.z - v.padPos.z);

/** Sign a buggy out of the motor pool and leave it stranded `away` units from home. */
function abandonBuggy(w: World, away = 15) {
  // A WITNESS ON THE OTHER SIDE, and the officer channel goes quiet. §7: "a
  // faction WITH a human never auto-calls." Without one, team 1's bot officer
  // makes its radio check at 110s and drops a god — which is how a chunk change
  // that only nudged the RNG once had Overload land beside the abandoned hull
  // and melt it at t=146, thirty-four seconds shy of the write-off. He gives no
  // orders and never fires; he just keeps the sky shut.
  w.addSoldier('OBS', 'infantry', 1, 'human');
  const s = w.addSoldier('D', 'infantry', 0, 'human');
  const v = [...w.vehicles.values()].find((x) => x.team === 0 && x.kind === 'buggy')!;
  s.pos = { ...v.pos };
  w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
  expect(s.vehicleId).toBe(v.id);
  run(w, new Map(), 0.5); // clear the same-keypress enter→exit guard
  v.pos = { x: v.padPos.x + away, y: 0, z: v.padPos.z }; // marched off its pad
  w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
  expect(s.vehicleId).toBe(-1);
  return { s, v };
}

// EMPTY FIELD ON PURPOSE (botsPerTeam: 0). Every test here brings its own
// driver and thief; the ambient bots are noise, and one of these runs the clock
// for three straight minutes. It caught fire the day a chunk change nudged the
// RNG: Overload ascended mid-test, walked over, and melted the abandoned hull
// in 1.3 seconds — a perfectly good god ruining a bookkeeping test. The
// manifest doesn't care who is on the field, so nobody is.
describe('requisition (§8.1a)', () => {
  it('keeps your name on the manifest: an abandoned hull blocks its pad indefinitely', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const total = w.vehicles.size;
    const { s, v } = abandonBuggy(w);
    expect(v.requisitionedBy).toBe(s.id); // signed out — dying doesn't refill the pool
    expect(v.padId).toBeGreaterThanOrEqual(0);
    expect(v.abandonedAt).toBeGreaterThan(0);
    run(w, new Map(), 60); // nearly 3× the destroyed-hull respawn delay
    expect(v.alive).toBe(true);
    expect(homeDist(v)).toBeGreaterThan(6);   // still exactly where it was left
    expect(w.vehicles.size).toBe(total);      // no replacement printed on the pad
    expect(v.requisitionedBy).toBe(s.id);
  });

  it('destroyed hull → the pad respawns a fresh one with a clean manifest', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const { s, v } = abandonBuggy(w);
    w.damageVehicle(v, 9999, s.id, 'tank_cannon');
    expect(v.alive).toBe(false);
    run(w, new Map(), 25); // VEHICLE_RESPAWN is 22
    expect(v.alive).toBe(true);
    expect(homeDist(v)).toBeLessThan(1);
    expect(v.requisitionedBy).toBe(-1);
    expect(v.team).toBe(v.padTeam);
    expect(v.hp).toBe(VEHICLES.buggy.hp);
  });

  it('any teammate can crew it, and parking it home with no crew re-registers it', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const { s, v } = abandonBuggy(w);
    // a different teammate recovers the stranded hull — not the original signer
    const mate = w.addSoldier('M', 'infantry', 0, 'human');
    mate.pos = { ...v.pos };
    w.step(1 / 60, new Map([[mate.id, cmd({ use: true })]]));
    expect(mate.vehicleId).toBe(v.id);
    expect(v.requisitionedBy).toBe(s.id); // the manifest still reads the signer's name
    expect(v.abandonedAt).toBe(0);        // crewed — the abandonment clock resets
    run(w, new Map(), 0.5);
    v.pos = { x: v.padPos.x + 1, y: 0, z: v.padPos.z }; // parked back on its pad
    w.step(1 / 60, new Map([[mate.id, cmd({ use: true })]])); // step out
    expect(mate.vehicleId).toBe(-1);
    w.step(1 / 60, new Map());
    expect(v.requisitionedBy).toBe(-1); // RECOVERED — back on the books
    expect(v.abandonedAt).toBe(0);
    expect(v.alive).toBe(true);
  });

  it('enemy hotwire flips the team after the E-hold, but only after 90s abandonment', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const { v } = abandonBuggy(w);
    const thief = w.addSoldier('T', 'infantry', 1, 'human');
    thief.pos = { x: v.pos.x + 2, y: 0, z: v.pos.z };
    const hold = new Map([[thief.id, cmd({ use: true })]]);
    // too soon — the hull is abandoned but the 90-second clock hasn't run
    run(w, hold, 5);
    expect(v.team).toBe(0);
    expect(v.hotwireProgress).toBe(0);
    run(w, new Map(), 90); // let it sit
    // a loud six-second job: five seconds in, the wiring still holds
    run(w, hold, 5);
    expect(v.team).toBe(0);
    expect(v.hotwireProgress).toBeGreaterThan(0);
    run(w, hold, 1.5);
    expect(v.team).toBe(1); // stolen — hull damage and all
    expect(v.requisitionedBy).toBe(thief.id);
    expect(v.padTeam).toBe(0); // the pad still belongs to the victims
    expect(w.events.some((e) => e.type === 'announce' && e.text?.includes('hotwired'))).toBe(true);
  });

  it('engineers hotwire twice as fast — they know the wiring', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const { v } = abandonBuggy(w);
    const thief = w.addSoldier('T', 'engineer', 1, 'human');
    thief.pos = { x: v.pos.x + 2, y: 0, z: v.pos.z };
    const hold = new Map([[thief.id, cmd({ use: true })]]);
    run(w, new Map(), 91);
    run(w, hold, 2);
    expect(v.team).toBe(0); // three-second job — not done at two
    run(w, hold, 1.5);
    expect(v.team).toBe(1);
  });

  it('walking away mid-hotwire snaps the wiring back to zero', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const { v } = abandonBuggy(w);
    const thief = w.addSoldier('T', 'infantry', 1, 'human');
    thief.pos = { x: v.pos.x + 2, y: 0, z: v.pos.z };
    run(w, new Map(), 91);
    run(w, new Map([[thief.id, cmd({ use: true })]]), 3);
    expect(v.hotwireProgress).toBeGreaterThan(0);
    w.step(1 / 60, new Map()); // released E for one tick
    expect(v.hotwireProgress).toBe(0);
  });

  it('command writes off a far-away hull after 3 minutes and frees the pad', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const { v } = abandonBuggy(w, 30); // > 25u from home — write-off territory
    run(w, new Map(), 170);
    expect(v.alive).toBe(true); // not yet — three FULL minutes
    run(w, new Map(), 15);
    expect(v.alive).toBe(false); // struck from the books
    expect(w.events.some((e) => e.type === 'announce' && e.text?.includes('wrote off'))).toBe(true);
    run(w, new Map(), 25); // ...and the pad issues a fresh hull after the normal delay
    expect(v.alive).toBe(true);
    expect(homeDist(v)).toBeLessThan(1);
    expect(v.requisitionedBy).toBe(-1);
  });

  it('a hull abandoned close to home is never written off — recovery handles it', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const { v } = abandonBuggy(w, 15); // far enough to stay requisitioned, too close to write off
    run(w, new Map(), 200);
    expect(v.alive).toBe(true); // the write-off needs BOTH clocks: time AND distance
  });

  it('crewing resets the clocks — hotwire and write-off start over', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const { s, v } = abandonBuggy(w);
    const thief = w.addSoldier('T', 'infantry', 1, 'human');
    thief.pos = { x: v.pos.x + 2, y: 0, z: v.pos.z };
    run(w, new Map(), 100);
    run(w, new Map([[thief.id, cmd({ use: true })]]), 2);
    expect(v.hotwireProgress).toBeGreaterThan(0); // the theft is underway
    // the owner climbs back in — clocks and wiring reset
    s.pos = { ...v.pos };
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.vehicleId).toBe(v.id);
    expect(v.abandonedAt).toBe(0);
    expect(v.hotwireProgress).toBe(0);
    run(w, new Map(), 0.5);
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]])); // step out again
    expect(s.vehicleId).toBe(-1);
    expect(v.abandonedAt).toBeGreaterThan(0);
    // the thief tries again immediately — the 90-second gate has re-armed
    run(w, new Map([[thief.id, cmd({ use: true })]]), 3);
    expect(v.hotwireProgress).toBe(0);
    expect(v.team).toBe(0);
  });
});
