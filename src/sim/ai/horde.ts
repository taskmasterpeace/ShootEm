// ---------------------------------------------------------------------------
// THE UNDEAD & THE SCRAP — the horde brains (zombie + Iron-Eater).
//
// Extracted from bots.ts (see docs/AI-ARCHITECTURE.md). Called per-tick from
// world.ts. Own targeting loop — depends on the leaves (pathfinding) plus the
// one back-edge into the brain (doorAhead, a nav primitive). No combat/objective
// coupling. Behaviour byte-identical; determinism rides the unchanged draws.
// ---------------------------------------------------------------------------
import { WEAPONS, weaponNoiseRadius } from '../data';
import { T_CLIMB, T_COVER, isBlocked, losClear, tileAt } from '../map';
import { tileToWorld } from '../map-geometry';
import { isIron, type Soldier, type Team, type Vec3, type Vehicle } from '../types';
import { type World } from '../world';
import { pathStep } from './pathfinding';
import { doorAhead } from '../bots';

// W3.10 ravager slam query — caller-owned scratch, never held across ticks.
const IRON_SLAM_SCRATCH: Soldier[] = [];

// SPRINTER DORMANCY wake ranges (OUTBREAK-SPEC §7.1): a survivor this close wakes
// it outright; this close down a clear line by sight; this close while firing by
// noise. Noise reaches furthest — the muzzle report carries.
const SPRINTER_WAKE_NEAR = 7;
const SPRINTER_WAKE_SIGHT = 12;
const SPRINTER_WAKE_NOISE = 18;

// ---------- zombies ----------

/** THE IRON EATERS' BRAIN (DD SS20, finish-list 12): the zed chase core
 *  drives the legs and the teeth; each kind adds its own hunger on top --
 *  scrap-rats GNAW parked vehicles, junkhounds JUMP the cover line. */
