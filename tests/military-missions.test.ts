import { describe, expect, it } from 'vitest';
import { MILITARY_MISSIONS, createMilitaryMissionLaunch } from '../src/sim/military-missions';
import { theaterForOperation, validateManifest } from '../src/sim/operations';
import { THEATER_DEFS } from '../src/sim/theaters';
import { World } from '../src/sim/world';

describe('Military Mission exercise catalog', () => {
  it('includes the real-city battlefield in the exercise catalog', () => {
    expect(MILITARY_MISSIONS.map((entry) => entry.theaterId)).toEqual([
      'city', 'geocity', 'desert', 'countryside', 'mountain', 'coastal', 'ocean',
    ]);
    expect(new Set(MILITARY_MISSIONS.map((entry) => entry.id)).size).toBe(7);
    const civicFront = MILITARY_MISSIONS.find((entry) => entry.theaterId === 'geocity');
    expect(civicFront).toMatchObject({
      missionName: '33056 Civic Front',
      mode: 'conquest',
    });
    expect(civicFront?.plan.phases.map((phase) => phase.label)).toEqual([
      'Take 183rd Street',
      'Hold Civic Center',
    ]);
  });

  it.each(MILITARY_MISSIONS)('$id creates a legal launch on $theaterId', (preset) => {
    const launch = createMilitaryMissionLaunch(preset.id);
    expect(theaterForOperation(launch.plan)).toBe(preset.theaterId);
    expect(validateManifest(launch.plan, launch.manifest, launch.inventory)).toMatchObject({ ok: true });
    expect(THEATER_DEFS[preset.theaterId].geometry).toEqual(preset.geometry);
    expect(launch.inventory.filter((hull) => launch.manifest.hullIds.includes(hull.id))).not.toHaveLength(0);
  });

  it.each(MILITARY_MISSIONS)('$id builds a playable Operation World', (preset) => {
    const launch = createMilitaryMissionLaunch(preset.id);
    const world = new World({
      seed: launch.seed,
      mode: launch.mode,
      botsPerTeam: 0,
      operation: launch.plan,
      operationManifest: launch.manifest,
      operationInventory: launch.inventory,
    });
    expect(world.map.theater?.id).toBe(preset.theaterId);
    expect(world.operation?.plan.id).toBe(launch.plan.id);
    expect(world.map.spawns[0].length).toBeGreaterThan(0);
    expect([...world.vehicles.values()].some((vehicle) => !!vehicle.operationHullId)).toBe(true);
  });
});
