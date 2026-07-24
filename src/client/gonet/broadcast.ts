// ---------------------------------------------------------------------------
// GONET BROADCAST — the video desk.
//
// THREE-GAMES-ONE-WAR §Media: *"news TV reporting what players actually did."*
//
// There is no video file in this game and there should not be one: pre-rendered
// footage would show a war that never happened. A broadcast here is a REEL —
// an ordered set of timed shots, played on a real transport (play/pause, seek,
// next, autoplay to the following reel) and drawn as broadcast graphics. The
// content comes off the press issues the newspaper already files, the board's
// times, and the ministry's books. It reports what you actually did.
//
// Pure: reels in, no DOM. The player in gonet.ts runs the transport.
// ---------------------------------------------------------------------------
import { loadPress, type PressIssue } from '../newspaper';
import { allRecords } from '../records';
import { LICENCES, type LicenceId } from '../../sim/licenses';
import { COURSES } from '../../sim/courses';
import { loadLicences } from '../licences';
import { factionLabel, type PlayerIdentity } from '../identity';
import { fixtures, leagueLine, sportById, standings } from './sports';

/**
 * THE THREE THINGS ON A TELEVISION (Robert: *"we need Movies, Shows, News
 * under video — but use what we already have"*).
 *
 * A genre is not a folder, it is a PROMISE about what the thing is:
 *
 *   NEWS    perishable. Dated, about this week, worthless next month.
 *   SHOWS   returning. A strand with episodes that keeps coming back.
 *   MOVIES  singular. One long thing about one big thing you did.
 *
 * Everything under all three is generated from what the game already knows —
 * the press the newspaper filed, the board's times, the register of
 * certifications, the league fixtures. Still no video file, and still on
 * purpose: pre-rendered footage would show a war that never happened.
 */
export type VideoGenre = 'news' | 'shows' | 'movies';

export interface Genre {
  id: VideoGenre;
  name: string;
  strap: string;
}

export const GENRES: Genre[] = [
  { id: 'news', name: 'NEWS', strap: 'Filed this week. True until it is not.' },
  { id: 'shows', name: 'SHOWS', strap: 'Strands that keep coming back.' },
  { id: 'movies', name: 'MOVIES', strap: 'One long look at one big thing.' },
];

/** the STRAND — a named slot inside a genre, the way a channel used to be */
export type ChannelId = 'war' | 'home' | 'films' | 'circuit' | 'feature';

export interface Shot {
  /** the big line, held on screen */
  headline: string;
  /** the supporting line under it */
  sub?: string;
  /** the figure this shot is really about, if there is one */
  figure?: string;
  /** seconds this shot holds */
  hold: number;
  /** a lower-third label — the segment's own name */
  slug?: string;
}

export interface Reel {
  id: string;
  channel: ChannelId;
  /** which of the three shelves it sits on */
  genre: VideoGenre;
  title: string;
  dateline: string;
  shots: Shot[];
  /** SHOWS carry an episode number — that is what makes a strand a strand */
  episode?: number;
}

export interface Channel {
  id: ChannelId;
  genre: VideoGenre;
  name: string;
  strap: string;
}

export const CHANNELS: Channel[] = [
  { id: 'war', genre: 'news', name: 'WAR DESK', strap: 'What the fronts did today' },
  { id: 'home', genre: 'news', name: 'HOME SERVICE', strap: 'Your file, your board, your town' },
  { id: 'circuit', genre: 'shows', name: 'THE CIRCUIT', strap: 'The league, week by week' },
  { id: 'films', genre: 'shows', name: 'TRAINING FILMS', strap: 'How the machines want to be driven' },
  { id: 'feature', genre: 'movies', name: 'FEATURES', strap: 'The long cut of what you did' },
];

export const channelsIn = (g: VideoGenre): Channel[] => CHANNELS.filter((c) => c.genre === g);
export const reelsIn = (all: Reel[], g: VideoGenre): Reel[] => all.filter((r) => r.genre === g);

