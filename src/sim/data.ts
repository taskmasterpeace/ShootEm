import type { ClassDef, ClassId, VehicleDef, VehicleKind, WeaponDef, WeaponId } from './types';

const W = (w: Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'name' | 'damage' | 'rof'>): WeaponDef => ({
  speed: 90,
  spread: 0.02,
  pellets: 1,
  clip: 30,
  reloadTime: 1.6,
  reserve: 240,
  range: 60,
  splash: 0,
  splashDamage: 0,
  arc: false,
  heals: false,
  knockback: 0,
  sound: 'rifle',
  tracer: 'bullet',
  ...w,
});

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  ar606: W({ id: 'ar606', name: 'Maklov AR-606', damage: 13, rof: 7.5, speed: 110, spread: 0.025, clip: 30, sound: 'rifle' }),
  kuchler: W({ id: 'kuchler', name: 'Kuchler K6 SMG', damage: 9, rof: 12, speed: 95, spread: 0.05, clip: 40, reloadTime: 1.3, sound: 'smg' }),
  caw: W({ id: 'caw', name: 'CAW-8 Shotgun', damage: 9, rof: 1.4, speed: 80, spread: 0.11, pellets: 8, clip: 6, reloadTime: 2.2, reserve: 60, range: 26, sound: 'shotgun', tracer: 'shell' }),
  rg2: W({ id: 'rg2', name: 'RG-2 Railgun', damage: 85, rof: 0.8, speed: 300, spread: 0.001, clip: 4, reloadTime: 2.4, reserve: 32, range: 110, sound: 'rail', tracer: 'rail' }),
  ac_mk2: W({ id: 'ac_mk2', name: 'AC-Mk2 Autocannon', damage: 16, rof: 6.5, speed: 100, spread: 0.04, clip: 60, reloadTime: 2.8, reserve: 300, sound: 'autocannon' }),
  mml: W({ id: 'mml', name: 'Micro-Missile Launcher', damage: 65, rof: 0.9, speed: 42, spread: 0.01, clip: 3, reloadTime: 2.6, reserve: 24, range: 80, splash: 4.5, splashDamage: 45, sound: 'rocket', tracer: 'rocket' }),
  gl: W({ id: 'gl', name: 'GL-40 Grenade Launcher', damage: 55, rof: 1.1, speed: 34, clip: 5, reloadTime: 2.4, reserve: 30, range: 55, splash: 5, splashDamage: 50, arc: true, sound: 'thump', tracer: 'shell' }),
  plasma: W({ id: 'plasma', name: 'Kamenel Plasma', damage: 21, rof: 5, speed: 60, spread: 0.015, clip: 25, reloadTime: 1.8, reserve: Infinity, sound: 'plasma', tracer: 'plasma' }),
  flamer: W({ id: 'flamer', name: 'F-3 Flamer', damage: 7, rof: 14, speed: 28, spread: 0.12, clip: 100, reloadTime: 2.5, reserve: 200, range: 16, sound: 'flame', tracer: 'flame' }),
  pistol: W({ id: 'pistol', name: 'P9 Sidearm', damage: 12, rof: 4.5, speed: 100, spread: 0.02, clip: 12, reloadTime: 1.1, reserve: 96, sound: 'pistol' }),
  repair: W({ id: 'repair', name: 'Repair Gun', damage: 30, rof: 4, speed: 200, spread: 0, clip: Infinity, reloadTime: 0, reserve: Infinity, range: 12, heals: true, sound: 'repair', tracer: 'beam' }),
  medibeam: W({ id: 'medibeam', name: 'Medi-Beam', damage: 22, rof: 4, speed: 200, spread: 0, clip: Infinity, reloadTime: 0, reserve: Infinity, range: 14, heals: true, sound: 'heal', tracer: 'beam' }),
  impulse: W({ id: 'impulse', name: 'Impulse Cannon', damage: 30, rof: 1.5, speed: 55, spread: 0.008, clip: 8, reloadTime: 2, reserve: 64, range: 60, splash: 2.8, splashDamage: 18, knockback: 17, sound: 'impulse', tracer: 'rail' }),
  emp: W({ id: 'emp', name: 'EMP Charge', damage: 0, rof: 0.8, speed: 30, clip: 1, reserve: 0, range: 40, arc: true, sound: 'thump', tracer: 'plasma' }),
  target_beacon: W({ id: 'target_beacon', name: 'Targeting Beacon', damage: 0, rof: 0.8, speed: 28, clip: 1, reserve: 0, range: 40, arc: true, sound: 'thump', tracer: 'shell' }),
  orbital_beacon: W({ id: 'orbital_beacon', name: 'Orbital Designator', damage: 0, rof: 0.5, speed: 26, clip: 1, reserve: 0, range: 38, arc: true, sound: 'thump', tracer: 'rocket' }),
  buggy_mg: W({ id: 'buggy_mg', name: 'Buggy MG', damage: 11, rof: 10, speed: 110, spread: 0.045, clip: Infinity, reserve: Infinity, sound: 'smg' }),
  tank_cannon: W({ id: 'tank_cannon', name: '120mm Cannon', damage: 110, rof: 0.5, speed: 70, spread: 0.004, clip: Infinity, reserve: Infinity, range: 90, splash: 5.5, splashDamage: 60, sound: 'cannon', tracer: 'rocket' }),
  apc_mg: W({ id: 'apc_mg', name: 'APC MG', damage: 12, rof: 8, speed: 105, spread: 0.04, clip: Infinity, reserve: Infinity, sound: 'autocannon' }),
  skiff_plasma: W({ id: 'skiff_plasma', name: 'Skiff Plasma', damage: 18, rof: 7, speed: 65, spread: 0.02, clip: Infinity, reserve: Infinity, sound: 'plasma', tracer: 'plasma' }),
  turret_mg: W({ id: 'turret_mg', name: 'Sentry MG', damage: 10, rof: 5, speed: 100, spread: 0.03, clip: Infinity, reserve: Infinity, range: 34, sound: 'smg' }),
  zombie_claw: W({ id: 'zombie_claw', name: 'Claws', damage: 14, rof: 1.2, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.2, sound: 'claw', tracer: 'none' }),
  spitter_acid: W({ id: 'spitter_acid', name: 'Acid Spit', damage: 12, rof: 0.8, speed: 26, spread: 0.03, clip: Infinity, reserve: Infinity, range: 30, splash: 2.5, splashDamage: 8, sound: 'acid', tracer: 'acid' }),
};

