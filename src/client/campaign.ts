import type { ModeId, ThemeId, VehicleKind } from '../sim/types';
import { scienceReward } from '../sim/science';
import type { ScienceMissionResult } from '../sim/science-runtime';
import {
  OPERATION_EFFECTS,
  validateManifest,
  type OperationEffectId,
  type OperationHull,
  type OperationManifest,
  type OperationPlan,
  type OperationBattleBonuses,
} from '../sim/operations';
import type { OperationResult } from '../sim/operation-runtime';

// ---------------------------------------------------------------------------
// The Living Campaign v1 (DD §8.5) — the Scar goes live. Ten named fronts,
// each mapped to an EXISTING generator recipe; a local campaign file whose
// control values move with match results (22B: banded, mode- and importance-
// weighted); scars as match modifiers; and the 27B honest offline time-skip.
// ---------------------------------------------------------------------------

export interface FrontDef {
  id: string;
  name: string;
  theme: ThemeId;
  mode: ModeId;
  /** how hard a result here moves the war (22B weight) */
  importance: number;
  /** the front's signature scar, active while a faction holds it DEEP */
  scar: 'fire' | 'rubble' | 'frozen' | 'flooded' | 'blocked';
}

/** The ten fronts of DD §8.2, on recipes that exist today (§8.5 v1 table). */
export const FRONTS: FrontDef[] = [
  { id: 'bridge_delta', name: 'Bridge Delta', theme: 'savanna', mode: 'ctf', importance: 1.2, scar: 'flooded' },
  // titan, not starship: the fort is a hilltop colony strongpoint now that
  // its ground is authored (§8.2) — trench rings on deck plate read as a bug
  { id: 'fort_raven', name: 'Fort Raven', theme: 'titan', mode: 'koth', importance: 1.1, scar: 'rubble' },
  { id: 'eastern_plains', name: 'Eastern Plains', theme: 'savanna', mode: 'conquest', importance: 1.0, scar: 'fire' },
  { id: 'the_city', name: 'The City', theme: 'savanna', mode: 'tdm', importance: 1.0, scar: 'rubble' },
  { id: 'highland_pass', name: 'Highland Pass', theme: 'asteroid', mode: 'ctf', importance: 0.9, scar: 'blocked' },
  { id: 'blacksite', name: 'Blacksite', theme: 'triton', mode: 'tdm', importance: 0.9, scar: 'frozen' },
  { id: 'refinery', name: 'Refinery', theme: 'starship', mode: 'conquest', importance: 1.1, scar: 'fire' },
  { id: 'the_port', name: 'The Port', theme: 'europa', mode: 'ctf', importance: 1.0, scar: 'flooded' },
  { id: 'airbase', name: 'Airbase', theme: 'savanna', mode: 'conquest', importance: 1.3, scar: 'blocked' },
  { id: 'the_mine', name: 'The Mine', theme: 'asteroid', mode: 'tdm', importance: 0.9, scar: 'rubble' },
];

/** 22B mode weights: objective wins move the war harder than skirmishes. */
const MODE_WEIGHT: Partial<Record<ModeId, number>> = { conquest: 1.25, ctf: 1.1, koth: 1.0, tdm: 0.8 };
const BASE_SHIFT = 8;
/** 22B bands on −100..+100: |control| < 34 is contested ground. */
export const BAND_EDGE = 34;
/** holding DEEP (|control| ≥ 67) is what scars a front */
export const SCAR_EDGE = 67;

export type Band = 'coalition' | 'contested' | 'collective';
export const bandOf = (control: number): Band =>
  control >= BAND_EDGE ? 'coalition' : control <= -BAND_EDGE ? 'collective' : 'contested';

export interface FrontState {
  control: number; scarActive: boolean; lastBattleAt: number;
  /** W3.3 CLONES ARE THE CURRENCY: the front's reprint reserve. Your side's
   *  deaths in a battle here SPEND it; a win convoys some back; at ZERO the
   *  front is LOST outright — no bodies left to hold the line. */
  clones: number;
  /** W3.4 PASS ESCALATION: how deep the war has dug in here. P1 = no gods,
   *  P2 = the enemy stable wakes, P3 = both stables loose. Advances one
   *  pass per battle fought on the front; the armistice resets it. */
  pass: 1 | 2 | 3;
  /** Two science sorties are available for each escalation pass. */
  scienceWindows: number;
  scienceWindowPass: 1 | 2 | 3;
  /** Reward counters with direct campaign meaning, displayed in the Scar UI. */
  enemyClonePressure: number;
  cloneInsurance: number;
}

export interface MotorPoolHull extends OperationHull {
  sorties: number;
  killsByKind: Partial<Record<VehicleKind, number>>;
  reservedFor?: string;
  lostAt?: number;
}

export interface OperationWindow {
  frontId: string;
  pass: 1 | 2 | 3;
  consumed: boolean;
  operationId?: string;
}

export interface CampaignModifier {
  id: OperationEffectId;
  scope: 'season' | 'front' | 'next_battle';
  uses: number;
  value: number;
  frontId?: string;
}

export interface ActiveCampaignOperation {
  plan: OperationPlan;
  manifest: OperationManifest;
  charged: number;
  stagedAt: number;
}

