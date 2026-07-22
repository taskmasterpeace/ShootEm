#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPrompt, generateClip } from './tts-core.mjs';

const AUDIO_DIR = resolve('public/audio');
const MANIFEST_PATH = join(AUDIO_DIR, 'casting', 'odessa-manifest.json');
const VOICE = 'Gacrux';
const LANGUAGE = 'en-US';

export const ODESSA_PERSONA = [
  'Odessa Broussard, called Miss Dee by the squad, is a 68-year-old Black American woman born and raised in New Orleans, Louisiana.',
  'She is an Infiltrator and veteran intelligence field operative: observant, socially graceful, protective of frightened soldiers, and merciless toward anyone who mistakes warmth for weakness.',
  'Her voice is a low smoky contralto with breath, chest resonance, musical phrasing, and an authentic deep New Orleans Southern Black English accent.',
  'Her humor is dry and situational. People find her endearing because she listens, remembers names, and makes danger feel survivable.',
  'She never turns her age into a running joke, never becomes a caricature, and never sounds like a neutral audiobook narrator.',
].join(' ');

const ODESSA_FADE_PERSONA = [
  'Odessa Broussard, called Miss Dee by the squad, is a veteran New Orleans Infiltrator.',
  'Her voice is a low smoky mature contralto with breath, chest resonance, musical phrasing, and a deep natural New Orleans accent.',
  'She is observant, warm, disciplined, and understated even when her strength is failing.',
].join(' ');

const line = (slot, text, scene, ...notes) => ({ slot, text, scene, notes });

