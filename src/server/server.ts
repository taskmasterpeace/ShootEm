/**
 * War World dedicated server.
 *   npx tsx src/server/server.ts [port]
 * One room per game mode; rooms run the same deterministic sim as the client.
 * Bots fill each room so matches work with any player count.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { World, type Loadout } from '../sim/world';
import { cullSnapshotFor, takeSnapshot, wireRound } from '../sim/snapshot';
import { isCoopMode, type AscendantId, type ClassId, type ModeId, type PlayerCmd, type ThemeId } from '../sim/types';
import { LSWS } from '../sim/lsw';
import { drainCmd, newCmdQueue, pushCmd, resetCmdQueue, type CmdQueueState } from './input-queue';
import {
  FRONTS, applyNudge, cloneSeedFor, freshCampaign, stageOperation, type Campaign,
} from '../client/campaign';
import {
  campaignSummary, keyOk, roomStatus, type WarroomCmd, type WarroomCmdResult, type WarroomStatus,
} from './warroom';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3401);
// §11.5 shared secret for POST /warroom/cmd. Stage-2 hardening point: this is
// a dev-key-by-default header check over plain HTTP — before the war runs
// public it needs a real secret store, TLS, and rate limiting. Not before.
const WARROOM_KEY = process.env.WARROOM_KEY ?? 'dev-key';
const TICK = 1 / 30;
const SNAP_EVERY = 2; // 15Hz snapshots

const BOT_NAMES = ['Vex', 'Talon', 'Havoc', 'Rook', 'Cinder', 'Drifter', 'Onyx', 'Piston', 'Gault', 'Merc', 'Static', 'Bishop', 'Fang', 'Widow', 'Jinx'];
const CLASS_POOL: ClassId[] = ['infantry', 'infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];
const MODES: ModeId[] = ['tdm', 'ctf', 'koth', 'conquest', 'survival', 'horde', 'safehouse'];
const THEME_ROTATION: ThemeId[] = ['savanna', 'starship', 'asteroid', 'europa', 'titan', 'triton'];

/**
 * Stored comms: messages left for players who are offline, delivered the
 * next time a player with that callsign joins any room.
 */
const mailbox = new Map<string, { from: string; text: string; at: number }[]>();

interface Client {
  ws: WebSocket;
  soldierId: number;
  name: string;
  /** opt #3 (N3): a per-client input queue instead of a latest-wins slot */
  inputs: CmdQueueState;
}

class Room {
  world: World;
  clients = new Set<Client>();
  theme: ThemeId;
  private tickCount = 0;
  private interval: ReturnType<typeof setInterval>;

  /** 32B: competitive rooms hold TEAM_TARGET bodies per side, bots filling
   *  every open position; joins/leaves swap a bot out/in so the war never
   *  shrinks. Heavy bots carry MANPADS (49A). */
  static readonly TEAM_TARGET = 12;
  private botSeq = 0;

  private addBot(team: 0 | 1) {
    const cls = CLASS_POOL[this.botSeq % CLASS_POOL.length];
    const name = BOT_NAMES[this.botSeq % BOT_NAMES.length] + (this.botSeq >= BOT_NAMES.length ? `-${Math.floor(this.botSeq / BOT_NAMES.length) + 1}` : '');
    this.botSeq++;
    this.world.addSoldier(name, cls, team, 'bot', cls === 'heavy' ? { equipment: ['manpads'] } : undefined);
  }

  private removeBot(team: 0 | 1): boolean {
    for (const s of this.world.soldiers.values()) {
      if (s.kind !== 'bot' || s.team !== team) continue;
      if (s.vehicleId >= 0) {
        const v = this.world.vehicles.get(s.vehicleId);
        if (v && s.seat >= 0) v.seats[s.seat] = -1;
      }
      this.world.soldiers.delete(s.id);
      return true;
    }
    return false;
  }

  private fillBots() {
    if (isCoopMode(this.mode)) {
      const bodies = [...this.world.soldiers.values()].filter((s) => s.team === 0 && (s.kind === 'bot' || s.kind === 'human')).length;
      for (let i = bodies; i < 5; i++) this.addBot(0);
      return;
    }
    for (const team of [0, 1] as const) {
      const bodies = [...this.world.soldiers.values()].filter((s) => s.team === team && (s.kind === 'bot' || s.kind === 'human')).length;
      for (let i = bodies; i < Room.TEAM_TARGET; i++) this.addBot(team);
      // §5.3: each side fields one K9, paired to its first infantry/engineer bot
      const handler = [...this.world.soldiers.values()].find(
        (s) => s.kind === 'bot' && s.team === team && (s.classId === 'infantry' || s.classId === 'engineer'),
      );
      if (handler) this.world.addDog(handler);
    }
  }