export interface SettlementReceipt {
  ok: boolean;
  duplicate: boolean;
  operationId: string;
  won: boolean;
  effect?: OperationEffectId;
  treasuryDelta: number;
  hullsLost: string[];
  hullsReturned: string[];
  errors: string[];
}

export interface OperationHistoryEntry {
  operationId: string;
  won: boolean;
  effect: OperationEffectId;
  settledAt: number;
  receipt: SettlementReceipt | null;
}

export interface FiscalEfficiency {
  sorties: number;
  cleanSheets: number;
  materielSpent: number;
  hullsLost: number;
  totalScore: number;
}

/** W3.3: a front's starting reserve scales with its importance. */
export const CLONE_SEED = 400;
export const cloneSeedFor = (f: FrontDef) => Math.round(CLONE_SEED * f.importance);
/** a won battle convoys replacements in (never past the seed) */
export const CLONE_RECOVER = 60;
export const SCIENCE_WINDOWS_PER_PASS = 2;
export const GHOST_CLONE_BONUS = 10;
export type ScienceCloneLossPolicy = 'spent-permanent' | 'retry-next-window';
export const DEFAULT_SCIENCE_CLONE_LOSS_POLICY: ScienceCloneLossPolicy = 'spent-permanent';

export interface ScienceBonuses {
  theaterClones: number;
  morale: number;
  openingMateriel: number;
  requisitionDiscounts: number;
  enemyReinforcementCuts: number;
  weatherPicks: number;
  rosterIntel: number;
  lswAssignments: number;
}

const freshScienceBonuses = (): ScienceBonuses => ({
  theaterClones: 0,
  morale: 0,
  openingMateriel: 0,
  requisitionDiscounts: 0,
  enemyReinforcementCuts: 0,
  weatherPicks: 0,
  rosterIntel: 0,
  lswAssignments: 0,
});

export interface Campaign {
  v: 2;
  season: number;
  updatedAt: number;
  fronts: Record<string, FrontState>;
  /** the Morning Dispatch: latest campaign lines, newest first */
  dispatch: { text: string; at: number; simulated: boolean }[];
  scienceBonuses: ScienceBonuses;
  /** Idempotency ledger: a browser retry may report the same sortie once. */
  appliedScienceMissionIds: string[];
  treasury: number;
  motorPool: MotorPoolHull[];
  facilities: OperationEffectId[];
  modifiers: CampaignModifier[];
  operationWindows: Record<string, OperationWindow>;
  activeOperation: ActiveCampaignOperation | null;
  operationHistory: OperationHistoryEntry[];
  doctrine: string[];
  intel: string[];
  fiscalEfficiency: FiscalEfficiency;
}

const LS_KEY = 'ww_campaign';

export const OPERATION_TREASURY_SEED = 100;
export const MOTOR_POOL_SEED = {
  tank: 4, apc: 4, buggy: 6, bike: 6, mech: 2, tunneler: 2, emplacement: 4,
  aatrack: 3, transport: 3, ambulance: 3,
  strikejet: 3, interceptor: 3, bomber: 2, flyer: 3, boat: 4,
  attackheli: 2, transportheli: 2, submarine: 2,
} as const satisfies Partial<Record<VehicleKind, number>>;

const HULL_CALLSIGNS = ['Aegis', 'Bastion', 'Cinder', 'Dauntless', 'Ember', 'Fury', 'Gauntlet', 'Harrier'];

export function freshMotorPool(): MotorPoolHull[] {
  const pool: MotorPoolHull[] = [];
  let serial = 0;
  for (const [kind, count] of Object.entries(MOTOR_POOL_SEED) as [keyof typeof MOTOR_POOL_SEED, number][]) {
    for (let i = 0; i < count; i++) {
      const registry = serial++;
      pool.push({
        id: `${kind}-${String(i + 1).padStart(2, '0')}`,
        kind,
        name: `${HULL_CALLSIGNS[registry % HULL_CALLSIGNS.length]} ${String(registry + 1).padStart(2, '0')}`,
        status: 'available',
        sorties: 0,
        killsByKind: {},
      });
    }
  }
  return pool;
}

export const operationWindowKey = (frontId: string, pass: 1 | 2 | 3) => `${frontId}:p${pass}`;

export function freshOperationWindows(): Record<string, OperationWindow> {
  const windows: Record<string, OperationWindow> = {};
  for (const front of FRONTS) for (const pass of [1, 2, 3] as const) {
    windows[operationWindowKey(front.id, pass)] = { frontId: front.id, pass, consumed: false };
  }
  return windows;
}

export function freshCampaign(now = Date.now()): Campaign {
  const fronts: Record<string, FrontState> = {};
  for (const f of FRONTS) fronts[f.id] = {
    control: 0, scarActive: false, lastBattleAt: 0, clones: cloneSeedFor(f), pass: 1,
    scienceWindows: SCIENCE_WINDOWS_PER_PASS, scienceWindowPass: 1,
    enemyClonePressure: 0, cloneInsurance: 0,
  };
  return {
    v: 2, season: 1, updatedAt: now, fronts, dispatch: [],
    scienceBonuses: freshScienceBonuses(), appliedScienceMissionIds: [],
    treasury: OPERATION_TREASURY_SEED,
    motorPool: freshMotorPool(),
    facilities: [], modifiers: [], operationWindows: freshOperationWindows(),
    activeOperation: null, operationHistory: [], doctrine: [], intel: [],
    fiscalEfficiency: { sorties: 0, cleanSheets: 0, materielSpent: 0, hullsLost: 0, totalScore: 0 },
  };
}

