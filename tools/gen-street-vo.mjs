// ═══════════════════════════════════════════════════════════════════════════
// GEN-STREET-VO — voice the pedestrians and the vigilante, per culture.
//
// Robert: *"different cities sound like the culture code."* This turns the
// text catalogue (src/client/streetvo.ts) into actual audio, reading the
// culture legend (src/sim/culture.ts) for each accent.
//
//   node tools/gen-street-vo.mjs                 # a representative SAMPLE
//   node tools/gen-street-vo.mjs --all           # every clip (216, slow)
//   node tools/gen-street-vo.mjs --culture 13    # just Jamaica
//   node tools/gen-street-vo.mjs --list          # print the plan, generate nothing
//
// The rule from the map-maker spec holds: a cadence and a place, never a
// caricature. The persona names the region and the tongues; the model does the
// accent from the direction, never from a spelled-out phonetic hack.
//
// Output: public/audio/street_<culture>_<event>_<n>.ogg  (+ .wav sibling)
// which is exactly the slot streetvo.ts resolves.
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrompt, generateClip } from './tts-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/audio');

// ── the culture legend, mirrored here (a Node tool cannot import the TS) ────
// region · tongues · a VOICE with the right timbre · the street's outlook.
const CULTURE = {
  1:  { slug: 'the_maghreb', region: 'the Maghreb (North Africa)', tongues: 'Arabic and French', voice: 'Algenib', outlook: 'measured, formal, quick to invoke God' },
  2:  { slug: 'west_africa', region: 'West Africa', tongues: 'Nigerian English and Yoruba', voice: 'Sadaltager', outlook: 'bright, rhythmic, unbothered, trades jokes fast' },
  3:  { slug: 'southern_africa', region: 'Southern Africa', tongues: 'South African English and Zulu', voice: 'Schedar', outlook: 'dry, level, understated, alarmingly calm' },
  5:  { slug: 'south_asia', region: 'South Asia', tongues: 'Indian English, Hindi and Bengali', voice: 'Alnilam', outlook: 'fast, musical, emphatic, repeats louder when ignored' },
  6:  { slug: 'east_asia', region: 'East Asia', tongues: 'Mandarin, Japanese and Korean-inflected English', voice: 'Iapetus', outlook: 'clipped and orderly, then suddenly urgent' },
  8:  { slug: 'central_america_and_the_caribbean', region: 'Central America and the Caribbean', tongues: 'Caribbean Spanish', voice: 'Achird', outlook: 'warm and loud, hands and voice together, family first' },
  9:  { slug: 'western_europe', region: 'Western Europe', tongues: 'French, German and Italian', voice: 'Vindemiatrix', outlook: 'cool, precise, faintly exasperated, has seen this before' },
  10: { slug: 'eastern_europe', region: 'Eastern Europe', tongues: 'Russian and Ukrainian', voice: 'Rasalgethi', outlook: 'blunt, weary, darkly funny, expects the worst' },
  11: { slug: 'oceania', region: 'Australia and New Zealand', tongues: 'Australian English', voice: 'Zubenelgenubi', outlook: 'laconic and cheeky, understates the danger and swears at it' },
  12: { slug: 'south_america', region: 'South America', tongues: 'Brazilian Portuguese and Rioplatense Spanish', voice: 'Laomedeia', outlook: 'expressive, quick-tempered, passionate' },
  13: { slug: 'jamaica', region: 'Jamaica', tongues: 'Jamaican Patois', voice: 'Gacrux', outlook: 'lilting, unhurried, sharp, a threat like a lyric' },
  14: { slug: 'the_middle_east', region: 'the Middle East', tongues: 'Persian, Arabic and Hebrew', voice: 'Sadachbia', outlook: 'formal and proud, ornate even in anger' },
};

