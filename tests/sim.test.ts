import { describe, expect, it } from 'vitest';
import { CLASSES, VEHICLES, WEAPONS } from '../src/sim/data';
import { generateMap, isBlocked, losClear } from '../src/sim/map';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const run = (w: World, cmds: Map<number, PlayerCmd>, seconds: number) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) w.step(1 / 60, cmds);
};

describe('map generation', () => {
  it('is deterministic for a given seed', () => {
    const a = generateMap(1234, 'ctf');
    const b = generateMap(1234, 'ctf');
    expect(a.grid).toEqual(b.grid);
    expect(a.basePos).toEqual(b.basePos);
  });

  it('keeps spawns, pads and objectives on open ground', () => {
    const m = generateMap(99, 'conquest');
    for (const team of [0, 1] as const) {
      for (const sp of m.spawns[team]) expect(isBlocked(m.grid, sp.x, sp.z)).toBe(false);
    }
    for (const pad of m.vehiclePads) expect(isBlocked(m.grid, pad.pos.x, pad.pos.z)).toBe(false);
    for (const cp of m.controlPoints) expect(isBlocked(m.grid, cp.pos.x, cp.pos.z)).toBe(false);
    expect(isBlocked(m.grid, m.hillPos.x, m.hillPos.z)).toBe(false);
  });

  it('line of sight is blocked by walls', () => {
    const m = generateMap(7, 'tdm');
    // border walls always block a ray that leaves the map
    expect(losClear(m.grid, { x: 0, y: 0, z: 0 }, { x: 500, y: 0, z: 0 })).toBe(false);
  });
});

describe('combat', () => {
  it('soldiers damage and kill enemies with gunfire', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    // place them face to face on open ground
    a.pos = { x: 0, y: 0, z: 0 };
    b.pos = { x: 10, y: 0, z: 0 };
    const cmds = new Map([[a.id, cmd({ fire: true, aimYaw: 0 })]]);
    run(w, cmds, 5);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it('respawns the dead after the delay', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    w.damageSoldier(a, 9999, a.id, 'ar606');
    expect(a.alive).toBe(false);
    run(w, new Map(), 5);
    expect(a.alive).toBe(true);
    expect(a.hp).toBe(CLASSES.infantry.hp);
  });

  it('explosions splash-damage nearby enemies but not teammates', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const shooter = w.addSoldier('S', 'heavy', 0, 'human');
    const friend = w.addSoldier('F', 'infantry', 0, 'human');
    const foe = w.addSoldier('E', 'infantry', 1, 'human');
    friend.pos = { x: 2, y: 0, z: 0 };
    foe.pos = { x: -2, y: 0, z: 0 };
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.mml, shooter.id, 0);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(friend.hp).toBe(friend.maxHp);
  });

  it('medic beam heals wounded allies', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const medic = w.addSoldier('M', 'medic', 0, 'human');
    const hurt = w.addSoldier('H', 'infantry', 0, 'human');
    medic.pos = { x: 0, y: 0, z: 0 };
    hurt.pos = { x: 5, y: 0, z: 0 };
    hurt.hp = 30;
    const cmds = new Map([[medic.id, cmd({ fire: true, aimYaw: 0, weaponSlot: 1 })]]);
    run(w, cmds, 2);
    expect(hurt.hp).toBeGreaterThan(30);
  });

  it('cloaked infiltrators decloak when firing', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const inf = w.addSoldier('I', 'infiltrator', 0, 'human');
    inf.pos = { x: 0, y: 0, z: 0 };
    w.step(1 / 60, new Map([[inf.id, cmd({ ability: true })]]));
    expect(inf.cloaked).toBe(true);
    w.step(1 / 60, new Map([[inf.id, cmd({ fire: true })]]));
    expect(inf.cloaked).toBe(false);
  });

  it('engineer builds a sentry that fires at enemies', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const eng = w.addSoldier('E', 'engineer', 0, 'human');
    eng.pos = { x: 0, y: 0, z: 0 };
    eng.energy = 100;
    w.step(1 / 60, new Map([[eng.id, cmd({ ability: true, aimYaw: 0 })]]));
    expect(w.turrets.size).toBe(1);
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    foe.pos = { x: 10, y: 0, z: 0 };
    run(w, new Map(), 3);
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });
});

