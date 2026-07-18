// ---------------------------------------------------------------------------
// LIVING SUPER WEAPONS — the entity, the threat table, and the officer's call.
//
// An LSW is a Soldier: same physics, same joints, same eight-name rig, same
// bullets kill it. What makes it an LSW is `ascendant` on the Soldier (rides
// the wire free — the snapshot spread law) plus a brain file per unit.
//
// THE LAWS (docs/ASCENDANTS.md):
//  · There are no heroes and villains. Two factions, one stable each.
//  · Threat buys HP, never immunity — every LSW dies to ordinary rifles.
//  · At most ONE LSW per faction on the field.
//  · The drop is telegraphed: the announcer calls it, then dread, then it
//    lands. Bigger threat = longer countdown.
//  · OFF in paintball / range / onboarding — the yard stays the yard.
//  · Nothing an LSW does takes control away from a human player.
// ---------------------------------------------------------------------------
import type { AscendantId, ModeId, Team } from './types';

export type ThreatLevel = 1 | 2 | 3 | 4;

/** Threat is the price, the telegraph, and the announcer's warning. HP is
 *  measured against the shipped baseline: a trooper is 100, a brute is 320,
 *  a rifleman lands ~45 dps in a real fight. See docs/ASCENDANTS.md §1.5. */
export const THREAT: Record<ThreatLevel, {
  name: string; hp: number; materiel: number; telegraph: number;
}> = {
  // HP MEASURED, not guessed (Robert: "test to determine threat level").
  // The harness probe showed a focused, self-healing 4-squad lands FAR more
  // than the paper ~180 dps — a 900-HP body died in 4-7s, which reads as a
  // fat trooper, not a STRONGPOINT. Tripled to hit the DESIGN targets the
  // doc promises: a T2 should be ~15s of a squad's honest focus, a T4 a
  // minute of the whole team. These are the corrected, live-verified numbers.
  1: { name: 'SKIRMISH', hp: 1200, materiel: 1, telegraph: 15 },
  2: { name: 'STRONGPOINT', hp: 2600, materiel: 2, telegraph: 20 },
  3: { name: 'SIEGE', hp: 5000, materiel: 4, telegraph: 30 },
  4: { name: 'EXTINCTION', hp: 9000, materiel: 7, telegraph: 40 },
};

export interface LswDef {
  id: AscendantId;
  name: string;
  /** 0 = United Front's stable, 1 = the Collective's. Not good vs evil. */
  faction: Team;
  threat: ThreatLevel;
  /** the announcer's radio net, per moment — TEXT shown map-wide while the
   *  matching ann_<id>_<moment> clip plays (tools/gen-lsw-vo.mjs) */
  lines: { inbound: string; landed: string; down: string; rampage: string };
  /** body scale — an LSW reads as bigger than a trooper at command zoom */
  scale: number;
  speed: number;
  /** signature palette (no purple — house law, test-swept) */
  color: number;
  /** the Q-key signature when a HUMAN pilots this body (§7) — the HUD hint */
  activeLabel: string;
  /** signature cooldown in seconds (charged only when the active actually fires) */
  activeCd: number;
}

