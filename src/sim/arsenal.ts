import type { ClassId, WeaponDef, WeaponFamily, WeaponId } from './types';

// ---------------------------------------------------------------------------
// The Arsenal — War World's answer to Infantry Online's 200+ weapon armory.
//
// Every weapon here is a real, firing WeaponDef generated deterministically
// from FAMILY base stats × BRAND flavor × Mk-tier curve, so the table is
// identical on every client and the server. The hand-tuned core set in
// data.ts (class defaults, vehicle guns, zombie claws) is merged on top and
// its ids never change.
//
// Table integrity and balance ceilings are enforced by tests/sim.test.ts.
// ---------------------------------------------------------------------------

interface BrandSpec {
  key: string;
  label: string;
  /** stat flavor multipliers */
  dmg: number; rof: number; clip: number; spread: number; reload: number; range: number;
}

/** Solar-system arms manufacturers. Four are assigned per family, rotating. */
const BRANDS: BrandSpec[] = [
  { key: 'maklov',  label: 'Maklov',          dmg: 1.0,  rof: 1.0,  clip: 1.0,  spread: 1.0, reload: 1.0,  range: 1.0 },
  { key: 'kuchler', label: 'Kuchler',         dmg: 0.85, rof: 1.25, clip: 1.15, spread: 1.2, reload: 0.9,  range: 0.9 },
  { key: 'titan',   label: 'Titan Arms',      dmg: 1.28, rof: 0.7,  clip: 0.8,  spread: 0.9, reload: 1.15, range: 1.0 },
  { key: 'harkov',  label: 'Harkov',          dmg: 1.05, rof: 0.9,  clip: 0.9,  spread: 0.55, reload: 1.0, range: 1.15 },
  { key: 'ceres',   label: 'Ceres Foundry',   dmg: 0.92, rof: 1.05, clip: 1.25, spread: 1.1, reload: 0.85, range: 0.95 },
  { key: 'kamenel', label: 'Kamenel',         dmg: 1.15, rof: 0.85, clip: 0.95, spread: 0.8, reload: 1.05, range: 1.05 },
];

/** Mk-tier curve — SIDEGRADES, by law (Robert, 2026-07-16): higher marks hit
 *  harder and group tighter, but the magazine SHRINKS and the reload DRAGS.
 *  Mk I is the workhorse, Mk II the marksman's mark, Mk III the hot rod that
 *  feeds like a diva. No mark is strictly better — every pick is a real pick,
 *  and a rookie's Mk I loses nothing to a veteran's Mk III but taste. */
const TIERS = [
  { mk: 1, dmg: 1.0,  spread: 1.0,  reload: 1.0,  clip: 1.0,  reserve: 1.0 },
  { mk: 2, dmg: 1.22, spread: 0.82, reload: 1.12, clip: 0.8,  reserve: 1.0 },
  { mk: 3, dmg: 1.5,  spread: 0.62, reload: 1.25, clip: 0.62, reserve: 0.85 },
];

interface FamilySpec {
  family: WeaponFamily;
  label: string;
  code: string; // 2-letter model code
  base: Omit<WeaponDef, 'id' | 'name' | 'family' | 'tier'>;
}

const F = (
  family: WeaponFamily, label: string, code: string,
  base: Partial<WeaponDef> & Pick<WeaponDef, 'damage' | 'rof'>,
): FamilySpec => ({
  family, label, code,
  base: {
    speed: 90, spread: 0.02, pellets: 1, clip: 30, reloadTime: 1.6, reserve: 240,
    range: 60, splash: 0, splashDamage: 0, arc: false, heals: false, knockback: 0,
    sound: 'rifle', tracer: 'bullet',
    ...base,
  } as Omit<WeaponDef, 'id' | 'name' | 'family' | 'tier'>,
});

