import { CLASSES, VEHICLES, WEAPONS } from './data';
import { GRID, T_OPEN, TILE, WORLD, isBlocked, losClear } from './map';
import type { PlayerCmd, Soldier, Vec3 } from './types';
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
  const gx = toTile(to.x), gz = toTile(to.z);
  if (sx === gx && sz === gz) return null;
  const open = (x: number, z: number) => x >= 0 && z >= 0 && x < GRID && z < GRID && grid[z * GRID + x] === T_OPEN;
  if (!open(gx, gz)) return null;

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
  // LOS smoothing: take the farthest path node we can walk straight to
  let target = path[0];
  for (let i = Math.min(path.length - 1, 24); i > 0; i--) {
    const px = toWorld(path[i] % GRID), pz = toWorld((path[i] / GRID) | 0);
    if (losClear(grid, from, { x: px, y: 0, z: pz }, 0.6)) { target = path[i]; break; }
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

function objectiveFor(w: World, s: Soldier): Vec3 {
  const m = w.mode;
  const enemyBase = w.map.basePos[1 - s.team];
  switch (m.id) {
    case 'ctf': {
      const enemyFlag = m.flags![1 - s.team];
      const ownFlag = m.flags![s.team];
      if (s.carryingFlag >= 0) return w.map.basePos[s.team]; // bring it home
      if (!ownFlag.atHome && ownFlag.carrierId < 0) return ownFlag.pos; // return ours
      if (enemyFlag.carrierId === -1) return enemyFlag.pos; // go steal
      // escort/hunt: their flag is being carried by teammate — push mid
      return w.map.hillPos;
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

    // unarmed utility rides (ambulance/tunneler/hoverboard): drive to objective, hop out
    const goal = objectiveFor(w, s);
    const dGoal = Math.hypot(goal.x - v.pos.x, goal.z - v.pos.z);
    if (dGoal < 14 && v.kind !== 'tank') { cmd.use = true; return cmd; } // disembark near objective
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
      if (!VEHICLES[v.kind].weapon || VEHICLES[v.kind].immobile) continue; // bots skip utility rides
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

  // --- movement: repath periodically toward objective (or flank target) ---
  const wantRepath = !s.botGoal || w.time >= (s.botRepathAt ?? 0) ||
    Math.hypot((s.botGoal?.x ?? 0) - s.pos.x, (s.botGoal?.z ?? 0) - s.pos.z) < 3;
  if (wantRepath) {
    s.botRepathAt = w.time + 0.9 + w.rng.next() * 0.7;
    const dest = target && w.mode.id === 'tdm'
      ? target.pos
      : goal;
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

  // --- combat ---
  if (target) {
    const d = Math.hypot(target.pos.x - s.pos.x, target.pos.z - s.pos.z);
    const wdef = WEAPONS[s.weapons[s.weaponIdx]];

    // pick sensible weapon slot
    if (s.classId === 'heavy') cmd.weaponSlot = d > 25 || target.vehicleId >= 0 ? 1 : 0;
    else if (s.classId === 'medic') cmd.weaponSlot = 0;
    else if (s.classId === 'engineer') cmd.weaponSlot = 0;

    const aimErr = (w.rng.next() - 0.5) * (s.kind === 'zombie' ? 0.2 : 0.055) * (d / 18 + 0.6)
      * DIFFICULTY_AIM[w.opts.difficulty ?? 'veteran'];
    cmd.aimYaw = leadYaw(s.pos, target, wdef.speed) + aimErr;
    if (d < wdef.range * 0.95) cmd.fire = true;

    // hold position vs close targets, strafe-dance
    if (d < 22) {
      if (w.rng.next() < 0.02) s.botStrafeDir = (s.botStrafeDir ?? 1) * -1;
      const perp = cmd.aimYaw + Math.PI / 2;
      mvx = Math.cos(perp) * (s.botStrafeDir ?? 1) * 0.8 + mvx * 0.3;
      mvz = Math.sin(perp) * (s.botStrafeDir ?? 1) * 0.8 + mvz * 0.3;
      // heavies and infiltrators back off, zombies never do
      if (d < 8 && (s.classId === 'heavy' || s.classId === 'infiltrator')) {
        mvx -= Math.cos(cmd.aimYaw) * 0.7;
        mvz -= Math.sin(cmd.aimYaw) * 0.7;
      }
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
  if (s.classId === 'infiltrator' && !s.cloaked && !target && s.energy > 70 && w.rng.next() < 0.008) cmd.ability = true;

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

  // spitters keep distance and spit; others close to melee
  const wdef = WEAPONS[s.weapons[0]];
  if (isSpitter && bestD < 24) {
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
    if (bestD < wdef.range + 0.5 && w.time >= s.nextFireAt) {
      s.nextFireAt = w.time + 1 / wdef.rof;
      w.damageSoldier(best, wdef.damage, s.id, wdef.id);
      w.emit({ type: 'shot', pos: s.pos, weapon: wdef.id, soldierId: s.id });
    }
  }
  w.stepSoldierPhysics(s, dt);
}