/** The stable. Units land here as they ship; the roster doc is the spec. */
export const LSWS: Record<AscendantId, LswDef> = {
  firebrand: {
    id: 'firebrand', name: 'Firebrand', faction: 0, threat: 2,
    lines: {
      inbound: 'FIREBRAND INBOUND — CLEAR THE GRASS',
      landed: 'FIREBRAND ON THE FIELD — THE GROUND WILL BURN',
      down: 'FIREBRAND IS DOWN — THE FIRES GO WITH HIM',
      rampage: 'FIVE KILLS — FIREBRAND IS COOKING',
    },
    scale: 1.25, speed: 9, color: 0xff6a1a,
    activeLabel: 'CASH THE BOARD — every patch you painted erupts', activeCd: 8,
  },
  plaguebearer: {
    id: 'plaguebearer', name: 'Plaguebearer', faction: 1, threat: 2,
    lines: {
      inbound: 'PLAGUEBEARER INBOUND — SEAL YOUR MASKS',
      landed: 'PLAGUEBEARER WALKS THE FIELD — THE AIR IS NOT YOUR FRIEND',
      down: 'PLAGUEBEARER IS DOWN — VENTILATE AND ADVANCE',
      rampage: 'FIVE KILLS — THE OUTBREAK IS WINNING',
    },
    scale: 1.3, speed: 8, color: 0x7fa83c,
    activeLabel: 'QUARANTINE RING — a wall of plague around you', activeCd: 10,
  },
  frostbite: {
    id: 'frostbite', name: 'Frostbite', faction: 0, threat: 3,
    lines: {
      inbound: 'FROSTBITE INBOUND — DRESS FOR WINTER',
      landed: 'FROSTBITE DEPLOYED — THE COLD TAKES THE FIELD',
      down: 'FROSTBITE IS DOWN — THE THAW BEGINS',
      rampage: 'FIVE KILLS — FROSTBITE IS AN ICE AGE',
    },
    scale: 1.3, speed: 8.5, color: 0x8fd4e8, // pale ice blue (team 0 is amber; this is HER shade)
    activeLabel: 'THE ICE BLOCK — freeze the soldier you are aiming at', activeCd: 4,
  },
  ragebeast: {
    id: 'ragebeast', name: 'Ragebeast', faction: 1, threat: 3,
    lines: {
      inbound: 'RAGEBEAST INBOUND — DO NOT FEED IT',
      landed: 'RAGEBEAST IS LOOSE — GOOD LUCK',
      down: 'RAGEBEAST IS DOWN — STAND EASY',
      rampage: 'FIVE KILLS — STOP FEEDING THE BEAST',
    },
    scale: 1.45, speed: 8, color: 0xb23030, // blood-iron red, darkens as it rages
    activeLabel: 'GROUND SLAM — harder the more you bleed', activeCd: 6,
  },
  titan: {
    id: 'titan', name: 'Titan', faction: 0, threat: 3,
    lines: {
      inbound: 'TITAN INBOUND — MOVE THE ARMOR',
      landed: 'TITAN ON THE FIELD — NOTHING STAYS WHERE IT STANDS',
      down: 'TITAN IS DOWN — THE GROUND HOLDS STILL',
      rampage: 'FIVE KILLS — TITAN IS THROWING THE WHOLE FIELD',
    },
    scale: 1.6, speed: 6, color: 0x9a8466, // weathered stone-and-iron; the biggest, slowest silhouette
    activeLabel: 'SEISMIC HANDS — hurl what you grab; pound if empty', activeCd: 5,
  },
  voltstriker: {
    id: 'voltstriker', name: 'Volt Striker', faction: 0, threat: 1,
    lines: {
      inbound: 'VOLT STRIKER INBOUND — SPREAD OUT',
      landed: "VOLT STRIKER ON THE FIELD — DON'T BUNCH UP",
      down: 'VOLT STRIKER IS DOWN — THE AIR GOES QUIET',
      rampage: 'FIVE KILLS — VOLT STRIKER IS ARCING',
    },
    scale: 1.25, speed: 9, color: 0xf5f06a, // high-voltage yellow-white
    activeLabel: 'CHAIN LIGHTNING — arc through the crowd', activeCd: 3,
  },
  sniperhawk: {
    id: 'sniperhawk', name: 'Sniperhawk', faction: 0, threat: 1,
    lines: {
      inbound: 'SNIPERHAWK INBOUND — BREAK LINE OF SIGHT',
      landed: 'SNIPERHAWK PERCHED — WATCH THE LANES',
      down: 'SNIPERHAWK IS DOWN — THE LANES ARE YOURS',
      rampage: 'FIVE KILLS — SNIPERHAWK OWNS THE SIGHTLINES',
    },
    scale: 1.2, speed: 8, color: 0x5fb3c9, // scope steel-cyan
    activeLabel: 'PIERCING RAIL — one shot down the whole line', activeCd: 2.5,
  },
  barrier: {
    id: 'barrier', name: 'Barrier', faction: 0, threat: 1,
    lines: {
      inbound: 'BARRIER INBOUND — YOUR SHOTS MAY COME BACK',
      landed: 'BARRIER ON THE FIELD — MIND THE WALLS',
      down: 'BARRIER IS DOWN — THE LANES OPEN',
      rampage: "FIVE KILLS — BARRIER WON'T BREAK",
    },
    scale: 1.3, speed: 7, color: 0x3fd9a0, // emerald shield-energy
    activeLabel: 'ENERGY WALL — reflects fire for 2 seconds', activeCd: 5,
  },
  reactor: {
    id: 'reactor', name: 'Reactor', faction: 0, threat: 2,
    lines: {
      inbound: 'REACTOR INBOUND — KILL THE BATTERY FIRST',
      landed: 'REACTOR ON THE FIELD — THEIR CARRY JUST GOT STRONGER',
      down: 'REACTOR IS DOWN — THE OVERCHARGE FADES',
      rampage: 'FIVE KILLS — REACTOR IS FEEDING THE WHOLE LINE',
    },
    scale: 1.3, speed: 7, color: 0xffb020, // radiant reactor gold
    activeLabel: 'OVERCHARGE — supercharge an ally, or nova if alone', activeCd: 6,
  },
  oblivion: {
    id: 'oblivion', name: 'Oblivion', faction: 1, threat: 2,
    lines: {
      inbound: 'OBLIVION INBOUND — DO NOT CLUSTER',
      landed: 'OBLIVION LEVITATES THE FIELD — WATCH FOR THE PULL',
      down: 'OBLIVION IS DOWN — THE VOID CLOSES',
      rampage: 'FIVE KILLS — OBLIVION IS SWALLOWING THE MAP',
    },
    scale: 1.3, speed: 8, color: 0xe6ecf2, // void-white rim (black-and-white, never purple)
    activeLabel: 'BLACK HOLE — drag them in, then it bursts', activeCd: 7,
  },
  tremor: {
    id: 'tremor', name: 'Tremor', faction: 1, threat: 2,
    lines: {
      inbound: 'TREMOR INBOUND — KEEP OFF THE OPEN GROUND',
      landed: 'TREMOR SURFACES — WATCH THE SOIL',
      down: 'TREMOR IS DOWN — THE GROUND IS STILL',
      rampage: 'FIVE KILLS — TREMOR IS AN EARTHQUAKE',
    },
    scale: 1.5, speed: 6, color: 0xa05a2a, // rusty earth-and-clay
    activeLabel: 'EARTHQUAKE STOMP — stagger the ground around you', activeCd: 5,
  },
  magnetar: {
    id: 'magnetar', name: 'Magnetar', faction: 1, threat: 2,
    lines: {
      inbound: "MAGNETAR INBOUND — YOUR BULLETS WON'T LAND",
      landed: 'MAGNETAR ON THE FIELD — CLOSE THE DISTANCE',
      down: 'MAGNETAR IS DOWN — OPEN FIRE',
      rampage: 'FIVE KILLS — MAGNETAR EATS EVERY ROUND',
    },
    scale: 1.3, speed: 7, color: 0x707886, // gunmetal-steel, a magnetic sheen
    activeLabel: 'MAGNETIC PULSE — jam their guns, stall their armor', activeCd: 6,
  },
  wraith: {
    id: 'wraith', name: 'Wraith', faction: 1, threat: 2,
    lines: {
      inbound: 'WRAITH INBOUND — EMPTY YOUR VEHICLES',
      landed: 'WRAITH ON THE FIELD — YOUR MACHINES ARE HIS',
      down: 'WRAITH IS DOWN — RECLAIM YOUR HARDWARE',
      rampage: 'FIVE KILLS — WRAITH IS WEARING YOUR ARMY',
    },
    scale: 1.3, speed: 8, color: 0x8fd0b0, // spectral ghost-green
    activeLabel: 'POSSESS — seize a turret, stall the armor, heal on the take', activeCd: 7,
  },
  eclipse: {
    id: 'eclipse', name: 'Eclipse', faction: 1, threat: 2,
    lines: {
      inbound: 'ECLIPSE INBOUND — TRUST YOUR EARS',
      landed: 'ECLIPSE ON THE FIELD — THE DARK IS HERS',
      down: 'ECLIPSE IS DOWN — THE LIGHT RETURNS',
      rampage: 'FIVE KILLS — ECLIPSE HAS SWALLOWED THE LIGHT',
    },
    scale: 1.35, speed: 8, color: 0x3d5566, // deep shadow-slate
    activeLabel: 'DARKNESS DOME — vision dies inside', activeCd: 8,
  },
  dominator: {
    id: 'dominator', name: 'Dominator', faction: 1, threat: 2,
    lines: {
      inbound: 'DOMINATOR INBOUND — SCATTER, DO NOT BUNCH',
      landed: 'DOMINATOR ON THE FIELD — YOUR FORMATION IS HIS WEAPON',
      down: 'DOMINATOR IS DOWN — THE THREADS SNAP',
      rampage: 'FIVE KILLS — DOMINATOR PULLS EVERY STRING',
    },
    scale: 1.4, speed: 7, color: 0xd83a5a, // commanding crimson-rose (no purple)
    activeLabel: 'PSYCHIC LINK — chain them; hurt one, hurt all', activeCd: 8,
  },
  riptide: {
    id: 'riptide', name: 'Riptide', faction: 0, threat: 2,
    lines: {
      inbound: 'RIPTIDE INBOUND — HIGH GROUND, NOW',
      landed: 'RIPTIDE ON THE FIELD — THE TIDE FIGHTS FOR US',
      down: 'RIPTIDE IS DOWN — THE WATER STILLS',
      rampage: 'FIVE KILLS — RIPTIDE IS DROWNING THE FIELD',
    },
    scale: 1.3, speed: 8, color: 0x2fa8c8, // sea-teal, whitecap trim
    activeLabel: 'THE WAVE — shove the line back and douse every flame', activeCd: 6,
  },
  gravwarden: {
    id: 'gravwarden', name: 'Gravity Warden', faction: 0, threat: 3,
    lines: {
      inbound: 'GRAVITY WARDEN INBOUND — MIND YOUR FOOTING',
      landed: 'GRAVITY WARDEN ON THE FIELD — DOWN IS A SUGGESTION NOW',
      down: 'GRAVITY WARDEN IS DOWN — THE WEIGHT RETURNS',
      rampage: 'FIVE KILLS — GRAVITY WARDEN OWNS THE SKY AND THE FLOOR',
    },
    scale: 1.35, speed: 7, color: 0x9fc4e8, // pale updraft blue (not purple)
    activeLabel: 'REVERSE GRAVITY — float them, then drop them staggered', activeCd: 9,
  },
  chronos: {
    id: 'chronos', name: 'Chronos', faction: 1, threat: 3,
    lines: {
      inbound: 'CHRONOS INBOUND — WATCH YOUR CLOCKS',
      landed: 'CHRONOS ON THE FIELD — TIME IS HIS NOW',
      down: 'CHRONOS IS DOWN — THE SECONDS RUN TRUE AGAIN',
      rampage: 'FIVE KILLS — CHRONOS IS SPENDING YOUR TIME',
    },
    scale: 1.3, speed: 7.5, color: 0xc8a24b, // clockwork brass
    activeLabel: 'TIME BUBBLE — the world crawls; you do not', activeCd: 9,
  },
  venatrix: {
    id: 'venatrix', name: 'Venatrix', faction: 1, threat: 1,
    lines: {
      inbound: 'VENATRIX INBOUND — WATCH WHERE YOU STEP',
      landed: 'VENATRIX ON THE FIELD — THE GROUND IS BAITED',
      down: 'VENATRIX IS DOWN — SWEEP FOR HER TRAPS',
      rampage: 'FIVE KILLS — VENATRIX HAS A FULL TROPHY WALL',
    },
    scale: 1.2, speed: 9, color: 0x8f9e3a, // huntress olive-brass
    activeLabel: 'HARPOON — reel in the one you are aiming at', activeCd: 7,
  },
  vanguard: {
    id: 'vanguard', name: 'Vanguard', faction: 0, threat: 2,
    lines: {
      inbound: 'VANGUARD INBOUND — THE DOOR IS ABOUT TO OPEN',
      landed: 'VANGUARD ON THE FIELD — FOLLOW THE SHIELD',
      down: 'VANGUARD IS DOWN — THE LINE IS YOURS TO HOLD',
      rampage: 'FIVE KILLS — VANGUARD IS THE DOOR NOW',
    },
    scale: 1.35, speed: 7.5, color: 0xc9b458, // breacher brass-and-drab
    activeLabel: 'SHIELD BASH — charge, stun, and shove the front', activeCd: 6,
  },
  pyroclasm: {
    id: 'pyroclasm', name: 'Pyroclasm', faction: 1, threat: 2,
    lines: {
      inbound: 'PYROCLASM INBOUND — THE FLOOR WILL NOT BE YOURS',
      landed: 'PYROCLASM ON THE FIELD — MIND THE POOLS',
      down: 'PYROCLASM IS DOWN — LET IT COOL',
      rampage: 'FIVE KILLS — PYROCLASM IS PAVING THE MAP',
    },
    scale: 1.35, speed: 7, color: 0xff8c2a, // magma orange
    activeLabel: 'MAGMA VOLLEY — three rocks, three pools', activeCd: 7,
  },
  voidwalker: {
    id: 'voidwalker', name: 'Voidwalker', faction: 1, threat: 1,
    lines: {
      inbound: 'VOIDWALKER INBOUND — CHECK YOUR SHADOWS',
      landed: 'VOIDWALKER ON THE FIELD — HE IS ALREADY BEHIND SOMEONE',
      down: 'VOIDWALKER IS DOWN — THE SHADOWS EMPTY',
      rampage: 'FIVE KILLS — VOIDWALKER IS EVERYWHERE AT ONCE',
    },
    scale: 1.2, speed: 9.5, color: 0x2a2f38, // void slate — black, never purple
    activeLabel: 'BLINK-STRIKE — vanish, arrive, cut; the shadow stays', activeCd: 5,
  },
  crimson: {
    id: 'crimson', name: 'Crimson', faction: 1, threat: 2,
    lines: {
      inbound: 'CRIMSON INBOUND — POLICE YOUR DEAD',
      landed: 'CRIMSON ON THE FIELD — EVERY LOSS FEEDS HIM',
      down: 'CRIMSON IS DOWN — THE POOLS GO STILL',
      rampage: 'FIVE KILLS — CRIMSON DRINKS THE WHOLE FRONT',
    },
    scale: 1.3, speed: 7.5, color: 0xa11d2e, // arterial red
    activeLabel: 'BLOOD RITE — drink a pool, raise the brute', activeCd: 8,
  },
  mirage: {
    id: 'mirage', name: 'Mirage', faction: 0, threat: 1,
    lines: {
      inbound: 'MIRAGE INBOUND — COUNT YOUR TARGETS TWICE',
      landed: 'MIRAGE ON THE FIELD — ONE OF THEM IS REAL',
      down: 'MIRAGE IS DOWN — THE REAL ONE, THIS TIME',
      rampage: 'FIVE KILLS — MIRAGE IS AN ARMY OF ONE',
    },
    scale: 1.2, speed: 9, color: 0xd8b84a, // heat-shimmer gold
    activeLabel: 'THE SWAP — trade places with a decoy', activeCd: 6,
  },
  blitz: {
    id: 'blitz', name: 'Blitz', faction: 0, threat: 1,
    lines: {
      inbound: 'BLITZ INBOUND — HE IS ALREADY MOVING',
      landed: 'BLITZ ON THE FIELD — DO NOT LET HIM CHAIN',
      down: 'BLITZ IS DOWN — CAUGHT BETWEEN DASHES',
      rampage: 'FIVE KILLS — BLITZ HAS NOT STOPPED ONCE',
    },
    scale: 1.2, speed: 10, color: 0xe8e2d0, // afterimage white
    activeLabel: 'DASH-STRIKE — a kill refunds the dash', activeCd: 5,
  },
  shadowstep: {
    id: 'shadowstep', name: 'Shadowstep', faction: 0, threat: 1,
    lines: {
      inbound: 'SHADOWSTEP INBOUND — GUARD YOUR BACKS',
      landed: 'SHADOWSTEP ON THE FIELD — DO NOT CHASE HIM',
      down: 'SHADOWSTEP IS DOWN — CHECK IT TWICE',
      rampage: 'FIVE KILLS — SHADOWSTEP IS EVERYWHERE YOU ARE NOT',
    },
    scale: 1.2, speed: 9.5, color: 0x4a5a4a, // gunmetal moss — a quiet knife
    activeLabel: 'BLINK-STAB — arrive behind them; the mine stays', activeCd: 5,
  },
  specter: {
    id: 'specter', name: 'Specter', faction: 1, threat: 1,
    lines: {
      inbound: 'SPECTER INBOUND — COUNT THE SHADOWS',
      landed: 'SPECTER ON THE FIELD — THEY ALL WALK LIKE HIM',
      down: 'SPECTER IS DOWN — THE MIRRORS CRACK',
      rampage: 'FIVE KILLS — SPECTER IS A CROWD',
    },
    scale: 1.25, speed: 8.5, color: 0xbcc7cf, // mirror-fog silver
    activeLabel: 'DETONATE — every image goes at once', activeCd: 6,
  },
  pulse: {
    id: 'pulse', name: 'Pulse', faction: 0, threat: 2,
    lines: {
      inbound: 'PULSE INBOUND — WALLS WILL NOT SAVE YOU',
      landed: 'PULSE ON THE FIELD — HE HEARS EVERYTHING',
      down: 'PULSE IS DOWN — THE AIR STOPS RINGING',
      rampage: 'FIVE KILLS — PULSE HAS THE WHOLE MAP TAGGED',
    },
    scale: 1.3, speed: 8, color: 0x5adfd0, // sonar teal
    activeLabel: 'SONIC WAVE — stagger and tag them through the walls', activeCd: 7,
  },
  venom: {
    id: 'venom', name: 'Venom', faction: 0, threat: 2,
    lines: {
      inbound: 'VENOM INBOUND — CHECK YOUR SEALS',
      landed: 'VENOM ON THE FIELD — THE AIR HAS TEETH',
      down: 'VENOM IS DOWN — LET IT DISPERSE',
      rampage: 'FIVE KILLS — VENOM OWNS EVERY BREATH',
    },
    scale: 1.25, speed: 8.5, color: 0x7fd43a, // toxin green
    activeLabel: 'ACID GLOB — dissolve the plate whole', activeCd: 7,
  },
  nightmare: {
    id: 'nightmare', name: 'Nightmare', faction: 1, threat: 2,
    lines: {
      inbound: 'NIGHTMARE INBOUND — TRUST NOTHING RED',
      landed: 'NIGHTMARE ON THE FIELD — YOUR MAP IS LYING',
      down: 'NIGHTMARE IS DOWN — THE CONTACTS CLEAR',
      rampage: 'FIVE KILLS — NIGHTMARE IS IN EVERY HEAD',
    },
    scale: 1.25, speed: 8.5, color: 0x1e2430, // a darkness with edges
    activeLabel: 'THE BLIND — put one set of eyes out', activeCd: 8,
  },
  reaper: {
    id: 'reaper', name: 'Reaper', faction: 1, threat: 2,
    lines: {
      inbound: 'REAPER INBOUND — NOBODY WANDERS ALONE',
      landed: 'REAPER ON THE FIELD — SOMEBODY IS ALREADY MARKED',
      down: 'REAPER IS DOWN — THE HUNT IS OFF',
      rampage: 'FIVE KILLS — THE REAPER KEEPS HIS LEDGER',
    },
    scale: 1.35, speed: 8, color: 0x8a8f98, // scythe-steel grey
    activeLabel: 'THE CHAIN — reel the first body into the scythe', activeCd: 6,
  },
  crusher: {
    id: 'crusher', name: 'Crusher', faction: 0, threat: 2,
    lines: {
      inbound: 'CRUSHER INBOUND — YOUR COVER IS TEMPORARY',
      landed: 'CRUSHER ON THE FIELD — THE MAP IS NEGOTIABLE',
      down: 'CRUSHER IS DOWN — THE GROUND KEEPS ITS SHAPE',
      rampage: 'FIVE KILLS — CRUSHER IS REDRAWING THE FRONT',
    },
    scale: 1.45, speed: 7, color: 0xb0783a, // quarry ochre
    activeLabel: 'THE CHARGE — smash through cover; walls win', activeCd: 6,
  },
  steelweaver: {
    id: 'steelweaver', name: 'Steel Weaver', faction: 0, threat: 2,
    lines: {
      inbound: 'STEEL WEAVER INBOUND — COUNT YOUR WALLS',
      landed: 'STEEL WEAVER ON THE FIELD — THE MAP IS HIS ARMORY',
      down: 'STEEL WEAVER IS DOWN — DROP THE PANELS',
      rampage: 'FIVE KILLS — STEEL WEAVER WEARS THE REFINERY',
    },
    scale: 1.4, speed: 6.5, color: 0x9aa4b0, // worked steel
    activeLabel: 'RIP A PANEL — the wall becomes your plate', activeCd: 8,
  },
  overload: {
    id: 'overload', name: 'Overload', faction: 1, threat: 2,
    lines: {
      inbound: 'OVERLOAD INBOUND — STEP OFF THE PLATE',
      landed: 'OVERLOAD ON THE FIELD — EVERY WIRE IS A DOOR',
      down: 'OVERLOAD IS DOWN — THE CIRCUIT IS COLD',
      rampage: 'FIVE KILLS — OVERLOAD RUNS THE WHOLE GRID',
    },
    scale: 1.25, speed: 8.5, color: 0xffd23a, // live-wire amber
    activeLabel: 'BECOME CURRENT — ride the metal, emerge anywhere', activeCd: 10,
  },
};