export const ODESSA_LINES = [
  line('vo_infiltrator_intro',
    'Odessa Broussard, baby. You keep your head down, and Miss Dee will keep the other side guessing.',
    'The match has just begun. Odessa checks her railgun, looks over a nervous new squad, and introduces herself over close-range comms.',
    'Warm, confident introduction with a smile that can be heard.',
    'Let the promise on the final phrase carry quiet capability, not bravado.'),
  line('vo_infiltrator_deploy_1',
    "All right, darlings. Let's go make ourselves difficult to find.",
    'The insertion doors open and the squad moves into a loud battlefield.',
    'Conversational command voice: affectionate first, focused by the final words.',
    'She is already scanning exits while everyone else is looking forward.'),
  line('vo_infiltrator_deploy_2',
    "Check your corners. I'll check the places corners try to hide.",
    'A second deployment into close urban fighting with blind alleys and broken rooms.',
    'Dry wit under professional caution.',
    'Crisp enough for the squad to obey without asking what she means.'),
  line('vo_infiltrator_idle_1',
    "Quiet like this usually means somebody's planning something foolish.",
    'A suspicious lull between firefights. Odessa listens instead of relaxing.',
    'Low and thoughtful, spoken mostly to the nearest squadmate.',
    'The humor is a private observation, never a punchline.'),
  line('vo_infiltrator_idle_2',
    'Mm-hm. Take your time. Trouble always gets impatient first.',
    'Odessa waits in cover while an unseen enemy refuses to reveal a position.',
    'Patient, musical, nearly under her breath.',
    'A small knowing smile beneath real concentration.'),

  line('vo_infiltrator_move_1',
    "I'm moving. Try not to announce it for me.",
    'A squad leader orders Odessa across an exposed lane.',
    'Low practical acknowledgement while she starts moving.',
    'The second sentence is affectionate teasing, not irritation.'),
  line('vo_infiltrator_move_2',
    'On my way, sugar. Quiet feet.',
    'Odessa accepts a short repositioning order near enemies.',
    'Compact, calm, and intimate enough for squad comms.',
    'Drop the volume slightly on Quiet feet as if secrecy begins immediately.'),
  line('vo_infiltrator_attack_1',
    'I see the opening. Let me have it.',
    'An enemy turns away and exposes a clean flank.',
    'Alert recognition followed by controlled appetite.',
    'No shouting; confidence is more dangerous at normal volume.'),
  line('vo_infiltrator_attack_2',
    "Keep their eyes up front. I'll handle the surprise.",
    'The squad begins a frontal attack while Odessa takes the hidden route.',
    'Give the first sentence clear tactical authority.',
    'Finish with pleased understatement, already moving away from the microphone.'),
  line('vo_infiltrator_hold_1',
    "I'll hold here. Nothing passes without introducing itself.",
    'Odessa is ordered to guard a narrow approach alone.',
    'Settled and watchful, claiming the space without raising her voice.',
    'The wit is dry; the threat beneath it is real.'),
  line('vo_infiltrator_hold_2',
    'This corner and I are acquainted now.',
    'She settles into a concealed firing angle and becomes completely still.',
    'Soft, content, almost domestic.',
    'A tiny smile; she likes a patient ambush.'),
  line('vo_infiltrator_help_ack',
    "I hear you, baby. Hold on, I'm coming.",
    'A squadmate calls urgently for help from the next room.',
    'Immediate warmth, then accelerating urgency as she moves.',
    'The reassurance must sound personal and believable.'),

  line('vo_infiltrator_spot_infantry',
    "Two riflemen, left side. Walking like nobody told them.",
    'Odessa sees two unaware enemy infantry crossing an opening.',
    'First sentence is a clean tactical report.',
    'Second sentence carries quiet amusement without slowing the information.'),
  line('vo_infiltrator_spot_armor',
    'Armor on the lane. Big, loud, and very sure of itself.',
    'A tank enters view and begins turning its gun toward the squad.',
    'Firm warning with urgency held under control.',
    'Dry contempt on the final phrase, never fearlessness.'),
  line('vo_infiltrator_spot_air',
    'Aircraft overhead. Find something solid and become fond of it.',
    'A hostile aircraft dives toward exposed infantry.',
    'Fast, clear field-report cadence.',
    'Protective command with one flash of wit, not a leisurely joke.'),
  line('vo_infiltrator_spot_cloak',
    "Cloak shimmer, near the wall. Oh, somebody thinks they're subtle.",
    'Odessa catches a tiny distortion from another cloaked operative.',
    'Hushed tactical warning so the target does not realize it has been seen.',
    'Cool professional amusement; she recognizes an amateur mistake.'),

  line('vo_infiltrator_taking_fire',
    "They've got my position! Break their sightline!",
    'Rounds strike the cover around Odessa and the enemy has found her angle.',
    'Yell over immediate gunfire with trained clarity.',
    'Urgent, not panicked; both sentences must remain intelligible.'),
  line('vo_infiltrator_suppressed',
    "I'm pinned! Put something loud in their direction!",
    'Sustained fire traps Odessa behind thin cover and she needs the squad to answer.',
    'Shout in a strong command voice while keeping low.',
    'Frustration and danger, with no playful softness left.'),
  line('vo_infiltrator_grenade_in',
    'GRENADE! MOVE, BABIES, MOVE!',
    'An enemy grenade lands among the squad at Odessa feet.',
    'Full emergency yell from the diaphragm; this must cut through battle noise.',
    'Protective terror drives the repeated command, never theatrical excitement.'),
  line('vo_infiltrator_grenade_out',
    "Little gift going out. Don't crowd the doorway.",
    'Odessa throws a fragmentation grenade through a defended doorway.',
    'Quick matter-of-fact warning timed to the throw.',
    'Dry smile on Little gift, then practical squad safety.'),
  line('vo_infiltrator_reload',
    'Changing magazines. Keep them entertained.',
    'Her railgun is empty while enemies are still pressing the position.',
    'Clipped and breath-aware while hands work.',
    'The second sentence is a calm request for covering fire.'),
  line('vo_infiltrator_reload_dry',
    'DRY! I need five seconds and a small miracle!',
    'The weapon clicks empty at the worst possible moment.',
    'Sharp battlefield shout with a flash of genuine alarm.',
    'Land small miracle as pressured wit, not comedy.'),
  line('vo_infiltrator_ammo_low',
    'Last magazine. Time to make every answer count.',
    'Odessa checks her reserve and finds only one magazine remaining.',
    'Low, sober inventory report.',
    'Resolve settles into the final phrase.'),

  line('vo_infiltrator_kill_1',
    "Mm. You should've watched the quiet side.",
    'A clean rail shot drops an enemy who never saw Odessa flank.',
    'Quiet satisfaction immediately after recoil.',
    'Underplay the line; it is an observation, not a celebration.'),
  line('vo_infiltrator_kill_2',
    'There you go. Lie still for Miss Dee.',
    'A dangerous enemy finally goes down at close range.',
    'Soft and almost soothing, which makes the threat sharper.',
    'No cruelty or cackle; she wants the danger to remain down.'),
  line('vo_infiltrator_kill_3',
    'All that noise, and still you missed the important part.',
    'A loud enemy fires wildly at decoys while Odessa ends the fight from concealment.',
    'Dry disbelief with controlled breath after the shot.',
    'The important part is Odessa, but she never needs to say so.'),
  line('vo_infiltrator_kill_revenge',
    "I remembered you. Aren't you touched?",
    'Odessa finds and eliminates the soldier who killed her in the previous life.',
    'Recognition first, velvet sarcasm second.',
    'Keep the anger cold and contained.'),
  line('vo_infiltrator_kill_multi',
    'Two down. They came together; seemed rude to separate them.',
    'One lined-up rail shot drops two enemies.',
    'Brief surprise becomes pleased understatement.',
    'A little breathless from repositioning, but never rushed.'),

  line('vo_infiltrator_low_health',
    "I'm hurt. Still thinking, though. That's the dangerous part.",
    'Odessa is bleeding badly behind cover but remains tactically alert.',
    'Pain shortens the breath and roughens the voice.',
    'Find steady resolve by the final sentence; no invulnerable bravado.'),
  line('vo_infiltrator_downed',
    "I'm down! Don't you mourn me while I'm still talking!",
    'Odessa hits the ground wounded and needs immediate help.',
    'First sentence is a shocked shout on impact.',
    'Second sentence is strained command and characterful defiance through pain.'),
  line('vo_infiltrator_ally_downed',
    "Soldier down! Cover that body, I'm going to them!",
    'A squadmate collapses in the open and Odessa commits to a rescue.',
    'Loud command voice, protective and decisive.',
    'She is already moving before the last words.'),
  line('vo_infiltrator_reviving',
    'Stay with me, sweetheart. Breathe first; complain later.',
    'Odessa kneels under fire with both hands keeping a wounded soldier alive.',
    'Close, warm, and steady enough to give the patient something to follow.',
    'The wit is gentle reassurance, never dismissal of pain.'),
  line('vo_infiltrator_revived',
    'Thank you, baby. Now point me toward the rude one.',
    'A medic pulls Odessa back to her feet while the fight continues nearby.',
    'Breath returns unevenly; gratitude is completely sincere.',
    'A dangerous little smile arrives on the final phrase.'),
  line('vo_infiltrator_last_stand',
    "Just me, then. All right. I've had quieter evenings.",
    'Odessa realizes every squadmate is down and enemies are closing.',
    'Let loneliness register for one beat before discipline takes over.',
    'Final phrase is gallows wit used to steady herself.'),
  line('death_infiltrator',
    'Oh... hush now... I was listening...',
    'Odessa takes a fatal hit while concealed; the battlefield noise seems to recede as she falls.',
    'Barely voiced and fading, with breath failing between thoughts.',
    'No melodrama, no scream; the quiet operative dies listening.'),

  line('vo_infiltrator_vehicle_enter',
    'Scoot over. Miss Dee is riding.',
    'Odessa climbs into a crowded friendly vehicle as it begins moving.',
    'Warm, practical, and lightly amused.',
    'Sound physically closer and enclosed, but do not add effects.'),
  line('vo_infiltrator_vehicle_damaged',
    'This machine is coming apart! Ease her back!',
    'Heavy impacts tear pieces from the vehicle around Odessa.',
    'Shout over mechanical chaos with urgent command clarity.',
    'She respects the machine and wants the driver to save it.'),
  line('vo_infiltrator_vehicle_bail',
    'OUT! OUT OF THE VEHICLE, NOW!',
    'Fire reaches the vehicle cabin and detonation is seconds away.',
    'Full emergency shout; sharp consonants and no humor.',
    'Protective authority must make hesitation feel impossible.'),

  line('vo_infiltrator_flag_pickup',
    "I've got their colours. Well, won't they be embarrassed.",
    'Odessa takes the enemy flag and turns toward the long route home.',
    'A quick factual report followed by delighted understatement.',
    'She knows the danger has just increased and is moving while speaking.'),
  line('vo_infiltrator_carrier_escort',
    'Stay close to that runner. Pride is heavy when you are carrying it.',
    'A friendly flag carrier crosses exposed ground and needs an escort.',
    'Protective tactical instruction first.',
    'The final observation is wry but never slows the urgency.'),
  line('vo_infiltrator_flag_dropped',
    'Flag is down! Clear the ground around it!',
    'The carrier falls and both teams converge on the dropped flag.',
    'Immediate battlefield yell with clean information.',
    'No wit here; the opening is too brief.'),
  line('vo_infiltrator_flag_capture',
    'That is our capture. Clean work, babies. Almost elegant.',
    'The flag reaches home after a dangerous run and the squad gets one breath of relief.',
    'Controlled celebration, proud and warmly approving.',
    'Almost elegant is a soft dry button, not a criticism.'),

  line('vo_infiltrator_cloak_on_1',
    "Now, let's become a rumor.",
    'Odessa activates her cloak a few steps from enemies and disappears.',
    'Whisper close to the microphone, conspiratorial and pleased.',
    'The voice becomes smaller as if she is already withholding her presence.'),
  line('vo_infiltrator_cloak_on_2',
    "Keep looking forward, darling. That's where I used to be.",
    'The cloak seals around Odessa while an enemy watches the wrong doorway.',
    'Whisper with slow, razor-dry amusement.',
    'No broad joke; this is private confidence spoken inside danger.'),
  line('vo_infiltrator_cloak_move',
    'Easy now... even the air is listening.',
    'Odessa moves inches behind an alert enemy while cloaked.',
    'Whisper on the edge of breath, extremely intimate and controlled.',
    'Slow the rhythm because every footstep matters.'),
  line('vo_infiltrator_cloak_detected',
    'Mm. Those eyes are better than I expected.',
    'An enemy turns toward the distortion and almost identifies Odessa.',
    'Very low urgent murmur, breath briefly held.',
    'Respect the threat; the wit covers a real recalculation.'),
  line('vo_infiltrator_cloak_broken',
    "CLOAK'S GONE! I NEED COVER!",
    'An impact tears down the cloak in full view of several enemies.',
    'Explosive emergency yell caused by sudden exposure.',
    'Fast, frightened, and professionally clear; no composure pose.'),
  line('vo_infiltrator_rail_shot',
    'Hold still... just a little longer.',
    'Odessa settles the rail sight on an unaware distant target while cloaked.',
    'Whisper with patient concentration and minimal breath.',
    'The words are for herself, not a taunt the target can hear.'),
  line('vo_infiltrator_rail_kill',
    'One clean line. That is all it takes.',
    'A precise rail shot passes through the target exactly as planned.',
    'Quiet professional satisfaction after releasing held breath.',
    'No excitement; precision itself is the pleasure.'),
  line('vo_infiltrator_cloak_ready',
    "Cloak is back. Let's try subtlety again.",
    'The cloak finishes recharging after a loud exposed fight.',
    'Relieved low voice with dry self-awareness.',
    'She becomes calmer as the option to disappear returns.'),
  line('vo_infiltrator_cloak_empty',
    'Cloak is dry. No more magic until it charges.',
    'Odessa tries the cloak and finds the energy reserve empty.',
    'Quiet warning to the squad with restrained frustration.',
    'Keep moving; this is information, not a complaint.'),
];

