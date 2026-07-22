export type Team = 0 | 1; // 0 = United Front (amber), 1 = Collective (cyan). Survival: all players team 0.

export type ModeId = 'tdm' | 'ctf' | 'koth' | 'conquest' | 'survival' | 'horde' | 'safehouse' | 'science' | 'range' | 'paintball';

/** Battlefield environments — the war spans the solar system. */
export type ThemeId = 'savanna' | 'starship' | 'asteroid' | 'europa' | 'titan' | 'triton' | 'hardpan';

export type ClassId = 'infantry' | 'heavy' | 'jump' | 'engineer' | 'medic' | 'infiltrator' | 'pathfinder' | 'ghost';

/** Living Super Weapons (§21.6 / docs/ASCENDANTS.md). A Soldier carrying one
 *  of these is an LSW — not a class, an overlay: bigger, deadlier, its own
 *  brain, and it dies to ordinary guns. Grows as the roster ships. */
export type AscendantId = 'firebrand' | 'plaguebearer' | 'frostbite' | 'ragebeast' | 'titan' | 'voltstriker' | 'sniperhawk' | 'barrier' | 'reactor' | 'oblivion' | 'tremor' | 'magnetar' | 'wraith' | 'eclipse' | 'dominator' | 'riptide' | 'gravwarden' | 'chronos' | 'venatrix' | 'vanguard' | 'pyroclasm' | 'voidwalker' | 'crimson' | 'mirage' | 'blitz' | 'shadowstep' | 'specter' | 'pulse' | 'venom' | 'nightmare' | 'reaper' | 'crusher' | 'steelweaver' | 'overload' | 'phantom' | 'inferno' | 'stormcaller' | 'gargoyle' | 'leviathan' | 'cataclysm';

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
  | 'strikejet'    // V2 Vulture — air-to-ground jet. CANNOT HOVER.
  | 'interceptor'  // V2 Falcon — air-to-air jet. CANNOT HOVER.
  | 'aatrack'      // V3 Lance — ground-to-air homing launcher, paper-thin
  | 'bomber'       // V4 Anvil — slow heavy payload, needs an escort
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
  /** 10.1 FIRE MODE — the missing axis (absent = auto, today's behavior).
   *  single/pump fire on the trigger EDGE (one round per press — pump is a
   *  single with a working action, its cadence already in rof); burst2/3
   *  spend their whole n/rof cycle up front (n rounds at triple cadence,
   *  then the wait); double fires BOTH barrels on one press and pays 2/rof.
   *  Every mode is DPS-NEUTRAL by construction — the feel changes, the
   *  balance sheet doesn't. Bots bypass trigger discipline (a machine's
   *  finger taps perfectly). */
  fireMode?: 'single' | 'auto' | 'burst2' | 'burst3' | 'double' | 'pump';
  /** 10.1 row 178 — the MANUFACTURER, and with it the brand SIGNATURE: a
   *  firing behavior, not a stat curve. maklov = TRUE ISSUE (moving costs
   *  25% less accuracy) · kuchler = HOT HALF (the back half of the mag runs
   *  10% faster) · titan = CONCUSSIVE (every round shoves) · harkov =
   *  MATCH-GRADE (no ballistic falloff — the round carries) · ceres = DEEP
   *  POCKETS (special pools pay 25% less per reload) · kamenel = HOT LOADS
   *  (+15% muzzle speed). Core class weapons carry NO brand — bots and the
   *  threat-measure arena never feel any of this. */
  brand?: string;
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
  /** Close-combat identity: blood leaves a wound, pierce threads issued plate,
   * force converts the weapon's knockback into body displacement. */
  meleeTrait?: 'blood' | 'pierce' | 'force';
  bleedSeconds?: number;
  bleedDps?: number;
  /**
   * A TRAINING ROUND. It settles a fight and marks a man, and it does not
   * touch architecture — no breaching, no rubble, no doors.
   *
   * Paint carries damage 999 so it rides the overkill rule and skips the
   * down-and-crawl (nobody bleeds in the yard). But every wall in the game is
   * breached by `damage >= 100`, so that same 999 made a marker the most
   * destructive weapon in the game: one ball turned masonry to rubble, a
   * second erased it, and the Lobber flattened everything within 3.3u. The
   * yard was demolishing itself.
   *
   * The fix is not a smaller number — the 999 is load-bearing. It is saying
   * out loud what a training round IS.
   */
  training?: boolean;
  sound: string;
  tracer: 'bullet' | 'shell' | 'rocket' | 'plasma' | 'rail' | 'flame' | 'beam' | 'acid' | 'canister' | 'frag' | 'paint' | 'none';
  /** arsenal family this weapon belongs to ('rifle', 'laser', 'mortar', …) */
  family?: WeaponFamily;
  /** Mk tier within the family (1..3) — drives the stat curve */
  tier?: number;
  /** special detonation instead of damage: emp burst, beacons, smoke/fire fields,
   *  a gravity well that YANKS a squad into a cluster, or a STICKY plasma charge */
  payload?: 'emp' | 'target_beacon' | 'orbital' | 'smoke' | 'fire' | 'concussion' | 'grav' | 'plasma';
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
  // ── PROJECTILE EFFECTS (composable; consumed in world.ts projectile step) ──
  /** STICKY (Robert): no bounce, no roll — it ADHERES to the first thing it
   *  touches (wall, ground, vehicle, or body) and detonates on its fuse from
   *  right there. A stuck body carries the charge until it blows. */
  sticky?: boolean;
  /** passes through n bodies + n penetrable-cover tiles before dying */
  pierce?: number;
  /** ignores plate: the round's damage lands on flesh (red number through armor) */
  pierceArmor?: boolean;
  /** bounces off metal/ice up to n times (glancing only), −30% dmg per bounce */
  ricochet?: number;
  /** beam profile — how tracer:'beam' behaves and renders */
  beam?: 'zap' | 'lance' | 'charge' | 'hose' | 'ricochet';
  /** hold to charge: after t seconds the shot deals ×mul and reaches full profile */
  charge?: { t: number; mul: number };
  /** §BEAMS (row 188) THE HELD STREAM — LSW arms only, soldiers never carry
   *  one. While the trigger is held the beam CONNECTS: a per-tick ray pours
   *  dps into the first wall or body on the aim line. No clip, no discrete
   *  shots — the governor is HEAT: `sustain` seconds of continuous pour
   *  jams the emitter for `jam` seconds. */
  held?: {
    dps: number; sustain: number; jam: number;
    /** LANCE: the stream DRILLS — keeps walking through up to n bodies
     *  (each drinks full dps·dt) before it stops. Walls always stop it. */
    pierce?: number;
    /** TORRENT: the flood — catch radius around the ray (default 1.1u). */
    catchR?: number;
    /** PRISM: the split — the first body becomes a NODE; up to `count`
     *  other enemies within `radius` (clear line from the node) each drink
     *  `frac` of the dps. The node itself still drinks full. */
    prism?: { count: number; frac: number; radius: number };
  };
  /** on death, burst into k submunitions (~40% dmg each) that bounce */
  cluster?: number;
  /** on soldier-hit, arc to n nearest extra enemies */
  chain?: number;
  /** links to the struck target (pull / leash) */
  tether?: boolean;
  /** flies to range then returns, able to hit on both legs */
  boomerang?: boolean;
  /** sets flammable tiles (grass, wood houses) alight — needs the fire system */
  ignite?: boolean;
  /** leaves a lingering cloud on impact */
  gasAfter?: { kind: 'caustic' | 'poison' | 'singularity' | 'fear'; r: number; life: number };
  /** melee/leap LAND aoe radius (non-projectile power; read by stepLsw) */
  shockwave?: number;
}

