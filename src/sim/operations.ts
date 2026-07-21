import { VEHICLES } from './data';
import { Rng } from './rng';
import type { VehicleKind } from './types';

export type OperationDomain = 'land' | 'air' | 'sea';
export type OperationScale = 'skirmish' | 'standard' | 'large';
export type OperationPhaseKind = 'capture' | 'hold' | 'destroy' | 'escort' | 'arrive' | 'defend' | 'eliminate';
export type OperationSupport = 'none' | 'artillery' | 'cas';
export type Commitment = 'light' | 'balanced' | 'heavy';

export type OperationSiteId =
  | 'front_line' | 'strongpoint' | 'river_crossing' | 'supply_depot' | 'rail_hub'
  | 'airfield' | 'coastal_battery' | 'port' | 'carrier_anchorage' | 'mountain_pass';

export type OperationVerbId =
  | 'spearhead' | 'hold_line' | 'siege' | 'interdict' | 'encircle' | 'counterbattery'
  | 'air_superiority' | 'close_air_support' | 'strategic_strike' | 'intercept' | 'airborne_insertion'
  | 'amphibious_assault' | 'blockade' | 'convoy' | 'coastal_raid';

export type OperationComplicationId =
  | 'air_cover_denied' | 'god_on_objective' | 'storm' | 'reinforcement_clock'
  | 'scorched_earth' | 'no_collateral' | 'one_airframe';

export type OperationEffectCategory = 'territory' | 'facility' | 'materiel' | 'control' | 'doctrine';

export interface OperationPhaseTemplate {
  kind: OperationPhaseKind;
  label: string;
  domain: OperationDomain;
  duration?: number;
  targetCount?: number;
}

export interface OperationPhase extends OperationPhaseTemplate {
  id: string;
}

export interface OperationVerbDef {
  id: OperationVerbId;
  name: string;
  domain: OperationDomain;
  sites: OperationSiteId[];
  phases: OperationPhaseTemplate[];
}

export interface OperationSiteDef { id: OperationSiteId; name: string }
export interface OperationComplicationDef { id: OperationComplicationId; name: string; briefing: string }
export interface OperationEffectDef { id: OperationEffectId; name: string; category: OperationEffectCategory }

export interface CombinedArmsSignature {
  id: 'beachhead' | 'hammer' | 'choke' | 'anvil_drop';
  name: string;
  verb: OperationVerbId;
  domains: OperationDomain[];
  sites: OperationSiteId[];
  phases: OperationPhaseTemplate[];
  authorizedSupport: OperationSupport[];
  recommendedCost: number;
}

const phase = (kind: OperationPhaseKind, label: string, domain: OperationDomain, duration?: number, targetCount?: number): OperationPhaseTemplate =>
  ({ kind, label, domain, ...(duration === undefined ? {} : { duration }), ...(targetCount === undefined ? {} : { targetCount }) });

export const OPERATION_SITES: OperationSiteDef[] = [
  { id: 'front_line', name: 'front line' },
  { id: 'strongpoint', name: 'fortified strongpoint' },
  { id: 'river_crossing', name: 'river crossing' },
  { id: 'supply_depot', name: 'supply depot' },
  { id: 'rail_hub', name: 'rail hub' },
  { id: 'airfield', name: 'enemy airfield' },
  { id: 'coastal_battery', name: 'coastal battery' },
  { id: 'port', name: 'port' },
  { id: 'carrier_anchorage', name: 'carrier anchorage' },
  { id: 'mountain_pass', name: 'mountain pass' },
];

