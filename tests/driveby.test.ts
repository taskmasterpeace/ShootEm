// ---------------------------------------------------------------------------
// W5.4 DRIVE-BY — a PASSENGER fires his personal weapon from a seat: the real
// gun (clip, rof, reload, ammo riders), his own aim. The driver's hands stay
// on the wheel, and a band-2+ airframe is too high to lean out of.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

/** a two-seat hull with a PASSENGER aboard (seat 1) */
function ride(kind = 'buggy') {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  const driver = w.addSoldier('D', 'infantry', 0, 'human');
  driver.alive = true;
  const p = w.addSoldier('P', 'infantry', 0, 'human');
  p.alive = true; p.protectedUntil = 0;
  const v = w.spawnVehicle(kind as never, 0, { x: 0, y: 0, z: 0 });
  v.alive = true;
  v.seats[0] = driver.id; driver.vehicleId = v.id; driver.seat = 0; driver.enteredVehicleAt = w.time - 10;
  if (v.seats.length < 2) v.seats.push(-1);
  v.seats[1] = p.id; p.vehicleId = v.id; p.seat = 1; p.enteredVehicleAt = w.time - 10;
  return { w, driver, p, v };
}

describe('W5.4 — drive-by shooting', () => {
  it('a passenger fires HIS OWN rifle from the seat', () => {
    const { w, p } = ride();
    const clip0 = p.clip[0];
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[p.id, cmd({ fire: true })]]));
    expect(p.clip[0], 'rounds left his own mag').toBeLessThan(clip0);
    expect(p.statShots ?? 0, 'the §13 counters see it').toBeGreaterThan(0);
  });

  it('the mag runs the full loop in the seat: empty → auto-reload → refilled', () => {
    const { w, p } = ride();
    p.clip[0] = 1;
    let reloadStarted = false;
    for (let i = 0; i < 60 * 3; i++) {
      w.step(1 / 60, new Map([[p.id, cmd({ fire: true })]]));
      if (p.reloadUntil > 0) reloadStarted = true;
    }
    expect(reloadStarted, 'the empty mag booked a reload').toBe(true);
    expect(p.clip[0], 'and it came back full-ish').toBeGreaterThan(1);
  });

  it('the DRIVER keeps his hands on the wheel — no drive-by from seat 0', () => {
    const { w, driver } = ride();
    const clip0 = driver.clip[0];
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[driver.id, cmd({ fire: true })]]));
    expect(driver.clip[0], 'his personal mag never moved').toBe(clip0);
  });
});