/** The arsenal's weapon families — Infantry Online's armory, rebuilt. */
export type WeaponFamily =
  | 'pistol' | 'rifle' | 'carbine' | 'smg' | 'shotgun' | 'slugger' | 'laser'
  | 'lmg' | 'hmg' | 'at_rocket' | 'ap_rocket' | 'mortar' | 'artillery'
  | 'scatter' | 'sonic' | 'flamethrower' | 'grenade' | 'special' | 'melee' | 'melee_weapon'
  | 'lsw'; // signature arms — one god each, never issued, never dropped

export interface ClassDef {
  id: ClassId;
  name: string;
  desc: string;
  hp: number;
  speed: number; // units/s
  /** M1: stamina/energy regen multiplier — the stat the tank is locked behind.
   *  Absent = 1. Pathfinders recover like athletes; heavies like furniture. */
  energyRegen?: number;
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
  /**
   * V2 FIXED WING (Robert: "what if there were a jet that COULDN'T hover?").
   * A jet carries a MINIMUM AIRSPEED: let go of the throttle and it does not
   * stop, it keeps flying. That single rule is the whole feel of the old
   * combat flight games — you make PASSES, you never park in the sky.
   * Value = the fraction of top speed it can never drop below.
   */
  minAirspeed?: number;
  /** V2: how hard it banks into a turn (visual roll, radians at full turn) */
  bankAngle?: number;
  /** V3: fires homing missiles at aircraft (AA track, SAM turret) */
  antiAir?: boolean;
  /**
   * GRIP RATE (Robert: "the hoverboard's controlled too well — it should be a
   * little bit more slippery, and fun"). Every hull used to rebuild its
   * velocity from its facing every tick, which makes lateral momentum
   * mathematically impossible — steering perfectly locked to the nose.
   * With `slip` set, velocity CHASES the nose at this rate instead (1/s):
   * turn hard at speed and the hull keeps sliding the way it was going.
   * Absent = rails, like always.
   */
  slip?: number;
  /**
   * B1 THE WAR BUDGET (Robert: "you got all these vehicles… what if there
   * was like a budget on each side?"). What this hull is worth on the war
   * ledger — losing it charges the team's account. Requisition-scale (the
   * same currency gods cost), not hit points.
   */
  cost?: number;
  /** V4: drops a stick of bombs straight down along its flight path */
  bombs?: number;
  /** J1: secondary trigger weapon (the Vulture's strafing MG). The bomber
   *  never gets one — its alt-fire is the Cradle. */
  altWeapon?: WeaponId;
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

export type SoldierKind = 'human' | 'bot' | 'dog' | 'zombie' | 'spitter' | 'brute' | 'sprinter' | 'bomber' | 'stalker' | 'scientist' | 'scraprat' | 'junkhound' | 'weaver' | 'ravager';

export type ZedKind = 'zombie' | 'spitter' | 'brute' | 'sprinter' | 'bomber' | 'stalker';

const ZED_KINDS: ReadonlySet<string> = new Set(['zombie', 'spitter', 'brute', 'sprinter', 'bomber', 'stalker']);

export function isZed(k: SoldierKind): k is ZedKind {
  return ZED_KINDS.has(k);
}

/** THE IRON EATERS (DD §20, finish-list 12): junk that learned a body plan.
 *  Where the Outbreak eats flesh, these eat METAL -- and they molt: plated
 *  scrap sheds under fire, then the exposed frame takes DOUBLE and runs hot. */
export type IronKind = 'scraprat' | 'junkhound' | 'weaver' | 'ravager';

const IRON_KINDS: ReadonlySet<string> = new Set(['scraprat', 'junkhound', 'weaver', 'ravager']);

export function isIron(k: SoldierKind): k is IronKind {
  return IRON_KINDS.has(k);
}

export type K9Order = 'heel' | 'sic' | 'stay';
export type K9Command = 'sic' | 'stay';

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
  energy: number;     // jetpack fuel / cloak charge / ability resource — AND the
                      // stamina tank (M1): sprint drains it, dash/roll bite it
  /** M1 movement verbs — all transient, renderer-dressed */
  sprinting?: boolean;
  nextDashAt?: number;
  dashUntil?: number;
  rollUntil?: number;
  rollDir?: number;      // +1 left, -1 right (relative to facing)
  slideUntil?: number;   // M1 SLIDE: sprint committed to the deck — low + skidding
  /** M1 RAGDOLL: past the knockback threshold the body is luggage until this */
  ragdollUntil?: number;
  /** M4: an LSW's own regen rate, when its god overrides the class stat */
  lswRegen?: number;
  /** M5 THROW-AND-RETRIEVE: the gadget id of this soldier's axe while it is
   *  in the ground. Absent = the axe is on his back, ready to throw. */
  axeId?: number;
  /** M5: the axe is flying home — no second recall until it lands */
  axeRecallAt?: number;
  /** Sim time this body stops taking physics. Set at death so the corpse can
   *  spend the shove that killed it instead of freezing where it stood. */
  corpseUntil?: number;

