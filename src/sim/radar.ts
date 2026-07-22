import { VEHICLES } from './data';
import type { ElevationLevel } from './elevation';
import type { Team, Vec3, VehicleKind } from './types';
import type { WeatherState } from './weather';

export type RadarDomain = 'ground' | 'air' | 'surface' | 'submerged';
export type RadarSource = 'fixedWing' | 'rotorcraft' | 'staffedSensors' | 'surfaceNaval' | 'sonar';

export interface RadarEmitterProfile {
  source: RadarSource;
  range: number;
  cadence: number;
  domains: readonly RadarDomain[];
}

export interface RadarTrack {
  key: string;
  targetId: number;
  targetType: 'soldier' | 'vehicle';
  receivingTeam: Team;
  pos: Vec3;
  /** Last observed target heading in normalized compass degrees. */
  heading: number;
  band: ElevationLevel;
  domain: RadarDomain;
  source: RadarSource;
  observedAt: number;
  expiresAt: number;
  /** 1 = exact sweep return; lower values render an uncertainty radius. */
  precision: number;
  jammed: boolean;
}

export const RADAR_PROFILES = {
  fixedWing: { source: 'fixedWing', range: 500, cadence: 1.25, domains: ['air', 'ground', 'surface'] },
  rotorcraft: { source: 'rotorcraft', range: 90, cadence: 1.5, domains: ['air', 'ground'] },
  staffedSensors: { source: 'staffedSensors', range: 160, cadence: 2, domains: ['air', 'ground', 'surface'] },
  surfaceNaval: { source: 'surfaceNaval', range: 105, cadence: 1.75, domains: ['air', 'surface'] },
  sonar: { source: 'sonar', range: 80, cadence: 2.25, domains: ['surface', 'submerged'] },
} as const satisfies Record<RadarSource, RadarEmitterProfile>;

export function radarDomainForVehicle(kind: VehicleKind, band: number, submerged: boolean): RadarDomain {
  if (submerged) return 'submerged';
  const def = VEHICLES[kind];
  if (def.flies && band > 0) return 'air';
  if (def.boat || def.submersible) return 'surface';
  return 'ground';
}

export function radarTrackKey(targetType: RadarTrack['targetType'], targetId: number): string {
  return `${targetType === 'vehicle' ? 'v' : 's'}:${targetId}`;
}

export function headingDegrees(yaw: number): number {
  const turns = ((yaw * 180 / Math.PI) % 360 + 360) % 360;
  return Math.round(turns) % 360;
}

export function weatherRadarMultiplier(weather: WeatherState, source: RadarSource): number {
  if (source === 'sonar' || weather.kind === 'clear' || weather.kind === 'rain' || weather.kind === 'night') return 1;
  return Math.max(0.65, 1 - weather.intensity * 0.35);
}

export function trackAlpha(track: Pick<RadarTrack, 'observedAt' | 'expiresAt'>, now: number): number {
  if (now <= track.observedAt) return 1;
  const duration = track.expiresAt - track.observedAt;
  if (duration <= 0 || now >= track.expiresAt) return 0;
  return Math.max(0, Math.min(1, (track.expiresAt - now) / duration));
}
