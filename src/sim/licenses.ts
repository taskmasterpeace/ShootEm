// ═══════════════════════════════════════════════════════════════════════════
// THE LICENCES — vehicle certifications, not XP unlocks.
//
// Robert's canon (docs/THREE-GAMES-ONE-WAR.md): *"Don't lock them behind XP.
// Make them certifications… You earn them at training bases. This makes
// training bases valuable forever."* And the closing law: *"You don't fly the
// bomber because you're level 20 — you passed flight school."*
//
// So a hull is gated by a QUALIFICATION, and a qualification is a thing you
// went somewhere and earned. This file is the register: the twelve licences,
// what each one covers, which school issues it, and the licence every hull in
// the fleet — military and civilian — demands. The Codex reads it as a column
// so the answer to "why can't I fly that?" is on the card, not in a wiki.
//
// The ACCOUNT owns licences (they survive a print's death — the account/print
// split, THREE-GAMES-ONE-WAR §Prints). Nothing here touches the sim: the
// register is data, and the enforcement seam (licenceHeld) is a client call.
// ═══════════════════════════════════════════════════════════════════════════
import { VEHICLES } from './data';
import type { VehicleKind } from './types';

export type LicenceId =
  | 'basic_driver' | 'heavy_truck' | 'apc' | 'tank' | 'hovercraft' | 'boat'
  | 'helicopter' | 'fixed_wing' | 'bomber' | 'transport' | 'drone_pilot' | 'dropship'
  | 'none';

export interface LicenceDef {
  id: LicenceId;
  /** The card name — how it reads on your file. */
  name: string;
  /** Where you earn it. Training bases stay valuable forever (the canon). */
  school: string;
  /** One line: what it lets you take out. */
  covers: string;
  /** Which licence you must already hold — the ladder, not a level gate. */
  requires?: LicenceId;
  /** Rough class order for display (1 = first day, 5 = the trusted seat). */
  tier: 1 | 2 | 3 | 4 | 5;
}

/** The twelve, in the canon's own order. */
export const LICENCES: Record<LicenceId, LicenceDef> = {
  none: { id: 'none', name: 'No licence required', school: '—', covers: 'Anything a soldier can push, pedal, or ride without paperwork.', tier: 1 },
  basic_driver: { id: 'basic_driver', name: 'Basic Driver', school: 'Motor Pool', covers: 'Cars, runabouts, bikes and light utility hulls.', tier: 1 },
  heavy_truck: { id: 'heavy_truck', name: 'Heavy Truck', school: 'Motor Pool', covers: 'Trucks, buses, plant machinery and anything with air brakes.', requires: 'basic_driver', tier: 2 },
  apc: { id: 'apc', name: 'APC', school: 'Armour School', covers: 'Armoured personnel carriers and protected transports.', requires: 'heavy_truck', tier: 3 },
  tank: { id: 'tank', name: 'Tank', school: 'Armour School', covers: 'Main battle tanks, assault walkers and tracked breachers.', requires: 'apc', tier: 4 },
  hovercraft: { id: 'hovercraft', name: 'Hovercraft', school: 'Motor Pool', covers: 'Hover decks, skirted hulls and the raceboards.', requires: 'basic_driver', tier: 2 },
  boat: { id: 'boat', name: 'Boat', school: 'Naval Yard', covers: 'Surface craft, gunboats and everything that floats.', tier: 2 },
  helicopter: { id: 'helicopter', name: 'Helicopter', school: 'Flight School', covers: 'Rotary wing — attack, transport and civilian.', tier: 3 },
  fixed_wing: { id: 'fixed_wing', name: 'Fixed Wing', school: 'Flight School', covers: 'Aircraft that cannot hover: jets, planes and gliders.', tier: 3 },
  bomber: { id: 'bomber', name: 'Bomber', school: 'Flight School', covers: 'Heavy payload airframes. The seat nobody gets early.', requires: 'fixed_wing', tier: 5 },
  transport: { id: 'transport', name: 'Transport', school: 'Flight School', covers: 'Crewed lifters and large-hull passenger craft.', requires: 'heavy_truck', tier: 3 },
  drone_pilot: { id: 'drone_pilot', name: 'Drone Pilot', school: 'Signals School', covers: 'Remote hulls and FPV drones. Nobody dies in the chair.', tier: 2 },
  dropship: { id: 'dropship', name: 'Dropship', school: 'Flight School', covers: 'Combat insertion craft — the seat that carries the squad in.', requires: 'transport', tier: 5 },
};

/** Explicit overrides. Everything else derives (see licenceFor). */
const OVERRIDES: Partial<Record<VehicleKind, LicenceId>> = {
  // war materiel
  tank: 'tank', mech: 'tank', tunneler: 'tank', apc: 'apc',
  transport: 'transport', transportheli: 'dropship', bomber: 'bomber',
  stealthbomber: 'bomber', emplacement: 'none',
  // the personal decks: a soldier straps in without paperwork
  hoverboard: 'none', bicycle: 'none', scooter: 'none',
  // civilians that are still real machines
  schoolbus: 'heavy_truck', firetruck: 'heavy_truck', garbagetruck: 'heavy_truck',
  fueltanker: 'heavy_truck', movingtruck: 'heavy_truck', cementmixer: 'heavy_truck',
  bulldozer: 'heavy_truck', loader: 'heavy_truck', forklift: 'heavy_truck',
  towtruck: 'heavy_truck', train: 'heavy_truck', subway: 'heavy_truck',
  passengerjet: 'transport', cargoplane: 'transport', blimp: 'transport',
  skycrane: 'helicopter', balloon: 'none',
  paraglider: 'none', hangglider: 'none', // you jump; the air does the rest
  ferry: 'boat', cargoship: 'boat', riverbarge: 'boat',
};

/** The licence a hull demands — override first, then the shape of the thing. */
export function licenceFor(kind: VehicleKind): LicenceId {
  const o = OVERRIDES[kind];
  if (o) return o;
  const def = VEHICLES[kind];
  if (!def) return 'basic_driver';
  // THE STALL FLOOR IS THE TELL. `hover` in this codebase means CROSSES WATER
  // (the skiff and the Vulture both carry it) — it never meant "hovers in
  // place". An airframe that cannot stop flying is FIXED WING by the game's
  // own V2 law; a flyer without a stall floor is rotary.
  if (def.flies) return def.minAirspeed ? 'fixed_wing' : 'helicopter';
  if (def.boat) return 'boat';
  if (def.hover) return 'hovercraft';
  if (def.immobile) return 'none';
  return 'basic_driver';
}

/** The full chain a licence stands on — Bomber needs Fixed Wing before it. */
export function licenceChain(id: LicenceId): LicenceId[] {
  const chain: LicenceId[] = [];
  let cur: LicenceId | undefined = id;
  while (cur && cur !== 'none' && !chain.includes(cur)) {
    chain.unshift(cur);
    cur = LICENCES[cur].requires;
  }
  return chain;
}

/** Does this file clear the hull? Held licences are account-level. */
export function licenceHeld(held: readonly LicenceId[], kind: VehicleKind): boolean {
  const need = licenceFor(kind);
  if (need === 'none') return true;
  return licenceChain(need).every((step) => held.includes(step));
}

/** Every hull the register covers, grouped by licence — the school's syllabus. */
export function hullsUnder(id: LicenceId): VehicleKind[] {
  return (Object.keys(VEHICLES) as VehicleKind[]).filter((k) => licenceFor(k) === id);
}