/** Upgrade v1 and repair partial v2 saves without discarding the living war. */
export function migrateCampaign(raw: unknown, now = Date.now()): Campaign {
  const source = raw && typeof raw === 'object'
    ? raw as Partial<Omit<Campaign, 'v'>> & { v?: number }
    : null;
  const campaign = freshCampaign(now);
  if (!source || (source.v !== 1 && source.v !== 2)) return campaign;
  if (typeof source.season === 'number') campaign.season = source.season;
  if (typeof source.updatedAt === 'number') campaign.updatedAt = source.updatedAt;
  if (Array.isArray(source.dispatch)) campaign.dispatch = source.dispatch.slice(0, 60);
  if (source.fronts && typeof source.fronts === 'object') {
    for (const front of FRONTS) {
      const saved = source.fronts[front.id] as Partial<FrontState> | undefined;
      if (!saved) continue;
      campaign.fronts[front.id] = {
        control: typeof saved.control === 'number' ? saved.control : 0,
        scarActive: saved.scarActive === true,
        lastBattleAt: typeof saved.lastBattleAt === 'number' ? saved.lastBattleAt : 0,
        clones: typeof saved.clones === 'number' ? saved.clones : cloneSeedFor(front),
        pass: saved.pass === 2 || saved.pass === 3 ? saved.pass : 1,
        scienceWindows: typeof saved.scienceWindows === 'number' ? saved.scienceWindows : SCIENCE_WINDOWS_PER_PASS,
        scienceWindowPass: saved.scienceWindowPass === 2 || saved.scienceWindowPass === 3
          ? saved.scienceWindowPass : saved.pass === 2 || saved.pass === 3 ? saved.pass : 1,
        enemyClonePressure: typeof saved.enemyClonePressure === 'number' ? saved.enemyClonePressure : 0,
        cloneInsurance: typeof saved.cloneInsurance === 'number' ? saved.cloneInsurance : 0,
      };
    }
  }
  if (source.scienceBonuses && typeof source.scienceBonuses === 'object') {
    campaign.scienceBonuses = { ...freshScienceBonuses(), ...source.scienceBonuses };
  }
  if (Array.isArray(source.appliedScienceMissionIds)) {
    campaign.appliedScienceMissionIds = source.appliedScienceMissionIds.filter((id): id is string => typeof id === 'string').slice(0, 80);
  }
  if (source.v === 2) {
    if (typeof source.treasury === 'number') campaign.treasury = source.treasury;
    if (Array.isArray(source.motorPool) && source.motorPool.length > 0) {
      const savedPool = source.motorPool;
      const savedIds = new Set(savedPool.map((hull) => hull.id));
      campaign.motorPool = [...savedPool, ...freshMotorPool().filter((hull) => !savedIds.has(hull.id))];
    }
    if (Array.isArray(source.facilities)) campaign.facilities = [...source.facilities];
    if (Array.isArray(source.modifiers)) campaign.modifiers = [...source.modifiers];
    if (source.operationWindows && typeof source.operationWindows === 'object') {
      for (const [key, window] of Object.entries(source.operationWindows)) {
        if (window && typeof window === 'object') campaign.operationWindows[key] = { ...window };
      }
    }
    campaign.activeOperation = source.activeOperation ?? null;
    if (Array.isArray(source.operationHistory)) campaign.operationHistory = [...source.operationHistory];
    if (Array.isArray(source.doctrine)) campaign.doctrine = [...source.doctrine];
    if (Array.isArray(source.intel)) campaign.intel = [...source.intel];
    if (source.fiscalEfficiency) campaign.fiscalEfficiency = { ...campaign.fiscalEfficiency, ...source.fiscalEfficiency };
  }
  return campaign;
}

export function loadCampaign(now = Date.now()): Campaign {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return migrateCampaign(JSON.parse(raw), now);
  } catch { /* fresh theatre */ }
  return freshCampaign(now);
}

export function saveCampaign(c: Campaign) {
  c.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch { /* storage full — the war plays on */ }
}

function refreshScienceWindows(state: FrontState, pass: 1 | 2 | 3): void {
  if (state.scienceWindowPass === pass) return;
  state.scienceWindowPass = pass;
  state.scienceWindows = SCIENCE_WINDOWS_PER_PASS;
}

export function scienceWindowsFor(campaign: Campaign, frontId: string, pass?: 1 | 2 | 3): number {
  const state = campaign.fronts[frontId];
  if (!state) return 0;
  refreshScienceWindows(state, pass ?? state.pass);
  return state.scienceWindows;
}

/** Reserve one sortie window. Launch flow calls this before constructing World. */
export function spendScienceWindow(campaign: Campaign, frontId: string, pass?: 1 | 2 | 3): boolean {
  const state = campaign.fronts[frontId];
  if (!state) return false;
  const activePass = pass ?? state.pass;
  refreshScienceWindows(state, activePass);
  if (state.scienceWindows <= 0) return false;
  state.scienceWindows--;
  return true;
}

