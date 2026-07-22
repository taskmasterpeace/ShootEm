import { describe, expect, it } from 'vitest';
import { VEHICLES, WEAPONS } from '../src/sim/data';
import { T_DEEP, T_WATER, tileAt } from '../src/sim/map';
import { SEA_KINDS } from '../src/sim/operations';
import { generateTheater } from '../src/sim/theaters';
import type { PlayerCmd, Projectile, VehicleKind, WeaponId } from '../src/sim/types';
import { World } from '../src/sim/world';

const command = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

function submarineRig() {
  const world = new World({ seed: 42, mode: 'ctf', botsPerTeam: 0, map: generateTheater('ocean', 42) });
  world.vehicles.clear();
  const route = world.map.theater!.routes.find((candidate) => candidate.domain === 'deep')!;
  const pilot = world.addSoldier('SUB HELM', 'infantry', 0, 'human');
  const vehicle = world.spawnVehicle('submarine' as VehicleKind, 0, route.points[0]);
  vehicle.seats[0] = pilot.id;
  pilot.vehicleId = vehicle.id;
  pilot.seat = 0;
  pilot.enteredVehicleAt = -10;
  return { world, route, pilot, vehicle };
}

function run(world: World, pilotId: number, cmd: PlayerCmd, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) world.step(1 / 60, new Map([[pilotId, cmd]]));
}

function fireAtSubmarine(weapon: WeaponId): number {
  const { world, route, vehicle: target } = submarineRig();
  target.team = 1;
  target.submerged = true;
  const a = route.points[0], b = route.points[1];
  const yaw = Math.atan2(b.z - a.z, b.x - a.x);
  target.pos = { x: a.x + Math.cos(yaw) * 18, y: 0, z: a.z + Math.sin(yaw) * 18 };
  const def = WEAPONS[weapon];
  const projectile: Projectile = {
    id: 999_999, weapon, ownerId: -1, team: 0,
    pos: { ...a, y: 1.8 }, vel: { x: Math.cos(yaw) * def.speed, y: 0, z: Math.sin(yaw) * def.speed },
    bornAt: world.time, ttl: def.range / def.speed, arc: false,
  };
  world.launch(projectile);
  const before = target.hp;
  for (let i = 0; i < 180; i++) world.step(1 / 60, new Map());
  return before - target.hp;
}

describe('Barracuda submarine', () => {
  it('publishes a deep-water naval hull and torpedo', () => {
    const def = VEHICLES['submarine' as VehicleKind];
    expect(def).toBeDefined();
    expect(def.boat).toBe(true);
    expect(def.submersible).toBe(true);
    expect(def.weapon).toBe('torpedo');
    expect(WEAPONS.torpedo.torpedo).toBe(true);
    expect(SEA_KINDS.has('submarine' as VehicleKind)).toBe(true);
  });

  it('dives in deep water, moves slower underwater, and surfaces on command', () => {
    const { world, pilot, vehicle } = submarineRig();
    expect(tileAt(world.map.grid, vehicle.pos.x, vehicle.pos.z, world.map.geometry)).toBe(T_DEEP);
    run(world, pilot.id, command({ ability: true }), 0.05);
    expect(vehicle.submerged).toBe(true);
    run(world, pilot.id, command({ moveZ: -1 }), 3);
    expect(Math.hypot(vehicle.vel.x, vehicle.vel.z)).toBeLessThanOrEqual(VEHICLES.submarine.speed * 0.75);
    pilot.nextAbilityAt = 0;
    run(world, pilot.id, command({ ability: true }), 0.05);
    expect(vehicle.submerged).toBe(false);
  });

  it('rejects a dive from shallow water', () => {
    const { world, pilot, vehicle } = submarineRig();
    const shallow = world.map.grid.findIndex((tile) => tile === T_WATER);
    expect(shallow).toBeGreaterThanOrEqual(0);
    const x = shallow % world.map.geometry.cols;
    const z = Math.floor(shallow / world.map.geometry.cols);
    vehicle.pos = {
      x: (x + 0.5) * world.map.geometry.tile - world.map.geometry.cols * world.map.geometry.tile / 2,
      y: 0,
      z: (z + 0.5) * world.map.geometry.tile - world.map.geometry.rows * world.map.geometry.tile / 2,
    };
    run(world, pilot.id, command({ ability: true }), 0.05);
    expect(vehicle.submerged).not.toBe(true);
  });

  it('ignores surface gunfire underwater but takes torpedo damage', () => {
    expect(fireAtSubmarine('boat_mg')).toBe(0);
    expect(fireAtSubmarine('torpedo')).toBeGreaterThan(0);
  });
});
