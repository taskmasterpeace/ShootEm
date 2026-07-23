import { buildArsenal } from './arsenal';
import type { ClassDef, ClassId, ThemeId, VehicleDef, VehicleKind, WeaponDef, WeaponFamily, WeaponId } from './types';

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
  ar606: W({ id: 'ar606', name: 'Maklov AR-606', damage: 13, rof: 7.5, speed: 110, spread: 0.025, clip: 30, reserve: 150, range: 66, sound: 'rifle',
    alt: { kind: 'burst', ammo: 3, cooldown: 2.6 } }), // under-barrel flame burp
  kuchler: W({ id: 'kuchler', name: 'Kuchler K6 SMG', damage: 9, rof: 12, speed: 95, spread: 0.05, clip: 40, reloadTime: 1.3, range: 40, sound: 'smg' }),
  caw: W({ id: 'caw', name: 'CAW-8 Shotgun', damage: 9, rof: 1.4, speed: 80, spread: 0.11, pellets: 8, clip: 6, reloadTime: 2.2, reserve: 60, range: 26, sound: 'shotgun', tracer: 'shell' }),
  // THE BOOMSTICK (Robert: "duel barrel"): the sawn-off hero of the scatter
  // family. Both barrels on ONE press (fireMode double), a 2-round clip so that
  // press empties it — then you break it open and reload. Murder point-blank
  // (11×11 pellets), useless past a room (range 18, wide choke). DPS-neutral by
  // the fireMode law; the burst is front-loaded, the sheet unchanged.
  boomstick: W({ id: 'boomstick', name: 'The Boomstick', damage: 11, rof: 1.5, speed: 76, spread: 0.17, pellets: 11, clip: 2, reloadTime: 2.7, reserve: 24, range: 18, fireMode: 'double', family: 'scatter', sound: 'shotgun', tracer: 'shell', icon: '💥' }),
  rg2: W({ id: 'rg2', name: 'RG-2 Railgun', damage: 85, rof: 0.8, speed: 300, spread: 0.001, clip: 4, reloadTime: 2.4, reserve: 32, range: 125, sound: 'rail', tracer: 'rail',
    alt: { kind: 'tag', ammo: 4, cooldown: 1.4 } }), // tag dart — pin the runner, then line up the real shot
  ac_mk2: W({ id: 'ac_mk2', name: 'AC-Mk2 Autocannon', damage: 16, rof: 6.5, speed: 100, spread: 0.04, clip: 60, reloadTime: 2.8, reserve: 300, range: 56, sound: 'autocannon' }),
  mml: W({ id: 'mml', name: 'Micro-Missile Launcher', damage: 65, rof: 0.9, speed: 42, spread: 0.01, clip: 3, reloadTime: 2.6, reserve: 24, range: 80, splash: 5.4, splashDamage: 45, knockback: 14, sound: 'rocket', tracer: 'rocket' }),
  gl: W({ id: 'gl', name: 'GL-40 Grenade Launcher', damage: 55, rof: 1.1, speed: 34, clip: 5, reloadTime: 2.4, reserve: 30, range: 46, splash: 6, splashDamage: 50, knockback: 13, arc: true, sound: 'thump', tracer: 'frag',
    alt: { kind: 'skitter', ammo: 2, cooldown: 3 } }), // the SKITTER — a charge on legs that runs them down
  plasma: W({ id: 'plasma', name: 'Kamenel Plasma', damage: 21, rof: 5, speed: 60, spread: 0.015, clip: 25, reloadTime: 1.8, reserve: Infinity, range: 54, sound: 'plasma', tracer: 'plasma',
    alt: { kind: 'overcharge', ammo: 0, cooldown: 1.6, cells: 6 } }), // six cells, one ugly orb
  flamer: W({ id: 'flamer', name: 'F-3 Flamer', damage: 7, rof: 14, speed: 28, spread: 0.12, clip: 100, reloadTime: 2.5, reserve: 200, range: 16, sound: 'flame', tracer: 'flame' }),
  pistol: W({ id: 'pistol', name: 'P9 Sidearm', damage: 12, rof: 4.5, speed: 100, spread: 0.02, clip: 12, reloadTime: 1.1, reserve: Infinity, range: 44, sound: 'pistol', fireMode: 'single' }), // THE eternal sidearm — never empty, so a dry primary always has a fallback (Robert's ammo pass). 10.1: SINGLE — one deliberate round per press
  repair: W({ id: 'repair', name: 'Repair Gun', damage: 30, rof: 4, speed: 200, spread: 0, clip: Infinity, reloadTime: 0, reserve: Infinity, range: 12, heals: true, sound: 'repair', tracer: 'beam' }),
  medibeam: W({ id: 'medibeam', name: 'Medi-Beam', damage: 22, rof: 4, speed: 200, spread: 0, clip: Infinity, reloadTime: 0, reserve: Infinity, range: 14, heals: true, sound: 'heal', tracer: 'beam' }),
  impulse: W({ id: 'impulse', name: 'Impulse Cannon', damage: 30, rof: 1.5, speed: 55, spread: 0.008, clip: 8, reloadTime: 2, reserve: 64, range: 54, splash: 3.3, splashDamage: 18, knockback: 17, sound: 'impulse', tracer: 'rail' }),
  emp: W({ id: 'emp', name: 'EMP Charge', damage: 0, rof: 0.8, speed: 30, clip: 1, reserve: 0, range: 42, arc: true, sound: 'thump', tracer: 'plasma' }),
  target_beacon: W({ id: 'target_beacon', name: 'Targeting Beacon', damage: 0, rof: 0.8, speed: 28, clip: 1, reserve: 0, range: 44, arc: true, sound: 'thump', tracer: 'shell' }),
  // THE GRENADE BAG (Robert): hand-thrown canisters on the same loft wheel
  // and bank-shot physics as the frag. The payload field is the pop —
  // detonatePayload already knows how to deliver smoke and fire.
  smoke_nade: W({ id: 'smoke_nade', name: 'M-77 Smoke', damage: 0, rof: 0.8, speed: 16, clip: 1, reserve: 0, range: 26, arc: true, payload: 'smoke', sound: 'thump', tracer: 'canister' }),
  fire_nade: W({ id: 'fire_nade', name: 'T-4 Incendiary', damage: 0, rof: 0.8, speed: 16, clip: 1, reserve: 0, range: 26, arc: true, payload: 'fire', sound: 'thump', tracer: 'canister' }),
  conc_nade: W({ id: 'conc_nade', name: 'C-9 Concussion', damage: 0, rof: 0.8, speed: 16, clip: 1, reserve: 0, range: 26, splash: 6.5, splashDamage: 18, knockback: 26, arc: true, payload: 'concussion', sound: 'thump', tracer: 'canister', icon: '💫' }),
  // THE SINGULARITY (Robert): lands, opens a gravity WELL that YANKS the enemy
  // squad into a cluster for ~1.2s, then COLLAPSES on the pile. splash/splashDamage
  // here are the implosion; the pull does no damage of its own — it sets the kill up.
  grav_nade: W({ id: 'grav_nade', name: 'G-7 Singularity', damage: 0, rof: 0.8, speed: 16, clip: 1, reserve: 0, range: 26, splash: 6, splashDamage: 34, knockback: 0, arc: true, payload: 'grav', sound: 'thump', tracer: 'canister', icon: '🌀' }),
  // THE STICK (Robert): a plasma charge that ADHERES to the first body it meets
  // and rides it to the grave — ~1.3s fuse, then an energy burst that bites armor.
  plasma_nade: W({ id: 'plasma_nade', name: 'P-11 Plasma Stick', damage: 0, rof: 0.8, speed: 22, clip: 1, reserve: 0, range: 28, splash: 4.5, splashDamage: 58, knockback: 12, arc: true, payload: 'plasma', sticky: true, sound: 'plasma', tracer: 'plasma', icon: '🔵' }),
  // THE DEMOLITION TIMER (Robert: "time bombs"): planted at your feet, it BEEPS
  // down a ~4s fuse (telegraphed — the enemy can flee) then LEVELS the room. The
  // blast numbers below; damage ≥100 breaches masonry (it's a demo charge).
  time_bomb: W({ id: 'time_bomb', name: 'TX-4 Demolition Charge', damage: 120, rof: 0.5, speed: 1, clip: 1, reserve: 0, range: 4, splash: 8, splashDamage: 90, knockback: 20, sound: 'thump', tracer: 'none', icon: '⏱️' }),
  // M3 THE REPLACEMENT (Robert: "I don't think we need to add weapons, I
  // think we need to replace weapons… concussion grenades, no fire, just
  // concussed, with maximum knockback"). The jump trooper's GL-40 becomes
  // the CL-40: same launcher handling, but the round is PURE CONCUSSION —
  // 14 splash damage (a slap), knockback 30 (the maximum on any launcher),
  // which crosses the ragdoll threshold out to ~3u. It flips people; the
  // jetpack class becomes the crowd-control skirmisher, not a bomber.
  cl40: W({ id: 'cl40', name: 'CL-40 Concussor', damage: 0, rof: 1.1, speed: 34, clip: 5, reloadTime: 2.4, reserve: 30, range: 46, splash: 6.5, splashDamage: 14, knockback: 30, arc: true, payload: 'concussion', sound: 'thump', tracer: 'canister', icon: '💫' }),
  // M5 THE BREACHER'S AXE (Robert: "you can give them a thing they can throw
  // and retrieve"). Thrown flat and fast, it BURIES itself where it lands and
  // waits. Press F again and it tears free and flies home — hurting anything
  // on the return path. One axe per soldier: throw it badly and you're on
  // your rifle until you go get it or call it back.
  axe: W({ id: 'axe', name: 'Breacher Axe', damage: 62, rof: 1.1, speed: 30, clip: 1, reserve: 0, range: 30, knockback: 6, sound: 'claw', tracer: 'frag' }),
  orbital_beacon: W({ id: 'orbital_beacon', name: 'Orbital Designator', damage: 0, rof: 0.5, speed: 26, clip: 1, reserve: 0, range: 42, arc: true, sound: 'thump', tracer: 'rocket' }),
  buggy_mg: W({ id: 'buggy_mg', name: 'Buggy MG', damage: 11, rof: 10, speed: 110, spread: 0.045, clip: Infinity, reserve: Infinity, range: 52, sound: 'smg' }),
  tank_cannon: W({ id: 'tank_cannon', name: '120mm Cannon', damage: 110, rof: 0.5, speed: 70, spread: 0.004, clip: Infinity, reserve: Infinity, range: 94, splash: 6.5, splashDamage: 60, knockback: 18, sound: 'cannon', tracer: 'rocket' }),
  // the Goliath's arm gun: sustained anti-infantry fire with a light splash —
  // strong vs flesh in the open, mediocre vs armor. The tank stays armor king.
  mech_autocannon: W({ id: 'mech_autocannon', name: 'GAU-9 Arm Cannon', damage: 22, rof: 4, speed: 100, spread: 0.025, clip: Infinity, reserve: Infinity, range: 68, splash: 1.2, splashDamage: 8, knockback: 2, sound: 'autocannon', tracer: 'shell' }),
  // the stomp: not a gun — an AoE ground slam resolved through explode().
  // The knockback IS the weapon; the damage is a bruise, not a kill.
  mech_stomp: W({ id: 'mech_stomp', name: 'Seismic Stomp', damage: 0, rof: 1, speed: 1, clip: Infinity, reserve: Infinity, range: 5, splash: 5.4, splashDamage: 35, knockback: 16, sound: 'thump', tracer: 'none' }),
  boat_mg: W({ id: 'boat_mg', name: 'Pike Deck MG', damage: 12, rof: 9, speed: 105, spread: 0.04, clip: Infinity, reserve: Infinity, range: 56, sound: 'autocannon' }),
  apc_mg: W({ id: 'apc_mg', name: 'APC MG', damage: 12, rof: 8, speed: 105, spread: 0.04, clip: Infinity, reserve: Infinity, range: 55, sound: 'autocannon' }),
  skiff_plasma: W({ id: 'skiff_plasma', name: 'Skiff Plasma', damage: 18, rof: 7, speed: 65, spread: 0.02, clip: Infinity, reserve: Infinity, range: 50, sound: 'plasma', tracer: 'plasma' }),
  turret_mg: W({ id: 'turret_mg', name: 'Sentry MG', damage: 10, rof: 5, speed: 100, spread: 0.03, clip: Infinity, reserve: Infinity, range: 38, sound: 'smg' }),
  zombie_claw: W({ id: 'zombie_claw', name: 'Claws', damage: 14, rof: 1.2, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.2, sound: 'claw', tracer: 'none' }),
  dog_bite: W({ id: 'dog_bite', name: 'K9 Bite', damage: 16, rof: 1.6, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.0, sound: 'claw', tracer: 'none', icon: '🐕' }),
  // THE STRIKE (OUTBREAK-SPEC §12): the universal melee every soldier owns on
  // F — the outbreak's answer to "out of ammo, shambler on me." Short reach,
  // real punch (drops a base shambler in ~5), reuses the claw swing engine.
  // Never occupies a weapon slot; it is always in hand at knife range.
  unarmed: W({ id: 'unarmed', name: 'Bare Hands', damage: 18, rof: 1.8, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 1.9, knockback: 2, sound: 'claw', tracer: 'none', family: 'melee', meleeTrait: 'force', icon: '✊' }),
  baseball_bat: W({ id: 'baseball_bat', name: 'Baseball Bat', damage: 30, rof: 1.15, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.4, knockback: 11, sound: 'claw', tracer: 'none', family: 'melee_weapon', meleeTrait: 'force', icon: '🏏' }),
  katana: W({ id: 'katana', name: 'Katana', damage: 38, rof: 1.3, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.5, knockback: 2, sound: 'claw', tracer: 'none', family: 'melee_weapon', meleeTrait: 'blood', bleedSeconds: 3, bleedDps: 4, icon: '🗡️' }),
  fire_axe: W({ id: 'fire_axe', name: 'Fire Axe', damage: 46, rof: 0.9, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.35, knockback: 6, sound: 'claw', tracer: 'none', family: 'melee_weapon', meleeTrait: 'pierce', icon: '🪓' }),
  knife: W({ id: 'knife', name: 'Combat Knife', damage: 34, rof: 1.5, speed: 20, spread: 0, clip: Infinity, reserve: Infinity, range: 2.2, sound: 'claw', tracer: 'none', icon: '🔪' }),
  // ---- paintball markers (§3.3/§14): one splat and you're OUT. Damage 999
  // rides the §4.3 overkill rule — paint skips the crawl, nobody bleeds. ----
  // Reloads are LONG on purpose (Robert): fumbling pods into the hopper while
  // the pack closes in IS paintball — the reload bar becomes the drama.
  // Ball speed has been tuned by Robert THREE times now, and the law that
  // survived all three passes is a RATIO, not a number: paint must fly well
  // under a live round (dodging IS the game) but can't float (the quarter-
  // rifle era "seemed too slow… way faster than it is right now, but slower
  // than the bullets"). Markers now fly at roughly HALF a rifle round —
  // you still see the ball leave the barrel, you just have to actually move.
  // Bots lead your current velocity, so changing direction beats the math.
  // They are also `training: true` — paint marks men, never buildings.
  marker_blitz: W({ id: 'marker_blitz', name: 'Blitz Marker', damage: 999, rof: 7, speed: 60, spread: 0.05, clip: 30, reloadTime: 2.6, reserve: 300, range: 34, family: 'marker', sound: 'marker', tracer: 'paint', training: true, icon: '🎨' }),
  marker_pump: W({ id: 'marker_pump', name: 'Pump Marker', damage: 999, rof: 1.3, speed: 72, spread: 0.006, clip: 8, reloadTime: 3.2, reserve: 80, range: 52, family: 'marker', sound: 'marker_pump', tracer: 'paint', training: true, icon: '🎨' }),
  marker_lobber: W({ id: 'marker_lobber', name: 'The Lobber', damage: 999, rof: 1.8, speed: 34, spread: 0.01, clip: 6, reloadTime: 3.5, reserve: 48, range: 36, splash: 1.8, splashDamage: 999, arc: true, family: 'marker', sound: 'marker_lob', tracer: 'paint', training: true, icon: '🎨' }),
  // THE FAN (Robert: "I don't know if they got shotgun paintball stuff"):
  // seven balls in one press — a wall of paint that owns the doorway and
  // nothing past it. CQC band (range 16), the shortest leash in the yard.
  marker_scatter: W({ id: 'marker_scatter', name: 'The Fan', damage: 999, rof: 1.1, speed: 55, spread: 0.16, pellets: 7, clip: 4, reloadTime: 2.9, reserve: 56, range: 16, family: 'marker', sound: 'marker_pump', tracer: 'paint', training: true, icon: '🎨' }),
  // PAINT GRENADE (Robert: "we need to have paintball grenades"): the yard's
  // one thrown item — a paint bomb that splats everyone in its circle. Thrown
  // with G through the world.ts paintball branch; never leaves the yard.
  paint_nade: W({ id: 'paint_nade', name: 'Paint Grenade', damage: 999, rof: 1, speed: 16, spread: 0, clip: 1, reserve: 0, range: 22, splash: 2.6, splashDamage: 999, arc: true, sound: 'marker_lob', tracer: 'paint', training: true, icon: '🎨' }),
  // ---- alt-fire internals (never drawn from the armory; fired by fireAltWeapon) ----
  tag_dart: W({ id: 'tag_dart', name: 'Tag Dart', damage: 4, rof: 1, speed: 160, spread: 0.002, clip: 1, reserve: 0, range: 100, sound: 'rail', tracer: 'rail', tagsTarget: true }),
  plasma_orb: W({ id: 'plasma_orb', name: 'Plasma Overcharge', damage: 60, rof: 1, speed: 40, spread: 0.004, clip: 1, reserve: 0, range: 54, splash: 3.5, splashDamage: 40, knockback: 8, sound: 'plasma', tracer: 'plasma' }),
  void_bolt: W({ id: 'void_bolt', name: 'Void Bolt', damage: 45, rof: 1, speed: 24, clip: Infinity, reserve: Infinity, range: 60, splash: 3.5, splashDamage: 35, knockback: 6, arc: true, sound: 'plasma', tracer: 'plasma' }),
  soil_spike: W({ id: 'soil_spike', name: 'Soil Spike', damage: 40, rof: 1, speed: 14, clip: Infinity, reserve: Infinity, range: 40, splash: 3, splashDamage: 30, knockback: 8, sound: 'thump', tracer: 'shell' }),
  magma_rock: W({ id: 'magma_rock', name: 'Molten Rock', damage: 40, rof: 1, speed: 20, clip: Infinity, reserve: Infinity, range: 50, splash: 3, splashDamage: 30, knockback: 8, arc: true, payload: 'fire', sound: 'thump', tracer: 'shell' }),
  flesh_glob: W({ id: 'flesh_glob', name: 'Hurled Flesh', damage: 34, rof: 1, speed: 22, clip: Infinity, reserve: Infinity, range: 46, splash: 2.2, splashDamage: 22, knockback: 6, sound: 'acid', tracer: 'acid' }),
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


