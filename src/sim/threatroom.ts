// ═══════════════════════════════════════════════════════════════════════════
// THE THREAT ROOM — the combat laboratory.
//
// Robert: *"build a comprehensive threat room… we can summon different
// characters, but we can practice on a dummy. We have to be able to practice
// fighting things that know how to BLOCK, things we can just knock around the
// room, something that can MOVE like a shooter would want… come up with 20
// different presets to experiment with the different fight mechanics… we also
// gotta be able to test out melee… a threat room should feel like we can
// stumble across new gameplay stuff in it."*
//
// So this file is the ROOM'S BRAIN: what can be summoned, and the twenty
// experiments. Each preset is a SCENARIO — a named question about the combat
// system with the setup that asks it. They are deliberately opinionated: a
// preset that teaches nothing is a preset nobody runs twice.
//
// Pure data + a pure spawn plan. No THREE, no DOM. The runner (world side)
// reads the plan and builds it; the panel (client) lists it.
// ═══════════════════════════════════════════════════════════════════════════
import type { ClassId, SoldierKind, VehicleKind, ZedKind } from './types';

/** What a preset can put in the room. */
export type SummonKind =
  | { what: 'dummy'; label?: string }
  | { what: 'blocker' }                          // guards on purpose — melee practice
  | { what: 'mover'; speed?: number }            // paces the room — the shooter's target
  | { what: 'class'; classId: ClassId }
  | { what: 'threat'; zed: ZedKind }
  | { what: 'god'; ascendant: string }
  | { what: 'vehicle'; kind: VehicleKind }
  | { what: 'prop'; heavy?: boolean };           // knock it around the room

export interface SummonSpec {
  kind: SummonKind;
  /** how many */
  count: number;
  /** where, relative to the player: distance and the arc they spread over */
  range: number;
  arc?: number;
  /** team: 1 = hostile (default), 0 = friendly, -1 = inert */
  team?: 0 | 1;
  /** hp override — a punching bag that never dies, or one that dies fast */
  hp?: number;
  /** they come back when they drop (the range's own law) */
  respawns?: boolean;
}

export interface ThreatPreset {
  id: string;
  name: string;
  /** THE QUESTION this experiment asks — shown on the card, in the lab's voice */
  question: string;
  /** which part of the system it probes — the panel groups by this */
  tag: 'melee' | 'gunplay' | 'physics' | 'crowd' | 'armour' | 'movement' | 'gods' | 'sandbox';
  summons: SummonSpec[];
}

const S = (kind: SummonKind, count: number, range: number, over: Partial<SummonSpec> = {}): SummonSpec =>
  ({ kind, count, range, arc: 1.4, team: 1, ...over });

/**
 * THE TWENTY. Each is a question about the fight, with the setup that asks
 * it — the point of a lab is that you leave knowing something.
 */
