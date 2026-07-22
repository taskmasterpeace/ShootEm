// ═══════════════════════════════════════════════════════════════════════════
// THE MATERIALS TABLE — one record per substance (wood · masonry · metal · ice
// · grass …). Every tile you run into (T_*) and every floor you walk on (S_*)
// points at a material, so "metal on the ground" and "metal doors" are just two
// placements of ONE substance. Every projectile / drill / fire interaction asks
// the table one question: what happens when I hit this?
//
// This is the single source of truth that damageWall (hp + heavy gate), the
// drill (rate + spark face), the SURF speed tables (walk), and the impact VFX
// all read. Ricochet / pierce / flammable are fields the later passes switch on.
// ═══════════════════════════════════════════════════════════════════════════
import {
  T_OPEN, T_WALL, T_COVER, T_WATER, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL,
  T_METAL_DOOR, T_LADDER, T_DEEP, T_CLIMB, T_RUBBLE, T_GRASS,
  T_THIN_WALL_H, T_THIN_WALL_V, T_THIN_WALL_HV,
  T_THIN_DOOR_H, T_THIN_DOOR_V, T_THIN_DOOR_H_OPEN, T_THIN_DOOR_V_OPEN,
  S_DIRT, S_GRASS, S_ICE, S_GRIT, S_PLATE, S_WET, S_MUD,
} from './map';

export type ImpactKind =
  | 'spark' | 'dust' | 'splinter' | 'puff' | 'splash' | 'shatter' | 'rustle' | 'chips';

export interface Material {
  name: string;
  hp: number;              // damage to destroy (Infinity = only bedrock/border)
  hardness: 0 | 1 | 2 | 3; // 0 soft · 1 medium · 2 hard · 3 metal — the "strength"
  drill: number;           // breacher grind RATE ×; 0 = undrillable. Derives from hardness
  heavyOnly: boolean;      // small arms just ping/spark — only heavy/demo/drill chips it
  ricochet: number;        // 0–1 chance a fast/energy round bounces off
  penetrable: boolean;     // rail / armor-piercing punches through it
  flammable: boolean;      // catches + SPREADS fire, burns down over time
  impact: ImpactKind;      // hit + drill-face VFX/sound
  walk?: { sol: number; wheel: number; track: number }; // only if it's ever a floor (hover ignores)
  slick?: boolean;         // ice — momentum carries
  /** THE WEIGHT LAW (#102): how hard boots BITE this floor, per second — the
   *  rate velocity eases toward move intent (and the base of the stopping
   *  brake). Metal deck grabs hardest, dirt is firm, grit shifts underfoot,
   *  mud sucks, ice barely holds. Only meaningful on floor materials. */
  grip?: number;
}

