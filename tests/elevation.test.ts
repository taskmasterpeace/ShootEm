import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import {
  ELEVATION_ALT,
  ELEVATION_LABEL,
  canWeaponReachElevation,
  collidesAtElevation,
  maxElevationFor,
  targetLockRangeAtElevation,
} from '../src/sim/elevation';
import { World } from '../src/sim/world';
import { takeSnapshot } from '../src/sim/snapshot';

describe('four semantic elevation levels', () => {
  it('names and orders all four levels from one source of truth', () => {
    expect(ELEVATION_LABEL).toEqual(['GROUND', 'BUILDING', 'SKY', 'CLOUDS']);
    expect(ELEVATION_ALT[0]).toBeLessThan(ELEVATION_ALT[1]);
    expect(ELEVATION_ALT[1]).toBeLessThan(ELEVATION_ALT[2]);
    expect(ELEVATION_ALT[2]).toBeLessThan(ELEVATION_ALT[3]);
  });

  it('caps rotors at Sky while fixed-wing aircraft can climb to Clouds', () => {
    expect(maxElevationFor(VEHICLES.flyer)).toBe(2);
    expect(maxElevationFor(VEHICLES.interceptor)).toBe(3);
    expect(maxElevationFor(VEHICLES.tank)).toBe(0);
  });

  it('limits weapon classes by semantic level', () => {
    expect(canWeaponReachElevation('ground', 1)).toBe(true);
    expect(canWeaponReachElevation('ground', 2)).toBe(false);
    expect(canWeaponReachElevation('manpads', 2)).toBe(true);
    expect(canWeaponReachElevation('manpads', 3)).toBe(false);
    expect(canWeaponReachElevation('lance', 3)).toBe(true);
    expect(canWeaponReachElevation('aircraft', 3)).toBe(true);
  });

  it('collides at or below a declared obstacle tier', () => {
    expect(collidesAtElevation(1, 1)).toBe(true);
    expect(collidesAtElevation(2, 1)).toBe(false);
    expect(collidesAtElevation(2, 2)).toBe(true);
    expect(collidesAtElevation(3, 2)).toBe(false);
  });

  it('attenuates target locks inside Clouds without making them immune', () => {
    expect(targetLockRangeAtElevation(100, 2, 1)).toBe(100);
    expect(targetLockRangeAtElevation(100, 3, 0)).toBe(100);
    expect(targetLockRangeAtElevation(100, 3, 1)).toBeCloseTo(55);
  });

  it('carries typed elevation and weapon reach through snapshots', () => {
    const world = new World({ seed: 12, mode: 'tdm', botsPerTeam: 0 });
    const pilot = world.addSoldier('Pilot', 'infantry', 1, 'human');
    const jet = world.spawnVehicle('interceptor', 1, { x: 30, y: 0, z: 0 });
    jet.seats[0] = pilot.id;
    jet.band = 3;
    const gunner = world.addSoldier('Gunner', 'infantry', 0, 'human');
    world.fireSamMissile(gunner, jet);
    const lance = world.spawnVehicle('aatrack', 0, { x: 0, y: 0, z: 5 });
    world.fireHullSam(lance, jet, gunner.id);

    const snapshot = takeSnapshot(world, []);
    expect(snapshot.vehicles.find((vehicle) => vehicle.id === jet.id)?.band).toBe(3);
    expect(snapshot.projectiles.map((projectile) => projectile.elevationWeapon)).toEqual(['manpads', 'lance']);
  });

  it('prevents MANPADS locks above Sky while Lance radar retains a cloud answer', () => {
    const world = new World({ seed: 21, mode: 'tdm', botsPerTeam: 0 });
    const gunner = world.addSoldier('Gunner', 'infantry', 0, 'human');
    gunner.pos = { x: 0, y: 0, z: 0 };
    gunner.yaw = 0;
    const pilot = world.addSoldier('Pilot', 'infantry', 1, 'human');
    const jet = world.spawnVehicle('interceptor', 1, { x: 30, y: 0, z: 0 });
    jet.seats[0] = pilot.id;
    jet.alive = true;
    jet.band = 3;
    expect(world.samLockTarget(gunner)).toBeNull();
    const lance = world.spawnVehicle('aatrack', 0, { x: 0, y: 0, z: 0 });
    expect(world.hullLockTarget(lance)?.id).toBe(jet.id);
    jet.band = 2;
    expect(world.samLockTarget(gunner)?.id).toBe(jet.id);
  });
});
