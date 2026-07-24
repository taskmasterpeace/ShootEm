// ---------------------------------------------------------------------------
// THE GONET — the laptop that replaced the main menu.
//
// THREE-GAMES-ONE-WAR §"The GONET laptop (menus become the world)":
//   *"Boot into the operations network, not a menu: world status, briefings,
//   messages, friends, certifications, print hangar, war map, marketplace,
//   news, promotion board. The laptop is home; 'logging in' replaces 'main
//   menu'."*
//
// So this is not a menu with a wallpaper. It is a machine you log into. The
// status board is the transcript's mock, filled with real figures. The apps
// are real apps. And the music player sits in the corner, always mounted,
// because the deck it drives is the same deck your headphones play on the
// field — that continuity is the whole point of putting it here.
// ---------------------------------------------------------------------------
import { gameNow } from '../worldclock';
import { factionLabel, loadIdentity, nationOf, type PlayerIdentity } from '../identity';
import { renderServiceFile } from '../service-file';
import { loadLicences } from '../licences';
import { COURSES } from '../../sim/courses';
import { treasuryFor } from '../treasury';
import { loadPress } from '../newspaper';
import { LICENCES, type LicenceId } from '../../sim/licenses';
import { CHARACTER_LABEL, circuitName, circuitProfile } from '../../sim/tracks';
import { circuitRing } from '../../sim/map';
import { buildInbox, markAllRead, markRead, unreadCount, type Message } from './mail';
import {
  GENRES, buildSchedule, channelsIn, reelSeconds, reelsOn, shotAt,
  type ChannelId, type Reel, type VideoGenre,
} from './broadcast';
import {
  addToPlaylist, clockOf, createPlaylist, deletePlaylist, FIELD_ID, movePlaylistTrack,
  playlistOf, removeFromPlaylist, saveLibrary, setFieldPlaylist, toggleFavourite,
  TRACKS, tracksOf,
} from './library';
import { musicDeck } from './player';
import {
  allBriefs, briefById, briefsOfKind, missionCounts, readiness, uncleared, vehicleName,
  type Brief, type BriefKind,
} from './briefings';
import { board } from '../service';
import { SPORTS, fixtures, leagueLine, sportById, standings, type SportId } from './sports';
import {
  CARTRIDGES, DECK_MORALE, cartridgeById, deckLine, fileScore, loadDeck, ownedCartridges,
  owns, saveDeck,
} from './cartridges';
import { isPlayable } from './cartridge-games';
import { playInScreen, type DeckSession } from './deck-player';
import { allRecords } from '../records';
import { SKILLS } from '../../sim/skills';
import { loadFits } from '../garage-ui';
import { phaseName } from '../worldclock';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export type GonetApp = 'desk' | 'briefings' | 'sports' | 'mail' | 'video' | 'music' | 'deck' | 'file';

export interface GonetHost {
  /** DEPLOY — leave the laptop for the war. */
  deploy(door: 'skirmish' | 'paintball'): void;
  /** Straight into a briefed mission, skipping the deploy screen entirely. */
  launchBrief(kind: BriefKind, id: string): void;
  /** SPORTS: enter a discipline — the league is a way into the same modes. */
  enterSport(mode: import('../../sim/types').ModeId, raceKind?: import('../../sim/types').ModeState['raceKind']): void;
  /** THE DECK: switch on a cartridge. */
  playCartridge(id: string): void;
  /** OPTIONS lives in its own panel already. */
  options(): void;
  /** Re-enlist under a different flag. */
  reenlist(): void;
}

let host: GonetHost;
let root: HTMLElement;
let app: GonetApp = 'desk';
let inbox: Message[] = [];
let unsubDeck: (() => void) | null = null;
/** a cartridge currently running in the console screen (THE DECK) */
let deckSession: DeckSession | null = null;

// video transport state
// VIDEO: the genre is the shelf, the channel is the strand on it. Selecting a
// genre picks its first strand, so the app is never showing an empty room.
let vGenre: VideoGenre = 'news';
let vChannel: ChannelId = 'war';
let vReels: Reel[] = [];
let vIndex = 0;
let vTime = 0;
let vPlaying = false;
let vTimer: number | null = null;

/** Mount the network into the onboarding overlay. */
export function renderGonet(rootEl: HTMLElement, h: GonetHost): void {
  host = h;
  root = rootEl;
  root.classList.remove('hidden');
  inbox = buildInbox(loadIdentity(), gameNow().h);
  vReels = buildSchedule(loadIdentity());
  paint();
}

export function gonetOpen(a: GonetApp): void { app = a; paint(); }

/**
 * A LAPTOP TAKES KEYS. 1–6 walk the apps, ESC comes home to the desk. Bound
 * once at module scope (renderGonet runs on every repaint of the front door,
 * so binding there would stack listeners), and it stands down the moment the
 * network is not on screen.
 */
const APP_KEYS: GonetApp[] = ['desk', 'briefings', 'sports', 'mail', 'video', 'music', 'deck', 'file'];
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!root || root.classList.contains('hidden') || !root.querySelector('.gn')) return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') { if (app !== 'desk') { app = 'desk'; paint(); e.preventDefault(); } return; }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= APP_KEYS.length) {
      app = APP_KEYS[n - 1];
      if (app === 'video') startVideoClock();
      paint();
      e.preventDefault();
    }
  });
}

function paint(): void {
  // a cartridge running in the console screen owns a canvas, a RAF loop and key
  // listeners — repainting would orphan all three. Switching app, ESC and every
  // other repaint route through here, so this is the one place it must die.
  deckSession?.stop();
  deckSession = null;
  const id = loadIdentity();
  root.innerHTML = `<div class="gn">${chrome(id)}<div class="gn-body">${bodyFor(id)}</div>${corner()}</div>`;
  wire();
}