// the substances (starting values — all tunable) ---------------------------
export const MATERIALS = {
  dirt:      { name: 'Dirt',       hp: Infinity, hardness: 0, drill: 0,    heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: false, impact: 'puff',     walk: { sol: 1, wheel: 1, track: 1 }, grip: 13 },
  grass:     { name: 'Grass',      hp: 20,       hardness: 0, drill: 1.5,  heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: true,  impact: 'rustle',   walk: { sol: 0.85, wheel: 1, track: 1 }, grip: 12 },
  wood:      { name: 'Wood',       hp: 60,       hardness: 0, drill: 1.5,  heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: true,  impact: 'splinter' },
  woodFrame: { name: 'Wood frame', hp: 140,      hardness: 0, drill: 1.3,  heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: true,  impact: 'splinter' },
  sandbag:   { name: 'Earthwork',  hp: 80,       hardness: 1, drill: 1.2,  heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: false, impact: 'puff' },
  masonry:   { name: 'Masonry',    hp: 300,      hardness: 2, drill: 0.7,  heavyOnly: true,  ricochet: 0,   penetrable: false, flammable: false, impact: 'dust' },
  stone:     { name: 'Stone',      hp: 600,      hardness: 2, drill: 0.4,  heavyOnly: true,  ricochet: 0.3, penetrable: false, flammable: false, impact: 'chips' },
  metal:     { name: 'Metal',      hp: 650,      hardness: 3, drill: 0.3,  heavyOnly: true,  ricochet: 0.8, penetrable: false, flammable: false, impact: 'spark',   walk: { sol: 1, wheel: 1.05, track: 1 }, grip: 14 },
  metalDoor: { name: 'Metal door', hp: 900,      hardness: 3, drill: 0.25, heavyOnly: true,  ricochet: 0.6, penetrable: false, flammable: false, impact: 'spark' },
  ice:       { name: 'Ice',        hp: 100,      hardness: 1, drill: 1,    heavyOnly: false, ricochet: 0.6, penetrable: false, flammable: false, impact: 'shatter', walk: { sol: 1, wheel: 0.85, track: 0.9 }, slick: true, grip: 4.5 },
  grit:      { name: 'Grit',       hp: Infinity, hardness: 0, drill: 0,    heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: false, impact: 'puff',     walk: { sol: 0.92, wheel: 0.72, track: 0.9 }, grip: 9 },
  wet:       { name: 'Wet',        hp: Infinity, hardness: 0, drill: 0,    heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: false, impact: 'splash',   walk: { sol: 0.96, wheel: 0.9, track: 0.95 }, grip: 8 },
  mud:       { name: 'Mud',        hp: Infinity, hardness: 0, drill: 0,    heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: false, impact: 'splash',   walk: { sol: 0.8, wheel: 0.6, track: 0.85 }, grip: 6 },
  water:     { name: 'Water',      hp: Infinity, hardness: 0, drill: 0,    heavyOnly: false, ricochet: 0,   penetrable: true,  flammable: false, impact: 'splash', grip: 8 },
  // NOTE: spec set rubble heavyOnly:false, but small-arms-breakable rubble shifted
  // the threat-balance law (stormcaller stopped dying to its counter). Kept heavy-
  // gated to protect that law — revisit with a re-tune if we want small-arms clearing.
  rubble:    { name: 'Rubble',     hp: 120,      hardness: 1, drill: 1,    heavyOnly: true,  ricochet: 0,   penetrable: true,  flammable: false, impact: 'dust',     walk: { sol: 0.6, wheel: 0.6, track: 0.6 }, grip: 7 },
  bedrock:   { name: 'Bedrock',    hp: Infinity, hardness: 3, drill: 0,    heavyOnly: true,  ricochet: 0.5, penetrable: false, flammable: false, impact: 'spark' },
} satisfies Record<string, Material>;

export type MaterialId = keyof typeof MATERIALS;

/** Seconds the drill spends grinding ONE tile at drill-rate 1.0. A tile's real
 *  grind time is DRILL_BASE / material.drill — so masonry (0.7) ≈ 0.35s (the
 *  historical cadence), metal (0.3) ≈ 0.82s, the metal door (0.25) ≈ 0.98s
 *  (the toughest), wood (1.5) ≈ 0.16s. drill = 0 (bedrock/dirt) never grinds. */
export const DRILL_BASE = 0.245;

/** The material a TILE is made of — the thing a round/drill/shell strikes.
 *  Metal-wall and the safe-room door share the metal family; open ground and
 *  ladders are dirt (nothing to destroy). Out of bounds = bedrock (the border). */
export function materialOf(tile: number): Material {
  switch (tile) {
    case T_WALL: case T_SLIT:
    case T_THIN_WALL_H: case T_THIN_WALL_V: case T_THIN_WALL_HV:
      return MATERIALS.masonry;
    case T_CLIMB: return MATERIALS.masonry;         // container barricade: structural, heavy, drillable (preserves 300hp)
    case T_COVER: return MATERIALS.sandbag;
    case T_DOOR: case T_DOOR_OPEN:
    case T_THIN_DOOR_H: case T_THIN_DOOR_V:
    case T_THIN_DOOR_H_OPEN: case T_THIN_DOOR_V_OPEN:
      return MATERIALS.wood;
    case T_METAL: return MATERIALS.metal;
    case T_METAL_DOOR: return MATERIALS.metalDoor;
    case T_RUBBLE: return MATERIALS.rubble;
    case T_GRASS: return MATERIALS.grass;
    case T_WATER: case T_DEEP: return MATERIALS.water;
    case T_OPEN: case T_LADDER: return MATERIALS.dirt;
    default: return MATERIALS.dirt;
  }
}

/** The material of a FLOOR (the S_* surface layer) — what you walk ON. The
 *  starship deck (S_PLATE) is the SAME metal as a metal wall: one substance,
 *  two placements. Folds the old SURF_* speed tables into material.walk. */
export function materialForSurface(surf: number): Material {
  switch (surf) {
    case S_GRASS: return MATERIALS.grass;
    case S_ICE: return MATERIALS.ice;
    case S_GRIT: return MATERIALS.grit;
    case S_PLATE: return MATERIALS.metal;
    case S_WET: return MATERIALS.wet;
    case S_MUD: return MATERIALS.mud;
    case S_DIRT: default: return MATERIALS.dirt;
  }
}
