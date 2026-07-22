import type { MapGeometry } from './map-geometry';
import type { Team, ThemeId, Vec3, VehicleKind } from './types';

export type TheaterId = 'city' | 'desert' | 'countryside' | 'mountain' | 'coastal' | 'ocean';
export type TheaterDomain = 'foot' | 'ground' | 'air' | 'surface' | 'deep';

export interface TheaterRoute {
  id: string;
  domain: TheaterDomain;
  /** Traversable corridor width in world units. */
  width: number;
  points: Vec3[];
}

export interface LandingZone {
  id: string;
  pos: Vec3;
  radius: number;
  /** Maximum grade across the landing disc, expressed as rise/run. */
  slope: number;
  side: Team | null;
}

export interface TheaterMetadata {
  id: TheaterId;
  name: string;
  domains: TheaterDomain[];
  routes: TheaterRoute[];
  landingZones: LandingZone[];
  /** Row-major tile indices where a submarine may be submerged. */
  deepWater: number[];
  freeDogfight: boolean;
}

export interface TheaterDef {
  id: TheaterId;
  name: string;
  geometry: MapGeometry;
  theme: ThemeId;
  domains: TheaterDomain[];
  freeDogfight: boolean;
  defaultPads: VehicleKind[];
}