export function stepIron(w: World, s: Soldier, dt: number) {
  if (s.kind === 'scraprat') {
    // gnaw the nearest machine: vehicles are FOOD (SS20.1) -- a parked hull
    // with no crew is a picnic, a crewed one is a fight it still picks
    let v: Vehicle | undefined, bd = 30;
    for (const c of w.vehicles.values()) {
      if (!c.alive || c.team === s.team) continue;
      const d = Math.hypot(c.pos.x - s.pos.x, c.pos.z - s.pos.z);
      if (d < bd) { bd = d; v = c; }
    }
    if (v) {
      if (bd > 2.5) {
        const dx = v.pos.x - s.pos.x, dz = v.pos.z - s.pos.z, dl = Math.hypot(dx, dz) || 1;
        s.yaw = Math.atan2(dz, dx);
        s.vel.x = (dx / dl) * 13; s.vel.z = (dz / dl) * 13;
      } else {
        s.vel.x = 0; s.vel.z = 0;
        w.damageVehicle(v, 9 * dt, s.id, 'zombie_claw'); // the gnaw -- one seam, same as every shell
      }
      return;
    }
  }
  if (s.kind === 'junkhound' && s.pos.y <= 0.05) {
    // spring legs: a cover line one tile ahead is a JUMP, not a wall
    const aheadT = tileAt(w.map.grid, s.pos.x + Math.cos(s.yaw) * 2.4, s.pos.z + Math.sin(s.yaw) * 2.4, w.map.geometry);
    if (aheadT === T_COVER || aheadT === T_CLIMB) s.vel.y = 7.5;
  }
  if (s.kind === 'weaver' && w.time >= s.nextAbilityAt) {
    // W3.10 THE PLATE-WEAVE: the weaver is the swarm's armorer — every few
    // seconds it PULSES fresh plate onto the iron around it (never itself,
    // never past each machine's forged cap). Kill the weavers first or the
    // scrap keeps coming back hard.
    s.nextAbilityAt = w.time + 4;
    let mended = false;
    for (const ally of w.soldierIndex.roster(s.team)) {
      if (!ally.alive || ally.id === s.id || !isIron(ally.kind)) continue;
      if (Math.hypot(ally.pos.x - s.pos.x, ally.pos.z - s.pos.z) > 8) continue;
      if (ally.armor >= ally.maxArmor) continue;
      ally.armor = Math.min(ally.maxArmor, ally.armor + 14);
      mended = true;
    }
    if (mended) w.emit({ type: 'weaver_mend', pos: { ...s.pos }, soldierId: s.id });
  }
  if (s.kind === 'ravager') {
    // W3.10 THE CHARGE-AND-SLAM: the wrecker is slow until it isn't. A mark
    // 6-14u ahead triggers the RUSH (3× its lumber); contact SLAMS — a 3u
    // shockwave that shoves flesh and RAVAGES machines (it eats hulls).
    const charging = s.dashUntil !== undefined && w.time < s.dashUntil;
    if (!charging && w.time >= s.nextAbilityAt) {
      // pick a mark: nearest enemy body or hull in the rush band
      let mx = 0, mz = 0, md = Infinity;
      for (const e of w.soldierIndex.roster((1 - s.team) as Team)) {
        if (!e.alive || (e.kind !== 'human' && e.kind !== 'bot')) continue;
        const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
        if (d < md) { md = d; mx = e.pos.x; mz = e.pos.z; }
      }
      for (const v of w.vehicles.values()) {
        if (!v.alive || v.team === s.team) continue;
        const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
        if (d < md) { md = d; mx = v.pos.x; mz = v.pos.z; }
      }
      if (md >= 6 && md <= 14) {
        s.yaw = Math.atan2(mz - s.pos.z, mx - s.pos.x);
        s.dashUntil = w.time + 1.3;         // the rush window (renderer leans it in)
        s.nextAbilityAt = w.time + 8;       // the wreck takes a breath after
      }
    }
    if (charging) {
      // the rush integrates its OWN position (iron bodies move inside their
      // step, not through soldier physics — vel and push writes both die
      // before anything reads them). Wall-checked per axis, like the shuffle.
      const rush = 15;
      const nx = s.pos.x + Math.cos(s.yaw) * rush * dt;
      const nz = s.pos.z + Math.sin(s.yaw) * rush * dt;
      if (!isBlocked(w.map.grid, nx, s.pos.z, false, w.map.geometry)) s.pos.x = nx;
      if (!isBlocked(w.map.grid, s.pos.x, nz, false, w.map.geometry)) s.pos.z = nz;
      // contact: the SLAM
      let hit = false;
      for (const e of w.soldierIndex.near((1 - s.team) as Team, s.pos.x, s.pos.z, 3, IRON_SLAM_SCRATCH)) {
        if (!e.alive || (e.kind !== 'human' && e.kind !== 'bot')) continue;
        hit = true;
        w.damageSoldier(e, 30, s.id, 'zombie_claw');
        if (e.alive) {
          const dl = Math.max(Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z), 0.5);
          e.pushX += ((e.pos.x - s.pos.x) / dl) * 9;
          e.pushZ += ((e.pos.z - s.pos.z) / dl) * 9;
        }
      }
      for (const v of w.vehicles.values()) {
        if (!v.alive || v.team === s.team) continue;
        if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) > 3.4) continue;
        hit = true;
        w.damageVehicle(v, 120, s.id, 'zombie_claw'); // it EATS hulls
      }
      if (hit) {
        s.dashUntil = undefined;
        w.emit({ type: 'ravage', pos: { ...s.pos }, soldierId: s.id });
      }
      return; // the rush owns this tick — no zombie shuffle underneath
    }
  }
  stepZombie(w, s, dt); // the chase and the teeth are the horde's own
}

