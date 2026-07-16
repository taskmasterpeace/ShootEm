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
  // SECONDARY FIRES (right mouse) live on the four icons of the core set —
  // one button, four personalities. See fireAltWeapon in world.ts.
  ar606: W({ id: 'ar606', name: 'Maklov AR-606', damage: 13, rof: 7.5, speed: 110, spread: 0.025, clip: 30, range: 66, sound: 'rifle',
    alt: { kind: 'burst', ammo: 3, cooldown: 2.6 } }), // under-barrel flame burp
  kuchler: W({ id: 'kuchler', name: 'Kuchler K6 SMG', damage: 9, rof: 12, speed: 95, spread: 0.05, clip: 40, reloadTime: 1.3, range: 40, sound: 'smg' }),
  caw: W({ id: 'caw', name: 'CAW-8 Shotgun', damage: 9, rof: 1.4, speed: 80, spread: 0.11, pellets: 8, clip: 6, reloadTime: 2.2, reserve: 60, range: 26, sound: 'shotgun', tracer: 'shell' }),
  rg2: W({ id: 'rg2', name: 'RG-2 Railgun', damage: 85, rof: 0.8, speed: 300, spread: 0.001, clip: 4, reloadTime: 2.4, reserve: 32, range: 125, sound: 'rail', tracer: 'rail',
    alt: { kind: 'tag', ammo: 4, cooldown: 1.4 } }), // tag dart — pin the runner, then line up the real shot
  ac_mk2: W({ id: 'ac_mk2', name: 'AC-Mk2 Autocannon', damage: 16, rof: 6.5, speed: 100, spread: 0.04, clip: 60, reloadTime: 2.8, reserve: 300, range: 56, sound: 'autocannon' }),
  mml: W({ id: 'mml', name: 'Micro-Missile Launcher', damage: 65, rof: 0.9, speed: 42, spread: 0.01, clip: 3, reloadTime: 2.6, reserve: 24, range: 80, splash: 4.5, splashDamage: 45, knockback: 14, sound: 'rocket', tracer: 'rocket' }),
  gl: W({ id: 'gl', name: 'GL-40 Grenade Launcher', damage: 55, rof: 1.1, speed: 34, clip: 5, reloadTime: 2.4, reserve: 30, range: 46, splash: 5, splashDamage: 50, knockback: 10, arc: true, sound: 'thump', tracer: 'shell',
    alt: { kind: 'skitter', ammo: 2, cooldown: 3 } }), // the SKITTER — a charge on legs that runs them down
  plasma: W({ id: 'plasma', name: 'Kamenel Plasma', damage: 21, rof: 5, speed: 60, spread: 0.015, clip: 25, reloadTime: 1.8, reserve: Infinity, range: 54, sound: 'plasma', tracer: 'plasma',
    alt: { kind: 'overcharge', ammo: 0, cooldown: 1.6, cells: 6 } }), // six cells, one ugly orb
  flamer: W({ id: 'flamer', name: 'F-3 Flamer', damage: 7, rof: 14, speed: 28, spread: 0.12, clip: 100, reloadTime: 2.5, reserve: 200, range: 16, sound: 'flame', tracer: 'flame' }),
  pistol: W({ id: 'pistol', name: 'P9 Sidearm', damage: 12, rof: 4.5, speed: 100, spread: 0.02, clip: 12, reloadTime: 1.1, reserve: 96, range: 44, sound: 'pistol' }),
  repair: W({ id: 'repair', name: 'Repair Gun', damage: 30, rof: 4, speed: 200, spread: 0, clip: Infinity, reloadTime: 0, reserve: Infinity, range: 12, heals: true, sound: 'repair', tracer: 'beam' }),
  medibeam: W({ id: 'medibeam', name: 'Medi-Beam', damage: 22, rof: 4, speed: 200, spread: 0, clip: Infinity, reloadTime: 0, reserve: Infinity, range: 14, heals: true, sound: 'heal', tracer: 'beam' }),
  impulse: W({ id: 'impulse', name: 'Impulse Cannon', damage: 30, rof: 1.5, speed: 55, spread: 0.008, clip: 8, reloadTime: 2, reserve: 64, range: 54, splash: 2.8, splashDamage: 18, knockback: 17, sound: 'impulse', tracer: 'rail' }),
  emp: W({ id: 'emp', name: 'EMP Charge', damage: 0, rof: 0.8, speed: 30, clip: 1, reserve: 0, range: 42, arc: true, sound: 'thump', tracer: 'plasma' }),
  target_beacon: W({ id: 'target_beacon', name: 'Targeting Beacon', damage: 0, rof: 0.8, speed: 28, clip: 1, reserve: 0, range: 44, arc: true, sound: 'thump', tracer: 'shell' }),
  orbital_beacon: W({ id: 'orbital_beacon', name: 'Orbital Designator', damage: 0, rof: 0.5, speed: 26, clip: 1, reserve: 0, range: 42, arc: true, sound: 'thump', tracer: 'rocket' }),
  buggy_mg: W({ id: 'buggy_mg', name: 'Buggy MG', damage: 11, rof: 10, speed: 110, spread: 0.045, clip: Infinity, reserve: Infinity, range: 52, sound: 'smg' }),
  tank_cannon: W({ id: 'tank_cannon', name: '120mm Cannon', damage: 110, rof: 0.5, speed: 70, spread: 0.004, clip: Infinity, reserve: Infinity, range: 94, splash: 5.5, splashDamage: 60, knockback: 18, sound: 'cannon', tracer: 'rocket' }),
  // the Goliath's arm gun: sustained anti-infantry fire with a light splash —
  // strong vs flesh in the open, mediocre vs armor. The tank stays armor king.
  mech_autocannon: W({ id: 'mech_autocannon', name: 'GAU-9 Arm Cannon', damage: 22, rof: 4, speed: 100, spread: 0.025, clip: Infinity, reserve: Infinity, range: 68, splash: 1.2, splashDamage: 8, knockback: 2, sound: 'autocannon', tracer: 'shell' }),
  // the stomp: not a gun — an AoE ground slam resolved through explode().
  // The knockback IS the weapon; the damage is a bruise, not a kill.
  mech_stomp: W({ id: 'mech_stomp', name: 'Seismic Stomp', damage: 0, rof: 1, speed: 1, clip: Infinity, reserve: Infinity, range: 5, splash: 4.5, splashDamage: 35, knockback: 16, sound: 'thump', tracer: 'none' }),
  boat_mg: W({ id: 'boat_mg', name: 'Pike Deck MG', damage: 12, rof: 9, speed: 105, spread: 0.04, clip: Infinity, reserve: Infinity, range: 56, sound: 'autocannon' }),
  apc_mg: W({ id: 'apc_mg', name: 'APC MG', damage: 12, rof: 8, speed: 105, spread: 0.04, clip: Infinity, reserve: Infinity, range: 55, sound: 'autocannon' }),
  skiff_plasma: W({ id: 'skiff_plasma', name: 'Skiff Plasma', damage: 18, rof: 7, speed: 65, spread: 0.02, clip: Infinity, reserve: Infinity, range: 50, sound: 'plasma', tracer: 'plasma' }),
  turret_mg: W({ id: 'turret_mg', name: 'Sentry MG', damage: 10, rof: 5, speed: 100, spread: 0.03, clip: Infinity, reserve: Infinity, range: 38, sound: 'smg' }),
  zombie_claw: W({ id: 'zombie_claw', name: 'Claws', damage: 14, rof: 1.2, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.2, sound: 'claw', tracer: 'none' }),
  // ---- alt-fire internals (never drawn from the armory; fired by fireAltWeapon) ----
  tag_dart: W({ id: 'tag_dart', name: 'Tag Dart', damage: 4, rof: 1, speed: 160, spread: 0.002, clip: 1, reserve: 0, range: 100, sound: 'rail', tracer: 'rail', tagsTarget: true }),
  plasma_orb: W({ id: 'plasma_orb', name: 'Plasma Overcharge', damage: 60, rof: 1, speed: 40, spread: 0.004, clip: 1, reserve: 0, range: 54, splash: 3.5, splashDamage: 40, knockback: 8, sound: 'plasma', tracer: 'plasma' }),
  skitter_bang: W({ id: 'skitter_bang', name: 'Skitter Charge', damage: 45, rof: 1, speed: 1, clip: 1, reserve: 0, range: 4, splash: 3.5, splashDamage: 45, knockback: 8, sound: 'thump', tracer: 'none' }),
  spitter_acid: W({ id: 'spitter_acid', name: 'Acid Spit', damage: 12, rof: 0.8, speed: 26, spread: 0.03, clip: Infinity, reserve: Infinity, range: 30, splash: 2.5, splashDamage: 8, sound: 'acid', tracer: 'acid' }),
};

