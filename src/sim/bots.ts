import { CLASSES, VEHICLES, WEAPONS } from './data';
import { GRID, T_DOOR, T_DOOR_OPEN, T_LADDER, T_OPEN, T_WATER, TILE, WORLD, isBlocked, losClear } from './map';
import type { ClassId, PlayerCmd, Soldier, Vec3 } from './types';
import { DIFFICULTY_AIM, type World } from './world';

const noCmd = (): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
});

// ---------- grid pathfinding (BFS, uniform cost) ----------

const toTile = (v: number) => Math.floor((v + WORLD / 2) / TILE);
const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;

/** BFS from start tile to goal tile; returns the next reachable waypoint (LOS-smoothed) or null. */
function pathStep(w: World, from: Vec3, to: Vec3): Vec3 | null {
  const grid = w.map.grid;
  const sx = toTile(from.x), sz = toTile(from.z);
  let gx = toTile(to.x), gz = toTile(to.z);
  if (sx === gx && sz === gz) return null;
  // doors are PASSABLE to the planner: humans open them, monsters break them.
  // SHALLOW water is passable too — fords are routes now, not walls. DEEP
  // water stays off the menu: a swimming bot can't shoot back.
  // The walkability ray below still treats a closed door as solid, so the
  // smoothed path delivers the bot TO the door, where its hands take over.
  const open = (x: number, z: number) => {
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) return false;
    const t = grid[z * GRID + x];
    return t === T_OPEN || t === T_DOOR || t === T_DOOR_OPEN || t === T_WATER || t === T_LADDER;
  };
  if (!open(gx, gz)) {
    // the objective landed inside a structure (buildings stamp everywhere
    // now) — spiral out to the nearest walkable tile instead of giving up.
    // Giving up here is how a whole match once ended 0–0.
    let found = false;
    outer: for (let r = 1; r <= 4; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (open(gx + dx, gz + dz)) { gx += dx; gz += dz; found = true; break outer; }
        }
      }
    }
    if (!found) return null;
  }

  const prev = new Int32Array(GRID * GRID).fill(-1);
  const q = new Int32Array(GRID * GRID);
  let head = 0, tail = 0;
  const startIdx = sz * GRID + sx;
  q[tail++] = startIdx;
  prev[startIdx] = startIdx;
  const goalIdx = gz * GRID + gx;
  let found = false;
  const dirs = [1, -1, GRID, -GRID, GRID + 1, GRID - 1, -GRID + 1, -GRID - 1];
  let expanded = 0;
  while (head < tail && expanded < GRID * GRID) {
    const cur = q[head++];
    expanded++;
    if (cur === goalIdx) { found = true; break; }
    const cx = cur % GRID, cz = (cur / GRID) | 0;
    for (const d of dirs) {
      const nxt = cur + d;
      const nx = nxt % GRID, nz = (nxt / GRID) | 0;
      if (Math.abs(nx - cx) > 1 || Math.abs(nz - cz) > 1) continue; // wrap guard
      if (prev[nxt] !== -1 || !open(nx, nz)) continue;
      // no diagonal corner cutting
      if (nx !== cx && nz !== cz && (!open(cx, nz) || !open(nx, cz))) continue;
      prev[nxt] = cur;
      q[tail++] = nxt;
    }
  }
  if (!found) return null;

  // walk back from goal to the tile after start
  const path: number[] = [];
  let cur = goalIdx;
  while (cur !== startIdx && path.length < 500) {
    path.push(cur);
    cur = prev[cur];
  }
  path.reverse();
  // WALK smoothing: take the farthest path node we can walk straight to.
  // This must be a walkability ray, not losClear — a shot ray flies over
  // water and open doors of thought that boots cannot cross (the pond in
  // front of a base gate once pinned four bots forever).
  const walkClear = (a: Vec3, bx: number, bz: number): boolean => {
    const dx = bx - a.x, dz = bz - a.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (TILE * 0.4)));
    let px = a.x, pz = a.z;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + dx * t, z = a.z + dz * t;
      // the point itself PLUS the two elbows: a sampled diagonal can thread
      // the exact corner where two walls touch — the physics can't, so bots
      // aimed through it and sat pinned on the corner forever
      if (isBlocked(grid, x, z) || isBlocked(grid, px, z) || isBlocked(grid, x, pz)) return false;
      px = x; pz = z;
    }
    return true;
  };
  let target = path[0];
  for (let i = Math.min(path.length - 1, 24); i > 0; i--) {
    const px = toWorld(path[i] % GRID), pz = toWorld((path[i] / GRID) | 0);
    if (walkClear(from, px, pz)) { target = path[i]; break; }
  }
  return { x: toWorld(target % GRID), y: 0, z: toWorld((target / GRID) | 0) };
}

// ---------- target selection ----------

function findTarget(w: World, s: Soldier, maxRange: number): Soldier | null {
  let best: Soldier | null = null;
  let bestD = maxRange;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.vehicleId >= 0) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (e.cloaked && d > 9) continue; // cloaked infiltrators are invisible beyond close range
    if (d < bestD && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...e.pos, y: 1.4 })) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function enemyVehicleNear(w: World, s: Soldier, maxRange: number) {
  let best: { pos: Vec3; d: number } | null = null;
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team || !v.seats.some((x) => x >= 0)) continue;
    const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
    if (d < maxRange && (!best || d < best.d)) best = { pos: v.pos, d };
  }
  return best;
}

