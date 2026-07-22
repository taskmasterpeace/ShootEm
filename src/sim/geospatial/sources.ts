import type {
  GeoBuilding,
  GeoElevationGrid,
  GeoPolygonFeature,
  GeoRoad,
  LonLat,
} from './types';

export interface NormalizedOverpass {
  roads: GeoRoad[];
  buildings: GeoBuilding[];
  water: GeoPolygonFeature[];
  land: GeoPolygonFeature[];
}

interface OverpassElement {
  type?: string;
  id?: number | string;
  tags?: Record<string, string>;
  geometry?: Array<{ lon?: number; lat?: number }>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
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

export function parseOverpass(payload: unknown): NormalizedOverpass {
  const response = payload as OverpassResponse;
  const normalized: NormalizedOverpass = { roads: [], buildings: [], water: [], land: [] };

  for (const element of response.elements ?? []) {
    if (element.type !== 'way') continue;
    const tags = element.tags ?? {};
    const points = pointsOf(element);
    const id = featureId(element);

    if (tags.highway && points.length >= 2 && tags.area !== 'yes') {
      normalized.roads.push({
        id,
        roadClass: tags.highway,
        points,
        width: finiteNumber(tags.width),
        bridge: isTrueTag(tags.bridge),
        tunnel: isTrueTag(tags.tunnel),
      });
      continue;
    }

    if (tags.building && points.length >= 3) {
      normalized.buildings.push({
        id,
        polygon: points,
        use: tags['building:use'] ?? tags.building,
        height: finiteNumber(tags.height),
        floors: finiteNumber(tags['building:levels']),
      });
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
    }
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
): string {
  const [west, south, east, north] = bbox;
  const bounds = `${south},${west},${north},${east}`;
  return `[out:json][timeout:60];(
way["highway"](${bounds});
way["building"](${bounds});
way["natural"="water"](${bounds});
way["waterway"="riverbank"](${bounds});
way["landuse"~"^(reservoir|basin|forest|grass|meadow|recreation_ground|village_green)$"](${bounds});
way["leisure"~"^(park|garden|nature_reserve|pitch)$"](${bounds});
way["natural"~"^(wood|grassland)$"](${bounds});
);out geom;`;
}

export async function fetchOverpassSlice(
  bbox: [west: number, south: number, east: number, north: number],
  fetcher: typeof fetch = fetch,
): Promise<NormalizedOverpass> {
  const body = new URLSearchParams({ data: buildOverpassQuery(bbox) });
  const response = await fetcher(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': SOURCE_USER_AGENT,
    },
    body,
  });
  if (!response.ok) throw new Error(`Overpass request failed (${response.status})`);
  return parseOverpass(await response.json());
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
  let unavailable = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      const x = index % cols;
      const y = Math.floor(index / cols);
      const longitude = west + (east - west) * (x / (cols - 1));
      const latitude = south + (north - south) * (y / (rows - 1));
      try {
        values[index] = await fetchElevationSample(longitude, latitude, fetcher);
      } catch {
        unavailable++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, values.length) }, worker));
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