export function odessaPrompt(entry) {
  if (entry.slot === 'death_infiltrator') {
    return buildPrompt({
      persona: ODESSA_FADE_PERSONA,
      scene: 'Her strength gives way and she settles to the ground while the battlefield seems to recede.',
      notes: [
        'Barely voice the words; breath fails between thoughts.',
        'No scream and no melodrama. Remain focused on listening until the voice fades.',
        'Speak only the supplied dialogue. Add no labels, music, effects, or extra words.',
      ],
    });
  }
  return buildPrompt({
    persona: ODESSA_PERSONA,
    scene: entry.scene,
    notes: [
      'Perform the exact physical and emotional moment; do not flatten every bark into the same audiobook cadence.',
      'Use authentic New Orleans rhythm and warmth without exaggerated dialect, parody, or added slang.',
      'Speak only the supplied dialogue. Add no labels, stage directions, introductions, music, or sound effects.',
      ...entry.notes,
    ],
  });
}

export function validateOdessaManifest(lines = ODESSA_LINES) {
  const errors = [];
  if (lines.length < 40) errors.push(`expected at least 40 lines, got ${lines.length}`);
  const seen = new Set();
  for (const entry of lines) {
    if (!entry.slot || (!entry.slot.startsWith('vo_infiltrator_') && entry.slot !== 'death_infiltrator')) errors.push(`invalid slot: ${entry.slot}`);
    if (seen.has(entry.slot)) errors.push(`duplicate slot: ${entry.slot}`);
    seen.add(entry.slot);
    if (!entry.text?.trim()) errors.push(`${entry.slot}: empty text`);
    if (!entry.scene?.trim()) errors.push(`${entry.slot}: empty scene`);
    if (!Array.isArray(entry.notes) || entry.notes.length < 2) errors.push(`${entry.slot}: needs at least two acting notes`);
  }
  if (!seen.has('vo_infiltrator_intro')) errors.push('missing introduction');
  if (!seen.has('death_infiltrator')) errors.push('missing live death slot');
  return errors;
}

