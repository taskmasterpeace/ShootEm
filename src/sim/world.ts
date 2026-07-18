import { CLASSES, DOG_NAMES, DOG_STATS, EQUIPMENT, IRON_STATS, SAM_SPEED_RATIO, THEMES, VEHICLES, WEAPONS, ZOMBIE_STATS } from './data';
import { CLASS_ARMORY, familyWeapons } from './arsenal';
import { CLIMB_H, DRILL_EATS, F2_VOID, F2_WELL, GRID, T_CLIMB, T_DEEP, SURF_SOLDIER, SURF_TRACKS, SURF_WHEELS, T_COVER, T_DOOR, T_DOOR_OPEN, T_LADDER, T_METAL, T_OPEN, T_RUBBLE, T_SLIT, T_WALL, T_WATER, TILE, WORLD, blocksShot, blocksShotUpper, generateMap, isBlocked, losClear, surfaceAt, tileAt, upperBlocked, type GameMap } from './map';
import { Rng } from './rng';
import {
  SYSTEM_IDS, isCoopMode, isZed,
  type AscendantId, type ClassId, type Gadget, type GadgetType, type Mine, type ModeId, type ModeState,
  type Pickup, type PlayerCmd, type Projectile, type SimEvent, type Soldier,
  type SoldierKind, type SystemId, type Team, type ThemeId, type Turret, type Vec3,
  type Vehicle, type VehicleKind, type VehicleSystems, type WeaponId, type ZedKind, isIron, type IronKind } from './types';
import { stepMode, initMode } from './modes';
import { generateFront } from './fronts';
import { LSW_BRAINS } from './lsw/index';
import { ICE_HOLD, ICE_HOLD_DRAIN, LSWS, STRUGGLE_HP, STRUGGLE_SECS, THREAT, lswAllowed, lswsForTeam } from './lsw';
import { stepBot, stepDog, stepIron, stepScientist, stepZombie } from './bots';
import { PERCEIVE_RANGE, perceivesNow, smokeBlocks, type SeenMark, type SmokeBlob } from './perception';
import { THEME_WEATHER, airGrounded, moveMult, visionMult, weatherAnnounce, type WeatherState } from './weather';

const RESPAWN_DELAY = 4;
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

/** Brutes wind up a slow haymaker; sprinters snap; the K9 bites quick. */
export function meleeWindupFor(kind: SoldierKind): number {
  if (kind === 'brute') return 0.4;
  if (kind === 'sprinter') return 0.18;
  if (kind === 'dog') return 0.2;
  return MELEE_WINDUP;
}
const ENERGY_REGEN = 14;
const CLOAK_DRAIN = 11;
const JET_DRAIN = 30;
const JET_THRUST = 9.5;
const PICKUP_RESPAWN = 18;

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
  botsPerTeam?: number;
  difficulty?: Difficulty;
  matchMinutes?: number;
  /** battlefield environment — drives map flavor and gravity */
  theme?: ThemeId;
  /** §8.2 authored ground: a Scar front id deploys onto ITS terrain, not a
   *  recipe scatter. Unknown/absent → the classic generator. */
  frontId?: string;
}

/** Custom deploy loadout: armory weapons + up to two equipment picks. */
export interface Loadout {
  primary?: WeaponId;
  secondary?: WeaponId;
  equipment?: string[];
}

/** Bot aim-error multiplier per difficulty. */
export const DIFFICULTY_AIM: Record<Difficulty, number> = {
  recruit: 1.9,
  veteran: 1,
  elite: 0.45,
};

export class World {
  time = 0;
  tick = 0;
  map: GameMap;
  mode: ModeState;
  rng: Rng;
  /** gravity for this battlefield — Europa and Triton fight in low-g */
  gravity: number;
  soldiers = new Map<number, Soldier>();
  vehicles = new Map<number, Vehicle>();
  turrets = new Map<number, Turret>();
  projectiles = new Map<number, Projectile>();
  pickups = new Map<number, Pickup>();
  mines = new Map<number, Mine>();
  gadgets = new Map<number, Gadget>();
  /** soldier ids currently revealed by targeting beacons / drones / sensors / psi */
  pinged = new Set<number>();
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
  moveSpeedMul = 1;
  private nextId = 1;

