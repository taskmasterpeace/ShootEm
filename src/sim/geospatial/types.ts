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
  lanes?: number;
  surface?: string;
  sidewalk?: string;
  service?: string;
  access?: string;
  bridge: boolean;
  tunnel: boolean;
  tags?: Record<string, string>;
}

export type DistrictProfileId = 'miami-gardens' | 'lower-manhattan' | 'tarboro';
export type InteriorPolicy = 'embedded' | 'instanced' | 'sealed';
export type SemanticConfidence = 'surveyed' | 'high' | 'medium' | 'low';
export type EvidenceSource = 'osm' | 'overture' | 'nsi' | 'usgs' | 'inferred';

export interface AttributeEvidence<T> {
  value: T;
  source: EvidenceSource;
  confidence: SemanticConfidence;
}

export interface GeoBuilding {
  id: string;
  polygon: LonLat[];
  use?: string;
  height?: number;
  floors?: number;
  confidence?: number;
  material?: string;
  roofShape?: string;
  address?: string;
  name?: string;
  tags?: Record<string, string>;
}

export interface GeoEntrance {
  id: string;
  point: LonLat;
  kind?: string;
  access?: string;
}

export interface NsiBuildingRecord {
  id: string;
  longitude: number;
  latitude: number;
  occupancy?: string;
  stories?: number;
  squareFeet?: number;
  height?: number;
  construction?: string;
}

export interface NsiBuildingMatch {
  buildingId: string;
  record: NsiBuildingRecord;
  distanceMeters: number;
}

export interface NsiEnrichment {
  status: 'matched' | 'unavailable';
  matches: NsiBuildingMatch[];
  warning?: string;
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
  entrances?: GeoEntrance[];
  water: GeoPolygonFeature[];
  land: GeoPolygonFeature[];
  elevation: GeoElevationGrid;
  nsi?: NsiEnrichment;
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

export interface SemanticRoad {
  id: string;
  sourceRoadId: string;
  roadClass: string;
  kind: 'carriageway' | 'service' | 'driveway' | 'path';
  width: number;
  centerline: LocalPoint[];
  connectorIds: string[];
  cells: number[];
}

export interface SemanticBlock {
  id: string;
  polygon: LocalPoint[];
  cells: number[];
  area: number;
  buildingIds: string[];
  lotIds: string[];
}

export interface SemanticLot {
  id: string;
  blockId: string;
  polygon: LocalPoint[];
  cells: number[];
  buildingIds: string[];
  frontageRoadId?: string;
  frontage: LocalPoint[];
  setback: number;
  yardDepth: number;
  parking: boolean;
}

export interface SemanticEntrance {
  id: string;
  buildingId: string;
  position: LocalPoint;
  facing: number;
  /** Tile indices forming the walkable route from the door to the pedestrian network. */
  pedestrianConnector: number[];
}

export type SemanticRoof = 'flat' | 'gable' | 'hip' | 'mansard' | 'mixed';
export type SemanticFacade =
  | 'detached'
  | 'porch'
  | 'storefront'
  | 'street-wall'
  | 'podium-tower'
  | 'industrial';

export interface SemanticBuilding {
  id: string;
  footprint: LocalPoint[];
  blockId: string;
  lotId: string;
  use: AttributeEvidence<string>;
  floors: AttributeEvidence<number>;
  height: AttributeEvidence<number>;
  archetype: string;
  roof: SemanticRoof;
  facade: SemanticFacade;
  entrances: SemanticEntrance[];
  interiorPolicy: InteriorPolicy;
}

export interface DistrictDiagnostics {
  sourceBuildingCount: number;
  retainedBuildingCount: number;
  footprintRetention: number;
  unexplainedRoadOverlaps: string[];
  disconnectedEntrances: string[];
  disconnectedEmbeddedInteriors: string[];
  vehicleAnchorsConnected: boolean;
  walkableIslands: number[][];
  removedBuildings: Array<{ id: string; reason: string }>;
  warnings: string[];
  embeddedInteriorCount?: number;
  instancedInteriorCount?: number;
  sealedBuildingCount?: number;
  heightBands?: Record<string, number>;
  useCounts?: Record<string, number>;
  renderBatchEstimate?: number;
}

export interface SemanticDistrict {
  schemaVersion: 2;
  id: string;
  name: string;
  profile: DistrictProfileId;
  source: GeoSliceSource;
  roads: SemanticRoad[];
  blocks: SemanticBlock[];
  lots: SemanticLot[];
  buildings: SemanticBuilding[];
  land: ProjectedGeoPolygonFeature[];
  water: ProjectedGeoPolygonFeature[];
  elevation: GeoElevationGrid;
  diagnostics: DistrictDiagnostics;
  attribution: GeoAttribution[];
}
