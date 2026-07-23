// ═══════════════════════════════════════════════════════════════════════════
// THE SECONDARY SKILLS — levelled THROUGH USE, and deliberately small.
//
// Canon (docs/THREE-GAMES-ONE-WAR.md §"Secondary skills"): twenty-two skills
// that *"level independently, THROUGH USE."* And the closing law that governs
// how hard they are allowed to bite:
//
//   *"Don't make the RPG stats the main progression. Knowledge, certifications,
//   rank, relationships, and reputation ARE the progression. Stats help — but
//   the most powerful feeling is earned responsibility."*
//
// So this is not an XP bar with a damage multiplier on the end. A skill is a
// record of what you have actually done, it moves slowly, it caps at a modest
// number, and the best band is worth about 12% — enough to feel, never enough
// to make a veteran unkillable or a rookie helpless.
//
// Pure data + pure functions. The world calls `practise()`; nothing here
// touches rng, time, or the DOM.
// ═══════════════════════════════════════════════════════════════════════════
import type { SkillId, Soldier, WeaponId } from './types';
import { WEAPONS } from './data';

export interface SkillDef {
  id: SkillId;
  name: string;
  /** One line: what practising it looks like. */
  earnedBy: string;
  /** One line: what holding it gets you. */
  gives: string;
}

