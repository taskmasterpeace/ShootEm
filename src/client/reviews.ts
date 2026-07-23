// ---------------------------------------------------------------------------
// THE SERVICE NET (Robert's goal): the Codex grows a review layer — soldiers
// of the war rating their own kit. 1-5 stars, PREMADE phrases only (that IS
// the spam armor: canned text can't be abused), one filing per item per
// print, a cooldown between filings, and a drill-down where every review
// wears its reviewer's PRINT CARD (callsign · class · nation · print number).
//
// Offline truth: "other people" are the war's own population — deterministic
// synthetic reviews seeded per item (same item, same reviews, every boot),
// from the same callsign pool the bots deploy with. YOUR review is real,
// stored locally, and always listed first. The schema is server-shaped: when
// accounts land (#83), synth rows swap for wire rows and nothing else moves.
// ---------------------------------------------------------------------------
import { CLASSES } from '../sim/data';
import { NATIONS } from '../data/nations';
import { loadIdentity } from './identity';
import type { ClassId } from '../sim/types';

export type ReviewCategory = 'weapon' | 'vehicle' | 'class' | 'ascendant' | 'threat';

/** codex section id → phrase category */
export const SECTION_CATEGORY: Record<string, ReviewCategory> = {
  weapons: 'weapon', vehicles: 'vehicle', civilian: 'vehicle', infantry: 'class', ascendants: 'ascendant', threats: 'threat',
};

export interface Reviewer {
  callsign: string;
  classId: ClassId;
  nation: string;   // nation name — the card's flag line
  print: number;    // which print of them is talking
  confirms: number; // service line: confirmed kills (with this kit, they claim)
}

export interface Review {
  stars: 1 | 2 | 3 | 4 | 5;
  phrase: string;
  reviewer: Reviewer;
  mine?: boolean;
}

// ── the premade text (the ONLY text a review can carry) ─────────────────────
// Bands: hi = 4-5★, mid = 3★, lo = 1-2★. House voice: service-review deadpan.
export const PHRASES: Record<ReviewCategory, { hi: string[]; mid: string[]; lo: string[] }> = {
  weapon: {
    hi: [
      'Never jams. Took the ridge with it.',
      'Put three prints back in the bay before breakfast.',
      'Groups tight at range. Would requisition again.',
      'The reload is a prayer you finish in time. It always finishes.',
      'Carried it two tours. It carried me back.',
    ],
    mid: [
      'Does what the sheet says. No more, no less.',
      'Fine weapon. Wrong war.',
      'Kicks harder than the manual admits.',
      'Acceptable. My last one was better and I will not elaborate.',
    ],
    lo: [
      'Jammed during the one moment that mattered. Filing this from the bay.',
      'The reload drags like a Sunday shift.',
      'Sights lie at distance. So did the recruiter.',
      'Requisitioned a replacement. For the replacement.',
    ],
  },
  vehicle: {
    hi: [
      'Ate a rocket and asked for seconds.',
      'Hauls the whole squad and their grudges.',
      'Turns like a rumor. Everywhere at once.',
      'The printer makes them faster than the enemy makes wrecks. Bless the molds.',
    ],
    mid: [
      'Runs. Mostly in the direction you ask.',
      'The heater works. The armor is a matter of opinion.',
      'Adequate hull. Bring friends.',
    ],
    lo: [
      'Abandoned it. It understood.',
      'Armor thin enough to read the enemy stencils through.',
      'The fuel gauge is fiction. So was my extraction.',
      'Would not survive again.',
    ],
  },
  class: {
    hi: [
      'The kit does the job when you do yours.',
      'Deployed as this every print since. No complaints filed.',
      'The loadout earns its weight.',
    ],
    mid: [
      'Solid posting. The hours are terrible.',
      'You get used to it. That is the review.',
    ],
    lo: [
      'Requested transfer. Request denied. We have enough of me.',
      'The kit assumes courage I was not issued.',
    ],
  },
  ascendant: {
    hi: [
      'Watched it clear a front in forty seconds. Kept a respectful distance.',
      'Our god. Worth every unit of the levy.',
      'The telegraph gives you time to pray. Generous, honestly.',
    ],
    mid: [
      'Impressive. Expensive. Loud.',
      'It won the field and stepped on the field. Mixed feelings.',
    ],
    lo: [
      'Fell to a tank inside a minute. The levy is not refundable.',
      'Arrived late, left early, billed the front.',
    ],
  },
  threat: {
    hi: [
      'Respectfully, an excellent horror. Five stars, from cover.',
      'Punctual, committed, extremely bitey. The professionalism is noted.',
    ],
    mid: [
      'Killable, given friends and a budget.',
      'A fair fight, if you cheat.',
    ],
    lo: [
      'Bit my medic. Would not engage again.',
      'Zero stars was not an option. Filing a complaint with the printer.',
      'It ate the review I wrote about it.',
    ],
  },
};

