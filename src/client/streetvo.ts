// ═══════════════════════════════════════════════════════════════════════════
// STREET VO — the pedestrians and the vigilante, speaking in the local voice.
//
// Robert: *"do vigilante and pedestrian audio. Different cities sound like the
// culture code."*
//
// Two speakers on the street, and they escalate into each other:
//
//   THE PEDESTRIAN — the world's bystander. Chatters when calm, panics at
//     gunfire, points when a god walks, curses you when you drive like that.
//     This is the "civilian" the traffic layer (traffic.ts) already models as
//     a fleeing car — now it has a voice.
//
//   THE VIGILANTE — the pedestrian who does NOT run. The lore's seed: do bad
//     things in a print and the street turns on you (docs/THE-LORE.md — the
//     police come, but first a neighbour with a bat). A vigilante challenges,
//     warns, and if you push it, fights. Escalated from a pedestrian by
//     violence near civilians.
//
// Every line is keyed by (event, culture code), so a Lagos street (code 2) and
// a Kingston street (code 13) say the same thing in a different mouth. The
// TEXT is here; the VOICE is the TTS generator (tools/gen-street-vo.mjs), which
// reads culture.ts for the accent. Slots resolve `street_<culture>_<event>_<n>`.
//
// Pure catalogue + a deterministic picker. No DOM, no rng — hash01 so a bark
// never perturbs the match stream.
// ═══════════════════════════════════════════════════════════════════════════
import { hash01 } from '../sim/rng';
import { cultureFor, cultureSlug, type Culture } from '../sim/culture';
import STREET_LINES from '../data/street-lines.json';

export type Speaker = 'pedestrian' | 'vigilante';

export type StreetEvent =
  // pedestrian
  | 'idle'          // ambient chatter, nothing wrong
  | 'gunfire'       // shots nearby — the street reacts
  | 'flee'          // actively running from the danger
  | 'god'           // an Ascendant is walking — awe and terror
  | 'reckless'      // you nearly ran them over
  | 'wounded'       // hurt in the crossfire
  // vigilante
  | 'challenge'     // steps up: "that's enough"
  | 'warn'          // last word before it turns physical
  | 'engage'        // swinging now
  | 'triumph';      // you went down and they stood over you

/** One line, in a culture's own mouth. `text` is what the TTS speaks. */
export interface StreetLine {
  event: StreetEvent;
  speaker: Speaker;
  text: string;
}

/**
 * THE CATALOGUE is data — `src/data/street-lines.json`, the SINGLE source of
 * truth the TTS generator (tools/gen-street-vo.mjs) reads too, so a voiced clip
 * can never drift from the words on the page. code → event → lines (two per
 * event so a street never loops one phrase; the generator voices both).
 *
 * The lines lean on cadence and outlook, not caricature — the same rule the
 * map-maker set for the buildings. English on the page; the TTS persona adds
 * the accent from culture.ts.
 */
const LINES = STREET_LINES as unknown as Record<number, Partial<Record<StreetEvent, string[]>>>;

/** The lines for a culture, with a sane fallback so nowhere is mute. */
function linesFor(code: number, event: StreetEvent): string[] {
  return LINES[code]?.[event] ?? LINES[9]?.[event] ?? ['...'];
}

/** The first (canonical, slot _1) line for a culture+event — the one the TTS
 *  generator voices, so a test can pin generator↔catalogue lockstep. */
export function canonicalLine(code: number, event: StreetEvent): string {
  return LINES[code]?.[event]?.[0] ?? '...';
}

/** Every (culture, event) pair the generator must voice — the manifest. */
export function streetManifest(): Array<{ code: number; slug: string; event: StreetEvent; speaker: Speaker; index: number; text: string }> {
  const out: Array<{ code: number; slug: string; event: StreetEvent; speaker: Speaker; index: number; text: string }> = [];
  const speakerOf = (e: StreetEvent): Speaker =>
    (['challenge', 'warn', 'engage', 'triumph'].includes(e) ? 'vigilante' : 'pedestrian');
  for (const codeStr of Object.keys(LINES)) {
    const code = Number(codeStr);
    const slug = cultureSlug(code);
    for (const event of Object.keys(LINES[code]) as StreetEvent[]) {
      LINES[code][event]!.forEach((text, index) => {
        out.push({ code, slug, event, speaker: speakerOf(event), index, text });
      });
    }
  }
  return out;
}

/**
 * Pick a line for this street. `seed` keeps it deterministic (a bark must not
 * consume an rng draw). Returns the sound slot AND the text, so a build with no
 * audio yet can still show the words over the speaker's head.
 */
export function pickStreetLine(code: number | null | undefined, event: StreetEvent, seed: number): {
  slot: string; text: string; culture: Culture;
} {
  const culture = cultureFor(code);
  const resolved = culture.code; // -1 for neutral
  const pool = linesFor(resolved === -1 ? 9 : resolved, event);
  const i = pool.length ? Math.floor(hash01(seed) * pool.length) % pool.length : 0;
  const slug = cultureSlug(code);
  return {
    slot: `street_${slug}_${event}_${i + 1}`,
    text: pool[i] ?? '...',
    culture,
  };
}