// ---------- objective selection per mode ----------

/** CTF roles are CLASS-shaped: fast boots raid, armor guards, the rest
 *  pressure mid. (Role-by-id gave us a medic "raider" who never left spawn
 *  and a heavy who died 18 times crossing mid.) */
const raidsFlags = (s: Soldier) =>
  s.classId === 'jump' || s.classId === 'pathfinder' || s.classId === 'infiltrator' ||
  ((s.classId === 'infantry' || s.classId === 'ghost') && s.id % 2 === 0);
const guardsHome = (s: Soldier) =>
  s.classId === 'heavy' && s.id % 2 === 0;

function objectiveFor(w: World, s: Soldier): Vec3 {
  const m = w.mode;
  const enemyBase = w.map.basePos[1 - s.team];
  switch (m.id) {
    case 'ctf': {
      const enemyFlag = m.flags![1 - s.team];
      const ownFlag = m.flags![s.team];
      if (s.carryingFlag >= 0) return w.map.basePos[s.team]; // bring it home
      if (!ownFlag.atHome && ownFlag.carrierId < 0) return ownFlag.pos; // return ours
      // a teammate is running it home — ESCORT the runner, don't sightsee mid.
      // (Bodyguards are why captures happen at all in 12v12.)
      const carrier = enemyFlag.carrierId >= 0 ? w.soldiers.get(enemyFlag.carrierId) : undefined;
      if (carrier?.alive) return carrier.pos;
      // Everyone who isn't guarding goes FLAG-HUNTING on the wings. CTF has
      // no mid objective — the old "pressure mid" role fed a grinder in the
      // middle of the map while both flags gathered dust (probes: 0 flag
      // events in 6 minutes, ever). Two-leg route: run to a wing waypoint on
      // the map's edge, THEN cut to the flag. Odd ids take north, even take
      // south — the raid arrives as two prongs the guard wall can't face at
      // once, with the escorts (non-raider classes) fighting alongside.
      if (guardsHome(s)) { // armor orbits the flag stand (engineers seed sentries there)
        const a = (s.id % 8) * (Math.PI / 4);
        return { x: ownFlag.pos.x + Math.cos(a) * 6, y: 0, z: ownFlag.pos.z + Math.sin(a) * 6 };
      }
      const dFlag = Math.hypot(s.pos.x - enemyFlag.pos.x, s.pos.z - enemyFlag.pos.z);
      if (dFlag > 70) {
        const base = w.map.basePos[s.team];
        const ax = enemyFlag.pos.x - base.x, az = enemyFlag.pos.z - base.z;
        const al = Math.hypot(ax, az) || 1;
        // one wing per team, and the offset is relative to the team's OWN
        // approach axis — which reverses between teams, so a CONSTANT side
        // puts the armies on opposite world wings and the waves PASS each
        // other. (side-by-team here double-negated with the axis reversal
        // and marched both armies onto the SAME wing — the time-lapse showed
        // every death at (0,90).) Each raid meets only the enemy's guards:
        // CTF becomes a race.
        const side = 1;
        const wing = WORLD * 0.3;
        const wp = {
          x: Math.max(-WORLD / 2 + 9, Math.min(WORLD / 2 - 9, (base.x + enemyFlag.pos.x) / 2 - (az / al) * side * wing)),
          y: 0,
          z: Math.max(-WORLD / 2 + 9, Math.min(WORLD / 2 - 9, (base.z + enemyFlag.pos.z) / 2 + (ax / al) * side * wing)),
        };
        // hand off wing→flag by PROGRESS along the base→flag axis, which
        // only ever increases as you advance — a distance-to-waypoint test
        // here made the whole wave orbit the wing forever (step toward the
        // flag, drift outside the radius, objective flips back; repeat)
        const prog = ((s.pos.x - base.x) * ax + (s.pos.z - base.z) * az) / (al * al);
        if (prog < 0.45) return wp;
      }
      return enemyFlag.pos;
    }
    case 'koth':
      return m.hillPos!;
    case 'conquest': {
      const pts = m.points!;
      const contestable = pts.filter((p) => p.owner !== s.team);
      const pool = contestable.length ? contestable : pts;
      let best = pool[0], bd = Infinity;
      for (const p of pool) {
        const d = Math.hypot(p.pos.x - s.pos.x, p.pos.z - s.pos.z);
        if (d < bd) { bd = d; best = p; }
      }
      return best.pos;
    }
    case 'survival':
    case 'horde': {
      // hold near squad center
      const allies = w.humansAndBots().filter((x) => x.alive);
      if (!allies.length) return w.map.hillPos;
      const cx = allies.reduce((a, x) => a + x.pos.x, 0) / allies.length;
      const cz = allies.reduce((a, x) => a + x.pos.z, 0) / allies.length;
      return { x: cx, y: 0, z: cz };
    }
    case 'safehouse': {
      // form a perimeter around the scientist's position
      const sci = m.scientistId !== undefined ? w.soldiers.get(m.scientistId) : undefined;
      if (!sci || !sci.alive) return w.map.basePos[0];
      const a = (s.id % 8) * (Math.PI / 4);
      const r = 5 + (s.id % 3) * 2.5;
      return { x: sci.pos.x + Math.cos(a) * r, y: 0, z: sci.pos.z + Math.sin(a) * r };
    }
    default: // tdm — hunt toward enemy side / last seen action
      return { x: enemyBase.x * 0.4 + w.map.hillPos.x * 0.6, y: 0, z: enemyBase.z * 0.4 };
  }
}

