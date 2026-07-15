import { buildArsenal } from './arsenal';
import type { ClassDef, ClassId, ThemeId, VehicleDef, VehicleKind, WeaponDef, WeaponId } from './types';

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

/** Hand-tuned core set: class defaults, vehicle guns, zombie attacks. */
const CORE_WEAPONS: Record<WeaponId, WeaponDef> = {
  ar606: W({ id: 'ar606', name: 'Maklov AR-606', damage: 13, rof: 7.5, speed: 110, spread: 0.025, clip: 30, range: 66, sound: 'rifle' }),
  kuchler: W({ id: 'kuchler', name: 'Kuchler K6 SMG', damage: 9, rof: 12, speed: 95, spread: 0.05, clip: 40, reloadTime: 1.3, range: 40, sound: 'smg' }),
  caw: W({ id: 'caw', name: 'CAW-8 Shotgun', damage: 9, rof: 1.4, speed: 80, spread: 0.11, pellets: 8, clip: 6, reloadTime: 2.2, reserve: 60, range: 26, sound: 'shotgun', tracer: 'shell' }),
  rg2: W({ id: 'rg2', name: 'RG-2 Railgun', damage: 85, rof: 0.8, speed: 300, spread: 0.001, clip: 4, reloadTime: 2.4, reserve: 32, range: 125, sound: 'rail', tracer: 'rail' }),
  ac_mk2: W({ id: 'ac_mk2', name: 'AC-Mk2 Autocannon', damage: 16, rof: 6.5, speed: 100, spread: 0.04, clip: 60, reloadTime: 2.8, reserve: 300, range: 56, sound: 'autocannon' }),
  mml: W({ id: 'mml', name: 'Micro-Missile Launcher', damage: 65, rof: 0.9, speed: 42, spread: 0.01, clip: 3, reloadTime: 2.6, reserve: 24, range: 80, splash: 4.5, splashDamage: 45, sound: 'rocket', tracer: 'rocket' }),
  gl: W({ id: 'gl', name: 'GL-40 Grenade Launcher', damage: 55, rof: 1.1, speed: 34, clip: 5, reloadTime: 2.4, reserve: 30, range: 46, splash: 5, splashDamage: 50, arc: true, sound: 'thump', tracer: 'shell' }),
  plasma: W({ id: 'plasma', name: 'Kamenel Plasma', damage: 21, rof: 5, speed: 60, spread: 0.015, clip: 25, reloadTime: 1.8, reserve: Infinity, range: 54, sound: 'plasma', tracer: 'plasma' }),
  flamer: W({ id: 'flamer', name: 'F-3 Flamer', damage: 7, rof: 14, speed: 28, spread: 0.12, clip: 100, reloadTime: 2.5, reserve: 200, range: 16, sound: 'flame', tracer: 'flame' }),
  pistol: W({ id: 'pistol', name: 'P9 Sidearm', damage: 12, rof: 4.5, speed: 100, spread: 0.02, clip: 12, reloadTime: 1.1, reserve: 96, range: 44, sound: 'pistol' }),
  repair: W({ id: 'repair', name: 'Repair Gun', damage: 30, rof: 4, speed: 200, spread: 0, clip: Infinity, reloadTime: 0, reserve: Infinity, range: 12, heals: true, sound: 'repair', tracer: 'beam' }),
  medibeam: W({ id: 'medibeam', name: 'Medi-Beam', damage: 22, rof: 4, speed: 200, spread: 0, clip: Infinity, reloadTime: 0, reserve: Infinity, range: 14, heals: true, sound: 'heal', tracer: 'beam' }),
  impulse: W({ id: 'impulse', name: 'Impulse Cannon', damage: 30, rof: 1.5, speed: 55, spread: 0.008, clip: 8, reloadTime: 2, reserve: 64, range: 54, splash: 2.8, splashDamage: 18, knockback: 17, sound: 'impulse', tracer: 'rail' }),
  emp: W({ id: 'emp', name: 'EMP Charge', damage: 0, rof: 0.8, speed: 30, clip: 1, reserve: 0, range: 42, arc: true, sound: 'thump', tracer: 'plasma' }),
  target_beacon: W({ id: 'target_beacon', name: 'Targeting Beacon', damage: 0, rof: 0.8, speed: 28, clip: 1, reserve: 0, range: 44, arc: true, sound: 'thump', tracer: 'shell' }),
  orbital_beacon: W({ id: 'orbital_beacon', name: 'Orbital Designator', damage: 0, rof: 0.5, speed: 26, clip: 1, reserve: 0, range: 42, arc: true, sound: 'thump', tracer: 'rocket' }),
  buggy_mg: W({ id: 'buggy_mg', name: 'Buggy MG', damage: 11, rof: 10, speed: 110, spread: 0.045, clip: Infinity, reserve: Infinity, range: 52, sound: 'smg' }),
  tank_cannon: W({ id: 'tank_cannon', name: '120mm Cannon', damage: 110, rof: 0.5, speed: 70, spread: 0.004, clip: Infinity, reserve: Infinity, range: 94, splash: 5.5, splashDamage: 60, sound: 'cannon', tracer: 'rocket' }),
  apc_mg: W({ id: 'apc_mg', name: 'APC MG', damage: 12, rof: 8, speed: 105, spread: 0.04, clip: Infinity, reserve: Infinity, range: 55, sound: 'autocannon' }),
  skiff_plasma: W({ id: 'skiff_plasma', name: 'Skiff Plasma', damage: 18, rof: 7, speed: 65, spread: 0.02, clip: Infinity, reserve: Infinity, range: 50, sound: 'plasma', tracer: 'plasma' }),
  turret_mg: W({ id: 'turret_mg', name: 'Sentry MG', damage: 10, rof: 5, speed: 100, spread: 0.03, clip: Infinity, reserve: Infinity, range: 38, sound: 'smg' }),
  zombie_claw: W({ id: 'zombie_claw', name: 'Claws', damage: 14, rof: 1.2, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.2, sound: 'claw', tracer: 'none' }),
  spitter_acid: W({ id: 'spitter_acid', name: 'Acid Spit', damage: 12, rof: 0.8, speed: 26, spread: 0.03, clip: Infinity, reserve: Infinity, range: 30, splash: 2.5, splashDamage: 8, sound: 'acid', tracer: 'acid' }),
};

