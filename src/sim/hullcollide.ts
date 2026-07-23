// ═══════════════════════════════════════════════════════════════════════════
// HULL TO HULL — machines stop driving through each other.
//
// Robert: *"we need hull-to-hull collision for a race car game… I think we
// need it on the combat field as well. I know it's a lot of calculations."*
//
// It is not, at these counts. A race grid is a dozen machines and a busy match
// is around thirty with traffic — the whole pass is a few hundred distance
// checks a tick, which is nothing next to the projectile and vision work
// already running. The expensive one is soldier-to-soldier (hundreds of bodies,
// constantly touching), and that is deliberately NOT here: Robert's call in the
// same breath was *"we don't have to do vehicles and infantry then."*
//
// THE MODEL: an impulse, not a spring. Two hulls overlapping are pushed apart
// along the line between them, share of the push weighted by MASS — so a loaded
// tanker shoves a hatchback and a bike bounces off a truck rather than the
// truck politely making room. Mass is already on every card (the weight law),
// so nothing new had to be invented to make a collision feel like the machines
// involved.
//
// Pure arithmetic over positions and velocities. No world, no rng, no DOM.
// ═══════════════════════════════════════════════════════════════════════════
import type { Vec3 } from './types';

/** The minimum a hull is treated as, so a bicycle still has a body. */
export const MIN_RADIUS = 0.8;
/** How hard overlapping hulls are pushed apart, per second. */
export const SEPARATION = 14;
/** How much of the closing speed survives the hit (0 = dead stop, 1 = elastic). */
export const RESTITUTION = 0.25;
/** Below this closing speed it is a nudge, not a crash — no damage, no scrub. */
export const CRASH_SPEED = 7;
/** Closing speed × combined mass above this files real damage. */
export const CRASH_FORCE = 34;

export interface Hull {
  id: number;
  pos: Vec3;
  vel: Vec3;
  /** tonnes-ish, from the vehicle card */
  mass: number;
  radius: number;
}

export interface Impact {
  a: number;
  b: number;
  /** closing speed at the moment of contact */
  speed: number;
  /** speed × combined mass — what the damage model reads */
  force: number;
  /** where it happened, for the client's sparks */
  at: Vec3;
}

/**
 * Resolve one tick of hull-vs-hull contact.
 *
 * Mutates positions and velocities in place and returns the impacts worth
 * telling anybody about. O(n²) on purpose: at 30 hulls that is 435 pairs, and
 * a grid would cost more to maintain than it saves. If this ever runs at 200
 * hulls, bucket it then — and not before, because the simple version is the
 * one that is obviously correct.
 */
export function resolveHulls(hulls: Hull[], dt: number): Impact[] {
  const impacts: Impact[] = [];
  for (let i = 0; i < hulls.length; i++) {
    const a = hulls[i];
    for (let j = i + 1; j < hulls.length; j++) {
      const b = hulls[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const ra = Math.max(MIN_RADIUS, a.radius);
      const rb = Math.max(MIN_RADIUS, b.radius);
      const want = ra + rb;
      const d2 = dx * dx + dz * dz;
      if (d2 >= want * want) continue;

      // dead centre: shove along a stable axis rather than dividing by zero
      const d = Math.sqrt(d2) || 0.0001;
      const nx = d2 > 0 ? dx / d : 1;
      const nz = d2 > 0 ? dz / d : 0;
      const overlap = want - d;

      // MASS DECIDES WHO MOVES. A tanker against a hatchback barely notices.
      const ma = Math.max(0.05, a.mass);
      const mb = Math.max(0.05, b.mass);
      const total = ma + mb;
      const shareA = mb / total; // the LIGHTER one moves further
      const shareB = ma / total;

      const push = Math.min(overlap, SEPARATION * dt) ;
      a.pos.x -= nx * push * shareA;
      a.pos.z -= nz * push * shareA;
      b.pos.x += nx * push * shareB;
      b.pos.z += nz * push * shareB;

      // closing speed along the contact normal
      const rvx = b.vel.x - a.vel.x;
      const rvz = b.vel.z - a.vel.z;
      const closing = rvx * nx + rvz * nz;
      if (closing >= 0) continue; // already separating — no impulse, no crash

      const impulse = -(1 + RESTITUTION) * closing;
      a.vel.x -= impulse * nx * shareA;
      a.vel.z -= impulse * nz * shareA;
      b.vel.x += impulse * nx * shareB;
      b.vel.z += impulse * nz * shareB;

      const speed = -closing;
      if (speed >= CRASH_SPEED) {
        impacts.push({
          a: a.id, b: b.id, speed,
          force: speed * (total / 2),
          at: { x: a.pos.x + nx * ra, y: a.pos.y, z: a.pos.z + nz * ra },
        });
      }
    }
  }
  return impacts;
}

/**
 * The damage a crash of this force does to ONE of the hulls involved.
 * Scaled so a tap is free and a truck at speed is a write-off, and clamped so
 * nothing dies from a single kiss of the barrier.
 */
export function crashDamage(force: number): number {
  if (force < CRASH_FORCE) return 0;
  return Math.min(140, (force - CRASH_FORCE) * 1.6);
}
