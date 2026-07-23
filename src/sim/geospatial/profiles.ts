import type { NeighborhoodPlacement } from './neighborhood';
import type {
  DistrictProfileId,
  GeoBuilding,
  NsiBuildingMatch,
  ProjectedGeoBuilding,
  SemanticBuilding,
  SemanticFacade,
  SemanticRoof,
} from './types';

export interface DistrictProfile {
  id: DistrictProfileId;
  roadWidths: Record<string, number>;
  defaultSetback: number;
  defaultFloors: [number, number];
  detachedBias: number;
  attachedBias: number;
  porchBias: number;
  storefrontBias: number;
  roofWeights: Partial<Record<SemanticRoof, number>>;
  decor: Array<'palm' | 'streetlight' | 'street-tree' | 'stoop' | 'porch'>;
}

const COMMON_ROAD_WIDTHS: Record<string, number> = {
  motorway: 18,
  trunk: 15,
  primary: 12,
  secondary: 10,
  tertiary: 8,
  residential: 6,
  unclassified: 6,
  living_street: 5,
  service: 3.5,
  track: 3,
  path: 2.5,
  footway: 2.5,
  cycleway: 3,
};

const PROFILES: Record<DistrictProfileId, DistrictProfile> = {
  'miami-gardens': {
    id: 'miami-gardens',
    roadWidths: { ...COMMON_ROAD_WIDTHS, primary: 15, secondary: 12, residential: 7 },
    defaultSetback: 9,
    defaultFloors: [1, 2],
    detachedBias: 0.9,
    attachedBias: 0.05,
    porchBias: 0.25,
    storefrontBias: 0.2,
    roofWeights: { hip: 0.65, gable: 0.35 },
    decor: ['palm', 'streetlight'],
  },
  'lower-manhattan': {
    id: 'lower-manhattan',
    roadWidths: { ...COMMON_ROAD_WIDTHS, primary: 16, secondary: 13, tertiary: 11, residential: 9 },
    defaultSetback: 1,
    defaultFloors: [6, 18],
    detachedBias: 0,
    attachedBias: 0.98,
    porchBias: 0,
    storefrontBias: 0.75,
    roofWeights: { flat: 1 },
    decor: ['streetlight', 'street-tree', 'stoop'],
  },
  tarboro: {
    id: 'tarboro',
    roadWidths: { ...COMMON_ROAD_WIDTHS, primary: 10, secondary: 8, residential: 6 },
    defaultSetback: 7,
    defaultFloors: [1, 2],
    detachedBias: 0.8,
    attachedBias: 0.12,
    porchBias: 0.85,
    storefrontBias: 0.55,
    roofWeights: { gable: 0.7, hip: 0.3 },
    decor: ['streetlight', 'street-tree', 'porch'],
  },
};