/** The sixteen generated families — every category from the classic armory. */
export const FAMILIES: FamilySpec[] = [
  F('pistol',       'Pistol',        'P',  { damage: 12, rof: 4.5, speed: 100, spread: 0.02, clip: 12, reloadTime: 1.1, reserve: 96, range: 44, sound: 'pistol', fireMode: 'single' }),
  F('rifle',        'Rifle',         'R',  { damage: 13, rof: 7.5, speed: 110, spread: 0.025, clip: 30, reserve: 240, range: 66, alt: { kind: 'burst', ammo: 3, cooldown: 2.6 } }),
  F('carbine',      'Carbine',       'C',  { damage: 11, rof: 9, speed: 105, spread: 0.03, clip: 26, reloadTime: 1.4, reserve: 208, range: 52, fireMode: 'burst2', alt: { kind: 'tag', ammo: 4, cooldown: 1.4 } }), // 10.1: the two-round-burst rifle — "a heck of an edge"
  F('smg',          'SMG',           'K',  { damage: 9, rof: 12, speed: 95, spread: 0.05, clip: 40, reloadTime: 1.3, reserve: 240, range: 40, sound: 'smg', alt: { kind: 'skitter', ammo: 2, cooldown: 3 } }),
  F('shotgun',      'Shotgun',       'SG', { damage: 9, rof: 1.4, pellets: 8, speed: 80, spread: 0.11, clip: 6, reloadTime: 2.2, reserve: 60, range: 26, sound: 'shotgun', tracer: 'shell', fireMode: 'pump' }),
  F('slugger',      'Slug Thrower',  'ST', { damage: 34, rof: 1.8, speed: 85, spread: 0.015, clip: 8, reloadTime: 2.0, reserve: 64, range: 58, sound: 'shotgun', tracer: 'shell', fireMode: 'pump' }),
  F('laser',        'Laser',         'L',  { damage: 30, rof: 2.2, speed: 300, spread: 0.003, clip: 8, reloadTime: 1.8, reserve: 64, range: 96, sound: 'rail', tracer: 'rail', alt: { kind: 'tag', ammo: 4, cooldown: 1.4 } }),
  F('lmg',          'Light MG',      'LM', { damage: 11, rof: 9.5, speed: 105, spread: 0.045, clip: 75, reloadTime: 3.2, reserve: 375, range: 54, sound: 'autocannon', alt: { kind: 'burst', ammo: 2, cooldown: 2.6 } }),
  F('hmg',          'Heavy MG',      'HM', { damage: 15, rof: 7, speed: 105, spread: 0.05, clip: 90, reloadTime: 3.8, reserve: 360, range: 64, sound: 'autocannon', alt: { kind: 'burst', ammo: 2, cooldown: 2.6 } }),
  F('at_rocket',    'AT Rocket',     'AT', { damage: 90, rof: 0.6, speed: 40, spread: 0.008, clip: 1, reloadTime: 3.0, reserve: 12, range: 88, splash: 3, splashDamage: 40, knockback: 14, sound: 'rocket', tracer: 'rocket' }),
  F('ap_rocket',    'AP Rocket',     'AP', { damage: 40, rof: 0.9, speed: 44, spread: 0.012, clip: 3, reloadTime: 2.6, reserve: 18, range: 72, splash: 5, splashDamage: 50, knockback: 14, sound: 'rocket', tracer: 'rocket' }),
  F('mortar',       'Mortar',        'M',  { damage: 50, rof: 0.7, speed: 30, arc: true, clip: 4, reloadTime: 2.8, reserve: 24, range: 72, splash: 5.5, splashDamage: 55, knockback: 14, sound: 'thump', tracer: 'shell' }),
  F('artillery',    'Field Gun',     'FG', { damage: 80, rof: 0.35, speed: 38, arc: true, clip: 2, reloadTime: 4.5, reserve: 16, range: 105, splash: 7, splashDamage: 70, knockback: 20, sound: 'cannon', tracer: 'rocket' }),
  F('scatter',      'Scatter Pack',  'SP', { damage: 7, rof: 1.6, pellets: 12, speed: 70, spread: 0.2, clip: 5, reloadTime: 2.4, reserve: 40, range: 22, sound: 'shotgun', tracer: 'shell', fireMode: 'double' }), // 10.1: THE DOUBLE-BARREL — both barrels, one press
  F('sonic',        'Sonic Cannon',  'SC', { damage: 18, rof: 3, speed: 60, spread: 0.01, clip: 12, reloadTime: 2.0, reserve: 72, range: 44, knockback: 8, sound: 'impulse', tracer: 'rail', alt: { kind: 'overcharge', ammo: 0, cooldown: 1.6, cells: 6 } }),
  F('flamethrower', 'Flamethrower',  'FT', { damage: 7, rof: 14, speed: 28, spread: 0.12, clip: 100, reloadTime: 2.5, reserve: 200, range: 16, sound: 'flame', tracer: 'flame' }),
];

