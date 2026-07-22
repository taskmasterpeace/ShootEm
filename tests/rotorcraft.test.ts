import { describe, expect, it } from 'vitest';
import { VEHICLES, WEAPONS } from '../src/sim/data';
import { maxElevationFor } from '../src/sim/elevation';
import { AIR_KINDS } from '../src/sim/operations';
import type { VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

describe('military rotorcraft', () => {
  it.each(['attackheli', 'transportheli'] as const)('%s is hover-capable and capped at Sky', (kind) => {
    const def = VEHICLES[kind as VehicleKind];
    expect(def).toBeDefined();
    expect(def.flies).toBe(true);
    expect(def.hover).toBe(true);
    expect(def.minAirspeed).toBeUndefined();
    expect(maxElevationFor(def)).toBe(2);
    expect(AIR_KINDS.has(kind as VehicleKind)).toBe(true);
  });

  it('gives the Shrike distinct anti-armor and chin-gun weapons', () => {
    const shrike = VEHICLES['attackheli' as VehicleKind];
    expect(WEAPONS[shrike.weapon].splashDamage).toBeGreaterThan(0);
    expect(shrike.altWeapon).toBe('heli_cannon');
    expect(WEAPONS[shrike.altWeapon!].rof).toBeGreaterThan(WEAPONS[shrike.weapon].rof);
  });

  it('gives the Condor nine seats and only enables its spawn while grounded and connected', () => {
    const world = new World({ seed: 42, mode: 'ctf', botsPerTeam: 0 });
    const pilot = world.addSoldier('CONDOR PILOT', 'infantry', 0, 'human');
    const vehicle = world.spawnVehicle('transportheli' as VehicleKind, 0, { x: 0, y: 0, z: 0 });
    vehicle.seats[0] = pilot.id;
    pilot.vehicleId = vehicle.id;
    pilot.seat = 0;

    expect(vehicle.seats).toHaveLength(9);
    vehicle.band = 2;
    expect(world.vehicleMobileSpawnActive(vehicle)).toBe(false);
    vehicle.band = 0;
    expect(world.vehicleMobileSpawnActive(vehicle)).toBe(true);
    vehicle.systems.comms = 0;
    expect(world.vehicleMobileSpawnActive(vehicle)).toBe(false);
  });
});