/** THE SPOKEN SCRIPT — subtitle text per voice slot, tag-stripped mirrors of
 *  tools/lsw-vo-script.mjs (the recording script with direction). Positional:
 *  the HUD shows a line only when the local player is inside the voice's
 *  earshot — you read what you could hear. */
export type VoMoment = 'arrive' | 'kill3' | 'ability' | 'low' | 'death';
export const VO_LINES: Record<string, { who: AscendantId; line: string }> = {
  vo_firebrand_arrive: { who: 'firebrand', line: 'Somebody call for a light?' },
  vo_firebrand_kill3: { who: 'firebrand', line: "Three! The fire's just getting to know everybody." },
  vo_firebrand_ability: { who: 'firebrand', line: 'All that paint I put down? It was a promise.' },
  vo_firebrand_low: { who: 'firebrand', line: 'Burning low... burning MEAN.' },
  vo_firebrand_death: { who: 'firebrand', line: 'Huh. Finally... some shade.' },
  vo_plaguebearer_arrive: { who: 'plaguebearer', line: 'Deep breath, everyone.' },
  vo_plaguebearer_kill3: { who: 'plaguebearer', line: 'Three subjects. The data is... agreeable.' },
  vo_plaguebearer_ability: { who: 'plaguebearer', line: 'The ring is for your protection.' },
  vo_plaguebearer_low: { who: 'plaguebearer', line: 'Fascinating. It spreads to me too.' },
  vo_plaguebearer_death: { who: 'plaguebearer', line: 'I was... already gone.' },
  vo_frostbite_arrive: { who: 'frostbite', line: "Winter's here." },
  vo_frostbite_kill3: { who: 'frostbite', line: 'Three. Cold count.' },
  vo_frostbite_ability: { who: 'frostbite', line: 'Hold still.' },
  vo_frostbite_low: { who: 'frostbite', line: 'Cracks... in the ice.' },
  vo_frostbite_death: { who: 'frostbite', line: 'Thaw me... never.' },
  vo_ragebeast_arrive: { who: 'ragebeast', line: 'OUT. FINALLY OUT.' },
  vo_ragebeast_kill3: { who: 'ragebeast', line: 'THREE MORE. WHO ELSE.' },
  vo_ragebeast_ability: { who: 'ragebeast', line: 'GROUND. BREAKS.' },
  vo_ragebeast_low: { who: 'ragebeast', line: 'HURT ME. GOOD. MORE.' },
  vo_ragebeast_death: { who: 'ragebeast', line: 'Still... hungry...' },
  vo_titan_arrive: { who: 'titan', line: "Ground's mine now." },
  vo_titan_kill3: { who: 'titan', line: 'Three. Small ones.' },
  vo_titan_ability: { who: 'titan', line: 'Up you go.' },
  vo_titan_low: { who: 'titan', line: 'Chipping... at a mountain.' },
  vo_titan_death: { who: 'titan', line: 'Back... to stone.' },
  vo_voltstriker_arrive: { who: 'voltstriker', line: "Everybody's grounded now." },
  vo_voltstriker_kill3: { who: 'voltstriker', line: 'Three on one arc. Tidy.' },
  vo_voltstriker_ability: { who: 'voltstriker', line: 'Hold hands!' },
  vo_voltstriker_low: { who: 'voltstriker', line: 'Losing... current.' },
  vo_voltstriker_death: { who: 'voltstriker', line: 'Ground... fault.' },
  vo_sniperhawk_arrive: { who: 'sniperhawk', line: 'Found my perch.' },
  vo_sniperhawk_kill3: { who: 'sniperhawk', line: 'Three. All center mass.' },
  vo_sniperhawk_ability: { who: 'sniperhawk', line: "Line 'em up." },
  vo_sniperhawk_low: { who: 'sniperhawk', line: 'Position... compromised.' },
  vo_sniperhawk_death: { who: 'sniperhawk', line: "Should've... moved." },
  vo_barrier_arrive: { who: 'barrier', line: 'This far. No further.' },
  vo_barrier_kill3: { who: 'barrier', line: 'Three broke on the wall.' },
  vo_barrier_ability: { who: 'barrier', line: 'Send it back.' },
  vo_barrier_low: { who: 'barrier', line: 'The wall... is cracking.' },
  vo_barrier_death: { who: 'barrier', line: 'Line... held.' },
  vo_reactor_arrive: { who: 'reactor', line: 'Who needs a boost?' },
  vo_reactor_kill3: { who: 'reactor', line: "Three — and I'm just the battery." },
  vo_reactor_ability: { who: 'reactor', line: "Take everything I've got." },
  vo_reactor_low: { who: 'reactor', line: 'Core... destabilizing.' },
  vo_reactor_death: { who: 'reactor', line: 'Going... critical.' },
  vo_oblivion_arrive: { who: 'oblivion', line: 'All of it. Ends.' },
  vo_oblivion_kill3: { who: 'oblivion', line: 'Three. Erased.' },
  vo_oblivion_ability: { who: 'oblivion', line: 'Fall in.' },
  vo_oblivion_low: { who: 'oblivion', line: 'Even I... unravel.' },
  vo_oblivion_death: { who: 'oblivion', line: 'Nothing... lasts.' },
  vo_tremor_arrive: { who: 'tremor', line: 'The ground answers to me.' },
  vo_tremor_kill3: { who: 'tremor', line: 'Three. Buried.' },
  vo_tremor_ability: { who: 'tremor', line: 'Feel that?' },
  vo_tremor_low: { who: 'tremor', line: 'Cracks... running deep.' },
  vo_tremor_death: { who: 'tremor', line: 'Back... underground.' },
  vo_magnetar_arrive: { who: 'magnetar', line: 'Guns? How quaint.' },
  vo_magnetar_kill3: { who: 'magnetar', line: 'Three. Their bullets built my armor.' },
  vo_magnetar_ability: { who: 'magnetar', line: 'Jammed.' },
  vo_magnetar_low: { who: 'magnetar', line: 'Field... collapsing.' },
  vo_magnetar_death: { who: 'magnetar', line: 'De... magnetized.' },
  vo_wraith_arrive: { who: 'wraith', line: "What's yours is mine." },
  vo_wraith_kill3: { who: 'wraith', line: 'Three. Their own guns did it.' },
  vo_wraith_ability: { who: 'wraith', line: 'Come to me.' },
  vo_wraith_low: { who: 'wraith', line: 'Fading... need a host.' },
  vo_wraith_death: { who: 'wraith', line: "You can't kill... a ghost." },
  vo_eclipse_arrive: { who: 'eclipse', line: 'Let there be dark.' },
  vo_eclipse_kill3: { who: 'eclipse', line: 'Three, in the black.' },
  vo_eclipse_ability: { who: 'eclipse', line: 'Close your eyes.' },
  vo_eclipse_low: { who: 'eclipse', line: 'The light... finds me.' },
  vo_eclipse_death: { who: 'eclipse', line: 'Dawn... already?' },
  vo_dominator_arrive: { who: 'dominator', line: 'You belong to me now.' },
  vo_dominator_kill3: { who: 'dominator', line: 'Three puppets. Cut.' },
  vo_dominator_ability: { who: 'dominator', line: 'Feel each other.' },
  vo_dominator_low: { who: 'dominator', line: 'My grip... slips.' },
  vo_dominator_death: { who: 'dominator', line: 'You were... mine.' },
  vo_riptide_arrive: { who: 'riptide', line: 'Tide’s coming in.' },
  vo_riptide_kill3: { who: 'riptide', line: 'Three, out with the tide.' },
  vo_riptide_ability: { who: 'riptide', line: 'Everybody out of the pool.' },
  vo_riptide_low: { who: 'riptide', line: 'Running... dry.' },
  vo_riptide_death: { who: 'riptide', line: 'The sea... takes me back.' },
  vo_gravwarden_arrive: { who: 'gravwarden', line: 'Weight is a privilege.' },
  vo_gravwarden_kill3: { who: 'gravwarden', line: 'Three came down wrong.' },
  vo_gravwarden_ability: { who: 'gravwarden', line: 'Up.' },
  vo_gravwarden_low: { who: 'gravwarden', line: 'Getting... heavy.' },
  vo_gravwarden_death: { who: 'gravwarden', line: 'Falling... at last.' },
  vo_chronos_arrive: { who: 'chronos', line: 'Right on time. I always am.' },
  vo_chronos_kill3: { who: 'chronos', line: 'Three, ahead of schedule.' },
  vo_chronos_ability: { who: 'chronos', line: 'Take your time. I insist.' },
  vo_chronos_low: { who: 'chronos', line: 'Borrowed time... spent.' },
  vo_chronos_death: { who: 'chronos', line: 'Out of... seconds.' },
  vo_venatrix_arrive: { who: 'venatrix', line: 'Step lightly, little ones.' },
  vo_venatrix_kill3: { who: 'venatrix', line: 'Three for the wall.' },
  vo_venatrix_ability: { who: 'venatrix', line: 'Come here.' },
  vo_venatrix_low: { who: 'venatrix', line: 'Caught... in my own season.' },
  vo_venatrix_death: { who: 'venatrix', line: 'A fair... hunt.' },
  vo_vanguard_arrive: { who: 'vanguard', line: 'Form up behind me.' },
  vo_vanguard_kill3: { who: 'vanguard', line: 'Three broke on the shield.' },
  vo_vanguard_ability: { who: 'vanguard', line: 'MAKE A HOLE.' },
  vo_vanguard_low: { who: 'vanguard', line: 'Shield arm... failing.' },
  vo_vanguard_death: { who: 'vanguard', line: 'Hold... the line...' },
  vo_pyroclasm_arrive: { who: 'pyroclasm', line: 'The ground remembers fire.' },
  vo_pyroclasm_kill3: { who: 'pyroclasm', line: 'Three, down to ash.' },
  vo_pyroclasm_ability: { who: 'pyroclasm', line: 'Let it pour.' },
  vo_pyroclasm_low: { who: 'pyroclasm', line: 'Cracking... it wants OUT.' },
  vo_pyroclasm_death: { who: 'pyroclasm', line: 'Cooling... at last.' },
  vo_voidwalker_arrive: { who: 'voidwalker', line: 'Blink and miss me.' },
  vo_voidwalker_kill3: { who: 'voidwalker', line: 'Three never saw the third.' },
  vo_voidwalker_ability: { who: 'voidwalker', line: 'Behind you.' },
  vo_voidwalker_low: { who: 'voidwalker', line: 'Nowhere... left to blink.' },
  vo_voidwalker_death: { who: 'voidwalker', line: 'Caught... standing still.' },
  vo_crimson_arrive: { who: 'crimson', line: 'The field always provides.' },
  vo_crimson_kill3: { who: 'crimson', line: 'Three courses. Generous.' },
  vo_crimson_ability: { who: 'crimson', line: 'Rise. You owe me that.' },
  vo_crimson_low: { who: 'crimson', line: 'Running... thin.' },
  vo_crimson_death: { who: 'crimson', line: 'Spilled... at last.' },
  vo_mirage_arrive: { who: 'mirage', line: 'Which one of me heard that?' },
  vo_mirage_kill3: { who: 'mirage', line: 'Three! They keep shooting the wrong me.' },
  vo_mirage_ability: { who: 'mirage', line: 'Over here. No — here.' },
  vo_mirage_low: { who: 'mirage', line: 'They found... the right one.' },
  vo_mirage_death: { who: 'mirage', line: 'This one... was real.' },
  vo_blitz_arrive: { who: 'blitz', line: 'Try to keep up.' },
  vo_blitz_kill3: { who: 'blitz', line: 'Three — and the meter is still running.' },
  vo_blitz_ability: { who: 'blitz', line: 'Too slow. Always too slow.' },
  vo_blitz_low: { who: 'blitz', line: 'Legs... betraying me.' },
  vo_blitz_death: { who: 'blitz', line: 'Finally... standing... still.' },
  vo_shadowstep_arrive: { who: 'shadowstep', line: 'You will not hear the second step.' },
  vo_shadowstep_kill3: { who: 'shadowstep', line: 'Three. None saw the knife.' },
  vo_shadowstep_ability: { who: 'shadowstep', line: 'Behind you. Above the mine.' },
  vo_shadowstep_low: { who: 'shadowstep', line: 'Too many... eyes.' },
  vo_shadowstep_death: { who: 'shadowstep', line: 'Seen... at last.' },
  vo_specter_arrive: { who: 'specter', line: 'Which of us said that?' },
  vo_specter_kill3: { who: 'specter', line: 'Three. We all take credit.' },
  vo_specter_ability: { who: 'specter', line: 'All of me, at once.' },
  vo_specter_low: { who: 'specter', line: 'The mirrors... are emptying.' },
  vo_specter_death: { who: 'specter', line: 'Alone... after all.' },
  vo_pulse_arrive: { who: 'pulse', line: 'I can hear your heartbeat.' },
  vo_pulse_kill3: { who: 'pulse', line: 'Three. Heard them all coming.' },
  vo_pulse_ability: { who: 'pulse', line: 'SPEAK UP.' },
  vo_pulse_low: { who: 'pulse', line: 'Ringing... in my own ears now.' },
  vo_pulse_death: { who: 'pulse', line: 'So this... is silence.' },
  vo_venom_arrive: { who: 'venom', line: 'Breathe deep. Or better, do not.' },
  vo_venom_kill3: { who: 'venom', line: 'Three. The dose was correct.' },
  vo_venom_ability: { who: 'venom', line: 'Your armor is soup now.' },
  vo_venom_low: { who: 'venom', line: 'Tasting... my own work.' },
  vo_venom_death: { who: 'venom', line: 'Everything... dissolves.' },
  vo_nightmare_arrive: { who: 'nightmare', line: 'Your map is mine now.' },
  vo_nightmare_kill3: { who: 'nightmare', line: 'Three chased the wrong ghost.' },
  vo_nightmare_ability: { who: 'nightmare', line: 'Lights out.' },
  vo_nightmare_low: { who: 'nightmare', line: 'They see... through me.' },
  vo_nightmare_death: { who: 'nightmare', line: 'Wake up... all of you.' },
  vo_reaper_arrive: { who: 'reaper', line: 'One of you is already mine.' },
  vo_reaper_kill3: { who: 'reaper', line: 'Three names, crossed off.' },
  vo_reaper_ability: { who: 'reaper', line: 'Come to the blade.' },
  vo_reaper_low: { who: 'reaper', line: 'My own... name... in the ledger.' },
  vo_reaper_death: { who: 'reaper', line: 'Harvested... fair enough.' },
  vo_crusher_arrive: { who: 'crusher', line: 'Walls are a rumor too.' },
  vo_crusher_kill3: { who: 'crusher', line: 'Three. And their cover.' },
  vo_crusher_ability: { who: 'crusher', line: 'COMING THROUGH.' },
  vo_crusher_low: { who: 'crusher', line: 'Cracking... like the rest.' },
  vo_crusher_death: { who: 'crusher', line: 'The map... wins.' },
  vo_steelweaver_arrive: { who: 'steelweaver', line: 'Your walls fit me better.' },
  vo_steelweaver_kill3: { who: 'steelweaver', line: 'Three dents in the new plate.' },
  vo_steelweaver_ability: { who: 'steelweaver', line: 'I will take that wall.' },
  vo_steelweaver_low: { who: 'steelweaver', line: 'Plate... peeling.' },
  vo_steelweaver_death: { who: 'steelweaver', line: 'Scrap... again.' },
  vo_overload_arrive: { who: 'overload', line: 'Every wire is a door.' },
  vo_overload_kill3: { who: 'overload', line: 'Three, grounded for good.' },
  vo_overload_ability: { who: 'overload', line: 'See you at the other socket.' },
  vo_overload_low: { who: 'overload', line: 'Voltage... dropping.' },
  vo_overload_death: { who: 'overload', line: 'Circuit... broken.' },
};
export const voSlot = (id: AscendantId, moment: VoMoment) => `vo_${id}_${moment}`;
export const annSlot = (id: AscendantId, moment: 'inbound' | 'landed' | 'down' | 'rampage') => `ann_${id}_${moment}`;

