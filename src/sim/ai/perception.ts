// ---------------------------------------------------------------------------
// THE EYES — target acquisition & the bot's perception of the field.
//
// Extracted from bots.ts (see docs/AI-ARCHITECTURE.md). findTarget is the bot's
// own sight model (grass clamp, cone/ring, cloak, ping, LOS, nemesis bias) —
// the AI-AUDIT's Theme 1 ("bots are omniscient") lives entirely here, so this
// is the file to open to give bots human eyes. Leaf: map + tuning + types only.
// ---------------------------------------------------------------------------
import { T_GRASS, losClear, tileAt } from '../map';
import { BOT_TUNING as TUNE, DIFFICULTY } from '../bot-tuning';
import type { Soldier, Team, Vec3 } from '../types';
import { type World } from '../world';

// ---------- target selection ----------

// `maxRange` = the weather-taxed eye (fog/rain pull it in, §8.8). `pingRange` =
// how far a MARKED enemy carries: a ping is electronic intel, so it reaches
// past what the eye can see through the murk (Robert: "rely on your
// instrumentation") and pierces cloak. Both still need a clear shot.
export function findTarget(w: World, s: Soldier, maxRange: number, pingRange = maxRange): Soldier | null {
  // NIGHTMARE'S BLIND: no eyes, no targets — the ears (sound smudges) are
  // all the client leaves you, exactly as §19.2 trained
  if (s.blindUntil !== undefined && w.time < s.blindUntil) return null;
  let best: Soldier | null = null;
  let bestD = Infinity;
  // opt #38 (S2): only ENEMY bodies within the acquire reach can pass the
  // gates below. forEach, not near — a 66u acquire against a dense horde
  // collects hundreds, and sorting them per bot per tick is dearer than the
  // scan this replaces. The explicit lowest-id tie-break at the bottom keeps
  // the old ascending-scan winner under the grid's own visit order.
  w.soldierIndex.forEach((1 - s.team) as Team, s.pos.x, s.pos.z, Math.max(maxRange, pingRange), (e) => {
    if (!e.alive || e.vehicleId >= 0) return;
    if (w.mode.id === 'science' && e.kind === 'scientist') return;
    if (w.mode.id === 'science' && w.time < (e.scienceConcealedUntil ?? 0)) return;
    // LAST tick's marks, not this tick's: the recon pass that fills `pinged`
    // (beacons, drones, cameras, psi scans) runs AFTER the bot brains, so
    // reading it live always saw an empty set and every ping-aware branch below
    // was dead. One tick stale is 16ms and stays deterministic.
    const pinged = w.pingedLast.has(e.id);
    const d = Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z);
    // GRASS conceals from bots too (perception parity): an enemy in the tall
    // grass is a rumor past ~14u — or the footstep ring if they DUCK — unless a
    // ping reveals them. The same clamp the player's own eyes use (perception.ts),
    // so crouching in cover to break contact finally works against the AI.
    let reach = pinged ? pingRange : maxRange;
    if (!pinged && e.ascendant === undefined && tileAt(w.map.grid, e.pos.x, e.pos.z, w.map.geometry) === T_GRASS) {
      reach = Math.min(reach, e.crouching ? TUNE.grassCrouched : TUNE.grassRumor);
    }
    if (d >= reach) return; // past the eye AND unmarked
    // THE FACING CONE (the last piece of perception parity): a bot's eyes point
    // where its gun points. Past the footstep RING it only sees inside the same
    // ~130° cone the player's own eyes use (perception.ts CONE_HALF) — bots used
    // to have eyes in the back of their heads, so FLANKING did nothing. A ping is
    // electronic and ignores facing; an LSW is a god and keeps its 360°.
    if (!pinged && !s.ascendant && d > TUNE.ringClose) {
      let off = Math.abs(Math.atan2(e.pos.z - s.pos.z, e.pos.x - s.pos.x) - s.yaw) % (Math.PI * 2);
      if (off > Math.PI) off = Math.PI * 2 - off;
      if (off > TUNE.coneHalf) return; // behind him — walk on by
    }
    if (e.cloaked && d > TUNE.cloakReveal && !pinged) return; // cloak is TRUE unless a mark reveals it
    // sightClear = walls AND smoke — a bot must not track through the cloud
    // a player just paid a grenade to stand up (Robert: smoke AFFECTS
    // visibility, for every pair of eyes on the field). EXCEPT: an LSW is
    // TOO BIG FOR SMOKE — the silhouette looms through its own fog (measured:
    // Plaguebearer and Eclipse were immortal while their clouds blinded the
    // answering squad). Walls still hide it.
    // an LSW is TOO BIG FOR SMOKE both ways — it looms through fog as a target,
    // and as a VIEWER it isn't blinded by its own cloud (fixes a bot Eclipse
    // wandering her own dome with her rifle silent). Walls still hide, always.
    const seen = (s.ascendant !== undefined || e.ascendant !== undefined)
      ? losClear(w.map.grid, { x: s.pos.x, y: 1.4, z: s.pos.z }, { x: e.pos.x, y: 1.4, z: e.pos.z }, 1.4, w.map.geometry)
      : w.sightClear(s.pos, e.pos);
    if (!seen) return;
    // NEMESIS (delight): a grudge weights the pick toward the enemy who last
    // killed you — you HUNT the bot that's been hunting you. A bias, not an
    // override: a much-closer threat still wins, so it never tunnel-visions.
    const score = d * (e.id === s.lastKillerId ? 0.6 : 1);
    // strict < plus lowest-id tie-break = the old ascending scan's winner
    if (score < bestD || (score === bestD && best !== null && e.id < best.id)) {
      best = e;
      bestD = score;
    }
  });
  return best;
}

export function enemyVehicleNear(w: World, s: Soldier, maxRange: number) {
  let best: { id: number; pos: Vec3; d: number } | null = null;
  for (const v of w.vehicles.values()) {
    if (!v.alive || v.team === s.team || !v.seats.some((x) => x >= 0)) continue;
    if (v.submerged && !w.submarineDetectedForTeam(v, s.team)) continue;
    const d = Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z);
    if (d < maxRange && (!best || d < best.d)) best = { id: v.id, pos: v.pos, d };
  }
  return best;
}

/** Electronic intel is a destination, never a hidden target reference. The
 * copy is deliberate: a bot can pursue this frozen point while the real
 * contact moves elsewhere between scheduled sweeps. */
export function radarSearchPoint(w: World, s: Soldier): Vec3 | null {
  let best: Vec3 | null = null;
  let bestDistance = Infinity;
  for (const track of w.radarTracksFor(s.team).values()) {
    if (track.expiresAt <= w.time) continue;
    const distance = Math.hypot(track.pos.x - s.pos.x, track.pos.z - s.pos.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { ...track.pos };
    }
  }
  return best;
}

export function vehicleCrewReacted(w: World, s: Soldier, targetKey: number): boolean {
  if (s.botAcqId !== targetKey) {
    s.botAcqId = targetKey;
    const difficulty = DIFFICULTY[w.opts.difficulty ?? 'veteran'];
    s.botAcquireAt = w.time + Math.max(0.6, difficulty.react * 2) / w.director.pressure;
  }
  return w.time >= (s.botAcquireAt ?? 0);
}
