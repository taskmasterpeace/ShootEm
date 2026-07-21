// ---------------------------------------------------------------------------
// W3.10 — IRON EATERS FINISHED. The scrap swarm's two elders get their
// signatures: the WEAVER is the armorer (pulses fresh plate onto nearby iron,
// never itself, never past the forged cap) and the RAVAGER is the wrecker
// (slow until it isn't — a 6-14u mark triggers the RUSH, contact SLAMS a 3u
// shockwave that shoves flesh and EATS hulls). And every iron eater wears a
// SERIAL DESIGNATION (LOOM-01, WRECK-02) — machine to the last.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { IRON_STATS } from '../src/sim/data';
import { T_OPEN, TILE, WORLD as WS, GRID } from '../src/sim/map';
import { World } from '../src/sim/world';

const tileIdx = (x: number, z: number) =>
  Math.floor((z + WS / 2) / TILE) * GRID + Math.floor((x + WS / 2) / TILE);

function arena() {
  const w = new World({ seed: 5, mode: 'tdm', matchMinutes: 10 });
  for (let x = -20; x <= 20; x += 1) for (let z = -8; z <= 8; z += 3) w.map.grid[tileIdx(x, z)] = T_OPEN;
  return w;
}

describe('W3.10 — the iron eaters finished', () => {
  it('iron wears serial designations; zeds keep their species', () => {
    const w = arena();
    const lm = w.addIronEater('weaver', { x: 0, y: 0, z: 0 });
    const wk = w.addIronEater('ravager', { x: 2, y: 0, z: 0 });
    const zd = w.addZombie('zombie', { x: 4, y: 0, z: 0 });
    expect(lm.name).toMatch(/^LOOM-\d\d$/);
    expect(wk.name).toMatch(/^WRECK-\d\d$/);
    expect(zd.name).toBe('Zombie');
  });

  it('the WEAVER pulses plate onto hurt iron — never past the forged cap', () => {
    const w = arena();
    const lm = w.addIronEater('weaver', { x: 0, y: 0, z: 0 });
    const rat = w.addIronEater('scraprat', { x: 3, y: 0, z: 0 });
    rat.armor = 5; // chewed up
    const cap = IRON_STATS.scraprat.plate;
    lm.alive = true; rat.alive = true;
    // a few seconds of ticks: pulses land every ~4s
    for (let i = 0; i < 60 * 9; i++) w.step(1 / 60, new Map());
    expect(rat.armor, 'the swarm armorer mended him').toBeGreaterThan(5);
    expect(rat.armor, 'never past the cap').toBeLessThanOrEqual(cap);
    expect(lm.armor, 'the weaver never weaves itself').toBeLessThanOrEqual(IRON_STATS.weaver.plate);
  });

  it('the RAVAGER rushes a mark in the 6-14u band and SLAMS a hull for real damage', () => {
    const w = arena();
    const wk = w.addIronEater('ravager', { x: -10, y: 0, z: 0 });
    const hull = w.spawnVehicle('buggy', 0, { x: 0, y: 0, z: 0 });
    const hp0 = hull.hp;
    let rushed = false;
    for (let i = 0; i < 60 * 6; i++) {
      w.step(1 / 60, new Map());
      if (wk.dashUntil !== undefined && w.time < wk.dashUntil) rushed = true;
      if (hp0 - hull.hp >= 70) break;
    }
    expect(rushed, 'the charge window opened').toBe(true);
    expect(hp0 - hull.hp, 'the slam EATS hulls — one hit bites ≥70 through soak').toBeGreaterThanOrEqual(70);
    const evs = w.takeEvents().filter((e) => e.type === 'ravage');
    expect(evs.length, 'the slam announced itself').toBeGreaterThan(0);
  });

  it('the slam shoves flesh — a soldier in the shockwave is hit and thrown', () => {
    const w = arena();
    const wk = w.addIronEater('ravager', { x: -10, y: 0, z: 0 });
    const man = w.addSoldier('Mark', 'infantry', 0, 'human');
    man.pos = { x: 0, y: 0, z: 0 }; man.protectedUntil = 0; man.hp = 100;
    let flew = false;
    for (let i = 0; i < 60 * 6 && !flew; i++) {
      w.step(1 / 60, new Map());
      if (man.hp < 100 && Math.abs(man.pushX) > 3) flew = true;
    }
    expect(flew, 'hit for 30 and shoved off his feet').toBe(true);
    expect(wk.dashUntil === undefined || w.time >= wk.dashUntil, 'the slam ends the rush').toBe(true);
  });
});