export const reelSeconds = (r: Reel): number => r.shots.reduce((n, s) => n + s.hold, 0);

/** Where the playhead sits: which shot, and how far into it. */
export function shotAt(reel: Reel, t: number): { index: number; into: number } {
  let acc = 0;
  for (let i = 0; i < reel.shots.length; i++) {
    const end = acc + reel.shots[i].hold;
    if (t < end) return { index: i, into: t - acc };
    acc = end;
  }
  return { index: Math.max(0, reel.shots.length - 1), into: 0 };
}

const ago = (at: number, now: number): string => {
  const mins = Math.max(0, Math.round((now - at) / 60000));
  if (mins < 60) return `${mins} MIN AGO`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} HR AGO` : `${Math.round(h / 24)} DAY${h >= 48 ? 'S' : ''} AGO`;
};

/** One race, cut as a sports segment — the circuit on the broadcast. */
function raceReel(issue: PressIssue, i: number, now: number): Reel {
  const r = issue.race!;
  const shots: Shot[] = [
    { headline: `${r.discipline} — ${r.cls} CLASS`, sub: `From the circuit at ${r.venue}.`, slug: 'SPORTS DESK', hold: 3.2 },
    { headline: `${r.winner.toUpperCase()} TAKES IT`, sub: `${r.field} on the grid, one flag.`, figure: r.lap > 0 ? `${r.lap.toFixed(1)}s` : undefined, slug: 'THE FEATURE', hold: 3.4 },
  ];
  // THE CIRCUIT ITSELF is a story now that a venue has a character: winning on
  // a knot of hairpins is not the same result as winning on a flat-out sweeper.
  if (r.circuit) {
    shots.push({
      headline: r.circuit.label,
      sub: r.circuit.strap,
      figure: `${r.circuit.length}u`,
      slug: 'THE CIRCUIT', hold: 3.4,
    });
  }
  // THE RESULT, not just the winner. The desk used to have one name and a
  // field size; the field is classified at the flag now, so it can read a sheet.
  if (r.podium?.length && r.podium.length > 1) {
    shots.push({
      headline: 'THE RESULT',
      sub: r.podium.map((p) => `P${p.place} ${p.name}${p.lapsDown ? ` +${p.lapsDown}L` : p.gap !== undefined ? ` +${p.gap.toFixed(1)}s` : ''}`).join('  ·  '),
      slug: 'CLASSIFIED', hold: 3.6,
    });
  }
  if (r.recordTaken) {
    shots.push({
      headline: 'A RECORD FALLS', figure: `${r.lap.toFixed(1)}s`,
      sub: r.previousHolder ? `Taken from ${r.previousHolder}. It stands until it doesn't.` : 'The first mark on the board.',
      slug: 'THE BOARD', hold: 3.4,
    });
  }
  return { id: `race_${issue.at}_${i}`, channel: 'war', genre: 'news', title: `${r.discipline}: ${r.winner}`, dateline: ago(issue.at, now), shots };
}

