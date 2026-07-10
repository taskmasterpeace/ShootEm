import { CLASSES, VEHICLES, WEAPONS, ZOMBIE_STATS } from './data';
import { GRID, T_WATER, TILE, WORLD, blocksShot, generateMap, isBlocked, losClear, tileAt, type GameMap } from './map';
import { Rng } from './rng';
import {
  isCoopMode, isZed,
  type ClassId, type Gadget, type GadgetType, type Mine, type ModeId, type ModeState,
  type Pickup, type PlayerCmd, type Projectile, type SimEvent, type Soldier,
  type SoldierKind, type Team, type Turret, type Vec3, type Vehicle, type VehicleKind,
  type WeaponId, type ZedKind,
} from './types';
import { stepMode, initMode } from './modes';
import { stepBot, stepScientist, stepZombie } from './bots';

const GRAVITY = 22;
const RESPAWN_DELAY = 4;
const VEHICLE_RESPAWN = 22;
const ENERGY_REGEN = 14;
const CLOAK_DRAIN = 11;
const JET_DRAIN = 30;
const JET_THRUST = 9.5;
const PICKUP_RESPAWN = 18;

export type Difficulty = 'recruit' | 'veteran' | 'elite';

export interface WorldOptions {
  seed: number;
  mode: ModeId;
  botsPerTeam?: number;
  difficulty?: Difficulty;
  matchMinutes?: number;
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
  soldiers = new Map<number, Soldier>();
  vehicles = new Map<number, Vehicle>();
  turrets = new Map<number, Turret>();
  projectiles = new Map<number, Projectile>();
  pickups = new Map<number, Pickup>();
  mines = new Map<number, Mine>();
  gadgets = new Map<number, Gadget>();
  /** soldier ids currently revealed by targeting beacons / recon drones */
  pinged = new Set<number>();
  nextPodAt = 75;
  events: SimEvent[] = [];
  private nextId = 1;