export const CLASSES: Record<ClassId, ClassDef> = {
  infantry: {
    id: 'infantry', name: 'Infantry', desc: 'Balanced rifleman. Extra frag grenades.',
    hp: 100, speed: 10.5, primary: 'ar606', secondary: 'pistol',
    ability: 'grenade', abilityName: 'Frag Grenade', color: 0xc9a86a,
  },
  heavy: {
    id: 'heavy', name: 'Heavy Weapons', desc: 'Slow but devastating. Autocannon, missiles, shield dome.',
    hp: 145, speed: 8.2, primary: 'ac_mk2', secondary: 'mml',
    ability: 'shield', abilityName: 'Shield Dome (Q)', color: 0xb0623a,
  },
  jump: {
    id: 'jump', name: 'Jump Trooper', desc: 'Jetpack mobility. SMG skirmisher.',
    hp: 90, speed: 11.5, primary: 'kuchler', secondary: 'gl',
    ability: 'jetpack', abilityName: 'Jetpack (Space)', color: 0x7fa8c9,
  },
  engineer: {
    id: 'engineer', name: 'Combat Engineer', desc: 'Builds sentry turrets, repairs vehicles, plants mines.',
    hp: 110, speed: 9.5, primary: 'caw', secondary: 'repair',
    ability: 'turret', abilityName: 'Build Sentry (Q) / Mine (G)', color: 0x9a8f4f,
  },
  medic: {
    id: 'medic', name: 'Field Medic', desc: 'Heals squadmates with the medi-beam.',
    hp: 100, speed: 10.8, primary: 'kuchler', secondary: 'medibeam',
    ability: 'heal', abilityName: 'Self-Stim (Q)', color: 0x8fb98a,
  },
  infiltrator: {
    id: 'infiltrator', name: 'Infiltrator', desc: 'Cloaking field + RG-2 railgun. Fragile.',
    hp: 80, speed: 11, primary: 'rg2', secondary: 'pistol',
    ability: 'cloak', abilityName: 'Cloak (Q)', color: 0x8a7fb9,
  },
  pathfinder: {
    id: 'pathfinder', name: 'Pathfinder', desc: 'Warp beacon pair + knockback impulse cannon. Fastest boots in the war.',
    hp: 85, speed: 12.5, primary: 'impulse', secondary: 'pistol',
    ability: 'warp', abilityName: 'Warp Beacon (Q) / Target Beacon (G)', color: 0x5ac8b0,
  },
  ghost: {
    id: 'ghost', name: 'Ghost', desc: 'Recon drone marks enemies through walls. EMP charges stall vehicles.',
    hp: 90, speed: 11, primary: 'plasma', secondary: 'pistol',
    ability: 'drone', abilityName: 'Recon Drone (Q) / EMP (G)', color: 0x7a90a8,
  },
};