/** Fold a science sortie into the same numbers the Scar and battle setup read. */
export function applyScienceResult(
  campaign: Campaign,
  frontId: string,
  result: ScienceMissionResult,
  now = Date.now(),
  cloneLossPolicy: ScienceCloneLossPolicy = DEFAULT_SCIENCE_CLONE_LOSS_POLICY,
): boolean {
  const state = campaign.fronts[frontId];
  const front = FRONTS.find((candidate) => candidate.id === frontId);
  if (!state || !front || campaign.appliedScienceMissionIds.includes(result.id)) return false;
  campaign.appliedScienceMissionIds.unshift(result.id);
  if (campaign.appliedScienceMissionIds.length > 80) campaign.appliedScienceMissionIds.length = 80;

  const clonesBefore = state.clones;
  const burnsFailedSquad = result.won || cloneLossPolicy === 'spent-permanent';
  if (burnsFailedSquad) state.clones = Math.max(0, state.clones - Math.max(0, Math.floor(result.clonesSpent)));
  const lines = [`SCIENCE ${result.id}: ${result.won ? 'operation complete' : 'operation failed'} at ${front.name}; ${result.clonesSpent} clone${result.clonesSpent === 1 ? '' : 's'} spent.`];
  if (!result.won && cloneLossPolicy === 'retry-next-window') {
    lines.push(`SCIENCE ${result.id}: failed squad allocation restored; the sortie window remains spent.`);
  }
  if (result.ghost) {
    state.clones = Math.min(cloneSeedFor(front) + 80, state.clones + GHOST_CLONE_BONUS);
    lines.push(`SCIENCE ${result.id}: GHOST EXTRACTION — ${GHOST_CLONE_BONUS} clean sleeves recovered.`);
  }

  if (result.won) {
    switch (result.reward) {
      case 'front-reinforcement':
        state.clones = Math.min(cloneSeedFor(front) + 80, state.clones + 40);
        break;
      case 'theater-reinforcement': campaign.scienceBonuses.theaterClones += 25; break;
      case 'enemy-clone-drain': state.enemyClonePressure += 30; break;
      case 'clone-insurance': state.cloneInsurance += 1; break;
      case 'front-breakthrough': state.control = Math.min(100, state.control + 6); break;
      case 'morale-cache': campaign.scienceBonuses.morale += 1; break;
      case 'opening-materiel': campaign.scienceBonuses.openingMateriel += 2; break;
      case 'requisition-discount': campaign.scienceBonuses.requisitionDiscounts += 1; break;
      case 'deny-reinforcements': campaign.scienceBonuses.enemyReinforcementCuts += 1; break;
      case 'weather-pick': campaign.scienceBonuses.weatherPicks += 1; break;
      case 'roster-intel': campaign.scienceBonuses.rosterIntel += 1; break;
      case 'lsw-assignment': campaign.scienceBonuses.lswAssignments += 1; break;
    }
    lines.push(`SCIENCE ${result.id}: reward secured — ${scienceReward(result.reward).label}.`);
  }
  if (state.clones === 0 && clonesBefore > 0) {
    state.control = -100;
    lines.push(`SCIENCE ${result.id}: ${front.name} ran DRY during the operation — the front is lost.`);
  }
  state.lastBattleAt = now;
  for (const text of lines) campaign.dispatch.unshift({ text, at: now, simulated: false });
  if (campaign.dispatch.length > 60) campaign.dispatch.length = 60;
  return true;
}

export interface StageOperationResult {
  ok: boolean;
  errors: string[];
  charged: number;
}

export function stageCampaignOperation(
  campaign: Campaign,
  plan: OperationPlan,
  manifest: OperationManifest,
  now = Date.now(),
): StageOperationResult {
  const errors: string[] = [];
  const front = FRONTS.find((entry) => entry.id === plan.frontId);
  const state = campaign.fronts[plan.frontId];
  const window = campaign.operationWindows[operationWindowKey(plan.frontId, plan.pass)];
  if (!front || !state || !window) errors.push('This Operation points at an unknown front.');
  else {
    if (state.pass !== plan.pass) errors.push(`${front.name} is currently at Pass ${state.pass}, not Pass ${plan.pass}.`);
    if (window.consumed) errors.push(`The Pass ${plan.pass} Operation window at ${front.name} is already spent.`);
  }
  if (campaign.activeOperation) errors.push(`Operation ${campaign.activeOperation.plan.codename} is already staged.`);
  const validation = validateManifest(plan, manifest, campaign.motorPool);
  errors.push(...validation.errors);
  const charged = plan.launchCost + validation.cost;
  if (campaign.treasury < charged) errors.push('National treasury cannot fund this Operation.');
  if (errors.length > 0) return { ok: false, errors, charged };

  campaign.treasury -= charged;
  for (const id of manifest.hullIds) {
    const hull = campaign.motorPool.find((entry) => entry.id === id)!;
    hull.status = 'reserved';
    hull.reservedFor = plan.id;
  }
  campaign.activeOperation = {
    plan: structuredClone(plan),
    manifest: structuredClone(manifest),
    charged,
    stagedAt: now,
  };
  campaign.dispatch.unshift({ text: `Operation ${plan.codename} staged at ${front!.name} — treasury committed ${charged}.`, at: now, simulated: false });
  if (campaign.dispatch.length > 60) campaign.dispatch.length = 60;
  return { ok: true, errors: [], charged };
}

