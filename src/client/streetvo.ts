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
 * THE CATALOGUE, per culture.
 *
 * The lines lean on cadence and outlook, not caricature — the same rule the
 * map-maker set for the buildings. English on the page; the TTS persona adds
 * the accent from culture.ts. Two lines per event keeps a street from looping
 * one phrase; the generator can add more without touching the picker.
 */
const LINES: Record<number, Partial<Record<StreetEvent, string[]>>> = {
  // 1 — THE MAGHREB
  1: {
    idle: ['The bread is better on the far corner.', 'Sit, sit — the shade is here.'],
    gunfire: ['God protect us — inside, inside!', 'Not again. Down, get down.'],
    flee: ['Yalla! This way!', 'Leave it, leave everything, go!'],
    god: ['That is not a man. Look at it.', 'My grandmother spoke of these. I did not believe her.'],
    reckless: ['Are you blind? People walk here!', 'Slow down, you son of a dog!'],
    challenge: ['Enough. You will stop this now.', 'You bring this to our street? No.'],
    warn: ['Last warning, stranger. Turn around.', 'Do not make me. Please.'],
    engage: ['For my neighbours, then!', 'You chose this!'],
    triumph: ['Stay down. It is finished.', 'The street remembers your face now.'],
  },
  // 2 — WEST AFRICA
  2: {
    idle: ['Ah-ah, this heat today, eh.', 'My friend, you owe me since Tuesday o.'],
    gunfire: ['Chai! Who is shooting? Run!', 'No be play be this — move!'],
    flee: ['Comot for road! Comot!', 'Leave am, leave am, we dey go!'],
    god: ['God abeg. What is that thing?', 'Nobody told me the sky people are real.'],
    reckless: ['You wan kill person? Oya reverse!', 'Are you mad? Watch your front!'],
    challenge: ['You don do. Stop am now now.', 'Not for this street, my friend. No.'],
    warn: ['I dey warn you well well. Go back.', 'Try am. Just try am one time.'],
    engage: ['Come then! Come!', 'For everybody wey you scatter!'],
    triumph: ['Stay for ground. You hear?', 'Naija no dey fear you.'],
  },
  // 3 — SOUTHERN AFRICA
  3: {
    idle: ['Ja, the taxi is late again, hey.', 'Shame, look at this weather.'],
    gunfire: ['Eish — that is shooting. Move.', 'No man, not here. Get down.'],
    flee: ['Come, come, this side, quick.', 'Just leave it, we go now.'],
    god: ['That, my friend, is a big problem.', 'I have never seen such a thing. Never.'],
    reckless: ['Hey wena! Watch where you drive!', 'You nearly got me, boet. Slow down.'],
    challenge: ['No. That is enough now.', 'Not on my street, china. Stop.'],
    warn: ['I am asking you nicely. Once.', 'Turn around. I will not say it again.'],
    engage: ['Alright then. Come.', 'For all of them, hey.'],
    triumph: ['Stay down there. Ja.', 'You picked the wrong street, boet.'],
  },
  // 5 — SOUTH ASIA
  5: {
    idle: ['Arre, the chai is finished already?', 'One minute, one minute, I am coming.'],
    gunfire: ['Hai Ram! Firing, firing — run!', 'Inside! Everybody inside, jaldi!'],
    flee: ['Chalo, chalo, this way, fast!', 'Leave the shop, just leave, go!'],
    god: ['Bhagwan. That is no ordinary man.', 'I am telling you — the old stories are true.'],
    reckless: ['Oye! Are you driving with eyes closed?', 'Slowly, slowly! People are here, na!'],
    challenge: ['Bas. Enough now. You stop.', 'Not in this gali, my friend. No.'],
    warn: ['I am warning you. Once only.', 'Go back now. Please, I am saying nicely.'],
    engage: ['Come then! For the whole colony!', 'You have done too much!'],
    triumph: ['Stay down. It is over, na.', 'This street does not forget.'],
  },
  // 6 — EAST ASIA
  6: {
    idle: ['The line for noodles is too long today.', 'Did you see the news this morning?'],
    gunfire: ['Guns — get inside, now!', 'Down! Everyone down!'],
    flee: ['This way, quickly, follow!', 'Leave it — go, go!'],
    god: ['That is not human. Do not look at it.', 'The reports were true. It is real.'],
    reckless: ['Hey! Watch the road!', 'You almost hit me — slow down!'],
    challenge: ['Stop. That is enough.', 'Not here. Not on this street.'],
    warn: ['I am telling you once. Leave.', 'Do not force this. Turn back.'],
    engage: ['Then come!', 'For all of them!'],
    triumph: ['Stay down. It is done.', 'We will remember you.'],
  },
  // 8 — CENTRAL AMERICA & CARIBBEAN
  8: {
    idle: ['Ay, mira, the coffee is cold again.', 'Oye, primo, you saw the game?'],
    gunfire: ['Dios mío — balas! Corre!', 'Al suelo! Everybody down!'],
    flee: ['Vámonos, vámonos, this way!', 'Deja eso — go, go, go!'],
    god: ['Madre de Dios. What IS that?', 'My abuela warned me. She was right.'],
    reckless: ['Oye! You almost kill me, cabrón!', 'Despacio! There are people here!'],
    challenge: ['Ya. That is enough, hombre.', 'Not on my block. No, señor.'],
    warn: ['Te lo digo una vez. Go.', 'Do not make me. I am asking.'],
    engage: ['Ándale, then! Come!', 'For my people!'],
    triumph: ['Stay down. Se acabó.', 'This barrio knows your face now.'],
  },
  // 9 — WESTERN EUROPE
  9: {
    idle: ['The trains, again, honestly.', 'Another grey morning. Wonderful.'],
    gunfire: ['Mon dieu — gunfire. Inside!', 'Down, everyone, now!'],
    flee: ['Allez, this way, quickly!', 'Leave it, just come!'],
    god: ['That is... that is not possible.', 'So the broadcasts did not exaggerate.'],
    reckless: ['Imbécile! Watch where you drive!', 'Slow down — this is not a track!'],
    challenge: ['No. This ends. Now.', 'Not in this quarter. Stop.'],
    warn: ['I will say it once. Leave.', 'Turn around. Do not test me.'],
    engage: ['Very well. Come.', 'For all of them, then.'],
    triumph: ['Stay down. It is finished.', 'We do not forget faces here.'],
  },
  // 10 — EASTERN EUROPE
  10: {
    idle: ['Cold today. Colder tomorrow.', 'The kiosk is out of everything, of course.'],
    gunfire: ['Shooting. Of course. Get down.', 'Again this. Inside, now.'],
    flee: ['Idi, idi — this way!', 'Leave it. It was never yours. Go.'],
    god: ['So. The monsters are real. Good.', 'My father would have laughed. Then run.'],
    reckless: ['Blind, are you? Watch the road!', 'Slow, idiot. People here.'],
    challenge: ['Enough. You stop. Now.', 'Not this street. No.'],
    warn: ['I warn you one time. Go.', 'Turn back. I am not joking.'],
    engage: ['So. Come then.', 'For all of them.'],
    triumph: ['Stay down. Is finished.', 'We remember. We always remember.'],
  },
  // 11 — OCEANIA
  11: {
    idle: ['Bloody hot one today, mate.', 'Servo was out of pies again, typical.'],
    gunfire: ['Strewth — that’s shots! Get down!', 'Oi, inside, now, move!'],
    flee: ['This way, come on, leg it!', 'Leave it, mate, just go!'],
    god: ['Yeah, nah, that’s not right at all.', 'Reckon the telly wasn’t having us on then.'],
    reckless: ['Oi! Watch it, ya galah!', 'Slow down, mate, people here!'],
    challenge: ['Right. That’s enough of that.', 'Not round here, mate. Pack it in.'],
    warn: ['Fair warning. Rack off.', 'Don’t make me, mate. Last chance.'],
    engage: ['Righto then. Come on.', 'For everyone ya flattened!'],
    triumph: ['Stay down, mate. Done.', 'Should’ve picked another street, eh.'],
  },
  // 12 — SOUTH AMERICA
  12: {
    idle: ['Ô, meu, the bus is never coming.', 'Viste el partido? Increíble.'],
    gunfire: ['Meu Deus — tiros! Corre!', 'Al piso! Everybody down!'],
    flee: ['Vamos, vamos, por aqui!', 'Deixa isso — go, go!'],
    god: ['Nossa. What in God’s name is that?', 'Mi abuelo lo dijo. He was right.'],
    reckless: ['Ô meu, quase me mata! Devagar!', 'Cuidado! There are people, che!'],
    challenge: ['Chega. That is enough.', 'No en mi barrio. Stop.'],
    warn: ['Te aviso uma vez. Go.', 'Do not force me. Por favor.'],
    engage: ['Então vem! Come!', 'Por todos, então!'],
    triumph: ['Fica no chão. It is over.', 'This street knows you now.'],
  },
  // 13 — JAMAICA
  13: {
    idle: ['Wah gwaan, di patty shop open yet?', 'Bwoy, di heat a nuh joke today.'],
    gunfire: ['Lawd — a shot dat! Move!', 'Duck down, everybody, duck down!'],
    flee: ['Come, come, dis way, quick!', 'Lef it, jus lef it, mek we go!'],
    god: ['Jah know. Wah kinda ting dat?', 'Di old people did warn we. A true.'],
    reckless: ['Ey! Yuh nearly mash me up!', 'Slow down, yout — people deh yah!'],
    challenge: ['Nuh more a dat. Stop it now.', 'Not pon dis corner. No sah.'],
    warn: ['Mi a warn yuh one time. Gwaan.', 'Nuh mek mi. Mi a beg yuh.'],
    engage: ['Come then! Come!', 'Fi everybody yuh trouble!'],
    triumph: ['Stay down deh. Done.', 'Di corner nah forget yuh face.'],
  },
  // 14 — THE MIDDLE EAST
  14: {
    idle: ['The tea has gone cold, as always.', 'You heard? They say prices rise again.'],
    gunfire: ['In the name of God — take cover!', 'Down! All of you, down!'],
    flee: ['This way, quickly, come!', 'Leave the goods — go, go!'],
    god: ['This is beyond men. Look at it.', 'The prophets spoke of such days.'],
    reckless: ['Have you no eyes? People walk here!', 'Slower! This is no place to race!'],
    challenge: ['That is far enough now. Turn back.', 'Not upon our street. Enough.'],
    warn: ['I warn you but once. Depart.', 'Do not compel me. I ask you.'],
    engage: ['Then come, and God decide!', 'For every soul you wronged!'],
    triumph: ['Remain down. It is ended.', 'Your face is known to us now.'],
  },
};

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
