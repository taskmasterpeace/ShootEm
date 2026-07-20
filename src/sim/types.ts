export type Team = 0 | 1; // 0 = United Front (amber), 1 = Collective (cyan). Survival: all players team 0.

export type ModeId = 'tdm' | 'ctf' | 'koth' | 'conquest' | 'survival' | 'horde' | 'safehouse' | 'range' | 'paintball';

/** Battlefield environments — the war spans the solar system. */
export type ThemeId = 'savanna' | 'starship' | 'asteroid' | 'europa' | 'titan' | 'triton';

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
  tracer: 'bullet' | 'shell' | 'rocket' | 'plasma' | 'rail' | 'flame' | 'beam' | 'acid' | 'canister' | 'frag' | 'none';
  /** arsenal family this weapon belongs to ('rifle', 'laser', 'mortar', …) */
  family?: WeaponFamily;
  /** Mk tier within the family (1..3) — drives the stat curve */
  tier?: number;
  /** special detonation instead of damage: emp burst, beacons, smoke/fire fields */
  payload?: 'emp' | 'target_beacon' | 'orbital' | 'smoke' | 'fire' | 'concussion';
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
  | 'scatter' | 'sonic' | 'flamethrower' | 'grenade' | 'special'
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
  /** M1 RAGDOLL: past the knockback threshold the body is luggage until this */
  ragdollUntil?: number;
  /** M4: an LSW's own regen rate, when its god overrides the class stat */
  lswRegen?: number;
  /** M5 THROW-AND-RETRIEVE: the gadget id of this soldier's axe while it is
   *  in the ground. Absent = the axe is on his back, ready to throw. */
  axeId?: number;
  /** M5: the axe is flying home — no second recall until it lands */
  axeRecallAt?: number;
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
  /** jetpack burned dry — no relight until energy recovers to 35 (the
   *  flight economy: fly, land, breathe — never cross the map in one hop) */
  jetSpent?: boolean;
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
  /** remaining body/cover pass-throughs (init from WeaponDef.pierce at launch) */
  pierce?: number;
  /** remaining ricochets (init from WeaponDef.ricochet at launch) */
  ricochet?: number;
  pierceArmor?: boolean;
  ignite?: boolean;
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
  | 'snap_trap'    // Venatrix: springs THE ICE BLOCK on whoever steps in (spot the glint)
  | 'flare'        // burning IR decoy dropped by a flyer — seduces heat-seekers
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
    | 'wallbreak'      // DESTRUCTION: masonry breached to rubble — dust, chunks, a new lane
    | 'ladder'         // someone climbed between storeys
    | 'sparks'         // the breacher's drill met METAL — sparks, no progress
    | 'hacked'         // hacking kit converted an enemy turret
    | 'psi_ping'       // psi scanner found someone (HUD flashes the icon)
    | 'downed'         // a soldier hit the ground bleeding — not dead yet
    | 'revived'        // someone got them back on their feet
    | 'melee_windup'   // a melee swing began — the client telegraphs the strike
    | 'whistle'        // paintball referee: a round just started or ended
    | 'encased'        // a soldier was frozen alive in the ice block (§21.6)
    | 'lsw_active'     // a piloted LSW fired its signature (text = ascendant id)
    | 'nade_bounce'    // a hand grenade kissed the ground — the tick before the bang
    | 'dash'           // M1: a soldier burst forward / tumbled sideways
    | 'ragdoll'        // M1: blown past the knockback threshold — body is luggage
    | 'axe_throw'      // M5: the axe left the hand
    | 'axe_stick'      // M5: it bit something and stayed there
    | 'axe_recall'     // M5: it tore free and is flying home
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
  /** M1 SPRINT: hold to run 1.35x — paid from the energy tank */
  sprint?: boolean;
  /** M1 DASH/ROLL: 0/absent none · 1 dash forward · 2 roll left · 3 roll right.
   *  Double-tap detection lives on the client; the sim only sees intent. */
  dash?: number;
  /** M5 MELEE / AXE: the F key. Throw it, recall it, or swing it. */
  melee?: boolean;
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
}
