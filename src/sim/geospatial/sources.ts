import type {
  GeoBuilding,
  GeoElevationGrid,
  GeoEntrance,
  GeoPolygonFeature,
  GeoRoad,
  LonLat,
} from './types';

export interface NormalizedOverpass {
  roads: GeoRoad[];
  buildings: GeoBuilding[];
  water: GeoPolygonFeature[];
  land: GeoPolygonFeature[];
  entrances: GeoEntrance[];
  skippedFeatures: number;
}

interface OverpassElement {
  type?: string;
  id?: number | string;
  tags?: Record<string, string>;
  geometry?: Array<{ lon?: number; lat?: number }>;
  lon?: number;
  lat?: number;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;
const EPQS_ENDPOINT = 'https://epqs.nationalmap.gov/v1/json';
const SOURCE_USER_AGENT = 'WarWorld-Geospatial-Importer/1.0';

const finiteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isTrueTag = (value: string | undefined): boolean =>
  value === 'yes' || value === 'true' || value === '1';

const pointsOf = (element: OverpassElement): LonLat[] =>
  (element.geometry ?? []).flatMap((point) =>
    Number.isFinite(point.lon) && Number.isFinite(point.lat)
      ? [{ longitude: point.lon!, latitude: point.lat! }]
      : []);

const featureId = (element: OverpassElement): string =>
  `${element.type ?? 'element'}/${String(element.id ?? 'unknown')}`;

export function isAbovegroundBuilding(building: GeoBuilding): boolean {
  const location = building.tags?.location?.toLowerCase();
  const layer = finiteNumber(building.tags?.layer);
  if (location === 'underground') return false;
  if ((layer ?? 0) < 0 && (building.height ?? 0) <= 0) return false;
  return true;
}

export function parseOverpass(payload: unknown): NormalizedOverpass {
  const response = payload as OverpassResponse;
  const normalized: NormalizedOverpass = {
    roads: [], buildings: [], water: [], land: [], entrances: [], skippedFeatures: 0,
  };

  for (const element of response.elements ?? []) {
    const tags = element.tags ?? {};
    const id = featureId(element);
    if (element.type === 'node' && tags.entrance
      && Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
      normalized.entrances.push({
        id,
        point: { longitude: element.lon!, latitude: element.lat! },
        kind: tags.entrance,
        access: tags.access,
      });
      continue;
    }
    if (element.type !== 'way' && element.type !== 'relation') {
      normalized.skippedFeatures++;
      continue;
    }
    const points = pointsOf(element);

    if (tags.highway && points.length >= 2 && tags.area !== 'yes') {
      normalized.roads.push({
        id,
        roadClass: tags.highway,
        points,
        width: finiteNumber(tags.width),
        lanes: finiteNumber(tags.lanes),
        surface: tags.surface,
        sidewalk: tags.sidewalk,
        service: tags.service,
        access: tags.access,
        bridge: isTrueTag(tags.bridge),
        tunnel: isTrueTag(tags.tunnel),
        tags: { ...tags },
      });
      continue;
    }

    if (tags.building && points.length >= 3) {
      const building: GeoBuilding = {
        id,
        polygon: points,
        use: tags['building:use'] ?? tags.building,
        height: finiteNumber(tags.height),
        floors: finiteNumber(tags['building:levels']),
        material: tags['building:material'],
        roofShape: tags['roof:shape'],
        address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || undefined,
        name: tags.name,
        tags: { ...tags },
      };
      if (isAbovegroundBuilding(building)) normalized.buildings.push(building);
      else normalized.skippedFeatures++;
      continue;
    }

    const waterKind = tags.natural === 'water'
      ? tags.water ?? 'water'
      : tags.waterway === 'riverbank'
        ? 'riverbank'
        : tags.landuse === 'reservoir' || tags.landuse === 'basin'
          ? tags.landuse
          : undefined;
    if (waterKind && points.length >= 3) {
      normalized.water.push({ id, polygon: points, kind: waterKind });
      continue;
    }

    const landKind = tags.leisure ?? tags.landuse ??
      (tags.natural === 'wood' || tags.natural === 'grassland' ? tags.natural : undefined);
    if (landKind && points.length >= 3) {
      normalized.land.push({ id, polygon: points, kind: landKind });
      continue;
    }
    normalized.skippedFeatures++;
  }

  return normalized;
}

export function parseEpqs(payload: unknown): number {
  const response = payload as {
    value?: unknown;
    USGS_Elevation_Point_Query_Service?: {
      Elevation_Query?: { Elevation?: unknown };
    };
  };
  const raw = response?.value ??
    response?.USGS_Elevation_Point_Query_Service?.Elevation_Query?.Elevation;
  const value = finiteNumber(raw);
  if (value === undefined || Math.abs(value) > 1_000_000) {
    throw new Error('USGS elevation sample is unavailable');
  }
  return value;
}

export function buildOverpassQuery(
  bbox: [west: number, south: number, east: number, north: number],
  detailed = true,
): string {
  const [west, south, east, north] = bbox;
  const bounds = `${south},${west},${north},${east}`;
  return `[out:json][timeout:60];(
way["highway"](${bounds});
way["building"](${bounds});
${detailed ? `relation["building"](${bounds});
node["entrance"](${bounds});` : ''}
way["natural"="water"](${bounds});
way["waterway"="riverbank"](${bounds});
way["landuse"~"^(reservoir|basin|forest|grass|meadow|recreation_ground|village_green)$"](${bounds});
way["leisure"~"^(park|garden|nature_reserve|pitch)$"](${bounds});
way["natural"~"^(wood|grassland)$"](${bounds});
);out geom;`;
}

async function requestOverpassSlice(
  bbox: [west: number, south: number, east: number, north: number],
  fetcher: typeof fetch,
  detailed = true,
): Promise<NormalizedOverpass> {
  const body = new URLSearchParams({ data: buildOverpassQuery(bbox, detailed) });
  const failures: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(45_000),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': SOURCE_USER_AGENT,
        },
        body,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parseOverpass(await response.json());
    } catch (error) {
      failures.push(`${new URL(endpoint).host}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Overpass request failed (${failures.join('; ')})`);
}

