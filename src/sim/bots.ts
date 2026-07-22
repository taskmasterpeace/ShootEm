// ===========================================================================
// THE BOT BRAIN.  Map + change-guide: docs/AI-ARCHITECTURE.md
//
// Being split into src/sim/ai/* leaf modules (bottom-up). Already out:
//   · ai/pathfinding.ts — THE PLANNER (pathStep, BFS/A*)
//   · ai/perception.ts  — THE EYES   (findTarget & targeting)
//   · ai/horde.ts        — THE UNDEAD & THE SCRAP (stepZombie, stepIron)
//
// Still here, by `// ----------` section:
//   objective selection · per-class doctrine · nav primitives · piloting ·
//   stepBot (the core) · scientist · K9
//
// DETERMINISM (do not break — see the doc): one seeded w.rng, unconditional
// draws before the effect gate, `id % N` off-stream, per-agent time-gates.
// ===========================================================================
import { CLASSES, DOG_STATS, VEHICLES, WEAPONS } from './data';
import {
  T_CLIMB, T_COVER, T_DOOR, T_METAL,
  T_METAL_DOOR, T_OPEN, T_SLIT, T_WALL,
  T_WATER, doorIsOpen, isDoorTile, losClear, tileAt,
} from './map';
import {
  ladderWellAt,
  worldFloorForHeight,
} from './map-layers';
import { halfDepth, halfWidth, tileToWorld, worldToTile } from './map-geometry';
import { type ClassId, type PlayerCmd, type Soldier, type Team, type Vec3, type Vehicle, isBoard, isZed } from './types';
import { type World } from './world';
import { BOT_TUNING as TUNE, DIFFICULTY } from './bot-tuning';

// opt #38 (S2): caller-owned scratch for spatial-index queries — one per call
// site so no query can clobber another mid-iteration; never held across ticks
const SEP_SCRATCH: Soldier[] = [];
import { visionMult } from './weather';
import { LSWS } from './lsw';
import { threatAt } from './influence';
import { dogWindowHesitation, indoorCivilianWaypoint, indoorGuardWaypoint, strongestDogScent } from './indoor-ai';
import { pbHuntObjective, pbPreyObjective } from './paintball';
import {
  closedDoorAhead,
  dogInsideAssignedBuilding,
  hostilesInK9Building,
  k9SearchWaypoints,
  setK9Heel,
} from './k9-orders';
import type { TheaterDomain, TheaterRoute } from './theater-types';
import { asElevationLevel } from './elevation';
import { recordVehicleEvent } from './vehicle-telemetry';
import { pathStep } from './ai/pathfinding';
import { enemyVehicleNear, findTarget, radarSearchPoint, vehicleCrewReacted } from './ai/perception';
export { radarSearchPoint }; // tests/radar-world.test.ts imports it via ./bots
export { stepIron, stepZombie } from './ai/horde'; // the horde brains, dispatched from world.ts

const noCmd = (): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
});



// ---------- objective selection per mode ----------

/** CTF roles are CLASS-shaped: fast boots raid, armor guards, the rest
 *  pressure mid. (Role-by-id gave us a medic "raider" who never left spawn
 *  and a heavy who died 18 times crossing mid.) */
export const raidsFlags = (s: Soldier) =>
  s.classId === 'jump' || s.classId === 'pathfinder' || s.classId === 'infiltrator' ||
  ((s.classId === 'infantry' || s.classId === 'ghost') && s.id % 2 === 0);

/** THE ROLE SPLIT (Robert: "everybody is going after the flag, even when
 *  you're close to their flag. There's nobody really playing defense.
 *  They're letting people set up turrets near them").
 *
 *  The old rule was `heavy && id % 2 === 0` — in a 12v12 that's ZERO to ONE
 *  defender per team, so every flag stand sat naked and two raiders could
 *  walk it out. Now a real third of the team holds home, chosen by CLASS
 *  (never by bare id — role-by-id once gave us a medic "raider" who never
 *  left spawn and a heavy who died 18 times crossing mid): armor and
 *  engineers dig in, medics split, runners raid. Guards and raiders are
 *  disjoint by construction. */
export const guardsHome = (s: Soldier) =>
  !raidsFlags(s) && (
    s.classId === 'heavy' || s.classId === 'engineer' ||
    (s.classId === 'medic' && s.id % 2 === 0) ||
    ((s.classId === 'infantry' || s.classId === 'ghost') && s.id % 4 === 1)
  );

/**
 * THE UTILITY ROLE (§AI-AUDIT theme 3, the Utility-Brain idea landed where it
 * actually pays). Defence used to be a FROZEN flag — `guardsHome` is a pure
 * function of class and id, fixed for the soldier's whole existence. So the
 * team never adapted: if RNG killed every guard at once, nobody backfilled and
 * home sat open until respawns landed; and when nothing threatened home, the
 * same bodies stood there anyway.
 *
 * Now the answer is SCORED and situational: work out how many defenders home
 * needs right now (pressure on it, and whether we can afford them), rank the
 * squad by fitness to defend (proximity home + the class bias that used to BE
 * the whole rule), and let the top N hold. Defenders EMERGE, and the ranking
 * re-runs every repath, so a dead guard is replaced within the second.
 *
 * `guardsHome` survives as the class bias — it was never wrong about WHO is
 * suited to defend, only about it being permanent.
 */
export function defendsNow(w: World, s: Soldier): boolean {
  if (s.carryingFlag >= 0) return false;      // a runner runs, always
  const m = w.mode;
  const home = m.flags ? m.flags[s.team].pos : w.map.basePos[s.team];
  /** Fitness to hold home. DELIBERATELY POSITION-FREE: ranking by proximity is
   *  the obvious idea and it is a trap — bots near home rank as defenders, so
   *  they stay near home, so they keep ranking as defenders. Measured: that
   *  feedback loop rebuilt the whole-team home blob the standoff-breaker exists
   *  to prevent (162 blob samples in the seed-4207 match). Class bias decides,
   *  id breaks ties; both are stable, so the only thing that moves the roster
   *  is somebody DYING — which is exactly the backfill we wanted. */
  const fit = (o: Soldier) =>
    (guardsHome(o) ? 100 : 0) + (raidsFlags(o) ? -60 : 0) - (o.id % 16);
  const myFit = fit(s);
  let pressure = 0, mates = 0, better = 0;
  for (const o of w.soldiers.values()) {
    if (!o.alive || (o.kind !== 'human' && o.kind !== 'bot') || o.ascendant) continue;
    if (o.team !== s.team) {
      if (Math.hypot(o.pos.x - home.x, o.pos.z - home.z) < 45) pressure++; // guns near our ground
      continue;
    }
    if (o.id === s.id) continue;
    mates++;
    // deterministic tie-break on id so two equally-fit bots never both yield
    const f = fit(o);
    if (f > myFit || (f === myFit && o.id < s.id)) better++;
  }
  // a floor of two, one more per three enemies pressing, and never more than a
  // THIRD of the squad — the old frozen flag held about that many, and letting
  // it climb toward half is how the attack quietly dies.
  const need = Math.min(Math.floor(mates / 3) + 1, 2 + Math.floor(pressure / 3));
  return better < need;
}

/** Am I among the ~3 nearest non-guards to the flag thief? So a RUNNING enemy
 *  carrier gets interceptors NOW without the whole team abandoning the attack
 *  (Robert's oldest complaint: "nobody plays defense"). */
function amCloseHunter(w: World, s: Soldier, thief: Soldier): boolean {
  const myD = Math.hypot(s.pos.x - thief.pos.x, s.pos.z - thief.pos.z);
  let closer = 0;
  for (const o of w.soldiers.values()) {
    if (o.id === s.id || !o.alive || o.team !== s.team || o.ascendant) continue;
    if (o.kind !== 'human' && o.kind !== 'bot') continue;
    if (guardsHome(o) || o.carryingFlag >= 0) continue; // guards already chase; runners keep running
    if (Math.hypot(o.pos.x - thief.pos.x, o.pos.z - thief.pos.z) < myD) closer++;
  }
  return closer < 3;
}

/** An enemy STRUCTURE worth a defender's attention — a sentry dug in near
 *  something we own. Bots could never see these: findTarget returns only
 *  Soldiers, so a turret nest by the flag was free real estate. */
function enemyTurretNear(w: World, team: Team, at: Vec3, maxRange: number): { pos: Vec3; d: number } | null {
  let best: { pos: Vec3; d: number } | null = null;
  for (const t of w.turrets.values()) {
    if (t.team === team || !t.alive || t.hp <= 0) continue;
    const d = Math.hypot(t.pos.x - at.x, t.pos.z - at.z);
    if (d < maxRange && (!best || d < best.d)) best = { pos: t.pos, d };
  }
  return best;
}

/** RESCUE (§11 row 4, D1.2 — Robert: "if you're behind enemy lines they
 *  should come GET you"): a friendly CUT OFF — no living teammate within
 *  24u and enemies pressing within 30u — gets a designated rescuer. */
function isolatedFriendly(w: World, s: Soldier): Soldier | null {
  let best: Soldier | null = null, bd = Infinity;
  for (const f of w.soldiers.values()) {
    if (!f.alive || f.team !== s.team || f.id === s.id || f.kind === 'dog' || isZed(f.kind)) continue;
    let mates = 0, foes = 0;
    for (const o of w.soldiers.values()) {
      if (!o.alive || o.id === f.id || o.id === s.id) continue; // the rescuer doesn't count as company
      const d = Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z);
      if (o.team === f.team && d < 24) mates++;
      else if (o.team !== f.team && d < 30) foes++;
    }
    if (mates > 0 || foes === 0) continue; // has company, or isn't in trouble
    // §15/§4.3: the beacon pings THE SQUAD FIRST — a cut-off squadmate
    // counts as half the distance when the rescuer picks who to answer
    const squadmate = f.squadId !== undefined && f.squadId === s.squadId;
    const d = Math.hypot(f.pos.x - s.pos.x, f.pos.z - s.pos.z) * (squadmate ? 0.5 : 1);
    if (d < bd && d < 70) { bd = d; best = f; }
  }
  return best;
}

/** exactly ONE rescuer per victim — the nearest free bot takes the job and
 *  the rest keep fighting the war (a dogpile rescue is a second casualty) */
function amClosestRescuer(w: World, s: Soldier, vic: Soldier): boolean {
  const myD = Math.hypot(vic.pos.x - s.pos.x, vic.pos.z - s.pos.z);
  for (const o of w.soldiers.values()) {
    if (!o.alive || o.team !== s.team || o.id === s.id || o.id === vic.id || o.kind !== 'bot') continue;
    if (guardsHome(o) || o.ascendant) continue;
    const d = Math.hypot(vic.pos.x - o.pos.x, vic.pos.z - o.pos.z);
    if (d < myD || (d === myD && o.id < s.id)) return false;
  }
  return true;
}

/**
 * opt #5 (S4): objectiveFor is pure but ~25% of World.step — it re-runs O(S)
 * scans (isolatedFriendly, defendsNow, amCloseHunter) every tick when the goal
 * only shifts at ~1 Hz. Cache it per-bot on a staggered ~4 Hz clock, cloned so
 * a returned live reference (a flag pos, a base) can't mutate under us, and
 * force a fresh compute the instant the bot's OWN carry state flips — a carrier
 * must turn for home now, not up to 250 ms later. Everything else (own-flag
 * flips, point ownership) is a strategic change that ≤250 ms of lag can't hurt.
 */