export const VEHICLES: Record<VehicleKind, VehicleDef> = {
  buggy: { kind: 'buggy', name: 'Scout Buggy', hp: 220, speed: 22, turnRate: 2.6, weapon: 'buggy_mg', seats: 2, mobileSpawn: false, radius: 1.6 },
  tank: { kind: 'tank', name: 'Ares Battle Tank', hp: 650, speed: 11, turnRate: 1.5, weapon: 'tank_cannon', seats: 2, mobileSpawn: false, radius: 2.4 },
  apc: { kind: 'apc', name: 'Bastion APC', hp: 450, speed: 14, turnRate: 1.8, weapon: 'apc_mg', seats: 4, mobileSpawn: true, radius: 2.2 },
  skiff: { kind: 'skiff', name: 'Wraith Skiff', hp: 160, speed: 26, turnRate: 3.2, weapon: 'skiff_plasma', seats: 1, mobileSpawn: false, radius: 1.4 },
};

export const TEAM_NAMES = ['Titan Coalition', 'The Collective'] as const;
export const TEAM_COLORS = [0xe8a33d, 0x3dbde8] as const; // amber vs cyan

export const ZOMBIE_STATS = {
  zombie: { hp: 60, speed: 8.5, weapon: 'zombie_claw' as WeaponId, score: 10 },
  spitter: { hp: 45, speed: 7.5, weapon: 'spitter_acid' as WeaponId, score: 15 },
  brute: { hp: 320, speed: 6, weapon: 'zombie_claw' as WeaponId, score: 50 },
  sprinter: { hp: 40, speed: 15.5, weapon: 'zombie_claw' as WeaponId, score: 20 },
  bomber: { hp: 90, speed: 6.5, weapon: 'zombie_claw' as WeaponId, score: 25 },
  stalker: { hp: 70, speed: 5, weapon: 'zombie_claw' as WeaponId, score: 35 },
};

export const MODE_INFO: Record<string, { name: string; desc: string; icon: string }> = {
  tdm: { name: 'Team Deathmatch', desc: 'First team to 50 kills. Straight firefight.', icon: '💀' },
  ctf: { name: 'Capture the Flag', desc: 'Steal the enemy flag. First to 3 captures.', icon: '🚩' },
  koth: { name: 'King of the Hill', desc: 'Hold the hill for 120 total seconds.', icon: '⛰️' },
  conquest: { name: 'Conquest', desc: 'Hold control points A/B/C. First to 500 tickets.', icon: '🎯' },
  survival: { name: 'Zombie Survival', desc: 'Co-op vs escalating undead waves.', icon: '🧟' },
  horde: { name: 'Endless Horde', desc: 'No waves, no breaks — the dead never stop coming.', icon: '🩸' },
  safehouse: { name: 'Protect the Scientist', desc: 'The horde searches house to house. Hide him, defend him, survive to evac.', icon: '🧪' },
};