function mergeOverpass(parts: readonly NormalizedOverpass[]): NormalizedOverpass {
  const unique = <T extends { id: string }>(items: readonly T[]): T[] =>
    [...new Map(items.map((item) => [item.id, item])).values()]
      .sort((a, b) => a.id.localeCompare(b.id));
  return {
    roads: unique(parts.flatMap((part) => part.roads)),
    buildings: unique(parts.flatMap((part) => part.buildings)),
    water: unique(parts.flatMap((part) => part.water)),
    land: unique(parts.flatMap((part) => part.land)),
    entrances: unique(parts.flatMap((part) => part.entrances)),
    skippedFeatures: parts.reduce((sum, part) => sum + part.skippedFeatures, 0),
  };
}

export async function fetchOverpassSlice(
  bbox: [west: number, south: number, east: number, north: number],
  fetcher: typeof fetch = fetch,
): Promise<NormalizedOverpass> {
  try {
    return await requestOverpassSlice(bbox, fetcher);
  } catch (wholeError) {
    const [west, south, east, north] = bbox;
    const middleLongitude = (west + east) / 2;
    const middleLatitude = (south + north) / 2;
    const tiles: Array<[number, number, number, number]> = [
      [west, south, middleLongitude, middleLatitude],
      [middleLongitude, south, east, middleLatitude],
      [west, middleLatitude, middleLongitude, north],
      [middleLongitude, middleLatitude, east, north],
    ];
    try {
      const parts: NormalizedOverpass[] = [];
      // Public instances explicitly ask clients not to burst expensive work.
      // Sequential lean tiles avoid the rate-limit/504 pattern of one dense
      // Lower Manhattan query while retaining all way geometry.
      for (const tile of tiles) parts.push(await requestOverpassSlice(tile, fetcher, false));
      return mergeOverpass(parts);
    } catch (tileError) {
      throw new Error(
        `${wholeError instanceof Error ? wholeError.message : String(wholeError)}; tiled retry failed: ${tileError instanceof Error ? tileError.message : String(tileError)}`,
      );
    }
  }
}