// ── deterministic synth population ──────────────────────────────────────────
const CALLSIGNS = ['Vex', 'Talon', 'Havoc', 'Rook', 'Cinder', 'Drifter', 'Onyx', 'Piston',
  'Gault', 'Merc', 'Static', 'Bishop', 'Fang', 'Widow', 'Jinx', 'Saber'] as const;
const REVIEW_CLASSES: ClassId[] = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function rng(seed: number) {
  let x = seed || 1;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}

/** The war's own voices — same item, same reviews, every boot. */
export function synthReviews(itemId: string, category: ReviewCategory): Review[] {
  const r = rng(hash(`${category}:${itemId}`));
  const count = 3 + Math.floor(r() * 6); // 3..8 voices
  const out: Review[] = [];
  for (let i = 0; i < count; i++) {
    // kit skews content (2-5★); threats skew traumatized (1-3★, the joke)
    const stars = (category === 'threat'
      ? 1 + Math.floor(r() * 3)
      : 2 + Math.floor(r() * 4)) as Review['stars'];
    const band = stars >= 4 ? 'hi' : stars === 3 ? 'mid' : 'lo';
    const pool = PHRASES[category][band];
    out.push({
      stars,
      phrase: pool[Math.floor(r() * pool.length)],
      reviewer: {
        callsign: CALLSIGNS[Math.floor(r() * CALLSIGNS.length)],
        classId: REVIEW_CLASSES[Math.floor(r() * REVIEW_CLASSES.length)],
        nation: NATIONS[Math.floor(r() * NATIONS.length)].name,
        print: 1 + Math.floor(r() * 6),
        confirms: Math.floor(r() * 60),
      },
    });
  }
  return out;
}

// ── the player's own filings (localStorage; server-shaped) ──────────────────
const KEY = 'ww_reviews';

/** storage seam — the vitest env ships a write-dropping localStorage stub, so
 *  tests inject a memory backing here; the game uses the real thing. */
export const reviewStorage = {
  get(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v: string): void { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
};
interface MyReview { stars: Review['stars']; band: 'hi' | 'mid' | 'lo'; phraseIdx: number; at: number }
interface Store { items: Record<string, MyReview>; lastFiledAt: number }

export const FILE_COOLDOWN_MS = 30_000; // spam armor #2: one filing per half-minute

function loadStore(): Store {
  try {
    const raw = JSON.parse(reviewStorage.get() ?? '{}') as Partial<Store>;
    return { items: raw.items ?? {}, lastFiledAt: raw.lastFiledAt ?? 0 };
  } catch { return { items: {}, lastFiledAt: 0 }; }
}

/** Can this print file right now? '' = yes, else the reason (shown verbatim). */
export function fileGate(now = Date.now()): string {
  const st = loadStore();
  if (now - st.lastFiledAt < FILE_COOLDOWN_MS) {
    const left = Math.ceil((FILE_COOLDOWN_MS - (now - st.lastFiledAt)) / 1000);
    return `THE NET RATE-LIMITS ENTHUSIASM — ${left}s`;
  }
  return '';
}

/** File (or REPLACE — one review per item per print, spam armor #1). */
export function fileReview(itemId: string, stars: Review['stars'], phraseIdx: number, now = Date.now()): boolean {
  if (fileGate(now)) return false;
  const st = loadStore();
  const band = stars >= 4 ? 'hi' : stars === 3 ? 'mid' : 'lo';
  st.items[itemId] = { stars, band, phraseIdx, at: now };
  st.lastFiledAt = now;
  reviewStorage.set(JSON.stringify(st));
  return true;
}

export function myReview(itemId: string, category: ReviewCategory): Review | null {
  const st = loadStore();
  const m = st.items[itemId];
  if (!m) return null;
  const id = loadIdentity();
  const pool = PHRASES[category][m.band];
  return {
    stars: m.stars,
    phrase: pool[Math.min(m.phraseIdx, pool.length - 1)],
    mine: true,
    reviewer: {
      callsign: id?.callsign ?? 'RECRUIT',
      classId: 'infantry',
      nation: id ? (NATIONS.find((n) => n.code === id.nationCode)?.name ?? 'UNREGISTERED') : 'UNREGISTERED',
      print: 1,
      confirms: 0,
    },
  };
}

/** Everyone's voices for the drill-down — yours first. */
export function reviewsFor(itemId: string, category: ReviewCategory): Review[] {
  const mine = myReview(itemId, category);
  const synth = synthReviews(itemId, category);
  return mine ? [mine, ...synth] : synth;
}

export function aggregate(itemId: string, category: ReviewCategory): { avg: number; count: number } {
  const all = reviewsFor(itemId, category);
  const sum = all.reduce((a, rv) => a + rv.stars, 0);
  return { avg: all.length ? sum / all.length : 0, count: all.length };
}

/** The star row, mono-vocabulary (filled/empty — no emoji). */
export function starRow(v: number): string {
  const full = Math.round(v);
  return '★★★★★'.slice(0, full).padEnd(5, '☆');
}

/** Class name for the print card. */
export function reviewerClassName(c: ClassId): string {
  return CLASSES[c]?.name ?? c;
}
