import type { MapGeometry } from './map-geometry';
import type {
  OperationDomain,
  OperationHull,
  OperationManifest,
  OperationPhase,
  OperationPlan,
  OperationSiteId,
  OperationVerbId,
} from './operations';
import { THEATER_DEFS } from './theaters';
import type { TheaterId } from './theater-types';
import type { ModeId, VehicleKind } from './types';

export type MilitaryMissionId =
  | 'urban_assault'
  | 'air_superiority'
  | 'convoy_interdiction'
  | 'pass_assault'
  | 'beachhead'
  | 'naval_hunt';

export interface MilitaryMissionPreset {
  id: MilitaryMissionId;
  theaterId: TheaterId;
  theaterName: string;
  missionName: string;
  icon: string;
  tagline: string;
  geometry: MapGeometry;
  domains: readonly OperationDomain[];
  seed: number;
  mode: ModeId;
  plan: OperationPlan;
  inventory: readonly OperationHull[];
  manifest: OperationManifest;
}

export interface MilitaryMissionLaunch extends Omit<MilitaryMissionPreset, 'inventory'> {
  inventory: OperationHull[];
}

type HullIssue = readonly [id: string, kind: VehicleKind, name: string];

const phase = (
  kind: OperationPhase['kind'],
  label: string,
  domain: OperationDomain,
  duration?: number,
  targetCount?: number,
): Omit<OperationPhase, 'id'> => ({
  kind,
  label,
  domain,
  ...(duration === undefined ? {} : { duration }),
  ...(targetCount === undefined ? {} : { targetCount }),
});

function preset(
  id: MilitaryMissionId,
  theaterId: TheaterId,
  missionName: string,
  icon: string,
  tagline: string,
  seed: number,
  site: OperationSiteId,
  verb: OperationVerbId,
  domains: OperationDomain[],
  phaseTemplates: Omit<OperationPhase, 'id'>[],
  issues: HullIssue[],
): MilitaryMissionPreset {
  const theater = THEATER_DEFS[theaterId];
  const phases = phaseTemplates.map((entry, index): OperationPhase => ({
    ...entry,
    id: `exercise:${id}:${index + 1}`,
  }));
  const requirements = Object.fromEntries(domains.map((domain) => {
    const committedTargets = phaseTemplates
      .filter((entry) => entry.domain === domain && (entry.kind === 'escort' || entry.kind === 'arrive'))
      .map((entry) => entry.targetCount ?? 1);
    return [domain, Math.max(1, ...committedTargets)];
  })) as Partial<Record<OperationDomain, number>>;
  const inventory = issues.map(([hullId, kind, name]): OperationHull => ({
    id: hullId,
    kind,
    name,
    status: 'available',
  }));
  const plan: OperationPlan = {
    id: `exercise:${id}`,
    seed,
    frontId: `exercise:${id}`,
    pass: 2,
    scale: 'standard',
    verb,
    domains: [...domains],
    site,
    complication: 'reinforcement_clock',
    effect: 'opening_fog_lift',
    codename: `FIELD ${missionName.toUpperCase()}`,
    briefing: `${missionName} field exercise in ${theater.name}. ${tagline}`,
    phases,
    launchCost: 0,
    requirements,
    authorizedSupport: ['none'],
    recommendedCost: 12,
  };
  return {
    id,
    theaterId,
    theaterName: theater.name,
    missionName,
    icon,
    tagline,
    geometry: { ...theater.geometry },
    domains: [...domains],
    seed,
    mode: 'conquest',
    plan,
    inventory,
    manifest: { hullIds: inventory.map((hull) => hull.id), ammunition: 6, support: 'none' },
  };
}

export const MILITARY_MISSIONS: readonly MilitaryMissionPreset[] = [
  preset(
    'urban_assault', 'city', 'Urban Assault', '▦',
    'Fight block by block through a dense rail district.',
    7749, 'rail_hub', 'spearhead', ['land'],
    [phase('capture', 'Take the rail hub', 'land'), phase('defend', 'Hold the junction', 'land', 75)],
    [['mission-city-tank', 'tank', 'Mastodon 21'], ['mission-city-shrike', 'attackheli', 'Shrike 07']],
  ),
  preset(
    'air_superiority', 'desert', 'Air Superiority', '△',
    'Own the open sky, then seize the desert airfield.',
    4207, 'airfield', 'air_superiority', ['air', 'land'],
    [phase('eliminate', 'Clear the sky', 'air', undefined, 4), phase('capture', 'Seize the airfield', 'land')],
    [['mission-desert-interceptor', 'interceptor', 'Falcon 12'], ['mission-desert-tank', 'tank', 'Mastodon 33']],
  ),
  preset(
    'convoy_interdiction', 'countryside', 'Convoy Interdiction', '⇥',
    'Break the escort over farmland and secure the convoy road.',
    5150, 'rail_hub', 'intercept', ['air', 'land'],
    [phase('eliminate', 'Break the escort', 'air', undefined, 3), phase('capture', 'Secure the convoy road', 'land')],
    [['mission-country-strikejet', 'strikejet', 'Vulture 18'], ['mission-country-apc', 'apc', 'Bastion 09']],
  ),
  preset(
    'pass_assault', 'mountain', 'Pass Assault', '⛰',
    'Insert beyond the ridge and take the high mountain pass.',
    4207, 'mountain_pass', 'airborne_insertion', ['air', 'land'],
    [phase('arrive', 'Land beyond the ridge', 'air'), phase('capture', 'Take the high pass', 'land')],
    [['mission-mountain-condor', 'transportheli', 'Condor 04'], ['mission-mountain-buggy', 'buggy', 'Jackal 31']],
  ),
  preset(
    'beachhead', 'coastal', 'Beachhead', '≋',
    'Land the assault force and take the shore strongpoint.',
    5150, 'port', 'amphibious_assault', ['sea', 'land'],
    [phase('escort', 'Land the assault force', 'sea'), phase('capture', 'Take the shore strongpoint', 'land')],
    [['mission-coast-boat', 'boat', 'Pike 14'], ['mission-coast-tank', 'tank', 'Mastodon 48'], ['mission-coast-sub', 'submarine', 'Barracuda 06']],
  ),
  preset(
    'naval_hunt', 'ocean', 'Naval Hunt', '⌁',
    'Hunt the hostile screen and lock down the ocean channel.',
    31, 'carrier_anchorage', 'blockade', ['sea', 'air'],
    [phase('eliminate', 'Hunt the hostile screen', 'sea', undefined, 3), phase('hold', 'Hold the channel', 'sea', 90)],
    [['mission-ocean-sub', 'submarine', 'Barracuda 11'], ['mission-ocean-boat', 'boat', 'Pike 22'], ['mission-ocean-interceptor', 'interceptor', 'Falcon 05']],
  ),
] as const;

export function createMilitaryMissionLaunch(id: MilitaryMissionId): MilitaryMissionLaunch {
  const found = MILITARY_MISSIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown military mission '${id}'.`);
  return structuredClone(found) as MilitaryMissionLaunch;
}
