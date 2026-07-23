// ═══════════════════════════════════════════════════════════════════════════
// THE TRAFFIC — "civilian vehicles make the world feel alive."
//
// That is Robert's own line (docs/THREE-GAMES-ONE-WAR.md §Civilian vehicles),
// and until now the traffic did not honour it: forty-eight civilian hulls were
// built, fourteen of them were parked around the map, and every one of them
// sat there. A car park is not a city.
//
// This is the half that moves. A civilian hull with nobody at the wheel drives
// ITSELF — a cheap deterministic autopilot that picks somewhere to be, goes
// there, and picks somewhere else. No soldier is spawned to drive it (the id
// trap: entity ids are one shared sequence and bot roles key off `id % 4`), so
// the war's roster never notices the city exists.
//
// And it REACTS. Gunfire near a civilian is the moment the street stops being
// scenery: the driver floors it away from the noise, leans on the horn, and
// drives badly. META-LAYER §4's thread — *"civilians make fire discipline
// real"* — without waiting on the pedestrian decision.
//
// THE OTHER HALF: what a civilian vehicle DOES.
//
// The open question in the canon is *"which civilian vehicles weaponize"*, and
// bolting guns onto a taxi is the boring answer. The better one is already
// true of the real machines: **a civilian vehicle's danger is its cargo.** A
// fuel tanker is a bomb somebody drives to work. A food truck is morale. An
// ambulance is a medic with wheels. Nothing here needs a turret to matter on a
// battlefield.
//
// Pure: no rng, no world, no DOM. hash01 where a choice is needed, so seeding
// and steering never consume a draw of the match stream.
// ═══════════════════════════════════════════════════════════════════════════
import { hash01 } from './rng';
import type { Vec3, VehicleKind } from './types';

/** What a civilian hull is carrying, and therefore what it is worth. */
export type PayloadKind = 'fuel' | 'medical' | 'food' | 'siren' | 'water' | 'cargo';

export interface PayloadDef {
  kind: PayloadKind;
  /** one line for the codex — what this cargo does to a battlefield */
  note: string;
  /** wreck blast radius (0 = it just stops being a vehicle) */
  blast: number;
  /** wreck blast damage at the centre */
  blastDamage: number;
}

export const PAYLOADS: Record<PayloadKind, PayloadDef> = {
  // A BOMB SOMEBODY DRIVES TO WORK. The tanker is the headline answer to
  // "which civilian vehicles weaponize" — it already is one, fully fuelled,
  // and every side can see it parked there.
  fuel: { kind: 'fuel', note: 'Full tanks. Shoot it and the street goes up.', blast: 16, blastDamage: 190 },
  cargo: { kind: 'cargo', note: 'Freight. It burns, it does not detonate.', blast: 5, blastDamage: 40 },
  medical: { kind: 'medical', note: 'Field supplies — the wreck leaves a dressing station.', blast: 3, blastDamage: 15 },
  food: { kind: 'food', note: 'Hot food. Men who eat hold their nerve.', blast: 3, blastDamage: 15 },
  siren: { kind: 'siren', note: 'A radio and a light bar. It brings attention with it.', blast: 4, blastDamage: 25 },
  water: { kind: 'water', note: 'Pumped water — it puts fires out instead of starting them.', blast: 3, blastDamage: 12 },
};

/**
 * THE MANIFEST. Which civilian hull carries what.
 *
 * Everything absent from this table carries nothing worth naming — a sedan is
 * a sedan. That is deliberate: if every machine had a trick, none of them
 * would be a landmark.
 */
export const CIVILIAN_PAYLOAD: Partial<Record<VehicleKind, PayloadKind>> = {
  fueltanker: 'fuel',
  ambulance: 'medical',
  foodtruck: 'food',
  policecruiser: 'siren',
  firetruck: 'water',
  movingtruck: 'cargo',
  garbagetruck: 'cargo',
  cargoship: 'cargo',
  cargoplane: 'cargo',
  deliveryvan: 'cargo',
};

export const payloadOf = (kind: VehicleKind): PayloadDef | undefined => {
  const p = CIVILIAN_PAYLOAD[kind];
  return p ? PAYLOADS[p] : undefined;
};

// ── THE AUTOPILOT ──────────────────────────────────────────────────────────

