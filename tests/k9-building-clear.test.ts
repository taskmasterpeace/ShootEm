import { describe, expect, it } from 'vitest';
import {
  F2_FLOOR,
  F2_DOOR_V,
  F2_DOOR_V_OPEN,
  F2_STAIR_E,
  F2_THIN_WALL_V,
  GRID,
  TILE,
  T_LADDER,
  T_OPEN,
  T_STAIRS_E,
  T_THIN_DOOR_V,
  T_THIN_DOOR_V_OPEN,
  T_THIN_WALL_V,
  T_WINDOW_V,
  WORLD,
  windowIsBroken,
  type House,
} from '../src/sim/map';
import { ensureUpperFloor } from '../src/sim/map-layers';
import { setK9Sic, setK9Stay } from '../src/sim/k9-orders';
import { applySnapshot, createPuppetWorld, takeSnapshot } from '../src/sim/snapshot';
import type { PlayerCmd, Soldier } from '../src/sim/types';
import { World } from '../src/sim/world';

const at = (tile: number) => (tile + 0.5) * TILE - WORLD / 2;
const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const stepFor = (world: World, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) world.step(1 / 60, new Map());
};

interface Fixture {
  world: World;
  handler: Soldier;
  dog: Soldier;
  house: House;
  cx: number;
  cz: number;
}

function openHouse(floors: 1 | 2 | 3 = 1): Fixture {
  const world = new World({ seed: 9901, mode: 'tdm', botsPerTeam: 0 });
  const cx = Math.floor(GRID / 2) + 9;
  const cz = Math.floor(GRID / 2);
  const house: House = {
    id: 900,
    center: { x: at(cx), y: 0, z: at(cz) },
    door: { x: at(cx - 6), y: 0, z: at(cz) },
    tx: cx - 6,
    tz: cz - 3,
    tw: 13,
    th: 7,
    floors,
  };
  world.map.houses = [house];
  const uppers = Array.from({ length: floors - 1 }, (_, index) => ensureUpperFloor(world.map, index + 1));
  for (let z = house.tz; z < house.tz + house.th; z++) {
    for (let x = house.tx; x < house.tx + house.tw; x++) {
      world.map.grid[z * GRID + x] = T_OPEN;
      for (const upper of uppers) upper[z * GRID + x] = F2_FLOOR;
    }
  }
  if (floors > 1) {
    const stair = cz * GRID + cx;
    world.map.grid[stair] = T_STAIRS_E;
    for (const upper of uppers) upper[stair] = F2_STAIR_E;
  }
  const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
  handler.pos = { x: at(cx - 22), y: 0, z: at(cz) };
  const dog = world.addDog(handler);
  dog.pos = { x: at(cx - 5), y: 0, z: at(cz) };
  dog.k9Order = 'heel';
  return { world, handler, dog, house, cx, cz };
}

