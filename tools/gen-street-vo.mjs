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
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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

// ── the lines: read the SINGLE source of truth (src/data/street-lines.json),
//    the very file the runtime catalogue (streetvo.ts) imports — so a voiced
//    clip can never say different words than the game shows. No mirror, no drift.
const LINES = JSON.parse(readFileSync(resolve(ROOT, 'src/data/street-lines.json'), 'utf8'));

const PEDESTRIAN = ['idle', 'gunfire', 'flee', 'god', 'reckless', 'wounded'];
const SCENE = {
  idle:      'standing on a busy street, nothing wrong yet, half-bored',
  gunfire:   'gunfire erupts a block away, sudden fear, protecting others',
  flee:      'running from the fighting, breath short, pulling a friend along',
  god:       'a towering superhuman is walking down the street, awe and dread',
  reckless:  'a car nearly ran them down, indignant, shaken',
  wounded:   'caught by the crossfire, hurt and shocked, calling out',
  challenge: 'a violent stranger will not stop, the vigilante steps forward, done being afraid',
  warn:      'the last word before it turns physical, steady, giving one chance',
  engage:    'swinging now, committed, afraid but doing it anyway',
  triumph:   'the stranger is down at last, standing over them, breathless and defiant',
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
