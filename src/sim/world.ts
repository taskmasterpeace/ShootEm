import { CLASSES, EQUIPMENT, SAM_SPEED_RATIO, THEMES, VEHICLES, WEAPONS, ZOMBIE_STATS } from './data';
import { CLASS_ARMORY, familyWeapons } from './arsenal';
import { GRID, T_COVER, T_OPEN, T_WALL, TILE, WORLD, blocksShot, generateMap, isBlocked, losClear, tileAt, type GameMap } from './map';
import { Rng } from './rng';
import {
  SYSTEM_IDS, isCoopMode, isZed,
  type ClassId, type Gadget, type GadgetType, type Mine, type ModeId, type ModeState,
  type Pickup, type PlayerCmd, type Projectile, type SimEvent, type Soldier,
  type SoldierKind, type SystemId, type Team, type ThemeId, type Turret, type Vec3,
  type Vehicle, type VehicleKind, type VehicleSystems, type WeaponId, type ZedKind,
} from './types';
import { stepMode, initMode } from './modes';
import { stepBot, stepScientist, stepZombie } from './bots';

const RESPAWN_DELAY = 4;
const VEHICLE_RESPAWN = 22;
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
export const HAND_FRAG_REACH = 22;
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
  /** soldier ids currently hidden inside smoke fields */
  smoked = new Set<number>();
  /** tile indices the tunneler has ground to rubble (replicated to clients) */
  dug: number[] = [];
  nextPodAt = 75;
  events: SimEvent[] = [];
  private nextId = 1;

  constructor(public opts: WorldOptions) {
    this.rng = new Rng(opts.seed ^ 0xbeef);
    this.map = generateMap(opts.seed, opts.mode, opts.theme ?? 'savanna');
    this.gravity = THEMES[this.map.theme].gravity;
    this.mode = initMode(opts.mode, this.map, opts.matchMinutes);
    // vehicles on pads. Co-op zombie modes field only squad support —
    // the ambulance and the emplacement guns — no armor column.
    for (const pad of this.map.vehiclePads) {
      if (isCoopMode(opts.mode) && pad.kind !== 'ambulance' && pad.kind !== 'emplacement') continue;
      this.spawnVehicle(pad.kind, pad.team, pad.pos);
    }
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

  /** Grind a wall/cover tile to open ground (tunneler). */
  digTile(tx: number, tz: number) {
    if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) return; // border holds
    const idx = tz * GRID + tx;
    const t = this.map.grid[idx];
    if (t !== T_WALL && t !== T_COVER) return;
    this.map.grid[idx] = T_OPEN;
    this.dug.push(idx);
    this.emit({
      type: 'dig', tile: idx,
      pos: { x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 },
    });
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
      grenades: classId === 'infantry' ? 4 : classId === 'engineer' ? 3 : 2,
      nextGrenadeAt: 0, cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0,
      longestKill: 0, vehicleKills: 0, healGiven: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0, manpads: 0, lastKillerId: -1,
      armor: 0, maxArmor: 0,
      equipment: (loadout?.equipment ?? []).filter((id) => EQUIPMENT[id]).slice(0, 2),
      medikitReady: true, nextPsiAt: 0, nextRepairAt: 0,
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    this.soldiers.set(s.id, s);
    this.spawn(s);
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
      cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0,
      longestKill: 0, vehicleKills: 0, healGiven: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0, manpads: 0, lastKillerId: -1,
      armor: 0, maxArmor: 0,
      equipment: [], medikitReady: false, nextPsiAt: 0, nextRepairAt: 0,
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
      cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0,
      longestKill: 0, vehicleKills: 0, healGiven: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0, manpads: 0, lastKillerId: -1,
      armor: 0, maxArmor: 0,
      equipment: [], medikitReady: false, nextPsiAt: 0, nextRepairAt: 0,
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    this.soldiers.set(s.id, s);
    return s;
  }

  spawn(s: Soldier) {
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
    // keep the soldier's chosen armory loadout across respawns
    const primary = s.weapons[0] && WEAPONS[s.weapons[0]] ? s.weapons[0] : c.primary;
    const secondary = s.weapons[1] && WEAPONS[s.weapons[1]] ? s.weapons[1] : c.secondary;
    s.weapons = [primary, secondary];
    s.clip = [WEAPONS[primary].clip, WEAPONS[secondary].clip];
    s.reserve = [WEAPONS[primary].reserve, WEAPONS[secondary].reserve];
    s.grenades = this.hasEquip(s, 'demoCharge') ? 3 : s.classId === 'infantry' ? 4 : s.classId === 'engineer' ? 3 : 2;
    s.manpads = this.hasEquip(s, 'samLauncher') ? MANPADS_ROUNDS : 0;
    s.medikitReady = true;
    // mobile spawn: a crewed APC or transport with a LIVE comms system
    const mobile = [...this.vehicles.values()].find(
      (v) => v.alive && v.team === s.team && VEHICLES[v.kind].mobileSpawn &&
        v.systems.comms > 0 && v.seats.some((id) => id >= 0),
    );
    const spawnList = this.map.spawns[s.team];
    const base = mobile && this.rng.next() < 0.5 ? mobile.pos : spawnList[this.rng.int(0, spawnList.length - 1)];
    s.pos = { x: base.x + this.rng.range(-1.5, 1.5), y: 0, z: base.z + this.rng.range(-1.5, 1.5) };
    s.vel = { x: 0, y: 0, z: 0 };
    this.emit({ type: 'respawn', pos: s.pos, soldierId: s.id });
  }

  private freshSystems(kind: VehicleKind): VehicleSystems {
    const hp = VEHICLES[kind].systemHp ?? 60;
    const out = {} as VehicleSystems;
    for (const id of SYSTEM_IDS) out[id] = hp;
    return out;
  }

  spawnVehicle(kind: VehicleKind, team: Team, padPos: Vec3): Vehicle {
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

    // recon state rebuilds every tick: pings accumulate from beacons, drones,
    // cameras, crewed sensor stations, and psi scanners; then smoke fields,
    // stealth suits, and crewed ECM stations strip entries back out.
    this.pinged.clear();
    this.smoked.clear();

    for (const s of this.soldiers.values()) {
      if (!s.alive) {
        if (s.kind !== 'human' && s.kind !== 'bot') continue; // dead zombies removed elsewhere
        if (this.time >= s.respawnAt && !this.mode.over) this.spawn(s);
        continue;
      }
      let cmd = cmds.get(s.id);
      if (!cmd) {
        if (s.kind === 'bot') cmd = stepBot(this, s, dt);
        else if (s.kind === 'scientist') { stepScientist(this, s, dt); continue; }
        else if (isZed(s.kind)) { stepZombie(this, s, dt); continue; }
        else cmd = null as unknown as PlayerCmd;
      }
      if (cmd) this.applyCmd(s, cmd, dt);
      this.stepEquipment(s);
      this.stepSoldierPhysics(s, dt);
    }

    // purge removed zombies
    for (const [id, s] of this.soldiers) {
      if (!s.alive && s.kind !== 'human' && s.kind !== 'bot' && this.time > s.respawnAt) this.soldiers.delete(id);
    }

    for (const v of this.vehicles.values()) this.stepVehicle(v, cmds, dt);
    for (const t of this.turrets.values()) this.stepTurret(t, dt);
    this.stepProjectiles(dt);
    this.stepMines(dt);
    this.stepPickups(dt);
    this.stepGadgets(dt);
    this.stepGatesAndLifts();
    this.stepSupplyPods();
    this.applyReconCountermeasures();
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
      if (!s.alive || s.vehicleId >= 0 || (s.kind !== 'human' && s.kind !== 'bot')) continue;
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
        case 'smoke_field': {
          // soldiers inside are hidden from minimap and pings
          for (const s of this.soldiers.values()) {
            if (!s.alive) continue;
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

  empBlast(pos: Vec3, team: Team, _ownerId: number) {
    this.emit({ type: 'emp', pos: { ...pos } });
    // EMP is the counter-drone weapon: any enemy drone in the burst loses link
    for (const g of this.gadgets.values()) {
      if (g.type !== 'drone' || g.team === team) continue;
      if (Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) < 10) this.crashDrone(g);
    }
    for (const v of this.vehicles.values()) {
      if (!v.alive || v.team === team) continue;
      if (Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) < 8) v.stunnedUntil = this.time + 4;
    }
    for (const t of this.turrets.values()) {
      if (!t.alive || t.team === team) continue;
      if (Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z) < 8) t.nextFireAt = Math.max(t.nextFireAt, this.time + 5);
    }
    for (const s of this.soldiers.values()) {
      if (!s.alive || s.team === team) continue;
      if (Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z) < 8) {
        s.cloaked = false;
        s.energy = 0;
      }
    }
    for (const [gid, g] of this.gadgets) {
      if (g.team === team) continue;
      if (Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) < 8) {
        if (g.type === 'drone') { this.gadgets.delete(gid); this.emit({ type: 'gadget_destroyed', pos: g.pos }); }
        if (g.type === 'shield') { g.hp -= 150; if (g.hp <= 0) { this.gadgets.delete(gid); this.emit({ type: 'gadget_destroyed', pos: g.pos }); } }
      }
    }
  }

  // ---------- soldiers ----------

  applyCmd(s: Soldier, cmd: PlayerCmd, dt: number) {
    s.yaw = cmd.aimYaw;

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

    if (cmd.use) {
      if (this.opts.mode === 'safehouse' && this.toggleEscort(s)) {
        // E next to the scientist toggles escort instead of vehicle entry
      } else if (this.tryWarpBeacon(s)) {
        // E on a warp beacon teleports to its twin
      } else if (this.tryFieldKit(s)) {
        // E with a mechanic kit repairs; with a hacking kit converts a sentry
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

    // reload
    if (cmd.reload && s.clip[s.weaponIdx] < def.clip && s.reserve[s.weaponIdx] > 0 && this.time > s.reloadUntil) {
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
    let speed = c.speed;
    if (s.cloaked) speed *= 0.8;
    for (const eid of s.equipment) {
      const e = EQUIPMENT[eid];
      if (e?.speedMult) speed *= e.speedMult;
    }
    const mx = cmd.moveX, mz = cmd.moveZ;
    const len = Math.hypot(mx, mz) || 1;
    s.vel.x = (mx / len) * speed;
    s.vel.z = (mz / len) * speed;

    // jetpack (jump troopers) / hop for everyone
    if (cmd.jump) {
      if (c.ability === 'jetpack' && s.energy > 1) {
        s.vel.y = JET_THRUST;
        s.energy = Math.max(0, s.energy - JET_DRAIN * dt);
        if (this.tick % 6 === 0) this.emit({ type: 'jetpack', pos: s.pos, soldierId: s.id });
      } else if (s.pos.y <= 0.01) {
        s.vel.y = 7;
      }
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
      s.energy = Math.min(100, s.energy + ENERGY_REGEN * dt);
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
    if (cmd.grenade && this.time >= s.nextGrenadeAt) {
      const reachTo = (max: number) => Math.max(4, Math.min(cmd.aimDist ?? max, max));
      // manpads only claims the key while an aircraft is locked — no lock, no wasted round
      const samTarget = s.manpads > 0 && this.hasEquip(s, 'samLauncher') ? this.samLockTarget(s) : null;
      if (s.orbitals > 0) {
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
        // hand-thrown frag: lands on the cursor, max ~22u (not the full GL-40 lob)
        this.throwProjectile(s, 'gl', 1.4, 16, true, reachTo(HAND_FRAG_REACH));
        this.emit({ type: 'shot', pos: s.pos, weapon: 'gl', soldierId: s.id });
        if (s.cloaked) { s.cloaked = false; }
      }
    }

    // firing
    if (cmd.fire && s.reloadUntil === 0 && this.time >= s.nextFireAt) {
      if (s.clip[s.weaponIdx] > 0) {
        this.fireSoldierWeapon(s, wid, def);
      } else if (s.reserve[s.weaponIdx] > 0) {
        s.reloadUntil = this.time + def.reloadTime;
        this.emit({ type: 'reload', pos: s.pos, soldierId: s.id });
      }
    }
  }

  fireSoldierWeapon(s: Soldier, wid: WeaponId, def = WEAPONS[wid]) {
    s.nextFireAt = this.time + 1 / def.rof;
    if (Number.isFinite(s.clip[s.weaponIdx])) s.clip[s.weaponIdx]--;
    if (s.cloaked) s.cloaked = false;

    if (def.range <= 2.5) { // melee (zombie claws)
      this.meleeAttack(s, def);
      return;
    }
    for (let p = 0; p < def.pellets; p++) {
      this.throwProjectile(s, wid, 1.4, def.speed, def.arc);
    }
    this.emit({ type: 'shot', pos: { ...s.pos, y: s.pos.y + 1.4 }, weapon: wid, soldierId: s.id });
  }

  meleeAttack(s: Soldier, def: (typeof WEAPONS)[WeaponId]) {
    for (const other of this.soldiers.values()) {
      if (!other.alive || other.team === s.team) continue;
      const d = Math.hypot(other.pos.x - s.pos.x, other.pos.z - s.pos.z);
      if (d <= def.range + 0.6) {
        this.damageSoldier(other, def.damage, s.id, def.id);
        this.emit({ type: 'shot', pos: s.pos, weapon: def.id, soldierId: s.id });
        return;
      }
    }
  }

  /**
   * Fire a projectile. `reach` is the intended max distance (defaults to the
   * weapon's range); for arcs it drives the launch angle so the shot actually
   * LANDS at that distance instead of a fixed short ballistic. A caller can
   * pass a shorter reach for a soft toss (e.g. the hand-thrown frag).
   */
  throwProjectile(s: Soldier, wid: WeaponId, muzzleY: number, speed: number, arc: boolean, reach = WEAPONS[wid].range) {
    const def = WEAPONS[wid];
    const spread = (this.rng.next() - 0.5) * 2 * def.spread;
    const yaw = s.yaw + spread;
    // Arc launch: pick vy so the shell returns to the ground exactly when it
    // has travelled `reach` horizontally. Flight time t = reach/speed; solving
    // muzzleY + vy·t − ½·g·t² = 0 gives vy = ½·g·t − muzzleY/t. Uses the live
    // (per-theme) gravity, so low-g worlds lob correctly too.
    let vy = 0;
    if (arc) {
      const gArc = this.gravity * 0.7;
      const t = reach / Math.max(speed, 1);
      vy = 0.5 * gArc * t - muzzleY / t;
      if (vy < 2) {
        // short lob: forcing the vy floor would overshoot — keep the floor and
        // slow the toss so it still lands exactly at `reach` (cursor-accurate)
        vy = 2;
        const tLand = (vy + Math.sqrt(vy * vy + 2 * gArc * muzzleY)) / gArc;
        speed = reach / tLand;
      }
    }
    const p: Projectile = {
      id: this.id(), weapon: wid, ownerId: s.id, team: s.team,
      pos: { x: s.pos.x + Math.cos(yaw) * 0.8, y: s.pos.y + muzzleY, z: s.pos.z + Math.sin(yaw) * 0.8 },
      vel: { x: Math.cos(yaw) * speed, y: vy, z: Math.sin(yaw) * speed },
      bornAt: this.time, ttl: reach / Math.max(speed, 1) + (arc ? 1.4 : 0), arc,
    };
    this.projectiles.set(p.id, p);
  }

  // ---------- anti-air ----------

  /** A flyer with a pilot aboard counts as airborne; an empty one is parked on its pad. */
  vehicleAirborne(v: Vehicle): boolean {
    return v.alive && !!VEHICLES[v.kind].flies && v.seats[0] >= 0;
  }

  /** Nearest airborne enemy aircraft inside the launcher's IR cone. */
  samLockTarget(s: Soldier): Vehicle | null {
    let best: Vehicle | null = null, bestD = SAM_LOCK_RANGE;
    for (const v of this.vehicles.values()) {
      if (v.team === s.team || !this.vehicleAirborne(v)) continue;
      const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
      if (d >= bestD) continue;
      let da = Math.atan2(v.pos.z - s.pos.z, v.pos.x - s.pos.x) - s.yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= SAM_LOCK_CONE) { best = v; bestD = d; }
    }
    return best;
  }

  /**
   * Send the bird. Speed derives from the flyer's top speed at launch —
   * SAM_SPEED_RATIO keeps it ~8% slower, so straight flight always escapes.
   */
  fireSamMissile(s: Soldier, target: Vehicle) {
    const def = WEAPONS.sam_missile;
    const speed = VEHICLES.flyer.speed * SAM_SPEED_RATIO;
    const yaw = Math.atan2(target.pos.z - s.pos.z, target.pos.x - s.pos.x);
    const p: Projectile = {
      id: this.id(), weapon: 'sam_missile', ownerId: s.id, team: s.team,
      pos: { x: s.pos.x + Math.cos(yaw) * 0.8, y: s.pos.y + 1.6, z: s.pos.z + Math.sin(yaw) * 0.8 },
      vel: { x: Math.cos(yaw) * speed, y: 0, z: Math.sin(yaw) * speed },
      bornAt: this.time, ttl: def.range / speed, arc: false,
      homingVehicleId: target.id,
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
    // gravity + vertical (theme gravity: Europa jumps are glorious)
    if (s.pos.y > 0 || s.vel.y > 0) {
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
    const nx = s.pos.x + (s.vel.x + s.pushX) * dt;
    const nz = s.pos.z + (s.vel.z + s.pushZ) * dt;
    const airborne = s.pos.y > 1.5; // jetpackers clear low cover but not walls
    const blockedX = airborne
      ? tileAt(this.map.grid, nx, s.pos.z) === 1
      : isBlocked(this.map.grid, nx, s.pos.z);
    const blockedZ = airborne
      ? tileAt(this.map.grid, s.pos.x, nz) === 1
      : isBlocked(this.map.grid, s.pos.x, nz);
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
        if (!v.alive || v.team !== s.team || v.hp >= v.maxHp) continue;
        if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < VEHICLES[v.kind].radius + 2.5) {
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

  tryEnterVehicle(s: Soldier) {
    for (const v of this.vehicles.values()) {
      if (!v.alive || v.team !== s.team) continue;
      const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
      if (d < VEHICLES[v.kind].radius + 2.2) {
        const seat = v.seats.indexOf(-1);
        if (seat >= 0) {
          v.seats[seat] = s.id;
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

  stepVehicle(v: Vehicle, cmds: Map<number, PlayerCmd>, dt: number) {
    if (!v.alive) {
      if (this.time >= v.respawnAt && !this.mode.over) {
        // co-op support vehicles respawn too; battle vehicles only outside co-op
        const support = v.kind === 'ambulance' || v.kind === 'emplacement';
        if (isCoopMode(this.opts.mode) && !support) return;
        const def = VEHICLES[v.kind];
        v.alive = true; v.hp = def.hp; v.maxHp = def.hp;
        v.pos = { ...v.padPos }; v.vel = { x: 0, y: 0, z: 0 };
        v.yaw = v.team === 0 ? 0 : Math.PI;
        v.seats.fill(-1);
        v.systems = this.freshSystems(v.kind);
        v.burrowed = false; // wrecks come back surfaced
        v.flares = FLARES_PER_LIFE;
      }
      return;
    }
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
      v.yaw += turn * def.turnRate * dt * (throttle < 0 ? -1 : 1);
      const targetSpeed = throttle * def.speed * engineMult * depthMult * (throttle < 0 ? 0.5 : 1);
      const accel = 18;
      const curSpeed = Math.cos(v.yaw) * v.vel.x + Math.sin(v.yaw) * v.vel.z;
      const newSpeed = curSpeed + Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - curSpeed));
      v.vel.x = Math.cos(v.yaw) * newSpeed;
      v.vel.z = Math.sin(v.yaw) * newSpeed;

      const nx = v.pos.x + v.vel.x * dt;
      const nz = v.pos.z + v.vel.z * dt;
      const r = def.radius;
      if (def.flies || (def.digs && v.burrowed)) {
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
          if (t === T_WALL || t === T_COVER) {
            v.nextDigAt = this.time + 0.35; // loud, hungry surface work
            this.digTile(Math.floor((aheadX + WORLD / 2) / TILE), Math.floor((aheadZ + WORLD / 2) / TILE));
          }
        }
        const hover = !!def.hover;
        const clearAt = (x: number, z: number) =>
          !isBlocked(this.map.grid, x + r, z, hover) && !isBlocked(this.map.grid, x - r, z, hover) &&
          !isBlocked(this.map.grid, x, z + r, hover) && !isBlocked(this.map.grid, x, z - r, hover);
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
        if (!s.alive || s.team !== v.team || s.hp >= s.maxHp) continue;
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
    for (const [id, p] of this.projectiles) {
      const def = WEAPONS[p.weapon];
      // heat-seekers steer before they move; true = spent on a flare
      if ((p.homingVehicleId !== undefined || p.homingFlareId !== undefined) && this.steerMissile(p, dt)) {
        this.projectiles.delete(id);
        continue;
      }
      if (p.arc) p.vel.y -= this.gravity * 0.7 * dt;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;

      let dead = false;

      // enemy shield domes swallow projectiles; FPV drones can be shot down
      if (!def.heals) {
        for (const [gid, g] of this.gadgets) {
          if (g.team === p.team) continue;
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
            g.hp -= def.damage + def.splashDamage * 0.5;
            this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon });
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

      // hit terrain
      if (p.pos.y <= 0 || blocksShot(this.map.grid, p.pos.x, p.pos.z, Math.max(p.pos.y, 0))) {
        if (this.detonatePayload(p)) { /* payload delivered */ }
        else if (def.splash > 0) this.explode(p.pos, def, p.ownerId, p.team);
        else if (def.tracer !== 'beam') this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon });
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
              this.damageSoldier(s, def.damage, p.ownerId, p.weapon);
              this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, soldierId: p.ownerId });
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
    if (owner) { /* no-op: kill credit handled in damage fns */ }
  }

  // ---------- damage ----------

  damageSoldier(victim: Soldier, dmg: number, attackerId: number, weapon: WeaponId) {
    if (!victim.alive || dmg <= 0) return;
    if (victim.cloaked) victim.cloaked = false;
    // issued plate takes the hit first; whatever punches through reaches flesh
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, dmg);
      victim.armor -= absorbed;
      dmg -= absorbed;
      if (dmg <= 0) return; // the plate held
    }
    victim.hp -= dmg;
    // combat medikit auto-triggers once per life below 25%
    if (victim.hp > 0 && victim.medikitReady && victim.hp < victim.maxHp * 0.25 && this.hasEquip(victim, 'autoMedikit')) {
      victim.medikitReady = false;
      victim.hp = Math.min(victim.maxHp, victim.hp + 45);
      this.emit({ type: 'heal', pos: victim.pos, soldierId: victim.id });
    }
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.respawnAt = this.time + (isZed(victim.kind) ? 2 : RESPAWN_DELAY);
      const attacker = this.soldiers.get(attackerId);
      // the killcam frames the duel — remember who fired the killing blow
      victim.lastKillerId = attacker && attacker.id !== victim.id ? attacker.id : -1;
      if (attacker && attacker.id !== victim.id) {
        attacker.kills++;
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
        if (!s.alive || isZed(s.kind) || s.vehicleId >= 0) continue;
        if (Math.hypot(s.pos.x - pk.pos.x, s.pos.z - pk.pos.z) < 1.6) {
          let used = false;
          if (pk.type === 'medkit' && s.hp < s.maxHp) { s.hp = Math.min(s.maxHp, s.hp + 50); used = true; }
          if (pk.type === 'energy' && s.energy < 100) { s.energy = 100; s.grenades = Math.min(s.grenades + 1, 4); used = true; }
          if (pk.type === 'ammo') {
            for (let i = 0; i < s.weapons.length; i++) {
              const def = WEAPONS[s.weapons[i]];
              if (Number.isFinite(def.reserve)) s.reserve[i] = def.reserve;
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
