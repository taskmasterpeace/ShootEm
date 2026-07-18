import { afterEach, describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { WEAPONS } from '../src/sim/data';
import { GRID, TILE, WORLD, T_DOOR, T_WALL, T_METAL } from '../src/sim/map';
import type { PlayerCmd, Projectile } from '../src/sim/types';

// these tests mutate shared WEAPONS defs to arrange flags — reset after each so
// they never pollute another test (or file). The real per-LSW data lands later.
afterEach(() => {
  for (const id of ['rg2', 'lsw_pulse'] as const) {
    const w = WEAPONS[id] as { pierce?: number; pierceArmor?: boolean; ricochet?: number; charge?: unknown };
    w.pierce = undefined; w.pierceArmor = undefined; w.ricochet = undefined; w.charge = undefined;
  }
});

// a full player command with sensible defaults; override the fields a test cares about
function cmd(over: Partial<PlayerCmd> = {}): PlayerCmd {
  return {
    moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
    use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
    aimDist: 30, ...over,
  } as PlayerCmd;
}

// helper: launch a bare projectile aimed +x from origin
function shot(w: World, weapon: string, over: Partial<Projectile> = {}) {
  return w.launch({
    id: w.id(), weapon, ownerId: -1, team: 0,
    pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 60, y: 0, z: 0 },
    bornAt: w.time, ttl: 3, arc: false, ...over,
  } as Projectile);
}

describe('launch copies effect flags from the weapon def', () => {
  it('a pierce weapon hands its projectile the pierce count', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    (WEAPONS.lsw_pulse as { pierce?: number }).pierce = 3; // arrange
    const p = shot(w, 'lsw_pulse');
    expect(p.pierce).toBe(3);
  });

  it('defaults dmgMul to 1 on every round', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const p = shot(w, 'ar606');
    expect(p.dmgMul).toBe(1);
  });
});

describe('pierce passes through bodies', () => {
  it('a pierce:2 round damages three lined-up enemies before dying', () => {
    const w = new World({ seed: 2, mode: 'tdm' });
    // 'human' (not 'bot'): bots path/reposition on their own every tick, and
    // that drift compounds on BOTH axes — by the time the round would reach
    // the third body its z has wandered enough that the 2D hit-radius check
    // misses even when x lines up. 'human' targets take no autonomous input
    // (no cmds submitted below), so they hold the exact line the test sets
    // up — the same convention every other stationary-target test in this
    // suite uses (altfire/armor/ascendants tests, and Task 4's own victim).
    const foes = [3, 6, 9].map((x, i) => {
      const s = w.addSoldier(`F${i}`, 'infantry', 1, 'human');
      s.pos = { x, y: 0, z: 0 }; s.hp = 100; s.maxHp = 100; return s;
    });
    (WEAPONS.rg2 as { pierce?: number }).pierce = 2; // RG-2 rail
    // clear a straight lane so the generated map's terrain can't stop the round
    const tz = Math.floor((0 + WORLD / 2) / TILE);
    for (let x = -2; x <= 12; x++) w.map.grid[tz * GRID + Math.floor((x + WORLD / 2) / TILE)] = 0; // T_OPEN
    // vel 40 (~0.67u/60Hz step) so the round can't step OVER a body between
    // frames — this test proves pierce, not swept collision (fast rounds
    // tunnelling past a point-check is a separate, pre-existing limitation).
    w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 40, y: 0, z: 0 },
      bornAt: w.time, ttl: 3, arc: false } as Projectile);
    for (let i = 0; i < 40; i++) w.step(1 / 60, new Map());
    const hurt = foes.filter((s) => s.hp < 100).length;
    expect(hurt).toBe(3); // pierced two, died in/after the third
  });
});

describe('pierceArmor bypasses plate', () => {
  it('an AP round takes hp even when the victim is fully plated', () => {
    const w = new World({ seed: 3, mode: 'tdm' });
    const v = w.addSoldier('V', 'infantry', 1, 'human', { equipment: ['armor_vest'] });
    v.pos = { x: 4, y: 0, z: 0 };
    const hp0 = v.hp;
    const tz = Math.floor((0 + WORLD / 2) / TILE);
    for (let x = -2; x <= 8; x++) w.map.grid[tz * GRID + Math.floor((x + WORLD / 2) / TILE)] = 0; // clear the lane
    (WEAPONS.rg2 as { pierceArmor?: boolean }).pierceArmor = true;
    w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 40, y: 0, z: 0 },
      bornAt: w.time, ttl: 3, arc: false } as Projectile);
    for (let i = 0; i < 40; i++) { v.pos = { x: 4, y: 0, z: 0 }; v.vel = { x: 0, y: 0, z: 0 }; w.step(1 / 60, new Map()); }
    expect(v.hp).toBeLessThan(hp0); // flesh took it despite the vest
  });
});