describe('vehicles', () => {
  it('spawns vehicles on pads and lets soldiers drive them', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    expect(w.vehicles.size).toBe(8); // 4 kinds × 2 teams
    const s = w.addSoldier('D', 'infantry', 0, 'human');
    const v = [...w.vehicles.values()].find((x) => x.team === 0 && x.kind === 'buggy')!;
    s.pos = { ...v.pos };
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.vehicleId).toBe(v.id);
    const before = { ...v.pos };
    run(w, new Map([[s.id, cmd({ moveZ: -1 })]]), 2);
    const moved = Math.hypot(v.pos.x - before.x, v.pos.z - before.z);
    expect(moved).toBeGreaterThan(5);
    // exit
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.vehicleId).toBe(-1);
  });

  it('destroyed vehicles eject and damage occupants, then respawn on pad', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const s = w.addSoldier('D', 'infantry', 0, 'human');
    const v = [...w.vehicles.values()].find((x) => x.team === 0 && x.kind === 'skiff')!;
    s.pos = { ...v.pos };
    w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
    expect(s.vehicleId).toBe(v.id);
    w.damageVehicle(v, 9999, s.id, 'tank_cannon');
    expect(v.alive).toBe(false);
    expect(s.vehicleId).toBe(-1);
    expect(s.hp).toBeLessThan(s.maxHp);
    run(w, new Map(), 25);
    expect(v.alive).toBe(true);
    expect(Math.hypot(v.pos.x - v.padPos.x, v.pos.z - v.padPos.z)).toBeLessThan(1);
  });

  it('tank cannot cross water but skiff can', () => {
    expect(VEHICLES.skiff.speed).toBeGreaterThan(VEHICLES.tank.speed); // sanity
    const w = new World({ seed: 42, mode: 'tdm' });
    // direct grid check: water blocks ground, not hover
    const m = w.map;
    let waterTile: { x: number; z: number } | null = null;
    for (let z = -95; z < 95 && !waterTile; z += 0.5)
      for (let x = -95; x < 95 && !waterTile; x += 0.5)
        if (isBlocked(m.grid, x, z, false) && !isBlocked(m.grid, x, z, true)) waterTile = { x, z };
    expect(waterTile).not.toBeNull(); // maps contain water hover vehicles can cross
  });
});