// ═══════════════════════════════════════════════════════════════════════════
// THE SIGNATURE ARMS (armament doctrine, ratified 2026-07-18): a Living
// Super Weapon never sounds like infantry. One weapon per god — beams hum,
// arcs crack, rails scream, and six carry nothing but their own body.
// Practical DPS sits in the AR-606's ballpark (~90-110) so every measured
// threat band survives the swap; the threat rig is the safety net. Clips are
// Infinity — gods don't fumble magazines. Family 'lsw' marks them so
// spawn() hands mortals their own kit back at respawn.
// ═══════════════════════════════════════════════════════════════════════════
const A = (w: Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'name' | 'damage' | 'rof'>): WeaponDef =>
  W({ clip: Infinity, reserve: Infinity, reloadTime: 0, family: 'lsw', ...w });

export const LSW_ARMS: Record<WeaponId, WeaponDef> = {
  // ── THE UNARMED SIX — the body is the gun. The leapers (titan/crusher/
  //    ragebeast) carry a LAND shockwave; leviathan/gargoyle/blitz aren't
  //    leapers, so their heavy melee weapon does the work. ──
  lsw_titan: A({ id: 'lsw_titan', name: 'Seismic Fists', damage: 62, rof: 1.7, speed: 200, spread: 0.01, range: 12, knockback: 8, sound: 'claw', tracer: 'none', icon: '👊', shockwave: 5 }),
  lsw_crusher: A({ id: 'lsw_crusher', name: 'Demolition Hands', damage: 58, rof: 1.8, speed: 200, spread: 0.01, range: 11, knockback: 6, sound: 'claw', tracer: 'none', icon: '🔨', shockwave: 5 }),
  lsw_ragebeast: A({ id: 'lsw_ragebeast', name: 'Rending Claws', damage: 34, rof: 3.0, speed: 200, spread: 0.01, range: 10, sound: 'ragebeast_attack1', tracer: 'none', icon: '🩸', shockwave: 3 }),
  lsw_leviathan: A({ id: 'lsw_leviathan', name: 'The Hull Itself', damage: 70, rof: 1.4, speed: 200, spread: 0.01, range: 14, knockback: 10, sound: 'claw', tracer: 'none', icon: '🏗' }),
  lsw_gargoyle: A({ id: 'lsw_gargoyle', name: 'Stone Talons', damage: 48, rof: 2.1, speed: 200, spread: 0.01, range: 11, sound: 'claw', tracer: 'none', icon: '🦅' }),
  lsw_blitz: A({ id: 'lsw_blitz', name: 'Momentum Blade', damage: 30, rof: 3.4, speed: 200, spread: 0.01, range: 10, sound: 'claw', tracer: 'none', icon: '⚔' }),
  // ── THE BEAM SCHOOL — continuous energy, now with a profile per god ──
  // §BEAMS row 192 TORRENT: the Feed-Beam is a FLOOD — held, wide catch
  // (1.6u vs the 1.1 default), dps 99 = the old 11×9. Easy to keep ON a
  // dodging target; the trade is the same heat clock as everyone.
  lsw_reactor: A({ id: 'lsw_reactor', name: 'Feed-Beam', damage: 11, rof: 9, speed: 300, spread: 0.002, range: 46, sound: 'plasma', tracer: 'beam', icon: '🔆', beam: 'hose', ricochet: 1, held: { dps: 99, sustain: 3, jam: 2.5, catchR: 1.6 } }),
  // §BEAMS row 188: the Siphon is the first HELD stream — a siphon POURS, it
  // doesn't tap. dps 100 = the old 10 dmg × 10 rof (DPS-neutral conversion);
  // the heat governor (4s pour → 2.5s jam) is the held-beam design itself.
  lsw_crimson: A({ id: 'lsw_crimson', name: 'Haemal Siphon', damage: 10, rof: 10, speed: 300, spread: 0.002, range: 40, sound: 'plasma', tracer: 'beam', icon: '🩸', beam: 'hose', held: { dps: 100, sustain: 4, jam: 2.5 } }),
  // §BEAMS row 192 PRISM: induction won't stay in one line — the first
  // body becomes a NODE and the stream FANS: up to 2 nearby enemies (10u,
  // clear line from the node) each drink 45%. dps 100 ≈ the old 12×8.5.
  lsw_magnetar: A({ id: 'lsw_magnetar', name: 'Induction Beam', damage: 12, rof: 8.5, speed: 300, spread: 0.002, range: 44, sound: 'plasma', tracer: 'beam', icon: '🧲', beam: 'ricochet', ricochet: 2, held: { dps: 100, sustain: 3.5, jam: 2.5, prism: { count: 2, frac: 0.45, radius: 10 } } }),
  // §BEAMS row 192 LANCE: the Resonance Projector DRILLS — held, pierces
  // through up to 3 bodies (each drinks full dps·dt; walls still stop
  // it), dps 98 ≈ the old 13×7.5. Runs hotter: 3.5s pour, 3s jam.
  lsw_pulse: A({ id: 'lsw_pulse', name: 'Resonance Projector', damage: 13, rof: 7.5, speed: 300, spread: 0.002, range: 48, sound: 'plasma', tracer: 'beam', icon: '📢', beam: 'lance', pierce: 3, held: { dps: 98, sustain: 3.5, jam: 3, pierce: 3 } }),
  lsw_eclipse: A({ id: 'lsw_eclipse', name: 'Lightdrinker', damage: 12, rof: 8.5, speed: 300, spread: 0.002, range: 50, sound: 'plasma', tracer: 'beam', icon: '🌑', beam: 'charge', charge: { t: 1.0, mul: 3 } }),
  lsw_frostbite: A({ id: 'lsw_frostbite', name: 'Cryo-Stream', damage: 11, rof: 9, speed: 300, spread: 0.002, range: 42, sound: 'plasma', tracer: 'beam', icon: '❄', beam: 'hose' }),
  lsw_sniperhawk: A({ id: 'lsw_sniperhawk', name: 'The Long Rail', damage: 88, rof: 1.15, speed: 300, spread: 0.001, range: 110, sound: 'rail', tracer: 'rail', icon: '🎯', pierce: 4, pierceArmor: true }),
  // ── THE ARC SCHOOL — lightning in hand ──
  lsw_voltstriker: A({ id: 'lsw_voltstriker', name: 'Arc Caster', damage: 24, rof: 4.2, speed: 140, spread: 0.015, range: 40, sound: 'rail', tracer: 'plasma', icon: '⚡', chain: 2, ricochet: 1 }),
  lsw_overload: A({ id: 'lsw_overload', name: 'Capacitor Bolts', damage: 26, rof: 4, speed: 140, spread: 0.015, range: 34, sound: 'rail', tracer: 'plasma', icon: '🔌', cluster: 3 }),
  lsw_stormcaller: A({ id: 'lsw_stormcaller', name: 'Sky-Spark Javelins', damage: 34, rof: 3, speed: 140, spread: 0.01, range: 52, sound: 'rail', tracer: 'plasma', icon: '🌩', charge: { t: 0.7, mul: 2 } }),
  lsw_wraith: A({ id: 'lsw_wraith', name: 'Ghost-Static', damage: 22, rof: 4.5, speed: 140, spread: 0.02, range: 38, sound: 'rail', tracer: 'plasma', icon: '👻', pierce: 3 }),
  lsw_dominator: A({ id: 'lsw_dominator', name: 'Psi-Arc', damage: 25, rof: 4, speed: 140, spread: 0.01, range: 46, sound: 'rail', tracer: 'plasma', icon: '🧵', tether: true }),
  // ── THE THROWN-SUN SCHOOL — slow enough to SEE, and now they LAY FIRE where they
  // land: `ignite` is consumed in explode() (W7.3 field-fire shipped 2026-07-22) ──
  lsw_firebrand: A({ id: 'lsw_firebrand', name: 'Flame Gouts', damage: 20, rof: 5, speed: 30, spread: 0.03, range: 30, splash: 2.6, splashDamage: 16, sound: 'flame', tracer: 'flame', icon: '🔥', ignite: true }),
  lsw_inferno: A({ id: 'lsw_inferno', name: 'Fireball Spit', damage: 40, rof: 2.5, speed: 26, spread: 0.02, range: 36, splash: 2.5, splashDamage: 18, sound: 'flame', tracer: 'flame', icon: '☄', charge: { t: 0.6, mul: 2 }, ignite: true }),
  lsw_pyroclasm: A({ id: 'lsw_pyroclasm', name: 'Magma Bolts', damage: 48, rof: 2, speed: 24, spread: 0.02, range: 40, splash: 3, splashDamage: 22, sound: 'flame', tracer: 'flame', icon: '🌋', cluster: 3, ignite: true }),
  lsw_plaguebearer: A({ id: 'lsw_plaguebearer', name: 'Bile Lobber', damage: 34, rof: 2.8, speed: 26, spread: 0.03, range: 32, splash: 2.5, splashDamage: 16, sound: 'flame', tracer: 'acid', icon: '🤢', gasAfter: { kind: 'caustic', r: 2.5, life: 5 } }),
  lsw_venom: A({ id: 'lsw_venom', name: 'Needle Spray', damage: 8, rof: 12, speed: 60, spread: 0.06, range: 30, sound: 'smg', tracer: 'acid', icon: '💉', pierce: 1, gasAfter: { kind: 'poison', r: 2, life: 4 } }),
  lsw_riptide: A({ id: 'lsw_riptide', name: 'Hydro-Lance', damage: 30, rof: 3.4, speed: 80, spread: 0.015, range: 38, knockback: 3, sound: 'plasma', tracer: 'beam', icon: '🌊', beam: 'lance' }),
  // ── THE PHANTOM SCHOOL — quiet, strange, precise ──
  lsw_phantom: A({ id: 'lsw_phantom', name: 'Wall-Whisper Needler', damage: 16, rof: 6.5, speed: 120, spread: 0.01, range: 34, sound: 'smg', tracer: 'none', icon: '🤫', pierce: 3 }),
  lsw_shadowstep: A({ id: 'lsw_shadowstep', name: 'Void Knives', damage: 34, rof: 3, speed: 70, spread: 0.02, range: 22, sound: 'claw', tracer: 'none', icon: '🗡', boomerang: true }),
  lsw_specter: A({ id: 'lsw_specter', name: 'Mirror Shards', damage: 17, rof: 6, speed: 90, spread: 0.03, range: 30, sound: 'smg', tracer: 'none', icon: '🪞', cluster: 3 }),
  lsw_mirage: A({ id: 'lsw_mirage', name: 'Light-Bender', damage: 13, rof: 7.5, speed: 300, spread: 0.02, range: 50, sound: 'rifle', tracer: 'beam', icon: '🎭', beam: 'zap', ricochet: 1 }),
  lsw_voidwalker: A({ id: 'lsw_voidwalker', name: 'Entropy Pistol', damage: 52, rof: 2, speed: 90, spread: 0.01, range: 36, sound: 'plasma', tracer: 'plasma', icon: '🕳', pierce: 2 }),
  lsw_nightmare: A({ id: 'lsw_nightmare', name: 'Psi-Lash', damage: 12, rof: 8.5, speed: 300, spread: 0.015, range: 40, sound: 'smg', tracer: 'none', icon: '😱', gasAfter: { kind: 'fear', r: 3, life: 2 } }),
  lsw_reaper: A({ id: 'lsw_reaper', name: 'The Chain', damage: 45, rof: 2.2, speed: 60, spread: 0.01, range: 16, sound: 'claw', tracer: 'none', icon: '⛓', tether: true }),
  lsw_chronos: A({ id: 'lsw_chronos', name: 'Dilation Bolts', damage: 85, rof: 1.2, speed: 300, spread: 0.003, range: 60, sound: 'rail', tracer: 'rail', icon: '⏳', pierce: 2 }),
  // ── THE ORDNANCE SCHOOL — physical and heavy ──
  lsw_vanguard: A({ id: 'lsw_vanguard', name: 'Shield-Edge Shockwave', damage: 12, rof: 2.2, speed: 90, spread: 0.14, pellets: 6, range: 14, sound: 'shotgun', tracer: 'shell', icon: '🛡' }),
  lsw_barrier: A({ id: 'lsw_barrier', name: 'Hardlight Repeater', damage: 15, rof: 6.5, speed: 130, spread: 0.02, range: 44, sound: 'plasma', tracer: 'plasma', icon: '🟩', ricochet: 2 }),
  lsw_gravwarden: A({ id: 'lsw_gravwarden', name: 'Graviton Pulses', damage: 30, rof: 3.3, speed: 100, spread: 0.01, range: 40, knockback: 2, sound: 'plasma', tracer: 'plasma', icon: '🌀' }),
  lsw_tremor: A({ id: 'lsw_tremor', name: 'Spike-Flingers', damage: 18, rof: 5.5, speed: 90, spread: 0.03, range: 34, sound: 'shotgun', tracer: 'shell', icon: '⛰', cluster: 4 }),
  lsw_venatrix: A({ id: 'lsw_venatrix', name: 'Harpoon Rifle', damage: 55, rof: 1.8, speed: 110, spread: 0.008, range: 42, sound: 'rifle', tracer: 'shell', icon: '🎣', pierce: 1 }),
  lsw_steelweaver: A({ id: 'lsw_steelweaver', name: 'Rivet Driver', damage: 22, rof: 4.5, speed: 120, spread: 0.02, range: 36, sound: 'rifle', tracer: 'shell', icon: '🔩', pierce: 2 }),
  lsw_oblivion: A({ id: 'lsw_oblivion', name: 'Event-Horizon Bolts', damage: 60, rof: 1.7, speed: 40, spread: 0.01, range: 44, sound: 'plasma', tracer: 'plasma', icon: '🕳', charge: { t: 0.8, mul: 2.5 }, gasAfter: { kind: 'singularity', r: 3, life: 2 } }),
  lsw_cataclysm: A({ id: 'lsw_cataclysm', name: 'Fault-Line Mortar', damage: 55, rof: 1.7, speed: 30, spread: 0.02, range: 40, splash: 3.5, splashDamage: 30, arc: true, sound: 'thump', tracer: 'shell', icon: '💥', cluster: 3 }),
};