/**
 * The full armory: 200+ generated family weapons (see arsenal.ts) with the
 * hand-tuned core set layered on top — core ids always win a collision.
 */
export const WEAPONS: Record<WeaponId, WeaponDef> = { ...buildArsenal(), ...CORE_WEAPONS };

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

// Subsystem hp sits near 10% of hull so systems genuinely break DURING a
// fight (engines die, guns jam, sensors go dark) well before the wreck.
export const VEHICLES: Record<VehicleKind, VehicleDef> = {
  buggy: { kind: 'buggy', name: 'Scout Buggy', hp: 220, speed: 22, turnRate: 2.6, weapon: 'buggy_mg', seats: 2, mobileSpawn: false, radius: 1.6, systemHp: 24 },
  // The Ares is a crewed weapons platform: driver/gunner + sensors + ECM +
  // comms stations, plus 4 passenger benches for when leg work is required.
  // Every subsystem has its own hit points — tanks break in many ways.
  tank: {
    kind: 'tank', name: 'Ares Battle Tank', hp: 650, speed: 11, turnRate: 1.5,
    weapon: 'tank_cannon', seats: 8, mobileSpawn: false, radius: 2.4,
    crew: ['sensors', 'ecm', 'comms'], systemHp: 60,
  },
  apc: { kind: 'apc', name: 'Bastion APC', hp: 450, speed: 14, turnRate: 1.8, weapon: 'apc_mg', seats: 4, mobileSpawn: true, radius: 2.2, systemHp: 45 },
  skiff: { kind: 'skiff', name: 'Wraith Skiff', hp: 160, speed: 26, turnRate: 3.2, weapon: 'skiff_plasma', seats: 1, mobileSpawn: false, radius: 1.4, hover: true, systemHp: 18 },
  hoverboard: {
    kind: 'hoverboard', name: 'Halo Hoverboard', hp: 70, speed: 30, turnRate: 4.2,
    weapon: '', seats: 1, mobileSpawn: false, radius: 0.8, hover: true, systemHp: 10,
  },
  bike: {
    kind: 'bike', name: 'Jackal Recon Bike', hp: 130, speed: 34, turnRate: 3.4,
    weapon: 'bike_mg', seats: 1, mobileSpawn: false, radius: 1.1, systemHp: 15,
  },
  flyer: {
    kind: 'flyer', name: 'Kestrel Gunship', hp: 200, speed: 24, turnRate: 2.8,
    weapon: 'flyer_plasma', seats: 2, mobileSpawn: false, radius: 1.6,
    hover: true, flies: true, systemHp: 22, liftoffTime: 2.5,
  },
  transport: {
    kind: 'transport', name: 'Atlas Transport', hp: 520, speed: 12, turnRate: 1.6,
    weapon: 'transport_mg', seats: 9, mobileSpawn: true, radius: 2.6,
    crew: ['gunner', 'sensors', 'ecm', 'comms'], systemHp: 52,
  },
  ambulance: {
    kind: 'ambulance', name: 'Mercy Field Ambulance', hp: 300, speed: 17, turnRate: 2.2,
    weapon: '', seats: 3, mobileSpawn: false, radius: 1.9,
    healRadius: 7, healRate: 9, systemHp: 32,
  },
  tunneler: {
    kind: 'tunneler', name: 'Mole Tunneling Machine', hp: 700, speed: 4.5, turnRate: 1.0,
    weapon: '', seats: 2, mobileSpawn: false, radius: 2.2, digs: true, systemHp: 70,
  },
  emplacement: {
    kind: 'emplacement', name: 'Bulwark Emplacement', hp: 380, speed: 0, turnRate: 0,
    weapon: 'emplacement_gun', seats: 1, mobileSpawn: false, radius: 1.6,
    immobile: true, systemHp: 40,
  },
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

// ---------------------------------------------------------------------------
// Equipment — pick two at deploy. Each item is one focused effect the sim,
// HUD, or minimap honors.
// ---------------------------------------------------------------------------

export interface EquipDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** flat max-hp bonus (armor) */
  hpBonus?: number;
  /** move-speed multiplier (armor slows you down) */
  speedMult?: number;
  /** immune to knockback (power armor) */
  noKnockback?: boolean;
  /** targeting beacons/drones can't ping you (stealth suit) */
  pingProof?: boolean;
  /** cloaked enemies show as ghost outlines on your minimap (IR goggles) */
  seeCloaked?: boolean;
  /** enemy mines appear on your minimap (mine detector) */
  seeMines?: boolean;
  /** E repairs a damaged friendly vehicle/turret, on cooldown (repair kit) */
  fieldRepair?: boolean;
  /** auto-triggers a 45hp heal once per life below 25% (combat medikit) */
  autoMedikit?: boolean;
  /** share every teammate's line of sight on your minimap (head cam net) */
  headcam?: boolean;
  /** click the minimap to drop a waypoint your whole team sees (tac system) */
  waypoints?: boolean;
  /** pings the nearest hidden enemy every few seconds (psi scanner) */
  psiScan?: boolean;
  /** G plants a DX-9 demolition charge instead of a frag */
  demoCharge?: boolean;
  /** E on an enemy sentry turret converts it to your team (hacking kit) */
  hackKit?: boolean;
  /** G plants a spy camera that feeds enemy positions to your team */
  deployCamera?: boolean;
}

