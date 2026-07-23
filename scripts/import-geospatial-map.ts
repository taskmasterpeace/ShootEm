import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifactFromMap, type GeoMapArtifact } from '../src/sim/geospatial/artifact';
import { compileGeospatialMap } from '../src/sim/geospatial/compiler';
import { fetchAndMatchNsi } from '../src/sim/geospatial/nsi';
import { districtHardIssues } from '../src/sim/geospatial/diagnostics';
import { fetchElevationGrid, fetchOverpassSlice } from '../src/sim/geospatial/sources';
import type { GeoSliceSource } from '../src/sim/geospatial/types';
import { validateTheater } from '../src/sim/theater-builder';

export interface ImportArgs {
  id: string;
  name: string;
  bbox: [west: number, south: number, east: number, north: number];
  cityId: string;
  seed: number;
  retrievedAt: string;
  output: string;
  style: 'default' | 'miami-gardens';
  controlPointNames: [string, string, string];
  nsi: boolean;
}

const requiredArgs = ['id', 'name', 'bbox', 'city', 'seed', 'retrieved-at', 'output'] as const;

export function parseImportArgs(argv: readonly string[]): ImportArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected import argument '${token}'`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    values.set(token.slice(2), value);
  }
  for (const key of requiredArgs) {
    if (!values.has(key)) throw new Error(`missing required import argument --${key}`);
  }

  const parts = values.get('bbox')!.split(',').map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    throw new Error('--bbox must contain four numeric west,south,east,north values');
  }
  const bbox = parts as ImportArgs['bbox'];
  const [west, south, east, north] = bbox;
  if (west >= east || south >= north || west < -180 || east > 180 || south < -90 || north > 90) {
    throw new Error('--bbox has invalid geographic bounds');
  }
  const midLatitude = (south + north) / 2;
  const widthMeters = (east - west) * 111_320 * Math.cos(midLatitude * Math.PI / 180);
  const heightMeters = (north - south) * 111_320;
  if (widthMeters > 1_200 || heightMeters > 1_200) {
    throw new Error(`import slice exceeds the 1.2 km side limit (${Math.round(widthMeters)}m × ${Math.round(heightMeters)}m)`);
  }
  const seed = Number(values.get('seed'));
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
  const retrievedAt = values.get('retrieved-at')!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt)) throw new Error('--retrieved-at must be YYYY-MM-DD');
  const style = values.get('style') ?? 'default';
  if (style !== 'default' && style !== 'miami-gardens') {
    throw new Error("--style must be 'default' or 'miami-gardens'");
  }
  const controlPointParts = (values.get('control-points') ?? 'WEST APPROACH|CIVIC CENTER|EAST APPROACH')
    .split('|').map((name) => name.trim());
  if (controlPointParts.length !== 3 || controlPointParts.some((name) => !name)) {
    throw new Error('--control-points must contain exactly three non-empty names separated by |');
  }
  const nsiValue = values.get('nsi') ?? 'false';
  if (nsiValue !== 'true' && nsiValue !== 'false') throw new Error('--nsi must be true or false');

  return {
    id: values.get('id')!,
    name: values.get('name')!,
    bbox,
    cityId: values.get('city')!,
    seed,
    retrievedAt,
    output: values.get('output')!,
    style,
    controlPointNames: controlPointParts as [string, string, string],
    nsi: nsiValue === 'true',
  };
}

const OSM_ATTRIBUTION = {
  label: 'OpenStreetMap contributors',
  url: 'https://www.openstreetmap.org/copyright',
  license: 'ODbL-1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
};

const USGS_ATTRIBUTION = {
  label: 'USGS 3D Elevation Program (3DEP)',
  url: 'https://www.usgs.gov/3d-elevation-program',
  license: 'US public domain',
  licenseUrl: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
};

const NSI_ATTRIBUTION = {
  label: 'USACE National Structure Inventory',
  url: 'https://www.hec.usace.army.mil/confluence/nsi/',
  license: 'MIT',
  licenseUrl: 'https://github.com/USACE-NSI/NSI/blob/master/LICENSE',
};

/** Keep the artifact reviewable without spending one indented line per RLE number. */
export function stringifyArtifact(value: unknown): string {
  const numericArrays: string[] = [];
  const compactSections: string[] = [];
  const markerPrefix = '__WARWORLD_NUMERIC_ARRAY_';
  const sectionPrefix = '__WARWORLD_COMPACT_SECTION_';
  const pretty = JSON.stringify(value, (key, candidate) => {
    if ((key === 'source' || key === 'overlay' || key === 'district') && candidate && typeof candidate === 'object') {
      const marker = `${sectionPrefix}${compactSections.length}__`;
      compactSections.push(JSON.stringify(candidate));
      return marker;
    }
    if (Array.isArray(candidate) && candidate.every((entry) => typeof entry === 'number')) {
      const marker = `${markerPrefix}${numericArrays.length}__`;
      numericArrays.push(`[${candidate.join(',')}]`);
      return marker;
    }
    return candidate;
  }, 2);
  return `${pretty
    .replace(new RegExp(`"${markerPrefix}(\\d+)__"`, 'g'), (_match, index: string) => numericArrays[Number(index)])
    .replace(new RegExp(`"${sectionPrefix}(\\d+)__"`, 'g'), (_match, index: string) => compactSections[Number(index)])}\n`;
}

export async function importGeospatialMap(args: ImportArgs): Promise<void> {
  const output = resolve(args.output);
  let source: GeoSliceSource | undefined;
  try {
    const existing = JSON.parse(await readFile(output, 'utf8')) as GeoMapArtifact;
    const cached = existing.geography?.source;
    if (cached?.schemaVersion === 1 && cached.id === args.id && cached.retrievedAt === args.retrievedAt
      && cached.bbox.every((value, index) => value === args.bbox[index])
      && (!args.nsi || cached.nsi)) {
      source = cached;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }

  let skippedFeatures = 0;
  const sourceMode = source ? 'cached' : 'live';
  if (!source) {
    const vectors = await fetchOverpassSlice(args.bbox);
    if (!vectors.roads.length) throw new Error('import returned no roads');
    if (!vectors.buildings.length) throw new Error('import returned no buildings');
    skippedFeatures = vectors.skippedFeatures;

    // 13×13 is enough for the existing three semantic height bands while
    // keeping the public point service load bounded and reproducible.
    const elevation = await fetchElevationGrid(args.bbox, 13, 13);
    const nsi = args.nsi ? await fetchAndMatchNsi(vectors.buildings, args.bbox) : undefined;
    const attribution = [OSM_ATTRIBUTION, USGS_ATTRIBUTION];
    if (nsi?.status === 'matched') attribution.push(NSI_ATTRIBUTION);
    source = {
      schemaVersion: 1,
      id: args.id,
      name: args.name,
      bbox: args.bbox,
      origin: {
        longitude: (args.bbox[0] + args.bbox[2]) / 2,
        latitude: (args.bbox[1] + args.bbox[3]) / 2,
      },
      roads: vectors.roads,
      buildings: vectors.buildings,
      entrances: vectors.entrances,
      water: vectors.water,
      land: vectors.land,
      elevation,
      ...(nsi ? { nsi } : {}),
      attribution,
      retrievedAt: args.retrievedAt,
    };
  }
  const elevation = source.elevation;
  const compiled = compileGeospatialMap(source, {
    seed: args.seed,
    cityId: args.cityId,
    geometry: { cols: 300, rows: 300, tile: 3 },
    style: args.style,
    controlPointNames: args.controlPointNames,
    maxPlayableBuildings: 12,
  });
  const bands = [0, 0, 0];
  for (const value of compiled.map.height ?? []) bands[value]++;
  if ((compiled.map.height ?? []).some((value) => value > 2)) {
    throw new Error(`terrain produced an invalid height band (${bands.join(', ')})`);
  }
  const semanticIssues = districtHardIssues(compiled.district, 6);
  if (semanticIssues.length) throw new Error(`semantic district validation failed: ${semanticIssues.join('; ')}`);
  const validation = validateTheater(compiled.map);
  if (!validation.ok) throw new Error(`compiled theater validation failed: ${validation.issues.join('; ')}`);

  const artifact = artifactFromMap(compiled.map, {
    classification: compiled.classification,
    source,
    overlay: compiled.overlay,
  });
  const json = stringifyArtifact(artifact);
  const bytes = Buffer.byteLength(json);
  if (bytes >= 2_000_000) throw new Error(`artifact is ${bytes} bytes; 2 MB limit exceeded`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json, 'utf8');

  const elevationMin = Math.min(...elevation.values);
  const elevationMax = Math.max(...elevation.values);
  const rampCount = compiled.map.ramp?.reduce((count, value) => count + (value === 1 ? 1 : 0), 0) ?? 0;
  console.log(`source (${sourceMode}): ${source.roads.length} roads, ${source.buildings.length} buildings, ${source.water.length} water, ${source.land.length} green`);
  console.log(`skipped features: ${skippedFeatures}`);
  if (source.nsi) {
    console.log(`NSI: ${source.nsi.status}; ${source.nsi.matches.length} matched buildings${source.nsi.warning ? `; ${source.nsi.warning}` : ''}`);
  }
  console.log(`elevation: ${elevationMin.toFixed(1)}m..${elevationMax.toFixed(1)}m; bands ${bands.join('/')}; ${rampCount} ramp tiles`);
  console.log(`gameplay: ${compiled.diagnostics.playableBuildings} enterable buildings; ${compiled.overlay.length} overlay changes`);
  console.log(`semantics: ${(compiled.district.diagnostics.footprintRetention * 100).toFixed(1)}% footprints; ${compiled.district.blocks.length} blocks; ${compiled.district.lots.length} lots; ${compiled.district.buildings.length} buildings`);
  console.log(`validation issues: ${validation.issues.length}`);
  console.log(`artifact: ${bytes} bytes -> ${output}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  importGeospatialMap(parseImportArgs(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
