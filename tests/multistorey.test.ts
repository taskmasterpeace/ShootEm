import { describe, expect, it } from 'vitest';
import {
  F2_FLOOR,
  F2_STAIR_E,
  F2_WALL,
  F2_WELL,
  GRID,
  T_LADDER,
  T_OPEN,
  T_STAIRS_E,
  TILE,
  WORLD,
} from '../src/sim/map';
import { ensureUpperFloor, floorShotBlocked } from '../src/sim/map-layers';
import { perceivesNow } from '../src/sim/perception';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const command = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const at = (tile: number) => (tile + 0.5) * TILE - WORLD / 2;

function threeStoreyScene() {
  const world = new World({ seed: 771, mode: 'tdm' });
  const cx = Math.floor(GRID / 2) + 7;
  const cz = Math.floor(GRID / 2);
  const level2 = ensureUpperFloor(world.map, 1);
  const level3 = ensureUpperFloor(world.map, 2);
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const i = (cz + dz) * GRID + cx + dx;
      world.map.grid[i] = T_OPEN;
      level2[i] = F2_FLOOR;
      level3[i] = F2_FLOOR;
    }
  }
  const stair = cz * GRID + cx;
  world.map.grid[stair] = T_STAIRS_E;
  level2[stair] = F2_STAIR_E;
  level3[stair] = F2_STAIR_E;
  const ladder = (cz + 2) * GRID + (cx + 2);
  world.map.grid[ladder] = T_LADDER;
  level2[ladder] = F2_WELL;
  level3[ladder] = F2_WELL;
  const soldier = world.addSoldier('Surveyor', 'infantry', 0, 'human');
  soldier.pos = { x: at(cx), y: 0, z: at(cz) };
  return { world, soldier, cx, cz, level2, level3 };
}

describe('indexed three-storey circulation', () => {
  it('walks directional stairs up and back down while keeping horizontal momentum', () => {
    const { world, soldier } = threeStoreyScene();
    world.step(1 / 30, new Map([[soldier.id, command({ moveX: 1 })]]));
    expect(soldier.floor).toBe(1);
    expect(soldier.pos.y).toBe(4);
    expect(soldier.vel.x).toBeGreaterThan(0);

    for (let i = 0; i < 15 && soldier.floor < 2; i++) {
      world.step(1 / 30, new Map([[soldier.id, command({ moveX: 1 })]]));
    }
    expect(soldier.floor).toBe(2);
    expect(soldier.pos.y).toBe(8);
    expect(soldier.vel.x).toBeGreaterThan(0);

    for (let i = 0; i < 15 && soldier.floor > 1; i++) {
      world.step(1 / 30, new Map([[soldier.id, command({ moveX: -1 })]]));
    }
    expect(soldier.floor).toBe(1);
    expect(soldier.pos.y).toBe(4);
    expect(soldier.vel.x).toBeLessThan(0);
  });

  it('requires E for ladders and traverses the full shaft in both directions', () => {
    const { world, soldier, cx, cz } = threeStoreyScene();
    soldier.pos = { x: at(cx + 2), y: 0, z: at(cz + 2) };
    world.step(1 / 30, new Map([[soldier.id, command({ moveX: 1 })]]));
    expect(soldier.floor).toBe(0);

    const press = () => world.step(1 / 30, new Map([[soldier.id, command({ use: true })]]));
    const release = () => world.step(1 / 30, new Map());
    press(); expect(soldier.floor).toBe(1); release();
    press(); expect(soldier.floor).toBe(2); release();
    press(); expect(soldier.floor).toBe(1); release();
    press(); expect(soldier.floor).toBe(0);
  });

  it('falls only to the highest supported lower slab', () => {
    const { world, soldier, cx, cz, level2, level3 } = threeStoreyScene();
    soldier.floor = 2;
    soldier.pos = { x: at(cx + 1), y: 8, z: at(cz) };
    const i = cz * GRID + cx + 1;
    level3[i] = 0;
    level2[i] = F2_FLOOR;
    world.stepSoldierPhysics(soldier, 1 / 30);
    expect(soldier.floor).toBe(1);
    expect(soldier.pos.y).toBe(4);
  });

  it('rebases Level 3 ballistic collision into its world-height band', () => {
    const { world, cx, cz, level3 } = threeStoreyScene();
    level3[cz * GRID + cx] = F2_WALL;
    expect(floorShotBlocked(world.map, 2, at(cx), at(cz), 9.4)).toBe(true);
    expect(floorShotBlocked(world.map, 2, at(cx), at(cz), 5.4)).toBe(false);
  });

  it('uses Level 3 walls for same-storey perception', () => {
    const { world, cx, cz, level3 } = threeStoreyScene();
    const eye = world.addSoldier('Eye', 'infantry', 0, 'human');
    const target = world.addSoldier('Target', 'infantry', 1, 'bot');
    eye.floor = target.floor = 2;
    eye.pos = { x: at(cx - 2), y: 8, z: at(cz) };
    target.pos = { x: at(cx + 2), y: 8, z: at(cz) };
    eye.yaw = 0;
    level3[cz * GRID + cx] = F2_WALL;
    expect(perceivesNow(world.map.grid, [eye], new Set(), target, 40, [], undefined,
      world.map.grid2, world.map.upperLayers)).toBe(false);
    level3[cz * GRID + cx] = F2_FLOOR;
    expect(perceivesNow(world.map.grid, [eye], new Set(), target, 40, [], undefined,
      world.map.grid2, world.map.upperLayers)).toBe(true);
  });
});