export function cancelCampaignOperation(campaign: Campaign, operationId: string, now = Date.now()): boolean {
  const active = campaign.activeOperation;
  if (!active || active.plan.id !== operationId) return false;
  campaign.treasury += active.charged;
  for (const hull of campaign.motorPool) {
    if (hull.reservedFor !== operationId) continue;
    hull.status = 'available';
    delete hull.reservedFor;
  }
  campaign.activeOperation = null;
  campaign.dispatch.unshift({ text: `Operation ${active.plan.codename} canceled — ${active.charged} returned to treasury.`, at: now, simulated: false });
  if (campaign.dispatch.length > 60) campaign.dispatch.length = 60;
  return true;
}

function addModifier(campaign: Campaign, id: OperationEffectId, scope: CampaignModifier['scope'], value: number, frontId?: string) {
  const existing = campaign.modifiers.find((modifier) => modifier.id === id && modifier.scope === scope && modifier.frontId === frontId);
  if (existing) {
    if (existing.uses >= 0) existing.uses++;
    existing.value += value;
  } else {
    campaign.modifiers.push({ id, scope, uses: scope === 'season' ? -1 : 1, value, ...(frontId ? { frontId } : {}) });
  }
}

function pushUnique(list: string[], value: string) {
  if (!list.includes(value)) list.push(value);
}

function moveFront(campaign: Campaign, frontId: string, delta: number) {
  const front = campaign.fronts[frontId];
  if (front) front.control = Math.max(-100, Math.min(100, Math.round((front.control + delta) * 10) / 10));
}

/** Every reward has a mechanical destination. Flavor-only rewards are forbidden. */
export function applyOperationEffect(campaign: Campaign, plan: OperationPlan, _result: OperationResult, now = Date.now()) {
  const id = plan.effect;
  const definition = OPERATION_EFFECTS.find((effect) => effect.id === id)!;
  if (definition.category === 'facility') {
    if (!campaign.facilities.includes(id)) campaign.facilities.push(id);
  } else {
    switch (id) {
      case 'take_sector': moveFront(campaign, plan.frontId, 12); break;
      case 'push_front': moveFront(campaign, plan.frontId, 8); break;
      case 'open_supply_route': addModifier(campaign, id, 'front', 1, plan.frontId); break;
      case 'deny_supply_route': addModifier(campaign, id, 'front', -1, plan.frontId); break;
      case 'seize_high_ground': addModifier(campaign, id, 'season', 1, plan.frontId); break;
      case 'hold_chokepoint': addModifier(campaign, id, 'front', 1, plan.frontId); break;
      case 'split_front': moveFront(campaign, plan.frontId, 10); addModifier(campaign, id, 'season', 1, plan.frontId); break;
      case 'flip_city': moveFront(campaign, plan.frontId, 15); break;
      case 'forward_base': addModifier(campaign, id, 'season', 1, plan.frontId); break;
      case 'claim_midfield': addModifier(campaign, id, 'next_battle', 1, plan.frontId); break;
      case 'war_chest': campaign.treasury += 20; break;
      case 'steal_opening_purse': addModifier(campaign, id, 'next_battle', 3, plan.frontId); break;
      case 'cheaper_requisition': addModifier(campaign, id, 'season', 0.2); break;
      case 'artillery_barrage': addModifier(campaign, id, 'next_battle', 1, plan.frontId); break;
      case 'preplaced_hazards': addModifier(campaign, id, 'next_battle', 3, plan.frontId); break;
      case 'rearm_pads': addModifier(campaign, id, 'season', 1, plan.frontId); break;
      case 'captured_vehicle': {
        const sequence = campaign.motorPool.filter((hull) => hull.kind === 'buggy').length + 1;
        campaign.motorPool.push({
          id: `captured-buggy-s${campaign.season}-${sequence}`,
          kind: 'buggy', name: `Prize ${String(sequence).padStart(2, '0')}`,
          status: 'available', sorties: 0, killsByKind: {},
        });
        break;
      }
      case 'ground_enemy_air': addModifier(campaign, id, 'next_battle', 1, plan.frontId); break;
      case 'sink_convoy': addModifier(campaign, id, 'front', -3, plan.frontId); break;
      case 'fiscal_efficiency': campaign.fiscalEfficiency.totalScore += 10; break;
      case 'air_superiority_control': case 'sea_control': case 'cas_allotment': case 'escort_wing':
      case 'deny_enemy_cas': case 'carrier_slot': case 'coastal_cover': case 'early_warning':
      case 'no_fly_zone': case 'submarine_picket':
        addModifier(campaign, id, 'season', 1, plan.frontId); break;
      case 'doctrine_node': case 'vehicle_retrofit':
        pushUnique(campaign.doctrine, id); break;
      case 'reveal_manifest': case 'nemesis_file': case 'opening_fog_lift': case 'radio_intercept': case 'see_enemy_books':
        pushUnique(campaign.intel, id); break;
      case 'veteran_recovery': addModifier(campaign, id, 'season', 1); break;
      case 'commendation': campaign.fiscalEfficiency.totalScore += 5; break;
      case 'courier_headline': addModifier(campaign, id, 'next_battle', 1, plan.frontId); break;
      case 'capture_airfield': case 'capture_port': case 'capture_fuel_farm': case 'capture_rail_hub': case 'capture_forge':
      case 'capture_clone_hub': case 'capture_radar': case 'capture_sam': case 'capture_repair_depot': case 'capture_bridge':
        break; // handled by the facility category above
    }
  }
  campaign.dispatch.unshift({ text: `Operation ${plan.codename} effect secured: ${definition.name}.`, at: now, simulated: false });
  if (campaign.dispatch.length > 60) campaign.dispatch.length = 60;
}