/**
 * The full armory: 200+ generated family weapons (see arsenal.ts) with the
 * hand-tuned core set layered on top — core ids always win a collision.
 */
/** HUD glyphs for the hand-tuned core set (the generated arsenal wears family
 *  icons from arsenal.ts). '🔫' is the fallback nobody should ever see. */
const CORE_ICONS: Record<string, string> = {
  ar606: '🎯', kuchler: '💨', caw: '💥', rg2: '⚡', ac_mk2: '⛓️', mml: '🚀',
  gl: '🧨', plasma: '🔵', flamer: '🔥', pistol: '🔫', repair: '🔧', medibeam: '💉',
  impulse: '📢', emp: '📡', target_beacon: '🛰️', orbital_beacon: '☄️',
  buggy_mg: '⛓️', tank_cannon: '💥', mech_autocannon: '⛓️', mech_stomp: '🦿',
  boat_mg: '⛓️', apc_mg: '⛓️', skiff_plasma: '🔵', turret_mg: '⛓️',
  zombie_claw: '🩸', spitter_acid: '🧪', tag_dart: '📍', plasma_orb: '🔵',
  skitter_bang: '🕷️', sam_missile: '🚀',
};
for (const w of Object.values(CORE_WEAPONS)) if (!w.icon) w.icon = CORE_ICONS[w.id] ?? '🔫';

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
  // The Pike: the moat's landlord. Fast and mean ON the water, useless off
  // it — a water-locked weapons platform with a bench for two marines who
  // can shoot from the deck. Counters swimmers utterly (they can't shoot
  // back); loses to shore rockets it can't chase inland.
  boat: {
    kind: 'boat', name: 'Pike Gunboat', hp: 260, speed: 21, turnRate: 2.6,
    weapon: 'boat_mg', seats: 3, mobileSpawn: false, radius: 1.8,
    boat: true, systemHp: 28,
  },
  // The Goliath: the walking middle ground. Slower than a tank in a straight
  // line but pivots like a soldier, and its LEGS are the point — low cover
  // that walls off every wheeled and tracked hull is a stair step to it.
  // Balance slot: hp between APC and tank, worst straight-line speed of the
  // armed ground pool, best heavy-class turn rate, anti-infantry gun.
  mech: {
    kind: 'mech', name: 'Goliath Assault Walker', hp: 480, speed: 9, turnRate: 2.4,
    weapon: 'mech_autocannon', seats: 2, mobileSpawn: false, radius: 1.9,
    strider: true, stomps: true, systemHp: 48,
  },
};