  constructor(public opts: WorldOptions) {
    this.rng = new Rng(opts.seed ^ 0xbeef);
    // authored front ground first (§8.2); the recipe generator is the
    // fallback for free play and any front this build doesn't know
    this.map = (opts.frontId ? generateFront(opts.frontId, opts.seed) : null)
      ?? generateMap(opts.seed, opts.mode, opts.theme ?? 'savanna');
    this.gravity = THEMES[this.map.theme].gravity;
    this.mode = initMode(opts.mode, this.map, opts.matchMinutes);
    if (opts.mode === 'paintball') this.weather.until = Infinity; // the yard stays sunny
    // vehicles on pads. Co-op zombie modes field only squad support —
    // the ambulance and the emplacement guns — no armor column.
    this.map.vehiclePads.forEach((pad, padId) => {
      if (isCoopMode(opts.mode) && pad.kind !== 'ambulance' && pad.kind !== 'emplacement') return;
      this.spawnVehicle(pad.kind, pad.team, pad.pos, padId);
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
    const tx = idx % GRID, tz = (idx / GRID) | 0;
    const pos = { x: (tx + 0.5) * TILE - WORLD / 2, y: 1, z: (tz + 0.5) * TILE - WORLD / 2 };
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
    if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) return; // border holds
    const idx = tz * GRID + tx;
    const t = this.map.grid[idx];
    // structure is dinner: walls, cover, slits, doors, climb barricades —
    // the DRILL_EATS menu (map.ts, shared with the harness). METAL is not
    // (sparks handled at the drill face); water and open ground have nothing to eat.
    if (!DRILL_EATS.has(t)) return;
    this.map.grid[idx] = T_OPEN;
    this.dug.push(idx);
    this.emit({
      type: 'dig', tile: idx,
      pos: { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 },
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
    if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) return; // the rim holds, always
    const idx = tz * GRID + tx;
    const t = this.map.grid[idx];
    const soft = t === T_COVER;
    const structural = t === T_WALL || t === T_SLIT || t === T_CLIMB;
    const rubble = t === T_RUBBLE;
    if (!soft && !structural && !rubble) return;         // metal/doors/water: not this system's food
    if ((structural || rubble) && !heavy) return;        // masonry shrugs off small arms
    const maxHp = soft ? 80 : structural ? 300 : 120;    // rubble grinds away under sustained heavy fire
    const hp = (this.wallHp.get(idx) ?? maxHp) - dmg;
    if (hp > 0) { this.wallHp.set(idx, hp); return; }    // damaged, still standing
    this.wallHp.delete(idx);
    const pos = { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 };
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
  blackHoles: { x: number; z: number; team: Team; ownerId: number; burstAt: number }[] = [];
  /** FORCE FIELDS (§4.4 #2, the shared mechanic): sustained radial pulls /
   *  pushes and directional shoves, re-applied every tick so they survive the
   *  impulse decay. One system → Gravity Warden, Riptide, Oblivion's hole,
   *  Stormcaller's tornado. `radial` < 0 pulls INWARD toward (x,z), > 0
   *  shoves OUTWARD; (fx,fz) adds a directional current. Soldiers on the
   *  owner's team are exempt; vehicles move only when CREWED (an abandoned
   *  wreck is nobody's toy — the §8.1a requisition law). */
  forceFields: { x: number; z: number; r: number; radial: number; fx?: number; fz?: number; team: Team; ownerId: number; until: number }[] = [];
  /** §17 MATERIEL (finish-list #4): each faction's purse for LSW calls —
   *  opens at 10, drips +1 every 60s (cap 14). THREAT[].materiel is the
   *  price per tier, so a T4 costs most of the afternoon. */
  materiel: [number, number] = [10, 10];
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
    // §5: ONE BRAIN FILE PER LSW — src/sim/lsw/<id>.ts, each deterministic,
    // DOM-free, carrying BOTH abilities. This just dispatches.
    LSW_BRAINS[s.ascendant!]?.step(this, s, dt);
  }

  /** The black hole's BURST timing — the drag itself rides the shared
   *  force-field system (a radial −5 field with the same lifetime). Sprint
   *  TANGENTIALLY to escape; when the telegraph runs out, it collapses. */
  private stepBlackHoles() {
    this.blackHoles = this.blackHoles.filter((bh) => {
      if (this.time >= bh.burstAt) {
        this.explode({ x: bh.x, y: 0, z: bh.z }, WEAPONS.gl, bh.ownerId, bh.team);
        this.emit({ type: 'explosion', pos: { x: bh.x, y: 0, z: bh.z }, weapon: 'gl' });
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
    this.soldiers.set(s.id, s);
    return s;
  }

  /** THE IRON EATERS (DD SS20, finish-list 12): wreckage that stood up.
   *  Spawned PLATED -- the armor pool is the molt; when fire sheds it the
   *  exposed frame takes double and runs hot (damageSoldier SS20.2). */
  addIronEater(kind: IronKind, pos: Vec3): Soldier {
    const st = IRON_STATS[kind];
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
      armor: st.plate, maxArmor: st.plate, protectedUntil: 0,
      equipment: [], medikitReady: false, nextPsiAt: 0, nextRepairAt: 0,
      downed: false, downedUntil: 0, downedBy: -1, reviveProgress: 0, draggingId: -1,
      meleeStrikeAt: 0, meleeYaw: 0, meleeWeapon: '',
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    this.soldiers.set(s.id, s);
    return s;
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
    // keep the soldier's chosen armory loadout across respawns
    const primary = s.weapons[0] && WEAPONS[s.weapons[0]] ? s.weapons[0] : c.primary;
    const secondary = s.weapons[1] && WEAPONS[s.weapons[1]] ? s.weapons[1] : c.secondary;
    s.weapons = [primary, secondary];
    s.clip = [WEAPONS[primary].clip, WEAPONS[secondary].clip];
    s.reserve = [WEAPONS[primary].reserve, WEAPONS[secondary].reserve];
    s.grenades = this.hasEquip(s, 'demoCharge') ? 3 : s.classId === 'infantry' ? 4 : s.classId === 'engineer' ? 3 : 2;
    // the grenade bag: everyone carries smoke; one incendiary for the
    // door-kickers. X cycles the pouch, G throws from it.
    s.smokes = 2;
    s.firebombs = s.classId === 'infantry' || s.classId === 'heavy' ? 1 : 0;
    s.nadeSel = 0;
    s.manpads = this.hasEquip(s, 'samLauncher') ? MANPADS_ROUNDS : 0;
    s.medikitReady = true;
    s.meleeStrikeAt = 0; s.meleeWeapon = ''; // no swing survives a respawn
    // mobile spawn: a crewed APC or transport with a LIVE comms system
    const mobile = [...this.vehicles.values()].find(
      (v) => v.alive && v.team === s.team && VEHICLES[v.kind].mobileSpawn &&
        v.systems.comms > 0 && v.seats.some((id) => id >= 0),
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
        if (safe) { matePos = m.pos; break; }
      }
    }
    // the APC is a door, not a clown car — a third rides it, not half
    const base = matePos ?? (mobile && this.rng.next() < 0.33 ? mobile.pos : ringPick);
    s.pos = { x: base.x + this.rng.range(-2.6, 2.6), y: 0, z: base.z + this.rng.range(-2.6, 2.6) };
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
    if (!this.mode.over) stepMode(this, dt);
    // the materiel drip (§17): war production never stops, it just crawls
    if (this.time >= this.nextMaterielDripAt) {
      this.nextMaterielDripAt += 60;
      for (const t of [0, 1] as const) this.materiel[t] = Math.min(14, this.materiel[t] + 1);
    }
    if (!this.mode.over) this.stepLswDrops(); // §21.6: telegraphed LSW landings
    if (this.forceFields.length) this.stepForceFields(); // §4.4 #2: the pulls and the shoves
    if (this.blackHoles.length) this.stepBlackHoles(); // Oblivion's void (burst timing)
    // expired time bubbles pop quietly
    if (this.timeFields.length) this.timeFields = this.timeFields.filter((f) => this.time < f.until);
    // possessed machines come home when the hold expires (§4.4 #4)
    for (const t of this.turrets.values()) {
      if (t.possessedUntil !== undefined && this.time >= t.possessedUntil) this.evictPossession(t);
    }
    for (const b of this.soldiers.values()) {
      if (b.possessedUntil !== undefined && (this.time >= b.possessedUntil || !b.alive)) this.evictBotPossession(b);
    }
    for (const v of this.vehicles.values()) {
      if (v.possessedUntil !== undefined && (this.time >= v.possessedUntil || !v.alive)) this.evictVehiclePossession(v);
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
        if (s.kind !== 'human' && s.kind !== 'bot') continue; // dead zombies removed elsewhere
        if (this.time >= s.respawnAt && !this.mode.over && !s.dummy) this.spawn(s); // downed range targets STAY down
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
          if (s.hp <= 0) { s.hp = 0; s.encasedUntil = undefined; this.damageSoldier(s, 1, -1, 'bleedout'); continue; }
        }
        if (this.time >= s.encasedUntil) this.freeFromIce(s, 0); // the ice melts, free at no cost
        continue; // an ice block does nothing else
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

    // purge removed zombies (dogs are soldiers — they wait for their respawn, not the bin)
    for (const [id, s] of this.soldiers) {
      if (!s.alive && s.kind !== 'human' && s.kind !== 'bot' && s.kind !== 'dog' && this.time > s.respawnAt) this.soldiers.delete(id);
    }

    for (const v of this.vehicles.values()) this.stepVehicle(v, cmds, dt);
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
    this.applyReconCountermeasures();
    this.updateLastSeen();

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
    return losClear(this.map.grid, { x: from.x, y: 1.4, z: from.z }, { x: to.x, y: 1.4, z: to.z });
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
        if (perceivesNow(this.map.grid, eyes, this.pinged, s, range, this.smokeBlobs, revealed)) {
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
        if (d < bestD && !losClear(this.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) {
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
      const x = this.rng.range(-WORLD / 3, WORLD / 3);
      const z = this.rng.range(-WORLD / 3, WORLD / 3);
      if (!isBlocked(this.map.grid, x, z) && !isBlocked(this.map.grid, x + 2, z) && !isBlocked(this.map.grid, x - 2, z)) {
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
          if (!isBlocked(this.map.grid, nx, g.pos.z)) g.pos.x = nx; // slide along walls
          if (!isBlocked(this.map.grid, g.pos.x, nz)) g.pos.z = nz;
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
            if (d < 20 && losClear(this.map.grid, { ...g.pos, y: 1.6 }, { ...s.pos, y: 1.2 })) this.pinged.add(s.id);
          }
          break;
        }
        case 'snap_trap': {
          // VENATRIX: the ice block's little sister — whoever steps in is
          // ENCASED (the same shared state; teammates shatter, struggling
          // hurts). The trap is spent on the spring.
          for (const s2 of this.soldiers.values()) {
            if (!s2.alive || s2.team === g.team || s2.encasedUntil !== undefined || s2.pos.y > 1) continue;
            if (Math.hypot(s2.pos.x - g.pos.x, s2.pos.z - g.pos.z) < 1.2 && this.encaseSoldier(s2)) {
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
            g.pos.x = Math.max(-WORLD / 2 + 2, Math.min(WORLD / 2 - 2, g.pos.x + (g.vel?.x ?? 0) * dt));
            g.pos.z = Math.max(-WORLD / 2 + 2, Math.min(WORLD / 2 - 2, g.pos.z + (g.vel?.z ?? 0) * dt));
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
    if (t.possessedBy === undefined) { t.origTeam = t.team; t.origOwnerId = t.ownerId; }
    t.possessedBy = s.id;
    t.possessedUntil = this.time + secs;
    t.team = s.team;
    t.ownerId = s.id;
    this.emit({ type: 'hacked', pos: { ...t.pos }, soldierId: s.id, text: `${s.name} POSSESSED a sentry!` });
  }

  /** hand a possessed machine back to its rightful owner */
  private evictPossession(t: Turret) {
    if (t.possessedBy === undefined) return;
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
    if (b.possessedBy === undefined) b.origTeam = b.team;
    b.possessedBy = s.id;
    b.possessedUntil = this.time + secs;
    b.team = s.team;
    this.emit({ type: 'hacked', pos: { ...b.pos }, soldierId: s.id, text: `${s.name} POSSESSED ${b.name}!` });
    return true;
  }

  /** hand a ridden bot back to its side */
  private evictBotPossession(b: Soldier) {
    if (b.possessedBy === undefined) return;
    b.team = b.origTeam ?? b.team;
    b.possessedBy = undefined; b.possessedUntil = undefined; b.origTeam = undefined;
  }

  /** §4.4 #4: a timed take of an enemy HULL — team flips, its guns serve
   *  the ghost, expiry (or an EMP) hands it home. */
  possessVehicle(v: Vehicle, s: Soldier, secs: number): boolean {
    if (!v.alive || v.team === s.team) return false;
    if (v.possessedBy === undefined) v.origTeam = v.team;
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

  applyCmd(s: Soldier, cmd: PlayerCmd, dt: number) {
    s.yaw = cmd.aimYaw;
    s.crouching = !!cmd.crouch && !s.downed; // the duck is a HELD stance

    // §7 A PILOTED LSW: Q is the SIGNATURE, not the class kit. The active
    // fires here and the class-ability branches below never see the press —
    // an ascended medic doesn't self-stim, an ascended ghost doesn't cloak.
    if (s.ascendant && cmd.ability) {
      if (s.vehicleId < 0 && this.time >= (s.nextLswActiveAt ?? 0)) this.lswActive(s);
      cmd = { ...cmd, ability: false };
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
      if (cmd.use && this.time - s.enteredVehicleAt > 0.3) this.exitVehicle(s, v);
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
      // flyer pilots pop IR flares with the grenade key — the heat-seeker counter
      if (cmd.grenade && s.seat === 0 && VEHICLES[v.kind].flies && v.flares > 0 && this.time >= s.nextGrenadeAt) {
        v.flares--;
        s.nextGrenadeAt = this.time + 1;
        const g = this.spawnGadget('flare', v.team, s.id, {
          x: v.pos.x - Math.cos(v.yaw) * 3, y: 0, z: v.pos.z - Math.sin(v.yaw) * 3,
        }, 1, 3.5);
        this.emit({ type: 'beacon_planted', pos: { ...g.pos }, soldierId: s.id, text: 'FLARES!' });
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
    const swimming = tileAt(this.map.grid, s.pos.x, s.pos.z) === T_DEEP;

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
    if (cmd.reload && s.clip[s.weaponIdx] < def.clip && s.reserve[s.weaponIdx] > 0 && s.reloadUntil === 0) {
      s.reloadUntil = this.time + def.reloadTime;
      this.emit({ type: 'reload', pos: s.pos, soldierId: s.id });
    }
    if (s.reloadUntil > 0 && this.time >= s.reloadUntil) {
      const need = def.clip - s.clip[s.weaponIdx];
      const take = Math.min(need, s.reserve[s.weaponIdx]);
      s.clip[s.weaponIdx] += take;
      if (Number.isFinite(s.reserve[s.weaponIdx])) s.reserve[s.weaponIdx] -= take;
      s.reloadUntil = 0;
    }

    // movement intent (armor weighs you down)
    const c = CLASSES[s.classId];
    let speed = c.speed * (SURF_SOLDIER[surfaceAt(this.map.surface, s.pos.x, s.pos.z)] ?? 1) // §8.6
      * moveMult(this.weather, 'soldier') // §8.8 snow drags boots
      * this.moveSpeedMul; // Robert's global movement knob (1 = shipped feel)
    if (s.cloaked) speed *= 0.8;
    if (s.rageMul) speed *= s.rageMul; // Ragebeast: the wound makes him fast
    for (const eid of s.equipment) {
      const e = EQUIPMENT[eid];
      if (e?.speedMult) speed *= e.speedMult;
    }
    if (s.draggingId >= 0) speed *= 0.5; // hauling a body is slow, honest work
    if (s.crouching) speed *= 0.5;       // ducked walking is half pace
    // THE SEAM SANITIZER (found by the threat rig): a brain that emits NaN
    // intent must never poison the sim — Math.hypot(NaN, x) is NaN and
    // `NaN || 1` stays NaN, so one bad division in a bot turned Magnetar
    // into an untargetable ghost at (NaN, z). Intent is clamped finite here.
    const mx = Number.isFinite(cmd.moveX) ? cmd.moveX : 0;
    const mz = Number.isFinite(cmd.moveZ) ? cmd.moveZ : 0;
    const len = Math.hypot(mx, mz) || 1;
    s.vel.x = (mx / len) * speed;
    s.vel.z = (mz / len) * speed;

    // jetpack (jump troopers) / hop for everyone. The FLIGHT ECONOMY
    // (Robert: "you can fly across the whole map without ever landing"):
    //  · an emptied tank LATCHES — no relaunch until it recovers to 35
    //  · thrust fades above 6u — a soft ceiling, not a cliff ("too high")
    //  · energy only regenerates ON THE GROUND (below) — feathering the
    //    trigger no longer buys infinite hang time. Fly, land, breathe.
    if (cmd.jump && !swimming) {
      if (c.ability === 'jetpack' && s.energy > 1 && !s.jetSpent) {
        s.vel.y = JET_THRUST * Math.max(0, Math.min(1, 1 - (s.pos.y - 6) / 4));
        s.energy = Math.max(0, s.energy - JET_DRAIN * dt);
        if (s.energy <= 1) s.jetSpent = true; // burned dry — the latch drops
        if (this.tick % 6 === 0) this.emit({ type: 'jetpack', pos: s.pos, soldierId: s.id });
      } else if (s.pos.y <= 0.01) {
        s.vel.y = 7;
      }
    }
    if (s.jetSpent && s.energy >= 35) s.jetSpent = false; // recovered enough to relight

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
      const rate = c.ability === 'jetpack' && !grounded ? 0 : ENERGY_REGEN;
      s.energy = Math.min(100, s.energy + rate * dt);
    }

    // medic self-stim
    if (cmd.ability && c.ability === 'heal' && this.time >= s.nextAbilityAt && s.energy >= 50 && s.hp < s.maxHp) {
      s.hp = Math.min(s.maxHp, s.hp + 45);
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
      if (!isBlocked(this.map.grid, s.pos.x, s.pos.z)) {
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
        if (!isBlocked(this.map.grid, fx, fz)) {
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
        [0, s.classId === 'engineer' ? `MINES ×${s.grenades}` : `FRAG ×${s.grenades}`],
      ];
      const cur = s.nadeSel ?? 0;
      for (let step = 1; step <= 3; step++) {
        const next = (cur + step) % 3;
        const stocked = next === 0 ? true : next === 1 ? (s.smokes ?? 0) > 0 : (s.firebombs ?? 0) > 0;
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
    if (cmd.grenade && !swimming && this.time >= s.nextGrenadeAt) {
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
        if (mine.length < 2 && !isBlocked(this.map.grid, s.pos.x, s.pos.z)) {
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
          const m: Mine = { id: this.id(), team: s.team, ownerId: s.id, pos: { ...s.pos }, armedAt: this.time + 1.2 };
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

    // firing — unless you are SWIMMING
    if (cmd.fire && !swimming && s.reloadUntil === 0 && this.time >= s.nextFireAt) {
      if (s.clip[s.weaponIdx] > 0) {
        s.protectedUntil = 0; // hostile action ends spawn protection (55B)
        this.fireSoldierWeapon(s, wid, def, cmd.aimDist);
      } else if (s.reserve[s.weaponIdx] > 0) {
        s.reloadUntil = this.time + def.reloadTime;
        this.emit({ type: 'reload', pos: s.pos, soldierId: s.id });
      }
    }

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

  fireSoldierWeapon(s: Soldier, wid: WeaponId, def = WEAPONS[wid], aimDist?: number) {
    s.nextFireAt = this.time + 1 / def.rof;
    if (Number.isFinite(s.clip[s.weaponIdx])) s.clip[s.weaponIdx]--;
    if (s.cloaked) s.cloaked = false;

    if (def.range <= 2.5) { // melee (zombie claws) — starts a swing, not a hit
      this.startMelee(s, def);
      return;
    }
    // arc weapons are cursor-targeted like every thrown item: the shell LANDS
    // at aimDist instead of always lobbing to max range. (This is what made
    // the GL-40 unusable at anything but exactly 46u.)
    const reach = def.arc ? Math.max(6, Math.min(aimDist ?? def.range, def.range)) : def.range;
    for (let p = 0; p < def.pellets; p++) {
      this.throwProjectile(s, wid, 1.4, def.speed, def.arc, reach);
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
   * STRIKE: the claw comes down. Arc check runs against where everyone stands
   * NOW, along the yaw locked at windup — dodges are honored, and up to two
   * victims in the wedge take the hit. The attacker lunges into the blow.
   */
  resolveMeleeStrike(s: Soldier) {
    const def = WEAPONS[s.meleeWeapon];
    s.meleeStrikeAt = 0;
    s.meleeWeapon = '';
    if (!def || !s.alive) return; // attacker died mid-swing — no ghost claws
    // the lunge: thrown ~1.5u into the swing via the decaying push impulse
    s.pushX += Math.cos(s.meleeYaw) * MELEE_LUNGE;
    s.pushZ += Math.sin(s.meleeYaw) * MELEE_LUNGE;
    this.emit({ type: 'shot', pos: { ...s.pos }, weapon: def.id, soldierId: s.id });
    // everyone in the front wedge, nearest first, capped at MELEE_MAX_TARGETS
    const caught: { victim: Soldier; d: number }[] = [];
    for (const other of this.soldiers.values()) {
      if (!other.alive || other.team === s.team) continue;
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
      // hit reaction: the blow staggers their aim and shoves them back a step
      victim.nextFireAt = Math.max(victim.nextFireAt, this.time + MELEE_STAGGER);
      const dl = Math.max(d, 0.5);
      victim.pushX += ((victim.pos.x - s.pos.x) / dl) * 3;
      victim.pushZ += ((victim.pos.z - s.pos.z) / dl) * 3;
      this.emit({ type: 'hit', pos: { ...victim.pos, y: 1 }, weapon: def.id, soldierId: s.id });
      this.damageSoldier(victim, def.damage, s.id, def.id);
    }
  }

  /**
   * Fire a projectile. `reach` is the intended max distance (defaults to the
   * weapon's range); for arcs it drives the launch angle so the shot actually
   * LANDS at that distance instead of a fixed short ballistic. A caller can
   * pass a shorter reach for a soft toss (e.g. the hand-thrown frag).
   */
  throwProjectile(s: Soldier, wid: WeaponId, muzzleY: number, speed: number, arc: boolean, reach = WEAPONS[wid].range, loft = 1, bounce = false) {
    const def = WEAPONS[wid];
    const spread = (this.rng.next() - 0.5) * 2 * def.spread;
    const yaw = s.yaw + spread;
    // global projectile-speed knob: only DIRECT fire — a slower bullet still
    // lands on target because ttl below is reach/speed (range preserved). Arcs
    // re-solve speed from flight time anyway, so leaving them alone keeps
    // grenades landing on the cursor.
    if (!arc) speed *= this.projectileSpeedMul;
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
    };
    this.projectiles.set(p.id, p);
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
      bornAt: this.time, ttl: def.range / speed, arc: false,
      ...(flesh ? { homingSoldierId: target.id } : { homingVehicleId: target.id }),
    };
    this.projectiles.set(p.id, p);
    this.emit({ type: 'shot', pos: { ...p.pos }, weapon: 'sam_missile', soldierId: s.id });
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
        this.explode(flare.pos, WEAPONS.sam_missile, p.ownerId, p.team); // eats the decoy
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
        this.explode({ ...e.pos }, sam ? WEAPONS.sam_missile : WEAPONS.flesh_glob, p.ownerId, p.team);
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
      if (!upperBlocked(this.map.grid2, nx, s.pos.z)) s.pos.x = nx;
      if (!upperBlocked(this.map.grid2, s.pos.x, nz)) s.pos.z = nz;
      s.pos.x = Math.max(-WORLD / 2 + 2, Math.min(WORLD / 2 - 2, s.pos.x));
      s.pos.z = Math.max(-WORLD / 2 + 2, Math.min(WORLD / 2 - 2, s.pos.z));
      // off the edge? nothing under your boots — down you go
      if (tileAt(this.map.grid2, s.pos.x, s.pos.z) === F2_VOID) s.floor = 0;
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
    // gravity + vertical (theme gravity: Europa jumps are glorious)
    if (!trueFlight && s.liftedUntil === undefined && (s.pos.y > 0 || s.vel.y > 0)) {
      s.vel.y -= this.gravity * dt;
      s.pos.y = Math.max(0, s.pos.y + s.vel.y * dt);
      if (s.pos.y === 0) s.vel.y = 0;
    }
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
    const tHere = tileAt(this.map.grid, s.pos.x, s.pos.z);
    // …and rubble drags at the boots the same way: a breach is a lane, not a road
    let waterMult = tHere === T_DEEP ? 0.38 : tHere === T_WATER ? 0.55 : tHere === T_RUBBLE ? 0.6 : 1;
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
      const t = tileAt(this.map.grid, x, z);
      if (t === T_CLIMB) return s.pos.y <= CLIMB_H;
      return t === T_WALL || t === T_SLIT || t === T_METAL || t === T_DEEP;
    };
    const groundBlocked = (x: number, z: number) => {
      const t = tileAt(this.map.grid, x, z);
      if (t === T_DEEP || t === T_WATER) return false; // wade in, swim deeper
      if (isBlocked(this.map.grid, x, z)) return true;
      // THE ICE BLOCK IS A BLOCK (§21.6, closing Frostbite's Notes gap): an
      // encased soldier is a real 1-tile obstacle — nobody walks through a
      // frozen man, friend or foe. Encased soldiers are rare; the scan is short.
      for (const o of this.soldiers.values()) {
        if (o.encasedUntil === undefined || o.id === s.id || !o.alive) continue;
        const dx = o.pos.x - x, dz = o.pos.z - z;
        if (dx * dx + dz * dz < 0.81) return true; // 0.9u — a tile-ish block
      }
      return false;
    };
    const blockedX = airborne ? blocksAir(nx, s.pos.z) : groundBlocked(nx, s.pos.z);
    const blockedZ = airborne ? blocksAir(s.pos.x, nz) : groundBlocked(s.pos.x, nz);
    if (!blockedX) s.pos.x = nx;
    if (!blockedZ) s.pos.z = nz;
    s.pos.x = Math.max(-WORLD / 2 + 2, Math.min(WORLD / 2 - 2, s.pos.x));
    s.pos.z = Math.max(-WORLD / 2 + 2, Math.min(WORLD / 2 - 2, s.pos.z));
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
    for (const reach of [TILE * 0.6, TILE * 1.3]) {
      const x = s.pos.x + Math.cos(s.yaw) * reach;
      const z = s.pos.z + Math.sin(s.yaw) * reach;
      const tx = Math.floor((x + WORLD / 2) / TILE);
      const tz = Math.floor((z + WORLD / 2) / TILE);
      if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) continue;
      const idx = tz * GRID + tx;
      const t = this.map.grid[idx];
      if (t !== T_DOOR && t !== T_DOOR_OPEN) continue;
      this.map.grid[idx] = t === T_DOOR ? T_DOOR_OPEN : T_DOOR;
      if (this.doorChanges.indexOf(idx) < 0) this.doorChanges.push(idx);
      this.emit({
        type: 'door', tile: idx, soldierId: s.id,
        pos: { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 },
      });
      return true;
    }
    return false;
  }

  /** door tiles whose state ever changed — replicated so puppets stay true */
  doorChanges: number[] = [];

  /** E on a ladder foot (or the well above it) climbs between storeys. The
   *  activation key again — same verb as doors and vehicles. */
  private tryLadder(s: Soldier): boolean {
    for (const reach of [0, TILE * 0.6]) {
      const x = s.pos.x + Math.cos(s.yaw) * reach;
      const z = s.pos.z + Math.sin(s.yaw) * reach;
      const tx = Math.floor((x + WORLD / 2) / TILE);
      const tz = Math.floor((z + WORLD / 2) / TILE);
      if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) continue;
      const idx = tz * GRID + tx;
      if (s.floor === 0 && this.map.grid[idx] === T_LADDER && this.map.grid2[idx] === F2_WELL) {
        s.floor = 1;
        s.pos.x = (tx + 0.5) * TILE - WORLD / 2;
        s.pos.z = (tz + 0.5) * TILE - WORLD / 2;
        s.pos.y = 4;
        s.vel.y = 0;
        this.emit({ type: 'ladder', pos: { ...s.pos }, soldierId: s.id });
        return true;
      }
      if (s.floor === 1 && this.map.grid2[idx] === F2_WELL) {
        s.floor = 0;
        s.pos.x = (tx + 0.5) * TILE - WORLD / 2;
        s.pos.z = (tz + 0.5) * TILE - WORLD / 2;
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
    if (!isBlocked(this.map.grid, tx, tz)) {
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
    for (const v of this.vehicles.values()) {
      if (!v.alive || v.team !== s.team) continue;
      const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
      if (d < VEHICLES[v.kind].radius + 2.2) {
        const seat = v.seats.indexOf(-1);
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
            v.spoolUntil = this.time + lift;
            this.emit({ type: 'announce', text: `${VEHICLES[v.kind].name}: rotors spooling…` });
          }
          if (s.carryingFlag >= 0) return; // flag carriers may ride — mode handles flag pos
          this.emit({ type: 'vehicle_enter', pos: v.pos, soldierId: s.id });
          return;
        }
      }
    }
  }

  exitVehicle(s: Soldier, v: Vehicle) {
    v.seats[s.seat] = -1;
    // last one out starts the abandonment clock — hotwire and write-off run on it
    if (!v.seats.some((id) => id >= 0)) v.abandonedAt = this.time;
    s.vehicleId = -1;
    s.seat = -1;
    const side = v.yaw + Math.PI / 2;
    const ex = v.pos.x + Math.cos(side) * (VEHICLES[v.kind].radius + 1.5);
    const ez = v.pos.z + Math.sin(side) * (VEHICLES[v.kind].radius + 1.5);
    s.pos = isBlocked(this.map.grid, ex, ez) ? { ...v.pos } : { x: ex, y: 0, z: ez };
    this.emit({ type: 'vehicle_exit', pos: s.pos, soldierId: s.id });
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
    if (driverCmd && !stunned) {
      throttle = -driverCmd.moveZ; // W = forward
      turn = driverCmd.moveX;
      fire = driverCmd.fire;
      v.turretYaw = driverCmd.aimYaw;
      if (driverCmd.use && driver && this.time - driver.enteredVehicleAt > 0.3) this.exitVehicle(driver, v);
    }

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
    if (!def.immobile && !spooling) {
      // dead engine limps at 35% throttle response
      const engineMult = v.systems.engine > 0 ? 1 : 0.35;
      // a deep breacher shoves through packed earth — half pace
      const depthMult = def.digs && v.burrowed ? 0.5 : 1;
      // §8.6: the ground has a say — hover ignores it, legs read it like boots,
      // tracks shrug at what swallows wheels
      const surf = surfaceAt(this.map.surface, v.pos.x, v.pos.z);
      const tracked = v.kind === 'tank' || v.kind === 'apc' || v.kind === 'tunneler';
      const surfMult = (def.hover || def.flies ? 1
        : def.strider ? (SURF_SOLDIER[surf] ?? 1)
        : tracked ? (SURF_TRACKS[surf] ?? 1)
        : (SURF_WHEELS[surf] ?? 1))
        // §8.8 weather drags the drivetrain — dust chokes wheels, snow buries them
        * (def.hover || def.flies ? 1
          : moveMult(this.weather, def.strider ? 'soldier' : tracked ? 'tracks' : 'wheels'));
      v.yaw += turn * def.turnRate * dt * (throttle < 0 ? -1 : 1);
      const targetSpeed = throttle * def.speed * engineMult * depthMult * surfMult * (throttle < 0 ? 0.5 : 1);
      const accel = 18;
      const curSpeed = Math.cos(v.yaw) * v.vel.x + Math.sin(v.yaw) * v.vel.z;
      const newSpeed = curSpeed + Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - curSpeed));
      v.vel.x = Math.cos(v.yaw) * newSpeed;
      v.vel.z = Math.sin(v.yaw) * newSpeed;

      const nx = v.pos.x + v.vel.x * dt;
      const nz = v.pos.z + v.vel.z * dt;
      // boats are flat-bottomed: a shallow DRAFT (smaller collision probe)
      // lets the hull hug banks and moor beside causeways without pinning
      const r = def.boat ? def.radius * 0.55 : def.radius;
      // §8.8: a real storm grounds flyers — unless the ship is currently OVER
      // structure, in which case it may keep soaring until it finds clear
      // ground (never trap a hull inside a wall it legally flew onto)
      const stormGrounded = def.flies && airGrounded(this.weather) &&
        !isBlocked(this.map.grid, v.pos.x, v.pos.z, true);
      if ((def.flies && !stormGrounded) || (def.digs && v.burrowed)) {
        // flyers soar over everything; a deep breacher passes UNDER it all —
        // walls, cover, even water. Only the map border stops either.
        v.pos.x = nx;
        v.pos.z = nz;
      } else {
        // tunneler grinds the wall ahead into rubble instead of stopping
        if (def.digs && Math.abs(throttle) > 0.1 && this.time >= v.nextDigAt) {
          const aheadX = v.pos.x + Math.cos(v.yaw) * (r + TILE * 0.6) * Math.sign(throttle);
          const aheadZ = v.pos.z + Math.sin(v.yaw) * (r + TILE * 0.6) * Math.sign(throttle);
          const t = tileAt(this.map.grid, aheadX, aheadZ);
          if (DRILL_EATS.has(t)) {
            // structure is dinner — walls, cover, slits, doors, barricades all grind
            v.nextDigAt = this.time + 0.35; // loud, hungry surface work
            this.digTile(Math.floor((aheadX + WORLD / 2) / TILE), Math.floor((aheadZ + WORLD / 2) / TILE));
          } else if (t === T_METAL) {
            // metal says no: the drill screams and throws sparks, zero progress
            v.nextDigAt = this.time + 0.35;
            this.emit({ type: 'sparks', pos: { x: aheadX, y: 1.2, z: aheadZ } });
          }
        }
        const hover = !!def.hover;
        // striders (mech) step OVER low cover — only walls and water stop legs
        const blockedAt = def.boat
          // boats live ON the water: every land tile is their wall
          ? (x: number, z: number) => { const t = tileAt(this.map.grid, x, z); return t !== T_WATER && t !== T_DEEP; }
          : def.strider
            // legs step over HOP-tier cover, but the CLIMB and WALL tiers
            // (§8.7) are taller than a mech's stride — barricades, walls,
            // metal, and slits all say no
            ? (x: number, z: number) => { const t = tileAt(this.map.grid, x, z); return t === T_WALL || t === T_METAL || t === T_SLIT || t === T_CLIMB || t === T_DEEP; }
            : (x: number, z: number) => isBlocked(this.map.grid, x, z, hover);
        const clearAt = (x: number, z: number) =>
          !blockedAt(x + r, z) && !blockedAt(x - r, z) &&
          !blockedAt(x, z + r) && !blockedAt(x, z - r);
        if (clearAt(nx, v.pos.z)) v.pos.x = nx; else v.vel.x = 0;
        if (clearAt(v.pos.x, nz)) v.pos.z = nz; else v.vel.z = 0;
      }
      v.pos.x = Math.max(-WORLD / 2 + 3, Math.min(WORLD / 2 - 3, v.pos.x));
      v.pos.z = Math.max(-WORLD / 2 + 3, Math.min(WORLD / 2 - 3, v.pos.z));
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
      };
      this.projectiles.set(p.id, p);
      this.emit({ type: 'shot', pos: { ...p.pos }, weapon: def.weapon, soldierId: shooter.id });
    }
  }

  private nearestEnemyInRange(pos: Vec3, team: Team, range: number): Soldier | null {
    let best: Soldier | null = null, bestD = range;
    for (const s of this.soldiers.values()) {
      if (!s.alive || s.team === team || s.vehicleId >= 0 || (s.cloaked && !this.pinged.has(s.id))) continue;
      const d = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z);
      if (d < bestD && losClear(this.map.grid, { ...pos, y: 1.6 }, { ...s.pos, y: 1.2 })) { best = s; bestD = d; }
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
      if (d < bestD && losClear(this.map.grid, t.pos, s.pos, 1.4)) { best = s; bestD = d; }
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
        this.projectiles.set(p.id, p);
        this.emit({ type: 'shot', pos: { ...p.pos }, weapon: 'turret_mg', soldierId: t.ownerId });
      }
    }
  }

  // ---------- projectiles ----------

  /** Special payloads detonate into effects instead of damage. */
  private detonatePayload(p: Projectile): boolean {
    // generated arsenal payloads (smoke / phosphorus launchers)
    const payload = WEAPONS[p.weapon]?.payload;
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
      if (p.arc) p.vel.y -= this.gravity * 0.7 * tdt;
      p.pos.x += p.vel.x * tdt;
      p.pos.y += p.vel.y * tdt;
      p.pos.z += p.vel.z * tdt;

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
      // his designated answer, so two dials moved: the feed is +0.5/bullet,
      // and the ORBIT SATURATES — one round in five slips the debris ring, so
      // massed sustained fire still, eventually, gets through (§1.5: threat
      // buys HP, never immunity).
      if (!def.arc && def.tracer === 'bullet' && magnetars.length) {
        for (const m of magnetars) {
          if (m.team === p.team) continue;
          if (Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z) < 4) {
            if (this.rng.next() < 0.8) {
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
        if (blocksShot(this.map.grid, p.pos.x, p.pos.z, py) ||
            blocksShotUpper(this.map.grid2, p.pos.x, p.pos.z, p.pos.y)) {
          const ox = p.pos.x - p.vel.x * dt, oz = p.pos.z - p.vel.z * dt;
          const blockX = blocksShot(this.map.grid, p.pos.x, oz, py) || blocksShotUpper(this.map.grid2, p.pos.x, oz, p.pos.y);
          const blockZ = blocksShot(this.map.grid, ox, p.pos.z, py) || blocksShotUpper(this.map.grid2, ox, p.pos.z, p.pos.y);
          // reflect whichever axis ran into the wall; a clean corner clip
          // (neither axis alone blocked) sends it straight back
          if (blockX || !blockZ) { p.vel.x = -p.vel.x * 0.45; p.pos.x = ox; }
          if (blockZ || !blockX) { p.vel.z = -p.vel.z * 0.45; p.pos.z = oz; }
          p.vel.y *= 0.85; // the wall eats a little hop too
          this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, ownerId: p.ownerId });
        }
      }

      // hit terrain (either storey's walls)
      if (p.pos.y <= 0 || blocksShot(this.map.grid, p.pos.x, p.pos.z, Math.max(p.pos.y, 0)) ||
          blocksShotUpper(this.map.grid2, p.pos.x, p.pos.z, p.pos.y)) {
        if (this.detonatePayload(p)) { /* payload delivered */ }
        else if (def.splash > 0) this.explode(p.pos, def, p.ownerId, p.team);
        // no soldierId: nothing was TAGGED, so the HUD must stay quiet — but
        // the round still belongs to whoever threw it, and paint wears its
        // owner's shade wherever it lands
        else if (def.tracer !== 'beam') this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, ownerId: p.ownerId });
        dead = true;
      }

      // hit soldiers
      if (!dead) {
        for (const s of this.soldiers.values()) {
          if (!s.alive || s.vehicleId >= 0) continue;
          const friendly = s.team === p.team;
          if (def.heals ? !friendly : friendly) continue;
          if (s.id === p.ownerId) continue;
          const dy = (s.pos.y + 1.2) - p.pos.y;
          if (Math.abs(dy) > 1.8) continue;
          if (Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) < 0.9) {
            if (this.detonatePayload(p)) { dead = true; break; }
            if (def.knockback > 0 && !this.hasEquip(s, 'noKnockback')) {
              const kl = Math.hypot(p.vel.x, p.vel.z) || 1;
              s.pushX += (p.vel.x / kl) * def.knockback;
              s.pushZ += (p.vel.z / kl) * def.knockback;
              if (s.pos.y < 0.2) s.vel.y = Math.max(s.vel.y, def.knockback * 0.35);
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
              if (s.hp < s.maxHp) {
                const healed = Math.min(s.maxHp - s.hp, def.damage);
                s.hp += healed;
                const healer = this.soldiers.get(p.ownerId);
                if (healer) {
                  healer.score += 2;
                  healer.healGiven += healed; // trophy ledger
                }
                this.emit({ type: 'heal', pos: s.pos, soldierId: s.id });
              } else continue; // beam passes through full-health allies
            } else if (def.splash > 0) {
              this.explode(p.pos, def, p.ownerId, p.team);
            } else {
              // read the plate BEFORE the round resolves — damageSoldier eats
              // the armor, so asking afterward always says "bare"
              const bare = s.armor <= 0;
              // Ragebeast's rounds hit harder as he bleeds (rampage)
              const shooter = this.soldiers.get(p.ownerId);
              const dmg = def.damage * (shooter?.rageMul ?? 1);
              this.damageSoldier(s, dmg, p.ownerId, p.weapon);
              this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, soldierId: p.ownerId, bare });
            }
            // the RG-2 tag dart: sting like a bee, then GLOW — pinned on
            // every enemy screen until the dart burns out (stealth suit wins)
            if (def.tagsTarget && !friendly) {
              this.tagged.set(s.id, this.time + 5);
              this.emit({ type: 'psi_ping', pos: { ...s.pos }, soldierId: p.ownerId });
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
          if (Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) < r + 0.3 && p.pos.y < 3) {
            if (def.heals && v.team === p.team) {
              if (v.hp < v.maxHp && p.weapon === 'repair') {
                v.hp = Math.min(v.maxHp, v.hp + def.damage);
                this.emit({ type: 'heal', pos: v.pos });
                dead = true;
              }
              break;
            }
            if (v.team === p.team) break; // no friendly vehicle damage
            if (def.splash > 0) this.explode(p.pos, def, p.ownerId, p.team);
            else {
              this.damageVehicle(v, def.damage, p.ownerId, p.weapon);
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
            if (def.splash > 0) this.explode(p.pos, def, p.ownerId, p.team);
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
        else if (!dead && def.splash > 0 && p.arc) this.explode(p.pos, def, p.ownerId, p.team); // grenades detonate on timeout
        this.projectiles.delete(id);
      }
    }
  }

  explode(pos: Vec3, def: (typeof WEAPONS)[WeaponId], ownerId: number, team: Team) {
    this.emit({ type: 'explosion', pos: { ...pos }, weapon: def.id });
    const owner = this.soldiers.get(ownerId);
    for (const s of this.soldiers.values()) {
      if (!s.alive || s.vehicleId >= 0) continue;
      if (this.time < s.protectedUntil) continue; // spawn protection: no damage, no shove (55B)
      if (Math.abs(s.pos.y - pos.y) > 3.4) continue; // the floor slab eats cross-storey blasts
      const d = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z);
      if (d < def.splash) {
        const isSelf = s.id === ownerId;
        if (!isSelf && s.team === team) continue; // no friendly splash, self-damage yes
        const dmg = (def.splashDamage + (d < 1 ? def.damage : 0)) * (1 - d / def.splash) * (isSelf ? 0.6 : 1);
        if (def.knockback > 0 && !this.hasEquip(s, 'noKnockback')) {
          const dl = Math.max(d, 0.5);
          s.pushX += ((s.pos.x - pos.x) / dl) * def.knockback * (1 - d / def.splash);
          s.pushZ += ((s.pos.z - pos.z) / dl) * def.knockback * (1 - d / def.splash);
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
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z);
      if (d < def.splash + VEHICLES[v.kind].radius) {
        this.damageVehicle(v, (def.splashDamage + def.damage * 0.5) * (1 - d / (def.splash + 2)), ownerId, def.id);
      }
    }
    for (const t of this.turrets.values()) {
      if (!t.alive || t.team === team) continue;
      const d = Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z);
      if (d < def.splash + 1) this.damageTurret(t, def.splashDamage * (1 - d / (def.splash + 1)));
    }
    // doors in the blast take demolition damage — grenades, tank shells, and
    // bomber zeds are all door keys, just louder ones than E
    if (def.splash > 0 && def.splashDamage > 0) {
      const r = Math.ceil(def.splash / TILE) + 1;
      const ctx = Math.floor((pos.x + WORLD / 2) / TILE), ctz = Math.floor((pos.z + WORLD / 2) / TILE);
      for (let tz = Math.max(1, ctz - r); tz <= Math.min(GRID - 2, ctz + r); tz++) {
        for (let tx = Math.max(1, ctx - r); tx <= Math.min(GRID - 2, ctx + r); tx++) {
          const idx = tz * GRID + tx;
          const g = this.map.grid[idx];
          const d = Math.hypot((tx + 0.5) * TILE - WORLD / 2 - pos.x, (tz + 0.5) * TILE - WORLD / 2 - pos.z);
          if (d >= def.splash + TILE * 0.5) continue;
          if (g === T_DOOR || g === T_DOOR_OPEN) {
            // ×1.5: dumb wood takes a blast worse than a dodging soldier does
            this.damageDoor(idx, (def.splashDamage + def.damage * 0.5) * 1.5 * (1 - d / (def.splash + TILE)), ownerId);
          } else {
            // DESTRUCTION: masonry in the blast takes the same ledger hit.
            // HEAVY (120mm-class, damage ≥ 100) breaches structure; anything
            // with real splash chips soft cover. damageWall sorts the tiers.
            this.damageWall(tx, tz, (def.splashDamage + def.damage * 0.5) * (1 - d / (def.splash + TILE)), def.damage >= 100);
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
  encaseSoldier(victim: Soldier): boolean {
    if (!victim.alive || victim.encasedUntil !== undefined) return false;
    if (this.time < victim.protectedUntil) return false;
    victim.encasedUntil = this.time + ICE_HOLD;
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
    s.encasedUntil = undefined;
    s.struggle = undefined;
    this.emit({ type: 'revived', pos: { ...s.pos }, soldierId: s.id }); // "the ice gives"
    if (cost > 0) this.damageSoldier(s, cost, s.lastKillerId, 'bleedout');
  }

  damageSoldier(victim: Soldier, dmg: number, attackerId: number, weapon: WeaponId, viaLink = false) {
    if (!victim.alive || dmg <= 0) return;
    if (this.time < victim.protectedUntil) return; // spawn protection (55B)
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
    // LEVIATHAN IS SOFT MID-AIR: the belly flop is the AA window — every
    // round that finds him between leap and landing bites 1.6x deeper
    if (victim.ascendant === 'leviathan' && victim.diveAt !== undefined) {
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
    // issued plate takes the hit first; whatever punches through reaches flesh
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, dmg);
      victim.armor -= absorbed;
      dmg -= absorbed;
      if (dmg <= 0) return; // the plate held
    }
    victim.hp -= dmg;
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
      const attacker = this.soldiers.get(attackerId);
      // the killcam frames the duel — remember who fired the killing blow
      victim.lastKillerId = attacker && attacker.id !== victim.id ? attacker.id : -1;
      if (attacker && attacker.id !== victim.id) {
        attacker.kills++;
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
        if (range > attacker.longestKill) attacker.longestKill = Math.round(range * 10) / 10;
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
      this.emit({
        type: 'death', pos: { ...victim.pos }, soldierId: victim.id,
        killerName: attacker && attacker.id !== victim.id ? attacker.name : undefined,
        victimName: victim.name,
        killerTeam: attacker?.team,
        weaponName: WEAPONS[weapon]?.name,
        classId: victim.kind === 'human' || victim.kind === 'bot' ? victim.classId : undefined,
        fallX: fx, fallZ: fz,
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
      v.respawnAt = this.time + VEHICLE_RESPAWN;
      this.emit({ type: 'vehicle_destroyed', pos: { ...v.pos } });
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

  stepMines(_dt: number) {
    for (const [id, m] of this.mines) {
      if (this.time < m.armedAt) continue;
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

  stepPickups(_dt: number) {
    for (const pk of this.pickups.values()) {
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
    this.projectiles.set(p.id, p);
    this.emit({ type: 'shot', pos: { ...s.pos }, weapon: 'spitter_acid', soldierId: s.id });
  }

  // ---------- queries ----------

  humansAndBots(): Soldier[] {
    return [...this.soldiers.values()].filter((s) => s.kind === 'human' || s.kind === 'bot');
  }

  livingEnemiesOf(team: Team): Soldier[] {
    return [...this.soldiers.values()].filter((s) => s.alive && s.team !== team);
  }
}