// ── THE CHROME: who is logged in, and the time everywhere at once ──────────
function chrome(id: PlayerIdentity | null): string {
  const c = gameNow();
  const hour = c.h;
  const greet = hour < 5 ? 'STILL UP' : hour < 12 ? 'GOOD MORNING' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const nation = id ? nationOf(id) : undefined;
  const unread = unreadCount(inbox);
  const counts = missionCounts();
  const briefCount = counts.military + counts.science;
  const tabs: Array<[GonetApp, string, string]> = [
    ['desk', 'DESK', ''],
    ['briefings', 'BRIEFINGS', String(briefCount)],
    ['sports', 'SPORTS', ''],
    ['mail', 'MAIL', unread ? String(unread) : ''],
    ['video', 'BROADCAST', ''],
    ['music', 'MUSIC', ''],
    ['deck', 'THE DECK', ''],
    ['file', 'YOUR FILE', ''],
  ];
  return `
    <header class="gn-top">
      <div class="gn-brand"><b>GONET</b><span>OPERATIONS NETWORK</span></div>
      <div class="gn-who">
        ${greet}${id ? `, <b>${esc(id.callsign.toUpperCase())}</b>` : ''}
        ${nation ? `<span class="gn-flag">${nation.flag}</span>` : ''}
        ${id ? `<span class="gn-side gn-${id.faction}">${esc(factionLabel(id.faction).toUpperCase())}</span>` : ''}
      </div>
      <div class="gn-clock">D${c.day} · ${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}${c.night ? ' · NIGHT' : ''}</div>
    </header>
    <nav class="gn-tabs">
      ${tabs.map(([a, label, badge]) =>
        `<button class="gn-tab${app === a ? ' on' : ''}" data-app="${a}">${label}${badge ? `<i>${badge}</i>` : ''}</button>`).join('')}
      <span class="gn-spacer"></span>
      <button class="gn-tab gn-quiet" data-act="options">OPTIONS</button>
    </nav>`;
}

function bodyFor(id: PlayerIdentity | null): string {
  if (app === 'briefings') return briefingsApp();
  if (app === 'sports') return sportsApp();
  if (app === 'deck') return deckApp();
  if (app === 'mail') return mailApp();
  if (app === 'video') return videoApp();
  if (app === 'music') return musicApp();
  if (app === 'file') return `<div class="gn-pane gn-file"><div id="gn-service-file"></div></div>`;
  return desk(id);
}

