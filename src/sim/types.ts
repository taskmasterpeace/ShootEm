export type Team = 0 | 1; // 0 = Titan (amber), 1 = Collective (cyan). Survival: all players team 0.

export type ModeId = 'tdm' | 'ctf' | 'koth' | 'conquest' | 'survival' | 'horde' | 'safehouse';

export type ClassId = 'infantry' | 'heavy' | 'jump' | 'engineer' | 'medic' | 'infiltrator';

export type WeaponId =
  | 'ar606'      // Maklov AR-606 assault rifle
  | 'kuchler'    // Kuchler K6 SMG
  | 'caw'        // CAW-8 combat shotgun
  | 'rg2'        // RG-2 railgun
  | 'ac_mk2'     // AC-Mk2 autocannon
  | 'mml'        // micro-missile launcher
  | 'gl'         // grenade launcher
  | 'plasma'     // Kamenel plasma repeater
  | 'flamer'     // F-3 flamer (pickup)
  | 'pistol'     // P9 sidearm
  | 'repair'     // engineer repair gun
  | 'medibeam'   // medic heal beam
  | 'buggy_mg' | 'tank_cannon' | 'apc_mg' | 'skiff_plasma' | 'turret_mg'
  | 'zombie_claw' | 'spitter_acid';

export type VehicleKind = 'buggy' | 'tank' | 'apc' | 'skiff';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  /** shots per second */
  rof: number;
  /** projectile speed in units/s; >=200 renders as an instant tracer */
  speed: number;
  /** radians of cone spread */
  spread: number;
  pellets: number;
  clip: number;
  reloadTime: number;
  /** max reserve ammo; Infinity for energy/vehicle weapons */
  reserve: number;
  range: number;
  /** splash radius (0 = none) */
  splash: number;
  splashDamage: number;
  /** lobbed ballistic arc (grenade launcher) */
  arc: boolean;
  /** heals instead of hurts (repair/medibeam) */
  heals: boolean;
  sound: string;
  tracer: 'bullet' | 'shell' | 'rocket' | 'plasma' | 'rail' | 'flame' | 'beam' | 'acid' | 'none';
}

export interface ClassDef {
  id: ClassId;
  name: string;
  desc: string;
  hp: number;
  speed: number; // units/s
  primary: WeaponId;
  secondary: WeaponId;
  ability: 'grenade' | 'jetpack' | 'turret' | 'heal' | 'cloak';
  abilityName: string;
  color: number;
}

export interface VehicleDef {
  kind: VehicleKind;
  name: string;
  hp: number;
  speed: number;
  turnRate: number; // rad/s
  weapon: WeaponId;
  seats: number;
  /** APC acts as mobile spawn for its team */
  mobileSpawn: boolean;
  radius: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type SoldierKind = 'human' | 'bot' | 'zombie' | 'spitter' | 'brute' | 'sprinter' | 'bomber' | 'scientist';

export type ZedKind = 'zombie' | 'spitter' | 'brute' | 'sprinter' | 'bomber';

const ZED_KINDS: ReadonlySet<string> = new Set(['zombie', 'spitter', 'brute', 'sprinter', 'bomber']);

export function isZed(k: SoldierKind): k is ZedKind {
  return ZED_KINDS.has(k);
}

export interface Soldier {
  id: number;
  kind: SoldierKind;
  name: string;
  team: Team;
  classId: ClassId;
  pos: Vec3;
  vel: Vec3;
  yaw: number;        // facing/aim direction on ground plane
  hp: number;
  maxHp: number;
  energy: number;     // jetpack fuel / cloak charge / ability resource
  alive: boolean;
  respawnAt: number;  // sim time when respawn allowed
  weaponIdx: number;  // 0 primary, 1 secondary, 2 special pickup
  weapons: WeaponId[];
  clip: number[];
  reserve: number[];
  reloadUntil: number;
  nextFireAt: number;
  grenades: number;
  nextGrenadeAt: number;
  cloaked: boolean;
  vehicleId: number;  // -1 when on foot
  seat: number;
  enteredVehicleAt: number; // guards same-keypress enter→exit
  kills: number;
  deaths: number;
  score: number;
  carryingFlag: Team | -1;
  nextAbilityAt: number;
  // bot brain scratch
  botGoal?: Vec3 | null;
  botRepathAt?: number;
  botTargetId?: number;
  botStrafeDir?: number;
}

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  team: Team; // team lock of spawn pad; -1 style neutrality not needed, vehicles usable by spawn team
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  turretYaw: number;
  hp: number;
  maxHp: number;
  seats: number[]; // soldier ids, -1 empty; [0] = driver
  nextFireAt: number;
  alive: boolean;
  respawnAt: number;
  padPos: Vec3;
}

