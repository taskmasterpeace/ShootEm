// ═══════════════════════════════════════════════════════════════════════════
// THE GARAGE — four slots, and every fit costs you something.
//
// Robert: *"I want people to be able to change the tires on the car… not just
// the engine to choose max speed or acceleration, but you figure it out. I
// don't want it to be too deep, but I want a little bit of car modification."*
//
// So: FOUR slots, never five. TIRES rewrite the traction profile (Racing
// Destruction Set's card, ours in multipliers). ENGINE trades top end against
// acceleration. CHASSIS trades weight against survival. CARGO is the RDS
// row — mines, oil, armour, a crusher — and every item you carry is MASS,
// which the drivetrain already charges you for. Nothing here is strictly
// better than anything else; that is the house law, applied to cars.
//
// Pure data + a pure apply(). No sim state, no DOM.
// ═══════════════════════════════════════════════════════════════════════════
import { VEHICLES } from './data';
import type { VehicleDef, VehicleKind } from './types';

export type TireId = 'slicks' | 'allterrain' | 'knobblies' | 'studs';
export type EngineId = 'stock' | 'sprint' | 'longratio';
export type ChassisId = 'stripped' | 'standard' | 'reinforced';
export type CargoId = 'mines' | 'oil' | 'armour' | 'crusher';

export interface Fit {
  tires: TireId;
  engine: EngineId;
  chassis: ChassisId;
  /** the RDS row — carry what you like, pay for it in mass */
  cargo: CargoId[];
}

export const DEFAULT_FIT: Fit = { tires: 'allterrain', engine: 'stock', chassis: 'standard', cargo: [] };

export interface Part {
  id: string;
  name: string;
  /** the one-line trade, in the shop's voice — shown on the card */
  blurb: string;
  mass: number; // tonnes added (or removed)
}

/** TIRES rewrite the traction profile outright — this IS the card's top line. */
export const TIRES: Record<TireId, Part & { traction: { ice: number; dirt: number; paved: number } }> = {
  slicks: {
    id: 'slicks', name: 'Slicks', mass: 0,
    blurb: 'Tarmac royalty. Off it, a liability — and in the wet, a passenger.',
    traction: { ice: 0.35, dirt: 0.6, paved: 1.45 },
  },
  allterrain: {
    id: 'allterrain', name: 'All-Terrain', mass: 0.05,
    blurb: 'Good everywhere, brilliant nowhere. The tyre you fit when you do not know the track.',
    traction: { ice: 0.75, dirt: 1.0, paved: 1.0 },
  },
  knobblies: {
    id: 'knobblies', name: 'Knobblies', mass: 0.1,
    blurb: 'Dirt, mud and gravel. On pavement they howl and let go.',
    traction: { ice: 0.8, dirt: 1.4, paved: 0.75 },
  },
  studs: {
    id: 'studs', name: 'Studded', mass: 0.15,
    blurb: 'Bite on ice nothing else can touch. Slow and loud on every other surface.',
    traction: { ice: 1.6, dirt: 1.0, paved: 0.7 },
  },
};

/** ENGINE: the classic trade, top end against the launch. */
export const ENGINES: Record<EngineId, Part & { speed: number; accel: number }> = {
  stock: { id: 'stock', name: 'Stock Block', mass: 0, blurb: 'What it left the factory with. Balanced, honest, unremarkable.', speed: 1, accel: 1 },
  sprint: { id: 'sprint', name: 'Sprint Tune', mass: 0.05, blurb: 'Savage off the line, runs out of breath at the top.', speed: 0.9, accel: 1.35 },
  longratio: { id: 'longratio', name: 'Long Ratio', mass: 0.08, blurb: 'Lazy away from a stop, unbeatable down a long straight.', speed: 1.14, accel: 0.75 },
};

/** CHASSIS: weight against survival. */
export const CHASSIS: Record<ChassisId, Part & { hp: number }> = {
  stripped: { id: 'stripped', name: 'Stripped', mass: -0.35, blurb: 'Interior in a skip. Quick, nimble, and made of paper.', hp: 0.75 },
  standard: { id: 'standard', name: 'Standard', mass: 0, blurb: 'The car as built. No apologies, no heroics.', hp: 1 },
  reinforced: { id: 'reinforced', name: 'Reinforced', mass: 0.6, blurb: 'Cage and plate. It survives the contact you were going to have anyway.', hp: 1.4 },
};

/** CARGO — the RDS row. Everything here is weight you chose to carry. */
export const CARGO: Record<CargoId, Part & { count?: number }> = {
  mines: { id: 'mines', name: 'Land Mines', mass: 0.18, blurb: 'Six, dropped behind you. They arm a beat late so you cannot kill yourself with them.', count: 6 },
  oil: { id: 'oil', name: 'Oil Gallons', mass: 0.22, blurb: 'Four slicks. Whatever crosses one drives on ice until it wears off.', count: 4 },
  armour: { id: 'armour', name: 'Armour Plate', mass: 0.75, blurb: 'Soak the hits. Pay for it every time you ask the car to go or stop.' },
  crusher: { id: 'crusher', name: 'Crusher Ram', mass: 0.45, blurb: 'A wedge on the nose. Contact stops being an accident and becomes a plan.' },
};

/** The CARD as fitted: the def, rewritten by everything bolted to it. */
export function fitted(kind: VehicleKind, fit: Fit = DEFAULT_FIT): VehicleDef {
  const base = VEHICLES[kind];
  if (!base) return base;
  const tire = TIRES[fit.tires] ?? TIRES.allterrain;
  const engine = ENGINES[fit.engine] ?? ENGINES.stock;
  const chassis = CHASSIS[fit.chassis] ?? CHASSIS.standard;
  const cargoMass = fit.cargo.reduce((m, c) => m + (CARGO[c]?.mass ?? 0), 0);
  const baseT = base.traction ?? { ice: 1, dirt: 1, paved: 1 };
  return {
    ...base,
    // the fitted mass is what the drivetrain actually charges you for
    mass: Math.max(0.05, (base.mass ?? 1.6) + tire.mass + engine.mass + chassis.mass + cargoMass),
    speed: base.speed * engine.speed,
    hp: Math.round(base.hp * chassis.hp * (fit.cargo.includes('armour') ? 1.35 : 1)),
    // the tyre REWRITES the profile — the hull's own bias survives as a nudge
    traction: {
      ice: tire.traction.ice * (0.6 + baseT.ice * 0.4),
      dirt: tire.traction.dirt * (0.6 + baseT.dirt * 0.4),
      paved: tire.traction.paved * (0.6 + baseT.paved * 0.4),
    },
  };
}

/** Acceleration as the card reads it (RDS printed a number; so do we). */
export function accelRating(kind: VehicleKind, fit: Fit = DEFAULT_FIT): number {
  const d = fitted(kind, fit);
  const engine = ENGINES[fit.engine] ?? ENGINES.stock;
  // power-to-weight, scaled to a readable 1..10
  const raw = (d.speed * engine.accel) / Math.max(0.2, d.mass ?? 1.6);
  return Math.max(1, Math.min(10, Math.round(raw * 0.9)));
}

/** Is this fit legal? (A truck cannot wear slicks and pretend.) */
export function fitLegal(kind: VehicleKind, fit: Fit): boolean {
  const d = VEHICLES[kind];
  if (!d) return false;
  if (d.flies || d.boat || d.rails) return false; // the garage is for road hulls
  return fit.cargo.length <= 2; // two cargo slots, never more — keep it shallow
}