export function stepZombie(w: World, s: Soldier, dt: number) {
  // find nearest living human/bot — the horde's hottest loop (opt #38/S2:
  // 800 zeds × a full 812-body Map walk per tick WAS the frame-budget
  // cliff). The enemy ROSTER is ~12 bodies: a plain loop over it is 65×
  // less work, allocation-free, and byte-identical to the old scan (same
  // filtered set, same ascending-id order, same strict-< winner).
  let best: Soldier | null = null;
  let bestD = Infinity;
  for (const e of w.soldierIndex.roster((1 - s.team) as Team)) {
    if (!e.alive || (e.kind !== 'human' && e.kind !== 'bot')) continue;
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
          const step = losClear(w.map.grid, s.pos, s.botGoal, 0.6, w.map.geometry)
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

  // ═══ THE DEAD BITE STRUCTURES (the tower-defence blocker) ═══
  // The horde could only ever see `human` and `bot`, so every sentry turret a
  // player built was INVISIBLE SCENERY — zeds walked straight past it and no
  // defence you placed could ever be tested. A structure inside the reach of
  // a zed with nothing better to do is now a target: they crowd it, tear it
  // down, and a defended position becomes a thing you can actually lose.
  let structure: { pos: Vec3; id: number } | null = null;
  if (!best || bestD > 14) {
    let sd = Infinity;
    for (const t of w.turrets.values()) {
      if (!t.alive || t.team === s.team) continue;
      const d = Math.hypot(t.pos.x - s.pos.x, t.pos.z - s.pos.z);
      if (d < sd && d < 26) { sd = d; structure = { pos: t.pos, id: t.id }; }
    }
  }
  if (structure) {
    const dx = structure.pos.x - s.pos.x, dz = structure.pos.z - s.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    s.yaw = Math.atan2(dz, dx);
    if (dl > 2.2) {
      const speed = s.kind === 'sprinter' ? 12 : 7;
      s.vel.x = (dx / dl) * speed;
      s.vel.z = (dz / dl) * speed;
    } else {
      // in reach: stop and tear
      s.vel.x = 0; s.vel.z = 0;
      if (w.time >= s.nextFireAt) {
        const wd = WEAPONS[s.weapons[0]];
        s.nextFireAt = w.time + 1 / wd.rof;
        const t = w.turrets.get(structure.id);
        if (t) w.damageTurret(t, wd.damage * (s.kind === 'brute' ? 4 : 1));
      }
    }
    w.stepSoldierPhysics(s, dt);
    return;
  }

  if (!best) return;

  // SPRINTER DORMANCY (OUTBREAK-SPEC §7.1, acceptance #18): a dormant sprinter
  // creeps slow until a survivor gets CLOSE, is SEEN down a clear line, or makes
  // NOISE (fires) nearby — then it wakes for good and the terror spike lands.
  if (s.kind === 'sprinter' && s.dormant) {
    const firedRecently = best.nextFireAt > w.time && best.nextFireAt - w.time < 0.6;
    const landedLoud = (best.loudUntil ?? 0) > w.time; // M1: a leap ARRIVED nearby
    // §10: a lit TORCH is a beacon — it doubles the radius a sleeping
    // sprinter notices you at (still needs the sight line: light, not sound)
    const sightR = best.torchOn ? SPRINTER_WAKE_SIGHT * 2 : SPRINTER_WAKE_SIGHT;
    // §11.2: gunfire carries by the WEAPON'S report — a cannon wakes the whole
    // block, a silenced subsonic barely stirs it (the same radius the HUD's NSE
    // bar reads). The leap-thud keeps the flat loud radius: a landing is a fixed
    // event, not a muzzle.
    const gunR = weaponNoiseRadius(WEAPONS[best.weapons[best.weaponIdx]], best.ammoType);
    const wake = bestD < SPRINTER_WAKE_NEAR
      || (bestD < sightR && losClear(w.map.grid, { ...s.pos, y: 1.2 }, { ...best.pos, y: 1.2 }, 1.4, w.map.geometry))
      || (firedRecently && bestD < gunR)
      || (landedLoud && bestD < SPRINTER_WAKE_NOISE);
    if (wake) {
      s.dormant = false;
      w.emit({ type: 'sprinter_wake', pos: { ...s.pos }, soldierId: s.id });
    }
  }

  const isSpitter = s.kind === 'spitter';
  // MUTATION FIELD (§8): infected standing in a contamination nest run hotter.
  const nestMul = w.outbreakEnabled && w.inNest(s.pos.x, s.pos.z) ? 1.2 : 1;
  const speed = nestMul * (
    s.kind === 'brute' ? 6 :
    s.kind === 'bomber' ? 6.5 :
    s.kind === 'sprinter' ? (s.dormant ? 3 : 15 + (s.id % 3) * 0.6) : // dormant → creep; woken → terror
    s.kind === 'stalker' ? 5 :
    isSpitter ? 7.5 : 8.5 + (s.id % 5) * 0.35);
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
    for (let back = 0; back < 6 && isBlocked(w.map.grid, nx, nz, false, w.map.geometry); back++) {
      nx -= dir.x * 1.2;
      nz -= dir.z * 1.2;
    }
    if (!isBlocked(w.map.grid, nx, nz, false, w.map.geometry)) {
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
  if (isSpitter && bestD < 24 && losClear(w.map.grid, { ...s.pos, y: 1.2 }, { ...best.pos, y: 1.2 }, 1.4, w.map.geometry)) {
    if (bestD < 14) {
      // back away
      s.vel.x = -Math.cos(s.yaw) * speed * 0.7;
      s.vel.z = -Math.sin(s.yaw) * speed * 0.7;
    } else { s.vel.x = 0; s.vel.z = 0; }
    if (w.time >= s.nextFireAt && losClear(w.map.grid, { ...s.pos, y: 1.2 }, { ...best.pos, y: 1.2 }, 1.4, w.map.geometry)) {
      s.nextFireAt = w.time + 1 / wdef.rof;
      w.fireZombieSpit(s, best);
    }
  } else {
    // pathfind around walls every so often, otherwise beeline
    if (!s.botGoal || w.time >= (s.botRepathAt ?? 0)) {
      s.botRepathAt = w.time + 1.2 + (s.id % 7) * 0.1;
      const clear = losClear(w.map.grid, s.pos, best.pos, 0.6, w.map.geometry);
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
      const door = tileToWorld(w.map.geometry, doorIdx % w.map.geometry.cols, (doorIdx / w.map.geometry.cols) | 0);
      s.yaw = Math.atan2(door.z - s.pos.z, door.x - s.pos.x);
      if (w.time >= s.nextFireAt) {
        s.nextFireAt = w.time + 1 / wdef.rof;
        w.damageDoor(doorIdx, wdef.damage * (s.kind === 'brute' ? 5 : 1), s.id);
      }
      w.stepSoldierPhysics(s, dt);
      return;
    }
    if (bestD < wdef.range + 0.5 && w.time >= s.nextFireAt) {
      // BITE STRUGGLE (OUTBREAK-SPEC §15.5): a slice of the horde LATCHES ON
      // instead of swinging. "Grabbers" are chosen by id (no RNG draw — the
      // seeded stream must not shift under a terrain-coupled harness) so ~1 in
      // 4 infected clamp; spitters/bombers never grab. beginBiteStruggle does
      // the eligibility gate (gods/ascendants/immune fall through to the claw).
      const grabber = w.outbreakEnabled && s.kind !== 'spitter' && s.kind !== 'bomber' && s.id % 4 === 0;
      if (!grabber || !w.beginBiteStruggle(s, best)) {
        // claws are a SWING now: windup telegraph → arc strike → recover.
        // startMelee owns the rof pacing; prey that steps out of the arc is safe.
        w.startMelee(s, wdef);
      }
    }
  }
  w.stepSoldierPhysics(s, dt);
}