export const OPERATION_VERBS: OperationVerbDef[] = [
  { id: 'spearhead', name: 'Spearhead', domain: 'land', sites: ['front_line', 'strongpoint', 'river_crossing', 'mountain_pass'], phases: [phase('capture', 'Break the line', 'land')] },
  { id: 'hold_line', name: 'Hold the Line', domain: 'land', sites: ['front_line', 'strongpoint', 'mountain_pass', 'airfield', 'port'], phases: [phase('hold', 'Dig in and hold', 'land', 90)] },
  { id: 'siege', name: 'Siege', domain: 'land', sites: ['strongpoint', 'airfield', 'coastal_battery'], phases: [phase('destroy', 'Reduce the defenses', 'land', undefined, 3), phase('capture', 'Take the breach', 'land')] },
  { id: 'interdict', name: 'Interdict', domain: 'land', sites: ['river_crossing', 'supply_depot', 'rail_hub'], phases: [phase('destroy', 'Cut the supply line', 'land', undefined, 2)] },
  { id: 'encircle', name: 'Encircle', domain: 'land', sites: ['front_line', 'mountain_pass', 'rail_hub'], phases: [phase('arrive', 'Close the western jaw', 'land'), phase('arrive', 'Close the eastern jaw', 'land'), phase('eliminate', 'Clear the pocket', 'land')] },
  { id: 'counterbattery', name: 'Counterbattery', domain: 'land', sites: ['front_line', 'strongpoint', 'mountain_pass'], phases: [phase('destroy', 'Silence the batteries', 'land', 120, 2)] },
  { id: 'air_superiority', name: 'Air Superiority', domain: 'air', sites: ['airfield', 'front_line', 'strongpoint', 'carrier_anchorage', 'mountain_pass'], phases: [phase('eliminate', 'Clear the sector sky', 'air', undefined, 4)] },
  { id: 'close_air_support', name: 'Close Air Support', domain: 'air', sites: ['front_line', 'strongpoint', 'mountain_pass'], phases: [phase('defend', 'Cover the ground push', 'air', 90)] },
  { id: 'strategic_strike', name: 'Strategic Strike', domain: 'air', sites: ['strongpoint', 'supply_depot', 'rail_hub', 'airfield', 'coastal_battery'], phases: [phase('destroy', 'Deliver the Anvil strike', 'air', undefined, 1)] },
  { id: 'intercept', name: 'Intercept', domain: 'air', sites: ['airfield', 'port', 'front_line', 'carrier_anchorage'], phases: [phase('defend', 'Break the inbound raid', 'air', 90)] },
  { id: 'airborne_insertion', name: 'Airborne Insertion', domain: 'air', sites: ['front_line', 'strongpoint', 'airfield', 'mountain_pass'], phases: [phase('arrive', 'Land the insertion force', 'air'), phase('hold', 'Hold the landing zone', 'air', 75)] },
  { id: 'amphibious_assault', name: 'Amphibious Assault', domain: 'sea', sites: ['port', 'coastal_battery', 'river_crossing'], phases: [phase('escort', 'Cross the water', 'sea'), phase('capture', 'Secure the beachhead', 'sea')] },
  { id: 'blockade', name: 'Blockade', domain: 'sea', sites: ['port', 'carrier_anchorage', 'coastal_battery'], phases: [phase('hold', 'Seal the channel', 'sea', 120)] },
  { id: 'convoy', name: 'Convoy', domain: 'sea', sites: ['port', 'river_crossing', 'carrier_anchorage'], phases: [phase('escort', 'Land the convoy', 'sea', undefined, 3)] },
  { id: 'coastal_raid', name: 'Coastal Raid', domain: 'sea', sites: ['port', 'coastal_battery', 'carrier_anchorage'], phases: [phase('destroy', 'Strike the shore target', 'sea'), phase('arrive', 'Escape the coast', 'sea')] },
];

