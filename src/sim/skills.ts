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

/**
 * THE GUN TRAINS THE HAND — the id/family map for what practice a weapon earns.
 *
 * This used to be written against family names that mostly DO NOT EXIST. It
 * asked for `at`, `melee`, `sniper`, `assault`, `dmr`, `railgun`, `mg` — the
 * real arsenal ships `at_rocket`, `melee_weapon`, `slugger`, `carbine`, `hmg`
 * and eleven more it had never heard of. Worse, every hand-tuned CORE weapon
 * (`ar606`, `kuchler`, `pistol`, `knife`, every vehicle gun) carries NO family
 * at all, so the id-prefix fallback found nothing either.
 *
 * Measured before the fix: **255 of 316 weapons trained nothing** — including
 * the issue rifle every infantryman spawns holding. The one wired skill in the
 * game reached 19% of the guns in it.
 *
 * Two laws kept while fixing it:
 *   - the SkillId roster is unchanged (22, canon). Weapons map onto the skills
 *     that exist; no new skill was invented to make a family fit.
 *   - `family` itself is untouched, because family also picks the weapon's
 *     MODEL (`buildWeaponModel`) — retagging guns to fix a skill map would
 *     silently restyle the arsenal.
 */
const FAMILY_SKILL: Record<string, SkillId> = {
  // shoulder-fired general infantry guns
  rifle: 'rifle', assault: 'rifle', battle: 'rifle', carbine: 'rifle',
  // …and the yard's markers: a sport makes you better at the war (sports.ts)
  marker: 'rifle',
  // close and fast
  smg: 'smg', shotgun: 'smg', scatter: 'smg',
  // held down, fed by a belt
  lmg: 'lmg', mg: 'lmg', hmg: 'lmg',
  // precision — one round, placed
  sniper: 'sniper', dmr: 'sniper', railgun: 'sniper',
  slugger: 'sniper', laser: 'sniper', sonic: 'sniper',
  // tubes
  rocket: 'rocket', at: 'rocket', launcher: 'rocket',
  at_rocket: 'rocket', ap_rocket: 'rocket', mortar: 'rocket', artillery: 'rocket',
  // hands
  melee: 'knife', knife: 'knife', axe: 'knife', melee_weapon: 'knife',
  pistol: 'pistol', sidearm: 'pistol',
  // things that go off
  grenade: 'explosives', demo: 'explosives', special: 'explosives',
  flamethrower: 'explosives',
  // NOTE: `lsw` is deliberately absent. A god does not get better with
  // practice — its threat IS its card, and the threat table is measured
  // against that card (see the trainable gate at world.ts).
};

/**
 * The hand-tuned CORE weapons carry no `family`, so they are named here. The
 * VEHICLE guns are the interesting half: firing from a seat now trains THAT
 * SEAT's skill, which is what finally gives tank_gunner / helicopter / boat a
 * consumer instead of card copy.
 */
const CORE_SKILL: Record<string, SkillId> = {
  // infantry issue
  ar606: 'rifle', kuchler: 'rifle', caw: 'smg', rg2: 'sniper',
  pistol: 'pistol', knife: 'knife', axe: 'knife',
  gl: 'explosives', cl40: 'explosives', flamer: 'explosives', plasma: 'explosives',
  impulse: 'explosives', emp: 'explosives', demo_charge: 'explosives',
  smoke_nade: 'explosives', fire_nade: 'explosives', conc_nade: 'explosives',
  grav_nade: 'explosives', plasma_nade: 'explosives', time_bomb: 'explosives',
  paint_nade: 'explosives', tag_dart: 'pistol',
  ac_mk2: 'lmg', mml: 'rocket',
  // GROUND SEATS — the gunner's chair
  tank_cannon: 'tank_gunner', mech_autocannon: 'tank_gunner', mech_stomp: 'tank_gunner',
  apc_mg: 'tank_gunner', turret_mg: 'tank_gunner', buggy_mg: 'tank_gunner',
  // WATER
  boat_mg: 'boat', torpedo: 'boat', skiff_plasma: 'boat',
  // ROTARY — the airframes that hover
  heli_rockets: 'helicopter', heli_cannon: 'helicopter',
  vulture_rockets: 'helicopter', vulture_mg: 'helicopter',
  hydra_guided: 'helicopter', hydra_cannon: 'helicopter',
  // FIXED WING — the ones that go fast
  falcon_cannon: 'jet', warhawk_gun: 'jet', warhawk_pods: 'jet',
  specter_aam: 'jet', specter_cannon: 'jet', reaper_bombs: 'jet',
  aa_missile: 'jet', sam_missile: 'jet', bomb: 'jet', baby_nuke: 'jet',
  // the field tools train the trade that carries them
  repair: 'engineer', medibeam: 'medic',
  // beacons are the radio's job
  target_beacon: 'radio_operator', orbital_beacon: 'radio_operator',
};

/** The skill a weapon trains. Core ids win; then family; then nothing. */
export function skillForWeapon(weapon: WeaponId): SkillId | undefined {
  const core = CORE_SKILL[weapon as string];
  if (core) return core;
  const def = WEAPONS[weapon];
  const fam = def?.family ?? String(weapon).split('_')[0];
  return FAMILY_SKILL[fam];
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
