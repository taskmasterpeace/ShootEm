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

export type ChannelId = 'war' | 'home' | 'films';

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
  title: string;
  dateline: string;
  shots: Shot[];
}

export interface Channel {
  id: ChannelId;
  name: string;
  strap: string;
}

export const CHANNELS: Channel[] = [
  { id: 'war', name: 'WAR DESK', strap: 'What the fronts did today' },
  { id: 'home', name: 'HOME SERVICE', strap: 'Your file, your board, your town' },
  { id: 'films', name: 'TRAINING FILMS', strap: 'How the machines want to be driven' },
];

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
    channel: 'war',
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
  press.slice(0, 6).forEach((issue, i) => reels.push(battleReel(issue, i, now)));
  if (!press.length) {
    reels.push({
      id: 'war_quiet',
      channel: 'war',
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
  reels.push({ id: 'home_file', channel: 'home', title: 'YOUR FILE', dateline: 'UPDATED CONTINUOUSLY', shots: homeShots });

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
      channel: 'films',
      title: school.toUpperCase(),
      dateline: 'STANDING FILM',
      shots,
    });
  }

  return reels;
}

export const reelsOn = (all: Reel[], ch: ChannelId): Reel[] => all.filter((r) => r.channel === ch);
