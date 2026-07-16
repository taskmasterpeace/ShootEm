export type Team = 0 | 1; // 0 = United Front (amber), 1 = Collective (cyan). Survival: all players team 0.

export type ModeId = 'tdm' | 'ctf' | 'koth' | 'conquest' | 'survival' | 'horde' | 'safehouse' | 'range';

/** Battlefield environments — the war spans the solar system. */
export type ThemeId = 'savanna' | 'starship' | 'asteroid' | 'europa' | 'titan' | 'triton';

export type ClassId = 'infantry' | 'heavy' | 'jump' | 'engineer' | 'medic' | 'infiltrator' | 'pathfinder' | 'ghost';

/**
 * Weapon ids are open strings: the hand-tuned core set (ar606, kuchler, caw,
 * rg2, ac_mk2, mml, gl, plasma, flamer, pistol, repair, medibeam, impulse,
 * emp, target_beacon, orbital_beacon, vehicle/turret/zombie weapons) plus the
 * generated arsenal in arsenal.ts (200+ ids like 'laser_maklov_2'). Table
 * integrity is enforced by tests, not the type system.
 */
export type WeaponId = string;

export type VehicleKind =
  | 'buggy' | 'tank' | 'apc' | 'skiff'
  | 'hoverboard'   // one-trooper personal hover deck — fast, fragile, unarmed
  | 'bike'         // recon bike — fastest ground vehicle, light MG
  | 'flyer'        // gunship flyer — soars over walls, plasma
  | 'transport'    // crewed transport craft — sensors/ECM/comms stations + 4 passengers
  | 'ambulance'    // field ambulance — heals soldiers around it, 2 stretcher seats
  | 'tunneler'     // tunneling machine — grinds through walls, glacially slow
  | 'emplacement'  // static emplacement gun — manned artillery, does not move
  | 'mech'         // bipedal assault walker — strides over low cover, stomps
  | 'boat';        // river gunboat — water-locked, fast on the channel, MG

/** Damageable vehicle subsystems. Crew stations correspond to the last three. */
export type SystemId = 'engine' | 'weapon' | 'sensors' | 'ecm' | 'comms';

export const SYSTEM_IDS: readonly SystemId[] = ['engine', 'weapon', 'sensors', 'ecm', 'comms'];

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** HUD/menu glyph — every weapon wears one (family default, core overrides) */
  icon?: string;
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
  /** shove applied to victims (impulse cannon) */
  knockback: number;
  sound: string;
  tracer: 'bullet' | 'shell' | 'rocket' | 'plasma' | 'rail' | 'flame' | 'beam' | 'acid' | 'none';
  /** arsenal family this weapon belongs to ('rifle', 'laser', 'mortar', …) */
  family?: WeaponFamily;
  /** Mk tier within the family (1..3) — drives the stat curve */
  tier?: number;
  /** special detonation instead of damage: emp burst, beacons, smoke/fire fields */
  payload?: 'emp' | 'target_beacon' | 'orbital' | 'smoke' | 'fire';
  /** landing this projectile pins the victim on every enemy screen for 5s (tag dart) */
  tagsTarget?: boolean;
  /** SECONDARY FIRE (right mouse) — the under-barrel surprise:
   *  burst = flame burp · skitter = charge on legs · tag = pin dart ·
   *  overcharge = dump `cells` clip rounds into one big shot */
  alt?: {
    kind: 'burst' | 'skitter' | 'tag' | 'overcharge';
    /** shots per life (ammo crates restock); overcharge ignores this and spends clip */
    ammo: number;
    cooldown: number;
    /** overcharge: clip rounds one alt shot costs */
    cells?: number;
  };
}

/** The arsenal's weapon families — Infantry Online's armory, rebuilt. */
export type WeaponFamily =
  | 'pistol' | 'rifle' | 'carbine' | 'smg' | 'shotgun' | 'slugger' | 'laser'
  | 'lmg' | 'hmg' | 'at_rocket' | 'ap_rocket' | 'mortar' | 'artillery'
  | 'scatter' | 'sonic' | 'flamethrower' | 'grenade' | 'special';

export interface ClassDef {
  id: ClassId;
  name: string;
  desc: string;
  hp: number;
  speed: number; // units/s
  primary: WeaponId;
  secondary: WeaponId;
  ability: 'grenade' | 'jetpack' | 'turret' | 'heal' | 'cloak' | 'warp' | 'drone' | 'shield';
  abilityName: string;
  color: number;
}

