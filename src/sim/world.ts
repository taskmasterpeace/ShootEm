import { AMMO_INFO, CLASSES, DOG_NAMES, DOG_STATS, EQUIPMENT, IRON_STATS, SAM_SPEED_RATIO, THEMES, VEHICLES, WEAPONS, ZOMBIE_STATS } from './data';
import { CLASS_ARMORY, familyWeapons } from './arsenal';
import { CLIMB_H, F2_VOID, F2_WELL, T_CLIMB, T_DEEP, SURF_SOLDIER, SURF_TRACKS, SURF_WHEELS, T_COVER, T_DOOR, T_DOOR_OPEN, T_GRASS, T_LADDER, T_METAL, T_METAL_DOOR, T_OPEN, T_RUBBLE, T_SLIT, T_WALL, T_WATER, TILE, blocksShot, blocksShotUpper, generateMap, isBlocked, losClear, nearestOpenTile, surfaceAt, tileAt, upperBlocked, type GameMap } from './map';
import { materialOf, materialForSurface, DRILL_BASE } from './materials';
import { Rng } from './rng';
import {
  SYSTEM_IDS, isCoopMode, isZed,
  type WeaponDef,
  type AscendantId, type ClassId, type Gadget, type GadgetType, type Mine, type ModeId, type ModeState,
  type Pickup, type PlayerCmd, type Projectile, type SimEvent, type Soldier,
  type SoldierKind, type SystemId, type Team, type ThemeId, type Turret, type Vec3,
  type Vehicle, type VehicleKind, type VehicleSystems, type WeaponId, type ZedKind, isIron, type IronKind } from './types';
import { stepMode, initMode } from './modes';
import { generateFront } from './fronts';
import { generateOperationMap } from './operation-map';
import { generateTheater } from './theaters';
import type { TheaterId } from './theater-types';
import { operationWaterSpawns } from './operation-pads';
import { createOperationRuntime, stepWorldOperation, type OperationRuntimeState } from './operation-runtime';
import { AIR_KINDS, type OperationBattleBonuses, type OperationHull, type OperationManifest, type OperationPlan } from './operations';
import { LSW_BRAINS } from './lsw/index';
import { ICE_HOLD, ICE_HOLD_DRAIN, LSWS, STRUGGLE_HP, STRUGGLE_SECS, THREAT, lswAllowed, lswsForTeam } from './lsw';
import { assignVehicleRoles, stepBot, stepDog, stepIron, stepScientist, stepZombie } from './bots';
import { PERCEIVE_RANGE, perceivesNow, smokeBlocks, type SeenMark, type SmokeBlob } from './perception';
import { THEME_WEATHER, airGrounded, moveMult, visionMult, weatherAnnounce, type WeatherState } from './weather';
import { newDirector, stepDirector, type DirectorState } from './director';
import { buildInfluence, newInfluence, type InfluenceField } from './influence';
import { createBlackbox, stepBlackbox, type Blackbox } from './blackbox';
import { clampWorld, halfDepth, halfWidth, tileIndex, tileToWorld, worldToTile, wrapWorld } from './map-geometry';
import { ruleOnClassRequest } from './officer';
import { SoldierIndex } from './spatial';
import { createVehicleTelemetry, recordVehicleEvent, stepVehicleTelemetry, type VehicleTelemetry } from './vehicle-telemetry';
import {
  ELEVATION_ALT, asElevationLevel, canWeaponReachElevation, collidesAtElevation, maxElevationFor, targetLockRangeAtElevation,
  type ElevationLevel, type ElevationWeaponClass,
} from './elevation';
import {
  RADAR_PROFILES, headingDegrees, radarDomainForVehicle, radarTrackKey, weatherRadarMultiplier,
  type RadarEmitterProfile, type RadarTrack,
} from './radar';

const RESPAWN_DELAY = 4;
/** THE OUTBREAK (§4): how fast an exposed soldier's Viral Load creeps toward
 *  conversion, per second. ~1.4 → a fresh 22-point bite incubates ~55s if
 *  untreated; two bites turn you in under 30. Medical care walks it back. */
const INFECTION_CREEP = 1.4;
/** §6: the final CRITICAL window before a corpse rises — the last-chance alert. */
const CORPSE_CRITICAL_WINDOW = 2;
/** §6.1: fire is METERED, not a magic delete — one incendiary hit adds this to
 *  a corpse's burn meter; at 1.0 the body is consumed and can't rise. ~2 hits
 *  to full, so denial takes a real (brief) burn. Chemistry (BNR) and a blast's
 *  complete destruction stay instant (§6.2). Tunable. */
const INC_BURN_PER_HIT = 0.5;
/** STATUS §1 / W1.4 — BALLISTIC FALLOFF: a bullet tires as it flies, so range
 *  costs stopping-power. Energy weapons (rail/beam/plasma) are EXEMPT — light
 *  doesn't lose steam. Full damage out to 55% of the weapon's range, then a
 *  linear taper to FALLOFF_FLOOR at max range. Tunable; kept shallow so close
 *  and mid fights are unchanged and only the long shot pays. */
export const FALLOFF_FLOOR = 0.6;
/** Full damage out to at least this far, whatever the weapon — so close/mid
 *  fights (and the balance arena the threat table measures at ~14-40u) never
 *  see falloff, and only the genuinely LONG shot pays. */
export const FALLOFF_MIN_FULL = 42;
export function ballisticFalloff(tracer: string | undefined, range: number, traveled: number): number {
  if (tracer !== 'bullet' && tracer !== 'shell') return 1; // energy weapons exempt
  const full = Math.max(range * 0.55, FALLOFF_MIN_FULL);
  const span = range - full;
  if (span <= 0 || traveled <= full) return 1; // short-range weapons never tire
  return 1 - Math.min(1, (traveled - full) / span) * (1 - FALLOFF_FLOOR);
}

/** STATUS §1 / W1.1 — ACCURACY BY MOVEMENT: your stance and motion bend the
 *  cone. Still and walking are the NEUTRAL baseline (×1) — the balance the game
 *  is tuned around — so crouch BRACES it tighter, a sprint sprays, and firing
 *  airborne is the loosest. Neutral stays ×1 on purpose: the threat-measure
 *  arena fights standing at 14-40u, so it never sees this (see the falloff
 *  balance trap). Airborne = off the ground floor and off the deck (a jump or
 *  jetpack, NOT a soldier standing on a second storey at y=4). */
export function aimSpreadMul(s: Pick<Soldier, 'crouching' | 'sprinting' | 'floor' | 'pos'>): number {
  if ((s.floor ?? 0) === 0 && s.pos.y > 1.2) return 2.1; // airborne — the loosest
  if (s.crouching) return 0.7;                            // braced — the tightest
  if (s.sprinting) return 1.7;                            // run-and-gun sprays
  return 1;                                               // still / walking — neutral
}
/** §8: how close bodies must pile before they anchor a contamination NEST. */
const NEST_RADIUS = 6;
/** §7 EMERGENT VARIANTS: the risen form is DERIVED from the body that fell —
 *  a scout's quick frame becomes a SPRINTER (the lean infected), a heavy's
 *  mass a BRUTE, everyone else a base shambler. Causal, not a roster roll. */
function riseKind(classId: ClassId): ZedKind {
  if (classId === 'infiltrator' || classId === 'pathfinder') return 'sprinter';
  if (classId === 'heavy') return 'brute';
  return 'zombie';
}

/** OUTBREAK LEVEL banners (§3.2), announced on escalation only */
const OUTBREAK_LEVELS = [
  'SECTOR CLEAR',
  'OUTBREAK LEVEL 1 — SUSPECTED EXPOSURE',
  'OUTBREAK LEVEL 2 — CONFIRMED OUTBREAK',
  'OUTBREAK LEVEL 3 — CONTAINMENT FAILURE',
  'OUTBREAK LEVEL 4 — SECTOR LOST',
] as const;

// opt #38 (S2): caller-owned scratch for spatial-index queries — one per call
// site so nested resolution (a hit → explode → …) can never clobber a live
// iteration; never held across ticks
const PROJ_SCRATCH: Soldier[] = [];
const MELEE_SCRATCH: Soldier[] = [];
const VEHICLE_RESPAWN = 22;
// §8.1a requisition law — you signed the hull out; the manifest doesn't care that you died
const HOTWIRE_ABANDON = 90;  // an enemy hull must sit crewless this long before it can be stolen
const HOTWIRE_TIME = 6;      // seconds of E held beside the hull (engineers know the wiring: half)
const RECOVER_RADIUS = 6;    // park a crewless hull this close to home and the pool re-registers it
const WRITEOFF_TIME = 180;   // three full minutes abandoned...
const WRITEOFF_RANGE = 25;   // ...AND this far from its pad = command strikes it from the books
// §4.3 down-not-out: lethal hits put humans on the ground, not in the grave.
const DOWNED_HP = 25;       // the bleed pool — finisher damage chews through this
const BLEEDOUT_TIME = 20;   // seconds a downed soldier can hold on for help
const DOWNED_CRAWL = 0.25;  // crawl speed as a fraction of class speed
const REVIVE_CHANNEL = 3;   // seconds a non-medic must hold E to lift someone
const REVIVE_HP = 0.4;      // revived soldiers stand up grateful, not fresh
const AID_RANGE = 2;        // how close a helper must be to drag or revive
const DRAG_OFFSET = 1.2;    // the body trails this far behind the dragger

// ---------------------------------------------------------------------------
// Melee is a swing, not a proximity tax (design directive §20/§8.3): every
// melee attack runs WINDUP → STRIKE → RECOVER. The windup is carved OUT of
// the weapon's existing 1/rof interval — nextFireAt is still trigger + 1/rof
// — so sustained DPS matches the old instant-hit melee exactly; only the
// FIRST hit arrives WINDUP late, and that latency is the dodge window.
// ---------------------------------------------------------------------------
/** seconds a standard zombie telegraphs before the claw lands */
export const MELEE_WINDUP = 0.25;
/** 90° front arc — step outside it during the windup and the swing whiffs */
export const MELEE_ARC = Math.PI / 2;
/** a swing can connect with at most this many victims */
export const MELEE_MAX_TARGETS = 2;
/** melee victims flinch: their next shot is delayed this long */
export const MELEE_STAGGER = 0.15;
/** lunge impulse at strike time; push decays at e^-5t so travel ≈ v0/5 = 1.5u */
export const MELEE_LUNGE = 7.5;

/** IMPACT CHARGE (OUTBREAK-SPEC §13): seconds of HOLDING the knife to reach a
 *  full (100%) Power Strike. A tap barely charges — that's the quick strike. */
const CHARGE_MAX_TIME = 1.0;
/** hold past this many charge units and the swing FUMBLES on release. */
const OVERCHARGE_AT = 1.3;
/** stamina bled per second while overcharged (held past maximum). */
const OVERCHARGE_DRAIN = 20;
/** §13 tuning bands: 0-30% quick, 31-70% heavy, 71-100% max, over = fumble. */
function chargeMult(c: number): number {
  if (c >= OVERCHARGE_AT) return 1.2; // held too long — a clumsy, wasted blow
  if (c >= 0.7) return 2.4;           // MAXIMUM IMPACT
  if (c >= 0.3) return 1.6;           // heavy strike
  return 1.0;                         // quick strike (the tap)
}

/** Brutes wind up a slow haymaker; sprinters snap; the K9 bites quick. */
export function meleeWindupFor(kind: SoldierKind): number {
  if (kind === 'brute') return 0.4;
  if (kind === 'sprinter') return 0.18;
  if (kind === 'dog') return 0.2;
  return MELEE_WINDUP;
}
const ENERGY_REGEN = 14;
/** OUTBREAK-SPEC §11: player-facing ammunition names for the AMMO announce. */
/** GUARD (OUTBREAK-SPEC §12): stamina burned per second of holding the brace —
 *  from a full tank that's ~10s of block, and regen is paused while it's up. */
const GUARD_DRAIN = 10;
/** a blocked STRIKE lands this fraction of its damage on a facing guarder. */
const GUARD_SOAK = 0.12;
/** GUARD parry: a blocked attacker's next swing/shot is jarred this long. */
const GUARD_PARRY_STAGGER = 0.5;
/** the frontal cone a raised guard covers (150° total) — flanks slip past. */
const GUARD_ARC = (5 * Math.PI) / 6;
/** GRAPPLE (OUTBREAK-SPEC §12/§14): a grab reaches this far to lock on. */
const GRAB_RANGE = 2.0;
/** the frontal cone a grab can seize through (120° — you grab what you face). */
const GRAB_CONE = (2 * Math.PI) / 3;
/** seconds a body stays PINNED before the hold naturally lapses. */
const GRAB_HOLD = 1.6;
/** mashing move/fire breaks the pin in this long — faster than waiting it out. */
const GRAB_STRUGGLE_SECS = 1.2;
/** if the grabber strays past this from the pinned body, the hold slips. */
const GRAB_TETHER = 3.2;
/** a whiffed grab (stuffed by a STRIKE, or grabbing air) occupies the clock. */
const GRAB_RECOVER = 0.5;
const GRAB_SCRATCH: Soldier[] = [];
const BEAM_SCRATCH: Soldier[] = []; // §BEAMS held-stream ray walk
/** §BEAMS row 189 clash tuning: node walk rate per unit of power gap, the
 *  surge bonus (sprint held, stamina-fed), and the off-axis knock. */
const CLASH_RATE = 0.0042;   // node t/sec per point of power differential
const CLASH_SURGE = 40;      // surge adds this much power
const CLASH_SURGE_DRAIN = 20; // stamina/sec while surging
const CLASH_KNOCK_JAM = 1.5; // the sheared loser's emitter is knocked out this long
const BEAM_DRAIN = 14;       // stamina/sec a held beam burns (Robert: can't spray forever)
/** after breaking a hold you're briefly ungrabbable — no instant re-clinch. */
const GRAB_IMMUNE = 1.0;
/** §14.2 REAR TAKEDOWN: the finisher off a rear pin — an EXECUTION, so it blows
 *  well past zero (overkill) and the body drops for good instead of crawling
 *  (§4.3's own overkill rule skips the downed state). Armour-piercing — rear
 *  control bypasses plate. The pin's GRAB_RECOVER delay before a second grapple
 *  gives the victim a struggle window; gods are exempt (too big to take down). */
const TAKEDOWN_DAMAGE = 500;
/** §14.2 REAR CONTROL (Robert: "eliminate the minigame — if you win that grab
 *  they don't get loose, you use them as a human shield until they break").
 *  A landed rear grab is IMMEDIATE control: no needle contest. The `ctrlStruggle`
 *  object is now just a pre-locked marker so the outcome menu (shield/disarm/
 *  choke/throw/takedown) reads it; the victim's only exit is to STRUGGLE free,
 *  and breaking a rear control shoves the grabber hard (anti-spam). */
const CHOKE_SECS = 2.6;       // §14.2 the silent capture — full squeeze to DOWNED
/** BITE STRUGGLE (OUTBREAK-SPEC §15.5): a zombie's grip HOLDS this long — win
 *  the struggle before it lapses or the bite lands. Sprinters snap faster,
 *  brutes clamp longer (scaled per-kind at the grab). */
const BITE_HOLD = 1.8;
/** Viral Load gnawed per second while a zombie has you in its jaws. */
const BITE_GNAW = 9;
/** the bite that lands if you FAIL to break the hold in time (plus the claw's
 *  own Viral injection through damageSoldier). */
const BITE_DAMAGE = 16;
// M1 movement verbs (Robert: "dashing forward, rolling to the sides… run…
// but we should have a stamina"): all paid from the ONE energy tank.
const SPRINT_MULT = 1.35;
const SPRINT_DRAIN = 10;   // per second held
const DASH_COST = 25;
const ROLL_COST = 20;
const SLIDE_COST = 14;     // a slide spends SPRINT momentum, not a fresh burst — cheap
const DASH_IMPULSE = 16;   // decays e^-5t → ~3.2u of burst
const ROLL_IMPULSE = 13;
const SLIDE_IMPULSE = 19;  // a longer, lower skid than the dash
const DASH_CD = 0.9;
// M1 CHARGED LEAP (STATUS §1: "hold-and-release with a direction; land loud,
// no air control"): a coiled duck released as a ballistic spring.
const LEAP_COST = 25;      // dash-priced — the tank is the ONE meter
const LEAP_H_MIN = 9;      // horizontal u/s at zero charge…
const LEAP_H_MAX = 15;     // …to full coil (~0.9s past the tap window)
const LEAP_UP = 6.5;       // the vertical pop — ~0.6s of hang
const LOUD_LAND = 0.9;     // seconds the arrival RINGS on recon (pings + wakes)
// M1 RAGDOLL (Robert: "a knockback threshold that ragdolls us… and our
// characters get up and we get control again"). Applied per-blast impulse at
// or past this flips the body: conc (26) ragdolls out to ~2.5u, artillery
// flips whole fireteams, but a plain frag (13) only ever shoves.
const RAGDOLL_AT = 16;
// V4: the Cradle warhead costs the same as a tier-3 god. It should feel like
// spending the stable's whole afternoon, because it does what a god does.
const NUKE_PRICE = 4;
// V5: how long a launcher waits before sweeping an empty sky again. Far
// shorter than its reload (1.8s crewed, 3.4s not), so it never costs a shot —
// it only stops idle radars from re-scanning the whole world every frame.
const AA_SWEEP = 0.25;

/** How long a corpse keeps taking physics — long enough to fall, land, and be
 *  seen doing it in the death cam (which streams ~1.1s past the kill). */
const CORPSE_PHYSICS_S = 2.2;
/**
 * How hard the killing blow throws the body, DERIVED from the weapon so it can
 * never drift from what the weapon actually is:
 *
 *   • energy — a beam or a rail slug punches through and imparts nothing. You
 *     drop where you stood. This contrast is the whole point: a laser death
 *     and a shotgun death must not look alike.
 *   • buckshot — a wall of pellets at close range is the biggest shove in the
 *     game, scaled by how many pellets are in the pattern.
 *   • explosives — already carry a real knockback figure; use it.
 *   • everything else — a rifle round barely moves a man, but "barely" is not
 *     "not at all", and it is the difference between a body falling and a body
 *     switching off.
 */
export function deathShove(def: WeaponDef | undefined): number {
  if (!def) return 4;
  if (def.tracer === 'beam' || def.tracer === 'rail') return 0;
  if (def.splash > 0) return Math.max(def.knockback, 11);
  if (def.pellets > 1) return 7 + def.pellets * 1.1;
  return def.knockback > 0 ? def.knockback : 5;
}
// M5 THE AXE: thrown flat, buried on landing, recalled through anyone in the way
const AXE_REACH = 30;
const AXE_RECALL_SPEED = 46;
const AXE_RETURN_DAMAGE = 45;
const CLOAK_DRAIN = 11;
const JET_DRAIN = 30;
const JET_THRUST = 9.5;
const JET_BREATHER = 1.0; // seconds after touchdown before jet fuel flows again
const PICKUP_RESPAWN = 18;
// LOOT (STATUS short-list: "dropped weapons you can pick up off the dead"):
// a fallen fighter's primary stays on the field for a while. The issue rifle
// is beneath scavenging, and the field tidies itself past the cap.
const LOOT_DESPAWN = 20;
const LOOT_MAX = 12;
const LOOT_EXCLUDED = new Set<string>(['ar606']);

// ---- anti-air: MANPADS vs flyer ----
const MANPADS_ROUNDS = 2;    // missiles per life
const FLARES_PER_LIFE = 3;   // decoys per flyer life
const SAM_LOCK_RANGE = 70;
const SAM_LOCK_CONE = 0.61;  // ~35° either side of facing
const SAM_TURN_RATE = 2.6;   // rad/s — tracks a turning flyer, loses a straight one
const SAM_CRUISE_ALT = 4.05; // just above the 4u walls so terrain can't eat the chase
const SAM_DIVE_ALT = 2.6;    // terminal dive under the 3u vehicle-hit ceiling
const FLARE_PULL_RADIUS = 18;
/** max hand-frag throw — the HUD arc and the sim clamp share this */
export const HAND_FRAG_REACH = 26; // Robert: "throw it just a little bit further" (was 22)
/** structural hp of a door: ~11 walker claws (a lone walker bangs for ~9s,
 *  a pack of three is in within ~4), 3 brute swings, 1 tank shell, 2 GL-40s */
export const DOOR_HP = 150;
/** FPV drone control range — signal (and the static on your feed) scales with
 *  distance from the operator's body; past this the link drops and it crashes */
export const DRONE_RANGE = 55;

export type Difficulty = 'recruit' | 'veteran' | 'elite';

export interface WorldOptions {
  seed: number;
  mode: ModeId;
  /** Pre-built deterministic ground for scenarios, tools, and authored theater launches. */
  map?: GameMap;
  /** Vehicle-scale theater source. Explicit maps and Operation maps win. */
  theaterId?: TheaterId;
  botsPerTeam?: number;
  difficulty?: Difficulty;
  /** B1: morale banked by underfunded victories opens the stable richer —
   *  per team, capped in the constructor so it never floods the economy */
  moraleBoost?: [number, number];
  matchMinutes?: number;
  /** THE OUTBREAK: force the infection/reanimation layer on (or off) rather
   *  than letting the mode decide — for scenarios, tests, and the future
   *  condition-driven war-front outbreak (§2.1). */
  outbreak?: boolean;
  /** THE HORDE ROSTER (Robert: "the iron eater should NEVER be with the
   *  zombies — let it specify: iron eaters, zombies, or both"). Default
   *  'zombies' — the flesh horde fights alone; 'iron' fields only the machine
   *  race; 'both' restores the wave-4 quarter-mix as an OPT-IN. */
  hordeRoster?: 'zombies' | 'iron' | 'both';
  /** battlefield environment — drives map flavor and gravity */
  theme?: ThemeId;
  /** §8.2 authored ground: a Scar front id deploys onto ITS terrain, not a
   *  recipe scatter. Unknown/absent → the classic generator. */
  frontId?: string;
  /** W3.4 PASS ESCALATION: the front's pass gates the stables. 1 = no gods
   *  at all; 2 = only the ENEMY stable answers (the war escalates AT you
   *  before it escalates FOR you); 3/absent = both — quick matches off the
   *  campaign map keep today's behavior. */
  lswPass?: 1 | 2 | 3;
  operation?: OperationPlan;
  operationManifest?: OperationManifest;
  operationInventory?: OperationHull[];
  operationBonuses?: OperationBattleBonuses;
}

/** Custom deploy loadout: armory weapons + up to two equipment picks. */
export interface Loadout {
  primary?: WeaponId;
  secondary?: WeaponId;
  equipment?: string[];
}

/** Bot aim-error multiplier per difficulty. */
// The skill ladder (aim / reaction / turn-rate) and every other bot constant
// now live on one dial-board: src/sim/bot-tuning.ts.

export class World {
  time = 0;
  tick = 0;
  map: GameMap;
  mode: ModeState;
  rng: Rng;
  /** gravity for this battlefield — Europa and Triton fight in low-g */
  gravity: number;
  soldiers = new Map<number, Soldier>();
  /** opt #38 (S2): the per-tick spatial index — rebuilt at the top of step();
   *  queries return id-sorted supersets, call sites keep their own filters */
  soldierIndex = new SoldierIndex(); // the constructor reassigns with map geometry
  /** opt #11 (S8): the encased-body list, recomputed once at the top of step().
   *  `groundBlocked` used to walk the WHOLE roster hunting ice per grounded
   *  soldier ×2/tick — O(S²) for a state that's almost always empty; now it
   *  reads this short list. Recompute (not a counter) is drift-proof under
   *  network deletes; an ice block's position is fixed for its life. */
  private encasedBodies: Soldier[] = [];
  /** opt #8 (S7): cached humansAndBots() roster. The filtered set (human|bot,
   *  non-dummy) is stable within a match — humans/bots enter ONLY via addSoldier
   *  (deaths keep them in the Map for respawn; the internal deletes are all
   *  dogs/zombies/iron, filtered out here), so zombie top-up never dirties it.
   *  addSoldier clears it; external removals (server disconnect / puppet prune)
   *  call invalidateRoster(). Callers must not mutate the returned array. */
  private rosterCache: Soldier[] | null = null;
  /** opt #27 (S9): live count of possessed turrets+bots+vehicles. The three
   *  per-tick expiry scans — one of which walks the FULL soldier roster hunting
   *  ridden bots — skip entirely when nothing is possessed (the near-always
   *  case). Maintained by the possess/evict methods; can only ever drift HIGH (an entity
   *  deleted mid-possession), which merely runs the scan needlessly — never a
   *  missed eviction — so count===0 skipping is byte-identical. */
  private possessionCount = 0;
  /** THE OUTBREAK (OUTBREAK-SPEC): master switch — the machinery is inert
   *  until conditions (or a mode/scenario) turn it on. Condition-driven
   *  activation (Outbreak Pressure) is the next slice; nothing in the game
   *  flips this yet, so every existing match is byte-identical. */
  outbreakEnabled = false;
  /** exposed bodies on the reanimation clock (§6) — capped, oldest forgotten */
  corpses: { pos: Vec3; reanimatesAt: number; neutralized: boolean; name: string; classId: ClassId; warned?: boolean; burn?: number }[] = [];
  /** §BEAMS row 189: this tick's registered held streams (cleared each step) */
  private tickBeams: { s: Soldier; def: WeaponDef; wid: WeaponId; surge: boolean }[] = [];
  /** live beam-vs-beam CLASHES keyed 'aId-bId' (a<b). t = the node's position
   *  along the A→B axis (0 = at A, 1 = at B); it walks toward the WEAKER
   *  wielder. Public: the renderer draws both streams INTO the node. */
  beamClashes = new Map<string, { aId: number; bId: number; t: number; x: number; z: number }>();
  /** W3.10: iron-eater serial counter — LOOM-01, WRECK-02, machine to the last */
  private ironSerial = 0;
  /** row 246: water tiles FROSTBITE has frozen into crossable ice — tile index
   *  → thaw time. Lazy: a tile is frozen while `now < thaw`; the ice god
   *  re-stamps the tiles he stands over, so the bridge lingers then thaws.
   *  Public: the renderer overlays a pale quad on each live entry. */
  frozenWater = new Map<number, number>();
  /** OUTBREAK PRESSURE (§3): the authoritative severity of the sector, fed by
   *  live infected + unburned corpses + exposed soldiers. Drives the level. */
  outbreakPressure = 0;
  /** OUTBREAK LEVEL 0-4 (§3.2): Clear→Suspected→Confirmed→Failure→Sector Lost.
   *  Hysteresis (§3.3) keeps it from oscillating on a single kill. */
  outbreakLevel = 0;
  private outbreakLevelSince = 0;
  /** MUTATION FIELDS (§8) as emergent NESTS (§3.1): the centres of dense unburned
   *  corpse clusters. Infected inside run faster and rise MUTATED — a readable,
   *  emergent cause (too many bodies left to rot). Rescanned at low frequency. */
  nests: Vec3[] = [];
  private nextNestScanAt = 0;
  vehicles = new Map<number, Vehicle>();
  turrets = new Map<number, Turret>();
  projectiles = new Map<number, Projectile>();
  pickups = new Map<number, Pickup>();
  mines = new Map<number, Mine>();
  gadgets = new Map<number, Gadget>();
  /** soldier ids currently revealed by targeting beacons / drones / sensors / psi */
  pinged = new Set<number>();
  /** LAST tick's marks. The recon pass (beacons/drones/cameras/psi) repopulates
   *  `pinged` AFTER the bot brains have already run, so a bot reading `pinged`
   *  live always saw an empty set — every ping-aware behaviour was dead code.
   *  Bots read this instead: one tick stale (16ms) and deterministic. */
  pingedLast = new Set<number>();
  /** per-team memory: when team T last perceived enemy soldier id, and WHERE
   *  (§19.1 ghosts freeze at the spot you lost them). Stamped every tick by
   *  updateLastSeen; the wire culler (68A) and the renderer's roof cutaway
   *  both read it, and SEEN_LINGER turns it into the 1.5–3s trail. */
  lastSeen: [Map<number, SeenMark>, Map<number, SeenMark>] = [new Map(), new Map()];
  /** RG-2 tag darts: soldier id → time the pin burns out (re-pings each tick) */
  tagged = new Map<number, number>();
  /** §8.8 the sky: every front rolls weather from its theme's menu. Starts
   *  clear; the first front arrives on its own clock. Replicated.
   *  (The paintball yard is exempt — nobody's first hour gets a whiteout.) */
  weather: WeatherState = { kind: 'clear', intensity: 0, until: 90 };
  /** §director: the match-level pacing band (neutral with no human on field) */
  director: DirectorState = newDirector();
  /** §influence: the shared per-team threat field (pay once, all bots read) */
  influence: InfluenceField = newInfluence();
  /** soldier ids currently hidden inside smoke fields */
  smoked = new Set<number>();
  /** tile indices the tunneler has ground to rubble (replicated to clients) */
  dug: number[] = [];
  /** DESTRUCTION (the shared mechanic): tile indices breached to T_RUBBLE —
   *  walkable-slow knee cover. Replicated like dug; monotonic (only opens). */
  breached: number[] = [];
  /** running damage ledger for masonry under fire, keyed by tile index */
  private wallHp = new Map<number, number>();
  nextPodAt = 75;
  events: SimEvent[] = [];
  /** LIVE FEEL KNOBS (Robert's global speed control) — 1 = the shipped feel.
   *  `projectileSpeedMul` slows/quickens DIRECT-fire rounds without moving
   *  where they land (ttl = reach/speed compensates); arcs are left alone so
   *  grenades still hit the cursor. `moveSpeedMul` scales soldier legs. Both
   *  default to 1, so tests and the authoritative server never change — this
   *  is an offline tuning surface, pushed in from client settings. */
  projectileSpeedMul = 1;
  /** Robert's HULL knob. Vehicles were the one mover no global slider touched,
   *  so slowing rounds to 0.35× left a buggy outrunning its own incoming fire.
   *  Scales drive speed only — turn rate, weapons and armour are untouched. */
  vehicleSpeedMul = 1;
  moveSpeedMul = 1;
  /** THE BLACK BOX (Robert: "put the tools in there") — always-on crowd flight
   *  recorder: 2s-cadence spread/near-base/stuck time series + persisted-knot
   *  and stuck-body incidents. Read via __ww.blackbox(). See sim/blackbox.ts. */
  vehicleTelemetry: VehicleTelemetry = createVehicleTelemetry();
  blackbox: Blackbox = createBlackbox(this.vehicleTelemetry);
  /** Authoritative last-known radar/sonar truth. HUD and AI read these copies,
   *  never a hidden target's live position between scheduled sweeps. */
  radarTracks: [Map<string, RadarTrack>, Map<string, RadarTrack>] = [new Map(), new Map()];
  private radarTrackHistory: [Set<string>, Set<string>] = [new Set(), new Set()];
  nextRadarSweep = new Map<string, number>();
  /** Last commanded hull speed, sampled by the vehicle black box. */
  vehicleCommandedSpeed = new Map<number, number>();
  /** §13 AMMO DIAGNOSTICS: per-weapon shot tally for the blackbox's ammo
   *  report (authoritative-side only — never rides the snapshot). */
  ammoShotsByWeapon = new Map<string, number>();
  /** CLONE INFECTION (spec × W3.3): hot deaths per team — each costs the
   *  campaign vat DOUBLE (the reprint AND the risen body). */
  viralDeaths: [number, number] = [0, 0];
  private nextId = 1;
  /** Present only for a Military Operation; stock matches never touch it. */
  operation?: OperationRuntimeState;
  /** Protected-zone damage accumulated for the no-collateral settlement. */
  operationCollateral = 0;
  operationRequisitionDiscount = 0;
  operationEarlyWarningSeconds = 0;
  operationFogLiftUntil = 0;
  operationRepairPadPos?: Vec3;
  operationBridgeAccess = false;
  operationArtillery = 0;

  constructor(public opts: WorldOptions) {
    this.rng = new Rng(opts.seed ^ 0xbeef);
    // authored front ground first (§8.2); the recipe generator is the
    // fallback for free play and any front this build doesn't know
    this.map = opts.map ?? ((opts.operation && opts.operationManifest && opts.operationInventory
      ? generateOperationMap(opts.operation, opts.operationManifest, opts.operationInventory)
      : null)
      ?? (opts.theaterId ? generateTheater(opts.theaterId, opts.seed) : null)
      ?? (opts.frontId ? generateFront(opts.frontId, opts.seed) : null)
      ?? generateMap(opts.seed, opts.mode, opts.theme ?? 'savanna'));
    this.soldierIndex = new SoldierIndex(this.map.geometry);
    this.gravity = THEMES[this.map.theme].gravity;
    this.mode = initMode(opts.mode, this.map, opts.matchMinutes);
    if (opts.operation) {
      this.operation = createOperationRuntime(opts.operation);
      this.mode.timeLeft = Infinity;
      if (this.operation.setup.weather === 'storm') {
        this.weather = { kind: 'storm', intensity: 0.9, until: Infinity };
      }
    }
    if (opts.mode === 'paintball') this.weather.until = Infinity; // the yard stays sunny
    // THE OUTBREAK plays LIVE in the horde modes — where the dead already walk,
    // the fallen now rise with them (opts.outbreak forces it on elsewhere).
    // The war-front outbreak (condition-driven, §2.1) is a later slice.
    this.outbreakEnabled = opts.outbreak ?? (opts.mode === 'horde' || opts.mode === 'survival' || opts.mode === 'safehouse');
    // vehicles on pads. Co-op zombie modes field only squad support —
    // the ambulance and the emplacement guns — no armor column.
    // B1: morale arrives as opening materiel — an army that believes fights
    // on a fuller stable (capped: belief is not a printing press)
    if (opts.moraleBoost) {
      for (const t of [0, 1] as const) {
        this.materiel[t] = Math.min(14, this.materiel[t] + Math.min(3, Math.max(0, opts.moraleBoost[t])));
      }
    }
    if (opts.operationBonuses) this.applyOperationBattleBonuses(opts.operationBonuses);
    if (opts.operationManifest?.support === 'artillery') this.operationArtillery++;
    if (opts.operationManifest?.support === 'cas' && this.operation?.setup.deniedSupport !== 'cas') {
      const home = this.map.vehiclePads.find((pad) => pad.team === 0)?.pos ?? this.map.basePos[0];
      this.map.vehiclePads.push({ kind: 'strikejet', team: 0, pos: { x: home.x + 3, y: 0, z: home.z - 3 } });
    }
    this.map.vehiclePads.forEach((pad, padId) => {
      if (isCoopMode(opts.mode) && pad.kind !== 'ambulance' && pad.kind !== 'emplacement') return;
      const vehicle = this.spawnVehicle(pad.kind, pad.team, pad.pos, padId);
      vehicle.operationHullId = pad.operationHullId;
      vehicle.operationObjectiveId = pad.operationObjectiveId;
      vehicle.operationPrize = pad.operationPrize;
    });
    if (opts.mode === 'safehouse' && this.map.houses.length) {
      const house = this.map.houses[this.rng.int(0, this.map.houses.length - 1)];
      const sci = this.addScientist(house.center);
      this.mode.scientistId = sci.id;
    }
    for (const p of this.map.pickups) {
      this.pickups.set(this.nextId, { id: this.nextId, type: p.type, pos: { ...p.pos }, respawnAt: 0 });
      this.nextId++;
    }
    if (this.operation?.setup.defenderLswRequired) {
      const objective = this.map.operation?.objectives[0]?.pos ?? this.map.hillPos;
      const defenders = lswsForTeam(1);
      if (defenders.length > 0) this.addLsw(defenders[this.rng.int(0, defenders.length - 1)], 1, objective);
    }
    this.refreshHomeDoors(); // base-zone doors learn whose base they serve
  }

  private applyOperationBattleBonuses(bonuses: OperationBattleBonuses) {
    this.materiel[0] = Math.min(14, this.materiel[0] + bonuses.openingMateriel);
    this.materiel[1] = Math.max(0, this.materiel[1] - bonuses.enemyMaterielPenalty);
    this.operationRequisitionDiscount = bonuses.requisitionDiscount;
    this.operationEarlyWarningSeconds = bonuses.earlyWarningSeconds;
    this.operationFogLiftUntil = bonuses.fogLiftSeconds;
    this.operationBridgeAccess = bonuses.bridgeAccess;
    this.operationArtillery = bonuses.artillery;

    if (bonuses.denyEnemyAir) {
      this.map.vehiclePads = this.map.vehiclePads.filter((pad) => pad.team !== 1 || !AIR_KINDS.has(pad.kind));
    }
    const home = this.map.vehiclePads.find((pad) => pad.team === 0)?.pos ?? this.map.basePos[0];
    const addPad = (kind: VehicleKind, dx: number, dz: number) => {
      if (!this.map.vehiclePads.some((pad) => pad.team === 0 && pad.kind === kind)) {
        this.map.vehiclePads.push({ kind, team: 0, pos: { x: home.x + dx, y: 0, z: home.z + dz } });
      }
    };
    if (bonuses.samCover) addPad('aatrack', 0, 3);
    if (bonuses.cas) addPad('strikejet', 0, -3);
    if (bonuses.escortWing) addPad('interceptor', 3, 0);
    if (bonuses.coastalCover) addPad('emplacement', -3, 0);
    if (bonuses.navalSupport && !this.map.vehiclePads.some((pad) => pad.team === 0 && pad.kind === 'boat')) {
      const wet = operationWaterSpawns(this.map)[0];
      if (wet) this.map.vehiclePads.push({ kind: 'boat', team: 0, pos: { ...wet } });
    }
    if (bonuses.rearmPad) this.map.pickups.push({ type: 'ammo', pos: { ...home } });
    if (bonuses.repairPad) this.operationRepairPadPos = { ...home };
    if (bonuses.forwardSpawn && this.map.controlPoints[0]) {
      const forward = { ...this.map.controlPoints[0].pos };
      this.map.spawns[0] = this.map.spawns[0].map(() => ({ ...forward }));
    }
    const hazardCenter = this.map.controlPoints[0]?.pos ?? this.map.hillPos;
    for (let i = 0; i < bonuses.hazards; i++) {
      const angle = (i / Math.max(1, bonuses.hazards)) * Math.PI * 2;
      const id = this.id();
      this.mines.set(id, {
        id, team: 0, ownerId: -1, armedAt: 0,
        pos: { x: hazardCenter.x + Math.cos(angle) * 3, y: 0, z: hazardCenter.z + Math.sin(angle) * 3 },
      });
    }
    if (bonuses.earlyWarningSeconds > 0) {
      this.emit({ type: 'announce', text: `EARLY WARNING — enemy air manifest visible ${bonuses.earlyWarningSeconds}s out.` });
    }
  }

  callOperationArtillery(pos: Vec3, team: Team): boolean {
    if (this.operationArtillery <= 0) return false;
    this.operationArtillery--;
    this.emit({ type: 'orbital_strike', pos: { ...pos }, team, text: 'OFF-MAP BATTERY — SHOT OUT' });
    this.explode({ ...pos }, WEAPONS.gl, -1, team);
    return true;
  }

  /** Does this soldier carry the given equipment effect? */
  hasEquip(s: Soldier, key: keyof (typeof EQUIPMENT)[string]): boolean {
    for (const id of s.equipment) {
      const e = EQUIPMENT[id];
      if (e && e[key]) return true;
    }
    return false;
  }

  /** structural hit points of every door that has taken damage but not broken */
  doorHp = new Map<number, number>();

  /**
   * Doors take STRUCTURAL damage — zombie claws, brute fists, explosions.
   * A broken door is gone for the match: the tile is ground open and rides
   * the dug list, so the break replicates exactly like tunneler damage.
   * Returns true when this hit was the one that broke it.
   */
  damageDoor(idx: number, dmg: number, byId = -1): boolean {
    const t = this.map.grid[idx];
    if ((t !== T_DOOR && t !== T_DOOR_OPEN) || dmg <= 0) return false;
    const tx = idx % this.map.geometry.cols, tz = (idx / this.map.geometry.cols) | 0;
    const pos = { ...tileToWorld(this.map.geometry, tx, tz), y: 1 };
    const hp = (this.doorHp.get(idx) ?? DOOR_HP) - dmg;
    if (hp > 0) {
      this.doorHp.set(idx, hp);
      this.emit({ type: 'doorhit', tile: idx, pos, soldierId: byId >= 0 ? byId : undefined });
      return false;
    }
    this.doorHp.delete(idx);
    const dc = this.doorChanges.indexOf(idx);
    if (dc >= 0) this.doorChanges.splice(dc, 1); // not a door anymore — dug owns it now
    this.map.grid[idx] = T_OPEN;
    this.dug.push(idx);
    this.emit({ type: 'doorbreak', tile: idx, pos }); // wood crash, not rock rubble
    return true;
  }

  /** Grind a wall/cover tile to open ground (tunneler). */
  digTile(tx: number, tz: number) {
    if (tx < 1 || tz < 1 || tx >= this.map.geometry.cols - 1 || tz >= this.map.geometry.rows - 1) return; // border holds
    const idx = tileIndex(this.map.geometry, tx, tz);
    const t = this.map.grid[idx];
    // structure is dinner — the drill grinds anything with a positive drill rate
    // in the MATERIALS table: walls, cover, slits, doors, barricades, AND metal
    // now (slowly, sparking). Bedrock/dirt/water (drill 0) have nothing to eat.
    if (materialOf(t).drill <= 0) return;
    this.map.grid[idx] = T_OPEN;
    this.dug.push(idx);
    this.emit({
      type: 'dig', tile: idx,
      pos: tileToWorld(this.map.geometry, tx, tz),
    });
  }

  /** DESTRUCTION — the tile-state ladder: intact → (damaged) → RUBBLE → gone.
   *  The three laws (docs/ASCENDANTS.md shared mechanics):
   *   · TIERED: soft cover breaks under any real splash; STRUCTURAL walls,
   *     slits and barricades breach only under HEAVY sources (120mm-class,
   *     demo charges, the drill, Titan); METAL and the map rim never break.
   *   · MONOTONIC: a breach is walkable rubble — destruction only ever OPENS
   *     paths, so the fronts' reachability law survives any sequence.
   *   · ONE SEAM: damage arrives here from the same explode() every shell
   *     already uses; sight/movement change purely by the tile's new type. */
  damageWall(tx: number, tz: number, dmg: number, heavy: boolean) {
    if (tx < 1 || tz < 1 || tx >= this.map.geometry.cols - 1 || tz >= this.map.geometry.rows - 1) return; // the rim holds, always
    const idx = tileIndex(this.map.geometry, tx, tz);
    const t = this.map.grid[idx];
    const rubble = t === T_RUBBLE;
    // this system eats destructible structure/cover/rubble — NOT metal (drill
    // only), doors (damageDoor), water or open ground. HP + the heavy gate now
    // come from the MATERIALS table (one source of truth).
    const destructible = t === T_COVER || t === T_WALL || t === T_SLIT || t === T_CLIMB || rubble;
    if (!destructible) return;
    const mat = materialOf(t);
    if (mat.heavyOnly && !heavy) return;                 // masonry/stone shrug off small arms
    const hp = (this.wallHp.get(idx) ?? mat.hp) - dmg;
    if (hp > 0) { this.wallHp.set(idx, hp); return; }    // damaged, still standing
    this.wallHp.delete(idx);
    const pos = tileToWorld(this.map.geometry, tx, tz);
    if (rubble) {
      // the pile itself dies — gone, open ground (rides the dug wire)
      this.map.grid[idx] = T_OPEN;
      this.dug.push(idx);
      this.emit({ type: 'dig', tile: idx, pos });
    } else {
      this.map.grid[idx] = T_RUBBLE;
      this.breached.push(idx);
      this.emit({ type: 'wallbreak', tile: idx, pos });
    }
  }

  /** Route projectile surface damage to the right system: wood doors have their
   *  own break path (damageDoor), everything else is damageWall. The surface-
   *  reaction resolve uses this so penetrate + impact chip doors too. */
  private damageSurface(x: number, z: number, dmg: number, heavy: boolean, byId: number) {
    const [tx, tz] = worldToTile(this.map.geometry, x, z);
    const idx = tileIndex(this.map.geometry, tx, tz);
    const t = this.map.grid[idx];
    if (t === T_DOOR || t === T_DOOR_OPEN) this.damageDoor(idx, dmg, byId);
    else this.damageWall(tx, tz, dmg, heavy);
  }

  id(): number { return this.nextId++; }

  emit(e: SimEvent) { this.events.push(e); }

  takeEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------- population ----------

  addSoldier(name: string, classId: ClassId, team: Team, kind: SoldierKind, loadout?: Loadout): Soldier {
    const c = CLASSES[classId];
    // bots draw varied primaries from the class armory; humans pass a loadout
    let primary = loadout?.primary && WEAPONS[loadout.primary] ? loadout.primary : c.primary;
    const secondary = loadout?.secondary && WEAPONS[loadout.secondary] ? loadout.secondary : c.secondary;
    if (kind === 'bot' && !loadout?.primary && this.rng.next() < 0.55) {
      const fams = CLASS_ARMORY[classId];
      const fam = fams[this.rng.int(0, fams.length - 1)];
      const pool = familyWeapons(WEAPONS, fam);
      if (pool.length) primary = pool[this.rng.int(0, pool.length - 1)].id;
    }
    const s: Soldier = {
      id: this.id(), kind, name, team, classId,
      pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0,
      hp: c.hp, maxHp: c.hp, energy: 100, alive: false, respawnAt: 0,
      weaponIdx: 0, weapons: [primary, secondary],
      clip: [WEAPONS[primary].clip, WEAPONS[secondary].clip],
      reserve: [WEAPONS[primary].reserve, WEAPONS[secondary].reserve],
      reloadUntil: 0, nextFireAt: 0,
      altAmmo: WEAPONS[primary].alt?.ammo ?? 0, nextAltAt: 0, altBurstUntil: 0,
      grenades: classId === 'infantry' ? 4 : classId === 'engineer' ? 3 : 2,
      nextGrenadeAt: 0, cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0, ownerId: -1,
      longestKill: 0, vehicleKills: 0, healGiven: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0, manpads: 0, lastKillerId: -1,
      floor: 0,
      armor: 0, maxArmor: 0, protectedUntil: 0,
      equipment: (loadout?.equipment ?? []).filter((id) => EQUIPMENT[id]).slice(0, 2),
      medikitReady: true, nextPsiAt: 0, nextRepairAt: 0,
      downed: false, downedUntil: 0, downedBy: -1, reviveProgress: 0, draggingId: -1,
      meleeStrikeAt: 0, meleeYaw: 0, meleeWeapon: '',
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    // §15 THE SQUAD CONTAINER (finish-list #14): four to a fireteam, by
    // roster order — offline, your friendly bots ARE your squad. Dogs and
    // the horde stay outside the org chart.
    if ((kind === 'human' || kind === 'bot') && !isZed(kind)) {
      let mates = 0;
      for (const o of this.soldiers.values()) {
        if (o.team === team && (o.kind === 'human' || o.kind === 'bot')) mates++;
      }
      s.squadId = team * 100 + Math.floor(mates / 4);
    }
    this.soldiers.set(s.id, s);
    this.soldierIndex.add(s); // queryable the tick it spawns (opt #38)
    this.rosterCache = null;  // opt #8: the ONLY human/bot add site — drop the cache
    this.spawn(s);
    return s;
  }

  /**
   * A LIVING SUPER WEAPON drops onto the field (§21.6). Built on a Soldier —
   * same rig, same bullets kill it — with threat-scaled HP, its faction's
   * palette speed, and its `ascendant` identity. At most one per faction:
   * a second call for the same side is refused. Returns the LSW, or null if
   * the mode forbids it or the slot is taken.
   */
  /** pending officer-called LSW drops: announced now, land after the
   *  telegraph (bigger threat = longer dread). One slot per faction.
   *  `callerId` is the soldier who made the call — if that soldier is a
   *  HUMAN still standing when the pod slams down, the pod is THEIRS (§7). */
  pendingLsw: { id: AscendantId; team: Team; landsAt: number; pos: Vec3; callerId: number }[] = [];
  /** Oblivion's live black holes — each drags enemy soldiers AND hulls inward
   *  for its telegraph, then bursts at burstAt. Stepped every tick. */
  blackHoles: { x: number; z: number; team: Team; ownerId: number; burstAt: number; charge?: number }[] = [];
  /** FORCE FIELDS (§4.4 #2, the shared mechanic): sustained radial pulls /
   *  pushes and directional shoves, re-applied every tick so they survive the
   *  impulse decay. One system → Gravity Warden, Riptide, Oblivion's hole,
   *  Stormcaller's tornado. `radial` < 0 pulls INWARD toward (x,z), > 0
   *  shoves OUTWARD; (fx,fz) adds a directional current. Soldiers on the
   *  owner's team are exempt; vehicles move only when CREWED (an abandoned
   *  wreck is nobody's toy — the §8.1a requisition law). */
  forceFields: { x: number; z: number; r: number; radial: number; fx?: number; fz?: number; team: Team; ownerId: number; until: number }[] = [];
  /** DELAYED DETONATIONS — a blast that goes off later, on its own clock (the
   *  grav grenade's implosion once the pull has clustered the squad; a time
   *  bomb's countdown). Processed at the top of step(); resolves through the
   *  shared explode() so rings/falloff come free. */
  pendingBlasts: { x: number; y: number; z: number; at: number; weapon: WeaponId; ownerId: number; team: Team }[] = [];
  /** §17 MATERIEL (finish-list #4): each faction's purse for LSW calls —
   *  opens at 10, drips +1 every 60s (cap 14). THREAT[].materiel is the
   *  price per tier, so a T4 costs most of the afternoon. */
  materiel: [number, number] = [10, 10];
  /**
   * B1 THE WAR LEDGER (Robert: "a budget on each side… if you won and were
   * underfunded it increased your morale — we could keep track of those kind
   * of things"). Every side's account: materiel SPENT (gods, warheads) and
   * hulls LOST (each vehicle's requisition cost). The whistle compares books:
   * a winner who spent meaningfully less than the loser earns an UNDERFUNDED
   * VICTORY — the campaign banks it as morale.
   */
  warLedger: [{ spent: number; hulls: number }, { spent: number; hulls: number }] =
    [{ spent: 0, hulls: 0 }, { spent: 0, hulls: 0 }];

  /** the whole bill for one side: what it spent plus what it lost */
  warCost(team: Team): number {
    return this.warLedger[team].spent + this.warLedger[team].hulls;
  }
  private nextMaterielDripAt = 60;

  private stepForceFields() {
    this.forceFields = this.forceFields.filter((f) => this.time < f.until);
    for (const f of this.forceFields) {
      for (const e of this.soldiers.values()) {
        if (!e.alive || e.team === f.team || e.encasedUntil !== undefined) continue;
        const dx = f.x - e.pos.x, dz = f.z - e.pos.z, d = Math.hypot(dx, dz);
        if (d > f.r) continue;
        const inv = d > 0.4 ? 1 / d : 0; // the radial term has a dead-zone at the singularity
        e.pushX += -dx * inv * f.radial + (f.fx ?? 0);
        e.pushZ += -dz * inv * f.radial + (f.fz ?? 0);
      }
      for (const v of this.vehicles.values()) {
        if (!v.alive || v.team === f.team || !v.seats.some((id) => id >= 0)) continue;
        const dx = f.x - v.pos.x, dz = f.z - v.pos.z, d = Math.hypot(dx, dz);
        if (d > f.r) continue;
        const inv = d > 0.4 ? 1 / d : 0;
        v.vel.x += (-dx * inv * f.radial + (f.fx ?? 0)) * 0.6;
        v.vel.z += (-dz * inv * f.radial + (f.fz ?? 0)) * 0.6;
      }
    }
  }

  /** Fire any delayed blast whose clock has come due (grav implosions, time
   *  bombs). Resolves through the shared explode() so the rings/falloff are free. */
  private stepPendingBlasts() {
    if (!this.pendingBlasts.some((b) => this.time >= b.at)) return;
    const ready = this.pendingBlasts.filter((b) => this.time >= b.at);
    this.pendingBlasts = this.pendingBlasts.filter((b) => this.time < b.at);
    for (const b of ready) this.explode({ x: b.x, y: b.y, z: b.z }, WEAPONS[b.weapon], b.ownerId, b.team);
  }

  /** TIME FIELDS (§4.4 #3, the shared mechanic → Chronos): zones where
   *  movement and rounds integrate at `mul` speed. Never clock manipulation —
   *  the sim stays deterministic 30Hz; only POSITION ADVANCE scales. The
   *  field's OWNER walks free: he strolls through his own frozen bullet-wall. */
  timeFields: { x: number; z: number; r: number; mul: number; ownerId: number; until: number }[] = [];

  /** the strongest (slowest) time-field multiplier at a point; the owner of a
   *  field is exempt from it (pass their soldier id). */
  timeMulAt(x: number, z: number, exemptOwnerId = -1): number {
    let m = 1;
    for (const f of this.timeFields) {
      if (this.time >= f.until) continue;
      if (exemptOwnerId >= 0 && f.ownerId === exemptOwnerId) continue; // the owner walks free (−1 = nobody)
      const dx = x - f.x, dz = z - f.z;
      if (dx * dx + dz * dz < f.r * f.r) m = Math.min(m, f.mul);
    }
    return m;
  }
  /** the bot officer's next radio check per team (staggered so the two
   *  factions never call in the same breath) */
  private nextLswCallAt: [number, number] = [90, 110];

  /**
   * The officer's call (§6): spend the stable's materiel, announce the drop,
   * and set the countdown. Both sides get the warning — the fight bends
   * around it. A human caller plants the LZ WHERE THEY STAND — you mark the
   * spot, you hold it for the countdown, the pod is yours. Returns false if
   * the mode forbids it or the slot is taken.
   */
  requestLsw(id: AscendantId, team: Team, callerId = -1): boolean {
    if (!lswAllowed(this.mode.id)) return false;
    // W3.4 PASS ESCALATION: the front's pass gates the stables. P1 = the
    // gods sleep; P2 = only the ENEMY stable (team 1, the Collective)
    // answers — the war escalates AT you before it escalates FOR you;
    // P3/absent = both stables are loose (every off-campaign match).
    const pass = this.opts.lswPass ?? 3;
    if (pass <= 1) return false;
    if (pass === 2 && team === 0) return false;
    const def = LSWS[id];
    if (def.faction !== team) return false; // a stable answers only its own faction
    // refuse a second of the same faction — live OR already inbound
    for (const s of this.soldiers.values()) if (s.alive && s.team === team && s.ascendant) return false;
    if (this.pendingLsw.some((p) => p.team === team)) return false;
    // §17 MATERIEL — the call is PRICED (finish-list #4): a T1 is pocket
    // change, a T4 is the stable's whole afternoon. The purse says no
    // before the net says yes, and the drip makes the second call a wait.
    const price = THREAT[def.threat].materiel;
    if (this.materiel[team] < price) return false;
    this.materiel[team] -= price;
    this.warLedger[team].spent += price; // the ledger never forgets a gate fee
    const caller = this.soldiers.get(callerId);
    const src = caller?.alive ? caller.pos : this.map.basePos[team];
    const lz = { x: src.x, y: 0, z: src.z };
    this.pendingLsw.push({ id, team, landsAt: this.time + THREAT[def.threat].telegraph, pos: lz, callerId });
    this.emit({ type: 'pod_incoming', pos: lz, text: def.lines.inbound, big: true });
    this.emit({ type: 'vo', text: `ann_${id}_inbound` }); // the net makes the call
    return true;
  }

  /** Land any LSW whose countdown has run out, and let the bot officer make
   *  its own calls. Called each tick from step(). */
  private stepLswDrops() {
    // THE BOT OFFICER (§7): a faction with NO human on its roster calls its
    // own stable — the war doesn't wait for you to press the button. A
    // faction WITH a human never auto-calls: the officer channel is yours.
    if (lswAllowed(this.mode.id)) {
      for (const team of [0, 1] as Team[]) {
        if (this.time < this.nextLswCallAt[team]) continue;
        this.nextLswCallAt[team] = this.time + 45; // radio checks back in later either way
        let human = false;
        for (const s of this.soldiers.values()) if (s.kind === 'human' && s.team === team) { human = true; break; }
        if (human) continue;
        const picks = lswsForTeam(team);
        if (picks.length) this.requestLsw(picks[this.rng.int(0, picks.length - 1)], team);
      }
    }
    if (this.pendingLsw.length === 0) return;
    this.pendingLsw = this.pendingLsw.filter((p) => {
      if (this.time < p.landsAt) return true;
      // the pod belongs to its caller: a human still on their feet ASCENDS —
      // their own body becomes the weapon. Dead, downed, frozen, or mounted
      // callers forfeit; the stable sends its own pilot (a bot LSW).
      const caller = this.soldiers.get(p.callerId);
      const took = caller && caller.kind === 'human' && caller.alive && !caller.downed &&
        caller.team === p.team && caller.encasedUntil === undefined && caller.vehicleId < 0 && !caller.ascendant
        ? this.ascendSoldier(caller, p.id, p.pos) : false;
      if (!took) this.addLsw(p.id, p.team, p.pos);
      this.emit({ type: 'pod_landed', pos: p.pos });
      return false;
    });
  }

  /**
   * §7 THE ASCENSION: an existing soldier BECOMES the LSW — same id, same
   * killfeed line, new body. Their trooper vanishes in the pod flash and the
   * weapon stands up at the LZ. Death hands the body back: spawn() clears
   * the overlay and the mortal walks again.
   */
  /**
   * GOD MODE (testing only): wear ANY living super weapon on demand, ignoring
   * every rule that normally guards the stable — faction, the one-god-per-team
   * slot, and the no-human-hands-on-a-flier law. Pass `null` to shed the god
   * and go back to a plain trooper. Also flips invulnerability on, because the
   * point is to stand in the open and watch the AI work.
   */
  godMorph(s: Soldier, id: AscendantId | null): boolean {
    s.god = true;
    if (id === null) { // back to a mortal
      if (!s.ascendant) return false;
      s.ascendant = undefined;
      s.rageMul = undefined; s.nextLswAt = undefined; s.nextLswActiveAt = undefined;
      s.lswKillsBase = undefined; s.lswLowSaid = undefined;
      const c = CLASSES[s.classId];
      s.weapons = [c.primary, c.secondary];
      s.weaponIdx = 0;
      s.clip = [WEAPONS[c.primary].clip, WEAPONS[c.secondary].clip];
      s.reserve = [WEAPONS[c.primary].reserve, WEAPONS[c.secondary].reserve];
      s.hp = c.hp; s.maxHp = c.hp;
      this.emit({ type: 'announce', text: 'GOD MODE — back to trooper' });
      return true;
    }
    const def = LSWS[id];
    const threat = THREAT[def.threat];
    // shed any previous god cleanly, then put the new one on
    s.ascendant = id;
    s.weapons = [def.weapon];
    s.weaponIdx = 0;
    s.clip = [Infinity];
    s.reserve = [Infinity];
    s.hp = threat.hp; s.maxHp = threat.hp;
    s.armor = 0; s.maxArmor = 0;
    s.energy = 100;
    s.nextLswAt = 0; s.nextLswActiveAt = 0;
    s.cloaked = false;
    s.lswKillsBase = s.kills;
    s.lswLowSaid = false;
    this.emit({ type: 'warp', pos: { ...s.pos } });
    this.emit({ type: 'announce', text: `GOD MODE — ${def.name}`, big: true });
    this.emit({ type: 'vo', text: `vo_${id}_arrive`, pos: { ...s.pos }, soldierId: s.id });
    return true;
  }

  ascendSoldier(s: Soldier, id: AscendantId, at?: Vec3): boolean {
    if (!lswAllowed(this.mode.id) || !s.alive || s.ascendant) return false;
    if (LSWS[id].faction !== s.team) return false; // your stable, your body
    // D3 (ratified): the TRUE-FLIGHT trio stays AI until the movement model
    // earns Superman/Goku — no human hands on a flier yet.
    if (LSWS[id].flies && s.kind === 'human') return false;
    for (const o of this.soldiers.values()) if (o.alive && o.team === s.team && o.ascendant) return false;
    const def = LSWS[id];
    const threat = THREAT[def.threat];
    if (at) {
      this.emit({ type: 'warp', pos: { ...s.pos } }); // the trooper leaves in light
      s.pos = { ...at, y: 0 };
      s.vel = { x: 0, y: 0, z: 0 };
      this.emit({ type: 'warp', pos: { ...at } });    // the weapon arrives in it
    }
    s.ascendant = id;
    // THE SIGNATURE ARM: the recruit's rifle stays with the recruit — the
    // god picks up the one weapon that IS its identity (family 'lsw')
    s.weapons = [def.weapon];
    s.weaponIdx = 0;
    s.clip = [Infinity];
    s.reserve = [Infinity];
    s.hp = threat.hp; s.maxHp = threat.hp;
    s.armor = 0; s.maxArmor = 0; // threat is HP, never a plate wall
    s.energy = 100;
    s.nextLswAt = 0; s.nextLswActiveAt = 0;
    s.cloaked = false;
    s.protectedUntil = this.time + 2; // the pod flash — landing is not an ambush
    s.lswKillsBase = s.kills;
    s.lswLowSaid = false;
    this.emit({ type: 'announce', text: def.lines.landed, big: true });
    this.emit({ type: 'vo', text: `ann_${id}_landed` });
    this.emit({ type: 'vo', text: `vo_${id}_arrive`, pos: { ...s.pos }, soldierId: s.id });
    return true;
  }

  addLsw(id: AscendantId, team: Team, at?: Vec3): Soldier | null {
    if (!lswAllowed(this.mode.id)) return null;
    if (LSWS[id].faction !== team) return null; // a stable answers only its own faction
    for (const s of this.soldiers.values()) {
      if (s.alive && s.team === team && s.ascendant) return null; // slot taken
    }
    const def = LSWS[id];
    const threat = THREAT[def.threat];
    const s = this.addSoldier(def.name, 'infantry', team, 'bot');
    s.ascendant = id;
    s.weapons = [def.weapon]; // the signature arm, never infantry issue
    s.weaponIdx = 0;
    s.clip = [Infinity];
    s.reserve = [Infinity];
    s.hp = threat.hp;
    s.maxHp = threat.hp;
    s.armor = 0; s.maxArmor = 0; // threat is HP, never a plate wall
    s.nextLswAt = 0;
    if (at) { s.pos = { ...at }; s.alive = true; s.respawnAt = 0; }
    s.lswKillsBase = s.kills;
    s.lswLowSaid = false;
    this.emit({ type: 'announce', text: def.lines.landed, big: true });
    this.emit({ type: 'vo', text: `ann_${id}_landed` });
    this.emit({ type: 'vo', text: `vo_${id}_arrive`, pos: { ...s.pos }, soldierId: s.id });
    return s;
  }

  /**
   * A Living Super Weapon's SIGNATURE, layered on top of the normal fight
   * (stepBot already moves it and fires its rifle). Each LSW's ability is
   * built from shipped systems only — Firebrand and Plaguebearer are pure
   * field plays, no new mechanics. The bot brain sets the intent; this
   * cashes it as telegraphed SimEvents the counter-play can read.
   */
  private stepLsw(s: Soldier, dt: number) {
    const def = LSWS[s.ascendant!];
    // ── THE LEAP (movement doctrine): Hulk-class ballistics. The landing
    // shadow grows the whole flight (the fair-warning law, same as the
    // flop), mid-air he is SOFT (the generalized AA window), and the
    // landing shoves without hurting — travel is travel.
    if (def.moves === 'leap' && s.kind === 'bot' && s.encasedUntil === undefined) {
      if (s.diveAt !== undefined && s.diveX !== undefined && s.diveZ !== undefined) {
        const left = s.diveAt - this.time;
        if (left > 0) {
          const k = Math.min(1, dt / Math.max(left, dt));
          s.pos = { x: s.pos.x + (s.diveX - s.pos.x) * k, y: Math.min(6, s.pos.y + 14 * dt) * (left > 0.35 ? 1 : left / 0.35), z: s.pos.z + (s.diveZ - s.pos.z) * k };
          s.vel = { x: 0, y: 0, z: 0 };
        } else {
          s.pos = { x: s.diveX, y: 0, z: s.diveZ };
          // SHOCKWAVE (projectile-fx Task 9): a slam with a shockwave weapon
          // HURTS in a wider ring (falloff by distance), not just shoves; a
          // plain leaper still only shoves ("travel is travel").
          const lw = WEAPONS[s.weapons[s.weaponIdx]];
          const sw = lw?.shockwave ?? 0;
          const r = sw > 0 ? sw : 3.5;
          for (const e of this.soldiers.values()) {
            if (!e.alive || e.team === s.team || e.id === s.id) continue;
            const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, dd = Math.hypot(dx, dz);
            if (dd > r || dd < 0.01) continue;
            e.pushX += (dx / dd) * 18 * (sw > 0 ? 1.3 : 1); e.pushZ += (dz / dd) * 18 * (sw > 0 ? 1.3 : 1);
            if (sw > 0) {
              this.damageSoldier(e, lw.damage * (1 - dd / r), s.id, s.weapons[s.weaponIdx]); // ring falloff
              // W1.5: the heavy slam (Titan-class) is past the threshold — it
              // FLIPS, it doesn't just shove. A plain leap stays travel.
              this.maybeRagdoll(e, 18 * 1.3);
            }
          }
          // the slam cracks masonry in the ring (heavy — breaches cover walls)
          if (sw > 0) {
            const [cx, cz] = worldToTile(this.map.geometry, s.pos.x, s.pos.z);
            const rt = Math.ceil(sw / this.map.geometry.tile);
            for (let dzt = -rt; dzt <= rt; dzt++) for (let dxt = -rt; dxt <= rt; dxt++) {
              if (dxt * dxt + dzt * dzt <= rt * rt) this.damageWall(cx + dxt, cz + dzt, lw.damage, true);
            }
          }
          this.emit({ type: 'explosion', pos: { ...s.pos }, weapon: sw > 0 ? s.weapons[s.weaponIdx] : 'gl' });
          s.diveAt = undefined; s.diveX = undefined; s.diveZ = undefined;
        }
      } else if (this.time >= (s.nextLeapAt ?? 0)) {
        s.nextLeapAt = this.time + 6; // tighter cadence — a leaper closes, not saunters
        let tgt: Soldier | undefined, best = 34;
        for (const e of this.soldiers.values()) {
          if (!e.alive || e.team === s.team || e.encasedUntil !== undefined) continue;
          const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
          if (d >= 12 && d < best) { best = d; tgt = e; }
        }
        if (tgt) {
          const dx = tgt.pos.x - s.pos.x, dz = tgt.pos.z - s.pos.z, dl = Math.hypot(dx, dz) || 1;
          const reach = Math.max(8, Math.min(30, dl * 0.9)); // hop scales to the gap: short in a room, big in the open
          s.diveAt = this.time + 1.2;
          s.diveX = s.pos.x + (dx / dl) * reach;
          s.diveZ = s.pos.z + (dz / dl) * reach;
          this.emit({ type: 'lsw_active', pos: { x: s.diveX, y: 0, z: s.diveZ }, text: s.ascendant!, soldierId: s.id });
        }
      }
    }
    // ── THE BLINK-WALK: a hop every 1.6s covering what walking would have —
    // net speed unchanged, but between hops he is PERFECTLY STILL. You
    // can't lead a target that doesn't travel; punish the rhythm instead.
    if (def.moves === 'blinkwalk' && s.kind === 'bot' && s.encasedUntil === undefined) {
      if (this.time >= (s.nextBlinkAt ?? 0)) {
        s.nextBlinkAt = this.time + 1.6; // snappier hop — the still-window stays the counterplay
        const goal = s.botGoal ?? null;
        const dx = goal ? goal.x - s.pos.x : Math.cos(s.yaw), dz = goal ? goal.z - s.pos.z : Math.sin(s.yaw);
        const dl = Math.hypot(dx, dz) || 1;
        for (const hop of [15, 10, 5]) {
          const nx = s.pos.x + (dx / dl) * Math.min(hop, dl);
          const nz = s.pos.z + (dz / dl) * Math.min(hop, dl);
          if (!isBlocked(this.map.grid, nx, nz, false, this.map.geometry)) {
            this.emit({ type: 'blink', pos: { ...s.pos } });
            s.pos = { x: nx, y: 0, z: nz };
            this.emit({ type: 'blink', pos: { ...s.pos } });
            break;
          }
        }
      }
      s.vel.x = 0; s.vel.z = 0; // between hops: statue-still — the window
    }
    // §5: ONE BRAIN FILE PER LSW — src/sim/lsw/<id>.ts, each deterministic,
    // DOM-free, carrying BOTH abilities. This just dispatches.
    LSW_BRAINS[s.ascendant!]?.step(this, s, dt);
  }

  /** The black hole's BURST timing — the drag itself rides the shared
   *  force-field system (a radial −5 field with the same lifetime). Sprint
   *  TANGENTIALLY to escape; when the telegraph runs out, it collapses. */
  /**
   * V3 THE SKY IS NEVER FREE (Robert: "every base should start off with a
   * surface-to-air missile"). Every AA hull — the Lance track and the base
   * emplacement — sweeps for aircraft on its own reload clock and fires
   * without a crew. A base always has SOME answer to a jet; taking the sky
   * costs you a sortie against the launcher first.
   */
  /**
   * THE BODY FALLS (Robert: "there is no ragdoll for killing… it'd be nice to
   * see it knock you back… knock you into a wall or something").
   *
   * The main loop skips everything for a soldier who is not alive, so until
   * now a corpse froze at the exact position of the killing frame — mid-stride,
   * mid-air, unmoved by the blast that killed it. This gives a dead body the
   * one thing it needs and nothing else: the physics to finish falling.
   *
   * Deliberately NOT the full soldier step — no commands, no equipment, no
   * powers, no abilities. Just the shove, gravity, and the walls. It lives in
   * the SIM rather than the renderer on purpose: snapshots serialize the whole
   * soldier, so a body that falls here also falls in the death cam and in
   * every other client. A client-side flop would be invisible in the one
   * camera built to watch it.
   */
  private stepCorpses(dt: number) {
    for (const s of this.soldiers.values()) {
      if (s.alive || s.corpseUntil === undefined) continue;
      if (this.time >= s.corpseUntil) { s.corpseUntil = undefined; continue; }
      // gravity, then the ground
      s.vel.y -= 22 * dt;
      s.pos.y = Math.max(0, s.pos.y + s.vel.y * dt);
      if (s.pos.y <= 0) { s.pos.y = 0; if (s.vel.y < 0) s.vel.y = 0; }
      const grounded = s.pos.y <= 0.01;
      const nx = s.pos.x + s.pushX * dt;
      const nz = s.pos.z + s.pushZ * dt;
      // THE WALL SLAM. Bodies stop dead against masonry instead of sliding
      // along it — and a body that arrives fast enough says so, which is the
      // hook the renderer hangs the crunch and the smear on.
      const hitX = isBlocked(this.map.grid, nx, s.pos.z, false, this.map.geometry);
      const hitZ = isBlocked(this.map.grid, s.pos.x, nz, false, this.map.geometry);
      if (hitX || hitZ) {
        const speed = Math.hypot(s.pushX, s.pushZ);
        if (speed > 9) {
          this.emit({ type: 'corpse_slam', pos: { ...s.pos }, soldierId: s.id });
          s.pushX = 0; s.pushZ = 0;   // all of it goes into the wall
        } else {
          if (hitX) s.pushX = 0;
          if (hitZ) s.pushZ = 0;
        }
      }
      if (!hitX) s.pos.x = Math.max(-halfWidth(this.map.geometry) + 1, Math.min(halfWidth(this.map.geometry) - 1, nx));
      if (!hitZ) s.pos.z = Math.max(-halfDepth(this.map.geometry) + 1, Math.min(halfDepth(this.map.geometry) - 1, nz));
      // friction: a body in the air keeps its momentum; one on the deck skids
      // to a stop like the sack of meat it now is
      const drag = grounded ? 7 : 1.2;
      const k = Math.exp(-drag * dt);
      s.pushX *= k; s.pushZ *= k;
      if (Math.abs(s.pushX) < 0.05) s.pushX = 0;
      if (Math.abs(s.pushZ) < 0.05) s.pushZ = 0;
    }
  }

  private stepAntiAir() {
    for (const v of this.vehicles.values()) {
      if (!v.alive || !VEHICLES[v.kind].antiAir) continue;
      if (this.time < v.nextFireAt) continue;
      // a crewed launcher reloads faster than an automated one — a gunner
      // is worth something
      const crewed = v.seats[0] >= 0;
      const target = this.hullLockTarget(v);
      if (!target) {
        // A SWEEP HAS A PERIOD. An empty sky means the dish goes back around
        // before it looks again — without this, every idle launcher rescans
        // every vehicle and every soldier 60 times a second for nothing, and
        // an armour map fields a lot of idle launchers.
        v.nextFireAt = this.time + AA_SWEEP;
        continue;
      }
      const def = WEAPONS.aa_missile;
      v.nextFireAt = this.time + (1 / def.rof) * (crewed ? 1 : 1.9);
      this.fireHullSam(v, target, crewed ? v.seats[0] : -1);
    }
  }

  private stepBlackHoles() {
    this.blackHoles = this.blackHoles.filter((bh) => {
      if (this.time >= bh.burstAt) {
        // M4 THE OVERDRAW PAYS OFF AT THE COLLAPSE: a hole opened on a full
        // tank bursts wider and harder. charge 0 = the free hole (today's
        // numbers); charge 1 = everything he had.
        const ch = bh.charge ?? 0;
        // THE DAMAGE NEVER SCALES. §counterplay's published law for Oblivion
        // is "the hole drags you in and HURTS, BUT DOES NOT KILL" — a full-HP
        // rifleman walks out at 25. Scaling the damage made an overdrawn
        // collapse lethal and broke that promise on the first run.
        // So the overdraw buys REACH, PULL, and THE FLIP instead: at full
        // charge the collapse ragdolls everyone in it. A god who leaves the
        // whole enemy squad face-down at his feet has not been nerfed — he
        // handed his team four free kills without breaking his own law.
        const def = {
          ...WEAPONS.gl,
          splash: WEAPONS.gl.splash * (1 + ch * 0.55),
          knockback: WEAPONS.gl.knockback * (1 + ch * 1.4), // 13 → 31: it FLIPS
        };
        this.explode({ x: bh.x, y: 0, z: bh.z }, def, bh.ownerId, bh.team);
        this.emit({ type: 'explosion', pos: { x: bh.x, y: 0, z: bh.z }, weapon: 'gl', radius: def.splash, killRadius: def.splash * 0.4 });
        return false;
      }
      return true;
    });
  }

  /**
   * §7 THE SIGNATURE ON Q: a human pilot's active. Whiffs never burn the
   * cooldown — a signature that punishes you for pressing it stops being
   * pressed. Every active is built from shipped systems; the class kit
   * yields (applyCmd blanks cmd.ability for ascendants after this runs).
   */
  private lswActive(s: Soldier) {
    // dispatched to the unit's brain (src/sim/lsw/<id>.ts). The brain returns
    // true only when the signature actually fired — whiffs keep the key hot.
    const id = s.ascendant!;
    if (LSW_BRAINS[id]?.active(this, s)) s.nextLswActiveAt = this.time + LSWS[id].activeCd;
  }

  /**
   * §5.3 Military working dogs. One K9 per team, paired to a handler — the
   * dog deploys at their side and redeploys with them for the whole match.
   */
  addDog(handler: Soldier): Soldier {
    for (const other of this.soldiers.values()) {
      if (other.kind === 'dog' && other.team === handler.team) return other; // the kennel issues one per side
    }
    const s: Soldier = {
      id: this.id(), kind: 'dog', name: DOG_NAMES[this.rng.int(0, DOG_NAMES.length - 1)],
      team: handler.team, classId: 'infantry',
      pos: { x: handler.pos.x + this.rng.range(-1.5, 1.5), y: 0, z: handler.pos.z + this.rng.range(-1.5, 1.5) },
      vel: { x: 0, y: 0, z: 0 }, yaw: handler.yaw,
      hp: DOG_STATS.hp, maxHp: DOG_STATS.hp, energy: 0, alive: true, respawnAt: 0,
      weaponIdx: 0, weapons: [DOG_STATS.weapon], clip: [Infinity], reserve: [Infinity],
      reloadUntil: 0, nextFireAt: 0, grenades: 0, nextGrenadeAt: 0,
      altAmmo: 0, nextAltAt: 0, altBurstUntil: 0,
      cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0, ownerId: handler.id,
      longestKill: 0, vehicleKills: 0, healGiven: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0, manpads: 0, lastKillerId: -1, floor: 0,
      armor: 0, maxArmor: 0, protectedUntil: 0,
      equipment: [], medikitReady: false, nextPsiAt: 0, nextRepairAt: 0,
      downed: false, downedUntil: 0, downedBy: -1, reviveProgress: 0, draggingId: -1,
      meleeStrikeAt: 0, meleeYaw: 0, meleeWeapon: '',
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    this.soldiers.set(s.id, s);
    this.soldierIndex.add(s); // queryable the tick it spawns (opt #38)
    this.emit({ type: 'respawn', pos: s.pos, soldierId: s.id });
    return s;
  }

  /** The VIP. Unarmed, doesn't respawn — the safehouse match ends when he dies. */
  addScientist(pos: Vec3): Soldier {
    const s: Soldier = {
      id: this.id(), kind: 'scientist', name: 'Dr. Voss', team: 0, classId: 'medic',
      pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, yaw: 0,
      hp: 160, maxHp: 160, energy: 0, alive: true, respawnAt: 0,
      weaponIdx: 0, weapons: ['pistol'], clip: [0], reserve: [0],
      reloadUntil: 0, nextFireAt: 0, grenades: 0, nextGrenadeAt: 0,
      altAmmo: 0, nextAltAt: 0, altBurstUntil: 0,
      cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0, ownerId: -1,
      longestKill: 0, vehicleKills: 0, healGiven: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0, manpads: 0, lastKillerId: -1, floor: 0,
      armor: 0, maxArmor: 0, protectedUntil: 0,
      equipment: [], medikitReady: false, nextPsiAt: 0, nextRepairAt: 0,
      downed: false, downedUntil: 0, downedBy: -1, reviveProgress: 0, draggingId: -1,
      meleeStrikeAt: 0, meleeYaw: 0, meleeWeapon: '',
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    this.soldiers.set(s.id, s);
    this.soldierIndex.add(s); // queryable the tick it spawns (opt #38)
    return s;
  }

  addZombie(kind: ZedKind, pos: Vec3): Soldier {
    const st = ZOMBIE_STATS[kind];
    const s: Soldier = {
      id: this.id(), kind, name: kind.charAt(0).toUpperCase() + kind.slice(1),
      team: 1, classId: 'infantry',
      pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, yaw: 0,
      hp: st.hp, maxHp: st.hp, energy: 0, alive: true, respawnAt: 0,
      weaponIdx: 0, weapons: [st.weapon], clip: [Infinity], reserve: [Infinity],
      reloadUntil: 0, nextFireAt: 0, grenades: 0, nextGrenadeAt: 0,
      altAmmo: 0, nextAltAt: 0, altBurstUntil: 0,
      cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0, ownerId: -1,
      longestKill: 0, vehicleKills: 0, healGiven: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0, manpads: 0, lastKillerId: -1, floor: 0,
      armor: 0, maxArmor: 0, protectedUntil: 0,
      equipment: [], medikitReady: false, nextPsiAt: 0, nextRepairAt: 0,
      downed: false, downedUntil: 0, downedBy: -1, reviveProgress: 0, draggingId: -1,
      meleeStrikeAt: 0, meleeYaw: 0, meleeWeapon: '',
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    // SPRINTER DORMANCY (OUTBREAK-SPEC §7.1, acceptance #18): a sprinter is
    // terrifying because it's uncommon AND because it lies still until it isn't
    // — dormant and slow until a survivor gets close, is seen, or makes noise.
    if (kind === 'sprinter') s.dormant = true;
    this.soldiers.set(s.id, s);
    this.soldierIndex.add(s); // queryable the tick it spawns (opt #38)
    return s;
  }

  /** THE IRON EATERS (DD SS20, finish-list 12): wreckage that stood up.
   *  Spawned PLATED -- the armor pool is the molt; when fire sheds it the
   *  exposed frame takes double and runs hot (damageSoldier SS20.2). */
  addIronEater(kind: IronKind, pos: Vec3): Soldier {
    const st = IRON_STATS[kind];
    // W3.10: iron eaters wear SERIAL DESIGNATIONS, not species labels — the
    // killfeed reads 'LOOM-03 shredded by …', machine to the last.
    const IRON_TAGS: Record<IronKind, string> = { scraprat: 'RAT', junkhound: 'HOUND', weaver: 'LOOM', ravager: 'WRECK' };
    const s: Soldier = {
      id: this.id(), kind, name: `${IRON_TAGS[kind]}-${String(++this.ironSerial).padStart(2, '0')}`,
      team: 1, classId: 'infantry',
      pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, yaw: 0,
      hp: st.hp, maxHp: st.hp, energy: 0, alive: true, respawnAt: 0,
      weaponIdx: 0, weapons: [st.weapon], clip: [Infinity], reserve: [Infinity],
      reloadUntil: 0, nextFireAt: 0, grenades: 0, nextGrenadeAt: 0,
      altAmmo: 0, nextAltAt: 0, altBurstUntil: 0,
      cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0, ownerId: -1,
      longestKill: 0, vehicleKills: 0, healGiven: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0, manpads: 0, lastKillerId: -1, floor: 0,
      armor: st.plate, maxArmor: st.plate, protectedUntil: 0,
      equipment: [], medikitReady: false, nextPsiAt: 0, nextRepairAt: 0,
      downed: false, downedUntil: 0, downedBy: -1, reviveProgress: 0, draggingId: -1,
      meleeStrikeAt: 0, meleeYaw: 0, meleeWeapon: '',
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    this.soldiers.set(s.id, s);
    this.soldierIndex.add(s); // queryable the tick it spawns (opt #38)
    return s;
  }

  /** DEATH RE-SELECT (Robert: "I should be able to select my stuff after
   *  every time I die, and just continue on"). While the body waits on the
   *  respawn clock, re-sign as another class/loadout — spawn() derives the
   *  whole kit from these fields, so the change simply IS the next deploy.
   *  The living are refused: kit changes happen at the printer, not mid-fight. */
  redeployAs(s: Soldier, classId: ClassId, loadout?: Loadout): boolean {
    if (s.alive || (s.kind !== 'human' && s.kind !== 'bot')) return false;
    if (!CLASSES[classId]) return false;
    // W3.6 CLASS CHANGE BY REQUEST: the officer rules on it. The LIVE roster
    // (the requester excluded) is the evidence; infantry is always signed.
    // Keeping your CURRENT posting is never a request — re-clicking it holds.
    if (classId !== s.classId) {
      const counts: Partial<Record<ClassId, number>> = {};
      let teamSize = 0;
      for (const t of this.soldiers.values()) {
        if (t.team !== s.team || t.id === s.id) continue;
        if (t.kind !== 'human' && t.kind !== 'bot') continue;
        teamSize++;
        counts[t.classId] = (counts[t.classId] ?? 0) + 1;
      }
      const ruling = ruleOnClassRequest(counts, classId, teamSize + 1);
      if (s.kind === 'human') this.emit({ type: 'announce', text: ruling.reason, big: false });
      if (!ruling.approved) return false;
    }
    const c = CLASSES[classId];
    s.classId = classId;
    s.weapons = [
      loadout?.primary && WEAPONS[loadout.primary] ? loadout.primary : c.primary,
      loadout?.secondary && WEAPONS[loadout.secondary] ? loadout.secondary : c.secondary,
    ];
    s.equipment = (loadout?.equipment ?? []).filter((id) => EQUIPMENT[id]).slice(0, 2);
    return true;
  }

  spawn(s: Soldier) {
    s.floor = 0;
    // K9s don't draw from the armory or the spawn queue like people do —
    // they redeploy at their handler's side with the same teeth as before.
    if (s.kind === 'dog') {
      s.hp = DOG_STATS.hp; s.maxHp = DOG_STATS.hp;
      s.alive = true; s.cloaked = false; s.vehicleId = -1; s.seat = -1;
      s.carryingFlag = -1; s.weaponIdx = 0;
      s.downed = false; s.downedUntil = 0; s.downedBy = -1;
      s.reviveProgress = 0; s.draggingId = -1;
      const handler = this.soldiers.get(s.ownerId);
      const spawnList = this.map.spawns[s.team];
      const base = handler?.alive ? handler.pos : spawnList[this.rng.int(0, spawnList.length - 1)];
      s.pos = { x: base.x + this.rng.range(-1.5, 1.5), y: 0, z: base.z + this.rng.range(-1.5, 1.5) };
      s.vel = { x: 0, y: 0, z: 0 };
      this.emit({ type: 'respawn', pos: s.pos, soldierId: s.id });
      return;
    }
    // §7: death hands the LSW body back — the overlay dies with it and the
    // mortal redeploys as the class they signed up as (stats reset below).
    if (s.ascendant) { s.ascendant = undefined; s.rageMul = undefined; s.nextLswAt = undefined; s.nextLswActiveAt = undefined; s.lswKillsBase = undefined; s.lswLowSaid = undefined; }
      // M5: dying frees a mid-air claim — the buried axe stays in the world
      if (s.axeId === -1) s.axeId = undefined;
      s.axeRecallAt = undefined;
      // M5: dying frees the axe — a buried one stays in the world, but the
      // corpse stops owning a mid-air claim
      if (s.axeId === -1) s.axeId = undefined;
      s.axeRecallAt = undefined;
    const c = CLASSES[s.classId];
    // armor equipment issues PLATE — a separate pool that absorbs damage
    // before hp and never heals back (medics fix flesh, not ceramic).
    // Total effective pool is unchanged from the old maxHp bonus.
    let plate = 0;
    for (const id of s.equipment) plate += EQUIPMENT[id]?.hpBonus ?? 0;
    s.hp = c.hp; s.maxHp = c.hp; s.armor = plate; s.maxArmor = plate; s.energy = 100;
    s.alive = true; s.cloaked = false; s.vehicleId = -1; s.seat = -1;
    s.carryingFlag = -1;
    s.weaponIdx = 0;
    // a fresh deploy stands upright with the bleed slate wiped
    s.downed = false; s.downedUntil = 0; s.downedBy = -1;
    s.reviveProgress = 0; s.draggingId = -1;
    s.streak = 0; s.lastStandSaid = false; // per-life delight state resets on deploy
    s.spawnedAt = this.time; // DEATH-DATA: the clock the death report reads time-alive from
    // keep the soldier's chosen armory loadout across respawns — but a
    // signature arm (family 'lsw') dies with the god: mortals get their kit
    const keep0 = s.weapons[0] && WEAPONS[s.weapons[0]] && WEAPONS[s.weapons[0]].family !== 'lsw';
    const primary = keep0 ? s.weapons[0] : c.primary;
    const secondary = s.weapons[1] && WEAPONS[s.weapons[1]] ? s.weapons[1] : c.secondary;
    s.weapons = [primary, secondary];
    s.clip = [WEAPONS[primary].clip, WEAPONS[secondary].clip];
    s.reserve = [WEAPONS[primary].reserve, WEAPONS[secondary].reserve];
    s.grenades = this.hasEquip(s, 'demoCharge') ? 3 : s.classId === 'infantry' ? 4 : s.classId === 'engineer' ? 3 : 2;
    // the grenade bag: everyone carries smoke; one incendiary for the
    // door-kickers. X cycles the pouch, G throws from it.
    s.smokes = 2;
    s.firebombs = s.classId === 'infantry' || s.classId === 'heavy' ? 1 : 0;
    s.concs = 1; // everyone carries one rattle-nade
    // the new tech (Robert): the grenade specialist packs a singularity + a
    // plasma stick; the demolitions classes carry a planted timer.
    s.gravs = s.classId === 'infantry' ? 1 : 0;
    s.plasmas = s.classId === 'infantry' || s.classId === 'infiltrator' ? 1 : 0;
    s.timebombs = s.classId === 'engineer' || s.classId === 'heavy' ? 1 : 0;
    s.nadeSel = 0;
    s.manpads = this.hasEquip(s, 'samLauncher') ? MANPADS_ROUNDS : 0;
    s.medikitReady = true;
    s.meleeStrikeAt = 0; s.meleeWeapon = ''; // no swing survives a respawn
    s.meleeCharge = 0; s.meleeChargeMul = undefined; // and no half-built Power Strike
    s.guarding = false; s.grabbedUntil = undefined; s.grabbedBy = undefined; s.ctrlStruggle = undefined; s.chokeProgress = undefined; s.chokingId = undefined; s.humanShield = undefined; // no hold survives it either
    // mobile spawn: a crewed APC/transport with live comms. Flying transports
    // become reinforcement doors only after they put skids on the ground.
    const mobile = [...this.vehicles.values()].find(
      (v) => v.team === s.team && this.vehicleMobileSpawnActive(v),
    );
    // enemy-aware spawn selection (55B): of the team's ring points, take the
    // one farthest from any living enemy — never drop a soldier in a lap.
    // A small random tiebreak keeps the ring from becoming one hot corner.
    // Zeds are exempt: the horde pours in anywhere, tactics are for the living.
    const spawnList = this.map.spawns[s.team];
    let ringPick = spawnList[this.rng.int(0, spawnList.length - 1)];
    if (!isZed(s.kind)) {
      let bestScore = -Infinity;
      for (const p of spawnList) {
        let nearest = Infinity;
        let crowd = 0; // friendlies already standing on this pad
        for (const e of this.soldiers.values()) {
          if (!e.alive) continue;
          const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
          if (e.team !== s.team) nearest = Math.min(nearest, d);
          else if (d < 4.5) crowd++;
        }
        // THE DOGPILE FIX (Robert: "they get stuck over each other"): a wave
        // that dies together respawns in the same tick, and the enemy-aware
        // argmax used to hand every one of them the SAME pad — a ±4 tiebreak
        // can't outvote a 20u safety gap. Each body already standing on a
        // pad now costs it 7 points, so the wave DEALS itself across the
        // ring instead of stacking one square.
        const score = Math.min(nearest, 60) + this.rng.range(0, 4) - crowd * 7;
        if (score > bestScore) { bestScore = score; ringPick = p; }
      }
    }
    // §15 SPAWN-ON-SQUADMATE (finish-list #14): you rejoin the fight NEAR
    // YOUR PEOPLE — a living, upright, SAFE squadmate (no enemy within 20u)
    // beats the ring. This is what makes reaching a downed teammate a
    // decision instead of a formality.
    let matePos: Vec3 | null = null;
    if (s.squadId !== undefined && !isZed(s.kind)) {
      for (const m of this.soldiers.values()) {
        if (!m.alive || m.downed || m.id === s.id || m.team !== s.team || m.squadId !== s.squadId) continue;
        let safe = true;
        for (const e of this.soldiers.values()) {
          if (!e.alive || e.team === s.team) continue;
          if (Math.hypot(e.pos.x - m.pos.x, e.pos.z - m.pos.z) < 20) { safe = false; break; }
        }
        // THE STATUE LAW: a mate standing inside masonry (or treading deep
        // water) is a trap, not an anchor — spawning the squad onto a stuck
        // body is how one frozen soldier became a frozen fireteam.
        if (safe && !isBlocked(this.map.grid, m.pos.x, m.pos.z, false, this.map.geometry)) { matePos = m.pos; break; }
      }
    }
    // the APC is a door, not a clown car — a third rides it, not half
    const base = matePos ?? (mobile && this.rng.next() < 0.33 ? mobile.pos : ringPick);
    // THE STATUE LAW, part two: the blind ±2.6u scatter could land a body
    // INSIDE base masonry — where the integrator (destination checks only)
    // vetoes every step forever. Roll until the boots find open ground; a
    // buried anchor falls back to the ring, which the generator keeps open.
    let px = base.x, pz = base.z, placed = false;
    for (let i = 0; i < 12 && !placed; i++) {
      px = base.x + this.rng.range(-2.6, 2.6);
      pz = base.z + this.rng.range(-2.6, 2.6);
      placed = !isBlocked(this.map.grid, px, pz, false, this.map.geometry);
    }
    for (let i = 0; i < 12 && !placed; i++) {
      px = ringPick.x + this.rng.range(-2.6, 2.6);
      pz = ringPick.z + this.rng.range(-2.6, 2.6);
      placed = !isBlocked(this.map.grid, px, pz, false, this.map.geometry);
    }
    if (!placed) { px = ringPick.x; pz = ringPick.z; }
    s.pos = { x: px, y: 0, z: pz };
    s.vel = { x: 0, y: 0, z: 0 };
    // FRESH LIFE (Robert: "give them a chance to try something different"):
    // dying wipes the nav scratch — no marching the old lane out of habit —
    // and rolls a new personality salt: lane bias, indoor posting, ride
    // appetite. The first 8 seconds are the window where a ride gets a look.
    if (s.kind === 'bot') {
      s.botGoal = null;
      s.botRepathAt = 0;
      s.botStuckAt = undefined;
      s.botLastX = undefined; s.botLastZ = undefined;
      s.botLifeSeed = this.rng.int(0, 2) - 1; // −1 | 0 | 1
      s.botFreshUntil = this.time + 8;
    }
    // spawn protection (55B): holds until the first hostile action, 5s cap.
    // §21 The Reprint: the shimmer IS calibration — a fresh sleeve syncing up,
    // the printer finishing its work. Same numbers, honest fiction.
    // Arms on MID-MATCH respawns only — the match-start deployment is deep in
    // friendly ground and needs none. The undead get none either: a horde
    // that can't be shot walking in is no horde.
    s.protectedUntil = isZed(s.kind) || this.time < 0.05 ? 0 : this.time + 5;
    this.emit({ type: 'respawn', pos: s.pos, soldierId: s.id });
  }

  private freshSystems(kind: VehicleKind): VehicleSystems {
    const hp = VEHICLES[kind].systemHp ?? 60;
    const out = {} as VehicleSystems;
    for (const id of SYSTEM_IDS) out[id] = hp;
    return out;
  }

  vehicleMobileSpawnActive(vehicle: Vehicle): boolean {
    const def = VEHICLES[vehicle.kind];
    return vehicle.alive && def.mobileSpawn && vehicle.systems.comms > 0
      && vehicle.seats.some((id) => id >= 0)
      && (!def.flies || (vehicle.band ?? 0) === 0);
  }

  canSubmerge(vehicle: Vehicle): boolean {
    const radius = VEHICLES[vehicle.kind].radius;
    return [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]].every(([dx, dz]) =>
      tileAt(this.map.grid, vehicle.pos.x + dx, vehicle.pos.z + dz, this.map.geometry) === T_DEEP,
    );
  }

  submarineDetectedForTeam(target: Vehicle, team: Team): boolean {
    if (target.team === team || !target.submerged) return true;
    for (const source of this.vehicles.values()) {
      if (!source.alive || source.team !== team) continue;
      const distance = Math.hypot(source.pos.x - target.pos.x, source.pos.z - target.pos.z);
      if (source.kind === 'submarine' && source.seats.some((id) => id >= 0) && distance <= 65) return true;
      const crew = VEHICLES[source.kind].crew;
      const sensorIndex = crew?.indexOf('sensors') ?? -1;
      if (sensorIndex >= 0 && source.systems.sensors > 0 && source.seats[sensorIndex + 1] >= 0 && distance <= 55) return true;
    }
    return false;
  }

  spawnVehicle(kind: VehicleKind, team: Team, padPos: Vec3, padId = -1): Vehicle {
    const def = VEHICLES[kind];
    const v: Vehicle = {
      id: this.id(), kind, team,
      pos: { ...padPos }, vel: { x: 0, y: 0, z: 0 },
      yaw: team === 0 ? 0 : Math.PI, turretYaw: 0,
      hp: def.hp, maxHp: def.hp,
      seats: new Array(def.seats).fill(-1),
      nextFireAt: 0, alive: true, respawnAt: 0, padPos: { ...padPos },
      stunnedUntil: 0,
      systems: this.freshSystems(kind), nextDigAt: 0, nextHealAt: 0, spoolUntil: 0,
      flares: FLARES_PER_LIFE,
      requisitionedBy: -1, padId, padTeam: team, abandonedAt: 0, hotwireProgress: 0,
    };
    this.vehicles.set(v.id, v);
    return v;
  }

  // ---------- main loop ----------

  /** Puppet worlds (multiplayer clients) only extrapolate motion; the server is authoritative. */
  puppet = false;

  step(dt: number, cmds: Map<number, PlayerCmd>) {
    this.time += dt;
    this.tick++;
    if (this.puppet) {
      for (const s of this.soldiers.values()) if (s.alive) this.stepSoldierPhysics(s, dt);
      for (const v of this.vehicles.values()) {
        if (!v.alive) continue;
        v.pos.x += v.vel.x * dt;
        v.pos.z += v.vel.z * dt;
      }
      for (const p of this.projectiles.values()) {
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += p.vel.z * dt;
      }
      return;
    }
    // opt #38 (S2): refill the soldier index once, up front — every hot scan
    // this tick (zombie targeting, findTarget, projectiles, melee, separation)
    // queries it instead of walking the whole roster
    this.soldierIndex.rebuild(this.soldiers);
    // opt #11 (S8): snapshot the (near-always-empty) encased set once, so the
    // per-soldier movement scan reads a short list instead of the full roster.
    this.encasedBodies.length = 0;
    for (const o of this.soldiers.values()) if (o.encasedUntil !== undefined && o.alive) this.encasedBodies.push(o);
    if (this.tick === 1 && this.map.theater) assignVehicleRoles(this);
    if (!this.mode.over) {
      if (this.operation) stepWorldOperation(this, dt);
      else stepMode(this, dt);
    }
    stepBlackbox(this); // the crowd flight recorder samples on its own 2s clock
    stepVehicleTelemetry(this);
    this.stepHomeDoors(); // base doors open for their own; shut behind them
    // the materiel drip (§17): war production never stops, it just crawls
    if (this.time >= this.nextMaterielDripAt) {
      this.nextMaterielDripAt += 60;
      for (const t of [0, 1] as const) this.materiel[t] = Math.min(14, this.materiel[t] + 1);
    }
    if (!this.mode.over) this.stepLswDrops(); // §21.6: telegraphed LSW landings
    if (this.forceFields.length) this.stepForceFields(); // §4.4 #2: the pulls and the shoves
    if (this.pendingBlasts.length) this.stepPendingBlasts(); // grav implosions, time-bomb countdowns
    this.stepCorpses(dt);                               // the dead finish falling
    if (this.outbreakEnabled) this.stepOutbreak(dt);    // the living incubate, the dead rise
    this.stepAntiAir();                                 // V3: the sky is never free
    if (this.blackHoles.length) this.stepBlackHoles(); // Oblivion's void (burst timing)
    // expired time bubbles pop quietly
    if (this.timeFields.length) this.timeFields = this.timeFields.filter((f) => this.time < f.until);
    // possessed machines come home when the hold expires (§4.4 #4). opt #27
    // (S9): skip all three expiry scans — one of which walks the FULL roster —
    // whenever nothing is possessed (the near-always case; a horde never is).
    if (this.possessionCount > 0) {
      for (const t of this.turrets.values()) {
        if (t.possessedUntil !== undefined && this.time >= t.possessedUntil) this.evictPossession(t);
      }
      for (const b of this.soldiers.values()) {
        if (b.possessedUntil !== undefined && (this.time >= b.possessedUntil || !b.alive)) this.evictBotPossession(b);
      }
      for (const v of this.vehicles.values()) {
        if (v.possessedUntil !== undefined && (this.time >= v.possessedUntil || !v.alive)) this.evictVehiclePossession(v);
      }
    }
    // the overload fuses: at the 2s mark the hull DETONATES — unless the
    // crew bailed, in which case the charge fizzles and the armor survives
    for (const v of this.vehicles.values()) {
      if (v.overloadAt === undefined) continue;
      if (!v.alive || this.time < v.overloadAt) { if (!v.alive) v.overloadAt = undefined; continue; }
      const crewed = v.seats.some((i) => i >= 0);
      const by = v.overloadBy ?? -1, team = v.overloadTeam ?? 1;
      v.overloadAt = undefined; v.overloadBy = undefined; v.overloadTeam = undefined;
      if (crewed) {
        this.damageVehicle(v, 500, by, 'rg2'); // the gamble lost — the hull goes
        this.explode({ ...v.pos }, WEAPONS.gl, by, team);
      } else {
        this.emit({ type: 'emp', pos: { ...v.pos } }); // bailed in time — a fizzle
      }
    }
    // the plague wagons: an infected hull that DRIVES trails poison behind it
    for (const v of this.vehicles.values()) {
      if (v.infectedUntil === undefined) continue;
      if (this.time >= v.infectedUntil) { v.infectedUntil = undefined; v.infectedTeam = undefined; continue; }
      if (!v.alive) { v.infectedUntil = undefined; continue; }
      if (Math.hypot(v.vel.x, v.vel.z) > 2 && this.time >= (v.nextInfectTrailAt ?? 0)) {
        v.nextInfectTrailAt = this.time + 0.7;
        this.spawnGadget('fire_field', v.infectedTeam ?? 1, -1, { x: v.pos.x, y: 0, z: v.pos.z }, 40, 5);
      }
    }

    // recon state rebuilds every tick: pings accumulate from beacons, drones,
    // cameras, crewed sensor stations, and psi scanners; then smoke fields,
    // stealth suits, and crewed ECM stations strip entries back out.
    // hand this tick's marks to `pingedLast` before wiping, so the bot brains
    // (which run BEFORE the recon pass below) have something real to read.
    // Swap the set objects rather than copying — no per-tick allocation.
    const recycled = this.pingedLast;
    this.pingedLast = this.pinged;
    this.pinged = recycled;
    this.pinged.clear();
    this.smoked.clear();

    for (const s of this.soldiers.values()) {
      if (!s.alive) {
        if (s.kind === 'dog') {
          // K9s redeploy with their handler's wave — never before the handler is back up
          const handler = this.soldiers.get(s.ownerId);
          if (!handler) { this.soldiers.delete(s.id); continue; } // handler left the war; the dog goes home
          if (handler.alive && this.time >= s.respawnAt && !this.mode.over) this.spawn(s);
          continue;
        }
        // a Crimson BLOOD BRUTE is a SUMMONED unit — it walks once and is gone,
        // not a roster regular. It spawned kind:'bot', so it used to revive every
        // cycle and never purge (a slow roster leak that warped team balance).
        // Delete it on death instead.
        if (s.name === 'BLOOD BRUTE') { this.soldiers.delete(s.id); continue; }
        if (s.kind !== 'human' && s.kind !== 'bot') continue; // dead zombies removed elsewhere
        // a plain range target STAYS down; a REGENERATING one (Robert) pops
        // back up at its home so the test range never runs dry.
        if (this.time >= s.respawnAt && !this.mode.over) {
          if (!s.dummy) this.spawn(s);
          else if (s.respawns && s.dummyHome) {
            s.alive = true; s.hp = s.maxHp; s.downed = false; s.vel = { x: 0, y: 0, z: 0 };
            s.pos = { ...s.dummyHome };
            s.viralLoad = 0; s.grabbedUntil = undefined; s.grabbedBy = undefined;
            this.emit({ type: 'respawn', pos: { ...s.pos }, soldierId: s.id });
          }
        }
        continue;
      }
      // §4.3: the clock is an enemy too — unhelped, a downed soldier bleeds out
      if (s.downed && this.time >= s.downedUntil) {
        this.damageSoldier(s, s.hp + 1, s.downedBy, 'bleedout');
        continue;
      }
      // ENCASED (§21.6): frozen in the ice block. HOLD STILL and HP drains
      // slowly (you can outlast it); STRUGGLE — feed any move/fire input —
      // and you break the ice in ~4s but crawl out badly hurt. Nobody else's
      // damage touches you (the shield lives in damageSoldier). No movement,
      // no shooting, no brain: the block just stands there being a block.
      if (s.encasedUntil !== undefined) {
        const cmd = cmds.get(s.id);
        const struggling = !!cmd && (cmd.moveX !== 0 || cmd.moveZ !== 0 || cmd.fire || cmd.jump);
        s.vel = { x: 0, y: 0, z: 0 };
        if (struggling) {
          s.struggle = (s.struggle ?? 0) + dt / STRUGGLE_SECS;
          if (s.struggle >= 1) { this.freeFromIce(s, STRUGGLE_HP); continue; } // shattered it — and hurt
        } else {
          // hold-still drain, applied DIRECTLY (the ice shield in
          // damageSoldier would eat a normal damage call)
          s.hp -= ICE_HOLD_DRAIN * dt;
          // THE ICE GETS THE KILL. This read `-1` — a man frozen at low HP bled
          // out inside the block and the death feed named no one, so the hand
          // that froze him got nothing and the victim never learned what
          // killed him. Clear the marks first: damageSoldier refuses damage
          // to an encased body (the shield), and the credit must survive it.
          if (s.hp <= 0) {
            s.hp = 0;
            const froze = s.encasedBy ?? -1;
            s.encasedUntil = undefined; s.encasedBy = undefined; s.struggle = undefined;
            this.damageSoldier(s, 1, froze, 'bleedout');
            continue;
          }
        }
        if (this.time >= s.encasedUntil) this.freeFromIce(s, 0); // the ice melts, free at no cost
        continue; // an ice block does nothing else
      }
      // GRABBED (OUTBREAK-SPEC §14): pinned in a hold. Rooted — no move, no
      // brain, no trigger — but UNLIKE the ice you can still be hit (a pinned
      // enemy is there to be punished). STRUGGLE (any move/fire input) breaks
      // it early; otherwise the hold lapses on its timer. The grip also slips
      // if the grabber dies or is dragged out of tether range.
      if (s.grabbedUntil !== undefined) {
        const grabber = s.grabbedBy !== undefined ? this.soldiers.get(s.grabbedBy) : undefined;
        const gone = !grabber || !grabber.alive
          || Math.hypot(grabber.pos.x - s.pos.x, grabber.pos.z - s.pos.z) > GRAB_TETHER;
        const cmd = cmds.get(s.id);
        const struggling = !!cmd && (cmd.moveX !== 0 || cmd.moveZ !== 0 || cmd.fire || cmd.jump);
        s.vel = { x: 0, y: 0, z: 0 };
        // NO MINIGAME (Robert). A hold — front clinch OR rear control — is
        // broken the same honest way: STRUGGLE (mash MOVE/fire/jump) fills the
        // break meter. A rear-controlled pin is HARDER to shrug (the grabber
        // owns your back) so it takes longer, but there's no needle to time.
        const rearControlled = s.ctrlStruggle?.locked === true;
        // "they don't get loose": while the grabber is alive and STILL holding
        // this rear control, the hold never lapses on a timer — the ONLY way
        // out is to STRUGGLE free (or the grabber picking a menu verb).
        if (rearControlled && grabber && grabber.alive && grabber.grabbingId === s.id) {
          s.grabbedUntil = Math.max(s.grabbedUntil, this.time + 0.3);
        }
        if (struggling) {
          const rate = rearControlled ? dt / (GRAB_STRUGGLE_SECS * 1.6) : dt / GRAB_STRUGGLE_SECS;
          s.struggle = (s.struggle ?? 0) + rate;
        }
        // §14.2 CHOKE — the silent capture channels here, where the hold is
        // already adjudicated: progress climbs while the LOCKED grip and the
        // choker both hold; completion puts the body DOWN (bleed clock, medic
        // liftable) — a capture, never a kill credit.
        if (grabber && grabber.alive && grabber.chokingId === s.id && s.ctrlStruggle?.locked) {
          s.chokeProgress = (s.chokeProgress ?? 0) + dt / CHOKE_SECS;
          s.grabbedUntil = Math.max(s.grabbedUntil, this.time + 0.3); // the squeeze outlasts the lock timer
          if (s.chokeProgress >= 1) {
            this.emit({ type: 'choke_out', pos: { ...s.pos }, soldierId: s.id });
            grabber.chokingId = undefined;
            s.chokeProgress = undefined;
            s.grabbedUntil = undefined; s.grabbedBy = undefined; s.struggle = undefined; s.ctrlStruggle = undefined;
            grabber.grabbingId = undefined;
            s.grabImmuneUntil = this.time + GRAB_IMMUNE;
            this.downSoldier(s, grabber.id);
            continue; // the body is on the ground — nothing else acts this tick
          }
        }
        // BITE STRUGGLE (OUTBREAK-SPEC §15.5): a ZOMBIE's grip gnaws — Viral
        // Load climbs the whole time it has you, so a slow escape still costs.
        const byZed = !!grabber && isZed(grabber.kind);
        if (byZed && this.outbreakEnabled && (s.kind === 'human' || s.kind === 'bot')) {
          const gnaw = BITE_GNAW * (grabber!.kind === 'brute' ? 1.3 : 1);
          s.viralLoad = Math.min(100, (s.viralLoad ?? 0) + gnaw * dt);
        }
        const broke = (s.struggle ?? 0) >= 1;
        const timedOut = this.time >= s.grabbedUntil;
        if (broke || gone || timedOut) {
          // a body that FOUGHT free (vs one the timer released) rebounds on the
          // grabber — a reversal that jars his grip and SHOVES him back. Robert:
          // "when he breaks out it should knock me back a little, to prevent me
          // spamming the grab." Breaking a REAR control shoves harder (you had
          // more of him) — the anti-spam is the whole point.
          if (broke && grabber && grabber.alive) {
            const wasRear = s.ctrlStruggle?.locked === true;
            grabber.nextFireAt = Math.max(grabber.nextFireAt, this.time + MELEE_STAGGER * (wasRear ? 1.6 : 1));
            const dl = Math.max(Math.hypot(grabber.pos.x - s.pos.x, grabber.pos.z - s.pos.z), 0.5);
            const shove = wasRear ? 9 : 4;
            grabber.pushX += ((grabber.pos.x - s.pos.x) / dl) * shove;
            grabber.pushZ += ((grabber.pos.z - s.pos.z) / dl) * shove;
          } else if (byZed && timedOut && !broke && grabber && this.outbreakEnabled) {
            // you FAILED to break the Bite Struggle in time — the jaws close:
            // bite damage (+ the claw's Viral injection) and a shove toward it.
            const dl = Math.max(Math.hypot(grabber.pos.x - s.pos.x, grabber.pos.z - s.pos.z), 0.5);
            this.damageSoldier(s, BITE_DAMAGE, grabber.id, 'zombie_claw');
            if (s.alive) { s.pushX += ((grabber.pos.x - s.pos.x) / dl) * 3; s.pushZ += ((grabber.pos.z - s.pos.z) / dl) * 3; }
          }
          s.grabbedUntil = undefined; s.grabbedBy = undefined; s.struggle = undefined; s.ctrlStruggle = undefined;
          s.chokeProgress = undefined; s.humanShield = undefined;
          if (grabber && grabber.chokingId === s.id) grabber.chokingId = undefined;
          s.grabImmuneUntil = this.time + GRAB_IMMUNE; // no instant re-clinch
          this.emit({ type: 'grab_break', pos: { ...s.pos }, soldierId: s.id });
        }
        continue; // held (or just released): nothing else acts this tick
      }
      s.draggingId = -1; // the drag grip is re-asserted every tick by the E-hold
      // Reactor's overcharge burns out — hand back the borrowed multiplier
      if (s.overchargeUntil !== undefined && this.time >= s.overchargeUntil) {
        s.overchargeUntil = undefined;
        if (s.ascendant !== 'ragebeast') s.rageMul = undefined; // Ragebeast owns its own
      }
      // in-flight melee swings land on schedule, whoever the attacker is —
      // this runs BEFORE the brains so zombies and dogs resolve too
      if (s.meleeStrikeAt > 0 && this.time >= s.meleeStrikeAt) this.resolveMeleeStrike(s);
      let cmd = cmds.get(s.id);
      if (!cmd) {
        if (s.kind === 'bot' && !s.dummy) cmd = stepBot(this, s, dt); // dummies stand and take it
        else if (s.kind === 'scientist') { stepScientist(this, s, dt); continue; }
        else if (s.kind === 'dog') { stepDog(this, s, dt); continue; }
        else if (isIron(s.kind)) { stepIron(this, s, dt); continue; }
        else if (isZed(s.kind)) { stepZombie(this, s, dt); continue; }
        else cmd = null as unknown as PlayerCmd;
      }
      if (cmd) this.applyCmd(s, cmd, dt);
      this.stepEquipment(s);
      if (s.ascendant) this.stepLsw(s, dt); // the LSW's signature, on top of the fight
      this.stepSoldierPhysics(s, dt);
      if (s.draggingId >= 0) this.stepDrag(s); // haul the body after we've moved
    }

    // §BEAMS row 189: resolve this tick's held streams — clashes first, then
    // the unpaired pours run their damage walk.
    this.resolveHeldBeams(dt);

    // purge removed zombies (dogs are soldiers — they wait for their respawn, not the bin)
    for (const [id, s] of this.soldiers) {
      if (!s.alive && s.kind !== 'human' && s.kind !== 'bot' && s.kind !== 'dog' && this.time > s.respawnAt) this.soldiers.delete(id);
    }

    for (const v of this.vehicles.values()) this.stepVehicle(v, cmds, dt);
    this.stepRadar();
    for (const t of this.turrets.values()) this.stepTurret(t, dt);
    this.stepProjectiles(dt);
    this.stepMines(dt);
    this.stepPickups(dt);
    this.stepGadgets(dt);
    this.stepGatesAndLifts();
    this.stepSupplyPods();
    // RG-2 tag darts: a pinned soldier stays lit until the dart burns out —
    // merged before countermeasures so a stealth suit still beats the pin
    for (const [id, until] of this.tagged) {
      const t = this.soldiers.get(id);
      if (this.time >= until || !t || !t.alive) this.tagged.delete(id);
      else this.pinged.add(id);
    }
    // M1: a LOUD LANDING rings for a beat — a leap arrival pings like gunfire
    for (const s of this.soldiers.values()) {
      if (s.alive && (s.loudUntil ?? 0) > this.time) this.pinged.add(s.id);
    }
    this.applyReconCountermeasures();
    this.updateLastSeen();
    stepDirector(this, this.director); // §director: drift the pacing band
    buildInfluence(this.influence, this.time, this.soldiers.values()); // §influence

    // §8.8 the sky rolls: weather fronts drift through on their own clock
    if (this.time >= this.weather.until && !this.puppet) {
      const menu = THEME_WEATHER[this.map.theme];
      const kind = menu[this.rng.int(0, menu.length - 1)];
      this.weather = {
        kind,
        intensity: kind === 'clear' ? 0 : 0.5 + this.rng.next() * 0.5,
        until: this.time + 70 + this.rng.next() * 70,
      };
      this.emit({ type: 'announce', text: weatherAnnounce(kind), big: kind !== 'clear' });
    }
  }

  /** The live vision budget: PERCEIVE_RANGE taxed by the current sky (§8.8). */
  perceiveRange(): number {
    return PERCEIVE_RANGE * visionMult(this.weather);
  }

  /** The standing smoke banks, as eyes care about them — rebuilt per tick by
   *  updateLastSeen and shared with the bots' sightClear. */
  smokeBlobs: SmokeBlob[] = [];

  /** A sight line: walls AND smoke. What the bots' trigger discipline and
   *  anything else that "looks" should use — losClear alone sees through
   *  smoke, and a grenade that doesn't affect visibility is just décor. */
  sightClear(from: Vec3, to: Vec3): boolean {
    if (smokeBlocks(from.x, from.z, to.x, to.z, this.smokeBlobs)) return false;
    return losClear(this.map.grid, { x: from.x, y: 1.4, z: from.z }, { x: to.x, y: 1.4, z: to.z }, 1.4, this.map.geometry);
  }

  radarTracksFor(team: Team): ReadonlyMap<string, RadarTrack> {
    return this.radarTracks[team];
  }

  /** Scheduled battlefield sensors. Keeping this in the sim means replay,
   *  AI, HUD, and a future server all consume the same imperfect truth. */
  stepRadar(): void {
    type Emitter = { vehicle: Vehicle; profile: RadarEmitterProfile };
    const emitters: Emitter[] = [];
    for (const vehicle of [...this.vehicles.values()].sort((a, b) => a.id - b.id)) {
      if (!vehicle.alive || vehicle.systems.sensors <= 0 || vehicle.stunnedUntil > this.time) continue;
      const def = VEHICLES[vehicle.kind];
      const pilot = this.soldiers.get(vehicle.seats[0]);
      if (pilot?.alive) {
        if (def.submersible && vehicle.submerged) emitters.push({ vehicle, profile: RADAR_PROFILES.sonar });
        else if (def.flies) emitters.push({ vehicle, profile: def.minAirspeed ? RADAR_PROFILES.fixedWing : RADAR_PROFILES.rotorcraft });
        else if (def.boat || def.submersible) emitters.push({ vehicle, profile: RADAR_PROFILES.surfaceNaval });
      }
      const sensor = this.crewAt(vehicle, 'sensors');
      if (!vehicle.submerged && sensor?.alive) emitters.push({ vehicle, profile: RADAR_PROFILES.staffedSensors });
    }
    // Weak returns first; stronger/longer-range sources win same-tick overlap.
    emitters.sort((a, b) => a.profile.range - b.profile.range || a.vehicle.id - b.vehicle.id || a.profile.source.localeCompare(b.profile.source));
    for (const emitter of emitters) {
      const scheduleKey = `${emitter.vehicle.id}:${emitter.profile.source}`;
      if (this.time + 1e-9 < (this.nextRadarSweep.get(scheduleKey) ?? 0)) continue;
      this.nextRadarSweep.set(scheduleKey, this.time + emitter.profile.cadence);
      this.recordRadarTelemetry(emitter.vehicle, 'radar_sweep', emitter.profile.source);
      this.sweepRadar(emitter.vehicle, emitter.profile);
    }
    for (const tracks of this.radarTracks) {
      for (const [key, track] of tracks) if (track.expiresAt <= this.time) tracks.delete(key);
    }
  }

  private sweepRadar(emitter: Vehicle, profile: RadarEmitterProfile): void {
    const range = profile.range * weatherRadarMultiplier(this.weather, profile.source);
    const receivingTeam = emitter.team;
    const observe = (
      targetType: RadarTrack['targetType'], targetId: number, team: Team, pos: Vec3, yaw: number,
      band: ElevationLevel, domain: RadarTrack['domain'], ecmAlive: boolean,
    ) => {
      if (team === receivingTeam || !profile.domains.includes(domain)) return;
      const jammed = profile.source !== 'sonar' && ecmAlive;
      const effectiveRange = range * (jammed ? 0.65 : 1);
      if (Math.hypot(pos.x - emitter.pos.x, pos.z - emitter.pos.z) > effectiveRange) return;
      if (!this.radarLineClear(emitter, pos, domain)) return;
      const precision = jammed ? 0.45 : 1;
      const observed = jammed ? this.jammedRadarPosition(emitter.id, targetId, profile.cadence, pos, precision) : { ...pos };
      const key = radarTrackKey(targetType, targetId);
      const previous = this.radarTracks[receivingTeam].get(key);
      const reacquired = this.radarTrackHistory[receivingTeam].has(key)
        && (!previous || previous.expiresAt <= this.time);
      this.radarTracks[receivingTeam].set(key, {
        key, targetId, targetType, receivingTeam, pos: observed,
        heading: headingDegrees(yaw), band, domain, source: profile.source,
        observedAt: this.time,
        expiresAt: this.time + profile.cadence * (jammed ? 2 : 3),
        precision, jammed,
      });
      this.recordRadarTelemetry(emitter, 'radar_contact', `${profile.source}:${domain}`);
      if (jammed) this.recordRadarTelemetry(emitter, 'radar_jammed', `${profile.source}:${domain}`);
      if (reacquired) this.recordRadarTelemetry(emitter, 'radar_reacquired', `${profile.source}:${domain}`);
      this.radarTrackHistory[receivingTeam].add(key);
    };

    for (const target of [...this.vehicles.values()].sort((a, b) => a.id - b.id)) {
      if (!target.alive || target.id === emitter.id) continue;
      observe(
        'vehicle', target.id, target.team, target.pos, target.yaw, asElevationLevel(target.band),
        radarDomainForVehicle(target.kind, target.band ?? 0, !!target.submerged), target.systems.ecm > 0,
      );
    }
    for (const target of [...this.soldiers.values()].sort((a, b) => a.id - b.id)) {
      if (!target.alive || target.vehicleId >= 0) continue;
      observe('soldier', target.id, target.team, target.pos, target.yaw, asElevationLevel(target.floor), 'ground', false);
    }
  }

  private radarLineClear(emitter: Vehicle, target: Vec3, domain: RadarTrack['domain']): boolean {
    if (domain === 'air' || domain === 'submerged') return true;
    // Ordinary structures stop low emitters but sit below Sky/Clouds. Crown
    // Divide's wall alphabet represents full ridgelines, so even high aircraft
    // must acquire ground returns through a pass instead of seeing through the
    // mountain. 3.8 stays just below the shared 4u wall/ridge silhouette.
    const flightHeight = ELEVATION_ALT[asElevationLevel(emitter.band)] + 1.4;
    const emitterHeight = this.map.theater?.id === 'mountain'
      ? Math.min(flightHeight, 3.8)
      : flightHeight;
    return losClear(this.map.grid, emitter.pos, target, emitterHeight, this.map.geometry);
  }

  private jammedRadarPosition(emitterId: number, targetId: number, cadence: number, pos: Vec3, precision: number): Vec3 {
    const pulse = Math.floor((this.time + 1e-9) / cadence);
    const hash = ((targetId * 1103515245) ^ (emitterId * 12345) ^ (pulse * 2654435761)) >>> 0;
    const angle = (hash % 360) * Math.PI / 180;
    const radius = 3 + (1 - precision) * 7;
    return { x: pos.x + Math.cos(angle) * radius, y: pos.y, z: pos.z + Math.sin(angle) * radius };
  }

  private recordRadarTelemetry(
    vehicle: Vehicle,
    kind: 'radar_sweep' | 'radar_contact' | 'radar_jammed' | 'radar_reacquired',
    detail: string,
  ): void {
    recordVehicleEvent(this.vehicleTelemetry, {
      kind, t: this.time, vehicleId: vehicle.id, vehicleKind: vehicle.kind,
      theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
      x: vehicle.pos.x, z: vehicle.pos.z, detail,
    });
  }

  /** Stamp what each team can see this tick. Death wipes the trail — a corpse
   *  is not a track, and a respawn must never leak its new position. */
  private updateLastSeen() {
    const range = this.perceiveRange(); // weather taxes everyone's eyes equally
    // gather the smoke banks once — perception and the bots share the list
    this.smokeBlobs.length = 0;
    for (const g of this.gadgets.values()) {
      if (g.type === 'smoke_field') this.smokeBlobs.push({ x: g.pos.x, z: g.pos.z, r: 5 });
    }
    // MUZZLE FLASH TELLS THE TRUTH (finish-list 18): anyone who fired inside
    // the last beat is revealed, long grass or not (computed once, both teams)
    const revealed = new Set<number>();
    for (const e of this.soldiers.values()) {
      // nextFireAt of 0 means NEVER fired — a fresh boot is not a muzzle flash
      if (e.alive && e.nextFireAt > 0 && e.nextFireAt > this.time - 0.9 && e.nextFireAt <= this.time + 2) revealed.add(e.id);
    }
    for (const team of [0, 1] as Team[]) {
      const eyes: Soldier[] = [];
      for (const e of this.soldiers.values()) if (e.alive && e.team === team) eyes.push(e);
      for (const s of this.soldiers.values()) {
        if (s.team === team) continue;
        if (!s.alive) { this.lastSeen[team].delete(s.id); continue; }
        if (perceivesNow(this.map.grid, eyes, this.pinged, s, range, this.smokeBlobs, revealed, this.map.grid2, this.map.geometry)) {
          this.lastSeen[team].set(s.id, { t: this.time, x: s.pos.x, z: s.pos.z });
        }
      }
    }
  }

  /** Equipment that runs on its own clock: the psi scanner's pulse. */
  private stepEquipment(s: Soldier) {
    if (s.kind !== 'human' && s.kind !== 'bot') return;
    if (this.hasEquip(s, 'psiScan') && this.time >= s.nextPsiAt) {
      s.nextPsiAt = this.time + 8;
      // ping the nearest living enemy that is NOT already visible to us
      let best: Soldier | null = null, bestD = 60;
      for (const e of this.soldiers.values()) {
        if (!e.alive || e.team === s.team || this.pinged.has(e.id)) continue;
        const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
        if (d < bestD && !losClear(this.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 }, 1.4, this.map.geometry)) {
          best = e; bestD = d;
        }
      }
      if (best) {
        this.pinged.add(best.id);
        this.emit({ type: 'psi_ping', pos: { ...best.pos }, soldierId: s.id });
      }
    }
  }

  /** Strip pings from stealth suits, smoke fields, and crewed ECM bubbles. */
  private applyReconCountermeasures() {
    if (this.pinged.size === 0) return;
    // crewed, live ECM stations project a 14u jamming bubble
    const jammers: { pos: Vec3; team: Team }[] = [];
    for (const v of this.vehicles.values()) {
      if (!v.alive || v.systems.ecm <= 0) continue;
      const crew = VEHICLES[v.kind].crew;
      if (!crew) continue;
      const ecmSeat = 1 + crew.indexOf('ecm');
      if (ecmSeat > 0 && v.seats[ecmSeat] >= 0) jammers.push({ pos: v.pos, team: v.team });
    }
    for (const id of [...this.pinged]) {
      const s = this.soldiers.get(id);
      if (!s) { this.pinged.delete(id); continue; }
      if (this.smoked.has(id) || this.hasEquip(s, 'pingProof')) { this.pinged.delete(id); continue; }
      for (const j of jammers) {
        if (j.team === s.team && Math.hypot(s.pos.x - j.pos.x, s.pos.z - j.pos.z) < 14) {
          this.pinged.delete(id);
          break;
        }
      }
    }
  }

  // ---------- jump gates & grav-lifts ----------

  stepGatesAndLifts() {
    for (const s of this.soldiers.values()) {
      // a body being dragged past a gate shouldn't warp away from its rescuer
      if (!s.alive || s.downed || s.vehicleId >= 0 || (s.kind !== 'human' && s.kind !== 'bot')) continue;
      if (this.time < s.nextWarpAt) continue;
      for (const gate of this.map.gates) {
        for (const [from, to] of [[gate.a, gate.b], [gate.b, gate.a]] as const) {
          if (Math.hypot(s.pos.x - from.x, s.pos.z - from.z) < 1.7) {
            this.emit({ type: 'warp', pos: { ...s.pos } });
            s.pos = { x: to.x + this.rng.range(-1, 1), y: 0, z: to.z + this.rng.range(-1, 1) };
            s.nextWarpAt = this.time + 4;
            this.emit({ type: 'warp', pos: { ...s.pos }, soldierId: s.id });
            break;
          }
        }
      }
      for (const pad of this.map.pads) {
        if (s.pos.y < 0.5 && Math.hypot(s.pos.x - pad.pos.x, s.pos.z - pad.pos.z) < 1.5) {
          s.vel.y = 13;
          s.pos.y = 0.6;
          s.pushX += pad.dir.x * 20;
          s.pushZ += pad.dir.z * 20;
          s.nextWarpAt = this.time + 2;
          this.emit({ type: 'gravlift', pos: { ...pad.pos }, soldierId: s.id });
        }
      }
    }
  }

  // ---------- supply pods ----------

  stepSupplyPods() {
    if (this.mode.over || this.time < this.nextPodAt) return;
    this.nextPodAt = this.time + 90;
    // find an open tile in the central band
    for (let tries = 0; tries < 40; tries++) {
      const x = this.rng.range(-halfWidth(this.map.geometry) * 2 / 3, halfWidth(this.map.geometry) * 2 / 3);
      const z = this.rng.range(-halfDepth(this.map.geometry) * 2 / 3, halfDepth(this.map.geometry) * 2 / 3);
      if (!isBlocked(this.map.grid, x, z, false, this.map.geometry) && !isBlocked(this.map.grid, x + 2, z, false, this.map.geometry) && !isBlocked(this.map.grid, x - 2, z, false, this.map.geometry)) {
        const g: Gadget = {
          id: this.id(), type: 'supply_pod', team: 0, ownerId: -1,
          pos: { x, y: 40, z }, hp: Infinity, maxHp: Infinity,
          bornAt: this.time, expiresAt: this.time + 2.5, // lands at expiry
        };
        this.gadgets.set(g.id, g);
        this.emit({ type: 'pod_incoming', pos: { x, y: 0, z }, text: 'SUPPLY DROP INBOUND', big: false });
        return;
      }
    }
  }

  // ---------- gadgets ----------

  /** M5: hurl the axe. It flies as a normal projectile and buries itself
   *  wherever it stops — see the axe branch in stepProjectiles. */
  throwAxe(s: Soldier, reach: number) {
    s.axeId = -1; // claimed: the axe is in the air, not on his back
    this.throwProjectile(s, 'axe', 1.3, WEAPONS.axe.speed, false, Math.min(reach, AXE_REACH));
    this.emit({ type: 'axe_throw', pos: { ...s.pos }, soldierId: s.id, weapon: 'axe' });
  }

  /** M5: the axe tears out of the dirt and flies home, opening anything
   *  standing on the line between there and here. THE RETURN IS THE TRICK —
   *  a good throw sets up a lane, and calling it back sweeps that lane. */
  recallAxe(s: Soldier, axe: Gadget) {
    this.gadgets.delete(axe.id);
    s.axeId = undefined;
    s.axeRecallAt = this.time + Math.hypot(axe.pos.x - s.pos.x, axe.pos.z - s.pos.z) / AXE_RECALL_SPEED;
    this.emit({ type: 'axe_recall', pos: { ...axe.pos }, soldierId: s.id });
    // everyone on the return line eats it — hostiles only, once each
    const dx = s.pos.x - axe.pos.x, dz = s.pos.z - axe.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    for (const v of this.soldiers.values()) {
      if (!v.alive || v.team === s.team || v.id === s.id || v.vehicleId >= 0) continue;
      const rx = v.pos.x - axe.pos.x, rz = v.pos.z - axe.pos.z;
      const along = rx * ux + rz * uz;
      if (along < 0 || along > len) continue;              // behind it, or past home
      const off = Math.abs(rx * uz - rz * ux);             // perpendicular miss
      if (off > 1.3) continue;
      this.damageSoldier(v, AXE_RETURN_DAMAGE, s.id, 'axe');
      this.emit({ type: 'hit', pos: { ...v.pos }, weapon: 'axe', soldierId: v.id, ownerId: s.id });
    }
  }

  spawnGadget(type: GadgetType, team: Team, ownerId: number, pos: Vec3, hp: number, lifetime = Infinity): Gadget {
    const g: Gadget = {
      id: this.id(), type, team, ownerId,
      pos: { x: pos.x, y: 0, z: pos.z }, hp, maxHp: hp,
      bornAt: this.time, expiresAt: Number.isFinite(lifetime) ? this.time + lifetime : Infinity,
    };
    this.gadgets.set(g.id, g);
    return g;
  }

  stepGadgets(dt: number) {
    for (const [id, g] of this.gadgets) {
      switch (g.type) {
        case 'skitter': {
          // THE SKITTER: a demolition charge on six legs. It sprints at the
          // nearest grounded enemy — shoot it before it reaches you, or it
          // reaches you. Walls stop it like they stop boots; it can't climb.
          let tgt: Soldier | undefined; let td = 28;
          for (const e of this.soldiers.values()) {
            if (!e.alive || e.team === g.team || e.pos.y > 3 || e.vehicleId >= 0) continue;
            const d = Math.hypot(e.pos.x - g.pos.x, e.pos.z - g.pos.z);
            if (d < td) { td = d; tgt = e; }
          }
          if (tgt) g.yaw = Math.atan2(tgt.pos.z - g.pos.z, tgt.pos.x - g.pos.x);
          const sp = 8.5; // faster than boots, slower than bullets
          const nx = g.pos.x + Math.cos(g.yaw ?? 0) * sp * dt;
          const nz = g.pos.z + Math.sin(g.yaw ?? 0) * sp * dt;
          if (!isBlocked(this.map.grid, nx, g.pos.z, false, this.map.geometry)) g.pos.x = nx; // slide along walls
          if (!isBlocked(this.map.grid, g.pos.x, nz, false, this.map.geometry)) g.pos.z = nz;
          if (tgt && td < 1.3) {
            this.explode({ ...g.pos, y: 0.4 }, WEAPONS.skitter_bang, g.ownerId, g.team);
            this.gadgets.delete(id);
            this.emit({ type: 'gadget_destroyed', pos: g.pos });
            continue;
          }
          if (this.time >= g.expiresAt || g.hp <= 0) {
            this.gadgets.delete(id);
            this.emit({ type: 'gadget_destroyed', pos: g.pos });
          }
          continue;
        }
        case 'target_beacon': {
          for (const s of this.soldiers.values()) {
            if (!s.alive || s.team === g.team) continue;
            if (Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z) < 25) this.pinged.add(s.id);
          }
          break;
        }
        case 'camera': {
          // deployable spy camera: pings enemies it can actually see
          for (const s of this.soldiers.values()) {
            if (!s.alive || s.team === g.team) continue;
            const d = Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z);
            if (d < 20 && losClear(this.map.grid, { ...g.pos, y: 1.6 }, { ...s.pos, y: 1.2 }, 1.4, this.map.geometry)) this.pinged.add(s.id);
          }
          break;
        }
        case 'snap_trap': {
          // VENATRIX: the ice block's little sister — whoever steps in is
          // ENCASED (the same shared state; teammates shatter, struggling
          // hurts). The trap is spent on the spring.
          for (const s2 of this.soldiers.values()) {
            if (!s2.alive || s2.team === g.team || s2.encasedUntil !== undefined || s2.pos.y > 1) continue;
            if (Math.hypot(s2.pos.x - g.pos.x, s2.pos.z - g.pos.z) < 1.2 && this.encaseSoldier(s2, g.ownerId)) {
              this.gadgets.delete(id);
              this.emit({ type: 'gadget_destroyed', pos: { ...g.pos } });
              break;
            }
          }
          break;
        }
        case 'smoke_field': {
          // soldiers inside are hidden from minimap and pings — but an LSW is
          // TOO BIG FOR SMOKE: the silhouette looms through its own fog
          // (measured: Plaguebearer and Eclipse were IMMORTAL when their own
          // clouds blinded the answering squad — an unanswerable boss is a
          // griefer we wrote ourselves)
          for (const s of this.soldiers.values()) {
            if (!s.alive || s.ascendant) continue;
            if (Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z) < 5) this.smoked.add(s.id);
          }
          break;
        }
        case 'fire_field': {
          // phosphorus: burns enemies standing in it
          for (const s of this.soldiers.values()) {
            if (!s.alive || s.team === g.team || s.vehicleId >= 0) continue;
            if (Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z) < 4) {
              this.damageSoldier(s, 12 * dt, g.ownerId, 'flamer');
            }
          }
          break;
        }
        case 'drone': {
          if (g.crashing) {
            // link lost: the drone tumbles out of the sky and breaks on the dirt
            g.vy = (g.vy ?? 0) - this.gravity * 1.4 * dt;
            g.pos.y += g.vy * dt;
            g.pos.x += (g.vel?.x ?? 0) * 0.35 * dt; // dead stick drifts a little
            g.pos.z += (g.vel?.z ?? 0) * 0.35 * dt;
            if (g.pos.y <= 0.15) {
              this.emit({ type: 'drone_crash', pos: { ...g.pos, y: 0 } });
              this.gadgets.delete(id);
              continue;
            }
            break;
          }
          if (g.piloted) {
            // FPV: flown by its owner (applyCmd writes vel/yaw). Flies over
            // everything; the control link is the leash.
            const owner = this.soldiers.get(g.ownerId);
            if (!owner || !owner.alive) { this.crashDrone(g); break; } // operator down → dead stick
            g.pos.x = Math.max(-halfWidth(this.map.geometry) + 2, Math.min(halfWidth(this.map.geometry) - 2, g.pos.x + (g.vel?.x ?? 0) * dt));
            g.pos.z = Math.max(-halfDepth(this.map.geometry) + 2, Math.min(halfDepth(this.map.geometry) - 2, g.pos.z + (g.vel?.z ?? 0) * dt));
            g.pos.y = 2.6;
            const d = Math.hypot(g.pos.x - owner.pos.x, g.pos.z - owner.pos.z);
            g.signal = Math.max(0, Math.min(1, 1 - d / DRONE_RANGE));
            if (g.signal <= 0) { this.crashDrone(g); break; } // out of range: static → gone
            for (const s of this.soldiers.values()) {
              if (!s.alive || s.team === g.team) continue;
              if (Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z) < 18) this.pinged.add(s.id);
            }
            break;
          }
          // bot drones: the classic auto-orbit
          g.phase = (g.phase ?? 0) + dt * 1.1;
          const anchor = g.anchor ?? g.pos;
          g.pos.x = anchor.x + Math.cos(g.phase) * 7;
          g.pos.z = anchor.z + Math.sin(g.phase) * 7;
          g.pos.y = 2.4;
          for (const s of this.soldiers.values()) {
            if (!s.alive || s.team === g.team) continue;
            if (Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z) < 22) this.pinged.add(s.id);
          }
          break;
        }
        case 'orbital': {
          // 3-second arm, then the sky falls
          if (this.time >= g.bornAt + 3) {
            this.emit({ type: 'orbital_strike', pos: { ...g.pos } });
            const blast = { ...WEAPONS.tank_cannon, id: 'tank_cannon' as WeaponId, damage: 170, splash: 7, splashDamage: 150 };
            this.explode(g.pos, blast as (typeof WEAPONS)[WeaponId], g.ownerId, g.team);
            this.gadgets.delete(id);
            continue;
          }
          break;
        }
        case 'supply_pod': {
          // falling
          const k = Math.min(1, (this.time - g.bornAt) / 2.5);
          g.pos.y = 40 * (1 - k * k);
          if (this.time >= g.expiresAt) {
            this.emit({ type: 'pod_landed', pos: { ...g.pos } });
            this.emit({ type: 'explosion', pos: { ...g.pos }, weapon: 'gl' });
            const loot: Pickup['type'][] = ['ammo', 'medkit', this.rng.next() < 0.4 ? 'orbital' : 'flamer'];
            loot.forEach((type, i) => {
              const a = (i / loot.length) * Math.PI * 2;
              const pk: Pickup = {
                id: this.id(), type,
                pos: { x: g.pos.x + Math.cos(a) * 1.8, y: 0, z: g.pos.z + Math.sin(a) * 1.8 },
                respawnAt: 0, oneShot: true,
              };
              this.pickups.set(pk.id, pk);
            });
            this.gadgets.delete(id);
            continue;
          }
          break;
        }
        case 'time_bomb': {
          // THE DEMOLITION TIMER (Robert): a big charge counting down. It BEEPS
          // faster as it nears zero — the telegraph, so the enemy gets a chance
          // to run — then LEVELS the room. Struck to death (hp<=0) it cooks off
          // where it stands. Detonates through the shared explode() (damage 120
          // ≥100 so it breaches masonry — it's a demo charge).
          const left = g.expiresAt - this.time;
          const period = left > 2 ? 1 : left > 1 ? 0.5 : 0.22; // the beep tightens
          if (this.time >= (g.phase ?? 0)) {
            g.phase = this.time + period;
            this.emit({ type: 'bomb_beep', pos: { ...g.pos }, soldierId: g.ownerId });
          }
          if (this.time >= g.expiresAt || g.hp <= 0) {
            this.explode({ x: g.pos.x, y: 0.4, z: g.pos.z }, WEAPONS.time_bomb, g.ownerId, g.team);
            this.emit({ type: 'explosion', pos: { ...g.pos }, weapon: 'time_bomb' });
            this.gadgets.delete(id);
            continue;
          }
          break;
        }
      }
      if (this.time >= g.expiresAt && g.type !== 'supply_pod') {
        this.gadgets.delete(id);
      }
    }
  }

  /** E near a friendly warp beacon with a living partner: blink to the other end. */
  tryWarpBeacon(s: Soldier): boolean {
    if (this.time < s.nextWarpAt) return false;
    for (const g of this.gadgets.values()) {
      if ((g.type !== 'warpA' && g.type !== 'warpB') || g.team !== s.team) continue;
      if (Math.hypot(g.pos.x - s.pos.x, g.pos.z - s.pos.z) > 2.4) continue;
      const partnerType = g.type === 'warpA' ? 'warpB' : 'warpA';
      const partner = [...this.gadgets.values()].find((o) => o.type === partnerType && o.ownerId === g.ownerId);
      if (!partner) return false;
      this.emit({ type: 'warp', pos: { ...s.pos } });
      s.pos = { x: partner.pos.x + this.rng.range(-1, 1), y: 0, z: partner.pos.z + this.rng.range(-1, 1) };
      s.nextWarpAt = this.time + 3;
      this.emit({ type: 'warp', pos: { ...s.pos }, soldierId: s.id });
      return true;
    }
    return false;
  }

  /** EMP burst: stalls machines, strips cloak and energy. No direct damage. */
  /** The FPV drone this soldier is currently flying (crashing ones don't count). */
  getPilotedDrone(ownerId: number): Gadget | undefined {
    for (const g of this.gadgets.values()) {
      if (g.type === 'drone' && g.piloted && g.ownerId === ownerId && !g.crashing) return g;
    }
    return undefined;
  }

  /** Link lost (range, EMP, gunfire, battery, owner down) — the drone falls. */
  crashDrone(g: Gadget) {
    if (g.crashing) return;
    g.crashing = true;
    g.signal = 0;
    g.vy = 1.2; // a last dying pop of lift, then gravity wins
  }

  /** MACHINE POSSESSION (§4.4 #4): a TIMED take of an enemy turret — team and
   *  guns flip for `secs`, then it remembers whose it was. An EMP burst
   *  evicts instantly (empBlast). NEVER humans — the law. */
  possessMachine(t: Turret, s: Soldier, secs: number) {
    if (t.possessedBy === undefined) { t.origTeam = t.team; t.origOwnerId = t.ownerId; this.possessionCount++; }
    t.possessedBy = s.id;
    t.possessedUntil = this.time + secs;
    t.team = s.team;
    t.ownerId = s.id;
    this.emit({ type: 'hacked', pos: { ...t.pos }, soldierId: s.id, text: `${s.name} POSSESSED a sentry!` });
  }

  /** hand a possessed machine back to its rightful owner */
  private evictPossession(t: Turret) {
    if (t.possessedBy === undefined) return;
    this.possessionCount--;
    t.team = t.origTeam ?? t.team;
    t.ownerId = t.origOwnerId ?? t.ownerId;
    t.possessedBy = undefined; t.possessedUntil = undefined;
    t.origTeam = undefined; t.origOwnerId = undefined;
  }

  /** §4.4 #4, Phantom's ride: a timed take of an enemy BOT — its team flips
   *  and it fights for the ghost until expiry hands the chassis home. NEVER
   *  a human: the API itself refuses flesh (the law). */
  possessBot(b: Soldier, s: Soldier, secs: number): boolean {
    if (b.kind !== 'bot' || !b.alive || b.team === s.team) return false;
    if (b.possessedBy === undefined) { b.origTeam = b.team; this.possessionCount++; }
    b.possessedBy = s.id;
    b.possessedUntil = this.time + secs;
    b.team = s.team;
    this.emit({ type: 'hacked', pos: { ...b.pos }, soldierId: s.id, text: `${s.name} POSSESSED ${b.name}!` });
    return true;
  }

  /** hand a ridden bot back to its side */
  private evictBotPossession(b: Soldier) {
    if (b.possessedBy === undefined) return;
    this.possessionCount--;
    b.team = b.origTeam ?? b.team;
    b.possessedBy = undefined; b.possessedUntil = undefined; b.origTeam = undefined;
  }

  /** §4.4 #4: a timed take of an enemy HULL — team flips, its guns serve
   *  the ghost, expiry (or an EMP) hands it home. */
  possessVehicle(v: Vehicle, s: Soldier, secs: number): boolean {
    if (!v.alive || v.team === s.team) return false;
    if (v.possessedBy === undefined) { v.origTeam = v.team; this.possessionCount++; }
    v.possessedBy = s.id;
    v.possessedUntil = this.time + secs;
    v.team = s.team;
    this.emit({ type: 'hacked', pos: { ...v.pos }, soldierId: s.id, text: `${s.name} POSSESSED a ${v.kind}!` });
    return true;
  }

  private evictVehiclePossession(v: Vehicle) {
    if (v.possessedBy === undefined) return;
    v.team = v.origTeam ?? v.team;
    v.possessedBy = undefined; v.possessedUntil = undefined; v.origTeam = undefined;
  }

  empBlast(pos: Vec3, team: Team, _ownerId: number) {
    this.emit({ type: 'emp', pos: { ...pos } });
    // EMP is the counter-drone weapon: any enemy drone in the burst loses link
    for (const g of this.gadgets.values()) {
      if (g.type !== 'drone' || g.team === team) continue;
      if (Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) < 10) this.crashDrone(g);
    }
    for (const v of this.vehicles.values()) {
      if (!v.alive) continue;
      const vNear = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) < 8;
      if (!vNear) continue;
      // EMP EVICTS POSSESSION INSTANTLY (§4.4 #4) — hulls too
      if (v.possessedBy !== undefined) this.evictVehiclePossession(v);
      if (v.team !== team) v.stunnedUntil = this.time + 4;
    }
    for (const t of this.turrets.values()) {
      if (!t.alive) continue;
      const near = Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z) < 8;
      if (!near) continue;
      // EMP EVICTS POSSESSION INSTANTLY (§4.4 #4) — whoever fired the burst,
      // the ghost is thrown out and the machine remembers its side
      if (t.possessedBy !== undefined) this.evictPossession(t);
      if (t.team !== team) t.nextFireAt = Math.max(t.nextFireAt, this.time + 5);
    }
    for (const s of this.soldiers.values()) {
      if (!s.alive) continue;
      if (Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z) >= 8) continue;
      // a ridden bot is thrown back to its side the instant the burst hits
      if (s.possessedBy !== undefined) this.evictBotPossession(s);
      if (s.team !== team) {
        s.cloaked = false;
        s.energy = 0;
      }
    }
    for (const [gid, g] of this.gadgets) {
      if (g.team === team) continue;
      if (Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) < 8) {
        if (g.type === 'drone') { this.gadgets.delete(gid); this.emit({ type: 'gadget_destroyed', pos: g.pos }); }
        if (g.type === 'skitter') { this.gadgets.delete(gid); this.emit({ type: 'gadget_destroyed', pos: g.pos }); } // EMP fries the legs
        if (g.type === 'shield') { g.hp -= 150; if (g.hp <= 0) { this.gadgets.delete(gid); this.emit({ type: 'gadget_destroyed', pos: g.pos }); } }
      }
    }
  }

  // ---------- soldiers ----------

  /** W5.1: tiles TALL enough to swat a band-1 hull — building fabric only
   *  (cover crates and climb barricades sit under the low-flight deck). */
  private buildingAt(x: number, z: number): boolean {
    const t = tileAt(this.map.grid, x, z, this.map.geometry);
    return t === T_WALL || t === T_SLIT || t === T_DOOR || t === T_METAL || t === T_METAL_DOOR;
  }

  /** §11.3: the type this reload would LOAD — the selected special when the
   *  weapon in hand takes ammo riders (ballistic), else none (= ball). */
  private specialAmmoSelected(s: Soldier, def: (typeof WEAPONS)[WeaponId]) {
    return (def.tracer === 'bullet' || def.tracer === 'shell') ? s.ammoType : undefined;
  }

  /** the special type's remaining pool — created lazily at its full size */
  private ammoPoolOf(s: Soldier, at: NonNullable<Soldier['ammoType']>): number {
    s.ammoPools ??= {};
    return (s.ammoPools[at] ??= AMMO_INFO[at]?.pool ?? 0);
  }

  /** §11.3: rounds a reload could draw RIGHT NOW — the selected special's
   *  pool, or (special dry / ball selected) the classic reserve. The two
   *  reload-initiation gates and the dry-click datum all read this, so an
   *  empty rifle with a full AP pool still reloads, and a truly-dry gun
   *  (no pool, no reserve) clicks. */
  reloadStock(s: Soldier, def: (typeof WEAPONS)[WeaponId]): number {
    const special = this.specialAmmoSelected(s, def);
    if (special && this.ammoPoolOf(s, special) > 0) return this.ammoPoolOf(s, special);
    return s.reserve[s.weaponIdx];
  }

  /** complete a running reload — §11.3 pool-aware. Shared by the standing
   *  path and the W5.4 drive-by seat, so the two never drift. */
  private finishReload(s: Soldier, def: (typeof WEAPONS)[WeaponId]) {
    if (!(s.reloadUntil > 0 && this.time >= s.reloadUntil)) return;
    const need = def.clip - s.clip[s.weaponIdx];
    // §11.3 SEPARATE MAGAZINES BY TYPE: a SPECIAL round reloads from its
    // own pool — ball rides the classic reserve. A pool that ran dry falls
    // the selector back to ball, loudly, and THIS reload loads ball.
    const special = this.specialAmmoSelected(s, def);
    let take: number;
    if (special) {
      const pool = this.ammoPoolOf(s, special);
      if (pool <= 0) {
        if (s.kind === 'human') this.emit({ type: 'announce', text: `${AMMO_INFO[special].label} DRY — BALL`, big: false });
        s.ammoType = undefined;
        take = Math.min(need, s.reserve[s.weaponIdx]);
        if (Number.isFinite(s.reserve[s.weaponIdx])) s.reserve[s.weaponIdx] -= take;
      } else {
        take = Math.min(need, pool);
        // row 178: ceres DEEP POCKETS — the pool pays 25% less per reload
        s.ammoPools![special] = pool - (def.brand === 'ceres' ? Math.ceil(take * 0.75) : take);
      }
    } else {
      take = Math.min(need, s.reserve[s.weaponIdx]);
      if (Number.isFinite(s.reserve[s.weaponIdx])) s.reserve[s.weaponIdx] -= take;
    }
    s.clip[s.weaponIdx] += take;
    s.reloadUntil = 0;
  }

  applyCmd(s: Soldier, cmd: PlayerCmd, dt: number) {
    s.yaw = cmd.aimYaw;
    s.crouching = !!cmd.crouch && !s.downed; // the duck is a HELD stance
    // THE GUARD (OUTBREAK-SPEC §12): a HELD brace, gated on stamina — an empty
    // tank can't hold it (the meter IS the mechanic, same as sprint). Computed
    // BEFORE the melee/fire handlers so a raised guard lowers your own weapons.
    s.guarding = !!cmd.guard && !s.downed && s.vehicleId < 0
      && s.encasedUntil === undefined && s.energy > 0.5;

    // §7 A PILOTED LSW: Q is the SIGNATURE, not the class kit. The active
    // fires here and the class-ability branches below never see the press —
    // an ascended medic doesn't self-stim, an ascended ghost doesn't cloak.
    if (s.ascendant && cmd.ability) {
      if (s.vehicleId < 0 && this.time >= (s.nextLswActiveAt ?? 0)) this.lswActive(s);
      cmd = { ...cmd, ability: false };
    }

    // M1 RAGDOLLED: past the threshold the body is luggage — no inputs land,
    // the blast's own push carries you, and control returns when you get up.
    if (s.ragdollUntil !== undefined && this.time < s.ragdollUntil) {
      s.vel.x = 0;
      s.vel.z = 0; // legs contribute nothing; pushX/Z still slides the body
      s.sprinting = false;
      return;
    }

    // M1 LEAP TOUCHDOWN: the ground clamp zeroes vel.y on ANY floor (0 or
    // upstairs), so that zero IS the landing — and it lands LOUD: the ring
    // window feeds `pinged` (recon merge in step) and dormant ears (bots.ts).
    if (s.leaping && s.vel.y === 0) {
      s.leaping = false;
      s.loudUntil = this.time + LOUD_LAND;
      this.emit({ type: 'leapland', pos: { ...s.pos }, soldierId: s.id });
    }

    // M1 DASH & ROLL (Robert: "dashing forward, rolling to the sides"):
    // double-tap verbs from the client, paid from the stamina tank, gated by
    // one shared cooldown so they can't be chained into flight.
    if (cmd.dash && !s.downed && s.vehicleId < 0 && s.encasedUntil === undefined &&
        this.time >= (s.nextDashAt ?? 0)) {
      const cost = cmd.dash === 1 ? DASH_COST : cmd.dash === 4 ? SLIDE_COST : ROLL_COST;
      if (s.energy >= cost) {
        s.energy -= cost;
        s.nextDashAt = this.time + DASH_CD;
        const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
        if (cmd.dash === 1) {
          s.pushX += fx * DASH_IMPULSE;
          s.pushZ += fz * DASH_IMPULSE;
          s.dashUntil = this.time + 0.28;
        } else if (cmd.dash === 4) {
          // M1 SLIDE-OFF-SPRINT (Robert: "running… slide"): a sprint dropped to
          // the deck — a long low skid along the nose. Cheaper than a dash (it
          // spends momentum you already had), and it DUCKS you: the crouch
          // stance rides along, so a slide clears fire and ends behind cover.
          s.pushX += fx * SLIDE_IMPULSE;
          s.pushZ += fz * SLIDE_IMPULSE;
          s.slideUntil = this.time + 0.55;
          s.crouching = true;
        } else {
          const side = cmd.dash === 2 ? 1 : -1;
          s.pushX += fz * side * ROLL_IMPULSE;
          s.pushZ += -fx * side * ROLL_IMPULSE;
          s.rollUntil = this.time + 0.5;
          s.rollDir = side;
        }
        this.emit({ type: 'dash', pos: { ...s.pos }, soldierId: s.id });
      }
    }

    // M1 THE CHARGED LEAP (STATUS §1): the duck was a COIL — releasing SPACE
    // with a direction springs a ballistic arc. Paid like a dash, sharing the
    // dash cooldown (the same "can't be chained into flight" law). Ground
    // classes only — jetpacks and gods already own the sky. Once airborne the
    // movement block below leaves vel alone: no air control, land where you
    // aimed or learn to aim.
    if ((cmd.leap ?? 0) > 0 && !s.downed && s.vehicleId < 0 && s.encasedUntil === undefined
        && s.ascendant === undefined && CLASSES[s.classId]?.ability !== 'jetpack' && !s.leaping
        && s.vel.y === 0 && this.time >= (s.nextDashAt ?? 0) && s.energy >= LEAP_COST) {
      const len = Math.hypot(cmd.moveX, cmd.moveZ);
      if (len > 0.01) {
        s.energy -= LEAP_COST;
        s.nextDashAt = this.time + DASH_CD;
        const h = LEAP_H_MIN + (LEAP_H_MAX - LEAP_H_MIN) * Math.min(1, cmd.leap!);
        s.vel.x = (cmd.moveX / len) * h;
        s.vel.z = (cmd.moveZ / len) * h;
        s.vel.y = LEAP_UP;
        s.leaping = true;
        s.crouching = false; // the spring released the coil
        this.emit({ type: 'leap', pos: { ...s.pos }, soldierId: s.id });
      }
    }

    // M5 THE AXE ON F: throw it, or call it home. One axe, three states —
    // on your back (throw), in the ground (recall), in the air (wait).
    // §14.2 THE OUTCOME MENU: a LOCKED rear hold offers more than the kill.
    // Z stays the takedown; F DISARMS (the held gun is ripped to the dirt and
    // he's shoved clear — a mercy with a price); E CHOKES (a silent capture —
    // he goes DOWN, not dead). Runs BEFORE the knife/door blocks and EATS the
    // key, so F doesn't also swing and E doesn't also open the door.
    {
      const heldV = s.grabbingId !== undefined ? this.soldiers.get(s.grabbingId) : undefined;
      const lockedHold = !!heldV && heldV.alive && heldV.grabbedBy === s.id
        && heldV.grabbedUntil !== undefined && heldV.ctrlStruggle?.locked === true
        && !heldV.ascendant;
      if (lockedHold) {
        const v = heldV!;
        if (cmd.melee || cmd.meleeHold) {
          // DISARM + SHOVE: strip the gun IN HIS HANDS (never below one weapon
          // — the sidearm law), drop it as real loot, shove him clear. A
          // release, not an escape: no rebound, but he keeps the no-re-clinch
          // window and you pay a beat of recovery for the rip.
          if (v.weapons.length >= 2) {
            const idx = v.weaponIdx;
            const wid = v.weapons[idx];
            v.weapons.splice(idx, 1); v.clip.splice(idx, 1); v.reserve.splice(idx, 1);
            v.weaponIdx = 0; v.trigHeld = false;
            if (!LOOT_EXCLUDED.has(wid)) {
              let drops = 0; let oldest: Pickup | undefined;
              for (const pk of this.pickups.values()) if (pk.type === 'weapon') { drops++; oldest ??= pk; }
              if (drops >= LOOT_MAX && oldest) this.pickups.delete(oldest.id);
              const a = ((v.id % 8) / 8) * Math.PI * 2;
              const pk: Pickup = {
                id: this.id(), type: 'weapon', weaponId: wid,
                pos: { x: v.pos.x + Math.cos(a) * 0.7, y: 0, z: v.pos.z + Math.sin(a) * 0.7 },
                respawnAt: 0, oneShot: true, expiresAt: this.time + LOOT_DESPAWN,
              };
              this.pickups.set(pk.id, pk);
            }
            this.emit({ type: 'disarm', pos: { ...v.pos }, soldierId: v.id, weapon: wid });
          }
          const dl = Math.max(Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z), 0.5);
          v.pushX += ((v.pos.x - s.pos.x) / dl) * 9;
          v.pushZ += ((v.pos.z - s.pos.z) / dl) * 9;
          v.grabbedUntil = undefined; v.grabbedBy = undefined; v.struggle = undefined; v.ctrlStruggle = undefined;
          v.grabImmuneUntil = this.time + GRAB_IMMUNE;
          v.chokeProgress = undefined; s.chokingId = undefined;
          s.grabbingId = undefined;
          s.nextFireAt = Math.max(s.nextFireAt, this.time + 0.4);
          cmd.melee = false; cmd.meleeHold = false; // the rip WAS the F press
        } else if (cmd.jump) {
          // THROW: the heave — the body is HURLED along YOUR facing, ballistic
          // and ragdolling where it lands. No damage, no strip: the throw is a
          // POSITIONAL verb — into the horde, off the roof, out of his cover.
          const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
          v.pushX += fx * 13; v.pushZ += fz * 13;
          v.vel.y = Math.max(v.vel.y, 4.2);
          v.ragdollUntil = this.time + 0.9; // luggage until the get-up
          v.grabbedUntil = undefined; v.grabbedBy = undefined; v.struggle = undefined; v.ctrlStruggle = undefined;
          v.grabImmuneUntil = this.time + GRAB_IMMUNE;
          v.chokeProgress = undefined; v.humanShield = undefined; s.chokingId = undefined;
          s.grabbingId = undefined;
          s.nextFireAt = Math.max(s.nextFireAt, this.time + 0.5); // the heave is your action
          this.emit({ type: 'grab_throw', pos: { ...v.pos }, soldierId: v.id });
          cmd.jump = false; // the throw WAS the space press — no hop rides along
        } else if (cmd.use && s.chokingId === undefined) {
          // CHOKE: begin the squeeze — the channel itself ticks in the victim's
          // grabbed block (where the hold is already being adjudicated).
          s.chokingId = v.id;
          v.chokeProgress = 0;
          cmd.use = false; // eaten — no door opens on the same press
        } else if (s.chokingId === undefined) {
          // HUMAN SHIELD (§14.2, the menu's fourth living verb): no finisher
          // chosen — the captive IS your cover. Haul him to your FRONT and
          // hold him there; you can walk (WASD) with him welded ahead, and
          // frontal fire aimed at YOU redirects into him (damageSoldier). It
          // lasts as long as you keep the pin: a menu key ends it into its
          // own outcome, his death or a break ends it the hard way.
          v.humanShield = true;
          const sfx = Math.cos(s.yaw), sfz = Math.sin(s.yaw);
          v.pos.x = s.pos.x + sfx * 1.0;
          v.pos.z = s.pos.z + sfz * 1.0;
          v.yaw = s.yaw;
          v.vel.x = 0; v.vel.z = 0;
          v.grabbedUntil = Math.max(v.grabbedUntil ?? 0, this.time + 0.3); // the clamp outlives the lock clock
        }
        if (s.chokingId !== undefined) v.humanShield = false; // choking ≠ shielding
      }
    }
    // the axe is ISSUED KIT (V1) — a soldier without it on his rig has no
    // sci-fi returning weapon, he has a rifle. Gods carry it inherently:
    // a thrown weapon that comes home is exactly what a god's arm is for.
    const meleeUpright = !s.downed && s.vehicleId < 0 && s.encasedUntil === undefined;
    if (cmd.melee && (this.hasEquip(s, 'axe') || s.ascendant) && meleeUpright) {
      const stuck = s.axeId !== undefined ? this.gadgets.get(s.axeId) : undefined;
      if (stuck) {
        this.recallAxe(s, stuck);
      } else if (s.axeId === undefined && s.axeRecallAt === undefined) {
        this.throwAxe(s, cmd.aimDist ?? AXE_REACH);
      }
    } else if (!this.hasEquip(s, 'axe') && !s.ascendant && meleeUpright && !s.guarding) {
      // THE STRIKE + IMPACT CHARGE (OUTBREAK-SPEC §12/§13): no returning axe on
      // the rig → the knife. HOLD F to build a Power Strike; RELEASE commits it.
      // The swing reuses the horde's windup→arc→stagger engine; the charge only
      // sets how hard it lands. A tap barely charges — that's the quick strike.
      const ready = s.meleeStrikeAt === 0 && this.time >= s.nextFireAt;
      if (cmd.meleeHold && ready) {
        // wind up: fill the meter, and bleed stamina once you overhold
        s.meleeCharge = Math.min(OVERCHARGE_AT + 0.2, (s.meleeCharge ?? 0) + dt / CHARGE_MAX_TIME);
        if ((s.meleeCharge ?? 0) > 1) s.energy = Math.max(0, s.energy - OVERCHARGE_DRAIN * dt);
      }
      if (cmd.melee && ready) {
        s.meleeChargeMul = chargeMult(s.meleeCharge ?? 0); // the release commits the power
        this.startMelee(s, WEAPONS.knife);
        s.meleeCharge = 0;
      } else if (!cmd.meleeHold && !cmd.melee) {
        s.meleeCharge = 0; // let go without swinging → the wind-up bleeds off
      }
    }

    // THE GRAPPLE (OUTBREAK-SPEC §12/§14): a close grab. It bypasses a raised
    // GUARD (grab beats block) and pins the target — but a target already
    // swinging a STRIKE stuffs it (STRIKE beats GRAPPLE). Shares the fire clock.
    if (cmd.grapple && !s.downed && s.vehicleId < 0 && s.encasedUntil === undefined
        && s.grabbedUntil === undefined && this.time >= s.nextFireAt && !s.guarding) {
      s.nextFireAt = this.time + GRAB_RECOVER; // the lunge for the grab occupies you
      // §14.2 REAR TAKEDOWN: if you already have rear control, a second grapple
      // commits the FINISHER on that body instead of reaching for a new hold —
      // heavy, armour-piercing, unblockable. Gods are too big to take down.
      const pinned = s.grabbingId !== undefined ? this.soldiers.get(s.grabbingId) : undefined;
      const holding = !!pinned && pinned.alive && pinned.grabbedBy === s.id && pinned.grabbedUntil !== undefined;
      // §15: a rear pin's finisher waits for CONTROL — the contest must be
      // LOCKED first. (Front pins and zed victims carry no contest and keep
      // the old recover-gated finisher.) An early second tap is simply
      // refused and the reach falls through to a fresh-grab attempt (which
      // finds nobody ungrabbed in reach — the hand stays busy).
      const controlTaken = !pinned?.ctrlStruggle || pinned.ctrlStruggle.locked === true;
      if (holding && !pinned!.ascendant && controlTaken) {
        this.emit({ type: 'takedown', pos: { ...pinned!.pos }, soldierId: pinned!.id });
        if (s.kind === 'human') this.emit({ type: 'announce', text: 'TAKEDOWN', big: false }); // the executor's reward (grabs are player-only)
        this.damageSoldier(pinned!, TAKEDOWN_DAMAGE, s.id, 'knife', false, true); // AP finisher, a knife-credited kill
        pinned!.grabbedUntil = undefined; pinned!.grabbedBy = undefined; pinned!.struggle = undefined; pinned!.ctrlStruggle = undefined;
        pinned!.chokeProgress = undefined; pinned!.humanShield = undefined; s.chokingId = undefined;
        s.grabbingId = undefined; // the finisher is your whole action this tick
      } else {
        s.grabbingId = undefined; // not holding a live pin — go reach for a fresh one
        // the REACH tell (Robert's pulse-ring UI): every grab press pulses,
        // land or whiff — "you reach out in that radius." Human presses only.
        if (s.kind === 'human') this.emit({ type: 'grab_reach', pos: { ...s.pos }, soldierId: s.id });
        let target: Soldier | undefined;
        let bestD = GRAB_RANGE + 0.3;
        for (const e of this.soldierIndex.near((1 - s.team) as Team, s.pos.x, s.pos.z, GRAB_RANGE + 0.3, GRAB_SCRATCH)) {
          if (!e.alive || e.grabbedUntil !== undefined || e.encasedUntil !== undefined
              || this.time < (e.grabImmuneUntil ?? 0)) continue;
          const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > bestD) continue;
          const raw = Math.atan2(dz, dx) - s.yaw;
          const ang = Math.atan2(Math.sin(raw), Math.cos(raw));
          if (Math.abs(ang) > GRAB_CONE / 2 && d > 0.5) continue;
          target = e; bestD = d;
        }
        if (target) {
          if (target.meleeStrikeAt > 0) {
            // STRIKE BEATS GRAPPLE: he's mid-swing — the grab is stuffed and the
            // grabber eats the stagger for over-committing into a live blade.
            s.nextFireAt = Math.max(s.nextFireAt, this.time + GRAB_HOLD * 0.5);
            const dl = Math.max(bestD, 0.5);
            s.pushX += ((s.pos.x - target.pos.x) / dl) * 4;
            s.pushZ += ((s.pos.z - target.pos.z) / dl) * 4;
            this.emit({ type: 'grab_break', pos: { ...target.pos }, soldierId: target.id });
          } else {
            // the hold lands. GRAPPLE BEATS GUARD: the brace is bypassed AND
            // dropped — a pinned body can't block what comes next.
            target.grabbedUntil = this.time + GRAB_HOLD;
            target.grabbedBy = s.id;
            s.grabbingId = target.id; // rear control — a second grapple executes the §14.2 takedown
            target.struggle = 0;
            target.guarding = false;
            target.meleeStrikeAt = 0; target.meleeWeapon = ''; // any windup of his dies in the clinch
            target.vel = { x: 0, y: 0, z: 0 };
            this.emit({ type: 'grabbed', pos: { ...target.pos }, soldierId: target.id });
            // §14.2 REAR CONTROL (Robert: "eliminate the minigame — if you win
            // that grab, they don't get loose, you use them as a human shield
            // until they break"). A rear grab that LANDS is immediate CONTROL:
            // no needle contest. The whole outcome menu (shield/disarm/choke/
            // throw/takedown) unlocks at once; the victim's only out is to
            // STRUGGLE free (the grabbed block), and breaking free KNOCKS THE
            // GRABBER BACK so the grab can't be spammed. Zeds/gods keep old law.
            const rel = Math.atan2(s.pos.z - target.pos.z, s.pos.x - target.pos.x);
            const off = Math.atan2(Math.sin(rel - target.yaw), Math.cos(rel - target.yaw));
            const rearGrab = Math.abs(off) > Math.PI / 2;
            if (rearGrab && (target.kind === 'human' || target.kind === 'bot') && !target.ascendant) {
              target.ctrlStruggle = {
                round: 1, attWins: 2, defWins: 0, // pre-won: control is TAKEN on the grab
                anchor: this.time, roundEndsAt: this.time, zoneC: 0.5, zoneW: 0, locked: true,
              };
              target.grabbedUntil = this.time + GRAB_HOLD; // held until struggled free
              this.emit({ type: 'struggle_lock', pos: { ...target.pos }, soldierId: target.id });
            }
          }
        }
      }
    }

    // §4.3: downed soldiers crawl — quarter speed, no trigger, no toys, no doors.
    // Everything below (weapons, abilities, vehicles, E-interactions) is for the upright.
    if (s.downed) {
      const crawl = CLASSES[s.classId].speed * DOWNED_CRAWL;
      const clen = Math.hypot(cmd.moveX, cmd.moveZ) || 1;
      s.vel.x = (cmd.moveX / clen) * crawl;
      s.vel.z = (cmd.moveZ / clen) * crawl;
      return;
    }

    // in a vehicle: driving handled by stepVehicle; handle exit + turret aim + fire
    if (s.vehicleId >= 0) {
      const v = this.vehicles.get(s.vehicleId);
      if (!v || !v.alive) { s.vehicleId = -1; s.seat = -1; return; }
      // J1 THE SKY HAS FLOORS (Robert: "we need to be able to fly up and fly
      // down easily — I think Q and E would be nice"). Aircraft live in
      // discrete BANDS (1-3): Q climbs one, E dives one, and on the deck the
      // E key becomes the door — you step out of a LANDED aircraft, which is
      // also the only place stepping out isn't a funeral. Ground vehicles
      // keep E-as-door everywhere, unchanged.
      const flightDef = VEHICLES[v.kind];
      if (cmd.use && this.time - s.enteredVehicleAt > 0.3) {
        if (flightDef.flies && s.seat === 0 && (v.band ?? 0) > 0 && this.time >= v.spoolUntil) {
          // one band per PRESS, not per tick — a held key walks, never falls.
          // The same gate stands between the last dive and the door, so the
          // tap that lands you can never also throw you out.
          if (this.time >= s.nextAbilityAt) {
            v.band = asElevationLevel((v.band ?? 1) - 1);
            if (v.band === 0) v.landed = true;
            s.nextAbilityAt = this.time + 0.28;
          }
        } else if (!flightDef.flies || s.seat !== 0 || this.time >= s.nextAbilityAt) {
          this.exitVehicle(s, v);
        }
      }
      if (cmd.ability && s.seat === 0 && flightDef.flies && this.time >= v.spoolUntil
          && this.time >= s.nextAbilityAt) {
        // jets own band 3; rotors top out at 2 (the design's ceiling rule)
        v.landed = false;
        v.band = asElevationLevel(Math.min(maxElevationFor(flightDef), (v.band ?? 0) + 1));
        s.nextAbilityAt = this.time + 0.28;
      }
      if (cmd.ability && s.seat === 0 && flightDef.submersible && this.time >= s.nextAbilityAt) {
        if (v.submerged || this.canSubmerge(v)) {
          v.submerged = !v.submerged;
          s.nextAbilityAt = this.time + 1.5;
          recordVehicleEvent(this.vehicleTelemetry, {
            kind: v.submerged ? 'dive' : 'surface', t: this.time,
            vehicleId: v.id, vehicleKind: v.kind,
            theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
            x: v.pos.x, z: v.pos.z,
          });
        } else {
          s.nextAbilityAt = this.time + 0.35;
        }
      }
      // breacher depth toggle: deep is silent and passes under walls, but
      // crawls and can't dig — surfacing is where the grinding happens
      if (cmd.ability && s.seat === 0 && VEHICLES[v.kind].digs && this.time >= s.nextAbilityAt) {
        v.burrowed = !v.burrowed;
        s.nextAbilityAt = this.time + 1.5;
        this.emit({
          type: 'beacon_planted', pos: { ...v.pos }, soldierId: s.id,
          text: v.burrowed ? 'Breacher DIVING' : 'Breacher SURFACING',
        });
      }
      // mech stomp: the ability key slams the ground — an AoE shove that
      // scatters whoever crowded the walker's legs. 6s of cooldown keeps it
      // a panic button, not a strategy.
      if (cmd.ability && s.seat === 0 && VEHICLES[v.kind].stomps && this.time >= s.nextAbilityAt) {
        s.nextAbilityAt = this.time + 6;
        s.protectedUntil = 0; // hostile action (55B)
        this.explode({ ...v.pos }, WEAPONS.mech_stomp, s.id, v.team);
        this.emit({ type: 'shot', pos: { ...v.pos }, weapon: 'mech_stomp', soldierId: s.id });
      }
      // ── V4 THE BOMB BAY ────────────────────────────────────────────────
      // Robert: "a bomber, one that a team could have and actually drop
      // bombs… and I almost think we need a baby nuke."
      //
      // FIRE drops iron: one bomb per trigger pull, released straight down
      // into the aircraft's own momentum, so a bombing run is a LINE you walk
      // across the target — you aim by FLYING, not by looking, which is the
      // only thing that makes a bomber feel like a bomber.
      const bombDef = VEHICLES[v.kind];
      if (bombDef.bombs && s.seat === 0) {
        if (v.bombLoad === undefined) v.bombLoad = bombDef.bombs;
        if (v.nukeAboard === undefined) v.nukeAboard = false;
        if (cmd.fire && v.bombLoad > 0 && this.time >= v.nextFireAt) {
          v.bombLoad--;
          v.nextFireAt = this.time + 1 / WEAPONS.bomb.rof;
          this.launch({
            id: this.id(), weapon: 'bomb', ownerId: s.id, team: v.team,
            pos: { x: v.pos.x, y: Math.max(2.4, v.pos.y), z: v.pos.z },
            // it INHERITS the aircraft's velocity — that's the whole skill
            vel: { x: v.vel.x * 0.85, y: -2, z: v.vel.z * 0.85 },
            bornAt: this.time, ttl: 2.2, arc: true,
          } as Projectile);
          this.emit({ type: 'bomb_away', pos: { ...v.pos }, soldierId: s.id });
        }
        // ── THE CRADLE: one warhead, priced in materiel, announced to
        // EVERYONE. A weapon that reshapes a map must never be a surprise —
        // the counterplay is the warning, and the whole enemy team gets it.
        if (cmd.altFire && !v.nukeAboard && this.time >= s.nextAbilityAt) {
          const price = NUKE_PRICE;
          if (this.materiel[v.team] >= price) {
            this.materiel[v.team] -= price;
            this.warLedger[v.team].spent += price;
            v.nukeAboard = true;
            s.nextAbilityAt = this.time + 2;
            this.emit({ type: 'nuke_armed', pos: { ...v.pos }, soldierId: s.id, big: true,
              text: 'CRADLE WARHEAD ARMED — CLEAR THE FIELD' });
          }
        } else if (cmd.altFire && v.nukeAboard && this.time >= s.nextAbilityAt) {
          v.nukeAboard = false;
          s.nextAbilityAt = this.time + 2;
          this.launch({
            id: this.id(), weapon: 'baby_nuke', ownerId: s.id, team: v.team,
            pos: { x: v.pos.x, y: Math.max(2.4, v.pos.y), z: v.pos.z },
            vel: { x: v.vel.x * 0.7, y: -2, z: v.vel.z * 0.7 },
            bornAt: this.time, ttl: 2.6, arc: true,
          } as Projectile);
          this.emit({ type: 'bomb_away', pos: { ...v.pos }, soldierId: s.id, big: true,
            text: 'WARHEAD AWAY' });
        }
      }
      // J1 THE BELLY GUN (Robert: "we might need machine guns, of course").
      // Alt-fire on airframes that carry one — its own cadence, the turret's
      // bearing. The bomber is exempt: its alt-fire is the Cradle.
      const mgDef = VEHICLES[v.kind];
      if (cmd.altFire && s.seat === 0 && mgDef.altWeapon && !mgDef.bombs
          && v.systems.weapon > 0 && this.time >= (v.nextAltFireAt ?? 0)
          && this.time >= v.spoolUntil && v.stunnedUntil <= this.time) {
        const wdef = WEAPONS[mgDef.altWeapon];
        v.nextAltFireAt = this.time + 1 / wdef.rof;
        s.protectedUntil = 0;
        const spread = (this.rng.next() - 0.5) * 2 * wdef.spread;
        const yaw = v.turretYaw + spread;
        const muzzle = mgDef.radius + 0.8;
        this.launch({
          id: this.id(), weapon: mgDef.altWeapon, ownerId: s.id, team: v.team,
          pos: { x: v.pos.x + Math.cos(yaw) * muzzle, y: 1.6, z: v.pos.z + Math.sin(yaw) * muzzle },
          vel: { x: Math.cos(yaw) * wdef.speed, y: 0, z: Math.sin(yaw) * wdef.speed },
          bornAt: this.time, ttl: wdef.range / wdef.speed, arc: false,
          airScaled: !!mgDef.flies,
          elevationWeapon: 'aircraft',
        } as Projectile);
        this.emit({ type: 'shot', pos: { ...v.pos }, weapon: mgDef.altWeapon, soldierId: s.id });
      }
      // flyer pilots pop IR flares with the grenade key — the heat-seeker counter
      if (cmd.grenade && s.seat === 0 && VEHICLES[v.kind].flies && v.flares > 0 && this.time >= s.nextGrenadeAt) {
        v.flares--;
        s.nextGrenadeAt = this.time + 1;
        const g = this.spawnGadget('flare', v.team, s.id, {
          x: v.pos.x - Math.cos(v.yaw) * 3, y: 0, z: v.pos.z - Math.sin(v.yaw) * 3,
        }, 1, 3.5);
        this.emit({ type: 'beacon_planted', pos: { ...g.pos }, soldierId: s.id, text: 'FLARES!' });
      }
      // W5.4 DRIVE-BY (Robert: "personal weapon from a seat"): a PASSENGER
      // leans out — the trigger runs his OWN gun: clip, rof, reload, the
      // §11 ammo riders, the real weapon. The driver's hands stay on the
      // wheel, mounted-gun seats are unchanged (their guns fire in
      // stepVehicle), and a band-2+ airframe is too high to lean out of.
      // Friendly rounds can't bite the carrying hull (the p.team gate).
      if (s.seat > 0 && s.alive && (!flightDef.flies || (v.band ?? 0) <= 1)) {
        if (cmd.weaponSlot >= 0 && cmd.weaponSlot < s.weapons.length && cmd.weaponSlot !== s.weaponIdx) {
          s.weaponIdx = cmd.weaponSlot;
          s.reloadUntil = 0;
        }
        const dwid = s.weapons[s.weaponIdx];
        const ddef = WEAPONS[dwid];
        // no knife lunges and no wind-up charge rifles from a car seat
        if (ddef && ddef.range > 2.5 && !ddef.charge) {
          if (cmd.reload && s.clip[s.weaponIdx] < ddef.clip && this.reloadStock(s, ddef) > 0 && s.reloadUntil === 0) {
            s.reloadUntil = this.time + ddef.reloadTime;
            s.statReloads = (s.statReloads ?? 0) + 1;
            this.emit({ type: 'reload', pos: s.pos, soldierId: s.id });
          }
          this.finishReload(s, ddef);
          if (cmd.fire && s.reloadUntil === 0 && this.time >= s.nextFireAt) {
            if (s.clip[s.weaponIdx] > 0) {
              s.protectedUntil = 0; // hostile action ends spawn protection (55B)
              this.fireSoldierWeapon(s, dwid, ddef, cmd.aimDist);
            } else if (this.reloadStock(s, ddef) > 0) {
              s.reloadUntil = this.time + ddef.reloadTime;
              s.statReloads = (s.statReloads ?? 0) + 1; // §13: auto-reload on empty
              this.emit({ type: 'reload', pos: s.pos, soldierId: s.id });
            } else if (this.time >= (s.nextDryAt ?? 0)) {
              s.statDry = (s.statDry ?? 0) + 1; // §13: the click, from a car seat
              s.nextDryAt = this.time + 0.5;
            }
          }
        }
      }
      return;
    }

    // flying an FPV drone: the body kneels at the controller — cmd steers the
    // DRONE, and the soldier can't move, shoot, or throw until the link ends
    const fpv = this.getPilotedDrone(s.id);
    if (fpv) {
      if (cmd.ability && this.time >= s.nextAbilityAt) {
        // Q again: cut the link cleanly — the drone powers down and drops
        this.crashDrone(fpv);
        s.nextAbilityAt = this.time + 1.5;
      } else {
        fpv.yaw = cmd.aimYaw;
        const len = Math.hypot(cmd.moveX, cmd.moveZ);
        const spd = 13;
        fpv.vel = len > 0.1
          ? { x: (cmd.moveX / len) * spd, z: (cmd.moveZ / len) * spd }
          : { x: 0, z: 0 };
        // the link burns battery; a drained operator loses the drone
        s.energy -= 4 * dt;
        if (s.energy <= 0) { s.energy = 0; this.crashDrone(fpv); }
      }
      s.vel.x = 0;
      s.vel.z = 0;
      return;
    }

    // deep water takes both your hands: no shooting, no throwing, no jumping
    // row 246: frozen water carries your weight — you WALK across, not swim.
    const swimming = tileAt(this.map.grid, s.pos.x, s.pos.z, this.map.geometry) === T_DEEP
      && !this.isFrozenWater(s.pos.x, s.pos.z);

    if (cmd.use) {
      if (this.tryDownedAid(s, cmd, dt)) {
        // E next to a downed teammate outranks every other door handle:
        // moving hauls the body with you, standing still channels a revive
      } else if (this.opts.mode === 'safehouse' && this.toggleEscort(s)) {
        // E next to the scientist toggles escort instead of vehicle entry
      } else if (this.tryWarpBeacon(s)) {
        // E on a warp beacon teleports to its twin
      } else if (this.tryFieldKit(s)) {
        // E with a mechanic kit repairs; with a hacking kit converts a sentry
      } else if (this.tryLadder(s)) {
        // E on a ladder climbs between storeys
      } else if (this.tryDoor(s)) {
        // E on a door swings it — the activation key earns its name
      } else {
        this.tryEnterVehicle(s);
      }
    }

    // weapon switching
    if (cmd.weaponSlot >= 0 && cmd.weaponSlot < s.weapons.length && cmd.weaponSlot !== s.weaponIdx) {
      s.weaponIdx = cmd.weaponSlot;
      s.reloadUntil = 0;
    }

    const wid = s.weapons[s.weaponIdx];
    const def = WEAPONS[wid];

    // reload — the guard means "not already reloading" (=== 0), NOT "the
    // timer expired". The old time-based guard re-armed on the very frame
    // the timer lapsed, BEFORE the refill below could run — so a HELD
    // reload input restarted the reload forever and the clip never filled.
    // Real input taps (oneShot/rising-edge), which is the only reason this
    // never bricked a shipped weapon; held-state senders (net clients,
    // bot brains, probes) would have hit it.
    if (cmd.reload && s.clip[s.weaponIdx] < def.clip && this.reloadStock(s, def) > 0 && s.reloadUntil === 0) {
      s.reloadUntil = this.time + def.reloadTime;
      s.statReloads = (s.statReloads ?? 0) + 1; // §13: manual reload
      this.emit({ type: 'reload', pos: s.pos, soldierId: s.id });
    }
    // §13: time on the SIDEARM — the "fights end in pistols" measure
    if (s.weaponIdx === 1 && (s.kind === 'human' || s.kind === 'bot')) {
      s.statSecondaryT = (s.statSecondaryT ?? 0) + dt;
    }
    this.finishReload(s, def);

    // movement intent (armor weighs you down)
    const c = CLASSES[s.classId];
    let speed = c.speed * (SURF_SOLDIER[surfaceAt(this.map.surface, s.pos.x, s.pos.z, this.map.geometry)] ?? 1) // §8.6
      * moveMult(this.weather, 'soldier') // §8.8 snow drags boots
      * this.moveSpeedMul; // Robert's global movement knob (1 = shipped feel)
    if (s.cloaked) speed *= 0.8;
    // M1 SPRINT: hold the key, burn the tank. No sprinting while ducked, and
    // an empty tank simply refuses — the meter IS the mechanic.
    s.sprinting = !!cmd.sprint && !s.crouching && s.energy > 1 &&
      (cmd.moveX !== 0 || cmd.moveZ !== 0);
    if (s.sprinting) {
      speed *= SPRINT_MULT;
      s.energy = Math.max(0, s.energy - SPRINT_DRAIN * dt);
    }
    if (s.rageMul) speed *= s.rageMul; // Ragebeast: the wound makes him fast
    for (const eid of s.equipment) {
      const e = EQUIPMENT[eid];
      if (e?.speedMult) speed *= e.speedMult;
    }
    if (s.draggingId >= 0) speed *= 0.5; // hauling a body is slow, honest work
    if (s.crouching) speed *= 0.5;       // ducked walking is half pace
    // GUARD (§12): a raised brace is a shuffle, and it burns the tank — an
    // exhausted guard drops on the next tick (recomputed from energy > 0.5)
    if (s.guarding) { speed *= 0.45; s.energy = Math.max(0, s.energy - GUARD_DRAIN * dt); }
    // ECLIPSE'S DARK SLIDE: +15% in smoke or long grass, -10% in the open —
    // terrain-reading as movement identity
    if (s.ascendant === 'eclipse') {
      const dark = this.smoked.has(s.id) || tileAt(this.map.grid, s.pos.x, s.pos.z, this.map.geometry) === T_GRASS;
      speed *= dark ? 1.15 : 0.9;
    }
    // THE SEAM SANITIZER (found by the threat rig): a brain that emits NaN
    // intent must never poison the sim — Math.hypot(NaN, x) is NaN and
    // `NaN || 1` stays NaN, so one bad division in a bot turned Magnetar
    // into an untargetable ghost at (NaN, z). Intent is clamped finite here.
    const mx = Number.isFinite(cmd.moveX) ? cmd.moveX : 0;
    const mz = Number.isFinite(cmd.moveZ) ? cmd.moveZ : 0;
    // Normalize DOWN only — never up. The old `mx/len` scaled ANY nonzero
    // intent to full stride, so a 0.001-magnitude separation whisper became
    // a 9.5 u/s lunge and every force equilibrium turned into a two-tick
    // bang-bang vibration (the flight recorder clocked posted sentries at 80
    // direction flips a second). Sub-unit intent now means sub-full speed:
    // whispers drift, walks still sprint, equilibria SETTLE. Keyboard input
    // is 0/±1 per axis, so player feel is untouched.
    const len = Math.hypot(mx, mz);
    const k = len > 1 ? 1 / len : 1;
    // M1 CHARGED LEAP mid-arc: the input does NOT write velocity — the arc is
    // ballistic ("no air control"). Land where you aimed or learn to aim.
    if (!s.leaping) {
      const tvx = mx * k * speed, tvz = mz * k * speed;
      // ICE IS SLICK (row 240 — the `slick` flag was dead data): on a slick
      // floor the boots don't BITE. Instead of snapping velocity to intent,
      // it EASES toward it (low grip) and COASTS when you let go — you skate,
      // you overshoot the corner, a shove sends you sliding. Grounded only;
      // the airborne arc and the leap own their own physics.
      const slick = s.pos.y <= 0.05
        && (this.isFrozenWater(s.pos.x, s.pos.z) // row 246: frozen water IS ice
          || materialForSurface(surfaceAt(this.map.surface, s.pos.x, s.pos.z, this.map.geometry)).slick === true);
      if (slick) {
        if (len > 0.01) {
          // pushing off: the boots EASE toward intent, never snap (low grip)
          const grip = Math.min(1, dt * 4.5);
          s.vel.x += (tvx - s.vel.x) * grip;
          s.vel.z += (tvz - s.vel.z) * grip;
        } else {
          // COASTING with no input: ice has almost no friction — a long glide
          // that bleeds off slowly (~0.98/tick), not a dead stop.
          const drag = Math.max(0, 1 - dt * 1.2);
          s.vel.x *= drag;
          s.vel.z *= drag;
        }
      } else {
        s.vel.x = tvx;
        s.vel.z = tvz;
      }
    }

    // jetpack (jump troopers) / hop for everyone. The FLIGHT ECONOMY
    // (Robert: "you can fly across the whole map without ever landing"):
    //  · an emptied tank LATCHES — no relaunch until it recovers to 35
    //  · thrust fades above 6u — a soft ceiling, not a cliff ("too high")
    //  · energy only regenerates ON THE GROUND (below) — feathering the
    //    trigger no longer buys infinite hang time. Fly, land, breathe.
    //  · and the BREATHE is literal: for JET_BREATHER after touchdown the
    //    tank still refuses to flow — landing is a commitment, not a
    //    trampoline bounce between hops.
    if (cmd.jump && !swimming) {
      if (c.ability === 'jetpack' && s.energy > 1 && !s.jetSpent) {
        s.vel.y = JET_THRUST * Math.max(0, Math.min(1, 1 - (s.pos.y - 6) / 4));
        s.energy = Math.max(0, s.energy - JET_DRAIN * dt);
        s.jetRestUntil = this.time + JET_BREATHER;
        if (s.energy <= 1) s.jetSpent = true; // burned dry — the latch drops
        if (this.tick % 6 === 0) this.emit({ type: 'jetpack', pos: s.pos, soldierId: s.id });
      } else if (s.pos.y <= 0.01) {
        s.vel.y = 7;
      }
    }
    if (s.jetSpent && s.energy >= 35) s.jetSpent = false; // recovered enough to relight

    // THE FLASHLIGHT (§10): T toggles. The beam buys the CONE extra reach
    // (perception.ts TORCH_MULT) and stretches the local darkness — but
    // light gives you away: dormant sprinters wake on it (bots.ts).
    if (cmd.torch) {
      s.torchOn = !s.torchOn;
      this.emit({ type: 'torch', pos: { ...s.pos }, soldierId: s.id });
    }

    // cloak toggle
    if (cmd.ability && c.ability === 'cloak' && this.time >= s.nextAbilityAt) {
      s.cloaked = !s.cloaked;
      s.nextAbilityAt = this.time + 0.4;
      this.emit({ type: 'cloak', pos: s.pos, soldierId: s.id });
    }
    if (s.cloaked) {
      s.energy -= CLOAK_DRAIN * dt;
      if (s.energy <= 0) { s.cloaked = false; s.energy = 0; }
    } else if (!(cmd.jump && c.ability === 'jetpack')) {
      // jet fuel only flows on the deck — hanging in the sky earns nothing
      const grounded = s.pos.y <= 0.05;
      // the breather clock slides while airborne, so it counts from TOUCHDOWN
      if (c.ability === 'jetpack' && !grounded) s.jetRestUntil = this.time + JET_BREATHER;
      // …and for that first breath after landing the tank stays shut (gods
      // are exempt — an ascended body answers to its own economy, and the
      // threat-measure arena must never feel this)
      const catchingBreath = c.ability === 'jetpack' && s.ascendant === undefined
        && this.time < (s.jetRestUntil ?? 0);
      // M1: the tank refills on the class's own clock — and never mid-sprint
      // M4: an ascended body runs on its GOD's tank rate when it has one —
      // the class stat underneath is irrelevant once you're wearing a god
      const regenMul = s.ascendant ? (LSWS[s.ascendant]?.energyRegen ?? 1) : (c.energyRegen ?? 1);
      const beaming = this.time < (s.beamingUntil ?? 0); // a live held beam burns, doesn't refill
      const rate = (c.ability === 'jetpack' && !grounded) || catchingBreath || s.sprinting || s.guarding || beaming || (s.meleeCharge ?? 0) > 0
        ? 0
        : ENERGY_REGEN * regenMul;
      s.energy = Math.min(100, s.energy + rate * dt);
    }

    // medic self-stim — also the field cure: it walks the strain back (§3.1
    // "medical treatment" reduces Viral Load), so a bitten medic can stim even
    // at full health to buy incubation time
    if (cmd.ability && c.ability === 'heal' && this.time >= s.nextAbilityAt && s.energy >= 50
        && (s.hp < s.maxHp || (s.viralLoad ?? 0) > 0)) {
      s.hp = Math.min(s.maxHp, s.hp + 45);
      if (s.viralLoad) s.viralLoad = Math.max(0, s.viralLoad - 40);
      s.energy -= 50;
      s.nextAbilityAt = this.time + 1;
      this.emit({ type: 'heal', pos: s.pos, soldierId: s.id });
    }

    // pathfinder plants warp beacons (alternating ends of the pair)
    if (cmd.ability && c.ability === 'warp' && this.time >= s.nextAbilityAt && s.energy >= 50) {
      const mineA = [...this.gadgets.values()].find((g) => g.type === 'warpA' && g.ownerId === s.id);
      const mineB = [...this.gadgets.values()].find((g) => g.type === 'warpB' && g.ownerId === s.id);
      const next: GadgetType = !mineA ? 'warpA' : !mineB ? 'warpB' : 'warpA';
      // replanting an end moves it
      const existing = next === 'warpA' ? mineA : mineB;
      if (existing) this.gadgets.delete(existing.id);
      if (!isBlocked(this.map.grid, s.pos.x, s.pos.z, false, this.map.geometry)) {
        const g = this.spawnGadget(next, s.team, s.id, s.pos, 150);
        s.energy -= 50;
        s.nextAbilityAt = this.time + 1;
        this.emit({ type: 'beacon_planted', pos: g.pos, soldierId: s.id, text: next === 'warpA' ? 'Warp ALPHA planted' : 'Warp BETA planted' });
      }
    }

    // ghost deploys a recon drone
    if (cmd.ability && c.ability === 'drone' && this.time >= s.nextAbilityAt && s.energy >= 70) {
      const existing = [...this.gadgets.values()].find((g) => g.type === 'drone' && g.ownerId === s.id);
      if (existing) this.gadgets.delete(existing.id);
      const piloted = s.kind === 'human'; // humans fly FPV; bots keep the auto-orbit
      const g = this.spawnGadget('drone', s.team, s.id, s.pos, piloted ? 12 : 80);
      if (piloted) {
        g.piloted = true;
        g.pos.y = 2.6;
        g.vel = { x: 0, z: 0 };
        g.yaw = s.yaw;
        g.signal = 1;
      } else {
        g.anchor = { ...s.pos };
        g.phase = this.rng.range(0, Math.PI * 2);
      }
      s.energy -= 70;
      s.nextAbilityAt = this.time + 2;
      this.emit({ type: 'beacon_planted', pos: g.pos, soldierId: s.id, text: piloted ? 'FPV drone airborne' : 'Recon drone deployed' });
    }

    // heavy raises a shield dome
    if (cmd.ability && c.ability === 'shield' && this.time >= s.nextAbilityAt && s.energy >= 80) {
      const existing = [...this.gadgets.values()].find((g) => g.type === 'shield' && g.ownerId === s.id);
      if (existing) this.gadgets.delete(existing.id);
      this.spawnGadget('shield', s.team, s.id, s.pos, 400, 30);
      s.energy -= 80;
      s.nextAbilityAt = this.time + 3;
      this.emit({ type: 'beacon_planted', pos: s.pos, soldierId: s.id, text: 'Shield dome raised' });
    }

    // engineer builds a sentry
    if (cmd.ability && c.ability === 'turret' && this.time >= s.nextAbilityAt && s.energy >= 80) {
      const mine = [...this.turrets.values()].filter((t) => t.alive && t.ownerId === s.id);
      if (mine.length < 2) {
        const fx = s.pos.x + Math.cos(s.yaw) * 2.5;
        const fz = s.pos.z + Math.sin(s.yaw) * 2.5;
        if (!isBlocked(this.map.grid, fx, fz, false, this.map.geometry)) {
          const t: Turret = {
            id: this.id(), team: s.team, pos: { x: fx, y: 0, z: fz }, yaw: s.yaw,
            hp: 180, maxHp: 180, nextFireAt: 0, ownerId: s.id, alive: true,
          };
          this.turrets.set(t.id, t);
          s.energy -= 80;
          s.nextAbilityAt = this.time + 1.5;
          this.emit({ type: 'turret_built', pos: t.pos, soldierId: s.id, team: s.team });
        }
      }
    }

    // grenade key: orbital designator > demolition kit > class special > frag.
    // Every thrown item is cursor-targeted: it lands at cmd.aimDist, clamped
    // to the item's max reach (proven top-down mechanic — throw at the cursor).
    // X rotates the grenade bag: class default → smoke → fire, skipping
    // empty pouches. The announcer names what's now in your hand.
    if (cmd.nadeCycle) {
      const pouches: [number, string][] = [
        [1, `SMOKE ×${s.smokes ?? 0}`],
        [2, `INCENDIARY ×${s.firebombs ?? 0}`],
        [3, `CONCUSSION ×${s.concs ?? 0}`],
        [4, `SINGULARITY ×${s.gravs ?? 0}`],
        [5, `PLASMA STICK ×${s.plasmas ?? 0}`],
        [6, `TIME BOMB ×${s.timebombs ?? 0}`],
        [0, s.classId === 'engineer' ? `MINES ×${s.grenades}` : `FRAG ×${s.grenades}`],
      ];
      // stocked-check per slot: 0 (class kit) is always available; each pouch
      // shows only while it has rounds
      const nadeStocked = (i: number): boolean => i === 0 ? true
        : i === 1 ? (s.smokes ?? 0) > 0 : i === 2 ? (s.firebombs ?? 0) > 0 : i === 3 ? (s.concs ?? 0) > 0
        : i === 4 ? (s.gravs ?? 0) > 0 : i === 5 ? (s.plasmas ?? 0) > 0 : (s.timebombs ?? 0) > 0;
      const cur = s.nadeSel ?? 0;
      for (let step = 1; step <= 7; step++) {
        const next = (cur + step) % 7;
        const stocked = nadeStocked(next);
        if (stocked) {
          if (next !== cur) {
            s.nadeSel = next;
            if (s.kind === 'human') {
              const label = pouches.find(([i]) => i === next)![1];
              this.emit({ type: 'announce', text: `GRENADE: ${label}`, big: false });
            }
          }
          break;
        }
      }
    }
    // THE OUTBREAK (OUTBREAK-SPEC §11): cycle the loaded ammunition type —
    // BALL (reliable) → AP (threads plate) → INCENDIARY (burns corpses, mauls
    // infected groups). A tactical choice, not a damage ladder.
    if (cmd.cycleAmmo && !s.ascendant) {
      // ball → AP → INC → TRC → SUB → EXP → BNR → ball (§11.1, the full roster)
      const order: (Soldier['ammoType'])[] = [undefined, 'ap', 'inc', 'trc', 'sub', 'exp', 'bnr'];
      const i = order.indexOf(s.ammoType ?? undefined);
      s.ammoType = order[(i + 1) % order.length];
      if (s.kind === 'human') {
        const label = AMMO_INFO[s.ammoType ?? 'ball'].label;
        this.emit({ type: 'announce', text: `AMMO: ${label}`, big: false });
      }
    }
    // A GOD DOES NOT REACH FOR A GRENADE (Robert, on Firebrand: "I don't think
    // he should be throwing these grenades either"). Ascension swaps in the
    // signature arm and leaves the class kit behind; the pouch was the one
    // piece of infantry issue that survived. The COUNT stays untouched on
    // purpose — Firebrand's bot brain uses s.grenades as its cash-the-board
    // signal (see sim/lsw/firebrand.ts), so emptying it would mute the bot.
    if (cmd.grenade && !swimming && !s.ascendant && this.time >= s.nextGrenadeAt) {
      const reachTo = (max: number) => Math.max(4, Math.min(cmd.aimDist ?? max, max));
      const grenadeGateBefore = s.nextGrenadeAt; // any branch that acts moves this
      // manpads only claims the key while an aircraft is locked — no lock, no wasted round
      const samTarget = s.manpads > 0 && this.hasEquip(s, 'samLauncher') ? this.samLockTarget(s) : null;
      // the bag override: with smoke or fire in hand, G throws THAT — the
      // class payload chain below never sees the press. Cycle back for it.
      if (s.nadeSel === 1 && (s.smokes ?? 0) > 0) {
        s.smokes = (s.smokes ?? 0) - 1;
        s.nextGrenadeAt = this.time + 1.2;
        this.throwProjectile(s, 'smoke_nade', 1.4, 16, true, reachTo(WEAPONS.smoke_nade.range), cmd.lob ?? 1, true);
        this.emit({ type: 'shot', pos: s.pos, weapon: 'smoke_nade', soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
        if ((s.smokes ?? 0) <= 0) s.nadeSel = 0; // empty pouch falls back to the class kit
      } else if (s.nadeSel === 2 && (s.firebombs ?? 0) > 0) {
        s.firebombs = (s.firebombs ?? 0) - 1;
        s.nextGrenadeAt = this.time + 1.2;
        this.throwProjectile(s, 'fire_nade', 1.4, 16, true, reachTo(WEAPONS.fire_nade.range), cmd.lob ?? 1, true);
        this.emit({ type: 'shot', pos: s.pos, weapon: 'fire_nade', soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
        if ((s.firebombs ?? 0) <= 0) s.nadeSel = 0;
      } else if (s.nadeSel === 3 && (s.concs ?? 0) > 0) {
        s.concs = (s.concs ?? 0) - 1;
        s.nextGrenadeAt = this.time + 1.2;
        this.throwProjectile(s, 'conc_nade', 1.4, 16, true, reachTo(WEAPONS.conc_nade.range), cmd.lob ?? 1, true);
        this.emit({ type: 'shot', pos: s.pos, weapon: 'conc_nade', soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
        if ((s.concs ?? 0) <= 0) s.nadeSel = 0;
      } else if (s.nadeSel === 4 && (s.gravs ?? 0) > 0) {
        s.gravs = (s.gravs ?? 0) - 1;
        s.nextGrenadeAt = this.time + 1.4;
        this.throwProjectile(s, 'grav_nade', 1.4, 16, true, reachTo(WEAPONS.grav_nade.range), cmd.lob ?? 1, true);
        this.emit({ type: 'shot', pos: s.pos, weapon: 'grav_nade', soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
        if ((s.gravs ?? 0) <= 0) s.nadeSel = 0;
      } else if (s.nadeSel === 5 && (s.plasmas ?? 0) > 0) {
        s.plasmas = (s.plasmas ?? 0) - 1;
        s.nextGrenadeAt = this.time + 1.4;
        // a flatter, faster throw — you AIM a plasma stick at a body
        this.throwProjectile(s, 'plasma_nade', 1.3, 24, true, reachTo(WEAPONS.plasma_nade.range), 0.7, false);
        this.emit({ type: 'shot', pos: s.pos, weapon: 'plasma_nade', soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
        if ((s.plasmas ?? 0) <= 0) s.nadeSel = 0;
      } else if (s.nadeSel === 6 && (s.timebombs ?? 0) > 0) {
        // PLANTED at your feet — not thrown (it's a demolition charge)
        s.timebombs = (s.timebombs ?? 0) - 1;
        s.nextGrenadeAt = this.time + 1.5;
        this.spawnGadget('time_bomb', s.team, s.id, { ...s.pos, y: 0 }, 60, 4);
        this.emit({ type: 'bomb_planted', pos: { ...s.pos }, soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
        if ((s.timebombs ?? 0) <= 0) s.nadeSel = 0;
      } else if (s.orbitals > 0) {
        s.orbitals--;
        s.nextGrenadeAt = this.time + 1.5;
        this.throwProjectile(s, 'orbital_beacon', 1.4, 26, true, reachTo(WEAPONS.orbital_beacon.range));
        this.emit({ type: 'shot', pos: s.pos, weapon: 'orbital_beacon', soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
      } else if (samTarget) {
        s.manpads--;
        s.nextGrenadeAt = this.time + 1.5;
        this.fireSamMissile(s, samTarget);
        if (s.cloaked) s.cloaked = false;
      } else if (this.hasEquip(s, 'demoCharge') && s.grenades > 0) {
        s.grenades--;
        s.nextGrenadeAt = this.time + 2.5;
        this.throwProjectile(s, 'demo_charge', 1.0, 12, true, reachTo(WEAPONS.demo_charge.range));
        this.emit({ type: 'shot', pos: s.pos, weapon: 'demo_charge', soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
      } else if (this.hasEquip(s, 'deployCamera')) {
        // spy camera: planted at your feet, feeds the team (2 active max)
        const mine = [...this.gadgets.values()].filter((g) => g.type === 'camera' && g.ownerId === s.id);
        if (mine.length < 2 && !isBlocked(this.map.grid, s.pos.x, s.pos.z, false, this.map.geometry)) {
          this.spawnGadget('camera', s.team, s.id, s.pos, 50);
          s.nextGrenadeAt = this.time + 1.5;
          this.emit({ type: 'beacon_planted', pos: { ...s.pos }, soldierId: s.id, text: 'Spy camera planted' });
        }
      } else if (c.ability === 'warp' && s.grenades > 0) {
        s.grenades--;
        s.nextGrenadeAt = this.time + 1.5;
        this.throwProjectile(s, 'target_beacon', 1.4, 28, true, reachTo(WEAPONS.target_beacon.range));
        this.emit({ type: 'shot', pos: s.pos, weapon: 'target_beacon', soldierId: s.id });
      } else if (c.ability === 'drone' && s.grenades > 0) {
        s.grenades--;
        s.nextGrenadeAt = this.time + 1.5;
        this.throwProjectile(s, 'emp', 1.4, 30, true, reachTo(WEAPONS.emp.range));
        this.emit({ type: 'shot', pos: s.pos, weapon: 'emp', soldierId: s.id });
      } else if (c.ability === 'turret') {
        const mines = [...this.mines.values()].filter((m) => m.ownerId === s.id);
        if (mines.length < 3 && s.grenades > 0) {
          s.grenades--;
          // the engineer's mines are SPIDER mines now (Robert): they lie dormant,
          // then wake and run down whoever strays near — area denial that hunts.
          const m: Mine = { id: this.id(), team: s.team, ownerId: s.id, pos: { ...s.pos }, armedAt: this.time + 1.2, spider: true };
          this.mines.set(m.id, m);
          s.nextGrenadeAt = this.time + 0.8;
          this.emit({ type: 'mine_planted', pos: m.pos, soldierId: s.id });
        }
      } else if (s.grenades > 0) {
        s.grenades--;
        s.nextGrenadeAt = this.time + 1.2;
        // hand-thrown frag: lands on the cursor, max ~22u (not the full GL-40
        // lob). The player's wheel picks the arc (flat rope ↔ mortar), and a
        // hand frag BANKS off walls — the bounce flag is the bank-shot license.
        this.throwProjectile(s, 'gl', 1.4, 16, true, reachTo(HAND_FRAG_REACH), cmd.lob ?? 1, true);
        this.emit({ type: 'shot', pos: s.pos, weapon: 'gl', soldierId: s.id });
        if (s.cloaked) { s.cloaked = false; }
      }
      // any branch that acted is a hostile action — protection ends (55B)
      if (s.nextGrenadeAt !== grenadeGateBefore) s.protectedUntil = 0;
    }

    // 10.1 THE BURST RUNNER: rounds 2..n of a burst arrive on their own
    // clock, trigger-free; the LAST round closes the books on the whole
    // n/rof cycle (DPS-neutral — the burst spends its budget up front).
    if ((s.burstLeft ?? 0) > 0 && this.time >= (s.nextBurstShotAt ?? 0)
        && s.reloadUntil === 0 && !swimming && !s.guarding) {
      if (s.clip[s.weaponIdx] > 0) {
        this.fireSoldierWeapon(s, wid, def, cmd.aimDist);
        s.burstLeft = (s.burstLeft ?? 1) - 1;
        s.nextBurstShotAt = this.time + 1 / (def.rof * 3);
        if (s.burstLeft === 0) {
          const n = def.fireMode === 'burst3' ? 3 : 2;
          s.nextFireAt = Math.max(s.nextFireAt, (s.burstStartAt ?? this.time) + n / def.rof);
        }
      } else s.burstLeft = 0; // dry mid-burst — the runner stops, the reload path below answers
    }

    // §BEAMS (row 188) THE HELD STREAM: while the trigger is held the beam
    // CONNECTS — a per-tick ray walks the aim line at chest height to the
    // first wall or the first body and POURS dps·dt into it. No projectiles,
    // no clip; the governor is HEAT — sustain to 100% and the emitter JAMS.
    // LSW arms only (the def carries `held`; no soldier weapon ever will).
    if (def.held) {
      const jammed = this.time < (s.beamJamUntil ?? 0);
      // Robert: "it should take your energy — you shouldn't be able to sustain
      // them as long." The pour now DRAINS the tank on top of the heat clock;
      // an empty tank cuts the stream (a second, tighter governor on the spray).
      if (cmd.fire && !jammed && !swimming && !s.guarding && s.encasedUntil === undefined && s.energy > 0.5) {
        s.protectedUntil = 0; // pouring is hostile action (55B)
        s.energy = Math.max(0, s.energy - BEAM_DRAIN * dt);
        s.beamHeat = Math.min(1, (s.beamHeat ?? 0) + dt / def.held.sustain);
        if (s.beamHeat >= 1) {
          s.beamJamUntil = this.time + def.held.jam;
          this.emit({ type: 'beam_jam', pos: { ...s.pos }, soldierId: s.id });
        }
        s.beamingUntil = this.time + 0.1; // the renderer's stream window
        // §BEAMS row 189: the pour is REGISTERED, not resolved — the post-pass
        // (resolveHeldBeams) first checks whether this stream CROSSES an
        // enemy stream. Crossed streams CLASH (pouring into each other, not
        // into bodies); only unpaired streams run the damage walk. SURGE =
        // sprint held while pouring (stamina burns, the clash node shoves).
        this.tickBeams.push({ s, def, wid, surge: !!cmd.sprint && s.energy > 1 });
      } else {
        // cooling: released, jammed, or interrupted — heat bleeds off
        s.beamHeat = Math.max(0, (s.beamHeat ?? 0) - dt / (def.held.sustain * 0.7));
      }
      s.trigHeld = cmd.fire;
      // a held arm never enters the projectile path — fall through to alt fire
    }
    // firing — unless you are SWIMMING or bracing behind a raised GUARD (§12).
    // 10.1 FIRE MODES: auto rides the held trigger as ever; single / pump /
    // double / burst fire on the trigger EDGE — one press, one discipline.
    // Bots bypass the edge (a machine's finger taps perfectly at rof).
    const fmode = def.fireMode ?? 'auto';
    const trigger = !def.held && cmd.fire && (fmode === 'auto' || s.kind !== 'human' || !s.trigHeld);
    if (trigger && !swimming && !s.guarding && s.reloadUntil === 0 && this.time >= s.nextFireAt) {
      if (s.clip[s.weaponIdx] > 0) {
        s.protectedUntil = 0; // hostile action ends spawn protection (55B)
        // CHARGE: a charge weapon winds up before it releases — start the hold on
        // the first ready frame and fire a ×mul shot once held for charge.t.
        if (def.charge) {
          if (s.chargeStart === undefined) s.chargeStart = this.time;
          if (this.time - s.chargeStart >= def.charge.t) {
            this.fireSoldierWeapon(s, wid, def, cmd.aimDist, def.charge.mul);
            s.chargeStart = undefined;
          }
        } else if (fmode === 'burst2' || fmode === 'burst3') {
          // round 1 now; the runner above delivers the rest
          this.fireSoldierWeapon(s, wid, def, cmd.aimDist);
          s.burstLeft = (fmode === 'burst3' ? 3 : 2) - 1;
          s.burstStartAt = this.time;
          s.nextBurstShotAt = this.time + 1 / (def.rof * 3);
        } else if (fmode === 'double') {
          // BOTH BARRELS (Robert: "two rounds at a time — a heck of an
          // edge"): one press, two rounds, and the pair pays 2/rof.
          this.fireSoldierWeapon(s, wid, def, cmd.aimDist);
          if (s.clip[s.weaponIdx] > 0) this.fireSoldierWeapon(s, wid, def, cmd.aimDist);
          s.nextFireAt = Math.max(s.nextFireAt, this.time + 2 / def.rof);
        } else {
          this.fireSoldierWeapon(s, wid, def, cmd.aimDist);
        }
      } else if (this.reloadStock(s, def) > 0) {
        s.reloadUntil = this.time + def.reloadTime;
        s.statReloads = (s.statReloads ?? 0) + 1; // §13: auto-reload on empty
        this.emit({ type: 'reload', pos: s.pos, soldierId: s.id });
      } else if (this.time >= (s.nextDryAt ?? 0)) {
        // §13 DIAGNOSTICS: a TRULY dry gun — no mag, no reserve. The click
        // is the datum the 25% reserve cut will be judged against.
        s.statDry = (s.statDry ?? 0) + 1;
        s.nextDryAt = this.time + 0.5;
      }
    } else if (s.chargeStart !== undefined && !swimming) {
      // trigger released (or interrupted) mid-charge: loose a partial-charge
      // round scaled by how long it was held, then clear the wind-up
      const c = def.charge;
      if (c && !cmd.fire && s.reloadUntil === 0 && this.time >= s.nextFireAt && s.clip[s.weaponIdx] > 0) {
        const held = this.time - s.chargeStart;
        const mul = 1 + (c.mul - 1) * Math.max(0, Math.min(1, held / c.t));
        this.fireSoldierWeapon(s, wid, def, cmd.aimDist, mul);
      }
      s.chargeStart = undefined;
    }
    s.trigHeld = cmd.fire; // 10.1: the rising-edge latch (single/pump/double/burst)

    // SECONDARY FIRE (right mouse): the under-barrel surprise. It rides the
    // weapon in hand — holster the weapon and the surprise holsters too.
    if (cmd.altFire && !swimming && def.alt && this.time >= s.nextAltAt) {
      this.fireAltWeapon(s, def.alt);
    }
    // an under-barrel flame burst keeps spewing while its clock runs
    if (s.altBurstUntil > this.time && !swimming) {
      this.throwProjectile(s, 'flamer', 1.3, WEAPONS.flamer.speed, false);
    }
  }

  /** SECONDARY FIRE: four personalities, one button.
   *  burst      — under-barrel flame burp (AR-606): 0.55s of fire, 3 canisters a life
   *  skitter    — a charge on legs that RUNS at the nearest enemy (GL-40):
   *               shoot it before it reaches you, or it reaches you
   *  tag        — a dart that pins its victim on every enemy screen (RG-2)
   *  overcharge — six cells become one ugly orb (Kamenel plasma): costs clip, not alt ammo */
  fireAltWeapon(s: Soldier, alt: NonNullable<(typeof WEAPONS)[WeaponId]['alt']>) {
    if (alt.kind === 'overcharge') {
      const cells = alt.cells ?? 6;
      if (s.clip[s.weaponIdx] < cells) return;
      if (Number.isFinite(s.clip[s.weaponIdx])) s.clip[s.weaponIdx] -= cells;
    } else {
      if (s.altAmmo <= 0) return;
      s.altAmmo--;
    }
    s.nextAltAt = this.time + alt.cooldown;
    s.protectedUntil = 0; // hostile action ends spawn protection (55B)
    if (s.cloaked) s.cloaked = false;
    const muzzle = { ...s.pos, y: s.pos.y + 1.4 };
    switch (alt.kind) {
      case 'burst':
        s.altBurstUntil = this.time + 0.55;
        this.emit({ type: 'shot', pos: muzzle, weapon: 'flamer', soldierId: s.id });
        break;
      case 'tag':
        this.throwProjectile(s, 'tag_dart', 1.4, WEAPONS.tag_dart.speed, false);
        this.emit({ type: 'shot', pos: muzzle, weapon: 'tag_dart', soldierId: s.id });
        break;
      case 'overcharge':
        this.throwProjectile(s, 'plasma_orb', 1.4, WEAPONS.plasma_orb.speed, false);
        this.emit({ type: 'shot', pos: muzzle, weapon: 'plasma_orb', soldierId: s.id });
        break;
      case 'skitter': {
        const g: Gadget = {
          id: this.id(), type: 'skitter', team: s.team, ownerId: s.id,
          pos: { x: s.pos.x + Math.cos(s.yaw) * 1.2, y: 0, z: s.pos.z + Math.sin(s.yaw) * 1.2 },
          hp: 30, maxHp: 30, bornAt: this.time, expiresAt: this.time + 10, yaw: s.yaw,
        };
        this.gadgets.set(g.id, g);
        this.emit({ type: 'shot', pos: { ...s.pos }, weapon: 'gl', soldierId: s.id });
        break;
      }
    }
  }

  fireSoldierWeapon(s: Soldier, wid: WeaponId, def = WEAPONS[wid], aimDist?: number, dmgMul = 1) {
    // row 178: kuchler HOT HALF — the back half of the mag runs 10% faster
    const hot = def.brand === 'kuchler' && s.clip[s.weaponIdx] <= def.clip / 2 ? 1.1 : 1;
    s.nextFireAt = this.time + 1 / (def.rof * hot);
    if (Number.isFinite(s.clip[s.weaponIdx])) s.clip[s.weaponIdx]--;
    if (s.cloaked) s.cloaked = false;

    if (def.range <= 2.5) { // melee (zombie claws) — starts a swing, not a hit
      this.startMelee(s, def);
      return;
    }
    // §13 AMMO DIAGNOSTICS: every round that leaves a mortal's mag is a
    // datum — the 25% reserve cut gets judged against these numbers
    if (s.kind === 'human' || s.kind === 'bot') {
      s.statShots = (s.statShots ?? 0) + 1;
      this.ammoShotsByWeapon.set(wid, (this.ammoShotsByWeapon.get(wid) ?? 0) + 1);
    }
    // AMMUNITION TYPE (OUTBREAK-SPEC §11) + the AP-rounds equipment stack on
    // BALLISTIC weapons only (bullet/shell — no energy AP). AP threads issued
    // plate for −25% soft damage (gated in damageSoldier; iron molt & LSW
    // identity armor exempt). INCENDIARY is denial: it burns corpses down and
    // savages the infected, at a soft-damage cost against the merely living.
    const ballistic = def.tracer === 'bullet' || def.tracer === 'shell';
    const at = ballistic ? s.ammoType : undefined; // ammo riders are ballistic-only
    const ap = at === 'ap' || (ballistic && this.hasEquip(s, 'apRounds'));
    const inc = at === 'inc';
    // per-type damage scalar: AP −25% / INC −15% / SUB −20% / EXP −10% base
    // (its bite is at the target) / BNR −40% (a denial round, not a killer).
    const dm = dmgMul * (ap ? 0.75 : inc ? 0.85 : at === 'sub' ? 0.8 : at === 'exp' ? 0.9 : at === 'bnr' ? 0.6 : 1);
    // the hit-time rider carried on the round (EXP/BNR/TRC resolve on contact)
    const rider = at === 'exp' || at === 'bnr' || at === 'trc' ? at : undefined;
    // SUBSONIC trades reach for silence — a shorter effective range.
    const range = at === 'sub' ? def.range * 0.75 : def.range;
    // arc weapons are cursor-targeted like every thrown item: the shell LANDS
    // at aimDist instead of always lobbing to max range. (This is what made
    // the GL-40 unusable at anything but exactly 46u.)
    const reach = def.arc ? Math.max(6, Math.min(aimDist ?? range, range)) : range;
    for (let p = 0; p < def.pellets; p++) {
      this.throwProjectile(s, wid, 1.4, def.speed, def.arc, reach, 1, false, dm, ap, inc, rider);
    }
    this.emit({ type: 'shot', pos: { ...s.pos, y: s.pos.y + 1.4 }, weapon: wid, soldierId: s.id });
  }

  /**
   * WINDUP: the swing starts here and the direction locks NOW. A victim that
   * steps out of the 90° arc — or out of reach — before the strike lands is
   * simply not hit. That's the whole point of the telegraph.
   */
  startMelee(s: Soldier, def: (typeof WEAPONS)[WeaponId]) {
    if (s.meleeStrikeAt > 0) return; // one swing in the air at a time
    s.nextFireAt = this.time + 1 / def.rof; // RECOVER pacing — same cadence as the old instant hit
    // the telegraph must never eat the whole interval — land before the next trigger
    const windup = Math.min(meleeWindupFor(s.kind), 0.8 / def.rof);
    s.meleeStrikeAt = this.time + windup;
    s.meleeYaw = s.yaw;
    s.meleeWeapon = def.id;
    this.emit({ type: 'melee_windup', pos: { ...s.pos }, weapon: def.id, soldierId: s.id });
  }

  /**
   * BITE STRUGGLE (OUTBREAK-SPEC §15.5): a zombie latches on instead of clawing.
   * It pins the survivor in the same hold a player GRAPPLE uses (rooted, mash
   * to break) — but the grip GNAWS Viral Load, and failing to break in time is
   * a full bite. Sprinters clamp briefly (snap timing), brutes clamp longer.
   * Returns true if the bite landed a hold (so the caller can pace the zed).
   */
  beginBiteStruggle(zed: Soldier, victim: Soldier): boolean {
    if (!this.outbreakEnabled) return false;
    if (victim.kind !== 'human' && victim.kind !== 'bot') return false;
    if (victim.god || victim.ascendant !== undefined || victim.downed) return false;
    if (victim.grabbedUntil !== undefined || victim.encasedUntil !== undefined) return false;
    if (this.time < (victim.grabImmuneUntil ?? 0)) return false;
    const hold = BITE_HOLD * (zed.kind === 'sprinter' ? 0.7 : zed.kind === 'brute' ? 1.3 : 1);
    victim.grabbedUntil = this.time + hold;
    victim.grabbedBy = zed.id;
    victim.struggle = 0;
    victim.guarding = false;
    victim.vel = { x: 0, y: 0, z: 0 };
    zed.nextFireAt = this.time + hold + 0.4; // the zed is busy gnawing — no re-grab spam
    this.emit({ type: 'grabbed', pos: { ...victim.pos }, soldierId: victim.id });
    return true;
  }

  /**
   * STRIKE: the claw comes down. Arc check runs against where everyone stands
   * NOW, along the yaw locked at windup — dodges are honored, and up to two
   * victims in the wedge take the hit. The attacker lunges into the blow.
   */
  resolveMeleeStrike(s: Soldier) {
    const def = WEAPONS[s.meleeWeapon];
    s.meleeStrikeAt = 0;
    s.meleeWeapon = '';
    // IMPACT CHARGE (OUTBREAK-SPEC §13): a held STRIKE lands harder. The mult
    // was captured at release; claws never set it (×1). Spent here, once.
    const chargeMul = s.meleeChargeMul ?? 1;
    s.meleeChargeMul = undefined;
    if (!def || !s.alive) return; // attacker died mid-swing — no ghost claws
    const strikeDmg = def.damage * chargeMul;
    // the lunge: thrown ~1.5u into the swing via the decaying push impulse. A
    // heavier blow drives the attacker further into it.
    s.pushX += Math.cos(s.meleeYaw) * MELEE_LUNGE * Math.min(1.4, chargeMul);
    s.pushZ += Math.sin(s.meleeYaw) * MELEE_LUNGE * Math.min(1.4, chargeMul);
    this.emit({ type: 'shot', pos: { ...s.pos }, weapon: def.id, soldierId: s.id });
    // everyone in the front wedge, nearest first, capped at MELEE_MAX_TARGETS
    // (opt #38/S2: the wedge is ≤ range+0.6u — with 800 zeds swinging, the
    // full-roster sweep here was a real slice of the horde cliff)
    const caught: { victim: Soldier; d: number }[] = [];
    for (const other of this.soldierIndex.near((1 - s.team) as Team, s.pos.x, s.pos.z, def.range + 0.6, MELEE_SCRATCH)) {
      if (!other.alive) continue;
      const dx = other.pos.x - s.pos.x, dz = other.pos.z - s.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > def.range + 0.6) continue;
      // bearing relative to the LOCKED swing direction, wrapped to [-π, π]
      const raw = Math.atan2(dz, dx) - s.meleeYaw;
      const ang = Math.atan2(Math.sin(raw), Math.cos(raw));
      // point-blank bodies (standing inside the attacker) always count —
      // the bearing is meaningless noise at zero distance
      if (Math.abs(ang) > MELEE_ARC / 2 && d > 0.5) continue;
      caught.push({ victim: other, d });
    }
    caught.sort((a, b) => a.d - b.d);
    for (const { victim, d } of caught.slice(0, MELEE_MAX_TARGETS)) {
      const dl = Math.max(d, 0.5);
      // GUARD BEATS STRIKE (OUTBREAK-SPEC §12): a raised guard FACING the blow
      // eats it — a fraction of the damage, no shove — and PARRIES: the swing
      // rebounds onto the attacker, jarring his trigger and knocking him back.
      // The guard covers a wide frontal cone (±75°); a strike from the flank
      // or rear slips past it, which is exactly what GRAPPLE will exploit.
      if (victim.guarding) {
        const toAtk = Math.atan2(s.pos.z - victim.pos.z, s.pos.x - victim.pos.x);
        const face = Math.atan2(Math.sin(toAtk - victim.yaw), Math.cos(toAtk - victim.yaw));
        if (Math.abs(face) <= GUARD_ARC / 2) {
          this.emit({ type: 'melee_block', pos: { ...victim.pos, y: 1 }, weapon: def.id, soldierId: victim.id });
          this.damageSoldier(victim, strikeDmg * GUARD_SOAK, s.id, def.id);
          // the parry: stagger + shove the ATTACKER back off his own swing
          s.nextFireAt = Math.max(s.nextFireAt, this.time + GUARD_PARRY_STAGGER);
          s.pushX += ((s.pos.x - victim.pos.x) / dl) * 4;
          s.pushZ += ((s.pos.z - victim.pos.z) / dl) * 4;
          continue;
        }
      }
      // hit reaction: the blow staggers their aim and shoves them back a step
      victim.nextFireAt = Math.max(victim.nextFireAt, this.time + MELEE_STAGGER);
      victim.pushX += ((victim.pos.x - s.pos.x) / dl) * 3;
      victim.pushZ += ((victim.pos.z - s.pos.z) / dl) * 3;
      this.emit({ type: 'hit', pos: { ...victim.pos, y: 1 }, weapon: def.id, soldierId: s.id });
      this.damageSoldier(victim, strikeDmg, s.id, def.id);
    }
  }

  /**
   * Fire a projectile. `reach` is the intended max distance (defaults to the
   * weapon's range); for arcs it drives the launch angle so the shot actually
   * LANDS at that distance instead of a fixed short ballistic. A caller can
   * pass a shorter reach for a soft toss (e.g. the hand-thrown frag).
   */
  throwProjectile(s: Soldier, wid: WeaponId, muzzleY: number, speed: number, arc: boolean, reach = WEAPONS[wid].range, loft = 1, bounce = false, dmgMul = 1, pierceArmor = false, incendiary = false, ammo?: 'exp' | 'bnr' | 'trc') {
    const def = WEAPONS[wid];
    // 10.1 row 178 brand signatures at the muzzle: maklov TRUE ISSUE shoots
    // straighter on the move; kamenel HOT LOADS leave 15% faster (flatter
    // leads). Core weapons carry no brand — nothing here moves for them.
    if (def.brand === 'kamenel') speed *= 1.15;
    // W1.1: stance + motion bend the cone (crouch braces, sprint/airborne spray)
    const spread = (this.rng.next() - 0.5) * 2 * def.spread * aimSpreadMul(s)
      * (def.brand === 'maklov' ? 0.75 : 1);
    const yaw = s.yaw + spread;
    // Arc launch: pick vy so the shell returns to the ground exactly when it
    // has travelled `reach` horizontally. Flight time t = reach/speed; solving
    // muzzleY + vy·t − ½·g·t² = 0 gives vy = ½·g·t − muzzleY/t. Uses the live
    // (per-theme) gravity, so low-g worlds lob correctly too.
    //
    // ARC CONTROL (Robert): `loft` slides vy between a flat rope (2.2) and
    // a HIGH mortar rainbow — then speed is RE-SOLVED from the flight time
    // so the round still lands exactly on the cursor. The loft chooses the
    // road; the destination never moves. The ceiling is 1.3× the classic
    // ballistic vy (Robert: "throw it at a higher arc… control the arc
    // more") — max loft sails clean over a two-storey roof.
    let vy = 0;
    if (arc) {
      const gArc = this.gravity * 0.7;
      const t0 = reach / Math.max(speed, 1);
      const vyFull = Math.max(2, 0.5 * gArc * t0 - muzzleY / t0) * 1.3;
      const vyFlat = 2.2;
      vy = vyFlat + (Math.max(vyFull, vyFlat) - vyFlat) * Math.max(0, Math.min(1, loft));
      const tLand = (vy + Math.sqrt(vy * vy + 2 * gArc * muzzleY)) / gArc;
      speed = reach / tLand;
    }
    const p: Projectile = {
      id: this.id(), weapon: wid, ownerId: s.id, team: s.team,
      pos: { x: s.pos.x + Math.cos(yaw) * 0.8, y: s.pos.y + muzzleY, z: s.pos.z + Math.sin(yaw) * 0.8 },
      vel: { x: Math.cos(yaw) * speed, y: vy, z: Math.sin(yaw) * speed },
      bornAt: this.time, ttl: reach / Math.max(speed, 1) + (arc ? 1.4 : 0), arc,
      ...(bounce ? { bounce: true } : {}),
      ...(dmgMul !== 1 ? { dmgMul } : {}),
      ...(pierceArmor ? { pierceArmor: true } : {}),
      ...(incendiary ? { incendiary: true } : {}),
      ...(ammo ? { ammo } : {}),
    };
    // CARRY THE THROWER'S MOMENTUM (Robert: "you can outrun your own flame —
    // that's kinda crazy"). A flame stream is burning gas, not a bullet: it
    // leaves the nozzle already travelling with the man holding it. Without
    // this, a sprint straight down your own stream closes on it every tick.
    // FLAME ONLY — bullets are fast enough that inheritance is noise, and
    // adding it there would shift every lead-the-target sum the bots compute.
    if (def.tracer === 'flame') {
      p.vel.x += s.vel.x;
      p.vel.z += s.vel.z;
    }
    this.launch(p);
  }

  /**
   * THE PROJECTILE-SPEED GATE (Robert: "I want ALL projectile stuff to fall
   * under that… fire from the vehicle, it don't respect it"). Every round in
   * the game is born through this one door — soldier, VEHICLE, turret,
   * monster, or god — so nothing can silently skip the speed knob again.
   * Direct fire scales by `projectileSpeedMul`; scaling ttl inversely keeps
   * the RANGE identical (a slower round simply lives longer, landing on the
   * same spot). Arcs are exempt: their speed is re-solved from flight time so
   * the lob still lands on the cursor — the knob would only move the splash.
   */
  launch(p: Projectile): Projectile {
    const def = WEAPONS[p.weapon];
    // copy the def's effect flags onto the round ONCE (guard with undefined so a
    // re-launched submunition/boomerang keeps the value it was born with)
    if (def) {
      if (p.pierce === undefined && def.pierce) p.pierce = def.pierce;
      if (p.ricochet === undefined && def.ricochet) p.ricochet = def.ricochet;
      if (p.pierceArmor === undefined && def.pierceArmor) p.pierceArmor = def.pierceArmor;
      if (p.ignite === undefined && def.ignite) p.ignite = def.ignite;
      if (p.dmgMul === undefined) p.dmgMul = 1;
    }
    // J1 THE AIR FRAME: ordnance that lives in the vehicle-speed frame scales
    // WITH the vehicles. The two sliders default to different values (0.35
    // projectiles, 0.8 vehicles), and rounds fired at or by aircraft used to
    // take the projectile scale while their targets took the vehicle scale —
    // at defaults a strike jet outran its own rockets and no homing missile
    // could ever close on anything. Ground fire keeps the projectile knob
    // (Robert asked for vehicle fire to respect it); the AIR duel keeps its
    // geometry at any slider setting.
    const mul = p.airScaled ? this.vehicleSpeedMul : this.projectileSpeedMul;
    if (!p.arc && mul !== 1) {
      p.vel.x *= mul;
      p.vel.z *= mul;
      if (p.ttl > 0) p.ttl /= mul; // range preserved: speed×ttl is unchanged
    }
    this.projectiles.set(p.id, p);
    return p;
  }

  // ---------- anti-air ----------

  /** A flyer with a pilot aboard counts as airborne; an empty one is parked on its pad. */
  vehicleAirborne(v: Vehicle): boolean {
    return v.alive && !!VEHICLES[v.kind].flies && v.seats[0] >= 0;
  }

  /** Nearest airborne enemy aircraft inside the launcher's IR cone. */
  samLockTarget(s: Soldier): Vehicle | Soldier | null {
    let best: Vehicle | Soldier | null = null, bestD = SAM_LOCK_RANGE;
    const consider = (pos: Vec3, cand: Vehicle | Soldier) => {
      const d = Math.hypot(pos.x - s.pos.x, pos.z - s.pos.z);
      if (d >= bestD) return;
      let da = Math.atan2(pos.z - s.pos.z, pos.x - s.pos.x) - s.yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= SAM_LOCK_CONE) { best = cand; bestD = d; }
    };
    for (const v of this.vehicles.values()) {
      if (v.team === s.team || !this.vehicleAirborne(v)) continue;
      if (!canWeaponReachElevation('manpads', asElevationLevel(v.band))) continue;
      consider(v.pos, v);
    }
    // TRUE FLIGHT (§4.4 #5): an LSW under its own power IS an aircraft —
    // the tube locks it the moment it's genuinely airborne
    for (const e of this.soldiers.values()) {
      if (!e.alive || e.team === s.team || e.ascendant === undefined) continue;
      if (!LSWS[e.ascendant].flies || e.pos.y < 2.5) continue;
      consider(e.pos, e);
    }
    return best;
  }

  /**
   * Send the bird. Speed derives from the flyer's top speed at launch —
   * SAM_SPEED_RATIO keeps it ~8% slower, so straight flight always escapes.
   */
  fireSamMissile(s: Soldier, target: Vehicle | Soldier) {
    const def = WEAPONS.sam_missile;
    const speed = VEHICLES.flyer.speed * SAM_SPEED_RATIO;
    const yaw = Math.atan2(target.pos.z - s.pos.z, target.pos.x - s.pos.x);
    const flesh = 'classId' in target; // a TRUE-FLIGHT LSW, not a hull
    const p: Projectile = {
      id: this.id(), weapon: 'sam_missile', ownerId: s.id, team: s.team,
      pos: { x: s.pos.x + Math.cos(yaw) * 0.8, y: s.pos.y + 1.6, z: s.pos.z + Math.sin(yaw) * 0.8 },
      vel: { x: Math.cos(yaw) * speed, y: 0, z: Math.sin(yaw) * speed },
      bornAt: this.time, ttl: def.range / speed, arc: false, airScaled: true, elevationWeapon: 'manpads',
      ...(flesh ? { homingSoldierId: target.id } : { homingVehicleId: target.id }),
    };
    this.launch(p);
    this.emit({ type: 'shot', pos: { ...p.pos }, weapon: 'sam_missile', soldierId: s.id });
  }

  /**
   * V3: the same lock, run from a HULL instead of a shoulder. The Lance track
   * and the base SAM turret both use this — nearest airborne enemy inside
   * range, no cone (a radar dish sees all round, unlike a man with a tube).
   */
  hullLockTarget(v: Vehicle): Vehicle | Soldier | null {
    let best: Vehicle | Soldier | null = null;
    let bestD = WEAPONS.aa_missile.range;
    const consider = (pos: Vec3, cand: Vehicle | Soldier, level: ElevationLevel = 2) => {
      const d = Math.hypot(pos.x - v.pos.x, pos.z - v.pos.z);
      const lockRange = targetLockRangeAtElevation(WEAPONS.aa_missile.range, level, this.weather.intensity);
      if (d < bestD && d < lockRange) { best = cand; bestD = d; }
    };
    for (const t of this.vehicles.values()) {
      if (t.team === v.team || !this.vehicleAirborne(t)) continue;
      consider(t.pos, t, asElevationLevel(t.band));
    }
    for (const e of this.soldiers.values()) {
      if (!e.alive || e.team === v.team || e.ascendant === undefined) continue;
      if (!LSWS[e.ascendant].flies || e.pos.y < 2.5) continue;
      consider(e.pos, e);
    }
    return best;
  }

  /** V3: send an AA bird from a hull. Same predator/prey law as the MANPADS —
   *  the missile is slower than what it hunts, so straight flight escapes and
   *  panic turns die. That ratio is the entire air game. */
  fireHullSam(v: Vehicle, target: Vehicle | Soldier, ownerId: number) {
    const def = WEAPONS.aa_missile;
    // derived, never hardcoded: it must always lose a drag race to the
    // fastest thing in the sky
    const speed = VEHICLES.interceptor.speed * SAM_SPEED_RATIO;
    const yaw = Math.atan2(target.pos.z - v.pos.z, target.pos.x - v.pos.x);
    const flesh = 'classId' in target;
    const p: Projectile = {
      id: this.id(), weapon: 'aa_missile', ownerId, team: v.team,
      pos: { x: v.pos.x + Math.cos(yaw) * 1.4, y: v.pos.y + 1.8, z: v.pos.z + Math.sin(yaw) * 1.4 },
      vel: { x: Math.cos(yaw) * speed, y: 0, z: Math.sin(yaw) * speed },
      bornAt: this.time, ttl: def.range / speed, arc: false, airScaled: true, elevationWeapon: 'lance',
      ...(flesh ? { homingSoldierId: target.id } : { homingVehicleId: target.id }),
    };
    this.launch(p);
    this.emit({ type: 'shot', pos: { ...p.pos }, weapon: 'aa_missile' });
    // EVERYONE HEARS THE LAUNCH. A missile you can't know about isn't
    // counterplay, it's a coin flip — this is what the pilot reacts to.
    this.emit({ type: 'sam_launch', pos: { ...v.pos }, soldierId: flesh ? target.id : undefined });
  }

  /**
   * Heat-seeker guidance. The missile is slightly SLOWER than its prey, so the
   * duel is pure geometry: straight flight opens the gap, any turn lets the
   * limited turn rate cut the corner. Flares seduce it off the aircraft; a
   * dead or landed target leaves it flying dumb until ttl. Returns true when
   * the missile detonated on a decoy and is spent.
   */
  private steerMissile(p: Projectile, dt: number): boolean {
    // a burning flare inside pull radius steals the lock
    if (p.homingFlareId === undefined && p.homingVehicleId !== undefined) {
      for (const g of this.gadgets.values()) {
        if (g.type !== 'flare' || g.team === p.team) continue;
        if (Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < FLARE_PULL_RADIUS) {
          p.homingFlareId = g.id;
          p.homingVehicleId = undefined;
          break;
        }
      }
    }
    let tx: number, tz: number;
    if (p.homingFlareId !== undefined) {
      const flare = this.gadgets.get(p.homingFlareId);
      if (!flare) { p.homingFlareId = undefined; return false; } // burnt out — fly dumb
      if (Math.hypot(flare.pos.x - p.pos.x, flare.pos.z - p.pos.z) < 2) {
        this.explode(flare.pos, WEAPONS.sam_missile, p.ownerId, p.team, p.elevationWeapon ?? !!p.airScaled); // eats the decoy
        return true;
      }
      tx = flare.pos.x; tz = flare.pos.z;
    } else if (p.homingVehicleId !== undefined) {
      const v = this.vehicles.get(p.homingVehicleId);
      if (!v || !this.vehicleAirborne(v)) { p.homingVehicleId = undefined; return false; } // target gone — fly dumb
      tx = v.pos.x; tz = v.pos.z;
    } else if (p.homingSoldierId !== undefined) {
      // Ragebeast's flesh hunts a SOLDIER — low, turn-rate capped: sidestep
      // hard and it overshoots. A dead or encased target frees the glob.
      // A SAM on the same seam hunts a TRUE-FLIGHT LSW: full missile turn
      // rate, chases the body's ALTITUDE — and a flier that dives below the
      // lock floor shakes it (the deck is sanctuary, and the exposure).
      const e = this.soldiers.get(p.homingSoldierId);
      if (!e || !e.alive || e.encasedUntil !== undefined) { p.homingSoldierId = undefined; return false; }
      const sam = p.weapon === 'sam_missile';
      if (sam && e.pos.y < 1.5) { p.homingSoldierId = undefined; return false; } // dove under the seeker head
      if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < (sam ? 1.6 : 1.2)) {
        this.explode({ ...e.pos }, sam ? WEAPONS.sam_missile : WEAPONS.flesh_glob, p.ownerId, p.team, p.elevationWeapon ?? !!p.airScaled);
        return true;
      }
      const speed = Math.hypot(p.vel.x, p.vel.z) || 1;
      const cur = Math.atan2(p.vel.z, p.vel.x);
      let da = Math.atan2(e.pos.z - p.pos.z, e.pos.x - p.pos.x) - cur;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const maxTurn = (sam ? SAM_TURN_RATE : 2.4) * dt; // the glob is dodgeable on foot
      const yaw = cur + Math.max(-maxTurn, Math.min(maxTurn, da));
      p.vel.x = Math.cos(yaw) * speed;
      p.vel.z = Math.sin(yaw) * speed;
      p.pos.y += ((sam ? e.pos.y + 1.0 : 1.2) - p.pos.y) * Math.min(1, 6 * dt);
      p.vel.y = 0;
      return false;
    } else {
      return false;
    }
    const speed = Math.hypot(p.vel.x, p.vel.z) || 1;
    const cur = Math.atan2(p.vel.z, p.vel.x);
    let da = Math.atan2(tz - p.pos.z, tx - p.pos.x) - cur;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const maxTurn = SAM_TURN_RATE * dt;
    const yaw = cur + Math.max(-maxTurn, Math.min(maxTurn, da));
    p.vel.x = Math.cos(yaw) * speed;
    p.vel.z = Math.sin(yaw) * speed;
    // cruise above the walls, dive under the vehicle-hit ceiling on final approach
    const wantY = Math.hypot(tx - p.pos.x, tz - p.pos.z) < 8 ? SAM_DIVE_ALT : SAM_CRUISE_ALT;
    p.pos.y += (wantY - p.pos.y) * Math.min(1, 8 * dt);
    p.vel.y = 0;
    return false;
  }

  stepSoldierPhysics(s: Soldier, dt: number) {
    if (s.vehicleId >= 0) {
      const v = this.vehicles.get(s.vehicleId);
      if (v) { s.pos.x = v.pos.x; s.pos.z = v.pos.z; s.pos.y = 0; }
      return;
    }
    // THE SECOND STOREY (§8.4 Phase-2): upstairs the ground plane is y=4,
    // movement is blocked by the grid2 layer, and stepping onto VOID is a
    // fall — gravity walks you back to the ground floor.
    if (s.floor === 1) {
      if (s.pos.y > 4 || s.vel.y > 0) {
        s.vel.y -= this.gravity * dt;
        s.pos.y = Math.max(4, s.pos.y + s.vel.y * dt);
        if (s.pos.y === 4) s.vel.y = 0;
      } else {
        s.pos.y = 4;
      }
      if (s.pushX !== 0 || s.pushZ !== 0) {
        const decay = Math.exp(-5 * dt);
        s.pushX *= decay; s.pushZ *= decay;
        if (Math.abs(s.pushX) < 0.05) s.pushX = 0;
        if (Math.abs(s.pushZ) < 0.05) s.pushZ = 0;
      }
      const nx = s.pos.x + (s.vel.x + s.pushX) * dt;
      const nz = s.pos.z + (s.vel.z + s.pushZ) * dt;
      if (!upperBlocked(this.map.grid2, nx, s.pos.z, this.map.geometry)) s.pos.x = nx;
      if (!upperBlocked(this.map.grid2, s.pos.x, nz, this.map.geometry)) s.pos.z = nz;
      s.pos.x = Math.max(-halfWidth(this.map.geometry) + 2, Math.min(halfWidth(this.map.geometry) - 2, s.pos.x));
      s.pos.z = Math.max(-halfDepth(this.map.geometry) + 2, Math.min(halfDepth(this.map.geometry) - 2, s.pos.z));
      // off the edge? nothing under your boots — down you go
      if (tileAt(this.map.grid2, s.pos.x, s.pos.z, this.map.geometry) === F2_VOID) s.floor = 0;
      return;
    }
    // REVERSE GRAVITY (Gravity Warden): while lifted you FLOAT at ~2.2u —
    // ground control is gone, the trigger still works. The drop staggers the
    // aim once, on landing.
    if (s.liftedUntil !== undefined) {
      if (this.time < s.liftedUntil) {
        s.pos.y += (2.2 - s.pos.y) * Math.min(1, 6 * dt);
        s.vel.y = 0;
        s.vel.x *= 0.15; s.vel.z *= 0.15; // legs paddle air
      } else {
        s.liftedUntil = undefined;
        s.nextFireAt = Math.max(s.nextFireAt, this.time + 0.6); // the staggered drop
      }
    }
    // TRUE FLIGHT (§4.4 #5, the last shared mechanic): the three fliers move
    // in the third dimension FOR REAL — the body climbs toward its commanded
    // altitude, and above the wall tier the grid stops owning it. Exposure is
    // the price (§ the doc's counter column): small arms live at chest
    // height, so every attack run is a descent back into range.
    const trueFlight = s.ascendant !== undefined && !!LSWS[s.ascendant].flies && s.liftedUntil === undefined;
    if (trueFlight) {
      const want = Math.max(0, s.flightAlt ?? 0);
      s.pos.y += (want - s.pos.y) * Math.min(1, 4 * dt);
      if (Math.abs(s.pos.y - want) < 0.05) s.pos.y = want;
      s.vel.y = 0;
    }
    // WRAITH LEVITATES (movement doctrine): 0.6u always, no footfalls —
    // the silence is the tell that something is wrong
    if (s.ascendant === 'wraith' && s.alive && s.liftedUntil === undefined) {
      s.pos.y += (0.6 - s.pos.y) * Math.min(1, 6 * dt);
      s.vel.y = 0;
    }
    // gravity + vertical (theme gravity: Europa jumps are glorious)
    if (!trueFlight && s.ascendant !== 'wraith' && s.liftedUntil === undefined && (s.pos.y > 0 || s.vel.y > 0)) {
      s.vel.y -= this.gravity * dt * (s.ascendant === 'gravwarden' ? 0.35 : 1); // gravity is polite to its warden
      s.pos.y = Math.max(0, s.pos.y + s.vel.y * dt);
      if (s.pos.y === 0) s.vel.y = 0;
    }
    // M1: the ragdoll expires in PHYSICS, not input handling — a body nobody
    // is steering (no cmd this tick) must still get up on time
    if (s.ragdollUntil !== undefined && this.time >= s.ragdollUntil) s.ragdollUntil = undefined;
    // M5: the recalled axe finishes its flight home and is throwable again.
    // Lives in PHYSICS for the same reason the ragdoll does — a soldier
    // nobody is steering this tick must still get his axe back.
    if (s.axeRecallAt !== undefined && this.time >= s.axeRecallAt) s.axeRecallAt = undefined;
    // knockback impulse decays fast
    if (s.pushX !== 0 || s.pushZ !== 0) {
      const decay = Math.exp(-5 * dt);
      s.pushX *= decay;
      s.pushZ *= decay;
      if (Math.abs(s.pushX) < 0.05) s.pushX = 0;
      if (Math.abs(s.pushZ) < 0.05) s.pushZ = 0;
    }
    // water drags EVERYONE the same way — players, bots, the horde: wading
    // is slow, swimming is slower (and swimming means no trigger finger)
    const tHere = tileAt(this.map.grid, s.pos.x, s.pos.z, this.map.geometry);
    // …and rubble drags at the boots the same way: a breach is a lane, not a road
    // row 246: a frozen tile is a solid crossing — no wade drag (the slick
    // skate governs the feel instead)
    let waterMult = (tHere === T_DEEP || tHere === T_WATER) && this.isFrozenWater(s.pos.x, s.pos.z) ? 1
      : tHere === T_DEEP ? 0.38 : tHere === T_WATER ? 0.55 : tHere === T_RUBBLE ? 0.6 : 1;
    // a flier over water is OVER it — nothing drags a body that isn't wading
    if (trueFlight && s.pos.y > 1.2) waterMult = 1;
    // TIME FIELDS: inside a hostile bubble, the world runs at mul — the
    // field's owner strolls through untouched
    if (this.timeFields.length) waterMult *= this.timeMulAt(s.pos.x, s.pos.z, s.id);
    const nx = s.pos.x + (s.vel.x + s.pushX) * waterMult * dt;
    const nz = s.pos.z + (s.vel.z + s.pushZ) * waterMult * dt;
    // §8.7 the jump vocabulary: every barrier is a HEIGHT, and your boots
    // are either above it or they aren't. Past ~0.9u of air a soldier clears
    // LOW COVER — a running hop (apex ~1.1) vaults sandbags and crates. A
    // CLIMB barricade (2.5u) needs a jump trooper's jet: above the lip you
    // pass, below it you bounce. Walls, metal, slits, and deep water stay
    // absolute — the WALL tier belongs to nobody on foot.
    const airborne = s.pos.y > 0.9;
    const blocksAir = (x: number, z: number) => {
      // TRUE FLIGHT: above the wall tier NOTHING on the grid blocks a flier
      if (trueFlight && s.pos.y > 4.05) return false;
      const t = tileAt(this.map.grid, x, z, this.map.geometry);
      if (t === T_CLIMB) return s.pos.y <= CLIMB_H;
      return t === T_WALL || t === T_SLIT || t === T_METAL || t === T_DEEP;
    };
    const groundBlocked = (x: number, z: number) => {
      const t = tileAt(this.map.grid, x, z, this.map.geometry);
      // PHANTOM'S PHASE-STEP (movement doctrine): his walk treats LOW COVER
      // as air — full walls still need his Q
      if (s.ascendant === 'phantom' && t === T_COVER) return false;
      if (t === T_DEEP || t === T_WATER) return false; // wade in, swim deeper
      if (isBlocked(this.map.grid, x, z, false, this.map.geometry)) return true;
      // THE ICE BLOCK IS A BLOCK (§21.6, closing Frostbite's Notes gap): an
      // encased soldier is a real 1-tile obstacle — nobody walks through a
      // frozen man, friend or foe. opt #11 (S8): read the tick-top encased list
      // (usually empty) instead of walking the whole roster.
      for (const o of this.encasedBodies) {
        if (o.id === s.id) continue;
        const dx = o.pos.x - x, dz = o.pos.z - z;
        if (dx * dx + dz * dz < 0.81) return true; // 0.9u — a tile-ish block
      }
      return false;
    };
    const blockedX = airborne ? blocksAir(nx, s.pos.z) : groundBlocked(nx, s.pos.z);
    const blockedZ = airborne ? blocksAir(s.pos.x, nz) : groundBlocked(s.pos.x, nz);
    if (!blockedX) s.pos.x = nx;
    if (!blockedZ) s.pos.z = nz;
    s.pos.x = Math.max(-halfWidth(this.map.geometry) + 2, Math.min(halfWidth(this.map.geometry) - 2, s.pos.x));
    s.pos.z = Math.max(-halfDepth(this.map.geometry) + 2, Math.min(halfDepth(this.map.geometry) - 2, s.pos.z));
    // THE UNSTICK (statue law, defense in depth): whatever put a grounded
    // body ON a blocked tile — a leap landing, a door closed on the doorway,
    // a bad old spawn — it walks itself to the nearest open tile center.
    // The integrator above only vetoes destinations, so a body deep inside
    // masonry would otherwise stand frozen forever while its squad accretes
    // around it. hover=true spares swimmers: deep water is legal physics.
    if (s.pos.y <= 0.05 && isBlocked(this.map.grid, s.pos.x, s.pos.z, true, this.map.geometry)) {
      const esc = nearestOpenTile(this.map.grid, s.pos.x, s.pos.z, 4, this.map.geometry);
      if (esc) {
        const dx = esc.x - s.pos.x, dz = esc.z - s.pos.z;
        const dl = Math.hypot(dx, dz) || 1;
        const step = Math.min(dl, 7 * dt);
        s.pos.x += (dx / dl) * step;
        s.pos.z += (dz / dl) * step;
      }
    }
  }

  /**
   * E with a field kit: mechanic kit repairs the nearest damaged friendly
   * vehicle/turret (+120, 10s cooldown); hacking kit converts an enemy sentry.
   */
  tryFieldKit(s: Soldier): boolean {
    if (this.time < s.nextRepairAt) return false;
    if (this.hasEquip(s, 'fieldRepair')) {
      for (const v of this.vehicles.values()) {
        // a full-HP but INFECTED hull is still a patient — the kit cleanses
        if (!v.alive || v.team !== s.team || (v.hp >= v.maxHp && v.infectedUntil === undefined)) continue;
        if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < VEHICLES[v.kind].radius + 2.5) {
          if (v.infectedUntil !== undefined) { v.infectedUntil = undefined; v.infectedTeam = undefined; } // the cleanse
          v.hp = Math.min(v.maxHp, v.hp + 120);
          // a field patch also braces the weakest subsystem
          let weakest: SystemId = 'engine';
          for (const id of SYSTEM_IDS) if (v.systems[id] < v.systems[weakest]) weakest = id;
          v.systems[weakest] = Math.min(VEHICLES[v.kind].systemHp ?? 60, v.systems[weakest] + 60);
          s.nextRepairAt = this.time + 10;
          this.emit({ type: 'heal', pos: v.pos });
          this.emit({ type: 'announce', text: `${s.name} patched the ${VEHICLES[v.kind].name}` });
          return true;
        }
      }
      for (const t of this.turrets.values()) {
        if (!t.alive || t.team !== s.team || t.hp >= t.maxHp) continue;
        if (Math.hypot(t.pos.x - s.pos.x, t.pos.z - s.pos.z) < 3) {
          t.hp = Math.min(t.maxHp, t.hp + 120);
          s.nextRepairAt = this.time + 10;
          this.emit({ type: 'heal', pos: t.pos });
          return true;
        }
      }
    }
    if (this.hasEquip(s, 'hackKit')) {
      for (const t of this.turrets.values()) {
        if (!t.alive || t.team === s.team) continue;
        if (Math.hypot(t.pos.x - s.pos.x, t.pos.z - s.pos.z) < 3) {
          t.team = s.team;
          t.ownerId = s.id;
          s.nextRepairAt = this.time + 10;
          s.score += 15;
          this.emit({ type: 'hacked', pos: { ...t.pos }, soldierId: s.id, text: `${s.name} hacked a sentry!` });
          return true;
        }
      }
    }
    return false;
  }

  // ---------- vehicles ----------

  /** E on a door (ahead, within arm's reach) swings it open or shut. Doors
   *  are GRID state, so the change replicates exactly like the tunneler's
   *  digs — every client's map agrees. */
  private tryDoor(s: Soldier): boolean {
    const { cols, rows, tile } = this.map.geometry;
    for (const reach of [tile * 0.6, tile * 1.3]) {
      const x = s.pos.x + Math.cos(s.yaw) * reach;
      const z = s.pos.z + Math.sin(s.yaw) * reach;
      const [tx, tz] = worldToTile(this.map.geometry, x, z);
      if (tx < 1 || tz < 1 || tx >= cols - 1 || tz >= rows - 1) continue;
      const idx = tileIndex(this.map.geometry, tx, tz);
      const t = this.map.grid[idx];
      if (t !== T_DOOR && t !== T_DOOR_OPEN) continue;
      this.toggleDoorTile(idx, s.id);
      return true;
    }
    return false;
  }

  /** Swing one door tile (open↔closed): the shared verb behind the E key
   *  and the home-door automation — one grid flip, one replication entry,
   *  one event, whoever the hand was. */
  private toggleDoorTile(idx: number, soldierId: number) {
    const t = this.map.grid[idx];
    this.map.grid[idx] = t === T_DOOR ? T_DOOR_OPEN : T_DOOR;
    if (this.doorChanges.indexOf(idx) < 0) this.doorChanges.push(idx);
    this.emit({
      type: 'door', tile: idx, soldierId,
      pos: tileToWorld(this.map.geometry, idx % this.map.geometry.cols, Math.floor(idx / this.map.geometry.cols)),
    });
  }

  /** HOME DOORS (Robert: "what if doors automatically open… if that's your
   *  base?") — door tiles standing inside a base zone serve their team: they
   *  swing open when an owner walks up and shut themselves once the doorway
   *  is clear. Enemies still knock the old ways — E, or explosives. */
  private homeDoors: { idx: number; team: Team }[] = [];
  private nextHomeDoorAt = 0;
  refreshHomeDoors() {
    this.homeDoors = [];
    const R = 42; // the base zone: today's spawn yards, tomorrow's compounds
    const { cols, rows } = this.map.geometry;
    for (let z = 1; z < rows - 1; z++) {
      for (let x = 1; x < cols - 1; x++) {
        const idx = tileIndex(this.map.geometry, x, z);
        const t = this.map.grid[idx];
        if (t !== T_DOOR && t !== T_DOOR_OPEN) continue;
        const { x: wx, z: wz } = tileToWorld(this.map.geometry, x, z);
        for (const team of [0, 1] as const) {
          const b = this.map.basePos[team];
          if (Math.hypot(b.x - wx, b.z - wz) <= R) { this.homeDoors.push({ idx, team }); break; }
        }
      }
    }
  }
  private stepHomeDoors() {
    if (this.time < this.nextHomeDoorAt || this.homeDoors.length === 0) return;
    this.nextHomeDoorAt = this.time + 0.15;
    for (const d of this.homeDoors) {
      const t = this.map.grid[d.idx];
      if (t !== T_DOOR && t !== T_DOOR_OPEN) continue; // breached away — the hole stays a hole
      const { x, z } = tileToWorld(this.map.geometry, d.idx % this.map.geometry.cols, Math.floor(d.idx / this.map.geometry.cols));
      let ownerNear = false, anyoneInDoorway = false;
      for (const s of this.soldiers.values()) {
        if (!s.alive || s.floor !== 0 || (s.kind !== 'human' && s.kind !== 'bot')) continue;
        const dd = Math.hypot(s.pos.x - x, s.pos.z - z);
        if (dd < 1.6) anyoneInDoorway = true; // never slam a door through a body
        // hysteresis: opens at a stride, lets go a stride and a half later
        if (s.team === d.team && dd < (t === T_DOOR ? 2.6 : 3.9)) ownerNear = true;
      }
      if (t === T_DOOR && ownerNear) this.toggleDoorTile(d.idx, -1);
      else if (t === T_DOOR_OPEN && !ownerNear && !anyoneInDoorway) this.toggleDoorTile(d.idx, -1);
    }
  }

  /** door tiles whose state ever changed — replicated so puppets stay true */
  doorChanges: number[] = [];

  /** E on a ladder foot (or the well above it) climbs between storeys. The
   *  activation key again — same verb as doors and vehicles. */
  private tryLadder(s: Soldier): boolean {
    const { cols, rows, tile } = this.map.geometry;
    for (const reach of [0, tile * 0.6]) {
      const x = s.pos.x + Math.cos(s.yaw) * reach;
      const z = s.pos.z + Math.sin(s.yaw) * reach;
      const [tx, tz] = worldToTile(this.map.geometry, x, z);
      if (tx < 1 || tz < 1 || tx >= cols - 1 || tz >= rows - 1) continue;
      const idx = tileIndex(this.map.geometry, tx, tz);
      const center = tileToWorld(this.map.geometry, tx, tz);
      if (s.floor === 0 && this.map.grid[idx] === T_LADDER && this.map.grid2[idx] === F2_WELL) {
        s.floor = 1;
        s.pos.x = center.x;
        s.pos.z = center.z;
        s.pos.y = 4;
        s.vel.y = 0;
        this.emit({ type: 'ladder', pos: { ...s.pos }, soldierId: s.id });
        return true;
      }
      if (s.floor === 1 && this.map.grid2[idx] === F2_WELL) {
        s.floor = 0;
        s.pos.x = center.x;
        s.pos.z = center.z;
        s.pos.y = 0;
        s.vel.y = 0;
        this.emit({ type: 'ladder', pos: { ...s.pos }, soldierId: s.id });
        return true;
      }
    }
    return false;
  }

  // ---------- §4.3 down-not-out: drag & field revive ----------

  /**
   * E next to a downed teammate. One key, two verbs: MOVING drags the body
   * with you (haul them behind cover first), STANDING STILL channels a field
   * revive — 3 seconds of kneeling in the open, slower and riskier than a
   * medic's beam, which is exactly why medics matter.
   */
  tryDownedAid(s: Soldier, cmd: PlayerCmd, dt: number): boolean {
    if (s.kind !== 'human' && s.kind !== 'bot') return false;
    let best: Soldier | null = null;
    let bestD = AID_RANGE;
    for (const a of this.soldiers.values()) {
      if (!a.alive || !a.downed || a.team !== s.team || a.id === s.id) continue;
      const d = Math.hypot(a.pos.x - s.pos.x, a.pos.z - s.pos.z);
      if (d < bestD) { best = a; bestD = d; }
    }
    if (!best) return false;
    if (Math.hypot(cmd.moveX, cmd.moveZ) > 0.1) {
      s.draggingId = best.id; // stepDrag hauls the body after our own physics
    } else {
      best.reviveProgress += dt;
      if (best.reviveProgress >= REVIVE_CHANNEL) this.reviveSoldier(best, s);
    }
    return true;
  }

  /** Haul the grabbed body along — it trails just behind the dragger's heels. */
  stepDrag(s: Soldier) {
    const body = this.soldiers.get(s.draggingId);
    if (!body || !body.alive || !body.downed) { s.draggingId = -1; return; }
    const sp = Math.hypot(s.vel.x, s.vel.z);
    if (sp < 0.1) return; // grip held, but nobody's going anywhere
    const tx = s.pos.x - (s.vel.x / sp) * DRAG_OFFSET;
    const tz = s.pos.z - (s.vel.z / sp) * DRAG_OFFSET;
    if (!isBlocked(this.map.grid, tx, tz, false, this.map.geometry)) {
      body.pos.x = tx;
      body.pos.z = tz;
    }
    body.vel.x = 0; // the body is cargo, not a walker
    body.vel.z = 0;
  }

  /** §4.3: lethal damage puts a trooper on the ground with a bleed pool and a clock. */
  downSoldier(victim: Soldier, attackerId: number) {
    victim.downed = true;
    victim.hp = DOWNED_HP;
    victim.downedUntil = this.time + BLEEDOUT_TIME;
    victim.downedBy = attackerId;
    victim.reviveProgress = 0;
    victim.vel.x = 0;
    victim.vel.z = 0;
    const attacker = this.soldiers.get(attackerId);
    this.emit({
      type: 'downed', pos: { ...victim.pos }, soldierId: victim.id,
      victimName: victim.name,
      killerName: attacker && attacker.id !== victim.id ? attacker.name : undefined,
      killerTeam: attacker?.team,
    });
  }

  /** Back on their feet at partial hp — grateful, not fresh. */
  reviveSoldier(victim: Soldier, reviver?: Soldier) {
    if (!victim.alive || !victim.downed) return;
    victim.downed = false;
    victim.downedUntil = 0;
    victim.downedBy = -1;
    victim.reviveProgress = 0;
    victim.hp = Math.max(1, Math.round(victim.maxHp * REVIVE_HP));
    if (reviver && reviver.id !== victim.id) reviver.score += 5;
    this.emit({
      type: 'revived', pos: { ...victim.pos }, soldierId: victim.id,
      victimName: victim.name, killerName: reviver?.name,
      text: reviver ? `${reviver.name} revived ${victim.name}` : undefined,
    });
  }

  tryEnterVehicle(s: Soldier) {
    // A GOD WALKS (Robert, on Firebrand: "He shouldn't be able to get in
    // vehicles"). A 1600 HP strongpoint riding a jeep is neither threat nor
    // silhouette — it's a turret with wheels, and every counterplay the
    // threat table promises assumes you can SEE the god coming. Same shape as
    // the flier law at ascendSoldier: refuse at the door, bots included.
    if (s.ascendant) return;
    for (const v of this.vehicles.values()) {
      if (!v.alive || v.team !== s.team) continue;
      const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
      if (d < VEHICLES[v.kind].radius + 2.2) {
        // W5.6 SEAT-YIELD: a FULL hull makes room for a HUMAN — the rear-most
        // bot steps out; the wheel yields last ("move over, I'm driving").
        if (s.kind === 'human' && v.seats.indexOf(-1) < 0) {
          for (let i = v.seats.length - 1; i >= 0; i--) {
            const rider = this.soldiers.get(v.seats[i]);
            if (rider && rider.kind === 'bot') {
              this.exitVehicle(rider, v);
              this.emit({ type: 'announce', text: `${VEHICLES[v.kind].name}: seat yielded` });
              break;
            }
          }
        }
        // W5.6 PER-HATCH ENTRY (diegetic): a human's seat follows the hatch
        // they walked to — the NOSE takes the wheel, the TAIL takes a bench
        // (the wheel only from the back if it's the last seat there is).
        // Bots keep the classic first-free pick: a convoy needs drivers.
        let seat = v.seats.indexOf(-1);
        if (s.kind === 'human' && seat >= 0) {
          const free: number[] = [];
          for (let i = 0; i < v.seats.length; i++) if (v.seats[i] < 0) free.push(i);
          const fwd = Math.cos(v.yaw) * (s.pos.x - v.pos.x) + Math.sin(v.yaw) * (s.pos.z - v.pos.z);
          seat = fwd >= 0 ? free[0] : (free.find((i) => i > 0) ?? free[0]);
        }
        if (seat >= 0) {
          v.seats[seat] = s.id;
          // first hand on the wheel signs the manifest; any crewing resets the
          // abandonment clocks — a hull with a live crew is nobody's salvage
          if (v.requisitionedBy < 0) v.requisitionedBy = s.id;
          v.abandonedAt = 0;
          v.hotwireProgress = 0;
          s.vehicleId = v.id;
          s.seat = seat;
          s.enteredVehicleAt = this.time;
          s.cloaked = false;
          // a pilot taking the stick starts the rotor spool — no liftoff until it's done
          const lift = VEHICLES[v.kind].liftoffTime;
          if (seat === 0 && lift) {
            v.landed = false;
            v.spoolUntil = this.time + lift;
            this.emit({ type: 'announce', text: `${VEHICLES[v.kind].name}: rotors spooling…` });
          }
          if (s.carryingFlag >= 0) return; // flag carriers may ride — mode handles flag pos
          this.emit({ type: 'vehicle_enter', pos: v.pos, soldierId: s.id, vehicleId: v.id });
          return;
        }
      }
    }
  }

  exitVehicle(s: Soldier, v: Vehicle) {
    const airborne = !!VEHICLES[v.kind].flies && (v.band ?? 0) > 0;
    v.seats[s.seat] = -1;
    // last one out starts the abandonment clock — hotwire and write-off run on it
    if (!v.seats.some((id) => id >= 0)) v.abandonedAt = this.time;
    recordVehicleEvent(this.vehicleTelemetry, {
      kind: airborne ? 'bailout' : 'abandon', t: this.time, vehicleId: v.id, vehicleKind: v.kind,
      theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
      x: v.pos.x, z: v.pos.z, detail: s.name,
    });
    s.vehicleId = -1;
    s.seat = -1;
    const side = v.yaw + Math.PI / 2;
    const ex = v.pos.x + Math.cos(side) * (VEHICLES[v.kind].radius + 1.5);
    const ez = v.pos.z + Math.sin(side) * (VEHICLES[v.kind].radius + 1.5);
    s.pos = isBlocked(this.map.grid, ex, ez, false, this.map.geometry) ? { ...v.pos } : { x: ex, y: 0, z: ez };
    this.emit({ type: 'vehicle_exit', pos: s.pos, soldierId: s.id, vehicleId: v.id });
  }

  /** Which soldier mans a named crew station right now (seat order: driver, then def.crew). */
  crewAt(v: Vehicle, station: 'gunner' | 'sensors' | 'ecm' | 'comms'): Soldier | undefined {
    const crew = VEHICLES[v.kind].crew;
    if (!crew) return undefined;
    const i = crew.indexOf(station);
    if (i < 0) return undefined;
    const sid = v.seats[1 + i];
    return sid >= 0 ? this.soldiers.get(sid) : undefined;
  }

  /**
   * §8.1a requisition law, run each tick on every live, crewless hull:
   * RECOVERY — parked back at its home pad, the pool re-registers it (manifest cleared).
   * WRITE-OFF — 3 minutes abandoned AND far from home, command strikes it from the
   * books and frees the pad to issue a fresh hull after the normal delay.
   * HOTWIRE — an enemy soldier standing still beside a 90s-abandoned hull with E held
   * steals it: team flips, hull damage rides along, everyone hears about it.
   */
  private stepRequisition(v: Vehicle, cmds: Map<number, PlayerCmd>, dt: number) {
    if (v.seats.some((id) => id >= 0)) return; // a crewed hull is nobody's salvage
    const def = VEHICLES[v.kind];
    const homeDist = Math.hypot(v.pos.x - v.padPos.x, v.pos.z - v.padPos.z);

    // RECOVERED: a friendly hull sitting home with no crew goes back on the books
    if (v.requisitionedBy >= 0 && v.team === v.padTeam && homeDist < RECOVER_RADIUS) {
      v.requisitionedBy = -1;
      v.abandonedAt = 0;
      v.hotwireProgress = 0;
      return;
    }

    const abandonedFor = v.abandonedAt > 0 ? this.time - v.abandonedAt : 0;

    // THE WRITE-OFF: nobody gets to drown the team's only tank and lock the pool
    if (abandonedFor >= WRITEOFF_TIME && homeDist > WRITEOFF_RANGE) {
      v.alive = false;
      v.hp = 0;
      v.respawnAt = this.time + VEHICLE_RESPAWN;
      this.emit({ type: 'announce', pos: { ...v.pos }, text: `Command wrote off the ${def.name}` });
      return;
    }

    // HOTWIRE: a loud six-second job — three if you know the wiring. Bots don't (v1).
    if (abandonedFor < HOTWIRE_ABANDON) return;
    let thief: Soldier | undefined;
    for (const s of this.soldiers.values()) {
      if (!s.alive || s.team === v.team || s.kind !== 'human' || s.vehicleId >= 0) continue;
      const c = cmds.get(s.id);
      if (!c?.use || c.moveX !== 0 || c.moveZ !== 0) continue; // stand still, hold E
      if (Math.hypot(s.pos.x - v.pos.x, s.pos.z - v.pos.z) > def.radius + 2.5) continue;
      if (!thief || (s.classId === 'engineer' && thief.classId !== 'engineer')) thief = s;
    }
    if (!thief) {
      v.hotwireProgress = 0; // walked away mid-job — the wiring snaps back
      return;
    }
    v.hotwireProgress += dt;
    const need = thief.classId === 'engineer' ? HOTWIRE_TIME / 2 : HOTWIRE_TIME;
    if (v.hotwireProgress >= need) {
      v.team = thief.team;          // the hull flies the thief's colors — damage and all
      v.requisitionedBy = thief.id; // their name on the stolen manifest
      v.abandonedAt = 0;
      v.hotwireProgress = 0;
      thief.score += 25;
      this.emit({
        type: 'announce', pos: { ...v.pos }, soldierId: thief.id,
        text: `${thief.name} hotwired a ${def.name}!`,
      });
    }
  }

  stepVehicle(v: Vehicle, cmds: Map<number, PlayerCmd>, dt: number) {
    if (!v.alive) {
      if (this.operation) return; // an Operation has a finite manifest; wrecks do not print back in
      if (this.time >= v.respawnAt && !this.mode.over) {
        // co-op support vehicles respawn too; battle vehicles only outside co-op
        const support = v.kind === 'ambulance' || v.kind === 'emplacement';
        if (isCoopMode(this.opts.mode) && !support) return;
        const def = VEHICLES[v.kind];
        v.alive = true; v.hp = def.hp; v.maxHp = def.hp;
        // fresh issue: a clean manifest, and stolen hulls come home under the pad's flag
        v.team = v.padTeam;
        v.requisitionedBy = -1; v.abandonedAt = 0; v.hotwireProgress = 0;
        v.pos = { ...v.padPos }; v.vel = { x: 0, y: 0, z: 0 };
        v.yaw = v.team === 0 ? 0 : Math.PI;
        v.seats.fill(-1);
        v.systems = this.freshSystems(v.kind);
        v.burrowed = false; // wrecks come back surfaced
        v.submerged = false;
        v.flares = FLARES_PER_LIFE;
      }
      return;
    }
    this.stepRequisition(v, cmds, dt);
    if (!v.alive) return; // the write-off can strike a hull mid-step
    const def = VEHICLES[v.kind];
    const driverId = v.seats[0];
    const driver = driverId >= 0 ? this.soldiers.get(driverId) : undefined;
    let throttle = 0, turn = 0, fire = false;
    const stunned = this.time < v.stunnedUntil;
    const driverCmd = driver && driver.alive
      ? (cmds.get(driver.id) ?? (driver.kind === 'bot' ? stepBot(this, driver, dt) : undefined))
      : undefined;
    // W5.5 THE HANDBRAKE: SPACE on a slip-equipped ground hull breaks rear
    // grip — the tail steps out (lateral bleed slows 3×), the nose whips
    // (turn ×1.6), the engine drags (×0.5). Human drivers only: a bot yanking
    // it would look like a malfunction, not a maneuver.
    const handbrake = !!driverCmd?.jump && !!def.slip && !def.flies && driver?.kind === 'human';
    if (driverCmd && !stunned) {
      throttle = -driverCmd.moveZ; // W = forward
      turn = driverCmd.moveX;
      fire = driverCmd.fire;
      v.turretYaw = driverCmd.aimYaw;
      // J1: an AIRBORNE pilot's E key is the dive, not the door — applyCmd
      // walks the bands; this exit only fires once the wheels are down.
      // (Two exit paths existed; ungated, this one threw the pilot out on the
      // same tick the band branch caught his dive.)
      if (driverCmd.use && driver && this.time - driver.enteredVehicleAt > 0.3
          && !(VEHICLES[v.kind].flies && (v.band ?? 0) > 0)) this.exitVehicle(driver, v);
    }
    this.vehicleCommandedSpeed.set(v.id, driverCmd && !stunned ? Math.abs(driverCmd.moveZ) * def.speed : 0);

    // a manned gunner station overrides the driver's trigger (transport)
    const gunner = this.crewAt(v, 'gunner');
    if (gunner?.alive && !stunned) {
      const gCmd = cmds.get(gunner.id);
      if (gCmd) {
        fire = gCmd.fire;
        v.turretYaw = gCmd.aimYaw;
        if (gCmd.use && this.time - gunner.enteredVehicleAt > 0.3) this.exitVehicle(gunner, v);
      } else if (gunner.kind === 'bot') {
        // bot gunners track the nearest visible enemy
        const tgt = this.nearestEnemyInRange(v.pos, v.team, WEAPONS[def.weapon]?.range ?? 40);
        if (tgt) { v.turretYaw = Math.atan2(tgt.pos.z - v.pos.z, tgt.pos.x - v.pos.x); fire = true; }
      }
    }

    // passengers may bail with E (any seat beyond driver/gunner)
    for (let i = 1; i < v.seats.length; i++) {
      const sid = v.seats[i];
      if (sid < 0 || sid === gunner?.id) continue;
      const s = this.soldiers.get(sid);
      const c = s ? cmds.get(sid) : undefined;
      if (s && c?.use && this.time - s.enteredVehicleAt > 0.3) this.exitVehicle(s, v);
    }

    // ---- movement (emplacements never move; spooling flyers sit tight) ----
    const spooling = !!def.liftoffTime && this.time < v.spoolUntil;
    // opt #10 (S6): a truly PARKED, crewless hull — no seat filled, at rest,
    // grounded (band 0, not burrowed), not a healer — would run the entire
    // drivetrain (surface+weather mults, yaw trig, accel/slip integration, the
    // 8-probe clear check) only to produce zero net motion. Skip it; zero the
    // vel once. Verified carve-out (audit S6): a heal pulse needs no crew, so
    // healRadius hulls keep the full path; the passenger-bail above already ran;
    // possession/infection expiry below still run. Byte-identical over 3,600 ticks.
    const parked = (v.band ?? 0) === 0 && !v.burrowed && !def.healRadius
      && Math.abs(v.vel.x) < 0.01 && Math.abs(v.vel.z) < 0.01
      && !v.seats.some((sid) => sid >= 0);
    if (parked) { v.vel.x = 0; v.vel.z = 0; }
    if (!parked && !def.immobile && !spooling) {
      // dead engine limps at 35% throttle response
      const engineMult = v.systems.engine > 0 ? 1 : 0.35;
      // a deep breacher shoves through packed earth — half pace
      const depthMult = def.digs && v.burrowed ? 0.5 : def.submersible && v.submerged ? 0.72 : 1;
      // §8.6: the ground has a say — hover ignores it, legs read it like boots,
      // tracks shrug at what swallows wheels
      const surf = surfaceAt(this.map.surface, v.pos.x, v.pos.z, this.map.geometry);
      const tracked = v.kind === 'tank' || v.kind === 'apc' || v.kind === 'tunneler';
      const surfMult = (def.hover || def.flies ? 1
        : def.strider ? (SURF_SOLDIER[surf] ?? 1)
        : tracked ? (SURF_TRACKS[surf] ?? 1)
        : (SURF_WHEELS[surf] ?? 1))
        // §8.8 weather drags the drivetrain — dust chokes wheels, snow buries them
        * (def.hover || def.flies ? 1
          : moveMult(this.weather, def.strider ? 'soldier' : tracked ? 'tracks' : 'wheels'));
      v.yaw += turn * def.turnRate * (handbrake ? 1.6 : 1) * dt * (throttle < 0 ? -1 : 1);
      // V2 FIXED WING: a jet has a stall floor. Whatever the stick says, it
      // never flies slower than minAirspeed × top — and it can never reverse.
      // Let go and you keep going: attack runs become PASSES, and the pilot
      // who over-commits eats the terrain he was strafing.
      //
      // …but only with A PILOT ABOARD, past his spool. The first cut applied
      // the floor unconditionally, so every UNCREWED jet in the game taxied
      // itself off its pad at stall speed forever — parked aircraft creeping
      // across the map until a wall caught them. (Robert: "planes have to
      // start off grounded." They did start grounded; they just didn't STAY.)
      const flown = v.seats[0] >= 0 && this.time >= v.spoolUntil;
      const stall = flown ? def.minAirspeed ?? 0 : 0;
      // J1 band lifecycle: taking the sky opens at the airframe's home band
      // (jets 3, rotors 2); an empty aircraft is parked, band 0.
      if (def.flies) {
        if (flown && (v.band ?? 0) === 0 && !v.landed) v.band = def.minAirspeed ? 3 : 2;
        if (v.seats[0] < 0) { v.band = 0; v.landed = true; }
      }
      // J1 THE AFTERBURNER (Robert): hold sprint and the pilot's own tank
      // feeds the engine — 1.4x thrust while energy lasts, refilling when the
      // burner is cold. The pilot's ENERGY becomes burner fuel in the HUD.
      let burner = 1;
      v.burnerOn = false;
      const pilot = this.soldiers.get(v.seats[0]);
      if (def.minAirspeed && flown && pilot) {
        const pcmd = cmds.get(pilot.id);
        if (pcmd?.sprint && pilot.energy > 5) {
          pilot.energy = Math.max(0, pilot.energy - 16 * dt);
          burner = 1.4;
          v.burnerOn = true;
        } else {
          // a seated pilot's tank refills here — the soldier regen loop
          // returns early for vehicle occupants and never reaches them
          pilot.energy = Math.min(100, pilot.energy + 9 * dt);
        }
      }
      const wing = stall > 0 ? Math.max(stall, Math.max(0, throttle)) : throttle;
      const targetSpeed = wing * def.speed * engineMult * depthMult * surfMult * this.vehicleSpeedMul * burner
        * (wing < 0 ? 0.5 : 1) * (handbrake ? 0.5 : 1); // W5.5: the brake drags
      const accel = 18;
      const curSpeed = Math.cos(v.yaw) * v.vel.x + Math.sin(v.yaw) * v.vel.z;
      const newSpeed = curSpeed + Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - curSpeed));
      const fwdX = Math.cos(v.yaw), fwdZ = Math.sin(v.yaw);
      if (def.slip) {
        // THE DRIFT (see VehicleDef.slip). Split the velocity on the nose
        // axis: the FORWARD part obeys the engine exactly like rails do —
        // full throttle authority, nothing mushy — while the LATERAL part
        // (what rails simply delete) BLEEDS at the slip rate instead. Turn
        // hard at speed and yesterday's forward becomes today's sideways,
        // sliding off over ~1/slip seconds. A first cut lagged the WHOLE
        // velocity toward the nose, which read as drift in a unit test and
        // as a dead engine on the stick — 4% throttle authority.
        const latX = v.vel.x - fwdX * curSpeed;
        const latZ = v.vel.z - fwdZ * curSpeed;
        // W5.5: the handbrake breaks rear grip — sideways survives 3× longer
        const keep = Math.exp(-(handbrake ? def.slip * 0.3 : def.slip) * dt); // frame-rate honest
        v.vel.x = fwdX * newSpeed + latX * keep;
        v.vel.z = fwdZ * newSpeed + latZ * keep;
      } else {
        v.vel.x = fwdX * newSpeed;
        v.vel.z = fwdZ * newSpeed;
      }

      const nx = v.pos.x + v.vel.x * dt;
      const nz = v.pos.z + v.vel.z * dt;
      // boats are flat-bottomed: a shallow DRAFT (smaller collision probe)
      // lets the hull hug banks and moor beside causeways without pinning
      const r = def.boat ? def.radius * 0.55 : def.radius;
      // §8.8: a real storm grounds flyers — unless the ship is currently OVER
      // structure, in which case it may keep soaring until it finds clear
      // ground (never trap a hull inside a wall it legally flew onto)
      const stormGrounded = def.flies && airGrounded(this.weather) &&
        !isBlocked(this.map.grid, v.pos.x, v.pos.z, true, this.map.geometry);
      if ((def.flies && !stormGrounded) || (def.digs && v.burrowed)) {
        // W5.1 THE SKYLINE IS REAL: at band 1 (low flight, ~2u) a hull can
        // meet a BUILDING — walls, slits, doorframes, metal. Speed-scaled
        // hull damage and a hard rebuff, one scrape per half-second. Band
        // 2+ soars the sanctuary above the roofline (BAND_ALT clears the
        // 8.15 rooftops); the deck (band 0) keeps its legacy taxi pass.
        // Cover crates and climb barricades sit UNDER the low-flight deck.
        if (def.flies && collidesAtElevation(asElevationLevel(v.band), 1) && (v.band ?? 0) > 0 && this.buildingAt(nx, nz)) {
          const spd = Math.hypot(v.vel.x, v.vel.z);
          if (spd > 4 && this.time >= (v.nextCrashAt ?? 0)) {
            v.nextCrashAt = this.time + 0.5;
            this.damageVehicle(v, 12 + spd * 2.2, -1, 'crash');
            recordVehicleEvent(this.vehicleTelemetry, {
              kind: 'crash', t: this.time, vehicleId: v.id, vehicleKind: v.kind,
              theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
              x: nx, z: nz, detail: `${spd.toFixed(1)}u/s`,
            });
            this.emit({ type: 'explosion', pos: { x: nx, y: 2, z: nz }, weapon: 'gl' });
          }
          v.vel.x *= -0.25; // the wall wins — the hull rebuffs
          v.vel.z *= -0.25;
        } else {
          // flyers soar over everything else; a deep breacher passes UNDER
          // it all — walls, cover, even water. Only the map border stops it.
          v.pos.x = nx;
          v.pos.z = nz;
        }
      } else {
        // tunneler grinds the wall ahead into rubble instead of stopping
        if (def.digs && Math.abs(throttle) > 0.1 && this.time >= v.nextDigAt) {
          const aheadX = v.pos.x + Math.cos(v.yaw) * (r + TILE * 0.6) * Math.sign(throttle);
          const aheadZ = v.pos.z + Math.sin(v.yaw) * (r + TILE * 0.6) * Math.sign(throttle);
          const t = tileAt(this.map.grid, aheadX, aheadZ, this.map.geometry);
          const dmat = materialOf(t);
          if (dmat.drill > 0) {
            // grind time scales by 1/drill: masonry ~0.35s, metal ~0.82s, the
            // safe-room door ~0.98s (the toughest). Metal (impact 'spark') throws
            // a spark shower at the drill face the whole time it grinds.
            v.nextDigAt = this.time + DRILL_BASE / dmat.drill;
            if (dmat.impact === 'spark') this.emit({ type: 'sparks', pos: { x: aheadX, y: 1.2, z: aheadZ } });
            const [digX, digZ] = worldToTile(this.map.geometry, aheadX, aheadZ);
            this.digTile(digX, digZ);
          }
        }
        const hover = !!def.hover;
        // striders (mech) step OVER low cover — only walls and water stop legs
        const blockedAt = def.boat
          // boats live ON the water: every land tile is their wall
          ? (x: number, z: number) => {
              const t = tileAt(this.map.grid, x, z, this.map.geometry);
              return def.submersible && v.submerged ? t !== T_DEEP : t !== T_WATER && t !== T_DEEP;
            }
          : def.strider
            // legs step over HOP-tier cover, but the CLIMB and WALL tiers
            // (§8.7) are taller than a mech's stride — barricades, walls,
            // metal, and slits all say no
            ? (x: number, z: number) => { const t = tileAt(this.map.grid, x, z, this.map.geometry); return t === T_WALL || t === T_METAL || t === T_SLIT || t === T_CLIMB || t === T_DEEP; }
            : (x: number, z: number) => isBlocked(this.map.grid, x, z, hover, this.map.geometry);
        const clearAt = (x: number, z: number) =>
          !blockedAt(x + r, z) && !blockedAt(x - r, z) &&
          !blockedAt(x, z + r) && !blockedAt(x, z - r);
        if (clearAt(nx, v.pos.z)) v.pos.x = nx; else v.vel.x = 0;
        if (clearAt(v.pos.x, nz)) v.pos.z = nz; else v.vel.z = 0;
      }
      // W5.2 WRAPAROUND FOR THE AIR WAR: an AIRBORNE flyer that crosses the
      // border comes out the far side — attack runs re-enter instead of
      // grinding the fence (the deck and every ground hull keep the clamp;
      // taxiing off the map is not a maneuver). Seam distances don't wrap:
      // a SAM reads the long way round, which is the price of the trick.
      if (def.flies && (v.band ?? 0) > 0) {
        const beforeX = v.pos.x, beforeZ = v.pos.z;
        const wrapped = wrapWorld(this.map.geometry, v.pos, 1);
        v.pos.x = wrapped.x;
        v.pos.z = wrapped.z;
        if (beforeX !== wrapped.x || beforeZ !== wrapped.z) recordVehicleEvent(this.vehicleTelemetry, {
          kind: 'boundary_wrap', t: this.time, vehicleId: v.id, vehicleKind: v.kind,
          theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
          x: wrapped.x, z: wrapped.z,
        });
      } else {
        const clamped = clampWorld(this.map.geometry, v.pos, 3);
        v.pos.x = clamped.x;
        v.pos.z = clamped.z;
      }
    } else {
      v.vel.x = 0; v.vel.z = 0;
      if (driverCmd) v.turretYaw = driverCmd.aimYaw;
    }

    // ---- run over enemies (ground vehicles at speed) ----
    const speedNow = Math.hypot(v.vel.x, v.vel.z);
    if (speedNow > 6 && driver && !def.flies) {
      for (const s of this.soldiers.values()) {
        if (!s.alive || s.team === v.team || s.vehicleId >= 0 || s.pos.y > 1.5) continue;
        if (Math.hypot(s.pos.x - v.pos.x, s.pos.z - v.pos.z) < def.radius + 0.7) {
          this.damageSoldier(s, 60 * dt * speedNow * 0.4 + 25, driverId, 'tank_cannon');
        }
      }
    }

    // ---- ambulance: heal pulse to nearby friendlies and passengers ----
    if (def.healRadius && this.time >= v.nextHealAt && !stunned) {
      v.nextHealAt = this.time + 1;
      for (const s of this.soldiers.values()) {
        // downed soldiers need a revive, not a top-up — the pulse skips them
        if (!s.alive || s.downed || s.team !== v.team || s.hp >= s.maxHp) continue;
        const aboard = s.vehicleId === v.id;
        if (aboard || Math.hypot(s.pos.x - v.pos.x, s.pos.z - v.pos.z) < def.healRadius) {
          s.hp = Math.min(s.maxHp, s.hp + (def.healRate ?? 8) * (aboard ? 1.6 : 1));
          if (this.tick % 2 === 0) this.emit({ type: 'heal', pos: s.pos, soldierId: s.id });
        }
      }
    }

    // ---- crewed sensor station: rolling radar pings ----
    const sensorOp = this.crewAt(v, 'sensors');
    if (sensorOp?.alive && v.systems.sensors > 0 && !stunned) {
      for (const s of this.soldiers.values()) {
        if (!s.alive || s.team === v.team) continue;
        if (Math.hypot(s.pos.x - v.pos.x, s.pos.z - v.pos.z) < 28) this.pinged.add(s.id);
      }
    }

    // ---- fire mounted weapon (needs a live weapon system and a gun) ----
    const shooter = gunner?.alive ? gunner : driver;
    if (fire && shooter && def.weapon && v.systems.weapon > 0 && this.time >= v.nextFireAt && !stunned) {
      const wdef = WEAPONS[def.weapon];
      v.nextFireAt = this.time + 1 / wdef.rof;
      shooter.protectedUntil = 0; // hostile action (55B)
      const spread = (this.rng.next() - 0.5) * 2 * wdef.spread;
      const yaw = v.turretYaw + spread;
      const muzzle = def.radius + 0.8;
      const p: Projectile = {
        id: this.id(), weapon: def.weapon, ownerId: shooter.id, team: v.team,
        pos: { x: v.pos.x + Math.cos(yaw) * muzzle, y: 1.8, z: v.pos.z + Math.sin(yaw) * muzzle },
        vel: { x: Math.cos(yaw) * wdef.speed, y: 0, z: Math.sin(yaw) * wdef.speed },
        bornAt: this.time, ttl: wdef.range / wdef.speed, arc: false,
        // an aircraft's rounds live in ITS speed frame — see launch()
        airScaled: !!def.flies,
        ...(def.flies ? { elevationWeapon: 'aircraft' as const } : {}),
      };
      this.launch(p);
      recordVehicleEvent(this.vehicleTelemetry, {
        kind: 'shot', t: this.time, vehicleId: v.id, vehicleKind: v.kind,
        theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
        x: v.pos.x, z: v.pos.z, detail: def.weapon,
      });
      this.emit({ type: 'shot', pos: { ...p.pos }, weapon: def.weapon, soldierId: shooter.id });
    }
  }

  private nearestEnemyInRange(pos: Vec3, team: Team, range: number): Soldier | null {
    let best: Soldier | null = null, bestD = range;
    for (const s of this.soldiers.values()) {
      if (!s.alive || s.team === team || s.vehicleId >= 0 || (s.cloaked && !this.pinged.has(s.id))) continue;
      const d = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z);
      if (d < bestD && losClear(this.map.grid, { ...pos, y: 1.6 }, { ...s.pos, y: 1.2 }, 1.4, this.map.geometry)) { best = s; bestD = d; }
    }
    return best;
  }

  // ---------- turrets ----------

  stepTurret(t: Turret, _dt: number) {
    if (!t.alive) return;
    const def = WEAPONS.turret_mg;
    let best: Soldier | null = null;
    let bestD = def.range;
    for (const s of this.soldiers.values()) {
      if (!s.alive || s.team === t.team || (s.cloaked && s.kind !== 'zombie')) continue;
      const d = Math.hypot(s.pos.x - t.pos.x, s.pos.z - t.pos.z);
      if (d < bestD && losClear(this.map.grid, t.pos, s.pos, 1.4, this.map.geometry)) { best = s; bestD = d; }
    }
    if (best) {
      t.yaw = Math.atan2(best.pos.z - t.pos.z, best.pos.x - t.pos.x);
      if (this.time >= t.nextFireAt) {
        t.nextFireAt = this.time + 1 / def.rof;
        const spread = (this.rng.next() - 0.5) * 2 * def.spread;
        const yaw = t.yaw + spread;
        const p: Projectile = {
          id: this.id(), weapon: 'turret_mg', ownerId: t.ownerId, team: t.team,
          pos: { x: t.pos.x + Math.cos(yaw) * 0.9, y: 1.5, z: t.pos.z + Math.sin(yaw) * 0.9 },
          vel: { x: Math.cos(yaw) * def.speed, y: 0, z: Math.sin(yaw) * def.speed },
          bornAt: this.time, ttl: def.range / def.speed, arc: false,
        };
        this.launch(p);
        this.emit({ type: 'shot', pos: { ...p.pos }, weapon: 'turret_mg', soldierId: t.ownerId });
      }
    }
  }

  // ---------- projectiles ----------

  /** STICKY GRENADE (Robert: "no bounce, stick to what they hit"): the charge
   *  ADHERES to the first thing it touches and detonates on a ~1.3s fuse from
   *  right there — a body or hull it RIDES (a stuck man carries it into his
   *  squad), a wall or the ground it CLINGS to. Returns true if it handled the
   *  projectile this tick (stuck/riding/burst); false = keep flying. `px/py/pz`
   *  is the pre-move position, used to back a wall-hit off to just outside. */
  private stepSticky(id: number, p: Projectile, px: number, py: number, pz: number): boolean {
    const FUSE = 1.3;
    const burst = () => { this.detonatePayload(p); this.projectiles.delete(id); };
    // ── already stuck: ride/cling and count the fuse ──
    if (p.stuckTo !== undefined) {
      const host = this.soldiers.get(p.stuckTo);
      if (!host || !host.alive || this.time >= (p.stuckAt ?? 0) + FUSE) { burst(); return true; }
      p.pos = { x: host.pos.x, y: 1.2, z: host.pos.z }; p.vel = { x: 0, y: 0, z: 0 }; // ride the body
      return true;
    }
    if (p.stuckVehicle !== undefined) {
      const v = this.vehicles.get(p.stuckVehicle);
      if (!v || !v.alive || this.time >= (p.stuckAt ?? 0) + FUSE) { burst(); return true; }
      p.pos = { x: v.pos.x, y: 1.0, z: v.pos.z }; p.vel = { x: 0, y: 0, z: 0 }; // ride the hull
      return true;
    }
    if (p.stuckPos) {
      p.pos = { ...p.stuckPos }; p.vel = { x: 0, y: 0, z: 0 }; // clinging to a wall / the ground
      if (this.time >= (p.stuckAt ?? 0) + FUSE) { burst(); return true; }
      return true;
    }
    // ── not stuck yet: what did it just touch? ──
    // 1. a BODY at (roughly) body height — the plasma stick
    for (const e of this.soldiers.values()) {
      if (!e.alive || e.team === p.team || e.vehicleId >= 0) continue;
      if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 1.4 && Math.abs((e.pos.y ?? 0) - p.pos.y) < 2.2) {
        p.stuckTo = e.id; p.stuckAt = this.time; p.vel = { x: 0, y: 0, z: 0 };
        this.emit({ type: 'plasma_stick', pos: { ...p.pos }, soldierId: e.id });
        return true;
      }
    }
    // 2. a VEHICLE hull
    for (const v of this.vehicles.values()) {
      if (!v.alive || v.team === p.team) continue;
      if (Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) < VEHICLES[v.kind].radius + 0.6 && Math.abs(v.pos.y - p.pos.y) < 3) {
        p.stuckVehicle = v.id; p.stuckAt = this.time; p.vel = { x: 0, y: 0, z: 0 };
        this.emit({ type: 'plasma_stick', pos: { ...p.pos } });
        return true;
      }
    }
    // 3. a WALL (it flew INTO a blocked tile below the wall tier) — back off to
    //    just outside and cling to the face
    if (p.pos.y < 4.05 && isBlocked(this.map.grid, p.pos.x, p.pos.z)) {
      p.stuckPos = { x: px, y: Math.max(0.3, py), z: pz };
      p.stuckAt = this.time; p.vel = { x: 0, y: 0, z: 0 };
      this.emit({ type: 'plasma_stick', pos: { ...p.stuckPos } });
      return true;
    }
    // 4. the GROUND — cling where it lands, no bounce, no roll
    if (p.pos.y <= 0.16 && p.vel.y <= 0) {
      p.stuckPos = { x: p.pos.x, y: 0.16, z: p.pos.z };
      p.stuckAt = this.time; p.vel = { x: 0, y: 0, z: 0 };
      this.emit({ type: 'plasma_stick', pos: { ...p.stuckPos } });
      return true;
    }
    return false; // still in the air, touched nothing — fly on
  }

  private detonatePayload(p: Projectile): boolean {
    // generated arsenal payloads (smoke / phosphorus launchers)
    const payload = WEAPONS[p.weapon]?.payload;
    if (payload === 'plasma') {
      // THE PLASMA BURST: an energy splash off the stuck charge (bites armor via
      // the plasma tracer), and it leaves a brief burning patch — the stick that
      // keeps on giving. Uses the carrier's own numbers (M3 lesson).
      this.explode(p.pos, WEAPONS[p.weapon]?.splash ? WEAPONS[p.weapon] : WEAPONS.plasma_nade, p.ownerId, p.team, p.airScaled);
      this.spawnGadget('fire_field', p.team, p.ownerId, { x: p.pos.x, y: 0, z: p.pos.z }, Infinity, 4);
      return true;
    }
    if (payload === 'smoke') {
      this.spawnGadget('smoke_field', p.team, p.ownerId, p.pos, Infinity, 12);
      this.emit({ type: 'beacon_planted', pos: { ...p.pos }, text: 'Smoke deployed' });
      return true;
    }
    if (payload === 'fire') {
      this.spawnGadget('fire_field', p.team, p.ownerId, p.pos, Infinity, 10);
      this.emit({ type: 'explosion', pos: { ...p.pos }, weapon: 'flamer' });
      return true;
    }
    if (payload === 'concussion') {
      // THE RATTLE: the blast (heavy knockback, almost no bite) via the shared
      // explode() — so the blue rings + two-zone falloff come free — then a
      // STAGGER pass: ears ring (a fire-lock), and bots lose their target for
      // a beat. It shoves and disorients; it does not kill.
      // the CARRIER owns the blast: the hand C-9 keeps its own numbers, and
      // the CL-40's max-knockback round brings its own (hardcoding conc_nade
      // here would cap every concussion weapon at the hand grenade's shove)
      const def = WEAPONS[p.weapon]?.splash ? WEAPONS[p.weapon] : WEAPONS.conc_nade;
      this.explode(p.pos, def, p.ownerId, p.team, p.elevationWeapon ?? !!p.airScaled);
      for (const s of this.soldiers.values()) {
        if (!s.alive || s.vehicleId >= 0 || s.team === p.team) continue;
        if (this.time < s.protectedUntil) continue;
        if (Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) >= def.splash) continue;
        s.nextFireAt = Math.max(s.nextFireAt, this.time + 1.4); // ringing ears — no trigger
        if (s.kind === 'bot') s.blindUntil = Math.max(s.blindUntil ?? 0, this.time + 1.6); // disoriented
      }
      return true;
    }
    if (payload === 'grav') {
      // THE SINGULARITY: a gravity WELL opens where it lands — a strong INWARD
      // pull (negative radial) that drags the enemy squad off their feet and
      // into a cluster for ~1.2s — then the well COLLAPSES on the pile (the
      // implosion, scheduled through pendingBlasts). The pull does no damage of
      // its own; it sets the kill up (a teammate's frag cashes it, or the
      // implosion does). The owner's team is exempt (forceField team-gates).
      this.forceFields.push({ x: p.pos.x, z: p.pos.z, r: 6.5, radial: -16, team: p.team, ownerId: p.ownerId, until: this.time + 1.2 });
      this.pendingBlasts.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, at: this.time + 1.2, weapon: 'grav_nade', ownerId: p.ownerId, team: p.team });
      this.emit({ type: 'grav_well', pos: { ...p.pos }, soldierId: p.ownerId });
      return true;
    }
    switch (p.weapon) {
      case 'emp':
        this.empBlast(p.pos, p.team, p.ownerId);
        return true;
      case 'target_beacon':
        this.spawnGadget('target_beacon', p.team, p.ownerId, p.pos, 60, 15);
        this.emit({ type: 'beacon_planted', pos: { ...p.pos }, text: 'Targeting beacon active' });
        return true;
      case 'orbital_beacon': {
        this.spawnGadget('orbital', p.team, p.ownerId, p.pos, 60);
        this.emit({ type: 'beacon_planted', pos: { ...p.pos }, text: 'ORBITAL STRIKE INBOUND', big: true });
        return true;
      }
      default:
        return false;
    }
  }

  stepProjectiles(dt: number) {
    // Magnetar's halo pulls straight BULLETS out of the air (precomputed once)
    const magnetars = [...this.soldiers.values()].filter((m) => m.alive && m.ascendant === 'magnetar');
    for (const [id, p] of this.projectiles) {
      const def = WEAPONS[p.weapon];
      // heat-seekers steer before they move; true = spent on a flare
      if ((p.homingVehicleId !== undefined || p.homingFlareId !== undefined || p.homingSoldierId !== undefined) && this.steerMissile(p, dt)) {
        this.projectiles.delete(id);
        continue;
      }
      // TIME FIELDS: a round inside a bubble crawls — its whole advance
      // (including gravity) integrates at mul, and its fuse clock stretches
      // to match (bornAt slides forward), so a slowed grenade doesn't cheat
      // its timer and a crawling bullet doesn't die short of its range.
      let tdt = dt;
      if (this.timeFields.length) {
        const tm = this.timeMulAt(p.pos.x, p.pos.z);
        if (tm < 1) { tdt = dt * tm; p.bornAt += dt * (1 - tm); }
      }
      const px = p.pos.x, py = p.pos.y, pz = p.pos.z; // pre-move, to back off a wall
      if (p.arc) p.vel.y -= this.gravity * 0.7 * tdt;
      p.pos.x += p.vel.x * tdt;
      p.pos.y += p.vel.y * tdt;
      p.pos.z += p.vel.z * tdt;

      // STICKY (Robert: "no bounce, stick to what they hit"): the charge adheres
      // to the first thing it touches — a body, a hull, a wall, the ground — and
      // detonates on its fuse from right there. Runs BEFORE the bounce/wall/hit
      // logic below, so a sticky round never bounces or rolls.
      if (def.sticky && this.stepSticky(id, p, px, py, pz)) continue;

      // BOOMERANG: fly out for half the ttl, then whip back toward the owner and
      // clear the struck list so it can hit again on the return leg (flip once)
      if (def.boomerang) {
        if (p.returnAt === undefined) p.returnAt = p.bornAt + p.ttl / 2;
        else if (this.time >= p.returnAt) {
          const o = this.soldiers.get(p.ownerId);
          const spd = Math.hypot(p.vel.x, p.vel.z) || 30;
          if (o) {
            const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, dl = Math.hypot(dx, dz) || 1;
            p.vel.x = (dx / dl) * spd; p.vel.z = (dz / dl) * spd;
          } else { p.vel.x = -p.vel.x; p.vel.z = -p.vel.z; }
          p.hit = []; p.returnAt = Infinity;
        }
      }

      // GROUND BOUNCE (Robert: "I don't like that it doesn't bounce… kind of
      // timed, bounce off walls and stuff"): a bouncing arc round that meets
      // the floor KICKS back up, loses most of its pace, then settles and
      // ROLLS out its fuse — it never explodes just because it arrived, and
      // it never sinks under the map. The ttl (landing time + grace) is the
      // fuse; where the grenade lies when it runs out is where it goes off.
      if (p.arc && p.bounce && p.pos.y <= 0.14 && p.vel.y < 0) {
        p.pos.y = 0.14;
        const hSpeed = Math.hypot(p.vel.x, p.vel.z);
        if (-p.vel.y > 2.6) {
          // the kick — and the ground reads the ARRIVAL ANGLE: a steep
          // mortar drop pops satisfyingly back up; a flat rope skims in
          // shallow and the grass GRABS it (else it skips like a stone and
          // the boom lands nowhere near the cursor's promise)
          const steep = -p.vel.y > hSpeed * 0.6;
          p.vel.y = -p.vel.y * 0.34;
          const keep = steep ? 0.4 : 0.2;
          p.vel.x *= keep; p.vel.z *= keep;
          this.emit({ type: 'nade_bounce', pos: { ...p.pos }, weapon: p.weapon });
        } else {
          // the LAST tick of the ting-ting-ting: the hop is spent and the can
          // settles into its roll. Once — this branch runs every frame after.
          if (!p.tinked) { p.tinked = true; this.emit({ type: 'nade_bounce', pos: { ...p.pos }, weapon: p.weapon }); }
          p.vel.y = 0;                                     // settled — now it rolls
          p.vel.x *= 0.88; p.vel.z *= 0.88;
          if (hSpeed < 0.4) { p.vel.x = 0; p.vel.z = 0; }
        }
      }

      let dead = false;

      // MAGNETAR'S HALO: a straight enemy BULLET that reaches his field curves
      // into a debris orbit and is absorbed — and it FEEDS him a sip of HP
      // ("ranged fire builds his armor"). Energy, arcs, and melee pass clean.
      // MEASURED (threat rig): a total eat + a fat feed made him IMMORTAL to
      // his designated answer, so the dials moved: the feed is +0.5/bullet,
      // and the ORBIT SATURATES — roughly one round in three slips the debris
      // ring (re-widened when the two-zone blast model shifted the meta and
      // he tipped back over the band), so massed sustained fire still gets
      // through (§1.5: threat buys HP, never immunity).
      if (!def.arc && def.tracer === 'bullet' && magnetars.length) {
        for (const m of magnetars) {
          if (m.team === p.team) continue;
          if (Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z) < 4) {
            if (this.rng.next() < 0.68) {
              m.hp = Math.min(m.maxHp, m.hp + 0.5);
              this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon });
              dead = true;
            }
            break; // a leaked round flies on — the orbit was full this instant
          }
        }
        if (dead) { this.projectiles.delete(id); continue; }
      }

      // enemy shield domes swallow projectiles; FPV drones can be shot down
      if (!def.heals) {
        for (const [gid, g] of this.gadgets) {
          // Vanguard's barricade blocks BOTH sides — everyone else's gadgets
          // only care about ENEMY rounds
          if (g.team === p.team && !(g.type === 'shield' && g.bothSides)) continue;
          // skitters are shootable: killing one with gunfire is a clean
          // defusal — it pops with no blast (the reward for good aim)
          if (g.type === 'skitter') {
            if (p.pos.y < 2.2 && Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 0.9) {
              g.hp -= def.damage;
              this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, soldierId: p.ownerId });
              if (g.hp <= 0) {
                this.gadgets.delete(gid);
                this.emit({ type: 'gadget_destroyed', pos: g.pos });
              }
              dead = true;
              break;
            }
            continue;
          }
          if (g.type === 'drone' && g.piloted && !g.crashing) {
            if (Math.abs(p.pos.y - g.pos.y) < 1.6 && Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 1.2) {
              g.hp -= def.damage;
              this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, soldierId: p.ownerId });
              if (g.hp <= 0) this.crashDrone(g); // winged — it tumbles, no puff
              dead = true;
              break;
            }
            continue;
          }
          if (g.type !== 'shield') continue;
          if (p.pos.y < 4.5 && Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 4) {
            // Barrier's reflect wall: its first 2s throws APPROACHING fire back
            // at whoever sent it (grenade-bank reversal + a re-team). After the
            // window it swallows like any dome.
            if (g.reflect && this.time < g.bornAt + 2) {
              const tox = g.pos.x - p.pos.x, toz = g.pos.z - p.pos.z;
              if (p.vel.x * tox + p.vel.z * toz > 0) {
                p.vel.x = -p.vel.x; p.vel.z = -p.vel.z;
                p.team = g.team; p.ownerId = g.ownerId; p.bornAt = this.time;
                this.emit({ type: 'nade_bounce', pos: { ...p.pos } });
              }
              continue; // reflected or passing — never swallowed
            }
            g.hp -= def.damage + def.splashDamage * 0.5;
            this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, ownerId: p.ownerId });
            if (g.hp <= 0) {
              this.gadgets.delete(gid);
              this.emit({ type: 'gadget_destroyed', pos: g.pos });
              this.emit({ type: 'explosion', pos: { ...g.pos }, weapon: 'gl' });
            }
            dead = true;
            break;
          }
        }
        if (dead) { this.projectiles.delete(id); continue; }
      }

      // grenades BANK (Robert): a wall reflects the blocked axis instead of
      // detonating the round — the fuse keeps burning and the floor is still
      // the floor. Bank shots around corners are now a skill.
      if (p.bounce && !dead && p.pos.y > 0.05) {
        const py = Math.max(p.pos.y, 0);
        if (blocksShot(this.map.grid, p.pos.x, p.pos.z, py, this.map.geometry) ||
            blocksShotUpper(this.map.grid2, p.pos.x, p.pos.z, p.pos.y, this.map.geometry)) {
          const ox = p.pos.x - p.vel.x * dt, oz = p.pos.z - p.vel.z * dt;
          const blockX = blocksShot(this.map.grid, p.pos.x, oz, py, this.map.geometry) || blocksShotUpper(this.map.grid2, p.pos.x, oz, p.pos.y, this.map.geometry);
          const blockZ = blocksShot(this.map.grid, ox, p.pos.z, py, this.map.geometry) || blocksShotUpper(this.map.grid2, ox, p.pos.z, p.pos.y, this.map.geometry);
          // reflect whichever axis ran into the wall; a clean corner clip
          // (neither axis alone blocked) sends it straight back
          if (blockX || !blockZ) { p.vel.x = -p.vel.x * 0.45; p.pos.x = ox; }
          if (blockZ || !blockX) { p.vel.z = -p.vel.z * 0.45; p.pos.z = oz; }
          p.vel.y *= 0.85; // the wall eats a little hop too
          this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, ownerId: p.ownerId });
        }
      }

      // hit terrain (either storey's walls)
      if (p.pos.y <= 0 || blocksShot(this.map.grid, p.pos.x, p.pos.z, Math.max(p.pos.y, 0), this.map.geometry) ||
          blocksShotUpper(this.map.grid2, p.pos.x, p.pos.z, p.pos.y, this.map.geometry)) {
        // SURFACE REACTION (materials): a wall hit resolves ricochet → penetrate
        // → impact. A ground hit (y<=0) always impacts. splash/payload rounds
        // (rockets, GLs) always impact — they detonate on any surface.
        const py = Math.max(p.pos.y, 0);
        const wall = p.pos.y > 0 && blocksShot(this.map.grid, p.pos.x, p.pos.z, py, this.map.geometry);
        const mat = wall ? materialOf(tileAt(this.map.grid, p.pos.x, p.pos.z, this.map.geometry)) : null;
        const ox = p.pos.x - p.vel.x * dt, oz = p.pos.z - p.vel.z * dt;
        const blockX = wall && blocksShot(this.map.grid, p.pos.x, oz, py, this.map.geometry);
        const blockZ = wall && blocksShot(this.map.grid, ox, p.pos.z, py, this.map.geometry);
        const plain = def.splash <= 0 && !def.heals; // ricochet/pierce are for plain rounds
        if (mat && plain && (p.ricochet ?? 0) > 0 && mat.ricochet > 0 && blockX !== blockZ && this.rng.next() < mat.ricochet) {
          // 1. RICOCHET — bank off the blocked axis, bleed 30% dmg, keep flying
          if (blockX) { p.vel.x = -p.vel.x; p.pos.x = ox; } else { p.vel.z = -p.vel.z; p.pos.z = oz; }
          p.ricochet!--; p.dmgMul = (p.dmgMul ?? 1) * 0.7;
          this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, ownerId: p.ownerId });
        } else if (mat && plain && (p.pierce ?? 0) > 0 && mat.penetrable) {
          // 2. PENETRATE thin cover (wood/sandbag/grass/rubble) — chip it, bleed
          // 15% dmg, and step a full tile past so we don't re-hit the same tile
          // (no marker carries `pierce` today, but a training round must never
          // chip a wall no matter which branch it arrives on)
          if (!def.training) this.damageSurface(p.pos.x, p.pos.z, def.damage * (p.dmgMul ?? 1), def.damage >= 100, p.ownerId);
          p.pierce!--; p.dmgMul = (p.dmgMul ?? 1) * 0.85;
          const vl = Math.hypot(p.vel.x, p.vel.z) || 1;
          p.pos.x += (p.vel.x / vl) * (TILE + 0.5); p.pos.z += (p.vel.z / vl) * (TILE + 0.5);
        } else {
          // 3. IGNITE (proj.ignite & mat.flammable) wires here when the fire system lands.
          // 4. IMPACT — detonate/splash, else the round dies and DAMAGES the wall
          // per its material (soft cover shreds, masonry/metal shrug small arms —
          // the heavyOnly gate lives in damageWall). Ground hits (no mat) just splat.
          if (this.detonatePayload(p)) { /* payload delivered */ }
          else if (def.splash > 0) this.explode(p.pos, def, p.ownerId, p.team, p.elevationWeapon ?? !!p.airScaled);
          else {
            // a TRAINING round marks the wall and stops there — paint has no
            // business breaching masonry (see WeaponDef.training)
            if (mat && !def.training) this.damageSurface(p.pos.x, p.pos.z, def.damage * (p.dmgMul ?? 1), def.damage >= 100, p.ownerId);
            if (def.tracer !== 'beam') this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, ownerId: p.ownerId });
          }
          dead = true;
        }
      }

      // hit soldiers — opt #38 (S2): a heal beam touches its OWN side, a round
      // its enemies; only bodies within the 0.9u hit radius can connect, and
      // the id-sorted per-team query keeps first-hit order identical
      if (!dead) {
        const targetTeam = (def.heals ? p.team : 1 - p.team) as Team;
        for (const s of this.soldierIndex.near(targetTeam, p.pos.x, p.pos.z, 1.2, PROJ_SCRATCH)) {
          if (!s.alive || s.vehicleId >= 0) continue;
          if (s.id === p.ownerId) continue;
          if (p.hit?.includes(s.id)) continue; // pierce: never double-hit a body this flight
          const dy = (s.pos.y + 1.2) - p.pos.y;
          if (Math.abs(dy) > 1.8) continue;
          if (Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) < 0.9) {
            if (this.detonatePayload(p)) { dead = true; break; }
            if (def.knockback > 0 && !this.hasEquip(s, 'noKnockback')) {
              const kl = Math.hypot(p.vel.x, p.vel.z) || 1;
              s.pushX += (p.vel.x / kl) * def.knockback;
              s.pushZ += (p.vel.z / kl) * def.knockback;
              if (s.pos.y < 0.2) s.vel.y = Math.max(s.vel.y, def.knockback * 0.35);
            } else if (def.brand === 'titan' && !this.hasEquip(s, 'noKnockback')) {
              // row 178: titan CONCUSSIVE — a light HORIZONTAL nudge where the
              // def carries no knockback (no vertical pop: that's for the real
              // heavy weapons). Every titan hit is a small argument.
              const kl = Math.hypot(p.vel.x, p.vel.z) || 1;
              s.pushX += (p.vel.x / kl) * 2.2;
              s.pushZ += (p.vel.z / kl) * 2.2;
            }
            if (def.heals) {
              if (s.downed) {
                // §4.3: the medi-beam lifts the fallen — one touch and they're
                // up at partial hp. Lesser heals pass over a body; they can't
                // fix "down", only a medic (or three seconds of E) can.
                if (p.weapon === 'medibeam') {
                  this.reviveSoldier(s, this.soldiers.get(p.ownerId));
                  dead = true;
                  break;
                }
                continue;
              }
              // a heal beam also treats the strain (§3.1) — so a full-health
              // but EXPOSED ally is still worth beaming
              const treatable = (s.viralLoad ?? 0) > 0;
              if (s.hp < s.maxHp || treatable) {
                const healed = Math.min(s.maxHp - s.hp, def.damage);
                s.hp += healed;
                if (s.viralLoad) s.viralLoad = Math.max(0, s.viralLoad - def.damage * 0.6);
                const healer = this.soldiers.get(p.ownerId);
                if (healer) {
                  healer.score += 2;
                  healer.healGiven += healed; // trophy ledger
                }
                this.emit({ type: 'heal', pos: s.pos, soldierId: s.id });
              } else continue; // beam passes through clean, full-health allies
            } else if (def.splash > 0) {
              this.explode(p.pos, def, p.ownerId, p.team, p.elevationWeapon ?? !!p.airScaled);
            } else {
              // read the plate BEFORE the round resolves — damageSoldier eats
              // the armor, so asking afterward always says "bare"
              const bare = s.armor <= 0;
              // Ragebeast's rounds hit harder as he bleeds (rampage)
              const shooter = this.soldiers.get(p.ownerId);
              // INCENDIARY ammo (OUTBREAK-SPEC §11): fire is the horde's answer —
              // a burning round mauls the undead (×1.6) even as it does less to
              // the living. Denial over stopping-power, by design.
              const incMul = p.incendiary && isZed(s.kind) ? 1.6 : 1;
              // EXPANDING (§11): mushrooms in bare flesh (×1.5 vs an unarmored
              // living target) but crumples on plate or dead tissue (×0.65 vs
              // armor or any ZedKind). The anti-personnel round, made literal.
              const expMul = p.ammo === 'exp'
                ? (s.armor > 0 || isZed(s.kind) ? 0.65 : (s.kind === 'human' || s.kind === 'bot') ? 1.5 : 1)
                : 1;
              // W1.4: a bullet tires with distance flown (energy weapons exempt).
              // Distance ≈ flight time × muzzle speed — no per-round origin to store.
              const traveled = (this.time - p.bornAt) * Math.hypot(p.vel.x, p.vel.z);
              // row 178: harkov MATCH-GRADE rounds CARRY — no ballistic falloff
              const fall = def.brand === 'harkov' ? 1 : ballisticFalloff(def.tracer, def.range, traveled);
              const dmg = def.damage * (shooter?.rageMul ?? 1) * (p.dmgMul ?? 1) * incMul * expMul * fall;
              this.damageSoldier(s, dmg, p.ownerId, p.weapon, false, p.pierceArmor);
              // CORPSE DENIAL (OUTBREAK-SPEC §6.1/§6.2/§11): fire and chemistry
              // deny the body where they land — including the one just dropped
              // this frame. But fire is METERED, not instant (§6.1): incendiary
              // fills a burn meter over sustained exposure (~2 hits), while the
              // dedicated chemical round (BNR, §6.2) denies outright. Complete
              // destruction by a blast stays instant at the explode() site.
              if ((p.incendiary || p.ammo === 'bnr') && this.outbreakEnabled && this.corpses.length) {
                for (const c of this.corpses) {
                  if (c.neutralized || Math.hypot(c.pos.x - s.pos.x, c.pos.z - s.pos.z) > 2.5) continue;
                  if (p.ammo === 'bnr') {
                    c.neutralized = true; // dedicated chemistry — the specialist tool
                  } else {
                    c.burn = (c.burn ?? 0) + INC_BURN_PER_HIT; // §6.1 the burn meter
                    if (c.burn >= 1) c.neutralized = true;
                  }
                }
              }
              // TRACER (§11): the round MARKS what it hits — pinned on every
              // enemy screen for a few seconds, at the cost of a loud signature.
              if (p.ammo === 'trc' && s.team !== p.team) {
                this.tagged.set(s.id, this.time + 4);
                this.emit({ type: 'psi_ping', pos: { ...s.pos }, soldierId: p.ownerId });
              }
              this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, soldierId: p.ownerId, bare });
              // CHAIN: the round arcs to the nearest un-struck enemies (60% dmg each)
              if (def.chain) {
                let arcs = def.chain;
                for (const e of this.soldiers.values()) {
                  if (arcs <= 0) break;
                  if (!e.alive || e.team === p.team || e.id === s.id || p.hit?.includes(e.id)) continue;
                  if (Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) > 8) continue;
                  (p.hit ??= []).push(e.id);
                  this.damageSoldier(e, dmg * 0.6, p.ownerId, p.weapon, false, p.pierceArmor);
                  this.emit({ type: 'hit', pos: { ...e.pos }, weapon: p.weapon, soldierId: p.ownerId });
                  arcs--;
                }
              }
              // TETHER: yank the struck victim toward the owner (reuses knockback)
              if (def.tether) {
                const o = this.soldiers.get(p.ownerId);
                if (o) {
                  const dx = o.pos.x - s.pos.x, dz = o.pos.z - s.pos.z, dl = Math.hypot(dx, dz) || 1;
                  s.pushX += (dx / dl) * 14; s.pushZ += (dz / dl) * 14;
                }
              }
            }
            // the RG-2 tag dart: sting like a bee, then GLOW — pinned on
            // every enemy screen until the dart burns out (stealth suit wins).
            // (the per-team query already guarantees non-heal hits are enemies)
            if (def.tagsTarget && s.team !== p.team) {
              this.tagged.set(s.id, this.time + 5);
              this.emit({ type: 'psi_ping', pos: { ...s.pos }, soldierId: p.ownerId });
            }
            // pierce: a plain bullet round (never heals/splash — those always
            // resolve here) with charges left threads on through the body
            // instead of dying; record the hit so it can't strike this same
            // soldier twice in one flight.
            (p.hit ??= []).push(s.id);
            if (!def.heals && !(def.splash > 0) && (p.pierce ?? 0) > 0) {
              p.pierce!--;
              p.dmgMul = (p.dmgMul ?? 1) * 0.9; // each body bleeds a little energy
              continue; // do NOT set dead — the round threads on to the next body
            }
            dead = true;
            break;
          }
        }
      }

      // hit vehicles
      if (!dead) {
        for (const v of this.vehicles.values()) {
          if (!v.alive) continue;
          const r = VEHICLES[v.kind].radius;
          // THE SANCTUARY LAW (VERTICAL-WAR, B2 — Robert: "I want to be away
          // from the projectiles… that's the root problem with flight").
          // Altitude is finally REAL: surface and band-1 traffic stay fair
          // game for everything (the old y<3 rule), but bands 2-3 can only be
          // touched by AIR-SCALED ordnance — SAMs, MANPADS, and guns fired
          // from aircraft. A ground rifle can no longer clip a high bomber.
          const vBand = asElevationLevel(v.band);
          const weaponClass: ElevationWeaponClass = p.elevationWeapon ?? (p.airScaled ? 'aircraft' : 'ground');
          const inReach = canWeaponReachElevation(weaponClass, vBand) && (vBand > 1 || p.pos.y < 3)
            && (!v.submerged || def.torpedo === true);
          if (Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) < r + 0.3 && inReach) {
            if (def.heals && v.team === p.team) {
              if (v.hp < v.maxHp && p.weapon === 'repair') {
                v.hp = Math.min(v.maxHp, v.hp + def.damage);
                this.emit({ type: 'heal', pos: v.pos });
                dead = true;
              }
              break;
            }
            if (v.team === p.team) break; // no friendly vehicle damage
            if (def.splash > 0) this.explode(p.pos, def, p.ownerId, p.team, p.elevationWeapon ?? !!p.airScaled);
            else {
              this.damageVehicle(v, def.damage, p.ownerId, p.weapon);
              const attacker = this.soldiers.get(p.ownerId);
              const attackerHull = attacker?.vehicleId !== undefined && attacker.vehicleId >= 0 ? this.vehicles.get(attacker.vehicleId) : undefined;
              if (attackerHull) recordVehicleEvent(this.vehicleTelemetry, {
                kind: 'hit', t: this.time, vehicleId: attackerHull.id, vehicleKind: attackerHull.kind,
                theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
                x: v.pos.x, z: v.pos.z, detail: v.kind,
              });
              this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, soldierId: p.ownerId });
            }
            dead = true;
            break;
          }
        }
      }

      // hit turrets
      if (!dead && !def.heals) {
        for (const t of this.turrets.values()) {
          if (!t.alive || t.team === p.team) continue;
          if (Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 1.2 && p.pos.y < 2.4) {
            if (def.splash > 0) this.explode(p.pos, def, p.ownerId, p.team, p.elevationWeapon ?? !!p.airScaled);
            else this.damageTurret(t, def.damage);
            dead = true;
            break;
          }
        }
      } else if (!dead && p.weapon === 'repair') {
        for (const t of this.turrets.values()) {
          if (!t.alive || t.team !== p.team || t.hp >= t.maxHp) continue;
          if (Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 1.2) {
            t.hp = Math.min(t.maxHp, t.hp + def.damage);
            this.emit({ type: 'heal', pos: t.pos });
            dead = true;
            break;
          }
        }
      }

      // hit destructible gadgets (drones, beacons)
      if (!dead && !def.heals) {
        for (const [gid, g] of this.gadgets) {
          if (g.team === p.team || g.type === 'shield' || g.type === 'supply_pod' || !Number.isFinite(g.hp)) continue;
          const gy = g.type === 'drone' ? g.pos.y : 0.8;
          if (Math.abs(p.pos.y - gy) > 1.4) continue;
          if (Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 1.2) {
            g.hp -= def.damage;
            this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, soldierId: p.ownerId });
            if (g.hp <= 0) {
              this.gadgets.delete(gid);
              this.emit({ type: 'gadget_destroyed', pos: g.pos });
              this.emit({ type: 'explosion', pos: { ...g.pos }, weapon: 'gl' });
            }
            dead = true;
            break;
          }
        }
      }

      if (dead || this.time - p.bornAt > p.ttl) {
        if (!dead && this.detonatePayload(p)) { /* payload delivered at end of arc */ }
        else if (!dead && def.splash > 0 && p.arc) this.explode(p.pos, def, p.ownerId, p.team, p.elevationWeapon ?? !!p.airScaled); // grenades detonate on timeout
        // CLUSTER: burst into k bouncing submunitions (~40% dmg) on death
        if (def.cluster && !p.submunition) {
          for (let k = 0; k < def.cluster; k++) {
            const a = (k / def.cluster) * Math.PI * 2 + (p.id % 7) * 0.3;
            this.launch({
              id: this.id(), weapon: p.weapon, ownerId: p.ownerId, team: p.team,
              pos: { x: p.pos.x, y: Math.max(0.5, p.pos.y), z: p.pos.z },
              vel: { x: Math.cos(a) * 22, y: 3.5, z: Math.sin(a) * 22 },
              bornAt: this.time, ttl: 0.6, arc: false, bounce: true, submunition: true,
              dmgMul: (p.dmgMul ?? 1) * 0.4,
            } as Projectile);
          }
        }
        // GAS-AFTER: leave a lingering cloud (reuses the field-gadget plumbing)
        if (def.gasAfter) {
          const caustic = def.gasAfter.kind === 'caustic' || def.gasAfter.kind === 'poison';
          this.spawnGadget(caustic ? 'fire_field' : 'smoke_field', p.team, p.ownerId,
            { x: p.pos.x, y: 0, z: p.pos.z }, Infinity, def.gasAfter.life);
        }
        // M5 THE AXE BURIES ITSELF wherever the flight ended — a body, a wall,
        // or the end of its reach. THIS is the mechanic: the axe is somewhere
        // now, and going to get it (or yanking it home through a crowd) is
        // the decision the weapon exists to create.
        if (p.weapon === 'axe') {
          const owner = this.soldiers.get(p.ownerId);
          if (owner && owner.axeId === -1) {
            const g = this.spawnGadget('axe', p.team, p.ownerId, { x: p.pos.x, y: 0, z: p.pos.z }, 40);
            owner.axeId = g.id;
            this.emit({ type: 'axe_stick', pos: { x: p.pos.x, y: 0, z: p.pos.z }, soldierId: p.ownerId });
          }
        }
        this.projectiles.delete(id);
      }
    }
  }

  /** THE OUTBREAK (OUTBREAK-SPEC §4/§6): the living incubate, the dead rise.
   *  INCUBATION — an exposed soldier's Viral Load creeps up on its own
   *  (§4 infectionRate); cross 100 and they TURN where they stand (the horror
   *  the spec wants: your own body, your own side, coming for you). Treatment
   *  (medkit/medibeam, handled at the heal sites) walks it back down. */
  stepOutbreak(dt: number) {
    // the living: incubate, and mark who crosses the line (collect first —
    // converting mutates the soldier map, so never do it mid-iteration)
    let turners: Soldier[] | null = null;
    for (const s of this.soldiers.values()) {
      if (!s.alive || (s.kind !== 'human' && s.kind !== 'bot')) continue;
      const vl = s.viralLoad ?? 0;
      if (vl <= 0) continue;
      const next = vl + INFECTION_CREEP * dt; // resistance not modeled yet — flat creep
      if (next >= 100) (turners ??= []).push(s);
      else s.viralLoad = next;
    }
    if (turners) {
      for (const s of turners) {
        // TURNING → the body is lost to the strain and rises here, now: your
        // own side, coming for you (spec §4). Zero the strain so the death
        // path books no second corpse; the zombie IS the reanimation.
        const name = s.name;
        const kind = riseKind(s.classId); // §7: the body decides the form
        s.viralLoad = 0;
        this.damageSoldier(s, 99999, -1, 'ar606'); // overkill: no downed crawl
        const open = nearestOpenTile(this.map.grid, s.pos.x, s.pos.z, 4, this.map.geometry) ?? s.pos;
        const z = this.addZombie(kind, { x: open.x, y: 0, z: open.z });
        z.name = `${name} (turned)`;
        this.emit({ type: 'reanimated', pos: { ...z.pos }, soldierId: z.id });
        this.emit({ type: 'announce', text: `${name.toUpperCase()} HAS TURNED`, big: true });
      }
    }
    // OUTBREAK PRESSURE (§3.1): count the sector's contagion. Live infected
    // are the visible threat; unburned corpses are the future one (weighted
    // heavier — an unprocessed body is a promise); exposed soldiers are the
    // slow leak. Cheap: the index already partitioned the roster by team.
    let infected = 0, exposed = 0;
    for (const s of this.soldiers.values()) {
      if (!s.alive) continue;
      if (isZed(s.kind)) infected++;
      else if ((s.viralLoad ?? 0) > 0) exposed++;
    }
    // NESTS / MUTATION FIELDS (§8, §3.1): rescan the corpse field at low
    // frequency — a body with ≥3 unburned neighbours within NEST_RADIUS anchors
    // a contamination field. Cheap: corpses are capped at 40 (≤1600 pairs), and
    // this runs ~every 1.5s, not per tick.
    if (this.time >= this.nextNestScanAt) {
      this.nextNestScanAt = this.time + 1.5;
      const live = this.corpses.filter((c) => !c.neutralized);
      const centres: Vec3[] = [];
      for (const c of live) {
        let near = 0;
        for (const o of live) {
          if (o === c) continue;
          if (Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) <= NEST_RADIUS) near++;
        }
        // anchor a field on a well-surrounded body, but don't stack centres
        if (near >= 3 && !centres.some((n) => Math.hypot(n.x - c.pos.x, n.z - c.pos.z) < NEST_RADIUS)) {
          centres.push({ ...c.pos });
        }
      }
      const grew = centres.length > this.nests.length;
      this.nests = centres;
      if (grew) this.emit({ type: 'contamination', pos: { ...centres[centres.length - 1] } });
    }
    const pressure = infected + this.corpses.length * 1.5 + exposed * 0.5 + this.nests.length * 3;
    // ease toward the reading so a single kill can't jolt the level (§3.3)
    this.outbreakPressure += (pressure - this.outbreakPressure) * Math.min(1, dt * 0.5);
    // level bands with a 3s confirmation window before any change commits
    const p = this.outbreakPressure;
    const want = p >= 24 ? 4 : p >= 12 ? 3 : p >= 5 ? 2 : p >= 1 ? 1 : 0;
    if (want !== this.outbreakLevel) {
      if (this.time - this.outbreakLevelSince > 3) {
        const rising = want > this.outbreakLevel;
        this.outbreakLevel = want;
        this.outbreakLevelSince = this.time;
        if (rising) this.emit({ type: 'announce', text: OUTBREAK_LEVELS[want], big: want >= 3 });
      }
    } else this.outbreakLevelSince = this.time;

    // the dead: the corpse clock
    if (!this.corpses.length) return;
    this.corpses = this.corpses.filter((c) => {
      if (c.neutralized) return false; // processed — off the books
      if (this.time < c.reanimatesAt) {
        // §6 CRITICAL REANIMATION — the final warning window: strong twitching,
        // a last chance to burn it. Fire the alert ONCE as the body crosses in.
        if (!c.warned && c.reanimatesAt - this.time <= CORPSE_CRITICAL_WINDOW) {
          c.warned = true;
          this.emit({ type: 'corpse_critical', pos: { ...c.pos } });
        }
        return true;
      }
      const open = nearestOpenTile(this.map.grid, c.pos.x, c.pos.z, 4, this.map.geometry) ?? c.pos;
      const z = this.addZombie(riseKind(c.classId), { x: open.x, y: 0, z: open.z });
      // MUTATION FIELD (§8/§7): a body that rots inside a contamination nest
      // rises MUTATED — a tougher, hotter phenotype (a readable, emergent cause).
      const mutated = this.inNest(c.pos.x, c.pos.z);
      if (mutated) { z.maxHp = Math.round(z.maxHp * 1.4); z.hp = z.maxHp; }
      z.name = `${c.name}${mutated ? ' (mutated)' : ' (risen)'}`; // the map tells the story
      this.emit({ type: 'reanimated', pos: { ...z.pos }, soldierId: z.id });
      this.emit({ type: 'announce', text: `${c.name.toUpperCase()} ${mutated ? 'ROSE MUTATED' : 'GOT BACK UP'}` });
      return false;
    });
  }

  /** MUTATION FIELD test (§8): is this spot inside a contamination nest? */
  inNest(x: number, z: number): boolean {
    for (const n of this.nests) if (Math.hypot(n.x - x, n.z - z) <= NEST_RADIUS) return true;
    return false;
  }

  /** M1 THE RAGDOLL THRESHOLD (STATUS §1 / W1.5): a knockback impulse this big
   *  flips a soldier into luggage until they get up — WHEREVER it comes from, not
   *  just a blast. Gods are too heavy to flip; the encased already refused the
   *  shove. Extends an existing tumble (never shortens it) and only rings the
   *  'ragdoll' event on a fresh flip, so overlapping hits don't stutter it. */
  maybeRagdoll(s: Soldier, applied: number) {
    if (applied < RAGDOLL_AT || s.ascendant || s.encasedUntil !== undefined) return;
    const until = this.time + 0.9 + Math.min(0.6, (applied - RAGDOLL_AT) * 0.05);
    const alreadyDown = s.ragdollUntil !== undefined && this.time < s.ragdollUntil;
    s.ragdollUntil = Math.max(s.ragdollUntil ?? 0, until);
    if (!alreadyDown) this.emit({ type: 'ragdoll', pos: { ...s.pos }, soldierId: s.id });
  }

  explode(pos: Vec3, def: (typeof WEAPONS)[WeaponId], ownerId: number, team: Team, airBurst: boolean | ElevationWeaponClass = false) {
    // THE TWO ZONES (Robert: "a circle in the center, and a radius around
    // that… the closer you are, the more"). The lethal HEART — a direct-hit
    // class blow — reaches `killR`; from there damage falls smoothly to
    // nothing at the splash rim. The client draws these exact two radii, so
    // the ground rings tell the literal truth about who dies where.
    const killR = Math.min(def.splash * 0.4, 2.4);
    if (team === 0 && def.splash > 0 && this.operation?.plan.complication === 'no_collateral') {
      const protectedHit = this.map.operation?.protectedZones.some((zone) => Math.hypot(zone.pos.x - pos.x, zone.pos.z - pos.z) <= zone.radius);
      if (protectedHit) this.operationCollateral++;
    }
    // THE OUTBREAK (OUTBREAK-SPEC §6.2): a blast is corpse denial — any
    // exposed body inside the splash is neutralized and never rises. (The
    // fire system will join this when W7.3 lands; v1 speaks in explosions.)
    if (this.outbreakEnabled && this.corpses.length) {
      for (const c of this.corpses) {
        if (!c.neutralized && Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) <= def.splash) c.neutralized = true;
      }
    }
    this.emit({ type: 'explosion', pos: { ...pos }, weapon: def.id, radius: def.splash, killRadius: killR });
    const owner = this.soldiers.get(ownerId);
    for (const s of this.soldiers.values()) {
      if (!s.alive || s.vehicleId >= 0) continue;
      if (this.time < s.protectedUntil) continue; // spawn protection: no damage, no shove (55B)
      if (Math.abs(s.pos.y - pos.y) > 3.4) continue; // the floor slab eats cross-storey blasts
      const d = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z);
      if (d < def.splash) {
        const isSelf = s.id === ownerId;
        if (!isSelf && s.team === team) continue; // no friendly splash, self-damage yes
        // inside the kill circle: the full direct + splash blow (lethal by
        // design). Outside: splashDamage falling linearly to 0 at the rim.
        const dmg = (d < killR
          ? def.splashDamage + def.damage
          : def.splashDamage * (1 - (d - killR) / Math.max(0.1, def.splash - killR))
        ) * (isSelf ? 0.6 : 1);
        if (def.knockback > 0 && !this.hasEquip(s, 'noKnockback')) {
          const dl = Math.max(d, 0.5);
          const applied = def.knockback * (1 - d / def.splash);
          s.pushX += ((s.pos.x - pos.x) / dl) * applied;
          s.pushZ += ((s.pos.z - pos.z) / dl) * applied;
          // M1 THE RAGDOLL THRESHOLD: enough blast and the body stops being
          // yours — you tumble as luggage, then GET UP. (Now shared with the
          // slam and any other big shove — see maybeRagdoll.)
          this.maybeRagdoll(s, applied);
          // vertical pop capped at 6: artillery-class knockback (20+) would
          // otherwise launch soldiers into low-g orbit — the horizontal shove
          // carries the drama, the hop just sells the blast
          if (s.pos.y < 0.2) s.vel.y = Math.max(s.vel.y, Math.min(def.knockback * 0.3, 6));
        }
        this.damageSoldier(s, dmg, ownerId, def.id);
      }
    }
    for (const v of this.vehicles.values()) {
      if (!v.alive || v.team === team) continue;
      // SANCTUARY LAW: GROUND blasts stop at band 1 — a frag in the street
      // doesn't wound the high sky. An AIR-BURST (SAM/air ordnance) still does.
      const weaponClass: ElevationWeaponClass = typeof airBurst === 'string' ? airBurst : airBurst ? 'aircraft' : 'ground';
      if (!canWeaponReachElevation(weaponClass, asElevationLevel(v.band))) continue;
      if (v.submerged && !def.torpedo) continue;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z);
      if (d < def.splash + VEHICLES[v.kind].radius) {
        this.damageVehicle(v, (def.splashDamage + def.damage * 0.5) * (1 - d / (def.splash + 2)), ownerId, def.id);
        const attacker = this.soldiers.get(ownerId);
        const attackerHull = attacker && attacker.vehicleId >= 0 ? this.vehicles.get(attacker.vehicleId) : undefined;
        if (attackerHull) recordVehicleEvent(this.vehicleTelemetry, {
          kind: 'hit', t: this.time, vehicleId: attackerHull.id, vehicleKind: attackerHull.kind,
          theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
          x: v.pos.x, z: v.pos.z, detail: `${def.id}->${v.kind}`,
        });
      }
    }
    for (const t of this.turrets.values()) {
      if (!t.alive || t.team === team) continue;
      const d = Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z);
      if (d < def.splash + 1) this.damageTurret(t, def.splashDamage * (1 - d / (def.splash + 1)));
    }
    // doors in the blast take demolition damage — grenades, tank shells, and
    // bomber zeds are all door keys, just louder ones than E
    // TRAINING ordnance (paint) skips the structure ledger entirely. The
    // Lobber carries splashDamage 999 for the same overkill reason the other
    // markers do, which made one lobbed ball a demolition charge that
    // flattened every destructible tile within 3.3u of where it landed.
    if (def.splash > 0 && def.splashDamage > 0 && !def.training) {
      const { cols, rows, tile } = this.map.geometry;
      const r = Math.ceil(def.splash / tile) + 1;
      const [ctx, ctz] = worldToTile(this.map.geometry, pos.x, pos.z);
      for (let tz = Math.max(1, ctz - r); tz <= Math.min(rows - 2, ctz + r); tz++) {
        for (let tx = Math.max(1, ctx - r); tx <= Math.min(cols - 2, ctx + r); tx++) {
          const idx = tileIndex(this.map.geometry, tx, tz);
          const g = this.map.grid[idx];
          const center = tileToWorld(this.map.geometry, tx, tz);
          const d = Math.hypot(center.x - pos.x, center.z - pos.z);
          if (d >= def.splash + tile * 0.5) continue;
          if (g === T_DOOR || g === T_DOOR_OPEN) {
            // ×1.5: dumb wood takes a blast worse than a dodging soldier does
            this.damageDoor(idx, (def.splashDamage + def.damage * 0.5) * 1.5 * (1 - d / (def.splash + tile)), ownerId);
          } else {
            // DESTRUCTION: masonry in the blast takes the same ledger hit.
            // HEAVY (120mm-class, damage ≥ 100) breaches structure; anything
            // with real splash chips soft cover. damageWall sorts the tiers.
            this.damageWall(tx, tz, (def.splashDamage + def.damage * 0.5) * (1 - d / (def.splash + tile)), def.damage >= 100);
          }
        }
      }
    }
    if (owner) { /* no-op: kill credit handled in damage fns */ }
  }

  // ---------- damage ----------

  /** THE ICE BLOCK (§21.6). Freeze a soldier alive: a real 1-tile block that
   *  stops movement AND shots both ways, and shields them from ALL other harm
   *  — freezing an enemy removes him from the board AND briefly saves him.
   *  Never freezes a soldier already encased. Returns true if it took. */
  /** row 246: is the tile under (x,z) a water tile FROSTBITE has frozen and
   *  which has not yet thawed? Lazy — no sweep, just a clock check. */
  isFrozenWater(x: number, z: number): boolean {
    if (this.frozenWater.size === 0) return false;
    const [tx, tz] = worldToTile(this.map.geometry, x, z);
    if (tx < 0 || tx >= this.map.geometry.cols || tz < 0 || tz >= this.map.geometry.rows) return false;
    const idx = tileIndex(this.map.geometry, tx, tz);
    return (this.frozenWater.get(idx) ?? 0) > this.time;
  }

  /** FREEZE THE WATER (row 246): stamp every water tile within `radius` of a
   *  point as crossable ice until `until`. Only water freezes; the ice god
   *  calls this each tick he stands near a shore, so the bridge forms under
   *  him and lingers a beat after he moves on. Deterministic (no rng). */
  freezeWaterNear(x: number, z: number, radius: number, until: number) {
    const { cols, rows, tile } = this.map.geometry;
    const r = Math.ceil(radius / tile);
    const [cx, cz] = worldToTile(this.map.geometry, x, z);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = cx + dx, tz = cz + dz;
        if (tx < 0 || tx >= cols || tz < 0 || tz >= rows) continue;
        const idx = tileIndex(this.map.geometry, tx, tz);
        const t = this.map.grid[idx];
        if (t !== T_WATER && t !== T_DEEP) continue;
        const { x: wx, z: wz } = tileToWorld(this.map.geometry, tx, tz);
        if (Math.hypot(wx - x, wz - z) > radius) continue;
        const wasFrozen = (this.frozenWater.get(idx) ?? 0) > this.time;
        this.frozenWater.set(idx, until);
        if (!wasFrozen) this.emit({ type: 'water_froze', pos: { x: wx, y: 0, z: wz } });
      }
    }
    // prune long-thawed entries so the map never grows unbounded
    if (this.frozenWater.size > 400) {
      for (const [k, t2] of this.frozenWater) if (t2 <= this.time) this.frozenWater.delete(k);
    }
  }

  encaseSoldier(victim: Soldier, byId = -1): boolean {
    if (!victim.alive || victim.encasedUntil !== undefined) return false;
    if (this.time < victim.protectedUntil) return false;
    victim.encasedUntil = this.time + ICE_HOLD;
    victim.encasedBy = byId;
    victim.struggle = 0;
    victim.vel = { x: 0, y: 0, z: 0 };
    this.emit({ type: 'encased', pos: { ...victim.pos }, soldierId: victim.id });
    return true;
  }

  /** Break a soldier out of the ice — teammate shatter (free) or their own
   *  struggle (hurt). `cost` HP comes off on the way out, routed through the
   *  normal damage path so a fatal exit downs/kills correctly (the ice is
   *  already cleared, so no shield recursion). */
  private freeFromIce(s: Soldier, cost: number) {
    // the freezer owns this exit wound too — it read s.lastKillerId, which is
    // whoever killed this soldier in a PREVIOUS life: a man who struggled out
    // below 45 HP handed the kill to an arbitrary stranger from ten minutes ago
    const froze = s.encasedBy ?? -1;
    s.encasedUntil = undefined;
    s.encasedBy = undefined;
    s.struggle = undefined;
    this.emit({ type: 'revived', pos: { ...s.pos }, soldierId: s.id }); // "the ice gives"
    if (cost > 0) this.damageSoldier(s, cost, froze, 'bleedout');
  }

  /** §BEAMS row 189 — the post-pass. Crossed enemy streams CLASH: a node
   *  spawns on the wielder axis and WALKS toward the weaker side (power =
   *  dps + surge); reaching an end SHEARS through — the loser's emitter is
   *  knocked out and staggered. Clashing streams pour into each other, so
   *  neither damages bodies. Unpaired streams run the normal style walk. */
  private resolveHeldBeams(dt: number) {
    const beams = this.tickBeams;
    this.tickBeams = [];
    // wall-limited reach for every stream (bodies don't matter for crossing)
    const reach = (b: (typeof beams)[number]) => {
      const fx = Math.cos(b.s.yaw), fz = Math.sin(b.s.yaw);
      let end = b.def.range;
      for (let d = 1; d <= b.def.range; d += 1) {
        if (blocksShot(this.map.grid, b.s.pos.x + fx * d, b.s.pos.z + fz * d, 1.3, this.map.geometry)) { end = d; break; }
      }
      return { fx, fz, end };
    };
    const rays = beams.map((b) => ({ b, ...reach(b) }));
    // pair crossings: lowest-id pair wins; one clash per wielder
    const inClash = new Set<number>();
    const liveKeys = new Set<string>();
    for (let i = 0; i < rays.length; i++) {
      for (let j = i + 1; j < rays.length; j++) {
        const A = rays[i], B = rays[j];
        if (A.b.s.team === B.b.s.team) continue;
        if (inClash.has(A.b.s.id) || inClash.has(B.b.s.id)) continue;
        // 2D segment intersection of the two walked rays
        const denom = A.fx * B.fz - A.fz * B.fx;
        if (Math.abs(denom) < 1e-6) continue; // parallel streams pass
        const dx = B.b.s.pos.x - A.b.s.pos.x, dz = B.b.s.pos.z - A.b.s.pos.z;
        const tA = (dx * B.fz - dz * B.fx) / denom;
        const tB = (dx * A.fz - dz * A.fx) / denom;
        if (tA < 0.5 || tA > A.end || tB < 0.5 || tB > B.end) continue;
        const [aRay, bRay] = A.b.s.id < B.b.s.id ? [A, B] : [B, A];
        const key = `${aRay.b.s.id}-${bRay.b.s.id}`;
        let clash = this.beamClashes.get(key);
        if (!clash) {
          clash = { aId: aRay.b.s.id, bId: bRay.b.s.id, t: 0.5, x: 0, z: 0 };
          this.beamClashes.set(key, clash);
          this.emit({ type: 'beam_clash', pos: { x: A.b.s.pos.x + A.fx * tA, y: 1.3, z: A.b.s.pos.z + A.fz * tA }, soldierId: aRay.b.s.id });
        }
        liveKeys.add(key);
        inClash.add(A.b.s.id); inClash.add(B.b.s.id);
        // POWER: dps + surge (stamina-fed). The node walks toward the weaker.
        const pow = (r: typeof A) => {
          let pwr = r.b.def.held!.dps;
          if (r.b.surge) {
            pwr += CLASH_SURGE;
            r.b.s.energy = Math.max(0, r.b.s.energy - CLASH_SURGE_DRAIN * dt);
          }
          return pwr;
        };
        const pA = pow(aRay), pB = pow(bRay);
        clash.t = Math.max(0, Math.min(1, clash.t + (pA - pB) * CLASH_RATE * dt));
        // the node sits on the wielder axis at t
        clash.x = aRay.b.s.pos.x + (bRay.b.s.pos.x - aRay.b.s.pos.x) * clash.t;
        clash.z = aRay.b.s.pos.z + (bRay.b.s.pos.z - aRay.b.s.pos.z) * clash.t;
        // SHEAR: the node reached a wielder — their beam is knocked off-axis
        const loser = clash.t >= 0.92 ? bRay.b.s : clash.t <= 0.08 ? aRay.b.s : undefined;
        if (loser) {
          loser.beamJamUntil = this.time + CLASH_KNOCK_JAM;
          loser.beamHeat = 1;
          const winner = loser === aRay.b.s ? bRay.b.s : aRay.b.s;
          const dl = Math.max(Math.hypot(loser.pos.x - winner.pos.x, loser.pos.z - winner.pos.z), 0.5);
          loser.pushX += ((loser.pos.x - winner.pos.x) / dl) * 6;
          loser.pushZ += ((loser.pos.z - winner.pos.z) / dl) * 6;
          this.emit({ type: 'beam_clash_break', pos: { ...loser.pos }, soldierId: loser.id });
          this.beamClashes.delete(key);
          liveKeys.delete(key);
        }
      }
    }
    // clashes whose streams stopped crossing (released, jammed, died, moved
    // apart) dissolve without penalty — stepping out is a legitimate play
    for (const key of this.beamClashes.keys()) if (!liveKeys.has(key)) this.beamClashes.delete(key);
    // unpaired streams pour into the world
    for (const r of rays) {
      if (inClash.has(r.b.s.id)) continue;
      this.pourHeldBeam(r.b.s, r.b.def, r.b.wid, dt, r.fx, r.fz);
    }
  }

  /** the style walk (SIPHON stops / LANCE drills / TORRENT floods / PRISM
   *  fans) — the damage half of a held stream, run only when it isn't
   *  locked in a clash. */
  private pourHeldBeam(s: Soldier, def: WeaponDef, wid: WeaponId, dt: number, fx: number, fz: number) {
    const held = def.held!;
    const catchR = held.catchR ?? 1.1;
    let drills = held.pierce ?? 0;
    const drank = new Set<number>();
    let node: Soldier | undefined;
    walk: for (let d = 1; d <= def.range; d += 1) {
      const px = s.pos.x + fx * d, pz = s.pos.z + fz * d;
      if (blocksShot(this.map.grid, px, pz, 1.3, this.map.geometry)) break;
      // Robert: "it was going through vehicles." A hull is a wall to a beam —
      // it DRINKS the pour and (unless the stream drills) STOPS the ray. A
      // LANCE bores through; a SIPHON/TORRENT stops in the steel.
      for (const v of this.vehicles.values()) {
        if (!v.alive || v.team === s.team) continue;
        if (Math.hypot(v.pos.x - px, v.pos.z - pz) > (VEHICLES[v.kind].radius ?? 2) + 0.4) continue;
        this.damageVehicle(v, held.dps * dt, s.id, wid);
        if (drills <= 0) break walk; // the stream stops in the hull
        drills--;
        break; // one hull per step
      }
      for (const e of this.soldierIndex.near((1 - s.team) as Team, px, pz, catchR, BEAM_SCRATCH)) {
        if (!e.alive || e.id === s.id || drank.has(e.id)) continue;
        drank.add(e.id);
        this.damageSoldier(e, held.dps * dt, s.id, wid);
        if (drills <= 0) { node = e; break walk; }
        drills--;
      }
    }
    if (node && held.prism) {
      const pr = held.prism;
      const cands: { e: Soldier; d2: number }[] = [];
      for (const e of this.soldierIndex.near((1 - s.team) as Team, node.pos.x, node.pos.z, pr.radius, BEAM_SCRATCH)) {
        if (!e.alive || e.id === node.id || drank.has(e.id)) continue;
        const dx = e.pos.x - node.pos.x, dz = e.pos.z - node.pos.z;
        cands.push({ e, d2: dx * dx + dz * dz });
      }
      cands.sort((a, b) => a.d2 - b.d2 || a.e.id - b.e.id);
      let fans = 0;
      for (const c of cands) {
        if (fans >= pr.count) break;
        if (!losClear(this.map.grid, node.pos, c.e.pos, 1.3, this.map.geometry)) continue;
        this.damageSoldier(c.e, held.dps * pr.frac * dt, s.id, wid);
        fans++;
      }
    }
  }

  damageSoldier(victim: Soldier, dmg: number, attackerId: number, weapon: WeaponId, viaLink = false, pierceArmor = false) {
    if (!victim.alive || dmg <= 0) return;
    if (victim.god) return;                        // GOD MODE: nothing touches you
    if (this.time < victim.protectedUntil) return; // spawn protection (55B)
    // §14.2 HUMAN SHIELD: a shot at a holder from his shield's FRONT arc hits
    // the captive instead. The body is welded to his front, so this is the
    // physical truth — the round meets flesh before it meets him. Rear/flank
    // shots slip past the shield and land on the holder as normal.
    if (victim.grabbingId !== undefined && !viaLink) {
      const shield = this.soldiers.get(victim.grabbingId);
      const atk = attackerId >= 0 ? this.soldiers.get(attackerId) : undefined;
      if (shield?.humanShield && shield.alive && atk) {
        const fx = Math.cos(victim.yaw), fz = Math.sin(victim.yaw);
        if ((atk.pos.x - victim.pos.x) * fx + (atk.pos.z - victim.pos.z) * fz > 0) {
          this.damageSoldier(shield, dmg, attackerId, weapon, true, pierceArmor);
          return;
        }
      }
    }
    // §14.2: pain breaks the squeeze — shoot the choker and the capture stops
    // (the hold itself survives; only the channel is lost).
    if (victim.chokingId !== undefined) {
      const choked = this.soldiers.get(victim.chokingId);
      if (choked) choked.chokeProgress = undefined;
      victim.chokingId = undefined;
    }
    // THE OUTBREAK (OUTBREAK-SPEC §4): damage and infection are SEPARATE —
    // a bite that plate stops still contaminates. Claws and acid deliver
    // Viral Load to the living (humans and bots; machines are immune).
    if (this.outbreakEnabled && (weapon === 'zombie_claw' || weapon === 'spitter_acid')
        && (victim.kind === 'human' || victim.kind === 'bot')) {
      victim.viralLoad = Math.min(100, (victim.viralLoad ?? 0) + (weapon === 'zombie_claw' ? 22 : 14));
    }
    // DOMINATOR'S PSYCHIC LINK (§ finale): hurt one linked soldier and every
    // soldier on the same thread takes 60%. `viaLink` stops the shared pain
    // from feeding back on itself. Encased soldiers are off the wire.
    if (!viaLink && victim.encasedUntil === undefined && victim.psiLinkId !== undefined && this.time < (victim.psiLinkUntil ?? 0)) {
      for (const o of this.soldiers.values()) {
        if (o.id === victim.id || o.psiLinkId !== victim.psiLinkId || !o.alive) continue;
        if (this.time >= (o.psiLinkUntil ?? 0)) continue;
        this.damageSoldier(o, dmg * 0.6, attackerId, weapon, true);
      }
    }
    // ENCASED: the ice eats EVERYTHING — except a teammate's shot, which
    // SHATTERS it (frees them instantly, no cost). An enemy shooting the
    // block just wastes ammo. This is the whole timing game.
    if (victim.encasedUntil !== undefined) {
      const attacker = this.soldiers.get(attackerId);
      if (attacker && attacker.team === victim.team && attacker.id !== victim.id) {
        this.freeFromIce(victim, 0); // teammate shatter — instant, free
      }
      return; // no other damage lands on the ice
    }
    if (victim.cloaked) victim.cloaked = false;
    // REAPER'S MARK: the hunter's own blows land DOUBLE on the hunted
    if (victim.markedUntil !== undefined && this.time < victim.markedUntil && attackerId === victim.markedBy) {
      dmg *= 2;
    }
    // IRON EATERS (SS20.2): the molt is the health bar. While PLATED the
    // scrap eats the damage (the armor pool, visibly shedding); the moment
    // the plates are gone the frame is EXPOSED -- damage counts DOUBLE and
    // the beast gets FASTER AND ANGRIER (once, with a molt burst).
    if (isIron(victim.kind) && victim.armor <= 0) {
      dmg *= 2;
      if (victim.rageMul === undefined) {
        victim.rageMul = 1.35;
        this.emit({ type: 'explosion', pos: { ...victim.pos }, weapon: 'gl' });
      }
    }
    // GARGOYLE'S PERCH: stone takes half — until someone collapses the perch
    if (victim.perchTile !== undefined && victim.ascendant === 'gargoyle') {
      dmg *= 0.5;
    }
    // SOFT MID-AIR (generalized): the belly flop and every doctrine LEAP
    // share the AA window — a body between takeoff and landing bites 1.6x
    if (victim.diveAt !== undefined && victim.ascendant !== undefined &&
        (victim.ascendant === 'leviathan' || LSWS[victim.ascendant].moves === 'leap')) {
      dmg *= 1.6;
    }
    // CHRONOS'S TEMPORAL ECHO (once per fight): a lethal hit doesn't land —
    // he SNAPS to where he stood ~3s ago (the breadcrumb the glow has been
    // advertising all along; the counter is to camp it) and stands there at
    // a sliver of HP. The latch never resets — the second death is real.
    if (victim.ascendant === 'chronos' && !victim.lswFlagA && victim.hp - dmg <= 0 && victim.lswTrail?.length) {
      victim.lswFlagA = true;
      const echo = victim.lswTrail[0];
      this.emit({ type: 'warp', pos: { ...victim.pos } });
      victim.pos = { x: echo.x, y: 0, z: echo.z };
      victim.vel = { x: 0, y: 0, z: 0 };
      victim.hp = Math.max(1, victim.maxHp * 0.12);
      this.emit({ type: 'warp', pos: { x: echo.x, y: 0, z: echo.z } });
      this.emit({ type: 'lsw_active', pos: { x: echo.x, y: 0, z: echo.z }, text: 'chronos', soldierId: victim.id });
      this.emit({ type: 'vo', text: 'vo_chronos_low', pos: { ...victim.pos }, soldierId: victim.id });
      return; // the killing blow struck an afterimage
    }
    // issued plate takes the hit first; whatever punches through reaches flesh.
    // Each portion floats its own number: blue off the plate, red off the flesh.
    // AP threads ISSUED plate only. Two identity armors are exempt: an Iron
    // Eater's molt IS its health bar (SS20.2), and an LSW's armor is its
    // signature (Steel Weaver's rip-plate, Magnetar's bullet-fed halo) — for
    // both, the plate absorbs normally even against AP.
    const apThreads = pierceArmor && !isIron(victim.kind) && victim.ascendant === undefined;
    if (victim.armor > 0 && !apThreads) {  // AP rounds ignore ISSUED plate — the damage lands on flesh
      const absorbed = Math.min(victim.armor, dmg);
      victim.armor -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) this.emit({ type: 'damage', pos: { x: victim.pos.x, y: victim.pos.y + 1.7, z: victim.pos.z }, amount: absorbed, armorHit: true, soldierId: victim.id, ownerId: attackerId });
      if (dmg <= 0) return; // the plate held
    }
    victim.hp -= dmg;
    if (dmg > 0) this.emit({ type: 'damage', pos: { x: victim.pos.x, y: victim.pos.y + 1.7, z: victim.pos.z }, amount: dmg, armorHit: false, soldierId: victim.id, ownerId: attackerId });
    // UI-BIBLE §09 DAMAGE DIRECTION: the victim's client draws a red arc at
    // the ATTACKER's bearing. pos = where the shot came from, soldierId = who
    // got hurt (the addressee); the HUD filters to the local player.
    if (dmg > 0) {
      const atk = attackerId >= 0 ? this.soldiers.get(attackerId) : undefined;
      if (atk && atk.id !== victim.id) {
        this.emit({ type: 'hurt', pos: { ...atk.pos }, soldierId: victim.id });
      }
    }
    // the bloodied line (once per life): an LSW crossing a quarter health
    // says so — nearby ears get the tell BEFORE the killfeed does
    if (victim.ascendant && !victim.lswLowSaid && victim.hp > 0 && victim.hp < victim.maxHp * 0.25) {
      victim.lswLowSaid = true;
      this.emit({ type: 'vo', text: `vo_${victim.ascendant}_low`, pos: { ...victim.pos }, soldierId: victim.id });
    }
    // getting shot interrupts the rescue — the E-channel starts over
    if (victim.downed) victim.reviveProgress = 0;
    // combat medikit auto-triggers once per life below 25% — but a stim can't fix "down"
    if (victim.hp > 0 && !victim.downed && victim.medikitReady && victim.hp < victim.maxHp * 0.25 && this.hasEquip(victim, 'autoMedikit')) {
      victim.medikitReady = false;
      victim.hp = Math.min(victim.maxHp, victim.hp + 45);
      this.emit({ type: 'heal', pos: victim.pos, soldierId: victim.id });
    }
    if (victim.hp <= 0) {
      // §4.3: humans and bots take a knee before the grave — lethal damage
      // downs them once. The undead and the scientist die the old way, a
      // finisher on an already-downed body is final, range dummies just fall
      // over (they're targets, not casualties), and OVERKILL — damage that
      // blows well past zero — skips the crawl: a tank shell leaves nothing
      // to drag to cover.
      if (!victim.downed && !victim.dummy && victim.hp > -DOWNED_HP && victim.decoyOf === undefined &&
          (victim.kind === 'human' || victim.kind === 'bot')) {
        // (a Mirage decoy never crawls — an illusion POPS, it doesn't bleed)
        this.downSoldier(victim, attackerId);
        return;
      }
      // an LSW falling is an EVENT: last words for whoever stood close
      // enough to hear them, and the net tells the whole map
      if (victim.ascendant) {
        this.emit({ type: 'vo', text: `vo_${victim.ascendant}_death`, pos: { ...victim.pos }, soldierId: victim.id });
        this.emit({ type: 'announce', text: LSWS[victim.ascendant].lines.down, big: true });
        this.emit({ type: 'vo', text: `ann_${victim.ascendant}_down` });
      }
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.downed = false; // the middle state ends here — one death, counted once
      victim.downedUntil = 0;
      victim.reviveProgress = 0;
      victim.respawnAt = this.time + (isZed(victim.kind) ? 2 : RESPAWN_DELAY);
      // A GHOST MAY NOT HOLD A CHAIR. Death used to leave the victim's id in
      // v.seats forever — spawn() cleared the SOLDIER's fields at respawn but
      // never the hull's manifest. A killed rider bricked the seat for the
      // rest of the match: nobody could board it, crew checks counted a dead
      // gunner as crew, and a 1-seat hoverboard became furniture.
      if (victim.vehicleId >= 0) {
        const hull = this.vehicles.get(victim.vehicleId);
        if (hull && hull.seats[victim.seat] === victim.id) {
          hull.seats[victim.seat] = -1;
          if (!hull.seats.some((id) => id >= 0)) hull.abandonedAt = this.time;
        }
        victim.vehicleId = -1;
        victim.seat = -1;
      }
      const attacker = this.soldiers.get(attackerId);
      // the killcam frames the duel — remember who fired the killing blow AND
      // with WHAT (DEATH-DATA: the killcam label names the weapon now)
      victim.lastKillerId = attacker && attacker.id !== victim.id ? attacker.id : -1;
      victim.lastKillWeapon = weapon;
      // LOOT: the dead man's PRIMARY hits the dirt beside him — kill the
      // heavy, take the autocannon. Claws never drop (not human kit), gods
      // take their arms with them, and the issue rifle stays beneath notice.
      if ((victim.kind === 'human' || victim.kind === 'bot') && victim.ascendant === undefined) {
        const wid = victim.weapons[0];
        if (wid && !LOOT_EXCLUDED.has(wid)) {
          let drops = 0; let oldest: Pickup | undefined;
          for (const pk of this.pickups.values()) {
            if (pk.type === 'weapon') { drops++; oldest ??= pk; }
          }
          if (drops >= LOOT_MAX && oldest) this.pickups.delete(oldest.id);
          const a = ((victim.id % 8) / 8) * Math.PI * 2; // deterministic scatter
          const pk: Pickup = {
            id: this.id(), type: 'weapon', weaponId: wid,
            pos: { x: victim.pos.x + Math.cos(a) * 0.7, y: 0, z: victim.pos.z + Math.sin(a) * 0.7 },
            respawnAt: 0, oneShot: true, expiresAt: this.time + LOOT_DESPAWN,
          };
          this.pickups.set(pk.id, pk);
        }
      }
      // THE OUTBREAK (OUTBREAK-SPEC §6): an exposed body is a FUTURE ENEMY.
      // Dying hot (Viral Load ≥ 40) books a corpse on the reanimation clock —
      // hotter turns faster. The reprint itself is clean (the printer filters
      // the strain); it's the BODY left on the field that rises.
      if (this.outbreakEnabled && (victim.kind === 'human' || victim.kind === 'bot')
          && (victim.viralLoad ?? 0) >= 40) {
        if (this.corpses.length >= 40) this.corpses.shift(); // oldest forgotten
        this.corpses.push({
          pos: { x: victim.pos.x, y: 0, z: victim.pos.z },
          reanimatesAt: this.time + 6 + (100 - (victim.viralLoad ?? 40)) * 0.08,
          neutralized: false,
          name: victim.name,
          classId: victim.classId,             // §7: the variant is DERIVED from the body
        });
        // CLONE INFECTION rides the reinforcement economy (spec: infection ×
        // clones): a HOT death costs the campaign vat DOUBLE — one clone to
        // reprint you, and the body you left rises against the line. The
        // match-end fold reads this counter (main.ts → applyResult deaths).
        this.viralDeaths[victim.team]++;
      }
      victim.viralLoad = 0; // whatever happens to the body, the NEXT print is clean
      // SHUTDOWN (delight): ending a soldier on a tear is a whole-net moment
      if ((victim.streak ?? 0) >= 4 && attacker && attacker.id !== victim.id && !isZed(victim.kind)) {
        this.emit({ type: 'announce', text: `${attacker.name} SHUT DOWN ${victim.name} (×${victim.streak})` });
      }
      victim.streak = 0; // a corpse's streak is over
      if (attacker && attacker.id !== victim.id) {
        attacker.kills++;
        // RAMPAGE (delight): the LSW milestone, generalized to every soldier —
        // a bot or human on a tear gets named to the whole lobby, and ending
        // one (above) feels earned. LSWs keep their own bespoke lines below.
        if (!attacker.ascendant && (attacker.kind === 'human' || attacker.kind === 'bot')) {
          attacker.streak = (attacker.streak ?? 0) + 1;
          const st = attacker.streak;
          // streak calls in the payroll department's voice — carnage,
          // reluctantly acknowledged (detail #3, the HR notices)
          if (st === 4) this.emit({ type: 'announce', text: `NOTICE: ${attacker.name} — 4 CONFIRMED. HR HAS BEEN INFORMED.` });
          else if (st === 6) this.emit({ type: 'announce', text: `${attacker.name} — 6 CONFIRMED. AMMUNITION EXPENDITURE FLAGGED FOR REVIEW.`, big: true });
          else if (st === 9) this.emit({ type: 'announce', text: `${attacker.name} — 9 CONFIRMED. THE ENEMY HAS FILED A FORMAL COMPLAINT.`, big: true });
        }
        // LSW kill milestones (per-life, counted from ascension): the third
        // kill gets a line only nearby ears hear; the fifth wakes the net
        if (attacker.ascendant) {
          const lifeKills = attacker.kills - (attacker.lswKillsBase ?? 0);
          if (lifeKills === 3) {
            this.emit({ type: 'vo', text: `vo_${attacker.ascendant}_kill3`, pos: { ...attacker.pos }, soldierId: attacker.id });
          } else if (lifeKills === 5) {
            this.emit({ type: 'announce', text: LSWS[attacker.ascendant].lines.rampage, big: true });
            this.emit({ type: 'vo', text: `ann_${attacker.ascendant}_rampage` });
          }
        }
        attacker.score += isZed(victim.kind) ? ZOMBIE_STATS[victim.kind].score : 10;
        // trophy ledger: how far did that shot travel?
        const range = Math.hypot(victim.pos.x - attacker.pos.x, victim.pos.z - attacker.pos.z);
        const newBest = range > attacker.longestKill;
        if (newBest) attacker.longestKill = Math.round(range * 10) / 10;
        // W2.5 THE KILL CONFIRM — reward a great kill, not just the death.
        // Addressed to the KILLER alone (his HUD, his flourish — never a
        // screen takeover while he's alive and fighting): the name, the
        // range, and the spice (a NEW LONGEST rings louder). Humans only —
        // a bot needs no applause.
        if (attacker.kind === 'human' && !isZed(victim.kind)) {
          this.emit({
            type: 'kill_confirm', soldierId: attacker.id, text: victim.name,
            amount: Math.round(range), weapon, big: newBest && range > 20,
          });
        }
      }
      // bombers go out with a bang — hurts whoever is close on the other team
      if (victim.kind === 'bomber') this.bomberDetonate(victim);
      // ragdoll fall direction: away from the killing blow (or the victim's own
      // facing for suicides / environment kills)
      let fx = Math.cos(victim.yaw), fz = Math.sin(victim.yaw);
      if (attacker && attacker.id !== victim.id) {
        const dx = victim.pos.x - attacker.pos.x, dz = victim.pos.z - attacker.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        fx = dx / d; fz = dz / d;
      }
      // THE KILLING BLOW HAS WEIGHT (Robert: "if a bullet hits you and it kills
      // you, it'd be nice to see it knock you back — if a shotgun hits you it'd
      // be nice to see it blow you back").
      //
      // Until now only the DIRECTION of the blow survived death; its force was
      // discarded, and the body froze where it stood. A corpse now carries the
      // shove that killed it, and stepCorpses() spends it.
      const shove = deathShove(WEAPONS[weapon]);
      victim.pushX += fx * shove;
      victim.pushZ += fz * shove;
      // a heavy blow lifts you off your feet; a beam does not
      if (shove >= 12) victim.vel.y = Math.max(victim.vel.y, Math.min(shove * 0.22, 5));
      victim.corpseUntil = this.time + CORPSE_PHYSICS_S;
      // THE DEATH REPORT (DEATH-DATA.md): the range, the weapon id, the
      // attacker's hull, and time-alive were all in scope here and discarded —
      // now they ride the event as one source for the feed/cam/AAR/ledger.
      const credited = attacker && attacker.id !== victim.id;
      const killDist = credited ? Math.hypot(victim.pos.x - attacker.pos.x, victim.pos.z - attacker.pos.z) : 0;
      const killerHull = credited && attacker.vehicleId >= 0 ? this.vehicles.get(attacker.vehicleId) : undefined;
      this.emit({
        type: 'death', pos: { ...victim.pos }, soldierId: victim.id,
        killerName: credited ? attacker.name : undefined,
        victimName: victim.name,
        killerTeam: attacker?.team,
        weaponName: WEAPONS[weapon]?.name,
        classId: victim.kind === 'human' || victim.kind === 'bot' ? victim.classId : undefined,
        fallX: fx, fallZ: fz,
        weaponId: weapon,
        killerId: credited ? attacker.id : -1,
        dist: Math.round(killDist * 10) / 10,
        // overkill needs the pre-hit hp (clamped to 0 by here) — it lands with
        // the full DeathReport slice; the 5 fields above were free.
        timeAlive: victim.spawnedAt !== undefined ? Math.round((this.time - victim.spawnedAt) * 10) / 10 : undefined,
        ...(killerHull ? { killerVehicle: killerHull.kind } : {}),
      });
    }
  }

  damageVehicle(v: Vehicle, dmg: number, attackerId: number, weapon: WeaponId) {
    if (!v.alive || dmg <= 0) return;
    // 65% of every hit goes to the hull; 35% chews into a random subsystem —
    // tanks get damaged in all sorts of ways before they die.
    const sysShare = dmg * 0.35;
    v.hp -= dmg - sysShare;
    const sys = SYSTEM_IDS[this.rng.int(0, SYSTEM_IDS.length - 1)];
    if (v.systems[sys] > 0) {
      v.systems[sys] -= sysShare;
      if (v.systems[sys] <= 0) {
        v.systems[sys] = 0;
        this.emit({ type: 'system_damaged', pos: { ...v.pos }, system: sys, text: `${VEHICLES[v.kind].name}: ${sys.toUpperCase()} destroyed` });
      }
    } else {
      v.hp -= sysShare; // already-dead system passes damage to the hull
    }
    if (v.hp <= 0) {
      v.hp = 0;
      v.alive = false;
      recordVehicleEvent(this.vehicleTelemetry, {
        kind: 'loss', t: this.time, vehicleId: v.id, vehicleKind: v.kind,
        theaterId: this.map.theater?.id ?? 'classic', seed: this.map.seed,
        x: v.pos.x, z: v.pos.z, detail: weapon,
      });
      // B1: a wreck goes on its owner team's bill at requisition value
      this.warLedger[v.team].hulls += VEHICLES[v.kind].cost ?? 1;
      v.respawnAt = this.time + VEHICLE_RESPAWN;
      // DEATH-DATA / weapon-memory: credit the kill so a gun can stamp the
      // HULL TYPE it killed (Robert: "the type of vehicles they've taken out")
      this.emit({ type: 'vehicle_destroyed', pos: { ...v.pos }, killerId: attackerId, weaponId: weapon, vehKind: v.kind });
      this.emit({ type: 'explosion', pos: { ...v.pos }, weapon: 'tank_cannon' });
      // occupants take heavy damage and are ejected
      for (const sid of v.seats) {
        if (sid < 0) continue;
        const s = this.soldiers.get(sid);
        if (s) {
          s.vehicleId = -1; s.seat = -1;
          this.damageSoldier(s, 70, attackerId, weapon);
        }
      }
      v.seats.fill(-1);
      const attacker = this.soldiers.get(attackerId);
      if (attacker && attacker.team !== v.team) {
        attacker.score += 25;
        attacker.vehicleKills++; // trophy ledger
      }
    }
  }

  damageTurret(t: Turret, dmg: number) {
    if (!t.alive || dmg <= 0) return;
    t.hp -= dmg;
    if (t.hp <= 0) {
      t.alive = false;
      this.emit({ type: 'explosion', pos: { ...t.pos }, weapon: 'gl' });
      this.turrets.delete(t.id);
    }
  }

  // ---------- mines & pickups ----------

  stepMines(dt: number) {
    for (const [id, m] of this.mines) {
      if (this.time < m.armedAt) continue;
      if (m.spider) { this.stepSpiderMine(id, m, dt); continue; } // the vulture mine walks
      for (const s of this.soldiers.values()) {
        if (!s.alive || s.team === m.team || s.pos.y > 1) continue;
        if (Math.hypot(s.pos.x - m.pos.x, s.pos.z - m.pos.z) < 2) {
          const def = { ...WEAPONS.gl, damage: 80, splash: 4, splashDamage: 70 };
          this.explode(m.pos, def as (typeof WEAPONS)[WeaponId], m.ownerId, m.team);
          this.mines.delete(id);
          break;
        }
      }
      if (!this.mines.has(id)) continue;
      for (const v of this.vehicles.values()) {
        if (!v.alive || v.team === m.team) continue;
        if (Math.hypot(v.pos.x - m.pos.x, v.pos.z - m.pos.z) < VEHICLES[v.kind].radius + 1.5) {
          this.damageVehicle(v, 220, m.ownerId, 'gl');
          this.emit({ type: 'explosion', pos: { ...m.pos }, weapon: 'gl' });
          this.mines.delete(id);
          break;
        }
      }
    }
  }

  /** THE SPIDER MINE (Robert): planted dormant — a glint on the ground — until
   *  an enemy strays into its wake radius. Then it POPS and SKITTERS them down
   *  (the skitter's own walk: faster than boots, wall-checked, no climbing),
   *  detonating on contact with a heavier bite than a static mine. */
  private stepSpiderMine(id: number, m: Mine, dt: number) {
    const WAKE = 11;
    let tgt: Soldier | undefined, td = Infinity;
    for (const s of this.soldiers.values()) {
      if (!s.alive || s.team === m.team || s.pos.y > 1 || s.vehicleId >= 0) continue;
      const d = Math.hypot(s.pos.x - m.pos.x, s.pos.z - m.pos.z);
      if (d < td) { td = d; tgt = s; }
    }
    if (!m.awake) {
      if (tgt && td < WAKE) { m.awake = true; this.emit({ type: 'mine_wake', pos: { ...m.pos }, soldierId: m.ownerId }); }
      return; // dormant: it lies still until prey is near
    }
    if (tgt) m.yaw = Math.atan2(tgt.pos.z - m.pos.z, tgt.pos.x - m.pos.x);
    const sp = 9; // faster than boots, slower than bullets
    const nx = m.pos.x + Math.cos(m.yaw ?? 0) * sp * dt;
    const nz = m.pos.z + Math.sin(m.yaw ?? 0) * sp * dt;
    if (!isBlocked(this.map.grid, nx, m.pos.z)) m.pos.x = nx; // slide along walls
    if (!isBlocked(this.map.grid, m.pos.x, nz)) m.pos.z = nz;
    if (tgt && td < 1.5) {
      const def = { ...WEAPONS.gl, damage: 95, splash: 4.5, splashDamage: 78, knockback: 14 };
      this.explode({ ...m.pos, y: 0.4 }, def as (typeof WEAPONS)[WeaponId], m.ownerId, m.team);
      this.mines.delete(id);
      return;
    }
    for (const v of this.vehicles.values()) {
      if (!v.alive || v.team === m.team) continue;
      if (Math.hypot(v.pos.x - m.pos.x, v.pos.z - m.pos.z) < VEHICLES[v.kind].radius + 1.2) {
        this.damageVehicle(v, 240, m.ownerId, 'gl');
        this.emit({ type: 'explosion', pos: { ...m.pos }, weapon: 'gl' });
        this.mines.delete(id);
        return;
      }
    }
  }

  stepPickups(_dt: number) {
    for (const pk of this.pickups.values()) {
      // battlefield hygiene: dropped guns evaporate — nobody wanted it enough
      if (pk.expiresAt !== undefined && this.time >= pk.expiresAt) {
        this.pickups.delete(pk.id);
        continue;
      }
      if (pk.respawnAt > 0) {
        if (this.time >= pk.respawnAt) pk.respawnAt = 0;
        continue;
      }
      for (const s of this.soldiers.values()) {
        // a downed soldier can't scoop up loot — and dogs have no pockets
        if (!s.alive || s.downed || isZed(s.kind) || s.kind === 'dog' || s.vehicleId >= 0) continue;
        if (Math.hypot(s.pos.x - pk.pos.x, s.pos.z - pk.pos.z) < 1.6) {
          let used = false;
          if (pk.type === 'medkit' && s.hp < s.maxHp) { s.hp = Math.min(s.maxHp, s.hp + 50); used = true; }
          if (pk.type === 'energy' && s.energy < 100) { s.energy = 100; s.grenades = Math.min(s.grenades + 1, 4); used = true; }
          if (pk.type === 'ammo') {
            for (let i = 0; i < s.weapons.length; i++) {
              const def = WEAPONS[s.weapons[i]];
              if (Number.isFinite(def.reserve)) s.reserve[i] = def.reserve;
            }
            // a crate restocks the under-barrel too
            const priAlt = WEAPONS[s.weapons[0]]?.alt;
            if (priAlt && priAlt.ammo > 0) s.altAmmo = priAlt.ammo;
            // §11.3: and the SPECIAL pools — a crate is a full resupply
            if (s.ammoPools) {
              for (const k of Object.keys(s.ammoPools) as (keyof NonNullable<typeof s.ammoPools>)[]) {
                s.ammoPools[k] = AMMO_INFO[k]?.pool ?? s.ammoPools[k];
              }
            }
            used = true;
          }
          if (pk.type === 'orbital') { s.orbitals++; used = true; }
          if (pk.type === 'flamer') {
            if (!s.weapons.includes('flamer')) {
              s.weapons.push('flamer');
              s.clip.push(WEAPONS.flamer.clip);
              s.reserve.push(WEAPONS.flamer.reserve);
            } else {
              const i = s.weapons.indexOf('flamer');
              s.clip[i] = WEAPONS.flamer.clip;
              s.reserve[i] = WEAPONS.flamer.reserve;
            }
            used = true;
          }
          // LOOT: a dropped gun. HUMANS ONLY for now — a bot scavenging
          // reserve mid-ring would lean on the threat-measure bands (bots
          // still DROP, so the player's revenge loop works both ways later).
          if (pk.type === 'weapon' && pk.weaponId && s.kind === 'human' && s.ascendant === undefined) {
            const def = WEAPONS[pk.weaponId];
            const have = s.weapons.indexOf(pk.weaponId);
            if (have >= 0) {
              // a matching gun is an AMMO run — take the dead man's mags
              const below = s.clip[have] < def.clip
                || (Number.isFinite(def.reserve) && s.reserve[have] < def.reserve);
              if (below) {
                s.clip[have] = def.clip;
                if (Number.isFinite(def.reserve)) s.reserve[have] = def.reserve;
                used = true;
              }
            } else if (s.weapons.length < 3) {
              // the special slot takes it, loaded
              s.weapons.push(pk.weaponId);
              s.clip.push(def.clip);
              s.reserve.push(def.reserve);
              used = true;
            }
            // a different special already rides slot 3 → leave it lying there
          }
          if (used) {
            if (pk.oneShot) this.pickups.delete(pk.id);
            else pk.respawnAt = this.time + PICKUP_RESPAWN;
            this.emit({ type: 'pickup', pos: pk.pos, soldierId: s.id });
            break;
          }
        }
      }
    }
  }

  /** E near the scientist: he follows you; E again: he holds position where he stands. */
  toggleEscort(s: Soldier): boolean {
    const sci = this.mode.scientistId !== undefined ? this.soldiers.get(this.mode.scientistId) : undefined;
    if (!sci || !sci.alive) return false;
    if (Math.hypot(sci.pos.x - s.pos.x, sci.pos.z - s.pos.z) > 3.2) return false;
    if (sci.botTargetId === s.id) {
      sci.botTargetId = -1;
      this.emit({ type: 'announce', text: 'Dr. Voss is holding position' });
    } else {
      sci.botTargetId = s.id;
      this.emit({ type: 'announce', text: `Dr. Voss is following ${s.name}` });
    }
    return true;
  }

  /** Bomber blast: on death or on reaching a victim. */
  bomberDetonate(bomber: Soldier) {
    const blast = { ...WEAPONS.gl, id: 'gl' as WeaponId, damage: 35, splash: 4.5, splashDamage: 55 };
    this.explode(bomber.pos, blast as (typeof WEAPONS)[WeaponId], bomber.id, bomber.team);
  }

  fireZombieSpit(s: Soldier, target: Soldier) {
    const def = WEAPONS.spitter_acid;
    const yaw = Math.atan2(target.pos.z - s.pos.z, target.pos.x - s.pos.x) + (this.rng.next() - 0.5) * 0.06;
    const p: Projectile = {
      id: this.id(), weapon: 'spitter_acid', ownerId: s.id, team: s.team,
      pos: { x: s.pos.x + Math.cos(yaw), y: 1.2, z: s.pos.z + Math.sin(yaw) },
      vel: { x: Math.cos(yaw) * def.speed, y: 1.5, z: Math.sin(yaw) * def.speed },
      bornAt: this.time, ttl: def.range / def.speed + 0.5, arc: false,
    };
    this.launch(p);
    this.emit({ type: 'shot', pos: { ...s.pos }, weapon: 'spitter_acid', soldierId: s.id });
  }

  // ---------- queries ----------

  humansAndBots(): Soldier[] {
    // PEOPLE, not furniture (F.1): a range DUMMY is a target, never a roster
    // entry — dummies inflated the yard's headcount (the human drew HUNTER
    // both rounds) and held squad-wipe checks "alive" after everyone fell.
    // opt #8 (S7): the filtered list is match-stable — build once, reuse until
    // the roster changes. Modes/objective sites hit this up to ~10×/tick.
    if (!this.rosterCache) {
      this.rosterCache = [...this.soldiers.values()].filter((s) => (s.kind === 'human' || s.kind === 'bot') && !s.dummy);
    }
    return this.rosterCache;
  }

  /** opt #8 (S7): drop the humansAndBots cache — call after adding or removing a
   *  human/bot from `soldiers` OUTSIDE addSoldier (server disconnect, puppet
   *  prune). Cheap and idempotent; the next humansAndBots() rebuilds. */
  invalidateRoster() { this.rosterCache = null; }

  livingEnemiesOf(team: Team): Soldier[] {
    return [...this.soldiers.values()].filter((s) => s.alive && s.team !== team);
  }
}