  alive: boolean;
  respawnAt: number;  // sim time when respawn allowed
  weaponIdx: number;  // 0 primary, 1 secondary, 2 special pickup
  weapons: WeaponId[];
  clip: number[];
  reserve: number[];
  reloadUntil: number;
  nextFireAt: number;
  /** CHARGE (projectile-fx): world time the current charge-weapon hold began,
   *  undefined when not winding up. The release scales dmg by charge.mul. */
  chargeStart?: number;
  /** SECONDARY FIRE (right mouse): shots left in the primary's under-barrel */
  altAmmo: number;
  nextAltAt: number;
  /** under-barrel flame burst keeps spewing until this clock */
  altBurstUntil: number;
  grenades: number;
  nextGrenadeAt: number;
  /** THE GRENADE BAG (Robert: "expand our grenade selection"): smoke and
   *  incendiary pouches alongside the class G-payload. `nadeSel` picks what
   *  the G key throws — 0 = the class default (frag/mine/beacon/…),
   *  1 = smoke, 2 = fire. X cycles, skipping empty pouches. Optional so
   *  old snapshots replicate free (absent reads as 0). */
  smokes?: number;
  firebombs?: number;
  /** THE CONCUSSION BAG: rattle-nades — heavy knockback, ringing ears
   *  (a fire-lock stagger), and almost no lethal bite. X cycles to them. */
  concs?: number;
  /** the new tech pouches (Robert): the singularity, the plasma stick, and the
   *  planted demolition timer. X cycles to them, G throws/plants. */
  gravs?: number;
  plasmas?: number;
  timebombs?: number;
  nadeSel?: number;
  cloaked: boolean;
  vehicleId: number;  // -1 when on foot
  seat: number;
  enteredVehicleAt: number; // guards same-keypress enter→exit
  kills: number;
  /** per-life kill streak (reset on death) — feeds RAMPAGE/SHUTDOWN callouts */
  streak?: number;
  /** GOD MODE (testing): untouchable, and may wear any LSW on demand */
  god?: boolean;
  /** delight: has the LAST-STAND clutch already been announced this life? */
  lastStandSaid?: boolean;
  deaths: number;
  score: number;
  carryingFlag: Team | -1;
  nextAbilityAt: number;
  /** K9 handler pairing — the dog's handler id. -1 for everyone who isn't a dog. */
  ownerId: number;
  /** Handler-authored K9 order. Optional keeps old snapshots and recordings valid. */
  k9Order?: K9Order;
  /** Index into map.houses while clearing a building. */
  k9BuildingId?: number;
  /** Validated world point used to select the assigned building. */
  k9OrderPos?: Vec3;
  /** Exact point a STAY dog returns to after a shove. */
  k9StayAnchor?: Vec3;
  /** Current simulation-selected hostile; clients never nominate this id. */
  k9TargetId?: number;
  /** Packed floor*GRID²+tile index of the closed door stopping the dog. */
  k9Door?: number;
  /** Rate limit for blocked-door bark/status feedback. */
  k9NextBarkAt?: number;
  /** Deterministic index into the assigned building's room sweep. */
  k9SearchIndex?: number;
  /** When the dog first found no uncleared room or hostile. */
  k9ClearSince?: number;
  // trophy ledger — feeds the post-match awards
  /** farthest kill, in world units */
  longestKill: number;
  /** DEATH-DATA: sim time this print stood up — powers time-alive on death
   *  (the spawn-kill branch of the killcam director) */
  spawnedAt?: number;
  /** the weapon that landed the killing blow — the killcam names it */
  lastKillWeapon?: WeaponId;
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
  /** a dummy that REGENERATES (Robert: "the dummies don't regenerate") — pops
   *  back up at `dummyHome` a few seconds after it drops, so a weapon-test
   *  range never runs out of targets. Non-respawning dummies stay down. */
  respawns?: boolean;
  dummyHome?: Vec3;
  /** who last killed this soldier (-1 = nobody/self/environment) — the killcam
   *  frames the duel between victim and killer instead of just the corpse */
  lastKillerId: number;
  /** which storey this soldier stands on: 0 ground, 1 the grid2 layer (§8.4) */
  floor: number;
  /** brief stair debounce; direction records an intentional reversal. */
  stairUntil?: number;
  stairDirection?: -1 | 1;
  /** remembers travel through a multi-storey ladder shaft until an endpoint. */
  ladderDirection?: -1 | 1;
  /** rung-climb movement lock; ladders are deliberate, unlike walked stairs. */
  ladderUntil?: number;
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
  /** jetpack burned dry — no relight until energy recovers to 35 (the
   *  flight economy: fly, land, breathe — never cross the map in one hop) */
  jetSpent?: boolean;
  /** the BREATHER: keeps sliding forward while a jump trooper is off the
   *  deck, so for JET_BREATHER after touchdown the tank refuses to flow —
   *  landing is a commitment, not a trampoline bounce between hops */
  jetRestUntil?: number;
  /** §13 AMMO DIAGNOSTICS (measure before the 25% reserve cut) — per-match
   *  counters the blackbox aggregates. Mortals only; claws never count. */
  statShots?: number;      // rounds that left a mag
  statReloads?: number;    // reloads STARTED (manual + auto-on-empty)
  statDry?: number;        // trigger pulled on a truly empty gun
  nextDryAt?: number;      // rate-limit clock so a held trigger counts ~2/s
  statSecondaryT?: number; // seconds spent holding the sidearm (slot 2)
  /** 10.1 FIRE MODES — the trigger bookkeeping. trigHeld is the rising-edge
   *  latch (single/pump/double/burst fire per PRESS); the burst runner
   *  delivers rounds 2..n on its own clock and closes the n/rof cycle. */
  trigHeld?: boolean;
  burstLeft?: number;
  nextBurstShotAt?: number;
  burstStartAt?: number;
  /** M1 CHARGED LEAP in flight — while true the arc is BALLISTIC: input
   *  cannot steer it (the movement block skips its velocity overwrite).
   *  Cleared the tick the ground clamp zeroes vel.y (either floor). */
  leaping?: boolean;
  /** the leap landed LOUD: until this time the soldier rings on recon
   *  (merged into `pinged` each tick) and counts as noise to dormant ears */
  loudUntil?: number;
  /** THE FLASHLIGHT (§10): T toggles. A lit torch extends this eye's CONE
   *  (perception TORCH_MULT) and the local darkness beam — but light gives
   *  you away: dormant sprinters wake on it at twice their sight radius. */
  torchOn?: boolean;
  /** §11.3 SEPARATE MAGAZINES BY TYPE: per-type SPECIAL-round pools, spent
   *  by reloads while that type is selected (ball rides the classic
   *  reserve). Created lazily from AMMO_INFO pool sizes; ammo crates
   *  refill them. An empty pool falls the selector back to ball, loudly. */
  ammoPools?: Partial<Record<NonNullable<Soldier['ammoType']>, number>>;
  /** this soldier IS a Living Super Weapon (§21.6). Rides the wire free via
   *  the snapshot spread law — the renderer and brain read it, the sim
   *  treats it as a Soldier with a big HP pool and a special step. */
  ascendant?: AscendantId;
  /** LSW ability cadence — next time its secondary is off cooldown */
  nextLswAt?: number;
  /** piloted LSW (§7): next time the Q-key signature is off cooldown */
  nextLswActiveAt?: number;
  /** Reactor's overcharge: while set and unexpired, this soldier's `rageMul`
   *  is a borrowed damage/speed boost that burns out at this sim time. */
  overchargeUntil?: number;
  /** Dominator's psychic link (§ finale): soldiers sharing this group id and
   *  an unexpired `psiLinkUntil` split each other's pain — hurt one, hurt all. */
  psiLinkId?: number;
  psiLinkUntil?: number;
  /** Mirage's decoys: this soldier is an ILLUSION wearing the id'd Mirage's
   *  face — one hit pops it, it makes no footsteps, dogs are never fooled. */
  decoyOf?: number;
  /** Nightmare's BLIND: until this sim time these eyes see nothing — a
   *  blinded bot cannot acquire targets. Ears still work. */
  blindUntil?: number;
  /** Reaper's MARK: while unexpired, the marker's own blows land DOUBLE on
   *  this soldier — and the victim knows they are hunted. */
  markedBy?: number;
  markedUntil?: number;
  /** Gravity Warden's REVERSE GRAVITY: until this sim time the soldier floats
   *  (~2.2u up, ground control nearly gone) — but CAN STILL SHOOT. The drop
   *  staggers the aim once on landing. */
  liftedUntil?: number;
  /** Chronos's TEMPORAL ECHO: a ~3s breadcrumb trail of where he stood (the
   *  echo point GLOWS — camp it), and the once-per-fight latch. */
  lswTrail?: { x: number; z: number }[];
  lswFlagA?: boolean;
  /** MACHINE POSSESSION of a BOT (§4.4 #4, Phantom's ride): a timed take —
   *  team flips for `possessedUntil - now`, expiry hands the chassis home,
   *  EMP evicts instantly. NEVER a human — possessBot refuses flesh. */
  possessedBy?: number;
  possessedUntil?: number;
  origTeam?: Team;
  /** DUCK (finish-list 18): the held stance -- half speed, deep grass hide. */
  crouching?: boolean;
  /** THE GUARD (OUTBREAK-SPEC §12): held brace. Blocks frontal melee STRIKEs
   *  (heavy damage + knockback cut) and PARRIES them — a blocked strike
   *  staggers and shoves the attacker (GUARD beats STRIKE). Slows you, drains
   *  stamina, and lowers your gun (no fire, no strike of your own while up). */
  guarding?: boolean;
  /** THE GRAPPLE (OUTBREAK-SPEC §12/§14): world time this body is PINNED until
   *  by a grab. A grab bypasses (and drops) a GUARD — GRAPPLE beats GUARD. The
   *  held body is rooted and can only STRUGGLE (mash move/fire) to break early;
   *  it is NOT damage-shielded — a pinned enemy can be punished. Reuses
   *  `struggle` for the break meter (a body is never both encased and grabbed). */
  grabbedUntil?: number;
  /** who threw the grab (credit + the hold's tether anchor). */
  grabbedBy?: number;
  /** the body YOU currently hold in a rear pin — a second grapple executes the
   *  §14.2 takedown on it (grabber-side link; self-corrects if the pin lapses). */
  grabbingId?: number;
  /** brief post-escape window during which this body can't be re-grabbed — no
   *  instant re-clinch / chain-lock after you fight free. */
  grabImmuneUntil?: number;
  /** §15 CONTROL STRUGGLE — the rear-grab contest. Set on the VICTIM of a
   *  rear pin (people only, never zeds/gods): a Break Needle sweeps the
   *  shared track; the attacker steers the Control Zone; the defender
   *  confirms (Z) while the needle overlaps it. Best-of-three — defender
   *  takes 2 → fights free; attacker takes 2 → `locked`, and only a LOCKED
   *  rear pin accepts the §14.2 finisher. Front pins never carry one. */
  /** §BEAMS held-stream state: heat 0..1 (builds while pouring, cools when
   *  not), the jam lockout, and the renderer's stream window (re-stamped
   *  every pouring tick; the stream dies ~0.1s after the trigger lifts). */
  beamHeat?: number;
  beamJamUntil?: number;
  beamingUntil?: number;
  /** §14.2 CHOKE (outcome menu): victim-side progress toward the silent
   *  capture (0..1) and the attacker-side link. Both transient — cleared on
   *  release, interrupt (the choker taking damage), death, or reset. */
  chokeProgress?: number;
  chokingId?: number;
  /** §14.2 HUMAN SHIELD: set on the VICTIM while a locked-pin holder uses them
   *  as cover — hauled to the holder's front, and frontal fire aimed at the
   *  holder redirects into this body. Transient; cleared with the hold. */
  humanShield?: boolean;
  ctrlStruggle?: {
    round: number; attWins: number; defWins: number;
    /** sim-time the current round's needle started — needle position is a
     *  pure function of (anchor, time, round); HUD reuses ctrlNeedlePos */
    anchor: number; roundEndsAt: number;
    zoneC: number; zoneW: number; locked?: boolean;
  };
  /** SPRINTER DORMANCY (OUTBREAK-SPEC §7.1): a sprinter lies still and slow
   *  until woken by proximity, line-of-sight, or noise — then it never sleeps
   *  again. Only ever set on kind 'sprinter'. */
  dormant?: boolean;
  /** THE SQUAD (§15, finish-list #14): the fireteam this soldier deploys
   *  with — 2-4 bodies who share a spawn and read each other. Offline your
   *  friendly bots ARE your squad. Rides the wire free. */
  squadId?: number;
  /** MOVEMENT DOCTRINE: the leaper's next allowed jump, and the
   *  blink-walker's next hop — shared verbs driven from stepLsw. */
  nextLeapAt?: number;
  nextBlinkAt?: number;
  /** TRUE FLIGHT (§4.4 #5): the commanded altitude for a flying LSW — the
   *  body climbs toward it; above the wall tier the grid yields. Undefined
   *  or 0 = grounded. Small arms live at chest height: descent is exposure. */
  flightAlt?: number;
  /** Gargoyle's SHRIEK→SLAM telegraph: the dive resolves at `diveAt` on the
   *  marked point — the scream buys everyone under it the dodge window.
   *  (Inferno reuses diveAt as "committed-low until".) */
  diveAt?: number;
  diveX?: number;
  diveZ?: number;
  /** Gargoyle's PERCH: the blocking tile he's clinging to — half damage
   *  while it stands; collapse the tile (DESTRUCTION) and he falls stunned. */
  perchTile?: number;
  /** Stormcaller's LIGHTNING STORM: bolts fall inside r14 of (stormX,stormZ)
   *  until stormUntil — BOTH SIDES eat them; eaves (wall-adjacent tiles)
   *  shelter. nextBoltAt paces the strikes. */
  stormX?: number;
  stormZ?: number;
  stormUntil?: number;
  nextBoltAt?: number;
  /** THE ICE BLOCK (§21.6, shared: Frostbite + Venatrix). Encased alive: a
   *  real 1-tile block that stops movement AND shots both ways. sim-time the
   *  ice fully forms free is `encasedUntil`; teammates shatter it early by
   *  shooting it. While encased the soldier takes NO other damage — freezing
   *  their star both removes AND protects him; timing is the skill. */
  encasedUntil?: number;
  /** who put you in the ice — so a death inside the block is credited to the
   *  hand that froze you, not to nobody and not to a stale previous killer */
  encasedBy?: number;
  /** accumulated struggle: rises while the encased soldier feeds move/fire
   *  input, breaks the ice at 1 (~4s of mashing) but exits at heavy HP cost */
  struggle?: number;
  /** Ragebeast (§21.6): rampage multiplier on move speed + outgoing damage,
   *  climbs as his HP falls. 1 = unwounded. Refreshed every tick by stepLsw. */
  rageMul?: number;
  /** VO bookkeeping: kills at the moment of ascension (per-life milestones
   *  count from here) and the once-per-life bloodied-line latch */
  lswKillsBase?: number;
  lswLowSaid?: boolean;
  /** psi-scanner next pulse */
  nextPsiAt: number;
  /** repair-kit next use */
  nextRepairAt: number;
  // melee swing state machine: WINDUP → STRIKE → RECOVER (see world.startMelee)
  /** sim time the in-flight swing lands; 0 = no swing in the air */
  meleeStrikeAt: number;
  /** swing direction, locked at windup start — step out of THIS arc to dodge */
  meleeYaw: number;
  /** weapon that will land at strike time ('' when idle) */
  meleeWeapon: WeaponId;
  /** IMPACT CHARGE (OUTBREAK-SPEC §13): how long the STRIKE has been HELD, in
   *  charge units (1.0 = maximum, >1.0 = overcharged). Builds while meleeHold,
   *  spent on release. Absent/0 = a tap, which is a plain quick strike. */
  meleeCharge?: number;
  /** the damage multiplier captured from the charge at commit, carried into
   *  resolveMeleeStrike and reset there. Undefined on a claw = ×1. */
  meleeChargeMul?: number;
  /** Cutting wound state, credited to the weapon and attacker that opened it. */
  bleedingUntil?: number;
  bleedNextAt?: number;
  bleedSourceId?: number;
  bleedWeapon?: WeaponId;
  // bot brain scratch
  botGoal?: Vec3 | null;
  botRepathAt?: number;
  botTargetId?: number;
  botStrafeDir?: number;
  /** opt #5 (S4): the cached strategic objective + when it next recomputes +
   *  the carry state it was computed under. objectiveFor is 25% of the tick
   *  from O(S) scans it runs every frame; the goal only matters at ~2-4 Hz. */
  botObjective?: Vec3 | null;
  botObjAt?: number;
  botObjFlag?: number;
  /** THE OUTBREAK (OUTBREAK-SPEC §4): internal infection 0-100. Damage and
   *  infection are SEPARATE — plate can stop the tissue damage and still be
   *  contaminated. ≥40 at death books the corpse on the reanimation clock. */
  viralLoad?: number;
  /** THE OUTBREAK (OUTBREAK-SPEC §11): the loaded ammunition TYPE, cycled with
   *  B (ball → AP → INC → TRC → SUB → EXP → BNR → ball). 'ball' is the absent
   *  default. 'ap' threads plate; 'inc' burns corpses + savages infected;
   *  'trc' marks the target + is loud; 'sub' is quiet but short & weak; 'exp'
   *  maws unarmored flesh but wilts on armor/undead; 'bnr' is chemical corpse
   *  denial without fire, at low direct damage. */
  ammoType?: 'ap' | 'inc' | 'trc' | 'sub' | 'exp' | 'bnr';
  /** next sim time this bot may press E (one polite press, not a woodpecker) */
  botUseAt?: number;
  /** stuck detection: when this bot's ride stopped making progress */
  botStuckAt?: number;
  /** stuck detection: position sampled at the last movement check */
  botLastX?: number;
  botLastZ?: number;
  botMoveCheckAt?: number;
  /** per-LIFE personality salt, rolled at spawn (−1 | 0 | 1): lane bias,
   *  indoor posting, ride appetite — each life tries something different
   *  (Robert's respawn-variety ask) */
  botLifeSeed?: number;
  /** fresh off the pad until this time — the window where a bot considers a
   *  ride for the long trip back instead of jogging the same lane again */
  botFreshUntil?: number;
  /** the floor this bot's route is trying to reach (ladder IQ): set when a
   *  repath crosses storeys, cleared the moment the boots arrive — pressing
   *  E stops the instant it's satisfied, which is the ping-pong guard */
  botWantFloor?: number;
  /** aim discipline: the enemy id this bot currently has its gun on, and the
   *  sim time it's allowed to open fire on a FRESHLY-acquired one (reaction
   *  delay) — so a bot doesn't corner-peek headshot the same tick it sees you */
  botAcqId?: number;
  botAcquireAt?: number;
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
  /** V4: the Anvil's remaining iron, and whether the Cradle is still aboard */
  bombLoad?: number;
  nukeAboard?: boolean;
  /** J1 THE SKY HAS FLOORS: discrete altitude band (0 = on the deck, 1-3 in
   *  the air). Q climbs, E dives, and at band 0 the E key becomes the door.
   *  Continuous height is unreadable from a top-down camera; a BAND can be
   *  drawn. 0/absent for anything that doesn't fly. */
  band?: number;
  /** W5.1: the crash-scrape rate limit — a band-1 hull grinding a building
   *  takes speed-scaled damage at most once per half-second */
  nextCrashAt?: number;
  /** J1: the alt-fire weapon's own cadence clock (Vulture strafing MG) */
  nextAltFireAt?: number;
  /** J1: afterburner lit this tick — the renderer scales the flame off it */
  burnerOn?: boolean;
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
  /** Plaguebearer's infection: while set, a MOVING hull trails poison. The
   *  crew chooses — abandon the tank, or drive the plague wagon. An
   *  engineer's field repair cleanses it. */
  infectedUntil?: number;
  infectedTeam?: Team;
  nextInfectTrailAt?: number;
  /** MACHINE POSSESSION of a HULL (§4.4 #4, Phantom's ride): timed team
   *  flip — its guns serve the ghost, expiry hands it home, EMP evicts. */
  possessedBy?: number;
  possessedUntil?: number;
  origTeam?: Team;
  /** Volt Striker's OVERLOAD: at this sim time the hull detonates — UNLESS
   *  every crew member has bailed, in which case it fizzles. The 2s gamble. */
  overloadAt?: number;
  overloadBy?: number;
  overloadTeam?: Team;
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
  /** MACHINE POSSESSION (§4.4 #4): who holds this machine, until when, and
   *  whose it really is. Expiry or an EMP burst hands it back. Never humans. */
  possessedBy?: number;
  possessedUntil?: number;
  origTeam?: Team;
  origOwnerId?: number;
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
  /** J1 THE AIR FRAME: this round lives in the VEHICLE-speed frame — it
   *  scales by vehicleSpeedMul at launch, not projectileSpeedMul. Anything
   *  whose job is to catch an aircraft (homing AA) or that an aircraft fires
   *  in its own duels must share its target's scale, or the settings sliders
   *  shear the air war apart (at defaults 0.35 vs 0.8, jets outran their own
   *  rockets and no SAM could ever catch anyone). */
  airScaled?: boolean;
  homingVehicleId?: number;
  /** heat-seeker: flare gadget that seduced it off the aircraft */
  homingFlareId?: number;
  /** Ragebeast's flesh: the SOLDIER this glob hunts (turn-rate capped —
   *  sidestep hard and it overshoots). Target dead/encased = flies dumb. */
  homingSoldierId?: number;
  /** hand grenades BANK (Robert): walls reflect it instead of detonating it.
   *  Launcher shells never set this — a GL-40 round still eats the wall. */
  bounce?: boolean;
  /** the settle tick already rang once — a rolling grenade tings on arrival, not per frame */
  tinked?: boolean;
  /** STICKY grenade adhesion (Robert). Exactly one is set once it latches:
   *  `stuckTo` = a soldier it rides, `stuckVehicle` = a hull it rides, `stuckPos`
   *  = a fixed point on a wall/the ground. `stuckAt` starts the fuse. */
  stuckTo?: number;
  stuckVehicle?: number;
  stuckPos?: Vec3;
  stuckAt?: number;
  /** remaining body/cover pass-throughs (init from WeaponDef.pierce at launch) */
  pierce?: number;
  /** remaining ricochets (init from WeaponDef.ricochet at launch) */
  ricochet?: number;
  pierceArmor?: boolean;
  ignite?: boolean;
  /** THE OUTBREAK (OUTBREAK-SPEC §11): INCENDIARY ammunition. Burns corpses on
   *  impact (denies reanimation like a blast) and savages the undead (+bonus
   *  vs any ZedKind), at a soft-damage cost against the merely living. */
  incendiary?: boolean;
  /** OUTBREAK-SPEC §11: the hit-time ammunition rider — 'exp' (expanding: +vs
   *  bare flesh, −vs armor/undead), 'bnr' (bio-neutralizing: denies the corpse
   *  without fire), 'trc' (tracer: marks the struck target). AP/INC keep their
   *  own dedicated flags above. */
  ammo?: 'exp' | 'bnr' | 'trc';
  /** damage scalar carried by the round: charge boost × ricochet/penetrate decay */
  dmgMul?: number;
  /** ids already struck this flight — so a piercing round never double-hits one body */
  hit?: number[];
  /** boomerang: world time to flip the round back toward its owner (0 = not yet) */
  returnAt?: number;
  /** a cluster child — never re-clusters, so the burst can't recurse */
  submunition?: boolean;
}