describe('game modes', () => {
  it('TDM ends when a team hits the kill target', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    a.kills = 50;
    w.step(1 / 60, new Map());
    expect(w.mode.over).toBe(true);
    expect(w.mode.winner).toBe(0);
  });

  it('CTF: grab, carry home, capture', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const enemyFlag = w.mode.flags![1];
    a.pos = { ...enemyFlag.pos };
    w.step(1 / 60, new Map());
    expect(a.carryingFlag).toBe(1);
    // walk them home instantly
    a.pos = { ...w.map.basePos[0] };
    w.step(1 / 60, new Map());
    expect(w.mode.scores[0]).toBe(1);
    expect(a.carryingFlag).toBe(-1);
    expect(w.mode.flags![1].atHome).toBe(true);
  });

  it('KOTH accumulates hold time and ends at target', () => {
    const w = new World({ seed: 42, mode: 'koth' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    a.pos = { ...w.mode.hillPos! };
    const hold = () => { a.pos = { ...w.mode.hillPos! }; a.vel = { x: 0, y: 0, z: 0 }; };
    for (let i = 0; i < 60 * 121; i++) { hold(); w.step(1 / 60, new Map()); if (w.mode.over) break; }
    expect(w.mode.over).toBe(true);
    expect(w.mode.winner).toBe(0);
  });

  it('Conquest: standing on a point captures it and earns tickets', () => {
    const w = new World({ seed: 42, mode: 'conquest' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const cp = w.mode.points![0];
    const hold = () => { a.pos = { ...cp.pos }; a.vel = { x: 0, y: 0, z: 0 }; };
    for (let i = 0; i < 60 * 8; i++) { hold(); w.step(1 / 60, new Map()); }
    expect(cp.owner).toBe(0);
    expect(w.mode.scores[0]).toBeGreaterThan(0);
  });

  it('Survival spawns escalating waves that hunt players', () => {
    const w = new World({ seed: 42, mode: 'survival' });
    const a = w.addSoldier('A', 'heavy', 0, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    run(w, new Map(), 7); // first wave spawns at t=5
    expect(w.mode.wave).toBe(1);
    const zombies = [...w.soldiers.values()].filter((s) => s.kind === 'zombie' || s.kind === 'spitter' || s.kind === 'brute');
    expect(zombies.length).toBeGreaterThan(0);
    // zombies close distance toward the player
    const d0 = Math.min(...zombies.map((z) => Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z)));
    run(w, new Map(), 4);
    const alive = zombies.filter((z) => z.alive);
    if (alive.length) {
      const d1 = Math.min(...alive.map((z) => Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z)));
      expect(d1).toBeLessThan(d0);
    }
  });
});

describe('endless horde', () => {
  it('spawns continuously without wave breaks and ramps intensity', () => {
    const w = new World({ seed: 42, mode: 'horde' });
    const a = w.addSoldier('A', 'heavy', 0, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    const keepAlive = () => { a.hp = a.maxHp; }; // survive for observation
    let seenCounts: number[] = [];
    for (let i = 0; i < 60 * 40; i++) {
      keepAlive();
      w.step(1 / 60, new Map());
      if (i % 300 === 0) seenCounts.push(w.mode.zombiesLeft ?? 0);
    }
    // zombies present well before any "wave clear" could happen, and population grows
    expect(Math.max(...seenCounts)).toBeGreaterThan(5);
    expect(w.mode.wave).toBeGreaterThanOrEqual(2); // intensity ramped at 30s
    const zeds = [...w.soldiers.values()].filter((s) => s.alive && s.kind !== 'human');
    expect(zeds.length).toBeGreaterThan(0);
  });

  it('rolls special zombies including rare sprinters at higher intensity', () => {
    const w = new World({ seed: 1234, mode: 'horde' });
    const a = w.addSoldier('A', 'heavy', 0, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    const kinds = new Set<string>();
    for (let i = 0; i < 60 * 120; i++) {
      a.hp = a.maxHp;
      w.step(1 / 60, new Map());
      for (const s of w.soldiers.values()) {
        if (s.kind !== 'human' && s.kind !== 'bot') {
          kinds.add(s.kind);
          if (s.alive && i % 12 === 0) w.damageSoldier(s, 9999, a.id, 'ar606'); // keep the meat grinder turning
        }
      }
      if (kinds.has('sprinter') && kinds.has('bomber') && kinds.has('brute') && kinds.has('spitter')) break;
    }
    expect(kinds.has('sprinter')).toBe(true);
    expect(kinds.has('bomber')).toBe(true);
  });

  it('sprinters are much faster than shamblers', () => {
    const w = new World({ seed: 42, mode: 'horde' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    const sp = w.map.zombieSpawns[0]; // guaranteed-open ground
    const shambler = w.addZombie('zombie', { ...sp });
    const sprinter = w.addZombie('sprinter', { ...sp });
    run(w, new Map(), 2);
    const dShambler = Math.hypot(shambler.pos.x - sp.x, shambler.pos.z - sp.z);
    const dSprinter = Math.hypot(sprinter.pos.x - sp.x, sprinter.pos.z - sp.z);
    expect(dShambler).toBeGreaterThan(3);
    expect(dSprinter).toBeGreaterThan(dShambler * 1.4);
  });

  it('bombers explode on death and damage nearby players', () => {
    const w = new World({ seed: 42, mode: 'horde' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const bomber = w.addZombie('bomber', { x: 2, y: 0, z: 0 });
    a.pos = { x: 0, y: 0, z: 0 };
    w.takeEvents();
    w.damageSoldier(bomber, 9999, a.id, 'ar606');
    expect(bomber.alive).toBe(false);
    const events = w.takeEvents();
    expect(events.some((e) => e.type === 'explosion')).toBe(true);
    expect(a.hp).toBeLessThan(a.maxHp); // stood too close to the blast
  });

  it('ends when the whole squad is down', () => {
    const w = new World({ seed: 42, mode: 'horde' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    w.damageSoldier(a, 9999, a.id, 'ar606');
    w.step(1 / 60, new Map());
    expect(w.mode.over).toBe(true);
  });
});

describe('bots', () => {
  it('bot teams fight and score kills over time', () => {
    const w = new World({ seed: 1337, mode: 'tdm' });
    for (let i = 0; i < 6; i++) w.addSoldier(`R${i}`, i % 2 ? 'heavy' : 'infantry', 0, 'bot');
    for (let i = 0; i < 6; i++) w.addSoldier(`B${i}`, i % 2 ? 'medic' : 'infantry', 1, 'bot');
    run(w, new Map(), 90);
    const totalKills = w.humansAndBots().reduce((a, s) => a + s.kills, 0);
    expect(totalKills).toBeGreaterThan(0);
  });

  it('CTF bots go for the flag', () => {
    const w = new World({ seed: 777, mode: 'ctf' });
    for (let i = 0; i < 4; i++) w.addSoldier(`R${i}`, 'infantry', 0, 'bot');
    let taken = false;
    for (let i = 0; i < 60 * 120 && !taken; i++) {
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) if (e.type === 'flag_taken') taken = true;
    }
    expect(taken).toBe(true);
  });
});

describe('snapshot codec', () => {
  it('round-trips world state including Infinity ammo', () => {
    const w = new World({ seed: 5, mode: 'conquest' });
    w.addSoldier('A', 'medic', 0, 'human'); // medibeam has Infinity clip/reserve
    w.addSoldier('B', 'heavy', 1, 'bot');
    run(w, new Map(), 2);
    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));

    const w2 = new World({ seed: 5, mode: 'conquest' });
    w2.puppet = true;
    w2.soldiers.clear();
    applySnapshot(w2, snap);
    expect(w2.soldiers.size).toBe(w.soldiers.size);
    const medic = [...w2.soldiers.values()].find((s) => s.classId === 'medic')!;
    expect(medic.reserve[1]).toBe(Infinity);
    expect(w2.time).toBeCloseTo(w.time, 5);
    expect(w2.vehicles.size).toBe(w.vehicles.size);
  });
});
