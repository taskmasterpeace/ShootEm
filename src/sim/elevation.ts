import type { VehicleDef } from './types';

export type ElevationLevel = 0 | 1 | 2 | 3;
export type ElevationWeaponClass = 'ground' | 'manpads' | 'lance' | 'aircraft';

export const ELEVATION_LABEL = ['GROUND', 'BUILDING', 'SKY', 'CLOUDS'] as const;
export const ELEVATION_ALT: Record<ElevationLevel, number> = {
  0: 0.12,
  1: 5.4,
  2: 14,
  3: 28,
};

export function asElevationLevel(value: number | undefined): ElevationLevel {
  return Math.max(0, Math.min(3, Math.round(value ?? 0))) as ElevationLevel;
}

export const maxElevationFor = (vehicle: VehicleDef): ElevationLevel =>
  vehicle.flies ? (vehicle.minAirspeed ? 3 : 2) : 0;

export function canWeaponReachElevation(kind: ElevationWeaponClass, level: ElevationLevel): boolean {
  const ceiling: ElevationLevel = kind === 'ground' ? 1 : kind === 'manpads' ? 2 : 3;
  return level <= ceiling;
}

/** Obstacles declare the highest semantic flight level their volume occupies. */
export function collidesAtElevation(level: ElevationLevel, obstacleTop: ElevationLevel): boolean {
  return level <= obstacleTop;
}

/** Clouds attenuate locks without granting immunity to high-altitude weapons. */
export function targetLockRangeAtElevation(baseRange: number, level: ElevationLevel, cloudIntensity: number): number {
  if (level !== 3) return baseRange;
  return baseRange * (1 - Math.max(0, Math.min(1, cloudIntensity)) * 0.45);
}
