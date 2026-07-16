/**
 * §11.5 The War Room — page logic for the operator console (warroom.html).
 *
 * Observe + administrate + nudge, nothing more: it polls GET /warroom/status
 * every 5 seconds (plain fetch — no websocket needed for a wall display) and
 * fires one POST /warroom/cmd per button. When the server is absent every
 * live section says so honestly instead of pretending with stale numbers.
 * The fourth panel is reserved and rendered empty ON PURPOSE — see the DD.
 */
import { FRONTS } from '../client/campaign';
import type { WarroomCmd, WarroomCmdResult, WarroomStatus } from '../server/warroom';

const $ = (id: string) => document.getElementById(id)!;
const POLL_MS = 5000;

// ── server link settings (address + shared key), remembered per browser ────
const addrInput = $('srv-addr') as HTMLInputElement;
const keyInput = $('srv-key') as HTMLInputElement;
addrInput.value = localStorage.getItem('ww_warroom_addr') ?? `${location.hostname || 'localhost'}:3401`;
keyInput.value = localStorage.getItem('ww_warroom_key') ?? 'dev-key';
addrInput.onchange = () => { localStorage.setItem('ww_warroom_addr', addrInput.value.trim()); void poll(); };
keyInput.onchange = () => localStorage.setItem('ww_warroom_key', keyInput.value);

const base = () => `${location.protocol === 'https:' ? 'https' : 'http'}://${addrInput.value.trim() || 'localhost:3401'}`;

// ── tiny render helpers ─────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const clock = (secs: number) => secs < 0 ? '∞' : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
const when = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const BAND_LABEL = { coalition: 'United Front', contested: 'Contested', collective: 'Collective' } as const;

function offline(el: HTMLElement, note: string) {
  el.innerHTML = `<div class="offline">Server offline<small>${esc(note)}</small></div>`;
}

// ── OBSERVE: the Scar panel ─────────────────────────────────────────────────
function renderScar(c: WarroomStatus['campaign']) {
  const { coalition, contested, collective } = c.standing;
  const rows = c.fronts.map((f) => {
    // control −100..+100 → a bar growing from the center line
    const pct = Math.min(50, Math.abs(f.control) / 2);
    const fill = f.control >= 0
      ? `<div class="ctrl-fill uf" style="left:50%; width:${pct}%"></div>`
      : `<div class="ctrl-fill col" style="right:50%; width:${pct}%"></div>`;
    return `<div class="front-row">
      <div class="fname">${esc(f.name)}<small>${f.mode}</small></div>
      <div class="ctrl-track">${f.control !== 0 ? fill : ''}</div>
      <div class="ctrl-val num">${f.control > 0 ? '+' : ''}${f.control}</div>
      <div class="band-chip ${f.band}${f.scarActive ? ' scarred' : ''}" title="${f.scarActive ? 'scar active' : ''}">${BAND_LABEL[f.band]}</div>
    </div>`;
  }).join('');
  $('scar-body').innerHTML = `
    <div id="season-line">
      <span class="season">SEASON ${c.season}</span>
      <span class="hold">UF <b>${coalition}</b> · contested <b>${contested}</b> · COL <b>${collective}</b> — <b>${c.frontsToWin}</b> fronts end the war</span>
    </div>
    <div id="standing-bar">
      <div class="uf" style="flex:${coalition}"></div>
      <div class="con" style="flex:${contested}"></div>
      <div class="col" style="flex:${collective}"></div>
    </div>
    ${rows}`;
}

// ── OBSERVE + ADMINISTRATE: live battles ────────────────────────────────────
function renderRooms(rooms: WarroomStatus['rooms']) {
  const body = $('rooms-body');
  if (rooms.length === 0) {
    body.innerHTML = '<div class="hint" style="text-align:center; padding:14px 0">Server up, no live rooms — a room is born when the first soldier joins.</div>';
    return;
  }
  body.innerHTML = rooms.map((r) => {
    const roster = r.roster.length
      ? `<div class="roster">humans: ${r.roster.map((p) => `<b>${esc(p.name)}</b> <span class="num">(${p.kills}/${p.deaths})</span>`).join(' · ')}</div>`
      : '<div class="roster">no humans aboard — the bots hold the line</div>';
    return `<div class="room-card" data-mode="${r.mode}">
      <div class="room-head">
        <span class="rmode">${r.mode}</span>
        <span class="rfront">${esc(r.front ?? 'unmapped ground')} · ${r.theme}</span>
        <span class="rclock num">${r.over ? 'MATCH OVER' : clock(r.timeLeft)}${r.wave ? ` · wave ${r.wave}` : ''}</span>
      </div>
      <div class="room-stats">
        <span class="s0">UF <b>${r.scores[0]}</b></span>
        <span class="s1">COL <b>${r.scores[1]}</b></span>
        <span>humans <b>${r.humans}</b></span>
        <span>bots <b>${r.bots}</b></span>
      </div>
      ${roster}
      <div class="room-actions">
        <button class="act danger" data-act="end">■ End match</button>
        <button class="act" data-act="restart">↻ Restart room</button>
        <input type="text" data-in="announce" placeholder="announcement…" maxlength="120" />
        <button class="act" data-act="announce">📣 Broadcast</button>
        <input type="text" data-in="kick" placeholder="soldier name" maxlength="16" />
        <button class="act danger" data-act="kick">⤫ Kick</button>
      </div>
    </div>`;
  }).join('');
}