export const OPERATION_COMPLICATIONS: OperationComplicationDef[] = [
  { id: 'air_cover_denied', name: 'Air Cover Denied', briefing: 'air cover is denied' },
  { id: 'god_on_objective', name: 'God on the Objective', briefing: 'a god holds the objective' },
  { id: 'storm', name: 'Night Storm', briefing: 'a storm has swallowed the sector' },
  { id: 'reinforcement_clock', name: 'Reserves One Front Away', briefing: 'enemy reserves are one front away' },
  { id: 'scorched_earth', name: 'Scorched Earth', briefing: 'the enemy will destroy the prize before surrendering it' },
  { id: 'no_collateral', name: 'No Collateral', briefing: 'command forbids civilian losses' },
  { id: 'one_airframe', name: 'One Airframe', briefing: 'the critical airframe must survive' },
];

const effect = (id: OperationEffectId, name: string, category: OperationEffectCategory): OperationEffectDef => ({ id, name, category });

export type OperationEffectId =
  | 'take_sector' | 'push_front' | 'open_supply_route' | 'deny_supply_route' | 'seize_high_ground' | 'hold_chokepoint' | 'split_front' | 'flip_city' | 'forward_base' | 'claim_midfield'
  | 'capture_airfield' | 'capture_port' | 'capture_fuel_farm' | 'capture_rail_hub' | 'capture_forge' | 'capture_clone_hub' | 'capture_radar' | 'capture_sam' | 'capture_repair_depot' | 'capture_bridge'
  | 'war_chest' | 'steal_opening_purse' | 'cheaper_requisition' | 'artillery_barrage' | 'preplaced_hazards' | 'rearm_pads' | 'captured_vehicle' | 'ground_enemy_air' | 'sink_convoy' | 'fiscal_efficiency'
  | 'air_superiority_control' | 'sea_control' | 'cas_allotment' | 'escort_wing' | 'deny_enemy_cas' | 'carrier_slot' | 'coastal_cover' | 'early_warning' | 'no_fly_zone' | 'submarine_picket'
  | 'doctrine_node' | 'vehicle_retrofit' | 'reveal_manifest' | 'nemesis_file' | 'opening_fog_lift' | 'radio_intercept' | 'see_enemy_books' | 'veteran_recovery' | 'commendation' | 'courier_headline';

export const OPERATION_EFFECTS: OperationEffectDef[] = [
  effect('take_sector', 'Take a sector', 'territory'), effect('push_front', 'Push the front line', 'territory'),
  effect('open_supply_route', 'Open a supply route', 'territory'), effect('deny_supply_route', 'Deny an enemy route', 'territory'),
  effect('seize_high_ground', 'Seize the high ground', 'territory'), effect('hold_chokepoint', 'Hold a chokepoint', 'territory'),
  effect('split_front', 'Split the enemy front', 'territory'), effect('flip_city', 'Flip a contested city', 'territory'),
  effect('forward_base', 'Establish a forward base', 'territory'), effect('claim_midfield', 'Claim next battle midfield', 'territory'),
  effect('capture_airfield', 'Capture an airfield', 'facility'), effect('capture_port', 'Capture a port', 'facility'),
  effect('capture_fuel_farm', 'Capture a fuel farm', 'facility'), effect('capture_rail_hub', 'Capture a rail hub', 'facility'),
  effect('capture_forge', 'Capture a forge', 'facility'), effect('capture_clone_hub', 'Capture a clone hub', 'facility'),
  effect('capture_radar', 'Capture a radar station', 'facility'), effect('capture_sam', 'Capture a SAM site', 'facility'),
  effect('capture_repair_depot', 'Capture a repair depot', 'facility'), effect('capture_bridge', 'Capture an intact bridge', 'facility'),
  effect('war_chest', 'War-chest payout', 'materiel'), effect('steal_opening_purse', 'Steal the opening purse', 'materiel'),
  effect('cheaper_requisition', 'Cheaper requisition', 'materiel'), effect('artillery_barrage', 'Off-map artillery barrage', 'materiel'),
  effect('preplaced_hazards', 'Pre-placed hazards', 'materiel'), effect('rearm_pads', 'Field rearm pads', 'materiel'),
  effect('captured_vehicle', 'Captured vehicle variant', 'materiel'), effect('ground_enemy_air', 'Ground enemy air', 'materiel'),
  effect('sink_convoy', 'Sink the enemy convoy', 'materiel'), effect('fiscal_efficiency', 'Fiscal Efficiency bonus', 'materiel'),
  effect('air_superiority_control', 'Sector air superiority', 'control'), effect('sea_control', 'Channel sea control', 'control'),
  effect('cas_allotment', 'Permanent CAS allotment', 'control'), effect('escort_wing', 'Escort wing', 'control'),
  effect('deny_enemy_cas', 'Deny enemy CAS', 'control'), effect('carrier_slot', 'Carrier slot', 'control'),
  effect('coastal_cover', 'Coastal-battery cover', 'control'), effect('early_warning', 'Early-warning net', 'control'),
  effect('no_fly_zone', 'Base no-fly zone', 'control'), effect('submarine_picket', 'Submarine picket', 'control'),
  effect('doctrine_node', 'Doctrine-tree node', 'doctrine'), effect('vehicle_retrofit', 'Permanent vehicle retrofit', 'doctrine'),
  effect('reveal_manifest', 'Reveal enemy manifest', 'doctrine'), effect('nemesis_file', 'Nemesis file', 'doctrine'),
  effect('opening_fog_lift', 'Opening fog lift', 'doctrine'), effect('radio_intercept', 'Live radio intercept', 'doctrine'),
  effect('see_enemy_books', 'Permanent sight of enemy books', 'doctrine'), effect('veteran_recovery', 'Veteran recovery', 'doctrine'),
  effect('commendation', 'Command commendation', 'doctrine'), effect('courier_headline', 'Courier headline', 'doctrine'),
];