  constructor(public mode: ModeId) {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.theme = THEME_ROTATION[Math.floor(Math.random() * THEME_ROTATION.length)];
    this.world = new World({ seed, mode, theme: this.theme });
    this.fillBots();
    this.interval = setInterval(() => this.tick(), TICK * 1000);
    console.log(`[room:${mode}] created (seed ${seed}, theme ${this.theme})`);
  }

  join(ws: WebSocket, name: string, classId: ClassId, loadout?: Loadout): Client {
    // 32B: balance by HUMAN count, then swap a bot out so the side stays at target
    const humans: [number, number] = [0, 0];
    for (const c of this.clients) {
      const s = this.world.soldiers.get(c.soldierId);
      if (s) humans[s.team]++;
    }
    const team = isCoopMode(this.mode) ? 0 : humans[0] <= humans[1] ? 0 : 1;
    this.removeBot(team);
    const soldier = this.world.addSoldier(name.slice(0, 16) || 'Recruit', classId, team, 'human', loadout);
    const client: Client = { ws, soldierId: soldier.id, name: soldier.name, inputs: newCmdQueue() };
    this.clients.add(client);
    ws.send(JSON.stringify({ t: 'welcome', id: soldier.id, seed: this.world.opts.seed, mode: this.mode, theme: this.theme }));
    // deliver any comms stored for this callsign while they were offline
    const mail = mailbox.get(soldier.name.toLowerCase());
    if (mail?.length) {
      ws.send(JSON.stringify({ t: 'mail', items: mail }));
      mailbox.delete(soldier.name.toLowerCase());
    }
    console.log(`[room:${this.mode}] ${name} joined as #${soldier.id} (team ${team}, ${this.clients.size} online)`);
    return client;
  }