describe('surface reactions (materials)', () => {
  // clear a straight lane on the mid row so generated terrain can't interfere
  const clearLane = (w: World): number => {
    const tz = Math.floor((0 + WORLD / 2) / TILE);
    for (let x = -2; x <= 20; x++) w.map.grid[tz * GRID + Math.floor((x + WORLD / 2) / TILE)] = 0;
    return tz;
  };

  it('a pierce round breaches a wood door and threads on', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const tz = clearLane(w);
    const tx = Math.floor((6 + WORLD / 2) / TILE);
    w.map.grid[tz * GRID + tx] = T_DOOR;
    (WEAPONS.rg2 as { pierce?: number }).pierce = 1;
    w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 40, y: 0, z: 0 },
      bornAt: w.time, ttl: 3, arc: false } as Projectile);
    let hitDoor = false;
    for (let i = 0; i < 24; i++) { w.step(1 / 60, new Map()); for (const e of w.takeEvents()) if (e.type === 'doorhit' || e.type === 'doorbreak') hitDoor = true; }
    expect(hitDoor).toBe(true); // penetrate chipped the door (routed to damageDoor) and threaded on
  });

  it('a plain round shreds a wood door on impact but masonry shrugs small arms', () => {
    const wd = new World({ seed: 6, mode: 'tdm' });
    const tzd = clearLane(wd);
    const dtx = Math.floor((6 + WORLD / 2) / TILE);
    wd.map.grid[tzd * GRID + dtx] = T_DOOR;
    wd.launch({ id: wd.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 40, y: 0, z: 0 },
      bornAt: wd.time, ttl: 3, arc: false } as Projectile);
    let hitDoor = false;
    for (let i = 0; i < 24; i++) { wd.step(1 / 60, new Map()); for (const e of wd.takeEvents()) if (e.type === 'doorhit' || e.type === 'doorbreak') hitDoor = true; }
    expect(hitDoor).toBe(true); // a plain round damages the wood door on impact

    const ww = new World({ seed: 6, mode: 'tdm' });
    const tzw = clearLane(ww);
    const wtx = Math.floor((6 + WORLD / 2) / TILE);
    ww.map.grid[tzw * GRID + wtx] = T_WALL;
    ww.launch({ id: ww.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 40, y: 0, z: 0 },
      bornAt: ww.time, ttl: 3, arc: false } as Projectile);
    for (let i = 0; i < 24; i++) ww.step(1 / 60, new Map());
    expect(ww.map.grid[tzw * GRID + wtx]).toBe(T_WALL); // masonry unbroken by small arms
  });

  it('ricochet rounds bank off metal instead of all dying on it', () => {
    let survived = 0;
    for (let n = 0; n < 10; n++) {
      const w = new World({ seed: 20 + n, mode: 'tdm' });
      const tz = clearLane(w);
      const mtx = Math.floor((7 + WORLD / 2) / TILE);
      w.map.grid[tz * GRID + mtx] = T_METAL; // a 1-tile metal strip: glancing hit on its face
      (WEAPONS.rg2 as { ricochet?: number }).ricochet = 2;
      const p = w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
        pos: { x: 0, y: 1.2, z: (tz + 0.5) * TILE - WORLD / 2 }, vel: { x: 60, y: 0, z: -6 },
        bornAt: w.time, ttl: 3, arc: false } as Projectile);
      for (let i = 0; i < 14; i++) w.step(1 / 60, new Map());
      if (w.projectiles.has(p.id)) survived++; // banked, still flying
    }
    expect(survived).toBeGreaterThan(0); // metal banks at least some rounds (0.8 chance, glancing)
  });
});

describe('charge scales the shot', () => {
  it('holds while winding up, then releases a fully-charged round', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.pos = { x: 0, y: 0, z: 0 }; s.yaw = 0;
    s.weapons = ['rg2']; s.weaponIdx = 0; s.clip = [999]; s.reserve = [999];
    (WEAPONS.rg2 as { charge?: { t: number; mul: number } }).charge = { t: 0.5, mul: 3 };
    const cmds = new Map([[s.id, cmd({ fire: true })]]);
    let firedBefore05 = 0, releasedMul: number | undefined;
    for (let i = 0; i < 45; i++) {
      const before = w.projectiles.size;
      w.step(1 / 60, cmds);
      for (const p of w.projectiles.values()) if (p.ownerId === s.id && releasedMul === undefined) releasedMul = p.dmgMul;
      if (w.time < 0.5 && w.projectiles.size > before) firedBefore05++;
    }
    expect(firedBefore05).toBe(0);   // nothing leaves the barrel while charging
    expect(releasedMul).toBe(3);     // the released bolt carries the full ×3
  });

  it('defaults dmgMul to 1 for a plain (uncharged) weapon', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.weapons = ['rg2']; s.weaponIdx = 0; s.clip = [999];
    const cmds = new Map([[s.id, cmd({ fire: true })]]);
    let mul: number | undefined;
    for (let i = 0; i < 6; i++) { w.step(1 / 60, cmds); for (const p of w.projectiles.values()) if (mul === undefined) mul = p.dmgMul; }
    expect(mul).toBe(1);
  });
});