// ---------- per-class doctrine ----------
// Every class fights like ITSELF: skirmishers close, anchors hold, marksmen
// keep the whole street between them and trouble. Humans are more capable
// than the horde in one specific way — they value their own lives (retreat).

interface Doctrine {
  /** the range this class wants to fight at */
  standoff: number;
  /** push toward a visible enemy when outside the band? anchors don't */
  chase: boolean;
  /** below this hp fraction the bot breaks contact — zeds never do */
  retreat: number;
  /** strafe-dance intensity while in the band */
  strafe: number;
  /** lateral bias while closing — flankers curve in, line troops walk straight */
  flank: number;
  /** aim-error multiplier: <1 marksman, >1 sprayer */
  aim: number;
}

export const DOCTRINE: Record<ClassId, Doctrine> = {
  infantry:    { standoff: 17, chase: true,  retreat: 0.22, strafe: 0.85, flank: 0.25, aim: 0.95 },
  heavy:       { standoff: 26, chase: false, retreat: 0.12, strafe: 0.45, flank: 0,    aim: 1.15 },
  jump:        { standoff: 9,  chase: true,  retreat: 0.28, strafe: 1.1,  flank: 0.35, aim: 1.0  },
  engineer:    { standoff: 8,  chase: true,  retreat: 0.3,  strafe: 0.7,  flank: 0.1,  aim: 1.0  }, // a shotgunner's office is point blank
  medic:       { standoff: 18, chase: false, retreat: 0.4,  strafe: 0.8,  flank: 0,    aim: 1.1  },
  infiltrator: { standoff: 50, chase: false, retreat: 0.5,  strafe: 0.35, flank: 0.4,  aim: 0.8  },
  pathfinder:  { standoff: 13, chase: true,  retreat: 0.3,  strafe: 1.0,  flank: 0.7,  aim: 1.0  },
  ghost:       { standoff: 28, chase: false, retreat: 0.35, strafe: 0.6,  flank: 0.3,  aim: 0.9  },
};

/** Grid index of a CLOSED door within arm's reach along a heading, or -1. */
function doorAhead(w: World, pos: Vec3, yaw: number): number {
  for (const reach of [TILE * 0.6, TILE * 1.3]) {
    const x = pos.x + Math.cos(yaw) * reach;
    const z = pos.z + Math.sin(yaw) * reach;
    const tx = Math.floor((x + WORLD / 2) / TILE);
    const tz = Math.floor((z + WORLD / 2) / TILE);
    if (tx < 1 || tz < 1 || tx >= GRID - 1 || tz >= GRID - 1) continue;
    if (w.map.grid[tz * GRID + tx] === T_DOOR) return tz * GRID + tx;
  }
  return -1;
}

// ---------- main bot brain ----------