const ROMAN = ['', 'I', 'II', 'III'];

/** One glyph per family — every weapon wears its role on the HUD. */
export const FAMILY_ICONS: Record<WeaponFamily, string> = {
  pistol: '🔫', rifle: '🎯', carbine: '🎯', smg: '💨', shotgun: '💥', slugger: '🔩',
  laser: '🔆', lmg: '⛓️', hmg: '⛓️', at_rocket: '🚀', ap_rocket: '🚀',
  mortar: '☄️', artillery: '☄️', scatter: '💥', sonic: '📢', flamethrower: '🔥',
  grenade: '🧨', special: '🧰', melee: '✊', melee_weapon: '🗡️', marker: '🎨', lsw: '☄️', // signature arms — one god each
};

/** Deterministically build the full generated arsenal. */
export function buildArsenal(): Record<WeaponId, WeaponDef> {
  const out: Record<WeaponId, WeaponDef> = {};

  FAMILIES.forEach((f, fi) => {
    for (let b = 0; b < 4; b++) {
      const brand = BRANDS[(fi + b) % BRANDS.length];
      for (const tier of TIERS) {
        const id = `${f.family}_${brand.key}_${tier.mk}`;
        const base = f.base;
        const clip = Math.max(1, Math.round(base.clip * brand.clip * tier.clip));
        const reserve = Number.isFinite(base.reserve)
          ? Math.round(base.reserve * brand.clip * tier.reserve)
          : Infinity;
        out[id] = {
          id,
          name: `${brand.label} ${f.code}-${tier.mk} ${f.label}`,
          icon: FAMILY_ICONS[f.family],
          family: f.family,
          tier: tier.mk,
          damage: Math.round(base.damage * brand.dmg * tier.dmg * 10) / 10,
          rof: Math.round(base.rof * brand.rof * 100) / 100,
          speed: base.speed,
          spread: Math.round(base.spread * brand.spread * tier.spread * 10000) / 10000,
          pellets: base.pellets,
          clip,
          reloadTime: Math.min(5, Math.round(base.reloadTime * brand.reload * tier.reload * 100) / 100),
          reserve,
          range: Math.round(base.range * brand.range),
          splash: base.splash,
          splashDamage: Math.round(base.splashDamage * tier.dmg),
          arc: base.arc,
          heals: false,
          knockback: base.knockback ? Math.round(base.knockback * tier.dmg * 10) / 10 : 0,
          sound: base.sound,
          tracer: base.tracer,
          fireMode: base.fireMode, // 10.1: the family's trigger discipline rides every variant
          brand: brand.key,        // row 178: the manufacturer — and its firing SIGNATURE
          alt: base.alt,           // row 177: the family's under-barrel surprise rides too
        };
      }
    }
  });

  // ---- grenade family: frag / smoke / phosphorus launchers, three marks each ----
  // only frag rounds shove: smoke is concealment, phosphorus delivers a fire
  // field — neither is a concussive blast
  const nadeKinds = [
    { key: 'frag', label: 'Frag Launcher', payload: undefined, splash: 5, splashDamage: 50, damage: 55, knockback: 10 },
    { key: 'smoke', label: 'Smoke Launcher', payload: 'smoke' as const, splash: 0, splashDamage: 0, damage: 0, knockback: 0 },
    { key: 'wp', label: 'Phosphorus Launcher', payload: 'fire' as const, splash: 0, splashDamage: 0, damage: 4, knockback: 0 },
  ];
  for (const nk of nadeKinds) {
    for (const tier of TIERS) {
      const id = `grenade_${nk.key}_${tier.mk}`;
      out[id] = {
        id,
        name: `Ordnance Works ${nk.label} Mk ${ROMAN[tier.mk]}`,
        icon: nk.key === 'smoke' ? '🌫️' : nk.key === 'wp' ? '🔥' : '🧨',
        family: 'grenade', tier: tier.mk,
        damage: Math.round(nk.damage * tier.dmg),
        rof: 1.1, speed: 34, spread: 0.015 * tier.spread, pellets: 1,
        clip: 4 + tier.mk, reloadTime: 2.4 * tier.reload, reserve: Math.round(24 * tier.reserve),
        range: 44, splash: nk.splash, splashDamage: Math.round(nk.splashDamage * tier.dmg),
        arc: true, heals: false,
        knockback: nk.knockback ? Math.round(nk.knockback * tier.dmg * 10) / 10 : 0,
        sound: 'thump', tracer: 'shell', payload: nk.payload,
      };
    }
  }

  // ---- specials: demolition charge + the static emplacement gun ----
  out.demo_charge = {
    id: 'demo_charge', name: 'DX-9 Demolition Charge', icon: '🧨', family: 'special', tier: 3,
    damage: 120, rof: 0.25, speed: 12, spread: 0, pellets: 1, clip: 1, reloadTime: 5,
    reserve: 3, range: 10, splash: 8, splashDamage: 140, arc: true, heals: false,
    knockback: 16, sound: 'thump', tracer: 'shell',
  };
  out.emplacement_gun = {
    id: 'emplacement_gun', name: 'Bulwark Emplacement Gun', icon: '🧰', family: 'special', tier: 3,
    damage: 55, rof: 1.6, speed: 90, spread: 0.01, pellets: 1, clip: Infinity, reloadTime: 0,
    reserve: Infinity, range: 95, splash: 3.5, splashDamage: 35, arc: false, heals: false,
    knockback: 10, sound: 'cannon', tracer: 'shell',
  };
  out.bike_mg = {
    id: 'bike_mg', name: 'Bike MG', family: 'special', tier: 1,
    damage: 9, rof: 11, speed: 108, spread: 0.05, pellets: 1, clip: Infinity, reloadTime: 0,
    reserve: Infinity, range: 45, splash: 0, splashDamage: 0, arc: false, heals: false,
    knockback: 0, sound: 'smg', tracer: 'bullet',
  };
  out.flyer_plasma = {
    id: 'flyer_plasma', name: 'Flyer Plasma Battery', family: 'special', tier: 2,
    damage: 16, rof: 6, speed: 70, spread: 0.03, pellets: 1, clip: Infinity, reloadTime: 0,
    reserve: Infinity, range: 55, splash: 0, splashDamage: 0, arc: false, heals: false,
    knockback: 0, sound: 'plasma', tracer: 'plasma',
  };
  out.transport_mg = {
    id: 'transport_mg', name: 'Transport Defense MG', family: 'special', tier: 1,
    damage: 10, rof: 7, speed: 100, spread: 0.05, pellets: 1, clip: Infinity, reloadTime: 0,
    reserve: Infinity, range: 40, splash: 0, splashDamage: 0, arc: false, heals: false,
    knockback: 0, sound: 'smg', tracer: 'bullet',
  };

  return out;
}

// ---------------------------------------------------------------------------
// Class armory: which families each class may draw primaries from.
// Secondary slot is always the pistol family. Class defaults from data.ts
// remain the "issue" loadout.
// ---------------------------------------------------------------------------

export const CLASS_ARMORY: Record<ClassId, WeaponFamily[]> = {
  infantry:    ['rifle', 'carbine', 'shotgun', 'slugger', 'laser', 'scatter', 'grenade'],
  heavy:       ['hmg', 'lmg', 'at_rocket', 'ap_rocket', 'mortar', 'artillery', 'sonic'],
  jump:        ['smg', 'carbine', 'shotgun', 'scatter'],
  engineer:    ['shotgun', 'slugger', 'smg', 'scatter'],
  medic:       ['smg', 'carbine'],
  infiltrator: ['laser', 'rifle'],
  pathfinder:  ['carbine', 'sonic', 'smg'],
  ghost:       ['laser', 'smg', 'carbine'],
};

/** All weapon ids of a family, sorted for stable menus. */
export function familyWeapons(table: Record<WeaponId, WeaponDef>, family: WeaponFamily): WeaponDef[] {
  return Object.values(table)
    .filter((w) => w.family === family)
    .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || a.id.localeCompare(b.id));
}