export function settleCampaignOperation(campaign: Campaign, result: OperationResult, now = Date.now()): SettlementReceipt {
  const previous = campaign.operationHistory.find((entry) => entry.operationId === result.operationId);
  if (previous) {
    return previous.receipt
      ? { ...previous.receipt, duplicate: true }
      : { ok: true, duplicate: true, operationId: result.operationId, won: previous.won, effect: previous.effect, treasuryDelta: 0, hullsLost: [], hullsReturned: [], errors: [] };
  }
  const active = campaign.activeOperation;
  if (!active || active.plan.id !== result.operationId) {
    return { ok: false, duplicate: false, operationId: result.operationId, won: result.won, treasuryDelta: 0, hullsLost: [], hullsReturned: [], errors: ['No matching staged Operation.'] };
  }
  const treasuryBefore = campaign.treasury;
  const window = campaign.operationWindows[operationWindowKey(active.plan.frontId, active.plan.pass)];
  if (window) {
    window.consumed = true;
    window.operationId = active.plan.id;
  }
  const lost = new Set(result.destroyedHullIds);
  const returned: string[] = [];
  for (const id of active.manifest.hullIds) {
    const hull = campaign.motorPool.find((entry) => entry.id === id);
    if (!hull) continue;
    hull.sorties++;
    delete hull.reservedFor;
    if (lost.has(id)) {
      hull.status = 'lost';
      hull.lostAt = now;
    } else {
      hull.status = 'available';
      returned.push(id);
    }
    for (const [kind, count] of Object.entries(result.hullKills?.[id] ?? {}) as [VehicleKind, number][]) {
      hull.killsByKind[kind] = (hull.killsByKind[kind] ?? 0) + count;
    }
  }
  campaign.treasury = Math.max(0, campaign.treasury - result.collateral * 4);
  campaign.fiscalEfficiency.sorties++;
  campaign.fiscalEfficiency.materielSpent += active.charged;
  campaign.fiscalEfficiency.hullsLost += result.destroyedHullIds.length;
  if (result.cleanSheet && result.won) {
    campaign.fiscalEfficiency.cleanSheets++;
    campaign.fiscalEfficiency.totalScore += 5;
    campaign.treasury += 8;
  }
  campaign.fiscalEfficiency.totalScore += result.won
    ? Math.max(1, Math.round(30 / Math.max(1, active.charged + result.destroyedHullIds.length * 4)))
    : 0;
  if (result.won) applyOperationEffect(campaign, active.plan, result, now);
  applyResult(campaign, active.plan.frontId, result.won, now, 0);

  const receipt: SettlementReceipt = {
    ok: true, duplicate: false, operationId: result.operationId, won: result.won,
    ...(result.won ? { effect: active.plan.effect } : {}),
    treasuryDelta: campaign.treasury - treasuryBefore,
    hullsLost: [...result.destroyedHullIds], hullsReturned: returned, errors: [],
  };
  campaign.operationHistory.push({ operationId: result.operationId, won: result.won, effect: active.plan.effect, settledAt: now, receipt });
  campaign.activeOperation = null;
  return receipt;
}

export function operationBattleBonuses(campaign: Campaign, frontId: string): OperationBattleBonuses {
  const applies = (modifier: CampaignModifier) => !modifier.frontId || modifier.frontId === frontId;
  const modifiers = campaign.modifiers.filter(applies);
  const value = (id: OperationEffectId) => modifiers.filter((modifier) => modifier.id === id).reduce((sum, modifier) => sum + modifier.value, 0);
  const has = (id: OperationEffectId) => modifiers.some((modifier) => modifier.id === id);
  const facility = (id: OperationEffectId) => campaign.facilities.includes(id);
  return {
    openingMateriel: value('steal_opening_purse') + Math.max(0, value('open_supply_route'))
      + (facility('capture_fuel_farm') ? 2 : 0) + (has('courier_headline') ? 1 : 0),
    enemyMaterielPenalty: value('steal_opening_purse') + Math.max(0, -value('deny_supply_route'))
      + Math.max(0, -value('sink_convoy')) + (has('split_front') ? 1 : 0)
      + (has('submarine_picket') ? 1 : 0) + (campaign.intel.includes('see_enemy_books') ? 1 : 0),
    requisitionDiscount: Math.min(0.5, value('cheaper_requisition')
      + (facility('capture_fuel_farm') ? 0.15 : 0) + (facility('capture_forge') ? 0.1 : 0)
      + (campaign.doctrine.includes('doctrine_node') ? 0.05 : 0) + (campaign.doctrine.includes('vehicle_retrofit') ? 0.05 : 0)),
    denyEnemyAir: has('ground_enemy_air') || has('no_fly_zone') || has('air_superiority_control') || has('deny_enemy_cas'),
    earlyWarningSeconds: has('early_warning') || has('seize_high_ground') || has('submarine_picket')
      || facility('capture_radar') || campaign.intel.includes('reveal_manifest') || campaign.intel.includes('radio_intercept') ? 30 : 0,
    fogLiftSeconds: campaign.intel.includes('opening_fog_lift') || campaign.intel.includes('nemesis_file') ? 30 : 0,
    forwardSpawn: has('forward_base') || has('claim_midfield') || facility('capture_rail_hub'),
    repairPad: facility('capture_repair_depot') || has('veteran_recovery') || campaign.doctrine.includes('vehicle_retrofit'),
    rearmPad: has('rearm_pads'),
    bridgeAccess: facility('capture_bridge'),
    samCover: facility('capture_sam') || has('no_fly_zone'),
    cas: facility('capture_airfield') || has('cas_allotment') || has('carrier_slot'),
    escortWing: has('escort_wing') || has('carrier_slot'),
    artillery: Math.max(0, Math.round(value('artillery_barrage'))),
    hazards: Math.max(0, Math.round(value('preplaced_hazards'))) + (has('hold_chokepoint') ? 1 : 0),
    coastalCover: has('coastal_cover'),
    navalSupport: facility('capture_port') || has('sea_control') || has('carrier_slot') || has('submarine_picket'),
  };
}