/** The twenty-two, in the canon's own order. */
export const SKILLS: Record<SkillId, SkillDef> = {
  rifle: { id: 'rifle', name: 'Rifle', earnedBy: 'Rounds landed with a rifle.', gives: 'Tighter groups, faster recovery between shots.' },
  smg: { id: 'smg', name: 'SMG', earnedBy: 'Rounds landed with a submachine gun.', gives: 'Tighter groups at close range.' },
  lmg: { id: 'lmg', name: 'LMG', earnedBy: 'Rounds landed on a squad automatic.', gives: 'Less climb under sustained fire.' },
  sniper: { id: 'sniper', name: 'Sniper', earnedBy: 'Long shots that connected.', gives: 'Steadier hold, faster settle after a move.' },
  rocket: { id: 'rocket', name: 'Rocket', earnedBy: 'Launcher hits.', gives: 'Faster reloads on tubes.' },
  knife: { id: 'knife', name: 'Knife', earnedBy: 'Blade work that landed.', gives: 'Quicker strikes, a shorter recovery.' },
  pistol: { id: 'pistol', name: 'Pistol', earnedBy: 'Sidearm hits.', gives: 'Faster draw, tighter groups.' },
  tank_driver: { id: 'tank_driver', name: 'Tank Driver', earnedBy: 'Distance under tracks.', gives: 'Smoother throttle, less bogging.' },
  tank_gunner: { id: 'tank_gunner', name: 'Tank Gunner', earnedBy: 'Main-gun hits.', gives: 'Faster turret traverse.' },
  helicopter: { id: 'helicopter', name: 'Helicopter', earnedBy: 'Hours on rotors.', gives: 'Steadier hover, quicker spool.' },
  jet: { id: 'jet', name: 'Jet', earnedBy: 'Hours on fixed wing.', gives: 'Tighter turns at speed.' },
  boat: { id: 'boat', name: 'Boat', earnedBy: 'Distance on the water.', gives: 'Better bite in a turn.' },
  engineer: { id: 'engineer', name: 'Engineer', earnedBy: 'Things built and things breached.', gives: 'Faster building, faster drilling.' },
  medic: { id: 'medic', name: 'Medic', earnedBy: 'Men put back on their feet.', gives: 'Faster revives.' },
  dog_handler: { id: 'dog_handler', name: 'Dog Handler', earnedBy: 'Orders the dog actually carried out.', gives: 'The dog listens harder and holds longer.' },
  drone_pilot: { id: 'drone_pilot', name: 'Drone Pilot', earnedBy: 'Time on the remote stick.', gives: 'Stronger link, slower signal decay.' },
  radio_operator: { id: 'radio_operator', name: 'Radio Operator', earnedBy: 'Calls made and marks placed.', gives: 'Marks last longer.' },
  commander: { id: 'commander', name: 'Commander', earnedBy: 'Time holding a command seat.', gives: 'Squad holds its nerve better.' },
  navigator: { id: 'navigator', name: 'Navigator', earnedBy: 'Ground covered off the roads.', gives: 'A steadier compass in bad weather.' },
  mechanic: { id: 'mechanic', name: 'Mechanic', earnedBy: 'Repairs made.', gives: 'Faster field repair.' },
  explosives: { id: 'explosives', name: 'Explosives', earnedBy: 'Charges that went off where you meant them to.', gives: 'Quicker arming.' },
  scout: { id: 'scout', name: 'Scout', earnedBy: 'Enemies spotted before they spotted you.', gives: 'You see a little further.' },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

/**
 * THE BANDS. Practice is raw count; the band is what the game reads.
 *
 * The curve is deliberately front-loaded — the first band arrives quickly
 * enough to notice, and the last one takes a campaign. Nobody should grind for
 * a number they cannot feel, and nobody should max out in an afternoon.
 */
export const BANDS = [0, 25, 80, 200, 450, 900] as const;
export const BAND_NAMES = ['Untrained', 'Familiar', 'Practised', 'Skilled', 'Expert', 'Master'] as const;

/** 0..5. Five is a campaign's worth of doing one thing. */
export function skillLevel(practice: number): number {
  let lvl = 0;
  for (let i = 1; i < BANDS.length; i++) if (practice >= BANDS[i]) lvl = i;
  return lvl;
}

export const bandName = (practice: number): string => BAND_NAMES[skillLevel(practice)];

/** How far into the current band, 0..1 — the progress bar's fill. */
export function bandProgress(practice: number): number {
  const lvl = skillLevel(practice);
  if (lvl >= BANDS.length - 1) return 1;
  const from = BANDS[lvl], to = BANDS[lvl + 1];
  return Math.max(0, Math.min(1, (practice - from) / (to - from)));
}

/**
 * THE EDGE a skill buys, as a multiplier around 1.
 *
 * Master is +12%. That is the whole ceiling, on purpose: a skilled shooter
 * groups a little tighter, and that is the difference between a good soldier
 * and a great one — not between a mortal and a god. `strength` lets a caller
 * scale the same curve where a fuller effect is warranted (reload speed reads
 * more than spread, so it takes a bigger share).
 */
export function skillEdge(practice: number | undefined, strength = 1): number {
  return 1 + skillLevel(practice ?? 0) * 0.024 * strength;
}

/** The skill a weapon trains. Families map to the roster's own names. */
export function skillForWeapon(weapon: WeaponId): SkillId | undefined {
  const def = WEAPONS[weapon];
  const fam = def?.family ?? String(weapon).split('_')[0];
  switch (fam) {
    case 'rifle': case 'assault': case 'battle': return 'rifle';
    case 'smg': return 'smg';
    case 'lmg': case 'mg': return 'lmg';
    case 'sniper': case 'dmr': case 'railgun': return 'sniper';
    case 'rocket': case 'at': case 'launcher': return 'rocket';
    case 'melee': case 'knife': case 'axe': return 'knife';
    case 'pistol': case 'sidearm': return 'pistol';
    case 'grenade': case 'demo': return 'explosives';
    default: return undefined;
  }
}

/**
 * Practise a skill. Returns the new raw total.
 *
 * THE CAP IS THE POINT: practice stops at the last band, so a long match can
 * never run the number away. A skill is a record of competence, not a score.
 */
export function practise(s: Soldier, id: SkillId, amount = 1): number {
  if (!s.skill) s.skill = {};
  const next = Math.min(BANDS[BANDS.length - 1], (s.skill[id] ?? 0) + amount);
  s.skill[id] = next;
  return next;
}

/** Read a soldier's practice at one skill. */
export const practiceOf = (s: Soldier, id: SkillId): number => s.skill?.[id] ?? 0;

/** Everything this soldier has actually put time into, best first. */
export function skillSheet(s: Soldier): Array<{ id: SkillId; practice: number; level: number }> {
  return SKILL_IDS
    .map((id) => ({ id, practice: practiceOf(s, id), level: skillLevel(practiceOf(s, id)) }))
    .filter((r) => r.practice > 0)
    .sort((a, b) => b.practice - a.practice);
}