// ── the lines, mirrored from streetvo.ts (kept in lockstep by the test) ─────
const LINES = {
  1:  { gunfire: ['God protect us — inside, inside!'], flee: ['Yalla! This way!'], god: ['That is not a man. Look at it.'], reckless: ['Are you blind? People walk here!'], challenge: ['Enough. You will stop this now.'], warn: ['Last warning, stranger. Turn around.'], engage: ['You chose this!'], idle: ['Sit, sit — the shade is here.'] },
  2:  { gunfire: ['Chai! Who is shooting? Run!'], flee: ['Comot for road! Comot!'], god: ['God abeg. What is that thing?'], reckless: ['You wan kill person? Oya reverse!'], challenge: ['You don do. Stop am now now.'], warn: ['I dey warn you well well. Go back.'], engage: ['Come then! Come!'], idle: ['Ah-ah, this heat today, eh.'] },
  3:  { gunfire: ['Eish — that is shooting. Move.'], flee: ['Come, come, this side, quick.'], god: ['That, my friend, is a big problem.'], reckless: ['Hey wena! Watch where you drive!'], challenge: ['No. That is enough now.'], warn: ['I am asking you nicely. Once.'], engage: ['Alright then. Come.'], idle: ['Ja, the taxi is late again, hey.'] },
  5:  { gunfire: ['Hai Ram! Firing, firing — run!'], flee: ['Chalo, chalo, this way, fast!'], god: ['Bhagwan. That is no ordinary man.'], reckless: ['Oye! Are you driving with eyes closed?'], challenge: ['Bas. Enough now. You stop.'], warn: ['I am warning you. Once only.'], engage: ['You have done too much!'], idle: ['Arre, the chai is finished already?'] },
  6:  { gunfire: ['Guns — get inside, now!'], flee: ['This way, quickly, follow!'], god: ['That is not human. Do not look at it.'], reckless: ['Hey! Watch the road!'], challenge: ['Stop. That is enough.'], warn: ['I am telling you once. Leave.'], engage: ['Then come!'], idle: ['The line for noodles is too long today.'] },
  8:  { gunfire: ['Dios mío — balas! Corre!'], flee: ['Vámonos, vámonos, this way!'], god: ['Madre de Dios. What IS that?'], reckless: ['Oye! You almost kill me, cabrón!'], challenge: ['Ya. That is enough, hombre.'], warn: ['Te lo digo una vez. Go.'], engage: ['For my people!'], idle: ['Oye, primo, you saw the game?'] },
  9:  { gunfire: ['Mon dieu — gunfire. Inside!'], flee: ['Allez, this way, quickly!'], god: ['That is... that is not possible.'], reckless: ['Imbécile! Watch where you drive!'], challenge: ['No. This ends. Now.'], warn: ['I will say it once. Leave.'], engage: ['For all of them, then.'], idle: ['The trains, again, honestly.'] },
  10: { gunfire: ['Shooting. Of course. Get down.'], flee: ['Idi, idi — this way!'], god: ['So. The monsters are real. Good.'], reckless: ['Blind, are you? Watch the road!'], challenge: ['Enough. You stop. Now.'], warn: ['I warn you one time. Go.'], engage: ['For all of them.'], idle: ['Cold today. Colder tomorrow.'] },
  11: { gunfire: ['Strewth — that’s shots! Get down!'], flee: ['This way, come on, leg it!'], god: ['Yeah, nah, that’s not right at all.'], reckless: ['Oi! Watch it, ya galah!'], challenge: ['Right. That’s enough of that.'], warn: ['Fair warning. Rack off.'], engage: ['Righto then. Come on.'], idle: ['Bloody hot one today, mate.'] },
  12: { gunfire: ['Meu Deus — tiros! Corre!'], flee: ['Vamos, vamos, por aqui!'], god: ['Nossa. What in God’s name is that?'], reckless: ['Ô meu, quase me mata! Devagar!'], challenge: ['Chega. That is enough.'], warn: ['Te aviso uma vez. Go.'], engage: ['Por todos, então!'], idle: ['Viste el partido? Increíble.'] },
  13: { gunfire: ['Lawd — a shot dat! Move!'], flee: ['Come, come, dis way, quick!'], god: ['Jah know. Wah kinda ting dat?'], reckless: ['Ey! Yuh nearly mash me up!'], challenge: ['Nuh more a dat. Stop it now.'], warn: ['Mi a warn yuh one time. Gwaan.'], engage: ['Fi everybody yuh trouble!'], idle: ['Wah gwaan, di patty shop open yet?'] },
  14: { gunfire: ['In the name of God — take cover!'], flee: ['This way, quickly, come!'], god: ['This is beyond men. Look at it.'], reckless: ['Have you no eyes? People walk here!'], challenge: ['That is far enough now. Turn back.'], warn: ['I warn you but once. Depart.'], engage: ['For every soul you wronged!'], idle: ['The tea has gone cold, as always.'] },
};