  /** Relay a chat line to everyone in the room (clients filter channels). */
  relayChat(from: Client, channel: string, text: string) {
    const sender = this.world.soldiers.get(from.soldierId);
    const payload = JSON.stringify({
      t: 'chat', channel: channel.slice(0, 12), from: from.name,
      fromTeam: sender?.team ?? 0, text: text.slice(0, 200),
    });
    for (const c of this.clients) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(payload);
    }
  }

  /** Relay a tactical waypoint to the sender's teammates. */
  relayWaypoint(from: Client, x: number, z: number) {
    const sender = this.world.soldiers.get(from.soldierId);
    if (!sender) return;
    const payload = JSON.stringify({ t: 'wp', x, z, by: from.name });
    for (const c of this.clients) {
      if (c === from || c.ws.readyState !== WebSocket.OPEN) continue;
      const s = this.world.soldiers.get(c.soldierId);
      if (s && s.team === sender.team) c.ws.send(payload);
    }
  }

  /** THE STABLE over the wire (finish-list #5): a HUMAN client asks for a
   *  drop; `requestLsw` does ALL the judging — faction, live slot, and the
   *  materiel purse. The pod lands where the caller stands (§6). */
  callLsw(from: Client, id: string) {
    if (!(id in LSWS)) return;
    const s = this.world.soldiers.get(from.soldierId);
    if (!s?.alive) return;
    this.world.requestLsw(id as AscendantId, s.team, s.id);
  }

  leave(client: Client) {
    this.clients.delete(client);
    const s = this.world.soldiers.get(client.soldierId);
    const team = s?.team ?? 0;
    this.world.soldiers.delete(client.soldierId);
    if (!this.world.mode.over) this.addBot(team); // 32B: a bot takes the empty seat
    console.log(`[room:${this.mode}] #${client.soldierId} left (${this.clients.size} online)`);
  }

  tick() {
    const cmds = new Map<number, PlayerCmd>();
    const now = Date.now();
    for (const c of this.clients) {
      const cmd = drainCmd(c.inputs, now); // one press per tick; held-repeat when starved; stall when stale
      if (cmd) cmds.set(c.soldierId, cmd);
    }
    this.world.step(TICK, cmds);
    this.tickCount++;
    if (this.tickCount % SNAP_EVERY === 0) {
      // 68A: one authoritative snapshot, CULLED PER CLIENT — nobody's wire
      // carries an enemy they couldn't perceive. ESP reads static.
      const base = takeSnapshot(this.world, this.world.takeEvents());
      for (const c of this.clients) {
        if (c.ws.readyState !== WebSocket.OPEN) continue;
        c.ws.send(JSON.stringify({ t: 'snap', snap: cullSnapshotFor(this.world, base, c.soldierId) }, wireRound));
      }
    }
    // restart finished matches after a break
    if (this.world.mode.over && this.world.mode.timeLeft !== -999) {
      setTimeout(() => this.restart(), 12000);
      this.world.mode.timeLeft = -999; // restart scheduled marker
    }
  }

  restart() {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const old = this.world;
    this.theme = THEME_ROTATION[Math.floor(Math.random() * THEME_ROTATION.length)];
    this.world = new World({ seed, mode: this.mode, theme: this.theme });
    this.botSeq = 0;
    this.fillBots();
    // move connected players into the new match, each swapping a bot out (32B)
    const humans: [number, number] = [0, 0];
    for (const c of this.clients) {
      const oldSoldier = old.soldiers.get(c.soldierId);
      const team = isCoopMode(this.mode) ? 0 : humans[0] <= humans[1] ? 0 : 1;
      humans[team]++;
      this.removeBot(team as 0 | 1);
      const soldier = this.world.addSoldier(oldSoldier?.name ?? 'Recruit', oldSoldier?.classId ?? 'infantry', team as 0 | 1, 'human');
      c.soldierId = soldier.id;
      resetCmdQueue(c.inputs);
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(JSON.stringify({ t: 'welcome', id: soldier.id, seed, mode: this.mode, theme: this.theme }));
      }
    }
    console.log(`[room:${this.mode}] match restarted (seed ${seed})`);
  }

  // ── §11.5 ADMINISTRATE — the boring tools that keep a live service alive ──

  /** The operator calls the match. The scoreboard as it stands picks the
   *  winner; the normal end-of-match machinery (12s break, restart) takes
   *  over from here exactly as if the clock had run out. */
  forceEnd() {
    const m = this.world.mode;
    if (m.over) return;
    m.over = true;
    m.winner = m.scores[0] === m.scores[1] ? -1 : m.scores[0] > m.scores[1] ? 0 : 1;
    this.world.emit({ type: 'match_over', text: 'COMMAND HAS CALLED THE MATCH', big: true });
    console.log(`[room:${this.mode}] match ended by operator`);
  }

  /** Operator broadcast rides the sim's own 'announce' event — the same
   *  channel a flag capture uses — so every client renders it with zero new
   *  wire vocabulary. Prefixed COMMAND so nobody mistakes it for the game. */
  announce(text: string) {
    this.world.emit({ type: 'announce', text: `COMMAND: ${text.slice(0, 120)}`, big: true });
    console.log(`[room:${this.mode}] operator broadcast: ${text.slice(0, 120)}`);
  }

  /** Kick by soldier name: drop the socket; the existing close handler swaps
   *  a bot back into the seat, so the war never shrinks (32B). */
  kick(name: string): boolean {
    const want = name.trim().toLowerCase();
    for (const c of this.clients) {
      if (c.name.toLowerCase() === want) {
        c.ws.close(4008, 'removed by operator');
        console.log(`[room:${this.mode}] ${c.name} kicked by operator`);
        return true;
      }
    }
    return false;
  }

  get empty() { return this.clients.size === 0; }

  dispose() { clearInterval(this.interval); }
}

const rooms = new Map<ModeId, Room>();

// ---------------------------------------------------------------------------
// §11.5 NUDGE — the server's theatre file. The browser's campaign lives in
// localStorage where no server can reach it, so the War Room keeps its OWN
// Campaign (same shape, same pure math from campaign.ts) in a JSON file
// beside the process. Nudges and operations write it the way real results
// would — through the campaign helpers, dispatch lines and all (§16).
// ---------------------------------------------------------------------------
const CAMPAIGN_FILE = process.env.WARROOM_CAMPAIGN ?? resolve(process.cwd(), '.warroom-campaign.json');

