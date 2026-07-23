import type {
  GeoBuilding,
  NsiBuildingMatch,
  NsiBuildingRecord,
  NsiEnrichment,
} from './types';

const NSI_STRUCTURES_ENDPOINT = 'https://nsi.sec.usace.army.mil/nsiapi/structures';

interface NsiFeature {
  geometry?: { type?: string; coordinates?: unknown[] };
  properties?: Record<string, unknown>;
}

const finiteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const textValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const first = (properties: Record<string, unknown>, names: readonly string[]): unknown => {
  for (const name of names) {
    if (properties[name] !== undefined && properties[name] !== null) return properties[name];
  }
  return undefined;
};

export function parseNsiFeatures(payload: unknown): NsiBuildingRecord[] {
  const features = (payload as { features?: NsiFeature[] } | undefined)?.features;
  if (!Array.isArray(features)) return [];
  const records: NsiBuildingRecord[] = [];
  for (const feature of features) {
    const coordinates = feature.geometry?.coordinates;
    const properties = feature.properties ?? {};
    const longitude = finiteNumber(coordinates?.[0]);
    const latitude = finiteNumber(coordinates?.[1]);
    const id = textValue(first(properties, ['fd_id', 'fdid', 'id', 'ftprntid']));
    if (longitude === undefined || latitude === undefined || !id) continue;
    records.push({
      id,
      longitude,
      latitude,
      occupancy: textValue(first(properties, ['occtype', 'occupancy', 'occupancy_type'])),
      stories: finiteNumber(first(properties, ['num_story', 'numstories', 'stories'])),
      squareFeet: finiteNumber(first(properties, ['sqft', 'sqrfoot', 'square_feet'])),
      height: finiteNumber(first(properties, ['height', 'bldgheight', 'building_height'])),
      construction: textValue(first(properties, ['bldgtype', 'construction', 'construction_type'])),
    });
  }
  return records.sort((a, b) => a.id.localeCompare(b.id));
}

export async function fetchNsiSlice(
  bbox: [west: number, south: number, east: number, north: number],
  fetcher: typeof fetch = fetch,
): Promise<NsiBuildingRecord[]> {
  const url = new URL(NSI_STRUCTURES_ENDPOINT);
  url.searchParams.set('bbox', bbox.join(','));
  const response = await fetcher(url, {
    headers: { Accept: 'application/geo+json, application/json' },
  });
  if (!response.ok) throw new Error(`USACE NSI request failed (${response.status})`);
  return parseNsiFeatures(await response.json());
}

export async function fetchAndMatchNsi(
  buildings: readonly GeoBuilding[],
  bbox: [west: number, south: number, east: number, north: number],
  fetcher: typeof fetch = fetch,
): Promise<NsiEnrichment> {
  try {
    const records = await fetchNsiSlice(bbox, fetcher);
    return { status: 'matched', matches: matchNsiBuildings(buildings, records) };
  } catch (error) {
    return {
      status: 'unavailable',
      matches: [],
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}

function centroid(building: GeoBuilding): { longitude: number; latitude: number } {
  let longitude = 0;
  let latitude = 0;
  for (const point of building.polygon) {
    longitude += point.longitude;
    latitude += point.latitude;
  }
  const count = Math.max(1, building.polygon.length);
  return { longitude: longitude / count, latitude: latitude / count };
}

function distanceMeters(
  a: { longitude: number; latitude: number },
  b: { longitude: number; latitude: number },
): number {
  const radians = Math.PI / 180;
  const meanLatitude = (a.latitude + b.latitude) * 0.5 * radians;
  const dx = (a.longitude - b.longitude) * 111_320 * Math.cos(meanLatitude);
  const dy = (a.latitude - b.latitude) * 110_540;
  return Math.hypot(dx, dy);
}

/** Greedy nearest-neighbour assignment with deterministic tie-breaking and no reused records. */
export function matchNsiBuildings(
  buildings: readonly GeoBuilding[],
  records: readonly NsiBuildingRecord[],
  maxDistanceMeters = 25,
): NsiBuildingMatch[] {
  const candidates = buildings.flatMap((building) => {
    const center = centroid(building);
    return records.flatMap((record) => {
      const distance = distanceMeters(center, record);
      return distance <= maxDistanceMeters
        ? [{ buildingId: building.id, record, distanceMeters: distance }]
        : [];
    });
  }).sort((a, b) => a.distanceMeters - b.distanceMeters
    || a.buildingId.localeCompare(b.buildingId)
    || a.record.id.localeCompare(b.record.id));

  const usedBuildings = new Set<string>();
  const usedRecords = new Set<string>();
  const matches: NsiBuildingMatch[] = [];
  for (const candidate of candidates) {
    if (usedBuildings.has(candidate.buildingId) || usedRecords.has(candidate.record.id)) continue;
    usedBuildings.add(candidate.buildingId);
    usedRecords.add(candidate.record.id);
    matches.push(candidate);
  }
  return matches.sort((a, b) => a.buildingId.localeCompare(b.buildingId));
}
