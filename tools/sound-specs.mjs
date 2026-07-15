#!/usr/bin/env node
/**
 * Single source of truth for what every game sound is SUPPOSED to be.
 * Consumed by:
 *   - tools/gen-sounds-ai.mjs   (builds the ElevenLabs prompt from `desc`)
 *   - sound-review.html         (shows the intent + target length to rate against)
 *
 * Run directly to (re)emit the browser copy:
 *   node tools/sound-specs.mjs   →  public/audio/sound-specs.json
 *
 * `desc` = plain-English intent (what a good take sounds like).
 * `dur`  = target length in seconds (ElevenLabs clamps to 0.5–22).
 */
export const SOUND_SPECS = {
  // ---- weapons ----
  rifle:        { cat: 'weapons', desc: 'Single dry assault-rifle shot — sharp, punchy crack', dur: 0.6 },
  smg:          { cat: 'weapons', desc: 'ONE single submachine-gun shot — a single round, snappy, not a burst or full-auto', dur: 0.4 },
  pistol:       { cat: 'weapons', desc: 'Single sharp pistol pop', dur: 0.5 },
  shotgun:      { cat: 'weapons', desc: 'Shotgun blast — deep boom with pellet spray', dur: 0.7 },
  autocannon:   { cat: 'weapons', desc: 'Heavy autocannon — mechanical metallic boom', dur: 0.6 },
  rail:         { cat: 'weapons', desc: 'Railgun — electric snap into a descending energy zap', dur: 0.9 },
  rocket:       { cat: 'weapons', desc: 'Rocket launch — ignition whoosh with a deep motor rumble', dur: 1.2 },
  thump:        { cat: 'weapons', desc: 'Grenade launcher — hollow low launch pop', dur: 0.6 },
  cannon:       { cat: 'weapons', desc: 'Tank 120mm — huge crack then deep booming concussion', dur: 1.4 },
  plasma:       { cat: 'weapons', desc: "Plasma bolt — synthetic electric 'zwip'", dur: 0.6 },
  flame:        { cat: 'weapons', desc: 'Flamethrower — roaring gas ignition whoosh', dur: 0.8 },
  acid:         { cat: 'weapons', desc: 'Acid spit — wet gooey organic splat', dur: 0.6 },
  repair:       { cat: 'weapons', desc: 'Repair tool — ratcheting mechanical whir and clank', dur: 0.6 },
  heal:         { cat: 'weapons', desc: 'Healing beam — warm rising restorative shimmer', dur: 0.7 },
  claw:         { cat: 'weapons', desc: 'Claw swipe — fast whoosh and flesh slash', dur: 0.5 },

  // ---- impacts & explosions ----
  hit:            { cat: 'impacts', desc: 'Bullet impact on armor — dull dry thwack', dur: 0.5 },
  hitmarker:      { cat: 'impacts', desc: 'UI hit tick — crisp confirmation blip', dur: 0.5 },
  explosion:      { cat: 'impacts', desc: 'Explosion — sharp crack then rumbling debris', dur: 1.6 },
  explosion_big:  { cat: 'impacts', desc: 'Huge explosion — deep concussion, long collapse', dur: 2.6 },
  death:          { cat: 'impacts', desc: 'Generic death — higher-pitched pained cry and gurgle, fading out (zombies / fallback)', dur: 0.7 },

  // ---- per-class human death cries ----
  death_infantry:     { cat: 'deaths', desc: 'Infantry death — short pained male grunt + gear rattle', dur: 0.8 },
  death_heavy:        { cat: 'deaths', desc: 'Heavy death — deep pained groan + armor clang', dur: 0.9 },
  death_jump:         { cat: 'deaths', desc: 'Jump Trooper death — yelp mid-fall + jetpack sputter', dur: 0.7 },
  death_engineer:     { cat: 'deaths', desc: 'Engineer death — grunt + tools clattering down', dur: 0.8 },
  death_medic:        { cat: 'deaths', desc: 'Medic death — gasp + failing medical tone', dur: 0.8 },
  death_infiltrator:  { cat: 'deaths', desc: 'Infiltrator death — sharp gasp + cloak fizzle', dur: 0.6 },
  death_pathfinder:   { cat: 'deaths', desc: 'Pathfinder death — cry + warp zip snapping out', dur: 0.7 },
  death_ghost:        { cat: 'deaths', desc: 'Ghost death — grunt + comms static cutting out', dur: 0.8 },

  // ---- movement / gear ----
  jetpack:      { cat: 'movement', desc: 'Jetpack thrust — hissing rocket exhaust burst', dur: 0.6 },
  cloak:        { cat: 'movement', desc: 'Cloak toggle — shimmering phase whoosh', dur: 0.6 },
  reload:       { cat: 'movement', desc: 'Reload — mag out, mag in, bolt charge', dur: 0.8 },
  pickup:       { cat: 'movement', desc: 'Pickup — short bright positive collect blip', dur: 0.5 },
  engine:       { cat: 'movement', desc: 'Vehicle engine — low diesel idle rumble', dur: 0.7 },
  mine_plant:   { cat: 'movement', desc: 'Mine plant — mechanical arming click and beep', dur: 0.5 },
  turret_built: { cat: 'movement', desc: 'Turret deploy — unfolding servo whir and lock', dur: 0.8 },
  footstep:     { cat: 'movement', desc: 'Single boot footstep on dirt', dur: 0.5 },
  growl:        { cat: 'movement', desc: 'Zombie growl — low guttural snarl', dur: 0.7 },

  // ---- abilities / sci-fi tech ----
  impulse:        { cat: 'tech', desc: 'Impulse cannon — deep pulsing knockback whump', dur: 0.6 },
  warp:           { cat: 'tech', desc: 'Warp teleport — rising shimmer and pop', dur: 0.7 },
  blink:          { cat: 'tech', desc: 'Blink — quick phase whoosh', dur: 0.5 },
  emp_burst:      { cat: 'tech', desc: 'EMP burst — electrical crackle and low thump', dur: 0.7 },
  gravlift:       { cat: 'tech', desc: 'Grav lift — rising anti-gravity whoosh', dur: 0.6 },
  beacon:         { cat: 'tech', desc: 'Beacon deploy — soft electronic ping and hum', dur: 0.6 },
  orbital_charge: { cat: 'tech', desc: 'Orbital strike charge — ominous rising energy hum', dur: 1.2 },

  // ---- objective / UI / match flow (stingers) ----
  flag_taken:      { cat: 'ui', desc: 'Flag stolen — tense short alarm stinger', dur: 0.7 },
  flag_captured:   { cat: 'ui', desc: 'Flag captured — bright triumphant chime', dur: 1.0 },
  flag_returned:   { cat: 'ui', desc: 'Flag returned — clean neutral chime', dur: 0.7 },
  point_captured:  { cat: 'ui', desc: 'Point captured — confident synth flourish', dur: 0.9 },
  wave_start:      { cat: 'ui', desc: 'Wave incoming — low horn swell + alarm', dur: 1.2 },
  victory:         { cat: 'ui', desc: 'Victory — triumphant brass flourish', dur: 1.6 },
  defeat:          { cat: 'ui', desc: 'Defeat — somber descending tone', dur: 1.6 },
  ui_click:        { cat: 'ui', desc: 'Menu click — tiny crisp tick', dur: 0.5 },
  spawn:           { cat: 'ui', desc: 'Respawn — short rising materialize shimmer', dur: 0.6 },
};

export const CATEGORIES = {
  weapons: 'Weapons',
  impacts: 'Impacts & explosions',
  deaths: 'Per-class death cries',
  movement: 'Movement / gear',
  tech: 'Abilities / sci-fi tech',
  ui: 'Objective / UI / match',
};

// run directly → emit the browser copy
const invoked = (process.argv[1] || '').replace(/\\/g, '/');
if (invoked.endsWith('tools/sound-specs.mjs')) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio', 'sound-specs.json');
  mkdirSync(dirname(out), { recursive: true });
  const arr = Object.entries(SOUND_SPECS).map(([name, s]) => ({ name, ...s }));
  writeFileSync(out, JSON.stringify({ categories: CATEGORIES, sounds: arr }, null, 2));
  console.log(`Wrote ${arr.length} specs → ${out}`);
}