export function oggPathFor(wavPath) {
  return wavPath.replace(/\.wav$/i, '.ogg');
}

function encodeOgg(wavPath) {
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', wavPath,
    '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', oggPathFor(wavPath),
  ]);
}

function writeManifest() {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify({
    character: 'Odessa Broussard',
    role: 'Infiltrator',
    voice: VOICE,
    language: LANGUAGE,
    persona: ODESSA_PERSONA,
    lines: ODESSA_LINES,
  }, null, 2)}\n`);
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function generateOne(entry, force) {
  const out = join(AUDIO_DIR, `${entry.slot}.wav`);
  if (!force && existsSync(out)) return { slot: entry.slot, state: 'kept' };
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await generateClip({
        text: entry.text,
        prompt: odessaPrompt(entry),
        voice: VOICE,
        language: LANGUAGE,
        out,
      });
      encodeOgg(out);
      return { slot: entry.slot, state: 'recorded' };
    } catch (error) {
      lastError = error;
      if (attempt < 2) console.warn(`  retry ${entry.slot}: ${error.message}`);
    }
  }
  return { slot: entry.slot, state: 'failed', error: lastError?.message ?? String(lastError) };
}

async function main() {
  const errors = validateOdessaManifest();
  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  writeManifest();
  if (process.argv.includes('--check')) {
    console.log(`Odessa manifest valid: ${ODESSA_LINES.length} unique directed moments.`);
    return;
  }
  if (process.argv.includes('--list')) {
    console.table(ODESSA_LINES.map(({ slot, text }) => ({ slot, text })));
    return;
  }

  const only = argValue('--only');
  const force = process.argv.includes('--force');
  const concurrency = Math.max(1, Math.min(5, Number(argValue('--concurrency')) || 3));
  const jobs = only ? ODESSA_LINES.filter((entry) => entry.slot === only) : ODESSA_LINES;
  if (only && !jobs.length) throw new Error(`unknown Odessa slot: ${only}`);

  let cursor = 0;
  const results = [];
  async function worker() {
    while (cursor < jobs.length) {
      const entry = jobs[cursor++];
      const result = await generateOne(entry, force);
      results.push(result);
      if (result.state === 'failed') console.error(`  x ${entry.slot}: ${result.error}`);
      else console.log(`  ${result.state === 'recorded' ? 'ok' : '--'} ${entry.slot}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const counts = Object.groupBy(results, (result) => result.state);
  const recorded = counts.recorded?.length ?? 0;
  const kept = counts.kept?.length ?? 0;
  const failed = counts.failed?.length ?? 0;
  console.log(`${recorded} recorded, ${kept} kept, ${failed} failed - ${jobs.length} Odessa slots.`);
  if (failed) process.exitCode = 1;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
