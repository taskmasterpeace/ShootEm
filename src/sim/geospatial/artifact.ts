import type { GameMap, GeospatialDecor, GeospatialMapMeta } from '../map';
import { geometryLength, validateGeometry, type MapGeometry } from '../map-geometry';
import type { ThemeId } from '../types';
import type { GeoAttribution, GeoSliceSource } from './types';

/** Compact JSON-safe run stream: alternating byte value and positive count. */
export type ByteRuns = number[];

export interface GameplayOverlayChange {
  index: number;
  reason: 'open_flank' | 'armor_clearance' | 'mission_anchor' | 'remove_low_confidence' | string;
}

type ArtifactObjects = Pick<GameMap,
  | 'basePos'
  | 'spawns'
  | 'flagPos'
  | 'hillPos'
  | 'controlPoints'
  | 'vehiclePads'
  | 'pickups'
  | 'props'
  | 'zombieSpawns'
  | 'houses'
  | 'gates'
  | 'pads'
  | 'propCovered'
  | 'operation'
  | 'theater'
  | 'raceTrack'
  | 'buildingMeta'
>;

export interface GeoMapArtifactV1 {
  schemaVersion: 1;
  geography: {
    geometry: MapGeometry;
    classification: ByteRuns;
    height: ByteRuns;
    ramp: ByteRuns;
    source: GeoSliceSource;
    attribution: GeoAttribution[];
    presentation?: {
      sourceId: string;
      cityId: string;
      style: GeospatialMapMeta['style'];
      buildingHeight: ByteRuns;
      decor: GeospatialDecor[];
    };
  };
  gameplay: {
    seed: number;
    theme: ThemeId;
    grid: ByteRuns;
    grid2: ByteRuns;
    upperLayers: ByteRuns[];
    surface: ByteRuns;
    objects: ArtifactObjects;
    overlay: GameplayOverlayChange[];
  };
}

export function encodeByteRuns(bytes: Uint8Array): ByteRuns {
  const runs: number[] = [];
  for (let index = 0; index < bytes.length;) {
    const value = bytes[index];
    let end = index + 1;
    while (end < bytes.length && bytes[end] === value) end++;
    runs.push(value, end - index);
    index = end;
  }
  return runs;
}

export function decodeByteRuns(runs: readonly number[], expectedLength: number): Uint8Array {
  if (runs.length % 2 !== 0) throw new Error('byte run stream must contain value/count pairs');
  const bytes = new Uint8Array(expectedLength);
  let cursor = 0;
  for (let index = 0; index < runs.length; index += 2) {
    const value = runs[index];
    const count = runs[index + 1];
    if (!Number.isInteger(value) || value < 0 || value > 255 || !Number.isInteger(count) || count <= 0) {
      throw new Error(`invalid byte run at pair ${index / 2}`);
    }
    if (cursor + count > expectedLength) throw new Error('decoded byte run length exceeds layer length');
    bytes.fill(value, cursor, cursor + count);
    cursor += count;
  }
  if (cursor !== expectedLength) {
    throw new Error(`decoded byte run length ${cursor}; expected ${expectedLength}`);
  }
  return bytes;
}

const cloneObjects = (map: GameMap): ArtifactObjects => structuredClone({
  basePos: map.basePos,
  spawns: map.spawns,
  flagPos: map.flagPos,
  hillPos: map.hillPos,
  controlPoints: map.controlPoints,
  vehiclePads: map.vehiclePads,
  pickups: map.pickups,
  props: map.props,
  zombieSpawns: map.zombieSpawns,
  houses: map.houses,
  gates: map.gates,
  pads: map.pads,
  propCovered: map.propCovered,
  ...(map.operation ? { operation: map.operation } : {}),
  ...(map.theater ? { theater: map.theater } : {}),
  ...(map.raceTrack ? { raceTrack: map.raceTrack } : {}),
  ...(map.buildingMeta ? { buildingMeta: map.buildingMeta } : {}),
}) as ArtifactObjects;

export function artifactFromMap(
  map: GameMap,
  options: {
    classification: Uint8Array;
    source: GeoSliceSource;
    overlay?: GameplayOverlayChange[];
  },
): GeoMapArtifactV1 {
  const length = geometryLength(map.geometry);
  validateGeometry(
    map.geometry,
    map.grid,
    map.grid2,
    map.surface,
    options.classification,
    ...(map.height ? [map.height] : []),
    ...(map.ramp ? [map.ramp] : []),
  );
  const height = map.height ?? new Uint8Array(length);
  const ramp = map.ramp ?? new Uint8Array(length);
  return {
    schemaVersion: 1,
    geography: {
      geometry: { ...map.geometry },
      classification: encodeByteRuns(options.classification),
      height: encodeByteRuns(height),
      ramp: encodeByteRuns(ramp),
      source: structuredClone(options.source),
      attribution: structuredClone(options.source.attribution),
      ...(map.geospatial ? {
        presentation: {
          sourceId: map.geospatial.sourceId,
          cityId: map.geospatial.cityId,
          style: map.geospatial.style,
          buildingHeight: encodeByteRuns(map.geospatial.buildingHeight),
          decor: structuredClone(map.geospatial.decor),
        },
      } : {}),
    },
    gameplay: {
      seed: map.seed,
      theme: map.theme,
      grid: encodeByteRuns(map.grid),
      grid2: encodeByteRuns(map.grid2),
      upperLayers: (map.upperLayers ?? []).map(encodeByteRuns),
      surface: encodeByteRuns(map.surface),
      objects: cloneObjects(map),
      overlay: structuredClone(options.overlay ?? []),
    },
  };
}

export function mapFromArtifact(artifact: GeoMapArtifactV1): GameMap {
  if (artifact.schemaVersion !== 1) {
    throw new Error(`unsupported geospatial artifact version ${(artifact as { schemaVersion?: number }).schemaVersion}`);
  }
  if (!artifact.geography.attribution.length) throw new Error('geospatial artifact attribution is required');
  const geometry = { ...artifact.geography.geometry };
  const length = geometryLength(geometry);
  const grid = decodeByteRuns(artifact.gameplay.grid, length);
  const grid2 = decodeByteRuns(artifact.gameplay.grid2, length);
  const surface = decodeByteRuns(artifact.gameplay.surface, length);
  const height = decodeByteRuns(artifact.geography.height, length);
  const ramp = decodeByteRuns(artifact.geography.ramp, length);
  const classification = decodeByteRuns(artifact.geography.classification, length);
  const presentation = artifact.geography.presentation;
  const geospatial: GeospatialMapMeta | undefined = presentation ? {
    sourceId: presentation.sourceId,
    cityId: presentation.cityId,
    style: presentation.style,
    classification,
    buildingHeight: decodeByteRuns(presentation.buildingHeight, length),
    decor: structuredClone(presentation.decor),
  } : undefined;
  const upperLayers = artifact.gameplay.upperLayers.map((layer) => decodeByteRuns(layer, length));
  if (upperLayers.length) upperLayers[0] = grid2;
  validateGeometry(geometry, grid, grid2, surface, height, ramp, ...upperLayers);
  const objects = structuredClone(artifact.gameplay.objects);
  return {
    seed: artifact.gameplay.seed,
    theme: artifact.gameplay.theme,
    geometry,
    grid,
    grid2,
    surface,
    height,
    ramp,
    ...(upperLayers.length ? { upperLayers } : {}),
    ...(geospatial ? { geospatial } : {}),
    ...objects,
  };
}