export const COMBINED_ARMS_SIGNATURES: CombinedArmsSignature[] = [
  {
    id: 'beachhead', name: 'The Beachhead', verb: 'amphibious_assault', domains: ['sea', 'land'],
    sites: ['port', 'coastal_battery', 'river_crossing'], authorizedSupport: ['none', 'cas'], recommendedCost: 7,
    phases: [phase('escort', 'Land the armor', 'sea'), phase('capture', 'Take the shore strongpoint', 'land')],
  },
  {
    id: 'hammer', name: 'The Hammer', verb: 'air_superiority', domains: ['air', 'land'],
    sites: ['front_line', 'strongpoint', 'mountain_pass'], authorizedSupport: ['none', 'artillery'], recommendedCost: 8,
    phases: [phase('eliminate', 'Win air superiority', 'air', undefined, 4), phase('capture', 'Drive the Spearhead', 'land')],
  },
  {
    id: 'choke', name: 'The Choke', verb: 'blockade', domains: ['sea', 'air'],
    sites: ['port', 'carrier_anchorage', 'coastal_battery'], authorizedSupport: ['none', 'cas'], recommendedCost: 6,
    phases: [phase('hold', 'Seal the channel', 'sea', 120), phase('defend', 'Hold the sky above it', 'air', 120)],
  },
  {
    id: 'anvil_drop', name: 'The Anvil Drop', verb: 'airborne_insertion', domains: ['air', 'land'],
    sites: ['front_line', 'strongpoint', 'airfield', 'mountain_pass'], authorizedSupport: ['none', 'artillery'], recommendedCost: 8,
    phases: [phase('arrive', 'Land behind the line', 'air'), phase('hold', 'Hold the landing zone', 'air', 75), phase('capture', 'Close the pincer', 'land')],
  },
];

export interface GenerateOperationInput {
  seed: number;
  frontId: string;
  frontName?: string;
  pass: 1 | 2 | 3;
  signatureId?: CombinedArmsSignature['id'];
}

