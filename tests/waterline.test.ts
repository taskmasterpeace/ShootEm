// ---------------------------------------------------------------------------
// The waterline: shallow water WADES, deep water SWIMS (slow, defenseless),
// boats own the channel, and the moat map splits the war at the fords.
// Plus: the districts (commercial/industrial grammars) and TRUE roofs.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { BUILDINGS, generateDistrict, generateHouse, stampBuilding, stencilConnected, type DistrictType, type StampCtx } from '../src/sim/buildings';
import {
  GRID, T_DEEP, T_METAL, T_WATER, TILE, WORLD, generateMap, isBlocked,
} from '../src/sim/map';
import { Rng } from '../src/sim/rng';
import { VEHICLES } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;

function paint(w: World, cx: number, cz: number, r: number, tile: number) {
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) w.map.grid[(cz + dz) * GRID + cx + dx] = tile;
}

function runOn(tile: number): { dist: number; s: import('../src/sim/types').Soldier; w: World } {
  const w = new World({ seed: 3, mode: 'tdm' });
  const cx = Math.floor(GRID / 2) + 10, cz = Math.floor(GRID / 2);
  paint(w, cx, cz, 6, 0);
  paint(w, cx, cz, 4, tile);
  const s = w.addSoldier('R', 'infantry', 0, 'human');
  s.pos = { x: toWorld(cx), y: 0, z: toWorld(cz) };
  const x0 = s.pos.x;
  for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
  return { dist: s.pos.x - x0, s, w };
}

describe('the waterline — wade, then swim', () => {
  it('shallow slows you; deep is a crawl; land is land', () => {
    const land = runOn(0).dist;
    const wade = runOn(T_WATER).dist;
    const swim = runOn(T_DEEP).dist;
    expect(wade).toBeLessThan(land * 0.65);
    expect(swim).toBeLessThan(wade * 0.8);
    expect(swim).toBeGreaterThan(0.5); // you DO move — slowly
  });

  it('a swimmer cannot fire, throw, or jump; a wader fights fine', () => {
    const deep = runOn(T_DEEP);
    const clipBefore = deep.s.clip[0];
    deep.w.step(1 / 60, new Map([[deep.s.id, cmd({ fire: true, jump: true })]]));
    expect(deep.s.clip[0]).toBe(clipBefore); // trigger dead in the deep
    expect(deep.s.vel.y).toBe(0);            // nothing to jump against
    const shallow = runOn(T_WATER);
    shallow.w.step(1 / 60, new Map([[shallow.s.id, cmd({ fire: true })]]));
    expect(shallow.s.clip[0]).toBeLessThan(clipBefore); // wading: guns up
  });

  it('wheels ford shallow but drown at the deep line; hover crosses both', () => {
    const g = new Uint8Array(GRID * GRID);
    const x = toWorld(50), z = toWorld(50);
    g[50 * GRID + 50] = T_WATER;
    expect(isBlocked(g, x, z)).toBe(false);
    expect(isBlocked(g, x, z, true)).toBe(false);
    g[50 * GRID + 50] = T_DEEP;
    expect(isBlocked(g, x, z)).toBe(true);   // wheels/tracks/boots-as-vehicles: no
    expect(isBlocked(g, x, z, true)).toBe(false); // hover: yes
  });
});