export interface CivilianDrive {
  /** where this hull is currently trying to be */
  to: Vec3;
  /** give up on this destination after here (a blocked route is not a hang) */
  until: number;
  /** while > time, it is running from something */
  panicUntil: number;
  /** the horn, so panic is audible before it is visible */
  hornAt: number;
  /** how many destinations it has reached — used to vary the wander */
  legs: number;
  /** seconds spent trying to move and not moving — a wedged hull */
  stuckFor?: number;
  /** while > time, back out of whatever it is wedged against */
  reverseUntil?: number;
}

/** Below this, a hull that wants to move is not moving. */
export const STUCK_SPEED = 0.35;
/** How long to keep trying before admitting it is wedged. */
export const STUCK_SECONDS = 2.5;
/** How long to back out for. */
export const REVERSE_SECONDS = 1.1;

/**
 * A car spawned hard against a wall can never pull away — it has no room to
 * turn into and the throttle just holds it there. A real driver backs out.
 * Returns true while this hull should be reversing.
 */
export function updateStuck(d: CivilianDrive, speed: number, wantsToMove: boolean, dt: number, now: number): boolean {
  if (now < (d.reverseUntil ?? 0)) return true;
  if (!wantsToMove || speed > STUCK_SPEED) { d.stuckFor = 0; return false; }
  d.stuckFor = (d.stuckFor ?? 0) + dt;
  if (d.stuckFor < STUCK_SECONDS) return false;
  d.stuckFor = 0;
  d.reverseUntil = now + REVERSE_SECONDS;
  d.until = now; // and pick somewhere else once it is free
  return true;
}

/** How close counts as arrived. */
export const ARRIVED = 7;
/** A leg times out — a car stuck against a wall picks somewhere else. */
export const LEG_SECONDS = 22;
/** Gunfire this close is the driver's problem. */
export const PANIC_RADIUS = 34;
export const PANIC_SECONDS = 6.5;

/** Ordinary traffic pace, and the pace of a driver who has heard shooting. */
export const CRUISE = 0.44;
export const FLEEING = 1;

export function newDrive(at: Vec3, seed: number, now: number): CivilianDrive {
  return { to: { ...at }, until: now, panicUntil: 0, hornAt: 0, legs: Math.floor(hash01(seed) * 7) };
}

/**
 * Steer toward a point. Returns a throttle/turn pair in PlayerCmd's own units,
 * so the whole existing drivetrain — weight, traction, the materials table —
 * drives the city exactly the way it drives the war.
 */
export function steerToward(
  pos: Vec3, yaw: number, to: Vec3, pace: number,
): { moveX: number; moveZ: number } {
  const dx = to.x - pos.x, dz = to.z - pos.z;
  const want = Math.atan2(dz, dx);
  let off = want - yaw;
  while (off > Math.PI) off -= 2 * Math.PI;
  while (off < -Math.PI) off += 2 * Math.PI;
  // turn proportionally, clamped; back off the throttle through a hard corner
  // the way anybody does, so a taxi does not take a junction at full speed
  const moveX = Math.max(-1, Math.min(1, off * 1.6));
  const straightness = Math.max(0, 1 - Math.abs(off) / (Math.PI * 0.62));
  const moveZ = -pace * (0.35 + 0.65 * straightness); // -Z is forward
  return { moveX, moveZ };
}

/** Has this leg finished, one way or the other? */
export function legDone(pos: Vec3, d: CivilianDrive, now: number): boolean {
  return now >= d.until || Math.hypot(d.to.x - pos.x, d.to.z - pos.z) < ARRIVED;
}

/**
 * Somewhere to run when the shooting starts: directly away from it, as far as
 * the panic will carry them. Not clever, and it should not be — a frightened
 * driver does not path-find.
 */
export function fleeTo(from: Vec3, threat: Vec3, distance = 90): Vec3 {
  const dx = from.x - threat.x, dz = from.z - threat.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: from.x + (dx / d) * distance, y: 0, z: from.z + (dz / d) * distance };
}

/** The pace this hull should be doing right now. */
export const paceFor = (d: CivilianDrive, now: number): number =>
  (now < d.panicUntil ? FLEEING : CRUISE);

/** Is this hull running from something? */
export const isPanicking = (d: CivilianDrive, now: number): boolean => now < d.panicUntil;