export interface Pickup {
  id: number;
  type: 'medkit' | 'ammo' | 'flamer' | 'energy' | 'orbital' | 'weapon';
  pos: Vec3;
  respawnAt: number; // 0 = available
  oneShot?: boolean; // supply-pod loot vanishes after use
  /** LOOT (STATUS short-list): the gun a dead soldier dropped. Granted into
   *  the special slot on walk-over, or refills a matching carried gun. */
  weaponId?: WeaponId;
  /** battlefield hygiene: a dropped gun evaporates at this time */
  expiresAt?: number;
}

export type GadgetType =
  | 'warpA' | 'warpB' | 'target_beacon' | 'orbital' | 'shield' | 'drone' | 'supply_pod'
  | 'skitter'      // GL-40 alt-fire: a charge on legs that runs at the nearest enemy
  | 'camera'       // deployable spy camera — pings enemies in view for its team
  | 'smoke_field'  // smoke cloud — hides soldiers inside from minimap + pings
  | 'fire_field'   // phosphorus burn — damage over time to enemies inside
  | 'snap_trap'    // Venatrix: springs THE ICE BLOCK on whoever steps in (spot the glint)
  | 'flare'        // burning IR decoy dropped by a flyer — seduces heat-seekers
  | 'time_bomb'    // a planted demolition charge on a telegraphed countdown — then it levels the room
  | 'axe';         // M5 THE THROWN AXE — buried where it landed, waiting to be
                   // called back. It is a WEAPON on the ground, not a pickup:
                   // only its thrower can recall it, and it hurts on the way home.

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
  /** Barrier's reflect wall: while young (bornAt+2s) it throws approaching
   *  enemy fire back at whoever sent it instead of swallowing it. */
  reflect?: boolean;
  /** Vanguard's barricade: this dome swallows BOTH sides' rounds — his own
   *  wall can cage his own team. Placement is the skill. */
  bothSides?: boolean;
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
  /** SPIDER MINE: lies dormant until an enemy strays into its wake radius, then
   *  it POPS and SKITTERS them down (the vulture mine). Absent = a plain
   *  proximity mine. `awake` latches once woken; `yaw` steers the chase. */
  spider?: boolean;
  awake?: boolean;
  yaw?: number;
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
    | 'mine_wake'      // a spider mine woke and is skittering for a kill
    | 'warp' | 'blink' | 'emp' | 'orbital_strike' | 'gravlift'
    | 'grav_well'      // a singularity grenade opened a gravity well (the pull VFX)
    | 'plasma_stick'   // a plasma charge ADHERED to a body — the fuse is lit
    | 'bomb_planted' | 'bomb_beep' // a time bomb was set / its countdown ticks
    | 'beacon_planted' | 'gadget_destroyed' | 'pod_incoming' | 'pod_landed'
    | 'drone_crash'    // an FPV drone lost link and hit the ground
    | 'dig'            // tunneler ground a wall tile to rubble
    | 'system_damaged' // a vehicle subsystem went down
    | 'door'           // a door swung (open or shut) — E did it
    | 'doorhit'        // something is BANGING on a door — claws, blasts
    | 'doorbreak'      // a door gave way — splinters, planks, a hole
    | 'wallbreak'      // DESTRUCTION: masonry breached to rubble — dust, chunks, a new lane
    | 'glass'          // a framed window pane shattered; frame/sill remain
    | 'ladder'         // someone climbed between storeys
    | 'sparks'         // the breacher's drill met METAL — sparks, no progress
    | 'hacked'         // hacking kit converted an enemy turret
    | 'psi_ping'       // psi scanner found someone (HUD flashes the icon)
    | 'downed'         // a soldier hit the ground bleeding — not dead yet
    | 'revived'        // someone got them back on their feet
    | 'melee_windup'   // a melee swing began — the client telegraphs the strike
    | 'melee_block'    // §12: a raised GUARD caught a STRIKE — sparks, a parry ring
    | 'grabbed'        // §14: a grapple landed — the target is pinned in a hold
    | 'grab_break'     // §14: a pinned body struggled or slipped free of the hold
    | 'struggle_start' // §15: a REAR pin opened a Control Struggle (soldierId = victim)
    | 'struggle_round' // §15: a contest pip fell — text: 'att' | 'def' won the round
    | 'struggle_lock'  // §15: attacker took best-of-three — the hold is LOCKED, finisher live
    | 'disarm'         // §14.2 outcome: the held gun was RIPPED away (weapon = what fell)
    | 'choke_out'      // §14.2 outcome: choked to DOWNED — a silent capture, not a kill
    | 'grab_throw'     // §14.2 outcome: the locked body HEAVED along the attacker's facing
    | 'grab_reach'     // UI: a grapple was ATTEMPTED (land or whiff) — the pulse-ring tell
    | 'hurt'           // UI-BIBLE §09 damage direction: pos = the ATTACKER, soldierId = the victim
    | 'beam_jam'       // §BEAMS: a held emitter overheated — locked out for its jam window
    | 'beam_clash'       // §BEAMS row 189: two streams crossed — the struggle node is born
    | 'beam_clash_break' // §BEAMS row 189: the node reached a wielder — soldierId was SHEARED
    | 'weaver_mend'      // W3.10: a weaver PULSED plate onto nearby iron (soldierId = weaver)
    | 'ravage'           // W3.10: the ravager's charge SLAMMED home (pos = impact)
    | 'water_froze'      // row 246: a water tile FROZE into crossable ice (pos = tile center)
    | 'sprinter_wake'  // §7.1: a dormant sprinter just activated — the terror spike
    | 'corpse_critical' // §6: a booked corpse entered its final reanimation window
    | 'contamination'  // §8: a corpse pile curdled into a mutation-field nest
    | 'reanimated'     // THE OUTBREAK: an exposed corpse got back up (§6)
    | 'whistle'        // paintball referee: a round just started or ended
    | 'encased'        // a soldier was frozen alive in the ice block (§21.6)
    | 'lsw_active'     // a piloted LSW fired its signature (text = ascendant id)
    | 'nade_bounce'    // a hand grenade kissed the ground — the tick before the bang
    | 'dash'           // M1: a soldier burst forward / tumbled sideways
    | 'leap'           // M1: the coiled spring released — a charged ballistic leap
    | 'leapland'       // M1: the leap ARRIVED — loud enough to ping the map
    | 'torch'          // §10: a flashlight clicked on or off
    | 'kill_confirm'   // W2.5: addressed to the KILLER — name, range, the spice
    | 'ragdoll'        // M1: blown past the knockback threshold — body is luggage
    | 'takedown'       // §14.2: a rear-control finisher landed on the pinned body
    | 'axe_throw'      // M5: the axe left the hand
    | 'axe_stick'      // M5: it bit something and stayed there
    | 'axe_recall'     // M5: it tore free and is flying home
    | 'sam_launch'     // V3: a missile is up — every pilot in earshot should know
    | 'corpse_slam'    // a body arrived at a wall hard enough to be worth hearing
    | 'bomb_away'      // V4: the bay opened
    | 'nuke_armed'     // V4: the warhead is live and everyone can hear it
    | 'damage'         // a number worth showing floated off a victim (see amount/armorHit)
    | 'vo';            // a spoken line: text = sound slot; pos = positional speech, absent = announcer net
  pos?: Vec3;
  weapon?: WeaponId;
  /** On an 'explosion': the two rings the client draws — `killRadius` is the
   *  lethal heart (a direct-hit blow lands inside it), `radius` is the splash
   *  reach where damage falls to nothing. The sim damage model and the ground
   *  rings read the SAME numbers, so the ring never lies about the blast. */
  radius?: number;
  killRadius?: number;
  /** On a 'hit': the shooter, but ONLY when a soldier/gadget was actually
   *  struck — the HUD keys its hitmarker off this, so a ball that ate a wall
   *  must NOT set it or every miss flashes a phantom tag.
   *  On a 'damage': the VICTIM — whose head the number floats over, and the key
   *  that folds a burst of hits into one number. */
  soldierId?: number;
  /** On vehicle_enter/exit: the hull it happened on — the client tells
   *  "someone boarded MY ride" apart from a door slamming across the map */
  vehicleId?: number;
  /** On a 'hit': who fired the round, struck or missed. Attribution for
   *  decals (paint splats wear their shooter's shade), never for feedback.
   *  On a 'damage': the ATTACKER — THE LAW is that a damage number shows only
   *  when this is the local player (see shouldShowDamage). Everyone else's
   *  exchanges stay silent so a busy field doesn't blizzard with numbers. */
  ownerId?: number;
  /** On a 'hit': the round met FLESH, not plate — the victim's armor was
   *  already gone. Drives the blood setting (§18 comfort): plate sparks,
   *  flesh bleeds. Sim states the fact; the client decides whether to show it. */
  bare?: boolean;
  /** On a 'damage': the magnitude to float off the victim (the client rounds it
   *  for display). Emitted from damageSoldier — one number for the plate the hit
   *  ate, one for the flesh it reached. */
  amount?: number;
  /** On a 'damage': true = this number came off ARMOR (draw it blue); false/absent
   *  = it came off HP (draw it red). */
  armorHit?: boolean;
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
  /** THE DEATH REPORT (DEATH-DATA.md): the rich kill data that used to be
   *  computed and thrown away at the death branch — now it rides the event so
   *  the killfeed, killcam, AAR, and the weapon ledger all read one source. */
  weaponId?: WeaponId;     // the killing weapon's ID (not just its display name)
  killerId?: number;       // who got the credit (-1 = environment/suicide)
  dist?: number;           // range of the kill, in world units
  overkill?: number;       // damage past 0 hp — the size of the blow
  timeAlive?: number;      // seconds the victim lived this print
  killerVehicle?: VehicleKind; // set when the killer was in a hull (roadkill / gun)
  /** on 'vehicle_destroyed': the hull's type, so the killer's gun can stamp it */
  vehKind?: VehicleKind;
}