export interface OperationPlan {
  id: string;
  seed: number;
  frontId: string;
  pass: 1 | 2 | 3;
  scale: OperationScale;
  verb: OperationVerbId;
  domains: OperationDomain[];
  site: OperationSiteId;
  complication: OperationComplicationId;
  effect: OperationEffectId;
  codename: string;
  briefing: string;
  phases: OperationPhase[];
  launchCost: number;
  requirements: Partial<Record<OperationDomain, number>>;
  authorizedSupport: OperationSupport[];
  recommendedCost: number;
}

const CODENAME_A = ['AMBER', 'ANVIL', 'BRASS', 'EMBER', 'FROST', 'IRON', 'KESTREL', 'LANCE', 'PIKE', 'RAVEN'];
const CODENAME_B = ['BRIDGE', 'CROWN', 'GATE', 'HAMMER', 'LATCH', 'SHIELD', 'SPEAR', 'STORM', 'TIDE', 'WATCH'];

const verbById = (id: OperationVerbId) => OPERATION_VERBS.find((entry) => entry.id === id)!;
const siteById = (id: OperationSiteId) => OPERATION_SITES.find((entry) => entry.id === id)!;
const complicationById = (id: OperationComplicationId) => OPERATION_COMPLICATIONS.find((entry) => entry.id === id)!;

export function generateOperation(input: GenerateOperationInput): OperationPlan {
  const seed = input.seed >>> 0;
  const rng = new Rng(seed ^ ((input.pass * 0x9e3779b9) >>> 0));
  const scale: OperationScale = input.pass === 1 ? 'skirmish' : input.pass === 2 ? 'standard' : 'large';
  const signature = input.pass === 1 ? undefined
    : input.signatureId
      ? COMBINED_ARMS_SIGNATURES.find((entry) => entry.id === input.signatureId)
      : rng.pick(COMBINED_ARMS_SIGNATURES);
  if (input.signatureId && !signature) throw new Error(`Unknown combined-arms signature '${input.signatureId}'.`);

  const verb = signature ? verbById(signature.verb) : rng.pick(OPERATION_VERBS);
  const domains = signature ? [...signature.domains] : [verb.domain];
  const site = rng.pick(signature?.sites ?? verb.sites);
  const complication = rng.pick(OPERATION_COMPLICATIONS).id;
  const effects = OPERATION_EFFECTS.filter((entry) => input.pass === 1
    ? entry.category === 'territory' || entry.category === 'materiel'
    : input.pass === 2 ? entry.category !== 'doctrine' : true);
  const chosenEffect = rng.pick(effects).id;
  const codename = `${rng.pick(CODENAME_A)} ${rng.pick(CODENAME_B)}`;
  const templates = signature?.phases ?? verb.phases;
  const phases = templates.map((entry, index): OperationPhase => ({ ...entry, id: `${verb.id}:${index + 1}` }));
  const requirements = Object.fromEntries(domains.map((domain) => [domain, 1])) as Partial<Record<OperationDomain, number>>;
  const frontName = input.frontName?.trim() || input.frontId.replaceAll('_', ' ');
  const support = signature?.authorizedSupport ?? [
    'none',
    ...(verb.domain === 'land' ? ['artillery' as const] : []),
    ...(verb.domain === 'air' && complication !== 'air_cover_denied' ? ['cas' as const] : []),
  ];
  const recommendedCost = signature?.recommendedCost ?? 4;
  return {
    id: `${input.frontId}:p${input.pass}:${seed}`,
    seed, frontId: input.frontId, pass: input.pass, scale, verb: verb.id, domains, site,
    complication, effect: chosenEffect, codename,
    briefing: `${verb.name} the ${siteById(site).name} at ${frontName} — ${complicationById(complication).briefing}.`,
    phases, launchCost: input.pass * 2, requirements, authorizedSupport: support,
    recommendedCost,
  };
}

export interface OperationHull {
  id: string;
  kind: VehicleKind;
  name: string;
  status: 'available' | 'reserved' | 'lost';
}

export interface OperationManifest {
  hullIds: string[];
  ammunition: number;
  support: OperationSupport;
}

