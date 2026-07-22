import { describe, expect, it } from 'vitest';
import { MILITARY_MISSIONS, createMilitaryMissionLaunch } from '../src/sim/military-missions';
import { theaterForOperation, validateManifest } from '../src/sim/operations';
import { THEATER_DEFS } from '../src/sim/theaters';

describe('Military Mission exercise catalog', () => {
  it('covers every vehicle theater exactly once', () => {
    expect(MILITARY_MISSIONS.map((entry) => entry.theaterId)).toEqual([
      'city', 'desert', 'countryside', 'mountain', 'coastal', 'ocean',
    ]);
    expect(new Set(MILITARY_MISSIONS.map((entry) => entry.id)).size).toBe(6);
  });

  it.each(MILITARY_MISSIONS)('$id creates a legal launch on $theaterId', (preset) => {
    const launch = createMilitaryMissionLaunch(preset.id);
    expect(theaterForOperation(launch.plan)).toBe(preset.theaterId);
    expect(validateManifest(launch.plan, launch.manifest, launch.inventory)).toMatchObject({ ok: true });
    expect(THEATER_DEFS[preset.theaterId].geometry).toEqual(preset.geometry);
    expect(launch.inventory.filter((hull) => launch.manifest.hullIds.includes(hull.id))).not.toHaveLength(0);
  });
});