export const WEAPONS: Record<WeaponId, WeaponDef> = { ...buildArsenal(), ...CORE_WEAPONS, ...LSW_ARMS };

/** OUTBREAK-SPEC §11.2 — the loaded round's tactical readout for the weapon
 *  HUD. `pen`/`noise`/`fire`/`corpse` are 0–3 legibility levels grounded in the
 *  actual ballistic behaviour (`world.ts`): AP's plate bite and light-cover
 *  punch, SUB's hush + range cut, TRC's loud target mark, INC/BNR corpse denial,
 *  EXP's soft-tissue maw. `role` is the one-word job; `label` is the full name,
 *  shared with the B-cycle toast so the two never drift. */
export interface AmmoInfo { label: string; role: string; pen: number; noise: number; fire: number; corpse: number;
  /** §11.3 SEPARATE MAGAZINES BY TYPE: how many SPECIAL rounds a soldier
   *  carries for this type — its own reload pool, spent per reload. Absent
   *  (ball) = the weapon's classic reserve. Scarcity is the doctrine:
   *  BNR is "expensive, limited" (spec §11.1), INC/EXP run short. */
  pool?: number }
export const AMMO_INFO: Record<string, AmmoInfo> = {
  ball: { label: 'STANDARD BALL',    role: 'GENERAL', pen: 1, noise: 2, fire: 0, corpse: 0 },
  ap:   { label: 'ARMOR-PIERCING',   role: 'ARMOR',   pen: 3, noise: 2, fire: 0, corpse: 0, pool: 60 },
  inc:  { label: 'INCENDIARY',       role: 'BURN',    pen: 1, noise: 2, fire: 3, corpse: 3, pool: 40 },
  trc:  { label: 'TRACER',           role: 'SPOT',    pen: 1, noise: 3, fire: 0, corpse: 0, pool: 60 },
  sub:  { label: 'SUBSONIC',         role: 'QUIET',   pen: 0, noise: 0, fire: 0, corpse: 0, pool: 60 },
  exp:  { label: 'EXPANDING',        role: 'FLESH',   pen: 0, noise: 2, fire: 0, corpse: 0, pool: 40 },
  bnr:  { label: 'BIO-NEUTRALIZING', role: 'DENIAL',  pen: 1, noise: 2, fire: 0, corpse: 3, pool: 20 },
};

