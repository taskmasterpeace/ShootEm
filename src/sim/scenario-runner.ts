import { vehicleRouteFor } from './bots';
import { asElevationLevel } from './elevation';
import { generateTheater } from './theaters';
import type { TheaterId } from './theater-types';
import type { Soldier, Vehicle, VehicleKind } from './types';
import { World } from './world';

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
