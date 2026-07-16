/**
 * Bot Lab — scripted AI scenarios with a stopwatch. Where balance-sim measures
 * WHO wins, this measures whether bots can DO things: get through a door,
 * break into a defended room, hold class doctrine at the right distance.
 *
 *   npx tsx tools/bot-lab.ts
 *
 * Run it before and after touching bots.ts — the deltas are the review.
 */
import { GRID, T_DOOR, T_OPEN, T_WALL, TILE, WORLD } from '../src/sim/map';
import { World } from '../src/sim/world';
import type { Soldier, Vec3 } from '../src/sim/types';

const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;
const toTile = (v: number) => Math.floor((v + WORLD / 2) / TILE);

/** Carve a sealed square room (walls, one closed door mid-west) around a tile center. */
function carveRoom(w: World, cx: number, cz: number, half = 2): number {
  for (let dz = -half - 3; dz <= half + 3; dz++)
    for (let dx = -half - 3; dx <= half + 3; dx++)
      w.map.grid[(cz + dz) * GRID + cx + dx] = T_OPEN;
  for (let dz = -half; dz <= half; dz++)
    for (let dx = -half; dx <= half; dx++) {
      if (Math.abs(dx) === half || Math.abs(dz) === half)
        w.map.grid[(cz + dz) * GRID + cx + dx] = T_WALL;
    }
  const doorIdx = cz * GRID + (cx - half);
  w.map.grid[doorIdx] = T_DOOR;
  return doorIdx;
}

function run(w: World, seconds: number, onTick?: (t: number) => boolean) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    w.step(1 / 60, new Map());
    w.takeEvents();
    if (onTick && onTick(w.time)) return;
  }
}

// ── Scenario 1: THE SIEGE — monsters vs a closed door ───────────────────────
// Prey hides in a sealed room. A pack outside must get to him. Humans would
// open the door; monsters have to break it down.
function siege(kinds: ('zombie' | 'brute' | 'bomber')[], label: string) {
  const w = new World({ seed: 11, mode: 'tdm' });
  const cx = Math.floor(GRID / 2) + 10, cz = Math.floor(GRID / 2);
  const doorIdx = carveRoom(w, cx, cz);
  const prey = w.addSoldier('Prey', 'infantry', 0, 'human');
  prey.pos = { x: toWorld(cx), y: 0, z: toWorld(cz) };
  for (let i = 0; i < kinds.length; i++) {
    const z = w.addZombie(kinds[i], { x: toWorld(cx - 8), y: 0, z: toWorld(cz + (i - 1)) });
    z.pos.y = 0;
  }
  let broke = -1, firstBlood = -1;
  run(w, 45, (t) => {
    if (broke < 0 && w.map.grid[doorIdx] === T_OPEN) broke = t;
    if (firstBlood < 0 && prey.hp < prey.maxHp) firstBlood = t;
    return firstBlood >= 0;
  });
  const fmt = (v: number) => (v < 0 ? 'NEVER' : `${v.toFixed(1)}s`);
  console.log(`siege · ${label.padEnd(18)} door down ${fmt(broke).padEnd(7)} first blood ${fmt(firstBlood)}`);
}

// ── Scenario 2: THE COMMUTE — human bots vs a door on the way to work ───────
// The KOTH hill sits inside a room with one closed door. Bots that treat the
// door as a wall never score; bots with door IQ open it and walk in.
function commute() {
  const w = new World({ seed: 7, mode: 'koth' });
  const hx = toTile(w.map.hillPos.x), hz = toTile(w.map.hillPos.z);
  carveRoom(w, hx, hz);
  const bots: Soldier[] = [];
  for (let i = 0; i < 4; i++) {
    const b = w.addSoldier(`B${i}`, 'infantry', 0, 'bot');
    b.pos = { x: toWorld(hx - 10), y: 0, z: toWorld(hz + i * 2 - 3) };
    bots.push(b);
  }
  let arrived = -1;
  run(w, 45, (t) => {
    if (arrived < 0 && bots.some((b) => Math.hypot(b.pos.x - w.map.hillPos.x, b.pos.z - w.map.hillPos.z) < 3)) arrived = t;
    return arrived >= 0;
  });
  console.log(`commute · bot reaches the hill behind a closed door: ${arrived < 0 ? 'NEVER' : `${arrived.toFixed(1)}s`}`);
}

// ── Scenario 3: DOCTRINE — does each class fight at its own range? ──────────
// A dummy stands in the open; one bot of each class starts 30u away. We log
// the closest approach over 12s — skirmishers should close, anchors hold.
function doctrine() {
  const classes = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'] as const;
  console.log('doctrine · closest approach to a target over 12s (30u start):');
  for (const cls of classes) {
    const w = new World({ seed: 23, mode: 'tdm' });
    const dummyPos: Vec3 = { x: 0, y: 0, z: 0 };
    for (let dz = -14; dz <= 14; dz++)
      for (let dx = -14; dx <= 14; dx++)
        w.map.grid[(toTile(0) + dz) * GRID + toTile(0) + dx] = T_OPEN;
    const dummy = w.addSoldier('Dummy', 'infantry', 1, 'human');
    dummy.pos = { ...dummyPos };
    dummy.dummy = true;
    dummy.hp = 100000; dummy.maxHp = 100000;
    const bot = w.addSoldier('Bot', cls, 0, 'bot');
    bot.pos = { x: -30, y: 0, z: 0 };
    let closest = Infinity;
    run(w, 12, () => {
      closest = Math.min(closest, Math.hypot(bot.pos.x - dummy.pos.x, bot.pos.z - dummy.pos.z));
      return false;
    });
    console.log(`  ${cls.padEnd(12)} ${closest.toFixed(1)}u`);
  }
}

// ── Scenario 4: THE HEIST — does 12v12 CTF produce flag play at all? ─────────
// Counts every flag event over a full match. A healthy CTF has takes, drops,
// returns, and the occasional capture; the stalemate had literal zeroes.
function heist(seed: number, minutes = 8) {
  const w = new World({ seed, mode: 'ctf', matchMinutes: minutes });
  // MIRRORED rosters — this scenario measures the MODE's health, so the
  // teams must be fair (balance-sim keeps the mixed-deal chaos)
  const classes = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost', 'infantry', 'heavy', 'jump', 'engineer'] as const;
  for (const team of [0, 1] as const) {
    for (let i = 0; i < 12; i++) w.addSoldier(`B${team}-${i}`, classes[i], team, 'bot');
  }
  const counts = new Map<string, number>();
  const steps = Math.round(minutes * 60 * 60);
  for (let i = 0; i < steps && !w.mode.over; i++) {
    w.step(1 / 60, new Map());
    for (const e of w.takeEvents()) {
      if (e.type.startsWith('flag')) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    }
  }
  const c = (k: string) => counts.get(k) ?? 0;
  console.log(`heist · seed ${String(seed).padEnd(10)} score ${w.mode.scores[0]}–${w.mode.scores[1]}  ` +
    `taken ${c('flag_taken')} · dropped ${c('flag_dropped')} · returned ${c('flag_returned')} · captured ${c('flag_captured')}`);
}

siege(['zombie'], 'lone walker');
siege(['zombie', 'zombie', 'zombie'], 'walker pack x3');
siege(['brute'], 'one brute');
siege(['bomber'], 'one bomber');
commute();
doctrine();
heist(12345);
heist(2654448106);
heist(1013916571);