export function stepBot(w: World, s: Soldier, _dt: number): PlayerCmd {
  const cmd = noCmd();
  cmd.aimYaw = s.yaw;
  const cls = CLASSES[s.classId];

  // --- driving a vehicle ---
  if (s.vehicleId >= 0) {
    const v = w.vehicles.get(s.vehicleId);
    if (!v || !v.alive) return cmd;
    const vdef = VEHICLES[v.kind];
    const wdef = vdef.weapon ? WEAPONS[vdef.weapon] : undefined;

    // manning an emplacement gun: hold, traverse, fire; walk away if it's quiet
    if (vdef.immobile) {
      const target = wdef ? findTarget(w, s, wdef.range) : null;
      if (target && wdef) {
        s.botRepathAt = w.time + 8;
        cmd.aimYaw = leadYaw(v.pos, target, wdef.speed) + (w.rng.next() - 0.5) * 0.04;
        cmd.fire = true;
      } else if (w.time >= (s.botRepathAt ?? 0)) {
        cmd.use = true; // bored — back to the war
      }
      return cmd;
    }

    // the Pike PATROLS: a boat can rarely reach a land objective, so it owns
    // the water instead — circle the ring with the deck gun talking, and
    // beach it only when the war goes quiet for a while
    if (vdef.boat) {
      const target = wdef ? findTarget(w, s, wdef.range) : null;
      if (target && wdef) {
        s.botRepathAt = w.time + 12; // engaged — stay aboard
        cmd.aimYaw = leadYaw(v.pos, target, wdef.speed) + (w.rng.next() - 0.5) * 0.05;
        cmd.fire = true;
      } else if (w.time >= Math.max(s.botRepathAt ?? 0, s.enteredVehicleAt + 12)) {
        cmd.use = true; // twelve quiet seconds aboard — step off at the bank
        return cmd;
      }
      // steer at a point further around the ring (the moat is a circle;
      // circling is ALWAYS a legal boat move on the maps boats spawn on)
      const ang = Math.atan2(v.pos.z, v.pos.x) + 0.55;
      const px = Math.cos(ang) * 33, pz = Math.sin(ang) * 33;
      const wantBow = Math.atan2(pz - v.pos.z, px - v.pos.x);
      let dyb = wantBow - v.yaw;
      while (dyb > Math.PI) dyb -= Math.PI * 2;
      while (dyb < -Math.PI) dyb += Math.PI * 2;
      cmd.moveX = Math.max(-1, Math.min(1, dyb * 2));
      cmd.moveZ = Math.abs(dyb) < 1.1 ? -1 : -0.25;
      if (!target) cmd.aimYaw = v.yaw;
      return cmd;
    }

    // unarmed utility rides (ambulance/tunneler/hoverboard): drive to objective, hop out
    const goal = objectiveFor(w, s);
    const dGoal = Math.hypot(goal.x - v.pos.x, goal.z - v.pos.z);
    // breacher depth discipline (49A): run DEEP on the long quiet legs —
    // silent, off-minimap, under the walls — and SURFACE near the objective
    // or when contact is close (deep can't dig and crawls)
    if (vdef.digs) {
      const contact = findTarget(w, s, 26);
      if (!v.burrowed && !contact && dGoal > 30) cmd.ability = true;
      else if (v.burrowed && (contact || dGoal < 18)) cmd.ability = true;
    }
    // disembark near the objective (tank crews stay aboard — except CTF
    // runners, who need HANDS: a raider sealed in a tank can never grab)
    const bail = v.kind !== 'tank' || (w.mode.id === 'ctf' && (s.carryingFlag >= 0 || raidsFlags(s)));
    if (dGoal < 14 && bail) { cmd.use = true; return cmd; }
    // stuck recovery, judged by NET DISPLACEMENT over 3s windows — never by
    // speed (a first cut reset on any velocity, so the reverse escape's own
    // motion cleared the timer and the hull ping-ponged on the wall for a
    // whole match). Strike one: back out hard. Strike two: ABANDON — a
    // parked ride is a coffin, not cover.
    if (w.time >= (s.botMoveCheckAt ?? 0)) {
      const moved = Math.hypot(v.pos.x - (s.botLastX ?? v.pos.x), v.pos.z - (s.botLastZ ?? v.pos.z));
      if (s.botLastX !== undefined && moved < 2.5 && dGoal > 16) {
        if (s.botStuckAt !== undefined) {
          cmd.use = true; // strike two: get out and walk
          s.botStuckAt = undefined;
          s.botLastX = undefined;
          s.botUseAt = w.time + 10; // and no ride-shopping right away
          return cmd;
        }
        s.botStuckAt = w.time; // strike one: try the reverse escape
      } else {
        s.botStuckAt = undefined;
      }
      s.botLastX = v.pos.x;
      s.botLastZ = v.pos.z;
      s.botMoveCheckAt = w.time + 3;
    }
    if (s.botStuckAt !== undefined && w.time - s.botStuckAt < 1.6) {
      cmd.moveZ = 1; // hard reverse, wheel cranked
      cmd.moveX = s.id % 2 ? 1 : -1;
      return cmd;
    }
    const wantYaw = Math.atan2(goal.z - v.pos.z, goal.x - v.pos.x);
    let dy = wantYaw - v.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    cmd.moveX = Math.max(-1, Math.min(1, dy * 2));
    cmd.moveZ = Math.abs(dy) < 1.1 ? -1 : -0.25; // forward
    if (wdef) {
      const target = findTarget(w, s, wdef.range);
      if (target) {
        const lead = leadYaw(v.pos, target, wdef.speed);
        cmd.aimYaw = lead + (w.rng.next() - 0.5) * 0.05;
        cmd.fire = true;
      } else {
        cmd.aimYaw = v.yaw;
        const ev = enemyVehicleNear(w, s, wdef.range);
        if (ev) {
          cmd.aimYaw = Math.atan2(ev.pos.z - v.pos.z, ev.pos.x - v.pos.x);
          cmd.fire = true;
        }
      }
    } else {
      cmd.aimYaw = v.yaw;
    }
    return cmd;
  }

  // acquire out to the equipped weapon's reach (bounded) so snipers/lasers
  // actually engage long and every weapon's max distance shows in real play;
  // a 42u floor keeps close-quarters classes aggressive
  const acqRange = Math.max(42, Math.min(WEAPONS[s.weapons[s.weaponIdx]].range * 0.95, 95));
  const target = findTarget(w, s, acqRange);
  const goal = objectiveFor(w, s);
  const dGoal = Math.hypot(goal.x - s.pos.x, goal.z - s.pos.z);

  // --- consider grabbing an ARMED vehicle for long trips (not in survival) ---
  if (!target && dGoal > 45 && w.opts.mode !== 'survival' && w.rng.next() < 0.02) {
    for (const v of w.vehicles.values()) {
      if (!v.alive || v.team !== s.team || v.seats[0] >= 0) continue;
      const kdef = VEHICLES[v.kind];
      // armed rides — plus the breacher (49A): its depth run IS its weapon
      if ((!kdef.weapon && !kdef.digs) || kdef.immobile) continue;
      if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < 10) { cmd.use = true; break; }
    }
  }
  // --- man an empty emplacement gun when enemies are pressing ---
  if (target && w.rng.next() < 0.01) {
    for (const v of w.vehicles.values()) {
      if (!v.alive || v.team !== s.team || !VEHICLES[v.kind].immobile || v.seats[0] >= 0) continue;
      if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < 6) { cmd.use = true; break; }
    }
  }
  // --- a free gunboat at the bank is a fire platform: boat-curious bots
  // (a third of the roster) detour a few steps and climb in. Adjacent to
  // the hull they'll board even mid-fight — 260hp and a deck MG beat
  // standing in the shallows arguing ---
  if (s.id % 3 === 0) {
    for (const v of w.vehicles.values()) {
      if (!v.alive || v.team !== s.team || v.seats[0] >= 0 || !VEHICLES[v.kind].boat) continue;
      const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
      if (d < VEHICLES[v.kind].radius + 2) { cmd.use = true; break; }
      if (!target && d < 15) { s.botGoal = { x: v.pos.x, y: 0, z: v.pos.z }; s.botRepathAt = w.time + 0.5; break; }
    }
  }

  // --- CTF: speed IS the raid plan ---
  // On foot the crossing takes ~23s of exposure; on a bike it takes 7. A
  // runner detours to a free fast ride — as a pathfinding DESTINATION, never
  // a straight-line walk (that once pinned raiders against their own base
  // wall, reaching for a pad vehicle on the far side of it).
  let rideDest: Vec3 | null = null;
  if (w.mode.id === 'ctf' && !target && dGoal > 30 && w.time >= (s.botUseAt ?? 0) &&
      (s.carryingFlag >= 0 || raidsFlags(s))) {
    let ridePos: Vec3 | null = null, rideR = 0, rd = 26;
    for (const v of w.vehicles.values()) {
      if (!v.alive || v.team !== s.team || v.seats[0] >= 0) continue;
      const kdef = VEHICLES[v.kind];
      if (kdef.immobile || kdef.digs || kdef.flies || kdef.speed < 20) continue;
      const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
      if (d < rd) { ridePos = v.pos; rideR = kdef.radius; rd = d; }
    }
    if (ridePos) {
      if (rd < rideR + 2) cmd.use = true;
      else rideDest = { x: ridePos.x, y: 0, z: ridePos.z };
    }
  }

  // foot stuck check: a bot that hasn't moved in 2.5s with somewhere to be
  // replans immediately — the elbow-checked walk ray won't re-aim it at the
  // corner that pinned it
  if (w.time >= (s.botMoveCheckAt ?? 0)) {
    const moved = Math.hypot(s.pos.x - (s.botLastX ?? s.pos.x), s.pos.z - (s.botLastZ ?? s.pos.z));
    if (s.botLastX !== undefined && moved < 1 && dGoal > 6 && !target) {
      s.botGoal = null;
      s.botRepathAt = 0;
    }
    s.botLastX = s.pos.x;
    s.botLastZ = s.pos.z;
    s.botMoveCheckAt = w.time + 2.5;
  }

  // --- movement: repath periodically toward objective (or flank target) ---
  const wantRepath = !s.botGoal || w.time >= (s.botRepathAt ?? 0) ||
    Math.hypot((s.botGoal?.x ?? 0) - s.pos.x, (s.botGoal?.z ?? 0) - s.pos.z) < 3;
  if (wantRepath) {
    s.botRepathAt = w.time + 0.9 + w.rng.next() * 0.7;
    // chasers hunt the target in tdm; anchors keep walking their objective;
    // a CTF runner with a ride in reach paths to the ride first
    const dest = rideDest ?? (target && w.mode.id === 'tdm' && DOCTRINE[s.classId].chase
      ? target.pos
      : goal);
    const wp = pathStep(w, s.pos, dest);
    s.botGoal = wp ?? { x: dest.x, y: 0, z: dest.z };
  }

  let mvx = 0, mvz = 0;
  if (s.botGoal) {
    const dx = s.botGoal.x - s.pos.x;
    const dz = s.botGoal.z - s.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    mvx = dx / dl;
    mvz = dz / dl;
  }

  // --- combat: fight the way your class fights ---
  if (target) {
    const d = Math.hypot(target.pos.x - s.pos.x, target.pos.z - s.pos.z);
    const wdef = WEAPONS[s.weapons[s.weaponIdx]];
    const doc = DOCTRINE[s.classId];

    // pick sensible weapon slot
    if (s.classId === 'heavy') cmd.weaponSlot = d > 25 || target.vehicleId >= 0 ? 1 : 0;
    else if (s.classId === 'medic') cmd.weaponSlot = 0;
    else if (s.classId === 'engineer') cmd.weaponSlot = 0;
    else if (s.classId === 'jump') cmd.weaponSlot = d > 24 ? 1 : 0; // shell them while closing, SMG inside

    const aimErr = (w.rng.next() - 0.5) * (s.kind === 'zombie' ? 0.2 : 0.055) * (d / 18 + 0.6)
      * DIFFICULTY_AIM[w.opts.difficulty ?? 'veteran'] * doc.aim;
    cmd.aimYaw = leadYaw(s.pos, target, wdef.speed) + aimErr;
    if (d < wdef.range * 0.95) cmd.fire = true;
    if (wdef.arc) cmd.aimDist = d; // lob shells ON the target, not past it

    const toT = Math.atan2(target.pos.z - s.pos.z, target.pos.x - s.pos.x);
    // committed runners: the flag carrier, and CTF raiders on approach. One
    // job: run. Fire over the shoulder, don't stop to duel — dead runners
    // score nothing. (They still fight anyone inside 12u blocking the lane.)
    const committed = s.carryingFlag >= 0 ||
      (w.mode.id === 'ctf' && raidsFlags(s) && d > 12);
    if (committed) {
      // keep the objective movement computed above
    } else if (s.hp < s.maxHp * doc.retreat) {
      // capability, not courage: break contact toward home, guns still up.
      // This is the line between a human and a zed — zeds never step back.
      const base = w.map.basePos[s.team];
      mvx = -Math.cos(toT) * 1.2 + (base.x - s.pos.x) * 0.015;
      mvz = -Math.sin(toT) * 1.2 + (base.z - s.pos.z) * 0.015;
      if (cls.ability === 'jetpack' && s.energy > 40) cmd.jump = true; // burn out of there
    } else if (d > doc.standoff * 1.3) {
      // hunting is a TDM luxury: in objective modes, chasing kills across
      // the map is exactly how both teams forget the flags exist
      if (doc.chase && w.mode.id === 'tdm') {
        // close with a flanker's curve — straight lines are for the brave and brief
        const side = (s.id % 2 ? 1 : -1) * doc.flank;
        mvx = Math.cos(toT) + Math.cos(toT + Math.PI / 2) * side;
        mvz = Math.sin(toT) + Math.sin(toT + Math.PI / 2) * side;
      }
      // anchors keep walking the objective and shoot what shows itself
    } else if (d < doc.standoff * 0.55) {
      // inside the class's comfort band — give ground, guns up
      mvx = -Math.cos(toT) * 0.9;
      mvz = -Math.sin(toT) * 0.9;
    } else {
      // in the band: strafe-dance, a toe still pointed at the objective
      if (w.rng.next() < 0.02) s.botStrafeDir = (s.botStrafeDir ?? 1) * -1;
      const perp = toT + Math.PI / 2;
      mvx = Math.cos(perp) * (s.botStrafeDir ?? 1) * doc.strafe + mvx * 0.25;
      mvz = Math.sin(perp) * (s.botStrafeDir ?? 1) * doc.strafe + mvz * 0.25;
    }

    // grenades at clusters — cursor-targeted like players: land it ON the enemy
    if (d > 8 && d < 24 && s.grenades > 0 && w.rng.next() < 0.006) {
      cmd.grenade = true;
      cmd.aimDist = d;
    }

    // jump troopers hop in fights
    if (cls.ability === 'jetpack' && s.energy > 40 && w.rng.next() < 0.02) cmd.jump = true;
  } else {
    cmd.aimYaw = Math.atan2(mvz, mvx) || s.yaw;
    // reload when idle
    const wdef = WEAPONS[s.weapons[s.weaponIdx]];
    if (s.clip[s.weaponIdx] < wdef.clip * 0.4 && s.reserve[s.weaponIdx] > 0) cmd.reload = true;
  }

  // --- class abilities ---
  if (s.classId === 'engineer' && !target && s.energy >= 80 && dGoal < 20 && w.rng.next() < 0.01) cmd.ability = true;
  if (s.classId === 'medic') {
    // heal nearby wounded ally
    let wounded: Soldier | null = null;
    for (const a of w.soldiers.values()) {
      if (!a.alive || a.team !== s.team || a.id === s.id || a.hp > a.maxHp * 0.75) continue;
      if ((a.kind === 'human' || a.kind === 'bot') && Math.hypot(a.pos.x - s.pos.x, a.pos.z - s.pos.z) < 13) { wounded = a; break; }
    }
    if (wounded) {
      cmd.weaponSlot = 1;
      cmd.aimYaw = Math.atan2(wounded.pos.z - s.pos.z, wounded.pos.x - s.pos.x);
      cmd.fire = true;
      mvx = (wounded.pos.x - s.pos.x) / 10;
      mvz = (wounded.pos.z - s.pos.z) / 10;
    }
    if (s.hp < s.maxHp * 0.5 && s.energy >= 50) cmd.ability = true;
  }
  // infiltrators cloak on occasion — but a CTF raider infiltrator cloaks FOR
  // THE CROSSING: bot eyes can't acquire a cloaked enemy beyond 9u, so the
  // sneak walks through the guard wall's whole engagement envelope unseen
  if (s.classId === 'infiltrator' && !s.cloaked && !target && s.energy > 70 &&
      w.rng.next() < (w.mode.id === 'ctf' && raidsFlags(s) ? 0.06 : 0.008)) cmd.ability = true;
  // ghost bots fly the recon net (49A): deploy the auto-orbit drone when a
  // fight is on and the battery allows — marks enemies for the whole team
  if (s.classId === 'ghost' && s.energy >= 70 && target && w.rng.next() < 0.012) cmd.ability = true;

  // MANPADS discipline (49A): a bot carrying tubes tracks the sky. An
  // airborne enemy gunship inside launch range gets the cone — aim at it and
  // squeeze; the sim's own lock logic decides whether the bird flies.
  if (s.manpads > 0 && w.time >= s.nextGrenadeAt) {
    let fly: { pos: Vec3 } | null = null, best = 65;
    for (const v of w.vehicles.values()) {
      if (v.team === s.team || !w.vehicleAirborne(v)) continue;
      const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
      if (d < best) { fly = v; best = d; }
    }
    if (fly) {
      cmd.aimYaw = Math.atan2(fly.pos.z - s.pos.z, fly.pos.x - s.pos.x);
      cmd.grenade = true;
      cmd.fire = false;
    }
  }

  // door IQ: a closed door on the walking line is a handle, not a wall.
  // Humans OPEN doors — that one verb is half the capability gap between a
  // soldier and the horde (which has to break them down). No door-fiddling
  // mid-firefight; the fight owns the hands.
  if (!target && (mvx !== 0 || mvz !== 0) && w.time >= (s.botUseAt ?? 0)) {
    const idx = doorAhead(w, s.pos, Math.atan2(mvz, mvx));
    if (idx >= 0) {
      cmd.aimYaw = Math.atan2(
        toWorld((idx / GRID) | 0) - s.pos.z,
        toWorld(idx % GRID) - s.pos.x,
      );
      cmd.use = true;
      s.botUseAt = w.time + 0.8;
    }
  }

  cmd.moveX = Math.max(-1, Math.min(1, mvx));
  cmd.moveZ = Math.max(-1, Math.min(1, mvz));
  return cmd;
}