describe('K9 building clear', () => {
  it('detects a cloaked Level 3 occupant, climbs stairs, marks at nose range, and bites', () => {
    const { world, dog, house, cx, cz } = openHouse(3);
    const hidden = world.addSoldier('Hidden', 'infiltrator', 1, 'human');
    hidden.pos = { x: at(cx + 4), y: 8, z: at(cz) };
    hidden.floor = 2;
    hidden.cloaked = true;
    hidden.hp = hidden.maxHp = 1_000;
    setK9Sic(dog, 0, house.center);

    expect(world.pinged.has(hidden.id)).toBe(false);
    stepFor(world, 12);

    expect(dog.floor).toBe(2);
    expect(dog.ladderDirection).toBeUndefined();
    expect(dog.k9TargetId).toBe(hidden.id);
    expect(world.pinged.has(hidden.id)).toBe(true);
    expect(hidden.hp).toBeLessThan(hidden.maxHp);
  });

  it('never uses a ladder-only route to an upstairs occupant', () => {
    const { world, dog, house, cx, cz } = openHouse(2);
    const stair = cz * GRID + cx;
    world.map.grid[stair] = T_LADDER;
    const hidden = world.addSoldier('Hidden', 'infantry', 1, 'human');
    hidden.pos = { x: at(cx + 4), y: 4, z: at(cz) };
    hidden.floor = 1;
    setK9Sic(dog, 0, house.center);

    world.step(1 / 60, new Map());
    expect((dog.botRepathAt ?? 0) - world.time).toBeGreaterThanOrEqual(1);
    stepFor(world, 6 - 1 / 60);

    expect(dog.floor).toBe(0);
    expect(dog.ladderDirection).toBeUndefined();
    expect(hidden.hp).toBe(hidden.maxHp);
  });

  it('waits at a closed door without opening or damaging it, then resumes when the handler opens it', () => {
    const { world, handler, dog, house, cx, cz } = openHouse();
    for (let z = 1; z < GRID - 1; z++) world.map.grid[z * GRID + cx] = T_THIN_WALL_V;
    const doorIndex = cz * GRID + cx;
    world.map.grid[doorIndex] = T_THIN_DOOR_V;
    dog.pos = { x: at(cx - 3), y: 0, z: at(cz) };
    const hidden = world.addSoldier('Hidden', 'infantry', 1, 'human');
    hidden.pos = { x: at(cx + 3), y: 0, z: at(cz) };
    setK9Sic(dog, 0, house.center);

    stepFor(world, 2);

    expect(world.map.grid[doorIndex]).toBe(T_THIN_DOOR_V);
    expect(world.doorChanges).toHaveLength(0);
    expect(dog.k9Door).toBe(doorIndex);
    expect(hidden.hp).toBe(hidden.maxHp);
    expect(world.takeEvents().filter((event) => event.type === 'announce' && event.text?.includes('WAITING AT DOOR')))
      .toHaveLength(1);

    handler.pos = { x: at(cx - 1), y: 0, z: at(cz) };
    world.applyCmd(handler, cmd({ use: true, aimYaw: 0 }), 1 / 60);
    expect(world.map.grid[doorIndex]).toBe(T_THIN_DOOR_V_OPEN);
    stepFor(world, 3);
    expect(hidden.hp).toBeLessThan(hidden.maxHp);
  });

  it('does not break intact glass while pursuing an occupant', () => {
    const { world, dog, house, cx, cz } = openHouse();
    for (let z = 1; z < GRID - 1; z++) world.map.grid[z * GRID + cx] = T_THIN_WALL_V;
    const windowIndex = cz * GRID + cx;
    world.map.grid[windowIndex] = T_WINDOW_V;
    dog.pos = { x: at(cx - 3), y: 0, z: at(cz) };
    const hidden = world.addSoldier('Hidden', 'infantry', 1, 'human');
    hidden.pos = { x: at(cx + 3), y: 0, z: at(cz) };
    setK9Sic(dog, 0, house.center);

    stepFor(world, 3);

    expect(windowIsBroken(world.map.grid[windowIndex])).toBe(false);
    expect(hidden.hp).toBe(hidden.maxHp);
  });

  it('approaches and waits at a closed thin door on an upper floor', () => {
    const { world, handler, dog, house, cx, cz } = openHouse(2);
    const upper = ensureUpperFloor(world.map, 1);
    for (let z = 1; z < GRID - 1; z++) upper[z * GRID + cx] = F2_THIN_WALL_V;
    const doorIndex = cz * GRID + cx;
    upper[doorIndex] = F2_DOOR_V;
    dog.floor = 1;
    dog.pos = { x: at(cx - 3), y: 4, z: at(cz) };
    handler.floor = 1;
    handler.pos = { x: at(cx - 4), y: 4, z: at(cz) };
    const hidden = world.addSoldier('Hidden', 'infantry', 1, 'human');
    hidden.floor = 1;
    hidden.pos = { x: at(cx + 3), y: 4, z: at(cz) };
    setK9Sic(dog, 0, house.center);

    stepFor(world, 2);

    expect(upper[doorIndex]).toBe(F2_DOOR_V);
    expect(dog.k9Door).toBe(GRID * GRID + doorIndex);
    expect(hidden.hp).toBe(hidden.maxHp);

    handler.pos = { x: at(cx - 1), y: 4, z: at(cz) };
    world.applyCmd(handler, cmd({ use: true, aimYaw: 0 }), 1 / 60);
    expect(upper[doorIndex]).toBe(F2_DOOR_V_OPEN);
    expect(world.doorChanges).toContain(GRID * GRID + doorIndex);

    const puppet = createPuppetWorld(world.map.seed, 'tdm', world.map.theme);
    const puppetUpper = ensureUpperFloor(puppet.map, 1);
    puppetUpper[doorIndex] = F2_DOOR_V;
    applySnapshot(puppet, takeSnapshot(world, []));
    expect(puppetUpper[doorIndex]).toBe(F2_DOOR_V_OPEN);

    stepFor(world, 3);
    expect(hidden.hp).toBeLessThan(hidden.maxHp);
  });

  it('stays on its anchor, bites only within reach, and toggles back to heel', () => {
    const { world, handler, dog } = openHouse();
    dog.pos = { x: 0, y: 0, z: 0 };
    handler.pos = { x: -30, y: 0, z: 0 };
    const far = world.addSoldier('Far', 'infantry', 1, 'human');
    far.pos = { x: 10, y: 0, z: 0 };
    setK9Stay(dog);
    const anchor = { ...dog.pos };

    stepFor(world, 1);
    expect(Math.hypot(dog.pos.x - anchor.x, dog.pos.z - anchor.z)).toBeLessThan(0.75);
    expect(far.hp).toBe(far.maxHp);

    far.pos = { x: dog.pos.x + 1.4, y: 0, z: dog.pos.z };
    stepFor(world, 0.6);
    expect(far.hp).toBeLessThan(far.maxHp);
    expect(Math.hypot(dog.pos.x - anchor.x, dog.pos.z - anchor.z)).toBeLessThan(0.75);

    dog.pushX = 8;
    stepFor(world, 1.5);
    expect(Math.hypot(dog.pos.x - anchor.x, dog.pos.z - anchor.z)).toBeLessThan(0.75);

    far.alive = false;
    setK9Stay(dog);
    expect(dog.k9Order).toBe('heel');
    const before = Math.hypot(dog.pos.x - handler.pos.x, dog.pos.z - handler.pos.z);
    stepFor(world, 2);
    expect(Math.hypot(dog.pos.x - handler.pos.x, dog.pos.z - handler.pos.z)).toBeLessThan(before);
  });

  it('returns to heel only after an occupied building is clear for two seconds', () => {
    const { world, dog, house, cx, cz } = openHouse();
    const hidden = world.addSoldier('Hidden', 'infantry', 1, 'human');
    hidden.pos = { x: at(cx + 2), y: 0, z: at(cz) };
    hidden.hp = hidden.maxHp = 10_000;
    setK9Sic(dog, 0, house.center);

    stepFor(world, 5);
    hidden.alive = false;
    stepFor(world, 1);
    expect(dog.k9Order).toBe('sic');
    stepFor(world, 1.2);
    expect(dog.k9Order).toBe('heel');
    expect(world.takeEvents().some((event) => event.type === 'announce' && event.text?.includes('BUILDING CLEAR'))).toBe(true);
  });
});