// OUTBREAK-SPEC §11.2 — a weapon's TACTICAL FINGERPRINT, derived from what it
// actually does, never transcribed. The muzzle REPORT is the sound the audio
// already plays, so the NOISE bar you read is the same report that carries: a
// cannon wakes the block, a silenced subsonic barely stirs it, a laser hums.
// Calibrated so a service rifle carries exactly SPRINTER_WAKE_NOISE (18u) — the
// flat radius gunfire used before §11.2 — which keeps every seeded outbreak
// match identical for the neutral gun and only bends the loud/quiet ends.
const NOISE_BY_SOUND: Record<string, number> = {
  cannon: 30, rocket: 28, autocannon: 24, shotgun: 22, sonic: 20,
  impulse: 18, rifle: 18, thump: 16, rail: 16, smg: 14,
  pistol: 12, flame: 12, marker: 12, marker_pump: 12, marker_lob: 12,
  plasma: 9, repair: 4, heal: 4, claw: 0,
};
const NOISE_BY_FAMILY: Partial<Record<WeaponFamily, number>> = {
  artillery: 30, mortar: 30, at_rocket: 28, ap_rocket: 28, hmg: 26, lmg: 22,
  shotgun: 22, slugger: 22, scatter: 22, sonic: 20, rifle: 18, carbine: 16,
  smg: 14, grenade: 16, special: 16, pistol: 12, flamethrower: 12, laser: 8,
};

/**
 * The muzzle report's reach in world units — the sim's authoritative NOISE
 * number (feeds sprinter-wake) AND the HUD's NSE bar, so the two can never
 * drift. `sound` wins (every weapon has one, it names the report), then the
 * generated-arsenal `family`, then the tracer. The loaded round bends it:
 * subsonic is the quiet round, a tracer burns loud.
 */
export function weaponNoiseRadius(def: WeaponDef, ammoType?: string): number {
  let r: number | undefined = NOISE_BY_SOUND[def.sound];
  if (r === undefined && def.family) r = NOISE_BY_FAMILY[def.family];
  if (r === undefined) {
    r = def.tracer === 'shell' || def.tracer === 'rocket' ? 26
      : def.tracer === 'rail' ? 16
      : def.tracer === 'flame' ? 12
      : def.tracer === 'beam' || def.tracer === 'plasma' ? 9
      : def.tracer === 'none' ? 0
      : 18;
  }
  if (ammoType === 'sub') r *= 0.35;        // the whole point of subsonic
  else if (ammoType === 'trc') r *= 1.15;   // a tracer round announces itself
  return Math.max(0, Math.min(34, r));
}

export interface WeaponProfile { role: string; pen: number; noise: number; fire: number; corpse: number; }
const clamp3 = (n: number) => Math.max(0, Math.min(3, Math.round(n)));
// the NSE bar IS the wake radius, bucketed — rifle 18 → 2 (matches AMMO_INFO ball)
const noiseBar = (r: number): number => (r < 10 ? 0 : r < 16 ? 1 : r < 24 ? 2 : 3);
const ROLE_BY_FAMILY: Partial<Record<WeaponFamily, string>> = {
  laser: 'BEAM', flamethrower: 'BURN', sonic: 'CONCUSS', hmg: 'SUPPRESS', lmg: 'SUPPRESS',
  at_rocket: 'BLAST', ap_rocket: 'BLAST', mortar: 'BLAST', artillery: 'BLAST', grenade: 'BLAST',
  shotgun: 'CLOSE', slugger: 'CLOSE', scatter: 'CLOSE', pistol: 'SIDEARM',
};
const ROLE_BY_TRACER: Partial<Record<WeaponDef['tracer'], string>> = {
  beam: 'BEAM', flame: 'BURN', rail: 'PIERCE', plasma: 'PLASMA', rocket: 'BLAST', frag: 'BLAST',
};

/**
 * The weapon's PEN / NOISE / FIRE / CORPSE-denial ratings (0-3), for the §11.2
 * HUD readout — WEAPON + loaded round, so a silenced SMG and a tank cannon no
 * longer read identical, and the flamethrower's FIR▮▮▮ / the laser's NSE▯▯▯
 * finally show. Every rating traces to a real sim behaviour.
 */
export function weaponProfile(def: WeaponDef, ammoType?: string): WeaponProfile {
  const t = def.tracer, fam = def.family;
  // PENETRATION — what the round drives through (rail slugs & AP shells punch)
  let pen = t === 'rail' || t === 'shell' || fam === 'ap_rocket' ? 3
    : t === 'beam' || t === 'plasma' || fam === 'hmg' ? 2
    : t === 'acid' ? 1 : t === 'flame' ? 0 : 1;
  if (def.pierceArmor) pen = Math.max(pen, 2);
  if ((def.pierce ?? 0) > 0) pen += 1;
  // FIRE HAZARD — can it start a fire / cook a corpse
  let fire = fam === 'flamethrower' || t === 'flame' || def.ignite || def.payload === 'fire' ? 3
    : t === 'plasma' ? 1 : 0;
  // CORPSE DENIAL — the reanimation-stoppers: fire and blast (§17)
  let corpse = fire >= 3 ? 3 : (def.splash ?? 0) > 0 ? 2 : 0;
  let role: string | undefined;
  if (ammoType && ammoType !== 'ball' && AMMO_INFO[ammoType]) {
    const ai = AMMO_INFO[ammoType];       // the loaded round bends all three
    pen += ai.pen - 1;
    if (ammoType === 'exp') pen -= 1;     // expanding rounds mushroom — low pen
    fire = Math.max(fire, ai.fire);
    corpse = Math.max(corpse, ai.corpse);
    role = ai.role;
  }
  role = role ?? (fam && ROLE_BY_FAMILY[fam]) ?? (t && ROLE_BY_TRACER[t]) ?? 'GENERAL';
  return { role, pen: clamp3(pen), noise: noiseBar(weaponNoiseRadius(def, ammoType)), fire: clamp3(fire), corpse: clamp3(corpse) };
}

