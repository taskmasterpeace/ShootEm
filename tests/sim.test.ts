import { describe, expect, it } from 'vitest';
import { CLASSES, VEHICLES, WEAPONS } from '../src/sim/data';
import { GRID, T_DOOR, TILE, WORLD, generateMap, isBlocked, losClear } from '../src/sim/map';
import { applySnapshot, takeSnapshot, wireRound } from '../src/sim/snapshot';
import { guardsHome, objectiveFor, raidsFlags } from '../src/sim/bots';
import type { ClassId, PlayerCmd } from '../src/sim/types';
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

// ---------------------------------------------------------------------------
// BLOOD (Robert: "when shooting someone when armor is gone we should see
// light blood splatter"). The SIM only states the fact — plate or flesh —
// and the client's setting decides whether to show it. The fact must be
// read BEFORE the round resolves, or the plate is always already gone.
// ---------------------------------------------------------------------------
describe('plate or flesh', () => {
  const duel = (armor: number) => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const b = w.addSoldier('B', 'infantry', 1, 'human');
    a.pos = { x: 0, y: 0, z: 0 };
    b.pos = { x: 8, y: 0, z: 0 };
    b.armor = armor; b.maxArmor = Math.max(armor, b.maxArmor);
    const hits: boolean[] = [];
    for (let i = 0; i < 60 * 3; i++) {
      w.step(1 / 60, new Map([[a.id, cmd({ fire: true, aimYaw: 0 })]]));
      for (const e of w.takeEvents()) {
        if (e.type === 'hit' && e.soldierId === a.id && e.bare !== undefined) hits.push(e.bare);
      }
    }
    return hits;
  };

  it('a round that meets PLATE is not bare — sparks, not blood', () => {
    const hits = duel(200); // plate deep enough to survive the burst
    expect(hits.length, 'nobody got shot').toBeGreaterThan(0);
    expect(hits[0], 'the first round hit armor and still reported flesh').toBe(false);
  });

  it('a round that meets FLESH is bare — the armor was already gone', () => {
    const hits = duel(0);
    expect(hits.length, 'nobody got shot').toBeGreaterThan(0);
    expect(hits.every((b) => b), 'an unarmored victim reported plate').toBe(true);
  });

  it('the fact is read BEFORE damage resolves — armor stripped mid-burst still reports plate first', () => {
    const hits = duel(12); // one round's worth of plate, then flesh
    expect(hits[0], 'the plate round reported flesh').toBe(false);
    expect(hits.some((b) => b), 'the burst never reached flesh').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE ROLE SPLIT (Robert: "everybody is going after the flag... there's
// nobody really playing defense. They're letting people set up turrets").
// A team that all-rushes loses its flag to two men.
// ---------------------------------------------------------------------------
describe('bot roles', () => {
  const team = (w: World, t: 0 | 1) => {
    const pool: ClassId[] = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];
    return Array.from({ length: 12 }, (_, i) => w.addSoldier(`B${t}${i}`, pool[i % pool.length], t, 'bot'));
  };

  it('a real THIRD of the team holds home — never a naked flag stand', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    const squad = team(w, 0);
    const guards = squad.filter(guardsHome).length;
    expect(guards, `only ${guards}/12 defenders`).toBeGreaterThanOrEqual(3);
    expect(guards, `${guards}/12 defenders — nobody left to attack`).toBeLessThanOrEqual(7);
  });

  it('nobody is both a raider and a guard — the roles are disjoint', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    for (const s of team(w, 0)) expect(raidsFlags(s) && guardsHome(s), `${s.classId} is both`).toBe(false);
  });

  it('a defender makes an enemy nest by our flag his job', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    const squad = team(w, 0);
    const guard = squad.find(guardsHome)!;
    const ownFlag = w.mode.flags![0];
    // an enemy sentry digs in 8u off our flag stand
    const nestPos = { x: ownFlag.pos.x + 8, y: 0, z: ownFlag.pos.z };
    w.turrets.set(999, { id: 999, team: 1, pos: nestPos, yaw: 0, hp: 100, maxHp: 100, nextFireAt: 0, ownerId: -1, alive: true });
    const goal = objectiveFor(w, guard);
    expect(Math.hypot(goal.x - nestPos.x, goal.z - nestPos.z), 'the guard ignored the nest').toBeLessThan(2);
  });

  it('a bot with no soldier in front of him SHOOTS the nest', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    b.pos = { x: 0, y: 0, z: 0 };
    // clear ground + a lone enemy sentry 10u east, no soldiers anywhere
    const half = GRID / 2;
    for (let z = half - 6; z <= half + 6; z++) for (let x = half - 6; x <= half + 6; x++) w.map.grid[z * GRID + x] = 0;
    const nest = { id: 998, team: 1 as const, pos: { x: 10, y: 0, z: 0 }, yaw: 0, hp: 100, maxHp: 100, nextFireAt: 0, ownerId: -1, alive: true };
    w.turrets.set(998, nest);
    const before = nest.hp;
    for (let i = 0; i < 60 * 4; i++) w.step(1 / 60, new Map());
    expect(w.turrets.get(998)?.hp ?? 0, 'the nest was never answered').toBeLessThan(before);
  });
});