function leadYaw(from: Vec3, target: Soldier, projSpeed: number): number {
  const d = Math.hypot(target.pos.x - from.x, target.pos.z - from.z);
  const t = d / Math.max(projSpeed, 1);
  const px = target.pos.x + target.vel.x * t * 0.85;
  const pz = target.pos.z + target.vel.z * t * 0.85;
  return Math.atan2(pz - from.z, px - from.x);
}

// ---------- the scientist ----------

export function stepScientist(w: World, s: Soldier, dt: number) {
  const leaderId = s.botTargetId ?? -1;
  const leader = leaderId >= 0 ? w.soldiers.get(leaderId) : undefined;
  if (leader && leader.alive && leader.vehicleId < 0) {
    const d = Math.hypot(leader.pos.x - s.pos.x, leader.pos.z - s.pos.z);
    if (d > 2.2) {
      const step = losClear(w.map.grid, s.pos, leader.pos, 0.6)
        ? leader.pos
        : (pathStep(w, s.pos, leader.pos) ?? leader.pos);
      const dx = step.x - s.pos.x, dz = step.z - s.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      const speed = d > 8 ? 10 : 8.5; // hustles to keep up
      s.yaw = Math.atan2(dz, dx);
      s.vel.x = (dx / dl) * speed;
      s.vel.z = (dz / dl) * speed;
    } else {
      s.vel.x = 0;
      s.vel.z = 0;
    }
  } else {
    if (leader && !leader.alive) s.botTargetId = -1; // escort went down — stay put
    s.vel.x = 0;
    s.vel.z = 0;
    // nervous glance around while hiding
    s.yaw += Math.sin(w.time * 0.7 + s.id) * 0.01;
  }
  w.stepSoldierPhysics(s, dt);
}