export interface VehicleDef {
  kind: VehicleKind;
  name: string;
  hp: number;
  speed: number;
  turnRate: number; // rad/s
  /** '' = unarmed (hoverboard, ambulance, tunneler) */
  weapon: WeaponId;
  /** total seats = 1 driver + crew.length stations + passengers */
  seats: number;
  /** APC/transport acts as mobile spawn for its team (needs live comms) */
  mobileSpawn: boolean;
  radius: number;
  /** crosses water (skiff, hoverboard, flyer) */
  hover?: boolean;
  /** passes over walls and cover entirely (flyer) */
  flies?: boolean;
  /** rotor spool-up: seconds between the pilot boarding and liftoff (1–5s by airframe) */
  liftoffTime?: number;
  /** grinds T_WALL tiles into open ground as it moves (tunneler) */
  digs?: boolean;
  /** legs step over low cover — T_COVER doesn't block it; walls/water do (mech) */
  strider?: boolean;
  /** ability key slams the ground: AoE knockback + damage around the hull (mech) */
  stomps?: boolean;
  /** heals friendly soldiers within this radius (ambulance) */
  healRadius?: number;
  healRate?: number;
  /** crew stations after the driver seat, in seat order */
  crew?: readonly ('gunner' | 'sensors' | 'ecm' | 'comms')[];
  /** hp per damageable subsystem */
  systemHp?: number;
  /** cannot move at all (emplacement gun) */
  immobile?: boolean;
  /** water-locked: moves ONLY on water tiles — land is its wall (gunboat) */
  boat?: boolean;
}

/** Per-subsystem damage record: hp remaining for each SystemId. */
export type VehicleSystems = Record<SystemId, number>;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type SoldierKind = 'human' | 'bot' | 'zombie' | 'spitter' | 'brute' | 'sprinter' | 'bomber' | 'stalker' | 'scientist';

export type ZedKind = 'zombie' | 'spitter' | 'brute' | 'sprinter' | 'bomber' | 'stalker';

const ZED_KINDS: ReadonlySet<string> = new Set(['zombie', 'spitter', 'brute', 'sprinter', 'bomber', 'stalker']);

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
  /** SECONDARY FIRE (right mouse): shots left in the primary's under-barrel */
  altAmmo: number;
  nextAltAt: number;
  /** under-barrel flame burst keeps spewing until this clock */
  altBurstUntil: number;
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
  // trophy ledger — feeds the post-match awards
  /** farthest kill, in world units */
  longestKill: number;
  /** vehicles destroyed */
  vehicleKills: number;
  /** hit points healed into allies */
  healGiven: number;
  // sci-fi kit
  pushX: number;      // knockback impulse, decays
  pushZ: number;
  nextWarpAt: number; // shared cooldown for warps/gates/lifts (stalkers: blink timer)
  orbitals: number;   // orbital-strike beacons held (pickup)
  manpads: number;    // shoulder-fired SAM rounds left this life (manpads equipment)
  /** issued plate — absorbs damage before hp and does NOT heal back; restored
   *  on respawn. Granted by armor equipment (vest +25, power armor +60). */
  armor: number;
  maxArmor: number;
  /** spawn protection (55B): immune until this sim time, capped ~5s — broken
   *  the instant the soldier takes any hostile action */
  protectedUntil: number;
  /** Proving Grounds target dummy — stands there, takes it, never acts */
  dummy?: boolean;
  /** who last killed this soldier (-1 = nobody/self/environment) — the killcam
   *  frames the duel between victim and killer instead of just the corpse */
  lastKillerId: number;
  /** which storey this soldier stands on: 0 ground, 1 the grid2 layer (§8.4) */
  floor: number;
  /** equipped gear ids (see EQUIPMENT in data.ts) — chosen at deploy, max 2 */
  equipment: string[];
  /** medikit auto-trigger armed (once per life) */
  medikitReady: boolean;
  // §4.3 down-not-out — death's middle state (humans and bots only)
  /** on the ground bleeding out: alive for mode purposes, out of the fight */
  downed: boolean;
  /** sim time the bleed-out clock runs out (0 while upright) */
  downedUntil: number;
  /** who put them down — credited with the kill if the clock, not a finisher, ends it */
  downedBy: number;
  /** seconds of teammate E-hold accumulated toward a field revive */
  reviveProgress: number;
  /** id of the downed teammate this soldier is hauling right now (-1 = none) */
  draggingId: number;
  /** psi-scanner next pulse */
  nextPsiAt: number;
  /** repair-kit next use */
  nextRepairAt: number;
  // bot brain scratch
  botGoal?: Vec3 | null;
  botRepathAt?: number;
  botTargetId?: number;
  botStrafeDir?: number;
  /** next sim time this bot may press E (one polite press, not a woodpecker) */
  botUseAt?: number;
  /** stuck detection: when this bot's ride stopped making progress */
  botStuckAt?: number;
  /** stuck detection: position sampled at the last movement check */
  botLastX?: number;
  botLastZ?: number;
  botMoveCheckAt?: number;
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
  seats: number[]; // soldier ids, -1 empty; [0] = driver, then crew stations, then passengers
  nextFireAt: number;
  alive: boolean;
  respawnAt: number;
  padPos: Vec3;
  stunnedUntil: number; // EMP
  /** subsystem hp — every crew position/system has its own damage record */
  systems: VehicleSystems;
  /** tunneler: sim time it may next grind a wall tile */
  nextDigAt: number;
  /** tunneler: running deep — silent and off-minimap, but slower and unable to dig */
  burrowed?: boolean;
  /** ambulance: next heal pulse */
  nextHealAt: number;
  /** flyer: IR decoy flares left this life (heat-seeker counter) */
  flares: number;
  /** flyer: sim time the rotors finish spooling — airborne (and mobile) after this */
  spoolUntil: number;
  // ---- requisition (§8.1a) — the manifest that makes hulls feel OWNED ----
  /** soldier id whose name is on the manifest (-1 = still the pad's hull) */
  requisitionedBy: number;
  /** index of the home pad in map.vehiclePads (-1 = spawned padless) */
  padId: number;
  /** the pad's owning team — a stolen hull is reissued under this flag */
  padTeam: Team;
  /** sim time the last crew member stepped out; 0 = never abandoned */
  abandonedAt: number;
  /** seconds an enemy thief has held E beside the hull (snaps to 0 if they quit) */
  hotwireProgress: number;
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
  /** heat-seeker: vehicle this missile is steering toward */
  homingVehicleId?: number;
  /** heat-seeker: flare gadget that seduced it off the aircraft */
  homingFlareId?: number;
}