// ---------------------------------------------------------------------------
// SPACING (Robert: "they keep bunching up together") — a bot standing on a
// teammate's boots gets pushed apart by separation steering. One grenade
// should never delete a fireteam that walked in a knot.
// ---------------------------------------------------------------------------
describe('bot spacing', () => {
  it('a bot crowded by a teammate steers away from him', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const a = w.addSoldier('A', 'infantry', 0, 'bot');
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    a.pos = { x: 0, y: 0, z: 0 };
    b.pos = { x: 0, y: 0, z: 1 }; // breathing down A's neck
    const before = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
    for (let i = 0; i < 90; i++) w.step(1 / 60, new Map());
    const after = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
    expect(after, 'the pair should breathe apart').toBeGreaterThan(before + 0.8);
  });
});

// ---------------------------------------------------------------------------
// THE FLIGHT ECONOMY (Robert: "you can fly across the whole map without
// ever landing... regenerates too fast... they go too high"). Three rules:
// fuel only flows on the deck, a burned-dry tank latches until 35, and
// thrust fades into a soft ceiling. Fly, land, breathe.
// ---------------------------------------------------------------------------
describe('the flight economy', () => {
  const jumper = () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const s = w.addSoldier('J', 'jump', 0, 'human');
    s.pos = { x: 0, y: 0, z: 0 };
    return { w, s };
  };
  const hold = (w: World, s: { id: number }, sec: number, jump: boolean) => {
    const c = cmd({ jump });
    for (let i = 0; i < sec * 60; i++) w.step(1 / 60, new Map([[s.id, c]]));
  };

  it('no fuel in the sky — energy only regenerates on the ground', () => {
    const { w, s } = jumper();
    hold(w, s, 1.5, true);            // climb and burn
    expect(s.pos.y).toBeGreaterThan(1);
    const midair = s.energy;
    // hover phase: coast without thrusting — still airborne for a beat
    w.step(1 / 60, new Map([[s.id, cmd()]]));
    if (s.pos.y > 0.05) expect(s.energy).toBeLessThanOrEqual(midair + 0.01);
    // land and breathe — NOW it flows
    hold(w, s, 2.5, false);
    expect(s.pos.y).toBeLessThan(0.05);
    const grounded = s.energy;
    hold(w, s, 1, false);
    expect(s.energy).toBeGreaterThan(grounded);
  });

  it('a burned-dry tank LATCHES — no relight until 35', () => {
    const { w, s } = jumper();
    hold(w, s, 4, true);              // burn the full tank dry
    expect(s.jetSpent).toBe(true);
    hold(w, s, 1.2, false);           // land, recover a little (< 35)
    const before = s.pos.y;
    hold(w, s, 0.5, true);            // try to relight early
    expect(s.pos.y).toBeLessThan(Math.max(before, 0.05) + 2.5); // a hop at best, no flight
    hold(w, s, 2.5, false);           // recover past the latch
    expect(s.jetSpent).toBe(false);
    hold(w, s, 0.6, true);
    expect(s.pos.y).toBeGreaterThan(1); // airborne again
  });

  it('the sky has a soft ceiling — thrust fades, nobody moons out', () => {
    const { w, s } = jumper();
    s.energy = 100;
    hold(w, s, 3, true);
    expect(s.pos.y).toBeLessThan(12);
  });
});