/** One battle, cut as a news segment. */
function battleReel(issue: PressIssue, i: number, now: number): Reel {
  const shots: Shot[] = [];
  const where = issue.frontName ? `THE BATTLE OF ${issue.frontName.toUpperCase()}` : `ACTION AT ${issue.modeName.toUpperCase()}`;
  shots.push({
    headline: where,
    sub: issue.won ? 'The line held.' : 'The line gave.',
    slug: 'WAR DESK',
    hold: 3.2,
  });
  shots.push({
    headline: issue.won ? 'OUR SIDE CARRIED IT' : 'THEY CARRIED IT',
    sub: `${issue.myKills} against ${issue.theirKills} on the field`,
    figure: `${issue.myKills}–${issue.theirKills}`,
    slug: 'THE FIELD',
    hold: 3.4,
  });
  if (issue.aceName && issue.aceKills > 0) {
    shots.push({
      headline: issue.aceName.toUpperCase(),
      sub: `Took ${issue.aceKills} and walked off the field`,
      figure: `${issue.aceKills}`,
      slug: 'THE DUEL',
      hold: 3.2,
    });
  }
  if (issue.longestShot > 0) {
    shots.push({
      headline: 'THE LONGEST SHOT OF THE DAY',
      sub: 'Filed by the range office, unchallenged',
      figure: `${Math.round(issue.longestShot)}m`,
      slug: 'THE RANGE',
      hold: 3,
    });
  }
  if (issue.underdog) {
    shots.push({
      headline: 'OUTSPENT AND STILL STANDING',
      sub: `They fielded ${issue.theirCost.toLocaleString()} against our ${issue.myCost.toLocaleString()}`,
      figure: `${Math.round((issue.theirCost / Math.max(1, issue.myCost)) * 10) / 10}×`,
      slug: 'THE MONEY',
      hold: 3.4,
    });
  }
  if (issue.medals.length) {
    shots.push({
      headline: 'DECORATIONS',
      sub: issue.medals.slice(0, 3).join(' · '),
      slug: 'THE BOARD',
      hold: 3.2,
    });
  }
  return {
    id: `war_${issue.at}_${i}`,
    channel: 'war', genre: 'news',
    title: where,
    dateline: ago(issue.at, now),
    shots,
  };
}

/**
 * Build the whole schedule. `now` is injected so the datelines are stable
 * under test.
 */
