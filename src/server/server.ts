/**
 * War World dedicated server.
 *   npx tsx src/server/server.ts [port]
 * One room per game mode; rooms run the same deterministic sim as the client.
 * Bots fill each room so matches work with any player count.
 */
import { WebSocketServer, WebSocket } from 'ws';
import { World } from '../sim/world';
import { takeSnapshot } from '../sim/snapshot';
import { isCoopMode, type ClassId, type ModeId, type PlayerCmd } from '../sim/types';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3401);
const TICK = 1 / 30;
const SNAP_EVERY = 2; // 15Hz snapshots

const BOT_NAMES = ['Vex', 'Talon', 'Havoc', 'Rook', 'Cinder', 'Drifter', 'Onyx', 'Piston', 'Gault', 'Merc', 'Static', 'Bishop', 'Fang', 'Widow', 'Jinx'];
const CLASS_POOL: ClassId[] = ['infantry', 'infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator'];
const MODES: ModeId[] = ['tdm', 'ctf', 'koth', 'conquest', 'survival', 'horde'];

interface Client {
  ws: WebSocket;
  soldierId: number;
  cmd: PlayerCmd | null;
}

class Room {
  world: World;
  clients = new Set<Client>();
  private tickCount = 0;
  private interval: ReturnType<typeof setInterval>;

  constructor(public mode: ModeId) {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.world = new World({ seed, mode });
    let n = 0;
    if (isCoopMode(mode)) {
      for (let i = 0; i < 3; i++) this.world.addSoldier(BOT_NAMES[n++], CLASS_POOL[i % CLASS_POOL.length], 0, 'bot');
    } else {
      for (let i = 0; i < 6; i++) this.world.addSoldier(BOT_NAMES[n++], CLASS_POOL[i % CLASS_POOL.length], 0, 'bot');
      for (let i = 0; i < 7; i++) this.world.addSoldier(BOT_NAMES[n++], CLASS_POOL[(i + 3) % CLASS_POOL.length], 1, 'bot');
    }
    this.interval = setInterval(() => this.tick(), TICK * 1000);
    console.log(`[room:${mode}] created (seed ${seed})`);
  }

  join(ws: WebSocket, name: string, classId: ClassId): Client {
    // balance teams by live player+bot count
    const counts: [number, number] = [0, 0];
    for (const s of this.world.humansAndBots()) counts[s.team]++;
    const team = isCoopMode(this.mode) ? 0 : counts[0] <= counts[1] ? 0 : 1;
    const soldier = this.world.addSoldier(name.slice(0, 16) || 'Recruit', classId, team, 'human');
    const client: Client = { ws, soldierId: soldier.id, cmd: null };
    this.clients.add(client);
    ws.send(JSON.stringify({ t: 'welcome', id: soldier.id, seed: this.world.opts.seed, mode: this.mode }));
    console.log(`[room:${this.mode}] ${name} joined as #${soldier.id} (team ${team}, ${this.clients.size} online)`);
    return client;
  }

  leave(client: Client) {
    this.clients.delete(client);
    this.world.soldiers.delete(client.soldierId);
    console.log(`[room:${this.mode}] #${client.soldierId} left (${this.clients.size} online)`);
  }

  tick() {
    const cmds = new Map<number, PlayerCmd>();
    for (const c of this.clients) if (c.cmd) cmds.set(c.soldierId, c.cmd);
    this.world.step(TICK, cmds);
    this.tickCount++;
    if (this.tickCount % SNAP_EVERY === 0) {
      const snap = JSON.stringify({ t: 'snap', snap: takeSnapshot(this.world, this.world.takeEvents()) });
      for (const c of this.clients) {
        if (c.ws.readyState === WebSocket.OPEN) c.ws.send(snap);
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
    this.world = new World({ seed, mode: this.mode });
    let n = 0;
    if (isCoopMode(this.mode)) {
      for (let i = 0; i < 3; i++) this.world.addSoldier(BOT_NAMES[n++], CLASS_POOL[i % CLASS_POOL.length], 0, 'bot');
    } else {
      for (let i = 0; i < 6; i++) this.world.addSoldier(BOT_NAMES[n++], CLASS_POOL[i % CLASS_POOL.length], 0, 'bot');
      for (let i = 0; i < 7; i++) this.world.addSoldier(BOT_NAMES[n++], CLASS_POOL[(i + 3) % CLASS_POOL.length], 1, 'bot');
    }
    // move connected players into the new match
    for (const c of this.clients) {
      const oldSoldier = old.soldiers.get(c.soldierId);
      const counts: [number, number] = [0, 0];
      for (const s of this.world.humansAndBots()) counts[s.team]++;
      const team = isCoopMode(this.mode) ? 0 : counts[0] <= counts[1] ? 0 : 1;
      const soldier = this.world.addSoldier(oldSoldier?.name ?? 'Recruit', oldSoldier?.classId ?? 'infantry', team as 0 | 1, 'human');
      c.soldierId = soldier.id;
      c.cmd = null;
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(JSON.stringify({ t: 'welcome', id: soldier.id, seed, mode: this.mode }));
      }
    }
    console.log(`[room:${this.mode}] match restarted (seed ${seed})`);
  }

  get empty() { return this.clients.size === 0; }

  dispose() { clearInterval(this.interval); }
}

const rooms = new Map<ModeId, Room>();
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  let room: Room | null = null;
  let client: Client | null = null;

  ws.on('message', (raw) => {
    let msg: { t: string; name?: string; classId?: ClassId; mode?: ModeId; cmd?: PlayerCmd };
    try { msg = JSON.parse(String(raw)); } catch { return; }

    if (msg.t === 'join' && !client) {
      const mode = MODES.includes(msg.mode as ModeId) ? (msg.mode as ModeId) : 'ctf';
      room = rooms.get(mode) ?? null;
      if (!room) {
        room = new Room(mode);
        rooms.set(mode, room);
      }
      client = room.join(ws, msg.name ?? 'Recruit', msg.classId ?? 'infantry');
    } else if (msg.t === 'cmd' && client && msg.cmd) {
      client.cmd = msg.cmd;
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

console.log(`War World server listening on ws://0.0.0.0:${PORT}`);
console.log(`Modes: ${MODES.join(', ')} — one room per mode, bots fill empty slots.`);