// ---------- zombies ----------

export function stepZombie(w: World, s: Soldier, dt: number) {
  // find nearest living human/bot
  let best: Soldier | null = null;
  let bestD = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || (e.kind !== 'human' && e.kind !== 'bot')) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (d < bestD) { best = e; bestD = d; }
  }

  // safehouse: the horde hunts the scientist
  if (w.mode.id === 'safehouse') {
    const sci = w.mode.scientistId !== undefined ? w.soldiers.get(w.mode.scientistId) : undefined;
    const alert = !!w.mode.alert;
    if (sci?.alive) {
      const dSci = Math.hypot(sci.pos.x - s.pos.x, sci.pos.z - s.pos.z);
      if (alert) {
        // the horde knows where he is — converge, unless a defender is right in the way
        if (!best || bestD > 6) { best = sci; bestD = dSci; }
      } else if (dSci < 12) {
        // stumbled close — investigate him directly
        best = sci;
        bestD = dSci;
      } else if (!best || bestD > 28) {
        // no target: search the neighborhood house by house
        if (!s.botGoal || w.time >= (s.botRepathAt ?? 0) ||
            Math.hypot(s.botGoal.x - s.pos.x, s.botGoal.z - s.pos.z) < 4) {
          const house = w.map.houses[Math.floor(w.rng.next() * w.map.houses.length)];
          if (house) {
            s.botRepathAt = w.time + 6 + w.rng.next() * 4;
            s.botGoal = { ...house.center };
          }
        }
        if (s.botGoal) {
          const step = losClear(w.map.grid, s.pos, s.botGoal, 0.6)
            ? s.botGoal
            : (pathStep(w, s.pos, s.botGoal) ?? s.botGoal);
          const dx = step.x - s.pos.x, dz = step.z - s.pos.z;
          const dl = Math.hypot(dx, dz) || 1;
          const speed = s.kind === 'sprinter' ? 12 : 7;
          s.yaw = Math.atan2(dz, dx);
          s.vel.x = (dx / dl) * speed;
          s.vel.z = (dz / dl) * speed;
          // searching house to house means going THROUGH the front door
          const dIdx = doorAhead(w, s.pos, s.yaw);
          if (dIdx >= 0) {
            s.vel.x = 0;
            s.vel.z = 0;
            if (w.time >= s.nextFireAt) {
              const wd = WEAPONS[s.weapons[0]];
              s.nextFireAt = w.time + 1 / wd.rof;
              w.damageDoor(dIdx, wd.damage * (s.kind === 'brute' ? 5 : 1), s.id);
            }
          }
          w.stepSoldierPhysics(s, dt);
          return;
        }
      }
    }
  }

  if (!best) return;

  const isSpitter = s.kind === 'spitter';
  const speed =
    s.kind === 'brute' ? 6 :
    s.kind === 'bomber' ? 6.5 :
    s.kind === 'sprinter' ? 15 + (s.id % 3) * 0.6 : // rare and terrifying
    s.kind === 'stalker' ? 5 :
    isSpitter ? 7.5 : 8.5 + (s.id % 5) * 0.35;
  s.yaw = Math.atan2(best.pos.z - s.pos.z, best.pos.x - s.pos.x);

  // bombers charge to point-blank and detonate
  if (s.kind === 'bomber' && bestD < 2.4) {
    w.damageSoldier(s, s.hp + 1, s.id, 'gl'); // suicide → bomberDetonate fires in the death path
    return;
  }

  // phase stalkers blink toward their prey — straight through walls
  if (s.kind === 'stalker' && bestD > 3 && bestD < 30 && w.time >= s.nextWarpAt) {
    const hop = Math.min(9, bestD - 2.2);
    const dir = { x: (best.pos.x - s.pos.x) / bestD, z: (best.pos.z - s.pos.z) / bestD };
    let nx = s.pos.x + dir.x * hop;
    let nz = s.pos.z + dir.z * hop;
    // never materialize inside a wall — back off along the blink line
    for (let back = 0; back < 6 && isBlocked(w.map.grid, nx, nz); back++) {
      nx -= dir.x * 1.2;
      nz -= dir.z * 1.2;
    }
    if (!isBlocked(w.map.grid, nx, nz)) {
      w.emit({ type: 'blink', pos: { ...s.pos } });
      s.pos.x = nx;
      s.pos.z = nz;
      s.nextWarpAt = w.time + 3.5;
      w.emit({ type: 'blink', pos: { ...s.pos }, soldierId: s.id });
    } else {
      s.nextWarpAt = w.time + 1; // try again shortly
    }
  }

  // spitters keep distance and spit — but only with a sightline; a spitter
  // staring at a closed door falls through to the melee path and claws it
  const wdef = WEAPONS[s.weapons[0]];
  if (isSpitter && bestD < 24 && losClear(w.map.grid, { ...s.pos, y: 1.2 }, { ...best.pos, y: 1.2 })) {
    if (bestD < 14) {
      // back away
      s.vel.x = -Math.cos(s.yaw) * speed * 0.7;
      s.vel.z = -Math.sin(s.yaw) * speed * 0.7;
    } else { s.vel.x = 0; s.vel.z = 0; }
    if (w.time >= s.nextFireAt && losClear(w.map.grid, { ...s.pos, y: 1.2 }, { ...best.pos, y: 1.2 })) {
      s.nextFireAt = w.time + 1 / wdef.rof;
      w.fireZombieSpit(s, best);
    }
  } else {
    // pathfind around walls every so often, otherwise beeline
    if (!s.botGoal || w.time >= (s.botRepathAt ?? 0)) {
      s.botRepathAt = w.time + 1.2 + (s.id % 7) * 0.1;
      const clear = losClear(w.map.grid, s.pos, best.pos, 0.6);
      s.botGoal = clear ? { ...best.pos } : (pathStep(w, s.pos, best.pos) ?? { ...best.pos });
    }
    const dx = s.botGoal.x - s.pos.x, dz = s.botGoal.z - s.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    s.vel.x = (dx / dl) * speed;
    s.vel.z = (dz / dl) * speed;
    // a closed door between the dead and dinner: BREAK IT DOWN. The horde
    // has no hands for handles — brutes swing like battering rams, bombers
    // simply detonate, walkers claw the wood until it gives.
    const doorIdx = doorAhead(w, s.pos, Math.atan2(s.vel.z, s.vel.x));
    if (doorIdx >= 0) {
      if (s.kind === 'bomber') {
        // the bomber IS a breaching charge: pressed against the wood, the
        // blast takes the whole door with it — one bang, one open house
        w.damageDoor(doorIdx, 999, s.id);
        w.damageSoldier(s, s.hp + 1, s.id, 'gl'); // suicide → blast hits the room
        return;
      }
      s.vel.x = 0;
      s.vel.z = 0;
      s.yaw = Math.atan2(toWorld((doorIdx / GRID) | 0) - s.pos.z, toWorld(doorIdx % GRID) - s.pos.x);
      if (w.time >= s.nextFireAt) {
        s.nextFireAt = w.time + 1 / wdef.rof;
        w.damageDoor(doorIdx, wdef.damage * (s.kind === 'brute' ? 5 : 1), s.id);
      }
      w.stepSoldierPhysics(s, dt);
      return;
    }
    if (bestD < wdef.range + 0.5 && w.time >= s.nextFireAt) {
      s.nextFireAt = w.time + 1 / wdef.rof;
      w.damageSoldier(best, wdef.damage, s.id, wdef.id);
      w.emit({ type: 'shot', pos: s.pos, weapon: wdef.id, soldierId: s.id });
    }
  }
  w.stepSoldierPhysics(s, dt);
}