export const CLASSES: Record<ClassId, ClassDef> = {
  infantry: {
    id: 'infantry', name: 'Infantry', desc: 'Balanced rifleman. Extra frag grenades.',
    hp: 100, speed: 10.5, primary: 'ar606', secondary: 'pistol',
    ability: 'grenade', abilityName: 'Frag Grenade', color: 0xc9a86a,
  },
  heavy: {
    id: 'heavy', name: 'Heavy Weapons', energyRegen: 0.75, desc: 'Slow but devastating. Autocannon, missiles, shield dome.',
    hp: 145, speed: 8.2, primary: 'ac_mk2', secondary: 'mml',
    ability: 'shield', abilityName: 'Shield Dome (Q)', color: 0xb0623a,
  },
  jump: {
    id: 'jump', name: 'Jump Trooper', desc: 'Jetpack mobility. SMG skirmisher.',
    hp: 90, speed: 11.5, primary: 'kuchler', secondary: 'cl40',
    ability: 'jetpack', abilityName: 'Jetpack (Space)', color: 0x7fa8c9,
  },
  engineer: {
    id: 'engineer', name: 'Combat Engineer', energyRegen: 0.9, desc: 'Builds sentry turrets, repairs vehicles, plants mines.',
    hp: 110, speed: 9.5, primary: 'caw', secondary: 'repair',
    ability: 'turret', abilityName: 'Build Sentry (Q) / Mine (G)', color: 0x9a8f4f,
  },
  medic: {
    id: 'medic', name: 'Field Medic', desc: 'Heals squadmates with the medi-beam.',
    hp: 100, speed: 10.8, primary: 'kuchler', secondary: 'medibeam',
    ability: 'heal', abilityName: 'Self-Stim (Q)', color: 0x8fb98a,
  },
  infiltrator: {
    id: 'infiltrator', name: 'Infiltrator', energyRegen: 1.15, desc: 'Cloaking field + RG-2 railgun. Fragile.',
    hp: 80, speed: 11, primary: 'rg2', secondary: 'pistol',
    ability: 'cloak', abilityName: 'Cloak (Q)', color: 0x8a7fb9,
  },
  pathfinder: {
    id: 'pathfinder', name: 'Pathfinder', energyRegen: 1.35, desc: 'Warp beacon pair + knockback impulse cannon. Fastest boots in the war.',
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
  // W5.5 CARS HANDLE LIKE CARS: the wheeled runabouts ride the slip dial —
  // momentum carries through a hard turn (~0.3-0.5s of slide), and SPACE is
  // the HANDBRAKE (rear grip breaks, the tail steps out). Tracks/striders
  // stay on rails: a tank corners like a tank ON PURPOSE.
  buggy: { kind: 'buggy', name: 'Scout Buggy', cost: 1, hp: 95, speed: 19, turnRate: 2.6, weapon: 'buggy_mg', seats: 2, mobileSpawn: false, radius: 1.6, systemHp: 24, slip: 2.4 },
  // The Ares is a crewed weapons platform: driver/gunner + sensors + ECM +
  // comms stations, plus 4 passenger benches for when leg work is required.
  // Every subsystem has its own hit points — tanks break in many ways.
  tank: {
    kind: 'tank', name: 'Ares Battle Tank', cost: 4, hp: 650, speed: 11, turnRate: 1.5,
    weapon: 'tank_cannon', seats: 8, mobileSpawn: false, radius: 2.4,
    crew: ['sensors', 'ecm', 'comms'], systemHp: 60,
  },
  apc: { kind: 'apc', name: 'Bastion APC', cost: 3, hp: 450, speed: 14, turnRate: 1.8, weapon: 'apc_mg', seats: 4, mobileSpawn: true, radius: 2.2, systemHp: 45 },
  skiff: { kind: 'skiff', name: 'Wraith Skiff', cost: 1, hp: 90, speed: 22, turnRate: 3.2, weapon: 'skiff_plasma', seats: 1, mobileSpawn: false, radius: 1.4, hover: true, systemHp: 18 },
  hoverboard: {
    kind: 'hoverboard', name: 'Halo Hoverboard', cost: 1, hp: 45, speed: 24, turnRate: 4.2,
    weapon: '', seats: 1, mobileSpawn: false, radius: 0.8, hover: true, systemHp: 10,
    // the one hull that DRIFTS: velocity chases the nose at 2.6/s, so a hard
    // carve at speed slides ~0.4s before the board bites. Slippery, not soap.
    slip: 2.6,
  },
  // ── THE RACEBOARDS — three points of a speed/handling triangle, tuned for
  // the Motor Trials. All hover, all unarmed; the trade is top-speed vs bite.
  comet: {
    kind: 'comet', name: 'Comet Raceboard', cost: 1, hp: 38, speed: 31, turnRate: 3.4,
    weapon: '', seats: 1, mobileSpawn: false, radius: 0.8, hover: true, systemHp: 10,
    slip: 3.4, // fastest flat-out, but it drifts wide — commit early or overshoot
  },
  vector: {
    kind: 'vector', name: 'Vector Raceboard', cost: 1, hp: 44, speed: 26, turnRate: 4.6,
    weapon: '', seats: 1, mobileSpawn: false, radius: 0.8, hover: true, systemHp: 10,
    slip: 2.4, // the all-rounder — no weakness, no standout
  },
  sprite: {
    kind: 'sprite', name: 'Sprite Raceboard', cost: 1, hp: 50, speed: 22, turnRate: 6.2,
    weapon: '', seats: 1, mobileSpawn: false, radius: 0.8, hover: true, systemHp: 10,
    slip: 1.5, // slowest top end but it BITES — threads the tight infield
  },
  bike: {
    kind: 'bike', name: 'Jackal Recon Bike', cost: 1, hp: 85, speed: 26, turnRate: 3.4,
    weapon: 'bike_mg', seats: 1, mobileSpawn: false, radius: 1.1, systemHp: 15,
    slip: 2.0, // W5.5: two wheels slide furthest — commit to the lean
  },
  flyer: {
    kind: 'flyer', name: 'Kestrel Gunship', cost: 2, hp: 48, speed: 24, turnRate: 2.8,
    weapon: 'flyer_plasma', seats: 2, mobileSpawn: false, radius: 1.6,
    hover: true, flies: true, systemHp: 22, liftoffTime: 2.5,
  },
  attackheli: {
    kind: 'attackheli', name: 'Shrike Attack Helicopter', cost: 3, hp: 105, speed: 27, turnRate: 2.5,
    weapon: 'heli_rockets', altWeapon: 'heli_cannon', seats: 2, mobileSpawn: false, radius: 2.2,
    hover: true, flies: true, systemHp: 24, liftoffTime: 3,
  },
  transportheli: {
    kind: 'transportheli', name: 'Condor Transport Helicopter', cost: 4, hp: 260, speed: 21, turnRate: 1.65,
    weapon: 'transport_mg', seats: 9, mobileSpawn: true, radius: 3,
    crew: ['gunner', 'sensors', 'comms'], hover: true, flies: true, systemHp: 42, liftoffTime: 4,
  },
  // ==== V2 THE FIXED-WING PAIR ====
  // Both CANNOT HOVER (minAirspeed): release the stick and they keep flying.
  // Both are made of glass — the M3 armour ladder says the sky costs you your
  // armour, and a jet that could also tank would have no counter at all.
  //
  // VULTURE — air-to-ground. Rockets that gut armour columns; nearly useless
  // against another jet (slow rockets, wide spread). Fast, but the least
  // agile thing in the air: it commits to a run.
  strikejet: {
    kind: 'strikejet', name: 'Vulture Strike Jet', cost: 3, hp: 62, speed: 40, turnRate: 1.5,
    weapon: 'vulture_rockets', altWeapon: 'vulture_mg', seats: 1, mobileSpawn: false, radius: 1.7,
    hover: true, flies: true, systemHp: 16, liftoffTime: 1.4,
    minAirspeed: 0.45, bankAngle: 0.7,
  },
  // FALCON — air-to-air. A fast-firing cannon that leads a moving jet, and
  // the best turn rate in the sky. Its rounds barely scratch a tank: this is
  // the answer to aircraft, and ONLY to aircraft.
  interceptor: {
    kind: 'interceptor', name: 'Falcon Interceptor', cost: 3, hp: 55, speed: 46, turnRate: 2.3,
    weapon: 'falcon_cannon', seats: 1, mobileSpawn: false, radius: 1.5,
    hover: true, flies: true, systemHp: 14, liftoffTime: 1.2,
    minAirspeed: 0.5, bankAngle: 0.95,
  },
  // ==== V3 THE LANCE — the reason the sky is not free ====
  // A missile track: it reaches 120u into the air and hits like a truck, and
  // it is made of PAPER on purpose. Robert's law for it — "another one that
  // was ground that could shoot in the air." It must be escorted or it dies
  // to the first tank that notices it, which is what keeps AA a POSITION the
  // ground war has to fight over instead of a free umbrella.
  aatrack: {
    kind: 'aatrack', name: 'Lance AA Track', cost: 2, hp: 130, speed: 13, turnRate: 1.9,
    weapon: 'aa_missile', seats: 2, mobileSpawn: false, radius: 1.9,
    antiAir: true, systemHp: 20,
  },
  // ==== V4 THE ANVIL — the slowest thing that flies ====
  // It drops a stick of twelve, or the one warhead nobody forgets. It cannot
  // turn, cannot run, and cannot defend itself: an Anvil without a Falcon
  // escort is a gift to the enemy team. That dependency IS the design.
  bomber: {
    kind: 'bomber', name: 'Anvil Heavy Bomber', cost: 4, hp: 240, speed: 17, turnRate: 0.75,
    weapon: '', seats: 3, mobileSpawn: false, radius: 3.1,
    hover: true, flies: true, systemHp: 30, liftoffTime: 3.5,
    minAirspeed: 0.6, bankAngle: 0.3, bombs: 12,
  },
  // ==== THE NEW AIR PROGRAM (mountain warfare) ====
  // WARHAWK — the A-10 school: a slow, armoured gun jet built around one huge
  // AP cannon. Murders armour and ground, helpless against a real fighter.
  gunship: {
    kind: 'gunship', name: 'Warhawk Gun Jet', cost: 4, hp: 130, speed: 30, turnRate: 1.5,
    weapon: 'warhawk_gun', altWeapon: 'warhawk_pods', seats: 1, mobileSpawn: false, radius: 1.9,
    hover: true, flies: true, systemHp: 20, liftoffTime: 1.6,
    minAirspeed: 0.4, bankAngle: 0.55,
  },
  // SPECTER — reaches further than the Falcon with a heavy AAM, but it's a
  // glass cannon: get inside its missile and it folds.
  airsuperiority: {
    kind: 'airsuperiority', name: 'Specter Fighter', cost: 4, hp: 70, speed: 44, turnRate: 1.9,
    weapon: 'specter_aam', altWeapon: 'specter_cannon', seats: 1, mobileSpawn: false, radius: 1.6,
    hover: true, flies: true, systemHp: 16, liftoffTime: 1.3,
    minAirspeed: 0.5, bankAngle: 0.85,
  },
  // REAPER — the only airframe radar can't lock. Slips the SAMs and the AA
  // tracks to put a precision stick on a protected target — if it flies straight.
  stealthbomber: {
    kind: 'stealthbomber', name: 'Reaper Stealth Bomber', cost: 6, hp: 150, speed: 24, turnRate: 0.9,
    weapon: 'reaper_bombs', seats: 2, mobileSpawn: false, radius: 2.8,
    hover: true, flies: true, systemHp: 26, liftoffTime: 3,
    minAirspeed: 0.55, bankAngle: 0.35, bombs: 8, stealth: true,
  },
  // HYDRA — a gunship heli that volleys guided rockets from standoff. Deadlier
  // reach than the Shrike, softer airframe.
  gunheli: {
    kind: 'gunheli', name: 'Hydra Gunship Heli', cost: 4, hp: 115, speed: 25, turnRate: 2.4,
    weapon: 'hydra_guided', altWeapon: 'hydra_cannon', seats: 2, mobileSpawn: false, radius: 2.2,
    hover: true, flies: true, systemHp: 24, liftoffTime: 3,
  },
  transport: {
    kind: 'transport', name: 'Atlas Transport', cost: 3, hp: 520, speed: 12, turnRate: 1.6,
    weapon: 'transport_mg', seats: 9, mobileSpawn: true, radius: 2.6,
    crew: ['gunner', 'sensors', 'ecm', 'comms'], systemHp: 52,
    slip: 3.4, // W5.5: a loaded truck leans, briefly — grip wins fast
  },
  ambulance: {
    kind: 'ambulance', name: 'Mercy Field Ambulance', cost: 2, hp: 240, speed: 17, turnRate: 2.2,
    weapon: '', seats: 3, mobileSpawn: false, radius: 1.9,
    healRadius: 7, healRate: 9, systemHp: 32,
  },
  tunneler: {
    kind: 'tunneler', name: 'Mole Tunneling Machine', cost: 2, hp: 700, speed: 4.5, turnRate: 1.0,
    weapon: '', seats: 2, mobileSpawn: false, radius: 2.2, digs: true, systemHp: 70,
  },
  emplacement: {
    kind: 'emplacement', name: 'Bulwark Emplacement', cost: 1, hp: 380, speed: 0, turnRate: 0,
    weapon: 'emplacement_gun', seats: 1, mobileSpawn: false, radius: 1.6,
    immobile: true, systemHp: 40,
  },
  // The Pike: the moat's landlord. Fast and mean ON the water, useless off
  // it — a water-locked weapons platform with a bench for two marines who
  // can shoot from the deck. Counters swimmers utterly (they can't shoot
  // back); loses to shore rockets it can't chase inland.
  boat: {
    kind: 'boat', name: 'Pike Gunboat', cost: 2, hp: 145, speed: 21, turnRate: 2.6,
    weapon: 'boat_mg', seats: 3, mobileSpawn: false, radius: 1.8,
    boat: true, systemHp: 28,
  },
  submarine: {
    kind: 'submarine', name: 'Barracuda Attack Submarine', cost: 4, hp: 320, speed: 17, turnRate: 1.35,
    weapon: 'torpedo', seats: 4, mobileSpawn: false, radius: 2.8,
    crew: ['gunner', 'sensors', 'comms'], boat: true, submersible: true, systemHp: 48,
  },
  // The Goliath: the walking middle ground. Slower than a tank in a straight
  // line but pivots like a soldier, and its LEGS are the point — low cover
  // that walls off every wheeled and tracked hull is a stair step to it.
  // Balance slot: hp between APC and tank, worst straight-line speed of the
  // armed ground pool, best heavy-class turn rate, anti-infantry gun.
  mech: {
    kind: 'mech', name: 'Goliath Assault Walker', cost: 3, hp: 480, speed: 9, turnRate: 2.4,
    weapon: 'mech_autocannon', seats: 2, mobileSpawn: false, radius: 1.9,
    strider: true, stomps: true, systemHp: 48,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // THE CIVILIAN ROSTER (THREE-GAMES-ONE-WAR appendix, Robert: "military
  // vehicles make war; civilian vehicles make the world feel alive").
  // World traffic, not war materiel: unarmed, soft, cheap on the ledger,
  // never on requisition menus — but every one drives (the #121 ground-feel
  // pass applies), every one hotwires, every one is in the Codex. Speeds
  // respect the armour-ladder laws: ground/water under the slowest live
  // round (33.3), air under the Vulture (40). The runabouts ride the W5.5
  // slip dial like every wheeled thing that corners.
  // ── ground ──
  sedan:        { kind: 'sedan', name: 'Commuter Sedan', cost: 1, hp: 70, speed: 18, turnRate: 2.4, weapon: '', seats: 4, mobileSpawn: false, radius: 1.5, systemHp: 8, slip: 2.4, civilian: true },
  pickup:       { kind: 'pickup', name: 'Workhorse Pickup', cost: 1, hp: 90, speed: 16, turnRate: 2.2, weapon: '', seats: 3, mobileSpawn: false, radius: 1.6, systemHp: 10, slip: 2.2, civilian: true },
  suv:          { kind: 'suv', name: 'Range SUV', cost: 1, hp: 100, speed: 17, turnRate: 2.2, weapon: '', seats: 5, mobileSpawn: false, radius: 1.7, systemHp: 11, slip: 2.2, civilian: true },
  sportscar:    { kind: 'sportscar', name: 'Meridian Sports Car', cost: 2, hp: 60, speed: 26, turnRate: 2.9, weapon: '', seats: 2, mobileSpawn: false, radius: 1.5, systemHp: 7, slip: 3.2, civilian: true },
  taxi:         { kind: 'taxi', name: 'City Taxi', cost: 1, hp: 75, speed: 18, turnRate: 2.5, weapon: '', seats: 4, mobileSpawn: false, radius: 1.5, systemHp: 8, slip: 2.5, civilian: true },
  schoolbus:    { kind: 'schoolbus', name: 'District School Bus', cost: 2, hp: 160, speed: 11, turnRate: 1.5, weapon: '', seats: 9, mobileSpawn: false, radius: 2.4, systemHp: 17, civilian: true },
  scooter:      { kind: 'scooter', name: 'Street Scooter', cost: 1, hp: 30, speed: 13, turnRate: 3.0, weapon: '', seats: 1, mobileSpawn: false, radius: 0.9, systemHp: 4, slip: 2.0, civilian: true },
  atv:          { kind: 'atv', name: 'Trail ATV', cost: 1, hp: 55, speed: 15, turnRate: 2.8, weapon: '', seats: 2, mobileSpawn: false, radius: 1.2, systemHp: 6, slip: 2.1, civilian: true },
  garbagetruck: { kind: 'garbagetruck', name: 'Municipal Garbage Truck', cost: 2, hp: 200, speed: 9, turnRate: 1.4, weapon: '', seats: 2, mobileSpawn: false, radius: 2.3, systemHp: 21, civilian: true },
  towtruck:     { kind: 'towtruck', name: 'Roadside Tow Truck', cost: 1, hp: 130, speed: 13, turnRate: 1.8, weapon: '', seats: 2, mobileSpawn: false, radius: 1.9, systemHp: 14, civilian: true },
  firetruck:    { kind: 'firetruck', name: 'Ladder 9 Fire Truck', cost: 2, hp: 190, speed: 12, turnRate: 1.5, weapon: '', seats: 5, mobileSpawn: false, radius: 2.5, systemHp: 20, civilian: true },
  fueltanker:   { kind: 'fueltanker', name: 'Petrochem Fuel Tanker', cost: 2, hp: 110, speed: 11, turnRate: 1.3, weapon: '', seats: 2, mobileSpawn: false, radius: 2.5, systemHp: 12, civilian: true },
  movingtruck:  { kind: 'movingtruck', name: 'Two-Man Moving Truck', cost: 1, hp: 140, speed: 12, turnRate: 1.6, weapon: '', seats: 3, mobileSpawn: false, radius: 2.2, systemHp: 15, civilian: true },
  foodtruck:    { kind: 'foodtruck', name: 'Corner Food Truck', cost: 1, hp: 120, speed: 12, turnRate: 1.7, weapon: '', seats: 2, mobileSpawn: false, radius: 2.0, systemHp: 13, civilian: true },
  deliveryvan:  { kind: 'deliveryvan', name: 'Parcel Delivery Van', cost: 1, hp: 110, speed: 15, turnRate: 1.9, weapon: '', seats: 2, mobileSpawn: false, radius: 1.9, systemHp: 12, civilian: true },
  policecruiser:{ kind: 'policecruiser', name: 'Metro Police Cruiser', cost: 1, hp: 95, speed: 22, turnRate: 2.6, weapon: '', seats: 4, mobileSpawn: false, radius: 1.6, systemHp: 10, slip: 2.6, civilian: true },
  loader:       { kind: 'loader', name: 'Site Loader', cost: 1, hp: 170, speed: 7, turnRate: 1.6, weapon: '', seats: 1, mobileSpawn: false, radius: 1.9, systemHp: 18, civilian: true },
  forklift:     { kind: 'forklift', name: 'Yard Forklift', cost: 1, hp: 90, speed: 6, turnRate: 2.6, weapon: '', seats: 1, mobileSpawn: false, radius: 1.3, systemHp: 10, civilian: true },
  bulldozer:    { kind: 'bulldozer', name: 'Earthline Bulldozer', cost: 2, hp: 260, speed: 5, turnRate: 1.3, weapon: '', seats: 1, mobileSpawn: false, radius: 2.2, systemHp: 27, civilian: true },
  cementmixer:  { kind: 'cementmixer', name: 'Rotary Cement Mixer', cost: 2, hp: 180, speed: 9, turnRate: 1.4, weapon: '', seats: 2, mobileSpawn: false, radius: 2.3, systemHp: 19, civilian: true },
  golfcart:     { kind: 'golfcart', name: 'Fairway Golf Cart', cost: 1, hp: 40, speed: 8, turnRate: 2.7, weapon: '', seats: 2, mobileSpawn: false, radius: 1.2, systemHp: 5, civilian: true },
  bicycle:      { kind: 'bicycle', name: 'Town Bicycle', cost: 1, hp: 20, speed: 7, turnRate: 3.2, weapon: '', seats: 1, mobileSpawn: false, radius: 0.8, systemHp: 3, civilian: true },
  // ── air (helis spool; planes carry a stall floor — they make PASSES) ──
  passengerjet: { kind: 'passengerjet', name: 'Meridian Air 220 Passenger Jet', cost: 4, hp: 220, speed: 34, turnRate: 0.9, weapon: '', seats: 9, mobileSpawn: false, radius: 4.2, flies: true, liftoffTime: 4, minAirspeed: 0.5, bankAngle: 0.4, systemHp: 23, civilian: true },
  privatejet:   { kind: 'privatejet', name: 'Sovereign Private Jet', cost: 3, hp: 130, speed: 36, turnRate: 1.2, weapon: '', seats: 5, mobileSpawn: false, radius: 3.0, flies: true, liftoffTime: 3, minAirspeed: 0.5, bankAngle: 0.55, systemHp: 14, civilian: true },
  cargoplane:   { kind: 'cargoplane', name: 'Atlas Air Cargo Plane', cost: 3, hp: 260, speed: 26, turnRate: 0.8, weapon: '', seats: 4, mobileSpawn: false, radius: 4.4, flies: true, liftoffTime: 4, minAirspeed: 0.45, bankAngle: 0.3, systemHp: 27, civilian: true },
  bushplane:    { kind: 'bushplane', name: 'Backcountry Bush Plane', cost: 2, hp: 90, speed: 22, turnRate: 1.5, weapon: '', seats: 3, mobileSpawn: false, radius: 2.4, flies: true, liftoffTime: 2, minAirspeed: 0.35, bankAngle: 0.5, systemHp: 10, civilian: true },
  cropduster:   { kind: 'cropduster', name: 'Lowfield Crop Duster', cost: 1, hp: 70, speed: 20, turnRate: 1.7, weapon: '', seats: 1, mobileSpawn: false, radius: 2.2, flies: true, liftoffTime: 2, minAirspeed: 0.35, bankAngle: 0.6, systemHp: 8, civilian: true },
  newsheli:     { kind: 'newsheli', name: 'Channel 5 News Helicopter', cost: 2, hp: 100, speed: 20, turnRate: 2.2, weapon: '', seats: 3, mobileSpawn: false, radius: 2.2, flies: true, hover: true, liftoffTime: 3, systemHp: 11, civilian: true },
  medheli:      { kind: 'medheli', name: 'Lifeline Medical Helicopter', cost: 2, hp: 120, speed: 21, turnRate: 2.1, weapon: '', seats: 4, mobileSpawn: false, radius: 2.3, flies: true, hover: true, liftoffTime: 3, healRadius: 6, healRate: 6, systemHp: 13, civilian: true },
  policeheli:   { kind: 'policeheli', name: 'Metro Police Helicopter', cost: 2, hp: 110, speed: 23, turnRate: 2.3, weapon: '', seats: 3, mobileSpawn: false, radius: 2.2, flies: true, hover: true, liftoffTime: 3, systemHp: 12, civilian: true },
  skycrane:     { kind: 'skycrane', name: 'Longbeam Sky Crane', cost: 3, hp: 210, speed: 14, turnRate: 1.4, weapon: '', seats: 2, mobileSpawn: false, radius: 3.6, flies: true, hover: true, liftoffTime: 4, systemHp: 22, civilian: true },
  balloon:      { kind: 'balloon', name: 'Dawn Hot Air Balloon', cost: 1, hp: 45, speed: 4, turnRate: 1.0, weapon: '', seats: 3, mobileSpawn: false, radius: 2.6, flies: true, hover: true, liftoffTime: 5, systemHp: 5, civilian: true },
  blimp:        { kind: 'blimp', name: 'Skyline Blimp', cost: 2, hp: 140, speed: 7, turnRate: 0.8, weapon: '', seats: 4, mobileSpawn: false, radius: 4.6, flies: true, hover: true, liftoffTime: 5, systemHp: 15, civilian: true },
  ultralight:   { kind: 'ultralight', name: 'Featherframe Ultralight', cost: 1, hp: 35, speed: 14, turnRate: 1.9, weapon: '', seats: 1, mobileSpawn: false, radius: 1.8, flies: true, liftoffTime: 1, minAirspeed: 0.3, bankAngle: 0.5, systemHp: 4, civilian: true },
  paraglider:   { kind: 'paraglider', name: 'Ridgeline Paraglider', cost: 1, hp: 20, speed: 9, turnRate: 2.0, weapon: '', seats: 1, mobileSpawn: false, radius: 1.5, flies: true, minAirspeed: 0.3, systemHp: 3, civilian: true },
  hangglider:   { kind: 'hangglider', name: 'Thermal Hang Glider', cost: 1, hp: 20, speed: 11, turnRate: 1.8, weapon: '', seats: 1, mobileSpawn: false, radius: 1.9, flies: true, minAirspeed: 0.35, systemHp: 3, civilian: true },
  // ── water ──
  fishingboat:  { kind: 'fishingboat', name: 'Dockside Fishing Boat', cost: 1, hp: 90, speed: 10, turnRate: 1.6, weapon: '', seats: 3, mobileSpawn: false, radius: 2.0, boat: true, systemHp: 10, civilian: true },
  yacht:        { kind: 'yacht', name: 'Harborline Yacht', cost: 3, hp: 150, speed: 12, turnRate: 1.3, weapon: '', seats: 6, mobileSpawn: false, radius: 3.2, boat: true, systemHp: 16, civilian: true },
  speedboat:    { kind: 'speedboat', name: 'Cutwater Speedboat', cost: 2, hp: 70, speed: 24, turnRate: 2.4, weapon: '', seats: 3, mobileSpawn: false, radius: 2.0, boat: true, slip: 2.8, systemHp: 8, civilian: true },
  ferry:        { kind: 'ferry', name: 'Crossing Ferry', cost: 2, hp: 240, speed: 8, turnRate: 0.9, weapon: '', seats: 9, mobileSpawn: false, radius: 3.8, boat: true, systemHp: 25, civilian: true },
  cargoship:    { kind: 'cargoship', name: 'Longhaul Cargo Ship', cost: 4, hp: 380, speed: 6, turnRate: 0.6, weapon: '', seats: 5, mobileSpawn: false, radius: 5.0, boat: true, systemHp: 39, civilian: true },
  patrolboat:   { kind: 'patrolboat', name: 'Harbor Patrol Boat', cost: 2, hp: 120, speed: 20, turnRate: 2.0, weapon: '', seats: 4, mobileSpawn: false, radius: 2.3, boat: true, systemHp: 13, civilian: true },
  jetski:       { kind: 'jetski', name: 'Whitecap Jet Ski', cost: 1, hp: 35, speed: 26, turnRate: 3.0, weapon: '', seats: 1, mobileSpawn: false, radius: 1.0, boat: true, slip: 3.0, systemHp: 4, civilian: true },
  hovercraft:   { kind: 'hovercraft', name: 'Skirtline Hovercraft', cost: 2, hp: 130, speed: 16, turnRate: 1.6, weapon: '', seats: 5, mobileSpawn: false, radius: 2.6, hover: true, slip: 3.4, systemHp: 14, civilian: true },
  riverbarge:   { kind: 'riverbarge', name: 'Lowline River Barge', cost: 2, hp: 200, speed: 5, turnRate: 0.7, weapon: '', seats: 3, mobileSpawn: false, radius: 3.6, boat: true, systemHp: 21, civilian: true },
  submersible:  { kind: 'submersible', name: 'Twilight Research Submersible', cost: 3, hp: 110, speed: 9, turnRate: 1.2, weapon: '', seats: 2, mobileSpawn: false, radius: 2.0, boat: true, submersible: true, systemHp: 12, civilian: true },
};

// ---------------------------------------------------------------------------
// V2 THE AIR LAYER's guns. The jets carry opposite tools on purpose: the
// Vulture's rockets are murder on a tank and useless against a moving jet;
// the Falcon's cannon is the reverse. Neither can do the other's job, which
// is what makes both worth flying.
// ---------------------------------------------------------------------------
WEAPONS.vulture_rockets = W({
  id: 'vulture_rockets', name: 'Talon Rocket Pod', damage: 48, rof: 3.2,
  speed: 62, spread: 0.03, clip: 14, reloadTime: 3.4, reserve: 56, range: 62,
  splash: 3.6, splashDamage: 34, knockback: 9, sound: 'rocket', tracer: 'rocket',
});
WEAPONS.heli_rockets = W({
  id: 'heli_rockets', name: 'Shrike Hydra Pod', damage: 34, rof: 2.4,
  speed: 58, spread: 0.025, clip: 12, reloadTime: 3.2, reserve: 48, range: 68,
  splash: 3.2, splashDamage: 26, knockback: 7, sound: 'rocket', tracer: 'rocket',
});
WEAPONS.heli_cannon = W({
  id: 'heli_cannon', name: 'Shrike Chin Cannon', damage: 11, rof: 9,
  speed: 130, spread: 0.028, clip: 50, reloadTime: 2.2, reserve: Infinity, range: 60,
  sound: 'autocannon', tracer: 'bullet',
});
// J1 (Robert: "we might need machine guns, of course") — the Vulture's belly
// gun. Rockets gut armour; the MG is for the men beside it. Alt-fire, its own
// clock, deliberately weak against hulls.
WEAPONS.vulture_mg = W({
  id: 'vulture_mg', name: 'Vulture Belly MG', damage: 7, rof: 11,
  speed: 150, spread: 0.035, clip: 40, reloadTime: 2.0, reserve: Infinity, range: 55,
  sound: 'autocannon', tracer: 'bullet',
});
WEAPONS.falcon_cannon = W({
  id: 'falcon_cannon', name: 'Falcon Autocannon', damage: 26, rof: 7,
  speed: 150, spread: 0.012, clip: 60, reloadTime: 2.6, reserve: Infinity, range: 74,
  sound: 'autocannon', tracer: 'bullet',
});

// ---------------------------------------------------------------------------
// THE NEW AIR PROGRAM (mountain warfare) — two more fixed-wing jets, a radar-
// slipping stealth bomber, and a guided-rocket gunship helicopter. Each airframe
// is a SIDEGRADE: the Warhawk out-guns the Vulture on armour but is slower and
// can't dogfight; the Specter reaches further than the Falcon but is fragile;
// the Reaper is the only thing radar can't lock — and the only bomber that has
// to fly straight to do it; the Hydra volleys guided rockets from standoff but
// pays in a soft airframe. Balance guarded by the range-band + sidegrade suites.
// ---------------------------------------------------------------------------
WEAPONS.warhawk_gun = W({  // A-10 school: a slow jet built around one enormous gun
  id: 'warhawk_gun', name: 'Warhawk GAU Cannon', damage: 40, rof: 5.5,
  speed: 165, spread: 0.02, clip: 45, reloadTime: 3.0, reserve: Infinity, range: 92,
  sound: 'autocannon', tracer: 'bullet',
});
WEAPONS.warhawk_pods = W({
  id: 'warhawk_pods', name: 'Warhawk Rocket Pods', damage: 44, rof: 3.0,
  speed: 60, spread: 0.03, clip: 16, reloadTime: 3.6, reserve: 48, range: 66,
  splash: 3.4, splashDamage: 30, knockback: 8, sound: 'rocket', tracer: 'rocket',
});
WEAPONS.specter_aam = W({  // heat-seeker air-to-air missile — homes on aircraft
  id: 'specter_aam', name: 'Specter AAM', damage: 100, rof: 0.6,
  speed: 52, spread: 0, clip: 4, reloadTime: 4.0, reserve: 24, range: 128,
  splash: 3.0, splashDamage: 50, knockback: 9, homing: 'air', sound: 'rocket', tracer: 'rocket',
});
WEAPONS.specter_cannon = W({
  id: 'specter_cannon', name: 'Specter Cannon', damage: 24, rof: 7.5,
  speed: 155, spread: 0.014, clip: 60, reloadTime: 2.6, reserve: Infinity, range: 76,
  sound: 'autocannon', tracer: 'bullet',
});
WEAPONS.reaper_bombs = W({  // precision iron — heavier and fewer than the Anvil's
  id: 'reaper_bombs', name: 'Reaper JDAM Stick', damage: 120, rof: 1.6, speed: 14,
  clip: 8, reserve: 0, range: 34, splash: 8, splashDamage: 100, knockback: 22,
  arc: true, sound: 'thump', tracer: 'shell',
});
WEAPONS.hydra_guided = W({  // the guided multi-rocket volley — homes on hulls
  id: 'hydra_guided', name: 'Hydra Guided Pod', damage: 38, rof: 3.5,
  speed: 66, spread: 0.02, clip: 18, reloadTime: 3.4, reserve: 54, range: 76,
  splash: 3.4, splashDamage: 30, knockback: 8, homing: 'ground', sound: 'rocket', tracer: 'rocket',
});
WEAPONS.hydra_cannon = W({
  id: 'hydra_cannon', name: 'Hydra Chin Gun', damage: 12, rof: 9,
  speed: 135, spread: 0.026, clip: 50, reloadTime: 2.2, reserve: Infinity, range: 62,
  sound: 'autocannon', tracer: 'bullet',
});

// V3 THE LANCE's missile: it does not chase soldiers, it does not chase
// hulls. It chases AIRCRAFT, and it is the reason the sky is not free.
WEAPONS.aa_missile = W({
  id: 'aa_missile', name: 'Lance AA Missile', damage: 90, rof: 0.55,
  speed: 44, spread: 0, clip: 2, reloadTime: 3.6, reserve: 24, range: 120,
  splash: 3.2, splashDamage: 45, knockback: 8, sound: 'rocket', tracer: 'rocket',
});
// V4 THE ANVIL's stick of iron — dumb, heavy, and dropped straight down.
WEAPONS.bomb = W({
  id: 'bomb', name: 'Mk-9 Iron Bomb', damage: 90, rof: 2.4, speed: 12,
  clip: 12, reserve: 0, range: 30, splash: 7.5, splashDamage: 80,
  knockback: 20, arc: true, sound: 'thump', tracer: 'shell',
});
// V4 THE BABY NUKE (Robert: "I almost think we need a baby nuke — that would
// be kinda dope"). One per bomber, priced in materiel, telegraphed loudly.
// Knockback 34 puts every survivor on their back (M1 ragdolls past 16).
WEAPONS.baby_nuke = W({
  id: 'baby_nuke', name: 'Cradle Tactical Warhead', damage: 400, rof: 0.2, speed: 10,
  clip: 1, reserve: 0, range: 30, splash: 26, splashDamage: 260,
  knockback: 34, arc: true, sound: 'cannon', tracer: 'shell',
});
WEAPONS.torpedo = W({
  id: 'torpedo', name: 'Barracuda Heavy Torpedo', damage: 110, rof: 0.55,
  speed: 34, spread: 0.012, clip: 4, reloadTime: 4.2, reserve: 20, range: 74,
  splash: 3.8, splashDamage: 58, knockback: 5, sound: 'rocket', tracer: 'rocket', torpedo: true,
});

// ---------------------------------------------------------------------------
// Anti-air. Lives below VEHICLES because the missile's speed is DERIVED from
// the Kestrel's top speed: ~8% slower, so a pilot who holds a straight sprint
// just barely outruns it, while one who panics and turns bleeds the gap away
// and gets caught. That ratio IS the predator/prey loop — never hardcode it.
// ---------------------------------------------------------------------------

/** heat-seeker top speed as a fraction of the flyer's — it always loses a drag race */
export const SAM_SPEED_RATIO = 0.92;
/** STEALTH (mountain warfare): the range past which a low-signature airframe
 *  (Reaper) drops off enemy radar + SAM lock — a picket that gets this close
 *  still gets its shot. The whole point of the bomber is slipping the belt. */
export const STEALTH_VISUAL_RANGE = 42;

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

// §5.3 Military working dogs — the K9 is a handler pairing: fast, fragile,
// bite-only, and the grounded counter to stealth. Cloak fools optics; it does
// not fool a nose. One dog per team for now, handled by a bot.
// THE IRON EATERS (DD SS20.1, finish-list 12): scrap given hunger. `plate`
// is the molt -- a visible armor pool that sheds under fire; when it's gone
// the frame is EXPOSED (double damage, faster, angrier -- world.ts SS20.2).
export const IRON_STATS = {
  scraprat: { hp: 26, plate: 14, speed: 13, weapon: 'zombie_claw' as WeaponId, score: 10 },
  junkhound: { hp: 55, plate: 35, speed: 15, weapon: 'dog_bite' as WeaponId, score: 25 },
  weaver: { hp: 70, plate: 55, speed: 9, weapon: 'zombie_claw' as WeaponId, score: 35 },
  ravager: { hp: 380, plate: 320, speed: 5.5, weapon: 'zombie_claw' as WeaponId, score: 90 },
};

export const DOG_STATS = {
  hp: 60,
  speed: 16.8,           // ~1.6× an infantryman — nobody outruns the dog
  weapon: 'dog_bite' as WeaponId,
  heelDist: 4,           // trailing distance off the handler's shoulder
  guardRadius: 18,       // threats to the handler inside this get the teeth
  noseRadius: 10,        // THE NOSE: everything in here is pinged, cloaked or not
};

/** Service names for the kennel. Every K9 deserves a real one. */
export const DOG_NAMES = ['Rex', 'Ajax', 'Bruno', 'Sable', 'Grit', 'Valkyrie', 'Koda', 'Havoc'] as const;

export const MODE_INFO: Record<string, { name: string; desc: string; icon: string }> = {
  tdm: { name: 'Team Deathmatch', desc: 'First team to 50 kills. Straight firefight.', icon: '💀' },
  ctf: { name: 'Capture the Flag', desc: 'Steal the enemy flag. First to 3 captures.', icon: '🚩' },
  koth: { name: 'King of the Hill', desc: 'Hold the hill for 120 total seconds.', icon: '⛰️' },
  conquest: { name: 'Conquest', desc: 'Hold control points A/B/C. First to 500 tickets.', icon: '🎯' },
  survival: { name: 'Zombie Survival', desc: 'Co-op vs escalating undead waves.', icon: '🧟' },
  horde: { name: 'Endless Horde', desc: 'No waves, no breaks — the dead never stop coming.', icon: '🩸' },
  tide: { name: 'The Shambler Tide', desc: 'The sea of the dead: a WALL of slow shamblers from the first minute. Runners are rumors. Mass is the menace.', icon: '🌊' },
  safehouse: { name: 'Protect the Scientist', desc: 'The horde searches house to house. Hide him, defend him, survive to evac.', icon: '🧪' },
  science: { name: 'Science Mission', desc: 'Compact black-site operation. Burn finite clones, finish the job, and extract the program.', icon: '⌬' },
  range: { name: 'Proving Grounds', desc: 'Your own patch of the war: firing lanes, dummy targets, the qualification courses (§3.3).', icon: '🎯' },
  paintball: { name: 'Paintball — Hunters vs Hunted', desc: 'One prey, one pack. The prey tags three points or survives the clock; the pack paints them out. One splat and you sit down.', icon: '🎨' },
  race: { name: 'Motor Trials — Grand Prix', desc: 'Hoverboard racing. Three laps of the circuit against a pack of AI racers — first past the flag wins. Pick your board: speed, balance, or grip.', icon: '🏁' },
  timetrial: { name: 'Motor Trials — Time Trial', desc: 'Just you, the circuit, and the ghost of your best lap. Chase your own tail and shave the tenths.', icon: '⏱️' },
  // A PLACE, not a match (#122) — reached from the paintball deploy card,
  // deliberately filtered OUT of the mode grid (buildMenu skips it)
  shop: { name: "Vanessa's Paintball", desc: 'The pro shop — walk the booths, talk to Vanessa, pick your marker.', icon: '🏪' },
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
  /** §19.2: the awareness ring doubles — no cone extension (360 helmet) */
  sensor360?: boolean;
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
  /** ballistic rounds thread issued plate to the flesh (−25% dmg); iron hide
   *  and LSW armor are too thick (gated in damageSoldier) */
  apRounds?: boolean;
  /** M5/V1: F throws the recallable Breacher Axe — issued kit, not standard */
  axe?: boolean;
}

export const EQUIPMENT: Record<string, EquipDef> = {
  armor_vest: { id: 'armor_vest', name: 'Ballistic Vest', desc: '+25 max HP, −8% speed.', icon: '🦺', hpBonus: 25, speedMult: 0.92 },
  power_armor: { id: 'power_armor', name: 'Power Armor', desc: '+60 max HP, −15% speed, immune to knockback.', icon: '🛡️', hpBonus: 60, speedMult: 0.85, noKnockback: true },
  stealth_suit: { id: 'stealth_suit', name: 'Stealth Suit', desc: 'Beacons and drones cannot ping you.', icon: '🥷', pingProof: true },
  ir_goggles: { id: 'ir_goggles', name: 'IR/UV Goggles', desc: 'Cloaked enemies appear on your minimap.', icon: '🥽', seeCloaked: true },
  tracking_optics: { id: 'tracking_optics', name: 'Tracking Optics', desc: 'Enemies you spot stay visible 3s after breaking line of sight (instead of 1.5s).', icon: '👁️', tracker: true },
  sensor_360: { id: 'sensor_360', name: '360 Sensor Helmet', desc: 'Your awareness ring reaches twice as far, all around. You cannot be crept on — the paranoid pick.', icon: '📿', sensor360: true },
  mine_detector: { id: 'mine_detector', name: 'Mine Detector', desc: 'Enemy mines appear on your minimap.', icon: '📡', seeMines: true },
  repair_kit: { id: 'repair_kit', name: 'Mechanic Kit', desc: 'E repairs a damaged friendly vehicle or turret (+120, 10s cooldown).', icon: '🔧', fieldRepair: true },
  medikit: { id: 'medikit', name: 'Combat Medikit', desc: 'Auto-heals +45 HP once per life when you drop below 25%.', icon: '💉', autoMedikit: true },
  head_cam: { id: 'head_cam', name: 'Head Cam Network', desc: 'Your minimap shows everything your teammates can see.', icon: '📹', headcam: true },
  tac_system: { id: 'tac_system', name: 'Tactical System', desc: 'Click the minimap to drop waypoints your team sees.', icon: '🗺️', waypoints: true },
  psi_scanner: { id: 'psi_scanner', name: 'Psi Scanner', desc: 'Pings the nearest hidden enemy every 8 seconds.', icon: '🔮', psiScan: true },
  demo_kit: { id: 'demo_kit', name: 'Demolition Kit', desc: 'G plants a DX-9 demolition charge (3 per life).', icon: '🧨', demoCharge: true },
  // Robert: "I don't think regular soldiers should have sci-fi's axe return to
  // their hands." Correct — a weapon that flies home is ISSUED, not standard.
  // It costs an equipment slot now, which also prices it: you give up a vest,
  // or optics, or the MANPADS, to carry it.
  breacher_axe: { id: 'breacher_axe', name: 'Breacher Axe', desc: 'F throws a recallable axe. Calling it back opens everyone on the return line (45).', icon: '🪓', axe: true },
  manpads: { id: 'manpads', name: 'MANPADS', desc: 'Shoulder-fired IR missile: G locks the nearest enemy aircraft in your facing cone and fires (2 per life).', icon: '🚀', samLauncher: true },
  hacking_kit: { id: 'hacking_kit', name: 'Hacking Kit', desc: 'E converts an enemy sentry turret to your side.', icon: '💻', hackKit: true },
  spy_camera: { id: 'spy_camera', name: 'Spy Camera', desc: 'G plants a camera that feeds enemy positions to your team (2 per life).', icon: '📷', deployCamera: true },
  ap_rounds: { id: 'ap_rounds', name: 'AP Rounds', desc: 'Your ballistic weapons thread issued plate — hits land on flesh (−25% damage). Iron hide and LSW armor are too thick.', icon: '🔩', apRounds: true },
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
  gen: 'field' | 'corridors' | 'rocks' | 'ocean' | 'ice' | 'armor';
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  savanna: { id: 'savanna', name: 'Terra — Savanna', desc: 'Dry grassland, rock kopjes, acacia stands.', icon: '🌍', gravity: 22, gen: 'field' },
  starship: { id: 'starship', name: 'Starship Boarding', desc: 'Corridor fighting between two docked hulls.', icon: '🚀', gravity: 22, gen: 'corridors' },
  asteroid: { id: 'asteroid', name: 'Hollowed Asteroid', desc: 'Mining galleries in a cracked-open rock.', icon: '☄️', gravity: 14, gen: 'rocks' },
  europa: { id: 'europa', name: 'Europa Depths', desc: 'Ocean-floor domes beneath the ice of Jupiter’s moon.', icon: '🌊', gravity: 9, gen: 'ocean' },
  titan: { id: 'titan', name: 'Titan Colony', desc: 'Methane haze over Saturn’s prosperous colony.', icon: '🪐', gravity: 16, gen: 'field' },
  triton: { id: 'triton', name: 'Triton Outpost', desc: 'A lonely ice station at the edge of everything.', icon: '❄️', gravity: 9, gen: 'ice' },
  // V5 ARMOR COUNTRY (Robert: "certain maps should have a lot of tanks,
  // because our vehicle combat is very good"). Wide open ground, long fire
  // lanes, almost no interiors — a map built so armour and aircraft can
  // actually manoeuvre instead of getting stuck in somebody's kitchen.
  hardpan: { id: 'hardpan', name: 'The Hardpan — Armor Country', desc: 'Cracked flats and long fire lanes. Bring the whole motor pool.', icon: '🛞', gravity: 22, gen: 'armor' },
  // WINTER — snowbound mountains. Sim-identical to the old europa mountain
  // theme (gravity 9, grit surface, same sky menu) so Crown Divide's play is
  // unchanged; only the palette turns the ice-moon blue into snow white.
  winter: { id: 'winter', name: 'Terra — Winter', desc: 'Snowbound peaks and frozen passes. The mountain war in deep winter.', icon: '🏔️', gravity: 9, gen: 'field' },
};