function loadServerCampaign(): Campaign {
  try {
    const c = JSON.parse(readFileSync(CAMPAIGN_FILE, 'utf8')) as Campaign;
    if (c.v === 1) {
      for (const f of FRONTS) {
        c.fronts[f.id] ??= { control: 0, scarActive: false, lastBattleAt: 0, clones: cloneSeedFor(f), pass: 1 };
        c.fronts[f.id].clones ??= cloneSeedFor(f); // W3.3 migration
        c.fronts[f.id].pass ??= 1;                 // W3.4 migration
      }
      return c;
    }
  } catch { /* fresh theatre — first boot or a mangled file */ }
  return freshCampaign();
}

function saveServerCampaign(c: Campaign) {
  c.updatedAt = Date.now();
  try {
    writeFileSync(CAMPAIGN_FILE, JSON.stringify(c, null, 2));
  } catch (e) {
    console.error('[warroom] campaign save failed:', e);
  }
}

const campaign = loadServerCampaign();

// ---------------------------------------------------------------------------
// §11.5 The War Room HTTP surface — observe + administrate + nudge. Two
// endpoints, zero new wire vocabulary: the game protocol is untouched, the
// console polls JSON. CORS is wide open because the page is served by the
// vite build on another port — Stage-2 hardening: same-origin + real auth.
// ---------------------------------------------------------------------------

/** Read a small JSON body, hard-capped — the operator sends commands, not novels. */
function readJsonBody(req: IncomingMessage): Promise<WarroomCmd | null> {
  return new Promise((done) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 4096) { req.destroy(); done(null); }
    });
    req.on('end', () => {
      try { done(JSON.parse(raw) as WarroomCmd); } catch { done(null); }
    });
    req.on('error', () => done(null));
  });
}

function sendJson(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** One operator command in, one honest answer out. */
function runWarroomCmd(cmd: WarroomCmd): WarroomCmdResult {
  const room = cmd.mode ? rooms.get(cmd.mode) : undefined;
  switch (cmd.op) {
    case 'end':
      if (!room) return { ok: false, msg: `no live room for mode '${cmd.mode}'` };
      room.forceEnd();
      return { ok: true, msg: `${room.mode} match ended — scoreboard decides the winner` };
    case 'restart':
      if (!room) return { ok: false, msg: `no live room for mode '${cmd.mode}'` };
      room.restart();
      return { ok: true, msg: `${room.mode} room restarted on a fresh seed` };
    case 'announce': {
      const text = (cmd.text ?? '').trim();
      if (!text) return { ok: false, msg: 'announcement text is empty' };
      if (room) { room.announce(text); return { ok: true, msg: `broadcast to ${room.mode}` }; }
      if (rooms.size === 0) return { ok: false, msg: 'no live rooms to hear it' };
      for (const r of rooms.values()) r.announce(text);
      return { ok: true, msg: `broadcast to all ${rooms.size} room(s)` };
    }
    case 'kick': {
      const name = (cmd.name ?? '').trim();
      if (!name) return { ok: false, msg: 'kick needs a soldier name' };
      const targets = room ? [room] : [...rooms.values()];
      for (const r of targets) if (r.kick(name)) return { ok: true, msg: `${name} dropped from ${r.mode}` };
      return { ok: false, msg: `no soldier named '${name}' online` };
    }
    case 'nudge': {
      const lines = applyNudge(campaign, cmd.frontId ?? '', Number(cmd.delta) || 0);
      if (lines.length === 0) return { ok: false, msg: 'unknown front or zero delta' };
      saveServerCampaign(campaign);
      return { ok: true, lines };
    }
    case 'operation': {
      const name = (cmd.name ?? '').trim();
      if (!name) return { ok: false, msg: 'an operation needs a codename' };
      const line = stageOperation(campaign, name, cmd.note ?? '');
      saveServerCampaign(campaign);
      return { ok: true, lines: [line] };
    }
    default:
      return { ok: false, msg: `unknown op '${(cmd as { op?: string }).op}'` };
  }
}

const httpServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-warroom-key');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const path = (req.url ?? '/').split('?')[0];

  // OBSERVE: rooms + campaign, one poll, one payload — read-only, no key
  if (req.method === 'GET' && path === '/warroom/status') {
    const payload: WarroomStatus = {
      at: Date.now(),
      rooms: [...rooms.values()].map((r) => roomStatus(r.world, r.theme)),
      campaign: campaignSummary(campaign),
    };
    sendJson(res, 200, payload);
    return;
  }

  // ADMINISTRATE + NUDGE: one command per POST, shared secret in the header
  if (req.method === 'POST' && path === '/warroom/cmd') {
    if (!keyOk(req.headers['x-warroom-key'], WARROOM_KEY)) {
      sendJson(res, 401, { ok: false, msg: 'bad or missing x-warroom-key' });
      return;
    }
    const cmd = await readJsonBody(req);
    if (!cmd || typeof cmd.op !== 'string') {
      sendJson(res, 400, { ok: false, msg: 'body must be JSON with an op' });
      return;
    }
    const result = runWarroomCmd(cmd);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  sendJson(res, 404, { ok: false, msg: 'not found' });
});