export const EQUIPMENT: Record<string, EquipDef> = {
  armor_vest: { id: 'armor_vest', name: 'Ballistic Vest', desc: '+25 max HP, −8% speed.', icon: '🦺', hpBonus: 25, speedMult: 0.92 },
  power_armor: { id: 'power_armor', name: 'Power Armor', desc: '+60 max HP, −15% speed, immune to knockback.', icon: '🛡️', hpBonus: 60, speedMult: 0.85, noKnockback: true },
  stealth_suit: { id: 'stealth_suit', name: 'Stealth Suit', desc: 'Beacons and drones cannot ping you.', icon: '🥷', pingProof: true },
  ir_goggles: { id: 'ir_goggles', name: 'IR/UV Goggles', desc: 'Cloaked enemies appear on your minimap.', icon: '🥽', seeCloaked: true },
  mine_detector: { id: 'mine_detector', name: 'Mine Detector', desc: 'Enemy mines appear on your minimap.', icon: '📡', seeMines: true },
  repair_kit: { id: 'repair_kit', name: 'Mechanic Kit', desc: 'E repairs a damaged friendly vehicle or turret (+120, 10s cooldown).', icon: '🔧', fieldRepair: true },
  medikit: { id: 'medikit', name: 'Combat Medikit', desc: 'Auto-heals +45 HP once per life when you drop below 25%.', icon: '💉', autoMedikit: true },
  head_cam: { id: 'head_cam', name: 'Head Cam Network', desc: 'Your minimap shows everything your teammates can see.', icon: '📹', headcam: true },
  tac_system: { id: 'tac_system', name: 'Tactical System', desc: 'Click the minimap to drop waypoints your team sees.', icon: '🗺️', waypoints: true },
  psi_scanner: { id: 'psi_scanner', name: 'Psi Scanner', desc: 'Pings the nearest hidden enemy every 8 seconds.', icon: '🔮', psiScan: true },
  demo_kit: { id: 'demo_kit', name: 'Demolition Kit', desc: 'G plants a DX-9 demolition charge (3 per life).', icon: '🧨', demoCharge: true },
  hacking_kit: { id: 'hacking_kit', name: 'Hacking Kit', desc: 'E converts an enemy sentry turret to your side.', icon: '💻', hackKit: true },
  spy_camera: { id: 'spy_camera', name: 'Spy Camera', desc: 'G plants a camera that feeds enemy positions to your team (2 per life).', icon: '📷', deployCamera: true },
};