const PEDESTRIAN = ['idle', 'gunfire', 'flee', 'god', 'reckless'];
const SCENE = {
  idle:      'standing on a busy street, nothing wrong yet, half-bored',
  gunfire:   'gunfire erupts a block away, sudden fear, protecting others',
  flee:      'running from the fighting, breath short, pulling a friend along',
  god:       'a towering superhuman is walking down the street, awe and dread',
  reckless:  'a car nearly ran them down, indignant, shaken',
  challenge: 'a violent stranger will not stop, the vigilante steps forward, done being afraid',
  warn:      'the last word before it turns physical, steady, giving one chance',
  engage:    'swinging now, committed, afraid but doing it anyway',
};

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const ALL = args.includes('--all');
const LIST = args.includes('--list');
const onlyCulture = args.includes('--culture') ? Number(args[args.indexOf('--culture') + 1]) : null;

// the SAMPLE: six diverse cultures, three iconic events each (a pedestrian
// panic, an awe line, a vigilante challenge) — enough to hear the difference.
const SAMPLE_CULTURES = [2, 6, 8, 10, 13, 14];
const SAMPLE_EVENTS = ['gunfire', 'god', 'challenge'];

function plan() {
  const jobs = [];
  const codes = onlyCulture ? [onlyCulture]
    : ALL ? Object.keys(CULTURE).map(Number)
    : SAMPLE_CULTURES;
  for (const code of codes) {
    const c = CULTURE[code];
    if (!c) continue;
    const events = ALL || onlyCulture ? Object.keys(LINES[code]) : SAMPLE_EVENTS;
    for (const event of events) {
      const arr = LINES[code]?.[event]; if (!arr) continue;
      arr.forEach((text, i) => {
        const speaker = PEDESTRIAN.includes(event) ? 'pedestrian' : 'vigilante';
        jobs.push({ code, c, event, i, text, speaker, slot: `street_${c.slug}_${event}_${i + 1}` });
      });
    }
  }
  return jobs;
}

const jobs = plan();
if (LIST) {
  for (const j of jobs) console.log(`${j.slot.padEnd(46)} [${j.c.voice}] ${j.speaker}: "${j.text}"`);
  console.log(`\n${jobs.length} clips planned.`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
console.log(`Generating ${jobs.length} street clips${ALL ? ' (FULL)' : onlyCulture ? ` (culture ${onlyCulture})` : ' (sample)'}…\n`);

let made = 0, skipped = 0, failed = 0;
for (const j of jobs) {
  const ogg = resolve(OUT, `${j.slot}.ogg`);
  if (existsSync(ogg) && !args.includes('--force')) { skipped++; continue; }
  const persona = `A civilian ${j.speaker} from ${j.c.region}, an ordinary person on the street. Their English carries the cadence of ${j.c.tongues}. The street here is ${j.c.outlook}. This is a real dignified person reacting in the moment — a specific place, never a caricature or a cartoon accent.`;
  const prompt = buildPrompt({ persona, scene: SCENE[j.event] ?? 'on the street', notes: ['Keep it short — a shout or a snapped sentence, under three seconds.', 'React, do not perform. This is a real moment, not a line reading.'] });
  try {
    const wav = resolve(OUT, `${j.slot}.wav`);
    await generateClip({ text: j.text, prompt, voice: j.c.voice, out: wav });
    // to .ogg (the shipped format), keep the wav as the pipeline source
    try { execFileSync('ffmpeg', ['-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', ogg], { stdio: 'ignore' }); }
    catch { /* no ffmpeg — the .wav still plays; the boot loader tries .ogg then .wav */ }
    made++;
    console.log(`  ✓ ${j.slot}  [${j.c.voice}]  "${j.text}"`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${j.slot}  — ${e.message?.slice(0, 80)}`);
  }
}
console.log(`\nmade ${made} · skipped ${skipped} · failed ${failed}`);