// ── NUDGE: journal + wire feedback ─────────────────────────────────────────
function renderJournal(dispatch: WarroomStatus['campaign']['dispatch']) {
  $('journal').innerHTML = dispatch.length
    ? dispatch.map((d) => {
      const cls = d.text.startsWith('OPERATOR:') ? 'operator' : d.simulated ? 'simulated' : '';
      return `<div class="disp ${cls}"><span class="when">${when(d.at)}</span><span class="txt">${esc(d.text)}</span></div>`;
    }).join('')
    : '<div class="hint">No dispatches yet — the theatre file is fresh.</div>';
}

function wire(msg: string, ok: boolean) {
  const el = $('cmd-wire');
  el.textContent = msg;
  el.className = ok ? 'ok' : 'err';
}

// ── the poll loop — 5s cadence, honest about absence ───────────────────────
let up = false;

async function poll() {
  try {
    const res = await fetch(`${base()}/warroom/status`, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const status = (await res.json()) as WarroomStatus;
    up = true;
    const lamp = $('link-lamp');
    lamp.textContent = 'Link up';
    lamp.className = 'up';
    $('scar-stamp').textContent = `as of ${when(status.at)}`;
    renderScar(status.campaign);
    renderRooms(status.rooms);
    renderJournal(status.campaign.dispatch);
  } catch {
    up = false;
    const lamp = $('link-lamp');
    lamp.textContent = 'Offline';
    lamp.className = 'down';
    $('scar-stamp').textContent = '';
    offline($('scar-body'), 'Start it with `npm run server` — the Scar reads from the live status endpoint.');
    offline($('rooms-body'), 'Rooms appear here the moment the server answers.');
  }
}

// ── commands — one POST each, key in the header, refresh on success ────────
async function send(cmd: WarroomCmd) {
  if (!up) { wire('server offline — command not sent', false); return; }
  try {
    const res = await fetch(`${base()}/warroom/cmd`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-warroom-key': keyInput.value },
      body: JSON.stringify(cmd),
      signal: AbortSignal.timeout(3500),
    });
    const out = (await res.json()) as WarroomCmdResult;
    wire(out.lines?.join(' · ') ?? out.msg ?? (out.ok ? 'done' : 'refused'), out.ok);
    if (out.ok) void poll(); // show the consequence immediately, not in 5s
  } catch {
    wire('command failed — server unreachable', false);
  }
}

// room-card actions (event delegation — the cards re-render every poll)
$('rooms-body').addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest('button[data-act]') as HTMLButtonElement | null;
  if (!btn) return;
  const card = btn.closest('.room-card') as HTMLElement;
  const mode = card.dataset.mode as WarroomCmd['mode'];
  const act = btn.dataset.act!;
  const input = (sel: string) => (card.querySelector(`input[data-in="${sel}"]`) as HTMLInputElement).value.trim();
  if (act === 'end' && confirm(`End the ${mode} match now? The scoreboard decides the winner.`)) {
    void send({ op: 'end', mode });
  } else if (act === 'restart' && confirm(`Restart the ${mode} room on a fresh seed? Players are moved into the new match.`)) {
    void send({ op: 'restart', mode });
  } else if (act === 'announce') {
    const text = input('announce');
    if (text) void send({ op: 'announce', mode, text });
    else wire('type an announcement first', false);
  } else if (act === 'kick') {
    const name = input('kick');
    if (name && confirm(`Kick ${name} from ${mode}? Their socket is dropped; a bot takes the seat.`)) {
      void send({ op: 'kick', mode, name });
    } else if (!name) wire('type a soldier name first', false);
  }
});

// nudge controls — fronts straight from the campaign's own table
const frontSel = $('nudge-front') as HTMLSelectElement;
frontSel.innerHTML = FRONTS.map((f) => `<option value="${f.id}">${esc(f.name)} (${f.mode})</option>`).join('');
$('nudge-plus').addEventListener('click', () => void send({ op: 'nudge', frontId: frontSel.value, delta: 10 }));
$('nudge-minus').addEventListener('click', () => void send({ op: 'nudge', frontId: frontSel.value, delta: -10 }));
$('op-stage').addEventListener('click', () => {
  const name = ($('op-name') as HTMLInputElement).value.trim();
  if (!name) { wire('an operation needs a codename', false); return; }
  void send({ op: 'operation', name, note: ($('op-note') as HTMLInputElement).value });
});

void poll();
setInterval(() => void poll(), POLL_MS);
