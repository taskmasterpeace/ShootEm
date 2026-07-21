import { vehicleRouteFor } from './bots';
import { asElevationLevel } from './elevation';
import { generateTheater, THEATER_DEFS } from './theaters';
import type { TheaterId } from './theater-types';
import type { PlayerCmd, Soldier, Vehicle, VehicleKind } from './types';
import { World } from './world';
import { T_WALL } from './map';
import { tileIndex, worldToTile } from './map-geometry';
import { vehicleTelemetrySnapshot, type VehicleTelemetrySnapshot } from './vehicle-telemetry';
import { createTheaterBase } from './theater-builder';

type Observer = () => void;
const observers = new WeakMap<World, Observer[]>();

function observe(world: World, observer: Observer): void {
  const list = observers.get(world) ?? [];
  list.push(observer);
  observers.set(world, list);
}

export function runScenario(world: World, seconds: number, hz = 20): World {
  const dt = 1 / hz;
  const steps = Math.ceil(seconds * hz);
  for (let step = 0; step < steps; step++) {
    world.step(dt, new Map());
    for (const observer of observers.get(world) ?? []) observer();
  }
  return world;
}

export interface RouteProbeResult {
  nonFinite: number;
  persistentStalls: number;
  routeCompleted: boolean;
}

export interface RouteProbe {
  world: World;
  soldier: Soldier;
  vehicle: Vehicle;
  result(): RouteProbeResult;
}

function routeVehicleKind(theaterId: TheaterId): VehicleKind {
  return theaterId === 'ocean' ? 'boat' : 'tank';
}

export function makeRouteProbe(theaterId: TheaterId, seed: number): RouteProbe {
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map: generateTheater(theaterId, seed) });
  const soldier = world.addSoldier('ROUTE-PROBE', 'infantry', 0, 'bot');
  const kind = routeVehicleKind(theaterId);
  const domain = kind === 'boat' ? 'surface' : 'ground';
  const route = world.map.theater!.routes.filter((candidate) => candidate.domain === domain).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!route) throw new Error(`${theaterId} has no ${domain} route for probe`);
  const vehicle = world.spawnVehicle(kind, 0, route.points[0]);
  vehicle.seats[0] = soldier.id;
  vehicle.spoolUntil = 0;
  soldier.vehicleId = vehicle.id;
  soldier.seat = 0;
  soldier.enteredVehicleAt = -10;
  soldier.botVehicleRouteId = route.id;
  let nonFinite = 0;
  observe(world, () => {
    if (![vehicle.pos.x, vehicle.pos.y, vehicle.pos.z, vehicle.vel.x, vehicle.vel.z].every(Number.isFinite)) nonFinite++;
  });
  return {
    world, soldier, vehicle,
    result: () => ({
      nonFinite,
      persistentStalls: soldier.botVehiclePersistentStalls ?? 0,
      routeCompleted: soldier.botVehicleRouteCompleted === true,
    }),
  };
}

export interface AirProbeResult extends RouteProbeResult { elevationUsed: number[] }
export interface AirProbe {
  world: World;
  soldier: Soldier;
  vehicle: Vehicle;
  result(): AirProbeResult;
}

export function makeAirProbe(theaterId: TheaterId, seed: number, profile: 'patrol' | 'strike'): AirProbe {
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map: generateTheater(theaterId, seed) });
  const soldier = world.addSoldier('AIR-PROBE', 'infantry', 0, 'bot');
  const route = world.map.theater!.routes.filter((candidate) => candidate.domain === 'air').sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!route) throw new Error(`${theaterId} has no air route for probe`);
  const vehicle = world.spawnVehicle('interceptor', 0, route.points[0]);
  vehicle.seats[0] = soldier.id;
  vehicle.spoolUntil = 0;
  vehicle.band = 3;
  soldier.vehicleId = vehicle.id;
  soldier.seat = 0;
  soldier.enteredVehicleAt = -10;
  soldier.botVehicleRouteId = route.id;
  soldier.botAirProfile = profile;
  const elevationUsed = new Set<number>([3]);
  let nonFinite = 0;
  observe(world, () => {
    elevationUsed.add(asElevationLevel(vehicle.band));
    if (![vehicle.pos.x, vehicle.pos.y, vehicle.pos.z, vehicle.vel.x, vehicle.vel.z].every(Number.isFinite)) nonFinite++;
  });
  return {
    world, soldier, vehicle,
    result: () => ({
      nonFinite,
      persistentStalls: soldier.botVehiclePersistentStalls ?? 0,
      routeCompleted: soldier.botVehicleRouteCompleted === true,
      elevationUsed: [...elevationUsed].sort(),
    }),
  };
}

export function runTelemetryProbe(theaterId: TheaterId, seed: number, seconds: number): VehicleTelemetrySnapshot {
  const probe = makeAirProbe(theaterId, seed, 'strike');
  runScenario(probe.world, seconds);
  return vehicleTelemetrySnapshot(probe.world.vehicleTelemetry);
}

export function boxedVehicleProbe(): { world: World; vehicle: Vehicle; soldier: Soldier } {
  const world = new World({ seed: 31337, mode: 'tdm', botsPerTeam: 0, map: generateTheater('city', 31337) });
  const route = world.map.theater!.routes.find((candidate) => candidate.domain === 'ground')!;
  const soldier = world.addSoldier('BOXED-DRIVER', 'infantry', 0, 'bot');
  const vehicle = world.spawnVehicle('tank', 0, route.points[0]);
  vehicle.seats[0] = soldier.id;
  soldier.vehicleId = vehicle.id;
  soldier.seat = 0;
  soldier.enteredVehicleAt = -10;
  soldier.botVehicleRouteId = route.id;
  const [cx, cz] = worldToTile(world.map.geometry, vehicle.pos.x, vehicle.pos.z);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== 1) continue;
    world.map.grid[tileIndex(world.map.geometry, cx + dx, cz + dz)] = T_WALL;
  }
  return { world, vehicle, soldier };
}

export function runDuel(attackerKind: VehicleKind, victimKind: VehicleKind, seed: number): VehicleTelemetrySnapshot {
  const map = createTheaterBase(THEATER_DEFS.countryside, seed);
  map.theater = undefined;
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map });
  const left = world.addSoldier('DUEL-A', 'infantry', 0, 'human');
  const right = world.addSoldier('DUEL-B', 'infantry', 1, 'human');
  const attacker = world.spawnVehicle(attackerKind, 0, { x: -18, y: 0, z: 0 });
  const victim = world.spawnVehicle(victimKind, 1, { x: 18, y: 0, z: 0 });
  attacker.seats[0] = left.id; left.vehicleId = attacker.id; left.seat = 0; left.enteredVehicleAt = -10;
  victim.seats[0] = right.id; right.vehicleId = victim.id; right.seat = 0; right.enteredVehicleAt = -10;
  attacker.turretYaw = 0;
  victim.turretYaw = Math.PI;
  const command = (aimYaw: number): PlayerCmd => ({
    moveX: 0, moveZ: 0, aimYaw, fire: true, altFire: false, jump: false,
    use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  });
  const dt = 1 / 30;
  for (let step = 0; step < 90 / dt && attacker.alive && victim.alive; step++) {
    world.step(dt, new Map([[left.id, command(0)], [right.id, command(Math.PI)]]));
  }
  return vehicleTelemetrySnapshot(world.vehicleTelemetry);
}