export function consumeOperationBattleBonuses(campaign: Campaign, frontId: string) {
  for (let i = campaign.modifiers.length - 1; i >= 0; i--) {
    const modifier = campaign.modifiers[i];
    if (modifier.scope !== 'next_battle' || (modifier.frontId && modifier.frontId !== frontId)) continue;
    modifier.uses--;
    if (modifier.uses <= 0) campaign.modifiers.splice(i, 1);
  }
}

/** Fold one battle into the war (22B). `deaths` is YOUR side's body count —
 *  W3.3 spends it from the front's clone reserve. Returns the dispatch lines. */
export function applyResult(c: Campaign, frontId: string, won: boolean | null, now = Date.now(), deaths = 0): string[] {
  const def = FRONTS.find((f) => f.id === frontId);
  const st = c.fronts[frontId];
  if (!def || !st || won === null) return [];
  const before = bandOf(st.control);
  const shift = BASE_SHIFT * (MODE_WEIGHT[def.mode] ?? 1) * def.importance * (won ? 1 : -1);
  st.control = Math.max(-100, Math.min(100, Math.round((st.control + shift) * 10) / 10));
  st.lastBattleAt = now;
  const lines: string[] = [];
  // W3.3 CLONES ARE THE CURRENCY: every one of your dead was a reprint the
  // front paid for. A win convoys some replacements in; an empty vat is an
  // empty line — the front falls outright, whatever the scoreboard said.
  const seed = cloneSeedFor(def);
  const clonesBefore = st.clones ?? seed;
  st.clones = Math.max(0, clonesBefore - deaths);
  if (won && st.clones > 0) st.clones = Math.min(seed, st.clones + CLONE_RECOVER + (c.facilities.includes('capture_clone_hub') ? 40 : 0));
  if (st.clones === 0 && clonesBefore > 0) {
    st.control = -100; // no bodies to hold it — the Collective walks in
    lines.push(`${def.name} has run DRY of clones — the front is LOST. The vats stand empty.`);
  } else if (st.clones > 0 && st.clones <= seed * 0.25 && clonesBefore > seed * 0.25) {
    lines.push(`${def.name} reserves CRITICAL: ${Math.round(st.clones)} clones left in the vats.`);
  }
  // W3.4: every battle digs the front one PASS deeper — the stables wake
  const prevPass = st.pass ?? 1;
  st.pass = Math.min(3, prevPass + 1) as 1 | 2 | 3;
  if (st.pass !== prevPass) {
    lines.push(st.pass === 2
      ? `${def.name} escalates — PASS 2: their stable is awake.`
      : `${def.name} escalates — PASS 3: both stables are loose.`);
  }
  const after = bandOf(st.control);
  if (after !== before) {
    lines.push(after === 'contested'
      ? `${def.name} has fallen CONTESTED — the line is moving.`
      : `${def.name} is now ${after === 'coalition' ? 'United Front' : 'Collective'} ground.`);
  }
  const deep = Math.abs(st.control) >= SCAR_EDGE;
  if (deep && !st.scarActive) {
    st.scarActive = true;
    lines.push(`${def.name} carries a scar now: ${SCAR_TEXT[def.scar]}.`);
  } else if (!deep && st.scarActive && after === 'contested') {
    st.scarActive = false;
    lines.push(`The fighting has churned ${def.name} back to raw ground — its scar fades.`);
  }
  for (const text of lines) c.dispatch.unshift({ text, at: now, simulated: false });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return lines;
}

/** Season victory (§13, decided: points threshold): hold this many of the
 *  ten fronts in your band and the war is yours. */
export const SEASON_FRONTS_TO_WIN = 6;

export interface Armistice { winner: Exclude<Band, 'contested'>; season: number; frontsHeld: number }

/**
 * The Armistice check — run after REAL battles only (a simulated overnight
 * never ends a war; finales belong to the player). If a faction holds
 * SEASON_FRONTS_TO_WIN fronts, the season closes: dispatch written, theatre
 * reset, season number advanced. The dossier persists; the war resets (§13).
 */