// ---------------------------------------------------------------------------
// Anti-air. Lives below VEHICLES because the missile's speed is DERIVED from
// the Kestrel's top speed: ~8% slower, so a pilot who holds a straight sprint
// just barely outruns it, while one who panics and turns bleeds the gap away
// and gets caught. That ratio IS the predator/prey loop — never hardcode it.
// ---------------------------------------------------------------------------

/** heat-seeker top speed as a fraction of the flyer's — it always loses a drag race */
export const SAM_SPEED_RATIO = 0.92;

WEAPONS.sam_missile = W({
  id: 'sam_missile', name: 'Peregrine SAM', damage: 120, rof: 0.7,
  speed: VEHICLES.flyer.speed * SAM_SPEED_RATIO, spread: 0,
  clip: 1, reserve: 0, range: 140, splash: 3, splashDamage: 60,
  sound: 'rocket', tracer: 'rocket',
});

export const TEAM_NAMES = ['The United Front', 'The Collective'] as const;
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
  range: { name: 'Proving Grounds', desc: 'Your own patch of the war: firing lanes, dummy targets, the qualification courses (§3.3).', icon: '🎯' },
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
  /** §19.2: seen enemies linger SEEN_LINGER_GEARED instead of SEEN_LINGER */
  tracker?: boolean;
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
  /** G fires a heat-seeking missile at a locked enemy aircraft (2 per life) */
  samLauncher?: boolean;
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
  tracking_optics: { id: 'tracking_optics', name: 'Tracking Optics', desc: 'Enemies you spot stay visible 3s after breaking line of sight (instead of 1.5s).', icon: '👁️', tracker: true },
  mine_detector: { id: 'mine_detector', name: 'Mine Detector', desc: 'Enemy mines appear on your minimap.', icon: '📡', seeMines: true },
  repair_kit: { id: 'repair_kit', name: 'Mechanic Kit', desc: 'E repairs a damaged friendly vehicle or turret (+120, 10s cooldown).', icon: '🔧', fieldRepair: true },
  medikit: { id: 'medikit', name: 'Combat Medikit', desc: 'Auto-heals +45 HP once per life when you drop below 25%.', icon: '💉', autoMedikit: true },
  head_cam: { id: 'head_cam', name: 'Head Cam Network', desc: 'Your minimap shows everything your teammates can see.', icon: '📹', headcam: true },
  tac_system: { id: 'tac_system', name: 'Tactical System', desc: 'Click the minimap to drop waypoints your team sees.', icon: '🗺️', waypoints: true },
  psi_scanner: { id: 'psi_scanner', name: 'Psi Scanner', desc: 'Pings the nearest hidden enemy every 8 seconds.', icon: '🔮', psiScan: true },
  demo_kit: { id: 'demo_kit', name: 'Demolition Kit', desc: 'G plants a DX-9 demolition charge (3 per life).', icon: '🧨', demoCharge: true },
  manpads: { id: 'manpads', name: 'MANPADS', desc: 'Shoulder-fired IR missile: G locks the nearest enemy aircraft in your facing cone and fires (2 per life).', icon: '🚀', samLauncher: true },
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