// ── THE DESK: the transcript's status board, filled with real figures ──────
function desk(id: PlayerIdentity | null): string {
  const lic = loadLicences();
  const allLic = Object.keys(COURSES) as LicenceId[];
  const held = allLic.filter((l) => lic.held.includes(l)).length;
  const press = loadPress();
  const chest = id ? treasuryFor(id.faction) : null;
  const unread = unreadCount(inbox);
  const last = press[0];
  // the front's standing, read off the last thing the press filed
  const frontState = !last ? 'NO CONTACT' : last.won ? 'HOLDING' : 'LOSING';
  const newsLine = last
    ? (last.frontName ? `Battle of ${last.frontName} continues` : `Action at ${last.modeName}`)
    : 'The desk is quiet';

  // EVERY ROW ON THIS BOARD IS DERIVED NOW. The transcript's mock carried four
  // invented lines — "Science 3 Missions", "Military 18 Missions", a factory
  // with a tank ready, a research prototype complete — and a desk that reports
  // the war has no business making numbers up. The mission counts are the real
  // rosters (7 and 5, not 18 and 3); the factory is your garage; research is
  // training command; and the promotion board finally has a rank behind it.
  const counts = missionCounts();
  const b = board();
  const fits = Object.keys(loadFits()).length;
  const nextPaper = allLic.find((l) => !lic.held.includes(l));
  const c = gameNow();

  const rows: Array<[string, string, string]> = [
    ['Front', frontState, frontState === 'LOSING' ? 'bad' : frontState === 'HOLDING' ? 'ok' : ''],
    ['The light', phaseName(c), c.night ? '' : 'ok'],
    ['Military', `${counts.military} operations briefed`, ''],
    ['Science', `${counts.science} missions briefed`, ''],
    ['Personal Mail', unread ? `${unread} UNREAD` : 'Nothing new', unread ? 'hot' : ''],
    ['Rank', b.rank.name, b.next ? '' : 'ok'],
    ['Promotion Board', b.next ? `${Math.ceil(b.next.need)} service to ${b.next.rank.name}` : 'At the top', b.next ? 'hot' : 'ok'],
    ['Certifications', `${held} / ${allLic.length} held`, held === allLic.length ? 'ok' : ''],
    ['Training', nextPaper ? `${LICENCES[nextPaper].name} is open` : 'Register closed', nextPaper ? '' : 'ok'],
    ['The Garage', fits ? `${fits} machine${fits === 1 ? '' : 's'} built` : 'Nothing on the bench', fits ? 'ok' : ''],
    ['War Chest', chest ? chest.balance.toLocaleString() : '—', ''],
    ['Your Record', chest ? `${chest.wins}W · ${chest.losses}L` : '—', ''],
    ['News', newsLine, ''],
  ];

  return `
    <div class="gn-pane gn-desk">
      <section class="gn-status">
        <h3>WORLD STATUS</h3>
        ${rows.map(([k, v, cls]) => `<div class="gn-srow ${cls}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
      </section>
      <section class="gn-apps">
        <h3>THE NETWORK</h3>
        <div class="gn-grid">
          ${appTile('deploy-skirmish', '⚔', 'DEPLOY', 'Skirmish — war, missions, the outbreak.', true)}
          ${appTile('deploy-paintball', '❖', 'THE YARD', 'Paintball: hunters vs hunted, the pro shop.', false)}
          ${appTile('briefings', '▣', 'BRIEFINGS', `${counts.military + counts.science} operations and missions — the ground, the plan, the manifest.`, false)}
          ${appTile('mail', '✉', 'MAIL', unread ? `${unread} unread` : 'Nothing new', false)}
          ${appTile('video', '▶', 'BROADCAST', 'War desk, home service, training films.', false)}
          ${appTile('music', '♫', 'MUSIC', 'Your library — and what the field plays.', false)}
          ${appTile('file', '▤', 'YOUR FILE', 'Papers, the board, the chest, the garage.', false)}
          ${appTile('mp', '⛨', 'MULTIPLAYER', 'Two real armies over one world.', false, true)}
        </div>
      </section>
    </div>`;
}

function appTile(id: string, glyph: string, label: string, sub: string, primary: boolean, soon = false): string {
  return `<button class="gn-tile${primary ? ' primary' : ''}${soon ? ' soon' : ''}" data-tile="${id}"${soon ? ' disabled' : ''}>
    <span class="gn-tile-glyph">${glyph}</span>
    <b>${esc(label)}</b><span>${esc(sub)}</span>
    ${soon ? '<i class="gn-soon">COMING SOON</i>' : ''}
  </button>`;
}

// ── SPORTS ────────────────────────────────────────────────────────────────
// Robert: *"we wanna have an actual driving game as a sport within the game…
// this game is gonna have different sports that you get updated on, that you
// can participate in."* So the circuit stops being a game mode and becomes an
// institution: disciplines with rules, a fixture list the whole world agrees
// on, standings read off the record board, and a way in.
let sportOpen: SportId = 'circuit';

function sportsApp(): string {
  const day = gameNow().day;
  const recs = allRecords();
  const trackNames = [...new Set(recs.map((r) => r.trackId))];
  const fixList = fixtures(day, trackNames);
  const table = standings(recs);
  const s = sportById(sportOpen) ?? SPORTS[0];

  const disciplines = SPORTS.map((x) => `
    <button class="gn-sport${x.id === s.id ? ' on' : ''}${x.live ? '' : ' soon'}" data-sport="${x.id}">
      <b>${esc(x.name)}</b><span>${esc(x.strap)}</span>
      ${x.live ? '' : '<i>PLANNED</i>'}
    </button>`).join('');

  // THE CIRCUIT ON THIS WEEK, described off its own geometry. The desk builds
  // no world to do it — `circuitRing` is the same pure centreline the map
  // builder carves from, so the description and the tarmac can never disagree.
  const venue = circuitProfile(circuitRing(day).gates.map((g: { x: number; z: number }) => ({ pos: g })));
  const venueName = circuitName(day, venue.character);

  const fixtureRows = fixList.map((f) => {
    const sp = sportById(f.sport)!;
    return `<div class="gn-fix">
      <span class="gn-fwhen">${f.inDays === 0 ? 'TODAY' : `D+${f.inDays}`}</span>
      <span class="gn-fname">${esc(sp.name)}</span>
      <span class="gn-fven">${esc(f.venue)}</span>
      <span class="gn-fcls">${esc(f.cls.toUpperCase())}</span>
    </div>`;
  }).join('');

  const standingRows = table.length
    ? table.slice(0, 8).map((x, i) => `<div class="gn-stand">
        <span class="gn-spos">${String(i + 1).padStart(2, '0')}</span>
        <span class="gn-sname">${esc(x.holder)}</span>
        <span class="gn-srec">${x.records} board${x.records === 1 ? '' : 's'}</span>
        <span class="gn-sbest">${x.best.toFixed(1)}s</span>
      </div>`).join('')
    : '<div class="gn-empty">No times filed. Every board is open.</div>';

  return `
    <div class="gn-pane gn-sports">
      <section class="gn-slist">
        <h3>DISCIPLINES</h3>
        ${disciplines}
        <h3 class="gn-sched">THIS WEEK</h3>
        ${fixtureRows}
      </section>
      <section class="gn-sread">
        <div class="gn-bhead">
          <b>${esc(s.name)}</b>
          <span>${s.classes.map((c) => c.toUpperCase()).join(' · ')} CLASS
            ${s.live ? '' : ' · NOT YET RUNNING'}</span>
        </div>
        <p class="gn-btag">${esc(s.strap)}</p>
        <h4>THE RULES</h4>
        <ol class="gn-bphases">${s.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
        <h4>WHAT IT TRAINS <i>a sport is not idle time</i></h4>
        <div class="gn-btags">${s.trains.map((t) => `<span>${esc(SKILLS[t].name.toUpperCase())}</span>`).join('')}</div>
        <h4>THIS WEEK'S CIRCUIT <i>measured off the tarmac, never assigned</i></h4>
        <div class="gn-venue">
          <b>${esc(venueName.name)}</b>
          <span>${esc(CHARACTER_LABEL[venue.character])} · ${venue.length}u · ${venue.gates} gates · longest run ${venue.longestStraight}u</span>
          <p>${esc(venue.strap)}</p>
        </div>
        <h4>THE STANDINGS</h4>
        <div class="gn-stands">${standingRows}</div>
        ${s.live
          ? `<button class="gn-cta" data-sportgo="${s.id}">ENTER — ${esc(s.name)} &#9656;</button>`
          : '<div class="gn-bready warn">This discipline is not running yet. The parts exist; the league does not.</div>'}
        <button class="gn-mini gn-builder" data-act="builder">THE TRACK BUILDER &#9656;</button>
        <div class="gn-bready">Lay your own circuit in the creator's room, save it to the shelf,
          then pick it as the CIRCUIT on the race deploy screen and drive it.</div>
      </section>
    </div>`;
}

// ── THE DECK ──────────────────────────────────────────────────────────────
// Robert: *"games that don't increase your skill… imagine little Atari-type
// systems, a mock video game system, with different cartridges."*
//
// THE LAW: a sport makes you better at the war; a cartridge does not. This is
// the only thing in the game with no instrumental value, which is exactly what
// makes it rest — and why it pays MORALE and nothing else.
function deckApp(): string {
  const d = loadDeck();
  const mine = ownedCartridges(d);
  const slot = d.inSlot ? cartridgeById(d.inSlot) : mine[0];

  const shelf = CARTRIDGES.map((c) => {
    const held = !!d.owned[c.id];
    const best = d.best[c.id];
    return `<button class="gn-cart${slot?.id === c.id ? ' on' : ''}${held ? '' : ' locked'}"
        data-cart="${c.id}" ${held ? '' : 'disabled'}
        style="--ink:${c.label.ink};--base:${c.label.base}">
      <span class="gn-cspine"></span>
      <b>${esc(c.title)}</b>
      <span class="gn-cmaker">${esc(c.maker)} · ${c.year}</span>
      ${held
        ? `<span class="gn-cbest">${best ? `${Math.round(best)} ${esc(c.scoreUnit)}` : (isPlayable(c.id) ? 'NEVER PLAYED' : 'NO RUNTIME YET')}</span>`
        : '<span class="gn-cbest locked">FOUND IN WRECKS</span>'}
      <span class="gn-crare">${esc(c.rarity.toUpperCase())}</span>
    </button>`;
  }).join('');

  return `
    <div class="gn-pane gn-deck">
      <section class="gn-shelf-col">
        <h3>THE FOOTLOCKER <i>${mine.length} of ${CARTRIDGES.length} cartridges</i></h3>
        <div class="gn-carts">${shelf}</div>
        <div class="gn-fieldnote">
          <b>ISSUED, NOT EARNED</b>
          <span>The ministry issues a Deck because a body that never stops being a
          soldier stops being a good one. Cartridges are found in wrecks, traded
          for doubles, and occasionally awarded by someone who does not think of
          it as a decoration.</span>
        </div>
      </section>
      <section class="gn-deckface">
        <div class="gn-console" style="--ink:${slot?.label.ink ?? '#e8a33d'};--base:${slot?.label.base ?? '#12100c'}">
          <div class="gn-screen2">
            ${slot ? `
              <div class="gn-ctitle">${esc(slot.title)}</div>
              <div class="gn-cblurb">${esc(slot.blurb)}</div>
              <div class="gn-cscore">${d.best[slot.id]
                ? `BEST ${Math.round(d.best[slot.id])} ${esc(slot.scoreUnit)}`
                : `NO SCORE · ${esc(slot.scoreUnit)}`}</div>
            ` : '<div class="gn-cblurb">NO CARTRIDGE IN THE SLOT</div>'}
          </div>
          <div class="gn-dbrand">DECK · MINISTRY ISSUE</div>
        </div>
        <div class="gn-deckmeta">
          <div class="gn-kv2"><span>SESSIONS</span><b>${d.sessions}</b></div>
          <div class="gn-kv2"><span>PAYS</span><b>+${DECK_MORALE} MORALE</b></div>
          <div class="gn-kv2"><span>TEACHES</span><b>NOTHING</b></div>
        </div>
        <p class="gn-decknote">${esc(deckLine(d))}</p>
        ${slot ? `<button class="gn-cta" data-play2="${slot.id}">SWITCH IT ON &#9656;</button>` : ''}
      </section>
    </div>`;
}

// ── BRIEFINGS ─────────────────────────────────────────────────────────────
// The missions were always real; they were reachable only through a modal on
// the deploy screen, and nothing ever told you what you were walking into.
// A brief names the ground, the objective chain and the machines you are
// issued — and then CHECKS YOUR PAPERS against those machines, which is the
// thing that turns a poster into preparation.
let briefOpen: string | null = null;
let briefKind: BriefKind = 'military';

function briefingsApp(): string {
  const all = allBriefs(loadLicences().held);
  const list = briefsOfKind(all, briefKind);
  const cur = (briefOpen ? briefById(all, briefOpen) : undefined) ?? list[0];
  const rd = cur ? readiness(cur) : null;

  const rows = list.map((b) => {
    const bad = uncleared(b).length;
    return `<button class="gn-brief${b.id === cur?.id ? ' on' : ''}" data-brief="${b.id}">
      <span class="gn-bicon">${esc(b.icon)}</span>
      <span class="gn-bmeta"><b>${esc(b.title)}</b><span>${esc(b.theatre)}</span></span>
      ${bad ? `<span class="gn-bwarn">&#9888; ${bad}</span>` : ''}
    </button>`;
  }).join('');

  const hulls = cur && cur.hulls.length
    ? `<h4>ISSUED TO YOU</h4><div class="gn-bhulls">${cur.hulls.map((h) =>
      `<div class="gn-bhull${h.cleared ? '' : ' barred'}">
        <b>${esc(h.name)}</b>
        <span>${esc(vehicleName(h.kind))}</span>
        <i>${h.cleared ? 'CLEARED' : `${esc(h.licenceName.toUpperCase())} — ${esc(h.school)}`}</i>
      </div>`).join('')}</div>`
    : '';

  const body = cur
    ? `<div class="gn-bhead">
        <b>${esc(cur.title)}</b>
        <span>${esc(cur.theatre)}${cur.role ? ` · ${esc(cur.role)}` : ''}</span>
      </div>
      <p class="gn-btag">${esc(cur.tagline)}</p>
      <div class="gn-btags">${cur.tags.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <h4>THE PLAN</h4>
      <ol class="gn-bphases">${cur.phases.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      ${hulls}
      <div class="gn-bready ${rd?.ok ? 'ok' : 'warn'}">${esc(rd?.line ?? '')}</div>
      <button class="gn-cta" data-launch="${cur.kind}:${cur.id}">DEPLOY ON THIS BRIEF &#9656;</button>`
    : '<div class="gn-empty">Nothing briefed.</div>';

  return `
    <div class="gn-pane gn-briefs">
      <section class="gn-blist">
        <h3>THE BOARD
          <span class="gn-listacts">
            <button class="gn-mini${briefKind === 'military' ? ' on' : ''}" data-bkind="military">MILITARY</button>
            <button class="gn-mini${briefKind === 'science' ? ' on' : ''}" data-bkind="science">SCIENCE</button>
          </span>
        </h3>
        ${rows}
      </section>
      <section class="gn-bread">${body}</section>
    </div>`;
}

// ── MAIL ───────────────────────────────────────────────────────────────────
let openMsg: string | null = null;

function mailApp(): string {
  const cur = inbox.find((m) => m.id === openMsg) ?? inbox[0];
  const list = inbox.map((m) => {
    const read = m.id !== cur?.id && isReadCached(m.id);
    return `<button class="gn-mrow${m.id === cur?.id ? ' on' : ''}${read ? ' read' : ''}" data-msg="${m.id}">
      <span class="gn-mtag k-${m.kind}">${m.kind.toUpperCase()}</span>
      <span class="gn-mfrom">${esc(m.from)}</span>
      <span class="gn-msub">${esc(m.subject)}</span>
      <span class="gn-mwhen">${esc(m.when)}</span>
    </button>`;
  }).join('');
  return `
    <div class="gn-pane gn-mail">
      <section class="gn-mlist">
        <h3>INBOX <i>${inbox.length}</i><button class="gn-mini" data-act="readall">MARK ALL READ</button></h3>
        ${list}
      </section>
      <section class="gn-mread">
        ${cur ? `
          <div class="gn-mhead">
            <b>${esc(cur.subject)}</b>
            <span>${esc(cur.from)} · ${esc(cur.when)}</span>
          </div>
          <div class="gn-mbody">${esc(cur.body).replace(/\n/g, '<br>')}</div>
          ${cur.cta ? `<button class="gn-cta" data-cta="${cur.cta.app}">${esc(cur.cta.label)} ▸</button>` : ''}
        ` : '<div class="gn-empty">No mail.</div>'}
      </section>
    </div>`;
}

let readCache: Set<string> | null = null;
function isReadCached(id: string): boolean {
  if (!readCache) readCache = new Set(inbox.filter((m) => isReadNow(m.id)).map((m) => m.id));
  return readCache.has(id);
}
function isReadNow(id: string): boolean {
  try { return (JSON.parse(localStorage.getItem('ww.mail.v1') || '{"read":[]}').read as string[]).includes(id); }
  catch { return false; }
}

// ── BROADCAST ──────────────────────────────────────────────────────────────
function videoApp(): string {
  const list = reelsOn(vReels, vChannel);
  const reel = list[vIndex] ?? list[0];
  const total = reel ? reelSeconds(reel) : 0;
  const at = reel ? shotAt(reel, vTime) : { index: 0, into: 0 };
  const shot = reel?.shots[at.index];
  const pct = total > 0 ? (vTime / total) * 100 : 0;

  return `
    <div class="gn-pane gn-video">
      <section class="gn-chans">
        <div class="gn-genres">
          ${GENRES.map((g) => `<button class="gn-genre${g.id === vGenre ? ' on' : ''}" data-genre="${g.id}">${esc(g.name)}</button>`).join('')}
        </div>
        <p class="gn-genre-strap">${esc(GENRES.find((g) => g.id === vGenre)?.strap ?? '')}</p>
        ${channelsIn(vGenre).map((c) => `<button class="gn-chan${c.id === vChannel ? ' on' : ''}" data-chan="${c.id}">
          <b>${esc(c.name)}</b><span>${esc(c.strap)}</span>
        </button>`).join('')}
        <h3 class="gn-sched">SCHEDULE</h3>
        ${list.map((r, i) => `<button class="gn-reel${i === vIndex ? ' on' : ''}" data-reel="${i}">
          <span>${esc(r.title)}</span><i>${esc(r.dateline)}</i>
        </button>`).join('') || '<div class="gn-empty">Nothing scheduled on this strand.</div>'}
      </section>
      <section class="gn-screen-wrap">
        <div class="gn-screen${vPlaying ? ' live' : ''}">
          ${shot ? `
            <div class="gn-slug">${esc(shot.slug ?? '')}</div>
            ${vPlaying ? '<div class="gn-live">● LIVE</div>' : '<div class="gn-paused">PAUSED</div>'}
            ${shot.figure ? `<div class="gn-figure">${esc(shot.figure)}</div>` : ''}
            <div class="gn-headline">${esc(shot.headline)}</div>
            ${shot.sub ? `<div class="gn-sub">${esc(shot.sub)}</div>` : ''}
            <div class="gn-ticker"><span>${esc(reel.title)} · ${esc(reel.dateline)} · GONET BROADCAST · ${esc(reel.title)} · ${esc(reel.dateline)} · GONET BROADCAST</span></div>
          ` : '<div class="gn-empty">No signal.</div>'}
        </div>
        <div class="gn-transport">
          <button class="gn-tbtn" data-v="prev" title="Previous segment">⏮</button>
          <button class="gn-tbtn gn-tplay" data-v="play">${vPlaying ? '❚❚' : '▶'}</button>
          <button class="gn-tbtn" data-v="next" title="Next segment">⏭</button>
          <div class="gn-tbar" data-v="seek"><i style="width:${pct.toFixed(1)}%"></i></div>
          <span class="gn-ttime">${clockOf(vTime)} / ${clockOf(total)}</span>
        </div>
      </section>
    </div>`;
}

function videoTick(): void {
  if (!vPlaying) return;
  const list = reelsOn(vReels, vChannel);
  const reel = list[vIndex];
  if (!reel) { vPlaying = false; return; }
  vTime += 0.25;
  if (vTime >= reelSeconds(reel)) {
    // autoplay to the next segment on the channel — a channel keeps running
    vTime = 0;
    vIndex = (vIndex + 1) % list.length;
  }
  if (app === 'video') paint();
}

function startVideoClock(): void {
  if (vTimer !== null) return;
  vTimer = window.setInterval(videoTick, 250);
}

// ── MUSIC ──────────────────────────────────────────────────────────────────
let musicList = 'all';

function musicApp(): string {
  const deck = musicDeck();
  const lib = deck.lib;
  const cur = deck.now();
  const list = playlistOf(lib, musicList) ?? lib.playlists[0];
  const tracks = tracksOf(lib, list.id);
  const isField = lib.fieldPlaylistId === list.id;

  return `
    <div class="gn-pane gn-music">
      <section class="gn-lists">
        <h3>LIBRARY</h3>
        ${lib.playlists.map((p) => `<button class="gn-plist${p.id === musicList ? ' on' : ''}" data-plist="${p.id}">
          <b>${esc(p.name)}</b><i>${p.trackIds.length}</i>
          ${lib.fieldPlaylistId === p.id ? '<span class="gn-fieldtag">FIELD</span>' : ''}
        </button>`).join('')}
        <button class="gn-mini gn-newlist" data-act="newlist">+ NEW LIST</button>
        <div class="gn-fieldnote">
          <b>THE FIELD</b>
          <span>The list marked FIELD is what your headphones play on the battlefield. Press <kbd>H</kbd> in a match.</span>
        </div>
      </section>
      <section class="gn-tracks">
        <h3>
          ${esc(list.name)} <i>${tracks.length} track${tracks.length === 1 ? '' : 's'}</i>
          <span class="gn-listacts">
            ${isField ? '<span class="gn-fieldtag on">PLAYS ON THE FIELD</span>'
              : `<button class="gn-mini" data-act="setfield" data-id="${list.id}">SEND TO THE FIELD</button>`}
            ${list.fixed ? '' : `<button class="gn-mini" data-act="rename" data-id="${list.id}">RENAME</button>
              <button class="gn-mini danger" data-act="dellist" data-id="${list.id}">DELETE</button>`}
          </span>
        </h3>
        <div class="gn-trows">
          ${tracks.length ? tracks.map((t, i) => {
            const on = cur.track?.id === t.id;
            const fav = lib.favourites.includes(t.id);
            return `<div class="gn-trow${on ? ' on' : ''}">
              <button class="gn-tplaybtn" data-play="${t.id}">${on && cur.playing ? '❚❚' : '▶'}</button>
              <span class="gn-tno">${String(i + 1).padStart(2, '0')}</span>
              <span class="gn-ttitle"><b>${esc(t.title)}</b><span>${esc(t.artist)} · ${esc(t.album)}</span></span>
              <span class="gn-tdur">${clockOf(lib.durations[t.id] ?? t.seconds)}</span>
              <button class="gn-tico${fav ? ' fav' : ''}" data-fav="${t.id}" title="Favourite">★</button>
              ${list.fixed ? '' : `<button class="gn-tico" data-up="${t.id}" title="Move up">▲</button>
                <button class="gn-tico" data-down="${t.id}" title="Move down">▼</button>
                <button class="gn-tico" data-rm="${t.id}" title="Remove from list">✕</button>`}
            </div>`;
          }).join('') : '<div class="gn-empty">This list is empty. Add something from the shelf below.</div>'}
        </div>
        ${list.fixed ? '' : `
          <h3 class="gn-shelfhead">THE SHELF <i>add to ${esc(list.name)}</i></h3>
          <div class="gn-shelf">
            ${TRACKS.filter((t) => !list.trackIds.includes(t.id)).map((t) =>
              `<button class="gn-mini" data-add="${t.id}">+ ${esc(t.title)}</button>`).join('')
              || '<span class="gn-empty">Everything on the shelf is already in this list.</span>'}
          </div>`}
      </section>
    </div>`;
}

// ── THE CORNER PLAYER (always mounted) ─────────────────────────────────────
function corner(): string {
  const deck = musicDeck();
  const n = deck.now();
  const pct = (n.progress * 100).toFixed(1);
  return `
    <aside class="gn-corner${n.playing ? ' playing' : ''}">
      <div class="gn-cnow">
        <span class="gn-ceq">${n.playing ? '<i></i><i></i><i></i>' : ''}</span>
        <span class="gn-cmeta">
          <b>${n.track ? esc(n.track.title) : 'NOTHING QUEUED'}</b>
          <span>${n.track ? esc(n.track.artist) : 'Open MUSIC to pick something'}</span>
        </span>
      </div>
      <div class="gn-cbar" data-c="seek"><i style="width:${pct}%"></i></div>
      <div class="gn-cbtns">
        <button data-c="prev" title="Previous">⏮</button>
        <button data-c="play" class="gn-cplay" title="Play / pause">${n.playing ? '❚❚' : '▶'}</button>
        <button data-c="next" title="Next">⏭</button>
        <span class="gn-ctime">${clockOf(n.seconds)} / ${clockOf(n.duration)}</span>
        <input class="gn-cvol" type="range" min="0" max="100" value="${Math.round(deck.lib.volume * 100)}" title="Volume">
      </div>
    </aside>`;
}

// ── WIRING ─────────────────────────────────────────────────────────────────
function wire(): void {
  const deck = musicDeck();
  const q = <T extends HTMLElement>(sel: string) => root.querySelectorAll<T>(sel);

  q<HTMLButtonElement>('[data-app]').forEach((b) => {
    b.onclick = () => { app = b.dataset.app as GonetApp; if (app === 'video') startVideoClock(); paint(); };
  });
  q<HTMLButtonElement>('[data-act]').forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'options') host.options();
      else if (a === 'readall') { markAllRead(inbox.map((m) => m.id)); readCache = null; paint(); }
      else if (a === 'newlist') {
        const name = prompt('Name the list');
        if (name) { const p = createPlaylist(deck.lib, name); musicList = p.id; saveLibrary(deck.lib); paint(); }
      } else if (a === 'rename') {
        const p = playlistOf(deck.lib, b.dataset.id!);
        const name = prompt('Rename the list', p?.name ?? '');
        if (name && p) { p.name = name; saveLibrary(deck.lib); paint(); }
      } else if (a === 'dellist') {
        if (deleteConfirm(b.dataset.id!)) { deletePlaylist(deck.lib, b.dataset.id!); musicList = 'all'; saveLibrary(deck.lib); paint(); }
      } else if (a === 'setfield') {
        setFieldPlaylist(deck.lib, b.dataset.id!); saveLibrary(deck.lib); paint();
      } else if (a === 'builder') {
        // THE TRACK BUILDER lives in the creator's room (admin.html). This
        // button used to be DEAD — declared in the sports markup with no case
        // here, so the one door to the builder did nothing. Open it for real.
        window.open('/admin.html#track-builder', '_blank', 'noopener');
      }
    };
  });

  // desk tiles
  q<HTMLButtonElement>('[data-tile]').forEach((b) => {
    b.onclick = () => {
      const t = b.dataset.tile!;
      if (t === 'deploy-skirmish') host.deploy('skirmish');
      else if (t === 'deploy-paintball') host.deploy('paintball');
      else if (t === 'mp') { /* soon */ }
      else { app = t as GonetApp; if (app === 'video') startVideoClock(); paint(); }
    };
  });

  // sports
  q<HTMLButtonElement>('[data-sport]').forEach((b) => {
    b.onclick = () => { sportOpen = b.dataset.sport as SportId; paint(); };
  });
  q<HTMLButtonElement>('[data-sportgo]').forEach((b) => {
    b.onclick = () => {
      const s = sportById(b.dataset.sportgo as SportId);
      if (!s) return;
      gonetSuspend();
      host.enterSport(s.mode, s.raceKind);
    };
  });

  // THE DECK — switching it on teaches nothing, on purpose
  q<HTMLButtonElement>('[data-cart]').forEach((b) => {
    b.onclick = () => {
      const d = loadDeck();
      const id = b.dataset.cart!;
      // the `disabled` attribute is the only thing that used to stop you
      // slotting a cartridge you do not own — check the locker, not the markup
      if (!cartridgeById(id) || !owns(d, id)) return;
      d.inSlot = id; saveDeck(d); paint();
    };
  });
  q<HTMLButtonElement>('[data-play2]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.play2!;
      const d = loadDeck();
      const cart = cartridgeById(id);
      if (!cart || !owns(d, id)) return;
      const screen = document.querySelector<HTMLElement>('.gn-screen2');
      if (!screen) return;
      // THE CARTRIDGE RUNS IN THE SCREEN. This used to be a browser alert()
      // showing the back-of-the-box blurb — a display case with a save file.
      deckSession?.stop();
      deckSession = playInScreen(screen, cart, d.best[id] ?? 0, (score) => {
        deckSession = null;
        const save = loadDeck();
        // fileScore owns the session count AND the personal best — it was
        // written for exactly this and had never once been called
        fileScore(save, id, score);
        saveDeck(save);
        host.playCartridge(id);   // the game's hook: a session happened
        paint();                  // SESSIONS / BEST were stale until now
      });
    };
  });

  // briefings
  q<HTMLButtonElement>('[data-brief]').forEach((b) => {
    b.onclick = () => { briefOpen = b.dataset.brief!; paint(); };
  });
  q<HTMLButtonElement>('[data-bkind]').forEach((b) => {
    b.onclick = () => { briefKind = b.dataset.bkind as BriefKind; briefOpen = null; paint(); };
  });
  q<HTMLButtonElement>('[data-launch]').forEach((b) => {
    b.onclick = () => {
      const [kind, id] = b.dataset.launch!.split(':');
      gonetSuspend();
      host.launchBrief(kind as BriefKind, id);
    };
  });

  // mail
  q<HTMLButtonElement>('[data-msg]').forEach((b) => {
    b.onclick = () => { openMsg = b.dataset.msg!; markRead(openMsg); readCache = null; paint(); };
  });
  q<HTMLButtonElement>('[data-cta]').forEach((b) => {
    b.onclick = () => {
      const target = b.dataset.cta!;
      if (target === 'deploy') host.deploy('skirmish');
      else { app = target as GonetApp; paint(); }
    };
  });

  // video
  q<HTMLButtonElement>('[data-chan]').forEach((b) => {
    b.onclick = () => { vChannel = b.dataset.chan as ChannelId; vIndex = 0; vTime = 0; paint(); };
  });
  q<HTMLButtonElement>('[data-genre]').forEach((b) => {
    b.onclick = () => {
      vGenre = b.dataset.genre as VideoGenre;
      // land on the genre's first strand — never leave the screen pointed at a
      // channel that does not live on the shelf you just opened
      vChannel = channelsIn(vGenre)[0]?.id ?? vChannel;
      vIndex = 0; vTime = 0;
      paint();
    };
  });
  q<HTMLButtonElement>('[data-reel]').forEach((b) => {
    b.onclick = () => { vIndex = Number(b.dataset.reel); vTime = 0; vPlaying = true; startVideoClock(); paint(); };
  });
  q<HTMLElement>('[data-v]').forEach((b) => {
    b.onclick = (ev) => {
      const v = b.dataset.v;
      const list = reelsOn(vReels, vChannel);
      if (v === 'play') { vPlaying = !vPlaying; startVideoClock(); }
      else if (v === 'next') { vIndex = (vIndex + 1) % Math.max(1, list.length); vTime = 0; }
      else if (v === 'prev') { vIndex = (vIndex - 1 + Math.max(1, list.length)) % Math.max(1, list.length); vTime = 0; }
      else if (v === 'seek') {
        const r = b.getBoundingClientRect();
        const f = Math.max(0, Math.min(1, ((ev as MouseEvent).clientX - r.left) / r.width));
        vTime = f * reelSeconds(list[vIndex] ?? { shots: [] } as unknown as Reel);
      }
      paint();
    };
  });

  // music library
  q<HTMLButtonElement>('[data-plist]').forEach((b) => {
    b.onclick = () => { musicList = b.dataset.plist!; paint(); };
  });
  q<HTMLButtonElement>('[data-play]').forEach((b) => {
    b.onclick = () => {
      const idTrack = b.dataset.play!;
      const n = deck.now();
      if (n.track?.id === idTrack) { deck.toggle(); return; }
      deck.setQueue(musicList);
      deck.play(idTrack);
    };
  });
  q<HTMLButtonElement>('[data-fav]').forEach((b) => {
    b.onclick = () => { toggleFavourite(deck.lib, b.dataset.fav!); saveLibrary(deck.lib); paint(); };
  });
  q<HTMLButtonElement>('[data-add]').forEach((b) => {
    b.onclick = () => { addToPlaylist(deck.lib, musicList, b.dataset.add!); saveLibrary(deck.lib); paint(); };
  });
  q<HTMLButtonElement>('[data-rm]').forEach((b) => {
    b.onclick = () => { removeFromPlaylist(deck.lib, musicList, b.dataset.rm!); saveLibrary(deck.lib); paint(); };
  });
  q<HTMLButtonElement>('[data-up]').forEach((b) => {
    b.onclick = () => { movePlaylistTrack(deck.lib, musicList, b.dataset.up!, -1); saveLibrary(deck.lib); paint(); };
  });
  q<HTMLButtonElement>('[data-down]').forEach((b) => {
    b.onclick = () => { movePlaylistTrack(deck.lib, musicList, b.dataset.down!, 1); saveLibrary(deck.lib); paint(); };
  });

  // the corner deck
  q<HTMLElement>('[data-c]').forEach((b) => {
    b.onclick = (ev) => {
      const c = b.dataset.c;
      if (c === 'play') deck.toggle();
      else if (c === 'next') deck.next();
      else if (c === 'prev') deck.prev();
      else if (c === 'seek') {
        const r = b.getBoundingClientRect();
        deck.seek(((ev as MouseEvent).clientX - r.left) / r.width);
      }
    };
  });
  const vol = root.querySelector<HTMLInputElement>('.gn-cvol');
  if (vol) vol.oninput = () => deck.setVolume(Number(vol.value) / 100);

  // the file app reuses the service file, unchanged
  const fileHost = root.querySelector<HTMLElement>('#gn-service-file');
  if (fileHost) renderServiceFile(fileHost);

  // keep the corner honest without repainting the whole network on every tick
  unsubDeck?.();
  unsubDeck = deck.on(() => {
    const c = root.querySelector('.gn-corner');
    if (!c) return;
    const fresh = document.createElement('div');
    fresh.innerHTML = corner();
    const next = fresh.firstElementChild!;
    // only the cheap bits move each tick
    c.className = next.className;
    c.querySelector('.gn-cmeta')!.innerHTML = next.querySelector('.gn-cmeta')!.innerHTML;
    (c.querySelector('.gn-cbar i') as HTMLElement).style.width =
      (next.querySelector('.gn-cbar i') as HTMLElement).style.width;
    c.querySelector('.gn-ctime')!.textContent = next.querySelector('.gn-ctime')!.textContent;
    c.querySelector('.gn-cplay')!.textContent = next.querySelector('.gn-cplay')!.textContent;
    c.querySelector('.gn-ceq')!.innerHTML = next.querySelector('.gn-ceq')!.innerHTML;
  });
}

function deleteConfirm(id: string): boolean {
  const p = playlistOf(musicDeck().lib, id);
  return !!p && confirm(`Delete "${p.name}"? The songs stay on the shelf.`);
}

/** Leaving the laptop — stop the video clock, keep the music playing. */
export function gonetSuspend(): void {
  if (vTimer !== null) { clearInterval(vTimer); vTimer = null; }
  vPlaying = false;
}

export { FIELD_ID };