/** Bench-only switch: lets tools/bench-track.ts measure the true before/after
 *  of the S4 cache on the SAME binary. Never touched by the game (defaults on;
 *  no process.env in this hot path so the browser bundle stays clean). */
let OBJ_CACHE_ON = true;
export function _setObjectiveCache(on: boolean): void { OBJ_CACHE_ON = on; }

export function cachedObjective(w: World, s: Soldier): Vec3 {
  if (!OBJ_CACHE_ON) return objectiveFor(w, s);
  const flag = s.carryingFlag;
  if (s.botObjective && s.botObjAt !== undefined && w.time < s.botObjAt && s.botObjFlag === flag) {
    return s.botObjective;
  }
  const g = objectiveFor(w, s);
  s.botObjective = { x: g.x, y: g.y, z: g.z }; // snapshot, never a live reference
  s.botObjFlag = flag;
  // ~4 Hz, jittered per id so the fleet doesn't recompute on one tick
  s.botObjAt = w.time + 0.25 + (s.id % 8) * 0.01;
  return s.botObjective;
}

export function objectiveFor(w: World, s: Soldier): Vec3 {
  const m = w.mode;
  const enemyBase = w.map.basePos[1 - s.team];
  // RESCUE outranks the mode: guards keep the flag, everyone else can be
  // the one who breaks off — but only the CLOSEST free bot actually does.
  if (s.kind === 'bot' && !guardsHome(s) && !s.ascendant && s.carryingFlag < 0) {
    const vic = isolatedFriendly(w, s);
    // the y-channel contract: an objective's y is a STOREY (0 or 4), never an
    // altitude — a jump-trooper victim mid-arc is still a ground-floor man
    // (raw vic.pos here once sent every rescuer hunting a phantom loft)
    if (vic && amClosestRescuer(w, s, vic)) return { x: vic.pos.x, y: vic.floor === 1 ? 4 : 0, z: vic.pos.z };
  }
  switch (m.id) {
    case 'ctf': {
      const enemyFlag = m.flags![1 - s.team];
      const ownFlag = m.flags![s.team];
      if (s.carryingFlag >= 0) return w.map.basePos[s.team]; // bring it home
      if (!ownFlag.atHome && ownFlag.carrierId < 0) return ownFlag.pos; // return ours
      // OUR FLAG IS BEING RUN OFF — hunt the thief down (Robert's oldest
      // complaint, "nobody plays defense"). The standoff-breaker below only
      // covers a PARKED carrier; a MOVING one needs interceptors now. Guards
      // always chase; the 3 nearest non-guards peel off to converge, and the
      // rest keep raiding so the counter-attack isn't abandoned.
      if (!ownFlag.atHome && ownFlag.carrierId >= 0) {
        const thief = w.soldiers.get(ownFlag.carrierId);
        if (thief?.alive && Math.hypot(thief.vel.x, thief.vel.z) > 2 && (defendsNow(w, s) || amCloseHunter(w, s, thief))) {
          const ring = (s.id % 6) * (Math.PI / 3); // converge on a ring, not his exact tile
          return { x: thief.pos.x + Math.cos(ring) * 4, y: 0, z: thief.pos.z + Math.sin(ring) * 4 };
        }
      }
      // a teammate is running it home — ESCORT the runner, don't sightsee mid.
      // (Bodyguards are why captures happen at all in 12v12.)
      const carrier = enemyFlag.carrierId >= 0 ? w.soldiers.get(enemyFlag.carrierId) : undefined;
      if (carrier?.alive) {
        // THE STANDOFF BREAKER (the black box caught it: both flags held,
        // both carriers parked at home, 12/12 bodies frozen at each base for
        // eleven minutes, score 0:0). A carrier WAITING at base because our
        // own flag is away doesn't need the whole war watching him stand —
        // he needs it RECOVERING the flag that blocks his capture. Guards
        // ring the waiting carrier; everyone else hunts our flag (its pos
        // IS the enemy carrier while it's on their back, the drop point
        // after they fall).
        const homeBase = w.map.basePos[s.team];
        const parked = !ownFlag.atHome &&
          Math.hypot(carrier.pos.x - homeBase.x, carrier.pos.z - homeBase.z) < 12;
        if (parked && !defendsNow(w, s)) return { x: ownFlag.pos.x, y: 0, z: ownFlag.pos.z };
        // escort is a RING, never the runner's own tile — the old exact-pos
        // convergence stacked eleven bodies ON the carrier: a cage, not a
        // guard, and the run home slowed to a grind inside its own escort.
        const ring = (s.id % 8) * (Math.PI / 4);
        return { x: carrier.pos.x + Math.cos(ring) * 7, y: 0, z: carrier.pos.z + Math.sin(ring) * 7 };
      }
      // Everyone who isn't guarding goes FLAG-HUNTING on the wings. CTF has
      // no mid objective — the old "pressure mid" role fed a grinder in the
      // middle of the map while both flags gathered dust (probes: 0 flag
      // events in 6 minutes, ever). Two-leg route: run to a wing waypoint on
      // the map's edge, THEN cut to the flag. Odd ids take north, even take
      // south — the raid arrives as two prongs the guard wall can't face at
      // once, with the escorts (non-raider classes) fighting alongside.
      if (defendsNow(w, s)) {
        // a nest by our own flag is the job — nobody else is coming
        const nest = enemyTurretNear(w, s.team, ownFlag.pos, 32);
        if (nest) return nest.pos;
        // ROOM DUTY (Robert: "they should be able to sweep rooms inside"):
        // a third of guard lives post INSIDE the nearest house overlooking
        // the flag — the pathfinder already walks doors, the hands already
        // open them; the overwatch just needed someone ORDERED indoors.
        if ((s.botLifeSeed ?? 0) === 1) {
          let room: Vec3 | null = null, roomUp = false, hd = 40;
          for (const h of w.map.houses) {
            const d = Math.hypot(h.center.x - ownFlag.pos.x, h.center.z - ownFlag.pos.z);
            if (d < hd) { hd = d; room = h.center; roomUp = h.floors === 2; }
          }
          // LADDER IQ: a lofted house posts its guard UPSTAIRS — the y=4
          // channel tells the router which storey the post is on. The base
          // compound stands its watchtower NEAREST the flag on purpose, so
          // this nearest-room pick lands the overwatch up on the slit ring.
          if (room) return { x: room.x, y: roomUp ? 4 : 0, z: room.z };
        }
        // otherwise armor orbits the flag stand (engineers seed sentries there)
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
        const wing = Math.min(halfWidth(w.map.geometry), halfDepth(w.map.geometry)) * 0.6;
        const wp = {
          x: Math.max(-halfWidth(w.map.geometry) + 9, Math.min(halfWidth(w.map.geometry) - 9, (base.x + enemyFlag.pos.x) / 2 - (az / al) * side * wing)),
          y: 0,
          z: Math.max(-halfDepth(w.map.geometry) + 9, Math.min(halfDepth(w.map.geometry) - 9, (base.z + enemyFlag.pos.z) / 2 + (ax / al) * side * wing)),
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
      // NB: deliberately the bare point. A ring-spread here reads well on paper
      // (twelve bodies, one tile) but the separation shove already keeps them
      // off each other's toes inside hillRadius, and offsetting the objective
      // breaks routing to a precise goal (a bot clearing rooms to a back-room
      // hill). Holding the hill IS the mode — go stand on it.
      return m.hillPos!;
    case 'conquest': {
      const pts = m.points!;
      const owned = pts.filter((p) => p.owner === s.team);
      const contestable = pts.filter((p) => p.owner !== s.team);
      // DEFENCE EXISTS NOW: guards hold what we've already taken (nobody ever
      // did — a captured point was abandoned the moment it flipped); everyone
      // else pushes the nearest point we don't own.
      const defending = defendsNow(w, s);
      const pool = (defending && owned.length) ? owned
        : (contestable.length ? contestable : pts);
      let best = pool[0], bd = Infinity;
      for (const p of pool) {
        const d = Math.hypot(p.pos.x - s.pos.x, p.pos.z - s.pos.z);
        if (d < bd) { bd = d; best = p; }
      }
      const a = (s.id % 8) * (Math.PI / 4);
      const r = defending ? 7 : 3; // spread on the point, don't stack its tile
      return { x: best.pos.x + Math.cos(a) * r, y: 0, z: best.pos.z + Math.sin(a) * r };
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
    case 'science': {
      const science = w.science;
      if (!science) return w.map.hillPos;
      if (s.team === 1) {
        const guardIndex = science.guardIds.indexOf(s.id);
        const route = guardIndex >= 0 ? science.patrolRoutes[guardIndex] : undefined;
        if (route?.points.length) {
          let pointIndex = s.botPatrolIndex ?? Math.min(1, route.points.length - 1);
          const point = route.points[pointIndex];
          if (point && s.floor === worldFloorForHeight(point.y)
              && Math.hypot(point.x - s.pos.x, point.z - s.pos.z) < 1.35) {
            pointIndex = (pointIndex + 1) % route.points.length;
          }
          s.botPatrolIndex = pointIndex;
          return route.points[pointIndex] ?? route.points[0];
        }
        const assigned = science.guardPosts[Math.abs(guardIndex) % science.guardPosts.length];
        return assigned ?? w.map.basePos[1];
      }
      if (science.phase === 'extract') return science.extraction;
      const socket = science.objective.pos[Math.min(science.objective.pos.length - 1, Math.floor(science.objective.progress))];
      return socket ?? science.extraction;
    }
    case 'paintball': {
      // §14 + play types (Robert: "they just run right towards you"): the
      // prey runs the SAFEST open pad; each hunter hunts by PERSONALITY —
      // rushers charge, flankers swing wide, anchors hold the tag circuit.
      const hunted = m.huntedTeam ?? 1;
      if (s.team === hunted) {
        return pbPreyObjective(w, s) ?? w.map.basePos[s.team];
      }
      const prey = [...w.soldiers.values()].find((e) => e.alive && e.team === hunted && (e.kind === 'human' || e.kind === 'bot'));
      return prey ? pbHuntObjective(w, s, prey) : w.map.hillPos;
    }
    default: // tdm — hunt toward the enemy-side / midfield blend
      // (the z term used to drop the 0.6·hill.z, skewing the whole team's
      // drift toward one wrong point on maps whose hill isn't at z=0).
      // Deliberately NOT ring-spread like koth/conquest: TDM has no capture
      // tile to stack on, bots fan out chasing contacts anyway, and this point
      // doubles as the nav harness several tests steer bots with.
      return { x: enemyBase.x * 0.4 + w.map.hillPos.x * 0.6, y: 0, z: enemyBase.z * 0.4 + w.map.hillPos.z * 0.6 };
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
export function doorAhead(w: World, pos: Vec3, yaw: number): number {
  const { cols, rows } = w.map.geometry;
  for (const reach of [w.map.geometry.tile * 0.6, w.map.geometry.tile * 1.3]) {
    const x = pos.x + Math.cos(yaw) * reach;
    const z = pos.z + Math.sin(yaw) * reach;
    const [tx, tz] = worldToTile(w.map.geometry, x, z);
    if (tx < 1 || tz < 1 || tx >= cols - 1 || tz >= rows - 1) continue;
    const door = w.map.grid[tz * cols + tx];
    if (isDoorTile(door) && !doorIsOpen(door) && door !== T_METAL_DOOR) return tz * cols + tx;
  }
  return -1;
}

/** Nearest cover tile center within `range` units — where a downed bot crawls. */
/** Cover worth running to. NEAREST is not the same as GOOD — a bot at 20% HP
 *  used to peel to the closest crate even when that crate sat between it and
 *  the three men shooting it. `team` opts into the INFLUENCE field: candidates
 *  are scored on distance PLUS how much enemy threat is radiating onto them,
 *  so a bot breaks toward the quiet side. Pass team < 0 for the old pure-nearest
 *  behaviour (the downed crawl just wants the closest thing to hide behind). */
function nearestCover(w: World, pos: Vec3, range: number, team: Team | -1 = -1): Vec3 | null {
  const grid = w.map.grid;
  const { cols, rows, tile } = w.map.geometry;
  const [cx, cz] = worldToTile(w.map.geometry, pos.x, pos.z);
  const r = Math.ceil(range / tile);
  let best: Vec3 | null = null;
  let bestScore = Infinity;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const tx = cx + dx, tz = cz + dz;
      if (tx < 0 || tz < 0 || tx >= cols || tz >= rows) continue;
      if (grid[tz * cols + tx] !== T_COVER) continue;
      const { x: px, z: pz } = tileToWorld(w.map.geometry, tx, tz);
      const d = Math.hypot(px - pos.x, pz - pos.z);
      if (d >= range) continue;
      // distance in units + threat weighted so a genuinely hot tile loses to a
      // slightly further quiet one, without sending anyone across the map
      const score = team >= 0 ? d + threatAt(w.influence, team as Team, px, pz) * 9 : d;
      if (score < bestScore) { best = { x: px, y: 0, z: pz }; bestScore = score; }
    }
  }
  return best;
}

/** §8.7: is there a CLIMB barricade on the walking line? Probes far enough
 *  out that a jump trooper can light the jet BEFORE the wall arrives — the
 *  jet climbs ~9.5u/s, so one tile of warning buys the 2.5u lip easily. */
function climbAhead(w: World, pos: Vec3, yaw: number): boolean {
  const { cols, rows } = w.map.geometry;
  for (const reach of [w.map.geometry.tile * 0.7, w.map.geometry.tile * 1.5]) {
    const x = pos.x + Math.cos(yaw) * reach;
    const z = pos.z + Math.sin(yaw) * reach;
    const [tx, tz] = worldToTile(w.map.geometry, x, z);
    if (tx < 1 || tz < 1 || tx >= cols - 1 || tz >= rows - 1) continue;
    if (w.map.grid[tz * cols + tx] === T_CLIMB) return true;
  }
  return false;
}

function buildingAhead(w: World, vehicle: Vehicle, distance = 36): boolean {
  const radius = VEHICLES[vehicle.kind].radius;
  const sideX = -Math.sin(vehicle.yaw) * radius * 0.8;
  const sideZ = Math.cos(vehicle.yaw) * radius * 0.8;
  for (let ahead = 0; ahead <= distance; ahead += w.map.geometry.tile) {
    const x = vehicle.pos.x + Math.cos(vehicle.yaw) * ahead;
    const z = vehicle.pos.z + Math.sin(vehicle.yaw) * ahead;
    for (const offset of [-1, 0, 1]) {
      const tile = tileAt(w.map.grid, x + sideX * offset, z + sideZ * offset, w.map.geometry);
      if (tile === T_WALL || tile === T_SLIT || tile === T_DOOR || tile === T_METAL || tile === T_METAL_DOOR) return true;
    }
  }
  return false;
}

function insertionZone(w: World, s: Soldier) {
  const zones = [...(w.map.theater?.landingZones ?? [])]
    .filter((zone) => zone.side === null || zone.side === s.team)
    .sort((a, b) => Number(a.side !== null) - Number(b.side !== null) || a.id.localeCompare(b.id));
  const existing = zones.find((zone) => zone.id === s.botLandingZoneId);
  const selected = existing ?? zones[0];
  if (selected) s.botLandingZoneId = selected.id;
  return selected;
}

function stableRouteHash(soldierId: number, vehicleId: number, routeId: string): number {
  let hash = (0x811c9dc5 ^ soldierId ^ Math.imul(vehicleId, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < routeId.length; i++) {
    hash ^= routeId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function vehicleRouteDomain(vehicle: Vehicle): TheaterDomain {
  const def = VEHICLES[vehicle.kind];
  return def.flies ? 'air' : def.submersible ? 'deep' : def.boat ? 'surface' : 'ground';
}

/** Stable compatible route selection for a crewed vehicle. */
export function vehicleRouteFor(w: World, s: Soldier, vehicle: Vehicle): TheaterRoute | null {
  const routes = (w.map.theater?.routes ?? [])
    .filter((route) => route.domain === vehicleRouteDomain(vehicle))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!routes.length) return null;
  if (s.botVehicleRouteId) {
    const existing = routes.find((route) => route.id === s.botVehicleRouteId);
    if (existing) return existing;
  }
  let best = routes[0];
  let bestHash = stableRouteHash(s.id, vehicle.id, best.id);
  for (const route of routes.slice(1)) {
    const hash = stableRouteHash(s.id, vehicle.id, route.id);
    if (hash < bestHash) { best = route; bestHash = hash; }
  }
  s.botVehicleRouteId = best.id;
  return best;
}

/** Return and advance the next authored anchor for this driver. */
export function vehicleWaypoint(_w: World, s: Soldier, vehicle: Vehicle, route: TheaterRoute): Vec3 | null {
  if (route.points.length < 2) return null;
  if (s.botVehicleRouteId !== route.id || s.botVehicleRouteIndex === undefined) {
    s.botVehicleRouteId = route.id;
    s.botVehicleRouteDir = vehicle.team === 0 ? 1 : -1;
    s.botVehicleRouteIndex = vehicle.team === 0 ? 1 : route.points.length - 2;
  }
  const dir = s.botVehicleRouteDir ?? 1;
  let index = s.botVehicleRouteIndex;
  const threshold = Math.max(6, route.width / 2);
  if (Math.hypot(route.points[index].x - vehicle.pos.x, route.points[index].z - vehicle.pos.z) <= threshold) {
    const next = index + dir;
    if (next < 0 || next >= route.points.length) {
      if (!s.botVehicleRouteCompleted) {
        s.botVehicleRouteCompleted = true;
        recordVehicleEvent(_w.vehicleTelemetry, {
          kind: 'route_complete', t: _w.time, vehicleId: vehicle.id, vehicleKind: vehicle.kind,
          theaterId: _w.map.theater?.id ?? 'classic', seed: _w.map.seed,
          x: vehicle.pos.x, z: vehicle.pos.z, detail: route.id,
        });
      }
      s.botVehicleRouteDir = dir === 1 ? -1 : 1;
      index = Math.max(0, Math.min(route.points.length - 1, index - dir));
    } else {
      index = next;
    }
    s.botVehicleRouteIndex = index;
  }
  return { ...route.points[index] };
}

/** Deterministically give nearby theater bots a driver role and route state. */
export function assignVehicleRoles(w: World): void {
  if (!w.map.theater) return;
  const bots = [...w.soldiers.values()].filter((soldier) => soldier.kind === 'bot' && soldier.alive).sort((a, b) => a.id - b.id);
  const vehicles = [...w.vehicles.values()].filter((vehicle) => vehicle.alive).sort((a, b) => a.id - b.id);
  for (const vehicle of vehicles) {
    let driver = vehicle.seats[0] >= 0 ? w.soldiers.get(vehicle.seats[0]) : undefined;
    if (!driver) {
      driver = bots.find((bot) => bot.vehicleId < 0 && bot.team === vehicle.team
        && Math.hypot(bot.pos.x - vehicle.pos.x, bot.pos.z - vehicle.pos.z) <= 12);
      if (driver) {
        vehicle.seats[0] = driver.id;
        driver.vehicleId = vehicle.id;
        driver.seat = 0;
        driver.enteredVehicleAt = w.time;
        vehicle.spoolUntil = w.time + (VEHICLES[vehicle.kind].liftoffTime ?? 0);
      }
    }
    if (driver?.kind === 'bot') {
      const route = vehicleRouteFor(w, driver, vehicle);
      if (route) vehicleWaypoint(w, driver, vehicle, route);
      if (VEHICLES[vehicle.kind].flies && !driver.botAirProfile) driver.botAirProfile = 'patrol';
    }
  }
}

function stepTheaterVehicle(w: World, s: Soldier, vehicle: Vehicle, route: TheaterRoute, cmd: PlayerCmd): PlayerCmd {
  const def = VEHICLES[vehicle.kind];
  const zone = s.botAirProfile === 'insertion' && vehicle.kind === 'transportheli' ? insertionZone(w, s) : undefined;
  let point = zone?.pos ?? vehicleWaypoint(w, s, vehicle, route);
  if (!point) return cmd;

  // JET DOGFIGHT (mountain warfare): a fighter breaks its patrol to HUNT the
  // nearest enemy AIRCRAFT — pursue it, match its altitude below, lead and fire.
  // This is what makes the sky CONTESTED instead of a parade of ground routes.
  // Other airframes (Warhawk gun jet, bombers, gunships) keep flying their line.
  let airPrey: Vehicle | null = null;
  if (def.flies && (vehicle.kind === 'interceptor' || vehicle.kind === 'airsuperiority') && def.weapon) {
    let bestD = WEAPONS[def.weapon].range * 1.6; // detect past weapon range, then close in
    for (const t of w.vehicles.values()) {
      if (!t.alive || t.team === s.team || !VEHICLES[t.kind].flies) continue;
      const d = Math.hypot(t.pos.x - vehicle.pos.x, t.pos.z - vehicle.pos.z);
      if (d < bestD) { bestD = d; airPrey = t; }
    }
    if (airPrey) {
      point = { x: airPrey.pos.x, y: point.y, z: airPrey.pos.z };
      // ENERGY FIGHT: if the prey has slid well behind the nose at close range (a
      // merge overshoot), commit to a short straight EXTENSION to rebuild energy +
      // separation, then re-merge — instead of a slow death-spiral scissors.
      let off = Math.atan2(airPrey.pos.z - vehicle.pos.z, airPrey.pos.x - vehicle.pos.x) - vehicle.yaw;
      while (off > Math.PI) off -= Math.PI * 2;
      while (off < -Math.PI) off += Math.PI * 2;
      const preyD = Math.hypot(airPrey.pos.x - vehicle.pos.x, airPrey.pos.z - vehicle.pos.z);
      if (Math.abs(off) > 1.9 && preyD < WEAPONS[def.weapon].range * 0.7 && w.time >= (s.botExtendUntil ?? 0)) {
        s.botExtendUntil = w.time + 1.1;
      }
      if (w.time < (s.botExtendUntil ?? 0)) {
        point = { x: vehicle.pos.x + Math.cos(vehicle.yaw) * 60, y: point.y, z: vehicle.pos.z + Math.sin(vehicle.yaw) * 60 };
      }
    }
  }

  const dGoal = Math.hypot(point.x - vehicle.pos.x, point.z - vehicle.pos.z);
  if (zone && dGoal <= zone.radius * 0.65) {
    cmd.aimYaw = vehicle.yaw;
    cmd.moveX = 0;
    cmd.moveZ = 0;
    if (asElevationLevel(vehicle.band) > 0) cmd.use = true;
    else if (!s.botVehicleRouteCompleted) {
      s.botVehicleRouteCompleted = true;
      recordVehicleEvent(w.vehicleTelemetry, {
        kind: 'landing', t: w.time, vehicleId: vehicle.id, vehicleKind: vehicle.kind,
        theaterId: w.map.theater?.id ?? 'classic', seed: w.map.seed,
        x: vehicle.pos.x, z: vehicle.pos.z, detail: zone.id,
      });
    }
    return cmd;
  }
  if (w.time >= (s.botMoveCheckAt ?? 0)) {
    const moved = Math.hypot(vehicle.pos.x - (s.botLastX ?? vehicle.pos.x), vehicle.pos.z - (s.botLastZ ?? vehicle.pos.z));
    if (s.botLastX !== undefined && moved < 1.2 && dGoal > Math.max(6, route.width / 2)) {
      s.botVehicleStallWindows = (s.botVehicleStallWindows ?? 0) + 1;
      if (s.botVehicleStallWindows >= 3) {
        s.botVehiclePersistentStalls = (s.botVehiclePersistentStalls ?? 0) + 1;
        s.botVehicleStallWindows = 0;
      }
    } else {
      s.botVehicleStallWindows = 0;
    }
    s.botLastX = vehicle.pos.x;
    s.botLastZ = vehicle.pos.z;
    s.botMoveCheckAt = w.time + 3;
  }

  let wantYaw = Math.atan2(point.z - vehicle.pos.z, point.x - vehicle.pos.x);
  let inbound: { x: number; z: number } | null = null;
  if (def.flies) {
    for (const projectile of w.projectiles.values()) {
      if (projectile.team !== s.team && projectile.homingVehicleId === vehicle.id) { inbound = projectile.pos; break; }
    }
  }
  if (inbound) {
    const away = Math.atan2(vehicle.pos.z - inbound.z, vehicle.pos.x - inbound.x);
    wantYaw = away + (s.id % 2 ? 0.87 : -0.87);
    if (vehicle.flares > 0) cmd.grenade = true;
  }
  let delta = wantYaw - vehicle.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  cmd.moveX = Math.max(-1, Math.min(1, delta * 2));
  cmd.moveZ = (s.botVehicleStallWindows ?? 0) > 0 ? 0.35 : Math.abs(delta) < 1.1 ? -1 : -0.2;
  cmd.aimYaw = vehicle.yaw;

  if (def.submersible && !vehicle.submerged && w.canSubmerge(vehicle)) cmd.ability = true;

  if (def.flies && s.botAirProfile === 'strike') {
    const index = s.botVehicleRouteIndex ?? 1;
    const progress = index / Math.max(1, route.points.length - 1);
    const desired = progress <= 0.34 ? 2 : progress <= 0.67 && !buildingAhead(w, vehicle) ? 1 : 3;
    const level = asElevationLevel(vehicle.band);
    if (level < desired) cmd.ability = true;
    else if (level > desired) cmd.use = true;
  }
  if (def.flies && (s.botAirProfile === 'support' || s.botAirProfile === 'insertion')) {
    const desired = buildingAhead(w, vehicle) ? 2 : s.botAirProfile === 'support' ? 1 : 2;
    const level = asElevationLevel(vehicle.band);
    if (level < desired) cmd.ability = true;
    else if (level > desired) cmd.use = true;
  }

  // a chasing fighter climbs/descends to its prey's altitude band so the merge
  // actually happens (a Specter at Ground never catches a Sky-band jet).
  if (airPrey) {
    const desired = asElevationLevel(airPrey.band);
    const level = asElevationLevel(vehicle.band);
    if (level < desired) cmd.ability = true;
    else if (level > desired) cmd.use = true;
  }

  if (def.weapon) {
    const range = WEAPONS[def.weapon].range;
    const preyD = airPrey ? Math.hypot(airPrey.pos.x - vehicle.pos.x, airPrey.pos.z - vehicle.pos.z) : Infinity;
    // the fighter shoots its air prey FIRST — leading it manually (jets are fast).
    if (airPrey && preyD < range) {
      const tLead = preyD / WEAPONS[def.weapon].speed;
      cmd.aimYaw = Math.atan2((airPrey.pos.z + airPrey.vel.z * tLead) - vehicle.pos.z, (airPrey.pos.x + airPrey.vel.x * tLead) - vehicle.pos.x);
      cmd.fire = vehicleCrewReacted(w, s, -airPrey.id - 1);
    } else {
      const target = findTarget(w, s, WEAPONS[def.weapon].range);
      if (target) {
        cmd.aimYaw = leadYaw(vehicle.pos, target, WEAPONS[def.weapon].speed);
        cmd.fire = vehicleCrewReacted(w, s, target.id);
      } else {
        const targetVehicle = enemyVehicleNear(w, s, WEAPONS[def.weapon].range);
        if (targetVehicle) {
          cmd.aimYaw = Math.atan2(targetVehicle.pos.z - vehicle.pos.z, targetVehicle.pos.x - vehicle.pos.x);
          cmd.fire = vehicleCrewReacted(w, s, -targetVehicle.id - 1);
        }
      }
    }
  }
  return cmd;
}

// ---------- main bot brain ----------

/** MOTOR TRIALS driver: steer the board through the ordered checkpoints, easing
 *  the throttle into each carve so the slip model doesn't wash the nose wide.
 *  Deterministic — the line and throttle come from geometry plus an id-hashed
 *  skill tier, never the RNG stream (races must replay byte-identical). */
function raceDriverCmd(w: World, s: Soldier, v: Vehicle, cmd: PlayerCmd): PlayerCmd {
  const track = w.map.raceTrack;
  if (!track) return cmd;
  const racer = w.mode.racers?.find((r) => r.id === s.id);
  const n = track.checkpoints.length;
  const cur = racer ? racer.next : 0;
  const gate = track.checkpoints[cur].pos;
  const after = track.checkpoints[(cur + 1) % n].pos;
  // aim mostly at the next gate, biased toward the one after for a smoother line
  const aimX = gate.x * 0.72 + after.x * 0.28;
  const aimZ = gate.z * 0.72 + after.z * 0.28;
  let dy = Math.atan2(aimZ - v.pos.z, aimX - v.pos.x) - v.yaw;
  while (dy > Math.PI) dy -= 2 * Math.PI;
  while (dy < -Math.PI) dy += 2 * Math.PI;
  cmd.moveX = Math.max(-1, Math.min(1, dy * 2.3)); // steer toward the line
  const align = Math.abs(dy);
  const skill = 0.72 + 0.28 * ((s.id % 3) / 2);     // three deterministic skill tiers
  // full gas on the straight, lift for the corner so the drift bites in time
  cmd.moveZ = align < 0.45 ? -1 : align < 1.0 ? -0.72 * skill : -0.4 * skill;
  cmd.aimYaw = v.yaw; // boards are unarmed — keep the aim steady
  return cmd;
}

export function stepBot(w: World, s: Soldier, dt: number): PlayerCmd {
  const cmd = noCmd();
  cmd.aimYaw = s.yaw;
  const cls = CLASSES[s.classId];

  // §4.3: a downed bot's whole doctrine shrinks to one word — cover. Crawl to
  // the nearest cover tile and hug it; failing that, away from the shooter.
  if (s.downed) {
    const cover = nearestCover(w, s.pos, 9);
    const threat = cover ? null : findTarget(w, s, 30);
    const away = threat ? { x: s.pos.x * 2 - threat.pos.x, y: 0, z: s.pos.z * 2 - threat.pos.z } : null;
    const dest = cover ?? away;
    if (dest) {
      const dx = dest.x - s.pos.x, dz = dest.z - s.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      cmd.moveX = dx / dl;
      cmd.moveZ = dz / dl;
      cmd.aimYaw = Math.atan2(dz, dx);
    }
    return cmd; // no shooting from the ground — applyCmd wouldn't allow it anyway
  }

  // --- driving a vehicle ---
  if (s.vehicleId >= 0) {
    const v = w.vehicles.get(s.vehicleId);
    if (!v || !v.alive) return cmd;
    const vdef = VEHICLES[v.kind];
    const wdef = vdef.weapon ? WEAPONS[vdef.weapon] : undefined;

    // MOTOR TRIALS: a bot on a raceboard drives the circuit, not the war
    if ((w.mode.id === 'race' || w.mode.id === 'timetrial') && isBoard(v.kind)) {
      return raceDriverCmd(w, s, v, cmd);
    }

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

    const theaterRoute = vehicleRouteFor(w, s, v);
    if (theaterRoute) return stepTheaterVehicle(w, s, v, theaterRoute, cmd);

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
    const goal = cachedObjective(w, s);
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
    // THE DRIVER GETS A MAP (Robert: "they go fast and just run into a
    // wall… pathfinding is kind of screwed up"). Wheels now roll the same
    // BFS the boots use — wheels flavor: doorways, ladders, and barricades
    // off the menu — and steer at the next waypoint, not the compass
    // bearing. Flyers keep the compass (the sky has no walls), and a
    // burrowed breacher tunnels straight (that's the whole point of it).
    const flying = !!vdef.flies || (!!vdef.digs && v.burrowed);
    let aimPt = goal;
    if (!flying) {
      if (!s.botGoal || w.time >= (s.botRepathAt ?? 0) ||
          Math.hypot(s.botGoal.x - v.pos.x, s.botGoal.z - v.pos.z) < 4.5) {
        s.botRepathAt = w.time + 1.1;
        s.botGoal = pathStep(w, v.pos, goal, false, true) ?? { x: goal.x, y: 0, z: goal.z };
      }
      aimPt = s.botGoal;
    }
    let wantYaw = Math.atan2(aimPt.z - v.pos.z, aimPt.x - v.pos.x);

    // ── V3 THE PILOT BREAKS LOCK BUT KEEPS WORKING ────────────────────────
    // Robert: "when it fires, the AI pilot needs to try to EVADE while still
    // ATTACKING." Both halves matter — a pilot who only evades is a coward
    // the ground never fears, and one who only attacks is a free kill for
    // any launcher.
    //
    // The geometry is already decided by SAM_SPEED_RATIO: the missile is
    // ~8% slower, so a straight run opens the gap and a panic turn hands it
    // the corner. The RIGHT answer is neither — it's a shallow BEAM turn
    // (put the missile off your wingtip and keep your energy), plus flares.
    // So the pilot biases its heading ~50° off the threat instead of fleeing,
    // which keeps the target in the forward arc and the gun still working.
    if (flying) {
      let inbound: { x: number; z: number } | null = null;
      for (const p of w.projectiles.values()) {
        if (p.team === s.team) continue;
        if (p.homingVehicleId !== v.id && p.homingSoldierId !== s.id) continue;
        inbound = { x: p.pos.x, z: p.pos.z };
        break;
      }
      if (inbound) {
        const away = Math.atan2(v.pos.z - inbound.z, v.pos.x - inbound.x);
        // beam it: 50° off the pure-flee bearing, turning the way that costs
        // the least — the shallow break keeps speed, and speed is survival
        let off = away - v.yaw;
        while (off > Math.PI) off -= Math.PI * 2;
        while (off < -Math.PI) off += Math.PI * 2;
        wantYaw = away - Math.sign(off || 1) * 0.87;
        // and dump a flare if the airframe has one — the missile prefers heat
        if (v.flares > 0) cmd.grenade = true;
      }
    }

    let dy = wantYaw - v.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    cmd.moveX = Math.max(-1, Math.min(1, dy * 2));
    // look-ahead brake: what is the BOW about to eat? A wall 5.5u out at
    // speed means lift the throttle and finish the turn first — hulls stop
    // arriving at walls at full send.
    let bowBlocked = false;
    if (!flying) {
      const bx = v.pos.x + Math.cos(v.yaw) * 5.5, bz = v.pos.z + Math.sin(v.yaw) * 5.5;
      const bt = tileAt(w.map.grid, bx, bz, w.map.geometry);
      bowBlocked = !(bt === T_OPEN || bt === T_WATER);
    }
    cmd.moveZ = Math.abs(dy) < 1.1 ? (bowBlocked ? -0.3 : -1) : -0.2; // forward
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
  const acqRange = Math.max(TUNE.acqFloor, Math.min(WEAPONS[s.weapons[s.weaponIdx]].range * TUNE.acqWeaponFrac, TUNE.acqCap));
  // §8.8 the sky taxes the bot's eyes exactly as it taxes the player's — fog
  // pulls the view to a tight radius, heavy rain a lot less — with a 16u floor
  // so a bot still fights what's on top of it. A ping still carries out to the
  // full weapon reach (the AI leans on its instruments too).
  const sightRange = Math.max(TUNE.weatherFloor, acqRange * visionMult(w.weather));
  const target = findTarget(w, s, sightRange, acqRange);
  const radarGoal = target ? null : radarSearchPoint(w, s);
  const goal = radarGoal && w.mode.id === 'tdm' ? radarGoal : cachedObjective(w, s);
  const indoorDest = !target && s.team === 1
    ? indoorGuardWaypoint(w.indoorTactics, s.id, s.pos, s.floor, w.time)
    : null;
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

  // --- speed IS the plan: CTF runners, and every FRESH SPAWN with a long
  // walk back (Robert: "when they respawn… grab a vehicle if it's there").
  // On foot the crossing takes ~23s of exposure; on a bike it takes 7. The
  // ride is a pathfinding DESTINATION, never a straight-line walk (that once
  // pinned raiders against their own base wall, reaching for a pad vehicle
  // on the far side of it).
  let rideDest: Vec3 | null = null;
  const freshLife = w.time < (s.botFreshUntil ?? 0) && (s.botLifeSeed ?? 0) >= 0; // 2/3 of lives shop
  if (!target && dGoal > 30 && w.time >= (s.botUseAt ?? 0) &&
      ((w.mode.id === 'ctf' && (s.carryingFlag >= 0 || raidsFlags(s))) || freshLife)) {
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
    // was gated on !target — so a bot pinned on a corner WITH an enemy in sight
    // never re-planned (the audit's "stuck against a wall in view of a foe,
    // forever"). A genuine stall is near-zero motion; an active strafer clears
    // the 0.8u bar, so this fires on the real wall-kiss even mid-fight.
    if (s.botLastX !== undefined && moved < TUNE.stuckDist && dGoal > 6) {
      s.botGoal = null;
      s.botRepathAt = 0;
    }
    s.botLastX = s.pos.x;
    s.botLastZ = s.pos.z;
    s.botMoveCheckAt = w.time + TUNE.stuckWindow;
  }

  // --- movement: repath periodically toward objective (or flank target) ---
  const wantRepath = !s.botGoal || w.time >= (s.botRepathAt ?? 0) ||
    Math.hypot((s.botGoal?.x ?? 0) - s.pos.x, (s.botGoal?.z ?? 0) - s.pos.z) < 3;
  if (wantRepath) {
    s.botRepathAt = w.time + TUNE.repathBase + w.rng.next() * TUNE.repathJitter;
    // chasers hunt the target in tdm; anchors keep walking their objective;
    // a CTF runner with a ride in reach paths to the ride first
    let dest = rideDest ?? indoorDest ?? (target && w.mode.id === 'tdm' && DOCTRINE[s.classId].chase
      ? target.pos
      : goal);
    // PER-LIFE LANE BIAS (Robert: "try something different"): on the long
    // legs, this life leans left, right, or straight — the wave arrives as
    // prongs instead of a single-file rerun of the last death. The bias
    // aims a sideways-shifted mid-point and expires as the goal closes.
    if (dest === goal && dGoal > 45 && (s.botLifeSeed ?? 0) !== 0) {
      const ax = goal.x - s.pos.x, az = goal.z - s.pos.z;
      const al = Math.hypot(ax, az) || 1;
      const side = (s.botLifeSeed ?? 0) * 15;
      const capX = (v: number) => Math.max(-halfWidth(w.map.geometry) + 9, Math.min(halfWidth(w.map.geometry) - 9, v));
      const capZ = (v: number) => Math.max(-halfDepth(w.map.geometry) + 9, Math.min(halfDepth(w.map.geometry) - 9, v));
      dest = {
        x: capX(s.pos.x + ax * 0.55 - (az / al) * side),
        y: 0,
        z: capZ(s.pos.z + az * 0.55 + (ax / al) * side),
      };
    }
    // LADDER IQ — which storey is this route trying to reach? OBJECTIVES
    // carry it in the y-channel (a loft post rides at y=4). A chased body's
    // storey is its FLOOR FIELD, never its altitude — a jump trooper mid-arc
    // crosses y=4 constantly and is still a ground-floor man (reading pos.y
    // here once sent every chaser hunting a phantom loft). And a SEEN target
    // on another storey overrides everything — you cannot duel through a
    // concrete floor, so the route IS the play.
    let destFloor = 0;
    if (dest === indoorDest && indoorDest) destFloor = worldFloorForHeight(indoorDest.y);
    else if (dest === goal && goal.y >= 3.9) destFloor = worldFloorForHeight(goal.y);
    else if (target && dest === target.pos) destFloor = target.floor;
    if (target && target.floor !== s.floor) { dest = target.pos; destFloor = target.floor; }
    // SUB-TILE DESTINATIONS GO DIRECT (the pacing-sentry fix): pathStep is
    // tile-quantized, so a body straddling a tile boundary near its post got
    // a DIFFERENT first waypoint each repath — and the dist<3 clause above
    // repaths every tick, so the goal flip-flopped at 30Hz and the body
    // paced in place. Within a stride-and-a-bit of a visible destination
    // the straight line IS the route; the BFS keeps the job whenever a wall
    // (a room-duty post behind a door) still stands in the way. Ground
    // floor only — storeyed routes always take the layered walk.
    const dDest = Math.hypot(dest.x - s.pos.x, dest.z - s.pos.z);
    // TRUE-FLIGHT LSWs cross walls — they must NOT detour on the ground grid
    // around geometry they cruise 5u above (audit: the fliers 'walked'). Straight
    // to the destination; stepLsw owns the altitude. (Vehicles got this fix; the
    // LSW fliers didn't.)
    const fliesOverIt = s.ascendant !== undefined && LSWS[s.ascendant].flies;
    const wp = (fliesOverIt || (dDest < 4 && s.floor === 0 && destFloor === 0 && losClear(w.map.grid, s.pos, dest, 0.6, w.map.geometry)))
      ? { x: dest.x, y: 0, z: dest.z }
      : pathStep(w, s.pos, dest, s.classId === 'jump', false, s.floor, destFloor) ?? { x: dest.x, y: 0, z: dest.z };
    s.botGoal = wp;
    s.botWantFloor = destFloor !== s.floor ? destFloor : undefined;
  }

  let mvx = 0, mvz = 0;
  if (s.botGoal) {
    const dx = s.botGoal.x - s.pos.x;
    const dz = s.botGoal.z - s.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    // THE ARRIVAL RAMP (the vibrating-sentry fix, caught live by the flight
    // recorder: guards standing ON their orbit posts at ~80 direction flips
    // a second). Two dead ends taught the shape: full-speed steering at the
    // goal turns position noise into full-stride sign flips, and a hard
    // stop-band just moves the bang-bang to the band's edge. So the pull
    // fades CONTINUOUSLY through the last stride — full beyond 1.5u, zero
    // inside half a unit — and with applyCmd no longer scaling sub-unit
    // intent up to full speed, the pull and the separation shove find a
    // smooth equilibrium: posted bodies STAND. Mid-route waypoints re-aim
    // at 3u, so the ramp only ever shades a route's final approach.
    const arrive = Math.min(1, Math.max(0, dl - 0.5));
    mvx = (dx / dl) * arrive;
    mvz = (dz / dl) * arrive;
  }

  // LADDER IQ, the hands: en route to another storey, press E the moment the
  // boots reach the well the path aimed at. Want-clears-on-arrival IS the
  // ping-pong guard — the instant the floor flips, the pressing stops, the
  // stale route is dropped, and the next repath continues on the new storey.
  if (s.botWantFloor !== undefined) {
    if (s.botWantFloor === s.floor) {
      s.botWantFloor = undefined;
      s.botGoal = null;
      s.botRepathAt = 0;
    } else if (s.botGoal) {
      const dWell = Math.hypot(s.botGoal.x - s.pos.x, s.botGoal.z - s.pos.z);
      const wellHere = ladderWellAt(w.map, s.floor, s.botGoal.x, s.botGoal.z);
      if (dWell < 1.7 && wellHere) cmd.use = true;
    }
  }

  // --- no soldier in front of you? then SHOOT THE NEST ---
  // findTarget only ever returns Soldiers, so an enemy sentry was something
  // bots physically could not fight — they'd walk to it and stand there
  // being shot. A structure is a target too. `nestAim` guards the idle-aim
  // default below from clobbering this (it silently did whenever the feet
  // were moving — the separation shove made that every tick).
  let nestAim = false;
  if (!target && s.kind === 'bot') {
    const wdef = WEAPONS[s.weapons[s.weaponIdx]];
    const nest = enemyTurretNear(w, s.team, s.pos, wdef.range * 0.95);
    if (nest && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...nest.pos, y: 1.4 }, 1.4, w.map.geometry)) {
      cmd.aimYaw = Math.atan2(nest.pos.z - s.pos.z, nest.pos.x - s.pos.x);
      cmd.fire = true;
      nestAim = true;
      if (wdef.arc) cmd.aimDist = nest.d;
    }
  }

  // --- FOOT ANTI-VEHICLE (Robert / audit: a tank rolled through a squad of
  // missile-heavies untouched — findTarget only ever returns soldiers, so the
  // heavy's mml swap below was DEAD CODE). An AT class fights armor: aim the
  // launcher at the nearest crewed enemy vehicle in reach, hold at rocket range.
  let vehEngage = false;
  const atGun = WEAPONS[s.weapons[1]]; // the heavy's launcher sits in slot 1
  if (s.classId === 'heavy' && atGun && atGun.damage > 0) {
    const veh = enemyVehicleNear(w, s, atGun.range * 0.95);
    // engage when there's no soldier worth shooting, or the vehicle is close
    // enough to be the real threat — and there's a clear shot to it
    if (veh && (!target || veh.d < TUNE.atEngageRange) && w.sightClear(s.pos, veh.pos)) {
      vehEngage = true;
      cmd.weaponSlot = 1;
      cmd.aimYaw = Math.atan2(veh.pos.z - s.pos.z, veh.pos.x - s.pos.x);
      cmd.aimDist = veh.d;
      if (veh.d < atGun.range * 0.95) cmd.fire = true;
      if (veh.d < TUNE.atPeelBack) { // peel back from a tank that's on top of you
        mvx = s.pos.x - veh.pos.x; mvz = s.pos.z - veh.pos.z;
        const l = Math.hypot(mvx, mvz) || 1; mvx /= l; mvz /= l;
      }
    }
  }

  // --- combat: fight the way your class fights ---
  if (!vehEngage && target) {
    const d = Math.hypot(target.pos.x - s.pos.x, target.pos.z - s.pos.z);
    const wdef = WEAPONS[s.weapons[s.weaponIdx]];
    const meleeFighter = wdef.range <= 2.5 && !wdef.heals;
    const baseDoc = DOCTRINE[s.classId];
    // LSW MELEE DOCTRINE (bots-use-their-powers): an LSW rides the infantry
    // doctrine (standoff 17u), but its signature arm and step() abilities live
    // at ITS weapon's range — Titan's 12u fists, Ragebeast's 10u claws. Parked
    // at 17u they whiff everything. Fight at your own reach: close to ~0.65× the
    // weapon range (clamped ≥6u) and always chase in a duel. Ranged gods keep
    // their distance (a 46u lance clamps back to the infantry 17u).
    const doc = s.ascendant
      ? { ...baseDoc, standoff: Math.max(6, Math.min(baseDoc.standoff, wdef.range * 0.65)), chase: true }
      : baseDoc;

    // DRY FALLBACK (Robert's ammo pass): a primary with an empty clip AND no
    // reserve is dead weight — drop to the sidearm, which never runs out. Only
    // when slot 1 is a real offensive gun (infantry/infiltrator/ghost pistol,
    // heavy's mml, jump's gl); a medic's beam / engineer's kit aren't guns.
    const sec = WEAPONS[s.weapons[1]];
    const secIsGun = !!sec && !sec.heals && sec.damage > 0;
    const primaryDry = s.clip[0] <= 0 && s.reserve[0] <= 0;
    // pick sensible weapon slot
    if (primaryDry && secIsGun) cmd.weaponSlot = 1;
    else if (s.classId === 'heavy') cmd.weaponSlot = d > 25 || target.vehicleId >= 0 ? 1 : 0;
    else if (s.classId === 'medic') cmd.weaponSlot = 0;
    else if (s.classId === 'engineer') cmd.weaponSlot = 0;
    else if (s.classId === 'jump') cmd.weaponSlot = d > 24 ? 1 : 0; // shell them while closing, SMG inside

    // paintball mercy (Robert: "too hard"): the yard is where new players
    // live, so bot paint wobbles — wide enough to dodge, tight enough to
    // punish standing still. Everywhere else the math stays honest.
    const merciful = w.mode.id === 'paintball' ? 2.2 : 1;
    const aimErr = (w.rng.next() - 0.5) * (s.kind === 'zombie' ? 0.2 : TUNE.aimErrBase) * (d / TUNE.aimErrFalloff + 0.6)
      * DIFFICULTY[w.opts.difficulty ?? 'veteran'].aim * doc.aim * merciful / w.director.pressure;
    cmd.aimYaw = leadYaw(s.pos, target, wdef.speed) + aimErr;
    // REACTION DELAY: a FRESHLY-acquired target gets a human beat before the
    // trigger — no more corner-peek headshot the same tick you appear. Only a
    // NEW contact re-arms it; a target it's been tracking fires freely.
    if (s.botAcqId !== target.id) { s.botAcqId = target.id; s.botAcquireAt = w.time + DIFFICULTY[w.opts.difficulty ?? 'veteran'].react / w.director.pressure; }
    // LSWs are gods, not corner-peeking soldiers — no reaction beat on them
    // (keeps every boss, incl. the off-limits GravWarden, byte-identical).
    const reacted = s.ascendant !== undefined || w.time >= (s.botAcquireAt ?? 0);
    if (reacted && d < (meleeFighter ? wdef.range + 0.35 : wdef.range * TUNE.fireFrac)) cmd.fire = true;
    if (wdef.arc) cmd.aimDist = d; // lob shells ON the target, not past it

    const toT = Math.atan2(target.pos.z - s.pos.z, target.pos.x - s.pos.x);
    // committed runners: the flag carrier, and CTF raiders on approach. One
    // job: run. Fire over the shoulder, don't stop to duel — dead runners
    // score nothing. (They still fight anyone inside 12u blocking the lane.)
    const committed = s.carryingFlag >= 0 ||
      (w.mode.id === 'ctf' && raidsFlags(s) && d > 12);
    // LAST STAND (delight): a SQUAD down to its last member doesn't run — the
    // 1vX clutch. NOT a lone-wolf 1v1 (a mauled duelist still breaks contact) —
    // so it only fires when the team HAD more than one and is down to this one.
    // Only scan the roster when it matters (already low on HP).
    const lowHp = s.hp < s.maxHp * doc.retreat;
    let isLastOfSquad = false;
    if (lowHp) {
      let total = 0, alive = 0;
      for (const o of w.soldiers.values()) {
        if (o.team !== s.team || (o.kind !== 'human' && o.kind !== 'bot')) continue;
        total++; if (o.alive) alive++;
      }
      isLastOfSquad = total > 1 && alive <= 1;
    }
    if (isLastOfSquad && !s.lastStandSaid) {
      s.lastStandSaid = true;
      w.emit({ type: 'announce', text: `${s.name} — LAST STAND`, big: true });
    }
    if (target.floor !== s.floor) {
      // cross-storey contact: no band dance through a concrete floor — the
      // movement keeps walking the layered route (botGoal already aims at
      // the well), and the gun stays warm for the reunion
    } else if (meleeFighter) {
      // Fists and hand weapons own the same brain as guns: react, route through
      // real doors/stairs, close decisively, then let the shared swing arc land.
      if (!s.botGoal || w.time >= (s.botRepathAt ?? 0)) {
        s.botRepathAt = w.time + 0.35;
        const clear = losClear(w.map.grid, s.pos, target.pos, 0.6, w.map.geometry);
        s.botGoal = clear ? { ...target.pos }
          : (pathStep(w, s.pos, target.pos, false, false, s.floor, target.floor) ?? { ...target.pos });
      }
      const goal = s.botGoal ?? target.pos;
      const dx = goal.x - s.pos.x, dz = goal.z - s.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      if (d > wdef.range * 0.72) { mvx = dx / dl; mvz = dz / dl; }
      else { mvx = 0; mvz = 0; }
    } else if (committed) {
      // keep the objective movement computed above
    } else if (lowHp && !isLastOfSquad) { // the last of a squad skips retreat and fights
      // capability, not courage: break contact — toward COVER if there's a wall
      // to put between you and the shooter, else toward home. Guns still up.
      // (The line between a human and a zed — zeds never step back.) nearestCover
      // already existed but was only ever used by the downed-crawl.
      const cover = nearestCover(w, s.pos, TUNE.coverSeek, s.team);
      mvx = -Math.cos(toT);
      mvz = -Math.sin(toT);
      if (cover) {
        const dx = cover.x - s.pos.x, dz = cover.z - s.pos.z, dl = Math.hypot(dx, dz) || 1;
        mvx += (dx / dl) * 1.3; mvz += (dz / dl) * 1.3; // peel to the cover tile
      } else {
        const base = w.map.basePos[s.team];
        mvx += (base.x - s.pos.x) * 0.015; mvz += (base.z - s.pos.z) * 0.015;
      }
      if (cls.ability === 'jetpack' && s.energy > 40) cmd.jump = true; // burn out of there
    } else if (d > doc.standoff * 1.3) {
      if (doc.chase && w.mode.id === 'tdm') {
        // TDM: fully close with a flanker's curve — straight lines are brief
        const side = (s.id % 2 ? 1 : -1) * doc.flank;
        mvx = Math.cos(toT) + Math.cos(toT + Math.PI / 2) * side;
        mvz = Math.sin(toT) + Math.sin(toT + Math.PI / 2) * side;
      } else if (doc.flank > 0) {
        // objective modes: keep walking the objective (chasing kills across the
        // map is how both teams forget the flags), but CURL the approach so a
        // skirmisher arcs toward the fight instead of marching a straight line —
        // the per-class flank finally shows outside TDM, without ditching the flag
        const side = (s.id % 2 ? 1 : -1) * doc.flank * 0.6;
        mvx += Math.cos(toT + Math.PI / 2) * side;
        mvz += Math.sin(toT + Math.PI / 2) * side;
      }
    } else if (d < doc.standoff * 0.55) {
      // inside the class's comfort band — give ground, guns up.
      // (unit vector: applyCmd no longer scales sub-unit intent up to full
      // stride, and a fighting withdrawal is a full-stride move)
      mvx = -Math.cos(toT);
      mvz = -Math.sin(toT);
    } else {
      // in the band: strafe-dance, a toe still pointed at the objective —
      // re-normalized to a full stride (doc.strafe shapes the MIX of dodge
      // vs advance, not the pace; the dance was always meant at full speed)
      if (w.rng.next() < 0.02) s.botStrafeDir = (s.botStrafeDir ?? 1) * -1;
      const perp = toT + Math.PI / 2;
      mvx = Math.cos(perp) * (s.botStrafeDir ?? 1) * doc.strafe + mvx * 0.25;
      mvz = Math.sin(perp) * (s.botStrafeDir ?? 1) * doc.strafe + mvz * 0.25;
      const sl = Math.hypot(mvx, mvz);
      if (sl > 0.001) { mvx /= sl; mvz /= sl; }
    }

    // out of ammo with a live enemy → BREAK TO COVER and reload, don't eat the
    // reload standing in the open (audit: a heavy emptied its 75-round LMG then
    // stood exposed 3.2s). Reload is otherwise idle-only.
    if (s.clip[s.weaponIdx] <= 0 && s.reserve[s.weaponIdx] > 0) {
      cmd.reload = true;
      const cover = nearestCover(w, s.pos, 20, s.team);
      if (cover) { const dx = cover.x - s.pos.x, dz = cover.z - s.pos.z, dl = Math.hypot(dx, dz) || 1; mvx = dx / dl; mvz = dz / dl; }
    }

    // grenades at clusters — cursor-targeted like players: land it ON the enemy
    if (d > TUNE.nadeMin && d < TUNE.nadeMax && s.grenades > 0 && w.rng.next() < TUNE.nadeChance) {
      // NB: the rng.next() above is drawn unconditionally — the class gate is on
      // the EFFECT, not the draw, so the seeded stream stays byte-identical.
      // Engineers' G plants a MINE at their feet (world.ts routing), so a
      // mid-strafe "frag" dribbles the mine budget onto open ground — let them
      // keep it for the idle choke-planting instead.
      if (s.classId !== 'engineer') { cmd.grenade = true; cmd.aimDist = d; }
    }

    // jump troopers hop in fights
    if (cls.ability === 'jetpack' && s.energy > 40 && w.rng.next() < 0.02) cmd.jump = true;
  } else if (!vehEngage) { // vehEngage already set aim + fire; don't clobber it
    if (!nestAim) cmd.aimYaw = Math.atan2(mvz, mvx) || s.yaw;
    // reload when idle — but never mid nest-demolition
    const wdef = WEAPONS[s.weapons[s.weaponIdx]];
    if (!nestAim && s.clip[s.weaponIdx] < wdef.clip * 0.4 && s.reserve[s.weaponIdx] > 0) cmd.reload = true;
  }

  // --- class abilities ---
  if (s.classId === 'engineer' && !target && s.energy >= 80 && dGoal < 20 && w.rng.next() < 0.01) cmd.ability = true;
  if (s.classId === 'medic') {
    // Decision 49A — nobody bleeds out alone. A downed ally outranks the
    // merely wounded, and outranks the medic's own firefight: path to the
    // body and put the beam on it (one touch of medibeam is a revive).
    let wounded: Soldier | null = null;
    let fallen: Soldier | null = null;
    let fallenD = 34;
    for (const a of w.soldiers.values()) {
      if (!a.alive || a.team !== s.team || a.id === s.id) continue;
      if (a.kind !== 'human' && a.kind !== 'bot') continue;
      const d = Math.hypot(a.pos.x - s.pos.x, a.pos.z - s.pos.z);
      if (a.downed) {
        if (d < fallenD) { fallen = a; fallenD = d; }
      } else if (!wounded && a.hp <= a.maxHp * 0.75 && d < 13) {
        wounded = a;
      }
    }
    const patient = fallen ?? wounded;
    if (patient) {
      cmd.weaponSlot = 1;
      const d = Math.hypot(patient.pos.x - s.pos.x, patient.pos.z - s.pos.z);
      cmd.aimYaw = Math.atan2(patient.pos.z - s.pos.z, patient.pos.x - s.pos.x);
      if (d < 12 && losClear(w.map.grid, { ...s.pos, y: 1.4 }, { ...patient.pos, y: 1.4 }, 1.4, w.map.geometry)) {
        cmd.fire = true;
        mvx = (patient.pos.x - s.pos.x) / 10;
        mvz = (patient.pos.z - s.pos.z) / 10;
      } else {
        // long haul to a man down: pathfind, don't walk into the wall between
        if (!s.botGoal || w.time >= (s.botRepathAt ?? 0) ||
            Math.hypot(s.botGoal.x - s.pos.x, s.botGoal.z - s.pos.z) < 2) {
          s.botRepathAt = w.time + 0.8;
          s.botGoal = pathStep(w, s.pos, patient.pos) ?? { ...patient.pos };
        }
        const dx = s.botGoal.x - s.pos.x, dz = s.botGoal.z - s.pos.z;
        const dl = Math.hypot(dx, dz) || 1;
        mvx = dx / dl;
        mvz = dz / dl;
      }
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
      const door = tileToWorld(w.map.geometry, idx % w.map.geometry.cols, (idx / w.map.geometry.cols) | 0);
      cmd.aimYaw = Math.atan2(
        door.z - s.pos.z,
        door.x - s.pos.x,
      );
      cmd.use = true;
      s.botUseAt = w.time + 0.8;
    }
  }

  // climb IQ (§8.7): a CLIMB barricade on the walking line isn't a wall to a
  // jump trooper — it's a ramp with attitude. See it coming, light the jet,
  // and keep burning until the boots are past the lip (the pathfinder only
  // routes THROUGH barricades for this class, so the cue always comes).
  if (s.classId === 'jump' && (mvx !== 0 || mvz !== 0)) {
    if (climbAhead(w, s.pos, Math.atan2(mvz, mvx)) ||
        (s.pos.y > 0.2 && tileAt(w.map.grid, s.pos.x, s.pos.z, w.map.geometry) === T_CLIMB)) {
      cmd.jump = true;
    }
  }

  // SPACING (Robert: "they keep bunching up together") — every friendly
  // inside 3u pushes this bot away, harder the closer they stand. One
  // grenade should never delete a fireteam that walked in a knot; the
  // separation rides ON TOP of the goal so bots still arrive — spread out.
  let sepX = 0, sepZ = 0;
  const SEP_R = TUNE.sepRadius; // personal space (widened from 3u so a converging crowd spreads)
  let nearest = Infinity, nearX = 0, nearZ = 0;
  // opt #38 (S2): same-team neighbors inside SEP_R only — was a full
  // humansAndBots() allocation + roster walk per bot per tick. The id-sorted
  // query keeps the float-sum order (and therefore the shove) byte-identical.
  for (const o of w.soldierIndex.near(s.team, s.pos.x, s.pos.z, SEP_R, SEP_SCRATCH)) {
    if (o.kind !== 'human' && o.kind !== 'bot') continue;
    if (o.id === s.id || !o.alive) continue;
    if (o.floor !== s.floor) continue; // a storey apart is not a crowd
    const dx = s.pos.x - o.pos.x, dz = s.pos.z - o.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > SEP_R) continue;
    if (d < 0.001) {
      // PERFECTLY stacked (same-tick respawns once landed here): a
      // deterministic per-id shove breaks the tie — everyone leaves the pile
      // in their own direction.
      const a = s.id * 2.399;
      sepX += Math.cos(a); sepZ += Math.sin(a);
      nearest = 0;
      continue;
    }
    // a firmer-than-linear curve: the last metre shoves hardest, so bodies
    // never settle stacked even when the crowd's outer pushes cancel
    const push = ((SEP_R - d) / SEP_R) ** 1.5;
    sepX += (dx / d) * push;
    sepZ += (dz / d) * push;
    if (d < nearest) { nearest = d; nearX = dx / d; nearZ = dz / d; }
  }
  mvx += sepX * 1.2;
  mvz += sepZ * 1.2;
  // PERSONAL SPACE that WINS: inside ~2u the sum can still cancel in the
  // middle of a knot, so a body this close to its NEAREST neighbour gets a
  // hard directional shove that overrides the goal — nobody stays stacked.
  if (nearest < 2 && nearest > 0.001) {
    const dom = (2 - nearest) / 2; // 0 at 2u, 1 touching
    mvx = mvx * (1 - dom) + nearX * dom * 1.5;
    mvz = mvz * (1 - dom) + nearZ * dom * 1.5;
  } else if (nearest === 0) {
    mvx = Math.cos(s.id * 2.399); mvz = Math.sin(s.id * 2.399);
  }

  cmd.moveX = Math.max(-1, Math.min(1, mvx));
  cmd.moveZ = Math.max(-1, Math.min(1, mvz));

  // TURN-TO-AIM: a bot can't teleport its barrel. Cap the per-tick yaw change
  // so a flick onto a target COSTS TIME — the inhuman corner-snap headshot the
  // audit flagged (world.ts applies s.yaw = cmd.aimYaw with no cap; humans feed
  // it from the mouse, which is fine, but a bot's snap was a teleport). Paired
  // with the reaction delay, the gun turns onto you and settles before it fires.
  // LSWs exempt — a god's aim doesn't lag, and it keeps every boss (incl. the
  // off-limits GravWarden) byte-identical to before.
  if (!s.ascendant) {
    const maxTurn = DIFFICULTY[w.opts.difficulty ?? 'veteran'].turn * dt;
    let diff = cmd.aimYaw - s.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > maxTurn) diff = maxTurn;
    else if (diff < -maxTurn) diff = -maxTurn;
    cmd.aimYaw = s.yaw + diff;
  }

  // LSW intent (§21.6): an ability nobody uses doesn't exist, so the brain
  // ASKS for it here and stepLsw cashes it. Firebrand watches for enough
  // enemies standing on his painted floor, then calls the detonation by
  // pushing nextGrenadeAt far into the future (stepLsw's agreed signal).
  if (s.ascendant === 'firebrand' && target) {
    let onBoard = 0;
    for (const g of w.gadgets.values()) {
      if (g.type !== 'fire_field' || g.ownerId !== s.id) continue;
      for (const e of w.soldiers.values()) {
        if (e.alive && e.team !== s.team && Math.hypot(e.pos.x - g.pos.x, e.pos.z - g.pos.z) < 4) { onBoard++; break; }
      }
    }
    if (onBoard >= 2 && s.grenades > 0) s.nextGrenadeAt = w.time + 120; // the signal stepLsw reads to cash the board
  }

  return cmd;
}

function leadYaw(from: Vec3, target: Soldier, projSpeed: number): number {
  const d = Math.hypot(target.pos.x - from.x, target.pos.z - from.z);
  const t = d / Math.max(projSpeed, 1);
  const px = target.pos.x + target.vel.x * t * TUNE.lead;
  const pz = target.pos.z + target.vel.z * t * TUNE.lead;
  return Math.atan2(pz - from.z, px - from.x);
}

// ---------- the scientist ----------

export function stepScientist(w: World, s: Soldier, dt: number) {
  const leaderId = s.botTargetId ?? -1;
  const leader = leaderId >= 0 ? w.soldiers.get(leaderId) : undefined;
  if (leader && leader.alive && leader.vehicleId < 0) {
    const d = Math.hypot(leader.pos.x - s.pos.x, leader.pos.z - s.pos.z);
    if (d > 2.2) {
      const step = losClear(w.map.grid, s.pos, leader.pos, 0.6, w.map.geometry)
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
    const shelter = indoorCivilianWaypoint(w.indoorTactics, s.id, s.pos, s.floor, w.time);
    if (shelter) {
      const shelterFloor = worldFloorForHeight(shelter.y);
      const step = pathStep(w, s.pos, shelter, false, false, s.floor, shelterFloor, false) ?? shelter;
      const dx = step.x - s.pos.x, dz = step.z - s.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      s.vel.x = (dx / dl) * 7.5;
      s.vel.z = (dz / dl) * 7.5;
      s.yaw = Math.atan2(dz, dx);
    } else {
      s.vel.x = 0;
      s.vel.z = 0;
    }
    // nervous glance around while hiding
    s.yaw += Math.sin(w.time * 0.7 + s.id) * 0.01;
  }
  w.stepSoldierPhysics(s, dt);
}

// ---------- military working dogs (§5.3) ----------

function nearestK9Threat(w: World, dog: Soldier, range: number): { target: Soldier; distance: number } | null {
  let selected: Soldier | null = null;
  let best = range;
  for (const candidate of w.soldiers.values()) {
    if (!candidate.alive || candidate.downed || candidate.team === dog.team
        || (candidate.kind !== 'human' && candidate.kind !== 'bot')) continue;
    if ((candidate.floor ?? 0) !== (dog.floor ?? 0)) continue;
    const distance = Math.hypot(candidate.pos.x - dog.pos.x, candidate.pos.z - dog.pos.z);
    if (distance < best) { selected = candidate; best = distance; }
  }
  return selected ? { target: selected, distance: best } : null;
}

function dogWaitsAtDoor(w: World, dog: Soldier): boolean {
  const packed = closedDoorAhead(w.map, dog);
  if (packed < 0) {
    dog.k9Door = undefined;
    return false;
  }
  const arrived = dog.k9Door !== packed;
  dog.k9Door = packed;
  dog.vel.x = 0;
  dog.vel.z = 0;
  if (arrived || w.time >= (dog.k9NextBarkAt ?? 0)) {
    dog.k9NextBarkAt = w.time + 5;
    dog.loudUntil = w.time + 1.5;
    w.emit({
      type: 'announce',
      pos: { ...dog.pos },
      soldierId: dog.id,
      text: `${dog.name} · WAITING AT DOOR`,
      big: false,
    });
  }
  return true;
}

function driveK9Toward(w: World, dog: Soldier, target: Vec3, targetFloor: number): boolean {
  if (w.time >= (dog.botRepathAt ?? 0)
      || (dog.botGoal != null
        && Math.hypot(dog.botGoal.x - dog.pos.x, dog.botGoal.z - dog.pos.z) < 0.8)) {
    const clear = dog.floor === 0 && targetFloor === 0
      && losClear(w.map.grid, dog.pos, target, 0.6, w.map.geometry);
    dog.botGoal = clear
      ? { ...target }
      : (pathStep(w, dog.pos, target, false, false, dog.floor, targetFloor, false) ?? undefined);
    dog.botRepathAt = w.time + (dog.botGoal ? 0.4 : 1.2);
  }
  if (!dog.botGoal) {
    dog.vel.x = 0;
    dog.vel.z = 0;
    return false;
  }
  const dx = dog.botGoal.x - dog.pos.x;
  const dz = dog.botGoal.z - dog.pos.z;
  const distance = Math.hypot(dx, dz) || 1;
  dog.yaw = Math.atan2(dz, dx);
  if (dogWaitsAtDoor(w, dog)) return false;
  dog.vel.x = (dx / distance) * DOG_STATS.speed;
  dog.vel.z = (dz / distance) * DOG_STATS.speed;
  return true;
}

function stepK9Stay(w: World, dog: Soldier, dt: number) {
  const anchor = dog.k9StayAnchor ?? (dog.k9StayAnchor = { ...dog.pos });
  const immediate = nearestK9Threat(w, dog, WEAPONS.dog_bite.range + 0.5);
  if (immediate && w.time >= dog.nextFireAt) {
    dog.yaw = Math.atan2(immediate.target.pos.z - dog.pos.z, immediate.target.pos.x - dog.pos.x);
    w.startMelee(dog, WEAPONS.dog_bite);
  }
  const dx = anchor.x - dog.pos.x;
  const dz = anchor.z - dog.pos.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 0.18) {
    const correction = Math.min(DOG_STATS.speed, distance / Math.max(dt, 1 / 60));
    dog.vel.x = (dx / distance) * correction;
    dog.vel.z = (dz / distance) * correction;
  } else {
    dog.vel.x = 0;
    dog.vel.z = 0;
  }
  dog.k9Door = undefined;
  w.stepSoldierPhysics(dog, dt);
}

function stepK9Sic(w: World, dog: Soldier, dt: number) {
  const threats = hostilesInK9Building(w.map, dog, w.soldiers.values());
  threats.sort((a, b) => {
    const score = (target: Soldier) => Math.abs(target.floor - dog.floor) * 20
      + Math.hypot(target.pos.x - dog.pos.x, target.pos.z - dog.pos.z);
    return score(a) - score(b) || a.id - b.id;
  });
  const target = threats[0];
  if (target) {
    dog.k9TargetId = target.id;
    dog.k9ClearSince = undefined;
    const distance = Math.hypot(target.pos.x - dog.pos.x, target.pos.z - dog.pos.z);
    driveK9Toward(w, dog, target.pos, target.floor);
    if (target.floor === dog.floor && distance < WEAPONS.dog_bite.range + 0.5
        && w.time >= dog.nextFireAt) {
      dog.yaw = Math.atan2(target.pos.z - dog.pos.z, target.pos.x - dog.pos.x);
      w.startMelee(dog, WEAPONS.dog_bite);
    }
    w.stepSoldierPhysics(dog, dt);
    return;
  }

  // A dog that already found the occupant confirms the now-quiet building;
  // an empty building gets a deterministic room/door sweep before the call.
  const hadTarget = dog.k9TargetId !== undefined;
  dog.k9TargetId = undefined;
  if (!hadTarget && dog.k9ClearSince === undefined) {
    const waypoints = k9SearchWaypoints(w, dog);
    const index = dog.k9SearchIndex ?? 0;
    const waypoint = waypoints[index];
    if (waypoint) {
      const targetFloor = Math.max(0, Math.round(waypoint.y / 4));
      const distance = Math.hypot(waypoint.x - dog.pos.x, waypoint.z - dog.pos.z);
      if (dog.floor === targetFloor && distance < 1.2) {
        dog.k9SearchIndex = index + 1;
        dog.botGoal = undefined;
      } else {
        driveK9Toward(w, dog, waypoint, targetFloor);
      }
      dog.k9ClearSince = undefined;
      w.stepSoldierPhysics(dog, dt);
      return;
    }
  }

  if (!dogInsideAssignedBuilding(w.map, dog)) {
    const house = dog.k9BuildingId === undefined ? undefined : w.map.houses[dog.k9BuildingId];
    if (house) driveK9Toward(w, dog, house.center, 0);
    w.stepSoldierPhysics(dog, dt);
    return;
  }
  dog.vel.x = 0;
  dog.vel.z = 0;
  dog.k9Door = undefined;
  dog.k9ClearSince ??= w.time;
  if (w.time - dog.k9ClearSince >= 2) {
    w.emit({ type: 'announce', pos: { ...dog.pos }, soldierId: dog.id, text: `${dog.name} · BUILDING CLEAR`, big: false });
    setK9Heel(dog);
  }
  w.stepSoldierPhysics(dog, dt);
}

/**
 * The K9 brain. A dog is a handler pairing: heel when it's quiet, take down
 * whatever presses the handler, and above all — THE NOSE. Cloak fools optics;
 * it does not fool a dog. That nose is the whole reason the kennel earned a
 * slot in this war: with a K9 on the field, stealth has to sweat.
 */
export function stepDog(w: World, s: Soldier, dt: number) {
  const handler = w.soldiers.get(s.ownerId);

  // THE NOSE: everyone hostile inside the radius gets marked for the team,
  // camouflaged or not — same channel the spy cameras feed (world.pinged).
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team) continue;
    if (Math.hypot(
      e.pos.x - s.pos.x,
      e.pos.z - s.pos.z,
      ((e.floor ?? 0) - (s.floor ?? 0)) * 4,
    ) < DOG_STATS.noseRadius) w.pinged.add(e.id);
  }

  // handler down: hold right here until they're back — good dogs don't wander
  if (!handler || !handler.alive) {
    if (s.k9Order && s.k9Order !== 'heel') setK9Heel(s);
    s.vel.x = 0;
    s.vel.z = 0;
    s.yaw += Math.sin(w.time * 1.3 + s.id) * 0.02; // ears up, scanning
    w.stepSoldierPhysics(s, dt);
    return;
  }

  if (s.k9Order === 'stay') {
    stepK9Stay(w, s, dt);
    return;
  }
  if (s.k9Order === 'sic') {
    stepK9Sic(w, s, dt);
    return;
  }

  // threat check: anything hostile pressing the handler inside the guard radius.
  // Beyond the nose a cloaked infiltrator still needs a scent (a live ping).
  let target: Soldier | null = null;
  let bestD = Infinity;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.vehicleId >= 0 || e.kind === 'scientist') continue;
    if (Math.hypot(e.pos.x - handler.pos.x, e.pos.z - handler.pos.z) > DOG_STATS.guardRadius) continue;
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    if (e.cloaked && d > DOG_STATS.noseRadius && !w.pinged.has(e.id)) continue;
    if (d < bestD) { target = e; bestD = d; }
  }

  const wdef = WEAPONS[s.weapons[0]];
  if (target) {
    // chase & takedown — the horde's pathing, so walls don't save anyone
    if (!s.botGoal || w.time >= (s.botRepathAt ?? 0)) {
      s.botRepathAt = w.time + 0.5;
      const clear = s.floor === target.floor && losClear(w.map.grid, s.pos, target.pos, 0.6, w.map.geometry);
      s.botGoal = clear ? { ...target.pos }
        : (pathStep(w, s.pos, target.pos, false, false, s.floor, target.floor, false) ?? { ...target.pos });
    }
    const dx = s.botGoal.x - s.pos.x, dz = s.botGoal.z - s.pos.z;
    const dl = Math.hypot(dx, dz) || 1;
    s.yaw = Math.atan2(target.pos.z - s.pos.z, target.pos.x - s.pos.x);
    s.vel.x = (dx / dl) * DOG_STATS.speed;
    s.vel.z = (dz / dl) * DOG_STATS.speed;
    if (bestD < wdef.range + 0.5 && w.time >= s.nextFireAt) {
      // the bite is a swing too — a quick one (0.2s), but dodgeable
      w.startMelee(s, wdef);
    }
  } else {
    const scent = strongestDogScent(w.indoorTactics, handler.pos, handler.floor, w.time);
    if (scent) {
      if (!s.botGoal || w.time >= (s.botRepathAt ?? 0)) {
        s.botRepathAt = w.time + 0.45;
        s.botGoal = pathStep(w, s.pos, scent.pos, false, false, s.floor, scent.floor, false) ?? { ...scent.pos };
      }
      const dx = s.botGoal.x - s.pos.x, dz = s.botGoal.z - s.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      const speed = DOG_STATS.speed * (dogWindowHesitation(w.map, s.pos, s.botGoal, s.floor) ? 0.35 : 1);
      s.yaw = Math.atan2(dz, dx);
      s.vel.x = (dx / dl) * speed;
      s.vel.z = (dz / dl) * speed;
      w.pinged.add(scent.targetId);
      const nextBark = w.indoorTactics?.nextBarkAt.get(s.id) ?? 0;
      if (w.indoorTactics && w.time >= nextBark) {
        w.indoorTactics.nextBarkAt.set(s.id, w.time + 5);
        s.loudUntil = w.time + 1.5;
        w.emit({ type: 'announce', text: `${s.name} HAS THE SCENT`, big: false });
      }
      w.stepSoldierPhysics(s, dt);
      return;
    }
    // all quiet (or the kill is done): return to heel off the handler's shoulder
    const dH = Math.hypot(handler.pos.x - s.pos.x, handler.pos.z - s.pos.z);
    if (dH > DOG_STATS.heelDist) {
      if (!s.botGoal || w.time >= (s.botRepathAt ?? 0) ||
          Math.hypot(s.botGoal.x - s.pos.x, s.botGoal.z - s.pos.z) < 1.5) {
        s.botRepathAt = w.time + 0.6;
        const clear = s.floor === handler.floor && losClear(w.map.grid, s.pos, handler.pos, 0.6, w.map.geometry);
        s.botGoal = clear ? { ...handler.pos }
          : (pathStep(w, s.pos, handler.pos, false, false, s.floor, handler.floor, false) ?? { ...handler.pos });
      }
      const dx = s.botGoal.x - s.pos.x, dz = s.botGoal.z - s.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      const trot = dH > 10 ? DOG_STATS.speed : DOG_STATS.speed * 0.7; // close the gap, then fall in
      s.yaw = Math.atan2(dz, dx);
      s.vel.x = (dx / dl) * trot;
      s.vel.z = (dz / dl) * trot;
    } else {
      s.vel.x = 0;
      s.vel.z = 0;
      s.yaw = handler.yaw; // at heel, watching the handler's arc
    }
  }
  w.stepSoldierPhysics(s, dt);
}

