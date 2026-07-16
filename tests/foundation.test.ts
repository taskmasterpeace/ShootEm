// ---------------------------------------------------------------------------
// The map-foundation pass (35B): firing slits, the HOP vault, the surface
// layer, huts with stuff inside, and the 300u standard front.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  GRID, S_GRASS, S_ICE, S_MUD, S_PLATE, SURF_SOLDIER, SURF_TRACKS, SURF_WHEELS,
  T_COVER, T_SLIT, T_WATER, TILE, WORLD, blocksShot, generateMap, houseAt, isBlocked, losClear, surfaceAt,
} from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

describe('the map-foundation pass (35B)', () => {
  it('standard fronts are 300 units (33C)', () => {
    expect(TILE).toBe(3);
    expect(WORLD).toBe(300);
  });

  it('firing slits: movement blocked always, shots pass ONLY in the 1.2–1.8 band', () => {
    const g = new Uint8Array(GRID * GRID);
    const tx = 50, tz = 50;
    g[tz * GRID + tx] = T_SLIT;
    const wx = (tx + 0.5) * TILE - WORLD / 2, wz = (tz + 0.5) * TILE - WORLD / 2;
    expect(isBlocked(g, wx, wz)).toBe(true);            // you cannot walk a slit
    expect(blocksShot(g, wx, wz, 1.4)).toBe(false);     // muzzle height passes
    expect(blocksShot(g, wx, wz, 1.2)).toBe(false);     // band edge
    expect(blocksShot(g, wx, wz, 0.6)).toBe(true);      // below the band: wall
    expect(blocksShot(g, wx, wz, 2.5)).toBe(true);      // above the band: wall
    // line of sight at eye height sees straight through the slit
    expect(losClear(g, { x: wx - 9, y: 0, z: wz }, { x: wx + 9, y: 0, z: wz }, 1.4)).toBe(true);
    // a crawl-height ray does not
    expect(losClear(g, { x: wx - 9, y: 0, z: wz }, { x: wx + 9, y: 0, z: wz }, 0.6)).toBe(false);
  });

  it('the HOP vault: a soldier mid-hop crosses cover; grounded he does not; slits never', () => {
    const w = new World({ seed: 33, mode: 'tdm' });
    const s = w.addSoldier('Vaulter', 'infantry', 0, 'human');
    // stamp a cover line at the hill and charge it
    const tz = Math.floor(GRID / 2), tx0 = Math.floor(GRID / 2) + 5;
    for (let dz = -3; dz <= 3; dz++) {
      w.map.grid[(tz + dz) * GRID + tx0] = T_COVER;
      for (let dx = -4; dx <= 4; dx++) if (dx !== 0) w.map.grid[(tz + dz) * GRID + tx0 + dx] = 0;
    }
    const wallX = (tx0 + 0.5) * TILE - WORLD / 2;
    // grounded: blocked
    s.pos = { x: wallX - 2.2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 };
    s.vel = { x: 8, y: 0, z: 0 };
    w.step(1 / 60, new Map());
    expect(s.pos.x).toBeLessThan(wallX - 1); // stopped at the sandbags
    // mid-hop: vaults
    s.pos = { x: wallX - 1.4, y: 1.1, z: (tz + 0.5) * TILE - WORLD / 2 };
    s.vel = { x: 9, y: 0, z: 0 };
    for (let i = 0; i < 30; i++) { s.pos.y = 1.1; s.vel.x = 9; w.step(1 / 60, new Map()); }
    expect(s.pos.x).toBeGreaterThan(wallX); // over the top
    // slits are never vaultable
    w.map.grid[tz * GRID + tx0] = T_SLIT;
    s.pos = { x: wallX - 1.4, y: 1.1, z: (tz + 0.5) * TILE - WORLD / 2 };
    for (let i = 0; i < 30; i++) { s.pos.y = 1.1; s.vel.x = 9; w.step(1 / 60, new Map()); }
    expect(s.pos.x).toBeLessThan(wallX - 0.5);
  });

  it('the surface layer deals per theme, muddies the waterline, and the tables fork by locomotion (§8.6)', () => {
    const sav = generateMap(7, 'tdm', 'savanna');
    const tri = generateMap(7, 'tdm', 'triton');
    const star = generateMap(7, 'tdm', 'starship');
    const count = (m: typeof sav, s: number) => m.surface.reduce((n, v) => n + (v === s ? 1 : 0), 0);
    expect(count(sav, S_GRASS)).toBeGreaterThan(GRID * GRID * 0.5);
    expect(count(tri, S_ICE)).toBeGreaterThan(GRID * GRID * 0.5);
    expect(count(star, S_PLATE)).toBeGreaterThan(GRID * GRID * 0.5);
    // savanna has ponds — their margins are mud
    let mudNextToWater = false;
    for (let i = GRID; i < GRID * GRID - GRID && !mudNextToWater; i++) {
      if (sav.surface[i] === S_MUD && (sav.grid[i + 1] === T_WATER || sav.grid[i - 1] === T_WATER ||
          sav.grid[i + GRID] === T_WATER || sav.grid[i - GRID] === T_WATER)) mudNextToWater = true;
    }
    expect(mudNextToWater).toBe(true);
    // wheels hate mud more than tracks; boots more than either ice
    expect(SURF_WHEELS[S_MUD]).toBeLessThan(SURF_TRACKS[S_MUD]);
    expect(SURF_SOLDIER[S_MUD]).toBeLessThan(1);
    expect(SURF_WHEELS[S_ICE]).toBeLessThan(1);
  });

  it('mud actually slows a soldier on the field', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    const runOn = (surf: number) => {
      const s = w.addSoldier(`R${surf}`, 'infantry', 0, 'human');
      s.pos = { x: 0, y: 0, z: 0 };
      // paint his lane
      for (let i = 0; i < GRID * GRID; i++) w.map.surface[i] = surf;
      const x0 = s.pos.x;
      for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
      return s.pos.x - x0;
    };
    const onGrass = runOn(S_GRASS);
    const inMud = runOn(S_MUD);
    expect(inMud).toBeLessThan(onGrass * 0.9);
  });

  it('every battlefield deals buildings from the library, with STUFF inside', () => {
    for (const seed of [7, 42]) {
      const m = generateMap(seed, 'tdm', 'savanna');
      expect(m.houses.length).toBeGreaterThanOrEqual(6); // 3 mirrored pairs
      let mapSlits = 0;
      for (const h of m.houses) {
        let interiorCover = 0, interiorPickup = 0;
        for (let z = h.tz; z < h.tz + h.th; z++)
          for (let x = h.tx; x < h.tx + h.tw; x++) {
            if (m.grid[z * GRID + x] === T_SLIT) mapSlits++;
            if (m.grid[z * GRID + x] === T_COVER && m.propCovered.includes(z * GRID + x)) interiorCover++;
          }
        for (const p of m.pickups) {
          if (houseAt(m.houses, p.pos.x, p.pos.z) === m.houses.indexOf(h)) interiorPickup++;
        }
        expect(interiorCover + interiorPickup).toBeGreaterThanOrEqual(1); // the indoors has stuff
      }
      // mirrored fairness: every building rect has a twin across the center line
      for (const h of m.houses) {
        const twin = m.houses.some((o) => o !== h && o.tz === h.tz && o.tw === h.tw && o.th === h.th &&
          o.tx === GRID - 1 - h.tx - h.tw);
        expect(twin, `building at (${h.tx},${h.tz}) has no mirror twin`).toBe(true);
      }
      // houseAt: center hits, open field misses
      expect(houseAt(m.houses, m.houses[0].center.x, m.houses[0].center.z)).toBe(0);
      expect(houseAt(m.houses, m.hillPos.x, m.hillPos.z)).toBe(-1);
    }
  });

  it('neighborhood houses gained rects, slits, and furniture too', () => {
    const m = generateMap(9, 'safehouse');
    expect(m.houses.length).toBeGreaterThan(6);
    for (const h of m.houses) expect(h.tw).toBeGreaterThan(0);
    const slitCount = m.grid.reduce((n, v) => n + (v === T_SLIT ? 1 : 0), 0);
    expect(slitCount).toBeGreaterThan(m.houses.length); // windows everywhere
    expect(surfaceAt(m.surface, m.hillPos.x, m.hillPos.z)).toBe(S_GRASS);
  });
});
