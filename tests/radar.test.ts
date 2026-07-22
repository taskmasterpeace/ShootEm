import { describe, expect, it } from 'vitest';
import { RADAR_PROFILES, headingDegrees, radarDomainForVehicle, radarTrackKey, trackAlpha, weatherRadarMultiplier } from '../src/sim/radar';

describe('radar profiles', () => {
  it('keeps approved ranges and sweep cadences', () => {
    expect(RADAR_PROFILES.fixedWing).toMatchObject({ range: 500, cadence: 1.25 });
    expect(RADAR_PROFILES.rotorcraft).toMatchObject({ range: 90, cadence: 1.5 });
    expect(RADAR_PROFILES.staffedSensors).toMatchObject({ range: 160, cadence: 2 });
    expect(RADAR_PROFILES.surfaceNaval).toMatchObject({ range: 105, cadence: 1.75 });
    expect(RADAR_PROFILES.sonar).toMatchObject({ range: 80, cadence: 2.25 });
  });

  it('classifies air, surface, ground, and submerged hulls', () => {
    expect(radarDomainForVehicle('interceptor', 3, false)).toBe('air');
    expect(radarDomainForVehicle('attackheli', 2, false)).toBe('air');
    expect(radarDomainForVehicle('boat', 0, false)).toBe('surface');
    expect(radarDomainForVehicle('submarine', 0, false)).toBe('surface');
    expect(radarDomainForVehicle('submarine', 0, true)).toBe('submerged');
    expect(radarDomainForVehicle('tank', 0, false)).toBe('ground');
  });

  it('normalizes headings and creates type-safe stable keys', () => {
    expect(headingDegrees(0)).toBe(0);
    expect(headingDegrees(-Math.PI / 2)).toBe(270);
    expect(headingDegrees(Math.PI * 2 + Math.PI / 4)).toBe(45);
    expect(radarTrackKey('vehicle', 7)).toBe('v:7');
    expect(radarTrackKey('soldier', 7)).toBe('s:7');
  });

  it('fades tracks linearly from observation to expiry', () => {
    const track = { observedAt: 10, expiresAt: 14 } as never;
    expect(trackAlpha(track, 9)).toBe(1);
    expect(trackAlpha(track, 10)).toBe(1);
    expect(trackAlpha(track, 12)).toBe(0.5);
    expect(trackAlpha(track, 14)).toBe(0);
    expect(trackAlpha(track, 20)).toBe(0);
  });

  it('penalizes visibility weather but never sonar', () => {
    const storm = { kind: 'storm', intensity: 0.8, until: 99 } as const;
    expect(weatherRadarMultiplier(storm, 'fixedWing')).toBeCloseTo(0.72);
    expect(weatherRadarMultiplier(storm, 'sonar')).toBe(1);
    expect(weatherRadarMultiplier({ kind: 'clear', intensity: 0, until: 99 }, 'fixedWing')).toBe(1);
  });
});