/** A faction's stable, in call order (V picks [0], ⇧V picks [1]). */
export function lswsForTeam(team: Team): AscendantId[] {
  return (Object.values(LSWS) as LswDef[]).filter((d) => d.faction === team).map((d) => d.id);
}

/** THE ICE BLOCK constants (§21.6). Encase forms over ~0.4s; the ice fully
 *  holds `ICE_HOLD` seconds; holding still drains slowly, struggling breaks
 *  out in ~STRUGGLE_SECS but costs STRUGGLE_HP. Shared by Frostbite (and
 *  Venatrix when she ships). */
export const ICE_HOLD = 5;          // seconds the block stands if nobody frees you
export const ICE_HOLD_DRAIN = 2.5;  // hp/s while you HOLD STILL — slow; you can outlast it
export const STRUGGLE_SECS = 4;     // mashing input this long shatters the ice yourself
export const STRUGGLE_HP = 45;      // …but you crawl out this hurt (die slow if already weak)

/** Modes where no LSW ever walks: the yard is for learning, the range is for
 *  work. (§14 — boot camp is a paintball match, not a boss fight.) */
export function lswAllowed(mode: ModeId): boolean {
  return mode !== 'paintball' && mode !== 'range';
}

/** The officer's call, mid-match, spending the stable's materiel. Returns
 *  the pending drop — announced now, landing after the telegraph. Bigger
 *  threat = longer dread. */
export interface LswDrop {
  id: AscendantId;
  team: Team;
  landsAt: number;
  pos: { x: number; y: number; z: number };
}
