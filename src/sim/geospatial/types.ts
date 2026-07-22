import type { MapGeometry } from '../map-geometry';

export interface LonLat {
  longitude: number;
  latitude: number;
}

export interface LocalPoint {
  x: number;
  z: number;
}

export interface GeoRoad {
  id: string;
  roadClass: string;
  points: LonLat[];
  width?: number;
  bridge: boolean;
  tunnel: boolean;
}

export interface GeoBuilding {
  id: string;
  polygon: LonLat[];
  use?: string;
  height?: number;
  floors?: number;
  confidence?: number;
}

export interface GeoPolygonFeature {
  id: string;
  polygon: LonLat[];
  kind: string;
}

export interface GeoElevationGrid {
  cols: number;
  rows: number;
  bbox: [west: number, south: number, east: number, north: number];
  values: number[];
  resolution: number;
}

export interface GeoAttribution {
  label: string;
  url: string;
  license: string;
  licenseUrl: string;
}

export interface GeoSliceSource {
  schemaVersion: 1;
  id: string;
  name: string;
  bbox: [west: number, south: number, east: number, north: number];
  origin: LonLat;
  roads: GeoRoad[];
  buildings: GeoBuilding[];
  water: GeoPolygonFeature[];
  land: GeoPolygonFeature[];
  elevation: GeoElevationGrid;
  attribution: GeoAttribution[];
  retrievedAt: string;
}

export interface ProjectedGeoRoad extends Omit<GeoRoad, 'points'> {
  points: LocalPoint[];
}

export interface ProjectedGeoBuilding extends Omit<GeoBuilding, 'polygon'> {
  polygon: LocalPoint[];
}

export interface ProjectedGeoPolygonFeature extends Omit<GeoPolygonFeature, 'polygon'> {
  polygon: LocalPoint[];
}

export interface ProjectedGeoSlice {
  source: GeoSliceSource;
  geometry?: MapGeometry;
  origin: LocalPoint;
  rotation: number;
  roads: ProjectedGeoRoad[];
  buildings: ProjectedGeoBuilding[];
  water: ProjectedGeoPolygonFeature[];
  land: ProjectedGeoPolygonFeature[];
}