export const THREAT_PRESETS: ThreatPreset[] = [
  // ── melee (the thing Robert most wants to feel) ──
  {
    id: 'first_blood', name: 'THE DUMMY', tag: 'melee',
    question: 'What does a strike FEEL like when nothing fights back? Baseline for everything else.',
    summons: [S({ what: 'dummy' }, 1, 6, { respawns: true, hp: 400 })],
  },
  {
    id: 'the_wall', name: 'THE WALL', tag: 'melee',
    question: 'It blocks everything. Can you open a guard at all — and what actually opens it?',
    summons: [S({ what: 'blocker' }, 1, 6, { hp: 600, respawns: true })],
  },
  {
    id: 'two_guards', name: 'TWO GUARDS', tag: 'melee',
    question: 'Two blockers, one of you. Does melee have an answer to being flanked?',
    summons: [S({ what: 'blocker' }, 2, 7, { hp: 400, respawns: true, arc: 2.2 })],
  },
  {
    id: 'the_grapple', name: 'THE GRAPPLE PIT', tag: 'melee',
    question: 'Four bodies in arm\'s reach. Does the grab read, and can you get out of one?',
    summons: [S({ what: 'class', classId: 'infantry' }, 4, 4, { hp: 250, arc: 3.1 })],
  },
  {
    id: 'heavy_hands', name: 'HEAVY HANDS', tag: 'melee',
    question: 'A heavy that swings back. Is trading blows ever the right call?',
    summons: [S({ what: 'class', classId: 'heavy' }, 1, 5, { hp: 500 })],
  },
  {
    id: 'knife_fight', name: 'THE CLOSE ROOM', tag: 'melee',
    question: 'Six of them, all close, all armed. Where does melee stop being viable?',
    summons: [S({ what: 'class', classId: 'infantry' }, 6, 8, { hp: 140, arc: 3.1 })],
  },
  // ── gunplay ──
  {
    id: 'the_mover', name: 'THE MOVER', tag: 'gunplay',
    question: 'One target, pacing. How much lead does your weapon actually need?',
    summons: [S({ what: 'mover' }, 1, 22, { hp: 300, respawns: true })],
  },
  {
    id: 'the_gallery', name: 'THE GALLERY', tag: 'gunplay',
    question: 'Six movers at range. Does target acquisition hold up when they all move?',
    summons: [S({ what: 'mover', speed: 5 }, 6, 30, { hp: 120, respawns: true, arc: 1.8 })],
  },
  {
    id: 'the_ladder', name: 'THE RANGE LADDER', tag: 'gunplay',
    question: 'Dummies at 10, 20, 40, 70, 110. Where does each weapon actually stop working?',
    summons: [
      S({ what: 'dummy' }, 1, 10, { respawns: true, arc: 0 }),
      S({ what: 'dummy' }, 1, 20, { respawns: true, arc: 0 }),
      S({ what: 'dummy' }, 1, 40, { respawns: true, arc: 0 }),
      S({ what: 'dummy' }, 1, 70, { respawns: true, arc: 0 }),
      S({ what: 'dummy' }, 1, 110, { respawns: true, arc: 0 }),
    ],
  },
  {
    id: 'the_rush', name: 'THE RUSH', tag: 'gunplay',
    question: 'Eight sprinters, straight at you. Can any loadout hold this line?',
    summons: [S({ what: 'threat', zed: 'sprinter' }, 8, 40, { arc: 1.2 })],
  },
  {
    id: 'return_fire', name: 'RETURN FIRE', tag: 'gunplay',
    question: 'They shoot back. What does the damage-direction read tell you in a real crossfire?',
    summons: [S({ what: 'class', classId: 'infantry' }, 3, 26, { arc: 2.4 })],
  },
  // ── physics: the things you knock around ──
  {
    id: 'the_bowling', name: 'THE BOWLING LANE', tag: 'physics',
    question: 'A row of props. How far does a body throw, and does the weight read?',
    summons: [S({ what: 'prop' }, 8, 14, { arc: 1.0, team: 1 })],
  },
  {
    id: 'the_junkyard', name: 'THE JUNKYARD', tag: 'physics',
    question: 'Heavy props everywhere. Can you fight AROUND cover you can also move?',
    summons: [S({ what: 'prop', heavy: true }, 10, 20, { arc: 3.1 })],
  },
  {
    id: 'the_motor_pool', name: 'THE MOTOR POOL', tag: 'physics',
    question: 'Machines you can drive, ram and wreck. How does mass read on contact?',
    summons: [
      S({ what: 'vehicle', kind: 'musclecar' }, 1, 14, { team: 0 }),
      S({ what: 'vehicle', kind: 'racetruck' }, 1, 20, { team: 1 }),
      S({ what: 'prop' }, 6, 30, { arc: 2.4 }),
    ],
  },
  // ── crowd ──
  {
    id: 'the_tide_test', name: 'THE TIDE', tag: 'crowd',
    question: 'Thirty shamblers. Where does the frame budget bend, and where does the FIGHT bend?',
    summons: [S({ what: 'threat', zed: 'zombie' }, 30, 45, { arc: 3.1 })],
  },
  {
    id: 'the_brutes', name: 'THE BRUTES', tag: 'crowd',
    question: 'Four brutes. Is a big body a threat or just a bigger target?',
    summons: [S({ what: 'threat', zed: 'brute' }, 4, 26, { arc: 2.2 })],
  },
  {
    id: 'mixed_horde', name: 'THE MIXED HORDE', tag: 'crowd',
    question: 'Shamblers with runners hidden in them. Does the specials mix read at speed?',
    summons: [
      S({ what: 'threat', zed: 'zombie' }, 18, 38, { arc: 3.1 }),
      S({ what: 'threat', zed: 'sprinter' }, 3, 44, { arc: 2.6 }),
      S({ what: 'threat', zed: 'spitter' }, 2, 40, { arc: 2 }),
    ],
  },
  // ── armour & gods ──
  {
    id: 'the_armour_ladder', name: 'THE ARMOUR LADDER', tag: 'armour',
    question: 'Buggy, APC, tank, side by side. Does your weapon feel the difference?',
    summons: [
      S({ what: 'vehicle', kind: 'buggy' }, 1, 24, { arc: 0 }),
      S({ what: 'vehicle', kind: 'apc' }, 1, 30, { arc: 0 }),
      S({ what: 'vehicle', kind: 'tank' }, 1, 36, { arc: 0 }),
    ],
  },
  {
    id: 'the_god', name: 'A GOD WALKS', tag: 'gods',
    question: 'One Ascendant, no squad. What does a god actually do to a lone soldier?',
    summons: [S({ what: 'god', ascendant: 'ragebeast' }, 1, 30)],
  },
  {
    id: 'the_open_room', name: 'THE OPEN ROOM', tag: 'sandbox',
    question: 'Nothing but you and the floor — so what do you actually want to know?',
    summons: [],
  },
];