export interface Pickup {
  id: number;
  type: 'medkit' | 'ammo' | 'flamer' | 'energy' | 'orbital';
  pos: Vec3;
  respawnAt: number; // 0 = available
  oneShot?: boolean; // supply-pod loot vanishes after use
}

export type GadgetType =
  | 'warpA' | 'warpB' | 'target_beacon' | 'orbital' | 'shield' | 'drone' | 'supply_pod'
  | 'skitter'      // GL-40 alt-fire: a charge on legs that runs at the nearest enemy
  | 'camera'       // deployable spy camera — pings enemies in view for its team
  | 'smoke_field'  // smoke cloud — hides soldiers inside from minimap + pings
  | 'fire_field'   // phosphorus burn — damage over time to enemies inside
  | 'flare';       // burning IR decoy dropped by a flyer — seduces heat-seekers

/** Deployed sci-fi tech: beacons, domes, drones, pods. */
export interface Gadget {
  id: number;
  type: GadgetType;
  team: Team;
  ownerId: number;
  pos: Vec3;
  hp: number;
  maxHp: number;
  bornAt: number;
  expiresAt: number;  // Infinity = permanent until destroyed
  anchor?: Vec3;      // drone orbit center
  phase?: number;     // drone orbit angle
  /** FPV drone: steered by its owner (humans); bots keep the auto-orbit */
  piloted?: boolean;
  vel?: { x: number; z: number };
  yaw?: number;
  /** control-link strength 0..1 — drops with distance; the client draws static */
  signal?: number;
  /** link lost (range/EMP/gunfire) — the drone is falling out of the sky */
  crashing?: boolean;
  vy?: number;
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
    | 'announce' | 'match_over' | 'mine_planted'
    | 'warp' | 'blink' | 'emp' | 'orbital_strike' | 'gravlift'
    | 'beacon_planted' | 'gadget_destroyed' | 'pod_incoming' | 'pod_landed'
    | 'drone_crash'    // an FPV drone lost link and hit the ground
    | 'dig'            // tunneler ground a wall tile to rubble
    | 'system_damaged' // a vehicle subsystem went down
    | 'door'           // a door swung (open or shut) — E did it
    | 'doorhit'        // something is BANGING on a door — claws, blasts
    | 'doorbreak'      // a door gave way — splinters, planks, a hole
    | 'ladder'         // someone climbed between storeys
    | 'sparks'         // the breacher's drill met METAL — sparks, no progress
    | 'hacked'         // hacking kit converted an enemy turret
    | 'psi_ping'       // psi scanner found someone (HUD flashes the icon)
    | 'downed'         // a soldier hit the ground bleeding — not dead yet
    | 'revived';       // someone got them back on their feet
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
  /** which subsystem for 'system_damaged' */
  system?: SystemId;
  /** grid tile index for 'dig' */
  tile?: number;
  /** victim's class on 'death' (human/bot only) — picks the class death cry */
  classId?: ClassId;
  /** normalized fall direction on 'death' — the ragdoll tips this way */
  fallX?: number;
  fallZ?: number;
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
  /** cursor distance from the soldier — thrown items (frag, beacon, charge)
   *  land here, clamped to each item's max reach. Optional for old clients. */
  aimDist?: number;
}