export interface OperationBattleBonuses {
  openingMateriel: number;
  enemyMaterielPenalty: number;
  requisitionDiscount: number;
  denyEnemyAir: boolean;
  earlyWarningSeconds: number;
  fogLiftSeconds: number;
  forwardSpawn: boolean;
  repairPad: boolean;
  rearmPad: boolean;
  bridgeAccess: boolean;
  samCover: boolean;
  cas: boolean;
  escortWing: boolean;
  artillery: number;
  hazards: number;
  coastalCover: boolean;
}

export const LAND_KINDS: ReadonlySet<VehicleKind> = new Set(['buggy', 'tank', 'apc', 'bike', 'aatrack', 'transport', 'ambulance', 'tunneler', 'emplacement', 'mech']);
export const AIR_KINDS: ReadonlySet<VehicleKind> = new Set(['flyer', 'strikejet', 'interceptor', 'bomber']);
export const SEA_KINDS: ReadonlySet<VehicleKind> = new Set(['boat']);
const DOMAIN_KINDS: Record<OperationDomain, ReadonlySet<VehicleKind>> = { land: LAND_KINDS, air: AIR_KINDS, sea: SEA_KINDS };

export function manifestCost(manifest: OperationManifest, inventory: readonly OperationHull[]): number {
  const byId = new Map(inventory.map((hull) => [hull.id, hull]));
  const hullCost = [...new Set(manifest.hullIds)].reduce((sum, id) => {
    const hull = byId.get(id);
    return sum + (hull ? (VEHICLES[hull.kind].cost ?? 1) : 0);
  }, 0);
  const ammoCost = Math.ceil(Math.max(0, manifest.ammunition) / 2);
  const supportCost = manifest.support === 'none' ? 0 : 3;
  return hullCost + ammoCost + supportCost;
}

export function commitmentFor(plan: OperationPlan, manifest: OperationManifest, inventory: readonly OperationHull[]): Commitment {
  const ratio = manifestCost(manifest, inventory) / Math.max(1, plan.recommendedCost);
  return ratio <= 1.15 ? 'light' : ratio <= 2 ? 'balanced' : 'heavy';
}

export interface ManifestValidation {
  ok: boolean;
  errors: string[];
  cost: number;
  commitment: Commitment;
}

export function validateManifest(plan: OperationPlan, manifest: OperationManifest, inventory: readonly OperationHull[]): ManifestValidation {
  const errors: string[] = [];
  const byId = new Map(inventory.map((hull) => [hull.id, hull]));
  const seen = new Set<string>();
  const selected: OperationHull[] = [];
  for (const id of manifest.hullIds) {
    if (seen.has(id)) {
      errors.push(`Manifest contains duplicate hull ${id}.`);
      continue;
    }
    seen.add(id);
    const hull = byId.get(id);
    if (!hull) {
      errors.push(`Unknown hull ${id}.`);
      continue;
    }
    if (hull.status !== 'available') {
      errors.push(`${hull.name} is not available.`);
      continue;
    }
    selected.push(hull);
  }
  for (const domain of plan.domains) {
    const required = plan.requirements[domain] ?? 0;
    const actual = selected.filter((hull) => DOMAIN_KINDS[domain].has(hull.kind)).length;
    if (actual < required) errors.push(`${domain.toUpperCase()} commitment requires at least ${required} hull.`);
  }
  if (!Number.isInteger(manifest.ammunition) || manifest.ammunition < 1) {
    errors.push('Commit at least 1 ammunition allotment.');
  }
  if (!plan.authorizedSupport.includes(manifest.support)) {
    const name = manifest.support === 'cas' ? 'Close Air Support' : 'artillery support';
    errors.push(`This Operation does not authorize ${name}.`);
  }
  return {
    ok: errors.length === 0,
    errors,
    cost: manifestCost(manifest, inventory),
    commitment: commitmentFor(plan, manifest, inventory),
  };
}