async function fetchElevationSample(
  longitude: number,
  latitude: number,
  fetcher: typeof fetch,
): Promise<number> {
  const url = new URL(EPQS_ENDPOINT);
  url.searchParams.set('x', String(longitude));
  url.searchParams.set('y', String(latitude));
  url.searchParams.set('units', 'Meters');
  url.searchParams.set('wkid', '4326');
  url.searchParams.set('includeDate', 'false');

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(url, { headers: { 'User-Agent': SOURCE_USER_AGENT } });
      if (!response.ok) throw new Error(`USGS EPQS request failed (${response.status})`);
      return parseEpqs(await response.json());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('USGS elevation request failed');
}

function fillUnavailable(values: Array<number | undefined>, cols: number): number[] {
  const available = values.flatMap((value) => value === undefined ? [] : [value]);
  if (!available.length) throw new Error('USGS elevation grid contains no usable samples');
  const fallback = available.reduce((sum, value) => sum + value, 0) / available.length;

  return values.map((value, index) => {
    if (value !== undefined) return value;
    const x = index % cols;
    const y = Math.floor(index / cols);
    let nearest = fallback;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let candidate = 0; candidate < values.length; candidate++) {
      if (values[candidate] === undefined) continue;
      const dx = candidate % cols - x;
      const dy = Math.floor(candidate / cols) - y;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = values[candidate]!;
      }
    }
    return nearest;
  });
}

export async function fetchElevationGrid(
  bbox: [west: number, south: number, east: number, north: number],
  cols = 25,
  rows = 25,
  fetcher: typeof fetch = fetch,
): Promise<GeoElevationGrid> {
  if (cols < 2 || rows < 2 || cols > 25 || rows > 25) {
    throw new Error('USGS elevation grid dimensions must be between 2 and 25');
  }
  const [west, south, east, north] = bbox;
  const values: Array<number | undefined> = new Array(cols * rows);
  let cursor = 0;

  const sampleIndex = async (index: number): Promise<void> => {
    const x = index % cols;
    const y = Math.floor(index / cols);
    const longitude = west + (east - west) * (x / (cols - 1));
    const latitude = south + (north - south) * (y / (rows - 1));
    try {
      values[index] = await fetchElevationSample(longitude, latitude, fetcher);
    } catch {
      values[index] = undefined;
    }
  };
  const worker = async (indices?: readonly number[]): Promise<void> => {
    while (true) {
      const position = cursor++;
      const index = indices ? indices[position] : position;
      if (index === undefined || index >= values.length) return;
      await sampleIndex(index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, values.length) }, () => worker()));
  const failed = values.flatMap((value, index) => value === undefined ? [index] : []);
  if (failed.length) {
    cursor = 0;
    await Promise.all(Array.from({ length: Math.min(2, failed.length) }, () => worker(failed)));
  }
  const unavailable = values.reduce<number>((count, value) => count + (value === undefined ? 1 : 0), 0);
  if (unavailable / values.length > 0.05) {
    throw new Error(`USGS elevation grid unavailable at ${unavailable}/${values.length} samples`);
  }

  const midLatitude = (south + north) / 2;
  const widthMeters = (east - west) * 111_320 * Math.cos(midLatitude * Math.PI / 180);
  const heightMeters = (north - south) * 111_320;
  return {
    cols,
    rows,
    bbox,
    values: fillUnavailable(values, cols),
    resolution: Math.max(widthMeters / (cols - 1), heightMeters / (rows - 1)),
  };
}