// permessage-deflate is where the bandwidth actually goes: the snapshot's
// repeated JSON keys compress ~5× one-shot, better still with the
// per-connection sliding window (consecutive snapshots are near-identical).
// Measured: 27.2 KB wire → ≤5.5 KB at level 1, 0.11 ms CPU per snapshot.
// Browsers negotiate the extension natively; the client needs no change.
// (The wss now shares the War Room's HTTP server — same port, same protocol,
// the game wire untouched; plain HTTP requests never reach the upgrade path.)
const wss = new WebSocketServer({
  server: httpServer,
  perMessageDeflate: {
    threshold: 512, // don't spend zlib on tiny control messages
    zlibDeflateOptions: { level: 1 }, // repetition does the work, not effort
  },
});

wss.on('connection', (ws) => {
  let room: Room | null = null;
  let client: Client | null = null;

  ws.on('message', (raw) => {
    let msg: {
      t: string; name?: string; classId?: ClassId; mode?: ModeId; cmd?: PlayerCmd;
      loadout?: Loadout; channel?: string; text?: string; to?: string; x?: number; z?: number; id?: string;
    };
    try { msg = JSON.parse(String(raw)); } catch { return; }

    if (msg.t === 'join' && !client) {
      const mode = MODES.includes(msg.mode as ModeId) ? (msg.mode as ModeId) : 'ctf';
      room = rooms.get(mode) ?? null;
      if (!room) {
        room = new Room(mode);
        rooms.set(mode, room);
      }
      client = room.join(ws, msg.name ?? 'Recruit', msg.classId ?? 'infantry', msg.loadout);
    } else if (msg.t === 'cmd' && client && msg.cmd) {
      pushCmd(client.inputs, msg.cmd, Date.now());
    } else if (msg.t === 'chat' && client && room && msg.channel && msg.text) {
      room.relayChat(client, msg.channel, msg.text);
    } else if (msg.t === 'mail' && client && msg.to && msg.text) {
      // store for delivery next time that callsign is online
      const key = msg.to.toLowerCase().slice(0, 16);
      const box = mailbox.get(key) ?? [];
      box.push({ from: client.name, text: msg.text.slice(0, 200), at: Date.now() });
      while (box.length > 20) box.shift();
      mailbox.set(key, box);
    } else if (msg.t === 'wp' && client && room && typeof msg.x === 'number' && typeof msg.z === 'number') {
      room.relayWaypoint(client, msg.x, msg.z);
    } else if (msg.t === 'lsw' && client && room && typeof msg.id === 'string') {
      room.callLsw(client, msg.id);
    }
  });

  ws.on('close', () => {
    if (room && client) {
      room.leave(client);
      if (room.empty) {
        // keep the room warm for 60s in case someone rejoins
        const r = room;
        setTimeout(() => {
          if (r.empty) {
            r.dispose();
            rooms.delete(r.mode);
            console.log(`[room:${r.mode}] disposed`);
          }
        }, 60_000);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`War World server listening on ws://0.0.0.0:${PORT}`);
  console.log(`Modes: ${MODES.join(', ')} — one room per mode, bots fill empty slots.`);
  console.log(`War Room: GET /warroom/status · POST /warroom/cmd (x-warroom-key${WARROOM_KEY === 'dev-key' ? ' = dev-key — set WARROOM_KEY' : ' set from env'}) · theatre file ${CAMPAIGN_FILE}`);
});