// ---------------------------------------------------------------------------
// The reload. One rule the guard has to mean: "not already reloading" —
// NOT "the timer expired". The old time-based guard re-armed the reload on
// the exact frame it lapsed, before the refill could run, so any caller
// HOLDING reload (a net client with held state, a bot brain, a sim probe)
// re-started the reload forever and the weapon bricked. Shipped input only
// ever taps (oneShot / rising edge), which is why nobody bled from it.
// ---------------------------------------------------------------------------
describe('the reload', () => {
  const emptyGun = () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const s = w.addSoldier('R', 'infantry', 0, 'human');
    w.step(1 / 60, new Map()); // settle one tick — reloads mid-match, not at t=0
    const i = s.weaponIdx;
    const def = WEAPONS[s.weapons[i]];
    s.clip[i] = 0;
    s.reserve[i] = def.clip * 3;
    return { w, s, i, def };
  };

  it('a one-frame tap (real input) arms it and the clip fills on schedule', () => {
    const { w, s, i, def } = emptyGun();
    w.step(1 / 60, new Map([[s.id, cmd({ reload: true })]]));
    expect(s.reloadUntil).toBeGreaterThan(0);
    run(w, new Map([[s.id, cmd()]]), def.reloadTime + 0.1);
    expect(s.clip[i]).toBe(def.clip);
    expect(s.reloadUntil).toBe(0);
  });

  it('a HELD reload still refills — the re-arm can never outrun the refill', () => {
    const { w, s, i, def } = emptyGun();
    // hold the button across the whole window and beyond; before the fix
    // this looped forever ("NEVER >8s" on every marker in the live probe)
    run(w, new Map([[s.id, cmd({ reload: true })]]), def.reloadTime + 0.2);
    expect(s.clip[i], 'held reload bricked the weapon').toBe(def.clip);
    expect(s.reloadUntil).toBe(0);
  });

  it('holding reload on a full clip arms nothing', () => {
    const { w, s, i, def } = emptyGun();
    run(w, new Map([[s.id, cmd({ reload: true })]]), def.reloadTime + 0.2); // refill
    run(w, new Map([[s.id, cmd({ reload: true })]]), 0.5);                  // keep holding
    expect(s.clip[i]).toBe(def.clip);
    expect(s.reloadUntil).toBe(0);
  });

  it('mashing reload mid-cycle never stretches the timer — a reload is a promise', () => {
    const { w, s, def } = emptyGun();
    w.step(1 / 60, new Map([[s.id, cmd({ reload: true })]]));
    const due = s.reloadUntil;
    run(w, new Map([[s.id, cmd({ reload: true })]]), def.reloadTime * 0.5);
    expect(s.reloadUntil).toBe(due);
  });
});