  constructor(public opts: WorldOptions) {
    this.rng = new Rng(opts.seed ^ 0xbeef);
    this.map = generateMap(opts.seed, opts.mode);
    this.mode = initMode(opts.mode, this.map, opts.matchMinutes);
    // vehicles on pads (no vehicles in co-op zombie modes — infantry holdout)
    if (!isCoopMode(opts.mode)) {
      for (const pad of this.map.vehiclePads) this.spawnVehicle(pad.kind, pad.team, pad.pos);
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

  id(): number { return this.nextId++; }

  emit(e: SimEvent) { this.events.push(e); }

  takeEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------- population ----------

  addSoldier(name: string, classId: ClassId, team: Team, kind: SoldierKind): Soldier {
    const c = CLASSES[classId];
    const s: Soldier = {
      id: this.id(), kind, name, team, classId,
      pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0,
      hp: c.hp, maxHp: c.hp, energy: 100, alive: false, respawnAt: 0,
      weaponIdx: 0, weapons: [c.primary, c.secondary],
      clip: [WEAPONS[c.primary].clip, WEAPONS[c.secondary].clip],
      reserve: [WEAPONS[c.primary].reserve, WEAPONS[c.secondary].reserve],
      reloadUntil: 0, nextFireAt: 0,
      grenades: classId === 'infantry' ? 4 : classId === 'engineer' ? 3 : 2,
      nextGrenadeAt: 0, cloaked: false, vehicleId: -1, seat: -1, enteredVehicleAt: 0,
      kills: 0, deaths: 0, score: 0, carryingFlag: -1, nextAbilityAt: 0,
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0,
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
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0,
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
      pushX: 0, pushZ: 0, nextWarpAt: 0, orbitals: 0,
      botGoal: null, botRepathAt: 0, botTargetId: -1, botStrafeDir: 1,
    };
    this.soldiers.set(s.id, s);
    return s;
  }

  spawn(s: Soldier) {
    const c = CLASSES[s.classId];
    s.hp = c.hp; s.maxHp = c.hp; s.energy = 100;
    s.alive = true; s.cloaked = false; s.vehicleId = -1; s.seat = -1;
    s.carryingFlag = -1;
    s.weaponIdx = 0;
    s.weapons = [c.primary, c.secondary];
    s.clip = [WEAPONS[c.primary].clip, WEAPONS[c.secondary].clip];
    s.reserve = [WEAPONS[c.primary].reserve, WEAPONS[c.secondary].reserve];
    s.grenades = s.classId === 'infantry' ? 4 : s.classId === 'engineer' ? 3 : 2;
    // APC mobile spawn takes priority when deep in a match
    const apc = [...this.vehicles.values()].find(
      (v) => v.alive && v.kind === 'apc' && v.team === s.team && VEHICLES.apc.mobileSpawn && v.seats.some((id) => id >= 0),
    );
    const spawnList = this.map.spawns[s.team];
    const base = apc && this.rng.next() < 0.5 ? apc.pos : spawnList[this.rng.int(0, spawnList.length - 1)];
    s.pos = { x: base.x + this.rng.range(-1.5, 1.5), y: 0, z: base.z + this.rng.range(-1.5, 1.5) };
    s.vel = { x: 0, y: 0, z: 0 };
    this.emit({ type: 'respawn', pos: s.pos, soldierId: s.id });
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
    this.pinged.clear();
    for (const [id, g] of this.gadgets) {
      switch (g.type) {
        case 'target_beacon': {
          for (const s of this.soldiers.values()) {
            if (!s.alive || s.team === g.team) continue;
            if (Math.hypot(s.pos.x - g.pos.x, s.pos.z - g.pos.z) < 25) this.pinged.add(s.id);
          }
          break;
        }
        case 'drone': {
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
  empBlast(pos: Vec3, team: Team, ownerId: number) {
    this.emit({ type: 'emp', pos: { ...pos } });
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
      return;
    }

    if (cmd.use) {
      if (this.opts.mode === 'safehouse' && this.toggleEscort(s)) {
        // E next to the scientist toggles escort instead of vehicle entry
      } else if (this.tryWarpBeacon(s)) {
        // E on a warp beacon teleports to its twin
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

    // movement intent
    const c = CLASSES[s.classId];
    let speed = c.speed;
    if (s.cloaked) speed *= 0.8;
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
      const g = this.spawnGadget('drone', s.team, s.id, s.pos, 80);
      g.anchor = { ...s.pos };
      g.phase = this.rng.range(0, Math.PI * 2);
      s.energy -= 70;
      s.nextAbilityAt = this.time + 2;
      this.emit({ type: 'beacon_planted', pos: g.pos, soldierId: s.id, text: 'Recon drone deployed' });
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

    // grenade key: orbital designator > class special > frag
    if (cmd.grenade && this.time >= s.nextGrenadeAt) {
      if (s.orbitals > 0) {
        s.orbitals--;
        s.nextGrenadeAt = this.time + 1.5;
        this.throwProjectile(s, 'orbital_beacon', 1.4, 26, true);
        this.emit({ type: 'shot', pos: s.pos, weapon: 'orbital_beacon', soldierId: s.id });
        if (s.cloaked) s.cloaked = false;
      } else if (c.ability === 'warp' && s.grenades > 0) {
        s.grenades--;
        s.nextGrenadeAt = this.time + 1.5;
        this.throwProjectile(s, 'target_beacon', 1.4, 28, true);
        this.emit({ type: 'shot', pos: s.pos, weapon: 'target_beacon', soldierId: s.id });
      } else if (c.ability === 'drone' && s.grenades > 0) {
        s.grenades--;
        s.nextGrenadeAt = this.time + 1.5;
        this.throwProjectile(s, 'emp', 1.4, 30, true);
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
        this.throwProjectile(s, 'gl', 1.4, 16, true);
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

  throwProjectile(s: Soldier, wid: WeaponId, muzzleY: number, speed: number, arc: boolean) {
    const def = WEAPONS[wid];
    const spread = (this.rng.next() - 0.5) * 2 * def.spread;
    const yaw = s.yaw + spread;
    const p: Projectile = {
      id: this.id(), weapon: wid, ownerId: s.id, team: s.team,
      pos: { x: s.pos.x + Math.cos(yaw) * 0.8, y: s.pos.y + muzzleY, z: s.pos.z + Math.sin(yaw) * 0.8 },
      vel: { x: Math.cos(yaw) * speed, y: arc ? 7 : 0, z: Math.sin(yaw) * speed },
      bornAt: this.time, ttl: def.range / Math.max(speed, 1) + (arc ? 1.2 : 0), arc,
    };
    this.projectiles.set(p.id, p);
  }

  stepSoldierPhysics(s: Soldier, dt: number) {
    if (s.vehicleId >= 0) {
      const v = this.vehicles.get(s.vehicleId);
      if (v) { s.pos.x = v.pos.x; s.pos.z = v.pos.z; s.pos.y = 0; }
      return;
    }
    // gravity + vertical
    if (s.pos.y > 0 || s.vel.y > 0) {
      s.vel.y -= GRAVITY * dt;
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

  stepVehicle(v: Vehicle, cmds: Map<number, PlayerCmd>, dt: number) {
    if (!v.alive) {
      if (this.time >= v.respawnAt && !isCoopMode(this.opts.mode) && !this.mode.over) {
        const def = VEHICLES[v.kind];
        v.alive = true; v.hp = def.hp; v.maxHp = def.hp;
        v.pos = { ...v.padPos }; v.vel = { x: 0, y: 0, z: 0 };
        v.yaw = v.team === 0 ? 0 : Math.PI;
        v.seats.fill(-1);
      }
      return;
    }
    const def = VEHICLES[v.kind];
    const driverId = v.seats[0];
    const driver = driverId >= 0 ? this.soldiers.get(driverId) : undefined;
    let throttle = 0, turn = 0, fire = false;
    const stunned = this.time < v.stunnedUntil;
    if (driver && driver.alive && !stunned) {
      const cmd = cmds.get(driver.id) ?? (driver.kind === 'bot' ? stepBot(this, driver, dt) : undefined);
      if (cmd) {
        throttle = -cmd.moveZ; // W = forward
        turn = cmd.moveX;
        fire = cmd.fire;
        v.turretYaw = cmd.aimYaw;
        if (cmd.use && this.time - driver.enteredVehicleAt > 0.3) this.exitVehicle(driver, v);
      }
    } else {
      // friction to a stop
      throttle = 0;
    }

    v.yaw += turn * def.turnRate * dt * (throttle < 0 ? -1 : 1);
    const targetSpeed = throttle * def.speed * (throttle < 0 ? 0.5 : 1);
    const accel = 18;
    const curSpeed = Math.cos(v.yaw) * v.vel.x + Math.sin(v.yaw) * v.vel.z;
    const newSpeed = curSpeed + Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - curSpeed));
    v.vel.x = Math.cos(v.yaw) * newSpeed;
    v.vel.z = Math.sin(v.yaw) * newSpeed;

    const hover = v.kind === 'skiff';
    const nx = v.pos.x + v.vel.x * dt;
    const nz = v.pos.z + v.vel.z * dt;
    const r = def.radius;
    const clearAt = (x: number, z: number) =>
      !isBlocked(this.map.grid, x + r, z, hover) && !isBlocked(this.map.grid, x - r, z, hover) &&
      !isBlocked(this.map.grid, x, z + r, hover) && !isBlocked(this.map.grid, x, z - r, hover);
    if (clearAt(nx, v.pos.z)) v.pos.x = nx; else v.vel.x = 0;
    if (clearAt(v.pos.x, nz)) v.pos.z = nz; else v.vel.z = 0;
    v.pos.x = Math.max(-WORLD / 2 + 3, Math.min(WORLD / 2 - 3, v.pos.x));
    v.pos.z = Math.max(-WORLD / 2 + 3, Math.min(WORLD / 2 - 3, v.pos.z));

    // run over enemies (tanks/buggies at speed)
    const speedNow = Math.hypot(v.vel.x, v.vel.z);
    if (speedNow > 6 && driver) {
      for (const s of this.soldiers.values()) {
        if (!s.alive || s.team === v.team || s.vehicleId >= 0 || s.pos.y > 1.5) continue;
        if (Math.hypot(s.pos.x - v.pos.x, s.pos.z - v.pos.z) < r + 0.7) {
          this.damageSoldier(s, 60 * dt * speedNow * 0.4 + 25, driverId, 'tank_cannon');
        }
      }
    }

    // fire mounted weapon
    if (fire && driver && this.time >= v.nextFireAt) {
      const wdef = WEAPONS[def.weapon];
      v.nextFireAt = this.time + 1 / wdef.rof;
      const spread = (this.rng.next() - 0.5) * 2 * wdef.spread;
      const yaw = v.turretYaw + spread;
      const muzzle = r + 0.8;
      const p: Projectile = {
        id: this.id(), weapon: def.weapon, ownerId: driver.id, team: v.team,
        pos: { x: v.pos.x + Math.cos(yaw) * muzzle, y: 1.8, z: v.pos.z + Math.sin(yaw) * muzzle },
        vel: { x: Math.cos(yaw) * wdef.speed, y: 0, z: Math.sin(yaw) * wdef.speed },
        bornAt: this.time, ttl: wdef.range / wdef.speed, arc: false,
      };
      this.projectiles.set(p.id, p);
      this.emit({ type: 'shot', pos: { ...p.pos }, weapon: def.weapon, soldierId: driver.id });
    }
  }

  // ---------- turrets ----------

  stepTurret(t: Turret, dt: number) {
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
      if (p.arc) p.vel.y -= GRAVITY * 0.7 * dt;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;

      let dead = false;

      // enemy shield domes swallow projectiles
      if (!def.heals) {
        for (const [gid, g] of this.gadgets) {
          if (g.type !== 'shield' || g.team === p.team) continue;
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
            if (def.knockback > 0) {
              const kl = Math.hypot(p.vel.x, p.vel.z) || 1;
              s.pushX += (p.vel.x / kl) * def.knockback;
              s.pushZ += (p.vel.z / kl) * def.knockback;
              if (s.pos.y < 0.2) s.vel.y = Math.max(s.vel.y, def.knockback * 0.35);
            }
            if (def.heals) {
              if (s.hp < s.maxHp) {
                s.hp = Math.min(s.maxHp, s.hp + def.damage);
                const healer = this.soldiers.get(p.ownerId);
                if (healer) healer.score += 2;
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
        if (def.knockback > 0) {
          const dl = Math.max(d, 0.5);
          s.pushX += ((s.pos.x - pos.x) / dl) * def.knockback * (1 - d / def.splash);
          s.pushZ += ((s.pos.z - pos.z) / dl) * def.knockback * (1 - d / def.splash);
          if (s.pos.y < 0.2) s.vel.y = Math.max(s.vel.y, def.knockback * 0.3);
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
    victim.hp -= dmg;
    if (victim.cloaked) victim.cloaked = false;
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.respawnAt = this.time + (isZed(victim.kind) ? 2 : RESPAWN_DELAY);
      const attacker = this.soldiers.get(attackerId);
      if (attacker && attacker.id !== victim.id) {
        attacker.kills++;
        attacker.score += isZed(victim.kind) ? ZOMBIE_STATS[victim.kind].score : 10;
      }
      // bombers go out with a bang — hurts whoever is close on the other team
      if (victim.kind === 'bomber') this.bomberDetonate(victim);
      this.emit({
        type: 'death', pos: { ...victim.pos }, soldierId: victim.id,
        killerName: attacker && attacker.id !== victim.id ? attacker.name : undefined,
        victimName: victim.name,
        killerTeam: attacker?.team,
        weaponName: WEAPONS[weapon]?.name,
      });
    }
  }

  damageVehicle(v: Vehicle, dmg: number, attackerId: number, weapon: WeaponId) {
    if (!v.alive || dmg <= 0) return;
    v.hp -= dmg;
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
      if (attacker && attacker.team !== v.team) attacker.score += 25;
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

  stepPickups(dt: number) {
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