export function buildSchedule(id: PlayerIdentity | null, now = Date.now()): Reel[] {
  const reels: Reel[] = [];
  const press = loadPress();
  const side = id ? factionLabel(id.faction).toUpperCase() : 'THE FRONT';

  // ── WAR DESK: every battle the press filed, newest first ─────────────────
  press.slice(0, 6).forEach((issue, i) => reels.push(issue.race ? raceReel(issue, i, now) : battleReel(issue, i, now)));
  if (!press.length) {
    reels.push({
      id: 'war_quiet',
      channel: 'war', genre: 'news',
      title: 'NO ACTION FILED',
      dateline: 'STANDING BULLETIN',
      shots: [
        { headline: 'THE DESK IS QUIET', sub: 'No battle has been filed against your name yet.', slug: 'WAR DESK', hold: 3.4 },
        { headline: 'THE WAR IS NOT', sub: 'Eight years to the aliens. The clock does not wait for footage.', slug: 'WAR DESK', hold: 3.6 },
        { headline: 'DEPLOY AND WE WILL REPORT IT', sub: 'This desk runs on what you actually do.', slug: 'WAR DESK', hold: 3.2 },
      ],
    });
  }

  // ── HOME SERVICE: your own file, read back to you ─────────────────────────
  const recs = allRecords();
  const homeShots: Shot[] = [
    {
      headline: id ? `${id.callsign.toUpperCase()}, ${side}` : 'UNREGISTERED',
      sub: id?.hometown ? `Out of ${id.hometown}` : 'No homeland on file',
      slug: 'HOME SERVICE',
      hold: 3.2,
    },
  ];
  if (recs.length) {
    const best = recs.slice().sort((a, b) => a.lap - b.lap)[0];
    homeShots.push({
      headline: 'YOUR STANDING TIME',
      sub: `${best.trackId} · ${best.cls.toUpperCase()}`,
      figure: `${best.lap.toFixed(1)}s`,
      slug: 'THE BOARD',
      hold: 3.4,
    });
    homeShots.push({
      headline: `${recs.length} TIME${recs.length === 1 ? '' : 'S'} ON THE BOARD`,
      sub: 'Every run is kept. Beat it and we will say so.',
      slug: 'THE BOARD',
      hold: 3,
    });
  } else {
    homeShots.push({
      headline: 'THE BOARD IS EMPTY',
      sub: 'Every circuit is open and every record is somebody else\'s until it is not.',
      slug: 'THE BOARD',
      hold: 3.4,
    });
  }
  const lic = loadLicences();
  const all = Object.keys(COURSES) as LicenceId[];
  homeShots.push({
    headline: 'CERTIFICATIONS HELD',
    sub: all.filter((l) => !lic.held.includes(l)).length
      ? `Next open: ${LICENCES[all.find((l) => !lic.held.includes(l))!].name}`
      : 'The register is closed. There is nothing left to teach you.',
    figure: `${all.filter((l) => lic.held.includes(l)).length}/${all.length}`,
    slug: 'TRAINING COMMAND',
    hold: 3.4,
  });
  reels.push({ id: 'home_file', channel: 'home', genre: 'news', title: 'YOUR FILE', dateline: 'UPDATED CONTINUOUSLY', shots: homeShots });

  // ── TRAINING FILMS: one per school, and they actually teach ──────────────
  const schools = [...new Set(all.map((l) => LICENCES[l].school))];
  for (const school of schools) {
    const forSchool = all.filter((l) => LICENCES[l].school === school);
    const shots: Shot[] = [{
      headline: school.toUpperCase(),
      sub: `${forSchool.length} certification${forSchool.length === 1 ? '' : 's'} taught here`,
      slug: 'TRAINING FILM',
      hold: 3,
    }];
    for (const l of forSchool.slice(0, 4)) {
      const def = LICENCES[l];
      shots.push({
        headline: def.name.toUpperCase(),
        sub: def.covers,
        figure: lic.held.includes(l) ? 'HELD' : def.requires && !lic.held.includes(def.requires)
          ? `NEEDS ${LICENCES[def.requires].name.toUpperCase()}` : 'OPEN',
        slug: `TIER ${def.tier}`,
        hold: 3.2,
      });
    }
    reels.push({
      id: `film_${school.replace(/\s+/g, '_').toLowerCase()}`,
      channel: 'films', genre: 'shows',
      title: school.toUpperCase(),
      dateline: 'STANDING FILM',
      shots,
    });
  }

  // ── SHOWS · THE CIRCUIT: the league, week by week ─────────────────────────
  // A strand, not a bulletin: it returns on its own schedule whether or not you
  // raced, the way a sports programme does. Built off the standings the board
  // already keeps and the fixture list the league already computes.
  const day = Math.floor(now / 7_200_000);      // the one clock's game-day
  const tracks = [...new Set(recs.map((r) => r.trackId))];
  const table = standings(recs);
  const fx = fixtures(day, tracks);
  const circuitShots: Shot[] = [
    { headline: 'THE CIRCUIT', sub: leagueLine(day, tracks), slug: 'THIS WEEK', hold: 3.2 },
  ];
  if (table.length) {
    const top = table[0];
    circuitShots.push({
      headline: `${top.holder.toUpperCase()} LEADS THE BOARD`,
      sub: `${top.records} record${top.records === 1 ? '' : 's'} held · best at ${top.bestTrack}`,
      figure: Number.isFinite(top.best) ? `${top.best.toFixed(1)}s` : undefined,
      slug: 'STANDINGS', hold: 3.4,
    });
  } else {
    circuitShots.push({
      headline: 'NO ONE HOLDS ANYTHING YET',
      sub: 'Every discipline is open and every record is unclaimed.',
      slug: 'STANDINGS', hold: 3.4,
    });
  }
  for (const f of fx.slice(0, 3)) {
    const sp = sportById(f.sport);
    circuitShots.push({
      headline: (sp?.name ?? f.sport).toUpperCase(),
      sub: `${f.venue} · ${f.cls.toUpperCase()} class — ${sp?.strap ?? ''}`,
      figure: f.inDays === 0 ? 'TODAY' : `+${f.inDays}d`,
      slug: 'FIXTURES', hold: 3.2,
    });
  }
  reels.push({
    id: 'show_circuit', channel: 'circuit', genre: 'shows',
    title: 'THE CIRCUIT', dateline: `EPISODE ${day % 999}`, episode: day % 999,
    shots: circuitShots,
  });

  // ── MOVIES · FEATURES: the long cut of one big thing ──────────────────────
  // A movie is not a bulletin. It is singular, it is about ONE engagement, and
  // it only exists if you actually had one worth an hour of anybody's evening —
  // so the strand is cut from your *best* filed action rather than your latest,
  // and it says so honestly when there is nothing to show.
  const worthy = press
    .filter((iss) => !iss.race)
    .slice()
    .sort((a, b) => (b.myKills + b.longestShot / 10 + (b.underdog ? 20 : 0) + b.medals.length * 8)
      - (a.myKills + a.longestShot / 10 + (a.underdog ? 20 : 0) + a.medals.length * 8));

  if (worthy.length) {
    const f = worthy[0];
    const where = f.frontName ? f.frontName.toUpperCase() : f.modeName.toUpperCase();
    const featureShots: Shot[] = [
      { headline: where, sub: 'A FEATURE PRESENTATION', slug: 'GONET PICTURES', hold: 3.6 },
      {
        headline: f.won ? 'THEY SAID THE LINE WOULD GIVE' : 'THE LINE GAVE',
        sub: f.won ? 'It did not.' : 'What happened next is the film.',
        slug: 'ACT ONE', hold: 3.6,
      },
      {
        headline: 'THE FIELD',
        sub: `${f.myKills} against ${f.theirKills}`,
        figure: `${f.myKills}–${f.theirKills}`,
        slug: 'ACT TWO', hold: 3.4,
      },
    ];
    if (f.underdog) {
      featureShots.push({
        headline: 'THEY BROUGHT MORE OF EVERYTHING',
        sub: `${f.theirCost.toLocaleString()} of machine against ${f.myCost.toLocaleString()}`,
        figure: `${Math.round((f.theirCost / Math.max(1, f.myCost)) * 10) / 10}×`,
        slug: 'ACT TWO', hold: 3.6,
      });
    }
    if (f.longestShot > 0) {
      featureShots.push({
        headline: 'ONE SHOT, HELD',
        sub: 'The range office filed it and nobody has challenged it since.',
        figure: `${Math.round(f.longestShot)}m`,
        slug: 'ACT THREE', hold: 3.4,
      });
    }
    if (f.aceName && f.aceKills > 0) {
      featureShots.push({
        headline: f.aceName.toUpperCase(),
        sub: `${f.aceKills} of them, and walked off the field`,
        figure: `${f.aceKills}`,
        slug: 'ACT THREE', hold: 3.4,
      });
    }
    featureShots.push({
      headline: f.medals.length ? f.medals[0].toUpperCase() : 'AND THEN IT WAS QUIET',
      sub: f.medals.length ? 'Awarded in the field, entered on the file.' : 'The war went somewhere else, the way it does.',
      slug: 'END TITLES', hold: 3.8,
    });
    reels.push({
      id: `movie_${f.at}`, channel: 'feature', genre: 'movies',
      title: where, dateline: 'FEATURE PRESENTATION', shots: featureShots,
    });
  } else {
    reels.push({
      id: 'movie_none', channel: 'feature', genre: 'movies',
      title: 'NOTHING SHOOTING', dateline: 'THE LOT IS DARK',
      shots: [
        { headline: 'NOTHING SHOOTING', sub: 'A feature needs an engagement worth an evening of somebody\'s time.', slug: 'GONET PICTURES', hold: 3.6 },
        { headline: 'GO AND DO SOMETHING', sub: 'This desk only cuts film out of what actually happened to you.', slug: 'GONET PICTURES', hold: 3.6 },
      ],
    });
  }

  return reels;
}

export const reelsOn = (all: Reel[], ch: ChannelId): Reel[] => all.filter((r) => r.channel === ch);