// ---------------------------------------------------------------------------
// Environments — the war scales the solar system.
// ---------------------------------------------------------------------------

export interface ThemeDef {
  id: ThemeId;
  name: string;
  desc: string;
  icon: string;
  /** gravity in u/s² — Europa and Triton fight in low-g */
  gravity: number;
  /** map generator obstacle flavor */
  gen: 'field' | 'corridors' | 'rocks' | 'ocean' | 'ice';
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  savanna: { id: 'savanna', name: 'Terra — Savanna', desc: 'Dry grassland, rock kopjes, acacia stands.', icon: '🌍', gravity: 22, gen: 'field' },
  starship: { id: 'starship', name: 'Starship Boarding', desc: 'Corridor fighting between two docked hulls.', icon: '🚀', gravity: 22, gen: 'corridors' },
  asteroid: { id: 'asteroid', name: 'Hollowed Asteroid', desc: 'Mining galleries in a cracked-open rock.', icon: '☄️', gravity: 14, gen: 'rocks' },
  europa: { id: 'europa', name: 'Europa Depths', desc: 'Ocean-floor domes beneath the ice of Jupiter’s moon.', icon: '🌊', gravity: 9, gen: 'ocean' },
  titan: { id: 'titan', name: 'Titan Colony', desc: 'Methane haze over Saturn’s prosperous colony.', icon: '🪐', gravity: 16, gen: 'field' },
  triton: { id: 'triton', name: 'Triton Outpost', desc: 'A lonely ice station at the edge of everything.', icon: '❄️', gravity: 9, gen: 'ice' },
};
