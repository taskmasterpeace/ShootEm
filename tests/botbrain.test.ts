// ---------------------------------------------------------------------------
// The bot overhaul: doors enter pathfinding (humans OPEN them, the horde
// BREAKS them down), blasts breach, and every class fights by its doctrine.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { DOCTRINE, stepBot } from '../src/sim/bots';
import { GRID, T_DOOR, T_OPEN, T_WALL, TILE, WORLD } from '../src/sim/map';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import { WEAPONS } from '../src/sim/data';
import type { Soldier } from '../src/sim/types';
import { DOOR_HP, World } from '../src/sim/world';

const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;
const toTile = (v: number) => Math.floor((v + WORLD / 2) / TILE);

/** Sealed square room around a tile center, one closed door mid-west. */
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

function run(w: World, seconds: number, until?: () => boolean) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    w.step(1 / 60, new Map());
    w.takeEvents();
    if (until && until()) return;
  }
}

describe('door IQ — humans open, monsters break', () => {
  it('a human bot opens the door between it and the objective', () => {
    const w = new World({ seed: 7, mode: 'koth' });
    const hx = toTile(w.map.hillPos.x), hz = toTile(w.map.hillPos.z);
    carveRoom(w, hx, hz);
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    b.pos = { x: toWorld(hx - 10), y: 0, z: toWorld(hz) };
    run(w, 30, () => Math.hypot(b.pos.x - w.map.hillPos.x, b.pos.z - w.map.hillPos.z) < 3);
    expect(Math.hypot(b.pos.x - w.map.hillPos.x, b.pos.z - w.map.hillPos.z)).toBeLessThan(3);
  });

  it('a zombie claws a door down (it takes a while) and reaches the prey', () => {
    const w = new World({ seed: 11, mode: 'tdm' });
    const cx = Math.floor(GRID / 2) + 10, cz = Math.floor(GRID / 2);
    const doorIdx = carveRoom(w, cx, cz);
    const prey = w.addSoldier('Prey', 'infantry', 0, 'human');
    prey.pos = { x: toWorld(cx), y: 0, z: toWorld(cz) };
    w.addZombie('zombie', { x: toWorld(cx - 8), y: 0, z: toWorld(cz) });
    let broke = -1;
    run(w, 20, () => {
      if (broke < 0 && w.map.grid[doorIdx] === T_OPEN) broke = w.time;
      return prey.hp < prey.maxHp;
    });
    expect(broke).toBeGreaterThan(5);            // the banging is a real delay
    expect(w.dug).toContain(doorIdx);            // the break rides the dug list
    expect(prey.hp).toBeLessThan(prey.maxHp);    // and dinner was served
  });

  it('a bomber IS a breaching charge — one bang, door gone', () => {
    const w = new World({ seed: 11, mode: 'tdm' });
    const cx = Math.floor(GRID / 2) + 10, cz = Math.floor(GRID / 2);
    const doorIdx = carveRoom(w, cx, cz);
    const prey = w.addSoldier('Prey', 'infantry', 0, 'human');
    prey.pos = { x: toWorld(cx), y: 0, z: toWorld(cz) };
    w.addZombie('bomber', { x: toWorld(cx - 8), y: 0, z: toWorld(cz) });
    run(w, 10, () => w.map.grid[doorIdx] === T_OPEN);
    expect(w.map.grid[doorIdx]).toBe(T_OPEN);
    expect(w.time).toBeLessThan(5);
  });

  it('a 120mm shell takes a door off in one blast; a broken door rides the wire', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const cx = Math.floor(GRID / 2) + 8, cz = Math.floor(GRID / 2);
    const doorIdx = carveRoom(w, cx, cz);
    const pos = { x: toWorld(cx - 2), y: 0, z: toWorld(cz) };
    w.explode({ ...pos, x: pos.x - 1 }, WEAPONS.tank_cannon, -1, 1);
    expect(w.map.grid[doorIdx]).toBe(T_OPEN);
    // replication: a puppet that generated the same closed door gets the hole
    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));
    const w2 = new World({ seed: 5, mode: 'tdm' });
    w2.puppet = true;
    carveRoom(w2, cx, cz);
    applySnapshot(w2, snap);
    expect(w2.map.grid[doorIdx]).toBe(T_OPEN);
  });

  it('doors below DOOR_HP damage hold; damageDoor refuses non-doors', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const cx = Math.floor(GRID / 2) + 8, cz = Math.floor(GRID / 2);
    const doorIdx = carveRoom(w, cx, cz);
    expect(w.damageDoor(doorIdx, DOOR_HP - 1)).toBe(false);
    expect(w.map.grid[doorIdx]).toBe(T_DOOR);
    expect(w.damageDoor(doorIdx, 10)).toBe(true); // the last straw
    expect(w.damageDoor(doorIdx, 10)).toBe(false); // nothing left to hit
  });
});

describe('doctrine — every class fights like itself', () => {
  function duel(cls: keyof typeof DOCTRINE, dist: number, hpFrac = 1) {
    const w = new World({ seed: 23, mode: 'tdm' });
    const ct = Math.floor(GRID / 2);
    for (let dz = -16; dz <= 16; dz++)
      for (let dx = -16; dx <= 16; dx++) w.map.grid[(ct + dz) * GRID + ct + dx] = T_OPEN;
    const enemy = w.addSoldier('E', 'infantry', 1, 'human');
    enemy.pos = { x: dist / 2, y: 0, z: 0 };
    const bot = w.addSoldier('B', cls, 0, 'bot');
    bot.pos = { x: -dist / 2, y: 0, z: 0 };
    bot.hp = bot.maxHp * hpFrac;
    const cmd = stepBot(w, bot, 1 / 60);
    const l = Math.hypot(cmd.moveX, cmd.moveZ) || 1;
    return (cmd.moveX / l); // dot with the +x direction to the enemy
  }

  it('a heavy at knife range gives ground; a jump trooper at 25u closes', () => {
    expect(duel('heavy', 6)).toBeLessThan(-0.3);
    expect(duel('jump', 25)).toBeGreaterThan(0.4);
  });

  it('humans value their lives: a mauled bot breaks contact', () => {
    expect(duel('infantry', 15, 0.15)).toBeLessThan(-0.3);
  });

  it('the doctrine table covers every class with sane numbers', () => {
    for (const [cls, d] of Object.entries(DOCTRINE)) {
      expect(d.standoff, cls).toBeGreaterThan(5);
      expect(d.retreat, cls).toBeGreaterThan(0);
      expect(d.retreat, cls).toBeLessThan(0.6);
    }
    // the marksman shoots straighter than the sprayer
    expect(DOCTRINE.infiltrator.aim).toBeLessThan(DOCTRINE.heavy.aim);
  });
});