describe('vehicles', () => {
  it('spawns vehicles on pads and lets soldiers drive them', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    expect(w.vehicles.size).toBe(24); // 11 motor-pool kinds (incl. the mech) + 1 emplacement, × 2 teams
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

  it('DEEP water blocks the tank; shallow fords; the skiff skims both', () => {
    expect(VEHICLES.skiff.speed).toBeGreaterThan(VEHICLES.tank.speed); // sanity
    // europa fronts raise the moat — guaranteed deep water hover can cross
    const m = generateMap(42, 'tdm', 'europa');
    let deepTile: { x: number; z: number } | null = null;
    for (let z = -95; z < 95 && !deepTile; z += 0.5)
      for (let x = -95; x < 95 && !deepTile; x += 0.5)
        if (isBlocked(m.grid, x, z, false) && !isBlocked(m.grid, x, z, true)) deepTile = { x, z };
    expect(deepTile).not.toBeNull(); // ground drowns where hover skims
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
    const seenCounts: number[] = [];
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

describe('protect the scientist (safehouse)', () => {
  it('generates a neighborhood with walkable centers and REAL front doors', () => {
    const m = generateMap(77, 'safehouse');
    expect(m.houses.length).toBeGreaterThanOrEqual(10);
    for (const h of m.houses) {
      expect(isBlocked(m.grid, h.center.x, h.center.z)).toBe(false);
      // the doorway is a DOOR now (E opens it, the horde breaks it), so the
      // recorded door position must be an actual door tile — not a wall
      const tx = Math.floor((h.door.x + WORLD / 2) / TILE);
      const tz = Math.floor((h.door.z + WORLD / 2) / TILE);
      expect(m.grid[tz * GRID + tx], `house ${h.id} front door`).toBe(T_DOOR);
    }
    // squad support only: one ambulance + two emplacement guns at the command post
    expect(m.vehiclePads.length).toBe(3);
    expect(m.vehiclePads.every((p) => p.kind === 'ambulance' || p.kind === 'emplacement')).toBe(true);
  });

  it('hides the scientist in a house at match start', () => {
    const w = new World({ seed: 9, mode: 'safehouse' });
    const sci = w.soldiers.get(w.mode.scientistId!)!;
    expect(sci.kind).toBe('scientist');
    expect(sci.alive).toBe(true);
    const inAHouse = w.map.houses.some((h) => Math.hypot(h.center.x - sci.pos.x, h.center.z - sci.pos.z) < 2);
    expect(inAHouse).toBe(true);
  });

  it('raises the alert when a zombie gets eyes on him, and decays it after the memory window', () => {
    const w = new World({ seed: 9, mode: 'safehouse' });
    const a = w.addSoldier('A', 'heavy', 0, 'human');
    a.pos = { ...w.map.basePos[0] };
    const sci = w.soldiers.get(w.mode.scientistId!)!;
    const z = w.addZombie('zombie', { x: sci.pos.x + 3, y: 0, z: sci.pos.z });
    w.step(1 / 60, new Map());
    expect(w.mode.alert).toBe(true);
    // kill the witness; the trail should go cold after ~12s
    w.damageSoldier(z, 9999, a.id, 'ar606');
    run(w, new Map(), 13);
    expect(w.mode.alert).toBe(false);
  });

  it('the horde converges on the scientist while alerted', () => {
    const w = new World({ seed: 9, mode: 'safehouse' });
    const a = w.addSoldier('A', 'heavy', 0, 'human');
    a.pos = { ...w.map.basePos[0] };
    const sci = w.soldiers.get(w.mode.scientistId!)!;
    w.mode.alertUntil = 9999; // force the alert
    const z = w.addZombie('zombie', { x: sci.pos.x + 25, y: 0, z: sci.pos.z + 25 });
    const d0 = Math.hypot(z.pos.x - sci.pos.x, z.pos.z - sci.pos.z);
    run(w, new Map(), 4);
    if (z.alive) {
      const d1 = Math.hypot(z.pos.x - sci.pos.x, z.pos.z - sci.pos.z);
      expect(d1).toBeLessThan(d0);
    }
  });

  it('E toggles escort and the scientist follows', () => {
    const w = new World({ seed: 9, mode: 'safehouse' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const sci = w.soldiers.get(w.mode.scientistId!)!;
    a.pos = { x: sci.pos.x + 1.5, y: 0, z: sci.pos.z };
    w.step(1 / 60, new Map([[a.id, cmd({ use: true })]]));
    expect(sci.botTargetId).toBe(a.id);
    // walk away; he should trail along
    a.pos = { x: sci.pos.x + 12, y: 0, z: sci.pos.z };
    const before = { ...sci.pos };
    run(w, new Map(), 2);
    const moved = Math.hypot(sci.pos.x - before.x, sci.pos.z - before.z);
    expect(moved).toBeGreaterThan(3);
  });

  it('scientist death ends the match as a loss', () => {
    const w = new World({ seed: 9, mode: 'safehouse' });
    w.addSoldier('A', 'infantry', 0, 'human');
    const sci = w.soldiers.get(w.mode.scientistId!)!;
    w.damageSoldier(sci, 9999, sci.id, 'zombie_claw');
    w.step(1 / 60, new Map());
    expect(w.mode.over).toBe(true);
    expect(w.mode.winner).toBe(1);
  });

  it('surviving the evac countdown wins the match', () => {
    const w = new World({ seed: 9, mode: 'safehouse' });
    w.addSoldier('A', 'infantry', 0, 'human');
    w.mode.timeLeft = 0.05;
    run(w, new Map(), 0.2);
    expect(w.mode.over).toBe(true);
    expect(w.mode.winner).toBe(0);
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

describe('sci-fi kit', () => {
  it('pathfinder plants a warp pair and E teleports between them', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const p = w.addSoldier('P', 'pathfinder', 0, 'human');
    p.pos = { x: 0, y: 0, z: 0 };
    p.energy = 100;
    w.step(1 / 60, new Map([[p.id, cmd({ ability: true })]])); // plant ALPHA
    p.pos = { x: 30, y: 0, z: 10 };
    p.energy = 100;
    p.nextAbilityAt = 0;
    w.step(1 / 60, new Map([[p.id, cmd({ ability: true })]])); // plant BETA
    const types = [...w.gadgets.values()].map((g) => g.type).sort();
    expect(types).toEqual(['warpA', 'warpB']);
    // stand on BETA, warp to ALPHA
    w.step(1 / 60, new Map([[p.id, cmd({ use: true })]]));
    expect(Math.hypot(p.pos.x - 0, p.pos.z - 0)).toBeLessThan(3);
  });

  it('jump gates teleport soldiers walking into them', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    expect(w.map.gates.length).toBeGreaterThan(0);
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    const gate = w.map.gates[0];
    s.pos = { ...gate.a };
    w.step(1 / 60, new Map());
    expect(Math.hypot(s.pos.x - gate.b.x, s.pos.z - gate.b.z)).toBeLessThan(3);
  });

  it('grav-lift pads launch soldiers', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    expect(w.map.pads.length).toBeGreaterThan(0);
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    const pad = w.map.pads[0];
    s.pos = { ...pad.pos };
    w.step(1 / 60, new Map());
    expect(s.vel.y).toBeGreaterThan(5);
    expect(Math.hypot(s.pushX, s.pushZ)).toBeGreaterThan(10);
  });

  it('impulse cannon knocks targets back', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const p = w.addSoldier('P', 'pathfinder', 0, 'human');
    const victim = w.addSoldier('V', 'infantry', 1, 'human');
    p.pos = { x: 0, y: 0, z: 0 };
    victim.pos = { x: 8, y: 0, z: 0 };
    const hold = () => { victim.pos.z = 0; }; // keep on the firing line
    const cmds = new Map([[p.id, cmd({ fire: true, aimYaw: 0 })]]);
    for (let i = 0; i < 90; i++) { hold(); w.step(1 / 60, cmds); if (victim.pushX > 0) break; }
    expect(victim.pushX).toBeGreaterThan(5);
  });

  it('EMP stuns enemy vehicles', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const g = w.addSoldier('G', 'ghost', 0, 'human');
    const v = [...w.vehicles.values()].find((x) => x.team === 1)!;
    g.pos = { x: v.pos.x - 5, y: 0, z: v.pos.z };
    w.empBlast(v.pos, 0, g.id);
    expect(v.stunnedUntil).toBeGreaterThan(w.time);
  });

  it('recon drone pings enemies — even cloaked infiltrators', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const g = w.addSoldier('G', 'ghost', 0, 'human');
    const spy = w.addSoldier('S', 'infiltrator', 1, 'human');
    g.pos = { x: 0, y: 0, z: 0 };
    g.energy = 100;
    spy.pos = { x: 5, y: 0, z: 0 };
    spy.cloaked = true;
    w.step(1 / 60, new Map([[g.id, cmd({ ability: true })]]));
    w.step(1 / 60, new Map());
    expect(w.pinged.has(spy.id)).toBe(true);
  });

  it('shield dome absorbs enemy projectiles until it breaks', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const h = w.addSoldier('H', 'heavy', 0, 'human');
    const shooter = w.addSoldier('E', 'infantry', 1, 'human');
    h.pos = { x: 0, y: 0, z: 0 };
    h.energy = 100;
    w.step(1 / 60, new Map([[h.id, cmd({ ability: true })]])); // raise dome
    const dome = [...w.gadgets.values()].find((x) => x.type === 'shield')!;
    expect(dome).toBeTruthy();
    shooter.pos = { x: 12, y: 0, z: 0 };
    const hpBefore = h.hp;
    const domeBefore = dome.hp;
    const cmds = new Map([[shooter.id, cmd({ fire: true, aimYaw: Math.PI })]]);
    run(w, cmds, 3);
    expect(h.hp).toBe(hpBefore);          // trooper untouched inside the dome
    expect(dome.hp).toBeLessThan(domeBefore); // dome ate the rounds
  });

  it('orbital designator calls down a devastating strike after 3s', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    const victim = w.addSoldier('V', 'heavy', 1, 'human');
    s.pos = { x: 0, y: 0, z: 0 };
    s.orbitals = 1;
    victim.pos = { x: 14, y: 0, z: 0 };
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimYaw: 0 })]]));
    // beacon flies, lands, arms 3s, fires
    let struck = false;
    for (let i = 0; i < 60 * 6 && !struck; i++) {
      victim.pos = { x: 14, y: 0, z: 0 };
      victim.hp = victim.maxHp;
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) if (e.type === 'orbital_strike') struck = true;
      if (struck) break;
    }
    expect(struck).toBe(true);
  });

  it('phase stalkers blink through walls toward prey', () => {
    const w = new World({ seed: 21, mode: 'horde' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    a.pos = { ...w.map.hillPos };
    // stalker on the other side of whatever cover exists, 20 units out
    const z = w.addZombie('stalker', { x: a.pos.x + 20, y: 0, z: a.pos.z });
    const d0 = Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z);
    let blinked = false;
    for (let i = 0; i < 60 * 5; i++) {
      a.hp = a.maxHp;
      a.pos = { ...w.map.hillPos };
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) if (e.type === 'blink') blinked = true;
    }
    const d1 = Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z);
    expect(blinked).toBe(true);
    expect(d1).toBeLessThan(d0);
  });

  it('supply pods land and drop one-shot loot', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    w.nextPodAt = 0.5;
    const before = w.pickups.size;
    let landed = false;
    for (let i = 0; i < 60 * 5 && !landed; i++) {
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) if (e.type === 'pod_landed') landed = true;
    }
    expect(landed).toBe(true);
    expect(w.pickups.size).toBe(before + 3);
    void a;
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

  it('survives wire quantization: ints exact, floats within 1mm, Infinity intact', () => {
    const w = new World({ seed: 5, mode: 'conquest' });
    w.addSoldier('A', 'medic', 0, 'human');
    w.addSoldier('B', 'heavy', 1, 'bot');
    run(w, new Map(), 2);
    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, []), wireRound));

    const w2 = new World({ seed: 5, mode: 'conquest' });
    w2.puppet = true;
    w2.soldiers.clear();
    applySnapshot(w2, snap);
    const medic = [...w2.soldiers.values()].find((s) => s.classId === 'medic')!;
    expect(medic.reserve[1]).toBe(Infinity);
    for (const s of w.soldiers.values()) {
      const p = w2.soldiers.get(s.id)!;
      expect(p.pos.x).toBeCloseTo(s.pos.x, 3);
      expect(p.pos.z).toBeCloseTo(s.pos.z, 3);
      expect(p.clip[0]).toBe(s.clip[0]); // ammo counts must never drift
      expect(p.hp).toBeCloseTo(s.hp, 3);
    }
    expect(w2.time).toBeCloseTo(w.time, 3);
  });
});
