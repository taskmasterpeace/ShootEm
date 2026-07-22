import artifactJson from '../../data/geospatial/miami-gardens-33056.json';
import { mapFromArtifact, type GeoMapArtifactV1 } from '../geospatial/artifact';
import type { GameMap } from '../map';
import { finalizeTheater } from '../theater-builder';
import type { TheaterDef } from '../theater-types';

const MIAMI_GARDENS_ARTIFACT = artifactJson as unknown as GeoMapArtifactV1;

/** Hydrate independent mutable layers for a match; the frozen artifact stays pristine. */
export function generateGeospatialTheater(def: TheaterDef, seed: number): GameMap {
  const map = mapFromArtifact(MIAMI_GARDENS_ARTIFACT);
  if (map.geometry.cols !== def.geometry.cols || map.geometry.rows !== def.geometry.rows || map.geometry.tile !== def.geometry.tile) {
    throw new Error(`geocity artifact geometry does not match theater catalog`);
  }
  map.seed = seed;
  map.theme = def.theme;
  if (!map.theater) throw new Error('geocity artifact is missing theater metadata');
  map.theater.id = def.id;
  map.theater.name = def.name;
  map.theater.domains = [...def.domains];
  map.theater.freeDogfight = def.freeDogfight;
  return finalizeTheater(map);
}