export function checkSeasonEnd(c: Campaign, now = Date.now()): Armistice | null {
  const held = { coalition: 0, collective: 0 };
  for (const f of FRONTS) {
    const b = bandOf(c.fronts[f.id].control);
    if (b !== 'contested') held[b]++;
  }
  const winner = held.coalition >= SEASON_FRONTS_TO_WIN ? 'coalition'
    : held.collective >= SEASON_FRONTS_TO_WIN ? 'collective' : null;
  if (!winner) return null;
  const season = c.season;
  const name = winner === 'coalition' ? 'The United Front' : 'The Collective';
  c.dispatch.unshift(
    { text: `ARMISTICE — Season ${season} is over. ${name} takes the war, holding ${held[winner]} of ten fronts. The theatre resets; the record remains.`, at: now, simulated: false },
  );
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  for (const f of FRONTS) c.fronts[f.id] = {
    control: 0, scarActive: false, lastBattleAt: 0, clones: cloneSeedFor(f), pass: 1,
    scienceWindows: SCIENCE_WINDOWS_PER_PASS, scienceWindowPass: 1,
    enemyClonePressure: 0, cloneInsurance: 0,
  }; // the armistice refills the vats and calms the war
  c.treasury = OPERATION_TREASURY_SEED;
  c.motorPool = freshMotorPool();
  c.facilities = [];
  c.modifiers = [];
  c.operationWindows = freshOperationWindows();
  c.activeOperation = null;
  c.season = season + 1;
  return { winner, season, frontsHeld: held[winner] };
}

// ---------------------------------------------------------------------------
// §11.5 NUDGE — the operator's hand on the map. Pure helpers (no DOM, no
// storage) so the War Room server can drive the SAME math a real result uses.
// §16's audit rule applies to admins too: every line below is loud about who
// moved the map — the journal never launders a decree into a battle.
// ---------------------------------------------------------------------------

/** the operator's thumb has a weight limit: one nudge tips a front ±10 at most */
export const NUDGE_LIMIT = 10;

/**
 * Tip a front by decree. Same rails, same band math, same scar logic as
 * applyResult — but every dispatch line is prefixed OPERATOR, and a nudge
 * never touches lastBattleAt or ends a season (the Armistice is a rite for
 * real battles; checkSeasonEnd is deliberately NOT called here).
 * Returns the dispatch lines written ([] for an unknown front or zero delta).
 */
export function applyNudge(c: Campaign, frontId: string, delta: number, now = Date.now()): string[] {
  const def = FRONTS.find((f) => f.id === frontId);
  const st = c.fronts[frontId];
  const d = Math.max(-NUDGE_LIMIT, Math.min(NUDGE_LIMIT, delta));
  if (!def || !st || !d) return [];
  const before = bandOf(st.control);
  st.control = Math.max(-100, Math.min(100, Math.round((st.control + d) * 10) / 10));
  const after = bandOf(st.control);
  const lines: string[] = [
    `OPERATOR: command tipped ${def.name} ${d > 0 ? '+' : ''}${d} — the map moved by decree.`,
  ];
  if (after !== before) {
    lines.push(after === 'contested'
      ? `OPERATOR: ${def.name} has fallen CONTESTED — by order, not by battle.`
      : `OPERATOR: ${def.name} is now ${after === 'coalition' ? 'United Front' : 'Collective'} ground — so says command.`);
  }
  const deep = Math.abs(st.control) >= SCAR_EDGE;
  if (deep && !st.scarActive) {
    st.scarActive = true;
    lines.push(`OPERATOR: ${def.name} carries a scar now: ${SCAR_TEXT[def.scar]}.`);
  } else if (!deep && st.scarActive && after === 'contested') {
    st.scarActive = false;
    lines.push(`OPERATOR: the decree churned ${def.name} back to raw ground — its scar fades.`);
  }
  for (const text of lines) c.dispatch.unshift({ text, at: now, simulated: false });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return lines;
}

/**
 * §11.5 — stage and name an operation: a line of operator intent in the
 * Journal. It moves no control; it tells the theatre what command is
 * planning, signed OPERATOR like every other act of the admin's hand.
 */
export function stageOperation(c: Campaign, name: string, note = '', now = Date.now()): string {
  const codename = (name.trim().toUpperCase().slice(0, 24) || 'UNNAMED').replace(/\s+/g, ' ');
  const text = `OPERATOR: Operation ${codename} is staged${note.trim() ? ` — ${note.trim().slice(0, 120)}` : ''}.`;
  c.dispatch.unshift({ text, at: now, simulated: false });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return text;
}

export const SCAR_TEXT: Record<FrontDef['scar'], string> = {
  fire: 'persistent fires burn the middle ground',
  rubble: 'collapsed cover litters the field',
  frozen: 'the ground has frozen slick',
  flooded: 'low ground is under water',
  blocked: 'a main route is blocked',
};

/**
 * W3.1 — THE WAR ONLY MOVES WHILE YOU PLAY. Robert killed the time-skip
 * (27B's simulated overnight): an offline war fighting itself made the
 * theater read as weather, not a war he was IN. Coming back after an
 * absence now writes ONE honest line — the fronts held, because nobody
 * fought — and touches no front. Your last map is exactly the map.
 */
export function holdTheLine(c: Campaign, now = Date.now()): string[] {
  const HOUR = 3600_000;
  if (now - c.updatedAt < HOUR) return [];
  const line = 'While you were away: the fronts HELD. The war only moves while you fight.';
  c.dispatch.unshift({ text: line, at: now, simulated: false });
  if (c.dispatch.length > 60) c.dispatch.length = 60;
  return [line];
}