export interface ModeState {
  id: ModeId;
  timeLeft: number;
  scores: [number, number];
  target: number;
  over: boolean;
  winner: Team | -1;
  /** B1: set at the whistle when the WINNER spent meaningfully less than the
   *  loser — an underfunded victory, the morale event the officer earns */
  underdog?: Team;
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
  // paintball (§3.3/§14): the outnumbered side, decided from the roster
  huntedTeam?: Team;
  /** paintball series (Robert: "best out of 5"): first to roundTarget round
   *  wins takes the match. One quick splat no longer ends the whole show. */
  round?: number;
  roundWins?: [number, number];
  roundTarget?: number;
  /** seconds of between-rounds breather; >0 = the yard is resetting */
  intermission?: number;
}

/** Modes where all players share team 0 against the undead. */
export function isCoopMode(id: ModeId): boolean {
  return id === 'survival' || id === 'horde' || id === 'safehouse' || id === 'science';
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
  /** M1 SPRINT: hold to run 1.35x — paid from the energy tank */
  sprint?: boolean;
  /** M1 DASH/ROLL: 0/absent none · 1 dash forward · 2 roll left · 3 roll right.
   *  Double-tap detection lives on the client; the sim only sees intent. */
  dash?: number;
  /** M1 CHARGED LEAP (STATUS §1: "hold-and-release with a direction; land
   *  loud, no air control"): 0/absent none · 0..1 = charge on release. The
   *  direction is moveX/moveZ on the same cmd. Ground classes only. */
  leap?: number;
  /** M5 MELEE / AXE: the F key, on RELEASE — throw it, recall it, or commit
   *  the (possibly charged) STRIKE. */
  melee?: boolean;
  /** IMPACT CHARGE (OUTBREAK-SPEC §13): F is currently HELD DOWN — the sim
   *  builds the knife's Power Strike charge while this is true. */
  meleeHold?: boolean;
  /** cursor distance from the soldier — thrown items (frag, beacon, charge)
   *  land here, clamped to each item's max reach. Optional for old clients. */
  aimDist?: number;
  /** grenade arc control (Robert): 0 = flat rope (fast, banks off walls),
   *  1 = full mortar lob (slow, sails over them). The LANDING SPOT is the
   *  cursor either way — loft only chooses the road, never the destination.
   *  Absent = 1 (bots and old clients keep the classic lob). */
  lob?: number;
  /** one-frame tap: rotate the grenade bag (frag/class-kit → smoke → fire),
   *  skipping empty pouches. X on the keyboard. */
  nadeCycle?: boolean;
  /** DUCK (finish-list 18): held stance -- half speed, and in the long grass
   *  you vanish past the footstep ring. C on the keyboard. */
  crouch?: boolean;
  /** THE GUARD (OUTBREAK-SPEC §12): HELD brace that blocks & parries frontal
   *  melee STRIKEs. V on the keyboard. */
  guard?: boolean;
  /** THE GRAPPLE (OUTBREAK-SPEC §12/§14): one-frame tap — a close-range grab
   *  that bypasses a GUARD and pins the target. Z on the keyboard. */
  grapple?: boolean;
  /** THE FLASHLIGHT (§10): one-frame tap toggles the torch. T on the keyboard. */
  torch?: boolean;
  /** THE OUTBREAK (OUTBREAK-SPEC §11): one-frame tap to cycle ammunition TYPE
   *  ball → armor-piercing → incendiary. B on the keyboard. */
  cycleAmmo?: boolean;
  /** Handler-only one-frame K9 order. Aim comes from aimYaw/aimDist. */
  k9?: K9Command;
}
