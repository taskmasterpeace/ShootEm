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
import type { LicenceId } from '../../sim/licenses';
import { buildInbox, markAllRead, markRead, unreadCount, type Message } from './mail';
import {
  CHANNELS, buildSchedule, reelSeconds, reelsOn, shotAt, type ChannelId, type Reel,
} from './broadcast';
import {
  addToPlaylist, clockOf, createPlaylist, deletePlaylist, FIELD_ID, movePlaylistTrack,
  playlistOf, removeFromPlaylist, saveLibrary, setFieldPlaylist, toggleFavourite,
  TRACKS, tracksOf,
} from './library';
import { musicDeck } from './player';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export type GonetApp = 'desk' | 'mail' | 'video' | 'music' | 'file';

export interface GonetHost {
  /** DEPLOY — leave the laptop for the war. */
  deploy(door: 'skirmish' | 'paintball'): void;
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

// video transport state
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

function paint(): void {
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
  const tabs: Array<[GonetApp, string, string]> = [
    ['desk', 'DESK', ''],
    ['mail', 'MAIL', unread ? String(unread) : ''],
    ['video', 'BROADCAST', ''],
    ['music', 'MUSIC', ''],
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

  const rows: Array<[string, string, string]> = [
    ['Front', frontState, frontState === 'LOSING' ? 'bad' : frontState === 'HOLDING' ? 'ok' : ''],
    ['Science', '3 Missions Available', ''],
    ['Military', '18 Missions Available', ''],
    ['Personal Mail', unread ? `${unread} UNREAD` : 'Nothing new', unread ? 'hot' : ''],
    ['Certifications', `${held} / ${allLic.length} held`, held === allLic.length ? 'ok' : ''],
    ['War Chest', chest ? chest.balance.toLocaleString() : '—', ''],
    ['Your Record', chest ? `${chest.wins}W · ${chest.losses}L` : '—', ''],
    ['Your Squad', '2 Waiting', 'hot'],
    ['Factory', 'Tank Ready', 'ok'],
    ['Research', 'New Prototype Complete', 'ok'],
    ['Promotion Board', 'Eligible', 'ok'],
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
        <h3>CHANNELS</h3>
        ${CHANNELS.map((c) => `<button class="gn-chan${c.id === vChannel ? ' on' : ''}" data-chan="${c.id}">
          <b>${esc(c.name)}</b><span>${esc(c.strap)}</span>
        </button>`).join('')}
        <h3 class="gn-sched">SCHEDULE</h3>
        ${list.map((r, i) => `<button class="gn-reel${i === vIndex ? ' on' : ''}" data-reel="${i}">
          <span>${esc(r.title)}</span><i>${esc(r.dateline)}</i>
        </button>`).join('') || '<div class="gn-empty">Nothing scheduled.</div>'}
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
