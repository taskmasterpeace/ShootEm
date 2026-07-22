import { describe, expect, it } from 'vitest';
import {
  S_GRASS,
  T_OPEN,
  T_WALL,
  houseAt,
  isBlocked,
  losClear,
  nearestOpenTile,
  surfaceAt,
  tileAt,
  type House,
} from '../src/sim/map';
import { allocateLayer, tileIndex, tileToWorld } from '../src/sim/map-geometry';
import { SoldierIndex } from '../src/sim/spatial';
import type { GameMap } from '../src/sim/map';
import type { PlayerCmd, Soldier, VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

function rectangularMap(): GameMap {
  const geometry = { cols: 200, rows: 300, tile: 3 };
  const open = allocateLayer(geometry, T_OPEN);
  return {
    seed: 77,
    theme: 'savanna',
    geometry,
    grid: open,
    grid2: allocateLayer(geometry),
    surface: allocateLayer(geometry),
    basePos: [{ x: -250, y: 0, z: 0 }, { x: 250, y: 0, z: 0 }],
    spawns: [[{ x: -250, y: 0, z: 0 }], [{ x: 250, y: 0, z: 0 }]],
    flagPos: [{ x: -250, y: 0, z: 0 }, { x: 250, y: 0, z: 0 }],
    hillPos: { x: 0, y: 0, z: 0 },
    controlPoints: [],
    vehiclePads: [],
    pickups: [],
    props: [],
    zombieSpawns: [],
    houses: [],
    gates: [],
    pads: [],
    propCovered: [],
  };
}

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0,
  moveZ: 0,
  aimYaw: 0,
  fire: false,
  altFire: false,
  jump: false,
  use: false,
  ability: false,
  reload: false,
  grenade: false,
  weaponSlot: -1,
  ...over,
});

function driven(world: World, kind: VehicleKind, x: number) {
  const pilot = world.addSoldier('Pilot', 'infantry', 0, 'human');
  const vehicle = world.spawnVehicle(kind, 0, { x, y: 0, z: 0 });
  vehicle.alive = true;
  vehicle.seats[0] = pilot.id;
  vehicle.spoolUntil = 0;
  pilot.vehicleId = vehicle.id;
  pilot.seat = 0;
  pilot.enteredVehicleAt = -10;
  return { pilot, vehicle };
}

function run(world: World, id: number, input: PlayerCmd, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) world.step(1 / 60, new Map([[id, input]]));
}

describe('rectangular runtime geometry', () => {
  const geometry = { cols: 200, rows: 300, tile: 3 } as const;
  const grid = allocateLayer(geometry, T_OPEN);
  grid[tileIndex(geometry, 199, 299)] = T_WALL;

  it('terrain queries use map extents instead of the 100x100 compatibility grid', () => {
    expect(tileAt(grid, 298.5, 448.5, geometry)).toBe(T_WALL);
    expect(isBlocked(grid, 298.5, 448.5, false, geometry)).toBe(true);
    expect(tileAt(grid, 0, 400, geometry)).toBe(T_OPEN);
  });

  it('the spatial index finds soldiers near the far rectangular edge', () => {
    const index = new SoldierIndex(geometry);
    const soldier = {
      id: 77,
      team: 0,
      pos: { x: 250, y: 0, z: 400 },
      alive: true,
    } as Soldier;
    const distant = {
      id: 78,
      team: 0,
      pos: { x: 250, y: 0, z: 200 },
      alive: true,
    } as Soldier;
    index.rebuild(new Map([[soldier.id, soldier], [distant.id, distant]]));
    expect(index.near(0, 250, 400, 5, [])).toEqual([soldier]);
  });

  it('surface, house, escape, and sight queries share rectangular coordinates', () => {
    const surface = allocateLayer(geometry);
    surface[tileIndex(geometry, 150, 250)] = S_GRASS;
    const far = tileToWorld(geometry, 150, 250);
    expect(surfaceAt(surface, far.x, far.z, geometry)).toBe(S_GRASS);

    const house: House = {
      id: 1,
      center: far,
      door: far,
      tx: 149,
      tz: 249,
      tw: 3,
      th: 3,
    };
    expect(houseAt([house], far.x, far.z, geometry)).toBe(0);

    const boxed = allocateLayer(geometry, T_WALL);
    const open = tileToWorld(geometry, 151, 250);
    boxed[tileIndex(geometry, 151, 250)] = T_OPEN;
    expect(nearestOpenTile(boxed, far.x, far.z, 2, geometry)).toEqual({ x: open.x, z: open.z });

    const sight = allocateLayer(geometry, T_OPEN);
    sight[tileIndex(geometry, 151, 250)] = T_WALL;
    const beyond = tileToWorld(geometry, 152, 250);
    expect(losClear(sight, far, beyond, 1.4, geometry)).toBe(false);
  });

  it('World sizes its authoritative spatial index from the selected map', () => {
    const world = new World({ seed: 77, mode: 'tdm', botsPerTeam: 0, map: rectangularMap() });
    const far = world.addSoldier('Far', 'infantry', 0, 'human');
    const distant = world.addSoldier('Distant', 'infantry', 0, 'human');
    far.pos = { x: 250, y: 0, z: 400 };
    distant.pos = { x: 250, y: 0, z: 200 };
    world.soldierIndex.rebuild(world.soldiers);
    expect(world.soldierIndex.near(0, 250, 400, 5, [])).toEqual([far]);
  });

  it('World clamps ground hulls and wraps aircraft at rectangular X/Z extents', () => {
    const groundWorld = new World({ seed: 77, mode: 'tdm', botsPerTeam: 0, map: rectangularMap() });
    const ground = driven(groundWorld, 'buggy', 295);
    run(groundWorld, ground.pilot.id, cmd({ moveZ: -1 }), 0.5);
    expect(ground.vehicle.pos.x).toBeGreaterThan(290);
    expect(ground.vehicle.pos.x).toBeLessThanOrEqual(297);

    const airWorld = new World({ seed: 78, mode: 'tdm', botsPerTeam: 0, map: rectangularMap() });
    const air = driven(airWorld, 'interceptor', 298);
    air.vehicle.band = 3;
    run(airWorld, air.pilot.id, cmd({ moveZ: -1 }), 0.5);
    expect(air.vehicle.pos.x).toBeLessThan(-250);
    expect(air.vehicle.pos.x).toBeGreaterThanOrEqual(-299);
  });

  it('World lets a ground hull drive across open terrain beyond the legacy edge', () => {
    const world = new World({ seed: 79, mode: 'tdm', botsPerTeam: 0, map: rectangularMap() });
    const drivenHull = driven(world, 'buggy', 200);
    run(world, drivenHull.pilot.id, cmd({ moveZ: -1 }), 1);
    expect(drivenHull.vehicle.pos.x).toBeGreaterThan(204);
  });
});