describe('the Pike gunboat — the moat has a landlord', () => {
  it('europa fronts raise the moat: deep channel, shallow fords, boat pads', () => {
    const m = generateMap(11, 'tdm', 'europa');
    const half = GRID / 2;
    let deep = 0, fordShallow = 0;
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const d = Math.hypot(x - half + 0.5, z - half + 0.5);
        if (m.grid[z * GRID + x] === T_DEEP && d > 7 && d < 15) deep++;
        if (m.grid[z * GRID + x] === T_WATER && Math.abs(x - half + 0.5) <= 1.2 && d > 7 && d < 15) fordShallow++;
      }
    }
    expect(deep).toBeGreaterThan(120);        // the channel is REAL
    expect(fordShallow).toBeGreaterThan(8);   // and the fords cross it
    const boats = m.vehiclePads.filter((p) => p.kind === 'boat');
    expect(boats.length).toBe(2);
    expect(new Set(boats.map((b) => b.team)).size).toBe(2);
  });

  it('a bot drives the boat ON the water and never beaches it', () => {
    const w = new World({ seed: 11, mode: 'tdm', theme: 'europa' });
    const boat = [...w.vehicles.values()].find((v) => v.kind === 'boat' && v.team === 0);
    expect(boat).toBeTruthy();
    const b = w.addSoldier('Sailor', 'infantry', 0, 'bot');
    b.pos = { ...boat!.pos };
    boat!.seats[0] = b.id;
    b.vehicleId = boat!.id;
    b.seat = 0;
    let moved = 0;
    let wetTicks = 0, ticks = 0;
    const start = { ...boat!.pos };
    for (let i = 0; i < 60 * 12; i++) {
      w.step(1 / 60, new Map());
      w.takeEvents();
      if (b.vehicleId !== boat!.id) break; // bailed (allowed — stuck recovery)
      ticks++;
      const t = w.map.grid[Math.floor((boat!.pos.z + WORLD / 2) / TILE) * GRID + Math.floor((boat!.pos.x + WORLD / 2) / TILE)];
      if (t === T_WATER || t === T_DEEP) wetTicks++;
      moved = Math.max(moved, Math.hypot(boat!.pos.x - start.x, boat!.pos.z - start.z));
    }
    expect(moved).toBeGreaterThan(6);               // it sails
    expect(wetTicks / Math.max(ticks, 1)).toBeGreaterThan(0.95); // and stays wet
  });

  it('boat def: water-locked, armed, crewed', () => {
    expect(VEHICLES.boat.boat).toBe(true);
    expect(VEHICLES.boat.weapon).toBe('boat_mg');
    expect(VEHICLES.boat.seats).toBe(3);
  });
});

const DISTRICTS: DistrictType[] = ['storefront', 'market', 'office', 'factory', 'depot_hall'];

describe('the districts — commerce and industry have their own grammars', () => {
  it('every district layout is legal, connected, and true to its kind (20 seeds x 5)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const type of DISTRICTS) {
        const def = generateDistrict(new Rng(seed * 13 + DISTRICTS.indexOf(type)), type);
        expect(stencilConnected(def), `${type} seed ${seed}:\n${def.rows.join('\n')}`).toBe(true);
        const all = def.rows.join('');
        if (type === 'storefront') {
          expect(def.kind).toBe('commercial');
          // the GLASS FRONT: the south wall is mostly window
          const front = def.rows[def.rows.length - 1];
          expect(front.split('').filter((c) => c === 'S').length).toBeGreaterThanOrEqual(front.length - 4);
        }
        if (type === 'market') expect(all.split('C').length - 1).toBeGreaterThanOrEqual(8); // stall rows
        if (type === 'office') expect(all.split('D').length - 1).toBeGreaterThanOrEqual(4); // room doors
        if (type === 'factory' || type === 'depot_hall') {
          expect(def.kind).toBe('industrial');
          expect(all.includes('M')).toBe(true); // metal shells — the breacher sparks
        }
      }
    }
  });

  it('some office blocks rise two storeys with a stairwell ladder', () => {
    let twoStorey = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const def = generateDistrict(new Rng(seed), 'office');
      if (def.floors === 2) {
        twoStorey++;
        expect(def.rows2).toBeDefined();
        expect(def.rows.join('').includes('L')).toBe(true);
      }
    }
    expect(twoStorey).toBeGreaterThanOrEqual(3);
  });
});

describe('roofs tell the truth', () => {
  const stamp = (def: Parameters<typeof stampBuilding>[1]) => {
    const ctx: StampCtx = {
      grid: new Uint8Array(GRID * GRID), grid2: new Uint8Array(GRID * GRID),
      props: [], pickups: [], houses: [], claims: [], rng: new Rng(1),
    };
    expect(stampBuilding(ctx, def, 40, 40)).toBe(true);
    return ctx.houses[0];
  };

  it('ruins go roofless; shops wear parapets; industry vents; rect houses gable', () => {
    expect(stamp(BUILDINGS.find((b) => b.id === 'ruin')!).roof).toBe('none');
    expect(stamp(generateDistrict(new Rng(2), 'storefront')).roof).toBe('parapet');
    expect(stamp(generateDistrict(new Rng(2), 'factory')).roof).toBe('vents');
    expect(stamp(generateHouse(new Rng(2), 'bungalow')).roof).toBe('gable');
  });

  it('an L-house roof follows the L — flat, with a footprint mask, not a rect lid', () => {
    const h = stamp(BUILDINGS.find((b) => b.id === 'l_house')!);
    expect(h.roof).toBe('flat');
    expect(h.maskRows).toBeDefined();
    // the top row covers fewer tiles than the bottom row — the L is real
    const bits = (n: number) => n.toString(2).split('').filter((c) => c === '1').length;
    expect(bits(h.maskRows![0])).toBeLessThan(bits(h.maskRows![h.maskRows!.length - 1]));
  });
});