export function profileFor(id: DistrictProfileId): DistrictProfile {
  return PROFILES[id];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function polygonArea(building: ProjectedGeoBuilding): number {
  let twiceArea = 0;
  for (let index = 0; index < building.polygon.length; index++) {
    const a = building.polygon[index];
    const b = building.polygon[(index + 1) % building.polygon.length];
    twiceArea += a.x * b.z - b.x * a.z;
  }
  return Math.abs(twiceArea) / 2;
}

function inferredFloors(id: string, profile: DistrictProfile): number {
  const [minimum, maximum] = profile.defaultFloors;
  return minimum + stableHash(id) % (maximum - minimum + 1);
}

function normalizedUse(building: GeoBuilding, nsi?: NsiBuildingMatch): SemanticBuilding['use'] {
  if (building.use) return { value: building.use, source: 'osm', confidence: 'high' };
  const occupancy = nsi?.record.occupancy?.toUpperCase();
  if (occupancy) {
    const value = occupancy.startsWith('RES') ? 'residential'
      : occupancy.startsWith('COM') ? 'commercial'
        : occupancy.startsWith('IND') ? 'industrial'
          : /GOV|EDU|REL/.test(occupancy) ? 'civic'
            : 'mixed';
    return { value, source: 'nsi', confidence: 'medium' };
  }
  return { value: 'mixed', source: 'inferred', confidence: 'low' };
}

function roofFor(building: GeoBuilding, profile: DistrictProfile): SemanticRoof {
  const source = building.roofShape?.toLowerCase();
  if (source === 'flat' || source === 'gable' || source === 'hip' || source === 'mansard') return source;
  if (source) return 'mixed';
  const entries = Object.entries(profile.roofWeights) as Array<[SemanticRoof, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = (stableHash(building.id) % 10_000) / 10_000 * total;
  for (const [roof, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return roof;
  }
  return entries.at(-1)?.[0] ?? 'flat';
}

function facadeFor(profile: DistrictProfileId, use: string, floors: number): SemanticFacade {
  if (/industrial|warehouse|factory|manufacture/.test(use)) return 'industrial';
  const commercial = /retail|commercial|shop|office|hotel/.test(use);
  if (profile === 'lower-manhattan') return floors >= 6 ? 'podium-tower' : 'street-wall';
  if (commercial) return 'storefront';
  if (profile === 'tarboro') return 'porch';
  return 'detached';
}

function archetypeFor(profile: DistrictProfileId, facade: SemanticFacade): string {
  if (facade === 'podium-tower') return 'masonry-tower';
  if (facade === 'street-wall') return 'attached-row';
  if (facade === 'storefront') return profile === 'tarboro' ? 'main-street-storefront' : 'strip-storefront';
  if (facade === 'porch') return 'historic-porch-house';
  if (facade === 'industrial') return 'industrial-shell';
  return profile === 'miami-gardens' ? 'south-florida-house' : 'detached-house';
}

export interface InferBuildingOptions {
  profile: DistrictProfileId;
  nsiMatches?: readonly NsiBuildingMatch[];
  minEmbedded?: number;
  maxEmbedded?: number;
}

export function inferBuildingSemantics(
  sources: readonly GeoBuilding[],
  projected: readonly ProjectedGeoBuilding[],
  placements: readonly NeighborhoodPlacement[],
  options: InferBuildingOptions,
): SemanticBuilding[] {
  const profile = profileFor(options.profile);
  const sourceById = new Map(sources.map((building) => [building.id, building]));
  const projectedById = new Map(projected.map((building) => [building.id, building]));
  const placementById = new Map(placements.map((entry) => [entry.buildingId, entry]));
  const nsiById = new Map((options.nsiMatches ?? []).map((match) => [match.buildingId, match]));
  const candidates = placements.flatMap((entry) => {
    const shape = projectedById.get(entry.buildingId);
    return shape && polygonArea(shape) >= 48 ? [{ id: entry.buildingId, area: polygonArea(shape) }] : [];
  }).sort((a, b) => b.area - a.area || a.id.localeCompare(b.id));
  const minimum = Math.max(0, options.minEmbedded ?? 6);
  const maximum = Math.max(minimum, options.maxEmbedded ?? 12);
  const embedded = new Set(candidates.slice(0, Math.min(maximum, candidates.length)).map((entry) => entry.id));

  return [...placementById.keys()].sort().flatMap((id) => {
    const source = sourceById.get(id);
    const shape = projectedById.get(id);
    const placement = placementById.get(id);
    if (!source || !shape || !placement) return [];
    const nsi = nsiById.get(id);
    const use = normalizedUse(source, nsi);
    const floors = source.floors && source.floors > 0
      ? { value: Math.round(source.floors), source: 'osm' as const, confidence: 'high' as const }
      : nsi?.record.stories && nsi.record.stories > 0
        ? { value: Math.round(nsi.record.stories), source: 'nsi' as const, confidence: 'high' as const }
        : { value: inferredFloors(id, profile), source: 'inferred' as const, confidence: 'medium' as const };
    const height = source.height && source.height > 0
      ? { value: source.height, source: 'osm' as const, confidence: 'high' as const }
      : nsi?.record.height && nsi.record.height > 0
        ? { value: nsi.record.height, source: 'nsi' as const, confidence: 'high' as const }
        : { value: floors.value * 3.4 + 0.6, source: 'inferred' as const, confidence: 'medium' as const };
    const facade = facadeFor(options.profile, use.value.toLowerCase(), floors.value);
    const area = polygonArea(shape);
    return [{
      id,
      footprint: shape.polygon.map((point) => ({ ...point })),
      blockId: placement.blockId,
      lotId: placement.lotId,
      use,
      floors,
      height,
      archetype: archetypeFor(options.profile, facade),
      roof: roofFor(source, profile),
      facade,
      entrances: [{ ...placement.entrance, pedestrianConnector: [...placement.entrance.pedestrianConnector] }],
      interiorPolicy: embedded.has(id) ? 'embedded' : area >= 18 ? 'instanced' : 'sealed',
    } satisfies SemanticBuilding];
  });
}