export interface Turret {
  id: number;
  team: Team;
  pos: Vec3;
  yaw: number;
  hp: number;
  maxHp: number;
  nextFireAt: number;
  ownerId: number; // engineer who built it
  alive: boolean;
}

export interface Projectile {
  id: number;
  weapon: WeaponId;
  ownerId: number;   // soldier id (vehicle shots credit the driver)
  team: Team;
  pos: Vec3;
  vel: Vec3;
  bornAt: number;
  ttl: number;
  arc: boolean;
}

export interface Pickup {
  id: number;
  type: 'medkit' | 'ammo' | 'flamer' | 'energy';
  pos: Vec3;
  respawnAt: number; // 0 = available
}

export interface Mine {
  id: number;
  team: Team;
  ownerId: number;
  pos: Vec3;
  armedAt: number;
}

export interface FlagState {
  team: Team;
  homePos: Vec3;
  pos: Vec3;
  carrierId: number; // -1 = on ground / home
  atHome: boolean;
  droppedAt: number;
}

export interface ControlPoint {
  id: number;
  name: string;
  pos: Vec3;
  owner: Team | -1;
  progress: number;  // -100..100 capture meter (positive = team 0)
  radius: number;
}

/** One-shot things that happened this tick — the client turns these into sound + VFX. */
export interface SimEvent {
  type:
    | 'shot' | 'explosion' | 'hit' | 'death' | 'respawn' | 'pickup' | 'reload'
    | 'flag_taken' | 'flag_dropped' | 'flag_returned' | 'flag_captured'
    | 'point_captured' | 'wave_start' | 'vehicle_enter' | 'vehicle_exit'
    | 'vehicle_destroyed' | 'turret_built' | 'heal' | 'jetpack' | 'cloak'
    | 'announce' | 'match_over' | 'mine_planted';
  pos?: Vec3;
  weapon?: WeaponId;
  soldierId?: number;
  killerName?: string;
  victimName?: string;
  killerTeam?: Team;
  weaponName?: string;
  team?: Team;
  text?: string;
  big?: boolean;
}

export interface ModeState {
  id: ModeId;
  timeLeft: number;
  scores: [number, number];
  target: number;
  over: boolean;
  winner: Team | -1;
  // ctf
  flags?: FlagState[];
  // koth
  hillPos?: Vec3;
  hillRadius?: number;
  hillHolder?: Team | -1;
  // conquest
  points?: ControlPoint[];
  tickets?: [number, number];
  // survival / horde / safehouse
  wave?: number;
  zombiesLeft?: number;
  nextWaveAt?: number;
  // safehouse
  scientistId?: number;
  alertUntil?: number;
  alert?: boolean;
}

/** Modes where all players share team 0 against the undead. */
export function isCoopMode(id: ModeId): boolean {
  return id === 'survival' || id === 'horde' || id === 'safehouse';
}

export interface PlayerCmd {
  moveX: number;   // -1..1 strafe
  moveZ: number;   // -1..1 forward
  aimYaw: number;
  fire: boolean;
  altFire: boolean;
  jump: boolean;   // jetpack / vehicle boost
  use: boolean;    // enter/exit vehicle
  ability: boolean;
  reload: boolean;
  grenade: boolean;
  weaponSlot: number; // -1 = no change
}