export function presetById(id: string): ThreatPreset | undefined {
  return THREAT_PRESETS.find((p) => p.id === id);
}

/** The tags, in the order the panel shows them. */
export const PRESET_TAGS: ThreatPreset['tag'][] = [
  'melee', 'gunplay', 'physics', 'crowd', 'armour', 'gods', 'movement', 'sandbox',
];

/** THE SUMMON SHELF — everything a player can drop into the room by hand. */
export const SUMMON_SHELF: { id: string; label: string; kind: SummonKind; tag: string }[] = [
  { id: 'dummy', label: 'Training Dummy', kind: { what: 'dummy' }, tag: 'practice' },
  { id: 'blocker', label: 'Sparring Partner (blocks)', kind: { what: 'blocker' }, tag: 'practice' },
  { id: 'mover', label: 'Moving Target', kind: { what: 'mover' }, tag: 'practice' },
  { id: 'prop', label: 'Knockable Prop', kind: { what: 'prop' }, tag: 'practice' },
  { id: 'prop_heavy', label: 'Heavy Prop', kind: { what: 'prop', heavy: true }, tag: 'practice' },
  { id: 'infantry', label: 'Infantry', kind: { what: 'class', classId: 'infantry' }, tag: 'soldier' },
  { id: 'heavy', label: 'Heavy Weapons', kind: { what: 'class', classId: 'heavy' }, tag: 'soldier' },
  { id: 'jump', label: 'Jump Trooper', kind: { what: 'class', classId: 'jump' }, tag: 'soldier' },
  { id: 'medic', label: 'Field Medic', kind: { what: 'class', classId: 'medic' }, tag: 'soldier' },
  { id: 'infiltrator', label: 'Infiltrator', kind: { what: 'class', classId: 'infiltrator' }, tag: 'soldier' },
  { id: 'zombie', label: 'Shambler', kind: { what: 'threat', zed: 'zombie' }, tag: 'threat' },
  { id: 'sprinter', label: 'Sprinter', kind: { what: 'threat', zed: 'sprinter' }, tag: 'threat' },
  { id: 'brute', label: 'Brute', kind: { what: 'threat', zed: 'brute' }, tag: 'threat' },
  { id: 'spitter', label: 'Spitter', kind: { what: 'threat', zed: 'spitter' }, tag: 'threat' },
  { id: 'stalker', label: 'Stalker', kind: { what: 'threat', zed: 'stalker' }, tag: 'threat' },
  { id: 'buggy', label: 'Scout Buggy', kind: { what: 'vehicle', kind: 'buggy' }, tag: 'machine' },
  { id: 'tank', label: 'Battle Tank', kind: { what: 'vehicle', kind: 'tank' }, tag: 'machine' },
  { id: 'musclecar', label: 'Broadside V8', kind: { what: 'vehicle', kind: 'musclecar' }, tag: 'machine' },
  { id: 'titan', label: 'Titan — Front', kind: { what: 'god', ascendant: 'titan' }, tag: 'god' },
  { id: 'firebrand', label: 'Firebrand — Front', kind: { what: 'god', ascendant: 'firebrand' }, tag: 'god' },
  { id: 'ragebeast', label: 'Ragebeast — hostile', kind: { what: 'god', ascendant: 'ragebeast' }, tag: 'god' },
  { id: 'plaguebearer', label: 'Plaguebearer — hostile', kind: { what: 'god', ascendant: 'plaguebearer' }, tag: 'god' },
];

/** Where a summon lands, given the player's position and facing. */
export function summonPositions(
  spec: SummonSpec, at: { x: number; z: number }, yaw: number,
): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  const arc = spec.arc ?? 1.4;
  for (let i = 0; i < spec.count; i++) {
    const t = spec.count === 1 ? 0 : (i / (spec.count - 1) - 0.5);
    const a = yaw + t * arc;
    // a little depth variance so a crowd isn't a firing line
    const r = spec.range * (1 + (i % 3) * 0.06);
    out.push({ x: at.x + Math.cos(a) * r, y: 0, z: at.z + Math.sin(a) * r });
  }
  return out;
}
