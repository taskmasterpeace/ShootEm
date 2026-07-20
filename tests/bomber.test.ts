// ---------------------------------------------------------------------------
// V4 THE ANVIL (Robert: "a bomber, one that a team could have and actually
// drop bombs… and I almost think we need a baby nuke — that would be kinda
// dope"). Two rules make a bomber feel like a bomber:
//   1. you aim by FLYING — bombs inherit the aircraft's momentum, so a run is
//      a LINE you walk across the target, not a click.
//   2. the warhead is never a surprise — a weapon that reshapes a map must be
//      announced to everyone, because the warning IS the counterplay.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES, WEAPONS } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

function anvil() {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  const p = w.addSoldier('P', 'infantry', 0, 'human');
  const v = w.spawnVehicle('bomber', 0, { x: 0, y: 0, z: 0 });
  v.alive = true; v.seats[0] = p.id;
  p.vehicleId = v.id; p.seat = 0; p.alive = true;
  p.enteredVehicleAt = w.time - 10;
  return { w, p, v };
}

describe('V4 — the Anvil and the Cradle', () => {
  it('FIRE opens the bay: a bomb falls, and the load goes down', () => {
    const { w, p, v } = anvil();
    v.bombLoad = VEHICLES.bomber.bombs;
    w.step(1 / 60, new Map([[p.id, cmd({ fire: true })]]));
    expect(v.bombLoad, 'a bomb left the rack').toBe(VEHICLES.bomber.bombs! - 1);
    expect([...w.projectiles.values()].some((x) => x.weapon === 'bomb'), 'iron in the air').toBe(true);
  });

  it('YOU AIM BY FLYING: the bomb inherits the aircraft\'s momentum', () => {
    const { w, p, v } = anvil();
    v.vel = { x: 15, y: 0, z: 0 };
    w.step(1 / 60, new Map([[p.id, cmd({ fire: true })]]));
    const bomb = [...w.projectiles.values()].find((x) => x.weapon === 'bomb')!;
    expect(bomb.vel.x, 'it carries the run forward, it does not drop straight down')
      .toBeGreaterThan(8);
  });

  it('the rack RUNS OUT — twelve, then you fly home', () => {
    const { w, p, v } = anvil();
    v.bombLoad = 2;
    for (let i = 0; i < 60 * 4; i++) w.step(1 / 60, new Map([[p.id, cmd({ fire: true })]]));
    expect(v.bombLoad).toBe(0);
  });

  it('THE CRADLE IS PRICED and ANNOUNCED — never a surprise', () => {
    const { w, p, v } = anvil();
    w.materiel[0] = 10;
    const before = w.materiel[0];
    w.step(1 / 60, new Map([[p.id, cmd({ altFire: true })]]));
    expect(v.nukeAboard, 'armed').toBe(true);
    expect(w.materiel[0], 'and it cost the team real materiel').toBeLessThan(before);
    const armed = w.events.find((e) => e.type === 'nuke_armed');
    expect(armed, 'the whole field is told').toBeTruthy();
    expect(armed!.big, 'loudly').toBe(true);
  });

  it('a POOR team cannot arm it', () => {
    const { w, p, v } = anvil();
    w.materiel[0] = 0;
    w.step(1 / 60, new Map([[p.id, cmd({ altFire: true })]]));
    expect(v.nukeAboard).toBeFalsy();
  });

  it('the warhead RESHAPES the field: it out-reaches every other weapon and ragdolls survivors', () => {
    const nuke = WEAPONS.baby_nuke;
    const others = Object.values(WEAPONS).filter((x) => x.id !== 'baby_nuke');
    expect(nuke.splash, 'nothing else reaches this far').toBeGreaterThan(Math.max(...others.map((x) => x.splash)));
    expect(nuke.knockback, 'and everyone it fails to kill goes down').toBeGreaterThan(16);
  });

  it('the Anvil cannot defend itself — it needs the Falcon', () => {
    expect(VEHICLES.bomber.weapon, 'no forward gun').toBe('');
    expect(VEHICLES.bomber.turnRate).toBeLessThan(VEHICLES.interceptor.turnRate / 2);
  });
});
